-- Trollnite (Troll Forces) prestige to 69 (2026-11-01). Run once in the
-- Supabase SQL editor, AFTER troll_forces_prestige.sql and
-- troll_forces_card.sql. Idempotent: safe to run again.
--
-- Prestige is now automatic at level 69 and goes all the way to Prestige
-- Master at 69 (user: "lvl 69 -> prestige one, level [1] -> prestige one,
-- level 69 -> prestige two, etc. all the way until prestige master which is
-- prestige 69"). Until this runs the server refuses a prestige past 11 and
-- the game just holds the player at level 69 (no retries, no errors).
--
-- 1. the prestige column: 0..69 (was 0..11)
-- 2. troll_forces_prestige_up(): Prestige Master is 69 (was 11)
-- 3. calling cards: the Prestige Master card needs 69 (was 11), and the
--    owner counts as 69 (calling-cards.js CARDS, master: prestige 69)

-- 1. the cap on the column. The check constraint was created inline, so find
-- it by what it checks rather than trusting its generated name.
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
     where con.conrelid = 'public.troll_forces_prestige'::regclass
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%prestige%'
  loop
    execute format('alter table public.troll_forces_prestige drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.troll_forces_prestige
  add constraint troll_forces_prestige_prestige_check check (prestige between 0 and 69);

-- 2. prestige up: same checks, Master at 69
create or replace function public.troll_forces_prestige_up()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  acc_xp bigint;
  cur public.troll_forces_prestige;
begin
  if uid is null then raise exception 'Sign in to prestige.'; end if;

  select coalesce(xp, 0)::bigint into acc_xp from public.troll_profiles where id = uid;
  if acc_xp is null then raise exception 'No profile.'; end if;

  insert into public.troll_forces_prestige (user_id) values (uid) on conflict (user_id) do nothing;
  select * into cur from public.troll_forces_prestige where user_id = uid for update;

  if cur.prestige >= 69 then raise exception 'Already Prestige Master.'; end if;
  if public.troll_forces_level_for_xp(acc_xp - cur.xp_base) < 69 then
    raise exception 'Reach level 69 first.';
  end if;

  update public.troll_forces_prestige
     set prestige = cur.prestige + 1, xp_base = acc_xp, updated_at = now()
   where user_id = uid;

  return json_build_object('prestige', cur.prestige + 1, 'xp_base', acc_xp);
end;
$$;

revoke all on function public.troll_forces_prestige_up() from public, anon;
grant execute on function public.troll_forces_prestige_up() to authenticated;

-- 3. calling cards: p1-p10 unchanged, master needs Prestige Master (69)
create or replace function public.troll_forces_card_allowed(p_card text, p_prestige int)
returns boolean language sql immutable as $$
  select p_card = any (array['hitman', 'blade', 'overcharge', 'main-event', 'ambush', 'brute'])
      or (p_card ~ '^p([1-9]|10)$' and coalesce(p_prestige, 0) >= substring(p_card from 2)::int)
      or (p_card = 'master' and coalesce(p_prestige, 0) >= 69);
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
    v_prestige := 69;
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
