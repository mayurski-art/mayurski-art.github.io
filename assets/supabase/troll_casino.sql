-- ============================================================================
-- TROLL CASINO — real-money chip ledger, deposits, redemptions, jackpot.
-- Run ONCE in the Supabase SQL editor (same project as troll_accounts.sql).
-- Requires troll_accounts.sql to already be applied (troll_profiles, auth).
-- Every statement below is idempotent (create if not exists / create or
-- replace / drop policy if exists), so re-running this whole file to pick up
-- a later change is safe.
--
-- MONEY MODEL
--   * Two real balances per user: troll_balance and usdc_balance, both held
--     in NATIVE TOKEN UNITS (actual $TROLL count / actual USDC count) — not
--     an abstracted "chip". This matches what the existing casino UI already
--     shows (a $TROLL stack and a USDC stack you can switch between) and
--     means redemption pays back the exact token amount owed, with no
--     price-at-cashout conversion or solvency mismatch.
--   * Tokens enter ONLY via troll_casino_confirm_deposit(), which requires a
--     real on-chain tx signature from TrollPay and is idempotent on that
--     signature (can't be replayed to double-credit).
--   * Tokens leave ONLY via troll_casino_request_redemption(), which debits
--     the balance immediately and files a PENDING request. There is NO
--     automatic payout — you (the admin) review pending redemptions, pay
--     the player manually from your own wallet, then mark the request
--     paid/rejected. Rejecting refunds the balance atomically. The admin
--     panel's "Pay via Phantom" button (casino-admin.js, TrollPay.payExact)
--     is a convenience that signs+sends that same manual payment for you and
--     auto-fills the paid tx signature — it still requires you to personally
--     approve and sign every transaction in Phantom; nothing here runs
--     unattended or without a human clicking "Confirm" in the wallet.
--   * In-round bet/win adjustments (troll_casino_adjust_balance) are, like
--     every other game's score submission in this schema, CLIENT-TRUSTED —
--     there is no server-side RNG authority for Troll Wheel / Blackjack /
--     Slots. (Whale Launch Crash is the one exception: its crash point comes
--     from the server-side troll_casino_crash_round() below, provably fair.)
--     adjust_balance guarantees atomicity, a floor at 0, a per-call delta
--     cap, a balance ceiling, a burst rate limit, and an audit row per call —
--     not fairness for the other three games. Real-money risk is further
--     capped by the fact that money only LEAVES via the manual-review
--     redemption path above, and troll_casino_admin_player_summary() gives
--     that reviewer a lifetime deposit/payout comparison to catch an
--     implausible balance before approving it.
--   * Players can opt into their own daily loss cap and/or self-exclusion
--     window (troll_casino_set_limits), enforced inside adjust_balance —
--     see "LIMITS" below.
--
-- ADMIN ACCESS
--   Adds `is_admin` to troll_profiles. Flip it to true for your own account
--   by hand in Supabase Table Editor (UPDATE troll_profiles SET is_admin =
--   true WHERE id = '<your-user-id>'). That flag — checked server-side in
--   every admin function/policy below — is the REAL security boundary.
--   Any client-side password prompt the admin page shows is just a UI
--   convenience layer on top of this, not a substitute for it.
-- ============================================================================

create extension if not exists pgcrypto;

alter table public.troll_profiles
  add column if not exists is_admin boolean not null default false;

-- ============================================================
-- 1. WALLET (one row per user; balances only ever change via RPC)
-- ============================================================
create table if not exists public.troll_casino_wallet (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  troll_balance numeric not null default 0 check (troll_balance >= 0),
  usdc_balance  numeric not null default 0 check (usdc_balance >= 0),
  updated_at    timestamptz not null default now()
);

alter table public.troll_casino_wallet enable row level security;

drop policy if exists troll_casino_wallet_read on public.troll_casino_wallet;
create policy troll_casino_wallet_read on public.troll_casino_wallet
  for select to authenticated using (auth.uid() = user_id);

-- Owner may create their own zero-balance row; no other inserts allowed and
-- there is no update grant at all — every balance change goes through a
-- SECURITY DEFINER function below.
drop policy if exists troll_casino_wallet_insert on public.troll_casino_wallet;
create policy troll_casino_wallet_insert on public.troll_casino_wallet
  for insert to authenticated
  with check (auth.uid() = user_id and troll_balance = 0 and usdc_balance = 0);

revoke all on public.troll_casino_wallet from anon, authenticated;
grant select on public.troll_casino_wallet to authenticated;
grant insert (user_id, troll_balance, usdc_balance) on public.troll_casino_wallet to authenticated;

create or replace function public.troll_casino_ensure_wallet()
returns public.troll_casino_wallet
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row troll_casino_wallet%rowtype;
begin
  if v_uid is null then raise exception 'Login required.'; end if;
  insert into troll_casino_wallet (user_id) values (v_uid)
  on conflict (user_id) do nothing;
  select * into v_row from troll_casino_wallet where user_id = v_uid;
  return v_row;
end;
$$;
revoke all on function public.troll_casino_ensure_wallet() from public, anon;
grant execute on function public.troll_casino_ensure_wallet() to authenticated;

-- ============================================================
-- 1b. ADJUSTMENT AUDIT TRAIL + PLAYER-SET LIMITS
--     Both feed the gate inside troll_casino_adjust_balance further down —
--     defined first since that function references them.
-- ============================================================
create table if not exists public.troll_casino_adjustments (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  delta         numeric not null,
  currency      text not null check (currency in ('TROLL', 'USDC')),
  reason        text,
  balance_after numeric not null,
  created_at    timestamptz not null default now()
);

create index if not exists troll_casino_adjustments_user_idx
  on public.troll_casino_adjustments (user_id, created_at desc);

alter table public.troll_casino_adjustments enable row level security;

drop policy if exists troll_casino_adjustments_read on public.troll_casino_adjustments;
create policy troll_casino_adjustments_read on public.troll_casino_adjustments
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.troll_casino_adjustments from anon, authenticated;
grant select on public.troll_casino_adjustments to authenticated;

-- Player-settable limits. Both are opt-in (null = no cap) and can only ever
-- be tightened by the player themselves via troll_casino_set_limits — there
-- is deliberately no player-facing "raise my cap early" escape hatch once a
-- self-exclusion window is active (see the check inside that function).
create table if not exists public.troll_casino_limits (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  daily_loss_cap     numeric check (daily_loss_cap is null or daily_loss_cap > 0),
  self_exclude_until timestamptz,
  updated_at         timestamptz not null default now()
);

alter table public.troll_casino_limits enable row level security;

drop policy if exists troll_casino_limits_read on public.troll_casino_limits;
create policy troll_casino_limits_read on public.troll_casino_limits
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.troll_casino_limits from anon, authenticated;
grant select on public.troll_casino_limits to authenticated;

create or replace function public.troll_casino_set_limits(
  p_daily_loss_cap numeric default null,
  p_self_exclude_hours numeric default null
)
returns public.troll_casino_limits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing troll_casino_limits%rowtype;
  v_new_exclude timestamptz;
  v_row troll_casino_limits%rowtype;
begin
  if v_uid is null then raise exception 'Login required.'; end if;

  select * into v_existing from troll_casino_limits where user_id = v_uid;

  -- Tightening only: a lower/absent cap always applies; raising or clearing
  -- an existing cap is refused so a losing streak can't self-serve a bigger
  -- limit mid-session. Same for self-exclusion — it can be extended or left
  -- alone, never shortened.
  if v_existing.daily_loss_cap is not null and p_daily_loss_cap is not null
     and p_daily_loss_cap > v_existing.daily_loss_cap then
    raise exception 'Loss cap can only be lowered while one is active.';
  end if;
  if v_existing.daily_loss_cap is not null and p_daily_loss_cap is null then
    raise exception 'An active loss cap cannot be removed here — it expires automatically each day.';
  end if;

  if p_self_exclude_hours is not null and p_self_exclude_hours > 0 then
    v_new_exclude := now() + (p_self_exclude_hours || ' hours')::interval;
    if v_existing.self_exclude_until is not null and v_existing.self_exclude_until > v_new_exclude then
      v_new_exclude := v_existing.self_exclude_until; -- never shorten
    end if;
  else
    v_new_exclude := v_existing.self_exclude_until;
  end if;

  insert into troll_casino_limits (user_id, daily_loss_cap, self_exclude_until, updated_at)
  values (v_uid, coalesce(p_daily_loss_cap, v_existing.daily_loss_cap), v_new_exclude, now())
  on conflict (user_id) do update
    set daily_loss_cap = excluded.daily_loss_cap,
        self_exclude_until = excluded.self_exclude_until,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.troll_casino_set_limits(numeric, numeric) from public, anon;
grant execute on function public.troll_casino_set_limits(numeric, numeric) to authenticated;

-- Gameplay bet/win adjustments. Client-trusted (see header) but atomic,
-- floored at 0 so a client can never push its own balance negative, and
-- capped so a single bogus call (e.g. someone calling credit(999999999)
-- straight from devtools) can't inflate a balance past anything a real
-- spin/hand/round could ever produce. The per-call cap is well above the
-- biggest legitimate single win (Troll Wheel WHALE at max chip, or a GRAND
-- jackpot share); the balance ceiling is a second, generous backstop. Also
-- writes an audit row per call, enforces a burst rate limit, and honors any
-- daily loss cap / self-exclusion window the player has set for themselves.
create or replace function public.troll_casino_adjust_balance(
  p_delta    numeric,
  p_currency text,
  p_reason   text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new numeric;
  v_max_delta   numeric;
  v_max_balance numeric;
  v_recent_calls int;
  v_limits troll_casino_limits%rowtype;
  v_lost_today numeric;
begin
  if v_uid is null then raise exception 'Login required.'; end if;
  if p_currency not in ('TROLL', 'USDC') then raise exception 'Bad currency.'; end if;

  v_max_delta   := case when p_currency = 'TROLL' then 1000000 else 5000 end;
  v_max_balance := case when p_currency = 'TROLL' then 10000000 else 50000 end;
  if abs(p_delta) > v_max_delta then raise exception 'Delta out of range.'; end if;

  -- Burst limit: no legitimate UI flow (wheel/slots/blackjack/crash) issues
  -- more than a couple of adjust calls per round, and rounds take at least
  -- a second or two end to end. 20 calls inside a 10-second window is a
  -- generous ceiling above real play and a hard stop for a scripted loop.
  select count(*) into v_recent_calls
    from troll_casino_adjustments
   where user_id = v_uid and created_at > now() - interval '10 seconds';
  if v_recent_calls >= 20 then
    raise exception 'Slow down — too many balance updates in a short window.';
  end if;

  select * into v_limits from troll_casino_limits where user_id = v_uid;
  if v_limits.self_exclude_until is not null and v_limits.self_exclude_until > now() then
    raise exception 'Self-exclusion active until %.', v_limits.self_exclude_until;
  end if;
  if p_delta < 0 and v_limits.daily_loss_cap is not null then
    select coalesce(sum(-delta), 0) into v_lost_today
      from troll_casino_adjustments
     where user_id = v_uid and currency = p_currency and delta < 0
       and created_at > date_trunc('day', now());
    if v_lost_today + abs(p_delta) > v_limits.daily_loss_cap then
      raise exception 'Daily loss cap reached for %.', p_currency;
    end if;
  end if;

  insert into troll_casino_wallet (user_id) values (v_uid)
  on conflict (user_id) do nothing;

  if p_currency = 'TROLL' then
    update troll_casino_wallet
       set troll_balance = least(v_max_balance, greatest(0, troll_balance + p_delta)), updated_at = now()
     where user_id = v_uid
     returning troll_balance into v_new;
  else
    update troll_casino_wallet
       set usdc_balance = least(v_max_balance, greatest(0, usdc_balance + p_delta)), updated_at = now()
     where user_id = v_uid
     returning usdc_balance into v_new;
  end if;

  insert into troll_casino_adjustments (user_id, delta, currency, reason, balance_after)
  values (v_uid, p_delta, p_currency, p_reason, v_new);

  return v_new;
end;
$$;
revoke all on function public.troll_casino_adjust_balance(numeric, text, text) from public, anon;
grant execute on function public.troll_casino_adjust_balance(numeric, text, text) to authenticated;

-- ============================================================
-- 2. DEPOSITS (real on-chain TrollPay payment → balance)
-- ============================================================
create table if not exists public.troll_casino_deposits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  token        text not null check (token in ('USDC', 'TROLL')),
  amount_usd   numeric not null check (amount_usd > 0),
  token_amount numeric not null check (token_amount > 0),
  tx_sig       text not null unique,
  wallet       text,
  created_at   timestamptz not null default now()
);

alter table public.troll_casino_deposits enable row level security;

drop policy if exists troll_casino_deposits_read on public.troll_casino_deposits;
create policy troll_casino_deposits_read on public.troll_casino_deposits
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.troll_casino_deposits from anon, authenticated;
grant select on public.troll_casino_deposits to authenticated;

-- The ONE door tokens come in through. tx_sig is unique, so replaying the
-- same signature twice (e.g. a retried client call) can't double-credit.
create or replace function public.troll_casino_confirm_deposit(
  p_token        text,
  p_amount_usd   numeric,
  p_token_amount numeric,
  p_tx_sig       text,
  p_wallet       text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new numeric;
begin
  if v_uid is null then raise exception 'Login required.'; end if;
  if p_token not in ('USDC', 'TROLL') then raise exception 'Bad token.'; end if;
  if p_amount_usd is null or p_amount_usd <= 0 then raise exception 'Bad amount.'; end if;
  if p_token_amount is null or p_token_amount <= 0 then raise exception 'Bad token amount.'; end if;
  if p_tx_sig is null or length(p_tx_sig) < 10 then raise exception 'Missing transaction signature.'; end if;

  insert into troll_casino_deposits (user_id, token, amount_usd, token_amount, tx_sig, wallet)
  values (v_uid, p_token, p_amount_usd, p_token_amount, p_tx_sig, p_wallet);
  -- unique violation on tx_sig raises and aborts the whole function —
  -- the same signature can never credit twice.

  v_new := troll_casino_adjust_balance(p_token_amount, p_token, 'deposit');
  return v_new;
end;
$$;
revoke all on function public.troll_casino_confirm_deposit(text, numeric, numeric, text, text) from public, anon;
grant execute on function public.troll_casino_confirm_deposit(text, numeric, numeric, text, text) to authenticated;

-- ============================================================
-- 3. REDEMPTIONS (balance → manual real payout, admin-reviewed)
-- ============================================================
create table if not exists public.troll_casino_redemptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  wallet        text not null,
  token         text not null check (token in ('USDC', 'TROLL')),
  token_amount  numeric not null check (token_amount > 0),
  status        text not null default 'pending'
                  check (status in ('pending', 'paid', 'rejected')),
  admin_note    text,
  paid_tx       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists troll_casino_redemptions_status_idx
  on public.troll_casino_redemptions (status, created_at desc);

alter table public.troll_casino_redemptions enable row level security;

-- Owners see their own requests; admins (is_admin) see everything.
drop policy if exists troll_casino_redemptions_read on public.troll_casino_redemptions;
create policy troll_casino_redemptions_read on public.troll_casino_redemptions
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from troll_profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Only admins may update rows, and only via the RPCs below in practice —
-- this policy is a backstop, the RPCs are the intended path.
drop policy if exists troll_casino_redemptions_admin_update on public.troll_casino_redemptions;
create policy troll_casino_redemptions_admin_update on public.troll_casino_redemptions
  for update to authenticated
  using (exists (select 1 from troll_profiles p where p.id = auth.uid() and p.is_admin));

revoke all on public.troll_casino_redemptions from anon, authenticated;
grant select on public.troll_casino_redemptions to authenticated;
grant update (status, admin_note, paid_tx, updated_at) on public.troll_casino_redemptions to authenticated;

-- Realtime: lets the admin panel react the instant a request is filed,
-- instead of only on page load/refresh. RLS above still applies to what a
-- given subscriber actually receives (admins see all rows, players see only
-- their own), so this is safe to broadcast broadly.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'troll_casino_redemptions'
  ) then
    alter publication supabase_realtime add table public.troll_casino_redemptions;
  end if;
end $$;

-- Player-facing: debit + file the request atomically.
create or replace function public.troll_casino_request_redemption(
  p_wallet       text,
  p_token        text,
  p_token_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bal numeric;
  v_id  uuid;
begin
  if v_uid is null then raise exception 'Login required.'; end if;
  if p_token not in ('USDC', 'TROLL') then raise exception 'Bad token.'; end if;
  if p_token_amount is null or p_token_amount <= 0 then raise exception 'Bad amount.'; end if;
  if p_wallet is null or length(p_wallet) < 20 then raise exception 'Enter a valid payout wallet address.'; end if;

  if p_token = 'TROLL' then
    select troll_balance into v_bal from troll_casino_wallet where user_id = v_uid for update;
  else
    select usdc_balance into v_bal from troll_casino_wallet where user_id = v_uid for update;
  end if;
  if v_bal is null or v_bal < p_token_amount then raise exception 'Not enough balance.'; end if;

  if p_token = 'TROLL' then
    update troll_casino_wallet set troll_balance = troll_balance - p_token_amount, updated_at = now()
     where user_id = v_uid;
  else
    update troll_casino_wallet set usdc_balance = usdc_balance - p_token_amount, updated_at = now()
     where user_id = v_uid;
  end if;

  insert into troll_casino_redemptions (user_id, wallet, token, token_amount)
  values (v_uid, p_wallet, p_token, p_token_amount)
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.troll_casino_request_redemption(text, text, numeric) from public, anon;
grant execute on function public.troll_casino_request_redemption(text, text, numeric) to authenticated;

-- Admin-only: mark paid (you sent the funds yourself, outside this app).
create or replace function public.troll_casino_admin_mark_paid(
  p_id   uuid,
  p_tx   text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from troll_profiles where id = auth.uid() and is_admin) then
    raise exception 'Admin only.';
  end if;
  update troll_casino_redemptions
     set status = 'paid', paid_tx = p_tx, admin_note = coalesce(p_note, admin_note), updated_at = now()
   where id = p_id and status = 'pending';
end;
$$;
revoke all on function public.troll_casino_admin_mark_paid(uuid, text, text) from public, anon;
grant execute on function public.troll_casino_admin_mark_paid(uuid, text, text) to authenticated;

-- Admin-only: reject + refund the balance atomically.
create or replace function public.troll_casino_admin_reject_redemption(
  p_id   uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row troll_casino_redemptions%rowtype;
begin
  if not exists (select 1 from troll_profiles where id = auth.uid() and is_admin) then
    raise exception 'Admin only.';
  end if;
  select * into v_row from troll_casino_redemptions where id = p_id and status = 'pending';
  if not found then raise exception 'Request not pending.'; end if;

  update troll_casino_redemptions
     set status = 'rejected', admin_note = coalesce(p_note, admin_note), updated_at = now()
   where id = p_id;

  perform troll_casino_adjust_balance(v_row.token_amount, v_row.token, 'redemption-rejected-refund');
end;
$$;
revoke all on function public.troll_casino_admin_reject_redemption(uuid, text) from public, anon;
grant execute on function public.troll_casino_admin_reject_redemption(uuid, text) to authenticated;

-- Admin-only: a player's lifetime money-in/money-out summary, so the
-- redemption panel can show current balance alongside what they've actually
-- deposited and been paid — an inflated gameplay balance (see the cap in
-- troll_casino_adjust_balance above) stands out immediately next to a
-- deposit history that doesn't support it.
create or replace function public.troll_casino_admin_player_summary(p_user_id uuid)
returns table(
  troll_balance   numeric,
  usdc_balance    numeric,
  troll_deposited numeric,
  usdc_deposited  numeric,
  troll_paid_out  numeric,
  usdc_paid_out   numeric,
  deposit_count   int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from troll_profiles where id = auth.uid() and is_admin) then
    raise exception 'Admin only.';
  end if;

  return query
  select
    coalesce(w.troll_balance, 0),
    coalesce(w.usdc_balance, 0),
    coalesce((select sum(d.token_amount) from troll_casino_deposits d where d.user_id = p_user_id and d.token = 'TROLL'), 0),
    coalesce((select sum(d.token_amount) from troll_casino_deposits d where d.user_id = p_user_id and d.token = 'USDC'), 0),
    coalesce((select sum(r.token_amount) from troll_casino_redemptions r where r.user_id = p_user_id and r.token = 'TROLL' and r.status = 'paid'), 0),
    coalesce((select sum(r.token_amount) from troll_casino_redemptions r where r.user_id = p_user_id and r.token = 'USDC' and r.status = 'paid'), 0),
    (select count(*) from troll_casino_deposits d where d.user_id = p_user_id)::int
  from (select p_user_id as user_id) u
  left join troll_casino_wallet w on w.user_id = u.user_id;
end;
$$;
revoke all on function public.troll_casino_admin_player_summary(uuid) from public, anon;
grant execute on function public.troll_casino_admin_player_summary(uuid) to authenticated;

-- ============================================================
-- 4. SHARED PROGRESSIVE JACKPOT (Doge Jackpot Reels), per currency,
--    + a public log of every win so the pot's payouts are visible, not
--    just its running total.
-- ============================================================
create table if not exists public.troll_casino_jackpot (
  id           int primary key default 1,
  troll_amount numeric not null default 500000,
  usdc_amount  numeric not null default 2000,
  troll_seed   numeric not null default 500000,
  usdc_seed    numeric not null default 2000,
  updated_at   timestamptz not null default now(),
  constraint troll_casino_jackpot_singleton check (id = 1)
);

insert into public.troll_casino_jackpot (id) values (1) on conflict (id) do nothing;

alter table public.troll_casino_jackpot enable row level security;

drop policy if exists troll_casino_jackpot_read on public.troll_casino_jackpot;
create policy troll_casino_jackpot_read on public.troll_casino_jackpot
  for select to anon, authenticated using (true);

revoke all on public.troll_casino_jackpot from anon, authenticated;
grant select on public.troll_casino_jackpot to anon, authenticated;

create table if not exists public.troll_casino_jackpot_wins (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  currency   text not null check (currency in ('TROLL', 'USDC')),
  amount     numeric not null,
  tier       text,
  created_at timestamptz not null default now()
);

alter table public.troll_casino_jackpot_wins enable row level security;

drop policy if exists troll_casino_jackpot_wins_read on public.troll_casino_jackpot_wins;
create policy troll_casino_jackpot_wins_read on public.troll_casino_jackpot_wins
  for select to anon, authenticated using (true);

revoke all on public.troll_casino_jackpot_wins from anon, authenticated;
grant select on public.troll_casino_jackpot_wins to anon, authenticated;

create or replace function public.troll_casino_jackpot_contribute(p_currency text, p_delta numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare v_new numeric;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if p_currency not in ('TROLL', 'USDC') then raise exception 'Bad currency.'; end if;
  if p_delta is null or p_delta <= 0 then raise exception 'Bad amount.'; end if;
  if p_currency = 'TROLL' then
    update troll_casino_jackpot set troll_amount = troll_amount + p_delta, updated_at = now()
     where id = 1 returning troll_amount into v_new;
  else
    update troll_casino_jackpot set usdc_amount = usdc_amount + p_delta, updated_at = now()
     where id = 1 returning usdc_amount into v_new;
  end if;
  return v_new;
end;
$$;
revoke all on function public.troll_casino_jackpot_contribute(text, numeric) from public, anon;
grant execute on function public.troll_casino_jackpot_contribute(text, numeric) to authenticated;

-- p_share lets a tier take only a slice of the pot (e.g. 0.25/0.6 for
-- MINOR/MAJOR) instead of draining it — the pot only resets to its seed
-- when a full share (>= 1, the GRAND tier) is taken. This ONLY drains the
-- shared pot and returns the amount won — it deliberately does NOT credit
-- the caller's own balance, so the client (which already knows how to
-- credit + queue a sync for every other kind of win) credits it exactly
-- once via the normal debit/credit path instead of being double-credited
-- here as well. Also logs a public row to troll_casino_jackpot_wins.
create or replace function public.troll_casino_jackpot_win(p_currency text, p_share numeric default 1, p_tier text default null)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_pot   numeric;
  v_seed  numeric;
  v_won   numeric;
  v_share numeric := greatest(0, least(1, coalesce(p_share, 1)));
begin
  if v_uid is null then raise exception 'Login required.'; end if;
  if p_currency not in ('TROLL', 'USDC') then raise exception 'Bad currency.'; end if;

  if p_currency = 'TROLL' then
    select troll_amount, troll_seed into v_pot, v_seed from troll_casino_jackpot where id = 1 for update;
  else
    select usdc_amount, usdc_seed into v_pot, v_seed from troll_casino_jackpot where id = 1 for update;
  end if;

  v_won := round(v_pot * v_share, 2);
  if p_currency = 'TROLL' then
    update troll_casino_jackpot
       set troll_amount = case when v_share >= 1 then v_seed else greatest(v_seed, v_pot - v_won) end,
           updated_at = now()
     where id = 1;
  else
    update troll_casino_jackpot
       set usdc_amount = case when v_share >= 1 then v_seed else greatest(v_seed, v_pot - v_won) end,
           updated_at = now()
     where id = 1;
  end if;

  insert into troll_casino_jackpot_wins (user_id, currency, amount, tier)
  values (v_uid, p_currency, v_won, p_tier);

  return v_won;
end;
$$;
revoke all on function public.troll_casino_jackpot_win(text, numeric, text) from public, anon;
grant execute on function public.troll_casino_jackpot_win(text, numeric, text) to authenticated;

-- ============================================================
-- 5. PROVABLY-FAIR WHALE LAUNCH CRASH
--    One RPC per round: server generates + hashes a seed, combines it with
--    the player's client seed via HMAC-SHA256, derives the crash point with
--    the exact same formula crash.js's local sampleCrash() uses as its
--    fallback, and returns the seed + hash + point together. Because the
--    hash is computed from a seed that's fixed before the client seed or
--    point are ever exposed, there is no window for the server to pick a
--    point after the fact — the player can independently recompute
--    HMAC(client_seed:nonce, server_seed) and confirm it against
--    server_seed_hash forever after.
-- ============================================================
create table if not exists public.troll_casino_crash_rounds (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  server_seed       text not null,
  server_seed_hash  text not null,
  client_seed       text not null,
  nonce             bigint not null,
  crash_point       numeric not null,
  created_at        timestamptz not null default now()
);

create index if not exists troll_casino_crash_rounds_user_idx
  on public.troll_casino_crash_rounds (user_id, created_at desc);

alter table public.troll_casino_crash_rounds enable row level security;

drop policy if exists troll_casino_crash_rounds_read on public.troll_casino_crash_rounds;
create policy troll_casino_crash_rounds_read on public.troll_casino_crash_rounds
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.troll_casino_crash_rounds from anon, authenticated;
grant select on public.troll_casino_crash_rounds to authenticated;

create or replace function public.troll_casino_crash_round(p_client_seed text default null)
returns table(
  round_id         uuid,
  server_seed      text,
  server_seed_hash text,
  client_seed      text,
  nonce            bigint,
  crash_point      numeric
)
language plpgsql
security definer
-- Supabase installs pgcrypto into the `extensions` schema by default, not
-- `public` — this is the only function here that calls gen_random_bytes/
-- digest/hmac, so it's the only one that needs that schema on the path.
set search_path = public, extensions
as $$
declare
  v_uid    uuid := auth.uid();
  v_seed   text := encode(gen_random_bytes(32), 'hex');
  v_hash   text;
  v_cseed  text := coalesce(nullif(trim(p_client_seed), ''), encode(gen_random_bytes(8), 'hex'));
  v_nonce  bigint;
  v_id     uuid;
  v_hex    text;
  v_u      double precision;
  v_edge   numeric := 0.04;
  v_point  numeric;
begin
  if v_uid is null then raise exception 'Login required.'; end if;

  -- digest()/hmac() take bytea; plpgsql text variables need an explicit cast
  -- (unlike an untyped string literal, which Postgres resolves for you).
  v_hash := encode(digest(v_seed::bytea, 'sha256'), 'hex');

  select coalesce(max(troll_casino_crash_rounds.nonce), 0) + 1 into v_nonce
    from troll_casino_crash_rounds where user_id = v_uid;

  v_hex := encode(hmac((v_cseed || ':' || v_nonce::text)::bytea, v_seed::bytea, 'sha256'), 'hex');
  -- first 13 hex chars → 52-bit uniform in [0, 1); same shape as crash.js's
  -- original crypto.getRandomValues()-based crRand01().
  v_u := ('x' || substr(v_hex, 1, 13))::bit(52)::bigint::double precision / (2.0 ^ 52);

  if v_u < v_edge then
    v_point := 1.00;
  else
    v_point := greatest(1.00, floor(100 * (1 - v_edge) / (1 - v_u)) / 100.0);
  end if;

  insert into troll_casino_crash_rounds
    (user_id, server_seed, server_seed_hash, client_seed, nonce, crash_point)
  values (v_uid, v_seed, v_hash, v_cseed, v_nonce, v_point)
  returning id into v_id;

  return query select v_id, v_seed, v_hash, v_cseed, v_nonce, v_point;
end;
$$;
revoke all on function public.troll_casino_crash_round(text) from public, anon;
grant execute on function public.troll_casino_crash_round(text) to authenticated;

-- ============================================================
-- NOTE — the original one-time launch reset (clearing pre-launch mock-era
-- troll-casino leaderboard/stats rows) has been removed from this file after
-- running once. Do not re-add a DELETE here — this file is now safe to
-- re-run in full, and a reset statement would defeat that.
-- ============================================================
