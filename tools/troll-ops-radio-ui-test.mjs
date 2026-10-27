// Troll Radio in the Fortnite-style lobby (menu/radio.js, style.css).
// Supabase is blocked; nothing starts a match.
//   1. The toggle opens the player under the tab bar, inside the screen,
//      at desktop, sideways phone and upright phone sizes.
//   2. A click elsewhere on the menu closes it; so does Esc.
//   3. The toggle's bars mark playing (is-playing) and stop with the music.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-radio-ui-test.mjs
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
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const isOpen = (page) => page.evaluate(() => !document.getElementById("to-radio-panel").hidden);

const SIZES = [["desktop", 1280, 720], ["sideways phone", 812, 375], ["upright phone", 375, 812]];
for (const [label, width, height] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2?.fn, null, { timeout: 180000 });
  await sleep(500);

  // ---- 1
  await page.click("#to-radio-toggle");
  await sleep(300);
  const g = await page.evaluate(() => {
    const p = document.getElementById("to-radio-panel").getBoundingClientRect();
    const t = document.querySelector(".to-fn-tabs").getBoundingClientRect();
    return { top: Math.round(p.top), left: Math.round(p.left), right: Math.round(p.right), bottom: Math.round(p.bottom), tabs: Math.round(t.bottom), vw: innerWidth, vh: innerHeight };
  });
  check(await isOpen(page), `${label}: the toggle opens the radio`);
  check(g.top >= g.tabs && g.left >= 0 && g.right <= g.vw && g.bottom <= g.vh, `${label}: under the tabs, inside the screen`, JSON.stringify(g));

  // ---- 2
  await page.mouse.click(Math.round(width * 0.4), height - 30);
  await sleep(200);
  check(!(await isOpen(page)), `${label}: a click elsewhere closes it`);
  await page.click("#to-radio-toggle");
  await sleep(200);
  await page.focus("#to-radio-panel button");
  await page.keyboard.press("Escape");
  await sleep(200);
  check(!(await isOpen(page)), `${label}: Esc closes it`);

  // ---- 3
  if (label === "desktop") {
    const playing = await page.evaluate(async () => {
      const { game } = await import("/assets/games/troll-ops/core/state.js?v=st1");
      const t = document.getElementById("to-radio-toggle");
      game.music.toggle();
      await new Promise((r) => setTimeout(r, 1500));
      const on = t.classList.contains("is-playing") === game.music.playing && game.music.playing;
      game.music.stop();
      await new Promise((r) => setTimeout(r, 300));
      return { on, off: !t.classList.contains("is-playing") };
    });
    check(playing.on, "desktop: the bars mark playing", JSON.stringify(playing));
    check(playing.off, "desktop: and stop with the music");
  }
  await ctx.close();
}

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
