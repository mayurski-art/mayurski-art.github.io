// Troll Forces: aimed in on bare irons, the sight comes closer to the eye
// (user, 2026-10-31: "for the iron sight it's worth moving closer so the
// perceived sight enlarges"); optics keep their own distance. Private TDM
// room, no bots. Per gun:optic it aims in and reads how far in front of the
// weapon camera the gun's aim point sits.
//
// Usage: node tools/troll-ops-iron-ads-test.mjs [gun:optic:metres ...]
//   (default: problem416:iron:0.3 kek:iron:0.3 kek:reflex:0.46)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
  : ["problem416:iron:0.3", "kek:iron:0.3", "kek:reflex:0.46"]).map((s) => s.split(":"));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];
for (const [gun, optic, want] of combos) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route(/supabase/, (r) => r.abort());
  page.on("pageerror", (e) => errors.push(`${gun}: ${e.message}`));
  // a second page on one browser can stall its first load: one retry
  const go = () => page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await go().catch(go);
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
  }, [gun, optic, "IRN" + Math.random().toString(36).slice(2, 7).toUpperCase()]);
  await page.waitForFunction(() => { const s = window.__trollOps.loadState(); return window.__trollOps.state() === "playing" && !s.open && !s.hold; }, null, { timeout: 180000 });
  await page.evaluate(() => {
    const T = window.__trollOps;
    if (T.isStaging()) T.endStaging();
    T.player.hp = T.player.maxHp = 1e9;
    T.breakSpawnGuard?.();
    T.switchWeapon("primary");
    T.setAds(true);
  });
  await sleep(1800);
  const r = await page.evaluate(() => {
    const T = window.__trollOps, mesh = T.activeWeaponMesh();
    const p = (mesh.userData.aimPoint || new T.THREE.Vector3(0, 0, -0.4)).clone();
    mesh.localToWorld(p);
    return { z: -p.z, x: p.x, y: p.y, optic: T.currentWeapon().def.attachments?.optic };
  });
  console.log(`${gun}:${optic} (${r.optic})  aim point ${r.z.toFixed(3)} m ahead, off axis ${Math.hypot(r.x, r.y).toFixed(4)} m`);
  check(`${gun}:${optic} sight ${want} m from the eye`, Math.abs(r.z - Number(want)) < 0.02, r.z.toFixed(3));
  check(`${gun}:${optic} still on the axis`, Math.hypot(r.x, r.y) < 0.004, Math.hypot(r.x, r.y).toFixed(4));
  await page.close();
}
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "ALL PASS");
process.exit(failures ? 1 : 0);
