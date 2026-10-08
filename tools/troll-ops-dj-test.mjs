// Trolling Loud's DJ Lulz (dj-lulz.js), in Socialize, with two players.
//
//   1. A (in first, so the queue's keeper) and B hang out on Trolling Loud:
//      DJ Lulz starts a record, both hear it at the same place, and the
//      club's clock runs on its beat grid (the BPM is the record's).
//   2. B walks to the booth: hold X offers a request; the panel opens
//      without the pause menu. B asks for a song: PENDING for both, then
//      QUEUED. A second ask from B, or A asking for the same song, is
//      turned down.
//   3. The DJ's own pick mixes out and B's request plays, for both.
//   4. Shots (SHOTS=1): the panel, the now-playing chip, the dance floor.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-dj-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const size = fs.statSync(p).size, type = TYPES[path.extname(p)] || "application/octet-stream";
  // <audio> seeks with ranges
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (m) {
    const a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : size - 1;
    res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${a}-${b}/${size}`, "content-length": b - a + 1 });
    return fs.createReadStream(p, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": size });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

async function open(label, username) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript((name) => {
    const fake = { getCachedProfile: () => ({ username: name, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  }, username);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 240000 });
  await page.evaluate(() => window.__trollOps.setLoadWaitMax?.(8));
  return page;
}
async function joinClub(page) {
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("social");
    T.loadout.mapId = "trollingloud";
    await T.startGame();
  });
  await page.waitForFunction(() => { const T = window.__trollOps; return !T.loadState().open && T.social().gameState === "playing"; }, null, { timeout: 240000 });
  // Past the door's line already (modes/club-entry.js), with a band on.
  await page.evaluate(() => window.__trollClub?.pass());
}
const dj = (page) => page.evaluate(() => window.__trollOps.djLulz.debug());
const lights = (page) => page.evaluate(() => window.__trollOps.builtMap().map.debug());
async function until(page, fn, ms, read = dj) {
  const t0 = Date.now();
  let v;
  while (Date.now() - t0 < ms) { v = await read(page); if (fn(v)) return v; await sleep(250); }
  return v;
}
/* A spot in the club: the feet (move.pos), never player.pos. */
const stand = (page, x, z, yaw = 0) => page.evaluate(([x, z, yaw]) => {
  const T = window.__trollOps;
  T.move.pos.set(x, 0.3, z); T.move.velocity?.set?.(0, 0, 0);
  T.look.yaw = yaw; T.look.pitch = -0.05;
}, [x, z, yaw]);

const A = await open("A", "troll_runner");
await joinClub(A);
await sleep(2500);
const B = await open("B", "dance_floor_dan");
await joinClub(B);
await stand(A, 3, 4); await stand(B, -3, 4);

/* ---------------------------------------------------------------- 1 */
console.log("--- the record");
const map = await B.evaluate(() => window.__trollOps.social().map);
check(map === "trollingloud", "B is in the club", map);
const a1 = await until(A, (d) => d.st.now && !d.paused, 20000);
check(a1.isKeeper && a1.st.now, "A (in first) keeps the queue and DJ Lulz starts a record", JSON.stringify({ keeper: a1.keeper, now: a1.st.now }));
const b1 = await until(B, (d) => d.st.now && d.st.now.t === a1.st.now.t && !d.paused, 20000);
check(!b1.isKeeper && b1.keeper === a1.keeper, "B agrees who keeps it", `${b1.keeper}`);
check(b1.st.now?.t === a1.st.now.t, "both hear the same record", `${a1.st.now.t} / ${b1.st.now?.t}`);
check(!a1.paused && !b1.paused && a1.graph, "the record plays (through the booth's chain)", JSON.stringify({ a: a1.paused, b: b1.paused, graph: a1.graph }));
// the same place in it, read at once in both
const [ta, tb] = await Promise.all([A.evaluate(() => window.__trollOps.djLulz.song()?.t), B.evaluate(() => window.__trollOps.djLulz.song()?.t)]);
check(Math.abs(ta - tb) < 0.6, "both are at the same place in it", `${ta?.toFixed(2)} vs ${tb?.toFixed(2)}`);
const L = await until(A, (d) => d.song, 5000, lights);
const grid = await A.evaluate(async (src) => (await import("/assets/games/troll-ops/music-beats.js?v=bg1")).BEATS[src], (await A.evaluate(() => window.__trollOps.djLulz.song().src)));
check(L.song && Math.abs(L.song.bpm - grid.bpm) < 0.01, "the club's clock runs on the record's beat grid", `${L.song?.bpm} BPM`);
check(L.want === 0, "the club's own synth track is off under the DJ", `want ${L.want}`);
// the beat lands on the grid: sample the kick across a second, its peaks a beat apart
const peaks = await A.evaluate(async () => {
  const M = window.__trollOps.builtMap().map, frame = () => new Promise((r) => requestAnimationFrame(r));
  const out = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 2500) { await frame(); const d = M.debug(); out.push([performance.now(), d.kick, d.beat]); }
  return out;
});
const beatSpan = peaks.at(-1)[2] - peaks[0][2], secs = (peaks.at(-1)[0] - peaks[0][0]) / 1000;
check(Math.abs(beatSpan / secs * 60 - grid.bpm) < grid.bpm * 0.06, "the beat advances at the record's tempo", `${(beatSpan / secs * 60).toFixed(1)} vs ${grid.bpm}`);
check(Math.max(...peaks.map((p) => p[1])) > 0.2, "the floor kicks", `max ${Math.max(...peaks.map((p) => p[1])).toFixed(2)}`);

/* ---------------------------------------------------------------- 2 */
console.log("--- a request");
const far = await B.evaluate(() => !!window.__trollOps.djLulz.action(window.__trollOps.move.pos));
check(!far, "no request prompt on the dance floor");
await stand(B, 0, -12.6, 0);
await sleep(300);
const act = await B.evaluate(() => window.__trollOps.djLulz.action(window.__trollOps.move.pos)?.label);
check(/DJ Lulz/.test(act || ""), "at the booth hold X offers a request", act);
// the prompt the game actually shows (barAction -> pickup prompt)
const prompt = await until(B, (t) => /DJ Lulz/.test(t || ""), 4000, (p) => p.evaluate(() => {
  const e = document.getElementById("to-pickup-prompt"); return e && !e.hidden ? e.textContent : null;
}));
check(/DJ Lulz/.test(prompt || ""), "the game's hold-X prompt names it", (prompt || "").trim().replace(/\s+/g, " "));
await B.evaluate(() => window.__trollOps.djLulz.open());
await sleep(500);
const ui = await B.evaluate(() => ({
  open: !document.querySelector(".to-dj-panel").hidden, pause: document.getElementById("to-pause").hidden,
  crate: document.querySelectorAll(".to-dj-crate button").length, now: document.querySelector(".to-dj-now-t").textContent,
}));
check(ui.open && ui.pause, "the panel opens, the pause menu doesn't", JSON.stringify(ui));
check(ui.crate === 4 && ui.now.length > 0, "it shows the record and the crate", JSON.stringify(ui));
const nowT = (await dj(B)).st.now.t;
const want = [0, 1, 2, 3].find((i) => i !== nowT);
await B.evaluate((i) => document.querySelector(`.to-dj-crate button[data-t="${i}"]`).click(), want);
const pend = await until(A, (d) => d.st.q.length === 1, 5000);
check(pend.st.q[0]?.t === want && !pend.st.q[0].ok, "it reaches the keeper as PENDING", JSON.stringify(pend.st.q));
const pendB = await until(B, () => true, 1500, (p) => p.evaluate(() => document.querySelector(".to-dj-queue .to-dj-pill")?.textContent || ""));
check(/pending|sending/i.test(pendB), "B's panel shows it pending", pendB);
const q = await until(B, (d) => d.st.q[0]?.ok, 8000);
check(q.st.q[0]?.ok === 1, "then QUEUED, for B too", JSON.stringify(q.st.q));
await sleep(1200);
const pill = await B.evaluate(() => document.querySelector(".to-dj-queue .to-dj-pill")?.textContent || "");
check(/queued/i.test(pill), "the panel's pill says queued", pill);
const again = await B.evaluate((i) => { const T = window.__trollOps.djLulz; return T.blockReason([0, 1, 2, 3].find((k) => k !== i && k !== T.debug().st.now.t)); }, want);
check(/in line/i.test(again || ""), "B can't queue a second one", again);
await A.evaluate((i) => window.__trollOps.djLulz.request(i), want);
await sleep(1500);
const aq = await dj(A);
check(aq.st.q.length === 1, "A asking for the same song is turned down", `${aq.st.q.length} in line`);
if (SHOTS) await B.screenshot({ path: path.join(SHOTS, "panel.png") });
const chip = await B.evaluate(() => { const c = document.querySelector(".to-dj-chip"); return { hidden: c.hidden, text: c.textContent.replace(/\s+/g, " ").trim() }; });
check(!chip.hidden && /now spinning/i.test(chip.text), "the now-playing chip is up in the club", chip.text);
await B.evaluate(() => window.__trollOps.djLulz.close(true));

/* ---------------------------------------------------------------- 3 */
console.log("--- B's request plays");
const mix = await dj(A);
// (a slow box can reach the pick's end, or the mix, before this line)
const already = mix.st.now?.rid && mix.st.now.t === want;
check(already || (mix.st.now.pid === null && Number.isFinite(mix.st.now.end)), "the DJ's own pick is set to mix out", JSON.stringify(mix.st.now));
const wait = already ? 0 : Math.max(0, (mix.st.now.end ?? 0) - (Date.now() + mix.skew)) + 6000;
console.log(`   (waiting ${(wait / 1000).toFixed(0)} s for the mix)`);
const played = await until(B, (d) => d.st.now?.t === want && !d.paused, wait + 10000);
check(played.st.now?.t === want && played.st.now.pid, "B's request is on", JSON.stringify(played.st.now));
const aPlay = await until(A, (d) => d.st.now?.t === want && !d.paused, 6000);
check(aPlay.st.now?.t === want, "A hears it too");
check(played.st.q.length === 0, "the queue is empty again");

/* ---------------------------------------------------------------- 4 */
if (SHOTS) {
  await stand(B, 0, 6.5, 0);
  await B.evaluate(() => { window.__trollOps.look.pitch = -0.62; });
  await sleep(4000);   // past the record's first bars
  for (let i = 0; i < 8; i++) { await B.screenshot({ path: path.join(SHOTS, `floor-${i}.png`) }); await sleep(120); }
  await stand(B, 0, -9.5, 0);
  await B.evaluate(() => { window.__trollOps.look.pitch = 0.05; });
  await sleep(400);
  await B.screenshot({ path: path.join(SHOTS, "booth.png") });
}

check(errors.length === 0, "no page errors", errors.slice(0, 4).join(" | "));
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
