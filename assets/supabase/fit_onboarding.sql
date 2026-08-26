-- ============================================================================
-- TROLLRUNNER FITNESS — onboarding schema (profile, goals, questionnaire).
-- Run ONCE in the shared TrollRunner Supabase project → SQL Editor.
-- Idempotent — safe to re-run.
--
-- SECURITY MODEL
--   Unlike troll_profiles (public identity), everything here is sensitive —
--   body measurements, training history, medical history. RLS restricts
--   every table to the owning user only. There is no public read policy.
-- ============================================================================

-- ============================================================
-- 1. PROFILE (personal details + units + onboarding status)
-- ============================================================
create table if not exists public.fit_profiles (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  units                text not null default 'imperial' check (units in ('imperial', 'metric')),
  age                  integer,
  sex                  text,
  height_cm            numeric,
  weight_kg            numeric,
  body_fat_pct         numeric,
  timezone             text,
  country              text,
  occupation           text,
  experience_level     text,
  ethnicity            text,
  onboarding_completed_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.fit_profiles enable row level security;

drop policy if exists fit_profiles_owner on public.fit_profiles;
create policy fit_profiles_owner on public.fit_profiles
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.fit_profiles from anon;
grant select, insert, update on public.fit_profiles to authenticated;

-- ============================================================
-- 2. GOALS (multi-select, one row per selected goal)
-- ============================================================
create table if not exists public.fit_goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  goal_key    text not null,
  target_date date,
  created_at  timestamptz not null default now(),
  unique (user_id, goal_key)
);

alter table public.fit_goals enable row level security;

drop policy if exists fit_goals_owner on public.fit_goals;
create policy fit_goals_owner on public.fit_goals
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.fit_goals from anon;
grant select, insert, update, delete on public.fit_goals to authenticated;

-- ============================================================
-- 3. ONBOARDING QUESTIONNAIRE (JSONB sections, versioned)
-- ============================================================
create table if not exists public.fit_onboarding (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  running     jsonb not null default '{}'::jsonb,
  strength    jsonb not null default '{}'::jsonb,
  equipment   jsonb not null default '{}'::jsonb,
  lifestyle   jsonb not null default '{}'::jsonb,
  nutrition   jsonb not null default '{}'::jsonb,
  medical     jsonb not null default '{}'::jsonb,
  version     integer not null default 1,
  updated_at  timestamptz not null default now()
);

alter table public.fit_onboarding enable row level security;

drop policy if exists fit_onboarding_owner on public.fit_onboarding;
create policy fit_onboarding_owner on public.fit_onboarding
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.fit_onboarding from anon;
grant select, insert, update on public.fit_onboarding to authenticated;

-- ============================================================
-- 4. updated_at maintenance
-- ============================================================
create or replace function public.fit_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fit_profiles_touch on public.fit_profiles;
create trigger fit_profiles_touch
  before update on public.fit_profiles
  for each row execute function public.fit_touch_updated_at();

drop trigger if exists fit_onboarding_touch on public.fit_onboarding;
create trigger fit_onboarding_touch
  before update on public.fit_onboarding
  for each row execute function public.fit_touch_updated_at();
