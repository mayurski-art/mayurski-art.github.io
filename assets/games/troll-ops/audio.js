// Troll Forces — synthesized audio.
//
// Everything is generated with Web Audio rather than loaded as files: no
// assets to ship, nothing new for the CSP to allow, and per-weapon variation
// falls out of the parameters instead of needing a sample per gun.
//
// Browsers won't start an AudioContext without a gesture, so `resume()` is
// called from the Drop In click.

const NOISE_SECONDS = 2;
const HRTF_RANGE = 40;   // metres: sounds further off pan left/right only
const SHOT_CULL = 160;   // metres: gunfire further off isn't played

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
    this._lx = pos.x; this._ly = pos.y; this._lz = pos.z;
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

  /* Is `at` more than `range` metres from the listener? */
  _far(at, range) {
    if (this._lx === undefined) return false;
    return (at.x - this._lx) ** 2 + (at.y - this._ly) ** 2 + (at.z - this._lz) ** 2 > range * range;
  }

  /* Node a sound should connect to. With a position that's a fresh panner
     feeding master; without one it's master itself. Panners are cheap and
     get collected once the source stops, so one per emission is fine. */
  _dest(at) {
    if (!at) return this.master;
    const p = this.ctx.createPanner();
    // HRTF is the costly model; far off, plain left/right panning sounds
    // the same and is a fraction of the work.
    p.panningModel = this._far(at, HRTF_RANGE) ? "equalpower" : "HRTF";
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
    // A 100-troll Royale fires constantly across the island: past this a
    // shot is a whisper anyway, and every one was a stack of new nodes.
    if (at && this._far(at, SHOT_CULL)) return;
    if (def.candleShot) { this.candleShot(def.chargeLevel || 0, volume, at); return; }
    if (def.revolver) { this.revolverShot(volume, at); return; }
    if (def.magnum && !def.quiet) { this.magnumShot(volume, at); return; }
    if (def.hellfire && !def.quiet) this.hellfireShot(volume, at);   // and the boom below
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

  /* ---- the Soul Blazer (soul-blazer.js) ---- */

  /* A short screech: a sawtooth throat with a fast vibrato, rising to a
     peak and falling away, through a bandpass. Shorter and quieter than a
     zombie's shriek: the gun's voice, not a monster's. */
  _screech({ f0 = 900, peak = 1700, end = 650, dur = 0.28, gain = 0.1, vib = 46, depth = 70, band = 2200, delay = 0, at = null }) {
    const ctx = this.ctx, t0 = this.now + delay;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(peak, t0 + dur * 0.28);
    osc.frequency.exponentialRampToValueAtTime(end, t0 + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = vib;
    const lg = ctx.createGain();
    lg.gain.value = depth;
    lfo.connect(lg).connect(osc.frequency);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = band;
    bp.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0008, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(bp).connect(g).connect(this._dest(at));
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + dur + 0.05);
    lfo.stop(t0 + dur + 0.05);
  }

  /* Every shot: a roar of fire out of the jaws and a short screech over the
     boom (shot() plays the boom after this). */
  hellfireShot(volume = 1, at = null) {
    if (!this._ready()) return;
    this.fireWhoosh(0.9 * volume, at);
    this._screech({ gain: 0.09 * volume, at, delay: 0.015, f0: 850 + Math.random() * 120, peak: 1650 + Math.random() * 250 });
  }

  fireWhoosh(volume = 1, at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.42, gain: 0.26 * volume, type: "bandpass", freq: 1700, q: 0.8, sweepTo: 280, at });
    this._noise({ duration: 0.3, gain: 0.14 * volume, type: "lowpass", freq: 600, sweepTo: 120, delay: 0.03, at });
  }

  /* The last shell: the fire coughs and goes out. */
  emberCough() {
    if (!this._ready()) return;
    this._noise({ duration: 0.12, gain: 0.16, type: "bandpass", freq: 500, q: 1.4, sweepTo: 260 });
    this._noise({ duration: 0.5, gain: 0.07, type: "highpass", freq: 3000, sweepTo: 1200, delay: 0.08 });
  }

  /* A shell fed in: a low gulp as its skull's eyes light. */
  soulGulp() {
    if (!this._ready()) return;
    this._tone({ freq: 160, to: 70, duration: 0.12, gain: 0.08, type: "sine", delay: 0.03 });
    this._noise({ duration: 0.09, gain: 0.05, type: "bandpass", freq: 900, q: 2, sweepTo: 500, delay: 0.03 });
  }

  /* The relight: the pump slams and the skull roars back to life. */
  soulRoar() {
    if (!this._ready()) return;
    this._noise({ duration: 0.05, gain: 0.22, type: "bandpass", freq: 1300, q: 3 });
    this.fireWhoosh(1.2);
    this._screech({ f0: 420, peak: 1250, end: 380, dur: 0.75, gain: 0.12, vib: 30, depth: 90, band: 1500, delay: 0.04 });
    this._tone({ freq: 70, to: 38, duration: 0.6, gain: 0.22, type: "sine", delay: 0.03 });
  }

  /* Admire: a low growl as the jaw opens. */
  soulGrowl() {
    if (!this._ready()) return;
    this._screech({ f0: 110, peak: 150, end: 95, dur: 0.85, gain: 0.08, vib: 23, depth: 18, band: 520 });
    this._noise({ duration: 0.8, gain: 0.05, type: "lowpass", freq: 400, sweepTo: 200 });
  }

  /* Admire on an empty gun: a dry rasp instead. */
  dryRasp() {
    if (!this._ready()) return;
    this._noise({ duration: 0.6, gain: 0.06, type: "bandpass", freq: 2300, q: 1.2, sweepTo: 1100 });
  }

  /* Teeth meeting. */
  jawClack() {
    if (!this._ready()) return;
    this._noise({ duration: 0.03, gain: 0.2, type: "bandpass", freq: 2100, q: 5 });
    this._noise({ duration: 0.04, gain: 0.12, type: "bandpass", freq: 1300, q: 4, delay: 0.012 });
  }

  /* A soft ember tick (the admire's wave lighting each skull). `hot`
     adds a breath of fire under it. */
  soulTick(level = 1, hot = true) {
    if (!this._ready()) return;
    this._tone({ freq: 520 + 300 * level, to: 380, duration: 0.07, gain: 0.04 * level, type: "triangle" });
    if (hot) this._noise({ duration: 0.18, gain: 0.04 * level, type: "bandpass", freq: 1500, q: 1, sweepTo: 600 });
  }

  /* The charms on their chains. */
  chainJingle(level = 1) {
    if (!this._ready()) return;
    for (let i = 0; i < 9; i++) {
      const hz = 2400 + Math.random() * 2600;
      const d = Math.random() * 0.22;
      this._tone({ freq: hz, to: hz * 0.98, duration: 0.05 + Math.random() * 0.05, gain: (0.02 + Math.random() * 0.02) * level, type: "sine", delay: d });
    }
    this._noise({ duration: 0.12, gain: 0.04 * level, type: "highpass", freq: 3500 });
  }

  /* A kill with it: the body goes up with a rush of fire and a screech. */
  soulFeed(at = null) {
    if (!this._ready() || (at && this._far(at, 80))) return;
    this._noise({ duration: 0.9, gain: 0.22, type: "bandpass", freq: 900, q: 0.7, sweepTo: 220, at });
    this._screech({ f0: 600, peak: 1400, end: 300, dur: 0.6, gain: 0.08, vib: 36, depth: 80, band: 1800, delay: 0.05, at });
  }

  /* Single-action revolver: a hard black-powder crack with a boom under it,
     the frame ringing for a moment, and a slapback off the false fronts. */
  revolverShot(volume = 1, at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.03, gain: 0.42 * volume, type: "highpass", freq: 2600, at });
    this._noise({ duration: 0.22, gain: 0.46 * volume, type: "lowpass", freq: 2300, sweepTo: 260, at });
    this._tone({ freq: 150, to: 42, duration: 0.24, gain: 0.32 * volume, type: "sine", at });
    for (const [hz, g] of [[2210, 0.035], [3370, 0.022], [4890, 0.012]]) {
      this._tone({ freq: hz, to: hz * 0.985, duration: 0.18, gain: g * volume, type: "sine", delay: 0.004, at });
    }
    this._noise({ duration: 0.16, gain: 0.12 * volume, type: "lowpass", freq: 1500, sweepTo: 300, delay: 0.11, at });
  }

  /* The Desert Eagle (.50 AE, def.magnum): a hard supersonic crack, a big
     chest-thump boom well under a pistol's, the blast rolling off for half
     a second, the slide clacking back mid-report, and a slapback. */
  magnumShot(volume = 1, at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.025, gain: 0.5 * volume, type: "highpass", freq: 3200, at });
    this._noise({ duration: 0.34, gain: 0.55 * volume, type: "lowpass", freq: 3400, sweepTo: 170, at });
    this._tone({ freq: 118, to: 30, duration: 0.5, gain: 0.46 * volume, type: "sine", at });
    this._tone({ freq: 240, to: 75, duration: 0.11, gain: 0.2 * volume, type: "triangle", at });
    this._noise({ duration: 0.03, gain: 0.12 * volume, type: "bandpass", freq: 2700, q: 5, delay: 0.055, at });
    this._noise({ duration: 0.65, gain: 0.15 * volume, type: "lowpass", freq: 900, sweepTo: 120, delay: 0.07, at });
    this._noise({ duration: 0.2, gain: 0.09 * volume, type: "lowpass", freq: 1300, sweepTo: 260, delay: 0.17, at });
  }

  /* The slide stop dropped on a fresh mag: the slide slams home. */
  slideRelease() {
    if (!this._ready()) return;
    this._noise({ duration: 0.025, gain: 0.22, type: "bandpass", freq: 3300, q: 5 });
    this._noise({ duration: 0.06, gain: 0.15, type: "bandpass", freq: 1300, q: 3, delay: 0.008 });
    this._tone({ freq: 4300, to: 4150, duration: 0.09, gain: 0.025, type: "sine", delay: 0.006 });
  }

  /* Deagle reload foley on the view model's beats (fractions of `time`):
     the mag release and the heavy mag sliding out, the fresh one in and
     slapped home. An empty one ends on the slide release (weapon-view.js). */
  magnumReload(time) {
    if (!this._ready()) return;
    this._noise({ duration: 0.03, gain: 0.14, type: "bandpass", freq: 2400, q: 5, delay: time * 0.16 });
    this._noise({ duration: 0.12, gain: 0.09, type: "bandpass", freq: 1500, q: 2, sweepTo: 900, delay: time * 0.2 });
    this._noise({ duration: 0.1, gain: 0.1, type: "bandpass", freq: 1100, q: 2, sweepTo: 1700, delay: time * 0.5 });
    this._noise({ duration: 0.05, gain: 0.2, type: "bandpass", freq: 800, q: 3, delay: time * 0.66 });
    this._noise({ duration: 0.03, gain: 0.12, type: "bandpass", freq: 2200, q: 5, delay: time * 0.665 });
  }

  /* The hammer thumbed back: two quick clicks, the second brighter. */
  hammerCock(at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.02, gain: 0.08, type: "bandpass", freq: 2400, q: 5, at });
    this._noise({ duration: 0.025, gain: 0.1, type: "bandpass", freq: 3600, q: 6, delay: 0.05, at });
  }

  /* The cylinder swung out on its crane: a latch click and a metal slide. */
  cylinderOut() {
    if (!this._ready()) return;
    this._noise({ duration: 0.025, gain: 0.16, type: "bandpass", freq: 2800, q: 5 });
    this._noise({ duration: 0.09, gain: 0.1, type: "bandpass", freq: 1500, q: 2, sweepTo: 2400, delay: 0.03 });
  }

  /* Twelve empties hitting the boardwalk: bright little pings, scattered. */
  brassTinkle(n = 12) {
    if (!this._ready()) return;
    for (let i = 0; i < n; i++) {
      const hz = 3200 + Math.random() * 2600;
      const d = 0.22 + Math.random() * 0.4;
      this._tone({ freq: hz, to: hz * 0.97, duration: 0.07 + Math.random() * 0.06, gain: 0.04 + Math.random() * 0.03, type: "sine", delay: d });
      if (Math.random() < 0.5) this._tone({ freq: hz * 1.4, to: hz * 1.35, duration: 0.05, gain: 0.025, type: "sine", delay: d + 0.07 + Math.random() * 0.05 });
    }
  }

  /* Speedloader seated: a chunky clack, then the release twist. */
  speedloader() {
    if (!this._ready()) return;
    this._noise({ duration: 0.05, gain: 0.2, type: "bandpass", freq: 900, q: 2.5 });
    this._noise({ duration: 0.04, gain: 0.12, type: "bandpass", freq: 2000, q: 4, delay: 0.08 });
  }

  /* Flicked shut: the ratchet buzzing as it spins, then the snap. */
  cylinderSpin() {
    if (!this._ready()) return;
    for (let i = 0; i < 9; i++) this._noise({ duration: 0.012, gain: 0.07 * (1 - i / 11), type: "bandpass", freq: 3000, q: 6, delay: i * (0.022 + i * 0.004) });
    this._noise({ duration: 0.04, gain: 0.2, type: "bandpass", freq: 1800, q: 3, delay: 0.02 });
  }

  /* Brass knuckles: a short fist whoosh, a meaty hit with a clink of
     metal, and the knuckles cracked on the draw. */
  knuckleSwing() {
    if (!this._ready()) return;
    this._noise({ duration: 0.1, gain: 0.15, type: "bandpass", freq: 700, sweepTo: 1900, q: 0.9 });
  }

  knuckleHit(at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.1, gain: 0.55, type: "lowpass", freq: 700, sweepTo: 130, at });
    this._tone({ freq: 120, to: 50, duration: 0.11, gain: 0.26, type: "square", at });
    this._tone({ freq: 2600, to: 2500, duration: 0.12, gain: 0.05, type: "sine", delay: 0.01, at });
    this._tone({ freq: 3900, to: 3850, duration: 0.08, gain: 0.03, type: "sine", delay: 0.01, at });
  }

  knuckleCrack() {
    if (!this._ready()) return;
    for (let i = 0; i < 4; i++) this._noise({ duration: 0.018, gain: 0.12, type: "bandpass", freq: 1500 + Math.random() * 900, q: 3, delay: i * 0.07 + Math.random() * 0.02 });
  }

  /* Green Candles bolt: an electric zap falling in pitch over a hiss of
     wax, with a sub thump that grows with the charge (0 = a tap). */
  candleShot(level = 0, volume = 1, at = null) {
    if (!this._ready()) return;
    const dur = 0.16 + level * 0.28;
    this._tone({ freq: 1250 - level * 350, to: 150 - level * 60, duration: dur, gain: 0.16 * volume, type: "sawtooth", at });
    this._tone({ freq: 620 - level * 180, to: 90, duration: dur * 0.9, gain: 0.12 * volume, type: "square", at });
    this._noise({ duration: dur * 0.8, gain: (0.22 + level * 0.12) * volume, type: "bandpass", freq: 2400, q: 1.4, sweepTo: 600, at });
    this._tone({ freq: 95, to: 38, duration: 0.14 + level * 0.3, gain: (0.18 + level * 0.3) * volume, type: "sine", at });
    if (level > 0.6) this._noise({ duration: 0.3, gain: 0.2 * volume, type: "lowpass", freq: 900, sweepTo: 120, delay: 0.02, at });
  }

  /* The charge hum: one held oscillator pair whose pitch and level follow
     the charge; `level` < 0 stops it. `full` adds a warble. */
  candleCharge(level, full = false) {
    if (!this.ctx) return;
    const t = this.now;
    if (level < 0) {
      if (this._hum) {
        const h = this._hum;
        this._hum = null;
        h.g.gain.cancelScheduledValues(t);
        h.g.gain.setTargetAtTime(0.0001, t, 0.03);
        h.a.stop(t + 0.2);
        h.b.stop(t + 0.2);
        h.lfo.stop(t + 0.2);
      }
      return;
    }
    if (!this._ready()) return;
    if (!this._hum) {
      const a = this.ctx.createOscillator(), b = this.ctx.createOscillator(), lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      a.type = "sawtooth";
      b.type = "sine";
      lfo.frequency.value = 7;
      lfoGain.gain.value = 0;
      f.type = "lowpass";
      f.Q.value = 6;
      g.gain.value = 0.0001;
      lfo.connect(lfoGain).connect(a.frequency);
      a.connect(f);
      b.connect(f);
      f.connect(g).connect(this.master);
      a.start(t); b.start(t); lfo.start(t);
      this._hum = { a, b, lfo, lfoGain, f, g };
    }
    const h = this._hum;
    h.a.frequency.setTargetAtTime(110 + level * 330, t, 0.04);
    h.b.frequency.setTargetAtTime(220 + level * 660, t, 0.04);
    h.f.frequency.setTargetAtTime(500 + level * 2600, t, 0.05);
    h.g.gain.setTargetAtTime(0.03 + level * 0.1, t, 0.05);
    h.lfoGain.gain.setTargetAtTime(full ? 18 : 0, t, 0.08);
  }

  /* Tank swap: clamp release + hose hiss, the tank seating, then the
     candle catching again. `dur` is the whole reload. */
  tankSwap(dur = 3.2) {
    if (!this._ready()) return;
    this._noise({ duration: 0.06, gain: 0.18, type: "bandpass", freq: 1100, q: 3, delay: dur * 0.16 });
    this._noise({ duration: 0.45, gain: 0.14, type: "highpass", freq: 3500, sweepTo: 1800, delay: dur * 0.2 });
    this._noise({ duration: 0.08, gain: 0.22, type: "bandpass", freq: 520, q: 2, delay: dur * 0.56 });
    this._noise({ duration: 0.05, gain: 0.18, type: "bandpass", freq: 1700, q: 4, delay: dur * 0.6 });
    this._noise({ duration: 0.35, gain: 0.12, type: "bandpass", freq: 1400, q: 0.8, sweepTo: 3200, delay: dur * 0.7 });
    this._tone({ freq: 180, to: 420, duration: 0.3, gain: 0.07, type: "sine", delay: dur * 0.7 });
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

  /* A K9's bark as it bites (a gruff two-part "rruf"), or its yelp going
     down. Placed in the world like the other hits. */
  bark(at = null, yelp = false) {
    if (!this._ready()) return;
    if (yelp) {
      this._tone({ freq: 900, to: 420, duration: 0.22, gain: 0.16, type: "sawtooth", at });
      return;
    }
    this._noise({ duration: 0.09, gain: 0.32, type: "bandpass", freq: 520, q: 1.4, sweepTo: 300, at });
    this._tone({ freq: 240, to: 150, duration: 0.1, gain: 0.2, type: "sawtooth", at });
    this._tone({ freq: 300, to: 170, duration: 0.08, gain: 0.14, type: "sawtooth", delay: 0.1, at });
    this._noise({ duration: 0.06, gain: 0.2, type: "lowpass", freq: 900, sweepTo: 200, delay: 0.1, at });
  }

  /* ---- U Mad Bro? meme sounds ------------------------------------------
     All synthesised like everything else here: a cartoon bonk (a hollow
     wooden knock with a high ring), the MLG airhorn (three detuned square
     blasts) and a slide whistle that falls as a body flies off. */
  bonk(at = null) {
    if (!this._ready()) return;
    this._tone({ freq: 620, to: 540, duration: 0.18, gain: 0.26, type: "triangle", at });
    this._tone({ freq: 1240, to: 1080, duration: 0.12, gain: 0.1, type: "sine", at });
    this._noise({ duration: 0.05, gain: 0.3, type: "bandpass", freq: 1800, q: 3, at });
  }

  airhorn() {
    if (!this._ready()) return;
    const blast = (delay, dur) => {
      for (const f of [466, 470, 233]) this._tone({ freq: f, to: f * 0.97, duration: dur, gain: 0.07, type: "square", delay });
      this._noise({ duration: dur, gain: 0.05, type: "bandpass", freq: 1400, q: 1.2, delay });
    };
    blast(0, 0.16);
    blast(0.2, 0.16);
    blast(0.4, 0.55);
  }

  slideWhistle(at = null, up = false) {
    if (!this._ready()) return;
    const [a, b] = up ? [500, 1900] : [1900, 380];
    this._tone({ freq: a, to: b, duration: 0.7, gain: 0.14, type: "sine", at });
    this._noise({ duration: 0.7, gain: 0.03, type: "bandpass", freq: 1500, q: 4, at });
  }

  /* Calling the K9s: a two-finger whistle. A short rising chirp, then the
     long note that swoops up and falls away, each over a breathy hiss.
     `delay` lines it up with the fingers reaching the mouth. */
  whistle(at = null, delay = 0) {
    if (!this._ready()) return;
    const note = (t0, dur, f0, f1, f2, gain) => {
      const osc = this.ctx.createOscillator();
      const vib = this.ctx.createOscillator();
      const vibGain = this.ctx.createGain();
      const g = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f0, t0);
      osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.3);
      osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      vib.frequency.value = 6.5;
      vibGain.gain.value = f1 * 0.012;
      vib.connect(vibGain).connect(osc.frequency);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.035);
      g.gain.setValueAtTime(gain, t0 + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
      osc.connect(g).connect(this._dest(at));
      osc.start(t0); vib.start(t0);
      osc.stop(t0 + dur + 0.02); vib.stop(t0 + dur + 0.02);
      this._noise({ duration: dur, gain: gain * 0.35, type: "bandpass", freq: f1, q: 6, delay: t0 - this.now, at });
    };
    const t = this.now + delay;
    note(t, 0.2, 1500, 2600, 2500, 0.13);
    note(t + 0.3, 0.62, 1900, 3000, 1700, 0.15);
  }

  /* ---- Trollsaber ---------------------------------------------------
     A hum that bends up with swing speed (the film trick: the hum
     doppler-shifts past the mic), a snap-hiss ignite, a whoosh-buzz swing,
     a sizzle on a hit and a crackling clash when the blade eats a round. */
  saberHum(level) {
    if (!this.ctx) return;
    const t = this.now;
    if (level < 0) {
      if (this._saber) {
        const h = this._saber;
        this._saber = null;
        h.g.gain.cancelScheduledValues(t);
        h.g.gain.setTargetAtTime(0.0001, t, 0.03);
        for (const o of [h.a, h.b, h.lfo]) o.stop(t + 0.25);
      }
      return;
    }
    if (!this._ready()) return;
    if (!this._saber) {
      const a = this.ctx.createOscillator(), b = this.ctx.createOscillator(), lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      a.type = "sawtooth"; a.frequency.value = 88;
      b.type = "sawtooth"; b.frequency.value = 90.5;
      lfo.frequency.value = 5.5; lfoGain.gain.value = 1.8;
      f.type = "lowpass"; f.frequency.value = 520; f.Q.value = 3;
      g.gain.value = 0.0001;
      lfo.connect(lfoGain).connect(a.frequency);
      a.connect(f); b.connect(f); f.connect(g).connect(this.master);
      a.start(t); b.start(t); lfo.start(t);
      this._saber = { a, b, lfo, f, g };
    }
    const h = this._saber;
    h.a.frequency.setTargetAtTime(88 + level * 70, t, 0.03);
    h.b.frequency.setTargetAtTime(90.5 + level * 76, t, 0.03);
    h.f.frequency.setTargetAtTime(520 + level * 1700, t, 0.03);
    h.g.gain.cancelScheduledValues(t);
    h.g.gain.setTargetAtTime(0.045 + level * 0.11, t, 0.04);
    // Fades on its own if nobody keeps calling (pause, game over).
    h.g.gain.setTargetAtTime(0.0001, t + 0.3, 0.06);
  }

  /* Someone else's blade: one shared hum voice, placed on the nearest lit
     saber each frame (`at`), fading out when nobody keeps calling. A second
     voice for a second saber isn't worth the oscillators. */
  saberHumAt(level, at) {
    if (!this.ctx) return;
    const t = this.now;
    if (level < 0 || !at) {
      if (this._saberFar) this._saberFar.g.gain.setTargetAtTime(0.0001, t, 0.05);
      return;
    }
    if (!this._ready()) return;
    if (!this._saberFar) {
      const a = this.ctx.createOscillator(), b = this.ctx.createOscillator();
      const f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      a.type = "sawtooth"; a.frequency.value = 86;
      b.type = "sawtooth"; b.frequency.value = 88.7;
      f.type = "lowpass"; f.frequency.value = 480; f.Q.value = 3;
      g.gain.value = 0.0001;
      const p = this._dest(at);
      a.connect(f); b.connect(f); f.connect(g).connect(p);
      a.start(t); b.start(t);
      this._saberFar = { a, b, f, g, p };
    }
    const h = this._saberFar;
    if (h.p.positionX) {
      h.p.positionX.setTargetAtTime(at.x, t, 0.03);
      h.p.positionY.setTargetAtTime(at.y, t, 0.03);
      h.p.positionZ.setTargetAtTime(at.z, t, 0.03);
    } else {
      h.p.setPosition(at.x, at.y, at.z);
    }
    h.a.frequency.setTargetAtTime(86 + level * 70, t, 0.05);
    h.b.frequency.setTargetAtTime(88.7 + level * 76, t, 0.05);
    h.f.frequency.setTargetAtTime(480 + level * 1600, t, 0.05);
    h.g.gain.cancelScheduledValues(t);
    h.g.gain.setTargetAtTime(0.05 + level * 0.12, t, 0.05);
    h.g.gain.setTargetAtTime(0.0001, t + 0.3, 0.06);
  }

  saberIgnite(at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.09, gain: 0.3, type: "highpass", freq: 3000, sweepTo: 1200, at });
    this._noise({ duration: 0.35, gain: 0.16, type: "bandpass", freq: 700, q: 1.2, sweepTo: 2600, delay: 0.02, at });
    this._tone({ freq: 60, to: 170, duration: 0.32, gain: 0.12, type: "sawtooth", delay: 0.02, at });
    this._tone({ freq: 120, to: 90, duration: 0.4, gain: 0.07, type: "sawtooth", delay: 0.18, at });
  }

  /* The equip ignite (game.js SLOW_IGNITE): a couple of dry catches, then a
     long hum that climbs as the blade pushes out, and the settle. */
  saberIgniteSlow(at = null) {
    if (!this._ready()) return;
    for (const d of [0, 0.13, 0.24]) this._noise({ duration: 0.05, gain: 0.22, type: "highpass", freq: 3400, sweepTo: 1800, delay: d, at });
    this._tone({ freq: 45, to: 175, duration: 1.05, gain: 0.13, type: "sawtooth", delay: 0.28, at });
    this._noise({ duration: 0.95, gain: 0.12, type: "bandpass", freq: 500, q: 1.3, sweepTo: 2600, delay: 0.3, at });
    this._tone({ freq: 120, to: 90, duration: 0.45, gain: 0.08, type: "sawtooth", delay: 1.15, at });
  }

  saberRetract(at = null) {
    if (!this._ready()) return;
    this._tone({ freq: 170, to: 45, duration: 0.3, gain: 0.1, type: "sawtooth", at });
    this._noise({ duration: 0.25, gain: 0.09, type: "bandpass", freq: 2200, q: 1, sweepTo: 500, at });
  }

  /* The Halo Blade: brighter and glassier than the saber. A crackle, two
     prongs' tones sliding up a fifth apart, and a shimmer to settle on. */
  haloIgnite(at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.12, gain: 0.26, type: "highpass", freq: 4200, sweepTo: 1800, at });
    this._tone({ freq: 140, to: 420, duration: 0.42, gain: 0.1, type: "sawtooth", delay: 0.03, at });
    this._tone({ freq: 210, to: 630, duration: 0.42, gain: 0.07, type: "triangle", delay: 0.05, at });
    this._noise({ duration: 0.5, gain: 0.12, type: "bandpass", freq: 1200, q: 2, sweepTo: 5200, delay: 0.06, at });
    this._tone({ freq: 880, to: 1320, duration: 0.3, gain: 0.035, type: "sine", delay: 0.35, at });
  }

  haloIgniteSlow(at = null) {
    if (!this._ready()) return;
    for (const d of [0, 0.15]) this._noise({ duration: 0.06, gain: 0.2, type: "highpass", freq: 4600, sweepTo: 2200, delay: d, at });
    this._tone({ freq: 120, to: 420, duration: 1.0, gain: 0.1, type: "sawtooth", delay: 0.25, at });
    this._tone({ freq: 180, to: 630, duration: 1.0, gain: 0.07, type: "triangle", delay: 0.28, at });
    this._noise({ duration: 1.0, gain: 0.11, type: "bandpass", freq: 1000, q: 2, sweepTo: 5200, delay: 0.3, at });
    this._tone({ freq: 880, to: 1320, duration: 0.35, gain: 0.035, type: "sine", delay: 1.2, at });
  }

  /* Drawing the chainsaw: two yanks on the cord, the engine catching. */
  chainsawStart(at = null) {
    if (!this._ready()) return;
    for (const d of [0, 0.32]) {
      this._noise({ duration: 0.16, gain: 0.14, type: "bandpass", freq: 900, q: 1.1, sweepTo: 2400, delay: d, at });
      this._tone({ freq: 38, to: 70, duration: 0.18, gain: 0.12, type: "sawtooth", delay: d + 0.04, at });
    }
    this._tone({ freq: 50, to: 120, duration: 0.6, gain: 0.15, type: "sawtooth", delay: 0.66, at });
    this._tone({ freq: 100, to: 240, duration: 0.6, gain: 0.06, type: "square", delay: 0.66, at });
  }

  /* A round smacking the Keyboard Warrior's shield: plastic, a key rattle. */
  keyboardShieldHit(at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.06, gain: 0.3, type: "bandpass", freq: 2400, q: 1.6, sweepTo: 1400, at });
    this._tone({ freq: 340, to: 210, duration: 0.07, gain: 0.08, type: "square", at });
    for (const d of [0.04, 0.07, 0.1]) this._noise({ duration: 0.025, gain: 0.1, type: "highpass", freq: 5200, delay: d, at });
  }

  /* The repair act's beats (keyboard-repair.js). */
  kbRepairCue(name, at = null) {
    if (!this._ready()) return;
    if (name === "clatter") {
      for (let i = 0; i < 7; i++) this._noise({ duration: 0.03, gain: 0.16, type: "highpass", freq: 3800 + i * 300, delay: i * 0.05 + Math.random() * 0.02, at });
      this._tone({ freq: 520, to: 260, duration: 0.25, gain: 0.05, type: "square", at });
    } else if (name === "flip" || name === "flip2") {
      // a quick toss-and-turn whoosh, the board landing back in the hands
      this._noise({ duration: 0.22, gain: 0.12, type: "bandpass", freq: 600, q: 0.9, sweepTo: 1800, at });
      this._noise({ duration: 0.05, gain: 0.18, type: "bandpass", freq: 900, q: 1.5, delay: 0.24, at });
    } else if (name === "lid") {
      this._noise({ duration: 0.05, gain: 0.22, type: "bandpass", freq: 1600, q: 2, at });
      this._tone({ freq: 300, to: 180, duration: 0.08, gain: 0.06, type: "square", delay: 0.02, at });
    } else if (/^screw\d$/.test(name)) {
      for (let i = 0; i < 5; i++) this._noise({ duration: 0.016, gain: 0.12, type: "bandpass", freq: 3000, q: 3, delay: i * 0.06, at });
      this._tone({ freq: 1400, to: 900, duration: 0.05, gain: 0.03, type: "triangle", delay: 0.32, at });   // the screw popping free
    } else if (name === "screw" || name === "screw2") {
      for (let i = 0; i < 8; i++) this._noise({ duration: 0.018, gain: 0.12, type: "bandpass", freq: 3000, q: 3, delay: i * 0.07, at });
    } else if (name === "solder" || name === "solder2") {
      this._noise({ duration: 0.5, gain: 0.08, type: "highpass", freq: 5000, sweepTo: 3500, at });
      this._tone({ freq: 1800, to: 1700, duration: 0.3, gain: 0.015, type: "sine", at });
    } else if (name === "plug") {
      this._noise({ duration: 0.04, gain: 0.25, type: "bandpass", freq: 1800, q: 2, at });
      [440, 660].forEach((f, i) => this._tone({ freq: f, to: f, duration: 0.09, gain: 0.05, type: "sine", delay: 0.12 + i * 0.1, at }));
    } else if (name === "chime") {
      [392, 523, 659, 784].forEach((f, i) => this._tone({ freq: f, to: f, duration: 0.3, gain: 0.05, type: "triangle", delay: i * 0.09, at }));
    }
  }

  /* Drawing the Keyboard Warrior: the RGB comes up with a boot chime. */
  keyboardBoot(at = null) {
    if (!this._ready()) return;
    [523, 659, 784, 1047].forEach((f, i) => this._tone({ freq: f, to: f, duration: 0.14, gain: 0.05, type: "square", delay: 0.12 + i * 0.11, at }));
  }

  haloRetract(at = null) {
    if (!this._ready()) return;
    this._tone({ freq: 420, to: 90, duration: 0.24, gain: 0.08, type: "sawtooth", at });
    this._noise({ duration: 0.2, gain: 0.08, type: "bandpass", freq: 3200, q: 1.4, sweepTo: 600, at });
  }

  /* ---- Chainsaw and the Reaper's Grin -------------------------------- */
  // The two-stroke rev on a swing, then the chain biting on a hit.
  chainsawRev(at = null) {
    if (!this._ready()) return;
    this._tone({ freq: 62, to: 138, duration: 0.42, gain: 0.16, type: "sawtooth", at });
    this._tone({ freq: 124, to: 270, duration: 0.42, gain: 0.07, type: "square", at });
    this._noise({ duration: 0.4, gain: 0.1, type: "bandpass", freq: 700, q: 1.4, sweepTo: 1500, at });
  }

  // The engine pinned as the saw goes in: a higher, ragged scream.
  chainsawRip(at = null) {
    if (!this._ready()) return;
    this._tone({ freq: 130, to: 240, duration: 0.5, gain: 0.15, type: "sawtooth", at });
    this._tone({ freq: 262, to: 470, duration: 0.45, gain: 0.06, type: "square", delay: 0.03, at });
    this._noise({ duration: 0.5, gain: 0.12, type: "bandpass", freq: 1300, q: 1.2, sweepTo: 2600, at });
  }

  chainsawHit(at = null) {
    if (!this._ready()) return;
    this._tone({ freq: 150, to: 90, duration: 0.35, gain: 0.18, type: "sawtooth", at });
    this._noise({ duration: 0.34, gain: 0.34, type: "bandpass", freq: 1900, q: 0.9, sweepTo: 800, at });
    this._noise({ duration: 0.16, gain: 0.3, type: "lowpass", freq: 700, sweepTo: 140, at });
  }

  // A thin, ghostly whistle behind the blade.
  reaperSwing(at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.2, gain: 0.14, type: "bandpass", freq: 1500, q: 1.2, sweepTo: 4200, at });
    this._tone({ freq: 880, to: 440, duration: 0.32, gain: 0.05, type: "sine", at });
    this._tone({ freq: 1320, to: 620, duration: 0.3, gain: 0.025, type: "triangle", at });
  }

  saberSwing(at = null) {
    if (!this._ready()) return;
    this._tone({ freq: 150, to: 95, duration: 0.3, gain: 0.12, type: "sawtooth", at });
    this._noise({ duration: 0.26, gain: 0.14, type: "bandpass", freq: 600, q: 1.1, sweepTo: 2400, at });
  }

  saberHit(at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.3, gain: 0.35, type: "highpass", freq: 2500, sweepTo: 700, at });
    this._noise({ duration: 0.18, gain: 0.3, type: "lowpass", freq: 900, sweepTo: 150, at });
    this._tone({ freq: 210, to: 70, duration: 0.25, gain: 0.14, type: "sawtooth", at });
  }

  saberClash(at = null) {
    if (!this._ready()) return;
    this._noise({ duration: 0.05, gain: 0.45, type: "bandpass", freq: 3200, q: 2, at });
    this._noise({ duration: 0.28, gain: 0.2, type: "highpass", freq: 4200, sweepTo: 1500, delay: 0.02, at });
    this._tone({ freq: 1500, to: 900, duration: 0.12, gain: 0.07, type: "square", at });
    this._tone({ freq: 220, to: 120, duration: 0.18, gain: 0.1, type: "sawtooth", at });
  }

  saberBreak() {
    if (!this._ready()) return;
    this._noise({ duration: 0.4, gain: 0.3, type: "bandpass", freq: 1600, q: 0.8, sweepTo: 300 });
    this._tone({ freq: 180, to: 40, duration: 0.45, gain: 0.14, type: "sawtooth" });
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

  /* Pump action over `dur` seconds (the forend's own timeline in game.js
     placePump): a gritty "shk" as it slams back, a bright "chk" home. */
  pump(dur = 0.58) {
    if (!this._ready()) return;
    this._noise({ duration: 0.06, gain: 0.2, type: "bandpass", freq: 650, q: 2.5, sweepTo: 420, delay: dur * 0.36 });
    this._noise({ duration: 0.05, gain: 0.2, type: "bandpass", freq: 1400, q: 3, delay: dur * 0.78 });
  }

  /* One shell thumbed into the tube: a short click-clack. */
  shellIn() {
    if (!this._ready()) return;
    this._noise({ duration: 0.035, gain: 0.13, type: "bandpass", freq: 1900, q: 4 });
    this._noise({ duration: 0.04, gain: 0.1, type: "bandpass", freq: 1100, q: 3, delay: 0.05 });
  }

  reload() {
    if (!this._ready()) return;
    this._noise({ duration: 0.05, gain: 0.16, type: "bandpass", freq: 900, q: 3 });
    this._noise({ duration: 0.05, gain: 0.14, type: "bandpass", freq: 1500, q: 3, delay: 0.16 });
    this._noise({ duration: 0.07, gain: 0.18, type: "bandpass", freq: 700, q: 3, delay: 0.4 });
  }

  /* Quick weapon-ready click on the settle beat at the end of a reload
     (DESIGN-ARMS.md Phase 3's reload-complete event) — distinct from the
     mag-out/mag-in/chamber beats reload() already plays at the start. */
  reloadComplete() {
    if (!this._ready()) return;
    this._noise({ duration: 0.03, gain: 0.1, type: "bandpass", freq: 1800, q: 4 });
  }

  /* Raising/lowering the sight. A quiet handling click, not a full reload
     foley beat — it should register on a quiet listen, not compete with
     gunfire. Rising pitch going up, falling pitch coming down. */
  ads(raising) {
    if (!this._ready()) return;
    this._noise({
      duration: 0.045, gain: 0.09, type: "bandpass",
      freq: raising ? 1000 : 1300,
      sweepTo: raising ? 1300 : 800,
      q: 2.4,
    });
  }

  step(at = null, gain = 0.07) {
    if (!this._ready()) return;
    this._noise({ duration: 0.06, gain, type: "lowpass", freq: 520, sweepTo: 180, at });
  }

  /* Hitting the ground after a fall — a jump, a drop off a ledge, the tail
     of a dive. `speed` is how fast (m/s) it was falling, so a short hop and
     a roof-to-ground drop don't sound the same. */
  land(speed = 6) {
    if (!this._ready()) return;
    const hard = Math.min(1, speed / 14);
    this._noise({
      duration: 0.09 + hard * 0.07, gain: 0.14 + hard * 0.16,
      type: "lowpass", freq: 420, sweepTo: 140,
    });
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

  /* Medal sting, after the kill blip (0.14 s later so the two don't mash).
     Silver: a bright two-note ping. Gold: a rising triad. Red: the triad
     over a low brass stab. One per burst: KillstreakUi picks the metal. */
  medal(metal = "silver") {
    if (!this._ready()) return;
    const d = 0.14;
    if (metal === "silver") {
      this._tone({ freq: 1320, duration: 0.09, gain: 0.08, type: "triangle", delay: d });
      this._tone({ freq: 1760, duration: 0.2, gain: 0.08, type: "triangle", delay: d + 0.07 });
      return;
    }
    [784, 988, 1175].forEach((f, i) => {
      this._tone({ freq: f, duration: i === 2 ? 0.32 : 0.1, gain: 0.08, type: "triangle", delay: d + i * 0.07 });
    });
    if (metal === "red") {
      this._tone({ freq: 196, duration: 0.45, gain: 0.07, type: "sawtooth", delay: d });
      this._tone({ freq: 294, duration: 0.45, gain: 0.05, type: "sawtooth", delay: d });
    }
  }

  /* A leaper's wind-up, the tell before it jumps: a rasping scream that
     climbs, then cracks and falls away, over a hiss. Positional, so it says
     which way it's coming from. */
  zombieShriek(at = null) {
    if (!this._ready() || (at && this._far(at, 60))) return;
    const t0 = this.now;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(520, t0);
    osc.frequency.exponentialRampToValueAtTime(1350, t0 + 0.18);
    osc.frequency.exponentialRampToValueAtTime(380, t0 + 0.7);
    // a fast wobble makes it a throat, not a whistle
    const vib = this.ctx.createOscillator();
    vib.frequency.value = 38;
    const depth = this.ctx.createGain();
    depth.gain.value = 60;
    vib.connect(depth).connect(osc.frequency);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0008, t0);
    g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.75);
    osc.connect(bp).connect(g).connect(this._dest(at));
    osc.start(t0);
    vib.start(t0);
    osc.stop(t0 + 0.8);
    vib.stop(t0 + 0.8);
    this._noise({ duration: 0.6, gain: 0.18, type: "highpass", freq: 2500, sweepTo: 900, at });
  }

  /* Zombie voices (ZR4). A creaky, wet voiced sound: a sawtooth throat with
     a jittering pitch, shaped by two vowel formants that slide ("ohh" to
     "ahh"), a gurgling tremolo and a rasp of breath noise. `voice` is the
     zombie's own: { pitch: ~0.8..1.4, rasp: 0..1 }, so the horde doesn't
     share one throat. Positional; past 45 m it isn't worth the nodes. */
  _zombieVoice(at, voice, { dur, f0, glide, gain, f1 = [420, 700], f2 = [950, 1150], trem = 11 }) {
    if (!this._ready() || (at && this._far(at, 45))) return;
    const ctx = this.ctx, t0 = this.now;
    const p = voice?.pitch || 1, rasp = voice?.rasp ?? 0.5;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f0 * p, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, f0 * p * glide), t0 + dur);
    // vocal-fry jitter: a fast, shallow pitch wobble
    const jit = ctx.createOscillator();
    jit.type = "triangle";
    jit.frequency.value = 7 + Math.random() * 5;
    const jd = ctx.createGain();
    jd.gain.value = f0 * p * 0.06;
    jit.connect(jd).connect(osc.frequency);
    // two formants in parallel, sliding from F[0] to F[1]
    const out = ctx.createGain();
    out.gain.value = 0;
    for (const [F, q, w] of [[f1, 5, 1], [f2, 7, 0.55]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = q;
      bp.frequency.setValueAtTime(F[0], t0);
      bp.frequency.linearRampToValueAtTime(F[1], t0 + dur * 0.7);
      const fg = ctx.createGain();
      fg.gain.value = w;
      osc.connect(bp).connect(fg).connect(out);
    }
    out.gain.setValueAtTime(0.0008, t0);
    out.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.18, dur * 0.25));
    out.gain.setValueAtTime(gain, t0 + dur * 0.6);
    out.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    // the gurgle: an amplitude wobble after the envelope (0.65 +/- 0.35)
    const wob = ctx.createGain();
    wob.gain.value = 0.65;
    const am = ctx.createOscillator();
    am.frequency.value = trem * (0.85 + Math.random() * 0.3);
    const amd = ctx.createGain();
    amd.gain.value = 0.35;
    am.connect(amd).connect(wob.gain);
    out.connect(wob).connect(this._dest(at));
    for (const o of [osc, jit, am]) { o.start(t0); o.stop(t0 + dur + 0.05); }
    // breath through a ruined throat
    if (rasp > 0.05) this._noise({ duration: dur * 0.9, gain: 0.05 + rasp * 0.09, type: "bandpass", freq: 1400 + rasp * 900, q: 1.4, sweepTo: 700, at });
  }

  /* The idle moan while it shambles or hunts. */
  zombieGroan(at = null, voice = null) {
    this._zombieVoice(at, voice, { dur: 0.9 + Math.random() * 0.8, f0: 92, glide: 0.72, gain: 0.26 });
  }

  /* A short, louder snarl as it swipes. */
  zombieSnarl(at = null, voice = null) {
    this._zombieVoice(at, voice, { dur: 0.38, f0: 150, glide: 0.6, gain: 0.34, f1: [650, 820], f2: [1200, 1350], trem: 17 });
  }

  /* The last noise: a falling, bubbling gurgle. */
  zombieDeath(at = null, voice = null) {
    this._zombieVoice(at, voice, { dur: 0.75, f0: 120, glide: 0.38, gain: 0.3, f1: [600, 350], f2: [1100, 800], trem: 21 });
    this._noise({ duration: 0.45, gain: 0.08, type: "lowpass", freq: 600, sweepTo: 150, delay: 0.2, at });
  }

  /* A headshot kill: the wet crack and spatter of a head going. */
  zombieHeadPop(at = null) {
    if (!this._ready() || (at && this._far(at, 60))) return;
    this._noise({ duration: 0.09, gain: 0.55, type: "bandpass", freq: 900, q: 0.9, at });
    this._tone({ freq: 140, to: 55, duration: 0.18, gain: 0.32, type: "sine", at });
    this._noise({ duration: 0.4, gain: 0.16, type: "lowpass", freq: 2600, sweepTo: 400, delay: 0.04, at });
  }

  wave() {
    if (!this._ready()) return;
    this._tone({ freq: 420, duration: 0.16, gain: 0.14, type: "triangle" });
    this._tone({ freq: 630, duration: 0.22, gain: 0.13, type: "triangle", delay: 0.14 });
  }

  /* One second off the pre-match clock. Deliberately dry and quiet — it fires
     up to six times in a row, so anything with a tail would smear. */
  /* Match intro (match-intro.js). A low swell under the whole cinematic,
     a hit on each team's reveal, a whoosh on the whip pan and a slam on VS. */
  introRiser(dur = 8) {
    if (!this._ready()) return;
    const t0 = this.now;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0008, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur + 0.3);
    g.connect(this.master);
    for (const [f, type] of [[55, "sawtooth"], [82.4, "triangle"], [110, "sine"]]) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t0);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, t0 + dur);
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(240, t0);
      lp.frequency.exponentialRampToValueAtTime(1600, t0 + dur);
      osc.connect(lp).connect(g);
      osc.start(t0);
      osc.stop(t0 + dur + 0.35);
    }
  }

  introHit() {
    if (!this._ready()) return;
    this._tone({ freq: 70, to: 38, duration: 0.9, gain: 0.32, type: "sine" });
    this._noise({ duration: 0.5, gain: 0.12, type: "lowpass", freq: 900, sweepTo: 120 });
    this._tone({ freq: 220, to: 210, duration: 1.1, gain: 0.05, type: "sawtooth" });
  }

  introWhoosh() {
    if (!this._ready()) return;
    this._noise({ duration: 0.45, gain: 0.22, type: "bandpass", freq: 500, q: 0.8, sweepTo: 4200 });
  }

  introSlam() {
    if (!this._ready()) return;
    this._tone({ freq: 95, to: 32, duration: 1.0, gain: 0.4, type: "sine" });
    this._noise({ duration: 0.7, gain: 0.25, type: "lowpass", freq: 3000, sweepTo: 90 });
    this._tone({ freq: 392, duration: 0.5, gain: 0.05, type: "square" });
    this._tone({ freq: 587, duration: 0.5, gain: 0.04, type: "square" });
  }

  introTick(enemy = false) {
    if (!this._ready()) return;
    this._tone({ freq: enemy ? 330 : 990, to: enemy ? 300 : 1180, duration: 0.06, gain: 0.05, type: "square" });
  }

  stageTick(last = false) {
    if (!this._ready()) return;
    this._tone({
      freq: last ? 880 : 560, duration: last ? 0.2 : 0.07,
      gain: last ? 0.15 : 0.1, type: "square",
    });
  }
}
