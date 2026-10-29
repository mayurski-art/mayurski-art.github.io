// Troll Royale: Two Worlds, phase 3: the flip cinematic. One tab: the
// intro in the plane's lobby turns the island from the top to the side the
// match is on (Hollowgrin). Two tabs in one private room (Supabase blocked,
// BroadcastChannel carries it), the flip brought in to 12 s of match time:
// both roll together (the doc's gate: within a frame), the camera goes out to
// the model, and you come back to where you were. SHOTS=<dir>
// saves frames of both.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-flip-test.mjs

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

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
await ctx.route(/supabase/, (r) => r.abort());
const SHOTS = process.env.SHOTS || "";
// the game's own copy of the module: the tag royale.js imports it on (the cascade bumps it)
const FLIP_URL = "./assets/games/troll-ops/modes/" + fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/modes/royale.js"), "utf8").match(/royale-flip\.js\?v=[\w-]+/)[0];
const errors = [];

async function open(label, { side, flipAt, drop, room }) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript(([s, f]) => { window.__royaleSide = s; window.__flipAt = f; }, [side, flipAt]);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  await page.evaluate(async ([room, drop, url]) => {
    const T = window.__trollOps;
    T.DROP.enabled = drop;
    T.setMode("royale");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    // note the wall-clock moment this tab's flip takes the camera
    const F = await import(url);
    window.__flip = F;   // (for the waits below: their checks must be plain functions)
    const watch = () => { const s = F.flipCineState(); if (s.kind === "flip" && !window.__flipSeen) window.__flipSeen = Date.now() - s.t * 1000; requestAnimationFrame(watch); };
    requestAnimationFrame(watch);
    await T.startGame();
  }, [room, drop, FLIP_URL]);
  return page;
}
const state = (p) => p.evaluate(async (url) => {
  const T = window.__trollOps, F = await import(url), s = F.flipCineState();
  const veil = document.querySelector(".to-flip-veil");
  return { ...s, on: F.flipCineOn(), camY: T.camera.position.y, pos: T.move.pos.toArray().map((v) => +v.toFixed(2)), veil: veil ? +veil.style.opacity : 0, map: T.builtMap()?.map?.name };
}, FLIP_URL);
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, name + ".jpg") }); } };

// ---- the intro, in the plane's lobby
{
  const C = await open("C", { side: "hollowgrin", flipAt: 9999, drop: true, room: "FLI" + Math.floor(Math.random() * 90 + 10) });
  await C.waitForFunction(() => { const F = window.__flip; return F && F.flipCineState().kind === "intro"; }, null, { timeout: 240000, polling: 200 });
  await C.waitForFunction(() => { const s = window.__flip?.flipCineState(); return !!s && s.kind === "intro" && s.t > 3.4; }, null, { timeout: 30000, polling: 50 });
  const mid = await state(C);
  await shot(C, "intro-roll");
  check("the intro plays as the plane's lobby opens, from the top to this match's side", mid.kind === "intro" && mid.from === "trollface" && mid.to === "hollowgrin", JSON.stringify({ kind: mid.kind, from: mid.from, to: mid.to }));
  check("the camera is out at the island model", mid.on && mid.camY > 2000, mid.camY.toFixed(0));
  await C.waitForFunction(() => { const F = window.__flip; return F && F.flipCineState().kind === "intro" && F.flipCineState().t > 6.2; }, null, { timeout: 30000, polling: 100 });
  await shot(C, "intro-new-face");
  await C.waitForFunction(() => { const F = window.__flip; return F && !F.flipCineState().kind; }, null, { timeout: 30000, polling: 200 });
  const after = await state(C);
  check("the intro ends back in the plane, the veil gone", after.camY < 1000 && after.veil === 0, JSON.stringify({ camY: after.camY.toFixed(0), veil: after.veil }));
  await C.close();
}

// ---- the flip, two tabs
const ROOM = "FLP" + Math.floor(Math.random() * 90 + 10);
// the plane's lobby on, so both are aboard before the match goes live
// together (a tab joining after the green is a late joiner, on the room's clock)
const A = await open("A", { side: "trollface", flipAt: 12, drop: true, room: ROOM });
await sleep(2500);
const B = await open("B", { side: "trollface", flipAt: 12, drop: true, room: ROOM });
await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__trollOps.state() === "playing" && window.__trollOps.royale()?.live, null, { timeout: 300000 })));
const before = await state(A);   // (still aboard or falling at 12 s: the hold on input is the ground's, not checked here)
try { await Promise.all([A, B].map((p) => p.waitForFunction(() => !!window.__flipSeen, null, { timeout: 60000 }))); }
catch (e) { for (const p of [A, B]) console.log(JSON.stringify(await p.evaluate(() => { const r = window.__trollOps.royale(); return { t: r.t, live: r.live, over: r.over, flipped: r.flipped, alive: window.__trollOps.player?.alive }; }))); throw e; }
const [ta, tb] = await Promise.all([A, B].map((p) => p.evaluate(() => window.__flipSeen)));
check("both tabs flip together (within a frame)", Math.abs(ta - tb) <= 34, `${Math.abs(ta - tb)} ms apart`);
await A.waitForFunction(() => { const F = window.__flip; return F && F.flipCineState().kind === "flip" && F.flipCineState().t > 3.6; }, null, { timeout: 30000, polling: 100 });
const mid = await state(A);
await shot(A, "flip-roll");
check("the flip goes from this side to the other", mid.kind === "flip" && mid.from === "trollface" && mid.to === "hollowgrin", JSON.stringify({ from: mid.from, to: mid.to }));
check("the camera is out at the island model, the island turning", mid.on && mid.camY > 2000, mid.camY.toFixed(0));
await A.waitForFunction(() => { const F = window.__flip; return F && F.flipCineState().kind === "flip" && F.flipCineState().t > 6; }, null, { timeout: 30000, polling: 100 });
await shot(A, "flip-new-face");
await A.waitForFunction(() => { const F = window.__flip; return F && !F.flipCineState().kind; }, null, { timeout: 30000, polling: 200 });
const end = await state(A);
check("the flip ends back with you, the veil gone (phase 4 swaps the world)", end.camY < 200 && end.veil === 0 && end.map === before.map, JSON.stringify({ camY: end.camY.toFixed(0), veil: end.veil, map: end.map }));
await sleep(1500);
const again = await A.evaluate(async (url) => (await import(url)).flipCineState().kind, FLIP_URL);
check("it flips once a match", !again, String(again));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
