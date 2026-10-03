// Melee round (user, 2026-10-03):
//   1. the Trollsaber ignites SLOWLY every time it's equipped (a quick V
//      swing still snaps it out fast);
//   2. melee kills in third person (the swing used to start at the camera,
//      3 m behind you, and end behind your own back);
//   3. (bots firing into a guard: bots.js canShoot, not tested here);
//   4. the Keyboard Warrior blocks from the front, breaks after a few hits
//      in a row, plays its repair act, and comes back usable.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-melee-equip-test.mjs [shotsDir]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name) }); };

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });

async function startRange(meleeId, mode = "range") {
  await page.evaluate(async ([meleeId, mode]) => {
    const T = window.__trollOps;
    T.loadout.meleeId = meleeId;
    T.setMode(mode);
    if (T.els.noBots) T.els.noBots.checked = true;
    await T.startGame();
  }, [meleeId, mode]);
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
  await sleep(500);
  await page.evaluate(() => { const T = window.__trollOps; T.closePauseMenu(); if (T.isStaging()) T.endStaging(); T.breakSpawnGuard(); });
}
const close = () => page.evaluate(() => { const T = window.__trollOps; if (!document.getElementById("to-pause").hidden) T.closePauseMenu(); });

/* ---- 1. slow ignite on equip, fast on a quick swing */
await startRange("trollsaber");
await page.evaluate(() => window.__trollOps.setHolding("gun"));
await sleep(600);
await close();
await page.evaluate(() => window.__trollOps.setHolding("melee"));
await sleep(400);
const f04 = await page.evaluate(() => window.__trollOps.saberFrac());
await sleep(1300);
const f17 = await page.evaluate(() => window.__trollOps.saberFrac());
check("equip ignites slowly (part-lit at 0.4 s, full by 1.7 s)", f04 > 0.05 && f04 < 0.75 && f17 >= 0.999, `0.4s ${f04?.toFixed(2)}, 1.7s ${f17?.toFixed(2)}`);
await page.evaluate(() => window.__trollOps.setHolding("gun"));
await sleep(500);
await page.evaluate(() => window.__trollOps.swingMelee());
await sleep(250);
const fq = await page.evaluate(() => window.__trollOps.saberFrac());
check("a quick V swing still snaps it out", fq >= 0.6, `0.25s ${fq?.toFixed(2)}`);
await sleep(800);

/* ---- 2. melee kills a bot in a real match, in first and third person */
await page.evaluate(() => { const T = window.__trollOps; T.endMatch?.(); });
await sleep(500);
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.meleeId = "trollsaber";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = false;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() !== "menu" && !window.__trollOps.loadState().open && window.__trollOps.bots.bots.length > 0, null, { timeout: 120000 });
await sleep(500);
await page.evaluate(() => { const T = window.__trollOps; T.closePauseMenu(); if (T.isStaging()) T.endStaging(); T.breakSpawnGuard(); });
async function killTest(tp) {
  return page.evaluate(async (tp) => {
    const T = window.__trollOps;
    if (!document.getElementById("to-pause").hidden) T.closePauseMenu();
    T.setHolding("melee");
    if (!!T.settings.thirdPerson !== tp) T.toggleThirdPerson();
    const b = T.bots.bots.find((x) => x.alive !== false && x.hp > 0 && x.team !== T.net.team);
    if (!b) return { err: "no live bot" };
    const face = () => { T.move.reset(b.pos.x, b.pos.z + 1.3, b.groundY ?? b.pos.y ?? 0); T.look.yaw = 0; T.look.pitch = -0.15; };
    const hp0 = b.hp, log = [];
    for (let i = 0; i < 4 && b.alive !== false && b.hp > 0; i++) {
      if (!document.getElementById("to-pause").hidden) T.closePauseMenu();
      face();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      face();
      await new Promise((r) => requestAnimationFrame(r));
      const before = b.hp;
      T.meleeConnect();
      log.push([Math.round(before), Math.round(b.hp)]);
    }
    return { team: [b.team, T.net.team], tm: T.targetMeshesCount?.(), tp: !!T.settings.thirdPerson, hp0, hp1: Math.round(b.hp), alive: b.alive, log };
  }, tp);
}
const fp = await killTest(false);
check("a saber swing kills the bot in front (first person)", !fp.err && (fp.hp1 <= 0 || fp.alive === false), JSON.stringify(fp));
const tp = await killTest(true);
check("a saber swing kills the bot in front (third person)", !tp.err && (tp.hp1 <= 0 || tp.alive === false), JSON.stringify(tp));
await shot(page, "tp-saber.png");
await page.evaluate(() => { const T = window.__trollOps; if (T.settings.thirdPerson) T.toggleThirdPerson(); });

/* ---- 4. Keyboard Warrior: shield, break, repair, back */
await page.evaluate(() => { const T = window.__trollOps; T.endMatch?.(); });
await sleep(500);
await startRange("keyboard", "tdm");
await page.evaluate(() => { const T = window.__trollOps; T.setHolding("melee"); });
await sleep(1500);
await close();
await page.evaluate(() => window.__trollOps.setAds(true));
await sleep(600);
const front = () => page.evaluate(() => {
  const T = window.__trollOps, THREE = T.THREE;
  const at = new THREE.Vector3(0, 0, -10).applyMatrix4(T.camera.matrixWorld);
  const hp0 = T.player.hp;
  T.damagePlayer(10, null, "problem416", false, at);
  return { hp0, hp1: T.player.hp, shield: T.kbShield.active, repair: T.kbRepair.active };
});
const h1 = await front();
check("the keyboard shield stops a round from the front", h1.hp1 === h1.hp0, JSON.stringify(h1));
await shot(page, "kb-shield.png");
await front(); await sleep(120); await front(); await sleep(120);
const h4 = await front();
check("a few hits in a row break it into the repair act", h4.repair === true, JSON.stringify(h4));
const during = await page.evaluate(() => { const T = window.__trollOps; T.breakSpawnGuard(); const hp0 = T.player.hp; T.damagePlayer(5, null, "problem416", false, new T.THREE.Vector3(0, 0, -10).applyMatrix4(T.camera.matrixWorld)); return { hp0, hp1: T.player.hp, repair: T.kbRepair.active }; });
check("while fixing it, rounds get through", during.hp1 < during.hp0, JSON.stringify(during));
for (const [ms, name] of [[350, "kb-repair-1-caps.png"], [700, "kb-repair-2-screwdriver.png"], [900, "kb-repair-3-solder.png"], [800, "kb-repair-4-usb.png"], [500, "kb-repair-5-fixed.png"]]) {
  await sleep(ms); await close(); await shot(page, name);
}
await sleep(1500);
const after = await page.evaluate(() => ({ repair: window.__trollOps.kbRepair.active, shield: window.__trollOps.kbShield.active }));
check("the act ends and the shield works again", !after.repair && after.shield, JSON.stringify(after));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
