-- ============================================================================
-- TROLLCHAT LOGIN REQUIRED — only signed-in runners may post
-- (run ONCE in Supabase -> SQL Editor, after troll_chat.sql / troll_chat_v2.sql)
-- ============================================================================
-- Guests could previously post to the global room under a typed display name
-- (troll_chat_insert, 'anon' role). That policy is dropped so posting always
-- requires an authenticated troll_profiles row; troll_chat_insert_auth
-- (already in troll_chat_groups.sql) still covers logged-in posting to the
-- global room and to groups. Reading the room stays open to everyone.
-- ----------------------------------------------------------------------------

drop policy if exists troll_chat_insert on public.troll_chat;
revoke insert on public.troll_chat from anon;
