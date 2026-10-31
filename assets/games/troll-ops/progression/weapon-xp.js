// Troll Forces weapon XP: a level per gun, Call of Duty style. Kills,
// headshots and assists with a gun pay into it (PvP only, like matchXp), the
// after-action screen (modes/after-action.js) shows the bar move, and the
// level is where attachments and camos will hang later.
//
// Saved in localStorage under KEY, which cloud-save.js syncs to the account;
// a guest's is kept on this device under GUEST_KEY and added to the account
// they sign up to (user, 2026-10-31), once its cloud copy has landed. The match
// tally (what each gun earned this match, and where it stood when the match
// began) is module state reset by startWeaponMatch() from beginMatch.

import { game } from "../core/state.js?v=st1";

const KEY = "trollops:wxp";
const GUEST_KEY = "trollops:wxp-guest";

export const WEAPON_MAX_LEVEL = 30;

/* What a gun earns. Deliberately richer than player XP (progression.js XP):
   a gun's bar should visibly move every match, a rank's every few. */
export const WXP = {
  kill: 25,
  headshot: 10,     // on top of the kill
  assist: 10,
};

/* XP floor of `level`: 0, 100, 240, 420, 640 ... 19,140 at 30. A level-30 gun
   is ~770 kills with it. */
export function wxpForLevel(level) {
  const n = Math.max(0, Math.min(WEAPON_MAX_LEVEL, level | 0) - 1);
  return 80 * n + 20 * n * n;
}

export function weaponLevelForXp(xp) {
  const x = Math.max(0, Number(xp) || 0);
  const n = Math.floor((-80 + Math.sqrt(6400 + 80 * x)) / 40);
  return Math.max(1, Math.min(WEAPON_MAX_LEVEL, n + 1));
}

/* ------------------------------------------------------------ the save */


const profile = () => window.TrollrunnerAccounts?.getCachedProfile?.() || null;
const loggedIn = () => !!(profile()?.userId || profile()?.id);

function clean(s) {
  const out = {};
  if (!s || typeof s !== "object") return out;
  for (const [id, xp] of Object.entries(s)) {
    const n = Math.floor(Number(xp));
    if (Number.isFinite(n) && n > 0 && /^[a-z0-9_-]{1,40}$/i.test(id)) out[id] = Math.min(n, wxpForLevel(WEAPON_MAX_LEVEL));
  }
  return out;
}

const load = (key) => { try { return clean(JSON.parse(localStorage.getItem(key))); } catch { return {}; } };
function read() { return load(loggedIn() ? KEY : GUEST_KEY); }

function write(s) {
  try { localStorage.setItem(loggedIn() ? KEY : GUEST_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

/* Signed in, the account's copy settled on this device: a guest's gun XP
   here is added to it, gun by gun (capped at level 30), and the guest copy
   goes. */
addEventListener("trollforces:cloud-settled", () => {
  if (!loggedIn()) return;
  const g = load(GUEST_KEY);
  if (!Object.keys(g).length) return;
  const s = load(KEY);
  for (const [id, xp] of Object.entries(g)) s[id] = (s[id] | 0) + xp;
  write(clean(s));
  try { localStorage.removeItem(GUEST_KEY); } catch { /* private mode */ }
});

export function getWeaponXp(id) { return read()[id] | 0; }
export function weaponLevel(id) { return weaponLevelForXp(getWeaponXp(id)); }

/* Where a gun stands: its level, the XP into it and to the next, 0..1. */
export function weaponProgress(id, xp = getWeaponXp(id)) {
  const level = weaponLevelForXp(xp);
  const floor = wxpForLevel(level);
  const max = level >= WEAPON_MAX_LEVEL;
  const next = max ? floor : wxpForLevel(level + 1);
  return { level, xp, floor, next, max, frac: max ? 1 : Math.max(0, Math.min(1, (xp - floor) / Math.max(1, next - floor))) };
}

/* ------------------------------------------------------------ the match */

let before = {};    // id -> xp when the match began (first touch)
let gained = {};    // id -> xp earned this match

export function startWeaponMatch() { before = {}; gained = {}; }

/* Pay `amount` into `id`. PvP only; melee, streaks and the zone pay nothing,
   nor does anything that isn't a gun on the rack. */
export function addWeaponXp(id, amount) {
  if (!id || !game.isPvp() || !(amount > 0)) return 0;
  const s = read();
  const cap = wxpForLevel(WEAPON_MAX_LEVEL);
  const was = s[id] | 0;
  if (!(id in before)) before[id] = was;
  const now = Math.min(cap, was + Math.round(amount));
  if (now === was) return 0;
  s[id] = now;
  gained[id] = (gained[id] | 0) + (now - was);
  write(s);
  return now - was;
}

/* This match's guns, most earned first: what each stood at before and after,
   for the after-action screen. */
export function matchWeaponReport() {
  return Object.keys(gained)
    .map((id) => ({ id, before: before[id] | 0, after: (before[id] | 0) + (gained[id] | 0), gained: gained[id] | 0 }))
    .sort((a, b) => b.gained - a.gained);
}
