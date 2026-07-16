-- ============================================================================
-- TROLLRUNNER ACCOUNTS — real auth, profiles, XP, game stats, leaderboards,
-- and crypto-spend tracking. Run ONCE in Supabase → SQL Editor.
-- ============================================================================
-- BEFORE RUNNING, one dashboard setting:
--   Authentication → Sign In / Up → Email → turn OFF "Confirm email".
--   (Accounts sign in with a synthetic username-based email like
--    u_trollrunner@login.trollrunner.net — there is no inbox to confirm.
--    A user's real email, if they give one, is stored privately in
--    troll_user_settings for future password-reset support.)
--
-- Everything here is idempotent — safe to re-run.
--
-- SECURITY MODEL
--   * Passwords: hashed by Supabase Auth (bcrypt). Never touch this repo.
--   * Sessions: Supabase JWTs. localStorage tampering cannot mint a valid
--     token, so the backend can never be fooled by a fake frontend login.
--   * Row Level Security on every table. XP/levels/scores can only change
--     through SECURITY DEFINER functions with server-side cooldowns/caps —
--     the client cannot write xp, level, or leaderboard rows directly.
--   * Crypto: clients may only INSERT 'pending' transaction rows. Nothing
--     client-side can mark a transaction confirmed; that is reserved for a
--     future Edge Function / service-role verifier (see docs/ACCOUNTS.md).
-- ----------------------------------------------------------------------------

-- ============================================================
-- 1. PROFILES (public identity: username, avatar, level)
-- ============================================================
create table if not exists public.troll_profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  username       text not null
                   constraint troll_profiles_username_format
                   check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  username_lower text generated always as (lower(username)) stored,
  avatar_url     text,
  bio            text not null default '',
  level          integer not null default 1,
  xp             integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists troll_profiles_username_lower_idx
  on public.troll_profiles (username_lower);

alter table public.troll_profiles enable row level security;

-- Everyone can see public identities (needed for chat, leaderboards).
drop policy if exists troll_profiles_read on public.troll_profiles;
create policy troll_profiles_read on public.troll_profiles
  for select to anon, authenticated using (true);

-- Owners may edit their own row…
drop policy if exists troll_profiles_update on public.troll_profiles;
create policy troll_profiles_update on public.troll_profiles
  for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- …but only these columns. xp / level are NOT writable by clients:
revoke all on public.troll_profiles from anon, authenticated;
grant select on public.troll_profiles to anon, authenticated;
grant update (username, avatar_url, bio) on public.troll_profiles to authenticated;

-- ============================================================
-- 2. PRIVATE SETTINGS (real email, preferences — owner-only)
-- ============================================================
create table if not exists public.troll_user_settings (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  contact_email text,
  notifications jsonb not null default '{}'::jsonb,
  privacy       jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

alter table public.troll_user_settings enable row level security;

drop policy if exists troll_user_settings_read on public.troll_user_settings;
create policy troll_user_settings_read on public.troll_user_settings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists troll_user_settings_update on public.troll_user_settings;
create policy troll_user_settings_update on public.troll_user_settings
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.troll_user_settings from anon, authenticated;
grant select on public.troll_user_settings to authenticated;
grant update (contact_email, notifications, privacy) on public.troll_user_settings to authenticated;

-- ============================================================
-- 3. NEW-USER TRIGGER (creates profile + settings at signup)
-- ============================================================
create or replace function public.troll_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := coalesce(nullif(new.raw_user_meta_data->>'username', ''),
                              'troll_' || substr(replace(new.id::text, '-', ''), 1, 8));
begin
  insert into public.troll_profiles (id, username)
  values (new.id, v_username);

  insert into public.troll_user_settings (user_id, contact_email)
  values (new.id, nullif(new.raw_user_meta_data->>'contact_email', ''));

  return new;
exception
  when unique_violation then
    raise exception 'Username "%" is already taken.', v_username;
end;
$$;

drop trigger if exists troll_on_auth_user_created on auth.users;
create trigger troll_on_auth_user_created
  after insert on auth.users
  for each row execute function public.troll_handle_new_user();

-- ============================================================
-- 4. XP EVENTS + LEVELS (server-side rules, cooldowns, caps)
-- ============================================================
create table if not exists public.troll_xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  xp         integer not null,
  source     text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists troll_xp_events_user_type_idx
  on public.troll_xp_events (user_id, event_type, created_at desc);

alter table public.troll_xp_events enable row level security;

drop policy if exists troll_xp_events_read on public.troll_xp_events;
create policy troll_xp_events_read on public.troll_xp_events
  for select to authenticated using (auth.uid() = user_id);

-- No insert/update grants: XP only enters through troll_award_xp below.
revoke all on public.troll_xp_events from anon, authenticated;
grant select on public.troll_xp_events to authenticated;

-- Level curve: level = floor(sqrt(xp / 50)) + 1
-- (L2 at 50 XP, L3 at 200, L4 at 450, L5 at 800, L10 at 4050…)
create or replace function public.troll_level_for_xp(p_xp integer)
returns integer
language sql immutable
as $$ select floor(sqrt(greatest(p_xp, 0) / 50.0))::integer + 1 $$;

-- The ONLY door into XP. Rules live server-side so idle time, refresh spam,
-- and bot loops earn nothing: every event type has a cooldown + daily cap.
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
  v_uid        uuid := auth.uid();
  v_xp         integer;
  v_cooldown   interval;
  v_daily_cap  integer;
  v_last       timestamptz;
  v_today      integer;
  v_new_xp     integer;
  v_new_level  integer;
begin
  if v_uid is null then
    raise exception 'Login required.';
  end if;

  -- Allowlist: event → (xp, cooldown, max awards per day)
  case p_event
    when 'daily_login'   then v_xp := 10; v_cooldown := interval '20 hours';  v_daily_cap := 1;
    when 'chat_post'     then v_xp := 2;  v_cooldown := interval '2 minutes'; v_daily_cap := 20;
    when 'game_run'      then v_xp := 5;  v_cooldown := interval '30 seconds'; v_daily_cap := 60;
    when 'high_score'    then v_xp := 20; v_cooldown := interval '30 seconds'; v_daily_cap := 20;
    when 'feedback_post' then v_xp := 5;  v_cooldown := interval '6 hours';   v_daily_cap := 2;
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

  insert into troll_xp_events (user_id, event_type, xp, source, metadata)
  values (v_uid, p_event, v_xp, p_source, coalesce(p_meta, '{}'::jsonb));

  update troll_profiles
     set xp = xp + v_xp,
         level = troll_level_for_xp(xp + v_xp),
         updated_at = now()
   where id = v_uid
   returning xp, level into v_new_xp, v_new_level;

  return jsonb_build_object('awarded', v_xp, 'xp', v_new_xp, 'level', v_new_level);
end;
$$;

revoke all on function public.troll_award_xp(text, text, jsonb) from public, anon;
grant execute on function public.troll_award_xp(text, text, jsonb) to authenticated;

-- ============================================================
-- 5. GAME STATS + LEADERBOARD (write-only via RPC, sanity caps)
-- ============================================================
create table if not exists public.troll_game_config (
  game_id        text primary key,
  max_score      numeric not null default 10000000,
  min_interval_s integer not null default 15
);

insert into public.troll_game_config (game_id, max_score, min_interval_s)
values ('*', 10000000, 15)
on conflict (game_id) do nothing;

alter table public.troll_game_config enable row level security;
drop policy if exists troll_game_config_read on public.troll_game_config;
create policy troll_game_config_read on public.troll_game_config
  for select to anon, authenticated using (true);
revoke all on public.troll_game_config from anon, authenticated;
grant select on public.troll_game_config to anon, authenticated;

create table if not exists public.troll_game_stats (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  game_id      text not null,
  games_played integer not null default 0,
  high_score   numeric not null default 0,
  last_meta    jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  unique (user_id, game_id)
);

alter table public.troll_game_stats enable row level security;
drop policy if exists troll_game_stats_read on public.troll_game_stats;
create policy troll_game_stats_read on public.troll_game_stats
  for select to anon, authenticated using (true);
revoke all on public.troll_game_stats from anon, authenticated;
grant select on public.troll_game_stats to anon, authenticated;

create table if not exists public.troll_leaderboard (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  game_id     text not null,
  score       numeric not null,
  meta        jsonb not null default '{}'::jsonb,
  achieved_at timestamptz not null default now()
);

create index if not exists troll_leaderboard_game_score_idx
  on public.troll_leaderboard (game_id, score desc);
create index if not exists troll_leaderboard_user_idx
  on public.troll_leaderboard (user_id, game_id, achieved_at desc);

alter table public.troll_leaderboard enable row level security;
drop policy if exists troll_leaderboard_read on public.troll_leaderboard;
create policy troll_leaderboard_read on public.troll_leaderboard
  for select to anon, authenticated using (true);
revoke all on public.troll_leaderboard from anon, authenticated;
grant select on public.troll_leaderboard to anon, authenticated;

-- Leaderboard rows joined with live username/avatar/level, so entries follow
-- profile edits automatically.
create or replace view public.troll_leaderboard_view
with (security_invoker = on)
as
select l.id, l.game_id, l.score, l.meta, l.achieved_at,
       p.id as user_id, p.username, p.avatar_url, p.level
  from public.troll_leaderboard l
  join public.troll_profiles p on p.id = l.user_id;

grant select on public.troll_leaderboard_view to anon, authenticated;

-- The ONLY door into game stats + the leaderboard. Server-side it:
--   * requires login            * clamps scores to the game's max
--   * rate-limits submissions   * awards run/high-score XP with caps
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
  v_uid       uuid := auth.uid();
  v_cfg       troll_game_config%rowtype;
  v_last      timestamptz;
  v_prev_high numeric;
  v_stats     troll_game_stats%rowtype;
  v_new_high  boolean := false;
  v_xp        jsonb;
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

-- ============================================================
-- 6. CRYPTO SPEND / DONATION TRACKING (USDC + $TROLL)
-- ============================================================
-- Clients may only file a PENDING claim with the tx signature. Confirmation
-- is reserved for a service-role verifier (Edge Function) that checks the
-- signature on-chain — the frontend can never fake a confirmed payment.
create table if not exists public.troll_transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  token          text not null check (token in ('USDC', 'TROLL')),
  amount         numeric not null check (amount > 0),
  wallet_address text,
  tx_signature   text unique,
  status         text not null default 'pending'
                   check (status in ('pending', 'confirmed', 'rejected')),
  purpose        text,
  feature        text,
  created_at     timestamptz not null default now(),
  confirmed_at   timestamptz
);

create index if not exists troll_transactions_user_idx
  on public.troll_transactions (user_id, created_at desc);

alter table public.troll_transactions enable row level security;

drop policy if exists troll_transactions_read on public.troll_transactions;
create policy troll_transactions_read on public.troll_transactions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists troll_transactions_insert on public.troll_transactions;
create policy troll_transactions_insert on public.troll_transactions
  for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');

revoke all on public.troll_transactions from anon, authenticated;
grant select on public.troll_transactions to authenticated;
grant insert (user_id, token, amount, wallet_address, tx_signature, purpose, feature)
  on public.troll_transactions to authenticated;

-- ============================================================
-- 7. TROLLCHAT ← ACCOUNT IDENTITY (no impersonation)
-- ============================================================
alter table public.troll_chat
  add column if not exists user_id uuid references auth.users (id) on delete set null;

-- Guests can still post, but cannot claim a registered username and cannot
-- attach a user_id. Drawings ('draw:data:image/png;base64,…' bodies) get a
-- bigger cap — 32 KB, matching DRAW_MAX in assets/js/troll-chat-extras.js
-- (kept in sync with troll_chat_v2.sql).
drop policy if exists troll_chat_insert on public.troll_chat;
create policy troll_chat_insert
  on public.troll_chat
  for insert
  to anon
  with check (
    char_length(name) <= 24
    and user_id is null
    and not exists (
      select 1 from public.troll_profiles p
      where p.username_lower = lower(troll_chat.name)
    )
    and (
      char_length(body) between 1 and 240
      or (
        body like 'draw:data:image/png;base64,%'
        and char_length(body) between 30 and 32000
      )
    )
  );

-- Logged-in posts must carry the poster's own user_id and current username.
drop policy if exists troll_chat_insert_auth on public.troll_chat;
create policy troll_chat_insert_auth
  on public.troll_chat
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and name = (select username from public.troll_profiles where id = auth.uid())
    and (
      char_length(body) between 1 and 240
      or (
        body like 'draw:data:image/png;base64,%'
        and char_length(body) between 30 and 32000
      )
    )
  );

drop policy if exists troll_chat_read_auth on public.troll_chat;
create policy troll_chat_read_auth
  on public.troll_chat
  for select
  to authenticated
  using (true);

-- ============================================================
-- 8. AVATAR STORAGE (public read, owner-only write, 2 MB cap)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
