// Troll Forces — sound clips (drop cinematic doc, phase 4).
//
// Everything else in sound/audio.js is synthesised; these few are real
// recordings: the Royale drop's mask, breaths, belt, steps, ramp latch and
// wind, the fall's whooshes, and the Tactical Nuke's alarm, missile, blast
// and beeps. Pixabay clips (Pixabay Content License, no credit needed),
// trimmed, peak-normalised and made small mono mp3s in sfx/ (mp3 rather than
// ogg: iPhone Safari decodes every mp3).
//
// They're fetched once (the service worker keeps them, sw.js) and decoded
// into the game's own AudioContext, so they go through the same master gain
// and mute as everything else. Until a clip is in, playSfx returns null and
// the caller plays its synth version instead: nothing waits on a download.

import { game } from "../core/state.js?v=st1";

const DIR = "/assets/games/troll-ops/sfx/";
export const SFX_NAMES = [
  "mask-hiss", "breathing", "strap-snap", "belt", "steps", "latch", "wind-in", "gust", "wind-rush", "whoosh",
  "nuke-alarm", "missile", "nuke-blast", "beep",
];
const buffers = new Map();
let loading = null;

/* Fetch and decode them all (once; later calls are free). Royale's setup
   and the nuke's call-in start it early so the clips are in by their cue. */
export function preloadSfx() {
  const a = game.audio;
  if (loading || !a) return loading;
  a.init?.();
  if (!a.ctx) return null;
  loading = Promise.all(SFX_NAMES.map(async (name) => {
    try {
      const res = await fetch(DIR + name + ".mp3");
      if (!res.ok) return;
      const data = await res.arrayBuffer();
      buffers.set(name, await new Promise((ok, fail) => a.ctx.decodeAudioData(data, ok, fail)));
    } catch { /* that slot stays synth */ }
  }));
  return loading;
}
export function sfxLoaded(name) { return buffers.has(name); }
/* The last clips played, newest last (the tests read it). */
export const sfxPlayed = [];

/* Play a clip on the master bus. `gain` 0..1+, `rate` playback speed,
   `delay` s, `loop`, `offset` s into the clip. Returns a handle
   { setGain(g, ramp), setRate(r), stop(fade) }, or null (not loaded yet,
   or no sound): play the synth instead. */
export function playSfx(name, { gain = 1, rate = 1, delay = 0, loop = false, offset = 0 } = {}) {
  const a = game.audio, buf = buffers.get(name);
  if (!buf) { preloadSfx(); return null; }
  if (!a?._ready?.()) return null;
  const ctx = a.ctx, t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = loop;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(a.master);
  src.start(t0, offset % buf.duration);
  sfxPlayed.push(name);
  if (sfxPlayed.length > 64) sfxPlayed.shift();
  let done = false;
  src.onended = () => { done = true; g.disconnect(); };
  return {
    get playing() { return !done; },
    setGain(v, ramp = 0.1) {
      if (done) return;
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(Math.max(0, v), now + ramp);
    },
    setRate(r) { if (!done) src.playbackRate.setTargetAtTime(r, ctx.currentTime, 0.1); },
    stop(fade = 0.15) {
      if (done) return;
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + fade);
      try { src.stop(now + fade + 0.02); } catch { /* already stopped */ }
      done = true;
    },
  };
}
