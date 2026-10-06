// Troll Forces killcam: a bot's grenade and its scope-in show in the replay.
// The recorder keeps every grenade's flight and when it went off, and ADS
// rides on every pose; the replay draws stand-in grenades, re-fires the
// blast, and zooms the killer's view as they scoped in.
//
// Usage: node tools/troll-ops-killcam-test.mjs   (Supabase blocked, private)

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

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });

// --- recorder: grenades and ADS
const unit = await page.evaluate(() => {
  const K = window.__trollOps.killcam;
  const V = window.__trollOps.THREE.Vector3;
  K.record(500, "u", { x: 0, y: 0, z: 0, yaw: 0, ads: 0, th: 0.2 });
  K.record(500.1, "u", { x: 0, y: 0, z: 0, yaw: 0, ads: 1, th: 0.6 });
  const s = K.sampleAt("u", 500.05, {});
  const g = { def: { id: "frag" }, pos: new V(0, 2, 0) };
  K.recordNades(500, [g]);
  g.pos.set(4, 1, 0);
  K.recordNades(500.1, [g]);
  K.recordNades(500.2, []);   // gone: it went off
  const n = K.nades.get(g.kcKey);
  const mid = K.nadeAt(n, 500.05, new V());
  const after = K.nadeAt(n, 500.25, new V());
  K.clear();
  return { ads: s.ads, th: s.th, boomT: n.boomT, mid: mid && [mid.x, mid.y], after, cleared: K.nades.size };
});
check("ADS and the throw interpolate between samples", Math.abs(unit.ads - 0.5) < 0.02 && Math.abs(unit.th - 0.4) < 0.02, unit);
check("a grenade's flight is kept and its boom stamped", unit.boomT === 500.2 && Math.abs(unit.mid[0] - 2) < 0.05 && Math.abs(unit.mid[1] - 1.5) < 0.05, unit);
check("no grenade after it went off; clear() drops them", unit.after === null && unit.cleared === 0, unit);

// --- a real match: a bot scopes in, throws a frag, then kills us
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  T.loadout.mapId = "grinsite";
  await T.startGame();
  if (T.isStaging?.()) T.endStaging();
  T.player.spawnGuard = 0;
});
// The map loads behind its loading screen first: wait for the recorder.
await page.waitForFunction(() => window.__trollOps.killcam.tracks.size > 10, null, { timeout: 180000 }).catch(() => {});
await sleep(1500);

const setup = await page.evaluate(() => {
  const T = window.__trollOps;
  const b = T.bots.bots.find((x) => x.alive && x.team !== T.net.team);
  // Every bot keeps its distance and nobody else gets the kill.
  for (const o of T.bots.bots) if (o !== b) o.alive = false;
  b.pos.set(T.player.pos.x + 14, b.pos.y, T.player.pos.z);
  window.__kcBot = b.id;
  return { bot: b.id, tracked: T.killcam.tracks.has(b.id), team: b.team };
});
check("bots are on the killcam recorder", setup.tracked, setup);

// Hold the bot scoped in, then have it throw at us.
await page.evaluate(() => {
  const T = window.__trollOps;
  const b = T.bots.byId(window.__kcBot);
  // Nothing kills us before the bot does (its own frag included).
  b.__kcHold = setInterval(() => { b.ads = 1; b.adsLingerT = 5; T.player.maxHp = T.player.hp = 1e9; }, 16);
});
await page.waitForFunction(() => (window.__trollOps.killcam.tracks.get(window.__kcBot) || []).filter((s) => s.ads > 0.5).length > 8, null, { timeout: 60000 }).catch(() => {});
const threw = await page.evaluate(() => {
  const T = window.__trollOps;
  const b = T.bots.byId(window.__kcBot);
  return T.botThrow(b, "frag", { x: T.player.pos.x + 3, y: T.player.pos.y, z: T.player.pos.z });
});
check("the bot throws a frag", threw);
await page.waitForFunction(() => {
  const K = window.__trollOps.killcam;
  return [...K.nades.values()].some((n) => n.boomT !== null);
}, null, { timeout: 90000 }).catch(() => {});
await sleep(300);

const death = await page.evaluate(() => {
  const T = window.__trollOps;
  const b = T.bots.byId(window.__kcBot);
  clearInterval(b.__kcHold);
  const K = T.killcam;
  const tr = K.tracks.get(b.id) || [];
  const scoped = tr.filter((s) => s.ads > 0.5).length;
  const nades = [...K.nades.values()].map((n) => ({ def: n.def, pts: n.pts.length, boom: n.boomT !== null }));
  T.player.maxHp = T.player.hp = 100;
  T.player.spawnGuard = 0;
  T.damagePlayer(999, b.id, b.weaponId || "problem416");
  return { scoped, nades, replaying: K.replaying, base: T.baseFov ?? null };
});
check("the bot's track recorded it scoped in", death.scoped > 5, death);
check("the frag's flight and boom were recorded", death.nades.some((n) => n.def === "frag" && n.pts > 3 && n.boom), death);
check("dying to the bot starts a replay", death.replaying, death);

// Two frames of the replay: the gun coming up, then scoped in.
if (SHOT) for (const n of [1, 2]) { await sleep(700); await page.screenshot({ path: `${SHOT}/killcam-${n}.png` }); }

// Watch the replay play out.
const seen = await page.evaluate(async () => {
  const T = window.__trollOps;
  const K = T.killcam;
  const { game } = await import("/assets/games/troll-ops/core/state.js?v=st1");
  const out = { gunPlaced: 0, minFov: Infinity, maxFov: 0, nadeShown: false, liveShown: 0, booms: 0, frames: 0 };
  while (K.active && out.frames < 2000) {
    await new Promise((r) => requestAnimationFrame(r));
    out.frames++;
    out.minFov = Math.min(out.minFov, T.camera.fov);
    out.maxFov = Math.max(out.maxFov, T.camera.fov);
    if (K.replaying && T.grenades.live.some((g) => g.mesh.visible)) out.liveShown++;
    const geo = T.grenades.geo;
    let shown = false;
    T.grenades.root.parent?.traverse?.((o) => { if (o.isMesh && o.geometry === geo && o.visible && !T.grenades.live.some((g) => g.mesh === o)) shown = true; });
    if (shown) out.nadeShown = true;
    if (K.boomsSince([]).length) out.booms++;
    // The killer's gun in front of the camera, posed off the origin (a second copy of
    // killcam-present.js under another ?v= tag once built it and never moved it).
    if (K.replaying && game.weaponScene.children.some((c) => c !== game.weaponRig && c.isGroup && c.visible && c.position.length() > 0.2)) out.gunPlaced++;
  }
  out.endFov = T.camera.fov;
  return out;
});
check("the replay shows a stand-in grenade in flight", seen.nadeShown, seen);
check("the frag goes off in the replay", seen.booms > 0, seen);
check("the killer's gun is posed in front of the camera", seen.gunPlaced > 10, seen);
check("the killer's view zooms in while they're scoped", seen.minFov < 70, seen);
check("live grenades are hidden while it plays", seen.liveShown === 0, seen);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : "all killcam checks passed");
process.exit(failures ? 1 : 0);
