// Troll Forces radio: add a song in one go.
//
//   node tools/troll-ops-add-song.mjs [song.mp3] [--title "..."] [--artist "..."] [--slug name] [--tag xx1] [--dry]
//
// With no file it takes the newest mp3 in your Downloads folder. Title and
// artist come from the mp3's own tags (download-site junk like
// "| HipHopKit.com" or "(mp3.pm)" stripped); --title / --artist override them.
// Then it:
//   1. copies the mp3 to assets/games/troll-ops/music/<slug>.mp3
//   2. adds the track to the end of TRACKS in sound/music.js
//   3. builds its beat grid (troll-ops-beatgrid.mjs --only, the rest untouched)
//   4. bumps the ?v= tags of music.js and music-beats.js up to troll-ops.html
//   5. adds the shipped-log line to HANDOFF.md
//   6. plays it in the real page (troll-ops-radio-check.mjs)
// and prints the commit message. Needs ffmpeg/ffprobe on PATH.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
const MUSIC_JS = path.join(GAME, "sound/music.js");
const HANDOFF = path.join(GAME, "HANDOFF.md");
const argv = process.argv.slice(2);
const flag = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const dry = argv.includes("--dry");
const die = (msg) => { console.error(msg); process.exit(1); };
const node = (...a) => execFileSync(process.execPath, a, { cwd: ROOT, stdio: "inherit" });

// The file: the first bare argument, else the newest mp3 in Downloads.
const valued = new Set(["--title", "--artist", "--slug", "--tag"]);
const bare = argv.filter((a, i) => !a.startsWith("--") && !valued.has(argv[i - 1]));
let src = bare[0];
if (!src) {
  const dl = path.join(os.homedir(), "Downloads");
  const mp3s = fs.existsSync(dl) ? fs.readdirSync(dl).filter((n) => /\.mp3$/i.test(n))
    .map((n) => ({ n, t: fs.statSync(path.join(dl, n)).mtimeMs })).sort((a, b) => b.t - a.t) : [];
  if (!mp3s.length) die(`no mp3 given and none in ${dl}`);
  src = path.join(dl, mp3s[0].n);
}
if (!fs.existsSync(src)) die(`not found: ${src}`);

// Title and artist from the tags, cleaned of the download site's name.
const junk = (s) => (s || "")
  .replace(/\s*[|\-–]\s*[\w-]+\.(com|net|org|pm|me|io|cc|to)\b.*$/i, "")
  .replace(/\s*[([][^)\]]*\.(com|net|org|pm|me|io|cc|to)[)\]]/ig, "")
  .replace(/\s+/g, " ").trim();
const tags = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format_tags=title,artist", "-of", "json", src]).toString()).format?.tags || {};
const tag = (k) => tags[k] ?? tags[k.toUpperCase()] ?? tags[k[0].toUpperCase() + k.slice(1)];
let title = flag("title") ?? junk(tag("title"));
let artist = flag("artist") ?? junk(tag("artist"));
if (!title) title = junk(path.basename(src, path.extname(src)).replace(/[_]+/g, " "));
if (!artist) die(`no artist tag in ${path.basename(src)}: pass --artist "..."`);
// Featured artists live in the title, as in the rest of TRACKS.
const feat = artist.match(/\s+(?:feat\.?|ft\.?|featuring)\s+(.+)$/i);
if (feat) { artist = artist.slice(0, feat.index).trim(); if (!/feat\./i.test(title)) title += ` (feat. ${feat[1].trim()})`; }

const slug = flag("slug") || title.replace(/\s*\((feat|ft)\.?[^)]*\)/ig, "")
  .normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
if (!slug) die("couldn't make a file name from the title: pass --slug name");
const file = `${slug}.mp3`;
const rel = `assets/games/troll-ops/music/${file}`;
let music = fs.readFileSync(MUSIC_JS, "utf8");
if (music.includes(`"${rel}"`)) die(`${rel} is already in music.js`);
if (fs.existsSync(path.join(ROOT, rel))) die(`${rel} already exists: pass --slug another-name`);

// A cache tag no import uses yet: the slug's initials + a number.
const tagsInUse = fs.readFileSync(path.join(GAME, "game.js"), "utf8") + fs.readFileSync(path.join(ROOT, "troll-ops.html"), "utf8");
let suffix = flag("tag");
if (!suffix) {
  const words = slug.split("-");
  const base = (words.length > 1 ? words[0][0] + words[1][0] : slug.slice(0, 2)).replace(/[^a-z]/g, "x");
  for (let n = 1; !suffix || new RegExp(`-${suffix}\\b`).test(tagsInUse); n++) suffix = `${base}${n}`;
}

console.log(`song    ${path.basename(src)}\ntitle   ${title}\nartist  ${artist}\nfile    ${rel}\ntag     -${suffix}`);
if (dry) process.exit(0);

// 1-2. The file and its TRACKS line (the file's own line endings kept).
fs.copyFileSync(src, path.join(ROOT, rel));
const eol = music.includes("\r\n") ? "\r\n" : "\n";
const end = music.indexOf(`${eol}];`, music.indexOf("const TRACKS = ["));
if (end < 0) die("couldn't find the end of TRACKS in music.js");
const line = `  { title: ${JSON.stringify(title)}, artist: ${JSON.stringify(artist)}, src: ${JSON.stringify(rel)} },`;
music = music.slice(0, end) + eol + line + music.slice(end);
fs.writeFileSync(MUSIC_JS, music);

// 3. Its beat grid.
node("tools/troll-ops-beatgrid.mjs", "--only", file);
const grid = fs.readFileSync(path.join(GAME, "sound/music-beats.js"), "utf8").match(new RegExp(`"${rel.replace(/[.]/g, "\\.")}": \\{"bpm":([\\d.]+)`));
const bpm = grid ? Math.round(+grid[1]) : "?";

// 4. Cache tags.
node("tools/troll-ops-bump-tags.mjs", suffix, "assets/games/troll-ops/sound/music.js", "assets/games/troll-ops/sound/music-beats.js", "--write");

// 5. HANDOFF, above the newest radio line.
let ho = fs.readFileSync(HANDOFF, "utf8");
const hoEol = ho.includes("\r\n") ? "\r\n" : "\n";
const today = new Date().toLocaleDateString("en-CA");
const feats = title.match(/\(feat\. ([^)]+)\)/);
const who = feats ? `${artist} feat. ${feats[1]}` : artist;
const entry = `- **${today}** (-${suffix}) Radio: ${title.replace(/\s*\(feat\.[^)]*\)/, "")} (${who}), beat grid ${bpm} BPM. Tests: radio-check.`;
const at = ho.search(/^- \*\*\d{4}-\d\d-\d\d\*\* \(-\w+\) Radio: /m);
ho = at >= 0 ? ho.slice(0, at) + entry + hoEol + ho.slice(at) : ho.trimEnd() + hoEol + entry + hoEol;
fs.writeFileSync(HANDOFF, ho);

// 6. Play it in the page.
let ok = true;
try { node("tools/troll-ops-radio-check.mjs", file); } catch { ok = false; }
console.log(`\n${ok ? "added" : "added, but the radio check FAILED (see above)"}: ${title} by ${artist}`);
console.log(`commit message:\n  Troll Forces radio: ${title} by ${artist}, with its beat grid for the club lights (-${suffix})`);
process.exit(ok ? 0 : 1);
