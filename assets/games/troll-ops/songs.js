// Troll Forces — the saloon band's songbook (BAND.md). Every song is one
// tune in three parts over the same bars: piano (right hand + left hand),
// guitar, trumpet. Public domain only (user 2026-10-09: no Havana, no
// Fuerza Regida). The notation (notation.js) draws them; the panel
// (menu/instrument-panel.js) plays and checks them; the band (modes/
// social-band.js) plays them all together on the room clock.
//
// A song:
//   { id, name, by, bpm (quarter notes), time: "4/4" | "3/4" | "2/4" | "6/8" | "3/8",
//     key: "C" | "F" | "Bb" | "G" | "D" | "Am" | ..., pickup?: beats in the first bar,
//     chords: "C | G7 | C F | ...",                 one entry per bar; "C F" splits
//                                                    the bar in halves, "C:3 G7:1" by beats
//     melody: "E4 D4 C4:2 | ...",                    the tune (bars split by |)
//     lh?, guitar?, trumpet?: a part written out (else made from the melody
//                             and the chords, at the part's level)
//     levels: { piano, guitar, trumpet }: "Basic" | "Intermediate" | "Expert",
//     lead: "piano" | "guitar" | "trumpet" }
//
// A note token: `C4` (a quarter), `C4:2`, `F#4:.5`, `Bb3:1.5`; `R:1` a rest;
// `C4:2~` tied to the next note; `[C3 E3 G3]:2` a chord. Durations are in
// quarter notes whatever the time signature. Pitches are written as they
// sound (accidentals spelt out); the notation works out which accidentals
// the key signature already gives.

export const LEVELS = ["Basic", "Intermediate", "Expert"];
export const INSTRUMENTS = ["piano", "guitar", "trumpet"];
/* What the panel's keys reach (C3 to G5): the piano's right hand and the
   trumpet. The guitar reads an octave up (its treble clef has an 8 under
   it) and sounds an octave down. */
export const LOW = 48, HIGH = 79;

/* ------------------------------------------------------------- pitches */

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = "CDEFGAB";
/* "F#4" -> { letter: "F", acc: 1, oct: 4, midi: 66, step: diatonic index } */
export function parsePitch(name) {
  const m = /^([A-G])(#|b|n)?(-?\d)$/.exec(name);
  if (!m) return null;
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  const oct = +m[3];
  return { letter: m[1], acc, oct, midi: 12 * (oct + 1) + SEMI[m[1]] + acc, step: oct * 7 + LETTERS.indexOf(m[1]) };
}
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export function midiName(m) { return `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`; }

/* --------------------------------------------------------------- chords */

const QUAL = {
  "": [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  dim: [0, 3, 6], dim7: [0, 3, 6, 9], aug: [0, 4, 8], sus4: [0, 5, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 9: [0, 4, 7, 10, 14],
};
/* "Am7", "C/G", "Bb" -> { root (pitch class), bass (pc), tones: [pc...] }, or null. */
export function chordTones(name) {
  const m = /^([A-G])(#|b)?(maj7|m7|m6|dim7|dim|aug|sus4|m|7|6|9)?(?:\/([A-G])(#|b)?)?$/.exec(name);
  if (!m) return null;
  const pc = (l, a) => (SEMI[l] + (a === "#" ? 1 : a === "b" ? -1 : 0) + 12) % 12;
  const root = pc(m[1], m[2]);
  const tones = QUAL[m[3] || ""].map((i) => (root + i) % 12);
  return { root, bass: m[4] ? pc(m[4], m[5]) : root, tones, name };
}
/* The pitch class `pc` in the octave starting at midi `lo`. */
export const inOctave = (pc, lo) => lo + ((pc - lo) % 12 + 12) % 12;

/* ------------------------------------------------------------ the parser */

/* "4/4" -> { num, den, barBeats (quarters), group (quarters a beam/beat spans) } */
export function meter(time) {
  const [num, den] = time.split("/").map(Number);
  const barBeats = num * 4 / den;
  // compound time (6/8, 9/8, 12/8) beats in dotted quarters; 3/8 is one
  const group = den === 8 ? (num % 3 === 0 ? 1.5 : 0.5) : 1;
  return { num, den, barBeats, group };
}

/* One part's string -> bars of events { beats, rest, tie, notes: [pitch...] }. */
export function parsePart(str) {
  return str.split("|").map((bar) => bar.trim()).filter((b, i, all) => b || i < all.length - 1).map((bar) => {
    const out = [];
    // chords keep their spaces inside [ ]: split on spaces outside them
    for (const tok of bar.match(/\[[^\]]*\](?::[\d.]+)?~?|\S+/g) || []) {
      const t = /^(\[[^\]]*\]|[^:~]+)(?::([\d.]+))?(~)?$/.exec(tok);
      if (!t) throw new Error(`bad note "${tok}"`);
      const beats = t[2] ? +t[2] : 1;
      if (!(beats > 0)) throw new Error(`bad length "${tok}"`);
      if (t[1] === "R") { out.push({ beats, rest: true, tie: false, notes: [] }); continue; }
      const names = t[1].startsWith("[") ? t[1].slice(1, -1).trim().split(/\s+/) : [t[1]];
      const notes = names.map((n) => {
        const p = parsePitch(n);
        if (!p) throw new Error(`bad pitch "${n}" in "${tok}"`);
        return p;
      });
      out.push({ beats, rest: false, tie: !!t[3], notes });
    }
    return out;
  });
}

/* "C | G7 | C F | C:3 G7:1" -> per bar, [{ at (beat in the bar), beats, chord }]. */
export function parseChords(str, barBeats, nBars) {
  const bars = str.split("|").map((s) => s.trim());
  const out = [];
  let last = null;
  for (let i = 0; i < nBars; i++) {
    const src = bars[i] ?? "";
    const toks = src ? src.split(/\s+/) : [];
    const list = [];
    if (!toks.length) { if (last) list.push({ at: 0, beats: barBeats, chord: last }); out.push(list); continue; }
    const explicit = toks.some((t) => t.includes(":"));
    let at = 0;
    toks.forEach((t) => {
      const [name, len] = t.split(":");
      const beats = explicit ? +len || barBeats - at : barBeats / toks.length;
      const chord = name === "N.C." ? null : chordTones(name);
      if (name !== "N.C." && !chord) throw new Error(`bad chord "${name}"`);
      list.push({ at, beats, chord });
      at += beats;
      last = chord;
    });
    out.push(list);
  }
  return out;
}

/* -------------------------------------------------- the parts, made up */

/* A part as the band plays it and the notation draws it:
   { clef, bars: [[ev...]...], barBeats, pickup, meter } where an event is
   { beats, rest, tie, notes, at (beat in the song) }. */
function timed(bars, barBeats, pickup) {
  let at = 0;
  return bars.map((bar, i) => {
    const start = at;
    let b = 0;
    for (const ev of bar) { ev.at = start + b; b += ev.beats; }
    at = start + (i === 0 && pickup ? pickup : barBeats);
    return bar;
  });
}

const n = (midi, beats, extra) => ({ beats, rest: false, tie: false, notes: [pitchOf(midi)], ...extra });
const ch = (midis, beats) => ({ beats, rest: false, tie: false, notes: midis.map(pitchOf) });
const rest = (beats) => ({ beats, rest: true, tie: false, notes: [] });
/* A midi number spelt with the key's accidentals (flats in flat keys). */
let SPELL_FLAT = false;
function pitchOf(midi) {
  const pcName = (SPELL_FLAT ? ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] : NAMES)[midi % 12];
  return parsePitch(`${pcName}${Math.floor(midi / 12) - 1}`);
}

/* Fill a bar's chords into `beats` long slices: [{ at, beats, chord }]. */
function slices(chords, step) {
  const out = [];
  for (const c of chords) for (let b = 0; b < c.beats - 1e-6; b += step) out.push({ at: c.at + b, beats: Math.min(step, c.beats - b), chord: c.chord });
  return out;
}

/* The piano's left hand from the chords. Basic: the root held; Intermediate:
   oom-pah (root on the strong beats, the chord on the others); Expert: the
   chord broken in eighths (root, fifth, tenth, fifth). */
function leftHand(chordBars, m, level, pickup) {
  return chordBars.map((cs, bi) => {
    const len = bi === 0 && pickup ? pickup : m.barBeats;
    if (bi === 0 && pickup) return [rest(len)];
    const bar = [];
    let used = 0;
    const push = (ev) => { if (used + ev.beats > len + 1e-6) ev.beats = len - used; if (ev.beats > 1e-6) { bar.push(ev); used += ev.beats; } };
    for (const c of cs) {
      if (!c.chord) { push(rest(c.beats)); continue; }
      const root = inOctave(c.chord.bass, 43);           // G2..F#3
      const triad = c.chord.tones.slice(0, 3).map((pc) => inOctave(pc, 52)).sort((a, b) => a - b);   // around E3..D#4
      if (level === "Basic") push(n(inOctave(c.chord.bass, 48), c.beats));
      else if (level === "Intermediate") {
        // oom-pah: the bass on the strong beats (the fifth on beat 3 of
        // 4/4), the chord on the rest; compound time: bass, then chord
        const step = m.group;
        slices([c], step).forEach((s) => {
          const strong = m.group === 1.5 ? s.at % 3 === 0 : m.group === 0.5 ? s.at === 0 : m.barBeats === 3 ? s.at === 0 : s.at % 2 === 0;
          if (!strong) push(ch(triad, s.beats));
          else if (m.barBeats === 4 && s.at === 2) push(n(root + 7 > 55 ? root - 5 : root + 7, s.beats));
          else push(n(root, s.beats));
        });
      } else {
        const low = inOctave(c.chord.bass, 36);         // C2..B2: the run stays on the staff
        const fifth = inOctave((c.chord.root + 7) % 12, low + 1);
        const tenth = inOctave(c.chord.tones[1], fifth + 1);
        const run = [low, fifth, tenth, fifth];
        slices([c], 0.5).forEach((s, k) => push(n(run[k % 4], s.beats)));
      }
    }
    if (used < len - 1e-6) bar.push(rest(len - used));
    return bar;
  });
}

/* A close guitar voicing (as it sounds): bass, then the chord stacked from
   E3 up, five strings. */
export function guitarVoicing(chord) {
  const bass = inOctave(chord.bass, 40);   // E2..D#3
  // the next chord tones up from a third above the bass, close together,
  // no higher than G4 (G5 written: the top of the keys)
  const up = [];
  for (let m = bass + 3; m <= 67 && up.length < 4; m++) if (chord.tones.includes(m % 12)) up.push(m);
  return [bass, ...up];
}

/* The guitar part from the chords: strums written as slashes (a strum is
   an event with `strum: "D"|"U"` and the chord). Basic: a down strum each
   beat; Intermediate: down, down-up, up-down-up (eighths); Expert: the
   chord picked (bass then the strings, eighths). */
function guitarStrums(chordBars, m, level, pickup) {
  const PAT4 = ["D", "D", "U", "U", "D", "U"], PAT_AT4 = [0, 1, 1.5, 2.5, 3, 3.5];
  return chordBars.map((cs, bi) => {
    const len = bi === 0 && pickup ? pickup : m.barBeats;
    if (bi === 0 && pickup) return [rest(len)];
    const bar = [];
    for (const c of cs) {
      if (!c.chord) { bar.push(rest(c.beats)); continue; }
      const v = guitarVoicing(c.chord);
      const strum = (beats, dir) => ({ beats, rest: false, tie: false, notes: v.map((x) => pitchOf(x + 12)), strum: dir, chord: c.chord, sound: v });
      if (level === "Basic") {
        const step = m.group > 1 ? m.group : 1;
        slices([c], step).forEach((s) => bar.push(strum(s.beats, "D")));
      } else if (level === "Intermediate") {
        if (m.barBeats === 4 && c.at === 0 && c.beats === 4) {
          PAT_AT4.forEach((at, k) => bar.push(strum((PAT_AT4[k + 1] ?? 4) - at, PAT4[k])));
        } else {
          slices([c], 0.5).forEach((s, k) => bar.push(strum(s.beats, k % 2 ? "U" : "D")));
        }
      } else {
        // picked: bass, then up and down the strings
        const order = [0, 2, 3, 4, 3, 2];
        slices([c], 0.5).forEach((s, k) => bar.push({ ...n(v[order[k % order.length]] + 12, s.beats), pick: true, sound: [v[order[k % order.length]]] }));
      }
    }
    return bar;
  });
}

/* ------------------------------------------------------------ a song */

const cache = new Map();
/* Every part of a song, ready: { song, meter, bars (count), beats (total),
   parts: { piano: { rh, lh }, guitar, trumpet } } where each staff is
   { clef, bars }. Throws on a malformed song (validateSongs reports it). */
export function songParts(song) {
  if (cache.has(song.id)) return cache.get(song.id);
  const m = meter(song.time);
  SPELL_FLAT = /^(F|Bb|Eb|Ab|Db|Dm|Gm|Cm|Fm)$/.test(song.key);
  const melody = parsePart(song.melody);
  const chordBars = parseChords(song.chords, m.barBeats, melody.length);
  if (song.pickup) chordBars[0] = [{ at: 0, beats: song.pickup, chord: null }];
  const L = song.levels;
  const rh = melody;
  const lh = song.lh ? parsePart(song.lh) : leftHand(chordBars, m, L.piano, song.pickup);
  const guitar = song.guitar ? parsePart(song.guitar) : guitarStrums(chordBars, m, L.guitar, song.pickup);
  if (song.guitar) for (const bar of guitar) for (const ev of bar) if (!ev.rest) { ev.pick = true; ev.sound = ev.notes.map((p) => p.midi - 12); }
  const trumpet = song.trumpet ? parsePart(song.trumpet) : parsePart(song.melody);
  // ties sound as one note; chord names ride the guitar staff
  const out = {
    song, meter: m, bars: melody.length, chords: chordBars,
    beats: (song.pickup || m.barBeats) + (melody.length - 1) * m.barBeats,
    parts: {
      piano: { rh: { clef: "treble", bars: timed(rh, m.barBeats, song.pickup) }, lh: { clef: "bass", bars: timed(lh, m.barBeats, song.pickup) } },
      guitar: { clef: "treble8", bars: timed(guitar, m.barBeats, song.pickup) },
      trumpet: { clef: "treble", bars: timed(trumpet, m.barBeats, song.pickup) },
    },
  };
  if (song.pickup) out.beats -= song.pickup;   // the last bar is short by the pickup
  cache.set(song.id, out);
  return out;
}

/* The notes a player plays on `kind` (the lead staff for the piano: the
   right hand), flat, rests and tied-on notes left out. */
export function playNotes(song, kind) {
  const P = songParts(song).parts;
  const staff = kind === "piano" ? P.piano.rh : P[kind];
  const out = [];
  let tied = false;
  staff.bars.forEach((bar, bi) => bar.forEach((ev, ei) => {
    if (!ev.rest && !tied) out.push({ ev, bar: bi, i: ei, midi: ev.notes[0].midi, at: ev.at, beats: ev.beats, strum: ev.strum || null, chord: ev.chord || null });
    else if (tied && out.length) out[out.length - 1].beats += ev.beats;
    tied = !ev.rest && ev.tie;
  }));
  return out;
}

/* Every sounding event of a part, for the band: [{ at, beats, midis, vel, strum? }]. */
export function partEvents(song, kind) {
  const P = songParts(song).parts;
  const staffs = kind === "piano" ? [[P.piano.rh, 0.8], [P.piano.lh, 0.55]] : [[P[kind], kind === "guitar" ? 0.7 : 0.8]];
  const out = [];
  for (const [staff, vel] of staffs) {
    let held = null;
    for (const bar of staff.bars) for (const ev of bar) {
      if (ev.rest) { held = null; continue; }
      if (held) held.beats += ev.beats;
      else {
        const midis = ev.sound || ev.notes.map((p) => p.midi);
        held = { at: ev.at, beats: ev.beats, midis, vel, strum: ev.strum || null };
        out.push(held);
      }
      if (!ev.tie) held = null;
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/* ------------------------------------------------------------ checking */

/* Every song, every part: bars add up, pitches parse, chords are known, the
   played lines sit on the panel's keys. Returns a list of problems. */
export function validateSongs(list = SONGS) {
  const bad = [];
  const ids = new Set();
  for (const s of list) {
    const where = (w) => `${s.name}: ${w}`;
    if (ids.has(s.id)) bad.push(where("duplicate id"));
    ids.add(s.id);
    for (const k of INSTRUMENTS) if (!LEVELS.includes(s.levels?.[k])) bad.push(where(`no level for ${k}`));
    if (!INSTRUMENTS.includes(s.lead)) bad.push(where("no lead"));
    let P;
    try { P = songParts(s); } catch (e) { bad.push(where(e.message)); continue; }
    const { barBeats } = P.meter;
    const check = (staff, name) => {
      if (staff.bars.length !== P.bars) bad.push(where(`${name} has ${staff.bars.length} bars, the melody ${P.bars}`));
      staff.bars.forEach((bar, i) => {
        const sum = bar.reduce((t, e) => t + e.beats, 0);
        const want = i === 0 && s.pickup ? s.pickup : i === staff.bars.length - 1 && s.pickup ? barBeats - s.pickup : barBeats;
        if (Math.abs(sum - want) > 1e-6 && !(i === staff.bars.length - 1 && s.pickup && Math.abs(sum - barBeats) < 1e-6)) bad.push(where(`${name} bar ${i + 1} is ${sum} beats, wants ${want}`));
        for (const e of bar) if (!e.rest && !isDrawable(e.beats)) bad.push(where(`${name} bar ${i + 1}: a ${e.beats}-beat note can't be written`));
      });
    };
    check(P.parts.piano.rh, "melody");
    check(P.parts.piano.lh, "left hand");
    check(P.parts.guitar, "guitar");
    check(P.parts.trumpet, "trumpet");
    for (const k of ["piano", "trumpet"]) for (const x of playNotes(s, k)) if (x.midi < LOW || x.midi > HIGH) bad.push(where(`${k} note ${midiName(x.midi)} off the keys`));
    for (const x of playNotes(s, "guitar")) if (!x.strum && (x.midi < LOW || x.midi > HIGH)) bad.push(where(`guitar note ${midiName(x.midi)} (written) off the keys`));
  }
  return bad;
}
/* A length one note (maybe dotted) can show: whole down to sixteenth. */
const DRAWABLE = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];
export const isDrawable = (b) => DRAWABLE.some((d) => Math.abs(d - b) < 1e-6) || splitBeats(b) != null;
/* A length as tied drawable pieces (2.5 -> [2, .5]), or null. */
export function splitBeats(b) {
  const out = [];
  let left = b;
  for (const d of DRAWABLE) while (left >= d - 1e-6) { out.push(d); left -= d; }
  return left < 1e-6 ? out : null;
}

/* ============================================================ the songs */

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

/* The three house tunes, as songs: the melody an
   octave down onto the keys, the chords as they were. */
function houseSong(t, i, levels) {
  const melody = t.bars.map(([, line]) => {
    const tok = line.trim().split(/\s+/);
    const out = [];
    for (let k = 0; k + 1 < tok.length; k += 2) {
      // an octave down, spelt as written (Bb stays Bb)
      out.push(`${tok[k].replace(/-?\d$/, (o) => +o - 1)}:${tok[k + 1]}`);
    }
    return out.join(" ");
  }).join(" | ");
  return {
    id: `house-${i}`, name: t.name, by: "the Rusty Grin", bpm: t.bpm, time: `${t.beats}/4`,
    key: ["C", "F", "G"][i], chords: t.bars.map(([c]) => c).join(" | "), melody, levels, lead: "piano",
  };
}

export const SONGS = [
  /* ---- the first sheets (2026-10-07), now with chords and a left hand */
  { id: "hot-cross-buns", name: "Hot Cross Buns", by: "trad.", bpm: 100, time: "4/4", key: "C",
    chords: "C | C | C G7 | C",
    melody: "E4 D4 C4:2 | E4 D4 C4:2 | C4:.5 C4:.5 C4:.5 C4:.5 D4:.5 D4:.5 D4:.5 D4:.5 | E4 D4 C4:2",
    levels: { piano: "Basic", guitar: "Basic", trumpet: "Basic" }, lead: "piano" },
  { id: "mary-lamb", name: "Mary Had a Little Lamb", by: "trad.", bpm: 110, time: "4/4", key: "C",
    chords: "C | C | G7 | C | C | C | G7 | C",
    melody: "E4 D4 C4 D4 | E4 E4 E4:2 | D4 D4 D4:2 | E4 G4 G4:2 | E4 D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4:4",
    levels: { piano: "Basic", guitar: "Basic", trumpet: "Basic" }, lead: "piano" },
  { id: "twinkle", name: "Twinkle, Twinkle", by: "trad.", bpm: 100, time: "4/4", key: "C",
    chords: "C | F C | F C | G7 C | C F | C G7 | C F | C G7 | C | F C | F C | G7 C",
    melody: "C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2",
    levels: { piano: "Basic", guitar: "Basic", trumpet: "Basic" }, lead: "piano" },
  { id: "ode-to-joy", name: "Ode to Joy", by: "Beethoven", bpm: 112, time: "4/4", key: "C",
    chords: "C | G | C | G7:2 C:1 G:1 | C | G | C | G7 C | G | G C | G C | G | C | G | C | G7 C",
    melody: "E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:.5 D4:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 | D4 D4 E4 C4 | D4 E4:.5 F4:.5 E4 C4 | D4 E4:.5 F4:.5 E4 D4 | C4 D4 G3:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2",
    levels: { piano: "Intermediate", guitar: "Basic", trumpet: "Basic" }, lead: "piano" },
  { id: "jingle-bells", name: "Jingle Bells", by: "Pierpont", bpm: 130, time: "4/4", key: "C",
    chords: "C | C | C | C | F | C | D7 | G7 | C | C | C | C | F | C | G7 | C",
    melody: "E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4:1.5 D4:.5 | E4:4 | F4 F4 F4:1.5 F4:.5 | F4 E4 E4 E4:.5 E4:.5 | E4 D4 D4 E4 | D4:2 G4:2 | E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4:1.5 D4:.5 | E4:4 | F4 F4 F4 F4 | F4 E4 E4 E4:.5 E4:.5 | G4 G4 F4 D4 | C4:4",
    levels: { piano: "Intermediate", guitar: "Intermediate", trumpet: "Basic" }, lead: "piano" },
  { id: "oh-susanna", name: "Oh! Susanna", by: "Foster", bpm: 120, time: "4/4", key: "C", pickup: 1,
    chords: " | C | C G | C | G | C | C G | C G7 | C",
    melody: "C4:.5 D4:.5 | E4 G4 G4:1.5 A4:.5 | G4 E4 C4:1.5 D4:.5 | E4 E4 D4 C4 | D4:3 C4:.5 D4:.5 | E4 G4 G4:1.5 A4:.5 | G4 E4 C4:1.5 D4:.5 | E4 E4 D4 D4 | C4:3",
    levels: { piano: "Intermediate", guitar: "Basic", trumpet: "Intermediate" }, lead: "trumpet" },
  // Für Elise: 3/8, the opening as written (sixteenths), an octave down from E5 onto the keys' top
  { id: "fur-elise", name: "Für Elise", by: "Beethoven", bpm: 72, time: "3/8", key: "Am", pickup: 0.5,
    chords: " | Am | Am | E | Am | Am | Am | E | Am",
    melody: "E5:.25 D#5:.25 | E5:.25 D#5:.25 E5:.25 B4:.25 D5:.25 C5:.25 | A4:.5 R:.25 C4:.25 E4:.25 A4:.25 | B4:.5 R:.25 E4:.25 G#4:.25 B4:.25 | C5:.5 R:.25 E4:.25 E5:.25 D#5:.25 | E5:.25 D#5:.25 E5:.25 B4:.25 D5:.25 C5:.25 | A4:.5 R:.25 C4:.25 E4:.25 A4:.25 | B4:.5 R:.25 E4:.25 C5:.25 B4:.25 | A4:1",
    lh: "R:.5 | R:1.5 | A2:.25 E3:.25 A3:.25 R:.75 | E2:.25 E3:.25 G#3:.25 R:.75 | A2:.25 E3:.25 A3:.25 R:.75 | R:1.5 | A2:.25 E3:.25 A3:.25 R:.75 | E2:.25 E3:.25 G#3:.25 R:.75 | A2:1",
    levels: { piano: "Expert", guitar: "Intermediate", trumpet: "Expert" }, lead: "piano" },
  { id: "entertainer", name: "The Entertainer", by: "Joplin", bpm: 76, time: "2/4", key: "C", pickup: 0.5,
    chords: " | C | C | C G7 | C | C | C | D7 | G7",
    melody: "D4:.25 D#4:.25 | E4:.25 C5:.5 E4:.25 C5:.5 E4:.25 C5:.25~ | C5:1.5 C5:.25 D5:.25 | D#5:.25 E5:.25 C5:.25 D5:.25 E5:.5 B4:.25 D5:.25 | C5:1.5 D4:.25 D#4:.25 | E4:.25 C5:.5 E4:.25 C5:.5 E4:.25 C5:.25~ | C5:1.5 A4:.25 G4:.25 | F#4:.25 A4:.25 C5:.25 E5:.5 D5:.25 C5:.25 A4:.25 | D5:1.5",
    lh: "R:.5 | C3:.5 [E3 G3]:.5 G2:.5 [E3 G3]:.5 | C3:.5 [E3 G3]:.5 G2:.5 [E3 G3]:.5 | C3:.5 [E3 G3]:.5 G2:.5 [F3 B3]:.5 | C3:.5 [E3 G3]:.5 G2:.5 [E3 G3]:.5 | C3:.5 [E3 G3]:.5 G2:.5 [E3 G3]:.5 | C3:.5 [E3 G3]:.5 G2:.5 [E3 G3]:.5 | D3:.5 [F#3 C4]:.5 A2:.5 [F#3 C4]:.5 | G2:.5 [F3 B3]:.5 R:.5",
    levels: { piano: "Expert", guitar: "Intermediate", trumpet: "Expert" }, lead: "piano" },
  { id: "canon-in-d", name: "Canon in D", by: "Pachelbel", bpm: 72, time: "4/4", key: "D",
    chords: "D A | Bm F#m | G D | G A | D A | Bm F#m | G D | G A",
    melody: "F#4:2 E4:2 | D4:2 C#4:2 | B3:2 A3:2 | B3:2 C#4:2 | D4 C#4 B3 A3 | G3 F#3 G3 E3 | D3:.5 F#3:.5 A3:.5 G3:.5 F#3:.5 D3:.5 F#3:.5 E3:.5 | D3:.5 B3:.5 D4:.5 A3:.5 G3:.5 B3:.5 A3:.5 G3:.5",
    levels: { piano: "Expert", guitar: "Expert", trumpet: "Intermediate" }, lead: "piano" },
];
// Canon's last bars dip under the keys: the melody sits in the octave up.
SONGS[SONGS.length - 1].melody = "F#5:2 E5:2 | D5:2 C#5:2 | B4:2 A4:2 | B4:2 C#5:2 | D5 C#5 B4 A4 | G4 F#4 G4 E4 | D4:.5 F#4:.5 A4:.5 G4:.5 F#4:.5 D4:.5 F#4:.5 E4:.5 | D4:.5 B3:.5 D4:.5 A3:.5 G3:.5 B3:.5 A3:.5 G3:.5";
SONGS.push(
  houseSong(TUNES[0], 0, { piano: "Expert", guitar: "Intermediate", trumpet: "Expert" }),
  houseSong(TUNES[1], 1, { piano: "Intermediate", guitar: "Basic", trumpet: "Intermediate" }),
  houseSong(TUNES[2], 2, { piano: "Expert", guitar: "Intermediate", trumpet: "Expert" }),
);

/* The songs listed under `level` for `kind` (by that instrument's part). */
export const songsFor = (kind, level) => SONGS.map((s, i) => ({ s, i })).filter(({ s }) => s.levels[kind] === level);
