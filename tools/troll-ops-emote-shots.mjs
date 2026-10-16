// Troll Forces emotes, frozen: one contact sheet per emote, a row per body
// (the stick troll and each TROLLS body), a column per moment, front and
// three-quarter. Drawn by the main menu's operator (char-inspector.js), the
// emote clock set by hand, so every frame is exactly the moment asked for.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-emote-shots.mjs
//   EMOTES=dab,bird (ids from characters/emotes.js; default dab,bird)
//   TIMES=0.5,1.2 (seconds in; default: 5 moments across the emote)
//   BODIES=0,1718,820 (token per row, 0 = the stick; default all)
//   YAW=front|34|both (default both); ZOOM=1 (camera distance x); SHOTS_DIR=<dir>
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
await ctx.route(/supabase/, (r) => r.abort());   // never a live room
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps?.charInspector, null, { timeout: 90000 });
await page.waitForTimeout(2500);

const EMOTES = (process.env.EMOTES || "dab,bird").split(",");
const BODIES = (process.env.BODIES || "0,1718,989,820,1262").split(",").map(Number);
const YAWS = { front: [0], 34: [0.6], both: [0, 0.6] }[process.env.YAW || "both"];
const TIMES = process.env.TIMES ? process.env.TIMES.split(",").map(Number) : null;

const out = await page.evaluate(async ({ EMOTES, BODIES, YAWS, TIMES, ZOOM }) => {
  // the page's own module instances: the exact URLs (tags) it loaded
  const mod = (file) => import(performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes(`/characters/${file}?v=`)));
  const B = await mod("blocky-body.js");
  const E = await mod("emotes.js");
  const ci = window.__trollOps.charInspector;
  ci.autoSpin = false;
  ci.zoomTarget = ci.zoom = (ZOOM || 1);
  const rest = ci.yaw;
  const sheets = [];
  for (const id of EMOTES) {
    const idx = E.EMOTES.findIndex((e) => e.id === id);
    if (idx < 0) { sheets.push({ id, error: "no such emote" }); continue; }
    const secs = E.emoteSeconds(idx);
    const times = TIMES || [0.15, 0.3, 0.5, 0.7, 0.9].map((f) => +(f * Math.min(secs, 6)).toFixed(2));
    const cells = [];
    for (const tok of BODIES) {
      await B.wearBlocky(ci.humanoid, tok);
      for (const y of YAWS) {
        for (const t of times) {
          ci.yaw = rest + y; ci.pitch = ci.pitch; ci.idleT = -1e9; ci.dragging = true;
          // settle the blend from the last pose, then freeze at t
          for (let k = 0; k < 30; k++) { ci.emote = { code: E.emoteCode(idx), t: Math.max(0, t - 0.5 + k / 60), secs: 1e9 }; ci.tick(1 / 60); }
          ci.emote = { code: E.emoteCode(idx), t, secs: 1e9 };
          ci.tick(0);
          cells.push({ tok, y, t, url: ci.canvas.toDataURL() });
        }
      }
    }
    ci.emote = null;
    // one sheet: rows = body x yaw, columns = moments
    const imgs = await Promise.all(cells.map((c) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = c.url; })));
    const cw = imgs[0].width, chh = imgs[0].height;
    // crop every cell to the box round everything drawn in any of them
    let x0 = cw, y0 = chh, x1 = 0, y1 = 0;
    const probe = document.createElement("canvas");
    probe.width = cw; probe.height = chh;
    const pg = probe.getContext("2d", { willReadFrequently: true });
    for (const im of imgs) {
      pg.clearRect(0, 0, cw, chh); pg.drawImage(im, 0, 0);
      const d = pg.getImageData(0, 0, cw, chh).data;
      for (let y = 0; y < chh; y += 2) for (let x = 0; x < cw; x += 2) {
        if (d[(y * cw + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    const pad = 16;
    const sx = Math.max(0, x0 - pad), sy = Math.max(0, y0 - pad);
    const sw = Math.min(cw, x1 + pad) - sx, sh = Math.min(chh, y1 + pad) - sy;
    const cols = times.length, rows = cells.length / cols;
    const scale = Math.min(1, 360 / sh);
    const W = Math.round(sw * scale), H = Math.round(sh * scale);
    const sheet = document.createElement("canvas");
    sheet.width = W * cols + 70; sheet.height = H * rows + 24;
    const g = sheet.getContext("2d");
    g.fillStyle = "#26221f"; g.fillRect(0, 0, sheet.width, sheet.height);
    g.fillStyle = "#eee"; g.font = "13px monospace";
    times.forEach((t, c) => g.fillText(`t=${t}s`, 70 + c * W + 6, 16));
    cells.forEach((c, i) => {
      const r = Math.floor(i / cols), col = i % cols;
      g.drawImage(imgs[i], sx, sy, sw, sh, 70 + col * W, 24 + r * H, W, H);
      if (col === 0) g.fillText(`${c.tok || "stick"}${c.y ? " 3/4" : ""}`, 4, 24 + r * H + 20);
    });
    sheets.push({ id, url: sheet.toDataURL("image/png") });
  }
  return sheets;
}, { EMOTES, BODIES, YAWS, TIMES, ZOOM: +process.env.ZOOM || 0 });

for (const s of out) {
  if (s.error) { console.log(`${s.id}: ${s.error}`); continue; }
  const f = path.join(SHOTS, `emote-${s.id}.png`);
  fs.writeFileSync(f, Buffer.from(s.url.split(",")[1], "base64"));
  console.log("wrote", f);
}
console.log(errors.length ? "PAGE ERRORS " + errors.join(" | ") : "no page errors");
await browser.close(); server.close();
