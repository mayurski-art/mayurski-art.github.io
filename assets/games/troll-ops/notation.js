// Troll Forces — sheet music, drawn (BAND.md). A song's part as real staff
// notation in SVG: staves, clefs, key and time signatures, noteheads, stems,
// flags and beams, dots, ties, rests, accidentals, ledger lines; the piano
// on a grand staff, chord names over the guitar's slashes (strums) and the
// piano's tune, the trumpet's valves under its notes at Basic.
//
// No music font: clefs, accidentals and arrows are all drawn as paths (the
// ♯ ♭ ♮ characters fall back to colour emoji fonts on some devices).
// Everything is a string, like the game's other SVG
// (medals.js badgeSvg). Each note the player plays is a
// <g class="nt" data-i="n">, n counting as songs.js playNotes() does, so
// the panel can light the next one.

import { songParts, splitBeats } from "./songs.js?v=sg1";

const SP = 8;              // a staff space
const STAFF = 4 * SP;      // bottom line to top line
const W = 720;             // the drawing's width
const STEM = 3.5 * SP;
const MIN_STEM = 2.75 * SP;
const CLEF_BASE = { treble: 30, treble8: 30, bass: 18 };   // the bottom line's diatonic step (E4, G2)
const MIDDLE = { treble: 34, treble8: 34, bass: 22 };      // B4, D3
const KEY_COUNT = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5,
  Am: 0, Em: 1, Bm: 2, "F#m": 3, "C#m": 4, Dm: -1, Gm: -2, Cm: -3, Fm: -4 };
const SHARP_STEPS = [38, 35, 39, 36, 33, 37, 34];   // F5 C5 G5 D5 A4 E5 B4 on the treble staff
const FLAT_STEPS = [34, 37, 33, 36, 32, 35, 31];    // B4 E5 A4 D5 G4 C5 F4
const INK = "#2a170c";

/* The key's sharps or flats, by letter: { F: 1, C: 1 } or { B: -1, E: -1 }. */
function keyAlter(key) {
  const n = KEY_COUNT[key] ?? 0, out = {};
  if (n > 0) for (const l of "FCGDAEB".slice(0, n)) out[l] = 1;
  if (n < 0) for (const l of "BEADGCF".slice(0, -n)) out[l] = -1;
  return out;
}

/* Trumpet valves for a note as it sounds (a trumpet in C): "0", "1", "12"... */
const VALVES = {
  54: "123", 55: "13", 56: "23", 57: "12", 58: "1", 59: "2",
  60: "0", 61: "123", 62: "13", 63: "23", 64: "12", 65: "1", 66: "2", 67: "0", 68: "23", 69: "12", 70: "1", 71: "2",
  72: "0", 73: "12", 74: "1", 75: "2", 76: "0", 77: "1", 78: "2", 79: "0",
};
export const valves = (midi) => VALVES[midi] ?? "–";

/* ------------------------------------------------------------ glyphs */

const f1 = (v) => Math.round(v * 10) / 10;
const TREBLE_CLEF = "M4 22C0 24-2 18 2 17C5 16 6 20 4 22C8 18 8 6 6-6C5-14 6-22 10-26C13-29 14-22 11-16C6-8-2-2-2 6C-2 13 4 16 9 14C14 12 14 4 9 2C4 0 0 4 2 8";
function clefSvg(clef, x, top) {
  if (clef === "bass") {
    const y = top + SP;   // the F line
    return `<g transform="translate(${f1(x + 4)} ${f1(y)})" fill="${INK}" stroke="${INK}">`
      + `<path d="M-1 0C-1-6 7-8 10-4C13 0 10 9-2 15" fill="none" stroke-width="2.2"/><circle cx="-1" cy="0" r="2.6" stroke="none"/>`
      + `<circle cx="15" cy="-3.5" r="1.4" stroke="none"/><circle cx="15" cy="3.5" r="1.4" stroke="none"/></g>`;
  }
  const y = top + 3 * SP;   // the G line
  return `<g transform="translate(${f1(x + 6)} ${f1(y)})"><path d="${TREBLE_CLEF}" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>`
    + (clef === "treble8" ? `<text x="2" y="36" font-size="10" font-weight="700" fill="${INK}" text-anchor="middle" font-family="Georgia,serif">8</text>` : "") + "</g>";
}
/* A sharp, flat or natural centred on (x, y): y is the note's line/space. */
function accSvg(acc, x, y) {
  const P = (d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-linecap="butt"`;
  if (acc > 0) {
    // two uprights, two thick bars rising to the right
    return P(`M${f1(x - 2)} ${f1(y - 8)}L${f1(x - 2)} ${f1(y + 9)}M${f1(x + 2)} ${f1(y - 9)}L${f1(x + 2)} ${f1(y + 8)}`) + ` stroke-width="1.1"/>`
      + P(`M${f1(x - 4.5)} ${f1(y - 2)}L${f1(x + 4.5)} ${f1(y - 4.5)}M${f1(x - 4.5)} ${f1(y + 4.5)}L${f1(x + 4.5)} ${f1(y + 2)}`) + ` stroke-width="2.3"/>`;
  }
  if (acc < 0) {
    // an upright with a bowl at the bottom
    return P(`M${f1(x - 3)} ${f1(y - 13)}L${f1(x - 3)} ${f1(y + 4)}C${f1(x + 1)} ${f1(y + 1)} ${f1(x + 5)} ${f1(y - 1)} ${f1(x + 4)} ${f1(y - 3.5)}C${f1(x + 3)} ${f1(y - 6)} ${f1(x - 1)} ${f1(y - 4)} ${f1(x - 3)} ${f1(y - 1.5)}`) + ` stroke-width="1.4"/>`;
  }
  // natural: offset uprights, two bars
  return P(`M${f1(x - 2.5)} ${f1(y - 9)}L${f1(x - 2.5)} ${f1(y + 4)}M${f1(x + 2.5)} ${f1(y - 4)}L${f1(x + 2.5)} ${f1(y + 9)}`) + ` stroke-width="1.1"/>`
    + P(`M${f1(x - 2.5)} ${f1(y - 1.5)}L${f1(x + 2.5)} ${f1(y - 3)}M${f1(x - 2.5)} ${f1(y + 3.5)}L${f1(x + 2.5)} ${f1(y + 2)}`) + ` stroke-width="2.2"/>`;
}
/* A strum's direction under the slash: drawn, not a font's arrow (some
   fonts make those emoji). */
function arrowSvg(up, x, y) {
  const d = up ? -1 : 1, tip = y + 6 * d, tail = y - 6 * d;
  return `<path d="M${f1(x)} ${f1(tail)}L${f1(x)} ${f1(tip)}M${f1(x - 3.5)} ${f1(tip - 4 * d)}L${f1(x)} ${f1(tip)}L${f1(x + 3.5)} ${f1(tip - 4 * d)}" fill="none" stroke="#7a1f1f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function restSvg(beats, x, top) {
  const mid = top + 2 * SP;
  const base = beats >= 3.99 ? 4 : beats >= 1.99 ? 2 : beats >= 0.99 ? 1 : beats >= 0.49 ? 0.5 : 0.25;
  const dotted = [3, 1.5, 0.75].some((d) => Math.abs(d - beats) < 1e-6);
  let s = "";
  if (base === 4) s = `<rect x="${f1(x - 5)}" y="${f1(top + SP)}" width="10" height="4" fill="${INK}"/>`;
  else if (base === 2) s = `<rect x="${f1(x - 5)}" y="${f1(mid - 4)}" width="10" height="4" fill="${INK}"/>`;
  else if (base === 1) s = `<path d="M${f1(x - 2)} ${f1(mid - 12)}L${f1(x + 3)} ${f1(mid - 6)}L${f1(x - 1)} ${f1(mid - 1)}L${f1(x + 3)} ${f1(mid + 5)}C${f1(x - 2)} ${f1(mid + 3)} ${f1(x - 3)} ${f1(mid + 7)} ${f1(x + 1)} ${f1(mid + 10)}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
  else {
    const flags = base === 0.5 ? 1 : 2;
    for (let k = 0; k < flags; k++) {
      const y = mid - 4 + k * 7;
      s += `<circle cx="${f1(x - 2.5)}" cy="${f1(y)}" r="2.2" fill="${INK}"/><path d="M${f1(x - 2.5)} ${f1(y + 1)}C${f1(x)} ${f1(y + 2)} ${f1(x + 3)} ${f1(y)} ${f1(x + 4)} ${f1(y - 2)}" fill="none" stroke="${INK}" stroke-width="1.3"/>`;
    }
    s += `<path d="M${f1(x + 4)} ${f1(mid - 6)}L${f1(x - 1)} ${f1(mid + 8 + (flags - 1) * 7)}" stroke="${INK}" stroke-width="1.4"/>`;
  }
  if (dotted) s += `<circle cx="${f1(x + 8)}" cy="${f1(mid - SP / 2)}" r="1.6" fill="${INK}"/>`;
  return s;
}

/* -------------------------------------------------------- the events */

/* A staff's events as drawn: long notes that one note can't show become
   tied pieces; `play` is the playNotes() index of a played note's first
   piece (or -1). */
function displayEvents(staff, barBeats) {
  const bars = [];
  let idx = 0, tiedPrev = false;
  for (const bar of staff.bars) {
    const out = [];
    // a bar of nothing: one whole-bar rest, whatever the metre (as scores do)
    if (bar.length === 1 && bar[0].rest && Math.abs(bar[0].beats - barBeats) < 1e-6) {
      out.push({ ...bar[0], tie: false, play: -1, cont: false, full: true });
      bars.push(out);
      tiedPrev = false;
      continue;
    }
    for (const ev of bar) {
      const pieces = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25].some((d) => Math.abs(d - ev.beats) < 1e-6) ? [ev.beats] : (splitBeats(ev.beats) || [ev.beats]);
      let at = ev.at;
      const first = !ev.rest && !tiedPrev ? idx++ : -1;
      pieces.forEach((b, k) => {
        out.push({ ...ev, at, beats: b, tie: ev.rest ? false : k < pieces.length - 1 || ev.tie, play: k === 0 ? first : -1, cont: k > 0 || (!ev.rest && tiedPrev) });
        at += b;
      });
      tiedPrev = !ev.rest && ev.tie;
    }
    bars.push(out);
  }
  return bars;
}

/* ------------------------------------------------------------- a part */

/* The part `kind` of `song` as SVG. Returns { svg, layout }: layout.systems
   [{ top, height, bars: [{ beat0, beat1, x0, x1 }] }] for the playhead,
   layout.notes [index] -> { x, sys }. opts: { fingering, arrows, chords }
   (defaults by level). */
export function scoreSvg(song, kind) {
  const P = songParts(song);
  const level = song.levels[kind];
  const staves = kind === "piano" ? [P.parts.piano.rh, P.parts.piano.lh] : [P.parts[kind]];
  const drawn = staves.map((st) => displayEvents(st, P.meter.barBeats));
  const m = P.meter;
  const alter = keyAlter(song.key);
  const keyN = Math.abs(KEY_COUNT[song.key] ?? 0);
  const showChords = kind === "guitar" || (kind === "piano" && level !== "Expert");
  const fingering = kind === "trumpet" && level === "Basic";
  const arrows = kind === "guitar" && level !== "Expert";

  // bar widths: enough room for the busiest staff, beat-proportional so the
  // two piano staves line up
  const barW = P.parts.piano.rh.bars.map((_, bi) => {
    const len = drawn[0][bi].reduce((t, e) => t + e.beats, 0) || m.barBeats;
    const minB = Math.min(...drawn.map((d) => Math.min(...d[bi].map((e) => e.beats))));
    const perBeat = Math.min(72, Math.max(30, 19 / minB));
    return Math.max(60, len * perBeat + 22);
  });

  // systems: as many bars as fit (at most 4), stretched to the width
  const prefixW = (first) => 34 + keyN * 9 + (first ? 22 : 0) + 6;
  const systems = [];
  let bi = 0;
  while (bi < barW.length) {
    const first = !systems.length;
    const room = W - 8 - prefixW(first);
    const bars = [];
    let used = 0;
    while (bi < barW.length && bars.length < 4 && (used + barW[bi] <= room || !bars.length)) { bars.push(bi); used += barW[bi]; bi++; }
    const last = bi >= barW.length;
    const k = last && used < room * 0.7 ? Math.min(1.25, room / used) : room / used;
    systems.push({ bars, first, scale: k, prefix: prefixW(first) });
  }

  const grand = staves.length === 2;
  const above = showChords ? 30 : 22, below = fingering || arrows ? 34 : 24;
  const staffGap = 46;
  const sysH = above + STAFF + (grand ? staffGap + STAFF : 0) + below + 10;
  const layout = { systems: [], notes: [], width: W, height: systems.length * sysH };
  let svg = "", lastChord = null;

  systems.forEach((sys, si) => {
    const y0 = si * sysH + above;
    const tops = grand ? [y0, y0 + STAFF + staffGap] : [y0];
    let x = 4;
    const xEnd = x + sys.prefix + sys.bars.reduce((t, b) => t + barW[b] * sys.scale, 0);
    // staff lines, the brace, clefs, key, time
    tops.forEach((top, st) => {
      for (let l = 0; l < 5; l++) svg += `<line x1="${x}" y1="${top + l * SP}" x2="${f1(xEnd)}" y2="${top + l * SP}" stroke="${INK}" stroke-width="0.9" opacity=".8"/>`;
      const clef = staves[st].clef;
      svg += clefSvg(clef, x + 2, top);
      const shift = clef === "bass" ? -14 : 0;
      const n = KEY_COUNT[song.key] ?? 0;
      for (let k = 0; k < keyN; k++) {
        const step = (n > 0 ? SHARP_STEPS : FLAT_STEPS)[k] + shift;
        svg += accSvg(n > 0 ? 1 : -1, x + 34 + k * 9, top + STAFF - (step - CLEF_BASE[clef]) * SP / 2);
      }
      if (sys.first) {
        const tx = x + 34 + keyN * 9 + 9;
        svg += `<text x="${tx}" y="${top + 15}" font-size="17" font-weight="800" text-anchor="middle" fill="${INK}" font-family="Georgia,serif">${m.num}</text>`
          + `<text x="${tx}" y="${top + 31}" font-size="17" font-weight="800" text-anchor="middle" fill="${INK}" font-family="Georgia,serif">${m.den}</text>`;
      }
    });
    if (grand) svg += `<path d="M${x - 1} ${y0}C${x - 6} ${y0 + 20} ${x + 2} ${y0 + STAFF + staffGap / 2 - 6} ${x - 4} ${y0 + STAFF + staffGap / 2}C${x + 2} ${y0 + STAFF + staffGap / 2 + 6} ${x - 6} ${tops[1] + STAFF - 20} ${x - 1} ${tops[1] + STAFF}" fill="none" stroke="${INK}" stroke-width="1.6"/>`
      + `<line x1="${x}" y1="${y0}" x2="${x}" y2="${tops[1] + STAFF}" stroke="${INK}" stroke-width="1.2"/>`;
    x += sys.prefix;
    const sysLayout = { top: si * sysH, height: sysH, bars: [] };
    lastChord = null;   // each line names its chord again
    for (const b of sys.bars) {
      const w = barW[b] * sys.scale;
      const len = drawn[0][b].reduce((t, e) => t + e.beats, 0) || m.barBeats;
      const beat0 = drawn[0][b][0]?.at ?? 0;
      const xs = (at) => x + 14 + ((at - beat0) / len) * (w - 24);
      sysLayout.bars.push({ beat0, beat1: beat0 + len, x0: xs(beat0), x1: xs(beat0 + len) });
      // the chord names over the top staff
      if (showChords) {
        for (const c of P.chords[b] || []) {
          if (!c.chord || c.chord.name === lastChord) continue;
          lastChord = c.chord.name;
          svg += `<text x="${f1(xs(beat0 + (b === 0 && song.pickup ? 0 : c.at)))}" y="${y0 - 12}" font-size="12.5" font-weight="700" fill="#7a1f1f" font-family="'DM Sans',sans-serif">${c.chord.name}</text>`;
        }
      }
      tops.forEach((top, st) => {
        svg += barSvg(drawn[st][b], staves[st].clef, top, xs, alter, { fingering: fingering && st === 0, arrows: arrows && st === 0, layout, si, marks: st === 0, group: m.group, beat0 });
      });
      x += w;
      // the bar line (both staves on a grand staff); a double one at the end
      const yb = grand ? tops[1] + STAFF : y0 + STAFF;
      if (b === barW.length - 1) svg += `<line x1="${f1(x - 5)}" y1="${y0}" x2="${f1(x - 5)}" y2="${yb}" stroke="${INK}" stroke-width="1"/><line x1="${f1(x - 1.5)}" y1="${y0}" x2="${f1(x - 1.5)}" y2="${yb}" stroke="${INK}" stroke-width="3.2"/>`;
      else svg += `<line x1="${f1(x)}" y1="${y0}" x2="${f1(x)}" y2="${yb}" stroke="${INK}" stroke-width="1"/>`;
    }
    layout.systems.push(sysLayout);
  });
  const svgOut = `<svg class="to-score-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${layout.height}" width="100%" role="img" aria-label="${esc(song.name)}, ${kind} part">`
    + `<line class="to-playhead" x1="0" y1="0" x2="0" y2="0" stroke="#e0ad4f" stroke-width="3" opacity="0"/>${svg}</svg>`;
  return { svg: svgOut, layout };
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* Where beat `beat` falls: { sys, x } (for the playhead), or null. */
export function beatX(layout, beat) {
  for (let si = 0; si < layout.systems.length; si++) {
    for (const b of layout.systems[si].bars) {
      if (beat >= b.beat0 - 1e-6 && beat < b.beat1 - 1e-6) return { sys: si, x: b.x0 + ((beat - b.beat0) / (b.beat1 - b.beat0)) * (b.x1 - b.x0) };
    }
  }
  return null;
}

/* ------------------------------------------------------------- a bar */

function barSvg(evs, clef, top, xs, alter, o) {
  const base = CLEF_BASE[clef];
  const yOf = (step) => top + STAFF - (step - base) * SP / 2;
  const onLine = (step) => (step - base) % 2 === 0;
  const barAcc = new Map();
  let s = "";
  // stems: each event's direction, beamed groups agreeing
  const flagged = (e) => !e.rest && e.beats < 0.99;
  // a beam spans one beat: a quarter, a dotted quarter in 6/8, an eighth in 3/8
  const groupOf = (e) => Math.floor((e.at - o.beat0) / o.group + 1e-6);
  const info = evs.map((e) => {
    if (e.rest) return null;
    const steps = e.strum ? [MIDDLE[clef]] : e.notes.map((p) => p.step);
    const avg = steps.reduce((t, v) => t + v, 0) / steps.length;
    return { steps, up: avg < MIDDLE[clef], hi: Math.max(...steps), lo: Math.min(...steps) };
  });
  // beam groups: runs of flagged notes inside one beat
  const groups = [];
  let cur = null;
  evs.forEach((e, i) => {
    if (flagged(e) && cur && cur.g === groupOf(e) && cur.last === i - 1) { cur.items.push(i); cur.last = i; }
    else if (flagged(e)) { cur = { g: groupOf(e), items: [i], last: i }; groups.push(cur); }
    else cur = null;
  });
  const inBeam = new Map();
  for (const g of groups) {
    if (g.items.length < 2) continue;
    const avg = g.items.reduce((t, i) => t + (info[i].hi + info[i].lo) / 2, 0) / g.items.length;
    const up = avg < MIDDLE[clef];
    for (const i of g.items) info[i].up = up;
    // the beam line: through the end stems' natural tips, tilted a little,
    // moved clear of every head
    const tip = (i) => (up ? yOf(info[i].hi) - STEM : yOf(info[i].lo) + STEM);
    const sx = (i) => xs(evs[i].at) + (up ? 5.2 : -5.2);
    const a = g.items[0], z = g.items[g.items.length - 1];
    let slope = (tip(z) - tip(a)) / Math.max(1, sx(z) - sx(a));
    slope = Math.max(-0.12, Math.min(0.12, slope));
    let y0 = tip(a);
    for (const i of g.items) {
      const by = y0 + slope * (sx(i) - sx(a));
      const head = up ? yOf(info[i].hi) : yOf(info[i].lo);
      if (up && by > head - MIN_STEM) y0 -= by - (head - MIN_STEM);
      if (!up && by < head + MIN_STEM) y0 += head + MIN_STEM - by;
    }
    const by = (i) => y0 + slope * (sx(i) - sx(a));
    for (const i of g.items) inBeam.set(i, by(i));
    const th = up ? 4 : -4;
    s += `<path d="M${f1(sx(a))} ${f1(by(a))}L${f1(sx(z))} ${f1(by(z))}L${f1(sx(z))} ${f1(by(z) + th)}L${f1(sx(a))} ${f1(by(a) + th)}Z" fill="${INK}"/>`;
    // sixteenths: a second beam between neighbours, a stub when alone
    const off = up ? 6.5 : -6.5;
    g.items.forEach((i, k) => {
      if (evs[i].beats > 0.26) return;
      const nb = g.items[k + 1], pv = g.items[k - 1];
      let xa, xb;
      if (nb != null && evs[nb].beats <= 0.26) { xa = sx(i); xb = sx(nb); }
      else if (pv != null && evs[pv].beats <= 0.26) return;
      else if (nb != null) { xa = sx(i); xb = sx(i) + 8; }
      else { xa = sx(i) - 8; xb = sx(i); }
      const ya = y0 + slope * (xa - sx(a)) + off, yb = y0 + slope * (xb - sx(a)) + off;
      s += `<path d="M${f1(xa)} ${f1(ya)}L${f1(xb)} ${f1(yb)}L${f1(xb)} ${f1(yb + th)}L${f1(xa)} ${f1(ya + th)}Z" fill="${INK}"/>`;
    });
  }

  evs.forEach((e, i) => {
    const x = xs(e.at);
    if (e.rest) { s += e.full ? restSvg(4, x + (xs(e.at + e.beats) - x) / 2 - 7, top) : restSvg(e.beats, x, top); return; }
    const I = info[i];
    const hollow = e.beats >= 1.99;
    const dotted = [3, 1.5, 0.75].some((d) => Math.abs(d - e.beats) < 1e-6);
    let g = "";
    // ledger lines
    const addLedgers = (step) => {
      for (let st = base - 2; st >= step; st -= 2) g += `<line x1="${f1(x - 9)}" y1="${f1(yOf(st))}" x2="${f1(x + 9)}" y2="${f1(yOf(st))}" stroke="${INK}" stroke-width="1.1"/>`;
      for (let st = base + 10; st <= step; st += 2) g += `<line x1="${f1(x - 9)}" y1="${f1(yOf(st))}" x2="${f1(x + 9)}" y2="${f1(yOf(st))}" stroke="${INK}" stroke-width="1.1"/>`;
    };
    if (e.strum) {
      const y = yOf(MIDDLE[clef]);
      g += `<path class="hd${hollow ? " hollow" : ""}" d="M${f1(x - 5.5)} ${f1(y + 4)}L${f1(x - 1.5)} ${f1(y + 4)}L${f1(x + 5.5)} ${f1(y - 4)}L${f1(x + 1.5)} ${f1(y - 4)}Z" fill="${hollow ? "none" : INK}" stroke="${INK}" stroke-width="1.4"/>`;
      if (o.arrows) g += arrowSvg(e.strum === "U", x, top + STAFF + 15);
    } else {
      // seconds in a chord sit side by side
      const steps = [...I.steps].sort((p, q) => p - q);
      steps.forEach((st, k) => {
        addLedgers(st);
        const p = e.notes.find((n) => n.step === st);
        const second = k > 0 && st - steps[k - 1] === 1;
        const hx = x + (second ? 11 : 0);
        // the accidental, if the key and the bar so far don't give it
        const curA = barAcc.has(st) ? barAcc.get(st) : alter[p.letter] || 0;
        if (!e.cont && p.acc !== curA) { g += accSvg(p.acc, x - 12, yOf(st)); barAcc.set(st, p.acc); }
        else if (e.cont) barAcc.set(st, p.acc);
        g += `<ellipse class="hd${hollow ? " hollow" : ""}" cx="${f1(hx)}" cy="${f1(yOf(st))}" rx="5.4" ry="3.9" transform="rotate(-20 ${f1(hx)} ${f1(yOf(st))})" fill="${hollow ? "none" : INK}" stroke="${INK}" stroke-width="${hollow ? 1.6 : 1}"/>`;
        if (dotted) g += `<circle cx="${f1(hx + 9)}" cy="${f1(yOf(st) - (onLine(st) ? SP / 2 : 0))}" r="1.6" fill="${INK}"/>`;
      });
    }
    // the stem (not on a whole note)
    if (e.beats < 3.99) {
      const up = I.up;
      const sx = x + (up ? 5.2 : -5.2);
      const from = up ? yOf(I.lo) : yOf(I.hi);
      const beamY = inBeam.get(i);
      const to = beamY ?? (up ? yOf(I.hi) - STEM : yOf(I.lo) + STEM);
      g += `<line x1="${f1(sx)}" y1="${f1(from)}" x2="${f1(sx)}" y2="${f1(to)}" stroke="${INK}" stroke-width="1.3"/>`;
      if (beamY == null && e.beats < 0.99) {
        const flags = e.beats <= 0.26 ? 2 : 1;
        for (let k = 0; k < flags; k++) {
          const ty = to + (up ? k * 7 : -k * 7), d = up ? 1 : -1;
          g += `<path d="M${f1(sx)} ${f1(ty)}C${f1(sx + 1)} ${f1(ty + 7 * d)} ${f1(sx + 9)} ${f1(ty + 9 * d)} ${f1(sx + 7)} ${f1(ty + 18 * d)}" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
        }
      }
    }
    // a tie on to the next note
    if (e.tie) {
      const nx = evs[i + 1] ? xs(evs[i + 1].at) : x + 22;
      const y = (I.up ? yOf(I.lo) + 6 : yOf(I.hi) - 6), d = I.up ? 6 : -6;
      g += `<path d="M${f1(x + 4)} ${f1(y)}Q${f1((x + nx) / 2)} ${f1(y + d)} ${f1(nx - 4)} ${f1(y)}" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
    }
    if (o.fingering && e.play >= 0 && !e.cont) g += `<text x="${f1(x)}" y="${f1(top + STAFF + 22)}" font-size="10.5" font-weight="700" text-anchor="middle" fill="#7a1f1f" font-family="'DM Mono',monospace">${valves(e.notes[0].midi)}</text>`;
    if (o.marks && e.play >= 0) {
      s += `<g class="nt" data-i="${e.play}">${g}</g>`;
      o.layout.notes[e.play] = { x, sys: o.si };
    } else s += g;
  });
  return s;
}
