// Trolling Loud: screenshots of the club's key spots through the game's own
// renderer and post chain, plus draw calls / triangles / lights per view.
// Writes .claude/club-shots/<view>.png (kept out of git).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-trollingloud-shots.mjs [view ...]
// MAP=<id> (default trollingloud), TIER=low|medium|high, ANGLE=swiftshader.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".claude/club-shots");
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
  hall:     [0, 6.3, 11.6, 0, 3.2, -15, 72],
  floor:    [0.5, 1.7, 5.5, 0, 3.6, -15, 78],
  ceiling:  [4, 1.7, 3, 0, 7.6, -4, 80],
  vip:      [-15.6, 1.8, 11.5, -25, 4.2, -3, 78],
  bar:      [16, 1.8, 11.5, 28.5, 2.8, -5, 76],
  mezz:     [-11.7, 6.2, 11.2, -10.5, 5.2, -15, 74],
  lobby:    [0, 1.7, 21.3, 0, 2.0, 13, 78],
  terrace:  [10.5, 6.2, 21.2, -3, 7.2, 13, 76],
  roof:     [22, 11, 19, -5, 9, -14, 70],
  alley:    [-16, 1.7, 31, 4, 4.5, 22, 72],
  yard:     [-22, 2, -31.5, 10, 2.5, -24, 70],
  aerial:   [48, 34, 52, 0, 3, 0, 55],
};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWS);
const MAP = process.env.MAP || "trollingloud";

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log(`page error: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") console.log(`console: ${m.text()}`); });
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async ({ map, tier }) => {
  const T = window.__trollOps;
  if (tier) T.settings.gfx = tier;
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.loadout.mapId = map;
  await T.startGame();
  if (T.isStaging()) T.endStaging();
}, { map: MAP, tier: process.env.TIER || null });
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

for (const id of ids) {
  const data = await page.evaluate(async (v) => {
    const T = window.__trollOps, R = T.renderer, C = T.composer, cam = T.camera;
    return await new Promise((done) => requestAnimationFrame(() => {
      cam.fov = v[6]; cam.aspect = 1280 / 720; cam.near = 0.1; cam.far = 2000;
      cam.position.set(v[0], v[1], v[2]);
      cam.lookAt(v[3], v[4], v[5]);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
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
