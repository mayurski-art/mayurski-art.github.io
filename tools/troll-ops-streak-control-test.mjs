// Troll Forces scorestreak control: no throwables while a streak is busy;
// the Dragonfire won't launch from inside a house (Cul-de-Grin's houses have
// walls but no roof collider) or under cover, and the HUD tile says why;
// holding X (d-pad right on a pad, END on touch) ends the streak you're in.
// Times are read off the game's own clock (the headless renderer is slow).
// Screenshots go to OUT.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-streak-control-test.mjs
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-saber-deflect-test.mjs

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
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name), timeout: 60000 }).catch(() => console.log(`(screenshot ${name} timed out)`)); };

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.mapId = "culdegrin"; T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
// The map loads behind its loading screen first; wait for the match to be live.
await page.waitForFunction(() => { const s = window.__trollOps.loadState(); return window.__trollOps.state() === "playing" && !s.open && !s.hold; }, null, { timeout: 180000 });
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); T.breakSpawnGuard(); T.player.spawnGuard = 0; });
const map = await page.evaluate(() => window.__trollOps.loadedMapId());
check("on Cul-de-Grin", map === "culdegrin", map);

// Open-sky check at a few spots: in a house, the street, a yard.
const sky = await page.evaluate(() => {
  const T = window.__trollOps, V = T.THREE.Vector3;
  return {
    house: T.dragonfireSkyCheck(new V(-18, 0, -18)),
    house2: T.dragonfireSkyCheck(new V(18, 0, 0)),
    houseNearDoor: T.dragonfireSkyCheck(new V(-14, 0, -16)),
    street: T.dragonfireSkyCheck(new V(0, 0, 0)),
    yard: T.dragonfireSkyCheck(new V(-9, 0, -9)),
  };
});
check("inside a house is blocked", !!sky.house && !!sky.house2 && !!sky.houseNearDoor, JSON.stringify(sky));
check("the street and a yard are clear", !sky.street && !sky.yard, JSON.stringify(sky));

// Standing in a house with a Dragonfire ready: tile says so, the call refuses.
const indoors = await page.evaluate(async () => {
  const T = window.__trollOps;
  T.move.pos.set(-18, 0.05, -18);
  T.streaks.grant("dragonfire");
  await new Promise((r) => setTimeout(r, 1500));
  T.updateStreakHud();
  const tile = [...document.querySelectorAll(".to-ss-slot")].find((r) => r.classList.contains("is-blocked"));
  T.callStreak("dragonfire");
  return { why: T.dragonfireBlocked(), tile: tile?.querySelector(".to-ss-cap span")?.textContent, hasIcon: !!tile?.querySelector(".to-ss-sky"),
    df: !!T.dragonfire(), stillReady: T.streaks.ready("dragonfire"), banner: T.els.waveBanner.textContent };
});
check("indoors: HUD tile flagged with the reason", !!indoors.why && /SKY|CONFINED/.test(indoors.tile || "") && indoors.hasIcon, JSON.stringify(indoors));
check("indoors: Dragonfire refuses to launch and stays banked", !indoors.df && indoors.stillReady && /GET OUTSIDE/.test(indoors.banner), JSON.stringify(indoors));
await shot(page, "sc-indoors.png");

// Step outside: it launches.
const out = await page.evaluate(async () => {
  const T = window.__trollOps;
  T.move.pos.set(0, 0.05, 0);
  await new Promise((r) => setTimeout(r, 1200));
  T.callStreak("dragonfire");
  return { df: !!T.dragonfire(), active: T.streakControlActive() };
});
check("outside: Dragonfire launches", out.df && out.active === "dragonfire", JSON.stringify(out));

// No throwables while it's up.
const nade = await page.evaluate(() => {
  const T = window.__trollOps;
  T.player.gear.lethal = 2; T.player.gear.tactical = 2;
  T.startCook("lethal");
  const cooking = !!T.cooking.def;
  T.releaseCook();
  return { cooking, lethal: T.player.gear.lethal, busy: T.streakBusy() };
});
check("no throwables while flying the Dragonfire", !nade.cooking && nade.lethal === 2 && nade.busy, JSON.stringify(nade));
await page.waitForFunction(() => window.__trollOps.dragonfireView(), null, { timeout: 60000 }).catch(() => {});
await shot(page, "sc-df-prompt.png");
const prompt = await page.evaluate(() => { const el = document.querySelector(".to-ss-endhold"); return { shown: !!el && !el.hidden, text: el?.textContent }; });
check("end prompt shows the key and what it ends", prompt.shown && /X/.test(prompt.text) && /Dragonfire/.test(prompt.text), JSON.stringify(prompt));

// The headless renderer manages about a frame a second, so held inputs are
// driven by stepping the streak update directly (as the fx3 test does).
const step = (n, dt = 0.05) => page.evaluate(([n, dt]) => { for (let i = 0; i < n; i++) window.__trollOps.updateStreakEntities(dt); }, [n, dt]);

// Faster: full stick ahead gets it well past a sprinting troll.
await page.evaluate(() => window.__trollOps.keys.add("KeyW"));
await page.waitForFunction(() => { const d = window.__trollOps.dragonfire(); return d && Math.hypot(d.vel.x, d.vel.z) > 0.5; }, null, { timeout: 60000 }).catch(() => {});
await page.evaluate(() => { const T = window.__trollOps, d = T.dragonfire(); d.pos.set(0, 5, 0); d.vel.set(0, 0, 0); T.look.yaw = -Math.PI / 2; });   // down the open street
// The stick is read off updatePlayer, once a real frame; if the headless
// window lost focus the pause menu is up and it isn't running. Hold it here.
await page.evaluate(async () => {
  const T = window.__trollOps;
  if (!document.getElementById("to-pause").hidden) T.closePauseMenu();
  const { game } = await import("/assets/games/troll-ops/core/state.js?v=st1");
  for (let i = 0; i < 40; i++) { game.dfIx = 0; game.dfIz = 1; T.updateStreakEntities(0.05); }   // 2 s of stick
});
const spd = await page.evaluate(() => { const d = window.__trollOps.dragonfire(); return d ? Math.hypot(d.vel.x, d.vel.z) : -1; });
await page.evaluate(() => window.__trollOps.keys.delete("KeyW"));
check("Dragonfire flies at full speed (> 12 m/s flat out)", spd > 12, spd.toFixed(1));

// The gun overheats on a long burst, locks, then cools and fires again.
const heat = await page.evaluate(() => {
  const T = window.__trollOps, d = T.dragonfire();
  let shots = 0;
  for (let i = 0; i < 200 && !d.overheated; i++) { d.fireT = 0; if (d.tryFire()) shots++; }
  const locked = d.overheated && (d.fireT = 0, !d.tryFire());
  for (let i = 0; i < 40; i++) d.update(0.1);   // 4 s off the trigger
  d.fireT = 0;
  const again = !d.overheated && d.tryFire();
  return { shots, locked, again, heat: +d.heat.toFixed(2) };
});
check("gun overheats after a long burst (~2.5 s of fire) and locks", heat.locked && heat.shots >= 25 && heat.shots <= 35, JSON.stringify(heat));
check("gun cools off the trigger and fires again", heat.again, JSON.stringify(heat));
const heatHud = await page.evaluate(() => !!document.querySelector(".to-df-heat"));
check("heat bar on the pilot's HUD", heatHud);

// A short tap of X doesn't end it; a hold does.
await page.evaluate(() => window.__trollOps.keys.add("KeyX"));
await step(4);    // 0.2 s
await page.evaluate(() => window.__trollOps.keys.delete("KeyX"));
await step(10);
const tap = await page.evaluate(() => !!window.__trollOps.dragonfire());
check("a tap of X doesn't end it", tap);
await page.evaluate(() => window.__trollOps.keys.add("KeyX"));
await step(20);
await page.evaluate(() => window.__trollOps.keys.delete("KeyX"));
const ended = await page.evaluate(() => ({ df: !!window.__trollOps.dragonfire(), view: window.__trollOps.dragonfireView(), banner: window.__trollOps.els.waveBanner.textContent }));
check("holding X ends the Dragonfire", !ended.df && !ended.view, JSON.stringify(ended));

// Throwables come back once it's over.
await page.waitForFunction(() => !window.__trollOps.streakBusy(), null, { timeout: 90000 }).catch(() => {});
const back = await page.evaluate(() => { const T = window.__trollOps; T.startCook("lethal"); const c = !!T.cooking.def; T.cancelCook(); return c; });
check("throwables work again after", back);

// A care package marker (nothing spent until thrown): holding X cancels it
// and the streak stays banked.
const pkg = await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("carepackage"); T.callStreak("carepackage"); return { marking: T.markingStreak() }; });
await page.evaluate(() => window.__trollOps.keys.add("KeyX"));
await step(20);
await page.evaluate(() => window.__trollOps.keys.delete("KeyX"));
const pkg2 = await page.evaluate(() => ({ marking: window.__trollOps.markingStreak(), ready: window.__trollOps.streaks.ready("carepackage") }));
check("holding X cancels a care package marker, still banked", pkg.marking === "carepackage" && !pkg2.marking && pkg2.ready, JSON.stringify({ pkg, pkg2 }));

// The VTOL Warship ends the same way.
await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("warship"); T.fireStreak("warship"); });
await step(30);
// Touch: tapping a gun's label on the warship HUD switches to it (no 1/2 keys on a phone).
const wsTap = await page.evaluate(() => {
  const T = window.__trollOps;
  const before = T.warshipGun(), view = T.warshipView();
  const span = document.querySelector(`.to-ws-guns span[data-g="${before === "chain" ? "cannon" : "chain"}"]`);
  span?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  const after = T.warshipGun();
  span?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));   // same label again: no change
  return { view, before, after, again: T.warshipGun() };
});
check("tapping a warship gun label switches to that gun", wsTap.view && wsTap.after !== wsTap.before && wsTap.again === wsTap.after, JSON.stringify(wsTap));
await page.evaluate(() => window.__trollOps.keys.add("KeyX"));
await step(20);
await page.evaluate(() => window.__trollOps.keys.delete("KeyX"));
const ws = await page.evaluate(() => { const w = window.__trollOps.warship(); return { active: window.__trollOps.streakControlActive(), leaving: w ? w.age >= w.duration : true }; });
check("holding X ends the VTOL Warship", !ws.active && ws.leaving, JSON.stringify(ws));

// Veteran bots: 1.4x the streak meter and the aircraft cap (was 2x; user
// wanted fewer bot streaks, 1c0731d).
const vet = await page.evaluate(() => {
  const T = window.__trollOps;
  const reg = { id: "t-reg", skill: "regular", alive: true }, v = { id: "t-vet", skill: "veteran", alive: true };
  T.botEarn(reg, 300); T.botEarn(v, 300);
  return { reg: T.botStreakState(reg).pts, vet: T.botStreakState(v).pts, m: [T.botStreakMult(reg), T.botStreakMult(v)] };
});
check("veteran bots earn scorestreaks 1.4x as fast", vet.vet === 1.4 * vet.reg && vet.reg > 0 && vet.m[1] === 1.4 && vet.m[0] === 1, JSON.stringify(vet));

check("no page errors", !pageErrors.length, pageErrors.join(" | "));
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
