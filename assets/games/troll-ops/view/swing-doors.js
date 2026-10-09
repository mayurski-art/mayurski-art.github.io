// Troll Forces — swing doors (Trolling Loud's kitchen, trollingloud-kitchen.js).
//
// A map lists its doorways as `doors()`: each has two leaves on hinges and
// swings open away from whoever walks up to it (you, other players, bots,
// the townsfolk), holds a moment once they're through, and springs shut
// with a little overshoot. Every client swings its own copy from positions
// it already has: nothing on the wire, no collider on a leaf.

import { game } from "../core/state.js?v=st1";

const OPEN = 1.66;        // rad, ~95°
const NEAR = 1.45;        // m either side of the doorway that opens it
const HOLD = 0.8;         // s open after the last one's through
const SPRING = 70, DAMP = 6.5;   // shutting: a soft spring that overshoots once

let bodies = [];

function gather() {
  bodies.length = 0;
  if (game.player.alive) bodies.push(game.move.pos);
  for (const rp of game.remotes.byId.values()) if (rp.pos && rp.visible !== false) bodies.push(rp.pos);
  for (const b of game.bots?.bots ?? []) if (b.alive && b.pos) bodies.push(b.pos);
  for (const n of game.townNpcs?.list ?? []) if (!n.off && n.moving) bodies.push(n);
}

/* Which side of the doorway someone's on, and whether they're at it:
   +1/-1 along its normal (+z for a door in an x wall, +x for one in a z
   wall), 0 if they're not near. */
function sideOf(d, p) {
  const along = d.along === "x" ? p.x - d.x : p.z - d.z;
  const across = d.along === "x" ? p.z - d.z : p.x - d.x;
  const py = p.y ?? d.y;
  if (Math.abs(along) > d.w / 2 + 0.25 || Math.abs(across) > NEAR || Math.abs(py - d.y) > 1.5) return 0;
  return across >= 0 ? 1 : -1;
}

export function updateSwingDoors(dt) {
  const doors = game.builtMap?.map?.doors?.();
  if (!doors?.length) return;
  gather();
  const cam = game.camera.position;
  for (const d of doors) {
    let near = 0;
    for (const p of bodies) { const s = sideOf(d, p); if (s) { near = s; break; } }
    if (near) {
      d.hold = HOLD;
      // swing away from them, unless it's already open the other way (they're coming through)
      if (!d.side || Math.abs(d.ang) < 0.15) d.side = -near;
    } else d.hold = Math.max(0, d.hold - dt);
    const target = d.hold > 0 ? d.side * OPEN : 0;
    if (target) {
      d.ang += (target - d.ang) * Math.min(1, dt * 9);   // flung open
      d.vel = 0;
    } else {
      // in small steps: a slow frame mustn't kick the spring out of shape
      for (let left = Math.min(dt, 0.25); left > 1e-6; left -= 1 / 120) {
        const h = Math.min(left, 1 / 120);
        d.vel += (-SPRING * d.ang - DAMP * d.vel) * h;
        d.ang += d.vel * h;
      }
      if (Math.abs(d.ang) < 0.002 && Math.abs(d.vel) < 0.02) { d.ang = 0; d.vel = 0; d.side = 0; }
    }
    // a whoosh on the way open, a soft thump as it settles shut
    const open = Math.abs(d.ang) > 0.5;
    if (open !== d.wasOpen) {
      d.wasOpen = open;
      if (Math.hypot(cam.x - d.x, cam.z - d.z) < 22 && game.audio?._ready?.()) {
        const at = { x: d.x, y: d.y + 1, z: d.z };
        if (open) game.audio._tone({ freq: 240, to: 90, duration: 0.18, gain: 0.035, type: "triangle", at });
        else game.audio._tone({ freq: 120, to: 55, duration: 0.09, gain: 0.06, type: "sine", delay: 0.12, at });
      }
    }
    for (const L of d.leaves) L.pivot.rotation.y = L.base + L.sgn * d.ang;
  }
}
