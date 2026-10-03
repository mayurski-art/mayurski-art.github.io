-- Troll Forces prestige (2026-10-02). Run once in the Supabase SQL editor.
-- Idempotent: safe to run again.
--
-- Troll Forces shows its own level, counted from account XP earned since
-- your last prestige (account xp - xp_base) on a faster curve than the site:
--   XP to reach level L = 120*(L-1) + 2*(L-1)^2   (level 69 = 17,408 XP)
-- assets/games/troll-ops/progression.js uses the same formula.
-- Prestiging resets only that number: troll_profiles.level and .xp are never
-- touched. prestige 1-10, then 11 = Prestige Master.

create table if not exists public.troll_forces_prestige (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prestige   int not null default 0 check (prestige between 0 and 11),
  xp_base    bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.troll_forces_prestige enable row level security;

-- Anyone can see anyone's prestige (cards, scoreboards). Nobody writes the
-- table directly: there are no insert/update/delete policies, only the
-- function below.
drop policy if exists "troll forces prestige is public" on public.troll_forces_prestige;
create policy "troll forces prestige is public"
  on public.troll_forces_prestige for select using (true);

grant select on public.troll_forces_prestige to anon, authenticated;

create or replace function public.troll_forces_level_for_xp(p_xp bigint)
returns int language sql immutable as $$
  -- inverse of 120n + 2n^2, capped at 69 (exact at level boundaries)
  select least(69, floor((-120 + sqrt(14400 + 8 * greatest(p_xp, 0)::numeric)) / 4)::int + 1);
$$;

create or replace function public.troll_forces_prestige_up()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  acc_xp bigint;
  cur public.troll_forces_prestige;
begin
  if uid is null then raise exception 'Sign in to prestige.'; end if;

  select coalesce(xp, 0)::bigint into acc_xp from public.troll_profiles where id = uid;
  if acc_xp is null then raise exception 'No profile.'; end if;

  insert into public.troll_forces_prestige (user_id) values (uid) on conflict (user_id) do nothing;
  select * into cur from public.troll_forces_prestige where user_id = uid for update;

  if cur.prestige >= 11 then raise exception 'Already Prestige Master.'; end if;
  if public.troll_forces_level_for_xp(acc_xp - cur.xp_base) < 69 then
    raise exception 'Reach level 69 first.';
  end if;

  update public.troll_forces_prestige
     set prestige = cur.prestige + 1, xp_base = acc_xp, updated_at = now()
   where user_id = uid;

  return json_build_object('prestige', cur.prestige + 1, 'xp_base', acc_xp);
end;
$$;

revoke all on function public.troll_forces_prestige_up() from public, anon;
grant execute on function public.troll_forces_prestige_up() to authenticated;
