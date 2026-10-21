// Troll Forces: the Pour up's after-effect (user, 2026-10-16: "After users
// use the pour up emote, they should feel hallucinations and their screen
// should turn a bit purple").
//
// Once the cup reaches your lips (lean-cup.js LEAN.sipUp), the trip starts:
// for TRIP.seconds the screen wears a purple wash and vignette, faint
// trollfaces drift and breathe across it, and the view sways slowly, more
// syrupy than the saloon's tipsy roll. Another Pour up tops it back up. It
// fades in, holds, then fades out; dying, leaving the match or the menu ends
// it at once. Local only: nothing goes on the wire.

import { game } from "../core/state.js?v=st1";
import { EMOTES } from "../characters/emote-wheel.js?v=hb4-em1-wst-soc1c2f1m1u-gt1-gt2-cw1-zr10-bf1-sr1-or1-nf2-em2-nb2-pc2-cf1-gs2-lh1-fg2-lp1-fg3-rc1-rc4-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-ht2-bx1-sf1-cg1";
import { LEAN } from "../weapons/lean-cup.js?v=ng1-or1-lp1-ht1-bx1";

export const TRIP = {
  seconds: 24,      // the whole trip
  rampIn: 2.5,      // fading in from the sip
  rampOut: 6,       // and out at the end
  wash: 0.2,        // the purple wash's opacity at full strength
  roll: 0.045,      // the sway (radians)
  pitch: 0.025,
  faces: 5,         // drifting trollfaces
};

const trip = { t: 0, on: false, el: null, faces: [], last: 0, lastE: -1 };
const LEAN_IDX = EMOTES.findIndex((e) => e.id === "lean");
const FACE_SRC = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;

function build() {
  const el = document.createElement("div");
  el.className = "to-lean-trip";
  el.setAttribute("aria-hidden", "true");
  for (let i = 0; i < TRIP.faces; i++) {
    const img = document.createElement("img");
    img.src = FACE_SRC;
    img.alt = "";
    img.className = "to-lean-trip-face";
    el.appendChild(img);
    trip.faces.push({ img, seed: i * 1.7 + 0.4, x: 0.1 + (i / TRIP.faces) * 0.8 });
  }
  // under the HUD's own readouts, over the world
  game.els.hud.prepend(el);
  trip.el = el;
}

/* Start (or top up) the trip. */
export function startLeanTrip() {
  if (!trip.el) build();
  // topped up mid-trip: straight back to full, no second fade-in
  trip.t = trip.on ? Math.min(trip.t, TRIP.rampIn) : 0;
  trip.on = true;
}
export function endLeanTrip() {
  trip.on = false;
  trip.t = 0;
  if (trip.el) trip.el.style.opacity = "0";
}
export const leanTripOn = () => trip.on;

const smooth = (v) => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x); };

/* Every frame (view/player-update.js): starts the trip at the sip, runs it,
   and returns the camera's extra { roll, pitch } (0 off the trip). */
const NONE = { roll: 0, pitch: 0 };
const out = { roll: 0, pitch: 0 };
export function updateLeanTrip(dt) {
  // the sip: the emote's own clock passing it since the last frame (not
  // `dt`, which a slow or clamped frame can make miss it)
  const e = game.emote, et = e && e.idx === LEAN_IDX ? e.t : -1;
  if (et >= LEAN.sipUp[1] && trip.lastE < LEAN.sipUp[1]) startLeanTrip();
  trip.lastE = et;
  const now = performance.now(), gap = now - trip.last;
  trip.last = now;
  if (!trip.on) return NONE;
  // (a long gap in the frames: the match ended or the menu was up; not
  // one slow frame, a loading hitch or a software-rendered test)
  if (!game.player.alive || game.gameState !== "playing" || gap > 5000) { endLeanTrip(); return NONE; }
  trip.t += dt;
  if (trip.t >= TRIP.seconds) { endLeanTrip(); return NONE; }
  const k = smooth(trip.t / TRIP.rampIn) * smooth((TRIP.seconds - trip.t) / TRIP.rampOut);
  const s = now / 1000;
  trip.el.style.opacity = String(k);
  trip.el.style.setProperty("--wash", String(TRIP.wash * (0.85 + 0.15 * Math.sin(s * 0.9))));
  trip.el.style.setProperty("--hue", `${Math.sin(s * 0.35) * 18}deg`);
  // the faces: each drifts up the screen on its own slow loop, swaying,
  // swelling and fading in and out
  for (const f of trip.faces) {
    const loop = ((s * 0.045 + f.seed * 0.37) % 1 + 1) % 1;
    const x = f.x + Math.sin(s * 0.3 + f.seed * 2) * 0.06;
    const y = 1.1 - loop * 1.3;
    const scale = 0.7 + 0.35 * Math.sin(s * 0.8 + f.seed);
    const a = Math.sin(loop * Math.PI) * (0.14 + 0.08 * Math.sin(s * 1.3 + f.seed));
    f.img.style.transform = `translate(${(x * 100).toFixed(2)}vw, ${(y * 100).toFixed(2)}vh) translate(-50%, -50%) rotate(${(Math.sin(s * 0.5 + f.seed) * 14).toFixed(1)}deg) scale(${scale.toFixed(3)})`;
    f.img.style.opacity = a.toFixed(3);
  }
  out.roll = (Math.sin(s * 0.47) * TRIP.roll + Math.sin(s * 1.13 + 1) * TRIP.roll * 0.3) * k;
  out.pitch = Math.sin(s * 0.61 + 2) * TRIP.pitch * k;
  return out;
}
