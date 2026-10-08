// The scorestreak devices in first person (tablet, marker, drone, whistle)
// and the arms that hold them.

import * as THREE from "three";
import { inspectArms, stretchBetween, _armDir, _armFrom, _armTo } from "./weapon-view.js?v=wv1-si1-gj1-if1-fu1b7b7d";
import { damp } from "../anim-curves.js";
import { poseFreeArms } from "./fp-emote.js?v=fe1-si1-gj1-if1-fu1b7b7dec1";
import { launchPendingDrone } from "../streaks/fire.js?v=sk1-si1-gj1-fu1b7b7d";
import { drawTabletScreen } from "../streak-device.js?v=to-df1";
import { handMaterials, buildHumanHand, inkOutline, placeHand, poseHumanHand, handWrist } from "../hand-model.js?v=to-grip2";
import { game } from "../core/state.js?v=st1";

let streakSprintT = 0;
// Two-handed, centred and low, screen tipped up toward the eye — BO2's
// tablet hold. The old one-hand wrist unit sat half off the bottom right.
const TABLET_HOLD_POS = new THREE.Vector3(0, -0.098, -0.4);
const TABLET_TILT = -0.36;
const TABLET_PRESS_AT = 0.45;       // seconds into a UAV/gunship call the thumb goes down
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
    : game.streakDeviceKind === "whistle" ? null : game.activeStreakMesh;
  for (const m of [game.activeStreakMesh, game.activeMarkerMesh, game.activeDroneMesh]) m.visible = held && m === mesh;
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
