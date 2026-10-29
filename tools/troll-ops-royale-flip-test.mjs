// Troll Royale: Two Worlds: the flip cinematic, one a match (no intro in
// the plane's lobby), and the world turning over under it. Two tabs in one private room (Supabase blocked,
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
// START=hollowgrin: the two tabs start on the underside and turn up to Trollface Island
const START = process.env.START === "hollowgrin" ? "hollowgrin" : "trollface", OTHER = START === "trollface" ? "hollowgrin" : "trollface";
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
    const watch = () => { const s = F.flipCineState(); if (s.kind) (window.__kinds ||= new Set()).add(s.kind); if (s.kind === "flip" && !window.__flipSeen) window.__flipSeen = Date.now() - s.t * 1000; requestAnimationFrame(watch); };
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
// the world a tab is in: its map, where you stand, the storm, the floor loot
const world = (p) => p.evaluate(() => {
  const T = window.__trollOps, r = T.royale(), b = T.builtMap().map.bounds, z = r.zone.state(r.t), pos = T.move.pos;
  const loot = [...r.loot.items.values()].slice(0, 5).map((it) => `${it.id}@${it.x?.toFixed?.(1)},${it.z?.toFixed?.(1)}`);
  return { id: T.loadedMapId(), name: T.builtMap().map.name, inside: pos.x > b.minX && pos.x < b.maxX && pos.z > b.minZ && pos.z < b.maxZ,
    pos: pos.toArray().map((v) => +v.toFixed(2)), alive: T.player.alive, gun: T.currentWeapon()?.def.id, phase: z.phase, stage: z.stage,
    circle: [+z.x.toFixed(2), +z.z.toFixed(2), +z.r.toFixed(1)], circleIn: z.x > b.minX && z.x < b.maxX && z.z > b.minZ && z.z < b.maxZ,
    loot, lootN: r.loot.items.size, swapped: !!r.swapped, grounded: !!T.move.grounded };
});
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, name + ".jpg") }); } };


// ---- the flip, two tabs
const ROOM = "FLP" + Math.floor(Math.random() * 90 + 10);
// the plane's lobby on, so both are aboard before the match goes live
// together (a tab joining after the green is a late joiner, on the room's clock)
const A = await open("A", { side: START, flipAt: 12, drop: true, room: ROOM });
await sleep(2500);
const B = await open("B", { side: START, flipAt: 12, drop: true, room: ROOM });
await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__trollOps.state() === "playing" && window.__trollOps.royale()?.live, null, { timeout: 300000 })));
const before = await state(A);   // (still aboard or falling at 12 s: the hold on input is the ground's, not checked here)
const wBefore = await world(A);
try { await Promise.all([A, B].map((p) => p.waitForFunction(() => !!window.__flipSeen, null, { timeout: 60000 }))); }
catch (e) { for (const p of [A, B]) console.log(JSON.stringify(await p.evaluate(() => { const r = window.__trollOps.royale(); return { t: r.t, live: r.live, over: r.over, flipped: r.flipped, alive: window.__trollOps.player?.alive }; }))); throw e; }
const [ta, tb] = await Promise.all([A, B].map((p) => p.evaluate(() => window.__flipSeen)));
const clocks = await Promise.all([A, B].map((p) => p.evaluate(() => { const r = window.__trollOps.royale(); return { green: r.greenAt % 1e6, live: r.liveAt % 1e6, out: r.drop?.squadron?.lastOut() }; })));
// (0.12 s: the world swaps under the black veil, so that much is unseen; a
// peer takes the owner's count as of when it lands, and on a busy machine a
// long frame there can hold it ~0.1 s; mostly they land within a frame)
check("both tabs flip together (within 0.12 s)", Math.abs(ta - tb) <= 120, `${Math.abs(ta - tb)} ms apart; ${JSON.stringify(clocks)}`);
if (SHOTS) { await A.waitForFunction(() => { const F = window.__flip; return F && F.flipCineState().kind === "flip" && F.flipCineState().t > 2.8; }, null, { timeout: 30000, polling: 50 }); await shot(A, "flip-roll-early"); }
await A.waitForFunction(() => { const F = window.__flip; return F && F.flipCineState().kind === "flip" && F.flipCineState().t > 3.6; }, null, { timeout: 30000, polling: 100 });
const mid = await state(A);
await shot(A, "flip-roll");
check("the flip goes from this side to the other", mid.kind === "flip" && mid.from === START && mid.to === OTHER, JSON.stringify({ from: mid.from, to: mid.to }));
check("the camera is out at the island model, the island turning", mid.on && mid.camY > 2000, mid.camY.toFixed(0));
if (SHOTS) { await A.waitForFunction(() => { const F = window.__flip; return F && F.flipCineState().kind === "flip" && F.flipCineState().t > 4.6; }, null, { timeout: 30000, polling: 50 }); await shot(A, "flip-roll-late"); }
await A.waitForFunction(() => { const F = window.__flip; return F && F.flipCineState().kind === "flip" && F.flipCineState().t > 6; }, null, { timeout: 30000, polling: 100 });
await shot(A, "flip-new-face");
await A.waitForFunction(() => { const F = window.__flip; return F && !F.flipCineState().kind; }, null, { timeout: 30000, polling: 200 });
const end = await state(A);
check("the flip ends back with you, the veil gone", end.camY < 200 && end.veil === 0, JSON.stringify({ camY: end.camY.toFixed(0), veil: end.veil }));
// ---- the swap (phase 4)
const [wa, wb] = await Promise.all([A, B].map(world));
console.log("A", JSON.stringify(wa));
console.log("B", JSON.stringify(wb));
check(`the world turned over: both tabs on ${OTHER}`, wBefore.id === START && wa.id === OTHER && wb.id === OTHER, `${wBefore.id} -> ${wa.id}, ${wb.id}`);
check("you're set down inside the new side's bounds, alive", wa.inside && wb.inside && wa.alive && wb.alive, JSON.stringify([wa.pos, wb.pos]));
check("...standing on the ground (not falling, not under it)", wa.grounded && wb.grounded && wa.pos[1] > -2 && wb.pos[1] > -2, JSON.stringify([wa.pos[1], wb.pos[1]]));
check("what you carried came with you", wa.gun === wBefore.gun, `${wBefore.gun} -> ${wa.gun}`);
check("the storm carried across: circle 3, over the new side", wa.phase === 3 && wa.circleIn, JSON.stringify({ phase: wa.phase, stage: wa.stage, circle: wa.circle }));
check("both tabs have the same storm", JSON.stringify(wa.circle) === JSON.stringify(wb.circle), JSON.stringify([wa.circle, wb.circle]));
check("fresh floor loot, the same on both tabs", wa.lootN > 20 && wa.lootN === wb.lootN && JSON.stringify(wa.loot) === JSON.stringify(wb.loot), `${wa.lootN} / ${wb.lootN}`);
await sleep(2000);
const [pa, pb] = await Promise.all([A, B].map((p) => p.evaluate(() => [...window.__trollOps.remotes.byId.values()].map((rp) => rp.pos.toArray().map((v) => +v.toFixed(1))))));
const bounds = await A.evaluate(() => window.__trollOps.builtMap().map.bounds);
const inB = ([x, , z]) => x > bounds.minX - 1 && x < bounds.maxX + 1 && z > bounds.minZ - 1 && z < bounds.maxZ + 1;
check("each sees the other on the new side", pa.length > 0 && pa.every(inB) && pb.length > 0 && pb.every(inB), JSON.stringify([pa, pb]));
await sleep(1500);
const again = await A.evaluate(async (url) => (await import(url)).flipCineState().kind, FLIP_URL);
check("it flips once a match", !again, String(again));
const kinds = await Promise.all([A, B].map((p) => p.evaluate(() => [...(window.__kinds || [])])));
check("the one cinematic all match is the flip (no intro)", kinds.every((k) => k.join() === "flip"), JSON.stringify(kinds));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
