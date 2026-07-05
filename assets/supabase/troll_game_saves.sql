-- ============================================================================
-- TROLLRUNNER GAME SAVES — real per-account cloud saves for games that need
-- more than a leaderboard score (starting with Trollrreria's world state).
-- Run ONCE in Supabase → SQL Editor. Idempotent — safe to re-run.
--
-- Each row is one player's save for one game. RLS is a plain owner-only
-- policy (auth.uid() = user_id) since every row is single-owner by
-- construction — no shared-row problem like site_updates had, so no RPC
-- indirection is needed here.
-- ============================================================================

create table if not exists public.troll_game_saves (
  user_id    uuid not null references auth.users (id) on delete cascade,
  game_id    text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id),
  constraint troll_game_saves_size_guard check (pg_column_size(data) < 5000000)
);

alter table public.troll_game_saves enable row level security;

drop policy if exists troll_game_saves_owner_select on public.troll_game_saves;
create policy troll_game_saves_owner_select on public.troll_game_saves
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists troll_game_saves_owner_insert on public.troll_game_saves;
create policy troll_game_saves_owner_insert on public.troll_game_saves
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists troll_game_saves_owner_update on public.troll_game_saves;
create policy troll_game_saves_owner_update on public.troll_game_saves
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists troll_game_saves_owner_delete on public.troll_game_saves;
create policy troll_game_saves_owner_delete on public.troll_game_saves
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.troll_game_saves from anon, authenticated;
grant select, insert, update, delete on public.troll_game_saves to authenticated;
