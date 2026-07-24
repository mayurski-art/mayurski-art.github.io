-- ============================================================================
-- TROLLRUNNER FRIENDS — friend requests/accepts + a status lookup RPC for
-- profile cards. Run ONCE in Supabase → SQL Editor, after troll_accounts.sql.
-- Idempotent — safe to re-run.
--
-- SECURITY MODEL
--   * Rows only exist for the two participants; RLS only lets a participant
--     read their own friendship rows.
--   * All writes go through SECURITY DEFINER RPCs — there are no direct
--     insert/update/delete grants on the table, so a client can't forge a
--     request "from" someone else or silently self-accept.
--   * Recently-played reuses the existing public.troll_game_stats table
--     (already select-able by anon/authenticated) — no new schema needed.
-- ----------------------------------------------------------------------------

-- ============================================================
-- 1. FRIENDSHIPS (canonical pair: user_a < user_b)
-- ============================================================
create table if not exists public.troll_friendships (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references auth.users (id) on delete cascade,
  user_b       uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint troll_friendships_order check (user_a < user_b),
  unique (user_a, user_b)
);

create index if not exists troll_friendships_lookup_idx
  on public.troll_friendships (user_a, user_b);

alter table public.troll_friendships enable row level security;

drop policy if exists troll_friendships_read on public.troll_friendships;
create policy troll_friendships_read on public.troll_friendships
  for select to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- No direct insert/update/delete grants — writes only via the RPCs below.
revoke all on public.troll_friendships from anon, authenticated;
grant select on public.troll_friendships to authenticated;

-- Friend list/requests joined with live profile info, so cards stay fresh
-- when someone edits their username/avatar.
create or replace view public.troll_friendships_view
with (security_invoker = on)
as
select f.id, f.user_a, f.user_b, f.requested_by, f.status, f.created_at, f.responded_at,
       pa.username as user_a_username, pa.avatar_url as user_a_avatar, pa.level as user_a_level,
       pb.username as user_b_username, pb.avatar_url as user_b_avatar, pb.level as user_b_level
  from public.troll_friendships f
  join public.troll_profiles pa on pa.id = f.user_a
  join public.troll_profiles pb on pb.id = f.user_b;

grant select on public.troll_friendships_view to authenticated;

-- ============================================================
-- 2. RPCs (the only doors into the table)
-- ============================================================

-- Send a request. If the other side already requested you, this auto-accepts
-- instead of leaving two dangling pending rows.
create or replace function public.troll_send_friend_request(p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_a   uuid;
  v_b   uuid;
  v_row troll_friendships%rowtype;
begin
  if v_uid is null then
    raise exception 'Login required.';
  end if;
  if p_target is null or p_target = v_uid then
    raise exception 'Bad target.';
  end if;
  if not exists (select 1 from troll_profiles where id = p_target) then
    raise exception 'That runner does not exist.';
  end if;

  v_a := least(v_uid, p_target);
  v_b := greatest(v_uid, p_target);

  select * into v_row from troll_friendships where user_a = v_a and user_b = v_b;

  if found then
    if v_row.status = 'accepted' then
      return jsonb_build_object('status', 'accepted');
    end if;
    if v_row.requested_by = v_uid then
      return jsonb_build_object('status', 'pending_out');
    end if;
    -- They already requested you — accept it now.
    update troll_friendships set status = 'accepted', responded_at = now()
     where id = v_row.id;
    return jsonb_build_object('status', 'accepted');
  end if;

  insert into troll_friendships (user_a, user_b, requested_by, status)
  values (v_a, v_b, v_uid, 'pending');

  return jsonb_build_object('status', 'pending_out');
end;
$$;

revoke all on function public.troll_send_friend_request(uuid) from public, anon;
grant execute on function public.troll_send_friend_request(uuid) to authenticated;

-- Accept or decline an incoming request. Declining deletes the row so either
-- side can re-request later.
create or replace function public.troll_respond_friend_request(p_requester uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_a   uuid;
  v_b   uuid;
begin
  if v_uid is null then
    raise exception 'Login required.';
  end if;

  v_a := least(v_uid, p_requester);
  v_b := greatest(v_uid, p_requester);

  if p_accept then
    update troll_friendships
       set status = 'accepted', responded_at = now()
     where user_a = v_a and user_b = v_b
       and status = 'pending' and requested_by = p_requester;
    if not found then
      raise exception 'No pending request from that runner.';
    end if;
    return jsonb_build_object('status', 'accepted');
  else
    delete from troll_friendships
     where user_a = v_a and user_b = v_b
       and status = 'pending' and requested_by = p_requester;
    return jsonb_build_object('status', 'none');
  end if;
end;
$$;

revoke all on function public.troll_respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.troll_respond_friend_request(uuid, boolean) to authenticated;

-- Unfriend (either side) or cancel an outgoing request.
create or replace function public.troll_remove_friend(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Login required.';
  end if;

  delete from troll_friendships
   where user_a = least(v_uid, p_other) and user_b = greatest(v_uid, p_other)
     and (v_uid = user_a or v_uid = user_b);

  return jsonb_build_object('status', 'none');
end;
$$;

revoke all on function public.troll_remove_friend(uuid) from public, anon;
grant execute on function public.troll_remove_friend(uuid) to authenticated;

-- One-shot status check for profile cards: none / pending_out / pending_in / accepted / self.
create or replace function public.troll_friend_status(p_other uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then 'none'
    when p_other = auth.uid() then 'self'
    else coalesce((
      select case
        when f.status = 'accepted' then 'accepted'
        when f.status = 'pending' and f.requested_by = auth.uid() then 'pending_out'
        else 'pending_in'
      end
      from troll_friendships f
      where f.user_a = least(auth.uid(), p_other) and f.user_b = greatest(auth.uid(), p_other)
    ), 'none')
  end
$$;

revoke all on function public.troll_friend_status(uuid) from public, anon;
grant execute on function public.troll_friend_status(uuid) to authenticated;

-- ============================================================
-- 3. DIRECT MESSAGES (friends only, canonical pair like friendships)
-- ============================================================
create table if not exists public.troll_dm_threads (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references auth.users (id) on delete cascade,
  user_b     uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint troll_dm_threads_order check (user_a < user_b),
  unique (user_a, user_b)
);

alter table public.troll_dm_threads enable row level security;

drop policy if exists troll_dm_threads_read on public.troll_dm_threads;
create policy troll_dm_threads_read on public.troll_dm_threads
  for select to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- No direct grants — threads are only created via troll_dm_open below.
revoke all on public.troll_dm_threads from anon, authenticated;
grant select on public.troll_dm_threads to authenticated;

create table if not exists public.troll_dm_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.troll_dm_threads (id) on delete cascade,
  sender_id  uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default now()
);

create index if not exists troll_dm_messages_thread_idx
  on public.troll_dm_messages (thread_id, created_at);

alter table public.troll_dm_messages enable row level security;

drop policy if exists troll_dm_messages_read on public.troll_dm_messages;
create policy troll_dm_messages_read on public.troll_dm_messages
  for select to authenticated
  using (exists (
    select 1 from troll_dm_threads t
     where t.id = thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid())
  ));

drop policy if exists troll_dm_messages_insert on public.troll_dm_messages;
create policy troll_dm_messages_insert on public.troll_dm_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from troll_dm_threads t
       where t.id = thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
  );

revoke all on public.troll_dm_messages from anon, authenticated;
grant select on public.troll_dm_messages to authenticated;
-- id is included: the client sets it client-side (same pattern as
-- troll_chat) so it can render its own sent message immediately.
grant insert (id, thread_id, sender_id, body) on public.troll_dm_messages to authenticated;

-- Opens (or reuses) a thread with a FRIEND. Not open to non-friends, so DMs
-- can't be used to spam a stranger who never agreed to be added.
create or replace function public.troll_dm_open(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_a   uuid;
  v_b   uuid;
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'Login required.';
  end if;
  if p_other is null or p_other = v_uid then
    raise exception 'Bad target.';
  end if;

  v_a := least(v_uid, p_other);
  v_b := greatest(v_uid, p_other);

  if not exists (
    select 1 from troll_friendships
     where user_a = v_a and user_b = v_b and status = 'accepted'
  ) then
    raise exception 'You can only message friends.';
  end if;

  insert into troll_dm_threads (user_a, user_b)
  values (v_a, v_b)
  on conflict (user_a, user_b) do nothing;

  select id into v_id from troll_dm_threads where user_a = v_a and user_b = v_b;
  return v_id;
end;
$$;

revoke all on function public.troll_dm_open(uuid) from public, anon;
grant execute on function public.troll_dm_open(uuid) to authenticated;

-- ============================================================
-- 4. LEADERBOARD BADGES (top-3 finishes, derived — no new writes)
-- ============================================================
-- Ranks each player's best score (troll_game_stats.high_score) within each
-- game. Returns only this player's rows where they place top 3 — the
-- profile card renders these as medal badges.
create or replace function public.troll_leaderboard_badges(p_user uuid)
returns table (game_id text, rank bigint, high_score numeric)
language sql
stable
security definer
set search_path = public
as $$
  select game_id, rank, high_score from (
    select game_id, high_score,
           rank() over (partition by game_id order by high_score desc) as rank,
           user_id
      from troll_game_stats
  ) ranked
  where ranked.user_id = p_user and ranked.rank <= 3;
$$;

revoke all on function public.troll_leaderboard_badges(uuid) from public, anon;
grant execute on function public.troll_leaderboard_badges(uuid) to anon, authenticated;
