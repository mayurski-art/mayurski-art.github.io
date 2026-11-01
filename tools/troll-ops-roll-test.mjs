// Troll Forces controls (user, 2026-11-01): the combat roll on E and the
// pad's RB, the mouse wheel going round the weapons, LB throwing what you
// brought. In an offline TDM match:
//   1. E rolls ~3 m (one way or the other, in case a wall is in front), the
//      body tumbles in third person, and the state packet carries `roll`
//   2. a second E inside the cooldown does nothing
//   3. no firing mid-roll
//   4. wheel down goes to the next weapon, up back to the one before
//   5. the pad's RB rolls; LB throws the carried grenade
//   6. no page errors
//
// Supabase is blocked: this never joins the live public room.
// Usage: node tools/troll-ops-roll-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());
await ctx.addInitScript(() => {
  const btns = () => Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const pad = { id: "Xbox Controller (STANDARD GAMEPAD)", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: btns(), timestamp: 1 };
  window.__pad = pad;
  Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => { pad.timestamp++; return [pad]; } });
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  await T.startGame();
  if (T.isStaging?.()) T.endStaging?.();
});
for (let t = Date.now(); Date.now() - t < 120000 && await page.evaluate(() => window.__trollOps.isStaging?.() || window.__trollOps.state() !== "playing");) await sleep(400);

// The module, under the tag every importer uses (so the same instance).
await page.evaluate(async () => {
  window.__roll = await import("/assets/games/troll-ops/core/combat-roll.js?v=cr1");
});
const read = () => page.evaluate(() => {
  const T = window.__trollOps;
  if (!document.getElementById("to-pause").hidden) T.closePauseMenu();
  T.player.maxHp = T.player.hp = 1e9;
  return { x: T.move.pos.x, z: T.move.pos.z, state: T.state(), holding: T.player.holding, weapon: T.currentWeapon?.()?.def?.id,
    ammo: T.currentWeapon?.()?.ammoInMag, gear: (T.player.gear?.lethal || 0) + (T.player.gear?.tactical || 0) };
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const key = (code, type) => page.evaluate(([code, type]) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true })), [code, type]);
const tapE = async () => { await key("KeyE", "keydown"); await sleep(40); await key("KeyE", "keyup"); };
check("a match is running", (await read()).state === "playing");
await sleep(1500);   // the pad's rest calibration, the spawn settling

// ---- 1. E rolls
let best = 0, peakK = 0, peakTilt = 0, wireRoll = 0;
for (const turn of [0, Math.PI, Math.PI / 2]) {
  await page.evaluate((t) => { window.__trollOps.look.yaw += t; }, turn);
  await sleep(1200);   // past any cooldown
  const a = await read();
  await tapE();
  for (let i = 0; i < 6; i++) {
    await sleep(70);
    const s = await page.evaluate(() => ({ k: window.__roll.combatRollK(), tilt: Math.abs(window.__trollOps.localRig.root.rotation.x), wire: window.__trollOps.net?.lastSentRoll ?? 0 }));
    peakK = Math.max(peakK, s.k);
    peakTilt = Math.max(peakTilt, s.tilt);
  }
  await sleep(500);
  best = Math.max(best, dist(a, await read()));
  if (best > 2.4) break;
}
check("E: rolls about 3 m", best > 2.4 && best < 4.5, `${best.toFixed(2)} m`);
check("E: the roll runs (combatRollK)", peakK > 0.3, peakK.toFixed(2));

// Third person: the body tumbles head over heels.
await page.evaluate(() => window.__trollOps.toggleThirdPerson());
await sleep(1200);
await tapE();
for (let i = 0; i < 8; i++) {
  await sleep(50);
  peakTilt = Math.max(peakTilt, await page.evaluate(() => Math.abs(window.__trollOps.localRig.root.rotation.x)));
}
await page.evaluate(() => window.__trollOps.toggleThirdPerson());
check("third person: the body tumbles", peakTilt > 1, `${peakTilt.toFixed(2)} rad`);

// The state packet carries it: game.js netSnapshot reads game.combatRollK
// and game.combatRollYaw, which the module registers.
await sleep(1200);
await tapE();
await sleep(150);
wireRoll = await page.evaluate(async () => {
  const { game } = await import("/assets/games/troll-ops/core/state.js?v=st1");
  return game.combatRollK === window.__roll.combatRollK && game.combatRollYaw() != null ? game.combatRollK() : 0;
});
check("the state packet's roll and heading are set mid-roll", wireRoll > 0, String(wireRoll));

// ---- 2. cooldown
await sleep(700);   // the roll is over; the cooldown runs
const c0 = await read();
await tapE();
await sleep(500);
const c1 = await read();
check("E inside the cooldown: no second roll", dist(c0, c1) < 0.5, `${dist(c0, c1).toFixed(2)} m`);

// ---- 3. no firing mid-roll
await sleep(1500);
const f0 = await read();
await tapE();
await sleep(60);
await page.evaluate(() => window.__trollOps.setTrigger(true));
await sleep(250);
await page.evaluate(() => window.__trollOps.setTrigger(false));
const f1 = await read();
check("no shots mid-roll", f0.ammo == null || f1.ammo === f0.ammo, `${f0.ammo} -> ${f1.ammo}`);

// ---- 4. the wheel
await sleep(1200);
await page.evaluate(() => window.__trollOps.controls.lock());
await sleep(400);
check("the (fake) pointer lock is on", await page.evaluate(() => window.__trollOps.controls.isLocked));
const wheel = (dy) => page.evaluate((dy) => window.dispatchEvent(new WheelEvent("wheel", { deltaY: dy, bubbles: true, cancelable: true })), dy);
const w0 = await read();
await wheel(120);
await sleep(700);
const w1 = await read();
check("wheel down: next weapon", w1.weapon !== w0.weapon || w1.holding !== w0.holding, `${w0.holding}/${w0.weapon} -> ${w1.holding}/${w1.weapon}`);
await wheel(-120);
await sleep(700);
const w2 = await read();
check("wheel up: back to the one before", w2.weapon === w0.weapon && w2.holding === w0.holding, `${w2.holding}/${w2.weapon}`);
// A trackpad: a stream of small steps (still coming as the swipe coasts)
// is one swap, not five.
for (let i = 0; i < 30; i++) { await wheel(9); await sleep(16); }
await sleep(700);
const w3 = await read();
await wheel(-120); await sleep(700);
check("trackpad swipe: one swap", w3.weapon === w1.weapon && w3.holding === w1.holding, `${w3.holding}/${w3.weapon}`);

// ---- 5. pad: RB rolls, LB throws
const setBtn = (btn, down) => page.evaluate(([b, d]) => { const p = window.__pad; p.buttons[b].pressed = d; p.buttons[b].value = d ? 1 : 0; }, [btn, down]);
await sleep(1500);
let padBest = 0;
for (const turn of [0, Math.PI]) {
  await page.evaluate((t) => { window.__trollOps.look.yaw += t; }, turn);
  await sleep(1200);
  const a = await read();
  await setBtn(5, true); await sleep(120); await setBtn(5, false);
  await sleep(800);
  padBest = Math.max(padBest, dist(a, await read()));
  if (padBest > 2.4) break;
}
check("pad RB: rolls", padBest > 2.4, `${padBest.toFixed(2)} m`);
const g0 = await read();
await setBtn(4, true); await sleep(200); await setBtn(4, false);
await sleep(1200);
const g1 = await read();
check("pad LB: throws what you brought", g1.gear < g0.gear, `${g0.gear} -> ${g1.gear}`);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

// ---- 6. U Mad Bro? (heroes): a tap of E still rolls, on the release; a
// hold is the hero's ability, not a roll.
const hp = await ctx.newPage();
hp.on("pageerror", (e) => errors.push(e.message));
await hp.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
await hp.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await hp.evaluate(async () => { const T = window.__trollOps; T.setMode("umb"); await T.startGame(); if (T.isStaging?.()) T.endStaging?.(); });
for (let t = Date.now(); Date.now() - t < 120000 && await hp.evaluate(() => window.__trollOps.isStaging?.() || window.__trollOps.state() !== "playing");) await sleep(400);
await hp.evaluate(async () => { window.__roll = await import("/assets/games/troll-ops/core/combat-roll.js?v=cr1"); });
const hkey = (code, type) => hp.evaluate(([code, type]) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true })), [code, type]);
const peak = async (ms) => { let k = 0; for (let t = 0; t < ms; t += 60) { await sleep(60); k = Math.max(k, await hp.evaluate(() => window.__roll.combatRollK())); } return k; };
await sleep(1500);
check("heroes: a match is running", await hp.evaluate(() => window.__trollOps.state() === "playing"));
await hkey("KeyE", "keydown");
const heldK = await peak(500);   // held past the hero hold: no roll
await hkey("KeyE", "keyup");
const afterHoldK = await peak(400);
check("heroes: holding E doesn't roll", heldK === 0 && afterHoldK === 0, `${heldK.toFixed(2)}, ${afterHoldK.toFixed(2)}`);
await sleep(1200);
await hkey("KeyE", "keydown");
await sleep(80);
const downK = await hp.evaluate(() => window.__roll.combatRollK());
await hkey("KeyE", "keyup");
const tapK = await peak(400);
check("heroes: a tap of E rolls, on the release", downK === 0 && tapK > 0.2, `${downK.toFixed(2)} -> ${tapK.toFixed(2)}`);
check("no page errors (heroes)", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
