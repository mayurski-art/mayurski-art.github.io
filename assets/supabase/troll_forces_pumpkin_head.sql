-- Troll Forces: the Pumpkin Head (2026-10-31). Run once in the Supabase SQL
-- editor. Idempotent: safe to run again.
--
-- Every account that comes into Trollnite (trollrunner.net/trollnite, once /warfare)
-- during Chapter One, 26 October to the end of 12 November 2026 (Pacific
-- time), gets the Pumpkin Head free and keeps it after. The window is
-- checked here, on the server's clock: a device clock set back can't claim
-- it after the 12th.
--
-- 1. troll_forces_grants: what an account has been given, one row per item.
--    Readable by its owner only; nobody writes it but the function below
--    and the backfill.
-- 2. troll_forces_claim_pumpkin_head(): the game calls it on every sign-in.
--    Inside the window it grants (once); outside it only answers.
-- 3. The backfill: everyone who has already been in the game since 26
--    October, from what the game wrote then (match XP, the combat record,
--    the cloud save, the profile card, prestige).

create table if not exists public.troll_forces_grants (
  user_id    uuid not null references auth.users(id) on delete cascade,
  item       text not null,
  granted_at timestamptz not null default now(),
  source     text not null default 'login',
  primary key (user_id, item)
);

alter table public.troll_forces_grants enable row level security;

drop policy if exists "troll forces grants: own rows" on public.troll_forces_grants;
create policy "troll forces grants: own rows"
  on public.troll_forces_grants for select using (auth.uid() = user_id);

grant select on public.troll_forces_grants to authenticated;

create or replace function public.troll_forces_claim_pumpkin_head()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_from  timestamptz := timestamptz '2026-10-26 00:00:00 America/Los_Angeles';
  v_until timestamptz := timestamptz '2026-11-13 00:00:00 America/Los_Angeles';
  v_at    timestamptz;
begin
  if v_uid is null then
    return json_build_object('owned', false, 'open', now() >= v_from and now() < v_until);
  end if;
  if now() >= v_from and now() < v_until then
    insert into troll_forces_grants (user_id, item, source)
    values (v_uid, 'pumpkin-head', 'login')
    on conflict (user_id, item) do nothing;
  end if;
  select granted_at into v_at from troll_forces_grants where user_id = v_uid and item = 'pumpkin-head';
  return json_build_object('owned', v_at is not null, 'granted_at', v_at, 'open', now() >= v_from and now() < v_until);
end;
$$;

revoke all on function public.troll_forces_claim_pumpkin_head() from public;
grant execute on function public.troll_forces_claim_pumpkin_head() to authenticated;

-- The backfill: the first thing each account did in the game since the
-- window opened. Only server-side times count, except the cloud save's
-- (the game stamps that one, but only its owner can write the row).
insert into public.troll_forces_grants (user_id, item, granted_at, source)
select user_id, 'pumpkin-head', min(at), 'backfill'
from (
  select user_id, created_at as at from public.troll_xp_events
   where event_type = 'troll_ops_xp' and created_at >= timestamptz '2026-10-26 00:00:00 America/Los_Angeles'
  union all
  select user_id, updated_at from public.troll_forces_record
   where updated_at >= timestamptz '2026-10-26 00:00:00 America/Los_Angeles'
  union all
  select user_id, updated_at from public.troll_forces_card
   where updated_at >= timestamptz '2026-10-26 00:00:00 America/Los_Angeles'
  union all
  select user_id, updated_at from public.troll_forces_prestige
   where updated_at >= timestamptz '2026-10-26 00:00:00 America/Los_Angeles'
  union all
  select user_id, updated_at from public.troll_game_saves
   where game_id = 'troll-forces' and updated_at >= timestamptz '2026-10-26 00:00:00 America/Los_Angeles'
) seen
where at < timestamptz '2026-11-13 00:00:00 America/Los_Angeles'
group by user_id
on conflict (user_id, item) do nothing;
