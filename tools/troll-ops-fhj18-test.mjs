// Troll Forces FHJ-18 AA test (FHJ18.md): the launcher in the Secondary
// slot, its ammo (six a life, a Scavenger pack gives two back), the lock
// (aircraft and enemy SAM Turrets only, ADS, no hip fire), the missile
// downing what it hits, and the bots that carry one.
// Supabase is blocked: the page must never join the live public room.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-fhj18-test.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
// The game's own module instances: the ?v= tag their importers use (any
// other tag is a second copy of the module).
const tagOf = (importer, mod) => fs.readFileSync(path.join(GAME, importer), "utf8").match(new RegExp(`${mod.replace(/[./]/g, "\\$&")}\\?v=([\\w-]+)`))[1];
const TAGS = {
  weapons: tagOf("loadout.js", "weapons.js"),
  scavenger: tagOf("combat/scoring.js", "scavenger.js"),
  perks: tagOf("combat/perk-carry.js", "perks.js"),
  launcher: tagOf("combat/weapons.js", "launcher.js"),
  fire: tagOf("game.js", "combat/weapons.js"),
  dragonfire: tagOf("combat/weapons.js", "streaks/dragonfire.js"),
};

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
// A guest (level 0): the FHJ-18 is open from the start.
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 300000 });
await page.evaluate(async (tags) => {
  const base = "/assets/games/troll-ops/";
  window.__M = {
    G: (await import(`${base}core/state.js?v=st1`)).game,
    W: await import(`${base}weapons.js?v=${tags.weapons}`),
    SV: await import(`${base}combat/scavenger.js?v=${tags.scavenger}`),
    P: await import(`${base}perks.js?v=${tags.perks}`),
    LA: await import(`${base}combat/launcher.js?v=${tags.launcher}`),
    WP: await import(`${base}combat/weapons.js?v=${tags.fire}`),
    DF: await import(`${base}streaks/dragonfire.js?v=${tags.dragonfire}`),
  };
  window.__trollOps.setLoadWaitMax(8);
}, TAGS);

// ---- 1. Create a Class: the Secondary slot offers Launchers, the FHJ-18 open at level 0.
const menu = await page.evaluate(() => {
  const T = window.__trollOps, L = T.loadout, { W } = window.__M;
  const def = W.WEAPON_DEFS.fhj18;
  const valid = L.validClass({ ...L.cur, secondaryId: "fhj18" }).secondaryId;
  return { def: def && { cls: def.cls, rank: def.rank, hidden: !!def.hidden, mag: def.magSize, reserveMax: def.reserveMax },
    secondary: W.SECONDARY_CLASSES, primary: W.CLASS_ORDER.includes("launcher"), valid, inClass: W.weaponsInClass("launcher") };
});
check("the FHJ-18 is a launcher, open from level 0, never Royale loot", menu.def?.cls === "launcher" && menu.def.rank === 0 && menu.def.hidden, JSON.stringify(menu.def));
check("the Secondary slot offers Launchers; the Primary doesn't", menu.secondary.includes("launcher") && !menu.primary && menu.inClass.includes("fhj18"), JSON.stringify(menu));
check("a class can keep it as its secondary", menu.valid === "fhj18", menu.valid);

// ---- 2. In a match: six missiles a life; a Scavenger pack gives two back, never past six.
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.secondaryId = "fhj18";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 300000 });
await page.evaluate(() => { const T = window.__trollOps; T.endStaging?.(); T.matchIntro?.skip?.(); });
await page.waitForTimeout(800);
const ammo = await page.evaluate(async () => {
  const T = window.__trollOps, { G, SV, P } = window.__M;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const w = T.player.weapons.fhj18;
  const out = { has: !!w, secondaryId: T.player.secondaryId, mag: w?.ammoInMag, reserve: w?.ammoReserve };
  if (!w) return out;
  const keep = P.carriedPerks();
  P.setCarriedPerks(["scavenger"]);
  w.ammoReserve = 0;
  SV.scavengerDrop(G.player.pos.clone());
  await wait(300);
  out.afterPack = w.ammoReserve;
  w.ammoReserve = 4;
  SV.scavengerDrop(G.player.pos.clone());
  await wait(300);
  out.capped = w.ammoReserve;
  P.setCarriedPerks(keep);
  return out;
});
check("the FHJ-18 is the secondary in the match", ammo.has && ammo.secondaryId === "fhj18", JSON.stringify(ammo));
check("six missiles a life: one in the tube, five spare", ammo.mag === 1 && ammo.reserve === 5, `${ammo.mag} + ${ammo.reserve}`);
check("a Scavenger pack gives two missiles back", ammo.afterPack === 2, String(ammo.afterPack));
check("...never past six", ammo.capped === 5, String(ammo.capped));

// ---- 3. The lock: ADS on an enemy aircraft (or SAM Turret), never hip fire, never the ground.
// In the page: hold the FHJ-18 up, keep the camera on `at()` and wait for `done()`.
await page.evaluate(() => {
  const T = window.__trollOps, { G } = window.__M;
  T.player.spawnGuard = 1e9; T.player.maxHp = T.player.hp = 1e9;
  T.switchWeapon("secondary");
  window.__aim = (at) => {
    const c = T.camera.position, dx = at.x - c.x, dy = at.y - c.y, dz = at.z - c.z;
    T.look.yaw = Math.atan2(-dx, -dz);
    T.look.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  };
  window.__until = (at, done, ms) => new Promise((res) => {
    const t0 = performance.now();
    const tick = () => {
      const p = at();
      if (p) window.__aim(p);
      if (done() || performance.now() - t0 > ms) return res(done());
      requestAnimationFrame(tick);
    };
    tick();
  });
  window.__enemy = T.net.team === "phantom" ? "ghost" : "phantom";
  G.adsHeld = false;
});
await page.waitForTimeout(600);
const hip = await page.evaluate(() => {
  const T = window.__trollOps, { WP, LA } = window.__M;
  const w = T.player.weapons.fhj18;
  w.ammoInMag = 1; w.reloading = false; w.fireCooldown = 0;
  WP.fireOnce();
  return { slot: T.currentWeapon().def.id, mag: w.ammoInMag, missiles: LA.aaState().missiles };
});
check("you hold it up as your secondary", hip.slot === "fhj18", hip.slot);
check("no hip fire: the trigger does nothing without the sight up", hip.mag === 1 && hip.missiles === 0, JSON.stringify(hip));

// The ground: aim at a spot on the floor 20 m off, sight up, 2.5 s: no lock.
const ground = await page.evaluate(async () => {
  const T = window.__trollOps, { G, LA } = window.__M;
  G.adsHeld = true;
  const p = T.move.pos.clone(); p.x += 20; p.y = 0.5;
  await window.__until(() => p, () => false, 2500);
  const w = T.player.weapons.fhj18;
  return { ads: +w.adsT.toFixed(2), lock: LA.aaState().lock };
});
check("the sight comes up", ground.ads > 0.85, String(ground.ads));
check("nothing on the ground locks", !ground.lock.id && !ground.lock.locked, JSON.stringify(ground.lock));

// An enemy UAV: locks in about 1.2 s, LOCKED shown, one missile downs it, +125.
const uav = await page.evaluate(async () => {
  const T = window.__trollOps, { LA } = window.__M;
  const plane = T.spawnRecon(T.move.pos.x, T.move.pos.z, 0.3, 60, { counter: false, team: window.__enemy, caller: "enemy-x" });
  const eid = plane.eid;
  const at = () => plane.root.position;
  const t0 = performance.now();
  await window.__until(at, () => LA.aaState().lock.locked, 12000);
  const lockedIn = (performance.now() - t0) / 1000;
  const el = document.querySelector(".to-aa-lock");
  const shown = el && !el.hidden ? el.textContent : "";
  const score0 = T.player.matchScore || 0;
  const w = T.player.weapons.fhj18;
  w.fireCooldown = 0;
  window.__M.WP.fireOnce();
  const fired = LA.aaState().missiles;
  const gone = () => !T.flyovers?.some?.((f) => f.eid === eid) && !window.__M.DF.airTargetPos(eid);
  await window.__until(at, gone, 8000);
  return { eid, lockedIn: +lockedIn.toFixed(2), shown, fired, down: gone(), mag: w.ammoInMag, reloading: w.reloading, score: (T.player.matchScore || 0) - score0 };
});
check("an enemy UAV locks (LOCKED on the bracket)", uav.lockedIn < 6 && /LOCKED/.test(uav.shown), JSON.stringify(uav));
check("one missile goes and downs it, +125", uav.fired === 1 && uav.down && uav.score >= 125, JSON.stringify(uav));
check("the next missile goes in the tube by itself", uav.reloading || uav.mag === 1, JSON.stringify({ mag: uav.mag, reloading: uav.reloading }));

// An enemy gunship takes two.
const heli = await page.evaluate(async () => {
  const T = window.__trollOps, { LA, WP } = window.__M;
  const e = T.spawnHelicopter({ id: "aa-test-heli", seed: 7, owned: false, team: window.__enemy });
  const at = () => e.root.position;
  const shots = [];
  for (let k = 0; k < 2; k++) {
    const w = T.player.weapons.fhj18;
    await window.__until(at, () => !w.reloading && w.ammoInMag > 0 && LA.aaState().lock.locked, 15000);
    w.fireCooldown = 0;
    WP.fireOnce();
    await window.__until(at, () => LA.aaState().missiles === 0, 8000);
    shots.push({ alive: T.streakEntities.has("aa-test-heli"), hits: LA.aaState().hits["aa-test-heli"] || 0 });
  }
  return shots;
});
check("an enemy gunship takes one missile and stays up", heli[0]?.alive && heli[0].hits === 1, JSON.stringify(heli));
check("...and comes down with the second", heli[1] && !heli[1].alive, JSON.stringify(heli));

// An enemy SAM Turret: it locks, one missile.
const sam = await page.evaluate(async () => {
  const T = window.__trollOps, { LA, WP, DF } = window.__M;
  const THREE = await import("three");
  const p = T.move.pos;
  // On our own floor, 15 m off where nothing's in the way: an enemy's, as
  // if their bot set it down.
  const eye = T.camera.position.clone();
  let spot = null;
  for (let k = 0; k < 16 && !spot; k++) {
    const a = (k / 16) * Math.PI * 2, c = new THREE.Vector3(p.x + Math.sin(a) * 15, p.y + 1.1, p.z + Math.cos(a) * 15);
    const dir = c.clone().sub(eye), d = dir.length();
    if (T.raycastWorld(T.colliders, eye, dir.normalize(), d) >= d - 0.5) spot = c;
  }
  if (!spot) return { noSpot: true };
  DF.spawnSam({ id: "aa-test-sam", owned: false, team: window.__enemy, x: spot.x, y: p.y, z: spot.z, yaw: 0 });
  const e = T.streakEntities.get("aa-test-sam");
  const at = () => e.pos.clone().setY(e.pos.y + 1.1);
  const w = T.player.weapons.fhj18;
  await window.__until(at, () => !w.reloading && w.ammoInMag > 0 && LA.aaState().lock.locked, 15000);
  const locked = LA.aaState().lock.locked;
  w.fireCooldown = 0;
  WP.fireOnce();
  await window.__until(at, () => !T.streakEntities.has("aa-test-sam"), 8000);
  return { locked, destroyed: !T.streakEntities.has("aa-test-sam"), targets: LA.aaTargetsFor(T.net.team, T.net.id).map((t) => t.id), team: T.net.team, samTeam: e.team, alive: e.alive };
});
check("an enemy SAM Turret locks", sam.locked, JSON.stringify(sam));
check("...and one missile destroys it", sam.destroyed, JSON.stringify(sam));
await page.screenshot({ path: path.join(ROOT, ".claude", "fhj18-lock.png") }).catch(() => {});

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
