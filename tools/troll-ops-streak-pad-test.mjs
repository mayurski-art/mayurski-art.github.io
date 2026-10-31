// Troll Forces streak pad (STREAK-REALISM.md phase 1): the rugged tablet
// comes up with the real map on its screen, and the care package's smoke
// grenade is the same can in the hand and on the ground.
//   1. a UAV call raises the tablet: held, visible, its screen drawn from
//      this arena (the canvas is not one flat colour, the map's buildings
//      are on it), glare and link LED present;
//   2. a care package call raises the M18, and the thrown one lands as a
//      MarkerCanister built from the same can (lever, ring, strobe);
//   3. no page errors through either.
// Writes shots to [shotsDir] when given.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-streak-pad-test.mjs [shotsDir]

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
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name) }); };

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
await sleep(500);
await page.evaluate(() => { const T = window.__trollOps; T.closePauseMenu(); if (T.isStaging()) T.endStaging(); T.breakSpawnGuard(); });
const until = (fn, ms = 15000) => page.waitForFunction(fn, null, { timeout: ms, polling: 30 }).then(() => true, () => false);

/* ---- 1. the tablet */
await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("uav"); T.callStreak("uav"); });
// the screen is drawn by the hold's first frames: the headless sim is slow
await until(() => { const s = window.__trollOps.activeStreakMesh().userData.screen; const d = s.ctx.getImageData(0, 0, 8, 8).data; return d[0] + d[1] + d[2] > 0; }, 8000);
await sleep(200);
const pad = await page.evaluate(() => {
  const T = window.__trollOps;
  const m = T.activeStreakMesh();
  let meshes = 0;
  m.traverse((o) => { if (o.isMesh) meshes++; });
  const s = m.userData.screen;
  // how many distinct colours the screen holds, and whether the map's
  // building grey is on it
  const d = s.ctx.getImageData(0, 0, s.canvas.width, s.canvas.height).data;
  const colours = new Set();
  let building = 0;
  for (let i = 0; i < d.length; i += 16) {
    colours.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (Math.abs(d[i] - 0x3c) < 8 && Math.abs(d[i + 1] - 0x44) < 8 && Math.abs(d[i + 2] - 0x3d) < 8) building++;
  }
  return { holding: T.player.holding, visible: m.visible, meshes, colours: colours.size, building, glare: !!s.glare, leds: s.leds?.length, arena: !!T.builtMap() };
});
await shot(page, "1-pad-uav.png");
check("UAV call: the tablet is up", pad.holding === "streak" && pad.visible, JSON.stringify(pad));
check("the tablet is the rugged build (bumpers, keys, glass, glare)", pad.meshes >= 14 && pad.glare && pad.leds === 2, `${pad.meshes} meshes`);
check("its screen shows this map", pad.colours > 60 && pad.building > 200, `${pad.colours} colours, ${pad.building} building samples`);
await until(() => window.__trollOps.player.holding !== "streak");

/* ---- 2. the smoke grenade, in the hand and thrown */
await page.evaluate(() => { const T = window.__trollOps; T.closePauseMenu(); T.streaks.grant("carepackage"); T.callStreak("carepackage"); });
await until(() => window.__trollOps.player.holding === "streak", 5000);
await sleep(400);
const held = await page.evaluate(() => {
  const T = window.__trollOps;
  // the marker viewmodel: the one-handed device on the rig (no left anchor)
  const m = T.weaponRig.children.find((c) => c.userData.anchors && c.userData.anchors.left === null && c.visible) || null;
  let meshes = 0;
  m?.traverse((o) => { if (o.isMesh) meshes++; });
  return { marking: T.markingStreak(), meshes, strobe: !!m?.userData.strobe };
});
await shot(page, "2a-marker-held.png");
check("care package call: the M18 is in the hand", held.marking === "carepackage" && held.meshes >= 10 && held.strobe, JSON.stringify(held));
await page.evaluate(() => window.__trollOps.throwMarker());
await until(() => [...window.__trollOps.streakEntities.values()].some((e) => e.root?.userData.glow), 8000);
await sleep(300);
const thrown = await page.evaluate(() => {
  const T = window.__trollOps;
  const can = [...T.streakEntities.values()].find((e) => e.constructor.name === "MarkerCanister");
  let meshes = 0;
  can?.root.traverse((o) => { if (o.isMesh) meshes++; });
  return { found: !!can, meshes, glow: !!can?.root.userData.glow, strobe: !!can?.root.userData.strobe };
});
await shot(page, "2b-marker-thrown.png");
check("the thrown marker is the same can with its glow", thrown.found && thrown.meshes >= 10 && thrown.glow && thrown.strobe, JSON.stringify(thrown));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
