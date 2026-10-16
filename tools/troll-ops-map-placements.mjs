// Troll Forces — dumps where a map puts its Blender models, for the light
// bakes (stylised realism, assets/games/troll-ops/docs/REALISM.md).
//
// Loads each map headless (view mode: no bots), waits for its models to
// stream in, and writes assets/games/troll-ops/models/<map>-placements.json:
// the map's bounds, the colours its bake should use (sky up = hemi.sky,
// horizon = sky.horizon, ground = ground.colorA), every placed model as
// [name, x, y, z, yaw, sx, sy, sz] (loadModel tags each copy with its name)
// and the map's point lights as [x, y, z, colour, intensity, distance].
// models/bake_map_ground.blender.py reads it.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-map-placements.mjs <mapId ...>
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODELS = path.join(ROOT, "assets/games/troll-ops/models");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const ids = process.argv.slice(2);
// maps.js at the exact URL game.js imports it by, so the page hands back the
// same module (its MAPS) instead of loading a second copy
const MAPS_URL = "./assets/games/troll-ops/" + fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/from "(\.\/maps\.js[^"]*)"/)[1].slice(2);
if (!ids.length) { console.error("usage: troll-ops-map-placements.mjs <mapId ...>"); process.exit(2); }

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
await ctx.route(/supabase/, (r) => r.abort());   // never a live room

for (const id of ids) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("ERR", id, e.message));
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (id) => {
    const T = window.__trollOps;
    window.TrollrunnerAccounts = window.TrollrunnerAccounts || {};
    window.TrollrunnerAccounts.getCachedProfile = () => ({ username: "troll_runner" });
    window.dispatchEvent(new Event("trollrunner:auth-changed"));
    T.settings.viewMode = true; T.setMode("ops"); T.loadout.mapId = id;
    await T.startGame(); if (T.isStaging()) T.endStaging();
  }, id);
  // models stream in after the build: wait until the count holds still
  const count = () => page.evaluate(() => { let n = 0; window.__trollOps.scene.traverse((o) => { if (o.userData.model) n++; }); return n; });
  let last = -1, n = await count();
  await new Promise((r) => setTimeout(r, 6000));
  n = await count();
  for (let i = 0; i < 30 && (n !== last || n === 0); i++) { await new Promise((r) => setTimeout(r, 1500)); last = n; n = await count(); }
  const out = await page.evaluate(async ([id, mapsUrl]) => {
    const T = window.__trollOps, THREE = await import("three");
    const map = (await import(mapsUrl)).MAPS[id];
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler(), rel = new THREE.Matrix4();
    const placements = [], lights = [];
    const r = (v) => Math.round(v * 1000) / 1000;
    T.scene.traverse((o) => {
      if (!o.userData.model && !o.isPointLight) return;
      o.updateWorldMatrix(true, false);
      // relative to the map root (the scene child above it): a preloaded map
      // is built off to one side, then moved
      let root = o; while (root.parent && root.parent !== T.scene) root = root.parent;
      if (root === o) return;   // the game's own lights, not the map's
      rel.copy(root.matrixWorld).invert().multiply(o.matrixWorld).decompose(p, q, s);
      // the map's lamps (api.lamp and the like): [x, y, z, colour, intensity, distance]
      // (pooled effect lights sit idle at intensity 0: not the map's)
      if (o.isPointLight) { if (o.intensity > 0) lights.push([r(p.x), r(p.y), r(p.z), o.color.getHex(), r(o.intensity), r(o.distance)]); return; }
      e.setFromQuaternion(q, "YXZ");
      placements.push([o.userData.model, r(p.x), r(p.y), r(p.z), r(e.y), r(s.x), r(s.y), r(s.z)]);
    });
    const hex = (c) => (c == null ? null : c);
    return {
      bounds: map.bounds,
      sky: [hex(map.hemi?.sky), hex(map.sky?.horizon)],
      ground: hex(map.ground?.colorA),
      placements,
      lights,
    };
  }, [id, MAPS_URL]);
  const file = path.join(MODELS, `${id}-placements.json`);
  fs.writeFileSync(file, JSON.stringify({ map: id, ...out }, null, 1) + "\n");
  console.log(`${id}: ${out.placements.length} placements, ${out.lights.length} lamps -> ${path.relative(ROOT, file)}`);
  await page.close();
}
await browser.close(); server.close();
