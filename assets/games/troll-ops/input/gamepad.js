// Troll Forces gamepad: BO2-style stick look, the per-frame pad poll that
// turns buttons into actions, and Start/menu handling while paused. Moved out
// of game.js (split phase 1).

import * as THREE from "three";
import { applyAimAssist } from "./aim-assist.js?v=in1-fu1b7-wb1-ar1";
import { padEmotePressed } from "../controller-layout.js?v=cl7";
import { game } from "../core/state.js?v=st1";


/* Stick look, built like Black Ops 2's (user: "smooth like BO2"). The old
   look was stick × one flat speed with a square per-axis deadzone, so a
   small push already turned fast and diagonals snapped to an axis. BO2's
   feel comes from five things together:
   - a small ROUND deadzone, rescaled so the first bit past it starts at 0
     (no jump the moment the stick leaves centre)
   - a response curve: half a push is a quarter speed, so small corrections
     are fine and a full push is still quick
   - pitch turns slower than yaw (CoD's turn rates are about 0.6 : 1)
   - a turn boost: hold the stick at the rim and the yaw ramps up after a
     beat, so you can whip round without a high sensitivity (hip only)
   - ADS drops the rate, and a scope's zoom drops it further
   The 1–14 ladder is BO2's, 3 (Medium) its default. */
export const PAD_SENS_MULT = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.3, 3.6, 4];
export const PAD_SENS_NAMES = { 1: "Low", 3: "Medium", 5: "High", 7: "Very High", 9: "Insane" };
const PAD_LOOK_DEADZONE = 0.1;
const PAD_MOVE_DEADZONE = 0.18;
const PAD_CURVE = 2;                                      // magnitude ^ this
const PAD_YAW_RATE = THREE.MathUtils.degToRad(170);       // full push at Medium, hip
const PAD_PITCH_RATE = THREE.MathUtils.degToRad(105);
const PAD_ADS_RATE = 0.55;                                // hip -> iron sights
const PAD_BOOST = 1.7;                                    // yaw x at the rim, fully ramped
const PAD_BOOST_EDGE = 0.95;                              // how far out counts as the rim
const PAD_BOOST_DELAY = 0.15;                             // s at the rim before it starts
const PAD_BOOST_RAMP = 0.35;                              // s to ramp to the full boost
const PAD_SMOOTH = 0.025;                                 // s, irons out stick jitter only
let padRimT = 0, padLookX = 0, padLookY = 0;

/* Round deadzone, rescaled: returns [x, y, magnitude] with magnitude 0..1. */
export function radialStick(x, y, dz) {
  const m = Math.hypot(x, y);
  if (m <= dz) return [0, 0, 0];
  const n = Math.min(1, (m - dz) / (1 - dz));
  return [(x / m) * n, (y / m) * n, n];
}

/* The look turn for this frame (radians) from the right stick. */
export function padLookTurn(x, y, mag, dt) {
  const w = game.currentWeapon();
  const adsT = w?.adsT || 0;
  // Zoom past the plain iron sights (scopes) slows it in step with the FOV.
  const zoom = Math.min(1, game.camera.fov / (game.baseFov * 0.78));
  const ads = (1 - (1 - PAD_ADS_RATE) * adsT) * (adsT > 0.5 ? zoom : 1);
  const sens = (PAD_SENS_MULT[(game.settings.padSens | 0) - 1] ?? 1) * ads;

  const shaped = mag > 0 ? Math.pow(mag, PAD_CURVE) / mag : 0;
  let cx = x * shaped, cy = y * shaped;

  // Turn boost: mostly-sideways push at the rim, not aiming down sights.
  if (mag >= PAD_BOOST_EDGE && Math.abs(x) > 0.7 && adsT < 0.3) padRimT += dt;
  else padRimT = 0;
  const boost = 1 + (PAD_BOOST - 1) * THREE.MathUtils.clamp((padRimT - PAD_BOOST_DELAY) / PAD_BOOST_RAMP, 0, 1);

  // A very light low-pass, short enough not to read as lag; a released
  // stick still stops dead because the target is exactly 0.
  const k = 1 - Math.exp(-dt / PAD_SMOOTH);
  padLookX += (cx - padLookX) * k;
  padLookY += (cy - padLookY) * k;
  if (!cx && Math.abs(padLookX) < 1e-3) padLookX = 0;
  if (!cy && Math.abs(padLookY) < 1e-3) padLookY = 0;

  return [padLookX * PAD_YAW_RATE * sens * boost * dt, padLookY * PAD_PITCH_RATE * sens * dt];
}

let gpWheelSwallow = false;   // the A/B that worked the emote wheel isn't a jump/crouch
const STICK_CHORD = 0.12;  // seconds a stick click waits for the other stick
let stickChord = null, gpDt = 0;
export function pollGamepad(dt) {
  gpDt = dt;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = game.pickPad(pads, game.gpIndex);
  if (!gp) {
    game.gamepadState.connected = false;
    // Held-button state has to clear with the pad, or unplugging mid-hold
    // leaves `pickup` stuck on and the hold never releases.
    game.gamepadState.pickup = false;
    game.renderGpDebug(null);
    return;
  }
  game.gpIndex = gp.index;
  game.gamepadState.connected = true;
  if (game.gpDebugForced || gp.mapping !== "standard") game.renderGpDebug(gp);
  else if (game.gpDebugEl && !game.gpDebugEl.hidden) game.gpDebugEl.hidden = true;

  if (game.padRest.index !== gp.index) game.calibratePadRest();
  game.learnPadRest(gp.axes[0] || 0, gp.axes[1] || 0, dt);
  [game.gamepadState.moveX, game.gamepadState.moveY] = radialStick((gp.axes[0] || 0) - game.padRest.x, (gp.axes[1] || 0) - game.padRest.y, PAD_MOVE_DEADZONE);
  const [lookX, lookY, lookMag] = radialStick(gp.axes[2] || 0, gp.axes[3] || 0, PAD_LOOK_DEADZONE);
  const [turnX, turnY] = padLookTurn(lookX, lookY, lookMag, dt);
  game.gamepadState.lookDX += turnX;
  game.gamepadState.lookDY += turnY * (game.settings.invert ? -1 : 1);

  // Merely having a gamepad connected isn't "playing with a controller" — a
  // trackpad or certain mice enumerate as a Gamepad object too, and this
  // function used to run (and pull aim toward enemies) every frame any pad
  // object existed, even completely idle. Assist should only ever nudge the
  // look that the controller itself is actively driving, so it's gated on
  // real right-stick deflection this frame, not on pad presence.
  const usingGamepadLook = lookX !== 0 || lookY !== 0;
  if (usingGamepadLook && game.player.alive && !game.isStaging() && !game.dragonfireView()) applyAimAssist(dt);

  const btn = (i) => !!gp.buttons[i]?.pressed;
  const pressedEdge = (i) => btn(i) && !game.gpPrev[i];
  if (game.killcam.active && !game.player.alive && pressedEdge(0)) game.skipKillcam();
  if (game.matchIntro.active && pressedEdge(0)) game.matchIntro.skip();
  // Troll Royale, out: bumpers or the D-pad go round the players still alive.
  if (!game.player.alive && game.royaleSpectating()) {
    if (pressedEdge(4) || pressedEdge(14)) game.cycleSpectate(-1);
    if (pressedEdge(5) || pressedEdge(15)) game.cycleSpectate(1);
  }

  // The strike tablet takes the pad: either stick aims, A / R2 marks,
  // B undoes (and cancels with nothing marked). Nothing else fires.
  if (game.strikeTablet?.isOpen) {
    game.strikeTablet.stick(game.gamepadState.moveX + lookX, game.gamepadState.moveY + lookY, dt);
    game.gamepadState.lookDX = 0; game.gamepadState.lookDY = 0;
    game.gamepadState.moveX = 0; game.gamepadState.moveY = 0;
    if (pressedEdge(0) || pressedEdge(7)) game.strikeTablet.place();
    if (pressedEdge(1)) game.strikeTablet.undo();
    game.gamepadState.firing = false; game.gamepadState.jump = false; game.gamepadState.ads = false;
    game.gpPrev = {};
    for (let i = 0; i < gp.buttons.length; i++) game.gpPrev[i] = btn(i);
    return;
  }

  const firingNow = gp.buttons[7]?.value > 0.15 || btn(7);   // R2
  if (firingNow && !game.gamepadState.firing) { game.fireEdgeTrigger = true; setTimeout(() => game.fireEdgeTrigger = false, 16); }
  game.gamepadState.firing = firingNow;
  game.gamepadState.ads = gp.buttons[6]?.value > 0.15 || btn(6);      // L2
  game.gamepadState.jump = btn(0);                                     // A / cross
  game.gamepadState.crouch = btn(1);                                   // B / circle

  // The pause menu being open (with other people still live in the match)
  // keeps this function running so the Start button can still resume, but
  // every other action button must stop reaching the player's weapon/gear.
  if (!game.localPauseOnly) {
    if (pressedEdge(4)) game.tryReload();          // L1 -> reload (kept off fire face buttons)
    if (pressedEdge(2)) game.swingMelee();         // X / square -> melee
    // Stick clicks (user): both sticks together open the emote wheel; one
    // alone is the swivel to that side. Decided STICK_CHORD s after the
    // first click, so the second stick of a chord isn't read as a swivel.
    // A single emote button can be set on the Settings controller card
    // (controller-layout.js padEmoteButton) instead.
    if (padEmotePressed(gp, pressedEdge)) game.emoteWheel.toggle(game.gameState === "playing" && game.player.alive);
    if (!stickChord && (pressedEdge(10) || pressedEdge(11))) stickChord = { t: 0, l: false, r: false, done: false };
    if (stickChord) {
      stickChord.t += gpDt;
      stickChord.l ||= btn(10);
      stickChord.r ||= btn(11);
      if (!stickChord.done && stickChord.l && stickChord.r) {
        stickChord.done = true;
        game.emoteWheel.toggle(game.gameState === "playing" && game.player.alive);
      } else if (!stickChord.done && stickChord.t >= STICK_CHORD) {
        stickChord.done = true;
        game.trySwivel(stickChord.l ? -1 : 1);
      }
      if (stickChord.done && !btn(10) && !btn(11)) stickChord = null;
    }
    if (pressedEdge(3)) game.cycleWeapon();        // Y / triangle -> cycle primary/secondary/melee
    // R1 -> cook whatever throwable you brought. It used to be lethal-only,
    // so a loadout carrying a flash/smoke/EMP threw nothing on RB (user:
    // "throwable doesn't work on controller").
    if (pressedEdge(5)) game.startCook(game.carriedThrowSlot());
    if (game.gpPrev[5] && !btn(5)) game.releaseCook();
    // D-pad left does the same (NOT L1 — L1 is reload above, and one button
    // doing both would reload every time you threw a flash).
    if (pressedEdge(14)) game.startCook(game.carriedThrowSlot());
    if (game.gpPrev[14] && !btn(14)) game.releaseCook();
    if (pressedEdge(12)) game.startInspect();      // D-pad up -> admire the weapon
    // Emote wheel open (both sticks, above): the right stick points at a
    // slice instead of turning the view, Cross/A plays it, Circle/B closes.
    // A held A or B doesn't jump or crouch.
    if (game.emoteWheel.isOpen) {
      game.emoteWheel.aim(gp.axes[2] || 0, gp.axes[3] || 0);
      game.gamepadState.lookDX = 0; game.gamepadState.lookDY = 0;
      if (pressedEdge(0)) game.emoteWheel.close();
      else if (pressedEdge(1)) game.emoteWheel.close(true);
      gpWheelSwallow = true;
    }
    if (gpWheelSwallow) {
      if (btn(0) || btn(1)) { game.gamepadState.jump = false; game.gamepadState.crouch = false; }
      else if (!game.emoteWheel.isOpen) gpWheelSwallow = false;
    }
    if (pressedEdge(8)) game.toggleThirdPerson();  // Select/View/Minus -> camera toggle

    // D-pad down cycles which ready streak d-pad right will fire — a pick,
    // not a use, since the pad has a button to spare for it and keyboard's
    // single-button "4" doesn't need one.
    if (pressedEdge(13)) { if (game.heroActive()) game.useHeroAbility(); else game.cycleSelectedStreak(); }
    // D-pad right is context-dependent, the same way holding X already is:
    // over a dropped weapon or a landed package, hold it to pick up/open —
    // otherwise it fires whichever streak is currently selected. Checked
    // here (edge-triggered) only when nothing is underfoot; the hold case is
    // handled below by updatePickupPrompt reading gamepadState.pickup.
    // In a streak, d-pad right is the hold-to-end (updateStreakControl).
    // A quick tap while marking still confirms the mark, on release so a
    // hold that's ending it never confirms on the way.
    if (pressedEdge(15) && game.streakControlActive()) {
      game.streakEnd.padAt = performance.now();
      game.streakEnd.padShort = !!game.markingStreak;
    } else if (pressedEdge(15) && !game.nearbyPackage() && !game.pickups.nearest(game.move.pos.x, game.move.pos.z)
        && !(game.isSnd() && game.sndCanInteract) && !game.duoXClaimed) {
      game.useSelectedStreak();
    }
    if (game.gpPrev[15] && !btn(15) && game.streakEnd.padAt) {
      if (game.streakEnd.padShort && game.markingStreak && performance.now() - game.streakEnd.padAt < 300) game.useSelectedStreak();
      game.streakEnd.padAt = 0;
      game.streakEnd.padShort = false;
    }
  }
  // D-pad right, held: the pad's equivalent of holding X for swap/pickup/
  // open. Read as a level because all three are holds, and gated on the
  // pause the same way every other action button is. Whether this or the
  // edge-triggered streak-fire above actually does anything is decided by
  // updatePickupPrompt/useSelectedStreak looking at what's underfoot, same
  // question both ask.
  game.gamepadState.pickup = !game.localPauseOnly && btn(15) && !game.streakControlActive();
  game.gamepadState.endStreak = !game.localPauseOnly && btn(15);
  if (pressedEdge(9)) {                     // Start/Home -> same as the on-screen gear icon
    if (game.controls.isLocked) game.controls.unlock();
    else game.openPauseMenu();
  }

  game.gpPrev = {};
  for (let i = 0; i < gp.buttons.length; i++) game.gpPrev[i] = btn(i);
}

// Start/Home resumes from the pause menu the same way it opened it — kept
// separate from pollGamepad since that only runs during gameState==="playing".
let gpMenuPrev = {};
export function pollGamepadMenu() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = game.pickPad(pads, game.gpIndex);
  if (!gp) { gpMenuPrev = {}; return; }
  const pressed = !!gp.buttons[9]?.pressed;
  if (pressed && !gpMenuPrev[9] && !game.els.pause.hidden) {
    // A pad press isn't a gesture the browser accepts for pointer lock, so
    // asking for one here always failed and Start never resumed. The pad
    // doesn't need the mouse: close the menu and play.
    game.closePauseMenu();
    game.controls.lock();
  }
  gpMenuPrev = { 9: pressed };
}
