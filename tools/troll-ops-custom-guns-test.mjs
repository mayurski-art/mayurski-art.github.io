// The custom guns: THE BEAST and the Hyuck Colt LMG wear their Blender
// models (models/beast.glb, models/coltlmg.glb) with both arm anchors and a
// magazine that leaves the gun on a reload; the Ghost Glass finish turns any
// gun see-through with lit edges. Screenshots (hip, ADS, glass) go to OUT.
//
// Usage: NODE_PATH=<main checkout>/node_modules OUT=<dir> node tools/troll-ops-custom-guns-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || "";
if (OUT) fs.mkdirSync(OUT, { recursive: true });
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

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });

async function run(id, prefix, skin, tag) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route(/supabase/, (r) => r.abort());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async ([id, skin]) => {
    const T = window.__trollOps;
    T.loadout.weaponId = id;
    T.loadout.attachmentsFor(id).skin = skin;
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    await T.startGame();
  }, [id, skin]);
  await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 });
  await sleep(4500);
  if (prefix) {
    await page.waitForFunction((p) => !!window.__trollOps.activeWeaponMesh()?.getObjectByName(`${p}_Body`), prefix, { timeout: 30000 }).catch(() => {});
  }
  const info = await page.evaluate((p) => {
    const T = window.__trollOps, m = T.activeWeaponMesh();
    let tris = 0, glass = 0, edges = 0;
    m.traverse((o) => {
      if (o.isMesh && o.visible && !o.userData.hand) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      if (o.isMesh && o.material?.transparent && o.material.opacity < 0.3) glass++;
      if (o.userData.finishEdge) edges++;
    });
    return { id: T.currentWeapon().def.id, body: !!(p && m.getObjectByName(`${p}_Body`)), mag: m.userData.magMesh?.name || null,
             anchors: m.userData.pfAnchors?.length || 0, tris: Math.round(tris), glass, edges, finish: m.userData.finish || null };
  }, prefix);
  check(`${tag}: ${id} equipped`, info.id === id, info.id);
  if (prefix) {
    check(`${tag}: wears its Blender model`, info.body && info.tris > 20000, JSON.stringify(info));
    check(`${tag}: magazine node + both arm anchors`, info.mag === `${prefix}_Mag` && info.anchors === 2, JSON.stringify(info));
  }
  if (skin) check(`${tag}: Ghost Glass finish (clear parts + lit edges)`, info.finish === skin && info.glass > 0 && info.edges > 0, JSON.stringify(info));
  if (OUT) await page.screenshot({ path: path.join(OUT, `${tag}-hip.png`) });
  await page.evaluate(() => window.__trollOps.setAds(true));
  await sleep(800);
  if (OUT) await page.screenshot({ path: path.join(OUT, `${tag}-ads.png`) });
  await page.evaluate(() => window.__trollOps.setAds(false));
  await sleep(500);
  // Reload: the magazine leaves its rest point and comes back.
  const rl = await page.evaluate(async () => {
    const T = window.__trollOps, w = T.currentWeapon(), m = T.activeWeaponMesh();
    const mag = m.userData.magMesh, rest = m.userData.magazinePoint.clone();
    w.ammoInMag = 3;
    w.startReload();
    let moved = 0;
    const t0 = performance.now();
    while (w.reloading && performance.now() - t0 < 12000) {
      moved = Math.max(moved, mag.position.distanceTo(rest));
      await new Promise((r) => requestAnimationFrame(r));
    }
    return { moved, done: !w.reloading, ammo: w.ammoInMag, back: mag.position.distanceTo(rest) };
  });
  check(`${tag}: the mag comes out on a reload and goes home`, rl.moved > 0.05 && rl.done && rl.back < 1e-3, JSON.stringify(rl));
  check(`${tag}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.close();
}

await run("beast", "BE", null, "beast");
await run("coltlmg", "CL", null, "colt");
await run("coltlmg", "CL", "ghostglass", "colt-glass");
await run("problem416", null, "ghostglass", "416-glass");
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
