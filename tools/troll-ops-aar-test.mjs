// Troll Forces after-action report check (modes/after-action.js,
// progression/weapon-xp.js, combat/match-log.js). One headless tab, Supabase
// blocked, never a room.
//   1. weapon-xp: the level curve, PvP-only pay, the match tally and its report;
//      a guest's XP stays out of localStorage, a signed-in player's lands.
//   2. match-log: kills, deaths and assists with their spots and the shot line.
//   3. The report rendered for a made-up TDM: the banner, the rank bar moving
//      across a level-up, four gun cards with their bars, the stat grid, the
//      scoreboard tab, the blueprint tab drawing every mark. Text-overlap scan
//      and a screenshot of each tab. The plain card's stats are folded away.
//   3b. A real offline TDM on Cul-de-Grin ended through endMatch: the Map tab
//      captures the level (view/blueprint-capture.js) as a cut floor plan.
//   4. hideAfterAction brings the plain card back.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-aar-test.mjs
//   SHOTS_DIR=<dir>; PHONE=1 for a landscape phone
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import { textClash as scanText } from "./troll-ops-text-scan.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TAG = process.env.PHONE ? "-phone" : "";
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
const ctx = await browser.newContext(process.env.PHONE
  ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
  : { viewport: { width: 1280, height: 800 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(m.text()); });
const R = (fn, arg) => page.evaluate(fn, arg);

await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps && !!window.__trollAar, null, { timeout: 180000 });

// Read the live module tags off the page, so the test imports the same copies.
const tags = await R(() => {
  const out = {};
  for (const s of performance.getEntriesByType("resource")) {
    const m = s.name.match(/troll-ops\/(progression\/weapon-xp|combat\/match-log)\.js\?v=([a-z0-9-]+)/i);
    if (m) out[m[1]] = m[2];
  }
  return out;
});
check(tags["progression/weapon-xp"] && tags["combat/match-log"], "weapon-xp and match-log are loaded by the game", JSON.stringify(tags));

// 1. weapon-xp
const wx = await R(async (tags) => {
  const W = await import(`/assets/games/troll-ops/progression/weapon-xp.js?v=${tags["progression/weapon-xp"]}`);
  const T = window.__trollOps;
  const curve = [1, 2, 5, 10, 30].map((l) => [l, W.wxpForLevel(l), W.weaponLevelForXp(W.wxpForLevel(l)), W.weaponLevelForXp(W.wxpForLevel(l) - 1)]);
  localStorage.removeItem("trollops:wxp");
  // a guest, in Ops: nothing pays
  T.setMode("ops");
  W.startWeaponMatch();
  const opsPay = W.addWeaponXp("kek", 25);
  // a guest, in TDM: pays, in memory
  T.setMode("tdm");
  const g1 = W.addWeaponXp("kek", W.WXP.kill + W.WXP.headshot);
  const g2 = W.addWeaponXp("kek", W.WXP.kill);
  const g3 = W.addWeaponXp("lol", W.WXP.assist);
  const guestStored = localStorage.getItem("trollops:wxp");
  const rep = W.matchWeaponReport();
  const prog = W.weaponProgress("kek");
  // signed in: a fresh save in localStorage
  const A = (window.TrollrunnerAccounts ||= {});
  A.getCachedProfile = () => ({ userId: "test-user", username: "aar_tester" });
  W.startWeaponMatch();
  W.addWeaponXp("rofl", 120);
  const stored = JSON.parse(localStorage.getItem("trollops:wxp") || "null");
  const cap = W.addWeaponXp("rofl", 1e9);
  const capped = W.weaponProgress("rofl");
  return { curve, opsPay, g: [g1, g2, g3], guestStored, rep, prog, stored, cap, capped, max: W.WEAPON_MAX_LEVEL };
}, tags);
check(wx.curve.every(([l, xp, at, below]) => at === l && (l === 1 || below === l - 1)) && wx.curve[0][1] === 0 && wx.curve[1][1] === 100,
  "the level curve: each level's floor maps back to it, one XP under to the level below", JSON.stringify(wx.curve));
check(wx.opsPay === 0, "Ops pays no weapon XP");
check(wx.g[0] === 35 && wx.g[1] === 25 && wx.g[2] === 10 && wx.guestStored === null, "TDM pays kill, headshot and assist; a guest's stays out of localStorage", JSON.stringify([wx.g, wx.guestStored]));
check(wx.rep.length === 2 && wx.rep[0].id === "kek" && wx.rep[0].before === 0 && wx.rep[0].after === 60 && wx.rep[0].gained === 60 && wx.rep[1].id === "lol",
  "the match report lists each gun, most earned first, before and after", JSON.stringify(wx.rep));
check(wx.prog.level === 1 && Math.abs(wx.prog.frac - 0.6) < 1e-9 && wx.prog.next === 100, "progress: 60 of 100 into level 1", JSON.stringify(wx.prog));
check(wx.stored && wx.stored.rofl === 120, "signed in: the save lands in localStorage", JSON.stringify(wx.stored));
check(wx.capped.level === wx.max && wx.capped.max && wx.capped.frac === 1 && wx.cap > 0, "XP caps at the top level", JSON.stringify(wx.capped));

// 2. match-log
const ml = await R(async (tags) => {
  const { matchLog } = await import(`/assets/games/troll-ops/combat/match-log.js?v=${tags["combat/match-log"]}`);
  matchLog.reset();
  matchLog.kill({ x: 10, z: -4 }, { x: 2, z: 1 }, "kek", true, 12);
  matchLog.kill(null, { x: 5, z: 5 }, "lol", false, 20);
  matchLog.death({ x: -8, z: 3 }, { x: -1, z: 9 }, "rofl", 30);
  matchLog.assist({ x: 0, z: 0 }, { x: 1, z: 1 }, 40);
  matchLog.push("kill", { x: NaN, z: 1 }, null, "kek", false, 50);
  return { events: matchLog.events.map((e) => ({ ...e })), counts: matchLog.counts() };
}, tags);
check(ml.events.length === 4 && ml.counts.kill === 2 && ml.counts.death === 1 && ml.counts.assist === 1, "the log keeps kills, deaths and assists and drops a spot it can't place", JSON.stringify(ml.counts));
check(ml.events[0].x === 10 && ml.events[0].from?.x === 2 && ml.events[0].head && ml.events[1].x === 5 && ml.events[1].from === null && ml.events[2].from?.z === 9,
  "a kill is where they fell with our spot as the line; no victim spot means ours, no line", JSON.stringify(ml.events.slice(0, 3)));

// 3. the report, rendered for a made-up match
const sample = {
  title: "Phantom win", won: true, ffa: false, modeName: "Team Deathmatch", mapName: "Dust Bowl",
  teams: { mine: { name: "Phantom", score: 75, color: "#7fd1e0" }, theirs: { name: "Ghost", score: 62, color: "#f5b82e" } },
  rank: { levelBefore: 12, fracBefore: 0.82, levelAfter: 13, fracAfter: 0.15, prestige: 0, gained: 455, xpText: "4,120 / 5,200 XP", boosted: true },
  weapons: [
    { id: "kek", before: 90, after: 265, gained: 175, kills: 7 },
    { id: "lol", before: 0, after: 60, gained: 60, kills: 2 },
    { id: "problem416", before: 1000, after: 1035, gained: 35, kills: 1 },
    { id: "rofl", before: 400, after: 410, gained: 10, kills: 0 },
  ],
  stats: { score: 2450, kills: 10, deaths: 6, assists: 3, headshots: 2, bestStreak: 5, seconds: 492, shotsFired: 240, shotsHit: 84 },
  boardHtml: `<div class="to-sb-team"><div class="to-sb-head"><span style="color:#7fd1e0">Phantom · 75</span><span>K</span><span>D</span><span>A</span><span>K/D</span></div>`
    + `<div class="to-sb-row is-you"><span>aar_tester (you)</span><span>10</span><span>6</span><span>3</span><span>1.67</span></div></div>`,
  counts: { kill: 10, death: 6, assist: 3 },
  events: [],
  arena: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 },
  colliders: [],
};
// spots and walls spread across the sheet
for (let i = 0; i < 10; i++) sample.events.push({ kind: "kill", x: -30 + i * 6, z: -20 + (i % 3) * 10, from: { x: -30 + i * 6 - 8, z: -20 + (i % 3) * 10 + 5 }, weapon: "kek", head: i % 4 === 0, t: 5 + i * 10 });
for (let i = 0; i < 6; i++) sample.events.push({ kind: "death", x: -25 + i * 9, z: 22 - (i % 2) * 8, from: { x: -25 + i * 9 + 10, z: 30 }, weapon: "rofl", head: false, t: 100 + i });
for (let i = 0; i < 3; i++) sample.events.push({ kind: "assist", x: 10 + i * 8, z: -30, from: null, weapon: null, head: false, t: 200 + i });
for (let i = 0; i < 12; i++) sample.colliders.push({ min: { x: -35 + i * 6, y: 0, z: -5 + (i % 2) * 12 }, max: { x: -35 + i * 6 + 3, y: 3, z: -5 + (i % 2) * 12 + 5 } });
sample.colliders.push({ min: { x: -10, y: 4, z: -10 }, max: { x: 10, y: 6, z: 10 } });   // overhead: not drawn

await R((d) => {
  const T = window.__trollOps;
  // a real match end has no menu behind the card
  T.els.menu && (T.els.menu.hidden = true);
  document.querySelectorAll(".to-bo2").forEach((m) => { m.style.display = "none"; });
  document.getElementById("to-gameover").hidden = false;
  document.getElementById("to-go-rank").hidden = false;
  window.__trollAar.renderAfterAction(d);
  // read before the first frame starts the bar moving
  window.__aarStart = { level: document.querySelector(".to-aar-level")?.textContent, fill: document.querySelector(".to-aar-rank .to-aar-fill")?.style.width };
}, sample);
await sleep(200);
const head = await R(() => ({
  result: document.querySelector(".to-aar-result")?.textContent,
  score: document.querySelector(".to-aar-score")?.textContent,
  meta: document.querySelector(".to-aar-meta")?.textContent,
  won: document.getElementById("to-aar").dataset.result,
  titleHidden: getComputedStyle(document.getElementById("to-go-title")).display === "none",
  plainHidden: document.querySelector(".to-go-stats").hidden && document.getElementById("to-go-xp").hidden && document.getElementById("to-go-rank").hidden,
  level: window.__aarStart.level,
  fill: window.__aarStart.fill,
  guns: [...document.querySelectorAll(".to-aar-gun")].map((g) => ({ name: g.querySelector(".to-aar-gun-name").textContent, lvl: g.querySelector(".to-aar-gun-level").textContent, cls: g.querySelector(".to-aar-gun-cls").textContent, gain: g.querySelector(".to-aar-gain").textContent })),
  stats: [...document.querySelectorAll(".to-aar-stats div")].map((d) => d.textContent),
  tabs: [...document.querySelectorAll(".to-aar-tab")].map((b) => b.getAttribute("aria-selected")),
}));
check(head.result === "Phantom win" && /Phantom\s*75/.test(head.score) && /62\s*Ghost/.test(head.score) && /Team Deathmatch · Dust Bowl · 8:12/.test(head.meta) && head.won === "won",
  "the banner: result, both sides' scores, mode, map and length", JSON.stringify([head.result, head.score, head.meta]));
check(head.titleHidden && head.plainHidden, "the plain card's title, stats, XP and level-up lines fold away under the report");
check(head.level === "12" && head.fill === "82%", "the rank card starts at the level and bar the match began on", `${head.level} ${head.fill}`);
check(head.guns.length === 4 && head.guns[0].name === "MTAR" && head.guns[0].lvl === "1" && head.guns[0].cls === "Assault rifle" && head.guns[0].gain === "+175 WXP"
  && head.guns[2].name === "Problem 416" && head.guns[2].lvl === "6", "four gun cards, most earned first, at the level they began on", JSON.stringify(head.guns));
check(head.stats.length === 8 && head.stats.some((s) => /2,450Score/.test(s)) && head.stats.some((s) => /1\.67K\/D/.test(s)) && head.stats.some((s) => /35%Accuracy/.test(s)),
  "the stat grid: score, K/D, accuracy and the rest", JSON.stringify(head.stats));
check(head.tabs.join() === "true,false,false", "Summary is the open tab");

// the bars move: across the level-up, then on to the new level's fill
await sleep(2600);
const after = await R(() => ({
  level: document.querySelector(".to-aar-level").textContent,
  fill: document.querySelector(".to-aar-rank .to-aar-fill").style.width,
  up: !document.querySelector(".to-aar-levelup").hidden && document.querySelector(".to-aar-levelup").textContent,
  gun0: { lvl: document.querySelector('.to-aar-gun[data-weapon="kek"] .to-aar-gun-level').textContent, fill: document.querySelector('.to-aar-gun[data-weapon="kek"] .to-aar-fill').style.width, up: document.querySelector('.to-aar-gun[data-weapon="kek"] .to-aar-gun-up').textContent },
  gun1: { lvl: document.querySelector('.to-aar-gun[data-weapon="lol"] .to-aar-gun-level').textContent, fill: document.querySelector('.to-aar-gun[data-weapon="lol"] .to-aar-fill').style.width, upHidden: document.querySelector('.to-aar-gun[data-weapon="lol"] .to-aar-gun-up').hidden },
  pics: [...document.querySelectorAll(".to-aar-gun-pic img")].length,
}));
check(after.level === "13" && after.fill === "15%" && /LV 13/.test(after.up), "the rank bar crosses the level-up and settles on the new level's fill", JSON.stringify(after));
// MTAR 90 -> 265: level 1 (0) -> level 3 (240..420): 25/180 = 14%
check(after.gun0.lvl === "3" && after.gun0.fill === "14%" && /LVL 3/.test(after.gun0.up), "a gun bar crosses two levels and lands on the third", JSON.stringify(after.gun0));
check(after.gun1.lvl === "1" && after.gun1.fill === "60%" && after.gun1.upHidden, "a gun that didn't level fills to its new spot", JSON.stringify(after.gun1));
console.log(`INFO gun pictures drawn: ${after.pics} of 4 (WebGL thumbnails; the name stands in otherwise)`);
await scanText(page, check, "summary tab");
await page.screenshot({ path: path.join(SHOTS, `aar-summary${TAG}.png`) });

// the scoreboard tab
await page.click('.to-aar-tab[data-tab="board"]');
await sleep(150);
const board = await R(() => ({
  shown: !document.querySelector('.to-aar-pane[data-pane="board"]').hidden && document.querySelector('.to-aar-pane[data-pane="summary"]').hidden,
  rows: document.querySelectorAll(".to-aar-board .to-sb-row").length,
  you: document.querySelector(".to-aar-board .to-sb-row.is-you")?.textContent,
  sel: [...document.querySelectorAll(".to-aar-tab")].map((b) => b.getAttribute("aria-selected")).join(),
}));
check(board.shown && board.rows === 1 && /aar_tester/.test(board.you) && board.sel === "false,true,false", "the Scoreboard tab shows the board as the match ended", JSON.stringify(board));
await page.screenshot({ path: path.join(SHOTS, `aar-board${TAG}.png`) });

// the map tab: the drafting sheet, its marks, its tools (no capture here: the colliders stand in)
await page.click('.to-aar-tab[data-tab="map"]');
await sleep(400);
const pix = () => R(() => {
  const c = document.querySelector(".to-aar-blueprint");
  const { data } = c.getContext("2d").getImageData(0, 0, c.width, c.height);
  let green = 0, red = 0, gold = 0, navy = 0, greenish = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (g > 180 && r < 160 && b < 140) green++;
    else if (r > 220 && g < 140 && b < 130) red++;
    else if (r > 220 && g > 150 && b < 90) gold++;
    else if (b > 25 && b > r + 10) navy++;
    if (g > r + 30 && g > b + 10) greenish++;
  }
  return { green, red, gold, navy, greenish, total: data.length / 4 };
});
const map = await R(() => {
  const c = document.querySelector(".to-aar-blueprint");
  return { css: c.clientWidth, cssH: c.clientHeight, w: c.width, vh: innerHeight,
    chips: [...document.querySelectorAll(".to-bp-chip")].map((b) => b.textContent.replace(/\s+/g, " ").trim()),
    block: document.querySelector(".to-bp-block")?.textContent.replace(/\s+/g, " ").trim(),
    clock: document.querySelector(".to-bp-clock")?.textContent };
});
const full = await pix();
check(map.css > 150 && Math.abs(map.css - map.cssH) <= 2 && map.css <= map.vh * 0.8 && map.w >= map.css && full.navy > full.total * 0.6,
  "the sheet is square, sized to the screen, sharp on hi-dpi", JSON.stringify({ ...map, navy: full.navy, total: full.total }));
check(full.green > 200 && full.red > 100 && full.gold > 40, "kill, death and assist marks are drawn", JSON.stringify(full));
check(/Kills 10/.test(map.chips[0]) && /Deaths 6/.test(map.chips[1]) && /Assists 3/.test(map.chips[2]) && /Dust Bowl/.test(map.block) && map.clock === "8:12",
  "the chips count the marks, the title block names the map, the clock reads the match length", JSON.stringify(map));
// filters: deaths off drops the red; heat swaps marks for glow
await page.click('.to-bp-chip[data-k="death"]'); await sleep(100);
const noDeaths = await pix();
check(noDeaths.red < full.red * 0.2, "turning Deaths off takes their marks away", `${full.red} -> ${noDeaths.red}`);
await page.click('.to-bp-chip[data-k="death"]');
// the timeline: at 0:00 nothing has happened yet; halfway, some of it
await page.$eval(".to-bp-scrub", (s) => { s.value = "0"; s.dispatchEvent(new Event("input")); }); await sleep(100);
const atZero = await pix();
await page.$eval(".to-bp-scrub", (s) => { s.value = "8"; s.dispatchEvent(new Event("input")); }); await sleep(100);
const early = await pix();
check(atZero.green < 30 && atZero.red < 20 && early.green > atZero.green && early.green < full.green, "the timeline shows the match up to its time", JSON.stringify({ zero: atZero.green, early: early.green, full: full.green }));
await page.$eval(".to-bp-scrub", (s) => { s.value = s.max; s.dispatchEvent(new Event("input")); }); await sleep(100);
// hover: the card names the kill
const first = sample.events[0];
const tipText = await R(async (e) => {
  const c = document.querySelector(".to-aar-blueprint"), r = c.getBoundingClientRect();
  const S = c.clientWidth, M = Math.max(22, Math.round(S * 0.055)), inner = S - M * 2, span = 80 * 1.04, min = -span / 2;
  const x = r.left + M + ((e.x - min) / span) * inner, y = r.top + M + ((e.z - min) / span) * inner;
  c.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, bubbles: true }));
  await new Promise((res) => setTimeout(res, 50));
  const t = document.querySelector(".to-bp-tip");
  return t.hidden ? null : t.textContent;
}, first);
check(/Kill\s*1/.test(tipText || "") && /MTAR/.test(tipText || "") && /Headshot/.test(tipText || ""), "hovering a mark shows its card: kill number, gun, headshot", tipText);
await page.click(".to-bp-chip[data-heat]"); await sleep(100);
const heatPix = await pix();
check(heatPix.greenish > full.greenish * 1.5, "Heat paints the spots as glow", JSON.stringify({ marks: [full.green, heatPix.green], glow: [full.greenish, heatPix.greenish] }));
await page.click(".to-bp-chip[data-heat]");
await scanText(page, check, "map tab");
await page.screenshot({ path: path.join(SHOTS, `aar-map${TAG}.png`) });

// a capture arriving late swaps the sheet in place
const swapped = await R(() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"); g.fillStyle = "#ff00ff"; g.fillRect(0, 0, 64, 64);
  window.__trollAar.blueprint().setCapture({ canvas: c, bounds: { minX: -41.6, minZ: -41.6, span: 83.2 }, cut: 2.4, floor: 0, cuts: [] });
  const cv = document.querySelector(".to-aar-blueprint"), d = cv.getContext("2d").getImageData(Math.round(cv.width * 0.37), Math.round(cv.height * 0.43), 1, 1).data;
  return { mag: d[0] > 150 && d[2] > 150 && d[1] < 120, cut: document.querySelector(".to-bp-cut").textContent };
});
check(swapped.mag && swapped.cut === "Cut +2.4 m", "a late capture redraws the sheet and the title block reads the cut", JSON.stringify(swapped));

// 3b. a real match end: an offline TDM on Cul-de-Grin (no room code, Supabase
// blocked: never a public room), a few logged spots, endMatch, the Map tab.
await R(() => document.querySelectorAll(".to-bo2").forEach((m) => { m.style.display = ""; }));
await R(async () => {
  const T = window.__trollOps;
  T.els.room.value = ""; T.setMode("tdm"); T.els.noBots.checked = true; T.loadout.mapId = "culdegrin";
  await T.startGame();
  if (T.isStaging()) T.endStaging();
});
const playing = await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 }).then(() => true).catch(() => false);
check(playing, "the offline TDM on Cul-de-Grin is live");
await sleep(1500);
const real = await R(async (tags) => {
  const { matchLog } = await import(`/assets/games/troll-ops/combat/match-log.js?v=${tags["combat/match-log"]}`);
  const T = window.__trollOps, p = T.move.pos;
  matchLog.kill({ x: p.x + 8, y: p.y, z: p.z - 6 }, { x: p.x, y: p.y, z: p.z }, "kek", true, 30);
  matchLog.death({ x: p.x - 5, y: p.y, z: p.z + 4 }, { x: p.x - 14, z: p.z + 10 }, "rofl", 60);
  matchLog.assist({ x: p.x + 2, y: p.y, z: p.z + 9 }, p, 90);
  T.player.matchT = 120;
  T.endMatch("Phantom win");
  await new Promise((r) => setTimeout(r, 50));
  const t0 = performance.now();
  document.querySelector('.to-aar-tab[data-tab="map"]').click();   // opening the tab runs the capture now
  const ms = performance.now() - t0;
  await new Promise((r) => setTimeout(r, 200));
  const c = document.querySelector(".to-aar-blueprint");
  const { data } = c.getContext("2d").getImageData(0, 0, c.width, c.height);
  let line = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] > 170 && data[i + 1] > 200 && data[i + 2] > 220) line++;
  return { ms, line, total: data.length / 4, cut: document.querySelector(".to-bp-cut")?.textContent, has: window.__trollAar.blueprint()?.hasCapture(),
    shown: !document.getElementById("to-aar").hidden, chips: document.querySelector(".to-bp-chips")?.textContent.replace(/\s+/g, " ").trim() };
}, tags);
check(real.shown && real.has, "endMatch shows the report and the Map tab captures the level", JSON.stringify(real));
check(real.line > real.total * 0.01, "the plan carries the level's linework", `${real.line} of ${real.total} px`);
check(real.cut === "Cut +2.4 m", "a small map is cut like a floor plan, 2.4 m over the fight", real.cut);
check(/Kills 1/.test(real.chips) && /Deaths 1/.test(real.chips) && /Assists 1/.test(real.chips), "the logged spots are on it", real.chips);
console.log(`INFO capture took ${Math.round(real.ms)} ms`);
await scanText(page, check, "real map tab");
await page.screenshot({ path: path.join(SHOTS, `aar-map-culdegrin${TAG}.png`) });

// 4. hidden again: the plain card is back
const plain = await R(() => {
  window.__trollAar.hideAfterAction();
  return {
    aarHidden: document.getElementById("to-aar").hidden, empty: !document.getElementById("to-aar").innerHTML,
    stats: !document.querySelector(".to-go-stats").hidden, xp: !document.getElementById("to-go-xp").hidden,
    title: getComputedStyle(document.getElementById("to-go-title")).display !== "none",
  };
});
check(plain.aarHidden && plain.empty && plain.stats && plain.xp && plain.title, "hideAfterAction brings the plain card back", JSON.stringify(plain));

check(!errors.length, "no page errors", errors.slice(0, 4).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
