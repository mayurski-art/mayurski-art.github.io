// Troll Forces UAV / Counter-UAV (STREAK-REALISM.md phase 2): the recon
// plane is the RQ-7 Shadow and the minimap sweeps while it's up.
//   1. a UAV spawns the Shadow: the prop, the blur disc and the strobe are
//      there and the jammer nodes are hidden; the prop turns and the strobe
//      blinks as it flies;
//   2. a Counter-UAV is the same airframe with the pods and the red band
//      shown;
//   3. with a UAV up the minimap draws a sweep that moves between frames;
//   4. no page errors.
// Writes shots to [shotsDir] when given.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-streak-uav-test.mjs [shotsDir]

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

const planeInfo = (counter) => page.evaluate((counter) => {
  const T = window.__trollOps;
  const planes = T.flyovers.filter((e) => !!e.counter === counter);
  const p = planes.at(-1);
  if (!p) return null;
  const names = [];
  p.root.traverse((o) => { if (o.name) names.push(o.name); });
  const vis = (n) => { const o = p.root.getObjectByName(n); return o ? o.visible : null; };
  let tris = 0;
  p.root.traverse((o) => { if (o.isMesh && o.visible) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return { names, prop: !!p.prop, propAngle: p.prop?.rotation.z ?? null, strobe: vis("Strobe"), pods: [vis("JamPodL"), vis("JamPodR"), vis("JamStripe")], blur: vis("ReconPropBlur"), tris: Math.round(tris), y: p.root.position.y };
}, counter);

/* ---- 1. the UAV */
await page.evaluate(() => { const T = window.__trollOps; T.spawnRecon(T.move.pos.x, T.move.pos.z, 0, 25, { team: null, counter: false }); });
await until(() => window.__trollOps.flyovers.some((e) => e.prop), 15000);
const u1 = await planeInfo(false);
// the headless sim runs well under real time: wait for it to fly a while
await until(() => window.__trollOps.flyovers[0].age > 0.4, 20000);
const u2 = await planeInfo(false);
// the shot: put it on its orbit, overhead and close, and look up at it
await page.evaluate(() => {
  const T = window.__trollOps; const p = T.flyovers[0];
  p.age = 8; p.place();
  T.move.pos.x = p.root.position.x; T.move.pos.z = p.root.position.z + 18;
  const d = p.root.position.clone().sub(T.move.pos);
  T.look.yaw = Math.atan2(-d.x, -d.z); T.look.pitch = Math.atan2(d.y - 1.6, Math.hypot(d.x, d.z));
});
await until(() => window.__trollOps.flyovers[0].age > 8.2, 10000);
await shot(page, "1-uav-shadow.png");
check("the UAV is the Shadow (prop, blur disc, strobe, jammer nodes present)", !!u1 && u1.prop && u1.blur !== null && u1.strobe !== null && u1.pods.every((v) => v !== null), JSON.stringify(u1?.pods));
check("a UAV flies clean: jammer pods and band hidden", !!u1 && u1.pods.every((v) => v === false));
check("the prop turns", !!u1 && !!u2 && u2.propAngle !== u1.propAngle, `${u1?.propAngle} -> ${u2?.propAngle}`);
check("under the tri budget", !!u1 && u1.tris <= 15000, `${u1?.tris} tris`);
// the strobe blinks: sample it over a few frames
// the headless sim runs well under real time: sample until both states show
const blinks = new Set();
for (let i = 0; i < 60 && !(blinks.has(true) && blinks.has(false)); i++) { blinks.add((await planeInfo(false))?.strobe); await sleep(120); }
check("the strobe blinks", blinks.has(true) && blinks.has(false), [...blinks].join("/"));

/* ---- 2. the Counter-UAV */
await page.evaluate(() => { const T = window.__trollOps; T.spawnRecon(T.move.pos.x, T.move.pos.z, 1, 25, { team: null, counter: true }); });
await until(() => window.__trollOps.flyovers.some((e) => e.counter && e.prop), 15000);
const c1 = await planeInfo(true);
await shot(page, "2-counter-uav.png");
check("the Counter-UAV carries its pods and the red band", !!c1 && c1.pods.every((v) => v === true), JSON.stringify(c1?.pods));

/* ---- 3. the minimap sweep */
const sweep = await page.evaluate(async () => {
  const T = window.__trollOps;
  const b = T.uavBucket();
  T.uavUntil[b] = performance.now() + 20000;
  const c = document.getElementById("to-minimap");
  const g = c.getContext("2d");
  const grab = () => { T.drawMinimap(); return g.getImageData(0, 0, c.width, c.height).data; };
  const a = grab();
  await new Promise((r) => setTimeout(r, 400));
  const bb = grab();
  let changed = 0, warm = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - bb[i]) + Math.abs(a[i + 1] - bb[i + 1]) > 12) changed++;
    if (bb[i] > 150 && bb[i + 1] < 140 && bb[i + 2] < 120) warm++;
  }
  const revealed = T.enemiesRevealed();
  T.uavUntil[b] = 0;
  return { revealed, changed, warm, px: c.width };
});
await shot(page, "3-minimap-sweep.png");
check("with a UAV up the minimap sweep is drawn and turning", sweep.revealed && sweep.warm > 20 && sweep.changed > 20, JSON.stringify(sweep));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
