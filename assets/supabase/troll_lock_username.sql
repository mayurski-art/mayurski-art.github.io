-- ============================================================================
-- LOCK USERNAME — usernames are permanent once an account is created.
-- Revokes client write access to the username column and adds a trigger
-- that blocks any change to it outright, so no client bug or future code
-- path can ever rename an account. Run ONCE in Supabase → SQL Editor
-- (idempotent — safe to re-run).
-- ============================================================================

revoke update (username) on public.troll_profiles from authenticated;

create or replace function public.troll_lock_username()
returns trigger
language plpgsql
as $$
begin
  if new.username <> old.username then
    raise exception 'Usernames cannot be changed after account creation.';
  end if;
  return new;
end;
$$;

drop trigger if exists troll_profiles_lock_username on public.troll_profiles;
create trigger troll_profiles_lock_username
  before update on public.troll_profiles
  for each row execute function public.troll_lock_username();
