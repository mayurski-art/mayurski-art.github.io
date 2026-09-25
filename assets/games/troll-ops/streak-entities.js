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
  const g = new THREE.SphereGeometry(2.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.MeshLambertMaterial({
    color: 0xd8d2b4, side: THREE.DoubleSide, transparent: true, opacity: 0.95,
  });
  const canopy = new THREE.Mesh(g, m);
  canopy.position.y = 2.7;
  canopy.scale.y = 0.7;   // a flatter dome reads as cloth, not a bubble
  const group = new THREE.Group();
  group.add(canopy);
  // Six rigging lines down to the lid.
  const lineMat = new THREE.LineBasicMaterial({ color: 0x2a2a22, transparent: true, opacity: 0.95 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos(a) * 2.0, 2.7, Math.sin(a) * 2.0),
      new THREE.Vector3(0, 0.9, 0),
    ]);
    group.add(new THREE.Line(geo, lineMat));
  }
  return group;
}

/* -------------------------------------------------------- care package

   BO2's delivery, beat by beat: a helicopter comes in low over the marked
   spot, lets the crate go, and leaves. The crate drops a moment, the chute
   snaps open, it sways down, thumps into the dirt and the canopy folds over
   and sinks away. It used to appear 60 m up already under a dome that spun
   all the way down and vanished the frame it touched.

   Everything is a function of `age` and the id, so every client plays the
   same drop from the same one wire message. The reward is decided by the
   caller at call time and travels on the wire, so two clients can never
   disagree about what was inside. */
export const PACKAGE_DROP_ALT = 34;        // metres above the ground the heli lets go
const PKG_HELI_SPEED = 26;                 // m/s on the delivery pass
export const PKG_RELEASE_AT = 2.2;         // seconds from the call to the release
const PKG_FREEFALL = 0.55;                 // seconds before the chute opens
const PKG_CHUTE_OPEN = 0.4;                // canopy snap-open time
const PKG_FOLD = 1.3;                      // canopy fold-and-sink after touchdown

function hashId(id) {
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

export class CarePackage {
  constructor({ id, x, z, groundY, reward, owned, ownerTeam }) {
    this.id = id;
    this.x = x;
    this.z = z;
    this.groundY = groundY;
    this.reward = reward;
    this.owned = !!owned;
    this.ownerTeam = ownerTeam;
    this.landed = false;
    this.claimed = false;
    this.age = 0;
    this.phase = "inbound";
    this.y = groundY + PACKAGE_DROP_ALT;
    this.vy = 0;
    this.landT = 0;
    this.seed = hashId(id);

    this.root = new THREE.Group();
    this.root.position.set(x, this.y, z);
    this.root.visible = false;             // nothing to see until release
    this.crateHolder = new THREE.Group();  // the landing squash lives here
    this.root.add(this.crateHolder);
    this.chute = makeParachute();
    this.chute.scale.setScalar(0.01);
    this.chute.visible = false;
    this.root.add(this.chute);

    // Signal smoke on the marked spot from the moment it's called, so
    // everyone can see where it's coming down (and fight over it).
    this.flare = makeDropFlare();
    this.flare.position.set(x, groundY, z);

    // The delivery helicopter: one straight pass, over the spot at release.
    const yaw = this.seed * Math.PI * 2;
    this.heliDir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.heli = new THREE.Group();
    this.heli.rotation.order = "YXZ";
    this.heli.rotation.y = yaw;
    this.heli.rotation.x = -0.12;          // nose down, it's in a hurry
    this.heliRotors = [];
    loadModel("helicopter").then((obj) => {
      if (this.dead) return;
      this.heli.add(obj);
      obj.traverse((n) => {
        if (n.name === "MainRotor") this.heliRotors.push([n, "y", 5.5]);
        else if (n.name === "TailRotor") this.heliRotors.push([n, "x", 11]);
      });
    });

    loadModel("care-package").then((obj) => {
      if (this.dead) return;
      this.crate = obj;
      this.crateHolder.add(obj);
    });
  }

  /* Adds everything this drop draws: the crate (root), the heli and the
     smoke, which live in world space rather than swaying with the crate. */
  addTo(scene) {
    scene.add(this.root);
    scene.add(this.heli);
    scene.add(this.flare);
    this.placeHeli();
  }

  placeHeli() {
    const t = this.age - PKG_RELEASE_AT;   // negative on the way in
    this.heli.position.set(
      this.x + this.heliDir.x * PKG_HELI_SPEED * t,
      this.groundY + PACKAGE_DROP_ALT + 1.6 + Math.max(0, t) * t * 1.2,   // climbs out after the drop
      this.z + this.heliDir.z * PKG_HELI_SPEED * t,
    );
    // Flares nose-up to slow over the spot, then dips to leave.
    this.heli.rotation.x = t < 0 ? -0.12 + 0.2 * Math.exp(-t * t * 1.5) : -0.18;
    this.heli.visible = t > -4 && t < 4.5;
  }

  /* Returns "landed" the frame it touches down, else null. */
  update(dt) {
    this.age += dt;
    for (const [n, axis, rps] of this.heliRotors) n.rotation[axis] += dt * Math.PI * 2 * rps;
    if (this.heli.parent) {
      this.placeHeli();
      if (this.age > PKG_RELEASE_AT + 4.5) this.heli.parent.remove(this.heli);
    }
    this.updateFlare(dt);

    if (this.phase === "inbound") {
      if (this.age < PKG_RELEASE_AT) return null;
      this.phase = "fall";
      this.root.visible = true;
      this.fallT = 0;
    }

    if (this.phase === "fall") {
      this.fallT += dt;
      const open = this.fallT - PKG_FREEFALL;
      if (open < 0) {
        this.vy = Math.min(this.vy + 9.8 * dt, 14);
        // A little tumble off the skid.
        this.crateHolder.rotation.x = Math.sin(this.fallT * 5 + this.seed * 9) * 0.18;
      } else {
        this.chute.visible = true;
        // Snap open with a small overshoot, then the canopy breathes.
        const k = Math.min(1, open / PKG_CHUTE_OPEN);
        const pop = k < 1
          ? (1 - Math.pow(1 - k, 3)) * (1 + 0.18 * Math.sin(k * Math.PI))
          : 1 + Math.sin(open * 2.4) * 0.03;
        this.chute.scale.set(pop, k < 1 ? pop * (0.6 + 0.4 * k) : 1, pop);
        // The opening shock bleeds speed down to the canopy's terminal rate.
        this.vy += (PARACHUTE_FALL_SPEED - this.vy) * Math.min(1, dt * 3.2);
        this.crateHolder.rotation.x *= Math.max(0, 1 - dt * 3);
        // Pendulum sway under the canopy, not a spin.
        const sw = Math.min(1, open / 1.2);
        this.root.rotation.x = Math.sin(open * 1.7 + this.seed * 6) * 0.13 * sw;
        this.root.rotation.z = Math.sin(open * 1.3 + this.seed * 3) * 0.1 * sw;
        this.root.rotation.y = this.seed * 6 + Math.sin(open * 0.4) * 0.35;
      }
      this.y -= this.vy * dt;
      if (this.y <= this.groundY) {
        this.y = this.groundY;
        this.root.position.y = this.y;
        this.phase = "fold";
        this.landed = true;
        this.landT = 0;
        this.root.rotation.x = this.root.rotation.z = 0;
        this.crateHolder.rotation.x = 0;
        this.chuteTilt = this.seed > 0.5 ? 1 : -1;
        return "landed";
      }
      this.root.position.y = this.y;
      return null;
    }

    if (this.phase === "fold") {
      this.landT += dt;
      // Thump: squash and settle.
      const q = this.landT / 0.35;
      const squash = q < 1 ? Math.sin(q * Math.PI) * 0.16 * (1 - q * 0.5) : 0;
      this.crateHolder.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
      // The canopy tips off the crate, collapses and sinks away.
      const f = Math.min(1, this.landT / PKG_FOLD);
      const e = f * f * (3 - 2 * f);
      this.chute.rotation.z = -this.chuteTilt * e * 1.35;
      this.chute.position.x = this.chuteTilt * e * 1.6;
      this.chute.position.y = -e * 1.2;
      this.chute.scale.set(1 + e * 0.25, Math.max(0.05, 1 - e * 0.9), 1 + e * 0.25);
      for (const n of this.chute.children) if (n.material) n.material.opacity = 0.95 * (1 - Math.max(0, e - 0.6) / 0.4);
      if (f >= 1) {
        this.root.remove(this.chute);
        this.chute = null;
        this.crateHolder.scale.set(1, 1, 1);
        this.phase = "landed";
      }
    } else if (this.phase === "landed") {
      this.landT += dt;
    }
    return null;
  }

  updateFlare(dt) {
    if (!this.flare) return;
    const f = this.flare.userData;
    // Burns until a few seconds after touchdown, then gutters out.
    const fade = this.landed ? Math.max(0, 1 - (this.landT - 3) / 2) : 1;
    for (const p of f.puffs) {
      p.t += dt / p.life;
      if (p.t >= 1) { p.t -= 1; p.ox = (Math.random() - 0.5) * 0.3; p.oz = (Math.random() - 0.5) * 0.3; }
      const t = p.t;
      p.mesh.position.set(p.ox + t * t * f.drift.x * 3, 0.3 + t * 5.5, p.oz + t * t * f.drift.z * 3);
      p.mesh.scale.setScalar(0.4 + t * 2.2);
      p.mesh.material.opacity = Math.sin(t * Math.PI) * 0.55 * fade;
    }
    f.core.material.opacity = fade * (0.7 + 0.3 * Math.sin(this.age * 23));
    if (fade <= 0) {
      this.flare.parent?.remove(this.flare);
      disposeFlare(this.flare);
      this.flare = null;
    }
  }

  withinClaim(px, pz) {
    return this.landed && !this.claimed
      && Math.hypot(px - this.x, pz - this.z) <= PACKAGE_CLAIM_RADIUS;
  }

  get expired() { return this.age > PACKAGE_LIFETIME; }

  dispose() {
    this.dead = true;
    this.root.parent?.remove(this.root);
    this.heli.parent?.remove(this.heli);
    if (this.flare) {
      this.flare.parent?.remove(this.flare);
      disposeFlare(this.flare);
      this.flare = null;
    }
  }
}

/* Green signal smoke on the drop point: a burning core and a handful of
   camera-facing puffs. Sprites are cheap and need no light. */
let puffTex = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}

function makeDropFlare() {
  const group = new THREE.Group();
  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: puffTexture(), color: 0xb6ff9a, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  core.scale.setScalar(0.9);
  core.position.y = 0.2;
  group.add(core);
  const puffs = [];
  for (let i = 0; i < 10; i++) {
    const mesh = new THREE.Sprite(new THREE.SpriteMaterial({
      map: puffTexture(), color: 0x52d65a, transparent: true, depthWrite: false, opacity: 0,
    }));
    group.add(mesh);
    puffs.push({ mesh, t: i / 10, life: 2.6 + (i % 3) * 0.4, ox: 0, oz: 0 });
  }
  group.userData = { core, puffs, drift: new THREE.Vector3(0.6, 0, 0.35) };
  return group;
}

function disposeFlare(g) {
  g.traverse((n) => { if (n.material) n.material.dispose(); });
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
  constructor({ id, owned, bounds, seed = 0, team, lights = null }) {
    this.id = id;
    this.owned = !!owned;
    this.team = team;
    this.lights = lights;
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
      // Borrowed from the pool, never created: a new light recompiles every
      // lit shader in view (light-pool.js).
      const light = this.lights?.acquire("spot", this.root, {
        color: 0xfff2d0, intensity: 3.2, distance: 90, decay: 1.4, angle: 0.34, penumbra: 0.45,
      });
      if (!light) return;
      light.position.set(0, -0.8, 1.6);
      this.searchlight = light;
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
    this.lights?.release(this.searchlight);
    this.searchlight = null;
    this.root.parent?.remove(this.root);
  }
}
