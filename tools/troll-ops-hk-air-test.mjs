// Hunter-killer drones vs enemy aircraft: an enemy UAV and an enemy
// Counter-UAV each get picked as the drone's target, chased down (they
// circle faster than a drone hunts, so it leads them) and shot down; our own
// side's UAV is left alone.
//
// Usage: node tools/troll-ops-hk-air-test.mjs   (needs Playwright)

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

const browser = await chromium.launch({ args: ["--use-gl=angle", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const page = await browser.newPage({ viewport: { width: 480, height: 300 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/supabase/, (r) => r.abort());
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.composer && (T.composer.render = () => {});
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => ["playing", "paused"].includes(window.__trollOps.state()), null, { timeout: 90000 });
await page.waitForTimeout(3000);
await page.evaluate(() => { const T = window.__trollOps; T.closePauseMenu(); if (T.isStaging()) T.endStaging(); T.player.spawnGuard = 999; });

/* Spawn a plane for `team`, let it reach its orbit, launch our drone at
   whatever it picks, and wait (on the game's own clock) for the outcome. */
async function run(label, { counter, enemy }) {
  return page.evaluate(async ({ counter, enemy }) => {
    const T = window.__trollOps;
    const mine = T.net.team || "phantom";
    const team = enemy ? (mine === "phantom" ? "ghost" : "phantom") : mine;
    const yaw = Math.random() * 6;
    const plane = T.spawnRecon(Math.random() * 10, 0, yaw, 40, { counter, team, caller: enemy ? "enemy-x" : T.net.id });
    plane.age = 6;   // already on its orbit
    const pick = T.pickDroneTarget(T.move.pos);
    const id = `hk-test-${Math.random().toString(36).slice(2, 7)}`;
    const from = T.move.pos.clone(); from.y += 1.6;
    T.spawnDrone({ id, targetId: pick?.netId || null, owned: true, pos: from, yaw: T.look.yaw });
    const t0 = performance.now();
    let down = false, minD = Infinity;
    while (performance.now() - t0 < 60000) {
      await new Promise((r) => setTimeout(r, 100));
      const d = T.streakEntities.get(id);
      if (d) minD = Math.min(minD, d.root.position.distanceTo(plane.root.position));
      if (!T.flyovers.includes(plane)) { down = true; break; }
      if (!d) break;   // the drone ended without it
    }
    const left = T.flyovers.includes(plane);
    if (left) { plane.dispose(); T.flyovers.splice(T.flyovers.indexOf(plane), 1); }
    T.streakEntities.get(id)?.dispose?.();
    T.streakEntities.delete(id);
    return { picked: pick?.netId || null, eid: plane.eid, down, minD: +minD.toFixed(1), jammed: T.jammedUntil() > performance.now() };
  }, { counter, enemy });
}

const uav = await run("uav", { counter: false, enemy: true });
check("an enemy UAV is the hunter-killer's target", uav.picked === uav.eid, JSON.stringify(uav));
check("the hunter-killer shoots the enemy UAV down", uav.down, JSON.stringify(uav));

const cuav = await run("cuav", { counter: true, enemy: true });
check("an enemy Counter-UAV is the hunter-killer's target", cuav.picked === cuav.eid, JSON.stringify(cuav));
check("the hunter-killer shoots the enemy Counter-UAV down", cuav.down, JSON.stringify(cuav));

const own = await run("own", { counter: false, enemy: false });
check("our own side's UAV is left alone", own.picked !== own.eid && !own.down, JSON.stringify(own));

check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
