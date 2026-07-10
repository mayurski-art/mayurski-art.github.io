-- ============================================================
-- TROLLRUNNER WALLET LINK — run once in the Supabase SQL editor
-- (after troll_accounts.sql).
--
-- Lets a signed-in user link a Phantom/Solana address to their
-- account (shown on their own Settings page only — this is not a
-- public profile field). Idempotent, safe to re-run.
-- ============================================================

alter table public.troll_user_settings
  add column if not exists wallet_address text;

-- Basic base58 shape check (Solana addresses are 32-44 base58 chars).
-- Not exhaustive on-chain validation — just keeps garbage out.
alter table public.troll_user_settings
  drop constraint if exists troll_user_settings_wallet_format;
alter table public.troll_user_settings
  add constraint troll_user_settings_wallet_format
  check (wallet_address is null or wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$');

grant update (wallet_address) on public.troll_user_settings to authenticated;
