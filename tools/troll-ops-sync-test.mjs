// Two-client check for Troll Ops multiplayer sync: grenades, smoke, fire,
// flashes, remote tracers, bot gunfire and cook-off.
//
// Two tabs in one headless browser join the same private room. Supabase is
// blocked so they link over BroadcastChannel, the game's same-browser
// fallback. Everything is driven through the ?tohooks=1 test hooks.
//
// Usage: node tools/troll-ops-sync-test.mjs
//   Needs Playwright (npm i -g playwright, or run from a checkout that has it).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.execPath, "../../lib/node_modules/playwright"))); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };

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

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 320, height: 200 } });
await ctx.route(/supabase/, (r) => r.abort());   // force the BroadcastChannel transport

const ROOM = "SYNC" + Math.floor(Math.random() * 9);
const errors = [];

async function open(label, noBots, mode = "tdm", room = ROOM) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async ({ room, noBots, mode }) => {
    const T = window.__trollOps;
    // Software GL manages ~3fps, and the sim caps each frame at 50ms, so
    // game time would crawl. Nothing here checks pixels: skip drawing.
    T.composer.render = () => {};
    T.setMode(mode);
    T.loadout.lethalId = "frag";
    T.loadout.tacticalId = "flash";
    if (T.els.noBots) T.els.noBots.checked = noBots;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    // Count remote shots by sender, so bot fire can be told from player fire.
    window.__shots = {};
    const orig = T.net.h.onRemoteShot;
    // Tracers drawn per sender, measured around the handler itself.
    window.__tracers = {};
    const cosmetic = () => T.bullets.bullets.filter((b) => b.cosmetic).length;
    T.net.h.onRemoteShot = (p, m) => {
      window.__shots[m.id] = (window.__shots[m.id] || 0) + 1;
      const before = cosmetic();
      const r = orig(p, m);
      window.__tracers[m.id] = (window.__tracers[m.id] || 0) + cosmetic() - before;
      return r;
    };
    await T.startGame();
  }, { room, noBots, mode });
  return page;
}

const A = await open("A", false);
const B = await open("B", false);

// Wait out staging on both.
await Promise.all([A, B].map((p) => p.waitForFunction(() => {
  const T = window.__trollOps; return T.state() === "playing" && T.stageT() <= 0;
}, null, { timeout: 30000 }).catch(async (e) => { console.log(await p.evaluate(() => { const T = window.__trollOps; return JSON.stringify({ s: T.state(), st: T.stageT(), own: T.stageOwner(), team: T.net.team, kind: T.net.transport?.kind }); })); throw e; })));

const info = await Promise.all([A, B].map((p) => p.evaluate(() => {
  const T = window.__trollOps;
  return { id: T.net.id, team: T.net.team, kind: T.net.transport?.kind, peers: [...T.net.peers.keys()].filter((k) => !k.startsWith("bot-")) };
})));
check("both tabs joined the same room over BroadcastChannel", info[0].kind === "tabs" && info[1].kind === "tabs"
  && info[0].peers.includes(info[1].id) && info[1].peers.includes(info[0].id), JSON.stringify(info));
check("the two humans are on opposite teams", info[0].team && info[1].team && info[0].team !== info[1].team, `A ${info[0].team}, B ${info[1].team}`);
await sleep(1500);
const sides = (await Promise.all([A, B].map((p) => p.evaluate(() => {
  const T = window.__trollOps, n = { phantom: 0, ghost: 0 };
  for (const b of T.bots.bots) n[b.team]++;
  return T.bots.bots.length ? n : null;
})))).find(Boolean);
if (sides) { sides[info[0].team]++; sides[info[1].team]++; }
check("bots pad the room to 4v4", sides && sides.phantom === 4 && sides.ghost === 4, JSON.stringify(sides));

// Put A in the middle of the map, B nearby, both invulnerable to stray bots.
async function place(page, x, z, yaw = 0) {
  await page.evaluate(({ x, z, yaw }) => {
    const T = window.__trollOps;
    T.move.pos.x = x; T.move.pos.z = z;
    if (T.move.velocity) T.move.velocity.set(0, 0, 0);
    T.player.pos.x = x; T.player.pos.z = z; T.player.spawnGuard = 999;
    T.player.hp = T.player.maxHp || 100;
    if (T.look) T.look.yaw = yaw;
  }, { x, z, yaw });
}
const mid = await A.evaluate(() => {
  const b = window.__trollOps.builtMap();
  const a = b.arena || b.map?.arena;
  return a ? { x: (a.minX + a.maxX) / 2, z: (a.minZ + a.maxZ) / 2 } : { x: 0, z: 0 };
});

// Stand a player back up, too tough to die mid-check: bots shoot and throw
// frags at the test players the whole time, and a dead player can't throw.
async function revive(page) {
  await page.evaluate(() => {
    const T = window.__trollOps;
    if (!T.player.alive) T.respawnPlayer();
    T.player.maxHp = 100000; T.player.hp = 100000;
  });
}

// Throw from A with a fixed loadout slot, return what A saw. Only A's own
// grenades count: bots throw theirs into the same list.

async function throwFrom(page, slot, defId) {
  return page.evaluate(({ slot, defId }) => {
    const T = window.__trollOps;
    if (slot === "lethal") T.loadout.lethalId = defId; else T.loadout.tacticalId = defId;
    T.player.gear[slot] = 3;
    T.startCook(slot);
    T.releaseCook();
    const g = T.grenades.live.filter((x) => x.ownerId === "player").at(-1);
    return { gid: g?.gid, remote: g?.remote };
  }, { slot, defId });
}
const remoteCopy = (page, gid) => page.evaluate((gid) => {
  const g = window.__trollOps.grenades.live.find((x) => x.gid === gid);
  return g ? { remote: g.remote, x: g.pos.x, y: g.pos.y, z: g.pos.z } : null;
}, gid);
const spent = (page, gid) => page.evaluate((gid) => window.__trollOps.grenades.spent.has(gid), gid);

// ---------- 1. frag: flies on B, goes off once on B
await place(A, mid.x, mid.z); await place(B, mid.x + 30, mid.z + 30);
await revive(A); await revive(B);
const frag = await throwFrom(A, "lethal", "frag");
check("frag gets a network id on the thrower", !!frag.gid && !frag.remote, JSON.stringify(frag));
await sleep(400);
const fragOnB = await remoteCopy(B, frag.gid);
check("frag is flying on the other client", !!fragOnB && fragOnB.remote === true, JSON.stringify(fragOnB));
await sleep(4200);
check("frag detonated on the thrower", await spent(A, frag.gid));
check("frag detonated on the other client", await spent(B, frag.gid));
check("frag is gone from the other client", !(await remoteCopy(B, frag.gid)));

// ---------- 2. smoke: the cloud sits in the same place on both
const smoke = await throwFrom(A, "tactical", "smoke");
await sleep(3500);
const clouds = await Promise.all([A, B].map((p) => p.evaluate(() =>
  window.__trollOps.grenades.clouds.map((c) => ({ x: c.pos.x, z: c.pos.z }))
)));
const cA = clouds[0].at(-1), cB = clouds[1].at(-1);
check("smoke cloud exists on both clients", !!cA && !!cB, JSON.stringify(clouds));
if (cA && cB) check("smoke cloud lands in the same spot", Math.hypot(cA.x - cB.x, cA.z - cB.z) < 0.05,
  `A ${cA.x.toFixed(2)},${cA.z.toFixed(2)} B ${cB.x.toFixed(2)},${cB.z.toFixed(2)}`);
const blocks = await B.evaluate(({ c }) => {
  const T = window.__trollOps, V = T.THREE.Vector3;
  return T.grenades.blocksSight(new V(c.x - 8, 1.5, c.z), new V(c.x + 8, 1.5, c.z));
}, { c: cB || { x: 0, z: 0 } });
check("smoke blocks sight on the other client", blocks === true);
check("smoke grenade spent on both", (await spent(A, smoke.gid)) && (await spent(B, smoke.gid)));

// ---------- 3. firebomb: pool on both, same spot, B's copy does no damage
await revive(A);
const fire = await throwFrom(A, "lethal", "firebomb");
await sleep(2500);
const pools = await Promise.all([A, B].map((p) => p.evaluate(() =>
  window.__trollOps.grenades.pools.map((q) => ({ x: q.pos.x, z: q.pos.z, remote: !!q.remote }))
)));
const pA = pools[0].at(-1), pB = pools[1].at(-1);
check("fire pool exists on both clients", !!pA && !!pB, JSON.stringify(pools));
if (pA && pB) {
  check("fire pool lands in the same spot", Math.hypot(pA.x - pB.x, pA.z - pB.z) < 0.05);
  check("fire pool is local on thrower, remote on the other", !pA.remote && pB.remote);
}
check("firebomb goes off once on the other client", await spent(B, fire.gid));

// ---------- 4. flash: an enemy in range is blinded, a teammate is spared
async function flashTest(teamSame) {
  await B.evaluate((t) => { window.__trollOps.net.team = t; }, teamSame ? info[0].team : (info[0].team === "phantom" ? "ghost" : "phantom"));
  // Away from the smoke thrown earlier: a cloud between B and the bang
  // would (correctly) eat the flash.
  await place(B, mid.x + 12, mid.z + 12);
  await sleep(200);
  const at = await B.evaluate(() => {
    const T = window.__trollOps, f = new T.THREE.Vector3();
    T.camera.getWorldDirection(f); f.y = 0; f.normalize();
    T.player.spawnGuard = 0;
    return { x: T.move.pos.x + f.x * 3, z: T.move.pos.z + f.z * 3 };
  });
  // Send the boom straight from A so the result doesn't depend on bounces.
  await A.evaluate(({ x, z }) => {
    const T = window.__trollOps;
    T.net.publishNade({ action: "boom", gid: `${T.net.id}-flashtest-${Math.random()}`, def: "flash", x, y: 1.2, z });
  }, at);
  await sleep(300);
  return B.evaluate(() => window.__trollOps.blindT());
}
const blindEnemy = await flashTest(false);
check("enemy flash blinds the other client", blindEnemy > 0, `blindT ${blindEnemy.toFixed?.(2)}`);
await sleep(4500);   // let it wear off
const blindFriend = await flashTest(true);
check("teammate's flash does not blind", blindFriend <= 0.01, `blindT ${blindFriend.toFixed?.(2)}`);
await B.evaluate((t) => { window.__trollOps.net.team = t; }, info[1].team);

// ---------- 5. cook-off in hand: one explosion on thrower, one boom remotely
// Throwing breaks spawn protection, so by now bots may have killed A — and a
// dead player can't cook. Stand A back up, too tough to die mid-check.
await revive(A);
const spentOnB = () => B.evaluate((id) => [...window.__trollOps.grenades.spent].filter((g) => g.startsWith(id)).length, info[0].id);
const bSpentBefore = await spentOnB();
const cook = await A.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.lethalId = "frag";
  T.player.gear.lethal = 2;
  T.player.hp = 100000; T.player.maxHp = 100000;
  let fx = 0;
  const mine = () => T.grenades.live.filter((g) => g.ownerId === "player").length;
  const liveBefore = mine();
  T.startCook("lethal");
  const start = performance.now();
  while (T.cooking.def && performance.now() - start < 6000) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 500));
  return { stillCooking: !!T.cooking.def, gearLeft: T.player.gear.lethal, liveAfter: mine(), liveBefore };
});
check("cooked-off frag still goes off on the other client", (await spentOnB()) === bSpentBefore + 1);
check("cooked-off frag leaves the hand spent, not thrown", !cook.stillCooking && cook.gearLeft === 1 && cook.liveAfter === cook.liveBefore, JSON.stringify(cook));

// ---------- 6. held smoke doesn't burn down
await revive(A);
const held = await A.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.tacticalId = "smoke";
  T.player.gear.tactical = 2;
  T.startCook("tactical");
  await new Promise((r) => setTimeout(r, 2600));   // longer than smoke's 1.6s fuse
  const r = { cooking: !!T.cooking.def, fuse: T.cooking.fuse, gear: T.player.gear.tactical };
  T.releaseCook();
  return r;
});
check("held smoke keeps its fuse and stays in hand", held.cooking && held.fuse >= 1.59 && held.gear === 2, JSON.stringify(held));

// ---------- 7. player shots: B draws cosmetic tracers from A's gun
await place(A, mid.x, mid.z); await place(B, mid.x + 40, mid.z + 40);
const beforeShots = await B.evaluate((id) => window.__shots[id] || 0, info[0].id);
const ownCosmetic = await A.evaluate(async () => {
  const T = window.__trollOps;
  let n = 0;
  const spawn = T.bullets.spawn.bind(T.bullets);
  T.bullets.spawn = (o) => { if (o.cosmetic && o.ownerId !== "remote") n++; return spawn(o); };
  let own = 0;
  const count = () => T.bullets.bullets.filter((b) => !b.cosmetic).length;
  for (let i = 0; i < 5; i++) {
    const w = T.currentWeapon(); if (w.mag != null) w.mag = 30;
    const before = count();
    T.fireOnce();
    own += count() - before;
    await new Promise((r) => setTimeout(r, 60));
  }
  T.bullets.spawn = spawn;
  return { cosmeticFromOwnGun: n, realRounds: own };
});
await sleep(300);
const cosmetic = await B.evaluate((id) => window.__tracers[id] || 0, info[0].id);
const afterShots = await B.evaluate((id) => window.__shots[id] || 0, info[0].id);
check("other client receives A's shots", afterShots > beforeShots, `${afterShots - beforeShots} shots`);
check("other client draws a cosmetic tracer for them", cosmetic > 0, `${cosmetic} tracers`);
check("shooter fires real rounds and no cosmetic copy of its own", ownCosmetic.realRounds > 0 && ownCosmetic.cosmeticFromOwnGun === 0, JSON.stringify(ownCosmetic));

// ---------- 8. bot fire reaches the non-host
await sleep(8000);
const botShots = await Promise.all([A, B].map((p) => p.evaluate(() =>
  Object.entries(window.__shots).filter(([k]) => k.startsWith("bot-")).reduce((s, [, n]) => s + n, 0))));
const botOwner = await A.evaluate(() => (window.__trollOps.bots.bots || window.__trollOps.bots.list || []).length);
check("bot gunfire is broadcast to the room", botShots[0] + botShots[1] > 0, `A heard ${botShots[0]}, B heard ${botShots[1]}, A hosts ${botOwner} bots`);

// ---------- 9. scoreboard stats cross the wire
await A.evaluate(() => { const T = window.__trollOps; T.player.kills = 5; T.player.deaths = 2; T.player.assists = 3; });
await sleep(600);
const seen = await B.evaluate((id) => { const p = window.__trollOps.net.peers.get(id); return { k: p.kills, d: p.deaths, a: p.assists }; }, info[0].id);
check("kills, deaths and assists reach the other scoreboard", seen.k === 5 && seen.d === 2 && seen.a === 3, JSON.stringify(seen));

// ---------- 10. a hit from A puts a direction marker on B's screen
await place(A, mid.x, mid.z); await place(B, mid.x + 10, mid.z);
await B.evaluate(() => { const T = window.__trollOps; T.player.spawnGuard = 0; T.player.hp = 100; });
await A.evaluate((id) => window.__trollOps.net.reportHit(id, 1, false, "problem416"), info[1].id);
await sleep(300);
const marker = await B.evaluate((id) => { const h = window.__trollOps.hitDirs.get(id); return h ? h.el.style.transform : null; }, info[0].id);
check("a hit shows a direction marker", !!marker, marker || "none");

// ---------- 11. a weapon skin reaches the other client's view of you
await A.evaluate(() => {
  const T = window.__trollOps;
  T.loadout.weaponId = "problem416";
  T.loadout.attachmentsFor("problem416").skin = "green";
  T.respawnPlayer();
  T.setHolding?.("gun");
});
await B.waitForFunction((id) => window.__trollOps.remotes.byId.get(id)?.skin === "green", info[0].id, { timeout: 5000 }).catch(() => {});
const skinSeen = await B.evaluate((id) => {
  const r = window.__trollOps.remotes.byId.get(id);
  return { weapon: r?.weaponId, skin: r?.skin, mesh: r?.weaponMesh?.userData.skin };
}, info[0].id);
check("a weapon skin shows on the other client", skinSeen.skin === "green" && skinSeen.mesh === "green", JSON.stringify(skinSeen));

// ---------- 12. a melee swing plays on the other client's view of you
await A.evaluate(() => { const T = window.__trollOps; T.player.spawnGuard = 999; T.swingMelee(); });
const swingSeen = await B.waitForFunction((id) => {
  const r = window.__trollOps.remotes.byId.get(id);
  return r?.swinging ? { sword: !!r.meleeMesh?.visible, gunHidden: r.weaponMesh ? !r.weaponMesh.visible : true } : null;
}, info[0].id, { timeout: 5000 }).then((h) => h.jsonValue()).catch(() => null);
check("a melee swing plays on the other client", !!swingSeen && swingSeen.sword && swingSeen.gunHidden, JSON.stringify(swingSeen));
const swingDone = await B.waitForFunction((id) => {
  const r = window.__trollOps.remotes.byId.get(id);
  return r && !r.swinging && !r.meleeMesh?.visible && r.weaponMesh?.visible;
}, info[0].id, { timeout: 10000 }).then(() => true).catch(() => false);
check("the gun comes back after the remote swing", swingDone);

// ---------- 13. a bot's frag flies on the other client and hurts them
const hostIsA = await A.evaluate(() => window.__trollOps.net.isBotHost());
const [H, V] = hostIsA ? [A, B] : [B, A];
const victimId = info[hostIsA ? 1 : 0].id, victimTeam = info[hostIsA ? 1 : 0].team;
await revive(V);
await place(V, mid.x, mid.z);
await sleep(500);   // let the host's view of V catch up to the move
await V.evaluate(() => {
  const T = window.__trollOps;
  T.player.spawnGuard = 0;
  window.__nadeHits = [];
  const orig = T.net.h.onHitTaken;
  T.net.h.onHitTaken = (m) => { window.__nadeHits.push(m.w + ":" + m.id); return orig(m); };
});
const botNade = await H.evaluate(({ vid, vteam }) => {
  const T = window.__trollOps;
  const bot = T.bots.bots.find((b) => b.team !== vteam && b.alive);
  if (!bot) return null;
  const v = T.net.peers.get(vid);
  const s = v.snaps[v.snaps.length - 1];
  bot.pos.set(s.x + 4, s.y, s.z);
  bot.groundY = s.y;
  const ok = T.botThrow(bot, "frag", { x: s.x, y: s.y, z: s.z });
  const g = T.grenades.live[T.grenades.live.length - 1];
  return { ok, bot: bot.id, gid: g?.gid, owner: g?.botId, rpAlive: T.remotes.byId.get(vid)?.alive };
}, { vid: victimId, vteam: victimTeam });
check("host bot throws a frag", !!botNade?.ok && botNade.owner === botNade.bot, JSON.stringify(botNade));
await sleep(400);
const botNadeOnV = botNade && await V.evaluate((gid) => {
  const g = window.__trollOps.grenades.live.find((x) => x.gid === gid);
  return g ? { remote: g.remote, owner: g.ownerId } : null;
}, botNade.gid);
check("the bot's frag flies on the other client", !!botNadeOnV && botNadeOnV.remote && botNadeOnV.owner === botNade.bot, JSON.stringify(botNadeOnV));
await sleep(4500);
const nadeHits = await V.evaluate(() => window.__nadeHits);
check("the bot's frag damages the other client, credited to the bot",
  !!botNade && nadeHits.includes(`frag:${botNade.bot}`), JSON.stringify(nadeHits));
check("the bot's frag goes off on both clients", !!botNade && (await spent(H, botNade.gid)) && (await spent(V, botNade.gid)));

// ---------- 14. Infection: the pick, the sword, and turning on death
const IROOM = "INF" + Math.floor(Math.random() * 90 + 10);
const C = await open("C", true, "infection", IROOM);
const D = await open("D", true, "infection", IROOM);
await Promise.all([C, D].map((p) => p.waitForFunction(() => {
  const T = window.__trollOps; return T.state() === "playing" && T.stageT() <= 0;
}, null, { timeout: 30000 })));
const iIds = await Promise.all([C, D].map((p) => p.evaluate(() => window.__trollOps.net.id)));
const bothSurvivors = await Promise.all([C, D].map((p) => p.evaluate(() => window.__trollOps.net.team)));
check("infection: everyone starts a survivor", bothSurvivors.every((t) => t === "phantom"), JSON.stringify(bothSurvivors));
// Don't wait out the 8s: run the host's clock down.
await Promise.all([C, D].map((p) => p.evaluate(() => window.__trollOps.setInfectionT(0.1))));
await Promise.all([C, D].map((p) => p.waitForFunction(() => window.__trollOps.infectionStarted(), null, { timeout: 15000 }).catch(() => {})));
await sleep(800);
const iState = await Promise.all([C, D].map((p, i) => p.evaluate((other) => {
  const T = window.__trollOps; const r = T.remotes.byId.get(other);
  return { team: T.net.team, hold: T.player.holding, max: T.player.maxHp, otherTeam: T.net.peers.get(other)?.team,
    otherSword: !!r?.meleeMesh?.visible, counts: T.infectionCounts() };
}, iIds[1 - i])));
const zi = iState.findIndex((s) => s.team === "ghost");
check("infection: exactly one of two starts infected, and both agree who",
  zi >= 0 && iState[1 - zi].team === "phantom" && iState[1 - zi].otherTeam === "ghost" && iState[zi].otherTeam === "phantom", JSON.stringify(iState));
if (zi >= 0) {
  check("infection: the infected holds only the sword, with more health", iState[zi].hold === "melee" && iState[zi].max === 150, JSON.stringify(iState[zi]));
  check("infection: the survivor sees the infected carrying the sword", iState[1 - zi].otherSword, JSON.stringify(iState[1 - zi]));
  // The infected cuts the survivor down: the survivor turns, and with no
  // survivors left both clients end the match for the infected.
  const [Z, Sv] = zi === 0 ? [C, D] : [D, C];
  await Sv.evaluate((zid) => { const T = window.__trollOps; T.player.spawnGuard = 0; T.damagePlayer(500, zid, "keyboard"); }, iIds[zi]);
  const ends = await Promise.all([Z, Sv].map((p) => p.waitForFunction(() => window.__trollOps.state() !== "playing", null, { timeout: 10000 })
    .then(() => p.evaluate(() => ({ st: window.__trollOps.state(), team: window.__trollOps.net.team, title: document.getElementById("to-gameover")?.innerText.split(String.fromCharCode(10))[0] })))
    .catch(() => p.evaluate(() => ({ st: window.__trollOps.state(), team: window.__trollOps.net.team, c: window.__trollOps.infectionCounts() })))));
  check("infection: a survivor who dies turns infected", ends[1].team === "ghost", JSON.stringify(ends[1]));
  check("infection: no survivors left ends it for the infected, on both clients",
    ends.every((e) => e.st !== "playing" && /Infected win/.test(e.title || "")), JSON.stringify(ends));
}

check("no page errors", errors.length === 0, errors.slice(0, 5).join(" | "));

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
