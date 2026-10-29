// Troll Forces arms sheet (DESIGN-ARSENAL.md #10): every gun as the game
// builds it (labs/arms-sheet.html, buildWeaponMesh): a side, a 3/4 and a
// macro shot, plus tris, draws, materials and texture memory for the
// viewmodel (LOD0) and for everyone else (LOD1), each against the budget.
// Writes OUT/<id>-<view>.png, OUT/sheet.json and OUT/index.html (the sheet).
// Exits 1 if a v2 gun (one with baked maps) is over budget.
//
// Usage: NODE_PATH=<main checkout>/node_modules OUT=<dir> [GUNS=a,b] [TEST=lmao]
//        node tools/troll-ops-arms-sheet.mjs
// TEST=<id> puts the pipeline's test piece (weapons/arms-test.js) in that
// gun's place.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || path.join(ROOT, "_arms-sheet");
fs.mkdirSync(OUT, { recursive: true });
// DESIGN-ARSENAL.md §2 budgets
const BUDGET = {
  lod0: { tris: 30000, trisUnique: 45000, draws: 8, texMB: 22 },   // one 1024 set: 3 x 5.3 MB, plus optics
  lod1: { tris: 6000, draws: 2, texMB: 1.5 },
};
const UNIQUE = new Set(["beast", "soulblazer", "greencandles"]);

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
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
const test = process.env.TEST || "";
await page.goto(`${BASE}/assets/games/troll-ops/labs/arms-sheet.html${test ? `?test=${test}` : ""}`);
try {
  await page.waitForFunction(() => window.sheet, null, { timeout: 60000 });
} catch (e) {
  console.log("the sheet page never came up:", errors.slice(0, 5).join(" | ") || e.message);
  process.exit(1);
}
await page.evaluate(() => window.sheet.ready);
const guns = process.env.GUNS?.split(",") || await page.evaluate(() => window.sheet.guns());

const rows = [];
let over = 0;
for (const id of guns) {
  const row = { id, shots: {} };
  for (const view of ["side", "q34", "macro"]) {
    const url = await page.evaluate(([i, v]) => window.sheet.shoot(i, v), [id, view]);
    const f = `${id}-${view}.png`;
    fs.writeFileSync(path.join(OUT, f), Buffer.from(url.split(",")[1], "base64"));
    row.shots[view] = f;
  }
  row.lod0 = await page.evaluate((i) => window.sheet.stats(i, 0), id);
  row.lod1 = await page.evaluate((i) => window.sheet.stats(i, 1), id);
  const b0 = BUDGET.lod0, b1 = BUDGET.lod1;
  const triCap = UNIQUE.has(id) ? b0.trisUnique : b0.tris;
  row.flags = [
    row.lod0.tris > triCap && `LOD0 ${row.lod0.tris} tris > ${triCap}`,
    row.lod0.draws > b0.draws && `LOD0 ${row.lod0.draws} draws > ${b0.draws}`,
    row.lod0.texMB > b0.texMB && `LOD0 ${row.lod0.texMB} MB textures > ${b0.texMB}`,
    row.lod1.tris > b1.tris && `LOD1 ${row.lod1.tris} tris > ${b1.tris}`,
    row.lod1.draws > b1.draws && `LOD1 ${row.lod1.draws} draws > ${b1.draws}`,
    row.lod1.texMB > b1.texMB && `LOD1 ${row.lod1.texMB} MB textures > ${b1.texMB}`,
  ].filter(Boolean);
  row.v2 = row.lod0.textures > 0 && row.lod1.v2;
  if (row.v2 && row.flags.length) over++;
  console.log(`${row.flags.length ? (row.v2 ? "OVER" : "old ") : "ok  "}  ${id.padEnd(14)} LOD0 ${row.lod0.tris} tris ${row.lod0.draws} draws ${row.lod0.materials} mats ${row.lod0.texMB} MB | LOD1 ${row.lod1.tris} tris ${row.lod1.draws} draws ${row.lod1.texMB} MB${row.flags.length ? "  " + row.flags.join("; ") : ""}`);
  rows.push(row);
}
fs.writeFileSync(path.join(OUT, "sheet.json"), JSON.stringify(rows, null, 2));
const cell = (v, bad) => `<td class="${bad ? "bad" : ""}">${v}</td>`;
fs.writeFileSync(path.join(OUT, "index.html"), `<!doctype html><meta charset="utf-8"><title>Arms sheet</title>
<style>body{font:14px system-ui;background:#1c1c1e;color:#eee;margin:16px}h2{margin:24px 0 6px}img{width:300px;border-radius:8px;margin-right:6px}
table{border-collapse:collapse;margin-top:6px}td,th{padding:3px 10px;border-bottom:0.5px solid #444;text-align:right}.bad{color:#ff6b5e;font-weight:600}</style>
<h1>Arms sheet</h1><p>Budget: LOD0 &le; ${BUDGET.lod0.tris} tris (unique ${BUDGET.lod0.trisUnique}), &le; ${BUDGET.lod0.draws} draws; LOD1 &le; ${BUDGET.lod1.tris} tris, &le; ${BUDGET.lod1.draws} draws.</p>
${rows.map((r) => `<h2>${r.id}${r.v2 ? " (v2)" : ""}</h2><div>${Object.values(r.shots).map((f) => `<img src="${f}" alt="${r.id}">`).join("")}</div>
<table><tr><th></th><th>tris</th><th>draws</th><th>materials</th><th>textures</th><th>MB</th></tr>
<tr><th>LOD0</th>${cell(r.lod0.tris, r.lod0.tris > (UNIQUE.has(r.id) ? BUDGET.lod0.trisUnique : BUDGET.lod0.tris))}${cell(r.lod0.draws, r.lod0.draws > BUDGET.lod0.draws)}${cell(r.lod0.materials)}${cell(r.lod0.textures)}${cell(r.lod0.texMB, r.lod0.texMB > BUDGET.lod0.texMB)}</tr>
<tr><th>LOD1</th>${cell(r.lod1.tris, r.lod1.tris > BUDGET.lod1.tris)}${cell(r.lod1.draws, r.lod1.draws > BUDGET.lod1.draws)}${cell(r.lod1.materials)}${cell(r.lod1.textures)}${cell(r.lod1.texMB, r.lod1.texMB > BUDGET.lod1.texMB)}</tr></table>`).join("\n")}`);
console.log(`\nsheet: ${path.join(OUT, "index.html")}`);
if (errors.length) console.log("page errors:", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
process.exit(over || errors.length ? 1 : 0);
