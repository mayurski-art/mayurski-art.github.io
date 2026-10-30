// Troll Royale in teams, phase 3 (modes/royale-down.js): down, not out.
// Mini Royale as Duos (a fixture: 10 trolls, private room, Supabase
// blocked), our teammate a bot, the bots standing still:
//   1. our teammate at 0: down (the room sees dn 1), the panel says Down;
//      beside them, Hold X; 5 s on X picks them up. Us at 0 with them up:
//      down, bleeding, the trigger dead; they come and pick us up at 30.
//      Down again with nobody near: bled out, the team still in it.
//   2. down, then finished off by enemy fire.
//   3. our teammate down, then us: the whole team out.
// SHOTS_DIR=<dir> keeps the shots.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-royale-down-test.mjs
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
const DOWN_URL = "/assets/games/troll-ops/" + src("modes/royale.js").match(/\.\/royale-down\.js\?v=[\w-]+/)[0].slice(2).replace(/^/, "modes/");
const S = (p) => p.evaluate(async (url) => {
  const T = window.__trollOps, { royaleDownState } = await import(url), d = royaleDownState();
  const mate = T.bots.bots.find((b) => b.team === T.net.team);
  const hud = document.querySelector(".to-down-hud");
  return { alive: T.player.alive, downed: !!T.player.downed, hp: Math.round(T.player.hp), t: d.t, dhp: d.hp,
    hud: hud && !hud.hidden ? hud.textContent : "", mate: mate && { alive: mate.alive, downed: !!mate.downed, hp: Math.round(mate.hp) },
    peerDown: mate ? T.remotes.byId.get(mate.id)?.peer.downed : null,
    row: document.querySelector(".to-team-row small")?.textContent, rowDown: !!document.querySelector(".to-team-row.is-down"),
    out: document.getElementById("to-spectate")?.textContent.replace(/\s+/g, " ") };
}, DOWN_URL);
const enemyHit = (p, n) => p.evaluate((n) => { const T = window.__trollOps; T.player.spawnGuard = 0; const k = T.bots.bots.find((b) => b.alive && b.team !== T.net.team); T.damagePlayer(n, k.id, "sixtynine", false, k.pos); }, n);
const mateBy = (p, dist) => p.evaluate((dist) => {
  const T = window.__trollOps, b = T.bots.bots.find((x) => x.team === T.net.team);
  b.pos.x = T.move.pos.x + dist; b.pos.z = T.move.pos.z; b.pos.y = T.move.pos.y; b.seenId = null;
}, dist);
const downMate = (p) => p.evaluate(() => { const T = window.__trollOps, b = T.bots.bots.find((x) => x.team === T.net.team); return T.bots.applyHit(b.id, 999, { pierce: true }); });

// ---- match 1: we pick our teammate up; they pick us up; we bleed out --------
let page = await startDuos();
await mateBy(page, 1.2);
const hit = await downMate(page);
await sleep(700);
let s = await S(page);
check(!hit.killed && hit.downed && s.mate.alive && s.mate.downed && s.peerDown === 1, "our teammate at 0: down, not out, and the room sees it", JSON.stringify({ hit: { killed: hit.killed, downed: hit.downed }, mate: s.mate, peer: s.peerDown }));
check(s.row === "Down" && s.rowDown, "the team panel says Down", JSON.stringify({ row: s.row }));
check(/Hold X — pick up/.test(s.hud), "beside them: Hold X to pick them up", s.hud);
await page.screenshot({ path: path.join(SHOTS, "royale-down-revive-prompt.png") });
await page.keyboard.down("KeyX");
await sleep(2500);
s = await S(page);
check(/Picking up .* — \d+%/.test(s.hud) && s.mate.downed, "holding X: the pick-up fills", s.hud);
await page.screenshot({ path: path.join(SHOTS, "royale-down-reviving.png") });
await sleep(3200);
await page.keyboard.up("KeyX");
s = await S(page);
check(s.mate.alive && !s.mate.downed && s.mate.hp >= 30, "5 s on X: they're back up", JSON.stringify(s.mate));
// now us: down while they're up
await enemyHit(page, 150);
await sleep(400);
s = await S(page);
check(s.alive && s.downed && s.hp === 0 && /^Down — \d+ s/.test(s.hud), "us at 0 with our teammate up: down, bleeding", JSON.stringify({ alive: s.alive, downed: s.downed, hud: s.hud }));
const ammo0 = await page.evaluate(() => window.__trollOps.currentWeapon()?.ammoInMag);
await page.mouse.down(); await sleep(600); await page.mouse.up();
const ammo1 = await page.evaluate(() => window.__trollOps.currentWeapon()?.ammoInMag);
await page.keyboard.press("Digit3");
const held = await page.evaluate(() => window.__trollOps.player.holding);
check(ammo0 === ammo1 && held === "none", "down: hands empty, the trigger and the melee key do nothing", JSON.stringify({ ammo0, ammo1, held }));
await page.screenshot({ path: path.join(SHOTS, "royale-down-me.png") });
// the bot comes and gets us
await mateBy(page, 1.0);
await page.evaluate(async (url) => { const T = window.__trollOps, { botReviveGoal } = await import(url.replace("royale-down", "royale-down")); const b = T.bots.bots.find((x) => x.team === T.net.team); botReviveGoal(b); }, DOWN_URL);
await sleep(5800);
s = await S(page);
const dbg = await page.evaluate(() => { const T = window.__trollOps, b = T.bots.bots.find((x) => x.team === T.net.team); return { reviving: b.reviving, reviveT: b.reviveT, seen: b.seenId, d: Math.hypot(b.pos.x - T.move.pos.x, b.pos.z - T.move.pos.z), host: T.net.isBotHost() }; });
const up = await page.evaluate(() => window.__trollOps.player.holding);
check(s.alive && !s.downed && s.hp >= 30 && up === "gun", "our teammate (a bot) picks us up: 30 health, the gun back", JSON.stringify({ downed: s.downed, hp: s.hp, up, dbg }));
// down again, and nobody comes: out
await page.evaluate(async (url) => { (await import(url)).DOWN.bleed = 2; }, DOWN_URL);
await page.evaluate(() => { const T = window.__trollOps, b = T.bots.bots.find((x) => x.team === T.net.team); b.pos.x += 40; b.reviving = null; });
await enemyHit(page, 100);
await page.waitForFunction(() => /Eliminated/.test(document.getElementById("to-spectate")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
await sleep(300);
s = await S(page);
check(!s.alive && !s.downed && /your team is still in it/.test(s.out || ""), "bled out: out, the team still in it", JSON.stringify({ alive: s.alive, out: s.out }));
await page.close();

// ---- match 2: down, then finished off by enemy fire ---------------------------
page = await startDuos();
await enemyHit(page, 150);
await sleep(300);
s = await S(page);
check(s.downed, "down again (a new match)", JSON.stringify({ downed: s.downed }));
await enemyHit(page, 60);
s = await S(page);
check(s.alive && s.downed, "60 while down: still down", JSON.stringify({ alive: s.alive, downed: s.downed }));
await enemyHit(page, 60);
await sleep(300);
s = await S(page);
check(!s.alive && !s.downed, "another 60: finished off", JSON.stringify({ alive: s.alive }));
await page.close();

// ---- match 3: the whole team down is the whole team out -------------------------
page = await startDuos();
await downMate(page);
await sleep(300);
await enemyHit(page, 150);
await sleep(800);
s = await S(page);
check(!s.alive && !s.downed && s.mate && !s.mate.alive, "teammate down, then us: nobody left to come, both out", JSON.stringify({ alive: s.alive, mate: s.mate }));
check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
console.log(`shots: ${SHOTS}`);
await browser.close(); server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
