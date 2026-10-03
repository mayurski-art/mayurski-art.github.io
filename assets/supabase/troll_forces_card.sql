-- Troll Forces profile card (prestige phase 4, 2026-10-03): your clan tag
-- and calling card. Run once in the Supabase SQL editor. Idempotent: safe to
-- run again.
--
-- assets/games/troll-ops/calling-cards.js keeps the same list of cards and the
-- same clan tag rules: change both together.
--
-- 2026-10-03, phase 5: the prestige reward cards (p1-p10, master), and the
-- owner (troll_runner) may wear any card. Re-run this whole file to apply.

create table if not exists public.troll_forces_card (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  clan       text not null default '' check (clan ~ '^[A-Z0-9]{0,4}$'),
  card       text not null default 'hitman' check (card ~ '^[a-z0-9-]{1,32}$'),
  updated_at timestamptz not null default now()
);

alter table public.troll_forces_card enable row level security;

-- Anyone can see anyone's card (scoreboards, profile cards). Nobody writes
-- the table directly: only troll_forces_set_card() below.
drop policy if exists "troll forces card is public" on public.troll_forces_card;
create policy "troll forces card is public"
  on public.troll_forces_card for select using (true);

grant select on public.troll_forces_card to anon, authenticated;

-- Which calling cards a player at this prestige may wear. Starters are free;
-- p1-p10 need that prestige, master needs Prestige Master (11).
create or replace function public.troll_forces_card_allowed(p_card text, p_prestige int)
returns boolean language sql immutable as $$
  select p_card = any (array['hitman', 'blade', 'overcharge', 'main-event', 'ambush', 'brute'])
      or (p_card ~ '^p([1-9]|10)$' and coalesce(p_prestige, 0) >= substring(p_card from 2)::int)
      or (p_card = 'master' and coalesce(p_prestige, 0) >= 11);
$$;

create or replace function public.troll_forces_set_card(p_clan text, p_card text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_clan text := upper(btrim(coalesce(p_clan, '')));
  v_card text := lower(btrim(coalesce(p_card, '')));
  v_prestige int;
begin
  if uid is null then raise exception 'Sign in to set your card.'; end if;
  if v_clan !~ '^[A-Z0-9]{0,4}$' then raise exception 'Clan tags are up to 4 letters or numbers.'; end if;
  if v_clan ~ '(NIG|FAG|KKK|NAZI|HTLR|CUNT|RAPE)' then raise exception 'Pick another clan tag.'; end if;

  select coalesce(prestige, 0) into v_prestige from public.troll_forces_prestige where user_id = uid;
  -- The owner never prestiges but has every unlock, now and later.
  if exists (select 1 from public.troll_profiles where id = uid and lower(username) = 'troll_runner') then
    v_prestige := 11;
  end if;
  if not public.troll_forces_card_allowed(v_card, coalesce(v_prestige, 0)) then
    raise exception 'That calling card is locked.';
  end if;

  insert into public.troll_forces_card (user_id, clan, card, updated_at)
  values (uid, v_clan, v_card, now())
  on conflict (user_id) do update set clan = excluded.clan, card = excluded.card, updated_at = now();

  return json_build_object('clan', v_clan, 'card', v_card);
end;
$$;

revoke all on function public.troll_forces_set_card(text, text) from public, anon;
grant execute on function public.troll_forces_set_card(text, text) to authenticated;
