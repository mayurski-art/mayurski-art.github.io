// Troll Forces main menu on a sideways phone (four common sizes): no text on
// top of other text, measured with the shared ink scan. The list used to run
// its rows up into the description and "1 Online" (2026-10-12).
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-menu-phone-test.mjs
//   SIZES=844x390,... to pick; OUT=<dir> saves a screenshot per size
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { textClash } from "./troll-ops-text-scan.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || "";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const sizes = (process.env.SIZES || "844x390,740x360,932x430,667x375").split(",");
let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
for (const sz of sizes) {
  const [w, h] = sz.split("x").map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  await textClash(page, check, `main menu ${sz}`);
  if (OUT) await page.screenshot({ path: path.join(OUT, `menu-${sz}.png`) });
  await ctx.close();
}
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
