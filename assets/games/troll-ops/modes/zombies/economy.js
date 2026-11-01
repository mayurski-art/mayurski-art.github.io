// Troll Forces Zombies: the run's points (design doc "Zombies economy",
// claude.ai/artifact/CX7UuR3ybkeUvvNrbk9muS). Call of Duty's way: a hit pays
// HIT_PAY, up to HIT_CAP hits a zombie, and the kill pays by type, so a
// tougher zombie pays more and income keeps up with the late waves. The
// upgrade column, wall buys and doors spend it. The HUD reads `econ` every
// frame and drains `econ.feed` into its "+50 ZOMBIE KILL" lines.

import { spawnDamageNumber } from "../../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h-tn13";

export const econ = {
  cash: 0,
  earned: 0,     // this run, for the results card
  gain: 0,       // the "+370" over the counter: recent earnings, summed
  gainT: 0,      // seconds that chip stays up
  feed: [],      // { amount, label } for the HUD's points feed
  mult: 1,       // Double Points (drops.js): everything pays this many times
};

const GAIN_SHOW = 1.4;
const CASH_LIFT = 0.75;  // metres

/* A cleared wave's bonus: 25 a wave, 500 at most. */
export const waveBonus = (wave) => Math.min(500, 25 * wave);

/* A hit pays HIT_PAY, for the first HIT_CAP hits on a zombie. A shotgun's
   pellets are one hit: a shot's pellets land in one go (fireOnce), so hits
   on the same zombie in the same task count once. The kill shot is paid by
   the kill, not as a hit. */
export const HIT_PAY = 10;
export const HIT_CAP = 6;
let tick = 0, tickQueued = false;
function shotTick() {
  if (!tickQueued) { tickQueued = true; queueMicrotask(() => { tick++; tickQueued = false; }); }
  return tick;
}

/* What a kill pays, by zombie type. A headshot kill pays HEAD_BONUS more, a
   melee kill MELEE_BONUS more (a walker: 50, 100, 130). */
export const KILL_PAY = { walker: 50, runner: 60, leaper: 70, spitter: 90, bloater: 90, armoured: 100, brute: 120, mini: 1000, boss: 3000 };
const HEAD_BONUS = 50;
const MELEE_BONUS = 80;

export function killPoints(typeId, isHead = false, melee = false) {
  const base = KILL_PAY[typeId] ?? KILL_PAY.walker;
  if (base >= KILL_PAY.mini) return base;   // a boss pays its price, however it fell
  return base + (isHead ? HEAD_BONUS : 0) + (melee ? MELEE_BONUS : 0);
}

/* A hit that didn't kill: paid if it's one of the zombie's first HIT_CAP
   and not another pellet of the same shot. */
export function payHit(zombie, point = null) {
  const t = shotTick();
  if (zombie.paidTick === t) return;
  zombie.paidTick = t;
  zombie.paidHits = (zombie.paidHits | 0) + 1;
  if (zombie.paidHits > HIT_CAP) return;
  earn(HIT_PAY, null, point);
}

export function resetCash(start = 0) {
  econ.cash = start;
  econ.earned = 0;
  econ.gain = 0;
  econ.gainT = 0;
  econ.feed.length = 0;
}

/* Pay `amount`. `label` goes to the feed ("+50 ZOMBIE KILL"); `point`
   (world space) floats "+50" over where it happened. */
export function earn(amount, label = null, point = null) {
  if (!(amount > 0)) return;
  amount = Math.round(amount * econ.mult);
  econ.cash += amount;
  econ.earned += amount;
  econ.gain = econ.gainT > 0 ? econ.gain + amount : amount;
  econ.gainT = GAIN_SHOW;
  if (label) econ.feed.push({ amount, label });
  // a head higher than the kill's own damage number, so the two don't stack
  if (point) spawnDamageNumber(0, point.clone().setY(point.y + CASH_LIFT), false, `+${amount}`);
}

export const canAfford = (amount) => econ.cash >= amount;

export function spend(amount) {
  if (!canAfford(amount)) return false;
  econ.cash -= amount;
  return true;
}

export function tickCash(dt) {
  if (econ.gainT > 0) econ.gainT = Math.max(0, econ.gainT - dt);
}
