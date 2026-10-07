// Troll Forces rope test (movement.js STANCE.ROPE, maps.js api.rope), on
// Grinjuku's four ropes. Drives the movement controller at a fixed 60 Hz.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-rope-test.mjs [mapId]
//
// Per rope: walk in and climb to the top floor; let go halfway with a jump;
// look down and climb down; grab it from the top and go down; run past it
// sideways without grabbing it. Solo Ops (no room), Supabase blocked.

import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const MAP = process.argv[2] || "grinjuku";

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("ERR", e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async (map) => {
  const T = window.__trollOps; T.setMode("ops"); T.loadout.mapId = map;
  await T.startGame(); if (T.isStaging()) T.endStaging();
  T.player.maxHp = T.player.hp = 1e9;
}, MAP);
await new Promise((r) => setTimeout(r, 4000));

// Every case runs inside one evaluate, so no game frame lands mid-case.
const results = await page.evaluate(() => {
  const T = window.__trollOps, M = T.move;
  const ropes = M.arena.ropes;
  const out = [];
  const yawOf = (fx, fz) => Math.atan2(-fx, -fz);
  const place = (x, y, z) => { M.reset(x, z, y); M.velocity.set(0, 0, 0); };
  // run n frames of input; returns a trace summary
  const run = (n, inp) => {
    let maxY = M.pos.y, minY = M.pos.y, ropeFrames = 0, firstRope = -1;
    for (let i = 0; i < n; i++) {
      const f = typeof inp === "function" ? inp(i) : inp;
      M.update(1 / 60, { forward: 0, strafe: 0, jump: false, crouch: false, dive: false, speedMult: 1, sprintMult: 1.35, pitch: 0, ...f });
      maxY = Math.max(maxY, M.pos.y); minY = Math.min(minY, M.pos.y);
      if (M.stance === "rope") { ropeFrames++; if (firstRope < 0) firstRope = i; }
    }
    return { maxY, minY, ropeFrames, firstRope, end: [M.pos.x, M.pos.y, M.pos.z], stance: M.stance, grounded: M.grounded };
  };
  for (const r of ropes) {
    const tag = `rope (${r.x}, ${r.z})`;
    const toward = yawOf(r.dx, r.dz);           // facing the way you step off at the top
    const startX = r.x - r.dx * 1.8, startZ = r.z - r.dz * 1.8;

    // 1. walk in, climb, top out onto the floor
    place(startX, r.y0, startZ);
    let t = run(150, { forward: 1, yaw: toward });
    out.push([`${tag}: climb to the top floor`, t.ropeFrames > 0 && t.end[1] > r.y1 - 0.06 && t.stance === "stand" && t.grounded
      && Math.hypot(t.end[0] - r.x, t.end[2] - r.z) > 0.5, t]);

    // 2. halfway up, jump off: back on the floor below, no re-grab
    place(startX, r.y0, startZ);
    run(200, (i) => ({ forward: M.pos.y < (r.y0 + r.y1) / 2 ? 1 : 0, yaw: toward }));
    const before = M.stance;
    run(1, { jump: true, yaw: toward });
    t = run(90, { yaw: toward });
    out.push([`${tag}: jump off halfway`, before === "rope" && t.ropeFrames === 0 && t.stance === "stand" && t.end[1] < r.y0 + 0.05, t]);

    // 3. looking down, W climbs down
    place(startX, r.y0, startZ);
    run(200, () => ({ forward: M.pos.y < r.y0 + 1.6 ? 1 : 0, yaw: toward }));
    t = run(120, { forward: 1, yaw: toward, pitch: -0.9 });
    out.push([`${tag}: look down + W climbs down`, t.minY < r.y0 + 0.05 && t.stance === "stand", t]);

    // 4. from the top floor, walk into it and go down (W held throughout)
    place(r.x + r.dx * 1.6, r.y1, r.z + r.dz * 1.6);
    t = run(150, { forward: 1, yaw: yawOf(-r.dx, -r.dz) });
    out.push([`${tag}: grab from the top, go down`, t.ropeFrames > 0 && t.minY < r.y0 + 0.05, t]);

    // 5. run past it sideways, along the line it hangs on: no grab. Start
    // on whichever side is open floor (a rope room has a wall on one).
    const solidAt = (x, z) => T.colliders.some((c) => c.min.y < 1 && c.max.y > 0.4
      && x > c.min.x - 0.4 && x < c.max.x + 0.4 && z > c.min.z - 0.4 && z < c.max.z + 0.4);
    let sx = -r.dz, sz = r.dx;                  // across the rope's step-off direction
    if (solidAt(r.x - r.dx * 0.5 - sx * 3, r.z - r.dz * 0.5 - sz * 3)) { sx = -sx; sz = -sz; }
    place(r.x - r.dx * 0.5 - sx * 3, r.y0, r.z - r.dz * 0.5 - sz * 3);
    t = run(90, { forward: 1, yaw: yawOf(sx, sz) });
    out.push([`${tag}: running past doesn't grab`, t.ropeFrames === 0, t]);
  }
  return { n: ropes.length, out: out.map(([label, ok, t]) => [label, ok, { maxY: +t.maxY.toFixed(2), minY: +t.minY.toFixed(2), end: t.end.map((v) => +v.toFixed(2)), stance: t.stance, rope: t.ropeFrames }]) };
});

let fails = 0;
console.log(`${MAP}: ${results.n} ropes`);
if (!results.n) fails++;
for (const [label, ok, t] of results.out) {
  if (!ok) fails++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(44)} ${JSON.stringify(t)}`);
}
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
