// Troll Forces — the candle lines' sounds (docs/CANDLE-LINES.md; the props
// in maps/kabukigrin-lines.js, the act in modes/social-lines.js, the rush in
// view/stonks-fx.js). All synthesised off the game's one noise buffer and
// placed in the world like the rest of GameAudio's sounds (court-sfx.js):
//   crunch: the card pressing the candle flat (a dry crack and crumble)
//   chop:   the card's edge tapping the glass
//   scrape: the long drag that draws the line
//   sniff:  the snort, end to end (a rising airy pull)
//   snap:   the head back (a short huff)
//   bell:   the rush starts (a trading-floor bell)
//   heartbeat: two low thumps, the rush's pulse
//   tick:   ticker tape, faint
//   sigh:   the rug pull

import { game } from "../core/state.js?v=st1";

function ready() {
  const a = game.audio;
  return a?.ctx && a.master && a.noise && a.enabled !== false && a.ctx.state === "running" ? a : null;
}
function noise(a, at, { gain, dur, type = "bandpass", f0, f1 = f0, q = 1, delay = 0, rate = 1 }) {
  const t = a.now + delay;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noise;
  src.playbackRate.value = rate;
  const flt = a.ctx.createBiquadFilter();
  flt.type = type;
  flt.frequency.setValueAtTime(f0, t);
  flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  flt.Q.value = q;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(a._dest(at));
  src.start(t, Math.random() * 0.5, dur + 0.05);
}
function tone(a, at, { gain, dur, f, type = "sine", delay = 0, bend = 1, attack = 0.005 }) {
  const t = a.now + delay;
  const o = a.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (bend !== 1) o.frequency.exponentialRampToValueAtTime(f * bend, t + dur);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a._dest(at));
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const linesSfx = {
  crunch(at = null) {
    const a = ready(); if (!a) return;
    noise(a, at, { gain: 0.22, dur: 0.07, type: "highpass", f0: 1800, f1: 900, q: 0.7 });
    for (let i = 0; i < 5; i++) noise(a, at, { gain: 0.09, dur: 0.03, f0: 2400 + Math.random() * 2000, q: 6, delay: 0.03 + i * 0.03 + Math.random() * 0.02 });
    tone(a, at, { gain: 0.05, dur: 0.06, f: 140, type: "triangle", bend: 0.6 });
  },
  chop(at = null) {
    const a = ready(); if (!a) return;
    tone(a, at, { gain: 0.08, dur: 0.05, f: 2600, type: "sine", bend: 0.8 });
    noise(a, at, { gain: 0.07, dur: 0.04, f0: 5000, q: 3 });
  },
  scrape(at = null, dur = 0.45) {
    const a = ready(); if (!a) return;
    noise(a, at, { gain: 0.1, dur, f0: 3200, f1: 5200, q: 2.5, rate: 0.9 });
    noise(a, at, { gain: 0.05, dur, f0: 900, f1: 1300, q: 1 });
  },
  sniff(at = null, dur = 0.8) {
    const a = ready(); if (!a) return;
    noise(a, at, { gain: 0.26, dur, type: "bandpass", f0: 700, f1: 2600, q: 0.8, rate: 1.1 });
    noise(a, at, { gain: 0.1, dur: dur * 0.9, type: "highpass", f0: 2500, f1: 6000, q: 0.5, delay: dur * 0.1 });
  },
  // v2 (docs/KB-SECURITY-ROOM.md): the screen giving way round the wrist, the bottle rolling on the glass, the card flicked off, the launch, the landing
  bloop(at = null) {
    const a = ready(); if (!a) return;
    tone(a, at, { gain: 0.09, dur: 0.35, f: 180, type: "sine", bend: 2.6, attack: 0.02 });
    noise(a, at, { gain: 0.05, dur: 0.3, f0: 600, f1: 2400, q: 4 });
  },
  roll(at = null) {
    const a = ready(); if (!a) return;
    noise(a, at, { gain: 0.12, dur: 0.3, type: "lowpass", f0: 500, f1: 260, q: 2, rate: 0.6 });
    tone(a, at, { gain: 0.04, dur: 0.28, f: 95, type: "triangle", bend: 1.2 });
  },
  flick(at = null) {
    const a = ready(); if (!a) return;
    noise(a, at, { gain: 0.1, dur: 0.18, f0: 2500, f1: 6500, q: 1.5 });
  },
  whoosh(at = null) {
    const a = ready(); if (!a) return;
    noise(a, at, { gain: 0.3, dur: 1.1, type: "bandpass", f0: 300, f1: 2600, q: 0.7, rate: 1.2 });
    tone(a, at, { gain: 0.07, dur: 0.9, f: 110, type: "sawtooth", bend: 4 });
  },
  thud(at = null) {
    const a = ready(); if (!a) return;
    tone(a, at, { gain: 0.2, dur: 0.25, f: 70, type: "sine", bend: 0.5, attack: 0.004 });
    noise(a, at, { gain: 0.12, dur: 0.2, type: "lowpass", f0: 900, f1: 200, q: 0.8 });
  },
  snap(at = null) {
    const a = ready(); if (!a) return;
    noise(a, at, { gain: 0.16, dur: 0.18, type: "lowpass", f0: 1400, f1: 300, q: 0.7 });
    tone(a, at, { gain: 0.06, dur: 0.12, f: 220, type: "sine", bend: 0.5 });
  },
  bell() {
    const a = ready(); if (!a) return;
    for (let i = 0; i < 6; i++) {
      tone(a, null, { gain: 0.08, dur: 0.5, f: 2093, type: "sine", delay: i * 0.11, attack: 0.002 });
      tone(a, null, { gain: 0.04, dur: 0.35, f: 2093 * 2.76, type: "sine", delay: i * 0.11, attack: 0.002 });
    }
  },
  heartbeat(k = 1) {
    const a = ready(); if (!a) return;
    tone(a, null, { gain: 0.16 * k, dur: 0.12, f: 70, type: "sine", bend: 0.6, attack: 0.01 });
    tone(a, null, { gain: 0.11 * k, dur: 0.1, f: 62, type: "sine", bend: 0.6, delay: 0.17, attack: 0.01 });
  },
  tick() {
    const a = ready(); if (!a) return;
    noise(a, null, { gain: 0.025, dur: 0.02, f0: 6000, q: 4 });
  },
  sigh() {
    const a = ready(); if (!a) return;
    noise(a, null, { gain: 0.14, dur: 1.4, type: "bandpass", f0: 1200, f1: 380, q: 0.6 });
    tone(a, null, { gain: 0.05, dur: 1.2, f: 330, type: "triangle", bend: 0.55, attack: 0.2 });
  },
};
