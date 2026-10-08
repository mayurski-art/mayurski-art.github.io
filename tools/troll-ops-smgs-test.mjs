// Troll Forces SMGs check (weapon-smgs.js: the Snicker MP7, Cope K10 and
// Seethe 57): each builds with its anchors and its two iron posts; on irons
// the sight line runs across the post tops; with glass the posts fold away;
// an ACOG or a sniper scope doesn't fit (back to irons); aimed in,
// the sight line sits on the screen centre and no sniper overlay shows; it
// fires full auto and a reload fills the mag.
// Offline: Supabase is blocked and there are no bots, so it never touches a
// public room. Screenshots go to OUT.
//
// Usage: NODE_PATH=<main checkout>/node_modules OUT=<dir> node tools/troll-ops-smgs-test.mjs

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

async function run(gunId, optic, expect = optic) {
  const tag = `${gunId}-${optic}`;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route(/supabase/, (r) => r.abort());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async ([id, o]) => {
    const T = window.__trollOps;
    T.loadout.weaponId = id;
    T.loadout.attachmentsFor(id).optic = o;
    T.loadout.mapId = "trollcity";
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    await T.startGame();
  }, [gunId, optic]);
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
    // the iron posts: boxes the builder added, visible or folded
    const posts = m.children.filter((o) => o.userData.ironSight);
    const tops = posts.map((p) => { p.updateMatrix(); const b = new m.position.constructor(); let top = -1; p.children.forEach((c) => { top = Math.max(top, c.position.y + c.geometry.parameters.height / 2); }); return +(p.position.y + top).toFixed(4); });
    const kinds = posts.map((p) => p.userData.ironSight).sort().join();
    return {
      id: d.id, cls: d.cls, mode: d.fireMode, optic: d.attachments.optic, glass: !!u.sight?.children.length,
      posts: posts.length, kinds, postsShown: posts.filter((p) => p.visible).length, tops, aimY: +u.aimPoint.y.toFixed(4),
      grip: !!u.gripPos, mag: !!u.magMesh, support: !!u.supportHandPos, muzzle: u.muzzleZ, mag0: T.currentWeapon().ammoInMag, magSize: d.magSize,
    };
  });
  check(`${tag}: built by weapon-smgs.js with its anchors`, info.id === gunId && info.cls === "pdw" && info.mode === "auto" && info.grip && info.mag
    && info.support && info.muzzle < -0.2 && info.posts === 2 && info.kinds === "front,rear", JSON.stringify(info));
  if (expect === "iron") {
    check(`${tag}: irons up, no glass, the sight line across the post tops`, !info.glass && info.postsShown === 2
      && info.tops.every((t) => Math.abs(t - info.aimY) < 0.004), JSON.stringify(info));
  } else {
    check(`${tag}: glass on, the irons folded`, info.glass && info.optic === expect && info.postsShown === 0, JSON.stringify(info));
  }
  check(`${tag}: spawns with a full mag of ${info.magSize}`, info.mag0 === info.magSize, String(info.mag0));
  await shot(page, `${tag}-0-hip.png`);

  await page.evaluate(() => { const d = window.__trollOps.currentWeapon().def; d.swayAmp = 0; d.bobAmp = 0; window.__trollOps.setAds(true); });
  await sleep(600);
  await settle(page);
  const ads = await page.evaluate(() => {
    const T = window.__trollOps, m = T.activeWeaponMesh();
    m.updateMatrixWorld(true);
    const V = m.position.constructor;
    const a = m.userData.aimPoint;
    const ang = (z) => { const p = m.localToWorld(new V(0, a.y, z)); return [+(p.x / -p.z).toFixed(4), +(p.y / -p.z).toFixed(4)]; };
    return { rear: ang(a.z + 0.03), front: ang(a.z - 0.15), ads: T.currentWeapon().adsT, overlay: document.querySelector(".to-scope") ? getComputedStyle(document.querySelector(".to-scope")).display : "none" };
  });
  const off = Math.max(...ads.rear.map(Math.abs), ...ads.front.map(Math.abs));
  check(`${tag}: aimed, the sight line on the screen centre, no scope overlay`, ads.ads > 0.99 && off < 0.006 && ads.overlay !== "block", JSON.stringify(ads));
  await shot(page, `${tag}-1-ads.png`);
  await page.evaluate(() => window.__trollOps.setAds(false));
  await sleep(500);

  const auto = await page.evaluate(async () => {
    const T = window.__trollOps, w = T.currentWeapon();
    const before = w.ammoInMag;
    for (let i = 0; i < 5; i++) { w.fireCooldown = 0; T.fireOnce(); }
    return { before, after: w.ammoInMag };
  });
  check(`${tag}: fires`, auto.before - auto.after === 5, JSON.stringify(auto));
  await sleep(30);
  await shot(page, `${tag}-2-fired.png`);
  const rl = await page.evaluate(async () => {
    const T = window.__trollOps, w = T.currentWeapon();
    w.ammoInMag = 0;
    T.tryReload();
    await new Promise((r) => setTimeout(r, 300));
    w.reloadT = w.reloadTime * 0.6;
    await new Promise((r) => setTimeout(r, 200));
    w.reloadT = 0.001;
    await new Promise((r) => setTimeout(r, 300));
    return { ammo: w.ammoInMag, size: w.def.magSize, reloading: w.reloading };
  });
  check(`${tag}: reload fills the mag`, rl.ammo === rl.size && !rl.reloading, JSON.stringify(rl));

  check(`${tag}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.close();
}

for (const id of ["snicker", "cope", "seethe"]) await run(id, "iron");
await run("cope", "reflex");
await run("seethe", "coyote");
await run("seethe", "acog", "iron");
await run("snicker", "scope8", "iron");

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
