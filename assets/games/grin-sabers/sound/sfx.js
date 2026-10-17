// Grin Sabers — sound, all synthesised with WebAudio (no files): the
// saber hum that swells with blade speed, ignite and retract, swing
// whooshes, the crack of a block, the sizzle of a hit.

let ctx = null, master = null, noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem("gs_muted") === "1"; } catch { /* storage off */ }

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem("gs_muted", m ? "1" : "0"); } catch { /* storage off */ }
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
}

/* Call from a user gesture: browsers only start audio after one. */
export function unlockAudio() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function noise(dur, { type = "bandpass", freq = 1000, q = 1, gain = 0.5, attack = 0.005, freqEnd = null, at = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

function tone(freq, dur, { type = "sine", gain = 0.3, attack = 0.003, freqEnd = null, at = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/* One saber's continuous hum. */
export class Hum {
  constructor(pitch = 1) {
    this.pitch = pitch;
    this.node = null;
  }
  ensure() {
    if (this.node || !ctx) return;
    const a = ctx.createOscillator(), b = ctx.createOscillator();
    a.type = "sawtooth"; b.type = "sawtooth";
    a.frequency.value = 86 * this.pitch; b.frequency.value = 90.5 * this.pitch;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 260; f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.value = 0;
    a.connect(f); b.connect(f); f.connect(g).connect(master);
    a.start(); b.start();
    this.node = { a, b, f, g };
  }
  /* lit 0..1, speed: blade tip m/s, near 0..1 (1 = by the camera). */
  update(lit, speed, near) {
    this.ensure();
    if (!this.node) return;
    const t = ctx.currentTime;
    const s = Math.min(1, speed / 14);
    this.node.g.gain.setTargetAtTime(lit * (0.05 + s * 0.22) * (0.4 + near * 0.6), t, 0.03);
    this.node.f.frequency.setTargetAtTime(240 + s * 1500, t, 0.03);
    const bend = 1 + s * 0.18;
    this.node.a.frequency.setTargetAtTime(86 * this.pitch * bend, t, 0.04);
    this.node.b.frequency.setTargetAtTime(90.5 * this.pitch * bend, t, 0.04);
  }
  stop() {
    if (!this.node) return;
    this.node.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  }
}

export const sfx = {
  ignite() { tone(55, 0.4, { type: "sawtooth", gain: 0.18, freqEnd: 140 }); noise(0.35, { freq: 300, freqEnd: 2200, gain: 0.25, q: 2 }); },
  retract() { tone(140, 0.3, { type: "sawtooth", gain: 0.14, freqEnd: 45 }); noise(0.25, { freq: 1800, freqEnd: 250, gain: 0.18, q: 2 }); },
  whoosh(heavy) { noise(heavy ? 0.32 : 0.22, { freq: heavy ? 500 : 900, freqEnd: heavy ? 180 : 350, gain: heavy ? 0.4 : 0.28, q: 1.4 }); },
  block() {
    noise(0.12, { type: "highpass", freq: 2500, gain: 0.55, attack: 0.001 });
    for (const [f, g] of [[1420, 0.16], [2330, 0.1], [3870, 0.06]]) tone(f, 0.28, { gain: g });
    noise(0.3, { freq: 5000, gain: 0.12, q: 0.6, at: 0.02 });
  },
  perfect() { this.block(); tone(2640, 0.45, { gain: 0.14 }); tone(3960, 0.35, { gain: 0.07, at: 0.02 }); },
  hit(heavy) {
    noise(heavy ? 0.4 : 0.25, { type: "lowpass", freq: 2600, freqEnd: 400, gain: heavy ? 0.6 : 0.45, attack: 0.002 });
    tone(heavy ? 70 : 95, 0.25, { gain: 0.4, freqEnd: 40 });
  },
  clash() { this.block(); noise(1.4, { freq: 3200, gain: 0.08, q: 0.8, attack: 0.05 }); },
  clashEnd() { tone(220, 0.3, { type: "square", gain: 0.06, freqEnd: 120 }); noise(0.3, { freq: 1200, gain: 0.3 }); },
  disarm() { this.perfect(); noise(0.5, { freq: 700, freqEnd: 2400, gain: 0.25, q: 2, at: 0.05 }); },
  guardbreak() { tone(160, 0.35, { type: "square", gain: 0.12, freqEnd: 60 }); noise(0.2, { type: "highpass", freq: 1500, gain: 0.4 }); },
  ko() { tone(60, 0.9, { gain: 0.5, freqEnd: 30 }); noise(0.8, { type: "lowpass", freq: 600, gain: 0.3 }); },
  dodge() { noise(0.18, { freq: 600, freqEnd: 1500, gain: 0.16 }); },
  feint() { noise(0.12, { freq: 1200, freqEnd: 400, gain: 0.12 }); },
  ui() { tone(880, 0.06, { gain: 0.08, type: "triangle" }); },
  bell() { tone(523, 1.2, { gain: 0.18, type: "triangle" }); tone(784, 1.2, { gain: 0.1, type: "triangle", at: 0.01 }); },
};
