// Streaks off a secondary or a melee weapon (user, 2026-10-03): calling a
// scorestreak must still play its device animation whatever is in your hands.
//   1. on the secondary: the tablet comes up, and you're back on the
//      secondary (same gun, visible) once it lowers;
//   2. on a melee weapon: the weapon is put away first (unequip animation),
//      THEN the tablet/marker comes up, and the melee weapon comes back after;
//   3. the marking streaks (care package marker) work off melee too.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-streak-holster-test.mjs [shotsDir]

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

await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.meleeId = "trollsaber";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
await sleep(500);
await page.evaluate(() => { const T = window.__trollOps; T.closePauseMenu(); if (T.isStaging()) T.endStaging(); T.breakSpawnGuard(); });
const close = () => page.evaluate(() => { const T = window.__trollOps; if (!document.getElementById("to-pause").hidden) T.closePauseMenu(); });

const until = (fn, ms = 15000) => page.waitForFunction(fn, null, { timeout: ms, polling: 30 }).then(() => true, () => false);
const view = () => page.evaluate(() => {
  const T = window.__trollOps;
  return {
    holding: T.player.holding,
    gun: T.currentWeapon()?.def.id,
    secondary: T.player.secondaryId,
    tablet: T.activeStreakMesh().visible,
    marking: T.markingStreak(),
    holster: T.meleeHolster?.() ?? null,
    uav: T.streaks.ready("uav"),
  };
});

/* ---- 1. secondary */
await close();
await page.evaluate(() => window.__trollOps.switchWeapon("secondary"));
await sleep(400);
const sec0 = await view();
check("on the secondary before the call", sec0.holding === "gun" && sec0.gun === sec0.secondary, JSON.stringify(sec0));
await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("uav"); T.callStreak("uav"); });
await sleep(500);
const sec1 = await view();
await shot(page, "1-secondary-tablet.png");
check("UAV off the secondary: tablet up", sec1.holding === "streak" && sec1.tablet, JSON.stringify(sec1));
await until(() => window.__trollOps.player.holding !== "streak");
const sec2 = await view();
check("...and back on the secondary after", sec2.holding === "gun" && sec2.gun === sec2.secondary, JSON.stringify(sec2));

/* ---- 2. melee: unequip, then the tablet */
await close();
await page.evaluate(() => { window.__trollOps.switchWeapon("primary"); window.__trollOps.setHolding("melee"); });
await until(() => window.__trollOps.player.holding === "melee");
await sleep(2500);   // the slow equip
await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("uav"); T.callStreak("uav"); });
await sleep(60);
const m1 = await view();
await shot(page, "2a-melee-holstering.png");
check("UAV off melee: weapon is being put away first", m1.holding === "melee" && !!m1.holster && !m1.tablet, JSON.stringify(m1));
await until(() => window.__trollOps.player.holding === "streak", 5000);
await sleep(300);
const m2 = await view();
await shot(page, "2b-melee-tablet.png");
check("...then the tablet comes up", m2.holding === "streak" && m2.tablet && !m2.uav, JSON.stringify(m2));
await until(() => window.__trollOps.player.holding !== "streak");
await sleep(400);
const m3 = await view();
await shot(page, "2c-melee-back.png");
check("...and the melee weapon comes back after", m3.holding === "melee" && !m3.holster, JSON.stringify(m3));

/* ---- 3. care package marker off melee */
await close();
await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("carepackage"); T.callStreak("carepackage"); });
await until(() => window.__trollOps.player.holding === "streak", 5000);
await sleep(400);
const c1 = await view();
await shot(page, "3a-melee-marker.png");
check("care package off melee: marker in hand", c1.holding === "streak" && c1.marking === "carepackage", JSON.stringify(c1));
await page.evaluate(() => window.__trollOps.cancelMark?.());
await until(() => window.__trollOps.player.holding !== "streak");
const c2 = await view();
check("...cancelled, melee comes back", c2.holding === "melee", JSON.stringify(c2));

/* ---- 4. every self-ending streak, off the secondary and off melee */
for (const from of ["secondary", "melee"]) {
  for (const id of ["counteruav", "vsat", "drone", "helicopter", "k9", "samturret", "swarm"]) {
    await close();
    await page.evaluate((from) => {
      const T = window.__trollOps;
      if (from === "melee") T.setHolding("melee"); else T.switchWeapon("secondary");
    }, from);
    await sleep(from === "melee" ? 1500 : 300);
    await page.evaluate((id) => { const T = window.__trollOps; T.clearStreakLocks?.(); T.streaks.grant(id); T.callStreak(id); }, id);
    const up = await until(() => window.__trollOps.player.holding === "streak", 5000);
    const spent = await page.evaluate((id) => !window.__trollOps.streaks.ready(id), id);
    const back = up && await until(() => window.__trollOps.player.holding !== "streak", 20000);
    const v = await view();
    const ok = from === "melee" ? v.holding === "melee" : v.holding === "gun" && v.gun === v.secondary;
    check(`${id} off ${from}: device up, spent, back on ${from}`, up && spent && back && ok, JSON.stringify({ up, spent, back, ...v }));
  }
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
