/* Socialize: arm wrestling (the tf-parallel plan, phase 4; user, 2026-10-08:
   "mash + timing, bragging only").

   A map lists its arm tables as `rp.arm()`: { x, z, top, seats: [a, b] }
   (two of its rp.seats, facing each other across the table): the saloon's
   two-seater in Troll City, a high-top in Trolling Loud's bar.

   - Hold X by a free table: sit down and wait. Hold X again and the nearest
     townsfolk extra walks over and sits opposite; or another player sits
     in the other chair ("Arm wrestle <you>").
   - 3, 2, 1, then the bout (15 s at most): every fire tap pushes, a tap
     while the sweeping marker is in the green counts double and more,
     mashing past 12 a second counts for nothing. A townsperson pushes at
     his own rate, surges now and then and tires late on. Pin him (or get
     pinned); at the bell the side ahead wins.
   - Winner stays: the loser gets up (a townsperson goes back to what he was
     doing). A tally per opponent for the day, in this browser.

   Whoever drives the bout (the one who called the townsperson; between two
   players, the lower id) runs the meter and tells the room ("aw" messages,
   10 a second); the other player sends their pushes. Everyone else's copy
   of the bodies leans into it. Jump or crouch mid-bout: you forfeit. */

import * as THREE from "three";
import { bar, rpBusy, rpExtras, rpListeners, rpSeats, seated, sitDown, standUp } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1";
import { touchState } from "../input/touch.js?v=in1-th2-bp1-bf1-pd1-nf1-fs1";
import { localPosers } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3";
import { peerPosers } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1";
import { poseSeated } from "./rp-roles.js?v=rp1b7-cd1-sh1-dj2-or1-bw2-sp1";
import { reachHand, setHandPose } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { TIPSY } from "../maps/saloon-bar.js?v=sb1b7-cup1-gt1-gt2-cw1-zr10-hr2-zp1-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { damp } from "../characters/anim-curves.js?v=or1";
import { game } from "../core/state.js?v=st1";

export const AW = {
  countSecs: 3, boutSecs: 15, endSecs: 3.2,
  tapMax: 12,                  // taps a second that count; past that, nothing (turbo keys)
  sweetMul: 2.2, sweetW: 0.18, sweepSecs: 0.9,
  decay: 3, gain: 0.12,        // push fades at `decay`/s; the meter moves `gain` per unit of push difference
  npcRate: [5.5, 7.5], surgeEvery: [4, 6], surgeSecs: 1.5, surgeMul: 1.6, tireAfter: 10, tireMul: 0.7,
  walkMps: 1.8, callSecs: 12, near: 1.5,
};
// headless tests shorten the bout (tools/troll-ops-arm-wrestle-test.mjs)
if (typeof window !== "undefined" && window.__trollAwTune) Object.assign(AW, window.__trollAwTune);

const EXTRAS = new Set(["Townsfolk", "Drifter", "Barfly", "Regular", "Gambler", "Clubgoer", "Raver"]);
const HOLDING = new Set(["call", "count", "bout", "end"]);

export const aw = {
  phase: null,          // null | "wait" | "call" | "count" | "bout" | "end"
  tb: -1, side: 0,      // our table, and which of its seats is ours
  foe: null,            // { npc: i, name } | { id, name }
  driver: false,
  t: 0, m: 0,           // the meter: +1 = seat 0 pins seat 1
  f: [0, 0],            // each side's push
  w: null,              // the result: 0 / 1 (that seat won), 2 (a draw)
  taps: [], sweepT: 0, pushOut: 0, pubT: 0, fireWas: false, lastS: 0, done: false,
  npc: null,            // the townsperson we called: { i, n, sat, rate, surge, surgeT, nextSurge, t }
  hits: { sweet: 0, all: 0 },
};
const remoteNpc = new Map();   // npc index -> { from, last, tb, side, x, z, yaw, sit, m, ph, w }

const tables = () => (game.isSocial() ? game.builtMap?.map?.rp?.arm?.() || [] : []);
const seatOf = (i) => rpSeats()?.[i];
const send = (m) => game.net.publishRp({ k: "aw", ...m });
const nowS = () => performance.now() / 1000;
const angleTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));
const myName = () => game.net?.name || "You";

/* Which arm table and side a seat index is. */
function tableOfSeat(idx) {
  const T = tables();
  for (let tb = 0; tb < T.length; tb++) { const s = T[tb].seats.indexOf(idx); if (s >= 0) return { tb, side: s }; }
  return null;
}
/* A real player sat in seat `idx` (not us). */
function peerInSeat(idx) {
  for (const p of game.net.peers.values()) if (!game.isBotPeer(p) && p.seat === idx + 1) return p;
  return null;
}
/* A townsperson sat at (or walking to) a table's seat, anyone's. */
function npcAt(tb, side) {
  if (aw.npc && aw.tb === tb && aw.side !== side) return aw.npc.n;
  for (const [i, r] of remoteNpc) if (r.tb === tb && r.side === side) return game.townNpcs?.list[i] || null;
  return null;
}

/* ------------------------------------------------------------- the pose */

const _P = new THREE.Vector3(), _L = new THREE.Vector3(), _E = new THREE.Vector3(), _S = new THREE.Vector3();
const _M = new THREE.Vector3(), _pole = new THREE.Vector3(), _poleL = new THREE.Vector3(-1, -1, 0.3);
const ELBOW_IN = 0.07;     // each elbow this far from the table's middle: the forearms all but upright
const SCOOT = 0.1;         // to the front edge of the seat
const PIN = 1.35;          // how far over the clasped hands go at a pin (radians off upright)

/* The table's axis: the unit way from seat 0 to seat 1. */
function axisOf(T) {
  const A = seatOf(T.seats[0]), B = seatOf(T.seats[1]);
  if (!A || !B) return [1, 0];
  const ux = B.x - A.x, uz = B.z - A.z, l = Math.hypot(ux, uz) || 1;
  return [ux / l, uz / l];
}

/* A real grip: the right elbow planted on the pad just short of the middle,
   the body leaned in over the table until the upper arm reaches it (solved
   per rig, so a tall stool or a big troll still gets there), the forearm up
   from it to the clasped hands. The hands swing over about the middle, down
   toward the side that's losing. The left hand flat on the table. The
   winner's fists up after, the loser slumped. */
function poseWrestler(rig, T, side, m, ph, w, t) {
  const p = rig.parts;
  if (ph === "end" && w === side) {
    p.armL.rotation.set(2.7, 0, 0.65 + Math.sin(t * 9) * 0.08); p.armR.rotation.set(2.7, 0, -0.65 - Math.sin(t * 9) * 0.08);
    p.elbowL.rotation.set(0.3, 0, 0); p.elbowR.rotation.set(0.3, 0, 0);
    setHandPose(rig, 1, "fist"); setHandPose(rig, -1, "fist");
    rig.body?.update?.();
    return;
  }
  const effort = ph === "bout" ? 1 : ph === "end" ? 0 : 0.4;
  const lost = ph === "end" && w === 1 - side;
  const k = rig.scale || 1;
  const [ux, uz] = axisOf(T), dir = side === 0 ? 1 : -1;   // dir * u: from this seat toward the other
  const fx = ux * dir, fz = uz * dir;
  rig.root.position.x += fx * SCOOT * k; rig.root.position.z += fz * SCOOT * k;
  p.chest.rotation.x -= effort * 0.08 + (lost ? 0.2 : 0);   // forward is negative here too
  // the elbow's spot on the pad
  const eIn = ELBOW_IN * k, ua = rig.upperArm, fa = rig.foreArm;
  _E.set(T.x - fx * eIn, T.top + 0.035 * k, T.z - fz * eIn);
  // the clasped hands: over the middle at forearm height, going down sideways
  // the way a real pin goes, toward the loser's right (the winner's left).
  // They turn about the line through both elbows, so both forearms keep
  // their length and both elbows stay planted all the way down.
  const R = Math.sqrt(Math.max(0.01, fa * fa - eIn * eIn));
  const th = Math.max(-1, Math.min(1, lost ? -dir : m)) * PIN;   // m > 0: seat 1 going down, to (uz, -ux)
  _P.set(T.x + uz * Math.sin(th) * R, _E.y + Math.cos(th) * R, T.z - ux * Math.sin(th) * R);
  if (effort) { _P.x += Math.sin(t * 28) * 0.006 * effort; _P.y += Math.cos(t * 31) * 0.005 * effort; }   // straining
  // lean in until the shoulder is an upper arm from the elbow's spot, and
  // further if the hands have gone over to the far side out of reach
  const lean = (L) => { p.torso.rotation.x = -L; rig.root.updateMatrixWorld(true); return p.armR.getWorldPosition(_S); };   // forward is negative on the torso
  const solve = (lo, hi, tooFar) => { for (let i = 0; i < 7; i++) { const L = (lo + hi) / 2; if (tooFar(lean(L))) lo = L; else hi = L; } return hi; };
  let L = solve(0, 1.2, (S) => S.distanceTo(_E) > ua * 0.99);
  const reach = (ua + fa) * 0.97;
  if (lean(L).distanceTo(_P) > reach) L = solve(L, 1.6, (S) => S.distanceTo(_P) > reach);
  lean(L);
  // the head back up against the lean: eyes on the other fellow (the loser's hang)
  p.headPivot.rotation.x = L * (lost ? 0.3 : 0.85);
  rig.root.updateMatrixWorld(true);
  // two-bone reach to the hands, the elbow bent toward its spot on the pad
  _M.copy(_S).add(_P).multiplyScalar(0.5);
  p.chest.worldToLocal(_pole.copy(_E));
  p.chest.worldToLocal(_M);
  _pole.sub(_M);
  p.chest.worldToLocal(_P);
  reachHand(rig, 1, _P, _pole);
  // the left hand flat on the table, out to the left of the elbow
  _L.set(T.x - fx * 0.3 * k + fz * 0.22 * k, T.top + 0.02 * k, T.z - fz * 0.3 * k - fx * 0.22 * k);
  p.chest.worldToLocal(_L);
  reachHand(rig, -1, _L, _poleL);
  setHandPose(rig, 1, "fist"); setHandPose(rig, -1, "open");
  rig.body?.update?.();
}

/* -------------------------------------------------------- our bout */

function clear(quiet = false) {
  if (aw.npc) { game.townNpcs?.release(aw.npc.i); aw.npc = null; }
  if (!quiet && aw.driver && aw.phase && aw.phase !== "wait") send({ e: "x", tb: aw.tb });
  Object.assign(aw, { phase: null, tb: -1, foe: null, driver: false, t: 0, m: 0, f: [0, 0], w: null, pushOut: 0, done: false });
  rpBusy.arm = false;
}

/* Hold X at the table: the nearest free townsperson comes over. */
export function callNpc() {
  const T = tables()[aw.tb], S = seatOf(T?.seats[1 - aw.side]);
  const N = game.townNpcs;
  if (!T || !S || !N) return false;
  const view = game.builtMap?.map?.rp?.view;
  const zone = view ? view.zoneOf(T.x, S.floor, T.z) : null;
  let best = -1, bestD = 30;
  N.list.forEach((n, i) => {
    if (!EXTRAS.has(n.c.role) || n.c.sit || n.off || n.override || Math.abs((n.c.y ?? 0) - S.floor) > 0.5) return;
    if (zone && !view.sees(zone, view.zoneOf(n.x, n.c.y ?? 0, n.z))) return;
    const d = Math.hypot(n.x - T.x, n.z - T.z);
    if (d < bestD) { best = i; bestD = d; }
  });
  if (best < 0) { showWaveBanner("Nobody here's up for it right now", 1800); return false; }
  const n = N.takeOver(best, (nn, rig, dt) => {
    const st = aw.npc;
    if (!st || st.i !== best) return;
    if (st.sat) {
      poseSeated(rig, S.y, S.kind === "stool" ? 0.55 : 0);
      poseWrestler(rig, T, 1 - aw.side, aw.m, aw.phase, aw.w, nowS() + nn.seed * 3);
    }
  });
  if (!n) return false;
  aw.npc = { i: best, n, sat: false, rate: AW.npcRate[0] + (AW.npcRate[1] - AW.npcRate[0]) * n.seed, surge: 0, nextSurge: 3, t: 0 };
  aw.foe = { npc: best, name: n.c.name };
  aw.driver = true;
  aw.phase = "call"; aw.t = 0;
  showWaveBanner(`${n.c.name}: "You're on."`, 1800);
  return true;
}

function startCount() {
  Object.assign(aw, { phase: "count", t: 0, m: 0, f: [0, 0], w: null, done: false });
  aw.hits = { sweet: 0, all: 0 };
}

/* The driver's step: the townsperson walking over, the count, the meter. */
function drive(dt, T) {
  const npc = aw.npc;
  if (aw.phase === "call" && npc) {
    const S = seatOf(T.seats[1 - aw.side]), n = npc.n;
    npc.t += dt;
    const d = Math.hypot(S.x - n.x, S.z - n.z);
    if (d < 0.12 || npc.t > AW.callSecs) {
      n.x = S.x; n.z = S.z; n.yaw = S.yaw ?? angleTo(S.x, S.z, T.x, T.z); n.moving = false;
      npc.sat = true;
      startCount();
    } else {
      const s = Math.min(d, AW.walkMps * dt);
      n.x += (S.x - n.x) / d * s; n.z += (S.z - n.z) / d * s;
      n.yaw = angleTo(n.x, n.z, S.x, S.z); n.moving = true;
    }
  } else if (aw.phase === "count") {
    aw.t += dt;
    if (aw.t >= AW.countSecs) { aw.phase = "bout"; aw.t = 0; game.audio?._tone?.({ freq: 880, duration: 0.25, gain: 0.08, type: "square" }); }
  } else if (aw.phase === "bout") {
    aw.t += dt;
    if (npc) {
      // his push: steady, a surge now and then, tiring late on
      npc.nextSurge -= dt;
      if (npc.nextSurge <= 0) { npc.surge = AW.surgeSecs; npc.nextSurge = AW.surgeEvery[0] + Math.random() * (AW.surgeEvery[1] - AW.surgeEvery[0]); }
      npc.surge = Math.max(0, npc.surge - dt);
      const rate = npc.rate * (npc.surge > 0 ? AW.surgeMul : 1) * (aw.t > AW.tireAfter ? AW.tireMul : 1);
      aw.f[1 - aw.side] += rate * dt;
    }
    const decay = Math.exp(-AW.decay * dt);
    aw.f[0] *= decay; aw.f[1] *= decay;
    aw.m = Math.max(-1, Math.min(1, aw.m + (aw.f[0] - aw.f[1]) * AW.gain * dt));
    if (Math.abs(aw.m) >= 1) finish(aw.m > 0 ? 0 : 1);
    else if (aw.t >= AW.boutSecs) finish(Math.abs(aw.m) < 0.05 ? 2 : aw.m > 0 ? 0 : 1);
  } else if (aw.phase === "end") {
    aw.t += dt;
    if (aw.t >= AW.endSecs) afterBout();
  }
  // the room sees it, 10 a second
  aw.pubT -= dt;
  if (aw.pubT <= 0 && HOLDING.has(aw.phase)) {
    aw.pubT = 0.1;
    const ids = [null, null];
    ids[aw.side] = game.net.id;
    if (aw.foe?.id) ids[1 - aw.side] = aw.foe.id;
    const m = { e: "s", tb: aw.tb, ph: aw.phase, m: +aw.m.toFixed(3), a: ids[0] || "", b: ids[1] || "", w: aw.w ?? -1, c: +(AW.countSecs - aw.t).toFixed(2) };
    if (npc) Object.assign(m, { n: npc.i, ns: 1 - aw.side, nx: +npc.n.x.toFixed(2), nz: +npc.n.z.toFixed(2), ny: +npc.n.yaw.toFixed(2), st: npc.sat ? 1 : 0 });
    send(m);
  }
  // a player across the table leans into it on our screen too (we don't hear our own messages)
  const q = aw.foe?.id && game.net.peers.get(aw.foe.id);
  if (q && HOLDING.has(aw.phase)) q.aw = { tb: aw.tb, side: 1 - aw.side, m: aw.m, ph: aw.phase, w: aw.w, at: nowS() };
}

function finish(w) {
  aw.w = w; aw.phase = "end"; aw.t = 0;
  result();
}

/* The pin: tell us how it went, and keep score for the day. */
function result() {
  if (aw.done) return;
  aw.done = true;
  const foe = aw.foe?.name || "them";
  const T = tables()[aw.tb];
  if (T) game.audio?.knuckleHit?.({ x: T.x, y: T.top, z: T.z });
  let line;
  if (aw.w === 2) line = `Nobody's pinned. Call it a draw with ${foe}`;
  else {
    const won = aw.w === aw.side;
    const rec = tally(foe, won);
    line = won ? `You pinned ${foe}! (${rec[0]}-${rec[1]} today)` : `${foe} pinned you (${rec[0]}-${rec[1]} today)`;
  }
  showWaveBanner(line, 2600);
}

/* Winner stays: the loser gets up; a townsperson goes back to his loop. */
function afterBout() {
  const lost = aw.w === 1 - aw.side, npc = aw.npc;
  if (npc) { game.townNpcs?.release(npc.i); aw.npc = null; }
  if (aw.driver) send({ e: "x", tb: aw.tb });
  const stand = lost;
  Object.assign(aw, { phase: "wait", foe: null, driver: false, t: 0, m: 0, f: [0, 0], w: null, done: false });
  rpBusy.arm = false;
  if (stand) { standUp(); clear(true); }
}

/* Win, lose, per opponent, today (this browser only: bragging rights). */
function tally(name, won) {
  const day = new Date().toISOString().slice(0, 10);
  let rec = { day, by: {} };
  try { const r = JSON.parse(localStorage.getItem("tf-arm-wrestle") || "null"); if (r?.day === day) rec = r; } catch { /* storage off */ }
  const v = rec.by[name] || [0, 0];
  v[won ? 0 : 1]++;
  rec.by[name] = v;
  try { localStorage.setItem("tf-arm-wrestle", JSON.stringify(rec)); } catch { /* storage off */ }
  return v;
}

/* A tap: weighed by the timing marker, clamped against mashing. */
export function tap(forceSweet = null) {
  if (aw.phase !== "bout") return;
  const now = nowS();
  aw.taps = aw.taps.filter((t) => now - t < 1);
  if (aw.taps.length >= AW.tapMax) return;
  aw.taps.push(now);
  const sweet = forceSweet ?? Math.abs(sweep() - 0.5) < AW.sweetW / 2;
  let v = sweet ? AW.sweetMul : 1;
  if (bar.tipsy > TIPSY.onset) v *= 0.85;
  aw.hits.all++; if (sweet) aw.hits.sweet++;
  if (aw.driver) aw.f[aw.side] += v;
  else aw.pushOut += v;
}
/* The timing marker, 0..1 across its track and back. */
function sweep() {
  const u = (aw.sweepT / AW.sweepSecs) % 2;
  return u < 1 ? u : 2 - u;
}

/* ------------------------------------------------------- every frame */

export function updateArmWrestle(dt) {
  const T = tables();
  if (!T.length) { if (aw.phase) clear(true); remoteNpc.clear(); hideUi(); return; }
  const now = nowS();
  for (const [i, r] of remoteNpc) if (now - r.last > 3) { game.townNpcs?.release(i); remoteNpc.delete(i); }
  for (const p of game.net.peers.values()) if (p.aw && now - p.aw.at > 1.5) p.aw = null;

  const mine = seated ? tableOfSeat(seated.idx) : null;
  if (!mine) { if (aw.phase) { if (aw.phase === "bout" && aw.foe) showWaveBanner("You let go. That's a forfeit", 1600); clear(); } hideUi(); return; }
  if (aw.tb !== mine.tb || aw.side !== mine.side) { clear(true); aw.tb = mine.tb; aw.side = mine.side; }
  aw.phase ??= "wait";
  const Tb = T[aw.tb];

  // who's across the table
  const other = peerInSeat(Tb.seats[1 - aw.side]);
  if (aw.npc) { /* ours */ }
  else if (other) {
    if (aw.foe?.id !== other.id) {
      aw.foe = { id: other.id, name: other.name || "Someone" };
      aw.driver = game.net.id < other.id;
      if (aw.phase === "wait" && aw.driver) startCount();
    }
  } else if (aw.foe) {
    // they got up
    if (aw.phase === "bout" || aw.phase === "count") showWaveBanner(`${aw.foe.name} walked away. You win by forfeit`, 2000);
    Object.assign(aw, { phase: "wait", foe: null, driver: false, t: 0, m: 0, w: null, done: false });
  }

  aw.sweepT += dt;
  rpBusy.arm = HOLDING.has(aw.phase);
  // fire: a tap
  const fire = !game.localPauseOnly && (game.mouseDown || (game.isTouch && touchState.firing) || (game.gamepadState.connected && game.gamepadState.firing));
  if (fire && !aw.fireWas) tap();
  aw.fireWas = fire;

  if (aw.driver) drive(dt, Tb);
  else if (aw.foe?.id) {
    // their client runs it: send our pushes, mirror the meter
    if (now - aw.lastS > 2 && HOLDING.has(aw.phase)) Object.assign(aw, { phase: "wait", m: 0, w: null });
    aw.pubT -= dt;
    if (aw.pubT <= 0) { aw.pubT = 0.1; if (aw.pushOut > 0) { send({ e: "p", tb: aw.tb, v: +aw.pushOut.toFixed(2) }); aw.pushOut = 0; } }
    if (aw.phase === "end" && aw.w != null) result();
  }
  ui();
}

/* Sat at the table mid-bout: the seat holds you whatever the stick says;
   jump or crouch lets go (a forfeit). */
export const awHolds = () => !!seated && HOLDING.has(aw.phase) && aw.phase !== "call";
export function awHold(dt, quit) {
  if (quit || !game.player.alive) { standUp(); return; }
  const s = seated.s;
  game.move.pos.set(s.x, s.floor, s.z);
  game.move.velocity.set(0, 0, 0);
  game.move.moving = false; game.move.sprinting = false; game.move.grounded = true;
  game.move.eyeHeight = damp(game.move.eyeHeight, s.y - s.floor + 0.7, 10, dt);
}

/* ---------------------------------------------------- hold X: the tables */

rpExtras.push(() => {
  if (!game.isSocial() || !game.player.alive) return null;
  const T = tables();
  if (!T.length) return null;
  if (seated) {
    const mine = tableOfSeat(seated.idx);
    if (!mine || aw.phase !== "wait" || aw.foe) return null;
    return { key: "aw-call", label: "Call someone over to arm wrestle", busy: "Looking round…", ctx: "Call", time: 0.5, done: () => callNpc() };
  }
  const p = game.move.pos;
  for (let tb = 0; tb < T.length; tb++) {
    const t = T[tb];
    if (Math.hypot(p.x - t.x, p.z - t.z) > AW.near + 0.6) continue;
    const S = t.seats.map(seatOf);
    if (!S[0] || Math.abs(p.y - S[0].floor) > 0.6) continue;
    const who = [0, 1].map((s) => peerInSeat(t.seats[s]) || npcAt(tb, s));
    if (who[0] && who[1]) return { key: `aw-busy-${tb}`, info: true, label: "Arm wrestling in progress" };
    const free = who[0] ? 1 : who[1] ? 0 : (Math.hypot(p.x - S[0].x, p.z - S[0].z) < Math.hypot(p.x - S[1].x, p.z - S[1].z) ? 0 : 1);
    const waiting = who[1 - free];
    const label = waiting ? `Arm wrestle ${waiting.name || waiting.c?.name || "them"}` : "Arm wrestle";
    return { key: `aw-${tb}-${free}`, label, ctx: "Wrestle", time: 0.4, done: () => { sitDown(t.seats[free]); showWaveBanner(waiting ? "Fire to push · tap in the green" : "Wait for a challenger, or hold X to call one over", 2200); } };
  }
  return null;
});

/* ------------------------------------------------- the room's bouts */

rpListeners.push((p, m) => {
  if (m.k !== "aw" || game.isBotPeer(p)) return;
  const tb = m.tb | 0, T = tables()[tb];
  if (!T) return;
  const now = nowS();
  if (m.e === "p") {
    if (aw.driver && aw.tb === tb && aw.foe?.id === p.id && aw.phase === "bout") aw.f[1 - aw.side] += Math.max(0, Math.min(AW.tapMax * AW.sweetMul, +m.v || 0));
    return;
  }
  if (m.e === "x") {
    for (const [i, r] of remoteNpc) if (r.tb === tb && r.from === p.id) { game.townNpcs?.release(i); remoteNpc.delete(i); }
    if (!aw.driver && aw.tb === tb && aw.foe?.id === p.id && aw.phase) {
      const lost = aw.w === 1 - aw.side;
      Object.assign(aw, { phase: "wait", t: 0, m: 0, w: null, done: false });
      if (lost) { standUp(); clear(true); }
    }
    return;
  }
  if (m.e !== "s" || typeof m.ph !== "string" || !HOLDING.has(m.ph)) return;
  const mm = Math.max(-1, Math.min(1, +m.m || 0)), w = (m.w | 0) >= 0 ? m.w | 0 : null;
  // our bout, run by them
  if ((m.a === game.net.id || m.b === game.net.id) && aw.tb === tb && !aw.driver) {
    aw.lastS = now;
    if (aw.phase !== m.ph) { aw.phase = m.ph; aw.t = 0; if (m.ph === "count") { aw.done = false; aw.hits = { sweet: 0, all: 0 }; } }
    aw.m = mm; aw.w = w;
    if (m.ph === "count") aw.t = AW.countSecs - (+m.c || 0);
  }
  // the bodies: each player in it leans in on everyone's screen
  for (const [id, side] of [[m.a, 0], [m.b, 1]]) {
    if (!id || id === game.net.id) continue;
    const q = game.net.peers.get(id);
    if (q) q.aw = { tb, side, m: mm, ph: m.ph, w, at: now };
  }
  // their townsperson
  const i = m.n | 0;
  if (m.n == null || i < 0 || (aw.npc && aw.npc.i === i)) return;
  const N = game.townNpcs, n = N?.list[i];
  if (!n) return;
  let r = remoteNpc.get(i);
  if (!r) {
    if (n.override) return;
    r = { from: p.id, tb, side: m.ns | 0 };
    remoteNpc.set(i, r);
    N.takeOver(i, (nn, rig) => {
      const R = remoteNpc.get(i), S = R && seatOf(tables()[R.tb]?.seats[R.side]);
      if (!R?.sit || !S) return;
      poseSeated(rig, S.y, S.kind === "stool" ? 0.55 : 0);
      poseWrestler(rig, tables()[R.tb], R.side, R.m, R.ph, R.w, nowS() + nn.seed * 3);
    });
  }
  if (r.from !== p.id) return;
  Object.assign(r, { last: now, m: mm, ph: m.ph, w, sit: !!m.st });
  if (Number.isFinite(+m.nx) && Number.isFinite(+m.nz)) { n.moving = !m.st && Math.hypot(+m.nx - n.x, +m.nz - n.z) > 0.03; n.x = +m.nx; n.z = +m.nz; }
  if (Number.isFinite(+m.ny)) n.yaw = +m.ny;
});

/* ------------------------------------------------- the bodies we see */

localPosers.push((rig) => {
  if (!seated || !HOLDING.has(aw.phase) || aw.phase === "call") return;
  const T = tables()[aw.tb];
  if (T) poseWrestler(rig, T, aw.side, aw.m, aw.phase, aw.w, nowS());
});
peerPosers.push((rp) => {
  const s = rp.peer?.aw;
  if (!s || !game.isSocial() || s.ph === "call") return;
  const T = tables()[s.tb];
  if (T) poseWrestler(rp.rig, T, s.side, s.m, s.ph, s.w, nowS() + (rp.peer.id?.length || 0));
});

/* First person: the right hand up and locked, straining away or giving
   ground; the left hand on the table's edge. */
export function awArms() {
  if (!seated || !HOLDING.has(aw.phase) || aw.phase === "call") return null;
  const mMe = aw.side === 0 ? aw.m : -aw.m;
  const t = nowS(), strain = aw.phase === "bout" ? 1 : 0;
  if (aw.phase === "end" && aw.w === aw.side) {
    const b = Math.sin(t * 9) * 0.02;
    return { R: { pos: [0.2, 0.02 + b, -0.42], rot: [1.6, 0, -Math.PI / 2], pose: "fist" }, L: { pos: [-0.2, 0.02 - b, -0.42], rot: [1.6, 0, Math.PI / 2], pose: "fist" }, gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
  }
  const jit = Math.sin(t * 28) * 0.004 * strain;
  const R = { pos: [0.04 + mMe * 0.04 + jit, -0.2 - Math.abs(mMe) * 0.1, -0.48 - mMe * 0.07], rot: [0.9 - mMe * 0.5, 0.25, -Math.PI / 2 + mMe * 0.5], pose: "fist" };
  const L = { pos: [-0.22, -0.3, -0.38], rot: [0.4, -0.1, Math.PI / 2], pose: "open" };
  return { R, L, gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
}

/* ------------------------------------------------------------ the chip */

let chip = null;
function ensureUi() {
  if (chip || !game.els?.hud) return chip;
  const el = document.createElement("div");
  el.className = "aw-chip";
  el.style.cssText = "position:absolute;top:58px;left:50%;transform:translateX(-50%);z-index:12;width:min(340px,86vw);padding:9px 14px 10px;border-radius:14px;background:rgba(30,20,12,.88);border:0.5px solid rgba(224,173,79,.5);color:#f4e8cf;font:600 12px/1.2 'DM Mono',monospace;pointer-events:none;text-align:center";
  el.innerHTML = `<div class="aw-names" style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px"><span class="aw-me"></span><span class="aw-foe"></span></div>
    <div class="aw-tug" style="position:relative;height:12px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden">
      <div class="aw-fill" style="position:absolute;top:0;bottom:0;left:50%;width:0;background:#e0ad4f"></div>
      <div style="position:absolute;top:-2px;bottom:-2px;left:50%;width:2px;margin-left:-1px;background:#f4e8cf"></div></div>
    <div class="aw-time" style="position:relative;height:8px;margin-top:6px;border-radius:4px;background:rgba(255,255,255,.08)">
      <div class="aw-sweet" style="position:absolute;top:0;bottom:0;border-radius:4px;background:rgba(80,220,120,.55)"></div>
      <div class="aw-mark" style="position:absolute;top:-3px;bottom:-3px;width:3px;margin-left:-1.5px;border-radius:2px;background:#fff"></div></div>
    <div class="aw-line" style="margin-top:7px;font-size:13px"></div>`;
  el.hidden = true;
  game.els.hud.append(el);
  chip = { el, me: el.querySelector(".aw-me"), foe: el.querySelector(".aw-foe"), fill: el.querySelector(".aw-fill"), sweet: el.querySelector(".aw-sweet"), mark: el.querySelector(".aw-mark"), line: el.querySelector(".aw-line"), time: el.querySelector(".aw-time"), tug: el.querySelector(".aw-tug") };
  chip.sweet.style.left = `${(0.5 - AW.sweetW / 2) * 100}%`;
  chip.sweet.style.width = `${AW.sweetW * 100}%`;
  return chip;
}
function hideUi() { if (chip) chip.el.hidden = true; }
function ui() {
  if (!ensureUi()) return;
  const c = chip;
  c.el.hidden = !aw.phase;
  if (!aw.phase) return;
  c.me.textContent = myName();
  c.foe.textContent = aw.foe?.name || "…";
  const live = aw.phase === "count" || aw.phase === "bout" || aw.phase === "end";
  c.tug.style.display = c.time.style.display = live ? "" : "none";
  const mMe = aw.side === 0 ? aw.m : -aw.m;
  c.fill.style.left = `${50 + Math.min(0, mMe) * 50}%`;
  c.fill.style.width = `${Math.abs(mMe) * 50}%`;
  c.fill.style.background = mMe >= 0 ? "#e0ad4f" : "#d0504a";
  c.mark.style.left = `${sweep() * 100}%`;
  c.mark.style.opacity = aw.phase === "bout" ? "1" : "0.3";
  if (aw.phase === "wait") c.line.textContent = "Waiting for a challenger…";
  else if (aw.phase === "call") c.line.textContent = `${aw.foe?.name || "Someone"}'s coming over`;
  else if (aw.phase === "count") c.line.textContent = String(Math.max(1, Math.ceil(AW.countSecs - aw.t)));
  else if (aw.phase === "bout") c.line.textContent = `PUSH! ${Math.max(0, Math.ceil(AW.boutSecs - aw.t))}`;
  else c.line.textContent = aw.w === 2 ? "A draw" : aw.w === aw.side ? "You win" : `${aw.foe?.name || "They"} win${aw.foe?.name ? "s" : ""}`;
}

// headless tests reach in here (tools/troll-ops-arm-wrestle-test.mjs)
if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollAw = {
    aw, AW, tap, callNpc, rig: () => game.localRig, tables: () => tables().map((t) => ({ ...t })),
    state: () => ({ phase: aw.phase, tb: aw.tb, side: aw.side, m: aw.m, w: aw.w, driver: aw.driver, foe: aw.foe && { ...aw.foe }, f: [...aw.f],
      npc: aw.npc && { i: aw.npc.i, x: aw.npc.n.x, z: aw.npc.n.z, sat: aw.npc.sat }, seat: seated?.idx ?? -1, hits: { ...aw.hits },
      remote: [...remoteNpc.entries()].map(([i, r]) => ({ i, tb: r.tb, side: r.side, sit: r.sit, ph: r.ph, m: r.m })),
      peers: [...game.net.peers.values()].filter((q) => q.aw).map((q) => ({ id: q.id, ...q.aw })) }),
  };
}
