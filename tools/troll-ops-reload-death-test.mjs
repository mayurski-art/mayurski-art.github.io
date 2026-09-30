// Dying mid-reload must not leave the magazine hanging where the reload
// animation had it: the respawned gun (and any gun) seats its mag.
//
// Usage: node tools/troll-ops-reload-death-test.mjs

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

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 120000 });

const magState = () => page.evaluate(() => {
  const T = window.__trollOps;
  const mesh = T.activeWeaponMesh();
  const mag = mesh?.userData.magMesh;
  const rest = mesh?.userData.magazinePoint;
  if (!mag || !rest) return null;
  return { off: +mag.position.distanceTo(rest).toFixed(4), vis: mag.visible, meshVis: mesh.visible,
    alive: T.player.alive, reloading: T.currentWeapon().reloading, holding: T.player.holding };
});

for (const slot of ["primary", "secondary"]) {
  await page.evaluate((slot) => {
    const T = window.__trollOps;
    if (!T.player.alive) T.respawnPlayer();
    T.breakSpawnGuard();
    T.switchWeapon(slot);
    const w = T.currentWeapon();
    w.ammoInMag = 1;
    w.ammoReserve = 200;
    T.tryReload();
  }, slot);
  await sleep(700);
  const mid = await magState();
  check(`${slot}: mag leaves the well mid-reload`, mid && mid.off > 0.02, JSON.stringify(mid));
  await page.evaluate(() => {
    const T = window.__trollOps;
    T.player.spawnGuard = 0;
    T.damagePlayer(9999, "bot-x", "problem416");
  });
  await sleep(1500);
  await page.evaluate(() => { const T = window.__trollOps; if (!T.player.alive) T.respawnPlayer(); });
  await sleep(600);
  const after = await magState();
  check(`${slot}: respawned gun has its mag seated`, after && after.off < 0.005, JSON.stringify(after));
  // And the old slot's gun, drawn after respawn.
  await page.evaluate((slot) => window.__trollOps.switchWeapon(slot), slot);
  await sleep(400);
  const drawn = await magState();
  check(`${slot}: drawn again, mag still seated`, drawn && drawn.off < 0.005, JSON.stringify(drawn));
}

check("no page errors", !errors.length, errors.join(" | "));
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
