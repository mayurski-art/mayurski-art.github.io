// Bots use what they carry (user, 2026-10-29: "smart enough to use plates
// and hopium injections as well as throw throwables and meleeing and
// switching to secondary weapon ... and if theres no ammo ... pick up
// weapons off the ground"). Forces each situation and checks what a bot does:
//   1. a lone bot (bots.js Bot, fed a hand-made world) for the keyboard at
//      arm's length, the sidearm mid-reload, a counted reserve, dry, and a
//      frag at someone dug in;
//   2. a private Mini Royale for plates, Hopium first when low, and a dry
//      bot going for a gun or an ammo box off the floor.
// Private rooms only; Supabase is blocked.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-bot-smarts-test.mjs

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
const step = (what) => { if (process.env.STEPS) console.log(`  [${((Date.now() - T0) / 1000).toFixed(0)} s] ${what}`); };

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });

async function start(mode, map) {
  await page.evaluate(async ({ mode, map }) => {
    const T = window.__trollOps;
    if (map) T.loadout.mapId = map;
    T.setMode(mode);
    // always a private room, never the public one
    T.els.room.value = "BS" + Math.random().toString(36).slice(2, 6).toUpperCase(); T.els.room.dispatchEvent(new Event("input"));
    if (T.els.noBots) T.els.noBots.checked = false;
    await T.startGame();
  }, { mode, map });
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 90000 });
  await page.evaluate(() => { window.__trollOps.player.spawnGuard = 1e9; });
}

// ---- 1. one bot, a hand-made world (no map, no other bots, nothing hosted)
await start("tdm", "grinsite");
await page.waitForFunction(() => window.__trollOps.bots.bots.length > 0, null, { timeout: 30000 });
const lone = await page.evaluate(() => {
  const T = window.__trollOps;
  const Bot = T.bots.bots[0].constructor, V = T.bots.bots[0].pos.constructor;
  const out = {};
  const mk = (skill = "veteran") => { const b = new Bot("phantom", { x: 0, z: 0 }, skill, {}); b.secondaryId = "sixtynine"; b.frags = 0; b.flashes = 0; return b; };
  const foe = (x, z, y = 0) => ({ id: "foe", team: "ghost", alive: true, pos: new V(x, y, z), groundY: y });
  function world(b, targets) {
    const log = { shots: [], melee: [], throws: [] };
    const ctx = {
      colliders: [], arena: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, ffa: false, targets,
      onShoot: (...a) => log.shots.push({ sidearm: a[6] === true, hit: a[4] }),
      onMelee: (bot, t, scale = 1) => log.melee.push({ t: t.id, scale }),
      onThrow: (bot, kind, at) => { log.throws.push({ kind, x: at.x, z: at.z, t: bot.clock }); return true; },
    };
    const run = (secs, each) => { for (let i = 0; i < secs * 30; i++) { each?.(i / 30); b.update(1 / 30, ctx); } };
    return { log, run };
  }

  // The keyboard: someone in reach on its level gets swung at, not shot.
  {
    const b = mk(), t = foe(1.4, 0), w = world(b, [t]);
    w.run(3, () => { t.pos.set(b.pos.x + 1.4, 0, b.pos.z); });
    out.knife = { melee: w.log.melee.length, shots: w.log.shots.length, landed: w.log.melee.filter((m) => m.scale > 0).length, scales: [...new Set(w.log.melee.map((m) => m.scale))] };
    // ...but not one a floor above, out of reach
    const b2 = mk(), t2 = foe(1.4, 0, 3), w2 = world(b2, [t2]);
    w2.run(2, () => { t2.pos.set(b2.pos.x + 1.4, 3, b2.pos.z); });
    out.knifeAbove = { melee: w2.log.melee.length };
    // at 10 m: the gun
    const b3 = mk(), t3 = foe(10, 0), w3 = world(b3, [t3]);
    w3.run(2);
    out.knifeFar = { melee: w3.log.melee.length, shots: w3.log.shots.length };
  }

  // Caught mid-reload with someone close: the sidearm.
  {
    const b = mk(), t = foe(9, 0), w = world(b, [t]);
    b.ammo = 5; b.reloadT = 2;
    w.run(0.3);   // a sight check or two
    out.swap = { holding: b.holdingSecondary, reloadT: +b.reloadT.toFixed(2) };
    w.run(1.5);
    out.swap.sidearmShots = w.log.shots.filter((s) => s.sidearm).length;
    // far off: it finishes the reload
    const b2 = mk(), t2 = foe(25, 0), w2 = world(b2, [t2]);
    b2.ammo = 5; b2.reloadT = 2;
    w2.run(0.3, () => t2.pos.set(b2.pos.x + 25, 0, b2.pos.z));
    out.swapFar = { holding: b2.holdingSecondary, reloading: b2.reloadT > 0 };
    // FHJ-18 carriers reload
    const b3 = mk(); b3.secondaryId = "fhj18";
    const w3 = world(b3, [foe(9, 0)]);
    b3.ammo = 5; b3.reloadT = 2;
    w3.run(0.3);
    out.swapLauncher = { holding: b3.holdingSecondary };
    // bottomless by default (every mode but Royale)
    out.bottomless = { reserve: b.reserve, dry: b.dry, rounds: b.primaryRounds };
  }

  // A counted reserve: a reload takes what's left, then nothing.
  {
    const b = mk(), w = world(b, []);
    b.loadGun(30);
    const loaded = { ammo: b.ammo, reserve: b.reserve };
    b.ammo = 0;
    w.run(3);
    out.reserve = { loaded, after: { ammo: b.ammo, reserve: b.reserve } };
  }

  // Dry: both guns empty, nothing to load. No shots, no reloads; it closes
  // in and swings.
  {
    const b = mk(), t = foe(10, 0), w = world(b, [t]);
    b.loadGun(0); b.loadSidearm(0);
    w.run(3, () => {});
    out.dry = { dry: b.dry, shots: w.log.shots.length, reloading: b.reloadT > 0 || b.sidearmReloadT > 0, closed: +Math.hypot(t.pos.x - b.pos.x, t.pos.z - b.pos.z).toFixed(1), melee: w.log.melee.length };
    w.run(2, () => t.pos.set(b.pos.x + 1.5, 0, b.pos.z));
    out.dry.meleeClose = w.log.melee.length;
    // the primary's dry, the sidearm isn't: on the sidearm, even out of sight
    const b2 = mk(), w2 = world(b2, []);
    b2.loadGun(0);
    w2.run(0.5);
    out.dryPrimary = { holding: b2.holdingSecondary, dry: b2.dry };
  }

  // A frag at someone dug in (one spot, in sight, 15 m off).
  {
    const tries = [];
    for (let k = 0; k < 6; k++) {
      const b = mk(); b.frags = 1; b.nadeT = 0;
      const t = foe(15, 0), w = world(b, [t]);
      w.run(12, () => {});
      tries.push(w.log.throws.map((x) => ({ kind: x.kind, t: +x.t.toFixed(1), off: +Math.hypot(x.x - t.pos.x, x.z - t.pos.z).toFixed(1) })));
    }
    out.camper = tries;
    // one on the move isn't a reason (the gun is)
    const moving = [];
    for (let k = 0; k < 6; k++) {
      const b = mk(); b.frags = 1; b.nadeT = 0;
      const t = foe(15, 0), w = world(b, [t]);
      w.run(12, (s) => t.pos.set(15 + Math.cos(s * 1.2) * 6, 0, Math.sin(s * 1.2) * 6));
      moving.push(w.log.throws.length);
    }
    out.mover = moving;
  }
  return out;
});
console.log(JSON.stringify(lone));

check("knife: swings at someone in reach, no shots", lone.knife.melee >= 2 && lone.knife.shots === 0, JSON.stringify(lone.knife));
check("knife: a gunner's swing is 65% of the board, or a whiff", lone.knife.scales.every((s) => s === 0 || Math.abs(s - 0.65) < 1e-9) && lone.knife.landed >= 1, JSON.stringify(lone.knife.scales));
check("knife: not at someone a floor up", lone.knifeAbove.melee === 0, JSON.stringify(lone.knifeAbove));
check("knife: the gun at 10 m", lone.knifeFar.melee === 0 && lone.knifeFar.shots > 0, JSON.stringify(lone.knifeFar));
check("swap: mid-reload with someone at 9 m draws the sidearm", lone.swap.holding && lone.swap.reloadT === 0 && lone.swap.sidearmShots > 0, JSON.stringify(lone.swap));
check("swap: at 25 m it finishes the reload", !lone.swapFar.holding && lone.swapFar.reloading, JSON.stringify(lone.swapFar));
check("swap: an FHJ-18 carrier reloads", !lone.swapLauncher.holding, JSON.stringify(lone.swapLauncher));
check("other modes stay bottomless", lone.bottomless.reserve === null && !lone.bottomless.dry && lone.bottomless.rounds === Infinity, JSON.stringify(lone.bottomless));
check("reserve: a reload takes what's left", lone.reserve.loaded.ammo === 26 && lone.reserve.loaded.reserve === 4 && lone.reserve.after.ammo === 4 && lone.reserve.after.reserve === 0, JSON.stringify(lone.reserve));
check("dry: no shots, no reloads, closes in", lone.dry.dry && lone.dry.shots === 0 && !lone.dry.reloading && lone.dry.closed < 9, JSON.stringify(lone.dry));
check("dry: swings once in reach", lone.dry.meleeClose >= 1, JSON.stringify(lone.dry));
check("dry primary: on the sidearm out of sight", lone.dryPrimary.holding && !lone.dryPrimary.dry, JSON.stringify(lone.dryPrimary));
const campThrows = lone.camper.filter((t) => t.length);
check("frag at someone dug in", campThrows.length >= 4 && campThrows.every((t) => t[0].kind === "frag" && t[0].t >= 4 && t[0].off < 4), JSON.stringify(lone.camper));
check("no frag at someone on the move", lone.mover.every((n) => n === 0), JSON.stringify(lone.mover));

// ---- 2. Troll Royale (Mini): plates, Hopium, a gun or a box off the floor
step("royale: starting");
await start("royale_mini", "grinbeach");
step("royale: playing");
try {
  await page.waitForFunction(() => window.__trollOps.bots.bots.some((b) => b.alive && !b.airborne && b.royaleInit), null, { timeout: 150000 });
} catch (e) {
  console.log(await page.evaluate(() => { const T = window.__trollOps; return JSON.stringify({ mode: T.currentMode?.()?.id, state: T.state(), host: T.net?.isBotHost?.(), live: T.royale()?.live, t: T.royale()?.t, bots: T.bots.bots.slice(0, 4).map((b) => ({ alive: b.alive, air: b.airborne, init: b.royaleInit })) }); }));
  throw e;
}
step("royale: a bot is down");
// One bot under test; everyone else held still (no AI), so nobody shoots it.
const id = await page.evaluate(() => {
  const T = window.__trollOps, r = T.royale(), z = r.zone.state(r.t);
  // well inside the circle, so the Cringe doesn't hit it (a hit cancels a plate)
  const inside = (x) => Math.hypot(x.pos.x - z.x, x.pos.z - z.z) < z.r * 0.6;
  const b = T.bots.bots.find((x) => x.alive && !x.airborne && x.royaleInit && inside(x)) || T.bots.bots.find((x) => x.alive && !x.airborne && x.royaleInit);
  for (const o of T.bots.bots) if (o !== b) o.airborne = true;
  const quiet = () => { b.hurtAt = 0; b.sparedAt = 0; b.act = null; b.chestId = null; b.chestRetry = 1e9; b.lootId = null; b.lootRetry = 0; };
  // and nothing else on the floor near it: the test's own items are the nearest
  const clear = () => { for (const it of [...r.loot.items.values()]) if (Math.hypot(it.x - b.pos.x, it.z - b.pos.z) < 70) r.loot.take(it.id); };
  window.__bs = { b, quiet, clear };
  quiet();
  return b.id;
});
check("royale: a bot lands with a counted pistol", await page.evaluate(() => { const b = window.__bs.b; return b.reserve != null && b.sidearmReserve != null && Number.isFinite(b.primaryRounds); }));

step("royale: bot picked");
// Headless, a royale frame is slow and its clock runs behind the wall's:
// wait on the match's own seconds.
const gameWait = async (secs) => {
  const t0 = await page.evaluate(() => window.__trollOps.royale().t);
  await page.waitForFunction((t) => window.__trollOps.royale().t >= t, t0 + secs, { timeout: 120000, polling: 100 });
};
console.log("  royale clock:", await page.evaluate(async () => { const r = window.__trollOps.royale(), t = r.t, w = performance.now(); await new Promise((k) => setTimeout(k, 2000)); return ((r.t - t) / ((performance.now() - w) / 1000)).toFixed(2) + "x"; }));
// Plates: armour gone, nobody shooting: one goes on.
await page.evaluate(() => {
  const { b, quiet, clear } = window.__bs; quiet(); clear(); b.armor = 0; b.plates = 2; b.heals = 0; b.hp = 100;
  // what it's doing through the wait, for a failure
  window.__bs.log = [];
  window.__bs.sample = setInterval(() => window.__bs.log.push([b.act?.kind?.[0] || "-", +(b.act?.t || 0).toFixed(1), b.armor | 0, b.plates, b.airborne ? "air" : "", b.alive ? "" : "dead"].join(" ")), 250);
});
// (the channel runs on frame time, which a slow headless frame clamps:
// wait for the result, not a fixed time)
await page.waitForFunction(() => (window.__bs.b.armor | 0) >= 50, null, { timeout: 15000, polling: 100 }).catch(() => {});
const plated = await page.evaluate(() => { clearInterval(window.__bs.sample); const b = window.__bs.b; return { armor: b.armor | 0, plates: b.plates, log: window.__bs.log.join(" | ") }; });
check("royale: plates up with nobody shooting", plated.armor >= 50 && plated.plates <= 1, JSON.stringify(plated));
// ...and not while being hit
await page.evaluate(() => { const { b, quiet } = window.__bs; quiet(); b.armor = 0; b.plates = 2; window.__bs.hit = setInterval(() => { b.hurtAt = performance.now(); }, 100); });
await gameWait(2);
const underFire = await page.evaluate(() => { clearInterval(window.__bs.hit); return { armor: window.__bs.b.armor | 0 }; });
check("royale: no plate while it's being hit", underFire.armor === 0, JSON.stringify(underFire));

step("royale: plates done");
// Low: the Hopium before a plate.
await page.evaluate(() => { const { b, quiet } = window.__bs; quiet(); b.armor = 0; b.plates = 2; b.heals = 1; b.hp = 30; b.hurtAt = performance.now() - 2100; });
await gameWait(0.3);
const first = await page.evaluate(() => window.__bs.b.act?.kind || null);
await page.waitForFunction(() => window.__bs.b.heals === 0, null, { timeout: 15000, polling: 100 }).catch(() => {});
const healed = await page.evaluate(() => ({ hp: Math.round(window.__bs.b.hp), heals: window.__bs.b.heals }));
check("royale: Hopium first when low", first === "heal" && healed.heals === 0 && healed.hp >= 99, JSON.stringify({ first, ...healed }));

step("royale: hopium done");
// Dry, with a rare gun in hand: a common one on the floor is now worth it,
// even mid-fight (urgent), and picking it up brings its rounds.
const dry = await page.evaluate(() => {
  const T = window.__trollOps, r = T.royale(), { b, quiet, clear } = window.__bs;
  quiet(); clear();
  b.weaponId = "cackle"; b.gunRarity = 3; b.loadGun(0); b.loadSidearm(0);
  const x = b.pos.x + 3, z = b.pos.z;
  r.loot.add({ id: "bs-gun", k: "gun", w: "mald", r: 0, ammo: 90, x, y: b.groundY, z });
  const o = T.royaleBotObjective(b);
  // armed and stocked, the same common gun isn't wanted
  const keep = { ammo: b.ammo, reserve: b.reserve };
  b.loadGun(200); b.lootId = null; b.lootRetry = 0;
  const o2 = T.royaleBotObjective(b);
  b.loadGun(keep.ammo + keep.reserve); b.lootId = null; b.lootRetry = 0;
  T.royaleBotObjective(b);
  // at its feet now (a spot 3 m off can be inside a wall)
  const it = r.loot.items.get("bs-gun"); it.x = b.pos.x + 0.4; it.z = b.pos.z;
  return { dry: b.dry, id: o?.id, urgent: !!o?.urgent, stockedWants: o2?.id === "loot-bs-gun" };
});
await gameWait(1.5);
const picked = await page.evaluate(() => { const b = window.__bs.b; return { w: b.weaponId, rounds: b.primaryRounds, dry: b.dry, gone: !window.__trollOps.royale().loot.items.has("bs-gun"), loot: b.lootId, alive: b.alive }; });
check("royale: dry, it heads for a gun off the floor", dry.dry && dry.id === "loot-bs-gun" && dry.urgent, JSON.stringify(dry));
check("royale: stocked, a worse gun is left alone", !dry.stockedWants, JSON.stringify(dry));
check("royale: picks it up with its rounds", picked.w === "mald" && picked.rounds === 90 && !picked.dry && picked.gone, JSON.stringify(picked));

// Low on rounds: an ammo box, urgently; taking it tops the reserve up.
const box = await page.evaluate(() => {
  const T = window.__trollOps, r = T.royale(), { b, quiet, clear } = window.__bs;
  quiet(); clear();
  b.loadGun(10); b.loadSidearm(0);
  const x = b.pos.x - 3, z = b.pos.z;
  r.loot.add({ id: "bs-box", k: "ammo", n: 1, x, y: b.groundY, z });
  const o = T.royaleBotObjective(b);
  const it = r.loot.items.get("bs-box"); it.x = b.pos.x - 0.4; it.z = b.pos.z;
  return { id: o?.id, urgent: !!o?.urgent, before: b.primaryRounds };
});
await gameWait(0.6);
const boxed = await page.evaluate(() => { const b = window.__bs.b; return { rounds: b.primaryRounds, gone: !window.__trollOps.royale().loot.items.has("bs-box") }; });
check("royale: low, it heads for an ammo box", box.id === "loot-bs-box" && box.urgent, JSON.stringify(box));
check("royale: the box tops the reserve up", boxed.gone && boxed.rounds > box.before, JSON.stringify({ ...box, ...boxed }));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
