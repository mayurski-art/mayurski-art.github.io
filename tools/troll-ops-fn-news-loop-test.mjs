// The news is a loop nobody turns (user, 2026-10-31: spam-clicking the
// far-right circle, "a different background appears and the nearby boxes
// change sizes"; then "dont even make the circles clickable ... a continous
// loop that no one has control of manipulating"). Spam-clicks the circles and
// the card, swipes, presses an arrow: the story stays, and the backdrop, mode,
// playlist and boxes never change; then the loop turns by itself, under the
// pointer too, the lit circle with it. Two laptop sizes. Supabase blocked.
//
//   node tools/troll-ops-fn-news-loop-test.mjs
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
for (const [name, vp, more] of [["laptop", { width: 1920, height: 1080 }, {}], ["laptop-1366", { width: 1366, height: 768 }, {}]]) {
  const ctx = await browser.newContext({ viewport: vp, ...more });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1&season=off`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__toBo2?.fn, null, { timeout: 180000 });
  await sleep(800);
  await page.evaluate(() => { document.querySelectorAll(".tf-toast-x").forEach((x) => x.click()); window.__toBo2.fn.setPlaylist("public"); window.__toBo2.menu.backTo("main"); });
  await sleep(1500);
  const state = () => page.evaluate(() => {
    const box = (s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? [Math.round(r.top), Math.round(r.height)].join("/") : null; };
    const shot = document.querySelector(".to-fn-bg.is-on .to-fn-shot");
    return { pl: window.__toBo2.fn.playlist(), mode: document.querySelector(".to-fn-mode-sub")?.textContent, map: document.querySelector(".to-fn-map strong")?.textContent,
      bg: (shot?.currentSrc || shot?.src || "").replace(/^.*\/ui\//, "").replace(/-\d+\.webp.*$/, ""),
      boxes: [box(".to-bo2-party"), box(".to-fn-play"), box(".to-fn-news")].join(" ") };
  });
  const before = await state();
  check(!!before.boxes && before.boxes.split(" ").every((b) => b !== "null"), `${name}: the news shows`, JSON.stringify(before));
  const story = () => page.evaluate(() => [...document.querySelectorAll(".to-fn-news-card")].findIndex((c) => !c.hidden));
  const center = (sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top }; }, sel);
  const pips = await page.evaluate(() => [...document.querySelectorAll(".to-fn-pips > *")].map((p) => { const r = p.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: p.tagName }; }));
  check(pips.length === 4 && pips.every((p) => p.tag !== "BUTTON"), `${name}: four circles, none of them a button`, pips.map((p) => p.tag).join(","));
  const s0 = await story();
  // every turn counted while the clicks go in: the loop itself may turn once in that time
  await page.evaluate(() => { window.__turns = 0; let last = null; new MutationObserver(() => { const i = [...document.querySelectorAll(".to-fn-news-card")].findIndex((c) => !c.hidden); if (i !== last) { last = i; window.__turns++; } }).observe(document.querySelector(".to-fn-news"), { subtree: true, attributes: true, attributeFilter: ["hidden"] }); });
  const tSpam = Date.now();
  // spam the far-right circle, then every circle, then the card, then a swipe
  for (const i of [3, 3, 0, 2, 1]) for (let k = 0; k < 6; k++) { await page.mouse.click(pips[i].x, pips[i].y); await sleep(40); }
  const card = await center(".to-fn-news-card:not([hidden])");
  for (let k = 0; k < 6; k++) { await page.mouse.click(card.x, card.y + 10); await sleep(40); }
  await page.mouse.move(card.x + 60, card.y); await page.mouse.down(); await page.mouse.move(card.x - 20, card.y); await page.mouse.move(card.x - 90, card.y); await page.mouse.up();
  await page.keyboard.press("ArrowRight");
  await sleep(250);
  const s1 = await story(), st = await state(), turns = await page.evaluate(() => window.__turns), spamMs = Date.now() - tSpam;
  check(turns <= Math.ceil(spamMs / 8000), `${name}: spam-clicking the circles and the card, a swipe and the arrow key don't turn the news`, `${turns} turns in ${spamMs} ms (${s0} -> ${s1})`);
  check(st.pl === before.pl && st.mode === before.mode && st.map === before.map && st.bg === before.bg && st.boxes === before.boxes,
    `${name}: and change no backdrop, mode or box`, `${JSON.stringify(before)} -> ${JSON.stringify(st)}`);
  // the loop turns on its own, under the pointer too (no hover hold)
  await page.mouse.move(card.x, card.y);
  const t0 = Date.now(); let s2 = s1;
  while (Date.now() - t0 < 9500 && s2 === s1) { await sleep(250); s2 = await story(); }
  check(s2 === (s1 + 1) % 4, `${name}: the news turns by itself, pointer over it or not`, `${s1} -> ${s2} in ${Date.now() - t0} ms`);
  const lit = await page.evaluate(() => [...document.querySelectorAll(".to-fn-pips > *")].findIndex((p) => p.classList.contains("is-on")));
  check(lit === s2, `${name}: the lit circle is the story shown`, `${lit} vs ${s2}`);
  check(!errors.length, `${name}: no page errors`, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "NEWS LOOP GREEN");
process.exit(fails ? 1 : 0);
