// Troll Royale's opening (royale-drop.js): the sky lobby, the Troll Bus and
// the drop. You start in the glass box with guns on the floor and can't be
// hurt; at 0:00 everyone is on the bus; you jump over the island, fall, the
// glider opens, you land on the island; the bots land too and the zone goes
// live.
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
  const T = window.__trollOps, r = T.royale();
  return {
    me: r.me, phase: r.drop?.phase, live: r.live, y: T.move.pos.y, x: T.move.pos.x, z: T.move.pos.z,
    lobbyGuns: [...r.loot.items.values()].filter((it) => String(it.id).startsWith("lobby.")).length,
    highColliders: T.colliders.filter((c) => c.min.y > 200).length,
    trolls: T.royaleAliveList().length, airborne: T.bots.bots.filter((b) => b.alive && b.airborne).length,
    botsOff: T.bots.bots.filter((b) => b.alive && !b.airborne && b.pos.y > 50).length,
  };
});

// ---- the lobby
let s = await state();
check("you start in the sky lobby, high over the island", s.me === "lobby" && s.phase === "lobby" && Math.abs(s.y - 330) < 1, JSON.stringify({ me: s.me, y: +s.y.toFixed(1) }));
check("everyone is in the lobby", s.trolls === 100 && s.airborne === 99,`${s.trolls} trolls, ${s.airborne} bots parked`);
check("guns all over the lobby floor", s.lobbyGuns >= 25, `${s.lobbyGuns}`);
const walk = await page.evaluate(async () => {
  const T = window.__trollOps, x0 = T.move.pos.x, z0 = T.move.pos.z;
  T.look.yaw = Math.atan2(T.move.pos.x, T.move.pos.z);   // face the middle
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

// ---- the bus
await page.waitForFunction(() => window.__trollOps.royale().me === "bus", null, { timeout: 120000 });
await new Promise((r) => setTimeout(r, 600));
s = await state();
check("0:00: everyone is on the Troll Bus", s.me === "bus" && s.phase === "bus" && s.airborne === 99,JSON.stringify({ me: s.me, airborne: s.airborne }));
check("the glass box and its guns are gone", s.highColliders === 0 && s.lobbyGuns === 0, JSON.stringify({ colliders: s.highColliders, guns: s.lobbyGuns }));
const kit = await page.evaluate(() => [window.__trollOps.player.weaponId, window.__trollOps.player.secondaryId]);
check("you drop with the pistol, not a lobby gun", kit[0] === "pocketgrin" && !kit[1], JSON.stringify(kit));

// ---- the drop
await page.waitForFunction(() => { const r = window.__trollOps.royale(); return r.drop.overIsland(r.drop.busT); }, null, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => window.__trollOps.keys.add("Space"));
await new Promise((r) => setTimeout(r, 250));
await page.evaluate(() => window.__trollOps.keys.delete("Space"));
await new Promise((r) => setTimeout(r, 600));
s = await state();
check("jump: out of the bus and falling", s.me === "fall" && s.y < 214, JSON.stringify({ me: s.me, y: +s.y.toFixed(1) }));
await page.waitForFunction(() => window.__trollOps.royale().me === "glide", null, { timeout: 90000 });
s = await state();
check("the glider opens near the ground", s.y < 60, `at ${s.y.toFixed(1)} m`);
await page.waitForFunction(() => window.__trollOps.royale().me === "ground", null, { timeout: 90000 });
s = await state();
const onIsland = await page.evaluate(async (p) => {
  const { ISLAND_EDGE } = await import("/assets/games/troll-ops/trollface-island.js?v=ti3");
  const { insidePolygon } = await import("/assets/games/troll-ops/edge.js");
  return insidePolygon(ISLAND_EDGE, p.x, p.z);
}, s);
check("you land on the island", onIsland && s.y < 45 && s.me === "ground", JSON.stringify({ x: +s.x.toFixed(1), y: +s.y.toFixed(1), z: +s.z.toFixed(1) }));
await page.waitForFunction(() => { const T = window.__trollOps; return T.royale().live && T.bots.bots.every((b) => !b.alive || !b.airborne); }, null, { timeout: 120000 }).catch(() => {});
s = await state();
check("every bot lands and the zone goes live", s.live && s.airborne === 0 && s.botsOff === 0 && s.trolls >= 90,JSON.stringify({ live: s.live, airborne: s.airborne, stuckHigh: s.botsOff, trolls: s.trolls }));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
