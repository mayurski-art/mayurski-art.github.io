// Troll Forces — the Tactical Nuke's handheld in your own hands in third
// person. The first-person call (view/streak-view.js) has the viewmodel
// copy; this is a second one on the body: up from the hip in both hands,
// held out at chest height with the screen tipped up to the face while the
// code goes in and the key goes down, then back down. Same model, same
// screen and keys as the first-person one (nuke-device.js).

import * as THREE from "three";
import { reachHand, setHandPose } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { buildNukeDevice, drawNukeScreen, setNukeControls, nukeSlam } from "./nuke-device.js?v=tn1-nd1-wb1";
import { nuke, nukeLeft, NUKE } from "./nuke.js?v=tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3";
import { game } from "../core/state.js?v=st1";

const SCALE = 1.7;                    // reads at chase-camera range
const RAISE = 0.35, LOWER = 0.4;       // seconds up at the start, down at the end
const _tR = new THREE.Vector3(), _tL = new THREE.Vector3();
const _poleR = new THREE.Vector3(1, -1, 0.3), _poleL = new THREE.Vector3(-1, -1, 0.3);
const _key = new THREE.Vector3(), _pa = new THREE.Vector3();
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const ease = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };

/* Where a hand goes to hold a grip anchor, in chest space: just outside
   the edge and a touch below it, so the mitt wraps the side. */
function gripTarget(rig, anchor, side, s, out) {
  anchor.getWorldPosition(out);
  rig.parts.chest.worldToLocal(out);
  return out.add(_key.set(side * 0.03 * s, -0.025 * s, 0.01 * s));
}

function bodyDevice(rig) {
  if (!rig.nukeDevice) {
    rig.nukeDevice = buildNukeDevice();
    rig.nukeDevice.visible = false;
  }
  if (rig.nukeDevice.parent !== rig.parts.chest) rig.parts.chest.add(rig.nukeDevice);
  return rig.nukeDevice;
}

/* Your body in third person (view/third-person.js). True when it posed
   (the caller keeps anything else out of the hands). */
export function poseNukeLocal(rig) {
  const on = game.player.alive && game.player.holding === "streak" && game.streakDeviceKind === "nuke";
  if (!on) { if (rig.nukeDevice) rig.nukeDevice.visible = false; return false; }
  if (!rig?.parts?.handR) return false;
  const h = game.streakHoldElapsed;
  const up = ease(h / RAISE) * (1 - ease((h - (NUKE.hold - LOWER)) / LOWER));
  const s = rig.scale || 1;
  // The device sits on the chest's centre line (chest space: the chest
  // turns ahead of the root with the aim), low at the hip coming up to out
  // in front of the chest, screen toward the face (+z is the chest's back)
  // and its top tipped away so the screen looks up. The hands go to its
  // grips, not the other way round, so it can't drift off to one side.
  const dev = bodyDevice(rig);
  dev.visible = true;
  dev.scale.setScalar(SCALE * s);
  const at = lerp3([0.06, -0.5, -0.16], [0, -0.05, -0.36], up);
  dev.position.set(at[0] * s, at[1] * s, at[2] * s);
  dev.rotation.set(-0.15 - 0.5 * up, 0, 0);
  const cover = ease((h - NUKE.coverAt) / 0.28);
  const slam = nukeSlam(h - NUKE.armAt);
  setNukeControls(dev, cover, slam.press);
  dev.position.y -= slam.jolt * 0.05 * s;
  dev.rotation.x -= slam.jolt * 0.2;
  rig.root.updateMatrixWorld(true);
  const anchors = dev.userData.anchors;
  gripTarget(rig, anchors.right, 1, s, _tR);
  gripTarget(rig, anchors.left, -1, s, _tL);
  // The slam: the right fist leaves its grip, comes up off the face and
  // down on the red key.
  if (slam.lift > 0 || slam.press > 0) {
    const pz = 0.03 + slam.lift * 0.09;
    dev.localToWorld(_pa.set(0, -0.0715, pz));
    rig.parts.chest.worldToLocal(_pa);
    _tR.lerp(_pa, slam.press > 0 ? 1 : ease(slam.lift * 3));
  }
  reachHand(rig, 1, _tR, _poleR);
  reachHand(rig, -1, _tL, _poleL);
  setHandPose(rig, 1, "fist");
  setHandPose(rig, -1, "fist");
  rig.body?.update?.();
  const armed = h >= NUKE.armAt && (!nuke.calling || !!nuke.inbound);
  drawNukeScreen(dev, h, armed, armed ? nukeLeft() : null);
  return true;
}
