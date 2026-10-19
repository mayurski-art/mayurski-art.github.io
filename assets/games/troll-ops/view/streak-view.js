// The scorestreak devices in first person (tablet, marker, drone, whistle)
// and the arms that hold them.

import * as THREE from "three";
import { inspectArms, stretchBetween, _armDir, _armFrom, _armTo } from "./weapon-view.js?v=wv1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1";
import { damp } from "../characters/anim-curves.js?v=or1";
import { poseFreeArms } from "./fp-emote.js?v=fe1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1";
import { launchPendingDrone } from "../streaks/fire.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1";
import { drawTabletScreen } from "../streaks/streak-device.js?v=to-df1-or1";
import { handMaterials, buildHumanHand, inkOutline, placeHand, poseHumanHand, handWrist } from "../weapons/hand-model.js?v=to-grip2-or1";
import { game } from "../core/state.js?v=st1";
import { nuke, nukeDevice, nukeLeft, NUKE } from "../streaks/nuke.js?v=tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1";
import { dropCineMask, dropCineMaskK, dropCinePhoto, dropCinePhotoK, dropCineIpod, dropCineIpodK } from "../modes/royale-cine.js?v=dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-bp1";
import { drawNukeScreen, setNukeControls } from "../streaks/nuke-device.js?v=tn1";

let streakSprintT = 0;
// Two-handed, centred and low, screen tipped up toward the eye — BO2's
// tablet hold. The old one-hand wrist unit sat half off the bottom right.
const TABLET_HOLD_POS = new THREE.Vector3(0, -0.098, -0.4);
const TABLET_TILT = -0.36;
const TABLET_PRESS_AT = 0.45;       // seconds into a UAV/gunship call the thumb goes down
// The nuke handheld: upright in both hands, low and a touch right of centre
// so the crosshair stays clear.
const NUKE_HOLD_POS = new THREE.Vector3(0.012, -0.142, -0.44);
const NUKE_TILT = -0.34;
// The oxygen mask: held low, then on the face just under the eyes.
const MASK_DOWN = new THREE.Vector3(0.03, -0.3, -0.3);
const MASK_ON = new THREE.Vector3(0, -0.1, -0.13);
const MASK_TILT = -0.3;
// The family photo: from the chest pocket, then held close and low.
const PHOTO_DOWN = new THREE.Vector3(-0.06, -0.3, -0.26);
const PHOTO_UP = new THREE.Vector3(0.006, -0.045, -0.26);
const PHOTO_TILT = -0.22;
// The iPod: out of the pocket, held up a little right of centre.
const IPOD_DOWN = new THREE.Vector3(0.04, -0.3, -0.26);
const IPOD_UP = new THREE.Vector3(0.02, -0.045, -0.27);
const IPOD_TILT = -0.3;
// The K9 whistle: hand target in viewmodel space (fingers up and back into
// the mouth, so you see the back of it, knuckles forward), how long it is
// held, when the note starts.
export const WHISTLE_HAND = [0.035, -0.1, -0.195];
export const WHISTLE_ROT = [-0.3, Math.PI - 0.35, 0.3];
export const WHISTLE_HOLD = 1.6;
export const WHISTLE_BLOW_AT = 0.3;

export function updateStreakView(dt) {
  const held = game.player.holding === "streak";
  const mesh = game.streakDeviceKind === "marker" ? game.activeMarkerMesh
    : game.streakDeviceKind === "drone" ? game.activeDroneMesh
    : game.streakDeviceKind === "nuke" ? nukeDevice()
    : game.streakDeviceKind === "mask" ? dropCineMask()
    : game.streakDeviceKind === "photo" ? dropCinePhoto()
    : game.streakDeviceKind === "ipod" ? dropCineIpod()
    : game.streakDeviceKind === "whistle" ? null : game.activeStreakMesh;
  for (const m of [game.activeStreakMesh, game.activeMarkerMesh, game.activeDroneMesh, nukeDevice(), dropCineMask(), dropCinePhoto(), dropCineIpod()]) m.visible = held && m === mesh;
  if (!held) { game.streakRaiseT = 0; streakSprintT = 0; hideStreakArms(); return; }
  inspectArms.visible = false;
  if (!game.player.alive) { game.finishStreakHold(); if (mesh) mesh.visible = false; hideStreakArms(); return; }
  if (game.streakHoldElapsed === 0) resetStreakArms();
  game.streakHoldElapsed += dt;

  // Up quickly, down a touch quicker; once it's down, the gun comes back.
  game.streakRaiseT = damp(game.streakRaiseT, game.streakLowering ? 0 : 1, game.streakLowering ? 11 : 8, dt);
  if (game.streakLowering && game.streakRaiseT < 0.05) { game.finishStreakHold(); if (mesh) mesh.visible = false; hideStreakArms(); return; }
  streakSprintT = damp(streakSprintT, game.move.sprinting ? 1 : 0, 8, dt);
  const e = game.streakRaiseT, off = 1 - e, s = streakSprintT;
  const t = performance.now() / 1000;
  const idleX = Math.sin(t * 1.3) * 0.003, idleY = Math.sin(t * 1.9) * 0.003;

  if (game.streakDeviceKind === "whistle") {
    // K9 call: the right hand comes up to the mouth, two fingers in, and
    // blows; the head tips back a touch with the breath, then it drops away.
    const blow = Math.max(0, Math.min(1, (game.streakHoldElapsed - WHISTLE_BLOW_AT) / 0.9));
    const push = Math.sin(blow * Math.PI);            // the breath swelling and fading
    const trill = blow > 0 && blow < 1 ? Math.sin(t * 38) * 0.0015 : 0;
    poseFreeArms({
      R: {
        pos: [WHISTLE_HAND[0] + off * 0.1 + idleX,
          WHISTLE_HAND[1] - off * 0.32 - s * 0.1 + idleY + push * 0.008 + trill,
          WHISTLE_HAND[2] + off * 0.06 + push * 0.01],
        rot: [WHISTLE_ROT[0] - off * 0.9, WHISTLE_ROT[1], WHISTLE_ROT[2] + off * 0.3],
        pose: "whistle",
      },
      L: null,
    });
    return;
  }

  if (game.streakDeviceKind === "marker") {
    // Held up by the shoulder, strobe blinking; the throw is a wind-back and
    // an overhand flick, then the hand is empty and follows through.
    game.activeMarkerMesh.userData.strobe.visible = (t * 2.5) % 1 < 0.2;
    let fx = 0, fy = 0, fz = 0, pitch = 0;
    if (game.markerThrowT > 0) {
      game.markerThrowT = Math.max(0, game.markerThrowT - dt);
      const k = 1 - game.markerThrowT / game.MARKER_THROW_TIME;
      if (k < 0.3) { const w = k / 0.3; fy = 0.05 * w; fz = 0.06 * w; pitch = -0.6 * w; }
      else if (k < 0.5) { const w = (k - 0.3) / 0.2; fy = 0.05 + 0.06 * w; fz = 0.06 - 0.32 * w; pitch = -0.6 + 1.6 * w; }
      else mesh.visible = false;   // it's gone; the empty hand drops away
    }
    mesh.scale.setScalar(0.6);
    mesh.position.set(0.15 + off * 0.08 + idleX, -0.15 - off * 0.3 - s * 0.12 + idleY + fy, -0.36 + off * 0.05 + fz);
    mesh.rotation.set(s * 0.4 + off * 0.8 + pitch, -0.3 - off * 0.3, s * 0.25 + off * 0.4 + 0.15);
    poseStreakArms(mesh.visible ? mesh : null, "wrap", dt, 0);
    return;
  }

  if (game.streakDeviceKind === "drone") {
    // Cradled out in front in both hands, rotors spinning up, then tossed up
    // and away; the hands follow through and drop out of view.
    const toss = Math.max(0, (game.streakHoldElapsed - game.DRONE_TOSS_AT + 0.15) / 0.3);
    for (const r of game.activeDroneMesh.userData.rotors || []) r.rotation.y += dt * 60 * Math.min(1, game.streakHoldElapsed / 0.5);
    mesh.position.set(0.02 + off * 0.1 + idleX, -0.16 - off * 0.3 + idleY + toss * toss * 0.5, -0.42 + off * 0.05 - toss * 0.3);
    mesh.rotation.set(-0.15 + off * 0.6 + toss * 0.4, 0.3 * off, off * 0.3);
    if (toss >= 1) mesh.visible = false;
    // Hands let go a moment into the toss, not once it's gone.
    poseStreakArms(toss > 0.35 ? null : mesh, "cup", dt, 0);
    if (game.pendingDroneLaunch && game.streakHoldElapsed >= game.DRONE_TOSS_AT) launchPendingDrone();
    return;
  }

  if (game.streakDeviceKind === "ipod") {
    // The iPod (modes/royale-cine.js): up out of the pocket in both hands,
    // the screen tipped to the eye while you pick and press play, then held
    // lower while you listen; then away. The scene draws its screen.
    const k = dropCineIpodK();
    const e = k * k * (3 - 2 * k);
    mesh.position.set(IPOD_DOWN.x + (IPOD_UP.x - IPOD_DOWN.x) * e + idleX,
      IPOD_DOWN.y + (IPOD_UP.y - IPOD_DOWN.y) * e + idleY,
      IPOD_DOWN.z + (IPOD_UP.z - IPOD_DOWN.z) * e);
    mesh.rotation.set(-1.1 + (IPOD_TILT + 1.1) * e, -0.3 * (1 - e), 0.06 + 0.3 * (1 - e));
    mesh.visible = k > 0.01;
    poseStreakArms(mesh.visible ? mesh : null, "side", dt, 0);
    return;
  }

  if (game.streakDeviceKind === "photo") {
    // The family photo (modes/royale-cine.js): up out of the chest pocket
    // in both hands, held low and close, tipped up to the eye; the right
    // thumb strokes across it (royale-photo.js setPhotoThumb); then away.
    const k = dropCinePhotoK();
    const e = k * k * (3 - 2 * k);
    mesh.position.set(PHOTO_DOWN.x + (PHOTO_UP.x - PHOTO_DOWN.x) * e + idleX,
      PHOTO_DOWN.y + (PHOTO_UP.y - PHOTO_DOWN.y) * e + idleY,
      PHOTO_DOWN.z + (PHOTO_UP.z - PHOTO_DOWN.z) * e);
    mesh.rotation.set(-1.2 + (PHOTO_TILT + 1.2) * e, -0.4 * (1 - e), 0.05 + 0.3 * (1 - e));
    mesh.visible = k > 0.01;
    poseStreakArms(mesh.visible ? mesh : null, "side", dt, 0);
    return;
  }

  if (game.streakDeviceKind === "mask") {
    // Troll Royale's oxygen mask (modes/royale-cine.js): up in both hands
    // from low, tipped so its rim sits under your eyes while it's on, then
    // back down and away. The scene's clock drives it, not the hold's.
    const k = dropCineMaskK();
    const e = k * k * (3 - 2 * k);
    mesh.position.set(MASK_DOWN.x + (MASK_ON.x - MASK_DOWN.x) * e + idleX * (1 - e),
      MASK_DOWN.y + (MASK_ON.y - MASK_DOWN.y) * e + idleY * (1 - e),
      MASK_DOWN.z + (MASK_ON.z - MASK_DOWN.z) * e);
    mesh.rotation.set(-1.1 + (MASK_TILT + 1.1) * e, 0.35 * (1 - e), 0.25 * (1 - e));
    mesh.visible = k > 0.01;
    poseStreakArms(mesh.visible ? mesh : null, "side", dt, 0);
    return;
  }

  if (game.streakDeviceKind === "nuke") {
    // The Tactical Nuke's handheld: up in both hands, close and upright,
    // the screen boots, the right thumb flips the safety cover and presses
    // the red key (streaks/nuke.js arms it at NUKE.armAt), then it lowers.
    const h = game.streakHoldElapsed;
    const cover = Math.min(1, Math.max(0, (h - 1.0) / 0.28));
    const pk = (h - (NUKE.armAt - 0.15)) / 0.3;
    const press = pk > 0 && pk < 1 ? Math.sin(pk * Math.PI) : 0;
    setNukeControls(mesh, cover * cover * (3 - 2 * cover), press);
    mesh.position.set(NUKE_HOLD_POS.x + idleX, NUKE_HOLD_POS.y - off * 0.3 - s * 0.1 + idleY - press * 0.004, NUKE_HOLD_POS.z + off * 0.06 + press * 0.003);
    mesh.rotation.set(NUKE_TILT + s * 0.35 - off * 0.6, off * 0.2, s * 0.2 + off * 0.25);
    const armed = h >= NUKE.armAt && (!nuke.calling || !!nuke.inbound);
    drawNukeScreen(mesh, h, armed, armed ? nukeLeft() : null);
    poseStreakArms(mesh, "side", dt, cover > 0 && cover < 1 ? cover : pk > 0 && pk < 1 ? pk : 0);
    return;
  }

  // Tablet: rises from low with both hands, screen tipping up to the eye,
  // then settles with a slight idle drift. A UAV/gunship call gets a right-
  // thumb press on CONFIRM and the page flips; the strike tablet just holds.
  const calling = ["uav", "counteruav", "vsat", "gunship", "k9", "warship", "swarm", "dragonfire", "samturret"].includes(game.streakScreen);
  const pk = calling ? (game.streakHoldElapsed - TABLET_PRESS_AT) / 0.22 : -1;
  const press = pk > 0 && pk < 1 ? Math.sin(pk * Math.PI) : 0;
  const confirmed = calling && pk >= 0.5;
  mesh.position.set(
    TABLET_HOLD_POS.x + idleX,
    TABLET_HOLD_POS.y - off * 0.3 - s * 0.1 + idleY - press * 0.006,
    TABLET_HOLD_POS.z + off * 0.06 + press * 0.004
  );
  mesh.rotation.set(TABLET_TILT + s * 0.35 - off * 0.6 + press * 0.05, off * 0.2, s * 0.2 + off * 0.25);
  if (game.tabletDive) {
    // The dive: the tablet comes up square to the eye as the view tips down
    // to it, then rushes into the lens until its screen is all there is.
    const k = game.tabletDiveK();
    const a = Math.min(1, k / game.DIVE_LOOK), b = Math.max(0, (k - game.DIVE_LOOK) / (1 - game.DIVE_LOOK));
    const ea = a * a * (3 - 2 * a), eb = b * b * b;
    mesh.position.x += (0 - mesh.position.x) * ea;
    mesh.position.y += (-0.05 - mesh.position.y) * ea + 0.05 * eb;
    mesh.position.z += (-0.34 - mesh.position.z) * ea + 0.3 * eb;
    mesh.rotation.x += (-0.02 - mesh.rotation.x) * ea;
    mesh.rotation.y *= 1 - ea;
    mesh.rotation.z *= 1 - ea;
  }
  drawTabletScreen(game.activeStreakMesh, game.streakScreen, game.streakHoldElapsed, confirmed);
  poseStreakArms(mesh, "side", dt, pk > 0 && pk < 1 ? pk : 0);
}

/* The arms that hold streak devices: real hands (hand-model.js — white,
   ink-outlined, jointed fingers) on a wrist/cuff/sleeve run to a shoulder
   below the screen. The hand is placed on the device's grip anchor per
   style — "side" hooks the fingers over a tablet edge, "cup" palms the
   drone from underneath, "wrap" closes a fist round the marker. Arm 0 is
   the right arm, arm 1 the left. */
export const STREAK_SHOULDER = [new THREE.Vector3(0.27, -0.54, 0.1), new THREE.Vector3(-0.27, -0.54, 0.1)];
export const streakArms = (() => {
  const root = new THREE.Group();
  root.visible = false;
  const mats = handMaterials();
  const unitCyl = (rTop, rBottom, mat) => {
    const g = new THREE.CylinderGeometry(rTop, rBottom, 1, 12);
    g.translate(0, 0.5, 0);
    return new THREE.Mesh(g, mat);
  };
  const arms = [];
  for (let i = 0; i < 2; i++) {
    const hand = buildHumanHand(i === 0 ? 1 : -1, mats);
    const wrist = unitCyl(0.02, 0.023, mats.skin);
    const cuff = unitCyl(0.033, 0.032, mats.cuff);
    const sleeve = unitCyl(0.042, 0.032, mats.sleeve);
    inkOutline(cuff);
    root.add(hand, wrist, cuff, sleeve);
    arms.push({ hand, wrist, cuff, sleeve, free: false, attached: false, vel: new THREE.Vector3() });
  }
  // The Phantom Forces black rods (see pfArms), tip on the grip.
  const rodMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  for (const arm of arms) {
    const g = new THREE.CylinderGeometry(0.013, 0.034, 1, 10);
    g.translate(0, 0.5, 0);
    arm.rod = new THREE.Mesh(g, rodMat);
    arm.rod.renderOrder = -1;
    arm.rod.visible = false;
    root.add(arm.rod);
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  root.userData.arms = arms;
  return root;
})();

export function hideStreakArms() {
  streakArms.visible = false;
  for (const arm of streakArms.userData.arms) arm.rod.visible = false;
}

/* New hold: both hands start attached again. */
function resetStreakArms() {
  for (const arm of streakArms.userData.arms) { arm.free = false; arm.attached = false; arm.vel.set(0, 0, 0); }
}

/* Put the hands on `mesh`'s grip anchors and run each arm down to its
   shoulder. `mesh` null means the hands have let go (a toss/throw): each
   keeps the momentum it had and falls away below the screen. A one-handed
   device (the marker) has no left anchor, so that arm stays down. `tap` is
   0..1 through the CONFIRM press (the right index taps the bezel). */
const _armPrev = new THREE.Vector3();
const _wristAt = new THREE.Vector3();
function poseStreakArms(mesh, style, dt, tap) {
  streakArms.visible = true;
  const anchors = mesh?.userData.anchors || null;
  if (mesh) mesh.updateMatrixWorld(true);
  const arms = streakArms.userData.arms;
  for (let i = 0; i < arms.length; i++) {
    const arm = arms[i];
    const anchor = anchors ? (i === 0 ? anchors.right : anchors.left) : null;
    let show;
    if (anchor && !arm.free) {
      _armPrev.copy(arm.hand.position);
      placeHand(arm.hand, anchor, style, i === 0 ? 1 : -1, i === 0 ? tap : 0);
      // Remember how the hand was moving, for the follow-through if it lets go.
      if (dt > 0 && arm.attached) arm.vel.subVectors(arm.hand.position, _armPrev).divideScalar(dt);
      if (arm.vel.lengthSq() > 9) arm.vel.setLength(3);
      arm.attached = true;
      show = true;
    } else if (arm.attached) {
      // Let go: fingers open, coast on, then drop out of view.
      arm.free = true;
      poseHumanHand(arm.hand, "relaxed");
      arm.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
      arm.vel.y -= dt * 3.2;
      arm.hand.position.addScaledVector(arm.vel, dt);
      show = arm.hand.position.y > -0.5;
    } else {
      show = false;
    }
    arm.hand.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = show;
    arm.rod.visible = false;
    if (!show) continue;
    // The PF look everywhere: no hands, the rod's tip holds it. (The white
    // hand stays placed, invisibly, as the grip point.)
    arm.hand.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = false;
    arm.rod.visible = true;
    stretchBetween(arm.rod, STREAK_SHOULDER[i], streakRodTip(arm, anchor, style, i));
  }
}

/* Where a streak arm's rod ends. On the tablet the palm centre sits outside
   the edge, so the rod goes to the edge itself, low on the side; elsewhere
   (and once a hand has let go) the placed hand is the spot. */
const STREAK_ROD_TIP = { side: new THREE.Vector3(0.006, -0.05, -0.004) };
const _rodTip = new THREE.Vector3();
const _rodQ = new THREE.Quaternion();
function streakRodTip(arm, anchor, style, i) {
  const off = STREAK_ROD_TIP[style];
  if (!off || !anchor || arm.free) return arm.hand.position;
  anchor.getWorldPosition(_rodTip);
  anchor.getWorldQuaternion(_rodQ);
  return _rodTip.add(_armDir.set(off.x * (i === 0 ? 1 : -1), off.y, off.z).applyQuaternion(_rodQ));
}

/* hand -> wrist -> cuff -> sleeve, all along the line to the shoulder. */
function layStreakArm(arm, i) {
  const shoulder = STREAK_SHOULDER[i];
  handWrist(arm.hand, _wristAt);
  _armDir.subVectors(shoulder, _wristAt).normalize();
  _armFrom.copy(_wristAt).addScaledVector(_armDir, -0.012);
  _armTo.copy(_wristAt).addScaledVector(_armDir, 0.04);
  stretchBetween(arm.wrist, _armFrom, _armTo);
  _armFrom.copy(_armTo);
  _armTo.copy(_wristAt).addScaledVector(_armDir, 0.065);
  stretchBetween(arm.cuff, _armFrom, _armTo);
  stretchBetween(arm.sleeve, _armTo, shoulder);
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initStreakView() {
  game.weaponRig.add(streakArms);
}
