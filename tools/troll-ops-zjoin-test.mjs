// Troll Forces Zombies: joining a friend's run already going. Tabs in one
// headless browser share a PRIVATE room code over BroadcastChannel
// (Supabase is blocked; never a public room):
//   1. A starts Hollowgrin and gets into a wave. B joins on the same code
//      with another map picked: B loads A's map anyway (user, 2026-10-14:
//      "only if i choose the right map").
//   2. B came in mid-round: it waits, out of the fight, and spawns in when
//      the round is cleared.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zjoin-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOM = "ZJ" + String(Math.floor(Math.random() * 900 + 100));
const errors = [];

async function open(label) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  return page;
}
async function start(page, map, quiet) {
  await page.evaluate(async ({ room, map, quiet }) => {
    const T = window.__trollOps;
    if (quiet) T.composer.render = () => {};
    T.setMode("zombies");
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    T.loadout.poolMapId = map;
    await T.startGame();
  }, { room: ROOM, map, quiet });
}
async function loaded(page, ms = 240000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms && await page.evaluate(() => window.__trollOps.loadState().open)) await sleep(250);
}
const until = async (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
const R = (page, fn, arg) => page.evaluate(fn, arg);

const a = await open("A");
await start(a, "hollowgrin", true);
await loaded(a);
await R(a, () => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
check(await until(a, () => window.__trollOps.zrun().coop.coop.on !== undefined && (window.__trollOps.zdir()?.round || 0) >= 1, null, 20000), "A is in wave 1");

// ---- 1. B joins with the wrong map picked
const b = await open("B");
await start(b, "pentagrin", false);
await loaded(b);
await R(b, () => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
await sleep(1500);
const mapA = await R(a, () => window.__trollOps.builtMap()?.map?.name);
const mapB = await R(b, () => window.__trollOps.builtMap()?.map?.name);
check(mapA === mapB, "B plays A's map, not the one B picked", `A ${mapA}, B ${mapB}`);

// ---- 2. B waits for the round to end
const w = () => R(b, () => { const T = window.__trollOps; const r = T.zrun(); return { waiting: !!r.run.waiting, out: !!T.player.out, downed: !!T.player.downed, round: T.zdir()?.round, state: T.zdir()?.state }; });
const s1 = await w();
check(s1.waiting && s1.out, "B joined mid-round: waiting to spawn", JSON.stringify(s1));
// A clears the wave (everyone on it dead, nothing left to spawn)
await R(a, () => { const zd = window.__trollOps.zdir(); zd.toSpawn = 0; for (const z of zd.zombies) if (z.alive && !z.dying) z.takeDamage(1e9, false); });
const up = await until(b, () => { const T = window.__trollOps; return !T.zrun().run.waiting && !T.player.downed; }, null, 20000);
check(up, "B spawns in when the round is cleared", JSON.stringify(await w()));

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
