// Troll Royale: Two Worlds in the after-action report (modes/royale-worlds.js,
// modes/after-action.js). One headless tab in a private room (Supabase
// blocked, never the public one), no bots, the flip brought in to 10 s.
//   1. A kill on Trollface Island, the island turns over (the old side's
//      plan is drawn just before the swap), a kill on Hollowgrin, the match
//      ends: the Map tab has a toggle between the two sides, each with its
//      own kill and a drawn plan; the end's render goes to Hollowgrin.
//   2. royaleWorlds for a player out before the flip: only the side they
//      played, its plan already drawn; no flip: no toggle (null).
// SHOTS_DIR=<dir> keeps a shot of each side's plan.
//
//   NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-worlds-aar-test.mjs
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
// the game's own copies: the tags the importers load them on
const src = (f) => fs.readFileSync(path.join(ROOT, "assets/games/troll-ops", f), "utf8");
const LOG_URL = "/assets/games/troll-ops/" + src("modes/match-end.js").match(/combat\/match-log\.js\?v=[\w-]+/)[0];
const WORLDS_URL = "/assets/games/troll-ops/modes/" + src("modes/match-end.js").match(/royale-worlds\.js\?v=[\w-]+/)[0];

await page.addInitScript(() => { window.__royaleSide = "trollface"; window.__flipAt = 10; });
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await R(async () => {
  const T = window.__trollOps;
  T.DROP.enabled = false;
  T.setMode("royale");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.els.room.value = "RWA" + Math.floor(Math.random() * 900 + 100);   // a private room: never the public one
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && window.__trollOps.royale()?.live, null, { timeout: 300000 });

// 1. a kill before the flip, one after, the end
const kill = (url) => R(async (url) => {
  const T = window.__trollOps, { matchLog } = await import(url), p = T.move.pos;
  matchLog.kill({ x: p.x + 6, y: p.y, z: p.z + 2 }, { x: p.x, z: p.z }, "kek", false, T.player.matchT);
  return { map: T.loadedMapId(), t: T.player.matchT, n: matchLog.events.length };
}, url);
const k1 = await kill(LOG_URL);
check(k1.map === "trollface", "the match starts on Trollface Island", JSON.stringify(k1));
await page.waitForFunction(() => window.__trollOps.loadedMapId() === "hollowgrin" && window.__trollOps.royale()?.worlds, null, { timeout: 90000 });
const w0 = await R(() => { const w = window.__trollOps.royale().worlds[0]; return { id: w.id, alive: w.alive, untilT: w.untilT, cap: typeof w.capture?.finish === "function", span: w.capture?.bounds?.span, walls: w.colliders.length }; });
check(w0.id === "trollface" && w0.alive && w0.cap && w0.untilT >= k1.t, "the old side's plan was drawn before the swap, you alive at it", JSON.stringify(w0));
// (out of the flip cinematic before the next kill)
await sleep(9500);
const k2 = await kill(LOG_URL);
check(k2.map === "hollowgrin" && k2.t > w0.untilT, "the second kill is on Hollowgrin, after the flip", JSON.stringify(k2));
await R(() => window.__trollOps.endMatch("You win — last troll standing", { won: true }));
await page.waitForFunction(() => !document.getElementById("to-aar")?.hidden && document.querySelector(".to-aar-world"), null, { timeout: 30000 });
await R(() => {
  document.querySelectorAll(".to-bo2").forEach((m) => { m.style.display = "none"; });
  document.getElementById("to-aar-tab-map").click();
});
await sleep(3500);   // the end's render (queued 2.6 s on, or at the tab)
const rep = await R(() => {
  const el = document.getElementById("to-aar");
  const btns = [...el.querySelectorAll(".to-aar-world")].map((b) => ({ text: b.textContent.replace(/\s+/g, " ").trim(), on: b.getAttribute("aria-pressed") }));
  const maps = [...el.querySelectorAll(".to-aar-map")].map((m) => ({ hidden: m.hidden, kills: m.querySelector(".to-bp-chip.is-kill b")?.textContent, cut: m.querySelector(".to-bp-cut")?.textContent }));
  return { btns, maps, meta: el.querySelector(".to-aar-meta")?.textContent };
});
console.log(JSON.stringify(rep));
check(rep.btns.length === 2 && /Trollface Island/.test(rep.btns[0].text) && /Hollowgrin/.test(rep.btns[1].text), "the Map tab has a toggle: Trollface Island, Hollowgrin", JSON.stringify(rep.btns));
check(rep.btns[1].on === "true" && rep.maps[0].hidden && !rep.maps[1].hidden, "it opens on the side the match ended on");
check(rep.maps[0].kills === "1" && rep.maps[1].kills === "1", "each side has its own kill", JSON.stringify(rep.maps));
check(/Trollface Island → Hollowgrin/.test(rep.meta || ""), "the banner names both sides", rep.meta);
// a drawn plan: the canvas has real linework (many distinct colours), not the blank sheet
const sheet = () => R(() => {
  const c = [...document.querySelectorAll(".to-aar-map")].find((m) => !m.hidden).querySelector("canvas");
  const g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data, seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 37) seen.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3));
  return { w: c.width, colours: seen.size };
});
const s1 = await sheet();
await page.locator("#to-aar .to-aar-map:not([hidden])").screenshot({ path: path.join(SHOTS, "royale-worlds-hollowgrin.png") });
await R(() => document.querySelector('.to-aar-world[data-world="0"]').click());
await sleep(400);
const s0 = await sheet();
const flipped = await R(() => ({ on: document.querySelector('.to-aar-world[data-world="0"]').getAttribute("aria-pressed"), shown: [...document.querySelectorAll(".to-aar-map")].map((m) => !m.hidden) }));
await page.locator("#to-aar .to-aar-map:not([hidden])").screenshot({ path: path.join(SHOTS, "royale-worlds-trollface.png") });
await page.locator("#to-aar").screenshot({ path: path.join(SHOTS, "royale-worlds-report.png") });
check(flipped.on === "true" && flipped.shown[0] && !flipped.shown[1], "the toggle goes to Trollface Island", JSON.stringify(flipped));
check(s0.w > 200 && s0.colours > 40 && s1.colours > 40, "both plans are drawn (linework, not a blank sheet)", JSON.stringify({ s0, s1 }));

// 2. royaleWorlds on its own
const solo = await R(async (url) => {
  const { royaleWorlds } = await import(url);
  const A = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 }, drawn = { canvas: {}, bounds: { minX: -52, minZ: -52, span: 104 } }, cap = { finish: () => drawn };
  const d = { events: [{ kind: "kill", t: 3 }, { kind: "death", t: 7 }], arena: A, colliders: [], counts: { kill: 1, death: 1, assist: 0 } };
  const out = royaleWorlds({ worlds: [{ id: "trollface", arena: A, colliders: [], untilT: 9, alive: false, capture: cap }] }, d);
  return { out: out.map((w) => ({ id: w.id, n: w.events.length, live: !!w.live, cap: w.capture === drawn, counts: w.counts })), none: royaleWorlds({}, d), nil: royaleWorlds(null, d) };
}, WORLDS_URL);
check(solo.out.length === 1 && solo.out[0].id === "trollface" && solo.out[0].n === 2 && !solo.out[0].live && solo.out[0].cap,
  "out before the flip: only the side you played, its plan drawn, the end's render not wanted", JSON.stringify(solo.out));
check(solo.none === null && solo.nil === null, "no flip (or not Royale): one map, as before");
check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
console.log(`shots: ${SHOTS}`);
await browser.close(); server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
