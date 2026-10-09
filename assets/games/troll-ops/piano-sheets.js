// Troll Forces — sheet music for the saloon piano (user, 2026-10-07: "users
// should actually be able to play the piano. they should have music sheets
// as well to be able to reference to to play from simple to complex
// pieces").
//
// Every piece is public domain: nursery tunes, folk songs, Beethoven,
// Joplin, Pachelbel, plus the right hands of the saloon's own three tunes
// (rp-roles.js TUNES). A sheet is bars split by "|", each note "C4" (one
// beat) or "C4:2" (two). The piano panel (menu/piano-panel.js) plays C3 to
// G5 off the keyboard, so everything here sits in that range.

import { TUNES, noteMidi } from "./rp-roles.js?v=rp1b7-cd1";

export const LOW = 48;    // C3
export const HIGH = 79;   // G5

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export function midiName(m) { return `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`; }

export const SHEETS = [
  { level: "Easy", name: "Hot Cross Buns", bpm: 100,
    notes: "E4 D4 C4:2 | E4 D4 C4:2 | C4:.5 C4:.5 C4:.5 C4:.5 D4:.5 D4:.5 D4:.5 D4:.5 | E4 D4 C4:2" },
  { level: "Easy", name: "Mary Had a Little Lamb", bpm: 110,
    notes: "E4 D4 C4 D4 | E4 E4 E4:2 | D4 D4 D4:2 | E4 G4 G4:2 | E4 D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4:4" },
  { level: "Easy", name: "Twinkle, Twinkle", bpm: 100,
    notes: "C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2" },
  { level: "Medium", name: "Ode to Joy", bpm: 112,
    notes: "E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:.5 D4:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 | D4 D4 E4 C4 | D4 E4:.5 F4:.5 E4 C4 | D4 E4:.5 F4:.5 E4 D4 | C4 D4 G3:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2" },
  { level: "Medium", name: "Jingle Bells", bpm: 130,
    notes: "E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4:1.5 D4:.5 | E4:4 | F4 F4 F4:1.5 F4:.5 | F4 E4 E4 E4:.5 E4:.5 | E4 D4 D4 E4 | D4:2 G4:2 | E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4:1.5 D4:.5 | E4:4 | F4 F4 F4 F4 | F4 E4 E4 E4:.5 E4:.5 | G4 G4 F4 D4 | C4:4" },
  { level: "Medium", name: "Oh! Susanna", bpm: 120,
    notes: "C4:.5 D4:.5 | E4 G4 G4:1.5 A4:.5 | G4 E4 C4:1.5 D4:.5 | E4 E4 D4 C4 | D4:3 C4:.5 D4:.5 | E4 G4 G4:1.5 A4:.5 | G4 E4 C4:1.5 D4:.5 | E4 E4 D4 D4 | C4:4" },
  { level: "Hard", name: "Für Elise", bpm: 132,
    notes: "E5:.5 D#5:.5 | E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 | A4:1.5 C4:.5 E4:.5 A4:.5 | B4:1.5 E4:.5 G#4:.5 B4:.5 | C5:1.5 E4:.5 E5:.5 D#5:.5 | E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 | A4:1.5 C4:.5 E4:.5 A4:.5 | B4:1.5 E4:.5 C5:.5 B4:.5 | A4:3" },
  { level: "Hard", name: "The Entertainer", bpm: 100,
    notes: "D4:.5 D#4:.5 | E4:.5 C5 E4:.5 C5 E4:.5 C5:2.5 | C5:.5 D5:.5 D#5:.5 E5:.5 C5:.5 D5:.5 E5 B4:.5 D5 C5:2 | D4:.5 D#4:.5 E4:.5 C5 E4:.5 C5 E4:.5 C5:2.5 | A4:.5 G4:.5 F#4:.5 A4:.5 C5:.5 E5 D5:.5 C5:.5 A4:.5 D5:2" },
  { level: "Hard", name: "Canon in D", bpm: 80,
    notes: "F#4 E4 D4 C#4 | B3 A3 B3 C#4 | D4 C#4 B3 A3 | G3 F#3 G3 E3 | D3:.5 F#3:.5 A3:.5 G3:.5 F#3:.5 D3:.5 F#3:.5 E3:.5 | D3:.5 B3:.5 D3:.5 A3:.5 G3:.5 B3:.5 A3:.5 G3:.5 | F#3:.5 D3:.5 E3:.5 C#4:.5 D4:.5 F#4:.5 A4:.5 A3:.5 | B3:.5 G3:.5 A3:.5 F#3:.5 D3:.5 D4:.5 D4:1" },
];

/* The saloon's own tunes, their right hands an octave down so they fit the
   keys: the house set, at medium and hard. */
for (const [i, tune] of TUNES.entries()) {
  const bars = tune.bars.map(([, line]) => {
    const tok = line.trim().split(/\s+/), out = [];
    for (let k = 0; k + 1 < tok.length; k += 2) {
      const m = noteMidi(tok[k]);
      if (m != null) out.push(`${midiName(m - 12)}:${tok[k + 1]}`);
    }
    return out.join(" ");
  });
  SHEETS.push({ level: i === 1 ? "Medium" : "Hard", name: `${tune.name} (house)`, bpm: Math.round(tune.bpm * 0.6), notes: bars.join(" | ") });
}

/* A sheet as bars of { midi, beats, name }, every note clamped into the
   keys' range by octaves. */
export function sheetBars(sheet) {
  return sheet.notes.split("|").map((bar) => bar.trim().split(/\s+/).filter(Boolean).map((tok) => {
    const [n, b] = tok.split(":");
    let midi = noteMidi(n);
    while (midi < LOW) midi += 12;
    while (midi > HIGH) midi -= 12;
    return { midi, beats: b ? +b : 1, name: midiName(midi) };
  }));
}
