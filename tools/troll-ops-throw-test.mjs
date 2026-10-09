// Troll Forces: the grenade throw, as you and everyone else see it
// (combat/throw-anim.js). User, 2026-10-08: see the hand and arm throw it and
// the pin pulled, quick like BO2's grenade and tomahawk throws, and no
// shooting/aiming/reloading/swapping with one in your hand.
//
// Two tabs in a private room (Supabase blocked, BroadcastChannel only):
// A throws, B watches A's body. Checks:
// - G down: the gun goes away and the grenade comes up in the right hand
//   within 0.15 s; the pin comes out by 0.3 s and only then the fuse burns
// - fire, aim and reload do nothing while it's held
// - key-up throws (the grenade is in the world at once when releaseCook runs,
//   as before); the flying grenade is drawn from the hand to its real spot
// - a tap throws as soon as the pin is out; the gun is back up by 0.7 s
// - B sees A holding it (the `ck` field: draw/pin/hold) and then the throw
// - a bot winds up (its `ck` shows) before its grenade appears
// - a grenade cooked off in the hand ends the throw cleanly
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-throw-test.mjs [SHOTS=dir]

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
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pump(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const ROOM = "THRW" + Math.floor(Math.random() * 90 + 10);
const errors = [];

async function open(label, { bots = false, room = ROOM } = {}) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  if (process.env.CONSOLE) page.on("console", (m) => { if (m.type() === "error") console.log(`[${label} console] ${m.text().slice(0, 300)}`); });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  await page.evaluate(async ({ room, bots }) => {
    const T = window.__trollOps;
    T.setLoadWaitMax?.(8);
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    if (T.els.noBots) T.els.noBots.checked = !bots;
    T.setMode("tdm");
    T.loadout.mapId = "grinsite";
    await T.startGame();
    if (T.isStaging()) T.endStaging();
  }, { room, bots });
  await page.waitForFunction(() => window.__trollOps.loadState && !window.__trollOps.loadState().open, null, { timeout: 180000 });
  await page.evaluate(() => { const T = window.__trollOps; if (!T.player.alive) T.respawnPlayer(); T.player.maxHp = T.player.hp = 1e6; });
  return page;
}

const A = await open("A");
const B = await open("B");
await pump(A, 1500);

// A stands still where B can see A; B looks at A. B's match intro holds
// everyone in a pose (cineEmote) when staging is cut short: let it go.
await B.evaluate(() => { const T = window.__trollOps; T.matchIntro?.skip?.(); for (const rp of T.remotes.byId.values()) rp.cineEmote = 0; });
await A.evaluate(() => { const T = window.__trollOps; T.move.reset(0, 0, 0); T.look.yaw = 0; T.look.pitch = 0; });
await pump(B, 1200);

const snap = (page) => page.evaluate(() => {
  const T = window.__trollOps, s = T.throwState, arms = T.streakArms.userData.arms;
  const m = T.throwModel?.();
  return {
    phase: s.phase, t: s.t, armed: s.armed, fuse: T.cooking.fuse, def: T.cooking.def?.id || null,
    gun: !!T.activeWeaponMesh?.()?.visible, rods: arms.map((a) => a.rod.visible),
    nadeInHand: !!m?.visible, pinOn: !!m?.userData.pin && m.userData.pin.parent === m,
    live: T.grenades.live.filter((g) => g.ownerId === "player").length,
  };
});

// ── a cooked throw ──────────────────────────────────────────────────────
// A 60 s fuse so a slow headless frame rate can't cook it off mid-test;
// the page notes every frame (the throw's own clock, not this script's).
const LONG = 60;
await A.evaluate((LONG) => {
  const T = window.__trollOps;
  T.loadout.lethalId = "frag"; T.player.gear.lethal = 4;
  T.startCook("lethal");
  T.cooking.fuse = LONG;
  const tl = window.__tl = [];
  const look = () => {
    const s = T.throwState, m = T.throwModel?.();
    tl.push({ t: s.t, phase: s.phase, armed: s.armed, fuse: T.cooking.fuse, gun: !!T.activeWeaponMesh?.()?.visible,
      rod: T.streakArms.userData.arms[0].rod.visible, nade: !!m?.visible, pinOn: !!m?.userData.pin && m.userData.pin.parent === m });
    if (s.phase !== "hold" || s.t < 0.6) requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
}, LONG);
await pump(A, 1200);
const tl = await A.evaluate(() => window.__tl);
const early = tl.filter((f) => f.phase === "draw" || f.phase === "pin");
const held = tl.filter((f) => f.phase === "hold");
check("G down: the gun goes away and the grenade comes up in the right hand, pin in",
  early.some((f) => !f.gun && f.rod && f.nade && f.pinOn), JSON.stringify(early.slice(-2)));
check("the fuse hasn't started before the pin's out", tl.filter((f) => !f.armed).every((f) => f.fuse === LONG) && early.length > 0, `${early.length} early frames`);
check("by 0.3 s the pin is out and the fuse is burning", held.length > 0 && held[0].t >= 0.29 && held[0].t < 0.4 && held.at(-1).armed && !held.at(-1).pinOn && held.at(-1).fuse < LONG,
  JSON.stringify({ first: held[0], last: held.at(-1) }));
let s;
// B sees A holding it
await pump(B, 500);
const seen = await B.evaluate(() => {
  const T = window.__trollOps;
  const rp = [...T.remotes.byId.values()].find((r) => !r.peer.isBot);
  return rp ? { ck: rp.peer.throwCk || null, nade: !!rp.rig.throwModel?.visible, gun: !!rp.weaponMesh?.visible, thr: rp.thr || null, model: !!rp.rig.throwModel, keys: Object.keys(rp.rig).filter((k) => /throw/i.test(k)), weapon: rp.peer.weapon, em: rp.emCode, wm: !!rp.weaponMesh, drink: rp.peer.drink, inRig: rp.rig.throwModel?.parent === rp.rig.root, alive: rp.alive } : null;
});
check("the other tab sees A holding a live grenade (ck), the gun away", !!seen && /^3:/.test(seen.ck || "") && seen.nade && !seen.gun, JSON.stringify(seen));
// nothing else works with it in hand
const blocked = await A.evaluate(() => {
  const T = window.__trollOps, w = T.currentWeapon();
  const ammo = w.ammoInMag;
  T.setTrigger(true); T.setAds(true);
  return { ammo };
});
await pump(A, 300);
const after = await A.evaluate(() => { const T = window.__trollOps; const w = T.currentWeapon(), r = { ammo: w.ammoInMag, ads: w.adsT }; T.setTrigger(false); T.setAds(false); T.tryReload(); return { ...r, reloading: w.reloading }; });
check("fire, aim and reload do nothing while it's held", after.ammo === blocked.ammo && after.ads < 0.05 && !after.reloading, JSON.stringify({ blocked, after }));
// the throw (B watches every frame it draws for A's whip)
await B.evaluate(() => {
  window.__sawThrow = null;
  const look = () => {
    for (const rp of window.__trollOps.remotes.byId.values()) {
      if (!rp.peer.isBot && (rp.thr?.phase === "throw" || rp.throwT > 0)) window.__sawThrow ??= { thr: rp.thr?.phase || null, throwT: rp.throwT, nade: !!rp.rig.throwModel?.visible };
    }
    requestAnimationFrame(look);
  };
  look();
});
const thrown = await A.evaluate(() => {
  const T = window.__trollOps;
  T.requestThrow();
  const g = T.grenades.live.filter((x) => x.ownerId === "player").at(-1);
  T.camera.updateMatrixWorld(true);
  return { live: !!g, dist: g ? g.mesh.position.distanceTo(T.camera.getWorldPosition(new g.pos.constructor())) : null, fuse: g?.fuse };
});
check("key-up throws it out at once", thrown.live, JSON.stringify(thrown));
check("it's drawn from the hand (within a metre of the eye)", thrown.dist != null && thrown.dist < 1.0, `${thrown.dist?.toFixed(2)} m`);
await pump(A, 250);
const conv = await A.evaluate(() => { const g = window.__trollOps.grenades.live.filter((x) => x.ownerId === "player").at(-1); return g ? g.mesh.position.distanceTo(g.pos) : 0; });
check("then it's drawn where it really is", conv < 0.02, `${conv.toFixed(3)} m off`);
await pump(B, 400);
const seenThrow = await B.evaluate(() => window.__sawThrow);
check("the other tab saw the throw", !!seenThrow, JSON.stringify(seenThrow));
await pump(A, 600);
s = await snap(A);
check("the gun is back up after the throw", s.gun && !s.phase, JSON.stringify(s));

// ── a tap ───────────────────────────────────────────────────────────────
// Timed in the page, frame by frame, in the throw's own clock (a headless
// frame can take 100 ms+, so wall-clock polling from here overstates it).
const tap = await A.evaluate(async () => {
  const T = window.__trollOps;
  T.player.gear.lethal = 4;
  T.startCook("lethal");
  T.requestThrow();   // let go at once
  const before = T.grenades.live.filter((x) => x.ownerId === "player").length;
  const out = { before, phase: T.throwState.phase, want: T.throwState.want, threwAt: null, gunBack: null, wall0: performance.now(), frames: [] };
  window.__tap = out;
  const s = T.throwState;
  const look = () => {
    const n = T.grenades.live.filter((x) => x.ownerId === "player").length;
    const clock = s.phase === "throw" || s.phase === "raise" ? 0.3 + s.tRel : s.t;   // the tap goes at the pin (0.3)
    if (out.threwAt == null && n > before) out.threwAt = s.t;
    const gun = !!T.activeWeaponMesh?.()?.visible;
    out.frames.push([+(performance.now() - out.wall0).toFixed(0), s.phase, gun]);
    if (out.gunBack == null && gun && !s.phase) out.gunBack = out.lastClock ?? clock;
    else { out.lastClock = clock; requestAnimationFrame(look); }
  };
  requestAnimationFrame(look);
  return { before, phase: out.phase, want: out.want };
});
check("a tap waits for the pin before it throws", tap.phase === "draw" && tap.want, JSON.stringify(tap));
await pump(A, 2500);
const tapped = await A.evaluate(() => { const o = window.__tap; return { threwAt: o.threwAt, gunBack: o.gunBack, frames: o.frames.slice(-6) }; });
check("the tap goes out once the pin's out (~0.3 s)", tapped.threwAt != null && tapped.threwAt >= 0.28 && tapped.threwAt < 0.45, `${tapped.threwAt?.toFixed(2)} s`);
check("press to gun back up in under 0.9 s (BO2 quick)", tapped.gunBack != null && tapped.gunBack < 0.9, `${tapped.gunBack?.toFixed(2)} s ${JSON.stringify(tapped.frames)}`);

// ── cooked off in the hand ──────────────────────────────────────────────
await A.evaluate(() => { const T = window.__trollOps; T.player.gear.lethal = 4; T.startCook("lethal"); });
await pump(A, 400);
await A.evaluate(() => { window.__trollOps.cooking.fuse = 0.05; });
await pump(A, 600);
s = await snap(A);
check("a cook-off in the hand ends the throw and gives the gun back", !s.phase && !s.def && !s.nadeInHand, JSON.stringify(s));

if (process.env.SHOTS) {
  fs.mkdirSync(process.env.SHOTS, { recursive: true });
  await A.evaluate(() => { const T = window.__trollOps; T.player.gear.lethal = 4; T.startCook("lethal"); });
  for (const [ms, name] of [[60, "1-draw"], [140, "2-pin"], [180, "3-pin-out"], [400, "4-hold"]]) {
    await sleep(ms);
    await A.screenshot({ path: path.join(process.env.SHOTS, `throw-${name}.png`) });
  }
  await A.evaluate(() => window.__trollOps.requestThrow());
  for (const [ms, name] of [[40, "5-wind"], [80, "6-whip"], [120, "7-follow"]]) {
    await sleep(ms);
    await A.screenshot({ path: path.join(process.env.SHOTS, `throw-${name}.png`) });
  }
}

// ── a bot winds up first ────────────────────────────────────────────────
// One bot is told to throw (bots.js windup, as its own grenade plan does);
// the page watches it every frame: ck + the grenade in its hand first, the
// grenade in the world only after.
await A.close(); await B.close();   // lighter on the machine for the bot match
// Its own room: bots are run by the room's host, and A (the host here) has none.
const C = await open("C", { bots: true, room: ROOM + "B" });
await pump(C, 1500);
for (let i = 0; i < 30 && !(await C.evaluate(() => window.__trollOps.bots.bots.some((x) => x.alive))); i++) await pump(C, 500);
// staging freezes the bots, and its end puts them back on their spawns
await C.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
await pump(C, 1500);
const botId = await C.evaluate(() => {
  const T = window.__trollOps;
  if (T.isStaging()) T.endStaging();   // staging freezes the bots
  for (const rp of T.remotes.byId.values()) rp.cineEmote = 0;
  const b = T.bots.bots.find((x) => x.alive);
  if (!b) return null;
  b.frags = Math.max(1, b.frags | 0);
  window.__bot = { held: null, thrown: null, n0: T.botNadesThrown(), t0: performance.now() };
  b.windup = { t: 0, kind: "frag", at: { x: b.pos.x + 9, y: 0, z: b.pos.z + 3 }, lob: false };
  const look = () => {
    const w = window.__bot, rp = T.remotes.byId.get(b.id);
    const now = performance.now() - w.t0;
    if (w.held == null && rp && /^[123]:/.test(rp.peer.throwCk || "") && rp.rig.throwModel?.visible) w.held = { at: now, ck: rp.peer.throwCk };
    if (w.thrown == null && T.botNadesThrown() > w.n0) w.thrown = now;
    if (w.thrown == null || w.held == null) requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
  return b.id;
});
await pump(C, 2500);
const wound = await C.evaluate(() => window.__bot);
check("a bot holds its grenade (ck) before throwing", !!botId && !!wound?.held && wound.thrown != null && wound.held.at < wound.thrown, JSON.stringify({ botId, wound, bots: await C.evaluate((id) => { const T = window.__trollOps, b = T.bots.bots.find((x) => x.id === id); return { n: T.bots.bots.length, alive: b?.alive, air: b?.airborne, windup: b?.windup || null, ck: b?.throwCk || null, frags: b?.frags, staging: T.isStaging(), state: T.state() }; }, botId) }));

check("no page errors", !errors.length, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
