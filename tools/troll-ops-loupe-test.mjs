// Troll Forces: no iOS magnifier on a held thumb (input/touch.js blockLoupe).
// A phone-sized touch tab, a SOLO range (no room code: never a public room),
// Supabase blocked. Safari's loupe can't be raised headless, so this checks
// what stops it: a touch on the look pad, the move zone, every button and
// the game canvas has its default cancelled, while the controls still work
// (a real tap reloads, a drag on the look pad turns the view, the stick
// moves) and typing fields can still select.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-loupe-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
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
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });

let fails = 0;
const check = (what, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };

const ctx = await browser.newContext({ ...devices["iPhone 13 landscape"], defaultBrowserType: undefined });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(m.text()); });
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.els.room.value = "";
  T.setMode("range");
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 180000 });
await page.waitForTimeout(1500);

check("the touch layer is up", await page.evaluate(() => !document.getElementById("to-touch").hidden));

// 1. the controls still work with real touches
const box = async (id) => (await page.locator(`#${id}`).boundingBox());
const reload = await page.evaluate(() => { const w = window.__trollOps.currentWeapon(); w.ammoInMag = 1; return w.def.magSize; });
const rb = await box("to-touch-reload");
await page.touchscreen.tap(rb.x + rb.width / 2, rb.y + rb.height / 2);
await page.waitForTimeout(150);
check("a tap on reload still reloads", await page.evaluate(() => window.__trollOps.currentWeapon().reloading));

const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
const lb = await box("to-touch-look");
// aim assist pulls the view back onto the range target ahead and can eat the drag
const yaw0 = await page.evaluate(() => { window.__trollOps.settings.aimAssist = false; return window.__trollOps.look.yaw; });
const lx = lb.x + lb.width * 0.5, ly = lb.y + lb.height * 0.5;
await touch("touchStart", [{ x: lx, y: ly, id: 1 }]);
for (let i = 1; i <= 8; i++) { await touch("touchMove", [{ x: lx - i * 12, y: ly, id: 1 }]); await page.waitForTimeout(16); }
// the look applies on the next frames; under a loaded gate those can lag, so wait for them
await page.waitForFunction((y0) => Math.abs(window.__trollOps.look.yaw - y0) > 0.05, yaw0, { timeout: 3000 }).catch(() => {});
await touch("touchEnd", []);
const yaw1 = await page.evaluate(() => { window.__trollOps.settings.aimAssist = true; return window.__trollOps.look.yaw; });
check("a drag on the look pad still turns the view", Math.abs(yaw1 - yaw0) > 0.05, `${yaw0.toFixed(3)} -> ${yaw1.toFixed(3)}`);

const mz = await box("to-touch-movezone");
const mx = mz.x + mz.width * 0.4, my = mz.y + mz.height * 0.6;
await touch("touchStart", [{ x: mx, y: my, id: 2 }]);
await touch("touchMove", [{ x: mx, y: my - 40, id: 2 }]);
await page.waitForTimeout(80);
const floating = await page.evaluate(() => document.getElementById("to-touch-move").classList.contains("is-active"));
await touch("touchEnd", []);
check("the move stick still follows the thumb", floating);

// 2. (last: it presses every button) a held touch's default is cancelled on every control and the canvas
const res = await page.evaluate(() => {
  const els = [...document.querySelectorAll("#to-touch > *")].filter((e) => !e.hidden && e.getBoundingClientRect().width > 0);
  els.push(document.querySelector("#to-cabinet > canvas"));
  return els.map((el) => {
    const r = el.getBoundingClientRect();
    const t = new Touch({ identifier: 99, target: el, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    const down = new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [t], targetTouches: [t], changedTouches: [t] });
    el.dispatchEvent(down);
    const move = new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [t], targetTouches: [t], changedTouches: [t] });
    el.dispatchEvent(move);
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [t] }));
    return { id: el.id || el.tagName, start: down.defaultPrevented, move: move.defaultPrevented };
  });
});
for (const r of res) check(`${r.id}: a held touch can't raise the loupe`, r.start && r.move, JSON.stringify(r));
const sel = await page.evaluate(() => {
  const ev = new Event("selectstart", { bubbles: true, cancelable: true });
  document.querySelector("#to-touch-look").dispatchEvent(ev);
  const inp = document.createElement("input"); document.body.appendChild(inp);
  const ev2 = new Event("selectstart", { bubbles: true, cancelable: true });
  inp.dispatchEvent(ev2); inp.remove();
  return { game: ev.defaultPrevented, input: ev2.defaultPrevented };
});
check("text selection can't start on the game, a typing field still selects", sel.game && !sel.input, JSON.stringify(sel));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await ctx.close();
await browser.close();
server.close();
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
