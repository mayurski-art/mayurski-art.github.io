// Troll Royale: the match report while you spectate (modes/royale-live-report.js).
// One headless tab in a private room (Supabase blocked, never the public
// one), bots on, the island's flip brought in to 8 s. After the flip a kill
// is logged and you go down; then, spectating:
//   - the spectate bar has the report's button; M opens it (no pause menu);
//   - Summary: where you went out, how many are left, the storm, your numbers;
//   - Scoreboard: the board, everyone on it;
//   - Map: both sides of the island (before the flip / now), the live one's
//     plan drawn, the storm and the players still standing over it;
//   - it updates while open (the clock moves, the alive count holds);
//   - Esc goes back to watching, M toggles, the match's end shuts it.
// SHOTS_DIR=<dir> keeps a shot of each tab.
//
//   NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-live-report-test.mjs
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
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(m.text()); });
const R = (fn, arg) => page.evaluate(fn, arg);
const src = (f) => fs.readFileSync(path.join(ROOT, "assets/games/troll-ops", f), "utf8");
const LOG_URL = "/assets/games/troll-ops/" + src("modes/match-end.js").match(/combat\/match-log\.js\?v=[\w-]+/)[0];

await page.addInitScript(() => { window.__royaleSide = "trollface"; window.__flipAt = 8; });
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps && !!window.__trollLiveReport, null, { timeout: 180000 });
await R(async () => {
  const T = window.__trollOps;
  T.DROP.enabled = false;
  T.setMode("royale");
  if (T.els.noBots) T.els.noBots.checked = false;
  T.els.room.value = "RLR" + Math.floor(Math.random() * 900 + 100);   // a private room: never the public one
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && window.__trollOps.royale()?.live, null, { timeout: 300000 });
check(!(await R(() => window.__trollLiveReport.can())), "alive, the report can't open");
// past the flip and its cinematic
await page.waitForFunction(() => window.__trollOps.loadedMapId() === "hollowgrin" && window.__trollOps.royale()?.worlds, null, { timeout: 120000 });
await sleep(10000);

// a kill, then out
const out = await R(async (url) => {
  const T = window.__trollOps, { matchLog } = await import(url), p = T.move.pos;
  matchLog.kill({ x: p.x + 6, y: p.y, z: p.z + 3 }, { x: p.x, z: p.z }, "kek", false, T.player.matchT);
  T.player.spawnGuard = 0;
  const killer = T.bots.bots.find((b) => b.alive);
  T.damagePlayer(999, killer.id, "problem416", false, killer.pos);
  return { alive: T.player.alive, bots: T.bots.bots.filter((b) => b.alive).length };
}, LOG_URL);
check(!out.alive && out.bots > 2, "you went down with others still standing", JSON.stringify(out));
await page.waitForFunction(() => window.__trollOps.royaleSpectating(), null, { timeout: 30000 });
const btn = await R(() => { const b = document.querySelector("#to-spectate .to-spectate-report"); return b && { shown: !document.getElementById("to-spectate").hidden && b.offsetWidth > 0, text: b.textContent.trim() }; });
check(btn?.shown && /Match report/.test(btn.text), "the spectate bar has a Match report button", JSON.stringify(btn));

// M opens it
await page.mouse.move(640, 760);
await page.keyboard.press("KeyM");
await sleep(400);
const s1 = await R(() => {
  const el = document.querySelector(".to-live-report");
  return { open: !!el && !el.hidden, out: el?.querySelector(".to-live-out")?.textContent, meta: el?.querySelector(".to-live-meta")?.textContent,
    stats: [...(el?.querySelectorAll('[data-pane="summary"] .to-aar-stats div') || [])].map((d) => d.textContent.trim()),
    pause: !!document.querySelector(".to-pause:not([hidden]), #to-pause:not([hidden])"), state: window.__trollOps.state() };
});
console.log(JSON.stringify(s1));
check(s1.open && s1.state === "playing" && !s1.pause, "M opens the report; the match plays on, no pause menu");
check(/Eliminated — \d+\w\w of \d+/.test(s1.out || "") && /\d+ alive/.test(s1.meta || "") && /Zone \d|Final circle/.test(s1.meta || ""), "Summary: where you went out, how many are left, the storm", `${s1.out} | ${s1.meta}`);
check(s1.stats.length === 8 && s1.stats.some((t) => /^1Deaths$/.test(t)), "Summary: your numbers so far", JSON.stringify(s1.stats));
await page.locator(".to-live-card").screenshot({ path: path.join(SHOTS, "royale-live-summary.png") });
await sleep(2200);
const meta2 = await R(() => document.querySelector(".to-live-meta").textContent);
check(meta2 !== s1.meta, "it updates while open (the match clock moves)", `${s1.meta} -> ${meta2}`);

// Scoreboard
await R(() => document.getElementById("to-live-tab-board").click());
await sleep(300);
const sb = await R(() => ({ rows: document.querySelectorAll(".to-live-report .to-aar-board .to-sb-row").length, you: /\(you\)/.test(document.querySelector(".to-live-report .to-aar-board").textContent) }));
check(sb.rows > 3 && sb.you, "Scoreboard: the board, everyone on it", JSON.stringify(sb));
await page.locator(".to-live-card").screenshot({ path: path.join(SHOTS, "royale-live-board.png") });

// Map
await R(() => document.getElementById("to-live-tab-map").click());
await page.waitForFunction(() => window.__trollOps.royale()?.liveBp, null, { timeout: 30000 });
await sleep(1300);
const mp = await R(() => {
  const el = document.querySelector(".to-live-report");
  const worlds = [...el.querySelectorAll(".to-aar-world")].map((b) => ({ text: b.textContent.replace(/\s+/g, " ").trim(), on: b.getAttribute("aria-pressed") }));
  const c = [...el.querySelectorAll(".to-aar-map")].find((m) => !m.hidden).querySelector("canvas");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let storm = 0, dots = 0, watched = 0;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    if (r > 170 && b > 220 && g < 175 && g > 110) storm++;   // the circle's lilac
    if (r > 245 && g > 245 && b > 245) dots++;               // players still standing
    if (g > 240 && r < 150 && b < 110) watched++;            // the one you're watching
  }
  return { worlds, storm, dots, watched, kills: el.querySelector(".to-aar-map:not([hidden]) .to-bp-chip.is-kill b")?.textContent };
});
console.log(JSON.stringify(mp));
check(mp.worlds.length === 2 && /Trollface Island/.test(mp.worlds[0].text) && /Hollowgrin.*Now/.test(mp.worlds[1].text) && mp.worlds[1].on === "true", "Map: both sides, the one being played up", JSON.stringify(mp.worlds));
check(mp.kills === "1", "Map: your kill since the flip is on the live side", mp.kills);
check(mp.storm > 80 && mp.dots > 10 && mp.watched > 10, "Map: the storm's circle and everyone standing drawn over the plan", JSON.stringify({ storm: mp.storm, dots: mp.dots, watched: mp.watched }));
await page.locator(".to-live-card").screenshot({ path: path.join(SHOTS, "royale-live-map.png") });
await R(() => document.querySelector('.to-live-report .to-aar-world[data-world="0"]').click());
await sleep(400);
const before = await R(() => ({ shown: [...document.querySelectorAll(".to-live-report .to-aar-map")].map((m) => !m.hidden), cut: document.querySelector(".to-live-report .to-aar-map:not([hidden]) .to-bp-cut")?.textContent }));
check(before.shown[0] && !before.shown[1], "the toggle shows the side before the flip", JSON.stringify(before));
await page.locator(".to-live-card").screenshot({ path: path.join(SHOTS, "royale-live-map-before.png") });

// Esc back to watching, M toggles
await page.keyboard.press("Escape");
await sleep(300);
const back = await R(() => ({ open: window.__trollLiveReport.isOpen(), watching: window.__trollOps.royaleSpectating(), bar: !document.getElementById("to-spectate").hidden }));
check(!back.open && back.watching && back.bar, "Esc goes back to watching", JSON.stringify(back));
await page.keyboard.press("KeyM");
await sleep(200);
const again = await R(() => window.__trollLiveReport.isOpen());
await page.keyboard.press("KeyM");
await sleep(200);
const shut = await R(() => window.__trollLiveReport.isOpen());
check(again && !shut, "M opens and shuts it", JSON.stringify({ again, shut }));
await page.keyboard.press("KeyM");
await sleep(200);
await R(() => window.__trollOps.endMatch("The Cringe wins"));
await sleep(300);
const end = await R(() => ({ open: window.__trollLiveReport.isOpen(), aar: !document.getElementById("to-aar").hidden }));
check(!end.open && end.aar, "the match's end shuts it; the after-action report takes over", JSON.stringify(end));
check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
console.log(`shots: ${SHOTS}`);
await browser.close(); server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
