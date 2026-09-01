// Troll Ops — weapon definitions + per-frame gunplay state machine.
// Each weapon owns its own recoil pattern, sway, ADS speed and fire logic.
// The FPController drives this by calling update()/tryFire()/tryReload() each frame.

export const WEAPON_DEFS = {
  smg: {
    id: "smg", name: "Grinder SMG", sight: "reddot",
    fireMode: "auto", rpm: 780,
    damage: 18, headshotMult: 2.0, falloffStart: 14, falloffEnd: 40, falloffMin: 0.55,
    magSize: 30, reserveMax: 210, reloadTime: 1.55,
    spreadBase: 0.028, spreadMoving: 0.055, spreadAds: 0.006, spreadJump: 0.09,
    spreadRecoverRate: 6.5, spreadPerShot: 0.014, spreadMax: 0.16,
    recoilKickPitch: 0.016, recoilKickYaw: 0.010, recoilKickYawRand: 0.012,
    recoilRecover: 13, recoilKickKnockback: 0.008,
    adsTime: 0.16, adsFovMult: 0.82, adsMoveMult: 0.72,
    hipMoveMult: 1.0, sprintMult: 1.35,
    bobAmp: 0.028, bobSpeed: 11, swayAmp: 0.010, swaySpeed: 1.6, inertia: 9.5,
    muzzleFlashScale: 0.85, tracerWidth: 0.02, pellets: 1,
    weight: "light",
  },
  shotgun: {
    id: "shotgun", name: "Widemouth 12", sight: "iron",
    fireMode: "pump", rpm: 68,
    damage: 15, headshotMult: 1.6, falloffStart: 4, falloffEnd: 16, falloffMin: 0.15,
    pellets: 9, pelletSpread: 0.11,
    magSize: 7, reserveMax: 49, reloadTime: 2.6,
    spreadBase: 0.05, spreadMoving: 0.07, spreadAds: 0.028, spreadJump: 0.1,
    spreadRecoverRate: 5, spreadPerShot: 0.05, spreadMax: 0.2,
    recoilKickPitch: 0.055, recoilKickYaw: 0.02, recoilKickYawRand: 0.03,
    recoilRecover: 7, recoilKickKnockback: 0.05,
    adsTime: 0.22, adsFovMult: 0.92, adsMoveMult: 0.8,
    hipMoveMult: 0.95, sprintMult: 1.3,
    bobAmp: 0.034, bobSpeed: 9, swayAmp: 0.016, swaySpeed: 1.3, inertia: 6,
    muzzleFlashScale: 1.5, tracerWidth: 0.015,
    weight: "heavy",
  },
  marksman: {
    id: "marksman", name: "Longsmile .50", sight: "iron",
    fireMode: "bolt", rpm: 48,
    damage: 92, headshotMult: 2.4, falloffStart: 60, falloffEnd: 100, falloffMin: 0.85,
    magSize: 5, reserveMax: 30, reloadTime: 2.4,
    spreadBase: 0.006, spreadMoving: 0.035, spreadAds: 0.0008, spreadJump: 0.07,
    spreadRecoverRate: 8, spreadPerShot: 0.05, spreadMax: 0.12,
    recoilKickPitch: 0.075, recoilKickYaw: 0.01, recoilKickYawRand: 0.014,
    recoilRecover: 5.5, recoilKickKnockback: 0.09,
    adsTime: 0.32, adsFovMult: 0.55, adsMoveMult: 0.55,
    hipMoveMult: 0.85, sprintMult: 1.15,
    bobAmp: 0.02, bobSpeed: 7, swayAmp: 0.02, swaySpeed: 1.0, inertia: 4,
    muzzleFlashScale: 1.8, tracerWidth: 0.028,
    weight: "heavy",
  },
};

export class WeaponState {
  constructor(defId) {
    this.def = WEAPON_DEFS[defId];
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
    const yawKick = (Math.random() * 2 - 1) * this.def.recoilKickYawRand + this.def.recoilKickYaw;
    this.recoilPitch += this.def.recoilKickPitch;
    this.recoilYaw += yawKick;
    this.viewKickPitch += this.def.recoilKickPitch * 1.8;
    this.viewKickYaw += yawKick * 1.6;
    this.viewKickKnockback += this.def.recoilKickKnockback;
    this.spread = Math.min(this.def.spreadMax, this.spread + this.def.spreadPerShot);

    if (this.ammoInMag <= 0 && this.ammoReserve > 0) {
      // auto-reload prompt handled by controller
    }
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

    // Spread: recover toward base, add moving/jump/ads modifiers
    let targetBase = def.spreadBase;
    if (moving) targetBase = Math.max(targetBase, def.spreadMoving);
    if (!grounded || jumping) targetBase = Math.max(targetBase, def.spreadJump);
    targetBase *= 1 - this.adsT * (1 - def.spreadAds / def.spreadBase);
    this.spread += (targetBase - this.spread) * Math.min(1, dt * def.spreadRecoverRate);
    this.spread = Math.max(def.spreadAds * this.adsT + targetBase * (1 - this.adsT) * 0, this.spread);

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
    let m = this.ads ? this.def.adsMoveMult : this.def.hipMoveMult;
    return m;
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
