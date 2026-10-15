// Troll Forces: free look in third person (view/free-look.js; user,
// 2026-10-15: "when users are in third person POV they should be able to
// see the front of their character as well, across all devices"). Test
// Range, offline:
//   - hold Alt and turn half round: the camera is in front of your troll,
//     looking at it, and your aim (game.look) hasn't moved;
//   - let go: the camera comes back behind you;
//   - the touch eye shows in third person only and toggles it;
//   - the pad's Select: a tap still switches the view, a hold is free look.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-free-look-test.mjs
//   SHOTS_DIR=<dir> for the screenshots
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// a fake pad, its buttons set by the test (window.__pad)
await page.addInitScript(() => {
  window.__pad = null;
  const real = navigator.getGamepads?.bind(navigator);
  navigator.getGamepads = () => (window.__pad ? [window.__pad] : real ? real() : []);
});
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  if (!window.TrollrunnerAccounts) window.TrollrunnerAccounts = {};
  const T = window.__trollOps;
  T.setMode("range");
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
await page.waitForTimeout(1500);

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const G = "/assets/games/troll-ops/core/state.js?v=st1";
// third person on
await page.evaluate(async (G) => { const { game } = await import(G); if (!game.settings.thirdPerson) window.__trollOps.toggleThirdPerson(); }, G);
await page.waitForTimeout(600);
// where the camera is round the body: its angle from straight behind
// (0 behind, PI in front), and how squarely it looks at the body
const where = () => page.evaluate(async (G) => {
  const { game } = await import(G);
  const c = game.camera.position, p = game.player.pos, yaw = game.look.yaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);   // the aim's forward
  const dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz) || 1;
  const front = (dx * fx + dz * fz) / d;           // 1: straight in front of you
  const look = game.camera.getWorldDirection(c.clone());
  const tx = p.x - c.x, ty = p.y - 0.3 - c.y, tz = p.z - c.z, tl = Math.hypot(tx, ty, tz) || 1;
  return { yaw: +yaw.toFixed(4), pitch: +game.look.pitch.toFixed(4), front: +front.toFixed(3), atBody: +((look.x * tx + look.y * ty + look.z * tz) / tl).toFixed(3), head: game.localRig.parts.head.visible };
}, G);
const before = await where();
check(before.front < -0.5, "third person: the camera starts behind you", JSON.stringify(before));

// hold Alt and turn half round, the way the mouse would (look.yaw moves)
await page.keyboard.down("Alt");
for (let i = 0; i < 30; i++) {
  await page.evaluate(async (G) => { const { game } = await import(G); game.look.yaw += Math.PI / 30; }, G);
  await page.waitForTimeout(30);
}
await page.waitForTimeout(700);
const held = await where();
check(Math.abs(held.yaw - before.yaw) < 1e-3, "your aim stays put while you look round", `${before.yaw} -> ${held.yaw}`);
check(held.front > 0.8 && held.atBody > 0.9, "Alt held, turned half round: the camera is in front of you, looking at you", JSON.stringify(held));
check(held.head, "your face is shown, not ghosted");
await page.screenshot({ path: path.join(SHOTS, "free-look-front.png") });
await page.keyboard.up("Alt");
await page.waitForTimeout(1200);
const back = await where();
check(back.front < -0.5 && Math.abs(back.yaw - before.yaw) < 1e-3, "let go: back behind you, aim unchanged", JSON.stringify(back));

// the touch eye: third person only
const eye = () => page.evaluate(() => { const e = document.getElementById("to-touch-free"); return { hidden: e.hidden, pressed: e.getAttribute("aria-pressed") }; });
check((await eye()).hidden === false, "the touch eye shows in third person");
await page.evaluate(() => window.__trollOps.toggleThirdPerson());
check((await eye()).hidden === true, "...and not in first person");
await page.evaluate(() => window.__trollOps.toggleThirdPerson());
// tap it (a synthetic touchstart), turn, tap again
await page.evaluate(() => { const e = document.getElementById("to-touch-free"); e.dispatchEvent(new Event("touchstart", { cancelable: true })); });
check((await eye()).pressed === "true", "tapping the eye turns it on");
for (let i = 0; i < 30; i++) {
  await page.evaluate(async (G) => { const { game } = await import(G); game.look.yaw -= Math.PI / 30; }, G);
  await page.waitForTimeout(30);
}
await page.waitForTimeout(700);
const touchHeld = await where();
check(touchHeld.front > 0.8, "touch free look: round to your front", JSON.stringify(touchHeld));
await page.evaluate(() => { const e = document.getElementById("to-touch-free"); e.dispatchEvent(new Event("touchstart", { cancelable: true })); });
check((await eye()).pressed === "false", "tapping it again turns it off");
await page.waitForTimeout(1200);

// the pad's Select: a tap switches the view, a hold is free look
const pad = (select) => page.evaluate((select) => {
  const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: i === 8 && select, value: i === 8 && select ? 1 : 0 }));
  window.__pad = { id: "test pad", index: 0, connected: true, mapping: "standard", timestamp: performance.now(), axes: [0, 0, 0, 0], buttons };
}, select);
const tp = () => page.evaluate(async (G) => (await import(G)).game.settings.thirdPerson, G);
await pad(false); await page.waitForTimeout(300);
const tp0 = await tp();
await pad(true); await page.waitForTimeout(90); await pad(false); await page.waitForTimeout(300);
check((await tp()) === !tp0, "pad: a tap of Select switches 1P / 3P", `${tp0} -> ${await tp()}`);
if (!(await tp())) { await pad(true); await page.waitForTimeout(90); await pad(false); await page.waitForTimeout(300); }
await pad(true); await page.waitForTimeout(500);
const padOn = await page.evaluate(async () => (await import("/assets/games/troll-ops/view/free-look.js?v=nf1")).freeLook.held);
await pad(false); await page.waitForTimeout(300);
const padAfter = await page.evaluate(async () => (await import("/assets/games/troll-ops/view/free-look.js?v=nf1")).freeLook.held);
check(padOn && !padAfter && (await tp()), "pad: holding Select is free look, still third person after", JSON.stringify({ padOn, padAfter }));

check(errors.length === 0, "no page errors", errors.join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
