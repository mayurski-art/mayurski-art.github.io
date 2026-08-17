-- ============================================================================
-- PROFILE BANNER — a wide image behind the avatar on profile cards, picked
-- from a fixed built-in set (assets/images/banners/, catalog lives in
-- BANNER_DEFS in troll-accounts.js). Not an upload -- just a key into that
-- catalog, same self-serve pattern as bio (see troll_accounts.sql's
-- updateBio: plain column, plain client update, no RPC).
-- Run ONCE in Supabase -> SQL Editor, AFTER troll_accounts.sql. Idempotent.
-- ============================================================================

alter table public.troll_profiles
  add column if not exists banner_key text;

-- Keep it to short slugs (e.g. 'banner-01') -- this is never rendered as
-- HTML, only looked up in a static JS array, but a length/charset check
-- keeps the column honest and cheap to index if that's ever needed.
alter table public.troll_profiles
  drop constraint if exists troll_profiles_banner_key_check;
alter table public.troll_profiles
  add constraint troll_profiles_banner_key_check
  check (banner_key is null or banner_key ~ '^[a-z0-9-]{1,40}$');

grant update (banner_key) on public.troll_profiles to authenticated;

-- Reads need nothing new: troll_profiles already grants SELECT to anon and
-- authenticated with a `using (true)` policy, so the new column is public.
