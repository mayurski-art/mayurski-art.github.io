// Troll Forces: the combat roll (user, 2026-11-01: "e can be used for doing
// a rolling move ... RB button for controllers should be rolling move as
// well"). A tuck and roll the way you're moving (straight ahead standing
// still): ROLL_DIST m in ROLL_TIME s, then ROLL_COOLDOWN s before the next.
// No shooting or aiming while you tumble, and the gun drops out of view.
//
// Everyone else sees it on Troll Royale's landing-roll rig: rollRig and the
// state packet's `ro` (game.js puts combatRollK() beside royaleRollK()). In
// first person the view tucks and dips instead of going head over heels,
// which a move you can use every second would make sickening.

import { game } from "./state.js?v=st1";

export const ROLL_TIME = 0.6;
const ROLL_DIST = 3.2;         // m covered, mostly in the first half
const ROLL_COOLDOWN = 0.9;     // s after one ends
const PRESS_KEEP = 0.2;        // s a press waits for the next frame that can roll

const roll = { t: 0, on: false, cd: 0, x: 0, z: 0, prevF: 0, askedAt: -1 };

/* E / RB pressed: rolls on the next frame that allows it. */
export function requestRoll() { roll.askedAt = performance.now() / 1000; }

export function combatRolling() { return roll.on; }
export function combatRollK() { return roll.on ? Math.min(1, roll.t / ROLL_TIME) : 0; }
/* The way the roll goes (a yaw), so the body tumbles along it even when you
   roll sideways; null outside one. */
export function combatRollYaw() { return roll.on ? Math.atan2(-roll.x, -roll.z) : null; }
game.combatRollK = combatRollK;
game.combatRollYaw = combatRollYaw;

/* Before the move each frame: starts an asked-for roll if it can, and says
   whether you're rolling (the caller then drops the stick, as the roll
   carries you). `ix`, `iz` are the move input (strafe, forward). */
export function combatRollInput(frozen, ix, iz) {
  const m = game.move;
  if (roll.on && (frozen || !game.player.alive)) roll.on = false;
  const asked = roll.askedAt >= 0 && performance.now() / 1000 - roll.askedAt < PRESS_KEEP;
  if (asked && !roll.on && !frozen && roll.cd <= 0 && game.player.alive && m.grounded && !m.busy && !m.onRope
      && (m.stance === "stand" || m.stance === "crouch")) {
    roll.askedAt = -1;
    const yaw = game.look.yaw;
    let x = -Math.sin(yaw), z = -Math.cos(yaw);   // forward
    if (Math.hypot(ix, iz) > 0.05) {
      x = -Math.sin(yaw) * iz + Math.cos(yaw) * ix;
      z = -Math.cos(yaw) * iz - Math.sin(yaw) * ix;
      const n = Math.hypot(x, z);
      x /= n; z /= n;
    }
    Object.assign(roll, { on: true, t: 0, prevF: 0, x, z });
    game.audio.slide?.();
  }
  return roll.on;
}

/* After the move: carry the body along the roll (fast out, easing in). */
export function updateCombatRoll(dt) {
  roll.cd = Math.max(0, roll.cd - dt);
  if (!roll.on) return;
  roll.t += dt;
  const k = combatRollK();
  const f = 1 - (1 - k) * (1 - k);
  const step = (f - roll.prevF) * ROLL_DIST;
  roll.prevF = f;
  const m = game.move;
  m.pos.x += roll.x * step;
  m.pos.z += roll.z * step;
  m.resolveHorizontal(m.pos, m.pos.y);
  if (k >= 1) { roll.on = false; roll.cd = ROLL_COOLDOWN; }
}
