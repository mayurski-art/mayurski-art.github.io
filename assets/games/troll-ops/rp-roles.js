// Troll Forces — Socialize roleplay, phase 2 (seats, the piano, the jobs).
//
// User, 2026-10-04: "seats everywhere, sheriff + jail, piano player, train
// conductor, doctor, merchant, horsekeeper". Socialize only.
//
// The parts that aren't game flow: the jobs and their wire letters, the
// seated pose, the pianist's hands, and the piano itself (a small synth
// that plays the saloon's tunes). game.js runs the interactions;
// trollcity.js lists the seats and job spots on the map as `rp`.

import * as THREE from "three";

/* The jobs. One player each; `npc` is the townsfolk role that steps off
   when a player takes it. The letter rides the state packet (`rr`). */
export const ROLES = {
  bartender: { code: "b", label: "Bartender", npc: "Barkeep" },
  pianist: { code: "p", label: "Pianist", npc: "Pianist" },
  doctor: { code: "d", label: "Doctor", npc: "Doctor" },
};
export function roleCode(role) { return ROLES[role]?.code || null; }
export function roleLabel(role) { return ROLES[role]?.label || null; }

export const DOCTOR = {
  bagTime: 0.6,       // hold X at the bag: take the job or put it down
  checkTime: 1.2,     // hold X by someone: a check-up, sobers them
  tonicTime: 0.8,     // hold X at the medicine shelf: a tonic (anyone)
  tonic: 2,           // tipsy points a tonic takes off
};

/* ------------------------------------------------------------- sitting */

/* After poseHumanoid: thighs forward, shins down (a stool's are tucked),
   the body dropped so the hips rest on `seatY` (world). Same as the
   townsfolk's (town-npcs.js). */
export function poseSeated(rig, seatY, tuck = 0) {
  const p = rig.parts;
  p.legL.rotation.set(1.5, 0, 0.06);
  p.legR.rotation.set(1.5, 0, -0.06);
  p.kneeL.rotation.set(-1.45 - tuck, 0, 0);
  p.kneeR.rotation.set(-1.45 - tuck * 0.7, 0, 0);
  p.ankleL.rotation.set(0, 0, 0);
  p.ankleR.rotation.set(0, 0, 0);
  p.torso.rotation.x = 0;
  p.spine.rotation.x = 0;
  p.chest.rotation.x = -0.05;
  rig.root.updateMatrixWorld(true);
  p.hips.getWorldPosition(_hip);
  rig.root.position.y += seatY + 0.08 - _hip.y;
  // The ink body was drawn by poseHumanoid with the legs standing: redraw
  // it bent, or the legs hang straight down through the seat.
  rig.body?.update?.();
}
const _hip = new THREE.Vector3();

/* Both hands working the keys (`t` seconds, `seed` keeps players apart). */
export function posePianoArms(rig, t, seed = 0, playing = true) {
  const p = rig.parts;
  const a = playing ? 1 : 0.2;
  const sw = (rate, off = 0) => Math.sin(t * rate + seed * 6 + off) * a;
  p.armL.rotation.set(0.95 + sw(9) * 0.06, 0, 0.18 + sw(2.1) * 0.12); p.elbowL.rotation.set(0.75, 0, 0);
  p.armR.rotation.set(0.95 + sw(11, 1) * 0.06, 0, -0.18 + sw(1.7) * 0.12); p.elbowR.rotation.set(0.75, 0, 0);
  p.chest.rotation.z = sw(1.6) * 0.06;
  rig.body?.update?.();
}

/* --------------------------------------------------------------- tunes */

/* Three originals for the Rusty Grin's upright. Each bar is a chord (two
   for a split bar) and a melody line of "note beats" pairs; the left hand
   (a stride bass, or oom-pah-pah in a waltz) is made from the chords. */
export const TUNES = [
  {
    name: "Rusty Grin Rag", bpm: 168, beats: 4,
    bars: [
      ["C", "G4 .5 C5 .5 E5 .5 G5 1 E5 .5 C5 1"],
      ["C", "D5 .5 E5 .5 G5 .5 E5 1 D5 .5 C5 1"],
      ["F", "A4 .5 C5 .5 F5 .5 A5 1 F5 .5 C5 1"],
      ["F", "A5 .5 G5 .5 F5 .5 E5 .5 F5 2"],
      ["C", "E5 .5 G5 .5 C6 1 B5 .5 A5 .5 G5 1"],
      ["A7", "C#5 .5 E5 .5 A5 1 G5 .5 E5 .5 C#5 1"],
      ["D7 G7", "D5 .5 F#5 .5 A5 1 G5 .5 F5 .5 D5 1"],
      ["C", "E5 1 G4 1 C5 2"],
    ],
  },
  {
    name: "Tumbleweed Waltz", bpm: 150, beats: 3,
    bars: [
      ["F", "C5 1 F5 1 A5 1"],
      ["Bb", "Bb5 2 A5 .5 G5 .5"],
      ["C7", "G5 1 E5 1 C5 1"],
      ["F", "F5 2 C5 1"],
      ["F", "A5 1 C6 1 A5 1"],
      ["Bb", "D6 1.5 C6 .5 Bb5 1"],
      ["C7", "A5 1 G5 1 E5 1"],
      ["F", "F5 3"],
    ],
  },
  {
    name: "Trollface Two-Step", bpm: 176, beats: 4,
    bars: [
      ["G", "B4 .5 D5 .5 G5 .5 D5 .5 B4 .5 D5 .5 G5 1"],
      ["G", "A5 .5 G5 .5 F#5 .5 G5 .5 B5 2"],
      ["D7", "A5 .5 F#5 .5 D5 .5 F#5 .5 A5 .5 C6 .5 B5 .5 A5 .5"],
      ["G", "G5 1 D5 1 G4 2"],
      ["C", "E5 .5 G5 .5 C6 1 E6 1 C6 1"],
      ["G", "D6 .5 B5 .5 G5 1 B5 1 D6 1"],
      ["D7", "C6 .5 A5 .5 F#5 .5 A5 .5 D6 1 C6 1"],
      ["G", "B5 1 A5 .5 F#5 .5 G5 2"],
    ],
  },
];

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  return 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}
/* "A7" -> root pitch class and the chord's pitch classes. */
function chordTones(name) {
  const m = /^([A-G][#b]?)(7?)$/.exec(name);
  const root = (noteMidi(`${m[1]}0`) - 12 + 120) % 12;
  const tones = [root, (root + 4) % 12, (root + 7) % 12];
  if (m[2]) tones.push((root + 10) % 12);
  return { root, tones };
}
/* The pitch class `pc` in the octave starting at midi `lo`. */
const inOctave = (pc, lo) => lo + ((pc - lo) % 12 + 12) % 12;

/* A tune as one loop of [beat, midi, beats, velocity], and its length. */
export function tuneEvents(tune) {
  const out = [];
  const B = tune.beats;
  tune.bars.forEach(([chords, line], bar) => {
    const at0 = bar * B;
    // the right hand
    const tok = line.trim().split(/\s+/);
    let b = 0;
    for (let i = 0; i + 1 < tok.length; i += 2) {
      const len = +tok[i + 1];
      const midi = noteMidi(tok[i]);
      if (midi != null) out.push([at0 + b, midi, len, 0.8]);
      b += len;
    }
    // the left hand, from the chords: bass on the strong beats, the chord
    // on the off beats; a split bar changes chord halfway
    const cs = chords.split(/\s+/).map(chordTones);
    for (let beat = 0; beat < B; beat++) {
      const c = cs.length > 1 && beat >= B / 2 ? cs[1] : cs[0];
      if (B === 3 ? beat === 0 : beat % 2 === 0) {
        const fifth = B === 4 && beat === 2;
        out.push([at0 + beat, inOctave(fifth ? (c.root + 7) % 12 : c.root, 38), 0.9, 0.62]);
      } else {
        for (const pc of c.tones.slice(0, 3)) out.push([at0 + beat, inOctave(pc, 55), 0.45, 0.32]);
      }
    }
  });
  return { events: out.sort((a, b) => a[0] - b[0]), beats: tune.bars.length * B };
}
const LOOPS = TUNES.map(tuneEvents);

/* --------------------------------------------------------------- piano */

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const AHEAD = 0.25;   // seconds of notes queued ahead of the clock

/* One piano playing one tune, from a spot in the world. `audio` is the
   game's GameAudio: notes go through a panner there (game volume, the
   listener's ears). `update(gain)` keeps the queue topped up and fades
   it; `stop()` lets it ring out. */
export class PianoVoice {
  constructor(audio, at, tune = 0) {
    this.audio = audio;
    this.at = { x: at.x, y: at.y, z: at.z };
    this.tune = ((tune | 0) % TUNES.length + TUNES.length) % TUNES.length;
    this.loop = LOOPS[this.tune];
    this.spb = 60 / TUNES[this.tune].bpm;
    this.out = null;
    this.t0 = 0;
    this.next = 0;      // index into the loop
    this.lap = 0;       // which time round
  }

  start() {
    const a = this.audio;
    if (!a.ctx || this.out) return;
    this.out = a.ctx.createGain();
    this.out.gain.value = 0;
    // A touch of top cut: an old upright, not a concert grand.
    this.tone = a.ctx.createBiquadFilter();
    this.tone.type = "lowpass";
    this.tone.frequency.value = 3200;
    this.out.connect(this.tone).connect(a._dest(this.at));
    this.t0 = a.ctx.currentTime + 0.08;
  }

  update(gain = 1) {
    const a = this.audio;
    if (!a._ready()) return;
    if (!this.out) this.start();
    const now = a.ctx.currentTime;
    this.out.gain.setTargetAtTime(Math.max(0, gain), now, 0.12);
    if (gain <= 0.001) {
      // Out of earshot: keep the place in the tune, don't queue notes.
      while (this.when(this.next) < now) this.step();
      return;
    }
    while (this.when(this.next) < now + AHEAD) {
      const t = this.when(this.next);
      const [, midi, len, vel] = this.loop.events[this.next];
      if (t >= now - 0.02) this.note(midi, Math.max(now, t), len * this.spb, vel);
      this.step();
    }
  }

  /* One key struck by hand (the piano panel), now, at `gain` (how near). A
     voice for live keys is never update()d, so no tune plays through it. */
  strike(midi, vel = 0.8, gain = 1, dur = 0.8) {
    const a = this.audio;
    if (!a._ready()) return false;
    if (!this.out) { this.start(); this.out.gain.value = Math.max(0, gain); }
    else this.out.gain.setTargetAtTime(Math.max(0, gain), a.ctx.currentTime, 0.02);
    this.note(midi, a.ctx.currentTime + 0.005, dur, vel);
    return true;
  }

  when(i) { return this.t0 +(this.lap * this.loop.beats + this.loop.events[i][0]) * this.spb; }
  step() { if (++this.next >= this.loop.events.length) { this.next = 0; this.lap++; } }

  /* A struck string: a bright attack fading fast, a body that rings, and
     the same note a few cents sharp beside it (the honky-tonk). */
  note(midi, t, dur, vel) {
    const ctx = this.audio.ctx;
    const f = midiHz(midi);
    const ring = Math.min(2.2, 0.5 + 900 / f) ;   // low notes ring longer
    const end = t + Math.min(ring, dur + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.05 * vel, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0005, end);
    g.connect(this.out);
    for (const [mul, detune, type, amp] of [[1, 0, "triangle", 1], [1, 9, "triangle", 0.7], [2, 4, "sine", 0.35], [3, 0, "sine", 0.12]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mul;
      o.detune.value = detune;
      let dst = g;
      if (amp !== 1) { dst = ctx.createGain(); dst.gain.value = amp; dst.connect(g); }
      o.connect(dst);
      o.start(t);
      o.stop(end + 0.05);
    }
  }

  stop() {
    if (!this.out) return;
    const ctx = this.audio.ctx, out = this.out;
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    setTimeout(() => { try { out.disconnect(); } catch { /* gone */ } }, 2500);
    this.out = null;
  }
}
