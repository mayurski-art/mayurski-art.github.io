-- ============================================================================
-- TROLLRUNNER FITNESS — recovery check-ins (Phase 8). Run ONCE in the
-- shared Supabase project → SQL Editor. Idempotent — safe to re-run.
-- Owner-only RLS, same model as fit_onboarding.sql.
-- ============================================================================

create table if not exists public.fit_recovery_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  log_date     date not null default current_date,
  sleep_hours  numeric,
  soreness     smallint check (soreness between 1 and 5),
  stress       smallint check (stress between 1 and 5),
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists fit_recovery_logs_user_date_idx
  on public.fit_recovery_logs (user_id, log_date desc);

alter table public.fit_recovery_logs enable row level security;

drop policy if exists fit_recovery_logs_owner on public.fit_recovery_logs;
create policy fit_recovery_logs_owner on public.fit_recovery_logs
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.fit_recovery_logs from anon;
grant select, insert, update, delete on public.fit_recovery_logs to authenticated;
