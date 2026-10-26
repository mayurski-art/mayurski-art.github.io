// ACOG recoil check (user: "the recoil on the weapons with the acog scope is
// too much"). Fires the same seeded ADS burst from one gun on iron sights and
// on the ACOG and compares the aim climb: the permanent pitch climb you pull
// back down, the camera's kick and shake, the yaw wander and the gun's own
// kick in your hands. Each is summed over the shots as fired (so frame rate
// can't change it) and reported in radians and as the share of the
// half-screen it moves through that sight's FOV (the viewmodel's lens for
// the gun kick), which is what the eye sees. The ACOG's on-screen climb
// should sit near the iron sights', and the iron sights must not change.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-acog-recoil-test.mjs [gunId ...]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GUNS = process.argv.slice(2).length ? process.argv.slice(2) : ["kek", "cackle", "sneer"];
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

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
const room = "ACR" + Math.random().toString(36).slice(2, 7).toUpperCase();
await page.evaluate(async ([id, room]) => {
  const T = window.__trollOps;
  T.loadout.weaponId = id;
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.els.room.value = room;
  await T.startGame();
}, [GUNS[0], room]);
await page.waitForFunction(() => { const s = window.__trollOps.loadState(); return window.__trollOps.state() === "playing" && !s.open && !s.hold; }, null, { timeout: 180000 });
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });

async function burst(id, optic) {
  return page.evaluate(async ([id, optic]) => {
    const T = window.__trollOps, w = T.currentWeapon();
    T.player.hp = T.player.maxHp = 1e6;
    T.breakSpawnGuard?.();
    T.loadout.weaponId = id;
    Object.assign(T.loadout.attachmentsFor(id), { optic, barrel: "none", underbarrel: "none", ammo: "standard" });
    w.def = T.loadout.resolved;
    T.setActiveWeaponMesh(w.def);   // the optic's model and its viewmodel lens
    w.ammoInMag = w.def.magSize;
    w.reloading = false;
    T.setAds(true);
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    let t0 = performance.now();
    while (performance.now() - t0 < 1500) { w.adsT = 1; await frame(); }   // settle the zoom
    // One seeded burst, so both sights roll the same yaw and shake.
    const realRandom = Math.random;
    let s = 12345;
    Math.random = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    const fs = T.fireShake;
    Object.assign(fs, { p: 0, y: 0, r: 0, vp: 0, vy: 0, vr: 0, buzz: 0 });
    w.recoilPitch = w.recoilYaw = w.viewKickPitch = w.viewKickYaw = 0;
    T.look.pitch = 0; T.look.yaw = 0;
    const shots = Math.min(15, w.def.magSize);
    const sum = { climb: 0, kickP: 0, kickY: 0, shakeP: 0, shakeY: 0, gunP: 0 };
    let fired = 0;
    t0 = performance.now();
    while (fired < shots && performance.now() - t0 < 20000) {
      w.adsT = 1;
      if (w.canFire()) {
        s = 12345 + fired * 7919;   // each shot draws the same numbers on both sights
        const b = { pitch: T.look.pitch, rp: w.recoilPitch, ry: w.recoilYaw, vp: fs.vp, vy: fs.vy, vk: w.viewKickPitch, ammo: w.ammoInMag };
        T.fireOnce();
        if (w.ammoInMag < b.ammo) {
          fired++;
          sum.climb += T.look.pitch - b.pitch;
          sum.kickP += w.recoilPitch - b.rp;
          sum.kickY += Math.abs(w.recoilYaw - b.ry);
          sum.shakeP += Math.abs(fs.vp - b.vp);
          sum.shakeY += Math.abs(fs.vy - b.vy);
          sum.gunP += w.viewKickPitch - b.vk;
        }
      }
      await frame();
    }
    Math.random = realRandom;
    T.setAds(false);
    const half = Math.tan((T.camera.fov * Math.PI / 180) / 2);
    // The viewmodel lens at full ADS (game.js: the optic's adsWeaponFov, else 50).
    const vmFov = T.activeWeaponMesh()?.userData.adsWeaponFov || 50;
    const vmHalf = Math.tan((vmFov * Math.PI / 180) / 2);
    const scr = {};
    for (const [k, v] of Object.entries(sum)) scr[k] = v / (k === "gunP" ? vmHalf : half);
    return { optic, fired, fov: T.camera.fov, vmFov, sum, scr };
  }, [id, optic]);
}

const f = (x) => x.toFixed(4);
const KEYS = { climb: "climb", kickP: "cam kick", kickY: "cam yaw", shakeP: "shake p", shakeY: "shake y", gunP: "gun kick" };
const results = {};
for (const id of GUNS) {
  for (const optic of ["iron", "acog", "iron"]) {
    const r = await burst(id, optic);
    (results[id] ??= []).push(r);
    console.log(`${id.padEnd(6)} ${optic.padEnd(5)} ${r.fired} shots  fov ${r.fov.toFixed(1)} vm ${r.vmFov.toFixed(0)} | `
      + Object.entries(KEYS).map(([k, n]) => `${n} ${f(r.sum[k])} (${f(r.scr[k])})`).join("  "));
  }
  const [iron, acog, iron2] = results[id];
  check(`${id}: both sights fired the same burst`, iron.fired === acog.fired && iron.fired > 5, `${iron.fired}/${acog.fired}`);
  check(`${id}: the ACOG is on and zoomed`, acog.fov < iron.fov * 0.6, `${acog.fov.toFixed(1)} vs ${iron.fov.toFixed(1)}`);
  check(`${id}: iron-sight bursts repeat (seeded)`, Math.abs(iron.sum.climb - iron2.sum.climb) < 1e-6 && Math.abs(iron.sum.kickY - iron2.sum.kickY) < 1e-6,
    `${f(iron.sum.climb)} vs ${f(iron2.sum.climb)}`);
  console.log(`${id}: ACOG / iron on screen: ` + Object.entries(KEYS).map(([k, n]) => `${n} ${(acog.scr[k] / iron.scr[k]).toFixed(2)}x`).join("  "));
  for (const [k, n] of Object.entries(KEYS)) {
    const ratio = acog.scr[k] / iron.scr[k];
    check(`${id}: ACOG ${n} on screen is in line with iron sights`, ratio > 0.75 && ratio < 1.25, ratio.toFixed(2));
  }
}

check("no page errors", !errors.length, errors.join(" | "));
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
