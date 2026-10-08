// The match clock: counts down once a timed PvP match goes live, painted
// on the HUD only when the shown second changes.

import { infectionStarted } from "./infection.js?v=in1-si1-gj1-fu1b7b7d";
import { checkMatchEnd } from "../combat/scoring.js?v=sc1-kc2-si1-gj1-fu1b7b7d";
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
  if (game.matchClockT === null) return;
  if (game.isInfection() && !infectionStarted) return;   // the clock starts with the first infection
  game.matchClockT = Math.max(0, game.matchClockT - dt);
  paintMatchClock();
  if (game.matchClockT <= 0) checkMatchEnd();
}
