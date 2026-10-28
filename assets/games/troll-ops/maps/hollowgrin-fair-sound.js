// Troll Forces — Hollowgrin: the fair's ride sounds, made in WebAudio through
// the game's own mixer (hollowgrin.js attachAudio), each heard louder the
// closer the camera is (hollowgrin.js works out the gain and calls these):
// the carousel's band organ.

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
