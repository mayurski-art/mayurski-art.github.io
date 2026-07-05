-- ============================================================================
-- TROLLRUNNER ADMIN LOCKDOWN — real Supabase Auth admin identity + RLS.
-- Run ONCE in Supabase → SQL Editor. Idempotent — safe to re-run.
--
-- PROBLEM THIS FIXES
--   Every write to `site_updates` (site lock, live-status toggles, notis
--   broadcasts, homepage update posts) went through the public anon key with
--   no RLS restriction. The admin password only gated the admin.html *UI* —
--   anyone who copied the anon key out of the public JS could write directly
--   to Supabase via curl/devtools, bypassing the password entirely.
--
-- THE FIX
--   1. A real Supabase Auth "admin" user (you create this yourself — see
--      bottom of this file — your password never has to pass through an AI
--      session or chat log).
--   2. `troll_admins` — a table of which auth.users.id are admins.
--   3. `troll_is_admin()` — a SECURITY DEFINER helper any function can check.
--   4. Direct table writes to `site_updates` are now fully revoked from
--      anon/authenticated. ALL writes must go through one of these
--      SECURITY DEFINER functions:
--        - troll_admin_replace_site_row  → admin-only, full-row replace
--          (site lock, live status, notis broadcasts, update posts — this
--          mirrors exactly what admin.html/site-lock.js/troll-notis.js
--          already send, just gated server-side now instead of trusting the
--          client).
--        - troll_submit_feedback         → anon-callable, touches ONLY the
--          feedback meta key, with server-side length/topic validation.
--        - troll_record_view             → anon-callable, touches ONLY the
--          view-analytics meta key, with size caps.
--        - troll_write_live_chat         → anon-callable, touches ONLY the
--          live-chat presence meta key, with a payload size cap.
--   Public SELECT on site_updates is unchanged (every visitor's homepage
--   needs to read it).
-- ----------------------------------------------------------------------------

-- ============================================================
-- 1. ADMIN IDENTITY
-- ============================================================
create table if not exists public.troll_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.troll_admins enable row level security;

drop policy if exists troll_admins_self_read on public.troll_admins;
create policy troll_admins_self_read on public.troll_admins
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.troll_admins from anon, authenticated;
grant select on public.troll_admins to authenticated;

create or replace function public.troll_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.troll_admins where user_id = auth.uid());
$$;

revoke all on function public.troll_is_admin() from public;
grant execute on function public.troll_is_admin() to anon, authenticated;

-- ============================================================
-- 2. LOCK DOWN site_updates — drop whatever anon-open policies exist today
--    (names unknown since the table predates this migration), then rebuild
--    with public-read-only at the table-privilege level.
-- ============================================================
alter table public.site_updates enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'site_updates'
  loop
    execute format('drop policy if exists %I on public.site_updates', pol.policyname);
  end loop;
end $$;

create policy site_updates_public_read on public.site_updates
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.site_updates from anon, authenticated;
grant select on public.site_updates to anon, authenticated;

-- ============================================================
-- 3. ADMIN-ONLY: full-row replace (site lock / live status / notis / posts)
-- ============================================================
create or replace function public.troll_admin_replace_site_row(
  p_updates jsonb,
  p_live_status_enabled boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_id text := 'main';
begin
  if not troll_is_admin() then
    raise exception 'Admin session required.';
  end if;
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    raise exception 'p_updates must be a JSON array.';
  end if;

  insert into public.site_updates as su (id, updates, live_status_enabled, updated_at)
  values (v_row_id, p_updates, coalesce(p_live_status_enabled, false), now())
  on conflict (id) do update
     set updates = excluded.updates,
         live_status_enabled = coalesce(p_live_status_enabled, su.live_status_enabled),
         updated_at = now();

  return jsonb_build_object('saved', true);
end;
$$;

revoke all on function public.troll_admin_replace_site_row(jsonb, boolean) from public, anon;
grant execute on function public.troll_admin_replace_site_row(jsonb, boolean) to authenticated;

-- ============================================================
-- 4. ANON-CALLABLE, SCOPED: feedback submission (touches ONLY the
--    feedback meta key, never site lock / notis / content)
-- ============================================================
create or replace function public.troll_submit_feedback(
  p_message          text,
  p_username         text default null,
  p_include_username boolean default false,
  p_topic            text default 'general',
  p_priority         text default 'normal'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_id    text := 'main';
  v_updates   jsonb;
  v_meta      jsonb;
  v_feedback  jsonb;
  v_message   text := btrim(coalesce(p_message, ''));
  v_username  text := left(btrim(coalesce(p_username, '')), 60);
  v_topic     text;
  v_priority  text;
  v_item      jsonb;
  v_now       timestamptz := now();
  v_stamp     text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if char_length(v_message) < 1 or char_length(v_message) > 2000 then
    raise exception 'Feedback message must be 1-2000 characters.';
  end if;

  v_topic := case when p_topic in ('bug', 'feature request', 'positive', 'general') then p_topic else 'general' end;
  v_priority := case when p_priority in ('high', 'normal') then p_priority else 'normal' end;

  v_item := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'rawMessage', v_message,
    'message', case when p_include_username and v_username <> ''
                 then '[Username: ' || v_username || '] ' || v_message
                 else v_message end,
    'username', v_username,
    'includeUsername', (p_include_username and v_username <> ''),
    'aiTopic', v_topic,
    'aiPriority', v_priority,
    'createdAt', v_stamp
  );

  select updates into v_updates from public.site_updates where id = v_row_id for update;
  if v_updates is null then
    v_updates := '[]'::jsonb;
    insert into public.site_updates (id, updates, updated_at) values (v_row_id, v_updates, v_now)
      on conflict (id) do nothing;
  end if;

  select elem into v_meta
    from jsonb_array_elements(v_updates) elem
   where elem->>'id' = '__trollrunner_feedback_meta__';

  if v_meta is null then
    v_meta := jsonb_build_object(
      'id', '__trollrunner_feedback_meta__',
      'title', '__feedback_meta__',
      'body', '__feedback_meta__',
      'archived', true,
      'source', 'system',
      'feedback', '[]'::jsonb
    );
  end if;

  v_feedback := coalesce(v_meta->'feedback', '[]'::jsonb) || jsonb_build_array(v_item);
  if jsonb_array_length(v_feedback) > 500 then
    select jsonb_agg(elem order by ord desc) into v_feedback
      from (
        select elem, ord
          from jsonb_array_elements(v_feedback) with ordinality as t(elem, ord)
         order by ord desc
         limit 500
      ) sub;
  end if;

  v_meta := v_meta || jsonb_build_object('feedback', v_feedback, 'createdAt', v_stamp);

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_updates
    from jsonb_array_elements(v_updates) elem
   where elem->>'id' <> '__trollrunner_feedback_meta__';
  v_updates := v_updates || jsonb_build_array(v_meta);

  update public.site_updates set updates = v_updates, updated_at = v_now where id = v_row_id;

  return jsonb_build_object('saved', true, 'topic', v_topic, 'priority', v_priority);
end;
$$;

revoke all on function public.troll_submit_feedback(text, text, boolean, text, text) from public;
grant execute on function public.troll_submit_feedback(text, text, boolean, text, text) to anon, authenticated;

-- ============================================================
-- 5. ANON-CALLABLE, SCOPED: website view analytics (touches ONLY the
--    view-analytics meta key)
-- ============================================================
create or replace function public.troll_record_view(
  p_date_key  text,
  p_viewer_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_id  text := 'main';
  v_updates jsonb;
  v_meta    jsonb;
  v_days    jsonb;
  v_day     jsonb;
  v_viewers jsonb;
  v_viewer  text := left(btrim(coalesce(p_viewer_id, '')), 80);
  v_now     timestamptz := now();
  v_stamp   text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if p_date_key !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'p_date_key must be YYYY-MM-DD.';
  end if;

  select updates into v_updates from public.site_updates where id = v_row_id for update;
  if v_updates is null then
    v_updates := '[]'::jsonb;
    insert into public.site_updates (id, updates, updated_at) values (v_row_id, v_updates, v_now)
      on conflict (id) do nothing;
  end if;

  select elem into v_meta
    from jsonb_array_elements(v_updates) elem
   where elem->>'id' = '__trollrunner_view_analytics_meta__';

  if v_meta is null then
    v_meta := jsonb_build_object(
      'id', '__trollrunner_view_analytics_meta__',
      'title', '__view_analytics_meta__',
      'body', '__view_analytics_meta__',
      'archived', true,
      'source', 'system',
      'viewAnalytics', jsonb_build_object('days', '{}'::jsonb, 'updatedAt', v_stamp)
    );
  end if;

  v_days := coalesce(v_meta->'viewAnalytics'->'days', '{}'::jsonb);
  v_day := coalesce(v_days->p_date_key, jsonb_build_object('totalViews', 0, 'viewerIds', '[]'::jsonb, 'lastSeenAt', v_stamp));

  v_viewers := coalesce(v_day->'viewerIds', '[]'::jsonb);
  if v_viewer <> '' and not (v_viewers @> to_jsonb(v_viewer)) then
    v_viewers := v_viewers || jsonb_build_array(v_viewer);
  end if;
  if jsonb_array_length(v_viewers) > 5000 then
    select jsonb_agg(elem order by ord) into v_viewers
      from (
        select elem, ord from jsonb_array_elements(v_viewers) with ordinality as t(elem, ord)
         order by ord desc limit 5000
      ) sub;
  end if;

  v_day := jsonb_build_object(
    'totalViews', coalesce((v_day->>'totalViews')::int, 0) + 1,
    'viewerIds', v_viewers,
    'lastSeenAt', v_stamp
  );
  v_days := v_days || jsonb_build_object(p_date_key, v_day);

  -- cap total tracked days to bound row growth against abuse
  if (select count(*) from jsonb_object_keys(v_days)) > 400 then
    select jsonb_object_agg(key, value) into v_days
      from (
        select key, value from jsonb_each(v_days)
         order by key desc
         limit 400
      ) sub;
  end if;

  v_meta := v_meta || jsonb_build_object(
    'viewAnalytics', jsonb_build_object('days', v_days, 'updatedAt', v_stamp)
  );

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_updates
    from jsonb_array_elements(v_updates) elem
   where elem->>'id' <> '__trollrunner_view_analytics_meta__';
  v_updates := v_updates || jsonb_build_array(v_meta);

  update public.site_updates set updates = v_updates, updated_at = v_now where id = v_row_id;

  return jsonb_build_object('saved', true);
end;
$$;

revoke all on function public.troll_record_view(text, text) from public;
grant execute on function public.troll_record_view(text, text) to anon, authenticated;

-- ============================================================
-- 6. ANON-CALLABLE, SCOPED: live-chat presence/room cache (touches ONLY the
--    live-chat meta key). This is presence/UI cache, not chat message
--    integrity — actual message content lives in `troll_chat`, which
--    already has real RLS via troll_accounts.sql.
-- ============================================================
create or replace function public.troll_write_live_chat(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_id  text := 'main';
  v_updates jsonb;
  v_meta    jsonb;
  v_now     timestamptz := now();
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'p_payload must be a JSON object.';
  end if;
  if pg_column_size(p_payload) > 60000 then
    raise exception 'Live chat payload too large.';
  end if;

  select updates into v_updates from public.site_updates where id = v_row_id for update;
  if v_updates is null then
    v_updates := '[]'::jsonb;
    insert into public.site_updates (id, updates, updated_at) values (v_row_id, v_updates, v_now)
      on conflict (id) do nothing;
  end if;

  v_meta := jsonb_build_object(
    'id', '__trollrunner_live_chat_meta__',
    'title', '__live_chat_meta__',
    'body', '__live_chat_meta__',
    'archived', true,
    'source', 'system',
    'liveChat', p_payload
  );

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_updates
    from jsonb_array_elements(v_updates) elem
   where elem->>'id' <> '__trollrunner_live_chat_meta__';
  v_updates := v_updates || jsonb_build_array(v_meta);

  update public.site_updates set updates = v_updates, updated_at = v_now where id = v_row_id;

  return jsonb_build_object('saved', true);
end;
$$;

revoke all on function public.troll_write_live_chat(jsonb) from public;
grant execute on function public.troll_write_live_chat(jsonb) to anon, authenticated;

-- ============================================================
-- 7. ONE-TIME SETUP (do this yourself — your password never has to leave
--    your browser or touch an AI session):
--
--   a) Load any Troll Runner page in your browser, open devtools console,
--      and run:
--        TrollrunnerAdminAuth.bootstrapAdminAccount()
--      It will prompt you for a new admin password and create the real
--      Supabase Auth account (admin@login.trollrunner.net) with it. This
--      REPLACES the old password — pick a fresh one, it does not need to
--      match your old SHA-256'd admin password.
--
--   b) Back here in the SQL editor, run this once to grant that account
--      admin rights (no UUID copy-pasting needed):
--        insert into public.troll_admins (user_id)
--        select id from auth.users where email = 'admin@login.trollrunner.net'
--        on conflict (user_id) do nothing;
--
--   c) Log in via the normal "Admin" button/prompt with your new password.
--      Everything else (admin.html, site lock, notis, feedback, analytics,
--      live chat) keeps working exactly as before — it's now enforced
--      server-side instead of trusted client-side.
-- ============================================================
