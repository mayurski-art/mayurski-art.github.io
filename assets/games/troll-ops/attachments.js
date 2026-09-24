// Troll Ops — attachments.
//
// Four slots, each option carrying real stat deltas rather than cosmetics.
// `mul` scales a field, `add` offsets it, `set` replaces it outright — optics
// use `set` for zoom because the sight decides magnification, so bolting an
// ACOG onto a sniper shouldn't stack into an absurd fraction.

import { WEAPON_DEFS } from "./weapons.js";

export const SLOTS = ["optic", "barrel", "underbarrel", "ammo"];

export const SLOT_LABELS = {
  optic: "Optic",
  barrel: "Barrel",
  underbarrel: "Underbarrel",
  ammo: "Ammo",
};

export const ATTACHMENTS = {
  optic: {
    iron:   { name: "Iron sights", desc: "No glass, fastest to the eye", mods: {} },
    reflex: { name: "Reflex", desc: "Clean dot, slight zoom", sight: "reddot",
              mods: { adsFovMult: { set: 0.74 }, adsTime: { mul: 1.03 } } },
    coyote: { name: "Coyote", desc: "More zoom, a little slower", sight: "reddot",
              mods: { adsFovMult: { set: 0.62 }, adsTime: { mul: 1.09 } } },
    acog:   { name: "ACOG 4x", desc: "Mid-range glass, slow to raise", sight: "scope",
              mods: { adsFovMult: { set: 0.34 }, adsTime: { mul: 1.24 }, adsMoveMult: { mul: 0.9 } } },
    scope8: { name: "Sniper scope 8x", desc: "Long glass, heavy to swing", sight: "scope",
              mods: { adsFovMult: { set: 0.18 }, adsTime: { mul: 1.5 }, adsMoveMult: { mul: 0.78 } } },
  },
  barrel: {
    none:       { name: "Standard", desc: "Factory barrel", mods: {} },
    suppressor: { name: "Suppressor", desc: "Quiet, hidden from the killfeed, softer hits", quiet: true,
                  mods: { damage: { mul: 0.92 }, muzzleVelocity: { mul: 0.9 }, recoilKickPitch: { mul: 0.95 }, muzzleFlashScale: { mul: 0.35 },
                          shakeJolt: { mul: 0.55 }, shakeScale: { mul: 0.88 } } },
    comp:       { name: "Compensator", desc: "Cuts vertical climb",
                  mods: { recoilKickPitch: { mul: 0.76 }, adsTime: { mul: 1.05 }, shakeVert: { mul: 0.8 } } },
    brake:      { name: "Muzzle brake", desc: "Cuts sideways wander, louder spread",
                  mods: { recoilKickYaw: { mul: 0.58 }, recoilKickYawRand: { mul: 0.58 }, spreadPerShot: { mul: 1.12 },
                          shakeSide: { mul: 0.45 }, shakeJolt: { mul: 1.1 } } },
  },
  underbarrel: {
    none:    { name: "None", desc: "Nothing under the rail", mods: {} },
    vert:    { name: "Vertical grip", desc: "Steadier under fire",
               mods: { recoilKickPitch: { mul: 0.84 }, adsMoveMult: { mul: 0.95 }, shakeVert: { mul: 0.55 } } },
    angled:  { name: "Angled grip", desc: "Faster to aim, quicker recovery",
               mods: { adsTime: { mul: 0.84 }, recoilRecover: { mul: 1.12 }, shakeRecover: { mul: 1.6 } } },
    laser:   { name: "Laser", desc: "Tighter hipfire, visible beam",
               mods: { spreadBase: { mul: 0.72 }, spreadMoving: { mul: 0.78 } } },
  },
  ammo: {
    standard: { name: "Standard", desc: "Balanced ball ammo", mods: {} },
    hollow:   { name: "Hollow point", desc: "More damage, won't punch walls",
                mods: { damage: { mul: 1.16 }, penetration: { mul: 0.35 }, falloffEnd: { mul: 0.85 } } },
    ap:       { name: "Armor piercing", desc: "Punches through cover, hits softer",
                mods: { penetration: { mul: 2.3 }, damage: { mul: 0.9 } } },
  },
};

// `skin` rides along with the attachments so it's saved per weapon and
// carried by the resolved def; null is the factory finish.
export const DEFAULT_LOADOUT = { optic: "iron", barrel: "none", underbarrel: "none", ammo: "standard", skin: null };

/* Which raw weapon fields each Customize bar is driven by, and whether a
   rise in the field is good for the player. `statDelta` below uses this to
   turn "adsTime went up 9%" into the right-coloured arrow on the right bar,
   so the UI never has to hardcode that lower ADS time is better. */
const DELTA_FIELDS = [
  { field: "damage",           label: "Damage",    better: "up" },
  { field: "rpm",              label: "Fire rate", better: "up" },
  { field: "falloffEnd",       label: "Range",     better: "up" },
  { field: "recoilKickPitch",  label: "Recoil",    better: "down" },
  { field: "recoilKickYaw",    label: "Sway",      better: "down" },
  { field: "shake",            label: "Shake",     better: "down", spoken: "firing shake" },
  // `label` is the chip text and has to stay short enough not to be clipped
  // in a card; `spoken` is what the screen reader gets where that shorthand
  // wouldn't be clear on its own.
  { field: "adsTime",          label: "ADS",       better: "down", spoken: "aim-down-sights speed" },
  { field: "spreadBase",       label: "Hipfire",   better: "down" },
  { field: "penetration",      label: "Pierce",    better: "up" },
  { field: "muzzleVelocity",   label: "Velocity",  better: "up" },
  { field: "magSize",          label: "Ammo",      better: "up" },
];

/* What choosing `key` in `slot` would do to the weapon you currently have,
   as a list of {label, pct, good}. Compared against the live loadout rather
   than the bare weapon, so the numbers answer "what changes if I click
   this", which is the question the Customize screen is actually asking. */
export function statDelta(weaponId, loadout, slot, key) {
  const before = resolveWeapon(weaponId, loadout);
  const after = resolveWeapon(weaponId, { ...loadout, [slot]: key });
  if (!before || !after) return [];

  const out = [];
  for (const { field, label, better, spoken } of DELTA_FIELDS) {
    const a = before[field], b = after[field];
    if (typeof a !== "number" || typeof b !== "number" || !a) continue;
    const pct = Math.round(((b - a) / Math.abs(a)) * 100);
    if (!pct) continue;
    out.push({ label, spoken: spoken || label, pct, good: better === "up" ? pct > 0 : pct < 0 });
  }
  // ADS field-of-view is the whole point of an optic but isn't a "stat" —
  // report it as magnification, which is what a player reads it as. It goes
  // first for optics because it's the thing you're actually choosing between;
  // the UI only has room for the first couple of entries.
  if (slot === "optic" && before.adsFovMult !== after.adsFovMult) {
    out.unshift({ label: "Zoom", spoken: "magnification", pct: null, good: null,
                  text: `${(1 / after.adsFovMult).toFixed(1)}×` });
  }
  return out;
}

export function defaultLoadoutFor(weaponId) {
  const def = WEAPON_DEFS[weaponId];
  // Weapons that ship with a dot keep it selected so the gun looks like itself.
  return { ...DEFAULT_LOADOUT, optic: def?.sight === "reddot" ? "reflex" : "iron" };
}

/* Apply a loadout's attachment mods to a base weapon, returning a new def.
   The base defs are never mutated — WeaponState takes the resolved copy. */
export function resolveWeapon(weaponId, loadout = DEFAULT_LOADOUT) {
  const base = WEAPON_DEFS[weaponId];
  if (!base) return null;
  const def = { ...base, attachments: { ...DEFAULT_LOADOUT, ...loadout } };

  for (const slot of SLOTS) {
    const choice = def.attachments[slot];
    const att = ATTACHMENTS[slot]?.[choice];
    if (!att) continue;
    if (att.sight) def.sight = att.sight;
    if (att.quiet) def.quiet = true;
    for (const [field, op] of Object.entries(att.mods)) {
      const cur = def[field];
      if (typeof cur !== "number") continue;
      if (op.set != null) def[field] = op.set;
      else if (op.mul != null) def[field] = cur * op.mul;
      else if (op.add != null) def[field] = cur + op.add;
    }
  }
  def.shake = shakeAmount(def);
  return def;
}

/* How hard a shot's kick shakes the camera: sub-linear in the recoil, pinned
   so the default assault rifle (0.021) maps to itself. */
export function kickCurve(recoilKickPitch) {
  return 0.021 * Math.pow(Math.max(0, recoilKickPitch) / 0.021, 0.6);
}

/* One number for how much a weapon shakes you when it fires: the kick, the
   up/down and sideways shares of it, how long it rings on, and how sharp
   each shot is. Feeds the Stability bar and the "Shake" delta chip. */
export function shakeAmount(def) {
  const axes = 0.6 * (def.shakeVert ?? 1) + 0.4 * (def.shakeSide ?? 1);
  return kickCurve(def.recoilKickPitch) * (def.shakeScale ?? 1) * axes
    / Math.sqrt(def.shakeRecover ?? 1) * (0.5 + 0.5 * (def.shakeJolt ?? 1));
}

/* Normalised 0..1 bars for the loadout screen. The divisors are the rough
   ceiling across the roster, so bars stay comparable between classes. */
export function statBars(def) {
  const dps = def.damage * (def.pellets || 1) * (def.rpm / 60);
  return {
    Damage: clamp01((def.damage * (def.pellets || 1)) / 120),
    "Fire rate": clamp01(def.rpm / 1200),
    Range: clamp01(def.falloffEnd / 150),
    Control: clamp01(1 - def.recoilKickPitch / 0.1),
    Stability: clamp01(1 - (def.shake ?? shakeAmount(def)) / 0.1),
    Mobility: clamp01((def.hipMoveMult * def.sprintMult) / 1.6),
    "Ammo": clamp01(def.magSize / 100),
    _dps: dps,
  };
}

function clamp01(v) { return Math.max(0.04, Math.min(1, v)); }
