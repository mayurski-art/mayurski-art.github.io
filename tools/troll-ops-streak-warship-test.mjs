// Troll Forces VTOL Warship (STREAK-REALISM.md phase 8): the warship is the
// CV-22 Osprey.
//   1. a spawned warship loads vtol-warship.glb with both nacelles (tilted
//      for cruise), both rotors, the blur discs and the Strobe, under
//      budget; the rotors turn and the strobe blinks;
//   2. the gunner seat and both muzzles still resolve on the port side;
//   3. no page errors.
// Writes shots to [shotsDir] when given.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-streak-warship-test.mjs [shotsDir]

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

await page.evaluate(() => { const T = window.__trollOps; T.spawnWarship({ id: "ws-test", seed: 40, owned: false, team: null }); });
await until(() => { const w = window.__trollOps.streakEntities.get("ws-test"); return !!w && w.rotors.length === 2; }, 20000);
const info = () => page.evaluate(() => {
  const w = window.__trollOps.streakEntities.get("ws-test");
  if (!w) return null;
  let tris = 0;
  w.root.traverse((o) => { if (o.isMesh && o.visible) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  const g = w.gunnerPos(), m1 = w.muzzle("chain"), m2 = w.muzzle("cannon");
  const local = (v) => w.root.worldToLocal(v.clone());
  return { nacelles: w.nacelles.map((n) => [n.name, +n.rotation.x.toFixed(2)]), rotors: w.rotors.map((r) => r.name), spin: w.rotors.map((r) => r.rotation.y),
    blur: !!w.root.getObjectByName("VTOL_Blur_L") && !!w.root.getObjectByName("VTOL_Blur_R"), strobe: w.strobe ? w.strobe.visible : null,
    port: local(g).x < 0 && local(m1).x < 0 && local(m2).x < 0, tris: Math.round(tris), age: w.age };
});
const a = await info();
await page.waitForFunction((t0) => (window.__trollOps.streakEntities.get("ws-test")?.age ?? 0) > t0 + 0.4, a?.age ?? 0, { timeout: 15000, polling: 30 }).catch(() => {});
const b = await info();
await shot(page, "1-warship-osprey.png");
check("the warship is the Osprey (nacelles tilted, rotors, blur discs, Strobe)", !!a && a.nacelles.length === 2 && a.nacelles.every(([, x]) => x < -0.5) && a.rotors.length === 2 && a.blur && a.strobe !== null, JSON.stringify(a));
check("under the tri budget", !!a && a.tris <= 15000, `${a?.tris} tris`);
check("the rotors turn", !!a && !!b && b.spin[0] !== a.spin[0] && b.spin[1] !== a.spin[1], `${a?.spin} -> ${b?.spin}`);
check("gunner and muzzles on the port side", !!a && a.port);
// the headless sim runs well under real time: sample until both states show
const blinks = new Set();
for (let i = 0; i < 60 && !(blinks.has(true) && blinks.has(false)); i++) { blinks.add((await info())?.strobe); await sleep(120); }
check("the strobe blinks", blinks.has(true) && blinks.has(false), [...blinks].join("/"));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
