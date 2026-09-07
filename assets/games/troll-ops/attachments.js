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
                  mods: { damage: { mul: 0.92 }, muzzleVelocity: { mul: 0.9 }, recoilKickPitch: { mul: 0.95 }, muzzleFlashScale: { mul: 0.35 } } },
    comp:       { name: "Compensator", desc: "Cuts vertical climb",
                  mods: { recoilKickPitch: { mul: 0.76 }, adsTime: { mul: 1.05 } } },
    brake:      { name: "Muzzle brake", desc: "Cuts sideways wander, louder spread",
                  mods: { recoilKickYaw: { mul: 0.58 }, recoilKickYawRand: { mul: 0.58 }, spreadPerShot: { mul: 1.12 } } },
  },
  underbarrel: {
    none:    { name: "None", desc: "Nothing under the rail", mods: {} },
    vert:    { name: "Vertical grip", desc: "Steadier under fire",
               mods: { recoilKickPitch: { mul: 0.84 }, adsMoveMult: { mul: 0.95 } } },
    angled:  { name: "Angled grip", desc: "Faster to aim, quicker recovery",
               mods: { adsTime: { mul: 0.84 }, recoilRecover: { mul: 1.12 } } },
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

export const DEFAULT_LOADOUT = { optic: "iron", barrel: "none", underbarrel: "none", ammo: "standard" };

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
  return def;
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
    Mobility: clamp01((def.hipMoveMult * def.sprintMult) / 1.6),
    "Ammo": clamp01(def.magSize / 100),
    _dps: dps,
  };
}

function clamp01(v) { return Math.max(0.04, Math.min(1, v)); }
