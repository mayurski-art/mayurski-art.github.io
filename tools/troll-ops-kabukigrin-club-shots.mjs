// Kabukigrin's club: screenshots of its key spots through the game's own
// renderer and post chain, plus draw calls / triangles / lights per view.
// Writes .claude/club-shots/<view>.png (kept out of git).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-kabukigrin-club-shots.mjs [view ...]
// MAP=<id> (default kabukigrin), TIER=low|medium|high, ANGLE=swiftshader.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, process.env.OUT || ".claude/club-shots");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

// [camera x, y, z, look-at x, y, z, fov]: Kabukigrin's club on Grinjuku's A
// side, and the street that sees it
const VIEWS = {
  hall:      [-15.2, 4.6, 14.5, -29, 2.2, 15, 74],
  floor:     [-19, 1.7, 21.5, -28, 2.6, 11, 78],
  dj:        [-21, 1.7, 15, -31.6, 3.0, 15, 76],
  bar:       [-22, 1.8, 18, -14.4, 1.8, 11, 74],
  ceiling:   [-22, 1.6, 19, -22, 7.0, 13, 84],
  marquee:   [-27, 1.8, -14, -26.5, 3.8, 4, 66],
  screen:    [-28.5, 1.8, -18, -23, 5.3, -2, 70],
  alta:      [12, 1.8, -40, 17, 4.8, -32, 72],
  midbottom: [3.5, 1.8, 20, -6, 4.6, 12, 74],
  midwall:   [3, 3.2, 14, -6, 5, 14, 82],
  corner:    [-24, 2, 13, -30.5, 4.5, 4.1, 80],
  poleScreen: [-19.5, 1.8, 15, -18.7, 4.3, 4.06, 62],
  swishScreen: [-21, 1.8, 13, -21.5, 4.3, 23.76, 62],
  // the borrowed rooms (phase 3b)
  vip:       [-24.8, 1.9, 26.2, -31.5, 1.4, 27.4, 78],
  vipHall:   [-26.5, 1.7, 19, -29, 1.9, 24.2, 70],
  office:    [-10.6, 4.7, 23.2, -14, 4.3, 20.6, 76],
  mirror:    [-22, 2.4, 17.5, -13.9, 4.6, 21.6, 60],
  yokocho:   [7.5, 1.6, -3, 23, 1.3, -3, 74],
  yokoBar:   [12.6, 1.6, -2.4, 9, 1.3, -3.9, 72],
  // Socialize's furniture (phase 5): the booths, the bar stools, the sofas, the door
  boothsS:   [-21.5, 1.7, 15.5, -21.5, 0.8, 23.4, 70],
  boothN:    [-22, 1.7, 10.5, -22, 0.8, 4.5, 66],
  stools:    [-20.5, 1.7, 7.5, -16.8, 0.8, 13, 70],
  sofaMezz:  [-11.6, 4.7, 12.5, -6.8, 3.5, 15.5, 70],
  door:      [-27.6, 1.7, -8, -27.6, 1.4, 3, 70],
};
const MAP = process.env.MAP || "kabukigrin";
if (process.env.VIEW) VIEWS.custom = process.env.VIEW.split(",").map(Number);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWS);

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log(`page error: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") console.log(`console: ${m.text()}`); });
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async ({ map, tier, mode }) => {
  const T = window.__trollOps;
  if (tier) T.settings.gfx = tier;
  T.setMode(mode);
  if (T.els.noBots) T.els.noBots.checked = true;
  T.loadout.mapId = map;
  await T.startGame();
  if (T.isStaging()) T.endStaging();
}, { map: MAP, tier: process.env.TIER || null, mode: process.env.MODE || "tdm" });
// the map built and its models streamed in (Kabukigrin's glbs outlast a fixed sleep)
await page.waitForFunction(() => !!window.__trollOps.builtMap()?.map && !window.__trollOps.loadState().open, null, { timeout: 240000 });
await new Promise((r) => setTimeout(r, +(process.env.WAIT || 5000)));
// the tier's passes (game.js GFX: medium drops SSAO, low drops bloom too),
// set directly in case applyGraphics hasn't run since the setting changed
if (process.env.TIER) await page.evaluate((tier) => {
  for (const p of window.__trollOps.composer.passes) {
    const n = p.constructor.name;
    if (/SSAO|SAO|GTAO/i.test(n)) p.enabled = tier === "high";
    if (/Bloom/i.test(n)) p.enabled = tier !== "low";
  }
}, process.env.TIER);

// SHOOT="x,y,z;x,y,z": a round into each point (the map's onShot), then the
// shot-out sign groups and the rooms' state; the shots below show them out
if (process.env.SHOOT) {
  const pts = process.env.SHOOT.split(";").map((p) => p.split(",").map(Number));
  const res = await page.evaluate(async (pts) => {
    const m = window.__trollOps.builtMap().map;
    for (const [x, y, z] of pts) m.onShot({ x, y, z });
    // (the shot-out state reaches the shader on the club's next tick)
    for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
    const d = m.debug?.() || {};
    return { out: (d.kill || []).map((k, g) => (k ? g : 0)).filter(Boolean), rooms: d.rooms || null };
  }, pts);
  console.log(`shot ${pts.length}: sign groups out ${JSON.stringify(res.out)}${res.rooms ? `, rooms ${JSON.stringify(res.rooms)}` : ""}`);
}

for (const id of ids) {
  const data = await page.evaluate(async (v) => {
    const T = window.__trollOps, R = T.renderer, C = T.composer, cam = T.camera;
    return await new Promise((done) => requestAnimationFrame(() => {
      cam.fov = v[6]; cam.aspect = 1280 / 720; cam.near = 0.1; cam.far = 2000;
      cam.position.set(v[0], v[1], v[2]);
      cam.lookAt(v[3], v[4], v[5]);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      // Socialize: the crowd shows by room from where the camera is now
      T.townNpcs?.()?.update(0, cam.position);
      for (const p of C.passes) for (const k of ["uHitFlash", "uLowHp", "uAberration", "uSuppress"]) if (p.uniforms?.[k]) p.uniforms[k].value = 0;
      R.info.autoReset = false;
      R.info.reset();
      C.render(0.016);
      C.render(0.016);
      const info = { calls: R.info.render.calls / 2, tris: Math.round(R.info.render.triangles / 2) };
      R.info.autoReset = true;
      let lights = 0;
      T.scene.traverse((o) => { if (o.isLight && o.visible && !o.isAmbientLight && !o.isHemisphereLight && !o.isDirectionalLight) lights++; });
      done({ url: R.domElement.toDataURL("image/png"), info, lights });
    }));
  }, VIEWS[id]);
  fs.writeFileSync(path.join(OUT, `${id}${process.env.TIER ? "-" + process.env.TIER : ""}.png`), Buffer.from(data.url.split(",")[1], "base64"));
  console.log(`${id}: ${data.info.calls} draws (incl. post), ${data.info.tris} tris, ${data.lights} point/spot lights`);
}
await browser.close();
server.close();
