// Troll Forces: other players' bodies move like yours (remote-players.js).
// Two tabs in a private room (BroadcastChannel, Supabase blocked). A
// strafes, runs and jumps; on B, A's body:
//   - reads the strafe and the run off A's velocity (not the raw distance
//     between two packets), so the legs go the way A goes;
//   - tucks in the air and lands, read off A's height (not on the wire).
//
// Usage: node tools/troll-ops-remote-body-test.mjs   (needs Playwright)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.execPath, "../../lib/node_modules/playwright"))); }

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
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
await ctx.route(/supabase/, (r) => r.abort());
const ROOM = "RBD" + Math.floor(Math.random() * 90 + 10);
const errors = [];

async function open(label) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (room) => {
    const T = window.__trollOps;
    T.composer && (T.composer.render = () => {});
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  }, ROOM);
  return page;
}
const A = await open("A");
const B = await open("B");
await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 })));
for (const p of [A, B]) await p.evaluate(() => window.__trollOps.matchIntro?.skip?.());
await Promise.all([A, B].map((p) => p.waitForFunction(() => !(window.__trollOps.stageT?.() > 0), null, { timeout: 60000 })));
const aId = await A.evaluate(() => window.__trollOps.net.id);
await B.waitForFunction((id) => window.__trollOps.remotes.byId.has(id), aId, { timeout: 20000 });
await A.evaluate(() => { const T = window.__trollOps; T.player.spawnGuard = 999; T.look.pitch = 0; });
await sleep(800);

/* Hold `codes` on A for `ms`, sampling A's body as B sees it every frame. */
let jumped = false;
async function act(codes, ms, tail = 900, untilAir = false) {
  await A.evaluate((c) => { const T = window.__trollOps; for (const k of c) T.keys.add(k); }, codes);
  // A jump: hold it until A is off the ground (a slow two-tab frame can
  // miss a short press).
  if (untilAir) jumped = await A.evaluate(async () => {
    const T = window.__trollOps, t0 = performance.now();
    while (T.move.grounded && performance.now() - t0 < 1200) await new Promise((r) => requestAnimationFrame(r));
    return !T.move.grounded;
  });
  const rows = B.evaluate(async ({ id, ms }) => {
    const T = window.__trollOps, rp = T.remotes.byId.get(id), rig = rp.rig;
    const v = new rig.root.position.constructor();
    const out = [];
    const t0 = performance.now();
    await new Promise((done) => {
      const tick = () => {
        rig.root.updateMatrixWorld(true);
        const y0 = rig.root.position.y;
        out.push({
          t: performance.now() - t0, strafe: rp.bodyPose?.strafe ?? 0, forward: rp.bodyPose?.forward ?? 1, mps: rp.bodyPose?.mps ?? 0,
          air: !!rp.air, feet: Math.min(rig.parts.ankleL.getWorldPosition(v).y, rig.parts.ankleR.getWorldPosition(v).y) - y0,
          hips: rig.parts.hips.position.y,
        });
        performance.now() - t0 < ms ? requestAnimationFrame(tick) : done();
      };
      requestAnimationFrame(tick);
    });
    return out;
  }, { id: aId, ms: ms + tail });
  await sleep(ms);
  await A.evaluate((c) => { const T = window.__trollOps; for (const k of c) T.keys.delete(k); }, codes);
  return rows;
}
const mid = (rows) => rows.filter((r) => r.t > 500 && r.t < 1100);
const avg = (rows, k) => rows.reduce((a, r) => a + r[k], 0) / Math.max(1, rows.length);

// The jump first, where they spawned: the runs below can end against a
// wall (the map's spawn is random), where a jump doesn't leave the ground.
// Not straight away, though: the first moments after the countdown aren't
// a fair stand (the jump went unregistered there).
await sleep(3000);
const still = await act([], 600);
const stand = avg(still, "hips");
check("standing: not in the air", still.every((r) => !r.air));
const jump = await act(["Space"], 150, 2600, true);
check("(A jumped on its own screen)", jumped);
const up = jump.filter((r) => r.air);
check("their jump reads as in the air", up.length > 5, `${up.length} frames`);
check("in the air their knees tuck", Math.max(...up.map((r) => r.feet), -1) > 0.12, `feet up to ${(Math.max(...up.map((r) => r.feet), -1) * 100).toFixed(0)} cm`);
const last = jump.findLastIndex((r) => r.air);
const after = jump.slice(last + 1);
check("they land (back on the ground after)", last >= 0 && after.length > 10 && !after.at(-1).air);
check("their landing squashes", stand - Math.min(...after.map((r) => r.hips)) > 0.02, `hips down ${((stand - Math.min(...after.map((r) => r.hips))) * 100).toFixed(0)} cm`);
await sleep(600);

const right = mid(await act(["KeyD"], 1200));
check("strafing right reads as right", avg(right, "strafe") > 0.6 && Math.abs(avg(right, "forward")) < 0.4,
  `strafe ${avg(right, "strafe").toFixed(2)}, forward ${avg(right, "forward").toFixed(2)}`);
const ahead = mid(await act(["KeyW"], 1200));
check("running ahead reads as forward", avg(ahead, "forward") > 0.6 && Math.abs(avg(ahead, "strafe")) < 0.4,
  `forward ${avg(ahead, "forward").toFixed(2)}, strafe ${avg(ahead, "strafe").toFixed(2)}`);
const mpsSpread = Math.max(...ahead.map((r) => r.mps)) - Math.min(...ahead.map((r) => r.mps));
check("the stride doesn't flicker with packet timing", mpsSpread < 1.6, `speed ${Math.min(...ahead.map((r) => r.mps)).toFixed(1)}-${Math.max(...ahead.map((r) => r.mps)).toFixed(1)} m/s`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
