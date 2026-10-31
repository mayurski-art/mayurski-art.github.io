// Troll Forces Lightning Strike (STREAK-REALISM.md phase 6): the strike jet
// is the F-35A.
//   1. a spawned strike loads strike-jet.glb with JetProp (the turbine the
//      game spins) and the Exhaust cone, under budget; the turbine turns;
//   2. the run still works: the jet shows up on its pass;
//   3. no page errors.
// Writes shots to [shotsDir] when given.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-streak-jet-test.mjs [shotsDir]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name) }); };

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
await sleep(500);
await page.evaluate(() => { const T = window.__trollOps; T.closePauseMenu(); if (T.isStaging()) T.endStaging(); T.breakSpawnGuard(); });
const until = (fn, ms = 15000) => page.waitForFunction(fn, null, { timeout: ms, polling: 30 }).then(() => true, () => false);

await page.evaluate(() => { const T = window.__trollOps; T.pendingStrikes.length = 0; T.spawnAirstrike({ x: T.move.pos.x, z: T.move.pos.z - 20, yaw: 0, owned: true, team: null }); });
await until(() => { const s = window.__trollOps.pendingStrikes[0]; return !!s && !!s.prop; }, 20000);
const info = () => page.evaluate(() => {
  const s = window.__trollOps.pendingStrikes[0];
  if (!s) return null;
  let tris = 0;
  s.jet.traverse((o) => { if (o.isMesh && o.visible) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return { model: s.jet.children.find((c) => c.userData.model)?.userData.model, prop: s.prop?.name, spin: s.prop?.rotation.z ?? null, exhaust: !!s.jet.getObjectByName("Exhaust"), tris: Math.round(tris), age: s.age, visible: s.jet.visible };
});
const a = await info();
// the jet only turns its turbine on its pass: step the run to just before
// it and tick it by hand
await page.evaluate(() => { const s = window.__trollOps.pendingStrikes[0]; s.age = s.t0 - 2; s.update(0.05); s.update(0.05); });
const b = await info();
await shot(page, "1-strike-jet.png");
check("the strike jet is the F-35 (strike-jet.glb with JetProp and Exhaust)", !!a && a.model === "strike-jet" && a.prop === "JetProp" && a.exhaust, JSON.stringify(a));
check("under the tri budget", !!a && a.tris <= 15000, `${a?.tris} tris`);
check("the turbine turns", !!a && !!b && b.spin !== a.spin, `${a?.spin} -> ${b?.spin}`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
