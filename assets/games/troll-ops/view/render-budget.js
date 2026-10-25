// Troll Forces — how big the match view renders on phones and iPads. Every
// full-size target (the composer's pair, SSAO's, the ink's, bloom's) scales
// with the pixels drawn, and an iPad at 2x renders 2732x2048: ~450 MB of
// render buffers on Kabukigrin (2026-10-25), on top of its textures. A touch
// device draws at most PIXEL_BUDGET pixels (a phone keeps its 2x; an iPad
// lands near 1.2x), its canvas has no MSAA of its own (the composer's
// targets do the antialiasing; the canvas only takes the final copy), and
// its sun shadow stays at SHADOW_MAX. A desktop keeps 2x and 2048.
// tools/troll-ops-phone-mem-test.mjs measures it.

import { TOUCH } from "./texture-budget.js?v=pm1";

const PIXEL_BUDGET = 1.6e6;
export const SHADOW_MAX = TOUCH ? 1024 : 4096;
export const CANVAS_MSAA = !TOUCH;

/* The highest pixel ratio the view may use now (the window's area decides
   it on touch, so turning the device doesn't change it). */
export function maxPixelRatio() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!TOUCH) return dpr;
  const area = Math.max(1, window.innerWidth * window.innerHeight);
  return Math.max(1, Math.min(dpr, Math.floor(Math.sqrt(PIXEL_BUDGET / area) * 8) / 8));
}
