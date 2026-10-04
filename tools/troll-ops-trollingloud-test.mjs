// Trolling Loud: the club's own systems, in the real game.
//   - the map builds with at most 14 real lights, and the count never changes
//   - the beat clock advances
//   - shots: a sign shorts out and relights, the ball spins up, a bottle
//     breaks, nothing throws
//   - the DJ's track: on in a match, muffled outside the hall, off under
//     the radio
//   - Zombies: they reach a player on every floor (ground, mezzanine, roof)
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-trollingloud-test.mjs
// SKIP_Z=1 skips the (slow) zombie routing.

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
    if (mode === "zombies") T.loadout.poolMapId = "trollingloud"; else T.loadout.mapId = "trollingloud";
    await T.startGame();
    if (T.isStaging?.()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
  }, mode);
  await sleep(5000);
  return { page, errors };
}

/* ---------------------------------------------------------------- versus */
{
  console.log("--- versus");
  const { page, errors } = await open("tdm");
  const lightCount = () => page.evaluate(() => { let n = 0; window.__trollOps.scene.traverse((o) => { if (o.isPointLight || o.isSpotLight) n++; }); return n; });
  const dbg = () => page.evaluate(async () => (await import("/assets/games/troll-ops/maps.js")).MAPS.trollingloud.debug());
  // (waitForFunction needs a plain predicate: an async one returns a Promise, which is truthy at once)
  await page.evaluate(async () => { window.__tl = (await import("/assets/games/troll-ops/maps.js")).MAPS.trollingloud; });
  await page.waitForFunction(() => { const d = window.__tl.debug(); return d.active && d.beat > 0; }, null, { timeout: 60000 });
  await sleep(1000);
  const d0 = await dbg();
  check(d0.lights > 0 && d0.lights <= 14, "the map makes at most 14 lights", `${d0.lights}`);
  const n0 = await lightCount();
  // the beat, read in-page across 2 s of real time (no stale read across awaits)
  const beats = await page.evaluate(async () => {
    const M = (await import("/assets/games/troll-ops/maps.js")).MAPS.trollingloud;
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

  // shots, straight through the map hook the bullets use
  const shot = await page.evaluate(async () => {
    const M = (await import("/assets/games/troll-ops/maps.js")).MAPS.trollingloud;
    const sign = M.debug().signs.find((s) => s.g === 5);           // "u mad?" over the bar
    M.onShot({ x: sign.x, y: sign.y, z: sign.z });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const signOut = M.debug().kill[5];
    M.onShot({ x: 0, y: 6.75, z: -3 });                            // the mirror ball
    const ball = M.debug().ballBoost;
    const sh = M.debug().shelf;
    M.onShot({ x: 29.6, y: sh.y0 + 0.6, z: 1.6 });                 // a bottle
    const gone = M.debug().gone;
    M.onShot({ x: 0.3, y: 1.6, z: -14.0 });                        // the decks
    return { signOut, ball, gone, group: sign.g };
  });
  check(shot.signOut === 1, "a shot sign goes dark");
  check(shot.ball > 0.9, "the mirror ball spins up when shot");
  check(shot.gone === 1, "a shot bottle breaks");
  await sleep(4000);
  const back = await page.evaluate(async () => (await import("/assets/games/troll-ops/maps.js")).MAPS.trollingloud.debug().kill[5]);
  check(back === 0, "the sign relights");
  check((await lightCount()) === n0, "the light count never changed", `${n0}`);

  // the track: on in the hall, muffled out in the alley, off under the radio
  const snd = await page.evaluate(async () => {
    const T = window.__trollOps;
    const M = (await import("/assets/games/troll-ops/maps.js")).MAPS.trollingloud;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // (headless, the camera can sit on the intro shot, so the zones are read
    // straight off the muffle map rather than from wherever the camera is)
    await wait(1500);
    const hall = { want: M.debug().want, lp: M.debug().muffleAt(0, 1.9, 4) };
    const alley = { lp: M.debug().muffleAt(0, 1.7, 30) };
    M.onFrame({ live: true, radio: true });
    const radio = { want: M.debug().want };
    return { hall, alley, radio, ctx: !!T.audio?.ctx };
  });
  if (snd.hall.lp === null) console.log("SKIP the track (no audio context in this browser)");
  else {
    check(snd.hall.want > 0, "the DJ's track plays in a match");
    check(snd.alley.lp < snd.hall.lp, "it's muffled outside the hall", `${Math.round(snd.hall.lp)} Hz -> ${Math.round(snd.alley.lp)} Hz`);
    check(snd.radio.want === 0, "it stops under the radio");
  }
  check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
  await page.close();
}

/* ------------------------------------------------------- search & destroy */
// pickBombSites works the sites out from the spawn halves; they should land
// in the two side rooms on the ground floor: the VIP lounge (west) and the
// bar (east), one each, both inside the club.
{
  console.log("--- search & destroy");
  const { page, errors } = await open("snd");
  const r = await page.evaluate(async () => {
    const T = window.__trollOps;
    const { groundHeightAt } = await import("/assets/games/troll-ops/movement.js");
    return T.bombSites().map((s) => ({ ...s, y: groundHeightAt(typeof T.colliders === "function" ? T.colliders() : T.colliders, s.x, s.z, 3) }));
  });
  console.log("sites", JSON.stringify(r));
  const room = (s) => Math.abs(s.x) > 14.5 && Math.abs(s.x) < 29.5 && s.z > -7 && s.z < 13 ? (s.x < 0 ? "VIP" : "bar") : null;
  for (const s of r) check(!!room(s) && Math.abs(s.y - 0.3) < 0.05, `site ${s.id} is on the club floor in the VIP or the bar`, `(${s.x}, ${s.y?.toFixed(2)}, ${s.z}) ${room(s) || "outside"}`);
  check(r.length === 2 && room(r[0]) && room(r[1]) && room(r[0]) !== room(r[1]), "one site in each room");
  check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
  await page.close();
}

/* ---------------------------------------------------------------- zombies */
if (!process.env.SKIP_Z) {
  console.log("--- zombies");
  const { page, errors } = await open("zombies");
  await page.waitForFunction(() => !!window.__trollOps.zdir(), null, { timeout: 120000 });
  // stand still on each floor; at least one zombie must reach you
  for (const [name, x, y, z] of [["ground (bar)", 21.5, 0.3, 6], ["mezzanine", -11.7, 4.5, 4.5], ["roof", 10, 9.0, -2]]) {
    const r = await page.evaluate(async ({ x, y, z }) => {
      const T = window.__trollOps;
      const zd = T.zdir();
      zd.clear();
      zd.startRound(4);
      T.move.pos.set(x, y, z);
      T.player.maxHp = T.player.hp = 1e9;
      const t0 = performance.now();
      let best = 99;
      while (performance.now() - t0 < 150000) {
        T.move.pos.set(x, y, z);
        for (const q of zd.zombies) {
          if (!q.alive || q.dying) continue;
          const p = q.mesh.position;
          const d = Math.hypot(p.x - x, p.z - z);
          if (Math.abs(p.y - y) < 1.2) best = Math.min(best, d);
        }
        if (best < 2.5) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      return { best: +best.toFixed(1), s: ((performance.now() - t0) / 1000).toFixed(0) };
    }, { x, y, z });
    check(r.best < 2.5, `zombies reach a player on the ${name}`, `closest ${r.best} m after ${r.s} s`);
  }
  check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
