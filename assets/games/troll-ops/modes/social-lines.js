/* Socialize: the candle lines (docs/CANDLE-LINES.md; the props and the
   beats in maps/kabukigrin-lines.js, the sounds in sound/lines-sfx.js, the
   rush after in view/stonks-fx.js).

   Hold X by one of the tatami room's tables ("Cut a line", 0.4 s): the next
   5.6 s play by themselves. Lean in, take the tall green candle off the
   stand, crush it under the $TROLL card (three presses), chop and drag it
   into a line, the rolled bill up to the nose, the line goes end to end,
   the head snaps back. Move, jump, crouch or get hit before the snort and
   it stops: the powder stays on the mirror 20 s and anyone can hold X to
   "Finish the line". A line a minute and a half at most ("Market's closed").

   Everyone sees the same thing: the act goes out as one "line" message
   per table and every client plays the table's props and the body from it.
   The VIPs at the tables do a line now and then, started by the room's
   oldest client. The rush itself is local (view/stonks-fx.js); what others
   see of it (the dusted nose, the arrow) rides the state packet (`ln`). */

import * as THREE from "three";
import { bar, rpBusy, rpExtras, rpListeners, rpSeats, seated } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3-jx4-jx5-mb1-mb2-gc1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-tn13-rdf2-kbc3-zft1-pqs1-fbo1-cst1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h-kbc1-kbc2-kbc3";
import { touchState } from "../input/touch.js?v=in1-th2-bp1-bf1-pd1-nf1-fs1-tn13";
import { localPosers } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-tn13-rdf2-kbc3-zft1-pqs1-fbo1-cst1";
import { peerPosers } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-jx2-jx3-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h-kbc1-kbc2-kbc3";
import { poseSeated } from "./rp-roles.js?v=rp1b7-cd1-sh1-dj2-or1-bw2-sp1-mb1-mb2-nft2531-kbc1-kbc2-kbc3";
import { reachHand, setHandPose } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1-pk1-mb1-mb2-nft2531-kbc1-kbc2-kbc3";
import { damp } from "../characters/anim-curves.js?v=or1";
import { game } from "../core/state.js?v=st1";
import { BEATS, PRESSES, CHOPS, DRAG, LEFTOVER_SECS, lineState, materials, makeCard, makeBill, STONKS_GREEN } from "../maps/kabukigrin-lines.js?v=cl1-kbc1-kbc2-kbc3";
import { linesSfx } from "../sound/lines-sfx.js?v=cl1-kbc1-kbc2-kbc3";

export const LINES = {
  holdSecs: 0.4,
  reach: 1.05,          // from the table's spot
  cooldownSecs: 90,
  npcEvery: 120,        // a VIP does one about this often
  npcFirst: 45,
  leanEye: { stand: 1.08, seat: 0.56 },   // the eye over the mirror
  camPitch: -0.62,      // looking down at it (radians)
  sweep: 0.26,          // the look along the line as it goes
};
// the test shortens the waits (window.__trollLinesTune)
if (typeof window !== "undefined" && window.__trollLinesTune) Object.assign(LINES, window.__trollLinesTune);

/* Ours. */
export const L = {
  phase: null,     // "line" while we're on one
  tb: -1,
  t0: 0,           // performance.now ms at the hold-X
  cancelAt: null,  // the beat we stopped at
  pos0: new THREE.Vector3(),
  hp0: 0,
  seat: null,      // the cushion we're on, if any
  eye: 0, eye0: 0, // the eye height we drive, and where it started
  cd: 0,           // ms: when the next line's allowed
  done: 0,         // how many we've finished (view/stonks-fx.js watches it)
  doneAt: 0,
  sfxBeat: -1,
};
export const linesCam = { pitch: 0, yaw: 0, roll: 0 };
const peerActs = new Map();   // peer id -> { tb, t0, cancelAt, seat }
const npcActs = new Map();    // npc index -> { tb, t0 }
let npcNext = 0;
const nowMs = () => performance.now();
const lines = () => (game.isSocial() ? game.builtMap?.map?.rp?.lines?.() || null : null);
const send = (m) => game.net.publishRp({ k: "line", ...m });
const span = (t, [a, b]) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = (k) => k * k * (3 - 2 * k);
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/* The table's state, reset. */
function clearTable(T) {
  Object.assign(T.st, { start: 0, by: null, cancelAt: null, face: null, hideHand: false });
}
function tableFree(T) { return !T.st.start; }
function tableLeftover(T) {
  const st = T.st;
  if (!st.start || st.cancelAt == null) return false;
  return (nowMs() - st.start) / 1000 > st.cancelAt && (nowMs() - st.start) / 1000 < st.cancelAt + LEFTOVER_SECS;
}
/* The table within reach: by its spot, or sat on one of its cushions. */
function nearTable(api) {
  const p = game.move.pos;
  for (const T of api.tables) {
    if (seated) {
      if (seated.s.kind === "cushion" && T.cushions.some(([x, z]) => Math.hypot(seated.s.x - x, seated.s.z - z) < 0.15)) return T;
      continue;
    }
    if (Math.abs(p.y - T.floor) < 0.6 && Math.hypot(p.x - T.at.x, p.z - T.at.z) <= LINES.reach) return T;
  }
  return null;
}

/* ------------------------------------------------------------- ours */

function begin(T, { fromBeat = 0 } = {}) {
  const now = nowMs();
  L.phase = "line"; L.tb = T.i; L.t0 = now - fromBeat * 1000; L.cancelAt = null;
  L.pos0.copy(game.move.pos); L.hp0 = game.player.hp; L.seat = seated ? seated.s : null; L.sfxBeat = -1;
  L.eye = L.eye0 = game.move.eyeHeight;
  if (game.emote) game.stopEmote();
  Object.assign(T.st, { start: L.t0, by: "me", cancelAt: null, hideHand: !game.thirdPerson?.() });
  send({ e: "s", tb: T.i, at: fromBeat || undefined });
}
function cancel(T) {
  const t = (nowMs() - L.t0) / 1000;
  L.cancelAt = t;
  T.st.cancelAt = t;
  T.st.hideHand = false;
  send({ e: "x", tb: T.i, at: Math.round(t * 100) / 100 });
  L.phase = null;
  showWaveBanner("You left the line on the mirror", 1400);
}
function finish() {
  L.phase = null;
  L.cd = nowMs() + LINES.cooldownSecs * 1000;
  L.done++;
  L.doneAt = nowMs();
}

/* Hold X at a table. */
rpExtras.push(() => {
  const api = lines();
  if (!api || !game.player.alive) return null;
  if (L.phase) return null;
  const T = nearTable(api);
  if (!T) return null;
  if (bar.drink) return { key: `ln-hands-${T.i}`, info: true, label: "Hands full" };
  if (rpBusy.fists || rpBusy.arm) return null;
  const now = nowMs();
  if (now < L.cd) return { key: `ln-cd-${T.i}`, info: true, label: `Market's closed · ${fmt(L.cd - now)}` };
  if (tableLeftover(T)) {
    return { key: `ln-finish-${T.i}`, label: "Finish the line", busy: "Leaning in…", ctx: "Line", time: LINES.holdSecs,
      done: () => { T.st.cancelAt = null; begin(T, { fromBeat: DRAG[1] }); } };
  }
  if (!tableFree(T)) return { key: `ln-busy-${T.i}`, info: true, label: T.st.npc >= 0 ? "Wait your turn" : "Someone's on it" };
  return { key: `ln-${T.i}`, label: "Cut a line", busy: "Leaning in…", ctx: "Line", time: LINES.holdSecs,
    done: () => { begin(T); showWaveBanner(game.isTouch ? "Hold still" : "Hold still · move to stop", 1400); } };
});

/* Every frame (view/player-update.js, Socialize): ours, the room's, the VIPs'. */
export function updateLines(dt) {
  const api = lines();
  linesCam.pitch = linesCam.yaw = linesCam.roll = 0;
  if (!api) { if (L.phase) L.phase = null; peerActs.clear(); npcActs.clear(); npcNext = 0; return; }
  const now = nowMs();
  // tables whose line is over (or whose leftover has gone): clear
  for (const T of api.tables) {
    if (!T.st.start) continue;
    const t = (now - T.st.start) / 1000;
    const over = T.st.cancelAt != null ? t > T.st.cancelAt + LEFTOVER_SECS : t > BEATS.end + 0.5;
    if (over) { if (T.st.npc >= 0) endNpc(T.st.npc); clearTable(T); }
  }
  for (const [id, a] of peerActs) if ((now - a.t0) / 1000 > BEATS.end + 0.5 || !game.net.peers.has(id)) peerActs.delete(id);
  driveNpcs(api, now);
  if (!L.phase) return;
  const T = api.tables[L.tb];
  if (!T) { L.phase = null; return; }
  const t = (now - L.t0) / 1000;
  const S = lineState(t, null);
  // held still over the table (sat down, the seat holds us)
  const jump = (game.isTouch && (touchState.jump || touchState.crouch)) || (game.gamepadState.jump || game.gamepadState.crouch) || game.keys.has("Space") || game.keys.has("KeyC");
  const moved = L.seat ? !seated : game.move.moving || jump;
  const hurt = game.player.hp < L.hp0 - 0.5;
  if (t < BEATS.snort && (moved || hurt || !game.player.alive || game.gameState !== "playing")) { cancel(T); return; }
  if (!L.seat) {
    game.move.pos.copy(L.pos0);
    game.move.velocity.set(0, 0, 0);
    game.move.moving = false; game.move.sprinting = false;
  }
  // the eye down over the mirror, back up at the end
  const lean = ease(span(t, [0, BEATS.down])) * (1 - ease(span(t, [BEATS.snort, BEATS.end])));
  // (ours to set while it lasts: the walk's own damping pulls it back up each frame)
  const eyeTarget = (L.seat ? L.seat.y - L.seat.floor + 0.74 : L.eye0) * (1 - lean) + (L.seat ? LINES.leanEye.seat : LINES.leanEye.stand) * lean;
  L.eye = damp(L.eye, eyeTarget, 9, dt);
  if (t < BEATS.end) game.move.eyeHeight = L.eye;
  // the camera: down at the glass, along the line as it goes, the snap back
  const snap = S.snap;
  linesCam.pitch = LINES.camPitch * lean + 0.22 * snap + (Math.random() - 0.5) * 0.04 * snap;
  const sweep = (S.eaten - 0.5) * LINES.sweep * (t >= BEATS.bill && t < BEATS.snort + 0.2 ? 1 : 0);
  const ax = Math.cos(T.ry), az = -Math.sin(T.ry);              // the line's axis (tray +x), world
  const fy = game.look.yaw, fx = -Math.sin(fy), fz = -Math.cos(fy), rx = Math.cos(fy), rz = -Math.sin(fy);
  linesCam.yaw = -sweep * (ax * rx + az * rz);
  linesCam.pitch += sweep * 0.7 * (ax * fx + az * fz);
  linesCam.roll = (Math.random() - 0.5) * 0.03 * snap;
  T.st.hideHand = !game.thirdPerson?.();
  T.st.face = null;
  sfx(t, null);
  if (t >= BEATS.end) { finish(); T.st.hideHand = false; }
}

/* The beats' sounds, once each, for a line at `at` (null: ours). */
function sfx(t, at, mem = L) {
  const marks = [...PRESSES.map((p) => [p, "crunch"]), ...CHOPS.map((c) => [c, "chop"]), [DRAG[0], "scrape"], [BEATS.bill, "sniff"], [BEATS.snort, "snap"]];
  marks.forEach(([when, what], i) => {
    if (t >= when && (mem.sfxBeat ?? -1) < i) { mem.sfxBeat = i; linesSfx[what](at); }
  });
}

/* ------------------------------------------------------------- the body

   Leaning over the table: the torso forward and the head down at the
   glass, the right hand on the card (wherever the props have it), the left
   on the table's edge, then up with the bill at the nose. `seatY`: sat on a
   cushion (poseSeated first), else stood at the table's spot. */
const _c = new THREE.Vector3(), _n = new THREE.Vector3(), _pole = new THREE.Vector3(), _f = new THREE.Vector3();
function poseLiner(rig, api, T, t, cancelAt, seatY = null, faceOut = null) {
  const S = lineState(t, cancelAt);
  if (seatY != null) poseSeated(rig, seatY, 0);
  const p = rig.parts, k = rig.scale || 1;
  const lean = ease(span(t, [0, BEATS.down])) * (1 - 0.7 * ease(span(t, [BEATS.snort, BEATS.end])));
  const L0 = seatY != null ? 0.62 : 0.95;
  p.torso.rotation.x = -L0 * lean;                           // forward is negative
  p.headPivot.rotation.x = -0.55 * lean + 0.9 * S.snap;      // down at the glass, back at the end
  rig.root.updateMatrixWorld(true);
  // the nose: in front of the head, a touch below its middle
  p.head.getWorldPosition(_n);
  _f.set(0, 0, -1).applyQuaternion(p.head.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(0.1 * k);
  _n.add(_f); _n.y -= 0.03 * k;
  if (faceOut) faceOut.copy(_n);
  // right hand: on the card where it is, else resting by the tray
  if (S.card.on) api.world(T.i, S.card.x, S.card.y + 0.012, S.card.z, _c);
  else api.world(T.i, 0.12, 0.02, 0.11, _c);
  p.chest.worldToLocal(_c);
  reachHand(rig, 1, _c, _pole.set(0.6, -0.4, -0.5));
  setHandPose(rig, 1, S.card.on ? "fist" : "open");
  // left hand: the table's edge, or the bill at the nose
  if (S.bill > 0.01) { _c.copy(_n); _c.x -= 0.02 * k; _c.y -= 0.02 * k; }
  else api.world(T.i, -0.16, 0.02, 0.12, _c);
  p.chest.worldToLocal(_c);
  reachHand(rig, -1, _c, _pole.set(-0.7, -0.3, -0.4));
  setHandPose(rig, -1, S.bill > 0.01 ? "fist" : "open");
  rig.body?.update?.();
}
const seatYOf = (s) => (s && s.kind === "cushion" ? s.y : null);

localPosers.push((rig) => {
  const api = lines();
  if (!api || !L.phase) return;
  const T = api.tables[L.tb];
  if (T) poseLiner(rig, api, T, (nowMs() - L.t0) / 1000, L.cancelAt, seatYOf(L.seat), T.st.face ??= new THREE.Vector3());
  // the rush on our own body (third person)
  dust(rig, game.net.lineFx | 0);
});
peerPosers.push((rp) => {
  const api = lines();
  if (!api || !rp.peer) return;
  dust(rp.rig, rp.peer.lineFx | 0);
  const a = peerActs.get(rp.peer.id);
  if (!a) return;
  const T = api.tables[a.tb];
  if (!T) return;
  poseLiner(rp.rig, api, T, (nowMs() - a.t0) / 1000, a.cancelAt, a.seatY, T.st.face ??= new THREE.Vector3());
  sfx((nowMs() - a.t0) / 1000, { x: T.x, y: T.top, z: T.z }, a);
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
    d.position.set(0.0, -0.01 * k, 0.006);   // the trollface's nose: the middle, a touch down
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

/* --------------------------------------------------------- first person

   The hands in front of the camera, pitched down at the mirror: the right
   on the card (pressing, chopping, dragging), the left up with the bill at
   the nose. The card and the bill ride the streak arms in viewmodel space;
   the table's own copies hide meanwhile (st.hideHand). */
let fp = null;
function fpKit() {
  if (fp) return fp;
  const M = materials();
  fp = { card: makeCard(M), bill: makeBill(M), seen: 0 };
  const stale = () => { if (nowMs() - fp.seen > 250) { fp.card.visible = fp.bill.visible = false; } };
  fp.card.children[0].onBeforeRender = stale;
  fp.bill.children[0].onBeforeRender = stale;
  return fp;
}
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export function linesArms() {
  if (!L.phase) return null;
  const t = (nowMs() - L.t0) / 1000;
  const S = lineState(t, L.cancelAt);
  const up = ease(span(t, [0, BEATS.down])) * (1 - ease(span(t, [BEATS.snort + 0.15, BEATS.end])));
  const low = [0.22, -0.48, -0.45], lowL = [-0.22, -0.48, -0.45];
  let R = lerp3(low, [0.17, -0.17, -0.44], up), L_ = lerp3(lowL, [-0.19, -0.19, -0.44], up);
  let rotR = [0.9, 0.2, -Math.PI / 2], rotL = [0.8, -0.2, Math.PI / 2];
  // reaching the stand for the candle, then back over the glass
  if (t >= BEATS.down && t < BEATS.pick) {
    const k = span(t, [BEATS.down, BEATS.pick]);
    const out = Math.sin(k * Math.PI);
    R = lerp3([0.17, -0.17, -0.44], [0.06, -0.17, -0.42], k);
    R = lerp3(R, [0.1, -0.09, -0.6], out);
  }
  if (S.card.on) {
    const inCrush = t < BEATS.cut;
    if (inCrush) R = [0.06, -0.15 - S.press * 0.03, -0.41];
    else R = [S.card.x * 1.1, -0.17 - S.chop * 0.02, -0.4];
    rotR = inCrush ? [1.35 - S.press * 0.2, 0.1, -Math.PI / 2] : [1.1, 0.5, -Math.PI / 2 + 0.3];
  }
  if (S.bill > 0.01) {
    L_ = lerp3([-0.26, -0.4, -0.42], [-0.05, -0.08, -0.19], S.bill);
    rotL = [1.6, -0.3, Math.PI / 2];
  }
  // the props on the hands
  const K = fpKit();
  K.seen = nowMs();
  const parent = game.streakArms;
  if (K.card.parent !== parent) parent.add(K.card);
  if (K.bill.parent !== parent) parent.add(K.bill);
  K.card.visible = S.card.on;
  if (S.card.on) {
    K.card.position.set(R[0], R[1] - 0.012, R[2] + 0.01);
    const edge = t >= BEATS.cut;
    K.card.rotation.set(edge ? 0.35 : -0.15 - S.card.pitch * 0.6, edge ? 0.1 : S.card.yaw * 0.3, edge ? 1.25 : 0);
  }
  K.bill.visible = S.bill > 0.01;
  if (S.bill > 0.01) {
    K.bill.position.set(L_[0] + 0.03, L_[1] - 0.005, L_[2] - 0.025);
    K.bill.rotation.set(-2.3, 0.15, 0.2);
  }
  return { R: { pos: R, rot: rotR, pose: S.card.on ? "grip" : "open" }, L: { pos: L_, rot: rotL, pose: S.bill > 0.01 ? "grip" : "open" }, gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
}

/* ----------------------------------------------------------- the room */

rpListeners.push((p, m) => {
  if (m.k !== "line" || game.isBotPeer(p)) return;
  const api = lines();
  const T = api?.tables[m.tb | 0];
  if (!T) return;
  const now = nowMs();
  if (m.e === "s") {
    if (m.npc != null) { startNpc(api, T, m.npc | 0, now); return; }
    const at = +m.at || 0;
    if (T.st.by && T.st.by !== p.id && !tableLeftover(T)) {
      // two at once: the older client keeps the table (ours wins only if we're older)
      const older = (p.since || 0) < game.net.since || ((p.since || 0) === game.net.since && p.id < game.net.id);
      if (!older) return;
      if (L.phase && L.tb === T.i) { L.phase = null; showWaveBanner(`${p.name || "Someone"} got there first`, 1400); }
    }
    Object.assign(T.st, { start: now - at * 1000, by: p.id, cancelAt: null, hideHand: false, npc: -1 });
    const s = p.seat ? rpSeats()?.[p.seat - 1] : null;
    peerActs.set(p.id, { tb: T.i, t0: now - at * 1000, cancelAt: null, seatY: seatYOf(s), sfxBeat: -1 });
    return;
  }
  if (m.e === "x") {
    const a = peerActs.get(p.id);
    const at = +m.at || 0;
    if (T.st.by === p.id) T.st.cancelAt = at;
    if (a) a.cancelAt = at;
  }
});

/* ------------------------------------------------------------- the VIPs

   The room's oldest client picks a VIP sat at one of the tables every
   couple of minutes; everyone runs him from the message. */
function isDriver() {
  for (const p of game.net.peers.values()) {
    if (game.isBotPeer(p)) continue;
    if ((p.since || 0) < game.net.since || ((p.since || 0) === game.net.since && p.id < game.net.id)) return false;
  }
  return true;
}
function vipAt(api, T) {
  const N = game.townNpcs;
  if (!N) return -1;
  for (let i = 0; i < N.list.length; i++) {
    const n = N.list[i];
    if (n.c.role !== "VIP" || !n.c.sit || n.override || n.off) continue;
    if (T.cushions.some(([x, z]) => Math.hypot(n.x - x, n.z - z) < 0.2)) return i;
  }
  return -1;
}
function driveNpcs(api, now) {
  if (!npcNext) npcNext = now + LINES.npcFirst * 1000;
  if (now < npcNext || !isDriver()) return;
  npcNext = now + LINES.npcEvery * 1000 * (0.8 + Math.random() * 0.4);
  const free = api.tables.filter((T) => tableFree(T) && vipAt(api, T) >= 0);
  if (!free.length) return;
  const T = free[Math.floor(Math.random() * free.length)];
  const i = vipAt(api, T);
  startNpc(api, T, i, now);
  send({ e: "s", tb: T.i, npc: i });
}
function startNpc(api, T, i, now) {
  const N = game.townNpcs, n = N?.list[i];
  if (!n || !tableFree(T)) return;
  const face = new THREE.Vector3();
  Object.assign(T.st, { start: now, by: `npc:${i}`, cancelAt: null, hideHand: false, npc: i, face });
  const mem = { sfxBeat: -1 };
  N.takeOver(i, (nn, rig) => {
    const t = (nowMs() - T.st.start) / 1000;
    poseLiner(rig, api, T, t, null, nn.c.y ?? 0, face);
    sfx(t, { x: T.x, y: T.top, z: T.z }, mem);
  });
  npcActs.set(i, { tb: T.i, t0: now });
}
function endNpc(i) {
  game.townNpcs?.release(i);
  npcActs.delete(i);
}
/* The VIP who did one (the test asks). */
export const npcLines = () => [...npcActs.entries()].map(([i, a]) => ({ i, ...a }));

// headless tests reach in here (tools/troll-ops-lines-test.mjs)
if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollLines = {
    L, LINES, linesCam, BEATS,
    tables: () => lines()?.tables.map((T) => ({ i: T.i, x: T.x, z: T.z, at: T.at, st: { ...T.st, face: T.st.face && { x: T.st.face.x, y: T.st.face.y, z: T.st.face.z } } })) ?? null,
    boxes: () => lines()?.boxes() ?? null,
    state: () => ({ phase: L.phase, tb: L.tb, t: L.phase ? (nowMs() - L.t0) / 1000 : -1, cancelAt: L.cancelAt, cd: Math.max(0, L.cd - nowMs()), done: L.done,
      peers: [...peerActs.entries()].map(([id, a]) => ({ id, tb: a.tb, t: (nowMs() - a.t0) / 1000, cancelAt: a.cancelAt })), npcs: npcLines(),
      cam: { ...linesCam }, eye: game.move.eyeHeight }),
    begin: (tb) => { const api = lines(); if (api) begin(api.tables[tb]); },
    npcNow: () => { npcNext = 1; },
    setT: (secs) => { L.t0 = nowMs() - secs * 1000; const api = lines(); if (api && L.phase) api.tables[L.tb].st.start = L.t0; },
  };
}
