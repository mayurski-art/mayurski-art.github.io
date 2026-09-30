// Level gate on phones, streak calls keeping your gun, and bots scoping in
// (2026-09-29 asks):
//  - saved streak/gun picks locked by the guest level at page load come
//    back once the account profile lands (trollrunner:auth-changed);
//  - no weapon swap while the streak device is up;
//  - bots scope in on a target past close range, and it shows on the rig.
//
// Usage: node tools/troll-ops-level-ads-test.mjs

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
// A phone that has never played: no guest XP, but k9/warship/swarm saved
// (picked on the account's level elsewhere) and a level-gated primary.
await page.addInitScript(() => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.setItem("trollops:xp", "0");
  localStorage.setItem("trollops:xp-account-sync", "1");
  localStorage.setItem("trollops:streaks", JSON.stringify({ selected: ["k9", "warship", "swarm"] }));
});
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });

// ---- level gate
const before = await page.evaluate(() => window.__trollOps.streakPicker.selected.join());
check("guest level at load: high streaks locked", !before.includes("swarm"), before);
const after = await page.evaluate(() => {
  const acc = window.TrollrunnerAccounts || (window.TrollrunnerAccounts = {});
  acc.getCachedProfile = () => ({ userId: "u", username: "tester", level: 98, xp: 475000 });
  window.dispatchEvent(new CustomEvent("trollrunner:auth-changed", { detail: {} }));
  const T = window.__trollOps;
  return {
    sel: T.streakPicker.selected.join(),
    lockedCards: document.querySelectorAll(".to-ss-card.is-locked").length,
  };
});
check("account level lands: saved streaks come back", after.sel === "k9,warship,swarm", after.sel);
check("…and no card shows locked at LV98", after.lockedCards === 0, String(after.lockedCards));

// ---- match with bots
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  T.els.noBots.checked = false;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 120000 });

// ---- streak device blocks a weapon swap
const swap = await page.evaluate(() => {
  const T = window.__trollOps;
  T.player.hp = 1e6; T.player.maxHp = 1e6;
  T.breakSpawnGuard();
  const primary = T.player.weaponId;
  T.streaks.setSelected(["uav", "counteruav", "helicopter"]);
  T.streaks.grant("uav");
  T.callStreak("uav");
  const holding = T.player.holding;
  T.switchWeapon("secondary");
  return { holding, primary, now: T.currentWeapon().def.id, stillStreak: T.player.holding };
});
check("calling a streak raises the device", swap.holding === "streak", swap.holding);
check("a swap press mid-streak is ignored", swap.stillStreak === "streak" && swap.now === swap.primary, JSON.stringify(swap));
await sleep(3000);
const back = await page.evaluate(() => ({ holding: window.__trollOps.player.holding, id: window.__trollOps.currentWeapon().def.id, primary: window.__trollOps.player.weaponId }));
check("streak done: back on the primary", back.holding === "gun" && back.id === back.primary, JSON.stringify(back));

// ---- bots scope in
const ads = await page.evaluate(async () => {
  const T = window.__trollOps;
  let maxBot = 0, maxRig = 0, scopedFar = 0, hipClose = 0, samples = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 40000) {
    await new Promise((r) => setTimeout(r, 100));
    T.player.hp = T.player.maxHp;
    for (const b of T.bots.bots) {
      maxBot = Math.max(maxBot, b.ads || 0);
      if (b.ads >= 0.99) scopedFar++;
    }
    for (const rp of T.remotes.byId.values()) maxRig = Math.max(maxRig, rp.ads || 0);
    samples++;
    if (maxBot >= 0.99 && maxRig > 0.9) break;
  }
  return { maxBot, maxRig, scopedFar, samples, bots: T.bots.bots.length };
});
check("bots scope in during a fight", ads.maxBot >= 0.99, JSON.stringify(ads));
check("the scope shows on their rig", ads.maxRig > 0.9, JSON.stringify(ads));

const unit = await page.evaluate(() => {
  const b = window.__trollOps.bots.bots[0];
  const save = { ads: b.ads, acq: b.acquireT, tv: b.targetVel.clone() };
  b.acquireT = 5; b.targetVel.set(0, 0, 0);
  b.ads = 0; const hip = b.hitChance(30);
  b.ads = 1; const scoped = b.hitChance(30);
  b.ads = 0; const hipNear = b.hitChance(4);
  b.ads = 1; const scopedNear = b.hitChance(4);
  b.ads = save.ads; b.acquireT = save.acq; b.targetVel.copy(save.tv);
  return { hip, scoped, hipNear, scopedNear };
});
check("scoped beats hip-fire at 30 m", unit.scoped > unit.hip * 1.4, JSON.stringify(unit));
check("up close it makes no difference", Math.abs(unit.hipNear - unit.scopedNear) < 1e-9, JSON.stringify(unit));

check("no page errors", !errors.length, errors.join(" | "));
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
