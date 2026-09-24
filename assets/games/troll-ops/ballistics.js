// Troll Ops — projectile ballistics.
//
// Bullets are real projectiles, not hitscan: they carry a muzzle velocity,
// drop under gravity, and take time to reach the target, so you lead moving
// targets at range. This is the single biggest thing that makes a shooter
// read as Phantom Forces rather than a generic FPS.
//
// World collision uses the AABB collider list directly (analytic slab test)
// rather than mesh raycasting — it's far cheaper per bullet, and the slab
// test hands us the exit point for free, which is exactly what wall
// penetration needs to measure material thickness.

import * as THREE from "three";
import { makeTracerMaterial } from "./shaders.js";
import { computeDamage } from "./weapons.js";

const DROP = 9.81;          // m/s^2 applied to bullets
const MAX_LIFE = 3.0;       // seconds before a stray round is culled
const STEP = 1 / 120;       // fixed integration step, so travel is framerate-independent

// Segment vs AABB (slab method). `dir` must be normalized, `len` in metres.
// Returns { t0, t1 } as distances along the segment, or null on a miss.
function segmentAABB(origin, dir, len, min, max) {
  let t0 = 0, t1 = len;
  for (const axis of ["x", "y", "z"]) {
    const d = dir[axis];
    if (Math.abs(d) < 1e-8) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null;
      continue;
    }
    const inv = 1 / d;
    let ta = (min[axis] - origin[axis]) * inv;
    let tb = (max[axis] - origin[axis]) * inv;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  return { t0, t1 };
}

/* Is the straight line between two points broken by solid geometry?
   Used by the bot AI to decide whether it can actually see a target. */
export function segmentBlocked(colliders, from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len < 1e-6) return false;
  dir.divideScalar(len);
  for (const c of colliders) {
    const hit = segmentAABB(from, dir, len, c.min, c.max);
    if (hit && hit.t1 > 0 && hit.t0 < len) return true;
  }
  return false;
}

/* Nearest world-collider hit along a ray, in metres, or `len` if nothing is
   struck. Used for anything that needs a wall distance without the full
   bullet simulation — the laser sight sizes its beam this way. */
export function raycastWorld(colliders, origin, dir, len) {
  let nearest = len;
  for (const c of colliders) {
    const hit = segmentAABB(origin, dir, len, c.min, c.max);
    if (hit && hit.t1 > 0 && hit.t0 < nearest) nearest = Math.max(0, hit.t0);
  }
  return nearest;
}

class Tracer {
  constructor(scene, geo) {
    this.mat = makeTracerMaterial(0xfff2c0);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this._color = 0xfff2c0;
    scene.add(this.mesh);
  }
  // Stretch the quad from `tip` backwards along `dir` by `len`.
  place(tip, dir, len, width, opacity, color) {
    const tail = tip.clone().addScaledVector(dir, -len);
    this.mesh.position.copy(tip).addScaledVector(dir, -len * 0.5);
    this.mesh.lookAt(tail);
    this.mesh.rotateX(Math.PI / 2);
    this.mesh.scale.set(width, len, 1);
    this.mat.uniforms.uOpacity.value = opacity;
    if (color != null && color !== this._color) {
      this._color = color;
      this.mat.uniforms.uColor.value.setHex(color);
    }
    this.mesh.visible = true;
  }
  hide() { this.mesh.visible = false; }
}

export class BulletSystem {
  constructor(scene, { maxBullets = 160 } = {}) {
    this.scene = scene;
    this.bullets = [];
    this.max = maxBullets;

    const geo = new THREE.PlaneGeometry(1, 1);
    this.tracerGeo = geo;
    this.tracers = [];
    for (let i = 0; i < maxBullets; i++) this.tracers.push(new Tracer(scene, geo));
  }

  /* opts: { origin, dir, def, ownerId, damageScale, cosmetic }
     `cosmetic` is someone else's round, drawn so you can see where the fire
     is coming from. It never hits an actor (the shooter's client decides
     hits) and stops at the first wall. It also never evicts a real round:
     when the pool is full, a cosmetic one is simply not drawn. */
  spawn({ origin, dir, def, ownerId = "player", damageScale = 1, cosmetic = false }) {
    if (this.bullets.length >= this.max) {
      if (cosmetic) return;
      const i = this.bullets.findIndex((b) => b.cosmetic);
      this.bullets.splice(i >= 0 ? i : 0, 1);
    }
    const speed = def.muzzleVelocity || 700;
    this.bullets.push({
      pos: origin.clone(),
      vel: dir.clone().multiplyScalar(speed),
      def,
      ownerId,
      damageScale,
      pen: cosmetic ? 0 : (def.penetration != null ? def.penetration : 1),
      dist: 0,
      life: MAX_LIFE,
      acc: 0,
      cosmetic,
    });
  }

  clear() {
    this.bullets.length = 0;
    for (const t of this.tracers) t.hide();
  }

  /* ctx:
       colliders     — [{ min, max, pen }] world AABBs (pen = cost per metre)
       targetMeshes  — meshes to raycast for actor hits
       resolveTarget — (object3D) => actor | null
       onActorHit    — (actor, { damage, isHead, point, dir, distance })
       onWorldHit    — (point, normalish)
       bounds        — the arena; a round that leaves it can't hit anything  */
  update(dt, ctx) {
    const { colliders = [], targetMeshes = [], resolveTarget, onActorHit, onWorldHit, bounds } = ctx;
    const ray = this._ray || (this._ray = new THREE.Raycaster());
    const from = this._from || (this._from = new THREE.Vector3());
    const to = this._to || (this._to = new THREE.Vector3());
    const dir = this._dir || (this._dir = new THREE.Vector3());

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.acc += dt;
      let dead = false;

      // Fixed-step integration so fast rounds can't tunnel on a slow frame.
      while (b.acc >= STEP && !dead) {
        b.acc -= STEP;
        b.life -= STEP;
        if (b.life <= 0) { dead = true; break; }

        // A miss into the sky used to integrate for its full 3s life — 360
        // steps, each tested against every collider — long after it left the
        // map. Nothing out there can be hit; retire it.
        if (bounds && (b.pos.x < bounds.minX - 6 || b.pos.x > bounds.maxX + 6
            || b.pos.z < bounds.minZ - 6 || b.pos.z > bounds.maxZ + 6
            || (b.pos.y > 60 && b.vel.y > 0))) { dead = true; break; }

        from.copy(b.pos);
        b.vel.y -= DROP * STEP;
        to.copy(b.pos).addScaledVector(b.vel, STEP);
        dir.subVectors(to, from);
        const len = dir.length();
        if (len < 1e-6) { b.pos.copy(to); continue; }
        dir.divideScalar(len);

        // --- nearest actor hit along this step
        let actorT = Infinity, actorHit = null, actorObj = null;
        if (targetMeshes.length && !b.cosmetic) {
          ray.set(from, dir);
          ray.near = 0;
          ray.far = len;
          const hits = ray.intersectObjects(targetMeshes, true);
          for (const h of hits) {
            const actor = resolveTarget ? resolveTarget(h.object) : null;
            if (!actor || actor.netId === b.ownerId) continue;
            actorT = h.distance; actorHit = actor; actorObj = h.object;
            break;
          }
        }

        // --- nearest world hit along this step
        let wallT = Infinity, wallExit = 0, wallPen = 1;
        for (const c of colliders) {
          const r = segmentAABB(from, dir, len, c.min, c.max);
          if (!r || r.t0 >= wallT) continue;
          if (r.t1 <= 0) continue;
          wallT = Math.max(0, r.t0); wallExit = r.t1; wallPen = c.pen != null ? c.pen : 1;
        }

        // --- ground plane
        let groundT = Infinity;
        if (b.vel.y < 0 && to.y <= 0 && from.y > 0) groundT = ((from.y - 0) / (from.y - to.y)) * len;

        const first = Math.min(actorT, wallT, groundT);
        if (first === Infinity) { b.pos.copy(to); b.dist += len; continue; }

        if (actorT === first) {
          const point = from.clone().addScaledVector(dir, actorT);
          const isHead = !!(actorObj.userData.isHead || actorObj.parent?.userData?.isHead);
          const dist = b.dist + actorT;
          const damage = computeDamage(b.def, dist, isHead) * b.damageScale;
          onActorHit?.(actorHit, { damage, isHead, point, dir: dir.clone(), distance: dist });
          dead = true;
          break;
        }

        if (groundT === first) {
          const point = from.clone().addScaledVector(dir, groundT);
          onWorldHit?.(point, b.cosmetic);
          dead = true;
          break;
        }

        // --- wall: try to punch through
        const point = from.clone().addScaledVector(dir, wallT);
        onWorldHit?.(point, b.cosmetic);
        if (b.cosmetic) { dead = true; break; }
        const thickness = Math.max(0.05, wallExit - wallT);
        const cost = thickness * wallPen;
        if (cost > b.pen) { dead = true; break; }
        b.pen -= cost;
        // Penetrating costs damage proportional to what the wall ate.
        b.damageScale *= Math.max(0.25, 1 - cost * 0.5);
        b.dist += wallExit;
        b.pos.copy(from).addScaledVector(dir, wallExit + 0.02);
      }

      if (dead) { this.bullets.splice(i, 1); continue; }
    }

    // --- tracers: one per live bullet, trailing behind it
    for (let i = 0; i < this.tracers.length; i++) {
      const b = this.bullets[i];
      if (!b) { this.tracers[i].hide(); continue; }
      const speed = b.vel.length();
      if (speed < 1e-3) { this.tracers[i].hide(); continue; }
      dir.copy(b.vel).divideScalar(speed);
      const len = Math.min(b.dist, b.def.tracerLength || 9);
      if (len < 0.4) { this.tracers[i].hide(); continue; }
      this.tracers[i].place(b.pos, dir, len, b.def.tracerWidth || 0.02, 0.9, b.def.tracerColor);
    }
  }
}
