// Troll Royale — the jump out of the C-130 (docs/ROYALE-EXIT.md): the
// first seconds out of the plane are a camera show, then the fall is first
// person (user, 2026-10-30), plus a hold-to-view key.
//
// Real seconds from the lip (the pose runs on royale-exit.js exitClock,
// which slows to 0.3x for the look back and has caught up by 2.6):
//   0   .. 0.3  your own eyes: the lip drops away, the horizon tips
//   0.3 .. 1.9  the look back, in slow motion: over your shoulder as you
//               spin, arms wide, the open ramp behind you with the
//               jumpmaster in the door (the plane's drawn on the slow
//               clock too: royale-planes.js riddenLag)
//   1.9 .. 3.3  round in front: your face and body as the hands come in
//               to your chest
//   3.3 .. 3.8  in behind your head and into your eyes as you dive; the
//               stick's yours from 3.3
//   on          first person, your arms out in front of you; the POV key
//               flips to the camera behind you for this fall
// The show doesn't steer (everyone covers the same ground before control
// starts). Held after it (crouch: C, Ctrl, the touch crouch button, the
// pad's), side, front and low angles come back 1.5 s each, down to 80 m.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { playSfx } from "../sound/sfx-files.js?v=dc4-nd1-wb1";
import { EXIT, exitClock, exitSlowK, exitQuat } from "./royale-exit.js?v=ex1-mb1";

export const FALL_CUTS = [EXIT.slow[0], EXIT.tuck, EXIT.dive];   // real s: the lip, the look back, the face, into your eyes
const INTO_EYES = 0.5;            // s to push into your eyes after the dive
export const VIEW_FLOOR = 80;     // m: no hold-to-view below this (the landing's always from your eyes)
const VIEW_EVERY = 1.5;

let show = null;
const _q = new THREE.Quaternion();
const _body = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _v = new THREE.Vector3();
const _head = new THREE.Vector3();
const _up = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _eu = new THREE.Euler(0, 0, 0, "YXZ");

/* Out of the plane (royale.js jumpOut): `yaw` the way you faced going out
   (world), `vel` how fast (the plane's way), `centre` the island's middle
   {x, z}, `ramp(out)` where the ramp's lip is now (world: the plane on its
   slowed clock). */
export function startFallShow(yaw, vel, centre, ramp) {
  show = { r: 0, d: 0, yaw, centre, ramp, look0: { yaw: game.look.yaw, pitch: game.look.pitch },
    view: -1, holdT: 0, front: null, from: null, pov: !!game.settings?.thirdPerson };
  setHead(true);
  vignette(0);
}

/* The show hands the camera back looking down at the island, north up so
   the trollface reads the right way. A look you lined up yourself while
   the show ran stays yours. */
function aimAtIsland(c, look0) {
  const turned = Math.abs(Math.atan2(Math.sin(game.look.yaw - look0.yaw), Math.cos(game.look.yaw - look0.yaw)));
  if (turned > 0.1 || Math.abs(game.look.pitch - look0.pitch) > 0.1) return;
  const pos = game.move.pos;
  game.look.yaw = 0;
  if (!c) { game.look.pitch = -1.2; return; }
  const ahead = pos.z - c.z;                // m north to the middle
  const pitch = ahead > 1 ? -Math.atan2(Math.max(20, pos.y), ahead) : -1.4;
  game.look.pitch = Math.max(-1.4, Math.min(-0.6, pitch));
}
/* Landed (or out of the match): your POV setting as it was, the head back. */
export function endFallShow() {
  if (show && game.settings) game.settings.thirdPerson = show.pov;
  show = null;
  setHead(true);
  vignette(0);
  if (game.camera) lens(game.camera, 1);
}
/* The show has the stick (and the camera) till the dive. */
export function fallShowOn() { return !!show && show.r < EXIT.dive; }
/* For your own body's pose (view/third-person.js): { r (real s), yaw } in
   the show. */
export function fallShowPose() { return show && exitClock(show.r) < EXIT.show ? show : null; }
/* How far behind the plane you left is drawn (royale-planes.js riddenLag). */
export function fallShowLag() { return show ? Math.max(0, show.r - exitClock(show.r)) : 0; }
/* What the tests read. */
export function fallShowState() {
  return show ? { r: show.r, d: exitClock(show.r), shot: shotAt(show.r), view: show.view, lag: fallShowLag(), slow: exitSlowK(show.r) } : null;
}
function shotAt(r) {
  if (r < FALL_CUTS[0]) return "lip";
  if (r < FALL_CUTS[1]) return "lookback";
  if (r < FALL_CUTS[2]) return "face";
  if (r < FALL_CUTS[2] + INTO_EYES) return "eyes";
  return "fall";
}

/* Each frame of the fall, before the flight steps: a whoosh on each cut.
   Returns { coast (the show still has the stick), dt (how far the fall
   steps: the slow clock's) }. */
export function updateFallShow(dt) {
  if (!show) return { coast: false, dt };
  const was = show.r;
  show.r += dt;
  const step = exitClock(show.r) - exitClock(was);
  for (const c of FALL_CUTS) if (was < c && show.r >= c && !playSfx("whoosh", { gain: c === FALL_CUTS[0] ? 0.7 : 0.45, rate: c === FALL_CUTS[0] ? 0.7 : 1 })) game.audio.swing?.();
  if (was < EXIT.dive && show.r >= EXIT.dive) { aimAtIsland(show.centre, show.look0); game.showWaveBanner("Push forward to fly — look down to dive", 1800); }
  vignette(exitSlowK(show.r));
  return { coast: show.r < EXIT.dive, dt: step };
}
/* The slow-mo's own look: the edges darken (and the wind drops, royale.js). */
export function fallSlowK() { return show ? exitSlowK(show.r) : 0; }

/* The camera, after placeDropCamera has put it behind you. `pos` your
   feet, `held` the view key, `height` above the ground. Returns "fp" (your
   eyes, your body hidden), "fpfall" (your eyes, your body shown but your
   head), "tp", or null (placeDropCamera's camera behind you). */
export function placeFallShowCamera(camera, pos, held, height, dt) {
  if (!show) return lens(camera, 1);
  _body.copy(pos).y += 1.0;   // the belly, where the pose turns about
  const shot = shotAt(show.r);
  if (shot === "lip") {
    // Your own eyes, the body's turn (a lean out over the edge).
    exitQuat(exitClock(show.r), show.yaw, show.yaw, _q);
    camera.position.copy(_v.set(0, 0.68, -0.08).applyQuaternion(_q).add(_body));
    camera.quaternion.copy(_q);
    lens(camera, 1);
    return "fp";
  }
  if (shot === "lookback") { lookBack(camera); return "tp"; }
  if (shot === "face") { faceShot(camera, dt); return "tp"; }
  if (shot === "eyes") {
    // From the face shot round behind your head and into your eyes.
    const k = smooth((show.r - FALL_CUTS[2]) / INTO_EYES);
    if (!show.from) show.from = { p: camera.position.clone(), q: camera.quaternion.clone() };
    eyes(camera);
    camera.position.lerpVectors(show.from.p, camera.position, k);
    camera.quaternion.slerpQuaternions(show.from.q, camera.quaternion, k);
    lens(camera, 1);
    return k > 0.85 ? "fpfall" : "tp";
  }
  // The fall. Hold-to-view: side, front, low, 1.5 s each, while it's held.
  if (held && height > VIEW_FLOOR) {
    show.view = Math.floor(show.holdT / VIEW_EVERY) % 3;
    show.holdT += dt;
    placeShot(camera, VIEWS[show.view], game.look.yaw);
    return "tp";
  }
  if (show.view >= 0) { show.view = -1; show.holdT = 0; }
  lens(camera, 1);
  // First person (user, 2026-10-30); the POV key flips it for this fall
  // (endFallShow puts your setting back).
  if (!!game.settings?.thirdPerson !== show.pov) return null;
  eyes(camera);
  return "fpfall";
}

/* Your eyes in the fall: at your head, looking where you look. */
function eyes(camera) {
  headAt(_head);
  camera.position.copy(_head);
  camera.quaternion.setFromEuler(_eu.set(game.look.pitch, game.look.yaw, 0, "YXZ"));
}

/* The look back: over your shoulder, from the side away from the plane, a
   longer lens; you spin in the front of the frame, the open ramp behind
   you (the jumpmaster in the door, the bots in their seats). */
function lookBack(camera) {
  headAt(_head);
  show.ramp(_aim);
  const toPlane = _v.copy(_aim).sub(_head);
  const dist = toPlane.length() || 1;
  toPlane.divideScalar(dist);
  const side = _up.set(0, 1, 0).cross(toPlane).normalize();
  // Behind you (away from the plane), up a little and off to one side; it
  // drifts round slowly while the shot holds.
  const k = (show.r - FALL_CUTS[0]) / (FALL_CUTS[1] - FALL_CUTS[0]);
  _cam.copy(_head).addScaledVector(toPlane, -3.4).addScaledVector(side, 1.0 - 0.8 * k);
  _cam.y += 1.5;
  camera.position.copy(_cam);
  // Aimed past you at the door, so you sit low in the frame and the door's
  // up behind you; a lens long enough to bring it close.
  camera.lookAt(_v.copy(_head).lerp(_aim, 0.3));
  lens(camera, Math.max(1.2, Math.min(2.4, dist / 9)));
}

/* Round in front of you: your face and body as the hands come in. You're
   tipped face down by now, so it's from out in front and below, looking up
   into your face; it follows your face round, slowly (you're still
   turning). */
function faceShot(camera, dt) {
  headAt(_head);
  // (the body's facing, as the pose turns it: royale-exit.js exitQuat)
  exitQuat(exitClock(show.r), show.yaw, game.localRig?.root.rotation.y ?? show.yaw, _q);
  const fwd = _v.set(0, 0, -1).applyQuaternion(_q);
  if (!show.front) show.front = fwd.clone();
  show.front.lerp(fwd, Math.min(1, dt * 1.6)).normalize();
  camera.position.copy(_head).addScaledVector(show.front, 2.4);
  camera.up.set(0, 1, 0);
  camera.lookAt(_aim.copy(_head).lerp(_body, 0.4));
  lens(camera, 1.15);
}

const smooth = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

/* A longer lens for the shots (game.js keeps the fov; the zoom is ours, as
   in club-entry-cine.js). Returns null, for placeFallShowCamera's "not
   mine". */
function lens(camera, z) {
  if (camera.zoom !== z) { camera.zoom = z; camera.updateProjectionMatrix(); }
  return null;
}

/* Your own head shown or not (in the fall's first person the body is
   seen, the head would fill the view). */
function setHead(on) {
  const hp = game.localRig?.parts?.headPivot;
  if (hp) hp.visible = on;
}
export function fallHeadShown(on) { setHead(on); }

/* The slow-mo's darkened edges. */
let vig = null;
function vignette(k) {
  if (!vig) {
    if (k <= 0) return;
    vig = document.createElement("div");
    vig.className = "to-exit-slowmo";
    vig.setAttribute("aria-hidden", "true");
    vig.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:5;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(8,10,20,.85) 100%);opacity:0;";
    document.body.append(vig);
  }
  vig.style.opacity = String(k * 0.75);
}

const VIEWS = ["side", "front", "low"];
/* Where your face is: the head of your own rig (posed every frame), or
   near enough from the belly before it has been. */
function headAt(out) {
  const head = game.localRig?.parts?.head;
  if (head) { head.updateWorldMatrix(true, false); return head.getWorldPosition(out); }
  return out.copy(_body).y += 0.6;
}
function placeShot(camera, shot, yaw) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);   // your facing
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);    // your right
  headAt(_head);
  const aim = _aim.copy(_head).lerp(_body, 0.3);
  let frame = 1.3;
  if (shot === "low") {
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
  camera.up.set(0, 1, 0);
  camera.lookAt(aim);
  lens(camera, frame);
}
/* Tests: where your face sits on screen (-1..1 both ways, z < 1 in front
   of the camera). */
export function fallFaceOnScreen(camera) {
  headAt(_head);
  return _head.clone().project(camera);
}
