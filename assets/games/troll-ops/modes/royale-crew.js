// Troll Royale — the drop cinematic's crew, phase 2 (doc "Troll Forces:
// Royale drop cinematic"): the jumpmaster and the squad mate across from you,
// both stick trollface figures for now (user, 2026-10-17: "just another
// stick figure for now"), the same rig the bots wear.
//
// They're local only: every client that plays the scene draws its own pair
// off the drop clock, in the ridden plane's frame (posed plane-local, then
// carried out by the plane's matrix, the way remote-players.js draws
// planemates), so nothing goes on the wire.
//
//   the jumpmaster   by the crew hatch; walks down to you as you sit
//                    you (T-19.6), leans in at T-16 and taps his face (mask on),
//                    points aft at T-9, goes ahead to the ramp's control
//                    panel by the door and presses its green button: the
//                    ramp comes down (user, 2026-10-31); as you back up for your run (docs/ROYALE-
//                    EXIT.md) he points out of the door, a flat hand up for
//                    "wait for it", then GO GO GO, chopping at the door,
//                    still waving as you look back from the sky
//   the squad mate   in the seat across from you (the bot drawn there is
//                    hidden: crewSeat()); masks up with you, stands at T-8,
//                    lines up beside you at the ramp, facing out
//
// Plane-local: -z is the nose, the ramp's hinge is at z 6.25, the seats are
// at x ±1.3 (royale-hold.js SEAT_SPOTS).

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { buildHumanoid, poseHumanoid, aimRig, gaitPhaseRate, reachHand } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1-pk1-mb1";
import { poseSeated } from "./rp-roles.js?v=rp1b7-cd1-sh1-dj2-or1-bw2-sp1-mb1";
import { SEAT_SPOTS, RAMP_PANEL } from "./royale-hold.js?v=pl1-pl2-sr1-or1-rr1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1-hgb6-jx2-mb1";
import { oxygenMask } from "./royale-mask.js?v=dc1";
import { setReliefFace } from "../characters/blocky-body.js?v=bk1-cw1-zr10-bf1-sr1-nf1-nx1-or1-nf2-em2-nb2-sb1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-gt1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-rb1-fg3-hd1-rc1-rc3-rc4-rc5-ls1-ut1-er1-cl1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-hl1-mg1-sp1-rh1-ci6-pm1-mb1";

/* Beats on the drop clock (royale-cine.js CINE has yours). */
export const CREW = {
  jmWalk: -25.6,          // the jumpmaster sets off down the aisle to you
  jmBy: -22.4,            // ...and is by you
  lean: [-22, -20.8],     // leans in, taps his face: mask on
  point: [-15.2, -14.2],    // points aft: the ramp
  jmToRamp: -14.6,         // goes ahead to the ramp's control panel
  atPanel: -10.4,          // ...there, at his wall by the door
  press: [-10.0, -9.2],    // the hand up to the green button, and down
  push: [-9.6, -9.3],      // his thumb on it (the ramp starts down at -9.2: PLANES.rampAt)
  stand: -13.7,            // the squad mate's up
  mateWalk: -13.4,
  door: [-1.7, -0.7],     // as you back up: points out of the door
  wait: [-0.6, 0.1],      // a flat hand up: wait for it
  go: [0.05, 0.6],        // GO GO GO, you off the lip
  wave: [0.45, 4],         // ...then a wave goodbye at the door as the stick goes, while you look back from the sky
  mask: [-20.6, -14.8],    // the squad mate's mask on
  seatY: 0.44,
};

/* A path through the hold at `speed` m/s from `t0`: where along it at t,
   which way it heads, and whether it's still going. */
export function pathAt(pts, t0, speed, t, out = {}) {
  let d = Math.max(0, t - t0) * speed;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (d <= len || i === pts.length - 1) {
      const k = len > 0 ? Math.min(1, d / len) : 1;
      out.x = a.x + (b.x - a.x) * k;
      out.z = a.z + (b.z - a.z) * k;
      out.yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
      out.moving = t >= t0 && k < 1;
      return out;
    }
    d -= len;
  }
  out.x = pts[0].x; out.z = pts[0].z; out.yaw = 0; out.moving = false;
  return out;
}
export const pathLength = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.z - pts[i].z), 0);
/* The speed that gets along `pts` by `by` from `t0`, no slower than `min`. */
export const paceFor = (pts, t0, by, min) => Math.max(min, pathLength(pts) / Math.max(0.5, by - t0));

const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

/* The seat across from yours (the next one down the hold, which is on the
   other wall; the last seat takes the one before). */
export function crewSeat(seat) {
  return seat + 1 < SEAT_SPOTS.length ? seat + 1 : seat - 1;
}

/* Your lane from the seat to the ramp (royale-cine.js walks you along it). */
export const RAMP_SPOT = (side) => ({ x: side * 0.3, z: 5.7 });
export function yourRampPath(side, seatX, seatZ) {
  return [{ x: seatX, z: seatZ }, { x: side * 0.62, z: seatZ + 0.15 }, { x: side * 0.62, z: 4.6 }, RAMP_SPOT(side)];
}

let crew = null;
function ensureCrew() {
  if (crew) return crew;
  const mat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.1 });
  const make = (seed) => {
    const rig = buildHumanoid(mat, { height: 1.8, gun: false });
    rig.styleSeed = seed;
    setReliefFace(rig);   // the NFT body's 3D trollface head (blocky-body.js)
    rig.root.visible = false;
    rig.root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    game.scene.add(rig.root);
    return { rig, phase: Math.random() * 6, pos: {} };
  };
  const mate = make(11);
  // His own oxygen mask: a copy of yours, on his face while he breathes.
  mate.mask = oxygenMask().clone();
  mate.mask.visible = false;
  mate.mask.scale.setScalar(2.2);
  mate.mask.position.set(0, 0.14, -0.06 - 0.085 * mate.rig.scale);   // out over the relief face's dome
  mate.rig.parts.headPivot.add(mate.mask);
  crew = { jm: make(7), mate };
  return crew;
}

/* Tests: who's drawn, and where (world). */
export function crewState() {
  if (!crew) return null;
  const at = (n) => ({ shown: n.rig.root.visible, x: n.rig.root.position.x, y: n.rig.root.position.y, z: n.rig.root.position.z });
  const w = (o, x = 0, y = 0, z = 0) => o.localToWorld(new THREE.Vector3(x, y, z));
  const jr = crew.jm.rig, mr = crew.mate.rig, g = jr.parts.head.geometry.parameters;
  jr.root.updateMatrixWorld(true);
  mr.root.updateMatrixWorld(true);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(jr.root.getWorldQuaternion(new THREE.Quaternion()));
  return {
    jm: at(crew.jm), mate: at(crew.mate), mask: crew.mate.mask.visible,
    // how far his head is ahead of his hips (the lean), his right hand from his mouth
    jmLean: w(jr.parts.head).sub(w(jr.parts.hips)).dot(fwd),
    jmHandToMouth: w(jr.parts.handR).distanceTo(w(jr.parts.head, 0.12 * g.width / 2, -0.42 * g.height / 2, 0.05)),
    // the squad mate's hands from his mask
    // his right hand over his head (the wave goodbye)
    jmHandOverHead: w(jr.parts.handR).y - w(jr.parts.head).y,
    mateHandsToMask: Math.max(w(mr.parts.handL).distanceTo(w(crew.mate.mask)), w(mr.parts.handR).distanceTo(w(crew.mate.mask))),
    // where his hands are (world)
    jmHands: w(jr.parts.handL).add(w(jr.parts.handR)).multiplyScalar(0.5).toArray(),
    jmHandR: w(jr.parts.handR).toArray(),
  };
}

export function hideCrew() {
  if (!crew) return;
  crew.jm.rig.root.visible = false;
  crew.mate.rig.root.visible = false;
}

const _q = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
// Torso pitch that bends the body forward (toward where it faces): checked
// in tools/troll-ops-drop-cine-test.mjs (the jumpmaster's head goes toward you).
const LEAN = -1;
const LEGS = ["legL", "legR", "kneeL", "kneeR", "ankleL", "ankleR"];
const _stand = {};

/* Pose one of them for the frame (plane-local `x, z, yaw`), then carry the
   rig out to where the plane is. `sit` 0 standing .. 1 sat on the seat
   (in between, rising: the legs and the hips go from one to the other). */
function place(npc, { x, z, yaw, moving = false, mps = 0, sit = 0, pitch = 0, dt }) {
  const rig = npc.rig;
  rig.root.visible = true;
  rig.root.position.set(x, 0, z);
  rig.root.quaternion.identity();
  if (moving) npc.phase += dt * gaitPhaseRate(mps, rig.legScale);
  aimRig(rig, yaw, dt, { moving });
  poseHumanoid(rig, { phase: npc.phase, moving, pitch, lower: 0, strafe: 0, forward: 1, speed: moving ? Math.min(1, mps / 4.2) : 0, mps: moving ? mps : 0, dt, hasGun: false, hold: "none" });
  if (sit > 0) {
    const p = rig.parts;
    for (const k of LEGS) (_stand[k] ||= new THREE.Euler()).copy(p[k].rotation);
    const y0 = rig.root.position.y;
    poseSeated(rig, CREW.seatY, 0.1);
    if (sit < 1) {
      for (const k of LEGS) {
        const r = p[k].rotation, s = _stand[k];
        r.set(s.x + (r.x - s.x) * sit, s.y + (r.y - s.y) * sit, s.z + (r.z - s.z) * sit);
      }
      rig.root.position.y = y0 + (rig.root.position.y - y0) * sit;
      // Getting up: the weight goes forward over the feet first.
      p.torso.rotation.x += LEAN * 0.45 * Math.sin(Math.PI * Math.min(1, sit));
      rig.body?.update?.();
    }
  }
  rig.root.updateMatrixWorld(true);
  return rig;
}
function carry(rig, m) {
  rig.root.position.applyMatrix4(m);
  rig.root.quaternion.premultiply(_q.setFromRotationMatrix(m));
}

/* A spot on his own face board in reachHand's chest space (emotes.js does
   the same): `x`, `y` across and up the face in half-widths/heights,
   `front` out in front of it. */
function facePoint(rig, x, y, front, out) {
  const head = rig.parts.head, g = head.geometry.parameters;
  head.updateWorldMatrix(true, false);
  rig.parts.chest.updateWorldMatrix(true, false);
  out.set(x * g.width / 2, y * g.height / 2, front);
  return rig.parts.chest.worldToLocal(head.localToWorld(out));
}
/* A point of `obj` (its own frame) in chest space. */
function chestPoint(rig, obj, x, y, z, out) {
  obj.updateWorldMatrix(true, false);
  rig.parts.chest.updateWorldMatrix(true, false);
  return rig.parts.chest.worldToLocal(obj.localToWorld(out.set(x, y, z)));
}
/* From hanging at the side (`side` -1 left, 1 right) to `target`, by `k`. */
const _hang = new THREE.Vector3();
function reachFrom(rig, side, target, k, pole) {
  _hang.set(side * 0.3, -0.62, 0.02).multiplyScalar(rig.scale).lerp(target, k);
  reachHand(rig, side, _hang, pole);
}
const POLE_DOWN_R = new THREE.Vector3(0.6, -1, 0.2), POLE_DOWN_L = new THREE.Vector3(-0.6, -1, 0.2);

/* Each frame of the scene: `r` the royale state, `t` the drop clock,
   `you` { x, z } your spot (plane-local), `side` -1 port / +1 starboard. */
export function updateCrew(r, t, dt, you, side, seatZ) {
  const sq = r.drop.squadron, m = sq.planeM[sq.ridden];
  if (!m) return;
  const { jm, mate } = ensureCrew();

  // ---- the jumpmaster
  const jz = Math.max(-4.9, Math.min(4.6, seatZ - 1.0));
  const toYou = [{ x: 0, z: -5.0 }, { x: side * 0.62, z: -4.9 }, { x: side * 0.62, z: jz }];
  const toRamp = [{ x: side * 0.62, z: jz }, { x: side * 0.45, z: jz + 0.3 }, { x: side * 0.45, z: 3.6 }, { x: side * 1.0, z: RAMP_PANEL.z }];
  const jp = t < CREW.jmToRamp
    ? pathAt(toYou, CREW.jmWalk, paceFor(toYou, CREW.jmWalk, CREW.jmBy, 1.4), t, jm.pos)
    : pathAt(toRamp, CREW.jmToRamp, paceFor(toRamp, CREW.jmToRamp, CREW.atPanel, 1.6), t, jm.pos);
  let jyaw = jp.yaw, jpitch = 0;
  const atYou = Math.atan2(-(you.x - jp.x), -(you.z - jp.z));
  if (t < CREW.jmWalk) jyaw = Math.PI;   // by the hatch, looking down the hold
  else if (!jp.moving && t < CREW.jmToRamp) {
    // By you: facing you, looking down at you sat there; then round to
    // face aft along the aisle to point at the ramp.
    const aft = smooth(CREW.point[0] - 0.4, CREW.point[0], t);
    jyaw = lerpAngle(atYou, Math.PI, aft);
    jpitch = -0.4 * (1 - aft);
  } else if (!jp.moving && t >= CREW.press[0] - 0.4 && t < CREW.press[1] + 0.2) jyaw = -side * Math.PI / 2;   // to his wall: the panel
  else if (!jp.moving && t >= CREW.door[0]) jyaw = Math.PI;   // facing out of the door with you
  else if (!jp.moving) jyaw = atYou;   // at the ramp: watching you
  const jrig = place(jm, { x: jp.x, z: jp.z, yaw: jyaw, moving: jp.moving, mps: 2.4, pitch: jpitch, dt });
  poseJumpmaster(jrig, t);
  pressButton(jrig, t, side, r.drop.hold);
  jm.lastT = t;
  carry(jrig, m);

  // ---- the squad mate (solo only: a squad has its own, in its file)
  if (r.file?.n > 1) { mate.rig.root.visible = false; mate.mask.visible = false; return; }
  const ms = crewSeat(r.seat), spot = SEAT_SPOTS[ms];
  const mside = Math.sign(spot.x);
  const seatYaw = mside < 0 ? -Math.PI / 2 : Math.PI / 2;
  const mPath = [{ x: mside * 1.1, z: spot.z }, { x: mside * 0.72, z: spot.z + 0.1 }, { x: mside * 0.72, z: 3.9 }, { x: mside * 0.45, z: 4.5 }];
  let mrig;
  const rise = smooth(CREW.stand, CREW.mateWalk, t);
  if (t < CREW.mateWalk) {
    // Sat facing across; rising, the hips come forward off the seat.
    const sx = mside * (1.36 - 0.26 * rise);
    mrig = place(mate, { x: sx, z: spot.z, yaw: seatYaw, sit: 1 - rise, pitch: -0.08 + Math.sin(t * 0.9) * 0.04 * (1 - rise), dt });
    poseMateSeated(mate, mrig, t, 1 - rise);
  } else {
    const mp = pathAt(mPath, CREW.mateWalk, paceFor(mPath, CREW.mateWalk, -3.6, 2.2), t, mate.pos);
    let yaw = mp.yaw;
    // At the ramp facing aft, out of the door with you.
    if (!mp.moving) yaw = Math.PI;
    mrig = place(mate, { x: mp.x, z: mp.z, yaw, moving: mp.moving, mps: 2.6, dt });
    mate.mask.visible = false;
  }
  carry(mrig, m);
}

/* His arms, all hands placed by IK on what they touch or point at:
   the lean in with two fingers tapping his own mouth (mask on), the point
   aft along the aisle, the "turn round" twirl beside his head, then GO, the
   flat hand chopping toward the ramp behind you. Otherwise they hang. */
function poseJumpmaster(rig, t) {
  const p = rig.parts, s = rig.scale;
  const lean = smooth(CREW.lean[0], CREW.lean[0] + 0.35, t) * (1 - smooth(CREW.lean[1] - 0.3, CREW.lean[1], t));
  if (lean > 0) {
    p.torso.rotation.x += LEAN * 0.22 * lean;
    rig.root.updateMatrixWorld(true);
    const tap = Math.max(0, Math.sin((t - CREW.lean[0]) * 8));
    reachFrom(rig, 1, facePoint(rig, 0.12, -0.42, 0.05 + 0.05 * tap, _a), lean, POLE_DOWN_R);
  }
  const point = smooth(CREW.point[0], CREW.point[0] + 0.3, t) * (1 - smooth(CREW.point[1] - 0.2, CREW.point[1], t));
  if (point > 0) {
    // Arm straight out ahead at shoulder height: the way he faces, aft.
    reachFrom(rig, 1, _a.set(0.2 * s, 0.12 * s, -0.62 * s), point, POLE_DOWN_R);
  }
  const door = smooth(CREW.door[0], CREW.door[0] + 0.3, t) * (1 - smooth(CREW.door[1] - 0.2, CREW.door[1], t));
  if (door > 0) {
    // Arm out at the door ahead of him, a little up: out there.
    reachFrom(rig, 1, _a.set(0.18 * s, 0.2 * s, -0.62 * s), door, POLE_DOWN_R);
  }
  const wait = smooth(CREW.wait[0], CREW.wait[0] + 0.2, t) * (1 - smooth(CREW.wait[1] - 0.1, CREW.wait[1], t));
  if (wait > 0) {
    // A flat hand up at shoulder height: hold it... hold it...
    reachFrom(rig, 1, _a.set(0.26 * s, 0.22 * s, -0.36 * s), wait, POLE_DOWN_R);
  }
  const go = smooth(CREW.go[0], CREW.go[0] + 0.15, t) * (1 - smooth(CREW.go[1] - 0.3, CREW.go[1], t));
  if (go > 0) {
    // Up by the ear, then down and out at the door, over and over.
    const chop = Math.max(0, Math.sin((t - CREW.go[0]) * 11));
    _b.set(0.25 * s, 0.3 * s, -0.15 * s);
    _c.set(0.18 * s, -0.05 * s, -0.6 * s);
    reachFrom(rig, 1, _a.copy(_c).lerp(_b, chop), go, POLE_DOWN_R);
  }
  const wave = smooth(CREW.wave[0], CREW.wave[0] + 0.3, t) * (1 - smooth(CREW.wave[1] - 0.3, CREW.wave[1], t));
  if (wave > 0) {
    // The hand up over his head, side to side.
    const sway = Math.sin((t - CREW.wave[0]) * 7);
    reachFrom(rig, 1, _a.set((0.3 + 0.14 * sway) * s, 0.5 * s, -0.18 * s), wave, POLE_DOWN_R);
  }
  rig.body?.update?.();
  rig.root.updateMatrixWorld(true);
}

/* The ramp's button (royale-hold.js RAMP_PANEL): his right hand up to
   it, the thumb in, and down again; the button goes in and lights up. */
function pressButton(rig, t, side, hold) {
  const reach = smooth(CREW.press[0], CREW.press[0] + 0.4, t) * (1 - smooth(CREW.press[1] - 0.3, CREW.press[1], t));
  const push = smooth(CREW.push[0], CREW.push[0] + 0.1, t) * (1 - smooth(CREW.push[1] - 0.1, CREW.push[1], t));
  hold?.pressRamp(side, push);
  if (reach <= 0) return;
  rig.root.updateMatrixWorld(true);
  // (posed plane-local: the rig's world is the plane's frame till carry())
  RAMP_PANEL.at(side, _c);
  _c.x -= side * (0.06 - 0.045 * push);   // the hand just off the button, then on it
  _c.y += 0.05;   // (the IK places the wrist: the hand hangs below it)
  reachFrom(rig, 1, rig.parts.chest.worldToLocal(_c), reach, POLE_DOWN_R);
  rig.body?.update?.();
  rig.root.updateMatrixWorld(true);
}

/* The squad mate in his seat: hands on his knees; with you, both hands
   hold his own mask over his mouth and nose while he breathes. The mask is
   only there while the hands have it (it comes up with them, goes down
   with them). `sit` < 1 while he gets up: the hands come off the knees. */
function poseMateSeated(npc, rig, t, sit) {
  const hands = smooth(CREW.mask[0] - 0.35, CREW.mask[0], t) * (1 - smooth(CREW.mask[1], CREW.mask[1] + 0.35, t));
  npc.mask.visible = hands > 0.85;
  rig.root.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    // Knees: out in front of the hips at seat height (chest space).
    _b.set(side * 0.13 * rig.scale, -0.5 * rig.scale, -0.36 * rig.scale);
    // The mask's rim either side (its own frame, before its scale).
    chestPoint(rig, npc.mask, side * 0.05, -0.005, 0.01, _c);
    _a.copy(_b).lerp(_c, hands);
    reachFrom(rig, side, _a, sit, side > 0 ? POLE_DOWN_R : POLE_DOWN_L);
  }
  rig.body?.update?.();
  rig.root.updateMatrixWorld(true);
}
