// Grin Sabers — the duel bot. It drives a Fighter's `intent` the way a
// person's input would, so it plays by exactly the same rules.
//
// It sees the opponent's swing when the windup starts, waits its reaction
// time, then guards: on the right side with its tier's accuracy, else a
// wrong guess. Better tiers chain combos, feint, counter after a perfect
// block, try disarms and mash harder in a clash.

import { blankIntent, REACH } from "../combat/fighter.js?v=gs1";
import { zoneFor } from "../combat/swings.js?v=gs1";

export const TIERS = [
  { name: "Noob",       colour: "#3dff6e", react: 0.42, read: 0.3,  combo: 1, heavy: 0.08, feint: 0,    counter: 0.1, disarm: 0,    dodge: 0.02, mash: 4,  aggro: 0.45 },
  { name: "Tryhard",    colour: "#ffd23a", react: 0.3,  read: 0.55, combo: 2, heavy: 0.14, feint: 0.05, counter: 0.4, disarm: 0.03, dodge: 0.06, mash: 6,  aggro: 0.6 },
  { name: "Sweat",      colour: "#b25cff", react: 0.2,  read: 0.75, combo: 4, heavy: 0.18, feint: 0.15, counter: 0.7, disarm: 0.1,  dodge: 0.1,  mash: 8,  aggro: 0.75 },
  { name: "Final boss", colour: "#ff2a1a", react: 0.14, read: 0.9,  combo: 4, heavy: 0.22, feint: 0.25, counter: 0.9, disarm: 0.22, dodge: 0.12, mash: 10, aggro: 0.85 },
];

const ZONES = ["left", "right", "high", "mid"];
const DIRS = ["R", "L", "O", "T"];

export class DuelBot {
  constructor(fighter, tierIndex = 1, rnd = Math.random) {
    this.f = fighter;
    this.tier = TIERS[tierIndex];
    this.rnd = rnd;
    this.seenSwing = null;    // the opponent swing being reacted to
    this.reactAt = 0;
    this.guardZone = null;
    this.guardUntil = 0;
    this.strafe = 1;
    this.strafeT = 0;
    this.nextAttackAt = 0;
    this.comboLeft = 0;
    this.feinting = false;
    this.mashT = 0;
    this.lastDir = null;
    this.disarmTry = false;
  }

  think(dt, now, opp) {
    const f = this.f, T = this.tier, r = this.rnd;
    const it = f.intent;
    Object.assign(it, blankIntent());
    if (f.frozen || !f.alive || !opp.alive) return;

    const dx = opp.pos.x - f.pos.x, dz = opp.pos.z - f.pos.z;
    const dist = Math.hypot(dx, dz);

    // Clash: mash at the tier's rate.
    if (f.state === "clash") {
      this.mashT -= dt;
      if (this.mashT <= 0) { it.mash = true; this.mashT = 1 / (T.mash * (0.8 + r() * 0.4)); }
      return;
    }

    // Disarmed: go and get it.
    if (f.state === "disarmed" && f.saberDrop) {
      const sx = f.saberDrop.pos.x - f.pos.x, sz = f.saberDrop.pos.z - f.pos.z;
      const fw = f.forward();
      const rx = Math.cos(f.yaw), rz = -Math.sin(f.yaw);
      const l = Math.hypot(sx, sz) || 1;
      it.mz = (sx * fw.x + sz * fw.z) / l;
      it.mx = (sx * rx + sz * rz) / l;
      return;
    }

    // --- defence: react to their windup
    const os = opp.state === "swing" ? opp.swing : null;
    if (os && os !== this.seenSwing && os.phase === "windup") {
      this.seenSwing = os;
      this.reactAt = now + T.react * (0.8 + r() * 0.5) * (os.heavy ? 0.85 : 1);
      const right = zoneFor(os.dir);
      this.guardZone = r() < T.read ? right : ZONES.filter((z) => z !== right)[Math.floor(r() * 3)];
      this.dodgeIt = r() < T.dodge * (os.heavy ? 2.5 : 1);
      this.disarmTry = this.guardZone === right && r() < T.disarm;
      // already winding up a swing of its own: usually commits to it
      this.bail = r() < T.feint + 0.1;
      this.guardUntil = 0;
    }
    if (this.seenSwing && now >= this.reactAt && opp.state === "swing" && opp.swing === this.seenSwing) {
      if (this.dodgeIt && f.state !== "dodge" && f.bp > 20) {
        it.dodge = true;
        it.mx = r() < 0.5 ? -1 : 1;
        it.mz = -0.4;
        this.dodgeIt = false;
        return;
      }
      if (f.state === "idle" || f.state === "guard" || (f.state === "swing" && f.swing.phase === "windup" && this.bail)) {
        it.guard = true;
        const z = this.guardZone;
        it.aimX = z === "left" ? -1 : z === "right" ? 1 : 0;
        it.aimY = z === "high" ? 1 : 0;
        this.guardUntil = now + 0.35;
        // disarm: flick the other way just before the blade lands
        const left = opp.swing.phase === "windup" ? opp.swing.windup - opp.swing.t : 0;
        if (this.disarmTry && (opp.swing.phase !== "windup" || left < 0.08)) {
          it.flick = { x: z === "left" ? 1 : z === "right" ? -1 : 0, y: z === "high" ? -1 : z === "mid" ? 1 : 0 };
          this.disarmTry = false;
        }
      }
    } else if (now < this.guardUntil && f.state === "guard") {
      // hold the guard a beat after their swing
      it.guard = true;
      const z = this.guardZone;
      it.aimX = z === "left" ? -1 : z === "right" ? 1 : 0;
      it.aimY = z === "high" ? 1 : 0;
    }

    // --- counter right after a perfect block or a clash win
    if (now < f.counterUntil && f.state !== "swing" && r() < T.counter * dt * 30) {
      it.attack = true;
      it.dir = this.pickDir();
      return;
    }

    // --- offence
    const inRange = dist < REACH - 0.05;
    if (f.state === "swing") {
      // keep the combo going while there's budget
      if (f.swing.phase !== "windup" && this.comboLeft > 0 && f.swing.queued == null && r() < 0.5) {
        it.attack = true;
        it.dir = this.pickDir();
        this.comboLeft--;
      }
      // feint: bail out of a windup into a guard
      if (this.feinting && f.swing.phase === "windup" && f.swing.t > f.swing.windup * 0.5) {
        it.guard = true;
        this.feinting = false;
      }
    } else if (inRange && (f.state === "idle" || f.state === "guard") && !it.guard && now >= this.nextAttackAt && f.bp > 18 && opp.state !== "ko") {
      if (r() < T.aggro) {
        it.attack = true;
        it.dir = this.pickDir();
        it.heavy = r() < T.heavy;
        this.comboLeft = Math.floor(r() * T.combo);
        this.feinting = r() < T.feint;
        // punish a staggered opponent
        if (opp.state === "stagger" || opp.state === "rebound" || opp.state === "disarmed") it.heavy = r() < 0.4;
      }
      this.nextAttackAt = now + 0.35 + r() * (1.3 - T.aggro);
    }

    // --- footwork: hold just inside reach, circle
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe = r() < 0.5 ? -1 : 1; this.strafeT = 1.2 + r() * 2; }
    const want = f.bp < 30 ? REACH + 0.6 : REACH - 0.25;
    it.mz = Math.max(-1, Math.min(1, (dist - want) * 1.6));
    it.mx = this.strafe * (Math.abs(dist - want) < 0.5 ? 0.7 : 0.3);
  }

  pickDir() {
    // not the same side twice in a row too often
    let d;
    do d = DIRS[Math.floor(this.rnd() * 4)]; while (d === this.lastDir && this.rnd() < 0.7);
    this.lastDir = d;
    return d;
  }
}
