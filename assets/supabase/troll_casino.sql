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

-- ------------------------------------------------------------
-- Real on-chain verification. Everything above the deposits table used to
-- trust p_amount_usd/p_token_amount as reported by the client — any
-- authenticated session could call troll_casino_confirm_deposit directly
-- (devtools/curl), skip TrollPay entirely, hand it a made-up signature and
-- an arbitrary amount, and get instantly credited. This looks p_tx_sig up on
-- Solana mainnet itself (server-side, via the `http` extension — the CORS
-- restriction that pushes the browser client to a different RPC endpoint
-- doesn't apply here) and derives the credited amount from the transaction's
-- own token-balance change at the treasury wallet — never from anything the
-- caller said. It also requires p_wallet's OWN balance to have decreased in
-- that same transaction, so a second party watching the chain can't race to
-- claim someone else's real, already-broadcast deposit as their own.
create extension if not exists http with schema extensions;

create or replace function public.troll_casino_verify_treasury_deposit(
  p_tx_sig text,
  p_token  text,
  p_wallet text
)
returns numeric
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  -- Public, no-key mainnet RPC — fine for hobby-site deposit volume. If this
  -- ever needs to scale past its rate limit, swap in a dedicated provider
  -- (Helius/QuickNode/etc.) here; nothing else in this function changes.
  v_rpc_url       text := 'https://api.mainnet-beta.solana.com';
  v_treasury      text := '79vVRZ7qnZfj9xCto5d9Kwf4eAimqMDrQysZjHBbFbsA';
  v_mint          text;
  v_decimals      int := 6; -- both USDC and $TROLL are 6-decimal SPL tokens
  v_body          jsonb;
  v_resp          jsonb;
  v_result        jsonb;
  v_treasury_pre  numeric;
  v_treasury_post numeric;
  v_wallet_pre    numeric;
  v_wallet_post   numeric;
  v_delta         numeric;
begin
  if p_token not in ('USDC', 'TROLL') then raise exception 'Bad token.'; end if;
  if p_tx_sig is null or length(p_tx_sig) < 10 then raise exception 'Missing transaction signature.'; end if;
  if p_wallet is null or length(trim(p_wallet)) < 20 then
    raise exception 'A connected wallet address is required to verify a deposit.';
  end if;
  v_mint := case p_token
    when 'USDC' then 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    else '5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2'
  end;

  v_body := jsonb_build_object(
    'jsonrpc', '2.0', 'id', 1, 'method', 'getTransaction',
    'params', jsonb_build_array(
      p_tx_sig,
      jsonb_build_object('encoding', 'jsonParsed', 'commitment', 'confirmed', 'maxSupportedTransactionVersion', 0)
    )
  );

  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '15000');
    select (extensions.http_post(v_rpc_url, v_body::text, 'application/json')).content::jsonb into v_resp;
  exception when others then
    raise exception 'Could not reach Solana to verify this payment — try again in a moment.';
  end;

  if v_resp ? 'error' then
    raise exception 'Solana RPC error while verifying payment: %', v_resp -> 'error' ->> 'message';
  end if;

  v_result := v_resp -> 'result';
  if v_result is null or v_result = 'null'::jsonb then
    raise exception 'Transaction not found on-chain yet — wait a few seconds and try again.';
  end if;
  if (v_result -> 'meta' ->> 'err') is not null then
    raise exception 'That transaction failed on-chain — nothing was actually paid.';
  end if;

  select coalesce(sum((e -> 'uiTokenAmount' ->> 'amount')::numeric), 0) into v_treasury_pre
    from jsonb_array_elements(coalesce(v_result -> 'meta' -> 'preTokenBalances', '[]'::jsonb)) e
   where e ->> 'owner' = v_treasury and e ->> 'mint' = v_mint;
  select coalesce(sum((e -> 'uiTokenAmount' ->> 'amount')::numeric), 0) into v_treasury_post
    from jsonb_array_elements(coalesce(v_result -> 'meta' -> 'postTokenBalances', '[]'::jsonb)) e
   where e ->> 'owner' = v_treasury and e ->> 'mint' = v_mint;
  select coalesce(sum((e -> 'uiTokenAmount' ->> 'amount')::numeric), 0) into v_wallet_pre
    from jsonb_array_elements(coalesce(v_result -> 'meta' -> 'preTokenBalances', '[]'::jsonb)) e
   where e ->> 'owner' = p_wallet and e ->> 'mint' = v_mint;
  select coalesce(sum((e -> 'uiTokenAmount' ->> 'amount')::numeric), 0) into v_wallet_post
    from jsonb_array_elements(coalesce(v_result -> 'meta' -> 'postTokenBalances', '[]'::jsonb)) e
   where e ->> 'owner' = p_wallet and e ->> 'mint' = v_mint;

  if v_treasury_post <= v_treasury_pre then
    raise exception 'That transaction did not pay % to the treasury wallet.', p_token;
  end if;
  if v_wallet_pre <= v_wallet_post then
    raise exception 'That transaction was not paid from your connected wallet.';
  end if;

  v_delta := (v_treasury_post - v_treasury_pre) / power(10, v_decimals);
  return v_delta;
end;
$$;
revoke all on function public.troll_casino_verify_treasury_deposit(text, text, text) from public, anon;
grant execute on function public.troll_casino_verify_treasury_deposit(text, text, text) to authenticated;

-- The ONE door tokens come in through. tx_sig is unique, so replaying the
-- same signature twice (e.g. a retried client call) can't double-credit —
-- and now the credited amount itself comes only from the verified on-chain
-- transfer above, never from p_amount_usd/p_token_amount (kept only as the
-- client's self-reported figures for the deposits log/display).
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
  v_verified_amount numeric;
begin
  if v_uid is null then raise exception 'Login required.'; end if;
  if p_token not in ('USDC', 'TROLL') then raise exception 'Bad token.'; end if;
  if p_amount_usd is null or p_amount_usd <= 0 then raise exception 'Bad amount.'; end if;
  if p_token_amount is null or p_token_amount <= 0 then raise exception 'Bad token amount.'; end if;
  if p_tx_sig is null or length(p_tx_sig) < 10 then raise exception 'Missing transaction signature.'; end if;

  v_verified_amount := troll_casino_verify_treasury_deposit(p_tx_sig, p_token, p_wallet);

  insert into troll_casino_deposits (user_id, token, amount_usd, token_amount, tx_sig, wallet)
  values (v_uid, p_token, p_amount_usd, v_verified_amount, p_tx_sig, p_wallet);
  -- unique violation on tx_sig raises and aborts the whole function —
  -- the same signature can never credit twice.

  v_new := troll_casino_adjust_balance(v_verified_amount, p_token, 'deposit');
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

-- Reconciliation guard: the same paid tx signature should never back two
-- different redemption rows.
create unique index if not exists troll_casino_redemptions_paid_tx_uidx
  on public.troll_casino_redemptions (paid_tx) where paid_tx is not null;

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
  if p_tx is null or length(trim(p_tx)) < 10 then
    raise exception 'A payout tx signature (10+ characters) is required to mark a request paid.';
  end if;
  update troll_casino_redemptions
     set status = 'paid', paid_tx = p_tx, admin_note = coalesce(p_note, admin_note), updated_at = now()
   where id = p_id and status = 'pending';
  if not found then
    raise exception 'Request not pending (already paid/rejected, or does not exist).';
  end if;
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
  v_max_balance numeric;
  v_new numeric;
begin
  if not exists (select 1 from troll_profiles where id = auth.uid() and is_admin) then
    raise exception 'Admin only.';
  end if;
  select * into v_row from troll_casino_redemptions where id = p_id and status = 'pending';
  if not found then raise exception 'Request not pending.'; end if;

  update troll_casino_redemptions
     set status = 'rejected', admin_note = coalesce(p_note, admin_note), updated_at = now()
   where id = p_id;

  -- Refund the ORIGINAL requester (v_row.user_id) — NOT whoever is calling this
  -- function. troll_casino_adjust_balance always credits auth.uid() (the caller's
  -- own session), which here would be the ADMIN reviewing the request, silently
  -- crediting the admin's wallet instead of refunding the rejected player. This
  -- does the refund directly against v_row.user_id's wallet row instead, mirroring
  -- adjust_balance's floor-at-0/balance-cap/audit-log behavior but targeted at the
  -- right account.
  v_max_balance := case when v_row.token = 'TROLL' then 10000000 else 50000 end;

  insert into troll_casino_wallet (user_id) values (v_row.user_id)
  on conflict (user_id) do nothing;

  if v_row.token = 'TROLL' then
    update troll_casino_wallet
       set troll_balance = least(v_max_balance, greatest(0, troll_balance + v_row.token_amount)), updated_at = now()
     where user_id = v_row.user_id
     returning troll_balance into v_new;
  else
    update troll_casino_wallet
       set usdc_balance = least(v_max_balance, greatest(0, usdc_balance + v_row.token_amount)), updated_at = now()
     where user_id = v_row.user_id
     returning usdc_balance into v_new;
  end if;

  insert into troll_casino_adjustments (user_id, delta, currency, reason, balance_after)
  values (v_row.user_id, v_row.token_amount, v_row.token, 'redemption-rejected-refund', v_new);
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
-- No longer called directly by any client — troll_casino_slots_spin (below)
-- is the only caller now, and it does so as this function's SECURITY DEFINER
-- owner, which needs no grant. Direct client access is revoked because the
-- old client-supplied p_delta had no bounds check at all: any authenticated
-- session could call this straight from devtools with an arbitrary p_delta
-- and inflate the shared jackpot display to anything.
revoke all on function public.troll_casino_jackpot_contribute(text, numeric) from public, anon, authenticated;

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
-- No longer called directly by any client — troll_casino_slots_spin (below)
-- is the only caller now. Direct client access is revoked because the old
-- client-supplied p_share/p_tier had no relationship to any real spin at
-- all: any authenticated session could call this straight from devtools
-- with p_share=1, p_tier='GRAND' and drain the entire shared jackpot pot
-- without a single gold symbol ever landing.
revoke all on function public.troll_casino_jackpot_win(text, numeric, text) from public, anon, authenticated;

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
-- 6. SERVER-AUTHORITATIVE TROLL WHEEL
--    Was: game.js picked the landing segment itself with a local crypto RNG,
--    then called wallet debit()/credit() directly — a client console call to
--    TrollCasinoWallet.credit() (or a spoofed win) could mint balance with no
--    spin ever happening. This moves stake-debit + segment pick + payout-
--    credit into one atomic call. v_segments/v_pays/v_bettable below mirror
--    game.js's SEGMENTS/ZONES exactly — if that paytable ever changes, mirror
--    the change here too (same "kept duplicated on purpose" convention the
--    client RNG helpers already use across wheel/blackjack/slots/crash).
-- ============================================================
create or replace function public.troll_casino_wheel_spin(
  p_bets     jsonb,
  p_currency text
)
returns table(
  segment_index int,
  zone_id       text,
  total_staked  numeric,
  payout        numeric,
  won           boolean,
  new_balance   numeric
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid      uuid := auth.uid();
  v_segments text[] := array[
    'troll','double','troll','double','troll','triple','troll','double',
    'triple','double','troll','triple','troll','double','troll','whale',
    'troll','double','troll','triple','troll','double','troll','rug'
  ];
  v_pays     jsonb := '{"troll":2,"double":3,"triple":5,"whale":20,"rug":0}'::jsonb;
  v_bettable jsonb := '{"troll":true,"double":true,"triple":true,"whale":true,"rug":false}'::jsonb;
  v_key      text;
  v_amount   numeric;
  v_total    numeric := 0;
  v_rand     bytea;
  v_raw      bigint;
  v_idx      int;
  v_zone     text;
  v_pays_n   numeric;
  v_payout   numeric := 0;
  v_won      boolean;
  v_new      numeric;
begin
  if v_uid is null then raise exception 'Login required.'; end if;
  if p_currency not in ('TROLL', 'USDC') then raise exception 'Bad currency.'; end if;
  if p_bets is null or jsonb_typeof(p_bets) <> 'object' or p_bets = '{}'::jsonb then
    raise exception 'Place a bet first.';
  end if;

  for v_key, v_amount in select key, value::numeric from jsonb_each_text(p_bets) loop
    if not (v_bettable ? v_key) or not (v_bettable ->> v_key)::boolean then
      raise exception 'Bad bet zone: %', v_key;
    end if;
    if v_amount is null or v_amount <= 0 then
      raise exception 'Bad bet amount for %.', v_key;
    end if;
    v_total := v_total + v_amount;
  end loop;
  if v_total <= 0 then raise exception 'Place a bet first.'; end if;

  -- Debit the stake atomically — this already enforces the balance floor,
  -- per-call delta cap, daily loss cap, and self-exclusion window every
  -- other balance change in this file goes through.
  perform troll_casino_adjust_balance(-v_total, p_currency, 'wheel-stake');

  -- Secure, uniform pick over 24 segments. Rejection sampling: 2^32 doesn't
  -- divide evenly by 24, so a plain modulo would very slightly favor the
  -- first 16 segments — this keeps every segment exactly 1/24.
  loop
    v_rand := gen_random_bytes(4);
    v_raw := (get_byte(v_rand, 0)::bigint << 24) | (get_byte(v_rand, 1)::bigint << 16)
           | (get_byte(v_rand, 2)::bigint << 8)  |  get_byte(v_rand, 3)::bigint;
    exit when v_raw < (4294967296::bigint / 24) * 24;
  end loop;
  v_idx := (v_raw % 24)::int;

  v_zone := v_segments[v_idx + 1]; -- Postgres arrays are 1-indexed
  v_pays_n := (v_pays ->> v_zone)::numeric;
  if (v_bettable ->> v_zone)::boolean then
    v_payout := coalesce((p_bets ->> v_zone)::numeric, 0) * v_pays_n;
  else
    v_payout := 0;
  end if;
  v_won := v_payout > 0;

  if v_payout > 0 then
    v_new := troll_casino_adjust_balance(v_payout, p_currency, 'wheel-win');
  else
    select case when p_currency = 'TROLL' then troll_balance else usdc_balance end into v_new
      from troll_casino_wallet where user_id = v_uid;
  end if;

  return query select v_idx, v_zone, v_total, v_payout, v_won, v_new;
end;
$$;
revoke all on function public.troll_casino_wheel_spin(jsonb, text) from public, anon;
grant execute on function public.troll_casino_wheel_spin(jsonb, text) to authenticated;

-- ============================================================
-- 7. SERVER-AUTHORITATIVE DOGE JACKPOT REELS (slots)
--    Was: slots.js drew its own grid, evaluated its own paylines, and called
--    wallet debit()/credit() directly — and separately called
--    troll_casino_jackpot_contribute/_win with client-chosen amounts, so a
--    devtools call could inflate the shared jackpot display arbitrarily or
--    drain the entire real jackpot pot with p_share=1 and no gold symbols
--    ever landing. This does the whole spin — bet debit, 5×3 grid draw,
--    10-payline evaluation, scatter/jackpot detection, jackpot draw, and win
--    credit — atomically server-side. v_symbols/v_paylines/v_scatter_pays/
--    v_jackpot_tiers mirror slots.js's SL_SYMBOLS/PAYLINES/SCATTER_PAYS/
--    JACKPOT_TIERS exactly — if that paytable ever changes, mirror the
--    change here too.
-- ============================================================
create or replace function public.troll_casino_secure_rand01()
returns double precision
language sql
security definer
set search_path = public, extensions
as $$
  select (
    (get_byte(b, 0)::bigint << 24) | (get_byte(b, 1)::bigint << 16)
    | (get_byte(b, 2)::bigint << 8) | get_byte(b, 3)::bigint
  )::double precision / 4294967296.0
  from (select gen_random_bytes(4) as b) s;
$$;
-- Internal helper only (used by troll_casino_wheel_spin's sibling functions
-- and troll_casino_slots_spin below) — no client ever needs to call this.
revoke all on function public.troll_casino_secure_rand01() from public, anon, authenticated;

create or replace function public.troll_casino_slots_draw_symbol(p_symbols jsonb)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_total numeric;
  v_roll  numeric;
  e       jsonb;
begin
  select sum((s ->> 'weight')::numeric) into v_total from jsonb_array_elements(p_symbols) s;
  v_roll := troll_casino_secure_rand01() * v_total;
  for e in select * from jsonb_array_elements(p_symbols) loop
    v_roll := v_roll - (e ->> 'weight')::numeric;
    if v_roll < 0 then return e ->> 'id'; end if;
  end loop;
  return p_symbols -> 0 ->> 'id';
end;
$$;
revoke all on function public.troll_casino_slots_draw_symbol(jsonb) from public, anon, authenticated;

create or replace function public.troll_casino_slots_spin(
  p_bet      numeric,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_symbols jsonb := '[
    {"id":"candle","weight":24,"pays":{"3":10,"4":25,"5":75}},
    {"id":"usdc","weight":22,"pays":{"3":15,"4":40,"5":125}},
    {"id":"troll","weight":20,"pays":{"3":20,"4":50,"5":175}},
    {"id":"rug","weight":18,"pays":{}},
    {"id":"pepe","weight":14,"pays":{"3":25,"4":75,"5":250}},
    {"id":"diamond","weight":10,"pays":{"3":35,"4":100,"5":350}},
    {"id":"whale","weight":6,"pays":{"3":50,"4":175,"5":700}},
    {"id":"rocket","weight":6,"pays":{},"scatter":true},
    {"id":"wild","weight":4,"pays":{"3":75,"4":250,"5":1000},"wild":true},
    {"id":"gold","weight":2,"pays":{},"jackpot":true}
  ]'::jsonb;
  v_paylines int[] := array[
    1,1,1,1,1,  0,0,0,0,0,  2,2,2,2,2,  0,1,2,1,0,  2,1,0,1,2,
    0,0,1,2,2,  2,2,1,0,0,  1,0,0,0,1,  1,2,2,2,1,  0,1,1,1,2
  ];
  v_scatter_pays  jsonb := '{"3":2,"4":10,"5":50}'::jsonb;
  v_jackpot_tiers jsonb := '{"3":["MINOR",0.25],"4":["MAJOR",0.6],"5":["GRAND",1]}'::jsonb;

  v_grid          jsonb := '[]'::jsonb;
  v_reel          jsonb;
  r               int;
  v_row           int;
  li              int;
  v_line_bet      numeric;
  v_line_wins     jsonb := '[]'::jsonb;
  v_pay_sym       text;
  v_count         int;
  v_cells         jsonb;
  v_sym_id        text;
  v_sym_def       jsonb;
  v_pay           numeric;
  v_broke         boolean;
  v_scatters      int := 0;
  v_golds         int := 0;
  v_scatter_cells jsonb := '[]'::jsonb;
  v_gold_cells    jsonb := '[]'::jsonb;
  v_scatter_win   numeric := 0;
  v_jackpot_tier  jsonb;
  v_line_total    numeric := 0;
  v_jackpot_won   numeric := 0;
  v_new_balance   numeric;
begin
  if v_uid is null then raise exception 'Login required.'; end if;
  if p_currency not in ('TROLL', 'USDC') then raise exception 'Bad currency.'; end if;
  if p_bet is null or p_bet <= 0 then raise exception 'Bad bet.'; end if;

  -- Debit up front — enforces balance floor / per-call delta cap / daily
  -- loss cap / self-exclusion, same as every other game in this file.
  perform troll_casino_adjust_balance(-p_bet, p_currency, 'slots-bet');

  -- 5x3 grid, reel-major and 0-indexed (grid[reel][row] — same shape
  -- slots.js's spinGrid()/evalSpin() already expect).
  for r in 0..4 loop
    v_reel := '[]'::jsonb;
    for v_row in 0..2 loop
      v_reel := v_reel || to_jsonb(troll_casino_slots_draw_symbol(v_symbols));
    end loop;
    v_grid := v_grid || jsonb_build_array(v_reel);
  end loop;

  v_line_bet := p_bet / 10.0;

  -- 10 paylines. For each: walk reels 0..4, wild substitutes for anything
  -- but scatter/jackpot, the paying symbol is the first non-wild hit, break
  -- on scatter/jackpot or a mismatch. Mirrors slots.js's evalSpin() exactly,
  -- including looking up pays[count] unconditionally after the walk (counts
  -- below 3 simply have no entry in a symbol's pays object, so nothing is
  -- added — no special-casing needed for an early break).
  for li in 0..9 loop
    v_pay_sym := null;
    v_count := 0;
    v_cells := '[]'::jsonb;
    v_broke := false;
    for r in 0..4 loop
      v_row := v_paylines[li * 5 + r + 1];
      v_sym_id := v_grid -> r ->> v_row;
      select s into v_sym_def from jsonb_array_elements(v_symbols) s where s ->> 'id' = v_sym_id limit 1;

      if coalesce((v_sym_def ->> 'scatter')::boolean, false) or coalesce((v_sym_def ->> 'jackpot')::boolean, false) then
        v_broke := true;
      elsif coalesce((v_sym_def ->> 'wild')::boolean, false) then
        v_count := v_count + 1;
        v_cells := v_cells || jsonb_build_array(jsonb_build_array(r, v_row));
      elsif v_pay_sym is null then
        v_pay_sym := v_sym_id;
        v_count := v_count + 1;
        v_cells := v_cells || jsonb_build_array(jsonb_build_array(r, v_row));
      elsif v_sym_id = v_pay_sym then
        v_count := v_count + 1;
        v_cells := v_cells || jsonb_build_array(jsonb_build_array(r, v_row));
      else
        v_broke := true;
      end if;
      exit when v_broke;
    end loop;

    select s into v_sym_def from jsonb_array_elements(v_symbols) s where s ->> 'id' = coalesce(v_pay_sym, 'wild') limit 1;
    v_pay := (v_sym_def -> 'pays' ->> v_count::text)::numeric;
    if v_pay is not null and v_pay > 0 then
      v_pay := round(v_pay * v_line_bet, 2);
      v_line_total := v_line_total + v_pay;
      v_line_wins := v_line_wins || jsonb_build_object(
        'line', li, 'symbol', coalesce(v_pay_sym, 'wild'), 'count', v_count,
        'win', v_pay, 'cells', v_cells
      );
    end if;
  end loop;

  -- Scatter (🚀, pays anywhere on total bet) and gold (🐕, feeds the shared
  -- jackpot) are counted across the WHOLE grid, not per payline.
  for r in 0..4 loop
    for v_row in 0..2 loop
      v_sym_id := v_grid -> r ->> v_row;
      select s into v_sym_def from jsonb_array_elements(v_symbols) s where s ->> 'id' = v_sym_id limit 1;
      if coalesce((v_sym_def ->> 'scatter')::boolean, false) then
        v_scatters := v_scatters + 1;
        v_scatter_cells := v_scatter_cells || jsonb_build_array(jsonb_build_array(r, v_row));
      end if;
      if coalesce((v_sym_def ->> 'jackpot')::boolean, false) then
        v_golds := v_golds + 1;
        v_gold_cells := v_gold_cells || jsonb_build_array(jsonb_build_array(r, v_row));
      end if;
    end loop;
  end loop;

  v_scatter_win := coalesce((v_scatter_pays ->> least(v_scatters, 5)::text)::numeric, 0);
  if v_scatter_win > 0 then v_scatter_win := round(v_scatter_win * p_bet, 2); end if;
  v_jackpot_tier := v_jackpot_tiers -> least(v_golds, 5)::text; -- null unless 3/4/5

  -- Feed the shared pot — a fixed 1.5% of this bet, same formula slots.js
  -- used to call client-side. No longer client-triggered at all.
  perform troll_casino_jackpot_contribute(p_currency, round(p_bet * 0.015, 2));

  if v_line_total + v_scatter_win > 0 then
    perform troll_casino_adjust_balance(v_line_total + v_scatter_win, p_currency, 'slots-win');
  end if;

  -- Jackpot draw only ever runs because THIS spin's own grid actually hit
  -- 3+ gold symbols — the old direct-RPC path that trusted a client-chosen
  -- tier/share is gone (see the revoke above troll_casino_jackpot_win).
  if v_jackpot_tier is not null then
    v_jackpot_won := troll_casino_jackpot_win(p_currency, (v_jackpot_tier ->> 1)::numeric, v_jackpot_tier ->> 0);
    if v_jackpot_won > 0 then
      perform troll_casino_adjust_balance(v_jackpot_won, p_currency, 'slots-jackpot');
    end if;
  end if;

  select case when p_currency = 'TROLL' then troll_balance else usdc_balance end into v_new_balance
    from troll_casino_wallet where user_id = v_uid;

  return jsonb_build_object(
    'grid', v_grid,
    'lineWins', v_line_wins,
    'scatters', v_scatters, 'scatterWin', v_scatter_win, 'scatterCells', v_scatter_cells,
    'golds', v_golds, 'goldCells', v_gold_cells, 'jackpotTier', v_jackpot_tier,
    'jackpotWon', v_jackpot_won,
    'nearMiss', (v_scatters = 2 or v_golds = 2),
    'total', round(v_line_total + v_scatter_win, 2),
    'newBalance', v_new_balance
  );
end;
$$;
revoke all on function public.troll_casino_slots_spin(numeric, text) from public, anon;
grant execute on function public.troll_casino_slots_spin(numeric, text) to authenticated;

-- ============================================================
-- NOTE — the original one-time launch reset (clearing pre-launch mock-era
-- troll-casino leaderboard/stats rows) has been removed from this file after
-- running once. Do not re-add a DELETE here — this file is now safe to
-- re-run in full, and a reset statement would defeat that.
-- ============================================================
