// Controller drift (user, 2026-10-03: "I auto sway to the left").
//
// Fake pads via navigator.getGamepads: a phantom non-standard device resting
// at full left (index 0) and a real standard pad (index 1). Solo match on
// Grin Site, Low graphics; the stick is moved by the test.
//   1. at load the real stick reads centred (so the one-off calibration
//      learns nothing), then settles at -0.25 with a little jitter: any
//      drift must stop within a couple of seconds and stay stopped;
//   2. a full push still walks the player;
//   3. a wobbly half push (a thumb, not a resting stick) keeps walking.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-pad-drift-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 320, height: 200 } });
await ctx.route(/supabase/, (r) => r.abort());
await ctx.addInitScript(() => {
  try { localStorage.setItem("trollops:gfx-auto", "low"); } catch {}
  const btns = () => Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const phantom = { id: "Phantom HID", index: 0, connected: true, mapping: "", axes: [-1, 0, 0, 0], buttons: btns(), timestamp: 1 };
  const real = { id: "Xbox Controller (STANDARD GAMEPAD)", index: 1, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: btns(), timestamp: 1 };
  // `base` + jitter each read, like a real stick's noise.
  const stick = { x: 0, y: 0, jitter: 0 };
  window.__stick = stick;
  Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => {
    real.axes[0] = stick.x + (Math.random() - 0.5) * stick.jitter;
    real.axes[1] = stick.y + (Math.random() - 0.5) * stick.jitter;
    return [phantom, real];
  } });
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.evaluate(() => { const T = window.__trollOps; T.setMode("ops"); T.loadout.versusMapId = "grinsite"; T.startGame(); });
for (let t = Date.now(); Date.now() - t < 600000 && await page.evaluate(() => window.__trollOps.loadState().open);) await sleep(500);

// Keep the pause screen shut (headless never gets pointer lock) and read the player.
const read = () => page.evaluate(() => {
  const T = window.__trollOps;
  if (!document.getElementById("to-pause").hidden) T.closePauseMenu();
  return { x: T.move.pos.x, z: T.move.pos.z, mx: T.gamepadState.moveX, staging: T.loadState().staging };
});
for (let t = Date.now(); Date.now() - t < 300000 && (await read()).staging;) await sleep(300);

// 1. Drift appears after the one-off calibration.
await page.evaluate(() => Object.assign(window.__stick, { x: -0.25, y: 0.02, jitter: 0.01 }));
let r = await read();
const start = r.x;
const samples = [];
for (let i = 0; i < 16; i++) { await sleep(700); r = await read(); samples.push([+r.x.toFixed(3), +r.mx.toFixed(3)]); }
const tail = samples.slice(-6);
const stillAtEnd = Math.abs(tail[tail.length - 1][0] - tail[0][0]) < 0.02 && tail.every(([, mx]) => mx === 0);
check("resting drift stops on its own", stillAtEnd, `x ${start.toFixed(2)} -> ${r.x.toFixed(2)}, last moveX ${tail.map((s) => s[1]).join(",")}`);

// 2. A full push still walks.
await page.evaluate(() => Object.assign(window.__stick, { x: -0.95, y: 0, jitter: 0.01 }));
const p0 = (await read()).x;
await sleep(2500);
const p1 = await read();
check("a full push walks the player", p1.x < p0 - 0.5 && p1.mx < -0.5, `x ${p0.toFixed(2)} -> ${p1.x.toFixed(2)}, moveX ${p1.mx.toFixed(2)}`);

// 3. A thumb's wobbly half push keeps walking (never mistaken for rest).
await page.evaluate(() => Object.assign(window.__stick, { x: 0, y: 0, jitter: 0 }));
await sleep(500);
const q0 = await read();
await page.evaluate(() => Object.assign(window.__stick, { x: 0.27, y: -0.04, jitter: 0.08 }));
let moving = 0;
for (let i = 0; i < 8; i++) { await sleep(600); if ((await read()).mx > 0) moving++; }
const q1 = await read();
check("a wobbly half push keeps walking", moving >= 6 && q1.x > q0.x + 0.2, `moving ${moving}/8, x ${q0.x.toFixed(2)} -> ${q1.x.toFixed(2)}`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
