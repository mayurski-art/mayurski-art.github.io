// Troll Royale's Plates and Hopium chips show their keys on the device in
// use (user: "if a controller is connected then the controller keys should
// show on the screen. if only desktop keyboard is being used then those keys
// should be seen"), and a pad can use them: d-pad up a plate, down Hopium.
//
// One Royale match in a private room (Supabase blocked, no plane drop):
//   1. keyboard: the chips read 4 / 5, and 4 starts plating up
//   2. a pad plugged in (a stubbed navigator.getGamepads): the chips read
//      ↑ / ↓, d-pad up starts plating up, d-pad down takes Hopium
//   3. unplugged: back to 4 / 5
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-gear-keys-test.mjs
// SHOTS=<dir> saves the chips' corner on the keyboard and on the pad.

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// A pad the test can plug in and press: window.__pad.on, window.__pad.down[i].
await page.addInitScript(() => {
  const pad = { on: false, down: {} };
  window.__pad = pad;
  const real = navigator.getGamepads?.bind(navigator);
  navigator.getGamepads = () => {
    if (!pad.on) return real ? real() : [];
    const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: !!pad.down[i], touched: !!pad.down[i], value: pad.down[i] ? 1 : 0 }));
    return [{ id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)", index: 0, connected: true, mapping: "standard", timestamp: performance.now(), axes: [0, 0, 0, 0], buttons }];
  };
});
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.DROP.enabled = false;
  T.setMode("royale");
  T.els.noBots.checked = true;
  // a private room, never the public one
  T.els.room.value = "GK" + Math.random().toString(36).slice(2, 5).toUpperCase();
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
  if (T.isStaging()) T.endStaging();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
await page.waitForFunction(() => !window.__trollOps.isStaging(), null, { timeout: 30000 });
await sleep(1500);

const caps = () => page.evaluate(() => ["to-gear-plates", "to-gear-heals"].map((id) => {
  const b = document.getElementById(id)?.querySelector("b");
  return b && !b.hidden && b.offsetParent !== null ? b.textContent : null;
}));
// Stock up and get hurt so both can be used; clear any act in progress.
const prime = () => page.evaluate(() => {
  const T = window.__trollOps, P = T.player;
  T.royale().act = null;
  P.plates = 2; P.heals = 2; P.armor = 0; P.hp = Math.min(P.hp, 40);
});
const act = () => page.evaluate(() => window.__trollOps.royale().act?.kind || null);

let c = await caps();
if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, "keys.png"), clip: { x: 0, y: 380, width: 420, height: 160 } });
check("keyboard: the chips read 4 / 5", c[0] === "4" && c[1] === "5", JSON.stringify(c));
await prime();
await page.keyboard.press("Digit4");
await sleep(150);
check("...and 4 starts plating up", (await act()) === "plate");

await page.evaluate(() => { window.__pad.on = true; });
await sleep(600);
c = await caps();
if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, "pad.png"), clip: { x: 0, y: 380, width: 420, height: 160 } });
check("a pad plugged in: the chips read ↑ / ↓", c[0] === "↑" && c[1] === "↓", JSON.stringify(c));
await prime();
const tap = async (i) => { await page.evaluate((i) => { window.__pad.down[i] = true; }, i); await sleep(150); await page.evaluate((i) => { window.__pad.down[i] = false; }, i); await sleep(150); };
await tap(12);
check("d-pad up starts plating up", (await act()) === "plate");
await prime();
await tap(13);
check("d-pad down takes Hopium", (await act()) === "heal");

await page.evaluate(() => { window.__pad.on = false; });
await sleep(600);
c = await caps();
check("unplugged: back to 4 / 5", c[0] === "4" && c[1] === "5", JSON.stringify(c));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
