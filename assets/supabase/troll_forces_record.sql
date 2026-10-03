-- Troll Forces combat record (prestige phase 3, 2026-10-03). Run once in the
-- Supabase SQL editor. Idempotent: safe to run again.
--
-- Lifetime PvP totals per account, added to at the end of every match by
-- troll_forces_record_match() (assets/games/troll-ops/record.js queues and
-- sends them). The numbers come from the game, so like XP they could be
-- faked by someone determined; each match is clamped to what one match can
-- plausibly hold so a single bad send can't wreck a record.

create table if not exists public.troll_forces_record (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  matches      int    not null default 0,
  wins         int    not null default 0,
  losses       int    not null default 0,
  kills        int    not null default 0,
  deaths       int    not null default 0,
  assists      int    not null default 0,
  headshots    int    not null default 0,
  best_streak  int    not null default 0,
  score        bigint not null default 0,
  seconds      bigint not null default 0,
  shots_fired  bigint not null default 0,
  shots_hit    bigint not null default 0,
  weapon_kills jsonb  not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.troll_forces_record enable row level security;

-- Anyone can read anyone's record (profile cards). Nobody writes it directly:
-- no insert/update/delete policies, only the function below.
drop policy if exists "troll forces record is public" on public.troll_forces_record;
create policy "troll forces record is public"
  on public.troll_forces_record for select using (true);

grant select on public.troll_forces_record to anon, authenticated;

create or replace function public.troll_forces_record_match(p_match jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_kills int; v_deaths int; v_assists int; v_heads int; v_streak int;
  v_score bigint; v_secs bigint; v_fired bigint; v_hit bigint; v_won boolean;
  wk jsonb := '{}'::jsonb;
  k text; val text; n int; i int := 0;
begin
  if uid is null then raise exception 'Sign in to keep a combat record.'; end if;

  -- one match's worth, at most
  v_kills   := least(greatest(coalesce((p_match->>'kills')::int, 0), 0), 200);
  v_deaths  := least(greatest(coalesce((p_match->>'deaths')::int, 0), 0), 200);
  v_assists := least(greatest(coalesce((p_match->>'assists')::int, 0), 0), 200);
  v_heads   := least(greatest(coalesce((p_match->>'headshots')::int, 0), 0), v_kills);
  v_streak  := least(greatest(coalesce((p_match->>'best_streak')::int, 0), 0), v_kills);
  v_score   := least(greatest(coalesce((p_match->>'score')::bigint, 0), 0), 100000);
  v_secs    := least(greatest(coalesce((p_match->>'seconds')::bigint, 0), 0), 3600);
  v_fired   := least(greatest(coalesce((p_match->>'shots_fired')::bigint, 0), 0), 30000);
  v_hit     := least(greatest(coalesce((p_match->>'shots_hit')::bigint, 0), 0), v_fired);
  v_won     := coalesce((p_match->>'won')::boolean, false);

  -- kills per weapon: at most 40 weapons, short ids, no more than the kills
  if jsonb_typeof(p_match->'weapon_kills') = 'object' then
    for k, val in select * from jsonb_each_text(p_match->'weapon_kills') loop
      exit when i >= 40;
      continue when length(k) > 32 or k !~ '^[a-z0-9_-]+$';
      n := least(greatest(coalesce(val::int, 0), 0), v_kills);
      if n > 0 then wk := wk || jsonb_build_object(k, n); i := i + 1; end if;
    end loop;
  end if;

  insert into public.troll_forces_record (user_id) values (uid) on conflict (user_id) do nothing;

  update public.troll_forces_record r set
    matches     = r.matches + 1,
    wins        = r.wins + case when v_won then 1 else 0 end,
    losses      = r.losses + case when v_won then 0 else 1 end,
    kills       = r.kills + v_kills,
    deaths      = r.deaths + v_deaths,
    assists     = r.assists + v_assists,
    headshots   = r.headshots + v_heads,
    best_streak = greatest(r.best_streak, v_streak),
    score       = r.score + v_score,
    seconds     = r.seconds + v_secs,
    shots_fired = r.shots_fired + v_fired,
    shots_hit   = r.shots_hit + v_hit,
    weapon_kills = (
      select coalesce(jsonb_object_agg(key, total), '{}'::jsonb) from (
        select key, sum(value::int) as total from (
          select key, value from jsonb_each_text(r.weapon_kills)
          union all
          select key, value from jsonb_each_text(wk)
        ) both_sides group by key
      ) merged
    ),
    updated_at  = now()
  where r.user_id = uid;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.troll_forces_record_match(jsonb) from public, anon;
grant execute on function public.troll_forces_record_match(jsonb) to authenticated;
