// The Sentry Gun scorestreak (BO2): it is in the streak list with its own
// icon, deploys in front of the caller with the BO2 sentry model, turns
// onto and kills an enemy it can see, never a teammate, never through a
// wall; a bot's sentry shoots the local player; bullets on it reach its
// owner and shooting it apart ends it; it expires after 90 s. Solo, a TDM
// match with bots, Supabase blocked. Saves screenshots to SHOT_DIR if set.
//
// Usage: NODE_PATH=<global node_modules> node tools/troll-ops-sentry-test.mjs

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
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail)})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOT = process.env.SHOT_DIR;

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: +(process.env.VW || 1280), height: +(process.env.VH || 720) } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await sleep(1500);

// --- the streak list
const def = await page.evaluate(() => {
  const T = window.__trollOps;
  const d = T.STREAK_DEFS.sentrygun;
  return d ? { name: d.name, cost: d.cost, duration: d.duration, bots: T.BOT_STREAK_POOL.includes("sentrygun"),
    icon: !T.streakIconSvg("sentrygun").includes('r="4"/>') } : null;
});
check("Sentry Gun is a scorestreak with its own icon, in the bots' pool", def && def.name === "Sentry Gun" && def.icon && def.bots, def);

// --- a TDM match with bots (solo: no Supabase, so no public room)
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = false;
  await T.startGame();
  if (T.isStaging()) T.endStaging();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && window.__trollOps.bots.bots.length > 2, null, { timeout: 60000 });
await page.waitForFunction(() => window.__trollOps.killcam.tracks.size > 5 && !window.__trollOps.isStaging(), null, { timeout: 180000 }).catch(() => {});

// The page's own game object and weapon helpers (same module URLs, so the
// same instances).
await page.evaluate(async () => {
  const url = (name) => performance.getEntriesByType("resource").map((r) => r.name).find((n) => n.includes(name));
  window.__sg = {
    game: (await import(url("/core/state.js"))).game,
    weapons: await import(url("/combat/weapons.js")),
  };
});

const SENTRY = "SentryGun";
const deployed = await page.evaluate((SENTRY) => {
  const T = window.__trollOps;
  T.player.spawnGuard = 0;
  T.streaks.grant("sentrygun");
  T.fireStreak("sentrygun");
  const e = [...T.streakEntities.values()].find((x) => x.constructor.name === SENTRY);
  if (!e) return null;
  return { d: +Math.hypot(e.pos.x - T.move.pos.x, e.pos.z - T.move.pos.z).toFixed(2), dy: +(e.pos.y - T.move.pos.y).toFixed(2), owned: e.owned };
}, SENTRY);
check("fired: a Sentry Gun goes down near the caller (1-2.2 m out), on the floor", deployed && deployed.d > 0.95 && deployed.d < 2.5 && Math.abs(deployed.dy) < 0.6 && deployed.owned, deployed);
await page.waitForFunction(() => { const e = [...window.__trollOps.streakEntities.values()].find((x) => x.constructor.name === "SentryGun"); return e && e.barrels && e.head && e.muzzleNode; }, null, { timeout: 20000 }).catch(() => {});
// past the unfold (the head comes up the last 0.18 m as it arms)
await page.evaluate(() => { const e = [...window.__trollOps.streakEntities.values()].find((x) => x.constructor.name === "SentryGun"); while (e.age < 1.5) e.update(0.05, null); });
const model = await page.evaluate(() => {
  const e = [...window.__trollOps.streakEntities.values()].find((x) => x.constructor.name === "SentryGun");
  e.root.scale.set(1, 1, 1);
  e.root.updateMatrixWorld(true);
  let top = -Infinity;
  e.root.traverse((n) => {
    if (!n.isMesh || n === e.hitbox || !n.geometry) return;
    n.geometry.computeBoundingBox();
    const b = n.geometry.boundingBox;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      top = Math.max(top, n.localToWorld(b.min.clone().set(x, y, z)).y);
    }
  });
  return { head: !!e.head, barrels: !!e.barrels, muzzle: !!e.muzzleNode, h: +(top - e.pos.y).toFixed(2) };
});
check("it is the BO2 sentry model at BO2 size (about 1.2 m)", model.head && model.barrels && model.muzzle && model.h > 1.05 && model.h < 1.4, model);

/* Park every bot far off, bring the chosen one to a spot the sentry can
   see, and run it for `secs`, all in one go (between page calls the game
   loop moves the bots' remote copies back). */
const run = (pickEnemy, secs) => page.evaluate(([pickEnemy, secs]) => {
  const T = window.__trollOps, G = window.__sg.game;
  const e = [...T.streakEntities.values()].find((x) => x.constructor.name === "SentryGun" && x.owned && !x.botId);
  const mine = T.net.team;
  const park = () => { for (const q of T.bots.bots) { const r = G.remotes.byId.get(q.id); if (r) r.pos.set(q.pos.x + 4000, q.pos.y, q.pos.z); } };
  const b = T.bots.bots.find((x) => x.alive && (pickEnemy ? x.team !== mine : x.team === mine));
  if (!b) return { none: true };
  const rp = G.remotes.byId.get(b.id);
  let at = null;
  for (const r of [9, 6, 13, 4]) for (let k = 0; k < 16 && !at; k++) {
    const a = k * Math.PI / 8;
    const x = e.pos.x - Math.sin(a) * r, z = e.pos.z - Math.cos(a) * r;
    const y = T.groundHeightAt(G.colliders, x, z, e.pos.y + 1.5);
    if (y == null || Math.abs(y - e.pos.y) > 1) continue;
    if (e.canSee(new e.pos.constructor(x, y + 1.1, z))) at = { x, y, z, r, a: +a.toFixed(2) };
  }
  if (!at) return { nowhere: true };
  const hp0 = b.hp;
  const targets = new Set();
  const shots0 = e.shots;
  let spin = 0, firstShot = null, killedAt = null, laserOn = false, worstLaser = 0, worstShot = 0, frames = 0;
  // the barrels' line off the model: hub of the rotary cluster to the muzzle
  const V = e.pos.constructor;
  const axis = () => { e.root.updateMatrixWorld(true); const m = e.muzzleNode.getWorldPosition(new V()); return m.sub(e.barrels.getWorldPosition(new V())).normalize(); };
  const fire0 = e.fire.bind(e);
  e.fire = (deal) => {
    const toT = e.target.chest.clone().sub(e.muzzleNode.getWorldPosition(new V())).normalize();
    worstShot = Math.max(worstShot, axis().angleTo(toT) * 180 / Math.PI);
    fire0(deal);
  };
  // start it looking the other way: the worst case to turn round from
  e.headYaw = Math.atan2(-(at.x - e.pos.x), -(at.z - e.pos.z)) - e.yaw + Math.PI;
  for (let i = 0; i < secs * 20; i++) {
    park();
    if (b.alive) { b.pos.set(at.x, at.y, at.z); rp.pos.set(at.x, at.y, at.z); }
    T.updateStreakEntities(0.05);
    const t = (i + 1) * 0.05;
    if (e.target) targets.add(e.target.id);
    if (firstShot == null && e.shots > shots0) firstShot = t;
    if (killedAt == null && !b.alive) killedAt = t;
    if (e.laser.beam.visible) {
      const ld = new V(0, 0, 1).applyQuaternion(e.laser.beam.quaternion);
      worstLaser = Math.max(worstLaser, ld.angleTo(axis()) * 180 / Math.PI);
      frames++;
    }
    if (e.target && e.target.id === b.id && e.laser.beam.visible) {
      const end = e.muzzle.clone().add(new e.pos.constructor(0, 0, 1).applyQuaternion(e.laser.beam.quaternion).multiplyScalar(e.laser.beam.scale.z));
      if (end.distanceTo(new e.pos.constructor(at.x, at.y + 1.1, at.z)) < 0.6) laserOn = true;
    }
    spin = Math.max(spin, e.spinV);
  }
  e.fire = fire0;
  return { id: b.id, team: b.team, at, hp0, hp: b.hp, alive: b.alive, targets: [...targets], shots: e.shots - shots0, spin: +spin.toFixed(1), firstShot, killedAt, laserOn,
    worstLaser: +worstLaser.toFixed(2), worstShot: +worstShot.toFixed(2), frames };
}, [pickEnemy, secs]);

// a teammate in plain view: left alone
const mate = await run(false, 3);
check("a teammate in plain view is never targeted", mate.id && mate.shots === 0 && !mate.targets.includes(mate.id), mate);

// an enemy in plain view: turned onto and cut down
const foe = await run(true, 4);
check("an enemy in plain view is turned onto and killed", foe.id && foe.targets.includes(foe.id) && foe.shots > 3 && (!foe.alive || foe.hp < foe.hp0), foe);
check("the barrels spin while it fires", foe.spin > 10, foe);
check("aimbot: from facing away, first round inside 0.8 s, dead inside 1.6 s", foe.firstShot != null && foe.firstShot <= 0.8 && foe.killedAt != null && foe.killedAt <= 1.6, { firstShot: foe.firstShot, killedAt: foe.killedAt });
check("the red laser sits on the target while it's locked", foe.laserOn, { laserOn: foe.laserOn });
check("the laser always comes straight out of the barrels (every frame, sweep and lock)", mate.frames > 20 && foe.frames > 20 && mate.worstLaser < 1 && foe.worstLaser < 1, { mate: mate.worstLaser, foe: foe.worstLaser });
check("every round leaves with the barrels pointed at the target (within 3 deg)", foe.shots > 0 && foe.worstShot < 3, { worstShot: foe.worstShot });

// never through a wall: every round is fired along a clear line
const walls = await page.evaluate(() => {
  const T = window.__trollOps, G = window.__sg.game;
  const e = [...T.streakEntities.values()].find((x) => x.constructor.name === "SentryGun" && x.owned && !x.botId);
  let blocked = 0, fired = 0, seen = 0, hidden = 0, hiddenShots = 0;
  const orig = e.fire.bind(e);
  e.fire = (deal) => {
    fired++;
    const p = e.target.chest, d = p.distanceTo(e.muzzle);
    const dir = p.clone().sub(e.muzzle).divideScalar(d);
    if (T.raycastWorld(G.colliders, e.muzzle, dir, d) < d - 0.4) blocked++;
    orig(deal);
  };
  // enemies dropped all round it, some behind cover
  const mine = T.net.team;
  const foes = T.bots.bots.filter((b) => b.team !== mine);
  for (let k = 0; k < 24; k++) {
    for (const q of T.bots.bots) { const r = G.remotes.byId.get(q.id); if (r) r.pos.x = q.pos.x + 4000; }
    const b = foes[k % foes.length]; const rp = G.remotes.byId.get(b.id);
    b.alive = true; b.hp = 100;
    const a = k * 0.9, r = 5 + (k % 5) * 6;
    const x = e.pos.x - Math.sin(a) * r, z = e.pos.z - Math.cos(a) * r;
    const y = T.groundHeightAt(G.colliders, x, z, e.pos.y + 3) ?? e.pos.y;
    b.pos.set(x, y, z); rp.pos.set(x, y, z); rp.alive = true;
    const visible = e.canSee(new e.pos.constructor(x, y + 1.1, z));
    const f0 = fired;
    for (let i = 0; i < 20; i++) T.updateStreakEntities(0.05);
    if (visible) seen++; else { hidden++; hiddenShots += fired - f0; }
  }
  e.fire = orig;
  return { fired, blocked, seen, hidden, hiddenShots };
});
check("never a round through a wall", walls.fired > 0 && walls.blocked === 0 && walls.hidden > 3 && walls.hiddenShots === 0, walls);

// a bot's sentry shoots us; bullets on it reach it; shot apart, it's gone
const enemySg = await page.evaluate(() => {
  const T = window.__trollOps, G = window.__sg.game;
  const mine = T.net.team;
  const b = T.bots.bots.find((x) => x.team !== mine && x.alive) || T.bots.bots.find((x) => x.team !== mine);
  b.pos.x -= 2000;
  T.botFireStreak(b, "sentrygun");
  const e = [...T.streakEntities.values()].find((x) => x.constructor.name === "SentryGun" && x.botId === b.id);
  if (!e) return { none: true };
  for (let i = 0; i < 30; i++) e.update(0.05, null);   // unfold, with nobody about
  T.player.spawnGuard = 0;
  const hp0 = T.player.hp;
  let spot = null;
  for (const r of [7, 10, 5]) for (let k = 0; k < 16 && !spot; k++) {
    const a = k * Math.PI / 8, x = e.pos.x - Math.sin(a) * r, z = e.pos.z - Math.cos(a) * r;
    const y = T.groundHeightAt(G.colliders, x, z, e.pos.y + 1.5);
    if (y == null || Math.abs(y - e.pos.y) > 1) continue;
    if (e.canSee(new e.pos.constructor(x, y + 1.1, z))) spot = { x, y, z };
  }
  if (!spot) return { nospot: true };
  for (const q of T.bots.bots) { const rp = G.remotes.byId.get(q.id); if (rp) rp.pos.x += 3000; }
  T.move.pos.set(spot.x, spot.y, spot.z);
  let tgtMe = false;
  for (let i = 0; i < 60; i++) { T.updateStreakEntities(0.05); if (e.target && e.target.id == null) tgtMe = true; }
  const hurt = { hp0, hp: T.player.hp, alive: T.player.alive, tgtMe };
  // a round on its hit volume goes to its owner (us: we host the bot)
  const W = window.__sg.weapons;
  const actor = W.resolveBulletTarget(e.hitbox);
  const hp1 = e.hp;
  const hit = (damage) => W.onBulletActorHit(actor, { damage, point: e.pos.clone().setY(e.pos.y + 0.8), dir: new e.pos.constructor(0, 0, 1), isHead: false });
  if (actor) hit(40);
  const took = hp1 - e.hp;
  if (actor) hit(2000);
  return { hurt, kit: !!actor?.isStreakKit, took, gone: !T.streakEntities.has(e.id) };
});
check("a bot's sentry turns onto and shoots the local player", enemySg.hurt && enemySg.hurt.tgtMe && (enemySg.hurt.hp < enemySg.hurt.hp0 || !enemySg.hurt.alive), enemySg);
check("bullets on a sentry reach it, and shot apart it's gone", enemySg.kit && enemySg.took === 40 && enemySg.gone, enemySg);

// it runs out after 90 s
const expiry = await page.evaluate(() => {
  const T = window.__trollOps;
  const e = [...T.streakEntities.values()].find((x) => x.constructor.name === "SentryGun" && x.owned && !x.botId);
  if (!e) return { none: true };
  for (let i = 0; i < 2000 && T.streakEntities.has(e.id); i++) T.updateStreakEntities(0.05);
  return { gone: !T.streakEntities.has(e.id), t: +e.age.toFixed(1) };
});
check("it expires after 90 s", expiry.gone && Math.abs(expiry.t - 90) < 0.2, expiry);

// facing a wall up close: it's set down with room all round, so the
// barrels never poke through anything as it turns
await page.evaluate(() => { const T = window.__trollOps; if (T.killcam.active) T.killcam.cancel(); });
await page.waitForFunction(() => window.__trollOps.player.alive, null, { timeout: 30000 }).catch(() => {});
const nearWall = await page.evaluate(() => {
  const T = window.__trollOps, G = window.__sg.game;
  if (!T.player.alive) return { dead: true };
  for (const [id, x] of [...T.streakEntities]) if (x.constructor.name === "SentryGun") { x.dispose(); T.streakEntities.delete(id); }
  const V = T.move.pos.constructor;
  // walk up to the nearest wall and face it from 0.5 m off
  const eye = T.move.pos.clone().setY(T.move.pos.y + 1);
  let best = null;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, d = new V(-Math.sin(a), 0, -Math.cos(a));
    const h = T.raycastWorld(G.colliders, eye, d, 30);
    if (h < 30 && (!best || h < best.h)) best = { a, h, d };
  }
  if (!best) return { nowall: true };
  T.move.pos.addScaledVector(best.d, Math.max(0, best.h - 0.5));
  T.look.yaw = best.a;
  T.streaks.grant("sentrygun");
  T.fireStreak("sentrygun");
  const e = [...T.streakEntities.values()].find((x) => x.constructor.name === "SentryGun");
  if (!e) return { none: true };
  const piv = e.pos.clone().setY(e.pos.y + 0.98);
  let clear = Infinity;
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    clear = Math.min(clear, T.raycastWorld(G.colliders, piv, new V(Math.sin(a), 0, Math.cos(a)), 3));
  }
  const fromPlayer = Math.hypot(e.pos.x - T.move.pos.x, e.pos.z - T.move.pos.z);
  e.dispose(); T.streakEntities.delete(e.id);
  return { wallWas: +best.h.toFixed(2), clear: +clear.toFixed(2), fromPlayer: +fromPlayer.toFixed(2) };
});
check("set down facing a wall: at least 0.9 m clear all round (the barrels reach 0.78 m), near the caller", nearWall.clear >= 0.9 && nearWall.fromPlayer > 0.95 && nearWall.fromPlayer < 2.5, nearWall);

// --- the look: a fresh one firing at an enemy, seen from beside it
if (SHOT) {
  await page.evaluate(() => { const T = window.__trollOps; if (T.killcam.active) T.killcam.cancel(); });
  await page.waitForFunction(() => window.__trollOps.player.alive, null, { timeout: 20000 }).catch(() => {});
  const framed = await page.evaluate(() => {
    const T = window.__trollOps, G = window.__sg.game;
    T.player.spawnGuard = 0;
    T.streaks.grant("sentrygun");
    T.fireStreak("sentrygun");
    const e = [...T.streakEntities.values()].find((x) => x.constructor.name === "SentryGun" && x.owned && !x.botId && x.age < 0.5);
    if (!e) return null;
    for (let i = 0; i < 30; i++) e.update(0.05, null);
    const mine = T.net.team;
    const b = T.bots.bots.find((x) => x.team !== mine && x.alive);
    const rp = G.remotes.byId.get(b.id);
    for (let k = 0; k < 16; k++) {
      const a = e.yaw + k * Math.PI / 8;
      const x = e.pos.x - Math.sin(a) * 9, z = e.pos.z - Math.cos(a) * 9;
      const y = T.groundHeightAt(G.colliders, x, z, e.pos.y + 1.5);
      if (y == null || Math.abs(y - e.pos.y) > 0.6 || !e.canSee(new e.pos.constructor(x, y + 1.1, z))) continue;
      window.__sgShot = { id: b.id, x, y, z };
      // the camera out in front and off to the side, looking back at it
      const side = a + Math.PI / 2;
      const cx = e.pos.x - Math.sin(a) * 3.2 - Math.sin(side) * 2.6, cz = e.pos.z - Math.cos(a) * 3.2 - Math.cos(side) * 2.6;
      const gy = T.groundHeightAt(G.colliders, cx, cz, e.pos.y + 1.5) ?? e.pos.y;
      T.move.pos.set(cx, gy, cz);
      window.__sgCam = { cx, cz, tx: e.pos.x - Math.sin(a) * 0.6, tz: e.pos.z - Math.cos(a) * 0.6 };
      return { k, sentry: e.id, rp: !!rp };
    }
    return null;
  });
  // hold the enemy and the view in place while the game runs
  for (let i = 0; i < 25; i++) {
    await page.evaluate(() => {
      const T = window.__trollOps, G = window.__sg.game, s = window.__sgShot, c = window.__sgCam;
      if (!s) return;
      const b = T.bots.byId(s.id); const rp = G.remotes.byId.get(s.id);
      if (b) { b.pos.set(s.x, s.y, s.z); b.hp = Math.max(b.hp, 100); }
      if (rp) rp.pos.set(s.x, s.y, s.z);
      T.move.velocity.set(0, 0, 0);
      T.look.yaw = Math.atan2(-(c.tx - c.cx), -(c.tz - c.cz));
      T.look.pitch = -0.2;
      T.weaponRig.visible = false;
      if (T.localHeld?.mesh) T.localHeld.mesh.visible = false;
    });
    await sleep(60);
  }
  await page.screenshot({ path: `${SHOT}/sentry-firing.png` });
  console.log("screenshot", framed);
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} check(s) failed` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
