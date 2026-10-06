// Troll Forces gate: run before every push that touches assets/games/troll-ops.
// Green = the game still parses, boots, plays every mode, its bots move, and
// two clients still share a room. Any red stops the push (the game.js split
// plan, 2026-10-06, and every fix after it).
//
//   1. parse    every troll-ops module as a strict ES module, and the game.X
//               link table (troll-ops-linkcheck.mjs); (node --check
//               misses errors in these files: esm-syntax-check gotcha)
//   2. modes    one headless page plays a short match in every mode with no
//               page errors
//   3. bots     on three maps, every bot covers ground (the frozen-bot class)
//   4. input    tools/troll-ops-input-test.mjs: a fake pad and touch screen
//               press every control once; troll-ops-menu-test.mjs clicks
//               every lobby panel and saves a few settings
//   5. rooms    tools/troll-ops-sync-test.mjs and troll-ops-load-sync-test.mjs
//
// Supabase is blocked throughout: a test page must never join the live
// public room (a hidden test tab once became its bot host and froze the
// bots for real players).
//
// Usage: node tools/troll-ops-gate.mjs [--quick]   (--quick skips 5)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
const QUICK = process.argv.includes("--quick");
const t0 = Date.now();
let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- 1. parse
console.log("\n== parse");
if (typeof vm.SourceTextModule !== "function") {
  // Re-run under the flag the strict parser needs.
  const r = spawnSync(process.execPath, ["--experimental-vm-modules", "--no-warnings", ...process.argv.slice(1)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
{
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!["models", "textures", "music", "songs", "refs", "skins", "ui", "medals"].includes(e.name)) walk(path.join(d, e.name)); }
    else if (e.name.endsWith(".js")) files.push(path.join(d, e.name));
  } };
  walk(GAME);
  const bad = [];
  for (const f of files) {
    try { new vm.SourceTextModule(fs.readFileSync(f, "utf8"), { identifier: f }); }
    catch (e) { bad.push(`${path.relative(ROOT, f)}: ${e.message}`); }
  }
  check(`${files.length} modules parse as ES modules`, bad.length === 0, bad.slice(0, 5).join(" | "));
  const lc = spawnSync(process.execPath, [path.join(ROOT, "tools", "troll-ops-linkcheck.mjs")], { encoding: "utf8" });
  check("every game.X a module uses is linked (writes have setters)", lc.status === 0, `${lc.stdout}${lc.stderr}`.trim().split("\n").slice(-4).join(" | "));
}

// ---------------------------------------------------------------- server + page
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];
let page = null;
/* A fresh page per match. Ending one match in place leaves the room's
   between-match intermission running, and it fires into the next match's
   start; players always come back through the menu, so the gate does too. */
async function freshPage() {
  if (page) await page.close();
  page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  await page.route(/supabase/, (r) => r.abort());
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 }).catch(() => {});
  return page.evaluate(() => !!window.__trollOps);
}
check("troll-ops.html boots with its test hooks", await freshPage(), errors.slice(0, 2).join(" | "));

/* Start a match and let it run `sim` game-seconds past the countdown. */
async function play(mode, mapId, sim) {
  await freshPage();
  await page.evaluate(async ([mode, mapId]) => {
    const T = window.__trollOps;
    T.setMode(mode);
    if (mapId) T.loadout.mapId = mapId;
    await T.startGame();
    if (T.isStaging?.()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
    const W = window.__gate = { live: 0, first: new Map(), last: new Map(), path: new Map(), at: new Map() };
    if (!T.bots.__gateOrig) T.bots.__gateOrig = T.bots.update.bind(T.bots);
    T.bots.update = (dt, ctx) => {
      T.bots.__gateOrig(dt, ctx);
      if (T.isStaging?.()) return;
      W.live += dt;
      T.player.hp = 1e9;
      for (const b of T.bots.bots) {
        if (!b.alive) continue;
        const prev = W.at.get(b.id);
        if (prev) W.path.set(b.id, (W.path.get(b.id) || 0) + Math.hypot(b.pos.x - prev[0], b.pos.z - prev[1]));
        W.at.set(b.id, [b.pos.x, b.pos.z]);
        if (!W.first.has(b.id)) W.first.set(b.id, W.live);
        W.last.set(b.id, W.live);
      }
    };
  }, [mode, mapId]);
  // Modes without bots (zombies, social) never call bots.update: time out on
  // the wall clock instead, and judge them on state + page errors alone.
  const start = Date.now();
  while (Date.now() - start < 60000) {
    const live = await page.evaluate(() => window.__gate.live);
    if (live >= sim) break;
    await sleep(400);
  }
  return page.evaluate(() => {
    const T = window.__trollOps, W = window.__gate;
    const speeds = [...W.path.entries()].map(([id, d]) => d / Math.max(0.5, W.last.get(id) - W.first.get(id)));
    return { state: T.state(), map: T.loadout.mapId, bots: T.bots.bots.length, live: +W.live.toFixed(1),
      avg: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
      still: speeds.filter((s) => s < 0.5).length };
  });
}

// ---------------------------------------------------------------- 2. modes
console.log("\n== modes");
const MODES = ["tdm", "umb", "koth", "oitc", "snd", "gungame", "infection", "royale", "social", "zombies"];
for (const mode of MODES) {
  const before = errors.length;
  let r;
  try { r = await play(mode, null, 8); }
  catch (e) { r = { state: `threw: ${e.message.split("\n")[0]}` }; }
  check(`${mode}: a match runs with no page errors`, r.state === "playing" && errors.length === before,
    `${r.state}, map ${r.map}, ${r.bots ?? 0} bots${errors.length > before ? `, ${errors.slice(before, before + 2).join(" | ")}` : ""}`);
}

// ---------------------------------------------------------------- 3. bots
console.log("\n== bots");
for (const mapId of ["trollcity", "hollowgrin", "dustbowl"]) {
  const r = await play("tdm", mapId, 15);
  check(`${mapId}: every bot covers ground`, r.bots > 0 && r.still === 0 && r.avg > 1,
    `${r.bots} bots, avg ${r.avg.toFixed(2)} m/s, ${r.still} under 0.5 m/s over ${r.live}s`);
}

await browser.close();
server.close();

// ---------------------------------------------------------------- 4. input
console.log("\n== input");
for (const t of ["troll-ops-input-test.mjs", "troll-ops-menu-test.mjs"]) {
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools", t)], { cwd: ROOT, encoding: "utf8", timeout: 600000 });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const fails = out.split("\n").filter((l) => l.startsWith("FAIL"));
  check(t, r.status === 0 && fails.length === 0, fails.slice(0, 3).join(" | ") || (r.status !== 0 ? `exit ${r.status}` : ""));
}

// ---------------------------------------------------------------- 5. rooms
if (!QUICK) {
  console.log("\n== rooms");
  for (const t of ["troll-ops-sync-test.mjs", "troll-ops-load-sync-test.mjs"]) {
    const r = spawnSync(process.execPath, [path.join(ROOT, "tools", t)], { cwd: ROOT, encoding: "utf8", timeout: 600000 });
    const out = `${r.stdout || ""}${r.stderr || ""}`;
    const fails = out.split("\n").filter((l) => l.startsWith("FAIL"));
    check(`${t}`, r.status === 0 && fails.length === 0, fails.slice(0, 3).join(" | ") || (r.status !== 0 ? `exit ${r.status}` : ""));
  }
}

console.log(`\n${failures ? `GATE RED: ${failures} failed` : "GATE GREEN"} in ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(failures ? 1 : 0);
