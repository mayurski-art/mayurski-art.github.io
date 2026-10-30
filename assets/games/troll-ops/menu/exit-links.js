// The ways out of the game.
//
// "Arcade" (the main menu's top-left link and its Arcade row) leaves for the
// arcade. Opened from the arcade, the game runs inside its full-screen frame
// (assets/js/fs-launcher.js), and a plain link would load the arcade inside
// that frame; same origin, so ask the arcade to close the frame instead.
//
// "Troll Forces home" (the pause menu and the game-over screen) reloads the
// game onto its main menu (trollrunner.net/warfare). From the pause menu it leaves
// the match first, the way "Leave match" does, so the match's XP is banked.
// With the radio playing it doesn't reload (that killed the song: user,
// 2026-10-29, "music should not pause when clicking on return to main
// menu"): it leaves the match in the page and the song plays on.

import { game } from "../core/state.js?v=st1";

export function leaveToArcade(e) {
  let launcher = null;
  try { launcher = window.parent !== window ? window.parent.TrollFSLauncher : null; } catch { /* not ours */ }
  if (!launcher?.close) return false;
  e?.preventDefault();
  launcher.close();
  return true;
}

export function initExitLinks() {
  document.querySelector(".to-pf-arcade")?.addEventListener("click", leaveToArcade);
  const home = (e) => {
    const keep = !!game.music?.playing;
    if (keep) e.preventDefault();
    if (game.els?.gameover) game.els.gameover.hidden = true;
    document.getElementById("to-quit-btn")?.click();
  };
  document.getElementById("to-exit-btn")?.addEventListener("click", home);
  // game over: only when the song keeps it in the page (the reload resets
  // the rest)
  document.getElementById("to-go-home-btn")?.addEventListener("click", (e) => { if (game.music?.playing) home(e); });
}
