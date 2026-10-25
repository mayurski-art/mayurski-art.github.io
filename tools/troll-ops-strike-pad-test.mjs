// Troll Forces: the Lightning Strike on a controller, and the cooldowns.
// D-pad right opens the tablet; the press that opened it must not count
// toward the hold that cancels it (user, 2026-10-25: "when u click right d
// pad it sort of autocancels"). A tap marks a target, a fresh hold cancels.
// Every streak dearer than the Lightning Strike has a 60 s cooldown, the SAM
// Turret's included (it had none).
//
// The pad is a stub on navigator.getGamepads, polled by hand
// (input/gamepad.js pollGamepad) with the streak control stepped alongside
// (streaks/calling.js updateStreakControl): the headless renderer runs about
// a frame a second, too slow to hold a button on its own clock.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-strike-pad-test.mjs

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
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
// the game's own copies of the two modules (the tags game.js imports them on)
const GAME_JS = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8");
const tagged = (rel) => "/assets/games/troll-ops/" + GAME_JS.split(`"./${rel}?v=`)[1].split('"')[0].replace(/^/, `${rel}?v=`);
const MODS = { pad: tagged("input/gamepad.js"), calling: tagged("streaks/calling.js") };

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
// a standard-mapping pad whose buttons the test sets (window.__pad)
await page.addInitScript(() => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  window.__pad = { index: 0, id: "test pad", mapping: "standard", connected: true, axes: [0, 0, 0, 0], buttons, timestamp: 0 };
  navigator.getGamepads = () => [window.__pad];
});
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.mapId = "culdegrin"; T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => { const s = window.__trollOps.loadState(); return window.__trollOps.state() === "playing" && !s.open && !s.hold; }, null, { timeout: 180000 });
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); T.breakSpawnGuard(); T.player.spawnGuard = 0; });

// The pad and the streak control, stepped by hand: `frames` frames of `dt`
// with d-pad right held (or not).
await page.evaluate(async (MODS) => {
  const P = await import(MODS.pad);
  const C = await import(MODS.calling);
  window.__step = (right, frames = 1, dt = 1 / 60) => {
    window.__pad.buttons[15].pressed = right; window.__pad.buttons[15].value = right ? 1 : 0;
    for (let i = 0; i < frames; i++) { P.pollGamepad(dt); C.updateStreakControl(dt); window.__trollOps.strikeTablet()?.update?.(dt); }
  };
  window.__game = (await import("/assets/games/troll-ops/core/state.js?v=st1")).game;
}, MODS);
const tablet = () => page.evaluate(() => { const t = window.__trollOps.strikeTablet(); return { open: !!t?.isOpen, targets: t?.targets?.length || 0, marking: window.__trollOps.markingStreak?.() ?? null }; });

// 1. Tap d-pad right with a Lightning Strike ready: the tablet comes up and
//    stays up long after the press (it used to cancel itself in 0.8 s).
await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("airstrike"); window.__game.selectedStreak = "airstrike"; });
await page.evaluate(() => { window.__step(true, 6); window.__step(false, 1); });
let t = await tablet();
check("d-pad right opens the strike tablet", t.open, JSON.stringify(t));
await page.evaluate(() => window.__step(false, 120));   // 2 s, hands off
t = await tablet();
check("the tablet stays up after the opening press (no auto-cancel)", t.open, JSON.stringify(t));

// 1b. The opening press held a full second: still no cancel.
await page.evaluate(() => { const T = window.__trollOps; T.strikeTablet()?.lower(); T.cancelMark?.(); T.streaks.grant("airstrike"); window.__game.selectedStreak = "airstrike"; });
await page.evaluate(() => { window.__step(false, 2); window.__step(true, 60); window.__step(false, 30); });
t = await tablet();
check("holding the opening press doesn't cancel it either", t.open, JSON.stringify(t));

// 2. A tap on the open tablet marks a target.
await page.evaluate(() => { window.__step(true, 4); window.__step(false, 2); });
t = await tablet();
check("a d-pad right tap on the tablet marks a target", t.open && t.targets === 1, JSON.stringify(t));

// 3. A fresh hold cancels it, and the strike stays banked.
await page.evaluate(() => { window.__step(true, 60); window.__step(false, 2); });
t = await tablet();
const banked = await page.evaluate(() => window.__trollOps.streaks.ready("airstrike"));
check("a fresh d-pad right hold cancels the tablet", !t.open, JSON.stringify(t));
check("a cancelled strike stays banked", banked);

// 4. Cooldowns: every streak dearer than the Lightning Strike has 60 s.
const cds = await page.evaluate(() => {
  const D = window.__trollOps.STREAK_DEFS || {};
  const strike = D.airstrike?.cost ?? 450;
  return Object.values(D).filter((d) => d.cost > strike).map((d) => [d.id, d.cooldown || 0]);
});
check("every streak past the Lightning Strike has a 60 s cooldown", cds.length > 0 && cds.every(([, c]) => c === 60), JSON.stringify(cds));

// 5. The SAM Turret locks after a call.
const sam = await page.evaluate(async () => {
  const T = window.__trollOps;
  T.streaks.grant("samturret");
  T.callStreak("samturret");
  await new Promise((r) => setTimeout(r, 300));
  T.streaks.grant("samturret");
  return { lock: T.streakLockLeft("samturret") };
});
check("the SAM Turret cools down for 60 s after a call", sam.lock > 55 && sam.lock <= 60, JSON.stringify(sam));

check("no page errors", !pageErrors.length, pageErrors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
