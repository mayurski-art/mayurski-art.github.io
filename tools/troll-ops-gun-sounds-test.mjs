// Recorded gunshots (sound/clip-bank.js): every gun class's clip decodes,
// every weapon's shot() plays its recording (the listen-check log prints
// which), a suppressed shot and the Green Candles stay synth, and a shot
// before the clips are in falls back to the synth instead of going silent.
//
// Usage: node tools/troll-ops-gun-sounds-test.mjs   (needs Playwright)

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
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".mp3": "audio/mpeg",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml" };
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">
{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__gs.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
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
await page.goto(`${BASE}/__gs.html`);
const r = await page.evaluate(async () => {
  const { GameAudio } = await import("/assets/games/troll-ops/sound/audio.js");
  const CB = await import("/assets/games/troll-ops/sound/clip-bank.js?v=gs2");
  const { WEAPON_DEFS } = await import("/assets/games/troll-ops/weapons/weapons.js");
  const a = new GameAudio();
  a.init();
  await a.ctx.resume();
  // Before anything is loaded: the synth has to play (count its nodes).
  let made = 0;
  const orig = a.ctx.createBufferSource.bind(a.ctx);
  a.ctx.createBufferSource = () => { made++; return orig(); };
  a.shot(WEAPON_DEFS.problem416);
  const synthBefore = made;
  a.ctx.createBufferSource = orig;

  await CB.loadClips(a, "guns");
  const loaded = Object.fromEntries(CB.CLIP_GROUPS.guns.map((n) => [n, CB.clipLoaded(n)]));
  const per = [];
  for (const [id, def] of Object.entries(WEAPON_DEFS)) {
    if (def.melee || def.cls === "launcher" || def.cls === "melee") continue;
    const n = CB.clipsPlayed.length;
    a.shot(def, 1, null);
    per.push({ id, cls: def.cls, clip: CB.clipsPlayed.length > n ? CB.clipsPlayed.at(-1) : null, want: CB.gunClipFor(def)?.clip ?? null });
  }
  const n0 = CB.clipsPlayed.length;
  a.shot({ ...WEAPON_DEFS.problem416, quiet: true });
  const quietClip = CB.clipsPlayed.length > n0;
  // Positional: a bot's shot 20 m off goes through a panner.
  let panners = 0;
  const op = a.ctx.createPanner.bind(a.ctx);
  a.ctx.createPanner = () => { panners++; return op(); };
  a.setListener({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
  a.shot(WEAPON_DEFS.problem416, 0.8, { x: 20, y: 0, z: 0 });
  return { synthBefore, loaded, per, quietClip, panners };
});

check("before the clips load, a shot is synthesised", r.synthBefore > 0, `${r.synthBefore} noise sources`);
for (const [n, ok] of Object.entries(r.loaded)) check(`clip sfx/${n}.mp3 decodes`, ok);
console.log("\nlisten-check: weapon -> clip played");
for (const p of r.per) console.log(`  ${p.id.padEnd(16)} ${String(p.cls).padEnd(9)} ${p.clip ?? "(synth)"}`);
console.log("");
const wrong = r.per.filter((p) => p.clip !== p.want);
check("every gun plays the clip its class maps to", !wrong.length, wrong.map((p) => `${p.id}: ${p.clip} vs ${p.want}`).join(", "));
const sniper = r.per.filter((p) => p.cls === "sniper");
check("every sniper plays the sniper recording", sniper.length > 0 && sniper.every((p) => p.clip === "sniper"), sniper.map((p) => p.id).join(" "));
const classes = new Set(r.per.filter((p) => p.clip).map((p) => p.cls));
check("every firearm class has a recording", ["sniper", "battle", "assault", "carbine", "pdw", "lmg", "shotgun", "sidearm"].every((c) => classes.has(c)), [...classes].join(" "));
check("a suppressed shot stays synth", !r.quietClip);
check("a shot from 20 m off plays through a panner", r.panners > 0);
check("no page errors", !errors.length, errors.join(" | "));

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
