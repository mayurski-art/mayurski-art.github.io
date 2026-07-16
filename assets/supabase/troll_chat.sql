-- ============================================================================
-- TROLLCHAT — saved chat history (run ONCE in Supabase → SQL Editor)
-- ============================================================================
-- The live chat + "N online" count already work with no setup (they use
-- Supabase Realtime Broadcast + Presence over the public anon key).
--
-- This table is ONLY what makes chat history persist so new visitors — and
-- you after a refresh — can see what was already said. Until you run this,
-- the homepage chat shows "Live only — chat history isn’t being saved yet."
--
-- Paste everything below into the Supabase SQL Editor and click Run.
-- ----------------------------------------------------------------------------

create table if not exists public.troll_chat (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null default 'Guest',
  body       text        not null,
  created_at timestamptz not null default now()
);

create index if not exists troll_chat_created_at_idx
  on public.troll_chat (created_at desc);

alter table public.troll_chat enable row level security;

-- Anyone (anon) may READ the room history.
drop policy if exists troll_chat_read on public.troll_chat;
create policy troll_chat_read
  on public.troll_chat
  for select
  to anon
  using (true);

-- Anyone (anon) may POST a message, with light server-side length guards so a
-- bad actor can't stuff giant rows. The site also rate-limits on the client.
-- Drawings ship as 'draw:data:image/png;base64,…' bodies and get a bigger cap
-- (32 KB, matching DRAW_MAX in assets/js/troll-chat-extras.js).
drop policy if exists troll_chat_insert on public.troll_chat;
create policy troll_chat_insert
  on public.troll_chat
  for insert
  to anon
  with check (
    char_length(name) <= 24
    and (
      char_length(body) between 1 and 240
      or (
        body like 'draw:data:image/png;base64,%'
        and char_length(body) between 30 and 32000
      )
    )
  );

-- Optional housekeeping: keep only the most recent 500 messages.
-- Run this whenever you like, or wire it to a scheduled job (pg_cron).
-- delete from public.troll_chat
-- where id not in (
--   select id from public.troll_chat order by created_at desc limit 500
-- );
