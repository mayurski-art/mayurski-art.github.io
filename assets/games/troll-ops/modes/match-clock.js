// The match clock: counts down once a timed PvP match goes live, painted
// on the HUD only when the shown second changes. Its tick also runs the
// frozen-bot watch.

import { infectionStarted } from "./infection.js?v=in1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2";
import { checkMatchEnd } from "../combat/scoring.js?v=sc1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2";
import { watchBots } from "./bot-watch.js?v=bw1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2";
import { game } from "../core/state.js?v=st1";

export function resetMatchClock() {
  const mode = game.currentMode();
  game.matchClockT = mode.pvp && mode.timeLimit ? mode.timeLimit : null;
  game.matchClockShown = -1;
  game.els.hudMatchClock.hidden = game.matchClockT === null;
  if (game.matchClockT !== null) paintMatchClock();
}

export function paintMatchClock() {
  const whole = Math.max(0, Math.ceil(game.matchClockT));
  if (whole === game.matchClockShown) return;
  game.matchClockShown = whole;
  const mins = Math.floor(whole / 60), secs = whole % 60;
  game.els.hudMatchClock.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
}

export function updateMatchClock(dt) {
  watchBots(dt);   // every frame of a live match, timed or not (modes/bot-watch.js)
  if (game.matchClockT === null) return;
  if (game.isInfection() && !infectionStarted) return;   // the clock starts with the first infection
  game.matchClockT = Math.max(0, game.matchClockT - dt);
  paintMatchClock();
  if (game.matchClockT <= 0) checkMatchEnd();
}
