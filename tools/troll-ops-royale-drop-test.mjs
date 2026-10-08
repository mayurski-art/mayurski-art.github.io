// Troll Royale's opening (royale-drop.js): the sky lobby, the box opening
// and the drop. You start in the glass box with guns on the floor and can't
// be hurt; at 0:00 one wall opens and the floor carries everyone out over a
// ramp; off its edge you freefall (no glider) and land on the island with a
// roll; the bots land too and the zone goes live.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-drop-test.mjs

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

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => { const T = window.__trollOps; T.DROP.lobbySeconds = 14; T.setMode("royale"); T.els.noBots.checked = false; await T.startGame(); });
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 120000 });
await new Promise((r) => setTimeout(r, 1500));

const state = () => page.evaluate(() => {
  const T = window.__trollOps, r = T.royale(), d = r.drop;
  return {
    me: r.me, phase: d?.phase, live: r.live, y: T.move.pos.y, x: T.move.pos.x, z: T.move.pos.z,
    lobbyGuns: [...r.loot.items.values()].filter((it) => String(it.id).startsWith("lobby.")).length,
    highColliders: T.colliders.filter((c) => c.min.y > 200).length,
    wallColliders: d ? Object.keys(d.wallColliders).length : -1, rampColliders: d ? d.rampColliders.length : -1,
    openDir: d ? { x: d.openDir.x, z: d.openDir.z } : null, box: d ? { x: d.boxCentre.x, z: d.boxCentre.z } : null,
    trolls: T.royaleAliveList().length, airborne: T.bots.bots.filter((b) => b.alive && b.airborne).length,
    botsOff: T.bots.bots.filter((b) => b.alive && !b.airborne && b.pos.y > 50).length,
    botsHigh: T.bots.bots.filter((b) => b.alive && b.pos.y > 50).length,
  };
});
const onIsland = (p) => page.evaluate(async (p) => {
  const { ISLAND_EDGE } = await import("/assets/games/troll-ops/trollface-island.js?v=ti3");
  const { insidePolygon } = await import("/assets/games/troll-ops/edge.js");
  return insidePolygon(ISLAND_EDGE, p.x, p.z);
}, p);

// ---- the lobby
let s = await state();
check("you start in the sky lobby, high over the island", s.me === "lobby" && s.phase === "lobby" && Math.abs(s.y - 330) < 1, JSON.stringify({ me: s.me, y: +s.y.toFixed(1) }));
check("the box hangs over the island, near its middle", (await onIsland(s.box)) && Math.hypot(s.box.x, s.box.z) <= 50, JSON.stringify(s.box));
check("everyone is in the lobby", s.trolls === 100 && s.airborne === 99, `${s.trolls} trolls, ${s.airborne} bots parked`);
check("guns all over the lobby floor", s.lobbyGuns >= 25, `${s.lobbyGuns}`);
const walk = await page.evaluate(async () => {
  const T = window.__trollOps, x0 = T.move.pos.x, z0 = T.move.pos.z, c = T.royale().drop.boxCentre;
  T.look.yaw = Math.atan2(T.move.pos.x - c.x, T.move.pos.z - c.z);   // face the middle
  T.keys.add("KeyW"); await new Promise((r) => setTimeout(r, 1200)); T.keys.delete("KeyW");
  return Math.hypot(T.move.pos.x - x0, T.move.pos.z - z0);
});
check("you can walk round the lobby", walk > 1, `${walk.toFixed(1)} m`);
const hurt = await page.evaluate(() => { const T = window.__trollOps; const hp = T.player.hp; T.damagePlayer(40, null, "problem416", false); return { before: hp, after: T.player.hp }; });
check("nothing hurts in the lobby", hurt.after === hurt.before, JSON.stringify(hurt));
const pick = await page.evaluate(async () => {
  const T = window.__trollOps, r = T.royale();
  const it = [...r.loot.items.values()].find((i) => String(i.id).startsWith("lobby."));
  T.move.pos.set(it.x, it.y + 0.05, it.z);
  await new Promise((res) => setTimeout(res, 400));
  T.keys.add("KeyX"); await new Promise((res) => setTimeout(res, 1400)); T.keys.delete("KeyX");
  const gone = !r.loot.items.has(it.id);
  const held = [T.player.weaponId, T.player.secondaryId].includes(it.w);
  await new Promise((res) => setTimeout(res, 5500));
  return { gone, held, back: r.loot.items.has(it.id) };
});
check("a lobby gun picks up, and comes back", pick.gone && pick.held && pick.back, JSON.stringify(pick));

// ---- the box opens
await page.waitForFunction(() => window.__trollOps.royale().me === "belt", null, { timeout: 120000 });
// Hands off: the floor does the carrying. (Headless with 99 bots the sim
// runs well under real time, so distances are measured against the belt's
// own clock, not the wall's.)
const carried = await page.evaluate(async () => {
  const T = window.__trollOps, d = T.royale().drop;
  // Stand in the middle of the floor, on the belt, with no input.
  T.move.reset(d.boxCentre.x, d.boxCentre.z, T.DROP.boxY);
  T.look.yaw = d.openYaw;
  const x0 = T.move.pos.x, z0 = T.move.pos.z, t0 = d.beltT;
  await new Promise((r) => setTimeout(r, 1000));
  const dx = T.move.pos.x - x0, dz = T.move.pos.z - z0, dtGame = d.beltT - t0;
  return { along: dx * d.openDir.x + dz * d.openDir.z, side: Math.abs(dx * d.openDir.z - dz * d.openDir.x), dtGame, expect: T.DROP.beltSpeed * dtGame };
});
s = await state();
check("0:00: the box opens and everyone is on the belt", s.me === "belt" && s.phase === "belt" && s.airborne === 99, JSON.stringify({ me: s.me, phase: s.phase, airborne: s.airborne }));
check("one wall is gone and the ramp is there", s.wallColliders === 3 && s.rampColliders === 3, JSON.stringify({ walls: s.wallColliders, ramp: s.rampColliders }));
check("the lobby guns are gone", s.lobbyGuns === 0, `${s.lobbyGuns}`);
check("with no input the floor carries you toward the opening at belt speed", carried.dtGame > 0.1 && carried.along >= carried.expect * 0.8 && carried.along <= carried.expect * 1.25 && carried.side < 1,
  JSON.stringify({ along: +carried.along.toFixed(2), expect: +carried.expect.toFixed(2), side: +carried.side.toFixed(2), gameSeconds: +carried.dtGame.toFixed(2) }));
const kit = await page.evaluate(() => [window.__trollOps.player.weaponId, window.__trollOps.player.secondaryId]);
check("you drop with the pistol, not a lobby gun", kit[0] === "sixtynine" && !kit[1], JSON.stringify(kit));

// ---- the drop
// Falling before the floor goes (12 s on the belt's clock), never gliding,
// and landing with the health you left with (bots take their shots once
// you're down among them, so hp is read the moment you land).
await page.waitForFunction(() => {
  const T = window.__trollOps, r = T.royale(), d = r.drop;
  if (r.me === "glide") window.__everGlide = true;
  if (r.me === "fall" && window.__fellAt == null) { window.__fellAt = d.beltT; window.__fellY = T.move.pos.y; }
  if ((r.me === "roll" || r.me === "ground") && window.__landHp == null) window.__landHp = T.player.hp;
  return r.me !== "belt" || d.beltT > T.DROP.floorGoneAfter + 1;
}, null, { timeout: 150000 }).catch(() => {});
s = await state();
let drop = await page.evaluate(() => ({ fellAt: window.__fellAt, fellY: window.__fellY }));
check("off the edge before the floor goes: falling", drop.fellAt != null && drop.fellAt < 12 && (s.me === "fall" || s.me === "roll" || s.me === "ground") && drop.fellY < 331,
  JSON.stringify({ me: s.me, beltSeconds: drop.fellAt != null ? +drop.fellAt.toFixed(1) : null, y: +s.y.toFixed(1) }));
await page.waitForFunction(() => {
  const T = window.__trollOps, r = T.royale();
  if (r.me === "glide") window.__everGlide = true;
  if ((r.me === "roll" || r.me === "ground") && window.__landHp == null) window.__landHp = T.player.hp;
  return r.me === "roll" || r.me === "ground";
}, null, { timeout: 90000 }).catch(() => {});
s = await state();
check("you land with a roll", s.me === "roll", s.me);
await page.waitForFunction(() => window.__trollOps.royale().me === "ground", null, { timeout: 30000 }).catch(() => {});
s = await state();
drop = await page.evaluate(() => ({ glide: !!window.__everGlide, landHp: window.__landHp }));
check("you land on the island, on your feet", (await onIsland(s)) && s.y < 45 && s.me === "ground", JSON.stringify({ x: +s.x.toFixed(1), y: +s.y.toFixed(1), z: +s.z.toFixed(1), me: s.me }));
check("no glider, no damage from the fall", !drop.glide && drop.landHp === 100, JSON.stringify(drop));
await page.waitForFunction(() => { const T = window.__trollOps; return T.royale().live && T.bots.bots.every((b) => !b.alive || !b.airborne); }, null, { timeout: 120000 }).catch(() => {});
s = await state();
check("every bot lands and the zone goes live", s.live && s.phase === "done" && s.airborne === 0 && s.botsOff === 0 && s.botsHigh === 0 && s.trolls >= 90,
  JSON.stringify({ live: s.live, phase: s.phase, airborne: s.airborne, stuckHigh: s.botsOff, high: s.botsHigh, trolls: s.trolls }));
const botsOnIsland = await page.evaluate(async () => {
  const { ISLAND_EDGE } = await import("/assets/games/troll-ops/trollface-island.js?v=ti3");
  const { insidePolygon } = await import("/assets/games/troll-ops/edge.js");
  const T = window.__trollOps;
  return T.bots.bots.filter((b) => b.alive && !insidePolygon(ISLAND_EDGE, b.pos.x, b.pos.z)).length;
});
check("every bot is on the island", botsOnIsland === 0, `${botsOnIsland} off it`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
