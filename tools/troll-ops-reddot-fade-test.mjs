// Troll Forces: a red dot dims while you walk aimed in and comes back when
// you stop (user, 2026-10-31: "make the red dot transparent a little bit
// while users are moving while aiming, sort of to punish players for
// hardscoping"), every optic with a reticle in its glass, the ACOG too (user,
// 2026-11-01: "reflex sights acogs etc"). Private TDM room, no bots.
//
// Per gun:optic it aims in, reads the reticle's opacity standing, after
// 1.2 s walking, and 0.8 s after stopping.
//
// Usage: node tools/troll-ops-reddot-fade-test.mjs [gun:optic ...]
//   (default: problem416:reflex kek:coyote kek:acog)

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = process.env.OUT ? path.resolve(process.env.OUT) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const combos = (process.argv.slice(2).length ? process.argv.slice(2)
  : ["problem416:reflex", "kek:coyote", "kek:acog", "deadpan:acog"]).map((s) => s.split(":"));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];
for (const [gun, optic] of combos) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route(/supabase/, (r) => r.abort());
  page.on("pageerror", (e) => errors.push(`${gun}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async ([gun, optic, room]) => {
    const T = window.__trollOps;
    T.loadout.weaponId = gun;
    T.loadout.attachmentsFor(gun).optic = optic;
    T.loadout.mapId = "trollcity";
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  }, [gun, optic, "RDF" + Math.random().toString(36).slice(2, 7).toUpperCase()]);
  await page.waitForFunction(() => { const s = window.__trollOps.loadState(); return window.__trollOps.state() === "playing" && !s.open && !s.hold; }, null, { timeout: 180000 });
  await page.evaluate(() => {
    const T = window.__trollOps;
    if (T.isStaging()) T.endStaging();
    T.player.hp = T.player.maxHp = 1e9;
    T.breakSpawnGuard?.();
    T.switchWeapon("primary");
    T.look.pitch = 0.02;
    T.setAds(true);
  });
  // The first page of a run can take a while to build the gun: wait for the
  // reticle itself rather than a fixed time.
  await page.waitForFunction(() => {
    let shown = false;
    window.__trollOps.activeWeaponMesh()?.traverse((o) => { if (o.userData.reticle && o.visible) shown = true; });
    return shown;
  }, null, { timeout: 15000 }).catch(() => {});
  await sleep(600);
  const opacity = () => page.evaluate(() => {
    const T = window.__trollOps;
    let op = null, shown = false;
    T.activeWeaponMesh().traverse((o) => {
      if (!o.userData.reticle || !o.visible) return;
      shown = true;
      o.traverse((c) => { if (c.material && op == null) op = c.material.opacity; });
    });
    return { op, shown, moving: T.move.moving, sight: T.currentWeapon().def.sight };
  });
  const still = await opacity();
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${gun}-${optic}-still.png`) });
  await page.keyboard.down("KeyD");
  await sleep(1200);
  const walking = await opacity();
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${gun}-${optic}-walking.png`) });
  await page.keyboard.up("KeyD");
  await sleep(800);
  const stopped = await opacity();
  console.log(`${gun}:${optic} (${still.sight})  still ${still.op?.toFixed(2)}  walking ${walking.op?.toFixed(2)} (moving ${walking.moving})  stopped ${stopped.op?.toFixed(2)}`);
  check(`${gun}:${optic} reticle shown aimed in`, still.shown && still.op != null);
  check(`${gun}:${optic} it walked`, walking.moving);
  check(`${gun}:${optic} full reticle standing`, still.op > 0.97, still.op?.toFixed(2));
  // A headless page runs slow frames, so the fade may not have quite settled
  // (0.35 walking, 1 stopped): a little slack either way.
  check(`${gun}:${optic} dimmed walking (0.3-0.55)`, walking.op >= 0.3 && walking.op <= 0.55, walking.op?.toFixed(2));
  check(`${gun}:${optic} back after stopping`, stopped.op > 0.9, stopped.op?.toFixed(2));
  await page.close();
}
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "ALL PASS");
process.exit(failures ? 1 : 0);
