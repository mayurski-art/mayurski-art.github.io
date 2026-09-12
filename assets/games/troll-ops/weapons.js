// Troll Ops — weapon roster + per-frame gunplay state machine.
//
// Weapons are built from a per-class base so a definition only states what
// makes that gun different. Every entry carries a `model` spec that
// weapon-model.js turns into geometry, and a `rank` that gates it in the
// loadout (see progression.js).

const COMMON = {
  headshotMult: 2.0,
  spreadRecoverRate: 6.5,
  recoilKickYawRand: 0.012,
  bobSpeed: 10,
  swaySpeed: 1.5,
  pellets: 1,
  tracerWidth: 0.02,
  tracerLength: 8,
  penetration: 1,
};

const CLASS_BASE = {
  assault: {
    fireMode: "auto", rpm: 700, damage: 26,
    falloffStart: 45, falloffEnd: 110, falloffMin: 0.5,
    magSize: 30, reserveMax: 210, reloadTime: 2.3,
    spreadBase: 0.026, spreadMoving: 0.05, spreadAds: 0.005, spreadJump: 0.085,
    spreadPerShot: 0.013, spreadMax: 0.15,
    recoilKickPitch: 0.021, recoilKickYaw: 0.009, recoilRecover: 11, recoilKickKnockback: 0.012,
    adsTime: 0.24, adsFovMult: 0.78, adsMoveMult: 0.66,
    hipMoveMult: 0.95, sprintMult: 1.3,
    bobAmp: 0.026, swayAmp: 0.011, inertia: 8,
    muzzleFlashScale: 1.0, muzzleVelocity: 780, penetration: 1.2,
    weight: "medium",
  },
  carbine: {
    fireMode: "auto", rpm: 780, damage: 23,
    falloffStart: 34, falloffEnd: 88, falloffMin: 0.48,
    magSize: 30, reserveMax: 210, reloadTime: 2.1,
    spreadBase: 0.024, spreadMoving: 0.046, spreadAds: 0.0045, spreadJump: 0.082,
    spreadPerShot: 0.012, spreadMax: 0.145,
    recoilKickPitch: 0.018, recoilKickYaw: 0.008, recoilRecover: 12, recoilKickKnockback: 0.01,
    adsTime: 0.2, adsFovMult: 0.8, adsMoveMult: 0.7,
    hipMoveMult: 1.0, sprintMult: 1.32,
    bobAmp: 0.026, swayAmp: 0.010, inertia: 9,
    muzzleFlashScale: 0.95, muzzleVelocity: 720, penetration: 1.0,
    weight: "medium",
  },
  pdw: {
    fireMode: "auto", rpm: 850, damage: 19,
    falloffStart: 16, falloffEnd: 46, falloffMin: 0.42,
    magSize: 30, reserveMax: 240, reloadTime: 1.8,
    spreadBase: 0.028, spreadMoving: 0.052, spreadAds: 0.006, spreadJump: 0.09,
    spreadPerShot: 0.013, spreadMax: 0.16,
    recoilKickPitch: 0.015, recoilKickYaw: 0.010, recoilRecover: 13.5, recoilKickKnockback: 0.008,
    adsTime: 0.16, adsFovMult: 0.84, adsMoveMult: 0.74,
    hipMoveMult: 1.05, sprintMult: 1.38,
    bobAmp: 0.028, swayAmp: 0.010, inertia: 9.5,
    muzzleFlashScale: 0.85, muzzleVelocity: 420, penetration: 0.8,
    weight: "light",
  },
  battle: {
    fireMode: "semi", rpm: 400, damage: 42,
    falloffStart: 60, falloffEnd: 140, falloffMin: 0.62,
    magSize: 20, reserveMax: 140, reloadTime: 2.5,
    spreadBase: 0.018, spreadMoving: 0.048, spreadAds: 0.003, spreadJump: 0.08,
    spreadPerShot: 0.03, spreadMax: 0.14,
    recoilKickPitch: 0.042, recoilKickYaw: 0.012, recoilRecover: 8, recoilKickKnockback: 0.035,
    adsTime: 0.28, adsFovMult: 0.7, adsMoveMult: 0.6,
    hipMoveMult: 0.9, sprintMult: 1.22,
    bobAmp: 0.024, swayAmp: 0.014, inertia: 6,
    muzzleFlashScale: 1.3, muzzleVelocity: 820, penetration: 1.8,
    weight: "heavy",
  },
  sniper: {
    fireMode: "bolt", rpm: 48, damage: 90,
    falloffStart: 70, falloffEnd: 150, falloffMin: 0.85,
    magSize: 5, reserveMax: 40, reloadTime: 2.6,
    spreadBase: 0.008, spreadMoving: 0.04, spreadAds: 0.0008, spreadJump: 0.075,
    spreadPerShot: 0.05, spreadMax: 0.13,
    recoilKickPitch: 0.07, recoilKickYaw: 0.01, recoilRecover: 5.5, recoilKickKnockback: 0.085,
    adsTime: 0.34, adsFovMult: 0.4, adsMoveMult: 0.5,
    hipMoveMult: 0.82, sprintMult: 1.15,
    bobAmp: 0.02, swayAmp: 0.02, inertia: 4,
    muzzleFlashScale: 1.8, muzzleVelocity: 900, penetration: 2.6,
    headshotMult: 2.4,
    weight: "heavy",
  },
  lmg: {
    fireMode: "auto", rpm: 620, damage: 30,
    falloffStart: 55, falloffEnd: 130, falloffMin: 0.55,
    magSize: 100, reserveMax: 300, reloadTime: 4.4,
    spreadBase: 0.038, spreadMoving: 0.075, spreadAds: 0.009, spreadJump: 0.12,
    spreadPerShot: 0.011, spreadMax: 0.19,
    recoilKickPitch: 0.026, recoilKickYaw: 0.014, recoilRecover: 9, recoilKickKnockback: 0.018,
    adsTime: 0.42, adsFovMult: 0.82, adsMoveMult: 0.45,
    hipMoveMult: 0.78, sprintMult: 1.12,
    bobAmp: 0.032, swayAmp: 0.016, inertia: 4.5,
    muzzleFlashScale: 1.4, muzzleVelocity: 800, penetration: 2.0,
    weight: "heavy",
  },
  shotgun: {
    fireMode: "pump", rpm: 70, damage: 15,
    falloffStart: 6, falloffEnd: 20, falloffMin: 0.12,
    pellets: 9, pelletSpread: 0.11,
    magSize: 7, reserveMax: 56, reloadTime: 2.6,
    spreadBase: 0.05, spreadMoving: 0.07, spreadAds: 0.028, spreadJump: 0.1,
    spreadPerShot: 0.05, spreadMax: 0.2,
    recoilKickPitch: 0.055, recoilKickYaw: 0.02, recoilKickYawRand: 0.03,
    recoilRecover: 7, recoilKickKnockback: 0.05,
    adsTime: 0.22, adsFovMult: 0.92, adsMoveMult: 0.8,
    hipMoveMult: 0.95, sprintMult: 1.3,
    bobAmp: 0.034, swayAmp: 0.016, inertia: 6,
    muzzleFlashScale: 1.5, tracerWidth: 0.015, tracerLength: 4,
    muzzleVelocity: 380, penetration: 0.35,
    headshotMult: 1.6,
    weight: "heavy",
  },
  sidearm: {
    fireMode: "semi", rpm: 450, damage: 28,
    falloffStart: 18, falloffEnd: 44, falloffMin: 0.4,
    magSize: 15, reserveMax: 90, reloadTime: 1.6,
    spreadBase: 0.03, spreadMoving: 0.055, spreadAds: 0.008, spreadJump: 0.095,
    spreadPerShot: 0.022, spreadMax: 0.16,
    recoilKickPitch: 0.03, recoilKickYaw: 0.011, recoilRecover: 12, recoilKickKnockback: 0.02,
    adsTime: 0.14, adsFovMult: 0.88, adsMoveMult: 0.85,
    hipMoveMult: 1.1, sprintMult: 1.42,
    bobAmp: 0.022, swayAmp: 0.009, inertia: 11,
    muzzleFlashScale: 0.8, muzzleVelocity: 380, penetration: 0.6,
    tracerLength: 5,
    weight: "light",
  },
};

export const CLASS_LABELS = {
  assault: "Assault rifles",
  carbine: "Carbines",
  pdw: "PDWs",
  battle: "Battle rifles",
  sniper: "Sniper rifles",
  lmg: "LMGs",
  shotgun: "Shotguns",
  sidearm: "Sidearms",
};

export const CLASS_ORDER = ["assault", "carbine", "pdw", "battle", "sniper", "lmg", "shotgun", "sidearm"];

function mk(cls, o) {
  return { ...COMMON, ...CLASS_BASE[cls], ...o, cls };
}

export const WEAPON_DEFS = {
  // ---------------- assault rifles
  problem416: mk("assault", {
    id: "problem416", name: "Problem 416", rank: 0, sight: "reddot",
    blurb: "The balanced default. No excuses left.",
    model: { len: 0.54, stock: "fixed", mag: "box", barrel: 1.0 },
  }),
  grinstock: mk("assault", {
    id: "grinstock", name: "Grinstock AR-12", rank: 8, sight: "iron",
    damage: 31, rpm: 600, recoilKickPitch: 0.028, muzzleVelocity: 715,
    blurb: "Hits like a brick. Climbs like one too.",
    model: { len: 0.56, stock: "folding", mag: "curved", barrel: 1.05 },
  }),
  bugbear: mk("assault", {
    id: "bugbear", name: "Bugbear AUG", rank: 18, sight: "reddot",
    rpm: 680, adsTime: 0.19, damage: 25,
    blurb: "Bullpup. Snaps to the shoulder.",
    model: { len: 0.5, stock: "bullpup", mag: "box", barrel: 1.1 },
  }),
  coalface: mk("assault", {
    id: "coalface", name: "Coalface AN-94", rank: 34, sight: "reddot",
    rpm: 1800, burst: 2, fireMode: "burst", damage: 27, recoilKickPitch: 0.014,
    blurb: "Two rounds land before the recoil does.",
    model: { len: 0.58, stock: "fixed", mag: "curved", barrel: 1.0 },
  }),

  // ---------------- carbines
  snubgrin: mk("carbine", {
    id: "snubgrin", name: "Snubgrin M4", rank: 0, sight: "reddot",
    blurb: "Short, quick, forgiving.",
    model: { len: 0.48, stock: "folding", mag: "box", barrel: 0.85 },
  }),
  trollboy: mk("carbine", {
    id: "trollboy", name: "Trollboy G36C", rank: 12, sight: "reddot",
    recoilKickPitch: 0.015, damage: 22, rpm: 820,
    blurb: "Barely kicks. Barely stings.",
    model: { len: 0.47, stock: "folding", mag: "curved", barrel: 0.82 },
  }),

  // ---------------- PDWs
  smg: mk("pdw", {
    id: "smg", name: "Grinder SMG", rank: 0, sight: "reddot",
    rpm: 780, damage: 18,
    blurb: "Fast fire, red dot, low recoil.",
    model: { len: 0.44, stock: "folding", mag: "box", barrel: 0.75 },
  }),
  chuckle: mk("pdw", {
    id: "chuckle", name: "Chuckle P90", rank: 14, sight: "reddot",
    magSize: 50, rpm: 900, damage: 16, reloadTime: 2.4, spreadBase: 0.024,
    blurb: "Fifty rounds of not aiming much.",
    model: { len: 0.4, stock: "bullpup", mag: "topbox", barrel: 0.6 },
  }),
  smirk: mk("pdw", {
    id: "smirk", name: "Smirk Vector", rank: 26, sight: "reddot",
    rpm: 1200, damage: 15, magSize: 25, recoilKickPitch: 0.009,
    blurb: "Empties itself if you blink.",
    model: { len: 0.42, stock: "folding", mag: "long", barrel: 0.66 },
  }),

  // ---------------- battle rifles / DMRs
  sneer: mk("battle", {
    id: "sneer", name: "Sneer SKS", rank: 4, sight: "iron",
    damage: 38, rpm: 450, magSize: 20, recoilKickPitch: 0.034,
    blurb: "Cheap, fast, three taps and done.",
    model: { len: 0.62, stock: "fixed", mag: "curved", barrel: 1.15, wood: true },
  }),
  bellow: mk("battle", {
    id: "bellow", name: "Bellow SCAR-H", rank: 10, sight: "reddot",
    damage: 45, rpm: 380,
    blurb: "Semi-auto sledgehammer.",
    model: { len: 0.6, stock: "folding", mag: "curved", barrel: 1.05 },
  }),
  greencandle: mk("battle", {
    id: "greencandle", name: "Green Candles", rank: 28, sight: "none",
    damage: 48, rpm: 340, magSize: 12, reserveMax: 60, reloadTime: 3.0,
    falloffStart: 40, falloffEnd: 100, falloffMin: 0.58,
    recoilKickPitch: 0.038, recoilKickKnockback: 0.03, recoilRecover: 7.5,
    adsTime: 0.3, adsFovMult: 0.82, muzzleVelocity: 620, muzzleFlashScale: 1.15,
    blurb: "Backpack tank, brass barrel, and a glow that means business.",
    model: { len: 0.58, stock: "tank", mag: "none", barrel: 0.85, heavy: true },
  }),

  // ---------------- snipers
  deadpan: mk("sniper", {
    id: "deadpan", name: "Deadpan 700", rank: 6, sight: "iron",
    damage: 78, rpm: 55, magSize: 6,
    blurb: "Fast bolt. Bring headshots.",
    model: { len: 0.74, stock: "fixed", mag: "none", barrel: 1.3, wood: true },
  }),
  hush: mk("sniper", {
    id: "hush", name: "Hush Intervention", rank: 22, sight: "iron",
    damage: 95, rpm: 45, magSize: 7,
    blurb: "Chest up, lights out.",
    model: { len: 0.8, stock: "fixed", mag: "box", barrel: 1.35 },
  }),
  marksman: mk("sniper", {
    id: "marksman", name: "Longsmile .50", rank: 40, sight: "iron",
    damage: 110, rpm: 40, magSize: 5, muzzleVelocity: 950, penetration: 3.4,
    recoilKickPitch: 0.09, adsTime: 0.4,
    blurb: "One shot. Anywhere. Anything.",
    model: { len: 0.86, stock: "fixed", mag: "box", barrel: 1.45, heavy: true },
  }),

  // ---------------- LMGs
  cackle: mk("lmg", {
    id: "cackle", name: "Cackle RPK", rank: 16, sight: "iron",
    magSize: 75, damage: 28, recoilKickPitch: 0.022, reloadTime: 3.6,
    blurb: "Controllable, for a bullet hose.",
    model: { len: 0.66, stock: "fixed", mag: "drum", barrel: 1.25, wood: true },
  }),
  bellylaugh: mk("lmg", {
    id: "bellylaugh", name: "Bellylaugh M60", rank: 30, sight: "iron",
    damage: 34, rpm: 550, recoilKickPitch: 0.034,
    blurb: "A hundred rounds and no apology.",
    model: { len: 0.72, stock: "fixed", mag: "drum", barrel: 1.35, heavy: true },
  }),

  // ---------------- shotguns
  shotgun: mk("shotgun", {
    id: "shotgun", name: "Widemouth 12", rank: 0, sight: "iron",
    blurb: "Iron sights, devastating up close.",
    model: { len: 0.62, stock: "fixed", mag: "tube", barrel: 1.1 },
  }),
  sawgrin: mk("shotgun", {
    id: "sawgrin", name: "Sawgrin KSG", rank: 11, sight: "iron",
    pellets: 10, pelletSpread: 0.075, magSize: 12, damage: 14,
    blurb: "Tighter spread, longer reach.",
    model: { len: 0.56, stock: "bullpup", mag: "tube", barrel: 0.95 },
  }),
  guffaw: mk("shotgun", {
    id: "guffaw", name: "Guffaw Saiga", rank: 24, sight: "reddot",
    fireMode: "semi", rpm: 240, pellets: 8, damage: 12, magSize: 10, reloadTime: 2.9,
    blurb: "Semi-auto panic button.",
    model: { len: 0.58, stock: "folding", mag: "curved", barrel: 0.95 },
  }),

  // ---------------- sidearms
  pocketgrin: mk("sidearm", {
    id: "pocketgrin", name: "Pocket Grin M9", rank: 0, sight: "iron",
    blurb: "Always there. Never impressive.",
    model: { len: 0.24, stock: "none", mag: "box", barrel: 0.5 },
  }),
  widedeagle: mk("sidearm", {
    id: "widedeagle", name: "Wide Deagle", rank: 9, sight: "iron",
    damage: 55, rpm: 260, magSize: 7, recoilKickPitch: 0.06, recoilKickKnockback: 0.045,
    blurb: "Two shots, and everyone heard both.",
    model: { len: 0.28, stock: "none", mag: "box", barrel: 0.6, heavy: true },
  }),
  chortle: mk("sidearm", {
    id: "chortle", name: "Chortle 18", rank: 20, sight: "iron",
    fireMode: "auto", rpm: 1100, damage: 18, magSize: 17,
    blurb: "A pistol with no self-control.",
    model: { len: 0.25, stock: "none", mag: "long", barrel: 0.5 },
  }),
};

export const WEAPON_IDS = Object.keys(WEAPON_DEFS);

export function weaponsInClass(cls) {
  return WEAPON_IDS.filter((id) => WEAPON_DEFS[id].cls === cls).sort((a, b) => WEAPON_DEFS[a].rank - WEAPON_DEFS[b].rank);
}

export class WeaponState {
  // Accepts an id, or an already-resolved def (base + attachment mods).
  constructor(defOrId) {
    this.def = typeof defOrId === "string" ? WEAPON_DEFS[defOrId] : defOrId;
    this.ammoInMag = this.def.magSize;
    this.ammoReserve = this.def.reserveMax - this.def.magSize;
    this.spread = this.def.spreadBase;
    this.fireCooldown = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.ads = false;
    this.adsT = 0; // 0 = hip, 1 = full ADS
    this.recoilPitch = 0; // camera kick accumulators (recover over time)
    this.recoilYaw = 0;
    this.bobPhase = 0;
    this.pumpT = 0; // pump/bolt-action animation lock after shot
    this.burstLeft = 0;
    this.viewKickPitch = 0; // instantaneous kick applied to weapon model (visual only, decays)
    this.viewKickYaw = 0;
    this.viewKickKnockback = 0;
  }

  get fireInterval() { return 60 / this.def.rpm; }

  canFire() {
    return !this.reloading && this.fireCooldown <= 0 && this.ammoInMag > 0 && this.pumpT <= 0;
  }

  startReload() {
    if (this.reloading || this.ammoReserve <= 0 || this.ammoInMag >= this.def.magSize) return false;
    this.reloading = true;
    this.reloadT = this.def.reloadTime;
    return true;
  }

  cancelReloadIfDone(dt) {
    if (!this.reloading) return;
    this.reloadT -= dt;
    if (this.reloadT <= 0) {
      const need = this.def.magSize - this.ammoInMag;
      const take = Math.min(need, this.ammoReserve);
      this.ammoInMag += take;
      this.ammoReserve -= take;
      this.reloading = false;
    }
  }

  fire() {
    this.ammoInMag--;
    this.fireCooldown = this.fireInterval;
    if (this.def.fireMode === "pump" || this.def.fireMode === "bolt") {
      this.pumpT = this.def.fireMode === "bolt" ? 0.55 : 0.4;
    }
    // Shouldering the weapon steadies it: aimed fire kicks less than hipfire.
    const steady = 1 - this.adsT * 0.35;
    const yawKick = ((Math.random() * 2 - 1) * this.def.recoilKickYawRand + this.def.recoilKickYaw) * steady;
    this.recoilPitch += this.def.recoilKickPitch * steady;
    this.recoilYaw += yawKick;
    this.viewKickPitch += this.def.recoilKickPitch * 1.8 * steady;
    this.viewKickYaw += yawKick * 1.6;
    this.viewKickKnockback += this.def.recoilKickKnockback * steady;
    this.spread = Math.min(this.def.spreadMax, this.spread + this.def.spreadPerShot);
  }

  update(dt, { moving, sprinting, grounded, jumping, adsHeld, canAds }) {
    const def = this.def;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.pumpT = Math.max(0, this.pumpT - dt);
    this.cancelReloadIfDone(dt);

    // ADS blend
    const wantAds = adsHeld && canAds && !this.reloading;
    const adsSpeed = 1 / Math.max(0.05, def.adsTime);
    this.adsT += (wantAds ? 1 : -1) * adsSpeed * dt;
    this.adsT = Math.max(0, Math.min(1, this.adsT));
    this.ads = this.adsT > 0.5;

    // Spread: hip and ADS are two separate cones and `adsT` blends between
    // them. Scaling the hip figure by an ADS ratio instead (the old way) let
    // the moving penalty ride through the blend, so walking while aimed sat
    // at roughly twice the intended cone — the sights lied about where the
    // round was going. Phantom Forces keeps aimed fire tight while walking
    // and only really punishes sprinting and jumping, so mirror that.
    let hipTarget = def.spreadBase;
    if (moving) hipTarget = Math.max(hipTarget, def.spreadMoving);
    if (!grounded || jumping) hipTarget = Math.max(hipTarget, def.spreadJump);

    let adsTarget = def.spreadAds;
    if (moving) adsTarget *= sprinting ? 2.2 : 1.45;
    if (!grounded || jumping) adsTarget *= 3.5;

    const targetBase = hipTarget + (adsTarget - hipTarget) * this.adsT;
    this.spread += (targetBase - this.spread) * Math.min(1, dt * def.spreadRecoverRate);

    // Recoil recovery (camera returns toward center)
    const rec = def.recoilRecover;
    this.recoilPitch *= Math.max(0, 1 - rec * dt);
    this.recoilYaw *= Math.max(0, 1 - rec * dt);
    this.viewKickPitch *= Math.max(0, 1 - rec * 2.2 * dt);
    this.viewKickYaw *= Math.max(0, 1 - rec * 2.2 * dt);
    this.viewKickKnockback *= Math.max(0, 1 - rec * 3 * dt);

    // Bob phase advances with movement
    if (moving && grounded) {
      this.bobPhase += dt * def.bobSpeed * (sprinting ? 1.4 : 1);
    }
  }

  get moveSpeedMult() {
    return this.ads ? this.def.adsMoveMult : this.def.hipMoveMult;
  }
}

export function computeDamage(def, distance, isHead) {
  let falloff = 1;
  if (distance > def.falloffStart) {
    const t = Math.min(1, (distance - def.falloffStart) / Math.max(0.001, def.falloffEnd - def.falloffStart));
    falloff = 1 - t * (1 - def.falloffMin);
  }
  const base = def.damage * falloff;
  return isHead ? base * def.headshotMult : base;
}
