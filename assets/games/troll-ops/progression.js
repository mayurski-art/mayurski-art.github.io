// Troll Ops — level + XP.
//
// One level shared with the trollrunner.net account. Signed in, your Troll
// Ops level IS your account level (troll_profiles.level), weapon unlocks
// included, and match XP is credited 1:1 to the account through the
// `troll_ops_xp` event (assets/supabase/troll_ops_xp.sql). Guests level on
// the same curve from a local total, and that total is credited the first
// time they sign in on this device.
//
// XP earned is queued in PENDING_KEY before it's sent, so a closed tab,
// a flaky network or a signed-out session never loses any. Until the queue
// drains, the displayed level counts it on top of the account's XP.

import { WEAPON_DEFS } from "./weapons.js";

const KEY = "trollops:xp";                 // lifetime local total (guest level)
const PENDING_KEY = "trollops:xp-pending"; // earned, not yet on the account
const MIGRATED_KEY = "trollops:xp-account-sync";

function readNum(key) {
  try {
    const raw = Number(localStorage.getItem(key));
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  } catch { return 0; }
}

function writeNum(key, value) {
  try { localStorage.setItem(key, String(Math.max(0, Math.floor(value)))); } catch { /* private mode */ }
}

// XP banked before the account link existed goes up once, with the first sync.
try {
  if (!localStorage.getItem(MIGRATED_KEY)) {
    writeNum(PENDING_KEY, readNum(PENDING_KEY) + readNum(KEY));
    localStorage.setItem(MIGRATED_KEY, "1");
  }
} catch { /* private mode */ }

function accountXp() {
  const profile = window.TrollrunnerAccounts?.getCachedProfile?.();
  if (!profile) return null;
  const xp = Number(profile.xp);
  return Number.isFinite(xp) && xp > 0 ? xp : 0;
}

/* Same curve as troll_level_for_xp() on the server. */
export function levelForXp(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}

export function xpForLevel(level) {
  return 50 * (level - 1) * (level - 1);
}

export function isAccountLevel() {
  return accountXp() !== null;
}

export function getXp() {
  const account = accountXp();
  return account === null ? readNum(KEY) : account + readNum(PENDING_KEY);
}

export function getRank() {
  return levelForXp(getXp());
}

let syncing = null;

/* Push queued XP to the account. No-op for guests; safe to call often. */
export function syncXp() {
  const accounts = window.TrollrunnerAccounts;
  if (syncing || !accounts?.awardXp || accountXp() === null) return syncing;
  const amount = readNum(PENDING_KEY);
  if (amount <= 0) return null;
  syncing = accounts.awardXp("troll_ops_xp", "troll-ops", { xp: amount })
    .then((res) => {
      // Only clear what landed; anything earned mid-request stays queued.
      if (res?.awarded > 0) writeNum(PENDING_KEY, readNum(PENDING_KEY) - res.awarded);
      return res;
    })
    .finally(() => { syncing = null; });
  return syncing;
}

export function addXp(amount) {
  const gained = Math.max(0, Math.round(amount));
  const before = getRank();
  writeNum(KEY, readNum(KEY) + gained);
  writeNum(PENDING_KEY, readNum(PENDING_KEY) + gained);
  const total = getXp();
  const rank = levelForXp(total);
  void syncXp();
  return { total, rank, rankedUp: rank > before };
}

/* PvP XP rates. Kills pay as they happen (see game.js `awardKillXp`); the
   end-of-match bonuses are settled by `xpForMatch`.

   These are deliberately not the Ops rates. Ops pays `wave * 300`, so a
   wave-9 run is worth 2,700 — while a PvP match passes wave 0 and used to
   earn `kills * 50` alone, which barely moved the shared unlock track for
   anyone who only played PvP. */
export const XP = {
  kill: 100,
  headshot: 50,      // on top of the kill
  assist: 40,
  objective: 75,     // hill ticks, gun-game ladder steps
  win: 800,
  matchComplete: 250,
};

export function xpForRun({ kills = 0, wave = 0 }) {
  return kills * 50 + wave * 300;
}

/* End-of-match settlement. Per-kill XP is already banked by the time this
   runs, so this covers only what can't be known until the match ends. */
export function xpForMatch({ won = false, completed = true }) {
  return (won ? XP.win : 0) + (completed ? XP.matchComplete : 0);
}

/* Progress through the current level, 0..1. */
export function rankProgress() {
  const xp = getXp(), level = levelForXp(xp);
  const floor = xpForLevel(level);
  return (xp - floor) / (xpForLevel(level + 1) - floor);
}

/* "340 / 450 XP" toward the next level. */
export function rankXpText() {
  const xp = getXp(), level = levelForXp(xp);
  const floor = xpForLevel(level);
  return `${(xp - floor).toLocaleString()} / ${(xpForLevel(level + 1) - floor).toLocaleString()} XP`;
}

/* Level gate for anything that isn't in WEAPON_DEFS — melee, throwables. */
export function rankUnlocked(rank) {
  return getRank() >= (rank || 0);
}

export function isUnlocked(weaponId) {
  const def = WEAPON_DEFS[weaponId];
  if (!def) return false;
  return getRank() >= def.rank;
}
