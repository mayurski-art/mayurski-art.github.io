// Troll Forces arsenal v2: one gun, four views on a 2x2 sheet (right side,
// front-right 3/4, rear-left 3/4, top) through labs/arms-sheet.html, the way
// the user reviews a model (DESIGN-ARSENAL.md §9.3). Writes OUT/<id>-four.png
// (and OUT/<id>-four-lod1.png with LOD=1). Supabase blocked, no room.
//
// Usage: OUT=<dir> GUNS=grinmington[,bellylaugh] [LOD=1] [SKIN=grinwood] node tools/troll-ops-arms-four.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || path.join(ROOT, "OUT");
fs.mkdirSync(OUT, { recursive: true });
const LOD = +(process.env.LOD || 0), SKIN = process.env.SKIN || null;
const GUNS = (process.env.GUNS || "problem416").split(",");
// yaw 0 = from the right side, 90 = from the muzzle; pitch up from level
const VIEWS = [["right side", 0, 4], ["front-right 3/4", 50, 18], ["rear-left 3/4", 230, 16], ["top", 0, 88]];

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

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/assets/games/troll-ops/labs/arms-sheet.html`);
await page.waitForFunction(() => window.sheet, null, { timeout: 60000 });
await page.evaluate(() => window.sheet.ready);
for (const id of GUNS) {
  const url = await page.evaluate(async ([id, views, lod, skin]) => {
    const W = 900, H = 520;
    const c = document.createElement("canvas");
    c.width = W * 2; c.height = H * 2;
    const g = c.getContext("2d");
    g.fillStyle = "#1c1c1e"; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < views.length; i++) {
      const [label, yaw, pitch] = views[i];
      const data = await window.sheet.orbit(id, yaw, pitch, { lod, skin });
      if (!data) continue;
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = data; });
      const x = (i % 2) * W, y = Math.floor(i / 2) * H;
      g.drawImage(img, x, y, W, H);
      g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(x, y, 230, 30);
      g.fillStyle = "#eee"; g.font = "16px system-ui"; g.fillText(`${id}: ${label}${lod ? " (LOD1)" : ""}`, x + 10, y + 21);
    }
    return c.toDataURL("image/png");
  }, [id, VIEWS, LOD, SKIN]);
  const f = path.join(OUT, `${id}-four${LOD ? "-lod1" : ""}${SKIN ? "-" + SKIN : ""}.png`);
  fs.writeFileSync(f, Buffer.from(url.split(",")[1], "base64"));
  console.log("wrote", f);
}
if (errors.length) console.log("page errors:", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
