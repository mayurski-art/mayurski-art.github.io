-- ============================================================================
-- TROLLRUNNER BETA CHECKLIST — per-account progress + a one-time XP reward.
-- Run ONCE in Supabase → SQL Editor, AFTER troll_accounts.sql and
-- troll_xp_expansion.sql. Idempotent.
--
-- Adds:
--   troll_user_settings.checklist_progress — jsonb map of checkbox id → bool,
--     so a tester's progress follows their account across devices.
--   checklist_complete — new troll_award_xp event. +30 XP, once ever per
--     account (lifetime_cap = 1). Fired client-side the moment every box on
--     the Beta Checklist app is checked.
-- ============================================================================

alter table public.troll_user_settings
  add column if not exists checklist_progress jsonb not null default '{}'::jsonb;

grant update (checklist_progress) on public.troll_user_settings to authenticated;

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
    when 'daily_login'       then v_xp := 10; v_cooldown := interval '20 hours';  v_daily_cap := 1;
    when 'chat_post'         then v_xp := 2;  v_cooldown := interval '2 minutes'; v_daily_cap := 20;
    when 'game_run'          then v_xp := 5;  v_cooldown := interval '30 seconds'; v_daily_cap := 60;
    when 'high_score'        then v_xp := 20; v_cooldown := interval '30 seconds'; v_daily_cap := 20;
    when 'feedback_post'     then v_xp := 5;  v_cooldown := interval '6 hours';   v_daily_cap := 2;
    when 'login_streak'      then v_cooldown := interval '20 hours'; v_daily_cap := 1; -- v_xp computed below
    when 'profile_avatar'    then v_xp := 25; v_cooldown := interval '1 second';  v_daily_cap := 1; v_lifetime_cap := 1;
    when 'profile_bio'       then v_xp := 15; v_cooldown := interval '1 second';  v_daily_cap := 1; v_lifetime_cap := 1;
    when 'profile_email'     then v_xp := 25; v_cooldown := interval '1 second';  v_daily_cap := 1; v_lifetime_cap := 1;
    when 'game_first_daily'  then v_xp := 15; v_cooldown := interval '20 hours'; v_daily_cap := 1;
    when 'boss_kill'         then v_xp := 50; v_cooldown := interval '30 seconds'; v_daily_cap := 3;
    when 'versus_match'      then v_xp := 10; v_cooldown := interval '20 seconds'; v_daily_cap := 10;
    when 'checklist_complete' then v_xp := 30; v_cooldown := interval '1 second'; v_daily_cap := 1; v_lifetime_cap := 1;
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
