// Troll Royale phase C: everyone else's drop, and joining late.
//   1. One client, 99 bots: trolls on the belt are drawn standing, fallers
//      skydive (belly down), and nobody opens a glider any more.
//   2. A second client joining while the belt runs steps onto the floor
//      (no sky lobby of its own) and doesn't take the bots over.
//   3. A third joining after the floor has gone spectates.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-phase-c-test.mjs

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

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const errors = [];

async function open(ctx, label, { room = "", lobby = 90, noBots = true } = {}) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
  await page.evaluate(async ({ room, lobby, noBots }) => {
    const T = window.__trollOps;
    T.DROP.lobbySeconds = lobby;
    T.setMode("royale");
    if (T.els.noBots) T.els.noBots.checked = noBots;
    if (room) { T.els.room.value = room; T.els.room.dispatchEvent(new Event("input")); }
    await T.startGame();
  }, { room, lobby, noBots });
  await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 120000 });
  return page;
}

// ---- 1. everyone else's drop (solo, bots are drawn as remote players)
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const P = await open(ctx, "solo", { lobby: 8, noBots: false });
  await P.waitForFunction(() => window.__trollOps.royale()?.me === "belt", null, { timeout: 120000 });
  await sleep(1500);
  const seen = { beltShown: 0, beltHidden: 0, beltHigh: 0, fall: 0, fallFlat: 0, glide: 0, landedWing: 0 };
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const s = await P.evaluate(() => {
      const T = window.__trollOps;
      const o = { beltShown: 0, beltHidden: 0, beltHigh: 0, fall: 0, fallFlat: 0, glide: 0, landedWing: 0, airborne: 0 };
      for (const rp of T.remotes.byId.values()) {
        if (!rp.alive) continue;
        // On the belt a troll is just a troll standing up high: drawn, upright.
        if (!rp.drop && rp.pos.y > 300) { o.beltHigh++; rp.rig.root.visible ? o.beltShown++ : o.beltHidden++; }
        if (rp.drop === 2) { o.fall++; if (rp.rig.root.rotation.x < -1) o.fallFlat++; }
        if (rp.drop === 3) o.glide++;
        if (!rp.drop && rp.glider) o.landedWing++;
      }
      o.airborne = T.bots.bots.filter((b) => b.alive && b.airborne).length;
      return o;
    });
    for (const k of Object.keys(seen)) seen[k] = Math.max(seen[k], s[k]);
    if (s.airborne === 0 && seen.fall) break;
    await sleep(400);
  }
  check("trolls on the belt are drawn standing", seen.beltHigh > 50 && seen.beltShown > 0, JSON.stringify({ high: seen.beltHigh, shown: seen.beltShown, hidden: seen.beltHidden }));
  check("fallers skydive belly down", seen.fall > 0 && seen.fallFlat === seen.fall, JSON.stringify({ fall: seen.fall, flat: seen.fallFlat }));
  check("nobody opens a glider", seen.glide === 0 && seen.landedWing === 0, JSON.stringify({ glide: seen.glide, wings: seen.landedWing }));
  const after = await P.evaluate(() => {
    const T = window.__trollOps;
    let wings = 0, flat = 0;
    for (const rp of T.remotes.byId.values()) { if (rp.glider) wings++; if (rp.alive && Math.abs(rp.rig.root.rotation.x) > 1) flat++; }
    return { wings, flat };
  });
  check("once down, no gliders or skydive poses left", after.wings === 0 && after.flat === 0, JSON.stringify(after));
  await ctx.close();
}

// ---- 2 + 3. joining late
{
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const ROOM = "RDC" + Math.floor(Math.random() * 90 + 10);
  const A = await open(ctx, "A", { room: ROOM, lobby: 6 });
  await A.waitForFunction(() => window.__trollOps.royale()?.me === "belt", null, { timeout: 120000 });
  await sleep(500);
  const B = await open(ctx, "B", { room: ROOM });
  await sleep(2500);
  const s = await Promise.all([A, B].map((p) => p.evaluate(() => {
    const T = window.__trollOps, r = T.royale();
    return { me: r.me, phase: r.drop?.phase, beltT: r.drop?.beltT, y: +T.move.pos.y.toFixed(1), staging: T.isStaging(), host: T.net.isBotHost(), peers: T.net.peers.size };
  })));
  check("a late joiner skips the sky lobby and steps onto the belt", !s[1].staging && s[1].phase === "belt" && (s[1].me === "belt" || s[1].me === "fall"), JSON.stringify(s[1]));
  check("its belt clock is where everyone else's is", Math.abs(s[0].beltT - s[1].beltT) < 2.5, `${s[0].beltT?.toFixed(1)} vs ${s[1].beltT?.toFixed(1)}`);
  check("the first client keeps the bots", s[0].host && !s[1].host, JSON.stringify({ a: s[0].host, b: s[1].host }));

  // Once the floor has gone there's no way in.
  await A.waitForFunction(() => window.__trollOps.royale()?.drop?.phase === "done", null, { timeout: 120000 });
  const C = await open(ctx, "C", { room: ROOM });
  await sleep(2500);
  const c = await C.evaluate(() => {
    const T = window.__trollOps, r = T.royale();
    return { late: !!r.lateJoin, staging: T.isStaging(), live: r.live, spectating: T.royaleSpectating(), host: T.net.isBotHost() };
  });
  check("joining after the floor went: spectate, don't drop in", c.late && !c.staging && c.live && !c.host, JSON.stringify(c));
  await ctx.close();
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
