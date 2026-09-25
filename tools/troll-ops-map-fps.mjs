// Troll Ops map helper (see assets/games/troll-ops/HANDOFF.md). Usage: NODE_PATH=<checkout>/node_modules node tools/troll-ops-map-fps.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url); // run with NODE_PATH=<checkout>/node_modules
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
for (const [map, variant] of [["grinsite", "live"], ["grinsite_wip", "full"], ["grinsite", "live2"], ["grinsite_wip", "full2"]]) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("ERR", e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async ([map, variant]) => {
    const M = await import("/assets/games/troll-ops/maps.js");
    if (variant === "flat-ground") delete M.MAPS[map].ground.surface;
    const T = window.__trollOps; T.setMode("ops"); T.loadout.mapId = map;
    if (variant === "no-prop-shadows") setTimeout(() => T.scene.traverse((o) => { if (o.isMesh && o.parent && o.parent.type === "Group" && o.material?.name?.startsWith("GS_")) o.castShadow = false; }), 3000);
    await T.startGame(); if (T.isStaging()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
  }, [map, variant]);
  await new Promise((r) => setTimeout(r, 5000));
  const res = [];
  for (const [x, z, lx, lz] of [[0, 26, 0, 0], [26, 26, -10, -10], [-26, 20, 10, -20]]) {
    res.push(await page.evaluate(async ([x, z, lx, lz]) => {
      const T = window.__trollOps;
      T.move.pos.set(x, 0, z); T.look.yaw = Math.atan2(-(lx - x), -(lz - z)); T.look.pitch = 0.05;
      await new Promise((r) => setTimeout(r, 500));
      let n = 0; const t0 = performance.now();
      await new Promise((done) => { const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
      const info = T.renderer.info.render; let meshes=0, casters=0; T.scene.traverse(o=>{ if(o.isMesh){meshes++; if(o.castShadow) casters++;} }); const lights=[]; T.scene.traverse(o=>{ if(o.isLight && o.castShadow) lights.push(o.type); });
      return { fps: +(n / 3).toFixed(1), calls: info.calls, tris: info.triangles, meshes, casters, shadowLights: lights.join(",") };
    }, [x, z, lx, lz]));
  }
  console.log(variant, res.map(r=>r.fps).join(" "));
  await page.close();
}
await browser.close(); server.close();
