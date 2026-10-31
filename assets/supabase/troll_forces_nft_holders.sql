-- Troll Forces: who holds each TROLLS NFT body (2026-10-31). Run once in the
-- Supabase SQL editor. Idempotent: safe to run again.
--
-- A TROLLS body (assets/games/troll-ops/characters/cosmetics.js BODIES) is
-- worn by its holder only, and by troll_runner, who owns them all. Until
-- now the holder was a username written in that file; from here the owner
-- hands them out in the game (Locker > Body > NFT access) and the game
-- reads this table. The file's names stay as the fallback when the table
-- can't be reached.
--
-- 1. troll_forces_nft_holders: one row per token, the account holding it.
--    Nobody reads or writes it directly.
-- 2. troll_forces_nft_holders_list(): every token and its holder's
--    username, for everyone (guests too: they see other players' bodies).
-- 3. troll_forces_set_nft_holder(token, username): troll_runner only. Gives
--    the token to that account; troll_runner's own name takes it back.
-- 4. The seed: the holders cosmetics.js named on 2026-10-31.

create table if not exists public.troll_forces_nft_holders (
  token   int primary key check (token > 0),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_at  timestamptz not null default now()
);

alter table public.troll_forces_nft_holders enable row level security;

create or replace function public.troll_forces_nft_holders_list()
returns table (token int, username text)
language sql
stable
security definer
set search_path = public
as $$
  select h.token, p.username
  from troll_forces_nft_holders h
  join troll_profiles p on p.id = h.user_id
  order by h.token;
$$;

revoke all on function public.troll_forces_nft_holders_list() from public;
grant execute on function public.troll_forces_nft_holders_list() to anon, authenticated;

create or replace function public.troll_forces_set_nft_holder(p_token int, p_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to uuid;
  v_name text;
begin
  if not exists (select 1 from troll_profiles where id = auth.uid() and username_lower = 'troll_runner') then
    raise exception 'Only troll_runner can hand out TROLLS bodies.';
  end if;
  if p_token is null or p_token <= 0 then
    raise exception 'No such token.';
  end if;
  select id, username into v_to, v_name from troll_profiles
   where username_lower = lower(trim(coalesce(p_username, '')));
  if v_to is null then
    raise exception 'No account named "%".', trim(coalesce(p_username, ''));
  end if;
  insert into troll_forces_nft_holders (token, user_id, set_at)
  values (p_token, v_to, now())
  on conflict (token) do update set user_id = excluded.user_id, set_at = excluded.set_at;
  return json_build_object('token', p_token, 'username', v_name);
end;
$$;

revoke all on function public.troll_forces_set_nft_holder(int, text) from public;
grant execute on function public.troll_forces_set_nft_holder(int, text) to authenticated;

-- The seed: what cosmetics.js said on 2026-10-31. A name with no account
-- yet is skipped (its token stays with the file's fallback till it's set).
insert into public.troll_forces_nft_holders (token, user_id)
select s.token, p.id
from (values
  (1718, 'troll_runner'), (1262, 'big_elva001'), (820, 'guccibeardd'),
  (989, 'troll_runner'), (33, 'bradthetroll'), (2630, 'karlezetroll'),
  (2631, 'lacksss'), (1272, 'troll_runner')
) as s(token, username)
join public.troll_profiles p on p.username_lower = s.username
on conflict (token) do nothing;
