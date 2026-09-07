// Troll Ops — rank + XP.
//
// Weapons unlock by rank, tuned generously so the roster opens over a few
// sessions rather than a grind. Stored locally for now; phase 6 moves this
// onto the Supabase accounts system, so keep the surface small.

import { WEAPON_DEFS } from "./weapons.js";

const KEY = "trollops:xp";
const XP_PER_RANK = 2500;
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

export function xpForRun({ kills = 0, wave = 0 }) {
  return kills * 50 + wave * 300;
}

/* Progress through the current rank, 0..1. */
export function rankProgress() {
  if (getRank() >= MAX_RANK) return 1;
  return (getXp() % XP_PER_RANK) / XP_PER_RANK;
}

export function isUnlocked(weaponId) {
  const def = WEAPON_DEFS[weaponId];
  if (!def) return false;
  return getRank() >= def.rank;
}
