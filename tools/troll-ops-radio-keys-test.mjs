// Troll Radio without the Esc menu (user, 2026-10-29), menu/radio.js:
//   1. M opens and shuts the radio on the menu; not while typing.
//   2. In a match, M opens it and frees the mouse with no pause menu;
//      M again puts it away and takes the mouse back; Esc still pauses.
// Offline: Supabase blocked, no bots, never a public room (pointer lock is
// faked under automation, assets/js/automation-pointer-lock.js).
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-radio-keys-test.mjs
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
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
await page.route(/^https:\/\/mayurski-art\.github\.io\/assets\/js\//, (r) => {
  const f = path.join(ROOT, "assets/js", path.basename(new URL(r.request().url()).pathname));
  return fs.existsSync(f) ? r.fulfill({ path: f, contentType: "text/javascript" }) : r.abort();
});
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2?.fn, null, { timeout: 180000 });
await sleep(800);
const st = () => page.evaluate(() => ({
  open: !document.getElementById("to-radio-panel").hidden,
  locked: window.__trollOps.controls?.isLocked ?? !!document.pointerLockElement,
  pause: !document.getElementById("to-pause")?.hidden,
  state: window.__trollOps.state(),
}));

// ---- 1. the menu
await page.mouse.click(5, 360);
await page.keyboard.press("m");
await sleep(200);
check((await st()).open, "menu: M opens the radio");
await page.keyboard.press("m");
await sleep(200);
check(!(await st()).open, "menu: M again shuts it");
const typed = await page.evaluate(() => {
  const i = document.createElement("input");
  document.body.append(i); i.focus();
  return true;
});
await page.keyboard.press("m");
await sleep(200);
check(typed && !(await st()).open, "typing an m in a box doesn't open it");
await page.evaluate(() => { document.activeElement?.blur(); document.querySelector("body > input:last-of-type")?.remove(); });

// ---- 2. a solo match (no network: Supabase is blocked)
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.mapId = "trollcity";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 180000 });
await sleep(3000);
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
await page.mouse.click(640, 360);
await sleep(600);
let s = await st();
check(s.locked && !s.pause, "match: the game has the mouse", JSON.stringify(s));
await page.keyboard.press("m");
await sleep(500);
s = await st();
check(s.open && !s.locked && !s.pause, "match: M opens the radio, frees the mouse, no pause menu", JSON.stringify(s));
await sleep(1300);   // (the browser's re-lock cooldown)
await page.keyboard.press("m");
await sleep(600);
s = await st();
check(!s.open && s.locked && !s.pause && s.state === "playing", "match: M again puts it away and takes the mouse back", JSON.stringify(s));
// a click on the game while it's open: away, and the mouse is the game's
await page.keyboard.press("m");
await sleep(1400);
await page.mouse.click(640, 200);
await sleep(600);
s = await st();
check(!s.open && s.locked && !s.pause, "match: a click on the game shuts it and takes the mouse", JSON.stringify(s));
// Esc still pauses as ever
await page.keyboard.press("Escape");
await page.evaluate(() => document.exitPointerLock?.());
await sleep(500);
s = await st();
check(s.pause && !s.open, "match: losing the mouse otherwise still opens the pause menu", JSON.stringify(s));

// ---- 3. home with a song on (user, 2026-10-29: "music should not pause
// when clicking on return to main menu"): the pause menu's and the game
// over screen's "Troll Warfare home" leave in the page, the song plays on
const song = () => page.evaluate(() => ({ playing: window.__trollOps.music.playing, paused: window.__trollOps.music.el.paused, t: window.__trollOps.music.el.currentTime, title: window.__trollOps.music.current?.title, state: window.__trollOps.state() }));
await page.evaluate(() => { window.__marker = 1; window.__trollOps.music.play(); });
await sleep(1500);
const before = await song();
await page.click("#to-exit-btn");
await sleep(1500);
let after = await song();
const stayed = await page.evaluate(() => window.__marker === 1);
check(before.playing && stayed && after.state === "menu" && after.playing && !after.paused && after.title === before.title && after.t > before.t,
  "pause menu home: back on the menu, same page, the song still going", JSON.stringify({ before, after, stayed }));
check(await page.evaluate(() => !document.getElementById("to-title").hidden && document.getElementById("to-pause").hidden && document.getElementById("to-hud").hidden), "pause menu home: the menu's up, the match's screens away");

await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 180000 });
await sleep(2500);
await page.evaluate(() => window.__trollOps.endMatch());
await page.waitForFunction(() => window.__trollOps.state() === "gameover", null, { timeout: 20000 }).catch(() => {});
await sleep(800);
const go = await song();
await page.click("#to-go-home-btn");
await sleep(1500);
after = await song();
check(go.state === "gameover" && go.playing && await page.evaluate(() => window.__marker === 1) && after.state === "menu" && after.playing && after.title === go.title,
  "game over home: back on the menu, same page, the song still going", JSON.stringify({ go, after }));
check(await page.evaluate(() => document.getElementById("to-gameover").hidden && !document.getElementById("to-title").hidden), "game over home: the game over screen's away");
// with nothing playing it reloads onto the menu as before
await page.evaluate(() => window.__trollOps.music.pause());
await page.evaluate(async () => { const T = window.__trollOps; T.setMode("tdm"); if (T.els.noBots) T.els.noBots.checked = true; await T.startGame(); });
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 180000 });
await sleep(2000);
await page.evaluate(() => window.__trollOps.openPauseMenu());
await Promise.all([page.waitForEvent("load", { timeout: 60000 }).catch(() => null), page.click("#to-exit-btn")]);
check(await page.evaluate(() => window.__marker !== 1), "radio off: home reloads as before");

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
