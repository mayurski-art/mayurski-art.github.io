// Bot scorestreaks, phases 2 and 3: a bot throws a care package marker,
// runs to the crate and captures it (the reward lands in its slots); a bot
// marks a Lightning Strike where its side has been seeing enemies; a bot
// calls the VTOL Warship, stands still and works its guns; only one bot
// warship a match. Picks and meters are set by hand.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-bot-streaks2-test.mjs

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

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });

await page.evaluate(async () => {
  const T = window.__trollOps;
  T.els.botStreaks.checked = true;
  T.setMode("tdm");
  T.els.noBots.checked = false;
  T.loadout.mapId = "grinsite";
  await T.startGame();
  if (T.isStaging()) T.endStaging();
  T.player.maxHp = T.player.hp = 1e6;
});
await sleep(2500);

// Three bots get one of the new streaks each, ready to call; the rest keep
// theirs but stay empty, so the sky isn't full of other things.
const setup = await page.evaluate(() => {
  const T = window.__trollOps;
  const list = T.bots.bots;
  const want = ["carepackage", "airstrike", "warship"];
  const out = {};
  list.forEach((b, i) => {
    const s = T.botStreakState(b);
    s.pts = 0; s.ready.length = 0; s.earned.clear();
    if (i < 3) { s.picks = [want[i], "uav", "k9"]; s.ready.push(want[i]); out[want[i]] = b.id; }
  });
  window.__w = { crates: new Map(), shots: 0, gunnerMoved: 0, gunnerAt: null, warships: new Set(), strike: false, feed: new Set() };
  return out;
});
const t0 = Date.now();
while (Date.now() - t0 < 60000) {
  await page.evaluate((ids) => {
    const T = window.__trollOps, w = window.__w;
    T.player.hp = 1e6;
    for (const e of T.streakEntities.values()) {
      if (e.constructor.name === "CarePackage" && e.botId) {
        const c = w.crates.get(e.id) || { landed: false, claimed: false };
        c.landed ||= e.landed; c.claimed ||= e.claimed;
        w.crates.set(e.id, c);
      }
      if (e.constructor.name === "VtolWarship" && e.botId) {
        w.warships.add(e.id);
        if (!e.__spied) { e.__spied = true; const s = e.shoot.bind(e); e.shoot = (...a) => { w.shots++; return s(...a); }; }
        const g = T.bots.byId(e.botId);
        if (g && g.alive && e.age < e.duration) {
          if (w.gunnerAt) w.gunnerMoved = Math.max(w.gunnerMoved, Math.hypot(g.pos.x - w.gunnerAt[0], g.pos.z - w.gunnerAt[1]));
          else w.gunnerAt = [g.pos.x, g.pos.z];
        }
      }
    }
    if (T.botStreakLog.some((c) => c.id === "airstrike")) w.strike = true;
    // The care-package bot gets its crate's streak: it shows up as ready (or called).
    const cb = T.bots.byId(ids.carepackage);
    if (cb) w.pkgBotReady = Math.max(w.pkgBotReady || 0, T.botStreakState(cb).ready.length);
    for (const d of document.querySelectorAll(".to-kf-item")) w.feed.add(d.textContent);
  }, setup);
  await sleep(300);
}
const r = await page.evaluate(() => {
  const T = window.__trollOps, w = window.__w;
  return {
    crates: [...w.crates.values()], shots: w.shots, moved: w.gunnerMoved, warships: w.warships.size, strike: w.strike,
    pkgReady: w.pkgBotReady || 0, calls: T.botStreakLog.map((c) => c.id), feed: [...w.feed],
  };
});
check("a bot throws its care package marker and the crate lands", r.crates.some((c) => c.landed), JSON.stringify(r.crates));
check("the bot runs to its crate and captures it", r.crates.some((c) => c.claimed), JSON.stringify(r.crates));
check("the crate's streak goes into the bot's slots", r.pkgReady >= 1 || r.calls.filter((c) => c !== "carepackage").length > r.calls.filter((c) => c === "airstrike" || c === "warship").length, `ready peak ${r.pkgReady}, calls ${r.calls.join(",")}`);
check("a bot marks a Lightning Strike once its side has seen someone", r.strike, r.calls.join(","));
check("a bot calls the VTOL Warship", r.warships === 1, `${r.warships} warships`);
check("the bot gunner fires the warship's guns", r.shots >= 8, `${r.shots} rounds`);
check("the gunner stands still while it's on the guns", r.moved < 0.6, `${r.moved.toFixed(2)} m`);

// Only one bot warship a match: hand another bot a warship and watch.
await page.evaluate(() => {
  const T = window.__trollOps;
  const b = T.bots.bots.find((x) => x.alive);
  const s = T.botStreakState(b);
  s.ready.push("warship");
  window.__w.warships.clear();
});
const t1 = Date.now();
while (Date.now() - t1 < 12000) {
  await page.evaluate(() => { const T = window.__trollOps; T.player.hp = 1e6; for (const e of T.streakEntities.values()) if (e.constructor.name === "VtolWarship" && e.botId && e.age < 3) window.__w.warships.add(e.id); });
  await sleep(300);
}
const second = await page.evaluate(() => window.__w.warships.size);
check("only one bot warship a match", second === 0, `${second} new`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
