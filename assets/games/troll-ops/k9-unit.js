// Troll Forces — the K9 Unit scorestreak (Black Ops 2): a pack of attack
// dogs that runs down the enemy team for a while and then is called off.
//
// Authority is the same as every other streak (streak-entities.js): the
// caller's client runs the pack, picks targets, bites and reports damage.
// Everyone else renders a copy that follows the owner's position snapshots
// (a few a second, interpolated), and a shot at a dog on their screen is
// sent to the owner, who applies it. That's the only streak you can shoot,
// so it's the only one that takes hits over the wire.
//
// The dog is k9-dog.glb (models/build_streaks2.blender.py): legs, head, jaw
// and tail are their own nodes, and the gallop is posed here.

import * as THREE from "three";
import { loadModel } from "./battlefield-props.js";
import { FlowField } from "./nav.js?v=ti1";
import { groundHeightAt, resolveCircle } from "./movement.js?v=ti1";

export const K9 = {
  dogs: 6,
  hp: 90,              // three or four rifle rounds
  speed: 7.6,          // faster than a sprinting player
  bite: 55,            // two bites put a full-health troll down
  biteCd: 0.85,
  biteRange: 1.75,
  biteReachY: 1.2,
  spawnGap: 0.35,      // seconds between dogs coming out
  retarget: 0.6,
  perTarget: 2,        // dogs that would rather split up than all chase one
  snapHz: 8,           // owner -> room position updates
  radius: 0.32,
};

const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });
const _v = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _goal = new THREE.Vector3();

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

class K9Dog {
  constructor(pack, i, pos, yaw) {
    this.pack = pack;
    this.i = i;
    this.isK9Dog = true;
    this.hp = K9.hp;
    this.alive = true;
    this.deadT = 0;
    this.pos = pos.clone();
    this.groundY = pos.y;
    this.vel = new THREE.Vector3();
    this.yaw = yaw;
    this.targetId = null;
    this.retargetT = 0;
    this.biteCd = 0.4;
    this.biteT = 0;          // > 0 while the bite animation plays
    this.phase = Math.random() * 6;
    this.speed = 0;          // measured, drives the gait
    this.snap = null;        // copies: where the owner last had it
    this.spawnT = 0.25;      // pops in

    this.root = new THREE.Group();
    this.root.rotation.order = "YXZ";
    this.body = new THREE.Group();   // the gait bobs this, never the root
    this.root.add(this.body);
    this.parts = null;
    loadModel("k9-dog").then((obj) => {
      if (this.disposed) return;
      this.body.add(obj);
      const get = (n) => obj.getObjectByName(n);
      this.parts = {
        head: get("K9_Head"), jaw: get("K9_Jaw"), tail: get("K9_Tail"),
        legs: ["FL", "FR", "BL", "BR"].map((k) => ({ up: get(`K9_Leg${k}`), lo: get(`K9_Leg${k}_Lo`), front: k[0] === "F", k })),
      };
      obj.traverse((n) => {
        if (!n.isMesh) return;
        n.castShadow = true;
        const m = n.material;
        if (m && m.name === "K9_Fur") m.roughness = 0.88;
      });
    });

    // Bullets need something generous to hit; the legs are thin.
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 1.05), HIT_MAT);
    box.position.set(0, 0.45, -0.02);
    box.visible = false;
    box.userData.k9Dog = this;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), HIT_MAT);
    head.position.set(0, 0.72, -0.55);
    head.visible = false;
    head.userData.k9Dog = this;
    this.root.add(box, head);
    this.hitMeshes = [box, head];
    this.root.position.copy(this.pos);
    this.root.rotation.y = yaw;
  }

  /* The gallop: front and hind pairs out of phase, each pair a little
     staggered, the spine bouncing twice a stride. `k` 0..1 is how fast. */
  pose(dt, k, age) {
    const p = this.parts;
    this.phase += dt * (3 + 11 * k);
    const ph = this.phase;
    const stride = 0.75 * k;
    this.body.position.y = Math.abs(Math.sin(ph)) * 0.05 * k;
    this.body.rotation.x = Math.sin(ph) * 0.07 * k;
    if (!p) return;
    for (const L of p.legs) {
      const off = (L.front ? 0 : Math.PI) + (L.k[1] === "R" ? 0.45 : 0);
      const s = Math.sin(ph + off);
      if (L.up) L.up.rotation.x = s * stride;
      // The lower leg tucks as the leg swings forward, straight on the push.
      const tuck = Math.max(0, Math.cos(ph + off)) * k;
      if (L.lo) L.lo.rotation.x = L.front ? -tuck * 1.1 : tuck * 0.8;
    }
    const biting = this.biteT > 0 ? Math.sin((1 - this.biteT / 0.35) * Math.PI) : 0;
    if (p.head) p.head.rotation.x = -Math.sin(ph) * 0.08 * k - biting * 0.25;
    if (p.jaw) p.jaw.rotation.x = -(0.12 * k + 0.55 * biting);
    if (p.tail) {
      p.tail.rotation.y = Math.sin(age * (k > 0.2 ? 7 : 11)) * (k > 0.2 ? 0.2 : 0.45);
      p.tail.rotation.x = 0.25 * k;
    }
  }

  dispose() {
    this.disposed = true;
    this.root.parent?.remove(this.root);
    for (const m of this.hitMeshes) m.geometry.dispose();
  }
}

export class K9Pack {
  /* `origin`/`yaw`: where the caller stood. The dogs come out behind them. */
  constructor({ id, owned, team, ownerId, origin, yaw = 0, duration = 45, count = K9.dogs, world }) {
    this.id = id;
    this.owned = !!owned;
    this.team = team;
    this.ownerId = ownerId;
    this.duration = duration;
    this.world = world;       // { colliders, bounds }
    this.age = 0;
    this.done = false;
    this.snapT = 0;
    this.root = new THREE.Group();
    this.dogs = [];
    this.count = count;
    this.origin = origin.clone();
    this.yaw = yaw;
    this.fields = new Map();      // "level|key" -> FlowField
    this.baseFields = new Map();  // level -> the blocked grid the rest copy
    this.tracks = new Map();      // target id -> { x, z, vx, vz } for leading a runner
    this.dtNow = 0;
  }

  spawnPoint(i) {
    // Fanned out behind the caller, pulled in if a wall is in the way.
    const a = this.yaw + Math.PI + (i - (this.count - 1) / 2) * 0.45;
    const r = 1.8 + (i % 2) * 0.7;
    const p = new THREE.Vector3(this.origin.x - Math.sin(a) * r, 0, this.origin.z - Math.cos(a) * r);
    const cols = this.world.colliders;
    p.y = groundHeightAt(cols, p.x, p.z, this.origin.y + 1.2, 0.25) ?? this.origin.y;
    if (Math.abs(p.y - this.origin.y) > 1.2) p.copy(this.origin);
    return p;
  }

  addDog(i, pos, yaw) {
    const d = new K9Dog(this, i, pos, yaw);
    this.dogs[i] = d;
    this.root.add(d.root);
    return d;
  }

  get alive() { return this.dogs.filter((d) => d && d.alive); }

  /* Bullet meshes for everyone still up. */
  hitMeshes() {
    const out = [];
    for (const d of this.dogs) if (d && d.alive) out.push(...d.hitMeshes);
    return out;
  }

  /* The owner applying damage (its own shots, bots', or a hit from the
     wire). Returns true if that killed it. */
  damage(i, dmg) {
    const d = this.dogs[i];
    if (!d || !d.alive) return false;
    d.hp -= dmg;
    if (d.hp > 0) return false;
    this.kill(i);
    return true;
  }

  kill(i) {
    const d = this.dogs[i];
    if (!d || !d.alive) return;
    d.alive = false;
    d.hp = 0;
    d.deadT = 0;
    d.vel.set(0, 0, 0);
  }

  /* A flow field toward (tx, tz) on the level a dog is walking at. Upper
     levels only open where there's floor under them, so a dog on a balcony
     doesn't path out over thin air. `key` names what it leads to (a target
     id, a stair foot), one field per level per key. */
  field(key, tx, tz, y = 0) {
    const { colliders, bounds } = this.world;
    const level = Math.max(0, Math.round(y * 2) / 2);
    let base = this.baseFields.get(level);
    if (!base) {
      base = new FlowField(colliders, bounds, level, { step: 0.5, needSupport: level > 0.5, cell: this.world.navCell || undefined });
      this.baseFields.set(level, base);
    }
    const fk = `${level}|${key}`;
    let f = this.fields.get(fk);
    if (!f) { f = new FlowField(colliders, bounds, level, { template: base }); this.fields.set(fk, f); }
    return f.compute(tx, tz) ? f : null;
  }

  /* Walking distance from (x, z) along a field, or Infinity if walled off. */
  static fieldDist(f, x, z) {
    if (!f) return Infinity;
    const i = f.openIndex(x, z);
    return i >= 0 && f.dist[i] ? f.dist[i] * f.cell : Infinity;
  }

  /* Where a dog should run to reach `goal` (feet), which may be on another
     level: the goal itself on its own level, else the foot of the stair that
     best leads there, then straight up (or down) it. Returns { x, y, z,
     field } or null to go straight in. */
  route(d, key, goal) {
    const stairs = this.world.stairs || [];
    if (d.climb) {
      const e = d.climb.exit;
      d.climb.t += this.dtNow;
      const level = Math.abs(d.pos.y - e.y) < 0.45;
      if ((level && Math.hypot(e.x - d.pos.x, e.z - d.pos.z) < 1.0) || d.climb.t > 7) d.climb = null;
      else return { x: e.x, y: e.y, z: e.z, field: null };
    }
    const dy = goal.y - d.pos.y;
    if (Math.abs(dy) < 1.2 || !stairs.length) {
      return { x: goal.x, y: goal.y, z: goal.z, field: this.field(key, goal.x, goal.z, d.pos.y) };
    }
    // Up or down: a stair with one end on this level, heading the right way.
    let best = null, bestS = Infinity;
    for (let i = 0; i < stairs.length; i++) {
      const s = stairs[i];
      for (const [entry, exit] of [[s.a, s.b], [s.b, s.a]]) {
        if (Math.abs(entry.y - d.pos.y) > 0.9) continue;
        if (Math.sign(exit.y - entry.y) !== Math.sign(dy)) continue;
        const cost = Math.hypot(entry.x - d.pos.x, entry.z - d.pos.z)
          + Math.hypot(exit.x - goal.x, exit.z - goal.z) + Math.abs(exit.y - goal.y) * 4;
        if (cost < bestS) { bestS = cost; best = { i, entry, exit }; }
      }
    }
    if (!best) return null;
    if (Math.hypot(best.entry.x - d.pos.x, best.entry.z - d.pos.z) < 1.1) {
      d.climb = { exit: best.exit, t: 0 };
      return { x: best.exit.x, y: best.exit.y, z: best.exit.z, field: null };
    }
    const e = best.entry;
    return { x: e.x, y: e.y, z: e.z, field: this.field(`stair${best.i}|${e === this.world.stairs[best.i].a ? "a" : "b"}`, e.x, e.z, d.pos.y) };
  }

  /* Owner frame. ctx:
       hostiles()           [{ id, pos, alive }] the dogs may go for
       ownerPos             the caller's feet (dogs with nothing to chase heel)
       onBite(dog, id, dmg) apply a bite
     Returns "expire" once the pack has been called off. */
  updateOwned(dt, ctx) {
    this.age += dt;
    // Out they come, one after another.
    for (let i = 0; i < this.count; i++) {
      if (!this.dogs[i] && this.age >= i * K9.spawnGap) this.addDog(i, this.spawnPoint(i), this.yaw);
    }
    this.dtNow = dt;
    const hostiles = ctx.hostiles().filter((h) => h.alive);
    // Each target's ground speed, smoothed, so a dog can run to where a
    // fleeing troll is going instead of where it was.
    for (const h of hostiles) {
      const tr = this.tracks.get(h.id);
      if (!tr) { this.tracks.set(h.id, { x: h.pos.x, z: h.pos.z, vx: 0, vz: 0 }); continue; }
      const k = Math.min(1, dt * 4);
      tr.vx += ((h.pos.x - tr.x) / Math.max(dt, 1e-3) - tr.vx) * k;
      tr.vz += ((h.pos.z - tr.z) / Math.max(dt, 1e-3) - tr.vz) * k;
      tr.x = h.pos.x; tr.z = h.pos.z;
    }
    const chasing = new Map();
    for (const d of this.dogs) if (d?.alive && d.targetId) chasing.set(d.targetId, (chasing.get(d.targetId) || 0) + 1);
    const now = this.age;

    for (const d of this.dogs) {
      if (!d) continue;
      if (!d.alive) { this.poseDead(d, dt); continue; }
      d.biteCd = Math.max(0, d.biteCd - dt);
      d.biteT = Math.max(0, d.biteT - dt);
      d.retargetT -= dt;
      let target = hostiles.find((h) => h.id === d.targetId) || null;
      if (!target || d.retargetT <= 0) {
        d.retargetT = K9.retarget;
        const best = this.pickTarget(d, hostiles, chasing, ctx, now);
        if (best?.id !== d.targetId) {
          if (d.targetId) chasing.set(d.targetId, (chasing.get(d.targetId) || 1) - 1);
          if (best) chasing.set(best.id, (chasing.get(best.id) || 0) + 1);
          d.climb = null;
          d.stuckN = 0;
        }
        target = best;
        d.targetId = best?.id || null;
      }

      let goal = target?.pos || null;
      let heel = false;
      if (!goal && ctx.ownerPos) {
        // Nothing to hunt: trot back to the handler.
        goal = _v.set(ctx.ownerPos.x + Math.sin(d.i * 1.3) * 2.2, ctx.ownerPos.y, ctx.ownerPos.z + Math.cos(d.i * 1.3) * 2.2);
        heel = true;
      }
      let want = 0;
      if (goal) {
        _to.set(goal.x - d.pos.x, 0, goal.z - d.pos.z);
        const dist = _to.length();
        const inReach = !heel && dist <= K9.biteRange && Math.abs(goal.y - d.pos.y) < K9.biteReachY;
        if (inReach) {
          d.climb = null;
          if (d.biteCd <= 0) {
            d.biteCd = K9.biteCd;
            d.biteT = 0.35;
            ctx.onBite?.(d, target.id, K9.bite);
          }
        } else if (dist > (heel ? 1.2 : 0.9)) {
          let dir;
          if (d.detour) {
            // Ran into something: turned round, running that way a moment.
            d.detour.t -= dt;
            dir = _dir.set(d.detour.x, 0, d.detour.z);
            if (d.detour.t <= 0) d.detour = null;
          } else {
            // Lead a runner: aim at where they'll be by the time we get there,
            // when the way there is open ground.
            let gx = goal.x, gz = goal.z;
            const tr = !heel && target && this.tracks.get(target.id);
            if (tr && dist < 14 && dist > 2.2 && Math.abs(goal.y - d.pos.y) < 1.2) {
              const ahead = Math.min(0.8, dist / K9.speed);
              gx += tr.vx * ahead; gz += tr.vz * ahead;
            }
            const r = heel || dist <= 2.5 ? null : this.route(d, target.id, _goal.set(gx, goal.y, gz));
            const steer = r?.field ? r.field.steer(d.pos.x, d.pos.z) : null;
            if (steer) dir = steer;
            else {
              const tx = r ? r.x : gx, tz = r ? r.z : gz;
              dir = _dir.set(tx - d.pos.x, 0, tz - d.pos.z);
              const l = dir.length();
              if (l > 1e-4) dir.divideScalar(l); else dir.set(-Math.sin(d.yaw), 0, -Math.cos(d.yaw));
            }
          }
          want = heel ? Math.min(K9.speed * 0.6, dist * 1.5) : K9.speed;
          d.vel.x += (dir.x * want - d.vel.x) * Math.min(1, dt * 6);
          d.vel.z += (dir.z * want - d.vel.z) * Math.min(1, dt * 6);
        }
        if (dist > 0.05) {
          const face = Math.atan2(-(goal.x - d.pos.x), -(goal.z - d.pos.z));
          const turnTo = d.vel.lengthSq() > 1 ? Math.atan2(-d.vel.x, -d.vel.z) : face;
          d.yaw += wrap(turnTo - d.yaw) * Math.min(1, dt * 10);
        }
      }
      if (!want) { d.vel.x *= Math.max(0, 1 - dt * 9); d.vel.z *= Math.max(0, 1 - dt * 9); }
      const px = d.pos.x, pz = d.pos.z;
      this.move(d, dt);
      d.speed = Math.hypot(d.vel.x, d.vel.z);
      this.checkStuck(d, dt, want, Math.hypot(d.pos.x - px, d.pos.z - pz) / Math.max(dt, 1e-3), target, now);
      this.place(d, dt);
    }

    // Dogs don't run through each other: a pack surrounds a troll instead of
    // stacking on one spot.
    const live = this.dogs.filter((d) => d?.alive);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        if (Math.abs(a.pos.y - b.pos.y) > 0.6) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, l = Math.hypot(dx, dz);
        const min = K9.radius * 2.2;
        if (l >= min) continue;
        const push = (min - l) * 0.5, nx = l > 1e-4 ? dx / l : Math.cos(i + j), nz = l > 1e-4 ? dz / l : Math.sin(i + j);
        a.pos.x -= nx * push; a.pos.z -= nz * push;
        b.pos.x += nx * push; b.pos.z += nz * push;
      }
    }

    if (this.owned) {
      this.snapT -= dt;
    }
    if (this.age >= this.duration) { this.done = true; return "expire"; }
    return null;
  }

  /* Who a dog goes for. Not just the nearest as the crow flies: the
     nearest by the way it would actually have to run (a troll behind a wall
     or up a floor is further than they look), one it can see over one it
     can't, and not one it just gave up reaching. Too many dogs on one troll
     and the rest split off. */
  pickTarget(d, hostiles, chasing, ctx, now) {
    if (!hostiles.length) return null;
    const rough = hostiles.map((h) => ({ h, s: Math.hypot(h.pos.x - d.pos.x, h.pos.z - d.pos.z) + Math.abs(h.pos.y - d.pos.y) * 4 }))
      .sort((a, b) => a.s - b.s);
    let best = null, bestS = Infinity;
    // The proper path cost only for the closest few: each is a field sweep.
    rough.forEach(({ h, s }, n) => {
      let cost = s;
      if (n < 3) {
        if (Math.abs(h.pos.y - d.pos.y) < 1.2) {
          const run = K9Pack.fieldDist(this.field(h.id, h.pos.x, h.pos.z, d.pos.y), d.pos.x, d.pos.z);
          cost = Number.isFinite(run) ? run : s + 40;
        }
        if (ctx.canSee) cost += ctx.canSee(d.pos, h.pos) ? -6 : 8;
      } else cost += 8;
      if (d.giveUp?.id === h.id && now < d.giveUp.until) cost += 60;
      const crowd = (chasing.get(h.id) || 0) - (h.id === d.targetId ? 1 : 0);
      cost += Math.max(0, crowd - K9.perTarget + 1) * 18;
      if (h.id === d.targetId) cost -= 4;   // don't flip-flop between two close calls
      if (cost < bestS) { bestS = cost; best = h; }
    });
    return best;
  }

  /* Running into a wall: the dog wants to go but isn't getting anywhere.
     It turns round (a sharp turn back the way it came, to one side) and runs
     that way for a moment before it picks its route again. Three goes and it
     gives up on that troll for a few seconds and looks for another. */
  checkStuck(d, dt, want, moved, target, now) {
    if (want > 2 && !d.detour && moved < want * 0.3) d.stuckT = (d.stuckT || 0) + dt;
    else d.stuckT = Math.max(0, (d.stuckT || 0) - dt * 2);
    if (d.stuckT < 0.35) return;
    d.stuckT = 0;
    d.stuckN = (d.stuckN || 0) + 1;
    d.climb = null;
    const heading = Math.atan2(d.vel.x, d.vel.z);
    const turn = Math.PI * (0.65 + Math.random() * 0.45) * (Math.random() < 0.5 ? -1 : 1);
    d.detour = { x: Math.sin(heading + turn), z: Math.cos(heading + turn), t: 0.45 + Math.random() * 0.35 };
    d.vel.multiplyScalar(0.3);
    if (d.stuckN >= 3 && target) {
      d.giveUp = { id: target.id, until: now + 4 };
      d.stuckN = 0;
      d.retargetT = 0;
    }
  }

  move(d, dt) {
    const { colliders, bounds } = this.world;
    d.pos.x += d.vel.x * dt;
    d.pos.z += d.vel.z * dt;
    const r = K9.radius;
    d.pos.x = Math.max(bounds.minX + r, Math.min(bounds.maxX - r, d.pos.x));
    d.pos.z = Math.max(bounds.minZ + r, Math.min(bounds.maxZ - r, d.pos.z));
    _v.set(d.pos.x, d.groundY, d.pos.z);
    resolveCircle(colliders, _v, r, d.groundY, 0.8, 0.5);
    d.pos.x = _v.x; d.pos.z = _v.z;
    const support = groundHeightAt(colliders, d.pos.x, d.pos.z, d.groundY + 0.6, r * 0.8);
    d.groundY += (support - d.groundY) * Math.min(1, dt * 10);
    d.pos.y = d.groundY;
  }

  place(d, dt) {
    d.root.position.copy(d.pos);
    d.root.rotation.y = d.yaw;
    if (d.spawnT > 0) {
      d.spawnT = Math.max(0, d.spawnT - dt);
      d.root.scale.setScalar(1 - d.spawnT / 0.25 * 0.6);
    } else d.root.scale.setScalar(1);
    d.pose(dt, Math.min(1, d.speed / K9.speed), this.age);
  }

  /* Rolls onto its side and lies there, then sinks away. */
  poseDead(d, dt) {
    d.deadT += dt;
    d.root.rotation.z += ((Math.PI / 2) - d.root.rotation.z) * Math.min(1, dt * 9);
    d.body.position.y = 0;
    if (d.deadT > 3) d.root.position.y = d.pos.y - (d.deadT - 3) * 0.4;
    if (d.deadT > 4.5) d.root.visible = false;
  }

  /* The owner's snapshot for the room: every dog's x, z, yaw and state. */
  snapshot() {
    return this.dogs.map((d) => d ? [Math.round(d.pos.x * 10), Math.round(d.pos.y * 10), Math.round(d.pos.z * 10),
      Math.round(d.yaw * 100), d.alive ? (d.biteT > 0 ? 2 : 1) : 0] : null);
  }

  /* A copy taking the owner's snapshot. */
  applySnapshot(list) {
    if (!Array.isArray(list)) return;
    list.forEach((s, i) => {
      if (!Array.isArray(s)) return;
      const [x, y, z, yaw, st] = s;
      const pos = new THREE.Vector3(x / 10, y / 10, z / 10);
      let d = this.dogs[i];
      if (!d) d = this.addDog(i, pos, yaw / 100);
      d.snap = { pos, yaw: yaw / 100, at: performance.now() };
      if (st === 0 && d.alive) this.kill(i);
      if (st === 2 && d.biteT <= 0) d.biteT = 0.35;
    });
  }

  /* Copy frame: glide to the owner's positions. */
  updateCopy(dt) {
    this.age += dt;
    for (const d of this.dogs) {
      if (!d) continue;
      if (!d.alive) { this.poseDead(d, dt); continue; }
      d.biteT = Math.max(0, d.biteT - dt);
      if (d.snap) {
        const k = Math.min(1, dt * 10);
        const px = d.pos.x, pz = d.pos.z;
        d.pos.lerp(d.snap.pos, k);
        d.yaw += wrap(d.snap.yaw - d.yaw) * k;
        d.speed = Math.hypot(d.pos.x - px, d.pos.z - pz) / Math.max(dt, 1e-3);
      }
      this.place(d, dt);
    }
    // A copy whose owner went quiet doesn't hang round forever.
    if (this.age > this.duration + 6) { this.done = true; return "expire"; }
    return null;
  }

  dispose() {
    for (const d of this.dogs) d?.dispose();
    this.dogs.length = 0;
    this.root.parent?.remove(this.root);
  }
}

/* Which dog (and pack) a bullet hit, from the mesh it struck. */
export function resolveK9(object) {
  for (let o = object; o; o = o.parent) if (o.userData?.k9Dog) return o.userData.k9Dog;
  return null;
}
