// The gun in your hands each frame: sway, bob, landing dip, ADS, inspect,
// reloads (mags, shells, pumps), the rod arms, the Soul Blazer and the laser.

import { currentWeapon } from "../combat/weapons.js?v=wp1-kc2-si1-gj1-fu1b7b7d";
import { AKIMBO_INSPECT_TIME } from "../akimbo-view.js?v=ak1-wst";
import * as THREE from "three";
import { rise, smoothstep, damp } from "../anim-curves.js";
import { handMaterials, inkOutline } from "../hand-model.js?v=to-grip2";
import { wristOf, buildWatch } from "../wristwear.js?v=ww1";
import { cosmetics } from "../menu/lobby.js?v=lb1-si1-gj1-if1-fu1b7b7d";
import { soulBlazerReloadPose, soulBlazerKick, soulBlazerIgnite, soulBlazerMouth, updateSoulBlazerView, soulBlazerInspect, SB_INSPECT_CUES } from "../soul-blazer.js?v=sb1";
import { placePistolSlide } from "./pistol-action.js?v=ps1";
import { placeBolt } from "./rifle-action.js?v=ra1";
import { chargedShotDef } from "../weapons.js?v=p5bm-wst-hf1-fu1";
import { raycastWorld } from "../ballistics.js?v=cg1-wst-hf1-fu1b7";
import { STANCE } from "../movement.js?v=umb2-sb2-gj1b7";
import { game } from "../core/state.js?v=st1";

/* Phase 2 (DESIGN-ARMS.md §5): landing-impact dip. `move.justLanded`/
   `landSpeed` (movement.js) already exist and were unused before this —
   a one-frame edge the viewmodel converts into a decaying impulse rather
   than a fixed-length animation, so a light hop and a hard fall from a
   vault both settle at their own natural rate. */
export let landDipT = 0;      // 0..1, decays via damp() back to 0 each frame
export let landDipMag = 0;    // captured strength of the current dip, set once on the landing frame
const LAND_DIP_MAX_SPEED = 9;   // landSpeed at/above this reads as "full" impact
const LAND_DIP_POS = 0.05;      // meters of downward dip at full impact
const LAND_DIP_PITCH = 0.16;    // radians of forward tilt at full impact

/* Phase 2: sprint transition polish. weaponLowerT already handles the
   flat lower; this adds the "sling to the side" roll on the way out and
   lets the return overshoot slightly before settling, scaled by weapon
   weight so a heavy gun swings wider than a pistol. */
let sprintRollT = 0;

/* Phase 2: start/stop settling. bobPhase (weapons.js) freezes rather than
   resetting when movement stops, which already avoids a snap-to-zero, but
   the amplitude itself still cuts instantly from full to whatever the
   frozen phase happens to be. This eases the amplitude multiplier instead,
   so stopping reads as the weapon settling rather than the bob motion just
   stopping mid-swing. */
let bobSettleT = 0;
// Turn lag: last frame's look angles and the smoothed lag offsets.
let lastLookYaw = 0, lastLookPitch = 0, turnLagX = 0, turnLagY = 0;

/* Phase 2: ADS transition weight. `w.adsT` (weapons.js) ramps linearly at
   a fixed rate and drives FOV/laser-threshold/etc elsewhere, so it isn't
   safe to reshape directly. Instead this is a damped shadow of it, lagging
   behind exactly like swaySmoothX/Y already lag behind raw sway — used
   only for the hip<->ADS position lerp, so heavier guns settle into their
   sight picture instead of snapping there linearly. */
let adsSmoothT = 0;

/* Weapon inspect (D-pad up / T). Admires whatever's in hand — pure
   flourish, cancelled by anything that matters (firing, aiming, reloading,
   sprinting, swinging) so it can never cost you a fight.

   Long guns get a proper showcase: both hands bring the gun up to the
   middle of the screen side-on (left side, muzzle left, the whole gun
   visible edge to edge), a wrist twist turns it round to the right side,
   then it goes back to the hip. Skins are authored so the right side reads
   correctly too (see the sides formula in HANDOFF.md), so this is the
   moment a skin gets seen in full. Sidearms keep their quick twirl. The
   Keyboard Warrior gets tossed: it flips up out of the hands, floats in
   front of the camera keys-out with the RGB running, then drops back into
   the catch. */
const GUN_INSPECT_TIME = 4.2;
const SIDEARM_INSPECT_TIME = 2.2;
const MELEE_INSPECT_TIME = 3.6;
export let inspectDur = GUN_INSPECT_TIME;

// A sidearm with def.inspectShowcase (the traced pistols) is admired side-on too.
function isLongGunInspect(w) { return w.def.cls !== "sidearm" || !!w.def.inspectShowcase; }

export function startInspect() {
  if (game.socialUnarmed()) return;
  if (game.inspectT > 0 || !game.player.alive || game.gameState !== "playing" || game.move.busy) return;
  if (game.player.holding === "gun") {
    const w = currentWeapon();
    if (w.reloading || w.adsT > 0.05) return;
    inspectDur = w.def.akimbo ? AKIMBO_INSPECT_TIME : isLongGunInspect(w) ? (w.def.inspectTime ?? GUN_INSPECT_TIME) : SIDEARM_INSPECT_TIME;
  } else if (game.player.holding === "melee") {
    if (!game.player.melee || game.player.melee.busy) return;
    inspectDur = game.player.melee.chainsaw ? game.SAW_REV_TIME : MELEE_INSPECT_TIME;
  } else {
    return;
  }
  game.inspectT = inspectDur;
  game.sawRevBlips = 0;
  // Admiring the chainsaw revs it instead (applySawRev plays the blips).
  if (game.player.holding === "gun" && currentWeapon().def.akimbo) game.audio.hammerCock();
  else if (game.player.holding !== "melee" || !game.player.melee.chainsaw) game.audio.reload();     // the same handling clicks, which is what an inspect is
}

function updateInspect(dt) {
  if (game.inspectT <= 0) { inspectArms.visible = false; return; }
  // Anything that matters takes the weapon back immediately.
  // Sprinting does NOT cancel it: PF lets you admire the gun on the run.
  if (!game.player.alive || game.move.busy) { game.inspectT = 0; return; }
  if (game.player.holding === "gun") {
    const w = currentWeapon();
    if (w.reloading || w.adsT > 0.05) { game.inspectT = 0; return; }
  } else if (game.player.holding === "melee") {
    if (!game.player.melee || game.player.melee.busy) { game.inspectT = 0; return; }
  } else {
    game.inspectT = 0;
    return;
  }
  if (game.inspectFreeze != null) { game.inspectT = Math.max(1e-4, (1 - game.inspectFreeze) * inspectDur); return; }
  game.inspectT = Math.max(0, game.inspectT - dt);
}

export function inspectProgress() { return game.inspectT > 0 ? 1 - game.inspectT / inspectDur : 0; }

// stage()/rise() now live in anim-curves.js, imported above.

/* Keyframe track: rows of [t, v1, v2, ...] with t rising 0..1. Sampled as a
   cubic Hermite with Catmull-Rom tangents, so the motion flows through the
   keys instead of stopping on each one, and eases in/out at the two ends. */
function sampleKeys(keys, t, out) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const k1 = keys[i], k2 = keys[i + 1];
  const k0 = keys[i - 1], k3 = keys[i + 2];
  const span = k2[0] - k1[0];
  const u = Math.max(0, Math.min(1, (t - k1[0]) / span));
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  for (let j = 1; j < k1.length; j++) {
    const m1 = k0 ? (k2[j] - k0[j]) / (k2[0] - k0[0]) * span : 0;
    const m2 = k3 ? (k3[j] - k1[j]) / (k3[0] - k1[0]) * span : 0;
    out[j - 1] = h00 * k1[j] + h10 * m1 + h01 * k2[j] + h11 * m2;
  }
  return out;
}

/* Where the model's middle is and how long it is, in its own space, hands
   left out. Measured once per built mesh: the pivot of every view model is
   its grip, and a side-on gun spun about its grip swings half off screen. */
function inspectBounds(mesh) {
  if (mesh.userData.inspectBounds) return mesh.userData.inspectBounds;
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  const m = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  mesh.updateWorldMatrix(true, true);
  inv.copy(mesh.matrixWorld).invert();
  mesh.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let p = o; p && p !== mesh; p = p.parent) if (p.userData.hand) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    m.multiplyMatrices(inv, o.matrixWorld);
    tmp.copy(o.geometry.boundingBox).applyMatrix4(m);
    box.union(tmp);
  });
  const size = box.getSize(new THREE.Vector3());
  const bounds = { center: box.getCenter(new THREE.Vector3()), len: Math.max(size.x, size.y, size.z) };
  mesh.userData.inspectBounds = bounds;
  return bounds;
}

/* How far in front of the camera a model of this length has to sit to fill
   `frac` of the screen width. Aspect-aware, so a 4:3 iPad and a 21:9
   monitor both see the whole gun. */
function inspectDistance(len, frac) {
  const halfH = Math.tan(THREE.MathUtils.degToRad(game.weaponCamera.fov / 2));
  const halfW = halfH * Math.max(0.5, game.weaponCamera.aspect);
  return THREE.MathUtils.clamp((len / 2) / (frac * halfW), 0.42, 1.4);
}

/* Pistol: a one-handed showman's twirl around the trigger guard. Additive,
   on top of the normal hip pose. */
const _inspectPose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
function _zeroPose(p) { p.x = p.y = p.z = p.pitch = p.yaw = p.roll = 0; return p; }
function inspectTwirl(t, p) {
  const overallEase = Math.sin(Math.min(1, t / 0.1) * Math.PI / 2)
    * Math.sin(Math.min(1, (1 - t) / 0.15) * Math.PI / 2);
  const spins = 1.5; // full turns
  p.roll = Math.sin(t * Math.PI * 2 * spins) * overallEase * 0.9;
  p.yaw = overallEase * Math.sin(t * Math.PI * 2 * spins + 0.6) * 0.22;
  p.pitch = overallEase * 0.1;
  p.x = overallEase * -0.02;
  p.y = overallEase * 0.03;
  p.z = overallEase * 0.06;
}

export function inspectPose() {
  const p = _inspectPose;
  if (game.inspectT <= 0 || game.player.holding !== "gun") return _zeroPose(p);
  const w = currentWeapon();
  if (isLongGunInspect(w) || w.def.akimbo) return _zeroPose(p);   // applyGunInspect / akimbo-view own those
  inspectTwirl(inspectProgress(), p);
  return p;
}

/* Long-gun showcase keys: [t, yaw°, twist°, tilt°, x, y, dz].
   yaw   +90 = muzzle left, left side to camera; -90 = muzzle right.
   twist roll about the barrel; toward the camera shows the top of the gun.
   tilt  muzzle up, in the screen plane.
   x/y   where the middle of the gun sits (camera space); dz pushes it back.
   Beats: bring up (0-.16), admire the left side with a slow drift (.16-.44),
   wrist twist through muzzle-away (.44-.62), admire the right side
   (.62-.86), back to the hip (.86-1). */
const GUN_INSPECT_KEYS = [
  [0.00,  58,  26, -10,  0.07, -0.13, 0.08],
  [0.16,  84,  15,   4,  0.00, -0.035, 0],
  [0.30,  79,   9,   6, -0.012, -0.028, 0],
  [0.44,  87,  17,   2,  0.004, -0.04, 0],
  [0.53,  28, -30,  -2,  0.00, -0.015, 0.07],
  [0.62, -84, -15,   4,  0.00, -0.035, 0],
  [0.74, -79,  -9,   6,  0.012, -0.028, 0],
  [0.86, -87, -17,   2, -0.004, -0.04, 0],
  [1.00, -48, -26, -10,  0.09, -0.14, 0.08],
];
const _gunKey = new Array(6).fill(0);
const _qTilt = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _qTwist = new THREE.Quaternion();
const _qInspect = new THREE.Quaternion();
const _vInspect = new THREE.Vector3();
const _vCenter = new THREE.Vector3();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/* Runs after the normal gun pose is set, and blends from it to the
   showcase pose, so sway/bob hand over smoothly at both ends. */
function applyGunInspect(mesh, w) {
  const long = game.inspectT > 0 && game.player.holding === "gun" && isLongGunInspect(w);
  const t = long ? inspectProgress() : 0;
  const blend = long ? rise(t, 0, 0.14) * (1 - rise(t, 0.86, 1)) : 0;
  // The rods stay on the gun through the inspect (user:
  // no white hands anywhere; the old showcase arms are retired).
  inspectArms.visible = false;
  if (blend <= 0) return;

  const [yaw, twist, tilt, x, y, dz] = sampleKeys(mesh.userData.inspectKeys ?? GUN_INSPECT_KEYS, t, _gunKey);
  const yawR = THREE.MathUtils.degToRad(yaw);
  // Muzzle-up is a different screen rotation depending on which way the
  // muzzle points; sin(yaw) carries it smoothly through the turn.
  _qTilt.setFromAxisAngle(AXIS_Z, -THREE.MathUtils.degToRad(tilt) * Math.sin(yawR));
  _qYaw.setFromAxisAngle(AXIS_Y, yawR);
  _qTwist.setFromAxisAngle(AXIS_Z, THREE.MathUtils.degToRad(twist));
  _qInspect.copy(_qTilt).multiply(_qYaw).multiply(_qTwist);

  const { center, len } = inspectBounds(mesh);
  const d = inspectDistance(len, 0.72) + dz;
  _vCenter.copy(center).applyQuaternion(_qInspect);
  _vInspect.set(x, y, -d).sub(_vCenter);

  mesh.position.lerp(_vInspect, blend);
  mesh.quaternion.slerp(_qInspect, blend);
  if (inspectArms.visible) poseInspectArms(mesh, Math.sin(yawR));
}

/* Both hands on the gun for the showcase. The block hands built onto every
   gun stay hidden (user call: the gun reads clean day to day, and they sat
   on the skin art); these are real arms instead, a sleeve from a shoulder
   below the screen to a fist on the grip and one under the handguard, so
   whichever side of the gun is showing, the arms come from the player. The
   built hands are still used, invisibly, as the anchors for where the
   fists go. */
/* Shoulders sit below the screen. Which one feeds which fist follows the
   gun: muzzle left, the trigger hand is on the right of the screen and gets
   the right arm; muzzle right, it swaps, so the arms never cross into an X.
   `side` is sin(yaw), so the swap sweeps smoothly through the twist. */
const INSPECT_SHOULDER_X = 0.28;
const _shoulder = new THREE.Vector3();
const INSPECT_SUPPORT_DROP = 0.095;  // under the handguard, not on top of the art
export const inspectArms = (() => {
  const root = new THREE.Group();
  root.visible = false;
  // White hands, black sleeves, ink outlines — the trollface look (hand-model.js).
  const { sleeve: sleeveMat, cuff: cuffMat, skin: skinMat, shade: knuckleMat } = handMaterials();
  // Unit cylinders standing on y=0, stretched between two points per frame.
  const unitCyl = (rTop, rBottom, mat) => {
    const g = new THREE.CylinderGeometry(rTop, rBottom, 1, 10);
    g.translate(0, 0.5, 0);
    return new THREE.Mesh(g, mat);
  };
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  };
  const arms = [];
  for (let i = 0; i < 2; i++) {
    const fist = new THREE.Group();
    if (i === 0) {
      // Trigger hand: wraps a near-vertical pistol grip (grip runs along
      // the fist's Y), knuckles forward toward the muzzle (-Z).
      fist.add(box(0.064, 0.078, 0.056, skinMat, 0, -0.004, 0.006));
      for (let k = 0; k < 4; k++) fist.add(box(0.068, 0.017, 0.02, knuckleMat, 0, 0.026 - k * 0.02, -0.026));
      fist.add(box(0.02, 0.05, 0.03, skinMat, 0.03, 0.03, -0.012));   // thumb over the top
    } else {
      // Support hand: cups the handguard from underneath, fingers curling
      // up both sides so a finger row shows whichever side faces camera.
      fist.add(box(0.062, 0.03, 0.1, skinMat, 0, -0.012, 0));
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 4; k++) fist.add(box(0.012, 0.034, 0.02, knuckleMat, sx * 0.035, 0.012, -0.036 + k * 0.024));
      }
    }
    const wrist = unitCyl(0.022, 0.026, skinMat);
    const cuff = unitCyl(0.037, 0.035, cuffMat);
    const sleeve = unitCyl(0.044, 0.032, sleeveMat);
    inkOutline(fist);
    inkOutline(cuff);
    root.add(fist, wrist, cuff, sleeve);
    arms.push({ fist, wrist, cuff, sleeve });
  }
  root.userData.arms = arms;
  return root;
})();

export const _armFrom = new THREE.Vector3();
export const _armTo = new THREE.Vector3();
export const _armDir = new THREE.Vector3();
const _armUp = new THREE.Vector3(0, 1, 0);
/* Your wristwear (a Rolex, wristwear.js) in your own view: round the left
   rod a little way back from its tip, face up. Placed just before the view
   model draws, after every arm pose this frame, so it never trails the rod. */
const ROD_WATCH_BACK = 0.07;       // from the rod's tip
let rodWatch = null;
const _rwZ = new THREE.Vector3(), _rwY = new THREE.Vector3(), _rwX = new THREE.Vector3(), _rwM = new THREE.Matrix4();
export function placeRodWatch() {
  const id = wristOf(cosmetics.face);
  if ((rodWatch?.userData.wristId || "") !== id) {
    rodWatch?.parent?.remove(rodWatch);
    rodWatch = id ? buildWatch(id, 0.0165, { envMap: game.weaponEnvTex }) : null;
    rodWatch?.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  }
  if (!rodWatch) return;
  // The left rod in view: an emote's or a streak device's, else the gun's.
  const sRod = game.streakArms.visible ? game.streakArms.userData.arms[1].rod : null;
  const gRod = pfArms.visible ? pfArms.userData.rods[1] : null;
  const rod = sRod?.visible ? sRod : gRod?.visible ? gRod : null;
  rodWatch.visible = !!rod;
  if (!rod) return;
  if (rodWatch.parent !== rod.parent) rod.parent.add(rodWatch);
  // A rod stands on its shoulder end along its +Y, scale.y long (stretchBetween).
  _rwZ.set(0, 1, 0).applyQuaternion(rod.quaternion);
  rodWatch.position.copy(rod.position).addScaledVector(_rwZ, Math.max(0, rod.scale.y - ROD_WATCH_BACK));
  // The band round the rod (the watch's Z back along it), the face up.
  _rwZ.negate();
  _rwY.set(0, 1, 0).addScaledVector(_rwZ, -_rwZ.y);
  if (_rwY.lengthSq() < 1e-6) _rwY.set(0, 0, 1);
  _rwY.normalize();
  _rwX.crossVectors(_rwY, _rwZ);
  rodWatch.quaternion.setFromRotationMatrix(_rwM.makeBasis(_rwX, _rwY, _rwZ));
}

export function stretchBetween(obj, from, to) {
  _armDir.subVectors(to, from);
  const len = _armDir.length();
  obj.position.copy(from);
  obj.quaternion.setFromUnitVectors(_armUp, _armDir.multiplyScalar(1 / Math.max(1e-5, len)));
  obj.scale.set(1, len, 1);
}

function poseInspectArms(mesh, side) {
  mesh.updateMatrixWorld(true);
  const anchors = mesh.children.filter((o) => o.userData.hand);
  const arms = inspectArms.userData.arms;
  for (let i = 0; i < arms.length; i++) {
    const arm = arms[i];
    const anchor = anchors[i];
    arm.fist.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = !!anchor;
    if (!anchor) continue;
    anchor.getWorldPosition(arm.fist.position);
    anchor.getWorldQuaternion(arm.fist.quaternion);
    if (i === 1) {
      // Down from the rail-top anchor to underneath, in the gun's own up.
      _armDir.set(0, -INSPECT_SUPPORT_DROP, 0).applyQuaternion(mesh.quaternion);
      arm.fist.position.add(_armDir);
    }
    const shoulder = _shoulder.set((i === 0 ? 1 : -1) * INSPECT_SHOULDER_X * side, -0.51, 0.11);
    // fist -> wrist -> cuff -> sleeve, all along the line to the shoulder.
    _armDir.subVectors(shoulder, arm.fist.position).normalize();
    _armFrom.copy(arm.fist.position).addScaledVector(_armDir, 0.03);
    _armTo.copy(arm.fist.position).addScaledVector(_armDir, 0.075);
    stretchBetween(arm.wrist, _armFrom, _armTo);
    _armFrom.copy(_armTo);
    _armTo.copy(arm.fist.position).addScaledVector(_armDir, 0.1);
    stretchBetween(arm.cuff, _armFrom, _armTo);
    stretchBetween(arm.sleeve, _armTo, shoulder);
  }
}

/* Phantom Forces arms (user's PF reference clip, 2026-09-27): no hands at
   all, just two thin black rods rising from below the screen, and the tip
   of each rod IS the hand. The right rod ends on the pistol grip, the left
   under the handguard (or on the magazine while reloading). Unlit black, so
   they read as silhouettes and never sit on the skin art the way the block
   hands did. The built hand meshes stay hidden; they're only the anchors. */
// Out and back toward the real shoulders, so each rod runs in from a
// bottom corner of the screen and a good length of arm shows (user: "make
// the rod arms longer").
const PF_ARM_SHOULDER = [new THREE.Vector3(0.44, -0.74, 0.16), new THREE.Vector3(-0.32, -0.78, 0.12)];
const PF_SUPPORT_DROP = 0.085;   // from the rail-top support anchor to under the handguard
export const pfArms = (() => {
  const root = new THREE.Group();
  root.visible = false;
  const mat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const rods = [];
  for (let i = 0; i < 2; i++) {
    // A unit rod standing on y=0: blunt taper to the tip (the "hand"),
    // thicker toward the shoulder, stretched between two points per frame.
    const g = new THREE.CylinderGeometry(0.013, 0.034, 1, 10);
    g.translate(0, 0.5, 0);
    const rod = new THREE.Mesh(g, mat);
    rod.renderOrder = -1;
    root.add(rod);
    rods.push(rod);
  }
  root.userData.rods = rods;
  return root;
})();

/* A forward grip on the gun (an underbarrel vert or angled grip, tagged
   userData.foregrip in attachment-models.js): the left hand fists it.
   Cached per built mesh. */
function foregripOf(mesh) {
  if (mesh.userData._foregrip === undefined) {
    let f = null;
    mesh.traverse((o) => { if (!f && o.userData.foregrip) f = { obj: o, point: o.userData.foregrip }; });
    mesh.userData._foregrip = f;
  }
  return mesh.userData._foregrip;
}
const SABER_HAND_Z = [0.045, 0.104];                 // along the hilt (gear.js grip at 0)
const _saP = new THREE.Vector3();
export function poseSaberArms(mesh) {
  pfArms.visible = true;
  mesh.updateMatrixWorld(true);
  const rods = pfArms.userData.rods;
  for (let i = 0; i < 2; i++) {
    _saP.set(0, 0, SABER_HAND_Z[i]);
    mesh.localToWorld(_saP);
    rods[i].visible = true;
    stretchBetween(rods[i], PF_ARM_SHOULDER[i], _saP);
  }
}

/* The other melee weapons (Keyboard Warrior, Chainsaw, Reaper's Grin): their
   built block hands stay as invisible grip points (they still get tossed
   and caught by the keyboard's inspect, so the arms follow), and the rods
   reach them. A one-handed weapon's other arm stays down. */
export function poseMeleeArms(mesh) {
  pfArms.visible = true;
  mesh.updateMatrixWorld(true);
  const hands = meleeHands(mesh);
  const rods = pfArms.userData.rods;
  for (let i = 0; i < 2; i++) {
    const h = hands[i]?.obj;
    rods[i].visible = !!h;
    if (!h) continue;
    h.visible = false;
    h.updateMatrixWorld(true);
    h.getWorldPosition(_saP);
    stretchBetween(rods[i], PF_ARM_SHOULDER[i], _saP);
  }
}

/* The Peacemakers: a gun in each hand, so each arm comes up from its own
   shoulder to its own grip. The anchors belong to the hands, not the guns,
   so a twirl spins the gun and not the arm. */
const AKIMBO_SHOULDER = [new THREE.Vector3(0.34, -0.66, 0.04), new THREE.Vector3(-0.34, -0.66, 0.04)];
function poseAkimboArms(mesh) {
  const rods = pfArms.userData.rods;
  const hands = mesh.userData.akimboHands;
  for (let i = 0; i < 2; i++) {
    hands[i].getWorldPosition(_pfTip);
    rods[i].visible = true;
    stretchBetween(rods[i], AKIMBO_SHOULDER[i], _pfTip);
  }
}

const _pfTip = new THREE.Vector3();
const _pfMag = new THREE.Vector3();
const _pfDown = new THREE.Vector3();
/* `magBlend` 0..1 moves the support rod's tip from the handguard onto the
   magazine (reloads). */
function posePfArms(mesh, magBlend = 0) {
  if (game.saberArmsOn) return;   // the Trollsaber has the arms (poseSaberArms)
  const show = !!mesh?.visible && !inspectArms.visible && game.player.holding === "gun";
  pfArms.visible = show;
  if (!show) return;
  mesh.updateMatrixWorld(true);
  if (mesh.userData.akimbo) { poseAkimboArms(mesh); return; }
  // [grip, support]: the support hand is the one parked at supportHandPos
  // (build order differs between weapon-model.js and weapon-416.js).
  let anchors = mesh.userData.pfAnchors;
  if (!anchors) {
    const hands = mesh.children.filter((o) => o.userData.hand);
    const sp = mesh.userData.supportHandPos;
    const support = sp ? hands.find((o) => o.position.distanceTo(sp) < 1e-4) : null;
    const grip = hands.find((o) => o !== support);
    anchors = mesh.userData.pfAnchors = [grip, support].filter(Boolean).length ? [grip || support, support] : [];
  }
  const rods = pfArms.userData.rods;
  for (let i = 0; i < 2; i++) {
    // Sidearms carry no support hand: the left rod cups the grip too.
    const anchor = anchors[i] || anchors[0];
    rods[i].visible = !!anchor;
    if (!anchor) continue;
    anchor.getWorldPosition(_pfTip);
    _pfDown.set(0, -1, 0).applyQuaternion(mesh.quaternion);
    if (i === 1) {
      const fg = anchors[1] ? foregripOf(mesh) : null;
      if (fg) fg.obj.localToWorld(_pfTip.copy(fg.point));
      else _pfTip.addScaledVector(_pfDown, anchors[1] ? (mesh.userData.pfSupportDrop ?? PF_SUPPORT_DROP) : 0.03);
      const mag = mesh.userData.shellMesh?.visible ? mesh.userData.shellMesh : mesh.userData.magMesh;
      if (magBlend > 0 && mag?.visible) {
        mag.getWorldPosition(_pfMag).addScaledVector(_pfDown, 0.05);
        _pfTip.lerp(_pfMag, magBlend);
      }
    }
    stretchBetween(rods[i], PF_ARM_SHOULDER[i], _pfTip);
  }
}

/* Keyboard Warrior toss. Beats (t):
     0.00-0.10  wind-up dip
     0.10-0.34  toss: leaves the hands with one end-over-end flip, rising
                a touch past the hover point
     0.34-0.70  float: hangs in front of the camera keys-out, esc end on
                the left like a real keyboard, slow sway and bob
     0.70-0.86  drop: a barrel roll on the way down into the hands
     0.86-1.00  catch: weight lands, a dip that settles
   The hands stay behind: they're lifted off the sword into the rig while
   it's airborne, sink out of view, and come back up for the catch. */
const MELEE_T_TOSS = 0.10, MELEE_T_FLOAT = 0.34, MELEE_T_DROP = 0.70, MELEE_T_CATCH = 0.86;
// Keys face local +Y, blade runs down local -Z, the F-row is the -X edge.
// Presented: blade to the right, keys at the camera, F-row on top.
const MELEE_FLOAT_QUAT = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));
const _qRest = new THREE.Quaternion();
const _vRest = new THREE.Vector3();
const _vRestCenter = new THREE.Vector3();
const _vFloatCenter = new THREE.Vector3();
const _qFloat = new THREE.Quaternion();
const _qSpin = new THREE.Quaternion();
const _qWobble = new THREE.Quaternion();

export function meleeHands(mesh) {
  if (!mesh.userData.inspectHandList) {
    mesh.userData.inspectHandList = mesh.children.filter((o) => o.userData.hand).map((o) => ({
      obj: o, pos: o.position.clone(), quat: o.quaternion.clone(), rigPos: new THREE.Vector3(),
    }));
  }
  return mesh.userData.inspectHandList;
}

/* Put tossed-off hands back on the sword exactly where they were built. */
export function restoreMeleeHands(mesh) {
  if (!mesh?.userData.handsTossed) return;
  for (const h of meleeHands(mesh)) {
    mesh.add(h.obj);
    h.obj.position.copy(h.pos);
    h.obj.quaternion.copy(h.quat);
  }
  mesh.userData.handsTossed = false;
}

/* The Reaper's Grin, admired: the blade folds shut, you bring it up, flick
   it open with a snap, roll it twice round the wrist with a little toss,
   and turn it to show the engraving before it settles back.
     0.00-0.10 fold shut    0.10-0.22 raise    0.22-0.32 flick open
     0.34-0.70 two rolls    0.70-0.88 show     0.88-1.00 back to rest */
let reaperClick = false;
export const _meleeViewQ = new THREE.Quaternion();
export const _meleeViewE = new THREE.Euler();
export function applyReaperInspect(mesh) {
  const setFold = mesh.userData.setFold;
  if (game.inspectT <= 0) { setFold?.(0); reaperClick = false; return; }
  const t = inspectProgress();
  const sm = (a, b) => smoothstep(Math.max(0, Math.min(1, (t - a) / (b - a))));
  let fold = 0;
  if (t < 0.1) fold = sm(0, 0.1);
  else if (t < 0.22) fold = 1;
  else if (t < 0.32) {
    const u = (t - 0.22) / 0.1, c = 2.2;   // back-out: snaps past open, settles
    fold = 1 - (1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2));
    if (!reaperClick) { reaperClick = true; game.audio.reload(); }
  }
  if (t < 0.2) reaperClick = false;
  setFold?.(fold);
  const raise = sm(0.1, 0.22) * (1 - sm(0.88, 1));
  const snap = t > 0.22 && t < 0.34 ? Math.sin(((t - 0.22) / 0.12) * Math.PI) : 0;
  const trick = Math.max(0, Math.min(1, (t - 0.34) / 0.36));
  const roll = Math.PI * 4 * (trick < 0.5 ? 2 * trick * trick : 1 - Math.pow(-2 * trick + 2, 2) / 2);
  const toss = Math.sin(trick * Math.PI) * 0.045;
  const show = sm(0.7, 0.8) * (1 - sm(0.86, 0.94));
  mesh.position.x -= 0.24 * raise;
  mesh.position.y += 0.1 * raise + toss;
  mesh.position.z += 0.04 * raise;
  _qSpin.setFromAxisAngle(AXIS_X, -0.35 * raise - 0.25 * snap);
  mesh.quaternion.multiply(_qSpin);
  _qSpin.setFromAxisAngle(AXIS_Y, 0.55 * raise + 0.5 * show);
  mesh.quaternion.multiply(_qSpin);
  _qSpin.setFromAxisAngle(AXIS_Z, roll);
  mesh.quaternion.multiply(_qSpin);
}

export function applyMeleeInspect(mesh) {
  const t = inspectProgress();
  const airborne = game.inspectT > 0 && t >= MELEE_T_TOSS + 0.02 && t < MELEE_T_CATCH;
  if (!airborne) restoreMeleeHands(mesh);
  if (game.inspectT <= 0) return;

  // The rest pose this frame (idle pose + walk bob), and its middle.
  _vRest.copy(mesh.position);
  _qRest.copy(mesh.quaternion);
  const { center, len } = inspectBounds(mesh);
  _vRestCenter.copy(center).applyQuaternion(_qRest).add(_vRest);

  const d = inspectDistance(len, 0.66);
  const floatT = Math.max(0, t - MELEE_T_FLOAT) * inspectDur;
  _qWobble.setFromEuler(new THREE.Euler(
    Math.sin(floatT * 1.9) * 0.07 - 0.12,     // lean the keys up toward the light a touch
    Math.sin(floatT * 1.3) * 0.26,
    Math.sin(floatT * 1.7 + 0.8) * 0.05));
  _qFloat.copy(_qWobble).multiply(MELEE_FLOAT_QUAT);
  _vFloatCenter.set(0, 0.015 + Math.sin(floatT * 2.2) * 0.012, -d);

  if (t < MELEE_T_TOSS) {
    // Wind-up: dip and cock back before the throw.
    const k = Math.sin((t / MELEE_T_TOSS) * Math.PI * 0.5);
    mesh.position.y -= 0.045 * k;
    mesh.position.z += 0.03 * k;
    _qSpin.setFromAxisAngle(AXIS_X, 0.25 * k);
    mesh.quaternion.multiply(_qSpin);
  } else if (t < MELEE_T_FLOAT) {
    const s = (t - MELEE_T_TOSS) / (MELEE_T_FLOAT - MELEE_T_TOSS);
    const e = 1 - Math.pow(1 - s, 3);   // thrown: fast off the hands, slowing at the top
    _qInspect.copy(_qRest).slerp(_qFloat, smoothstep(s));
    _qSpin.setFromAxisAngle(AXIS_X, -Math.PI * 2 * (1 - e));
    _qInspect.multiply(_qSpin);
    _vInspect.copy(_vRestCenter).lerp(_vFloatCenter, e);
    _vInspect.y += Math.sin(s * Math.PI) * 0.09;   // rises past the hover point, settles back
    placeByCenter(mesh, _qInspect, _vInspect, center);
  } else if (t < MELEE_T_DROP) {
    placeByCenter(mesh, _qFloat, _vFloatCenter, center);
  } else if (t < MELEE_T_CATCH) {
    const s = (t - MELEE_T_DROP) / (MELEE_T_CATCH - MELEE_T_DROP);
    const e = s * s * (1.6 - 0.6 * s);   // falls: slow off the hover, fast into the hands
    _qInspect.copy(_qFloat).slerp(_qRest, smoothstep(s));
    _qSpin.setFromAxisAngle(AXIS_Z, Math.PI * 2 * e);
    _qInspect.multiply(_qSpin);
    _vInspect.copy(_vFloatCenter).lerp(_vRestCenter, e);
    placeByCenter(mesh, _qInspect, _vInspect, center);
  } else {
    // Catch: the weight lands in the hands and settles.
    const s = (t - MELEE_T_CATCH) / (1 - MELEE_T_CATCH);
    const hit = Math.sin(Math.min(1, s * 2.2) * Math.PI) * (1 - s * 0.6);
    mesh.position.y -= 0.05 * hit;
    mesh.position.z += 0.02 * hit;
    _qSpin.setFromAxisAngle(AXIS_X, -0.18 * hit);
    mesh.quaternion.multiply(_qSpin);
  }

  if (airborne) {
    const hands = meleeHands(mesh);
    if (!mesh.userData.handsTossed) {
      // Leave the hands where they were at the throw, in rig space.
      for (const h of hands) {
        mesh.add(h.obj);
        h.obj.position.copy(h.pos);
        h.obj.quaternion.copy(h.quat);
        h.obj.position.applyQuaternion(_qRest).add(_vRest);
        h.obj.quaternion.premultiply(_qRest);
        h.rigPos.copy(h.obj.position);
        game.weaponRig.add(h.obj);
      }
      mesh.userData.handsTossed = true;
    }
    // Sink out of view while it's up, rise back for the catch.
    const down = rise(t, MELEE_T_TOSS, MELEE_T_FLOAT) * (1 - rise(t, MELEE_T_DROP - 0.04, MELEE_T_CATCH));
    for (const h of hands) {
      h.obj.visible = mesh.visible;
      h.obj.position.copy(h.rigPos);
      h.obj.position.y -= 0.24 * down;
      h.obj.position.z += 0.05 * down;
    }
  }
}

function placeByCenter(mesh, quat, centerPos, localCenter) {
  mesh.quaternion.copy(quat);
  _vCenter.copy(localCenter).applyQuaternion(quat);
  mesh.position.copy(centerPos).sub(_vCenter);
}

/* Reload animation (DESIGN-ARMS.md Phase 3): the weapon dips down and tilts
   away from view for the middle stretch of the reload, staged into named
   phases keyed off normalized progress `t` (0..1) rather than one flat dip
   — timed off the same w.reloading/reloadT/reloadTime the ammo swap already
   uses (reloadTime is the per-instance duration set by startReload(), which
   already differs between an empty reload and a faster tac reload), so
   staging can never fall out of sync with when ammo actually lands.

   Phase boundaries (fractions of `t`):
     0.00-0.12  raise    - weapon dips into reload pose
     0.12-0.42  magOut   - mag mesh drops out of the well (skipped entirely
                            on a tac reload's shorter timeline below)
     0.42-0.72  magIn    - fresh mag rises back into the well
     0.72-1.00  settle   - weapon returns to combat pose
   A tac reload (round already chambered) compresses this to raise/magIn/
   settle only — no empty mag to visibly drop, matching startReload()'s
   `reloadWasEmpty` branch. */
const _reloadPose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
let reloadEventsFiredFor = null; // WeaponState instance we've already fired start/complete events for

const MAG_HOLD_SCREEN = new THREE.Vector3(-0.05, -0.17, -0.62);
const MAG_DROP_SCREEN = new THREE.Vector3(-0.06, -0.7, -0.45);
const MAG_HOLD_QUAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0.5, -0.3));
const _magRestQ = new THREE.Quaternion();
const _magRestE = new THREE.Euler();
const _magHoldQ = new THREE.Quaternion();
const _magHold = new THREE.Vector3();
const _magDrop = new THREE.Vector3();
function reloadPose(w, mesh) {
  const p = _reloadPose;
  const mag = mesh?.userData.magMesh;

  if (!w.reloading || !w.reloadTime) {
    p.x = p.y = p.z = p.pitch = p.yaw = p.roll = p.magHold = 0;
    // magT too: `p` is shared, and a reload cut short by death left the
    // last mid-reload value here, so placeReloadMag kept every gun after it
    // (the respawned one included) holding its mag out in the air.
    p.shellT = p.rack = p.magT = p.akimboT = p.portShell = -1;
    p.pumpBack = null;
    if (mag) {
      mag.visible = true;
      mag.position.copy(mesh.userData.magazinePoint);
      mag.rotation.x = mesh.userData.magRestRotationX ?? mag.userData.restRotX ?? mag.rotation.x;
    }
    if (reloadEventsFiredFor === w) {
      if (!w.reloadCut) game.audio.reloadComplete();
      reloadEventsFiredFor = null;
    }
    return p;
  }

  if (w.def.hellfire && w.def.shellReload) return soulBlazerReloadPose(w, p);
  if (w.def.shellReload) return shellReloadPose(w, mesh, p);
  if (w.def.akimbo) {
    // akimbo-view.js moves the two guns themselves (and plays the
    // cylinder, brass and speedloader sounds); the pair's root stays put.
    reloadEventsFiredFor = w;
    p.x = p.y = p.z = p.pitch = p.yaw = p.roll = p.magHold = 0;
    p.shellT = p.rack = p.magT = -1;
    p.akimboT = 1 - Math.max(0, w.reloadT) / w.reloadTime;
    return p;
  }

  if (reloadEventsFiredFor !== w) {
    if (w.def.candleShot) game.audio.tankSwap(w.reloadTime);
    else if (w.def.pistolSound) game.audio.pistolReload(w.reloadTime);
    else game.audio.reload();
    reloadEventsFiredFor = w;
  }

  const total = w.reloadTime;
  const t = 1 - Math.max(0, w.reloadT) / total;  // 0..1 through the reload

  // Phantom Forces reload (user's reference clip): the gun rolls well over
  // (~40°, magwell toward you, muzzle up), the left arm pulls the mag out
  // and down off screen, brings a fresh one up on the same arc, seats it,
  // and the gun rolls back. The envelope eases in over the first 14% and
  // out over the last 26%.
  const dip = Math.sin(Math.min(1, t / 0.14) * Math.PI / 2)
    * Math.sin(Math.min(1, (1 - t) / 0.26) * Math.PI / 2);
  // Sidearms tip over less, or the pistol rolls half off the screen.
  const rollK = mesh?.userData.supportHandPos ? 1 : 0.55;
  p.x = -dip * 0.05;
  p.y = -dip * 0.1 * rollK;
  p.z = dip * 0.04;
  p.pitch = dip * 0.32;
  p.yaw = -dip * 0.12;
  p.roll = dip * 0.72 * rollK;

  // Stages: reach 0.08-0.18, pull out 0.18-0.34 to the hold point, down
  // off screen for the swap 0.34-0.44, back up 0.46-0.56, seat 0.56-0.70,
  // arm back to the handguard 0.72-0.84. A tac reload runs the same beats
  // (PF swaps the mag either way); its shorter reloadTime makes it quicker.
  // The mag itself is placed by placeReloadMag once the gun is posed.
  p.magT = mag && mesh ? t : -1;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  p.magHold = p.magT < 0 ? 0 : smoothstep(clamp01((t - 0.08) / 0.1)) * (1 - smoothstep(clamp01((t - 0.72) / 0.12)));
  return p;
}

/* Shell-by-shell reload (the Grinmington, BO2's 870): the gun rolls over
   to show the loading port under the receiver and tips its muzzle up; each
   shell rides up on the support arm and is thumbed in (a small forward
   shove as it seats). An empty gun ends on a rack of the pump. Driven by
   WeaponState's shell stages, so the pose can't drift from the ammo count. */
function shellReloadPose(w, mesh, p) {
  const sr = w.def.shellReload;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const k = 1 - Math.max(0, w.shellT) / Math.max(0.001, w.shellDur);   // 0..1 through the stage
  let env = 1;
  if (w.shellStage === "start") env = smoothstep(k);
  else if (w.shellStage === "end") env = smoothstep(clamp01(Math.max(0, w.shellT) / sr.end));
  let shove = 0;
  p.shellT = -1;
  if (w.shellStage === "shell") {
    p.shellT = k;
    // Thumbed home over the last third of each shell.
    shove = Math.sin(clamp01((k - 0.62) / 0.38) * Math.PI);
  }
  p.x = -env * 0.03;
  p.y = -env * 0.05 + shove * 0.006;
  p.z = env * 0.02 - shove * 0.018;
  p.pitch = env * 0.2;
  p.yaw = -env * 0.06;
  p.roll = env * 0.62;      // port side (underneath) turned toward you
  p.magT = -1;
  // The support arm leaves the forend for each shell.
  p.magHold = p.shellT < 0 ? 0 : Math.sin(clamp01(p.shellT / 0.85) * Math.PI) * 0.9;
  // The rack: first sr.rack seconds of an empty gun's "end" stage.
  p.rack = -1;
  if (w.shellStage === "end" && w.shellDur > sr.end + 1e-4 && w.shellT > sr.end) {
    p.rack = 1 - (w.shellT - sr.end) / sr.rack;
  }
  return p;
}

/* The pump forend: back and forward after each shot (pumpT) and on the
   empty-reload rack. 0..1 progress -> how far back (0 = home). */
const PUMP_TRAVEL = 0.085;
function placePump(mesh, w, rackT, backOverride = null) {
  const pump = mesh?.userData.pumpMesh;
  if (!pump) return;
  // The Soul Blazer's port load holds the pump open, then slams it home.
  if (backOverride != null) { pump.position.z = mesh.userData.pumpRestZ + backOverride * PUMP_TRAVEL; return; }
  let t = -1;
  if (rackT >= 0) t = rackT;
  else if (w.pumpT > 0 && w.pumpDur > 0 && w.def.fireMode === "pump") t = 1 - w.pumpT / w.pumpDur;
  // A beat after the shot, a hard pull back, a hold, then home.
  const back = t < 0 ? 0 : t < 0.18 ? 0 : t < 0.45 ? smoothstep((t - 0.18) / 0.27)
    : t < 0.55 ? 1 : t < 0.85 ? 1 - smoothstep((t - 0.55) / 0.3) : 0;
  pump.position.z = mesh.userData.pumpRestZ + back * PUMP_TRAVEL;
}

/* The shell in the support hand: from low left (off the bandolier) up to
   the loading port, then gone into the tube. */
const SHELL_HOLD_SCREEN = new THREE.Vector3(-0.07, -0.2, -0.5);
const _shellHold = new THREE.Vector3();
function placeReloadShell(mesh, t, portT = -1) {
  const shell = mesh?.userData.shellMesh;
  if (!shell) return;
  // The Soul Blazer's port load: dropped in from above the open port.
  if (portT >= 0 && mesh.userData.ejectPort) {
    const k = smoothstep(Math.min(1, portT));
    shell.position.copy(mesh.userData.ejectPort).add(_shellHold.set(0.004 + 0.1 * (1 - k), 0.03 * (1 - k), 0.006 * (1 - k)));
    shell.rotation.set(0, 0, Math.PI / 2 * (1 - k));
    shell.visible = portT < 0.97;
    return;
  }
  shell.rotation.set(0, 0, 0);
  if (t < 0 || t > 0.9) { shell.visible = false; return; }
  mesh.updateMatrixWorld(true);
  const port = mesh.userData.loadPort;
  const hold = mesh.worldToLocal(_shellHold.copy(SHELL_HOLD_SCREEN));
  const up = smoothstep(Math.min(1, t / 0.55));
  shell.position.lerpVectors(hold, port, up);
  // Pushed forward into the tube for the last stretch.
  if (t > 0.62) shell.position.z -= smoothstep((t - 0.62) / 0.28) * 0.05;
  shell.visible = true;
}

/* Sounds that ride WeaponState's own timeline (shell in, pump, rack). */
function drainWeaponEvents(w) {
  if (!w.events?.length) return;
  for (const e of w.events) {
    if (e === "shell") { game.audio.shellIn(); if (w.def.hellfire) sbFed(game.activeWeaponMesh); }
    else if (e === "pump") { game.audio.pump(w.pumpDur); if (w.def.hellfire) soulBlazerKick(game.activeWeaponMesh, 0.8); }
    else if (e === "rack") game.audio.pump(w.def.shellReload.rack);
    // "portload" (the Soul Blazer's port shell going home) is played at the
    // pump slam instead, by updateSoulBlazerHand.
  }
  w.events.length = 0;
}

/* ---- the Soul Blazer in hand (soul-blazer.js does the gun itself) ---- */

const _sbEye = new THREE.Vector3();
let sbCueT = -1;
let sbWaveZ = null;

/* A shell thumbed into the tube: its skull's eyes light (the counter does
   that), an ember puff from the port, a gulp, the charms jump. */
function sbFed(mesh) {
  if (!mesh?.userData.sb) return;
  game.audio.soulGulp();
  soulBlazerKick(mesh, 0.6);
  _sbEye.copy(mesh.userData.loadPort).applyMatrix4(mesh.matrixWorld);
  for (let i = 0; i < 6; i++) {
    game._sbDir.set((Math.random() - 0.5) * 0.6, -0.2 - Math.random() * 0.4, (Math.random() - 0.5) * 0.6);
    game.hellfireView.ember(_sbEye, game._sbDir, { size: 0.02, life: 0.4 });
  }
}

/* The pump slammed home on an empty gun: it relights with a roar. */
function sbRelight(mesh) {
  soulBlazerIgnite(mesh);
  game.audio.soulRoar();
  soulBlazerMouth(mesh, game._sbPos, game._sbDir);
  game.hellfireView.roar(game._sbPos, game._sbDir);
  game.kickFireShake(currentWeapon().def, 0.35);
}

function sbEyesWorld(mesh, fn) {
  const sb = mesh.userData.sb;
  mesh.updateMatrixWorld(true);
  for (let i = 0; i < Math.min(2, sb.halos.length); i++) {
    if (sb.halos[i] === sb.mouthHalo) continue;
    fn(_sbEye.copy(sb.halos[i].position).applyMatrix4(mesh.matrixWorld));
  }
}

function sbInspectCue(mesh, cue, dead) {
  switch (cue) {
    case "pentagram": game.audio.soulTick(0.5, !dead); break;
    case "eyes": if (!dead) game.audio.soulTick(1, true); break;
    case "growl": if (dead) game.audio.dryRasp(); else game.audio.soulGrowl(); break;
    case "tongue":
      soulBlazerMouth(mesh, game._sbPos, game._sbDir);
      if (dead) game.hellfireView.wisp(game._sbPos, 2);
      else { game.hellfireView.tongue(game._sbPos, game._sbDir); game.audio.fireWhoosh(0.35); }
      break;
    case "clack": game.audio.jawClack(); break;
    case "smoke": sbEyesWorld(mesh, (p) => game.hellfireView.wisp(p, 1)); break;
    case "roll": game.audio.chainJingle(1); break;
    case "rattle": game.audio.chainJingle(0.75); soulBlazerKick(mesh, 0.9); break;
    default:
  }
}

/* Per frame for the gun in hand: what only the shooter knows (ammo, the
   real-world view for the charms), the relight at the pump slam, and the
   admire's ember wave, jaw and cues. */
function updateSoulBlazerHand(mesh, w) {
  const sb = mesh.userData.sb;
  game.weaponCamera.updateMatrixWorld();
  game._sbView.multiplyMatrices(game.camera.matrixWorld, game.weaponCamera.matrixWorldInverse);
  if (w.shellStage === "port" && w.reloading) {
    const k = 1 - Math.max(0, w.shellT) / Math.max(0.001, w.shellDur);
    if (k >= 0.62 && !w.sbRelit) { w.sbRelit = true; sbRelight(mesh); }
  } else w.sbRelit = false;
  updateSoulBlazerView(mesh, w, game._sbView);
  if (w.sbRelit) sb.ammo = Math.max(sb.ammo, 1);   // relit before the shell is counted

  const t = game.inspectT > 0 && game.player.holding === "gun" ? inspectProgress() : -1;
  const dead = w.ammoInMag <= 0;
  soulBlazerInspect(mesh, t, dead);
  if (t >= 0) {
    for (const [ct, cue] of SB_INSPECT_CUES) if (sbCueT < ct && t >= ct) sbInspectCue(mesh, cue, dead);
    // a soft tick as the ember wave lights each flank skull
    if (sb.waveAt != null && sbWaveZ != null) {
      for (const z of sb.slotZ || []) if ((sbWaveZ - z) * (sb.waveAt - z) < 0) game.audio.soulTick(0.3, true);
    }
    sbWaveZ = sb.waveAt;
    sbCueT = t;
  } else {
    sbCueT = -1;
    sbWaveZ = null;
  }
}

/* Green Candles, per frame: the gauge shows what's in the tank; the candle
   breathes, dims as the tank runs down, flickers when it's nearly dry,
   brightens with the charge and flares on every shot while a pulse of
   light runs down the hose into the body. On a reload the old tank keeps
   its reading until it's off (magT 0.46), the candle goes out with the
   hose disconnected, the fresh tank fills bottom to top as it seats, and
   the candle catches again. Also drives the charge ring. */
function updateGreenCandles(mesh, w, magT, dt) {
  const gc = mesh.userData.gc;
  const charging = !!gc && w.charging;
  game.els.charge.hidden = !charging || game.player.holding !== "gun";
  if (!gc) return;
  const s = mesh.userData.gcState || (mesh.userData.gcState = { shown: w.ammoInMag / w.def.magSize, flare: 0, pulse: -1, amp: 0, t: 0 });
  s.t += dt;
  const size = w.def.magSize;
  let target = w.ammoInMag / size;
  let lit = 1;
  if (w.reloading && magT >= 0) {
    if (magT >= 0.46) target = (Math.min(size, w.ammoInMag + w.ammoReserve) / size) * smoothstep(Math.min(1, Math.max(0, (magT - 0.56) / 0.2)));
    if (magT < 0.3) lit = 1 - 0.88 * smoothstep(magT / 0.3);
    else if (magT < 0.72) lit = 0.12;
    else lit = 0.12 + 0.88 * smoothstep(Math.min(1, (magT - 0.72) / 0.14)) * (0.7 + 0.3 * Math.abs(Math.sin(s.t * 40)));
  }
  s.shown = damp(s.shown, target, 14, dt);
  gc.gaugeFill.scale.z = Math.max(0.001, s.shown);

  const c = w.def.charge;
  const level = w.chargeLevel;
  const full = charging && w.chargeT >= c.time * Math.max(0.2, w.chargeCap);
  if (w.shotFlare) {
    s.flare = 1 + (w.lastShotLevel || 0) * 1.5;
    s.pulse = 0;
    s.amp = 2.5 + (w.lastShotLevel || 0) * 4;
    w.shotFlare = 0;
  }
  s.flare *= Math.exp(-dt * 8);
  if (s.pulse >= 0) {
    s.pulse += dt / 0.2;
    if (s.pulse > 1.3) s.pulse = -1;
  } else if (charging && level > 0.05) {
    // While charging, pulses feed the candle, quicker as it fills.
    s.pulse = 0;
    s.amp = 1.2 + level * 2;
  }
  const low = w.ammoInMag / size < 0.2 ? 0.28 * Math.max(0, Math.sin(s.t * 9) * Math.sin(s.t * 2.3 + 1)) : 0;
  const flicker = 1 + 0.05 * Math.sin(s.t * 21) + 0.035 * Math.sin(s.t * 33.7) - low;
  const fuel = 0.4 + 0.6 * s.shown;
  const g = gc.glow;
  const set = (m, k) => { if (m) m.emissiveIntensity = m.userData.baseEmissive * k; };
  set(g.GC_CandleCore, lit * fuel * flicker * (1 + 0.55 * level) + s.flare * 1.2);
  set(g.GC_CandleShell, lit * (0.5 + 0.5 * fuel) * flicker * (1 + 0.9 * level) + s.flare * 0.8);
  set(g.GC_Wick, lit * flicker * (1 + 1.2 * level) + s.flare * 1.2);
  set(g.GC_HoseGlow, (0.35 + 0.65 * lit) * (1 + 0.7 * level));
  set(g.GC_Gauge, 0.75 + 0.25 * flicker + (full ? 0.5 * Math.abs(Math.sin(s.t * 14)) : 0));
  set(g.GC_Led, full ? (Math.sin(s.t * 18) > 0 ? 1.6 : 0.3) : lit);
  const [haloCandle, haloWick] = gc.halos;
  const hk = lit * (0.7 + 0.3 * fuel) * flicker;
  haloCandle.material.opacity = haloCandle.userData.base.opacity * (hk * (1 + 1.1 * level) + s.flare * 1.4);
  haloCandle.scale.setScalar(haloCandle.userData.base.size * (0.9 + 0.35 * level + 0.35 * s.flare));
  haloWick.material.opacity = Math.min(1, haloWick.userData.base.opacity * (hk * (1 + 1.6 * level) + s.flare * 1.2));
  haloWick.scale.setScalar(haloWick.userData.base.size * (0.9 + 0.9 * level + 0.8 * s.flare));
  const pu = g.GC_HoseGlow?.userData.pulse;
  if (pu) {
    pu.uPulse.value = s.pulse;
    pu.uPulseAmp.value = s.pulse >= 0 ? s.amp : 0;
  }
  // A held full charge strains in the hands.
  if (full) {
    mesh.position.x += (Math.random() - 0.5) * 0.0024;
    mesh.position.y += (Math.random() - 0.5) * 0.0024;
  }

  if (charging) {
    game.els.charge.style.setProperty("--p", level.toFixed(3));
    game.els.charge.classList.toggle("is-full", full);
    const cells = w.chargeT >= c.minHold ? chargedShotDef(w.def, level).cells : 1;
    game.els.chargeCells.textContent = w.chargeT >= c.minHold ? `${cells} ${cells === 1 ? "CELL" : "CELLS"}` : "";
  }
}

/* The mag's path is picked in screen (weapon-camera) space and brought into
   the gun's frame, so it has to run after this frame's gun pose: out of the
   well to a hold point low and left of centre where you see it in the hand
   (as in PF), down off screen for the swap, and the same way back. */
function placeReloadMag(mesh, t) {
  const mag = mesh?.userData.magMesh;
  if (!mag || t < 0) return;
  const rest = mesh.userData.magazinePoint;
  if (mag.userData.restRotX == null) mag.userData.restRotX = mag.rotation.x;
  const restRot = mesh.userData.magRestRotationX ?? mag.userData.restRotX;
  const seg = (a, b) => smoothstep(Math.max(0, Math.min(1, (t - a) / (b - a))));
  mesh.updateMatrixWorld(true);
  // Sidearms (no support hand) keep it tight: straight down out of the
  // grip and back, in the gun's own frame.
  const sidearm = !mesh.userData.supportHandPos;
  const hold = sidearm ? _magHold.set(rest.x, rest.y - 0.13, rest.z + 0.02)
    : mesh.worldToLocal(_magHold.copy(MAG_HOLD_SCREEN));
  const drop = sidearm ? _magDrop.set(rest.x, rest.y - 0.5, rest.z + 0.06)
    : mesh.worldToLocal(_magDrop.copy(MAG_DROP_SCREEN));
  if (t < 0.34) mag.position.lerpVectors(rest, hold, seg(0.18, 0.34));
  else if (t < 0.45) mag.position.lerpVectors(hold, drop, seg(0.34, 0.44));
  else if (t < 0.56) mag.position.lerpVectors(drop, hold, seg(0.46, 0.56));
  else mag.position.lerpVectors(hold, rest, seg(0.56, 0.7));
  const away = t < 0.45 ? seg(0.18, 0.34) : 1 - seg(0.56, 0.7);
  // In the hand it hangs upright on screen, tipped toward you, whatever
  // the gun's roll: slerp from its seated rotation to that screen pose.
  _magRestQ.setFromEuler(_magRestE.set(restRot, 0, 0));
  if (sidearm) _magHoldQ.setFromEuler(_magRestE.set(restRot + 0.3, 0, 0));
  else mesh.getWorldQuaternion(_magHoldQ).invert().multiply(MAG_HOLD_QUAT);
  mag.quaternion.copy(_magRestQ).slerp(_magHoldQ, away);
  mag.visible = true;
}

const _laserRay = new THREE.Raycaster();
const _laserOrigin = new THREE.Vector3();
const _laserDir = new THREE.Vector3();
const LASER_ADS_THRESHOLD = 0.4; // beam only reads as "activated" once the sight has actually come up

/* The laser attachment only exists on the gun model if it's equipped
   (weapon-model.js), so absence of the beam node means "no laser" — nothing
   here needs to re-check the loadout. Aiming, not equipping, turns it on:
   the beam is dark until the sight comes up, same as the reflex/ACOG glass. */
function updateLaserBeam(mesh, w) {
  const beam = mesh.userData.laserBeam;
  if (!beam) return;
  if (w.adsT < LASER_ADS_THRESHOLD) { beam.visible = false; return; }

  game.camera.getWorldPosition(_laserOrigin);
  game.camera.getWorldDirection(_laserDir);

  let range = raycastWorld(game.colliders, _laserOrigin, _laserDir, 60);
  if (game.targetMeshes.length) {
    _laserRay.set(_laserOrigin, _laserDir);
    _laserRay.near = 0;
    _laserRay.far = range;
    const hits = _laserRay.intersectObjects(game.targetMeshes, true);
    if (hits.length) range = hits[0].distance;
  }

  // Cylinder height runs along the geometry's own Y axis; rotation.x = 90deg
  // (set at build time) is what points that axis down the barrel, so the
  // beam is stretched with scale.y, not scale.z, and re-centered along
  // local Z to keep its near end pinned at the laser unit.
  const origin = mesh.userData.laserOrigin;
  const len = Math.max(0.02, range - (-origin.z));
  beam.scale.y = len;
  beam.position.z = origin.z - len / 2;
  const fade = Math.min(1, (w.adsT - LASER_ADS_THRESHOLD) / (1 - LASER_ADS_THRESHOLD));
  beam.material.opacity = 0.85 * fade;
  beam.visible = true;
}

/* Viewmodel animation layers, composed additively in this fixed order
   (DESIGN-ARMS.md §3.1) — every new term this system gains belongs in one
   of these, not a parallel transform:
     1. base pose      - hip<->ADS lerp (basePos)
     2. movement       - bob (bobX/Y), sway (swayX/Y)
     3. inertia        - swaySmoothX/Y lag, weaponLowerT sprint/slide/busy lower
     4. recoil         - viewKick*
     5. reload/action  - rl (reloadPose)
     6. melee          - handled separately in updateMeleeView; REPLACES the
                         base pose outright during an active swing rather
                         than adding to it
     7. camera reaction - lives outside this function entirely; must stay a
                         smaller, separately-tuned effect, never the same
                         numbers as the viewmodel response above */
/* Optic glass is tinted so the lens reads as glass from the hip, but that
   tint sat between the eye and the target once aimed. Clear it as the gun
   comes up; the reticle draws on its own material and stays lit. */
function fadeOpticGlass(mesh, adsT) {
  let mats = mesh.userData.glassMats;
  if (!mats) {
    mats = [];
    mesh.traverse((o) => { if (o.material?.userData?.isGlass) mats.push(o.material); });
    mesh.userData.glassMats = mats;
  }
  for (const m of mats) m.opacity = m.userData.baseOpacity * (1 - 0.9 * adsT);
}

export function updateWeaponView(dt) {
  const w = currentWeapon();
  updateInspect(dt);
  game.updateMeleeView(dt);
  game.updateStreakView(dt);
  const mesh = game.activeWeaponMesh;
  // Streak preempts the gun/melee mesh per DESIGN-ARMS.md §3.3's priority
  // stack — return before any weapon-view math runs so weaponLowerT/insp/rl
  // don't fight the device pose for ownership of activeWeaponMesh (which is
  // simply hidden, not touched, while holding === "streak").
  if (!game.saberArmsOn) pfArms.visible = false;   // posePfArms below re-shows them on a held gun
  // The streak device has its own arms (streakArms): the gun's rods go.
  if (game.player.holding === "streak") { pfArms.visible = false; return; }
  if (!mesh) return;

  // Aiming plants the sight: bob and idle sway fall away as the weapon
  // comes up, so walking while aimed no longer swims the whole gun across
  // the screen the way full-amplitude bob did.
  const steady = 1 - w.adsT * 0.85;
  // Settle: eases toward 1 while moving, toward 0 at rest, on top of (not
  // instead of) bobPhase freezing — the freeze already stops the wave from
  // continuing, this stops the amplitude from cutting off abruptly with it.
  bobSettleT = damp(bobSettleT, game.move.moving ? 1 : 0, game.move.moving ? 10 : 5, dt);
  const bobX = Math.sin(w.bobPhase) * w.def.bobAmp * 0.5 * steady * bobSettleT;
  const bobY = Math.abs(Math.cos(w.bobPhase)) * w.def.bobAmp * steady * bobSettleT;
  const rawSwayX = Math.sin(game.clock.elapsedTime * w.def.swaySpeed) * w.def.swayAmp * steady;
  const rawSwayY = Math.cos(game.clock.elapsedTime * w.def.swaySpeed * 0.8) * w.def.swayAmp * 0.6 * steady;
  // Directional strafe lean: a small extra lag-behind tilt keyed to strafe
  // direction, on top of the symmetric idle sway above, so left/right reads
  // as different rather than mirrored. move.strafeInput is -1 (left)..1
  // (right), already computed every frame by movement.js's own update().
  const strafeLean = (game.move.strafeInput ?? 0) * 0.012 * steady;
  // A heavier gun (lower `inertia` — the same field move.update() already
  // reads for how sluggish it turns) lags a beat behind its own sway target
  // instead of just swaying a smaller amount. Same idea as a real barrel's
  // momentum: it doesn't matter how little it moves if it moves instantly.
  const swayLag = Math.min(1, dt * (w.def.inertia ?? 8));
  game.swaySmoothX += (rawSwayX + strafeLean - game.swaySmoothX) * swayLag;
  game.swaySmoothY += (rawSwayY - game.swaySmoothY) * swayLag;
  const swayX = game.swaySmoothX, swayY = game.swaySmoothY;

  const adsOffset = w.adsT;
  // Heavier weapons settle into position more slowly (lower lambda = more
  // lag) — same `inertia`/`model.heavy` signals already used for sway lag
  // and the sprint roll above, not new per-weapon data.
  const adsLambda = w.def.model?.heavy ? 10 : (w.def.inertia ?? 8) * 1.6;
  adsSmoothT = damp(adsSmoothT, adsOffset, adsLambda, dt);
  // The gun rides high and close enough that the rods holding it are in
  // view (CoD-style framing).
  const hipPos = new THREE.Vector3(0.2, -0.165, -0.5);
  if (mesh.userData.hipOffset) hipPos.add(mesh.userData.hipOffset);
  const aimPoint = mesh.userData.aimPoint || new THREE.Vector3(0, 0, -0.4);
  // Where the sight sits in front of the weapon camera. Tube optics ask to
  // come closer so the eyepiece frames the view rather than a pinhole.
  const adsViewDistance = -(mesh.userData.adsDistance ?? 0.46);
  const adsPos = new THREE.Vector3(-aimPoint.x, -aimPoint.y, adsViewDistance - aimPoint.z);
  const basePos = hipPos.clone().lerp(adsPos, adsSmoothT);

  // Gun drops out of the way while sprinting, sliding or vaulting.
  const wantLower = (game.move.sprinting || game.move.stance === STANCE.SLIDE || game.move.busy) ? 1 : 0;
  game.weaponLowerT = damp(game.weaponLowerT, wantLower, 9, dt);
  // "Sling to the side" roll tracks the same sprint/lower gate, but at its
  // own (slightly slower) rate so the roll settles in a beat after the
  // straight lower does — that stagger is what makes the sprint-out read as
  // two things happening (drop, then swing) rather than one linear slide.
  sprintRollT = damp(sprintRollT, wantLower, 6, dt);

  // Landing impact: capture once on the justLanded edge, then let it decay.
  // Caller (this function) is responsible for clearing justLanded, per the
  // contract documented at movement.js's own justLanded assignment.
  if (game.move.justLanded) {
    landDipMag = Math.min(1, game.move.landSpeed / LAND_DIP_MAX_SPEED);
    landDipT = 1;
    game.move.justLanded = false;
  }
  landDipT = damp(landDipT, 0, 7, dt);

  const insp = inspectPose();
  const rl = reloadPose(w, mesh);
  const landPos = LAND_DIP_POS * landDipMag * landDipT;
  const landPitch = LAND_DIP_PITCH * landDipMag * landDipT;
  // Heavier weapons swing further into the sprint roll (def.heavy / a longer
  // model.len both already exist as the "this gun is bigger" signals used
  // elsewhere in weapon-model.js — reused here rather than adding new data).
  const weightMult = w.def.model?.heavy ? 1.35 : 1;
  const sprintRoll = sprintRollT * 0.22 * weightMult;
  // PF sprint cant (user's reference clip): the gun swings across the body,
  // muzzle up and to the LEFT, a diagonal rather than straight up the right.
  const sprintCant = sprintRollT * 0.5;

  // Turn lag (PF): the gun trails the view when you turn and rolls into
  // it, heavier guns further. Look rates are per second, wrapped yaw.
  const yawStep = Math.atan2(Math.sin(game.look.yaw - lastLookYaw), Math.cos(game.look.yaw - lastLookYaw));
  const yawRate = dt > 0 ? yawStep / dt : 0;
  const pitchRate = dt > 0 ? (game.look.pitch - lastLookPitch) / dt : 0;
  lastLookYaw = game.look.yaw;
  lastLookPitch = game.look.pitch;
  const lagK = (w.def.model?.heavy ? 1.3 : 1) * (1 - adsOffset * 0.8);
  turnLagX = damp(turnLagX, THREE.MathUtils.clamp(yawRate * 0.009, -0.05, 0.05) * lagK, 10, dt);
  turnLagY = damp(turnLagY, THREE.MathUtils.clamp(pitchRate * 0.006, -0.035, 0.035) * lagK, 10, dt);

  mesh.position.set(
    basePos.x + bobX + swayX - w.viewKickKnockback * 0.4 + game.weaponLowerT * 0.02 + turnLagX + insp.x + rl.x,
    basePos.y + bobY + swayY - game.weaponLowerT * 0.15 - landPos - turnLagY + insp.y + rl.y,
    basePos.z + w.viewKickKnockback * 0.6 + game.weaponLowerT * 0.08 + insp.z + rl.z
  );
  mesh.rotation.set(
    -w.viewKickPitch * 0.8 + game.weaponLowerT * 0.45 + landPitch - turnLagY * 2 + insp.pitch + rl.pitch,
    w.viewKickYaw * 0.6 + (1 - adsOffset) * (0.05 + (mesh.userData.hipYaw ?? 0)) + sprintCant + turnLagX * 2 + insp.yaw + rl.yaw,
    (1 - adsOffset) * 0.08 + game.weaponLowerT * 0.38 + sprintRoll + turnLagX * 4 + insp.roll + rl.roll + w.viewKickRoll
  );
  applyGunInspect(mesh, w);
  if (mesh.userData.akimbo) {
    game.akimboView.update(mesh, w, dt, { reload: rl.akimboT ?? -1, inspect: game.inspectT > 0 && game.player.holding === "gun" ? inspectProgress() : -1 });
    game.akimboShown = true;
  } else if (game.akimboShown) {
    game.akimboView.hideFx();
    game.akimboShown = false;
  }
  placeReloadMag(mesh, rl.magT ?? -1);
  // A pistol works its slide (pistol-action.js); the empty reload ends on
  // the slide slamming home, with a little kick.
  if (mesh.userData.pistolAction) {
    const admire = game.inspectT > 0 && game.player.holding === "gun" ? inspectProgress() : -1;
    if (placePistolSlide(mesh, w, rl.magT ?? -1, admire) === "release") {
      game.audio.slideRelease();
      w.viewKickPitch += 0.012;
    }
  }
  // A bolt rifle works its bolt after each shot (rifle-action.js).
  const boltBeat = placeBolt(mesh, w, rl.magT ?? -1);
  if (boltBeat) game.audio.boltBeat(boltBeat);
  updateGreenCandles(mesh, w, rl.magT ?? -1, dt);
  placeReloadShell(mesh, rl.shellT ?? -1, rl.portShell ?? -1);
  placePump(mesh, w, rl.rack ?? -1, rl.pumpBack ?? null);
  if (mesh.userData.sb) updateSoulBlazerHand(mesh, w);
  drainWeaponEvents(w);
  posePfArms(mesh, rl.magHold || 0);

  if (mesh.userData.sight) mesh.userData.sight.visible = true;
  fadeOpticGlass(mesh, adsSmoothT);
  updateLaserBeam(mesh, w);

  if (game.muzzleFlashT > 0) {
    game.muzzleFlashT -= dt;
    game.muzzleMat.uniforms.uIntensity.value = Math.max(0, game.muzzleFlashT / 0.045) * w.def.muzzleFlashScale;
    game.muzzleFlash.rotation.z += 20 * dt;
  } else {
    game.muzzleMat.uniforms.uIntensity.value = 0;
  }
  game.muzzleLight.intensity *= Math.max(0, 1 - dt * 30);
  const barrelTipLocal = new THREE.Vector3(0, 0.02, mesh.userData.muzzleZ ?? -0.62);
  game.muzzleFlash.position.copy(basePos).add(barrelTipLocal);
  if (mesh.userData.akimbo) game.akimboView.muzzleLocal(mesh, w.akimboSide ?? 0, game.muzzleFlash.position);
  game.muzzleLight.position.copy(game.muzzleFlash.position);
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initWeaponView() {
  game.weaponRig.add(inspectArms);
  game.weaponRig.add(pfArms);
}
