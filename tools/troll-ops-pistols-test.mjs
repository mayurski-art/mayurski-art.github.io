// Troll Forces pistols check (weapon-pistols.js: the Sixty-Nine and the
// TRUE-69): each builds with its anchors and slide, a shot cycles the slide
// and it comes home, the last round locks it back, an empty reload holds it
// back until the release and closes it, a tac reload is quicker and never
// moves it, the mag fills, aimed in the sight line sits on the screen
// centre, and the admire is the side-on showcase with a press-check.
// Offline: Supabase is blocked and there are no bots, so it never touches a
// public room. Screenshots go to OUT.
//
// Usage: NODE_PATH=<main checkout>/node_modules OUT=<dir> node tools/troll-ops-pistols-test.mjs

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

async function run(gunId) {
  const tag = gunId;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route(/supabase/, (r) => r.abort());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (id) => {
    const T = window.__trollOps;
    T.loadout.secondaryId = id;
    T.loadout.mapId = "trollcity";
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    await T.startGame();
  }, gunId);
  await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 });
  await sleep(4500);
  await page.evaluate(() => {
    const T = window.__trollOps;
    if (T.isStaging()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
    T.look.pitch = 0.04;
    T.switchWeapon("secondary");
  });
  await sleep(1200);

  const info = await page.evaluate(() => {
    const T = window.__trollOps, m = T.activeWeaponMesh(), u = m.userData, d = T.currentWeapon().def;
    return {
      id: d.id, action: !!u.pistolAction, pistol: !!u.pistol, grip: !!u.gripPos, mag: !!u.magMesh,
      hand: m.children.some((o) => o.userData.hand), support: !!u.supportHandPos, aim: !!u.aimPoint, muzzle: u.muzzleZ,
      keys: !!u.inspectKeys, mag0: T.currentWeapon().ammoInMag, magSize: d.magSize,
    };
  });
  check(`${tag}: built by weapon-pistols.js with its anchors`, info.id === gunId && info.action && info.pistol && info.grip && info.mag
    && info.hand && !info.support && info.aim && info.muzzle < -0.1 && info.keys, JSON.stringify(info));
  check(`${tag}: spawns with a full mag of ${info.magSize}`, info.mag0 === info.magSize, String(info.mag0));
  await sleep(300);
  await shot(page, `${tag}-0-hip.png`);

  // aimed in: the sight line runs through the screen centre (the weapon
  // camera sits at the weapon scene's origin looking down -z)
  await page.evaluate(() => window.__trollOps.setAds(true));
  await sleep(900);
  const sight = await page.evaluate(() => {
    const T = window.__trollOps, m = T.activeWeaponMesh();
    m.updateMatrixWorld(true);
    const V = m.position.constructor;
    const a = m.userData.aimPoint;
    const ang = (z) => { const p = m.localToWorld(new V(0, a.y, z)); return [+(p.x / -p.z).toFixed(4), +(p.y / -p.z).toFixed(4)]; };
    return { rear: ang(a.z + 0.06), front: ang(a.z - 0.15), ads: T.currentWeapon().adsT };
  });
  const off = Math.max(...sight.rear.map(Math.abs), ...sight.front.map(Math.abs));
  check(`${tag}: aimed, the sight line on the screen centre`, sight.ads > 0.99 && off < 0.006, JSON.stringify(sight));
  await shot(page, `${tag}-1-ads.png`);
  await page.evaluate(() => window.__trollOps.setAds(false));
  await sleep(700);

  // one shot: the slide goes back and comes home
  const cyc = await page.evaluate(async () => {
    const T = window.__trollOps, w = T.currentWeapon(), a = T.activeWeaponMesh().userData.pistolAction;
    w.fireCooldown = 0;
    T.fireOnce();
    const started = w.slideT > 0;
    // the real cycle is shorter than a headless frame: stretch it to 2 s
    // to read the slide at its peak (35% through), then put it back
    const cycle = w.def.slideCycle;
    w.def.slideCycle = 2;
    let max = 0;
    for (let i = 0; i < 3; i++) {
      w.slideT = 2 * 0.65;
      await new Promise((r) => requestAnimationFrame(r));
      max = Math.max(max, a.slide.position.z - a.slideRestZ);
    }
    w.def.slideCycle = cycle;
    w.slideT = cycle;
    await new Promise((r) => setTimeout(r, 400));
    return { started, max: +max.toFixed(4), home: +(a.slide.position.z - a.slideRestZ).toFixed(5), travel: a.travel };
  });
  check(`${tag}: a shot cycles the slide and it comes home`, cyc.started && cyc.max > cyc.travel * 0.5 && Math.abs(cyc.home) < 1e-4, JSON.stringify(cyc));
  await page.evaluate(() => { const T = window.__trollOps, w = T.currentWeapon(); w.fireCooldown = 0; T.fireOnce(); });
  await sleep(25);
  await shot(page, `${tag}-2-fired.png`);
  await sleep(500);

  // the last round: the slide locks back
  const lock = await page.evaluate(async () => {
    const T = window.__trollOps, w = T.currentWeapon(), a = T.activeWeaponMesh().userData.pistolAction;
    w.ammoInMag = 1;
    w.fireCooldown = 0;
    T.fireOnce();
    await new Promise((r) => setTimeout(r, 400));
    return { back: a.slide.position.z - a.slideRestZ, travel: a.travel, ammo: w.ammoInMag };
  });
  check(`${tag}: the last round locks the slide back`, lock.ammo === 0 && Math.abs(lock.back - lock.travel) < 1e-4, JSON.stringify(lock));
  await shot(page, `${tag}-3-locked.png`);

  // empty reload: the def's time, held back until the release, then home.
  // Each beat is set and read inside the page over two frames, so a slow
  // frame (a screenshot) can't carry the reload past it.
  const empty = await page.evaluate(() => { const T = window.__trollOps; T.tryReload(); const w = T.currentWeapon(); return { t: w.reloadTime, def: w.def.reloadTime }; });
  check(`${tag}: empty reload takes the full reloadTime`, empty.t === empty.def, JSON.stringify(empty));
  const beats = [];
  for (const [t, name] of [[0.25, "out"], [0.45, "swap"], [0.62, "seat"], [0.7, "held"], [0.85, "released"]]) {
    const b = await page.evaluate(async (r) => {
      const T = window.__trollOps, w = T.currentWeapon(), a = T.activeWeaponMesh().userData.pistolAction;
      for (let i = 0; i < 3; i++) { w.reloadT = w.reloadTime * (1 - r); await new Promise((res) => requestAnimationFrame(res)); }
      return +(a.slide.position.z - a.slideRestZ).toFixed(4);
    }, t);
    beats.push([t, b]);
    await shot(page, `${tag}-4-reload-${Math.round(t * 100)}-${name}.png`);
  }
  check(`${tag}: slide held back until the release, home after`, beats[3][1] > 0.01 && Math.abs(beats[4][1]) < 1e-3, JSON.stringify(beats));
  await page.evaluate(() => { window.__trollOps.currentWeapon().reloadT = 0.001; });
  await sleep(300);
  const full = await page.evaluate(() => { const w = window.__trollOps.currentWeapon(); return { ammo: w.ammoInMag, size: w.def.magSize, reloading: w.reloading }; });
  check(`${tag}: reload fills the mag`, full.ammo === full.size && !full.reloading, JSON.stringify(full));

  // tac reload: quicker, the slide never moves
  const tac = await page.evaluate(async () => {
    const T = window.__trollOps, w = T.currentWeapon(), a = T.activeWeaponMesh().userData.pistolAction;
    w.ammoInMag = 3;
    T.tryReload();
    const time = w.reloadTime;
    let max = 0;
    for (const r of [0.3, 0.6, 0.8, 0.95]) {
      for (let i = 0; i < 2; i++) { w.reloadT = w.reloadTime * (1 - r); await new Promise((res) => requestAnimationFrame(res)); }
      max = Math.max(max, Math.abs(a.slide.position.z - a.slideRestZ));
    }
    w.reloadT = 0.001;
    await new Promise((res) => setTimeout(res, 200));
    return { time, tacDef: w.def.tacReloadTime, empty: w.def.reloadTime, max };
  });
  check(`${tag}: tac reload is its own quicker time with the slide home`, tac.time === tac.tacDef && tac.time < tac.empty && tac.max < 1e-4, JSON.stringify(tac));

  // the admire: a side-on showcase with a press-check
  await sleep(300);
  await page.evaluate(() => window.__trollOps.startInspect());
  await sleep(100);
  const insp = await page.evaluate(() => window.__trollOps.inspectT());
  check(`${tag}: inspect is the showcase length`, insp > 3, String(insp));
  for (const [t, name] of [[0.2, "left"], [0.33, "presscheck"], [0.58, "turn"], [0.75, "right"]]) {
    await page.evaluate((v) => window.__trollOps.setInspectFreeze(v), t);
    await sleep(250);
    await shot(page, `${tag}-5-inspect-${Math.round(t * 100)}-${name}.png`);
  }
  await page.evaluate(() => window.__trollOps.setInspectFreeze(0.33));
  await sleep(250);
  const press = await page.evaluate(() => { const a = window.__trollOps.activeWeaponMesh().userData.pistolAction; return a.slide.position.z - a.slideRestZ; });
  check(`${tag}: the press-check eases the slide back`, press > 0.003, String(press));
  await page.evaluate(() => window.__trollOps.setInspectFreeze(null));
  await sleep(3800);

  // third person
  await page.evaluate(() => window.__trollOps.toggleThirdPerson());
  await sleep(900);
  await shot(page, `${tag}-6-3p.png`);
  await page.evaluate(() => window.__trollOps.toggleThirdPerson());

  check(`${tag}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.close();
}

await run("sixtynine");
await run("true69");

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
