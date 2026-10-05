// Troll Forces Soul Blazer check: the Blender model loads and is rigged
// (six charms, the jaw, the shell-counter skulls, hands, pump, shell); a
// shot fires nine pellets, snaps the jaw and spits fire; the charms swing
// when you turn and settle again; the flank skulls follow the ammo and the
// gun goes out on its last shell; the empty reload drops a shell in the
// port and relights at the pump slam, then feeds the rest; fire cuts a
// feeding reload short; the Grinmington's reload is untouched; the admire
// runs its own 6.5 s sequence. Screenshots go to OUT.
//
// Usage: OUT=<dir> node tools/troll-ops-soulblazer-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || "";
const ONLY = process.env.ONLY || "";   // e.g. "shot,admire" to run part of it
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
const want = (k) => !ONLY || ONLY.split(",").includes(k);

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1280), height: Number(process.env.H || 720) } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { const t = m.text(); if ((m.type() === "error" && !/Content Security|ERR_FAILED|supabase/i.test(t)) || /soul blazer/i.test(t)) errors.push(t); });
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.weaponId = "soulblazer";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 });
await page.waitForFunction(() => !!window.__trollOps.activeWeaponMesh()?.userData.sb, null, { timeout: 30000 });
await page.waitForFunction(() => !window.__trollOps.isStaging(), null, { timeout: 30000 });
for (let i = 0; i < 20; i++) {
  const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 500) requestAnimationFrame(f); else r(n * 2); }; requestAnimationFrame(f); }));
  if (fps >= 25) break;
}
// Look at something: a level view down the map.
await page.evaluate(() => { const T = window.__trollOps; T.look.pitch = 0; });
await sleep(300);

const info = await page.evaluate(() => {
  const m = window.__trollOps.activeWeaponMesh(), u = m.userData, sb = u.sb;
  const charmMeshes = [];
  m.traverse((o) => { if (o.userData.charm != null) charmMeshes.push(o.userData.charm); });
  return {
    id: window.__trollOps.currentWeapon().def.id, charms: new Set(charmMeshes).size, jaw: sb.jawMeshes.length,
    slots: sb.slotZ.length, pump: u.pumpMesh?.name, shell: u.shellMesh?.name, anchors: u.pfAnchors?.length,
    grip: !!u.gripPos, eject: !!u.ejectPort, keys: u.inspectKeys?.length, halos: sb.halos.length,
  };
});
check("Soul Blazer equipped with the Blender model", info.id === "soulblazer" && info.pump === "SB_Pump" && info.shell === "SB_Shell", JSON.stringify(info));
check("six charms, the jaw, six shell skulls, both hand anchors", info.charms === 6 && info.jaw > 0 && info.slots === 6 && info.anchors === 2 && info.grip && info.eject);
check("its own admire keys", info.keys > 10, String(info.keys));
await shot(page, "sb-hip.png");

// One trigger pull (headless has no pointer lock for the mouse path).
const pull = () => page.evaluate(() => { const T = window.__trollOps; T.currentWeapon().pumpT = 0; T.currentWeapon().fireCooldown = 0; T.fireOnce();
  return T.bullets.bullets.filter((b) => b.def.hellfire && b.trail).length; });
const st = () => page.evaluate(() => {
  const T = window.__trollOps, w = T.currentWeapon(), sb = T.activeWeaponMesh().userData.sb;
  return { ammo: w.ammoInMag, reserve: w.ammoReserve, reloading: w.reloading, stage: w.shellStage, jaw: sb.jaw, heat: sb.heat,
    lit: sb.lit.map((v) => +v.toFixed(2)), fire: T.hellfireView.fire.p.length, world: T.hellfire.fire.p.length,
    charm: sb.charms.map((c) => +(2 * Math.acos(Math.min(1, Math.abs(c.q.w)))).toFixed(3)) };
});

if (want("shot")) {
  const a0 = (await st()).ammo;
  const bulletsBefore = await page.evaluate(() => window.__trollOps.bullets.bullets.length);
  const pellets = await pull(); await sleep(40);
  const mid = await st();
  await shot(page, "sb-fire.png");
  await sleep(50);
  await shot(page, "sb-fire2.png");
  await sleep(70);
  await shot(page, "sb-fire3.png");

  check("a shot spends one shell", mid.ammo === a0 - 1, `${a0} -> ${mid.ammo}`);
  check("nine burning pellets in flight", pellets >= 7, `${pellets} (before ${bulletsBefore})`);
  check("the jaw snaps open", mid.jaw > 0.5, mid.jaw.toFixed(2));
  check("fire out of the skull", mid.fire > 10, String(mid.fire));
  await sleep(500);
  const after = await st();
  check("the jaw shuts again", after.jaw < 0.1, after.jaw.toFixed(2));
  check("pellet fire in the world", after.world >= 0, String(after.world));
  await sleep(900);
}

// The fire frozen at set ages (headless frames and screenshots are too slow
// to catch a 0.3 s burst live).
if (want("fxlab")) {
  for (const age of [0.03, 0.08, 0.15, 0.26]) {
    await page.evaluate((a) => {
      const T = window.__trollOps;
      for (const fx of [T.hellfireView, T.hellfire]) { fx.timeScale = 0; fx.clear(); }
      const w = T.currentWeapon(); w.ammoInMag = 6; w.pumpT = 0; w.fireCooldown = 0;
      T.fireOnce();
      for (const fx of [T.hellfireView, T.hellfire]) { fx.timeScale = 1; fx.update(a); fx.timeScale = 0; }
      T.bullets.bullets.length = 0;
      T.activeWeaponMesh().userData.sb.lastShot = performance.now() + 1e5;   // hold the jaw where it is
    }, age);
    await sleep(120);
    await shot(page, `sb-fx-${Math.round(age * 1000)}ms.png`);
  }
  await page.evaluate(() => { const T = window.__trollOps; for (const fx of [T.hellfireView, T.hellfire]) { fx.timeScale = 1; fx.clear(); } T.activeWeaponMesh().userData.sb.lastShot = -1e9; });
}

// Another player's shot and a hellfire kill, out in the world (scale 1):
// must read as fire, not a white blob.
if (want("worldfx")) {
  for (const kind of ["burst", "kill"]) {
    await page.evaluate((k) => {
      const T = window.__trollOps;
      const fx = T.hellfire; fx.timeScale = 0; fx.clear();
      const cam = T.camera, f = new T.THREE.Vector3(); cam.getWorldDirection(f);
      const p = cam.position.clone().addScaledVector(f, 4);
      if (k === "burst") { const side = new T.THREE.Vector3(f.z, 0, -f.x).normalize(); p.addScaledVector(side, 1.2); fx.burst(p, side.negate(), 1); }
      else { p.y -= 1; fx.killBurst(p); }
      fx.timeScale = 1; fx.update(k === "burst" ? 0.1 : 0.25); fx.timeScale = 0;
    }, kind);
    await sleep(120);
    await shot(page, `sb-world-${kind}.png`);
  }
  await page.evaluate(() => { const fx = window.__trollOps.hellfire; fx.timeScale = 1; fx.clear(); });
}

if (want("charms")) {
  await sleep(1200);
  const rest = await st();
  // Swing the view hard for a moment.
  await page.evaluate(async () => {
    const T = window.__trollOps;
    const t0 = performance.now();
    await new Promise((r) => { const f = () => { const k = (performance.now() - t0) / 1000; T.look.yaw += 0.07; if (k < 0.35) requestAnimationFrame(f); else r(); }; f(); });
  });
  const swung = await st();
  await shot(page, "sb-charms-swing.png");
  // At rest they hang plumb, which is a few degrees off the gun's own down
  // in the hip pose; the swing is measured from there.
  const dev = (a) => a.charm.map((v, i) => Math.abs(v - rest.charm[i]));
  check("charms hang plumb, all alike, at rest", Math.max(...rest.charm) - Math.min(...rest.charm) < 0.03, rest.charm.join(","));
  check("turning swings the charms", Math.max(...dev(swung)) > 0.15, swung.charm.join(","));
  check("each charm swings its own way", new Set(swung.charm.map((v) => v.toFixed(2))).size >= 4, swung.charm.join(","));
  await sleep(4500);
  const settled = await st();
  check("they settle again", Math.max(...dev(settled)) < 0.04, settled.charm.join(","));
}

if (want("counter")) {
  await page.evaluate(() => { const w = window.__trollOps.currentWeapon(); w.ammoInMag = 4; });
  await sleep(500);
  let s = await st();
  check("four skulls lit for four shells", s.lit.filter((v) => v > 0.5).length === 4, s.lit.join(","));
  await page.evaluate(() => { const w = window.__trollOps.currentWeapon(); w.ammoInMag = 1; });
  await sleep(400);
  await pull();
  await sleep(180);
  await shot(page, "sb-last-shell.png");
  await sleep(800);
  s = await st();
  check("the last shell puts it out", s.ammo === 0 && s.heat < 0.15 && s.lit.every((v) => v < 0.1), `heat ${s.heat.toFixed(2)} lit ${s.lit.join(",")}`);
  await shot(page, "sb-dead.png");
}

if (want("reload")) {
  // Hold the reload at a point (k = 0..1 through the current stage) for a
  // screenshot: a page-side loop keeps resetting the stage clock.
  const hold = (k) => page.evaluate((v) => {
    window.__sbHold = v;
    if (window.__sbHoldLoop) return;
    window.__sbHoldLoop = true;
    const f = () => {
      const w = window.__trollOps.currentWeapon();
      if (window.__sbHold != null && w.reloading) w.shellT = (1 - window.__sbHold) * w.shellDur;
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }, k);
  await page.evaluate(() => { const w = window.__trollOps.currentWeapon(); w.ammoInMag = 0; w.ammoReserve = 30; w.pumpT = 0; });
  await sleep(300);
  const t0 = await page.evaluate(() => { window.__trollOps.currentWeapon().startReload(); return performance.now(); });
  await sleep(60);
  let s = await st();
  check("an empty reload starts with the port load", s.stage === "port", String(s.stage));
  await hold(0.09); await sleep(400);
  await shot(page, "sb-relight-open.png");
  await hold(0.4); await sleep(300);
  await shot(page, "sb-relight-drop.png");
  await hold(null);
  // the slam lands at 0.62 of the port stage: it relights
  await page.waitForFunction((t) => window.__trollOps.activeWeaponMesh().userData.sb.ignite > t, t0, { timeout: 12000 });
  await sleep(110);
  s = await st();
  await shot(page, "sb-relight-roar.png");
  check("the slam relights it", s.heat > 0.15 && s.jaw > 0.5, `heat ${s.heat.toFixed(2)} jaw ${s.jaw.toFixed(2)}`);
  await page.waitForFunction(() => window.__trollOps.currentWeapon().shellStage === "shell", null, { timeout: 12000 });
  s = await st();
  check("the port shell is chambered, then the tube is fed", s.ammo >= 1 && s.ammo + s.reserve === 30, `${s.ammo}/${s.reserve}`);
  await hold(0.55); await sleep(350);
  await shot(page, "sb-feed.png");
  await hold(null);
  await page.waitForFunction(() => window.__trollOps.currentWeapon().ammoInMag >= 3, null, { timeout: 12000 });
  s = await page.evaluate(() => { const w = window.__trollOps.currentWeapon(); const ok = w.interruptReload(); return { ok, stage: w.shellStage, dur: w.shellDur, end: w.def.shellReload.end }; });
  check("fire cuts the feeding short, with no rack (already chambered)", s.ok && s.stage === "end" && Math.abs(s.dur - s.end) < 1e-6, JSON.stringify(s));
  await page.waitForFunction(() => !window.__trollOps.currentWeapon().reloading, null, { timeout: 12000 });
  // a reload with shells still in it skips the port load
  await page.evaluate(() => { const w = window.__trollOps.currentWeapon(); w.ammoInMag = 2; w.startReload(); });
  s = await st();
  check("a reload with shells in it feeds the tube (no port load)", s.stage === "start", String(s.stage));
  await page.waitForFunction(() => !window.__trollOps.currentWeapon().reloading, null, { timeout: 12000 });
  // the Grinmington still reloads the old way from empty
  const gm = await page.evaluate(async () => {
    const { WeaponState, WEAPON_DEFS } = await import("/assets/games/troll-ops/weapons.js?v=p5bm-wst-hf1");
    const w = new WeaponState(WEAPON_DEFS.grinmington);
    w.ammoInMag = 0;
    w.startReload();
    const stages = [w.shellStage];
    for (let i = 0; i < 400 && w.reloading; i++) { w.cancelReloadIfDone(0.02); if (stages[stages.length - 1] !== w.shellStage) stages.push(w.shellStage); }
    return { stages: stages.join(">"), ammo: w.ammoInMag, events: w.events.join(",") };
  });
  check("the Grinmington's empty reload is untouched (start, shells, rack)", gm.stages.startsWith("start>shell") && gm.ammo === 8 && /rack/.test(gm.events), JSON.stringify(gm));
  await sleep(600);
}

if (want("admire")) {
  await page.evaluate(() => { const w = window.__trollOps.currentWeapon(); w.ammoInMag = 6; w.pumpT = 0; });
  await sleep(600);
  const dur = await page.evaluate(() => { const T = window.__trollOps; T.startInspect(); return T.inspectT(); });
  check("the admire runs 6.5 s", Math.abs(dur - 6.5) < 0.05, dur.toFixed(2));
  for (const [t, name] of [[0.06, "a-raise"], [0.2, "a-wave"], [0.28, "a-wave2"], [0.44, "a-face"], [0.47, "a-face2"], [0.58, "a-roll"], [0.69, "a-right"], [0.75, "a-rattle"]]) {
    await page.evaluate((v) => window.__trollOps.setInspectFreeze(v), t);
    await sleep(t === 0.44 || t === 0.47 ? 450 : 250);
    await shot(page, `sb-${name}.png`);
  }
  const frame = await page.evaluate(() => {
    const T = window.__trollOps, m = T.activeWeaponMesh();
    const box = new T.THREE.Box3().setFromObject(m);
    return { min: box.min.toArray().map((v) => +v.toFixed(2)), max: box.max.toArray().map((v) => +v.toFixed(2)) };
  });
  console.log("      right-side bounds", JSON.stringify(frame));
  await page.evaluate(() => window.__trollOps.setInspectFreeze(null));
  await sleep(2500);
}

check("no page errors", errors.length === 0, errors.slice(0, 5).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "all passed");
process.exit(failures ? 1 : 0);
