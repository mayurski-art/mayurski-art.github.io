-- ============================================================================
-- TROLLRUNNER XP EXPANSION — more ways to earn XP, still server-enforced.
-- Run ONCE in Supabase → SQL Editor, AFTER troll_accounts.sql. Idempotent.
--
-- New events added to troll_award_xp's allowlist:
--   login_streak    — replaces the flat daily_login bonus. +5 XP per
--                      consecutive day logged in, capped at +50 (day 10+).
--                      Streak length is computed server-side from
--                      troll_xp_events history — the client never gets to
--                      claim its own streak day.
--   profile_avatar  — one-time, awarded the first time a real avatar is set.
--   profile_bio     — one-time, awarded the first time a bio is saved.
--   profile_email   — one-time, awarded the first time a recovery email
--                      is saved.
--   game_first_daily — +15 XP for the first game session of the day
--                      (across any game — troll_record_game_result below
--                      already treats game_run/high_score globally rather
--                      than per-game, so this matches that existing shape).
--   boss_kill       — +50 XP, capped 3/day (Trollrreria boss defeats).
--   versus_match    — +10 XP, capped 10/day (Troll Kombat match completed).
--
-- Deliberately NOT added yet (documented, not forgotten):
--   weekly_podium    — needs a real weekly leaderboard reset job; the
--                       current leaderboard UI is mock/localStorage-backed
--                       per project notes, so there's no real data source
--                       to crown a podium from yet.
--   confirmed_support — needs the on-chain payment verifier described in
--                       docs/PART2-SYSTEMS.md, which is deliberately not
--                       built yet (troll_transactions rows never actually
--                       flip to 'confirmed' today).
-- ============================================================================

create or replace function public.troll_award_xp(
  p_event  text,
  p_source text  default null,
  p_meta   jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_xp           integer;
  v_cooldown     interval;
  v_daily_cap    integer;
  v_lifetime_cap integer := null;
  v_last         timestamptz;
  v_today        integer;
  v_ever         integer;
  v_new_xp       integer;
  v_new_level    integer;
  v_streak       integer;
  v_last_day     date;
  v_prev_streak  integer;
begin
  if v_uid is null then
    raise exception 'Login required.';
  end if;

  -- Allowlist: event → (xp, cooldown, max awards per day[, lifetime cap])
  case p_event
    when 'daily_login'     then v_xp := 10; v_cooldown := interval '20 hours';  v_daily_cap := 1;
    when 'chat_post'       then v_xp := 2;  v_cooldown := interval '2 minutes'; v_daily_cap := 20;
    when 'game_run'        then v_xp := 5;  v_cooldown := interval '30 seconds'; v_daily_cap := 60;
    when 'high_score'      then v_xp := 20; v_cooldown := interval '30 seconds'; v_daily_cap := 20;
    when 'feedback_post'   then v_xp := 5;  v_cooldown := interval '6 hours';   v_daily_cap := 2;
    when 'login_streak'    then v_cooldown := interval '20 hours'; v_daily_cap := 1; -- v_xp computed below
    when 'profile_avatar'  then v_xp := 25; v_cooldown := interval '1 second';  v_daily_cap := 1; v_lifetime_cap := 1;
    when 'profile_bio'     then v_xp := 15; v_cooldown := interval '1 second';  v_daily_cap := 1; v_lifetime_cap := 1;
    when 'profile_email'   then v_xp := 25; v_cooldown := interval '1 second';  v_daily_cap := 1; v_lifetime_cap := 1;
    when 'game_first_daily' then v_xp := 15; v_cooldown := interval '20 hours'; v_daily_cap := 1;
    when 'boss_kill'       then v_xp := 50; v_cooldown := interval '30 seconds'; v_daily_cap := 3;
    when 'versus_match'    then v_xp := 10; v_cooldown := interval '20 seconds'; v_daily_cap := 10;
    else raise exception 'Unknown XP event: %', p_event;
  end case;

  select max(created_at) into v_last
    from troll_xp_events
   where user_id = v_uid and event_type = p_event;

  if v_last is not null and now() - v_last < v_cooldown then
    return jsonb_build_object('awarded', 0, 'reason', 'cooldown');
  end if;

  select count(*) into v_today
    from troll_xp_events
   where user_id = v_uid and event_type = p_event
     and created_at > now() - interval '24 hours';

  if v_today >= v_daily_cap then
    return jsonb_build_object('awarded', 0, 'reason', 'daily_cap');
  end if;

  if v_lifetime_cap is not null then
    select count(*) into v_ever
      from troll_xp_events
     where user_id = v_uid and event_type = p_event;
    if v_ever >= v_lifetime_cap then
      return jsonb_build_object('awarded', 0, 'reason', 'lifetime_cap');
    end if;
  end if;

  -- Streak length is computed here, server-side, from history -- the
  -- client only ever says "login_streak" happened, never how long.
  if p_event = 'login_streak' then
    with days as (
      select distinct (created_at at time zone 'utc')::date as d
        from troll_xp_events
       where user_id = v_uid and event_type in ('login_streak', 'daily_login')
    ),
    ranked as (
      select d, d - (row_number() over (order by d desc))::int as grp
        from days
    )
    select max(d), count(*) into v_last_day, v_prev_streak
      from ranked
     where grp = (select grp from ranked order by d desc limit 1);

    if v_last_day is null or v_last_day < (now() at time zone 'utc')::date - 1 then
      v_streak := 1; -- gap since last login (or first login ever) -- streak resets
    else
      v_streak := coalesce(v_prev_streak, 0) + 1; -- last login was yesterday -- streak continues
    end if;
    v_xp := least(50, v_streak * 5);
  end if;

  insert into troll_xp_events (user_id, event_type, xp, source, metadata)
  values (
    v_uid, p_event, v_xp, p_source,
    coalesce(p_meta, '{}'::jsonb) ||
      case when p_event = 'login_streak' then jsonb_build_object('streakDay', v_streak) else '{}'::jsonb end
  );

  update troll_profiles
     set xp = xp + v_xp,
         level = troll_level_for_xp(xp + v_xp),
         updated_at = now()
   where id = v_uid
   returning xp, level into v_new_xp, v_new_level;

  return jsonb_build_object('awarded', v_xp, 'xp', v_new_xp, 'level', v_new_level, 'streakDay', v_streak);
end;
$$;

revoke all on function public.troll_award_xp(text, text, jsonb) from public, anon;
grant execute on function public.troll_award_xp(text, text, jsonb) to authenticated;

-- Award game_first_daily (once/day, across any game) right before the
-- existing game_run/high_score awards -- "first today" is checked before
-- this call's own game_run row would exist, so the order here matters.
create or replace function public.troll_record_game_result(
  p_game_id text,
  p_score   numeric,
  p_meta    jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_cfg         troll_game_config%rowtype;
  v_last        timestamptz;
  v_prev_high   numeric;
  v_stats       troll_game_stats%rowtype;
  v_new_high    boolean := false;
  v_first_today boolean;
  v_xp          jsonb;
begin
  if v_uid is null then
    raise exception 'Login required to save game results.';
  end if;
  if p_game_id is null or p_game_id !~ '^[a-z0-9_-]{2,40}$' then
    raise exception 'Bad game id.';
  end if;

  select * into v_cfg from troll_game_config where game_id = p_game_id;
  if not found then
    select * into v_cfg from troll_game_config where game_id = '*';
  end if;

  if p_score is null or p_score < 0 or p_score > v_cfg.max_score then
    raise exception 'Score rejected.';
  end if;

  select max(achieved_at) into v_last
    from troll_leaderboard
   where user_id = v_uid and game_id = p_game_id;

  if v_last is not null and now() - v_last < make_interval(secs => v_cfg.min_interval_s) then
    return jsonb_build_object('saved', false, 'reason', 'too_fast');
  end if;

  select high_score into v_prev_high
    from troll_game_stats
   where user_id = v_uid and game_id = p_game_id;

  v_new_high := v_prev_high is null or p_score > v_prev_high;

  select not exists(
    select 1 from troll_xp_events
     where user_id = v_uid and event_type = 'game_run'
       and created_at > now() - interval '24 hours'
  ) into v_first_today;

  insert into troll_game_stats as gs (user_id, game_id, games_played, high_score, last_meta, updated_at)
  values (v_uid, p_game_id, 1, p_score, coalesce(p_meta, '{}'::jsonb), now())
  on conflict (user_id, game_id) do update
     set games_played = gs.games_played + 1,
         high_score   = greatest(gs.high_score, excluded.high_score),
         last_meta    = excluded.last_meta,
         updated_at   = now()
  returning * into v_stats;

  insert into troll_leaderboard (user_id, game_id, score, meta)
  values (v_uid, p_game_id, p_score, coalesce(p_meta, '{}'::jsonb));

  if v_first_today then
    v_xp := troll_award_xp('game_first_daily', p_game_id, p_meta);
  end if;
  v_xp := troll_award_xp('game_run', p_game_id, p_meta);
  if v_new_high then
    v_xp := troll_award_xp('high_score', p_game_id, p_meta);
  end if;

  return jsonb_build_object(
    'saved', true,
    'new_high', v_new_high,
    'high_score', v_stats.high_score,
    'games_played', v_stats.games_played,
    'xp', v_xp
  );
end;
$$;

revoke all on function public.troll_record_game_result(text, numeric, jsonb) from public, anon;
grant execute on function public.troll_record_game_result(text, numeric, jsonb) to authenticated;
