// Troll Forces: free look in third person (user, 2026-10-15: "when users
// are in third person POV they should be able to see the front of their
// character as well, across all devices. i noticed that the camera
// restricts this").
//
// While it's on, whatever turns the view (the mouse, the right stick, the
// look pad) swings the camera round your body instead, all the way to your
// face; your aim, your movement and what everyone else sees stay where they
// were. Let go and the camera eases back behind you.
//   desktop: hold Alt          (input/keyboard-mouse.js)
//   pad:     hold Select        (a tap still switches 1P / 3P; input/gamepad.js)
//   touch:   the eye button     (a toggle beside 1P / 3P; input/touch.js)
//
// How: every frame, after the look input lands (view/player-update.js),
// capture() takes this frame's turn off game.look into the orbit and puts
// the aim back where it was held; the third-person camera
// (view/third-person.js) reads orbit() to place itself.

import { game } from "../core/state.js?v=st1";

const PITCH = [-0.9, 1.1];   // the orbit's tilt: up over the head, down to the knees
const EASE_IN = 10, EASE_OUT = 7;

export const freeLook = {
  held: false,      // an input is holding it on (Alt, Select, the eye)
  on: false,        // capturing this frame
  yaw: 0, pitch: 0, // the orbit off the aim (radians; yaw PI = facing you)
  w: 0,             // 0 behind the shoulder .. 1 orbiting the body
  anchor: { yaw: 0, pitch: 0 },
};

/* Free look is for third person on foot, alive, in a live match. */
function allowed() {
  return !!game.settings?.thirdPerson && game.gameState === "playing" && game.player?.alive && !game.emoteIsTp?.();
}

/* After this frame's look input, before anything reads game.look. */
export function captureFreeLook(dt) {
  const L = game.look;
  const want = freeLook.held && allowed();
  if (want && !freeLook.on) {
    freeLook.on = true;
    freeLook.anchor.yaw = L.yaw; freeLook.anchor.pitch = L.pitch;
  } else if (want) {
    freeLook.yaw += L.yaw - freeLook.anchor.yaw;
    freeLook.pitch = Math.max(PITCH[0], Math.min(PITCH[1], freeLook.pitch + L.pitch - freeLook.anchor.pitch));
    L.yaw = freeLook.anchor.yaw; L.pitch = freeLook.anchor.pitch;
  } else if (freeLook.on) {
    freeLook.on = false;
  }
  if (!freeLook.on) {
    // ease back behind, the short way round
    freeLook.yaw = Math.atan2(Math.sin(freeLook.yaw), Math.cos(freeLook.yaw));
    const k = Math.exp(-EASE_OUT * dt);
    freeLook.yaw *= k; freeLook.pitch *= k;
    if (Math.abs(freeLook.yaw) < 1e-3 && Math.abs(freeLook.pitch) < 1e-3) freeLook.yaw = freeLook.pitch = 0;
  }
  const target = freeLook.on ? 1 : Math.min(1, (Math.abs(freeLook.yaw) + Math.abs(freeLook.pitch)) * 2);
  freeLook.w += (target - freeLook.w) * (1 - Math.exp(-(freeLook.on ? EASE_IN : EASE_OUT) * dt));
  if (!freeLook.held && freeLook.w < 1e-3) freeLook.w = 0;
}

/* Turn it off at once (a match ending, a death, leaving third person). */
export function resetFreeLook() {
  freeLook.held = freeLook.on = false;
  freeLook.yaw = freeLook.pitch = freeLook.w = 0;
}
