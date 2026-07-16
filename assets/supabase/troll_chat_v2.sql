-- ============================================================================
-- TROLLCHAT v2 — GIFs + drawings (run ONCE in Supabase → SQL Editor)
-- ============================================================================
-- The chat now sends two new message shapes:
--
--   GIF      : body = 'gif:<token>'                     (short — already fits
--                                                        the old 240-char rule,
--                                                        nothing needed)
--   drawing  : body = 'draw:data:image/png;base64,...'  (a small PNG doodle,
--                                                        longer than 240 chars)
--
-- Until this runs, drawings still work LIVE (Realtime broadcast) but are
-- rejected by the old insert policies, so they vanish on refresh and the
-- site shows: "Drawing went out live — run troll_chat_v2.sql…".
--
-- This migration widens the insert policies to also accept exactly the
-- drawing shape (and nothing else) up to 32 KB — matching DRAW_MAX in
-- assets/js/troll-chat-extras.js. It is safe to run whether or not
-- troll_accounts.sql has been applied, and keeps the accounts system's
-- no-impersonation checks when it has.
-- ----------------------------------------------------------------------------

do $$
declare
  has_accounts boolean := to_regclass('public.troll_profiles') is not null;
begin
  -- user_id column exists once accounts are installed; harmless otherwise
  if has_accounts then
    execute 'alter table public.troll_chat
               add column if not exists user_id uuid
               references auth.users (id) on delete set null';
  end if;

  execute 'drop policy if exists troll_chat_insert on public.troll_chat';
  execute 'drop policy if exists troll_chat_insert_auth on public.troll_chat';

  if has_accounts then
    -- Guests can post, but cannot claim a registered username or a user_id.
    execute $p$
      create policy troll_chat_insert
        on public.troll_chat
        for insert
        to anon
        with check (
          char_length(name) <= 24
          and user_id is null
          and not exists (
            select 1 from public.troll_profiles p
            where p.username_lower = lower(troll_chat.name)
          )
          and (
            char_length(body) between 1 and 240
            or (
              body like 'draw:data:image/png;base64,%'
              and char_length(body) between 30 and 32000
            )
          )
        )
    $p$;

    -- Logged-in posts must carry the poster's own user_id + current username.
    execute $p$
      create policy troll_chat_insert_auth
        on public.troll_chat
        for insert
        to authenticated
        with check (
          user_id = auth.uid()
          and name = (select username from public.troll_profiles where id = auth.uid())
          and (
            char_length(body) between 1 and 240
            or (
              body like 'draw:data:image/png;base64,%'
              and char_length(body) between 30 and 32000
            )
          )
        )
    $p$;
  else
    -- Pre-accounts install: same shape as the original troll_chat.sql policy,
    -- plus the drawing allowance.
    execute $p$
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
        )
    $p$;
  end if;
end $$;
