-- 2026-09-30: the daily login bonus, once a day per ACCOUNT, and troll_runner
-- set back to level 69 after the Troll Forces XP cut.
--
-- Run in the Supabase SQL editor (project tjsyhfplxjtakdfkpdtg). Idempotent
-- apart from part 2, which is a one-off.

-- ---- 1. One login bonus per account per UTC day --------------------------
-- troll_award_xp checks "no login_streak in the last 20 hours" and then
-- inserts, with nothing stopping two requests from both passing the check
-- first. Every page that loads troll-accounts.js (and every game iframe)
-- asks on load, and logging in asks too, so one phone page load could be paid
-- more than once. This index makes the second insert fail, whatever device
-- or tab it comes from, and the failed call rolls back its XP with it.
-- Only rows from 2026-10-01 are covered, so history that already has doubles
-- doesn't block the index.
create unique index if not exists troll_xp_events_login_once_a_day
  on public.troll_xp_events (user_id, ((created_at at time zone 'utc')::date))
  where event_type = 'login_streak' and created_at >= '2026-10-01 00:00:00+00';

-- ---- 2. troll_runner -> level 69 ------------------------------------------
-- Level = floor(sqrt(xp / 50)) + 1, so level 69 starts at 50 * 68^2 = 231,200.
update public.troll_profiles
   set xp = 231200,
       level = 69,
       updated_at = now()
 where username_lower = 'troll_runner'
returning username, xp, level;
