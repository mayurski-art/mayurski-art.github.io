// Troll Forces — basketball at Troll Beach (5d, docs/GRIN-BEACH-COURTS.md),
// in Socialize. The ball handling, the shot and the ball on the wire; the
// game itself (rules, score, defenders, NPC ballers) builds on this.
//
// - Hold X at the cart by the court for a ball (one each). Walk with it and
//   you dribble it; sprint and it's a quick, low speed dribble. Walk 24 m
//   off the court and it goes back on the cart.
// - Size-up: hold right mouse (Q, the left trigger, the AIM button) and the
//   look becomes the stick, as in 2K: flick toward your other hand for a
//   crossover, the same way for a hesitation, pull back for a behind-the-
//   back, push up for a hesitation, a half circle for a spin, pull back with
//   jump held for a step-back. Two in a row chain. Each move costs stamina
//   and bursts you off the way it goes.
// - Fire shoots: hold to rise into the jumper, the meter fills, let go in
//   the green. Its width is the shot's difficulty: distance, moving,
//   fading, tired. Driving at the rim it's a layup (left side, left hand);
//   at a sprint inside 4.5 m, a dunk (the arcade leap: up to the rim,
//   through, hang, drop). Outside the arc (6 m) it's worth 2, inside 1.
// - The ball after a shot is the court ball (court-ball.js): the same
//   flight, rattle and bounce on every screen. Walk over it or jump at it
//   to grab it; two grabs at once, the lower id keeps it.
// - Without the ball: hold the size-up for a defensive stance; fire near
//   a ball handler pokes at it (a steal, or a step beaten); jump at a shot
//   in its first moments to block it. A defender close in front of a
//   shooter narrows their green (more if he's up). E passes to the
//   teammate you look nearest.
// - hoops-game.js (the game to 11, the NPC ballers) listens through
//   hoopsHooks and says when a shot may go up, who defends, who's a mate.
//
// The clips are TF_Rig's in Roblox Studio (tools/troll-ops-hoops-poses.mjs,
// characters/clips/hoop-*.json); a left-handed move plays its right-handed
// clip mirrored.
//
// The wire: the state packet's `hb` (the ball we hold), `hm` (the clip:
// index + 1, negative mirrored), `ha` (its start, room ms); rp "hb"
// messages: launch { id, L, by }, grab { id, at, by }, state { id, L } (the
// ball's keeper repeats its last launch every few seconds for late
// joiners), steal { id, L, by }, gone { id }. `by` is an NPC ("npc4") the
// sender drives, or the sender.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8";
import { bar, rpExtras, rpListeners, seated } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8";
import { peerPosers } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8";
import { localPosers } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8";
import { resolveCircle } from "../core/movement.js?v=umb2-sb2-gj1b7-or1-gf1-tg1-rfx1";
import { loadClip, sampleClip, applyClip, CLIP_SPINE, CLIP_ARM_L, CLIP_ARM_R } from "../characters/clips.js?v=rc1";
import { loadModel } from "../maps/battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1-hgb6";
import { swishNet } from "../maps/grinbeach-courts.js?v=gb5-tb2-kbb2-kbs1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-hgb2-ugb1-ug1-ugm1-hgb5-hgb6-hgb8";
import { touchState } from "../input/touch.js?v=in1-th2-bp1-bf1-pd1-nf1-fs1";
import { roomNow } from "./room-clock.js?v=rc1-cd1-sh1";
import { hoopsWorld, newBall, advanceBall, solveShot, makeLaunch } from "./court-ball.js?v=gb5-gb8";
import { courtSound } from "../sound/court-sfx.js?v=gb6";

export const HOOPS = {
  reach: 2.3,                    // m from the cart to take a ball
  takeTime: 0.4,
  carry: 24,                     // m from the court's middle before the ball goes back
  maxBalls: 6,
  grabR: 0.85, grabUp: 2.45, grabJump: 3.1,   // m: a loose ball this near (and under this) is ours
  dribble: 0.5, sprintDribble: 0.36,          // s a bounce
  flick: 0.075, flickWin: 0.09, sweep: 1.9,   // rad of look to flick; s to see its shape; rad of turn = a spin
  flickRest: 0.16,               // s after a flick before the next one counts (the rest of the same swipe)
  chain: 0.22,                   // s after a move a flick chains
  meterFull: 0.5, release: 0.44, // s: the meter's top; the jumper's set point
  late: 0.62,                    // s held: it goes anyway
  window: 0.085,                 // s either side of the set point that's green, before the modifiers
  arc: 6.0,                      // m from the rim: a 2
  dunkR: [1.2, 4.6], layupR: 3.2,
  regen: 0.2, sprintCost: 0.05,
};
const MOVES = {
  cross: { clip: "hoop-cross", dur: 0.34, swap: true, burst: [1, 0.2, 3.4], at: [0.1, 0.3], cost: 0.08, brk: 0.55, bounce: 0.14 },
  behind: { clip: "hoop-behind", dur: 0.42, swap: true, burst: [1, 0.1, 2.8], at: [0.18, 0.4], cost: 0.1, brk: 0.5, bounce: 0.22 },
  hesi: { clip: "hoop-hesi", dur: 0.5, swap: false, burst: [0, 1, 5.0], at: [0.34, 0.5], slow: 0.3, cost: 0.06, brk: 0.45, bounce: 0.2 },
  inout: { clip: "hoop-hesi", dur: 0.5, swap: false, burst: [-1, 0.8, 3.6], at: [0.32, 0.5], slow: 0.25, cost: 0.06, brk: 0.4, bounce: 0.2 },
  spin: { clip: "hoop-spin", dur: 0.5, swap: true, burst: [1, 0.7, 3.2], at: [0.08, 0.46], cost: 0.14, brk: 0.7, full: true },
  stepback: { clip: "hoop-stepback", dur: 0.46, swap: false, burst: [0, -1, 4.6], at: [0.04, 0.3], cost: 0.12, brk: 0.6, full: true, gather: true },
};
export const CLIP_IDS = ["hoop-dribble-r", "hoop-dribble-l", "hoop-cross", "hoop-behind", "hoop-hesi", "hoop-spin", "hoop-stepback",
  "hoop-jumper", "hoop-layup", "hoop-dunk", "hoop-pass", "hoop-stance", "hoop-steal", "hoop-block", "hoop-grab", "hoop-hold"];
const FULL_BODY = new Set(["hoop-spin", "hoop-stepback", "hoop-jumper", "hoop-layup", "hoop-dunk", "hoop-block", "hoop-grab", "hoop-steal"]);
const UPPER = [...CLIP_SPINE, ...CLIP_ARM_L, ...CLIP_ARM_R, "headPivot"];

/* Our side: the ball we hold, the hand it's in, what we're doing. */
export const H = {
  ball: null, hand: 1, live: false,    // live: dribbling (a caught ball starts held: move to start the dribble)
  move: null, queued: null, lastMoveEnd: -9,
  shot: null, stamina: 1,
  size: { on: false, yaw: 0, pitch: 0, sx: 0, sy: 0, path: null },
  clip: "hoop-hold", clipAt: 0, mirror: false,   // what our body plays, from when (room ms)
  seq: 0, feedback: null, last: null,
  act: null,       // without the ball: { clip, t, dur } the stance, a poke, a block
  beaten: 0,       // s left of a whiffed poke (a step slow)
};
/* Every ball on the court: id -> { id, mesh, holder, sim, keeper, grab, seen, shooter, pts, hoopT } */
export const balls = new Map();
const spots = () => (game.isSocial() ? game.builtMap?.map?.rp?.courts?.() || null : null);
let world = null, worldFor = null;
const courtWorld = (S) => {
  if (worldFor !== S) { worldFor = S; world = hoopsWorld(S.layout.court, S.layout.rims); }
  return world;
};
const myId = () => game.net?.id || "me";
const send = (m) => game.net?.publishRp?.({ k: "hb", ...m });
export const hoopsActive = () => !!H.ball || !!H.shot;
/* What the game on top (hoops-game.js) hears and decides. */
export const hoopsHooks = {
  onScore: [], onGrab: [], onShot: [], onMove: [], onLaunch: [], onSteal: [], onFrame: [],
  canShoot: () => true,         // false during a check
  defenders: () => [],          // [{ x, z, jump }]: who contests our shot
  mates: () => [],              // [{ id, x, z }]: who we can pass to
  stealOdds: () => 1,           // (ball) a multiplier on a poke's odds
};
const fireHooks = (list, ...a) => { for (const fn of list) fn(...a); };
const isNpc = (id) => typeof id === "string" && /^npc\d+$/.test(id);
/* On court with a ball, or just shot it: the over-the-shoulder camera. */
export const hoopsView = () => game.isSocial() && (!!H.ball || (!!H.shot && H.shot.t < 1.6));

/* ------------------------------------------------------------ the clips */

const CLIPS = {};
for (const n of CLIP_IDS) loadClip(n).then((c) => { CLIPS[n] = c; }, (e) => console.warn(e.message));
const _samp = {}, _mir = {};
const SWAP = { R: "L", L: "R" };
/* A sample mirrored left for right (a left-handed move from the right-
   handed clip): names swapped, the turn reflected through the body's
   middle (x, -y, -z, w), a slide's x flipped. */
function mirrorSample(s) {
  for (const k in _mir) delete _mir[k];
  for (const n in s) {
    const m = n.replace(/[RL]$/, (c) => SWAP[c]);
    const o = _mir[m] || (_mir[m] = { q: new THREE.Quaternion(), p: null });
    o.q.set(s[n].q.x, -s[n].q.y, -s[n].q.z, s[n].q.w);
    if (s[n].p) { o.p = o.p || new THREE.Vector3(); o.p.set(-s[n].p.x, s[n].p.y, s[n].p.z); } else o.p = null;
  }
  return _mir;
}
/* A rig in a hoop clip at t: the whole body (standing, or a move with its
   own legs), or above the hips over the walk's legs. */
function poseHoop(rig, name, t, mirror, full) {
  const clip = CLIPS[name];
  if (!clip || !rig?.parts) return false;
  let s = sampleClip(clip, t, _samp);
  if (mirror) s = mirrorSample(s);
  if (!full) { applyClip(rig, s, 1, UPPER); return true; }
  const p = rig.parts, k = rig.scale || 1;
  for (const n in s) {
    const o = p[n];
    if (!o) continue;
    o.quaternion.copy(s[n].q);
    if (n === "hips") o.position.set(s[n].p ? s[n].p.x * k : 0, (rig.hipY ?? 0.6 * k) + (s[n].p ? s[n].p.y * k : 0), s[n].p ? s[n].p.z * k : 0);
  }
  return true;
}
const clipLen = (n) => CLIPS[n]?.length || 0.5;

/* ------------------------------------------------------------ the balls */

let ballScene = null;
loadModel("gb-basketball").then((m) => { ballScene = m; }, (e) => console.warn("gb-basketball", e?.message || e));
function ballFor(id) {
  let b = balls.get(id);
  if (!b) {
    b = { id, mesh: null, holder: null, sim: null, keeper: null, grab: null, seen: performance.now(), shooter: null, pts: 0, quiet: 0 };
    balls.set(id, b);
  }
  if (!b.mesh && ballScene) { b.mesh = ballScene.clone(true); b.mesh.name = "basketball"; }
  if (b.mesh && !b.mesh.parent) game.scene.add(b.mesh);
  return b;
}
function dropBall(id) {
  const b = balls.get(id);
  if (!b) return;
  b.mesh?.parent?.remove(b.mesh);
  balls.delete(id);
  if (H.ball === id) H.ball = null;
}

/* The court ball's events: the sounds, the net, the shooter's banner. */
function onEvents(b, evs) {
  for (const e of evs) {
    const at = { x: e.p[0], y: e.p[1], z: e.p[2] };
    if (e.kind === "bounce") courtSound("bounce", at, e.speed / 6);
    else if (e.kind === "rim") courtSound("rim", at, e.speed / 5);
    else if (e.kind === "board") courtSound("board", at, e.speed / 6);
    else if (e.kind === "score") {
      courtSound("swish", at, 1);
      b.hoopT = 0; b.hoop = e.hoop;
      if (b.shooter === myId()) {
        const word = b.dunk ? "SLAM DUNK" : e.clean ? (b.pts > 1 ? "SPLASH" : "SWISH") : "BUCKET";
        showWaveBanner(`${word}  +${b.pts}`, 1500);
        H.last = { made: true, clean: e.clean, pts: b.pts };
      }
      fireHooks(hoopsHooks.onScore, b, e);
    }
  }
}

/* ------------------------------------------------------------- actions */

function nearCart(S) {
  const c = S.hoops.rack;
  return Math.hypot(c.x - game.move.pos.x, c.z - game.move.pos.z) < HOOPS.reach;
}
function hoopsAction() {
  const S = spots();
  if (!S || !game.player.alive || seated) return null;
  if (!nearCart(S)) return null;
  // just taken: the same held X does not put it straight back
  if (H.ball && performance.now() - (H.takenAt || 0) < 1500) return null;
  if (H.ball) return { key: "hoops:rack", label: "Put the ball back on the cart", ctx: "Cart", time: HOOPS.takeTime, done: () => rackBall() };
  if (bar.role) return { key: "hoops:busy", info: true, label: "One job at a time" };
  if (balls.size >= HOOPS.maxBalls) return { key: "hoops:empty", info: true, label: "The cart's empty: grab one off the court" };
  return { key: "hoops:take", label: "Grab a basketball", busy: "Off the cart…", ctx: "Ball", time: HOOPS.takeTime, done: () => takeBall() };
}
function takeBall() {
  const id = `${myId()}-${++H.seq}`;
  const b = ballFor(id);
  b.holder = myId(); b.sim = null; b.keeper = myId();
  H.ball = id; H.hand = 1; H.live = false; H.move = null; H.shot = null; H.takenAt = performance.now();
  setClip("hoop-hold");
  if (!H.taught) {
    H.taught = true;
    showWaveBanner(game.isTouch ? "Move to dribble · hold AIM and swipe for moves · hold fire to shoot, let go in the green"
      : "Move to dribble · hold right mouse + flick for moves · hold fire to shoot, let go in the green", 4200);
  }
}
function rackBall() {
  const id = H.ball;
  if (!id) return;
  dropBall(id);
  send({ e: "gone", id });
  H.move = null; H.shot = null;
}
function setClip(name, mirror = false) {
  if (H.clip === name && H.mirror === mirror) return;
  H.clip = name; H.mirror = mirror; H.clipAt = roomNow();
}

/* --------------------------------------------------------- the size-up */

/* The look, while the size-up is held, is the stick: we read how far it
   moved this frame and put it back. A flick is enough of it in a short
   time; its shape over the next few frames says which move. */
function readStick(dt, held) {
  const z = H.size, L = game.look;
  if (!held) { z.on = false; z.path = null; return null; }
  if (!z.on) { z.on = true; z.yaw = L.yaw; z.pitch = L.pitch; z.sx = 0; z.sy = 0; z.path = null; return null; }
  let dx = -(L.yaw - z.yaw), dy = L.pitch - z.pitch;   // right is +x (yaw turns left), up is +y
  dx = Math.atan2(Math.sin(dx), Math.cos(dx));
  L.yaw = z.yaw; L.pitch = z.pitch;
  if (z.path) {
    z.path.x += dx; z.path.y += dy; z.path.t += dt;
    const a = Math.atan2(z.path.y, z.path.x);
    let d = a - z.path.a0;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    z.path.sweep = Math.max(z.path.sweep, Math.abs(d));
    if (z.path.t < HOOPS.flickWin) return null;
    const f = z.path;
    z.path = null; z.sx = 0; z.sy = 0; z.rest = HOOPS.flickRest;
    return { x: f.x, y: f.y, sweep: f.sweep };
  }
  if (z.rest > 0) { z.rest -= dt; z.sx = 0; z.sy = 0; return null; }
  const k = Math.exp(-6 * dt);
  z.sx = z.sx * k + dx; z.sy = z.sy * k + dy;
  if (Math.hypot(z.sx, z.sy) > HOOPS.flick) z.path = { x: z.sx, y: z.sy, t: 0, a0: Math.atan2(z.sy, z.sx), sweep: 0 };
  return null;
}
/* A flick -> a move, from the hand the ball's in. */
function moveFor(f, jump) {
  if (f.sweep > HOOPS.sweep) return "spin";
  if (Math.abs(f.x) > Math.abs(f.y) * 0.9) {
    const toward = Math.sign(f.x);   // +1: to the right
    return toward === -H.hand ? "cross" : "inout";
  }
  if (f.y < 0) return jump ? "stepback" : "behind";
  return "hesi";
}
function startMove(name) {
  const def = MOVES[name];
  if (!def || H.stamina < def.cost * 0.5) return;
  H.move = { name, def, t: 0, from: H.hand, mirror: H.hand < 0 };
  H.lastMove = name;
  H.stamina = Math.max(0, H.stamina - def.cost);
  setClip(def.clip, H.hand < 0);
  H.clipAt = roomNow();
  fireHooks(hoopsHooks.onMove, name, def);
}

/* ------------------------------------------------------------- the shot */

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function nearestRim(S, x, z) {
  let best = null, bd = 1e9;
  for (const r of S.layout.rims) {
    const d = Math.hypot(r.x - x, r.z - z);
    if (d < bd) { bd = d; best = r; }
  }
  return { rim: best, d: bd };
}
const fwdOf = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
const rightOf = (yaw) => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });
function startShot(S) {
  if (!H.ball || H.shot) return;
  const m = game.move, p = m.pos;
  const { rim, d } = nearestRim(S, p.x, p.z);
  const to = { x: (rim.x - p.x) / d, z: (rim.z - p.z) / d };
  const vel = m.velocity, sp = Math.hypot(vel.x, vel.z);
  const toward = sp > 0.1 ? (vel.x * to.x + vel.z * to.z) / sp : 0;
  const f = fwdOf(game.look.yaw), facing = f.x * to.x + f.z * to.z;
  let kind = "jumper";
  if (m.sprinting && d > HOOPS.dunkR[0] && d < HOOPS.dunkR[1] && facing > 0.6 && toward > 0.5 && H.stamina > 0.15) kind = "dunk";
  else if (sp > 1.5 && d < HOOPS.layupR && toward > 0.3) kind = "layup";
  // the layup off the left side goes up with the left hand
  const r = rightOf(game.look.yaw), side = (rim.x - p.x) * r.x + (rim.z - p.z) * r.z;
  const mirror = kind === "layup" && side < -0.2;
  // the green: narrower far out, on the move, fading away, tired
  const away = sp > 0.6 && toward < -0.4;
  // a hand in the face: a defender close, between us and the rim
  let contest = 0;
  for (const df of hoopsHooks.defenders()) {
    const dx = df.x - p.x, dz = df.z - p.z, dd = Math.hypot(dx, dz);
    if (dd > 1.6 || dd < 0.01 || (dx * to.x + dz * to.z) / dd < 0.2) continue;
    contest = Math.max(contest, Math.min(1, (1.6 - dd) / 1.1 + (df.jump ? 0.35 : 0)));
  }
  const w = HOOPS.window * Math.max(0.45, Math.min(1.15, 1.25 - 0.07 * d)) * (sp > 1 ? 0.8 : 1) * (away ? 0.75 : 1) * (0.6 + 0.4 * H.stamina) * (1 - 0.55 * contest);
  H.shot = { kind, t: 0, rim, d, w, contest, released: kind !== "jumper", rel: null, launched: false, mirror, start: { x: p.x, y: p.y, z: p.z }, to, jumped: false, fade: away };
  H.move = null;
  setClip(kind === "jumper" ? "hoop-jumper" : kind === "layup" ? "hoop-layup" : "hoop-dunk", mirror);
  if (kind === "layup") m.impulse(to.x * Math.min(3.2, d * 1.3), 4.4, to.z * Math.min(3.2, d * 1.3), 0.55);
  if (kind === "dunk") H.stamina = Math.max(0, H.stamina - 0.15);
  H.lastShot = kind;
  fireHooks(hoopsHooks.onShot, H.shot);
}
/* Let go of fire: the jumper's release is now. */
function releaseShot(at) {
  const s = H.shot;
  if (!s || s.released) return;
  s.released = true;
  s.rel = Math.max(0.28, at ?? s.t);
}
/* How it came out of the hand: the miss in "windows" (+ late, - early). */
function grade(s) {
  const e = (s.rel - HOOPS.release) / s.w;
  const a = Math.abs(e);
  const word = a <= 0.35 ? "EXCELLENT" : a <= 1 ? "GOOD" : e < 0 ? (a < 2 ? "SLIGHTLY EARLY" : "VERY EARLY") : (a < 2 ? "SLIGHTLY LATE" : "VERY LATE");
  return { e, word, eff: a <= 0.35 ? 0 : a <= 1 ? e * 0.55 : e };
}
const _hand = new THREE.Vector3();
function handPos(rig, side, out = _hand) {
  const h = rig?.parts?.[side > 0 ? "handR" : "handL"];
  if (!h) return out.set(game.move.pos.x, game.move.pos.y + 2.2, game.move.pos.z);
  h.updateWorldMatrix(true, false);
  return out.setFromMatrixPosition(h.matrixWorld);
}
/* The ball leaves the hand: a solved arc at the rim, missed by the grade. */
function launchShot(S, s) {
  const b = balls.get(H.ball);
  if (!b) return;
  const rig = game.localRig;
  const W = courtWorld(S);
  const at = roomNow();
  const hp = handPos(rig, s.mirror ? -1 : 1);
  let L;
  if (s.kind === "dunk") {
    L = makeLaunch([s.rim.x, s.rim.y + 0.22, s.rim.z], [0, -5.5, 0], [0, 0, 0], at, myId());
  } else {
    const from = [hp.x, Math.max(hp.y, 1.8), hp.z];
    const dist = Math.hypot(s.rim.x - from[0], s.rim.z - from[2]);
    const apex = s.kind === "layup" ? 0.32 + 0.05 * dist : 0.6 + 0.14 * dist;
    const dx = (s.rim.x - from[0]) / dist, dz = (s.rim.z - from[2]) / dist;
    // backspin: the top of the ball turning back toward the shooter
    const spin = [dz * 18, 0, -dx * 18];
    L = solveShot(W, from, s.rim, apex, spin, at);
    const g = s.kind === "jumper" ? grade(s) : { e: 0, word: "", eff: (Math.random() - 0.5) * (s.fade ? 1.2 : 0.7) * (1 + 3 * (s.contest || 0)) };
    if (s.kind === "jumper") { H.feedback = { word: g.word, t: 0, e: g.e }; }
    if (g.eff) {
      const k = 1 + 0.011 * Math.max(-6, Math.min(6, g.eff));
      const yaw = 0.008 * Math.max(-6, Math.min(6, g.eff)) * (Math.random() < 0.5 ? -1 : 1);
      const c = Math.cos(yaw), si = Math.sin(yaw);
      const vx = L.v[0] * c - L.v[2] * si, vz = L.v[0] * si + L.v[2] * c;
      L = makeLaunch(L.p, [vx * k, L.v[1] * k, vz * k], L.w, at, myId());
    }
    L.by = myId();
  }
  b.sim = newBall(W, L);
  b.holder = null; b.keeper = myId(); b.shooter = myId(); b.dunk = s.kind === "dunk";
  b.pts = Math.hypot(s.start.x - s.rim.x, s.start.z - s.rim.z) >= HOOPS.arc ? 2 : 1;
  b.sentAt = b.launchedAt = performance.now();
  send({ e: "launch", id: b.id, L, pts: b.pts, dunk: b.dunk ? 1 : 0 });
  fireHooks(hoopsHooks.onLaunch, b);
  H.ball = null; H.live = false;
  s.launched = true;
}

/* The arcade dunk: carried up the lane to the rim, through, hang, drop. */
export const hoopsHolds = () => game.isSocial() && H.shot?.kind === "dunk" && H.shot.t < 0.8;
export function hoopsHold(dt) {
  const s = H.shot, m = game.move;
  const rim = s.rim;
  // the spot under the rim, on our side
  const back = 0.55;
  const tx = rim.x - s.to.x * back, tz = rim.z - s.to.z * back;
  const lift = Math.max(0, rim.y - 2.25);
  const u = Math.min(1, s.t / 0.32), e = u * u * (3 - 2 * u);
  if (s.t <= 0.32) {
    m.pos.x = s.start.x + (tx - s.start.x) * e;
    m.pos.z = s.start.z + (tz - s.start.z) * e;
    m.pos.y = s.start.y + lift * Math.sin(e * Math.PI / 2);
  } else {
    m.pos.x = tx; m.pos.z = tz;
    m.pos.y = s.start.y + lift - (s.t > 0.5 ? 0.12 * Math.min(1, (s.t - 0.5) / 0.3) : 0);
  }
  m.velocity.set(0, 0, 0);
  m.grounded = false;
  if (s.t + dt >= 0.8) { m.velocity.set(0, -1, 0); }
}

/* ------------------------------------------------------------ each frame */

let fireWas = false, jumpWas = false, passWas = false;
const _bp = new THREE.Vector3();
export function updateHoops(dt) {
  const S = spots();
  if (!S) {
    if (balls.size) for (const id of [...balls.keys()]) dropBall(id);
    H.ball = null; H.shot = null; H.move = null;
    if (game.net) game.net.hoopBall = null;
    meterHud(null);
    fireHooks(hoopsHooks.onFrame, dt, null);
    return;
  }
  const now = performance.now(), rnow = roomNow();
  const gp = game.gamepadState?.connected;
  const fire = !game.localPauseOnly && ((game.isTouch && touchState.firing) || (gp && game.gamepadState.firing) || game.mouseDown);
  const jump = (game.isTouch && touchState.jump) || (gp && game.gamepadState.jump) || game.keys.has("Space");
  const sizeHeld = !!H.ball && !H.shot && ((game.isTouch && touchState.ads) || (gp && game.gamepadState.ads) || game.adsHeld || game.keys.has("KeyQ"));
  if (!game.player.alive && H.ball) { const id = H.ball; dropBall(id); send({ e: "gone", id }); }
  H.stamina = Math.min(1, H.stamina + dt * (game.move.sprinting && H.ball ? -HOOPS.sprintCost : HOOPS.regen));

  // the ball goes back if we wander off with it
  if (H.ball) {
    const c = S.layout.court;
    if (Math.hypot(game.move.pos.x - c.x, game.move.pos.z - c.z) > HOOPS.carry + c.d / 2) {
      rackBall();
      showWaveBanner("The ball went back on the cart", 1600);
    }
  }

  // ---- our moves and shot
  const flick = readStick(dt, sizeHeld);
  if (H.ball && !H.shot) {
    const moving = game.move.moving;
    if (moving) H.live = true;
    if (H.move) {
      const mv = H.move, d = mv.def;
      mv.t += dt;
      // the burst: off the way the move goes (toward the new hand, or ahead)
      if (mv.t >= d.at[0] && mv.t <= d.at[1]) {
        const toHand = d.swap ? -mv.from : mv.from;
        const yaw = game.look.yaw, f = fwdOf(yaw), r = rightOf(yaw);
        const sx = d.burst[0] * toHand, sf = d.burst[1];
        const n = Math.hypot(sx, sf) || 1;
        const k = d.burst[2] * Math.sin(Math.PI * (mv.t - d.at[0]) / (d.at[1] - d.at[0]));
        _v.set((r.x * sx + f.x * sf) / n * k * dt, 0, (r.z * sx + f.z * sf) / n * k * dt);
        game.move.pos.add(_v);
        resolveCircle(game.colliders, game.move.pos, 0.35, game.move.pos.y, 2);
      }
      if (d.slow && mv.t < d.slow) { game.move.velocity.x *= 0.85; game.move.velocity.z *= 0.85; }
      if (d.swap && mv.t >= (d.bounce ?? d.dur * 0.5) && H.hand === mv.from) H.hand = -mv.from;
      if (mv.t >= d.dur) {
        H.move = null; H.lastMoveEnd = now / 1000;
        if (d.gather) H.live = false;
        if (H.queued) { const q = H.queued; H.queued = null; startMove(q); }
      }
    }
    if (flick && H.live) {
      const name = moveFor(flick, jump);
      if (!H.move) startMove(name);
      else if (H.move.t > H.move.def.dur * 0.6) H.queued = name;   // the combo
    }
    if (!H.move) setClip(!H.live ? "hoop-hold" : H.hand > 0 ? "hoop-dribble-r" : "hoop-dribble-l");
    if (fire && !fireWas && !H.move && hoopsHooks.canShoot()) startShot(S);
    const pass = game.keys.has("KeyE") || (gp && game.gamepadState.reload);
    if (pass && !passWas && !H.move && H.ball) passBall(S);
    passWas = pass;
  }
  // ---- without the ball: the stance, the poke, the block
  if (!H.ball && !H.shot && game.player.alive && onCourt(S)) defend(S, dt, fire && !fireWas, jump && !jumpWas, (game.isTouch && touchState.ads) || (gp && game.gamepadState.ads) || game.adsHeld || game.keys.has("KeyQ"));
  else if (H.act && !H.ball && !H.shot) H.act = null;
  if (H.beaten > 0) { H.beaten -= dt; game.move.velocity.x *= 0.6; game.move.velocity.z *= 0.6; }
  // the shot, rising
  if (H.shot) {
    const s = H.shot;
    s.t += dt;
    if (s.kind === "jumper") {
      if (!s.jumped && s.t >= 0.14) {
        s.jumped = true;
        const v = game.move.velocity;
        game.move.impulse(v.x * (s.fade ? 0.6 : 0.35), 4.0, v.z * (s.fade ? 0.6 : 0.35), 0.5);
      }
      if (!fire && fireWas) releaseShot();
      if (!s.released && H.autoRelease && s.t >= H.autoRelease) releaseShot(H.autoRelease);   // the tests let go at an exact time
      if (!s.released && s.t >= HOOPS.late) releaseShot();
      if (s.released && !s.launched && s.t >= s.rel) launchShot(S, s);
    } else if (!s.launched && s.t >= (s.kind === "dunk" ? 0.5 : 0.46)) launchShot(S, s);
    if (s.t >= clipLen(H.clip) + 0.1) {
      H.shot = null;
      if (!H.ball) setClip("hoop-hold");
    }
  }
  fireWas = fire; jumpWas = jump;

  // ---- every ball: its flight, who's got it, our grab
  for (const b of [...balls.values()]) {
    if (b.sim) {
      const evs = advanceBall(b.sim, rnow);
      if (evs.length) onEvents(b, evs);
      if (!b.sim) continue;   // a make handed it to someone (the game's check)
      if (b.hoopT != null && b.hoopT < 0.6) { b.hoopT += dt; swishNet(b.hoop, b.hoopT / 0.45); }
      if (b.mesh) {
        b.mesh.position.set(b.sim.p[0], b.sim.p[1], b.sim.p[2]);
        // it turns with its spin
        const w = b.sim.w, wl = Math.hypot(w[0], w[1], w[2]);
        if (wl > 0.01) { _w.set(w[0] / wl, w[1] / wl, w[2] / wl); b.mesh.rotateOnWorldAxis(_w, wl * dt); }
      }
      // the keeper repeats it for late joiners
      if (b.keeper === myId() && now - (b.sentAt || 0) > 2500) { b.sentAt = now; send({ e: "state", id: b.id, L: b.sim.launch, pts: b.pts }); }
      // ours to grab? (not the one we just let go of)
      if (!H.ball && !H.shot && game.player.alive && !seated) {
        const p = game.move.pos, bp = b.sim.p;
        const up = game.move.grounded ? HOOPS.grabUp : HOOPS.grabJump;
        const ours = b.shooter === myId() && now - (b.launchedAt || 0) < 900;
        // on its way down, or low: a shot going up is a block, not a catch
        const falling = b.sim.v[1] < 0.5 || bp[1] < 1.6;
        if (!ours && falling && Math.hypot(bp[0] - p.x, bp[2] - p.z) < HOOPS.grabR && bp[1] < p.y + up && bp[1] > p.y - 0.2) grabBall(b);
      }
    }
    if (b.holder && b.holder !== myId() && !isNpc(b.holder) && !game.net?.peers?.get(b.holder)) b.holder = null;
    // a ball nobody's kept for a while (its keeper left) goes
    if (b.keeper && b.keeper !== myId() && !b.holder && now - b.seen > 9000) dropBall(b.id);
  }

  // ---- the wire
  if (game.net) {
    game.net.hoopBall = H.ball;
    const i = CLIP_IDS.indexOf(H.clip);
    game.net.hoopMove = H.ball || H.shot || H.act ? (i + 1) * (H.mirror ? -1 : 1) : 0;
    game.net.hoopAt = H.clipAt;
  }
  if (H.feedback) H.feedback.t += dt;
  meterHud(H.shot?.kind === "jumper" ? H.shot : null);
  fireHooks(hoopsHooks.onFrame, dt, S);
}
function grabBall(b) {
  b.holder = myId(); b.sim = null; b.grab = { by: myId(), at: roomNow() };
  H.ball = b.id; H.live = false; H.hand = 1; H.move = null;
  setClip("hoop-grab");
  H.clipAt = roomNow();
  H.grabT = performance.now();
  send({ e: "grab", id: b.id, at: b.grab.at });
  fireHooks(hoopsHooks.onGrab, b, myId());
}

/* ------------------------------------------- passing, defence, the API */

const onCourt = (S) => {
  const c = S.layout.court, p = game.move.pos;
  return Math.abs(p.x - c.x) < c.w / 2 + 1 && Math.abs(p.z - c.z) < c.d / 2 + 1;
};
/* E: a chest pass to the mate we're looking nearest, flat and quick;
   anyone in the way can pick it off. */
function passBall() {
  const mates = hoopsHooks.mates();
  if (!mates.length) return;
  const p = game.move.pos, f = fwdOf(game.look.yaw);
  let best = null, bs = -2;
  for (const m of mates) {
    const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz) || 1;
    const a = (dx * f.x + dz * f.z) / d;
    if (a > bs) { bs = a; best = { ...m, d }; }
  }
  if (!best || bs < -0.2) return;
  const b = balls.get(H.ball);
  if (!b) return;
  const hp = handPos(game.localRig, 1);
  const from = [hp.x, Math.max(1.0, hp.y), hp.z];
  const speed = 9.5, t = Math.max(0.15, best.d / speed), dy = 1.25 - from[1];
  const v = [(best.x - from[0]) / t, (dy + 0.5 * 9.81 * t * t) / t, (best.z - from[2]) / t];
  setBallLaunch(b.id, makeLaunch(from, v, [0, 0, 0], roomNow(), myId()), { pass: true });
  H.act = { clip: "hoop-pass", t: 0, dur: 0.4 };
  setClip("hoop-pass");
}
/* Off the ball: the stance (size-up held), a poke at a handler in reach,
   a jump to block a shot that's just gone up. */
function defend(S, dt, poke, hop, stance) {
  const a = H.act;
  if (a) {
    a.t += dt;
    if (a.clip === "hoop-block" && a.t > 0.1 && a.t < 0.55) tryBlock(S);
    if (a.t >= a.dur) H.act = null;
  }
  if (!H.act && poke) {
    H.act = { clip: "hoop-steal", t: 0, dur: 0.4 };
    setClip("hoop-steal");
    trySteal(S);
  } else if (!H.act && hop) {
    H.act = { clip: "hoop-block", t: 0, dur: 0.7 };
    setClip("hoop-block");
  } else if (!H.act && stance) {
    H.act = { clip: "hoop-stance", t: 0, dur: 0.12, stance: true };
    if (H.clip !== "hoop-stance") setClip("hoop-stance");
  }
}
/* The poke: a ball in someone's hands, in reach and in front. Better odds
   at one standing holding it, worse mid-move. */
function trySteal(S) {
  const me = game.move.pos, f = fwdOf(game.look.yaw);
  for (const b of balls.values()) {
    if (!b.holder || b.holder === myId() || !b.mesh) continue;
    const bp = b.mesh.position, dx = bp.x - me.x, dz = bp.z - me.z, d = Math.hypot(dx, dz);
    if (d > 1.45 || (dx * f.x + dz * f.z) / (d || 1) < 0.25) continue;
    const peer = game.net?.peers?.get(b.holder);
    const name = peer ? CLIP_IDS[Math.abs(peer.hoopMove | 0) - 1] : null;
    const mid = !!name && /cross|behind|hesi|spin|stepback/.test(name);
    const odds = 0.3 * (mid ? 0.4 : 1) * (name === "hoop-hold" ? 1.3 : 1) * hoopsHooks.stealOdds(b);
    if (Math.random() < odds) {
      const L = makeLaunch([bp.x, Math.max(0.4, bp.y), bp.z], [-dx / d * 1.5, 2.2, -dz / d * 1.5], [0, 0, 0], roomNow(), myId());
      b.sim = newBall(courtWorld(S), L); b.holder = null; b.keeper = myId(); b.shooter = null; b.pts = 0; b.sentAt = performance.now();
      send({ e: "steal", id: b.id, L });
      fireHooks(hoopsHooks.onSteal, b, myId());
      showWaveBanner("STEAL", 900);
    } else H.beaten = 0.45;
    return;
  }
}
/* A shot in its first moments, at a hand: swatted away. */
const _h2 = new THREE.Vector3();
function tryBlock() {
  const rig = game.localRig;
  const hr = handPos(rig, 1, _hand).clone(), hl = handPos(rig, -1, _h2);
  const now = roomNow();
  for (const b of balls.values()) {
    if (!b.sim || b.sim.rest || b.blocked || b.shooter === myId() || b.pass) continue;
    if (now - b.sim.launch.at > 450) continue;
    const bp = b.sim.p;
    _w.set(bp[0], bp[1], bp[2]);
    if (Math.min(hr.distanceTo(_w), hl.distanceTo(_w)) > 0.45) continue;
    const me = game.move.pos, dx = bp[0] - me.x, dz = bp[2] - me.z, n = Math.hypot(dx, dz) || 1;
    const v = b.sim.v;
    const L = makeLaunch([bp[0], bp[1], bp[2]], [-v[0] * 0.3 + dx / n * 2.6, -1.4, -v[2] * 0.3 + dz / n * 2.6], [0, 0, 0], roomNow(), myId());
    setBallLaunch(b.id, L, { block: true });
    showWaveBanner("BLOCKED", 900);
    return;
  }
}
/* For the game (and its NPCs): put a ball in flight from here (a shot, a
   pass, a block, a tip), as its keeper. */
export function setBallLaunch(id, L, meta = {}) {
  const S = spots();
  if (!S) return null;
  const b = ballFor(id);
  b.sim = newBall(courtWorld(S), L);
  b.holder = null; b.keeper = myId(); b.shooter = meta.by || L.by || myId();
  b.pts = meta.pts || 0; b.dunk = !!meta.dunk; b.pass = !!meta.pass; b.blocked = !!meta.block;
  b.sentAt = b.launchedAt = performance.now();
  if (H.ball === id) { H.ball = null; H.move = null; }
  send({ e: "launch", id, L, pts: b.pts, dunk: b.dunk ? 1 : 0, pass: b.pass ? 1 : 0, block: b.blocked ? 1 : 0, by: meta.by });
  fireHooks(hoopsHooks.onLaunch, b);
  return b;
}
/* A ball into our hands (a check, the game's first possession). */
export function giveBall(id) {
  const b = ballFor(id);
  b.holder = myId(); b.sim = null; b.keeper = myId(); b.grab = { by: myId(), at: roomNow() };
  H.ball = id; H.live = false; H.hand = 1; H.move = null; H.shot = null; H.act = null;
  setClip("hoop-hold");
  send({ e: "grab", id, at: b.grab.at });
}
/* An NPC we drive picks a ball up (or is handed it). */
export function npcTakes(id, npc) {
  const b = ballFor(id);
  b.holder = npc; b.sim = null; b.keeper = myId(); b.grab = { by: npc, at: roomNow() };
  if (H.ball === id) { H.ball = null; H.move = null; H.shot = null; }
  send({ e: "grab", id, at: b.grab.at, by: npc });
  fireHooks(hoopsHooks.onGrab, b, npc);
}
/* An NPC we drive pokes it loose. */
export function npcSteals(id, npc, L) {
  const b = balls.get(id);
  const S = spots();
  if (!b || !S) return;
  b.sim = newBall(courtWorld(S), L); b.holder = null; b.keeper = myId(); b.shooter = null; b.pts = 0; b.sentAt = performance.now();
  if (H.ball === id) { H.ball = null; H.move = null; H.shot = null; showWaveBanner("STRIPPED", 1000); }
  send({ e: "steal", id, L, by: npc });
  fireHooks(hoopsHooks.onSteal, b, npc);
}
export { poseHoop, ballInHands, ballFor, dropBall, handPos, clipLen, courtWorld, MOVES, spots as hoopSpots };

/* ------------------------------------------------------------- the wire */

rpListeners.push((p, m) => {
  if (m.k !== "hb" || typeof m.id !== "string") return;
  const id = m.id.slice(0, 48);
  if (m.e === "gone") { dropBall(id); return; }
  const b = ballFor(id);
  b.seen = performance.now();
  if (m.e === "launch" || m.e === "state") {
    const L = m.L;
    if (!L || !Array.isArray(L.p) || !Array.isArray(L.v) || !Array.isArray(L.w)) return;
    // a repeat of the flight we already have changes nothing
    if (m.e === "state" && b.sim && b.sim.launch.at === L.at) return;
    if (m.e === "state" && b.holder) return;
    const S = spots();
    if (!S) return;
    b.sim = newBall(courtWorld(S), makeLaunch(L.p.map(Number), L.v.map(Number), L.w.map(Number), +L.at || roomNow(), String(L.by || p.id)));
    b.holder = null; b.keeper = p.id; b.shooter = String(m.by || L.by || p.id); b.pts = m.pts | 0; b.dunk = !!m.dunk; b.pass = !!m.pass;
    b.blocked = m.e === "launch" && !!m.block;
    if (H.ball === id) { H.ball = null; H.move = null; }
    fireHooks(hoopsHooks.onLaunch, b);
    if (m.block && b.shooter !== myId()) showWaveBanner("BLOCKED", 900);
  } else if (m.e === "steal") {
    const L = m.L;
    if (!L || !Array.isArray(L.p) || !Array.isArray(L.v)) return;
    const S = spots();
    if (!S) return;
    const by = isNpc(m.by) ? m.by : p.id;
    if (H.ball === id) { H.ball = null; H.move = null; H.shot = null; showWaveBanner("STRIPPED", 1000); }
    b.sim = newBall(courtWorld(S), makeLaunch(L.p.map(Number), L.v.map(Number), [0, 0, 0], +L.at || roomNow(), by));
    b.holder = null; b.keeper = p.id; b.shooter = null; b.pts = 0;
    fireHooks(hoopsHooks.onSteal, b, by);
  } else if (m.e === "grab") {
    const at = +m.at || roomNow();
    const by = isNpc(m.by) ? m.by : p.id;
    // two grabs at once: the lower id keeps it
    if (b.grab && b.grab.by !== by && Math.abs(b.grab.at - at) < 400 && b.grab.by < by) return;
    b.grab = { by, at };
    b.holder = by; b.sim = null; b.keeper = p.id;
    if (H.ball === id) { H.ball = null; H.shot = null; H.move = null; }
    fireHooks(hoopsHooks.onGrab, b, by);
  }
});

/* ------------------------------------------------------------- posing */

/* Where the ball sits in a body playing `name` at t: under the dribbling
   hand on its bounce, between both hands held, in the shooting hand. */
const _a = new THREE.Vector3(), _b2 = new THREE.Vector3();
function ballInHands(rig, name, t, mirror, hand, out) {
  const right = handPos(rig, mirror ? -1 : 1, _a).clone();
  const left = handPos(rig, mirror ? 1 : -1, _b2);
  const g = rig.root.position.y + 0.12;
  if (name === "hoop-dribble-r" || name === "hoop-dribble-l") {
    const h = name === "hoop-dribble-r" ? right : left;
    const len = clipLen(name);
    const u = ((t % len) + len) % len / len;
    const top = h.y - 0.16, hit = 0.3;
    const y = u < hit ? top - (top - g) * Math.pow(u / hit, 1.6) : g + (top - g) * (1 - Math.pow(1 - (u - hit) / (1 - hit), 2));
    return out.set(h.x, y, h.z);
  }
  const mv = Object.values(MOVES).find((d) => d.clip === name);
  if (mv && mv.bounce && name !== "hoop-hesi") {
    // from the start hand down to the floor between the feet, up to the other
    const tb = mv.bounce, T = clipLen(name);
    const mid = _w.set((right.x + left.x) / 2, g, (right.z + left.z) / 2);
    if (t < tb) { const u = t / tb; return out.copy(right).lerp(mid, u).setY(right.y - 0.16 + (g - right.y + 0.16) * u * u); }
    const u = Math.min(1, (t - tb) / (T - tb));
    return out.copy(mid).lerp(left, u).setY(g + (left.y - 0.16 - g) * (1 - (1 - u) * (1 - u)));
  }
  if (name === "hoop-hesi") {
    const h = hand > 0 ? right : left;
    const u = (t % 0.5) / 0.5, top = h.y - 0.16;
    return out.set(h.x, u < 0.4 ? top - (top - g) * (u / 0.4) ** 1.6 : g + (top - g) * (1 - (1 - (u - 0.4) / 0.6) ** 2), h.z);
  }
  if (name === "hoop-jumper" || name === "hoop-layup") return out.copy(right).add(_w.set(0, 0.1, 0));
  if (name === "hoop-spin") return t < 0.3 ? out.copy(right).add(_w.set(0, -0.1, 0)) : out.copy(left).add(_w.set(0, -0.1, 0));
  // both hands: the gather, the hold, the grab, the dunk
  return out.copy(right).add(left).multiplyScalar(0.5).add(_w.set(0, 0.04, 0));
}

localPosers.push((rig) => {
  if (!game.isSocial() || (!H.ball && !H.shot && !H.act)) return;
  const t = (roomNow() - H.clipAt) / 1000 * (H.clip.startsWith("hoop-dribble") && game.move.sprinting ? HOOPS.dribble / HOOPS.sprintDribble : 1);
  const full = FULL_BODY.has(H.clip) || !game.move.moving;
  if (!poseHoop(rig, H.clip, t, H.mirror, full)) return;
  rig.root.updateMatrixWorld(true);
  rig.body?.update?.();
  const b = H.ball && balls.get(H.ball);
  if (b?.mesh) {
    ballInHands(rig, H.clip, t, H.mirror, H.hand, _bp);
    b.mesh.position.copy(_bp);
    // a dribble's bounce, heard
    const hit = H.clip.startsWith("hoop-dribble") && ((t / clipLen(H.clip)) % 1) >= 0.3;
    if (hit && !H.bounced) courtSound("bounce", _bp, 0.6);
    H.bounced = hit;
  }
});
const peerLast = new WeakMap();
peerPosers.push((rp, dt) => {
  if (!game.isSocial() || !spots()) return;
  const p = rp.peer;
  if (!p) return;
  const hm = p.hoopMove | 0;
  if (p.hoopBall) {
    const b = ballFor(p.hoopBall);
    if (!b.grab || b.grab.by === p.id || performance.now() - b.seen > 500) { b.holder = p.id; b.sim = null; b.keeper = p.id; }
    b.seen = performance.now();
  }
  if (!hm) return;
  const name = CLIP_IDS[Math.abs(hm) - 1];
  if (!name) return;
  const t = (roomNow() - (+p.hoopAt || 0)) / 1000;
  // moving: how far they went since the last frame
  const q = rp.pos, was = peerLast.get(rp);
  const moving = !!was && dt > 0 && Math.hypot(q.x - was.x, q.z - was.z) / dt > 0.5;
  peerLast.set(rp, { x: q.x, z: q.z });
  if (!poseHoop(rp.rig, name, t, hm < 0, FULL_BODY.has(name) || !moving)) return;
  rp.rig.root.updateMatrixWorld(true);
  rp.rig.body?.update?.();
  const b = p.hoopBall && balls.get(p.hoopBall);
  if (b?.mesh && b.holder === p.id) {
    ballInHands(rp.rig, name, t, hm < 0, name === "hoop-dribble-l" ? -1 : 1, _bp);
    b.mesh.position.copy(_bp);
  }
});

/* ------------------------------------------------------------ the meter */

let meterEl = null;
/* The 2K meter: a bar beside you that fills as you rise, the green band
   its window; the word after the release. */
function meterHud(s) {
  const fb = H.feedback && H.feedback.t < 1.3 ? H.feedback : null;
  if (!s && !fb) { if (meterEl) meterEl.hidden = true; return; }
  if (!meterEl) {
    meterEl = document.createElement("div");
    meterEl.className = "to-hoop-meter";
    meterEl.innerHTML = '<div class="to-hoop-meter__bar"><i class="to-hoop-meter__green"></i><i class="to-hoop-meter__fill"></i></div><b class="to-hoop-meter__word"></b>';
    document.body.appendChild(meterEl);
  }
  meterEl.hidden = false;
  const fill = meterEl.querySelector(".to-hoop-meter__fill"), green = meterEl.querySelector(".to-hoop-meter__green"), word = meterEl.querySelector(".to-hoop-meter__word");
  if (s) {
    const T = HOOPS.meterFull, at = s.released ? s.rel : s.t;
    fill.style.height = `${Math.min(100, (at / T) * 100)}%`;
    green.style.bottom = `${((HOOPS.release - s.w) / T) * 100}%`;
    green.style.height = `${((2 * s.w) / T) * 100}%`;
    meterEl.classList.toggle("is-done", s.released);
  }
  word.textContent = fb ? fb.word : "";
  meterEl.dataset.grade = fb ? (Math.abs(fb.e) <= 0.35 ? "x" : Math.abs(fb.e) <= 1 ? "g" : "b") : "";
}

rpExtras.push(hoopsAction);

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollHoops = {
    HOOPS, MOVES, H, balls, takeBall, rackBall, startMove, startShot: () => spots() && hoopsHooks.canShoot() && startShot(spots()), releaseShot, grade, CLIP_IDS,
    clips: () => Object.keys(CLIPS),
    state: () => ({ ball: H.ball, hand: H.hand, live: H.live, clip: H.clip, mirror: H.mirror, move: H.move?.name || null, shot: H.shot ? { kind: H.shot.kind, t: +H.shot.t.toFixed(2), w: +H.shot.w.toFixed(3), launched: H.shot.launched } : null,
      lastMove: H.lastMove || null, lastShot: H.lastShot || null, stamina: +H.stamina.toFixed(2), feedback: H.feedback?.word || null, last: H.last, balls: [...balls.values()].map((b) => ({ id: b.id, holder: b.holder, flying: !!b.sim && !b.sim.rest, rest: !!b.sim?.rest, p: b.sim ? b.sim.p.map((v) => +v.toFixed(2)) : null, events: b.sim ? b.sim.events.map((e) => e.kind) : [] })) }),
  };
}
