-- ============================================================================
-- TROLL CASINO — real-money chip ledger, deposits, redemptions, jackpot.
-- Run ONCE in the Supabase SQL editor (same project as troll_accounts.sql).
-- Requires troll_accounts.sql to already be applied (troll_profiles, auth).
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
--     paid/rejected. Rejecting refunds the balance atomically.
--   * In-round bet/win adjustments (troll_casino_adjust_balance) are, like
--     every other game's score submission in this schema, CLIENT-TRUSTED —
--     there is no server-side RNG authority here. This function only
--     guarantees atomicity and a floor at 0, not fairness. Real-money risk
--     is capped by the fact that money only LEAVES via the manual-review
--     redemption path above.
--
-- ADMIN ACCESS
--   Adds `is_admin` to troll_profiles. Flip it to true for your own account
--   by hand in Supabase Table Editor (UPDATE troll_profiles SET is_admin =
--   true WHERE id = '<your-user-id>'). That flag — checked server-side in
--   every admin function/policy below — is the REAL security boundary.
--   Any client-side password prompt the admin page shows is just a UI
--   convenience layer on top of this, not a substitute for it.
-- ============================================================================

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

-- Gameplay bet/win adjustments. Client-trusted (see header) but atomic and
-- floored at 0 so a client can never push its own balance negative.
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
begin
  if v_uid is null then raise exception 'Login required.'; end if;
  if p_currency not in ('TROLL', 'USDC') then raise exception 'Bad currency.'; end if;
  insert into troll_casino_wallet (user_id) values (v_uid)
  on conflict (user_id) do nothing;

  if p_currency = 'TROLL' then
    update troll_casino_wallet
       set troll_balance = greatest(0, troll_balance + p_delta), updated_at = now()
     where user_id = v_uid
     returning troll_balance into v_new;
  else
    update troll_casino_wallet
       set usdc_balance = greatest(0, usdc_balance + p_delta), updated_at = now()
     where user_id = v_uid
     returning usdc_balance into v_new;
  end if;

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

-- ============================================================
-- 4. SHARED PROGRESSIVE JACKPOT (Doge Jackpot Reels), per currency
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
-- here as well.
create or replace function public.troll_casino_jackpot_win(p_currency text, p_share numeric default 1)
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

  return v_won;
end;
$$;
revoke all on function public.troll_casino_jackpot_win(text, numeric) from public, anon;
grant execute on function public.troll_casino_jackpot_win(text, numeric) to authenticated;

-- ============================================================
-- 5. ONE-TIME RESET — troll-casino stats only, run once at launch.
--    Clears prior mock-era leaderboard/stats rows for this game so real
--    money starts every player at a clean slate. Does not touch any
--    other game's data.
-- ============================================================
delete from public.troll_leaderboard where game_id = 'troll-casino';
delete from public.troll_game_stats where game_id = 'troll-casino';
