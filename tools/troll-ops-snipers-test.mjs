// Troll Forces snipers check (weapon-snipers.js: the Snort SVU, Deadpan DSR,
// Howl Ballista and Smug XPR): each builds with its anchors and its scope
// (a reflex asked for falls back to the scope), spawns full, aimed in the
// sight line sits on the screen centre and the Black Ops 2 scope overlay
// takes the screen and hides the gun, letting go gives it back; a bolt gun
// lifts, rakes and locks its bolt after a shot and on an empty reload; a
// reload fills the mag; third person never shows the overlay.
// Offline: Supabase is blocked and there are no bots, so it never touches a
// public room. Screenshots go to OUT.
//
// Usage: NODE_PATH=<main checkout>/node_modules OUT=<dir> node tools/troll-ops-snipers-test.mjs

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

/* Wait (in the page) until the gun stops moving: headless frames are slow,
   so the ADS ease takes a few seconds of wall time. */
const settle = (page) => page.evaluate(async () => {
  const m = window.__trollOps.activeWeaponMesh();
  let last = null;
  for (let i = 0; i < 400; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    const p = m.position.toArray().join();
    if (p === last && i > 30) return true;
    last = p;
  }
  return false;
});

async function run(gunId) {
  const tag = gunId;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route(/supabase/, (r) => r.abort());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (id) => {
    const T = window.__trollOps;
    T.loadout.weaponId = id;
    // a part that doesn't fit: the class rules swap it for the scope
    T.loadout.attachmentsFor(id).optic = "reflex";
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
    T.switchWeapon("primary");
  });
  await sleep(1200);

  const info = await page.evaluate(() => {
    const T = window.__trollOps, m = T.activeWeaponMesh(), u = m.userData, d = T.currentWeapon().def;
    return {
      id: d.id, mode: d.fireMode, optic: d.attachments.optic, scopeKey: u.scopeKey, sight: !!u.sight?.children.length,
      bolt: !!u.boltAction, grip: !!u.gripPos, mag: !!u.magMesh, support: !!u.supportHandPos, aim: !!u.aimPoint,
      muzzle: u.muzzleZ, mag0: T.currentWeapon().ammoInMag, magSize: d.magSize,
    };
  });
  check(`${tag}: built by weapon-snipers.js with its anchors`, info.id === gunId && info.grip && info.mag && info.support
    && info.aim && info.muzzle < -0.4 && info.bolt === (info.mode === "bolt"), JSON.stringify(info));
  check(`${tag}: a reflex doesn't fit, the scope is on`, info.optic === "scope8" && info.scopeKey === "scope8" && info.sight, JSON.stringify(info));
  check(`${tag}: spawns with a full mag of ${info.magSize}`, info.mag0 === info.magSize, String(info.mag0));
  await shot(page, `${tag}-0-hip.png`);

  // aimed in: the sight line on the screen centre, the overlay up, the gun gone
  // idle sway keeps a little amplitude aimed in: still it to read the line
  await page.evaluate(() => { const d = window.__trollOps.currentWeapon().def; d.swayAmp = 0; d.bobAmp = 0; window.__trollOps.setAds(true); });
  await sleep(600);
  await settle(page);
  const ads = await page.evaluate(() => {
    const T = window.__trollOps, m = T.activeWeaponMesh();
    m.updateMatrixWorld(true);
    const V = m.position.constructor;
    const a = m.userData.aimPoint;
    const ang = (z) => { const p = m.localToWorld(new V(0, a.y, z)); return [+(p.x / -p.z).toFixed(4), +(p.y / -p.z).toFixed(4)]; };
    const el = document.querySelector(".to-scope");
    return { rear: ang(a.z + 0.06), front: ang(a.z - 0.2), ads: T.currentWeapon().adsT,
      overlay: el ? [getComputedStyle(el).display, +el.style.opacity] : null, gunShown: m.visible };
  });
  const off = Math.max(...ads.rear.map(Math.abs), ...ads.front.map(Math.abs));
  check(`${tag}: aimed, the sight line on the screen centre`, ads.ads > 0.99 && off < 0.006, JSON.stringify(ads));
  check(`${tag}: aimed, the scope overlay is up and the gun hidden`, ads.overlay?.[0] === "block" && ads.overlay[1] > 0.99 && !ads.gunShown, JSON.stringify(ads));
  await shot(page, `${tag}-1-scoped.png`);
  await page.evaluate(() => window.__trollOps.setAds(false));
  await sleep(600);
  await settle(page);
  const out = await page.evaluate(() => {
    const el = document.querySelector(".to-scope");
    return { display: getComputedStyle(el).display, gunShown: window.__trollOps.activeWeaponMesh().visible };
  });
  check(`${tag}: let go, the overlay goes and the gun is back`, out.display === "none" && out.gunShown, JSON.stringify(out));

  if (info.mode === "bolt") {
    // a shot works the bolt: stretched to 3 s to read it mid-cycle
    const cyc = await page.evaluate(async () => {
      const T = window.__trollOps, w = T.currentWeapon(), a = T.activeWeaponMesh().userData.boltAction;
      const pump = w.def.pumpTime;
      w.def.pumpTime = 3;
      w.fireCooldown = 0;
      T.fireOnce();
      const read = async (t) => {
        for (let i = 0; i < 2; i++) { w.pumpT = w.pumpDur * (1 - t); await new Promise((r) => requestAnimationFrame(r)); }
        return [+a.bolt.rotation.z.toFixed(3), +(a.bolt.position.z - a.restZ).toFixed(4)];
      };
      const r = { lifted: await read(0.22), back: await read(0.5), locked: await read(0.97) };
      w.def.pumpTime = pump;
      w.pumpT = 0;
      return { ...r, travel: a.travel };
    });
    check(`${tag}: a shot lifts the bolt, rakes it back and locks it home`,
      cyc.lifted[0] > 0.5 && cyc.back[1] > cyc.travel * 0.9 && Math.abs(cyc.locked[0]) < 1e-3 && Math.abs(cyc.locked[1]) < 1e-4, JSON.stringify(cyc));
    await page.evaluate(async () => { const T = window.__trollOps, w = T.currentWeapon(); w.def.pumpTime = 3; w.fireCooldown = 0; w.pumpT = 0; T.fireOnce(); });
    await sleep(1300);
    await shot(page, `${tag}-2-bolt.png`);
    await page.evaluate(() => { const w = window.__trollOps.currentWeapon(); w.def.pumpTime = { deadpan: 0.8, howl: 0.5 }[w.def.id] ?? w.def.pumpTime; w.pumpT = 0; });
  } else {
    const semi = await page.evaluate(async () => {
      const T = window.__trollOps, w = T.currentWeapon();
      const before = w.ammoInMag;
      w.fireCooldown = 0; T.fireOnce();
      w.fireCooldown = 0; T.fireOnce();
      return { before, after: w.ammoInMag };
    });
    check(`${tag}: semi-auto, back-to-back shots`, semi.before - semi.after === 2, JSON.stringify(semi));
    await sleep(30);
    await shot(page, `${tag}-2-fired.png`);
  }
  await sleep(400);

  // empty reload: a bolt gun works its bolt to chamber the new mag
  const empty = await page.evaluate(async () => {
    const T = window.__trollOps, w = T.currentWeapon(), a = T.activeWeaponMesh().userData.boltAction;
    w.ammoInMag = 0; w.pumpT = 0;
    T.tryReload();
    let back = 0;
    for (const r of [0.8, 0.86]) {
      for (let i = 0; i < 2; i++) { w.reloadT = w.reloadTime * (1 - r); await new Promise((res) => requestAnimationFrame(res)); }
      if (a) back = Math.max(back, a.bolt.position.z - a.restZ);
    }
    w.reloadT = 0.001;
    await new Promise((res) => setTimeout(res, 300));
    return { bolt: !!a, back, travel: a?.travel, ammo: w.ammoInMag, size: w.def.magSize, reloading: w.reloading };
  });
  check(`${tag}: reload fills the mag`, empty.ammo === empty.size && !empty.reloading, JSON.stringify(empty));
  if (empty.bolt) check(`${tag}: an empty reload works the bolt`, empty.back > empty.travel * 0.5, JSON.stringify(empty));

  // third person: aimed, no overlay
  await page.evaluate(() => { window.__trollOps.toggleThirdPerson(); window.__trollOps.setAds(true); });
  await sleep(1200);
  const tp = await page.evaluate(() => getComputedStyle(document.querySelector(".to-scope")).display);
  check(`${tag}: third person, aimed, no scope overlay`, tp === "none", tp);
  await shot(page, `${tag}-3-3p.png`);
  await page.evaluate(() => { window.__trollOps.setAds(false); window.__trollOps.toggleThirdPerson(); });

  check(`${tag}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.close();
}

for (const id of ["snort", "deadpan", "howl", "smug"]) await run(id);

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
