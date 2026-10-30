// Troll Royale in teams, phase 2 (modes/royale-team-hud.js): where your team
// is. Mini Royale as Duos (a fixture: 10 trolls, private room, Supabase
// blocked), our teammate a bot:
//   - the team panel: their name and health, low health marked, Out;
//   - the marker over their head: on them in front of us, how far off,
//     held to the screen's edge when they're behind us, gone once out;
//   - the minimap draws them as a teammate;
//   - the panel and markers go with the match.
// SHOTS_DIR=<dir> keeps the shots.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-royale-team-hud-test.mjs
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
const mate = () => page.evaluate(() => { const T = window.__trollOps; const b = T.bots.bots.find((x) => x.team === T.net.team); return b && { id: b.id, name: b.name }; });
const m = await mate();
// put them `dist` m off at `ang` from where we look, at our height; the peer copy follows
const place = (dist, ang) => page.evaluate(([dist, ang]) => {
  const T = window.__trollOps, b = T.bots.bots.find((x) => x.team === T.net.team), yaw = T.look.yaw + ang;
  b.pos.x = T.move.pos.x - Math.sin(yaw) * dist; b.pos.z = T.move.pos.z - Math.cos(yaw) * dist; b.pos.y = T.move.pos.y;
}, [dist, ang]);
await place(8, 0);
await sleep(1500);
const hud = () => page.evaluate((id) => {
  const T = window.__trollOps, row = document.querySelector(".to-team-row"), mark = document.querySelector(".to-team-mark");
  const panel = document.querySelector(".to-team-panel"), r = mark?.getBoundingClientRect();
  const rp = T.remotes.byId.get(id), v = rp && new T.THREE.Vector3(rp.pos.x, rp.pos.y + (mark?.classList.contains("has-tag") ? 2.42 : 2.15), rp.pos.z).project(T.camera);
  return { panel: !!panel && !panel.hidden, rows: document.querySelectorAll(".to-team-row").length,
    name: row?.querySelector("b")?.textContent, hp: row?.querySelector("small")?.textContent, low: row?.classList.contains("is-low"), out: row?.classList.contains("is-out"),
    mark: !!mark && !mark.hidden, held: mark?.classList.contains("is-held"), dist: mark?.querySelector("small")?.textContent,
    mx: r && (r.left + r.right) / 2, my: r && r.top, px: v && (v.x + 1) / 2 * innerWidth, py: v && (1 - v.y) / 2 * innerHeight };
}, m.id);
let h = await hud();
console.log(JSON.stringify(h));
check(h.panel && h.rows === 1 && h.name === m.name && h.hp === "100" && !h.low, "the team panel: our teammate, full health", JSON.stringify({ name: h.name, hp: h.hp }));
check(h.mark && !h.held && Math.abs(h.mx - h.px) < 40 && /^[789] m$/.test(h.dist || ""), "the marker stands over them, 8 m off", JSON.stringify({ mx: h.mx, px: h.px, dist: h.dist }));
// their own name tag over their head: the marker stands clear of it
const clearOfTag = await page.evaluate((id) => {
  const T = window.__trollOps, rp = T.remotes.byId.get(id), r = document.querySelector(".to-team-mark").getBoundingClientRect();
  const top = new T.THREE.Vector3(rp.pos.x, rp.pos.y + 2.34, rp.pos.z).project(T.camera);
  return { tag: rp.tag.visible, markBottom: r.bottom | 0, tagTop: ((1 - top.y) / 2 * innerHeight) | 0 };
}, m.id);
check(!clearOfTag.tag || clearOfTag.markBottom <= clearOfTag.tagTop, "the marker clears their own name tag", JSON.stringify(clearOfTag));
await page.screenshot({ path: path.join(SHOTS, "royale-team-hud.png") });
await page.evaluate(() => { const T = window.__trollOps; T.bots.bots.find((x) => x.team === T.net.team).hp = 6; });
await sleep(400);
h = await hud();
check(+h.hp <= 30 && h.low, "hurt: their health drops in the panel, marked low", JSON.stringify({ hp: h.hp, low: h.low }));
await page.screenshot({ path: path.join(SHOTS, "royale-team-hud-low.png") });
await place(10, Math.PI);
await sleep(1500);
h = await hud();
check(h.mark && h.held && h.my > 600, "behind us: the marker held to the bottom edge", JSON.stringify({ held: h.held, my: h.my }));
// the minimap: a teammate dot (#7fd1e0) somewhere on it
const dots = await page.evaluate(() => {
  const c = window.__trollOps.minimapCanvas?.() || document.querySelector(".to-minimap canvas, canvas.to-minimap, #to-minimap");
  if (!c?.getContext) return -1;
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 0x7f) < 14 && Math.abs(d[i + 1] - 0xd1) < 14 && Math.abs(d[i + 2] - 0xe0) < 14) n++;
  return n;
});
check(dots > 4, "the minimap draws them as a teammate", String(dots));
await killBot(page, "ours");
await sleep(1200);
h = await hud();
check(h.out && h.hp === "Out" && !h.mark, "out: the panel says so, the marker goes", JSON.stringify({ out: h.out, hp: h.hp, mark: h.mark }));
await page.evaluate(() => window.__trollOps.endMatch("The Cringe wins"));
await sleep(600);
const gone = await page.evaluate(() => ({ panel: !document.querySelector(".to-team-panel") || document.querySelector(".to-team-panel").hidden, rows: document.querySelectorAll(".to-team-row").length }));
check(gone.panel && gone.rows === 0, "the match over: the panel and markers go", JSON.stringify(gone));
check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
console.log(`shots: ${SHOTS}`);
await browser.close(); server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
