// Troll Warfare's Locker (the lobby redesign, phase 4): a screenshot of
// every Locker screen at a size, for before/after. Offline (Supabase
// blocked); nothing starts a match.
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-fn-locker-shots.mjs [tag]
//   W=844 H=390 for a sideways phone; shots in .claude/run/locker-<tag>-<screen>.png
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
await page.waitForFunction(() => !!window.__toBo2?.fn, null, { timeout: 180000 });
await page.waitForTimeout(2500);
const SCREENS = (process.env.ONLY || "locker,classlist,class,classes,weapons,atts,att-0,gear-0,perk-0,streaks,cosmetics,faces,wrists,bodies,cards").split(",");
await page.click('.to-fn-tab[data-tab="locker"]');
await page.waitForTimeout(800);
for (const id of SCREENS) {
  await page.evaluate((id) => { const m = window.__toBo2.menu; if (id !== "locker") m.go(id); }, id);
  await page.waitForTimeout(id === "locker" ? 600 : 1400);
  await page.screenshot({ path: path.join(SHOTS, `locker-${TAG}-${id}.png`) });
  console.log("shot", id, await page.evaluate(() => window.__toBo2.menu.current()));
}
console.log(errors.length ? `page errors: ${errors.join(" | ")}` : "no page errors");
await browser.close(); server.close();
