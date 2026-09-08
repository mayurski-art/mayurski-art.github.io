// Troll Ops — the test range.
//
// A place to set sensitivity, field of view and a loadout before dropping
// into anything that shoots back. Everything here is deliberately static and
// repeatable: fixed distances, targets that reset themselves, and a readout
// that tells you exactly what the last round did.
//
// Range targets deliberately reuse the bullet/melee/blast actor contract
// (`takeDamage(dmg, isHead, knockDir)` returning `{ killed }`) rather than
// inventing a second one, so every weapon system already knows how to hit
// them without a single special case in game.js.

import * as THREE from "three";

const PLATE_COLOR = 0xd8d2c2;
const PLATE_HOT = 0xffb347;
const RESET_AFTER = 2.2;   // seconds a knocked-down plate stays down
const PLATE_HP = 220;      // enough to eat a burst before it drops

let idc = 0;

/* One steel plate on a post. Hits knock it flat; it stands itself back up. */
export class RangeTarget {
  constructor(scene, { x, z, y = 0, distance = 0, width = 0.75, height = 1.7, moving = null }) {
    this.id = ++idc;
    this.isRangeTarget = true;
    this.alive = true;
    this.dying = false;
    this.distance = distance;
    this.down = 0;
    this.hp = PLATE_HP;
    this.hitFlash = 0;
    this.moving = moving;   // { span, speed } — slides along x
    this.homeX = x;
    this.phase = Math.random() * Math.PI * 2;

    const group = new THREE.Group();
    group.position.set(x, y, z);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3f36, roughness: 0.8, metalness: 0.2 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 8), postMat);
    post.position.y = 0.45;
    group.add(post);

    // The plate is the whole hitbox; the top band counts as a head so the
    // range can tell you whether that was a headshot.
    this.pivot = new THREE.Group();
    this.pivot.position.y = 0.9;
    group.add(this.pivot);

    this.plateMat = new THREE.MeshStandardMaterial({ color: PLATE_COLOR, roughness: 0.55, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.62, 0.08), this.plateMat);
    body.position.y = height * 0.31;
    this.pivot.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(width * 0.5, height * 0.24, 0.08), this.plateMat);
    head.position.y = height * 0.74;
    head.userData.isHead = true;
    this.pivot.add(head);

    // A ring painted on the plate, so aim has something to centre on.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(width * 0.18, width * 0.24, 20),
      new THREE.MeshBasicMaterial({ color: 0xc23b2e, side: THREE.DoubleSide }),
    );
    ring.position.set(0, height * 0.34, -0.05);
    this.pivot.add(ring);

    this.mesh = group;
    this.hitMeshes = [body, head];
    scene.add(group);
  }

  /* Same signature the grunts use, so bullets, melee and blasts all land.
     A plate soaks a burst before it drops, so a magazine dumped into one
     target shows you exactly where your recoil walked. */
  takeDamage(dmg, isHead) {
    if (this.down > 0) return { killed: false };
    this.lastHit = { damage: dmg, isHead, distance: this.distance };
    this.hitFlash = 1;
    this.hp -= dmg;
    if (this.hp > 0) return { killed: false };
    this.hp = PLATE_HP;
    this.down = RESET_AFTER;
    return { killed: true, scoreValue: 0 };
  }

  update(dt) {
    if (this.down > 0) {
      this.down -= dt;
      // fall flat, then snap back up when the timer runs out
      this.pivot.rotation.x = Math.min(Math.PI / 2, this.pivot.rotation.x + dt * 7);
      if (this.down <= 0) this.pivot.rotation.x = 0;
    }
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 2.5);
      this.plateMat.color.lerpColors(
        new THREE.Color(PLATE_COLOR), new THREE.Color(PLATE_HOT), this.hitFlash);
    }
    if (this.moving) {
      this.phase += dt * this.moving.speed;
      this.mesh.position.x = this.homeX + Math.sin(this.phase) * this.moving.span;
    }
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) for (const m of [].concat(o.material)) m.dispose?.();
    });
  }
}

/* The whole range: a row of plates down the lane at marked distances, plus a
   mover and a couple of close-in dummies for melee. */
export class RangeSet {
  constructor(scene) {
    this.scene = scene;
    this.targets = [];

    // The firing line is at z = 26 and the lane runs toward -z, so a target's
    // distance is just how far up the lane it stands.
    const line = 26;
    for (const [dz, x] of [[10, -6], [10, 0], [10, 6], [25, -4], [25, 4], [40, 0], [55, -3], [55, 3]]) {
      this.targets.push(new RangeTarget(scene, { x, z: line - dz, distance: dz }));
    }
    this.targets.push(new RangeTarget(scene, {
      x: 0, z: line - 32, distance: 32, moving: { span: 9, speed: 0.8 },
    }));
    this.targets.push(new RangeTarget(scene, {
      x: 0, z: line - 18, distance: 18, moving: { span: 5, speed: 1.5 },
    }));
    // melee dummies, right where you stand
    for (const x of [-8, 8]) {
      this.targets.push(new RangeTarget(scene, { x, z: line - 3, distance: 3 }));
    }
  }

  hitMeshes() {
    const out = [];
    for (const t of this.targets) if (t.down <= 0) out.push(...t.hitMeshes);
    return out;
  }

  resolve(object) {
    let o = object;
    while (o) {
      const t = this.targets.find((tt) => tt.hitMeshes.includes(o));
      if (t) return t;
      o = o.parent;
    }
    return null;
  }

  update(dt) {
    for (const t of this.targets) t.update(dt);
  }

  clear() {
    for (const t of this.targets) t.dispose(this.scene);
    this.targets.length = 0;
  }
}
