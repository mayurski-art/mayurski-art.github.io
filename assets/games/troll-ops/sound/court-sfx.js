// Troll Forces — the court sounds (Troll Beach 5d, modes/social-hoops.js and
// the other court games). All synthesised off the game's one noise buffer,
// placed in the world like the rest of GameAudio's sounds:
//   bounce: a leather ball on asphalt (a low thump and a slap)
//   rim:    the iron ringing (two detuned partials, fast decay)
//   board:  the backboard's flat whack
//   swish:  the net (a short airy noise sweep)
//   chain:  (unused yet) a chain-net jangle
//   hit:    a racket (a hard pock), `kind` "tennis"; a volleyball palm slap, "vball"

import { game } from "../core/state.js?v=st1";

function ready() {
  const a = game.audio;
  return a?.ctx && a.master && a.noise && a.enabled !== false ? a : null;
}
function noise(a, at, { gain, dur, type = "bandpass", f0, f1 = f0, q = 1, delay = 0 }) {
  const t = a.now + delay;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noise;
  src.playbackRate.value = 1;
  const flt = a.ctx.createBiquadFilter();
  flt.type = type;
  flt.frequency.setValueAtTime(f0, t);
  flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  flt.Q.value = q;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(a._dest(at));
  src.start(t, Math.random() * 0.5, dur + 0.05);
}
function tone(a, at, { gain, dur, f, type = "sine", delay = 0, bend = 1 }) {
  const t = a.now + delay;
  const o = a.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (bend !== 1) o.frequency.exponentialRampToValueAtTime(f * bend, t + dur);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a._dest(at));
  o.start(t);
  o.stop(t + dur + 0.02);
}

/* `at` a world point; `k` 0..1 how hard. */
export function courtSound(kind, at, k = 1) {
  const a = ready();
  if (!a || a._overBudget?.(at)) return;
  k = Math.max(0.15, Math.min(1, k));
  switch (kind) {
    case "bounce":
      tone(a, at, { gain: 0.5 * k, dur: 0.09, f: 140, bend: 0.55 });
      noise(a, at, { gain: 0.35 * k, dur: 0.05, f0: 1800, f1: 600, q: 0.8 });
      break;
    case "rim":
      tone(a, at, { gain: 0.22 * k, dur: 0.5, f: 830, type: "triangle" });
      tone(a, at, { gain: 0.14 * k, dur: 0.35, f: 1247, type: "triangle" });
      noise(a, at, { gain: 0.25 * k, dur: 0.06, f0: 3200, q: 2 });
      break;
    case "board":
      tone(a, at, { gain: 0.35 * k, dur: 0.12, f: 210, bend: 0.7 });
      noise(a, at, { gain: 0.4 * k, dur: 0.08, f0: 900, f1: 400, q: 0.7 });
      break;
    case "swish":
      noise(a, at, { gain: 0.45 * k, dur: 0.32, type: "highpass", f0: 2500, f1: 6000, q: 0.5 });
      break;
    case "tennis":
      tone(a, at, { gain: 0.3 * k, dur: 0.05, f: 520, bend: 0.8 });
      noise(a, at, { gain: 0.45 * k, dur: 0.04, f0: 2600, q: 1.5 });
      break;
    case "vball":
      noise(a, at, { gain: 0.55 * k, dur: 0.07, f0: 1300, f1: 500, q: 0.9 });
      tone(a, at, { gain: 0.25 * k, dur: 0.07, f: 180, bend: 0.6 });
      break;
    case "net":
      noise(a, at, { gain: 0.3 * k, dur: 0.18, type: "lowpass", f0: 1400, f1: 400, q: 0.5 });
      break;
    default:
  }
}
