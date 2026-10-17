// Trolling Loud: the floor show comes from the mirror ball, not the DJ booth.
//   1. The laser burst's origin is the ball (within 0.3 m); the three floor
//      lights orbit it, still turning with it.
//   2. The map's light count is unchanged (18 in the scene).
//   3. No page errors.
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-tl-disco-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
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
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.loadout.mapId = "trollingloud";
  await T.startGame();
  if (T.isStaging()) T.endStaging();
});
await new Promise((r) => setTimeout(r, 5000));
const probe = () => page.evaluate(async () => {
  const T = window.__trollOps;
  await new Promise((r) => requestAnimationFrame(r));
  const ball = new T.scene.position.constructor(), o = new T.scene.position.constructor();
  let ballM = null, beams = null, n = 0;
  const pls = [];
  T.scene.traverse((m) => {
    if (m.isLight && !m.isAmbientLight && !m.isHemisphereLight && !m.isDirectionalLight) n++;
    if (m.isMesh && m.geometry?.type === "SphereGeometry" && Math.abs(m.geometry.parameters.radius - 0.55) < 1e-3 && m.geometry.parameters.widthSegments === 24) { const w = m.getWorldPosition(new T.scene.position.constructor()); if (Math.abs(w.y - 6.75) < 0.5) ballM = m; }
    if (m.isMesh && m.material?.blending === 2 && m.material.vertexColors && m.material.side === 2 && m.geometry.attributes.color?.count === 14 * 12 && Math.abs(m.getWorldPosition(new T.scene.position.constructor()).y - 6.75) < 0.5) beams = m;
    if (m.isPointLight && [34, 30].includes(m.intensity > 0 ? Math.round(m.intensity / 0.1) / 1 : 0)) pls.push(m);
  });
  if (!ballM || !beams) return { n, found: false };
  ballM.getWorldPosition(ball); beams.getWorldPosition(o);
  const near = [];
  T.scene.traverse((m) => {
    if (!m.isPointLight) return;
    const p = m.getWorldPosition(new T.scene.position.constructor());
    const d = Math.hypot(p.x - ball.x, p.z - ball.z);
    if (Math.abs(p.y - (ball.y - 0.45)) < 0.05 && Math.abs(d - 1.3) < 0.05) near.push(+d.toFixed(2));
  });
  return { n, found: true, d: o.distanceTo(ball), near };
});
const a = await probe();
check("laser burst + ball found", a.found);
check("laser origin is the ball (< 0.3 m)", a.found && a.d < 0.3, a.found ? a.d.toFixed(3) : "");
check("three floor lights ride the ball", a.found && a.near.length === 3, JSON.stringify(a.near));
check("light count 18, as before", a.n === 18, String(a.n));
await new Promise((r) => setTimeout(r, 1500));
const b = await probe();
check("light count unchanged after turning", b.n === a.n);
check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
