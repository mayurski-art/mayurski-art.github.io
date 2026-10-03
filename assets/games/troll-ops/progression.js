// Troll Forces — level + XP.
//
// Match XP is credited 1:1 to the trollrunner.net account through the
// `troll_ops_xp` event (assets/supabase/troll_ops_xp.sql). Since prestige
// (2026-10-02) the game SHOWS its own level: the Troll Forces level, from
// account XP earned since your last prestige, on a faster curve (see
// "Prestige" below). Unlocks use the higher of that and the account level.
//
// Guests keep nothing (user, 2026-10-01: "remove progress being saved for
// guest accounts"): they level on the same curve for the session, in
// memory, and it's gone when the tab closes. Nothing is stored or queued
// for a later sign-in.
//
// Signed in, XP earned is queued in PENDING_KEY before it's sent, so a
// closed tab or a flaky network never loses any.

import { WEAPON_DEFS } from "./weapons.js?v=cg1";

const KEY = "trollops:xp";                 // the old saved guest total: no longer kept (cleared below)
const PENDING_KEY = "trollops:xp-pending"; // earned signed in, not yet on the account
const AUTH_KEY = "trollrunner-accounts-auth";   // troll-accounts.js keeps its session here

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

// Guest progress isn't kept: the old saved guest total goes.
try { localStorage.removeItem(KEY); } catch { /* private mode */ }

/* This session's guest XP (never saved). */
let sessionXp = 0;

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

/* Signed in, or a stored session whose profile is still loading (so XP
   earned in the first seconds of a signed-in visit isn't taken for a
   guest's). A guest has neither. */
export function isSignedIn() {
  if (accountXp() !== null) return true;
  try { return !!localStorage.getItem(AUTH_KEY); } catch { return false; }
}

/* Signed in, these are exactly the account numbers trollrunner.net shows
   (user: "just make the numbers look the same"): XP still queued for the
   account shows up here once it lands, not before. */
export function getXp() {
  const account = accountXp();
  return account === null ? sessionXp : account;
}

/* The owner (user: "for troll_runner instead of giving me a game level, give
   me a cool owner badge. this gives me access to everything and everything
   that is to come"). No level at all — getLevel() is null and the UI shows
   the owner badge — and getRank() is Infinity, so every level gate, today's
   and any added later through getRank/rankUnlocked/isUnlocked, is open. */
export function isOwner() {
  return String(window.TrollrunnerAccounts?.getCachedProfile?.()?.username || "").toLowerCase() === "troll_runner";
}

/* ---- Prestige (Troll Forces only; design doc "Troll Forces: Prestige +
   Profile Card"). The game has its own level, on its own faster curve, counted
   from account XP earned since your last prestige: account XP minus the
   `xp_base` set when you prestiged. Prestiging resets that number, never the
   trollrunner.net account level. Cap 69; Prestige 1-10, then 11 = Prestige
   Master. Stored in public.troll_forces_prestige, written only by the
   troll_forces_prestige_up() function, which re-checks level 69 itself
   (assets/supabase/troll_forces_prestige.sql). Guests keep no XP between
   visits, so they level for the session and never prestige. */
export const TF_MAX_LEVEL = 69;
export const PRESTIGE_MASTER = 11;

/* XP from level 1 to `level`: 120 a level plus a gentle climb, 17,408 to
   reach 69 (about 87 good matches). Same formula as the SQL. */
export function tfXpForLevel(level) {
  const n = level - 1;
  return 120 * n + 2 * n * n;
}
export function tfLevelForXp(xp) {
  // inverse of 120n + 2n^2; exact at every level boundary (perfect squares)
  const n = Math.floor((-120 + Math.sqrt(14400 + 8 * Math.max(0, xp))) / 4);
  return Math.min(TF_MAX_LEVEL, n + 1);
}

const prestige = { level: 0, base: 0, ready: false, available: false };
let prestigeFor = null;

/* Load this account's prestige row (once per sign-in). `available` stays
   false until the SQL has been run, which keeps the Prestige option hidden. */
async function loadPrestige() {
  const accounts = window.TrollrunnerAccounts;
  const profile = accounts?.getCachedProfile?.();
  const id = profile?.id || profile?.userId || null;
  if (id === prestigeFor) return;
  prestigeFor = id;
  Object.assign(prestige, { level: 0, base: 0, ready: !id, available: false });
  const sb = id && accounts?.getClient?.();
  if (sb) {
    const { data, error } = await sb.from("troll_forces_prestige").select("prestige, xp_base").eq("user_id", id).maybeSingle();
    if (prestigeFor !== id) return;
    if (!error) {
      prestige.available = true;
      prestige.level = Number(data?.prestige) || 0;
      prestige.base = Number(data?.xp_base) || 0;
    }
    prestige.ready = true;
  }
  window.dispatchEvent(new CustomEvent("trollforces:prestige-changed"));
}
window.addEventListener("trollrunner:auth-changed", () => void loadPrestige());
void loadPrestige();

export function getPrestige() {
  return isOwner() || accountXp() === null ? 0 : prestige.level;
}

/* Troll Forces XP: account XP since the last prestige (guests: this session). */
function tfXp(extra = 0) {
  const account = accountXp();
  if (account === null) return sessionXp + extra;
  return Math.max(0, account + extra - prestige.base);
}

/* The level to SHOW: the Troll Forces level, null for the owner. */
export function getLevel() {
  return isOwner() ? null : tfLevelForXp(tfXp());
}

export function canPrestige() {
  return !isOwner() && accountXp() !== null && prestige.available
    && prestige.level < PRESTIGE_MASTER && getLevel() >= TF_MAX_LEVEL;
}

/* Prestige up. Resolves to the new prestige, or throws the server's reason. */
export async function prestigeUp() {
  const sb = window.TrollrunnerAccounts?.getClient?.();
  if (!sb || !canPrestige()) throw new Error("Not eligible to prestige.");
  const { data, error } = await sb.rpc("troll_forces_prestige_up");
  if (error) throw new Error(error.message || "Prestige failed.");
  prestige.level = Number(data?.prestige) || prestige.level + 1;
  prestige.base = Number(data?.xp_base) || accountXp() || 0;
  window.dispatchEvent(new CustomEvent("trollforces:prestige-changed"));
  return prestige.level;
}

/* The level that UNLOCKS things. Nothing ever relocks: the account level, or
   the Troll Forces level if that's higher (its curve is faster), and once
   you've prestiged you've been to 69, so everything up to 69 stays open. */
export function getRank() {
  if (isOwner()) return Infinity;
  const level = Number(window.TrollrunnerAccounts?.getCachedProfile?.()?.level);
  const account = accountXp() !== null && Number.isFinite(level) && level >= 1 ? Math.floor(level) : levelForXp(getXp());
  return Math.max(account, getPrestige() > 0 ? TF_MAX_LEVEL : getLevel());
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
  const before = getLevel();
  if (isSignedIn()) writeNum(PENDING_KEY, readNum(PENDING_KEY) + gained);
  else sessionXp += gained;          // a guest: this session only
  const total = getXp();
  void syncXp();
  if (before === null) return { total, rank: null, rankedUp: false };   // the owner has no level
  // the Troll Forces level once what's still queued lands on the account
  const rank = tfLevelForXp(tfXp(accountXp() === null ? 0 : readNum(PENDING_KEY)));
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
  if (isOwner()) return 1;
  const { xp, floor, next } = levelSpan();
  return Math.max(0, Math.min(1, (xp - floor) / Math.max(1, next - floor)));
}

/* Progress through the current Troll Forces level, in Troll Forces XP. */
function levelSpan() {
  const level = getLevel();
  const floor = tfXpForLevel(level);
  return { xp: Math.max(tfXp(), floor), floor, next: tfXpForLevel(level + 1), max: level >= TF_MAX_LEVEL };
}

/* "5,200 / 6,050 XP": Troll Forces XP over what the next level needs. */
export function rankXpText() {
  if (isOwner()) return "Everything unlocked";
  const { xp, next, max } = levelSpan();
  if (max) return getPrestige() >= PRESTIGE_MASTER ? "Prestige Master · max level" : canPrestige() ? "Max level · Prestige ready" : "Max level";
  return `${xp.toLocaleString()} / ${next.toLocaleString()} XP`;
}

/* Level gate for anything that isn't in WEAPON_DEFS — melee, throwables. */
export function rankUnlocked(rank) {
  return getRank() >= (rank || 0);
}

/* Prestige gate (U Mad Bro? at Prestige 2). The owner never prestiges and
   has everything, so they pass; guests never prestige, so they don't. */
export function prestigeUnlocked(n) {
  return isOwner() || getPrestige() >= (n || 0);
}

export function isUnlocked(weaponId) {
  const def = WEAPON_DEFS[weaponId];
  if (!def) return false;
  return getRank() >= def.rank;
}
