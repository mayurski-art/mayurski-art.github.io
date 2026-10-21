/* A posable hand (user, 2026-10-21: "those hands should be more developed,
   like the finger separation can be seen", then "we need realistic
   hands"; the sheets refs/hand-poses.webp, refs/trolls-1718-hand-poses.webp).
   Roblox Studio's generator won't make a hand, so the mesh is MakeHuman's
   (CC0): its base body's right hand, cut out with its own skin weights by
   models/build_rig_hand.blender.py into models/hands/rig-hand.json, bound
   here to a palm bone and three bones each for the four fingers and the
   thumb. (Without the file, the old one: capsules on a ball.) A pose is the
   joints' angles (POSES); setPose eases the fingers there, so a grip
   closes rather than snaps, like a CoD viewmodel's hands.

   The frame is the block fist's (blocky-body.js fistFrame): the wrist at
   the origin, the fingers down -Y, the back of the hand +X on the right,
   the palm -X, the thumb to the front -Z. Metres at size 1; the left hand
   is the right mirrored. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// the MakeHuman hand (null: not there, the capsule hand stands in)
const DATA = await fetch(new URL("../models/hands/rig-hand.json?v=mh1", import.meta.url))
  .then((r) => (r.ok ? r.json() : null)).catch(() => null);

// [z across the knuckles, y down to the knuckle, segment lengths, radius]
const FINGERS = [
  [-0.0355, -0.092, [0.036, 0.023, 0.020], 0.0118],   // index
  [-0.0118, -0.097, [0.039, 0.025, 0.021], 0.0122],   // middle
  [0.0118, -0.094, [0.037, 0.024, 0.020], 0.0116],    // ring
  [0.0345, -0.086, [0.030, 0.019, 0.018], 0.0104],    // little
];
const THUMB = { at: [-0.008, -0.03, -0.04], len: [0.032, 0.026, 0.022], r: 0.0128 };
const TAPER = [1, 0.95, 0.9];
const SKIN = new THREE.Color(0xf4f4f0), NAIL = new THREE.Color(0xe2dedb);

/* Joint angles, radians. Fingers: [knuckle, middle, tip] curl toward the
   palm (and `spread`, apart at the knuckles); a finger left out takes
   `rest`. Thumb: [out (off the palm's plane; less, toward the back),
   across (round in front of the fingers; less, out to the side), knuckle,
   tip], tuned on the MakeHuman hand. */
const F = (a, b, c) => [a, b, c];
const GRIP = F(1.35, 1.45, 0.85), FIST = F(1.6, 1.75, 1.05);
// the thumb across the curled fingers' middle bones (a fist), round a handle
const TFIST = [-0.6, 1.3, 0.8, 0.6], TGRIP = [-0.3, 1.1, 0.6, 0.4];
export const POSES = {
  relaxed: { rest: F(0.32, 0.42, 0.28), thumb: [0, 0.35, 0.2, 0.15], spread: 0.04 },
  flat: { rest: F(0.03, 0.04, 0.03), thumb: [-0.1, 0.1, 0.05, 0.05], spread: 0 },
  fist: { rest: FIST, thumb: TFIST },
  // round a handle: the gun's grip, a melee's haft, the crutch
  grip: { rest: GRIP, thumb: TGRIP },
  // the trigger hand: the index straight along the frame, ready to fire
  trigger: { rest: GRIP, index: F(0.22, 0.12, 0.08), thumb: TGRIP },
  // firing: the index on the trigger
  fire: { rest: GRIP, index: F(0.85, 1.15, 0.55), thumb: TGRIP },
  // the support hand under the handguard, the thumb over its top
  support: { rest: F(0.95, 1.05, 0.6), thumb: [0.1, 0.8, 0.2, 0.1], spread: 0.02 },
  // under a handguard seen from above (first person): the fingers round it,
  // the thumb laid forward along it, not standing up into the sight
  cradle: { rest: GRIP, thumb: [0, 0.3, 0.05, 0.05] },
  // the mag pinched between the thumb and two fingers
  pinch: { rest: F(1.1, 1.3, 0.8), index: F(0.75, 0.85, 0.45), middle: F(0.85, 0.95, 0.5), thumb: [-0.2, 1.0, 0.3, 0.2] },
  point: { rest: FIST, index: F(0.02, 0.03, 0.02), thumb: TFIST },
  bird: { rest: FIST, middle: F(0.02, 0.03, 0.02), thumb: TFIST },
  lsign: { rest: FIST, index: F(0.02, 0.03, 0.02), thumb: [-0.2, -0.6, 0, 0] },
  // round a ball: the grenade, a cup
  cup: { rest: F(0.62, 0.62, 0.45), thumb: [0.2, 0.6, 0.2, 0.2], spread: 0.09 },
  // calling the K9s: index and middle together, tips bent in toward the
  // lips, ring and little folded under the thumb
  whistle: { rest: FIST, index: F(0.05, 0.12, 0.2), middle: F(0.05, 0.12, 0.2), thumb: TFIST },
};
/* Any hand-pose name the game uses (the stick mitts' "open" and "L", the
   first-person hands' names) as one of POSES: what an emote or a device
   asks for reaches the hand unchanged where the two agree. */
const ALIAS = { open: "relaxed", L: "lsign" };
export const rigPose = (name) => (POSES[name] ? name : ALIAS[name] || "relaxed");
/* The palm's centre, metres down from the wrist at size 1: where the
   first-person hands (weapons/hand-model.js, origin mid-palm) line up. */
export const PALM_Y = DATA ? -DATA.joints.middle0[1] / 2 : 0.052;
const NAMES = ["index", "middle", "ring", "little"];

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const geoCache = new Map();
/* The MakeHuman hand: its bones at its joints (each a pure offset from its
   parent, as the capsule hand's), its mesh with its own weights, and each
   joint's hinge: a finger bends about the line across it in the palm's
   plane (its direction crossed with the back of the hand, +X), a thumb
   joint toward the palm and the fingers. */
const _X = new THREE.Vector3(1, 0, 0);
const TOWARD = new THREE.Vector3(-0.55, 0, 0.83);
const FLARE = 0.18;   // where a thumb curls: across the palm, toward the little finger
function buildMH() {
  const J = DATA.joints, at = (n) => new THREE.Vector3(...J[n]);
  const root = new THREE.Bone(), bones = [root], hinges = [];
  const chain = (name, thumb) => {
    let parent = root, prev = new THREE.Vector3();
    const out = [], hs = [];
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Bone(), p = at(name + k);
      b.position.copy(p).sub(prev);
      parent.add(b);
      bones.push(b);
      out.push(b);
      // this bone's direction (the last takes its parent's)
      const d = (k < 2 ? at(name + (k + 1)).sub(p) : p.clone().sub(prev)).normalize();
      hs.push(thumb ? d.clone().cross(TOWARD).normalize().negate() : d.clone().cross(_X).normalize());
      parent = b;
      prev = p;
    }
    hinges.push(hs);
    return out;
  };
  const fingers = NAMES.map((n) => chain(n, false));
  const thumb = chain("thumb", true);
  const geo = new THREE.BufferGeometry();
  // the stub of forearm above the wrist flared a little, so it covers the
  // arm's jagged cut where the two meet (blocky-body.js handCut)
  const P = Float32Array.from(DATA.position);
  for (let i = 0; i < P.length; i += 3) {
    const k = 1 + FLARE * Math.min(1, Math.max(0, P[i + 1]) / 0.03);
    P[i] *= k;
    P[i + 2] *= k;
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(DATA.normal, 3));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(DATA.skinIndex, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(DATA.skinWeight, 4));
  const n = DATA.position.length / 3, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([SKIN.r, SKIN.g, SKIN.b], i * 3);
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(DATA.index);
  geo.computeBoundingSphere();
  geo.userData.shared = true;
  // the thumb's own frame at its root, for swinging it out and across
  const td = at("thumb1").sub(at("thumb0")).normalize();
  const abduct = td.clone().cross(new THREE.Vector3(-1, 0, 0)).normalize();   // off the palm, toward its front
  const oppose = td.clone().cross(TOWARD).normalize();                          // round in front of the fingers
  return { geo, fingers, thumb, bones, hinges, abduct, oppose };
}
/* The hand's geometry and bones, bound straight (every curl 0). */
function build() {
  if (DATA) return buildMH();
  const bones = [], root = new THREE.Bone();
  bones.push(root);
  const parts = [];
  const seg = (bone, len, r, nail) => {
    const g = new THREE.CapsuleGeometry(r, len, 4, 10);
    g.translate(0, -len / 2, 0);
    if (nail) {
      // a nail on the back of the tip: a flattened cap, a shade darker
      const n = new THREE.SphereGeometry(1, 10, 6);
      n.scale(r * 0.35, r * 1.15, r * 0.82);
      n.translate(r * 0.78, -len * 0.62, 0);
      n.userData.nail = true;
      parts.push([n, bone]);
    }
    parts.push([g, bone]);
  };
  const chain = (parent, at, lens, r, nailed) => {
    let b = parent;
    const out = [];
    lens.forEach((len, i) => {
      const nb = new THREE.Bone();
      if (i === 0) nb.position.set(...at);
      else nb.position.set(0, -lens[i - 1], 0);
      b.add(nb);
      bones.push(nb);
      seg(nb, len, r * TAPER[i], nailed && i === lens.length - 1);
      out.push(nb);
      b = nb;
    });
    return out;
  };
  // the palm: a rounded slab, a little fuller across the knuckles; the
  // wrist a short column up into the forearm
  const palm = new THREE.SphereGeometry(1, 20, 14);
  palm.scale(0.024, 0.054, 0.05);
  palm.translate(0.002, -PALM_Y, 0);
  parts.push([palm, root]);
  // (long and full: it runs up into the forearm and covers the cut there)
  const wrist = new THREE.CapsuleGeometry(0.03, 0.05, 4, 16);
  wrist.scale(0.95, 1, 1.05);
  wrist.translate(0.002, 0.022, 0);
  parts.push([wrist, root]);
  const fingers = FINGERS.map(([z, y, lens, r]) => chain(root, [0, y + 0.008, z], lens, r, true));
  const thumb = chain(root, THUMB.at, THUMB.len, THUMB.r, true);
  // straight, bind each part to its bone where it hangs
  root.updateMatrixWorld(true);
  const geos = [];
  for (const [g, bone] of parts) {
    const gg = g.index ? g.toNonIndexed() : g;
    gg.deleteAttribute("uv");
    gg.applyMatrix4(bone.matrixWorld);
    const n = gg.attributes.position.count, bi = bones.indexOf(bone);
    gg.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 ? 0 : bi)), 4));
    gg.setAttribute("skinWeight", new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 ? 0 : 1)), 4));
    const c = g.userData.nail ? NAIL : SKIN, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    gg.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geos.push(gg);
  }
  const geo = mergeGeometries(geos);
  geo.computeBoundingSphere();
  geo.userData.shared = true;
  return { geo, fingers, thumb, bones };
}

const handMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
handMat.userData.shared = true;

/* A hand for `side` ("L" | "R"), `size` times the default (a big cartoon
   hand: 1.3). Returns the mesh (hang it in the fist's frame) with
   setPose(name, now) to ease toward a pose, and update(dt). */
export function makeHand(side, size = 1, material = handMat) {
  if (!geoCache.has(0)) geoCache.set(0, build().geo);
  // each hand its own bones (a fresh skeleton in the same layout; its
  // geometry the shared one)
  const { fingers, thumb, bones, hinges, abduct, oppose } = build();
  const mesh = new THREE.SkinnedMesh(geoCache.get(0), material);
  mesh.add(bones[0]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  // the left hand the right one mirrored across the palm (three turns a
  // mirrored mesh's faces back itself)
  mesh.scale.set(side === "L" ? -size : size, size, size);
  const mir = side === "L" ? -1 : 1;
  let want = POSES.relaxed, cur = null;
  const joints = () => {
    const out = [];
    NAMES.forEach((n, i) => {
      const c = want[n] || want.rest;
      const sp = (want.spread || 0) * (i - 1.5);
      out.push([c[0], c[1], c[2], sp]);
    });
    out.push(want.thumb);
    return out;
  };
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qs = new THREE.Quaternion();
  const applyMH = (a) => {
    a.slice(0, 4).forEach(([k, m, t, sp], i) => {
      const [b0, b1, b2] = fingers[i], h = hinges[i];
      // curl: the tip toward the palm about the finger's own hinge; spread
      // about the back of the hand
      b0.quaternion.setFromAxisAngle(_X, sp).multiply(_qa.setFromAxisAngle(h[0], -k));
      b1.quaternion.setFromAxisAngle(h[1], -m);
      b2.quaternion.setFromAxisAngle(h[2], -t);
    });
    const [out, across, k0, t0] = a[4];
    const kn = k0 + hand.press * 0.5, tip = t0 + hand.press * 0.6;
    // the thumb: `out` lifts it off the palm's plane, `across` swings it
    // round in front of the fingers; then its two joints curl
    thumb[0].quaternion.setFromAxisAngle(oppose, across).multiply(_qs.setFromAxisAngle(abduct, out));
    thumb[1].quaternion.setFromAxisAngle(hinges[4][1], -kn);
    thumb[2].quaternion.setFromAxisAngle(hinges[4][2], -tip);
  };
  const apply = (a) => {
    if (DATA) return applyMH(a);
    a.slice(0, 4).forEach(([k, m, t, sp], i) => {
      const [b0, b1, b2] = fingers[i];
      // curl: the tip toward the palm (-X), about Z; spread about X
      b0.rotation.set(sp, 0, -k);
      b1.rotation.set(0, 0, -m);
      b2.rotation.set(0, 0, -t);
    });
    const [out, across, k0, t0] = a[4];
    // a press (a thumb tapping a screen) curls the thumb's two joints on top
    const kn = k0 + hand.press * 0.5, tip = t0 + hand.press * 0.6;
    // the thumb hangs down and forward off the palm's side; `out` swings it
    // forward (-Z) and off the palm, `across` over toward the fingers
    thumb[0].rotation.set(0.12 + out * 0.8, 0, -0.25 - across * 0.9, "XZY");
    thumb[1].rotation.set(-kn * 0.5, 0, -kn * 0.9);
    thumb[2].rotation.set(-tip * 0.4, 0, -tip);
  };
  const hand = {
    mesh,
    press: 0,   // 0..1, the thumb pressed down (applied with the next update)
    get pose() { return want; },
    setPose(name, now = false) {
      want = POSES[name] || POSES.relaxed;
      if (now || !cur) { cur = joints(); apply(cur); }
    },
    update(dt) {
      if (!cur) return;
      const goal = joints(), k = Math.min(1, dt * 18);
      for (let i = 0; i < goal.length; i++) for (let j = 0; j < goal[i].length; j++) cur[i][j] += (goal[i][j] - cur[i][j]) * k;
      apply(cur);
    },
    mir,
  };
  return hand;
}
