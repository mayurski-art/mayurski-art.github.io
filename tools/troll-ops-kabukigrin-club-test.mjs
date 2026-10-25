// Kabukigrin's club: its own systems (club-live.js), in the real game.
//   - the map builds with at most 14 real lights, and the count never changes
//   - the beat clock advances
//   - shots: a sign in the hall shorts out and relights, the ball spins up,
//     a bottle breaks, nothing throws
//   - the DJ's track: on in a match, muffled outside the hall, off under
//     the radio
//   - search & destroy: site A on the dance floor, site B across the street
// The spots come from the map itself (its debug(), the ball in the scene),
// so moving a sign or the shelf doesn't break the test. Kabukigrin has no
// Zombies, so (unlike Trolling Loud's test, which this replaced) there's no
// zombie routing. Socialize and the DJ: troll-ops-dj-test.mjs.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-kabukigrin-club-test.mjs

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
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAPS_JS = "/assets/games/troll-ops/maps/maps.js";

async function open(mode) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
  await page.evaluate(async (mode) => {
    const T = window.__trollOps;
    T.setMode(mode);
    if (T.els.noBots) T.els.noBots.checked = true;
    T.loadout.mapId = "kabukigrin";
    await T.startGame();
    if (T.isStaging?.()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
  }, mode);
  // the map, built (a fixed sleep wasn't enough on a busy box)
  await page.waitForFunction(() => !!window.__trollOps.builtMap()?.map, null, { timeout: 240000 });
  await sleep(5000);
  // (waitForFunction needs a plain predicate: an async one returns a Promise, which is truthy at once)
  await page.evaluate(async (u) => { window.__kb = (await import(u)).MAPS.kabukigrin; }, MAPS_JS);
  return { page, errors };
}

/* ---------------------------------------------------------------- versus */
{
  console.log("--- versus");
  const { page, errors } = await open("tdm");
  const lightCount = () => page.evaluate(() => { let n = 0; window.__trollOps.scene.traverse((o) => { if (o.isPointLight || o.isSpotLight) n++; }); return n; });
  const dbg = () => page.evaluate(() => { const { muffleAt, ...d } = window.__kb.debug(); return d; });
  await page.waitForFunction(() => { const d = window.__kb.debug(); return d.active && d.beat > 0; }, null, { timeout: 60000 });
  await sleep(1000);
  const d0 = await dbg();
  check(d0.lights > 0 && d0.lights <= 14, "the map makes at most 14 lights", `${d0.lights}`);
  const n0 = await lightCount();
  // the beat, read in-page across 2 s of real time (no stale read across awaits)
  const beats = await page.evaluate(async () => {
    const M = window.__kb;
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    await frame(); await frame();
    const a = M.debug().beat, t0 = performance.now();
    await new Promise((r) => setTimeout(r, 2000));
    await frame(); await frame();
    return { db: M.debug().beat - a, s: (performance.now() - t0) / 1000 };
  });
  const d1 = await dbg();
  check(d1.active, "the club clock is running (ticker drawn)");
  const bpm = beats.db / beats.s * 60;
  check(Math.abs(bpm - 128) < 8, "the beat advances at 128 BPM", `${bpm.toFixed(1)} BPM`);

  // shots, straight through the map hook the bullets use, at spots the map reports
  const shot = await page.evaluate(async () => {
    const M = window.__kb, T = window.__trollOps;
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const hall = M.dj.club;
    const inHall = (p) => p.x > hall.x0 && p.x < hall.x1 && p.z > hall.z0 && p.z < hall.z1;
    const sign = M.debug().signs.find(inHall);
    M.onShot({ x: sign.x, y: sign.y, z: sign.z });
    await frame();
    const signOut = M.debug().kill[sign.g];
    // the mirror ball: the sphere over the dance floor (its reflection hangs below the floor)
    let ball = null;
    T.scene.traverse((o) => {
      if (ball || !o.isMesh || o.geometry?.type !== "SphereGeometry") return;
      const p = o.getWorldPosition(o.position.clone());
      if (p.y > 2 && inHall(p) && o.geometry.parameters.radius < 2) ball = { x: p.x, y: p.y, z: p.z };
    });
    if (ball) M.onShot(ball);
    const boost = M.debug().ballBoost;
    // a bottle: along the shelf until one breaks
    const sh = M.debug().shelf;
    for (let z = sh.z0 + 0.1; z < sh.z1 && !M.debug().gone; z += 0.2) M.onShot({ x: (sh.x0 + sh.x1) / 2, y: sh.y0 + 0.6, z });
    const gone = M.debug().gone;
    M.onShot({ x: M.dj.spot.x, y: 1.6, z: M.dj.spot.z });           // the decks
    return { signOut, ball, boost, gone, group: sign.g };
  });
  check(shot.signOut === 1, "a shot sign in the hall goes dark", `group ${shot.group}`);
  check(!!shot.ball && shot.boost > 0.9, "the mirror ball spins up when shot", JSON.stringify(shot.ball));
  check(shot.gone === 1, "a shot bottle breaks");
  await sleep(4000);
  const back = await page.evaluate((g) => window.__kb.debug().kill[g], shot.group);
  check(back === 0, "the sign relights");
  check((await lightCount()) === n0, "the light count never changed", `${n0}`);

  // the track: on in the hall, muffled out on A Main, off under the radio
  const snd = await page.evaluate(async () => {
    const T = window.__trollOps, M = window.__kb, h = M.dj.club;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // (headless, the camera can sit on the intro shot, so the zones are read
    // straight off the muffle map rather than from wherever the camera is)
    await wait(1500);
    const hall = { want: M.debug().want, lp: M.debug().muffleAt((h.x0 + h.x1) / 2, 1.9, (h.z0 + h.z1) / 2) };
    const street = { lp: M.debug().muffleAt(h.x1 + 4.4, 1.7, (h.z0 + h.z1) / 2) };
    M.onFrame({ live: true, radio: true });
    const radio = { want: M.debug().want };
    return { hall, street, radio, ctx: !!T.audio?.ctx };
  });
  if (snd.hall.lp === null) console.log("SKIP the track (no audio context in this browser)");
  else {
    check(snd.hall.want > 0, "the DJ's track plays in a match");
    check(snd.street.lp < snd.hall.lp, "it's muffled outside the hall", `${Math.round(snd.hall.lp)} Hz -> ${Math.round(snd.street.lp)} Hz`);
    check(snd.radio.want === 0, "it stops under the radio");
  }
  check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
  await page.close();
}

/* ------------------------------------------------------- search & destroy */
// The sites are placed in Studio (kabukigrin.js SITES): A on the club's dance
// floor, B across the street on the B side. The game must use those two, on
// the ground.
{
  console.log("--- search & destroy");
  const { page, errors } = await open("snd");
  const r = await page.evaluate(async () => {
    const T = window.__trollOps, M = window.__kb;
    const { groundHeightAt } = await import("/assets/games/troll-ops/core/movement.js");
    const col = typeof T.colliders === "function" ? T.colliders() : T.colliders;
    return { game: T.bombSites().map((s) => ({ ...s, y: groundHeightAt(col, s.x, s.z, 3) })), map: M.debug().sites, hall: M.dj.club };
  });
  console.log("sites", JSON.stringify(r.game));
  const at = (id) => r.game.find((s) => s.id === id);
  const placed = r.map.every((m) => { const g = at(m.id); return g && Math.hypot(g.x - m.x, g.z - m.z) < 0.5; });
  check(r.game.length === 2 && placed, "the game plays the map's two sites", JSON.stringify(r.map));
  const A = at("A"), B = at("B"), h = r.hall;
  check(!!A && A.x > h.x0 && A.x < h.x1 && A.z > h.z0 && A.z < h.z1, "site A is in the club", A && `(${A.x}, ${A.z})`);
  check(!!B && B.x > 0, "site B is across the street", B && `(${B.x}, ${B.z})`);
  for (const s of r.game) check(Math.abs(s.y - (r.map.find((m) => m.id === s.id)?.y ?? 0)) < 0.1, `site ${s.id} is on the ground`, `y ${s.y?.toFixed(2)}`);
  check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
