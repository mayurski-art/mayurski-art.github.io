-- ============================================================================
-- TROLLRUNNER TERMINAL XP — lets terminal.trollrunner.net (a separate
-- Next.js/Vercel app, see trollrunner-terminal repo) award real XP through
-- the same server-authoritative rules as everything else. Run ONCE in
-- Supabase → SQL Editor, AFTER troll_xp_expansion.sql. Idempotent.
--
-- WHY A SEPARATE SERVICE-ROLE ENTRY POINT
--   troll_award_xp() (see troll_xp_expansion.sql) relies on auth.uid() to
--   know who to credit — that only resolves when the caller is the actual
--   user's own authenticated Postgrest session (anon key + their JWT).
--   The terminal's chat API route (app/api/chat/route.ts) already verifies
--   the caller's identity itself via supabase.auth.getUser(token) using its
--   SERVICE ROLE key, then writes wallet/chat rows directly — under that
--   client, auth.uid() is null, so it can't call troll_award_xp() as-is.
--
--   Rather than duplicate the whole allowlist/cooldown/cap logic, the shared
--   rules now live in troll_award_xp_internal(), and both entry points
--   forward into it:
--     - troll_award_xp(event, source, meta)            — unchanged public
--       signature, still resolves the caller from auth.uid() (anon/authed).
--     - troll_award_xp_service(user_id, event, source, meta) — NEW, takes
--       an explicit user id, granted ONLY to service_role. A browser can
--       never call this even with the anon key — Supabase's PostgREST layer
--       only exposes anon/authenticated grants over HTTP, so this one is
--       reachable exclusively from a trusted backend holding the service
--       role key (i.e. the terminal's own server, never client JS).
--
-- New allowlist entry: terminal_session — +10 XP, once per ~day, awarded
-- from the terminal's chat route after a successful reply.
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
  if p_uid is null then
    raise exception 'Invalid user.';
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
    when 'terminal_session' then v_xp := 10; v_cooldown := interval '20 hours'; v_daily_cap := 1;
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

  return jsonb_build_object('awarded', v_xp, 'xp', v_new_xp, 'level', v_new_level, 'streakDay', v_streak);
end;
$$;

-- Internal only — neither anon, authenticated, nor service_role should call
-- this directly; the two wrappers below are the real entry points.
revoke all on function public.troll_award_xp_internal(uuid, text, text, jsonb) from public, anon, authenticated;

-- Public entry point (unchanged signature/behavior from troll_xp_expansion.sql).
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
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;
  return troll_award_xp_internal(auth.uid(), p_event, p_source, p_meta);
end;
$$;

revoke all on function public.troll_award_xp(text, text, jsonb) from public, anon;
grant execute on function public.troll_award_xp(text, text, jsonb) to authenticated;

-- Service-role entry point for trusted backends that have already verified
-- the user's identity themselves (e.g. the terminal app's chat API route,
-- which checks the bearer token via supabase.auth.getUser() before calling
-- this). Only reachable with the service role key — never from a browser.
create or replace function public.troll_award_xp_service(
  p_user_id uuid,
  p_event   text,
  p_source  text  default null,
  p_meta    jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return troll_award_xp_internal(p_user_id, p_event, p_source, p_meta);
end;
$$;

revoke all on function public.troll_award_xp_service(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.troll_award_xp_service(uuid, text, text, jsonb) to service_role;
