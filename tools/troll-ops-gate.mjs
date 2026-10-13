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
//   3. bots     on every map in the vote pool, every bot covers ground (the
//               frozen-bot class)
//   4. input    tools/troll-ops-input-test.mjs: a fake pad and touch screen
//               press every control once; troll-ops-menu-test.mjs clicks
//               every lobby panel and saves a few settings;
//               troll-ops-killcam-test.mjs dies to a scoped bot's frag and
//               watches the replay; troll-ops-objectives-test.mjs holds a
//               KOTH hill and wins an S&D round
//   5. rooms    tools/troll-ops-sync-test.mjs, troll-ops-load-sync-test.mjs,
//               troll-ops-bot-host-test.mjs (who runs the bots, two tabs:
//               stalls, slow loads, a frozen host),
//               troll-ops-escalator-test.mjs and troll-ops-zhub-test.mjs
//               (the Zombies hub: pads, a run and back, the private pad)
//
// Supabase is blocked throughout: a test page must never join the live
// public room (a hidden test tab once became its bot host and froze the
// bots for real players).
//
// The standalone tests (4 and 5) run JOBS at a time once 2 and 3 are done
// (beside them, the busy machine starved the bots' frames and failed them);
// the bot-host test, the longest, starts first. A test that fails while
// others ran beside it is run once more on its own: a pass there is a
// busy-machine flake, said so in the report, not a red gate.
//
// Usage: node tools/troll-ops-gate.mjs [--quick] [--base <ref>] [--jobs 3]
//   (full)    everything above, once, before the push (user, 2026-10-13)
//   --quick   1, the page boot and 2, then only the tests for the files
//             changed in the last commit and not yet committed (--base
//             HEAD~3 for a task of three commits; TEST_MAP below); 3 only
//             if maps or bots changed. The check between tasks, ~5-10 min.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync, spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const QUICK = argv.includes("--quick");
const BASE_REF = flag("base", "HEAD~1");
const JOBS = Math.max(1, +flag("jobs", 3) || 3);
const t0 = Date.now();
let stepT = Date.now();
const stepDone = (name) => { console.log(`   (${name}: ${Math.round((Date.now() - stepT) / 1000)}s)`); stepT = Date.now(); };

/* ---------------------------------------------------------------- the tests */

// The standalone tests the full gate runs.
const INPUT_TESTS = ["troll-ops-input-test.mjs", "troll-ops-menu-test.mjs", "troll-ops-killcam-test.mjs", "troll-ops-objectives-test.mjs", "troll-ops-rope-test.mjs", "troll-ops-zcredits-test.mjs", "troll-ops-zanim-test.mjs"];
const ROOM_TESTS = ["troll-ops-sync-test.mjs", "troll-ops-load-sync-test.mjs", "troll-ops-bot-host-test.mjs", "troll-ops-escalator-test.mjs", "troll-ops-zhub-test.mjs"];
// the bot-host test plays a dozen two-tab matches: it gets longer
const timeoutFor = (t) => (t === "troll-ops-bot-host-test.mjs" ? 1500000 : 600000);

// --quick: which tests a changed file calls for. "bots" = step 3. Keep each
// entry to tests that pass on main.
const z = (...t) => t.map((x) => `troll-ops-${x}-test.mjs`);
const TEST_MAP = [
  [/modes\/zombies\/(credits|economy|upgrades)\.js|view\/zombies-(kiosk|thumbs)\.js/, z("zcredits", "zrun")],
  [/modes\/zombies\/hub\.js|zhub\.js/, z("zhub")],
  [/modes\/zombies\/coop\.js/, z("zcoop")],
  [/modes\/zombies\/(deployables|kits)\.js|view\/zombies-bars\.js/, z("zdeploy")],
  [/modes\/zombies\/boss\.js/, z("zboss")],
  [/modes\/zombies\/run\.js|view\/zombies-hud\.js/, z("zrun", "zdeploy")],
  [/troll-ops\/zombies\.js|zombie-models\.js/, z("zrun", "zanim", "zcoop")],
  [/input\/|keyboard-mouse|gamepad|touch/, z("input")],
  [/menu\/|menu-bo2\.js|loadout\.js|style\.css|troll-ops\.html/, z("menu")],
  [/troll-ops\/weapons\.js|combat\/|attachments\.js|weapon-|view\/(weapon-view|viewmodels)\.js/, z("input", "killcam")],
  [/net\.js|remote-players\.js|modes\/match-(start|end)\.js|modes\/spawns\.js/, z("sync", "load-sync")],
  [/troll-ops\/bots\.js|troll-ops\/bot-|modes\/bot-/, [...z("bot-host"), "bots"]],
  [/objectives|match-clock/, z("objectives")],
  [/grinjuku|movement\.js/, z("rope")],
  [/trollingloud/, z("escalator")],
  [/maps\.js|map-|-layout\.js|pentagrin|hollowgrin|trollcity|grinleria|dustbowl|nav\.js/, ["bots"]],
  [/core\/state\.js|troll-ops\/game\.js/, z("input")],
];

/* Run one test script; resolves { t, ok, fails, code, secs }. */
function runTest(t) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(process.execPath, [path.join(ROOT, "tools", t)], { cwd: ROOT, env: process.env });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    const kill = setTimeout(() => child.kill(), timeoutFor(t));
    child.on("close", (code) => {
      clearTimeout(kill);
      const fails = out.split("\n").filter((l) => l.startsWith("FAIL"));
      resolve({ t, ok: code === 0 && fails.length === 0, fails, code, secs: Math.round((Date.now() - start) / 1000) });
    });
  });
}

/* Tests JOBS at a time; one that fails is run once more alone at the end. */
async function runPool(tests) {
  const queue = [...tests];
  const results = [];
  const worker = async () => { while (queue.length) results.push(await runTest(queue.shift())); };
  await Promise.all(Array.from({ length: Math.min(JOBS, tests.length) }, worker));
  for (const r of results) {
    if (r.ok || JOBS === 1) continue;
    const again = await runTest(r.t);
    if (again.ok) { r.ok = true; r.retried = true; r.secs += again.secs; }
    else if (again.fails.length) r.fails = again.fails;
  }
  return results;
}
const report = (r) => check(r.t, r.ok, r.ok ? `${r.secs}s${r.retried ? ", passed on a solo retry (failed beside other tests)" : ""}`
  : r.fails.slice(0, 3).join(" | ") || `exit ${r.code}`);

/* --quick: the tests this branch's changes call for. */
let quickTests = [], quickBots = false;
// (once: the parent re-runs itself under --experimental-vm-modules first)
if (QUICK && typeof vm.SourceTextModule === "function") {
  let changed = [];
  try {
    const out = execSync(`git diff --name-only ${BASE_REF} HEAD`, { cwd: ROOT, encoding: "utf8" })
      + execSync("git diff --name-only HEAD", { cwd: ROOT, encoding: "utf8" });
    changed = [...new Set(out.split("\n").map((l) => l.trim()).filter(Boolean))]
      .filter((f) => /^(assets\/games\/troll-ops\/|troll-ops\.html|tools\/troll-ops-)/.test(f) && !/\.md$|\/refs\//.test(f));
  } catch (e) { console.log(`(no diff against ${BASE_REF}: ${e.message.split("\n")[0]})`); }
  const set = new Set();
  const unmapped = [];
  for (const f of changed) {
    const own = f.match(/^tools\/(troll-ops-[\w-]+-test\.mjs)$/);   // a changed test runs itself
    if (own) { set.add(own[1]); continue; }
    if (f.startsWith("tools/")) continue;
    const hits = TEST_MAP.filter(([re]) => re.test(f));
    if (!hits.length) unmapped.push(f);
    for (const [, ts] of hits) for (const t of ts) set.add(t);
  }
  quickBots = set.delete("bots");
  quickTests = [...set].filter((t) => fs.existsSync(path.join(ROOT, "tools", t)));
  console.log(`quick: ${changed.length} changed files since ${BASE_REF}; tests: ${quickTests.join(", ") || "none"}${quickBots ? " + the bots step" : ""}`);
  if (unmapped.length) console.log(`  no test covers: ${unmapped.join(", ")} (the modes step still boots them)`);
}
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

stepDone("parse");

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
const MODES = ["tdm", "umb", "koth", "oitc", "snd", "gungame", "infection", "royale", "social", "zombies", "zhub"];
for (const mode of MODES) {
  const before = errors.length;
  let r;
  try { r = await play(mode, null, 8); }
  catch (e) { r = { state: `threw: ${e.message.split("\n")[0]}` }; }
  check(`${mode}: a match runs with no page errors`, r.state === "playing" && errors.length === before,
    `${r.state}, map ${r.map}, ${r.bots ?? 0} bots${errors.length > before ? `, ${errors.slice(before, before + 2).join(" | ")}` : ""}`);
}

stepDone("modes");

// ---------------------------------------------------------------- 3. bots
if (!QUICK || quickBots) {
console.log("\n== bots");
// Every map in the vote pool (maps.js MAP_IDS, the copy game.js imports):
// three that weren't covered froze for real players (2026-10-11).
const mapsTag = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/\.\/maps\.js(\?v=[^"']*)["']/)?.[1] || "";
const mapIds = await page.evaluate(async (u) => (await import(u)).MAP_IDS, `/assets/games/troll-ops/maps.js${mapsTag}`);
check(`the vote pool lists its maps (${mapIds.length})`, mapIds.length >= 8, mapIds.join(" "));
for (const mapId of mapIds) {
  const r = await play("tdm", mapId, 15);
  check(`${mapId}: every bot covers ground`, r.bots > 0 && r.still === 0 && r.avg > 1,
    `${r.bots} bots, avg ${r.avg.toFixed(2)} m/s, ${r.still} under 0.5 m/s over ${r.live}s`);
}
stepDone("bots");
}

await browser.close();
server.close();

// ---------------------------------------------------------------- 4 + 5. the tests
console.log(`\n== tests (${JOBS} at a time)`);
const poolTests = QUICK ? quickTests : ["troll-ops-bot-host-test.mjs", ...INPUT_TESTS, ...ROOM_TESTS.filter((t) => t !== "troll-ops-bot-host-test.mjs")];
const results = await runPool(poolTests);
const order = (t) => poolTests.indexOf(t);
for (const r of results.sort((a, b) => order(a.t) - order(b.t))) report(r);
if (!poolTests.length) console.log("(none for these changes)");
stepDone("tests");

console.log(`\n${QUICK ? "QUICK " : ""}${failures ? `GATE RED: ${failures} failed` : "GATE GREEN"} in ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(failures ? 1 : 0);
