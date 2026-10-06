// Troll Forces Grinmington 870 check: pump after each shot (forend slides
// back and home, gun locked while it does), shell-by-shell reload one
// shell at a time, empty reload ends on a rack, fire cuts a reload short.
// Screenshots go to OUT.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-shotgun-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || "";
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name) }); };

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.weaponId = "grinmington";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
// The map loads behind its loading screen first; wait for the match to be live.
await page.waitForFunction(() => { const s = window.__trollOps.loadState(); return window.__trollOps.state() === "playing" && !s.open && !s.hold; }, null, { timeout: 180000 });
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
// The Blender model streams in and replaces the procedural stand-in.
await page.waitForFunction(() => window.__trollOps.activeWeaponMesh()?.userData.pumpMesh?.name === "GM_Pump", null, { timeout: 30000 }).catch(() => {});
const model = await page.evaluate(() => {
  const m = window.__trollOps.activeWeaponMesh();
  let tris = 0;
  m.traverse((o) => { if (o.isMesh && o.visible && !o.userData.hand) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return { pump: m.userData.pumpMesh?.name, shell: m.userData.shellMesh?.name, tris: Math.round(tris), irons: !!m.getObjectByName("GM_IronRear")?.visible };
});
check("Grinmington wears the Blender 870 MCS model", model.pump === "GM_Pump" && model.shell === "GM_Shell" && model.tris > 30000, JSON.stringify(model));
await shot(page, "0-hip.png");
await page.evaluate(() => window.__trollOps.setAds(true));
await sleep(700);
await shot(page, "0-ads.png");
await page.evaluate(() => window.__trollOps.setAds(false));
await sleep(500);

const info = await page.evaluate(() => {
  const T = window.__trollOps, m = T.activeWeaponMesh();
  return { id: T.currentWeapon().def.id, pump: !!m?.userData.pumpMesh, shell: !!m?.userData.shellMesh, anchors: m?.userData.pfAnchors?.length };
});
check("Grinmington equipped", info.id === "grinmington", info.id);
check("model has a pump forend, a shell and both arm anchors", info.pump && info.shell && info.anchors === 2, JSON.stringify(info));

// Fire once and sample the forend + the lock.
const pump = await page.evaluate(async () => {
  const T = window.__trollOps, w = T.currentWeapon(), m = T.activeWeaponMesh();
  const rest = m.userData.pumpRestZ;
  T.fireOnce();
  const ammo = w.ammoInMag;
  let maxBack = 0, lockedAt = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 1200) {
    await new Promise((r) => requestAnimationFrame(r));
    maxBack = Math.max(maxBack, m.userData.pumpMesh.position.z - rest);
    lockedAt.push([Math.round(performance.now() - t0), w.canFire()]);
  }
  const firstFree = lockedAt.find(([, ok]) => ok)?.[0] ?? -1;
  return { ammo, maxBack, home: Math.abs(m.userData.pumpMesh.position.z - rest), firstFree };
});
check("shot used a shell", pump.ammo === 7, String(pump.ammo));
check("forend racks back", pump.maxBack > 0.06, pump.maxBack.toFixed(3));
check("forend returns home", pump.home < 1e-4, pump.home.toFixed(4));
check("can't fire until the pump is done", pump.firstFree >= 780 && pump.firstFree < 1100, `${pump.firstFree} ms`);

// Mid-pump screenshot.
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.fireOnce();
  await new Promise((r) => setTimeout(r, 230));
});
await shot(page, "1-pump.png");
await sleep(800);

// Empty reload: shells go in one at a time, then a rack.
const rl = await page.evaluate(async () => {
  const T = window.__trollOps, w = T.currentWeapon();
  w.ammoInMag = 0;
  w.startReload();
  const seen = [];
  let rackSeen = false, shellShown = false;
  const t0 = performance.now();
  while (w.reloading && performance.now() - t0 < 8000) {
    await new Promise((r) => requestAnimationFrame(r));
    if (seen[seen.length - 1]?.[1] !== w.ammoInMag) seen.push([Math.round(performance.now() - t0), w.ammoInMag]);
    if (w.shellStage === "end" && w.shellDur > w.def.shellReload.end + 0.01) rackSeen = true;
    if (T.activeWeaponMesh().userData.shellMesh.visible) shellShown = true;
  }
  return { seen, rackSeen, shellShown, done: !w.reloading, ammo: w.ammoInMag, total: Math.round(performance.now() - t0) };
});
const steps = rl.seen.map((s) => s[1]);
check("shells load one at a time", steps.join(",") === "0,1,2,3,4,5,6,7,8", steps.join(","));
check("shell visible in the hand", rl.shellShown);
check("empty reload ends on a rack", rl.rackSeen);
check("full reload length", rl.total > 4500 && rl.total < 6200, `${rl.total} ms`);

// Screenshot mid shell.
await page.evaluate(async () => {
  const w = window.__trollOps.currentWeapon();
  w.ammoInMag = 2; w.startReload();
  await new Promise((r) => setTimeout(r, 650));
});
await shot(page, "2-shell.png");
await sleep(3000);

// Interrupt: fire mid-reload stops loading and doesn't rack (a shell's chambered).
const cut = await page.evaluate(async () => {
  const w = window.__trollOps.currentWeapon();
  w.ammoInMag = 3;
  w.startReload();
  await new Promise((r) => setTimeout(r, 900));
  const ok = w.interruptReload();
  const at = w.ammoInMag, dur = w.shellDur;
  const t0 = performance.now();
  while (w.reloading) await new Promise((r) => requestAnimationFrame(r));
  return { ok, at, after: w.ammoInMag, dur, ms: Math.round(performance.now() - t0), canFire: w.canFire() };
});
check("fire cuts the reload short", cut.ok && cut.after === cut.at && cut.after < 8, JSON.stringify(cut));
check("no rack after a cut (already chambered)", Math.abs(cut.dur - 0.26) < 1e-6);
check("gun is back up fast", cut.ms < 400 && cut.canFire, `${cut.ms} ms`);

// Attachments on the detailed model: glass on the rail (irons fold away),
// a device on the muzzle (the breacher comes off), a grip that rides the pump.
const att = await page.evaluate(async () => {
  const T = window.__trollOps;
  Object.assign(T.loadout.attachmentsFor("grinmington"), { optic: "reflex", barrel: "suppressor", underbarrel: "vert" });
  T.switchWeapon("secondary");
  T.switchWeapon("primary");
  const w = T.currentWeapon();
  // The game's own copy (its current ?v= tag): another tag is a second module
  // with none of the detailed models loaded.
  const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => /\/weapon-model\.js\?v=/.test(n));
  const { buildWeaponMesh } = await import(url);
  const m = buildWeaponMesh(T.loadout.resolved);
  const u = m.userData;
  const underOnPump = u.pumpMesh.children.some((c) => !c.userData.hand);
  return { sight: !!u.sight, irons: m.getObjectByName("GM_IronRear").visible, breacher: m.getObjectByName("GM_Breacher").visible,
    muzzleZ: +u.muzzleZ.toFixed(3), aimY: +u.aimPoint.y.toFixed(3), underOnPump };
});
check("reflex on the rail, irons folded", att.sight && !att.irons && att.aimY > 0.06, JSON.stringify(att));
check("suppressor replaces the breacher and moves the muzzle", !att.breacher && att.muzzleZ < -0.62);
check("vertical grip rides the pump", att.underOnPump);

check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
