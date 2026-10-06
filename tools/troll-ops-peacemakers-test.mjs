// Troll Forces Peacemakers check: the pair builds with a hand on each gun,
// shots alternate right/left and turn that gun's cylinder, aim fans the
// hammers (faster, no scope-in), the reload empties both cylinders and
// refills twelve, and the inspect runs its length. Screenshots of the hip
// pose, reload beats and inspect beats go to OUT (the rod arms).
//
// Usage: NODE_PATH=<main checkout>/node_modules OUT=<dir> node tools/troll-ops-peacemakers-test.mjs

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
  T.loadout.secondaryId = "peacemakers";
  T.loadout.mapId = "trollcity";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 });
await sleep(4500);
await page.evaluate(() => {
  const T = window.__trollOps;
  if (T.isStaging()) T.endStaging();
  T.player.maxHp = T.player.hp = 1e9;
  T.look.pitch = 0;
  T.switchWeapon("secondary");
});
await sleep(1200);

const info = await page.evaluate(() => {
  const T = window.__trollOps, m = T.activeWeaponMesh(), u = m.userData;
  return { id: T.currentWeapon().def.id, akimbo: !!u.akimbo, sides: u.sides?.length, hands: u.akimboHands?.length, grip: !!u.gripPos, gripL: !!u.gripPosL };
});
check("Peacemakers in hand as one akimbo pair", info.id === "peacemakers" && info.akimbo && info.sides === 2 && info.hands === 2 && info.grip && info.gripL, JSON.stringify(info));

{
  const tag = "rods";
  await sleep(400);
  await shot(page, `${tag}-0-hip.png`);

  // two shots: right then left, each turns its own cylinder
  const fire = await page.evaluate(async () => {
    const T = window.__trollOps, w = T.currentWeapon();
    const sides = [];
    for (let i = 0; i < 2; i++) {
      w.fireCooldown = 0;
      T.fireOnce();
      sides.push(w.akimboSide);
      await new Promise((r) => setTimeout(r, 40));
    }
    return { sides, ammo: w.ammoInMag, idx: w._ak?.index.slice() };
  });
  check("shots alternate right then left", fire.sides[0] === 0 && fire.sides[1] === 1, JSON.stringify(fire));
  check("each shot turns its own cylinder", fire.idx?.[0] === 1 && fire.idx?.[1] === 1, JSON.stringify(fire.idx));
  await shot(page, `${tag}-1-fired.png`);
  await sleep(500);

  // the reload, frozen at its beats
  await page.evaluate(() => { const w = window.__trollOps.currentWeapon(); w.ammoInMag = 0; window.__trollOps.tryReload(); });
  const total = await page.evaluate(() => window.__trollOps.currentWeapon().reloadTime);
  for (const [t, name] of [[0.15, "out"], [0.3, "eject"], [0.48, "loading"], [0.6, "loaded"], [0.72, "shut"], [0.88, "twirl"]]) {
    await page.evaluate((r) => { const w = window.__trollOps.currentWeapon(); w.reloadT = w.reloadTime * (1 - r); }, t);
    await sleep(120);
    await page.evaluate((r) => { const w = window.__trollOps.currentWeapon(); w.reloadT = w.reloadTime * (1 - r); }, t);
    await sleep(30);
    await shot(page, `${tag}-2-reload-${Math.round(t * 100)}-${name}.png`);
  }
  await page.evaluate(() => { const w = window.__trollOps.currentWeapon(); w.reloadT = 0.001; });
  await sleep(300);
  const after = await page.evaluate(() => ({ ammo: window.__trollOps.currentWeapon().ammoInMag, reloading: window.__trollOps.currentWeapon().reloading }));
  check("reload fills both cylinders (12)", after.ammo === 12 && !after.reloading, JSON.stringify(after) + ` reloadTime ${total}`);

  // the inspect, frozen at its beats
  await page.evaluate(() => window.__trollOps.startInspect());
  await sleep(100);
  const insp = await page.evaluate(() => window.__trollOps.inspectT());
  check("inspect starts with its own length", insp > 3.2, String(insp));
  for (const [t, name] of [[0.12, "twirl"], [0.4, "crossed"], [0.5, "blow"], [0.68, "toss"], [0.9, "holster"]]) {
    await page.evaluate((v) => window.__trollOps.setInspectFreeze(v), t);
    await sleep(250);
    await shot(page, `${tag}-3-inspect-${Math.round(t * 100)}-${name}.png`);
  }
  await page.evaluate(() => window.__trollOps.setInspectFreeze(null));
  await sleep(3800);
}

// aim fans instead of scoping in
const fan = await page.evaluate(async () => {
  const T = window.__trollOps, w = T.currentWeapon();
  w.ammoInMag = 12;
  T.setAds(true);
  await new Promise((r) => setTimeout(r, 600));
  const ads = w.adsT;
  T.setAds(false);
  w.fireCooldown = 0;
  T.fireOnce({ fan: true });
  return { ads, cooldown: w.fireCooldown, normal: 60 / w.def.rpm };
});
check("aim never scopes in", fan.ads === 0, String(fan.ads));
check("a fanned shot comes round faster than a pull", fan.cooldown < fan.normal * 0.5, JSON.stringify(fan));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
