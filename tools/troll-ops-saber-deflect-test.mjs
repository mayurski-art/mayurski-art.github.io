// Troll Forces Trollsaber deflects, Luke-in-The-Mandalorian style: the blade
// whips to meet each round (aimed at where it came from, not one of four
// fixed poses), flicks it away, and eases back; a round landing mid-parry
// chains from where the blade is instead of popping back to the guard; a
// burst swaps the blade side to side, or forehand/backhand from one side.
// Times are read off the game's own clock (the headless renderer is slow).
// Screenshots go to OUT.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-saber-deflect-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || "";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name) }); };

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.meleeId = "trollsaber"; T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
// The map loads behind its loading screen first; wait for the match to be live.
await page.waitForFunction(() => { const s = window.__trollOps.loadState(); return window.__trollOps.state() === "playing" && !s.open && !s.hold; }, null, { timeout: 180000 });
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); T.breakSpawnGuard(); T.setHolding("melee"); T.setAds(true); });
// The blade ignites slowly on a draw and the headless sim runs under real
// time: wait for the guard rather than a fixed second.
await page.waitForFunction(() => { const s = window.__trollOps.saberState(); return s.active && s.t >= 0.79; }, null, { timeout: 20000 }).catch(() => {});
let st = await page.evaluate(() => window.__trollOps.saberState());
check("guard up", st.active && st.t >= 0.79, JSON.stringify(st));
const hit = (sx, up) => page.evaluate(([sx, up]) => {
  const T = window.__trollOps, THREE = T.THREE;
  const cam = T.camera; const at = new THREE.Vector3(sx, up, -10).applyMatrix4(cam.matrixWorld);
  const hp0 = T.player.hp; T.damagePlayer(10, null, "problem416", false, at);
  return { hp0, hp1: T.player.hp, p: T.saberState().parry };
}, [sx, up]);
const until = (t) => page.waitForFunction((t) => window.__trollOps.saberState().parry.t >= t, t, { timeout: 60000 });
const r1 = await hit(-5, 0);
await until(0.07);
st = await page.evaluate(() => window.__trollOps.saberState());
check("left round deflected, parry aims left", r1.hp1 === r1.hp0 && st.parry.x < -0.3, JSON.stringify({ r1, p: st.parry }));
check("wrist flick mid-parry", Math.abs(st.flick) > 0.3 && st.parry.k > 0.8, JSON.stringify({ flick: st.flick, k: st.parry.k }));
await shot(page, "lk-left-flick.png");
const sim = await page.evaluate(async () => {
  const { ParryState } = await import("./assets/games/troll-ops/character.js?v=to-lk1");
  const p = new ParryState();
  p.start(-0.3, 0); for (let i = 0; i < 6; i++) p.update(1 / 60);   // 0.1 s in
  const before = { ...p.sample() };
  p.start(0.3, 0);
  const at0 = { ...p.sample() };
  p.update(1 / 60);
  const next = { ...p.sample() };
  const q = new ParryState(), flicks = [];
  for (let i = 0; i < 4; i++) { q.start(0, 0); for (let j = 0; j < 5; j++) q.update(1 / 60); flicks.push(Math.sign(q.x)); for (let j = 0; j < 2; j++) q.update(1 / 60); }
  // And from one side, 0.12 s apart: forehand, backhand, forehand.
  const r = new ParryState(), same = [];
  for (let i = 0; i < 3; i++) { r.start(-0.4, 0); for (let j = 0; j < 5; j++) r.update(1 / 60); same.push(Math.sign(r.sample().flick)); for (let j = 0; j < 2; j++) r.update(1 / 60); }
  return { before, at0, next, flicks, same };
});
check("chained parry starts where the blade is (no pop to guard)", Math.abs(sim.at0.k - sim.before.k) < 1e-6 && Math.abs(sim.at0.x - sim.before.x) < 1e-6 && sim.next.x > sim.at0.x, JSON.stringify(sim));
check("a dead-ahead burst swaps the blade side to side", sim.flicks.every((f, i) => f !== 0 && (!i || f !== sim.flicks[i - 1])), JSON.stringify(sim.flicks));
check("a burst from one side alternates forehand/backhand", sim.same.every((f, i) => f !== 0 && (!i || f !== sim.same[i - 1])), JSON.stringify(sim.same));
await until(0.5);
await hit(5, 0);
await until(0.05);
await shot(page, "lk-right-snap.png");
st = await page.evaluate(() => window.__trollOps.saberState());
check("right round aims right", st.parry.x > 0.3, JSON.stringify(st.parry));
await until(0.5);
await hit(0, 6);
await until(0.08);
st = await page.evaluate(() => window.__trollOps.saberState());
check("high round aims high", st.parry.y > 0.3, JSON.stringify(st.parry));
await shot(page, "lk-high.png");
await until(0.5);
st = await page.evaluate(() => window.__trollOps.saberState());
check("eases back to guard", st.parry.k === 0 && st.flick === 0, JSON.stringify(st.parry));
const qOf = () => page.evaluate(() => { const m = window.__trollOps.activeMeleeMesh(); return { q: m.quaternion.toArray(), p: m.position.toArray(), t: window.__trollOps.saberState().parry.t }; });
const rest = await qOf();
await hit(-5, 0);
await until(0.07);
const mid = await qOf();
const ang = 2 * Math.acos(Math.min(1, Math.abs(rest.q.reduce((a, v, i) => a + v * mid.q[i], 0))));
check("the blade visibly moves on a deflect", ang > 0.45, JSON.stringify({ ang, rest, mid }));
await page.evaluate(() => window.__trollOps.toggleThirdPerson());
await until(0.5);
await hit(4, 0);
await until(0.07);
await shot(page, "lk-3p.png");
await until(0.5);
check("no page errors", !errors.length, errors.join(" | "));
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
