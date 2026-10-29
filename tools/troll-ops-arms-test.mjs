// Troll Forces arsenal v2 check (DESIGN-ARSENAL.md Phase 1 foundation), on
// the pipeline's test piece (models/build_armstest.blender.py) put in the
// SWAT-556's place (weapons/arms-test.js): the GLB loads with its baked
// maps on one shared material and its moving parts; a shot runs the carrier
// back and home, pops the dust cover, pulls the trigger and throws brass;
// the last round locks the carrier back with the catch up; the empty
// reload's hand goes to the catch point and the carrier slams home under
// the slap; a tactical reload leaves it alone; brass never runs past its
// pool; third person carries the LOD1 (one node). Writes an animation strip
// of the fire cycle and the empty reload (OUT/arms-cycle-*.png,
// OUT/arms-reload-*.png): the pattern every gun session's test copies.
// Offline: Supabase blocked, no bots, never a public room.
//
// Usage: NODE_PATH=<main checkout>/node_modules OUT=<dir> node tools/troll-ops-arms-test.mjs

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
// the same module URLs game.js loads, so the page shares their state
const AT = "/assets/games/troll-ops/weapons/arms-test.js?v=at1";
const WM = "/assets/games/troll-ops/weapons/weapon-model.js?v=p5-em1-wst-hf1-wb1-ar1-ar2-fj1-br1-or1-rt1-ut1-rb4-hp1-bx1-mg1-sp1-sbolt1";
const BR = "/assets/games/troll-ops/view/brass.js?v=bs1";

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async (AT) => {
  const T = window.__trollOps;
  await (await import(AT)).useArmsTest("lmao");
  T.loadout.weaponId = "lmao";
  T.loadout.attachmentsFor("lmao").optic = "reflex";
  T.loadout.mapId = "trollcity";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
}, AT);
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 180000 });
await sleep(4500);
await page.evaluate(() => {
  const T = window.__trollOps;
  if (T.isStaging()) T.endStaging();
  T.player.maxHp = T.player.hp = 1e9;
  T.look.pitch = 0.04;
  T.switchWeapon("primary");
  T.setActiveWeaponMesh(T.currentWeapon().def);
  const d = T.currentWeapon().def;
  d.swayAmp = 0; d.bobAmp = 0;
});
await sleep(1500);

const raf = (n = 2) => page.evaluate(async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r)); }, n);
const parts = () => page.evaluate(() => {
  const P = window.__trollOps.activeWeaponMesh().userData.gunParts;
  const k = (p) => p ? +((p.kind === "hinge" ? p.node.rotation[p.axis] - p.rot[p.axis] : p.node.position[p.axis] - p.pos[p.axis]) / p.travel).toFixed(3) : null;
  return Object.fromEntries(Object.entries(P).map(([n, p]) => [n, k(p)]));
});

// 1. built from the baked GLB
const info = await page.evaluate(async () => {
  const m = window.__trollOps.activeWeaponMesh(), u = m.userData;
  const kit = [];
  m.traverse((o) => { if (o.isMesh && o.material?.name === "AT_Kit") kit.push(o.material); });
  const mat = kit[0];
  for (let i = 0; i < 100 && !(mat?.map?.image && mat.normalMap?.image && mat.roughnessMap?.image); i++) await new Promise((r) => setTimeout(r, 50));
  return {
    parts: Object.keys(u.gunParts ?? {}).sort(), eject: !!u.gunPoints?.eject, charge: !!u.gunPoints?.charge, catch: !!u.gunPoints?.catch,
    kitMeshes: kit.length, shared: new Set(kit).size === 1 && mat?.userData.shared,
    maps: mat ? [mat.map?.image?.width, mat.normalMap?.image?.width, mat.roughnessMap === mat.metalnessMap && mat.aoMap === mat.roughnessMap,
      mat.map?.colorSpace, mat.normalMap?.colorSpace, mat.map?.flipY] : null,
    mag: !!u.magMesh, grip: !!u.gripPos, sight: !!u.sight, lod: u.lod,
  };
});
check("the test piece builds from the baked GLB with its moving parts and points",
  info.parts.join() === "Carrier,Catch,Charge,DustCover,Selector,Trigger" && info.eject && info.charge && info.catch && info.mag && info.grip && info.lod === 0, JSON.stringify(info));
check("every baked surface shares one material with base, ORM and normal maps",
  info.kitMeshes >= 7 && info.shared && info.maps?.[0] === 1024 && info.maps[1] === 1024 && info.maps[2] === true
  && info.maps[3] === "srgb" && info.maps[4] === "" && info.maps[5] === false, JSON.stringify(info));
check("a reflex sits on the rail", info.sight, JSON.stringify(info));
await shot(page, "arms-0-hip.png");

// 2. one shot: carrier back and home, cover open, trigger pulled and back, brass
const cyc = await page.evaluate(async (BR) => {
  const T = window.__trollOps, w = T.currentWeapon(), m = T.activeWeaponMesh(), P = m.userData.gunParts;
  const { liveBrass } = await import(BR);
  const k = (p) => (p.kind === "hinge" ? p.node.rotation[p.axis] - p.rot[p.axis] : p.node.position[p.axis] - p.pos[p.axis]) / p.travel;
  const a = () => m.userData.gunAction;
  w.fireCooldown = 0;
  T.fireOnce();
  const seen = { carrier: 0, trigger: 0, brass: 0 };
  // hold the cycle at fixed times: frames are slow headless
  for (const t of [0.015, 0.03, 0.05]) {
    for (let i = 0; i < 2; i++) { a().hold = t; await new Promise((r) => requestAnimationFrame(r)); }
    seen.carrier = Math.max(seen.carrier, k(P.Carrier));
    seen.trigger = Math.max(seen.trigger, k(P.Trigger));
    seen.brass = Math.max(seen.brass, liveBrass());
  }
  a().hold = 0.5;
  for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(r));
  const home = { carrier: k(P.Carrier), trigger: k(P.Trigger), cover: k(P.DustCover) };
  a().hold = null;
  return { seen, home, ammo: w.ammoInMag };
}, BR);
check("a shot runs the carrier back and home", cyc.seen.carrier > 0.95 && Math.abs(cyc.home.carrier) < 0.01, JSON.stringify(cyc));
check("a shot pulls the trigger and lets it go", cyc.seen.trigger > 0.95 && Math.abs(cyc.home.trigger) < 0.01, JSON.stringify(cyc));
check("the first shot pops the dust cover and it stays open", cyc.home.cover > 0.99, JSON.stringify(cyc));
check("a shot throws brass", cyc.seen.brass >= 1, JSON.stringify(cyc));

// the fire cycle strip
for (const [n, t] of [["a-rest", 1], ["b-back", 0.03], ["c-home", 0.05], ["d-done", 0.2]]) {
  await page.evaluate((t) => { window.__trollOps.activeWeaponMesh().userData.gunAction.hold = t; }, t);
  await raf(3);
  await shot(page, `arms-cycle-${n}.png`);
}
await page.evaluate(() => { window.__trollOps.activeWeaponMesh().userData.gunAction.hold = null; });

// 3. a long string of shots: brass keeps to its pool and its rate
const burst = await page.evaluate(async (BR) => {
  const T = window.__trollOps, w = T.currentWeapon();
  const { liveBrass } = await import(BR);
  let most = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 1500) {
    w.ammoInMag = Math.max(w.ammoInMag, 5); w.reloading = false; w.fireCooldown = 0;
    T.fireOnce();
    await new Promise((r) => requestAnimationFrame(r));
    most = Math.max(most, liveBrass());
  }
  return { most };
}, BR);
check("a long string keeps the brass inside its pool of 24", burst.most > 2 && burst.most <= 24, JSON.stringify(burst));
await sleep(800);

// 4. the last round: locked back, catch up
const lock = await page.evaluate(async () => {
  const T = window.__trollOps, w = T.currentWeapon();
  w.ammoInMag = 1; w.fireCooldown = 0;
  T.fireOnce();
  for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => setTimeout(r, 200));
  return { ammo: w.ammoInMag };
});
const locked = await parts();
check("the last round locks the carrier back with the catch up", lock.ammo === 0 && locked.Carrier > 0.99 && locked.Catch > 0.99, JSON.stringify({ lock, locked }));
await shot(page, "arms-1-locked.png");

// 5. the empty reload: held back, the hand on the catch, slammed home under the slap
const rel = await page.evaluate(async () => {
  const T = window.__trollOps, w = T.currentWeapon(), m = T.activeWeaponMesh(), P = m.userData.gunParts;
  const k = (p) => (p.kind === "hinge" ? p.node.rotation[p.axis] - p.rot[p.axis] : p.node.position[p.axis] - p.pos[p.axis]) / p.travel;
  w.ammoReserve = Math.max(w.ammoReserve, 60);
  w.startReload();
  const at = async (r) => {
    for (let i = 0; i < 3; i++) { w.reloadT = w.reloadTime * (1 - r); await new Promise((res) => requestAnimationFrame(res)); }
    m.updateMatrixWorld(true);
    return { carrier: +k(P.Carrier).toFixed(3), catch: +k(P.Catch).toFixed(3) };
  };
  const out = { empty: w.reloadWasEmpty, mid: await at(0.5), slap: await at(0.765), after: await at(0.86) };
  w.reloadT = 0.001;
  await new Promise((r) => setTimeout(r, 400));
  out.ammo = w.ammoInMag; out.size = w.def.magSize; out.reloading = w.reloading;
  out.after2 = +k(P.Carrier).toFixed(3);
  return out;
});
check("an empty reload holds the carrier back until the catch is slapped",
  rel.empty && rel.mid.carrier > 0.99 && rel.mid.catch > 0.99 && rel.after.carrier < 0.05 && rel.after.catch < 0.05, JSON.stringify(rel));
check("the empty reload fills the mag", rel.ammo === rel.size && !rel.reloading, JSON.stringify(rel));

// the hand goes to the gun's catch point (ar-reload.js "part" key)
const handAt = await page.evaluate(async () => {
  const T = window.__trollOps, w = T.currentWeapon(), m = T.activeWeaponMesh();
  const { applyArReload } = await import("/assets/games/troll-ops/view/ar-reload.js?v=ar1-br1-or1");
  w.ammoInMag = 0;
  w.ammoReserve = 60;
  w.startReload();
  w.reloadT = w.reloadTime * (1 - 0.75);
  await new Promise((r) => requestAnimationFrame(r));
  const h = applyArReload(m, w, 0.75);
  m.updateMatrixWorld(true);
  const pt = m.localToWorld(m.userData.gunPoints.catch.clone());
  const d = h ? h.pos.distanceTo(pt) : null;
  w.reloadT = 0.001;
  await new Promise((r) => setTimeout(r, 400));
  return { w: h?.w, d: d == null ? null : +d.toFixed(4) };
});
check("the empty reload's hand reaches the gun's catch point", handAt.w > 0.99 && handAt.d < 0.01, JSON.stringify(handAt));

// the empty reload strip
await page.evaluate(() => { const w = window.__trollOps.currentWeapon(); w.ammoInMag = 0; w.ammoReserve = 60; w.startReload(); });
for (const [n, r] of [["a-strip", 0.2], ["b-fetch", 0.4], ["c-seat", 0.6], ["d-reach", 0.72], ["e-slap", 0.77], ["f-home", 0.86]]) {
  await page.evaluate(async (r) => { const w = window.__trollOps.currentWeapon(); for (let i = 0; i < 3; i++) { w.reloadT = w.reloadTime * (1 - r); await new Promise((res) => requestAnimationFrame(res)); } }, r);
  await shot(page, `arms-reload-${n}.png`);
}
await page.evaluate(() => { window.__trollOps.currentWeapon().reloadT = 0.001; });
await sleep(500);

// 6. a tactical reload leaves the carrier home
const tac = await page.evaluate(async () => {
  const T = window.__trollOps, w = T.currentWeapon(), P = T.activeWeaponMesh().userData.gunParts;
  const k = (p) => (p.node.position[p.axis] - p.pos[p.axis]) / p.travel;
  w.ammoInMag = 10; w.ammoReserve = 60;
  w.startReload();
  let most = 0;
  for (const r of [0.3, 0.6, 0.9]) {
    for (let i = 0; i < 2; i++) { w.reloadT = w.reloadTime * (1 - r); await new Promise((res) => requestAnimationFrame(res)); }
    most = Math.max(most, k(P.Carrier));
  }
  w.reloadT = 0.001;
  await new Promise((r) => setTimeout(r, 400));
  return { empty: w.reloadWasEmpty, most, ammo: w.ammoInMag };
});
check("a tactical reload leaves the carrier home", !tac.empty && tac.most < 0.01 && tac.ammo === 30, JSON.stringify(tac));

// 7. everyone else: the LOD1, one node
const lod = await page.evaluate(async (WM) => {
  const { buildWeaponMesh } = await import(WM);
  const T = window.__trollOps;
  const g = buildWeaponMesh(T.currentWeapon().def, { lod: 1 });
  const meshes = [];
  // the gun's own nodes (the optic on its rail is the attachment's)
  g.traverse((o) => { if (o.isMesh && o.name.startsWith("AT_")) meshes.push(o); });
  let tris = 0;
  for (const o of meshes) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  return { lod: g.userData.lod, nodes: meshes.length, tris, parts: !!g.userData.gunParts, map: meshes[0]?.material?.map?.source?.data?.width ?? null };
}, WM);
check("everyone else gets the LOD1: one node, no moving parts, under 6k tris", lod.lod === 1 && lod.nodes <= 2 && !lod.parts && lod.tris < 6000, JSON.stringify(lod));
await page.evaluate(() => window.__trollOps.toggleThirdPerson());
await sleep(1500);
await shot(page, "arms-2-3p.png");
await page.evaluate(() => window.__trollOps.toggleThirdPerson());

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
