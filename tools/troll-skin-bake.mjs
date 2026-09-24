// Bakes every Troll Ops weapon skin: runs tools/troll-skin-bake.html in a
// headless browser and writes assets/games/troll-ops/skins/<id>.jpg (the
// 1024x512 atlas the game loads) and <id>-thumb.jpg (the picker preview).
//
// Usage: node tools/troll-skin-bake.mjs [id,id,...]
//   Needs Playwright (npm i -g playwright, or run from a checkout that has it).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.execPath, "../../lib/node_modules/playwright"))); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/games/troll-ops/skins");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg" };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1300, height: 1300 } });
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(`http://localhost:${server.address().port}/tools/troll-skin-bake.html`);
await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });

const only = process.argv[2]?.split(",");
const ids = only || await page.evaluate(() => window.__skins);
fs.mkdirSync(OUT, { recursive: true });
const save = (file, dataUrl) => {
  const buf = Buffer.from(dataUrl.split(",")[1], "base64");
  fs.writeFileSync(path.join(OUT, file), buf);
  return buf.length;
};
for (const id of ids) {
  const { jpg, thumb } = await page.evaluate((id) => window.__bake(id), id);
  const a = save(`${id}.jpg`, jpg), t = save(`${id}-thumb.jpg`, thumb);
  console.log(`${id.padEnd(12)} atlas ${(a / 1024).toFixed(0)} KB   thumb ${(t / 1024).toFixed(0)} KB`);
}
if (!only) console.log(`factory      thumb ${(save("factory-thumb.jpg", await page.evaluate(() => window.__factoryThumb())) / 1024).toFixed(0)} KB`);
await browser.close();
server.close();
