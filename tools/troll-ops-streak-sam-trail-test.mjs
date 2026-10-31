// Troll Forces SAM Turret (STREAK-REALISM.md phase 10): its missiles leave
// a white smoke trail. Drives labs/streak-sheet.html's samTrail(): one
// missile flown a second drops a run of puff sprites into the scene, they
// fade out on their own a couple of seconds later, and clearMissiles
// leaves none behind.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-streak-sam-trail-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/assets/games/troll-ops/labs/streak-sheet.html`);
await page.waitForFunction(() => window.sheet, null, { timeout: 60000 });
const r = await page.evaluate(() => window.sheet.samTrail(1));
check("a second of flight drops a run of puffs", r.puffs >= 20 && r.sprites >= r.puffs, JSON.stringify(r));
check("the puffs fade out on their own", r.after === 0, `${r.after} left`);
check("clearMissiles leaves none behind", r.cleared === 0);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
