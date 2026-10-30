// Troll Forces — how big the match view renders on phones and iPads. Every
// full-size target (the composer's pair, SSAO's, the ink's, bloom's) scales
// with the pixels drawn, and an iPad at 2x renders 2732x2048: ~450 MB of
// render buffers on Kabukigrin (2026-10-25), on top of its textures. A touch
// device draws at most PIXEL_BUDGET pixels (a phone keeps its 2x; an iPad
// lands near 1.2x), its canvas has no MSAA of its own (the composer's
// targets do the antialiasing; the canvas only takes the final copy), and
// its sun shadow stays at SHADOW_MAX. A desktop may climb to 2x and 2048
// (startPixelRatio says where it starts).
// tools/troll-ops-phone-mem-test.mjs measures it.

import { TOUCH } from "./texture-budget.js?v=pm1";

const PIXEL_BUDGET = 1.6e6;
const SHADOW_MAX = TOUCH ? 1024 : 4096;
export const CANVAS_MSAA = !TOUCH;

/* The graphics tiers (game.js applyGraphics; Auto steps through them). */
export const GFX_TIERS = ["high", "medium", "low"];
export const GFX = {
  high:   { ssao: true,  bloom: true,  shadowSize: Math.min(2048, SHADOW_MAX) },
  medium: { ssao: false, bloom: true,  shadowSize: Math.min(2048, SHADOW_MAX) },
  low:    { ssao: false, bloom: false, shadowSize: 1024 },
};
/* The share of a map's clutter drawn per tier, so phones get a lighter map
   (map detail pass). Instances are placed in random order, so any leading
   share is spread evenly. */
export const CLUTTER_SHARE = { low: 0.15, medium: 0.35, high: 0.55 };
/* MSAA on the composer's targets per tier. Phones keep 2 even on Low:
   sharpness was the complaint there, and a phone's tiled GPU resolves MSAA
   cheaply. A laptop on Low drops it, since that's a struggling iGPU. */
export const MSAA_SAMPLES = { high: 4, medium: 2, low: TOUCH ? 2 : 0 };

// Phones used to fall to 0.6, which is what made them blurry: effects and
// then the auto tier go first, and the picture stays at least 1:1.
export const MIN_PIXEL_RATIO = TOUCH ? 1 : 0.75;

const windowArea = () => Math.max(1, window.innerWidth * window.innerHeight);
// The largest ratio that draws `pixels`, in eighths, between lo and hi.
const ratioFor = (pixels, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Math.sqrt(pixels / windowArea()) * 8) / 8));

/* The highest pixel ratio the view may use now (the window's area decides
   it on touch, so turning the device doesn't change it). */
export function maxPixelRatio() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  return TOUCH ? ratioFor(PIXEL_BUDGET, 1, dpr) : dpr;
}

/* Big screens (user, 2026-10-29): a desktop starts at no more than a 1440p
   frame's pixels (a 4K monitor at 1.5x started at 3840x2160 and lagged until
   Auto caught up), and climbs to maxPixelRatio if it holds 57 fps. After
   that it starts at the pixel count it last settled on, kept as pixels, not
   a ratio, so a window moved to another monitor starts at the same cost. */
const DESKTOP_START = 2560 * 1440;
const RATIO_KEY = "trollops:gfx-pixels";

export function startPixelRatio() {
  let kept = 0;
  try { kept = Number(localStorage.getItem(RATIO_KEY)) || 0; } catch { /* storage blocked */ }
  // A first match never starts under 1:1; one that settled lower may.
  if (kept) return ratioFor(kept, MIN_PIXEL_RATIO, maxPixelRatio());
  return ratioFor(TOUCH ? PIXEL_BUDGET : DESKTOP_START, 1, maxPixelRatio());
}

export function rememberPixelRatio(ratio) {
  try { localStorage.setItem(RATIO_KEY, String(Math.round(ratio * ratio * windowArea()))); } catch { /* private mode */ }
}

/* Auto's first tier on a device that hasn't settled one yet. A phone starts
   without SSAO, so it never spends its opening seconds lagging (and shedding
   resolution) to find that out; so does a desktop on a graphics chip built
   into the CPU, and a software renderer starts on Low. A browser that hides
   the GPU's name gets High, as before. */
export function firstGfxTier(renderer) {
  if (TOUCH) return "medium";
  let gpu = "";
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || "");
  } catch { /* no context */ }
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) return "low";
  if (/\barc\b/i.test(gpu)) return "high";   // Intel's own graphics cards
  if (/intel|iris|uhd|hd graphics|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics|adreno|mali/i.test(gpu)) return "medium";
  return "high";
}
