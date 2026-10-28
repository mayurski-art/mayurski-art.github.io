// Troll Warfare's lobby, phase 6: a controller in the lobby (lobby-fn.js).
// Offline: Supabase is blocked; a fake standard pad (as troll-ops-bo2pad-
// test); nothing starts a match (PLAY only opens the playlist's screen).
//   1. With a pad in, its hints show (LB / RB by the tabs, A on PLAY, X on
//      Change mode); gone again with it.
//   2. RB / LB walk the tabs both ways and wrap.
//   3. Play: X opens Change mode, the d-pad moves through it, B closes it;
//      down opens All modes, right moves along the tiles, A picks one.
//   4. A list (Locker): down moves the highlight, A opens it, B comes back.
//   5. A on Play is PLAY: the playlist's screen; B comes back to Play.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-fn-pad-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, ".claude/run");
fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const btns = () => Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const pad = { id: "Xbox Wireless Controller (STANDARD GAMEPAD)", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: btns(), timestamp: 1 };
  window.__pad = pad;
  window.__padIn = true;
  Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => { pad.timestamp++; return window.__padIn ? [pad] : []; } });
});
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__toBo2?.fn, null, { timeout: 180000 });
await page.waitForTimeout(2000);

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const B = { A: 0, B: 1, X: 2, LB: 4, RB: 5, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const press = async (name) => {
  await page.evaluate((i) => { const b = window.__pad.buttons[i]; b.pressed = true; b.value = 1; }, B[name]);
  await page.waitForTimeout(200);
  await page.evaluate((i) => { const b = window.__pad.buttons[i]; b.pressed = false; b.value = 0; }, B[name]);
  await page.waitForTimeout(160);
};
const state = () => page.evaluate(() => ({
  screen: window.__toBo2.menu.current(),
  tab: document.querySelector(".to-fn-tab.is-on")?.dataset.tab,
  hot: window.__toBo2.menu.hot?.()?.id || null,
  picker: !document.querySelector(".to-fn-picker").hidden,
  modes: !document.querySelector(".to-fn-modes").hidden,
  focus: document.activeElement?.dataset.tile || document.activeElement?.dataset.pl || document.activeElement?.dataset.id || document.activeElement?.className || "",
  playlist: window.__toBo2.fn.playlist(),
}));
const hints = () => page.evaluate(() => [...document.querySelectorAll(".to-fn-padkey")].filter((e) => e.offsetParent).map((e) => e.textContent));

// 1. hints
let h = await hints();
check(["LB", "RB", "A", "X"].every((k) => h.includes(k)), "a pad in: LB / RB, A on PLAY, X on Change mode", h.join());
await page.screenshot({ path: path.join(SHOTS, "pad-play.png") });

// 2. tabs
const tabs = [];
for (let i = 0; i < 6; i++) { await press("RB"); tabs.push((await state()).tab); }
check(tabs.join() === "locker,career,compete,quests,options,play", "RB walks the tabs and wraps", tabs.join());
await press("LB");
check((await state()).tab === "options", "LB goes back one (and wraps)", (await state()).tab);
await press("RB");
check((await state()).screen === "main", "back on Play");

// 3. Play: the picker and the tiles
await press("X");
let s = await state();
check(s.picker && /^(public|social|solo|zombies|private)$/.test(s.focus), "X opens Change mode, focused", JSON.stringify(s));
const f0 = s.focus;
await press("DOWN");
s = await state();
check(s.focus !== f0, "the d-pad moves through it", JSON.stringify({ from: f0, to: s.focus }));
await press("B");
check(!(await state()).picker, "B closes it");
await press("DOWN");
s = await state();
check(s.modes && !!s.focus, "down opens All modes, a tile focused", JSON.stringify(s));
const t0 = s.focus;
await press("RIGHT");
s = await state();
check(s.focus !== t0, "right moves along the tiles", JSON.stringify({ from: t0, to: s.focus }));
const picked = s.focus;
await press("A");
s = await state();
const want = { royale: "public", public: "public", zombies: "zombies", social: "social", solo: "solo", private: "private" }[picked];
check(!s.modes && s.playlist === want, "A picks it: the tiles close, the mode card on it", JSON.stringify({ picked, ...s }));

// 4. a list
await press("RB");
s = await state();
check(s.screen === "locker", "RB to the Locker", s.screen);
const hot0 = s.hot;
await press("DOWN");
s = await state();
check(s.hot && s.hot !== hot0, "down moves the highlight", JSON.stringify({ from: hot0, to: s.hot }));
await press("A");
const opened = (await state()).screen;
check(opened !== "locker", "A opens it", opened);
await press("B");
check((await state()).screen === "class", "B steps back (Primary went through the class)", (await state()).screen);
await press("B");
check((await state()).screen === "locker", "and B again comes home to the Locker", (await state()).screen);
await page.screenshot({ path: path.join(SHOTS, "pad-locker.png") });

// 5. PLAY
await press("LB");
check((await state()).screen === "main", "LB back to Play");
await press("A");
s = await state();
check(s.screen === s.playlist && await page.evaluate(() => window.__trollOps.state()) === "menu", "A on Play is PLAY: the playlist's screen, no match", JSON.stringify(s));
await press("B");
check((await state()).screen === "main", "B back to Play");

// the pad out: the hints go
await page.evaluate(() => { window.__padIn = false; });
await page.waitForTimeout(300);
await page.waitForTimeout(200);
h = await hints();
check(h.length === 0, "pad out: no hints", h.join());

check(errors.length === 0, "no page errors", errors.join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
