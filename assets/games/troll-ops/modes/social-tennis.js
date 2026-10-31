// Troll Forces — tennis at Troll Beach (5d phase 4, docs/GRIN-BEACH-COURTS.md),
// in Socialize. Real strokes, real spin, real scoring: a tiebreak to 7.
//
// - Hold X at the hopper for a racket (again to put it back). Fire with
//   nothing coming tosses a practice ball: fire again near the top of the
//   toss to serve it.
// - Hold X at the umpire's chair: play the club pro (Deuce Dominguez, then
//   Ace Alvarez), or the next player who holds X there in 4 s. Singles, a
//   tiebreak to 7 by 2; the first server serves one, then two each, from
//   the deuce court on an even count. The host calls it.
// - Serving: fire tosses, fire again at the top hits. Aim with the look
//   (wide, body, the T); flat by default, Q/right mouse for a slice that
//   curves away, jump for a kick that jumps up. Out of the box is a fault,
//   two a double; one that clips the tape and lands in is a let.
// - Rallying (the Top Spin way): press early, the swing lands when the ball
//   gets there. Forehand or backhand by which side it comes, a volley
//   before the bounce near the net, a smash over your head. Fire = flat,
//   W + fire = topspin (dips, kicks up), Q + fire = slice (floats, skids
//   low), jump + fire = lob, Q + jump = a drop shot. Where you look at
//   contact is where it goes; the timing decides the rest: on time (the
//   green flash) it goes where you aim; late it goes wide and short, early
//   it pulls.
// - The ball is the court ball (court-ball.js tennisWorld): the same flight,
//   cord, bounce and line call on every screen; a little chalk puffs where
//   it lands near a line.
//
// The wire: the state packet's `tr` (the racket's clip + 1, 0 = no racket)
// and `ta` (its start, room ms); rp { k: "tb" } hit { id, L, by, serve,
// toss } (each stroke a launch), and { k: "tg" } the match (s, join, n).

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4";
import { bar, rpExtras, rpListeners, seated } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5";
import { peerPosers } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4";
import { localPosers } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5";
import { loadClip, sampleClip, applyClip, CLIP_SPINE, CLIP_ARM_L, CLIP_ARM_R } from "../characters/clips.js?v=rc1";
import { loadModel } from "../maps/battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1-hgb6";
import { drawBoard } from "../maps/grinbeach-courts.js?v=gb5-tb2-kbb2-kbs1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-hgb2-ugb1-ug1-ugm1-hgb5-hgb6-hgb8";
import { touchState } from "../input/touch.js?v=in1-th2-bp1-bf1-pd1-nf1-fs1";
import { roomNow } from "./room-clock.js?v=rc1-cd1-sh1";
import { tennisWorld, newBall, stepBall, advanceBall, makeLaunch, solveDrive, predict, HZ } from "./court-ball.js?v=gb5-gb8";
import { courtSound } from "../sound/court-sfx.js?v=gb6";

export const TN = {
  hopper: 2.2, chair: 2.6, wait: 4,
  reach: 1.75,                        // m from the body a ball can be struck
  lead: [0.26, 0.6],                  // s before contact a press is on time
  pace: { flat: 27, top: 24, slice: 17, drop: 9, lob: 19, volley: 15, smash: 29 },
  spin: { flat: 60, top: 240, slice: -150, drop: -120, lob: 80, volley: -40, smash: 40 },   // rad/s of topspin (- is backspin)
  serve: { flat: 33, slice: 28, kick: 25, tossV: 5.4, contact: 0.12 },
  to: 7, by: 2, grace: 320,           // ms a call waits for a late hit
  singles: 4.115, service: 6.4,
  ladderKey: "tf-tennis-ladder",
};
export const TN_CLIPS = ["tn-ready", "tn-fh", "tn-bh", "tn-fh-slice", "tn-bh-slice", "tn-volley", "tn-smash", "tn-serve", "tn-lob"];
const CONTACT = { "tn-fh": 0.34, "tn-bh": 0.34, "tn-fh-slice": 0.32, "tn-bh-slice": 0.32, "tn-volley": 0.16, "tn-smash": 0.42, "tn-serve": 0.74, "tn-lob": 0.34 };
const UPPER = [...CLIP_SPINE, ...CLIP_ARM_L, ...CLIP_ARM_R, "headPivot"];

const myId = () => game.net?.id || "me";
const isNpc = (id) => typeof id === "string" && /^npc\d+$/.test(id);
const npcIndex = (id) => +id.slice(3);
const spots = () => (game.isSocial() ? game.builtMap?.map?.rp?.courts?.() || null : null);
const sendB = (m) => game.net?.publishRp?.({ k: "tb", ...m });
const sendG = (m) => game.net?.publishRp?.({ k: "tg", ...m });
let world = null, worldFor = null;
const courtWorld = (S) => { if (worldFor !== S) { worldFor = S; world = tennisWorld(S.layout.tennis); } return world; };

/* Us: the racket, what the body plays, a swing on its way, our toss. */
export const T = { racket: false, clip: "tn-ready", clipAt: 0, swing: null, toss: null, seq: 0, flash: null, last: null };
/* Every tennis ball: id -> { id, mesh, sim, hitter, serve, toss, side } */
export const tballs = new Map();
/* The match we play or watch (the host's copy rules). */
export const M = { s: null, sentAt: 0, seqSeen: -1, pending: [], npcSent: 0, calm: false, calls: [] };
const brains = new Map(), shown = new Map();

/* ----------------------------------------------------------- the court */

const L = (S) => S.layout.tennis;
const sideOf = (S, z) => (z > L(S).z ? 0 : 1);            // 0: the near (+z) half, 1: the far
const toNet = (side) => (side === 0 ? -1 : 1);             // which way +z the net is from a side
function inSingles(S, x, z, side, r = 0.034) {
  const C = L(S);
  return Math.abs(x - C.x) <= TN.singles + r && (side === 0 ? z >= C.z && z <= C.z + C.dl + r : z <= C.z && z >= C.z - C.dl - r);
}
/* The service box a serve from `side` on the deuce (even) or ad court must
   land in: the receiver's half, cross court. */
function inBox(S, x, z, side, deuce, r = 0.034) {
  const C = L(S);
  const recv = 1 - side;
  const dz = recv === 0 ? z - C.z : C.z - z;
  if (dz < -r || dz > TN.service + r) return false;
  // the server's right is -x on the far side, +x on the near; deuce goes cross
  const toRight = side === 0 ? 1 : -1;
  const want = deuce ? -toRight : toRight;   // the box's side of the centre line, as a sign of x
  const dx = (x - C.x) * want;
  return dx >= -r && dx <= TN.singles + r;
}
const lineNear = (S, x, z) => {
  const C = L(S);
  const xs = [C.x - TN.singles, C.x + TN.singles, C.x], zs = [C.z - C.dl, C.z + C.dl, C.z - TN.service, C.z + TN.service];
  return xs.some((v) => Math.abs(x - v) < 0.12) || zs.some((v) => Math.abs(z - v) < 0.12);
};

/* ------------------------------------------------------------ the clips */

const CLIPS = {};
for (const n of TN_CLIPS) loadClip(n).then((c) => { CLIPS[n] = c; }, (e) => console.warn(e.message));
const _samp = {};
function poseTennis(rig, name, t, full) {
  const clip = CLIPS[name];
  if (!clip || !rig?.parts) return false;
  const s = sampleClip(clip, t, _samp);
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
const setClip = (name, at = roomNow()) => { T.clip = name; T.clipAt = at; };

/* ------------------------------------------------- rackets, balls, chalk */

let racketScene = null, ballScene = null;
loadModel("gb-racket").then((m) => { racketScene = m; }, (e) => console.warn("gb-racket", e?.message || e));
loadModel("gb-tennisball").then((m) => { ballScene = m; }, (e) => console.warn("gb-tennisball", e?.message || e));
const rackets = new WeakMap();   // rig -> racket mesh
/* The racket in a rig's right hand: the grip in the palm, the head out
   past the knuckles. */
function holdRacket(rig, on) {
  let r = rackets.get(rig);
  const hand = rig?.parts?.handR;
  if (!on) { if (r?.parent) r.parent.remove(r); return; }
  if (!hand || !racketScene) return;
  if (!r) {
    r = racketScene.clone(true);
    r.name = "racket";
    r.rotation.set(-2.2, 0, 0);
    r.position.set(0, -0.04, 0);
    r.scale.setScalar(1 / Math.max(0.2, hand.getWorldScale?.(_tv).y || 1));
    rackets.set(rig, r);
  }
  if (r.parent !== hand) hand.add(r);
}
const _tv = new THREE.Vector3();
function ballFor(id) {
  let b = tballs.get(id);
  if (!b) { b = { id, mesh: null, sim: null, hitter: null, serve: false, toss: false, seen: performance.now() }; tballs.set(id, b); }
  if (!b.mesh && ballScene) { b.mesh = ballScene.clone(true); b.mesh.name = "tennisball"; }
  if (b.mesh && !b.mesh.parent) game.scene.add(b.mesh);
  return b;
}
function dropTBall(id) {
  const b = tballs.get(id);
  b?.mesh?.parent?.remove(b.mesh);
  tballs.delete(id);
}
const puffs = [];
let puffMat = null;
function chalk(x, z) {
  puffMat ??= new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), puffMat.clone());
  m.position.set(x, 0.1, z);
  game.scene.add(m);
  puffs.push({ m, t: 0 });
}
function stepPuffs(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    p.t += dt;
    p.m.scale.setScalar(1 + p.t * 6);
    p.m.material.opacity = Math.max(0, 0.8 - p.t * 2);
    if (p.t > 0.4) { p.m.parent?.remove(p.m); p.m.geometry.dispose(); puffs.splice(i, 1); }
  }
}

/* -------------------------------------------------------- the strike */

const fwdOf = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
const rightOf = (yaw) => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });
/* Where a ball will be at room time `at` (a copy of its flight run on). */
function ballAt(b, at) {
  const c = newBall(b.sim.world, b.sim.launch);
  const n = Math.floor((at - b.sim.launch.at) / 1000 * HZ);
  for (let i = 0; i < n && !c.rest; i++) stepBall(c);
  return c;
}
/* The best place to strike a ball coming at someone at (x, z) on `side`:
   after its bounce on that side (or before it, near the net: a volley;
   over the head: a smash), in reach, in the next 1.4 s. */
export function strikePoint(S, b, x, z, side, reach = TN.reach) {
  if (!b?.sim || b.sim.rest) return null;
  const c = newBall(b.sim.world, b.sim.launch);
  const n0 = b.sim.n;
  for (let i = 0; i < n0 && !c.rest; i++) stepBall(c);
  const now0 = b.sim.launch.at + n0 / HZ * 1000;
  const nearNet = Math.abs(z - L(S).z) < 6.5;
  let bounced = 0, best = null;
  for (let i = 1; i < HZ * 1.4 && !c.rest; i++) {
    const before = c.events.length;
    stepBall(c);
    for (let k = before; k < c.events.length; k++) if (c.events[k].kind === "bounce" && sideOf(S, c.events[k].p[2]) === side) bounced++;
    if (i % 3) continue;
    if (bounced > 1) break;
    const [px, py, pz] = c.p;
    if (sideOf(S, pz) !== side) continue;
    const ok = bounced === 1 ? py > 0.22 && py < 2.7 : nearNet || py > 2.0 ? py > 0.4 && py < 2.9 : false;
    if (!ok) continue;
    const d = Math.hypot(px - x, pz - z);
    if (d > reach) continue;
    const cost = d + Math.abs(py - 1.0) * 0.4 + i / HZ * 0.3;
    if (!best || cost < best.cost) best = { cost, x: px, y: py, z: pz, at: now0 + i / HZ * 1000, volley: bounced === 0, smash: py > 2.05, d };
  }
  return best;
}
/* Fire with a ball coming: plan the stroke so it lands at the contact. */
function planStroke(S, b, kind) {
  const me = game.move.pos, side = sideOf(S, me.z);
  const sp = strikePoint(S, b, me.x, me.z, side);
  const now = roomNow();
  const r = rightOf(game.look.yaw);
  if (!sp) { swingAt(null, "tn-fh", now + 300, 0, kind); return; }
  const lead = (sp.at - now) / 1000;
  const fore = (sp.x - me.x) * r.x + (sp.z - me.z) * r.z >= -0.1;
  const clip = sp.smash ? "tn-smash" : sp.volley ? "tn-volley" : kind === "lob" ? "tn-lob" : kind === "slice" || kind === "drop" ? (fore ? "tn-fh-slice" : "tn-bh-slice") : fore ? "tn-fh" : "tn-bh";
  swingAt(b, clip, sp.at, lead, sp.smash ? "smash" : sp.volley ? "volley" : kind, sp, fore);
}
function swingAt(b, clip, at, lead, kind, sp = null, fore = true) {
  T.swing = { ball: b?.id || null, launchAt: b?.sim?.launch.at ?? null, clip, at, lead, kind, sp, fore, done: false };
  setClip(clip, at - (CONTACT[clip] ?? 0.34) * 1000);
}
/* The contact: where the look is, how on time, the stroke's pace and spin. */
function strike(S, sw) {
  const b = tballs.get(sw.ball);
  if (!b?.sim || b.sim.launch.at !== sw.launchAt) return;   // it was hit again (or is gone)
  const c = ballAt(b, sw.at);
  const p = c.p.slice();
  const me = game.move.pos;
  if (Math.hypot(p[0] - me.x, p[2] - me.z) > TN.reach + 0.4 || p[1] < 0.1) return;   // ran off from it
  const side = sideOf(S, me.z), C = L(S);
  // timing: on time inside the lead window; late goes wide and short, early pulls
  const [l0, l1] = TN.lead;
  const err = sw.lead < l0 ? (l0 - sw.lead) / 0.2 : sw.lead > l1 ? -(sw.lead - l1) / 0.4 : 0;
  const e = Math.max(-1.6, Math.min(1.6, err));
  T.flash = { word: Math.abs(e) < 0.01 ? "SWEET" : e > 0 ? (e > 0.8 ? "LATE" : "A BIT LATE") : (e < -0.8 ? "EARLY" : "A BIT EARLY"), t: 0, good: Math.abs(e) < 0.01 };
  const target = aimFor(S, side, sw.kind, game.look.yaw, me.x);
  // the miss: turned off the aim (late: away from the hitting side), short
  const turn = e * 0.17 * (sw.fore ? 1 : -1) * (side === 0 ? 1 : -1);
  rotateAbout(target, p, turn);
  const pace = TN.pace[sw.kind] * (1 - 0.12 * Math.abs(e)) * (0.92 + 0.08 * Math.min(1, Math.max(0, (sw.lead - 0.2) / 0.4)));
  // topspin turns the ball's top toward the net: about x, signed by the way it goes
  const Lh = solveDrive(courtWorld(S), p, target, pace, spinFor(sw.kind, toNet(side)), roomNow(), sw.kind === "lob");
  hit(b.id, makeLaunch(Lh.p, Lh.v, Lh.w, roomNow(), myId()), {});
  courtSound("tennis", { x: p[0], y: p[1], z: p[2] }, sw.kind === "smash" ? 1 : 0.8);
}
const spinFor = (kind, n) => [n * TN.spin[kind], 0, 0];
/* Where a stroke goes: along the look (at least a little toward the net),
   out to the depth the stroke wants, inside the singles lines. */
function aimFor(S, side, kind, yaw, fromX, fromZ = game.move.pos.z) {
  const C = L(S), n = toNet(side), f = fwdOf(yaw);
  const depth = kind === "drop" ? 2.6 : kind === "slice" ? C.dl - 3.6 : kind === "lob" ? C.dl - 1.4 : kind === "volley" ? C.dl - 3 : C.dl - 2.2;
  const tz = C.z + n * depth;
  const fz = Math.max(0.25, f.z * n);
  const tx = fromX + (f.x / fz) * Math.abs(tz - fromZ);
  return [Math.max(C.x - TN.singles + 0.45, Math.min(C.x + TN.singles - 0.45, tx)), 0, tz];
}
function rotateAbout(t, p, a) {
  const dx = t[0] - p[0], dz = t[2] - p[2], c = Math.cos(a), s = Math.sin(a);
  t[0] = p[0] + dx * c - dz * s;
  t[2] = p[2] + dx * s + dz * c;
}
/* A stroke leaves the strings: everyone gets the launch. */
function hit(id, Lh, meta) {
  const S = spots();
  if (!S) return;
  const b = ballFor(id);
  b.sim = newBall(courtWorld(S), Lh);
  b.hitter = Lh.by || myId(); b.serve = !!meta.serve; b.toss = !!meta.toss; b.side = sideOf(S, Lh.p[2]); b.deuce = meta.deuce; b.sentAt = performance.now();
  sendB({ e: "hit", id, L: Lh, by: meta.by, serve: meta.serve ? 1 : 0, toss: meta.toss ? 1 : 0, deuce: meta.deuce ? 1 : 0 });
  onHit(b);
}

/* ------------------------------------------------------------- serving */

/* The toss: the ball up out of the left hand, straight. */
function toss(S, id, by = myId(), rig = game.localRig, yaw = game.look.yaw, pos = game.move.pos) {
  const r = rightOf(yaw), f = fwdOf(yaw);
  const p = [pos.x - r.x * 0.12 + f.x * 0.35, (pos.y || 0) + 1.55, pos.z - r.z * 0.12 + f.z * 0.35];
  const Lt = makeLaunch(p, [0, TN.serve.tossV, 0], [0, 0, 0], roomNow(), by);
  hit(id, Lt, { toss: true, by: by === myId() ? undefined : by });
  return id;
}
/* The serve's strike: off the toss at contact, into the box (flat, slice
   curving away, kick), missed by how far off the top of the toss it was. */
function serveStrike(S, b, at, kind, by, deuce, yaw, skillErr = 0, force = null) {
  const c = ballAt(b, at);
  const p = c.p.slice();
  const side = sideOf(S, p[2]), C = L(S), n = toNet(side);
  const apex = b.sim.launch.p[1] + TN.serve.tossV ** 2 / (2 * 9.81);
  const e = force != null ? force : Math.max(-2, Math.min(2, (apex - 0.15 - p[1]) / 0.45 + skillErr));
  // the box: cross court, aim along the look
  const toRight = side === 0 ? 1 : -1, sx = deuce ? -toRight : toRight;
  const f = fwdOf(yaw);
  const tz = C.z + n * (TN.service - 0.55);
  const tx0 = p[0] + f.x / Math.max(0.2, Math.abs(f.z)) * Math.abs(tz - p[2]);
  let tx = Math.max(C.x + Math.min(0, sx) * (TN.singles - 0.35) + (sx > 0 ? 0.3 : 0), Math.min(C.x + Math.max(0, sx) * (TN.singles - 0.35) - (sx < 0 ? 0.3 : 0), tx0));
  const target = [tx, 0, tz + n * 0.6 * Math.abs(e) * (Math.random() < 0.5 ? -1 : 1)];
  rotateAbout(target, p, e * 0.05 * (Math.random() < 0.5 ? -1 : 1));
  const pace = TN.serve[kind] * (1 - 0.12 * Math.abs(e));
  // the kick: heavy topspin; the slice: sidespin that swings it right to left (a right-hander's)
  const w = kind === "kick" ? [n * 260, 0, 0] : kind === "slice" ? [0, 90, 0] : [n * 50, 0, 0];
  // a real server takes pace off until it clears the net
  let Ls;
  for (let k = 0; k < 5; k++) {
    Ls = solveDrive(courtWorld(S), p, target, pace * (1 - 0.08 * k), w, roomNow(), false);
    const fl = predict(newBall(courtWorld(S), Ls), 1.6, (c) => c.events.length > 0).ball;
    if (fl.events[0]?.kind !== "net") break;
  }
  hit(b.id, makeLaunch(Ls.p, Ls.v, Ls.w, roomNow(), by), { serve: true, deuce, by: by === myId() ? undefined : by });
  courtSound("tennis", { x: p[0], y: p[1], z: p[2] }, 1);
  return e;
}

/* ------------------------------------------------------------ each frame */

let fireWas = false;
export const tennisView = () => game.isSocial() && T.racket;
export function updateTennis(dt) {
  const S = spots();
  if (!S) {
    for (const id of [...tballs.keys()]) dropTBall(id);
    if (T.racket) { T.racket = false; holdRacket(game.localRig, false); }
    if (game.net) { game.net.tennisClip = 0; }
    cardHud(null);
    return;
  }
  const now = roomNow();
  const gp = game.gamepadState?.connected;
  const fire = !game.localPauseOnly && ((game.isTouch && touchState.firing) || (gp && game.gamepadState.firing) || game.mouseDown);
  const jump = (game.isTouch && touchState.jump) || (gp && game.gamepadState.jump) || game.keys.has("Space");
  const q = (game.isTouch && touchState.ads) || (gp && game.gamepadState.ads) || game.adsHeld || game.keys.has("KeyQ");
  const w = game.keys.has("KeyW") || (gp && game.gamepadState.moveY > 0.6) || (game.isTouch && touchState.moveY > 0.6);
  const s = M.s;
  const inMatch = s && s.players.includes(myId()) && s.phase !== "done";

  // ---- our racket
  if (T.racket && game.player.alive) {
    const press = fire && !fireWas;
    if (press && !T.swing) {
      const myServe = inMatch && s.phase === "serve" && s.server === myId();
      if (T.toss && tballs.get(T.toss)?.sim && !tballs.get(T.toss).sim.rest) {
        // the strike, off our own toss
        const at = now + TN.serve.contact * 1000;
        T.swing = { serve: true, ball: T.toss, at, kind: jump ? "kick" : q ? "slice" : "flat", done: false, deuce: myServe ? s.deuce : true };
        setClip("tn-serve", at - CONTACT["tn-serve"] * 1000);
      } else if (myServe || !inMatch) {
        const incoming = [...tballs.values()].find((b) => b.sim && !b.sim.rest && !b.toss && b.hitter !== myId() && strikePoint(S, b, game.move.pos.x, game.move.pos.z, sideOf(S, game.move.pos.z), TN.reach + 1));
        if (incoming && !myServe) planStroke(S, incoming, q && jump ? "drop" : q ? "slice" : jump ? "lob" : w ? "top" : "flat");
        else if (!inMatch || myServe) {
          T.toss = toss(S, inMatch ? `${s.id}-p${s.point}-${s.serveNo}` : `${myId()}-tp${++T.seq}`);
          setClip("tn-serve", now - 320);   // the clip's toss is now
        }
      } else {
        const incoming = [...tballs.values()].find((b) => b.sim && !b.sim.rest && !b.toss && b.hitter !== myId());
        if (incoming) planStroke(S, incoming, q && jump ? "drop" : q ? "slice" : jump ? "lob" : w ? "top" : "flat");
        else swingAt(null, "tn-fh", now + 300, 0, "flat");
      }
    }
    if (T.swing && !T.swing.done && now >= T.swing.at) {
      T.swing.done = true;
      const b = tballs.get(T.swing.ball);
      if (T.swing.serve && b?.sim) {
        const e = serveStrike(S, b, T.swing.at, T.swing.kind, myId(), T.swing.deuce, game.look.yaw);
        T.flash = { word: Math.abs(e) < 0.35 ? "SWEET" : e > 0 ? "LOW TOSS HIT" : "REACHING", t: 0, good: Math.abs(e) < 0.35 };
        T.toss = null;
      } else if (T.swing.ball) strike(S, T.swing);
    }
    if (T.swing && now > T.swing.at + 450) { T.swing = null; setClip("tn-ready"); }
  }
  fireWas = fire;

  // ---- the balls
  for (const b of [...tballs.values()]) {
    if (!b.sim) continue;
    const evs = advanceBall(b.sim, now);
    for (const e of evs) {
      if (e.kind === "bounce") { courtSound("bounce", { x: e.p[0], y: e.p[1], z: e.p[2] }, e.speed / 14); if (lineNear(S, e.p[0], e.p[2])) chalk(e.p[0], e.p[2]); }
      else if (e.kind === "net" || e.kind === "cord") courtSound("net", { x: e.p[0], y: e.p[1], z: e.p[2] }, 0.8);
      judgeEvent(S, b, e);
    }
    if (b.mesh) b.mesh.position.set(b.sim.p[0], b.sim.p[1], b.sim.p[2]);
    // practice balls tidy themselves away
    if (b.sim.rest && !b.match && performance.now() - b.sentAt > 4000) dropTBall(b.id);
  }
  stepPuffs(dt);

  // ---- the match
  if (s?.host === myId()) hostFrame(S, s, dt);
  if (s) playerFrame(S, s);

  // ---- the wire
  if (game.net) {
    game.net.tennisClip = T.racket ? TN_CLIPS.indexOf(T.clip) + 1 : 0;
    game.net.tennisAt = T.clipAt;
  }
  if (T.flash) T.flash.t += dt;
  flashHud();
  cardHud(M.s && M.s.phase !== "wait" ? M.s : null);
}

/* ------------------------------------------------------------- posing */

localPosers.push((rig) => {
  holdRacket(rig, game.isSocial() && T.racket);
  if (!game.isSocial() || !T.racket) return;
  const t = (roomNow() - T.clipAt) / 1000;
  const name = T.swing || T.clip !== "tn-ready" ? T.clip : "tn-ready";
  const full = !game.move.moving || name !== "tn-ready";
  if (!poseTennis(rig, name, name === "tn-ready" ? t : Math.max(0, t), full)) return;
  rig.root.updateMatrixWorld(true);
  rig.body?.update?.();
});
peerPosers.push((rp) => {
  if (!game.isSocial() || !spots()) return;
  const p = rp.peer;
  const on = !!(p?.tennisClip > 0);
  holdRacket(rp.rig, on);
  if (!on) return;
  const name = TN_CLIPS[(p.tennisClip | 0) - 1] || "tn-ready";
  if (!poseTennis(rp.rig, name, (roomNow() - (+p.tennisAt || 0)) / 1000, name !== "tn-ready")) return;
  rp.rig.root.updateMatrixWorld(true);
  rp.rig.body?.update?.();
});

/* ----------------------------------------------------------- the match */

function chairNear(S) {
  const C = L(S);
  return Math.hypot(C.x + C.dw + 1.6 - game.move.pos.x, C.z - game.move.pos.z) < TN.chair;
}
function hopperNear(S) {
  const h = S.tennis.rack;
  return Math.hypot(h.x - game.move.pos.x, h.z - game.move.pos.z) < TN.hopper;
}
function pros() {
  return (game.townNpcs?.list || []).map((n, i) => ({ id: `npc${i}`, i, name: n.c.name, tennis: n.c.tennis })).filter((r) => r.tennis).sort((a, b) => a.tennis.skill - b.tennis.skill);
}
function ladder() { try { return Math.max(0, +localStorage.getItem(TN.ladderKey) || 0); } catch { return 0; } }
function setLadder(v) { try { localStorage.setItem(TN.ladderKey, String(v)); } catch { /* storage off */ } }
const clean = (n) => String(n || "").replace(/[^\p{L}\p{N} _.'-]/gu, "").trim().slice(0, 16);
const nameOf = (id) => clean(isNpc(id) ? game.townNpcs?.list?.[npcIndex(id)]?.c.name : id === myId() ? game.net?.name || "You" : game.net?.peers?.get(id)?.name || "Player") || "Player";
const skillOf = (id) => game.townNpcs?.list?.[npcIndex(id)]?.c.tennis?.skill ?? 0.6;

function tennisAction() {
  const S = spots();
  if (!S || !game.player.alive || seated) return null;
  if (hopperNear(S)) {
    if (T.racket && performance.now() - (T.takenAt || 0) < 1500) return null;   // the same held X does not put it straight back
    if (T.racket) return { key: "tn:put", label: "Put the racket back", ctx: "Racket", time: 0.4, done: () => { T.racket = false; } };
    if (bar.role) return { key: "tn:busy", info: true, label: "One job at a time" };
    return { key: "tn:take", label: "Take a racket", busy: "Picking one…", ctx: "Racket", time: 0.4, done: () => { T.racket = true; T.takenAt = performance.now(); setClip("tn-ready"); if (!T.taught) { T.taught = true; showWaveBanner(game.isTouch ? "Fire to toss, fire again at the top to serve · press early on a ball coming: the swing lands on it" : "Fire tosses, fire again at the top serves · W+fire topspin, Q+fire slice, Space+fire lob · press early: the swing lands on the ball", 4200); } } };
  }
  if (!chairNear(S)) return null;
  const s = M.s;
  if (s && s.phase === "wait" && s.host !== myId() && !s.players.includes(myId())) return { key: "tn:join", label: `Play ${nameOf(s.host)}`, ctx: "Play", time: 0.4, done: () => { T.racket = true; sendG({ e: "join", g: s.id }); } };
  if (s && s.phase !== "done") return { key: "tn:on", info: true, label: s.players.includes(myId()) ? "You're on court" : "Match on: next" };
  const r = pros();
  const opp = r[Math.min(ladder(), r.length - 1)];
  return { key: "tn:play", label: opp ? `Play ${opp.name}: a tiebreak to 7` : "Play a tiebreak to 7", ctx: "Play", time: 0.6, done: () => startMatch(S) };
}
function startMatch(S) {
  T.racket = true;
  const id = `${myId()}-t${++T.seq}`;
  M.s = { id, host: myId(), players: [myId(), null], names: {}, score: [0, 0], first: 0, server: null, point: 0, serveNo: 1, deuce: true, phase: "wait",
    waitUntil: roomNow() + TN.wait * 1000, seq: 0, winner: -1, rung: null };
  publishG(true);
  showWaveBanner("Anyone at the chair in the next 4 s plays you", 2400);
}
function publishG(force = false) {
  const s = M.s;
  if (!s || s.host !== myId()) return;
  const now = performance.now();
  if (!force && now - M.sentAt < 2000) return;
  M.sentAt = now;
  sendG({ e: "s", g: s });
  drawMatch(s);
}
/* The next point: who serves (one, then two each), from which court. */
function nextPoint(S, s) {
  const k = s.point;
  const turn = k === 0 ? 0 : Math.floor((k + 1) / 2) % 2;
  s.server = s.players[(s.first + turn) % 2];
  s.deuce = k % 2 === 0;
  s.serveNo = 1;
  s.phase = "serve"; s.seq++;
  s.servedAt = roomNow();
  M.pending.length = 0;
  for (const id of s.players) if (isNpc(id)) placeNpc(S, s, id);
  // the last point's balls go
  for (const id of [...tballs.keys()]) if (id.startsWith(s.id) && !id.startsWith(`${s.id}-p${s.point}-`)) dropTBall(id);
  publishG(true);
}
/* Where each stands for a serve: the server behind the baseline either
   side of the centre mark, the receiver cross court. */
function servePlaces(S, s) {
  const C = L(S);
  const out = {};
  for (let i = 0; i < 2; i++) {
    const id = s.players[i];
    const side = i;   // players[0] on the near half
    const n = toNet(side), base = C.z - n * (C.dl + 0.4);
    const toRight = side === 0 ? 1 : -1;
    const serving = id === s.server;
    // the server: right of the mark on deuce; the receiver: the other diagonal
    const sx = serving ? (s.deuce ? toRight : -toRight) * 1.2 : (s.deuce ? toRight : -toRight) * 3.0;
    out[id] = { x: C.x + sx, z: serving ? base : base - n * 0.6, yaw: side === 0 ? 0 : Math.PI };
  }
  return out;
}
function hostFrame(S, s, dt) {
  const now = roomNow();
  if (s.phase === "wait") {
    if (now < s.waitUntil) return publishG();
    if (!s.players[1]) {
      const r = pros().filter((x) => !game.townNpcs.list[x.i].off);
      const opp = r[Math.min(ladder(), r.length - 1)];
      if (!opp) { M.s = null; showWaveBanner("Nobody to play", 1500); return; }
      s.players[1] = opp.id; s.rung = ladder();
    }
    for (const id of s.players) { s.names[id] = nameOf(id); if (isNpc(id)) takeNpc(id); }
    s.first = Math.random() < 0.5 ? 0 : 1;
    showWaveBanner(`${s.names[s.players[0]]} vs ${s.names[s.players[1]]}: a tiebreak to 7`, 2400);
    nextPoint(S, s);
    return;
  }
  if (s.phase === "over") { if (now >= s.overAt) endMatch(s); return publishG(); }
  // the calls waiting out their grace
  for (let i = M.pending.length - 1; i >= 0; i--) {
    const c = M.pending[i];
    if (now - c.at >= TN.grace) { M.pending.splice(i, 1); award(S, s, c.to, c.call); }
  }
  for (const id of s.players) if (isNpc(id)) npcThink(S, s, id, dt);
  streamNpcs(s);
  publishG();
}
function endMatch(s) {
  s.phase = "done";
  for (const id of s.players) if (isNpc(id)) releaseNpc(id);
  publishG(true);
  M.s = null;
}
/* A point to `to` (0 near, 1 far), called. */
function award(S, s, to, call) {
  if (s.phase === "over" || s.phase === "done") return;
  s.score[to]++;
  M.calls.push(`${s.point}:${to}:${call}`); if (M.calls.length > 20) M.calls.shift();
  const a = s.score[to], b = s.score[1 - to];
  showWaveBanner(`${call}  ${s.score[0]}-${s.score[1]}`, 1400);
  if (a >= TN.to && a - b >= TN.by) {
    s.phase = "over"; s.winner = to; s.overAt = roomNow() + 6000;
    if (s.players[to] === myId() && isNpc(s.players[1 - to]) && s.rung != null) setLadder(Math.max(ladder(), s.rung + 1));
    publishG(true);
    return;
  }
  if ((a >= TN.to - 1 && a > b) || (b >= TN.to - 1 && b > a)) setTimeout(() => showWaveBanner("Set point", 900), 1500);
  s.point++;
  setTimeout(() => { if (M.s === s && s.phase !== "over") nextPoint(S, s); }, 1600);
  s.phase = "point";
  publishG(true);
}

/* The judge (the host): every flight's events against the lines. */
function onHit(b) {
  const s = M.s, S = spots();
  if (!s || !S) return;
  if (b.id.startsWith(s.id)) b.match = true;
  // a hit cancels the calls that hadn't happened yet when it was struck
  const at = b.sim.launch.at;
  M.pending = M.pending.filter((c) => c.at < at);
  b.bounces = 0; b.firstSide = null; b.let = false;
  if (b.toss) b.dead = false;   // a fresh toss (a let is served again under the same id)
  if (s.host === myId() && s.phase === "serve" && b.serve && b.match) { s.phase = "rally"; s.lastServe = b.id; publishG(true); }
}
function judgeEvent(S, b, e) {
  const s = M.s;
  if (!s || s.host !== myId() || !b.match || b.toss || b.dead || (s.phase !== "rally" && s.phase !== "serve")) return;
  if (!b.id.startsWith(`${s.id}-p${s.point}-`)) return;   // a ball from a point that is over
  const at = b.sim.launch.at + e.n / HZ * 1000;
  const hitterSide = s.players.indexOf(b.hitter) >= 0 ? s.players.indexOf(b.hitter) : sideOf(S, b.sim.launch.p[2]);
  const recv = 1 - hitterSide;
  const pend = (to, call) => { if (!M.pending.some((c) => c.ball === b.id && c.launch === b.sim.launch.at)) M.pending.push({ to, call, at, ball: b.id, launch: b.sim.launch.at }); };
  if (b.serve) {
    if (e.kind === "cord") b.let = true;
    if (e.kind === "net" || ((e.kind === "dead" || e.kind === "fence" || e.kind === "chair") && !b.bounces)) return fault(S, s, "FAULT", b);
    if (e.kind === "bounce" && !b.bounces) {
      b.bounces = 1;
      if (!inBox(S, e.p[0], e.p[2], hitterSide, s.deuce)) return fault(S, s, "FAULT", b);
      if (b.let) { b.dead = true; showWaveBanner("LET", 900); s.phase = "serve"; s.seq++; publishG(true); return; }
      b.serve = false; b.firstSide = recv;   // in: it's a rally now
      return;
    }
    return;
  }
  if (e.kind === "net" && !b.bounces) { pend(recv, "NET"); return; }
  if ((e.kind === "dead" || e.kind === "fence" || e.kind === "chair") && !b.bounces) { pend(recv, "OUT"); return; }
  if (e.kind !== "bounce") return;
  b.bounces++;
  const side = sideOf(S, e.p[2]);
  if (b.bounces === 1) {
    if (side === hitterSide) { pend(recv, "NET"); return; }
    if (!inSingles(S, e.p[0], e.p[2], side)) { pend(recv, "OUT"); return; }
    b.firstSide = side;
    return;
  }
  if (b.bounces === 2 && b.firstSide === recv) pend(hitterSide, b.hitter === s.server && b.id === s.lastServe ? "ACE" : "WINNER");
}
function fault(S, s, call, b) {
  b.dead = true;   // a fault is played no further
  M.calls.push(`${s.point}:fault${s.serveNo}:${b.id}`);
  if (s.serveNo === 1) { s.serveNo = 2; s.phase = "serve"; s.seq++; showWaveBanner(call, 900); publishG(true); return; }
  const server = s.players.indexOf(s.server);
  award(S, s, 1 - server, "DOUBLE FAULT");
}

/* A player in the match, each point: stand in place (the host too). */
function playerFrame(S, s) {
  if (!s.players.includes(myId()) || s.phase !== "serve" || M.seqSeen === s.seq) return;
  M.seqSeen = s.seq;
  const P = servePlaces(S, s)[myId()];
  if (P) { game.move.reset(P.x, P.z, 0.06); game.look.yaw = P.yaw; game.look.pitch = 0; }
  T.racket = true; T.toss = null; T.swing = null; setClip("tn-ready");
  if (s.server === myId()) showWaveBanner(`${s.serveNo === 2 ? "Second serve" : "Your serve"}: fire to toss, fire at the top`, 1500);
}

/* ------------------------------------------------------------ the NPCs */

function brain(id) {
  let b = brains.get(id);
  if (!b) { const n = game.townNpcs.list[npcIndex(id)]; b = { id, x: n.x, z: n.z, yaw: n.yaw, clip: "tn-ready", clipAt: roomNow(), moving: false, plan: null, wait: 0, serveT: 0 }; brains.set(id, b); }
  return b;
}
function takeNpc(id) {
  const N = game.townNpcs, i = npcIndex(id);
  if (!N?.list?.[i] || N.list[i].override) return;
  N.takeOver(i, (n, rig, dt) => poseNpc(id, n, rig, dt));
}
function releaseNpc(id) {
  const n = game.townNpcs?.list?.[npcIndex(id)];
  if (n?.rig) holdRacket(n.rig, false);
  brains.delete(id); shown.delete(id);
  game.townNpcs?.release?.(npcIndex(id));
}
function placeNpc(S, s, id) {
  const P = servePlaces(S, s)[id], b = brain(id);
  if (!P) return;
  b.x = P.x; b.z = P.z; b.yaw = P.yaw; b.plan = null; b.serveT = 0; b.moving = false;
  b.clip = "tn-ready"; b.clipAt = roomNow();
}
function poseNpc(id, n, rig, dt) {
  const b = brains.get(id) || shown.get(id);
  if (!b) return;
  if (!brains.has(id)) {
    const k = Math.min(1, dt * 12);
    b.sx = (b.sx ?? b.x) + (b.x - (b.sx ?? b.x)) * k; b.sz = (b.sz ?? b.z) + (b.z - (b.sz ?? b.z)) * k;
    n.x = b.sx; n.z = b.sz;
  } else { n.x = b.x; n.z = b.z; }
  n.yaw = b.yaw; n.moving = !!b.moving;
  holdRacket(rig, true);
  if (poseTennis(rig, b.clip, (roomNow() - b.clipAt) / 1000, b.clip !== "tn-ready" || !b.moving)) { rig.root.updateMatrixWorld(true); rig.body?.update?.(); }
}
function streamNpcs(s) {
  const now = performance.now();
  if (now - M.npcSent < 100) return;
  M.npcSent = now;
  const n = [];
  for (const id of s.players) {
    if (!isNpc(id)) continue;
    const b = brains.get(id);
    if (b) n.push([npcIndex(id), +b.x.toFixed(2), +b.z.toFixed(2), +b.yaw.toFixed(2), TN_CLIPS.indexOf(b.clip) + 1, b.clipAt, b.moving ? 1 : 0]);
  }
  if (n.length) sendG({ e: "n", g: s.id, n });
}
/* The club pro's point: serve when it's his, get to where the ball will
   be, hit it away from you (into the net or long now and then, less the
   better he is), back to the middle. */
function npcThink(S, s, id, dt) {
  const b = brain(id), C = L(S);
  const side = s.players.indexOf(id), skill = skillOf(id);
  const opp = s.players[1 - side];
  const op = opp === myId() ? game.move.pos : isNpc(opp) ? brains.get(opp) : game.remotes?.byId?.get(opp)?.pos;
  const now = roomNow();
  if (s.phase === "serve" && s.server === id) {
    b.serveT += dt;
    if (b.serveT > 1.4 && !b.tossId) {
      b.tossId = toss(S, `${s.id}-p${s.point}-${s.serveNo}`, id, null, b.yaw, { x: b.x, y: 0, z: b.z });
      b.clip = "tn-serve"; b.clipAt = now - 320;
      b.hitAt = now + (TN.serve.tossV / 9.81) * 1000 * 0.92;
    }
    if (b.tossId && now >= b.hitAt) {
      const ball = tballs.get(b.tossId);
      const kind = Math.random() < 0.5 ? "flat" : Math.random() < 0.5 ? "slice" : "kick";
      const aimYaw = b.yaw + (Math.random() - 0.5) * 0.25;
      if (ball?.sim) serveStrike(S, ball, now, s.serveNo === 2 ? "kick" : kind, id, s.deuce, aimYaw, (Math.random() - 0.5) * (1.2 - skill) * (s.serveNo === 2 ? 0.6 : 1.4));
      b.tossId = null; b.serveT = -99;
    }
    return;
  }
  if (s.phase === "serve") { b.serveT = 0; b.tossId = null; b.moving = false; return; }
  // the ball coming his way: a plan to meet it
  const ball = [...tballs.values()].find((x) => x.id.startsWith(`${s.id}-p${s.point}-`) && !x.dead && x.sim && !x.sim.rest && !x.toss && x.hitter !== id);
  if (ball && (!b.plan || b.plan.launch !== ball.sim.launch.at)) {
    // where can he get to in time? try spots along its path near him
    let best = null;
    const c = newBall(ball.sim.world, ball.sim.launch);
    for (let i = 0; i < ball.sim.n; i++) stepBall(c);
    let bounced = 0;
    for (let i = 1; i < HZ * 1.6 && !c.rest; i++) {
      const k0 = c.events.length;
      stepBall(c);
      for (let k = k0; k < c.events.length; k++) if (c.events[k].kind === "bounce" && sideOf(S, c.events[k].p[2]) === side) bounced++;
      if (bounced > 1) break;
      if (i % 4 || sideOf(S, c.p[2]) !== side || bounced !== 1 || c.p[1] < 0.35 || c.p[1] > 1.6) continue;
      const tt = i / HZ, d = Math.hypot(c.p[0] - b.x, c.p[2] - b.z);
      const speed = 5.2 + 2.2 * skill;
      if (d - TN.reach * 0.8 <= speed * tt) { best = { x: c.p[0], z: c.p[2], y: c.p[1], at: now + tt * 1000 }; break; }
    }
    b.plan = { launch: ball.sim.launch.at, ball: ball.id, spot: best, hit: false };
  }
  const plan = b.plan;
  if (plan?.spot && !plan.hit) {
    // stand a racket's length off the ball, on the forehand side
    const r = rightOf(b.yaw);
    const gx = plan.spot.x - r.x * 0.75, gz = plan.spot.z - r.z * 0.75;
    walkTo(b, gx, gz, 5.2 + 2.2 * skill, dt);
    b.yaw = side === 0 ? 0 : Math.PI;
    if (now >= plan.spot.at - 340 && b.clip !== "tn-fh" && b.clip !== "tn-bh") { b.clip = Math.random() < 0.7 ? "tn-fh" : "tn-bh"; b.clipAt = plan.spot.at - 340; }
    if (now >= plan.spot.at) {
      plan.hit = true;
      const tb = tballs.get(plan.ball);
      if (tb?.sim && tb.sim.launch.at === plan.launch) {
        const c = ballAt(tb, now);
        const p = c.p.slice();
        if (Math.hypot(p[0] - b.x, p[2] - b.z) < TN.reach + 0.5 && p[1] > 0.15) {
          // away from the opponent, deep; the misses
          const n = toNet(side);
          const ox = op ? op.x : C.x;
          const tx = C.x + (ox > C.x ? -1 : 1) * (TN.singles - 1.2) * (0.4 + 0.6 * skill) + (Math.random() - 0.5) * (1 - skill) * 3;
          const tz = C.z + n * (C.dl - 2.2 + (Math.random() - 0.5) * (1 - skill) * 3);
          const err = !M.calm && Math.random() < (1 - skill) * 0.22 ? (Math.random() < 0.5 ? "long" : "net") : null;   // calm: the tests' pro makes no errors
          const target = [tx, 0, err === "long" ? C.z + n * (C.dl + 1.4) : tz];
          const kind = op && Math.abs(op.z - C.z) < 5 && Math.random() < 0.45 ? "lob" : Math.random() < 0.25 ? "slice" : "top";
          let Lh = solveDrive(courtWorld(S), p, target, TN.pace[kind] * (0.85 + 0.15 * skill) * (err === "net" ? 0.7 : 1), spinFor(kind, n), now, kind === "lob");
          if (err === "net") Lh = makeLaunch(Lh.p, [Lh.v[0], Lh.v[1] * 0.3 - 1.5, Lh.v[2]], Lh.w, Lh.at);
          hit(tb.id, makeLaunch(Lh.p, Lh.v, Lh.w, now, id), { by: id });
          courtSound("tennis", { x: p[0], y: p[1], z: p[2] }, 0.8);
        }
      }
    }
    return;
  }
  // back to the middle of the baseline
  walkTo(b, C.x, C.z - toNet(side) * (C.dl + 0.6), 4, dt);
  if (b.clip !== "tn-ready" && now - b.clipAt > 900) { b.clip = "tn-ready"; b.clipAt = now; }
}
function walkTo(b, x, z, speed, dt) {
  const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz);
  if (d < 0.1) { b.moving = false; return; }
  const k = Math.min(d, speed * dt);
  b.x += dx / d * k; b.z += dz / d * k;
  b.moving = true;
}

/* ------------------------------------------------------------- the wire */

rpListeners.push((p, m) => {
  if (m.k === "tb" && m.e === "hit" && typeof m.id === "string") {
    const S = spots();
    const Lh = m.L;
    if (!S || !Lh || !Array.isArray(Lh.p) || !Array.isArray(Lh.v) || !Array.isArray(Lh.w)) return;
    const b = ballFor(m.id.slice(0, 48));
    b.sim = newBall(courtWorld(S), makeLaunch(Lh.p.map(Number), Lh.v.map(Number), Lh.w.map(Number), +Lh.at || roomNow(), String(m.by || Lh.by || p.id)));
    b.hitter = isNpc(m.by) ? m.by : p.id; b.serve = !!m.serve; b.toss = !!m.toss; b.deuce = !!m.deuce; b.sentAt = performance.now();
    onHit(b);
    if (!m.toss) courtSound("tennis", { x: Lh.p[0], y: Lh.p[1], z: Lh.p[2] }, 0.8);
    return;
  }
  if (m.k !== "tg") return;
  if (m.e === "s" && m.g && typeof m.g.id === "string" && Array.isArray(m.g.players)) {
    if (M.s && M.s.host === myId() && M.s.id !== m.g.id && M.s.phase !== "done") return;
    const was = M.s;
    M.s = m.g;
    for (const id of m.g.players) if (isNpc(id) && !shown.has(id) && !brains.has(id)) { shown.set(id, { x: 0, z: 0, yaw: 0, clip: "tn-ready", clipAt: roomNow() }); takeNpc(id); }
    if (m.g.phase === "done") { for (const id of [...shown.keys()]) releaseNpc(id); M.s = null; }
    if (m.g.phase === "over" && was?.phase !== "over") showWaveBanner(`${m.g.names[m.g.players[m.g.winner]] || "?"} wins ${m.g.score[m.g.winner]}-${m.g.score[1 - m.g.winner]}`, 3000);
    drawMatch(m.g);
  } else if (m.e === "join" && M.s && M.s.host === myId() && M.s.id === m.g && M.s.phase === "wait" && !M.s.players[1]) {
    M.s.players[1] = p.id; M.s.names[p.id] = nameOf(p.id); publishG(true); showWaveBanner(`${nameOf(p.id)} is in`, 1200);
  } else if (m.e === "n" && M.s && m.g === M.s.id && Array.isArray(m.n)) {
    for (const r of m.n) {
      const id = `npc${r[0] | 0}`;
      const b = shown.get(id) || {};
      Object.assign(b, { x: +r[1], z: +r[2], yaw: +r[3], clip: TN_CLIPS[(r[4] | 0) - 1] || "tn-ready", clipAt: +r[5] || roomNow(), moving: !!r[6] });
      shown.set(id, b);
      if (!game.townNpcs?.list?.[r[0] | 0]?.override) takeNpc(id);
    }
  }
});

/* ---------------------------------------------------- the board, the HUD */

function drawMatch(s) {
  if (!s) return drawBoard("tennis", "TENNIS", [], "Tiebreak to 7");
  const nm = (i) => s.names?.[s.players[i]] || nameOf(s.players[i]);
  const srv = (i) => (s.server === s.players[i] && s.phase !== "over" ? " *" : "");
  const foot = s.phase === "wait" ? "Hold X at the chair to play" : s.phase === "over" || s.phase === "done" ? `${nm(s.winner)} wins` : s.serveNo === 2 ? "Second serve" : "Tiebreak to 7";
  drawBoard("tennis", "TENNIS", [[nm(0) + srv(0), s.score[0]], [nm(1) + srv(1), s.score[1]]], foot);
}
let cardEl = null, flashEl = null;
function cardHud(s) {
  const mine = s && s.phase !== "done";
  if (!mine) { if (cardEl) cardEl.hidden = true; return; }
  if (!cardEl) { cardEl = document.createElement("div"); cardEl.className = "to-hoop-card"; document.body.appendChild(cardEl); }
  cardEl.hidden = false;
  const nm = (i) => esc(s.names?.[s.players[i]] || nameOf(s.players[i]));
  const sv = (i) => (s.server === s.players[i] && s.phase !== "over" ? " is-poss" : "");
  const txt = `<span class="to-hoop-card__team${sv(0)}">${nm(0)}</span><b>${s.score[0]}</b><i>${s.phase === "over" ? "FINAL" : "TIEBREAK"}</i><b>${s.score[1]}</b><span class="to-hoop-card__team${sv(1)}">${nm(1)}</span>`;
  if (cardEl._t !== txt) { cardEl._t = txt; cardEl.innerHTML = txt; }
}
function flashHud() {
  const f = T.flash && T.flash.t < 0.9 ? T.flash : null;
  if (!f) { if (flashEl) flashEl.hidden = true; return; }
  if (!flashEl) { flashEl = document.createElement("div"); flashEl.className = "to-hoop-meter"; flashEl.innerHTML = '<b class="to-hoop-meter__word"></b>'; document.body.appendChild(flashEl); }
  flashEl.hidden = false;
  flashEl.dataset.grade = f.good ? "x" : "b";
  flashEl.querySelector("b").textContent = f.word;
}
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

rpExtras.push(tennisAction);

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollTennis = {
    TN, T, M, tballs, brains, shown, strikePoint, pros, ladder, setLadder, startMatch: () => spots() && startMatch(spots()),
    award: (to, call) => M.s && award(spots(), M.s, to, call),
    // the presses, at exact times (headless frames are too coarse to time a key)
    tossNow: () => { const S = spots(), s = M.s, inM = s && s.players.includes(myId()); T.toss = toss(S, inM ? `${s.id}-p${s.point}-${s.serveNo}` : `${myId()}-tp${++T.seq}`); setClip("tn-serve", roomNow() - 320); return T.toss; },
    hitServe: (kind = "flat", force = null) => { const S = spots(), b = tballs.get(T.toss), s = M.s; if (!b?.sim) return null; const e = serveStrike(S, b, roomNow(), kind, myId(), s && s.players.includes(myId()) ? s.deuce : true, game.look.yaw, 0, force); T.toss = null; return e; },
    serveTo: (x, z) => { const S = spots(), s = M.s, b = tballs.get(T.toss); if (!b?.sim) return; const c = ballAt(b, roomNow()); hit(b.id, solveDrive(courtWorld(S), c.p.slice(), [x, 0, z], 26, [0, 0, 0], roomNow()), { serve: true, deuce: s?.deuce }); T.toss = null; },
    swing: (kind = "top") => { const S = spots(); const b = [...tballs.values()].find((x) => x.sim && !x.sim.rest && !x.toss && x.hitter !== myId()); if (b) planStroke(S, b, kind); return T.swing && { at: T.swing.at, lead: T.swing.lead, clip: T.swing.clip }; },
    incoming: () => { const S = spots(); const b = [...tballs.values()].find((x) => x.sim && !x.sim.rest && !x.toss && x.hitter !== myId()); const sp = b && strikePoint(S, b, game.move.pos.x, game.move.pos.z, sideOf(S, game.move.pos.z)); return sp ? { in: (sp.at - roomNow()) / 1000, x: sp.x, z: sp.z, y: sp.y } : null; },
    state: () => ({ racket: T.racket, clip: T.clip, swing: T.swing && { clip: T.swing.clip, kind: T.swing.kind, lead: +(T.swing.lead || 0).toFixed(2), done: T.swing.done }, flash: T.flash?.word || null,
      s: M.s && { id: M.s.id, players: M.s.players, score: M.s.score, server: M.s.server, phase: M.s.phase, serveNo: M.s.serveNo, deuce: M.s.deuce, point: M.s.point, winner: M.s.winner },
      balls: [...tballs.values()].map((b) => ({ id: b.id, hitter: b.hitter, serve: b.serve, toss: b.toss, rest: !!b.sim?.rest, p: b.sim ? b.sim.p.map((v) => +v.toFixed(2)) : null, events: b.sim ? b.sim.events.map((e) => e.kind) : [] })),
      npcs: [...brains.entries()].map(([id, b]) => ({ id, x: +b.x.toFixed(2), z: +b.z.toFixed(2), clip: b.clip, plan: !!b.plan?.spot })) }),
  };
}
