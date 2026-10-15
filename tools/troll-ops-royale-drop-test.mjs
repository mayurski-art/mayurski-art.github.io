// Troll Royale's opening (royale-drop.js, royale-planes.js, PLANES.md): the
// C-130 drop. You start aboard your plane, walking its hold, the guns down
// and nothing able to hurt you; the squadron circles the island; at 0:00 the
// ramp lowers and the light goes green, Space runs you off the ramp and you
// freefall (no glider) onto the island with a roll; the bots go out in
// sticks, land too, and the zone goes live.
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
    me: r.me, phase: d?.phase, live: r.live, y: T.move.pos.y, x: T.move.pos.x, z: T.move.pos.z, t: r.planeT,
    plane: r.plane, seat: r.seat, ghostY: T.DROP.ghostY,
    highColliders: T.colliders.filter((c) => c.min.y > 1000).length,
    trolls: T.royaleAliveList().length, airborne: T.bots.bots.filter((b) => b.alive && b.airborne).length,
    aboardBots: T.bots.bots.filter((b) => b.alive && b.drop?.state === "aboard" && b.dropCode === 1).length,
    botsOff: T.bots.bots.filter((b) => b.alive && !b.airborne && b.pos.y > 50).length,
    botsHigh: T.bots.bots.filter((b) => b.alive && b.pos.y > 50).length,
    holding: T.player.holding,
  };
});
const onIsland = (p) => page.evaluate(async (p) => {
  const { ISLAND_EDGE } = await import("/assets/games/troll-ops/trollface-island.js?v=ti3");
  const { insidePolygon } = await import("/assets/games/troll-ops/edge.js");
  return insidePolygon(ISLAND_EDGE, p.x, p.z);
}, p);
/* The camera in the ridden plane's own frame (the floor's middle, -z the nose). */
const camLocal = () => page.evaluate(() => {
  const T = window.__trollOps, sq = T.planes(), M = sq.planeM[sq.ridden].clone().invert();
  const c = T.camera.position.clone(), l = c.clone().applyMatrix4(M);
  return { world: { x: c.x, y: c.y, z: c.z }, local: { x: l.x, y: l.y, z: l.z }, t: T.royale().planeT };
});
const ghostLocal = () => page.evaluate(() => { const T = window.__trollOps, o = T.royale().drop.origin; return { x: T.move.pos.x - o.x, y: T.move.pos.y - o.y, z: T.move.pos.z - o.z }; });
const inHold = (l) => Math.abs(l.x) < 1.7 && l.y > -0.2 && l.y < 2.9 && l.z > -6.4 && l.z < 9.5;

// ---- steering the fall (user, 2026-10-13: "land where they want to.
// Think of fortnite"). Stick forward with the camera level flies you
// forward faster than you fall, so the whole island is in reach; looking
// down dives; stick back brakes over one spot.
const sim = await page.evaluate(async () => {
  const src = await (await fetch("/assets/games/troll-ops/modes/royale.js")).text();
  const { Flight, DROP } = await import("/assets/games/troll-ops/" + src.match(/(royale-drop\.js\?v=[^"]+)/)[1]);
  const THREE = await import("three");
  const fly = (opts, input) => {
    const f = new Flight(new THREE.Vector3(0, 328, 0), null, opts);
    let t = 0;
    while (f.state !== "landed" && t < 60) { f.update(1 / 60, input, () => 0); t += 1 / 60; }
    return { reach: Math.hypot(f.pos.x, f.pos.z), t };
  };
  return {
    old: fly({}, { forward: 1, strafe: 0, yaw: 0, pitch: 0 }),
    fly: fly({ track: true }, { forward: 1, strafe: 0, yaw: 0, pitch: 0 }),
    dive: fly({ track: true }, { forward: 1, strafe: 0, yaw: 0, pitch: -1.2 }),
    back: fly({ track: true }, { forward: -1, strafe: 0, yaw: 0, pitch: 0 }),
    side: fly({ track: true }, { forward: 0, strafe: 1, yaw: 0, pitch: 0 }),
  };
});
const r1 = (o) => ({ reach: Math.round(o.reach), t: +o.t.toFixed(1) });
check("stick forward, camera level: you fly across the island", sim.fly.reach > 250 && sim.fly.reach > sim.old.reach * 1.8, JSON.stringify({ was: r1(sim.old), now: r1(sim.fly) }));
check("look down and push: a dive, down sooner", sim.dive.t < sim.fly.t * 0.75, JSON.stringify(r1(sim.dive)));
check("stick back brakes; strafe still steers", sim.back.reach < sim.fly.reach * 0.4 && sim.side.reach > 80, JSON.stringify({ back: r1(sim.back), side: r1(sim.side) }));

// ---- the lobby
// ---- aboard
await page.waitForFunction(() => window.__trollOps.planes()?.hold?.plane, null, { timeout: 60000 });
let s = await state();
check("you start aboard your C-130, standing in the ghost hold", s.me === "aboard" && s.phase === "lobby" && Math.abs(s.y - s.ghostY) < 1, JSON.stringify({ me: s.me, phase: s.phase, y: +s.y.toFixed(1) }));
check("the hold's colliders are laid (floor, walls, roof, the shut ramp)", s.highColliders >= 10, `${s.highColliders}`);
check("everyone's aboard: 100 trolls, 99 bots in their seats", s.trolls === 100 && s.airborne === 99 && s.aboardBots === 99, JSON.stringify({ trolls: s.trolls, airborne: s.airborne, seated: s.aboardBots }));
check("you're plane 1, seat 1 (the only human)", s.plane === 0 && s.seat === 0, JSON.stringify({ plane: s.plane, seat: s.seat }));
const sq = await page.evaluate(() => {
  const T = window.__trollOps, sq = T.planes();
  const fl = sq.flights;
  // Twelve flights, spaced: never within 60 m of each other over the whole schedule.
  let minGap = 1e9, at = 0;
  const pos = (f, t) => sq.posAt(f.i, t);
  for (let t = -90; t <= 30; t += 0.5) {
    const ps = fl.map((f) => pos(f, t));
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const d = ps[i].distanceTo(ps[j]); if (d < minGap) { minGap = d; at = t; } }
  }
  // Where they come in from: the bearings of their start points round the compass.
  const bearings = fl.map((f) => Math.atan2(f.S.z, f.S.x)).sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 0; i < bearings.length; i++) maxGap = Math.max(maxGap, ((bearings[(i + 1) % bearings.length] - bearings[i]) + Math.PI * 2) % (Math.PI * 2) || Math.PI * 2);
  return { n: fl.length, minGap, at, maxGapDeg: maxGap * 180 / Math.PI, over: fl.every((f) => f.over && f.tOut > f.tIn), parts: sq.parts.length, seats: sq.hold.seats.filter(Boolean).length };
});
check("twelve planes, instanced (one InstancedMesh per part)", sq.n === 12 && sq.parts >= 4 && sq.parts <= 10, JSON.stringify({ n: sq.n, parts: sq.parts }));
check("the planes never come within 18 m of each other (each flies its own height)", sq.minGap > 18, `${sq.minGap.toFixed(0)} m at t ${sq.at}`);
check("they come in from all round the compass", sq.maxGapDeg < 100, `largest gap ${sq.maxGapDeg.toFixed(0)}°`);
check("every drop run crosses the island", sq.over, "");
check("the hold has its nine seats", sq.seats === 9, `${sq.seats}`);
await new Promise((r) => setTimeout(r, 2500));   // past the room's peer-map reset
const mates = await page.evaluate(() => {
  const T = window.__trollOps, sq = T.planes(), M = sq.planeM[sq.ridden].clone().invert();
  const shown = [...T.remotes.byId.values()].filter((rp) => rp.rig.root.visible);
  const at = shown.map((rp) => rp.rig.root.position.clone().applyMatrix4(M));
  return { shown: shown.length, inHold: at.filter((l) => Math.abs(l.x) < 1.7 && l.y > -1 && l.y < 2 && l.z > -6.4 && l.z < 6.4).length };
});
check("your eight planemates sit in your plane; nobody else aboard is drawn", mates.shown === 8 && mates.inHold === 8, JSON.stringify(mates));
let c0 = await camLocal();
check("the camera is inside the plane's hold", inHold(c0.local), JSON.stringify(Object.fromEntries(Object.entries(c0.local).map(([k, v]) => [k, +v.toFixed(2)]))));
await new Promise((r) => setTimeout(r, 700));
let c1 = await camLocal();
const moved = Math.hypot(c1.world.x - c0.world.x, c1.world.z - c0.world.z), dtGame = c1.t - c0.t;
check("...and flies with it (at the plane's speed)", dtGame > 0.1 && moved > dtGame * 40 * 0.6 && moved < dtGame * 40 * 1.6 && inHold(c1.local), JSON.stringify({ moved: +moved.toFixed(1), gameSeconds: +dtGame.toFixed(2) }));
const walk = await page.evaluate(async () => {
  const T = window.__trollOps, x0 = T.move.pos.x, z0 = T.move.pos.z;
  T.look.yaw = Math.PI;   // aft, down the aisle (ghost frame: +z)
  T.keys.add("KeyW"); await new Promise((r) => setTimeout(r, 900)); T.keys.delete("KeyW");
  return Math.hypot(T.move.pos.x - x0, T.move.pos.z - z0);
});
check("you can walk the hold", walk > 1, `${walk.toFixed(1)} m`);
await page.evaluate(async () => {
  const T = window.__trollOps, o = T.royale().drop.origin;
  T.move.reset(o.x + 0.95, o.z + 2, o.y);
  T.look.yaw = Math.PI;
  T.keys.add("KeyW"); await new Promise((r) => setTimeout(r, 2500)); T.keys.delete("KeyW");
});
let g = await ghostLocal();
check("before the green the ramp's shut: walking aft stops at it", g.z < 6.3 && g.y > -0.5, JSON.stringify({ z: +g.z.toFixed(2), y: +g.y.toFixed(2) }));
const quiet = await page.evaluate(async () => {
  const T = window.__trollOps, w = T.currentWeapon(), a0 = w.ammoInMag, hp = T.player.hp;
  T.damagePlayer(40, null, "problem416", false);
  T.setTrigger(true);
  await new Promise((r) => setTimeout(r, 500));
  T.setTrigger(false);
  return { ammo: [a0, w.ammoInMag], hp: [hp, T.player.hp], holding: T.player.holding };
});
check("aboard nothing hurts and the guns stay down", quiet.hp[0] === quiet.hp[1] && quiet.ammo[0] === quiet.ammo[1] && quiet.holding === "none", JSON.stringify(quiet));

// ---- green light
await page.waitForFunction(() => window.__trollOps.royale().drop.phase === "run", null, { timeout: 120000 });
await page.waitForFunction(() => { const T = window.__trollOps; return !T.planes().hold.lip; }, null, { timeout: 30000 }).catch(() => {});
const lit = await page.evaluate(() => { const h = window.__trollOps.planes().hold; return { light: h.light, ramp: +h.rampK.toFixed(2), door: +h.doorK.toFixed(2), lip: !!h.lip }; });
check("0:00: the light's green, the door up, the ramp down", lit.light === "green" && lit.ramp > 0.85 && lit.door > 0.95 && !lit.lip, JSON.stringify(lit));
const jumped = await page.evaluate(async () => {
  const T = window.__trollOps, r = T.royale(), sq = T.planes();
  const t0 = r.planeT;
  T.keys.add("Space"); await new Promise((res) => setTimeout(res, 150)); T.keys.delete("Space");
  while (r.me === "aboard" && r.planeT - t0 < 6) await new Promise((res) => setTimeout(res, 50));
  const end = new (T.camera.position.constructor)(0, 0, 9.35).applyMatrix4(sq.planeM[sq.ridden]);
  const f = r.flight;
  return { me: r.me, secs: r.planeT - t0, fromRamp: r.exitFromRamp ?? -1, hvel: r.exitSpeed || 0 };
});
check("Space: down the aisle and off the ramp", jumped.me === "fall" && jumped.secs < 4.5, JSON.stringify({ me: jumped.me, gameSeconds: +jumped.secs.toFixed(2) }));
check("...out of the back of the plane, with its speed", jumped.fromRamp >= 0 && jumped.fromRamp < 12 && jumped.hvel > 25, JSON.stringify({ fromRampEnd: +jumped.fromRamp.toFixed(1), speed: +jumped.hvel.toFixed(1) }));
// Off the ramp, fly for the far side of the island from where you went out
// (well inside the coast), stick held forward, camera level.
await page.evaluate(() => {
  const T = window.__trollOps;
  window.__exit = { x: T.move.pos.x, z: T.move.pos.z };
  const aim = { x: T.move.pos.x > 0 ? -150 : 150, z: 0 };
  T.look.yaw = Math.atan2(-(aim.x - T.move.pos.x), -(aim.z - T.move.pos.z));
  T.look.pitch = 0;
  T.keys.add("KeyW");
});
await page.waitForFunction(() => {
  const T = window.__trollOps, r = T.royale();
  if (r.me === "glide") window.__everGlide = true;
  if ((r.me === "roll" || r.me === "ground") && window.__landHp == null) window.__landHp = T.player.hp;
  return r.me === "roll" || r.me === "ground";
}, null, { timeout: 90000 }).catch(() => {});
await page.evaluate(() => window.__trollOps.keys.delete("KeyW"));
s = await state();
const flewFrom = await page.evaluate(() => Math.hypot(window.__trollOps.move.pos.x - window.__exit.x, window.__trollOps.move.pos.z - window.__exit.z));
check("held forward toward the far side, you land far from where you went out", flewFrom > 130, `${flewFrom.toFixed(0)} m from the ramp`);
check("you land with a roll", s.me === "roll", s.me);
await page.waitForFunction(() => window.__trollOps.royale().me === "ground", null, { timeout: 30000 }).catch(() => {});
s = await state();
const drop = await page.evaluate(() => ({ glide: !!window.__everGlide, landHp: window.__landHp }));
check("you land on the island, on your feet", (await onIsland(s)) && s.y < 45 && s.me === "ground", JSON.stringify({ x: +s.x.toFixed(1), y: +s.y.toFixed(1), z: +s.z.toFixed(1), me: s.me }));
check("no glider, no damage from the fall", !drop.glide && drop.landHp === 100, JSON.stringify(drop));
await page.waitForFunction(() => { const T = window.__trollOps; return T.royale().live && T.royale().drop.phase === "done" && T.bots.bots.every((b) => !b.alive || !b.airborne); }, null, { timeout: 150000 }).catch(() => {});
s = await state();
check("every bot jumps and lands, the zone goes live, the planes go", s.live && s.phase === "done" && s.airborne === 0 && s.botsOff === 0 && s.botsHigh === 0 && s.trolls >= 90,
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
