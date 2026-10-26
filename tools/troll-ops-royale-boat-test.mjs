// Troll Royale: Trollface Island's Boat sails round the lake (maps/trollface-boat.js,
// modes/royale-boat.js). It sails on Royale's clock, never touches the shore or
// anything standing in the lake, folds its rig under the boardwalks' arches, and
// carries whoever and whatever is aboard: us (turned as it turns), bots, loot.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-boat-test.mjs

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
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.DROP.enabled = false;
  T.setMode("royale");
  T.loadout.mapId = "trollface";
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging() && window.__trollOps.royale()?.live, null, { timeout: 120000 });
await page.evaluate(() => { const T = window.__trollOps; T.player.spawnGuard = 1e9; T.player.maxHp = T.player.hp = 1e9; });

// helpers in the page: the Boat, a clock that puts it `s` metres round its loop
await page.evaluate(() => {
  const T = window.__trollOps;
  const boat = T.builtMap().map.boat();
  window.__boat = boat;
  window.__boatAt = (s) => {
    const L = boat.path.total;
    const ds = ((s - boat.start) % L + L) % L;
    T.royale().t = ds / 3.5 + 2.5;      // distanceAt's start-up ease is spent by then
  };
});
const frames = (n) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

const base = await page.evaluate(() => {
  const b = window.__boat;
  return { ok: !!b, pieces: b?.pieces.length, total: b?.path.total, start: b?.start, pose: b && { ...b.pose }, arches: b?.arches };
});
check("the Boat is on the island, sailing", base.ok, `${base.pieces} collider pieces, a ${base.total?.toFixed(0)} m loop`);
check("it starts by where it was built", base.ok && Math.hypot(base.pose.x - 99.9, base.pose.z - 16.3) < 2 + 3.5 * 3, `${base.pose?.x.toFixed(1)}, ${base.pose?.z.toFixed(1)}`);

// round the loop every metre: the hull's pieces never in the shore or in anything standing in the lake
const sweep = await page.evaluate(async () => {
  const T = window.__trollOps, b = window.__boat;
  const { ISLAND_LAKE } = await import(`/assets/games/troll-ops/maps/trollface-island.js?t=${Date.now()}`);
  const { insidePolygon } = await import("/assets/games/troll-ops/maps/edge.js?v=or1");
  const statics = T.colliders.filter((c) => !c.moving && c.max.y > 0.1);
  const hits = new Set(), dry = [];
  let maxFolded = 0, unfoldedUnder = 0;
  const cs0 = [];
  for (let s = 0; s < b.path.total; s += 1) {
    const p = b.path.at(s), ry = -p.heading, cs = Math.cos(ry), sn = Math.sin(ry);
    for (const q of b.pieces) {
      const wx = p.x + q.x * cs + q.z * sn, wz = p.z - q.x * sn + q.z * cs;
      if (!insidePolygon(ISLAND_LAKE, wx, wz)) dry.push([+wx.toFixed(1), +wz.toFixed(1)]);
      const ex = (Math.abs(cs) * q.w + Math.abs(sn) * q.d) / 2, ez = (Math.abs(sn) * q.w + Math.abs(cs) * q.d) / 2;
      for (const c of statics) {
        if (c.min.x < wx + ex - 0.05 && c.max.x > wx - ex + 0.05 && c.min.z < wz + ez - 0.05 && c.max.z > wz - ez + 0.05
          && c.min.y < q.y + q.h && c.max.y > q.y) hits.add(`${c.min.x.toFixed(1)},${c.min.y.toFixed(1)},${c.min.z.toFixed(1)}@s${s}`);
      }
    }
    // the rig: folded wherever an arch's deck is over it
    const f = b.foldAt(s);
    for (const a of b.arches) {
      let d = ((a - s) % b.path.total + b.path.total) % b.path.total;
      if (d > b.path.total / 2) d -= b.path.total;
      if (d > -7.5 && d < 10.3 && f < 0.999) unfoldedUnder++;
    }
    maxFolded = Math.max(maxFolded, f);
  }
  return { hits: [...hits].slice(0, 6), n: hits.size, dry: dry.slice(0, 4), nDry: dry.length, unfoldedUnder, maxFolded };
});
check("the hull stays in the lake all the way round", sweep.nDry === 0, `${sweep.nDry} piece-steps on land ${JSON.stringify(sweep.dry)}`);
check("it never sails into anything standing in the lake (the arches' piers, the boardwalks, jetties)", sweep.n === 0, `${sweep.n} ${sweep.hits.join(" ")}`);
check("the rig is folded whenever an arch is over it", sweep.unfoldedUnder === 0 && sweep.maxFolded === 1, `${sweep.unfoldedUnder} steps unfolded under an arch`);

// under an arch for real: the folded rig's top clears the arch's underside (6.8 m)
const under = await page.evaluate(async () => {
  const b = window.__boat;
  window.__boatAt(b.arches[0] - 2);
  await new Promise((r) => setTimeout(r, 300));
  b.group.updateMatrixWorld(true);
  const THREE = window.__trollOps.THREE, box = new THREE.Box3();
  for (const g of [b.mast, b.boom, b.sail]) box.expandByObject(g);
  return { fold: b.fold, top: box.max.y, mastTurn: b.mast.rotation.z };
});
check("under the arch the mast lies aft and the rig is under 6.8 m", under.fold === 1 && under.top < 6.75, `fold ${under.fold}, rig top ${under.top.toFixed(2)} m, mast ${(under.mastTurn * 180 / Math.PI).toFixed(0)} deg`);
const sailing = await page.evaluate(async () => {
  const b = window.__boat;
  window.__boatAt(b.arches[0] + 40);   // mid-leg: the next arch 42 m on
  await new Promise((r) => setTimeout(r, 300));
  return { fold: b.fold, sail: b.sail.visible };
});
check("between the arches it sails with the sail up", sailing.fold === 0 && sailing.sail, `fold ${sailing.fold}`);

// aboard: on the deck, on a straight leg and through a turn
async function ride(sAt, secs) {
  return page.evaluate(async ([sAt, secs]) => {
    const T = window.__trollOps, b = window.__boat;
    window.__boatAt(sAt);
    await new Promise((r) => setTimeout(r, 200));
    const W = (lx, lz) => { const cs = Math.cos(b.pose.ry), sn = Math.sin(b.pose.ry); return { x: b.pose.x + lx * cs + lz * sn, z: b.pose.z - lx * sn + lz * cs }; };
    const L = (x, z) => { const dx = x - b.pose.x, dz = z - b.pose.z, cs = Math.cos(b.pose.ry), sn = Math.sin(b.pose.ry); return { x: dx * cs - dz * sn, z: dx * sn + dz * cs }; };
    const me = W(-3.0, 1.7);   // on the deck, off the hatch to the hold
    T.move.pos.set(me.x, 2.75, me.z);
    T.move.velocity?.set(0, 0, 0);
    const bot = T.bots.bots.find((x) => x.alive);
    const bw = W(-2.0, -1.2);
    // (stunned: a slow drift, not off the deck)
    if (bot) { bot.pos.set(bw.x, 2.75, bw.z); bot.groundY = 2.7; bot.hopY = 0; bot.lootId = null; bot.stunT = 10; }
    const lw = W(-6.5, -1.4);
    const it = T.royale().loot.add({ id: `boattest${sAt}`, k: "plate", x: lw.x, y: 2.7, z: lw.z });
    const yaw0 = T.look.yaw, ry0 = b.pose.ry, s0 = b.pose.s;
    await new Promise((r) => setTimeout(r, 400));
    const wire = T.net.boatAt;
    await new Promise((r) => setTimeout(r, secs * 1000 - 400));
    const l = L(T.move.pos.x, T.move.pos.z), il = L(it.x, it.z), bl = bot ? L(bot.pos.x, bot.pos.z) : null;
    let turn = b.pose.ry - ry0; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    let yawTurn = T.look.yaw - yaw0; yawTurn = Math.atan2(Math.sin(yawTurn), Math.cos(yawTurn));
    T.royale().loot.take(it.id);
    if (bot) bot.stunT = 0;
    return { sailed: b.pose.s - s0, me: [l.x, l.z], y: T.move.pos.y, item: [il.x, il.z], bot: bl && [bl.x, bl.z], botY: bot?.pos.y, turn, yawTurn, wire };
  }, [sAt, secs]);
}
const straight = await ride(base.arches[0] + 40, 4);
check("we stay where we stood on the deck as it sails (a straight leg)", Math.hypot(straight.me[0] + 3.0, straight.me[1] - 1.7) < 0.35 && straight.y > 2.5,
  `sailed ${straight.sailed.toFixed(1)} m, drifted ${Math.hypot(straight.me[0] + 3.0, straight.me[1] - 1.7).toFixed(2)} m, feet ${straight.y.toFixed(2)}`);
check("the loot on the deck sails with it", Math.hypot(straight.item[0] + 6.5, straight.item[1] + 1.4) < 0.05, `${straight.item.map((v) => v.toFixed(2))}`);
check("we tell the room where we stand on it", typeof straight.wire === "string" && /^-?\d+\.\d\d:-?\d+\.\d\d$/.test(straight.wire), `${straight.wire}`);
// the east turn: the far end of the loop from the start
const turnS = await page.evaluate(() => { const b = window.__boat; let best = 0, bx = -Infinity; for (let s = 0; s < b.path.total; s += 1) { const p = b.path.at(s); if (p.x > bx) { bx = p.x; best = s; } } return best - 12; });
const turning = await ride(turnS, 5);
check("through a turn we turn with it", Math.abs(turning.turn) > 0.5 && Math.abs(turning.yawTurn - turning.turn) < 0.05,
  `boat ${(turning.turn * 180 / Math.PI).toFixed(0)} deg, us ${(turning.yawTurn * 180 / Math.PI).toFixed(0)} deg`);
check("and still stand where we stood", Math.hypot(turning.me[0] + 3.0, turning.me[1] - 1.7) < 0.5 && turning.y > 2.5,
  `drifted ${Math.hypot(turning.me[0] + 3.0, turning.me[1] - 1.7).toFixed(2)} m`);
check("a bot aboard sails with it (on the deck or down the hatch)", turning.bot && turning.botY > 0.45 && Math.abs(turning.bot[0]) < 9 && Math.abs(turning.bot[1]) < 2.8, `${turning.bot?.map((v) => v.toFixed(1))} y ${turning.botY?.toFixed(2)}`);

// the moving pieces are left out of what's made once: the bots' grid and the minimap
const once = await page.evaluate(() => {
  const T = window.__trollOps;
  return { moving: T.colliders.filter((c) => c.moving).length };
});
check("its colliders are flagged as moving", once.moving === base.pieces, `${once.moving}`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
