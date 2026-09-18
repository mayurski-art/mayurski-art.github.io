// Troll Ops — shared easing/curve helpers for viewmodel + movement animation.
//
// Extracted from three independent copies of the same cubic smoothstep
// (game.js inspect poses, gear.js melee track sampling, movement.js vault)
// plus the exponential-decay "lerp toward target" idiom copy-pasted across
// game.js/movement.js/weapons.js. Behavior-preserving extraction: every
// call site this replaces must produce bit-identical output.

/** Cubic smoothstep, 0..1 in, 0..1 out, monotonic ease with zero endpoint slope. */
export function smoothstep(k) {
  return k * k * (3 - 2 * k);
}

/* Each archetype gets its own staged motion (raise -> business -> settle)
   rather than one continuous wave, so it reads as a deliberate action instead
   of a wobble. `t` is 0..1 through the animation; `stage(a,b)` returns 0..1
   eased progress between two points in that timeline, 0 outside it. */
export function stage(t, a, b) {
  if (t <= a || t >= b) return 0;
  const k = (t - a) / (b - a);
  return Math.sin(k * Math.PI); // eases in and back out, peaks mid-stage
}

/* Monotonic 0->1 ease across the stage, then holds at 1 (for moves that
   land and stay, like a twirl settling the muzzle back level). */
export function rise(t, a, b) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  return smoothstep((t - a) / (b - a));
}

/** Exponential-decay approach toward `target`, framerate-independent via
 *  the `Math.min(1, dt*lambda)` clamp already used at every call site this
 *  replaces. Returns the new value; does not mutate. */
export function damp(current, target, lambda, dt) {
  return current + (target - current) * Math.min(1, dt * lambda);
}
