-- ============================================================================
-- TROLLCHAT MESSAGES INBOX — merged DM + group-chat list with last-message
-- previews, for the Twitter-DMs-style "MESSAGES" panel in TROLLCHAT.
-- (run ONCE in Supabase -> SQL Editor, after troll_friends.sql +
-- troll_chat_groups.sql)
-- ============================================================================
-- Both RPCs are read-only, SECURITY DEFINER only so they can join across
-- tables the caller doesn't have direct select on (other people's
-- troll_profiles rows, other members' troll_chat rows) while still scoping
-- every result to auth.uid()'s own threads/memberships.
-- ----------------------------------------------------------------------------

create or replace function public.troll_dm_my_threads()
returns table (
  thread_id        uuid,
  other_id         uuid,
  other_username   text,
  other_avatar_url text,
  last_body        text,
  last_sender_id   uuid,
  last_at          timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id,
    p.id,
    p.username,
    p.avatar_url,
    m.body,
    m.sender_id,
    coalesce(m.created_at, t.created_at)
  from public.troll_dm_threads t
  join public.troll_profiles p
    on p.id = (case when t.user_a = auth.uid() then t.user_b else t.user_a end)
  left join lateral (
    select body, sender_id, created_at
    from public.troll_dm_messages
    where thread_id = t.id
    order by created_at desc
    limit 1
  ) m on true
  where auth.uid() in (t.user_a, t.user_b)
  order by coalesce(m.created_at, t.created_at) desc;
$$;
revoke all on function public.troll_dm_my_threads() from public;
grant execute on function public.troll_dm_my_threads() to authenticated;

create or replace function public.troll_chat_group_last_messages()
returns table (
  group_id  uuid,
  last_body text,
  last_name text,
  last_at   timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    g.id,
    m.body,
    m.name,
    m.created_at
  from public.troll_chat_groups g
  join public.troll_chat_group_members mem
    on mem.group_id = g.id and mem.user_id = auth.uid()
  left join lateral (
    select body, name, created_at
    from public.troll_chat
    where group_id = g.id
    order by created_at desc
    limit 1
  ) m on true;
$$;
revoke all on function public.troll_chat_group_last_messages() from public;
grant execute on function public.troll_chat_group_last_messages() to authenticated;
