// Troll Forces — the blacksmith at work (user, 2026-10-07: "the blacksmith
// isn't using anything to work on the anvil maybe give him some materials.
// have a nice animation going. take some inspiration from a skyrim
// blacksmith who also works with the nearby furnace? fire?").
//
// A townsfolk act (`act: "smith"`, town-npcs.js) with its own loop: four
// strikes on the anvil with the billet held in tongs (sparks, a clank, the
// metal cooling from orange to dull), a walk to the forge, the billet pushed
// into the coals until it glows again (the fire flares, embers rise), back
// to the anvil; every third round it's quenched in the barrel (steam, a
// hiss) and a fresh piece goes in the fire. The forge flickers whenever the
// smithy is near. Per client like every townsfolk: nothing on the wire.
//
// The map hands over its forge (`rp.smithy()`: the light, the coal and glow
// materials) and the NPC entry says where the anvil, forge and barrel are:
// { anvil: [x, y, z], forge: [x, y, z], quench: [x, y, z], stand: {anvil,
// forge, quench: [x, z]} }.

import * as THREE from "three";

const WALK_MPS = 1.25;
const STRIKE = 1.4;        // one blow, s (up slow, down fast)
const BLOWS = 4;
const HEAT_TIME = 3.6;
const QUENCH_TIME = 2.4;
const QUENCH_EVERY = 3;    // rounds per piece
const NEAR = 40;           // forge and sparks only drawn inside this
const HEAR = 32;           // and heard
const POOL = 120;

const COLD = new THREE.Color(0x2a2220), HOT = new THREE.Color(0xff8a2a), WHITE = new THREE.Color(0xffd890);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

/* A unit stick from its base along +Y, stretched between two points. */
function stretch(mesh, from, to) {
  _d.subVectors(to, from);
  const len = _d.length();
  mesh.position.copy(from);
  mesh.scale.set(1, Math.max(0.001, len), 1);
  mesh.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / Math.max(1e-6, len)));
}

export class SmithWork {
  constructor(scene, n, smithy = null) {
    this.scene = scene;
    this.n = n;
    const c = n.c;
    this.anvil = new THREE.Vector3(...c.anvil);
    this.forge = new THREE.Vector3(...c.forge);
    this.quench = new THREE.Vector3(...c.quench);
    this.stand = c.stand;
    this.smithy = smithy;
    this.heat = 1;
    this.round = Math.floor(n.seed * QUENCH_EVERY);
    this.state = "strike";
    this.stateT = n.seed * BLOWS * STRIKE;
    this.blow = Math.floor(this.stateT / STRIKE);
    this.log = [];               // the last few states, for the test
    this.flick = n.seed * 10;
    // the right arm, elbow and the hammer's cock off the forearm as the blow lands
    // (fitted so the face lands on the billet: smith-test checks the gap)
    this.reach = [0.7, 0.5, -1.2];

    // the hammer: an ash handle along +Y from the fist, the iron head across
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.8 });
    this.iron = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.45, metalness: 0.7 });
    this.hammer = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.42, 6).translate(0, 0.15, 0), wood);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.065, 0.17), this.iron);
    head.position.y = 0.35;
    this.hammer.add(handle, head);
    // the tongs: two iron rods from the fist to the jaws
    const rod = new THREE.CylinderGeometry(0.008, 0.008, 1, 4).translate(0, 0.5, 0);
    this.tongs = [new THREE.Mesh(rod, this.iron), new THREE.Mesh(rod, this.iron)];
    // the billet: a bar of iron that glows with its heat
    this.metal = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.5, metalness: 0.6, emissive: 0x000000 });
    this.billet = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.24), this.metal);
    this.tools = [this.hammer, ...this.tongs, this.billet];
    for (const o of this.tools) { o.traverse((m) => { if (m.isMesh) m.castShadow = true; }); scene.add(o); }

    // sparks, embers and steam share one pool of additive points
    this.pts = Array.from({ length: POOL }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), g: 9.8, col: new THREE.Color() }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(POOL * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(POOL * 3), 3));
    this.cloud = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.045, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.cloud.frustumCulled = false;
    scene.add(this.cloud);
    this.emberAcc = 0;
    this.coalBase = smithy?.coal?.color.clone() ?? null;
    this.lightBase = smithy?.light?.intensity ?? 0;
  }

  get live() { return this.pts.reduce((s, q) => s + (q.life > 0 ? 1 : 0), 0); }

  go(state) {
    this.state = state;
    this.stateT = 0;
    this.log.push(state);
    if (this.log.length > 12) this.log.shift();
  }

  /* Where Ike stands for a station: [x, z]. */
  spot(k) { return this.stand[k]; }

  /* The loop: move Ike (n.x/z/yaw/moving) and the work along. */
  step(dt, dist, audio) {
    const n = this.n;
    this.stateT += dt;
    this.near = dist < NEAR;
    this.audio = dist < HEAR && audio?._ready?.() ? audio : null;
    n.moving = false;
    switch (this.state) {
      case "strike": {
        this.heat = Math.max(0.25, this.heat - dt * 0.11);
        const blow = Math.floor(this.stateT / STRIKE);
        // the blow lands at 78% of the cycle
        if (blow === this.blow && this.stateT - blow * STRIKE >= STRIKE * 0.78) { this.blow = blow + 1; this.hit(); }
        if (this.stateT >= BLOWS * STRIKE) {
          this.round++;
          this.go(this.round % QUENCH_EVERY === 0 ? "toQuench" : "toForge");
        }
        break;
      }
      case "toForge": if (this.walk(dt, "forge")) { this.go("heat"); this.flare(); } break;
      case "heat":
        this.heat = Math.min(1, this.heat + dt * 0.45);
        if (this.stateT >= HEAT_TIME) this.go("toAnvil");
        break;
      case "toAnvil": if (this.walk(dt, "anvil")) { this.go("strike"); this.blow = 0; } break;
      case "toQuench": if (this.walk(dt, "quench")) { this.go("quench"); this.steamed = false; } break;
      case "quench":
        if (!this.steamed && this.stateT > 0.5) { this.steamed = true; this.steam(); }
        if (this.steamed) this.heat = Math.max(0, this.heat - dt * 2);
        // a fresh piece from the pile for the fire
        if (this.stateT >= QUENCH_TIME) { this.heat = 0; this.go("toForge"); }
        break;
    }
    if (this.near) { this.forgeLife(dt); this.particles(dt); }
    else if (this.live) for (const q of this.pts) q.life = 0;
    this.cloud.visible = this.near && n.rig.root.visible;
  }

  walk(dt, to) {
    const n = this.n, [x, z] = this.spot(to);
    const dx = x - n.x, dz = z - n.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { n.x = x; n.z = z; n.yaw = Math.PI; return true; }
    const s = Math.min(d, WALK_MPS * dt);
    n.x += dx / d * s; n.z += dz / d * s;
    n.yaw = Math.atan2(-dx, -dz);
    n.moving = true;
    return false;
  }

  /* The arms, the tools in the hands, the billet's glow; after the body's
     base pose. `t` is the NPC's clock. */
  pose(rig, t) {
    const p = rig.parts, s = this.state, n = this.n;
    const sw = (rate, off = 0) => Math.sin(t * rate + n.seed * 6 + off);
    if (s === "strike") {
      const u = (this.stateT % STRIKE) / STRIKE;
      // up slow, down fast, a rebound after the blow
      const lift = u < 0.62 ? (u / 0.62) : u < 0.78 ? 1 - ((u - 0.62) / 0.16) ** 2 : 0.08 * (1 - (u - 0.78) / 0.22);
      const [arm, elbow] = this.reach;
      p.armR.rotation.set(arm + lift * (2.4 - arm), 0, -0.12); p.elbowR.rotation.set(elbow + lift * (1.3 - elbow), 0, 0);
      p.armL.rotation.set(0.7, 0, 0.2); p.elbowL.rotation.set(0.95, 0, 0);
      p.chest.rotation.x += 0.18 + (1 - lift) * 0.1;
    } else if (s === "heat") {
      // the billet in the coals, turned now and then
      p.armL.rotation.set(1.0 + sw(1.7) * 0.05, 0, 0.12); p.elbowL.rotation.set(0.35, 0, 0);
      p.armR.rotation.set(0.12, 0, -0.08); p.elbowR.rotation.set(0.35, 0, 0);
      p.chest.rotation.x += 0.22;
    } else if (s === "quench") {
      const dip = Math.min(1, this.stateT / 0.5);
      p.armL.rotation.set(0.95 - dip * 0.35, 0, 0.1); p.elbowL.rotation.set(0.55, 0, 0);
      p.armR.rotation.set(0.12, 0, -0.08); p.elbowR.rotation.set(0.35, 0, 0);
      p.chest.rotation.x += 0.3 * dip;
    } else {
      // walking: the hammer down at his side, the work held out in the tongs
      p.armR.rotation.set(0.12, 0, -0.1); p.elbowR.rotation.set(0.3, 0, 0);
      p.armL.rotation.set(0.6, 0, 0.1); p.elbowL.rotation.set(0.85, 0, 0);
    }
    rig.body?.update?.();
    rig.root.updateMatrixWorld(true);
    this.placeTools(rig);
    if (this.struck) {
      // how far the hammer's face landed from the work (the test reads it)
      this.struck = false;
      this.hammer.updateMatrixWorld(true);
      this.gap = this.hammer.localToWorld(_a.set(0, 0.35, 0)).distanceTo(_b.set(this.anvil.x - 0.08, this.anvil.y + 0.04, this.anvil.z));
    }
  }

  placeTools(rig) {
    const p = rig.parts, vis = rig.root.visible, n = this.n;
    for (const o of this.tools) o.visible = vis;
    if (!vis) return;
    _f.set(-Math.sin(n.yaw), 0, -Math.cos(n.yaw));          // facing
    _r.set(-_f.z, 0, _f.x);                                   // his right
    // hammer: the handle leaves the fist turned about his right-hand axis
    // off the forearm; striking, the wrist cocks it down onto the work, at
    // his side it hangs nearly along the arm
    const fistR = (p.handR ?? p.gripR).getWorldPosition(_a);
    const elbR = p.elbowR.getWorldPosition(_b);
    const u = _c.subVectors(fistR, elbR).normalize();
    const w = _d.crossVectors(_r, u);
    const cock = this.state === "strike" ? this.reach[2] : 0.2;
    const y = u.multiplyScalar(Math.cos(cock)).addScaledVector(w, Math.sin(cock)).normalize();
    const zAx = _b.crossVectors(_r, y).normalize();
    const xAx = _d.crossVectors(y, zAx);
    _m.makeBasis(xAx, y, zAx);
    this.hammer.quaternion.setFromRotationMatrix(_m);
    this.hammer.position.copy(fistR);
    // the billet: on the anvil, in the coals, in the barrel, or out in the tongs
    const fistL = (p.handL ?? p.gripL).getWorldPosition(_a);
    const at = this.billet.position;
    const s = this.state;
    if (s === "strike") at.set(this.anvil.x - 0.08, this.anvil.y + 0.02, this.anvil.z);
    else if (s === "heat") at.copy(this.forge);
    else if (s === "quench") at.lerpVectors(_c.set(this.quench.x, this.quench.y + 0.25, this.quench.z), _d.set(this.quench.x, this.quench.y - 0.2, this.quench.z), Math.min(1, this.stateT / 0.5));
    else at.copy(fistL).addScaledVector(_f, 0.42).addScaledVector(UP, -0.06);
    this.billet.rotation.set(0, n.yaw, 0);
    // the tongs from the left fist to the billet's near end
    const jaw = _c.copy(at).addScaledVector(_f, -0.1);
    for (let i = 0; i < 2; i++) {
      _d.copy(fistL).addScaledVector(_r, i ? 0.012 : -0.012);
      stretch(this.tongs[i], _d, _b.copy(jaw).addScaledVector(_r, i ? 0.006 : -0.006));
    }
    // its glow: dark iron, then cherry, orange, near white at the hottest
    const h = this.heat;
    const e = h < 0.7 ? HOT.clone().multiplyScalar(Math.max(0, (h - 0.15) / 0.55)) : HOT.clone().lerp(WHITE, (h - 0.7) / 0.3);
    this.metal.emissive.copy(e).multiplyScalar(1.6);
    this.metal.color.copy(COLD).lerp(HOT, h * 0.4);
  }

  /* The forge breathes: the light and the coals flicker, brighter while a
     piece is heating. */
  forgeLife(dt) {
    const f = this.smithy;
    if (!f) return;
    this.flick += dt;
    const k = 0.82 + 0.1 * Math.sin(this.flick * 7.3) + 0.06 * Math.sin(this.flick * 17.1 + 1.3) + 0.05 * Math.sin(this.flick * 2.1);
    const boost = this.state === "heat" ? 0.35 * Math.min(1, this.stateT * 2) : 0;
    if (f.light) f.light.intensity = this.lightBase * (k + boost);
    if (f.coal && this.coalBase) f.coal.color.copy(this.coalBase).multiplyScalar(k + boost * 0.6);
    if (f.glow) f.glow.opacity = Math.min(1, 0.75 * k + boost);
    // embers drifting up off the coals
    this.emberAcc += dt * (this.state === "heat" ? 14 : 5);
    while (this.emberAcc >= 1) {
      this.emberAcc -= 1;
      this.spawn(_a.set(this.forge.x + (Math.random() - 0.5) * 1.1, this.forge.y + 0.02, this.forge.z + (Math.random() - 0.5) * 0.6),
        _b.set((Math.random() - 0.5) * 0.25, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.25), 1.2 + Math.random() * 1.2, -0.15, 0xff7020);
    }
  }

  /* A blow on the anvil: a spray of sparks and a ring of iron. */
  hit() {
    const at = _c.set(this.anvil.x - 0.08, this.anvil.y + 0.04, this.anvil.z);
    this.struck = true;   // pose() measures the blow once the arm is down
    if (this.near) {
      const count = Math.round(6 + this.heat * 8);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, sp = 1.6 + Math.random() * 2.6;
        this.spawn(at, _b.set(Math.cos(a) * sp, 1.2 + Math.random() * 2.2, Math.sin(a) * sp), 0.3 + Math.random() * 0.35, 9.8, this.heat > 0.6 ? 0xffd070 : 0xff9a40);
      }
    }
    const au = this.audio;
    if (au) {
      au._tone({ freq: 1180 + Math.random() * 90, duration: 0.32, gain: 0.08, type: "triangle", at });
      au._tone({ freq: 2650, duration: 0.2, gain: 0.035, at });
      au._noise({ duration: 0.05, gain: 0.12, type: "highpass", freq: 3200, at });
    }
  }

  /* The billet goes into the coals: a puff of sparks and a soft whump. */
  flare() {
    if (this.near) for (let i = 0; i < 14; i++)
      this.spawn(this.forge, _b.set((Math.random() - 0.5) * 1.2, 1 + Math.random() * 1.6, (Math.random() - 0.5) * 1.2), 0.4 + Math.random() * 0.5, 4, 0xffb050);
    this.audio?._noise({ duration: 0.45, gain: 0.1, type: "lowpass", freq: 380, sweepTo: 160, at: this.forge });
  }

  /* Into the barrel: a hiss and a cloud of steam. */
  steam() {
    const at = _c.set(this.quench.x, this.quench.y + 0.05, this.quench.z);
    if (this.near) for (let i = 0; i < 26; i++)
      this.spawn(at, _b.set((Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.5), 0.9 + Math.random() * 0.8, -0.3, 0x6a6a70);
    this.audio?._noise({ duration: 1.3, gain: 0.1, type: "highpass", freq: 4200, sweepTo: 2200, at });
  }

  spawn(at, vel, life, g, color) {
    const q = this.pts.find((x) => x.life <= 0);
    if (!q) return;
    q.p.copy(at); q.v.copy(vel); q.life = q.max = life; q.g = g; q.col.setHex(color);
  }

  particles(dt) {
    const pos = this.cloud.geometry.attributes.position, col = this.cloud.geometry.attributes.color;
    const floor = this.anvil.y - 0.8;
    for (let i = 0; i < POOL; i++) {
      const q = this.pts[i];
      if (q.life > 0) {
        q.life -= dt;
        q.v.y -= q.g * dt;
        q.p.addScaledVector(q.v, dt);
        if (q.p.y < floor) { q.p.y = floor; q.v.multiplyScalar(0.3); q.v.y = Math.abs(q.v.y) * 0.3; }
      }
      const k = Math.max(0, q.life / q.max);
      pos.setXYZ(i, q.p.x, q.life > 0 ? q.p.y : -999, q.p.z);
      col.setXYZ(i, q.col.r * k, q.col.g * k, q.col.b * k);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  dispose() {
    const f = this.smithy;
    if (f?.light) f.light.intensity = this.lightBase;
    if (f?.coal && this.coalBase) f.coal.color.copy(this.coalBase);
    for (const o of [...this.tools, this.cloud]) {
      o.parent?.remove(o);
      o.traverse((m) => { m.geometry?.dispose(); });
    }
    this.metal.dispose(); this.iron.dispose(); this.cloud.material.dispose();
  }
}
