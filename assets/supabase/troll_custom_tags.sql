-- ============================================================================
-- CUSTOM PROFILE TAGS — lets an admin create/delete arbitrary tag defs
-- (label + colour) from admin.html -> Player accounts -> Profile tags,
-- instead of the fixed developer/admin/trollrunner set.
--
-- Run AFTER troll_profile_tags.sql and troll_admin_lockdown.sql (needs
-- troll_is_admin()). Idempotent.
-- ============================================================================

create table if not exists public.troll_tag_defs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  color text not null,
  created_at timestamptz not null default now()
);

alter table public.troll_tag_defs enable row level security;

drop policy if exists "troll_tag_defs read" on public.troll_tag_defs;
create policy "troll_tag_defs read" on public.troll_tag_defs
  for select using (true);

-- No direct insert/update/delete grants — everything goes through the
-- SECURITY DEFINER RPCs below so only a real admin session can write.
revoke all on public.troll_tag_defs from public, anon, authenticated;
grant select on public.troll_tag_defs to anon, authenticated;

-- troll_profile_tag_slugs() now reads the live tag set instead of a
-- hardcoded array, so troll_admin_set_profile_tags keeps working unchanged.
create or replace function public.troll_profile_tag_slugs()
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(slug order by created_at), '{}'::text[]) from public.troll_tag_defs;
$$;

create or replace function public.troll_admin_create_tag(p_label text, p_color text)
returns public.troll_tag_defs
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_label text := btrim(coalesce(p_label, ''));
  clean_color text := lower(btrim(coalesce(p_color, '')));
  base_slug text;
  candidate_slug text;
  suffix int := 1;
  row_out public.troll_tag_defs;
begin
  if not public.troll_is_admin() then
    raise exception 'Admin session required';
  end if;

  if clean_label = '' or length(clean_label) > 24 then
    raise exception 'Tag name must be 1-24 characters';
  end if;
  if clean_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'Color must be a 6-digit hex code like #7f8bff';
  end if;

  base_slug := regexp_replace(lower(clean_label), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'tag'; end if;

  candidate_slug := base_slug;
  while exists (select 1 from public.troll_tag_defs where slug = candidate_slug) loop
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix;
  end loop;

  insert into public.troll_tag_defs (slug, label, color)
  values (candidate_slug, clean_label, clean_color)
  returning * into row_out;

  return row_out;
end;
$$;

create or replace function public.troll_admin_delete_tag(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_slug text := lower(btrim(coalesce(p_slug, '')));
begin
  if not public.troll_is_admin() then
    raise exception 'Admin session required';
  end if;

  delete from public.troll_tag_defs where slug = clean_slug;

  -- Strip the deleted tag from every profile that had it.
  update public.troll_profiles
     set tags = array_remove(tags, clean_slug)
   where clean_slug = any(tags);
end;
$$;

revoke all on function public.troll_admin_create_tag(text, text) from public, anon;
grant execute on function public.troll_admin_create_tag(text, text) to authenticated;

revoke all on function public.troll_admin_delete_tag(text) from public, anon;
grant execute on function public.troll_admin_delete_tag(text) to authenticated;

-- Seed with the original three tags (same slugs/colours as before) so
-- nothing that already has a tag changes when this migration runs.
insert into public.troll_tag_defs (slug, label, color) values
  ('developer', 'Developer', '#7f8bff'),
  ('admin', 'Admin', '#ff6b6d'),
  ('trollrunner', 'TrollRunner', '#ff77c2')
on conflict (slug) do nothing;
