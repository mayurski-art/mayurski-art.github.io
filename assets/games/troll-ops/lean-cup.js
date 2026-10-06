// Troll Forces — the "Pour up" emote's props: a double-stacked styrofoam
// cup, a Sprite bottle of lean (soda, the pink stuff and Jolly Ranchers
// floating in it), ice cubes and the pour.
//
// User, 2026-10-05: "i activate the emote which spawn a empty double
// styrofoam cup held in my right hand. and then the animation continues
// with the pouring and ice cubs being added into the cup from my left hand.
// the ice cubes can come from out of nowhere ... and then after swirling the
// cup you take a sip". A first-person emote: you look down at the cup in
// your own hands; everyone else sees your body do it (emotes.js poseLeanTP)
// with the same props.
//
// One clock drives both: LEAN (phase windows in seconds) and the k-values
// below. LeanKit owns one set of meshes and puts them on whichever hands
// it's given: first-person (fp: the streak-arm hands, viewmodel space) or a
// body (tp: the rig's mitts, upright in the rig's root frame).

import * as THREE from "three";

export const LEAN = {
  cupIn: [0, 0.5],          // the empty cup pops into the right hand
  iceUp: [0.55, 0.95],      // left fist comes up full of ice from nowhere
  iceOver: [0.95, 1.3],     // over the cup
  drop: [1.3, 1.75],        // opens, the cubes fall in
  iceAway: [1.75, 2.1],     // the left hand drops out
  bottleUp: [2.1, 2.6],     // and comes back with the bottle
  tilt: [2.6, 2.95],        // tips it over the cup
  pour: [2.95, 5.2],        // the stream
  untilt: [5.2, 5.55],
  bottleAway: [5.55, 6.0],
  swirl: [6.0, 7.4],        // round and round
  sipUp: [7.5, 8.0],
  sipDown: [8.5, 8.95],
  cupOut: [8.95, 9.5],
};
export const LEAN_SECONDS = 9.5;
export const LEAN_FILL = 0.82;          // how full the pour leaves it
const ICE = 4;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
export const span = (t, [a, b]) => ease((t - a) / (b - a));
const raw = (t, [a, b]) => clamp01((t - a) / (b - a));

/* Everything the props and hands need at `t`, as 0..1 knobs. */
export function leanState(t) {
  const cup = span(t, LEAN.cupIn) * (1 - span(t, LEAN.cupOut));
  const iceShown = t >= LEAN.iceUp[0] + 0.12 && t < LEAN.iceAway[0] + 0.01;
  const bottle = t >= LEAN.bottleUp[0] && t < LEAN.bottleAway[1];
  const tilt = span(t, LEAN.tilt) * (1 - span(t, LEAN.untilt));
  const pouring = t >= LEAN.pour[0] && t < LEAN.pour[1];
  const sip = span(t, LEAN.sipUp) * (1 - span(t, LEAN.sipDown));
  const fill = LEAN_FILL * span(t, LEAN.pour) - 0.12 * span(t, [LEAN.sipUp[1], LEAN.sipDown[0]]);
  const swirlK = span(t, [LEAN.swirl[0], LEAN.swirl[0] + 0.3]) * (1 - span(t, [LEAN.swirl[1] - 0.3, LEAN.swirl[1]]));
  return {
    cup, iceShown, bottle, tilt, pouring, sip, fill: Math.max(0, fill), swirlK,
    swirlA: (t - LEAN.swirl[0]) * 9,                       // radians round the swirl
    drop: raw(t, LEAN.drop),
    bottleLevel: 0.72 - 0.36 * span(t, LEAN.pour),
    look: span(t, [0.1, 0.6]) * (1 - span(t, [LEAN.sipUp[0] - 0.2, LEAN.sipUp[0] + 0.2])),
  };
}

/* ------------------------------------------------------------ materials */

let foamTex = null;
function styrofoam() {
  if (!foamTex) {
    // Tiny pressed beads, the texture a foam cup has up close.
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#f7f4ee";
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      const v = 228 + Math.floor(Math.random() * 24);
      g.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
      g.beginPath();
      g.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2.2, 0, Math.PI * 2);
      g.fill();
    }
    foamTex = new THREE.CanvasTexture(c);
    foamTex.colorSpace = THREE.SRGBColorSpace;
    foamTex.wrapS = foamTex.wrapT = THREE.RepeatWrapping;
    foamTex.repeat.set(3, 2);
  }
  return new THREE.MeshStandardMaterial({ map: foamTex, color: 0xffffff, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, emissive: 0x3a3833, emissiveIntensity: 0.25 });
}
const DRINK = new THREE.MeshStandardMaterial({ color: 0xb3125e, roughness: 0.18, metalness: 0, emissive: 0x4a0424, emissiveIntensity: 0.55 });
const DRINK_STREAM = new THREE.MeshStandardMaterial({ color: 0xc61a6a, roughness: 0.2, emissive: 0x5a0830, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 });
const ICE_MAT = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.9, emissive: 0x7cc4f0, emissiveIntensity: 0.45 });
const BOTTLE_MAT = new THREE.MeshStandardMaterial({ color: 0x3cc35a, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
const BOTTLE_DRINK = new THREE.MeshStandardMaterial({ color: 0xa8145a, roughness: 0.25, emissive: 0x3c0420, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 });
const RANCHERS = [0xe0182d, 0x1f4fe0, 0x23c43a, 0x8a2be2, 0xffc21f, 0xff5a1f].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.15, emissive: c, emissiveIntensity: 0.35 }));

/* ------------------------------------------------------------ the cup */

export const CUP = { h: 0.118, top: 0.044, bot: 0.03, stack: 0.013 };
const rAt = (y) => CUP.bot + (CUP.top - CUP.bot) * (y / CUP.h);

function cupShell(mat) {
  // A foam cup: tapered wall, a rolled rim, a recessed base.
  const pts = [
    new THREE.Vector2(0.0, 0.004), new THREE.Vector2(CUP.bot - 0.002, 0.004), new THREE.Vector2(CUP.bot, 0),
    new THREE.Vector2(CUP.top, CUP.h - 0.003), new THREE.Vector2(CUP.top + 0.0025, CUP.h - 0.001),
    new THREE.Vector2(CUP.top + 0.002, CUP.h + 0.0015), new THREE.Vector2(CUP.top - 0.0015, CUP.h),
  ];
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), mat);
  return m;
}

/* The double cup, base at the origin, standing up +Y. The top cup sits a
   finger higher than the one it's nested in, so both rims show. */
export function buildCup() {
  const g = new THREE.Group();
  const mat = styrofoam();
  const outer = cupShell(mat);
  const inner = cupShell(mat);
  inner.position.y = CUP.stack;
  inner.scale.setScalar(0.985);
  g.add(outer, inner);
  // The drink: a cylinder whose rings are re-laid each frame to the cup's
  // taper at the fill height (setFill).
  const geo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, false);
  const base = geo.attributes.position.array.slice();
  const liquid = new THREE.Mesh(geo, DRINK);
  liquid.visible = false;
  g.add(liquid);
  const floor = CUP.stack + 0.006;
  g.userData.height = CUP.h + CUP.stack;
  g.userData.floor = floor;
  g.userData.liquid = liquid;
  g.userData.top = floor;
  g.userData.setFill = (k) => {
    liquid.visible = k > 0.01;
    if (!liquid.visible) { g.userData.top = floor; return; }
    const top = floor + (CUP.h * 0.96 - floor) * k;
    const rT = rAt(top - CUP.stack) * 0.96, rB = rAt(floor - CUP.stack) * 0.96;
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      const isTop = by > 0;
      const r = isTop ? rT : rB;
      p.setXYZ(i, bx * r, isTop ? top : floor, bz * r);
    }
    p.needsUpdate = true;
    geo.computeBoundingSphere();
    g.userData.top = top;
  };
  // Ice: they live in the cup's frame, wherever they are.
  const cube = new THREE.BoxGeometry(0.02, 0.02, 0.02);
  g.userData.ice = [];
  for (let i = 0; i < ICE; i++) {
    const c = new THREE.Mesh(cube, ICE_MAT);
    c.visible = false;
    c.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    g.add(c);
    g.userData.ice.push(c);
  }
  // The pour stream, laid between two points in the cup's frame.
  const sg = new THREE.CylinderGeometry(0.0032, 0.0042, 1, 8, 1, true);
  sg.translate(0, -0.5, 0);
  const stream = new THREE.Mesh(sg, DRINK_STREAM);
  stream.visible = false;
  g.add(stream);
  g.userData.stream = stream;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return g;
}

/* ------------------------------------------------------------ the bottle */

let labelTex = null;
function spriteLabel() {
  if (labelTex) return labelTex;
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#0c7c36";
  g.fillRect(0, 0, 512, 128);
  for (let k = 0; k < 2; k++) {
    const x0 = k * 256;
    // The yellow-green splash behind the name.
    g.fillStyle = "#c8e62a";
    g.beginPath();
    g.moveTo(x0 + 20, 100);
    g.bezierCurveTo(x0 + 90, 40, x0 + 170, 120, x0 + 240, 30);
    g.lineTo(x0 + 240, 50);
    g.bezierCurveTo(x0 + 170, 140, x0 + 90, 60, x0 + 20, 118);
    g.fill();
    g.fillStyle = "#ffffff";
    g.strokeStyle = "#063d1a";
    g.lineWidth = 5;
    g.font = "italic 900 64px Arial Black, Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.strokeText("Sprite", x0 + 128, 62);
    g.fillText("Sprite", x0 + 128, 62);
  }
  labelTex = new THREE.CanvasTexture(c);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  return labelTex;
}

export const BOTTLE = { h: 0.19, r: 0.033 };
/* A 20 oz soda bottle, base at the origin, up +Y, cap off. Inside: lean
   (the level drops as it pours) with Jolly Ranchers bobbing in it. */
export function buildBottle() {
  const g = new THREE.Group();
  const R = BOTTLE.r;
  const prof = [
    [0.0, 0.0], [R * 0.82, 0.0], [R * 0.97, 0.006], [R, 0.02], [R * 0.93, 0.05], [R, 0.08],
    [R, 0.12], [R * 0.9, 0.14], [R * 0.6, 0.163], [R * 0.4, 0.176], [R * 0.37, BOTTLE.h],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), BOTTLE_MAT);
  shell.renderOrder = 3;
  g.add(shell);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.4, 0.0025, 6, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = BOTTLE.h - 0.012;
  g.add(ring);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.01, R * 1.01, 0.05, 24, 1, true),
    new THREE.MeshStandardMaterial({ map: spriteLabel(), roughness: 0.45, emissive: 0xffffff, emissiveMap: spriteLabel(), emissiveIntensity: 0.18 }));
  label.position.y = 0.1;
  g.add(label);
  const drink = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.9, R * 0.85, 1, 20), BOTTLE_DRINK);
  drink.renderOrder = 2;
  g.add(drink);
  const ranchers = RANCHERS.map((m, i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.006, 0.009), m);
    b.userData.a = (i / RANCHERS.length) * Math.PI * 2;
    b.userData.y = 0.012 + (i % 3) * 0.012;
    g.add(b);
    return b;
  });
  g.userData.height = BOTTLE.h;
  g.userData.mouth = new THREE.Vector3(0, BOTTLE.h, 0);
  g.userData.setLevel = (k, t = 0) => {
    const top = 0.006 + 0.13 * k;
    drink.scale.y = top - 0.006;
    drink.position.y = 0.006 + drink.scale.y / 2;
    for (const b of ranchers) {
      const a = b.userData.a + t * 0.8;
      b.position.set(Math.cos(a) * R * 0.45, Math.min(b.userData.y + Math.sin(t * 2 + a) * 0.003, top - 0.006), Math.sin(a) * R * 0.45);
      b.rotation.set(a, a * 1.7, t * 0.5);
    }
  };
  g.userData.setLevel(0.72);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return g;
}

/* ------------------------------------------------------------ the kit */

const _hw = new THREE.Vector3(), _mw = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _off = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _up = new THREE.Vector3(0, 1, 0);
const _rootQ = new THREE.Quaternion(), _m = new THREE.Matrix4();

/* Round grips, fitted to the glove model (glove-model.js) so the fingers
   and palm lie on the prop's surface, wrapped about 130-150 degrees round
   it, with under 1.5 mm of overlap anywhere on the glove, thumb included (user: "make sure theres no obvious
   collisions ... the items should be held correctly"). In the hand's own
   frame (palm -Y, fingers -Z, the prop standing along X): the prop's axis
   passes through (y, z), and the hand sits `h` up the prop, where its
   radius matches the grip (the cup's outer wall, the bottle's body). `pose` is the matching hand shape (emotes.js
   FP_HAND_POSES). */
export const GRIP = {
  cup: { y: -0.05, z: -0.024, h: 0.072, pose: "cupgrip" },
  bottle: { y: -0.043, z: -0.018, h: 0.085, pose: "bottlegrip" },
};
const _ax = new THREE.Vector3();
/* A prop in a first-person hand: its axis through the grip, up the hand's
   ∓X (the arm frames turn the hand palm-inward, so that's up). */
function gripPlace(obj, hand, side, fit) {
  _off.set(side * fit.h * obj.scale.x, fit.y, fit.z).applyQuaternion(hand.quaternion);
  obj.position.copy(hand.position).add(_off);
  _q.setFromUnitVectors(_up, _ax.set(-side, 0, 0));
  obj.quaternion.copy(hand.quaternion).multiply(_q);
}

export class LeanKit {
  constructor() {
    this.cup = buildCup();
    this.bottle = buildBottle();
    this.cup.visible = this.bottle.visible = false;
    this.lastFill = -1;
    // Whatever a body does after the emote (dies, sits, gets a pose that
    // never calls poseHumanoid), props nobody has placed lately put
    // themselves away the next time they'd draw.
    this.seen = 0;
    const stale = () => { if (performance.now() - this.seen > 250) this.hide(); };
    for (const g of [this.cup, this.bottle]) g.children[0].onBeforeRender = stale;
  }

  hide() {
    this.cup.visible = this.bottle.visible = false;
  }

  dispose() {
    this.cup.parent?.remove(this.cup);
    this.bottle.parent?.remove(this.bottle);
  }

  /* First person: `parent` holds the hands (streak arms, viewmodel space). */
  fp(parent, handR, handL, t) {
    const s = leanState(t);
    this.seen = performance.now();
    if (this.cup.parent !== parent) parent.add(this.cup);
    if (this.bottle.parent !== parent) parent.add(this.bottle);
    this.cup.visible = s.cup > 0.02;
    this.cup.scale.setScalar(0.6 + 0.4 * Math.min(1, s.cup * 1.4));
    gripPlace(this.cup, handR, 1, GRIP.cup);
    this.bottle.visible = s.bottle;
    if (s.bottle) gripPlace(this.bottle, handL, -1, GRIP.bottle);
    this.finish(s, t, handL, null);
  }

  /* A body (emotes.js poseLeanTP): the right arm reaches the cup out in
     front of the chest, the cup sits in that mitt's palm, and the left arm
     is aimed off the cup's real rim: a fist of ice over it, then the bottle
     tipped so its mouth is just above it. `reach` is character.js
     reachHand (chest-space targets). */
  tp(rig, t, reach) {
    const s = leanState(t);
    this.seen = performance.now();
    const p = rig.parts, root = rig.root;
    const k = rig.scale || 1, w = rig.build || 1;
    if (this.cup.parent !== root) root.add(this.cup);
    if (this.bottle.parent !== root) root.add(this.bottle);

    // Right arm: cup in front of the chest, circling for the swirl, up to
    // the mouth for the sip.
    _tR.set((0.07 + Math.cos(s.swirlA) * 0.035 * s.swirlK) * k * w, (-0.62 + 0.36 * s.cup) * k,
      -(0.05 + 0.27 * s.cup + Math.sin(s.swirlA) * 0.035 * s.swirlK) * k);
    _tR.lerp(_a.set(0.05 * k * w, 0.02 * k, -0.24 * k), s.sip);
    reach(rig, 1, _tR, _poleR);
    root.updateMatrixWorld(true);

    // The cup in the right palm, upright in the root frame (tipped for the sip).
    this.cup.visible = s.cup > 0.02;
    const cs = 1.3 * k * (0.6 + 0.4 * Math.min(1, s.cup * 1.4));
    this.cup.scale.setScalar(cs);
    palmCentre(rig, 1, k, _hw);
    this.cup.rotation.set(s.sip * 1.1 + Math.sin(s.swirlA) * 0.06 * s.swirlK, 0, Math.cos(s.swirlA) * 0.06 * s.swirlK);
    // centre of the cup at the palm: base half its height below, along its own up
    _a.set(0, -CUP.h * 0.55 * cs, 0).applyEuler(this.cup.rotation);
    this.cup.position.copy(_hw).add(_a);
    this.cup.updateMatrixWorld(true);
    const rim = _rimW.set(0, CUP.h + CUP.stack, 0);
    this.cup.localToWorld(rim);
    root.worldToLocal(rim);                      // the rim centre, root frame

    // Left arm: by the side, a fist of ice over the cup, then the bottle.
    const ice = t >= LEAN.iceUp[0] && t < LEAN.iceAway[1] ? span(t, LEAN.iceUp) * (1 - span(t, LEAN.iceAway)) : 0;
    const bot = t >= LEAN.bottleUp[0] && t < LEAN.bottleAway[1] ? span(t, LEAN.bottleUp) * (1 - span(t, LEAN.bottleAway)) : 0;
    const bs = 1.3 * k;
    const theta = -2.1 * s.tilt;                 // about the root's forward axis: top toward the cup (+X)
    _b.set(-0.3 * k * w, -0.62 * k, -0.02 * k);  // hanging, in chest space
    if (ice || bot) {
      // Where the palm should be, in the root frame.
      if (ice) {
        _mw.set(rim.x - 0.07 * k, rim.y + 0.05 * k, rim.z).lerp(_a.set(rim.x, rim.y + 0.09 * k, rim.z), span(t, LEAN.iceOver));
      } else {
        // bottle gripped TP_BOTTLE_GRIP up, the palm TP_PALM_GAP off its side
        const c = Math.cos(theta), sn = Math.sin(theta);
        const side = _a.set(rim.x - 0.16 * k, rim.y + 0.02 * k, rim.z);
        const pour = _mw.set(rim.x + 0.005 * k, rim.y + 0.05 * k, rim.z);   // the mouth's spot
        pour.x -= (-sn) * BOTTLE.h * bs * (1 - TP_BOTTLE_GRIP) + c * TP_PALM_GAP * bs;
        pour.y -= c * BOTTLE.h * bs * (1 - TP_BOTTLE_GRIP) + sn * TP_PALM_GAP * bs;
        _mw.copy(side).lerp(pour, s.tilt);
      }
      // root frame -> chest space, minus the mitt's reach past the wrist
      root.localToWorld(_mw);
      p.chest.worldToLocal(_mw);
      _mw.y -= 0.03 * k;
      _b.lerp(_mw, Math.max(ice, bot));
    }
    reach(rig, -1, _b, _poleL);
    root.updateMatrixWorld(true);

    // The bottle off the left palm, rolled over by theta.
    this.bottle.visible = s.bottle;
    if (s.bottle) {
      this.bottle.scale.setScalar(bs);
      palmCentre(rig, -1, k, _hw);
      const c = Math.cos(theta), sn = Math.sin(theta);
      this.bottle.position.set(
        _hw.x + c * TP_PALM_GAP * bs - (-sn) * BOTTLE.h * bs * TP_BOTTLE_GRIP,
        _hw.y + sn * TP_PALM_GAP * bs - c * BOTTLE.h * bs * TP_BOTTLE_GRIP,
        _hw.z);
      this.bottle.rotation.set(0, 0, theta);
    }
    this.cup.updateMatrixWorld(true);
    this.finish(s, t, p.handL, 0.05 * k);
    return s;
  }

  /* What's inside: the fill, the ice (in the left hand, falling, floating),
     the bottle's level and the stream from its mouth to the drink. The ice
     in the hand hangs `below` it in world terms (a body's mitt), or with
     `below` null just under a first-person palm, in the hand's own frame. */
  finish(s, t, handL, below) {
    const cup = this.cup, u = cup.userData;
    if (Math.abs(s.fill - this.lastFill) > 1e-4) { u.setFill(s.fill); this.lastFill = s.fill; }
    u.liquid.rotation.set(Math.sin(s.swirlA) * 0.07 * s.swirlK, 0, Math.cos(s.swirlA) * 0.07 * s.swirlK);
    this.bottle.userData.setLevel(s.bottleLevel, t);
    cup.updateMatrixWorld(true);
    // Where the left hand's ice is, in the cup's frame.
    handL.updateWorldMatrix(true, false);
    if (below != null) { handL.getWorldPosition(_hw); _hw.y -= below; }
    const released = t >= LEAN.drop[0];
    u.ice.forEach((c, i) => {
      c.visible = cup.visible && t >= LEAN.iceUp[0] + 0.12;
      if (!c.visible) return;
      // Resting in the cup: a little heap on the floor, floating once there's drink.
      const a = i * (Math.PI * 2 / ICE) + 0.6 + (s.swirlK > 0 ? s.swirlA * 0.9 : 0);
      const ring = rAt(u.top - CUP.stack) * 0.42;
      const restY = Math.max(u.floor + 0.009 + (i % 2) * 0.012, u.top - 0.006 + Math.sin(t * 3 + i) * 0.0015);
      _b.set(Math.cos(a) * ring, restY, Math.sin(a) * ring);
      // In the fist: just under the hand, bunched together.
      // first person: a 2x2 heap resting on the open palm (measured on the
      // glove: palm surface 12 mm out, so cube centres 23 mm); a mitt: under it
      if (below == null) handL.localToWorld(_mw.set(i % 2 ? 0.011 : -0.011, -0.023, i < 2 ? -0.024 : -0.047));
      else _mw.copy(_hw).add(_a.set((i - 1.5) * 0.008, -(i % 2) * 0.006, 0));
      cup.worldToLocal(_mw);
      // Pops in from nothing.
      const pop = ease((t - LEAN.iceUp[0] - 0.12) / 0.15);
      c.scale.setScalar(Math.max(0.01, pop));
      if (!released) { c.position.copy(_mw); return; }
      const d = clamp01((t - LEAN.drop[0] - i * 0.06) / 0.32);
      if (d <= 0) { c.position.copy(_mw); return; }
      // Falls with gravity, a little bounce on landing.
      const f = d * d;
      c.position.lerpVectors(_mw, _b, f);
      if (d >= 1) c.position.y += Math.max(0, Math.sin(clamp01((t - LEAN.drop[0] - i * 0.06 - 0.32) / 0.2) * Math.PI)) * 0.006;
    });
    // The stream: bottle mouth to the drink's surface.
    const st = u.stream;
    st.visible = cup.visible && this.bottle.visible && s.pouring;
    if (st.visible) {
      this.bottle.updateMatrixWorld(true);
      _a.copy(this.bottle.userData.mouth);
      this.bottle.localToWorld(_a);
      cup.worldToLocal(_a);
      _b.set(Math.sin(t * 17) * 0.002, u.top, Math.cos(t * 13) * 0.002);
      const len = _a.distanceTo(_b);
      st.position.copy(_a);
      st.quaternion.setFromUnitVectors(_up, _mw.subVectors(_a, _b).normalize());
      st.scale.set(1, Math.max(0.001, len), 1);
    }
  }
}

/* ------------------------------------------------------------ hand targets */
// First person, viewmodel space (camera at the origin looking down -Z):
// pos [x, y, z], rot [x, y, z] (Euler YXZ), a hand pose. A hand's fingers
// point down -Z and its palm faces -Y at rot 0 (emotes.js).

const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const PI = Math.PI;

/* A mitt holds the bottle this far up, its palm this far off the side
   (bodies only; first-person hands use GRIP). */
const TP_BOTTLE_GRIP = 0.36, TP_PALM_GAP = 0.045;
const _fpHand = new THREE.Object3D(), _fpCup = new THREE.Object3D();
_fpCup.userData.height = CUP.h + CUP.stack;
/* Where the cup's rim centre is for a right-hand target (same placement as
   LeanKit.fp), so the left hand can find it. */
function cupRimFp(R, out) {
  _fpHand.position.set(...R.pos);
  _fpHand.rotation.set(R.rot[0], R.rot[1], R.rot[2], "YXZ");
  _fpHand.updateMatrix();
  gripPlace(_fpCup, _fpHand, 1, GRIP.cup);
  return out.set(0, CUP.h + CUP.stack, 0).applyQuaternion(_fpCup.quaternion).add(_fpCup.position);
}
const POUR_TILT = 2.05;      // radians the bottle rolls over at full pour
const _rim = new THREE.Vector3(), _mouthL = new THREE.Vector3(), _hq = new THREE.Quaternion();

export function leanFp(t) {
  const s = leanState(t);
  // Right hand: the cup, low in front and tipped toward you so you look
  // into it; raised to the lips for the sip.
  const off = [0.14, -0.55, -0.42], hold = [0.035, -0.17, -0.34];
  let rp = mix(off, hold, s.cup);
  rp = [rp[0] + Math.cos(s.swirlA) * 0.014 * s.swirlK, rp[1], rp[2] + Math.sin(s.swirlA) * 0.014 * s.swirlK];
  rp = mix(rp, [0.03, -0.1, -0.22], s.sip);
  const look = s.look * (1 - s.sip);
  const R = { pos: rp, rot: [0.55 * look + s.sip * 1.0, 0.08 - s.sip * 0.08, -PI / 2], pose: GRIP.cup.pose };
  cupRimFp(R, _rim);

  // Left hand: a fist of ice over the cup, then the bottle.
  let L = null;
  const away = [-0.2, -0.58, -0.4];
  if (t >= LEAN.iceUp[0] && t < LEAN.iceAway[1]) {
    const up = span(t, LEAN.iceUp) * (1 - span(t, LEAN.iceAway));
    const over = span(t, LEAN.iceOver);
    const side = [-0.12, -0.12, -0.36], above = [_rim.x - 0.075, _rim.y + 0.06, _rim.z - 0.02];
    const p = mix(away, mix(side, above, over), up);
    // Palm up with the cubes sitting in it, tipped over the cup to spill them.
    L = { pos: p, rot: [0.3, 0, PI - 1.35 * span(t, [LEAN.drop[0] - 0.1, LEAN.drop[0] + 0.15])], pose: "flat" };
  } else if (t >= LEAN.bottleUp[0] && t < LEAN.bottleAway[1]) {
    const up = span(t, LEAN.bottleUp) * (1 - span(t, LEAN.bottleAway));
    // Pouring: the hand sits so the mouth (in the hand's frame, GRIP.bottle)
    // ends up just over the rim, with the hand rolled over by POUR_TILT.
    _hq.setFromEuler(_e.set(0, -0.06, PI / 2 - POUR_TILT, "YXZ"));
    _mouthL.set(BOTTLE.h - GRIP.bottle.h, GRIP.bottle.y, GRIP.bottle.z).applyQuaternion(_hq);
    const pour = [_rim.x - 0.005 - _mouthL.x, _rim.y + 0.035 - _mouthL.y, _rim.z - _mouthL.z];
    // Up beside the cup first, out to the left so the bottle clears it.
    const side = [-0.17, -0.13, -0.36];
    const p = mix(away, mix(side, pour, s.tilt), up);
    const theta = -POUR_TILT * s.tilt;
    // The hand rolls with the bottle (palm on its side).
    L = { pos: p, rot: [0, -0.06, PI / 2 + theta], pose: GRIP.bottle.pose };
  }
  return {
    R, L, gun: false,
    cam: { pitch: -0.45 * s.look + 0.05 * s.sip, yaw: 0 },
  };
}

/* ------------------------------------------------------------ the body */
// Chest-space targets (character.js reachHand). A body faces -Z in its own
// frame (measured: the gun hands sit on -Z); its right hand, side +1, is +X.

const _tR = new THREE.Vector3(), _rimW = new THREE.Vector3(), _hE = new THREE.Vector3();
const _poleR = new THREE.Vector3(1, -1, 0.3), _poleL = new THREE.Vector3(-1, -1, 0.3);
/* The middle of a mitt's palm in the rig's root frame: out past the wrist
   along the forearm, a little to the inside (where a held thing sits). */
function palmCentre(rig, side, k, out) {
  const p = rig.parts;
  (side > 0 ? p.elbowR : p.elbowL).getWorldPosition(_hE);
  (side > 0 ? p.handR : p.handL).getWorldPosition(out);
  rig.root.worldToLocal(_hE);
  rig.root.worldToLocal(out);
  _hE.subVectors(out, _hE).normalize();
  return out.addScaledVector(_hE, 0.075 * k).add(_off.set(-side * 0.035 * k, 0, -0.02 * k));
}
