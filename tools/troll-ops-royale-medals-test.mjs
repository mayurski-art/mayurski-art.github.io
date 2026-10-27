// Troll Royale shows no medal splashes (user: "remove the killstreak icons
// for troll royale only such as headshot longshot double triple quad nuclear
// etc."): they're still counted for points and the after-action list. Other
// modes still show them.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-medals-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const errors = [];
// One match per mode in a private room (Supabase blocked); a headshot double
// kill on Nuclear's rung and a Longshot, then what's on the splash.
async function medalsIn(mode, map) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.route(/supabase/, (r) => r.abort());
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  await page.evaluate(async ({ mode, map }) => {
    const T = window.__trollOps;
    if (mode === "royale") T.DROP.enabled = false;
    T.setMode(mode);
    if (T.els.noBots) T.els.noBots.checked = true;
    // a private room, never the public one
    T.els.room.value = "MD" + Math.random().toString(36).slice(2, 5).toUpperCase();
    T.els.room.dispatchEvent(new Event("input"));
    if (map) T.loadout.mapId = map;
    await T.startGame();
  }, { mode, map });
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
  const out = await page.evaluate(() => {
    const T = window.__trollOps, ui = T.killstreakUi;
    ui.reset();
    ui.onKill({ head: true, streak: 1 });
    ui.onKill({ head: false, streak: 2 });
    ui.medal("Longshot");
    ui.medal("Nuclear");
    return { shown: document.getElementById("to-ks-badges")?.children.length ?? -1, counted: ui.medals().map((m) => m.label) };
  });
  await page.close();
  return out;
}
const r = await medalsIn("royale");
check("Troll Royale: no medal pops up", r.shown === 0, JSON.stringify(r));
check("...but they're still counted (points, after-action list)", ["Headshot", "Double Kill", "Longshot", "Nuclear"].every((l) => r.counted.includes(l)), JSON.stringify(r.counted));
const t = await medalsIn("tdm", "grinsite");
check("TDM: the medals still pop up", t.shown > 0, JSON.stringify(t));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
