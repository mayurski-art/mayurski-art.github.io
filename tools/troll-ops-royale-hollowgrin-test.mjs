// Troll Royale on Hollowgrin ("Troll Royale: Two Worlds", phase 1: the
// island's underside, the 6v6 map as it is). The drop comes in over
// Hollowgrin on its own three planes; the night's fog thins for the ride
// down; a faller held hard for the far woods slides along the invisible
// wall and comes down inside it; every bot lands inside; the floor loot,
// the chests and the zone are Hollowgrin's.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-hollowgrin-test.mjs
// SHOTS=<dir> also saves the look down from the ramp, the fall and the landing.

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
await page.evaluate(async () => { const T = window.__trollOps; T.DROP.lobbySeconds = 14; T.setMode("royale_hollowgrin"); T.els.noBots.checked = false;
  // a private room, never the public one
  T.els.room.value = "RH" + Math.random().toString(36).slice(2, 5).toUpperCase(); T.els.room.dispatchEvent(new Event("input"));
  await T.startGame(); });
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 120000 });
await new Promise((r) => setTimeout(r, 1500));

const shot = (name) => process.env.SHOTS ? page.screenshot({ path: path.join(process.env.SHOTS, `royale-hollowgrin-${name}.jpg`), type: "jpeg", quality: 85 }) : null;
const B = { minX: -51, maxX: 87, minZ: -45, maxZ: 45 };
const inside = (p) => p.x >= B.minX && p.x <= B.maxX && p.z >= B.minZ && p.z <= B.maxZ;

const setup = await page.evaluate(() => {
  const T = window.__trollOps, r = T.royale(), sq = T.planes();
  const fl = sq.flights;
  return {
    map: T.builtMap()?.map?.name, me: r.me, planes: fl.length, over: fl.every((f) => f.over && f.tOut - f.tIn > 3),
    south: fl.every((f) => f.dir.z > 0.999), alts: fl.map((f) => Math.round(f.alt)),
    loot: r.loot.items.size, chests: r.chests?.chests.length || 0, bots: T.bots.bots.length,
  };
});
check("Royale: Hollowgrin loads Hollowgrin and starts you aboard", setup.map === "Hollowgrin" && setup.me === "aboard", JSON.stringify({ map: setup.map, me: setup.me }));
check("three planes, each run crossing Hollowgrin for over 3 s, due south", setup.planes === 3 && setup.over && setup.south, JSON.stringify({ planes: setup.planes, alts: setup.alts }));
check("Hollowgrin's floor loot and chests", setup.loot > 40 && setup.chests > 4, JSON.stringify({ loot: setup.loot, chests: setup.chests }));
check("24 trolls: you and 23 bots", setup.bots === 23, String(setup.bots));

await page.waitForFunction(() => window.__trollOps.royale().drop.phase === "run", null, { timeout: 120000 });
await shot("1-ramp");
const jumped = await page.evaluate(async () => {
  const T = window.__trollOps, r = T.royale(), t0 = r.planeT;
  T.keys.add("Space"); await new Promise((res) => setTimeout(res, 150)); T.keys.delete("Space");
  while (r.me === "aboard" && r.planeT - t0 < 8) await new Promise((res) => setTimeout(res, 50));
  return { me: r.me, fog: T.scene.fog.density, y: T.move.pos.y };
});
await new Promise((r) => setTimeout(r, 1200));
await shot("2-fall");
check("Space: off the ramp into a fall", jumped.me === "fall", jumped.me);
check("the night's fog is thin up high, so the ground shows", jumped.fog < 0.008, `density ${jumped.fog.toFixed(4)} at ${jumped.y.toFixed(0)} m`);
// Hold hard for the woods past the east wall, camera level: the invisible
// wall keeps you in.
await page.evaluate(() => {
  const T = window.__trollOps;
  T.look.yaw = Math.atan2(-(300 - T.move.pos.x), -(0 - T.move.pos.z));
  T.look.pitch = 0;
  T.keys.add("KeyW");
});
let maxOut = 0;
for (let i = 0; i < 400; i++) {
  const s = await page.evaluate(() => { const T = window.__trollOps; return { me: T.royale().me, x: T.move.pos.x, z: T.move.pos.z }; });
  maxOut = Math.max(maxOut, s.x - B.maxX, B.minX - s.x, s.z - B.maxZ, B.minZ - s.z);
  if (s.me === "roll" || s.me === "ground") break;
  await new Promise((r) => setTimeout(r, 100));
}
await page.evaluate(() => window.__trollOps.keys.delete("KeyW"));
await page.waitForFunction(() => window.__trollOps.royale().me === "ground", null, { timeout: 30000 }).catch(() => {});
const landed = await page.evaluate(() => { const T = window.__trollOps; return { me: T.royale().me, x: T.move.pos.x, y: T.move.pos.y, z: T.move.pos.z, fog: T.scene.fog.density, hp: T.player.hp }; });
check("held for the woods, the wall stops you: you never leave Hollowgrin in the air", maxOut <= 0.5, `${maxOut.toFixed(1)} m past the line at most`);
check("you land inside Hollowgrin, on your feet, unhurt", landed.me === "ground" && inside(landed) && landed.y < 20 && landed.hp === 100,
  JSON.stringify({ x: +landed.x.toFixed(1), y: +landed.y.toFixed(1), z: +landed.z.toFixed(1), hp: landed.hp }));
await shot("3-landed");
check("on the ground the night's fog is back", Math.abs(landed.fog - 0.016) < 1e-6, landed.fog.toFixed(4));

await page.waitForFunction(() => { const T = window.__trollOps; return T.royale().live && T.royale().drop.phase === "done" && T.bots.bots.every((b) => !b.alive || !b.airborne); }, null, { timeout: 150000 }).catch(() => {});
const after = await page.evaluate(() => {
  const T = window.__trollOps, r = T.royale(), B = { minX: -51, maxX: 87, minZ: -45, maxZ: 45 };
  const alive = T.bots.bots.filter((b) => b.alive);
  return {
    live: r.live, phase: r.drop.phase, airborne: alive.filter((b) => b.airborne).length, high: alive.filter((b) => b.pos.y > 20).length,
    out: alive.filter((b) => b.pos.x < B.minX || b.pos.x > B.maxX || b.pos.z < B.minZ || b.pos.z > B.maxZ).length,
    trolls: T.royaleAliveList().length, zoneR: Math.round(r.zone.state(0).r),
  };
});
check("every bot jumps and lands, the zone goes live", after.live && after.phase === "done" && after.airborne === 0 && after.high === 0 && after.trolls >= 20, JSON.stringify(after));
check("every bot is inside Hollowgrin's walls", after.out === 0, `${after.out} outside`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
