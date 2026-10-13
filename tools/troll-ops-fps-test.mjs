// Troll Forces: Settings > Show FPS (core/fps-meter.js; user 2026-10-12,
// "build the fps counter"). Off by default; the menu's switch turns it on,
// it reads "N FPS · worst N ms · TIER", it's saved across a reload, it shows
// in a match too, and it overlaps no other text (the shared ink scan), on
// desktop and phone (PHONE=1). Supabase blocked; the Test Range, no room.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-fps-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { textClash } from "./troll-ops-text-scan.mjs";
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
const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const ctx = await browser.newContext(process.env.PHONE
  ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
  : { viewport: { width: 1366, height: 768 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const URL_ = `http://localhost:${server.address().port}/troll-ops.html?tohooks=1`;
const tag = process.env.PHONE ? "phone" : "desktop";
/* Anything visible under the readout (buttons, panels, text): sampled on a grid. */
const under = () => page.evaluate(() => {
  const el = document.getElementById("to-fps");
  if (!el || el.hidden) return [];
  const r = el.getBoundingClientRect(), hits = new Set();
  el.style.visibility = "hidden";
  for (let x = r.left + 2; x < r.right; x += 6) for (let y = r.top + 2; y < r.bottom; y += 5) {
    for (const e of document.elementsFromPoint(x, y)) {
      if (e === document.body || e === document.documentElement || e.tagName === "CANVAS") continue;
      const er = e.getBoundingClientRect();
      if (er.width * er.height > innerWidth * innerHeight * 0.5) continue;   // a screen, not something on it
      const s = getComputedStyle(e);
      const drawn = (s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent") || s.borderTopWidth !== "0px" || e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || /^(BUTTON|IMG|SVG|A|INPUT)$/i.test(e.tagName);
      if (drawn && s.visibility !== "hidden" && +s.opacity > 0.05) hits.add(e.id || e.className?.baseVal || e.className || e.tagName);
    }
  }
  el.style.visibility = "";
  return [...hits];
});
const meter = () => page.evaluate(() => {
  const el = document.getElementById("to-fps");
  if (!el || el.hidden) return { shown: false };
  const r = el.getBoundingClientRect();
  return { shown: true, text: el.textContent, band: el.dataset.band, box: [r.left, r.top, r.right, r.bottom].map(Math.round), vw: innerWidth };
});

await page.goto(URL_, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.waitForTimeout(1500);
check(!(await meter()).shown, "off by default");
// The menu's switch (the BO2 settings row drives this same checkbox).
await page.evaluate(() => { const c = document.getElementById("to-set-fps-lobby"); c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); c.dispatchEvent(new Event("input", { bubbles: true })); });
await page.waitForTimeout(1500);
let m = await meter();
check(m.shown && /^\d+ FPS · worst \d+ ms · (HIGH|MEDIUM|LOW)$/.test(m.text), "the switch turns it on, with fps, worst frame and graphics level", JSON.stringify(m));
check(m.shown && m.box[2] <= m.vw && m.box[1] >= 0, "at the top, on screen", JSON.stringify(m.box));
let u = await under();
check(!u.length, "covers nothing in the menu", JSON.stringify(u));
await textClash(page, check, `menu (${tag})`);
await page.screenshot({ path: path.join(SHOTS, `fps-menu-${tag}.png`) });

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.waitForTimeout(1500);
check((await meter()).shown, "still on after a reload (saved)");

await page.evaluate(async () => { const T = window.__trollOps; T.setMode("range"); await T.startGame(); });
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
await page.waitForTimeout(2000);
m = await meter();
check(m.shown && /FPS/.test(m.text), "shows in a match", JSON.stringify(m));
u = await under();
check(!u.length, "covers nothing in a match", JSON.stringify(u));
await textClash(page, check, `in a match (${tag})`);
await page.screenshot({ path: path.join(SHOTS, `fps-match-${tag}.png`) });

await page.evaluate(() => { const c = document.getElementById("to-set-fps"); c.checked = false; c.dispatchEvent(new Event("change", { bubbles: true })); c.dispatchEvent(new Event("input", { bubbles: true })); });
await page.waitForTimeout(600);
check(!(await meter()).shown, "the pause menu's switch turns it off");
check(errors.length === 0, "no page errors", errors.join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
