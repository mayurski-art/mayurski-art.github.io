-- ============================================================================
-- TROLLRUNNER FITNESS — coach retrieval Q&A queue. Run ONCE in the shared
-- Supabase project → SQL Editor. Idempotent — safe to re-run.
--
-- fit_coach_questions: questions the local retrieval system couldn't match,
-- queued for Troll Runner to answer by hand.
-- fit_coach_learned_answers: answers Troll Runner has given, which the
-- retrieval system embeds and matches against alongside the static library.
--
-- Admin username baked in below is 'troll_runner' — that account is the
-- only one who can see/answer the queue. Update all three occurrences if
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
