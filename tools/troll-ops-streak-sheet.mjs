// Troll Forces streak sheet (docs/STREAK-REALISM.md): every scorestreak
// model as the game builds it (labs/streak-sheet.html), four views on one
// image (side, front 3/4, rear 3/4, top), plus tris, draws, the named nodes
// the game animates and the .glb size, each against the doc's budget.
// Writes OUT/<id>.png, OUT/sheet.json and OUT/index.html.
// Exits 1 when a model is over budget, a named node is missing, or the
// streak .glb files together pass the 4 MB cap: this is the phase test.
//
// Usage: NODE_PATH=<main checkout>/node_modules OUT=<dir> [IDS=a,b]
//        node tools/troll-ops-streak-sheet.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODELS = path.join(ROOT, "assets/games/troll-ops/models");
const OUT = process.env.OUT || path.join(ROOT, "_streak-sheet");
fs.mkdirSync(OUT, { recursive: true });
// STREAK-REALISM.md budget
// the Dragonfire and the dog are already detailed: held where they are
const TRIS = { pad: 6000, marker: 1000, drone: 4000, dragonfire: 20000, samturret: 8000, k9: 10000, carepackage: 3000 };
const TRIS_AIRCRAFT = 15000;
const GLB_CAP = 600 * 1024, ALL_CAP = 4 * 1024 * 1024;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.goto(`${BASE}/assets/games/troll-ops/labs/streak-sheet.html`);
try {
  await page.waitForFunction(() => window.sheet, null, { timeout: 60000 });
} catch (e) {
  console.log("the sheet page never came up:", errors.slice(0, 5).join(" | ") || e.message);
  process.exit(1);
}
const ids = process.env.IDS?.split(",") || await page.evaluate(() => window.sheet.ids());

const rows = [];
let bad = 0;
const glbSeen = new Set();
let glbTotal = 0;
for (const id of ids) {
  const row = { id };
  const url = await page.evaluate((i) => window.sheet.four(i), id);
  fs.writeFileSync(path.join(OUT, `${id}.png`), Buffer.from(url.split(",")[1], "base64"));
  Object.assign(row, await page.evaluate((i) => window.sheet.stats(i), id));
  row.kb = row.glb ? Math.round(fs.statSync(path.join(MODELS, `${row.glb}.glb`)).size / 1024) : 0;
  if (row.glb && !glbSeen.has(row.glb)) { glbSeen.add(row.glb); glbTotal += row.kb; }
  const cap = TRIS[id] ?? TRIS_AIRCRAFT;
  row.flags = [
    row.tris > cap && `${row.tris} tris > ${cap}`,
    row.kb * 1024 > GLB_CAP && `${row.kb} KB > ${GLB_CAP / 1024}`,
    row.missing.length && `missing nodes ${row.missing.join(", ")}`,
  ].filter(Boolean);
  if (row.flags.length) bad++;
  console.log(`${row.flags.length ? "BAD " : "ok  "}  ${id.padEnd(12)} ${String(row.tris).padStart(6)} tris ${String(row.draws).padStart(3)} draws ${String(row.materials).padStart(3)} mats ${String(row.kb).padStart(4)} KB${row.flags.length ? "  " + row.flags.join("; ") : ""}`);
  rows.push(row);
}
console.log(`streak .glb total ${Math.round(glbTotal)} KB (cap ${ALL_CAP / 1024})`);
if (glbTotal * 1024 > ALL_CAP) bad++;
fs.writeFileSync(path.join(OUT, "sheet.json"), JSON.stringify(rows, null, 2));
fs.writeFileSync(path.join(OUT, "index.html"), `<!doctype html><meta charset="utf-8"><title>Streak sheet</title>
<style>body{font:14px system-ui;background:#1c1c1e;color:#eee;margin:16px}h2{margin:24px 0 6px}img{width:640px;border-radius:8px}.bad{color:#ff6b5e;font-weight:600}</style>
<h1>Streak sheet</h1>
${rows.map((r) => `<h2>${r.id} <small>${r.tris} tris, ${r.draws} draws, ${r.materials} mats, ${r.kb} KB</small>${r.flags.length ? ` <span class="bad">${r.flags.join("; ")}</span>` : ""}</h2><img src="${r.id}.png" alt="${r.id}">`).join("\n")}`);
console.log(`\nsheet: ${path.join(OUT, "index.html")}`);
if (process.env.SCREENS) for (const mode of process.env.SCREENS.split(",")) {
  const url = await page.evaluate(([m, c]) => window.sheet.screen(m, 1.2, c), [mode.replace("+", ""), mode.endsWith("+")]);
  fs.writeFileSync(path.join(OUT, `screen-${mode.replace("+", "-ok")}.png`), Buffer.from(url.split(",")[1], "base64"));
}
if (errors.length) console.log("page errors:", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
process.exit(bad || errors.length ? 1 : 0);
