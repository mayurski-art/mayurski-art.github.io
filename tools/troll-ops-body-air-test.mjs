// Troll Forces: the body jumps, falls and lands (character.js air / land).
// Your own third-person body in a real match: jump, and the knees tuck in
// the air and the hips sink as you land; standing still they don't.
//
// One tab joins a private room over BroadcastChannel (Supabase blocked).
//
// Usage: node tools/troll-ops-body-air-test.mjs   (needs Playwright)

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
const ROOM = "AIR" + Math.floor(Math.random() * 90 + 10);
const errors = [];

const A = await ctx.newPage();
A.on("pageerror", (e) => errors.push(e.message));
await A.goto(`${BASE}/troll-ops.html?tohooks=1`);
await A.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await A.evaluate(async (room) => {
  const T = window.__trollOps;
  T.composer && (T.composer.render = () => {});
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.els.room.value = room;
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
}, ROOM);
await A.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 });
// Past the match intro and the pre-match countdown (movement is frozen till then).
await A.evaluate(() => window.__trollOps.matchIntro?.skip?.());
await A.waitForFunction(() => !(window.__trollOps.stageT?.() > 0), null, { timeout: 60000 });
await sleep(1500);

// Sample the body every frame from inside the page: feet above the root
// (the ground under the body) and the hips' height over the root.
async function sample(ms, jump) {
  return A.evaluate(async ({ ms, jump }) => {
    const T = window.__trollOps, rig = T.localRig;
    T.player.spawnGuard = 999;
    const v = new rig.root.position.constructor();
    const rows = [];
    if (jump) T.keys.add("Space");
    const t0 = performance.now();
    await new Promise((done) => {
      const tick = () => {
        const t = performance.now() - t0;
        if (jump && t > 120) T.keys.delete("Space");
        rig.root.updateMatrixWorld(true);
        const y0 = rig.root.position.y;
        const fl = rig.parts.ankleL.getWorldPosition(v).y - y0, fr = rig.parts.ankleR.getWorldPosition(v).y - y0;
        rows.push({ t, air: !T.move.grounded, feet: Math.min(fl, fr), hips: rig.parts.hips.position.y });
        t < ms ? requestAnimationFrame(tick) : done();
      };
      requestAnimationFrame(tick);
    });
    return rows;
  }, { ms, jump });
}

const still = await sample(1500, false);
const stand = still.reduce((a, r) => a + r.hips, 0) / still.length;
check("standing: no tuck", Math.max(...still.map((r) => r.feet)) < 0.06, `feet up to ${(Math.max(...still.map((r) => r.feet)) * 100).toFixed(1)} cm`);

const rows = await sample(2200, true);
const air = rows.filter((r) => r.air);
check("the jump left the ground", air.length > 3, `${air.length} frames up`);
const tuck = Math.max(...air.map((r) => r.feet));
check("in the air the knees tuck", tuck > 0.15, `feet up to ${(tuck * 100).toFixed(0)} cm under the hips' line`);
const lastAir = rows.findLastIndex((r) => r.air);
const after = rows.slice(lastAir + 1, lastAir + 1 + 40);
const squash = stand - Math.min(...after.map((r) => r.hips));
check("landing: the knees take it", squash > 0.04, `hips down ${(squash * 100).toFixed(0)} cm`);
const end = rows.at(-1);
check("then stands back up", Math.abs(end.hips - stand) < 0.02 && end.feet < 0.06, `hips ${(end.hips - stand).toFixed(3)} m off, feet ${(end.feet * 100).toFixed(1)} cm`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
