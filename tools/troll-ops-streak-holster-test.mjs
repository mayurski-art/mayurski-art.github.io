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

const until = (fn, ms = 15000) => page.waitForFunction(fn, null, { timeout: ms, polling: 30 }).then(() => true, (e) => {
  if (!/Timeout/.test(e.message)) console.log(`  (wait failed: ${e.message.split("\n")[0]})`);
  return false;
});
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

/* ---- 4. every self-ending streak, off the secondary and off melee. Read
   from STREAK_DEFS, so a streak added later is covered without touching this
   file; only the ones that need driving (a mark, a ride) are tested below. */
const DRIVEN = ["uav", "carepackage", "airstrike", "warship", "dragonfire"];
const selfEnding = await page.evaluate((driven) => Object.keys(window.__trollOps.STREAK_DEFS).filter((id) => !driven.includes(id)), DRIVEN);
console.log(`self-ending streaks: ${selfEnding.join(", ")}`);
for (const from of ["secondary", "melee"]) {
  for (const id of selfEnding) {
    await close();
    await page.evaluate((from) => {
      const T = window.__trollOps;
      if (from === "melee") T.setHolding("melee"); else T.switchWeapon("secondary");
    }, from);
    // Off the Trollsaber the blade powers down before the sidearm comes up;
    // the headless sim is slow, so wait for the swap rather than the clock.
    if (from === "melee") await sleep(1500);
    else await until(() => { const T = window.__trollOps; return T.player.holding === "gun" && T.currentWeapon().def.id === T.player.secondaryId; }, 10000);
    await page.evaluate((id) => { const T = window.__trollOps; T.clearStreakLocks?.(); T.streaks.grant(id); T.callStreak(id); }, id);
    const up = await until(() => window.__trollOps.player.holding === "streak", 5000);
    const spent = await page.evaluate((id) => !window.__trollOps.streaks.ready(id), id);
    const back = up && await until(() => window.__trollOps.player.holding !== "streak", 20000);
    const v = await view();
    const ok = from === "melee" ? v.holding === "melee" : v.holding === "gun" && v.gun === v.secondary;
    check(`${id} off ${from}: device up, spent, back on ${from}`, up && spent && back && ok, JSON.stringify({ up, spent, back, ...v }));
  }
}

/* ---- 5. the tablet-dive streaks off melee: Lightning Strike, VTOL Warship,
   Dragonfire. Holster first, then the tablet dive, then the streak itself,
   and the melee weapon back once it's over. */
const fromMelee = async () => {
  await close();
  await page.evaluate(() => { const T = window.__trollOps; T.clearStreakLocks(); T.setHolding("melee"); });
  await sleep(1500);
};
const holsterThenTablet = async (id) => {
  await page.evaluate((id) => { const T = window.__trollOps; T.streaks.grant(id); T.callStreak(id); }, id);
  await sleep(60);
  const h = await view();
  await shot(page, `5-${id}-a-holster.png`);
  const up = await until(() => window.__trollOps.player.holding === "streak", 5000);
  const dive = await until(() => !!window.__trollOps.tabletDive(), 3000);
  await sleep(250);
  await shot(page, `5-${id}-b-dive.png`);
  return { holstered: h.holding === "melee" && !!h.holster, up, dive };
};

// The three strike marks go in the map corner farthest from us: a strike on
// our own head kills us and respawns us on the primary, which the checks
// after it would trip on.
const markFarCorner = () => page.evaluate(() => {
  const T = window.__trollOps, st = T.strikeTablet(), { cx, cz, span } = st.view;
  const u = (T.move.pos.x - cx) / span + 0.5, v = (T.move.pos.z - cz) / span + 0.5;
  st.cursor.v = v < 0.5 ? 0.92 : 0.08;
  for (const du of [0, 0.04, 0.08]) { st.cursor.u = (u < 0.5 ? 0.84 : 0.08) + du; st.place(); }
});

// Lightning Strike: holster, tablet dive, the strike map; mark three spots.
await fromMelee();
const ls = await holsterThenTablet("airstrike");
const lsOpen = await until(() => window.__trollOps.strikeTablet()?.isOpen, 8000);
await shot(page, "5-airstrike-c-map.png");
const deaths0 = await page.evaluate(() => window.__trollOps.player.deaths);
await markFarCorner();
const lsFired = await until(() => !window.__trollOps.streaks.ready("airstrike") && !window.__trollOps.markingStreak(), 10000);
const lsBack = await until(() => window.__trollOps.player.holding === "melee", 15000);
await sleep(400);
await shot(page, "5-airstrike-d-back.png");
check("Lightning Strike off melee: holster, dive, map, strike, melee back",
  ls.holstered && ls.up && ls.dive && lsOpen && lsFired && lsBack, JSON.stringify({ ...ls, lsOpen, lsFired, lsBack, ...(await view()) }));
await sleep(4000);   // let the bombs land
const lsDied = await page.evaluate((d) => window.__trollOps.player.deaths > d, deaths0);
check("...and the strike didn't land on us", !lsDied);

// VTOL Warship: holster, dive into the gunner seat, end it, melee back.
await fromMelee();
const ws = await holsterThenTablet("warship");
const wsView = await until(() => window.__trollOps.warshipView(), 20000);
await sleep(500);
await shot(page, "5-warship-c-seat.png");
await page.evaluate(() => window.__trollOps.endActiveStreak());
const wsBack = await until(() => !window.__trollOps.warshipView() && window.__trollOps.player.holding === "melee", 20000);
await sleep(600);
await shot(page, "5-warship-d-back.png");
check("VTOL Warship off melee: holster, dive, gunner seat, melee back after",
  ws.holstered && ws.up && ws.dive && wsView && wsBack, JSON.stringify({ ...ws, wsView, wsBack, ...(await view()) }));

// Dragonfire: needs open sky overhead, so find a spot outside first.
await fromMelee();
const outside = await page.evaluate(() => {
  const T = window.__trollOps;
  // dragonfireBlocked() caches for 250 ms; the raw check answers per spot.
  if (!T.dragonfireSkyCheck(T.move.pos)) return true;
  for (let x = -40; x <= 40; x += 8) for (let z = -40; z <= 40; z += 8) {
    T.move.reset(x, z, 0);
    if (!T.dragonfireSkyCheck(T.move.pos)) return true;
  }
  return false;
});
await sleep(400);
check("found open sky for the Dragonfire", outside);
const df = await holsterThenTablet("dragonfire");
const dfView = await until(() => window.__trollOps.dragonfireView(), 30000);
await sleep(500);
await shot(page, "5-dragonfire-c-cam.png");
await page.evaluate(() => window.__trollOps.endActiveStreak());
const dfBack = await until(() => !window.__trollOps.dragonfireView() && window.__trollOps.player.holding === "melee", 20000);
await sleep(600);
await shot(page, "5-dragonfire-d-back.png");
check("Dragonfire off melee: holster, dive, drone cam, melee back after",
  df.holstered && df.up && df.dive && dfView && dfBack, JSON.stringify({ ...df, dfView, dfBack, ...(await view()) }));

/* ---- 6. the marking streaks off the secondary: Care Package (thrown, and
   cancelled) and Lightning Strike. Back on the same sidearm after each. */
const fromSecondary = async () => {
  await close();
  await page.evaluate(() => { const T = window.__trollOps; T.clearStreakLocks(); T.switchWeapon("secondary"); });
  await until(() => { const T = window.__trollOps; return T.player.holding === "gun" && T.currentWeapon().def.id === T.player.secondaryId; }, 10000);
  return page.evaluate(() => { const T = window.__trollOps; return T.player.holding === "gun" && T.currentWeapon().def.id === T.player.secondaryId; });
};
const onSecondary = () => page.evaluate(() => { const T = window.__trollOps; return T.player.holding === "gun" && T.currentWeapon().def.id === T.player.secondaryId; });

// Care package, thrown: marker up, throw it (spends it), back on the secondary.
// (Counted, not ready(): the cancel in section 3 left one banked.)
const cpOn = await fromSecondary();
const cpCharges = () => page.evaluate(() => window.__trollOps.streaks.charges.carepackage || 0);
const cp0 = await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("carepackage"); const n = T.streaks.charges.carepackage; T.callStreak("carepackage"); return n; });
const cpUp = await until(() => window.__trollOps.player.holding === "streak" && window.__trollOps.markingStreak() === "carepackage", 5000);
await sleep(400);
await shot(page, "6-carepackage-a-marker.png");
await page.evaluate(() => window.__trollOps.throwMarker());
await sleep(150);
await shot(page, "6-carepackage-b-throw.png");
const cpSpent = (await cpCharges()) === cp0 - 1 && !(await page.evaluate(() => window.__trollOps.markingStreak()));
const cpBack = await until(() => window.__trollOps.player.holding !== "streak", 10000) && await onSecondary();
await sleep(400);
await shot(page, "6-carepackage-c-back.png");
check("Care Package off the secondary: marker up, thrown, back on the secondary",
  cpOn && cpUp && cpSpent && cpBack, JSON.stringify({ cpOn, cpUp, cpSpent, cpBack, ...(await view()) }));

// Care package, cancelled: still banked, back on the secondary.
await fromSecondary();
await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("carepackage"); T.callStreak("carepackage"); });
await until(() => window.__trollOps.player.holding === "streak", 5000);
await sleep(300);
await page.evaluate(() => window.__trollOps.cancelMark());
const ccBack = await until(() => window.__trollOps.player.holding !== "streak", 10000) && await onSecondary();
const ccBanked = (await cpCharges()) === cp0;   // the one granted for it, still there
check("...cancelled off the secondary: still banked, back on the secondary", ccBack && ccBanked, JSON.stringify({ ccBack, ccBanked, ...(await view()) }));

// Lightning Strike: tablet dive, the map, three marks, back on the secondary.
const lsOn = await fromSecondary();
const deaths1 = await page.evaluate(() => window.__trollOps.player.deaths);
await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("airstrike"); T.callStreak("airstrike"); });
const sUp = await until(() => window.__trollOps.player.holding === "streak", 5000);
const sDive = await until(() => !!window.__trollOps.tabletDive(), 3000);
await sleep(250);
await shot(page, "6-airstrike-a-dive.png");
const sOpen = await until(() => window.__trollOps.strikeTablet()?.isOpen, 8000);
await shot(page, "6-airstrike-b-map.png");
await markFarCorner();
const sFired = await until(() => !window.__trollOps.streaks.ready("airstrike") && !window.__trollOps.markingStreak(), 10000);
const sBack = await until(() => window.__trollOps.player.holding !== "streak", 15000) && await onSecondary();
await sleep(400);
await shot(page, "6-airstrike-c-back.png");
check("Lightning Strike off the secondary: dive, map, strike, back on the secondary",
  lsOn && sUp && sDive && sOpen && sFired && sBack, JSON.stringify({ lsOn, sUp, sDive, sOpen, sFired, sBack, ...(await view()) }));
await sleep(4000);   // let the bombs land
check("...and that strike didn't land on us either", !(await page.evaluate((d) => window.__trollOps.player.deaths > d, deaths1)));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
