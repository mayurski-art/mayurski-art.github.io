// Troll Forces — recorded gunshots and streak sounds.
//
// The same idea as sfx-files.js (Pixabay clips in sfx/, small mono mp3s,
// decoded into the game's own AudioContext) but for sounds that happen all
// match long and anywhere on the map: every gun class's report and the
// scorestreaks' aircraft, radar and blasts. Two differences: a clip can play
// from a world position (through GameAudio's panner, so you hear which side
// it came from), and the clips load in named groups, so the guns are in
// from the first Drop In without pulling the streaks' longer flybys too.
//
// Until a clip is decoded, playClip returns null and the caller plays its
// synth version: nothing waits on a download.

const DIR = "/assets/games/troll-ops/sfx/";
export const CLIP_GROUPS = {
  guns: ["sniper", "battle", "rifle", "smg", "shotgun", "pistol", "hmg"],
};
const buffers = new Map();
const loading = new Map();   // name -> promise

/* Fetch and decode a group (once per clip; later calls are free). */
export function loadClips(audio, group) {
  if (!audio) return null;
  audio.init?.();
  if (!audio.ctx) return null;
  return Promise.all((CLIP_GROUPS[group] || [group]).map((name) => {
    if (!loading.has(name)) {
      loading.set(name, (async () => {
        try {
          const res = await fetch(DIR + name + ".mp3");
          if (!res.ok) return;
          const data = await res.arrayBuffer();
          buffers.set(name, await new Promise((ok, fail) => audio.ctx.decodeAudioData(data, ok, fail)));
        } catch { /* that slot stays synth */ }
      })());
    }
    return loading.get(name);
  }));
}
export function clipLoaded(name) { return buffers.has(name); }
/* The last clips played, newest last (the tests read it). */
export const clipsPlayed = [];

/* Play a clip on the master bus, or from `at` (a world position) through a
   panner. `gain` 0..1+, `rate` playback speed, `delay` s. Returns the
   source node, or null (not loaded yet, no sound, or a far-off layer over
   GameAudio's budget): play the synth instead, or nothing. */
export function playClip(audio, name, { gain = 1, rate = 1, delay = 0, at = null } = {}) {
  const buf = buffers.get(name);
  if (!buf) { loadClips(audio, name); return null; }
  if (!audio?._ready?.()) return null;
  if (audio._overBudget(at)) return false;   // dropped on purpose: no synth either
  const ctx = audio.ctx, t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(audio._dest(at));
  src.start(t0);
  clipsPlayed.push(name);
  if (clipsPlayed.length > 64) clipsPlayed.shift();
  src.onended = () => g.disconnect();
  return src;
}

/* ---- guns ---- */

// Weapon class -> clip, loudness and pitch. Carbines are rifles a hair
// higher; LMGs take the .50's single shot pitched up (the M249 recording is
// one unbroken burst, no shot to cut out of it).
const GUN_CLIP = {
  sniper:  { clip: "sniper",  gain: 0.78, rate: 1 },
  battle:  { clip: "battle",  gain: 0.62, rate: 1 },
  assault: { clip: "rifle",   gain: 0.58, rate: 1 },
  carbine: { clip: "rifle",   gain: 0.55, rate: 1.07 },
  pdw:     { clip: "smg",     gain: 0.62, rate: 1 },
  lmg:     { clip: "hmg",     gain: 0.52, rate: 1.18 },
  shotgun: { clip: "shotgun", gain: 0.7,  rate: 1 },
  sidearm: { clip: "pistol",  gain: 0.55, rate: 1 },
};
// The traced pistols and the revolver ride the pistol recording too: the
// Five-seveN brighter, the .40 as it is, the revolver down a step for its
// bigger black-powder boom.
const PISTOL_RATE = { fiveseven: 1.14, kap: 1 };

/* The recorded report for `def`, or null when it has none (suppressed,
   the Green Candles, launchers): the caller synthesises it. A def can name
   its own clip with def.clip (and def.clipRate). */
export function gunClipFor(def) {
  if (!def || def.quiet || def.candleShot) return null;
  if (def.clip) return { clip: def.clip, gain: def.clipGain ?? 0.6, rate: def.clipRate ?? 1 };
  if (def.revolver) return { clip: "pistol", gain: 0.62, rate: 0.82 };
  if (def.pistolSound) return { clip: "pistol", gain: 0.55, rate: PISTOL_RATE[def.pistolSound] ?? 1 };
  return GUN_CLIP[def.cls] || null;
}

/* Play `def`'s recorded shot. True when it played (or was dropped as a
   far-off layer), false when the caller should synthesise it. */
export function playGunClip(audio, def, volume = 1, at = null) {
  const c = gunClipFor(def);
  if (!c) return false;
  // A few percent of pitch either way: no two shots in a string identical.
  const r = playClip(audio, c.clip, { gain: c.gain * volume, rate: c.rate * (0.97 + Math.random() * 0.06), at });
  return r !== null;
}

