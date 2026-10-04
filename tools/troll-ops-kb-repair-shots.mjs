// Troll Forces — Keyboard Warrior repair act, frame by frame. Breaks the
// shield, then pins the act at fixed points (kbRepair.seek) and screenshots
// each, so the shots line up with the act however fast the headless page runs.
//
// Usage: node tools/troll-ops-kb-repair-shots.mjs <out dir>

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || "kb-repair-shots";
fs.mkdirSync(OUT, { recursive: true });
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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.meleeId = "keyboard";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
await sleep(500);
await page.evaluate(() => { const T = window.__trollOps; T.closePauseMenu(); if (T.isStaging()) T.endStaging(); T.breakSpawnGuard(); T.setHolding("melee"); });
await sleep(1500);
await page.evaluate(() => { const T = window.__trollOps; if (!document.getElementById("to-pause").hidden) T.closePauseMenu(); T.kbRepair.start(); });

const TIME = 3.8;   // keyboard-repair.js KB_REPAIR_TIME
for (const k of [0.1, 0.25, 0.4, 0.5, 0.6, 0.64, 0.7, 0.8]) {
  // Hold the act at k for a few frames, so the camera and poses settle there.
  await page.evaluate(async (t) => {
    const T = window.__trollOps;
    for (let i = 0; i < 12; i++) { T.kbRepair.seek(t); await new Promise((r) => requestAnimationFrame(r)); }
  }, k * TIME);
  await page.screenshot({ path: path.join(OUT, `kb-repair-${String(Math.round(k * 100)).padStart(2, "0")}.png`) });
}
console.log(errors.length ? `page errors: ${errors.slice(0, 3).join(" | ")}` : "no page errors");
await browser.close();
server.close();
