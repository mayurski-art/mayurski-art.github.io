-- ============================================================================
-- TROLLCHAT GROUPS — private group rooms on top of the global room
-- (run ONCE in Supabase → SQL Editor, after troll_accounts.sql + troll_chat.sql)
-- ============================================================================
-- Adds:
--   troll_chat_groups         one row per group (name, join code, owner)
--   troll_chat_group_members  who's in which group
--   troll_chat_group_invites  pending "invite by username" requests
--   troll_profiles.auto_join_groups  per-user default: invited straight in,
--                                     or land in the pending-invites list
--   troll_chat.group_id       nullable — null = the existing global room
--
-- All writes to groups/members/invites go through SECURITY DEFINER RPCs
-- below (troll_chat_create_group, troll_chat_join_group, etc). There are no
-- client-facing insert/update/delete policies on those three tables — every
-- mutation is funneled through a function that enforces the real rules
-- (membership required to invite, code must exist to join, etc), so a client
-- can't forge membership by writing the tables directly.
--
-- Requires accounts (troll_accounts.sql) — group membership is tied to real
-- user ids; guests keep using the global room only.
-- ----------------------------------------------------------------------------

-- 1. Per-user default for "invite by username" ------------------------------
alter table public.troll_profiles
  add column if not exists auto_join_groups boolean not null default true;

grant update (auto_join_groups) on public.troll_profiles to authenticated;

-- 2. Groups -------------------------------------------------------------
create table if not exists public.troll_chat_groups (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null unique,
  name        text        not null,
  owner_id    uuid        references auth.users (id) on delete set null,
  code_locked boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- 3. Membership ---------------------------------------------------------
create table if not exists public.troll_chat_group_members (
  group_id  uuid        not null references public.troll_chat_groups (id) on delete cascade,
  user_id   uuid        not null references auth.users (id) on delete cascade,
  role      text        not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- SECURITY DEFINER membership check, used by policies below instead of a raw
-- subquery on troll_chat_group_members from within its own RLS policy —
-- self-referencing a table inside its own USING clause is a known recursion
-- footgun in Postgres RLS, so route the check through a function that runs
-- with elevated privilege and bypasses RLS on that one lookup.
create or replace function public.troll_chat_is_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.troll_chat_group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;
revoke all on function public.troll_chat_is_member(uuid, uuid) from public;
grant execute on function public.troll_chat_is_member(uuid, uuid) to anon, authenticated;

alter table public.troll_chat_groups enable row level security;

drop policy if exists troll_chat_groups_read on public.troll_chat_groups;
create policy troll_chat_groups_read
  on public.troll_chat_groups
  for select
  to authenticated
  using (public.troll_chat_is_member(id, auth.uid()));

revoke all on public.troll_chat_groups from anon, authenticated;
grant select on public.troll_chat_groups to authenticated;

alter table public.troll_chat_group_members enable row level security;

drop policy if exists troll_chat_group_members_read on public.troll_chat_group_members;
create policy troll_chat_group_members_read
  on public.troll_chat_group_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.troll_chat_is_member(group_id, auth.uid())
  );

revoke all on public.troll_chat_group_members from anon, authenticated;
grant select on public.troll_chat_group_members to authenticated;

-- 4. Pending invites ------------------------------------------------------
create table if not exists public.troll_chat_group_invites (
  group_id         uuid        not null references public.troll_chat_groups (id) on delete cascade,
  invited_user_id  uuid        not null references auth.users (id) on delete cascade,
  invited_by       uuid        references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  primary key (group_id, invited_user_id)
);

alter table public.troll_chat_group_invites enable row level security;

drop policy if exists troll_chat_group_invites_read on public.troll_chat_group_invites;
create policy troll_chat_group_invites_read
  on public.troll_chat_group_invites
  for select
  to authenticated
  using (invited_user_id = auth.uid() or invited_by = auth.uid());

revoke all on public.troll_chat_group_invites from anon, authenticated;
grant select on public.troll_chat_group_invites to authenticated;

-- 5. Messages: tag rows with the group they belong to ----------------------
alter table public.troll_chat
  add column if not exists group_id uuid references public.troll_chat_groups (id) on delete cascade;

create index if not exists troll_chat_group_id_idx on public.troll_chat (group_id);

-- Anyone can still read the global room; group rooms are member-only.
-- (Superseded read policy from troll_chat.sql / troll_chat_v2.sql.)
drop policy if exists troll_chat_read on public.troll_chat;
create policy troll_chat_read
  on public.troll_chat
  for select
  to anon, authenticated
  using (
    group_id is null
    or public.troll_chat_is_member(group_id, auth.uid())
  );

-- Guests may only post in the global room. Logged-in posts may target a
-- group room they belong to, or the global room, same as before otherwise.
do $$
begin
  execute 'drop policy if exists troll_chat_insert on public.troll_chat';
  execute 'drop policy if exists troll_chat_insert_auth on public.troll_chat';

  execute $p$
    create policy troll_chat_insert
      on public.troll_chat
      for insert
      to anon
      with check (
        group_id is null
        and char_length(name) <= 24
        and user_id is null
        and not exists (
          select 1 from public.troll_profiles p
          where p.username_lower = lower(troll_chat.name)
        )
        and (
          char_length(body) between 1 and 240
          or (
            body like 'draw:data:image/png;base64,%'
            and char_length(body) between 30 and 32000
          )
        )
      )
  $p$;

  execute $p$
    create policy troll_chat_insert_auth
      on public.troll_chat
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        and name = (select username from public.troll_profiles where id = auth.uid())
        and (
          group_id is null
          or public.troll_chat_is_member(group_id, auth.uid())
        )
        and (
          char_length(body) between 1 and 240
          or (
            body like 'draw:data:image/png;base64,%'
            and char_length(body) between 30 and 32000
          )
        )
      )
  $p$;
end $$;

-- 6. RPCs (SECURITY DEFINER — the only way clients touch groups/members/invites)

create or replace function public.troll_chat_gen_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I — easy to read aloud
  candidate text;
  tries int := 0;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.troll_chat_groups where code = candidate);
    tries := tries + 1;
    if tries > 20 then
      raise exception 'Could not generate a unique code, try again.';
    end if;
  end loop;
  return candidate;
end;
$$;
revoke all on function public.troll_chat_gen_code() from public;

create or replace function public.troll_chat_create_group(p_name text)
returns public.troll_chat_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_group public.troll_chat_groups;
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception 'Group names are 1-40 characters.';
  end if;

  insert into public.troll_chat_groups (code, name, owner_id)
  values (troll_chat_gen_code(), v_name, auth.uid())
  returning * into v_group;

  insert into public.troll_chat_group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'owner');

  return v_group;
end;
$$;
revoke all on function public.troll_chat_create_group(text) from public;
grant execute on function public.troll_chat_create_group(text) to authenticated;

create or replace function public.troll_chat_join_group(p_code text)
returns public.troll_chat_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.troll_chat_groups;
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;

  select * into v_group from public.troll_chat_groups where code = upper(trim(coalesce(p_code, '')));
  if v_group.id is null then
    raise exception 'No group with that code.';
  end if;

  insert into public.troll_chat_group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group;
end;
$$;
revoke all on function public.troll_chat_join_group(text) from public;
grant execute on function public.troll_chat_join_group(text) to authenticated;

create or replace function public.troll_chat_invite_username(p_group_id uuid, p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_id uuid;
  v_auto_join boolean;
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;
  if not exists (
    select 1 from public.troll_chat_group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'You are not in that group.';
  end if;

  select id, auto_join_groups into v_target_id, v_auto_join
  from public.troll_profiles
  where username_lower = lower(trim(coalesce(p_username, '')));

  if v_target_id is null then
    raise exception 'No troll with that username.';
  end if;
  if exists (
    select 1 from public.troll_chat_group_members
    where group_id = p_group_id and user_id = v_target_id
  ) then
    return 'already_member';
  end if;

  if coalesce(v_auto_join, true) then
    insert into public.troll_chat_group_members (group_id, user_id, role)
    values (p_group_id, v_target_id, 'member')
    on conflict (group_id, user_id) do nothing;
    return 'added';
  else
    insert into public.troll_chat_group_invites (group_id, invited_user_id, invited_by)
    values (p_group_id, v_target_id, auth.uid())
    on conflict (group_id, invited_user_id) do nothing;
    return 'invited';
  end if;
end;
$$;
revoke all on function public.troll_chat_invite_username(uuid, text) from public;
grant execute on function public.troll_chat_invite_username(uuid, text) to authenticated;

create or replace function public.troll_chat_accept_invite(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;
  if not exists (
    select 1 from public.troll_chat_group_invites
    where group_id = p_group_id and invited_user_id = auth.uid()
  ) then
    raise exception 'No invite found.';
  end if;

  insert into public.troll_chat_group_members (group_id, user_id, role)
  values (p_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  delete from public.troll_chat_group_invites
  where group_id = p_group_id and invited_user_id = auth.uid();
end;
$$;
revoke all on function public.troll_chat_accept_invite(uuid) from public;
grant execute on function public.troll_chat_accept_invite(uuid) to authenticated;

create or replace function public.troll_chat_decline_invite(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;
  delete from public.troll_chat_group_invites
  where group_id = p_group_id and invited_user_id = auth.uid();
end;
$$;
revoke all on function public.troll_chat_decline_invite(uuid) from public;
grant execute on function public.troll_chat_decline_invite(uuid) to authenticated;

create or replace function public.troll_chat_leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean;
  v_next_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;

  select (role = 'owner') into v_is_owner
  from public.troll_chat_group_members
  where group_id = p_group_id and user_id = auth.uid();

  delete from public.troll_chat_group_members
  where group_id = p_group_id and user_id = auth.uid();

  if v_is_owner then
    select user_id into v_next_owner
    from public.troll_chat_group_members
    where group_id = p_group_id
    order by joined_at asc
    limit 1;

    if v_next_owner is not null then
      update public.troll_chat_group_members
      set role = 'owner'
      where group_id = p_group_id and user_id = v_next_owner;
      update public.troll_chat_groups set owner_id = v_next_owner where id = p_group_id;
    else
      delete from public.troll_chat_groups where id = p_group_id;
    end if;
  end if;
end;
$$;
revoke all on function public.troll_chat_leave_group(uuid) from public;
grant execute on function public.troll_chat_leave_group(uuid) to authenticated;

create or replace function public.troll_chat_my_groups()
returns table (id uuid, code text, name text, role text, code_locked boolean, joined_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select g.id, g.code, g.name, m.role, g.code_locked, m.joined_at
  from public.troll_chat_group_members m
  join public.troll_chat_groups g on g.id = m.group_id
  where m.user_id = auth.uid()
  order by m.joined_at asc;
$$;
revoke all on function public.troll_chat_my_groups() from public;
grant execute on function public.troll_chat_my_groups() to authenticated;

create or replace function public.troll_chat_my_invites()
returns table (group_id uuid, group_name text, invited_by_username text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select i.group_id, g.name, p.username, i.created_at
  from public.troll_chat_group_invites i
  join public.troll_chat_groups g on g.id = i.group_id
  left join public.troll_profiles p on p.id = i.invited_by
  where i.invited_user_id = auth.uid()
  order by i.created_at desc;
$$;
revoke all on function public.troll_chat_my_invites() from public;
grant execute on function public.troll_chat_my_invites() to authenticated;
