// Troll Forces: the band's songbook and sheet music (BAND.md; songs.js,
// notation.js). No browser: every song validates (bars add up, pitches and
// chords parse, the played lines sit on the keys), and every part of every
// song draws: well-formed SVG, one lit-able note per note played, staves,
// clefs, the key signature's count, chord names on the guitar.
//
// Usage: node tools/troll-ops-notation-test.mjs

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "assets", "games", "troll-ops");
const S = await import(pathToFileURL(path.join(DIR, "songs.js")).href);
const N = await import(pathToFileURL(path.join(DIR, "notation.js")).href);

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };

const bad = S.validateSongs();
check(`all ${S.SONGS.length} songs validate`, bad.length === 0, bad.slice(0, 8).join(" | "));

/* Tags open and close in order (a self-closing tag needs no partner). */
function balanced(svg) {
  const stack = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) { if (stack.pop() !== m[2]) return false; } else stack.push(m[2]);
  }
  return stack.length === 0;
}
const KEY_N = { C: 0, G: 1, D: 2, A: 3, E: 4, F: 1, Bb: 2, Eb: 3, Am: 0, Em: 1, Dm: 1, Gm: 2 };

let drawn = 0;
const problems = [];
for (const s of S.SONGS) {
  for (const kind of S.INSTRUMENTS) {
    let out;
    try { out = N.scoreSvg(s, kind); } catch (e) { problems.push(`${s.name} ${kind}: throws ${e.message}`); continue; }
    const { svg, layout } = out;
    drawn++;
    const play = S.playNotes(s, kind).length;
    const marks = (svg.match(/class="nt"/g) || []).length;
    if (!balanced(svg)) problems.push(`${s.name} ${kind}: tags don't balance`);
    if (/NaN|undefined/.test(svg)) problems.push(`${s.name} ${kind}: NaN/undefined in the drawing`);
    if (marks !== play) problems.push(`${s.name} ${kind}: ${marks} notes marked, ${play} to play`);
    if (layout.notes.filter(Boolean).length !== play) problems.push(`${s.name} ${kind}: layout has ${layout.notes.filter(Boolean).length} of ${play} notes`);
    const staffLines = (svg.match(/stroke-width="0.9" opacity=".8"/g) || []).length;
    const staves = kind === "piano" ? 2 : 1;
    if (staffLines !== layout.systems.length * staves * 5) problems.push(`${s.name} ${kind}: ${staffLines} staff lines for ${layout.systems.length} systems`);
    // the key signature: drawn once per staff per system
    const want = (KEY_N[s.key] ?? 0) * layout.systems.length * staves;
    const accs = (svg.match(/stroke-width="2\.3"|stroke-width="1\.4"\/>/g) || []).length;   // sharps' bars / flats' bowls (also in-bar accidentals)
    if (accs < want) problems.push(`${s.name} ${kind}: ${accs} key-signature glyphs, wants at least ${want}`);
    if (kind === "guitar" && s.levels.guitar !== "Expert" && !/fill="#7a1f1f" font-family="'DM Sans'/.test(svg)) problems.push(`${s.name} guitar: no chord names`);
    // the playhead finds every beat of the song
    const beats = S.songParts(s).beats;
    for (let b = 0; b < beats; b += 0.5) if (!N.beatX(layout, b)) { problems.push(`${s.name} ${kind}: the playhead loses beat ${b}`); break; }
  }
}
check(`every part of every song draws (${drawn} parts)`, problems.length === 0, problems.slice(0, 8).join(" | "));
const WANT = ["star-spangled-banner", "cielito-lindo", "la-cucaracha", "jarabe-tapatio", "la-bamba", "habanera-del-trollface", "corrido-del-grin",
  "clair-de-lune", "chopin-nocturne-op9-2", "moonlight-sonata", "gymnopedie-1", "bach-prelude-c", "chopin-prelude-e-minor", "rondo-alla-turca", "gnossienne-1", "silent-night"];
const missing = WANT.filter((id) => !S.SONGS.some((s) => s.id === id));
check("the anthem, the Latin songs and the playlist pieces are in", !missing.length, missing.join(", "));
check("nothing copyrighted by name", !S.SONGS.some((s) => /havana|fuerza|regida|einaudi|yiruma/i.test(s.name + s.by)));
for (const kind of S.INSTRUMENTS) {
  const per = S.LEVELS.map((l) => S.songsFor(kind, l).length);
  check(`${kind}: songs at every level`, per.every((n) => n > 0), per.join(" / "));
}

console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
