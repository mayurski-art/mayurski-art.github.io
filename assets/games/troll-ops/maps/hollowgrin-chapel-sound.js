// Troll Forces — Hollowgrin: the chapel's sounds, made in WebAudio through
// the game's own mixer (hollowgrin.js attachAudio): the bell's toll at each
// turn of its swing, and the ghost's organ chords. Each is heard by whoever
// is near enough, louder the closer (hollowgrin-chapel.js works out the
// gain from the camera's distance and calls these).

/* The bell: a struck bronze bell's partials (hum, prime, tierce, quint,
   nominal and above), each dying away at its own rate, over the clapper's
   knock. */
const BELL_HZ = 196;                                   // G3: a big parish bell
const PARTIALS = [[0.5, 0.5, 7], [1, 0.42, 5], [1.2, 0.3, 3.5], [1.5, 0.18, 2.6], [2, 0.34, 2.2], [2.5, 0.08, 1.4], [3, 0.12, 1.1], [4.2, 0.05, 0.6]];

export function bellToll(audio, gain) {
  const ctx = audio?.ctx, out = audio?.master;
  if (!ctx || !out || gain < 0.005) return;
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.value = gain;
  g.connect(out);
  for (const [ratio, amp, decay] of PARTIALS) {
    const o = ctx.createOscillator();
    o.frequency.value = BELL_HZ * ratio * (1 + (Math.random() - 0.5) * 0.002);
    const a = ctx.createGain();
    a.gain.setValueAtTime(0.0001, t);
    a.gain.exponentialRampToValueAtTime(amp, t + 0.006);
    a.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(a);
    a.connect(g);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
  // the knock: a short, bright burst of noise
  const len = Math.floor(ctx.sampleRate * 0.05);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const n = ctx.createBufferSource();
  n.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;
  const k = ctx.createGain();
  k.gain.value = 0.25;
  n.connect(hp);
  hp.connect(k);
  k.connect(g);
  n.start(t);
}

/* The organ: minor and diminished chords, a reed and a flute voice a note,
   a slow tremolant, and the chapel's echo. */
const CHORDS = [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61], [44, 50, 53, 59], [38, 50, 57, 62]];
const echoes = new WeakMap();
function echo(ctx, out) {
  let e = echoes.get(ctx);
  if (e) return e;
  const inp = ctx.createGain();
  const dl = ctx.createDelay(1);
  dl.delayTime.value = 0.27;
  const fb = ctx.createGain();
  fb.gain.value = 0.38;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2200;
  inp.connect(out);
  inp.connect(dl);
  dl.connect(lp);
  lp.connect(fb);
  fb.connect(dl);
  lp.connect(out);
  e = inp;
  echoes.set(ctx, e);
  return e;
}

export function organChord(audio, chord, gain, dur) {
  const ctx = audio?.ctx, out = audio?.master;
  if (!ctx || !out || gain < 0.005) return;
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.09);
  g.gain.setValueAtTime(gain, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.45);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1600;
  g.connect(lp);
  lp.connect(echo(ctx, out));
  const trem = ctx.createOscillator();
  trem.frequency.value = 5.2;
  const depth = ctx.createGain();
  depth.gain.value = 3;                               // cents of wobble
  trem.connect(depth);
  trem.start(t);
  trem.stop(t + dur + 0.5);
  for (const note of CHORDS[((chord % CHORDS.length) + CHORDS.length) % CHORDS.length]) {
    const hz = 440 * 2 ** ((note - 69) / 12);
    for (const [type, mult, amp] of [["square", 1, 0.05], ["sine", 2, 0.07], ["sine", 0.5, 0.05]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz * mult;
      depth.connect(o.detune);
      const a = ctx.createGain();
      a.gain.value = amp;
      o.connect(a);
      a.connect(g);
      o.start(t);
      o.stop(t + dur + 0.5);
    }
  }
}
