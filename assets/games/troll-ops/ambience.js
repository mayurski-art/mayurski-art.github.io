// Troll Forces — per-map ambience.
//
// Same rule as audio.js: everything is synthesized, nothing is loaded. Each
// map gets a preset of continuous BEDS (wind, surf, tunnel hum, crickets,
// mall murmur) and occasional EVENTS (birds, gulls, a distant firefight, a
// train through the tunnel, a car down the street) scheduled at random
// intervals and scattered across the stereo field.
//
// It all runs through one bus into GameAudio's master, so the master slider
// still governs it, and the bus level is the separate Ambience slider.
// Not positional: it's the world around the map, not a thing in it.

const PRESETS = {
  // Half-built tower block: wind through the girders, traffic past the
  // hoardings, steel ringing somewhere up top.
  grinsite: {
    beds: [
      { kind: "wind", freq: 420, gain: 0.05, gust: 0.7 },
      { kind: "noise", type: "lowpass", freq: 170, gain: 0.035 },   // city rumble
    ],
    events: [
      ["clank", 6, 16], ["car", 10, 24], ["chirp", 9, 20], ["gunfire", 22, 45],
    ],
  },
  // Underground station: mains hum, moving tunnel air, drips, and every so
  // often a train going through the other bore.
  undergrin: {
    beds: [
      { kind: "hum", freqs: [60, 120, 180, 240], gain: 0.018, lp: 420 },
      { kind: "wind", freq: 230, gain: 0.035, gust: 0.4, rate: 0.04 },
    ],
    events: [["drip", 2, 7], ["train", 35, 70], ["buzz", 12, 28], ["creak", 18, 36]],
  },
  // Dry, gusty, and somebody else's war two streets over.
  dustbowl: {
    beds: [{ kind: "wind", type: "bandpass", freq: 700, q: 0.6, gain: 0.06, gust: 0.9 }],
    events: [["gunfire", 8, 20], ["dog", 18, 40], ["clank", 30, 60]],
  },
  // Warehouse: HVAC, fluorescent tubes, racking that ticks as it settles.
  depot: {
    beds: [
      { kind: "hum", freqs: [50, 100, 150, 200], gain: 0.018, lp: 380 },
      { kind: "noise", type: "lowpass", freq: 520, gain: 0.03 },    // air handling
    ],
    events: [["creak", 8, 20], ["clank", 10, 24], ["buzz", 10, 24], ["gunfire", 28, 55, 0.5]],
  },
  // Indoor range between strings: just the building.
  range: {
    beds: [
      { kind: "hum", freqs: [60, 120, 180], gain: 0.014, lp: 360 },
      { kind: "noise", type: "lowpass", freq: 480, gain: 0.024 },
    ],
    events: [["buzz", 14, 30], ["clank", 22, 44]],
  },
  // Quiet street. Birds, a dog that won't stop, the odd car.
  culdegrin: {
    beds: [{ kind: "wind", freq: 620, gain: 0.03, gust: 0.5 }],
    events: [["chirp", 2.5, 7], ["chirp", 4, 11], ["dog", 15, 35], ["car", 14, 30], ["gunfire", 30, 60, 0.6]],
  },
  // Surf, sea breeze, gulls.
  grinbeach: {
    beds: [
      { kind: "surf", gain: 0.085 },
      { kind: "wind", freq: 900, gain: 0.02, gust: 0.4 },
    ],
    events: [["gull", 5, 14], ["gull", 9, 22]],
  },
  // Government building after hours, with something in the labs.
  pentagrin: {
    beds: [
      { kind: "hum", freqs: [60, 120, 180, 300], gain: 0.022, lp: 460 },
      { kind: "noise", type: "lowpass", freq: 500, gain: 0.03 },
    ],
    events: [["buzz", 6, 14], ["creak", 8, 18], ["drip", 10, 20]],
  },
  // Full moon over the graves.
  hollowgrin: {
    beds: [
      { kind: "crickets", gain: 0.022 },
      { kind: "wind", freq: 360, gain: 0.03, gust: 0.8, rate: 0.05 },
    ],
    events: [["owl", 10, 22], ["howl", 30, 60], ["creak", 12, 26]],
  },
  // The mall: shoppers, the fountain, the PA chime.
  grinleria: {
    beds: [
      { kind: "murmur", gain: 0.03 },
      { kind: "noise", type: "highpass", freq: 2200, gain: 0.012 },  // fountain
      { kind: "noise", type: "lowpass", freq: 480, gain: 0.02 },
    ],
    events: [["chime", 30, 60]],
  },
  // Troll City: prairie wind down Main Street, the saloon piano through
  // the walls, horses at the rails, a train whistle out on the plain.
  trollcity: {
    beds: [
      { kind: "wind", type: "bandpass", freq: 620, q: 0.5, gain: 0.05, gust: 0.8 },
      { kind: "murmur", gain: 0.008 },
    ],
    events: [["piano", 7, 15], ["horse", 14, 32], ["creak", 9, 20], ["chirp", 8, 18], ["whistle", 45, 90], ["dog", 30, 60], ["gunfire", 35, 70, 0.6]],
  },
  // Trollface Island, floating in space: wind off the cliffs, a low drone
  // underneath, a shimmer from the sky.
  trollface: {
    beds: [
      { kind: "wind", freq: 500, gain: 0.045, gust: 0.8 },
      { kind: "drone", gain: 0.02 },
    ],
    events: [["chirp", 8, 18], ["shimmer", 14, 30]],
  },
};

// Anything without a preset (a *_wip map) still gets a light breeze.
const FALLBACK = { beds: [{ kind: "wind", freq: 520, gain: 0.03, gust: 0.5 }], events: [] };

const rand = (a, b) => a + Math.random() * (b - a);

export class MapAmbience {
  constructor(audio) {
    this.audio = audio;
    this.id = null;
    this.level = 0.6;
    this.bus = null;
    this._sources = [];
    this._timers = [];
  }

  /* 0..1, the Ambience slider. */
  setLevel(v) {
    this.level = Math.max(0, Math.min(1, v));
    if (this.bus) this.bus.gain.setTargetAtTime(this.level, this.audio.now, 0.15);
  }

  /* Map id to play, or null for silence. Cheap to call every frame: it only
     does work when the id changes. If audio isn't running yet (no gesture,
     master at 0) it does nothing and is retried on the next call. */
  set(id) {
    if (id === this.id) return;
    if (!id) { this._stop(); this.id = null; return; }
    const a = this.audio;
    if (!a._ready()) return;
    this._stop();
    this.id = id;
    const preset = PRESETS[id] ?? FALLBACK;
    const ctx = a.ctx;
    this.bus = ctx.createGain();
    // Fade in rather than switch on; the match starting is loud enough.
    this.bus.gain.setValueAtTime(0.0001, a.now);
    this.bus.gain.linearRampToValueAtTime(this.level, a.now + 2.5);
    this.bus.connect(a.master);
    for (const b of preset.beds) this._bed(b);
    for (const [kind, min, max, gain = 1] of preset.events) this._loop(kind, min, max, gain);
  }

  _stop() {
    for (const t of this._timers) clearTimeout(t);
    this._timers = [];
    const bus = this.bus, srcs = this._sources;
    this.bus = null;
    this._sources = [];
    if (!bus) return;
    const t = this.audio.now;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0.0001, t + 0.6);
    for (const s of srcs) { try { s.stop(t + 0.7); } catch { /* already stopped */ } }
    setTimeout(() => bus.disconnect(), 800);
  }

  /* Random-interval scheduler for one event kind. The first one lands a
     fraction of the way into the interval so a map doesn't open silent. */
  _loop(kind, min, max, gain) {
    const bus = this.bus;
    const next = (first) => {
      const id = setTimeout(() => {
        if (this.bus !== bus) return;
        if (this.audio._ready()) this._event(kind, gain);
        next(false);
      }, (first ? rand(0.15, 0.6) * min : rand(min, max)) * 1000);
      this._timers.push(id);
      if (this._timers.length > 64) this._timers.splice(0, 32);
    };
    next(true);
  }

  // ---------------------------------------------------------------- beds

  _lfo(param, rate, depth, type = "sine") {
    const ctx = this.audio.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = rate;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(param);
    o.start();
    this._sources.push(o);
    return o;
  }

  /* Two looping noise sources panned apart: decorrelated left and right
     makes a bed sound wide instead of coming out of the middle of your head. */
  _stereoNoise(into) {
    const ctx = this.audio.ctx;
    for (const pan of [-0.7, 0.7]) {
      const src = ctx.createBufferSource();
      src.buffer = this.audio.noise;
      src.loop = true;
      src.playbackRate.value = rand(0.85, 1.15);
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      src.connect(p).connect(into);
      src.start(this.audio.now, rand(0, 1.9));
      this._sources.push(src);
    }
  }

  _bed(b) {
    const ctx = this.audio.ctx;
    const out = ctx.createGain();
    out.gain.value = b.gain;
    out.connect(this.bus);

    if (b.kind === "noise" || b.kind === "wind") {
      const f = ctx.createBiquadFilter();
      f.type = b.type ?? "lowpass";
      f.frequency.value = b.freq;
      f.Q.value = b.q ?? 0.7;
      this._stereoNoise(f);
      f.connect(out);
      if (b.kind === "wind") {
        // Gusts: two slow LFOs at unrelated rates on both the cutoff and the
        // level, so it never settles into an audible cycle.
        const r = b.rate ?? 0.07, gust = b.gust ?? 0.6;
        this._lfo(f.frequency, r, b.freq * 0.55 * gust);
        this._lfo(f.frequency, r * 2.37, b.freq * 0.25 * gust);
        this._lfo(out.gain, r * 1.31, b.gain * 0.6 * gust);
        this._lfo(out.gain, r * 0.53, b.gain * 0.3 * gust);
      }
    } else if (b.kind === "surf") {
      // Waves: lowpassed noise whose level and brightness swell together on
      // a slow cycle, with a second, slower one so sets come and go.
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 650;
      this._stereoNoise(f);
      f.connect(out);
      this._lfo(f.frequency, 0.11, 420);
      this._lfo(out.gain, 0.11, b.gain * 0.7);
      this._lfo(out.gain, 0.043, b.gain * 0.25);
    } else if (b.kind === "hum") {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = b.lp ?? 400;
      f.connect(out);
      b.freqs.forEach((hz, i) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? "sine" : "triangle";
        o.frequency.value = hz;
        const g = ctx.createGain();
        g.gain.value = 1 / (i + 1);
        o.connect(g).connect(f);
        o.start();
        this._sources.push(o);
      });
    } else if (b.kind === "crickets") {
      // Two crickets either side. Each is a high sine gated by a fast pulse
      // (the trill), gated again by a slow one (the pauses between trills).
      for (const [pan, hz, rate] of [[-0.6, 4300, 0.9], [0.55, 4700, 0.71]]) {
        const o = ctx.createOscillator();
        o.frequency.value = hz;
        // A square LFO swings -depth..+depth, so each gate sits at 0.5 with
        // depth 0.5 to open and close (0..1) rather than flip polarity.
        const trill = ctx.createGain();
        trill.gain.value = 0.5;
        const phrase = ctx.createGain();
        phrase.gain.value = 0.5;
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        o.connect(trill).connect(phrase).connect(p).connect(out);
        o.start();
        this._sources.push(o);
        this._lfo(trill.gain, rand(26, 32), 0.5, "square");
        this._lfo(phrase.gain, rate, 0.5, "square");
      }
    } else if (b.kind === "murmur") {
      // Crowd walla: band-limited noise around speech formants, the level
      // wandering on several quick, unrelated LFOs like overlapping voices.
      for (const hz of [480, 1100]) {
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = hz;
        f.Q.value = 1.4;
        const g = ctx.createGain();
        g.gain.value = 0.6;
        this._stereoNoise(f);
        f.connect(g).connect(out);
        this._lfo(g.gain, rand(2.5, 4), 0.3);
        this._lfo(g.gain, rand(5, 7), 0.2);
        this._lfo(f.frequency, rand(0.8, 1.6), hz * 0.25);
      }
    } else if (b.kind === "drone") {
      // Fifth plus a slightly detuned root: a slow beat you feel more than hear.
      for (const hz of [55, 55.4, 82.5]) {
        const o = ctx.createOscillator();
        o.frequency.value = hz;
        o.connect(out);
        o.start();
        this._sources.push(o);
      }
    }
  }

  // -------------------------------------------------------------- events

  /* Output for one event: a panner somewhere left-right, into the bus. */
  _out(gain, pan = rand(-0.9, 0.9)) {
    const ctx = this.audio.ctx;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(this.bus);
    return g;
  }

  /* Enveloped oscillator into `dest`. `path` is [[freq, time], ...]. */
  _osc(dest, { type = "sine", path, t0, dur, peak = 1, attack = 0.01, vib = 0, vibRate = 6 }) {
    const ctx = this.audio.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(path[0][0], t0);
    for (const [hz, t] of path.slice(1)) o.frequency.exponentialRampToValueAtTime(hz, t0 + t);
    if (vib) {
      const v = ctx.createOscillator();
      v.frequency.value = vibRate;
      const d = ctx.createGain();
      d.gain.value = vib;
      v.connect(d).connect(o.frequency);
      v.start(t0);
      v.stop(t0 + dur + 0.05);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /* Enveloped noise into `dest`. */
  _burst(dest, { t0, dur, type = "lowpass", freq = 800, q = 0.8, sweepTo = null, peak = 1, attack = 0.005 }) {
    const ctx = this.audio.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.audio.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t0, rand(0, 1.5));
    src.stop(t0 + dur + 0.05);
  }

  _event(kind, gain) {
    const t = this.audio.now + 0.02;
    switch (kind) {
      case "chirp": {
        // A songbird phrase: a few quick up-or-down whistles.
        const out = this._out(0.05 * gain);
        const n = 2 + Math.floor(Math.random() * 4);
        const base = rand(2600, 4200);
        for (let i = 0; i < n; i++) {
          const up = Math.random() < 0.5;
          const d = rand(0.04, 0.09);
          const t0 = t + i * rand(0.08, 0.14);
          this._osc(out, { path: [[base * (up ? 0.8 : 1.25), 0], [base * (up ? 1.25 : 0.8), d]], t0, dur: d, attack: 0.008 });
        }
        break;
      }
      case "gull": {
        // "Kyow kyow": a nasal sawtooth that leaps up and falls, two or three times.
        const out = this._out(0.13 * gain);
        const f = this.audio.ctx.createBiquadFilter();
        f.type = "bandpass"; f.frequency.value = 1600; f.Q.value = 2;
        f.connect(out);
        const n = 2 + Math.floor(Math.random() * 2);
        const base = rand(850, 1050);
        for (let i = 0; i < n; i++) {
          this._osc(f, { type: "sawtooth", path: [[base, 0], [base * 1.6, 0.08], [base * 0.75, 0.32]], t0: t + i * 0.36, dur: 0.34, attack: 0.03 });
        }
        break;
      }
      case "owl": {
        const out = this._out(0.06 * gain);
        const hz = rand(340, 400);
        this._osc(out, { type: "triangle", path: [[hz, 0], [hz * 0.97, 0.25]], t0: t, dur: 0.28, attack: 0.06 });
        this._osc(out, { type: "triangle", path: [[hz * 0.94, 0], [hz * 0.86, 0.6]], t0: t + 0.4, dur: 0.65, attack: 0.08, vib: 4, vibRate: 5 });
        break;
      }
      case "howl": {
        // Wolf, a long way off: rises, holds with a wobble, sags away.
        const out = this._out(0.04 * gain);
        const f = this.audio.ctx.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = 1400;
        f.connect(out);
        const hz = rand(380, 440);
        this._osc(f, { type: "triangle", path: [[hz, 0], [hz * 1.7, 0.7], [hz * 1.6, 1.8], [hz * 1.05, 2.9]], t0: t, dur: 3, attack: 0.5, vib: 7, vibRate: 5.5 });
        break;
      }
      case "drip": {
        // A plink, and a quieter one back off the tunnel wall.
        const pan = rand(-0.9, 0.9);
        const hz = rand(900, 1700);
        for (const [delay, lvl] of [[0, 0.05], [0.13, 0.015]]) {
          const out = this._out(lvl * gain, pan);
          this._osc(out, { path: [[hz, 0], [hz * 0.4, 0.07]], t0: t + delay, dur: 0.09, attack: 0.002 });
        }
        break;
      }
      case "clank": {
        // Steel struck somewhere off-site: inharmonic partials, lowpassed by distance.
        const out = this._out(0.03 * gain);
        const f = this.audio.ctx.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = rand(1800, 3000);
        f.connect(out);
        const base = rand(220, 420);
        const dur = rand(0.8, 1.6);
        [1, 2.76, 5.4, 8.93].forEach((m, i) => {
          this._osc(f, { type: "sine", path: [[base * m, 0], [base * m * 0.995, dur]], t0: t, dur: dur / (1 + i * 0.4), peak: 1 / (i + 1), attack: 0.002 });
        });
        if (Math.random() < 0.4) this._event("clank-echo", gain);
        break;
      }
      case "clank-echo": {
        const out = this._out(0.012 * gain);
        const base = rand(220, 420);
        [1, 2.76, 5.4].forEach((m, i) => this._osc(out, { path: [[base * m, 0], [base * m, 0.6]], t0: t + 0.35, dur: 0.6, peak: 1 / (i + 1), attack: 0.002 }));
        break;
      }
      case "gunfire": {
        // A distant exchange: a short burst of dull pops, sometimes answered.
        const out = this._out(0.16 * gain);
        const shots = 1 + Math.floor(Math.random() * 5);
        const gap = rand(0.08, 0.16);
        const tone = rand(280, 520);
        for (let i = 0; i < shots; i++) {
          this._burst(out, { t0: t + i * gap * rand(0.85, 1.2), dur: rand(0.25, 0.45), freq: tone, sweepTo: tone * 0.4, attack: 0.002 });
        }
        if (Math.random() < 0.45) {
          const reply = this._out(0.11 * gain);
          const t1 = t + shots * gap + rand(0.4, 1.2);
          const n = 2 + Math.floor(Math.random() * 4);
          for (let i = 0; i < n; i++) this._burst(reply, { t0: t1 + i * rand(0.09, 0.14), dur: 0.3, freq: tone * 0.8, sweepTo: tone * 0.3, attack: 0.002 });
        }
        break;
      }
      case "horse": {
        // A whinny: a shaky nasal call that climbs, flutters and falls, and a
        // snort after it.
        const out = this._out(0.05 * gain);
        const f = this.audio.ctx.createBiquadFilter();
        f.type = "bandpass"; f.frequency.value = 1300; f.Q.value = 1.4;
        f.connect(out);
        const hz = rand(520, 640);
        this._osc(f, { type: "sawtooth", path: [[hz * 0.8, 0], [hz * 1.9, 0.25], [hz * 1.6, 0.7], [hz * 0.7, 1.25]], t0: t, dur: 1.3, attack: 0.04, vib: 70, vibRate: 22 });
        this._burst(out, { t0: t + 1.45, dur: 0.35, type: "bandpass", freq: 700, q: 0.7, sweepTo: 300, peak: 0.8, attack: 0.02 });
        break;
      }
      case "piano": {
        // Honky-tonk through the saloon wall: a few bars of an oom-pah left
        // hand and a right-hand tune, every note slightly detuned twice.
        const out = this._out(0.035 * gain, rand(-0.5, 0.5));
        const f = this.audio.ctx.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = 1800;
        f.connect(out);
        const C = 261.63;
        const st = (n) => C * Math.pow(2, n / 12);
        const keys = [0, 5, 7, 0][Math.floor(Math.random() * 4)];
        const bass = [[-12, 4], [-5, 7], [-12, 4], [-5, 7], [-7, 5], [0, 9], [-12, 4], [-5, 7]];
        const tunes = [[4, 7, 9, 7, 4, 2, 0, 2], [7, 9, 12, 9, 7, 4, 7, 4], [0, 4, 7, 12, 11, 9, 7, 4]];
        const tune = tunes[Math.floor(Math.random() * tunes.length)];
        const beat = rand(0.2, 0.26);
        const note = (n, t0, dur, peak) => {
          for (const det of [0.996, 1.006]) this._osc(f, { type: "triangle", path: [[st(n + keys) * det, 0], [st(n + keys) * det * 0.999, dur]], t0, dur, peak, attack: 0.004 });
        };
        bass.forEach(([lo, chord], i) => {
          note(lo - 12, t + i * beat * 2, beat * 1.6, 0.5);
          note(chord, t + i * beat * 2 + beat, beat * 0.9, 0.3);
          note(chord + 4, t + i * beat * 2 + beat, beat * 0.9, 0.25);
        });
        tune.forEach((n, i) => note(n + 12, t + i * beat * 2 + (i % 2 ? beat * 0.5 : 0), beat * 1.4, 0.55));
        break;
      }
      case "whistle": {
        // A steam whistle way out on the line: two chords, the second long.
        const out = this._out(0.03 * gain);
        const f = this.audio.ctx.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = 1500;
        f.connect(out);
        for (const [t0, dur] of [[0, 0.5], [0.7, 1.8]]) {
          for (const hz of [392, 466, 587]) this._osc(f, { type: "sawtooth", path: [[hz * 0.97, 0], [hz, 0.12], [hz * 0.99, dur]], t0: t + t0, dur, peak: 0.33, attack: 0.08 });
        }
        break;
      }
      case "dog": {
        const out = this._out(0.065 * gain);
        const f = this.audio.ctx.createBiquadFilter();
        f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 1.1;
        f.connect(out);
        const n = 1 + Math.floor(Math.random() * 3);
        const hz = rand(420, 560);
        for (let i = 0; i < n; i++) {
          const t0 = t + i * rand(0.28, 0.42);
          this._osc(f, { type: "sawtooth", path: [[hz, 0], [hz * 1.15, 0.03], [hz * 0.6, 0.13]], t0, dur: 0.14, attack: 0.008 });
          this._burst(f, { t0, dur: 0.1, freq: 1200, type: "bandpass", peak: 0.5 });
        }
        break;
      }
      case "car": {
        // Passes left to right (or back): tyre noise swells and fades as the pan sweeps.
        const ctx = this.audio.ctx;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const dur = rand(4, 6.5);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.11 * gain, t + dur * 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const p = ctx.createStereoPanner();
        p.pan.setValueAtTime(-0.9 * dir, t);
        p.pan.linearRampToValueAtTime(0.9 * dir, t + dur);
        g.connect(p).connect(this.bus);
        this._burst(g, { t0: t, dur, freq: 380, sweepTo: 260, attack: dur * 0.5 });
        // the engine note dips as it goes past
        this._osc(g, { type: "sawtooth", path: [[95, 0], [88, dur * 0.5], [70, dur]], t0: t, dur, peak: 0.12, attack: dur * 0.5 });
        break;
      }
      case "train": {
        // The other bore: a rumble that builds, clatters past, and drains away,
        // with a brake squeal near the end.
        const ctx = this.audio.ctx;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18 * gain, t + 4);
        g.gain.setValueAtTime(0.18 * gain, t + 7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 12);
        const p = ctx.createStereoPanner();
        const dir = Math.random() < 0.5 ? 1 : -1;
        p.pan.setValueAtTime(-0.7 * dir, t);
        p.pan.linearRampToValueAtTime(0.7 * dir, t + 12);
        g.connect(p).connect(this.bus);
        this._burst(g, { t0: t, dur: 12, freq: 140, q: 0.5, attack: 4 });
        // wheel clacks over the joints
        for (let i = 0; i < 18; i++) {
          const t0 = t + 3 + i * 0.32 + (i % 2) * 0.08;
          this._burst(g, { t0, dur: 0.06, type: "bandpass", freq: 600, q: 2, peak: 0.25, attack: 0.002 });
        }
        if (Math.random() < 0.6) this._osc(g, { path: [[2900, 0], [2600, 2]], t0: t + 8, dur: 2.2, peak: 0.05, attack: 0.3 });
        break;
      }
      case "creak": {
        const out = this._out(0.12 * gain);
        const f = this.audio.ctx.createBiquadFilter();
        f.type = "bandpass"; f.frequency.value = rand(500, 900); f.Q.value = 4;
        f.connect(out);
        const hz = rand(80, 140);
        const dur = rand(0.6, 1.3);
        this._osc(f, { type: "sawtooth", path: [[hz, 0], [hz * rand(0.7, 1.4), dur]], t0: t, dur, attack: dur * 0.3, vib: hz * 0.15, vibRate: rand(9, 16) });
        break;
      }
      case "buzz": {
        // A fluorescent tube stuttering.
        const out = this._out(0.07 * gain);
        const f = this.audio.ctx.createBiquadFilter();
        f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = 1.5;
        f.connect(out);
        let t0 = t;
        const n = 3 + Math.floor(Math.random() * 5);
        for (let i = 0; i < n; i++) {
          const d = rand(0.03, 0.12);
          this._osc(f, { type: "square", path: [[120, 0], [120, d]], t0, dur: d, attack: 0.003 });
          t0 += d + rand(0.02, 0.15);
        }
        break;
      }
      case "chime": {
        // The mall PA: ding-dong, nobody's name follows.
        const out = this._out(0.055 * gain, 0);
        this._osc(out, { type: "triangle", path: [[880, 0], [880, 1.2]], t0: t, dur: 1.2, attack: 0.005 });
        this._osc(out, { type: "triangle", path: [[698.5, 0], [698.5, 1.6]], t0: t + 0.55, dur: 1.6, attack: 0.005 });
        break;
      }
      case "shimmer": {
        const out = this._out(0.03 * gain);
        const base = rand(1200, 1800);
        [1, 1.5, 2.01].forEach((m, i) => this._osc(out, { path: [[base * m, 0], [base * m * 1.01, 3]], t0: t + i * 0.25, dur: 3, attack: 1.2 }));
        break;
      }
    }
  }
}
