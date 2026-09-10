// Troll Ops — melee weapons and throwables.
//
// Two systems that share a file because they share a slot in the player's
// head: the thing you swing when someone is already inside your barrel, and
// the thing you throw when they are behind cover. Both resolve damage through
// the same actor callbacks the bullets use, so grunts, zombies, bots and
// remote players all take a grenade the way they take a round.
//
// Grenades are simulated here rather than in ballistics.js: bullets want a
// fixed-step slab test that never bounces, grenades want a fat, bouncy,
// slow-moving body that comes to rest on the floor.

import * as THREE from "three";

const GRAVITY = 18;          // heavier than real so throws land where you look
const REST_SPEED = 0.9;      // below this a grenade stops rolling
const RADIUS = 0.11;

/* ------------------------------------------------------------------ melee */

export const MELEE_DEFS = {
  grinknife: {
    id: "grinknife", name: "Grin Knife", rank: 0,
    damage: 65, backstabMult: 3, range: 2.4, arc: 0.42,
    swing: 0.16, recover: 0.24, knock: 2.2,
    blurb: "Quick, quiet, and lethal from behind.",
    model: { kind: "knife", len: 0.2, wide: 0.032, blade: 0.014, color: 0xcfd6de, grip: 0x22262b },
  },
  crowgrin: {
    id: "crowgrin", name: "Crowgrin", rank: 7,
    damage: 95, backstabMult: 2, range: 2.7, arc: 0.5,
    swing: 0.22, recover: 0.34, knock: 4,
    blurb: "Heavier swing, and it opens doors nobody offered.",
    model: { kind: "bar", len: 0.46, wide: 0.036, blade: 0.036, color: 0xb4453a, grip: 0x8d3630, hook: true },
  },
  louisville: {
    id: "louisville", name: "Grinslugger", rank: 19,
    damage: 130, backstabMult: 1.6, range: 2.9, arc: 0.62,
    swing: 0.28, recover: 0.46, knock: 7,
    blurb: "Slow as a freight train, and about as forgiving.",
    model: { kind: "bat", len: 0.6, wide: 0.055, blade: 0.028, color: 0xa97844, grip: 0x2c2620 },
  },
};

export const MELEE_IDS = Object.keys(MELEE_DEFS);

/* Swing state machine. A swing is wind-up (`swing`) then recovery
   (`recover`); damage lands exactly once, on the frame the arc bottoms out,
   so holding the button can't machine-gun a knife. */
export class MeleeState {
  constructor(def) {
    this.def = typeof def === "string" ? MELEE_DEFS[def] : def;
    this.t = 0;             // seconds into the current swing, 0 = idle
    this.landed = true;     // has this swing's damage already been dealt?
  }

  get total() { return this.def.swing + this.def.recover; }
  get busy() { return this.t > 0; }
  canSwing() { return this.t <= 0; }

  start() {
    if (!this.canSwing()) return false;
    this.t = 1e-4;
    this.landed = false;
    return true;
  }

  /* Returns true on the single frame the blade should connect. */
  update(dt) {
    if (this.t <= 0) return false;
    this.t += dt;
    let hit = false;
    if (!this.landed && this.t >= this.def.swing) { this.landed = true; hit = true; }
    if (this.t >= this.total) this.t = 0;
    return hit;
  }

  /* 0 → 1 → 0 over the whole swing, for the view model animation. */
  get phase() {
    if (this.t <= 0) return 0;
    const d = this.def;
    return this.t < d.swing
      ? this.t / d.swing
      : Math.max(0, 1 - (this.t - d.swing) / d.recover);
  }
}

/* First-person melee model — same blocky vocabulary as the guns. */
export function buildMeleeMesh(def) {
  const m = def.model;
  const group = new THREE.Group();
  const mat = (c, rough = 0.45, metal = 0.65) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.15), mat(m.grip, 0.85, 0.05));
  grip.position.set(0, 0, 0.06);
  group.add(grip);

  if (m.kind === "bat") {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(m.blade * 0.5, m.wide, m.len, 10), mat(m.color, 0.8, 0.05));
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0, 0, -m.len / 2);
    group.add(shaft);
  } else if (m.kind === "bar") {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(m.wide, m.wide, m.len), mat(m.color, 0.55, 0.4));
    shaft.position.set(0, 0, -m.len / 2);
    group.add(shaft);
    if (m.hook) {
      const hook = new THREE.Mesh(new THREE.BoxGeometry(m.wide, 0.11, m.wide), mat(m.color, 0.55, 0.4));
      hook.position.set(0, -0.05, -m.len + 0.03);
      group.add(hook);
    }
  } else {
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.03), mat(m.grip, 0.7, 0.2));
    guard.position.set(0, 0, -0.01);
    group.add(guard);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(m.wide, m.blade, m.len), mat(m.color, 0.22, 0.9));
    blade.position.set(0, 0, -m.len / 2 - 0.02);
    group.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(m.wide * 0.62, 0.09, 4), mat(m.color, 0.22, 0.9));
    tip.rotation.x = -Math.PI / 2;
    tip.rotation.z = Math.PI / 4;
    tip.position.set(0, 0, -m.len - 0.06);
    group.add(tip);
  }

  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

/* -------------------------------------------------------------- throwables */

export const THROWABLE_DEFS = {
  frag: {
    id: "frag", name: "Frag", kind: "lethal", rank: 0,
    carried: 2, fuse: 3.2, cookable: true,
    radius: 8, damage: 190, minDamage: 20, selfMult: 0.75,
    throwSpeed: 20, bounce: 0.32, roll: 0.55,
    color: 0x4b5a3c, glow: 0xff7a2a,
    blurb: "Cook it, bounce it round the corner, count to three.",
  },
  firebomb: {
    id: "firebomb", name: "Firebomb", kind: "lethal", rank: 12,
    carried: 1, fuse: 4, impact: true,
    radius: 3, damage: 45, minDamage: 10, selfMult: 1,
    pool: { radius: 4.4, dps: 85, duration: 7.5 },
    throwSpeed: 18, bounce: 0, roll: 0,
    color: 0x8a5a2a, glow: 0xff9430,
    blurb: "Breaks where it lands and denies the room for seven seconds.",
  },
  flash: {
    id: "flash", name: "Flashbang", kind: "tactical", rank: 0,
    carried: 2, fuse: 1.9, cookable: true,
    radius: 13, damage: 0, minDamage: 0, selfMult: 1,
    blind: 4.2, stun: 3.4,
    throwSpeed: 21, bounce: 0.45, roll: 0.7,
    color: 0x8f959c, glow: 0xffffff,
    blurb: "No damage. Everything in the room forgets what it was doing.",
  },
  smoke: {
    id: "smoke", name: "Smoke", kind: "tactical", rank: 4,
    carried: 2, fuse: 1.6,
    radius: 0, damage: 0, minDamage: 0, selfMult: 1,
    smoke: { radius: 5.2, duration: 16, grow: 1.6 },
    throwSpeed: 19, bounce: 0.3, roll: 0.62,
    color: 0x5c6169, glow: 0xd8dde3,
    blurb: "Buys you the crossing. Nobody sees through it — including you.",
  },
  emp: {
    id: "emp", name: "EMP", kind: "tactical", rank: 9,
    carried: 1, fuse: 2.4, cookable: true,
    radius: 11, damage: 0, minDamage: 0, selfMult: 1,
    emp: { scramble: 6.5, drain: true },
    throwSpeed: 20, bounce: 0.4, roll: 0.5,
    color: 0x2d4a55, glow: 0x4fd6ff,
    blurb: "Kills optics, HUD and radar in the blast. Sights go dark, not you.",
  },
};

export const THROWABLE_IDS = Object.keys(THROWABLE_DEFS);
export const LETHAL_IDS = THROWABLE_IDS.filter((id) => THROWABLE_DEFS[id].kind === "lethal");
export const TACTICAL_IDS = THROWABLE_IDS.filter((id) => THROWABLE_DEFS[id].kind === "tactical");

/* Sphere vs AABB: pushes `pos` out of the box along the shallowest axis and
   returns that axis so the caller can reflect velocity on it. AABB-only
   collision means a grenade can only ever bounce off an axis plane, which is
   exactly what the rest of this game's collision assumes. */
function resolveSphere(pos, colliders) {
  for (const c of colliders) {
    if (pos.x + RADIUS < c.min.x || pos.x - RADIUS > c.max.x) continue;
    if (pos.y + RADIUS < c.min.y || pos.y - RADIUS > c.max.y) continue;
    if (pos.z + RADIUS < c.min.z || pos.z - RADIUS > c.max.z) continue;

    const pen = {
      x: Math.min(pos.x + RADIUS - c.min.x, c.max.x - (pos.x - RADIUS)),
      y: Math.min(pos.y + RADIUS - c.min.y, c.max.y - (pos.y - RADIUS)),
      z: Math.min(pos.z + RADIUS - c.min.z, c.max.z - (pos.z - RADIUS)),
    };
    const axis = pen.x < pen.y ? (pen.x < pen.z ? "x" : "z") : (pen.y < pen.z ? "y" : "z");
    const centre = (c.min[axis] + c.max[axis]) / 2;
    const sign = pos[axis] < centre ? -1 : 1;
    pos[axis] += sign * pen[axis];
    return { axis, sign };
  }
  return null;
}

class Grenade {
  constructor(def, origin, dir, speed, ownerId, fuseLeft) {
    this.def = def;
    this.ownerId = ownerId;
    this.pos = origin.clone();
    this.vel = dir.clone().multiplyScalar(speed);
    this.fuse = fuseLeft;
    this.resting = false;
    this.spin = new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  }
}

class FirePool {
  constructor(def, pos) {
    this.def = def;
    this.pos = pos.clone();
    this.life = def.pool.duration;
    this.tick = 0;
  }
}

/* A smoke cloud is a clump of drifting billboards rather than one sphere:
   overlapping soft puffs read as volume from outside and as a wall from
   inside, which one transparent ball never does. `sightRadius` is what
   line-of-sight tests use, and it grows in as the cloud actually fills. */
const PUFFS = 14;

class SmokeCloud {
  constructor(def, pos) {
    this.def = def;
    this.pos = pos.clone();
    this.pos.y = Math.max(this.pos.y, 0.4);
    this.life = def.smoke.duration;
    this.age = 0;
    this.puffs = [];
    for (let i = 0; i < PUFFS; i++) {
      // Spread through the volume, biased low and wide like real smoke.
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * def.smoke.radius * 0.78;
      this.puffs.push({
        offset: new THREE.Vector3(Math.cos(a) * r, Math.random() * def.smoke.radius * 0.62, Math.sin(a) * r),
        drift: new THREE.Vector3((Math.random() - 0.5) * 0.16, 0.06 + Math.random() * 0.1, (Math.random() - 0.5) * 0.16),
        scale: def.smoke.radius * (0.5 + Math.random() * 0.45),
        spin: (Math.random() - 0.5) * 0.5,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  /* 0 while the canister is still venting, 1 once it's a full wall. */
  get fill() {
    const inT = Math.min(1, this.age / this.def.smoke.grow);
    const outT = Math.min(1, this.life / 2.2);
    return Math.min(inT, outT);
  }

  get sightRadius() { return this.def.smoke.radius * this.fill; }

  blocks(a, b) {
    if (this.fill < 0.25) return false;
    return segmentHitsSphere(a, b, this.pos, this.sightRadius);
  }
}

/* Does the segment a→b pass within `radius` of `centre`? Used for smoke
   line-of-sight; the same closest-point-on-segment test the bots use. */
export function segmentHitsSphere(a, b, centre, radius) {
  if (radius <= 0) return false;
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const acx = centre.x - a.x, acy = centre.y - a.y, acz = centre.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  let t = len2 > 0 ? (acx * abx + acy * aby + acz * abz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = acx - abx * t, dy = acy - aby * t, dz = acz - abz * t;
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

/* Soft round blob, drawn once and shared by every puff. Canvas rather than
   an image file keeps this dependency-free and out of the CSP's way. */
function makePuffTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.72)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class GrenadeSystem {
  constructor(scene) {
    this.scene = scene;
    this.live = [];
    this.pools = [];
    this.clouds = [];
    this.root = new THREE.Group();
    scene.add(this.root);
    this.geo = new THREE.IcosahedronGeometry(RADIUS, 0);
    this.mats = new Map();
    this.fireGeo = new THREE.CircleGeometry(1, 20);
    this.puffGeo = new THREE.PlaneGeometry(1, 1);
    this.puffTex = makePuffTexture();
  }

  matFor(def) {
    if (!this.mats.has(def.id)) {
      this.mats.set(def.id, new THREE.MeshStandardMaterial({
        color: def.color, roughness: 0.6, metalness: 0.35,
        emissive: new THREE.Color(def.glow), emissiveIntensity: 0.25,
      }));
    }
    return this.mats.get(def.id);
  }

  /* `fuseLeft` lets a cooked grenade leave the hand already ticking. */
  throwGrenade(def, origin, dir, ownerId = "player", { power = 1, fuseLeft = null } = {}) {
    const g = new Grenade(def, origin, dir, def.throwSpeed * power, ownerId, fuseLeft ?? def.fuse);
    g.mesh = new THREE.Mesh(this.geo, this.matFor(def));
    g.mesh.position.copy(g.pos);
    this.root.add(g.mesh);
    g.light = new THREE.PointLight(def.glow, 0, 4, 2);
    this.root.add(g.light);
    this.live.push(g);
    return g;
  }

  clear() {
    for (const g of this.live) { this.root.remove(g.mesh, g.light); }
    for (const p of this.pools) { this.root.remove(p.mesh, p.light); }
    for (const c of this.clouds) {
      for (const puff of c.puffs) puff.mesh.material.dispose();
      this.root.remove(c.group);
    }
    this.live.length = 0;
    this.pools.length = 0;
    this.clouds.length = 0;
  }

  /* ctx: { colliders, arena, onExplode(def, pos), onAreaDamage(pos, radius, damage, def) } */
  update(dt, ctx) {
    const { colliders = [], arena, onExplode, onAreaDamage } = ctx;

    for (let i = this.live.length - 1; i >= 0; i--) {
      const g = this.live[i];
      const def = g.def;

      if (!g.resting) {
        g.vel.y -= GRAVITY * dt;
        g.pos.addScaledVector(g.vel, dt);

        // ground
        if (g.pos.y - RADIUS <= 0) {
          g.pos.y = RADIUS;
          if (def.impact) { this.detonate(i, ctx); continue; }
          g.vel.y = Math.abs(g.vel.y) * def.bounce;
          g.vel.x *= def.roll;
          g.vel.z *= def.roll;
        }

        const hit = resolveSphere(g.pos, colliders);
        if (hit) {
          if (def.impact) { this.detonate(i, ctx); continue; }
          g.vel[hit.axis] = -g.vel[hit.axis] * def.bounce;
          const other = hit.axis === "y" ? ["x", "z"] : ["x", "y", "z"].filter((a) => a !== hit.axis);
          for (const a of other) g.vel[a] *= def.roll;
        }

        if (arena) {
          g.pos.x = Math.max(arena.minX + RADIUS, Math.min(arena.maxX - RADIUS, g.pos.x));
          g.pos.z = Math.max(arena.minZ + RADIUS, Math.min(arena.maxZ - RADIUS, g.pos.z));
        }

        if (g.vel.lengthSq() < REST_SPEED * REST_SPEED && g.pos.y <= RADIUS + 0.02) {
          g.resting = true;
          g.vel.set(0, 0, 0);
        }
      }

      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += g.spin.x * dt;
      g.mesh.rotation.y += g.spin.y * dt;
      g.light.position.copy(g.pos);

      g.fuse -= dt;
      // Blink faster as the fuse runs out — the only warning anyone gets.
      const blink = Math.max(0.08, g.fuse * 0.25);
      g.light.intensity = (Math.sin(g.fuse / blink * Math.PI * 2) > 0 ? 1.6 : 0.2) * (def.kind === "tactical" ? 0.6 : 1);
      if (g.fuse <= 0) { this.detonate(i, ctx); continue; }
    }

    // ---- lingering fire
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const p = this.pools[i];
      p.life -= dt;
      p.tick += dt;
      const fade = Math.min(1, p.life / 1.2);
      if (p.mesh) {
        p.mesh.material.opacity = 0.5 * fade;
        p.mesh.scale.setScalar(p.def.pool.radius * (0.94 + Math.sin(p.tick * 7) * 0.05));
      }
      if (p.light) p.light.intensity = (9 + Math.sin(p.tick * 13) * 3) * fade;
      // Damage ticks four times a second rather than per frame, so a fast
      // machine doesn't burn people faster than a slow one.
      while (p.tick >= 0.25 && p.life > 0) {
        p.tick -= 0.25;
        onAreaDamage?.(p.pos, p.def.pool.radius, p.def.pool.dps * 0.25, p.def, { fire: true });
      }
      if (p.life <= 0) {
        this.root.remove(p.mesh, p.light);
        // the disc geometry is shared, so only the per-pool material is freed
        p.mesh?.material?.dispose?.();
        this.pools.splice(i, 1);
      }
    }
  }

  detonate(index, ctx) {
    const g = this.live[index];
    this.live.splice(index, 1);
    this.root.remove(g.mesh, g.light);
    const def = g.def;

    ctx.onExplode?.(def, g.pos.clone());
    if (def.damage > 0) ctx.onAreaDamage?.(g.pos.clone(), def.radius, def.damage, def, {});
    if (def.blind) ctx.onFlash?.(g.pos.clone(), def);
    if (def.emp) ctx.onEmp?.(g.pos.clone(), def);

    if (def.smoke) this.spawnSmoke(def, g.pos);

    if (def.pool) {
      const p = new FirePool(def, g.pos);
      p.mesh = new THREE.Mesh(this.fireGeo, new THREE.MeshBasicMaterial({
        color: def.glow, transparent: true, opacity: 0.5, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      p.mesh.rotation.x = -Math.PI / 2;
      p.mesh.position.set(g.pos.x, g.pos.y - RADIUS + 0.05, g.pos.z);
      p.mesh.scale.setScalar(def.pool.radius);
      p.light = new THREE.PointLight(def.glow, 10, def.pool.radius * 2.4, 2);
      p.light.position.set(g.pos.x, g.pos.y + 0.8, g.pos.z);
      this.root.add(p.mesh, p.light);
      this.pools.push(p);
    }
  }

  spawnSmoke(def, pos) {
    const cloud = new SmokeCloud(def, pos);
    cloud.group = new THREE.Group();
    for (const puff of cloud.puffs) {
      puff.mesh = new THREE.Mesh(this.puffGeo, new THREE.MeshBasicMaterial({
        map: this.puffTex, color: def.color, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide, fog: true,
      }));
      puff.mesh.position.copy(cloud.pos).add(puff.offset);
      puff.mesh.scale.setScalar(puff.scale);
      cloud.group.add(puff.mesh);
    }
    this.root.add(cloud.group);
    this.clouds.push(cloud);
    return cloud;
  }

  /* True if smoke stands between these two points — the reason smoke is
     worth throwing. Bots and the flashbang both ask this. */
  blocksSight(a, b) {
    for (const c of this.clouds) if (c.blocks(a, b)) return true;
    return false;
  }

  /* How thick the smoke is at a point, 0..1 — drives the screen haze when
     you're the one standing inside it. */
  densityAt(point) {
    let d = 0;
    for (const c of this.clouds) {
      const r = c.sightRadius;
      if (r <= 0) continue;
      const dist = c.pos.distanceTo(point);
      if (dist < r) d = Math.max(d, (1 - dist / r) * c.fill);
    }
    return Math.min(1, d);
  }

  updateSmoke(dt, camera) {
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.life -= dt;
      c.age += dt;
      const fill = c.fill;

      for (const puff of c.puffs) {
        puff.offset.addScaledVector(puff.drift, dt);
        // Keep the cloud from climbing off its own footprint.
        if (puff.offset.y > c.def.smoke.radius * 0.85) puff.drift.y *= -0.4;
        puff.mesh.position.copy(c.pos).add(puff.offset);
        puff.mesh.scale.setScalar(puff.scale * (0.55 + fill * 0.45) * (1 + Math.sin(c.age * 0.9 + puff.phase) * 0.05));
        puff.mesh.material.opacity = 0.5 * fill;
        // Face the camera, then roll around the view axis, so the spin
        // survives the billboarding instead of being overwritten by it.
        puff.roll = (puff.roll ?? puff.phase) + puff.spin * dt;
        if (camera) {
          puff.mesh.quaternion.copy(camera.quaternion);
          puff.mesh.rotateZ(puff.roll);
        }
      }

      if (c.life <= 0) {
        for (const puff of c.puffs) puff.mesh.material.dispose();
        this.root.remove(c.group);
        this.clouds.splice(i, 1);
      }
    }
  }
}

/* Blast falloff: full damage at the centre, `minDamage` at the edge. */
export function blastDamage(def, distance) {
  if (distance >= def.radius) return 0;
  const t = 1 - distance / def.radius;
  return def.minDamage + (def.damage - def.minDamage) * t * t;
}
