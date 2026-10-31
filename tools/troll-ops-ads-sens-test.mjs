// Troll Forces: aimed in, a mouse flick moves the picture the same distance
// through every sight (user, 2026-10-31: "Ballista has a look sensitivity of
// its own it seems. MTAR has a lower sensitivity"), and the ADS sensitivity
// setting scales it. Private TDM room, no bots.
//
// Per gun:optic it aims in, sends the same mouse movement, and turns the yaw
// it caused into screen travel: tan(turn) / tan(fov / 2), a fraction of half
// the screen. Fails if any sight's travel is more than TOL off the others, or
// if 50% ADS sensitivity doesn't halve it. Run it on the old code for "before".
//
// Usage: node tools/troll-ops-ads-sens-test.mjs [gun:optic ...]
//   (default: problem416:reflex kek:iron kek:acog howl:scope8)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOL = 0.06;
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const combos = (process.argv.slice(2).length ? process.argv.slice(2)
  : ["problem416:reflex", "kek:iron", "kek:acog", "howl:scope8"]).map((s) => s.split(":"));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];
const rows = [];
for (const [gun, optic] of combos) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route(/supabase/, (r) => r.abort());
  page.on("pageerror", (e) => errors.push(`${gun}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
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
  }, [gun, optic, "ASN" + Math.random().toString(36).slice(2, 7).toUpperCase()]);
  await page.waitForFunction(() => { const s = window.__trollOps.loadState(); return window.__trollOps.state() === "playing" && !s.open && !s.hold; }, null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const T = window.__trollOps;
    const { game } = await import("/assets/games/troll-ops/core/state.js?v=st1");
    if (T.isStaging()) T.endStaging();
    T.player.hp = T.player.maxHp = 1e9;
    T.breakSpawnGuard?.();
    T.switchWeapon("primary");
    game.renderer.domElement.requestPointerLock();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(800);
    const flick = async () => {
      const y0 = T.look.yaw;
      for (let i = 0; i < 10; i++) {
        document.dispatchEvent(new MouseEvent("mousemove", { movementX: 10 }));
        await wait(5);
      }
      const turn = Math.abs(T.look.yaw - y0);
      return Math.tan(turn) / Math.tan((T.camera.fov * Math.PI) / 360);
    };
    const hip = await flick();
    T.setAds(true);
    await wait(1600);
    const w = T.currentWeapon();
    const ads = await flick();
    const s0 = T.settings.adsSens;
    T.settings.adsSens = 50;
    const half = await flick();
    T.settings.adsSens = s0;
    T.setAds(false);
    return { hip, ads, half, adsT: w.adsT, fovMult: w.def.adsFovMult, fov: T.camera.fov, opt: w.def.attachments?.optic };
  });
  rows.push({ gun, optic, ...r });
  console.log(`${gun}:${optic} (${r.opt}, fov x${r.fovMult.toFixed(2)}, adsT ${r.adsT.toFixed(2)})  hip ${r.hip.toFixed(4)}  aimed ${r.ads.toFixed(4)} (${(r.ads / r.hip).toFixed(2)} of hip)  at 50% ${r.half.toFixed(4)}`);
  await page.close();
}

const ads = rows.map((r) => r.ads);
const mid = (Math.max(...ads) + Math.min(...ads)) / 2;
check(`aimed screen travel within ${TOL * 100}% through every sight`, ads.every((a) => Math.abs(a / mid - 1) <= TOL),
  rows.map((r) => `${r.gun}:${r.optic} ${(r.ads / mid).toFixed(3)}`).join(", "));
check("50% ADS sensitivity halves it", rows.every((r) => Math.abs(r.half / r.ads - 0.5) < 0.04),
  rows.map((r) => (r.half / r.ads).toFixed(3)).join(", "));
check("hip unchanged by aiming setting", rows.every((r) => Math.abs(r.hip / rows[0].hip - 1) < 0.03));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "ALL PASS");
process.exit(failures ? 1 : 0);
