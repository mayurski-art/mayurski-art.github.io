// The bolt rifles' bolts in your hands (weapon-snipers.js builds them with
// a userData.boltAction { bolt, knob, restZ, travel, hand, handRest }):
// after every shot the trigger hand leaves the grip for the knob, the
// handle lifts, the bolt rakes back and rides home, the handle drops and
// the hand goes back to the grip. The gun rolls its right side up toward
// you for the cycle. An empty reload works it once more to chamber the
// fresh mag. Scoped, the gun comes partly down out of the scope for the
// cycle (weapons.js BOLT_ADS) so all of this is seen.

import * as THREE from "three";
import { smoothstep } from "../characters/anim-curves.js?v=or1";

const LIFT = 1.05;                       // handle swing up, radians about the bore
// Beats of one cycle as fractions of it: [start, end] of each move.
const UP = [0.12, 0.26], BACK = [0.28, 0.5], HOME = [0.56, 0.76], DOWN = [0.78, 0.9];
const REACH = [0, 0.12], LETGO = [0.9, 1];   // the trigger hand to the knob and back
const ROLL_IN = [0.04, 0.22], ROLL_OUT = [0.8, 0.96];
const CHAMBER_AT = 0.72;                 // empty reload: the cycle runs from here to the end

// The gun through the cycle: rolled right side up (+ = top toward the
// left), muzzle up a touch, and pulled into the shoulder as the bolt rakes.
const ROLL = 0.24, PITCH = 0.05, RAKE_Z = 0.012, RAKE_PITCH = 0.025;
// The hand on the knob: from the knob, out to the right and behind it so
// the fingers close round it; turned so the fist faces up the handle.
const HAND_AT = new THREE.Vector3(0.006, -0.004, 0.008);
const HAND_TURN = new THREE.Euler(0.9, 0.35, -0.7);

const span = (t, [a, b]) => smoothstep(Math.min(1, Math.max(0, (t - a) / (b - a))));
const BEATS = [["lift", UP[0]], ["back", BACK[0]], ["home", HOME[0]], ["lock", DOWN[1] - 0.02]];
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const _knob = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();

/* Where the cycle is, 0..1, or -1 when the bolt is at rest. */
function cycleT(w, magT) {
  if (magT >= 0) return w.reloadWasEmpty && magT >= CHAMBER_AT ? (magT - CHAMBER_AT) / (1 - CHAMBER_AT) : -1;
  if (w.pumpT > 0 && w.pumpDur > 0 && w.def.fireMode === "bolt") return 1 - w.pumpT / w.pumpDur;
  return -1;
}

const _pose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, hold: 0 };
/* The gun's own move through the cycle, added into the reload/action
   layer by weapon-view.js before the gun is placed. */
export function boltGunPose(mesh, w, magT) {
  const p = _pose;
  p.x = p.y = p.z = p.pitch = p.yaw = p.roll = p.hold = 0;
  if (!mesh?.userData.boltAction) return p;
  const t = cycleT(w, magT);
  if (t < 0) return p;
  const hold = span(t, ROLL_IN) - span(t, ROLL_OUT);
  const rake = span(t, BACK) - span(t, HOME);
  p.roll = hold * ROLL;
  p.pitch = hold * PITCH + rake * RAKE_PITCH;
  p.z = rake * RAKE_Z;
  p.hold = hold;
  return p;
}

// Where the bolt is brought for the cycle, in the weapon camera's space
// (it looks down -Z): a little right of centre and low, so the hand on it
// is in frame. A bullpup's bolt sits back by the cheek, a rifle's ahead of
// the grip; either way the gun is moved to put it here.
const BOLT_VIEW = new THREE.Vector3(0.1, -0.09, -0.42);
const _bk = new THREE.Vector3();

/* After the gun is placed: slide it so its bolt sits at BOLT_VIEW, by
   `hold` (boltGunPose). */
export function frameBolt(mesh, hold) {
  const a = mesh?.userData.boltAction;
  if (!a || !(hold > 0)) return;
  mesh.updateMatrix();
  _bk.copy(a.knob.position).add(a.bolt.position).setZ(a.restZ + a.knob.position.z).applyMatrix4(mesh.matrix);
  mesh.position.addScaledVector(_bk.sub(BOLT_VIEW).negate(), hold);
}

/* Called each frame after the gun is posed. `magT` is the reload's
   progress (-1 when not reloading). Returns the beat ("lift" | "back" |
   "home" | "lock") crossed this frame, if any, so the caller can play it. */
export function placeBolt(mesh, w, magT) {
  const a = mesh?.userData.boltAction;
  if (!a) return null;
  const t = cycleT(w, magT);
  const lift = t < 0 ? 0 : span(t, UP) - span(t, DOWN);
  const back = t < 0 ? 0 : span(t, BACK) - span(t, HOME);
  a.bolt.rotation.z = lift * LIFT;
  a.bolt.position.z = a.restZ + back * a.travel;
  // The trigger hand rides the knob (the arm follows the hand: posePfArms).
  if (a.hand) {
    const reach = t < 0 ? 0 : span(t, REACH) - span(t, LETGO);
    _knob.copy(a.knob.position).applyAxisAngle(Z_AXIS, a.bolt.rotation.z).add(a.bolt.position).add(HAND_AT);
    a.hand.position.lerpVectors(a.handRest.position, _knob, reach);
    _qa.copy(a.handRest.quaternion);
    _qb.setFromEuler(HAND_TURN);
    a.hand.quaternion.slerpQuaternions(_qa, _qb, reach);
  }
  let beat = null;
  const prev = a.lastT ?? -1;
  if (t >= 0) for (const [name, at] of BEATS) if (prev < at && t >= at) beat = name;
  a.lastT = t;
  return beat;
}
