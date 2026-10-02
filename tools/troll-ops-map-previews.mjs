// Renders the map-vote preview images: one establishing shot per versus map,
// saved to assets/games/troll-ops/ui/maps/<id>.jpg (640x360). Re-run after a
// map's look changes. Camera spots are hand-picked in VIEWS below.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-map-previews.mjs [mapId ...]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/games/troll-ops/ui/maps");
fs.mkdirSync(OUT, { recursive: true });
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
const BASE = `http://localhost:${server.address().port}`;

// [camera x, y, z, look-at x, y, z, fov]
const VIEWS = {
  grinsite:  [30, 16, 30, -4, 0, -4, 55],
  undergrin: [-9, 3.2, 27, 1, 1.4, -18, 70],
  dustbowl:  [33, 18, 33, -2, 0, -2, 55],
  depot:     [-25, 7.5, 19, 6, 1, -6, 68],
  culdegrin: [4, 26, 38, 0, 0, -4, 55],
  grinbeach: [40, 22, 30, -6, 0, -10, 55],
  hollowgrin: [50, 24, 52, -6, 0, -6, 58],   // wide: the map doubled (fair, Ferris wheel, the lane)
  grinleria: [22.5, 6.3, -1.2, -6, 2.0, 2.2, 72],
};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWS);

// ANGLE=swiftshader on a machine without a d3d11 GPU (Linux containers)
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
for (const id of ids) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`${id}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
  await page.evaluate(async (map) => {
    const T = window.__trollOps;
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.loadout.mapId = map;
    await T.startGame();
    if (T.isStaging()) T.endStaging();
  }, id);
  await new Promise((r) => setTimeout(r, +(process.env.WAIT || 6000)));   // models + textures stream in
  const data = await page.evaluate(async (v) => {
    const T = window.__trollOps;
    const cam = T.camera.clone();
    cam.fov = v[6];
    cam.aspect = 16 / 9;
    cam.near = 0.1;
    cam.far = 2000;
    cam.position.set(v[0], v[1], v[2]);
    cam.lookAt(v[3], v[4], v[5]);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    // After the game's own frame, draw ours over it and read it straight back.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return await new Promise((done) => requestAnimationFrame(() => {
      T.renderer.render(T.scene, cam);
      const src = T.renderer.domElement;
      const c = document.createElement("canvas");
      c.width = 640; c.height = 360;
      const sw = src.width, sh = Math.round(src.width * 9 / 16);
      c.getContext("2d").drawImage(src, 0, (src.height - sh) / 2, sw, sh, 0, 0, 640, 360);
      done(c.toDataURL("image/jpeg", 0.82));
    }));
  }, VIEWS[id]);
  fs.writeFileSync(path.join(OUT, `${id}.jpg`), Buffer.from(data.split(",")[1], "base64"));
  console.log(`${id}.jpg`);
  await page.close();
}
await browser.close();
server.close();
