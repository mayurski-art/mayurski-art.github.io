// Troll Forces arrow keys: Up/Down/Left/Right walk exactly like W/S/A/D.
//   1. each WASD key and its arrow, held from the same spot and facing,
//      move the troll the same way (direction and distance)
//   2. no page errors
//
// Supabase is blocked: this never joins the live public room.
// Usage: node tools/troll-ops-arrow-keys-test.mjs

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

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.els.room.value = "";
  T.setMode("range");   // the Range: no bots wandering into the walk
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 180000 });
await sleep(1500);
check("a match is running", await page.evaluate(() => window.__trollOps.state() === "playing"));

// Same spot, same facing, before every press.
const home = await page.evaluate(() => { const p = window.__trollOps.move.pos; return { x: p.x, y: p.y, z: p.z, yaw: window.__trollOps.look.yaw }; });
const reset = () => page.evaluate((h) => {
  const T = window.__trollOps;
  if (!document.getElementById("to-pause").hidden) T.closePauseMenu();
  T.player.maxHp = T.player.hp = 1e9;
  T.move.pos.set(h.x, h.y, h.z);
  T.move.velocity.set(0, 0, 0);
  T.look.yaw = h.yaw;
}, home);
const stepWith = async (code) => {
  await reset();
  await sleep(300);
  const a = await page.evaluate(() => ({ x: window.__trollOps.move.pos.x, z: window.__trollOps.move.pos.z }));
  await page.keyboard.down(code);
  await sleep(700);
  const b = await page.evaluate(() => ({ x: window.__trollOps.move.pos.x, z: window.__trollOps.move.pos.z }));
  await page.keyboard.up(code);
  await sleep(300);
  return { x: b.x - a.x, z: b.z - a.z };
};

for (const [wasd, arrow] of [["KeyW", "ArrowUp"], ["KeyS", "ArrowDown"], ["KeyA", "ArrowLeft"], ["KeyD", "ArrowRight"]]) {
  const k = await stepWith(wasd);
  const r = await stepWith(arrow);
  const lk = Math.hypot(k.x, k.z), lr = Math.hypot(r.x, r.z);
  const cos = lk && lr ? (k.x * r.x + k.z * r.z) / (lk * lr) : 0;
  check(`${arrow} walks like ${wasd}`, lk > 0.5 && lr > 0.5 && cos > 0.95 && Math.abs(lk - lr) / lk < 0.3,
    `${wasd} ${lk.toFixed(2)}m, ${arrow} ${lr.toFixed(2)}m, cos ${cos.toFixed(3)}`);
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
