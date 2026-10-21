// Troll Forces — the emotes.
//
// Three kinds (the emote wheel tags them):
//   tp   third person: the camera pulls out and your whole body plays it
//   fp   first person: you stay in your own eyes and see your hands do it
//        (`fp(t)` gives hand targets and camera motion for game.js); other
//        players see the body version (`pose`)
//   duo  two teammates: pick it, hold X by a teammate to send it, they come
//        and hold X by you within 30 s to accept (game.js updateDuo), both
//        snap face to face `dist` apart and play their half (`pose[0]` for
//        whoever invited, `pose[1]` for whoever accepted)
//
// Everyone else sees an emote from one number on the state packet (`em`):
// the list index + 1, plus 64 for the second half of a duo. `seconds` is how
// long it plays; the dances loop until you move.
//
// Arm angles follow character.js: positive x raises an arm forward, positive
// z swings the left arm out (the right arm out is negative z).

import * as THREE from "three";
import { DANCES, setHandPose, setFace, resetSecondaryJoints, reachHand, placeFoot, beginPose, endPose } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1";
import { LeanKit, LEAN, LEAN_SECONDS, leanFp } from "../weapons/lean-cup.js?v=ng1-or1-lp1-ht1-bx1";

const PI = Math.PI;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
/* 0 -> 1 over [a, b], held at 1, then 1 -> 0 over [c, d]. */
const env = (t, a, b, c, d) => (t < b ? ease((t - a) / (b - a)) : t < c ? 1 : 1 - ease((t - c) / (d - c)));

/* Every joint an emote touches, back to neutral standing. */
function base(rig) {
  const p = rig.parts;
  p.hips.position.y = rig.hipY;
  p.hips.rotation.set(0, 0, 0);
  for (const k of ["torso", "chest", "armL", "armR", "elbowL", "elbowR", "legL", "legR", "kneeL", "kneeR", "ankleL", "ankleR", "neckPivot", "headPivot"]) {
    p[k]?.rotation.set(0, 0, 0);
  }
  setHandPose(rig, -1, "open");
  setHandPose(rig, 1, "open");
  setFace(rig);   // the rig's own face (the sad emote swaps it)
  resetSecondaryJoints(rig);
  // an emote's own pieces (the bubble, the crutches): its pose shows them
  for (const o of rig.emoteBits || []) o.visible = false;
}
/* Hang an emote's piece on `parent` the first time, kept on the rig
   (rig[key]) and hidden between emotes (base above; character.js
   poseHumanoid once the emote is over). */
function emoteBit(rig, key, parent, make) {
  if (!rig[key]) {
    const o = make();
    o.visible = false;
    parent.add(o);
    rig[key] = o;
    (rig.emoteBits ||= []).push(o);
  }
  return rig[key];
}
function head(rig, pitch = 0, yaw = 0, roll = 0) {
  const p = rig.parts;
  p.neckPivot?.rotation.set(pitch * 0.4, yaw * 0.4, roll * 0.4);
  p.headPivot?.rotation.set(pitch * 0.6, yaw * 0.6, roll * 0.6);
}
const done = (rig) => rig.body.update();

/* ------------------------------------------------------ third person */

/* Trollface sit: drops to the ground cross-legged, elbows on knees, head
   tilted with that smug lean. Loops (a slow breathe and head bob). */
function poseSit(rig, t) {
  const p = rig.parts;
  base(rig);
  const s = rig.scale, sit = ease(t / 0.6);
  const breathe = Math.sin(t * 2.2);
  p.hips.position.y = rig.hipY - sit * 0.62 * s;
  p.hips.rotation.x = -sit * 0.25;
  p.legL.rotation.set(sit * 1.35, 0, sit * 0.75);
  p.legR.rotation.set(sit * 1.35, 0, -sit * 0.75);
  p.kneeL.rotation.x = -sit * 2.2;
  p.kneeR.rotation.x = -sit * 2.2;
  p.torso.rotation.x = sit * (0.32 + breathe * 0.03);
  p.chest.rotation.x = sit * 0.1;
  p.armL.rotation.set(sit * 0.75, 0, sit * 0.25);
  p.armR.rotation.set(sit * 0.75, 0, -sit * 0.25);
  p.elbowL.rotation.x = sit * 0.9;
  p.elbowR.rotation.x = sit * 0.9;
  head(rig, -sit * 0.2 + Math.sin(t * 1.1) * 0.05, 0, sit * (0.28 + Math.sin(t * 0.7) * 0.06));
  done(rig);
}

/* The dab, three times, then a proud lean. */
function poseDab(rig, t) {
  const p = rig.parts;
  base(rig);
  const beat = (t % 1) , on = t < 3 ? env(beat, 0.05, 0.25, 0.7, 0.95) : 0;
  const lean = t >= 3 ? ease((t - 3) / 0.4) : 0;
  if (rig.blocky) return poseDabBlocky(rig, on, lean);
  // Face tucked into the left elbow, right arm flung up and out.
  p.armL.rotation.set(1.6 * on, 0, 0.9 * on);
  p.elbowL.rotation.x = 2.2 * on;
  p.armR.rotation.set(2.3 * on, 0, -0.9 * on);
  p.torso.rotation.set(0.12 * on, 0.25 * on, -0.12 * on);
  p.hips.rotation.y = -0.1 * on;
  head(rig, 0.45 * on, 0.5 * on, 0);
  p.legL.rotation.z = 0.1 * on;
  // After: hands on hips, chest out.
  p.armL.rotation.z += 0.7 * lean; p.armR.rotation.z -= 0.7 * lean;
  p.elbowL.rotation.x += 1.6 * lean; p.elbowR.rotation.x += 1.6 * lean;
  p.chest.rotation.x -= 0.15 * lean;
  head(rig, 0.45 * on - 0.15 * lean, 0.5 * on, 0);
  done(rig);
}

/* The dab on a TROLLS body (user, 2026-10-16: the dab "seems off" on the
   NFT characters): the stick's joint angles piled the thick block arms over
   the whole head. Here the hands are placed (reachHand, chest space): the
   right arm straight out, up and to the side; the left elbow under the
   chin, its forearm running up parallel to the right arm, the head tucked
   down into it with the top of the head showing. After: hands on hips. */
const DAB = {
  rest: (side) => [side * 0.3, -0.62, 0.02],
  // (chest space: +x the right side, -z in front)
  out: [0.72, 0.4, -0.1],        // right hand, the arm near straight
  // left hand: in reach (the elbow at the chin, about 0.3 out from the
  // shoulder), the forearm from there up along the right arm's line
  tuck: [0.16, 0.27, -0.24],
  hips: (side) => [side * 0.29, -0.5, -0.01],
};
const _dabA = new THREE.Vector3(), _dabB = new THREE.Vector3();
const _dabPoleTuck = new THREE.Vector3(-0.5, -0.4, -1), _dabPoleOut = new THREE.Vector3(0.2, -1, -0.3);
const _dabPoleHip = [new THREE.Vector3(-1, 0.1, -0.6), new THREE.Vector3(1, 0.1, -0.6)];
function poseDabBlocky(rig, on, lean) {
  const p = rig.parts, s = rig.scale;
  for (const side of [-1, 1]) {
    _dabA.fromArray(DAB.rest(side)).lerp(_dabB.fromArray(side > 0 ? DAB.out : DAB.tuck), on);
    _dabA.lerp(_dabB.fromArray(DAB.hips(side)), lean).multiplyScalar(s);
    reachHand(rig, side, _dabA, lean > on ? _dabPoleHip[side > 0 ? 1 : 0] : side > 0 ? _dabPoleOut : _dabPoleTuck);
    setHandPose(rig, side, "fist");
  }
  p.torso.rotation.set(0.1 * on, -0.2 * on, 0.1 * on);
  p.hips.rotation.y = 0.08 * on;
  p.legR.rotation.z = -0.1 * on;
  p.chest.rotation.x = -0.12 * lean;
  head(rig, 0.55 * on - 0.1 * lean, 0.35 * on, -0.15 * on);
  done(rig);
}

/* Middle fingers (user, after the troll NFT pre-reveal art): both arms flung
   up and out, elbows bent down at the sides, forearms straight up, a middle
   finger on each, the head cocked with that grin. The fingers jab in turn
   to a little bounce. */
const _birdT = new THREE.Vector3(), _birdPoleL = new THREE.Vector3(-1, -0.9, 0.2), _birdPoleR = new THREE.Vector3(1, -0.9, 0.2);
const BIRD_SECONDS = 4;
const BIRD_TWIST = PI / 2;
function poseBirdTP(rig, t) {
  const p = rig.parts;
  base(rig);
  const s = rig.scale, w = rig.build;
  const up = env(t, 0, 0.3, BIRD_SECONDS - 0.45, BIRD_SECONDS);
  const beat = t * PI * 2 * 1.6;
  const bounce = Math.abs(Math.sin(beat / 2)) * up;
  p.hips.position.y = rig.hipY - bounce * 0.025 * s;
  p.kneeL.rotation.x = -bounce * 0.12; p.kneeR.rotation.x = -bounce * 0.12;
  p.legL.rotation.x = bounce * 0.06; p.legR.rotation.x = bounce * 0.06;
  // Chest out, a lean back and a shimmy from side to side.
  p.torso.rotation.set(-0.06 * up, Math.sin(beat / 2) * 0.1 * up, Math.sin(beat / 2) * 0.05 * up);
  p.chest.rotation.x = -0.08 * up;
  for (const side of [-1, 1]) {
    const jab = Math.max(0, Math.sin(beat + (side > 0 ? PI : 0))) * up;
    // From hanging at the side to up beside the head, out past its edge.
    // A TROLLS body's block arms are thick and its shoulders broad: the
    // stick's spot put both fists over the face, so they go wider and a
    // little higher, the block finger standing clear of the head
    // (blocky-body.js fistFingers).
    if (rig.blocky) _birdT.set(side * (0.3 + up * 0.11) * s, (-0.6 + up * (0.8 + jab * 0.06)) * s, (-0.02 - up * 0.03) * s);
    else _birdT.set(side * (0.28 + up * 0.1) * s * w, (-0.6 + up * (0.7 + jab * 0.06)) * s, (-0.02 - up * 0.06) * s);
    reachHand(rig, side, _birdT, side < 0 ? _birdPoleL : _birdPoleR);
    setHandPose(rig, side, up > 0.35 ? "bird" : "open");
    // The back of the hand to the front, so the finger reads.
    (side < 0 ? p.wristL : p.wristR).quaternion.setFromAxisAngle(side < 0 ? rig.armRestL : rig.armRestR, side * BIRD_TWIST * up);
  }
  head(rig, -0.08 * up, 0.1 * up * Math.sin(beat / 4), (0.3 + Math.sin(beat / 2) * 0.06) * up);
  done(rig);
}

/* ------------------------------------------------ first person, body side */

/* TROLLS bodies: a hand that touches the face goes to the face itself. The
   stick's joint angles were set for the stick's head; a TROLLS head is
   smaller and lower (blocky-body.js HEAD_SCALE) and its arms thicker, so
   the facepalm, the L and the sad wipe all landed over the top of the head
   (user, 2026-10-16). `facePoint` reads a spot on the posed head board in
   reachHand's chest space: `x`, `y` across and up the face in half-widths
   and half-heights from its middle, `front` out in front of it (head
   units). Pose the head first. */
const _face = new THREE.Vector3();
function facePoint(rig, x, y, front) {
  const head = rig.parts.head, g = head.geometry.parameters;
  head.updateWorldMatrix(true, false);
  rig.parts.chest.updateWorldMatrix(true, false);
  _face.set(x * g.width / 2, y * g.height / 2, front);
  return rig.parts.chest.worldToLocal(head.localToWorld(_face));
}
/* From hanging at the side (`side` -1 left, 1 right) to `target`, by `k`. */
const _hang = new THREE.Vector3();
function reachFrom(rig, side, target, k, pole) {
  _hang.set(side * 0.3, -0.62, 0.02).multiplyScalar(rig.scale).lerp(target, k);
  reachHand(rig, side, _hang, pole);
}
const POLE_OUT_R = new THREE.Vector3(1, -0.7, -0.4), POLE_OUT_L = new THREE.Vector3(-1, -0.7, -0.4);
const POLE_DOWN_R = new THREE.Vector3(0.25, -1, -0.8);

function poseLaughTP(rig, t) {
  const p = rig.parts;
  base(rig);
  const up = env(t, 0, 0.35, 3.0, 3.4), shake = Math.sin(t * 22) * up;
  p.armR.rotation.set(1.5 * up, 0, -0.1 * up);
  setHandPose(rig, 1, up > 0.3 ? "fist" : "open");
  p.armL.rotation.set(0.9 * up, 0, 0.2);
  p.elbowL.rotation.x = 1.5 * up;
  p.torso.rotation.x = 0.12 * up + shake * 0.05;
  p.hips.position.y = rig.hipY - Math.abs(shake) * 0.02 * rig.scale;
  head(rig, -0.25 * up + shake * 0.08, 0, 0);
  // the block fist hid the whole face: on a TROLLS body it holds the belly
  if (rig.blocky) reachFrom(rig, -1, _face.set(-0.06, -0.34 + shake * 0.02, -0.2).multiplyScalar(rig.scale), up, POLE_OUT_L);
  done(rig);
}
function poseLoserTP(rig, t) {
  const p = rig.parts;
  base(rig);
  const up = env(t, 0, 0.35, 2.6, 3.0);
  p.armR.rotation.set(2.4 * up, 0, -0.35 * up);
  p.elbowR.rotation.x = 1.9 * up;
  p.hips.rotation.z = Math.sin(t * 5) * 0.06 * up;
  head(rig, 0.05, 0, Math.sin(t * 5) * 0.12 * up);
  if (rig.blocky) reachFrom(rig, 1, facePoint(rig, -0.3, 0.6, 0.18), up, POLE_DOWN_R);   // on the forehead (head-local -x: its right side)
  setHandPose(rig, 1, up > 0.35 ? "L" : "open");
  // the block fist turned palm in, so the L reads the right way round
  if (rig.blocky) p.wristR.quaternion.setFromAxisAngle(rig.armRestR, Math.PI * up);
  done(rig);
}
function poseSpinTP(rig, t) {
  const p = rig.parts;
  base(rig);
  const up = env(t, 0, 0.25, 2.1, 2.5);
  p.armR.rotation.set(1.2 * up, 0, -0.15 * up);
  p.elbowR.rotation.x = 0.8 * up;
  p.armR.rotation.y = Math.sin(t * 18) * 0.35 * up;
  setHandPose(rig, 1, "fist");
  head(rig, 0.1 * up, -0.2 * up, 0);
  done(rig);
}
function poseFacepalmTP(rig, t) {
  const p = rig.parts;
  base(rig);
  const up = env(t, 0, 0.4, 2.6, 3.0);
  p.armR.rotation.set(2.2 * up, 0, -0.2 * up);
  p.elbowR.rotation.x = 2.3 * up;
  p.chest.rotation.x = 0.1 * up;
  head(rig, 0.5 * up, Math.sin(t * 3) * 0.2 * up, 0);
  // the palm over the eyes, the elbow down in front of the chest so the
  // forearm comes up to the face (out to the side it read as a salute)
  if (rig.blocky) reachFrom(rig, 1, facePoint(rig, -0.35, 0, 0.2), up, POLE_DOWN_R);
  done(rig);
}

/* Sad trollface (user): the face goes to the sad trollface, the head hangs,
   the shoulders heave with sobs and the right forearm wipes the eyes; the
   other arm hangs limp. */
function poseSadTP(rig, t) {
  const p = rig.parts;
  base(rig);
  setFace(rig, "sad");
  const s = rig.scale, down = env(t, 0, 0.5, 3.6, 4.2);
  const sob = Math.max(0, Math.sin(t * 13)) * (0.6 + 0.4 * Math.sin(t * 2.1)) * down;
  const wipe = Math.sin(t * 5.5) * down;
  p.hips.position.y = rig.hipY - 0.04 * s * down;
  p.kneeL.rotation.x = -0.18 * down;
  p.kneeR.rotation.x = -0.18 * down;
  p.legL.rotation.x = 0.09 * down;
  p.legR.rotation.x = 0.09 * down;
  p.torso.rotation.x = 0.22 * down + sob * 0.04;
  p.chest.rotation.x = 0.16 * down + sob * 0.05;
  // Right forearm across the eyes, rubbing side to side.
  p.armR.rotation.set(2.25 * down, 0.2 * down, (-0.55 + wipe * 0.12) * down);
  p.elbowR.rotation.x = 2.2 * down;
  setHandPose(rig, 1, "fist");
  // Left arm limp, hanging a little forward.
  p.armL.rotation.set(0.12 * down + sob * 0.04, 0, 0.1);
  p.elbowL.rotation.x = 0.2 * down;
  head(rig, 0.42 * down + sob * 0.05, wipe * 0.06, 0.12 * down);
  // the fist across the eyes, rubbing (facePoint above)
  if (rig.blocky) reachFrom(rig, 1, facePoint(rig, -0.3 + wipe * 0.15, 0.15, 0.2), down, POLE_DOWN_R);
  done(rig);
}

/* ------------------------------------------- first person, your own view */
// Hand targets are in the viewmodel's space (camera at the origin looking
// down -Z): pos [x, y, z], rot [x, y, z] (Euler YXZ), a hand-model pose name.
// A hand's fingers point down -Z and its palm faces -Y at rot 0.

function fpLaugh(t) {
  const up = env(t, 0, 0.35, 3.0, 3.4), shake = Math.sin(t * 22);
  // Arm out, finger at whoever is in the crosshair, bouncing with the laugh.
  return {
    R: { pos: [0.15, -0.42 + 0.26 * up + shake * 0.008 * up, -0.55], rot: [0.14, 0.24, -0.25], pose: "point" },
    L: null,
    gun: false,
    cam: { pitch: (-0.03 + shake * 0.012) * up, yaw: 0 },
  };
}
function fpLoser(t) {
  const up = env(t, 0, 0.35, 2.6, 3.0), wag = Math.sin(t * 5) * 0.06;
  return {
    R: { pos: [0.02, -0.4 + 0.36 * up, -0.48], rot: [PI / 2, 0, wag * up], pose: "L" },
    L: null,
    gun: false,
    cam: { pitch: 0.05 * up, yaw: 0 },
  };
}
function fpSpin(t) {
  // Two full twirls with a quick ease, a flip of the wrist to finish.
  const turn = ease(t / 1.6) * PI * 4;
  const up = env(t, 0, 0.25, 2.1, 2.5);
  return { R: null, L: null, gun: { spin: turn, up }, cam: { pitch: 0, yaw: 0 } };
}
function fpFacepalm(t) {
  const up = env(t, 0, 0.4, 2.6, 3.0), shake = Math.sin(t * 3) * 0.035;
  return {
    R: { pos: [-0.01, -0.5 + 0.46 * up, -0.2], rot: [PI / 2, PI, 0.1], pose: "flat" },
    L: null,
    gun: false,
    cam: { pitch: 0.12 * up, yaw: shake * up },
  };
}

/* Pour up (lean-cup.js): the right hand holds the double cup in front of
   the chest, the left brings ice then the Sprite bottle over it, a swirl,
   a sip. The props ride the rig (rig.emoteProps; poseHumanoid hides them
   once the emote's over). */
function poseLeanTP(rig, t) {
  base(rig);
  const s = (rig.emoteProps ||= new LeanKit()).tp(rig, t, reachHand);
  setHandPose(rig, 1, "fist");
  const iceHeld = t >= LEAN.iceUp[0] && t < LEAN.drop[0];
  setHandPose(rig, -1, iceHeld || s.bottle ? "fist" : "open");
  rig.parts.torso.rotation.x = 0.06 * s.look;
  head(rig, 0.38 * s.look - 0.25 * s.sip, 0, 0);
  done(rig);
}

/* Our own first-person props for it, on the streak-arm hands (game.js). */
let fpLean = null;
function fpLeanProps(parent, handR, handL, t) { (fpLean ||= new LeanKit()).fp(parent, handR, handL, t); }
export function hideFpEmoteProps() { fpLean?.hide(); }
/* Where arm `side`'s rod should end on a held prop, or null. */
export function fpEmoteRodTip(side, from, hand, out, pad = 0) { return fpLean ? fpLean.rodTip(side, from, hand, out, pad) : null; }

/* -------------------------------------------------------------- duo */
// Both players face each other; each pose is written from its own side, so
// "forward" is toward the partner.

function dapLead(rig, t) { dapHalf(rig, t, 0); }
function dapPartner(rig, t) { dapHalf(rig, t, 0.04); }
function dapHalf(rig, t, lag) {
  const p = rig.parts;
  base(rig);
  const tt = t - lag;
  const reach = env(tt, 0.1, 0.55, 1.5, 1.9);   // hands meet and clasp
  const pull = env(tt, 0.7, 1.0, 1.4, 1.7);     // pull in, shoulder bump
  p.armR.rotation.set(1.45 * reach, 0.2 * reach, 0.15 * reach);
  p.elbowR.rotation.x = 0.6 * reach + 0.9 * pull;
  setHandPose(rig, 1, reach > 0.6 ? "fist" : "open");
  p.armL.rotation.set(0.9 * pull, 0, 0.6 * pull);
  p.elbowL.rotation.x = 1.2 * pull;
  p.torso.rotation.x = 0.22 * pull;
  p.torso.rotation.y = 0.25 * pull;
  head(rig, 0.1 * pull, 0.2 * pull, 0);
  done(rig);
}

function fiveHalf(rig, t) {
  const p = rig.parts;
  base(rig);
  const wind = env(t, 0.05, 0.45, 0.6, 0.75);   // arm up and back
  const slap = env(t, 0.6, 0.72, 0.9, 1.4);     // swing through to meet
  p.armR.rotation.set(2.6 * wind + 2.25 * slap * (1 - wind), 0, -0.5 * wind - 0.15 * slap);
  p.elbowR.rotation.x = 0.9 * wind;
  p.torso.rotation.x = 0.15 * slap - 0.08 * wind;
  p.hips.position.y = rig.hipY + Math.max(0, Math.sin(clamp01((t - 0.55) / 0.35) * PI)) * 0.05 * rig.scale;
  head(rig, -0.2 * wind, 0, 0);
  done(rig);
}

function chestHalf(rig, t) {
  const p = rig.parts;
  base(rig);
  const crouch = env(t, 0.1, 0.55, 0.6, 0.75);
  const hop = Math.max(0, Math.sin(clamp01((t - 0.65) / 0.5) * PI));
  const s = rig.scale;
  p.hips.position.y = rig.hipY - crouch * 0.12 * s + hop * 0.28 * s;
  p.legL.rotation.x = crouch * 0.6; p.legR.rotation.x = crouch * 0.6;
  p.kneeL.rotation.x = -crouch * 1.1; p.kneeR.rotation.x = -crouch * 1.1;
  p.chest.rotation.x = -0.35 * hop;   // chest out into the bump
  p.torso.rotation.x = 0.2 * crouch - 0.15 * hop;
  p.armL.rotation.set(-0.5 * hop, 0, 0.5 * hop); p.armR.rotation.set(-0.5 * hop, 0, -0.5 * hop);
  head(rig, -0.25 * hop, 0, 0);
  done(rig);
}

/* Crip walk: the heel-toe shuffle. Low in the hips, the feet pivot on heel
   and toe, step across each other and snap back out wide in a V, the arms
   hang loose and swing against the feet, the head nods the beat. The feet
   are placed (character.js placeFoot) so they plant and pivot instead of
   sliding about under the body. Four beats a bar at ~138 BPM, every other
   bar mirrored; loops till you move. */
const CW_BPS = 2.3;
// Each beat, [left, right] foot: x, z (root space, forward -z), pitch
// (+ toe down / heel up, - heel down / toe up) and yaw (+ toes out, for the
// left foot; the right foot's keys are written with its own sign).
const CW_KEYS = [
  [[-0.16, -0.14, -0.45, 0.55], [0.10, 0.04, 0.5, -0.5]],     // left heel out, right pivots in on its toe
  [[-0.08, 0.02, 0.5, -0.45], [0.17, -0.13, -0.45, 0.5]],     // and the other way
  [[0.06, -0.12, -0.2, 0.3], [0.14, 0.06, 0, -0.2]],          // the left steps across in front
  [[-0.20, 0, 0, 0.1], [-0.02, -0.18, -0.35, -0.6]],          // back out wide, the right heel sweeps across
];
const _cwF = new THREE.Vector3();
function cwKey(beat, foot) {
  // Odd bars are the mirror image: the other foot's key, flipped across.
  const k = CW_KEYS[((beat % 4) + 4) % 4];
  if (Math.floor(beat / 4) % 2 === 0) return k[foot];
  const m = k[1 - foot];
  return [-m[0], m[1], m[2], -m[3]];
}
/* Beat `n` -> n+1: which foot steps (the one that goes further) and how far each goes. */
function cwStep(n) {
  const travel = [0, 1].map((f) => { const a = cwKey(n, f), b = cwKey(n + 1, f); return Math.hypot(b[0] - a[0], b[1] - a[1]); });
  return { stepper: travel[1] > travel[0] ? 1 : 0, travel };
}
function cwLead(n) {
  const { stepper, travel } = cwStep(n);
  return (stepper ? 1 : -1) * Math.min(1, travel[stepper] / 0.15);
}
function poseCripWalk(rig, t) {
  const p = rig.parts, s = rig.scale;
  base(rig);
  const beat = t * CW_BPS, n = Math.floor(beat);
  const u = ease((beat - n) / 0.7);                  // the move, then a hold till the next beat
  const bounce = Math.abs(Math.sin(beat * PI));
  // The hips sit low and dip into every beat.
  p.hips.position.y = rig.hipY - (0.15 + 0.035 * bounce) * s;
  // The foot that goes further this beat steps (it lifts on its way); the
  // other slides and pivots on the ground, as the shuffle does.
  const { stepper, travel } = cwStep(n);
  for (const foot of [0, 1]) {
    const a = cwKey(n, foot), b = cwKey(n + 1, foot);
    const x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
    const pitch = a[2] + (b[2] - a[2]) * u, yaw = a[3] + (b[3] - a[3]) * u;
    const lift = foot === stepper ? 0.05 * Math.sin(u * PI) : 0;
    placeFoot(rig, foot ? 1 : -1, _cwF.set(x * s, lift * s, z * s), pitch, yaw);
  }
  // -1 the left foot leads .. 1 the right: the body turns with it, eased
  // over from last beat's.
  const lead = cwLead(n - 1) + (cwLead(n) - cwLead(n - 1)) * u;
  const twist = lead * 0.22;
  p.hips.rotation.set(0, twist, -lead * 0.06);
  // Leaning in over the feet (an upright joint tips forward on -x).
  p.torso.rotation.x = -0.16;
  p.chest.rotation.set(-0.06, -twist * 0.6, 0);
  // Arms loose and low, swinging against the feet; the elbows soft.
  p.armL.rotation.set(0.1 + 0.25 * lead, 0, 0.18);
  p.armR.rotation.set(0.1 - 0.25 * lead, 0, -0.18);
  p.elbowL.rotation.x = 0.3 + 0.15 * bounce;
  p.elbowR.rotation.x = 0.3 + 0.15 * bounce;
  // Every other bar the right hand comes up to the chest in a loose fist.
  const inBar = beat - Math.floor(beat / 4) * 4;
  const flash = Math.floor(beat / 4) % 2 ? env(inBar, 1.7, 2.2, 3.4, 3.9) : 0;
  if (flash > 0) {
    p.armR.rotation.x += (1.3 - p.armR.rotation.x) * flash;
    p.armR.rotation.z += (-0.45 - p.armR.rotation.z) * flash;
    p.elbowR.rotation.x += (2.0 - p.elbowR.rotation.x) * flash;
    if (flash > 0.5) setHandPose(rig, 1, "fist");
  }
  // A nod on every beat, turned a little to the leading side.
  head(rig, 0.04 + 0.08 * Math.cos(beat * 2 * PI), lead * 0.25, 0);
  done(rig);
}

/* The disco groove, mirrored on the partner so it reads as dancing together. */
function duoDanceLead(rig, t) { DANCES[0](rig, t); }
function duoDancePartner(rig, t) {
  DANCES[0](rig, t + 0.28);
  const p = rig.parts;
  p.hips.rotation.z *= -1; p.torso.rotation.z *= -1; p.chest.rotation.z *= -1;
  done(rig);
}

/* ---------------------------------------------------------------- list */

/* Bubblegum: TROLLS #989's own emote (traits.js: its Bubblegum facial is
   the emote, not worn). Lips puckered (character.js FACE_ART gum), a pink
   bubble grows at them, wobbles, pops and the gum snaps back over the
   mouth, then gets sucked back in. For whoever wears #989, and the owner on
   any body (cosmetics.js mayEmoteToken). The bubble hangs on the head board
   at the lips, so it fits the stick's head and the TROLLS one alike. */
const GUM = { x: 0.08, y: -0.036, lips: 0.012, r: 0.1, seconds: 4.6, pop: 3.2 };
let gumParts = null;
const INK_MAT = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide });
INK_MAT.userData.shared = true;
function gumBubble(rig) {
  return emoteBit(rig, "gumBubble", rig.parts.head, () => {
    if (!gumParts) {
      const geo = new THREE.SphereGeometry(1, 24, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0xff8ac4, emissive: 0x5a1036, roughness: 0.3, metalness: 0 });
      // every rig shares these (remote-players.js dispose skips them)
      geo.userData.shared = mat.userData.shared = true;
      gumParts = { geo, mat };
    }
    const g = new THREE.Group();
    const ink = new THREE.Mesh(gumParts.geo, INK_MAT);
    ink.scale.setScalar(1.07);
    g.add(new THREE.Mesh(gumParts.geo, gumParts.mat), ink);
    return g;
  });
}
function poseGum(rig, t) {
  const p = rig.parts;
  base(rig);
  setFace(rig, "gum");
  const on = env(t, 0, 0.3, GUM.seconds - 0.4, GUM.seconds);
  // a relaxed stand, chin up to blow, a flinch back at the pop
  const blow = clamp01((t - 0.3) / (GUM.pop - 0.3));
  const flinch = t > GUM.pop ? Math.max(0, 1 - (t - GUM.pop) / 0.35) : 0;
  p.armL.rotation.set(-0.08 * on, 0, 0.14 * on);
  p.armR.rotation.set(-0.08 * on, 0, -0.14 * on);
  p.elbowL.rotation.x = 0.25 * on;
  p.elbowR.rotation.x = 0.25 * on;
  p.torso.rotation.x = -0.04 * on - flinch * 0.06;
  head(rig, (-0.12 * blow - flinch * 0.25) * on, Math.sin(t * 1.3) * 0.05 * on, 0.06 * on);
  const b = gumBubble(rig);
  let r = 0, sx = 1, sy = 1, sz = 1;
  if (t > 0.3 && t < GUM.pop) {
    // grows with each breath out, wobbling as it goes
    const k = ease(blow) * (0.92 + 0.08 * Math.sin(t * 6));
    r = GUM.r * Math.max(0.08, k);
    const wob = Math.sin(t * 11) * 0.04 * k;
    sx = 1 + wob; sy = 1 - wob;
  } else if (t >= GUM.pop && t < GUM.pop + 0.08) {
    r = GUM.r * 1.15;   // the pop
  } else if (t >= GUM.pop + 0.08) {
    // snapped back flat over the lips, then sucked back in
    const back = clamp01((t - GUM.pop - 0.08) / 1.1);
    r = GUM.r * 0.75 * (1 - ease(back));
    sx = 1.1; sy = 0.75; sz = 0.12;
  }
  b.visible = r > 0.002;
  b.scale.set(r * sx, r * sy, r * sz);
  // its back stays at the lips as it grows. A mirrored head (the TROLLS
  // body's, blocky-body.js HEAD.mirror) wears its drawing flipped back the
  // right way, so its lips are on the board's other side (user, 2026-10-17:
  // "positioning of the bubblegum emote needs to be fixed")
  const side = p.headPivot.scale.x < 0 ? -1 : 1;
  b.position.set(GUM.x * side, GUM.y, GUM.lips + r * sz);
  done(rig);
}

/* Crutches (user, 2026-10-16): hobbling on a pair of crutches, the left
   leg hurt and tucked up. Loops until you move: the crutches swing ahead
   and plant, the body swings through on the good leg with a hop, the
   crutches come back under. Each crutch is placed every frame from the
   armpit (its pad) to the ground (its tip), so it fits the stick and the
   broad TROLLS bodies alike, and the hands reach for its grip.
   Three strides in, a crutch slips: a stumble, the crutches fly, a
   faceplant with a bounce, and one last twitch on the floor (user,
   2026-10-16: "falls down dramatically after using the crutches"). */
const CRUTCH = { pad: 0.13, grip: 0.36, beat: 1.15, strides: 3, seconds: 7.5 };   // pad width, grip down from the pad (share), seconds a stride, strides before the fall, the whole emote
let crutchParts = null;
function makeCrutch() {
  if (!crutchParts) {
    const metal = new THREE.MeshStandardMaterial({ color: 0xa7b0ba, roughness: 0.35, metalness: 0.6 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.9 });
    const shaft = new THREE.CylinderGeometry(0.015, 0.015, 1, 10).translate(0, -0.5, 0);   // from its top down, length 1
    const pad = new THREE.BoxGeometry(CRUTCH.pad, 0.032, 0.05);
    const grip = new THREE.CylinderGeometry(0.014, 0.014, 0.1, 10).rotateZ(PI / 2);
    const tip = new THREE.CylinderGeometry(0.017, 0.014, 0.045, 10).translate(0, 0.0225, 0);
    for (const o of [metal, rubber, shaft, pad, grip, tip]) o.userData.shared = true;
    crutchParts = { metal, rubber, shaft, pad, grip, tip };
  }
  const P = crutchParts;
  const inked = (geo, mat, k = 1.25) => {
    const g = new THREE.Group(), m = new THREE.Mesh(geo, mat), ink = new THREE.Mesh(geo, INK_MAT);
    m.castShadow = true;
    ink.scale.set(k, 1.04, k);
    g.add(m, ink);
    return g;
  };
  const c = new THREE.Group();
  c.userData.shaft = inked(P.shaft, P.metal, 1.6);
  c.userData.pad = inked(P.pad, P.rubber, 1.12);
  c.userData.grip = inked(P.grip, P.rubber, 1.15);
  c.userData.tip = inked(P.tip, P.rubber, 1.2);
  c.add(c.userData.shaft, c.userData.pad, c.userData.grip, c.userData.tip);
  return c;
}
function crutchPair() {
  const g = new THREE.Group();
  g.add(makeCrutch(), makeCrutch());
  return g;
}
const _cTop = new THREE.Vector3(), _cTip = new THREE.Vector3(), _cDir = new THREE.Vector3(), _cGrip = new THREE.Vector3();
const _cUp = new THREE.Vector3(0, -1, 0), _cQ = new THREE.Quaternion();
const _cPole = [new THREE.Vector3(-1, -0.4, 0.6), new THREE.Vector3(1, -0.4, 0.6)];
/* Stand crutch `c` (root space) from under the arm on `side` to `tip`. */
function placeCrutch(rig, c, side, tip, out) {
  const p = rig.parts, s = rig.scale, root = rig.root;
  // the pad: just under the shoulder, out to the arm's own line
  (side < 0 ? p.armL : p.armR).getWorldPosition(_cTop);
  root.worldToLocal(_cTop);
  _cTop.x += side * out * s;
  _cTop.y -= (rig.blocky ? 0.12 : 0.08) * s;
  _cDir.copy(tip).sub(_cTop);
  const len = _cDir.length();
  _cDir.divideScalar(len);
  c.position.copy(_cTop);
  c.quaternion.setFromUnitVectors(_cUp, _cDir);
  c.userData.shaft.scale.set(1, len, 1);
  c.userData.tip.position.set(0, -len, 0);
  c.userData.tip.rotation.set(PI, 0, 0);
  c.userData.grip.position.set(0, -len * CRUTCH.grip, 0);
  c.scale.setScalar(1);
  // the hand on the grip (reachHand works in chest space)
  _cGrip.set(0, -len * CRUTCH.grip, 0);
  c.localToWorld(_cGrip);
  p.chest.worldToLocal(_cGrip);
  reachHand(rig, side, _cGrip, _cPole[side < 0 ? 0 : 1]);
  setHandPose(rig, side, "fist");
}
/* Lay crutch `c` (root space) from `top` along `dir` (unit), `len` long. */
function layCrutch(c, top, dir, len) {
  c.position.copy(top);
  c.quaternion.setFromUnitVectors(_cUp, dir);
  c.userData.shaft.scale.set(1, len, 1);
  c.userData.tip.position.set(0, -len, 0);
  c.userData.tip.rotation.set(PI, 0, 0);
  c.userData.grip.position.set(0, -len * CRUTCH.grip, 0);
}
const _fTop = new THREE.Vector3(), _fRest = new THREE.Vector3(), _fDir = new THREE.Vector3(), _fSpin = new THREE.Quaternion(), _fX = new THREE.Vector3(1, 0, 0);
/* The fall, `u` seconds after the last stride. */
function poseCrutchFall(rig, u) {
  const p = rig.parts, s = rig.scale, w = rig.blocky ? 1.35 : 1;
  const trip = ease(u / 0.3);                                  // the stumble: arms up, body pitching
  const f = clamp01((u - 0.2) / 0.5) ** 2;                     // the drop, speeding up
  const bounce = u > 0.7 && u < 1.05 ? Math.sin(((u - 0.7) / 0.35) * PI) * (1 - (u - 0.7) / 0.35) : 0;
  const twitch = u > 2.4 && u < 2.9 ? Math.sin(((u - 2.4) / 0.5) * PI * 3) : 0;
  const flat = rig.blocky ? 0.2 : 0.13;
  p.hips.position.y = rig.hipY + (flat * s - rig.hipY) * f + bounce * 0.05 * s;
  p.hips.position.z = -0.3 * s * f;
  p.hips.rotation.x = 1.5 * f + trip * (1 - f) * 0.25;
  p.torso.rotation.x = 0.2 * trip * (1 - f) - bounce * 0.12;
  // arms flung up in the stumble, out ahead on the floor
  p.armL.rotation.set(2.4 * trip + 0.5 * f, 0, 0.5 + 0.2 * f);
  p.armR.rotation.set(2.1 * trip + 0.8 * f, 0, -0.4 - 0.25 * f);
  p.elbowL.rotation.x = 0.5 * (1 - f) + 0.2;
  p.elbowR.rotation.x = 0.4 * (1 - f) + 0.3;
  // the hurt leg stays bent, the good one kicks out, then twitches
  p.legL.rotation.set(0.3 * (1 - f) - 0.05 * f, 0, 0.06);
  p.kneeL.rotation.x = -1.25 * (1 - f) - 0.5 * f;
  p.legR.rotation.set(-0.35 * trip * (1 - f), 0, -0.05);
  p.kneeR.rotation.x = -0.15 - Math.max(0, twitch) * 0.9;
  // head up in surprise, then a cheek on the floor
  head(rig, -0.5 * trip * (1 - f) - 0.35 * f, 1.1 * f, 0.2 * f);
  setHandPose(rig, -1, "open");
  setHandPose(rig, 1, "open");
  if (f > 0.9) setFace(rig, "sad");
  rig.root.updateMatrixWorld(true);
  const pair = emoteBit(rig, "crutches", rig.root, crutchPair);
  pair.visible = true;
  // the crutches fly up and out ahead, tumbling, and land flat either side
  const k = ease((u - 0.05) / 0.6), arc = Math.sin(k * PI);
  const len = 1.05 * s;
  for (const side of [-1, 1]) {
    _fTop.set(side * 0.3 * w * s, 1.15 * s, -0.15 * s);
    _fRest.set(side * (0.55 + 0.1 * side) * w * s, 0.03 * s, (-0.35 + side * 0.25) * s);
    _fTop.lerp(_fRest, k);
    _fTop.y += arc * 0.45 * s;
    _fDir.set(side * 0.4, 0, -1).normalize();
    _fDir.lerp(_cUp, 1 - k).normalize();
    const c = pair.children[side < 0 ? 0 : 1];
    layCrutch(c, _fTop, _fDir, len);
    _fSpin.setFromAxisAngle(_fX, (1 - k) * k * 4 * PI * side);
    c.quaternion.premultiply(_fSpin);
  }
  done(rig);
}
function poseCrutches(rig, t) {
  const p = rig.parts, s = rig.scale;
  base(rig);
  const fallAt = CRUTCH.strides * CRUTCH.beat;
  if (t >= fallAt) return poseCrutchFall(rig, t - fallAt);
  const on = ease(t / 0.4);
  const c = (t / CRUTCH.beat) % 1;
  // 0-0.35 the crutches swing ahead and plant, 0.35-0.75 the body swings
  // through on them (a hop on the good leg), 0.75-1 they come back under
  const reach = c < 0.35 ? ease(c / 0.35) : c < 0.75 ? 1 : 1 - ease((c - 0.75) / 0.25);
  const lift = c < 0.35 ? 0 : c < 0.75 ? Math.sin(((c - 0.35) / 0.4) * PI) : 0;
  const w = rig.blocky ? 1.35 : 1;   // the TROLLS body's broad shoulders
  p.hips.position.y = rig.hipY + lift * 0.035 * s * on;
  p.torso.rotation.x = (0.05 + reach * 0.12 - lift * 0.05) * on;
  p.chest.rotation.x = 0.04 * on;
  // the hurt leg tucked up behind, the good leg giving on each landing
  p.legL.rotation.set((0.3 + lift * 0.1) * on, 0, 0.04 * on);
  p.kneeL.rotation.x = -1.25 * on;
  p.legR.rotation.x = (0.06 - lift * 0.05) * on;
  p.kneeR.rotation.x = -(0.12 + (1 - lift) * reach * 0.12) * on;
  head(rig, (0.1 + reach * 0.06) * on, 0, Math.sin(t * PI * 2 / CRUTCH.beat) * 0.05 * on);
  rig.root.updateMatrixWorld(true);
  const pair = emoteBit(rig, "crutches", rig.root, crutchPair);
  pair.visible = on > 0.02;
  for (const side of [-1, 1]) {
    // the tip: out past the foot, ahead as the crutches swing (-z forward)
    _cTip.set(side * 0.3 * w * s, 0, (0.05 - reach * 0.32) * s);
    // (the stick's arms all start at the neck: its pads go out to where
    // armpits would be, or the two met in the middle of the chest)
    placeCrutch(rig, pair.children[side < 0 ? 0 : 1], side, _cTip, rig.blocky ? 0.07 : 0.13);
  }
  done(rig);
}

export const EMOTES = [
  { id: "groove", name: "Groove", kind: "tp", pose: DANCES[0] },
  { id: "floss", name: "Floss", kind: "tp", pose: DANCES[1] },
  { id: "headbang", name: "Headbang", kind: "tp", pose: DANCES[2] },
  { id: "wave", name: "Wave", kind: "tp", pose: DANCES[3] },
  { id: "sit", name: "Trollface sit", kind: "tp", pose: poseSit },
  { id: "dab", name: "Dab", kind: "tp", pose: poseDab, seconds: 4.2 },
  { id: "laugh", name: "Point & laugh", kind: "fp", pose: poseLaughTP, fp: fpLaugh, seconds: 3.4 },
  { id: "loser", name: "L on forehead", kind: "fp", pose: poseLoserTP, fp: fpLoser, seconds: 3.0 },
  { id: "spin", name: "Gun spin", kind: "fp", pose: poseSpinTP, fp: fpSpin, seconds: 2.5 },
  { id: "facepalm", name: "Facepalm", kind: "fp", pose: poseFacepalmTP, fp: fpFacepalm, seconds: 3.0 },
  { id: "dap", name: "Dap up", kind: "duo", pose: [dapLead, dapPartner], dist: 0.8, seconds: 2.1 },
  { id: "five", name: "High five", kind: "duo", pose: [fiveHalf, fiveHalf], dist: 0.95, seconds: 1.6 },
  { id: "chest", name: "Chest bump", kind: "duo", pose: [chestHalf, chestHalf], dist: 0.7, seconds: 1.6 },
  { id: "duodance", name: "Duo dance", kind: "duo", pose: [duoDanceLead, duoDancePartner], dist: 1.3 },
  // Last in the list so every older emote keeps its wire code.
  { id: "sad", name: "Sad trollface", kind: "tp", pose: poseSadTP, seconds: 4.2 },
  { id: "bird", name: "Middle fingers", kind: "tp", pose: poseBirdTP, seconds: BIRD_SECONDS },
  { id: "lean", name: "Pour up", kind: "fp", pose: poseLeanTP, fp: leanFp, fpProps: fpLeanProps, props: true, seconds: LEAN_SECONDS },
  { id: "cwalk", name: "Crip walk", kind: "tp", pose: poseCripWalk },
  // a TROLLS token's own (`token`): the wheel shows it only to its wearer
  // and the owner, remotes play it only for them (cosmetics.js mayEmoteToken)
  { id: "gum", name: "Bubblegum", kind: "tp", pose: poseGum, seconds: GUM.seconds, token: 989 },
  { id: "crutches", name: "Crutches", kind: "tp", pose: poseCrutches, seconds: CRUTCH.seconds },
];

export const DEFAULT_EMOTE_SECONDS = 8;
export const ROLE_BIT = 64;

export const emoteSeconds = (idx) => EMOTES[idx]?.seconds ?? DEFAULT_EMOTE_SECONDS;

/* The state-packet number for an emote (0 = none). */
export const emoteCode = (idx, role = 0) => (idx == null || idx < 0 ? 0 : idx + 1 + (role ? ROLE_BIT : 0));

/* Pose a rig from a state-packet code at `t` seconds in. */
export function poseEmoteCode(rig, code, t) {
  const role = code & ROLE_BIT ? 1 : 0;
  const e = EMOTES[(code & (ROLE_BIT - 1)) - 1];
  if (!e) return false;
  const fn = Array.isArray(e.pose) ? e.pose[role] : e.pose;
  if (!e.props) rig.emoteProps?.hide();
  // Blended in from whatever the body was doing, and back out again into
  // the gait (character.js beginPose).
  beginPose(rig, "emote:" + code);
  try { fn(rig, t); }
  finally { if (endPose(rig)) rig.body?.update?.(); }
  return true;
}

/* Finger shapes the first-person emotes need, merged into hand-model.js's
   HAND_POSES by game.js (same format: per-finger curls, spread, thumb). */
const FIST_CURL = [1.45, 1.55, 1.0];
export const FP_HAND_POSES = {
  point: { curl: [[0.02, 0.05, 0.02], FIST_CURL, FIST_CURL, FIST_CURL], spread: 0, thumb: [0.25, 0.9, 0.5, 0.4] },
  L: { curl: [[0.0, 0.02, 0.0], FIST_CURL, FIST_CURL, FIST_CURL], spread: 0, thumb: [1.25, 0.05, 0.0, 0.0] },
  flat: { curl: [[0.03, 0.03, 0.02], [0.03, 0.03, 0.02], [0.03, 0.03, 0.02], [0.05, 0.04, 0.03]], spread: 0.04, thumb: [0.55, 0.2, 0.05, 0.05] },
  // Calling the K9s: index and middle together, tips bent in toward the
  // lips, ring and pinky folded under the thumb.
  whistle: { curl: [[0.05, 0.12, 0.2], [0.05, 0.12, 0.2], FIST_CURL, FIST_CURL], spread: 0, thumb: [0.35, 0.95, 0.55, 0.35] },
};
