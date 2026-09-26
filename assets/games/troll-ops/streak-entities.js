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
//
// Motion rule for everything here: where it can be, position is a pure
// function of `age` (plus a seed from the wire), not integrated frame by
// frame. Every client then plays the same flight from one message, and
// nothing can pop into existence mid-air: each flight starts and ends off
// the map.

import * as THREE from "three";
import { loadModel } from "./battlefield-props.js";

export const PACKAGE_CLAIM_RADIUS = 2.2;
export const PACKAGE_LIFETIME = 75;        // seconds before it's abandoned

export const DRONE_SPEED = 19;
export const DRONE_TURN = 3.4;             // rad/s at full speed
export const DRONE_LIFETIME = 14;
export const DRONE_LAUNCH = 0.8;           // seconds of straight climb off the hand
export const DRONE_KILL_RADIUS = 1.8;
export const DRONE_DAMAGE = 180;           // lethal on a clean hit
export const DRONE_SPLASH_RADIUS = 6;      // the warhead's blast radius
const DRONE_CLEAR = 0.35;                  // how close it lets itself get to a surface

export const AIRSTRIKE_DELAY = 5.0;        // mark → first impact
export const AIRSTRIKE_RADIUS = 11;
export const AIRSTRIKE_DAMAGE = 220;
export const AIRSTRIKE_BOMBS = 5;
export const AIRSTRIKE_SPACING = 3.4;      // metres between bombs along the run
const BOMB_FALL = 1.05;                    // seconds from release to impact

export const HELI_ALTITUDE = 24;
export const HELI_SPEED = 13;
export const HELI_FIRE_RANGE = 46;
export const HELI_FIRE_INTERVAL = 0.42;
export const HELI_DAMAGE = 26;             // per burst round, not lethal alone
export const HELI_MAIN_ROTOR_RPS = 5.5;    // revolutions per second
export const HELI_TAIL_ROTOR_RPS = 11;
export const HELI_ENTER = 5;               // seconds flying in from off the map
export const HELI_EXIT = 5;                // and back out again

export const RECON_ALTITUDE = 42;
export const RECON_SPEED = 20;
export const RECON_PROP_RPS = 14;

export const JET_ALTITUDE = 28;
export const JET_SPEED = 42;
export const JET_PROP_RPS = 20;

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _u = new THREE.Vector3();

function hashId(id) {
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

function smooth01(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/* A soft round sprite, shared by the smoke, the fireballs and the beacons. */
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

function glowSprite(color, scale) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: puffTexture(), color, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  s.scale.setScalar(scale);
  return s;
}

function disposeTree(g) {
  g.traverse((n) => {
    if (n.material && !n.material.userData?.shared) n.material.dispose();
  });
}

/* Signal smoke on a marked point: a burning core and a handful of
   camera-facing puffs. Green for a care package, red for an airstrike.
   Sprites are cheap and need no light. */
function makeSignalSmoke(puff = 0x52d65a, core = 0xb6ff9a) {
  const group = new THREE.Group();
  const coreSprite = glowSprite(core, 0.9);
  coreSprite.position.y = 0.2;
  group.add(coreSprite);
  const puffs = [];
  for (let i = 0; i < 10; i++) {
    const mesh = new THREE.Sprite(new THREE.SpriteMaterial({
      map: puffTexture(), color: puff, transparent: true, depthWrite: false, opacity: 0,
    }));
    group.add(mesh);
    puffs.push({ mesh, t: i / 10, life: 2.6 + (i % 3) * 0.4, ox: 0, oz: 0 });
  }
  group.userData = { core: coreSprite, puffs, drift: new THREE.Vector3(0.6, 0, 0.35) };
  return group;
}

/* Advance a signal smoke; `fade` 0..1 scales it out. */
function tickSignalSmoke(group, dt, age, fade) {
  const f = group.userData;
  for (const p of f.puffs) {
    p.t += dt / p.life;
    if (p.t >= 1) { p.t -= 1; p.ox = (Math.random() - 0.5) * 0.3; p.oz = (Math.random() - 0.5) * 0.3; }
    const t = p.t;
    p.mesh.position.set(p.ox + t * t * f.drift.x * 3, 0.3 + t * 5.5, p.oz + t * t * f.drift.z * 3);
    p.mesh.scale.setScalar(0.4 + t * 2.2);
    p.mesh.material.opacity = Math.sin(t * Math.PI) * 0.55 * fade;
  }
  f.core.material.opacity = fade * (0.7 + 0.3 * Math.sin(age * 23));
}

/* ------------------------------------------------------------ blast fx

   Streak explosions used to be a handful of sparks and a light flash, which
   is a grenade's budget; an airstrike made of five of them read as fireworks.
   This is the missing body: a fireball that balloons and burns out, a smoke
   column that climbs and spreads after it, and a shock ring on the ground.
   All sprites and one flat ring: no lights (see light-pool.js for why). */
const SMOKE_COLORS = [0x3b3733, 0x2f2c29, 0x4a4540];
const _emberCol = new THREE.Color(0x5a2a14);
export class BlastFx {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.ringGeo = new THREE.RingGeometry(0.72, 1, 48);
  }

  spawn(pos, scale = 1) {
    const g = new THREE.Group();
    g.position.copy(pos);
    const fire = [];
    // Two additive cores for the flash, then an opaque-ish orange body: an
    // all-additive fireball washes out to nothing over sunlit concrete.
    for (let i = 0; i < 12; i++) {
      const core = i < 3;
      const s = core
        ? glowSprite(0xfff0c0, 0.1)
        : new THREE.Sprite(new THREE.SpriteMaterial({
          map: puffTexture(), color: [0xff9a2e, 0xff7418, 0xffb347][i % 3], transparent: true, depthWrite: false,
        }));
      const a = Math.random() * Math.PI * 2, r = (core ? 0.3 : 0.6 + Math.random() * 1.4) * scale;
      fire.push({
        s, delay: core ? 0 : 0.02 + i * 0.018,
        off: new THREE.Vector3(Math.cos(a) * r, (core ? 0.8 : 0.5 + Math.random() * 2.2) * scale, Math.sin(a) * r),
        size: (core ? 6 : 3 + Math.random() * 2.6) * scale,
        life: core ? 0.35 : 0.8 + Math.random() * 0.5,
        core,
      });
      g.add(s);
    }
    const smoke = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: puffTexture(), color: SMOKE_COLORS[i % 3], transparent: true, depthWrite: false, opacity: 0,
      }));
      const a = Math.random() * Math.PI * 2, r = (0.4 + Math.random() * 1.6) * scale;
      smoke.push({
        s, delay: 0.15 + i * 0.05,
        off: new THREE.Vector3(Math.cos(a) * r, 0.6 * scale, Math.sin(a) * r),
        rise: (4 + Math.random() * 5) * scale,
        size: (3.4 + Math.random() * 2.6) * scale,
        life: 3.4 + Math.random() * 1.8,
      });
      g.add(s);
    }
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
      color: 0xffc27a, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    g.add(ring);
    this.scene.add(g);
    this.list.push({ g, t: 0, fire, smoke, ring, scale });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.t += dt;
      let alive = false;
      for (const f of b.fire) {
        const k = (b.t - f.delay) / f.life;
        if (k < 0) { f.s.visible = false; alive = true; continue; }
        f.s.visible = k < 1;
        if (k >= 1) continue;
        alive = true;
        const grow = 1 - Math.pow(1 - Math.min(1, k * (f.core ? 4 : 2.4)), 3);
        f.s.scale.setScalar(f.size * (0.25 + 0.75 * grow));
        f.s.position.copy(f.off).multiplyScalar(0.4 + grow * 0.6);
        f.s.position.y += k * 1.6 * b.scale;
        // The body burns bright, then darkens toward smoke as it fades.
        if (!f.core) f.s.material.color.lerp(_emberCol, Math.min(1, dt * 2.5));
        f.s.material.opacity = f.core ? 1 - k
          : (k < 0.3 ? 0.95 : Math.max(0, 1 - (k - 0.3) / 0.7) ** 1.4 * 0.95);
      }
      for (const m of b.smoke) {
        const k = (b.t - m.delay) / m.life;
        if (k < 0) { alive = true; continue; }
        if (k >= 1) { m.s.material.opacity = 0; continue; }
        alive = true;
        const e = 1 - (1 - k) * (1 - k);
        m.s.position.set(m.off.x * (1 + e), m.off.y + m.rise * e, m.off.z * (1 + e));
        m.s.scale.setScalar(m.size * (0.45 + e * 0.9));
        m.s.material.opacity = Math.min(1, k * 5) * (1 - k) * 0.78;
      }
      const rk = b.t / 0.45;
      if (rk < 1) {
        alive = true;
        const r = (1.5 + rk * 7) * b.scale;
        b.ring.scale.setScalar(r);
        b.ring.material.opacity = (1 - rk) * 0.7;
      } else b.ring.visible = false;
      if (!alive) {
        this.scene.remove(b.g);
        disposeTree(b.g);
        this.list.splice(i, 1);
      }
    }
  }

  clear() {
    for (const b of this.list) { this.scene.remove(b.g); disposeTree(b.g); }
    this.list.length = 0;
  }
}

/* -------------------------------------------------------- care package

   Black Ops 2's delivery, beat by beat:

     1. You throw a marker. It bounces, settles, and pours red smoke.
     2. A helicopter comes in low with the crate slung under it on a cable,
        slows to a hover over the smoke, and cuts it loose.
     3. The crate free-falls (no parachute in BO2) and slams into the dirt —
        hard enough to crush whoever is standing under it.
     4. A floating icon over the crate shows what's inside. Its owner
        captures it quickly; anyone else can steal it, slowly.

   Everything after the marker lands is a function of `age` and the id, so
   every client plays the same drop from the one "drop" message. The reward
   is rolled by the caller and travels on the wire, so two clients can never
   disagree about what was inside. */
export const PKG_MARKER_SPEED = 15;        // m/s off the hand
const MARKER_GRAVITY = 14;
export const PKG_RELEASE_AT = 6.5;         // seconds from the marker settling to the cut
const PKG_HELI_SPEED = 24;                 // m/s cruising in and out
const PKG_HOVER_ALT = 15;                  // metres above the smoke when it lets go
const PKG_HOVER_SOFT = 1.8;                // how gradually it slows into the hover
const PKG_FALL_G = 16;                     // a heavy crate: quicker than 9.8 reads right
const PKG_OPEN = 0.42;                     // crate pop when it's opened
export const PKG_CRUSH_RADIUS = 1.5;

/* The smoke marker: a stubby canister with a red cap and a blinking strobe.
   Shared by the hand-held viewmodel's look (streak-device.js builds its own)
   and the thrown/landed copy here. */
let markerGeo = null;
let markerMats = null;
function makeMarkerMesh() {
  if (!markerGeo) {
    markerGeo = {
      body: new THREE.CylinderGeometry(0.045, 0.045, 0.2, 10),
      cap: new THREE.CylinderGeometry(0.05, 0.05, 0.045, 10),
    };
    markerMats = {
      body: new THREE.MeshLambertMaterial({ color: 0x3b4034 }),
      cap: new THREE.MeshLambertMaterial({ color: 0xc8321f, emissive: 0x3a0804 }),
    };
    markerMats.body.userData.shared = markerMats.cap.userData.shared = true;
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(markerGeo.body, markerMats.body));
  const cap = new THREE.Mesh(markerGeo.cap, markerMats.cap);
  cap.position.y = 0.12;
  g.add(cap);
  const strobe = glowSprite(0xff3322, 0.35);
  strobe.position.y = 0.16;
  g.add(strobe);
  g.userData.strobe = strobe;
  return g;
}

function blinkStrobe(g, age) {
  const s = g.userData.strobe;
  if (s) s.material.opacity = (age * 2.5) % 1 < 0.18 ? 1 : 0.08;
}

/* The thrown marker. The caller simulates the real one (with the world
   hooks) and publishes where it settled; a copy flies the same throw for
   show and is replaced by the crate drop when the caller's "drop" arrives. */
export class MarkerCanister {
  /* world: { probe(from, dir, len), groundAt(x, z, fromY) } */
  constructor({ id, origin, dir, world, owned = false }) {
    this.id = id;
    this.owned = !!owned;
    this.world = world;
    this.age = 0;
    this.resting = false;
    this.pos = origin.clone();
    this.vel = dir.clone().normalize().multiplyScalar(PKG_MARKER_SPEED);
    this.spin = new THREE.Vector3(9 + Math.random() * 4, 0, 5);
    this.root = makeMarkerMesh();
    this.root.position.copy(this.pos);
  }

  /* Returns "rest" the frame it settles. */
  update(dt) {
    this.age += dt;
    blinkStrobe(this.root, this.age);
    if (this.resting) return null;
    this.vel.y -= MARKER_GRAVITY * dt;
    const speed = this.vel.length();
    const step = speed * dt;
    if (step > 1e-5) {
      const dir = _v.copy(this.vel).divideScalar(speed);
      const hit = this.world.probe(this.pos, dir, step + 0.06);
      if (hit < step + 0.06 && dir.y > -0.7) {
        // Off a wall: lose most of it and come back.
        this.pos.addScaledVector(dir, Math.max(0, hit - 0.06));
        this.vel.x *= -0.35; this.vel.z *= -0.35;
      } else {
        this.pos.addScaledVector(this.vel, dt);
      }
    }
    const floor = this.world.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.3) ?? 0;
    if (this.pos.y <= floor + 0.05) {
      this.pos.y = floor + 0.05;
      if (Math.abs(this.vel.y) < 1.4 && Math.hypot(this.vel.x, this.vel.z) < 1.2 || this.age > 6) {
        this.resting = true;
        this.floor = floor;
        // Lies on its side, cap up the slope a touch, smoking.
        this.root.position.copy(this.pos);
        this.root.rotation.set(0, Math.random() * Math.PI * 2, Math.PI / 2 - 0.2);
        return "rest";
      }
      this.vel.y = -this.vel.y * 0.3;
      this.vel.x *= 0.55; this.vel.z *= 0.55;
    }
    this.root.position.copy(this.pos);
    this.root.rotation.x += this.spin.x * dt;
    this.root.rotation.z += this.spin.z * dt;
    return null;
  }

  dispose() {
    this.dead = true;
    this.root.parent?.remove(this.root);
    this.root.userData.strobe?.material.dispose();
  }
}

export class CarePackage {
  constructor({ id, x, z, groundY, reward, owned, ownerTeam, ownerId = null }) {
    this.id = id;
    this.x = x;
    this.z = z;
    this.groundY = groundY;
    this.reward = reward;
    this.owned = !!owned;
    this.ownerTeam = ownerTeam;
    this.ownerId = ownerId;
    this.landed = false;
    this.claimed = false;
    this.age = 0;
    this.phase = "inbound";
    this.vy = 0;
    this.landT = 0;
    this.seed = hashId(id);

    this.root = new THREE.Group();
    this.crateHolder = new THREE.Group();  // the landing squash lives here
    this.root.add(this.crateHolder);

    // The marker lying on the spot, still smoking and blinking.
    this.marker = makeMarkerMesh();
    this.marker.position.set(x, groundY + 0.05, z);
    this.marker.rotation.set(0, this.seed * 6, Math.PI / 2 - 0.2);
    this.flare = makeSignalSmoke(0xd8452f, 0xff8a6a);
    this.flare.position.set(x, groundY, z);

    // The delivery helicopter, flying one line through the hover point.
    const yaw = this.seed * Math.PI * 2;
    this.heliDir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.heli = new THREE.Group();
    this.heli.rotation.order = "YXZ";
    this.heli.rotation.y = yaw;
    this.heliRotors = [];
    loadModel("helicopter").then((obj) => {
      if (this.dead) return;
      this.heli.add(obj);
      obj.traverse((n) => {
        if (n.name === "MainRotor") this.heliRotors.push([n, "y", HELI_MAIN_ROTOR_RPS]);
        else if (n.name === "TailRotor") this.heliRotors.push([n, "x", HELI_TAIL_ROTOR_RPS]);
      });
    });

    // The sling: one cable from the belly to the lid until the cut.
    this.cable = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0x1c1c18 }),
    );

    loadModel("care-package").then((obj) => {
      if (this.dead) return;
      this.crate = obj;
      this.crateHolder.add(obj);
    });
  }

  addTo(scene) {
    scene.add(this.root, this.heli, this.flare, this.marker, this.cable);
    this.placeHeli();
    this.placeSlung();
  }

  heliT() { return this.age - PKG_RELEASE_AT; }   // negative on the way in

  /* Slows into a hover over the smoke and speeds away again:
     s(t) = v (t - h tanh(t/h)) has speed v far out and zero at t = 0. */
  placeHeli() {
    const t = this.heliT() - 0.35;       // settled a beat before the cut
    const h = PKG_HOVER_SOFT;
    const s = PKG_HELI_SPEED * (t - h * Math.tanh(t / h));
    const far = 1 - Math.exp(-(t * t) / 9);
    const climb = t > 0 ? t * t * 0.9 : 0;
    this.heli.position.set(
      this.x + this.heliDir.x * s,
      this.groundY + PKG_HOVER_ALT + 2.2 + far * 9 + climb,
      this.z + this.heliDir.z * s,
    );
    // Nose down cruising in, flared nose-up while braking into the hover,
    // level over the drop, nose down again to leave.
    const speed = 1 - 1 / Math.cosh(t / h) ** 2;       // 0 at the hover, 1 cruising
    const braking = t < 0 ? Math.exp(-((t + 1.2) ** 2) / 0.6) : 0;
    this.heli.rotation.x = -0.16 * speed + 0.2 * braking;
    this.heli.rotation.z = Math.sin(this.age * 0.8 + this.seed * 5) * 0.03 * (1 - speed * 0.5);
    this.heli.visible = t > -8 && t < 8;
  }

  /* Until the cut, the crate hangs on its cable, swinging a little. */
  placeSlung() {
    const hp = this.heli.position;
    this.root.position.set(
      hp.x + Math.sin(this.age * 1.7) * 0.25,
      hp.y - 5.2,
      hp.z + Math.cos(this.age * 1.3) * 0.25,
    );
    this.root.rotation.set(Math.sin(this.age * 1.3) * 0.05, this.heli.rotation.y, Math.sin(this.age * 1.7) * 0.05);
    this.root.visible = this.heli.visible;
    this.setCable(true);
  }

  setCable(on) {
    this.cable.visible = on && this.heli.visible;
    if (!this.cable.visible) return;
    const a = this.cable.geometry.attributes.position;
    const hp = this.heli.position, cp = this.root.position;
    a.setXYZ(0, hp.x, hp.y - 1.3, hp.z);
    a.setXYZ(1, cp.x, cp.y + 0.9, cp.z);
    a.needsUpdate = true;
    this.cable.geometry.computeBoundingSphere();
  }

  /* Returns "landed" the frame it slams down, "gone" when an opened crate has
     finished popping, else null. */
  update(dt) {
    this.age += dt;
    for (const [n, axis, rps] of this.heliRotors) n.rotation[axis] += dt * Math.PI * 2 * rps;
    if (this.heli.parent) {
      this.placeHeli();
      if (this.heliT() > 8.5) { this.heli.parent.remove(this.heli); this.heli.visible = false; }
    }
    if (this.marker) blinkStrobe(this.marker, this.age);
    this.updateFlare(dt);

    if (this.phase === "inbound") {
      this.placeSlung();
      if (this.age < PKG_RELEASE_AT) return null;
      this.phase = "fall";
      this.setCable(false);
      this.root.visible = true;
      this.fallFrom = this.root.position.clone();
      this.vy = 0;
      this.y = this.fallFrom.y;
      this.fallT = 0;
    }

    if (this.phase === "fall") {
      this.fallT += dt;
      // Straight down onto the smoke (it was hovering over it), a slow
      // tumble from the cut, no chute.
      const k = Math.min(1, this.fallT / 0.6);
      this.root.position.x = this.fallFrom.x + (this.x - this.fallFrom.x) * k;
      this.root.position.z = this.fallFrom.z + (this.z - this.fallFrom.z) * k;
      this.vy += PKG_FALL_G * dt;
      this.y -= this.vy * dt;
      this.root.rotation.x += (Math.sin(this.seed * 11) * 0.12 - this.root.rotation.x) * Math.min(1, dt * 2);
      this.root.rotation.z += (Math.cos(this.seed * 7) * 0.1 - this.root.rotation.z) * Math.min(1, dt * 2);
      if (this.y <= this.groundY) {
        this.y = this.groundY;
        this.root.position.set(this.x, this.y, this.z);
        this.phase = "thud";
        this.landed = true;
        this.landT = 0;
        this.landTilt = [this.root.rotation.x, this.root.rotation.z];
        this.impactSpeed = this.vy;
        // The marker is under the crate now.
        if (this.marker) { this.marker.parent?.remove(this.marker); this.marker = null; }
        return "landed";
      }
      this.root.position.y = this.y;
      return null;
    }

    if (this.phase === "thud") {
      this.landT += dt;
      // A hard landing: a deep squash, a small bounce, settles flat.
      const q = this.landT / 0.45;
      const squash = q < 1 ? Math.sin(q * Math.PI) * 0.22 * (1 - q * 0.6) : 0;
      this.crateHolder.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
      const hop = this.landT < 0.4 ? Math.max(0, Math.sin((this.landT - 0.08) / 0.32 * Math.PI)) * 0.18 : 0;
      this.root.position.y = this.groundY + hop;
      const s = Math.min(1, this.landT / 0.4);
      const k = (1 - s) * Math.cos(s * Math.PI * 1.5);
      this.root.rotation.x = this.landTilt[0] * k;
      this.root.rotation.z = this.landTilt[1] * k;
      if (this.landT >= 0.5) {
        this.crateHolder.scale.set(1, 1, 1);
        this.root.position.y = this.groundY;
        this.root.rotation.x = this.root.rotation.z = 0;
        this.phase = "landed";
      }
    } else if (this.phase === "landed") {
      this.landT += dt;
    } else if (this.phase === "opening") {
      this.openT += dt;
      const k = Math.min(1, this.openT / PKG_OPEN);
      // A hop and a swell, then it folds away to nothing.
      const up = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.35;
      const s = k < 0.35 ? 1 + k * 0.4 : Math.max(0.001, 1.14 * (1 - (k - 0.35) / 0.65) ** 2);
      this.crateHolder.position.y = up;
      this.crateHolder.scale.set(s, s, s);
      this.crateHolder.rotation.y = k * k * 2.2;
      if (this.holo) this.holo.material.opacity = 1 - k;
      if (k >= 1) return "gone";
    }
    this.updateHolo();
    return null;
  }

  /* What's inside, floating over the landed crate (BO2 shows the reward's
     icon). The caller builds the texture; it can arrive late. */
  setIcon(texture) {
    if (this.holo || this.dead) return;
    this.holo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture, transparent: true, depthWrite: false, opacity: 0,
    }));
    this.holo.scale.setScalar(0.9);
    this.holo.renderOrder = 3;
    this.root.add(this.holo);
  }

  updateHolo() {
    if (!this.holo) return;
    const show = this.landed && this.phase !== "opening";
    this.holo.visible = this.landed;
    if (!show) return;
    const fadeIn = Math.min(1, Math.max(0, (this.landT - 0.4) / 0.5));
    this.holo.material.opacity = fadeIn * (0.85 + Math.sin(this.age * 3) * 0.08);
    this.holo.position.y = 1.9 + Math.sin(this.age * 1.8) * 0.08;
  }

  /* Someone opened it: play the pop. The caller removes it on "gone". */
  open() {
    this.claimed = true;
    if (this.phase === "opening") return;
    this.root.rotation.set(0, this.root.rotation.y, 0);
    this.crateHolder.scale.set(1, 1, 1);
    this.phase = "opening";
    this.openT = 0;
  }

  updateFlare(dt) {
    if (!this.flare) return;
    // Pours until a few seconds after the crate is down, then gutters out.
    const fade = this.landed ? Math.max(0, 1 - (this.landT - 3) / 2) : Math.min(1, this.age * 2);
    tickSignalSmoke(this.flare, dt, this.age, fade);
    if (fade <= 0 && this.landed) {
      this.flare.parent?.remove(this.flare);
      disposeTree(this.flare);
      this.flare = null;
    }
  }

  withinClaim(px, pz) {
    return this.landed && !this.claimed && this.phase !== "thud"
      && Math.hypot(px - this.x, pz - this.z) <= PACKAGE_CLAIM_RADIUS;
  }

  get expired() { return this.age > PKG_RELEASE_AT + PACKAGE_LIFETIME; }

  dispose() {
    this.dead = true;
    this.root.parent?.remove(this.root);
    this.heli.parent?.remove(this.heli);
    this.cable.parent?.remove(this.cable);
    this.cable.geometry.dispose();
    this.cable.material.dispose();
    this.marker?.parent?.remove(this.marker);
    this.holo?.material.dispose();
    if (this.flare) {
      this.flare.parent?.remove(this.flare);
      disposeTree(this.flare);
      this.flare = null;
    }
  }
}

/* ------------------------------------------------------ hunter-killer drone

   Climbs off the caller's hand, turns onto its target and dives in. The
   caller hands it the world each frame (`ctx`), because the old version knew
   nothing about the world: it flew through walls, into the floor, and on
   everyone else's screen it had no target at all and flew straight north.

   ctx = {
     target:  Vector3 | null   the target's FEET, re-resolved every frame
     probe(from, dir, len)     distance to the first solid (len if none)
     sweep(from, dir, len)     { t, normal, inside } of the first solid, or null
     groundAt(x, z, fromY)     floor height under a point
     route(p, target, out)     heading round the walls when it can't see it
   }

   Steering is a velocity vector turned toward the target at a capped rate,
   with the speed dropped while it's facing away so a target behind it gets a
   tight turn instead of a 6 m orbit. Walls ahead make it climb; a wall it
   can't clear is where it goes off. */
export class HunterDrone {
  constructor({ id, owned, targetId = null, pos, yaw = 0 }) {
    this.id = id;
    this.owned = !!owned;
    this.targetId = targetId;
    this.age = 0;
    this.done = false;
    this.frozen = false;         // a copy that thinks it arrived, awaiting the owner's word
    this.speed = 5;
    this.fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.vel = new THREE.Vector3(this.fwd.x * 1.5, 7, this.fwd.z * 1.5);
    this.lastYaw = yaw;
    this.root = new THREE.Group();
    this.root.rotation.order = "YXZ";
    this.root.position.copy(pos);
    this.root.rotation.y = yaw;
    this.root.scale.setScalar(0.4);   // grows to full size as it leaves the hand
    this.rotors = [];

    // A blinking red beacon, so it can be tracked across the sky.
    this.beacon = glowSprite(0xff3b2f, 0.28);
    this.beacon.position.y = 0.25;
    this.root.add(this.beacon);

    loadModel("hunter-drone").then((obj) => {
      if (this.dead) return;
      this.root.add(obj);
      obj.traverse((n) => {
        if (n.name && n.name.startsWith("DroneRotor")) this.rotors.push(n);
      });
    });
  }

  /* Returns "hit" (reached the target), "wall" (flew into something),
     "expire" (out of fuel) or null. */
  update(dt, ctx) {
    this.age += dt;
    const spin = Math.min(1, this.age / 0.4);
    for (const r of this.rotors) r.rotation.y += dt * 44 * spin;
    this.beacon.material.opacity = (this.age * 3) % 1 < 0.5 ? 1 : 0.2;
    this.root.scale.setScalar(0.4 + 0.6 * smooth01(this.age / 0.45));
    if (this.frozen) return null;

    if (this.age > DRONE_LIFETIME) { this.done = true; return "expire"; }
    const p = this.root.position;

    // 1. Launch: straight up off the hand, rotors spinning up, before it
    //    commits to a heading. The old drone left at chest height and turned
    //    in place, clipping whatever the caller stood next to.
    let want;
    let dist = Infinity;
    let routed = false;
    // Under a roof, the climb is cut short rather than punching through it.
    if (this.age < DRONE_LAUNCH && ctx.probe(p, THREE.Object3D.DEFAULT_UP, 1.4) < 1.4) {
      this.age = DRONE_LAUNCH;
      this.vel.set(this.fwd.x, 0, this.fwd.z).multiplyScalar(Math.max(4, this.speed));
    }
    if (this.age < DRONE_LAUNCH) {
      want = _w.set(this.fwd.x * 0.2, 1, this.fwd.z * 0.2).normalize();
      this.speed += (7 - this.speed) * Math.min(1, dt * 4);
    } else if (ctx.target) {
      // 2. Hunt: straight at the chest when it can see it; otherwise follow
      //    the route round the walls (ctx.route, the bots' flow field).
      want = _w.set(ctx.target.x - p.x, ctx.target.y + 1.0 - p.y, ctx.target.z - p.z);
      dist = want.length();
      if (dist <= DRONE_KILL_RADIUS) { this.done = true; return "hit"; }
      want.divideScalar(dist);
      const r = ctx.route?.(p, ctx.target, _u);
      if (r) { want.copy(r); routed = true; }
    } else {
      // No target (none alive, or the owner hasn't re-acquired yet): loiter
      // in a wide, slow climbing circle rather than flying off the map.
      want = _w.copy(this.vel).setY(0);
      if (want.lengthSq() < 1e-6) want.copy(this.fwd);
      want.normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.6);
      want.y = p.y < (ctx.groundAt(p.x, p.z, p.y) ?? 0) + 9 ? 0.3 : 0;
      want.normalize();
    }

    const dir = _v.copy(this.vel).normalize();
    if (this.age >= DRONE_LAUNCH) {
      // Obstacle ahead and the target isn't in front of it: climb over.
      const look = 3 + this.speed * 0.5;
      const ahead = ctx.probe(p, dir, look);
      if (!routed && ahead < look && dist > ahead + 1.5) {
        want.y = Math.max(want.y, 0.85);
        want.normalize();
      }
      // Keep off the floor until the final dive.
      const floor = ctx.groundAt(p.x, p.z, p.y + 0.5) ?? -Infinity;
      if (p.y - floor < 1.6 && dist > 5) {
        want.y = Math.max(want.y, 0.4);
        want.normalize();
      }
    }

    // Turn the velocity toward `want` at a capped rate.
    const dot = Math.max(-1, Math.min(1, dir.dot(want)));
    const angle = Math.acos(dot);
    const turn = DRONE_TURN * dt * (this.age < DRONE_LAUNCH ? 2 : 1);
    if (angle > 1e-4) {
      const t = Math.min(1, turn / angle);
      dir.lerp(want, t).normalize();
    }
    // Faster facing the target, slower while it swings round to it, and a
    // final kick on the dive.
    let wantSpeed = this.age < DRONE_LAUNCH ? 7
      : DRONE_SPEED * (0.4 + 0.6 * Math.max(0, dot)) * (dist < 10 ? 1.25 : 1);
    if (!ctx.target && this.age >= DRONE_LAUNCH) wantSpeed = 9;
    this.speed += (wantSpeed - this.speed) * Math.min(1, dt * 3);
    this.vel.copy(dir).multiplyScalar(this.speed);

    // Move with a swept collision (ctx.sweep gives the face it would hit).
    // Near the target, meeting cover is a hit on cover: it goes off there.
    // Anywhere else it slides along the surface, keeping DRONE_CLEAR off it,
    // instead of the old habit of flying into the first wall it met.
    let remaining = this.speed * dt;
    for (let iter = 0; iter < 3 && remaining > 1e-4; iter++) {
      const h = ctx.sweep(p, dir, remaining + DRONE_CLEAR);
      if (!h) { p.addScaledVector(dir, remaining); break; }
      if (h.t <= 1e-4 && h.inside) {
        // Started inside something (a spawn against geometry): step out.
        p.addScaledVector(h.normal, 0.08);
        break;
      }
      if (dist < 6 && this.age >= DRONE_LAUNCH) {
        p.addScaledVector(dir, Math.max(0, h.t - 0.2));
        this.done = true;
        return "wall";
      }
      const adv = Math.max(0, h.t - DRONE_CLEAR);
      p.addScaledVector(dir, adv);
      remaining -= adv;
      // Slide: drop the part of the heading that goes into the face.
      const into = dir.dot(h.normal);
      dir.addScaledVector(h.normal, -into);
      if (dir.lengthSq() < 1e-4) dir.copy(THREE.Object3D.DEFAULT_UP);
      dir.normalize();
      this.vel.copy(dir).multiplyScalar(this.speed);
    }

    // Nose along the flight path, banked into the turn.
    const yaw = Math.atan2(-dir.x, -dir.z);
    const yawRate = wrapAngle(yaw - this.lastYaw) / Math.max(dt, 1e-4);
    this.lastYaw = yaw;
    this.root.rotation.y = yaw;
    this.root.rotation.x += (Math.asin(Math.max(-1, Math.min(1, dir.y))) * 0.8 - this.root.rotation.x) * Math.min(1, dt * 8);
    const roll = Math.max(-0.6, Math.min(0.6, yawRate * 0.18));
    this.root.rotation.z += (roll - this.root.rotation.z) * Math.min(1, dt * 6);
    return null;
  }

  dispose() {
    this.dead = true;
    this.root.parent?.remove(this.root);
    this.beacon.material.dispose();
  }
}

/* ------------------------------------------------------------- recon plane

   UAV's world presence, as in Black Ops 2: a spotter plane flies in from off
   the map, circles high over it for as long as the UAV is up, then peels
   off and leaves. It used to materialise 34 m above the caller and make one
   straight pass. Pure flavour — it decides nothing (startUav/uavUntil own
   the reveal). The path is a function of age and the wire's seed, so every
   client flies the same one. */
const RECON_ENTER = 5;
const RECON_EXIT = 5;
export class ReconPlane {
  constructor({ bounds, yaw = 0, duration = 25 }) {
    this.age = 0;
    this.done = false;
    this.duration = duration;
    const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
    this.centre = { x: cx, z: cz };
    this.radius = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * 0.45 + 12;
    this.angle0 = yaw;
    this.dir = Math.sin(yaw * 7) > 0 ? 1 : -1;
    this.omega = this.dir * RECON_SPEED / this.radius;
    this.root = new THREE.Group();
    this.root.rotation.order = "YXZ";
    this.prop = null;
    this.place();

    loadModel("recon-drone").then((obj) => {
      if (this.dead) return;
      this.root.add(obj);
      this.prop = obj.getObjectByName("ReconProp") || null;
    });
  }

  pathAt(t, out) {
    const T = Math.min(t, this.duration);
    const a = this.angle0 + this.omega * T;
    const ca = Math.cos(a), sa = Math.sin(a);
    const tx = -sa * this.dir, tz = ca * this.dir;
    out.set(this.centre.x + ca * this.radius, RECON_ALTITUDE, this.centre.z + sa * this.radius);
    if (t < RECON_ENTER) {
      const k = 1 - smooth01(t / RECON_ENTER);
      const back = k * k * 130;
      out.x -= tx * back; out.z -= tz * back;
    } else if (t > this.duration) {
      const e = t - this.duration;
      const run = RECON_SPEED * e + 3 * e * e;
      out.x += tx * run; out.z += tz * run;
      out.y += e * e * 1.2;
    }
    return out;
  }

  place() {
    this.pathAt(this.age, this.root.position);
    const b = this.pathAt(this.age + 0.1, _w);
    const p = this.root.position;
    this.root.rotation.y = Math.atan2(-(b.x - p.x), -(b.z - p.z));
    // Banked into the orbit, levelling out to leave.
    const onOrbit = this.age > RECON_ENTER * 0.6 && this.age < this.duration;
    this.root.rotation.z += ((onOrbit ? this.dir * 0.28 : 0) - this.root.rotation.z) * 0.05;
  }

  update(dt) {
    this.age += dt;
    if (this.prop) this.prop.rotation.z += dt * Math.PI * 2 * RECON_PROP_RPS;
    this.place();
    if (this.age > this.duration + RECON_EXIT) { this.done = true; return "expire"; }
    return null;
  }

  dispose() {
    this.dead = true;
    this.root.parent?.remove(this.root);
  }
}

/* ------------------------------------------------------- lightning strike

   The whole strike as one timeline, from the mark to the last bomb:

     0 s          red smoke goes up on the mark
     ~1.5 s       the jet is in view far out, inbound along the run
     DELAY - fall it releases bombs one after another as it passes
     DELAY ...    each bomb lands on its own point along the run

   The old version started the jet 12 m from the mark at 10 m/s, sped it up
   to 40 m/s after 2.4 s, and set off the bombs on setTimeouts with no bomb
   ever drawn. Here the jet flies at one speed along one line, each bomb
   leaves the jet and falls along a real arc (carrying the jet's speed), and
   impacts happen when the bomb gets there, in game time.

   `update` returns the indexes of bombs that hit this frame; the caller
   resolves damage (owner only) and plays the blast. */
let bombGeo = null;
let bombMat = null;
function makeBomb() {
  if (!bombGeo) {
    bombGeo = {
      body: new THREE.CylinderGeometry(0.16, 0.16, 0.9, 10),
      nose: new THREE.SphereGeometry(0.16, 10, 6),
      fin: new THREE.BoxGeometry(0.46, 0.02, 0.16),
    };
    bombMat = new THREE.MeshLambertMaterial({ color: 0x3d4233 });
    bombMat.userData.shared = true;
  }
  const g = new THREE.Group();
  const body = new THREE.Mesh(bombGeo.body, bombMat);
  body.rotation.x = Math.PI / 2;         // long axis along z
  g.add(body);
  const nose = new THREE.Mesh(bombGeo.nose, bombMat);
  nose.position.z = -0.45;
  g.add(nose);
  for (let i = 0; i < 2; i++) {
    const fin = new THREE.Mesh(bombGeo.fin, bombMat);
    fin.position.z = 0.4;
    fin.rotation.z = i * Math.PI / 2;
    g.add(fin);
  }
  return g;
}

export class AirstrikeRun {
  /* groundAt(x, z) gives the floor height under a point. */
  constructor({ x, z, yaw = 0, delay = AIRSTRIKE_DELAY, groundAt, owned = false, team = null }) {
    this.x = x;
    this.z = z;
    this.owned = !!owned;
    this.team = team;
    this.age = 0;
    this.done = false;
    this.dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.groundC = groundAt(x, z);
    this.alt = this.groundC + JET_ALTITUDE;

    // Bomb i lands at offset s_i along the run, at t_i. The jet passes over
    // each landing point exactly at its t_i (bombs carry its speed).
    const n = AIRSTRIKE_BOMBS;
    this.bombs = [];
    for (let i = 0; i < n; i++) {
      const s = (i - (n - 1) / 2) * AIRSTRIKE_SPACING;
      const px = x + this.dir.x * s, pz = z + this.dir.z * s;
      const hitT = delay + (s - (-(n - 1) / 2) * AIRSTRIKE_SPACING) / JET_SPEED;
      this.bombs.push({
        s, hitT, relT: hitT - BOMB_FALL,
        at: new THREE.Vector3(px, groundAt(px, pz) + 0.3, pz),
        mesh: null, landed: false,
      });
    }
    this.s0 = this.bombs[0].s;
    this.t0 = this.bombs[0].hitT;
    this.endT = this.bombs[n - 1].hitT + 4;

    this.group = new THREE.Group();
    this.smoke = makeSignalSmoke(0xd8452f, 0xff8a6a);
    this.smoke.position.set(x, this.groundC, z);
    this.group.add(this.smoke);

    this.jet = new THREE.Group();
    this.jet.rotation.order = "YXZ";
    this.jet.rotation.y = yaw;
    this.jet.visible = false;
    this.group.add(this.jet);
    this.prop = null;
    loadModel("strike-jet").then((obj) => {
      if (this.dead) return;
      this.jet.add(obj);
      this.prop = obj.getObjectByName("JetProp") || null;
    });
  }

  addTo(scene) { scene.add(this.group); }

  /* Where the jet is at time t. */
  jetAt(t, out) {
    const s = this.s0 + JET_SPEED * (t - this.t0);
    return out.set(this.x + this.dir.x * s, this.alt, this.z + this.dir.z * s);
  }

  update(dt) {
    this.age += dt;
    const t = this.age;
    const hits = [];

    // Smoke burns through the run, then thins out.
    if (this.smoke) {
      const fade = Math.max(0, Math.min(1, (this.t0 + 1.5 - t) / 1.5));
      tickSignalSmoke(this.smoke, dt, t, fade);
      if (fade <= 0) { this.group.remove(this.smoke); disposeTree(this.smoke); this.smoke = null; }
    }

    // The jet: in view from ~3.8 s out (160 m) until as far past.
    const rel = t - this.t0;
    this.jet.visible = rel > -3.8 && rel < 3.8;
    if (this.jet.visible) {
      this.jetAt(t, this.jet.position);
      // A shallow dive into the run and a pull-up after it.
      this.jet.position.y += Math.min(4, rel * rel * 0.5);
      this.jet.rotation.x = Math.max(-0.25, Math.min(0.25, rel * 0.12));
      this.jet.rotation.z = Math.sin(t * 1.3) * 0.05;
      if (this.prop) this.prop.rotation.z += dt * Math.PI * 2 * JET_PROP_RPS;
    }

    for (let i = 0; i < this.bombs.length; i++) {
      const b = this.bombs[i];
      if (b.landed || t < b.relT) continue;
      if (!b.mesh) {
        b.mesh = makeBomb();
        b.mesh.rotation.order = "YXZ";
        b.mesh.rotation.y = this.jet.rotation.y;
        this.group.add(b.mesh);
        this.jetAt(b.relT, _v);
        b.from = _v.clone();
        b.from.y -= 0.9;                 // off the belly, not the canopy
      }
      const k = Math.min(1, (t - b.relT) / BOMB_FALL);
      // Horizontal: the jet's speed carries it straight on to its point.
      // Vertical: starts level, accelerates down.
      b.mesh.position.set(
        b.from.x + (b.at.x - b.from.x) * k,
        b.from.y + (b.at.y - b.from.y) * (0.15 * k + 0.85 * k * k),
        b.from.z + (b.at.z - b.from.z) * k,
      );
      b.mesh.rotation.x = -k * 1.1;       // nose tips over as it falls
      if (k >= 1) {
        b.landed = true;
        this.group.remove(b.mesh);
        b.mesh = null;
        hits.push(i);
      }
    }

    if (t > this.endT) this.done = true;
    return hits;
  }

  get impactsLeft() { return this.bombs.some((b) => !b.landed); }

  dispose() {
    this.dead = true;
    this.group.parent?.remove(this.group);
    if (this.smoke) disposeTree(this.smoke);
  }
}

/* ------------------------------------------------------- helicopter gunship

   Flies in from off the map, orbits, fires on whatever it can see, and flies
   back out. Everyone renders the same flight from the spawn message's seed.

   Patrol is a circle rather than waypoints: every map here is roughly
   symmetric about its centre (see pickBombSites in modes.js for the same
   observation), so a ring derived from the bounds covers all of them without
   per-map authoring.

   Its heading comes from where it's actually going (the path's derivative),
   not a formula for the orbit's tangent: that formula was the mirror image
   of the model's forward axis, so the gunship flew its whole orbit tail
   first, gun and searchlight on the tail. */
export class HelicopterGunship {
  constructor({ id, owned, bounds, seed = 0, team, lights = null, duration = 45 }) {
    this.id = id;
    this.owned = !!owned;
    this.team = team;
    this.lights = lights;
    this.duration = duration;
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
    // Seeded so every client that renders a copy flies the same path.
    this.angle0 = (seed % 360) * (Math.PI / 180);
    this.dir = seed % 2 === 0 ? 1 : -1;
    this.omega = this.dir * HELI_SPEED / Math.max(1, this.radius);

    this.root = new THREE.Group();
    this.root.rotation.order = "YXZ";
    this.mainRotor = null;
    this.tailRotor = null;
    this.searchlight = null;
    this.pathAt(0, this.root.position);
    this.root.rotation.y = this.headingAt(0);

    loadModel("helicopter").then((obj) => {
      if (this.dead) return;
      this.root.add(obj);
      obj.traverse((n) => {
        if (n.name === "MainRotor") this.mainRotor = n;
        else if (n.name === "TailRotor") this.tailRotor = n;
      });
      // A dynamic spotlight that tracks what the gunship is engaging.
      // Borrowed from the pool, never created: a new light recompiles every
      // lit shader in view (light-pool.js).
      const light = this.lights?.acquire("spot", this.root, {
        color: 0xfff2d0, intensity: 3.2, distance: 90, decay: 1.4, angle: 0.34, penumbra: 0.45,
      });
      if (!light) return;
      light.position.set(0, -0.8, -2.2);   // the nose is -z
      this.searchlight = light;
      this.lightTarget = new THREE.Object3D();
      this.root.add(this.lightTarget);
      light.target = this.lightTarget;
    });
  }

  /* Position at time t: in from off the map, the orbit, then out. */
  pathAt(t, out) {
    const r = this.radius;
    const T = Math.min(t, this.duration);
    const a = this.angle0 + this.omega * T;
    const ca = Math.cos(a), sa = Math.sin(a);
    // Unit tangent along the direction of travel, and outward radial.
    const tx = -sa * this.dir, tz = ca * this.dir;
    out.set(this.centre.x + ca * r, HELI_ALTITUDE + Math.sin(t * 0.7) * 0.5, this.centre.z + sa * r);
    if (t < HELI_ENTER) {
      // Approach along the tangent line from far behind, high, easing in.
      const k = 1 - smooth01(t / HELI_ENTER);
      const back = k * k * 110;
      out.x += -tx * back + ca * k * k * 25;
      out.z += -tz * back + sa * k * k * 25;
      out.y += k * k * 14;
    } else if (t > this.duration) {
      // Leave along the tangent, speeding up and climbing away.
      const e = t - this.duration;
      const run = HELI_SPEED * e + 4 * e * e;
      out.x += tx * run + ca * e * e * 1.5;
      out.z += tz * run + sa * e * e * 1.5;
      out.y += e * e * 1.1;
    }
    return out;
  }

  headingAt(t) {
    const a = this.pathAt(t, new THREE.Vector3());
    const b = this.pathAt(t + 0.1, new THREE.Vector3());
    return Math.atan2(-(b.x - a.x), -(b.z - a.z));
  }

  /* Firing window: settled into the orbit and not yet leaving. */
  get onStation() { return this.age > HELI_ENTER * 0.7 && this.age < this.duration; }

  /* Returns "expire" once it has flown back out. */
  update(dt, aimAt) {
    this.age += dt;
    if (this.mainRotor) this.mainRotor.rotation.y += dt * Math.PI * 2 * HELI_MAIN_ROTOR_RPS;
    if (this.tailRotor) this.tailRotor.rotation.x += dt * Math.PI * 2 * HELI_TAIL_ROTOR_RPS;

    const t = this.age;
    this.pathAt(t, this.root.position);
    const yaw = this.headingAt(t);
    const yaw2 = this.headingAt(t + 0.25);
    const yawRate = wrapAngle(yaw2 - yaw) / 0.25;
    this.root.rotation.y += wrapAngle(yaw - this.root.rotation.y) * Math.min(1, dt * 6);
    // Bank into the turn (turning left = yaw increasing = left wing down).
    const roll = Math.max(-0.4, Math.min(0.4, yawRate * 0.6));
    this.root.rotation.z += (roll - this.root.rotation.z) * Math.min(1, dt * 2.5);
    // Nose down in cruise, harder while it's hurrying in or out.
    const hurry = t < HELI_ENTER ? 1 - t / HELI_ENTER : t > this.duration ? Math.min(1, (t - this.duration) / 2) : 0;
    const pitch = -0.1 - 0.16 * hurry;
    this.root.rotation.x += (pitch - this.root.rotation.x) * Math.min(1, dt * 2);

    // Point the searchlight at whatever it's engaging, else ahead and down.
    if (this.lightTarget) {
      if (aimAt) this.lightTarget.position.copy(this.root.worldToLocal(_v.copy(aimAt)));
      else this.lightTarget.position.set(0, -HELI_ALTITUDE, -12);
    }

    this.fireT = Math.max(0, this.fireT - dt);
    if (t >= this.duration + HELI_EXIT) { this.done = true; return "expire"; }
    return null;
  }

  /* True when the gun is off cooldown; the caller decides whether there is
     anything worth shooting and applies the damage. */
  tryFire() {
    if (this.fireT > 0 || !this.onStation) return false;
    this.fireT = HELI_FIRE_INTERVAL;
    return true;
  }

  /* The chin gun, under the nose (the model's nose is -z). */
  get muzzle() {
    return this.root.localToWorld(new THREE.Vector3(0, -1.1, -2.6));
  }

  dispose() {
    this.dead = true;
    this.lights?.release(this.searchlight);
    this.searchlight = null;
    this.root.parent?.remove(this.root);
  }
}
