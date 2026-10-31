// Troll Forces Helicopter Gunship (STREAK-REALISM.md phase 5): the gunship
// is the AH-64E Apache.
//   1. a spawned gunship loads helicopter.glb with MainRotor, TailRotor, the
//      blur disc and the Strobe, under budget; the rotors turn and the
//      strobe blinks as it flies in;
//   2. the searchlight still mounts (the nose is still -z);
//   3. no page errors.
// Writes shots to [shotsDir] when given.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-streak-gunship-test.mjs [shotsDir]

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
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
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

await page.evaluate(() => { const T = window.__trollOps; T.spawnHelicopter({ id: "heli-test", seed: 0.3, owned: true, team: null }); });
await until(() => { const h = window.__trollOps.streakEntities.get("heli-test"); return !!h && !!h.mainRotor && !!h.tailRotor; }, 20000);
const info = () => page.evaluate(() => {
  const h = window.__trollOps.streakEntities.get("heli-test");
  if (!h) return null;
  let tris = 0;
  h.root.traverse((o) => { if (o.isMesh && o.visible) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return { model: h.root.children.find((c) => c.userData.model)?.userData.model, main: h.mainRotor?.rotation.y ?? null, tail: h.tailRotor?.rotation.x ?? null,
    blur: !!h.root.getObjectByName("MainRotorBlur"), strobe: h.strobe ? h.strobe.visible : null, light: !!h.searchlight, tris: Math.round(tris), age: h.age };
});
const a = await info();
await page.waitForFunction((t0) => (window.__trollOps.streakEntities.get("heli-test")?.age ?? 0) > t0 + 0.4, a?.age ?? 0, { timeout: 15000, polling: 30 }).catch(() => {});
const b = await info();
// the shot: on station overhead, looked up at
await page.evaluate(() => {
  const T = window.__trollOps; const h = T.streakEntities.get("heli-test");
  h.age = 10; h.pathAt(10, h.root.position); h.root.rotation.y = h.headingAt(10);
  T.move.pos.x = h.root.position.x; T.move.pos.z = h.root.position.z + 14;
  const v = h.root.position.clone().sub(T.move.pos);
  T.look.yaw = Math.atan2(-v.x, -v.z); T.look.pitch = Math.atan2(v.y - 1.6, Math.hypot(v.x, v.z));
});
await page.waitForFunction(() => (window.__trollOps.streakEntities.get("heli-test")?.age ?? 0) > 10.2, null, { timeout: 15000, polling: 30 }).catch(() => {});
await shot(page, "1-gunship-apache.png");
check("the gunship is the Apache (helicopter.glb with MainRotor, TailRotor, blur disc, Strobe)", !!a && a.model === "helicopter" && a.main !== null && a.tail !== null && a.blur && a.strobe !== null, JSON.stringify(a));
check("under the tri budget", !!a && a.tris <= 15000, `${a?.tris} tris`);
check("the rotors turn", !!a && !!b && b.main !== a.main && b.tail !== a.tail, `${a?.main} -> ${b?.main}`);
check("the searchlight mounts", !!a && a.light);
// the headless sim runs well under real time: sample until both states show
const blinks = new Set();
for (let i = 0; i < 60 && !(blinks.has(true) && blinks.has(false)); i++) { blinks.add((await info())?.strobe); await sleep(120); }
check("the strobe blinks", blinks.has(true) && blinks.has(false), [...blinks].join("/"));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
