-- ============================================================================
-- PFP STUDIO — bug reports (pfp.html "Report a bug")
-- Run ONCE in Supabase → SQL Editor. Idempotent — safe to re-run.
--
-- Anyone, including a guest with no account, can file a report — insert is
-- open to anon. Only the troll_runner account can read the queue, via the
-- same "check troll_profiles.username = 'troll_runner'" RLS pattern
-- fit_schema.sql §7 uses for the fitness coach queue, rather than the
-- separate troll_admins/troll_is_admin() table — troll_runner shouldn't need
-- to be separately enrolled there just to see PFP Studio bug reports.
-- ============================================================================

create table if not exists public.pfp_bug_reports (
  id          uuid primary key default gen_random_uuid(),
  message     text not null check (char_length(message) <= 500 and char_length(trim(message)) > 0),
  reporter_id uuid references auth.users(id) on delete set null,
  user_agent  text,
  build       jsonb,
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_at  timestamptz not null default now()
);

create index if not exists pfp_bug_reports_created_idx
  on public.pfp_bug_reports (created_at desc);

alter table public.pfp_bug_reports enable row level security;

-- Anyone (including guests, via the anon key) can file a report. There is no
-- read grant here — the insert-only shape matches payout_requests.
drop policy if exists pfp_bug_reports_anyone_insert on public.pfp_bug_reports;
create policy pfp_bug_reports_anyone_insert on public.pfp_bug_reports
  for insert to anon, authenticated
  with check (true);

-- Only troll_runner can read the queue.
drop policy if exists pfp_bug_reports_admin_read on public.pfp_bug_reports;
create policy pfp_bug_reports_admin_read on public.pfp_bug_reports
  for select to authenticated
  using (
    exists (
      select 1 from public.troll_profiles
      where id = auth.uid() and username = 'troll_runner'
    )
  );

-- Only troll_runner can mark a report resolved.
drop policy if exists pfp_bug_reports_admin_update on public.pfp_bug_reports;
create policy pfp_bug_reports_admin_update on public.pfp_bug_reports
  for update to authenticated
  using (
    exists (
      select 1 from public.troll_profiles
      where id = auth.uid() and username = 'troll_runner'
    )
  );

revoke all on public.pfp_bug_reports from anon;
grant insert on public.pfp_bug_reports to anon;
grant select, insert, update on public.pfp_bug_reports to authenticated;
