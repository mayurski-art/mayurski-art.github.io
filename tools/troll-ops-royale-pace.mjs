// Troll Royale pacing on Trollface Island: how many trolls are left as the
// match clock runs, and what killed them (bots vs the Cringe). The player is
// kept alive and out of it so the curve is the bots' own.
//
// Usage: node tools/troll-ops-royale-pace.mjs [match seconds, default 300]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UNTIL = Number(process.argv[2] || 300);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => { const T = window.__trollOps; T.setMode("royale"); await T.startGame(); });
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 180000 });
await page.evaluate(() => {
  const T = window.__trollOps;
  T.settings.invincible = true;
  T.player.spawnGuard = 1e9;
  window.__pace = { causes: {}, rows: [] };
  const orig = T.bots.applyHit.bind(T.bots);
  T.bots.applyHit = (id, d, o) => {
    const r = orig(id, d, o);
    if (r?.killed) {
      const k = o?.pierce ? "zone" : "fight";
      window.__pace.causes[k] = (window.__pace.causes[k] || 0) + 1;
      // The first few deaths in detail: when, where, how hard the last hit was.
      const b = T.bots.byId(id), ro = T.royale();
      const log = window.__pace.log ||= [];
      if (log.length < 30) {
        log.push({ t: +(ro?.t || 0).toFixed(1), live: !!ro?.live, hit: +d.toFixed(1), y: +b.pos.y.toFixed(1),
          x: Math.round(b.pos.x), z: Math.round(b.pos.z), air: !!b.airborne, armor: b.armor | 0,
          from: (new Error().stack || "").split("\n").slice(2, 5).map((s) => s.trim().split(" ")[1]).join(" < ") });
      }
    }
    return r;
  };
});
let lastT = -1, printedLog = false;
for (let i = 0; i < 4000; i++) {
  const s = await page.evaluate(() => {
    const T = window.__trollOps, r = T.royale?.();
    if (!r) return null;
    const alive = T.bots.bots.filter((b) => b.alive).length;
    return { t: Math.round(r.t), live: r.live, alive, causes: window.__pace.causes, me: r.me };
  });
  if (s && s.live && s.t >= lastT + 15) { lastT = s.t; console.log(`t=${String(s.t).padStart(4)}s  bots alive ${String(s.alive).padStart(3)}  kills ${JSON.stringify(s.causes)}`); }
  if (s && s.t >= UNTIL) break;
  if (s && s.live && s.t >= 30 && !printedLog) {
    printedLog = true;
    for (const l of await page.evaluate(() => window.__pace.log || [])) console.log("  death", JSON.stringify(l));
  }
  if (s && s.live && s.alive <= 1) { console.log(`over at t=${s.t}s`); break; }
  await sleep(1000);
}
console.log(errors.length ? `page errors: ${errors.slice(0, 3).join(" | ")}` : "no page errors");
await browser.close();
server.close();
