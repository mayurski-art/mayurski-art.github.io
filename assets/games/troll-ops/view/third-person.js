// Third person: the spring-arm chase camera, the emote and death cameras,
// the double-tap swivel, and posing our own body (updateLocalRig).

import * as THREE from "three";
import { raycastWorld } from "../weapons/ballistics.js?v=cg1-wst-hf1-fu1b7-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-or1-gf1-tg1";
import { currentWeapon } from "../combat/weapons.js?v=wp1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-ar0-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2";
import { stageFrozen, royaleSpectating, royaleRolling, royale, royaleAboard, royaleRollK, royaleDropCode, fallShowPose, dropCineSitK } from "../modes/royale.js?v=md1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2";
import { HOLD, RAMP_END } from "../modes/royale-hold.js?v=pl1-pl2-sr1-or1-rr1-tx1-sp1-kbt1-gb1";
import { STANCE } from "../core/movement.js?v=umb2-sb2-gj1b7-or1-gf1-tg1";
import { poseDeath, DEATH_TIME, aimRig, gaitPhaseRate, poseHumanoid, poseThrowArm, THROW_TIME, mountHeldWeapon } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { STANCE_LOWER, rollRig, DROP_FALL, DROP_GLIDE, poseDrop, poseRope, ROPE_CLIMB_RATE } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1";
import { emoteSeconds, poseEmoteCode, emoteCode, EMOTES } from "../characters/emotes.js?v=hb4-em1-wst-soc1-ng1c2f1m1u-gt1-gt2-cw1-zr10-bf1-sr1-or1-nf2-em2-cf1-gs2-lh1-fg2-lp1-fg3-rc1-rc4-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-ht2-bx1-cg1-mg1-sp1-chg1";
import { seated, standUp, syncLocalDrink, piano } from "../modes/social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2";
import { damp } from "../characters/anim-curves.js?v=or1";
import { clubPoseLocal } from "../modes/club-entry.js?v=ce1c1c2-wb1m1uc4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2";
import { saberBlock, kbShield, saberParry, kbRepair, SLOW_IGNITE } from "../combat/melee.js?v=ml1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2";
import { posePianoArms, poseSeated } from "../modes/rp-roles.js?v=rp1b7-cd1-sh1-dj2-or1-bw2-sp1";
import { stripLights, buildWeaponMesh } from "../weapons/weapon-model.js?v=p5-em1-wst-hf1-wb1-ar1-ar2-fj1-br1-or1-rt1-ut1-rb4-hp1-bx1-mg1-sp1";
import { buildMeleeMesh } from "../weapons/gear.js?v=to-hb1kb3-bk1-wst-ig1-th2-zr5-zr9-zr10-zp1-or1-rb4-hp1-bx1-mg1-sp1";
import { game } from "../core/state.js?v=st1";
import { throwState, poseThrowBody, clearThrowBody } from "../combat/throw-anim.js?v=ta1-th2-cl1-bp1-gt1-gt2-cw1-fj1-zr10-zc1-zc2-bf1-sr1-nf1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { modelKind } from "../combat/throwable-models.js?v=tm1-th2";
import { wearBlocky, ownBody } from "../characters/blocky-body.js?v=bk1-cw1-zr10-bf1-sr1-nf1-nx1-or1-nf2-em2-nb2-sb1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-gt1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-rb1-fg3-hd1-rc1-rc3-rc4-rc5-ls1-ut1-er1-cl1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-hl1-mg1-sp1-rh1";
import { freeLook } from "./free-look.js?v=nf1";
import { bodyToken } from "../characters/cosmetics.js?v=hb4-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-fj1-zr10-zc1-zc2-bf1-sr1-nf1-or1-nf2-nb1-em2-nb2-pc2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-sf1-mg1-sp1";

// Chase camera behind the player's own rig. Distance/side offset blend
// in from an over-the-shoulder position as ADS deepens (w.adsT), rather
// than snapping to first-person the way most third-person shooters with
// real iron sights do - this game keeps the model visible while aiming.
const TP_HIP_DIST = 3.2;
const TP_HIP_SIDE = 0.55;       // shoulder offset, hip-fire framing
const TP_ADS_DIST = 1.5;
const TP_ADS_SIDE = 0.5;
const TP_HEIGHT = 0.35;
const _tpPivot = new THREE.Vector3();
const _tpDesired = new THREE.Vector3();
const _tpDir = new THREE.Vector3();
const _tpRight = new THREE.Vector3();
const _tpForward = new THREE.Vector3();

/* Places `camera` behind `pivot` along the look direction (yaw/pitch),
   pulled in by raycastWorld so it never clips through a wall/floor. */
/* While emoting the camera swings round in front, a little above, and
   looks back at the operator's chest — the locker-room angle — pulled in
   if a wall is in the way. `pivot` is the eye position. */
export function updateEmoteCamera(pivot, yaw, duoDist = 0) {
  game._euler.set(0, yaw, 0);
  _tpForward.set(0, 0, -1).applyEuler(game._euler);
  _tpPivot.copy(pivot);
  _tpPivot.y -= 0.45;
  // A duo: look at the pair from a three-quarter angle, centred between
  // them (a straight side view shows both flat trollfaces edge-on).
  if (duoDist) {
    _tpPivot.addScaledVector(_tpForward, duoDist / 2);
    game._euler.set(0, yaw + 0.95, 0);
    _tpForward.set(0, 0, -1).applyEuler(game._euler);
  }
  _tpDir.copy(_tpForward).multiplyScalar(duoDist ? 3.3 : 2.7);
  _tpDir.y += 0.5;
  const wantLen = _tpDir.length();
  _tpDir.normalize();
  const safeLen = Math.max(0.6, raycastWorld(game.colliders, _tpPivot, _tpDir, wantLen) - 0.15);
  game.camera.position.copy(_tpPivot).addScaledVector(_tpDir, safeLen);
  game.camera.lookAt(_tpPivot);
}

/* The camera's spots behind you, best first: { side: which shoulder (and
   how far over), lift: m higher }. */
const TP_SPOTS = [{ side: 1, lift: 0 }, { side: -1, lift: 0 }, { side: 0.4, lift: 0.8 }, { side: 0, lift: 1.4 }];
let tpPick = 0;
/* Aboard the Royale plane the hold is ~3 m across and curved: its hull
   isn't a collider (the ghost hold has walls at the floor only), so the
   camera kept to a box inside it (plane-local, as royale-hold.js HOLD),
   closer in (user, 2026-10-18, a video: the camera hung 3 m back, swung
   shoulder to shoulder and out through the hull). It stays behind you
   even sat with the wall at your back (user, 2026-10-19: no camera
   turning round to show your face): with no room it's your own eyes.
   */
const AB_DIST = 2.1, AB_X = 1.0, AB_Y = [0.35, 2.25];
let tpEyes = false;
const _abLo = new THREE.Vector3(), _abHi = new THREE.Vector3();
function holdRoom(from, dir, want) {
  const o = royale.drop.origin;
  _abLo.set(o.x - AB_X, o.y + AB_Y[0], o.z + HOLD.fwd + 0.3);
  _abHi.set(o.x + AB_X, o.y + AB_Y[1], o.z + RAMP_END);
  let t = want;
  for (const ax of ["x", "y", "z"]) {
    const d = dir[ax];
    if (Math.abs(d) < 1e-6) continue;
    const lim = d > 0 ? (_abHi[ax] - from[ax]) / d : (_abLo[ax] - from[ax]) / d;
    t = Math.min(t, Math.max(0, lim));
  }
  return t;
}
/* Aim _tpDir at spot `i` (from the pivot); how far out it's clear (a small
   skin short of a wall or floor so it never rests on it) and how much of
   the wanted distance that is. */
const _tpRoom = { len: 0, k: 0 };
function tpSpot(i, dist, side, aboard = false) {
  const c = TP_SPOTS[i];
  _tpDesired.copy(_tpPivot).addScaledVector(_tpForward, -dist).addScaledVector(_tpRight, side * c.side);
  _tpDesired.y += TP_HEIGHT + c.lift;
  _tpDir.copy(_tpDesired).sub(_tpPivot);
  const want = _tpDir.length();
  _tpDir.normalize();
  let room = raycastWorld(game.colliders, _tpPivot, _tpDir, want);
  if (aboard) room = Math.min(room, holdRoom(_tpPivot, _tpDir, want) + 0.1);
  _tpRoom.len = Math.max(0.15, room - 0.1);
  _tpRoom.k = _tpRoom.len / want;
  return _tpRoom;
}

export function updateThirdPersonCamera(pivot, yaw, pitch, adsT) {
  // A U Mad Bro? hero body is far wider than the stick figure (the Knight's
  // head and pauldrons): sit further back and further out so it never
  // covers the crosshair.
  const big = game.localRig.heroBodyId ? 1 : 0;
  const aboard = royaleAboard() && !!royale.drop?.origin;
  const dist = aboard ? AB_DIST : TP_HIP_DIST + (TP_ADS_DIST - TP_HIP_DIST) * adsT + big * 0.5;
  const side = TP_HIP_SIDE + (TP_ADS_SIDE - TP_HIP_SIDE) * adsT + big * 0.32;

  game._euler.set(pitch, yaw, 0);
  _tpForward.set(0, 0, -1).applyEuler(game._euler);
  _tpRight.set(1, 0, 0).applyEuler(game._euler);

  _tpPivot.copy(pivot);
  // Over the shoulder, or, when a wall's right behind you (a corridor, the
  // plane's hold), the other shoulder or higher up: whichever has the room,
  // so the camera doesn't end up inside your own body (user, 2026-10-18:
  // "users should be able to see themselves"). It never swings round you on
  // its own (that spun the view as you turned); to see your face, free look
  // (Alt, Select, the eye).
  const spots = TP_SPOTS.length;
  let best = tpSpot(tpPick, dist, side, aboard).k;
  if (best < 0.85) {
    // Boxed in: the spot with the most room (a clear margin to change, so
    // it doesn't flick between two).
    for (let i = 0; i < spots; i++) {
      if (i === tpPick) continue;
      const k = tpSpot(i, dist, side, aboard).k;
      if (k > best + 0.15) { tpPick = i; best = k; }
    }
  } else if (tpPick !== 0 && tpSpot(0, dist, side, aboard).k > 0.95) tpPick = 0;   // room behind again
  const safeLen = tpSpot(tpPick, dist, side, aboard).len;
  // In the plane with no room behind (sat against the wall): first person
  // until there's room behind again, rather than the camera in your head.
  tpEyes = aboard && (tpEyes ? safeLen < 1.5 : safeLen < 0.95);
  if (tpEyes && freeLook.w <= 0) {
    game.localRig.root.visible = false;
    game.camera.position.copy(_tpPivot);
    _tpAt.copy(_tpPivot).addScaledVector(_tpForward, 10);
    game.camera.lookAt(_tpAt);
    return;
  }

  game.camera.position.copy(_tpPivot).addScaledVector(_tpDir, safeLen);
  // Look along the aim from over the shoulder, parallel to it, rather than
  // back across at the pivot: converging on the pivot ran the line of sight
  // through our own head, which filled the middle of the screen in ADS.
  _tpAt.set(game.camera.position.x + _tpForward.x * 10, game.camera.position.y + _tpForward.y * 10, game.camera.position.z + _tpForward.z * 10);
  game.camera.lookAt(_tpAt);
  // Free look (view/free-look.js): the camera swings round the body to
  // look at it, out to your face, blended in by its weight.
  const fw = freeLook.w;
  if (fw > 0) {
    _tpQ.copy(game.camera.quaternion);
    _tpFrom.copy(game.camera.position);
    const yo = yaw + freeLook.yaw, tilt = FREE_TILT + freeLook.pitch;
    _tpDir.set(Math.sin(yo) * Math.cos(tilt), Math.sin(tilt), Math.cos(yo) * Math.cos(tilt));   // from the body back to the camera
    _tpAt.copy(_tpPivot); _tpAt.y += FREE_AT_Y;
    const len = Math.max(0.6, raycastWorld(game.colliders, _tpAt, _tpDir, FREE_DIST + big * 0.6) - 0.15);
    game.camera.position.copy(_tpAt).addScaledVector(_tpDir, len);
    game.camera.lookAt(_tpAt);
    game.camera.position.lerpVectors(_tpFrom, game.camera.position, fw);
    _tpQ2.copy(game.camera.quaternion);   // (taken before it's overwritten)
    game.camera.quaternion.copy(_tpQ).slerp(_tpQ2, fw);
  }
  // Aiming in, our own face ghosts out so the left of the sight picture is
  // clear; pulled in tight against a wall it would be in the way outright.
  // (Looking round at it, it's all there.)
  const head = game.localRig.parts.head;
  head.visible = safeLen > 0.9 || fw > 0.5;
  head.material.opacity = 1 - 0.7 * adsT * (1 - fw);
  head.material.depthWrite = adsT < 0.1 || fw > 0.5;
}
const FREE_DIST = 2.6, FREE_TILT = 0.12, FREE_AT_Y = -0.3;   // the orbit: metres out, tilt up, aimed at the chest-to-face
const _tpQ = new THREE.Quaternion(), _tpQ2 = new THREE.Quaternion(), _tpFrom = new THREE.Vector3(), _tpAt = new THREE.Vector3();

/* Socialize jobs that pose our own body after everything else (the sheriff's
   cuffs, modes/social-sheriff.js): they push in here, so this module never
   imports them (social-rp loads through us, and they need it loaded). */
export const localPosers = [];

export let localLower = 0;
export function localReloadK() {
  const w = currentWeapon();
  return w?.reloading && w.reloadTime > 0 ? Math.min(0.999, Math.max(0.001, 1 - w.reloadT / w.reloadTime)) : 0;
}
/* A bot fired: its body brings the gun up (remote humans: net.js "shot"). */
export function noteRigShot(id) {
  const p = game.net.peers.get(id);
  if (p) p.shotAt = performance.now();
}
export let localBlockT = 0;   // the third-person body in the saber guard, 0..1
// Off the ground, and how fast it was falling: the body's jump, fall and
// landing (the viewmodel clears move.justLanded, so the body keeps its own).
let localAirVy = 0, localWasAir = false;

/* Positions and poses the local player's own humanoid rig every frame -
   same buildHumanoid/poseHumanoid contract remote-players.js drives other
   operators with, fed from this client's own authoritative move/look state
   instead of reconstructed network deltas. Runs regardless of view mode
   (cheap, and keeps the rig ready the instant third person is toggled on)
   but only actually matters visually while localRig.root.visible is true. */
/* ---------------- Swivel (user: a basketball spin move) ----------------
   Running forward, double-tap A or D (a pad: click the left or right
   stick) and the body spins a full 360 on the spot toward that side and
   comes out of it SWIVEL_SIDE metres over to that side, still running.
   Left spins to the body's left first (flip SWIVEL_LEFT_SIGN to reverse).
   Everyone else sees the spin (`sv` on the state packet: side * count); in
   first person it's a quick roll and FOV kick rather than a full turn of
   the camera. */
const SWIVEL_TIME = 0.5;
const SWIVEL_SIDE = 0.9;          // metres gained toward that side
const SWIVEL_COOLDOWN = 0.35;     // after one ends
export const SWIVEL_TAP = 0.28;          // seconds between the two taps
const SWIVEL_LEFT_SIGN = 1;       // +1: a left swivel turns left first (yaw grows to the left)
export const swivel = { t: 0, dir: 0, yaw: 0, cd: 0, seq: 0, prevK: 0 };
export const swivelTaps = { KeyA: 0, KeyD: 0 };
export function swivelK() { return swivel.dir ? Math.min(1, swivel.t / SWIVEL_TIME) : 0; }
function swivelEase(k) { return k * k * (3 - 2 * k); }
/* `dir` -1 left, +1 right. Needs to be running forward on the ground. */
export function trySwivel(dir) {
  if (swivel.dir || swivel.cd > 0 || !game.player.alive || game.localPauseOnly || stageFrozen()) return false;
  if (!game.move.grounded || game.move.busy || game.move.stance !== STANCE.STAND) return false;
  const fwd = -(game.move.velocity.x * Math.sin(game.look.yaw) + game.move.velocity.z * Math.cos(game.look.yaw));
  if (fwd < 1.5) return false;
  swivel.dir = dir;
  swivel.lastDir = dir;
  swivel.t = 0;
  swivel.prevK = 0;
  swivel.yaw = game.look.yaw;
  swivel.seq = (swivel.seq % 999) + 1;
  game.audio.slide?.();
  return true;
}
/* Per frame after the move: shift sideways along the swivel's arc. */
export function updateSwivel(dt) {
  swivel.cd = Math.max(0, swivel.cd - dt);
  if (!swivel.dir) return;
  swivel.t += dt;
  const k = swivelK();
  const step = (swivelEase(k) - swivelEase(swivel.prevK)) * SWIVEL_SIDE * swivel.dir;
  swivel.prevK = k;
  // Right of the heading the swivel started on: (cos, 0, -sin).
  game.move.pos.x += Math.cos(swivel.yaw) * step;
  game.move.pos.z -= Math.sin(swivel.yaw) * step;
  game.move.resolveHorizontal(game.move.pos, game.move.pos.y);
  if (k >= 1 || !game.player.alive) { swivel.dir = 0; swivel.cd = SWIVEL_COOLDOWN; }
}
/* The body's extra turn for a swivel of `dir` at `k` (0..1), radians. */
function swivelSpin(dir, k) {
  return -dir * SWIVEL_LEFT_SIGN * Math.PI * 2 * swivelEase(Math.max(0, Math.min(1, k)));
}

/* Dead, between the killcam and the respawn (or with no killcam at all):
   your own body lies where you fell, weapons gone from it and from the
   screen (user: show the dead body, not the guns). Timed off kcClock, so a
   fall the killcam already played stays settled rather than replaying. */
let localDeadAt = 0;
export function noteLocalDeath() {
  localDeadAt = game.kcClock;
  game.localRig.death = null;
}
function updateLocalDeadBody() {
  game.localRig.root.visible = true;
  game.localRig.parts.head.visible = true;
  game.localRig.root.position.set(game.move.pos.x, game.move.pos.y, game.move.pos.z);
  if (localHeld.mesh) localHeld.mesh.visible = false;
  game.weaponRig.visible = false;
  poseDeath(game.localRig, Math.min(1, (game.kcClock - localDeadAt) / DEATH_TIME));
}
const _deathCamAt = new THREE.Vector3(), _deathCamDir = new THREE.Vector3();
/* Looking down at the body from a little behind and above, drifting slowly
   round it; pulled in off walls like the third-person camera. */
export function placeDeathCamera() {
  const t = game.kcClock - localDeadAt;
  const a = game.look.yaw + 0.5 + t * 0.12;
  _deathCamAt.set(game.move.pos.x, game.move.pos.y + 0.35, game.move.pos.z);
  _deathCamDir.set(Math.sin(a) * 2.6, 2.4, Math.cos(a) * 2.6);
  const want = _deathCamDir.length();
  _deathCamDir.normalize();
  const len = Math.max(0.6, raycastWorld(game.colliders, _deathCamAt, _deathCamDir, want) - 0.15);
  game.camera.position.copy(_deathCamAt).addScaledVector(_deathCamDir, len);
  game.camera.lookAt(_deathCamAt);
}

export function updateLocalRig(dt) {
  if (!game.player.alive && game.gameState === "playing" && !royaleSpectating()) { updateLocalDeadBody(); return; }
  game.localRig.root.position.set(game.move.pos.x, game.move.pos.y, game.move.pos.z);
  // The TROLLS body (cosmetics.js, locked to its token's holder; menu/lobby.js
  // sets ownBody), never under a hero or cop body.
  wearBlocky(game.localRig, !game.localRig.heroBodyId && !game.localRig.copBodyId ? bodyToken(ownBody.want) : 0);
  // The body follows the aim a beat behind; the head leads the turn.
  const rolling = royaleRolling();
  // Under the glider the body hangs the way the wing flies, not where you look.
  const gliding = royale?.me === "glide" && royale.flight;
  aimRig(game.localRig, rolling ? royale.rollYaw : gliding ? royale.flight.heading : game.look.yaw, dt, { moving: game.move.moving, snap: rolling });
  if (swivel.dir) game.localRig.root.rotation.y += swivelSpin(swivel.dir, swivelK());

  const wantLower = rolling ? 1 : STANCE_LOWER[game.move.stance] ?? 0;
  localLower += (wantLower - localLower) * Math.min(1, dt * 8);

  // Signed forward/strafe relative to facing, same convention
  // remote-players.js derives from position deltas - here it's exact,
  // straight off the velocity vector and yaw.
  const sin = Math.sin(game.look.yaw), cos = Math.cos(game.look.yaw);
  const vx = game.move.velocity.x, vz = game.move.velocity.z;
  const speed = Math.hypot(vx, vz);
  const rightX = cos, rightZ = -sin;
  const fwdX = -sin, fwdZ = -cos;
  let strafe = 0, forward = 1;
  if (speed > 0.05) {
    strafe = Math.max(-1, Math.min(1, (vx * rightX + vz * rightZ) * 6));
    forward = Math.max(-1, Math.min(1, (vx * fwdX + vz * fwdZ) * 6));
  }
  const gaitSpeed = Math.max(0, Math.min(1, speed / 4.2));

  if (game.move.moving) game.localPhase += dt * gaitPhaseRate(speed, game.localRig.legScale);

  // What's in the hands: the melee weapon while it's held or mid-swing
  // (a quick melee swings it without putting the gun away), else the gun.
  const swinging = !!game.player.melee?.busy;
  const hold = game.socialUnarmed() ? "none"   // the hangout: empty hands
    : game.player.holding === "melee" || swinging ? "melee"
    : game.player.holding === "gun" ? "gun" : "none";
  const def = currentWeapon()?.def;
  syncLocalRigHeld(hold, def);

  if (game.emoteWheel.isOpen && (!game.player.alive || game.gameState !== "playing")) game.emoteWheel.close(true);
  game.updateDuo(dt);
  if (game.validEmote()) {
    game.emote.t += dt;
    if (game.move.moving || !game.player.alive || game.gameState !== "playing" || game.emote.t > emoteSeconds(game.emote.idx)) game.stopEmote();
  }
  // Emotes play sat down (the legs stay on the seat); a duo emote moves
  // you to your partner, so that one gets you up.
  if (seated && game.emote && EMOTES[game.emote.idx]?.kind === "duo") standUp();
  if (localHeld.mesh) localHeld.mesh.visible = !game.emote;
  game.els.hud.classList.toggle("is-emoting", game.emoteIsTp());
  if (!game.isSocial() || game.emote) syncLocalDrink(false);
  if (game.emote) {
    poseEmoteCode(game.localRig, emoteCode(game.emote.idx, game.emote.role), game.emote.t);
    if (seated && game.isSocial()) poseSeated(game.localRig, seated.s.y, seated.s.kind === "stool" ? 0.55 : 0);
    return;
  }

  // A jump or a fall from standing or crouched (a dive, slide, vault or rope
  // keeps its own look); a landing's force from the fall speed it ended (a
  // jump lands at ~7 m/s: ~0.5).
  const inAir = !game.move.grounded && (game.move.stance === "stand" || game.move.stance === "crouch");
  const land = !inAir && localWasAir ? Math.max(0, Math.min(1, (-localAirVy - 2.5) / 9)) : 0;
  if (inAir) localAirVy = game.move.velocity.y;
  localWasAir = inAir;
  poseHumanoid(game.localRig, {
    air: inAir,
    vy: game.move.velocity.y,
    land,
    phase: game.localPhase,
    moving: game.move.moving && game.move.grounded,
    pitch: game.look.pitch,
    lower: localLower,
    strafe,
    forward,
    speed: gaitSpeed,
    mps: speed,
    dt,
    hold,
    hasGun: hold === "gun" && def?.cls !== "sidearm",
    swing: swinging ? {
      t: Math.min(1, game.player.melee.t / game.player.melee.total),
      kind: game.player.melee.swingIndex % 2 === 0 ? "swing" : "thrust",
    } : null,
    recoil: hold === "gun" ? Math.min(1, (currentWeapon()?.viewKickKnockback || 0) * 7) : 0,
    ads: hold === "gun" ? currentWeapon()?.adsT || 0 : 0,
    fired: (performance.now() - game.localShotAt) / 1000,
    reload: hold === "gun" ? localReloadK() : 0,
    block: localBlockT = damp(localBlockT, saberBlock.active || kbShield.active ? 1 : 0, 14, dt),
    parry: saberParry.sample(),
  });
  // Third person, mid-repair: the board held flat across the body and
  // shaken about while it gets fixed.
  if (kbRepair.active && localHeld.mesh && hold === "melee") {
    localHeld.mesh.rotation.set(-Math.PI / 2 + Math.sin(kbRepair.t * 9) * 0.15, Math.sin(kbRepair.t * 13) * 0.2, Math.PI / 2);
  } else if (localHeld.mesh && hold === "melee") localHeld.mesh.rotation.set(0, 0, 0);
  if (game.localThrowT > 0) game.localThrowT = Math.max(0, game.localThrowT - dt);
  // A grenade in hand and the throw (combat/throw-anim.js): the right arm,
  // the gun put away. The streak marker's toss keeps the old overhand.
  const th = throwState.phase && throwState.phase !== "raise" && game.player.alive ? throwState : null;
  if (th) {
    poseThrowBody(game.localRig, th.phase, th.phase === "throw" ? th.tRel : th.t, modelKind(th.def));
    if (localHeld.mesh) localHeld.mesh.visible = false;
  } else {
    clearThrowBody(game.localRig);
    if (game.localThrowT > 0) poseThrowArm(game.localRig, 1 - game.localThrowT / THROW_TIME);
  }
  if (game.isSocial()) syncLocalDrink(true);   // the saloon bar: a drink in hand
  // Sat down (rp-roles.js); at the piano, both hands on the keys.
  if (seated && game.isSocial()) {
    if (seated.s.kind === "piano") posePianoArms(game.localRig, piano.t += dt, 0.3, piano.playing || performance.now() - (piano.sent.at(-1) || 0) < 700);
    poseSeated(game.localRig, seated.s.y, seated.s.kind === "stool" ? 0.55 : 0);
  }
  // Troll Royale: sat in your seat in the plane (the drop cinematic).
  // (The seat's height above your own floor: the body is still in the
  // ghost hold here, royale.js placeAboardRig carries it up after.)
  if (dropCineSitK() > 0.5) poseSeated(game.localRig, game.move.pos.y + 0.44, 0.1);
  rollRig(game.localRig, royaleRollK());
  // Trolling Loud's door: the arm out for the band; carried off and thrown
  // on your back (after rollRig, which levels the body).
  if (game.isSocial()) { clubPoseLocal(game.localRig); for (const f of localPosers) f(game.localRig); }
  if (game.move.onRope) {
    if (game.move.moving) localRopeT += dt * ROPE_CLIMB_RATE;
    poseRope(game.localRig, localRopeT);
  }
  // Skydiving, then hanging under the glider (seen in the drop camera).
  const dropCode = royaleDropCode();
  if (dropCode === DROP_FALL || dropCode === DROP_GLIDE) {
    localDropT += dt;
    // The fall's opening show (modes/royale-fall.js): on its clock.
    const show = dropCode === DROP_FALL ? fallShowPose() : null;
    poseDrop(game.localRig, dropCode, show ? show.t : localDropT, show ? show.back : null, show?.yaw);
    if (localHeld.mesh) localHeld.mesh.visible = false;
  }
}
let localDropT = 0;
let localRopeT = 0;   // climb phase on a rope

/* The third-person body carries the same gun or melee weapon the first-
   person view shows. Rebuilt only when what's held changes. */
export const localHeld = { key: null, mesh: null };
export function syncLocalRigHeld(hold, def) {
  const key = hold === "gun" ? `gun:${def?.id}:${def?.attachments?.skin || ""}` : hold === "melee" ? `melee:${game.player.melee?.def?.id}` : "none";
  if (key === localHeld.key) return;
  localHeld.key = key;
  if (localHeld.mesh) {
    localHeld.mesh.parent?.remove(localHeld.mesh);
    localHeld.mesh.traverse((o) => { if (!o.geometry?.userData.shared) o.geometry?.dispose?.(); });
    localHeld.mesh = null;
  }
  if (hold === "gun" && def) {
    localHeld.mesh = stripLights(buildWeaponMesh(def));
    mountHeldWeapon(game.localRig, localHeld.mesh);
  } else if (hold === "melee" && game.player.melee?.def) {
    // No first-person hands on it: the body's own mitt holds it.
    localHeld.mesh = buildMeleeMesh(game.player.melee.def, false, { held3p: true });
    localHeld.mesh.scale.setScalar(1.1);
    localHeld.mesh.userData.meleeId = game.player.melee.def.id;
    game.localRig.parts.gripR.add(localHeld.mesh);
    // Built lit; it ignites in third person too, slowly when equipped.
    const sv = localHeld.mesh.userData.saber || localHeld.mesh.userData.halo;
    if (sv) { sv.snapOff(); sv.ignite(game.player.holding === "melee" && !game.player.melee.busy ? SLOW_IGNITE : undefined); }
  }
  localHeld.mesh?.traverse((o) => { if (o.isMesh) o.castShadow = true; });
}
