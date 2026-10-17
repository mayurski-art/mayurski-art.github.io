// Troll Forces Zombies: the run's cash. Kills and cleared waves pay it
// (Zombie Rush: cash is kill-driven, a hit pays nothing); the upgrade
// column spends it (upgrades.js). The HUD reads `econ` every frame and
// drains `econ.feed` into its "+$15 ZOMBIE KILL" lines.

import { spawnDamageNumber } from "../../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1";

export const econ = {
  cash: 0,
  earned: 0,     // this run, for the results card
  gain: 0,       // the "+$37" over the counter: recent earnings, summed
  gainT: 0,      // seconds that chip stays up
  feed: [],      // { amount, label } for the HUD's cash feed
};

const GAIN_SHOW = 1.4;
const CASH_LIFT = 0.75;  // metres

/* A cleared wave's bonus: $50 plus $10 a wave. */
export const waveBonus = (wave) => 50 + 10 * wave;

export function resetCash(start = 0) {
  econ.cash = start;
  econ.earned = 0;
  econ.gain = 0;
  econ.gainT = 0;
  econ.feed.length = 0;
}

/* Pay `amount`. `label` goes to the cash feed ("+$15 ZOMBIE KILL");
   `point` (world space) floats "+$15" over where it happened. */
export function earn(amount, label = null, point = null) {
  if (!(amount > 0)) return;
  econ.cash += amount;
  econ.earned += amount;
  econ.gain = econ.gainT > 0 ? econ.gain + amount : amount;
  econ.gainT = GAIN_SHOW;
  if (label) econ.feed.push({ amount, label });
  // a head higher than the kill's own damage number, so the two don't stack
  if (point) spawnDamageNumber(0, point.clone().setY(point.y + CASH_LIFT), false, `+$${amount}`);
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
