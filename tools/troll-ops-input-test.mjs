// Troll Forces input: a fake pad and a touch screen drive a real match, so
// every input path runs once (split phase 1 moved them to input/; the gate's
// matches never press a button, so a broken path there only showed up in a
// player's hands).
//   1. pad: left stick walks, right stick turns, then every button once
//   2. touch: move stick walks, look pad turns, then every on-screen button
//   3. aim assist: a target finder runs and returns a lock or nothing
//   4. no page errors anywhere
//
// Supabase is blocked: this never joins the live public room.
// Usage: node tools/troll-ops-input-test.mjs

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
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, hasTouch: true });
await ctx.route(/supabase/, (r) => r.abort());
await ctx.addInitScript(() => {
  const btns = () => Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const pad = { id: "Xbox Controller (STANDARD GAMEPAD)", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: btns(), timestamp: 1 };
  window.__pad = pad;
  Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => { pad.timestamp++; return [pad]; } });
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  await T.startGame();
  if (T.isStaging?.()) T.endStaging?.();
});
for (let t = Date.now(); Date.now() - t < 120000 && await page.evaluate(() => window.__trollOps.isStaging?.() || window.__trollOps.state() !== "playing");) await sleep(400);

const read = () => page.evaluate(() => {
  const T = window.__trollOps;
  if (!document.getElementById("to-pause").hidden) T.closePauseMenu();
  T.player.maxHp = T.player.hp = 1e9;
  return { x: T.move.pos.x, z: T.move.pos.z, yaw: T.look.yaw, state: T.state() };
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const yawDelta = (a, b) => Math.abs(Math.atan2(Math.sin(a.yaw - b.yaw), Math.cos(a.yaw - b.yaw)));
check("a match is running", (await read()).state === "playing");

// ---- 1. pad
const setPad = (o) => page.evaluate((o) => { const p = window.__pad; if (o.axes) p.axes = o.axes; if (o.btn != null) { p.buttons[o.btn].pressed = o.down; p.buttons[o.btn].value = o.down ? 1 : 0; } }, o);
await sleep(1500); // the pad's one-off rest calibration
// Forward, then back: a spawn facing a wall still walks one way.
let a, b, walked = 0;
for (const y of [-1, 1]) {
  a = await read();
  await setPad({ axes: [0, y, 0, 0] });
  await sleep(2000);
  b = await read();
  await setPad({ axes: [0, 0, 0, 0] });
  walked = Math.max(walked, dist(a, b));
}
check("pad: left stick walks", walked > 1, `${walked.toFixed(2)} m`);
a = await read();
await setPad({ axes: [0, 0, 1, 0] });
await sleep(1200);
b = await read();
await setPad({ axes: [0, 0, 0, 0] });
check("pad: right stick turns", yawDelta(a, b) > 0.3, `${yawDelta(a, b).toFixed(2)} rad`);
const before = errors.length;
// A B X Y LB RB LT RT Back Start L3 R3 Up Down Left Right
for (const btn of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
  await setPad({ btn, down: true });
  await sleep(250);
  await setPad({ btn, down: false });
  await sleep(250);
  await read();
}
check("pad: every button, no page errors", errors.length === before, errors.slice(before, before + 3).join(" | "));

// ---- 2. touch
const touch = (id, type, x = 0, y = 0, tid = 7) => page.evaluate(([id, type, x, y, tid]) => {
  const el = document.getElementById(id);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const t = new Touch({ identifier: tid, target: el, clientX: r.left + r.width / 2 + x, clientY: r.top + r.height / 2 + y });
  el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === "touchend" ? [] : [t], targetTouches: type === "touchend" ? [] : [t], changedTouches: [t] }));
  return true;
}, [id, type, x, y, tid]);
const ids = await page.evaluate(() => Object.fromEntries(Object.entries(window.__trollOps.els)
  .filter(([k, el]) => k.startsWith("touch") && el instanceof HTMLElement && el.id).map(([k, el]) => [k, el.id])));
check("touch: controls exist", !!ids.touchMove && !!ids.touchLook && !!ids.touchFire, Object.keys(ids).join(","));

a = await read();
await touch(ids.touchMove, "touchstart");
for (let i = 1; i <= 6; i++) { await touch(ids.touchMove, "touchmove", 0, -10 * i); await sleep(60); }
await sleep(1500);
b = await read();
await touch(ids.touchMove, "touchend", 0, -60);
check("touch: move stick walks", dist(a, b) > 0.5, `${dist(a, b).toFixed(2)} m`);

a = await read();
await touch(ids.touchLook, "touchstart", 0, 0, 8);
for (let i = 1; i <= 10; i++) { await touch(ids.touchLook, "touchmove", 12 * i, 0, 8); await sleep(30); }
await touch(ids.touchLook, "touchend", 120, 0, 8);
await sleep(300);
b = await read();
check("touch: look pad turns", yawDelta(a, b) > 0.05, `${yawDelta(a, b).toFixed(2)} rad`);

const before2 = errors.length;
for (const k of ["touchFire", "touchFireL", "touchAds", "touchJump", "touchSlide", "touchReload", "touchMelee", "touchNade",
  "touchTac", "touchInteract", "touchSwap", "touchAdmire", "touchEndStreak", "touchStreak", "touchEmote"]) {
  if (!ids[k]) continue;
  await touch(ids[k], "touchstart", 0, 0, 9);
  await sleep(200);
  await touch(ids[k], "touchend", 0, 0, 9);
  await sleep(200);
  await read();
}
await page.evaluate(() => { const T = window.__trollOps; if (T.emoteWheel.isOpen) T.emoteWheel.close(true); });
check("touch: every button, no page errors", errors.length === before2, errors.slice(before2, before2 + 3).join(" | "));

// ---- 3. aim assist
const aa = await page.evaluate(() => {
  const T = window.__trollOps;
  const pts = T.aimAssistPoints();
  const t = T.findAimAssistTarget();
  return { pts: pts.length, ok: t === null || typeof t === "object" };
});
check("aim assist: finds points and runs", aa.pts > 0 && aa.ok, `${aa.pts} points`);

await sleep(1000);
check("still playing, no page errors at all", (await read()).state === "playing" && errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
