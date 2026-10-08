// The pistols' slides in your hands (weapon-pistols.js builds them with a
// userData.pistolAction { slide, slideRestZ, travel }): back and home on
// every shot, locked back on the last round, held back through an empty
// reload until the slide release, and a press-check in the admire.

import { smoothstep } from "../anim-curves.js";

const RELEASE_AT = 0.76;             // empty reload: the slide drops here (reload progress)
const PRESS_AT = [0.24, 0.42];       // the admire's press-check (inspect progress)

/* Called each frame after the gun is posed. `magT` is the reload's
   progress (-1 when not reloading), `inspect` the admire's (-1 when not
   admiring). Returns "release" on the frame an empty reload drops the
   slide home, so the caller can play it. */
export function placePistolSlide(mesh, w, magT, inspect = -1) {
  const a = mesh?.userData.pistolAction;
  if (!a) return null;
  let back = 0, event = null;
  if (magT >= 0) {
    // An empty reload holds the slide back until the fresh mag is seated,
    // then the slide stop drops and it slams home.
    if (w.reloadWasEmpty) {
      back = magT < RELEASE_AT ? 1 : 1 - smoothstep(Math.min(1, (magT - RELEASE_AT) / 0.035));
      if (magT >= RELEASE_AT && !a.released) { a.released = true; event = "release"; }
      else if (magT < RELEASE_AT) a.released = false;
    }
  } else if (w.slideLocked) {
    back = 1;
    a.released = false;
  } else if (w.slideT > 0 && w.def.slideCycle) {
    // Back hard, home on the spring: fast out, a touch slower in.
    const t = 1 - w.slideT / w.def.slideCycle;
    back = t < 0.35 ? smoothstep(t / 0.35) : 1 - smoothstep((t - 0.35) / 0.65);
  } else if (inspect > PRESS_AT[0] && inspect < PRESS_AT[1]) {
    const k = (inspect - PRESS_AT[0]) / (PRESS_AT[1] - PRESS_AT[0]);
    back = 0.4 * Math.sin(Math.min(1, k / 0.8) * Math.PI);
  }
  a.slide.position.z = a.slideRestZ + back * a.travel;
  a.back = back;
  return event;
}
