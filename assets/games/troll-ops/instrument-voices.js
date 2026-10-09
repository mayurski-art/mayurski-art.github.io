// Troll Forces — the band's guitar and trumpet, synthesised (BAND.md; the
// piano is rp-roles.js PianoVoice). No sound files: audio.js makes every
// sound in the game and the CSP stays as it is.
//
//   GuitarVoice   a plucked string by Karplus-Strong: a burst of noise run
//                 round a delay one period long, a little lowpassed each
//                 lap, so it rings and mellows like steel on wood. One
//                 buffer per note, made the first time it's played.
//   TrumpetVoice  two sawtooths a few cents apart through a lowpass that
//                 opens with the breath (brighter as it gets louder), a
//                 scoop up into the note, vibrato that comes in late.
//                 hold() / release() for live playing (legato: a new note
//                 while one sounds slides to it), note() for a sheet.
//
// Both play from a spot in the world (audio._dest: the panner, so you hear
// a guitarist across the street); move() keeps it on a player who walks.

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* --------------------------------------------------------------- guitar */

const KS = new Map();   // midi -> AudioBuffer (one set for every guitar)
function ksBuffer(ctx, midi) {
  let b = KS.get(midi);
  if (b) return b;
  const sr = ctx.sampleRate, f = midiHz(midi);
  const len = Math.floor(sr * Math.min(3.2, 1.2 + 260 / f));   // low strings ring longer
  b = ctx.createBuffer(1, len, sr);
  const out = b.getChannelData(0);
  const N = Math.max(2, Math.round(sr / f));
  const ring = new Float32Array(N);
  // the pluck: noise, softened (a pick, not a slap), and a pick-position
  // notch so it isn't buzzy
  let prev = 0;
  for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; prev = prev * 0.45 + r * 0.55; ring[i] = prev; }
  const pickAt = Math.floor(N * 0.18);
  for (let i = N - 1; i >= pickAt; i--) ring[i] -= ring[i - pickAt] * 0.5;
  // decay per lap: high notes die faster, as on a real string
  const rho = Math.min(0.9985, 0.996 + 0.0024 * Math.min(1, 110 / f));
  let i = 0;
  for (let n = 0; n < len; n++) {
    const a = ring[i], c = ring[(i + 1) % N];
    out[n] = a;
    ring[i] = rho * 0.5 * (a + c);
    i = (i + 1) % N;
  }
  // a short fade so the buffer never ends on a click
  const fade = Math.min(len, Math.floor(sr * 0.05));
  for (let n = 0; n < fade; n++) out[len - 1 - n] *= n / fade;
  KS.set(midi, b);
  return b;
}

class SpotVoice {
  constructor(audio, at) {
    this.audio = audio;
    this.at = { x: at.x, y: at.y, z: at.z };
    this.out = null;
    this.pan = null;
  }
  ensure() {
    const a = this.audio;
    if (!a?._ready?.()) return false;
    if (this.out) return true;
    this.out = a.ctx.createGain();
    this.out.gain.value = 1;
    this.pan = a._dest(this.at);
    this.post().connect(this.pan);
    return true;
  }
  post() { return this.out; }
  /* Follow a player (a guitarist walking down the street). */
  move(at, gain = 1) {
    if (!this.out) return;
    const t = this.audio.ctx.currentTime;
    if (this.pan?.positionX) {
      this.pan.positionX.setTargetAtTime(at.x, t, 0.05);
      this.pan.positionY.setTargetAtTime(at.y, t, 0.05);
      this.pan.positionZ.setTargetAtTime(at.z, t, 0.05);
    }
    this.out.gain.setTargetAtTime(Math.max(0, gain), t, 0.08);
  }
  stop() {
    if (!this.out) return;
    const out = this.out, pan = this.pan, ctx = this.audio.ctx;
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => { try { out.disconnect(); pan?.disconnect(); } catch { /* gone */ } }, 2000);
    this.out = null;
    this.pan = null;
  }
}

export class GuitarVoice extends SpotVoice {
  post() {
    // the body: a little low-mid warmth, the top end rolled off
    const ctx = this.audio.ctx;
    const body = ctx.createBiquadFilter();
    body.type = "peaking"; body.frequency.value = 220; body.Q.value = 1.1; body.gain.value = 4;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass"; tone.frequency.value = 4200;
    this.out.connect(body).connect(tone);
    return tone;
  }
  /* One string, at `when` (AudioContext time, default now), `dur` seconds
     before the hand damps it (default: let it ring). */
  pluck(midi, when = null, vel = 0.8, dur = null) {
    if (!this.ensure()) return false;
    const ctx = this.audio.ctx;
    const t = Math.max(ctx.currentTime, when ?? ctx.currentTime + 0.005);
    const src = ctx.createBufferSource();
    src.buffer = ksBuffer(ctx, midi);
    const g = ctx.createGain();
    g.gain.value = 0.32 * vel;
    if (dur != null) {
      g.gain.setValueAtTime(0.32 * vel, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur + 0.12);
    }
    src.connect(g).connect(this.out);
    src.start(t);
    src.stop(t + (dur != null ? dur + 0.15 : src.buffer.duration));
    return true;
  }
  /* A strum: low string to high (down) or high to low (up), 12 ms apart. */
  strum(midis, up = false, when = null, vel = 0.75, dur = null) {
    if (!this.ensure()) return false;
    const t0 = Math.max(this.audio.ctx.currentTime, when ?? this.audio.ctx.currentTime + 0.005);
    const order = up ? [...midis].reverse().slice(0, 4) : midis;   // an up-strum catches the top strings
    order.forEach((m, i) => this.pluck(m, t0 + i * 0.012, vel * (up ? 0.8 : 1) * (i === 0 ? 1 : 0.85), dur));
    return true;
  }
}

/* -------------------------------------------------------------- trumpet */

export class TrumpetVoice extends SpotVoice {
  constructor(audio, at) { super(audio, at); this.live = null; }
  post() {
    // a touch of room: the bell's not in your ear
    const ctx = this.audio.ctx;
    const hi = ctx.createBiquadFilter();
    hi.type = "highpass"; hi.frequency.value = 160;
    this.out.connect(hi);
    return hi;
  }
  /* The sounding parts of one note, started at t: { oscs, filter, amp, lfo }. */
  _voice(midi, t, vel) {
    const ctx = this.audio.ctx, f = midiHz(midi);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.13 * vel, t + 0.035);   // the breath in
    amp.gain.exponentialRampToValueAtTime(0.1 * vel, t + 0.12);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.Q.value = 1.6;
    filter.frequency.setValueAtTime(f * 1.4, t);
    filter.frequency.exponentialRampToValueAtTime(Math.min(9000, f * (5 + 3 * vel)), t + 0.05);   // brassy as it speaks
    filter.frequency.exponentialRampToValueAtTime(Math.min(7000, f * (3.6 + 2 * vel)), t + 0.25);
    filter.connect(amp).connect(this.out);
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, t);
    depth.gain.setValueAtTime(0, t + 0.35);
    depth.gain.linearRampToValueAtTime(9, t + 0.7);   // cents of vibrato, late
    lfo.connect(depth);
    const oscs = [-4, 4].map((cents) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f, t);
      o.detune.setValueAtTime(cents - 45, t);           // a scoop up into the note
      o.detune.linearRampToValueAtTime(cents, t + 0.045);
      depth.connect(o.detune);
      o.connect(filter);
      o.start(t);
      return o;
    });
    lfo.start(t);
    return { oscs, filter, amp, lfo, midi, f };
  }
  _end(v, t) {
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setTargetAtTime(0.0001, t, 0.03);
    for (const o of v.oscs) o.stop(t + 0.25);
    v.lfo.stop(t + 0.25);
  }
  /* A note from a sheet: at `when`, `dur` seconds. */
  note(midi, when = null, dur = 0.5, vel = 0.8) {
    if (!this.ensure()) return false;
    const ctx = this.audio.ctx;
    const t = Math.max(ctx.currentTime, when ?? ctx.currentTime + 0.005);
    const v = this._voice(midi, t, vel);
    this._end(v, t + Math.max(0.08, dur * 0.94));
    return true;
  }
  /* Live: a key down. A note already sounding slides to the new one. */
  hold(midi, vel = 0.85) {
    if (!this.ensure()) return false;
    const ctx = this.audio.ctx, t = ctx.currentTime + 0.005;
    if (this.live) {
      const f = midiHz(midi);
      for (const o of this.live.oscs) o.frequency.setTargetAtTime(f, t, 0.012);
      this.live.filter.frequency.setTargetAtTime(Math.min(7000, f * 4.5), t, 0.02);
      this.live.midi = midi;
      return true;
    }
    this.live = this._voice(midi, t, vel);
    return true;
  }
  /* Live: a key up. Only ends the note if it's the one sounding. */
  release(midi = null) {
    if (!this.live || (midi != null && this.live.midi !== midi)) return;
    this._end(this.live, this.audio.ctx.currentTime + 0.01);
    this.live = null;
  }
  get sounding() { return this.live?.midi ?? null; }
  stop() { this.release(); super.stop(); }
}
