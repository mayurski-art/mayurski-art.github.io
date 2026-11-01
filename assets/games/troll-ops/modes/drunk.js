// Troll Forces Socialize: being drunk (docs/KB-BAR-SERVICE.md 4-7).
//
// One meter for all of Socialize, social-rp.js bar.tipsy (the saloon's beer
// counts, the doctor's tonic still sobers you). Under TIPSY.max the saloon's
// steady sway (saloon-bar.js tipsyFx) is all there is. From DRUNK.spellFrom
// up, dizzy spells on top: a lurch of the view, the picture blurs and the
// edges close in, the walk is shoved sideways and slowed, the club's music
// sinks into a hum (kabukigrin.js muffle reads game.drunkMuffle). The
// drunker you are the sooner the next comes and the harder it hits. At
// TIPSY.cap you pass out: slump, tip off the stool, black, come round on
// the floor beside it, still dizzy.
//
// On the wire as `dz` (net.js): 1 in a spell, 2 slumping, 3 down, 4 getting
// up. Peers run the pose from the phase changes on their own clock; a late
// joiner sees the phase you're in.

import { game } from "../core/state.js?v=st1";
import { bar, seated, standUp, putDownDrink } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3-jx4-jx5-mb1-mb2-gc1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-kbc2";
import { TIPSY } from "../maps/saloon-bar.js?v=sb1b7-cup1-gt1-gt2-cw1-zr10-hr2-zp1-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1-mb1-mb2-nft2531-kbc1-kbc2";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h-kbc1-kbc2";
import { peerPosers } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-jx2-jx3-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h-kbc1-kbc2";
import { localPosers } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-kbc2";
import { settings } from "../menu/settings.js?v=ms1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-aa0-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-kbc2";
import { damp } from "../characters/anim-curves.js?v=or1";
import { DOUBLE_VISION } from "../view/grade-pass.js?v=sr1-tm5-sp1-kbc1-kbc2";   // the same tag as game.js's: one instance

export const DRUNK = {
  spellFrom: 3,                 // spells start here (TIPSY.cap passes you out)
  gapFar: 40, gapNear: 6,       // seconds between spells, just over spellFrom .. at the cap (±40 %)
  spellMin: 1.5, spellMax: 3.5, // a spell's length
  rampIn: 0.3, rampOut: 0.8,
  strMin: 0.3,                  // strength at spellFrom (1 at the cap), × 0.7..1
  roll: 0.22, pitch: 0.1, yawDrag: 0.35,   // the view: a lurch (rad), a dip, a slide (rad/s)
  blur: 2.5,                    // px on the picture at full strength (not on Low, not on phones)
  ghost: 0.42, ghostShift: 0.028,  // double vision (view/grade-pass.js): the ghost's weight, and how far it drifts (screen widths). Everywhere, phones too
  fovBreath: 0.05,              // the lens breathes ±5 % of the FOV setting (about ±4° at 78)
  vignette: 0.85,
  shove: 2.2, slow: 0.7,        // the walk: sideways (input units) and how much speed is left
  out: { slump: 1.4, fall: 0.8, black: 4, wake: 2.5 },
  wakeLevel: 4.5,               // where the meter sits when you come round
  grace: 30,                    // no second pass-out this soon
  fallRoll: 1.4,                // rad: how far over the view tips going down
};
export const DZ = { NONE: 0, SPELL: 1, SLUMP: 2, DOWN: 3, WAKE: 4 };

export const drunk = {
  phase: DZ.NONE, t: 0,       // the phase, and seconds into it
  next: -1,                   // seconds to the next spell (-1: not scheduled)
  spell: null,                // { len, str, dir }
  out: null,                  // passing out: { dir, spot: {x, z, floor}, seat, eye }
  grace: 0,
  spun: false,                // "The room spins" said this time up
  view: { roll: 0, pitch: 0, eyeDrop: 0, shove: 0, slow: 1 },
  el: null, black: null, k: 0,
};

const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (a, b) => a + Math.random() * (b - a);
const smooth = (k) => k * k * (3 - 2 * k);
/* How far up the spells' range we are, 0 at spellFrom .. 1 at the cap. */
const howDrunk = () => Math.max(0, Math.min(1, (bar.tipsy - DRUNK.spellFrom) / (TIPSY.cap - DRUNK.spellFrom)));
const schedule = () => { const g = lerp(DRUNK.gapFar, DRUNK.gapNear, howDrunk()); drunk.next = g * rnd(0.6, 1.4); };

/* ------------------------------------------------------------- the screen */

function build() {
  const el = document.createElement("div");
  el.className = "to-dizzy";
  el.setAttribute("aria-hidden", "true");
  const black = document.createElement("div");
  black.className = "to-dizzy-black";
  black.innerHTML = "<span>…</span>";
  black.setAttribute("aria-hidden", "true");
  game.els.hud.prepend(el);
  game.els.hud.appendChild(black);
  drunk.el = el; drunk.black = black;
}
const blurOk = () => !game.isTouch && settings.gfx !== "low";
function paint(spellK, blackK) {
  if (!drunk.el) build();
  drunk.el.style.opacity = (spellK * DRUNK.vignette).toFixed(3);
  drunk.black.style.opacity = blackK.toFixed(3);
  drunk.black.classList.toggle("is-on", blackK > 0.01);
  const px = blurOk() ? spellK * DRUNK.blur : 0;
  const want = px > 0.05 ? `blur(${px.toFixed(2)}px)` : "";
  const c = game.renderer?.domElement;
  if (c && c.style.filter !== want && (want || c.style.filter.startsWith("blur("))) c.style.filter = want;
}

/* ------------------------------------------------------------ the spells */

function startSpell() {
  const k = howDrunk();
  drunk.spell = { len: rnd(DRUNK.spellMin, DRUNK.spellMax), str: lerp(DRUNK.strMin, 1, k) * rnd(0.7, 1), dir: Math.random() < 0.5 ? -1 : 1, wob: rnd(0, 6) };
  drunk.phase = DZ.SPELL; drunk.t = 0;
  if (!drunk.spun) { drunk.spun = true; showWaveBanner("The room spins", 1500); }
  schedule();
}
/* 0..1 through the spell's envelope: in, hold, out. */
function envelope(t, len) {
  if (t < DRUNK.rampIn) return smooth(t / DRUNK.rampIn);
  if (t > len - DRUNK.rampOut) return smooth(Math.max(0, (len - t) / DRUNK.rampOut));
  return 1;
}

/* ----------------------------------------------------------- passing out */

function passOut() {
  const s = seated?.s || null;
  const spot = s ? { x: s.stand.x, z: s.stand.z, floor: s.floor } : { x: game.move.pos.x, z: game.move.pos.z, floor: game.move.pos.y };
  // off the stool away from the bar: the way the stool faces is toward the
  // bar, so fall to one side of that
  drunk.out = { dir: Math.random() < 0.5 ? -1 : 1, spot, seat: s, eye: game.move.eyeHeight };
  drunk.spell = null;
  drunk.phase = DZ.SLUMP; drunk.t = 0;
  putDownDrink();
  if (game.emote) game.stopEmote();
  showWaveBanner("Lights out…", 1400);
}
function wakeUp() {
  drunk.out = null;
  drunk.phase = DZ.NONE; drunk.t = 0;
  bar.tipsy = Math.min(bar.tipsy, DRUNK.wakeLevel);
  drunk.grace = DRUNK.grace;
  drunk.spun = false;
  schedule();
  showWaveBanner("Where… oh. The floor.", 2000);
}
export const drunkOut = () => drunk.phase >= DZ.SLUMP;
/* player-update.js: while we're out, the body is ours (no walking off). */
export const drunkHolds = () => drunkOut() && game.isSocial();
export function drunkHold(dt) {
  const O = drunk.out;
  if (!O) return;
  const m = game.move;
  m.velocity.set(0, 0, 0);
  m.moving = false; m.sprinting = false; m.grounded = true;
  if (drunk.phase === DZ.SLUMP && O.seat) {
    m.pos.set(O.seat.x, O.seat.floor, O.seat.z);
    m.eyeHeight = damp(m.eyeHeight, O.seat.y - O.seat.floor + 0.74, 10, dt);
  } else {
    m.pos.set(O.spot.x, O.spot.floor, O.spot.z);
    m.eyeHeight = damp(m.eyeHeight, O.eye, 6, dt);
  }
}

/* ------------------------------------------------------------- the frame */

/* The double image and the breathing lens, 0..1 (`t` the phase's clock). */
let lensOn = false;
function lens(k, t) {
  DOUBLE_VISION.k = k * DRUNK.ghost;
  DOUBLE_VISION.x = DRUNK.ghostShift * k * (0.65 + 0.35 * Math.sin(t * 1.3));
  DOUBLE_VISION.y = DRUNK.ghostShift * 0.35 * k * Math.sin(t * 0.9 + 0.7);
  // through the FOV setting's own hook (game.js damps toward it); put back when it's over
  if (k > 0) { game.baseFov = settings.fov * (1 + DRUNK.fovBreath * k * Math.sin(t * 2.2)); lensOn = true; }
  else if (lensOn) { game.baseFov = settings.fov; lensOn = false; }
}

function reset() {
  drunk.phase = DZ.NONE; drunk.t = 0; drunk.spell = null; drunk.out = null; drunk.next = -1; drunk.spun = false;
  Object.assign(drunk.view, { roll: 0, pitch: 0, eyeDrop: 0, shove: 0, slow: 1 });
  if (drunk.el) paint(0, 0);
  game.drunkMuffle = 0;
  lens(0, 0);
  if (game.net) game.net.dz = 0;
}

/* Every frame (view/player-update.js). Returns the view's share: roll and
   pitch (rad) on the camera, eyeDrop (m) off the eye, shove on the strafe
   input and slow on the speed. */
export function updateDrunk(dt) {
  const V = drunk.view;
  if (!game.isSocial() || !game.player.alive || game.localPauseOnly) { if (drunk.phase || drunk.next >= 0) reset(); return V; }
  drunk.grace = Math.max(0, drunk.grace - dt);
  drunk.t += dt;
  let spellK = 0, blackK = 0, ghost = 0;
  V.roll = 0; V.pitch = 0; V.eyeDrop = 0; V.shove = 0; V.slow = 1;

  if (drunk.out) {
    const O = drunk.out, T = DRUNK.out, t = drunk.t;
    if (drunk.phase === DZ.SLUMP) {
      const k = smooth(Math.min(1, t / T.slump));
      V.pitch = 0.55 * k; V.eyeDrop = 0.22 * k; V.roll = O.dir * 0.08 * k;
      blackK = k * k;
      if (t >= T.slump) {
        drunk.phase = DZ.DOWN; drunk.t = 0;
        // off the stool: the seat's given up, we lie at its standing spot
        if (seated) standUp();
        game.move.pos.set(O.spot.x, O.spot.floor, O.spot.z);
      }
    } else if (drunk.phase === DZ.DOWN) {
      const k = smooth(Math.min(1, t / T.fall));
      V.roll = O.dir * DRUNK.fallRoll * k; V.pitch = 0.35 * k; V.eyeDrop = (O.eye - 0.3) * k;
      blackK = Math.max(0.8, k);
      if (!O.thud && t >= T.fall) { O.thud = true; game.audio.land?.(9); }
      if (t >= T.fall + T.black) { drunk.phase = DZ.WAKE; drunk.t = 0; }
    } else {   // WAKE: two slow blinks on the ceiling, then up
      const k = Math.min(1, t / T.wake);
      const up = smooth(Math.max(0, (k - 0.45) / 0.55));
      V.roll = O.dir * DRUNK.fallRoll * (1 - up); V.pitch = 0.35 * (1 - up) - 0.25 * (1 - up) * up; V.eyeDrop = (O.eye - 0.3) * (1 - up);
      const blink = k < 0.45 ? 0.5 + 0.5 * Math.cos(k / 0.45 * Math.PI * 2) : 0;   // open, shut, open
      blackK = Math.max(blink, 1 - smooth(Math.min(1, k / 0.12)));
      ghost = 0.9 * (1 - up);   // seeing double, coming round
      if (t >= T.wake) wakeUp();
    }
    game.drunkMuffle = Math.max(0.6, blackK);
  } else {
    // the spells: scheduled from spellFrom up, dropped under it
    if (bar.tipsy >= DRUNK.spellFrom) {
      if (drunk.next < 0) schedule();
      else if (!drunk.spell) { drunk.next -= dt; if (drunk.next <= 0) startSpell(); }
    } else if (drunk.next >= 0 && !drunk.spell) { drunk.next = -1; drunk.spun = false; }
    if (drunk.spell) {
      const S = drunk.spell, t = drunk.t;
      if (t >= S.len) { drunk.spell = null; drunk.phase = DZ.NONE; drunk.t = 0; }
      else {
        const e = envelope(t, S.len) * S.str;
        spellK = e; ghost = e;
        const wob = Math.sin(t * 4.1 + S.wob) * 0.35 + Math.sin(t * 1.7) * 0.65;
        V.roll = S.dir * DRUNK.roll * e * (0.6 + 0.4 * wob);
        V.pitch = -DRUNK.pitch * e * (0.5 + 0.5 * Math.sin(t * 2.3 + 1));
        V.shove = S.dir * DRUNK.shove * e * (0.7 + 0.3 * wob);
        V.slow = 1 - (1 - DRUNK.slow) * e;
        if (!game.localPauseOnly) game.look.yaw += S.dir * DRUNK.yawDrag * e * dt;
      }
    }
    game.drunkMuffle = spellK;
    if (bar.tipsy >= TIPSY.cap && drunk.grace <= 0) passOut();
  }
  paint(spellK, blackK);
  lens(ghost, drunk.t);
  drunk.k = spellK;
  if (game.net) game.net.dz = drunk.phase;
  return V;
}

/* ------------------------------------------------------------- the body */

/* Anyone's body in a phase: `t` seconds into it, `dir` the side they fall
   to. After the rig's own pose (seated or standing), before body.update. */
const HIP = 0.95;   // the pivot's height above the feet, standing
export function poseDrunk(rig, phase, t, dir = 1, spell = 0) {
  const p = rig.parts, root = rig.root;
  if (phase === DZ.SPELL || (!phase && spell > 0)) {
    // a slow sway of the upper body
    const k = phase === DZ.SPELL ? Math.min(1, t / 0.5) * Math.min(1, spell || 1) : spell;
    p.chest.rotation.z += Math.sin(t * 1.9) * 0.14 * k;
    p.chest.rotation.x += Math.sin(t * 1.3 + 1) * 0.08 * k;
    p.headPivot.rotation.z += Math.sin(t * 1.9 + 0.6) * 0.12 * k;
    return;
  }
  if (phase === DZ.SLUMP) {
    const k = smooth(Math.min(1, t / DRUNK.out.slump));
    p.chest.rotation.x += 0.95 * k;
    p.spine.rotation.x += 0.25 * k;
    p.headPivot.rotation.x += 0.5 * k;
    p.headPivot.rotation.z += dir * 0.2 * k;
    for (const a of [p.armL, p.armR]) { a.rotation.x = lerp(a.rotation.x, 0.9, k); a.rotation.z *= 1 - k; }
    for (const e of [p.elbowL, p.elbowR]) e.rotation.x = lerp(e.rotation.x, 0.6, k);
    return;
  }
  if (phase === DZ.DOWN || phase === DZ.WAKE) {
    // tipped over sideways about the hips, lying on one side; getting up
    // rolls it back and the knees come under
    const T = DRUNK.out;
    const k = phase === DZ.DOWN ? smooth(Math.min(1, t / T.fall)) : 1 - smooth(Math.max(0, Math.min(1, (t / T.wake - 0.45) / 0.55)));
    const a = dir * Math.PI / 2 * k;
    if (root.rotation.order !== "YXZ") root.rotation.order = "YXZ";
    root.rotation.z = a;
    const yaw = root.rotation.y, hip = HIP * (rig.scale || 1);
    const dx = hip * Math.sin(a);   // keep the hips over the same spot...
    root.position.x += dx * Math.cos(yaw);
    root.position.z -= dx * Math.sin(yaw);
    root.position.y += 0.18 * Math.abs(Math.sin(a));   // ...and let them down onto the floor (the hips end 0.18 up, on their side)
    // slack: the legs part a little, the arms fall, the head lolls
    p.legL.rotation.x = lerp(p.legL.rotation.x, 0.35, k); p.legR.rotation.x = lerp(p.legR.rotation.x, -0.15, k);
    p.kneeL.rotation.x = lerp(p.kneeL.rotation.x, -0.6, k); p.kneeR.rotation.x = lerp(p.kneeR.rotation.x, -0.25, k);
    p.armL.rotation.set(lerp(p.armL.rotation.x, 0.6, k), 0, lerp(p.armL.rotation.z, 0.5, k));
    p.armR.rotation.set(lerp(p.armR.rotation.x, -0.4, k), 0, lerp(p.armR.rotation.z, -0.3, k));
    p.headPivot.rotation.x += 0.3 * k;
    p.chest.rotation.x += 0.2 * k;
    if (phase === DZ.WAKE && k < 1) p.chest.rotation.x += 0.5 * (1 - k) * Math.min(1, t / 0.6);   // a hand down, sitting up first
  }
}

/* Our own body (third person, the kill cam, a free look). */
localPosers.push((rig) => {
  if (!drunk.phase && drunk.k <= 0) return;
  poseDrunk(rig, drunk.phase, drunk.t, drunk.out?.dir || 1, drunk.k);
  rig.body?.update?.();
});
/* Peers: the phase off the wire, timed from when it changed here. */
peerPosers.push((rp) => {
  const dz = rp.alive ? rp.peer.dz | 0 : 0;
  if (dz !== (rp.dzWas | 0)) { rp.dzWas = dz; rp.dzAt = performance.now(); rp.dzDir ??= Math.random() < 0.5 ? -1 : 1; }
  if (!dz) return;
  // on the clock, not summed frames: a body off-screen is posed less often
  rp.dzT = (performance.now() - rp.dzAt) / 1000;
  // a spell's strength isn't on the wire: a middling one
  poseDrunk(rp.rig, dz, rp.dzT, rp.dzDir, 0.6);
  if (dz >= DZ.SLUMP) rp.bodyPose.gait = false;
  rp.rig.body?.update?.();
});

window.__trollDrunk = { DRUNK, DZ, drunk, state: () => ({ phase: drunk.phase, t: drunk.t, next: drunk.next, spell: drunk.spell && { ...drunk.spell }, out: !!drunk.out, grace: drunk.grace, k: drunk.k, view: { ...drunk.view }, tipsy: bar.tipsy, filter: game.renderer?.domElement.style.filter || "", black: drunk.black?.style.opacity, vignette: drunk.el?.style.opacity, ghost: DOUBLE_VISION.k, ghostX: DOUBLE_VISION.x, baseFov: game.baseFov, fovSetting: settings.fov, camFov: game.camera?.fov }) };
