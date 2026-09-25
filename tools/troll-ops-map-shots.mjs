// Troll Ops map helper (see assets/games/troll-ops/HANDOFF.md). Usage: NODE_PATH=<checkout>/node_modules node tools/troll-ops-map-shots.mjs
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
// [x, y(eye feet), z, yawDeg (0 = looking -z), pitchDeg, tag]
// [x, feetY, z, lookX, lookY, lookZ, tag]
const VIEWS = {
  grinsite_wip: [
    [26, 26, 44, 0, 0, -2, "aerial"],
    [0, 0, 24, 0, 3, 0, "tower-from-south"],
    [-6, 6.7, -3, 26, 1, 10, "from-level2"],
    [10, 0, -10, 26, 1.5, 4, "container-yard"],
    [-12, 0, 14, -24, 1.5, -2, "foundation"],
    [-4, 0, -14, -4, 1.5, -22, "site-office"],
    [24, 3.55, 24, 0, 2, 0, "from-scaffold"],
    [-8, 0, -8, -16, 11, -16, "crane-load"],
    [14, 0, 27, 19, 0.5, 19, "forklift"],
    [-20, 0, 26, -24, 2, 22, "scaffold-close"],
  ],
};
for (const [id, views] of Object.entries(VIEWS)) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("ERR", id, e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (id) => {
    const T = window.__trollOps;
    T.setMode("ops"); T.loadout.mapId = id;
    await T.startGame(); if (T.isStaging()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
    const st = document.createElement("style");
    st.textContent = "body *:not(canvas):not(main):not(section):not(.arcade-shell) { visibility: hidden !important; } canvas { visibility: visible !important; } .to-minimap { display:none !important }";
    document.head.appendChild(st);
  }, id);
  await new Promise((r) => setTimeout(r, 6000));
  for (const [x, y, z, lx, ly, lz, tag] of views) {
    await page.evaluate(([x, y, z, lx, ly, lz]) => {
      const T = window.__trollOps;
      T.move.pos.set(x, y, z); if (T.move.velocity) T.move.velocity.set(0, 0, 0);
      const ex = x, ey = y + 1.6, ez = z;
      const dx = lx - ex, dy = ly - ey, dz = lz - ez;
      T.look.yaw = Math.atan2(-dx, -dz);
      T.look.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    }, [x, y, z, lx, ly, lz]);
    await new Promise((r) => setTimeout(r, y > 6 ? 120 : 700));
    await page.screenshot({ path: `${process.env.OUT || "."}/${id}-${tag}.jpg`, type: "jpeg", quality: 80 });
  }
  await page.close();
  console.log("done", id);
}
await browser.close(); server.close();
