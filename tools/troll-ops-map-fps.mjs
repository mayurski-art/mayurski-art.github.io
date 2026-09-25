// Troll Ops frame check: fps, draw calls and program switches per frame (all
// render passes, counted at the WebGL call), meshes and materials, per map.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-map-fps.mjs [mapId ...]
//   ROOT_DIR=<another checkout> ... to measure an older build (git worktree add)
//
// Readings swing a few fps run to run and a lot with where the camera looks;
// compare builds from the same view, and more than once.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = process.env.ROOT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const views = JSON.parse(fs.readFileSync(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "tools/troll-ops-map-views.json"), "utf8"));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(views);
// one reading per map from its first saved camera view
for (const [map, x, z, lx, lz] of ids.map((id) => { const v = views[id][0]; return [id, v[0], v[2], v[3], v[5]]; })) {
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    // count every draw call a frame makes, across all render passes
    const orig = WebGL2RenderingContext.prototype;
    for (const fn of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
      const f = orig[fn];
      orig[fn] = function (...a) { window.__draws = (window.__draws || 0) + 1; return f.apply(this, a); };
    }
    for (const fn of ["useProgram"]) {
      const f = orig[fn];
      orig[fn] = function (...a) { window.__progs = (window.__progs || 0) + 1; return f.apply(this, a); };
    }
  });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (map) => { const T = window.__trollOps; T.setMode("ops"); T.loadout.mapId = map; await T.startGame(); if (T.isStaging()) T.endStaging(); T.player.maxHp = T.player.hp = 1e9; }, map);
  await new Promise((r) => setTimeout(r, 7000));
  const r = await page.evaluate(async ([x, z, lx, lz]) => {
    const T = window.__trollOps;
    T.move.pos.set(x, T.move.pos.y, z);
    T.look.yaw = Math.atan2(-(lx - x), -(lz - z)); T.look.pitch = 0.05;
    await new Promise((r) => setTimeout(r, 1000));
    window.__draws = 0; window.__progs = 0;
    let n = 0; const t0 = performance.now();
    await new Promise((done) => { const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
    const mats = new Set();
    let meshes = 0;
    (T.scene || { traverse() {} }).traverse((o) => { if (o.isMesh) { meshes++; mats.add(o.material); } });
    return { fps: +(n / 4).toFixed(1), drawsPerFrame: Math.round(window.__draws / n), programSwitches: Math.round(window.__progs / n), meshes, materials: mats.size };
  }, [x, z, lx, lz]);
  console.log(map.padEnd(10), JSON.stringify(r));
  await page.close();
}
await browser.close(); server.close();
