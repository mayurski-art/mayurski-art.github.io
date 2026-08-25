-- ============================================================================
-- EDIT PROFILE TAGS — lets an admin rename/recolour an existing tag def
-- from admin.html -> Player accounts -> Profile tags, instead of only
-- being able to create or delete one. Run AFTER troll_custom_tags.sql
-- (needs troll_tag_defs + troll_is_admin()). Idempotent.
--
-- The slug is left untouched on purpose — it's what troll_profiles.tags
-- stores per account, so renaming the label must not change which
-- accounts already carry the tag. Only label/color update.
-- ============================================================================

create or replace function public.troll_admin_update_tag(p_slug text, p_label text, p_color text)
returns public.troll_tag_defs
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_slug  text := lower(btrim(coalesce(p_slug, '')));
  clean_label text := btrim(coalesce(p_label, ''));
  clean_color text := lower(btrim(coalesce(p_color, '')));
  row_out     public.troll_tag_defs;
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

  update public.troll_tag_defs
     set label = clean_label,
         color = clean_color
   where slug = clean_slug
   returning * into row_out;

  if row_out is null then
    raise exception 'Tag not found';
  end if;

  return row_out;
end;
$$;

revoke all on function public.troll_admin_update_tag(text, text, text) from public, anon;
grant execute on function public.troll_admin_update_tag(text, text, text) to authenticated;
