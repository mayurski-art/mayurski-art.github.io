-- ============================================================================
-- MAP PIN XP — one-time XP for dropping your pin on the world map. Run ONCE
-- in Supabase → SQL Editor, AFTER troll_accounts.sql (idempotent).
--
-- New event added to troll_award_xp's allowlist:
--   map_pin — +15 XP, awarded the first time a location is ever saved via
--             troll_set_location() (trollrunner-maps repo). v_lifetime_cap
--             makes this a true "once ever" award: moving/re-dropping the
--             pin later calls the same RPC again but is silently a no-op
--             (awarded: 0, reason: 'lifetime_cap') — no repeat farming.
--
-- create or replace function REPLACES the whole function body, so this
-- carries forward every event added by earlier migrations (troll_accounts.sql,
-- troll_xp_expansion.sql, troll_checklist.sql / troll_member_tag.sql,
-- troll_terminal_xp.sql) plus this file's own addition — whichever of those
-- ran last, running this one after it won't drop any of their events.
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
    when 'daily_login'        then v_xp := 10; v_cooldown := interval '20 hours';  v_daily_cap := 1;
    when 'chat_post'          then v_xp := 2;  v_cooldown := interval '2 minutes'; v_daily_cap := 20;
    when 'game_run'           then v_xp := 5;  v_cooldown := interval '30 seconds'; v_daily_cap := 60;
    when 'high_score'         then v_xp := 20; v_cooldown := interval '30 seconds'; v_daily_cap := 20;
    when 'feedback_post'      then v_xp := 5;  v_cooldown := interval '6 hours';   v_daily_cap := 2;
    when 'login_streak'       then v_cooldown := interval '20 hours'; v_daily_cap := 1; -- v_xp computed below
    when 'profile_avatar'     then v_xp := 25; v_cooldown := interval '1 second';  v_daily_cap := 1; v_lifetime_cap := 1;
    when 'profile_bio'        then v_xp := 15; v_cooldown := interval '1 second';  v_daily_cap := 1; v_lifetime_cap := 1;
    when 'profile_email'      then v_xp := 25; v_cooldown := interval '1 second';  v_daily_cap := 1; v_lifetime_cap := 1;
    when 'game_first_daily'   then v_xp := 15; v_cooldown := interval '20 hours'; v_daily_cap := 1;
    when 'boss_kill'          then v_xp := 50; v_cooldown := interval '30 seconds'; v_daily_cap := 3;
    when 'versus_match'       then v_xp := 10; v_cooldown := interval '20 seconds'; v_daily_cap := 10;
    when 'checklist_complete' then v_xp := 30; v_cooldown := interval '1 second'; v_daily_cap := 1; v_lifetime_cap := 1;
    when 'terminal_session'   then v_xp := 10; v_cooldown := interval '20 hours'; v_daily_cap := 1;
    when 'undervoice_session' then v_xp := 13; v_cooldown := interval '20 hours'; v_daily_cap := 1;
    when 'map_pin'            then v_xp := 15; v_cooldown := interval '1 second'; v_daily_cap := 1; v_lifetime_cap := 1;
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
