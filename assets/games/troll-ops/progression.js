// Troll Forces — level + XP.
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

import { WEAPON_DEFS } from "./weapons.js?v=cg1";

const KEY = "trollops:xp";                 // lifetime local total (guest level)
const PENDING_KEY = "trollops:xp-pending"; // earned, not yet on the account
const MIGRATED_KEY = "trollops:xp-account-sync";

/* Every XP rate below is a tenth of what it was on 2026-09-29: a match used
   to be worth about a level on its own. Medal points (medals.js) keep their
   full value for the scorestreak meter and pay XP at this scale. */
export const XP_SCALE = 0.1;

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

// 2026-09-30: match XP cut to a tenth (user: "way too much xp"). Anything
// still queued was earned at the old rates, so it goes up at the new ones.
const RATE_KEY = "trollops:xp-rate-2";
try {
  if (!localStorage.getItem(RATE_KEY)) {
    writeNum(PENDING_KEY, readNum(PENDING_KEY) * XP_SCALE);
    localStorage.setItem(RATE_KEY, "1");
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

/* Signed in, these are exactly the account numbers trollrunner.net shows
   (user: "just make the numbers look the same"): XP still queued for the
   account shows up here once it lands, not before. */
export function getXp() {
  const account = accountXp();
  return account === null ? readNum(KEY) : account;
}

export function getRank() {
  const level = Number(window.TrollrunnerAccounts?.getCachedProfile?.()?.level);
  if (accountXp() !== null && Number.isFinite(level) && level >= 1) return Math.floor(level);
  return levelForXp(getXp());
}

let syncing = null;
let retryTimer = 0;

/* Push queued XP to the account. No-op for guests; safe to call often. A
   failed send (network, or the server rejecting the event) retries every
   30s while the page is open, so the queue can't sit stuck until the next
   match ends. */
export function syncXp() {
  const accounts = window.TrollrunnerAccounts;
  if (syncing || !accounts?.awardXp || accountXp() === null) return syncing;
  const amount = readNum(PENDING_KEY);
  if (amount <= 0) return null;
  clearTimeout(retryTimer);
  syncing = accounts.awardXp("troll_ops_xp", "troll-ops", { xp: amount })
    .then((res) => {
      // Only clear what landed; anything earned mid-request stays queued.
      if (res?.awarded > 0) writeNum(PENDING_KEY, readNum(PENDING_KEY) - res.awarded);
      else retryTimer = setTimeout(() => void syncXp(), 30000);
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
  kill: 10,
  headshot: 5,       // on top of the kill
  assist: 4,
  objective: 8,      // hill ticks, gun-game ladder steps
  win: 80,
  matchComplete: 25,
};

export function xpForRun({ kills = 0, wave = 0 }) {
  return kills * 5 + wave * 30;
}

/* End-of-match settlement. Per-kill XP is already banked by the time this
   runs, so this covers only what can't be known until the match ends. */
export function xpForMatch({ won = false, completed = true }) {
  return (won ? XP.win : 0) + (completed ? XP.matchComplete : 0);
}

/* Progress through the current level, 0..1. */
export function rankProgress() {
  const { xp, floor, next } = levelSpan();
  return Math.max(0, Math.min(1, (xp - floor) / Math.max(1, next - floor)));
}

/* The trollrunner.net profile bar, number for number (troll-accounts.js
   xpProgress). */
function levelSpan() {
  const level = getRank();
  const floor = xpForLevel(level);
  return { xp: Math.max(getXp(), floor), floor, next: xpForLevel(level + 1) };
}

/* "475,000 / 480,200 XP": total XP over the total the next level needs,
   the same readout as the trollrunner.net profile. */
export function rankXpText() {
  const { xp, next } = levelSpan();
  return `${xp.toLocaleString()} / ${next.toLocaleString()} XP`;
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
