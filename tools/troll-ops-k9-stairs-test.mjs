// Troll Forces — K9 Unit on stairs. You stand at the top of a staircase on
// Grinsite; an enemy pack is let loose on the ground well away from its
// foot. The dogs have to find the stair, climb it and reach you (they used
// to run to the spot under you and circle there).
//
// Usage: node tools/troll-ops-k9-stairs-test.mjs [shot dir]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
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
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.mapId = "grinsite";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
await page.evaluate(() => { const T = window.__trollOps; T.closePauseMenu(); if (T.isStaging()) T.endStaging(); });

const setup = await page.evaluate(() => {
  const T = window.__trollOps;
  const bm = T.builtMap();
  const stairs = bm.stairs || [];
  // The tallest flight that starts on the ground.
  const s = stairs.filter((x) => x.a.y < 0.2 && x.b.y > 2.5).sort((p, q) => q.b.y - p.b.y)[0];
  if (!s) return { map: bm.map.id, stairs: stairs.length };
  const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, l = Math.hypot(dx, dz);
  const top = { x: s.b.x + dx / l * 0.8, y: s.b.y, z: s.b.z + dz / l * 0.8 };
  T.move.reset(top.x, top.z, top.y);
  setInterval(() => { if (T.player.alive) T.player.hp = T.player.maxHp; T.player.spawnGuard = 0; }, 50);
  // Released on the ground, off to the side of the stair's foot and back
  // from it, so they have to work out where the way up is.
  const px = -dz / l, pz = dx / l;
  const at = { x: s.a.x - dx / l * 8 + px * 9, z: s.a.z - dz / l * 8 + pz * 9 };
  const enemy = T.net.team === "ghost" ? "phantom" : "ghost";
  const pack = T.spawnK9({ id: "k9-stairs", owned: true, team: enemy, ownerId: "bot-test", x: at.x, y: 0, z: at.z, yaw: 0 });
  pack.botId = "bot-test"; pack.botTeam = enemy;
  window.__k9s = { pack, top, best: Infinity, maxY: 0 };
  return { map: bm.map.id, stairs: stairs.length, a: s.a, b: s.b, top, at, team: T.net.team };
});
console.log(JSON.stringify(setup));
check("the map reports its stairs", setup.stairs > 0 && !!setup.b, JSON.stringify({ map: setup.map, stairs: setup.stairs }));

const res = await page.evaluate(async () => {
  const T = window.__trollOps, k = window.__k9s;
  const t0 = performance.now();
  let reachedAt = null;
  while (performance.now() - t0 < 40000) {
    await new Promise((r) => setTimeout(r, 200));
    T.move.pos.set(k.top.x, k.top.y, k.top.z);   // hold still up there
    for (const d of k.pack.dogs) {
      if (!d?.alive) continue;
      k.maxY = Math.max(k.maxY, d.pos.y);
      const dist = Math.hypot(d.pos.x - k.top.x, d.pos.z - k.top.z);
      if (Math.abs(d.pos.y - k.top.y) < 0.6) k.best = Math.min(k.best, dist);
    }
    if (k.best < 2 && !reachedAt) reachedAt = Math.round((performance.now() - t0) / 100) / 10;
    if (reachedAt && performance.now() - t0 > reachedAt * 1000 + 6000) break;
  }
  const up = k.pack.dogs.filter((d) => d?.alive && Math.abs(d.pos.y - k.top.y) < 0.6).length;
  const dogs = k.pack.dogs.map((d) => d && [+d.pos.x.toFixed(1), +d.pos.y.toFixed(2), +d.pos.z.toFixed(1), d.alive, !!d.climb, !!d.detour]);
  return { maxY: +k.maxY.toFixed(2), best: +k.best.toFixed(2), reachedAt, dogsUp: up, dogs };
});
if (OUT) await page.screenshot({ path: path.join(OUT, "k9-stairs.png") });
check("dogs climb the stairs to the top", res.maxY > setup.top.y - 0.5, JSON.stringify(res));
check("and reach you up there", res.best < 2, JSON.stringify(res));
check("most of the pack makes it up", res.dogsUp >= 3, JSON.stringify(res));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
