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
import { buildHumanoid } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1";

export const COP_BODIES = {
  patrol: "cop-patrol.glb?v=cb2",
  grin: "cop-grin.glb?v=cb2",
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
      restTh: R[th.name].q, restCa: R[ca.name].q, restFt: R[ft.name].q,
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
  // the chest bone's frame back to the rig's (+X right, +Y up, -Z ahead)
  cop.chestKinv = cop.follow.find((f) => f.bone === bones.spine_03).K.clone().invert();
  // the right eye, in the head bone's own frame (for the cheek on the stock)
  cop.eyeLocal = new THREE.Vector3(0.032, 0.085, -0.085).multiplyScalar(s).applyQuaternion(R.head.q.clone().invert());
  cop.ankleY = R.foot_l.p.y;
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
  pickUpGun(rig, cop);
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
const _gq = new THREE.Quaternion(), _cq = new THREE.Quaternion(), _tq = new THREE.Quaternion();
const _lx = new THREE.Vector3(), _f = new THREE.Vector3(), _p = new THREE.Vector3(), _th = new THREE.Vector3();
const _Aw = new THREE.Vector3(), _Rw = new THREE.Vector3(), _Uw = new THREE.Vector3();
const _c = new THREE.Vector3(), _old = new THREE.Vector3(), _lm = new THREE.Matrix4();
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
// The trigger hand on a rifle's pistol grip, in the gun's frame (barrel down
// -Z, +Y up, +X right): f = the way the hand points (wrist to knuckles), t =
// the thumb side, off = the palm centre from the grip point.
const HOLD_R = { f: new THREE.Vector3(-0.4, 0.62, -0.68).normalize(), t: new THREE.Vector3(0, 1, 0), off: new THREE.Vector3(0.022, 0.035, 0) };
// The support hand: its palm sits this far under the handguard point
// (supportHandPos is 2 cm over the bore).
const HOLD_L = { off: new THREE.Vector3(0, -0.062, 0) };
// how much of the body's lean each bone takes (they are set one by one)
const LEAN = { pelvis: 0.3, spine_01: 0.65, spine_02: 1, spine_03: 1, neck_01: 0.5, head: 0.2 };

/* Where a two-bone limb's middle joint goes: from S to T, lengths a and b,
   bending toward `pole`. */
function midJoint(S, T, a, b, pole, out) {
  _dir.subVectors(T, S);
  let d = _dir.length();
  if (d < 1e-5) { _dir.set(0, -1, 0); d = 1e-5; } else _dir.divideScalar(d);
  d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, d));
  _pole.copy(pole).addScaledVector(_dir, -pole.dot(_dir)).normalize();
  const x = (a * a - b * b + d * d) / (2 * d);
  return out.copy(S).addScaledVector(_dir, x).addScaledVector(_pole, Math.sqrt(Math.max(0, a * a - x * x)));
}

/* The rifle goes back in the hands (a respawn, or the body coming off). */
function pickUpGun(rig, cop) {
  const d = cop.drop;
  if (!d) return;
  cop.drop = null;
  if (d.mesh !== rig.held) { d.mesh.parent?.remove(d.mesh); return; }
  rig.parts.gunMount.add(d.mesh);
  d.mesh.position.set(0, 0, 0);
  d.mesh.quaternion.identity();
  d.mesh.scale.setScalar(1);
}

/* Every frame after the rig is posed. The body follows the stick rig, with
   its own corrections where a real body gives the stick figure away. What
   the caller knows of the pose says which apply:
     pitch    the aim's pitch, as given to poseHumanoid (+ up). The rig turns
              its neck and head against it (character.js _poseNeckAndHead),
              which a flat face board hides; the body turns them with it.
     gait     true when poseHumanoid posed it (not a dance, an emote, a fall)
     lower, mps, moving, forward, strafe, ads, reload   as given to poseHumanoid
     death    0..1 through poseDeath (1 = lying there)
   - Lean: the rig leans BACK into a run and a crouch (7-10 degrees; its lean
     has the wrong sign, unseen on a stick). The body leans forward: from the
     ankles in a run, hinged at the hips in a crouch, shoulders rolled a
     little forward behind a raised rifle. Standing, the knees stay soft.
   - Run: the swing knee drives higher and the trailing leg reaches further
     back; the rifle rides low across the chest, muzzle down and left.
   - Rifle: the butt sits in the right shoulder pocket (the rig holds it at
     the middle of its chest), up to the cheek when aiming; the head comes
     down onto the stock. Trigger finger along the receiver, support hand
     under the handguard with the elbow down and out.
   - Downed (a backward fall): flat on the back, arms loose out to the
     sides palms up, legs straight with the toes up, the rifle dropped on
     the floor beside the body. */
export function syncCopBody(rig, o = {}) {
  const cop = rig.cop;
  if (!cop) return;
  if (!rig.root.visible) { if (cop.drop) cop.drop.mesh.visible = false; return; }
  // poseHumanoid flips the board and setHandPose the mitts back on
  if (rig.parts.body?.visible || rig.parts.head?.visible) hideStick(rig, true);
  const root = rig.root;
  root.updateMatrixWorld(true);
  worldQ(root, _rootQ);
  const B = cop.bones, P = rig.parts, s = cop.s;
  const pitch = o.pitch || 0;
  const lower = clamp01(o.lower || 0);
  const mps = o.moving === false ? 0 : Math.max(0, o.mps || 0);
  const death = clamp01(o.death || 0);
  const gait = o.gait && !death ? 1 : 0;
  const run = gait * clamp01((mps - 2.4) / 1.6) * clamp01(o.forward ?? 1) * (1 - Math.abs(o.strafe || 0) * 0.7) * (1 - lower);
  const supine = death > 0 && (rig.death?.dir ?? 1) > 0 ? smooth((death - 0.45) / 0.4) : 0;
  const reloading = o.reload > 0 && o.reload < 1;
  _Uw.set(0, 1, 0).applyQuaternion(_rootQ);

  // ---- the rifle leaves the hands on the way down, and lies where it fell
  const mount = P.gunMount;
  if (!death) pickUpGun(rig, cop);
  else if (rig.held && root.parent && (rig.death?.dir ?? 1) > 0) {
    if (!cop.drop || cop.drop.mesh !== rig.held) {
      pickUpGun(rig, cop);
      const mesh = rig.held;
      root.parent.attach(mesh);
      // on its side by the right hip, the muzzle toward the head and out a little
      const za = new THREE.Vector3(-0.3, 0, -1).normalize();
      const q1 = new THREE.Quaternion().setFromRotationMatrix(_lm.makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3().crossVectors(za, new THREE.Vector3(0, 1, 0)), za));
      const p1 = root.localToWorld(new THREE.Vector3(0.72 * s, 0.03 * s, 0.35 * s));
      root.parent.worldToLocal(p1);
      q1.premultiply(_rootQ).premultiply(worldQ(root.parent, new THREE.Quaternion()).invert());
      cop.drop = { mesh, p0: mesh.position.clone(), q0: mesh.quaternion.clone(), p1, q1 };
    }
    const d = cop.drop, k = smooth((death - 0.06) / 0.5);
    d.mesh.visible = true;
    d.mesh.position.lerpVectors(d.p0, d.p1, k);
    d.mesh.quaternion.slerpQuaternions(d.q0, d.q1, k);
  }
  const gun = rig.held && rig.held.visible && rig.held.parent === mount ? rig.held : null;
  const u = gun?.userData;
  const rifle = !!(u && u.buttPos && u.supportHandPos && !u.pistol && !u.akimbo);
  let ads = 0, kick = 0;
  if (gun) {
    // a pose that doesn't place the gun (a dance) leaves our own placement on
    // the mount: go back to the rig's, so nothing piles up
    if (cop.mSetP && mount.position.equals(cop.mSetP) && mount.quaternion.equals(cop.mSetQ)) {
      mount.position.copy(cop.mRigP);
      mount.quaternion.copy(cop.mRigQ);
    } else {
      (cop.mRigP ||= new THREE.Vector3()).copy(mount.position);
      (cop.mRigQ ||= new THREE.Quaternion()).copy(mount.quaternion);
    }
    mount.updateMatrixWorld(true);
    if (rifle) {
      // where the rig put the butt (its chest space): it walks in as it aims
      // and back with the kick (character.js _gripSupport)
      _v.copy(u.buttPos).applyQuaternion(mount.quaternion).add(mount.position);
      ads = clamp01(o.ads ?? (0.085 - _v.x / s) / 0.04);
      kick = clamp01((_v.z / s + 0.04) / 0.035);
    }
    // which hands the rig has on the gun, where the rig holds it (the body
    // moves it below): the trigger hand at the grip, the support hand
    // anywhere along the gun's line. A reload, a throw or a pose takes a
    // hand off.
    _axis.set(0, 0, 1).applyQuaternion(worldQ(gun, _gq));
    for (const arm of cop.arms) {
      const spot = arm.side > 0 ? u.gripPos : rifle ? u.supportHandPos : null;
      arm.onGun = false;
      if (!spot) continue;
      gun.localToWorld(_jp.copy(spot));
      _ep.subVectors(worldP(arm.mitt.turn, _t), _jp);
      if (arm.side < 0) _ep.addScaledVector(_axis, -_ep.dot(_axis));
      arm.onGun = _ep.length() < 0.09 * s;
    }
  } else for (const arm of cop.arms) arm.onGun = false;
  const upK = rifle && !reloading ? Math.max(ads, clamp01(rig.fireK || 0)) : 0;
  cop.ads = ads;

  // ---- the lean
  worldP(P.hips, _jp);
  worldP(P.chest, _c).sub(_jp).applyQuaternion(_q.copy(_rootQ).invert());
  const rigBack = Math.atan2(_c.z, _c.y);
  const lean = gait * (rigBack + 0.3 * run + 1.1 * lower + 0.07 * upK);
  worldQ(P.hips, _jq);
  _lx.set(1, 0, 0).applyQuaternion(_jq);

  // ---- pelvis: on the hips, turned with them; soft knees, a deeper crouch,
  // and carried ahead of the feet in a run
  _v.copy(cop.pelvisOff).applyQuaternion(_jq).add(_jp);
  _b.set(0, -(0.02 * (1 - lower) + 0.035 * lower) * s * gait, -0.08 * run * s).applyQuaternion(_rootQ);
  _v.add(_b);
  if (supine) {
    // the lying frame, in the root's space: A runs feet to head along the
    // floor, R is the body's right
    root.worldToLocal(_v);
    root.worldToLocal(worldP(P.chest, _c));
    _Aw.set(_c.x - _v.x, 0, _c.z - _v.z);
    if (_Aw.lengthSq() < 1e-4) _Aw.set(0, 0, 1);
    _Aw.normalize();
    _Rw.set(0, 1, 0).cross(_Aw);
    _v.y += (0.105 * s - _v.y) * supine;        // the back on the floor, not the spine
    // bone turn lying: right -> R, up the spine -> A, the face -> the sky
    _lm.makeBasis(_Rw, _Aw, _th.set(0, -1, 0));
    _tq.setFromRotationMatrix(_lm).premultiply(_rootQ);
    root.localToWorld(_v);
    _Aw.applyQuaternion(_rootQ);
    _Rw.applyQuaternion(_rootQ);
  }
  B.pelvis.parent.updateMatrixWorld(true);
  B.pelvis.position.copy(B.pelvis.parent.worldToLocal(_v));
  // spine, neck, head
  const dside = rig.death?.side || 1;
  for (const f of cop.follow) {
    worldQ(f.joint, _jq);
    // to +0.2 and +0.55 of the pitch overall, about what the gun takes (the
    // head pivot carries the rig neck's turn too)
    const flip = f.joint === P.neckPivot ? 0.45 : f.joint === P.headPivot ? 1.4 : 0;
    if (flip && pitch) _jq.multiply(_q.setFromAxisAngle(_X, flip * pitch));
    _jq.multiply(f.K);
    if (lean) _jq.premultiply(_q.setFromAxisAngle(_lx, -lean * (LEAN[f.bone.name] ?? 1)));
    if (supine) {
      // hips rolled a little to one side, the head lolled to it
      const turn = f.bone.name === "pelvis" ? 0.12 : f.bone.name === "head" ? 0.35 : f.bone.name === "neck_01" ? 0.15 : 0;
      _q.setFromAxisAngle(_Aw, dside * turn).multiply(_tq).multiply(cop.R[f.bone.name].q);
      _jq.slerp(_q, supine);
    }
    setWorldQ(f.bone, _jq);
  }
  // the body's own chest frame, in the rig's convention (+X right, +Y up the
  // spine, -Z ahead)
  worldQ(B.spine_03, _cq).multiply(cop.chestKinv);

  // ---- the gun. The stick rig shoulders it at the middle of its chest,
  // where its long arms (one shared shoulder) meet. On the body the butt goes
  // in the right shoulder pocket: just inside the shoulder joint, on the
  // front of the chest, the heel of the stock up at the collarbone when the
  // sights come up. Its aim stays the rig's. A pistol comes in a little,
  // for shorter arms.
  _shift.set(0, 0, 0);
  if (gun) {
    worldP(mount, _old);
    worldQ(mount, _gq);
    if (rifle) {
      // running with it: low across the chest, muzzle down and to the left
      const carry = run * (1 - upK) * (reloading ? 0 : 1);
      if (carry > 0.001) {
        _a.set(1, 0, 0).applyQuaternion(_cq);
        _b.set(0, 1, 0).applyQuaternion(_cq);
        _gq.premultiply(_q.setFromAxisAngle(_a, -0.22 * carry)).premultiply(_q.setFromAxisAngle(_b, 0.75 * carry));
      }
      worldP(B.upperarm_r, _v);
      _b.set(-0.07 - 0.03 * carry, 0.015 + 0.075 * upK - 0.1 * carry, -0.075).multiplyScalar(s).applyQuaternion(_cq);
      _v.add(_b);
      _axis.set(0, 0, 1).applyQuaternion(_gq);
      _v.addScaledVector(_axis, kick * 0.03 * s);
      _b.copy(u.buttPos).applyQuaternion(_gq);
      _v.sub(_b);                                       // the mount's place in the world
      P.chest.worldToLocal(_v);
      mount.position.copy(_v);
      mount.quaternion.copy(worldQ(P.chest, _q).invert().multiply(_gq));
    } else if (u.gripPos) {
      _v.copy(u.gripPos).applyQuaternion(mount.quaternion).add(mount.position);
      const up = clamp01((_v.y / s + 0.25) / 0.33);
      mount.position.add(_b.set(0.02, 0.03 + 0.07 * up, 0.08).multiplyScalar(s));
    }
    (cop.mSetP ||= new THREE.Vector3()).copy(mount.position);
    (cop.mSetQ ||= new THREE.Quaternion()).copy(mount.quaternion);
    mount.updateMatrixWorld(true);
    worldP(mount, _shift).sub(_old);
    worldQ(gun, _gq);
    _axis.set(0, 0, 1).applyQuaternion(_gq);            // toward the stock
  }
  // Aiming a rifle: the head comes down and over onto the stock, the eye
  // toward the sight line; it keeps looking down the barrel.
  if (rifle && upK > 0.01) {
    _v.set(0, u.buttPos.y + 0.065, u.buttPos.z - 0.14);
    gun.localToWorld(_v);                               // behind the sights, at cheek height
    worldQ(B.head, _handQ);
    worldP(B.head, _sp);
    _ep.copy(cop.eyeLocal).applyQuaternion(_handQ).add(_sp);
    worldP(B.neck_01, _jp);
    _a.subVectors(_sp, _jp);
    _b.copy(_a).add(_v).sub(_ep);
    _q.setFromUnitVectors(_a.normalize(), _b.normalize());
    const ang = 2 * Math.acos(Math.min(1, Math.abs(_q.w)));
    _tq.identity().slerp(_q, upK * Math.min(1, 0.5 / Math.max(1e-4, ang)));
    worldQ(B.neck_01, _q);
    setWorldQ(B.neck_01, _q.premultiply(_tq));
    _b.set(0, 0, -1).applyQuaternion(_gq);
    setWorldQ(B.head, _handQ.premultiply(_q.setFromAxisAngle(_b, 0.12 * upK)));
  }

  // ---- arms
  for (const arm of cop.arms) {
    arm.scale = 1;   // lengths were measured in root space (already x s)
    const turn = arm.mitt.turn;
    worldQ(turn, _handQ).multiply(arm.K);              // the hand's turn now
    worldP(turn, _t).add(_shift);                       // a gun grip sits on the rig's wrist joint
    worldP(arm.up, _sp);
    // the elbow: the way the rig's elbow sticks out of its arm line, hanging
    // a little more (real elbows don't wing out)
    worldP(arm.pivot, _jp);
    worldP(arm.elbow, _ep);
    _th.subVectors(_ep, _jp);
    _th.addScaledVector(_dir.subVectors(_t, _jp).normalize(), -_th.dot(_dir));
    if (_th.lengthSq() < 1e-6) _th.set(arm.side, -1, 0.4).applyQuaternion(_cq);
    _th.normalize();
    _th.addScaledVector(_Uw, -0.35);
    // On a rifle the hands take the gun's own grip, not the flat mitts'
    // turn (a mitt has no palm side), wherever the body has moved the gun.
    const onGun = arm.onGun;
    if (onGun) gun.localToWorld(_jp.copy(arm.side > 0 ? u.gripPos : u.supportHandPos));
    if (gun) {
      if (onGun && arm.side > 0) {
        // the trigger hand: palm on the right of the pistol grip, thumb up,
        // the wrist kept near straight, so the elbow sits where the forearm
        // behind that hand puts it
        _a.copy(HOLD_R.f).applyQuaternion(_gq);
        _b.copy(HOLD_R.t).applyQuaternion(_gq);
        _f.copy(arm.f0).applyQuaternion(_rootQ);
        _p.copy(arm.t0).applyQuaternion(_rootQ);
        frameRot(_f, _p, _a, _b, _handQ);
        _handQ.multiply(_q2.copy(_rootQ).multiply(arm.Hr));
        _t.copy(HOLD_R.off).multiplyScalar(s).applyQuaternion(_gq).add(_jp);
        _ep.copy(arm.fLocal).applyQuaternion(_handQ);
        _th.copy(_t).addScaledVector(_ep, -arm.b).sub(_sp);
      } else if (onGun) {
        // the support hand: under the handguard, palm up, as far forward as
        // leaves the elbow bent near a right angle, the elbow down and out,
        // the forearm in plain sight under the gun; the hand runs on from
        // the forearm with a little wrist toward the muzzle
        const want = (arm.a + arm.b) * 0.8;
        for (let i = 0; i < 16 && _jp.distanceTo(_sp) > want; i++) _jp.addScaledVector(_axis, 0.01 * s);
        _c.copy(HOLD_L.off).multiplyScalar(s).applyQuaternion(_gq).add(_jp);   // the palm's centre
        _th.set(-0.75, -1, 0.1).applyQuaternion(_cq);
        midJoint(_sp, _c, arm.a, arm.b, _th, _ep);
        _a.set(0, 0, -1).applyQuaternion(_gq);
        _f.subVectors(_c, _ep).normalize().multiplyScalar(0.72).addScaledVector(_a, 0.28).normalize();
        _a.set(0.35, 1, 0).applyQuaternion(_gq);
        _p.copy(_a).addScaledVector(_f, -_a.dot(_f)).normalize();               // the palm faces the gun
        _a.crossVectors(_p, _f);                                                // the thumb side (a left hand)
        _b.copy(arm.f0).applyQuaternion(_rootQ);
        _old.copy(arm.t0).applyQuaternion(_rootQ);
        frameRot(_b, _old, _f, _a, _handQ);
        _handQ.multiply(_q2.copy(_rootQ).multiply(arm.Hr));
        _t.copy(_c).addScaledVector(_p, -0.018 * s);    // the bones run under the palm's skin
      }
    }
    if (supine) {
      // loose on the floor, out to the side and a little toward the feet,
      // the elbow slightly bent, the palm to the sky
      _c.copy(_sp).addScaledVector(_Rw, arm.side * 0.4 * s).addScaledVector(_Aw, -0.2 * s);
      root.worldToLocal(_c);
      _c.y = 0.05 * s;
      root.localToWorld(_c);
      _t.lerp(_c, supine);
      _f.copy(_Rw).multiplyScalar(arm.side * 0.8).addScaledVector(_Aw, -0.55).normalize();
      if (arm.side < 0) _a.crossVectors(_Uw, _f); else _a.crossVectors(_f, _Uw);
      _b.copy(arm.f0).applyQuaternion(_rootQ);
      _old.copy(arm.t0).applyQuaternion(_rootQ);
      frameRot(_b, _old, _f, _a, _tq);
      _tq.multiply(_q2.copy(_rootQ).multiply(arm.Hr));
      _handQ.slerp(_tq, supine);
      _c.copy(_Rw).multiplyScalar(arm.side * 0.3).addScaledVector(_Aw, -1).addScaledVector(_Uw, -0.25);
      _th.lerp(_c, supine);
    }
    // the body's wrist: back from the palm along the hand
    _w.copy(arm.palm).applyQuaternion(_handQ);
    _t.sub(_w);
    solveLimb(arm, arm.up, arm.lo, arm.restUp, arm.restLo, _t.clone(), _th.clone(), _rootQ);
    setWorldQ(arm.hand, _handQ);
    // fingers: a fist round the grip with the trigger finger laid along the
    // receiver; the support hand wrapped round the handguard, thumb over
    const grip = onGun && arm.side > 0;
    const fist = arm.mitt.pose === "fist" || arm.mitt.pose === "bird" || grip;
    const wrap = onGun && arm.side < 0;
    for (const f of cop.fingers[arm.key]) {
      const name = f.bone.name;
      const out = (arm.mitt.pose === "bird" && name.startsWith("middle")) || (grip && name.startsWith("index"));
      let c = wrap ? (f.thumb ? 0.45 : f.k === 1 ? 0.95 : 0.85)
        : fist && !out ? (f.thumb ? 0.7 : f.k === 1 ? 1.2 : 1.35) : (f.thumb ? 0.15 : 0.18);
      if (out) c = 0.06;
      if (supine) c += (0.32 - c) * supine;
      // the thumb folds at its two outer joints (its base sits turned in the
      // palm, so it bends about the same local axis as a finger)
      _curlQ.setFromAxisAngle(_X, f.thumb && f.k === 1 ? 0 : c);
      f.bone.quaternion.copy(f.rest).multiply(_curlQ);
    }
  }

  // ---- legs
  worldQ(P.hips, _cq);
  worldP(P.hips, _c);
  for (const leg of cop.legs) {
    leg.scale = 1;
    worldQ(leg.ankle, _jq);
    worldP(leg.ankle, _jp);
    _t.copy(leg.off).applyQuaternion(_jq).add(_jp);
    // sideways, in the hips' frame: the stick legs leave one point and a
    // gait walks the feet onto one line; a real body's feet track under
    // its own hips, a hand's width apart
    _a.subVectors(_jp, _c).applyQuaternion(_q2.copy(_cq).invert());
    _t.add(_b.set(leg.side * 0.085 * s - 0.5 * _a.x, 0, 0).applyQuaternion(_cq));
    if (run > 0) {
      // a run: the swing foot comes through higher (the knee drives up), the
      // trailing foot reaches further back
      root.worldToLocal(_t);
      _t.y += Math.max(0, _t.y - cop.ankleY) * 0.85 * run;
      const back = _t.z - root.worldToLocal(_b.copy(_c)).z;
      if (back > 0) _t.z += back * 0.25 * run;
      root.localToWorld(_t);
    }
    _handQ.copy(_jq).multiply(leg.K);
    worldP(leg.th, _sp);
    worldP(leg.hip, _a);
    worldP(leg.knee, _ep);
    _th.subVectors(_ep, _a);
    _th.addScaledVector(_dir.subVectors(_t, _a).normalize(), -_th.dot(_dir));
    if (_th.lengthSq() < 1e-6) _th.set(0, 0, -1).applyQuaternion(_cq);
    _th.normalize();
    if (supine) {
      // legs down along the floor, a little apart, one a touch more bent;
      // the knees and the toes both to the sky and slightly out
      const bent = leg.side * dside > 0 ? 0.09 : 0;
      _v.copy(_sp).addScaledVector(_Aw, -(0.82 - bent) * s).addScaledVector(_Rw, leg.side * 0.09 * s);
      root.worldToLocal(_v);
      _v.y = cop.ankleY + 0.012 * s;
      root.localToWorld(_v);
      _t.lerp(_v, supine);
      _f.copy(_Uw).addScaledVector(_Rw, leg.side * 0.4).addScaledVector(_Aw, -0.4).normalize();   // the toes
      _a.set(0, 0, -1).applyQuaternion(_rootQ);
      frameRot(_a, _Uw, _f, _Aw, _tq);
      _tq.multiply(_q2.copy(_rootQ).multiply(leg.restFt));
      _handQ.slerp(_tq, supine);
      _v.copy(_Uw).addScaledVector(_Rw, leg.side * 0.35);
      _th.lerp(_v, supine);
    }
    solveLimb(leg, leg.th, leg.ca, leg.restTh, leg.restCa, _t.clone(), _th.clone(), _rootQ);
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
