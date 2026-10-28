// Troll Forces gamepad: BO2-style stick look, the per-frame pad poll that
// turns buttons into actions, and Start/menu handling while paused. Moved out
// of game.js (split phase 1).

import * as THREE from "three";
import { padEmotePressed } from "../menu/controller-layout.js?v=cl7-pd1-or1-pd2";
import { game } from "../core/state.js?v=st1";
import { nuke, callNuke } from "../streaks/nuke.js?v=tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1";
import { freeLook } from "../view/free-look.js?v=nf1";


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
// Hooks other systems hand the pad: zombies = the Zombie Rush HUD's buy /
// deploy controls (view/zombies-hud.js fills it in).
export const padHooks = { zombies: null, royale: null };
export const PAD_SENS_MULT = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.3, 3.6, 4];
export const PAD_SENS_NAMES = { 1: "Low", 3: "Medium", 5: "High", 7: "Very High", 9: "Insane" };
const PAD_LOOK_DEADZONE = 0.1;
const PAD_MOVE_DEADZONE = 0.18;
const PAD_CURVE = 2;                                      // magnitude ^ this
const PAD_YAW_RATE = THREE.MathUtils.degToRad(170);       // full push at Medium, hip
const PAD_PITCH_RATE = THREE.MathUtils.degToRad(105);
const PAD_ADS_RATE = 0.55;                                // hip -> iron sights
let padSelectAt = -1, padFree = false;   // Select: held since, holding free look
const PAD_FREE_HOLD_MS = 280;               // a hold this long is free look, not the 1P / 3P tap
const PAD_BOOST = 1.7;                                    // yaw x at the rim, fully ramped
const PAD_BOOST_EDGE = 0.95;                              // how far out counts as the rim
const PAD_BOOST_DELAY = 0.15;                             // s at the rim before it starts
const PAD_BOOST_RAMP = 0.35;                              // s to ramp to the full boost
const PAD_SMOOTH = 0.025;                                 // s, irons out stick jitter only
let padRimT = 0, padLookX = 0, padLookY = 0;
let padPlaceHold = false;   // Zombie Rush: a place/cancel press, until let go

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
const DPAD_HOLD = 0.3;     // seconds d-pad left is held before it's the emote wheel, not an inspect
let padSprint = false;      // L3's latched sprint (BO2: ends when you stop, aim or shoot)
let dpadLeftT = -1;         // how long d-pad left has been held; -1 = spent / not held
// With a Tactical Nuke banked, d-pad right held this long calls it; a tap is
// still the selected streak, fired on release instead of on press.
const NUKE_PAD_HOLD = 0.5;
let nukePadT = -1;
let gpDt = 0;
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
  // No aim assist on a stick (user, 2026-10-14: removed for every input).

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
  // D-pad right: a tap marks too, a hold cancels (calling.js
  // updateStreakControl), counted only from a press made with the tablet up.
  // The press that opened it is still down on the first frames, and this
  // branch used to leave endStreak at that press's "held" for as long as the
  // tablet was up, so the hold timer ran out and cancelled the strike by
  // itself (user, 2026-10-25: "when u click right d pad it sort of
  // autocancels").
  if (game.strikeTablet?.isOpen) {
    game.strikeTablet.stick(game.gamepadState.moveX + lookX, game.gamepadState.moveY + lookY, dt);
    game.gamepadState.lookDX = 0; game.gamepadState.lookDY = 0;
    game.gamepadState.moveX = 0; game.gamepadState.moveY = 0;
    if (pressedEdge(0) || pressedEdge(7)) game.strikeTablet.place();
    if (pressedEdge(1)) game.strikeTablet.undo();
    if (pressedEdge(15)) game.streakEnd.padAt = performance.now();
    if (game.gpPrev[15] && !btn(15) && game.streakEnd.padAt) {
      if (performance.now() - game.streakEnd.padAt < 300) game.strikeTablet.place();
      game.streakEnd.padAt = 0;
    }
    game.gamepadState.endStreak = !game.localPauseOnly && btn(15) && !!game.streakEnd.padAt;
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
  // Zombie Rush, placing a deployable (view/zombies-hud.js): R2 or A puts it
  // down, B lets it go; none of the three shoots, jumps or crouches until
  // they're let go.
  if (!game.localPauseOnly && padHooks.zombies?.placing()) {
    if (pressedEdge(7) || pressedEdge(0)) game.deployClick(0);
    else if (pressedEdge(1)) game.deployClick(2);
    padPlaceHold = true;
  }
  if (padPlaceHold) {
    if (!firingNow && !btn(0) && !btn(1)) padPlaceHold = false;
    else { game.gamepadState.firing = false; game.fireEdgeTrigger = false; game.gamepadState.jump = false; game.gamepadState.crouch = false; }
  }

  // The pause menu being open (with other people still live in the match)
  // keeps this function running so the Start button can still resume, but
  // every other action button must stop reaching the player's weapon/gear.
  // Black Ops 2's default Xbox 360 layout (user, 2026-10-14: "like we are
  // playing CODBO2 with a xbox360 controller ... reloading is x and weapon
  // swap is Y"): X reload (held: use / pick up), Y switch weapon, LB
  // tactical, RB lethal, L3 sprint, R3 melee, d-pad right the scorestreak
  // with up / down scrolling through the ones earned.
  if (!game.localPauseOnly) {
    // X / square: a tap reloads; held, it's use (pickup below). Not over the
    // bomb or a care package, where the hold is the whole point.
    if (pressedEdge(2) && !(game.isSnd() && game.sndCanInteract) && !game.nearbyPackage()) game.tryReload(true);
    if (pressedEdge(11)) game.swingMelee();        // R3 -> melee
    // L3 -> sprint, latched like BO2's: it holds while the stick is pushed
    // and ends when you stop, aim or shoot.
    if (pressedEdge(10)) padSprint = true;
    if (Math.hypot(game.gamepadState.moveX, game.gamepadState.moveY) < 0.2 || game.gamepadState.ads || firingNow) padSprint = false;
    game.gamepadState.sprint = padSprint;
    // A single emote button can be set on the Settings controller card
    // (controller-layout.js padEmoteButton); by default it's d-pad left held.
    if (padEmotePressed(gp, pressedEdge)) game.emoteWheel.toggle(game.gameState === "playing" && game.player.alive);
    if (pressedEdge(3)) game.cycleWeapon();        // Y / triangle -> cycle primary/secondary/melee
    // LB tactical, RB lethal. A loadout carries one of the two, so the other
    // bumper has nothing to throw.
    if (pressedEdge(4)) game.startCook("tactical");
    if (pressedEdge(5)) game.startCook("lethal");
    if ((game.gpPrev[4] && !btn(4)) || (game.gpPrev[5] && !btn(5))) game.releaseThrowKey();
    // D-pad left: a tap admires the gun, a hold opens the emote wheel.
    if (pressedEdge(14)) dpadLeftT = 0;
    if (btn(14) && dpadLeftT >= 0) {
      dpadLeftT += gpDt;
      if (dpadLeftT >= DPAD_HOLD) { dpadLeftT = -1; game.emoteWheel.toggle(game.gameState === "playing" && game.player.alive); }
    }
    if (game.gpPrev[14] && !btn(14)) { if (dpadLeftT >= 0) game.startInspect(); dpadLeftT = -1; }
    // Zombie Rush: d-pad up buys / deploys the highlighted card, down walks
    // the highlight (view/zombies-hud.js); Troll Royale (no streaks): up
    // puts on a plate, down takes Hopium (modes/royale.js); everywhere else
    // up and down scroll the scorestreaks.
    const zp = padHooks.zombies?.active() ? padHooks.zombies : null;
    const rp = !zp && padHooks.royale?.active() ? padHooks.royale : null;
    if (zp) {
      if (pressedEdge(12)) zp.useStart();
      if (game.gpPrev[12] && !btn(12)) zp.useEnd();
    } else if (rp) {
      if (pressedEdge(12)) rp.plate();
    } else if (pressedEdge(12)) game.cycleSelectedStreak(-1);   // D-pad up -> previous scorestreak
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
    // Select/View/Minus: a tap switches 1P / 3P; held in third person it's
    // free look (view/free-look.js), the right stick swinging the camera
    // round your troll until you let go
    if (pressedEdge(8)) padSelectAt = performance.now();
    if (btn(8) && padSelectAt >= 0 && !padFree && game.settings.thirdPerson && performance.now() - padSelectAt > PAD_FREE_HOLD_MS) { padFree = true; freeLook.held = true; }
    if (game.gpPrev[8] && !btn(8)) {
      if (padFree) freeLook.held = false;
      else if (padSelectAt >= 0) game.toggleThirdPerson();
      padFree = false; padSelectAt = -1;
    }

    // D-pad down: the next ready streak d-pad right will fire (up, above,
    // goes back) — a pick, not a use, the way BO2 scrolls its streak column.
    if (pressedEdge(13)) { if (zp) zp.next(); else if (rp) rp.heal(); else game.cycleSelectedStreak(1); }
    // D-pad right fires whichever streak is selected (a hero's ability in
    // Umbrella Academy). In a streak, it's the hold-to-end
    // (updateStreakControl); a quick tap while marking still confirms the
    // mark, on release so a hold that's ending it never confirms on the way.
    if (pressedEdge(15) && game.streakControlActive()) {
      game.streakEnd.padAt = performance.now();
      game.streakEnd.padShort = !!game.markingStreak;
    } else if (pressedEdge(15) && nuke.ready && !game.heroActive()) {
      nukePadT = 0;
    } else if (pressedEdge(15)) {
      if (game.heroActive()) game.useHeroAbility();
      else game.useSelectedStreak();
    }
    if (nukePadT >= 0 && btn(15)) {
      nukePadT += gpDt;
      if (nukePadT >= NUKE_PAD_HOLD) { nukePadT = -1; callNuke(); }
    } else if (nukePadT >= 0) {
      nukePadT = -1;
      game.useSelectedStreak();
    }
    if (game.gpPrev[15] && !btn(15) && game.streakEnd.padAt) {
      if (game.streakEnd.padShort && game.markingStreak && performance.now() - game.streakEnd.padAt < 300) game.useSelectedStreak();
      game.streakEnd.padAt = 0;
      game.streakEnd.padShort = false;
    }
  }
  // X held: use — pick up a weapon, open a package, plant / defuse, accept
  // a duo, the keyboard's held X. Read as a level because all of them are
  // holds, and gated on the pause the same way every other action button is.
  game.gamepadState.pickup = !game.localPauseOnly && btn(2) && !game.streakControlActive();
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
