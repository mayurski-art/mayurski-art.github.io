// Troll Forces Trollsaber, as other people see it: the guard pose and the
// blade's sounds reach the other client, a deflect sparks on everyone's
// screen and tells the shooter DEFLECTED, and bots stop shooting into a
// guard that faces them (they flank and throw instead).
//
// Part 1 drives bots.js directly (one bot, one target, no map) so the
// numbers don't depend on spawns. Part 2 is two tabs in one private room
// over BroadcastChannel (Supabase blocked), like troll-ops-emote-test.mjs.
// Screenshots go to OUT.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-saber-mp-test.mjs

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

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());
// Where the rig's fists and blade tip are (the page's CSP rules out eval,
// so the helper goes in ahead of it).
await ctx.addInitScript(() => {
  window.__measure = (rig) => {
    const THREE = window.__trollOps.THREE, p = rig.parts;
    rig.root.updateMatrixWorld(true);
    const w = (o) => o.getWorldPosition(new THREE.Vector3());
    let tip = null;
    p.gripR.traverse((o) => { if (o.userData.saber && !tip) tip = o.localToWorld(o.userData.saber.tipLocal.clone()); });
    return { hands: +w(p.handL).distanceTo(w(p.handR)).toFixed(2), tipOverHead: tip ? +(tip.y - w(p.head).y).toFixed(2) : null };
  };
});
const errors = [];

// ---- Part 1: bots vs a guard ------------------------------------------
const sim = await ctx.newPage();
sim.on("pageerror", (e) => errors.push(`sim: ${e.message}`));
await sim.goto(`${BASE}/troll-ops.html`);
await sim.waitForFunction(() => !!document.querySelector("script[type=importmap]"), null, { timeout: 30000 });
const runBot = (opts) => sim.evaluate(async ({ difficulty, blocking, facing }) => {
  const THREE = await import("three");
  const { BotManager } = await import("/assets/games/troll-ops/bots.js?v=to-sb1");
  // Seeded, so the one-in-N "let this throw go" roll is the same every run.
  let seed = 7;
  Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const bm = new BotManager();
  bm.difficulty = difficulty;
  bm.fill(1, 0, () => ({ x: 0, z: -12 }), true);
  const bot = bm.bots[0];
  bot.nadeT = 99;        // no throws from the spawn timer: only a guard may cut it
  const me = { id: "me", team: "other", alive: true, pos: new THREE.Vector3(0, 0, 0), groundY: 0,
    // yaw 0 faces -Z, straight at the bot; PI faces away
    yaw: facing ? 0 : Math.PI, blocking, blockCone: 0.26 };
  let shots = 0, lateShots = 0, throws = 0, t = 0;
  const start = bot.pos.clone();
  const ctx = {
    colliders: [], arena: { minX: -60, maxX: 60, minZ: -60, maxZ: 60 }, targets: [me], ffa: true,
    onShoot: () => { shots++; if (t > 1) lateShots++; },
    onThrow: () => { throws++; return true; },
  };
  for (let i = 0; i < 240; i++) { t = i / 60; bot.update(1 / 60, ctx); }
  const dx = bot.pos.x - start.x, dz = bot.pos.z - start.z;
  return { shots, lateShots, throws, guarded: !!bot.guarded, sideways: Math.abs(dx), dist: Math.hypot(bot.pos.x, bot.pos.z), dz };
}, opts);

const open = await runBot({ difficulty: "veteran", blocking: false, facing: true });
check("veteran shoots an unguarded target", open.shots >= 3 && open.throws === 0, JSON.stringify(open));
const guard = await runBot({ difficulty: "veteran", blocking: true, facing: true });
check("veteran stops shooting into a guard that faces it", guard.guarded && guard.lateShots === 0 && guard.shots <= 1, JSON.stringify(guard));
check("veteran throws at a guard instead", guard.throws >= 1, JSON.stringify(guard));
check("veteran flanks a guard (moves sideways)", guard.sideways > 5, JSON.stringify(guard));
const reg = await runBot({ difficulty: "regular", blocking: true, facing: true });
check("regular catches on after a beat", reg.lateShots === 0, JSON.stringify(reg));
const back = await runBot({ difficulty: "veteran", blocking: true, facing: false });
check("a guard facing away doesn't stop the bot", !back.guarded && back.shots >= 3, JSON.stringify(back));
const rookie = await runBot({ difficulty: "recruit", blocking: true, facing: true });
check("recruits keep shooting into the guard", rookie.lateShots >= 1, JSON.stringify(rookie));
await sim.close();

// ---- Part 2: two clients ----------------------------------------------
const ROOM = "SAB" + Math.floor(Math.random() * 90 + 10);
async function join(label, melee) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async ({ room, melee }) => {
    const T = window.__trollOps;
    T.loadout.meleeId = melee;
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  }, { room: ROOM, melee });
  return page;
}
const A = await join("A", "trollsaber");
const B = await join("B", "keyboard");
await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 60000 })));
await sleep(1500);

// A and B 5 m apart, facing each other, on opposite teams.
const teamA = await A.evaluate(() => window.__trollOps.net.team);
await B.evaluate((t) => window.__trollOps.net.setTeam(t === "phantom" ? "ghost" : "phantom"), teamA);
async function place(page, x, z, yaw) {
  await page.evaluate(({ x, z, yaw }) => {
    const T = window.__trollOps;
    T.move.pos.x = x; T.move.pos.z = z; T.player.pos.x = x; T.player.pos.z = z;
    if (T.move.velocity) T.move.velocity.set(0, 0, 0);
    T.player.spawnGuard = 999; T.player.hp = 100;
    T.look.yaw = yaw; T.look.pitch = 0;
  }, { x, z, yaw });
}
const spot = await A.evaluate(() => { const p = window.__trollOps.move.pos; return { x: p.x, z: p.z }; });
await place(A, spot.x, spot.z + 2.5, 0);
await place(B, spot.x, spot.z - 2.5, Math.PI);
const aId = await A.evaluate(() => window.__trollOps.net.id);
const bId = await B.evaluate(() => window.__trollOps.net.id);

// B listens for A's saber sounds.
await B.evaluate(() => {
  const a = window.__trollOps.audio;
  window.__sfx = [];
  for (const k of ["saberIgnite", "saberRetract", "saberSwing", "saberClash"]) {
    const f = a[k].bind(a);
    a[k] = (at) => { window.__sfx.push({ k, at: !!at }); return f(at); };
  }
  const h = a.saberHumAt.bind(a);
  a.saberHumAt = (level, at) => { if (level >= 0 && at) window.__hum = (window.__hum || 0) + 1; return h(level, at); };
});

// A draws the saber.
await A.evaluate(() => { const T = window.__trollOps; T.breakSpawnGuard(); T.player.spawnGuard = 999; T.setHolding("melee"); });
await sleep(1200);
let seen = await B.evaluate((id) => {
  const rp = window.__trollOps.remotes.byId.get(id);
  return { out: !!rp?.saberOut, lit: !!rp?.saber?.lit, sfx: window.__sfx.map((s) => s.k), hum: window.__hum | 0 };
}, aId);
check("the other client sees the blade in A's hand, lit", seen.out && seen.lit, JSON.stringify(seen));
check("and hears it ignite, where A is", seen.sfx.includes("saberIgnite"), JSON.stringify(seen.sfx));
await sleep(1000);
seen.hum = await B.evaluate(() => window.__hum | 0);
check("and hears A's blade humming", seen.hum >= 3, `${seen.hum} hum frames`);

// Arm pose before the guard, for comparison.
const armBefore = await B.evaluate((id) => window.__measure(window.__trollOps.remotes.byId.get(id).rig), aId);

// A raises the guard.
await A.evaluate(() => window.__trollOps.setAds(true));
await sleep(900);
seen = await B.evaluate((id) => {
  const rp = window.__trollOps.remotes.byId.get(id);
  return { blocking: !!rp.peer.blocking, blockT: rp.blockT, ...window.__measure(rp.rig) };
}, aId);
check("A's guard reaches B over the wire", seen.blocking && seen.blockT > 0.9, JSON.stringify(seen));
check("B sees A's body in the guard (both fists on the hilt, blade up)", armBefore.hands > 0.3 && seen.hands < 0.2 && seen.tipOverHead > 0.2, JSON.stringify({ armBefore, seen }));
// B's view of A blocking.
await B.evaluate(() => { const T = window.__trollOps; T.look.pitch = -0.08; });
await sleep(300);
await shot(B, "sab-mp-guard-from-b.png");

// A's own body in third person holds the guard too.
const tp = await A.evaluate(async () => {
  const T = window.__trollOps;
  T.toggleThirdPerson();
  await new Promise((r) => setTimeout(r, 500));
  return window.__measure(T.localRig);
});
check("A's own third-person body holds the guard", tp.hands < 0.2 && tp.tipOverHead > 0.2, JSON.stringify(tp));
await shot(A, "sab-mp-guard-3p.png");
await A.evaluate(() => window.__trollOps.toggleThirdPerson());

// B shoots A from the front: A's blade eats it, B sees sparks + DEFLECTED.
const bPos = await B.evaluate(() => { const p = window.__trollOps.move.pos; return { x: p.x, y: p.y, z: p.z }; });
const hit = await A.evaluate(({ bId, bPos }) => {
  const T = window.__trollOps;
  T.player.spawnGuard = 0;
  const hp0 = T.player.hp;
  T.damagePlayer(30, bId, "problem416", false, new T.THREE.Vector3(bPos.x, bPos.y, bPos.z));
  return { hp0, hp1: T.player.hp };
}, { bId, bPos });
check("A deflects B's round", hit.hp1 === hit.hp0, JSON.stringify(hit));
await sleep(500);
const told = await B.evaluate(() => ({
  words: [...document.querySelectorAll(".to-dmg-num.is-word")].map((e) => e.textContent),
  clash: window.__sfx.some((s) => s.k === "saberClash" && s.at),
}));
check("B sees DEFLECTED where the round met A's blade", told.words.includes("DEFLECTED"), JSON.stringify(told));
check("B hears the clash at A", told.clash, JSON.stringify(told));
await shot(B, "sab-mp-deflect-from-b.png");

// Guard down, swing: B hears it.
await A.evaluate(() => window.__trollOps.setAds(false));
await sleep(500);
const down = await B.evaluate((id) => window.__trollOps.remotes.byId.get(id).blockT, aId);
check("guard down reaches B", down < 0.1, `blockT ${down.toFixed(2)}`);
await A.evaluate(() => { const T = window.__trollOps; T.look.yaw = Math.PI / 2; T.swingMelee(); });
await sleep(700);
const swung = await B.evaluate(() => window.__sfx.filter((s) => s.k === "saberSwing").length);
check("B hears A's saber swing", swung >= 1, `${swung}`);

// Back to the gun: the blade goes out on B's screen, with the sound.
await A.evaluate(() => window.__trollOps.setHolding("gun"));
await sleep(900);
seen = await B.evaluate((id) => {
  const rp = window.__trollOps.remotes.byId.get(id);
  return { out: rp.saberOut, sfx: window.__sfx.map((s) => s.k) };
}, aId);
check("putting it away retracts it on B's screen", !seen.out && seen.sfx.includes("saberRetract"), JSON.stringify(seen));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
