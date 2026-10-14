// Troll Forces: one room, one match. Tabs in one headless browser share a
// PRIVATE room code over BroadcastChannel (Supabase is blocked; never a
// public room). User, 2026-10-14: a friend on One in the Chamber ended at
// 12 kills while the other played Team Deathmatch in the same room.
//   1. A hosts TDM on Grinsite; B joins with One in the Chamber on Dustbowl
//      picked: B plays TDM on Grinsite.
//   2. A's side hits the score limit: B's match ends too, same result.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-roomsync-test.mjs
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
const ROOM = "RS" + String(Math.floor(Math.random() * 900 + 100));
const errors = [];

async function open(label) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  return page;
}
async function start(page, mode, map, quiet) {
  await page.evaluate(async ({ room, mode, map, quiet }) => {
    const T = window.__trollOps;
    if (quiet) T.composer.render = () => {};
    T.setMode(mode);
    T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    T.loadout.versusMapId = map;
    await T.startGame();
  }, { room: ROOM, mode, map, quiet });
}
async function loaded(page, ms = 240000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms && await page.evaluate(() => window.__trollOps.loadState().open)) await sleep(250);
}
const until = async (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
const R = (page, fn, arg) => page.evaluate(fn, arg);
const st = (p) => R(p, () => { const T = window.__trollOps; return { mode: T.modeId(), map: T.builtMap()?.map?.name, state: T.state() }; });

// ---- 1. A hosts Team Deathmatch on Grinsite; B comes in on One in the Chamber, Dustbowl
const a = await open("A");
await start(a, "tdm", "grinsite", true);
await loaded(a);
await R(a, () => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
const b = await open("B");
await start(b, "oitc", "dustbowl", false);
await loaded(b);
await sleep(1500);
const sa = await st(a), sb = await st(b);
check(sb.mode === "tdm", "B plays the host's mode", JSON.stringify(sb));
check(sa.map === sb.map, "...on the host's map", `A ${sa.map}, B ${sb.map}`);

// ---- 2. A's side hits the limit: B's match ends too, same result
await R(b, () => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
// the limit is checked on a kill, as scoring.js does after one (its module, as game.js imports it)
await R(a, async () => {
  const T = window.__trollOps;
  T.teamScores.phantom = 69;
  const src = await (await fetch("/assets/games/troll-ops/game.js")).text();
  const i = src.indexOf("./combat/scoring.js?v=");
  const url = "/assets/games/troll-ops/" + src.slice(i + 2, src.indexOf(String.fromCharCode(34), i));
  (await import(url)).checkMatchEnd();
});
const over = await until(b, () => window.__trollOps.state() === "gameover", null, 15000);
check(over, "B's match ends when A's does", JSON.stringify(await st(b)));
const title = (p) => R(p, () => document.getElementById("to-go-title")?.textContent || "");
const ta = await title(a), tb = await title(b);
check(!!ta && ta === tb, "...with the same result", `A ${ta}, B ${tb}`);

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
