// Troll Ops — the things a scorestreak puts into the world.
//
// scorestreaks.js owns the meter and the ladder; this file owns the objects:
// a care package that falls and can be opened, a drone that hunts one target,
// an airstrike that marks and then lands, and a gunship that patrols and
// shoots. They share a lifecycle (spawn a mesh, run for a while, clean up)
// which is why they sit together rather than one file each.
//
// Authority: whoever CALLED the streak simulates it and reports the outcome.
// Everyone else renders a copy that never decides anything — see the "streak"
// case in net.js. `owned` on each entity is what separates the two.

import * as THREE from "three";
import { loadModel } from "./battlefield-props.js";

export const PARACHUTE_FALL_SPEED = 5.5;   // m/s under canopy
export const PACKAGE_CLAIM_RADIUS = 2.2;
export const PACKAGE_LIFETIME = 75;        // seconds before it's abandoned

export const DRONE_SPEED = 17;
export const DRONE_TURN = 2.8;             // rad/s
export const DRONE_LIFETIME = 12;
export const DRONE_KILL_RADIUS = 2.6;
export const DRONE_DAMAGE = 180;           // lethal on a clean hit
export const DRONE_SPLASH_RADIUS = 6;      // it's a warhead, not a bullet — anyone standing this
                                            // close to the target when it hits goes down too,
                                            // friend or foe

export const AIRSTRIKE_DELAY = 5.0;        // mark → impact
export const AIRSTRIKE_RADIUS = 11;
export const AIRSTRIKE_DAMAGE = 220;
export const AIRSTRIKE_BOMBS = 5;

export const HELI_ALTITUDE = 24;
export const HELI_SPEED = 13;
export const HELI_TURN = 0.9;
export const HELI_FIRE_RANGE = 46;
export const HELI_FIRE_INTERVAL = 0.42;
export const HELI_DAMAGE = 26;             // per burst round, not lethal alone
export const HELI_MAIN_ROTOR_RPS = 5.5;    // revolutions per second
export const HELI_TAIL_ROTOR_RPS = 11;

export const RECON_ALTITUDE = 34;
export const RECON_SPEED = 22;
export const RECON_PROP_RPS = 14;
// Long enough to cross any map at RECON_SPEED with margin on both ends.
export const RECON_LIFETIME = 9;

export const JET_ALTITUDE = 28;
export const JET_SPEED = 40;
export const JET_PROP_RPS = 20;
export const JET_LIFETIME = 6;

/* A parachute canopy, built in code — it exists for three seconds and does
   not deserve an asset. */
function makeParachute() {
  const g = new THREE.SphereGeometry(1.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.MeshLambertMaterial({
    color: 0xd8d2b4, side: THREE.DoubleSide, transparent: true, opacity: 0.95,
  });
  const canopy = new THREE.Mesh(g, m);
  canopy.position.y = 2.1;
  const group = new THREE.Group();
  group.add(canopy);
  // Four rigging lines.
  const lineMat = new THREE.LineBasicMaterial({ color: 0x2a2a22 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos(a) * 1.35, 2.0, Math.sin(a) * 1.35),
      new THREE.Vector3(0, 0.5, 0),
    ]);
    group.add(new THREE.Line(geo, lineMat));
  }
  return group;
}

/* -------------------------------------------------------- care package

   Falls from above the marked point, lands, then waits to be opened. The
   reward is decided by the caller at call time and travels on the wire, so
   two clients can never disagree about what was inside. */
export class CarePackage {
  constructor({ id, x, z, groundY, reward, owned, ownerTeam }) {
    this.id = id;
    this.x = x;
    this.z = z;
    this.groundY = groundY;
    this.reward = reward;
    this.owned = !!owned;
    this.ownerTeam = ownerTeam;
    this.y = groundY + 60;
    this.landed = false;
    this.claimed = false;
    this.age = 0;
    this.root = new THREE.Group();
    this.root.position.set(x, this.y, z);
    this.chute = makeParachute();
    this.root.add(this.chute);

    loadModel("care-package").then((obj) => {
      if (this.dead) return;
      this.crate = obj;
      this.root.add(obj);
    });
  }

  /* Returns "landed" the frame it touches down, else null. */
  update(dt) {
    this.age += dt;
    if (this.landed) return null;
    this.y -= PARACHUTE_FALL_SPEED * dt;
    if (this.y <= this.groundY) {
      this.y = this.groundY;
      this.landed = true;
      this.root.remove(this.chute);
      this.chute = null;
      this.root.position.y = this.y;
      return "landed";
    }
    this.root.position.y = this.y;
    // A slow drift so it doesn't read as a lift descending.
    this.root.rotation.y += dt * 0.35;
    return null;
  }

  withinClaim(px, pz) {
    return this.landed && !this.claimed
      && Math.hypot(px - this.x, pz - this.z) <= PACKAGE_CLAIM_RADIUS;
  }

  get expired() { return this.age > PACKAGE_LIFETIME; }

  dispose() {
    this.dead = true;
    this.root.parent?.remove(this.root);
  }
}

/* ------------------------------------------------------ hunter-killer drone

   Flies at one locked target and detonates on it. Short-lived by design: it
   is a guaranteed kill you have to aim, not an area denial tool. */
export class HunterDrone {
  constructor({ id, owned, target, pos, yaw = 0 }) {
    this.id = id;
    this.owned = !!owned;
    this.target = target;        // { id, pos } resolved by the caller each frame
    this.age = 0;
    this.yaw = yaw;
    this.done = false;
    this.root = new THREE.Group();
    this.root.position.copy(pos);
    this.rotors = [];

    loadModel("hunter-drone").then((obj) => {
      if (this.dead) return;
      this.root.add(obj);
      obj.traverse((n) => {
        if (n.name && n.name.startsWith("DroneRotor")) this.rotors.push(n);
      });
    });
  }

  /* Returns "hit" when it reaches its target, "expire" when it runs out. */
  update(dt, targetPos) {
    this.age += dt;
    for (const r of this.rotors) r.rotation.y += dt * 40;

    if (this.age > DRONE_LIFETIME) { this.done = true; return "expire"; }
    // (-sin(yaw), 0, -cos(yaw)) is the game's forward convention everywhere
    // else (movement.js's forwardVec, root.rotation.y = yaw on every other
    // rig) — this used to be the mirrored (sin, cos) pairing, which spawned
    // the drone launching backward from the yaw it was given (the player's
    // real look.yaw) and burned through its short lifetime before turning
    // itself back around onto the target.
    if (!targetPos) {
      // Target gone: fly on straight and burn out rather than hanging.
      this.root.position.x += -Math.sin(this.yaw) * DRONE_SPEED * dt;
      this.root.position.z += -Math.cos(this.yaw) * DRONE_SPEED * dt;
      return null;
    }

    const to = new THREE.Vector3().subVectors(targetPos, this.root.position);
    // Aim at the chest, not the feet.
    to.y += 0.9;
    const dist = to.length();
    if (dist <= DRONE_KILL_RADIUS) { this.done = true; return "hit"; }

    to.normalize();
    // Turn toward the target rather than snapping, so it arcs in and reads as
    // a guided thing rather than a teleport.
    const wantYaw = Math.atan2(-to.x, -to.z);
    let d = wantYaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += Math.max(-DRONE_TURN * dt, Math.min(DRONE_TURN * dt, d));

    const step = DRONE_SPEED * dt;
    this.root.position.x += -Math.sin(this.yaw) * step;
    this.root.position.z += -Math.cos(this.yaw) * step;
    // Climb or dive toward the target's height.
    this.root.position.y += Math.max(-step, Math.min(step, to.y * step * 1.6));
    this.root.rotation.y = this.yaw;
    // Bank into the turn.
    this.root.rotation.z = -d * 0.5;
    return null;
  }

  dispose() {
    this.dead = true;
    this.root.parent?.remove(this.root);
  }
}

/* ------------------------------------------------------------- recon plane

   UAV had no world presence at all — calling it only started a HUD/minimap
   reveal, so it never read as something happening. This is pure flavour: a
   spotter plane makes one straight pass overhead. It does not decide who
   gets revealed — startUav/uavUntil still own that — so a copy is safe to
   render for both the owner and everyone else off the same wire message. */
export class ReconPlane {
  constructor({ pos, yaw }) {
    this.age = 0;
    this.done = false;
    this.yaw = yaw;
    this.root = new THREE.Group();
    this.root.position.copy(pos);
    this.root.rotation.y = yaw;
    this.prop = null;

    loadModel("recon-drone").then((obj) => {
      if (this.dead) return;
      this.root.add(obj);
      this.prop = obj.getObjectByName("ReconProp") || null;
    });
  }

  update(dt) {
    this.age += dt;
    if (this.prop) this.prop.rotation.z += dt * Math.PI * 2 * RECON_PROP_RPS;
    const step = RECON_SPEED * dt;
    this.root.position.x += -Math.sin(this.yaw) * step;
    this.root.position.z += -Math.cos(this.yaw) * step;
    if (this.age > RECON_LIFETIME) { this.done = true; return "expire"; }
    return null;
  }

  dispose() {
    this.dead = true;
    this.root.parent?.remove(this.root);
  }
}

/* ---------------------------------------------------------------- strike jet

   Lightning Strike used to drop bombs that simply appeared in the air with
   nothing carrying them. This flies the same line the bombs already fall
   along (see runAirstrike in game.js), timed to arrive as the first bomb
   lands, so the explosions read as a bombing run instead of a mine field. */
export class StrikeJet {
  constructor({ from, to }) {
    this.age = 0;
    this.done = false;
    this.from = from.clone();
    this.to = to.clone();
    this.yaw = Math.atan2(-(to.x - from.x), -(to.z - from.z));
    this.root = new THREE.Group();
    this.root.position.copy(from);
    this.root.rotation.y = this.yaw;
    this.prop = null;

    loadModel("strike-jet").then((obj) => {
      if (this.dead) return;
      this.root.add(obj);
      this.prop = obj.getObjectByName("JetProp") || null;
    });
  }

  update(dt) {
    this.age += dt;
    if (this.prop) this.prop.rotation.z += dt * Math.PI * 2 * JET_PROP_RPS;
    const t = Math.min(1, this.age / (JET_LIFETIME * 0.4));
    this.root.position.lerpVectors(this.from, this.to, t);
    // Keep flying past the mark rather than stopping dead over the target.
    if (t >= 1) {
      const step = JET_SPEED * dt;
      this.root.position.x += -Math.sin(this.yaw) * step;
      this.root.position.z += -Math.cos(this.yaw) * step;
    }
    if (this.age > JET_LIFETIME) { this.done = true; return "expire"; }
    return null;
  }

  dispose() {
    this.dead = true;
    this.root.parent?.remove(this.root);
  }
}

/* ------------------------------------------------------- helicopter gunship

   Orbits the map at altitude and fires on whatever it can see. Simulated by
   the caller; everyone else gets its position off the same publishBot channel
   bots already use, so there is no new sync code for the copy.

   Patrol is a circle rather than waypoints: every map here is roughly
   symmetric about its centre (see pickBombSites in modes.js for the same
   observation), so a ring derived from the bounds covers all of them without
   per-map authoring. */
export class HelicopterGunship {
  constructor({ id, owned, bounds, seed = 0, team }) {
    this.id = id;
    this.owned = !!owned;
    this.team = team;
    this.age = 0;
    this.fireT = 0;
    this.done = false;

    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const spanX = bounds.maxX - bounds.minX;
    const spanZ = bounds.maxZ - bounds.minZ;
    this.centre = { x: cx, z: cz };
    // Just inside the bounds, so it never orbits out of sight of the map.
    this.radius = Math.min(spanX, spanZ) * 0.42;
    // Seeded so every client that renders a copy starts it in the same place.
    this.angle = (seed % 360) * (Math.PI / 180);
    this.dir = seed % 2 === 0 ? 1 : -1;

    this.root = new THREE.Group();
    this.mainRotor = null;
    this.tailRotor = null;
    this.searchlight = null;
    this.placeAtAngle();

    loadModel("helicopter").then((obj) => {
      if (this.dead) return;
      this.root.add(obj);
      obj.traverse((n) => {
        if (n.name === "MainRotor") this.mainRotor = n;
        else if (n.name === "TailRotor") this.tailRotor = n;
      });
      // The light is added in code, not modelled: a dynamic spotlight that
      // tracks what the gunship is looking at is more use than a glowing
      // lump on the hull.
      const light = new THREE.SpotLight(0xfff2d0, 3.2, 90, 0.34, 0.45, 1.4);
      light.position.set(0, -0.8, 1.6);
      this.searchlight = light;
      this.root.add(light);
      this.lightTarget = new THREE.Object3D();
      this.root.add(this.lightTarget);
      light.target = this.lightTarget;
    });
  }

  placeAtAngle() {
    this.root.position.set(
      this.centre.x + Math.cos(this.angle) * this.radius,
      HELI_ALTITUDE,
      this.centre.z + Math.sin(this.angle) * this.radius,
    );
  }

  /* `duration` comes from the streak def so the caller owns how long it stays.
     Returns "expire" once it's done. */
  update(dt, duration, aimAt) {
    this.age += dt;
    if (this.mainRotor) this.mainRotor.rotation.y += dt * Math.PI * 2 * HELI_MAIN_ROTOR_RPS;
    if (this.tailRotor) this.tailRotor.rotation.x += dt * Math.PI * 2 * HELI_TAIL_ROTOR_RPS;

    const prevAngle = this.angle;
    this.angle += this.dir * (HELI_SPEED / Math.max(1, this.radius)) * dt;
    this.placeAtAngle();

    // Face along the direction of travel, which on a circle is the tangent.
    const tangent = this.angle + this.dir * Math.PI / 2;
    const wantYaw = -tangent + Math.PI / 2;
    let d = wantYaw - this.root.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const turn = Math.max(-HELI_TURN * dt, Math.min(HELI_TURN * dt, d));
    this.root.rotation.y += turn;
    // Bank out of the turn rate, the way a real one leans into its circle.
    const targetRoll = -this.dir * 0.16;
    this.root.rotation.z += (targetRoll - this.root.rotation.z) * Math.min(1, dt * 2);

    // Point the searchlight at whatever it's engaging, else straight down.
    if (this.lightTarget) {
      if (aimAt) this.lightTarget.position.copy(this.root.worldToLocal(aimAt.clone()));
      else this.lightTarget.position.set(0, -HELI_ALTITUDE, 0);
    }

    this.fireT = Math.max(0, this.fireT - dt);
    if (this.age >= duration) { this.done = true; return "expire"; }
    return null;
  }

  /* True when the gun is off cooldown; the caller decides whether there is
     anything worth shooting and applies the damage. */
  tryFire() {
    if (this.fireT > 0) return false;
    this.fireT = HELI_FIRE_INTERVAL;
    return true;
  }

  get muzzle() {
    return this.root.localToWorld(new THREE.Vector3(0, -0.8, 2.9));
  }

  dispose() {
    this.dead = true;
    this.root.parent?.remove(this.root);
  }
}
