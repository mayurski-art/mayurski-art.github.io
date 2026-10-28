-- ============================================================================
-- TROLLRUNNER NEWS — the home page's NEWS card (HANDOFF.md, "News box").
-- Run ONCE in Supabase -> SQL Editor, after troll_admin_lockdown.sql (it uses
-- troll_is_admin()). Idempotent -- safe to re-run.
--
-- Its own table, not the shared site_updates row: five writers read that
-- whole row and write it back, so two saves at once can drop one.
--
-- Anyone reads published stories (the home page, anon key). Only a real
-- admin writes (admin.html's News view, with the admin session token).
-- The checks keep the page safe whatever is typed in: art only from
-- assets/images/news/ (rendered by tools/news-art.mjs), links only to the
-- site's own pages or https, menu targets only screens the home page has.
-- ============================================================================

create table if not exists public.troll_news (
  id           text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,47}$'),
  title        text not null check (char_length(title) between 1 and 80),
  body         text not null default '' check (char_length(body) <= 1200),   -- paragraphs split by a blank line
  tag          text not null default '' check (char_length(tag) <= 60),
  image        text not null check (image ~ '^assets/images/news/[a-z0-9-]+\.(webp|jpg|png)$'),
  hero         text check (hero is null or hero ~ '^assets/images/news/[a-z0-9-]+\.(webp|png)$'),
  alt          text not null default '' check (char_length(alt) <= 240),
  focus        text not null default '50% 50%' check (focus ~ '^[0-9]{1,3}% [0-9]{1,3}%$'),
  accent       text not null default '#ff8a1f' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  href         text check (href is null or (href ~ '^(https://|/|[a-z0-9])' and href !~* '^javascript:' and char_length(href) <= 300)),
  go           text check (go is null or go in ('arcade', 'leaderboard', 'map')),
  pinned       boolean not null default false,
  published    boolean not null default true,
  published_at date not null default current_date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists troll_news_order_idx
  on public.troll_news (pinned desc, published_at desc);

create or replace function public.troll_news_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists troll_news_touch on public.troll_news;
create trigger troll_news_touch before update on public.troll_news
  for each row execute function public.troll_news_touch();

alter table public.troll_news enable row level security;

drop policy if exists troll_news_public_read on public.troll_news;
create policy troll_news_public_read on public.troll_news
  for select to anon, authenticated using (published or troll_is_admin());

drop policy if exists troll_news_admin_insert on public.troll_news;
create policy troll_news_admin_insert on public.troll_news
  for insert to authenticated with check (troll_is_admin());

drop policy if exists troll_news_admin_update on public.troll_news;
create policy troll_news_admin_update on public.troll_news
  for update to authenticated using (troll_is_admin()) with check (troll_is_admin());

drop policy if exists troll_news_admin_delete on public.troll_news;
create policy troll_news_admin_delete on public.troll_news
  for delete to authenticated using (troll_is_admin());

revoke all on public.troll_news from anon, authenticated;
grant select on public.troll_news to anon, authenticated;
grant insert, update, delete on public.troll_news to authenticated;

-- The three launch stories (placeholders until v1.0's real news); a re-run
-- never overwrites what admin.html has changed since.
insert into public.troll_news (id, title, body, tag, image, hero, alt, focus, accent, href, go, published_at)
values
  ('v1-wip', 'Version 1.0 is cooking',
   E'trollrunner.net is getting rebuilt from the ground up. New menu, new arcade, same grin.\n\nSome doors are still locked while we hang the paint. Poke around anyway, then tell us what''s broken.',
   'Work in progress', 'assets/images/news/v1-forces.webp', 'assets/images/news/v1-forces-hero.webp',
   'The Troll Runner leading a Troll Forces squad down a suburban street at sunset, rifle at port arms',
   '64% 56%', '#ff9a6b', 'troll-ops.html', null, '2026-10-28'),
  ('arcade-ladder', 'The weekly ladder',
   E'Every game in the arcade feeds one leaderboard. Top trolls reset every week.\n\nClimb it, screenshot it, rub it in.',
   '', 'assets/images/news/ladder-champion.webp', 'assets/images/news/ladder-champion-hero.webp',
   'The week''s winner on top of a shipping container with a gold rifle, two beaten trolls below, one sad, one with an L on their forehead',
   '50% 40%', '#ffd27a', null, 'leaderboard', '2026-10-27'),
  ('stickers', 'Print, cut, slap',
   'The sticker sheets are up. Print them at home and leave a grin somewhere it shouldn''t be.',
   'New sheets', 'assets/images/news/stickers-slap.webp', 'assets/images/news/stickers-slap-hero.webp',
   'The Troll Runner slapping a trollface sticker onto a glass panel already covered in them',
   '52% 88%', '#8cff2e', 'stickers.html', null, '2026-10-26')
on conflict (id) do nothing;
