// Troll Forces radio: the beat grid behind Trolling Loud's lights.
//
//   node tools/troll-ops-beatgrid.mjs
//
// Decodes every mp3 in assets/games/troll-ops/music (ffmpeg on PATH), finds
// its tempo and where the beats fall, and writes
// assets/games/troll-ops/music-beats.js: per track { bpm, offset (s of the
// first beat), down (which beat of four is the bar's one), kick / level (one
// digit 0-9 per beat: the low end's punch and the overall loudness) }.
// The club (trollingloud.js) reads the song's clock against that grid, so the
// floor flashes on the real kick even through a wall or with the volume off.
// Run it again after adding a track to music.js.

import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "assets/games/troll-ops/music");
const OUT = join(ROOT, "assets/games/troll-ops/music-beats.js");
const SR = 22050, N = 1024, HOP = 256, FPS = SR / HOP;

function decode(file) {
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}

/* In-place radix-2 FFT. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/* Per frame: spectral flux (the onset curve), the low end's flux (kicks),
   and the low end's / whole spectrum's energy. */
function analyse(x) {
  const frames = Math.floor((x.length - N) / HOP);
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const lowBin = Math.round((150 * N) / SR);
  const flux = new Float32Array(frames), lowFlux = new Float32Array(frames);
  const low = new Float32Array(frames), all = new Float32Array(frames);
  let prev = new Float32Array(N / 2);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) { re[i] = x[f * HOP + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const mag = new Float32Array(N / 2);
    let fl = 0, lf = 0, le = 0, ae = 0;
    for (let k = 1; k < N / 2; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      mag[k] = Math.log1p(100 * Math.sqrt(p));
      const d = mag[k] - prev[k];
      if (d > 0) { fl += d; if (k <= lowBin) lf += d; }
      ae += p;
      if (k <= lowBin) le += p;
    }
    flux[f] = fl; lowFlux[f] = lf; low[f] = le; all[f] = ae;
    prev = mag;
  }
  return { flux, lowFlux, low, all, frames };
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
function normalise(a) {
  // subtract a local mean (about half a second) and clip at zero
  const out = new Float32Array(a.length), w = Math.round(FPS * 0.25);
  let s = 0;
  for (let i = 0; i < Math.min(a.length, w); i++) s += a[i];
  for (let i = 0; i < a.length; i++) {
    const lo = i - w - 1, hi = i + w;
    if (hi < a.length) s += a[hi];
    if (lo >= 0) s -= a[lo];
    const n = Math.min(a.length - 1, hi) - Math.max(0, lo + 1) + 1;
    out[i] = Math.max(0, a[i] - s / n);
  }
  const m = Math.max(...out) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= m;
  return out;
}

/* Linear-interpolated value of curve `c` at second `t`. */
function at(c, t) {
  const f = t * FPS, i = Math.floor(f);
  if (i < 0 || i + 1 >= c.length) return 0;
  return c[i] + (c[i + 1] - c[i]) * (f - i);
}

/* Average onset strength on a grid: how well (bpm, offset) fits. */
function gridScore(o, bpm, off, dur) {
  const p = 60 / bpm;
  let s = 0, n = 0;
  for (let t = off; t < dur; t += p) { s += Math.max(at(o, t - 0.012), at(o, t), at(o, t + 0.012)); n++; }
  return n ? s / n : 0;
}

function tempo(o) {
  // autocorrelation over 60-200 BPM, a gentle pull toward 120
  const ac = [];
  for (let bpm = 60; bpm <= 200; bpm += 0.5) {
    const lag = (60 / bpm) * FPS, L = Math.floor(lag), fr = lag - L;
    let s = 0;
    for (let i = 0; i + L + 1 < o.length; i++) s += o[i] * (o[i + L] * (1 - fr) + o[i + L + 1] * fr);
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
    ac.push({ bpm, s: s * prior });
  }
  ac.sort((a, b) => b.s - a.s);
  return ac.slice(0, 6).map((a) => a.bpm);
}

function track(file) {
  const x = decode(file);
  const dur = x.length / SR;
  const A = analyse(x);
  const o = normalise(A.flux);
  const ok = normalise(A.lowFlux);
  // the onset curve the grid locks to: mostly the kick, some of the rest
  const oc = o.map((v, i) => v * 0.5 + ok[i] * 0.5);
  let best = { s: -1 };
  for (const b0 of tempo(oc)) {
    for (let bpm = b0 - 1.5; bpm <= b0 + 1.5; bpm += 0.02) {
      const p = 60 / bpm;
      for (let off = 0; off < p; off += 1 / FPS / 2) {
        const s = gridScore(oc, bpm, off, dur);
        if (s > best.s) best = { s, bpm, off };
      }
    }
  }
  // the rough fit polished: finer tempo and phase
  for (let bpm = best.bpm - 0.03; bpm <= best.bpm + 0.03; bpm += 0.002) {
    for (let off = best.off - 0.02; off <= best.off + 0.02; off += 0.001) {
      const s = gridScore(oc, bpm, off, dur);
      if (s > best.s) best = { s, bpm, off };
    }
  }
  const p = 60 / best.bpm;
  // the beats' strength: the kick's onset and the low end's loudness, the
  // whole mix's loudness (the quiet bits read as a breakdown)
  const beats = [];
  for (let t = best.off; t < dur; t += p) beats.push(t);
  const win = (c, t, w) => { let m = 0; for (let f = Math.max(0, Math.floor((t - w) * FPS)); f <= Math.min(c.length - 1, Math.ceil((t + w) * FPS)); f++) m = Math.max(m, c[f]); return m; };
  const rms = (c, t0, t1) => { let s = 0, n = 0; for (let f = Math.max(0, Math.floor(t0 * FPS)); f < Math.min(c.length, Math.ceil(t1 * FPS)); f++) { s += c[f]; n++; } return n ? Math.sqrt(s / n) : 0; };
  const kickRaw = beats.map((t) => win(ok, t, 0.03));
  const lowRaw = beats.map((t) => rms(A.low, t - 0.02, t + 0.15));
  const levRaw = beats.map((t) => rms(A.all, t, t + p));
  const q = (arr, pct) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length * pct)] || 1;
  const kHi = q(kickRaw, 0.9), lHi = q(lowRaw, 0.9), vHi = q(levRaw, 0.92);
  const digit = (v) => String(Math.max(0, Math.min(9, Math.round(v * 9))));
  const kick = beats.map((_, i) => digit(Math.min(1, (kickRaw[i] / kHi) * 0.55 + (lowRaw[i] / lHi) * 0.45))).join("");
  const level = levRaw.map((v) => digit(Math.min(1, v / vHi))).join("");
  // the bar's one: the beat of four that hits hardest on average
  const bars = [0, 0, 0, 0];
  beats.forEach((_, i) => { bars[i % 4] += lowRaw[i]; });
  const down = bars.indexOf(Math.max(...bars));
  // how well the grid holds up across the song, quarter by quarter
  const hold = [0, 1, 2, 3].map((k) => {
    const t0 = (dur / 4) * k, t1 = (dur / 4) * (k + 1);
    const seg = oc.slice(Math.floor(t0 * FPS), Math.floor(t1 * FPS));
    let s = 0, n = 0;
    for (let t = best.off + Math.ceil((t0 - best.off) / p) * p; t < t1; t += p) { s += at(oc, t); n++; }
    return +(s / n / (mean(seg) || 1)).toFixed(2);
  });
  return { bpm: +best.bpm.toFixed(3), offset: +best.off.toFixed(3), down, dur: +dur.toFixed(2), kick, level, hold };
}

const out = {};
for (const f of readdirSync(DIR).filter((n) => n.endsWith(".mp3")).sort()) {
  const r = track(join(DIR, f));
  const { hold, ...data } = r;
  out[`assets/games/troll-ops/music/${f}`] = data;
  console.log(`${basename(f).padEnd(18)} ${r.bpm} BPM  first beat ${r.offset}s  one=${r.down}  ${r.kick.length} beats  grid fit by quarter ${hold.join(" ")}`);
}
const body = Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
writeFileSync(OUT, `// Generated by tools/troll-ops-beatgrid.mjs — don't edit by hand.
//
// The beat grid of each Troll Forces radio track (music.js), keyed by its
// src: bpm, offset (seconds to the first beat), down (which beat of four is
// the bar's one), dur, and one digit per beat for the kick's punch and the
// mix's loudness (0-9). Trolling Loud's lights run on it.

export const BEATS = {
${body}
};
`);
console.log("wrote", OUT);
