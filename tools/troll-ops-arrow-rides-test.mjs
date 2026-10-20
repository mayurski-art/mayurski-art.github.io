// Troll Forces arrow keys on everything you steer (WASD's twin, -arw1),
// pressed as real key events, no WASD anywhere:
//   1. double-tap Left / Right while running swivels left / right
//   2. the Dragonfire drone flies forward on Up and sideways on Left
//   3. a Troll City horse: Down backs it, Right turns it, Shift+Up gallops
//   4. the Royale freefall: Up flies you forward off the ramp
//   5. no page errors
//
// Supabase is blocked: this never joins the live public room.
// Usage: node tools/troll-ops-arrow-rides-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv.slice(2);   // e.g. "horse royale": run just those parts
const want = (k) => !only.length || only.includes(k);

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
async function open(label, init) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  if (init) await page.addInitScript(init);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 420000 });
  return page;
}
const pos = (page) => page.evaluate(() => { const p = window.__trollOps.move.pos; return { x: p.x, y: p.y, z: p.z }; });
const flat = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
/* How far `to` is from `from` along the look direction (fwd) and to its right (side). */
const along = (from, to, yaw) => {
  const dx = to.x - from.x, dz = to.z - from.z;
  return { fwd: -(dx * Math.sin(yaw) + dz * Math.cos(yaw)), side: dx * Math.cos(yaw) - dz * Math.sin(yaw) };
};

// ── 1 + 2. A TDM on Dustbowl: swivel, then the Dragonfire ───────────────
if (want("swivel") || want("dragonfire")) {
  const page = await open("tdm");
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.els.room.value = "";
    T.setMode("tdm");
    T.els.noBots.checked = false;
    T.loadout.mapId = "dustbowl";
    await T.startGame();
    if (T.isStaging()) T.endStaging();
  });
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open && !window.__trollOps.isStaging(), null, { timeout: 180000 });
  await sleep(2500);
  const god = () => page.evaluate(() => { const T = window.__trollOps; T.player.maxHp = T.player.hp = 1e6; T.player.spawnGuard = 0; if (!document.getElementById("to-pause").hidden) T.closePauseMenu(); });

  if (want("swivel")) {
    // Run forward on Up, then double-tap a side arrow: one swivel that way.
    const trySide = async (key) => {
      await god();
      await page.evaluate(() => { const T = window.__trollOps; T.swivel.cd = 0; });
      const before = await page.evaluate(() => window.__trollOps.swivel.seq);
      await page.keyboard.down("ArrowUp");
      await sleep(900);
      await page.keyboard.press(key, { delay: 40 });
      await sleep(70);
      await page.keyboard.press(key, { delay: 40 });
      await sleep(120);
      const s = await page.evaluate(() => { const S = window.__trollOps.swivel; return { seq: S.seq, dir: S.dir, last: S.lastDir }; });
      await page.keyboard.up("ArrowUp");
      await sleep(1600);   // let it finish and cool down
      return { fired: s.seq !== before, last: s.last };
    };
    const l = await trySide("ArrowLeft");
    check("double-tap Left while running swivels left", l.fired && l.last === -1, JSON.stringify(l));
    const r = await trySide("ArrowRight");
    check("double-tap Right while running swivels right", r.fired && r.last === 1, JSON.stringify(r));
    // A single tap is still just a strafe.
    await god();
    const one = await page.evaluate(() => window.__trollOps.swivel.seq);
    await page.keyboard.down("ArrowUp"); await sleep(900);
    await page.keyboard.press("ArrowLeft", { delay: 40 });
    await sleep(500);
    await page.keyboard.up("ArrowUp");
    check("a single Left tap doesn't swivel", (await page.evaluate(() => window.__trollOps.swivel.seq)) === one);
    await sleep(800);
  }

  if (want("dragonfire")) {
    await god();
    await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("dragonfire"); T.fireStreak("dragonfire"); });
    const on = await page.waitForFunction(() => window.__trollOps.dragonfireView(), null, { timeout: 20000 }).then(() => true).catch(() => false);
    check("flying the Dragonfire", on);
    await sleep(1200);
    const df = () => page.evaluate(() => { const p = window.__trollOps.dragonfire().pos; return { x: p.x, y: p.y, z: p.z }; });
    // Up high and level, clear of the houses.
    await page.keyboard.down("Space"); await sleep(1800); await page.keyboard.up("Space");
    await page.evaluate(() => { window.__trollOps.look.pitch = 0; });
    const yaw = await page.evaluate(() => window.__trollOps.look.yaw);
    let a = await df();
    await page.keyboard.down("ArrowUp"); await sleep(900); await page.keyboard.up("ArrowUp");
    await sleep(300);
    let b = await df();
    const up = along(a, b, yaw);
    check("Up flies the Dragonfire forward", up.fwd > 3 && Math.abs(up.side) < up.fwd * 0.5, `fwd ${up.fwd.toFixed(1)} m, side ${up.side.toFixed(1)} m`);
    a = await df();
    await page.keyboard.down("ArrowLeft"); await sleep(900); await page.keyboard.up("ArrowLeft");
    await sleep(300);
    b = await df();
    const left = along(a, b, yaw);
    check("Left flies it left", left.side < -3 && Math.abs(left.fwd) < -left.side * 0.5, `fwd ${left.fwd.toFixed(1)} m, side ${left.side.toFixed(1)} m`);
  }
  await page.close();
}

// ── 3. A horse in Troll City ─────────────────────────────────────────────
if (want("horse")) {
  const page = await open("horse", () => {
    window.__trollHorseTune = { home: 2 };
    const fake = { getCachedProfile: () => ({ username: "arrow_rider", tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  });
  await page.waitForFunction(() => !!window.__trollHorses, null, { timeout: 420000 });
  await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.els.room.value = "";
    T.setMode("social");
    T.loadout.mapId = "trollcity";
    await T.startGame();
  });
  await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
  await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; });
  await sleep(3000);
  const H = () => page.evaluate(() => window.__trollHorses.state());
  const h0 = (await H()).list[0];
  await page.evaluate(({ x, z }) => { const T = window.__trollOps; T.move.reset(x, z, 0); T.look.yaw = 0; }, { x: h0.x + 0.2, z: h0.z + 1.6 });
  await sleep(500);
  await page.keyboard.down("x"); await sleep(800); await page.keyboard.up("x");
  await sleep(300);
  let h = await H();
  check("on the black horse", h.mine === 0, JSON.stringify({ mine: h.mine }));
  // Down backs it off the rail (as S does).
  let a = h.list[0];
  await page.keyboard.down("ArrowDown"); await sleep(900); await page.keyboard.up("ArrowDown");
  await sleep(300);
  h = await H();
  const back = along(a, h.list[0], a.yaw);
  check("Down backs the horse up", back.fwd < -0.3, `${back.fwd.toFixed(2)} m`);
  // Right turns it right (as D does): yaw falls.
  const y0 = h.list[0].yaw;
  await page.keyboard.down("ArrowRight");
  for (let i = 0; i < 20 && (await H()).list[0].yaw > -1.5; i++) await sleep(150);
  await page.keyboard.up("ArrowRight");
  await sleep(200);
  h = await H();
  check("Right turns it right", h.list[0].yaw < y0 - 1, `${y0.toFixed(2)} -> ${h.list[0].yaw.toFixed(2)}`);
  // Shift + Up: a gallop down the street.
  a = h.list[0];
  await page.keyboard.down("ShiftLeft"); await page.keyboard.down("ArrowUp");
  await sleep(2500);
  const gait = (await H()).list[0].gait;
  await sleep(1500);
  await page.keyboard.up("ArrowUp"); await page.keyboard.up("ShiftLeft");
  await sleep(1000);
  h = await H();
  check("Shift + Up gallops it down the street (> 20 m)", flat(a, h.list[0]) > 20 && gait === 3, `${flat(a, h.list[0]).toFixed(1)} m, gait ${gait}`);
  await page.close();
}

// ── 4. The Royale freefall ───────────────────────────────────────────────
if (want("royale")) {
  const page = await open("royale");
  await page.evaluate(async () => { const T = window.__trollOps; T.els.room.value = ""; T.DROP.lobbySeconds = 14; T.setMode("royale"); T.els.noBots.checked = false; await T.startGame(); });
  await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 180000 });
  await page.waitForFunction(() => window.__trollOps.royale().drop?.phase === "run", null, { timeout: 180000 });
  await page.waitForFunction(() => !window.__trollOps.planes().hold.lip, null, { timeout: 30000 }).catch(() => {});
  await page.keyboard.press("Space", { delay: 150 });
  const fell = await page.waitForFunction(() => window.__trollOps.royale().me === "fall", null, { timeout: 10000 }).then(() => true).catch(() => false);
  check("off the ramp, falling", fell, await page.evaluate(() => window.__trollOps.royale().me));
  // The fall's opening show is hands off for every key (Flight's `coast`):
  // wait for its "Push forward to fly" banner. Then face the island's
  // middle, camera level; no stick for 1 s, then Up for 1 s.
  await page.waitForFunction(() => /push forward to fly/i.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
  await sleep(300);
  const yaw = await page.evaluate(() => {
    const T = window.__trollOps;
    T.look.yaw = Math.atan2(T.move.pos.x, T.move.pos.z);   // toward (0, 0)
    T.look.pitch = 0;
    return T.look.yaw;
  });
  let a = await pos(page);
  await sleep(1000);
  let b = await pos(page);
  const coast = along(a, b, yaw);
  a = b;
  await page.keyboard.down("ArrowUp"); await sleep(1000);
  b = await pos(page);
  await page.keyboard.up("ArrowUp");
  const push = along(a, b, yaw);
  check("Up flies you forward in the fall", push.fwd > coast.fwd + 5, `hands off ${coast.fwd.toFixed(1)} m/s, Up ${push.fwd.toFixed(1)} m/s`);
  await page.close();
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
