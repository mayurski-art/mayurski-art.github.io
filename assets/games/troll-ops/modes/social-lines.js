/* Socialize: the candle lines, v2 (docs/KB-SECURITY-ROOM.md 5; the props and
   the beats in maps/kabukigrin-lines.js, the room in maps/kabukigrin-cctv.js,
   the sounds in sound/lines-sfx.js, the rush after in view/stonks-fx.js).

   Sit in the security room's chair and hold X ("Pull a candle", 0.4 s): the
   next 8.4 s play by themselves, the way the user's concept video goes. Lean
   in to the chart monitor, the right hand goes INTO the screen and pulls the
   tall green candle out (the arm comes out green), it's laid on the desk's
   glass and a bottle rolled over it twice like a rolling pin, the $TROLL
   card chops it and drags it into a line and gets flicked over the
   shoulder, the face goes down on it (no bill: all of it at once), up again
   (STONKS, the rush starts), then straight up through the roof into the sky
   over Kabukigrin, back down behind the desk, two hands on its edge, and
   up over it. Get up, get hurt or die before the face-plant and it stops:
   the powder stays on the glass 20 s and anyone sat there can hold X to
   "Finish the line". A line a minute and a half at most ("Market's closed").

   Everyone sees the same thing: the act goes out as one "line" message
   and every client plays the props and the body from it; your flight is
   your position, sent as ever. Lurk, the security guard, does one now and
   then when the chair's free, started by the room's oldest client. The
   rush itself is local (view/stonks-fx.js); what others see of it (the
   dusted nose, the arrow, the green arm) rides the state packet (`ln`). */

import * as THREE from "three";
import { bar, rpBusy, rpExtras, rpListeners, rpSeats, seated, standUp } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3-jx4-jx5-mb1-mb2-gc1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-tn13-rdf2-kbc3";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h-kbc1-kbc2-kbc3";
import { localPosers } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-tn13-rdf2-kbc3";
import { peerPosers } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-jx2-jx3-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h-kbc1-kbc2-kbc3";
import { poseSeated } from "./rp-roles.js?v=rp1b7-cd1-sh1-dj2-or1-bw2-sp1-mb1-mb2-nft2531-kbc1-kbc2-kbc3";
import { reachHand, setHandPose } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1-pk1-mb1-mb2-nft2531-kbc1-kbc2-kbc3";
import { damp } from "../characters/anim-curves.js?v=or1";
import { game } from "../core/state.js?v=st1";
import { BEATS, ROLLS, CHOPS, DRAG, FLICK, LEFTOVER_SECS, LAND, STONKS_GREEN, lineState, flight } from "../maps/kabukigrin-lines.js?v=cl1-kbc1-kbc2-kbc3";
import { linesSfx } from "../sound/lines-sfx.js?v=cl1-kbc1-kbc2-kbc3";

export const LINES = {
  holdSecs: 0.4,
  cooldownSecs: 90,
  npcEvery: 120,        // Lurk does one about this often
  npcFirst: 45,
  greenSecs: 12,        // the green arm fades over the rush
};
// the test shortens the waits (window.__trollLinesTune)
if (typeof window !== "undefined" && window.__trollLinesTune) Object.assign(LINES, window.__trollLinesTune);

/* Ours. */
export const L = {
  phase: null,     // "line" while we're on one
  tb: 0,
  t0: 0,           // performance.now ms at the hold-X
  cancelAt: null,  // the beat we stopped at
  hp0: 0,
  seat: null,      // the chair, while we're in it
  eye: 0,
  cd: 0,           // ms: when the next line's allowed
  done: 0,         // how many we've snorted (view/stonks-fx.js watches it)
  doneAt: 0,
  stood: false,    // out of the chair for the launch
  rushed: false,   // this line's rush has started
  sfxBeat: -1,
};
export const linesCam = { pitch: 0, yaw: 0, roll: 0 };
const peerActs = new Map();   // peer id -> { t0, cancelAt, sfxBeat }
const npcActs = new Map();    // npc index -> { t0 }
let npcNext = 0;
const nowMs = () => performance.now();
const lines = () => (game.isSocial() ? game.builtMap?.map?.rp?.lines?.() || null : null);
const send = (m) => game.net.publishRp({ k: "line", ...m });
const span = (t, [a, b]) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = (k) => k * k * (3 - 2 * k);
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const FINISH_FROM = DRAG[0];   // "Finish the line" picks up at the drag

function clearStation(T) { Object.assign(T.st, { start: 0, by: null, cancelAt: null, npc: -1 }); }
const stationFree = (T) => !T.st.start;
function leftover(T) {
  const st = T.st;
  if (!st.start || st.cancelAt == null) return false;
  const t = (nowMs() - st.start) / 1000;
  return t > st.cancelAt && t < st.cancelAt + LEFTOVER_SECS;
}
const inChair = () => seated?.s.kind === "chair";
const chairIdx = () => rpSeats()?.findIndex((s) => s.kind === "chair") ?? -1;

/* ------------------------------------------------------------- ours */

function begin(T, { fromBeat = 0 } = {}) {
  L.phase = "line"; L.tb = T.i; L.t0 = nowMs() - fromBeat * 1000; L.cancelAt = null;
  L.hp0 = game.player.hp; L.seat = seated ? seated.s : null; L.sfxBeat = -1; L.stood = false; L.rushed = false;
  L.eye = game.move.eyeHeight;
  if (game.emote) game.stopEmote();
  Object.assign(T.st, { start: L.t0, by: "me", cancelAt: null, npc: -1, cardDown: false });
  send({ e: "s", tb: T.i, at: fromBeat || undefined });
}
function cancel(T) {
  const t = (nowMs() - L.t0) / 1000;
  L.cancelAt = t;
  T.st.cancelAt = t;
  send({ e: "x", tb: T.i, at: Math.round(t * 100) / 100 });
  L.phase = null;
  showWaveBanner("You left it on the glass", 1400);
}
function finish() {
  L.phase = null;
  L.cd = nowMs() + LINES.cooldownSecs * 1000;
}

/* Hold X in the chair. */
rpExtras.push(() => {
  const api = lines();
  if (!api || !game.player.alive || L.phase || !inChair()) return null;
  const T = api.tables[0];
  if (bar.drink) return { key: "ln-hands", info: true, label: "Hands full" };
  if (rpBusy.fists || rpBusy.arm) return null;
  const now = nowMs();
  if (now < L.cd) return { key: "ln-cd", info: true, label: `Market's closed · ${fmt(L.cd - now)}` };
  if (leftover(T)) {
    return { key: "ln-finish", label: "Finish the line", busy: "Leaning in…", ctx: "Line", time: LINES.holdSecs,
      done: () => { T.st.cancelAt = null; begin(T, { fromBeat: FINISH_FROM }); } };
  }
  if (!stationFree(T)) return { key: "ln-busy", info: true, label: T.st.npc >= 0 ? "Wait your turn" : "Someone's on it" };
  return { key: "ln", label: "Pull a candle", busy: "Reaching in…", ctx: "Line", time: LINES.holdSecs,
    done: () => { begin(T); showWaveBanner(game.isTouch ? "Hold still" : "Hold still · move to stop", 1400); } };
});

/* Where we are on the flight and the climb (world): the chair to the
   landing spot behind the desk. */
function flightPos(T, t, out) {
  const f = flight(t);
  const lx = T.seat.x + LAND.dx, lz = T.seat.z + LAND.dz;
  const k = t >= BEATS.land ? 1 : f.k;
  return out.set(T.seat.x + (lx - T.seat.x) * k, T.floor + f.h, T.seat.z + (lz - T.seat.z) * k);
}

/* Every frame (view/player-update.js, Socialize): ours, the room's, Lurk's. */
const _p = new THREE.Vector3(), _e = new THREE.Vector3();
export function updateLines(dt) {
  const api = lines();
  linesCam.pitch = linesCam.yaw = linesCam.roll = 0;
  greenArm(game.streakArms?.userData?.arms?.[0], greenK());
  if (!api) { if (L.phase) L.phase = null; peerActs.clear(); npcActs.clear(); npcNext = 0; return; }
  const now = nowMs();
  const T = api.tables[0];
  if (T.st.start) {
    const t = (now - T.st.start) / 1000;
    const over = T.st.cancelAt != null ? t > T.st.cancelAt + LEFTOVER_SECS : t > BEATS.end + 0.5;
    if (over) { if (T.st.npc >= 0) endNpc(T.st.npc); clearStation(T); }
  }
  for (const [id, a] of peerActs) if ((now - a.t0) / 1000 > BEATS.end + 0.5 || !game.net.peers.has(id)) peerActs.delete(id);
  driveNpcs(api, now);
  if (!L.phase) return;
  const t = (now - L.t0) / 1000;
  const S = lineState(t, null);
  // up to the face-plant: getting up, a hit or dying stops it
  const hurt = game.player.hp < L.hp0 - 0.5;
  if (t < BEATS.plant && ((L.seat && !inChair()) || hurt || !game.player.alive || game.gameState !== "playing")) { cancel(T); return; }
  sfx(t, null);
  // the rush starts as the head comes up (stonks-fx.js watches L.done)
  if (t >= BEATS.snap && !L.rushed) { L.rushed = true; L.done++; L.doneAt = now; }
  const seatEye = T.seat.y - T.floor + 0.74;
  if (t < BEATS.launch) {
    // sat at the desk: the eye leans in, down on the glass for the plant
    const eyeT = seatEye - 0.12 * S.lean - (seatEye - (T.top - T.floor + 0.1)) * S.plant;
    L.eye = damp(L.eye, eyeT, 14, dt);
    game.move.eyeHeight = L.eye;
    aimAt(S, t, api, T, dt);
  } else {
    // out of the chair and up
    if (!L.stood) { L.stood = true; if (inChair()) standUp(); }
    flightPos(T, t, _p);
    game.move.pos.copy(_p);
    game.move.velocity.set(0, 0, 0);
    game.move.moving = false; game.move.sprinting = false;
    const crouch = 0.55, stand = 1.68;
    L.eye = t < BEATS.land ? stand : crouch + (stand - crouch) * S.climb;
    game.move.eyeHeight = L.eye;
    const f = flight(t);
    // up past the ceiling looking up, then down at the city, then the desk's edge
    const up = span(t, [BEATS.launch, BEATS.launch + 0.15]) * (1 - span(t, [BEATS.launch + 0.2, BEATS.launch + 0.4]));
    const down = span(t, [BEATS.launch + 0.25, BEATS.launch + 0.6]) * (1 - span(t, [BEATS.land - 0.3, BEATS.land]));
    const edge = t >= BEATS.land ? (1 - S.climb) : 0;
    linesCam.pitch = 0.9 * up - 1.25 * down + 0.15 * edge - game.look.pitch * Math.max(up, down);
    linesCam.roll = f.h > 0 ? Math.sin(t * 7) * 0.05 * (f.up ? 1 : 0.4) : 0;
  }
  if (t >= BEATS.end) finish();
}

/* The camera: at the chart while the hand goes in, down at the glass for
   the rest, the snap back. */
function aimAt(S, t, api, T, dt) {
  const toChart = ease(span(t, [0, BEATS.down])) * (1 - ease(span(t, [BEATS.pull, BEATS.lay])));
  api.chartPoint(_p);
  _e.copy(game.camera.position);
  const dx = _p.x - _e.x, dy = _p.y - _e.y, dz = _p.z - _e.z;
  const yawC = Math.atan2(-dx, -dz), pitchC = Math.atan2(dy, Math.hypot(dx, dz));
  let dyaw = yawC - game.look.yaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  const glass = ease(span(t, [BEATS.pull, BEATS.lay])) * (1 - ease(span(t, [BEATS.snap, BEATS.launch])));
  // ...and the line on the glass: looked at, not a fixed angle (the eye's height moves)
  api.world(0, 0, 0, 0, _p);
  let dyawL = Math.atan2(-(_p.x - _e.x), -(_p.z - _e.z)) - game.look.yaw;
  while (dyawL > Math.PI) dyawL -= Math.PI * 2;
  while (dyawL < -Math.PI) dyawL += Math.PI * 2;
  const pitchL = Math.atan2(_p.y - _e.y, Math.hypot(_p.x - _e.x, _p.z - _e.z));
  linesCam.yaw = dyaw * toChart + dyawL * glass;
  linesCam.pitch = (pitchC - game.look.pitch) * toChart + (pitchL - game.look.pitch) * glass * (1 - S.plant) + (Math.min(pitchL, -1.2) - game.look.pitch) * S.plant
    + 0.25 * S.snap + (Math.random() - 0.5) * 0.04 * S.snap;
  linesCam.roll = (Math.random() - 0.5) * 0.03 * S.snap;
}

/* The beats' sounds, once each, for a line at `at` (null: ours). */
function sfx(t, at, mem = L) {
  const marks = [[BEATS.down + 0.3, "bloop"], [ROLLS[0][0], "roll"], [(ROLLS[0][0] + ROLLS[0][1]) / 2, "crunch"], [ROLLS[1][0], "roll"], [(ROLLS[1][0] + ROLLS[1][1]) / 2, "crunch"],
    ...CHOPS.map((c) => [c, "chop"]), [DRAG[0], "scrape"], [FLICK[0], "flick"], [BEATS.plant + 0.1, "sniff"], [BEATS.snap, "snap"], [BEATS.launch, "whoosh"], [BEATS.land, "thud"]];
  marks.forEach(([when, what], i) => {
    if (t >= when && (mem.sfxBeat ?? -1) < i) { mem.sfxBeat = i; linesSfx[what]?.(at); }
  });
}

/* ------------------------------------------------------------- the body

   In the chair (poseSeated): leaning in, the right hand into the chart and
   out with the candle, both hands on the bottle, the card, the face down on
   the glass and up. Then (our own body and a peer's are where their
   position says; Lurk's is put there) straight up with the arms overhead,
   back down crouched behind the desk, hands on its edge, up over it. */
const _c = new THREE.Vector3(), _pole = new THREE.Vector3(), _q = new THREE.Quaternion();
function hand(rig, side, world, pole, pose) {
  _c.copy(world);
  rig.parts.chest.worldToLocal(_c);
  reachHand(rig, side, _c, _pole.set(...pole));
  setHandPose(rig, side, pose);
}
function poseLiner(rig, api, T, t, cancelAt, npc = null) {
  const S = lineState(t, cancelAt);
  const p = rig.parts, k = rig.scale || 1;
  if (npc) {
    // Lurk: put where the act has him (a player's body is already there)
    if (t < BEATS.launch) rig.root.position.set(T.seat.x, T.floor, T.seat.z);
    else flightPos(T, t, rig.root.position);
    rig.root.rotation.set(0, 0, 0);
  }
  if (t < BEATS.launch) {
    poseSeated(rig, npc ? T.seat.y : rig.root.position.y + (T.seat.y - T.floor));
    p.torso.rotation.x = -0.32 * S.lean - 0.95 * S.plant;
    p.torso.rotation.y = 0.35 * S.reach;
    p.headPivot.rotation.x = -0.25 * S.lean - 0.55 * S.plant + 0.7 * S.snap;
    rig.root.updateMatrixWorld(true);
    // the right hand: into the chart, out with the candle, the bottle's end, the card, flat by the line
    const B = S.bottle;
    if (S.reach > 0.01 || S.candle === "hand") {
      api.chartPoint(_e);
      if (S.candle === "hand") api.world(0, 0, 0.06, 0, _p).lerpVectors(_e, _p, S.pull);
      else _p.copy(_e).add(new THREE.Vector3(Math.sin(api.cctv.chart.ry), 0, Math.cos(api.cctv.chart.ry)).multiplyScalar(0.05 - 0.1 * S.reach));
      hand(rig, 1, _p, [0.6, -0.4, -0.5], S.candle === "hand" ? "fist" : "open");
    } else if (B.mode === "roll") hand(rig, 1, api.world(0, 0.11, 0.06, B.z, _p), [0.6, -0.4, -0.5], "open");
    else if (S.card.on) hand(rig, 1, api.world(0, S.card.x, S.card.y + 0.015, S.card.z, _p), [0.6, -0.4, -0.5], "fist");
    else if (S.card.fly >= 0 && S.card.fly < 1) { _p.set(0.3 * k, 0.4 * k, 0.15 * k); p.chest.localToWorld(_p); hand(rig, 1, _p, [0.6, -0.2, 0.3], "open"); }
    else hand(rig, 1, api.world(0, 0.26, 0.01, 0.12, _p), [0.6, -0.4, -0.5], "open");
    // the left: the desk's edge, the bottle's other end, flat by the line for the plant
    if (B.mode === "roll") hand(rig, -1, api.world(0, -0.11, 0.06, B.z, _p), [-0.6, -0.4, -0.5], "open");
    else hand(rig, -1, api.world(0, -0.26 - 0.04 * S.plant, 0.01, 0.12, _p), [-0.7, -0.3, -0.4], "open");
  } else if (t < BEATS.land) {
    // flying: straight as a rod, arms up over the head (down, they flail)
    const f = flight(t);
    for (const side of [-1, 1]) {
      _p.set(side * (f.up ? 0.12 : 0.45) * k, (f.up ? 0.85 : 0.3) * k, (f.up ? -0.05 : -0.15) * k);
      p.chest.localToWorld(_p);
      hand(rig, side, _p, [side * 0.6, 0, 0.4], f.up ? "fist" : "open");
    }
    rig.root.rotation.y = t * 4;
  } else {
    // behind the desk: crouched low, both hands on its edge, up over it
    const crouchY = (npc ? T.floor : rig.root.position.y) + 0.3 + 0.45 * S.climb;
    if (S.climb < 0.98) poseSeated(rig, crouchY, 0.4 * (1 - S.climb));
    p.torso.rotation.x = -0.3 * (1 - S.climb);
    rig.root.updateMatrixWorld(true);
    for (const side of [-1, 1]) {
      const reachK = span(t, [BEATS.land, BEATS.grab]);
      api.world(0, side * 0.3, 0.012, 0.18, _p);
      _p.y -= (1 - reachK) * 0.2;
      hand(rig, side, _p, [side * 0.6, -0.4, -0.4], reachK >= 1 ? "fist" : "open");
    }
  }
  rig.body?.update?.();
}

localPosers.push((rig) => {
  const api = lines();
  dust(rig, game.net.lineFx | 0);
  greenArm(rig.parts?.elbowR, greenK());
  if (!api || !L.phase) return;
  poseLiner(rig, api, api.tables[0], (nowMs() - L.t0) / 1000, L.cancelAt);
});
peerPosers.push((rp) => {
  const api = lines();
  if (!api || !rp.peer) return;
  const fx = rp.peer.lineFx | 0;
  dust(rp.rig, fx);
  const a = peerActs.get(rp.peer.id);
  const t = a ? (nowMs() - a.t0) / 1000 : -1;
  greenArm(rp.rig.parts?.elbowR, a && t >= BEATS.reach ? 1 : fx === 1 ? 0.6 : 0);
  if (!a) return;
  poseLiner(rp.rig, api, api.tables[0], t, a.cancelAt);
  sfx(t, { x: api.tables[0].x, y: api.tables[0].top, z: api.tables[0].z }, a);
});

/* The rush seen from outside: green dust on the nose, a little green arrow
   over the head (red, hanging, for the rug pull). */
let DUST_MAT = null, ARROW_MATS = null;
function dustMats() {
  if (DUST_MAT) return;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const rg = g.createRadialGradient(32, 34, 0, 32, 34, 30);
  rg.addColorStop(0, "rgba(90,255,140,0.95)"); rg.addColorStop(0.5, "rgba(50,220,100,0.6)"); rg.addColorStop(1, "rgba(31,211,90,0)");
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(200,255,210,${0.3 + Math.random() * 0.6})`; g.fillRect(14 + Math.random() * 36, 18 + Math.random() * 30, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  DUST_MAT = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false });
  const arrow = (up) => {
    const a = document.createElement("canvas"); a.width = 128; a.height = 128;
    const h = a.getContext("2d");
    h.fillStyle = up ? "#1fd35a" : "#ff3b3b";
    h.beginPath();
    if (up) { h.moveTo(64, 10); h.lineTo(118, 70); h.lineTo(86, 70); h.lineTo(86, 118); h.lineTo(42, 118); h.lineTo(42, 70); h.lineTo(10, 70); }
    else { h.moveTo(64, 118); h.lineTo(118, 58); h.lineTo(86, 58); h.lineTo(86, 10); h.lineTo(42, 10); h.lineTo(42, 58); h.lineTo(10, 58); }
    h.closePath(); h.fill();
    h.lineWidth = 6; h.strokeStyle = "rgba(0,0,0,0.6)"; h.stroke();
    const tt = new THREE.CanvasTexture(a); tt.colorSpace = THREE.SRGBColorSpace;
    return new THREE.SpriteMaterial({ map: tt, transparent: true, depthWrite: false, toneMapped: false });
  };
  ARROW_MATS = [arrow(true), arrow(false)];
}
function dust(rig, fx) {
  if (!fx && !rig.lineDust) return;
  dustMats();
  if (!rig.lineDust) {
    const k = rig.scale || 1;
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.09 * k, 0.06 * k), DUST_MAT);
    d.position.set(0.0, -0.01 * k, 0.006);
    d.renderOrder = 2;
    rig.parts.head.add(d);
    const s = new THREE.Sprite(ARROW_MATS[0]);
    s.scale.setScalar(0.22 * k);
    s.position.y = 2.42 * k;
    s.center.set(0.5, 0);
    rig.root.add(s);
    rig.lineDust = { d, s };
  }
  const { d, s } = rig.lineDust;
  d.visible = !!fx;
  s.visible = !!fx;
  if (fx) {
    s.material = ARROW_MATS[fx === 2 ? 1 : 0];
    const b = nowMs() / 1000;
    s.position.y = (2.42 + (fx === 2 ? -0.1 : Math.sin(b * 6) * 0.04)) * (rig.scale || 1);
  }
}

/* The arm that went into the screen comes out green: from the reach to the
   end of the act, then fading over the rush. `root`: the arm to tint (the
   FP right arm's parts, or a body's right elbow and all below it). Each
   mesh gets its own copy of its material once, tinted, and its own back. */
const GREEN = new THREE.Color(STONKS_GREEN);
function greenK() {
  if (L.phase) return (nowMs() - L.t0) / 1000 >= BEATS.reach ? 1 : 0;
  if (!L.doneAt) return 0;
  const s = (nowMs() - L.doneAt) / 1000 - (BEATS.end - BEATS.snap);
  return s < 0 ? 1 : Math.max(0, 1 - s / LINES.greenSecs);
}
function greenArm(root, k) {
  if (!root) return;
  const meshes = [];
  const add = (o) => o?.traverse?.((m) => { if (m.isMesh && m.material && !Array.isArray(m.material)) meshes.push(m); });
  if (root.hand) { add(root.hand); add(root.wrist); add(root.cuff); add(root.sleeve); } else add(root);
  for (const m of meshes) {
    const u = m.userData;
    if (k <= 0.001) { if (u.lnOrig) { m.material = u.lnOrig; u.lnOrig = null; } continue; }
    if (!u.lnOrig) { u.lnOrig = m.material; m.material = m.material.clone(); u.lnBase = m.material.color?.clone(); }
    if (u.lnBase && m.material.color) m.material.color.copy(u.lnBase).lerp(GREEN, 0.75 * k);
    if (m.material.emissive) m.material.emissive.copy(GREEN).multiplyScalar(0.35 * k);
  }
}

/* --------------------------------------------------------- first person

   The hands in front of the camera: the right forward into the chart (the
   camera's turned to it), back with the candle, both on the bottle, the
   card's chops and the flick, flat either side for the plant; overhead on
   the way up, out on the way down, on the desk's edge for the climb. */
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export function linesArms() {
  if (!L.phase) return null;
  const t = (nowMs() - L.t0) / 1000;
  const S = lineState(t, L.cancelAt);
  const low = [0.22, -0.48, -0.45], lowL = [-0.22, -0.48, -0.45];
  let R = lerp3(low, [0.15, -0.2, -0.44], S.lean), L_ = lerp3(lowL, [-0.2, -0.24, -0.44], S.lean);
  let rotR = [0.9, 0.2, -Math.PI / 2], rotL = [0.8, -0.2, Math.PI / 2], poseR = "open", poseL = "open";
  if (t < BEATS.launch) {
    if (S.reach > 0.01) R = lerp3(R, [0.03, -0.06, -0.68], S.reach);
    if (S.candle === "hand") { R = lerp3([0.03, -0.06, -0.62], [0.06, -0.22, -0.42], S.pull); poseR = "grip"; }
    if (S.bottle.mode === "roll") {
      const z = -0.42 + S.bottle.z * 1.2;
      R = [0.16, -0.27, z]; L_ = [-0.16, -0.27, z];
      rotR = [1.3, 0.1, -Math.PI / 2]; rotL = [1.3, -0.1, Math.PI / 2];
    }
    if (S.card.on) { R = [S.card.x * 1.1, -0.2 - S.chop * 0.03, -0.4]; poseR = "grip"; rotR = [1.1, 0.5, -Math.PI / 2 + 0.3]; }
    if (S.card.fly >= 0 && S.card.fly < 1) R = lerp3([0.08, -0.2, -0.4], [0.32, 0.05, -0.25], ease(S.card.fly));
    if (S.plant > 0.01) { R = lerp3(R, [0.3, -0.34, -0.36], S.plant); L_ = lerp3(L_, [-0.3, -0.34, -0.36], S.plant); }
  } else if (t < BEATS.land) {
    const f = flight(t);
    R = f.up ? [0.12, 0.16, -0.32] : [0.38, -0.05, -0.34];
    L_ = f.up ? [-0.12, 0.16, -0.32] : [-0.38, -0.05, -0.34];
    rotR = [1.6, 0, -Math.PI / 2]; rotL = [1.6, 0, Math.PI / 2];
    poseR = poseL = f.up ? "grip" : "open";
  } else {
    const reach = span(t, [BEATS.land, BEATS.grab]);
    const y = -0.05 - 0.22 * S.climb - 0.1 * (1 - reach);
    R = [0.24, y, -0.4]; L_ = [-0.24, y, -0.4];
    rotR = [1.4, 0.1, -Math.PI / 2]; rotL = [1.4, -0.1, Math.PI / 2];
    poseR = poseL = reach >= 1 ? "grip" : "open";
  }
  return { R: { pos: R, rot: rotR, pose: poseR }, L: { pos: L_, rot: rotL, pose: poseL }, gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
}

/* ----------------------------------------------------------- the room */

rpListeners.push((p, m) => {
  if (m.k !== "line" || game.isBotPeer(p)) return;
  const api = lines();
  const T = api?.tables[0];
  if (!T) return;
  const now = nowMs();
  if (m.e === "s") {
    if (m.npc != null) { startNpc(api, T, m.npc | 0, now); return; }
    const at = +m.at || 0;
    if (T.st.by && T.st.by !== p.id && !leftover(T)) {
      // two at once: the older client keeps it (ours wins only if we're older)
      const older = (p.since || 0) < game.net.since || ((p.since || 0) === game.net.since && p.id < game.net.id);
      if (!older) return;
      if (L.phase) { L.phase = null; showWaveBanner(`${p.name || "Someone"} got there first`, 1400); }
    }
    Object.assign(T.st, { start: now - at * 1000, by: p.id, cancelAt: null, npc: -1, cardDown: false });
    peerActs.set(p.id, { t0: now - at * 1000, cancelAt: null, sfxBeat: -1 });
    return;
  }
  if (m.e === "x") {
    const a = peerActs.get(p.id), at = +m.at || 0;
    if (T.st.by === p.id) T.st.cancelAt = at;
    if (a) a.cancelAt = at;
  }
});

/* ------------------------------------------------------------- Lurk

   The room's oldest client starts the guard's line every couple of minutes
   when the chair's free and someone's in the room to see it; everyone runs
   him from the message. */
function isDriver() {
  for (const p of game.net.peers.values()) {
    if (game.isBotPeer(p)) continue;
    if ((p.since || 0) < game.net.since || ((p.since || 0) === game.net.since && p.id < game.net.id)) return false;
  }
  return true;
}
function guardIdx() {
  const N = game.townNpcs;
  return N ? N.list.findIndex((n) => n.c.name === "Lurk" && !n.override && !n.off) : -1;
}
function chairFree() {
  if (inChair()) return false;
  const ci = chairIdx();
  for (const p of game.net.peers.values()) if (!game.isBotPeer(p) && p.seat === ci + 1) return false;
  return true;
}
function driveNpcs(api, now) {
  if (!npcNext) npcNext = now + LINES.npcFirst * 1000;
  if (now < npcNext || !isDriver()) return;
  npcNext = now + LINES.npcEvery * 1000 * (0.8 + Math.random() * 0.4);
  const T = api.tables[0], i = guardIdx();
  const v = game.builtMap?.map?.rp?.view, c = game.camera.position;
  const watched = !v || v.zoneOf(c.x, c.y, c.z) === "office" || v.zoneOf(c.x, c.y, c.z) === "street";
  if (i < 0 || !stationFree(T) || !chairFree() || !watched) return;
  startNpc(api, T, i, now);
  send({ e: "s", tb: 0, npc: i });
}
function startNpc(api, T, i, now) {
  const N = game.townNpcs, n = N?.list[i];
  if (!n || !stationFree(T)) return;
  Object.assign(T.st, { start: now, by: `npc:${i}`, cancelAt: null, npc: i, cardDown: false });
  const mem = { sfxBeat: -1 };
  N.takeOver(i, (nn, rig) => {
    const t = (nowMs() - T.st.start) / 1000;
    if (t > BEATS.end) return;
    poseLiner(rig, api, T, t, null, nn);
    greenArm(rig.parts?.elbowR, t >= BEATS.reach ? 1 : 0);
    sfx(t, { x: T.x, y: T.top, z: T.z }, mem);
  });
  npcActs.set(i, { t0: now });
}
function endNpc(i) {
  const rig = game.townNpcs?.list[i]?.rig;
  greenArm(rig?.parts?.elbowR, 0);
  game.townNpcs?.release(i);
  npcActs.delete(i);
}
/* Who's doing one (the test asks). */
export const npcLines = () => [...npcActs.entries()].map(([i, a]) => ({ i, ...a }));

// headless tests reach in here (tools/troll-ops-lines-test.mjs)
if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollLines = {
    L, LINES, linesCam, BEATS,
    station: () => { const T = lines()?.tables[0]; return T ? { x: T.x, z: T.z, top: T.top, seat: T.seat, st: { ...T.st } } : null; },
    boxes: () => lines()?.boxes() ?? null,
    state: () => ({ phase: L.phase, t: L.phase ? (nowMs() - L.t0) / 1000 : -1, cancelAt: L.cancelAt, cd: Math.max(0, L.cd - nowMs()), done: L.done, stood: L.stood,
      peers: [...peerActs.entries()].map(([id, a]) => ({ id, t: (nowMs() - a.t0) / 1000, cancelAt: a.cancelAt })), npcs: npcLines(),
      cam: { ...linesCam }, eye: game.move.eyeHeight, pos: game.move.pos.toArray(), inChair: inChair(), green: greenK() }),
    begin: () => { const api = lines(); if (api) begin(api.tables[0]); },
    npcNow: () => { npcNext = 1; },
    setT: (secs) => { L.t0 = nowMs() - secs * 1000; const api = lines(); if (api && L.phase) api.tables[0].st.start = L.t0; },
  };
}
