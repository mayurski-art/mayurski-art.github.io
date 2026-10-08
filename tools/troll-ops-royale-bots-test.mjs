// Troll Royale phase 2: bots that play battle royale. One tab, you stay
// spawn-protected (bots ignore you) and watch: bots land with a pistol, loot
// guns, plates and Hopium, plate up, move for the zone even mid-fight, and
// head for gunfire once armed. Then the phase 2 gate: frame rate and bot
// cost with 18 bots on this one browser. Screenshots go to OUT.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-bots-test.mjs

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
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });

async function start(mode, players = null) {
  await page.evaluate(async ({ mode, players }) => {
    const T = window.__trollOps;
    if (players) { T.__players0 = T.__players0 ?? T.ROYALE.players; T.ROYALE.players = players; }
    else if (T.__players0) T.ROYALE.players = T.__players0;
    T.loadout.mapId = "grinbeach";   // TDM baseline on the same map
    T.setMode(mode);
    T.els.room.value = mode === "royale_mini" ? "QTRM" : ""; T.els.room.dispatchEvent(new Event("input"));
    if (T.els.noBots) T.els.noBots.checked = false;
    await T.startGame();
  }, { mode, players });
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 60000 });
  // Out of the fight: spawn protection keeps bots off us.
  await page.evaluate(() => { window.__trollOps.player.spawnGuard = 1e9; });
}
const botState = () => page.evaluate(() => {
  const T = window.__trollOps;
  return T.bots.bots.map((b) => ({ id: b.id, alive: b.alive, w: b.weaponId, r: b.gunRarity, plates: b.plates | 0, heals: b.heals | 0, armor: b.armor | 0, x: b.pos.x, z: b.pos.z, loot: b.lootId }));
});

await start("royale_mini");
let bs = await botState();
check("bots land with only a pistol", bs.length === 9 && bs.every((b) => b.w === "sixtynine" && b.r == null), JSON.stringify(bs.map((b) => b.w)));
const loot0 = await page.evaluate(() => window.__trollOps.royale().loot.items.size);

// Let them play the opening (zone 1 waits 45 s): loot, plate up.
let armoredSeen = 0, headingForLoot = 0;
for (let i = 0; i < 12; i++) {
  await sleep(2000);
  const s = await botState();
  armoredSeen = Math.max(armoredSeen, s.filter((b) => b.armor > 0).length);
  headingForLoot = Math.max(headingForLoot, s.filter((b) => b.loot).length);
}
bs = await botState();
const loot1 = await page.evaluate(() => window.__trollOps.royale().loot.items.size);
const t1 = await page.evaluate(() => window.__trollOps.royale().t);
const armed = bs.filter((b) => b.r != null).length;
const stocked = bs.filter((b) => b.r != null || b.plates || b.heals || b.armor).length;
check("bots go for loot", headingForLoot >= 4, `${headingForLoot} heading for an item at once`);
check("bots loot guns off the floor", armed >= 3, `${armed}/9 armed after ${t1.toFixed(0)} s`);
check("most bots have picked something up", stocked >= 5 && loot1 < loot0, JSON.stringify({ stocked, loot0, loot1 }));
check("bots put plates on", armoredSeen >= 1, `${armoredSeen} wearing armour at once`);
await shot(page, "royale-bots-opening.png");

// Their damage follows the gun: pistol weak, rarer loot harder.
const dmg = await page.evaluate(() => {
  const T = window.__trollOps;
  const b = { gunRarity: null }, g0 = { gunRarity: 0 }, g4 = { gunRarity: 4 };
  return [T.royaleBotDamage(b, 20), T.royaleBotDamage(g0, 20), T.royaleBotDamage(g4, 20)].map((x) => +x.toFixed(1));
});
check("bot damage follows its gun", dmg[0] < dmg[1] && dmg[1] < dmg[2], JSON.stringify(dmg));

// Bot armour soaks gunfire but not the Cringe.
const soak = await page.evaluate(() => {
  const T = window.__trollOps, b = T.bots.bots.find((x) => x.alive);
  b.armor = 50; b.hp = 100;
  T.bots.applyHit(b.id, 30);
  const afterGun = { armor: b.armor, hp: b.hp };
  T.bots.applyHit(b.id, 10, { pierce: true });
  return { afterGun, afterZone: { armor: b.armor, hp: b.hp } };
});
check("bot armour soaks gunfire, not the Cringe", soak.afterGun.armor === 20 && soak.afterGun.hp === 100 && soak.afterZone.hp === 90 && soak.afterZone.armor === 20, JSON.stringify(soak));

// Gunfire draws an armed bot with nothing better to do.
const heard = await page.evaluate(() => {
  const T = window.__trollOps, r = T.royale();
  const b = T.bots.bots.find((x) => x.alive);
  b.gunRarity = 4; b.plates = 3; b.heals = 2; b.lootId = null; b.lastTargetId = null;
  const s = r.zone.state(r.t);
  // Somewhere 20 m off, inside the circle.
  const a = Math.atan2(s.z - b.pos.z, s.x - b.pos.x);
  T.royaleNoise(b.pos.x + Math.cos(a) * 20, b.pos.z + Math.sin(a) * 20, "someone");
  const o = T.royaleBotObjective(b);
  return o?.id || null;
});
check("an armed bot heads for nearby gunfire", /^noise-/.test(heard || ""), heard);

// The zone moves them, even under fire: jump to zone 2 closing and watch.
const rot = await page.evaluate(async () => {
  const T = window.__trollOps, r = T.royale();
  r.t = 95;
  const s0 = r.zone.state(r.t);
  // Three bots out past the edge, where the circle is farthest.
  const bnd = T.builtMap().map.bounds;
  const corners = [[bnd.minX + 2, bnd.minZ + 2], [bnd.maxX - 2, bnd.minZ + 2], [bnd.minX + 2, bnd.maxZ - 2], [bnd.maxX - 2, bnd.maxZ - 2]]
    .sort((p, q) => Math.hypot(q[0] - s0.x, q[1] - s0.z) - Math.hypot(p[0] - s0.x, p[1] - s0.z));
  T.bots.bots.filter((b) => b.alive).slice(0, 3).forEach((b, i) => { b.pos.x = corners[0][0] + i * 1.5; b.pos.z = corners[0][1]; b.hp = 100; });
  const out0 = T.bots.bots.filter((b) => b.alive && Math.hypot(b.pos.x - s0.x, b.pos.z - s0.z) > s0.r);
  const d0 = out0.map((b) => Math.hypot(b.pos.x - s0.next.x, b.pos.z - s0.next.z));
  const urgent = out0.filter((b) => T.royaleBotObjective(b)?.urgent).length;
  await new Promise((res) => setTimeout(res, 6000));
  const s1 = r.zone.state(r.t);
  const d1 = out0.map((b) => Math.hypot(b.pos.x - s1.next.x, b.pos.z - s1.next.z));
  const closer = out0.filter((b, i) => !b.alive || d1[i] < d0[i] - 2).length;
  return { outside: out0.length, urgent, closer };
});
check("bots outside the circle run for it (urgently)", rot.outside >= 3 && (rot.urgent === rot.outside && rot.closer >= Math.ceil(rot.outside * 0.6)), JSON.stringify(rot));
await shot(page, "royale-bots-rotate.png");

// ---- the gate: frame rate + bot cost ----------------------------------------
async function measure(label) {
  return page.evaluate(async () => {
    const T = window.__trollOps, bm = T.bots;
    const orig = bm.update.bind(bm);
    let ms = 0, calls = 0;
    bm.update = (dt, ctx) => { const t0 = performance.now(); const r = orig(dt, ctx); ms += performance.now() - t0; calls++; return r; };
    await new Promise((res) => setTimeout(res, 4000));   // let the auto graphics tier settle
    ms = 0; calls = 0;
    let frames = 0;
    const t0 = performance.now();
    await new Promise((res) => { const tick = () => { frames++; if (performance.now() - t0 < 6000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    const secs = (performance.now() - t0) / 1000;
    bm.update = orig;
    return { fps: +(frames / secs).toFixed(1), botMs: +(ms / Math.max(1, calls)).toFixed(2), bots: bm.bots.filter((b) => b.alive).length };
  });
}
await start("tdm");
const tdm = await measure();
await start("royale_mini");
const r10 = await measure();
await start("royale_mini", 19);
const r18 = await measure();
console.log(`      perf: TDM ${JSON.stringify(tdm)}  Royale-9 ${JSON.stringify(r10)}  Royale-18 ${JSON.stringify(r18)}`);
check("18 bots on one browser: frame rate holds", r18.bots >= 15 && r18.fps >= Math.min(30, tdm.fps * 0.75), JSON.stringify(r18));
check("18 bots on one browser: bot AI stays cheap (< 4 ms a frame)", r18.botMs < 4, `${r18.botMs} ms`);
await shot(page, "royale-bots-18.png");

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
