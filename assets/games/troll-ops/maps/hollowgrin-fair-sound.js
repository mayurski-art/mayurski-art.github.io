// Troll Forces — Hollowgrin: the fair's ride sounds, made in WebAudio through
// the game's own mixer (hollowgrin.js attachAudio), each heard louder the
// closer the camera is (hollowgrin.js works out the gain and calls these):
// the carousel's band organ, the Ferris wheel's creak and the coaster's
// rattle.

const midiHz = (n) => 440 * 2 ** ((n - 69) / 12);

/* The band organ: a waltz in A minor, the tune on a fluted calliope voice
   with vibrato, an oom-pah-pah under it. One bar per entry: the tune as
   [note, beats], then the bar's bass note and chord. */
const BEAT = 0.375;                                    // 160 to the minute
const AM = [45, [57, 60, 64]], E = [40, [56, 59, 64]], G = [43, [55, 59, 62]], F = [41, [57, 60, 65]], DM = [38, [57, 62, 65]];
const WALTZ = [
  [[[69, 2], [72, 1]], AM], [[[76, 2], [74, 1]], AM], [[[72, 1], [71, 1], [69, 1]], AM], [[[71, 3]], E],
  [[[67, 2], [71, 1]], G], [[[74, 2], [72, 1]], G], [[[71, 1], [69, 1], [68, 1]], E], [[[69, 3]], AM],
  [[[76, 2], [77, 1]], F], [[[76, 2], [72, 1]], AM], [[[74, 2], [76, 1]], DM], [[[74, 2], [71, 1]], G],
  [[[72, 1], [71, 1], [69, 1]], AM], [[[68, 1], [69, 1], [71, 1]], E], [[[72, 1], [71, 1], [68, 1]], E], [[[69, 3]], AM],
];

function pipe(ctx, out, t, hz, dur, amp, flute = true) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(amp, t + 0.02);
  g.gain.exponentialRampToValueAtTime(amp * 0.7, t + 0.12);
  g.gain.setValueAtTime(amp * 0.7, t + Math.max(0.12, dur - 0.06));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  g.connect(out);
  const vib = ctx.createOscillator();
  vib.frequency.value = 6.2;
  const depth = ctx.createGain();
  depth.gain.value = flute ? 9 : 0;                    // cents
  vib.connect(depth);
  vib.start(t);
  vib.stop(t + dur + 0.1);
  for (const [type, mult, a] of flute ? [["triangle", 1, 1], ["sine", 2, 0.35], ["sine", 3, 0.12]] : [["square", 1, 0.35], ["sine", 1, 1]]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz * mult;
    depth.connect(o.detune);
    const ag = ctx.createGain();
    ag.gain.value = a;
    o.connect(ag);
    ag.connect(g);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
}

/* The organ plays on whether anyone hears it, so a player who walks up
   hears it mid-tune: update() keeps time every frame, and only schedules
   notes (a quarter second ahead) while the gain is worth hearing. */
export function bandOrgan() {
  let bus = null, next = 0, bar = 0;
  return {
    update(audio, gain) {
      const ctx = audio?.ctx, out = audio?.master;
      if (!ctx || !out) return;
      if (!bus || bus.context !== ctx) {
        bus = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 3200;
        bus.connect(lp);
        lp.connect(out);
        next = ctx.currentTime + 0.1;
      }
      bus.gain.setTargetAtTime(gain, ctx.currentTime, 0.1);
      while (next < ctx.currentTime + 0.25) {
        const [tune, [bass, chord]] = WALTZ[bar % WALTZ.length];
        if (gain > 0.003 && next > ctx.currentTime - 0.05) {
          let t = next;
          for (const [n, beats] of tune) {
            pipe(ctx, bus, t, midiHz(n), beats * BEAT * 0.92, 0.16);
            t += beats * BEAT;
          }
          pipe(ctx, bus, next, midiHz(bass), BEAT * 0.8, 0.2, false);              // oom
          for (const k of [1, 2]) for (const n of chord) pipe(ctx, bus, next + k * BEAT, midiHz(n), BEAT * 0.45, 0.04, false);   // pah, pah
        }
        next += 3 * BEAT;
        bar++;
      }
    },
  };
}

/* The Ferris wheel's creak: iron rubbing iron at the axle, a resonant
   squeal that rises and sags over a low groan, a knock to start it. */
let NOISE = null;
function noise(ctx) {
  if (NOISE && NOISE.sampleRate === ctx.sampleRate) return NOISE;
  const len = ctx.sampleRate * 2;
  NOISE = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = NOISE.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return NOISE;
}

export function wheelCreak(audio, gain) {
  const ctx = audio?.ctx, out = audio?.master;
  if (!ctx || !out || gain < 0.005) return;
  const t = ctx.currentTime, dur = 1.1 + Math.random() * 0.5, f0 = 380 + Math.random() * 120;
  const g = ctx.createGain();
  g.gain.value = gain;
  g.connect(out);
  // the squeal: two resonances of the same rub, swelling and fading
  for (const [mult, amp, q] of [[1, 0.9, 22], [2.07, 0.3, 30]]) {
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f0 * mult, t);
    bp.frequency.linearRampToValueAtTime(f0 * 1.35 * mult, t + dur * 0.45);
    bp.frequency.linearRampToValueAtTime(f0 * 0.9 * mult, t + dur);
    const a = ctx.createGain();
    a.gain.setValueAtTime(0.0001, t);
    a.gain.exponentialRampToValueAtTime(amp * 3, t + dur * 0.3);
    a.gain.exponentialRampToValueAtTime(amp * 1.5, t + dur * 0.7);
    a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp);
    bp.connect(a);
    a.connect(g);
    n.start(t, Math.random());
    n.stop(t + dur + 0.05);
  }
  // the groan under it
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(64, t);
  o.frequency.linearRampToValueAtTime(52, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 260;
  const ag = ctx.createGain();
  ag.gain.setValueAtTime(0.0001, t);
  ag.gain.exponentialRampToValueAtTime(0.22, t + 0.25);
  ag.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
  o.connect(lp);
  lp.connect(ag);
  ag.connect(g);
  o.start(t);
  o.stop(t + dur + 0.25);
  // the knock that sets it off
  const k = ctx.createBufferSource();
  k.buffer = noise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = "bandpass";
  hp.frequency.value = 900;
  hp.Q.value = 4;
  const kg = ctx.createGain();
  kg.gain.setValueAtTime(0.5, t);
  kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  k.connect(hp);
  hp.connect(kg);
  kg.connect(g);
  k.start(t);
  k.stop(t + 0.1);
}

/* The coaster's rattle, riding with the train: a rumble that grows with
   its speed, the wheels clicking over the rail joints faster as it drops,
   and the chain dogs' slow, heavy clack up the lift hill. update() each
   frame with the train's speed (m/s) and whether it is on the lift. */
export function coasterRattle() {
  let bus = null, rumble = null, nextClick = 0;
  const click = (ctx, t, hz, amp, len) => {
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = hz * (0.9 + Math.random() * 0.2);
    bp.Q.value = 3;
    const a = ctx.createGain();
    a.gain.setValueAtTime(amp, t);
    a.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(bp);
    bp.connect(a);
    a.connect(bus);
    n.start(t, Math.random());
    n.stop(t + len + 0.02);
  };
  return {
    update(audio, gain, speed, lift) {
      const ctx = audio?.ctx, out = audio?.master;
      if (!ctx || !out) return;
      if (!bus || bus.context !== ctx) {
        bus = ctx.createGain();
        bus.connect(out);
        const n = ctx.createBufferSource();
        n.buffer = noise(ctx);
        n.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 420;
        rumble = ctx.createGain();
        rumble.gain.value = 0;
        n.connect(lp);
        lp.connect(rumble);
        rumble.connect(bus);
        n.start();
        nextClick = ctx.currentTime;
      }
      const now = ctx.currentTime;
      bus.gain.setTargetAtTime(gain, now, 0.08);
      rumble.gain.setTargetAtTime(Math.min(1, speed / 16) * 0.55, now, 0.15);
      if (speed < 0.5 || gain < 0.003) {
        nextClick = Math.max(nextClick, now);
        return;
      }
      const every = lift ? 0.17 : Math.min(0.3, Math.max(0.045, 1.4 / speed));
      while (nextClick < now + 0.15) {
        if (nextClick >= now - 0.02) {
          if (lift) click(ctx, nextClick, 520, 0.7, 0.07);
          else click(ctx, nextClick, 1700, 0.35, 0.03);
        }
        nextClick += every;
      }
    },
  };
}
