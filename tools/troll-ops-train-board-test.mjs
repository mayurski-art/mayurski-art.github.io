// Troll Forces Socialize, Troll City: the platform's timetable board
// (maps/train-board.js, modes/social-train.js).
//
// One tab on Troll City (Socialize, Supabase blocked so no live room):
//   1. The board hangs over the platform and shows the train's own state:
//      its departure in m:ss matches the timetable, and counts down.
//   2. Through the day: Boarding, All aboard!, Departed, On time, Arriving,
//      each with the right times (the train's clock moved).
//   3. Shots from the platform, both faces.
// Shots: scratch PNGs in tools/.train-board-shots (not committed).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-train-board-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".train-board-shots");
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

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
async function pump(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const fake = { getCachedProfile: () => ({ username: "troll_runner", tags: [] }) };
  Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });

});
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 420000 });
await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("social");
  T.loadout.mapId = "trollcity";
  await T.startGame();
});
await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; });

fs.mkdirSync(SHOTS, { recursive: true });
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
/* The board's words and the train's own state, side by side. */
const read = () => page.evaluate(() => {
  const m = window.__trollOps.builtMap().map.rp, tr = m.train(), b = m.trainBoard?.();
  return { rows: b?.rows || null, draws: b?.draws || 0, st: { ...tr.state }, stop: tr.state.leaveIn - tr.state.arriveIn };
});
const mmss = (s) => { const t = Math.max(0, Math.ceil(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const secs = (t) => { const [m, s] = t.split(":").map(Number); return m * 60 + s; };
/* Move the train's clock so it's `u` seconds into its timetable. */
const setClock = (u) => page.evaluate((u) => {
  const tr = window.__trollOps.builtMap().map.rp.train();
  const now = Date.now() / 1000, P = tr.state.period;
  tr.offset = u - (now % P);
}, u);
const look = (x, z, yaw, pitch = 0.12) => page.evaluate(({ x, z, yaw, pitch }) => {
  const T = window.__trollOps; T.move.reset(x, z, 0.3); T.look.yaw = yaw; T.look.pitch = pitch;
}, { x, z, yaw, pitch });

// ── 1. Live and counting ────────────────────────────────────────────────
await setClock(3);
await look(-20.5, -26.3, Math.PI / 2);
await pump(page, 800);
let r = await read();
check("the board is up on Troll City", !!r.rows && r.draws > 0, JSON.stringify(r.rows));
check("standing: Here now, Boarding", r.rows?.arrives === "Here now" && r.rows?.status === "Boarding", JSON.stringify(r.rows));
check("its departure matches the timetable", Math.abs(secs(r.rows.departs) - r.st.leaveIn) <= 1.05, `${r.rows.departs} vs ${r.st.leaveIn.toFixed(2)}`);
const d0 = secs(r.rows.departs);
await pump(page, 3000);
r = await read();
check("...and counts down", d0 - secs(r.rows.departs) >= 2 && d0 - secs(r.rows.departs) <= 5, `${d0} -> ${secs(r.rows.departs)}`);
check("every lap's on it", r.rows.every === `Round town every ${mmss(r.st.period)}`, r.rows.every);
await shot("board-boarding");

// ── 2. Through the day ──────────────────────────────────────────────────
const stop = await page.evaluate(async () => (await import("/assets/games/troll-ops/maps/train.js?v=tr1b7-or1")).TRAIN.stop), P = r.st.period;
for (const [name, u, want] of [
  ["all aboard", stop - 6, "All aboard!"],
  ["just left", stop + 8, "Departed"],
  ["out on the loop", stop + (P - stop) / 2, "On time"],
  ["coming in", P - 12, "Arriving"],
]) {
  await setClock(u);
  await pump(page, 600);
  r = await read();
  const st = r.st;
  const okTimes = st.v > 0.05
    ? Math.abs(secs(r.rows.arrives) - st.arriveIn) <= 1.05 && Math.abs(secs(r.rows.departs) - st.leaveIn) <= 1.05
    : r.rows.arrives === "Here now" && Math.abs(secs(r.rows.departs) - st.leaveIn) <= 1.05;
  check(`${name}: ${want}, times off the timetable`, r.rows.status === want && okTimes,
    `${JSON.stringify(r.rows)} | arriveIn ${st.arriveIn.toFixed(1)} leaveIn ${st.leaveIn.toFixed(1)} v ${st.v.toFixed(1)}`);
  if (name === "coming in") await shot("board-arriving");
}

// ── 3. Both faces ───────────────────────────────────────────────────────
await setClock(5);
await look(-24.6, -26.3, Math.PI / 2, 0.42);
await pump(page, 800);
await shot("board-close");
await look(-21.5, -26.3, Math.PI / 2, 0.16);
await pump(page, 800);
await shot("board-east");
await look(-33, -26.3, -Math.PI / 2, 0.16);
await pump(page, 800);
await shot("board-west");

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} FAILED` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
