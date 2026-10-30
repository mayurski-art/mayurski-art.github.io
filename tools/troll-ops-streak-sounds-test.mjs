// Scorestreak sounds (sound/clip-bank.js STREAK_SOUND): every streak's
// clips decode, every streak's arrival plays its recording (the listen-check
// log prints which), blasts and barks use theirs, and before the clips are
// in each falls back (streakSound false, so the caller plays wave()).
//
// Usage: node tools/troll-ops-streak-sounds-test.mjs   (needs Playwright)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.execPath, "../../lib/node_modules/playwright"))); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif" };
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">
{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__ss.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/supabase/, (r) => r.abort());
await page.goto(`${BASE}/__ss.html`);
const r = await page.evaluate(async () => {
  const { GameAudio } = await import("/assets/games/troll-ops/sound/audio.js");
  const CB = await import("/assets/games/troll-ops/sound/clip-bank.js?v=gs2");
  const a = new GameAudio();
  a.init();
  await a.ctx.resume();
  const before = a.streakSound("helicopter");
  await CB.loadClips(a, "streaks");
  const loaded = Object.fromEntries(CB.CLIP_GROUPS.streaks.map((n) => [n, CB.clipLoaded(n)]));
  const kinds = ["uav", "counteruav", "vsat", "carepackage", "helicopter", "warship", "dragonfire", "drone", "swarm", "airstrike", "k9", "sam"];
  const per = {};
  for (const k of kinds) {
    const n = CB.clipsPlayed.length;
    const ok = a.streakSound(k, k === "swarm" || k === "k9" || k === "sam" ? { x: 5, y: 2, z: 0 } : null);
    per[k] = { ok, clips: CB.clipsPlayed.slice(n) };
  }
  let n = CB.clipsPlayed.length;
  a.streakBoom(1.3, { x: 10, y: 0, z: 0 });
  const boom = CB.clipsPlayed.slice(n);
  n = CB.clipsPlayed.length;
  a.bark({ x: 3, y: 0, z: 0 });
  const bark = CB.clipsPlayed.slice(n);
  return { before, loaded, per, boom, bark };
});

check("before the clips load, streakSound says so (the caller plays wave())", r.before === false);
for (const [n, ok] of Object.entries(r.loaded)) check(`clip sfx/${n}.mp3 decodes`, ok);
console.log("\nlisten-check: streak -> clips played");
for (const [k, p] of Object.entries(r.per)) console.log(`  ${k.padEnd(12)} ${p.clips.join(" + ") || "(none)"}`);
console.log(`  ${"blast".padEnd(12)} ${r.boom.join(" + ")}`);
console.log(`  ${"bark".padEnd(12)} ${r.bark.join(" + ")}\n`);
check("every streak plays a recording", Object.values(r.per).every((p) => p.ok && p.clips.length), Object.entries(r.per).filter(([, p]) => !p.ok).map(([k]) => k).join(" "));
check("UAV: plane then radar", r.per.uav.clips.join() === "prop-plane,radar");
check("care package and helicopter: rotors", r.per.carepackage.clips[0] === "heli" && r.per.helicopter.clips[0] === "heli");
check("airstrike: jet", r.per.airstrike.clips[0] === "jet");
check("drone and swarm: quadcopter", r.per.drone.clips[0] === "quad" && r.per.swarm.clips[0] === "quad");
check("K9: three barks", r.per.k9.clips.join() === "dog,dog,dog");
check("streak blast plays the recorded blast", r.boom[0] === "blast");
check("a bite's bark is a real dog", r.bark[0] === "dog");

check("no page errors", !errors.length, errors.join(" | "));

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
