// Troll Forces: the in-match Esc menu, each tab, at a size (the lobby
// redesign's phase 6 before/after). Offline (Supabase blocked), solo Ops.
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-pause-shots.mjs [tag]
//   W=844 H=390 for a sideways phone; shots in .claude/run/pause-<tag>-<tab>.png
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, ".claude/run");
fs.mkdirSync(SHOTS, { recursive: true });
const TAG = process.argv[2] || "now";
const W = +process.env.W || 1280, H = +process.env.H || 720;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2?.fn, null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.evaluate(async () => { const T = window.__trollOps; T.setLoadWaitMax?.(8); T.setMode("ops"); await T.startGame(); });
await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 300000 });
await page.waitForTimeout(1500);
await page.evaluate(() => window.__trollOps.openPauseMenu());
await page.waitForTimeout(500);
for (const tab of ["settings", "controls", "players"]) {
  await page.evaluate((t) => document.querySelector(`.to-menu-tab[data-tab="${t}"]`)?.click(), tab);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, `pause-${TAG}-${tab}.png`) });
  console.log("shot", tab);
}
console.log(errors.length ? `page errors: ${errors.join(" | ")}` : "no page errors");
await browser.close(); server.close();
