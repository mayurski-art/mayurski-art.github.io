// Troll Forces Zombies: Credits, and what they buy (Zombie Rush P6).
//
// A run pays Credits when it ends: 1 a zombie you killed, 25 a wave cleared,
// 200 more for surviving all 30. They're spent at the hub's kiosks
// (view/zombies-screens.js) on:
//   - guns, in six tiers. Each tier's first gun is free once the tier is
//     open; the others cost the tier's price. A tier opens when your best
//     run has reached its wave. The gun you equip replaces your primary in
//     every run.
//   - gun levels, 1 to 10: +6% damage, +8% mag, -4% reload a level.
//   - kit levels for the Rookie's three deployables, 1 to 10 (kits.js
//     statsAt scales them).
// The run's own cash and its upgrade column (economy.js, upgrades.js) are
// separate and reset every run; Credits stay.
//
// Earn-only for now (HANDOFF: the troll coin economy). Logged-in players
// keep them in localStorage under KEY, which cloud-save.js syncs to the
// account; guests keep them for this visit only. The owner, troll_runner,
// owns every gun.

import { WEAPON_DEFS } from "../../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416";

const KEY = "trollops:zombies";

export const CREDITS_PER_KILL = 1;
export const CREDITS_PER_WAVE = 25;
export const CREDITS_FOR_WIN = 200;

/* Six tiers over the 34 guns, roughly by rank; the first of each is the
   free starter. `wave`: the best wave that opens the tier. The guns
   retired while arsenal v2 rebuilds them (weapons.js KEPT) are left out,
   and a tier left with none is dropped. */
export const GUN_TIERS = [
  { id: 1, wave: 0, price: 400, guns: ["problem416", "snubgrin", "snicker", "shotgun", "sixtynine", "soulblazer"] },
  { id: 2, wave: 5, price: 900, guns: ["kek", "sneer", "snort", "lol", "bellow", "sawgrin"] },
  { id: 3, wave: 10, price: 1800, guns: ["lmao", "trollboy", "cope", "true69", "deadpan", "cackle"] },
  { id: 4, wave: 15, price: 3200, guns: ["heh", "rofl", "grinmington", "coltlmg", "guffaw", "beast"] },
  { id: 5, wave: 20, price: 5500, guns: ["mald", "seethe", "greencandle", "howl", "peacemakers"] },
  { id: 6, wave: 25, price: 9000, guns: ["ratio", "coalface", "salt", "smug", "bellylaugh"] },
].map((t) => ({ ...t, guns: t.guns.filter((g) => !WEAPON_DEFS[g]?.retired) })).filter((t) => t.guns.length);
const TIER_OF = new Map(GUN_TIERS.flatMap((t) => t.guns.map((g) => [g, t])));
export const tierOf = (gunId) => TIER_OF.get(gunId) || null;
export const isStarter = (gunId) => tierOf(gunId)?.guns[0] === gunId;
export const DEFAULT_GUN = GUN_TIERS[0].guns[0];

export const GUN_MAX = 10;
export const KIT_MAX = 10;
const round5 = (n) => Math.round(n / 5) * 5;
/* Level lv -> lv + 1. */
export const gunUpgradePrice = (lv) => round5(150 * Math.pow(lv, 1.6));
export const kitUpgradePrice = (depId, lv) => (depId === "turret" ? 600 : 300) * lv;

/* A gun's def at level lv (1 = as built). */
export function gunAtLevel(def, lv = 1) {
  const k = Math.max(0, Math.min(GUN_MAX, lv) - 1);
  if (!k) return def;
  const out = {
    ...def,
    damage: def.damage * (1 + 0.06 * k),
    magSize: Math.max(def.magSize + 1, Math.round(def.magSize * (1 + 0.08 * k))),
    reloadTime: def.reloadTime * Math.pow(0.96, k),
    zLevel: lv,
  };
  if (def.tacReloadTime) out.tacReloadTime = def.tacReloadTime * Math.pow(0.96, k);
  return out;
}

/* What a run pays. `cleared`: waves cleared. */
export const creditsFor = ({ kills = 0, cleared = 0, won = false }) =>
  Math.max(0, Math.round(kills * CREDITS_PER_KILL + cleared * CREDITS_PER_WAVE + (won ? CREDITS_FOR_WIN : 0)));

/* ------------------------------------------------------------ the save */

const blank = () => ({
  v: 1,
  credits: 0,
  earned: 0,        // all time
  best: 0,          // best wave reached
  gun: DEFAULT_GUN, // equipped
  guns: {},         // id -> level, bought guns (starters are owned once their tier is open)
  kit: "rookie",
  kits: { rookie: { turret: 1, barricade: 1, barrel: 1 } },
});

let guest = null;           // a guest's, this visit only
const listeners = new Set();

const profile = () => window.TrollrunnerAccounts?.getCachedProfile?.() || null;
export const loggedIn = () => !!(profile()?.userId || profile()?.id);
export const isOwner = () => String(profile()?.username || "").toLowerCase() === "troll_runner";

function clean(s) {
  const b = blank();
  if (!s || typeof s !== "object") return b;
  const n = (x, lo = 0, hi = 1e12) => (Number.isFinite(+x) ? Math.max(lo, Math.min(hi, Math.floor(+x))) : lo);
  b.credits = n(s.credits);
  b.earned = n(s.earned);
  b.best = n(s.best, 0, 999);
  if (s.guns && typeof s.guns === "object") {
    for (const [id, lv] of Object.entries(s.guns)) if (TIER_OF.has(id)) b.guns[id] = n(lv, 1, GUN_MAX);
  }
  if (TIER_OF.has(s.gun)) b.gun = s.gun;
  const rk = s.kits?.rookie;
  if (rk) for (const d of Object.keys(b.kits.rookie)) b.kits.rookie[d] = n(rk[d], 1, KIT_MAX) || 1;
  return b;
}

/* The player's Zombies save, as it stands. */
export function zsave() {
  if (!loggedIn()) return (guest ||= blank());
  try { return clean(JSON.parse(localStorage.getItem(KEY))); } catch { return blank(); }
}

function write(s) {
  if (!loggedIn()) guest = s;
  else { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }
  for (const f of listeners) { try { f(s); } catch (e) { console.warn("[zombies] credits listener", e); } }
}

/* f(save) after every change. Returns an unsubscribe. */
export function onCreditsChange(f) { listeners.add(f); return () => listeners.delete(f); }

export const credits = () => zsave().credits;

/* ------------------------------------------------------------ guns */

export const tierOpen = (tier, s = zsave()) => isOwner() || s.best >= (tier?.wave ?? Infinity);

export function owns(gunId, s = zsave()) {
  const t = tierOf(gunId);
  if (!t) return false;
  if (isOwner() || s.guns[gunId]) return true;
  return isStarter(gunId) && tierOpen(t, s);
}
export const gunLevel = (gunId, s = zsave()) => (owns(gunId, s) ? s.guns[gunId] || 1 : 0);

/* The gun runs start with: the equipped one, if it's still yours. */
export function equippedGun(s = zsave()) {
  return owns(s.gun, s) && tierOf(s.gun) ? s.gun : DEFAULT_GUN;   // (a retired gun has no tier)
}

/* What the kiosk's button does for this gun, and its price. */
export function gunAction(gunId, s = zsave()) {
  const t = tierOf(gunId);
  if (!t) return { kind: "none" };
  if (!tierOpen(t, s)) return { kind: "locked", wave: t.wave };
  if (!owns(gunId, s)) return { kind: "buy", price: t.price, can: s.credits >= t.price };
  const lv = gunLevel(gunId, s);
  if (lv >= GUN_MAX) return { kind: "max" };
  const price = gunUpgradePrice(lv);
  return { kind: "upgrade", price, can: s.credits >= price, level: lv };
}

export function buyGun(gunId) {
  const s = zsave();
  const a = gunAction(gunId, s);
  if (a.kind !== "buy" || !a.can) return false;
  s.credits -= a.price;
  s.guns[gunId] = 1;
  s.gun = gunId;
  write(s);
  return true;
}

export function upgradeGun(gunId) {
  const s = zsave();
  const a = gunAction(gunId, s);
  if (a.kind !== "upgrade" || !a.can) return false;
  s.credits -= a.price;
  s.guns[gunId] = a.level + 1;
  write(s);
  return true;
}

export function equipGun(gunId) {
  const s = zsave();
  if (!owns(gunId, s) || s.gun === gunId) return false;
  s.gun = gunId;
  write(s);
  return true;
}

/* ------------------------------------------------------------ the kit */

export const kitLevels = (s = zsave()) => ({ ...s.kits.rookie });

export function kitAction(depId, s = zsave()) {
  const lv = s.kits.rookie[depId];
  if (!lv) return { kind: "none" };
  if (lv >= KIT_MAX) return { kind: "max", level: lv };
  const price = kitUpgradePrice(depId, lv);
  return { kind: "upgrade", price, can: s.credits >= price, level: lv };
}

export function upgradeKit(depId) {
  const s = zsave();
  const a = kitAction(depId, s);
  if (a.kind !== "upgrade" || !a.can) return false;
  s.credits -= a.price;
  s.kits.rookie[depId] = a.level + 1;
  write(s);
  return true;
}

/* ------------------------------------------------------------ a run's pay */

/* Runs a hub pad can start that aren't plain ones (modes/zombies/hub.js
   sets the one under way as it launches): what its pad's sign says, what the
   run pays (x Credits), and the rare zombie looks it raises
   (characters/zombie-models.js setRareLooks). Halloween is Chapter One's
   (core/season.js): its casket stands only while the season lasts. */
export const RUN_EVENTS = {
  halloween: { title: "Halloween Run", blurb: "Hollowgrin · 2x Credits", pay: 2, looks: { trollmask: 0.3 } },
};
let runEvent = null;
export function setRunEvent(id) { runEvent = RUN_EVENTS[id] ? id : null; }
export const currentRunEvent = () => runEvent;

/* The run is over: pay it and keep the best wave. Returns what it paid. */
export function payRun({ kills = 0, wave = 0, won = false }) {
  const cleared = won ? wave : Math.max(0, wave - 1);
  const paid = Math.round(creditsFor({ kills, cleared, won }) * (RUN_EVENTS[runEvent]?.pay || 1));
  runEvent = null;
  const s = zsave();
  s.credits += paid;
  s.earned += paid;
  s.best = Math.max(s.best, wave);
  write(s);
  return paid;
}

/* Tests (__trollHub / __trollOps): set the save outright. */
export function setZsave(s) { write(clean(s)); }
