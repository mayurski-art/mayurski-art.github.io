// Troll Royale in teams, phase 5: spectate teammates first, the end by team
// (modes/royale.js spectateOrder, outLine; modes/royale-squad-end.js;
// after-action.js teamHtml). Mini Royale as Duos (a fixture, private room,
// Supabase blocked):
//   - out with our teammate up: we watch them, not who got us; next keeps
//     to our team; the live report has the team card;
//   - our teammate out too: "5th of 5 teams", watching the rest;
//   - the end: the score line has our team's kills, the Summary's team card
//     our place and both of us.
// SHOTS_DIR=<dir> keeps the shots.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-royale-squad-end-test.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const src = (f) => fs.readFileSync(path.join(ROOT, "assets/games/troll-ops", f), "utf8");
const MODES_URL = "/assets/games/troll-ops/" + src("game.js").match(/modes\/modes\.js\?v=[\w-]+/)[0];

async function open() {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(m.text()); });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2?.fn, null, { timeout: 180000 });
  return page;
}

// ---- a match: Mini Royale (10 trolls) as Duos --------------------------------
async function startDuos() {
  const p = await open();
  await p.evaluate(async (url) => {
    const { MODES } = await import(url);
    MODES.royale_mini_duo = { ...MODES.royale_mini, id: "royale_mini_duo", ffa: false, squad: 2 };
    const T = window.__trollOps;
    T.setMode("royale_mini_duo");
    T.els.room.value = "SQD" + Math.floor(Math.random() * 900 + 100);   // a private room: never the public one
    T.els.room.dispatchEvent(new Event("input"));
    if (T.els.noBots) T.els.noBots.checked = false;
    await T.startGame();
  }, MODES_URL);
  await p.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging() && window.__trollOps.royale()?.live, null, { timeout: 180000 });
  await sleep(800);
  // the bots stand still: their fire would decide who's down
  await p.evaluate(() => { const T = window.__trollOps; T.bots.update = () => {}; T.player.spawnGuard = 0; });
  return p;
}
const killBot = (p, pick) => p.evaluate((pick) => {
  const T = window.__trollOps;
  for (const b of T.bots.bots.filter((b) => b.alive && (pick === "theirs" ? b.team !== T.net.team : b.team === T.net.team))) {
    // (in teams the first hit only puts them down: royale-down.js; the second finishes them)
    let { killed } = T.bots.applyHit(b.id, 999, { pierce: true });
    if (!killed && b.downed) ({ killed } = T.bots.applyHit(b.id, 999, { pierce: true }));
    if (killed) { T.net.reportDeathAs(b.id, null, "zone", false); T.registerDeath(b.name, null, "zone", { victimTeam: b.team, victimIsBot: true, victimId: b.id }); }
  }
}, pick);
const meDown = (p) => p.evaluate(() => { const T = window.__trollOps; T.player.spawnGuard = 0; const k = T.bots.bots.find((b) => b.alive && b.team !== T.net.team); T.damagePlayer(999, k.id, "sixtynine", false, k.pos); if (T.player.downed) T.damagePlayer(999, k.id, "sixtynine", false, k.pos); });

let page = await startDuos();
const mateId = await page.evaluate(() => { const T = window.__trollOps; return T.bots.bots.find((b) => b.team === T.net.team).id; });
await meDown(page);
await page.waitForFunction(() => window.__trollOps.royaleSpectating?.(), null, { timeout: 30000 }).catch(() => {});
await sleep(800);
let sp = await page.evaluate(() => { const T = window.__trollOps, r = T.royale(); return { watching: r.spectate?.id, killer: T.player.lastKilledBy, n: document.getElementById("to-spectate")?.textContent.replace(/\s+/g, " ") }; });
check(sp.watching === mateId && sp.killer && sp.killer !== mateId, "out with our teammate up: we watch them, not who got us", JSON.stringify(sp));
await page.evaluate(() => window.__trollOps.cycleSpectate?.(1));
await sleep(200);
const still = await page.evaluate(() => window.__trollOps.royale().spectate?.id);
check(still === mateId, "next keeps to our team while they're up", still);
// the live report: the team card
await page.mouse.move(640, 700);
await page.keyboard.press("KeyM");
await sleep(600);
const live = await page.evaluate(() => {
  const el = document.querySelector(".to-live-report:not([hidden])");
  return { open: !!el, out: el?.querySelector(".to-live-out")?.textContent, rows: [...(el?.querySelectorAll(".to-aar-squad-row") || [])].map((r) => r.textContent.replace(/\s+/g, " ").trim()) };
});
check(live.open && live.rows.length === 2 && /You.*Out/.test(live.rows[0]) && /Standing/.test(live.rows[1]) && /your team is still in it/.test(live.out || ""), "the live report: our team, us out, them standing", JSON.stringify(live));
await page.locator(".to-live-card").screenshot({ path: path.join(SHOTS, "royale-squad-live.png") });
await page.keyboard.press("Escape");
// our teammate out: our place is the team's, and we watch whoever's left
await killBot(page, "ours");
await page.waitForFunction(() => /Eliminated — \d/.test(document.getElementById("to-spectate")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
await sleep(600);
sp = await page.evaluate(() => { const T = window.__trollOps, r = T.royale(); return { watching: r.spectate?.id, team: r.spectate?.team, mine: T.net.team, out: document.getElementById("to-spectate")?.textContent.replace(/\s+/g, " ") }; });
check(/Eliminated — 5th of 5 teams/.test(sp.out || "") && sp.watching && sp.team !== sp.mine, "both of us out: 5th of 5 teams, watching the rest", JSON.stringify(sp));
// the end: the last bot duo standing wins; our report says it by team
await page.evaluate(() => {
  const T = window.__trollOps, keep = "b0";
  for (const b of T.bots.bots.filter((b) => b.alive && b.team !== keep)) {
    let { killed } = T.bots.applyHit(b.id, 999, { pierce: true });
    if (!killed && b.downed) ({ killed } = T.bots.applyHit(b.id, 999, { pierce: true }));
    if (killed) { T.net.reportDeathAs(b.id, null, "zone", false); T.registerDeath(b.name, null, "zone", { victimTeam: b.team, victimIsBot: true, victimId: b.id }); }
  }
});
await page.waitForFunction(() => !document.getElementById("to-aar")?.hidden, null, { timeout: 30000 }).catch(() => {});
await sleep(800);
const aar = await page.evaluate(() => {
  const el = document.getElementById("to-aar");
  return { title: el.querySelector(".to-aar-result")?.textContent, score: el.querySelector(".to-aar-score")?.textContent,
    head: el.querySelector(".to-aar-squad-head")?.textContent, rows: [...el.querySelectorAll(".to-aar-squad-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim()) };
});
console.log(JSON.stringify(aar));
check(/team wins/.test(aar.title || "") && /kills · your team \d+/.test(aar.score || ""), "the end: their team wins; our kills and our team's", JSON.stringify({ title: aar.title, score: aar.score }));
check(/5th of 5 teams/.test(aar.head || "") && aar.rows.length === 2 && aar.rows.every((r) => /Out/.test(r)), "the Summary's team card: 5th of 5 teams, both of us out", JSON.stringify({ head: aar.head, rows: aar.rows }));
await page.locator("#to-aar").screenshot({ path: path.join(SHOTS, "royale-squad-aar.png") });
check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
console.log(`shots: ${SHOTS}`);
await browser.close(); server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
