// Troll Forces — bots on stairs. You stand at the top of a staircase on
// Grinsite; one enemy bot starts on the ground away from its foot, unable
// to see you (sight is blocked for the test, so it has to hunt rather than
// shoot from below). It has to find the stair, climb it and come to you.
// Then the other way: you on the ground, the bot up top, and it has to
// come back down.
//
// Usage: node tools/troll-ops-bot-stairs-test.mjs

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
  if (T.els.noBots) T.els.noBots.checked = false;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
await page.waitForFunction(() => window.__trollOps.bots.bots.some((b) => b.alive && b.team !== window.__trollOps.net.team), null, { timeout: 60000 });
await page.evaluate(() => {
  const T = window.__trollOps;
  T.closePauseMenu(); if (T.isStaging()) T.endStaging();
  setInterval(() => { if (T.player.alive) T.player.hp = T.player.maxHp; T.player.spawnGuard = 0; }, 50);
  // One enemy bot; the rest stand down. Nobody can see anybody.
  const enemy = T.bots.bots.find((b) => b.alive && b.team !== T.net.team);
  for (const b of T.bots.bots) if (b !== enemy) { b.alive = false; b.respawnT = 1e9; }
  const orig = T.bots.update.bind(T.bots);
  T.bots.update = (dt, ctx) => orig(dt, { ...ctx, sightBlocked: () => true, onThrow: null });
  window.__bs = { enemy };
});

async function run(botUp) {
  return page.evaluate(async (botUp) => {
    const T = window.__trollOps, b = window.__bs.enemy;
    const stairs = T.builtMap().stairs || [];
    const s = stairs.filter((x) => x.a.y < 0.2 && x.b.y > 2.5).sort((p, q) => q.b.y - p.b.y)[0];
    const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, l = Math.hypot(dx, dz);
    const top = { x: s.b.x + dx / l * 0.8, y: s.b.y, z: s.b.z + dz / l * 0.8 };
    const px = -dz / l, pz = dx / l;
    const ground = { x: s.a.x - dx / l * 8 + px * 9, y: 0, z: s.a.z - dz / l * 8 + pz * 9 };
    const me = botUp ? ground : top, it = botUp ? top : ground;
    b.pos.set(it.x, it.y, it.z); b.groundY = it.y; b.hopY = 0; b.climb = null;
    const t0 = performance.now();
    let best = Infinity, reached = null, maxY = 0, minY = 99;
    while (performance.now() - t0 < 45000) {
      await new Promise((r) => setTimeout(r, 200));
      T.move.pos.set(me.x, me.y, me.z);
      if (!b.alive) break;
      maxY = Math.max(maxY, b.groundY); minY = Math.min(minY, b.groundY);
      const d = Math.hypot(b.pos.x - me.x, b.pos.z - me.z);
      if (Math.abs(b.groundY - me.y) < 0.6) best = Math.min(best, d);
      if (best < 3) { reached = Math.round((performance.now() - t0) / 100) / 10; break; }
    }
    return { best: +best.toFixed(1), reached, maxY: +maxY.toFixed(2), minY: +minY.toFixed(2), alive: b.alive, top: top.y };
  }, botUp);
}

const up = await run(false);
check("a bot on the ground finds the stairs and comes up to you", up.reached != null && up.maxY > up.top - 0.5, JSON.stringify(up));
const down = await run(true);
check("a bot upstairs comes back down to you on the ground", down.reached != null && down.minY < 0.3, JSON.stringify(down));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
