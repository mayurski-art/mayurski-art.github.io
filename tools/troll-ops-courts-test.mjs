// Troll Forces Socialize, Troll Beach 5d: the court games. One tab (two for
// the wire checks), Supabase blocked, so no public room is ever touched.
//   gear: the hoop nets, the cart, the hopper and the three scoreboards are
//         placed; the slates are written; rp.courts() lists the spots; the
//         balls and the racket load. Shots in tools/.courts-shots.
//   hoops: A takes a ball at the cart; B sees it in A's hands; A dribbles,
//         crosses over (a size-up flick), shoots a free throw released in
//         the green (EXCELLENT, a make on both screens at the same step), a
//         late one (graded late), a sprint at the rim (a dunk through), and
//         picks up the loose ball.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-courts-test.mjs [gear] [hoops]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".courts-shots");
const ONLY = process.argv.slice(2);
const want = (k) => !ONLY.length || ONLY.includes(k);
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
async function pumpAll(pages, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) for (const p of pages) await p.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];

async function open(label, username) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript(({ name }) => {
    const fake = { getCachedProfile: () => ({ username: name, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  }, { name: username });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 420000 });
  await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
  return page;
}
async function join(page) {
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("social");
    T.loadout.mapId = "grinbeach";
    await T.startGame();
  });
  await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
  await page.evaluate(() => {
    window.__trollOps.els.pause.hidden = true;
    // a scratch camera after the game's own, for the shots
    const cam = window.__trollOps.camera;
    const orig = cam.updateMatrixWorld.bind(cam);
    cam.updateMatrixWorld = (f) => {
      const c = window.__courtCam;
      // follow: the offsets are from where the player is this frame
      const q = c?.follow ? window.__trollOps.move.pos : null;
      if (c && q) { cam.position.set(q.x + c.from[0], q.y + c.from[1], q.z + c.from[2]); cam.lookAt(q.x + c.at[0], q.y + c.at[1], q.z + c.at[2]); }
      else if (c) { cam.position.set(...c.from); cam.lookAt(...c.at); }
      return orig(f);
    };
  });
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const camShot = async (page, name, from, at) => {
  await page.evaluate(({ from, at }) => { window.__courtCam = { from, at }; }, { from, at });
  await pumpAll([page], 500);
  await shot(page, name);
  await page.evaluate(() => { window.__courtCam = null; });
};
/* A shot with the camera following the player (offsets from their feet),
   taken the frame `when` says so (a predicate run in the page). */
const followShot = async (page, name, from, at) => {
  await page.evaluate(({ from, at }) => { window.__courtCam = { follow: true, from, at }; }, { from, at });
  await page.screenshot({ type: "jpeg", quality: 10 });
  await shot(page, name);
};
const followOff = (page) => page.evaluate(() => { window.__courtCam = null; });
// the module URLs the game itself imports (same tags, so the same instances)
const modUrl = (page, file) => page.evaluate((file) => {
  const all = performance.getEntriesByType("resource").map((e) => e.name);
  return all.find((u) => u.includes(`/${file}?`)) || null;
}, file);

const A = await open("A", "baller_a");
await join(A);
const B = want("hoops") ? await open("B", "watcher_b") : null;
if (B) await join(B);
await pumpAll(B ? [A, B] : [A], 5000);
const both = B ? [A, B] : [A];

if (want("gear")) {
  const url = await modUrl(A, "maps/grinbeach-courts.js");
  check("the court gear module is loaded", !!url, url || "");
  const g = await A.evaluate(async (url) => {
    const m = await import(url);
    const T = window.__trollOps;
    const spots = T.builtMap().map.rp.courts?.();
    return {
      nets: m.HOOP_NETS.map((n) => !!n.obj?.parent),
      boards: [...m.BOARDS.keys()].map((k) => [k, !!m.BOARDS.get(k).mesh.parent]),
      spots: spots ? Object.keys(spots) : null,
    };
  }, url);
  check("both hoops have their nets", g.nets.length === 2 && g.nets.every(Boolean), JSON.stringify(g.nets));
  check("three scoreboards stand with their slates", g.boards.length === 3 && g.boards.every(([, on]) => on), JSON.stringify(g.boards));
  check("rp.courts() lists hoops, tennis and volleyball", ["hoops", "tennis", "vball"].every((k) => g.spots?.includes(k)), JSON.stringify(g.spots));
  // the balls and the racket load
  const props = await A.evaluate(async () => {
    const all = performance.getEntriesByType("resource").map((e) => e.name);
    const url = all.find((u) => u.includes("/maps/battlefield-props.js?"));
    const { loadModel } = await import(url);
    const T = window.__trollOps;
    const out = {};
    const at = [[47.2, 1.2, -9.2], [47.6, 1.2, -9.2], [48.0, 1.2, -9.2], [48.5, 0.95, -9.2]];
    let i = 0;
    for (const n of ["gb-basketball", "gb-tennisball", "gb-volleyball", "gb-racket"]) {
      try {
        const o = await loadModel(n);
        o.position.set(...at[i++]);
        if (n === "gb-racket") o.rotation.set(0, 0.5, 0.3);
        T.scene.add(o);
        const box = new (o.position.constructor)();
        let r = 0;
        o.traverse((m) => { if (m.isMesh) { m.geometry.computeBoundingSphere(); r = Math.max(r, m.geometry.boundingSphere.radius); } });
        out[n] = +r.toFixed(3);
      } catch (e) { out[n] = String(e.message || e); }
    }
    return out;
  });
  check("the basketball is regulation size", Math.abs(props["gb-basketball"] - 0.12) < 0.01, JSON.stringify(props));
  check("the tennis ball and volleyball load at size", Math.abs(props["gb-tennisball"] - 0.0335) < 0.005 && Math.abs(props["gb-volleyball"] - 0.105) < 0.01);
  check("the racket loads", typeof props["gb-racket"] === "number");
  await camShot(A, "gear-balls", [47.9, 1.45, -8.2], [47.85, 1.1, -9.2]);
  await camShot(A, "gear-hoop", [48.6, 2.6, -14.2], [48, 2.9, -17.4]);
  await camShot(A, "gear-cart-board", [51.5, 1.7, -9.5], [55.6, 1.0, -10]);
  await camShot(A, "gear-tennis", [62, 1.8, 3.5], [60, 0.8, 0]);
  await camShot(A, "gear-tennis-board", [67, 1.8, -1.5], [71.4, 1.3, -1.6]);
  await camShot(A, "gear-vball", [4.5, 1.8, -13.5], [9, 1.0, -15]);
}

if (want("hoops")) {
  const HS = (p) => p.evaluate(() => window.__trollHoops.state());
  const idA = await A.evaluate(() => window.__trollOps.net.id);
  const putAt = (p, x, z, yaw = 0) => p.evaluate(({ x, z, yaw }) => { const T = window.__trollOps; T.move.reset(x, z, 0.06); T.look.yaw = yaw; T.look.pitch = 0; }, { x, z, yaw });
  const key = async (p, k, ms) => { await p.keyboard.down(k); await pumpAll(both, ms); await p.keyboard.up(k); };
  // 1. the cart
  await putAt(A, 54.4, -13, -Math.PI / 2);
  await pumpAll(both, 600);
  const pr = await A.evaluate(() => window.__trollOps.rp().prompt || "");
  check("by the cart: grab a basketball", /grab a basketball/i.test(pr), pr);
  await key(A, "x", 900);
  await pumpAll(both, 300);
  let s = await HS(A);
  check("A holds a ball", !!s.ball && s.clip === "hoop-hold", JSON.stringify({ ball: s.ball, clip: s.clip }));
  await pumpAll(both, 1500);
  const seen = await B.evaluate((id) => { const T = window.__trollOps, p = T.net.peers.get(id), b = p && window.__trollHoops.balls.get(p.hoopBall); const r = T.remotes.byId.get(id); return { hb: p?.hoopBall || null, hm: p?.hoopMove | 0, holder: b?.holder || null, mesh: !!b?.mesh?.parent, gap: b?.mesh && r ? +b.mesh.position.distanceTo(r.pos).toFixed(2) : null }; }, idA);
  check("B sees the ball in A's hands", seen.hb === s.ball && seen.holder === idA && seen.mesh && seen.gap < 2, JSON.stringify(seen));
  // 2. the dribble
  await putAt(A, 48, -4, 0);
  await key(A, "w", 900);
  s = await HS(A);
  check("walking with it: a live dribble", s.live && s.clip === "hoop-dribble-r", JSON.stringify({ live: s.live, clip: s.clip }));
  // standing, the pound dribble, and walking with it, from the side
  await pumpAll(both, 400);
  for (const k of [0, 1, 2]) await followShot(A, `hoops-dribble-${k}`, [2.4, 1.1, 0.4], [0, 0.8, 0]);
  await A.keyboard.down("w");
  await pumpAll(both, 300);
  await followShot(A, "hoops-dribble-walk", [2.4, 1.1, 0.4], [0, 0.8, 0]);
  await A.keyboard.up("w");
  await followOff(A);
  // 3. the crossover: hold Q, flick the look left
  await putAt(A, 48, -3, 0);
  await pumpAll(both, 300);
  await A.keyboard.down("q");
  await pumpAll([A], 200);
  await A.evaluate(() => { window.__trollOps.look.yaw += 0.2; });   // one quick flick (headless frames are slow)
  await pumpAll([A], 150);
  s = await HS(A);
  check("a flick toward the left hand crosses over", s.lastMove === "cross", JSON.stringify({ move: s.lastMove, clip: s.clip }));
  await followShot(A, "hoops-cross", [0.6, 1.2, -2.6], [0, 0.8, 0]);
  await followOff(A);
  await pumpAll([A], 400);
  await A.keyboard.up("q");
  s = await HS(A);
  check("and the ball's in the left hand after", s.hand === -1, String(s.hand));
  // 4. a free throw, let go on the set point
  const rimZ = await A.evaluate(() => window.__trollOps.builtMap().map.rp.courts().layout.rims[0].z);
  await putAt(A, 48, rimZ + 4.6, 0);
  await pumpAll(both, 500);
  await A.evaluate(() => { window.__trollHoops.H.autoRelease = window.__trollHoops.HOOPS.release; window.__trollHoops.startShot(); });
  for (const k of [0, 1, 2]) await followShot(A, `hoops-jumper-${k}`, [2.6, 1.3, 0.8], [0, 1.2, -0.4]);
  await followOff(A);
  await pumpAll(both, 2600);
  s = await HS(A);
  const shotBall = s.balls.find((b) => !b.holder);
  check("released on the set point: EXCELLENT", s.feedback === "EXCELLENT", s.feedback);
  check("the free throw goes in", shotBall?.events.includes("score"), JSON.stringify(shotBall?.events));
  const onB = await B.evaluate((id) => { const b = window.__trollHoops.balls.get(id); return b?.sim ? { n: b.sim.events.map((e) => e.kind + "@" + e.n) } : null; }, shotBall?.id);
  const onA = await A.evaluate((id) => { const b = window.__trollHoops.balls.get(id); return b?.sim ? { n: b.sim.events.map((e) => e.kind + "@" + e.n) } : null; }, shotBall?.id);
  check("B saw the same flight, step for step", onB && onA && onB.n.slice(0, 3).join() === onA.n.slice(0, 3).join(), `A ${onA?.n.slice(0, 3)} | B ${onB?.n.slice(0, 3)}`);
  // 5. pick it up off the floor
  const rest = s.balls.find((b) => b.id === shotBall?.id)?.p;
  if (rest) { await putAt(A, rest[0] + 0.3, rest[2] + 0.3, 0); await pumpAll(both, 600); }
  s = await HS(A);
  check("walk over the loose ball: it's ours", s.ball === shotBall?.id, JSON.stringify({ ball: s.ball, rest }));
  // 6. a late one
  await putAt(A, 48, rimZ + 4.6, 0);
  await pumpAll([A], 300);
  await A.evaluate(() => { window.__trollHoops.H.autoRelease = 0.6; window.__trollHoops.startShot(); });
  await pumpAll(both, 2200);
  s = await HS(A);
  check("let go late: graded late", /LATE/.test(s.feedback || ""), s.feedback);
  // 7. a dunk: sprint at the rim, shoot
  for (let i = 0; i < 8 && !s.ball; i++) {
    const loose = s.balls.find((b) => !b.holder)?.p;
    if (loose) await putAt(A, loose[0], loose[2], 0);
    await pumpAll([A], 400);
    s = await HS(A);
  }
  check("got the rebound back", !!s.ball, JSON.stringify(s.balls));
  await A.evaluate(() => { window.__trollHoops.H.last = null; });
  await putAt(A, 48, rimZ + 9, 0);
  await A.keyboard.down("Shift"); await A.keyboard.down("w");
  for (let i = 0; i < 60; i++) {
    const d = await A.evaluate((rz) => window.__trollOps.move.pos.z - rz, rimZ);
    if (d < 4.0) break;
    await pumpAll([A], 16);
  }
  await A.evaluate(() => window.__trollHoops.startShot());
  await A.keyboard.up("w"); await A.keyboard.up("Shift");
  for (const k of [0, 1, 2, 3]) await followShot(A, `hoops-dunk-${k}`, [2.8, 1.4, 1.2], [0, 1.4, -0.6]);
  await followOff(A);
  await pumpAll(both, 1600);
  s = await HS(A);
  const dunked = s.balls.find((b) => b.events.includes("score") && b.id !== shotBall?.id) || s.balls.find((b) => b.events.includes("score"));
  check("sprinting at the rim it's a dunk, and it goes down", s.lastShot === "dunk" && s.last?.made, JSON.stringify({ kind: s.lastShot, last: s.last, balls: s.balls.map((b) => b.events.join(",")) }));
  await camShot(B, "hoops-B-view", [52, 2.4, rimZ + 6], [48, 1.5, rimZ + 1]);
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
