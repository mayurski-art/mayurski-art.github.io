// Troll Royale — the jump out of the C-130 (docs/ROYALE-EXIT.md): the
// show's clock and the body's poses, on any rig (you, bots, peers).
//
//   0   .. 0.3  leap: off the lip, chest open, arms flung out wide
//   0.3 .. 1.9  spin: arms still wide, turning flat about the belly
//   1.9 .. 3.3  tuck: still turning, slowing; the hands come in to the
//               middle of the chest
//   3.3 .. 4.2  dive: head down, legs together, then easing into the
//               belly-down spread you fly in
// Those are DISPLAY seconds: exitClock() slows real time to 0.3x for the
// look back at the plane (real 0.3 .. 1.6) and catches up by real 2.6, the
// same on every client, so a peer sees your spin slow as you do.

import * as THREE from "three";
import { reachHand } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";

export const EXIT = {
  leap: 0.3,          // display s: arms out by here
  tuck: 1.9,          // the hands start in
  dive: 3.3,          // head down; the stick's yours again (real s too: the clock has caught up)
  show: 4.2,          // into the flying pose
  turns: 2,           // whole turns of the spin, leap to dive
  slow: [0.3, 1.6],   // real s at SLOW_RATE: the look back
  rate: 0.3,
  caught: 2.6,        // real s: the display clock is back on time
};
const BELLY = -1.35;  // the belly-down flying pitch (remote-players.js poseDrop)
const PIVOT = 1.0;    // turn about the belly, not the feet

/* Real seconds since the lip -> display seconds. */
export function exitClock(r) {
  const [a, b] = EXIT.slow, c = EXIT.caught;
  if (r <= a) return Math.max(0, r);
  const atB = a + (b - a) * EXIT.rate;
  if (r <= b) return a + (r - a) * EXIT.rate;
  if (r >= c) return r;
  // Hermite from (b, atB, slope rate) to (c, c, slope 1): no jump, no stall.
  const w = c - b, u = (r - b) / w, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * atB + (u3 - 2 * u2 + u) * EXIT.rate * w + (-2 * u3 + 3 * u2) * c + (u3 - u2) * w;
}
/* How fast the display clock runs at real `r` (your fall steps by it). */
export function exitRate(r) {
  const h = 1e-3;
  return (exitClock(r + h) - exitClock(Math.max(0, r - h))) / (r > h ? 2 * h : r + h);
}
/* In the slow-mo stretch, 0..1..0 (the vignette, the wind's dip). */
export function exitSlowK(r) {
  const [a, b] = EXIT.slow;
  return sm(a - 0.1, a + 0.2, r) * (1 - sm(b - 0.1, EXIT.caught - 0.3, r));
}

const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* The spin: fast off the lip, slowing to a stop at the dive (ease-out). */
function spinAngle(d) {
  const k = Math.min(1, Math.max(0, (d - EXIT.leap * 0.5) / (EXIT.dive - EXIT.leap * 0.5)));
  return EXIT.turns * 2 * Math.PI * (1 - (1 - k) * (1 - k));
}
/* Pitch of the body (negative leans forward): a lean off the lip, flat in
   the spin, head down in the dive, then the belly-down arch. */
function pitchAt(d) {
  if (d < EXIT.tuck) return lerp(-0.3, -1.15, sm(0, EXIT.tuck, d));
  if (d < EXIT.dive) return -1.15;
  const down = sm(EXIT.dive, EXIT.dive + 0.45, d) * (1 - sm(EXIT.dive + 0.45, EXIT.show, d));
  return lerp(lerp(-1.15, BELLY, sm(EXIT.dive + 0.45, EXIT.show, d)), -2.15, down);
}

const _ax = new THREE.Vector3(), _qa = new THREE.Quaternion();
/* The body's turn at display `d`: out of the plane facing `outYaw`, and by
   the end of the show facing `liveYaw` (where you fly). */
export function exitQuat(d, outYaw, liveYaw, out) {
  let yaw = outYaw + spinAngle(d);   // whole turns: back to outYaw at the dive
  if (d > EXIT.dive) yaw = outYaw + wrap(liveYaw - outYaw) * sm(EXIT.dive, EXIT.show, d);
  out.setFromAxisAngle(_ax.set(0, 1, 0), yaw);
  return out.multiply(_qa.setFromAxisAngle(_ax.set(1, 0, 0), pitchAt(d)));
}

/* Hands at the middle of the chest (chest space; forward is -z), the
   elbows out to the sides. */
const _hand = new THREE.Vector3(), _pole = new THREE.Vector3();
const _sL = new THREE.Quaternion(), _sR = new THREE.Quaternion(), _eL = new THREE.Quaternion(), _eR = new THREE.Quaternion();
function handsToChest(rig, k) {
  const p = rig.parts, s = rig.scale || 1;
  if (k <= 0) return;
  _sL.copy(p.armL.quaternion); _sR.copy(p.armR.quaternion);
  _eL.copy(p.elbowL.quaternion); _eR.copy(p.elbowR.quaternion);
  for (const side of [-1, 1]) {
    reachHand(rig, side, _hand.set(side * 0.045, -0.06, -0.2).multiplyScalar(s), _pole.set(side, -0.45, 0.35));
  }
  for (const [j, from] of [[p.armL, _sL], [p.armR, _sR], [p.elbowL, _eL], [p.elbowR, _eR]]) {
    _qt.copy(j.quaternion);
    j.quaternion.slerpQuaternions(from, _qt, k);
  }
}
const _qt = new THREE.Quaternion();

/* The arms flung wide: straight out to the sides, a touch under level and
   a little forward; `f` a flutter in the wind. (At rest the arms hang 26°
   out from straight down; -z takes the left one out, +z the right.) */
function armsWide(p, open, f) {
  p.armL.rotation.set(lerp(0.15, 0.25 + f, open), 0, lerp(0, -1.05 + f, open));
  p.armR.rotation.set(lerp(0.15, 0.25 - f, open), 0, lerp(0, 1.05 - f, open));
  p.elbowL.rotation.set(lerp(0.5, 0.12, open), 0, 0);
  p.elbowR.rotation.set(lerp(0.5, 0.12, open), 0, 0);
}

/* Pose `rig` at display `d` of the show. Call after the rig's root is at
   the feet (it turns about the belly). `t` real seconds, for the flutter. */
export function poseExit(rig, d, outYaw, liveYaw, t = d) {
  const p = rig.parts, root = rig.root;
  exitQuat(d, outYaw, liveYaw, root.quaternion);
  _ax.set(0, PIVOT, 0);
  root.position.add(_ax).sub(_ax.applyQuaternion(root.quaternion));
  const f = Math.sin(t * 11) * 0.06, f2 = Math.sin(t * 7.3 + 1) * 0.05;
  const open = sm(0, EXIT.leap, d);
  const tuck = sm(EXIT.tuck, EXIT.dive - 0.1, d);
  const fly = sm(EXIT.dive + 0.45, EXIT.show, d);   // into the belly-down spread
  const together = sm(EXIT.tuck + 0.4, EXIT.dive, d) * (1 - fly);
  // Chest open off the lip, arched in the spin, tucked round the hands.
  p.chest.rotation.set(lerp(-0.2, 0.12, tuck) * (1 - fly) + -0.25 * fly, 0, 0);
  armsWide(p, open, f * (1 - tuck));
  handsToChest(rig, tuck * (1 - fly));
  if (fly > 0) {
    // The flying spread (poseDrop's DROP_FALL arms) takes over.
    blendTo(p.armL, 1.1 + f, 0, 1.2, fly);
    blendTo(p.armR, 1.1 - f, 0, -1.2, fly);
    blendTo(p.elbowL, 0.8, 0, 0, fly);
    blendTo(p.elbowR, 0.8, 0, 0, fly);
  }
  // Legs: one trailing off the lip, apart in the spin, together in the dive.
  const trail = 1 - sm(0.05, EXIT.leap + 0.3, d);
  const spread = (1 - together) * (1 - trail);
  p.legL.rotation.set(lerp(-0.2, -0.55, trail) + f2 * spread, 0, 0.32 * spread + 0.04);
  p.legR.rotation.set(lerp(-0.2, 0.35, trail) - f2 * spread, 0, -0.32 * spread - 0.04);
  p.kneeL.rotation.set(lerp(lerp(-0.6, -0.12, together), -0.9, trail), 0, 0);
  p.kneeR.rotation.set(lerp(-0.6, -0.12, together) * (1 - trail) + -0.25 * trail, 0, 0);
  p.ankleL.rotation.set(0.5 * together, 0, 0);
  p.ankleR.rotation.set(0.5 * together, 0, 0);
  if (fly > 0) {
    blendTo(p.legL, -0.2, 0, 0.3 + f2, fly);
    blendTo(p.legR, -0.2, 0, -0.3 - f2, fly);
    blendTo(p.kneeL, -0.9, 0, 0, fly);
    blendTo(p.kneeR, -0.9, 0, 0, fly);
  }
}
const _qb = new THREE.Quaternion(), _eu = new THREE.Euler();
function blendTo(j, x, y, z, k) {
  _qb.setFromEuler(_eu.set(x, y, z, j.rotation.order));
  j.quaternion.slerp(_qb, k);
}

/* In the air after the show: diving (looking down, pushing on) tucks the
   hands to the chest, straightens the legs and tips the head further down.
   `k` 0 flying .. 1 diving. Call after poseDrop's belly-down pose. */
export function poseDiveTuck(rig, k) {
  if (k <= 0.01) return;
  const p = rig.parts, root = rig.root;
  // Tip further over about the belly: undo the belly pivot, pitch, redo.
  _ax.set(0, PIVOT, 0).applyQuaternion(root.quaternion);
  root.position.add(_ax);
  root.rotation.x = lerp(BELLY, -2.0, k);
  root.position.sub(_ax.set(0, PIVOT, 0).applyQuaternion(root.quaternion));
  handsToChest(rig, k);
  blendTo(p.chest, 0.1, 0, 0, k);
  blendTo(p.legL, -0.05, 0, 0.04, k);
  blendTo(p.legR, -0.05, 0, -0.04, k);
  blendTo(p.kneeL, -0.1, 0, 0, k);
  blendTo(p.kneeR, -0.1, 0, 0, k);
  blendTo(p.ankleL, 0.5, 0, 0, k);
  blendTo(p.ankleR, 0.5, 0, 0, k);
}

/* The diving amount from how fast someone is coming down (m/s): flying
   falls at ~32-42, a dive at 60. */
export const diveFromSink = (sink) => sm(46, 56, sink);
