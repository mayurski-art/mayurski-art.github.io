// Troll Forces: the stonks rush (docs/CANDLE-LINES.md 5), what a candle
// line does to you after the snort (modes/social-lines.js L.done ticks).
//
// Rush, 20 s: you run a quarter faster, the room goes saturated with a
// green pull in the highlights and a touch more bloom, the lens opens a
// few degrees, a fast tremor on the camera and a heartbeat on the vignette.
// A translucent candlestick chart climbs up both edges of the screen, the
// price line spiking each time you sprint, the ticker across the top
// counting "$TROLL +420.69%" up, and STONKS stamped in at the start.
// Rug pull, 12 s: the chart turns red and falls off the bottom, RUGGED,
// the colour drains out, you move slower, a slow heavy sway. Then two
// seconds back to normal. Dying, leaving or the map changing ends it.
//
// Local, except the one state field others read (net `ln`: 1 rush, 2 rug)
// for the dust on your nose and the arrow over your head. Camera offsets
// add to the saloon's tipsy and the Pour up's trip; each is clamped alone.

import { game } from "../core/state.js?v=st1";
import { L as LINE } from "../modes/social-lines.js?v=cl1-kbc1-kbc2-kbc3-zft1-pqs1-fbo1";
import { gradeActive } from "./grade-pass.js?v=sr1-tm5-sp1-kbc1-kbc2-kbc3";
import { bloomActive } from "./post-look.js?v=hz1-kbk1-kbc1-kbc2-kbc3";
import { linesSfx } from "../sound/lines-sfx.js?v=cl1-kbc1-kbc2-kbc3";

export const STONKS = {
  rush: 20, rug: 12, out: 2,
  rampIn: 0.6,
  speedRush: 1.25, speedRug: 0.85,
  sat: 1.6, satRug: 0.6,
  bloom: 0.15, fov: 0.08,
  jitter: 0.0044,       // radians, 0.25 degrees at most
  pctFrom: 69.42, pctTo: 420.69,
};
if (typeof window !== "undefined" && window.__trollStonksTune) Object.assign(STONKS, window.__trollStonksTune);

const S = { on: false, t: 0, seen: 0, el: null, cv: null, g: null, ticker: null, stamp: null, last: 0, hb: 0, tick: 0,
  baseFov: null, fovSet: null, baseBloom: null, candles: [], nextCandle: 0, price: 100, spike: 0, stamped: "", rugged: false };
const NONE = { pitch: 0, yaw: 0, roll: 0 };
const out = { pitch: 0, yaw: 0, roll: 0 };
const smooth = (v) => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x); };
const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function build() {
  const el = document.createElement("div");
  el.className = "to-stonks";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<canvas class="to-stonks-chart"></canvas><div class="to-stonks-ticker"><span class="to-stonks-sym">$TROLL</span><span class="to-stonks-pct">+69.42%</span><span class="to-stonks-tape"></span></div><div class="to-stonks-stamp"></div>`;
  game.els.hud.prepend(el);
  S.el = el;
  S.cv = el.querySelector(".to-stonks-chart");
  S.g = S.cv.getContext("2d");
  S.ticker = el.querySelector(".to-stonks-pct");
  S.tape = el.querySelector(".to-stonks-tape");
  S.stamp = el.querySelector(".to-stonks-stamp");
}

export function startStonks() {
  if (!S.el) build();
  S.on = true; S.t = 0; S.hb = 0; S.tick = 0; S.rugged = false; S.stamped = "";
  S.candles = []; S.nextCandle = 0; S.price = 100; S.spike = 0;
  S.baseFov = game.baseFov; S.fovSet = null;
  S.baseBloom = bloomActive ? bloomActive.strength : null;
  S.el.style.opacity = "1";
  S.el.classList.remove("is-rug");
  stamp("STONKS");
  linesSfx.bell();
}
export function endStonks() {
  if (!S.on) return;
  S.on = false;
  if (S.el) { S.el.style.opacity = "0"; S.el.classList.remove("is-rug"); S.stamp.classList.remove("is-in"); }
  gradeActive?.setBoost(null);
  if (bloomActive && S.baseBloom != null) bloomActive.strength = S.baseBloom;
  if (S.fovSet != null && game.baseFov === S.fovSet) game.baseFov = S.baseFov;
  if (game.net) game.net.lineFx = 0;
}
export const stonksOn = () => S.on;
/* How fast you move right now: a multiplier on the walk (view/player-update.js). */
let speedK = 1;
export const stonksSpeed = () => speedK;
/* 0 off, 1 the rush, 2 the rug pull (the test reads it). */
export const stonksPhase = () => (!S.on ? 0 : S.t < STONKS.rush ? 1 : 2);

function stamp(text) {
  if (S.stamped === text) return;
  S.stamped = text;
  S.stamp.textContent = text;
  S.stamp.classList.remove("is-in");
  void S.stamp.offsetWidth;   // restart the animation
  S.stamp.classList.add("is-in");
}

/* Every frame (view/player-update.js): watches for a finished line, runs
   the rush, and returns the camera's extra { pitch, yaw, roll }. */
export function updateStonks(dt) {
  if (LINE.done > S.seen) { S.seen = LINE.done; startStonks(); }
  const now = performance.now(), gap = now - S.last;
  S.last = now;
  speedK = 1;
  if (!S.on) return NONE;
  if (!game.player.alive || game.gameState !== "playing" || !game.isSocial() || gap > 5000) { endStonks(); return NONE; }
  S.t += dt;
  const T = STONKS, t = S.t;
  if (t >= T.rush + T.rug + T.out) { endStonks(); return NONE; }
  const k = smooth(t / T.rampIn) * (1 - smooth((t - (T.rush - 1)) / 1));          // the rush's strength
  const r = smooth((t - T.rush) / 1.2) * (1 - smooth((t - (T.rush + T.rug)) / T.out));   // the rug pull's
  const rug = t >= T.rush;
  if (rug && !S.rugged) { S.rugged = true; S.el.classList.add("is-rug"); stamp("RUGGED"); linesSfx.sigh(); }
  // the look: saturation and a green pull, then drained grey; bloom; the lens
  gradeActive?.setBoost({ sat: 1 + (T.sat - 1) * k + (T.satRug - 1) * r, contrast: 1 + 0.06 * k - 0.06 * r,
    high: 0x5cff8a, highAmt: 0.22, shadow: 0x6a7070, shadowAmt: 0.25, mix: Math.max(k * 0.9, r * 0.8) * (rug ? 1 : 1) });
  if (bloomActive && S.baseBloom != null) bloomActive.strength = S.baseBloom * (1 + T.bloom * k);
  // (the FOV setting may change under us: a value we didn't write is the new base)
  if (S.fovSet != null && game.baseFov !== S.fovSet) S.baseFov = game.baseFov;
  S.fovSet = S.baseFov * (1 + T.fov * k);
  game.baseFov = S.fovSet;
  speedK = 1 + (T.speedRush - 1) * k + (T.speedRug - 1) * r;
  if (game.net) game.net.lineFx = rug ? 2 : 1;
  // the heartbeat, faster in the rush; ticker tape under it
  S.hb -= dt;
  if (S.hb <= 0 && (k > 0.2 || r > 0.2)) { linesSfx.heartbeat(0.5 + 0.5 * k); S.hb = rug ? 1.1 : 0.62 - 0.1 * k; S.el.style.setProperty("--pulse", "1"); }
  else S.el.style.setProperty("--pulse", String(Math.max(0, 1 - (rug ? 1.1 - S.hb : 0.62 - S.hb) * 4)));
  S.tick -= dt;
  if (S.tick <= 0 && k > 0.4) { linesSfx.tick(); S.tick = 0.09 + Math.random() * 0.12; }
  draw(dt, k, r, rug);
  // the camera: a tremor on the rush, a slow heavy sway on the rug pull
  const s = now / 1000, jit = T.jitter * (reduced ? 0.3 : 1) * k;
  out.pitch = (Math.sin(s * 37) + Math.sin(s * 53 + 1)) * 0.5 * jit + Math.sin(s * 0.7) * 0.03 * r;
  out.yaw = (Math.sin(s * 41 + 2) + Math.sin(s * 59)) * 0.5 * jit;
  out.roll = Math.sin(s * 0.55 + 1) * 0.045 * r + Math.sin(s * 47) * 0.4 * jit;
  return out;
}

/* ------------------------------------------------------------- the chart

   Candles on both edges, each column a random walk that climbs in the
   rush (sprinting spikes it) and crashes in the rug pull, scrolling up as
   new ones come; the ticker counts the gain up and then the loss. */
function draw(dt, k, r, rug) {
  const cv = S.cv, g = S.g;
  const W = cv.clientWidth | 0, H = cv.clientHeight | 0;
  if (!W || !H) return;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  g.clearRect(0, 0, W, H);
  // a new candle every so often: up in the rush, down hard in the rug pull
  S.nextCandle -= dt;
  const sprint = game.move.sprinting && game.move.moving;
  if (sprint) S.spike = Math.min(1, S.spike + dt * 3); else S.spike = Math.max(0, S.spike - dt * 1.5);
  if (S.nextCandle <= 0) {
    S.nextCandle = rug ? 0.16 : 0.26;
    const o = S.price;
    const drift = rug ? -(4 + Math.random() * 9) : (0.6 + Math.random() * 2.2) * (0.5 + k) + S.spike * 6;
    const c = Math.max(2, o + drift + (Math.random() - 0.5) * (rug ? 4 : 2.2));
    const hi = Math.max(o, c) + Math.random() * 2.5, lo = Math.min(o, c) - Math.random() * 2.5;
    S.price = c;
    S.candles.push({ o, c, hi, lo });
    if (S.candles.length > 46) S.candles.shift();
  }
  const n = S.candles.length;
  if (!n) return;
  let top = -Infinity, bot = Infinity;
  for (const c of S.candles) { top = Math.max(top, c.hi); bot = Math.min(bot, c.lo); }
  const pad = (top - bot) * 0.15 + 1;
  top += pad; bot -= pad;
  const colW = Math.min(150, W * 0.14), rowH = H / 38, cw = colW * 0.72;
  const alpha = Math.max(k * 0.55, r * 0.7);
  const y = (v) => H * 0.9 - ((v - bot) / (top - bot)) * H * 0.8 + (rug ? r * H * 0.45 : 0);   // the rug pull slides it all off the bottom
  for (const side of [0, 1]) {
    const x0 = side ? W - colW - 14 : 14;
    // the grid
    g.strokeStyle = `rgba(255,255,255,${0.06 * alpha})`; g.lineWidth = 1;
    for (let i = 0; i < 8; i++) { const yy = (H / 8) * i + ((performance.now() / 40) % (H / 8)); g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + colW, yy); g.stroke(); }
    // the candles, the newest at the right of the column; the column reads top to bottom as time, so offset each one up
    S.candles.forEach((c, i) => {
      const age = n - 1 - i;
      const cx = x0 + colW - cw / 2 - (age % 2) * 0 ;
      const yo = y(c.o) - age * rowH * 0.9, yc = y(c.c) - age * rowH * 0.9;
      const up = c.c >= c.o;
      const col = up ? `rgba(31,211,90,${alpha})` : `rgba(255,59,59,${alpha})`;
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx, y(c.hi) - age * rowH * 0.9); g.lineTo(cx, y(c.lo) - age * rowH * 0.9); g.stroke();
      const h = Math.max(2, Math.abs(yc - yo));
      g.fillRect(cx - cw * 0.5, Math.min(yo, yc), cw, h);
    });
    // the price line along the column
    g.strokeStyle = `rgba(200,255,220,${0.5 * alpha})`; g.lineWidth = 1.2;
    g.beginPath();
    S.candles.forEach((c, i) => { const age = n - 1 - i; const px = x0 + (i / Math.max(1, n - 1)) * colW, py = y(c.c) - age * rowH * 0.9; i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.stroke();
  }
  // the ticker
  const pct = rug ? -Math.min(99.9, 99.9 * smooth((S.t - STONKS.rush) / 2.5)) : STONKS.pctFrom + (STONKS.pctTo - STONKS.pctFrom) * smooth(S.t / (STONKS.rush - 2));
  S.ticker.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  S.tape.textContent = rug ? "LIQUIDATED · RUG PULL · DEV WALLET DUMPED · NGMI" : `${sprint ? "PUMPING · " : ""}WAGMI · TO THE MOON · DIAMOND HANDS · ${Math.round(S.price * 42)} SATS`;
  S.el.style.setProperty("--k", String(Math.max(k, r)));
}

// headless tests reach in here (tools/troll-ops-lines-test.mjs)
if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollStonks = { STONKS, start: startStonks, end: endStonks, phase: stonksPhase, speed: stonksSpeed,
    state: () => ({ on: S.on, t: S.t, phase: stonksPhase(), speed: speedK, candles: S.candles.length, fov: game.baseFov, bloom: bloomActive?.strength ?? null,
      sat: gradeActive?.uniforms.uSat.value ?? null, lineFx: game.net?.lineFx | 0, stamp: S.stamp?.textContent || "", ticker: S.ticker?.textContent || "" }) };
}
