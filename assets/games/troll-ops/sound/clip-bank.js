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
  streaks: ["heli", "jet", "prop-plane", "radar", "quad", "blast", "dog", "missile"],
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

/* ---- scorestreaks ---- */

// What each streak sounds like arriving: layers of { clip, gain, rate,
// delay }. Aircraft play on the master bus, not from a position: they're
// overhead and loud everywhere, and through the panner a plane 40 m up
// came out a murmur. The Swarm's drones and the K9's barks are placed.
const STREAK_SOUND = {
  uav:         [{ clip: "prop-plane", gain: 0.5 }, { clip: "radar", gain: 0.3, delay: 1.2 }],
  counteruav:  [{ clip: "prop-plane", gain: 0.5, rate: 0.9 }, { clip: "radar", gain: 0.3, rate: 0.7, delay: 1.2 }],
  vsat:        [{ clip: "radar", gain: 0.35, rate: 0.85 }, { clip: "radar", gain: 0.25, rate: 0.85, delay: 1.5 }],
  carepackage: [{ clip: "heli", gain: 0.55 }],
  helicopter:  [{ clip: "heli", gain: 0.7, rate: 0.94 }],
  warship:     [{ clip: "prop-plane", gain: 0.7, rate: 0.62 }],   // a big turboprop VTOL
  dragonfire:  [{ clip: "quad", gain: 0.55, rate: 0.8 }],
  drone:       [{ clip: "quad", gain: 0.5 }],
  swarm:       [{ clip: "quad", gain: 0.28 }],
  airstrike:   [{ clip: "jet", gain: 0.8 }],
  k9:          [{ clip: "dog", gain: 0.55 }, { clip: "dog", gain: 0.45, rate: 1.12, delay: 0.32 }, { clip: "dog", gain: 0.5, rate: 0.9, delay: 0.62 }],
  sam:         [{ clip: "missile", gain: 0.45 }],
};

/* Play `kind`'s arrival sound. True when it played; false when its clips
   aren't in yet (the caller plays its synth cue instead). */
export function playStreakSound(audio, kind, { at = null, delay = 0 } = {}) {
  const layers = STREAK_SOUND[kind];
  if (!layers || !clipLoaded(layers[0].clip)) { loadClips(audio, "streaks"); return false; }
  let ok = false;
  for (const l of layers) {
    const r = playClip(audio, l.clip, { gain: l.gain, rate: (l.rate ?? 1) * (0.97 + Math.random() * 0.06), delay: delay + (l.delay ?? 0), at });
    ok = ok || r !== null;
  }
  return ok;
}

/* A streak's bomb, warhead or shell going off: the recorded blast, bigger
   and lower for a bigger `scale`. False when it isn't in yet. */
export function playStreakBlast(audio, scale = 1, at = null) {
  const r = playClip(audio, "blast", { gain: Math.min(1, 0.45 + scale * 0.25), rate: 1.12 - Math.min(0.3, scale * 0.15), at });
  return r !== null;
}
