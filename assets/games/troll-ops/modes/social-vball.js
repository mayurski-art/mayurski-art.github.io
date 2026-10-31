// Troll Forces — beach volleyball at Troll Beach (5d phase 5,
// docs/GRIN-BEACH-COURTS.md), in Socialize: 2v2 on the sand, rally scoring
// to 15, win by 2.
//
// - Hold X at the ball by the referee's chair: anyone else who holds X
//   there in 4 s plays; the beach's four ballers fill the rest (2v2).
// - Serving: fire tosses, fire again at the top hits it over (aim with the
//   look). The side that wins a rally serves the next.
// - Three touches a side. Press as the ball comes (it lands on the
//   contact, like the tennis): low = a bump up to your partner, high = a
//   set up to the net, jump + fire near the net with the ball high = a
//   spike where you look. Jump at the net as they swing = a block.
// - A ball down in their court is your point; out, or into the net, is
//   theirs (the last side to touch it loses it).
// - The NPCs (the host runs them, streamed like the hoops ones) pass, set
//   and hit by skill, and block at the net.
//
// The wire: rp { k: "vb" } hit { id, L, by, toss } (each touch a launch),
// { k: "vg" } the match (s, join, n).

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h";
import { rpExtras, rpListeners, seated } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3-jx4-jx5-mb1-mb2-gc1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h";
import { peerPosers } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-jx2-jx3-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h";
import { localPosers } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h";
import { loadClip, sampleClip, applyClip, CLIP_SPINE, CLIP_ARM_L, CLIP_ARM_R } from "../characters/clips.js?v=rc1";
import { loadModel } from "../maps/battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1-hgb6";
import { drawBoard } from "../maps/grinbeach-courts.js?v=gb5-tb2-kbb2-kbs1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-hgb2-ugb1-ug1-ugm1-hgb5-hgb6-hgb8";
import { touchState } from "../input/touch.js?v=in1-th2-bp1-bf1-pd1-nf1-fs1";
import { roomNow } from "./room-clock.js?v=rc1-cd1-sh1";
import { vballWorld, newBall, stepBall, advanceBall, makeLaunch, arcTo, solveDrive, HZ } from "./court-ball.js?v=gb5-gb8";
import { courtSound } from "../sound/court-sfx.js?v=gb6";

export const VBG = {
  spot: 2.2, wait: 4, to: 15, by: 2,
  reach: 1.5, spikeReach: 1.3,         // m: a pass in reach; a spike's hand
  lead: [0.2, 0.55],                  // s early a press is on time
  tossV: 4.6, serveSpeed: 16, spikeSpeed: 19,
  grace: 320,
};
export const VB_CLIPS = ["vb-ready", "vb-bump", "vb-set", "vb-spike", "vb-block", "vb-serve"];
const CONTACT = { "vb-bump": 0.22, "vb-set": 0.26, "vb-spike": 0.5, "vb-block": 0.3, "vb-serve": 0.56 };
const UPPER = [...CLIP_SPINE, ...CLIP_ARM_L, ...CLIP_ARM_R, "headPivot"];

const myId = () => game.net?.id || "me";
const isNpc = (id) => typeof id === "string" && /^npc\d+$/.test(id);
const npcIndex = (id) => +id.slice(3);
const spots = () => (game.isSocial() ? game.builtMap?.map?.rp?.courts?.() || null : null);
const sendB = (m) => game.net?.publishRp?.({ k: "vb", ...m });
const sendG = (m) => game.net?.publishRp?.({ k: "vg", ...m });
let world = null, worldFor = null;
const courtWorld = (S) => { if (worldFor !== S) { worldFor = S; world = vballWorld(S.layout.vb); } return world; };

export const V = { clip: "vb-ready", clipAt: 0, swing: null, toss: null, seq: 0, flash: null, inGame: false };
export const vballs = new Map();
export const VM = { s: null, sentAt: 0, seqSeen: -1, pending: [], npcSent: 0, calm: false };
const brains = new Map(), shown = new Map();

/* ------------------------------------------------------------ the court */

const C = (S) => { const [x0, x1, z0, z1] = S.layout.vb; return { x0, x1, z0, z1, x: (x0 + x1) / 2, net: (z0 + z1) / 2 }; };
const sideOf = (S, z) => (z > C(S).net ? 0 : 1);           // 0: the boardwalk half, 1: the sea half
const toNet = (side) => (side === 0 ? -1 : 1);
const inCourt = (S, x, z, r = 0.1) => { const c = C(S); return x >= c.x0 - r && x <= c.x1 + r && z >= c.z0 - r && z <= c.z1 + r; };

/* ------------------------------------------------------------ the clips */

const CLIPS = {};
for (const n of VB_CLIPS) loadClip(n).then((c) => { CLIPS[n] = c; }, (e) => console.warn(e.message));
const _samp = {};
function poseVb(rig, name, t, full) {
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
const setClip = (name, at = roomNow()) => { V.clip = name; V.clipAt = at; };

/* ------------------------------------------------------------- the ball */

let ballScene = null;
loadModel("gb-volleyball").then((m) => { ballScene = m; }, (e) => console.warn("gb-volleyball", e?.message || e));
function ballFor(id) {
  let b = vballs.get(id);
  if (!b) { b = { id, mesh: null, sim: null, hitter: null, side: 0, touches: 0, toss: false, seen: performance.now() }; vballs.set(id, b); }
  if (!b.mesh && ballScene) { b.mesh = ballScene.clone(true); b.mesh.name = "volleyball"; }
  if (b.mesh && !b.mesh.parent) game.scene.add(b.mesh);
  return b;
}
function dropVBall(id) { const b = vballs.get(id); b?.mesh?.parent?.remove(b.mesh); vballs.delete(id); }
function ballAt(b, at) {
  const c = newBall(b.sim.world, b.sim.launch);
  const n = Math.floor((at - b.sim.launch.at) / 1000 * HZ);
  for (let i = 0; i < n && !c.rest; i++) stepBall(c);
  return c;
}
/* A touch: everyone gets the launch. */
function touch(id, L, meta = {}) {
  const S = spots();
  if (!S) return;
  const b = ballFor(id);
  b.sim = newBall(courtWorld(S), L);
  b.hitter = L.by || myId(); b.toss = !!meta.toss; b.sentAt = performance.now();
  sendB({ e: "hit", id, L, by: meta.by, toss: meta.toss ? 1 : 0, kind: meta.kind || "" });
  onTouch(b, meta.kind);
  if (!meta.toss) courtSound("vball", { x: L.p[0], y: L.p[1], z: L.p[2] }, meta.kind === "spike" ? 1 : 0.6);
}

/* Where to meet a ball on our side: in reach, at the height the touch
   wants (a bump low, a set high, a spike up at the jump), in the next 1.6 s. */
export function contactPoint(S, b, x, z, side, kind) {
  if (!b?.sim || b.sim.rest) return null;
  const c = newBall(b.sim.world, b.sim.launch);
  for (let i = 0; i < b.sim.n && !c.rest; i++) stepBall(c);
  const now0 = b.sim.launch.at + b.sim.n / HZ * 1000;
  const [lo, hi] = kind === "spike" ? [2.4, 3.3] : kind === "set" ? [1.7, 2.6] : [0.45, 1.5];
  const reach = kind === "spike" ? VBG.spikeReach + 0.4 : VBG.reach;
  let best = null;
  for (let i = 1; i < HZ * 1.6 && !c.rest; i++) {
    stepBall(c);
    if (c.events.some((e) => e.kind === "bounce")) break;   // down: too late
    if (i % 3 || sideOf(S, c.p[2]) !== side || c.v[1] > 1.5) continue;
    if (c.p[1] < lo || c.p[1] > hi) continue;
    const d = Math.hypot(c.p[0] - x, c.p[2] - z);
    if (d > reach) continue;
    const cost = d + i / HZ * 0.2;
    if (!best || cost < best.cost) best = { cost, x: c.p[0], y: c.p[1], z: c.p[2], at: now0 + i / HZ * 1000 };
  }
  return best;
}
/* The touch itself, from where the ball is at contact, by kind: a bump up
   to a partner, a set up to the net, a spike down where we look, a free
   ball over. `err` -1..1 off the timing (and skill, for the NPCs). */
function playTouch(S, b, kind, by, at, look, err = 0, partner = null) {
  const c = ballAt(b, at);
  const p = c.p.slice();
  const side = sideOf(S, p[2]), co = C(S), n = toNet(side);
  let L;
  if (kind === "spike") {
    const f = { x: -Math.sin(look), z: -Math.cos(look) };
    const depth = 3.5 + Math.random() * 2.5;
    const tz = co.net + n * depth, fz = Math.max(0.3, f.z * n);
    const tx = Math.max(co.x0 + 0.4, Math.min(co.x1 - 0.4, p[0] + f.x / fz * Math.abs(tz - p[2]) + err * 1.6));
    const target = [tx, 0, tz + n * Math.abs(err) * 2.5 * (Math.random() < 0.5 ? 1 : -1)];
    L = solveDrive(courtWorld(S), p, target, VBG.spikeSpeed * (1 - 0.15 * Math.abs(err)), [n * 30, 0, 0], at);
  } else if (kind === "set" || kind === "bump") {
    // to the partner (or the middle of the net if there isn't one), up high
    const to = partner || { x: co.x, z: co.net - n * -1.2 };
    const goal = kind === "set" ? [to.x + err * 0.8, 3.1, co.net - n * 0.9] : [to.x + err * 1.2, 2.6, to.z + err * 1.2];
    const [vx, vy, vz] = arcTo(p, goal, kind === "set" ? 1.6 : 2.4);
    L = makeLaunch(p, [vx, vy, vz], [0, 0, 0], at);
  } else {
    // a free ball over: high, deep in their court
    const target = [co.x + (Math.random() - 0.5) * 4, 0, co.net + n * 5];
    L = solveDrive(courtWorld(S), p, target, 11, [0, 0, 0], at, true);
  }
  touch(b.id, makeLaunch(L.p, L.v, L.w, at, by), { by: by === myId() ? undefined : by, kind });
}

/* ------------------------------------------------------------ serving */

function tossBall(S, id, by, pos, yaw) {
  const f = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const p = [pos.x + f.x * 0.4, (pos.y || 0) + 1.6, pos.z + f.z * 0.4];
  touch(id, makeLaunch(p, [0, VBG.tossV, 0], [0, 0, 0], roomNow(), by), { toss: true, by: by === myId() ? undefined : by });
}
function serveHit(S, b, by, yaw, err = 0) {
  const c = ballAt(b, roomNow());
  const p = c.p.slice(), side = sideOf(S, p[2]), co = C(S), n = toNet(side);
  const f = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const tz = co.net + n * (4.5 + Math.random() * 2), fz = Math.max(0.3, f.z * n);
  const tx = Math.max(co.x0 + 0.5, Math.min(co.x1 - 0.5, p[0] + f.x / fz * Math.abs(tz - p[2])));
  const target = [tx + err * 1.5, 0, tz + n * err * 2];
  const L = solveDrive(courtWorld(S), p, target, VBG.serveSpeed * (1 - 0.1 * Math.abs(err)), [0, 0, 0], roomNow());
  touch(b.id, makeLaunch(L.p, L.v, L.w, roomNow(), by), { by: by === myId() ? undefined : by, kind: "serve" });
}

/* ---------------------------------------------------------- each frame */

let fireWas = false, jumpWas = false;
export const vballView = () => game.isSocial() && V.inGame;
export function updateVball(dt) {
  const S = spots();
  if (!S) { for (const id of [...vballs.keys()]) dropVBall(id); V.inGame = false; cardHud(null); return; }
  const now = roomNow();
  const gp = game.gamepadState?.connected;
  const fire = !game.localPauseOnly && ((game.isTouch && touchState.firing) || (gp && game.gamepadState.firing) || game.mouseDown);
  const jump = (game.isTouch && touchState.jump) || (gp && game.gamepadState.jump) || game.keys.has("Space");
  const s = VM.s;
  V.inGame = !!(s && s.teams.flat().includes(myId()) && s.phase !== "done" && s.phase !== "wait");
  if (V.inGame && game.player.alive) {
    const press = fire && !fireWas;
    const myServe = s.phase === "serve" && s.server === myId();
    const side = sideOf(S, game.move.pos.z);
    if (press && !V.swing) {
      const tb = V.toss && vballs.get(V.toss);
      if (tb?.sim && !tb.sim.rest && tb.toss) {
        V.swing = { serve: true, ball: V.toss, at: now + 80, done: false };
        setClip("vb-serve", now + 80 - CONTACT["vb-serve"] * 1000);
      } else if (myServe) {
        V.toss = `${s.id}-r${s.rally}`;
        tossBall(S, V.toss, myId(), game.move.pos, game.look.yaw);
        setClip("vb-serve", now - 220);
      } else {
        const b = [...vballs.values()].find((x) => x.sim && !x.sim.rest && !x.toss && x.match);
        const nearNet = Math.abs(game.move.pos.z - C(S).net) < 2.6;
        const kind = jump && nearNet ? "spike" : null;
        let cp = b && contactPoint(S, b, game.move.pos.x, game.move.pos.z, side, kind || "bump");
        let k = kind || "bump";
        if (b && !cp && !kind) { cp = contactPoint(S, b, game.move.pos.x, game.move.pos.z, side, "set"); k = "set"; }
        if (b && b.sideTouches >= 2 && b.lastSide === side && k !== "spike") k = "over";
        if (cp) {
          const lead = (cp.at - now) / 1000;
          V.swing = { ball: b.id, launch: b.sim.launch.at, at: cp.at, lead, kind: k, done: false };
          setClip(k === "spike" ? "vb-spike" : k === "set" ? "vb-set" : "vb-bump", cp.at - CONTACT[k === "spike" ? "vb-spike" : k === "set" ? "vb-set" : "vb-bump"] * 1000);
        } else if (jump && nearNet) { V.swing = { block: true, at: now + 300, done: false }; setClip("vb-block"); }
        else { V.swing = { at: now + 250, done: false }; setClip("vb-bump"); }
      }
    }
    const sw = V.swing;
    if (sw && !sw.done && now >= sw.at) {
      sw.done = true;
      const b = vballs.get(sw.ball);
      if (sw.serve && b?.sim) { serveHit(S, b, myId(), game.look.yaw); V.toss = null; }
      else if (b?.sim && b.sim.launch.at === sw.launch) {
        const c = ballAt(b, sw.at);
        if (Math.hypot(c.p[0] - game.move.pos.x, c.p[2] - game.move.pos.z) < VBG.reach + 0.6) {
          const [l0, l1] = VBG.lead;
          const err = sw.lead < l0 ? (l0 - sw.lead) / 0.2 : sw.lead > l1 ? -(sw.lead - l1) / 0.4 : 0;
          V.flash = { word: Math.abs(err) < 0.01 ? "NICE" : err > 0 ? "LATE" : "EARLY", t: 0 };
          const mate = s.teams[s.teams.findIndex((t) => t.includes(myId()))].find((id) => id !== myId());
          playTouch(S, b, sw.kind, myId(), sw.at, game.look.yaw, Math.max(-1, Math.min(1, err)), mate ? posOf(mate) : null);
        }
      }
      if (sw.block) tryBlock(S);
    }
    if (sw && now > sw.at + 500) { V.swing = null; setClip("vb-ready"); }
  }
  fireWas = fire; jumpWas = jump;

  for (const b of [...vballs.values()]) {
    if (!b.sim) continue;
    const evs = advanceBall(b.sim, now);
    for (const e of evs) {
      if (e.kind === "bounce") courtSound("bounce", { x: e.p[0], y: e.p[1], z: e.p[2] }, e.speed / 10);
      else if (e.kind === "net" || e.kind === "cord") courtSound("net", { x: e.p[0], y: e.p[1], z: e.p[2] }, 0.8);
      judge(S, b, e);
    }
    if (b.mesh) b.mesh.position.set(b.sim.p[0], b.sim.p[1], b.sim.p[2]);
  }
  if (s?.host === myId()) hostFrame(S, s, dt);
  if (s) playerFrame(S, s);
  if (game.net) { game.net.vballClip = V.inGame ? VB_CLIPS.indexOf(V.clip) + 1 : 0; game.net.vballAt = V.clipAt; }
  if (V.flash) V.flash.t += dt;
  cardHud(s && s.phase !== "wait" ? s : null);
}
/* A block: their spike just off the hand, at ours over the net. */
function tryBlock(S) {
  const rig = game.localRig;
  const hand = rig?.parts?.handR;
  if (!hand) return;
  hand.updateWorldMatrix(true, false);
  const hp = new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld);
  for (const b of vballs.values()) {
    if (!b.sim || b.sim.rest || b.hitter === myId() || b.kind !== "spike" || roomNow() - b.sim.launch.at > 450) continue;
    const p = b.sim.p;
    if (Math.hypot(p[0] - hp.x, p[1] - hp.y, p[2] - hp.z) > 0.6) continue;
    const n = toNet(sideOf(S, game.move.pos.z));
    touch(b.id, makeLaunch(p.slice(), [b.sim.v[0] * -0.2, -2.5, n * 3.5], [0, 0, 0], roomNow(), myId()), { kind: "block" });
    showWaveBanner("STUFFED", 900);
    return;
  }
}

/* ------------------------------------------------------------- posing */

localPosers.push((rig) => {
  if (!game.isSocial() || !V.inGame) return;
  const t = (roomNow() - V.clipAt) / 1000;
  if (!poseVb(rig, V.clip, Math.max(0, t), V.clip !== "vb-ready" || !game.move.moving)) return;
  rig.root.updateMatrixWorld(true);
  rig.body?.update?.();
});
peerPosers.push((rp) => {
  if (!game.isSocial() || !spots()) return;
  const p = rp.peer;
  if (!(p?.vballClip > 0)) return;
  const name = VB_CLIPS[(p.vballClip | 0) - 1] || "vb-ready";
  if (!poseVb(rp.rig, name, (roomNow() - (+p.vballAt || 0)) / 1000, name !== "vb-ready")) return;
  rp.rig.root.updateMatrixWorld(true);
  rp.rig.body?.update?.();
});

/* ------------------------------------------------------------ the match */

const clean = (n) => String(n || "").replace(/[^\p{L}\p{N} _.'-]/gu, "").trim().slice(0, 16);
const nameOf = (id) => clean(isNpc(id) ? game.townNpcs?.list?.[npcIndex(id)]?.c.name : id === myId() ? game.net?.name || "You" : game.net?.peers?.get(id)?.name || "Player") || "Player";
const skillOf = (id) => game.townNpcs?.list?.[npcIndex(id)]?.c.vball?.skill ?? 0.6;
function posOf(id) {
  if (id === myId()) return { x: game.move.pos.x, z: game.move.pos.z };
  if (isNpc(id)) { const b = brains.get(id) || shown.get(id); if (b) return { x: b.x, z: b.z }; const n = game.townNpcs?.list?.[npcIndex(id)]; return n ? { x: n.x, z: n.z } : null; }
  const r = game.remotes?.byId?.get(id);
  return r ? { x: r.pos.x, z: r.pos.z } : null;
}
const teamOf = (s, id) => (s.teams[0].includes(id) ? 0 : s.teams[1].includes(id) ? 1 : -1);
function spotNear(S) { const r = S.vball.rack; return Math.hypot(r.x - game.move.pos.x, r.z - game.move.pos.z) < VBG.spot; }
function vbAction() {
  const S = spots();
  if (!S || !game.player.alive || seated || !spotNear(S)) return null;
  const s = VM.s;
  if (s && s.phase === "wait" && s.host !== myId() && !s.teams.flat().includes(myId())) return { key: "vb:join", label: `Play volleyball with ${nameOf(s.host)}`, ctx: "Join", time: 0.4, done: () => sendG({ e: "join", g: s.id }) };
  if (s && s.phase !== "done") return { key: "vb:on", info: true, label: s.teams.flat().includes(myId()) ? "You're in the game" : "Game on: next" };
  return { key: "vb:play", label: "Play beach volleyball: 2v2 to 15", ctx: "Play", time: 0.6, done: () => startVb(S) };
}
function startVb(S) {
  const id = `${myId()}-v${++V.seq}`;
  VM.s = { id, host: myId(), teams: [[myId()], []], joiners: [], names: {}, score: [0, 0], server: null, serveTeam: 0, rally: 0, phase: "wait", waitUntil: roomNow() + VBG.wait * 1000, seq: 0, winner: -1 };
  publishG(true);
  showWaveBanner("Anyone at the ball in the next 4 s plays", 2400);
}
function publishG(force = false) {
  const s = VM.s;
  if (!s || s.host !== myId()) return;
  const now = performance.now();
  if (!force && now - VM.sentAt < 2000) return;
  VM.sentAt = now;
  sendG({ e: "s", g: s });
  drawGame(s);
}
function formTeams(s) {
  const humans = [s.host, ...s.joiners].slice(0, 4);
  const npcs = (game.townNpcs?.list || []).map((n, i) => ({ id: `npc${i}`, n })).filter((x) => x.n.c.vball && !x.n.off).map((x) => x.id);
  const a = [], b = [];
  humans.forEach((h, i) => (i % 2 ? b : a).push(h));
  while (a.length < 2 && npcs.length) a.push(npcs.shift());
  while (b.length < 2 && npcs.length) b.push(npcs.shift());
  s.teams = [a, b];
  for (const id of s.teams.flat()) s.names[id] = nameOf(id);
}
/* Places for a serve: the server behind the end line, his partner up at
   the net; the other side spread to pass. */
function places(S, s) {
  const co = C(S), out = {};
  s.teams.forEach((team, side) => {
    const n = toNet(side), end = side === 0 ? co.z1 : co.z0;
    team.forEach((id, k) => {
      const serving = id === s.server;
      const x = co.x + (k === 0 ? -1.6 : 1.6);
      out[id] = serving ? { x: co.x + 1.2, z: end - n * 0.8, yaw: side === 0 ? 0 : Math.PI }
        : side === s.serveTeam ? { x, z: co.net - n * 1.6, yaw: side === 0 ? 0 : Math.PI }
          : { x, z: end + n * 2.5, yaw: side === 0 ? 0 : Math.PI };
    });
  });
  return out;
}
function nextRally(S, s) {
  const team = s.teams[s.serveTeam];
  // the serve goes round the team: whoever didn't serve last time on our side
  s.server = team[(s.serveCount?.[s.serveTeam] ?? 0) % team.length];
  s.phase = "serve"; s.seq++; s.rally++;
  VM.pending.length = 0;
  const P = places(S, s);
  for (const id of s.teams.flat()) if (isNpc(id)) { const b = brain(id); Object.assign(b, P[id]); b.plan = null; b.tossId = null; b.serveT = 0; b.clip = "vb-ready"; b.clipAt = roomNow(); }
  publishG(true);
}
function hostFrame(S, s, dt) {
  const now = roomNow();
  if (s.phase === "wait") {
    if (now < s.waitUntil) return publishG();
    formTeams(s);
    if (!s.teams[0].length || !s.teams[1].length) { VM.s = null; showWaveBanner("Not enough players", 1500); return; }
    for (const id of s.teams.flat()) if (isNpc(id)) takeNpc(id);
    s.serveCount = [0, 0];
    s.serveTeam = Math.random() < 0.5 ? 0 : 1;
    showWaveBanner(`${teamName(s, 0)} vs ${teamName(s, 1)}: to ${VBG.to}, win by 2`, 2600);
    nextRally(S, s);
    return;
  }
  if (s.phase === "over") { if (now >= s.overAt) endVb(s); return publishG(); }
  for (let i = VM.pending.length - 1; i >= 0; i--) {
    const c = VM.pending[i];
    if (now - c.at >= VBG.grace) { VM.pending.splice(i, 1); point(S, s, c.to, c.call); }
  }
  for (const id of s.teams.flat()) if (isNpc(id)) npcThink(S, s, id, dt);
  streamNpcs(s);
  publishG();
}
const teamName = (s, t) => s.teams[t].map((id) => s.names[id] || nameOf(id)).join(" & ");
function point(S, s, to, call) {
  if (s.phase !== "rally" && s.phase !== "serve") return;
  s.score[to]++;
  showWaveBanner(`${call}  ${s.score[0]}-${s.score[1]}`, 1300);
  const a = s.score[to], b = s.score[1 - to];
  if (a >= VBG.to && a - b >= VBG.by) { s.phase = "over"; s.winner = to; s.overAt = roomNow() + 6000; publishG(true); return; }
  // side out: the serve changes hands round the team
  if (to !== s.serveTeam) { s.serveCount[to] = (s.serveCount[to] || 0) + 1; s.serveTeam = to; }
  s.phase = "point";
  publishG(true);
  setTimeout(() => { if (VM.s === s && s.phase === "point") nextRally(S, s); }, 1500);
}
function endVb(s) {
  s.phase = "done";
  for (const id of s.teams.flat()) if (isNpc(id)) releaseNpc(id);
  publishG(true);
  VM.s = null;
}
/* The judge: a touch starts a new flight; three a side; down in a court
   is that side's loss; out is the last toucher's. */
function onTouch(b, kind) {
  const s = VM.s, S = spots();
  if (!s || !S) return;
  if (b.id.startsWith(s.id)) b.match = true;
  if (!b.match || b.toss) return;
  b.kind = kind;
  const side = s.teams[0].includes(b.hitter) ? 0 : s.teams[1].includes(b.hitter) ? 1 : sideOf(S, b.sim.launch.p[2]);
  b.sideTouches = b.lastSide === side ? (b.sideTouches || 0) + 1 : 1;
  b.lastSide = side;
  VM.pending = VM.pending.filter((c) => c.at < b.sim.launch.at);
  if (s.host === myId() && s.phase === "serve" && kind === "serve") { s.phase = "rally"; publishG(true); }
  if (s.host === myId() && b.sideTouches > 3) VM.pending.push({ to: 1 - side, call: "FOUR HITS", at: b.sim.launch.at });
}
function judge(S, b, e) {
  const s = VM.s;
  if (!s || s.host !== myId() || !b.match || b.toss || s.phase !== "rally") return;
  if (e.kind !== "bounce" && e.kind !== "dead") return;
  const at = b.sim.launch.at + e.n / HZ * 1000;
  if (VM.pending.some((c) => c.launch === b.sim.launch.at)) return;
  const last = b.lastSide ?? 0;
  const where = sideOf(S, e.p[2]);
  let to, call;
  if (e.kind === "dead" || !inCourt(S, e.p[0], e.p[2])) { to = 1 - last; call = "OUT"; }
  else { to = 1 - where; call = where === last ? "DOWN ON OUR SIDE" : "KILL"; }
  VM.pending.push({ to, call, at, launch: b.sim.launch.at });
}
function playerFrame(S, s) {
  if (!s.teams.flat().includes(myId()) || s.phase !== "serve" || VM.seqSeen === s.seq) return;
  VM.seqSeen = s.seq;
  const P = places(S, s)[myId()];
  if (P) { game.move.reset(P.x, P.z, 0.02); game.look.yaw = P.yaw; game.look.pitch = 0; }
  V.toss = null; V.swing = null; setClip("vb-ready");
  if (s.server === myId()) showWaveBanner("Your serve: fire to toss, fire at the top", 1400);
}

/* ------------------------------------------------------------ the NPCs */

function brain(id) {
  let b = brains.get(id);
  if (!b) { const n = game.townNpcs.list[npcIndex(id)]; b = { id, x: n.x, z: n.z, yaw: n.yaw, clip: "vb-ready", clipAt: roomNow(), moving: false, plan: null, serveT: 0 }; brains.set(id, b); }
  return b;
}
function takeNpc(id) { const N = game.townNpcs, i = npcIndex(id); if (N?.list?.[i] && !N.list[i].override) N.takeOver(i, (n, rig, dt) => poseNpc(id, n, rig, dt)); }
function releaseNpc(id) { brains.delete(id); shown.delete(id); game.townNpcs?.release?.(npcIndex(id)); }
function poseNpc(id, n, rig, dt) {
  const b = brains.get(id) || shown.get(id);
  if (!b) return;
  if (!brains.has(id)) { const k = Math.min(1, dt * 12); b.sx = (b.sx ?? b.x) + (b.x - (b.sx ?? b.x)) * k; b.sz = (b.sz ?? b.z) + (b.z - (b.sz ?? b.z)) * k; n.x = b.sx; n.z = b.sz; }
  else { n.x = b.x; n.z = b.z; }
  n.yaw = b.yaw; n.moving = !!b.moving;
  const t = (roomNow() - b.clipAt) / 1000;
  if (poseVb(rig, b.clip, Math.max(0, t), b.clip !== "vb-ready" || !b.moving)) {
    rig.root.position.y = (n.c.y ?? 0) + (b.y || 0);
    rig.root.updateMatrixWorld(true); rig.body?.update?.();
  }
}
function streamNpcs(s) {
  const now = performance.now();
  if (now - VM.npcSent < 100) return;
  VM.npcSent = now;
  const n = [];
  for (const id of s.teams.flat()) { if (!isNpc(id)) continue; const b = brains.get(id); if (b) n.push([npcIndex(id), +b.x.toFixed(2), +b.z.toFixed(2), +b.yaw.toFixed(2), VB_CLIPS.indexOf(b.clip) + 1, b.clipAt, b.moving ? 1 : 0, +(b.y || 0).toFixed(2)]); }
  if (n.length) sendG({ e: "n", g: s.id, n });
}
/* An NPC's rally: the one nearer where it'll come down takes it: first
   touch a pass to the partner, second a set to the net, third a hit; a
   serve when it's his; up at the net to block their hitter. */
function npcThink(S, s, id, dt) {
  const b = brain(id), side = teamOf(s, id), skill = skillOf(id), co = C(S), n = toNet(side);
  const now = roomNow();
  b.y = Math.max(0, (b.y || 0) + (b.vy || 0) * dt); b.vy = b.y > 0 ? (b.vy || 0) - 9.81 * 0.75 * dt : 0;
  if (s.phase === "serve" && s.server === id) {
    b.serveT += dt;
    if (b.serveT > 1.3 && !b.tossId) { b.tossId = `${s.id}-r${s.rally}`; tossBall(S, b.tossId, id, { x: b.x, y: 0, z: b.z }, b.yaw); b.clip = "vb-serve"; b.clipAt = now - 220; b.hitAt = now + (VBG.tossV / 9.81) * 1000 * 0.95; }
    if (b.tossId && now >= b.hitAt) { const ball = vballs.get(b.tossId); if (ball?.sim) serveHit(S, ball, id, b.yaw + (Math.random() - 0.5) * 0.4, VM.calm ? 0 : (Math.random() - 0.5) * (1 - skill) * 1.6); b.tossId = null; b.serveT = -99; }
    return;
  }
  if (s.phase !== "rally") { b.moving = false; if (s.phase === "serve") { b.serveT = 0; b.tossId = null; } return; }
  const ball = [...vballs.values()].find((x) => x.match && x.sim && !x.sim.rest && !x.toss);
  if (!ball) return;
  const mine = ball.hitter !== id && (ball.lastSide !== side || (ball.sideTouches || 0) < 3);
  const mate = s.teams[side].find((x) => x !== id);
  // where will it come down on our side? (the nearer of us goes)
  if (mine && (!b.plan || b.plan.launch !== ball.sim.launch.at)) {
    const touches = ball.lastSide === side ? ball.sideTouches || 0 : 0;
    const kind = touches === 0 ? "bump" : touches === 1 ? "set" : "spike";
    const nearNet = kind === "spike";
    const cpMe = contactPoint(S, ball, b.x, b.z, side, kind === "spike" ? "spike" : kind === "set" ? "set" : "bump");
    // a wider look: anywhere it'll be at the touch's height, then who's nearer
    const land = contactPoint(S, ball, b.x, b.z, side, kind) || predictSpot(S, ball, side, kind);
    const mp = mate && posOf(mate);
    const mineToGo = land && (!mp || Math.hypot(land.x - b.x, land.z - b.z) <= Math.hypot(land.x - mp.x, land.z - mp.z) + (ball.hitter === mate ? 99 : 0)) && ball.hitter !== id;
    b.plan = { launch: ball.sim.launch.at, ball: ball.id, kind, spot: mineToGo ? (cpMe || land) : null, hit: false, nearNet };
  }
  const plan = b.plan;
  if (plan?.spot && !plan.hit) {
    walkTo(b, plan.spot.x, plan.spot.z, 5 + 2 * skill, dt);
    b.yaw = side === 0 ? 0 : Math.PI;
    const clip = plan.kind === "spike" ? "vb-spike" : plan.kind === "set" ? "vb-set" : "vb-bump";
    if (now >= plan.spot.at - CONTACT[clip] * 1000 && b.clip !== clip) { b.clip = clip; b.clipAt = plan.spot.at - CONTACT[clip] * 1000; if (plan.kind === "spike") b.vy = 3.6; }
    if (now >= plan.spot.at) {
      plan.hit = true;
      const c = ballAt(ball, now);
      if (Math.hypot(c.p[0] - b.x, c.p[2] - b.z) < VBG.reach + 0.8) {
        const err = VM.calm ? 0 : (Math.random() - 0.5) * 2 * (1 - skill) * 0.9;
        const look = side === 0 ? 0 : Math.PI;
        playTouch(S, ball, plan.kind, id, now, look + (Math.random() - 0.5) * 0.6, err, mate ? posOf(mate) : null);
      }
    }
    return;
  }
  // their hitter at the net: up to block (the one nearer the net)
  if (ball.lastSide !== side && ball.sideTouches === 2 && Math.abs(b.z - co.net) < 2.5 && b.y === 0 && Math.random() < dt * 2 * skill) {
    b.vy = 3.4; b.clip = "vb-block"; b.clipAt = now;
  }
  // otherwise: one up at the net, one back
  const front = s.teams[side][0] === id;
  walkTo(b, co.x + (front ? -0.8 : 1.2), co.net - n * (front ? 1.2 : 4.2), 3.5, dt);
  if (b.clip !== "vb-ready" && now - b.clipAt > 1000) { b.clip = "vb-ready"; b.clipAt = now; }
}
function predictSpot(S, ball, side, kind) {
  const c = newBall(ball.sim.world, ball.sim.launch);
  for (let i = 0; i < ball.sim.n && !c.rest; i++) stepBall(c);
  const now0 = ball.sim.launch.at + ball.sim.n / HZ * 1000;
  const h = kind === "set" ? 2.1 : kind === "spike" ? 2.8 : 1.0;
  for (let i = 1; i < HZ * 2 && !c.rest; i++) {
    stepBall(c);
    if (c.v[1] < 0 && c.p[1] < h && sideOf(S, c.p[2]) === side) return { x: c.p[0], y: c.p[1], z: c.p[2], at: now0 + i / HZ * 1000 };
  }
  return null;
}
function walkTo(b, x, z, speed, dt) {
  const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz);
  if (d < 0.1) { b.moving = false; return; }
  const k = Math.min(d, speed * dt);
  b.x += dx / d * k; b.z += dz / d * k; b.moving = true;
}

/* ------------------------------------------------------------- the wire */

rpListeners.push((p, m) => {
  if (m.k === "vb" && m.e === "hit" && typeof m.id === "string") {
    const S = spots(), L = m.L;
    if (!S || !L || !Array.isArray(L.p) || !Array.isArray(L.v) || !Array.isArray(L.w)) return;
    const b = ballFor(m.id.slice(0, 48));
    b.sim = newBall(courtWorld(S), makeLaunch(L.p.map(Number), L.v.map(Number), L.w.map(Number), +L.at || roomNow(), String(m.by || L.by || p.id)));
    b.hitter = isNpc(m.by) ? m.by : p.id; b.toss = !!m.toss; b.sentAt = performance.now();
    onTouch(b, String(m.kind || ""));
    if (!m.toss) courtSound("vball", { x: L.p[0], y: L.p[1], z: L.p[2] }, m.kind === "spike" ? 1 : 0.6);
    return;
  }
  if (m.k !== "vg") return;
  if (m.e === "s" && m.g && typeof m.g.id === "string" && Array.isArray(m.g.teams)) {
    if (VM.s && VM.s.host === myId() && VM.s.id !== m.g.id && VM.s.phase !== "done") return;
    const was = VM.s;
    VM.s = m.g;
    for (const id of m.g.teams.flat()) if (isNpc(id) && !shown.has(id) && !brains.has(id)) { shown.set(id, { x: 0, z: 0, yaw: 0, clip: "vb-ready", clipAt: roomNow() }); takeNpc(id); }
    if (m.g.phase === "done") { for (const id of [...shown.keys()]) releaseNpc(id); VM.s = null; }
    if (m.g.phase === "over" && was?.phase !== "over") showWaveBanner(`${teamName(m.g, m.g.winner)} win ${m.g.score[m.g.winner]}-${m.g.score[1 - m.g.winner]}`, 3000);
    drawGame(m.g);
  } else if (m.e === "join" && VM.s && VM.s.host === myId() && VM.s.id === m.g && VM.s.phase === "wait") {
    if (!VM.s.joiners.includes(p.id) && VM.s.joiners.length < 3) { VM.s.joiners.push(p.id); publishG(true); showWaveBanner(`${nameOf(p.id)} is in`, 1200); }
  } else if (m.e === "n" && VM.s && m.g === VM.s.id && Array.isArray(m.n)) {
    for (const r of m.n) {
      const id = `npc${r[0] | 0}`;
      const b = shown.get(id) || {};
      Object.assign(b, { x: +r[1], z: +r[2], yaw: +r[3], clip: VB_CLIPS[(r[4] | 0) - 1] || "vb-ready", clipAt: +r[5] || roomNow(), moving: !!r[6], y: +r[7] || 0 });
      shown.set(id, b);
      if (!game.townNpcs?.list?.[r[0] | 0]?.override) takeNpc(id);
    }
  }
});

/* ---------------------------------------------------- the board, the HUD */

function drawGame(s) {
  if (!s) return drawBoard("vball", "VOLLEYBALL", [], "2 v 2 to 15");
  const foot = s.phase === "wait" ? "Hold X at the ball to play" : s.phase === "over" || s.phase === "done" ? `${teamName(s, s.winner)} win` : `To ${VBG.to}, win by 2`;
  drawBoard("vball", "VOLLEYBALL", [[teamName(s, 0), s.score[0]], [teamName(s, 1), s.score[1]]], foot);
}
let cardEl = null;
function cardHud(s) {
  const mine = s && s.phase !== "done" && s.teams.flat().includes(myId());
  if (!mine) { if (cardEl) cardEl.hidden = true; return; }
  if (!cardEl) { cardEl = document.createElement("div"); cardEl.className = "to-hoop-card"; document.body.appendChild(cardEl); }
  cardEl.hidden = false;
  const sv = (t) => (s.serveTeam === t && s.phase !== "over" ? " is-poss" : "");
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const txt = `<span class="to-hoop-card__team${sv(0)}">${esc(teamName(s, 0))}</span><b>${s.score[0]}</b><i>${s.phase === "over" ? "FINAL" : `TO ${VBG.to}`}</i><b>${s.score[1]}</b><span class="to-hoop-card__team${sv(1)}">${esc(teamName(s, 1))}</span>`;
  if (cardEl._t !== txt) { cardEl._t = txt; cardEl.innerHTML = txt; }
}

rpExtras.push(vbAction);

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollVball = {
    VBG, V, VM, vballs, brains, shown, contactPoint, startVb: () => spots() && startVb(spots()),
    point: (to, call) => VM.s && point(spots(), VM.s, to, call),
    tossNow: () => { const S = spots(), s = VM.s; V.toss = `${s.id}-r${s.rally}`; tossBall(S, V.toss, myId(), game.move.pos, game.look.yaw); setClip("vb-serve", roomNow() - 220); return V.toss; },
    serveNow: () => { const S = spots(), b = vballs.get(V.toss); if (b?.sim) serveHit(S, b, myId(), game.look.yaw); V.toss = null; },
    state: () => ({ inGame: V.inGame, clip: V.clip, s: VM.s && { id: VM.s.id, teams: VM.s.teams, score: VM.s.score, server: VM.s.server, serveTeam: VM.s.serveTeam, phase: VM.s.phase, rally: VM.s.rally, winner: VM.s.winner },
      balls: [...vballs.values()].map((b) => ({ id: b.id, hitter: b.hitter, kind: b.kind || null, touches: b.sideTouches || 0, side: b.lastSide ?? null, rest: !!b.sim?.rest, events: b.sim ? b.sim.events.map((e) => e.kind) : [] })),
      npcs: [...brains.entries()].map(([id, b]) => ({ id, x: +b.x.toFixed(2), z: +b.z.toFixed(2), clip: b.clip, plan: b.plan?.spot ? b.plan.kind : null })) }),
  };
}
