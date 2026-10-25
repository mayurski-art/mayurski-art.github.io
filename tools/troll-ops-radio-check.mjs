// Troll Forces radio: one track, end to end in the real page.
//
//   node tools/troll-ops-radio-check.mjs [music/<file>.mp3]   (default: the last track)
//
// Loads troll-ops.html (Supabase blocked, so no public room), plays the track
// through the game's own GameMusic and checks it's listed, loads, plays, runs
// its full length, has a beat grid, and shows its title on the radio.
// troll-ops-add-song.mjs runs this after adding a song.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const want = process.argv[2] ? path.basename(process.argv[2]) : null;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "content-length": fs.statSync(p).size });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });

const r = await page.evaluate(async (want) => {
  const m = window.__trollOps.music;
  const i = want ? m.tracks.findIndex((t) => t.src.endsWith(`/${want}`)) : m.tracks.length - 1;
  if (i < 0) return { i };
  m.playIndex(i);
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  for (let n = 0; n < 150 && !(m.el.currentTime > 1); n++) await sleep(100);
  await sleep(500);
  const { BEATS } = await import(new URL("assets/games/troll-ops/sound/music-beats.js", location.href).href);
  const b = BEATS[m.tracks[i].src];
  return { i, track: m.tracks[i], src: m.el.currentSrc, at: m.el.currentTime, dur: m.el.duration, err: m.el.error?.code ?? null,
    beat: b ? { bpm: b.bpm, dur: b.dur } : null, shown: document.getElementById("to-radio-title")?.textContent || "" };
}, want);
const file = r.track && path.join(ROOT, r.track.src);
const real = file && fs.existsSync(file)
  ? +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim() : 0;
check("track is in the radio's list", r.i >= 0, JSON.stringify(r.track));
check("mp3 loads with no media error", r.err === null && !!r.track && (r.src || "").endsWith(r.track.src), r.src);
check("it plays", r.at > 1, `${(r.at || 0).toFixed(2)} s in`);
check("full length", real > 0 && Math.abs(r.dur - real) < 1, `${(r.dur || 0).toFixed(1)} s of ${real.toFixed(1)} s`);
check("beat grid matches it", !!r.beat && r.beat.bpm > 50 && Math.abs(r.beat.dur - real) < 1, JSON.stringify(r.beat));
check("radio shows its title", !!r.track && r.shown === r.track.title, r.shown);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close(); server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
