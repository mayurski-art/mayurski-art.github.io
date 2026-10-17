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
  dim: [0, 3, 6], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], aug: [0, 4, 8], sus4: [0, 5, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 9: [0, 4, 7, 10, 14],
};
/* "Am7", "C/G", "Bb" -> { root (pitch class), bass (pc), tones: [pc...] }, or null. */
export function chordTones(name) {
  const m = /^([A-G])(#|b)?(maj7|m7b5|m7|m6|dim7|dim|aug|sus4|m|7|6|9)?(?:\/([A-G])(#|b)?)?$/.exec(name);
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
    // a chord in the tune (Clair de Lune's thirds): its top note lights, any of its notes counts
    if (!ev.rest && !tied) {
      const midis = ev.notes.map((p) => p.midi);
      out.push({ ev, bar: bi, i: ei, midi: Math.max(...midis), midis, at: ev.at, beats: ev.beats, strum: ev.strum || null, chord: ev.chord || null });
    }
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

/* ======================================================== the library */
/* BAND.md phase 4 (2026-10-09). Each tune transcribed from a published
   source (ABC from abcnotation.com / thesession.org, LilyPond from the
   Mutopia Project, kern-to-ABC of the first editions; noted per song), the
   opening 8-16 bars, moved into the keys' range where it had to be. Not in
   (no text source found to check the notes against): Las Mañanitas, La
   Adelita, La Llorona, Amapola, Malagueña, Reveille, Wabash Blues,
   Liebestraum No. 3; La Paloma (only a folk variant), Schubert's Ständchen
   (only a dance setting). Never Havana or Fuerza Regida (copyrighted). */
const R8 = (chord) => Array(8).fill(`${chord}:.5`).join(" ");
const R4 = (chord) => Array(4).fill(`${chord}:.5`).join(" ");
const bachBar = ([a, b, c]) => { const half = `R:.5 ${a}:.25 ${b}:.25 ${c}:.25 ${a}:.25 ${b}:.25 ${c}:.25`; return `${half} ${half}`; };
SONGS.push(
  /* ---- the anthem: John Stafford Smith; the opening and "the rockets' red glare" (it.wikipedia score) */
  { id: "star-spangled-banner", name: "The Star-Spangled Banner", by: "J. S. Smith", bpm: 92, time: "3/4", key: "C", pickup: 1,
    chords: " | C | C | C:2 D7:1 | G | C | G | C | C | C | C | G | G7 | C | G | C:2 D7:1 | G",
    melody: "G4:.75 E4:.25 | C4 E4 G4 | C5:2 E5:.75 D5:.25 | C5 E4 F#4 | G4:2 G4:.5 G4:.5 | E5:1.5 D5:.5 C5 | B4:2 A4:.75 B4:.25 | C5 C5 G4 | E4 C4 E5:.5 E5:.5 | E5 F5 G5 | G5:2 F5:.5 E5:.5 | D5 E5 F5 | F5:2 F5 | E5:1.5 D5:.5 C5 | B4:2 A4:.75 B4:.25 | C5 E4 F#4 | G4:3",
    levels: { piano: "Intermediate", guitar: "Intermediate", trumpet: "Expert" }, lead: "trumpet" },

  /* ---- Latin */
  // Cielito Lindo (Mendoza y Cortés, 1882), the refrain: trillian.mit.edu/~jc Mexico/Cielito_Lindo
  { id: "cielito-lindo", name: "Cielito Lindo", by: "Mendoza y Cortés", bpm: 132, time: "3/4", key: "C",
    chords: "C | C | F | F | F | G7 | C | C | C | C | F | G7 | G7 | G7 | C | C",
    melody: "E5:3 | D5:2 C5 | A4:3~ | A4:3 | D5:3 | D5:2 C5:.5 C5:.5 | E5 C5:2~ | C5:2 G4 | A4:2 G4 | A4 A4 G4:.5 G4:.5 | F5 F5 D5:1~ | D5 B4 G4 | A4 A4 G4:1~ | G4 F4 G4 | E4:.5 D4:.5 C4:2~ | C4:3",
    levels: { piano: "Basic", guitar: "Basic", trumpet: "Intermediate" }, lead: "trumpet" },
  // La Cucaracha (trad.): trillian.mit.edu/~jc mirror of musicaviva, la-cucaracha-1
  { id: "la-cucaracha", name: "La Cucaracha", by: "trad.", bpm: 168, time: "4/4", key: "D",
    chords: "D | D | D | A7 | A7 | A7 | A7 | D | D | D | D | A | A7 | A7 | A7 | D",
    melody: "R:.5 A3 A3:.5 D4:.5 D4:.5 F#4:.5 F#4:.5 | A4:1.5 F#4:1.5 R:1 | R:.5 A4 B4:.5 A4:.5 G4:.5 F#4:.5 A4:.5 | G4:1.5 E4:1.5 R:1 | R:.5 A3 A3:.5 C#4:.5 C#4:.5 E4:.5 E4:.5 | G4:1.5 E4:1.5 R:1 | R:.5 A4 B4:.5 A4:.5 G4:.5 F#4:.5 E4:.5 | D4:2 R:.5 A3:.5 A3:.5 A3:.5 | D4:1.5 F#4:.5 R:.5 A3:.5 A3:.5 A3:.5 | D4:1.5 F#4:1.5 R:1 | R:.5 D4 D4:.5 C#4:.5 C#4:.5 B3:.5 B3:.5 | A3:2 R:.5 A3:.5 A3:.5 A3:.5 | C#4:1.5 E4:.5 R:.5 A3:.5 A3:.5 A3:.5 | C#4:1.5 E4:1.5 R:1 | R:.5 A4 B4:.5 A4:.5 G4:.5 F#4:.5 E4:.5 | D4:2 R:2",
    levels: { piano: "Basic", guitar: "Basic", trumpet: "Intermediate" }, lead: "trumpet" },
  // Jarabe Tapatío, the Mexican Hat Dance (trad.): thesession.org tune 25950
  { id: "jarabe-tapatio", name: "Jarabe Tapatío (the Hat Dance)", by: "trad.", bpm: 112, time: "6/8", key: "G", pickup: 1,
    chords: " | G | G | D7 | D7 | D7 | D7 | D7 | G",
    melody: "D5:.5 C#5:.5 | D5:.5 B4:.5 Bb4:.5 B4:.5 G4:.5 F#4:.5 | G4:.5 D4 R:.5 B3:.5 C4:.5 | D4:.5 E4:.5 F#4:.5 G4:.5 A4:.5 B4:.5 | C5:.5 A4 R:.5 C5:.5 B4:.5 | C5:.5 A4:.5 Ab4:.5 A4:.5 F#4:.5 F4:.5 | F#4:.5 D4 R:.5 D5:.5 C5:.5 | D5:.5 E5:.5 D5:.5 C5:.5 B4:.5 A4:.5 | G4 R:1",
    levels: { piano: "Intermediate", guitar: "Basic", trumpet: "Expert" }, lead: "trumpet" },
  // La Bamba, the traditional son jarocho (not the 1958 record): Jack Campin, Chalumeau 0300
  { id: "la-bamba", name: "La Bamba (son jarocho)", by: "trad., Veracruz", bpm: 150, time: "4/4", key: "G",
    chords: "G:1 C:1 D7:2 | G:1 C:1 D7:2 | G:1 C:1 D7:2 | G:1 C:1 D7:2 | G:1 C:1 D7:2 | G:1 C:1 D7:2 | G:1 C:1 D7:2 | G:1 C:1 D7:2 | G:1 C:1 D7:2 | G:1 C:1 D7:2 | G:1 C:1 D7:2 | G:1 C:1 D7:2 | G:1 C:1 D7:2 | G",
    melody: "R:.5 C5:.5 C5:.5 C5:.5 C5 C5:.5 B4:.5~ | B4:.5 G4:1.5 R:2 | R:1 C5:.5 C5:.5 C5:.5 C5:.5 C5:.5 C5:.5 | B4:.5 G4 G4:.5 G4 G4:.5 A4:.5~ | A4 F#4:.5 A4:.5 C5:.5 B4:.5 A4:.5 B4:.5~ | B4:.5 G4:.5 R:1 R:2 | R:1 C5:.5 C5:.5 C5:.5 C5:.5 C5:.5 C5:.5 | B4:.5 G4:.5 G4:.5 G4:.5 G4 E4:.5 A4:.5 | A4 F#4:.5 A4:.5 C5:.5 B4:.5 A4:.5 B4:.5~ | B4:.5 G4:.5 R:1 R:2 | R:1 A4:.5 B4:.5 C5:.5 B4:.5 A4:.5 B4:.5~ | B4:.5 G4:.5 R:.5 G4:.5 G4 E4:.5 A4:.5~ | A4 F#4:.5 A4:.5 C5:.5 B4:.5 A4:.5 G4:.5~ | G4 G4 E4 E4:.5 D4:.5",
    levels: { piano: "Intermediate", guitar: "Intermediate", trumpet: "Intermediate" }, lead: "guitar" },
  // two originals, in the styles the user asked for (BAND.md: no copyrighted songs)
  { id: "habanera-del-trollface", name: "Habanera del Trollface", by: "the Rusty Grin (an original)", bpm: 84, time: "2/4", key: "Dm",
    chords: "Dm | A7 | A7 | Dm | Dm | Gm | A7 | Dm",
    melody: "A4:.75 Bb4:.25 A4:.5 F4:.5 | E4:.75 F4:.25 G4:.5 A4:.5 | C#5:.75 D5:.25 E5:.5 C#5:.5 | D5:1.5 A4:.5 | A4:.75 Bb4:.25 A4:.5 D5:.5 | Bb4:.75 A4:.25 G4:.5 Bb4:.5 | A4:.5 G4:.25 F4:.25 E4:.5 C#4:.5 | D4:2",
    lh: "D3:.75 A3:.25 F3:.5 A3:.5 | A2:.75 E3:.25 C#3:.5 G3:.5 | A2:.75 E3:.25 C#3:.5 G3:.5 | D3:.75 A3:.25 F3:.5 A3:.5 | D3:.75 A3:.25 F3:.5 A3:.5 | G2:.75 D3:.25 Bb2:.5 D3:.5 | A2:.75 E3:.25 C#3:.5 G3:.5 | D3:2",
    levels: { piano: "Intermediate", guitar: "Intermediate", trumpet: "Intermediate" }, lead: "trumpet" },
  { id: "corrido-del-grin", name: "Corrido del Grin", by: "the Rusty Grin (an original)", bpm: 132, time: "3/4", key: "G",
    chords: "G | D7 | D7 | G | G | C | D7 | G",
    melody: "B4:.5 C5:.5 D5 B4 | A4:.5 B4:.5 C5 A4 | F#4:.5 G4:.5 A4 C5 | B4:2 G4 | B4:.5 C5:.5 D5 G5 | E5:.5 D5:.5 C5 E5 | D5:.5 C5:.5 B4 A4 | G4:3",
    levels: { piano: "Basic", guitar: "Expert", trumpet: "Intermediate" }, lead: "guitar" },

  /* ---- the trumpet's */
  // Taps: trillian.mit.edu/~jc air/Taps_1 (its two short bars are one here)
  { id: "taps", name: "Taps", by: "bugle call", bpm: 50, time: "4/4", key: "C", pickup: 1,
    chords: " | C | C | C | C | C | C | C",
    melody: "G4:.75 G4:.25 | C5:3 G4:.75 C5:.25 | E5:3 G4:.75 C5:.25 | E5 G4:.75 C5:.25 E5 G4:.75 C5:.25 | E5:3 C5:.75 E5:.25 | G5:3 E5:.75 C5:.25 | G4:3 G4:.75 G4:.25 | C5:3",
    levels: { piano: "Basic", guitar: "Basic", trumpet: "Basic" }, lead: "trumpet" },
  // When the Saints: trillian.mit.edu/~jc demo/Tunes/WhenTheSaintsGoMarchingIn
  { id: "when-the-saints", name: "When the Saints Go Marching In", by: "trad.", bpm: 132, time: "4/4", key: "C", pickup: 3,
    chords: " | C | C | C | C | C | C | G | G | C | C | F | F | C | F:2 G:2 | C",
    melody: "C4 E4 F4 | G4:4 | R:1 C4 E4 F4 | G4:4 | R:1 C4 E4 F4 | G4:2 E4:2 | C4:2 E4:2 | D4:4 | R:1 E4 E4 D4 | C4:4 | E4:2 G4:2 | G4 F4:3 | R:2 E4 F4 | G4:2 E4:2 | C4:2 D4:2 | C4:4",
    levels: { piano: "Basic", guitar: "Basic", trumpet: "Intermediate" }, lead: "trumpet" },
  // Amazing Grace (New Britain): checked against thesession.org 2749
  { id: "amazing-grace", name: "Amazing Grace", by: "trad. (New Britain)", bpm: 80, time: "3/4", key: "G", pickup: 1,
    chords: " | G | G | C | G | G | D | D | D7 | G | G7 | C | G | G | D7 | G",
    melody: "D4 | G4:2 B4:.5 G4:.5 | B4:2 A4 | G4:2 E4 | D4:2 D4 | G4:2 B4:.5 G4:.5 | B4:2 A4 | D5:3~ | D5:2 B4 | D5:2 B4:.5 G4:.5 | B4:2 A4 | G4:2 E4 | D4:2 D4 | G4:2 B4:.5 G4:.5 | B4:2 A4 | G4:2",
    levels: { piano: "Basic", guitar: "Basic", trumpet: "Intermediate" }, lead: "trumpet" },
  // The Carnival of Venice: trillian.mit.edu/~jc Italy/song/Carnival_of_Venice
  { id: "carnival-of-venice", name: "The Carnival of Venice", by: "trad. (Paganini's theme)", bpm: 120, time: "3/4", key: "F", pickup: 1,
    chords: " | F | F | C7 | C7 | C7 | C7 | F | F | F | F | C7 | C7 | C7 | C7 | F | F",
    melody: "C5 | D5:2 C5 | Bb4:2 A4 | Bb4 G4:2~ | G4 G4 A4 | Bb4:2 C5 | D5:2 C5 | A4:3~ | A4:2 C5 | D5:2 C5 | Bb4:2 A4 | Bb4 G4:2~ | G4 G4 A4 | Bb4:2 C5 | D5:2 C5 | F4:3~ | F4:2",
    levels: { piano: "Intermediate", guitar: "Basic", trumpet: "Expert" }, lead: "trumpet" },
  // Flight of the Bumblebee (Rimsky-Korsakov), the opening run: thesession.org 8426,
  // its sixteenths as sixteenths, a tone down onto the keys, its naturals spelt out
  { id: "bumblebee", name: "Flight of the Bumblebee", by: "Rimsky-Korsakov", bpm: 88, time: "2/4", key: "C", pickup: 1.25,
    chords: " | D7 | D7 | D7 | D7 | Gm | Gm | Gm | D7",
    melody: "D#5:.25 D#5:.25 D#5:.25 D#5:.25 D#5:.25 | D5:.25 C#5:.25 C5:.25 B4:.25 A#4:.25 B4:.25 C5:.25 C#5:.25 | D5:.25 C#5:.25 C5:.25 B4:.25 A#4:.25 D#5:.25 D5:.25 C#5:.25 | D5:.25 C#5:.25 C5:.25 B4:.25 A#4:.25 B4:.25 C5:.25 C#5:.25 | D5:.25 C#5:.25 C5:.25 B4:.25 A#4:.25 B4:.25 C5:.25 C#5:.25 | D5:.25 C#5:.25 C5:.25 B4:.25 C5:.25 B4:.25 A#4:.25 A4:.25 | A#4:.25 B4:.25 C5:.25 C#5:.25 D5:.25 D#5:.25 D5:.25 C#5:.25 | D5:.25 C#5:.25 C5:.25 B4:.25 C5:.25 B4:.25 A#4:.25 A4:.25 | A#4:.25 B4:.25 C5:.25 C#5:.25 D5:.25 E5:.25 F5:.25 F#5:.25",
    levels: { piano: "Expert", guitar: "Intermediate", trumpet: "Expert" }, lead: "trumpet" },

  /* ---- the guitar's */
  // Red River Valley: trillian.mit.edu/~jc demo/Tunes/RedRiverValley
  { id: "red-river-valley", name: "Red River Valley", by: "trad.", bpm: 112, time: "4/4", key: "G", pickup: 2,
    chords: " | G | G | G | G | G | G | D | D | G | G7 | C | C | G | D7 | G | G",
    melody: "D4 G4 | B4:2 B4 B4 | B4:2 A4 B4 | A4 G4:3~ | G4:2 D4 G4 | B4:2 G4 B4 | D5:2 C5 B4 | A4:4~ | A4:2 D5 C5 | B4:2 B4 A4 | G4:2 A4 B4 | D5 C5:3~ | C5:2 F#4 E4 | D4:2 F#4 G4 | A4:2 B4 A4 | G4:4~ | G4:2",
    levels: { piano: "Basic", guitar: "Basic", trumpet: "Basic" }, lead: "guitar" },
  // Oh My Darling, Clementine: trillian.mit.edu/~jc mirror of musicaviva, clementine
  { id: "clementine", name: "Oh My Darling, Clementine", by: "trad.", bpm: 108, time: "3/4", key: "A", pickup: 1,
    chords: " | A | A | A | E | E | A | E7 | A",
    melody: "A4:.75 A4:.25 | A4 E4 C#5:.75 C#5:.25 | C#5 A4 A4:.75 C#5:.25 | E5 E5 D5:.75 C#5:.25 | B4:2 B4:.75 C#5:.25 | D5 D5 C#5:.75 B4:.25 | C#5 A4 A4:.75 C#5:.25 | B4 E4 G#4:.75 B4:.25 | A4:2",
    levels: { piano: "Basic", guitar: "Basic", trumpet: "Basic" }, lead: "guitar" },
  // House of the Rising Sun (trad.): trillian.mit.edu/~jc mirror of musicaviva, house-of-the-rising-01
  { id: "house-of-the-rising-sun", name: "House of the Rising Sun", by: "trad.", bpm: 132, time: "3/4", key: "Dm", pickup: 1,
    chords: " | Dm | Dm | A7 | Dm | Dm | C7 | F | A7 | Dm | Dm | Dm | Bb7 | Dm | A7 | Dm | Dm",
    melody: "A4 | D4:2 E4:.5 D4:.5 | F4:2 G4:.5 G#4:.5 | A4:2 F4:.5 E4:.5 | D4:2 A4 | D5:2 A4 | C5:2 A4:.5 G4:.5 | A4:3~ | A4 R:1 A4:.5 A4:.5 | D5:2 D4 | F4:2 G4 | A4:.5 A4:1.5 F4:.5 E4:.5 | D4:2 A4 | A4:2 A4 | A4:.5 A3:1.5 F4:.5 E4:.5 | D4:3~ | D4:2",
    levels: { piano: "Intermediate", guitar: "Intermediate", trumpet: "Intermediate" }, lead: "guitar" },
  // Greensleeves: Bruce Olson's B168 (gitlab chrisspen/abc-music, greensleeves_gm)
  { id: "greensleeves", name: "Greensleeves", by: "trad., 16th c.", bpm: 132, time: "6/4", key: "Gm", pickup: 1,
    chords: " | Gm | F | Eb | D | Gm | F | Eb:3 D:3 | Gm | Bb | F | Gm | D | Bb | F | Eb:3 D:3 | Gm",
    melody: "G4 | Bb4:2 C5 D5:1.5 Eb5:.5 D5 | C5:2 A4 F4:1.5 G4:.5 A4 | Bb4:2 G4 G4:1.5 F#4:.5 G4 | A4:2 F#4 D4:2 G4 | Bb4:2 C5 D5:1.5 Eb5:.5 D5 | C5:2 A4 F4:1.5 G4:.5 A4 | Bb4:1.5 A4:.5 G4 F#4:1.5 E4:.5 F#4 | G4:3 D4:3 | F5:3 F5:2 E5:.5 D5:.5 | C5:2 A4 F4:1.5 G4:.5 A4 | Bb4:2 G4 G4:1.5 F#4:.5 G4 | A4:2 F#4 D4:3 | F5:3 F5:2 E5:.5 D5:.5 | C5:2 A4 F4:1.5 G4:.5 A4 | Bb4:2 G4 F#4:1.5 E4:.5 F#4 | G4:3 G4:2",
    levels: { piano: "Intermediate", guitar: "Intermediate", trumpet: "Intermediate" }, lead: "guitar" },
  // Romance Anónimo: the melody (the top of each triplet), Mutopia spanish-romance, an octave down
  { id: "romance-anonimo", name: "Romance Anónimo (Spanish Romance)", by: "anon.", bpm: 72, time: "3/4", key: "Em",
    chords: "Em | Em | Em | Em | Am | Am | D7 | G | B7 | B7 | Em | Em | B7 | B7 | Em | Em",
    melody: "B4 B4 B4 | B4 A4 G4 | G4 F#4 E4 | E4 G4 B4 | E5 E5 E5 | E5 D5 C5 | C5 B4 A4 | A4 B4 C5 | B4 C5 B4 | D#5 C5 B4 | B4 A4 G4 | G4 F#4 E4 | F#4 F#4 F#4 | F#4 G4 F#4 | E4 E4 E4 | E4:2 R:1",
    levels: { piano: "Intermediate", guitar: "Expert", trumpet: "Basic" }, lead: "guitar" },

  /* ---- the piano's */
  // Minuet in G (Petzold, BWV Anh. 114): spuds.thursdaycontra.com TuneSwap 0470, V:1 and its bass
  { id: "minuet-in-g", name: "Minuet in G", by: "Petzold", bpm: 112, time: "3/4", key: "G",
    chords: "G | G | C | G | Am | G | D:1 G:2 | D | G | G | C | G | Am | G | D:1 G:1 D:1 | G",
    melody: "D5 G4:.5 A4:.5 B4:.5 C5:.5 | D5 G4 G4 | E5 C5:.5 D5:.5 E5:.5 F#5:.5 | G5 G4 G4 | C5 D5:.5 C5:.5 B4:.5 A4:.5 | B4 C5:.5 B4:.5 A4:.5 G4:.5 | F#4 G4:.5 A4:.5 B4:.5 G4:.5 | A4:3 | D5 G4:.5 A4:.5 B4:.5 C5:.5 | D5 G4 G4 | E5 C5:.5 D5:.5 E5:.5 F#5:.5 | G5 G4 G4 | C5 D5:.5 C5:.5 B4:.5 A4:.5 | B4 C5:.5 B4:.5 A4:.5 G4:.5 | A4 B4:.5 A4:.5 G4:.5 F#4:.5 | G4:3",
    lh: "[B2 D3]:2 A2 | B2:3 | C3:3 | B2:3 | A2:3 | G2:3 | D3 B2 G2 | D3 D2:.5 C3:.5 B2:.5 A2:.5 | [B2 D3]:2 A2 | B2:3 | C3:3 | B2:3 | A2:3 | G2:3 | C3 D3 D2 | G2:3",
    levels: { piano: "Intermediate", guitar: "Basic", trumpet: "Intermediate" }, lead: "piano" },
  // Moonlight Sonata, 1st movement, bars 1-9: ifdo.ca kern2abc beethoven_sonatas (the
  // triplets held as chords: a triplet can't be one line of the keys)
  { id: "moonlight-sonata", name: "Moonlight Sonata (1st mvt)", by: "Beethoven", bpm: 54, time: "4/4", key: "C#m",
    chords: "C#m | C#m/B | A:2 D/F#:2 | G#7:2 C#m/G#:1 G#7:1 | C#m | G#7/B# | C#m:2 F#m:2 | E/B:2 B7:2 | E",
    melody: "R:4 | R:4 | R:4 | R:4 | R:3 G#4:.75 G#4:.25 | G#4:3 G#4:.75 G#4:.25 | G#4:2 A4:2 | G#4:2 F#4 B4 | E4 R:3",
    lh: "[C#3 G#3 C#4 E4]:4 | [B2 G#3 C#4 E4]:4 | [A2 A3 C#4 E4]:2 [F#2 A3 D4 F#4]:2 | [G#2 G#3 B#3 F#4]:2 [G#2 G#3 C#4 E4]:1 [G#2 F#3 B#3 D#4]:1 | [C#3 G#3 C#4 E4]:4 | [B#2 G#3 D#4 F#4]:4 | [C#3 G#3 C#4 E4]:2 [F#2 A3 C#4 F#4]:2 | [B2 G#3 B3 E4]:2 [B2 A3 B3 D#4]:2 | [E2 G#3 B3 E4]:4",
    levels: { piano: "Expert", guitar: "Intermediate", trumpet: "Intermediate" }, lead: "piano" },
  // Maple Leaf Rag, A strain: John Chambers' lead sheet (in G); bars 7-8's climb an octave down onto the keys
  { id: "maple-leaf-rag", name: "Maple Leaf Rag", by: "Joplin", bpm: 96, time: "4/4", key: "G",
    chords: "G | D7 | G | D7 | Eb:2 D:2 | Eb:2 D:2 | Gm | Gm | Eb | G | Eb:2 G:2 | D7:2 G:2",
    melody: "R:.5 G4:.5 D5:.5 G4:.5 B4:.5 D5 G4:.5 | D5:.5 F#4:.5 A4:.5 D5:.5~ D5:2 | R:.5 G4:.5 D5:.5 G4:.5 B4:.5 D5 G4:.5 | D5:.5 F#4:.5 A4:.5 D5:.5~ D5:2 | R:.5 G4:.5 Bb4:.5 Eb5:.5 R:.5 D5 D5:.5 | R:.5 G4:.5 Bb4:.5 Eb5:.5 R:.5 D5:1.5 | G3:.5 Bb3:.5 D4:.5 G4:.5 Bb3:.5 D4:.5 G4:.5 Bb4:.5 | D4:.5 G4:.5 Bb4:.5 D5:.5 G4:.5 Bb4:.5 D5:.5 G5:.5 | G5 G5 G5 G5:.5 G5:.5~ | G5:.5 D5:.5 E5:.5 B4:.5 D5:.5 E5:1.5 | G4:.5 A4:.5 Bb4:.5 G4:.5 A4:.5 B4 G4:.5 | B4:.5 G4:.5 A4 G4 R:1",
    levels: { piano: "Expert", guitar: "Intermediate", trumpet: "Expert" }, lead: "piano" },

  /* ---- from the user's playlist ("The Most Beautiful Piano Pieces"), the public-domain ones */
  // Silent Night (Gruber): pghardy.net xmas tunebook 0051
  { id: "silent-night", name: "Silent Night", by: "Gruber", bpm: 60, time: "6/8", key: "C",
    chords: "C | C | G | C | F | C | F | C | G7 | C | C:1.5 G7:1.5 | C",
    melody: "G4:.75 A4:.25 G4:.5 E4:1.5 | G4:.75 A4:.25 G4:.5 E4 R:.5 | D5 D5:.5 B4:1.5 | C5 C5:.5 G4 R:.5 | A4 A4:.5 C5:.75 B4:.25 A4:.5 | G4:.75 A4:.25 G4:.5 E4 R:.5 | A4 A4:.5 C5:.75 B4:.25 A4:.5 | G4:.75 A4:.25 G4:.5 E4 R:.5 | D5 D5:.5 F5:.75 D5:.25 B4:.5 | C5:1.5 E5 R:.5 | C5:.5 G4:.5 E4:.5 G4:.75 F4:.25 D4:.5 | C4:3",
    levels: { piano: "Basic", guitar: "Basic", trumpet: "Basic" }, lead: "piano" },
  // Gymnopédie No. 1 (Satie): colinhume.com 0566, an octave down; the left hand his bass-chord-chord
  { id: "gymnopedie-1", name: "Gymnopédie No. 1", by: "Satie", bpm: 70, time: "3/4", key: "D",
    chords: "Gmaj7 | Dmaj7 | Gmaj7 | Dmaj7 | Gmaj7 | Dmaj7 | Gmaj7 | Dmaj7 | Gmaj7 | Dmaj7 | Gmaj7 | Dmaj7 | Gmaj7 | Dmaj7 | Gmaj7 | Dmaj7 | Gmaj7",
    melody: "R:1 F#4 A4 | G4 F#4 C#4 | B3 C#4 D4 | A3:3 | F#3:3~ | F#3:3~ | F#3:3~ | F#3:3 | R:1 F#4 A4 | G4 F#4 C#4 | B3 C#4 D4 | A3:3 | C#4:3 | F#4:3 | E3:3~ | E3:3~ | E3:3",
    levels: { piano: "Intermediate", guitar: "Intermediate", trumpet: "Basic" }, lead: "piano" },
  // Gnossienne No. 1 (Satie): colinhume.com 0525 (in E minor)
  { id: "gnossienne-1", name: "Gnossienne No. 1", by: "Satie", bpm: 100, time: "4/4", key: "Em",
    chords: "Em | Em | Em | Em | Em | Em | Bm | Em | Em",
    melody: "R:1 B4:.5 D5:.5 C#5 B4 | A#4:2 A#4:2 | R:1 B4:.5 D5:.5 C#5 B4 | E5:2 E5:2 | R:1 B4:.5 D5:.5 C#5 B4 | A#4:2 F#4:2 | F#4 F#4:2.5 R:.5 | F#4 E4:3~ | E4:4",
    levels: { piano: "Intermediate", guitar: "Basic", trumpet: "Intermediate" }, lead: "piano" },
  // Prelude in C, BWV 846 (Bach), bars 1-8: Mutopia wtk1-prelude1 (at the pitch it's played)
  { id: "bach-prelude-c", name: "Prelude in C (BWV 846)", by: "J. S. Bach", bpm: 66, time: "4/4", key: "C",
    chords: "C | Dm7/C | G7/B | C | Am/C | D7/C | G/B | Cmaj7/B",
    melody: [["G3", "C4", "E4"], ["A3", "D4", "F4"], ["G3", "D4", "F4"], ["G3", "C4", "E4"], ["A3", "E4", "A4"], ["F#3", "A3", "D4"], ["G3", "D4", "G4"], ["E3", "G3", "C4"]].map(bachBar).join(" | "),
    lh: "[C3 E3]:2 [C3 E3]:2 | [C3 D3]:2 [C3 D3]:2 | [B2 D3]:2 [B2 D3]:2 | [C3 E3]:2 [C3 E3]:2 | [C3 E3]:2 [C3 E3]:2 | [C3 D3]:2 [C3 D3]:2 | [B2 D3]:2 [B2 D3]:2 | [B2 C3]:2 [B2 C3]:2",
    levels: { piano: "Intermediate", guitar: "Expert", trumpet: "Expert" }, lead: "piano" },
  // Prelude in E minor, Op. 28 No. 4 (Chopin), bars 1-8: ifdo.ca kern2abc, the first edition
  { id: "chopin-prelude-e-minor", name: "Prelude in E minor (Op. 28 No. 4)", by: "Chopin", bpm: 63, time: "4/4", key: "Em", pickup: 1,
    chords: " | Em | F#m7b5:2 B7:2 | F7:2 Dm:1 E7/D:1 | E7:2 Em7:1 A7/E:1 | C/E | D7/E:2 B7/D#:2 | D7 | G7/D",
    melody: "B3:.75 B4:.25 | B4:3 C5 | B4:3 C5 | B4:3 C5 | B4:3 Bb4 | A4:3 B4 | A4:3 B4 | A4:3 B4:.75 A4:.25 | A4:3 G#4",
    lh: `R:1 | ${R8("[G3 B3 E4]")} | ${R4("[F#3 A3 E4]")} ${R4("[F#3 A3 Eb4]")} | ${R4("[F3 A3 Eb4]")} [F3 A3 D4]:.5 [F3 A3 D4]:.5 [F3 G#3 D4]:.5 [F3 G#3 D4]:.5 | ${R4("[E3 G#3 D4]")} [E3 G3 D4]:.5 [E3 G3 D4]:.5 [E3 G3 C#4]:.5 [E3 G3 C#4]:.5 | ${R4("[E3 G3 C4]")} ${R4("[E3 F#3 C4]")} | ${R4("[E3 F#3 C4]")} ${R4("[D#3 F#3 C4]")} | ${R8("[D3 F#3 C4]")} | ${R4("[D3 F3 C4]")} ${R4("[D3 F3 B3]")}`,
    levels: { piano: "Intermediate", guitar: "Intermediate", trumpet: "Basic" }, lead: "piano" },
  // Clair de Lune (Debussy), bars 1-8, the right hand's top line and its thirds:
  // Mutopia debussy_Ste_Bergamesq_Clair, an octave down onto the keys
  { id: "clair-de-lune", name: "Clair de Lune", by: "Debussy", bpm: 60, time: "9/8", key: "Db",
    chords: "Db | Gbm/Db | Db | Ab/C | Db:3 C7:1.5 | Bbm:3 F7/A:1.5 | Ab:3 Gb:1.5 | Fm:3 Eb7:1.5",
    melody: "R:.5 [F3 Ab3]:.5 [F4 Ab4]:2 [Db4 F4]:1.5~ | [Db4 F4]:.5 [C4 Eb4]:.5 [Db4 F4]:.5 [C4 Eb4]:3~ | [C4 Eb4]:.5 [Bb3 Db4]:.5 [C4 Eb4]:.5 Db4:.75 F4:.75~ F4:.75 Db4:.75~ | Db4:.5 [Ab3 C4]:.5 [Bb3 Db4]:.5 [Ab3 C4]:3~ | C4:.5 Bb3:.5 C4:.5 Bb3:.5 Eb4:.5 Bb3:.5 Ab3:.5 Bb3:.5 Ab3:.5~ | Ab3:.5 Gb3:.5 Ab3:.5 Gb3:1.5 F3:1.5~ | F3:.5 F3:.5 Gb3:.5 F3:.5 Bb3:.5 F3:.5 Eb3:.5 F3:.5 Eb3:.5~ | Eb3:.5 Db3:.5 Eb3:.5 Db3:1.5 C3:1.5",
    lh: "R:4.5 | R:4.5 | R:4.5 | R:4.5 | Db3:3 C3:1.5 | Bb2:3 A2:1.5 | Ab2:3 Gb2:1.5 | F2:3 Eb2:1.5",
    levels: { piano: "Expert", guitar: "Intermediate", trumpet: "Intermediate" }, lead: "piano" },
  // Nocturne Op. 9 No. 2 (Chopin), bars 1-3: ifdo.ca kern2abc, the first edition (its
  // bar 4 run reads ambiguously in the source, so it stops before it), an octave down
  { id: "chopin-nocturne-op9-2", name: "Nocturne (Op. 9 No. 2)", by: "Chopin", bpm: 69, time: "12/8", key: "Eb", pickup: 0.5,
    chords: " | Eb:3 Ab/Eb:3 | C7:3 Fm:3 | Bb7:3 Eb:1.5 Cm:1.5",
    melody: "Bb3:.5 | G4:2 F4:.5 G4:.5 F4:1.5 Eb4 Bb3:.5 | G4 C4:.5 C5 G4:.5 Bb4:1.5 Ab4 G4:.5 | F4:1.5 G4 D4:.5 Eb4:1.5 C4:1.5",
    levels: { piano: "Expert", guitar: "Intermediate", trumpet: "Expert" }, lead: "piano" },
  // Rondo alla Turca (Mozart, K. 331), the opening: ifdo.ca kern2abc mozart_sonatas, an octave down
  { id: "rondo-alla-turca", name: "Rondo alla Turca", by: "Mozart", bpm: 116, time: "2/4", key: "Am", pickup: 1,
    chords: " | Am | Am | Am | Am | E | E | E | E",
    melody: "B3:.25 A3:.25 G#3:.25 A3:.25 | C4:.5 R:.5 D4:.25 C4:.25 B3:.25 C4:.25 | E4:.5 R:.5 F4:.25 E4:.25 D#4:.25 E4:.25 | B4:.25 A4:.25 G#4:.25 A4:.25 B4:.25 A4:.25 G#4:.25 A4:.25 | C5 A4:.5 C5:.5 | B4:.5 [F#4 A4]:.5 [E4 G4]:.5 [F#4 A4]:.5 | B4:.5 [F#4 A4]:.5 [E4 G4]:.5 [F#4 A4]:.5 | B4:.5 [F#4 A4]:.5 [E4 G4]:.5 [D#4 F#4]:.5 | E4",
    levels: { piano: "Expert", guitar: "Intermediate", trumpet: "Expert" }, lead: "piano" },
);

/* The songs listed under `level` for `kind` (by that instrument's part). */
export const songsFor = (kind, level) => SONGS.map((s, i) => ({ s, i })).filter(({ s }) => s.levels[kind] === level);
