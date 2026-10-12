// Troll Forces load smoke: open the page with test hooks and print every
// page error and failed request until the hooks appear (or 60 s pass).
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-load-smoke.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route(/supabase/, (r) => r.abort());
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|supabase|ERR_FAILED/i.test(m.text())) console.log("CONSOLE", m.text()); });
page.on("response", (r) => { if (r.status() >= 400) console.log("HTTP", r.status(), r.url().replace(/^http:\/\/localhost:\d+/, "")); });
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
const ok = await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 }).then(() => true).catch(() => false);
console.log(ok ? "LOADED" : "DID NOT LOAD");
await browser.close(); server.close();
process.exit(ok ? 0 : 1);
