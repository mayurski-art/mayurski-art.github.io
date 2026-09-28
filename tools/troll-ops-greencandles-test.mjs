// Troll Forces Green Candles check: the Blender model loads (tank = mag,
// hand anchors, glow materials), a tap fires a 1-cell bolt, a held charge
// builds to a full 3-cell bolt, a partial charge costs in between, a low
// tank caps the charge, a reload drops a charge without firing, the gauge
// and candle follow the tank through a reload, and the hose pulses on a
// shot. Screenshots go to OUT.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-greencandles-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || "";
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
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name) }); };

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.weaponId = "greencandle";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 });
await page.waitForFunction(() => !!window.__trollOps.activeWeaponMesh()?.userData.gc, null, { timeout: 30000 });
await page.waitForFunction(() => !window.__trollOps.isStaging(), null, { timeout: 30000 });   // past the pre-match countdown
// Wait for the frame rate to settle (shaders for the new model compile on
// first sight); the charge runs on game time, so a crawling start would
// read as a charge that never fills.
for (let i = 0; i < 20; i++) {
  const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 500) requestAnimationFrame(f); else r(n * 2); }; requestAnimationFrame(f); }));
  if (fps >= 25) break;
}

const info = await page.evaluate(() => {
  const m = window.__trollOps.activeWeaponMesh(), u = m.userData;
  return { id: window.__trollOps.currentWeapon().def.id, tank: u.magMesh?.name, anchors: u.pfAnchors?.length,
    glow: Object.keys(u.gc.glow).sort().join(","), gauge: !!u.gc.gaugeFill, pulse: !!u.gc.glow.GC_HoseGlow?.userData.pulse };
});
check("Green Candles equipped with the Blender model", info.id === "greencandle" && info.tank === "GC_Tank", JSON.stringify(info));
check("tank is the magazine, both arm anchors, gauge + hose pulse wired", info.anchors === 2 && info.gauge && info.pulse);
check("all six glow materials found", info.glow.split(",").length === 6, info.glow);
await shot(page, "gc-hip.png");

const st = () => page.evaluate(() => window.__trollOps.candleState());
const trigger = (v) => page.evaluate((x) => window.__trollOps.setTrigger(x), v);

// Tap
let a0 = (await st()).ammo;
await trigger(true); await sleep(70); await trigger(false); await sleep(150);
let s = await st();
check("tap fires a 1-cell bolt", s.ammo === a0 - 1 && !s.charging, `${a0} -> ${s.ammo}`);
const pulse = await page.evaluate(() => window.__trollOps.activeWeaponMesh().userData.gcState);
check("shot flares the candle", pulse.flare > 0.05, pulse.flare.toFixed(2));
await sleep(700);

// Full charge
a0 = (await st()).ammo;
await trigger(true); await sleep(1000);
s = await st();
const ring = await page.evaluate(() => ({ hidden: document.getElementById("to-charge").hidden, p: getComputedStyle(document.getElementById("to-charge")).getPropertyValue("--p"), txt: document.getElementById("to-charge-cells").textContent }));
check("holding charges to full", s.charging && s.level > 0.99, s.level.toFixed(2));
check("charge ring up and full", !ring.hidden && parseFloat(ring.p) > 0.99 && ring.txt === "3 CELLS", JSON.stringify(ring));
const glowCharged = await page.evaluate(() => { const g = window.__trollOps.activeWeaponMesh().userData.gc.glow.GC_CandleCore; return g.emissiveIntensity / g.userData.baseEmissive; });
check("candle brightens with the charge", glowCharged > 1.3, glowCharged.toFixed(2));
await shot(page, "gc-charged.png");
await trigger(false); await sleep(40);
await shot(page, "gc-release.png");
await sleep(150);
s = await st();
check("full charge costs 3 cells", s.ammo === a0 - 3 && !s.charging, `${a0} -> ${s.ammo}`);
check("ring hides after the shot", await page.evaluate(() => document.getElementById("to-charge").hidden));
await sleep(700);

// Partial charge
a0 = (await st()).ammo;
await trigger(true); await sleep(460);
const lv = (await st()).level;
await trigger(false); await sleep(150);
s = await st();
check("partial charge costs in between", s.ammo === a0 - 2, `level ${lv.toFixed(2)}, ${a0} -> ${s.ammo}`);
await sleep(700);

// Low tank caps the charge
await page.evaluate(() => { window.__trollOps.currentWeapon().ammoInMag = 2; });
await trigger(true); await sleep(1000);
s = await st();
check("2 cells left caps the charge at half", Math.abs(s.level - 0.5) < 0.02, s.level.toFixed(2));
await trigger(false); await sleep(150);
s = await st();
check("capped charge spends what's there", s.ammo === 0, String(s.ammo));
await sleep(500);

// Reload drops a charge, and the tank comes off
await page.evaluate(() => { window.__trollOps.currentWeapon().ammoInMag = 10; });
await trigger(true); await sleep(300);
await page.evaluate(() => window.__trollOps.currentWeapon().startReload());
await sleep(100);
s = await st();
check("reload cancels the charge without firing", !s.charging && s.reloading && s.ammo === 10, JSON.stringify(s));
await trigger(false);
const mid = [];
for (const t of [700, 1500, 2400, 3200]) {
  await sleep(t - (mid.length ? [700, 1500, 2400, 3200][mid.length - 1] : 0));
  mid.push(await page.evaluate(() => {
    const u = window.__trollOps.activeWeaponMesh().userData;
    const core = u.gc.glow.GC_CandleCore;
    return { gauge: +u.gc.gaugeFill.scale.z.toFixed(2), lit: +(core.emissiveIntensity / core.userData.baseEmissive).toFixed(2),
      tankMoved: +u.magMesh.position.distanceTo(u.magazinePoint).toFixed(3) };
  }));
  if (mid.length === 2) await shot(page, "gc-reload.png");
}
console.log("      reload samples", JSON.stringify(mid));
check("tank leaves the gun mid-reload", mid[0].tankMoved > 0.05 || mid[1].tankMoved > 0.05);
check("candle goes dark with the tank off", Math.min(mid[0].lit, mid[1].lit) < 0.3);
await sleep(900);
s = await st();
const after = await page.evaluate(() => { const u = window.__trollOps.activeWeaponMesh().userData; const core = u.gc.glow.GC_CandleCore; return { gauge: u.gc.gaugeFill.scale.z, lit: core.emissiveIntensity / core.userData.baseEmissive }; });
check("fresh tank: 24 cells, gauge full, candle relit", s.ammo === 24 && after.gauge > 0.95 && after.lit > 0.7, `${s.ammo} ${after.gauge.toFixed(2)} ${after.lit.toFixed(2)}`);

// Charged bolt stats
const stats = await page.evaluate(async () => {
  const W = await import("/assets/games/troll-ops/weapons.js?v=to-gc1");
  const d = W.WEAPON_DEFS.greencandle;
  const tap = W.chargedShotDef(d, 0), full = W.chargedShotDef(d, 1);
  return { tap: [tap.def.damage, tap.cells], full: [full.def.damage, full.cells, full.def.muzzleVelocity, full.def.penetration] };
});
check("tap 38 dmg / 1 cell, full 100 dmg / 3 cells / 260 m/s / pen 2.4",
  stats.tap[0] === 38 && stats.tap[1] === 1 && stats.full[0] === 100 && stats.full[1] === 3 && stats.full[2] === 260 && stats.full[3] === 2.4,
  JSON.stringify(stats));

await page.evaluate(() => window.__trollOps.setAds?.(true)); await sleep(700);
await shot(page, "gc-ads.png");
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall pass");
process.exit(failures ? 1 : 0);
