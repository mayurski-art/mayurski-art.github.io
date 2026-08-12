-- ============================================================================
-- PROFILE TAGS — Discord-style role tags (Developer / Admin / TrollRunner)
-- rendered on profile cards next to the username.
--
-- Tags are NOT self-serve: the column has no client update grant, so the only
-- way to set one is troll_admin_set_profile_tags() below, which refuses
-- anything that is not a real admin session (admin.html → Player accounts →
-- Tags column). Run ONCE in Supabase → SQL Editor. Idempotent.
--
-- Requires troll_admin_lockdown.sql (for troll_is_admin()).
-- ============================================================================

alter table public.troll_profiles
  add column if not exists tags text[] not null default '{}'::text[];

-- The only slugs the UI knows how to colour. Anything else is dropped
-- server-side rather than stored and silently ignored by the client.
create or replace function public.troll_profile_tag_slugs()
returns text[]
language sql
immutable
as $$
  select array['developer', 'admin', 'trollrunner']::text[];
$$;

create or replace function public.troll_admin_set_profile_tags(p_user uuid, p_tags text[])
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text[];
begin
  if not public.troll_is_admin() then
    raise exception 'Admin session required';
  end if;

  select coalesce(array_agg(distinct lower(btrim(tag)) order by lower(btrim(tag))), '{}'::text[])
    into cleaned
    from unnest(coalesce(p_tags, '{}'::text[])) as tag
   where lower(btrim(tag)) = any (public.troll_profile_tag_slugs());

  update public.troll_profiles set tags = cleaned where id = p_user;
  if not found then
    raise exception 'No profile with that id';
  end if;

  return cleaned;
end;
$$;

revoke all on function public.troll_profile_tag_slugs() from public;
grant execute on function public.troll_profile_tag_slugs() to anon, authenticated;

revoke all on function public.troll_admin_set_profile_tags(uuid, text[]) from public, anon;
grant execute on function public.troll_admin_set_profile_tags(uuid, text[]) to authenticated;

-- Reads need nothing new: troll_profiles already grants SELECT to anon and
-- authenticated with a `using (true)` policy, so the new column is public.

-- Optional starting point — give the owner account its own tags:
-- select public.troll_admin_set_profile_tags(
--   (select id from public.troll_profiles where username_lower = 'troll_runner'),
--   array['trollrunner', 'developer', 'admin']
-- );
