// The bolt rifles' bolts in your hands (weapon-snipers.js builds them with
// a userData.boltAction { bolt, restZ, travel }): after every shot the
// handle lifts, the bolt rakes back and rides home, the handle drops; an
// empty reload works it once more to chamber the fresh mag.

import { smoothstep } from "../anim-curves.js";

const LIFT = 1.05;                       // handle swing up, radians about the bore
// Beats of one cycle as fractions of it: [start, end] of each move.
const UP = [0.12, 0.26], BACK = [0.28, 0.5], HOME = [0.56, 0.76], DOWN = [0.78, 0.9];
const CHAMBER_AT = 0.72;                 // empty reload: the cycle runs from here to the end

const span = (t, [a, b]) => smoothstep(Math.min(1, Math.max(0, (t - a) / (b - a))));
const BEATS = [["lift", UP[0]], ["back", BACK[0]], ["home", HOME[0]], ["lock", DOWN[1] - 0.02]];

/* Called each frame after the gun is posed. `magT` is the reload's
   progress (-1 when not reloading). Returns the beat ("lift" | "back" |
   "home" | "lock") crossed this frame, if any, so the caller can play it. */
export function placeBolt(mesh, w, magT) {
  const a = mesh?.userData.boltAction;
  if (!a) return null;
  let t = -1;
  if (magT >= 0) {
    if (w.reloadWasEmpty && magT >= CHAMBER_AT) t = (magT - CHAMBER_AT) / (1 - CHAMBER_AT);
  } else if (w.pumpT > 0 && w.pumpDur > 0 && w.def.fireMode === "bolt") {
    t = 1 - w.pumpT / w.pumpDur;
  }
  const lift = t < 0 ? 0 : span(t, UP) - span(t, DOWN);
  const back = t < 0 ? 0 : span(t, BACK) - span(t, HOME);
  a.bolt.rotation.z = lift * LIFT;
  a.bolt.position.z = a.restZ + back * a.travel;
  let beat = null;
  const prev = a.lastT ?? -1;
  if (t >= 0) for (const [name, at] of BEATS) if (prev < at && t >= at) beat = name;
  a.lastT = t;
  return beat;
}
