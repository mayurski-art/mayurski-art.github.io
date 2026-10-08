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
// { anvil: [x, y, z] (the top of its face), forge: [x, y, z], quench: [x, y, z], stand: {anvil,
// forge, quench: [x, z]} }.

import * as THREE from "three";
import { reachHand, setHandPose } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1";

const WALK_MPS = 1.25;
const STRIKE = 1.4;        // one blow, s (up slow, down fast)
const BLOWS = 4;
const HEAT_TIME = 3.6;
const QUENCH_TIME = 2.4;
const QUENCH_EVERY = 3;    // rounds per piece
const NEAR = 40;           // forge and sparks only drawn inside this
const HEAR = 32;           // and heard
const POOL = 120;
// The tools, m: the hammer's head sits HANDLE up the handle from the fist;
// the tongs reach TONGS from the fist to the jaws; a fist closes FIST past
// the wrist; at the blow the handle is IMPACT rad off level, head down.
const HANDLE = 0.36, HEAD = 0.17, TONGS = 0.5, BILLET = 0.26, FIST = 0.06, IMPACT = -0.12;
const smooth = (x) => x * x * (3 - 2 * x);

const COLD = new THREE.Color(0x2a2220), HOT = new THREE.Color(0xff8a2a), WHITE = new THREE.Color(0xffd890);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _m = new THREE.Matrix4();
const _sR = new THREE.Vector3(), _sL = new THREE.Vector3(), _al = new THREE.Vector3(), _tg = new THREE.Vector3();
const _jw = new THREE.Vector3(), _gL = new THREE.Vector3(), _gR = new THREE.Vector3(), _hd = new THREE.Vector3();
const _hu = new THREE.Vector3(), _pole = new THREE.Vector3();
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

    // the hammer: an ash handle along +Y out of the fist (a stub below it),
    // the iron head across its end along Z, the striking face at -Z
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.8 });
    this.iron = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.45, metalness: 0.7 });
    this.hammer = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.021, HANDLE + 0.1, 6).translate(0, (HANDLE + 0.1) / 2 - 0.06, 0), wood);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.07, HEAD), this.iron);
    head.position.y = HANDLE;
    this.hammer.add(handle, head);
    // the tongs: two iron rods from the fist to the jaws
    const rod = new THREE.CylinderGeometry(0.012, 0.012, 1, 5).translate(0, 0.5, 0);
    this.tongs = [new THREE.Mesh(rod, this.iron), new THREE.Mesh(rod, this.iron)];
    // the billet: a bar of iron that glows with its heat
    this.metal = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.5, metalness: 0.6, emissive: 0x000000 });
    this.billet = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, BILLET), this.metal);
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
     base pose. `t` is the NPC's clock. The work is placed in the world
     first (where the billet lies, where the hammer's face must land) and the
     hands are put on the tools with two-bone IK (user: "it needs to make
     sense. like the way the hammer is held"): the right fist round the end
     of the hammer's handle, the left round the tongs' handles, the tongs'
     jaws closed on the billet's end. */
  pose(rig, t) {
    const p = rig.parts, s = this.state, n = this.n;
    const vis = rig.root.visible;
    for (const o of this.tools) o.visible = vis;
    if (!vis) return;
    _f.set(-Math.sin(n.yaw), 0, -Math.cos(n.yaw));          // facing
    _r.set(-_f.z, 0, _f.x);                                   // his right
    const wob = Math.sin(t * 1.7 + n.seed * 6);
    // the lean first: it moves the shoulders the arms reach from
    let lift = 0;
    if (s === "strike") {
      const u = (this.stateT % STRIKE) / STRIKE;
      // up slow, down fast, a little rebound off the iron after the blow
      lift = u < 0.62 ? smooth(u / 0.62) : u < 0.78 ? 1 - ((u - 0.62) / 0.16) ** 2 : 0.07 * Math.sin(Math.PI * (u - 0.78) / 0.22);
      p.chest.rotation.x += 0.2 - lift * 0.12;
    } else if (s === "heat") p.chest.rotation.x += 0.2;
    else if (s === "quench") p.chest.rotation.x += 0.12 + 0.2 * Math.min(1, this.stateT / 0.5);
    rig.root.updateMatrixWorld(true);
    const shR = p.armR.getWorldPosition(_sR), shL = p.armL.getWorldPosition(_sL);

    // --- the billet, lying along `along`, and the tongs that hold its near
    // end (`tong`: from the left fist to the jaws)
    const at = this.billet.position, along = _al, tong = _tg;
    if (s === "strike") {
      // flat on the anvil's face, across it from his left; the tongs come
      // in from the left and down onto its end
      at.set(this.anvil.x, this.anvil.y + 0.018, this.anvil.z);
      along.copy(_r);
      tong.copy(_r).multiplyScalar(0.8).addScaledVector(_f, 0.4).addScaledVector(UP, -0.35);
    } else if (s === "heat") {
      // pushed into the coals, worked back and forth now and then
      at.copy(this.forge).addScaledVector(_f, 0.05 * wob);
      along.copy(_f);
      tong.copy(_f).addScaledVector(UP, -0.45).addScaledVector(_r, 0.25);
    } else if (s === "quench") {
      // plunged end first into the barrel
      const dip = smooth(Math.min(1, this.stateT / 0.5));
      at.set(this.quench.x, this.quench.y + 0.25 - dip * 0.45, this.quench.z);
      along.copy(_f).multiplyScalar(0.4).addScaledVector(UP, -1);
      tong.copy(_f).multiplyScalar(0.5).addScaledVector(UP, -0.85).addScaledVector(_r, 0.2);
    } else {
      // carried out in front, the hot end away from him
      at.copy(shL).addScaledVector(_f, 0.62).addScaledVector(_r, 0.14).addScaledVector(UP, -0.78);
      along.copy(_f).addScaledVector(UP, -0.25);
      tong.copy(_f).addScaledVector(UP, -0.3);
    }
    along.normalize(); tong.normalize();
    _m.lookAt(_a.set(0, 0, 0), along, UP);   // the bar's long (z) axis along `along`
    this.billet.quaternion.setFromRotationMatrix(_m);
    const jaw = _jw.copy(at).addScaledVector(along, 0.03 - BILLET / 2);
    const gripL = _gL.copy(jaw).addScaledVector(tong, -TONGS);

    // --- the hammer: the handle's direction `hd` (fist to head) and the grip
    const hd = _hd, gripR = _gR;
    if (s === "strike") {
      // At impact the handle is nearly level, pointing at the work, the head
      // upright with its face flat on the billet; at the top the fist is up
      // past his shoulder and the head cocked back over it. The handle turns
      // about his right-hand axis between the two, and the fist swings on an
      // arc about the shoulder.
      const phi = IMPACT + lift * 2.35;
      hd.copy(_f).multiplyScalar(Math.cos(phi)).addScaledVector(UP, Math.sin(phi));
      // the grip at impact: back from the face along the head, then the handle
      _c.copy(_f).multiplyScalar(Math.cos(IMPACT)).addScaledVector(UP, Math.sin(IMPACT));   // hd at impact
      _hu.crossVectors(_r, _c).normalize();                                         // the head's axis, up
      _d.set(this.anvil.x, this.anvil.y + 0.035, this.anvil.z).addScaledVector(_hu, HEAD / 2).addScaledVector(_c, -HANDLE).sub(shR);
      const side = _d.dot(_r), fwd = _d.dot(_f), upv = _d.dot(UP);
      const rad0 = Math.hypot(fwd, upv), ang0 = Math.atan2(upv, fwd);
      const ang = ang0 + (1.3 - ang0) * lift, rad = rad0 + (0.46 - rad0) * lift;
      gripR.copy(shR).addScaledVector(_r, side + (0.14 - side) * lift)
        .addScaledVector(_f, Math.cos(ang) * rad).addScaledVector(UP, Math.sin(ang) * rad);
    } else {
      // hanging at his side, head down, swinging a little as he walks
      hd.set(0, -1, 0).addScaledVector(_f, 0.25 + (n.moving ? 0.12 * wob : 0)).normalize();
      gripR.copy(shR).addScaledVector(_r, 0.12).addScaledVector(_f, 0.06).addScaledVector(UP, -0.62);
    }

    // --- the arms onto the grips
    this.reachTo(rig, 1, gripR, lift);
    this.reachTo(rig, -1, gripL, 0);
    setHandPose(rig, 1, "fist"); setHandPose(rig, -1, "fist");
    rig.body?.update?.();
    rig.root.updateMatrixWorld(true);

    // the tools go where the fists actually got to
    const fistR = this.fist(p.elbowR, p.handR ?? p.gripR, _gR);
    _hu.crossVectors(_r, hd).normalize();            // the head's long axis, the face at its -z end
    _m.makeBasis(_c.crossVectors(hd, _hu), hd, _hu);
    this.hammer.quaternion.setFromRotationMatrix(_m);
    this.hammer.position.copy(fistR);
    const fistL = this.fist(p.elbowL, p.handL ?? p.gripL, _gL);
    _hu.crossVectors(tong, UP).normalize();
    for (let i = 0; i < 2; i++) {
      const sgn = i ? 1 : -1;
      // the handles a fist's width apart, the jaws closed on the bar
      _a.copy(fistL).addScaledVector(_hu, sgn * 0.02);
      _b.copy(jaw).addScaledVector(_hu, sgn * 0.01);
      stretch(this.tongs[i], _a, _b);
    }
    if (this.struck) {
      // how far the hammer's face landed from the work (the test reads it)
      this.struck = false;
      this.hammer.updateMatrixWorld(true);
      this.gap = this.hammer.localToWorld(_a.set(0, HANDLE, -HEAD / 2)).distanceTo(_b.set(this.anvil.x, this.anvil.y + 0.035, this.anvil.z));
    }
    // its glow: dark iron, then cherry, orange, near white at the hottest
    const h = this.heat;
    const e = h < 0.7 ? HOT.clone().multiplyScalar(Math.max(0, (h - 0.15) / 0.55)) : HOT.clone().lerp(WHITE, (h - 0.7) / 0.3);
    this.metal.emissive.copy(e).multiplyScalar(1.6);
    this.metal.color.copy(COLD).lerp(HOT, h * 0.4);
  }

  /* The wrist onto a world grip point: two-bone IK in chest space, the elbow
     down and out (forward and up as the hammer goes up). */
  reachTo(rig, side, grip, up) {
    const p = rig.parts;
    // aim the wrist a fist short of the grip, so the fist closes round it
    const sh = (side > 0 ? p.armR : p.armL).getWorldPosition(_c);
    const w = _d.subVectors(grip, sh);
    const len = w.length();
    w.multiplyScalar(Math.max(0, len - FIST) / Math.max(1e-6, len)).add(sh);
    p.chest.worldToLocal(w);
    _pole.set(side, -1 + up * 1.2, 0.3 - up * 0.7);
    reachHand(rig, side, w, _pole);
  }

  /* Where a fist closes: a little past the wrist along the forearm. */
  fist(elbow, hand, out) {
    const wr = hand.getWorldPosition(out);
    const el = elbow.getWorldPosition(_c);
    return wr.addScaledVector(el.subVectors(wr, el).normalize(), FIST);
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
    const at = _c.set(this.anvil.x, this.anvil.y + 0.04, this.anvil.z);
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
