// Troll Ops — synthesized audio.
//
// Everything is generated with Web Audio rather than loaded as files: no
// assets to ship, nothing new for the CSP to allow, and per-weapon variation
// falls out of the parameters instead of needing a sample per gun.
//
// Browsers won't start an AudioContext without a gesture, so `resume()` is
// called from the Drop In click.

const NOISE_SECONDS = 2;

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.4;
    this.noise = null;
  }

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { this.enabled = false; return; }
    this.ctx = new Ctx();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);

    // A single noise buffer backs gunfire, impacts and footsteps.
    const len = this.ctx.sampleRate * NOISE_SECONDS;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
  }

  resume() {
    this.init();
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? this.volume : 0;
  }

  /* 0..1 */
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v)) * 0.8;
    this.enabled = this.volume > 0;
    if (this.master) this.master.gain.value = this.volume;
  }

  get now() { return this.ctx.currentTime; }

  /* Burst of filtered noise — the body of most sounds here. */
  _noise({ duration = 0.2, gain = 0.5, type = "lowpass", freq = 1200, q = 1, sweepTo = null, delay = 0 }) {
    const t0 = this.now + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;

    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t0);
    if (sweepTo != null) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + duration);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);

    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  _tone({ freq = 440, duration = 0.1, gain = 0.2, type = "sine", to = null, delay = 0 }) {
    const t0 = this.now + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  _ready() { return this.enabled && this.ctx && this.ctx.state === "running"; }

  /* Gunshot. Heavier, slower weapons get a deeper, longer report; a
     suppressor swaps the crack for a muffled thud. */
  shot(def, volume = 1) {
    if (!this._ready() || volume <= 0.02) return;
    const heavy = Math.min(1, (def.damage * (def.pellets || 1)) / 90);
    const quiet = !!def.quiet;

    const dur = 0.09 + heavy * 0.22;
    const top = quiet ? 900 : 2600 - heavy * 900;

    this._noise({
      duration: dur,
      gain: (quiet ? 0.16 : 0.42) * volume,
      type: "lowpass",
      freq: top,
      sweepTo: top * 0.18,
    });
    this._tone({
      freq: quiet ? 120 : 190 - heavy * 70,
      to: 45,
      duration: dur * 1.1,
      gain: (quiet ? 0.1 : 0.3) * volume,
      type: "sine",
    });
    if (!quiet) {
      this._noise({ duration: 0.035, gain: 0.28 * volume, type: "highpass", freq: 3000 });
    }
  }

  /* Round striking the world. */
  impact() {
    if (!this._ready()) return;
    this._noise({ duration: 0.07, gain: 0.16, type: "bandpass", freq: 1800 + Math.random() * 1200, q: 2 });
  }

  /* Confirmation that you hit someone. */
  hitmarker(isHead) {
    if (!this._ready()) return;
    this._tone({ freq: isHead ? 1500 : 1050, to: isHead ? 1900 : 1250, duration: 0.06, gain: 0.16, type: "square" });
  }

  kill() {
    if (!this._ready()) return;
    this._tone({ freq: 700, duration: 0.09, gain: 0.16, type: "triangle" });
    this._tone({ freq: 1080, duration: 0.14, gain: 0.15, type: "triangle", delay: 0.07 });
  }

  reload() {
    if (!this._ready()) return;
    this._noise({ duration: 0.05, gain: 0.16, type: "bandpass", freq: 900, q: 3 });
    this._noise({ duration: 0.05, gain: 0.14, type: "bandpass", freq: 1500, q: 3, delay: 0.16 });
    this._noise({ duration: 0.07, gain: 0.18, type: "bandpass", freq: 700, q: 3, delay: 0.4 });
  }

  step() {
    if (!this._ready()) return;
    this._noise({ duration: 0.06, gain: 0.07, type: "lowpass", freq: 520, sweepTo: 180 });
  }

  /* Round passing close by — the sound half of suppression. */
  whiz() {
    if (!this._ready()) return;
    this._noise({ duration: 0.13, gain: 0.16, type: "bandpass", freq: 2600, q: 6, sweepTo: 700 });
  }

  hurt() {
    if (!this._ready()) return;
    this._tone({ freq: 220, to: 90, duration: 0.2, gain: 0.2, type: "sawtooth" });
  }

  died() {
    if (!this._ready()) return;
    this._tone({ freq: 300, to: 60, duration: 0.7, gain: 0.24, type: "sawtooth" });
  }

  wave() {
    if (!this._ready()) return;
    this._tone({ freq: 420, duration: 0.16, gain: 0.14, type: "triangle" });
    this._tone({ freq: 630, duration: 0.22, gain: 0.13, type: "triangle", delay: 0.14 });
  }
}
