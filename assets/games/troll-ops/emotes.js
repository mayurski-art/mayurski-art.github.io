// Troll Forces — the emotes.
//
// Three kinds (the emote wheel tags them):
//   tp   third person: the camera pulls out and your whole body plays it
//   fp   first person: you stay in your own eyes and see your hands do it
//        (`fp(t)` gives hand targets and camera motion for game.js); other
//        players see the body version (`pose`)
//   duo  two teammates: aim at one, pick it, they hold X to accept, both
//        snap face to face `dist` apart and play their half (`pose[0]` for
//        whoever invited, `pose[1]` for whoever accepted)
//
// Everyone else sees an emote from one number on the state packet (`em`):
// the list index + 1, plus 64 for the second half of a duo. `seconds` is how
// long it plays; the dances loop until you move.
//
// Arm angles follow character.js: positive x raises an arm forward, positive
// z swings the left arm out (the right arm out is negative z).

import { DANCES, setHandPose } from "./character.js?v=to-2h1";

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

/* ------------------------------------------------ first person, body side */

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
  return { R: null, L: null, gun: { spin: turn, lift: 0.05 * up }, cam: { pitch: 0, yaw: 0 } };
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

/* The disco groove, mirrored on the partner so it reads as dancing together. */
function duoDanceLead(rig, t) { DANCES[0](rig, t); }
function duoDancePartner(rig, t) {
  DANCES[0](rig, t + 0.28);
  const p = rig.parts;
  p.hips.rotation.z *= -1; p.torso.rotation.z *= -1; p.chest.rotation.z *= -1;
  done(rig);
}

/* ---------------------------------------------------------------- list */

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
  fn(rig, t);
  return true;
}

/* Finger shapes the first-person emotes need, merged into hand-model.js's
   HAND_POSES by game.js (same format: per-finger curls, spread, thumb). */
const FIST_CURL = [1.45, 1.55, 1.0];
export const FP_HAND_POSES = {
  point: { curl: [[0.02, 0.05, 0.02], FIST_CURL, FIST_CURL, FIST_CURL], spread: 0, thumb: [0.25, 0.9, 0.5, 0.4] },
  L: { curl: [[0.0, 0.02, 0.0], FIST_CURL, FIST_CURL, FIST_CURL], spread: 0, thumb: [1.25, 0.05, 0.0, 0.0] },
  flat: { curl: [[0.03, 0.03, 0.02], [0.03, 0.03, 0.02], [0.03, 0.03, 0.02], [0.05, 0.04, 0.03]], spread: 0.04, thumb: [0.55, 0.2, 0.05, 0.05] },
};
