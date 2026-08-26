-- ============================================================================
-- TROLLRUNNER FITNESS — activities schema (manual logging, Phase 3).
-- Run ONCE in the shared TrollRunner Supabase project → SQL Editor.
-- Idempotent — safe to re-run.
--
-- Owner-only RLS, same model as fit_onboarding.sql. The social feed
-- (Phase 11) will read a subset of this table under a separate policy —
-- not added yet, so activities are private to their owner for now.
-- Strava-imported rows (Phase 5) reuse this table with source = 'strava'
-- and stay owner-only forever per the API compliance note in docs/DESIGN.md.
-- ============================================================================

create table if not exists public.fit_activities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  type          text not null check (type in ('run', 'strength', 'other')),
  source        text not null default 'native' check (source in ('native', 'strava')),
  title         text not null default '',
  notes         text not null default '',
  occurred_at   timestamptz not null default now(),
  distance_mi   numeric,
  duration_sec  integer,
  elevation_ft  numeric,
  splits        jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists fit_activities_user_occurred_idx
  on public.fit_activities (user_id, occurred_at desc);

alter table public.fit_activities enable row level security;

drop policy if exists fit_activities_owner on public.fit_activities;
create policy fit_activities_owner on public.fit_activities
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.fit_activities from anon;
grant select, insert, update, delete on public.fit_activities to authenticated;

-- ============================================================
-- Strength sets — child rows of a fit_activities(type='strength') row
-- ============================================================
create table if not exists public.fit_strength_sets (
  id            uuid primary key default gen_random_uuid(),
  activity_id   uuid not null references public.fit_activities (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  set_order     integer not null default 0,
  exercise      text not null,
  weight_lb     numeric,
  reps          integer,
  rpe           numeric
);

create index if not exists fit_strength_sets_activity_idx
  on public.fit_strength_sets (activity_id, set_order);

alter table public.fit_strength_sets enable row level security;

drop policy if exists fit_strength_sets_owner on public.fit_strength_sets;
create policy fit_strength_sets_owner on public.fit_strength_sets
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.fit_strength_sets from anon;
grant select, insert, update, delete on public.fit_strength_sets to authenticated;
