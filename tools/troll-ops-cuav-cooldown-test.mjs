// Counter-UAV, the gunship cooldown, the pad's emote wheel and the chainsaw
// rev (2026-09-29 asks). Offline TDM (no net, so every Counter-UAV from
// "someone else" counts as the enemy's).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-cuav-cooldown-test.mjs

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

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.meleeId = "chainsaw";
  T.setMode("tdm");
  T.els.noBots.checked = true;
  await T.startGame();
});
// The map loads behind its loading screen first; wait for the match to be live.
await page.waitForFunction(() => { const s = window.__trollOps.loadState(); return window.__trollOps.state() === "playing" && !s.open && !s.hold; }, null, { timeout: 180000 });
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
await page.evaluate(() => {
  const T = window.__trollOps;
  setInterval(() => { if (T.player.alive) T.player.hp = T.player.maxHp; }, 50);
  T.streaks.setSelected(["uav", "counteruav", "helicopter"]);
});

// ---- Counter-UAV is a real streak
const def = await page.evaluate(() => {
  const T = window.__trollOps;
  const d = T.STREAK_DEFS?.counteruav;
  return d ? { cost: d.cost, dur: d.duration, lock: d.lockout, slots: T.streakSlotIds().join() } : null;
});
check("Counter-UAV exists: 30 s jam, 45 s UAV lockout", def?.dur === 30 && def?.lock === 45, JSON.stringify(def));
check("it slots between UAV and the gunship", def?.slots === "uav,counteruav,helicopter", def?.slots);

// ---- Gunship: 60 s cooldown from the call (was 90; 21ed934 set 60 s on every streak past Lightning Strike)
const heli = await page.evaluate(async () => {
  const T = window.__trollOps;
  const count = () => [...T.streakEntities.keys()].filter((k) => k.startsWith("streak-heli")).length;
  T.streaks.grant("helicopter");
  T.callStreak("helicopter");
  await new Promise((r) => setTimeout(r, 300));
  const first = count(), lock = T.streakLockLeft("helicopter");
  T.streaks.grant("helicopter");
  T.callStreak("helicopter");
  await new Promise((r) => setTimeout(r, 300));
  T.updateStreakHud();
  const slot = [...document.querySelectorAll(".to-ss-slot")].find((s) => /gunship/i.test(s.title));
  return { first, lock, second: count(), stillBanked: T.streaks.ready("helicopter"),
    slot: slot?.querySelector(".to-ss-cap span")?.textContent, locked: slot?.classList.contains("is-locked") };
});
check("calling a gunship starts a ~60 s cooldown", heli.first === 1 && heli.lock > 55 && heli.lock <= 60, JSON.stringify(heli));
check("a second gunship can't be called during it", heli.second === 1, JSON.stringify(heli));
check("the earned gunship waits in its slot, not lost", heli.stillBanked === true);
check("the HUD slot counts the cooldown down", heli.locked && /^COOLDOWN \d+s$/.test(heli.slot || ""), heli.slot);

// ---- Our Counter-UAV
const ours = await page.evaluate(async () => {
  const T = window.__trollOps;
  await new Promise((r) => setTimeout(r, 2500));   // let the gunship tablet hold finish
  T.streaks.grant("counteruav");
  T.callStreak("counteruav");
  await new Promise((r) => setTimeout(r, 200));
  return { plane: T.flyovers.some((f) => f.counter), jammedSelf: T.minimapJammed() };
});
check("calling a Counter-UAV puts a jammer plane up", ours.plane, JSON.stringify(ours));
check("our own Counter-UAV doesn't jam us", !ours.jammedSelf);

// ---- An enemy Counter-UAV while our UAV is up
const theirs = await page.evaluate(async () => {
  const T = window.__trollOps;
  await new Promise((r) => setTimeout(r, 2500));
  T.streaks.grant("uav");
  T.callStreak("uav");
  await new Promise((r) => setTimeout(r, 200));
  const before = T.enemiesRevealed();
  T.applyCounterUav({ kind: "cuav", action: "start", team: "ghost", duration: 30, lockout: 45, x: 0, z: 0, yaw: 1 });
  const after = { revealed: T.enemiesRevealed(), jammed: T.minimapJammed(), lock: T.streakLockLeft("uav"),
    uavPlanesLeaving: T.flyovers.filter((f) => !f.counter).every((f) => f.duration <= Math.max(f.age, 5) + 0.01) };
  T.streaks.grant("uav");
  T.callStreak("uav");
  await new Promise((r) => setTimeout(r, 200));
  after.stillBanked = T.streaks.ready("uav");
  T.drawMinimap();
  return { before, ...after };
});
check("our UAV was revealing enemies", theirs.before === true);
check("an enemy Counter-UAV kills the reveal and jams the minimap", !theirs.revealed && theirs.jammed, JSON.stringify(theirs));
check("whoever called the UAV is locked out of UAV for 45 s", theirs.lock > 43 && theirs.lock <= 45, theirs.lock.toFixed(1));
check("a UAV can't be called while jammed (the charge waits)", theirs.stillBanked === true);
check("our UAV plane peels off", theirs.uavPlanesLeaving);

// ---- Controller emote wheel: the right stick points at a slice
const wheel = await page.evaluate(() => {
  const W = window.__trollOps.emoteWheel;
  W.open();
  W.aim(0, -1);          // straight up: slot 0
  const up = W.pick;
  W.aim(0.05, 0.02);     // back in the middle: keeps the pick (3c940ee), so a release lands it
  const mid = W.pick;
  W.close(true);
  return { up, mid };
});
check("pad stick up picks the top slice, centred keeps it", wheel.up === 0 && wheel.mid === 0, JSON.stringify(wheel));

// ---- Chainsaw: admiring it revs it, the screen shakes
await page.evaluate(() => window.__trollOps.setHolding("melee"));
await sleep(1500);
await page.evaluate(() => window.__trollOps.startInspect());
let maxRev = 0, maxShake = 0;
for (let i = 0; i < 40; i++) {
  const s = await page.evaluate(() => ({ r: window.__trollOps.sawInspectRev(), s: window.__trollOps.sawShake() }));
  maxRev = Math.max(maxRev, s.r); maxShake = Math.max(maxShake, s.s);
  await sleep(100);
}
check("admiring the chainsaw revs it", maxRev > 0.8, maxRev.toFixed(2));
check("revving shakes the screen", maxShake > 0.003, maxShake.toFixed(4));
await sleep(1000);
const swing = await page.evaluate(async () => {
  const T = window.__trollOps;
  const m = T.player.melee;
  const throttle = T.activeMeleeMesh().getObjectByName("CS_Throttle");
  T.swingMelee();
  let maxShake = 0, maxThrottle = 0;
  const end = performance.now() + 8000;
  while (m.busy && performance.now() < end) {
    await new Promise((r) => requestAnimationFrame(r));
    maxShake = Math.max(maxShake, T.sawShake());
    if (throttle) maxThrottle = Math.max(maxThrottle, throttle.rotation.x);
  }
  return { maxShake, maxThrottle, throttle: !!throttle };
});
check("a swing revs hard enough to shake the screen", swing.maxShake > 0.01, swing.maxShake.toFixed(4));
check("the throttle trigger squeezes on the rev", swing.throttle && swing.maxThrottle > 0.2, JSON.stringify(swing));

// ---- Level readout: Troll Forces XP over what the next Troll Forces level needs
const lv = await page.evaluate(async () => {
  const P = await import("/assets/games/troll-ops/progression.js?v=lv3");
  const real = window.TrollrunnerAccounts;
  window.TrollrunnerAccounts = { ...(real || {}), getCachedProfile: () => ({ xp: 5000, level: 29 }) };
  localStorage.setItem("trollops:xp-pending", "9000");   // queued XP must not show until it lands
  const out = { text: P.rankXpText(), rank: P.getRank(), pct: Math.round(P.rankProgress() * 100) };
  localStorage.removeItem("trollops:xp-pending");
  window.TrollrunnerAccounts = real;
  return out;
});
// progression.js tfXpForLevel: 5,000 XP is level 29 (floor 4,928), level 30 at 5,162: 31%
check("level readout is the Troll Forces level", lv.text === "5,000 / 5,162 XP" && lv.rank === 29 && lv.pct === 31, JSON.stringify(lv));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
