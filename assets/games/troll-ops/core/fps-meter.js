// Troll Forces frame-rate readout (Settings > Show FPS). The user asked for
// it on 2026-10-12 to report real numbers from real machines, after the Troll
// Royale lag work. It counts its own animation frames (the game draws one
// frame per requestAnimationFrame, so that's the game's frame rate) and
// shows, twice a second: frames per second, the slowest frame in that half
// second (a hitch the average hides), and the graphics level in use.

import { game } from "./state.js?v=st1";

const PERIOD = 500;   // ms between readings
let el = null, on = false, raf = 0;
let last = 0, start = 0, frames = 0, worst = 0;

function ensure() {
  if (el) return el;
  el = document.createElement("div");
  el.id = "to-fps";
  el.className = "to-fps";
  el.setAttribute("aria-hidden", "true");   // a readout, not something to tab to
  el.hidden = true;
  document.body.appendChild(el);
  return el;
}

function tick(now) {
  raf = requestAnimationFrame(tick);
  if (last) {
    frames++;
    worst = Math.max(worst, now - last);
  }
  last = now;
  if (now - start < PERIOD) return;
  const fps = frames * 1000 / (now - start);
  const tier = (game.gfxTier?.() || "").toUpperCase();
  el.textContent = `${Math.round(fps)} FPS · worst ${Math.round(worst)} ms${tier ? ` · ${tier}` : ""}`;
  // Green at 55+, amber to 30, red under: readable at a glance in a screenshot.
  el.dataset.band = fps >= 55 ? "good" : fps >= 30 ? "ok" : "bad";
  start = now; frames = 0; worst = 0;
}

/* Show or hide it (applySettings calls this with settings.fps). */
export function showFps(show) {
  show = !!show;
  if (show === on) return;
  on = show;
  ensure().hidden = !show;
  if (show) {
    last = 0; start = performance.now(); frames = 0; worst = 0;
    el.textContent = "… FPS";
    raf = requestAnimationFrame(tick);
  } else cancelAnimationFrame(raf);
}
