// Holding a scorestreak: the device's call window (raise, hold, lower), the
// tablet dive for map-marked streaks, and putting the melee weapon away first.

import { POWER_HOLSTER_TIME, MELEE_DRAW_TIME } from "../combat/melee.js?v=ml1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1";
import { cancelCook } from "../combat/throwables.js?v=th1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1";
import { activeMeleeMesh } from "../view/viewmodels.js?v=vm1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-tg1-tw1-tcs1-er1-cu1";
import { callStreak } from "./calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-er1-cu1";
import { setHolding } from "../combat/weapons.js?v=wp1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-ar0-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1";
import { launchPendingDrone } from "./fire.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-tcs1-er1-cu1";
import { game } from "../core/state.js?v=st1";

export let streakHoldUntilMark = false;

/* The tablet used to swap with the gun in one frame both ways. Now ending a
   hold only starts the tablet lowering (updateStreakView); the gun comes
   back once it's down, rising from the sprint-lowered pose. */
export let streakLowering = false;

/* What's in the hand while holding === "streak": the tablet/remote (UAV,
   gunship, the strike's targeting), the care package marker, or the
   hunter-killer itself before it's tossed. */
export let streakDeviceKind = "tablet";
// Which page the tablet shows: "uav", "gunship", "strike" (drawTabletScreen).
export let streakScreen = "idle";
export const MARKER_THROW_TIME = 0.5;
export const DRONE_TOSS_AT = 0.6;          // seconds into the hold that the drone leaves the hand
let tabletDiveFx = null;
export const DIVE_LOOK = 0.42;       // share of the dive spent looking down at it
export function startTabletDive(dur, then = null) {
  game.tabletDive = { t: 0, dur: Math.max(0.5, dur), then };
}
export function tabletDiveK() { return game.tabletDive ? Math.min(1, game.tabletDive.t / game.tabletDive.dur) : 0; }
/* How far the view has tipped down onto the tablet (radians). */
export function tabletDiveDip() {
  if (!game.tabletDive) return 0;
  const k = tabletDiveK();
  const a = Math.min(1, k / DIVE_LOOK);
  return 0.38 * a * a * (3 - 2 * a);
}
export function updateTabletDive(dt) {
  if (!game.tabletDive) return;
  if (!game.player.alive || game.gameState !== "playing") { game.tabletDive = null; return; }
  game.tabletDive.t += dt;
  if (game.tabletDive.t >= game.tabletDive.dur) {
    const then = game.tabletDive.then;
    game.tabletDive = null;
    tabletDiveFlash();
    then?.();
  }
}
function tabletDiveFlash() {
  if (!tabletDiveFx) {
    tabletDiveFx = document.createElement("div");
    tabletDiveFx.className = "to-tablet-dive";
    tabletDiveFx.setAttribute("aria-hidden", "true");
    (game.els.streakMark?.parentElement || document.body).appendChild(tabletDiveFx);
  }
  tabletDiveFx.classList.remove("is-on");
  void tabletDiveFx.offsetWidth;   // restart the animation
  tabletDiveFx.classList.add("is-on");
  game.audio.reload();
}

/* Calling a streak with the melee weapon out (user): it's put away first —
   the draw played backwards, down and off low right, blade powering down —
   and the streak is called the moment it's gone. A swing in progress
   finishes first. `id` is the streak waiting on it. */
export const MELEE_HOLSTER_TIME = 0.4;
export let meleePutAway = false;       // true only while the holstered call runs
let streakReturnTo = "gun";     // what the hold hands back to: "gun" | "melee"

export function holsterMeleeFor(id) {
  if (game.meleeHolster) { game.meleeHolster.id = id; game.meleeHolster.then = null; return; }
  game.meleeHolster = { t: 0, id, started: false, len: powerHeld() ? POWER_HOLSTER_TIME : MELEE_HOLSTER_TIME };
  cancelCook();
}

/* Is the melee weapon in hand an energy blade (Trollsaber, Halo Blade)? */
export function powerHeld() {
  const ud = activeMeleeMesh?.userData;
  return game.player.holding === "melee" && !!(ud?.saber || ud?.halo);
}

/* Put the energy blade away before `then` runs (a weapon swap): it powers
   down in the hand, then drops out of view. */
export function holsterMeleeThen(then) {
  if (game.meleeHolster) { game.meleeHolster.then = then; return; }
  game.meleeHolster = { t: 0, id: null, then, started: false, len: POWER_HOLSTER_TIME };
  cancelCook();
}

export function finishMeleeHolster() {
  if (game.meleeHolster.then) {
    const then = game.meleeHolster.then;
    game.meleeHolster = null;
    meleePutAway = true;
    try { then(); } finally { meleePutAway = false; }
    return;
  }
  const id = game.meleeHolster.id;
  game.meleeHolster = null;
  meleePutAway = true;
  try { callStreak(id); } finally { meleePutAway = false; }
  if (game.player.holding === "streak") streakReturnTo = "melee";
  // The call didn't go through after all (spent, jammed...): draw it back.
  else if (game.player.holding === "melee") {
    game.meleeDrawT = game.meleeDrawLen = MELEE_DRAW_TIME;
    const ud = activeMeleeMesh?.userData;
    (ud?.saber || ud?.halo)?.ignite();
    if (ud) ud.holstered = false;
  }
}

export function beginStreakHold(seconds = 0, kind = "tablet", screen = null) {
  // Never interrupt a mid-swing; a held melee weapon goes through
  // holsterMeleeFor first.
  if (game.player.holding === "melee" && !meleePutAway) return;
  if (game.player.holding !== "streak" || streakDeviceKind !== kind) {
    game.streakHoldElapsed = 0;
    game.streakRaiseT = 0;
  }
  streakDeviceKind = kind;
  if (screen) streakScreen = screen;
  streakLowering = false;
  setHolding("streak");
  game.streakHoldT = seconds;
  streakHoldUntilMark = seconds <= 0;
}

export function endStreakHold(immediate = false) {
  game.streakHoldT = 0;
  streakHoldUntilMark = false;
  if (game.player.holding !== "streak") { streakLowering = false; return; }
  if (immediate || !game.player.alive) { finishStreakHold(); return; }
  streakLowering = true;
}

export function finishStreakHold() {
  streakLowering = false;
  game.streakRaiseT = 0;
  game.markerThrowT = 0;
  if (game.player.holding === "streak") {
    // Back to the melee weapon if that's what it was called off (it draws
    // itself back up), otherwise the gun - primary or secondary, whichever
    // slot was up.
    if (streakReturnTo === "melee") setHolding("melee");
    if (game.player.holding === "streak") setHolding("gun");
  }
  streakReturnTo = "gun";
  game.weaponLowerT = 1;
  if (game.pendingDroneLaunch) launchPendingDrone();
}

export function streakHoldActive() { return game.player.holding === "streak"; }
