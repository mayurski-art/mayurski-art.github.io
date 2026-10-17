// Grin Sabers — saber poses and swing paths.
//
// A pose says where the sword hand is and which way the blade points, in
// the fighter's CHEST space (+x right, +y up, -z forward, metres at the
// stock 1.8 m height), plus how far the spine turns (`twist`, + = toward the
// left) and leans (`lean`, + = forward). Both hands go on the hilt: the
// right at the grip, the left a hand's width toward the pommel.
//
// A swing is three key poses: cocked (end of the windup), contact (blade
// through the middle of the target) and follow-through. Directions are named
// from the ATTACKER's side the blade starts on: "R" comes from their right
// (it arrives on the defender's left), "L" from their left, "O" overhead,
// "T" a thrust.

import * as THREE from "three";

const P = (g, d, twist = 0, lean = 0) => ({ g: new THREE.Vector3(...g), d: new THREE.Vector3(...d).normalize(), twist, lean });

export const SWING_DIRS = ["R", "L", "O", "T"];

export const SWINGS = {
  // Windups keep the fists beside or above the head, never over the face.
  R: [P([0.34, 0.12, 0.0], [0.55, 0.55, 0.62], -0.6, -0.05), P([0.02, -0.10, -0.47], [-0.18, 0.22, -0.95], 0.1, 0.12), P([-0.26, -0.22, -0.30], [-0.85, -0.2, -0.45], 0.6, 0.1)],
  L: [P([-0.34, 0.08, -0.06], [-0.6, 0.55, 0.55], 0.55, -0.05), P([0.06, -0.10, -0.47], [0.18, 0.22, -0.95], -0.1, 0.12), P([0.30, -0.20, -0.28], [0.85, -0.15, -0.45], -0.55, 0.1)],
  O: [P([0.06, 0.6, 0.04], [0.05, 0.45, 0.89], -0.15, -0.18), P([0.04, 0.0, -0.48], [0, 0.35, -0.94], 0, 0.18), P([0.02, -0.32, -0.38], [0, -0.75, -0.65], 0, 0.32)],
  T: [P([0.18, -0.18, -0.02], [0.05, 0.08, -1], -0.45, -0.05), P([0.06, -0.10, -0.58], [0, 0.04, -1], 0.1, 0.22), P([0.04, -0.10, -0.62], [0, 0.02, -1], 0.15, 0.26)],
};

// The ready stance: both fists in close in front of the belly, on the
// centre line, blade up and forward at the opponent's face.
export const READY = P([0.04, -0.42, -0.26], [-0.05, 0.72, -0.69]);

/* Guard poses, by the side the swing ARRIVES on in the defender's view. */
export const GUARD_ZONES = ["left", "right", "high", "mid"];
export const GUARDS = {
  left: P([-0.16, -0.08, -0.36], [0.12, 0.97, -0.2], 0.3),
  right: P([0.26, -0.08, -0.36], [-0.1, 0.97, -0.2], -0.3),
  high: P([0.2, 0.46, -0.2], [-0.97, 0.08, -0.22], 0, -0.05),   // flat over the head, the face left clear
  mid: P([0.06, -0.18, -0.44], [-0.62, 0.62, -0.48], 0, 0.05),
};

// Running: the blade trailed low behind, out of the way of the legs.
export const RUN = P([0.26, -0.48, -0.06], [0.35, -0.3, 0.88], -0.15, 0.1);

export const STAGGER = P([0.28, -0.34, -0.12], [0.5, 0.45, 0.35], -0.35, -0.3);
export const CLASH = P([0.04, 0.02, -0.5], [-0.25, 0.75, -0.6], 0.15, 0.28);

/* Which defender guard zone meets a swing direction. */
export function zoneFor(dir) {
  return dir === "R" ? "left" : dir === "L" ? "right" : dir === "O" ? "high" : "mid";
}

/* The guard zone an aim (x -1..1 left..right, y -1..1 low..high) picks. */
export function zoneFromAim(x, y) {
  if (y > 0.45 && y >= Math.abs(x)) return "high";
  if (Math.abs(x) > 0.3) return x < 0 ? "left" : "right";
  return "mid";
}

export const smooth = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };

export function copyPose(out, a) {
  out.g.copy(a.g); out.d.copy(a.d); out.twist = a.twist; out.lean = a.lean;
  return out;
}

export function lerpPose(out, a, b, k) {
  out.g.lerpVectors(a.g, b.g, k);
  out.d.lerpVectors(a.d, b.d, k).normalize();
  out.twist = a.twist + (b.twist - a.twist) * k;
  out.lean = a.lean + (b.lean - a.lean) * k;
  return out;
}

export function newPose() { return { g: new THREE.Vector3(), d: new THREE.Vector3(0, 1, 0), twist: 0, lean: 0 }; }

/* The strike's path at s 0..1 through cocked -> contact -> follow-through.
   The blade speeds up into contact and slows out of it. */
export function strikePose(out, dir, s) {
  const k = SWINGS[dir];
  const e = smooth(s);
  if (e < 0.5) return lerpPose(out, k[0], k[1], e * 2);
  return lerpPose(out, k[1], k[2], (e - 0.5) * 2);
}

/* Mirror a pose left-right (a left-handed fighter, later). */
export function mirrorPose(out, a) {
  copyPose(out, a);
  out.g.x = -out.g.x; out.d.x = -out.d.x; out.twist = -out.twist;
  return out;
}

