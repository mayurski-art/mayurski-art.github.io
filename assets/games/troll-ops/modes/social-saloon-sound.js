// Troll Forces — how the Rusty Grin sounds (Socialize, Troll City).
//
//   earshot(at)   how loud a sound at `at` is from where we stand, on top
//                 of the panner's own falloff: full in the room it's in,
//                 through the saloon's walls a lot quieter, gone a street
//                 away. Every instrument goes through it (social-band.js,
//                 social-rp.js), so a player's notes carry as far as
//                 Pete's do.
//   Piano Pete    plays the house tunes on his own whenever nobody's at the
//                 piano and the band isn't on: on the room clock
//                 (room-clock.js), so every client hears the same bar.
//   the room      a murmur of talk, the odd glass clink and laugh. Inside
//                 the saloon only, under the music. All synthesised.
//
// Called once a frame from social-band.js updateBand (it knows when a band
// song is on); this imports neither it nor social-rp.js (the import loop).

import { game } from "../core/state.js?v=st1";
import { roomNow } from "./room-clock.js?v=rc1-cd1-sh1";
import { PianoVoice, TUNES } from "./rp-roles.js?v=rp1b7-cd1-sh1-dj2-or1-bw2";

export const SALOON_SOUND = {
  pete: 0.85,          // Pete's piano, as loud as a player's house tune
  laps: 3,             // times round each house tune
  gap: 4,              // s between tunes (the room fills it)
  wall: 0.3,           // a sound inside heard from outside (and the other way)
  street: 26,          // m past the wall where it's gone
  open: 12,            // m out in the open at full gain (then a 40 m fade)
  murmur: 0.05,        // the room's level
  fade: 0.6,           // s to fade the room in or out at the door
};

const rp = () => (game.isSocial() ? game.builtMap?.map?.rp || null : null);
const zone = () => rp()?.bar?.zone || null;
const inZone = (z, p) => !!z && p.x > z.x0 && p.x < z.x1 && p.z > z.z0 && p.z < z.z1;
/* m from `p` to the saloon's footprint (0 inside). */
function outBy(z, p) {
  const dx = Math.max(z.x0 - p.x, 0, p.x - z.x1), dz = Math.max(z.z0 - p.z, 0, p.z - z.z1);
  return Math.hypot(dx, dz);
}
const ear = () => game.camera.position;
export const inSaloon = () => inZone(zone(), ear());

/* 0..1: how loud a sound at `at` is from here (the panner does the rest). */
export function earshot(at) {
  if (!at) return 0;
  const L = ear(), z = zone();
  const srcIn = inZone(z, at), meIn = inZone(z, L);
  if (z && srcIn && meIn) return 1;
  if (z && srcIn) return SALOON_SOUND.wall * Math.max(0, 1 - outBy(z, L) / SALOON_SOUND.street);
  const d = Math.hypot(at.x - L.x, at.z - L.z);
  const open = Math.max(0, Math.min(1, 1 - (d - SALOON_SOUND.open) / 40));
  return z && meIn ? open * SALOON_SOUND.wall : open;
}

/* --------------------------------------------------------- Piano Pete */

// Each house tune's length, from a voice that never sounds (the constructor
// touches no audio).
let SET = null;
function setList() {
  if (SET) return SET;
  let t = 0;
  SET = TUNES.map((_, i) => {
    const v = new PianoVoice({}, { x: 0, y: 0, z: 0 }, i);
    const len = v.loop.beats * v.spb * SALOON_SOUND.laps;
    const e = { i, from: t, len };
    t += len + SALOON_SOUND.gap;
    return e;
  });
  SET.cycle = t;
  return SET;
}
/* What Pete plays at room time `ms`: { tune, into (s) } or null (between). */
export function peteAt(ms = roomNow()) {
  const S = setList();
  const s = ((ms / 1000) % S.cycle + S.cycle) % S.cycle;
  for (const e of S) if (s >= e.from && s < e.from + e.len) return { tune: e.i, into: s - e.from, name: TUNES[e.i].name };
  return null;
}

const pete = { voice: null, key: null, npc: null, gain: 0, on: false };

function petePiano() {
  const s = rp()?.seats?.()?.find((x) => x.kind === "piano");
  return s ? { x: s.x, y: s.y + 0.6, z: s.z } : null;
}
function stopPete() {
  pete.voice?.stop();
  pete.voice = null; pete.key = null; pete.on = false; pete.gain = 0;
}

function updatePete(songOn) {
  const a = game.audio;
  const npc = game.townNpcs?.list.find((n) => n.c.role === "Pianist") || null;
  pete.npc = npc;
  const at = petePiano();
  const now = peteAt();
  // a player at the piano (he's off) or the band on (social-band.js plays his part)
  if (!npc || npc.off || songOn || !at || !now || !a?._ready?.()) {
    stopPete();
    if (npc && !songOn) npc.playing = !!now && !npc.off;   // his hands still go, sound or not
    return;
  }
  npc.playing = true;
  const key = `${now.tune}:${Math.floor(roomNow() / 1000 / setList().cycle)}`;
  if (pete.key !== key) {
    pete.voice?.stop();
    const v = new PianoVoice(a, at, now.tune);
    v.start();
    v.t0 = a.ctx.currentTime - now.into;   // on the room clock: the bar everyone's on
    pete.voice = v; pete.key = key;
  }
  pete.gain = SALOON_SOUND.pete * earshot(at);
  pete.on = true;
  pete.voice.update(pete.gain);
}

/* ------------------------------------------------------------ the room */

const room = { bus: null, voices: [], level: 0, nextClink: 0, nextLaugh: 0, nextPhrase: 0, clinks: 0, laughs: 0, quietSince: 0 };

/* The murmur: four talkers, each noise through a voice-shaped band with a
   syllable wobble, talking in phrases; and a low room tone under them. */
function buildRoom() {
  const a = game.audio, ctx = a.ctx;
  room.bus = ctx.createGain();
  room.bus.gain.value = 0;
  const warm = ctx.createBiquadFilter();
  warm.type = "lowpass"; warm.frequency.value = 2400;
  room.bus.connect(warm).connect(a.master);
  room.fx = ctx.createGain();
  room.fx.gain.value = 0;
  room.fx.connect(a.master);
  for (let k = 0; k < 4; k++) {
    const src = ctx.createBufferSource();
    src.buffer = a.noise; src.loop = true;
    src.loopStart = Math.random(); src.loopEnd = a.noise.duration;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 450 + k * 160; bp.Q.value = 2.2;
    const f2 = ctx.createBiquadFilter();
    f2.type = "peaking"; f2.frequency.value = 1300 + k * 210; f2.Q.value = 3; f2.gain.value = 7;
    const syl = ctx.createGain(); syl.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 3.3 + k * 0.7;
    const depth = ctx.createGain(); depth.gain.value = 0.45;
    lfo.connect(depth).connect(syl.gain);
    const phrase = ctx.createGain(); phrase.gain.value = 0;
    // a touch of stereo: the talkers round the room
    const pan = ctx.createStereoPanner(); pan.pan.value = [-0.6, 0.5, -0.2, 0.75][k];
    src.connect(bp).connect(f2).connect(syl).connect(phrase).connect(pan).connect(room.bus);
    src.start(); lfo.start();
    room.voices.push({ src, lfo, bp, phrase, base: 450 + k * 160, until: 0 });
  }
  const tone = ctx.createBufferSource();
  tone.buffer = a.noise; tone.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260;
  const tg = ctx.createGain(); tg.gain.value = 0.35;
  tone.connect(lp).connect(tg).connect(room.bus);
  tone.start();
  room.voices.push({ src: tone, tone: true });
}
function dropRoom() {
  for (const v of room.voices) { try { v.src.stop(); v.lfo?.stop(); } catch { /* gone */ } }
  try { room.bus?.disconnect(); room.fx?.disconnect(); } catch { /* gone */ }
  room.voices = []; room.bus = null; room.fx = null; room.level = 0; room.nextClink = 0;
}

/* Where a clink or a laugh goes: the room's own fx bus (fading with it at
   the door), panned left or right of us. No HRTF panner per sound: the
   room is all round us anyway, and three tabs of them cost frames. */
function roomOut(at) {
  const ctx = game.audio.ctx, L = ear();
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-0.8, Math.min(0.8, (at.x - L.x) / 8));
  const g = ctx.createGain();
  g.gain.value = Math.max(0.35, 1 - Math.hypot(at.x - L.x, at.z - L.z) / 16);   // nearer tables louder
  g.connect(p).connect(room.fx);
  return g;
}

/* A glass set down on a table, somewhere in the room: a few inharmonic
   partials that ring and die. */
function clink(at) {
  const a = game.audio, ctx = a.ctx, t = ctx.currentTime;
  const g = ctx.createGain();
  const peak = 0.025 + Math.random() * 0.02;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35 + Math.random() * 0.3);
  g.connect(roomOut(at));
  const f = 2600 + Math.random() * 1800;
  for (const [mul, amp] of [[1, 1], [1.52, 0.6], [2.71, 0.35], [4.1, 0.2]]) {
    const o = ctx.createOscillator();
    o.type = "sine"; o.frequency.value = f * mul;
    const og = ctx.createGain(); og.gain.value = amp;
    o.connect(og).connect(g);
    o.start(t); o.stop(t + 0.8);
  }
  // two glasses: a second tap just after
  if (Math.random() < 0.4) setTimeout(() => { if (room.bus) clinkOnce(at, f * 1.07); }, 90 + Math.random() * 60);
  room.clinks++;
}
function clinkOnce(at, f) {
  const a = game.audio, ctx = a.ctx, t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.018, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  g.connect(roomOut(at));
  const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
  o.connect(g); o.start(t); o.stop(t + 0.4);
}
/* Somebody at a table finds something funny: "ha-ha-ha", falling. */
function laugh(at) {
  const a = game.audio, ctx = a.ctx, t0 = ctx.currentTime;
  const out = ctx.createGain(); out.gain.value = 0.05 + Math.random() * 0.03;
  const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 750; f1.Q.value = 4;
  const f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 1250; f2.Q.value = 5;
  const mix = ctx.createGain();
  mix.connect(f1).connect(out); mix.connect(f2).connect(out);
  out.connect(roomOut(at));
  const n = 3 + Math.floor(Math.random() * 3), pitch = 150 + Math.random() * 120, step = 0.15 + Math.random() * 0.05;
  for (let i = 0; i < n; i++) {
    const t = t0 + i * step, f = pitch * (1 - i * 0.05);
    const o = ctx.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(f * 1.12, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1 - i * 0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(mix); o.start(t); o.stop(t + 0.14);
    // the breath between
    const b = ctx.createBufferSource(); b.buffer = a.noise;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t + 0.08); bg.gain.exponentialRampToValueAtTime(0.12, t + 0.1); bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    b.connect(bg).connect(mix); b.start(t + 0.08, Math.random()); b.stop(t + 0.16);
  }
  room.laughs++;
}
/* Somewhere at a table: a spot inside the saloon, at sitting height. */
function aSpot(z) {
  return { x: z.x0 + 2 + Math.random() * (z.x1 - z.x0 - 4), y: (rp()?.bar?.floorY ?? 0) + 1.1, z: z.z0 + 2 + Math.random() * (z.z1 - z.z0 - 4) };
}

function updateRoom() {
  const a = game.audio, z = zone();
  if (!a?._ready?.()) return;
  const want = inZone(z, ear()) ? 1 : 0;
  const t = a.ctx.currentTime;
  if (want && !room.bus) buildRoom();
  if (!room.bus) return;
  if (want !== room.level) {
    room.bus.gain.setTargetAtTime(want * SALOON_SOUND.murmur, t, SALOON_SOUND.fade / 3);
    room.fx.gain.setTargetAtTime(want, t, SALOON_SOUND.fade / 3);
    room.level = want;
    room.quietSince = want ? 0 : t;
  }
  // gone a while: let the talkers go (rebuilt at the door)
  if (!want) { if (t - room.quietSince > 3) dropRoom(); return; }
  // the talkers: a phrase, a pause, a new pitch
  for (const v of room.voices) {
    if (v.tone || t < v.until) continue;
    const talking = v.phrase.gain.value < 0.5 && Math.random() < 0.7;
    v.phrase.gain.setTargetAtTime(talking ? 0.7 + Math.random() * 0.3 : 0.08, t, 0.15);
    v.bp.frequency.setTargetAtTime(v.base * (0.85 + Math.random() * 0.3), t, 0.3);
    v.lfo.frequency.setTargetAtTime(3 + Math.random() * 2.5, t, 0.2);
    v.until = t + (talking ? 1.2 + Math.random() * 2.4 : 0.4 + Math.random() * 1.2);
  }
  if (!room.nextClink) { room.nextClink = t + 2 + Math.random() * 4; room.nextLaugh = t + 8 + Math.random() * 10; }
  if (t > room.nextClink) { clink(aSpot(z)); room.nextClink = t + 2.5 + Math.random() * 6; }
  if (t > room.nextLaugh) { laugh(aSpot(z)); room.nextLaugh = t + 10 + Math.random() * 16; }
}

/* ------------------------------------------------------------ each frame */

/* Out of the match (social-rp.js resetBar): all of it quiet. */
export function stopSaloonSound() {
  stopPete();
  if (room.bus) dropRoom();
}

export function updateSaloonSound(songOn) {
  if (!rp()?.bar?.zone) { stopPete(); if (room.bus) dropRoom(); return; }
  updatePete(songOn);
  updateRoom();
}

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollSaloon = {
    SALOON_SOUND, earshot, peteAt, inSaloon,
    // RMS of Pete's piano as it leaves his voice (after its earshot gain), over `ms`
    peteLevel: async (ms = 800) => {
      const v = pete.voice, ctx = game.audio.ctx;
      if (!v?.tone) return 0;
      const an = ctx.createAnalyser(); an.fftSize = 2048;
      v.tone.connect(an);
      const buf = new Float32Array(an.fftSize);
      let sum = 0, n = 0;
      for (let t = 0; t < ms; t += 100) {
        await new Promise((r) => setTimeout(r, 100));
        an.getFloatTimeDomainData(buf);
        for (const x of buf) { sum += x * x; n++; }
      }
      v.tone.disconnect(an);
      return Math.sqrt(sum / n);
    },
    state: () => ({ pete: { on: pete.on, gain: pete.gain, tune: pete.voice?.tune ?? null, playing: !!pete.npc?.playing },
      room: { on: !!room.bus, level: room.level, gain: room.bus?.gain.value ?? 0, clinks: room.clinks, laughs: room.laughs }, inSaloon: inSaloon() }),
  };
}
