// Troll Forces Tactical Nuke, phases 1 and 2 (user, 2026-10-17).
// Two tabs in one PRIVATE room (Supabase is blocked; never a public room),
// no bots:
//   - 25 kills without dying banks it in TDM: the HUD row shows, nothing in
//     the streak slots changes;
//   - N raises the handheld; the key goes down about 1.6 s in and the nuke
//     is ARMED and spent;
//   - the other tab gets the same countdown (banner, "from <caller>", 10..1)
//     and the sky tints; the score limit waits;
//   - phase 2: the missile before zero; at zero everyone is down, the HUD
//     goes and the nuke cameras take over; 12 s on, the end screen on both
//     tabs with the caller side as the winner, the sky back;
//   - a second 25 banks nothing;
//   - FFA banks it too; Domination never does.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-nuke-test.mjs [outDir]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
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
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const STATE = "/assets/games/troll-ops/core/state.js?v=st1";
// The game's own instance: whatever tag the game imports it under today.
const NUKE = "/assets/games/troll-ops/streaks/nuke.js?v=" + fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/combat/scoring.js"), "utf8").match(/streaks\/nuke\.js\?v=([a-z0-9-]+)/)[1];
const SKY = "/assets/games/troll-ops/view/sky.js?v=sr1";

async function open(room, mode) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  await page.evaluate(async ({ room, mode }) => {
    const T = window.__trollOps;
    T.setMode(mode);
    T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    T.loadout.versusMapId = "grinsite";
    await T.startGame();
  }, { room, mode });
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
  await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); T.settings.invincible = true; });
  return page;
}
/* Kill a made-up enemy with the streak at `before`, so this kill makes it before + 1. */
const killAt = (page, before) => page.evaluate(async ({ u, before }) => {
  const { game } = await import(u);
  const T = window.__trollOps;
  game.player.streak = before;
  const enemy = T.net.team === "phantom" ? "ghost" : "phantom";
  T.registerDeath("Dummy", T.net.id, "pistol", { victimId: "dummy" + before, victimTeam: enemy });
  return game.player.streak;
}, { u: STATE, before });
const state = (page) => page.evaluate(async ({ n, s, st }) => {
  const { nuke, nukeLeft } = await import(n);
  const { skyMat } = await import(s);
  const { game } = await import(st);
  const row = document.querySelector(".to-nuke-ready");
  const ov = document.querySelector(".to-nuke");
  return {
    ready: nuke.ready, used: nuke.used, calling: nuke.calling, inbound: !!nuke.inbound, mine: !!nuke.inbound?.mine,
    left: nukeLeft(), row: !!row && !row.hidden, rowText: row?.textContent || "",
    overlay: !!ov && !ov.hidden, from: ov?.querySelector(".to-nuke-banner span")?.textContent || "",
    count: ov?.querySelector(".to-nuke-count")?.textContent || "",
    sky: skyMat.uniforms.uTop.value.getHexString(), holding: game.player.holding, kind: game.streakDeviceKind,
  };
}, { n: NUKE, s: SKY, st: STATE });

// ---- TDM, two tabs
const ROOM = "NK" + String(Math.floor(Math.random() * 900 + 100));
const a = await open(ROOM, "tdm");
const b = await open(ROOM, "tdm");
await sleep(2500);

await killAt(a, 23);
check(!(await state(a)).ready, "24 kills is not enough");
const slotsBefore = await a.evaluate(() => document.getElementById("to-ss-slots")?.children.length || 0);
const streak = await killAt(a, 24);
let s = await state(a);
check(streak === 25 && s.ready && s.row && /TACTICAL NUKE/.test(s.rowText), "25 without dying banks the nuke and shows the row", JSON.stringify({ streak, ready: s.ready, row: s.row, text: s.rowText }));
const slotsAfter = await a.evaluate(() => document.getElementById("to-ss-slots")?.children.length || 0);
check(slotsAfter === slotsBefore, "the streak slots don't change", `${slotsBefore} -> ${slotsAfter}`);
if (OUT) await a.screenshot({ path: path.join(OUT, "nuke-ready.png") });

const skyBase = s.sky;
await a.bringToFront();
await a.keyboard.press("KeyN");
await sleep(150);
s = await state(a);
if (!s.calling) {
  // Headless pointer lock can swallow the key; the call itself is what's tested.
  console.log("note: N did not reach the game headless, calling callNuke()");
  await a.evaluate(async (n) => (await import(n)).callNuke(), NUKE);
  await sleep(100);
  s = await state(a);
}
check(s.calling && s.holding === "streak" && s.kind === "nuke", "N raises the handheld", JSON.stringify({ calling: s.calling, holding: s.holding, kind: s.kind }));
await sleep(1050);
if (OUT) await a.screenshot({ path: path.join(OUT, "nuke-handheld-cover.png") });
s = await state(a);
check(s.calling && !s.inbound, "not armed before the key goes down", JSON.stringify({ calling: s.calling, inbound: s.inbound }));
// The hold runs on game time; two headless WebGL tabs can run it slower than
// the wall clock, so wait for the key rather than a fixed sleep.
for (let i = 0; i < 40 && !(s = await state(a)).inbound; i++) await sleep(100);

check(s.inbound && s.mine && !s.ready && s.used, "the key arms it and spends it", JSON.stringify({ inbound: s.inbound, mine: s.mine, ready: s.ready, used: s.used }));
if (OUT) await a.screenshot({ path: path.join(OUT, "nuke-armed.png") });

await sleep(1200);
const sb = await state(b);
const name = await a.evaluate(() => window.__trollOps.net.name);
check(sb.overlay && sb.inbound && !sb.mine, "the other tab gets the countdown", JSON.stringify({ overlay: sb.overlay, inbound: sb.inbound }));
check(sb.from === `from ${name}`, "the banner names the caller", `"${sb.from}" vs ${name}`);
check(+sb.count >= 7 && +sb.count <= 10, "the other tab counts from ten", `count=${sb.count}`);
const sa = await state(a);
check(Math.abs((sa.left ?? 99) - (sb.left ?? -99)) < 1.0, "both clocks agree within a second", `${sa.left?.toFixed(2)} vs ${sb.left?.toFixed(2)}`);
await sleep(3000);
const mid = await state(b);
check(mid.sky !== skyBase, "the sky tints during the countdown", `${skyBase} -> ${mid.sky}`);
if (OUT) await b.screenshot({ path: path.join(OUT, "nuke-countdown.png") });
const stillPlaying = await b.evaluate(() => window.__trollOps.state());
check(stillPlaying === "playing", "the match keeps going through the countdown");

// A second 25 while it's inbound banks nothing (one per match).
await killAt(a, 24);
check(!(await state(a)).ready, "a second 25 banks nothing");
// The score limit can't end it while the nuke is inbound.
const lim = await a.evaluate(async (u) => {
  const T = window.__trollOps;
  const t = T.net.team || "phantom";
  T.teamScores[t] = 68;
  const enemy = t === "phantom" ? "ghost" : "phantom";
  T.registerDeath("Dummy", T.net.id, "pistol", { victimId: "lim", victimTeam: enemy });
  return { score: T.teamScores[t], state: T.state() };
}, STATE);
check(lim.state === "playing", "the score limit waits for the nuke", JSON.stringify(lim));
// Spy on the result each tab files at the end (won or not).
for (const p of [a, b]) await p.evaluate(() => {
  const acc = window.TrollrunnerAccounts || (window.TrollrunnerAccounts = {});
  const orig = acc.reportGameResult;
  acc.reportGameResult = (g, s, o) => { window.__nukeResult = o; return orig?.(g, s, o); };
});

const leftNow = (await state(a)).left;
await sleep(Math.max(0, (leftNow - 1.8) * 1000));
const missile = await a.evaluate(async (n) => {
  const { nuke } = await import(n);
  return { blast: !!nuke.inbound?.blast, missile: !!nuke.inbound?.blast?.missile?.visible };
}, NUKE);
check(missile.blast && missile.missile, "the missile is in the air before zero", JSON.stringify(missile));
if (OUT) await a.screenshot({ path: path.join(OUT, "nuke-missile.png") });

const waitT = async (page, t) => {
  for (let i = 0; i < 200; i++) {
    const s = await state(page);
    if (s.left != null && -s.left >= t) return true;
    if (s.left == null) return false;
    await sleep(100);
  }
  return false;
};
await waitT(a, 1);
const zero = await Promise.all([a, b].map((p) => p.evaluate(async ({ n, u }) => {
  const { nuke, nukeCineOn } = await import(n);
  const { game } = await import(u);
  return {
    gone: !!nuke.inbound?.gone, cine: nukeCineOn(), alive: game.player.alive, hud: !document.getElementById("to-hud").hidden,
    frozen: !!game.bots?.frozen, respawnShown: !document.getElementById("to-respawn")?.hidden, state: window.__trollOps.state(),
    overlay: !document.querySelector(".to-nuke")?.hidden,
  };
}, { n: NUKE, u: STATE })));
for (const [i, z] of zero.entries()) {
  const tab = i ? "B" : "A";
  check(z.gone && z.cine && !z.alive && !z.hud && z.frozen && !z.respawnShown && !z.overlay, `tab ${tab}: at zero everyone is down, the HUD goes, the cameras take over`, JSON.stringify(z));
  check(z.state === "playing", `tab ${tab}: the match is still on through the blast`);
}
if (OUT) {
  await waitT(a, 2); await a.screenshot({ path: path.join(OUT, "nuke-t2.png") });
  await waitT(a, 5); await a.screenshot({ path: path.join(OUT, "nuke-t5.png") });
  await waitT(b, 6); await b.screenshot({ path: path.join(OUT, "nuke-t6-other.png") });
  await waitT(a, 9); await a.screenshot({ path: path.join(OUT, "nuke-t9.png") });
}
const respawned = await a.evaluate(async (u) => (await import(u)).game.player.alive, STATE);
check(!respawned, "nobody respawns during the blast");

// The end screen at +12, the caller's side the winner.
for (let i = 0; i < 160; i++) {
  const st = await Promise.all([a, b].map((p) => p.evaluate(() => window.__trollOps.state())));
  if (st.every((s) => s !== "playing")) break;
  await sleep(100);
}
const ends = await Promise.all([a, b].map((p) => p.evaluate(async ({ n, s }) => {
  const { nuke } = await import(n);
  const { skyMat } = await import(s);
  return {
    state: window.__trollOps.state(), title: document.getElementById("to-go-title")?.textContent || "",
    won: window.__nukeResult?.won ?? null, team: window.__trollOps.net.team, inbound: !!nuke.inbound,
    sky: skyMat.uniforms.uTop.value.getHexString(), white: document.querySelector(".to-nuke-white")?.hidden ?? true,
  };
}, { n: NUKE, s: SKY })));
const [ea, eb] = ends;
check(ea.state !== "playing" && eb.state !== "playing", "the match ends after the blast on both tabs", JSON.stringify({ a: ea.state, b: eb.state }));
check(ea.title === "You went nuclear", "the caller's end screen", ea.title);
check(eb.title === `${name} went nuclear`, "the other tab's end screen names the caller", eb.title);
check(ea.won === true, "the caller wins", JSON.stringify(ea.won));
check(eb.won === (eb.team === ea.team), "the other tab's result follows the caller's side", JSON.stringify({ won: eb.won, teams: [ea.team, eb.team] }));
check(!ea.inbound && !eb.inbound && ea.white && eb.white, "the blast is cleaned up");
check(eb.sky === skyBase, "the sky comes back", `${eb.sky} vs ${skyBase}`);
if (OUT) await b.screenshot({ path: path.join(OUT, "nuke-end.png") });
await a.close(); await b.close();

// ---- FFA banks it, Domination doesn't
const f = await open("NF" + String(Math.floor(Math.random() * 900 + 100)), "ffa");
await killAt(f, 24);
check((await state(f)).ready, "FFA banks it too");
await f.close();
const d = await open("ND" + String(Math.floor(Math.random() * 900 + 100)), "dom");
await killAt(d, 24);
check(!(await state(d)).ready, "Domination never banks it");
await d.close();

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
