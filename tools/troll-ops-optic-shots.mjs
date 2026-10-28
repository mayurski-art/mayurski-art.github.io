// Troll Forces: hip and aimed-in screenshots of a gun with a given optic, for
// judging how a sight looks through the eye. Private TDM room, no bots.
//
// Usage: node tools/troll-ops-optic-shots.mjs [gun:optic ...]   (default: trollboy:acog)
//   OUT=<dir> (default .claude/optic-shots)
//   TROLL=1: the trollface reticle on (a level-12 account stubbed), plus an
//   -ads-hit shot with a target box lined up 3 m ahead

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.env.OUT || path.join(ROOT, ".claude/optic-shots"));
fs.mkdirSync(OUT, { recursive: true });
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const combos = (process.argv.slice(2).length ? process.argv.slice(2) : ["trollboy:acog"]).map((s) => s.split(":"));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
for (const [gun, optic] of combos) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route(/supabase/, (r) => r.abort());
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  if (process.env.TROLL) await page.evaluate(() => {
    localStorage.setItem("trollops:reticle", "troll");
    const A = window.TrollrunnerAccounts || (window.TrollrunnerAccounts = {});
    A.getCachedProfile = () => ({ username: "reticle-test", level: 12, xp: 9000 });
  });
  await page.evaluate(async ([gun, optic]) => {
    const T = window.__trollOps;
    T.loadout.weaponId = gun;
    T.loadout.attachmentsFor(gun).optic = optic;
    T.loadout.mapId = "trollcity";
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = `OS${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  }, [gun, optic]);
  await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 60000 });
  await sleep(4500);
  const info = await page.evaluate(() => {
    const T = window.__trollOps;
    if (T.isStaging()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
    T.look.pitch = 0.02;
    T.switchWeapon("primary");
    const d = T.currentWeapon().def;
    d.swayAmp = 0; d.bobAmp = 0;
    return { id: d.id, optic: d.attachments?.optic };
  });
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT, `${gun}-${optic}-hip.png`) });
  await page.evaluate(() => window.__trollOps.setAds(true));
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, `${gun}-${optic}-ads.png`) });
  if (process.env.TROLL) {
    await page.evaluate(() => {
      const T = window.__trollOps, THREE = T.THREE, cam = T.camera;
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
      const o = cam.getWorldPosition(new THREE.Vector3()), d = cam.getWorldDirection(new THREE.Vector3());
      box.position.copy(o).addScaledVector(d, 3);
      box.updateMatrixWorld(true);
      T.remotes.hitMeshes = () => [box];
    });
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, `${gun}-${optic}-ads-hit.png`) });
  }
  await page.evaluate(() => window.__trollOps.setAds(false));
  console.log(`${gun}:${optic}`, JSON.stringify(info));
  await page.close();
}
await browser.close();
server.close();
console.log("shots in", OUT);
