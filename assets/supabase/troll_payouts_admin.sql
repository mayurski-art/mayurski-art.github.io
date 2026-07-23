-- ============================================================================
-- TROLLRUNNER ADMIN — unified payout requests view (admin.html)
-- Run ONCE in Supabase → SQL Editor. Idempotent — safe to re-run.
-- Requires assets/supabase/troll_admin_lockdown.sql (troll_is_admin()) and
-- assets/supabase/troll_casino.sql (troll_casino_redemptions) to already exist.
--
-- PROBLEM THIS FIXES
--   Payout requests were scattered across two places with no single admin
--   view: `payout_requests` (generic per-game wager claims, e.g. Troll Kombat)
--   had INSERT-only RLS — nobody but a service-role/table-editor session
--   could even read it. `troll_casino_redemptions` could only be read/managed
--   by an account with troll_profiles.is_admin — a *different* admin identity
--   than the real troll_admins/troll_is_admin() account admin.html already
--   authenticates as.
--
-- THE FIX
--   1. `payout_requests` gets the same admin_note/paid_tx/updated_at bookkeeping
--      columns troll_casino_redemptions already has, a status check
--      constraint, and a troll_is_admin()-gated SELECT policy so admin.html
--      can read it directly.
--   2. A SECURITY DEFINER RPC (troll_admin_update_payout_request) lets the
--      admin mark a request paid/rejected/back-to-pending, gated the same way
--      every other admin.html write already is.
--   3. `troll_casino_redemptions` gets an ADDITIONAL read-only SELECT policy
--      for troll_is_admin() — purely additive, does not touch the existing
--      troll_profiles.is_admin policy or the troll_casino_admin_* RPCs. This
--      is deliberately read-only here: taking action on a casino redemption
--      (Pay via Phantom / mark paid / reject) still happens in the Troll
--      Casino admin panel (troll-casino.html?admin=1), which already has that
--      flow wired up against the correct player-balance refund logic. Admin.html
--      just links out to it.
-- ============================================================================

-- ============================================================
-- 1. payout_requests — bookkeeping columns + status constraint
-- ============================================================
alter table public.payout_requests
  add column if not exists admin_note text,
  add column if not exists paid_tx    text,
  add column if not exists updated_at timestamptz not null default now();

update public.payout_requests set status = 'pending' where status is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payout_requests_status_check'
  ) then
    alter table public.payout_requests
      add constraint payout_requests_status_check
      check (status in ('pending', 'paid', 'rejected'));
  end if;
end $$;

create index if not exists payout_requests_game_status_idx
  on public.payout_requests (game, status, created_at desc);

-- Admin-only read. The existing "anon insert payout requests" policy is
-- untouched — players can still file a claim, they just still can't read any.
drop policy if exists payout_requests_admin_read on public.payout_requests;
create policy payout_requests_admin_read on public.payout_requests
  for select to authenticated
  using (troll_is_admin());

revoke update on public.payout_requests from anon, authenticated;

-- Admin-only: move a request pending → paid/rejected (or back to pending to
-- undo a mis-click). All writes go through this one RPC rather than a raw
-- PATCH, so there's one audited path and one place validating the status value.
--
-- p_expected_status is a compare-and-swap guard: the caller must pass the
-- status it last saw for this row. Two admin tabs/sessions acting on the same
-- stale card (e.g. one rejects, the other's page still shows "pending" and
-- clicks "Mark paid") would otherwise silently overwrite each other with no
-- signal; `select ... for update` + the equality check below makes the
-- second writer fail loudly instead. Marking a request "paid" also now
-- requires a real paid_tx (min 10 chars) — a payout can no longer be
-- recorded as paid with no on-chain proof to point to if it's ever disputed.
drop function if exists public.troll_admin_update_payout_request(uuid, text, text, text);

create or replace function public.troll_admin_update_payout_request(
  p_id              uuid,
  p_status          text,
  p_expected_status text,
  p_note            text default null,
  p_paid_tx         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
begin
  if not troll_is_admin() then
    raise exception 'Admin session required.';
  end if;
  if p_status not in ('pending', 'paid', 'rejected') then
    raise exception 'Bad status.';
  end if;
  if p_status = 'paid' and (p_paid_tx is null or length(trim(p_paid_tx)) < 10) then
    raise exception 'A payout tx signature (10+ characters) is required to mark a request paid.';
  end if;

  select status into v_current from public.payout_requests where id = p_id for update;
  if not found then
    raise exception 'Request not found.';
  end if;
  if v_current is distinct from p_expected_status then
    raise exception 'This request changed since you loaded it (now "%") — refresh and try again.', v_current;
  end if;

  update public.payout_requests
     set status     = p_status,
         admin_note = coalesce(p_note, admin_note),
         paid_tx    = coalesce(p_paid_tx, paid_tx),
         updated_at = now()
   where id = p_id;

  return jsonb_build_object('saved', true);
end;
$$;

revoke all on function public.troll_admin_update_payout_request(uuid, text, text, text, text) from public, anon;
grant execute on function public.troll_admin_update_payout_request(uuid, text, text, text, text) to authenticated;

-- Same stale-write class as troll_casino_redemptions.paid_tx below — the same
-- tx signature should never be able to back two different payout claims.
create unique index if not exists payout_requests_paid_tx_uidx
  on public.payout_requests (paid_tx) where paid_tx is not null;

-- Realtime, so the admin dashboard updates the instant a claim is filed.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'payout_requests'
  ) then
    alter publication supabase_realtime add table public.payout_requests;
  end if;
end $$;

-- ============================================================
-- 2. troll_casino_redemptions — additive read-only policy for the
--    site-wide troll_admins identity (admin.html), alongside the existing
--    troll_profiles.is_admin policy used by the Troll Casino admin panel.
-- ============================================================
drop policy if exists troll_casino_redemptions_site_admin_read on public.troll_casino_redemptions;
create policy troll_casino_redemptions_site_admin_read on public.troll_casino_redemptions
  for select to authenticated
  using (troll_is_admin());
