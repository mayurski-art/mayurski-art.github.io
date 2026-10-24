// Troll Forces — surfing Grin Beach (Grin Beach 5c), in Socialize.
//
// Hold X at a rack for a board (gb-surfboard.glb, Blender) and carry it
// down the sand. Wade past the seawall and you're on it, paddling: W
// paddles, the mouse (or A/D) points the nose. When a swell lifts you from
// behind in the break, Space pops you up. Riding, the wave carries you
// shoreward; aim down the line (along the wave) for speed. Ride it in and
// the banner says how far you went. Fall behind the crest and the wave
// leaves you; hit a piling or go straight back over the lip and you wipe
// out (a splash: surf-splash.js). C slides you off into the water. The poses are the TF_Rig clips made
// in Roblox Studio (characters/clips/surf-*.json).
//
// The water is surf-sea.js: seaHeight() is what the shader draws, and the
// sea clock is the same on every client, so a rider sits on the same crest
// for everyone. While on the board this module moves us (movement.js is
// bypassed, as on a horse). Our position is the board's nose end while
// paddling (where the head is: the eye sits there) and its middle riding.
//
// The wire (state packet): `sf` the state (1 carry .. 5 wipe), `sy` the
// board's yaw, `sc` its colour.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6";
import { bar, rpExtras, rpLast, seated } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1";
import { peerPosers } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6";
import { localPosers } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1";
import { groundHeightAt, resolveCircle } from "../core/movement.js?v=umb2-sb2-gj1b7-or1-gf1-tg1";
import { loadClip, sampleClip } from "../characters/clips.js?v=rc1";
import { loadModel } from "../maps/battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1";
import { SURF, WAVES, SEA_CLOCK, seaHeight, seaSlope } from "../maps/surf-sea.js?v=gb1";
import { surfSplash, updateSurfSplash } from "./surf-splash.js?v=sp2";

export const SURFING = {
  reach: 2.4,                 // m from a rack to take a board
  grabTime: 0.5, rackTime: 0.5,
  onAt: 1.6,                  // m out past the tideline: on the board
  offAt: 1.1,                 // m: back in this shallow, you stand up
  paddle: 2.3, paddleAccel: 1.8, back: 0.5, drag: 0.9,   // m/s, m/s², 1/s
  turn: 2.2,                  // rad/s toward where you look (A/D adds)
  catchBand: [6, 21],         // m out: where a swell can be caught
  catchH: 0.2, catchFace: [0.2, 4], catchSpeed: 0.9,   // m lifted, m ahead of the crest, m/s
  popTime: 0.55, wipeTime: 1.2, grace: 1.4,
  arch: [0.18, 0.16, 0.32],   // rad added to torso, chest, neck paddling (the head up)
  rideMax: 9, rideFric: 0.22, pump: 1.4, rideMin: 1.0,
  gravity: 9.8 * 0.65,
  nose: 0.85,                 // m: board centre to the head, paddling
  eyePaddle: 0.5, eyeRide: 1.32, deck: 0.05,
  colors: [0xf4ead2, 0x3ab8d8, 0xf0702a, 0xf2d23a, 0xe84a7a],
};
const ST = { none: 0, carry: 1, paddle: 2, pop: 3, ride: 4, wipe: 5 };
const CLIP_OF = { 2: "surf-paddle", 3: "surf-pop", 4: "surf-ride", 5: "surf-wipe" };
const WAVE = WAVES[0];
const SPEED = WAVE.L / WAVE.T;   // the swell's speed toward the shore, m/s
const TAU = Math.PI * 2;

export const surf = {
  state: ST.none, t: 0, color: 0,
  x: 0, z: 0, y: 0, yaw: 0, s: 0, pitch: 0, roll: 0,
  ride: null,          // { x0, z0, dist, top, at }
  heard: { catch: 0, wipe: 0, ride: 0, miss: 0 },
  lastRide: null,
};
const spots = () => (game.isSocial() ? game.builtMap?.map?.rp?.surf?.() || null : null);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const fwd = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
const outAt = (z) => SURF.shore - z;   // metres out past the tideline
export const surfing = () => surf.state >= ST.paddle;
export const carrying = () => surf.state === ST.carry;

/* ------------------------------------------------------------ the clips */

const CLIPS = {};
for (const n of Object.values(CLIP_OF)) loadClip(n).then((c) => { CLIPS[n] = c; }, (e) => console.warn(e.message));
const _samp = {};
/* A rig in a surf clip at time t: every joint the clip drives, the hips'
   slide too (laid down, crouched), off the rig's own rest height. */
function poseClip(rig, state, t) {
  const clip = CLIPS[CLIP_OF[state]];
  if (!clip) return false;
  const s = sampleClip(clip, t, _samp);
  const p = rig.parts, k = rig.scale || 1;
  for (const name in s) {
    const o = p[name];
    if (!o) continue;
    o.quaternion.copy(s[name].q);
    if (name === "hips") o.position.set(s[name].p ? s[name].p.x * k : 0, (rig.hipY ?? 0.6 * k) + (s[name].p ? s[name].p.y * k : 0), s[name].p ? s[name].p.z * k : 0);
  }
  return true;
}

/* ------------------------------------------------------------ the boards */

let boardScene = null;
loadModel("gb-surfboard").then((m) => { boardScene = m; }, (e) => console.warn("gb-surfboard", e?.message || e));
const boards = new Map();   // who ("me" or a peer id) -> { mesh, color }
function boardFor(who, color) {
  let b = boards.get(who);
  if (b && b.color !== color) { b.mesh.parent?.remove(b.mesh); b = null; boards.delete(who); }
  if (!b) {
    if (!boardScene) return null;
    const mesh = boardScene.clone(true);
    const tint = new THREE.Color(SURFING.colors[color % SURFING.colors.length]);
    mesh.traverse((n) => {
      if (!n.isMesh) return;
      n.material = n.material.clone();
      n.material.color.copy(tint);
      n.castShadow = true;
    });
    mesh.name = "surfboard";
    b = { mesh, color };
    boards.set(who, b);
  }
  if (!b.mesh.parent) game.scene.add(b.mesh);
  return b;
}
function dropBoard(who) {
  const b = boards.get(who);
  if (b) { b.mesh.parent?.remove(b.mesh); boards.delete(who); }
}
const _e = new THREE.Euler(0, 0, 0, "YXZ");
/* A board on the water (or carried): its middle at (x, y, z) under yaw,
   pitched and rolled. */
function placeBoard(b, x, y, z, yaw, pitch = 0, roll = 0) {
  b.mesh.position.set(x, y, z);
  b.mesh.quaternion.setFromEuler(_e.set(pitch, yaw, roll, "YXZ"));
}
/* Under the right arm: on edge at the hip, nose forward. */
const _a = new THREE.Vector3();
function carryBoard(b, rig, yaw) {
  const k = rig.scale || 1;
  rig.root.updateMatrixWorld(true);
  _a.set(0.36 * k, 0.88 * k, 0.1 * k).applyMatrix4(rig.root.matrixWorld);
  b.mesh.position.copy(_a);
  b.mesh.quaternion.setFromEuler(_e.set(0.08, yaw, -Math.PI / 2, "YXZ"));
}
function poseCarry(rig) {
  const p = rig.parts;
  p.armR?.rotation.set(0.05, 0, 0.42);
  p.elbowR?.rotation.set(0.75, 0, 0);
  rig.body?.update?.();
}

/* ------------------------------------------------------------- the sea */

const _sl = { x: 0, z: 0 };
/* Where W0's nearest crest is (z) at x, and the rider's place on it: o > 0
   is ahead of the crest, on the face (it travels +z, shoreward). */
function crestOffset(x, z, t) {
  const kz = TAU / WAVE.L;
  // phase = kz (dir.x x + dir.z z) - w t; a crest at phase pi/2 + 2 pi n
  const ph = kz * (WAVE.dir[0] * x + WAVE.dir[1] * z) - (TAU / WAVE.T) * t;
  let d = (ph - Math.PI / 2) / TAU;
  d -= Math.round(d);
  return (d * WAVE.L) / WAVE.dir[1];
}
const waterY = (x, z, t) => SURF.y + seaHeight(x, z, t);

/* -------------------------------------------------------------- actions */

function nearRack(R) {
  for (const [x, z] of R.racks) if (Math.hypot(x - game.move.pos.x, z - game.move.pos.z) < SURFING.reach) return true;
  return false;
}
function surfAction() {
  const R = spots();
  if (!R || !game.player.alive || seated) return null;
  if (surfing()) return null;
  if (nearRack(R)) {
    if (carrying()) return { key: "surf:rack", label: "Put the board back on the rack", ctx: "Rack", time: SURFING.rackTime, done: () => setState(ST.none) };
    if (bar.role) return { key: "surf:rack", info: true, label: "One job at a time" };
    return { key: "surf:grab", label: "Grab a surfboard", busy: "Lifting it off…", ctx: "Board", time: SURFING.grabTime, done: () => grab() };
  }
  // in the surf with it under your arm: back on the board
  if (carrying() && outAt(game.move.pos.z) > SURFING.offAt) return { key: "surf:on", label: "Get on the board", ctx: "Paddle", time: 0.3, done: () => toPaddle() };
  return null;
}
/* Last of everything: on the sand with a board, put it down. */
function dropAction() {
  if (!carrying() || !spots() || outAt(game.move.pos.z) > 0) return null;
  return { key: "surf:drop", label: "Put the board down", ctx: "Drop", time: 0.4, done: () => setState(ST.none) };
}
function grab() {
  surf.color = Math.floor(Math.random() * SURFING.colors.length);
  setState(ST.carry);
  showWaveBanner(game.isTouch ? "Wade out past the wall to paddle" : "Wade out past the wall to paddle · hold X at a rack to put it back", 2600);
}
function setState(s) {
  surf.state = s;
  surf.t = 0;
  if (s === ST.none) dropBoard("me");
}
function toPaddle() {
  const m = game.move;
  const f = fwd(game.look.yaw);
  surf.yaw = game.look.yaw;
  surf.x = m.pos.x - f.x * SURFING.nose;
  surf.z = m.pos.z - f.z * SURFING.nose;
  surf.s = 0;
  setState(ST.paddle);
  if (!surf.taught) { surf.taught = true; showWaveBanner(game.isTouch ? "Push forward to paddle; when a wave lifts you, jump to pop up" : "W paddles · when a wave lifts you from behind, Space pops you up · C slides off", 3200); }
}
/* Off the board, standing in the water with it under the arm. */
function standUp(msg) {
  const m = game.move, f = fwd(surf.yaw);
  m.pos.set(surf.x + f.x * 0.3, 0, surf.z + f.z * 0.3);
  resolveCircle(game.colliders, m.pos, 0.35, 0, 2);
  m.pos.y = groundHeightAt(game.colliders, m.pos.x, m.pos.z, 1.0);
  m.velocity?.set?.(0, 0, 0);
  m.grounded = true;
  setState(ST.carry);
  if (msg) showWaveBanner(msg, 1800);
}

/* ----------------------------------------------------- each frame we surf */

let jumpWas = false;
/* View/player-update.js calls this instead of move.update while surfing. */
export function surfMove(dt, ix, iz, keys) {
  const t = SEA_CLOCK();
  if (!game.player.alive || !spots()) { setState(ST.none); return; }
  const jumpEdge = keys.jump && !jumpWas;
  jumpWas = keys.jump;
  surf.t += dt;
  if ((keys.off || surf.offPressed) && surf.state !== ST.wipe) { surf.offPressed = false; standUp(null); return; }
  surf.offPressed = false;
  // steering: the nose eases round to where you look; A/D turn the view
  game.look.yaw += -ix * SURFING.turn * dt;
  const turnRate = surf.state === ST.ride || surf.state === ST.pop ? SURFING.turn * 1.2 : SURFING.turn * 0.8;
  const want = wrap(game.look.yaw - surf.yaw);
  const turn = Math.max(-turnRate * dt, Math.min(turnRate * dt, want));
  if (surf.state !== ST.wipe) surf.yaw = wrap(surf.yaw + turn);
  const f = fwd(surf.yaw);
  const sl = seaSlope(surf.x, surf.z, t, _sl);
  const o = crestOffset(surf.x, surf.z, t);
  const h = seaHeight(surf.x, surf.z, t);
  const out = outAt(surf.z);

  if (surf.state === ST.paddle) {
    const target = iz > 0.05 ? SURFING.paddle * Math.min(1, iz * 1.25) : iz < -0.05 ? -SURFING.back : 0;
    surf.s += Math.sign(target - surf.s) * Math.min(Math.abs(target - surf.s), SURFING.paddleAccel * dt);
    surf.s *= Math.exp(-SURFING.drag * 0.25 * dt);
    let vx = f.x * surf.s, vz = f.z * surf.s;
    // a swell going under lifts you and sets you back; inside the break the
    // broken water pushes you in
    vz += Math.max(0, -sl.z) * 1.2 + (out < SURF.breakIn - 2 && out > 2 ? 0.35 : 0);
    surf.x += vx * dt; surf.z += vz * dt;
    // catchable: in the band, lifted on the face, heading in, moving
    const shoreward = f.z > 0.55;
    const can = out > SURFING.catchBand[0] && out < SURFING.catchBand[1] && h > SURFING.catchH && o > SURFING.catchFace[0] && o < SURFING.catchFace[1] && shoreward && surf.s > SURFING.catchSpeed;
    surf.can = can;
    if (can && !surf.hinted) { surf.hinted = true; showWaveBanner(game.isTouch ? "Wave! Jump to pop up" : "Wave! Space to pop up", 1200); }
    if (!can && h < 0.08) surf.hinted = false;
    if (can && jumpEdge) {
      surf.s = SPEED + 1.5;
      surf.ride = { x0: surf.x, z0: surf.z, dist: 0, top: 0, at: performance.now() };
      surf.heard.catch++;
      setState(ST.pop);
    }
    if (out < SURFING.offAt) { standUp(null); return; }
  } else if (surf.state === ST.pop || surf.state === ST.ride) {
    // down the slope you speed up, up it you slow; pump for a little more
    const down = -(sl.x * f.x + sl.z * f.z);
    const onFace = smooth(-1.4, -0.3, o) * (1 - smooth(2.5, 5.0, o));
    surf.s += (SURFING.gravity * down + (iz > 0.05 ? SURFING.pump * onFace : 0) - (iz < -0.05 ? 2.5 : 0)) * dt;
    surf.s -= SURFING.rideFric * surf.s * dt;
    surf.s = Math.max(0, Math.min(SURFING.rideMax, surf.s));
    // the wave carries what's on its face
    const vx = f.x * surf.s, vz = f.z * surf.s + SPEED * onFace * Math.max(0, 1 - f.z);
    const bx = surf.x, bz = surf.z;
    surf.x += vx * dt; surf.z += vz * dt;
    const r = surf.ride;
    r.dist += Math.hypot(surf.x - bx, surf.z - bz);
    r.top = Math.max(r.top, Math.hypot(vx, vz));
    if (surf.state === ST.pop && surf.t >= SURFING.popTime) setState(ST.ride);
    const grace = surf.t < SURFING.grace && surf.state !== ST.ride ? true : performance.now() - r.at < SURFING.grace * 1000;
    // the wave goes on without you: behind the crest, slow
    if (!grace && (o < -1.6 || (surf.s < SURFING.rideMin && onFace < 0.2))) { surf.heard.miss++; endRide(false); }
    // straight back out over the lip in the break: over the falls
    else if (!grace && f.z < -0.45 && o > -0.5 && o < 0.8 && out > SURF.breakIn - 1 && out < SURF.breakOut + 2 && h > 0.25) wipe("Over the falls!");
    // ridden all the way in
    else if (out < SURFING.offAt + 1.2) { endRide(true); if (outAt(surf.z) < SURFING.offAt + 0.3) { standUp(null); return; } }
  } else if (surf.state === ST.wipe) {
    // tumbling in the whitewater, pushed in
    surf.z += 1.1 * dt;
    surf.s = 0;
    if (surf.t >= SURFING.wipeTime) {
      if (outAt(surf.z) < SURFING.offAt + 0.4) { standUp(null); return; }
      surf.yaw = Math.PI;   // nose to the shore, on the board again
      game.look.yaw = Math.PI;
      setState(ST.paddle);
    }
  }
  // pilings and the pier ramp: a knock while riding fast is a wipeout
  const at = new THREE.Vector3(surf.x, 0, surf.z);
  resolveCircle(game.colliders, at, 0.4, 0.05, 1.6, 0);
  const knocked = Math.hypot(at.x - surf.x, at.z - surf.z);
  surf.x = at.x; surf.z = at.z;
  if (knocked > 0.02 && surf.state === ST.ride && surf.s > 4) wipe("Wiped out on the pier!");
  const ar = game.ARENA;
  if (ar) { surf.x = Math.max(ar.minX + 1, Math.min(ar.maxX - 1, surf.x)); surf.z = Math.max(ar.minZ + 1, surf.z); }
  // the board sits on the water, pitched and rolled with it (and the carve)
  surf.y = waterY(surf.x, surf.z, t) - 0.02;
  const fs = seaSlope(surf.x, surf.z, t, _sl);
  surf.pitch = Math.atan(fs.x * f.x + fs.z * f.z);
  const across = -fs.x * f.z + fs.z * f.x;
  const carve = surf.state === ST.ride ? Math.max(-0.45, Math.min(0.45, (turn / Math.max(dt, 1e-3)) * surf.s * 0.06)) : 0;
  surf.roll = Math.atan(across) - carve;
  // us: the head end paddling, over the middle standing
  const ahead = surf.state === ST.paddle ? SURFING.nose : surf.state === ST.pop ? SURFING.nose * Math.max(0, 1 - surf.t / SURFING.popTime) : 0;
  const m = game.move;
  m.pos.set(surf.x + f.x * ahead, surf.y + SURFING.deck, surf.z + f.z * ahead);
  m.velocity?.set?.(f.x * surf.s, 0, f.z * surf.s);
  m.grounded = true;
  m.moving = false;
  m.sprinting = false;
  m.eyeHeight = surf.state === ST.paddle ? SURFING.eyePaddle : surf.state === ST.pop ? SURFING.eyePaddle + (SURFING.eyeRide - SURFING.eyePaddle) * Math.min(1, surf.t / SURFING.popTime)
    : surf.state === ST.wipe ? 0.3 : SURFING.eyeRide;
}
function smooth(a, b, x) { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); }
function endRide(made) {
  const r = surf.ride;
  surf.ride = null;
  if (r && r.dist > 4) {
    surf.lastRide = { dist: Math.round(r.dist), top: Math.round(r.top * 3.6), made };
    surf.heard.ride++;
    showWaveBanner(`${made ? "Rode it in" : "Rode"} ${surf.lastRide.dist} m · top ${surf.lastRide.top} km/h`, 2200);
  }
  surf.s = Math.min(surf.s, 1);
  setState(ST.paddle);
}
function wipe(msg) {
  surf.ride = null;
  surf.heard.wipe++;
  setState(ST.wipe);
  surfSplash(surf.x, surf.y, surf.z);
  showWaveBanner(msg, 1500);
  game.audio?.step?.({ x: surf.x, y: surf.y, z: surf.z }, 0.2);
}


/* ------------------------------------------------------ the surfer NPCs

   Grin Beach's cast puts a few surfers out in the lineup (act "surf",
   grinbeach-social.js). This drives them (TownNpcs.takeOver): each sits
   out back, catches the crest that reaches him at his time in a 40 s cycle
   (the sea clock: every client sees the same ride on the same wave), pops
   up, rides it down the line on its face, kicks out and paddles back. */
const NPC_CYCLE = 40, NPC_RIDE = 3.6, NPC_LINE = 4.0, NPC_BACK = 1.5;
/* The time (sea clock) the crest reaches z, at or after t. */
function crestAt(z, t) {
  const k = TAU / WAVE.L, w = TAU / WAVE.T;
  // phase(z, t) = k z - w t = pi/2 + 2 pi n
  const t0 = (k * z * WAVE.dir[1] - Math.PI / 2) / w;
  return t0 + Math.ceil((t - t0) / WAVE.T) * WAVE.T;
}
/* Where NPC i is, doing what, at sea time t. */
export function npcSurfAt(c, t) {
  const L = { x: c.x, z: c.z };
  const off = c.surfAt ?? 0;
  const u = (((t + off) % NPC_CYCLE) + NPC_CYCLE) % NPC_CYCLE;
  const start = t - u;
  const tc = crestAt(L.z - 1.0, start + 2);   // the first crest past him (plus a breath)
  const side = c.line ?? 1;
  const dt = t - tc;
  if (dt < 0 || dt > NPC_RIDE + 0.55 + (NPC_CYCLE - 8)) {
    // in the lineup: sat up waiting, nose to the beach
    return { state: ST.paddle, x: L.x, z: L.z, yaw: Math.PI, rate: 0.25, t };
  }
  const vx = side * NPC_LINE;
  const ride = Math.min(dt, NPC_RIDE + 0.55);
  const rx = L.x + vx * ride, rz = L.z + SPEED * ride;
  if (dt <= 0.55) return { state: ST.pop, x: rx, z: rz, yaw: Math.atan2(-vx, -SPEED), t: dt };
  if (dt <= NPC_RIDE + 0.55) return { state: ST.ride, x: rx, z: rz, yaw: Math.atan2(-vx, -SPEED), t };
  // kicked out: paddle back to the lineup
  const back = dt - NPC_RIDE - 0.55, d = Math.hypot(L.x - rx, L.z - rz), k = Math.min(1, (back * NPC_BACK) / d);
  if (k >= 1) return { state: ST.paddle, x: L.x, z: L.z, yaw: Math.PI, rate: 0.25, t };
  const yaw = Math.atan2(-(L.x - rx), -(L.z - rz));
  return { state: ST.paddle, x: rx + (L.x - rx) * k, z: rz + (L.z - rz) * k, yaw, rate: 1, t };
}
const npcDriven = new Set();
function driveNpcs() {
  const N = game.townNpcs;
  if (!N?.list) return;
  const t = SEA_CLOCK();
  N.list.forEach((n, i) => {
    if (n.c.act !== "surf") return;
    const who = `npc${i}`;
    if (!n.override) {
      N.takeOver(i, (nn, rig) => {
        const a = npcSurfAt(nn.c, SEA_CLOCK());
        const f = fwd(a.yaw);
        const ahead = a.state === ST.paddle ? SURFING.nose : a.state === ST.pop ? SURFING.nose * Math.max(0, 1 - a.t / SURFING.popTime) : 0;
        nn.x = a.x + f.x * ahead; nn.z = a.z + f.z * ahead; nn.yaw = a.yaw;
        const tt = SEA_CLOCK(), by = waterY(a.x, a.z, tt) - 0.02;
        const fs = seaSlope(a.x, a.z, tt, _sl);
        const pitch = Math.atan(fs.x * f.x + fs.z * f.z), roll = Math.atan(-fs.x * f.z + fs.z * f.x);
        poseRider(rig, a.state, a.state === ST.pop ? a.t : (performance.now() / 1000) * (a.rate ?? 1) + nn.seed * 3, a.x, by, a.z, a.yaw, pitch, roll);
        const b = boardFor(who, nn.c.board ?? i);
        if (b) placeBoard(b, a.x, by, a.z, a.yaw, pitch, roll);
      });
      npcDriven.add(who);
    }
    const b = boards.get(who);
    if (b) b.mesh.visible = n.rig.root.visible;
  });
}

/* ------------------------------------------------------------ each frame */

/* After the walk (player-update.js): carrying into the surf puts you on the
   board; the wire; the boards of everyone else are posed by peerPosers. */
let lastOut = -99, lastFrame = 0;
export function updateSurf() {
  const now = performance.now();
  updateSurfSplash(Math.min(0.1, (now - (lastFrame || now)) / 1000));
  lastFrame = now;
  const R = spots();
  if (!R) {
    if (surf.state) setState(ST.none);
    for (const who of [...boards.keys()]) dropBoard(who);
    npcDriven.clear();
    if (game.net) { game.net.surf = 0; game.net.surfYaw = 0; game.net.surfColor = 0; }
    return;
  }
  if (!game.player.alive && surf.state) setState(ST.none);
  driveNpcs();
  const out = outAt(game.move.pos.z);
  if (carrying() && out > SURFING.onAt && lastOut <= SURFING.onAt && game.move.pos.y < 0.5) toPaddle();
  lastOut = surfing() ? 99 : out;
  // boards whose rider stopped surfing (or left)
  for (const who of [...boards.keys()]) {
    if (who === "me") { if (!surf.state) dropBoard(who); continue; }
    if (who.startsWith("npc")) { if (!game.townNpcs?.list?.[+who.slice(3)]) dropBoard(who); continue; }
    const p = game.net.peers.get(who);
    if (!p || !p.surf) dropBoard(who);
  }
  if (game.net) {
    game.net.surf = surf.state;
    game.net.surfYaw = +surf.yaw.toFixed(2);
    game.net.surfColor = surf.color;
  }
}

/* --------------------------------------------------------------- posing */

/* Off the board: the root back to its usual rotation order. */
function unrig(rig) {
  if (rig?.surfed) { rig.surfed = false; rig.root.rotation.set(0, rig.root.rotation.y, 0, "XYZ"); }
}
function poseRider(rig, state, t, bx, by, bz, yaw, pitch, roll) {
  rig.surfed = true;
  rig.root.position.set(bx, by + SURFING.deck, bz);
  // the rider leans with the board (the carve, the slope)
  rig.root.rotation.set(0, yaw, 0, "YXZ");
  if (state === ST.paddle) { rig.root.rotation.x = pitch; rig.root.rotation.z = roll; }
  else if (state === ST.ride) rig.root.rotation.z = roll * 0.6;
  if (!poseClip(rig, state, t)) return;
  // Paddling, the back arches and the head comes up off the deck, looking
  // ahead: real paddlers do, and from behind the trollface then shows over
  // the shoulders instead of sinking into the water.
  if (state === ST.paddle) {
    const p = rig.parts;
    p.torso?.rotateX(SURFING.arch[0]); p.chest?.rotateX(SURFING.arch[1]); p.neckPivot?.rotateX(SURFING.arch[2]);
  }
  rig.root.updateMatrixWorld(true);
  rig.body?.update?.();
}
localPosers.push((rig) => {
  if (!surf.state || !game.isSocial()) { unrig(rig); return; }
  const b = boardFor("me", surf.color);
  if (surf.state === ST.carry) {
    poseCarry(rig);
    if (b) carryBoard(b, rig, game.look.yaw);
    return;
  }
  const t = surf.state === ST.paddle || surf.state === ST.ride ? performance.now() / 1000 : surf.t;
  poseRider(rig, surf.state, surf.state === ST.paddle ? t * Math.max(0.35, Math.abs(surf.s) / SURFING.paddle) : t, surf.x, surf.y, surf.z, surf.yaw, surf.pitch, surf.roll);
  if (b) placeBoard(b, surf.x, surf.y, surf.z, surf.yaw, surf.pitch, surf.roll);
});
peerPosers.push((rp, dt) => {
  if (!game.isSocial() || !spots()) return;
  const p = rp.peer, st = p?.surf | 0;
  if (!st) { unrig(rp.rig); return; }
  const b = boardFor(p.id, p.surfColor | 0);
  if (st === ST.carry) {
    poseCarry(rp.rig);
    if (b) carryBoard(b, rp.rig, rp.rig.root.rotation.y);
    return;
  }
  // a state change starts its clip over
  const fell = rp.surfSt !== st && st === ST.wipe;
  if (rp.surfSt !== st) { rp.surfSt = st; rp.surfT = 0; }
  rp.surfT = (rp.surfT || 0) + (dt || 0);
  const yaw = p.surfYaw ?? 0, f = fwd(yaw);
  const ahead = st === ST.paddle ? SURFING.nose : st === ST.pop ? SURFING.nose * Math.max(0, 1 - rp.surfT / SURFING.popTime) : 0;
  const bx = rp.pos.x - f.x * ahead, bz = rp.pos.z - f.z * ahead;
  const t = SEA_CLOCK();
  const by = waterY(bx, bz, t) - 0.02;
  const fs = seaSlope(bx, bz, t, _sl);
  const pitch = Math.atan(fs.x * f.x + fs.z * f.z), roll = Math.atan(-fs.x * f.z + fs.z * f.x);
  if (fell) surfSplash(bx, by, bz);
  poseRider(rp.rig, st, st === ST.paddle || st === ST.ride ? performance.now() / 1000 : rp.surfT, bx, by, bz, yaw, pitch, roll);
  if (b) placeBoard(b, bx, by, bz, yaw, pitch, roll);
});

/* First person: paddling, the hands reach and pull in turn; standing, they
   sit out low either side. */
export function surfArms() {
  if (!surfing()) return null;
  if (surf.state === ST.paddle) {
    const u = (performance.now() / 1000) * Math.max(0.35, Math.abs(surf.s) / SURFING.paddle) / 1.3;
    const hand = (side, ph) => {
      const a = TAU * ((u + ph) % 1);
      return { pos: [side * 0.2, -0.42 + 0.14 * Math.cos(a), -0.42 - 0.18 * Math.sin(a)], rot: [0.9, side * 0.15, -side * Math.PI / 2], pose: "open" };
    };
    return { R: hand(1, 0), L: hand(-1, 0.5), gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
  }
  if (surf.state === ST.ride) {
    const hand = (side) => ({ pos: [side * 0.42, -0.4, -0.3], rot: [0.2, side * 0.3, -side * Math.PI / 2], pose: "open" });
    return { R: hand(1), L: hand(-1), gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
  }
  return { R: null, L: null, gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
}

/* -------------------------------------------------------------- hook up */

// C to slide off: caught as it's pressed (a tap can fall between frames)
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyC" && !e.repeat && surfing() && !game.localPauseOnly && !e.ctrlKey && !e.metaKey && !e.altKey) surf.offPressed = true;
  });
}

rpExtras.push(surfAction);
rpLast.push(dropAction);

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollSurf = {
    SURFING, ST, surf, grab, toPaddle, standUp, wipe, crestOffset, boards, npcSurfAt,
    clips: () => Object.keys(CLIPS),
    state: () => ({ state: surf.state, x: +surf.x.toFixed(2), y: +surf.y.toFixed(2), z: +surf.z.toFixed(2), yaw: +surf.yaw.toFixed(2), s: +surf.s.toFixed(2),
      out: +outAt(surf.z).toFixed(2), crest: +crestOffset(surf.x, surf.z, SEA_CLOCK()).toFixed(2), eye: game.move.eyeHeight, pos: game.move.pos.toArray().map((v) => +v.toFixed(2)),
      ride: surf.ride, last: surf.lastRide, can: !!surf.can, space: game.keys.has("Space"), h: +seaHeight(surf.x, surf.z, SEA_CLOCK()).toFixed(2), heard: { ...surf.heard }, board: !!boards.get("me")?.mesh.parent }),
  };
}
