// Troll Forces: a picture of every gun for the Locker's weapon cards
// (assets/games/troll-ops/ui/weapons/<id>.webp). Drawn by the game itself:
// view/zombies-thumbs.js gunThumb, the match's model with its default
// attachments, on a transparent background, at 2x for phones' screens.
// Run it again when a gun is added or its model changes.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-weapon-thumbs.mjs [id ...]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/games/troll-ops/ui/weapons");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__toBo2?.fn, null, { timeout: 180000 });
await page.waitForTimeout(1500);
// the modules at the tags the game imports them with (one copy of each)
const tag = (file, re) => fs.readFileSync(path.join(ROOT, "assets/games/troll-ops", file), "utf8").match(re)[0];
const THUMBS = "/assets/games/troll-ops/view/" + tag("view/zombies-kiosk.js", /zombies-thumbs\.js\?v=[^"]+/);
const WEAPONS = "/assets/games/troll-ops/" + tag("menu/menu-bo2.js", /weapons\/weapons\.js\?v=[^"]+/);
const only = process.argv.slice(2);
const shots = await page.evaluate(async ([THUMBS, WEAPONS, only]) => {
  const { gunThumb } = await import(THUMBS);
  const { WEAPON_DEFS } = await import(WEAPONS);
  const out = {};
  for (const id of Object.keys(WEAPON_DEFS)) {
    if (only.length && !only.includes(id)) continue;
    const png = await gunThumb(id);
    if (!png) { out[id] = null; continue; }
    const img = new Image();
    img.src = png;
    await img.decode();
    // trimmed to the gun (its alpha), with a little room round it
    const full = document.createElement("canvas");
    full.width = img.naturalWidth; full.height = img.naturalHeight;
    const fx = full.getContext("2d");
    fx.drawImage(img, 0, 0);
    const { data, width, height } = fx.getImageData(0, 0, full.width, full.height);
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) { out[id] = null; continue; }
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.05);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
    const c = document.createElement("canvas");
    c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
    c.getContext("2d").drawImage(full, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    out[id] = { webp: c.toDataURL("image/webp", 0.86), w: c.width, h: c.height };
  }
  return out;
}, [THUMBS, WEAPONS, only]);
let n = 0, bytes = 0;
for (const [id, s] of Object.entries(shots)) {
  if (!s) { console.log("no picture:", id); continue; }
  const buf = Buffer.from(s.webp.split(",")[1], "base64");
  fs.writeFileSync(path.join(OUT, `${id}.webp`), buf);
  n++; bytes += buf.length;
  console.log(`${id}.webp ${s.w}x${s.h} ${(buf.length / 1024).toFixed(1)} KB`);
}
console.log(`${n} pictures, ${(bytes / 1024).toFixed(0)} KB in ${path.relative(ROOT, OUT)}`);
await browser.close(); server.close();
