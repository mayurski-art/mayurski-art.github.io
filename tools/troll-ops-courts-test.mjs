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
//   game: A runs it at the board vs the next NPC on the ladder: teams form,
//         the ball's checked to A (no shot till it's live), a make from the
//         top is 2 and A keeps it, the NPC gets a possession and shoots, a
//         score without taking it back doesn't count, 11 wins and moves the
//         ladder; B sees the game, the NPC and the card; B joins A's next
//         game (1v1, two players); the 3-point contest counts its makes.
//   tennis: A takes a racket (B sees it in A's hand); a practice serve off
//         the toss lands in the deuce box; a match vs the club pro: placed
//         for the serve, the serve in, a rally (A's timed stroke goes over
//         and the pro returns it), faults (two = a double fault, a point),
//         7 wins and moves the ladder; B sees the match and the pro.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-courts-test.mjs [gear] [hoops] [game] [tennis]

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
const HSafe = (p) => p.evaluate(() => window.__trollHoops?.state?.() || null);
// the module URLs the game itself imports (same tags, so the same instances)
const modUrl = (page, file) => page.evaluate((file) => {
  const all = performance.getEntriesByType("resource").map((e) => e.name);
  return all.find((u) => u.includes(`/${file}?`)) || null;
}, file);

const A = await open("A", "baller_a");
await join(A);
const B = want("hoops") || want("game") || want("tennis") ? await open("B", "watcher_b") : null;
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
  // B may be a frame or two behind under load
  for (let i = 0; i < 15; i++) { if (await B.evaluate((id) => !!window.__trollHoops.balls.get(id)?.sim, shotBall?.id)) break; await pumpAll(both, 200); }
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

if (want("game")) {
  const GS = (p) => p.evaluate(() => window.__trollHoopsGame.state());
  const HS = (p) => p.evaluate(() => window.__trollHoops.state());
  const putAt = (p, x, z, yaw = 0) => p.evaluate(({ x, z, yaw }) => { const T = window.__trollOps; T.move.reset(x, z, 0.06); T.look.yaw = yaw; T.look.pitch = 0; }, { x, z, yaw });
  const key = async (p, k, ms) => { await p.keyboard.down(k); await pumpAll(both, ms); await p.keyboard.up(k); };
  /* wait (pumping both tabs) till the game on A says so */
  const until = async (fn, ms = 9000) => { const t0 = Date.now(); let g; while (Date.now() - t0 < ms) { g = await GS(A); if (fn(g)) return g; await pumpAll(both, 150); } return g; };
  const L = await A.evaluate(() => window.__trollOps.builtMap().map.rp.courts());
  const rim = L.layout.rims[0], board = L.hoops.board;
  await A.evaluate(() => { window.__trollHoopsGame.setLadder(0); window.__trollHoopsGame.G.calm = true; });
  // 1. run it
  await putAt(A, board.x - 1.2, board.z - 0.8, Math.PI / 2);
  await pumpAll(both, 500);
  const pr = await A.evaluate(() => window.__trollOps.rp().prompt || "");
  check("at the board (south side): run it vs the next baller", /run it: 1v1 to 11 vs/i.test(pr), pr);
  // hold X till it takes (slow headless frames stretch the hold)
  for (let i = 0; i < 3 && !(await GS(A)).s; i++) await key(A, "x", 1400);
  let g = await GS(A);
  check("a game is waiting for players", !!g.s && (g.s.phase === "wait" || g.s.phase === "check"), JSON.stringify(g.s));
  g = await until((x) => x.s?.phase === "check");
  check("nobody came: A vs an NPC, the ball checked to A", g.s?.teams[0][0] && /^npc/.test(g.s?.teams[1][0] || "") && g.s.phase === "check" && g.s.holder === g.s.teams[0][0], JSON.stringify(g.s));
  // hold the check open while we try (slow frames could let it go live first)
  await A.evaluate(() => { window.__trollHoopsGame.G.s.checkAt = Date.now() + 1e9; });
  let h = await HS(A);
  check("A has the game ball at the top", h.ball === g.s?.id + "-b", JSON.stringify({ ball: h.ball }));
  await A.evaluate(() => { window.__trollHoops.H.autoRelease = 0.44; window.__trollHoops.startShot(); });
  h = await HS(A);
  check("no shot before it's checked", !h.shot, JSON.stringify(h.shot));
  await A.evaluate(() => { window.__trollHoopsGame.G.s.checkAt = 0; });
  g = await until((x) => x.s?.phase === "live");
  check("then it's live", g.s?.phase === "live", g.s?.phase);
  // the NPC on defence stands between A and the rim
  const npc = g.npcs[0];
  const me = await A.evaluate(() => ({ x: window.__trollOps.move.pos.x, z: window.__trollOps.move.pos.z }));
  check("the NPC guards A, between him and the rim", npc && npc.z < me.z && Math.abs(npc.x - me.x) < 1.6, JSON.stringify({ npc, me }));
  await followShot(A, "game-check", [2.6, 1.6, 2.6], [0, 1.0, -1.6]);
  await followOff(A);
  // 2. a make from the top: 2, and A keeps it
  await A.evaluate(() => { window.__trollHoops.H.autoRelease = 0.44; window.__trollHoops.startShot(); });
  await pumpAll(both, 3200);
  g = await GS(A);
  check("a make from the top is 2, and A checks it again", g.s?.score[0] === 2 && g.s.poss === 0 && (g.s.phase === "check" || g.s.phase === "live"), JSON.stringify(g.s));
  // B sees it
  const gb = await GS(B);
  check("B sees the game and the NPC", gb.s?.score[0] === 2 && gb.shown.length === 1, JSON.stringify({ s: gb.s?.score, shown: gb.shown }));
  await camShot(B, "game-B", [rim.x + 6, 2.6, rim.z + 10], [rim.x, 1.2, rim.z + 5]);
  // 3. the NPC's ball: it attacks and shoots
  await A.evaluate(() => window.__trollHoopsGame.check(1));
  await pumpAll(both, 1900);
  let npcShot = null;
  for (let i = 0; i < 40 && !npcShot; i++) {
    await pumpAll(both, 300);
    g = await GS(A);
    h = await HS(A);
    npcShot = g.npcs.find((n) => n.shot) || h.balls.find((b) => b.flying && /^npc/.test(b.id) === false && b.events.length) || (g.s?.score[1] > 0 ? "scored" : null) || (g.s?.poss === 0 && g.s.phase !== "check" ? "rebound" : null);
  }
  check("with the ball, the NPC attacks and puts up a shot", !!npcShot, JSON.stringify({ npcs: g.npcs, s: g.s }));
  await pumpAll(both, 2500);
  // 4. take it back: a defensive board, a score from inside the arc doesn't count
  await A.evaluate(() => window.__trollHoopsGame.check(0));
  await until((x) => x.s?.phase === "live");
  await putAt(A, rim.x, rim.z + 4.6, 0);
  await pumpAll([A], 200);
  await A.evaluate(() => { window.__trollHoopsGame.G.s.clear = false; });
  const before = (await GS(A)).s.score.slice();
  await A.evaluate(() => { window.__trollHoops.H.autoRelease = 0.44; window.__trollHoops.startShot(); });
  await pumpAll(both, 3000);
  g = await GS(A);
  check("not taken back: the make doesn't count, their ball", g.s?.score[0] === before[0] && g.s.poss === 1, JSON.stringify({ before, s: g.s }));
  // 5. game point
  await A.evaluate(() => { const s = window.__trollHoopsGame.G.s; s.score = [10, 3]; window.__trollHoopsGame.check(0); });
  await until((x) => x.s?.phase === "live");
  await putAt(A, rim.x, rim.z + 4.6, 0);
  await pumpAll([A], 200);
  await A.evaluate(() => { window.__trollHoops.H.autoRelease = 0.44; window.__trollHoops.startShot(); });
  await pumpAll(both, 3000);
  g = await GS(A);
  const lad = await A.evaluate(() => window.__trollHoopsGame.ladder());
  check("11 wins it, and the ladder moves up", g.s?.phase === "over" && g.s.winner === 0 && g.s.score[0] === 11 && lad === 1, JSON.stringify({ s: g.s, lad }));
  await shot(A, "game-over");
  await pumpAll(both, 6500);
  g = await GS(A);
  check("the game ends, the NPC goes back", !g.s && !g.npcs.length, JSON.stringify(g));
  // 6. B joins A's next game
  await putAt(A, board.x - 1.2, board.z - 0.8, Math.PI / 2);
  await putAt(B, board.x - 1.2, board.z - 1.6, Math.PI / 2);
  await pumpAll(both, 500);
  for (let i = 0; i < 3 && (await GS(A)).s?.phase !== "wait"; i++) await key(A, "x", 1300);
  await pumpAll(both, 600);
  const prB = await B.evaluate(() => window.__trollOps.rp().prompt || "");
  check("B at the board: join A's game", /join .*game/i.test(prB), prB);
  await key(B, "x", 1400);
  await pumpAll(both, 4000);
  g = await GS(A);
  const idB = await B.evaluate(() => window.__trollOps.net.id);
  const dbg = await A.evaluate(() => ({ joiners: window.__trollHoopsGame.G.s?.joiners, id: window.__trollHoopsGame.G.s?.id }));
  const dbgB = await B.evaluate(() => ({ id: window.__trollHoopsGame.G.s?.id, phase: window.__trollHoopsGame.G.s?.phase }));
  check("two players: 1v1, A against B", g.s?.teams[1][0] === idB && g.s.teams[0].length === 1, JSON.stringify({ teams: g.s?.teams, dbg, dbgB, idB }));
  await pumpAll(both, 1000);
  // A walks off: end it from the host side
  await A.evaluate(() => { const s = window.__trollHoopsGame.G.s; if (s) { s.phase = "over"; s.winner = 0; s.overAt = 0; } });
  await pumpAll(both, 1500);
  // 7. the 3-point contest
  await putAt(A, board.x - 1.2, board.z + 0.9, Math.PI / 2);
  await pumpAll(both, 500);
  const pr3 = await A.evaluate(() => window.__trollOps.rp().prompt || "");
  check("north side of the board: the 3-point contest", /3-point contest/i.test(pr3), pr3);
  await key(A, "x", 900);
  await pumpAll([A], 600);
  h = await HS(A);
  let c = (await GS(A)).contest;
  check("on the first spot with a ball", !!h.ball && c?.rack === 0, JSON.stringify({ ball: h.ball, c }));
  await followShot(A, "contest", [1.8, 1.6, 2.2], [0, 1.2, -2]);
  await followOff(A);
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 20; k++) { const st = await HS(A); if (st.ball && !st.shot) break; await pumpAll([A], 200); }
    await A.evaluate(() => { window.__trollHoops.H.autoRelease = 0.44; window.__trollHoops.startShot(); });
    await pumpAll([A], 1200);
  }
  await pumpAll([A], 1500);
  c = (await GS(A)).contest;
  check("perfect releases from the corner count", c && c.score >= 2 && c.shot === 3, JSON.stringify(c));
  await A.evaluate(() => window.__trollHoopsGame.finishContest());
}

if (want("tennis")) {
  const TS = (p) => p.evaluate(() => window.__trollTennis.state());
  const putAt = (p, x, z, yaw = 0) => p.evaluate(({ x, z, yaw }) => { const T = window.__trollOps; T.move.reset(x, z, 0.06); T.look.yaw = yaw; T.look.pitch = 0; }, { x, z, yaw });
  const key = async (p, k, ms) => { await p.keyboard.down(k); await pumpAll(both, ms); await p.keyboard.up(k); };
  const until = async (fn, ms = 9000) => { const t0 = Date.now(); let g; while (Date.now() - t0 < ms) { g = await TS(A); if (fn(g)) return g; await pumpAll(both, 120); } return g; };
  const L = await A.evaluate(() => window.__trollOps.builtMap().map.rp.courts());
  const C = L.layout.tennis, hop = L.tennis.rack;
  await A.evaluate(() => { window.__trollTennis.setLadder(0); window.__trollTennis.M.calm = true; });
  // 1. a racket
  if ((await HSafe(A))?.ball) await A.evaluate(() => window.__trollHoops.rackBall?.());
  await putAt(A, hop.x + 1.0, hop.z + 0.5, Math.PI / 2);
  await pumpAll(both, 500);
  let pr = await A.evaluate(() => window.__trollOps.rp().prompt || "");
  check("at the hopper: take a racket", /take a racket/i.test(pr), pr);
  for (let i = 0; i < 3 && !(await TS(A)).racket; i++) await key(A, "x", 1200);
  let t = await TS(A);
  check("A has a racket", t.racket, JSON.stringify({ racket: t.racket }));
  await pumpAll(both, 1200);
  const idA = await A.evaluate(() => window.__trollOps.net.id);
  const seen = await B.evaluate((id) => { const p = window.__trollOps.net.peers.get(id); return { tr: p?.tennisClip | 0 }; }, idA);
  check("B sees A's racket", seen.tr > 0, JSON.stringify(seen));
  // 2. a practice serve from the deuce side of the near baseline
  await putAt(A, C.x + 1.2, C.z + C.dl + 0.4, 0);
  await pumpAll([A], 300);
  await A.evaluate(() => window.__trollTennis.tossNow());
  await followShot(A, "tennis-toss", [2.4, 1.6, 1.6], [0, 1.6, -1]);
  for (let i = 0; i < 30; i++) { const y = await A.evaluate(() => { const T = window.__trollTennis; const b = [...T.tballs.values()].find((x) => x.toss); return b?.sim ? b.sim.v[1] : -1; }); if (y < 0.4) break; await pumpAll([A], 16); }
  await A.evaluate(() => window.__trollTennis.hitServe("flat", 0));   // a clean toss: no scatter
  await followShot(A, "tennis-serve", [2.4, 1.6, 1.6], [0, 1.6, -1]);
  await followOff(A);
  await pumpAll(both, 2200);
  t = await TS(A);
  const sv = t.balls.find((b) => b.serve);
  const first = await A.evaluate((id) => window.__trollTennis.tballs.get(id)?.sim?.events.find((e) => e.kind === "bounce")?.p, sv?.id);
  const inBox = first && first[0] < C.x + 0.05 && first[0] > C.x - 4.15 && first[2] < C.z && first[2] > C.z - 6.45;
  check("the practice serve lands in the deuce box", !!inBox, JSON.stringify({ first, events: sv?.events }));
  // 3. a match vs the club pro
  const chair = { x: C.x + C.dw + 1.6, z: C.z };
  await putAt(A, chair.x - 1.4, chair.z, -Math.PI / 2);
  await pumpAll(both, 500);
  pr = await A.evaluate(() => window.__trollOps.rp().prompt || "");
  check("at the chair: play the club pro", /play .*tiebreak to 7/i.test(pr), pr);
  for (let i = 0; i < 3 && !(await TS(A)).s; i++) await key(A, "x", 1300);
  t = await until((x) => x.s?.phase === "serve");
  check("A vs the pro: a point is set to serve", t.s?.phase === "serve" && /^npc/.test(t.s.players[1] || ""), JSON.stringify(t.s));
  const pos = await A.evaluate(() => ({ x: window.__trollOps.move.pos.x, z: window.__trollOps.move.pos.z }));
  check("A is placed behind the near baseline", pos.z > C.z + C.dl, JSON.stringify(pos));
  // play the point: serve if it's ours, then hit what comes, timed
  let rally = { aHits: 0, npcHits: 0 };
  const playPoint = async () => {
    let me = await until((x) => x.s?.phase === "serve", 6000);
    const t0 = Date.now();
    if (me.s?.server === idA) {
      await A.evaluate(() => window.__trollTennis.tossNow());
      for (let i = 0; i < 30; i++) { const y = await A.evaluate(() => { const b = [...window.__trollTennis.tballs.values()].find((x) => x.toss); return b?.sim ? b.sim.v[1] : -1; }); if (y < 0.4) break; await pumpAll([A], 16); }
      await A.evaluate(() => window.__trollTennis.hitServe("flat"));
    }
    while (Date.now() - t0 < 14000) {
      const inc = await A.evaluate(() => window.__trollTennis.incoming());
      if (inc && inc.in > 0.3 && inc.in < 0.55) {
        await A.evaluate(() => window.__trollTennis.swing("top"));
        await pumpAll(both, 700);
      } else await pumpAll(both, 60);
      me = await TS(A);
      for (const b of me.balls) { if (b.hitter === idA && !b.serve && !b.toss) rally.aHit = true; if (/^npc/.test(b.hitter || "")) rally.npcHit = true; }
      if (me.s?.phase === "point" || me.s?.phase === "over") return me;
    }
    return me;
  };
  t = await playPoint();
  for (let i = 0; i < 3 && !(rally.aHit && rally.npcHit) && t.s?.phase !== "over"; i++) t = await playPoint();
  check("a rally: A's timed stroke goes back and the pro returns", rally.npcHit && (rally.aHit || t.s?.score?.some((x) => x > 0)), JSON.stringify({ rally, s: t.s }));
  await camShot(B, "tennis-B", [C.x + C.dw + 3, 3.2, C.z + 4], [C.x, 0.8, C.z]);
  // 4. faults
  await until((x) => x.s?.phase === "serve", 6000);
  await A.evaluate(() => { const s = window.__trollTennis.M.s; s.server = s.players[0]; s.serveNo = 1; s.phase = "serve"; s.seq++; });
  await pumpAll(both, 400);
  const before = (await TS(A)).s.score.slice();
  for (const k of [1, 2]) {
    await A.evaluate(() => window.__trollTennis.tossNow());
    await pumpAll([A], 300);
    const deuce = (await TS(A)).s?.deuce;
    await A.evaluate(({ x, z }) => window.__trollTennis.serveTo(x, z), { x: C.x + (deuce ? 3 : -3), z: C.z - 3 });   // the wrong box
    await pumpAll(both, 1500);
  }
  t = await TS(A);
  check("two serves out of the box: a double fault, the pro's point", t.s && t.s.score[1] === before[1] + 1, JSON.stringify({ before, s: t.s, calls: await A.evaluate(() => window.__trollTennis.M.calls) }));
  // 5. set point and the win
  await until((x) => x.s?.phase === "serve", 6000);
  await A.evaluate(() => { window.__trollTennis.M.s.score = [6, 2]; window.__trollTennis.award(0, "WINNER"); });
  await pumpAll(both, 800);
  t = await TS(A);
  const lad = await A.evaluate(() => window.__trollTennis.ladder());
  check("7 wins the tiebreak and the ladder moves up", t.s?.phase === "over" && t.s.winner === 0 && lad === 1, JSON.stringify({ s: t.s, lad }));
  const tb = await B.evaluate(() => window.__trollTennis.state());
  check("B sees the match and the pro", !!tb.s && tb.s.score[0] === 7, JSON.stringify(tb.s));
  await pumpAll(both, 6500);
  t = await TS(A);
  check("the match ends, the pro goes back", !t.s && !t.npcs.length, JSON.stringify({ s: t.s, npcs: t.npcs }));
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
