// Troll Forces: the sight stays put aimed in while walking and shooting
// (user, 2026-10-29: "still too much bouncing while looking into the scope
// when walk/running while shooting"). Private TDM room, no bots.
//
// Aimed in on a reflex, it walks forward for 3 s firing whenever it can and
// samples, each frame, where the viewmodel's reticle sits as an angle from
// the weapon camera's axis (the viewmodel scene's origin, looking down -z),
// the gun's own wander on top of the aim. Reports the spread (max - min,
// degrees) and fails past MAX_DEG. Run it on the old code for the "before".
//
// Usage: node tools/troll-ops-ads-steady-test.mjs [gun] [optic]   (default: trollboy reflex)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [GUN = "trollboy", OPTIC = "reflex"] = process.argv.slice(2);
const MAX_DEG = 0.35;
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

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
const room = "STD" + Math.random().toString(36).slice(2, 7).toUpperCase();
await page.evaluate(async ([gun, optic, room]) => {
  const T = window.__trollOps;
  T.loadout.weaponId = gun;
  T.loadout.attachmentsFor(gun).optic = optic;
  T.loadout.mapId = "trollcity";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.els.room.value = room;
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
}, [GUN, OPTIC, room]);
await page.waitForFunction(() => { const s = window.__trollOps.loadState(); return window.__trollOps.state() === "playing" && !s.open && !s.hold; }, null, { timeout: 180000 });
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); T.player.hp = T.player.maxHp = 1e9; T.breakSpawnGuard?.(); T.switchWeapon("primary"); });
await new Promise((r) => setTimeout(r, 1000));

async function run(walk, shoot) {
  if (walk) await page.keyboard.down("KeyW");
  const out = await page.evaluate(async ([shoot]) => {
    const T = window.__trollOps, THREE = T.THREE, w = T.currentWeapon();
    T.setAds(true);
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    let t0 = performance.now();
    while (performance.now() - t0 < 1500) await frame();   // up to the eye, into the stride
    const mesh = T.activeWeaponMesh();
    let mark = null;
    mesh.traverse((o) => { if (!mark && (o.userData.reticle === "classic" || o.userData.reticle === "troll-idle")) mark = o; });
    const p = new THREE.Vector3();
    const xs = [], ys = [];
    let moving = 0, shots = 0, frames = 0;
    t0 = performance.now();
    while (performance.now() - t0 < 3000) {
      w.ammoInMag = w.def.magSize;
      if (shoot && w.canFire()) { T.fireOnce(); shots++; }
      await frame();
      mark.getWorldPosition(p);
      xs.push(Math.atan2(p.x, -p.z) * 180 / Math.PI);
      ys.push(Math.atan2(p.y, -p.z) * 180 / Math.PI);
      if (T.move.moving) moving++;
      frames++;
    }
    T.setAds(false);
    const span = (a) => Math.max(...a) - Math.min(...a);
    return { x: span(xs), y: span(ys), moving: moving / frames, shots, adsT: w.adsT };
  }, [shoot]);
  if (walk) await page.keyboard.up("KeyW");
  await new Promise((r) => setTimeout(r, 800));
  return out;
}

const still = await run(false, false);
const walk = await run(true, false);
const walkShoot = await run(true, true);
const f = (r) => `x ${r.x.toFixed(3)}° y ${r.y.toFixed(3)}°, moving ${(r.moving * 100).toFixed(0)}% of frames, ${r.shots} shots`;
console.log(`${GUN} ${OPTIC}`);
console.log(`  still:          ${f(still)}`);
console.log(`  walking:        ${f(walk)}`);
console.log(`  walking+firing: ${f(walkShoot)}`);
check("it walked", walk.moving > 0.8 && walkShoot.moving > 0.8, `${walk.moving.toFixed(2)} / ${walkShoot.moving.toFixed(2)}`);
check("it fired", walkShoot.shots > 5, `${walkShoot.shots}`);
check(`walking aimed: the sight wanders under ${MAX_DEG}°`, Math.max(walk.x, walk.y) < MAX_DEG, f(walk));
check(`walking and firing aimed: the sight wanders under ${MAX_DEG}°`, Math.max(walkShoot.x, walkShoot.y) < MAX_DEG, f(walkShoot));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "ALL PASS");
process.exit(failures ? 1 : 0);
