-- ============================================================================
-- TROLLRUNNER FITNESS — social layer (Phase 11): follows, kudos, comments,
-- and the RLS changes needed to let followers see NATIVE activities.
-- Run ONCE in the shared Supabase project → SQL Editor. Idempotent.
--
-- Strava API compliance (docs/DESIGN.md §3): only source = 'native'
-- activities are ever visible to anyone but their owner. If wearable sync
-- is ever revived, imported rows must stay excluded from every policy
-- below — never widen these to cover source = 'strava'.
-- ============================================================================

-- ============================================================
-- 1. FOLLOWS
-- ============================================================
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

-- ============================================================
-- 2. SOCIAL VISIBILITY into fit_activities / fit_strength_sets —
--    adds a SELECT policy (permissive, OR'd with the existing owner
--    policy) so a follower can see a NATIVE activity, on top of the
--    owner-only access every table already has.
-- ============================================================
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

-- ============================================================
-- 3. KUDOS
-- ============================================================
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

-- ============================================================
-- 4. COMMENTS
-- ============================================================
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
