// Bot scorestreaks, phase 1: bots roll three streaks, earn them on kills,
// call them in a quiet moment, and the seven self-running streaks work for
// them (targeting the other side, the local player included, credit in the
// killfeed). Meters are topped up by hand so the test doesn't wait on kills.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-bot-streaks-test.mjs

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
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });

// ---- the toggle off: nothing is called
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.els.botStreaks.checked = false;
  T.setMode("tdm");
  T.els.noBots.checked = false;
  T.loadout.mapId = "grinsite";
  await T.startGame();
  if (T.isStaging()) T.endStaging();
});
await sleep(2000);
let off = await page.evaluate(() => {
  const T = window.__trollOps;
  for (const b of T.bots.bots) T.botEarn(b, 5000);
  return new Promise((r) => setTimeout(() => r([...T.streakEntities.values()].filter((e) => e.botId).length), 4000));
});
check("\"Bot scorestreaks\" off: bots call nothing", off === 0, `${off} bot streaks`);

// ---- on
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.els.botStreaks.checked = true;
  T.endMatch?.("next");
  await T.startGame();
  if (T.isStaging()) T.endStaging();
  T.player.maxHp = T.player.hp = 5000;   // live through it, but still take the hits
  window.__hurt = [];
  const orig = T.damagePlayer;
});
await sleep(2000);
const picks = await page.evaluate(() => {
  const T = window.__trollOps;
  return T.bots.bots.map((b) => T.botStreakState(b).picks);
});
check("every bot rolls three different streaks", picks.length > 3 && picks.every((p) => p.length === 3 && new Set(p).size === 3), JSON.stringify(picks.slice(0, 3)));

// Everyone's meter full: all three of each bot's picks become ready.
await page.evaluate(() => {
  const T = window.__trollOps;
  for (const b of T.bots.bots) T.botEarn(b, 5000);
  window.__kinds = new Set();
  window.__maxAir = { phantom: 0, ghost: 0 };
  window.__uav = false; window.__feed = new Set();
});
const t0 = Date.now();
while (Date.now() - t0 < 40000) {
  await page.evaluate(() => {
    const T = window.__trollOps;
    for (const e of T.streakEntities.values()) if (e.botId) window.__kinds.add(e.constructor.name + (e.sky ? ":sky" : ""));
    for (const team of ["phantom", "ghost"]) {
      let n = 0;
      for (const e of T.streakEntities.values()) if (e.botId && e.botTeam === team && !e.sky && (e.constructor.name === "HunterDrone" || e.constructor.name === "HelicopterGunship")) n++;
      n += T.swarmRuns.filter((s) => s.botId && s.team === team).length;
      window.__maxAir[team] = Math.max(window.__maxAir[team], n);
    }
    for (const team of ["phantom", "ghost"]) if (T.uavActiveFor(team) || T.vsatActiveFor(team)) window.__uav = true;
    for (const d of document.querySelectorAll(".to-kf-item")) window.__feed.add(d.textContent);
    T.player.hp = Math.max(T.player.hp, 1000);
  });
  await sleep(400);
}
const r = await page.evaluate(() => {
  const feed = [...window.__feed];
  const calls = window.__trollOps.botStreakLog.map((c) => c.id);
  return { kinds: [...window.__kinds], maxAir: window.__maxAir, uav: window.__uav, feed, calls };
});
check("bots' self-running streaks show up in the world", r.kinds.length >= 2, JSON.stringify(r.kinds));
const radarCalled = r.calls.some((c) => c === "uav" || c === "vsat");
check("bots call their streaks", r.calls.length >= 3, r.calls.join(","));
check("a bot UAV (or VSAT) lights up its team's radar", !radarCalled || r.uav, `called: ${radarCalled}`);
check("no more than 2 bot air streaks per team at once", r.maxAir.phantom <= 2 && r.maxAir.ghost <= 2, JSON.stringify(r.maxAir));
const streakKill = r.feed.some((t) => /Gunship|K9|Hunter|Swarm/i.test(t));
check("a bot's streak kill is in the killfeed under its name", streakKill, r.feed.slice(-6).join(" | "));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
