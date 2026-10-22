// Troll City's chapel, St. Grinsworth's (maps/trollcity-chapel.js), walked
// with the real keys:
//   1. in at the west door off the street, holding W, no jump: through its
//      middle and near either side (the door is 2.4 m wide)
//   2. from the tower floor straight up the loft stair to the organ loft,
//      holding W, no jump (its foot stands clear of the west wall)
//   3. no page errors
// Shots of the door and the stair foot go to tools/.chapel-shots.
//
// Supabase is blocked: this never joins the live public room.
// Usage: node tools/troll-ops-tc-chapel-walk-test.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "tools/.chapel-shots");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
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
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.els.room.value = "";
  T.loadout.mapId = "trollcity";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 180000 });
await page.evaluate(() => {
  const T = window.__trollOps;
  T.closePauseMenu(); if (T.isStaging()) T.endStaging();
  for (const b of T.bots?.bots || []) { b.alive = false; b.respawnT = 1e9; }
});
await sleep(1500);

/* Stand at (x, y, z) facing +x (yaw -PI/2), hold W for `ms`; where you got
   to, and the highest you ever were off the floor under you (a jump). */
const walk = async ({ x, y, z }, ms) => {
  await page.evaluate(({ x, y, z }) => {
    const T = window.__trollOps;
    if (!document.getElementById("to-pause").hidden) T.closePauseMenu();
    T.player.maxHp = T.player.hp = 1e9; T.player.spawnGuard = 0;
    T.move.reset(x, z, y);
    T.move.velocity.set(0, 0, 0);
    T.look.yaw = -Math.PI / 2; T.look.pitch = 0;
  }, { x, y, z });
  await sleep(400);
  await page.keyboard.down("KeyW");
  const t0 = Date.now();
  let topY = -1;
  while (Date.now() - t0 < ms) {
    await sleep(50);
    const s = await page.evaluate(() => ({ y: window.__trollOps.move.pos.y, vy: window.__trollOps.move.velocity.y }));
    topY = Math.max(topY, s.vy);
  }
  await page.keyboard.up("KeyW");
  await sleep(200);
  const p = await page.evaluate(() => { const p = window.__trollOps.move.pos; return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) }; });
  return { ...p, upSpeed: +topY.toFixed(2) };
};

// 1. in at the west door (the tower's west face x 77, the door z 64.8..67.2)
for (const z of [66, 65.3, 66.7]) {
  const r = await walk({ x: 72, y: 0, z }, 2600);
  // (in by its north side the stair's foot is in line, and up it you go)
  check(`in at the west door, W held from the street (z ${z})`, r.x > 79 && (Math.abs(r.y - 0.3) < 0.1 || r.y > 4.3), JSON.stringify(r));
}
// 2. up the loft stair (the tower's north wall, z 64.6; the loft 4.5 up)
{
  const r = await walk({ x: 77.95, y: 0.3, z: 64.6 }, 3200);
  check("up the loft stair from the tower floor, W held, no jump", r.y > 4.3 && r.x > 82, JSON.stringify(r));
}

// shots: the door from the street, the stair foot from the doorway
const shot = async (name, pos, yaw, pitch) => {
  await page.evaluate(({ pos, yaw, pitch }) => {
    const T = window.__trollOps;
    T.move.reset(pos.x, pos.z, pos.y); T.move.velocity.set(0, 0, 0);
    T.look.yaw = yaw; T.look.pitch = pitch;
  }, { pos, yaw, pitch });
  await sleep(900);
  await page.screenshot({ path: path.join(OUT, name) });
};
await shot("chapel-door.png", { x: 69, y: 0, z: 66 }, -Math.PI / 2, 0.1);
await shot("chapel-stair.png", { x: 77.5, y: 0.3, z: 67.4 }, -Math.PI / 4 + 0.15, 0.05);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
