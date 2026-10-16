// The Pour up's after-effect (view/lean-trip.js): no trip before the sip, the
// purple wash and drifting faces after it, the view swaying, and it ends when
// you die. One headless tab in a private room (Supabase blocked).
//
// Usage: node tools/troll-ops-lean-trip-test.mjs   (SHOT=<png> saves a frame mid-trip)
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

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async (room) => {
  const T = window.__trollOps;
  T.composer && (T.composer.render = () => {});
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.els.room.value = room;
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
}, "LTR" + Math.floor(Math.random() * 90 + 10));
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 });
await sleep(1500);

const trip = () => page.evaluate(() => {
  const el = document.querySelector(".to-lean-trip");
  return { op: el ? +el.style.opacity || 0 : 0, faces: el ? el.querySelectorAll(".to-lean-trip-face").length : 0, emote: window.__trollOps.emote()?.t ?? null };
});
// Play the Pour up from the wheel.
await page.evaluate(() => {
  const T = window.__trollOps, W = T.emoteWheel;
  W.open();
  W.pick = W.slices.findIndex((b) => b.textContent.includes("Pour up"));
  W.close();
});
// (SwiftShader runs the game clock slow: skip the pour itself, up to just before the sip)
await page.waitForFunction(() => !!window.__trollOps.emote(), null, { timeout: 30000 });
await page.evaluate(() => { window.__trollOps.emote().t = 7.6; });
await sleep(300);
const before = await trip();
check("no trip before the sip", before.op === 0, JSON.stringify(before));
// After the sip (8 s in) and the fade-in.
await page.waitForFunction(() => +(document.querySelector(".to-lean-trip")?.style.opacity || 0) > 0.9, null, { timeout: 60000 });
const during = await trip();
check("the trip runs after the sip: purple wash on, faces drifting", during.op > 0.9 && during.faces > 0, JSON.stringify(during));
const rolls = [];
for (let i = 0; i < 6; i++) { rolls.push(await page.evaluate(() => window.__trollOps.camera?.rotation.z ?? null)); await sleep(400); }
// (the roll wraps at +-pi: compare each step's change)
const steps = rolls.slice(1).map((r, i) => Math.abs(Math.atan2(Math.sin(r - rolls[i]), Math.cos(r - rolls[i]))));
const spread = Math.max(...steps);
check("the view sways", rolls[0] !== null && spread > 0.004, rolls.map((r) => r?.toFixed(4)).join(" "));
if (process.env.SHOT) { await page.screenshot({ path: process.env.SHOT }); console.log("wrote", process.env.SHOT); }
// Dying ends it.
await page.evaluate(() => { window.__trollOps.player.alive = false; });
await sleep(800);
const dead = await trip();
check("dying ends it", dead.op === 0, JSON.stringify(dead));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} FAILED` : "ALL PASS");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
