// Troll Forces — Cops and Robbers: realistic skinned bodies on the stick rig.
//
// models/build_cops.blender.py exports one GLB per look: a MakeHuman body on
// the "game_engine" rig (UE-style bone names) in uniform, baked to one
// texture, with NO clips. It moves because the stick rig moves: every pose,
// gait, crouch, aim, reload, throw, dance and death character.js gives a
// troll, this body does too. character.js is untouched.
//
// Each frame, after the rig is posed (syncCopBody):
//   - pelvis, spine, neck and head take the rig joints' turn (an offset from
//     the rest pose, worked out once)
//   - arms and legs are two-bone IK from the body's own shoulders and hips
//     to the rig's palms and ankles, bending the way the rig's elbows and
//     knees bend; so the hands sit on the gun grip and the feet on the floor
//     even though a real body is proportioned nothing like the stick figure
//   - hands take the rig mitts' frame (palm, thumb), fingers close into a
//     fist when the mitt does; feet take the rig ankles' frame
//   - the rig's hitboxes move onto the real limbs, the head one shrinks to
//     a real head
// The stick line, the face board and the mitts are hidden; the held gun
// stays (it is the rig's).
//
// Looks: "patrol" (the AI police); "grin" (the trollface rubber mask under
// the cap) is a cosmetic.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildHumanoid } from "./character.js?v=to-hb4-em1-fc1-wst";

export const COP_BODIES = {
  patrol: "cop-patrol.glb?v=cb1",
  grin: "cop-grin.glb?v=cb1",
};
const BASE = new URL("./models/", import.meta.url).href;

/* ------------------------------------------------------------------ templates */
const templates = new Map();   // id -> Promise<{ scene, rest }>

/* A clone of a skinned scene: shared geometry and materials, fresh bones
   (three r160 ships no SkeletonUtils; same as zombie-models.js). */
function cloneSkinned(source) {
  const clone = source.clone(true);
  const map = new Map();
  const walk = (a, b) => {
    map.set(a, b);
    for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]);
  };
  walk(source, clone);
  source.traverse((src) => {
    if (!src.isSkinnedMesh) return;
    const dst = map.get(src);
    dst.bind(new THREE.Skeleton(src.skeleton.bones.map((b) => map.get(b)), src.skeleton.boneInverses), src.bindMatrix);
  });
  return clone;
}

export function loadCopBody(id) {
  if (templates.has(id)) return templates.get(id);
  const p = new GLTFLoader().loadAsync(BASE + COP_BODIES[id]).then((gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;            // bounds are the bind pose's
      const m = o.material;
      if (m.transparent || m.alphaTest > 0) {
        // hair cards and the mask's edge: clipped, not blended
        m.transparent = false;
        m.alphaTest = 0.5;
        m.depthWrite = true;
        m.side = THREE.DoubleSide;
        // shadows from the back faces: a double-sided skin shadows itself in
        // stripes (acne) from the front ones
        m.shadowSide = THREE.BackSide;
      }
      m.userData.shared = true;
      o.geometry.userData.shared = true;
    });
    return { scene: gltf.scene };
  }).catch((err) => {
    console.warn("[cop-bodies] couldn't load", id, err);
    templates.delete(id);
    return null;
  });
  templates.set(id, p);
  return p;
}

export function preloadCopBodies(ids = Object.keys(COP_BODIES)) {
  return Promise.all(ids.map(loadCopBody));
}

/* ------------------------------------------------------------------ rest rig */
// The stick rig at rest, in root space, for the offsets. Joint turns don't
// depend on the rig's size; positions are scaled by rig.scale where used.
let restRig = null;
function restOf(name) {
  if (!restRig) {
    restRig = buildHumanoid(new THREE.MeshBasicMaterial(), { height: 1.8, gun: false });
    restRig.root.updateMatrixWorld(true);
  }
  const o = name === "turnL" ? restRig.hands.L.turn : name === "turnR" ? restRig.hands.R.turn : restRig.parts[name];
  const q = new THREE.Quaternion(), p = new THREE.Vector3();
  o.matrixWorld.decompose(p, q, new THREE.Vector3());
  return { q, p };
}

// body bone <- rig joint: the bone takes the joint's turn
const FOLLOW = [
  ["pelvis", "hips"], ["spine_01", "torso"], ["spine_02", "spine"], ["spine_03", "chest"],
  ["neck_01", "neckPivot"], ["head", "headPivot"],
];
const FINGERS = ["index", "middle", "ring", "pinky"];
// The mitt's own frame (character.js buildHand, the `turn` group): fingers
// run down -Y from the wrist, the thumb is on +X for the right hand and -X
// for the left. A gun grip sits on the wrist joint itself (character.js
// _gripSupport), so that is where the body's palm goes: MITT_PALM = 0.
const MITT_FINGERS = new THREE.Vector3(0, -1, 0);
const MITT_PALM = 0;

/* ------------------------------------------------------------------ helpers */
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qr = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _s = new THREE.Vector3();

function basis(a, b, out) {
  // rotation matrix whose columns are a, b⊥a, a×b (all unit)
  const x = _v.copy(a).normalize();
  const y = _w.copy(b).addScaledVector(x, -b.dot(x)).normalize();
  const z = _u.crossVectors(x, y);
  return out.makeBasis(x, y, z);
}
/* The rotation that turns frame (a0, b0) onto (a1, b1). */
function frameRot(a0, b0, a1, b1, out) {
  basis(a0, b0, _m);
  basis(a1, b1, _m2);
  _m.transpose();
  return out.setFromRotationMatrix(_m2.multiply(_m));
}
function worldQ(o, out) {
  o.matrixWorld.decompose(_s, out, _s);
  return out;
}
function worldP(o, out) {
  return out.setFromMatrixPosition(o.matrixWorld);
}
/* Give `bone` the world turn `q` (its parent's matrix must be current). */
function setWorldQ(bone, q) {
  worldQ(bone.parent, _q2).invert();
  bone.quaternion.copy(_q2).multiply(q);
  bone.updateMatrixWorld(true);
}

/* ------------------------------------------------------------------ attach */
function attach(rig, id, tpl) {
  const model = cloneSkinned(tpl.scene);
  const holder = new THREE.Group();
  holder.name = `cop-${id}`;
  holder.rotation.y = Math.PI;              // the GLB faces +Z; the game's forward is -Z
  holder.scale.setScalar(rig.scale);
  holder.add(model);
  holder.updateMatrixWorld(true);           // no parent yet: world = rig root space
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const s = rig.scale;
  const R = {};                             // bone name -> rest { q, p } in root space
  for (const [name, b] of Object.entries(bones)) {
    const q = new THREE.Quaternion(), p = new THREE.Vector3();
    b.matrixWorld.decompose(p, q, new THREE.Vector3());
    R[name] = { q, p };
  }
  const boneScale = new THREE.Vector3();
  bones.pelvis.matrixWorld.decompose(_v, _q, boneScale);

  const cop = { id, holder, model, bones, R, s, boneScale: boneScale.x, follow: [], arms: [], legs: [], fingers: { L: [], R: [] } };

  // spine: bone world = joint world * K
  for (const [bn, jn] of FOLLOW) {
    if (!bones[bn]) continue;
    const j = restOf(jn);
    cop.follow.push({ bone: bones[bn], joint: rig.parts[jn], K: j.q.clone().invert().multiply(R[bn].q) });
  }
  // the pelvis rides the hips, offset as at rest
  const hr = restOf("hips");
  cop.pelvisOff = R.pelvis.p.clone().sub(hr.p.clone().multiplyScalar(s));

  for (const [key, side, sfx] of [["L", -1, "l"], ["R", 1, "r"]]) {
    const up = bones[`upperarm_${sfx}`], lo = bones[`lowerarm_${sfx}`], hand = bones[`hand_${sfx}`];
    const S0 = R[up.name].p, E0 = R[lo.name].p, W0 = R[hand.name].p;
    // the hand's frame at rest: fingers toward the middle knuckle, the
    // thumb side toward the index knuckle (away from the little finger)
    const f0 = R[`middle_01_${sfx}`].p.clone().sub(W0).normalize();
    const t0 = R[`index_01_${sfx}`].p.clone().sub(R[`pinky_01_${sfx}`].p);
    // mitt (turn) frame: fingers -Y, thumb side*X. hand world = turn world * K
    const A = frameRot(f0, t0, MITT_FINGERS, new THREE.Vector3(side, 0, 0), new THREE.Quaternion());
    const K = A.clone().multiply(R[hand.name].q);
    const palm = R[`middle_01_${sfx}`].p.clone().sub(W0).multiplyScalar(0.5);   // hand base to palm centre
    cop.arms.push({
      side, key, up, lo, hand, mitt: rig.hands[key],
      a: E0.distanceTo(S0), b: W0.distanceTo(E0),
      restUp: R[up.name].q, restLo: R[lo.name].q,
      ...restBend(S0, E0, W0),
      K,
      // palm offset in the hand's own (rest) frame
      palm: palm.applyQuaternion(R[hand.name].q.clone().invert()),
      // the hand's rest frame (root space), for hands placed on the gun
      f0: f0.clone(), t0: t0.clone().normalize(), Hr: R[hand.name].q.clone(),
      fLocal: f0.clone().applyQuaternion(R[hand.name].q.clone().invert()),
      elbow: side < 0 ? rig.parts.elbowL : rig.parts.elbowR,
      pivot: side < 0 ? rig.parts.armL : rig.parts.armR,
    });
    for (const f of FINGERS) for (const k of [1, 2, 3]) {
      const fb = bones[`${f}_0${k}_${sfx}`];
      if (fb) cop.fingers[key].push({ bone: fb, rest: fb.quaternion.clone(), k, thumb: false });
    }
    for (const k of [1, 2, 3]) {
      const fb = bones[`thumb_0${k}_${sfx}`];
      if (fb) cop.fingers[key].push({ bone: fb, rest: fb.quaternion.clone(), k, thumb: true });
    }

    const th = bones[`thigh_${sfx}`], ca = bones[`calf_${sfx}`], ft = bones[`foot_${sfx}`];
    const H0 = R[th.name].p, N0 = R[ca.name].p, F0 = R[ft.name].p;
    const ank = side < 0 ? "ankleL" : "ankleR";
    const ar = restOf(ank);
    const ankInv = ar.q.clone().invert();
    cop.legs.push({
      side, th, ca, ft,
      a: N0.distanceTo(H0), b: F0.distanceTo(N0),
      restTh: R[th.name].q, restCa: R[ca.name].q,
      // a straight leg: the knee bends toward the front (-Z)
      ...restBend(H0, N0, F0, new THREE.Vector3(0, 0, -1)),
      K: ankInv.clone().multiply(R[ft.name].q),
      // the body's ankle in the rig ankle's frame, so a lifted heel, a
      // planted toe or a kneel carry it
      // (sideways it is set per frame, from the hips: see syncCopBody)
      off: F0.clone().sub(ar.p.clone().multiplyScalar(s)).applyQuaternion(ankInv).setX(0),
      ankle: rig.parts[ank],
      knee: side < 0 ? rig.parts.kneeL : rig.parts.kneeR,
      hip: side < 0 ? rig.parts.hipL : rig.parts.hipR,
    });
  }
  // head hitbox: a real head, not the face board
  const hh = R.head.p.clone().add(new THREE.Vector3(0, 0.085 * s, 0));
  cop.headCentre = hh.sub(restOf("headPivot").p.clone().multiplyScalar(s));
  return cop;
}

/* Rest bend of a limb: its direction and the way its middle joint points. */
function restBend(A, B, C, fallback = null) {
  const dir = C.clone().sub(A).normalize();
  const pole = B.clone().sub(A);
  pole.addScaledVector(dir, -pole.dot(dir));
  if (pole.lengthSq() < 1e-6 && fallback) pole.copy(fallback).addScaledVector(dir, -fallback.dot(dir));
  pole.normalize();
  return {
    restUpDir: B.clone().sub(A).normalize(),
    restLoDir: C.clone().sub(B).normalize(),
    restPole: pole,
  };
}

/* ------------------------------------------------------------------ hitboxes */
// character.js hitboxMeshes order: head, torso, hips, then per arm L, R:
// upper arm, forearm, mitt; then per leg L, R: thigh, shin, foot.
function moveHitboxes(rig, cop) {
  const hb = rig.hitboxMeshes;
  if (!hb || hb.length < 15) return;
  cop.hitSaved = hb.map((m) => ({ m, parent: m.parent, p: m.position.clone(), q: m.quaternion.clone(), sc: m.scale.clone() }));
  const bs = cop.boneScale;
  const along = (m, bone, child, rWorld, origR) => {
    // a capsule from `bone` to its child, in the bone's own units
    const to = child.position.clone();
    const len = to.length();
    bone.add(m);
    m.position.copy(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().normalize());
    const g = m.geometry.parameters || {};
    const geoLen = (g.length ?? len) + 2 * (g.radius ?? origR);
    const want = len + (2 * rWorld) / bs;
    const k = rWorld / bs / (g.radius ?? origR);
    m.scale.set(k, want / geoLen, k);
  };
  const B = cop.bones;
  const s = cop.s;
  // head: radius 0.255 board-sized -> ~0.12 real head
  const head = hb[0];
  head.scale.setScalar(0.12 / 0.255);
  head.position.copy(cop.headCentre);
  let i = 3;
  for (const sfx of ["l", "r"]) {
    along(hb[i++], B[`upperarm_${sfx}`], B[`lowerarm_${sfx}`], 0.06 * s, 0.075 * s);
    along(hb[i++], B[`lowerarm_${sfx}`], B[`hand_${sfx}`], 0.05 * s, 0.07 * s);
    const mitt = hb[i++];
    B[`hand_${sfx}`].add(mitt);
    mitt.position.copy(B[`middle_01_${sfx}`].position).multiplyScalar(0.6);
    mitt.quaternion.identity();
    mitt.scale.setScalar(0.07 / 0.1 / bs);
  }
  for (const sfx of ["l", "r"]) {
    along(hb[i++], B[`thigh_${sfx}`], B[`calf_${sfx}`], 0.085 * s, 0.08 * s);
    along(hb[i++], B[`calf_${sfx}`], B[`foot_${sfx}`], 0.065 * s, 0.07 * s);
    along(hb[i++], B[`foot_${sfx}`], B[`ball_${sfx}`], 0.055 * s, 0.06 * s);
  }
}
function restoreHitboxes(cop) {
  for (const h of cop.hitSaved || []) {
    h.parent?.add(h.m);
    h.m.position.copy(h.p);
    h.m.quaternion.copy(h.q);
    h.m.scale.copy(h.sc);
  }
}

/* ------------------------------------------------------------------ per rig */
function hideStick(rig, hide) {
  const p = rig.parts;
  if (p.body) p.body.visible = !hide;
  if (p.head) p.head.visible = !hide;
  for (const key of ["L", "R"]) {
    const h = rig.hands?.[key];
    if (!h) continue;
    for (const m of [h.open, h.fist, h.bird]) if (m) { if (hide) m.layers.disableAll(); else m.layers.set(0); }
  }
  // face coverings, hats and other head cosmetics ride the head pivot
  if (p.headPivot) for (const c of p.headPivot.children) {
    if (c === p.head || c.userData.isHitProxy) continue;
    if (hide) { if (c.visible) { c.userData.copHid = true; c.visible = false; } }
    else if (c.userData.copHid) { c.visible = true; delete c.userData.copHid; }
  }
}

function clearCop(rig) {
  const cop = rig.cop;
  if (!cop) return;
  restoreHitboxes(cop);
  cop.holder.parent?.remove(cop.holder);
  hideStick(rig, false);
  rig.cop = null;
}

/* Put cop look `id` on `rig`, or take it off (null). Cheap to call every
   frame. Resolves once the body is on. */
export function applyCopBody(rig, id) {
  const want = id && COP_BODIES[id] ? id : null;
  if (rig.copBodyId === want) return rig.copReady || Promise.resolve(rig.cop);
  rig.copBodyId = want;
  clearCop(rig);
  if (!want) return (rig.copReady = Promise.resolve(null));
  return (rig.copReady = loadCopBody(want).then((tpl) => {
    if (!tpl || rig.copBodyId !== want) return null;
    const cop = attach(rig, want, tpl);
    rig.root.add(cop.holder);
    rig.cop = cop;
    moveHitboxes(rig, cop);
    hideStick(rig, true);
    syncCopBody(rig);
    return cop;
  }));
}

const _t = new THREE.Vector3(), _e = new THREE.Vector3(), _pole = new THREE.Vector3();
const _dir = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _rq = new THREE.Quaternion(), _hq = new THREE.Quaternion();
const _rUp = new THREE.Vector3(), _rLo = new THREE.Vector3(), _rPole = new THREE.Vector3();

/* Two-bone IK: root bone `up` (world pos S), middle bone `lo`, end at T,
   the middle joint bending toward `pole`. Sets both bones' world turns
   from their rest turns, so the twist stays the rest pose's. */
function solveLimb(limb, upBone, loBone, restUpQ, restLoQ, T, pole, rootQ) {
  const S = worldP(upBone, _a);
  const a = limb.a * limb.scale, b = limb.b * limb.scale;
  _dir.subVectors(T, S);
  let d = _dir.length();
  if (d < 1e-5) { _dir.set(0, -1, 0); d = 1e-5; } else _dir.divideScalar(d);
  d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, d));
  _pole.copy(pole).addScaledVector(_dir, -pole.dot(_dir));
  if (_pole.lengthSq() < 1e-8) { _pole.set(0, 0, -1).applyQuaternion(rootQ); _pole.addScaledVector(_dir, -_pole.dot(_dir)); }
  _pole.normalize();
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  _e.copy(S).addScaledVector(_dir, x).addScaledVector(_pole, h);       // the elbow / knee
  _t.copy(S).addScaledVector(_dir, d);                                  // the reachable end
  // the rest frames, turned into the world with the rig root
  _rUp.copy(limb.restUpDir).applyQuaternion(rootQ);
  _rLo.copy(limb.restLoDir).applyQuaternion(rootQ);
  _rPole.copy(limb.restPole).applyQuaternion(rootQ);
  // upper: (bone dir, pole) at rest -> now
  _b.subVectors(_e, S).normalize();
  frameRot(_rUp, _rPole, _b, _pole, _rq);
  _hq.copy(rootQ).multiply(restUpQ);
  setWorldQ(upBone, _rq.multiply(_hq));
  // lower: same, its own direction, the same bend plane
  _b.subVectors(_t, _e).normalize();
  frameRot(_rLo, _rPole, _b, _pole, _rq);
  _hq.copy(rootQ).multiply(restLoQ);
  setWorldQ(loBone, _rq.multiply(_hq));
}

const _rootQ = new THREE.Quaternion(), _jq = new THREE.Quaternion();
const _jp = new THREE.Vector3(), _ep = new THREE.Vector3(), _sp = new THREE.Vector3();
const _curlQ = new THREE.Quaternion(), _X = new THREE.Vector3(1, 0, 0), _Z = new THREE.Vector3(0, 0, 1);
const _handQ = new THREE.Quaternion(), _shift = new THREE.Vector3(), _axis = new THREE.Vector3();
const _gq = new THREE.Quaternion();
// hands on a rifle, in the gun's frame (barrel down -Z, +Y up, +X right):
// f = the way the hand points (wrist to knuckles: the wrist kept straight, so
// the forearm follows it), t = the thumb side, off =
// the palm centre from the grip / support point
const HOLD_R = { f: new THREE.Vector3(-0.4, 0.62, -0.68).normalize(), t: new THREE.Vector3(0, 1, 0), off: new THREE.Vector3(0.022, 0.035, 0) };
const HOLD_L = { f: new THREE.Vector3(0.5, 0.35, -0.8).normalize(), t: new THREE.Vector3(-0.76, -0.24, -0.58), off: new THREE.Vector3(-0.005, -0.062, 0) };   // supportHandPos sits 2 cm over the bore

/* Every frame after the rig is posed. `pitch`: the aim's pitch, as given to
   poseHumanoid (+ up). The stick rig turns its neck and head against it
   (-0.25 and -0.6 of it, character.js _poseNeckAndHead), which a flat face
   board hides but a real head shows as looking down when aiming up: the body
   turns them with it instead. */
export function syncCopBody(rig, { pitch = 0 } = {}) {
  const cop = rig.cop;
  if (!cop) return;
  // poseHumanoid flips the board and setHandPose the mitts back on
  if (rig.parts.body?.visible || rig.parts.head?.visible) hideStick(rig, true);
  rig.root.updateMatrixWorld(true);
  worldQ(rig.root, _rootQ);
  const B = cop.bones;

  // pelvis: on the hips, turned with them
  worldQ(rig.parts.hips, _jq);
  worldP(rig.parts.hips, _jp);
  _v.copy(cop.pelvisOff).applyQuaternion(_jq).add(_jp);
  B.pelvis.parent.updateMatrixWorld(true);
  B.pelvis.position.copy(B.pelvis.parent.worldToLocal(_v));
  // spine, neck, head
  for (const f of cop.follow) {
    worldQ(f.joint, _jq);
    // to +0.2 and +0.55 of the pitch overall, about what the gun takes (the
    // head pivot carries the rig neck's turn too)
    const flip = f.joint === rig.parts.neckPivot ? 0.45 : f.joint === rig.parts.headPivot ? 1.4 : 0;
    if (flip && pitch) _jq.multiply(_q.setFromAxisAngle(_X, flip * pitch));
    _jq.multiply(f.K);
    setWorldQ(f.bone, _jq);
  }

  // The gun. The stick rig shoulders it at the middle of its chest, where its
  // long arms (one shared shoulder) meet. A real body takes a rifle's butt in
  // the right shoulder pocket, out by the shoulder joint and in front of the
  // chest, and higher when aiming (the sights come up to the eye); a pistol
  // comes in a little and up to the eye line, for shorter arms. The mount
  // moves there and both hands' targets move with it.
  const mount = rig.parts.gunMount;
  const held = !!(rig.held && rig.held.visible && rig.held.parent === mount);
  _shift.set(0, 0, 0);
  let ads = 0;
  if (held) {
    const u = rig.held.userData;
    const s = cop.s;
    // a pose that doesn't place the gun (a dance, the death fall) leaves our
    // last shift on it: take that off first so it never piles up
    if (cop.mountLeft && mount.position.equals(cop.mountLeft)) mount.position.sub(cop.lastShift);
    _gq.setFromEuler(mount.rotation);
    if (u.buttPos && u.supportHandPos && !u.pistol && !u.akimbo) {
      // where the rig put the butt (chest space): its x walks in as it aims,
      // its y climbs as it comes up (character.js _gripSupport)
      _v.copy(u.buttPos).applyQuaternion(_gq).add(mount.position);
      ads = Math.max(0, Math.min(1, (0.085 - _v.x / s) / 0.04));
      const up = Math.max(0, _v.y / s + 0.12);
      _shift.set(0.06 - 0.05 * ads, 0.06 + 0.2 * up + 0.06 * ads, -0.06).multiplyScalar(s);
    } else if (u.gripPos) {
      _v.copy(u.gripPos).applyQuaternion(_gq).add(mount.position);
      const up = Math.max(0, Math.min(1, (_v.y / s + 0.25) / 0.33));
      _shift.set(0.02, 0.03 + 0.07 * up, 0.08).multiplyScalar(s);
    }
    (cop.lastShift ||= new THREE.Vector3()).copy(_shift);
    mount.position.add(_shift);
    (cop.mountLeft ||= new THREE.Vector3()).copy(mount.position);
    mount.updateMatrixWorld(true);
    _shift.applyQuaternion(worldQ(rig.parts.chest, _jq));
    _axis.set(0, 0, 1).applyQuaternion(worldQ(mount, _jq));   // toward the stock
  }
  cop.ads = ads;
  // Aiming a rifle: the cheek goes down onto the stock, the head tipped
  // forward and over to the right.
  if (ads > 0.01) {
    worldQ(rig.parts.chest, _jq);
    _a.set(1, 0, 0).applyQuaternion(_jq);
    _b.set(0, 0, -1).applyQuaternion(_jq);
    _q.setFromAxisAngle(_b, 0.16 * ads).multiply(_q2.setFromAxisAngle(_a, -0.2 * ads));
    worldQ(B.neck_01, _handQ);
    setWorldQ(B.neck_01, _q.multiply(_handQ));
  }

  // arms
  for (const arm of cop.arms) {
    arm.scale = 1;   // lengths were measured in root space (already x s)
    const turn = arm.mitt.turn;
    worldQ(turn, _handQ).multiply(arm.K);              // the hand's turn now
    // the rig's palm: where the mitt's palm is
    _t.copy(MITT_FINGERS).multiplyScalar(MITT_PALM * rig.scale * 1.55);
    turn.localToWorld(_t).add(_shift);
    // On a rifle the hands take the gun's own grip, not the flat mitts'
    // turn (a mitt has no palm side): the trigger hand's palm on the right
    // of the pistol grip, fingers forward to wrap it, thumb up; the support
    // hand cradling the handguard from below, palm up, fingers round its
    // right side, thumb along the left. Only while the rig's hand is
    // actually there: a reload, a throw or a pose takes it off the gun.
    let onGun = false;
    if (held) {
      const gun = rig.held, u = gun.userData;
      const spot = arm.side > 0 ? u.gripPos : (!u.pistol && !u.akimbo ? u.supportHandPos : null);
      if (spot) {
        worldQ(gun, _gq);
        _jp.copy(spot);
        gun.localToWorld(_jp);
        // near the grip (trigger hand) or anywhere along the gun's line
        // (the support hand slides)
        _ep.subVectors(_t, _jp);
        if (arm.side < 0) _ep.addScaledVector(_axis, -_ep.dot(_axis));
        if (_ep.length() < 0.09 * cop.s) {
          onGun = true;
          const g = arm.side > 0 ? HOLD_R : HOLD_L;
          _a.copy(g.f).applyQuaternion(_gq);
          _b.copy(g.t).applyQuaternion(_gq);
          _sp.copy(arm.f0).applyQuaternion(_rootQ);
          _ep.copy(arm.t0).applyQuaternion(_rootQ);
          frameRot(_sp, _ep, _a, _b, _handQ);
          _handQ.multiply(_q2.copy(_rootQ).multiply(arm.Hr));
          _t.copy(g.off).multiplyScalar(cop.s).applyQuaternion(_gq).add(_jp);
        }
      }
    }
    // the body's wrist: back from that palm along the hand
    _w.copy(arm.palm).applyQuaternion(_handQ);
    _t.sub(_w);
    // a support hand out of reach slides back along the gun toward the
    // receiver, the way a short arm takes a rifle
    if (held && arm.side < 0) {
      worldP(arm.up, _sp);
      const reach = arm.a + arm.b - 0.01;
      for (let i = 0; i < 40 && _t.distanceTo(_sp) > reach; i++) _t.addScaledVector(_axis, 0.01);
    }
    // the elbow: on the gun, where a straight wrist puts it (back from the
    // wrist along the hand); otherwise the way the rig's elbow sticks out of
    // its arm line, hanging a little more (real elbows don't wing out)
    worldP(arm.up, _sp);
    if (onGun) {
      _ep.copy(arm.fLocal).applyQuaternion(_handQ);
      _pole.copy(_t).addScaledVector(_ep, -arm.b).sub(_sp);
    } else {
      worldP(arm.pivot, _jp);
      worldP(arm.elbow, _ep);
      _pole.subVectors(_ep, _jp);
    }
    _dir.copy(_t).sub(_sp).normalize();
    _pole.addScaledVector(_dir, -_pole.dot(_dir));
    if (_pole.lengthSq() < 1e-6) _pole.set(arm.side, -1, 0.4).applyQuaternion(worldQ(rig.parts.chest, _jq));
    _pole.normalize();
    if (!onGun) _pole.y -= 0.35;
    solveLimb(arm, arm.up, arm.lo, arm.restUp, arm.restLo, _t.clone(), _pole.clone(), _rootQ);
    setWorldQ(arm.hand, _handQ);
    // fingers: a fist round the grip; the support hand wraps the handguard
    const fist = arm.mitt.pose === "fist" || arm.mitt.pose === "bird" || (onGun && arm.side > 0);
    const wrap = onGun && arm.side < 0;
    for (const f of cop.fingers[arm.key]) {
      const bird = arm.mitt.pose === "bird" && f.bone.name.startsWith("middle");
      const c = wrap ? (f.thumb ? 0.25 : f.k === 1 ? 0.7 : 0.8)
        : fist && !bird ? (f.thumb ? 0.7 : f.k === 1 ? 1.2 : 1.35) : (f.thumb ? 0.15 : 0.18);
      // the thumb folds at its two outer joints (its base sits turned in the
      // palm, so it bends about the same local axis as a finger)
      _curlQ.setFromAxisAngle(_X, f.thumb && f.k === 1 ? 0 : c);
      f.bone.quaternion.copy(f.rest).multiply(_curlQ);
    }
  }

  // legs
  for (const leg of cop.legs) {
    leg.scale = 1;
    worldQ(leg.ankle, _jq);
    worldP(leg.ankle, _jp);
    _t.copy(leg.off).applyQuaternion(_jq).add(_jp);
    // sideways, in the hips' frame: the stick legs leave one point and a
    // gait walks the feet onto one line; a real body's feet track under
    // its own hips, a hand's width apart
    worldQ(rig.parts.hips, _q);
    _a.subVectors(_jp, worldP(rig.parts.hips, _b)).applyQuaternion(_q2.copy(_q).invert());
    _t.add(_b.set(leg.side * 0.085 * cop.s - 0.5 * _a.x, 0, 0).applyQuaternion(_q));
    _handQ.copy(_jq).multiply(leg.K);
    worldP(leg.hip, _sp);
    worldP(leg.knee, _ep);
    _pole.subVectors(_ep, _sp);
    _dir.copy(_t).sub(_sp).normalize();
    _pole.addScaledVector(_dir, -_pole.dot(_dir));
    if (_pole.lengthSq() < 1e-6) _pole.set(0, 0, -1).applyQuaternion(worldQ(rig.parts.hips, _q));
    solveLimb(leg, leg.th, leg.ca, leg.restTh, leg.restCa, _t.clone(), _pole.clone(), _rootQ);
    setWorldQ(leg.ft, _handQ);
  }
  cop.holder.updateMatrixWorld(true);
}

/* For tools: where things are, to check the fit. */
export function copDebug(rig) {
  const cop = rig.cop;
  if (!cop) return null;
  const out = {};
  // with a gun on the mount: the right palm against the gun's grip, the left
  // against the gun's line (it may slide along it); else against the mitts
  const gun = rig.held && rig.held.visible && rig.held.parent === rig.parts.gunMount ? rig.held : null;
  for (const arm of cop.arms) {
    const turn = arm.mitt.turn;
    const rigPalm = turn.localToWorld(MITT_FINGERS.clone().multiplyScalar(MITT_PALM * rig.scale * 1.55));
    const hq = worldQ(arm.hand, new THREE.Quaternion());
    const palm = worldP(arm.hand, new THREE.Vector3()).add(arm.palm.clone().applyQuaternion(hq));
    let d = palm.distanceTo(rigPalm);
    if (gun) {
      const u = gun.userData;
      const gq = worldQ(gun, new THREE.Quaternion());
      const grip = gun.localToWorld(u.gripPos.clone()).add(HOLD_R.off.clone().multiplyScalar(cop.s).applyQuaternion(gq));
      if (arm.side > 0) d = palm.distanceTo(grip);
      else {
        const sup = u.gripPosL || u.supportHandPos;
        const a = sup ? gun.localToWorld(sup.clone()).add(HOLD_L.off.clone().multiplyScalar(cop.s).applyQuaternion(gq)) : grip;
        const ax = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQ(gun, new THREE.Quaternion()));
        const rel = palm.clone().sub(a);
        d = rel.addScaledVector(ax, -rel.dot(ax)).length();
      }
    }
    out[`palm${arm.key}`] = d;
    if (rig.copVerbose) out[`reach${arm.key}`] = [worldP(arm.up, new THREE.Vector3()).distanceTo(rigPalm), arm.a + arm.b, palm.toArray(), rigPalm.toArray()];
  }
  for (const leg of cop.legs) {
    const ball = worldP(cop.bones[`ball_${leg.side < 0 ? "l" : "r"}`], new THREE.Vector3());
    out[`ball${leg.side < 0 ? "L" : "R"}Y`] = ball.y;
    if (rig.copVerbose) out[`leg${leg.side}`] = [worldP(leg.ft, new THREE.Vector3()).toArray(), worldP(leg.ankle, new THREE.Vector3()).toArray(), worldP(leg.th, new THREE.Vector3()).toArray(), leg.off.toArray()];
  }
  if (rig.copVerbose) out.pelvis = worldP(cop.bones.pelvis, new THREE.Vector3()).toArray();
  let nan = false;
  for (const b of Object.values(cop.bones)) if (!Number.isFinite(b.matrixWorld.elements[12] + b.quaternion.x + b.quaternion.w)) nan = true;
  out.nan = nan;
  return out;
}
