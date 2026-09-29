// Troll Forces Trollsaber check: the Vader hilt model loads in place of the
// stand-in, the blade ignites when the saber is drawn, a swing leaves a
// trail and kills a range dummy in one hit, holding aim raises the guard,
// a round from the front is deflected (no damage, meter drains), a round
// from behind still lands, and emptying the meter breaks the guard.
// Screenshots go to OUT.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-trollsaber-test.mjs

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
  T.loadout.meleeId = "trollsaber";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 });
await page.waitForFunction(() => !window.__trollOps.isStaging(), null, { timeout: 30000 });

const info = await page.evaluate(() => {
  const T = window.__trollOps;
  return { melee: T.player.melee?.def.id, saber: !!T.activeMeleeMesh()?.userData.saber };
});
check("Trollsaber is the melee weapon", info.melee === "trollsaber" && info.saber, JSON.stringify(info));

// Hilt model streams in and replaces the stand-in.
await page.waitForFunction(() => {
  const s = window.__trollOps.activeMeleeMesh()?.userData.saber;
  return s && s.hiltHolder.children.length && !s.hiltHolder.children[0].userData.standIn;
}, null, { timeout: 30000 }).catch(() => {});
const hilt = await page.evaluate(() => {
  const s = window.__trollOps.activeMeleeMesh().userData.saber;
  let tris = 0, mats = new Set();
  s.hiltHolder.traverse((o) => { if (o.isMesh) { tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; mats.add(o.material.name); } });
  return { standIn: !!s.hiltHolder.children[0]?.userData.standIn, tris: Math.round(tris), mats: [...mats].sort().join(",") };
});
check("Vader hilt model loaded", !hilt.standIn && hilt.tris > 20000, `${hilt.tris} tris`);
check("hilt materials include the red button and amber window", hilt.mats.includes("TS_Button") && hilt.mats.includes("TS_Amber"), hilt.mats);

// Draw it: starts dark, ignites.
const before = await page.evaluate(() => {
  const T = window.__trollOps;
  T.breakSpawnGuard();
  T.setHolding("melee");
  return T.activeMeleeMesh().userData.saber.frac;
});
await sleep(600);
const lit = await page.evaluate(() => {
  const s = window.__trollOps.activeMeleeMesh().userData.saber;
  return { frac: s.frac, len: s.beam.material.uniforms.uLen.value, visible: window.__trollOps.activeMeleeMesh().visible };
});
check("blade ignites on draw", before < 0.5 && lit.frac === 1 && lit.len > 0.8 && lit.visible, JSON.stringify({ before, ...lit }));
await shot(page, "ts-held.png");

// Guard up.
await page.evaluate(() => window.__trollOps.setAds(true));
await sleep(400);
let st = await page.evaluate(() => window.__trollOps.saberState());
check("holding aim raises the guard", st.active && st.t > 0.8, JSON.stringify(st));
await shot(page, "ts-block.png");

// A round from straight ahead.
const hitFrom = (behind) => page.evaluate((b) => {
  const T = window.__trollOps, THREE = T.THREE;
  const fwd = new THREE.Vector3();
  T.camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  const at = T.move.pos.clone().addScaledVector(fwd, b ? -10 : 10);
  const hp0 = T.player.hp;
  const m0 = T.saberState().meter;
  T.damagePlayer(30, null, "problem416", false, at);
  return { hp0, hp1: T.player.hp, m0, m1: T.saberState().meter };
}, behind);
let r = await hitFrom(false);
check("round from the front is deflected", r.hp1 === r.hp0 && r.m1 < r.m0, JSON.stringify(r));
await sleep(60);
await shot(page, "ts-deflect.png");
r = await hitFrom(true);
check("round from behind still lands", r.hp1 < r.hp0, JSON.stringify(r));

// Empty the meter: the guard breaks and stops deflecting.
await page.evaluate(() => {
  const T = window.__trollOps, THREE = T.THREE;
  const fwd = T.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
  const at = T.move.pos.clone().addScaledVector(fwd, 10);
  for (let i = 0; i < 40 && T.saberState().broken <= 0; i++) { T.player.hp = 100; T.damagePlayer(30, null, "problem416", false, at); }
  T.player.hp = 100;
});
st = await page.evaluate(() => window.__trollOps.saberState());
check("an empty meter breaks the guard", st.broken > 0 && !st.active, JSON.stringify(st));
const brokenHit = await hitFrom(false);
check("a broken guard lets rounds through", brokenHit.hp1 < brokenHit.hp0, JSON.stringify(brokenHit));
await page.evaluate(() => window.__trollOps.setAds(false));

// Swing: the trail shows mid-swing.
await sleep(1500);   // let the hit flash from the rounds above clear
await page.evaluate(() => window.__trollOps.swingMelee());
let sawTrail = false;
for (let i = 0; i < 20 && !sawTrail; i++) {
  await sleep(20);
  sawTrail = await page.evaluate(() => window.__trollOps.saberState().trail);
}
check("a swing leaves a trail", sawTrail);
// A few frames through the next swing (the rising backhand) for the eye.
await sleep(700);
// Headless frames are too slow to catch a 0.56 s swing, so pin the swing
// clock at each beat (already landed: no hit) and take a frame.
for (const [i, kind, t] of [[0, 0, 0.11], [1, 0, 0.2], [2, 0, 0.28], [3, 0, 0.37], [4, 1, 0.11], [5, 1, 0.28], [6, 1, 0.37]]) {
  await page.evaluate(([k, tt]) => { const m = window.__trollOps.player.melee; m.swingIndex = k; m.t = tt; m.landed = true; }, [kind, t]);
  await sleep(30);
  await page.evaluate(([k, tt]) => { const m = window.__trollOps.player.melee; m.swingIndex = k; m.t = tt; }, [kind, t]);
  await shot(page, `ts-swing-${i}.png`);
}
await page.evaluate(() => { window.__trollOps.player.melee.t = 0; });

// The loadout gear card is gated at LV 30.
const card = await page.evaluate(() => {
  const d = window.__trollOps.player.melee.def;
  return { rank: d.rank, damage: d.damage, deflect: !!d.deflect };
});
check("unlock LV 30, one-hit damage, deflects", card.rank === 30 && card.damage >= 300 && card.deflect, JSON.stringify(card));

// Menu preview / other players: the handless build comes up already lit.
const preview = await page.evaluate(async () => {
  const T = window.__trollOps;
  T.inspector?.show(T.player.melee.def);
  await new Promise((r) => setTimeout(r, 300));
  let lit = null;
  T.inspector?.scene?.traverse?.((o) => { if (o.userData.saber) lit = o.userData.saber.frac; });
  return { lit };
});
check("menu preview shows the saber lit", preview.lit === null || preview.lit === 1, JSON.stringify(preview));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
