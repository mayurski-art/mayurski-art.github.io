-- ============================================================================
-- TERMINAL XP REDEMPTION — lets a troublemaker convert terminal PROBLEMS
-- (trollrunner-terminal's own currency) into real, shared XP. Run ONCE in
-- Supabase -> SQL Editor, AFTER troll_xp_rebalance.sql. Idempotent.
--
-- RATE: 1 PROBLEM = 25 XP, enforced here (not just trusted from the caller)
-- so a compromised terminal deploy can't mint arbitrary XP. The terminal
-- debits PROBLEMS from terminal_wallets itself (a table this project doesn't
-- own) and then calls troll_award_xp_service with p_meta.problemsSpent set to
-- what it actually debited — this function recomputes the XP from that
-- number and ignores any XP the caller might try to pass directly.
--
-- Every other event on the allowlist stays a FIXED per-call amount, as
-- before. problems_redeemed is the one deliberately variable event, and the
-- variability is computed server-side from p_meta, never taken as a raw XP
-- value — a caller can only ever get 25x whatever PROBLEMS number it reports
-- spending, same math the vault UI shows before you confirm.
--
-- No cooldown, no daily cap: the natural limit is the PROBLEMS balance
-- itself (you can't redeem what you don't have — the terminal's own debit
-- enforces that before this ever runs).
-- ============================================================================

create or replace function public.troll_award_xp_internal(
  p_uid    uuid,
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
  v_xp             integer;
  v_cooldown       interval;
  v_daily_cap      integer;
  v_lifetime_cap   integer := null;
  v_last           timestamptz;
  v_today          integer;
  v_ever           integer;
  v_new_xp         integer;
  v_new_level      integer;
  v_streak         integer;
  v_last_day       date;
  v_prev_streak    integer;
  v_had_xp_ever    boolean;
  v_granted_tag    text := null;
  v_problems_spent integer;
begin
  if p_uid is null then
    raise exception 'Invalid user.';
  end if;

  -- Allowlist: event → (xp, cooldown, max awards per day[, lifetime cap])
  case p_event
    when 'daily_login'        then v_xp := 20;  v_cooldown := interval '20 hours';  v_daily_cap := 1;
    when 'chat_post'          then v_xp := 3;   v_cooldown := interval '2 minutes'; v_daily_cap := 20;
    when 'game_run'           then v_xp := 5;   v_cooldown := interval '30 seconds'; v_daily_cap := 60;
    when 'high_score'         then v_xp := 20;  v_cooldown := interval '30 seconds'; v_daily_cap := 20;
    when 'feedback_post'      then v_xp := 100; v_cooldown := interval '6 hours';   v_daily_cap := 2;
    when 'login_streak'       then v_cooldown := interval '20 hours'; v_daily_cap := 1; -- v_xp computed below
    when 'profile_avatar'     then v_xp := 50;  v_cooldown := interval '1 second';  v_daily_cap := 1; v_lifetime_cap := 1;
    when 'profile_bio'        then v_xp := 15;  v_cooldown := interval '1 second';  v_daily_cap := 1; v_lifetime_cap := 1;
    when 'profile_email'      then v_xp := 25;  v_cooldown := interval '1 second';  v_daily_cap := 1; v_lifetime_cap := 1;
    when 'game_first_daily'   then v_xp := 15;  v_cooldown := interval '20 hours'; v_daily_cap := 1;
    when 'boss_kill'          then v_xp := 50;  v_cooldown := interval '30 seconds'; v_daily_cap := 3;
    when 'versus_match'       then v_xp := 10;  v_cooldown := interval '20 seconds'; v_daily_cap := 10;
    when 'terminal_session'   then v_xp := 5;   v_cooldown := interval '0 seconds'; v_daily_cap := 100000;
    when 'undervoice_session' then v_xp := 13;  v_cooldown := interval '20 hours'; v_daily_cap := 1;
    -- Variable event: XP is 25x whatever PROBLEMS amount the terminal
    -- reports in p_meta.problemsSpent, recomputed here rather than trusted
    -- from any XP figure the caller might send. No cooldown/cap — the
    -- terminal's own wallet debit is what actually limits how often/how
    -- much can be redeemed.
    when 'problems_redeemed' then
      v_problems_spent := (p_meta->>'problemsSpent')::integer;
      if v_problems_spent is null or v_problems_spent <= 0 then
        raise exception 'problems_redeemed requires a positive problemsSpent in metadata';
      end if;
      v_xp := v_problems_spent * 25;
      v_cooldown := interval '0 seconds';
      v_daily_cap := 100000;
    else raise exception 'Unknown XP event: %', p_event;
  end case;

  select max(created_at) into v_last
    from troll_xp_events
   where user_id = p_uid and event_type = p_event;

  if v_last is not null and now() - v_last < v_cooldown then
    return jsonb_build_object('awarded', 0, 'reason', 'cooldown');
  end if;

  select count(*) into v_today
    from troll_xp_events
   where user_id = p_uid and event_type = p_event
     and created_at > now() - interval '24 hours';

  if v_today >= v_daily_cap then
    return jsonb_build_object('awarded', 0, 'reason', 'daily_cap');
  end if;

  if v_lifetime_cap is not null then
    select count(*) into v_ever
      from troll_xp_events
     where user_id = p_uid and event_type = p_event;
    if v_ever >= v_lifetime_cap then
      return jsonb_build_object('awarded', 0, 'reason', 'lifetime_cap');
    end if;
  end if;

  -- Snapshot "has this account earned XP before, of any type" before we
  -- insert this event -- that's what makes this award the first one ever.
  select exists(select 1 from troll_xp_events where user_id = p_uid) into v_had_xp_ever;

  -- Streak length is computed here, server-side, from history -- the
  -- caller only ever says "login_streak" happened, never how long.
  if p_event = 'login_streak' then
    with days as (
      select distinct (created_at at time zone 'utc')::date as d
        from troll_xp_events
       where user_id = p_uid and event_type in ('login_streak', 'daily_login')
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
    p_uid, p_event, v_xp, p_source,
    coalesce(p_meta, '{}'::jsonb) ||
      case when p_event = 'login_streak' then jsonb_build_object('streakDay', v_streak) else '{}'::jsonb end
  );

  update troll_profiles
     set xp = xp + v_xp,
         level = troll_level_for_xp(xp + v_xp),
         updated_at = now()
   where id = p_uid
   returning xp, level into v_new_xp, v_new_level;

  -- First XP ever + doesn't already have the Member tag + the tag def
  -- actually exists (admin-created) -> grant it here, same as
  -- troll_admin_set_profile_tags would, since this function already runs
  -- with owner privileges.
  if not v_had_xp_ever and exists(select 1 from troll_tag_defs where slug = 'member') then
    update troll_profiles
       set tags = array_append(tags, 'member')
     where id = p_uid
       and not ('member' = any(tags));
    if found then
      v_granted_tag := 'member';
    end if;
  end if;

  return jsonb_build_object(
    'awarded', v_xp, 'xp', v_new_xp, 'level', v_new_level, 'streakDay', v_streak,
    'newTag', v_granted_tag
  );
end;
$$;

revoke all on function public.troll_award_xp_internal(uuid, text, text, jsonb) from public, anon, authenticated;
