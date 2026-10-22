// Troll Forces main-menu operator (char-inspector.js): screenshots of the
// menu at rest, zoomed in and out, with the TROLLS body on and off, plus a
// close-up of the arms on the gun. Headless page screenshots miss the
// operator's WebGL canvas, so its frame is laid over it as an image first.
// Prints where the Emote pill is and whether the operator's drawn pixels
// touch an edge of its box that isn't the screen's (a cut mid-screen).
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-menu-char-shot.mjs
//   SHOTS_DIR=<dir>; W/H for the viewport (default 1366x634); PHONE=1;
//   TOKEN=<TROLLS token> the body worn (default 1718); CLICK=<menu item> opens
//   that screen first (CLICK=Cosmetics)
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const W = +process.env.W || 1366, H = +process.env.H || 634;
const ctx = await browser.newContext(process.env.PHONE
  ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
  : { viewport: { width: W, height: H } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.waitForTimeout(2500);
const tag = (process.env.PHONE ? "-phone" : `-${W}x${H}`) + (process.env.CLICK ? `-${process.env.CLICK.toLowerCase()}` : "");
if (process.env.CLICK) {
  await page.locator(".to-bo2-menu .tr-menu-item", { hasText: new RegExp(`^\s*${process.env.CLICK}`, "i") }).first().click();
  await page.waitForTimeout(800);
}

/* The TROLLS body on or off the menu operator, through the lobby's own
   blocky-body module (same URL, same instance). */
// (wearBlocky takes a token number: true is no token, the stick stays on)
const TOKEN = +(process.env.TOKEN || 1718);
const setBody = (on) => page.evaluate(async (token) => {
  const src = await (await fetch("/assets/games/troll-ops/game.js")).text();
  const url = "/assets/games/troll-ops/" + src.match(/\.\/(menu\/lobby\.js\?v=[^"]+)/)[1];
  const lsrc = await (await fetch(url)).text();
  const B = await import(new URL(lsrc.match(/"(\.\.\/characters\/blocky-body\.js\?v=[^"]+)"/)[1], location.origin + url).href);
  const t0 = performance.now();
  await B.wearBlocky(window.__trollOps.charInspector.humanoid, token);
  return Math.round(performance.now() - t0);
}, on ? TOKEN : 0);

/* Draw a frame, lay it over the canvas, and measure the drawn pixels. */
const frame = () => page.evaluate(() => {
  const ci = window.__trollOps.charInspector;
  ci.tick(0.016);
  const cv = ci.canvas, r = cv.getBoundingClientRect();
  const c = document.createElement("canvas");
  c.width = cv.width; c.height = cv.height;
  const g = c.getContext("2d");
  g.drawImage(cv, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[(y * c.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  let img = document.getElementById("__charshot");
  if (!img) {
    img = document.createElement("img");
    img.id = "__charshot";
    img.style.cssText = "position:fixed;pointer-events:none;z-index:2";
    document.body.appendChild(img);
  }
  img.src = cv.toDataURL();
  Object.assign(img.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  const k = r.width / c.width;
  const body = [r.left + x0 * k, r.top + y0 * k, r.left + x1 * k, r.top + y1 * k].map(Math.round);
  const em = document.getElementById("to-char-emote")?.getBoundingClientRect();
  const vw = innerWidth, vh = innerHeight;
  // touching a box edge that isn't the screen's own edge = cut mid-screen
  const cut = [];
  if (y0 <= 0 && r.top > 1) cut.push("top");
  if (y1 >= c.height - 1 && r.bottom < vh - 1) cut.push("bottom");
  if (x0 <= 0 && r.left > 1) cut.push("left");
  if (x1 >= c.width - 1 && r.right < vw - 1) cut.push("right");
  return {
    box: [r.left, r.top, r.right, r.bottom].map(Math.round), body,
    emote: em ? [em.left, em.top, em.right, em.bottom].map(Math.round) : null,
    feetOverPill: em ? body[3] > em.top && body[0] < em.right && body[2] > em.left : false,
    cut,
  };
});

for (const on of [true, false]) {
  const ms = await setBody(on);
  if (on) console.log(`TROLLS #${TOKEN} on in ${ms} ms`);
  for (const z of [1, 0.5, 2.2]) {
    await page.evaluate((z) => { const ci = window.__trollOps.charInspector; ci.setZoom(z); ci.zoom = ci.zoomTarget; }, z);
    await page.waitForTimeout(300);
    const m = await frame();
    console.log(`${on ? "TROLLS" : "stick "} zoom ${z}: box ${m.box} body ${m.body} emote ${m.emote} feetOverPill ${m.feetOverPill} cut [${m.cut}]`);
    await page.screenshot({ path: path.join(SHOTS, `menuchar-${on ? "nft" : "stick"}-z${z}${tag}.png`) });
  }
}
// close up on the arms and the gun
await setBody(true);
await page.evaluate(() => { const ci = window.__trollOps.charInspector; ci.setZoom(0.5); ci.zoom = 0.5; });
await page.waitForTimeout(300);
const m = await frame();
const [x0, y0, x1, y1] = m.body;
await page.screenshot({ path: path.join(SHOTS, `menuchar-arms${tag}.png`), clip: { x: Math.max(0, x0 - 10), y: Math.max(0, y0 + (y1 - y0) * 0.18), width: Math.min(W, x1 + 10) - Math.max(0, x0 - 10), height: (y1 - y0) * 0.45 } });
console.log(errors.length ? "PAGE ERRORS " + errors.join(" | ") : "no page errors");
await browser.close(); server.close();
