// The pause menu: open and close (a solo pause stops the game; with other
// people in the match only your own player freezes), and resume.

import { cancelMark } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1";
import { renderPauseRange } from "../modes/spawns.js?v=spw1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0";
import { renderRoomModeRow } from "../modes/social.js?v=so1-si1-mb1-gj1-if1-fu1b7b7dc1c2-wb1m1c4-tc3-cup1-nc1-th2-ar2-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0";
import { keys, lockChangedAt, controls } from "../input/keyboard-mouse.js?v=km1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1";
import { game } from "../core/state.js?v=st1";
import { classAllowed, classSwitch } from "../combat/perk-carry.js?v=pk1-cl1-bp1-fj1-zh1-zc1-zc2";

export function openPauseMenu() {
  // Esc out of a half-placed streak instead of opening the menu — the point
  // isn't committed yet and the charge hasn't been spent.
  if (game.markingStreak) { cancelMark(); return; }
  releaseHeldInputs();
  renderPauseRange();
  renderRoomModeRow();
  renderPauseClasses();
  if (game.otherHumansInMatch()) {
    game.localPauseOnly = true;
    game.els.pause.hidden = false;
  } else {
    game.gameState = "paused";
    game.els.pause.hidden = false;
  }
}
export function closePauseMenu() {
  game.localPauseOnly = false;
  if (game.gameState === "paused") game.gameState = "playing";
  game.els.pause.hidden = true;
  clearTimeout(resumeTimer);
  setResumeLabel(null);
  // Whatever was held when the menu opened was released then; anything
  // pressed while it was up (keys typed into it) must not leak into play.
  releaseHeldInputs();
}

/* BO2's Change Class: in any mode where you carry your own class (not the
   ones that hand you the gun: Gun Game, One in the Chamber, Royale, and not
   Socialize), the five classes. The pick is saved at once and lands on your
   next respawn (combat/damage.js respawnPlayer), never mid-life. */
export function renderPauseClasses() {
  const wrap = document.getElementById("to-pause-classes");
  if (!wrap) return;
  const mode = game.currentMode?.();
  const L = game.loadout;
  wrap.hidden = !L || !classAllowed(mode) || game.gameState === "menu";
  if (wrap.hidden) return;
  wrap.innerHTML = "";
  const pending = classSwitch.pending ?? L.active;
  L.classes.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `to-btn ${i === pending ? "to-btn-primary" : "to-btn-ghost"}`;
    b.textContent = c.name;
    b.title = L.classSummary(i);
    b.setAttribute("aria-pressed", String(i === pending));
    b.addEventListener("click", () => {
      L.setActiveClass(i);
      classSwitch.pending = i;
      showWaveBanner(`${c.name}: on your next respawn`);
      renderPauseClasses();
    });
    wrap.appendChild(b);
  });
}

/* Everything "held" as of now, let go: movement keys, trigger, ADS. The
   menu steals keyup/mouseup (they land on the overlay, or the tab lost
   focus), so without this you'd come back running, firing or scoped. */
export function releaseHeldInputs() {
  keys.clear();
  game.mouseDown = false;
  game.adsHeld = false;
  if (typeof game.gamepadState !== "undefined") { game.gamepadState.firing = false; game.gamepadState.ads = false; game.gamepadState.jump = false; }
}

/* Resume (the button, Start on a pad, Enter). Desktop resumes by taking the
   mouse back; Chrome refuses that for ~1s after Esc released it, which used
   to make the first Resume click do nothing at all. Now it waits out the
   cooldown on its own ("Resuming…") and, if the lock is still refused,
   drops the menu anyway so a click on the game picks the mouse up. */
let resumeTimer = 0;
const RELOCK_COOLDOWN = 1150;
export function resumePlay() {
  if (game.isTouch) { closePauseMenu(); return; }
  clearTimeout(resumeTimer);
  const wait = RELOCK_COOLDOWN - (performance.now() - lockChangedAt);
  const attempt = () => {
    controls.lock().then(() => {
      // Some browsers resolve without locking (no promise support): the
      // lock event closes the menu when it really happens.
    }).catch(() => {
      setResumeLabel(null);
      closePauseMenu();
      showWaveBanner("Click to take the mouse back", 1600);
    });
  };
  if (wait > 0) {
    setResumeLabel("Resuming…");
    resumeTimer = setTimeout(attempt, wait);
  } else attempt();
}

function setResumeLabel(text) {
  if (!game.els.resumeBtn) return;
  game.els.resumeBtn.textContent = text || "Resume";
  game.els.resumeBtn.disabled = !!text;
}
