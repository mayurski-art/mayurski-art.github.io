-- ============================================================================
-- TROLLRUNNER FITNESS — add effort (RPE) to activities. Run ONCE in the
-- shared Supabase project → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

alter table public.fit_activities
  add column if not exists effort smallint check (effort between 1 and 10);
