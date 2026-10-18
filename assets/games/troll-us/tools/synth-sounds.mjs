// Troll Us sound set, synthesised from scratch (no samples): node assets/games/troll-us/tools/synth-sounds.mjs
// Writes 44.1 kHz mono 16-bit WAVs to assets/games/troll-us/sounds/. Studio plays them from Rules.sounds once
// they are uploaded to Roblox; the web build (phase 4) loads the same files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sounds');
fs.mkdirSync(OUT, { recursive: true });

// a fixed seed so every run writes the same files
let seed = 1234567;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const noise = () => rnd() * 2 - 1;

const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
const TAU = Math.PI * 2;

// envelope: attack a seconds, then exponential decay with time constant d
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

// add a tone whose frequency follows f(t), shaped by e(t); wave = 'sine' | 'square' | 'saw' | 'tri'
function tone(out, start, dur, f, e, gain = 1, wave = 'sine') {
  let ph = 0;
  const i0 = Math.floor(start * SR), n = Math.floor(dur * SR);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / SR;
    const fr = typeof f === 'function' ? f(t) : f;
    ph += fr / SR;
    const p = ph % 1;
    let v;
    if (wave === 'sine') v = Math.sin(TAU * p);
    else if (wave === 'square') v = Math.tanh(Math.sin(TAU * p) * 4) * 0.8; // soft square, fewer harsh edges
    else if (wave === 'saw') { v = 0; for (let k = 1; k <= 8; k++) v += Math.sin(TAU * p * k) / k; v *= 0.55; }
    else v = 1 - 4 * Math.abs(p - 0.5); // tri
    out[i0 + i] += v * e(t) * gain;
  }
}

// filtered noise: biquad band-pass whose centre follows fc(t)
function noiseBand(out, start, dur, fc, q, e, gain = 1) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const i0 = Math.floor(start * SR), n = Math.floor(dur * SR);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / SR;
    const f = typeof fc === 'function' ? fc(t) : fc;
    const w = TAU * Math.min(f, SR * 0.45) / SR, al = Math.sin(w) / (2 * q);
    const b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * Math.cos(w), a2 = 1 - al;
    const x = noise();
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i0 + i] += y * e(t) * gain;
  }
}

// one-pole low-pass over the whole buffer (rounds off the top end)
function lowpass(out, fc) {
  const a = Math.exp(-TAU * fc / SR);
  let y = 0;
  for (let i = 0; i < out.length; i++) { y = (1 - a) * out[i] + a * y; out[i] = y; }
}

// short feedback echo, a cheap "room"
function room(out, delay = 0.045, fb = 0.3, mix = 0.35) {
  const d = Math.floor(delay * SR);
  const wet = new Float32Array(out.length);
  for (let i = 0; i < out.length; i++) wet[i] = out[i] + (i >= d ? wet[i - d] * fb : 0);
  for (let i = 0; i < out.length; i++) out[i] = out[i] * (1 - mix) + wet[i] * mix;
}

function write(name, out, peak = 0.89) {
  let m = 0;
  for (const v of out) m = Math.max(m, Math.abs(v));
  const k = m > 0 ? peak / m : 0;
  // 4 ms fade at both ends so nothing clicks
  const fade = Math.floor(0.004 * SR);
  const data = Buffer.alloc(out.length * 2);
  for (let i = 0; i < out.length; i++) {
    let v = out[i] * k;
    if (i < fade) v *= i / fade;
    if (i > out.length - fade) v *= (out.length - i) / fade;
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, name + '.wav'), Buffer.concat([h, data]));
  console.log(name.padEnd(10), (out.length / SR).toFixed(2) + 's');
}

const SOUNDS = {
  // footsteps: a soft boot on a metal deck, two takes so a walk doesn't machine-gun
  step1() {
    const o = buf(0.16);
    tone(o, 0, 0.16, (t) => 95 - t * 200, (t) => env(t, 0.002, 0.025), 1);
    noiseBand(o, 0, 0.08, 2400, 1.2, (t) => env(t, 0.001, 0.012), 0.5);
    noiseBand(o, 0, 0.12, 700, 3, (t) => env(t, 0.002, 0.03), 0.35);
    return o;
  },
  step2() {
    const o = buf(0.16);
    tone(o, 0, 0.16, (t) => 82 - t * 180, (t) => env(t, 0.002, 0.028), 1);
    noiseBand(o, 0, 0.08, 2000, 1.2, (t) => env(t, 0.001, 0.014), 0.5);
    noiseBand(o, 0, 0.12, 620, 3, (t) => env(t, 0.002, 0.03), 0.35);
    return o;
  },
  // the kill: a heavy body hit with a wet tail
  kill() {
    const o = buf(0.9);
    tone(o, 0, 0.6, (t) => 130 * Math.exp(-t * 6) + 38, (t) => env(t, 0.003, 0.14), 1.2);
    noiseBand(o, 0, 0.25, (t) => 1800 - t * 5000, 0.8, (t) => env(t, 0.001, 0.04), 0.9);
    noiseBand(o, 0.05, 0.5, (t) => 500 + 300 * Math.sin(t * 40), 4, (t) => env(t, 0.03, 0.12), 0.45);
    lowpass(o, 5000);
    room(o, 0.06, 0.25, 0.25);
    return o;
  },
  // vent: a lid popping and the metal ringing
  vent() {
    const o = buf(0.6);
    noiseBand(o, 0, 0.06, 3000, 0.9, (t) => env(t, 0.001, 0.01), 1);
    for (const [f, g] of [[523, 0.4], [1177, 0.3], [1931, 0.22], [2870, 0.14]]) tone(o, 0, 0.6, f, (t) => env(t, 0.001, 0.09), g);
    tone(o, 0, 0.2, (t) => 180 - t * 400, (t) => env(t, 0.002, 0.04), 0.7);
    return o;
  },
  // emergency meeting: a two-tone klaxon, twice
  siren() {
    const o = buf(1.9);
    for (let k = 0; k < 2; k++) {
      const s = k * 0.85;
      tone(o, s, 0.8, (t) => 520 + 340 * Math.min(1, t / 0.55), (t) => (t < 0.02 ? t / 0.02 : t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.1) : 1), 0.6, 'square');
      tone(o, s, 0.8, (t) => 260 + 170 * Math.min(1, t / 0.55), (t) => (t < 0.02 ? t / 0.02 : t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.1) : 1), 0.35, 'saw');
    }
    lowpass(o, 3500);
    room(o, 0.07, 0.35, 0.3);
    return o;
  },
  // dead body reported: a stab of low brass and a hit
  report() {
    const o = buf(1.5);
    for (const f of [98, 116.5, 146.8, 196]) tone(o, 0, 1.5, (t) => f * (1 - 0.03 * t), (t) => env(t, 0.01, 0.45), 0.4, 'saw');
    tone(o, 0, 0.5, (t) => 70 * Math.exp(-t * 3) + 40, (t) => env(t, 0.002, 0.15), 1);
    noiseBand(o, 0, 0.2, 1200, 0.7, (t) => env(t, 0.001, 0.03), 0.7);
    lowpass(o, 2600);
    room(o, 0.08, 0.4, 0.35);
    return o;
  },
  // a vote stamped in: click + tom
  vote() {
    const o = buf(0.35);
    noiseBand(o, 0, 0.03, 4000, 1, (t) => env(t, 0.0005, 0.006), 0.9);
    tone(o, 0, 0.35, (t) => 210 * Math.exp(-t * 5) + 90, (t) => env(t, 0.001, 0.06), 1);
    return o;
  },
  // ejected: air rushing out of the airlock
  eject() {
    const o = buf(2.2);
    noiseBand(o, 0, 2.2, (t) => 300 + 2600 * Math.sin(Math.PI * Math.min(1, t / 2.2)) ** 2, 1.4,
      (t) => (t < 0.5 ? t / 0.5 : Math.exp(-(t - 0.5) / 0.6)), 1);
    noiseBand(o, 0, 0.3, 200, 1, (t) => env(t, 0.002, 0.08), 0.8);
    tone(o, 0, 0.4, (t) => 60 - t * 40, (t) => env(t, 0.003, 0.1), 0.8);
    return o;
  },
  // round won: a bright rising arpeggio and a held chord
  win() {
    const o = buf(2.4);
    const notes = [523.3, 659.3, 784, 1046.5];
    notes.forEach((f, k) => {
      tone(o, k * 0.12, 2.2 - k * 0.12, f, (t) => env(t, 0.005, 0.7), 0.35, 'tri');
      tone(o, k * 0.12, 2.2 - k * 0.12, f * 2, (t) => env(t, 0.003, 0.25), 0.12);
    });
    for (const f of [261.6, 392]) tone(o, 0.48, 1.9, f, (t) => env(t, 0.08, 0.8), 0.3, 'saw');
    lowpass(o, 6000);
    room(o, 0.09, 0.4, 0.35);
    return o;
  },
  // round lost: a slow fall down a minor chord
  defeat() {
    const o = buf(2.8);
    const notes = [392, 311.1, 261.6, 196];
    notes.forEach((f, k) => tone(o, k * 0.28, 2.6 - k * 0.28, (t) => f * (1 - 0.02 * t), (t) => env(t, 0.02, 0.6), 0.4, 'saw'));
    tone(o, 1.0, 1.8, 65.4, (t) => env(t, 0.05, 0.9), 0.7);
    lowpass(o, 1800);
    room(o, 0.1, 0.45, 0.4);
    return o;
  },
  // task done: two-note chime
  task() {
    const o = buf(0.8);
    tone(o, 0, 0.8, 880, (t) => env(t, 0.003, 0.18), 0.5);
    tone(o, 0, 0.8, 2640, (t) => env(t, 0.002, 0.06), 0.12);
    tone(o, 0.11, 0.69, 1318.5, (t) => env(t, 0.003, 0.25), 0.5);
    tone(o, 0.11, 0.69, 3955, (t) => env(t, 0.002, 0.07), 0.1);
    return o;
  },
  // critical sabotage: one beep per second, loops seamlessly
  alarm() {
    const o = buf(1.0);
    tone(o, 0, 0.32, 880, (t) => (t < 0.01 ? t / 0.01 : t > 0.28 ? Math.max(0, 1 - (t - 0.28) / 0.04) : 1), 0.5, 'square');
    tone(o, 0, 0.32, 440, (t) => (t < 0.01 ? t / 0.01 : t > 0.28 ? Math.max(0, 1 - (t - 0.28) / 0.04) : 1), 0.3, 'square');
    lowpass(o, 3000);
    return o;
  },
  // a door slamming down
  door() {
    const o = buf(0.8);
    tone(o, 0, 0.5, (t) => 90 * Math.exp(-t * 4) + 45, (t) => env(t, 0.002, 0.1), 1);
    noiseBand(o, 0, 0.12, 1500, 0.8, (t) => env(t, 0.001, 0.02), 0.7);
    for (const [f, g] of [[310, 0.25], [740, 0.18], [1290, 0.1]]) tone(o, 0, 0.8, f, (t) => env(t, 0.001, 0.15), g);
    room(o, 0.05, 0.3, 0.25);
    return o;
  },
  // the role reveal: a low swell into a boom
  reveal() {
    const o = buf(2.2);
    noiseBand(o, 0, 1.0, (t) => 200 + t * 1500, 1.5, (t) => (t / 1.0) ** 2, 0.5);
    tone(o, 0.95, 1.25, (t) => 55 * Math.exp(-t * 1.5) + 30, (t) => env(t, 0.005, 0.5), 1.2);
    for (const f of [110, 164.8, 220]) tone(o, 0.95, 1.25, f, (t) => env(t, 0.01, 0.5), 0.25, 'saw');
    lowpass(o, 2200);
    room(o, 0.09, 0.4, 0.35);
    return o;
  },
  // a UI button press
  click() {
    const o = buf(0.06);
    tone(o, 0, 0.06, 1400, (t) => env(t, 0.001, 0.012), 0.6);
    noiseBand(o, 0, 0.02, 5000, 1, (t) => env(t, 0.0005, 0.004), 0.4);
    return o;
  },
};

const only = process.argv.slice(2);
for (const [name, make] of Object.entries(SOUNDS)) if (!only.length || only.includes(name)) write(name, make());
