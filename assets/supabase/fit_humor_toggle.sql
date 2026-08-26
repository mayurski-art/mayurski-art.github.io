-- ============================================================================
-- TROLLRUNNER FITNESS — troll-humor toggle (Phase 12). Run ONCE in the
-- shared Supabase project → SQL Editor. Idempotent.
-- ============================================================================

alter table public.fit_profiles
  add column if not exists humor_enabled boolean not null default true;
