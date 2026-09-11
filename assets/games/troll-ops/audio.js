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

    // Sounds with a world position route through a per-emission PannerNode
    // instead of straight to master, so you can hear which side a shot came
    // from. Everything else (your own gun, UI, hitmarkers) stays on master.
    this.listener = this.ctx.listener;

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

  /* Where the listener is and which way it faces. Called once a frame from
     the render loop; without it every panner would resolve against the origin
     and the whole map would sound like it was north of you. */
  setListener(pos, forward, up) {
    if (!this._ready()) return;
    const l = this.listener;
    const t = this.now;
    // Firefox still lacks the AudioParam form of the listener properties.
    if (l.positionX) {
      l.positionX.setValueAtTime(pos.x, t);
      l.positionY.setValueAtTime(pos.y, t);
      l.positionZ.setValueAtTime(pos.z, t);
      l.forwardX.setValueAtTime(forward.x, t);
      l.forwardY.setValueAtTime(forward.y, t);
      l.forwardZ.setValueAtTime(forward.z, t);
      l.upX.setValueAtTime(up.x, t);
      l.upY.setValueAtTime(up.y, t);
      l.upZ.setValueAtTime(up.z, t);
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /* Node a sound should connect to. With a position that's a fresh panner
     feeding master; without one it's master itself. Panners are cheap and
     get collected once the source stops, so one per emission is fine. */
  _dest(at) {
    if (!at) return this.master;
    const p = this.ctx.createPanner();
    p.panningModel = "HRTF";
    p.distanceModel = "inverse";
    p.refDistance = 4;        // full volume within a few metres
    p.rolloffFactor = 0.9;
    p.maxDistance = 90;
    if (p.positionX) {
      const t = this.now;
      p.positionX.setValueAtTime(at.x, t);
      p.positionY.setValueAtTime(at.y, t);
      p.positionZ.setValueAtTime(at.z, t);
    } else {
      p.setPosition(at.x, at.y, at.z);
    }
    p.connect(this.master);
    return p;
  }

  /* Burst of filtered noise — the body of most sounds here. */
  _noise({ duration = 0.2, gain = 0.5, type = "lowpass", freq = 1200, q = 1, sweepTo = null, delay = 0, at = null }) {
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

    src.connect(filter).connect(g).connect(this._dest(at));
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  _tone({ freq = 440, duration = 0.1, gain = 0.2, type = "sine", to = null, delay = 0, at = null }) {
    const t0 = this.now + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
    osc.connect(g).connect(this._dest(at));
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  _ready() { return this.enabled && this.ctx && this.ctx.state === "running"; }

  /* Gunshot. Heavier, slower weapons get a deeper, longer report; a
     suppressor swaps the crack for a muffled thud. */
  shot(def, volume = 1, at = null) {
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
      at,
    });
    this._tone({
      freq: quiet ? 120 : 190 - heavy * 70,
      to: 45,
      duration: dur * 1.1,
      gain: (quiet ? 0.1 : 0.3) * volume,
      type: "sine",
      at,
    });
    if (!quiet) {
      this._noise({ duration: 0.035, gain: 0.28 * volume, type: "highpass", freq: 3000, at });
    }
  }

  /* Round striking the world. */
  /* Melee: air first, then the meaty part only if it connected. */
  swing() {
    if (!this._ready()) return;
    this._noise({ duration: 0.14, gain: 0.16, type: "bandpass", freq: 900, sweepTo: 2600, q: 0.8 });
  }

  meleeHit(at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.12, gain: 0.5, type: "lowpass", freq: 900, sweepTo: 160, at });
    this._tone({ freq: 150, to: 60, duration: 0.13, gain: 0.22, type: "square", at });
  }

  throwGear() {
    if (!this._ready()) return;
    this._noise({ duration: 0.16, gain: 0.14, type: "bandpass", freq: 600, sweepTo: 1800, q: 1.4 });
  }

  /* Blast: low body, long tail, and a crack on top so it reads outdoors. */
  explosion(scale = 1, at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.1, gain: 0.7 * scale, type: "highpass", freq: 2200, sweepTo: 900, at });
    this._noise({ duration: 1.1 * scale, gain: 0.6 * scale, type: "lowpass", freq: 700, sweepTo: 70, at });
    this._tone({ freq: 90, to: 28, duration: 0.7 * scale, gain: 0.35 * scale, type: "sine", at });
  }

  /* Flashbang: the bang, then the ringing that replaces everything else. */
  flashbang(close = 1, at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.28, gain: 0.55, type: "highpass", freq: 1800, sweepTo: 3400, at });
    // The ringing stays unpanned: it's in your ears, not out in the world.
    if (close > 0.2) {
      this._tone({ freq: 4200, duration: 2.6 * close, gain: 0.09 * close, type: "sine" });
      this._tone({ freq: 6300, duration: 2.2 * close, gain: 0.05 * close, type: "sine" });
    }
  }

  fire() {
    if (!this._ready()) return;
    this._noise({ duration: 0.5, gain: 0.1, type: "lowpass", freq: 500, sweepTo: 180 });
  }

  impact(at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.07, gain: 0.16, type: "bandpass", freq: 1800 + Math.random() * 1200, q: 2, at });
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

  step(at = null, gain = 0.07) {
    if (!this._ready()) return;
    this._noise({ duration: 0.06, gain, type: "lowpass", freq: 520, sweepTo: 180, at });
  }

  /* EMP: a rising whine that snaps into a static wash. */
  emp(at = null) {
    if (!this._ready()) return;
    this._tone({ freq: 300, to: 2400, duration: 0.22, gain: 0.22, type: "sawtooth", at });
    this._noise({ duration: 0.9, gain: 0.34, type: "bandpass", freq: 3200, q: 0.7, sweepTo: 600, at });
    this._tone({ freq: 70, to: 30, duration: 0.5, gain: 0.2, type: "square", at, delay: 0.05 });
  }

  /* Your own gear going down under an EMP — dry, close, no panning. */
  empHit() {
    if (!this._ready()) return;
    this._noise({ duration: 1.4, gain: 0.1, type: "bandpass", freq: 1800, q: 0.5, sweepTo: 400 });
    this._tone({ freq: 1600, to: 200, duration: 0.4, gain: 0.12, type: "sawtooth" });
  }

  /* Smoke canister venting — a long hiss that keeps going while it burns. */
  smoke(at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 2.6, gain: 0.3, type: "bandpass", freq: 2600, q: 0.6, sweepTo: 1100, at });
    this._tone({ freq: 160, to: 60, duration: 0.4, gain: 0.14, type: "sine", at });
  }

  /* Round passing close by — the sound half of suppression. */
  whiz(at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.13, gain: 0.16, type: "bandpass", freq: 2600, q: 6, sweepTo: 700, at });
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

  /* One second off the pre-match clock. Deliberately dry and quiet — it fires
     up to six times in a row, so anything with a tail would smear. */
  stageTick(last = false) {
    if (!this._ready()) return;
    this._tone({
      freq: last ? 880 : 560, duration: last ? 0.2 : 0.07,
      gain: last ? 0.15 : 0.1, type: "square",
    });
  }
}
