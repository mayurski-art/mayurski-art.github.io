// Troll Forces aim assist: the soft pull and slowdown toward targets near
// the crosshair, for stick, thumb and mouse. Moved out of game.js (split
// phase 1).

import * as THREE from "three";
import { segmentBlocked } from "../ballistics.js?v=cg1-wst-hf1-fu1b7-wb1-ar1-ar2";
import { game } from "../core/state.js?v=st1";

/* Aim assist — a soft rotational pull toward whatever is already near the
   crosshair, the way GTA5's "assisted aim" (not the full auto-lock option)
   nudges an aim rather than replacing it. It runs on every input, but only
   while that input is actually steering: the right stick deflected, a thumb
   on the touch look pad, or the mouse/trackpad moved in the last moment —
   so it never drags an aim that's being held still. Mouse gets a softer
   pull and slowdown, since a cursor is already far more precise than a
   stick or thumb. */
const AIM_ASSIST_CONE_DEG = 7;   // ~14° wide search cone at the default (hip) FOV
const AIM_ASSIST_SLOWDOWN_DEG = 3.5;
const AIM_ASSIST_RANGE = 55;
const AIM_ASSIST_PULL = 3.4;       // rad/sec at the very centre of a lock
const AIM_ASSIST_SLOWDOWN = 0.45;  // multiplies the player's own look turn near a target
// Thumbs get less friction than a stick: at 0.45 tracking a strafing
// target on the look pad felt like dragging through mud.
const AIM_ASSIST_TOUCH_SLOWDOWN = 0.75;
export const AIM_ASSIST_MOUSE_PULL = 0.5;       // share of the full pull a mouse gets
export const AIM_ASSIST_MOUSE_SLOWDOWN = 0.72;  // gentler "sticky" for mouse turns
export const MOUSE_ACTIVE_MS = 200;             // mouse counts as steering this long after it moves
const _aaOrigin = new THREE.Vector3();
const _aaForward = new THREE.Vector3();
const _aaToTarget = new THREE.Vector3();

/* Every point assist could lock onto this frame, as chest-height world
   positions. Players and bots come from occupants(); the zombies, wave
   grunts and range plates each keep their own lists, and used to be left
   out entirely, which is why assist seemed dead outside PvP. */
export function aimAssistPoints() {
  const pts = [];
  const ffa = game.currentMode().ffa;
  for (const o of game.occupants()) {
    if (o.id === game.net.id) continue;
    if (!ffa && o.team === game.net.team) continue;
    pts.push({ x: o.pos.x, y: o.pos.y + 1.3, z: o.pos.z });
  }
  const bodies = [...(game.zdir?.zombies || []), ...(game.spawner?.grunts || [])];
  for (const e of bodies) {
    if (!e.alive || e.dying) continue;
    const p = e.mesh.position;
    pts.push({ x: p.x, y: p.y + e.type.height * 0.72, z: p.z });
  }
  for (const t of game.rangeSet?.targets || []) {
    if (t.down > 0) continue;
    const p = t.mesh.position;
    // the painted ring: pivot (0.9) + 34% of the 1.7 plate
    pts.push({ x: p.x, y: p.y + 0.9 + 1.7 * 0.34, z: p.z });
  }
  return pts;
}

/* Best point to assist toward right now, or null. Picks whatever is closest
   to the crosshair (not just closest in space) inside the search cone, with
   actual line of sight. */
export function findAimAssistTarget(coneDeg = AIM_ASSIST_CONE_DEG, range = AIM_ASSIST_RANGE) {
  game.camera.getWorldPosition(_aaOrigin);
  game.camera.getWorldDirection(_aaForward);

  // The cone is a screen-space angle, not a world one: zoomed in (lower FOV)
  // the same enemy silhouette covers more of the screen, so the search cone
  // has to narrow with it or assist gets stronger while ADS/scoped and
  // weaker at hip-fire relative to what's actually on screen.
  const fovScale = game.camera.fov / game.baseFov;
  const cone = Math.cos(THREE.MathUtils.degToRad(coneDeg * fovScale));

  let best = null, bestDot = -Infinity;
  for (const pt of aimAssistPoints()) {
    _aaToTarget.set(pt.x - _aaOrigin.x, pt.y - _aaOrigin.y, pt.z - _aaOrigin.z);
    const dist = _aaToTarget.length();
    if (dist < 0.01 || dist > range) continue;
    _aaToTarget.multiplyScalar(1 / dist);

    const dot = _aaToTarget.dot(_aaForward);
    if (dot < cone || dot <= bestDot) continue;
    if (segmentBlocked(game.colliders, _aaOrigin, pt)) continue;
    bestDot = dot; best = { aim: pt, dot, cone };
  }
  return best;
}

/* Blends a rotational pull toward `target` into the look, and damps the
   player's own stick/thumb turn when it's already close — the "sticky" half
   GTA5 pairs with the pull. Both effects fall off with angle so the assist
   never overrides a deliberate flick past the target. */
export function applyAimAssist(dt, strength = 1, coneDeg = AIM_ASSIST_CONE_DEG, range = AIM_ASSIST_RANGE) {
  if (!game.settings.aimAssist) return;
  // Cooking a grenade or a tactical: you're aiming the throw (an arc, a
  // corner, the floor), not at anyone, so nothing pulls or sticks the look.
  if (game.cooking.def) return;
  const target = findAimAssistTarget(coneDeg, range);
  if (!target) return;

  game.camera.getWorldPosition(_aaOrigin);
  const a = target.aim;
  _aaToTarget.set(a.x - _aaOrigin.x, a.y - _aaOrigin.y, a.z - _aaOrigin.z).normalize();

  // Desired yaw/pitch to look straight at the target, minus what we're
  // already facing — small angular deltas pulled toward zero.
  const desiredYaw = Math.atan2(-_aaToTarget.x, -_aaToTarget.z);
  const desiredPitch = Math.asin(THREE.MathUtils.clamp(_aaToTarget.y, -1, 1));
  let dYaw = desiredYaw - game.look.yaw;
  while (dYaw > Math.PI) dYaw -= Math.PI * 2;
  while (dYaw < -Math.PI) dYaw += Math.PI * 2;
  const dPitch = desiredPitch - game.look.pitch;

  // Pull strength eases out toward the edge of the cone rather than cutting
  // off sharply, so entering/leaving lock doesn't feel like a snap.
  const edge = (target.dot - target.cone) / (1 - target.cone);
  const pull = AIM_ASSIST_PULL * strength * edge * dt;
  game.look.yaw += THREE.MathUtils.clamp(dYaw, -pull, pull);
  game.look.pitch += THREE.MathUtils.clamp(dPitch, -pull, pull);

  const fovScale = game.camera.fov / game.baseFov;
  const slowdownCone = Math.cos(THREE.MathUtils.degToRad(AIM_ASSIST_SLOWDOWN_DEG * fovScale));
  if (target.dot > slowdownCone) {
    game.aimAssistSticky = true;
    game.gamepadState.lookDX *= AIM_ASSIST_SLOWDOWN;
    game.gamepadState.lookDY *= AIM_ASSIST_SLOWDOWN;
    game.touchState.lookDX *= AIM_ASSIST_TOUCH_SLOWDOWN;
    game.touchState.lookDY *= AIM_ASSIST_TOUCH_SLOWDOWN;
  }
}
