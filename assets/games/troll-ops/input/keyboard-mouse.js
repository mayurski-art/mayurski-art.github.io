// Keyboard and mouse: pointer lock, mouse look, every key binding, fire and
// aim on the buttons, and no text selection or drag outside typing fields.

import { strikeTablet } from "../streaks/fire.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-ar1";
import { AIM_ASSIST_MOUSE_SLOWDOWN } from "./aim-assist.js?v=in1-fu1b7-wb1-ar1";
import { settings } from "../menu/settings.js?v=ms1-gj1-fu1b7b7dc2-wb1m1c4-ar1";
import { lookSensScale } from "../streaks/warship.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-ar1";
import { charInspectorLive, menuEmoteWheel } from "../menu/lobby.js?v=lb1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-ar1";
import { skipKillcam } from "../combat/killcam-present.js?v=kp2-si1-gj1-fu1b7b7dc2-wb1m1c4-ar1";
import { royaleSpectating, cycleSpectate, royale, startRoyaleAct } from "../modes/royale.js?v=md1-gj1-fu1b7b7dc2-wb1m1c4-ar1";
import { tryReload, switchWeapon, setHolding } from "../combat/weapons.js?v=wp1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-ar1";
import { swivelTaps, SWIVEL_TAP, trySwivel } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-ar1";
import { startInspect } from "../view/weapon-view.js?v=wv1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-ar1";
import { swingMelee } from "../combat/melee.js?v=ml1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-ar1";
import { useHeroAbility } from "../modes/umb-heroes.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-ar1";
import { callStreakSlot } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-ar1";
import { startCook, carriedThrowSlot, cancelCook, releaseCook } from "../combat/throwables.js?v=th1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-ar1";
import { renderScoreboard } from "../core/scoreboard.js?v=sb1-gj1-if1-fu1b7b7dc2-wb1m1c4-ar1";
import { game } from "../core/state.js?v=st1";

// Look is composed by hand rather than by PointerLockControls: recoil and the
// touch stick both need to write into the same orientation, and letting PLC
// own the camera quaternion made them fight each other.
export const look = { yaw: 0, pitch: 0 };
const BASE_MOUSE_SENS = 0.0022;
export const PITCH_LIMIT = 1.5;

export const controls = new EventTarget();

/* When the lock last changed. Chrome refuses a re-lock for ~1s after an
   unlock (resumePlay waits it out), and the first mousemove after a fresh
   lock can carry a huge bogus delta (dropped below). */
export let lockChangedAt = 0;

export const keys = new Set();
// Belt and braces for style.css's no-select rule: no drag of any image or
// link, no selection start or long-press menu outside a typing field.
const typingField = (t) => !!t?.closest?.("input, textarea, [contenteditable='true']");

/* What used to run at load in game.js: called from game.js where this code was. */
export function initKeyboardMouse() {
  controls.isLocked = false;
  // requestPointerLock rejects (not throws) when the document isn't focused,
  // so swallow it rather than surfacing an unhandled rejection.
  controls.lock = () => {
    try {
      const p = game.renderer.domElement.requestPointerLock?.();
      p?.catch?.(() => {});
      return p || Promise.resolve();
    } catch (err) { return Promise.reject(err); }
  };
  controls.unlock = () => { try { document.exitPointerLock?.(); } catch { /* not locked */ } };
  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === game.renderer.domElement;
    controls.isLocked = locked;
    lockChangedAt = performance.now();
    controls.dispatchEvent(new Event(locked ? "lock" : "unlock"));
  });
  document.addEventListener("mousemove", (e) => {
    if (!controls.isLocked) return;
    // The strike tablet has the mouse: it steers the reticle, not the view.
    if (strikeTablet?.isOpen) { strikeTablet.moveCursor(e.movementX, e.movementY); return; }
    // The emote wheel has the mouse while it's open: the view holds still.
    if (game.emoteWheel.isOpen) { game.emoteWheel.move(e.movementX, e.movementY); return; }
    // Right after a re-lock the browser can report one enormous jump (the
    // cursor's travel while unlocked): swallow the first moments and cap any
    // single event, so resuming never snaps the view somewhere else.
    if (performance.now() - lockChangedAt < 60) return;
    const mx = Math.max(-300, Math.min(300, e.movementX));
    const my = Math.max(-300, Math.min(300, e.movementY));
    game.mouseLookAt = performance.now();
    // Near a target, aim assist makes the mouse a little "sticky" (see
    // applyAimAssist) — the same slowdown the stick gets, just gentler.
    const sticky = game.aimAssistSticky ? AIM_ASSIST_MOUSE_SLOWDOWN : 1;
    const sens = BASE_MOUSE_SENS * (settings.sens / 100) * sticky * lookSensScale();
    look.yaw -= mx * sens;
    look.pitch += (settings.invert ? 1 : -1) * my * sens;
    look.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, look.pitch));
  });
  window.addEventListener("keydown", (e) => {
    if (game.chat.isTyping) return;
    // Match chat: Enter for everyone, Y for your team (team modes).
    if ((e.code === "Enter" || e.code === "NumpadEnter" || e.code === "KeyY") && !e.repeat
        && game.gameState === "playing" && game.isPvp() && game.net.connected) {
      e.preventDefault();
      game.chat.open(e.code === "KeyY");
      return;
    }
    // The emote wheel (in a match, or on the menu's operator): H opens and
    // closes it, X plays what's hovered, Esc closes.
    const wheel = game.gameState === "menu" ? (charInspectorLive ? menuEmoteWheel : null) : game.emoteWheel;
    if (wheel && !e.repeat && !typingField(e.target)) {
      if (e.code === "KeyH" && !game.localPauseOnly) {
        wheel.toggle(game.gameState === "menu" || (game.gameState === "playing" && game.player.alive));
        return;
      }
      if (wheel.isOpen && e.code === "KeyX") { wheel.close(); return; }
      if (wheel.isOpen && e.code === "Escape") wheel.close(true);
    }
    keys.add(e.code);
    // View mode: the keys only fly the camera (and Esc still pauses).
    if (game.isView() && game.gameState === "playing" && e.code !== "Escape") return;
    if (e.code === "Space" && !e.repeat && game.killcam.active && !game.player.alive) skipKillcam();
    if ((e.code === "Space" || e.code === "Enter") && !e.repeat && game.matchIntro.active) game.matchIntro.skip();
    if (!e.repeat && !game.player.alive && royaleSpectating()) {
      if (e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "KeyQ") cycleSpectate(-1);
      if (e.code === "ArrowRight" || e.code === "KeyD" || e.code === "KeyE") cycleSpectate(1);
    }
    // Pause with other people still live in the match keeps gameState at
    // "playing" (see openPauseMenu) so their match doesn't stall, so these
    // action keys need their own guard now instead of relying on gameState.
    if (!game.localPauseOnly) {
      if (e.code === "KeyR") tryReload();
      if ((e.code === "KeyA" || e.code === "KeyD") && !e.repeat) {
        const now = performance.now() / 1000;
        if (now - swivelTaps[e.code] < SWIVEL_TAP) { trySwivel(e.code === "KeyA" ? -1 : 1); swivelTaps[e.code] = 0; }
        else swivelTaps[e.code] = now;
      }
      if (e.code === "KeyT" && !e.repeat) startInspect();
      if (e.code === "KeyV" && !e.repeat) swingMelee();
      if (e.code === "KeyE" && !e.repeat) useHeroAbility();
      if (e.code === "KeyB" && !e.repeat) game.toggleThirdPerson();
      if (e.code === "Digit1") switchWeapon("primary");
      if (e.code === "Digit2") switchWeapon("secondary");
      // Not mid-streak: it would yank the tablet/marker out of your hands.
      if (e.code === "Digit3" && game.player.holding !== "streak") setHolding("melee");
      // One key per streak row (4 = top). A single "call the priciest" key
      // fired the hunter-killer whenever you meant the care package.
      // Troll Royale has no streaks: 4 puts a plate on, 5 uses Hopium.
      if (royale && (e.code === "Digit4" || e.code === "Digit5") && !e.repeat) startRoyaleAct(e.code === "Digit4" ? "plate" : "heal");
      else if (/^Digit[4-7]$/.test(e.code) && !e.repeat) callStreakSlot(+e.code.slice(5) - 4);
      // G throws whatever throwable you brought (one slot: lethal OR tactical).
      if (e.code === "KeyG" && !e.repeat) startCook(carriedThrowSlot());
      // F is plant/defuse while you're somewhere you can do either (S&D);
      // everywhere else it's the tactical.
      if (e.code === "KeyF" && !e.repeat && !(game.isSnd() && game.sndCanInteract)) startCook("tactical");
    }
    // Range-only live tuning, so a sensitivity change can be felt immediately.
    if (game.isRange() && game.gameState === "playing" && !game.localPauseOnly) {
      if (e.code === "Minus") game.nudgeSetting("sens", -5, 0, 200);
      if (e.code === "Equal") game.nudgeSetting("sens", 5, 0, 200);
      if (e.code === "BracketLeft") game.nudgeSetting("fov", -1, 60, 100);
      if (e.code === "BracketRight") game.nudgeSetting("fov", 1, 60, 100);
      if (e.code === "KeyN" && !e.repeat) game.spawnRangeBot();
    }
    if (e.code === "Space" && game.gameState === "playing" && !game.localPauseOnly) e.preventDefault();
    if (e.code === "Tab" && game.gameState === "playing" && !game.localPauseOnly && game.isPvp()) {
      e.preventDefault();
      renderScoreboard();
      game.els.scoreboard.hidden = false;
    }
  });
  window.addEventListener("blur", () => { cancelCook(); game.emoteWheel.close(true); });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
    if (e.code === "Tab") game.els.scoreboard.hidden = true;
    if ((e.code === "KeyG" && game.cooking.slot)
      || (e.code === "KeyF" && game.cooking.slot === "tactical")) releaseCook();
  });
  game.renderer.domElement.addEventListener("mousedown", (e) => {
    if (!controls.isLocked) {
      // In play without the mouse (a refused re-lock, or resumed on a pad):
      // a click on the game takes it back instead of doing nothing.
      if (!game.isTouch && game.gameState === "playing" && game.els.pause.hidden) controls.lock();
      return;
    }
    if (strikeTablet?.isOpen) {
      if (e.button === 0) strikeTablet.place();
      else if (e.button === 2) strikeTablet.undo();
      return;
    }
    // Emote wheel open: a click plays what's hovered, a right click closes.
    if (game.emoteWheel.isOpen) {
      if (e.button === 0) game.emoteWheel.close();
      else if (e.button === 2) game.emoteWheel.close(true);
      return;
    }
    // Troll Royale, out: a click is next, a right click the one before.
    if (!game.player.alive && royaleSpectating() && (e.button === 0 || e.button === 2)) { cycleSpectate(e.button === 0 ? 1 : -1); return; }
    if (e.button === 0) game.mouseDown = true;
    if (e.button === 2) game.adsHeld = true;   // PF parity: right mouse aims
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) game.mouseDown = false;
    if (e.button === 2) game.adsHeld = false;
  });
  game.renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("dragstart", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => { if (!typingField(e.target)) e.preventDefault(); });
  document.addEventListener("contextmenu", (e) => { if (!typingField(e.target)) e.preventDefault(); });
}
