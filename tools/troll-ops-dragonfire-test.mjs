// Dragonfire flight (user, 2026-10-01: "can't ascend or descend", "fix the
// camera angle", "some auto aim assist"): Space climbs and C dives, flying
// forward follows the camera's pitch, the drone's own airframe is out of its
// own camera, the feed shows the controls, and aim assist pulls the reticle
// onto an enemy just off centre.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-dragonfire-test.mjs

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
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  T.els.noBots.checked = false;
  T.loadout.mapId = "dustbowl";
  await T.startGame();
  if (T.isStaging()) T.endStaging();
  T.player.maxHp = T.player.hp = 1e6;
  T.settings.aimAssist = true;
});
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 });
await sleep(3000);
await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("dragonfire"); T.fireStreak("dragonfire"); });
const on = await page.waitForFunction(() => window.__trollOps.dragonfireView(), null, { timeout: 20000 }).then(() => true).catch(() => false);
check("flying the Dragonfire", on);
await sleep(1200);
const y = () => page.evaluate(() => window.__trollOps.dragonfire().pos.y);

const y0 = await y();
await page.keyboard.down("Space"); await sleep(1500); await page.keyboard.up("Space");
const y1 = await y();
check("Space climbs", y1 > y0 + 4, `${y0.toFixed(1)} -> ${y1.toFixed(1)}`);
await page.keyboard.down("KeyC"); await sleep(800); await page.keyboard.up("KeyC");
const y2 = await y();
check("C dives", y2 < y1 - 2.5, `${y1.toFixed(1)} -> ${y2.toFixed(1)}`);

// Look down and fly forward: it goes down too.
await page.evaluate(() => { window.__trollOps.look.pitch = -0.7; });
const y3 = await y();
await page.keyboard.down("KeyW"); await sleep(900); await page.keyboard.up("KeyW");
const y4 = await y();
check("looking down and flying forward dives", y4 < y3 - 1.5, `${y3.toFixed(1)} -> ${y4.toFixed(1)}`);
await page.evaluate(() => { window.__trollOps.look.pitch = -0.1; });

const view = await page.evaluate(() => ({ hidden: !window.__trollOps.dragonfire().root.visible, hint: document.querySelector(".to-df-keys")?.textContent || "" }));
check("its own airframe is out of its camera", view.hidden);
check("the feed shows how to climb and dive", /climb/.test(view.hint) && /dive/.test(view.hint), view.hint);

// Up high first, for a clear line down past the houses.
await page.keyboard.down("Space"); await sleep(1800); await page.keyboard.up("Space");
// Aim assist: an enemy held 5 degrees off the reticle, 25 m out; the
// reticle comes onto them without any input.
await page.mouse.move(640, 360);
const aaP = page.evaluate(async () => {
  const T = window.__trollOps;
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const cam = T.camera.position;
  const angTo = (b) => {
    const dx = b.pos.x - cam.x, dy = b.pos.y + 1.3 - cam.y, dz = b.pos.z - cam.z;
    return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), dist: Math.hypot(dx, dy, dz) };
  };
  // Bots stay where they are: find an enemy the drone can see (in range,
  // nothing between), aim 5 degrees to one side of them, let go.
  let foe = null;
  for (let tries = 0; tries < 40 && !foe; tries++) {
    for (const b of T.bots.bots) {
      if (!b.alive || b.airborne || b.team === T.net.team) continue;
      const a = angTo(b);
      if (a.dist > 80) continue;
      T.look.yaw = a.yaw; T.look.pitch = a.pitch;
      await frame(); await frame();
      if (T.findAimAssistTarget(2, 90)) { foe = b; break; }
    }
    if (!foe) await new Promise((r) => setTimeout(r, 250));
  }
  if (!foe) return { err: "no enemy in sight" };
  const a0 = angTo(foe);
  T.look.yaw = a0.yaw + 0.087; T.look.pitch = a0.pitch;
  // The closest the reticle gets to them in 2 s (they keep moving).
  let best = 0.087;
  const t0 = performance.now();
  while (performance.now() - t0 < 2000) {
    await frame();
    let off = T.look.yaw - angTo(foe).yaw;
    best = Math.min(best, Math.abs(Math.atan2(Math.sin(off), Math.cos(off))));
  }
  return { start: 0.087, closest: +best.toFixed(3), dist: +angTo(foe).dist.toFixed(1) };
});
// Hold the trigger while it measures: the pull works while you shoot or aim.
await sleep(300); await page.mouse.down();
const aa = await aaP;
await page.mouse.up();
check("aim assist pulls the reticle onto an enemy just off it", !aa.err && aa.closest < 0.02, JSON.stringify(aa));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
