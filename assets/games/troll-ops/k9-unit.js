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
    this.fields = new Map();  // target id -> FlowField
    this.baseField = null;
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

  field(targetId, tx, tz) {
    const { colliders, bounds } = this.world;
    if (!this.baseField) this.baseField = new FlowField(colliders, bounds, 0, { step: 0.9 });
    let f = this.fields.get(targetId);
    if (!f) { f = new FlowField(colliders, bounds, 0, { template: this.baseField }); this.fields.set(targetId, f); }
    return f.compute(tx, tz) ? f : null;
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
    const hostiles = ctx.hostiles().filter((h) => h.alive);
    const chasing = new Map();
    for (const d of this.dogs) if (d?.alive && d.targetId) chasing.set(d.targetId, (chasing.get(d.targetId) || 0) + 1);

    for (const d of this.dogs) {
      if (!d) continue;
      if (!d.alive) { this.poseDead(d, dt); continue; }
      d.biteCd = Math.max(0, d.biteCd - dt);
      d.biteT = Math.max(0, d.biteT - dt);
      d.retargetT -= dt;
      let target = hostiles.find((h) => h.id === d.targetId) || null;
      if (!target || d.retargetT <= 0) {
        d.retargetT = K9.retarget;
        let best = null, bestS = Infinity;
        for (const h of hostiles) {
          const dist = Math.hypot(h.pos.x - d.pos.x, h.pos.z - d.pos.z) + Math.abs(h.pos.y - d.pos.y) * 3;
          const crowd = (chasing.get(h.id) || 0) - (h.id === d.targetId ? 1 : 0);
          const s = dist + Math.max(0, crowd - K9.perTarget + 1) * 18;
          if (s < bestS) { bestS = s; best = h; }
        }
        if (best?.id !== d.targetId) {
          if (d.targetId) chasing.set(d.targetId, (chasing.get(d.targetId) || 1) - 1);
          if (best) chasing.set(best.id, (chasing.get(best.id) || 0) + 1);
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
          if (d.biteCd <= 0) {
            d.biteCd = K9.biteCd;
            d.biteT = 0.35;
            ctx.onBite?.(d, target.id, K9.bite);
          }
        } else if (dist > (heel ? 1.2 : 0.9)) {
          _to.divideScalar(dist);
          const f = !heel && dist > 2.5 ? this.field(target.id, goal.x, goal.z) : null;
          const steer = f ? f.steer(d.pos.x, d.pos.z) : null;
          const dir = steer || _to;
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
      this.move(d, dt);
      d.speed = Math.hypot(d.vel.x, d.vel.z);
      this.place(d, dt);
    }

    if (this.owned) {
      this.snapT -= dt;
    }
    if (this.age >= this.duration) { this.done = true; return "expire"; }
    return null;
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
