-- ============================================================================
-- TROLLRUNNER FITNESS — full schema for the local fitness.html port.
-- Run ONCE in the shared TrollRunner Supabase project → SQL Editor.
-- Idempotent — safe to re-run. Sections are ordered so every "alter" or
-- policy that references another fit_* table runs after that table exists.
--
-- Combines (in this order): onboarding, activities, effort, humor toggle,
-- recovery, social, coach Q&A — previously 7 separate files, now one paste.
--
-- SECURITY MODEL
--   Unlike troll_profiles (public identity), everything here is sensitive —
--   body measurements, training history, medical history. RLS restricts
--   every table to the owning user only, except where a section explicitly
--   widens it (social follower visibility, coach admin queue).
-- ============================================================================


-- ============================================================================
-- SECTION 1 — ONBOARDING (profile, goals, questionnaire)
-- ============================================================================

-- 1a. PROFILE (personal details + units + onboarding status)
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

-- 1b. GOALS (multi-select, one row per selected goal)
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

-- 1c. ONBOARDING QUESTIONNAIRE (JSONB sections, versioned)
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

-- 1d. updated_at maintenance
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


-- ============================================================================
-- SECTION 2 — ACTIVITIES (manual logging) + strength sets
-- Owner-only RLS. The social section below layers follower visibility on
-- top. Strava-imported rows (if ever revived) reuse this table with
-- source = 'strava' and stay owner-only forever per docs/DESIGN.md §3.
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

-- Strength sets — child rows of a fit_activities(type='strength') row
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


-- ============================================================================
-- SECTION 3 — EFFORT (RPE) on activities
-- ============================================================================

alter table public.fit_activities
  add column if not exists effort smallint check (effort between 1 and 10);


-- ============================================================================
-- SECTION 4 — HUMOR TOGGLE on profile
-- ============================================================================

alter table public.fit_profiles
  add column if not exists humor_enabled boolean not null default true;


-- ============================================================================
-- SECTION 5 — RECOVERY CHECK-INS
-- Owner-only RLS, same model as onboarding.
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


-- ============================================================================
-- SECTION 6 — SOCIAL LAYER: follows, kudos, comments, and the RLS
-- additions that let followers see NATIVE activities.
--
-- Strava API compliance (docs/DESIGN.md §3): only source = 'native'
-- activities are ever visible to anyone but their owner. If wearable sync
-- is ever revived, imported rows must stay excluded from every policy
-- below — never widen these to cover source = 'strava'.
-- ============================================================================

-- 6a. FOLLOWS
create table if not exists public.fit_follows (
  follower_id  uuid not null references auth.users (id) on delete cascade,
  followed_id  uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

alter table public.fit_follows enable row level security;

drop policy if exists fit_follows_read on public.fit_follows;
create policy fit_follows_read on public.fit_follows
  for select to authenticated
  using (auth.uid() = follower_id or auth.uid() = followed_id);

drop policy if exists fit_follows_write on public.fit_follows;
create policy fit_follows_write on public.fit_follows
  for insert to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists fit_follows_delete on public.fit_follows;
create policy fit_follows_delete on public.fit_follows
  for delete to authenticated
  using (auth.uid() = follower_id);

revoke all on public.fit_follows from anon;
grant select, insert, delete on public.fit_follows to authenticated;

-- 6b. SOCIAL VISIBILITY into fit_activities / fit_strength_sets — adds a
-- SELECT policy (permissive, OR'd with the existing owner policy) so a
-- follower can see a NATIVE activity, on top of owner-only access.
drop policy if exists fit_activities_social_read on public.fit_activities;
create policy fit_activities_social_read on public.fit_activities
  for select to authenticated
  using (
    source = 'native'
    and exists (
      select 1 from public.fit_follows
      where follower_id = auth.uid() and followed_id = fit_activities.user_id
    )
  );

drop policy if exists fit_strength_sets_social_read on public.fit_strength_sets;
create policy fit_strength_sets_social_read on public.fit_strength_sets
  for select to authenticated
  using (
    exists (
      select 1 from public.fit_activities a
      join public.fit_follows f on f.followed_id = a.user_id
      where a.id = fit_strength_sets.activity_id
        and a.source = 'native'
        and f.follower_id = auth.uid()
    )
  );

-- 6c. KUDOS
create table if not exists public.fit_kudos (
  activity_id  uuid not null references public.fit_activities (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (activity_id, user_id)
);

alter table public.fit_kudos enable row level security;

drop policy if exists fit_kudos_read on public.fit_kudos;
create policy fit_kudos_read on public.fit_kudos
  for select to authenticated
  using (
    exists (
      select 1 from public.fit_activities a
      where a.id = fit_kudos.activity_id
        and (
          a.user_id = auth.uid()
          or (
            a.source = 'native'
            and exists (
              select 1 from public.fit_follows f
              where f.follower_id = auth.uid() and f.followed_id = a.user_id
            )
          )
        )
    )
  );

drop policy if exists fit_kudos_write on public.fit_kudos;
create policy fit_kudos_write on public.fit_kudos
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fit_activities a
      where a.id = fit_kudos.activity_id
        and (
          a.user_id = auth.uid()
          or (
            a.source = 'native'
            and exists (
              select 1 from public.fit_follows f
              where f.follower_id = auth.uid() and f.followed_id = a.user_id
            )
          )
        )
    )
  );

drop policy if exists fit_kudos_delete on public.fit_kudos;
create policy fit_kudos_delete on public.fit_kudos
  for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.fit_kudos from anon;
grant select, insert, delete on public.fit_kudos to authenticated;

-- 6d. COMMENTS
create table if not exists public.fit_comments (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.fit_activities (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 500),
  created_at   timestamptz not null default now()
);

create index if not exists fit_comments_activity_idx
  on public.fit_comments (activity_id, created_at);

alter table public.fit_comments enable row level security;

drop policy if exists fit_comments_read on public.fit_comments;
create policy fit_comments_read on public.fit_comments
  for select to authenticated
  using (
    exists (
      select 1 from public.fit_activities a
      where a.id = fit_comments.activity_id
        and (
          a.user_id = auth.uid()
          or (
            a.source = 'native'
            and exists (
              select 1 from public.fit_follows f
              where f.follower_id = auth.uid() and f.followed_id = a.user_id
            )
          )
        )
    )
  );

drop policy if exists fit_comments_write on public.fit_comments;
create policy fit_comments_write on public.fit_comments
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fit_activities a
      where a.id = fit_comments.activity_id
        and (
          a.user_id = auth.uid()
          or (
            a.source = 'native'
            and exists (
              select 1 from public.fit_follows f
              where f.follower_id = auth.uid() and f.followed_id = a.user_id
            )
          )
        )
    )
  );

drop policy if exists fit_comments_delete on public.fit_comments;
create policy fit_comments_delete on public.fit_comments
  for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.fit_comments from anon;
grant select, insert, delete on public.fit_comments to authenticated;


-- ============================================================================
-- SECTION 7 — COACH RETRIEVAL Q&A QUEUE
--
-- fit_coach_questions: questions the local retrieval system couldn't match,
-- queued for Troll Runner to answer by hand.
-- fit_coach_learned_answers: answers Troll Runner has given, which the
-- retrieval system embeds and matches against alongside the static library.
--
-- Admin username baked in below is 'troll_runner' — that account is the
-- only one who can see/answer the queue. Update all occurrences below if
-- the account username ever changes.
-- ============================================================================

create table if not exists public.fit_coach_questions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  question     text not null,
  status       text not null default 'pending' check (status in ('pending', 'answered', 'dismissed')),
  answer       text,
  answered_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists fit_coach_questions_status_idx
  on public.fit_coach_questions (status, created_at desc);

create table if not exists public.fit_coach_learned_answers (
  id           uuid primary key default gen_random_uuid(),
  question     text not null,
  answer       text not null,
  source_id    uuid references public.fit_coach_questions (id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.fit_coach_questions enable row level security;
alter table public.fit_coach_learned_answers enable row level security;

-- Any signed-in user can queue their own question.
drop policy if exists fit_coach_questions_insert_own on public.fit_coach_questions;
create policy fit_coach_questions_insert_own on public.fit_coach_questions
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Users can see their own questions; Troll Runner (admin) can see every
-- pending question from every user.
drop policy if exists fit_coach_questions_select on public.fit_coach_questions;
create policy fit_coach_questions_select on public.fit_coach_questions
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.troll_profiles
      where id = auth.uid() and username = 'troll_runner'
    )
  );

-- Only Troll Runner (admin) can answer/dismiss a queued question.
drop policy if exists fit_coach_questions_admin_update on public.fit_coach_questions;
create policy fit_coach_questions_admin_update on public.fit_coach_questions
  for update to authenticated
  using (
    exists (
      select 1 from public.troll_profiles
      where id = auth.uid() and username = 'troll_runner'
    )
  );

-- The learned-answers library is read by every user's coach chat (to match
-- against), but only Troll Runner (admin) can add to it.
drop policy if exists fit_coach_learned_answers_select on public.fit_coach_learned_answers;
create policy fit_coach_learned_answers_select on public.fit_coach_learned_answers
  for select to authenticated
  using (true);

drop policy if exists fit_coach_learned_answers_admin_insert on public.fit_coach_learned_answers;
create policy fit_coach_learned_answers_admin_insert on public.fit_coach_learned_answers
  for insert to authenticated
  with check (
    exists (
      select 1 from public.troll_profiles
      where id = auth.uid() and username = 'troll_runner'
    )
  );

revoke all on public.fit_coach_questions from anon;
revoke all on public.fit_coach_learned_answers from anon;
grant select, insert, update on public.fit_coach_questions to authenticated;
grant select, insert on public.fit_coach_learned_answers to authenticated;
