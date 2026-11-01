// The Play page's podiums can't be spun (user, 2026-10-31: "lock the moving
// of the standing podium thing. i notice users can swirl it around"). On
// the Play page a drag, a wheel and a double-click leave the stage's camera
// square on; in the Locker the operator still turns with a drag. Desktop and
// a phone. Supabase blocked, no room.
//
//   node tools/troll-ops-stage-lock-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
for (const [name, vp, more] of [["desktop", { width: 1365, height: 632 }, {}], ["phone", { width: 390, height: 844 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
  const ctx = await browser.newContext({ viewport: vp, ...more });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1&season=off`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__toBo2?.fn && !!window.__trollOps?.charInspector, null, { timeout: 180000 });
  await sleep(800);
  // drags and wheels the canvas through real pointer events, where it is
  const poke = () => page.evaluate(async () => {
    const C = window.__trollOps.charInspector, cv = C.canvas, r = cv.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const ev = (type, dx, dy) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, clientX: x + dx, clientY: y + dy, isPrimary: true }));
    const before = { yaw: C.yaw, pitch: C.pitch, zoom: C.zoomTarget };
    ev("pointerdown", 0, 0); for (let i = 1; i <= 8; i++) ev("pointermove", i * 25, i * 6); ev("pointerup", 200, 48);
    cv.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 400, clientX: x, clientY: y }));
    const after = { yaw: C.yaw, pitch: C.pitch, zoom: C.zoomTarget };
    return { stage: C.stage, before, after, moved: Math.abs(after.yaw - before.yaw) > 0.01 || Math.abs(after.pitch - before.pitch) > 0.01 || Math.abs(after.zoom - before.zoom) > 0.01 };
  });
  await page.evaluate(() => window.__toBo2.menu.backTo("main"));
  await sleep(400);
  const play = await poke();
  check(play.stage && !play.moved, `${name}: on the Play page the podiums don't turn, tilt or zoom`, JSON.stringify(play));
  await page.evaluate(() => document.querySelector('.to-fn-tab[data-tab="locker"]').click());
  await sleep(600);
  const locker = await poke();
  check(!locker.stage && locker.moved, `${name}: in the Locker your operator still turns`, JSON.stringify(locker));
  await page.evaluate(() => document.querySelector('.to-fn-tab[data-tab="play"]').click());
  await sleep(600);
  const back = await page.evaluate(() => { const C = window.__trollOps.charInspector; return { stage: C.stage, yaw: C.yaw, pitch: C.pitch, zoom: C.zoomTarget }; });
  check(back.stage && Math.abs(back.zoom - 1) < 1e-6, `${name}: back on Play, the stage is square on again`, JSON.stringify(back));
  check(!errors.length, `${name}: no page errors`, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "STAGE LOCK GREEN");
process.exit(fails ? 1 : 0);
