// Troll Ops — dropped-weapon pickups.
//
// Every PvP mode except Gun Game and One in the Chamber lets you scavenge:
// die holding a gun and it falls where you stood, sits for a few seconds,
// then disappears. Standing over one and holding X picks it up into the
// secondary slot — replacing the sidearm there, Call of Duty style — while
// holding X with nothing underfoot instantly swaps primary/secondary.
//
// Net-wise, drops are created locally by whichever client already knows
// about the death: our own via damagePlayer, everyone else's (bots we host,
// peers, bots peers host) via registerDeath's victimPos/victimWeaponId —
// no new network message, since the "died" message already carries who
// died and the position comes from their last state snapshot.

import * as THREE from "three";
import { buildWeaponMesh } from "./weapon-model.js";

const LIFETIME = 6;          // seconds a dropped weapon sits before despawning
const PICKUP_RADIUS = 1.6;   // how close you have to stand to grab it
const HOLD_TIME = 0.55;      // seconds of holding X before the swap/pickup lands

export class PickupSystem {
  constructor(scene) {
    this.scene = scene;
    this.drops = [];   // { id, def, pos, mesh, t }
  }

  /* Called by the client that owns the death (their own, or a bot they
     simulate) with the exact def the victim was holding. */
  drop(id, def, pos) {
    if (!def) return;
    const mesh = buildWeaponMesh(def);
    mesh.rotation.set(0, Math.random() * Math.PI * 2, Math.PI / 2 + 0.15);
    mesh.position.set(pos.x, 0.28, pos.z);
    mesh.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.scene.add(mesh);
    this.drops.push({ id, def, x: pos.x, z: pos.z, mesh, t: 0 });
  }

  removeAt(index) {
    const d = this.drops[index];
    this.scene.remove(d.mesh);
    d.mesh.traverse((o) => {
      if (o.isMesh) { o.geometry?.dispose(); }
    });
    this.drops.splice(index, 1);
  }

  clear() {
    while (this.drops.length) this.removeAt(this.drops.length - 1);
  }

  update(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      d.mesh.rotation.y += dt * 0.8;
      d.mesh.position.y = 0.28 + Math.sin(d.t * 2.2) * 0.03;
      if (d.t >= LIFETIME) this.removeAt(i);
    }
  }

  /* Nearest drop within pickup range of (x, z), or null. */
  nearest(x, z) {
    let best = null, bestD = PICKUP_RADIUS;
    for (const d of this.drops) {
      const dist = Math.hypot(d.x - x, d.z - z);
      if (dist < bestD) { best = d; bestD = dist; }
    }
    return best;
  }

  take(drop) {
    const i = this.drops.indexOf(drop);
    if (i >= 0) this.removeAt(i);
  }
}

/* Hold-X state machine, Call of Duty style: standing over a dropped weapon,
   holding X picks it up into your secondary slot — replacing whatever was
   there, sidearm included — after a beat, same weight as a plant/defuse so
   it can't be tapped for a free timing edge. Nothing underfoot, holding X
   just swaps primary/secondary instantly instead. */
export class SwapHold {
  constructor() { this.t = 0; this.active = false; }

  reset() { this.t = 0; this.active = false; }

  /* Returns "swap" the instant X is pressed with no drop underfoot, or
     "pickup" once held long enough over one. Null while nothing should
     happen yet. */
  update(dt, held, canPickup) {
    if (!held) { this.reset(); return null; }
    if (!canPickup) {
      if (!this.active) { this.active = true; return "swap"; }
      return null;
    }
    this.active = true;
    this.t += dt;
    if (this.t >= HOLD_TIME) { this.reset(); return "pickup"; }
    return "holding";
  }

  get progress() { return Math.min(1, this.t / HOLD_TIME); }
}
