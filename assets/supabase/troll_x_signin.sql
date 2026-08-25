-- ============================================================================
-- X (TWITTER) SIGN-IN — lets a brand-new visitor create a trollrunner.net
-- account just by connecting X, no username/password step. Run ONCE in
-- Supabase → SQL Editor, AFTER troll_accounts.sql and troll_lock_username.sql
-- (idempotent — safe to re-run, and safe even if troll_lock_username.sql was
-- never run).
--
-- What this adds:
--   * troll_profiles.username_change_available — true only on accounts that
--     were auto-created from an X sign-in, so the person can pick a better
--     name than their raw X handle exactly once. Everyone else keeps the
--     existing permanent-username behavior untouched.
--   * troll_handle_new_user() now tries the X handle first (when the new
--     auth.users row came from the X provider), falling back to name+number
--     suffixes on collision, then to the random troll_xxxxxxxx id like today.
--   * A single combined username-lock trigger replaces
--     troll_profiles_lock_username from troll_lock_username.sql: it still
--     blocks every rename UNLESS username_change_available is true, in which
--     case it allows exactly one change and then flips the flag off.
-- ============================================================================

alter table public.troll_profiles
  add column if not exists username_change_available boolean not null default false;

-- Client needs write access to change it once; the trigger below is the
-- actual enforcement (one shot, format/uniqueness still checked by the
-- existing column check + unique index).
grant update (username) on public.troll_profiles to authenticated;

create or replace function public.troll_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta_username text := nullif(new.raw_user_meta_data->>'username', '');
  v_x_handle text := nullif(new.raw_user_meta_data->>'user_name', '');
  v_from_x boolean := coalesce(new.raw_app_meta_data->>'provider', '') = 'x'
                      or (new.raw_app_meta_data->'providers') ? 'x';
  v_candidate text;
  v_username text;
  v_i int := 0;
  v_change_available boolean := false;
begin
  if v_meta_username is not null then
    v_username := v_meta_username;
  elsif v_from_x and v_x_handle is not null then
    -- Sanitize the X handle down to what troll_profiles allows, then try it
    -- as-is, then with _2, _3, … suffixes before giving up on the handle.
    v_candidate := regexp_replace(v_x_handle, '[^A-Za-z0-9_]', '', 'g');
    v_candidate := left(v_candidate, 20);
    if length(v_candidate) < 3 then
      v_candidate := rpad(v_candidate, 3, '0');
    end if;
    v_username := v_candidate;
    while exists (select 1 from public.troll_profiles where username_lower = lower(v_username)) loop
      v_i := v_i + 1;
      exit when v_i > 50; -- give up on the handle, fall through to random id
      v_username := left(v_candidate, 20 - length(v_i::text) - 1) || '_' || v_i;
    end loop;
    if v_i > 50 then
      v_username := null;
    else
      v_change_available := true; -- X-created: one free rename
    end if;
  end if;

  if v_username is null then
    v_username := 'troll_' || substr(replace(new.id::text, '-', ''), 1, 8);
    if v_from_x then v_change_available := true; end if;
  end if;

  insert into public.troll_profiles (id, username, username_change_available)
  values (new.id, v_username, v_change_available);

  insert into public.troll_user_settings (user_id, contact_email)
  values (new.id, nullif(new.raw_user_meta_data->>'contact_email', ''));

  return new;
exception
  when unique_violation then
    raise exception 'Username "%" is already taken.', v_username;
end;
$$;

-- Supersedes troll_profiles_lock_username from troll_lock_username.sql.
drop trigger if exists troll_profiles_lock_username on public.troll_profiles;

create or replace function public.troll_lock_username()
returns trigger
language plpgsql
as $$
begin
  if new.username <> old.username then
    if not old.username_change_available then
      raise exception 'Usernames cannot be changed after account creation.';
    end if;
    new.username_change_available := false;
  end if;
  return new;
end;
$$;

drop trigger if exists troll_profiles_lock_username_once on public.troll_profiles;
create trigger troll_profiles_lock_username_once
  before update on public.troll_profiles
  for each row execute function public.troll_lock_username();
