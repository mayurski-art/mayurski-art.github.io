-- ============================================================
-- TROLLRUNNER PASSWORD RECOVERY — run once in the Supabase SQL
-- editor (after troll_accounts.sql).
--
-- Accounts that add a real email use it as their auth email so
-- Supabase's built-in reset-link flow works. Username login must
-- then resolve username -> auth email. This function does that
-- WITHOUT leaking emails: it only answers when the caller already
-- knows the account password (verified against the stored hash).
--
-- Also required, in the dashboard (Authentication settings):
--   1. URL Configuration -> Site URL: https://www.trollrunner.net
--      Redirect URLs: add https://www.trollrunner.net/*
--   2. Email -> keep "Confirm email" OFF (unchanged requirement).
--   3. Email -> turn "Secure email change" OFF, so adding a
--      recovery email only needs one confirmation click (the old
--      synthetic mailbox can never receive mail).
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

create or replace function public.troll_login_email(p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text;
begin
  -- Small fixed delay: keeps this endpoint useless for fast brute-forcing
  -- (GoTrue's own login rate limits still apply to the real sign-in).
  perform pg_sleep(0.25);

  select u.email into v_email
  from auth.users u
  join public.troll_profiles p on p.id = u.id
  where p.username_lower = lower(trim(p_username))
    and u.encrypted_password is not null
    and u.encrypted_password = extensions.crypt(p_password, u.encrypted_password)
  limit 1;

  return v_email; -- null unless the password matched
end;
$$;

revoke all on function public.troll_login_email(text, text) from public;
grant execute on function public.troll_login_email(text, text) to anon, authenticated;
