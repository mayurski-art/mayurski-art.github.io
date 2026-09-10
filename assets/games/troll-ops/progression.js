// Troll Ops — rank + XP.
//
// Weapons unlock by rank, tuned generously so the roster opens over a few
// sessions rather than a grind. Stored locally for now; phase 6 moves this
// onto the Supabase accounts system, so keep the surface small.

import { WEAPON_DEFS } from "./weapons.js";

const KEY = "trollops:xp";
export const XP_PER_RANK = 2500;
export const MAX_RANK = 40;

export function getXp() {
  const raw = Number(localStorage.getItem(KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function getRank() {
  return Math.min(MAX_RANK, Math.floor(getXp() / XP_PER_RANK));
}

export function addXp(amount) {
  const before = getRank();
  const total = getXp() + Math.max(0, Math.round(amount));
  try { localStorage.setItem(KEY, String(total)); } catch { /* private mode */ }
  return { total, rank: Math.min(MAX_RANK, Math.floor(total / XP_PER_RANK)), rankedUp: Math.floor(total / XP_PER_RANK) > before };
}

/* PvP XP rates. Kills pay as they happen (see game.js `awardKillXp`); the
   end-of-match bonuses are settled by `xpForMatch`.

   These are deliberately not the Ops rates. Ops pays `wave * 300`, so a
   wave-9 run is worth 2,700 — more than a full rank — while a PvP match
   passes wave 0 and used to earn `kills * 50` alone. A strong 15-kill match
   paid 750 against 2,500 per rank, so the shared unlock track barely moved
   for anyone who only played PvP. */
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

/* Progress through the current rank, 0..1. */
export function rankProgress() {
  if (getRank() >= MAX_RANK) return 1;
  return (getXp() % XP_PER_RANK) / XP_PER_RANK;
}

/* Rank gate for anything that isn't in WEAPON_DEFS — melee, throwables. */
export function rankUnlocked(rank) {
  return getRank() >= (rank || 0);
}

export function isUnlocked(weaponId) {
  const def = WEAPON_DEFS[weaponId];
  if (!def) return false;
  return getRank() >= def.rank;
}
