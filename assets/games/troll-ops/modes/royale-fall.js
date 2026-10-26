// Troll Royale — the drop cinematic, phase 3 (doc "Troll Forces: Royale
// drop cinematic"): the first FALL_SHOW s out of the plane are a camera
// show, then the freefall you know, plus a hold-to-view key.
//
//   0   .. 1.5  the tumble, first person: out backwards you go over once
//               (the hold rolls up out of sight, the plane's belly, sky)
//               and land on your back; out forwards, a head-first tip
//   1.5 .. 3    cut: from where you left the ramp, a long lens on your
//               face as you fall away on your back (framed as if from 3 m)
//   3   .. 4.5  cut: just over you, looking down into your face
//   4.5 .. 6    cut: close below, ahead of your head: your face comes
//               round into it as you roll onto your belly
//   6 on        the camera behind you; yours to fly
// Every shot is aimed at your head and framed on your face and body (user,
// 2026-10-18: "more emphasis on seeing the face and body").
//
// No steering in the show (so everyone covers the same ground before
// control starts); the pose is net/remote-players.js poseDrop's, which
// your planemates play for you too. Held after the show (crouch: C, Ctrl,
// the touch crouch button, the pad's), side, front and low angles come
// back 1.5 s each while you steer, down to 80 m. The show's fall
// builds speed slowly (Flight's `coast`), so it costs ~130 m of the ~330.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { playSfx } from "../sound/sfx-files.js?v=dc4";
import { FALL_SHOW, FALL_FLIP, fallShowQuat } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1";

export const FALL_CUTS = [FALL_FLIP, 3, 4.5];
export const VIEW_FLOOR = 80;    // m: no hold-to-view below this (the landing's always from behind)
const VIEW_EVERY = 1.5;

let show = null;
const _q = new THREE.Quaternion();
const _body = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _v = new THREE.Vector3();
const _head = new THREE.Vector3();
const _up = new THREE.Vector3();

/* Out of the plane (royale.js jumpOut): `back` whether you went out facing
   into the hold, `yaw` your facing (world), `at` where you left it and
   `vel` how fast (the plane's way). */
export function startFallShow(back, yaw, at, vel) {
  const h = Math.hypot(vel.x, vel.z) || 1;
  // The ramp shot's spot: hung in the sky where you went out, a little aft
  // and above (the planes behind come through 20 m up or down, not here).
  const exit = new THREE.Vector3(at.x - (vel.x / h) * 4, at.y + 3, at.z - (vel.z / h) * 4);
  show = { t: 0, back, yaw, exit, holdT: 0, view: -1 };
}
export function endFallShow() {
  show = null;
  if (game.camera) lens(game.camera, 1);
}
export function fallShowOn() { return !!show && show.t < FALL_SHOW; }
/* For your own body's pose (view/third-person.js): { t, back, yaw } in the
   show (the body keeps the way you went out; the look is free). */
export function fallShowPose() { return show && show.t < FALL_SHOW ? show : null; }
/* What the tests read. */
export function fallShowState() {
  return show ? { t: show.t, back: show.back, shot: shotAt(show.t), view: show.view } : null;
}
function shotAt(t) {
  if (t >= FALL_SHOW) return "behind";
  return t < FALL_CUTS[0] ? "tumble" : t < FALL_CUTS[1] ? "ramp" : t < FALL_CUTS[2] ? "face" : "low";
}

/* Each frame of the fall, before the flight steps: a whoosh on each cut.
   Returns whether the show still has the stick. The look stays yours (the
   shots don't use it): line up where you'll fly while you watch. */
export function updateFallShow(dt) {
  if (!show) return false;
  const was = show.t;
  show.t += dt;
  if (was >= FALL_SHOW) return false;
  for (const c of [...FALL_CUTS, FALL_SHOW]) if (was < c && show.t >= c && !playSfx("whoosh", { gain: 0.5 })) game.audio.swing?.();
  if (show.t >= FALL_SHOW) game.showWaveBanner("Push forward to fly — look down to dive", 1800);
  return show.t < FALL_SHOW;
}

/* The camera, after placeDropCamera has put it behind you: in the show (or
   while you hold the view key, high enough) it goes to the shot instead.
   `pos` your feet, `held` the view key, `height` above the ground.
   Returns "fp" (first person: hide your body), "tp" or null. */
export function placeFallShowCamera(camera, pos, held, height, dt) {
  if (!show) return lens(camera, 1);
  _body.copy(pos).y += 1.0;   // the belly, where the pose turns about
  if (show.t < FALL_SHOW) {
    const shot = shotAt(show.t);
    if (shot === "tumble") {
      // Your own eyes, turning with your body.
      fallShowQuat(show.t, show.yaw, show.back, _q);
      camera.position.copy(_v.set(0, 0.68, -0.08).applyQuaternion(_q).add(_body));
      camera.quaternion.copy(_q);
      lens(camera, 1);
      return "fp";
    }
    placeShot(camera, shot, show.yaw, show.t);
    return "tp";
  }
  // Hold-to-view: side, front, low, 1.5 s each, while it's held.
  if (held && height > VIEW_FLOOR) {
    show.view = Math.floor(show.holdT / VIEW_EVERY) % 3;
    show.holdT += dt;
    placeShot(camera, VIEWS[show.view], game.look.yaw, show.holdT);
    return "tp";
  }
  if (show.view >= 0) { show.view = -1; show.holdT = 0; }
  return lens(camera, 1);
}

/* A longer lens for the shots (game.js keeps the fov; the zoom is ours, as
   in club-entry-cine.js). Returns null, for placeFallShowCamera's "not
   mine". */
function lens(camera, z) {
  if (camera.zoom !== z) { camera.zoom = z; camera.updateProjectionMatrix(); }
  return null;
}

const VIEWS = ["side", "front", "low"];
/* Where your face is: the head of your own rig (posed every frame), or
   near enough from the belly before it has been. */
function headAt(out) {
  const head = game.localRig?.parts?.head;
  if (head) { head.updateWorldMatrix(true, false); return head.getWorldPosition(out); }
  return out.copy(_body).y += 0.6;
}
function placeShot(camera, shot, yaw, t) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);   // your facing
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);    // your right
  headAt(_head);
  // Aimed between your face and your chest: the face high in the frame,
  // the body under it.
  const aim = _v.copy(_head).lerp(_body, 0.3);
  _up.set(0, 1, 0);
  let frame = 1.3;   // the lens
  if (shot === "ramp") {
    // Left behind where you went out, a long lens on you falling away
    // (you're face up): framed as if from 3 m.
    _cam.copy(show.exit);
    frame = Math.max(1, Math.min(24, _cam.distanceTo(aim) / 3));
  } else if (shot === "face") {
    // Just over you on your back, a little toward your feet, looking down
    // into your face; your head at the top of the frame.
    _cam.copy(_head).addScaledVector(_v.set(fx, 0, fz), 0.9);
    _cam.y += 2.3;
    aim.copy(_head).lerp(_body, 0.25);
    _up.set(-fx, 0, -fz);
    frame = 1.15;
  } else if (shot === "low") {
    // Close below you and ahead of your head: you roll over onto your
    // belly into it, face first.
    _cam.set(_head.x + fx * 1.0 + rx * 0.6, _head.y - 2.1, _head.z + fz * 1.0 + rz * 0.6);
    frame = 1.45;
  } else if (shot === "side") {
    // Falling with you 3.2 m off your right, level with your head.
    _cam.set(_head.x + rx * 3.2 - fx * 0.6, _head.y + 0.4, _head.z + rz * 3.2 - fz * 0.6);
  } else {
    // Front: out ahead of you and a little below, into your face.
    _cam.set(_head.x + fx * 2.8, _head.y - 1.1, _head.z + fz * 2.8);
  }
  camera.position.copy(_cam);
  camera.up.copy(_up);
  camera.lookAt(aim);
  camera.up.set(0, 1, 0);
  lens(camera, frame);
}
/* Tests: where your face sits on screen (-1..1 both ways, z < 1 in front
   of the camera). */
export function fallFaceOnScreen(camera) {
  headAt(_head);
  return _head.clone().project(camera);
}
