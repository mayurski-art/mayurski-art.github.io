// Troll Forces Hunter-Killer / Swarm (STREAK-REALISM.md phase 3): the HK
// drone is the tube-bodied fold-out-wing aircraft, in the hand and in the
// air, and its pusher prop spins about the body axis.
//   1. the in-hand drone viewmodel loads with its one rotor node;
//   2. a spawned drone has DroneRotor_0 and the Beacon, under the tri
//      budget, and the prop turns as it flies (rotation.y, the tipped node);
//   3. no page errors.
// Writes shots to [shotsDir] when given.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-streak-hk-test.mjs [shotsDir]

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

/* ---- 1. in the hand */
await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("drone"); T.callStreak("drone"); });
await until(() => window.__trollOps.player.holding === "streak", 8000);
await sleep(300);
const hand = await page.evaluate(() => {
  const T = window.__trollOps;
  const m = T.weaponRig.children.find((c) => c.visible && c.userData.rotors);
  return { holding: T.player.holding, found: !!m, rotors: m?.userData.rotors.length ?? 0 };
});
await shot(page, "1-hk-in-hand.png");
check("the HK is in the hands with its prop node", hand.holding === "streak" && hand.found && hand.rotors === 1, JSON.stringify(hand));
await until(() => window.__trollOps.player.holding !== "streak", 15000);

/* ---- 2. in the air */
await page.evaluate(() => { const T = window.__trollOps; T.spawnDrone({ id: "hk-test", targetId: null, owned: true, pos: T.move.pos.clone().add({ x: 0, y: 6, z: -6 }), yaw: 0, sky: true }); });
await until(() => { const d = window.__trollOps.streakEntities.get("hk-test"); return !!d && d.rotors.length > 0; }, 15000);
const info = () => page.evaluate(() => {
  const d = window.__trollOps.streakEntities.get("hk-test");
  if (!d) return null;
  let tris = 0;
  d.root.traverse((o) => { if (o.isMesh && o.visible) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return { rotor: d.rotors[0]?.name, beacon: !!d.root.getObjectByName("Beacon"), spin: d.rotors[0]?.rotation.y ?? null, tris: Math.round(tris), age: d.age };
});
const d1 = await info();
await page.waitForFunction((t0) => (window.__trollOps.streakEntities.get("hk-test")?.age ?? 0) > t0 + 0.3, d1?.age ?? 0, { timeout: 15000, polling: 30 }).catch(() => {});
const d2 = await info();
await page.evaluate(() => { const T = window.__trollOps; const d = T.streakEntities.get("hk-test"); d.frozen = true; const p = d.root.position; p.set(T.move.pos.x + 1.5, T.move.pos.y + 2.2, T.move.pos.z - 3); const v = p.clone().sub(T.move.pos); T.look.yaw = Math.atan2(-v.x, -v.z); T.look.pitch = Math.atan2(v.y - 1.6, Math.hypot(v.x, v.z)); });
await sleep(400);
await shot(page, "2-hk-in-air.png");
check("the spawned HK is the new build (DroneRotor_0, Beacon)", !!d1 && d1.rotor === "DroneRotor_0" && d1.beacon, JSON.stringify(d1));
check("under the tri budget (24 fly in a Swarm)", !!d1 && d1.tris <= 4000, `${d1?.tris} tris`);
check("the prop turns about the body axis", !!d1 && !!d2 && d2.spin !== d1.spin, `${d1?.spin} -> ${d2?.spin}`);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
