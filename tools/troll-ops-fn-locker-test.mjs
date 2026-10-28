// Troll Warfare's lobby, phase 4: the Locker (menu-bo2.js locker screen,
// style.css). Offline: Supabase is blocked; nothing starts a match.
//   1. The Locker is your class's slots (Class, Primary ... Scorestreaks) on
//      the left and your look (Body, Face, Wrist, Reticle, Calling Card) on the right,
//      each tile with what's in it; you stand between them.
//   2. A gun tile goes through the class: Primary, a weapon, and Back from
//      the class comes home to the Locker.
//   3. The Face tile opens its picker as item cards, two across; a pick
//      shows on the tile.
//   4. Desktop and phones (sideways, upright): every tile on screen, none
//      overlapping another or the operator; no page errors.
// Screenshots: .claude/run/locker-test-*.png
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-fn-locker-test.mjs
//   (ANGLE=swiftshader to draw on the CPU while a GPU job runs)
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
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__toBo2?.fn, null, { timeout: 180000 });
await page.waitForTimeout(2000);

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const cur = () => page.evaluate(() => window.__toBo2.menu.current());
const tiles = () => page.evaluate(() => [...document.querySelectorAll(".to-bo2-menu .tr-menu-group")].map((g) => [...g.querySelectorAll(".tr-menu-item")].map((b) => ({ id: b.dataset.id, value: b.querySelector("small:not([aria-hidden])")?.textContent || "" }))));
const tile = (id) => page.evaluate((id) => { const b = document.querySelector(`.to-bo2-menu .tr-menu-item[data-id="${id}"]`); b.click(); }, id);
const layout = (w, h) => page.evaluate(([w, h]) => {
  const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const hit = (a, b) => a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
  const items = [...document.querySelectorAll(".to-bo2-menu .tr-menu-item")].filter((e) => e.offsetParent).map(box);
  const scroller = document.querySelector(".to-bo2-menu .tr-menu-groups");
  const sb = box(scroller);
  // (upright, the panels scroll: a tile below the fold is in the scroller)
  const off = items.filter((r) => r.l < 0 || r.r > w + 0.5 || (r.b > h + 0.5 && !(scroller.scrollHeight > scroller.clientHeight && r.t >= sb.t)));
  const overlap = items.some((a, i) => items.some((b, j) => j > i && hit(a, b)));
  const view = document.querySelector(".to-char-view");
  const op = view && getComputedStyle(view).display !== "none" && getComputedStyle(view).visibility !== "hidden" ? box(view) : null;
  const groups = [...document.querySelectorAll(".to-bo2-menu .tr-menu-group")].filter((e) => e.offsetParent).map(box);
  return { n: items.length, off: off.length, overlap, operator: !!op, underOp: op ? groups.filter((g) => hit(g, op)).length : 0 };
}, [w, h]);

// 1. the Locker
await page.click('.to-fn-tab[data-tab="locker"]');
await page.waitForTimeout(900);
let t = await tiles();
check(await cur() === "locker", "the Locker tab opens the Locker");
check(t[0]?.map((x) => x.id).join() === "classlist,primary,secondary,atts,melee,throwable,perk-0,perk-1,perk-2,streaks", "the class panel: Class and its nine slots", t[0]?.map((x) => x.id).join());
check(t[1]?.map((x) => x.id).join() === "body,face,wrist,reticle,cards", "the look panel: Body, Face, Wrist, Reticle, Calling Card", t[1]?.map((x) => x.id).join());
check([...t[0], ...t[1]].every((x) => x.value.trim()), "every tile says what's in it", JSON.stringify([...t[0], ...t[1]].filter((x) => !x.value.trim())));
let L = await layout(1280, 720);
check(L.operator && !L.underOp, "you stand between the panels", JSON.stringify(L));
check(!L.off && !L.overlap, "desktop: every tile on screen, none overlapping", JSON.stringify(L));
await page.screenshot({ path: path.join(SHOTS, "locker-test-desktop.png") });

// 2. a gun through the class, home again
await tile("primary");
await page.waitForTimeout(600);
check(await cur() === "classes", "Primary opens the weapon classes", await cur());
await page.evaluate(() => document.querySelector(".to-bo2-menu .tr-menu-item:not([aria-disabled])").click());
await page.waitForTimeout(600);
check(await cur() === "weapons", "then its weapons", await cur());
const grid = await page.evaluate(() => { const [a, b] = [...document.querySelectorAll(".to-bo2-menu .tr-menu-group:first-child .tr-menu-item")].map((e) => e.getBoundingClientRect()); return { cols: getComputedStyle(document.querySelector(".to-bo2-menu .tr-menu-group:first-child")).gridTemplateColumns.split(" ").length, sameRow: Math.abs(a.top - b.top) < 1 && b.left > a.right }; });
check(grid.cols === 2 && grid.sameRow, "the weapons are item cards, two across", JSON.stringify(grid));
await page.evaluate(() => document.querySelector('.to-bo2-menu .tr-menu-item:not([aria-disabled])').click());
await page.waitForTimeout(600);
check(await cur() === "class", "a pick lands in the class", await cur());
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
check(await cur() === "locker", "and Back comes home to the Locker", await cur());

// 3. the Face picker
const before = (await tiles())[1].find((x) => x.id === "face").value;
await tile("face");
await page.waitForTimeout(600);
check(await cur() === "faces", "Face opens its picker", await cur());
const pics = await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".to-bo2-menu .tr-menu-group:first-child .tr-menu-item")];
  const shown = cards.filter((b) => { const p = b.querySelector(".tr-menu-pic"); const im = p?.querySelector("img"); return p && p.offsetHeight > 30 && (!im || im.naturalWidth > 0); });
  return { cards: cards.length, shown: shown.length, above: shown.every((b) => b.querySelector(".tr-menu-pic").getBoundingClientRect().bottom <= b.querySelector("span").getBoundingClientRect().top + 1) };
});
check(pics.cards > 0 && pics.shown === pics.cards && pics.above, "every face card has its picture, over its name", JSON.stringify(pics));
const pick = await page.evaluate(() => {
  const b = [...document.querySelectorAll(".to-bo2-menu .tr-menu-group:first-child .tr-menu-item:not([aria-disabled])")].find((e) => !e.querySelector(".tr-menu-tick"));
  const name = b?.querySelector("span").textContent;
  b?.click();
  return name;
});
await page.waitForTimeout(700);
const after = (await tiles())[1]?.find((x) => x.id === "face")?.value;
check(await cur() === "locker" && !!pick && after?.toLowerCase() === pick.toLowerCase() && after !== before, "a face picked shows on its tile, back in the Locker", JSON.stringify({ before, pick, after }));

// phase 5: Quests and Prestige Rewards read as cards, two across
for (const [tab, screen, first] of [["quests", "quests", "q-"], ["career", "rewards", "rw-"]]) {
  await page.click(`.to-fn-tab[data-tab="${tab}"]`);
  await page.waitForTimeout(500);
  if (screen !== "quests") await page.evaluate((s) => window.__toBo2.menu.go(s), screen);
  await page.waitForTimeout(600);
  const q = await page.evaluate((first) => {
    const [a, b] = [...document.querySelectorAll(`.to-bo2-menu .tr-menu-item[data-id^="${first}"]`)].map((e) => e.getBoundingClientRect());
    return { title: document.querySelector(".to-bo2-menu .tr-menu-title").textContent, sameRow: !!b && Math.abs(a.top - b.top) < 1 && b.left > a.right };
  }, first);
  check(q.sameRow && (screen !== "quests" || /^Challenges \d+\/\d+$/.test(q.title)), `${screen}: cards two across${screen === "quests" ? ", the title counts what's done" : ""}`, JSON.stringify(q));
}
await page.click('.to-fn-tab[data-tab="locker"]');
await page.waitForTimeout(700);

// 4. phones
for (const [w, h, name] of [[844, 390, "land"], [390, 844, "up"]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(900);
  L = await layout(w, h);
  check(L.n >= 14 && !L.off && !L.overlap && !L.underOp, `phone ${w}x${h}: every tile on screen, none overlapping, none under you`, JSON.stringify(L));
  await page.screenshot({ path: path.join(SHOTS, `locker-test-${name}.png`) });
}

check(errors.length === 0, "no page errors", errors.join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
