// Troll Royale in teams, phase 1 (modes/royale-squads.js; docs/ROYALE-SQUADS.md):
//   menu: the Royale card's Solo / Duo / Trio / Squad, the pick played and
//         kept, the mode list still ticking Troll Royale; a party of three
//         starts at Trio with Solo and Duo off;
//   match (Mini Royale as Duos, 10 trolls: a fixture, private room, Supabase
//         blocked): our side is our squad, one bot fills our empty seat and
//         the other eight make four bot duos; our teammate is off our
//         hitboxes and on our side for the bots; down with the teammate up,
//         our place waits; the rest wiped, our team wins, us out or not.
//   then a second match: the two of us down with others standing, our place
//         is the team's.
// SHOTS_DIR=<dir> keeps the shots.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-royale-squads-test.mjs
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

// ---- the menu --------------------------------------------------------------
let page = await open();
await page.evaluate(() => { window.__toBo2.menu.backTo("main"); document.body.classList.add("tf-anim-off"); });
await page.evaluate(() => document.querySelector('#to-lo-mode [data-mode="royale"]').click());
await sleep(400);
const card = () => page.evaluate(() => {
  const el = document.querySelector(".to-fn-size");
  return { shown: !!el && !el.hidden && el.offsetHeight > 0, mode: window.__trollOps.modeId(),
    tick: document.querySelector("#to-lo-mode .to-lo-modebtn.is-active")?.dataset.mode,
    btns: [...(el?.querySelectorAll("button") || [])].map((b) => ({ t: b.textContent, on: b.classList.contains("is-on"), off: b.disabled })) };
});
let c = await card();
check(c.shown && c.btns.map((b) => b.t).join() === "Solo,Duo,Trio,Squad" && c.btns[0].on && c.mode === "royale", "Royale: Solo / Duo / Trio / Squad on the card, Solo picked", JSON.stringify(c));
await page.evaluate(() => document.querySelector('.to-fn-size [data-n="2"]').click());
await sleep(200);
c = await card();
check(c.mode === "royale_duo" && c.btns[1].on && c.tick === "royale", "Duo: Royale in teams of two, the mode list still on Troll Royale", JSON.stringify({ mode: c.mode, tick: c.tick }));
const kept = await page.evaluate(() => localStorage.getItem("trollops:royale-size"));
check(kept === "2", "the size is kept for next time", kept);
await page.evaluate(() => document.querySelector('#to-lo-mode [data-mode="tdm"]').click());
await page.evaluate(() => document.querySelector('#to-lo-mode [data-mode="royale"]').click());
c = await card();
check(c.mode === "royale_duo", "back to Royale: Duo again", c.mode);
await page.locator(".to-fn-play").screenshot({ path: path.join(SHOTS, "royale-squads-card.png") });
const clear = await page.evaluate(() => { const n = document.querySelector(".to-fn-news").getBoundingClientRect(), p = document.querySelector(".to-bo2-party")?.getBoundingClientRect(); return { news: n.top | 0, party: p ? p.bottom | 0 : 0 }; });
check(clear.news >= clear.party, "desktop: the news over the card stays clear of the party panel", JSON.stringify(clear));
// a party of three: Trio at least
await page.evaluate(async () => { const { room } = await import("/assets/games/troll-ops/core/state.js?v=st1"); room.__size = room.partySize; room.partySize = () => 3; dispatchEvent(new CustomEvent("trollforces:party")); });
await sleep(300);
c = await card();
check(c.mode === "royale_trio" && c.btns[0].off && c.btns[1].off && !c.btns[2].off && c.btns[2].on, "a party of three: Trio, Solo and Duo off", JSON.stringify(c.btns));
await page.locator(".to-fn-play").screenshot({ path: path.join(SHOTS, "royale-squads-card-party3.png") });
await page.setViewportSize({ width: 390, height: 844 });
await sleep(800);
const phone = await page.evaluate(() => {
  const el = document.querySelector(".to-fn-size"), r = el.getBoundingClientRect();
  const btn = [...el.querySelectorAll("button")].map((b) => { const q = b.getBoundingClientRect(); return { w: q.width, h: q.height, fits: b.scrollWidth <= b.clientWidth + 1 }; });
  const nav = document.querySelector(".to-squad-nav:not([hidden])")?.getBoundingClientRect(), card = document.querySelector(".to-fn-play").getBoundingClientRect();
  return { inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, btn, navClear: !nav || nav.bottom <= card.top };
});
check(phone.inView && phone.navClear && phone.btn.every((b) => b.h >= 32 && b.fits), "phone: the row on screen, labels fit, buttons tall enough to tap, the squad name clear of the card", JSON.stringify(phone));
await page.screenshot({ path: path.join(SHOTS, "royale-squads-phone.png") });
await page.evaluate(async () => { const { room } = await import("/assets/games/troll-ops/core/state.js?v=st1"); room.partySize = room.__size; dispatchEvent(new CustomEvent("trollforces:party")); });
await page.close();

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
    const { killed } = T.bots.applyHit(b.id, 999, { pierce: true });
    if (killed) { T.net.reportDeathAs(b.id, null, "zone", false); T.registerDeath(b.name, null, "zone", { victimTeam: b.team, victimIsBot: true, victimId: b.id }); }
  }
}, pick);
const meDown = (p) => p.evaluate(() => { const T = window.__trollOps; T.player.spawnGuard = 0; const k = T.bots.bots.find((b) => b.alive && b.team !== T.net.team); T.damagePlayer(999, k.id, "sixtynine", false, k.pos); });

page = await startDuos();
const s = await page.evaluate(() => {
  const T = window.__trollOps, mine = T.net.team, by = {};
  for (const b of T.bots.bots) by[b.team] = (by[b.team] || 0) + 1;
  const mate = T.bots.bots.find((b) => b.team === mine);
  const meshes = (team) => T.remotes.hitMeshes(team).length;
  const occ = T.occupants().find((o) => o.id === T.net.id);
  return { mine, by, bots: T.bots.count, mate: mate?.id, inRemotes: !!(mate && T.remotes.byId.get(mate.id)),
    allMeshes: meshes(null), ourMeshes: meshes(mine), mateMeshes: mate && T.remotes.byId.get(mate.id)?.hitMeshes().length,
    meTeam: occ?.team, alive: T.royaleAliveList().map((a) => a.team) };
});
console.log(JSON.stringify(s));
check(/^s[0-9a-z]+$/.test(s.mine || ""), "our side is our squad's id", s.mine);
check(s.bots === 9 && s.by[s.mine] === 1 && ["b0", "b1", "b2", "b3"].every((t) => s.by[t] === 2), "one bot in our empty seat, the other eight in four bot duos", JSON.stringify(s.by));
check(s.inRemotes && s.mateMeshes > 0 && s.allMeshes - s.ourMeshes === s.mateMeshes, "our teammate is off our hitboxes (and only them)", JSON.stringify({ all: s.allMeshes, ours: s.ourMeshes, mate: s.mateMeshes }));
check(s.meTeam === s.mine && s.alive.filter((t) => t === s.mine).length === 2, "to the bots we're on our teammate's side; the alive list knows the teams", JSON.stringify(s.alive));
await meDown(page);
await page.waitForFunction(() => window.__trollOps.royaleSpectating?.(), null, { timeout: 30000 }).catch(() => {});
await sleep(600);
const down = await page.evaluate(() => ({ alive: window.__trollOps.player.alive, place: window.__trollOps.royale().place, out: document.getElementById("to-spectate")?.textContent.replace(/\s+/g, " ") }));
check(!down.alive && down.place === 0 && /your team is still in it/.test(down.out || ""), "down with the teammate up: our place waits", JSON.stringify(down));
await killBot(page, "theirs");
await page.waitForFunction(() => !document.getElementById("to-aar")?.hidden, null, { timeout: 30000 }).catch(() => {});
await sleep(500);
const won = await page.evaluate(() => ({ title: document.querySelector("#to-aar .to-aar-title, #to-aar h1, #to-aar h2")?.textContent || document.getElementById("to-aar")?.textContent.slice(0, 160), place: window.__trollOps.royale()?.finalPlace }));
check(/Your team wins/.test(won.title || ""), "the rest wiped out: our team wins, us out or not", JSON.stringify(won));
await page.screenshot({ path: path.join(SHOTS, "royale-squads-won.png") });
await page.close();

page = await startDuos();
await meDown(page);
await sleep(400);
await killBot(page, "ours");
await page.waitForFunction(() => /Eliminated — d/.test(document.getElementById("to-spectate")?.textContent || ""), null, { timeout: 30000 }).catch(() => {});
await sleep(300);
const lost = await page.evaluate(() => {
  const T = window.__trollOps, r = T.royale();
  const teams = new Set(T.royaleAliveList().map((a) => a.team)).size;
  return { place: r.place, peak: r.peak, teams, over: r.over, out: document.getElementById("to-spectate")?.textContent.replace(/\s+/g, " ") };
});
check(lost.peak === 5 && lost.place === lost.teams + 1 && !lost.over && new RegExp(`Eliminated — ${lost.place}th of 5`).test(lost.out || ""), "the two of us down, four teams left: 5th of 5 teams, the match plays on", JSON.stringify(lost));
check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
console.log(`shots: ${SHOTS}`);
await browser.close(); server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
