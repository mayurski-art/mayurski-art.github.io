// Troll Royale on Hollowgrin, the woods opened up (user, 2026-10-29:
// "freeing up some of the invisible wall restrictions ... so people can land
// on near woods or near the main stuff in hollowgrin map. kind of like in
// fortnite"). In Royale the village's invisible walls come down and the
// edge is the island's `open` outline (models/hollowgrin-island.json): the
// woods round the wall out to the beach, clear of the brew. Its trees, the
// field-stone wall and the stem stop you; you can glide out over the woods
// and land there; walking on, the outline holds you; the bots, the loot and
// the zone use it; and closing it puts the village back as it was, walls
// and all (the other modes never see it).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-hollowgrin-open-test.mjs
// SHOTS=<dir> also saves the woods from the fall and from the ground.

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

const S = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/models/hollowgrin-island.json"), "utf8"));
const B = { minX: -51, maxX: 87, minZ: -45, maxZ: 45 };   // the village (maps/hollowgrin.js BOUNDS)
const inside = (poly, x, z) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
const inVillage = (x, z) => x >= B.minX && x <= B.maxX && z >= B.minZ && z <= B.maxZ;

// the outline itself: on the land, off the brew
const pools = [S.mouth, ...S.eyes, S.nose];
check("the open outline keeps off the brew: no pool's corner inside it", pools.flat().every(([x, z]) => !inside(S.open, x, z)));
check("... and stays on the island, inside the coast", S.open.every(([x, z]) => inside(S.coast, x, z)));
check("... and takes in the whole village", [[B.minX, B.minZ], [B.maxX, B.minZ], [B.maxX, B.maxZ], [B.minX, B.maxZ]].every(([x, z]) => inside(S.open, x + Math.sign(18 - x) * 0.7, z + Math.sign(-z) * 0.7)));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => { const T = window.__trollOps; T.DROP.lobbySeconds = 10; T.setMode("royale_hollowgrin"); T.els.noBots.checked = false;
  // a private room, never the public one
  T.els.room.value = "RO" + Math.random().toString(36).slice(2, 5).toUpperCase(); T.els.room.dispatchEvent(new Event("input"));
  await T.startGame(); });
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 120000 });
await new Promise((r) => setTimeout(r, 1000));
// (best-effort: a slow software renderer can time a screenshot out)
const shot = (name) => process.env.SHOTS ? page.screenshot({ path: path.join(process.env.SHOTS, `hollowgrin-open-${name}.jpg`), type: "jpeg", quality: 85, timeout: 60000 }).catch(() => {}) : null;

const setup = await page.evaluate((B) => {
  const T = window.__trollOps, A = T.move.arena || {}, cs = T.colliders;
  const walls = cs.filter((c) => c.min.y === 0 && c.max.y === 8 && (c.max.z <= B.minZ + 1e-6 || c.min.z >= B.maxZ - 1e-6 || c.max.x <= B.minX + 1e-6 || c.min.x >= B.maxX - 1e-6)).length;
  const out = cs.filter((c) => c.min.x > B.maxX + 1 || c.max.x < B.minX - 1 || c.min.z > B.maxZ + 1 || c.max.z < B.minZ - 1);
  const loot = [...T.royale().loot.items.values()];
  return {
    walls, out: out.length, tall: out.filter((c) => c.max.y > 3).length, total: cs.length,
    edge: A.edge?.length || 0, bounds: [A.minX, A.maxX, A.minZ, A.maxZ],
    loot: loot.length, lootOut: loot.filter((p) => p.x < B.minX || p.x > B.maxX || p.z < B.minZ || p.z > B.maxZ).length,
    zoneR: Math.round(T.royale().zone.state(0).r),
  };
}, B);
check("Royale on Hollowgrin: the invisible walls are down", setup.walls === 0, `${setup.walls} left`);
check("the edge is the island's open outline, the arena its box", setup.edge === S.open.length && setup.bounds[0] < -140 && setup.bounds[1] > 145 && setup.bounds[3] > 60, JSON.stringify(setup.bounds));
check("the woods stop you: trees, stumps, logs, the wall and the stem are colliders out there", setup.out > 300 && setup.tall > 150, `${setup.out} out past the village (${setup.tall} tall), ${setup.total} in all`);
check("the floor loot reaches the woods", setup.lootOut > 15, `${setup.lootOut} of ${setup.loot} out past the village`);
check("the first circle takes in the woods", setup.zoneR > 120, `r ${setup.zoneR}`);

// The storm runs on the wall clock, and a slow renderer takes minutes to
// get this far: held back, or every circle has closed by the landing.
await page.evaluate(() => { const z = window.__trollOps.royale().zone; z.phases = z.phases.map((p) => ({ ...p, wait: p.wait * 100 })); });

// Off the ramp, then over the north-west woods (the fall's opening show is
// hands off, straight down, and on a slow renderer it lasts most of the
// fall: the faller is moved across rather than steered): you come down there.
await page.waitForFunction(() => window.__trollOps.royale().drop.phase === "run", null, { timeout: 120000 });
await page.evaluate(async () => {
  const T = window.__trollOps, r = T.royale(), t0 = r.planeT;
  T.keys.add("Space"); await new Promise((res) => setTimeout(res, 150)); T.keys.delete("Space");
  while (r.me === "aboard" && r.planeT - t0 < 8) await new Promise((res) => setTimeout(res, 50));
});
const GOAL = [-100, -35];
const moved = await page.evaluate((G) => { const f = window.__trollOps.royale().flight; if (!f) return false; f.pos.x = G[0]; f.pos.z = G[1]; return true; }, GOAL);
check("(off the ramp, falling)", moved);
let low = false;
for (let i = 0; i < 600; i++) {
  const s = await page.evaluate(() => { const T = window.__trollOps; return { me: T.royale().me, y: T.move.pos.y }; });
  if (!low && s.y < 40) { low = true; await shot("1-over-the-woods"); }
  if (s.me === "roll" || s.me === "ground") break;
  await new Promise((r) => setTimeout(r, 100));
}
await page.evaluate(() => window.__trollOps.keys.delete("KeyW"));
await page.waitForFunction(() => window.__trollOps.royale().me === "ground", null, { timeout: 90000 }).catch(() => {});
const landed = await page.evaluate(() => { const T = window.__trollOps; return { me: T.royale().me, x: T.move.pos.x, y: T.move.pos.y, z: T.move.pos.z, hp: T.player.hp }; });
check("glide out over the woods and you land out there, on your feet", landed.me === "ground" && !inVillage(landed.x, landed.z) && inside(S.open, landed.x, landed.z) && landed.y < 3,
  JSON.stringify({ me: landed.me, x: +landed.x.toFixed(1), y: +landed.y.toFixed(1), z: +landed.z.toFixed(1), hp: landed.hp }));
await shot("2-landed-in-the-woods");

// Walk on west, past the beach: the outline holds you on the island.
const walked = await page.evaluate(async () => {
  const T = window.__trollOps;
  T.look.yaw = Math.PI / 2; T.look.pitch = 0;   // (yaw pi/2: facing -x)
  T.keys.add("KeyW"); T.keys.add("ShiftLeft");
  let minX = Infinity;
  for (let i = 0; i < 160; i++) { await new Promise((r) => setTimeout(r, 100)); minX = Math.min(minX, T.move.pos.x); }
  T.keys.delete("KeyW"); T.keys.delete("ShiftLeft");
  return { minX, x: T.move.pos.x, z: T.move.pos.z };
});
check("walk on for the cliff and the outline stops you on the island", inside(S.open, walked.x, walked.z) && walked.minX > -146, JSON.stringify({ minX: +walked.minX.toFixed(1), z: +walked.z.toFixed(1) }));
await shot("3-the-edge");

await page.waitForFunction(() => { const T = window.__trollOps; return T.royale().live && T.royale().drop.phase === "done" && T.bots.bots.every((b) => !b.alive || !b.airborne); }, null, { timeout: 150000 }).catch(() => {});
const bots = await page.evaluate(() => window.__trollOps.bots.bots.filter((b) => b.alive).map((b) => [b.pos.x, b.pos.z, b.pos.y]));
const outside = bots.filter(([x, z]) => !inside(S.open, x, z)).length, woods = bots.filter(([x, z]) => !inVillage(x, z)).length;
check("every bot comes down inside the outline", bots.length >= 18 && outside === 0, `${outside} of ${bots.length} outside`);
await new Promise((r) => setTimeout(r, 6000));
const bots2 = await page.evaluate(() => window.__trollOps.bots.bots.filter((b) => b.alive).map((b) => [b.pos.x, b.pos.z]));
check("... and stays inside it, finding their way about", bots2.every(([x, z]) => inside(S.open, x, z)), `${bots2.filter(([x, z]) => !inside(S.open, x, z)).length} out, ${woods} in the woods`);

// Closed again (the match over): the village exactly as it was, walls and
// all. (openIsland on a stand-in village: one of its walls, one house.)
const closed = await page.evaluate(async (B) => {
  const T = window.__trollOps, V = T.THREE.Vector3;
  // (its own copy of the module, off any tag: its shapes fetched afresh)
  const m = await import(new URL("assets/games/troll-ops/maps/hollowgrin-island.js?v=test", location.href).href);
  await m.islandShapes();
  const wall = { min: new V(B.minX - 1.4, 0, B.minZ - 1.4), max: new V(B.maxX + 1.4, 8, B.minZ), pen: 0.9 };
  const house = { min: new V(0, 0, 0), max: new V(4, 3, 4), pen: 4 };
  const village = [house, wall], ar = { ...B, edge: null };
  const h = m.openIsland({ colliders: village, arena: ar, bounds: B, ring: new Map(), isWall: (c) => c === wall });
  const opened = { n: village.length, wall: village.includes(wall), house: village.includes(house), edge: !!ar.edge, minX: ar.minX };
  h.close();
  h.close();   // (twice is once)
  return { opened, n: village.length, wall: village.includes(wall), house: village.includes(house), edge: ar.edge, box: [ar.minX, ar.maxX, ar.minZ, ar.maxZ] };
}, B);
check("closed again, the village is back as it was: its walls, its box, no edge",
  closed.opened.n > 10 && !closed.opened.wall && closed.opened.house && closed.opened.edge && closed.opened.minX < -140
  && closed.n === 2 && closed.wall && closed.house && closed.edge === null && closed.box.join() === [B.minX, B.maxX, B.minZ, B.maxZ].join(),
  JSON.stringify(closed));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
