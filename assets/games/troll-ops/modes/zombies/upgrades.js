// Troll Forces Zombies: the upgrade column. Three cards, bought with the
// run's cash (economy.js): more max health, the next gun tier, the next
// melee tier. Everything resets with the run.
//
// A gun tier rebuilds each gun you carry from the def it started the run
// with (attachments included), scaled up: more damage, a bigger mag, a
// quicker reload. Reserve ammo is infinite in Zombies (Zombie Rush's
// "7 / ∞"), so a rebuilt gun comes back with a full mag and no reserve to
// track.
//
// The primary is the gun you equipped at the hub's Weapons kiosk, at its
// level (credits.js), not your multiplayer loadout's; the secondary stays.

import { MELEE_DEFS, MeleeState } from "../../weapons/gear.js?v=to-hb1kb3-bk1-wst-ig1-th2-zr5-zr9-zr10-zp1-or1";
import { WeaponState } from "../../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1";
import { updateGearHud } from "../../combat/weapons.js?v=wp1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-ar0-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1";
import { game } from "../../core/state.js?v=st1";
import { canAfford, spend } from "./economy.js?v=zr5-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1";
import { resolveWeapon, defaultLoadoutFor } from "../../weapons/attachments.js?v=cg1-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1";
import { equippedGun, gunLevel, gunAtLevel } from "./credits.js?v=zc1-zc2";

/* +25 max health a buy, up to 250; each buy costs half again. */
const HP_STEP = 25;
const HP_CAP = 250;
const HP_PRICE = 100;
const HP_PRICE_GROWTH = 1.5;

/* Tier n (1-based): its price and how hard the gun hits next to the start
   of the run. Mag +10% and reload x0.95 per tier ride on top. */
export const GUN_TIERS = [
  { price: 250, dmg: 1.25 },
  { price: 500, dmg: 1.55 },
  { price: 900, dmg: 1.9 },
  { price: 1500, dmg: 2.3 },
  { price: 2400, dmg: 2.8 },
];

/* The melee you start with, then these in order. */
export const MELEE_TIERS = [
  { id: "bat", price: 75 },
  { id: "shovel", price: 200 },
];

const up = {
  hpBuys: 0,
  gunTier: 0,       // 0 = as the run started
  meleeTier: 0,
  base: {},         // weapon id -> the def it started the run with
};

export const upgradeState = up;

/* The gun the card names: the primary. */
function primaryDef() {
  const p = game.player;
  return up.base[p.weaponId] || p.weapons[p.weaponId]?.def || null;
}

const hpPrice = () => Math.round(HP_PRICE * Math.pow(HP_PRICE_GROWTH, up.hpBuys) / 5) * 5;

/* Swap the loadout's primary for the kiosk gun, at its level. */
function equipKioskGun() {
  const p = game.player;
  const id = equippedGun();
  const def = gunAtLevel(resolveWeapon(id, defaultLoadoutFor(id)), gunLevel(id));
  const old = p.weaponId;
  if (old) delete p.weapons[old];
  // the same gun as the secondary: it's the primary now
  if (p.secondaryId === id) p.secondaryId = null;
  p.weapons[id] = new WeaponState(def);
  p.weaponId = id;
  game.currentWeaponSlot = "primary";
  if (p.holding === "gun") game.setActiveWeaponMesh(def);
}

/* Called when the run starts, after the loadout is equipped. */
export function resetUpgrades() {
  equipKioskGun();
  up.hpBuys = 0;
  up.gunTier = 0;
  up.meleeTier = 0;
  up.base = {};
  for (const [id, w] of Object.entries(game.player.weapons)) {
    up.base[id] = w.def;
    w.ammoReserve = Infinity;
  }
  game.player.maxHp = 100;
}

/* The three cards, for the HUD: what each one sells next and whether you
   can have it. `price` is null once a card is maxed out. */
export function offers() {
  const p = game.player;
  const hpMax = p.maxHp >= HP_CAP;
  const gun = GUN_TIERS[up.gunTier];
  const melee = MELEE_TIERS[up.meleeTier];
  const gunName = primaryDef()?.name || "Gun";
  return [
    {
      id: "hp", kind: "health",
      title: hpMax ? `${p.maxHp} Health` : `${p.maxHp + HP_STEP} Health`,
      sub: hpMax ? "Maxed" : `+${HP_STEP} max`,
      price: hpMax ? null : hpPrice(),
    },
    {
      id: "gun", kind: "gun",
      title: gunName,
      sub: gun ? `Tier ${up.gunTier + 1}` : `Tier ${up.gunTier} · Maxed`,
      price: gun ? gun.price : null,
    },
    {
      id: "melee", kind: "melee",
      title: melee ? MELEE_DEFS[melee.id].name : (game.player.melee?.def?.name || "Melee"),
      sub: melee ? `Tier ${up.meleeTier + 1}` : `Tier ${up.meleeTier} · Maxed`,
      price: melee ? melee.price : null,
    },
  ].map((o) => ({ ...o, can: o.price != null && canAfford(o.price) }));
}

/* Buy card `id` ("hp" | "gun" | "melee"). True if it went through. */
export function buy(id) {
  const o = offers().find((x) => x.id === id);
  if (!o || o.price == null || !spend(o.price)) return false;
  if (id === "hp") buyHealth();
  else if (id === "gun") applyGunTier(up.gunTier + 1);
  else if (id === "melee") applyMeleeTier(up.meleeTier + 1);
  return true;
}

function buyHealth() {
  const p = game.player;
  up.hpBuys++;
  p.maxHp = Math.min(HP_CAP, p.maxHp + HP_STEP);
  // the new health comes filled in
  p.hp = Math.min(p.maxHp, p.hp + HP_STEP);
}

/* The def `base` at tier t. */
export function tieredDef(base, t) {
  if (t <= 0) return base;
  const k = GUN_TIERS[t - 1].dmg;
  const def = {
    ...base,
    damage: base.damage * k,
    magSize: Math.max(base.magSize + 1, Math.round(base.magSize * (1 + 0.1 * t))),
    reloadTime: base.reloadTime * Math.pow(0.95, t),
    tier: t,
  };
  if (base.tacReloadTime) def.tacReloadTime = base.tacReloadTime * Math.pow(0.95, t);
  return def;
}

function applyGunTier(t) {
  up.gunTier = t;
  const p = game.player;
  for (const id of Object.keys(p.weapons)) {
    const base = up.base[id];
    if (!base) continue;
    const def = tieredDef(base, t);
    const w = new WeaponState(def);
    w.ammoReserve = Infinity;
    p.weapons[id] = w;
  }
  // the gun in your hands is the one you see
  if (p.holding === "gun") game.setActiveWeaponMesh(game.currentWeapon().def);
  updateGearHud();
}

function applyMeleeTier(t) {
  up.meleeTier = t;
  const def = MELEE_DEFS[MELEE_TIERS[t - 1].id];
  const p = game.player;
  p.melee = new MeleeState(def);
  game.setActiveMeleeMesh(def);
  if (game.activeMeleeMesh) game.activeMeleeMesh.visible = p.holding === "melee";
  updateGearHud();
}
