// Troll Forces Zombie Rush on a controller (P7, user 2026-10-13: "detect if
// a controller is connected and based off that use the dpad controls"). One
// headless tab with a stand-in pad, a SOLO run (no room code: never a public
// room), Supabase blocked.
//   1. Pad connected: the cards' number badges give way to a d-pad prompt.
//   2. D-pad down walks the highlight; d-pad up on Health buys it.
//   3. Down to the turret, up: placing; R2 puts it down (and doesn't shoot).
//   4. A number key on the keyboard brings the numbers back.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zpad-test.mjs
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
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(m.text()); });
await page.addInitScript(() => {
  window.__padBtn = new Array(17).fill(false);
  navigator.getGamepads = () => [{ index: 0, id: "Stand-in pad", connected: true, mapping: "standard", axes: [0, 0, 0, 0], timestamp: performance.now(),
    buttons: window.__padBtn.map((p) => ({ pressed: p, touched: p, value: p ? 1 : 0 })) }];
});
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.els.room.value = "";
  T.setMode("zombies");
  T.loadout.poolMapId = "pentagrin";
  await T.startGame();
  if (T.isStaging?.()) T.endStaging();
});
await page.waitForFunction(() => window.__trollOps.zdir()?.zombies.some((z) => z.alive), null, { timeout: 180000 });
await page.evaluate(() => { const T = window.__trollOps; T.player.hp = T.player.maxHp = 100; for (const z of T.zdir().zombies) z.stunT = 999; T.zrun().giveCash(1e6); window.dispatchEvent(new Event("gamepadconnected")); });
const wait = (ms) => page.waitForTimeout(ms);
const tap = async (i, ms = 120) => { await page.evaluate((i) => { window.__padBtn[i] = true; }, i); await wait(ms); await page.evaluate((i) => { window.__padBtn[i] = false; }, i); await wait(120); };
const hud = () => page.evaluate(() => {
  const keys = [...document.querySelectorAll("#to-zh .zh-card .zh-key")].map((k) => k.textContent);
  const G = window.__trollOps.zrun();
  return { pad: document.querySelector("#to-zh").classList.contains("is-pad"), keys, sel: document.querySelector("#to-zh .zh-card.is-sel")?.className || null,
    hpBuys: G.upgrades.hpBuys, placing: !!G.dep.placing, turrets: G.dep.list.filter((e) => e.id === "turret").length, shots: window.__trollOps.player.shotsFired ?? null,
    ammo: window.__trollOps.currentWeapon().ammoInMag };
});
await wait(600);
let s = await hud();
check(s.pad && s.keys.filter((k) => k === "\u25B2").length === 1 && !s.keys.some((k) => /^[4-9]$/.test(k)), "a pad connected: one d-pad prompt, no number keys", JSON.stringify(s));
check(/zh-card-hp/.test(s.sel || ""), "the highlight starts on Health", s.sel);
await tap(12);
s = await hud();
check(s.hpBuys === 1, "d-pad up buys Health", JSON.stringify(s));
await tap(13);
s = await hud();
check(/zh-card-gun/.test(s.sel || ""), "d-pad down walks to the gun", s.sel);
await tap(13); await tap(13);
s = await hud();
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
check(/zh-card-turret/.test(s.sel || ""), "two more: the turret", s.sel);
await tap(12);
s = await hud();
check(s.placing, "d-pad up on the turret: placing it", JSON.stringify(s));
const ammo0 = s.ammo;
await page.evaluate(() => { const T = window.__trollOps; T.look.pitch = -0.5; });
await tap(7, 250);
s = await hud();
check(!s.placing && s.turrets === 1, "R2 puts it down", JSON.stringify(s));
check(s.ammo === ammo0, "...without firing a shot", `${ammo0} -> ${s.ammo}`);
await page.keyboard.press("Digit5");
await wait(200);
s = await hud();
check(!s.pad && s.keys.includes("4") && s.keys.includes("7"), "a number key brings the numbers back", JSON.stringify(s.keys));
check(!errors.length, "no page errors", errors.slice(0, 4).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
