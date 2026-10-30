// Troll Warfare's Fortnite-style lobby (menu/lobby-fn.js, phase 1).
// Supabase is blocked: the page must never join the live public room, and
// nothing here presses a go button.
//   1. The Play page: tab bar, season card ("Chapter One / Season: OG"),
//      the mode card and PLAY show; the BO2 list is hidden there.
//   2. Each tab opens its screen and lights up; Play comes back to the page.
//   3. The mode picker sets the playlist (kept across a reload), and PLAY
//      opens that playlist's screen, under the Play tab.
//   4. Upright phone: the list is measured shown (the gun view stands under
//      it, not over it), and no scrollbars are drawn.
//   5. The news card swipes: left the next, right the last, Halloween
//      first; a swipe doesn't open the card's mode.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-fn-lobby-test.mjs
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

async function open(viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  // (season=off: the year-round stills)
  await page.goto(`${BASE}/troll-ops.html?tohooks=1&season=off`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2?.fn, null, { timeout: 180000 });
  await sleep(500);
  return { ctx, page };
}
const shown = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !!e.offsetParent && getComputedStyle(e).visibility !== "hidden"; }, sel);
const cur = (page) => page.evaluate(() => window.__toBo2.menu.current());
const onTab = (page) => page.evaluate(() => document.querySelector(".to-fn-tab.is-on")?.dataset.tab);

// ---- 1
let { ctx, page } = await open({ width: 1280, height: 720 });
check(await shown(page, ".to-fn-tabs"), "tab bar shows");
const season = await page.evaluate(() => document.querySelector(".to-fn-season")?.textContent.replace(/\s+/g, " ").trim());
check(/Chapter One/i.test(season) && /Season: OG/i.test(season), "season card says Chapter One, Season: OG", season);
check(await shown(page, ".to-fn-play") && await shown(page, ".to-fn-go"), "mode card and PLAY show");
check(!(await shown(page, ".to-bo2-menu")), "the BO2 list is hidden on the Play page");
check(await page.evaluate(() => !document.body.textContent.includes("\u{1F9CC}")), "no troll emoji anywhere");
await page.waitForSelector(".to-fn-bg.is-on .to-fn-shot", { timeout: 15000 }).catch(() => {});
check(await page.evaluate(() => { const i = document.querySelector(".to-fn-bg.is-on .to-fn-shot"); return !!i && /trollface/.test(i.currentSrc || i.src); }), "the backdrop reel opens on Trollface Island (no map picked)");

// ---- 2
const want = { locker: "locker", career: "barracks", compete: "leaders", quests: "quests", options: "options" };
for (const [tab, screen] of Object.entries(want)) {
  await page.click(`.to-fn-tab[data-tab="${tab}"]`);
  await sleep(250);
  const c = await cur(page), t = await onTab(page);
  check(c === screen && t === tab && await shown(page, ".to-bo2-menu") && !(await shown(page, ".to-fn-play")), `${tab} tab opens ${screen}`, `${c} / ${t}`);
}
await page.click('.to-fn-tab[data-tab="locker"]');
await page.evaluate(() => window.__toBo2.menu.go("classlist"));
await sleep(250);
check(await onTab(page) === "locker", "Create a Class stays under Locker", await onTab(page));
await page.click('.to-fn-tab[data-tab="play"]');
await sleep(250);
check(await cur(page) === "main" && await shown(page, ".to-fn-play"), "Play brings the Play page back", await cur(page));
const quests = await page.evaluate(() => document.querySelectorAll(".to-fn-qlist li").length);
check(quests === 3, "three challenges on the Play page", String(quests));

// ---- 3
await page.click(".to-fn-mode");
await sleep(200);
check(await shown(page, ".to-fn-picker"), "Change mode opens the picker");
await page.click('.to-fn-picker [data-pl="solo"]');
await sleep(200);
const name = await page.evaluate(() => document.querySelector(".to-fn-mode-name").textContent);
check(name === "Solo Play" && !(await shown(page, ".to-fn-picker")), "picking Solo Play names it on the card", name);
await page.click(".to-fn-go");
await sleep(300);
check(await cur(page) === "solo" && await onTab(page) === "play", "PLAY opens Solo Play under the Play tab", `${await cur(page)} / ${await onTab(page)}`);
await page.keyboard.press("Escape");
await sleep(250);
check(await cur(page) === "main", "Esc goes back to the Play page", await cur(page));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__toBo2?.fn, null, { timeout: 180000 });
check(await page.evaluate(() => window.__toBo2.fn.playlist()) === "solo", "the playlist is kept across a reload");
await page.evaluate(() => localStorage.removeItem("tf-fn-playlist"));
await ctx.close();

// ---- 4
({ ctx, page } = await open({ width: 375, height: 812 }));
await page.evaluate(() => { window.__toBo2.menu.go("locker"); window.__toBo2.menu.go("classlist"); });
await sleep(800);
const geo = await page.evaluate(() => {
  const nav = document.querySelector(".to-bo2-menu").getBoundingClientRect();
  const gun = document.querySelector(".to-gun-view")?.getBoundingClientRect();
  return { navBottom: Math.round(nav.bottom), gunTop: gun ? Math.round(gun.top) : null };
});
check(geo.gunTop != null && geo.gunTop >= geo.navBottom, "phone: the gun view stands under the class list", JSON.stringify(geo));
// a drawn scrollbar is what's left of offsetWidth after clientWidth and the borders
const bars = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => {
  const s = getComputedStyle(e);
  return e.clientHeight > 0 && e.offsetWidth - e.clientWidth - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth) > 0.5;
}).map((e) => e.className || e.tagName).slice(0, 5));
check(!bars.length, "no scrollbars drawn", bars.join(", "));
await ctx.close();

// ---- 5
({ ctx, page } = await open({ width: 1280, height: 720 }));
await page.evaluate(() => { window.__toBo2.menu.backTo("main"); document.body.classList.add("tf-anim-off"); });
await sleep(500);
const newsNow = () => page.evaluate(() => document.querySelector(".to-fn-news-card:not([hidden]) b")?.textContent);
const swipe = async (dx) => {
  const r = await page.evaluate(() => { const b = document.querySelector(".to-fn-news").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.move(r.x, r.y); await page.mouse.down(); await page.mouse.move(r.x + dx / 2, r.y); await page.mouse.move(r.x + dx, r.y); await page.mouse.up();
  await sleep(200);
};
const firstNews = await newsNow();
const plBefore = await page.evaluate(() => window.__toBo2.fn.playlist());
await swipe(-120);
const second = await newsNow();
await swipe(120);
const back = await newsNow();
const plAfter = await page.evaluate(() => window.__toBo2.fn.playlist());
check(firstNews === "Halloween" && second === "Trollface Island" && back === "Halloween", "the news swipes: left the next, right the last", `${firstNews} -> ${second} -> ${back}`);
check(plAfter === plBefore, "a swipe doesn't open the card's mode", `${plBefore} -> ${plAfter}`);
await ctx.close();

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
