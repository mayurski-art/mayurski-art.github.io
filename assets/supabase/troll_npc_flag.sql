-- ============================================================================
-- NPC FLAG — marks a troll_profiles row as a seed/test account rather than a
-- real player, so the admin accounts table can show a red "NPC" tag vs a
-- sky-blue "Player" tag. Run ONCE in Supabase → SQL Editor.
-- ============================================================================
-- No client write access is granted (same treatment as xp/level): this is
-- set manually here, from the SQL editor, not from the site UI.

alter table public.troll_profiles
  add column if not exists is_npc boolean not null default false;

-- Example — flag specific accounts as NPCs by username:
-- update public.troll_profiles set is_npc = true
--   where username_lower in ('example_npc_1', 'example_npc_2');
