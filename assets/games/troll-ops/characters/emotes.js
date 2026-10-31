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
import { DANCES, setHandPose, setFace, resetSecondaryJoints, reachHand, placeFoot, beginPose, endPose } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1-pk1-mb1";
import { LeanKit, LEAN, LEAN_SECONDS, leanFp } from "../weapons/lean-cup.js?v=ng1-or1-lp1-ht1-bx1";
import { HellfireFx } from "../weapons/soul-blazer.js?v=sb1-or1";

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

/* Cigar and Blunt: TROLLS #1272's own emotes (traits.js: its Cigar facial
   is the emote, not worn; user, 2026-10-21: "1272 should not have a cigar
   in his face just make it an exclusive emote"; 2026-10-30: the one cigar
   became these two, the same motion, only the smoke differs: the blunt is
   weed rolled in white paper). The right hand fishes it out of the vest
   and puts it between the teeth near the grin's corner, then
   comes up in front of the chest and bursts into flame (the Soul Blazer's
   hellfire); the burning hand goes to the tip, the head dips into it and
   the tip lights: it glows and smoke curls off it. The hand shakes the fire
   out, he takes a draw, takes it out of the mouth and holds it off to the
   side, chin up, the smoke going up off the tip. For whoever wears #1272,
   and the owner on any body (cosmetics.js mayEmoteToken). The flame and
   the smoke are drawn from the emote clock alone (no state), so a frozen
   moment, a remote and a replay all show the same thing. In the mouth it
   hangs on the head board (the NFT's art right, flipped back on a mirrored
   head like the bubble); in the hand, on the hand point, out of the front
   of the fist. */
const LIGHT = {
  seconds: 6.6,
  // where it goes into the mouth (head-board halves, measured on each
  // face's art): in the dark between the top and bottom teeth, a couple of
  // teeth in from the grin's corner (user, 2026-10-30, a mark on #1718's
  // grin: "should appear to be in the mouth"). It goes in at the face's
  // surface there (a TROLLS face stands out from the board in relief), with
  // `bury` metres of it inside, so the teeth hold it
  corner: { stick: [0.36, -0.14], blocky: [0.43, -0.2] }, bury: 0.03,
  inMouth: [1.0, 5.05],                 // between these it's in the grin
  fire: [1.65, 3.55, 3.75],             // bursts into flame, goes out over the last two
  lights: [2.55, 2.95],                 // the tip catches
  draw: [3.85, 4.4],                    // a draw: the tip glows hot
  exhale: 4.45,                         // the smoke out of the grin
  flame: 0.065,                         // how far above the fist's top the tip sits in the fire
};
/* The two props, along +x from the mouth end (0) to the lit end (len).
   Rings: [from, to, radius at from, radius at to, colour key]. */
const SMOKES = {
  cigar: {
    // (the band just clear of the lips: LIGHT.bury of it is in the mouth)
    len: 0.2,
    colours: { wrap: 0x3b2210, cap: 0x2f1a0c, band: 0xb0302a, gold: 0xd9a63a, ash: 0x8e8a84 },
    rings: [[0, 0.012, 0.016, 0.0235, "cap"], [0.012, 0.042, 0.0235, 0.0235, "wrap"], [0.042, 0.062, 0.025, 0.025, "band"],
      [0.062, 0.068, 0.0252, 0.0252, "gold"], [0.068, 0.188, 0.0235, 0.0235, "wrap"], [0.188, 0.194, 0.0225, 0.0225, "ash"]],
    tip: 0.0225,
  },
  // weed rolled in white paper (user, 2026-10-30): a cone, the card crutch
  // at the mouth end, the twist at the lit end, the weed showing there
  blunt: {
    len: 0.16,
    colours: { crutch: 0xc9a46a, paper: 0xf4f1e8, seam: 0xdcd7ca, ash: 0x8f8b84 },
    rings: [[0, 0.022, 0.0068, 0.0072, "crutch"], [0.022, 0.08, 0.0072, 0.0098, "paper"], [0.08, 0.084, 0.0099, 0.01, "seam"],
      [0.084, 0.146, 0.01, 0.0126, "paper"], [0.146, 0.151, 0.0126, 0.0126, "ash"]],
    tip: 0.0126, cold: 0x4f5a30,
  },
};
const TIP_COLOURS = { cold: 0x3a2a1e, ember: 0xa8321a, lit: 0xffb02e };
const _litGeos = {};
function smokeProp(kind) {
  const S = SMOKES[kind];
  if (!_litGeos[kind]) {
    // rounded sections: cylinders turned to lie along +x
    const ring = (a, b, r0, r1) => {
      const geo = new THREE.CylinderGeometry(r1, r0, b - a, 14, 1);
      geo.rotateZ(-PI / 2).translate((a + b) / 2, 0, 0);
      geo.userData.shared = true;
      return geo;
    };
    const ink = (a, b, r0, r1) => ring(a - 0.004, b + 0.004, r0 + 0.004, r1 + 0.004);
    const last = S.rings[S.rings.length - 1][1];
    _litGeos[kind] = {
      rings: S.rings.map(([a, b, r0, r1]) => ring(a, b, r0, r1)),
      ink: ink(0, S.len, S.rings[0][2], S.tip),
      tip: ring(last, S.len, S.tip, S.tip * 0.92),
      mats: Object.fromEntries(Object.entries(S.colours).map(([k, c]) => {
        const m = new THREE.MeshToonMaterial({ color: c });
        m.userData.shared = true;
        return [k, m];
      })),
    };
  }
  const G = _litGeos[kind], g = new THREE.Group();
  S.rings.forEach((r, i) => g.add(new THREE.Mesh(G.rings[i], G.mats[r[4]])));
  g.add(new THREE.Mesh(G.ink, INK_MAT));
  // the lit end: cold until the flame gets to it, then an ember that glows
  // in the dark too, brighter on the draw (its own colour, per rig)
  const cold = new THREE.Color(S.cold ?? TIP_COLOURS.cold);
  const tip = new THREE.Mesh(G.tip, new THREE.MeshBasicMaterial({ color: cold }));
  g.add(tip);
  g.userData.tip = tip;
  g.userData.cold = cold;
  g.userData.tipX = S.len;
  return g;
}
/* The light grey of the smoke: one soft puff, every wisp a sprite of it. */
let _puffMat = null;
function puffMaterial() {
  if (_puffMat) return _puffMat;
  const N = 64, c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d"), r = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  r.addColorStop(0, "rgba(255,255,255,0.9)");
  r.addColorStop(0.5, "rgba(255,255,255,0.35)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, N, N);
  const tex = new THREE.CanvasTexture(c);
  tex.userData.shared = true;
  _puffMat = { tex };
  return _puffMat;
}
const TIP_WISPS = 7, MOUTH_PUFFS = 5, FLAMES = 12, EMBERS = 3;
/* The flame on the hand and the smoke, hung on the root (upright, so the
   fire and the smoke rise straight up whichever way the hand turns). */
function lightFx() {
  const g = new THREE.Group();
  g.userData.fire = new HellfireFx(g, { max: FLAMES + EMBERS + 2, gain: 1.35, additive: false, hot: 0.85 });
  const tex = puffMaterial().tex;
  g.userData.wisps = [];
  for (let i = 0; i < TIP_WISPS + MOUTH_PUFFS; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xdedbd4, transparent: true, depthWrite: false }));
    sp.renderOrder = 6;
    g.add(sp);
    g.userData.wisps.push(sp);
  }
  // the hellfire's particles, rebuilt from the clock every frame
  g.userData.pool = Array.from({ length: FLAMES + EMBERS }, () => ({ vx: 0, vy: 0, vz: 0, drag: 0, grav: 0, spin: 0, inT: 0.02 }));
  return g;
}
const hash = (n) => { const x = Math.sin(n * 127.1 + 11.7) * 43758.5453; return x - Math.floor(x); };
/* The burning hand: `amp` 0..1 (a burst over 1 as it catches), the fist's
   top at `at` (root space). */
function drawHandFire(fx, at, t, amp, s) {
  const fire = fx.userData.fire, pool = fx.userData.pool, P = fire.fire.p;
  P.length = 0;
  if (amp > 0.01) {
    for (let i = 0; i < FLAMES + EMBERS; i++) {
      const q = pool[i], ember = i >= FLAMES;
      const rate = ember ? 1.3 : 2.6, ph = t * rate + i / (ember ? EMBERS : FLAMES), cyc = Math.floor(ph), u = ph - cyc;
      const seed = i * 31 + cyc, a = hash(seed) * PI * 2, r = (ember ? 0.03 : 0.022) * Math.sqrt(hash(seed + 7)) * s;
      q.life = ember ? 0.8 : 0.38;
      q.age = u * q.life;
      q.x = at.x + Math.cos(a) * r * (1 - 0.4 * u);
      q.z = at.z + Math.sin(a) * r * (1 - 0.4 * u);
      q.y = at.y + (ember ? 0.24 : 0.12) * u * s * Math.min(1.3, amp);
      q.rot = (hash(seed + 3) - 0.5) * 0.8;
      if (ember) Object.assign(q, { s0: 0.012 * s, s1: 0.005 * s, f0: 15, f1: 15, a: 1, h0: 1.3, h1: 0.5, fade: 0.7 });
      else Object.assign(q, { s0: 0.05 * s * amp, s1: (0.1 + 0.03 * hash(seed + 5)) * s * amp, f0: 0, f1: 10, a: Math.min(1, amp), h0: 1.25, h1: 0.35, fade: 1.6 });
      P.push(q);
    }
  }
  fire.update(0);   // draws them where they were put (no time passes)
}
/* Wisps off the lit tip (`tip`, root space; `amp` 0..1), and the cloud out
   of the grin after the draw (`mouth`, root space; null: none). */
function drawSmoke(fx, tip, mouth, t, amp, sinceExhale, s) {
  const W = fx.userData.wisps;
  for (let i = 0; i < TIP_WISPS; i++) {
    const sp = W[i], ph = t * 0.55 + i / TIP_WISPS, u = ph - Math.floor(ph);
    sp.visible = amp > 0.01;
    if (!sp.visible) continue;
    // a thin curl: it winds and drifts as it climbs, widening as it fades
    const curl = u * 9 + i;
    sp.position.set(tip.x + Math.sin(curl) * 0.025 * u * s, tip.y + (0.01 + 0.32 * u) * s, tip.z + Math.cos(curl * 0.7) * 0.02 * u * s);
    sp.scale.setScalar((0.018 + 0.09 * u) * s);
    sp.material.opacity = 0.5 * amp * Math.min(1, u * 8) * (1 - u);
  }
  for (let i = 0; i < MOUTH_PUFFS; i++) {
    const sp = W[TIP_WISPS + i], u = (sinceExhale - i * 0.18) / 1.4;
    sp.visible = !!mouth && u > 0 && u < 1;
    if (!sp.visible) continue;
    sp.position.set(mouth.x + Math.sin(i * 2.1 + u * 3) * 0.04 * s, mouth.y + (0.02 + 0.22 * u) * s, mouth.z);
    sp.scale.setScalar((0.05 + 0.2 * u) * s);
    sp.material.opacity = 0.6 * (1 - u);
  }
}
/* The middle of the fist or the open hand that's showing (its box). */
const _mitt = new THREE.Box3(), _mittPiece = new THREE.Box3();
function mittCentre(rig, out) {
  const h = rig.hands.R, shown = h.fist.visible ? h.fist : h.open;
  _mitt.makeEmpty();
  shown.updateWorldMatrix(true, true);
  shown.traverse((o) => {
    if (!o.isMesh || !o.visible || o.material === INK_MAT) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    _mitt.union(_mittPiece.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  if (_mitt.isEmpty()) return rig.parts.wristR.getWorldPosition(out);
  return _mitt.getCenter(out);
}
const _lT = new THREE.Vector3(), _lW = new THREE.Vector3(), _lM = new THREE.Vector3(), _lTip = new THREE.Vector3(), _lErr = new THREE.Vector3();
const _lFire = new THREE.Vector3(), _lMouth = new THREE.Vector3(), _lUp = new THREE.Vector3();
const _lPole = new THREE.Vector3(1, -0.8, 0.2), _lHipPole = new THREE.Vector3(-1, 0.1, 0.6), _lHip = new THREE.Vector3(), _lK = new THREE.Vector3();
/* How far the face stands out of the head board at a point of it (head
   space): a TROLLS face is in relief, the stick's is the board. Measured
   once per body (a ray in from the front; the emote's own pieces skipped). */
const _faceRay = new THREE.Raycaster(), _faceO = new THREE.Vector3(), _faceN = new THREE.Vector3();
function faceDepth(rig, x, y) {
  const head = rig.parts.head, key = `${x},${y},${head.children.length},${rig.blocky ? 1 : 0}`;
  if (rig.lightFace?.key === key) return rig.lightFace.z;
  head.updateWorldMatrix(true, true);
  head.localToWorld(_faceO.set(x, y, 0.4));
  _faceN.set(0, 0, -1).transformDirection(head.matrixWorld);
  _faceRay.set(_faceO, _faceN);
  const bits = rig.emoteBits || [];
  const hit = _faceRay.intersectObject(head, true).find((h) => {
    for (let o = h.object; o && o !== head; o = o.parent) if (!o.visible || bits.includes(o)) return false;
    return true;
  });
  const z = hit ? head.worldToLocal(hit.point).z : 0;
  rig.lightFace = { key, z };
  return z;
}
const _tipEmber = new THREE.Color(TIP_COLOURS.ember), _tipLit = new THREE.Color(TIP_COLOURS.lit);
function poseLightUp(kind, rig, t) {
  const p = rig.parts, s = rig.scale, w = rig.blocky ? 1.35 : 1;
  base(rig);
  const T = LIGHT.seconds;
  // the right hand's stops: the vest pocket, the mouth (in, then out),
  // up in front burning, at the tip, the belt, held out
  const pocket = env(t, 0, 0.35, 0.5, 0.75);
  const toMouth = Math.max(env(t, 0.5, 0.92, 1.05, 1.35), env(t, 4.7, 5.0, 5.1, 5.4));
  const burn = env(t, 1.3, 1.6, 3.5, 3.85);
  const toTip = env(t, 2.0, 2.45, 3.25, 3.55);
  const atBelt = env(t, 3.7, 4.05, 4.6, 4.85);
  const out = env(t, 5.1, 5.45, 6.0, 6.4);
  const inMouth = t >= LIGHT.inMouth[0] && t < LIGHT.inMouth[1];
  const chinUp = env(t, 5.3, 5.6, 6.0, 6.35);
  const draw = env(t, LIGHT.draw[0], LIGHT.draw[0] + 0.2, LIGHT.draw[1] - 0.15, LIGHT.draw[1]);
  // the head leans into the flame, then the draw, then chin up
  head(rig, 0.16 * toTip - 0.06 * draw - 0.3 * chinUp, -0.1 * toTip + 0.06 * atBelt, 0.06 * atBelt);
  p.torso.rotation.x = 0.04 * toTip - 0.05 * (atBelt + chinUp);
  // the left hand on the hip, a cocky stance
  const hip = env(t, 0.2, 0.7, 6.0, 6.5);
  _lHip.set(-0.3 * s, -0.62 * s, 0.02 * s).lerp(_lK.set(-0.2 * w * s, -0.5 * s, 0.03 * s), hip);
  reachHand(rig, -1, _lHip, _lHipPole);
  setHandPose(rig, -1, hip > 0.5 ? "fist" : "open");
  const side = p.headPivot.scale.x < 0 ? -1 : 1, corner = rig.blocky ? LIGHT.corner.blocky : LIGHT.corner.stick;
  const shown = t >= 0.4 && t < T - 0.3;
  // in the mouth: out from between the teeth, mostly forward, angled out
  // to the side and drooping a little, its end in behind the face
  const mouth = emoteBit(rig, kind + "Mouth", p.head, () => smokeProp(kind));
  const g = p.head.geometry.parameters;
  mouth.visible = shown && inMouth;
  mouth.rotation.set(0, side * -1.0, -side * 0.2);
  mouth.scale.set(side * s, s, s);
  const mx = corner[0] * side * g.width / 2, my = corner[1] * g.height / 2;
  mouth.position.set(mx, my, faceDepth(rig, mx, my))
    .add(_lK.set(-LIGHT.bury, 0, 0).multiply(mouth.scale).applyQuaternion(mouth.quaternion));
  // right hand: blended from hanging through each stop (chest space)
  _lT.set(0.3 * s, -0.62 * s, 0.02 * s);
  _lT.lerp(_lK.set(-0.06 * w * s, -0.14 * s, -0.17 * s), pocket);
  _lT.lerp(_lK.set(0.12 * w * s, -0.24 * s, -0.3 * s), burn);
  _lT.lerp(_lK.set(0.1 * w * s, -0.5 * s, -0.12 * s), atBelt);
  _lT.lerp(_lK.set(0.26 * w * s, -0.28 * s, -0.28 * s), out);
  if (toMouth > 0) {
    // the fist just off the grin's corner, on the prop's side of the face
    _lT.lerp(facePoint(rig, corner[0] * side * 1.35, corner[1], 0.13 * s), toMouth);
  }
  setHandPose(rig, 1, burn > 0.3 && toMouth < 0.3 ? "open" : pocket + toMouth + atBelt + out > 0.3 ? "fist" : "open");
  reachHand(rig, 1, _lT, _lPole);
  rig.root.updateMatrixWorld(true);
  // the tip, where the mouth holds it (world)
  mouth.updateWorldMatrix(true, false);
  mouth.localToWorld(_lTip.set(mouth.userData.tipX, 0, 0));
  _lUp.set(0, 1, 0).transformDirection(rig.root.matrixWorld);
  if (toTip > 0) {
    // the hand's middle a flame's height under the tip: aim the hand point
    // for that, see where the mitt lands, take the miss out (twice: the
    // mitt sits off the hand point and turns with the arm)
    const drop = (rig.blocky ? 0.085 : 0.06) + LIGHT.flame;
    _lW.copy(_lTip).addScaledVector(_lUp, -drop * s);
    const chest = p.chest;
    chest.updateWorldMatrix(true, false);
    chest.worldToLocal(_lW);
    _lM.copy(_lT).lerp(_lW, toTip);
    for (let k = 0; k < 2; k++) {
      reachHand(rig, 1, _lM, _lPole);
      rig.root.updateMatrixWorld(true);
      // the miss, in chest space
      chest.worldToLocal(mittCentre(rig, _lErr)).sub(_lW).multiplyScalar(toTip);
      _lM.sub(_lErr);
    }
    reachHand(rig, 1, _lM, _lPole);
    rig.root.updateMatrixWorld(true);
  }
  // in the hand: out of the front of the fist
  const held = emoteBit(rig, kind + "Hand", p.wristR.parent, () => smokeProp(kind));
  held.visible = shown && !inMouth;
  held.position.set(0, 0, 0);
  held.rotation.set(0, PI / 2, 0);
  held.scale.setScalar(s);
  // the tip: cold till the flame gets to it, then a glow that breathes,
  // hot on the draw
  const caught = ease((t - LIGHT.lights[0]) / (LIGHT.lights[1] - LIGHT.lights[0]));
  const glow = Math.max(0.35 + 0.15 * Math.sin(t * 5), draw);
  for (const c of [mouth, held]) {
    c.userData.tip.material.color.copy(_tipEmber).lerp(_tipLit, glow).lerp(c.userData.cold, 1 - caught);
  }
  // the fire and the smoke, in root space
  const fx = emoteBit(rig, kind + "Fx", rig.root, lightFx);
  fx.visible = shown;
  const [on, off0, off1] = LIGHT.fire;
  const amp = t < on ? 0 : (1 + 0.6 * env(t, on, on + 0.05, on + 0.15, on + 0.4)) * (1 - ease((t - off0) / (off1 - off0)));
  done(rig);
  rig.root.updateMatrixWorld(true);
  mittCentre(rig, _lFire).addScaledVector(_lUp, (rig.blocky ? 0.06 : 0.035) * s);
  drawHandFire(fx, rig.root.worldToLocal(_lFire), t, amp, s);
  const lit = inMouth ? mouth : held;
  lit.updateWorldMatrix(true, false);
  lit.localToWorld(_lTip.set(lit.userData.tipX, 0, 0));
  rig.root.worldToLocal(_lTip);
  const exhaled = t >= LIGHT.exhale;
  if (exhaled) rig.root.worldToLocal(p.chest.localToWorld(_lMouth.copy(facePoint(rig, corner[0] * 0.4 * side, corner[1], 0.1 * s))));
  drawSmoke(fx, _lTip, exhaled ? _lMouth : null, t, caught * (shown ? 1 : 0), t - LIGHT.exhale, s);
}
/* The wheel's pictures of the two (emote-wheel.js draws an emote's `icon`). */
const ICON_TIP = '<rect x="34" y="3.6" width="3" height="4.8" rx="1" fill="#ffb02e"/><path d="M36 2.6c1.6-1.2-.6-1.8.8-2.6" fill="none" stroke="#cfcac2" stroke-width=".8"/>';
const CIGAR_ICON = '<svg viewBox="0 0 40 12" aria-hidden="true"><rect x="2" y="2.4" width="32" height="7.2" rx="3.4" fill="#4a2a14" stroke="#111"/><rect x="7" y="2.4" width="4" height="7.2" fill="#b0302a"/><rect x="11" y="2.4" width="1.2" height="7.2" fill="#d9a63a"/>' + ICON_TIP + "</svg>";
const BLUNT_ICON = '<svg viewBox="0 0 40 12" aria-hidden="true"><path d="M8 4.6 34 3.4v5.2L8 7.4z" fill="#f4f1e8" stroke="#111" stroke-linejoin="round"/><path d="M2 4.7h6v2.6H2z" fill="#c9a46a" stroke="#111"/><path d="M20 4v4" stroke="#cfc9ba" stroke-width=".8"/>' + ICON_TIP + "</svg>";
const poseCigar = (rig, t) => poseLightUp("cigar", rig, t);
const poseBlunt = (rig, t) => poseLightUp("blunt", rig, t);
const _smokeGeo = new THREE.SphereGeometry(1, 12, 8);   // the chug's foam
_smokeGeo.userData.shared = true;

/* Chug (user, 2026-10-22: "drinking a beer emote after drinking from the
   beer mug the character gets super excited ... and throws the mug"). A
   frothy mug comes up in the right fist; head back, three big gulps, the
   mug tipping further each time as the beer goes down. The back of the
   left hand wipes the mouth, then he goes off: both arms up, two hops, a
   fist pump, head shaking. A big overhand wind-up and the mug flies,
   tumbling, about 4 m ahead and smashes (glass and foam). For everyone, on
   every body. Blocky and inked like the bubble. The flight is drawn in root
   space from the emote clock, so every client sees the same throw. */
const CHUG = {
  seconds: 6.2, release: 4.72, land: 5.42,
  gulps: [[0.75, 1.25], [1.3, 1.8], [1.85, 2.35]],
  // the mug's turn in the fist: upright, and tipped to the lips (radians about the hand's x)
  upright: [0, PI / 2, 0], tip: 1.35,
  fly: { from: [0.24, 1.95, -0.35], to: [0.35, 0.06, -4.0], peak: 1.1 },
};
const CHUG_COLOURS = { glass: 0xd8eef0, beer: 0xe09a1a, foam: 0xfff6e0, band: 0x8a5a2b };
let chugGeo = null;
function chugBox(colour, w, h, d, x, y, z, g, opts = {}) {
  chugGeo ||= Object.assign(new THREE.BoxGeometry(1, 1, 1), { userData: { shared: true } });
  const mat = colour instanceof THREE.Material ? colour : new THREE.MeshToonMaterial({ color: colour, ...opts });
  const m = new THREE.Mesh(chugGeo, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z);
  g.add(m);
  if (!opts.transparent) {
    const ink = new THREE.Mesh(chugGeo, INK_MAT);
    ink.scale.set(w + 0.008, h + 0.008, d + 0.008); ink.position.copy(m.position);
    g.add(ink);
  }
  return m;
}
/* The mug: the handle at the origin (in the fist), the body out along +x,
   its mouth up +y. `beer` is the fill (scaled down as it's drunk). */
/* The stein (user, 2026-10-23: the boxy one didn't read as a mug): a round,
   thick-walled glass with the amber beer showing through, a heavy base, a
   foam head swelling over the rim with a drip down the side, and a chunky
   D-handle, inked. The handle's grip at the origin (in the fist), the
   glass out along +x, its mouth up +y. `beer` is the fill (its height is
   scaled as it's drunk, from the floor of the glass up). */
const MUG = { r: 0.05, h: 0.15, base: 0.018, handle: 0.038 };
let mugParts = null;
function makeMug() {
  if (!mugParts) {
    const cyl = (rt, rb, h) => new THREE.CylinderGeometry(rt, rb, h, 18);
    mugParts = {
      wall: cyl(MUG.r, MUG.r * 0.96, MUG.h), base: cyl(MUG.r * 0.97, MUG.r, MUG.base),
      beer: cyl(MUG.r * 0.86, MUG.r * 0.82, 1).translate(0, 0.5, 0),
      foam: cyl(MUG.r * 1.03, MUG.r * 0.9, 0.03), bubble: new THREE.SphereGeometry(1, 12, 8),
      handle: new THREE.TorusGeometry(MUG.handle, 0.011, 8, 16, PI),
      glass: new THREE.MeshToonMaterial({ color: CHUG_COLOURS.glass, transparent: true, opacity: 0.18, depthWrite: false }),
      glassSolid: new THREE.MeshToonMaterial({ color: 0xc6e2e6 }),
      beerMat: new THREE.MeshToonMaterial({ color: 0xc8780a, emissive: 0x6a3000 }),
      foamMat: new THREE.MeshToonMaterial({ color: CHUG_COLOURS.foam }),
    };
    for (const o of Object.values(mugParts)) o.userData.shared = true;
  }
  const P = mugParts, g = new THREE.Group(), X = MUG.r + MUG.handle * 0.95;
  const add = (geo, mat, x, y, ink = 1.07, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    if (ink) { const o = new THREE.Mesh(geo, INK_MAT); o.position.copy(m.position); o.scale.setScalar(ink); g.add(o); m.userData.ink = o; }
    return m;
  };
  const floor = -MUG.h / 2 + MUG.base;
  g.userData.beer = add(P.beer, P.beerMat, X, floor, 0);
  g.userData.beerFloor = floor;
  g.userData.beerFull = MUG.h - MUG.base - 0.012;
  add(P.wall, P.glass, X, 0, 1.06);
  add(P.base, P.glassSolid, X, -MUG.h / 2 + MUG.base / 2, 1.08);
  // the head: a cap over the rim, froth swelling up and a drip down the side
  const foam = new THREE.Group();
  const cap = new THREE.Mesh(P.foam, P.foamMat); foam.add(cap);
  const capInk = new THREE.Mesh(P.foam, INK_MAT); capInk.scale.setScalar(1.08); foam.add(capInk);
  for (const [x, y, z, r] of [[0.012, 0.018, 0.008, 0.026], [-0.016, 0.016, -0.01, 0.022], [0.004, 0.024, -0.016, 0.02], [-0.006, 0.014, 0.02, 0.018]]) {
    const b = new THREE.Mesh(P.bubble, P.foamMat); b.position.set(x, y, z); b.scale.setScalar(r); foam.add(b);
  }
  const drip = new THREE.Mesh(P.bubble, P.foamMat); drip.position.set(MUG.r * 0.7, -0.03, MUG.r * 0.72); drip.scale.set(0.011, 0.03, 0.011); foam.add(drip);
  foam.position.set(X, MUG.h / 2 + 0.006, 0);
  g.add(foam);
  g.userData.foam = foam;
  // the D-handle: a half ring off the glass's side, its middle in the fist
  const h = add(P.handle, P.glassSolid, X - MUG.r, 0, 0);
  h.rotation.z = PI / 2;
  const hInk = new THREE.Mesh(P.handle, INK_MAT); hInk.position.copy(h.position); hInk.rotation.copy(h.rotation); hInk.scale.set(1.04, 1.04, 1.6); g.add(hInk);
  return g;
}
/* The smash: amber glass shards and foam, thrown out from where it lands. */
function chugSmash() {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const foam = i % 3 === 2;
    const m = new THREE.Mesh(foam ? _smokeGeo : (chugGeo ||= Object.assign(new THREE.BoxGeometry(1, 1, 1), { userData: { shared: true } })),
      new THREE.MeshBasicMaterial({ color: foam ? CHUG_COLOURS.foam : i % 2 ? CHUG_COLOURS.glass : CHUG_COLOURS.beer, transparent: true, depthWrite: false }));
    const a = (i / 9) * PI * 2 + 0.4;
    m.userData.dir = new THREE.Vector3(Math.cos(a), 0.9 + (i % 4) * 0.35, Math.sin(a));
    g.add(m);
  }
  return g;
}
const _chT = new THREE.Vector3(), _chL = new THREE.Vector3(), _chA = new THREE.Vector3(), _chB = new THREE.Vector3();
const _chPoleR = new THREE.Vector3(1, -0.6, 0.3), _chPoleL = new THREE.Vector3(-1, -0.6, 0.3), _chPoleUp = new THREE.Vector3(1, 0.2, 0.6), _chPoleUpL = new THREE.Vector3(-1, 0.2, 0.6);
/* Where the mug sits at the lips (world space, into _lipPos/_lipQuat: its
   origin is the handle's grip): its mouth on the trollface's mouth, its
   axis tipped `tilt` radians back from the head's up towards the face (0
   upright, PI/2 lying level, more and the base is above the rim), the
   glass across the front of the face and the handle out to the right. */
const _lipPos = new THREE.Vector3(), _lipQuat = new THREE.Quaternion(), _lipA = new THREE.Vector3(), _lipB = new THREE.Vector3();
const _lipQA = new THREE.Quaternion(), _lipQB = new THREE.Quaternion(), _lipS = new THREE.Vector3(), _lipM = new THREE.Matrix4();
const _lipUp = new THREE.Vector3(), _lipFwd = new THREE.Vector3(), _lipX = new THREE.Vector3(), _lipY = new THREE.Vector3(), _lipZ = new THREE.Vector3();
function chugLipPose(rig, side, size, tilt) {
  const head = rig.parts.head, g = head.geometry.parameters;
  rig.root.updateMatrixWorld(true);
  head.matrixWorld.decompose(_lipA, _lipQA, _lipS);
  // the mouth: low on the grin, just off the front of the head
  _lipB.set(0, -0.5 * g.height / 2, (g.depth || 0) / 2);
  head.localToWorld(_lipB);
  _lipUp.set(0, 1, 0).applyQuaternion(_lipQA);
  _lipFwd.set(0, 0, 1).applyQuaternion(_lipQA);
  _lipB.addScaledVector(_lipFwd, 0.02 * size);
  // the mug's own axes: up (base to rim) tipped towards the face, across
  // (handle to glass) from the right cheek to the left
  _lipY.copy(_lipUp).multiplyScalar(Math.cos(tilt)).addScaledVector(_lipFwd, -Math.sin(tilt));
  _lipX.set(-side, 0, 0).applyQuaternion(_lipQA);
  _lipZ.crossVectors(_lipX, _lipY);
  _lipM.makeBasis(_lipX, _lipY, _lipZ);
  _lipQuat.setFromRotationMatrix(_lipM);
  // the rim's middle on the mouth: back from it to the grip
  _lipA.set(MUG.r + MUG.handle * 0.95, MUG.h / 2, 0).multiplyScalar(size).applyQuaternion(_lipQuat);
  _lipPos.copy(_lipB).sub(_lipA);
}
function poseChug(rig, t) {
  const p = rig.parts, s = rig.scale, w = rig.blocky ? 1.35 : 1;
  base(rig);
  const side = p.headPivot.scale.x < 0 ? -1 : 1;
  // the drink: up to the lips, held there through the gulps
  const lift = env(t, 0.1, 0.5, 2.4, 2.75);
  const atMouth = env(t, 0.4, 0.7, 2.35, 2.6);
  const gulp = CHUG.gulps.reduce((m, [a, b]) => Math.max(m, env(t, a, a + 0.12, b - 0.15, b)), 0);
  const drunk = clamp01((t - CHUG.gulps[0][0]) / (CHUG.gulps[2][1] - CHUG.gulps[0][0]));
  // the wipe, the hype, the wind-up, the throw and the follow-through
  const wipe = env(t, 2.45, 2.65, 2.8, 3.0);
  const hype = env(t, 2.85, 3.1, 4.0, 4.2);
  const wind = env(t, 4.0, 4.45, 4.55, 4.7);
  const thrown = t >= CHUG.release;
  const follow = env(t, 4.6, 4.75, 4.95, 5.3);
  const cheer = env(t, 5.2, 5.5, 5.95, 6.2);
  const hops = [[3.0, 3.38], [3.45, 3.83]].reduce((m, [a, b]) => Math.max(m, t > a && t < b ? Math.sin(((t - a) / (b - a)) * PI) : 0), 0);
  const shake = hype * Math.sin(t * 16);
  // body: lean back to drink, bounce on the hops, coil and uncoil for the throw
  p.hips.position.y = rig.hipY + hops * 0.24 * s;
  p.legL.rotation.x = 0.55 * hops; p.legR.rotation.x = 0.45 * hops;
  p.kneeL.rotation.x = -1.0 * hops; p.kneeR.rotation.x = -0.9 * hops;
  p.torso.rotation.x = -0.14 * atMouth - 0.08 * hype - 0.1 * wind + 0.28 * follow - 0.06 * cheer;
  p.torso.rotation.y = 0.45 * wind - 0.4 * follow;
  head(rig, 0.55 * atMouth + 0.12 * gulp + 0.25 * hype + 0.3 * cheer, 0.35 * shake + 0.3 * wind, 0.15 * shake);
  // At the lips the mug is placed off the face, not the fist: the rim on
  // the mouth, the glass out in front of the face with its handle at the
  // right cheek, tipped back further on each gulp so the base swings up and
  // out (user, 2026-10-23: "the way the mug is poured to the mouth" was
  // off). The fist goes to that handle.
  const mugSize = s * (rig.blocky ? 1.6 : 1.2);
  if (atMouth > 0) chugLipPose(rig, side, mugSize * p.wristR.parent.getWorldScale(_chB).x, 0.95 + 0.95 * drunk + 0.12 * gulp);
  // the right hand: hanging -> chest -> lips -> overhead -> behind the head -> out ahead
  _chT.set(0.3 * s, -0.62 * s, 0.02 * s);
  _chT.lerp(_chA.set(0.14 * w * s, -0.3 * s, -0.3 * s), lift);
  if (atMouth > 0) _chT.lerp(p.chest.worldToLocal(_chB.copy(_lipPos)), atMouth);
  _chT.lerp(_chA.set(0.22 * w * s, (0.62 + 0.06 * Math.sin(t * 16)) * s, -0.06 * s), hype);
  _chT.lerp(_chA.set(0.3 * w * s, 0.42 * s, 0.3 * s), wind);
  _chT.lerp(_chA.set(0.12 * w * s, -0.1 * s, -0.6 * s), follow);
  _chT.lerp(_chA.set(0.26 * w * s, 0.62 * s, -0.08 * s), cheer);
  reachHand(rig, 1, _chT, hype + wind + cheer > 0.4 ? _chPoleUp : _chPoleR);
  setHandPose(rig, 1, !thrown && lift + hype + wind > 0.2 ? "fist" : cheer > 0.4 ? "fist" : "open");
  // the left hand: the back of it across the mouth, then fist pumps up high
  _chL.set(-0.3 * s, -0.62 * s, 0.02 * s);
  if (wipe > 0) _chL.lerp(facePoint(rig, -0.05 * side + 0.25 * side * (wipe - 0.5), -0.55, 0.16 * s), wipe);
  const pump = 0.5 + 0.5 * Math.sin((t - 3.0) * 13);
  _chL.lerp(_chA.set(-0.24 * w * s, (0.38 + 0.24 * pump) * s, -0.06 * s), hype);
  _chL.lerp(_chA.set(-0.26 * w * s, 0.62 * s, -0.08 * s), cheer);
  reachHand(rig, -1, _chL, hype + cheer > 0.4 ? _chPoleUpL : _chPoleL);
  setHandPose(rig, -1, wipe > 0.3 || hype + cheer > 0.3 ? "fist" : "open");
  // the mug in the fist: upright, tipped to the lips on the gulps
  const handPt = p.wristR.parent;
  const mug = emoteBit(rig, "chugMug", handPt, makeMug);
  mug.visible = t >= 0.15 && !thrown;
  mug.position.set(0, 0, 0);
  mug.rotation.set(...CHUG.upright);
  mug.scale.setScalar(mugSize);
  if (atMouth > 0) {
    // blended from riding the fist to its place at the lips (world space,
    // then back into the hand's own space)
    rig.root.updateMatrixWorld(true);
    mug.updateMatrixWorld(true);
    mug.matrixWorld.decompose(_lipA, _lipQA, _lipS);
    _lipA.lerp(_lipPos, atMouth);
    _lipQA.slerp(_lipQuat, atMouth);
    handPt.matrixWorld.decompose(_lipB, _lipQB, _lipS);
    mug.position.copy(handPt.worldToLocal(_lipA));
    mug.quaternion.copy(_lipQB.invert().multiply(_lipQA));
  }
  mug.userData.beer.scale.y = mug.userData.beerFull * Math.max(0.06, 1 - drunk);
  mug.userData.foam.visible = drunk < 0.85;
  mug.userData.foam.position.y = mug.userData.beerFloor + mug.userData.beer.scale.y + 0.006;
  // the throw: out of the hand, tumbling end over end along an arc
  const fly = emoteBit(rig, "chugFly", rig.root, makeMug);
  const k = (t - CHUG.release) / (CHUG.land - CHUG.release);
  fly.visible = k >= 0 && k < 1;
  if (fly.visible) {
    const F = CHUG.fly;
    _chA.set(F.from[0] * w, F.from[1], F.from[2]).multiplyScalar(s);
    _chB.set(F.to[0] * w, F.to[1], F.to[2]).multiplyScalar(s);
    fly.position.lerpVectors(_chA, _chB, k);
    fly.position.y += Math.sin(k * PI) * F.peak * s - k * k * 0.0;
    fly.rotation.set(-k * PI * 3, 0.6, k * 1.2);
    fly.scale.setScalar(s * (rig.blocky ? 1.6 : 1.2));
    fly.userData.beer.scale.y = 0.006; fly.userData.foam.visible = false;
  }
  // the smash
  const smash = emoteBit(rig, "chugSmash", rig.root, chugSmash);
  const u = (t - CHUG.land) / 0.6;
  smash.visible = u >= 0 && u < 1;
  if (smash.visible) {
    const F = CHUG.fly;
    smash.position.set(F.to[0] * w * s, F.to[1] * s, F.to[2] * s);
    smash.children.forEach((m, i) => {
      const d = m.userData.dir, r = (0.2 + 0.8 * u) * s;
      m.position.set(d.x * r, Math.max(0, d.y * u * 0.7 - 1.6 * u * u) * s, d.z * r);
      const big = m.geometry === _smokeGeo ? (0.07 + 0.16 * u) : 0.055 * (1 - 0.4 * u);
      m.scale.setScalar(big * s);
      m.rotation.set(u * 9 + i, u * 7, 0);
      m.material.opacity = 1 - u * u;
    });
  }
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
  { id: "cigar", name: "Cigar", kind: "tp", pose: poseCigar, seconds: LIGHT.seconds, token: 1272, icon: CIGAR_ICON },
  { id: "chug", name: "Chug", kind: "tp", pose: poseChug, seconds: CHUG.seconds },
  { id: "blunt", name: "Blunt", kind: "tp", pose: poseBlunt, seconds: LIGHT.seconds, token: 1272, icon: BLUNT_ICON },
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
