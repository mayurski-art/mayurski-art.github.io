// Maps download once (user, 2026-10-04): /sw.js keeps Troll Forces' models,
// textures and tagged scripts in Cache Storage. Loads a map, then opens the
// game again in the same browser and loads it again: the second time the
// server should see none of those files, and no -bake.jpg 404s either time.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-asset-cache-test.mjs [mapId]

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
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
let hits = [];
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  hits.push(u.pathname + u.search);
  const p = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  // GitHub Pages' header, so the HTTP cache alone would be re-asking.
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "max-age=0" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const mapId = process.argv[2] || "grinsite";
const BASE = `http://localhost:${server.address().port}`;
const isArt = (h) => h.startsWith("/assets/games/troll-ops/") && /\.(glb|jpe?g|png|webp)(\?|$)/.test(h) && !h.includes("/refs/");
const isTagged = (h) => h.startsWith("/assets/games/troll-ops/") && /\.js\?v=/.test(h);

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: 320, height: 200 } });
await context.route(/supabase/, (r) => r.abort());
const errors = [];

async function playOnce() {
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1&sw=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  const controlled = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return !!navigator.serviceWorker.controller;
  });
  await page.evaluate(async (mapId) => {
    const T = window.__trollOps;
    T.setMode("tdm");
    T.loadout.mapId = mapId;
    await T.startGame();
  }, mapId);
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
  // Let the cache writes (waitUntil) land, including the hand-over of what
  // loaded before the worker was up.
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    r.active.postMessage({ type: "cache-urls", urls: performance.getEntriesByType("resource").map((e) => e.name) });
  });
  await page.waitForTimeout(8000);
  await page.close();
  return controlled;
}

hits = [];
const c1 = await playOnce();
const first = hits.slice();
hits = [];
const c2 = await playOnce();
const second = hits.slice();

const art1 = first.filter(isArt), art2 = second.filter(isArt);
const tag1 = first.filter(isTagged), tag2 = second.filter(isTagged);
check("the second visit is controlled by the asset cache", c2, `first: ${c1}`);
check(`first load downloads the map's art (${mapId})`, art1.length > 5, `${art1.length} files`);
check("second load fetches no art from the server", art2.length === 0, art2.slice(0, 5).join(", "));
check("second load fetches no tagged scripts from the server", tag2.length === 0, `${tag1.length} -> ${tag2.length}: ${tag2.slice(0, 4).join(", ")}`);
check("no -bake.jpg requests", ![...first, ...second].some((h) => h.includes("-bake.jpg")),
  `${[...first, ...second].filter((h) => h.includes("-bake.jpg")).length}`);
check("the page itself still comes from the network", second.some((h) => h.startsWith("/troll-ops.html")));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(`server hits: first ${first.length}, second ${second.length}`);

await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
