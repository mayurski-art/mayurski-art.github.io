// Ground height (core/ground-field.js, doc "Troll Royale map in Roblox
// Studio", phase 2): a test hill on the flat island. You walk up it and fall
// onto it, a bot stands on it and its grid still crosses it, loot and the
// landing find its top, it stops a bullet and a bot's line of sight; and
// with no field the island is flat at y 0 exactly as before.
//
// Troll Royale headless, Supabase blocked (never a public room).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
// The game's own module instances: import them under the tags game.js uses.
const tagOf = (file, mod) => fs.readFileSync(path.join(GAME, file), "utf8").match(new RegExp(`["']\\.{1,2}/(?:[a-z-]+/)?${mod.replace(".", "\\.")}\\?v=([^"']+)["']`))[1];
const TAGS = {
  field: tagOf("core/movement.js", "ground-field.js"),
  movement: tagOf("game.js", "movement.js"),
  ballistics: tagOf("bots/bots.js", "ballistics.js"),
  nav: tagOf("bots/bots.js", "nav.js"),
};
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
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
await page.evaluate(async () => { const T = window.__trollOps; T.DROP.enabled = false; T.setMode("royale"); await T.startGame(); });
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 120000 });
await page.evaluate(() => { const T = window.__trollOps; T.player.spawnGuard = 1e9; });

// An open, dry, collider-free spot for the hill, and the flat answers there.
const setup = await page.evaluate(async (TAGS) => {
  const T = window.__trollOps;
  const { game } = await import("/assets/games/troll-ops/core/state.js?v=st1");
  const gf = await import(`/assets/games/troll-ops/core/ground-field.js?v=${TAGS.field}`);
  const { groundHeightAt } = await import(`/assets/games/troll-ops/core/movement.js?v=${TAGS.movement}`);
  const m = await import("/assets/games/troll-ops/maps/trollface-island.js?v=ti3");
  const { insidePolygon } = await import("/assets/games/troll-ops/maps/edge.js?v=or1");
  const I = m.TROLLFACE_ISLAND, cols = game.colliders;
  const clear = (x, z, r) => !cols.some((c) => c.max.y > 0.3 && c.max.x > x - r && c.min.x < x + r && c.max.z > z - r && c.min.z < z + r)
    && [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dz]) => insidePolygon(I.edge, x + dx, z + dz) && !insidePolygon(I.wade, x + dx, z + dz));
  let spot = null;
  for (let r = 0; r < 200 && !spot; r += 6) for (let a = 0; a < 6.28 && !spot; a += 0.4) {
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (clear(x, z, 18)) spot = { x, z };
  }
  return { spot, hadField: !!gf.groundField(), flat: spot && groundHeightAt(cols, spot.x, spot.z, 0.8, 0.3) };
}, TAGS);
check("an open spot for the test hill", !!setup.spot, JSON.stringify(setup.spot));
check("Trollface Island has no heightfield yet (flat until phase 3)", !setup.hadField);
check("flat: the ground there is y 0, as before", setup.flat === 0, `${setup.flat}`);
const { x: HX, z: HZ } = setup.spot;
const HILL = 4, SIGMA = 8;   // a 4 m round hill, steepest ~0.3 m per m

// The hill: a 2 m field over the whole island, a bump at the spot.
await page.evaluate(async ({ TAGS, HX, HZ, HILL, SIGMA }) => {
  const gf = await import(`/assets/games/troll-ops/core/ground-field.js?v=${TAGS.field}`);
  const cell = 2, minX = -206, minZ = -156, w = 207, h = 157, heights = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = minX + i * cell, z = minZ + j * cell;
    heights[j * w + i] = HILL * Math.exp(-((x - HX) ** 2 + (z - HZ) ** 2) / (2 * SIGMA * SIGMA));
  }
  gf.setGroundField({ minX, minZ, cell, w, h, heights });
}, { TAGS, HX, HZ, HILL, SIGMA });

// Walk over it: from 20 m west, east for 6 s.
const walk = await page.evaluate(async ({ TAGS, HX, HZ }) => {
  const T = window.__trollOps;
  const gf = await import(`/assets/games/troll-ops/core/ground-field.js?v=${TAGS.field}`);
  T.move.pos.set(HX - 20, 1.2, HZ); T.move.velocity?.set(0, 0, 0);
  T.look.yaw = Math.atan2(-1, 0); T.look.pitch = 0;
  await new Promise((r) => setTimeout(r, 600));
  T.keys.add("KeyW");
  let top = -1, worst = 0;
  const t0 = performance.now();
  await new Promise((res) => { const tick = () => {
    const p = T.move.pos, g = gf.floorAt(p.x, p.z);
    top = Math.max(top, p.y);
    if (T.move.onGround !== false) worst = Math.max(worst, Math.abs(p.y - g));
    if (performance.now() - t0 < 6000) requestAnimationFrame(tick); else res();
  }; requestAnimationFrame(tick); });
  T.keys.delete("KeyW");
  return { top, worst, endX: T.move.pos.x - HX };
}, { TAGS, HX, HZ });
check("you walk up and over the hill", walk.top > 3.4 && walk.endX > 4, JSON.stringify({ top: +walk.top.toFixed(2), past: +walk.endX.toFixed(1) }));
check("...feet on the ground all the way", walk.worst < 0.25, `worst ${walk.worst.toFixed(2)} m off`);

// Fall onto it from 30 m: you land on the slope, not inside it.
const fall = await page.evaluate(async ({ TAGS, HX, HZ }) => {
  const T = window.__trollOps;
  const gf = await import(`/assets/games/troll-ops/core/ground-field.js?v=${TAGS.field}`);
  T.move.pos.set(HX + 5, 30, HZ + 3); T.move.velocity?.set(0, 0, 0);
  await new Promise((r) => setTimeout(r, 4500));
  return { y: T.move.pos.y, g: gf.floorAt(T.move.pos.x, T.move.pos.z), alive: T.player.alive };
}, { TAGS, HX, HZ });
check("you fall onto the hill and stand on it", Math.abs(fall.y - fall.g) < 0.15 && fall.g > 1, JSON.stringify(fall));

// The rest read the field the same way: the ground under a point, a bot on
// the slope, the bots' grid, bullets and line of sight.
const rest = await page.evaluate(async ({ TAGS, HX, HZ }) => {
  const T = window.__trollOps;
  const { game } = await import("/assets/games/troll-ops/core/state.js?v=st1");
  const gf = await import(`/assets/games/troll-ops/core/ground-field.js?v=${TAGS.field}`);
  const { groundHeightAt } = await import(`/assets/games/troll-ops/core/movement.js?v=${TAGS.movement}`);
  const { raycastWorld, segmentBlocked } = await import(`/assets/games/troll-ops/weapons/ballistics.js?v=${TAGS.ballistics}`);
  const { FlowField } = await import(`/assets/games/troll-ops/bots/nav.js?v=${TAGS.nav}`);
  const THREE = await import("three");
  const cols = game.colliders, peak = gf.floorAt(HX, HZ);
  const out = {
    peak,
    loot: groundHeightAt(cols, HX, HZ, gf.floorAt(HX, HZ) + 0.8, 0.3),      // royale.js royaleGround: where a drop lies
    landing: groundHeightAt(cols, HX + 2, HZ - 1, 300),                       // royale.js dropGround: a bot's landing spot
  };
  out.landingWant = gf.floorAt(HX + 2, HZ - 1);
  // A bot put on the slope settles onto it.
  const bot = T.bots.bots.find((b) => b.alive !== false && b.pos);
  if (bot) {
    bot.pos.set(HX - 4, 6, HZ + 2); if (bot.vel) bot.vel.set(0, 0, 0);
    await new Promise((r) => setTimeout(r, 2500));
    out.bot = { y: bot.pos.y, g: gf.floorAt(bot.pos.x, bot.pos.z) };
  }
  // The grid: a route from one side of the hill to the other (it's walkable).
  const f = new FlowField(cols, game.arena || { minX: -205, maxX: 205, minZ: -155, maxZ: 155 }, 0, { cell: 2 });
  f.compute(HX + 18, HZ);
  const i = f.openIndex(HX - 18, HZ);
  out.route = i >= 0 && f.dist[i] > 0;
  // Eye-level line across the hill: blocked by it; 6 m up: clear.
  const a = new THREE.Vector3(HX - 22, 1.5, HZ), b = new THREE.Vector3(HX + 22, 1.5, HZ);
  const dir = b.clone().sub(a).normalize();
  out.low = { blocked: segmentBlocked(cols, a, b), ray: raycastWorld(cols, a, dir, 44) };
  a.y = b.y = 6.5;
  out.high = { blocked: segmentBlocked(cols, a, b), ray: raycastWorld(cols, a, dir, 44) };
  // Off again: the island is flat at y 0 once more.
  gf.setGroundField(null);
  out.flatAgain = { g: groundHeightAt(cols, HX, HZ, 0.8, 0.3), low: segmentBlocked(cols, new THREE.Vector3(HX - 22, 1.5, HZ), new THREE.Vector3(HX + 22, 1.5, HZ)) };
  return out;
}, { TAGS, HX, HZ });
check("loot dropped on the hill lies on its top", Math.abs(rest.loot - rest.peak) < 0.01 && rest.peak > 3.9, JSON.stringify({ loot: rest.loot, peak: rest.peak }));
check("a bot's landing spot on the hill is on the slope", Math.abs(rest.landing - rest.landingWant) < 0.01, JSON.stringify({ landing: rest.landing, want: rest.landingWant }));
check("a bot put on the slope stands on it", rest.bot && Math.abs(rest.bot.y - rest.bot.g) < 0.3 && rest.bot.g > 1, JSON.stringify(rest.bot));
check("the bots' grid still crosses the hill", rest.route);
check("the hill blocks an eye-level shot and a bot's line of sight", rest.low.blocked && rest.low.ray < 30, JSON.stringify(rest.low));
check("...but not one over its top", !rest.high.blocked && rest.high.ray >= 44, JSON.stringify(rest.high));
check("no field: flat at y 0 and the shot is clear, as before", rest.flatAgain.g === 0 && !rest.flatAgain.low, JSON.stringify(rest.flatAgain));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
