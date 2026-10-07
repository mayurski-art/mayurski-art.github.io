// Troll Forces spawns (modes/spawns.js, modes/spawn-field.js): every versus
// map gets a generated spawn field, and every point in it is somewhere a
// person can stand.
//
// Usage: node tools/troll-ops-spawn-test.mjs [mapId ...]   (Supabase blocked)

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
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail)})` : ""}`);
  if (!ok) failures++;
}

// The game imports spawns.js with this tag; importing the same URL in the page
// hands back the game's own module instance (its state, its field cache).
const SPAWNS = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/"\.\/modes\/spawns\.js\?v=([^"]+)"/)[1];

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];
async function openMap(mapId) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.route(/supabase/, (r) => r.abort());
  page.on("pageerror", (e) => errors.push(`${mapId}: ${e.message}`));
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`);
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  await page.evaluate(async (mapId) => {
    const T = window.__trollOps;
    T.setMode("tdm");
    T.loadout.mapId = mapId;
    await T.startGame();
    if (T.isStaging?.()) T.endStaging();
  }, mapId);
  await page.waitForFunction(() => window.__trollOps.builtMap()?.spawnPoints?.length > 0 && !window.__trollOps.isStaging(), null, { timeout: 180000 }).catch(() => {});
  return page;
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : await (async () => {
  const page = await browser.newPage();
  await page.route(/supabase/, (r) => r.abort());
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`);
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  const MAPS_TAG = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/"\.\/maps\.js\?v=([^"]+)"/)[1];
  const list = await page.evaluate(async (tag) => (await import(`/assets/games/troll-ops/maps.js?v=${tag}`)).MAP_IDS, MAPS_TAG);
  await page.close();
  return list;
})();

for (const mapId of ids) {
  const page = await openMap(mapId);
  const r = await page.evaluate(async (tag) => {
    const T = window.__trollOps;
    const S = await import(`/assets/games/troll-ops/modes/spawns.js?v=${tag}`);
    const field = S.spawnField();
    // time a fresh build (the game built and cached the field at the match start)
    const F = await import("/assets/games/troll-ops/modes/spawn-field.js?v=sf1");
    const t0 = performance.now();
    F.buildSpawnField(T.colliders, T.builtMap().map.bounds, T.builtMap().spawnPoints);
    const ms = performance.now() - t0;
    const cols = T.colliders;
    // standing room: nothing between knee and head within 0.45 m of the point
    const blocked = field.filter((p) => cols.some((c) => c.max.y > p.y + 0.4 && c.min.y < p.y + 1.9
      && p.x > c.min.x - 0.45 && p.x < c.max.x + 0.45 && p.z > c.min.z - 0.45 && p.z < c.max.z + 0.45));
    const starts = field.filter((p) => p.start).length;
    let minGap = Infinity;
    const gen = field.filter((p) => !p.start);
    for (let i = 0; i < gen.length; i++) for (let j = i + 1; j < gen.length; j++) minGap = Math.min(minGap, Math.hypot(gen[i].x - gen[j].x, gen[i].z - gen[j].z));
    return { points: field.length, starts, generated: gen.length, lo: field.filter((p) => p.side === "lo").length,
      hi: field.filter((p) => p.side === "hi").length, blocked: blocked.filter((p) => !p.start).length, minGap: +minGap.toFixed(1), ms: Math.round(ms) };
  }, SPAWNS);
  check(`${mapId}: field covers the map (30+ points)`, r.points >= 30, r);
  check(`${mapId}: every generated point has standing room`, r.blocked === 0, r.blocked ? `${r.blocked} blocked` : "");
  check(`${mapId}: both halves have points`, r.lo >= 10 && r.hi >= 10, { lo: r.lo, hi: r.hi });
  check(`${mapId}: built quickly`, r.ms < 400, `${r.ms} ms`);
  await page.close();
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} spawn check(s) FAILED` : "all spawn checks passed");
process.exit(failures ? 1 : 0);
