// Troll Royale: the Cope Plate and Hopium animations (modes/royale-use.js;
// user: "there should be animations for when users wear the armor and inject
// the hopium").
//
// One Royale match on Grin Beach in a private room (Supabase blocked, no
// plane drop, three bots, spawn-protected):
//   1. plate: the gun dips, then the plate is in the viewmodel with both rods
//      on its edges, rising and then sliding down out of the bottom as k runs;
//      at the end the plate is gone, the armour is on and the gun is back
//   2. Hopium: the injector up, the cap on, then flicked off; the dose window
//      drains while the edges glow green; at the end it's tossed and gone
//   3. cancel: a shot mid-plate puts everything away and the gun comes back
//   4. a swap mid-Hopium cancels it the same way
//   5. third person: a bot plating up (b.act, via the `ua` wire) holds the
//      plate to its chest; your own body holds the injector at the thigh
//   6. no page errors
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-use-anims-test.mjs
// SHOTS=<dir> saves 8 first-person frames of each, and the third-person shots.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS || null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
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
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name) }); };

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.DROP.enabled = false;
  T.ROYALE.players = 4;
  T.loadout.mapId = "grinbeach";
  T.setMode("royale");
  if (T.els.noBots) T.els.noBots.checked = false;
  // a private room, never the public one
  T.els.room.value = "UA" + Math.random().toString(36).slice(2, 5).toUpperCase();
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
  if (T.isStaging()) T.endStaging();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
await page.waitForFunction(() => !window.__trollOps.isStaging(), null, { timeout: 30000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.player.spawnGuard = 1e9;   // bots leave us be
  window.__G = (await import("/assets/games/troll-ops/core/state.js?v=st1")).game;
  window.__U = await import("/assets/games/troll-ops/modes/royale-use.js?v=ru1");
  window.__W = await import("/assets/games/troll-ops/combat/weapons.js?v=wp1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-ar0-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2");
});
await sleep(1500);

const prime = () => page.evaluate(() => {
  const T = window.__trollOps, P = T.player;
  T.royale().act && (T.royale().act = null);
  window.__U.useAnimCancel();
  P.plates = 3; P.heals = 3; P.armor = 0; P.hp = 30; P.alive = true;
  T.look.pitch = 0;
  window.__G.settings.thirdPerson = false;
});
/* Freeze the act at progress k (a huge duration keeps k where it is). */
const freeze = (k) => page.evaluate((k) => {
  const a = window.__trollOps.royale().act;
  if (!a) return false;
  a.dur = 1e6; a.t = k * 1e6;
  return true;
}, k);
/* What the first person shows right now. */
const fpState = () => page.evaluate(() => {
  const T = window.__trollOps, U = window.__U, m = U.useModels();
  const arms = T.streakArms.userData.arms;
  const rodTip = (a) => (a.rod.visible ? a.hand.position.toArray() : null);
  const glowEl = document.getElementById("to-hopium-glow");
  return {
    act: T.royale().act?.kind || null,
    k: U.useAnim.k,
    gun: T.fpWeaponDrawn(),
    raise: window.__W.swapRaise.t,
    plate: m ? { vis: m.plate.visible && T.streakArms.visible, y: m.plate.position.y, pos: m.plate.position.toArray() } : null,
    hop: m ? { vis: m.hop.visible && T.streakArms.visible, y: m.hop.position.y, dose: m.hop.userData.glow.scale.y, tossT: U.useAnim.tossT } : null,
    cap: m ? { vis: m.cap.visible, onHop: m.cap.parent === m.hop } : null,
    rods: arms.map(rodTip),
    glow: glowEl ? +glowEl.style.opacity : 0,
    armor: T.player.armor, hp: T.player.hp,
  };
});
/* The distance from each visible rod's tip to the nearest point on a prop's
   surface, sampled from its geometry (viewmodel space). */
const rodGap = (which) => page.evaluate((which) => {
  const T = window.__trollOps, m = window.__U.useModels()[which];
  m.updateMatrixWorld(true);
  const arms = T.streakArms.userData.arms.filter((a) => a.rod.visible);
  const inv = T.streakArms.matrixWorld.clone().invert();
  const pts = [];
  m.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const p = o.geometry.attributes.position, mw = o.matrixWorld;
    for (let i = 0; i < p.count; i += 1) {
      const v = { x: p.getX(i), y: p.getY(i), z: p.getZ(i) };
      const e = mw.elements, ie = inv.elements;
      const wx = e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12], wy = e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13], wz = e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14];
      pts.push([ie[0] * wx + ie[4] * wy + ie[8] * wz + ie[12], ie[1] * wx + ie[5] * wy + ie[9] * wz + ie[13], ie[2] * wx + ie[6] * wy + ie[10] * wz + ie[14]]);
    }
  });
  return arms.map((a) => {
    const h = a.hand.position;
    let best = 1e9;
    for (const q of pts) best = Math.min(best, Math.hypot(q[0] - h.x, q[1] - h.y, q[2] - h.z));
    return +best.toFixed(4);
  });
}, which);

/* --------------------------------------------------------------- 1. plate */
await prime();
await page.evaluate(() => window.__trollOps.startRoyaleAct("plate"));
const plateFrames = [];
const KS = [0.05, 0.18, 0.3, 0.42, 0.52, 0.66, 0.8, 0.94];
for (let i = 0; i < KS.length; i++) {
  await freeze(KS[i]);
  await sleep(250);
  plateFrames.push(await fpState());
  if (KS[i] >= 0.3 && KS[i] <= 0.52) plateFrames[i].gap = await rodGap("plate");
  await shot(`plate-${i + 1}-k${String(Math.round(KS[i] * 100)).padStart(2, "0")}.png`);
}
const [p05, , p30, p42, , , p80] = plateFrames;
check("plate: the gun dips first (no plate yet)", p05.gun === true && !p05.plate.vis && p05.raise > 0.05, JSON.stringify({ gun: p05.gun, plate: p05.plate.vis, raise: +p05.raise.toFixed(3) }));
check("plate: in view, the gun away, both rods on it", p30.plate.vis && p30.gun === false && p30.rods.every(Boolean), JSON.stringify({ plate: p30.plate.vis, gun: p30.gun, rods: p30.rods.map(Boolean) }));
const gaps = plateFrames.filter((f) => f.gap).flatMap((f) => f.gap);
check("plate: each rod tip touches the plate (within 2 cm of its surface)", gaps.length >= 4 && gaps.every((g) => g < 0.02), JSON.stringify(gaps));
check("plate: progress drives it (up into view, then down into the vest)", p30.plate.y > -0.25 && p80.plate.y < p42.plate.y - 0.15, JSON.stringify({ k30: +p30.plate.y.toFixed(3), k42: +p42.plate.y.toFixed(3), k80: +p80.plate.y.toFixed(3) }));
check("plate: never into the camera (stays 0.2 m+ out in front)", plateFrames.every((f) => !f.plate.vis || f.plate.pos[2] < -0.2), JSON.stringify(plateFrames.map((f) => +f.plate.pos[2].toFixed(2))));
// Let it finish at its real pace.
await page.evaluate(() => { const a = window.__trollOps.royale().act; a.dur = 1.1; a.t = 1.0; });
await sleep(900);
let s = await fpState();
check("plate: at the end the plate is gone, armour on, the gun back up", !s.act && !s.plate.vis && s.armor > 0 && s.gun === true, JSON.stringify({ act: s.act, plate: s.plate.vis, armor: s.armor, gun: s.gun }));

/* ------------------------------------------------------------- 2. Hopium */
await prime();
await page.evaluate(() => window.__trollOps.startRoyaleAct("heal"));
const healFrames = [];
const HK = [0.03, 0.12, 0.2, 0.27, 0.34, 0.5, 0.75, 0.9];
for (let i = 0; i < HK.length; i++) {
  await freeze(HK[i]);
  await sleep(250);
  healFrames.push(await fpState());
  if (HK[i] === 0.12 || HK[i] === 0.5) healFrames[i].gap = await rodGap("hop");
  await shot(`hopium-${i + 1}-k${String(Math.round(HK[i] * 100)).padStart(2, "0")}.png`);
}
const [h03, h12, h20, h27, , h50, h75] = healFrames;
check("Hopium: the gun dips first", h03.gun === true && !h03.hop.vis, JSON.stringify({ gun: h03.gun, hop: h03.hop.vis }));
check("Hopium: the injector in view, capped, the gun away", h12.hop.vis && h12.cap.vis && h12.cap.onHop && h12.gun === false, JSON.stringify({ hop: h12.hop, cap: h12.cap, gun: h12.gun }));
check("Hopium: the left rod reaches the cap", !!h20.rods[1], JSON.stringify(h20.rods));
check("Hopium: the cap is flicked off", !h27.cap.onHop, JSON.stringify(h27.cap));
check("Hopium: the right rod's tip touches the injector", healFrames.filter((f) => f.gap).every((f) => f.gap.length && f.gap[0] < 0.02), JSON.stringify(healFrames.filter((f) => f.gap).map((f) => f.gap)));
check("Hopium: the dose drains while it's in", h50.hop.dose < 0.85 && h75.hop.dose < h50.hop.dose, JSON.stringify({ k50: +h50.hop.dose.toFixed(2), k75: +h75.hop.dose.toFixed(2) }));
check("Hopium: a green glow at the edges while it works (subtle)", h50.glow > 0.05 && h50.glow < 0.8 && h12.glow === 0, JSON.stringify({ k12: h12.glow, k50: h50.glow }));
await page.evaluate(() => { const a = window.__trollOps.royale().act; a.dur = 2.6; a.t = 2.45; });
await sleep(160);
s = await fpState();
const tossed = s.hop.tossT >= 0 || !s.act;
await shot("hopium-9-toss.png");
await sleep(1100);
s = await fpState();
check("Hopium: tossed at the end, then gone; full health; the gun back; no glow", tossed && !s.act && !s.hop.vis && s.hp >= 99 && s.gun === true && s.glow === 0, JSON.stringify({ tossed, act: s.act, hop: s.hop.vis, hp: Math.round(s.hp), gun: s.gun, glow: s.glow }));

/* --------------------------------------------------- 3. cancel by firing */
await prime();
await page.evaluate(() => window.__trollOps.startRoyaleAct("plate"));
await sleep(500);
const mid = await fpState();
await page.evaluate(() => window.__trollOps.setTrigger(true));
await sleep(120);
await page.evaluate(() => window.__trollOps.setTrigger(false));
await sleep(500);
s = await fpState();
check("cancel (a shot mid-plate): act gone, no plate, rods down, the gun back", mid.act === "plate" && !s.act && !s.plate.vis && s.rods.every((r) => !r) && s.gun === true && s.armor === 0,
  JSON.stringify({ mid: mid.act, act: s.act, plate: s.plate.vis, rods: s.rods.map(Boolean), gun: s.gun, armor: s.armor }));

/* ----------------------------------------------------- 4. cancel by swap */
await prime();
await page.evaluate(() => window.__trollOps.startRoyaleAct("heal"));
await sleep(400);
const swapped = await page.evaluate(() => {
  const T = window.__trollOps, G = window.__G;
  const before = [G.player.holding, G.currentWeaponSlot];
  T.switchWeapon(G.currentWeaponSlot === "primary" ? "secondary" : "primary");
  if (G.player.holding === before[0] && G.currentWeaponSlot === before[1] && G.player.melee) T.setHolding("melee");
  return G.player.holding !== before[0] || G.currentWeaponSlot !== before[1];
});
await sleep(500);
s = await fpState();
if (swapped) check("cancel (a swap mid-Hopium): act gone, no injector, no cap, no glow", !s.act && !s.hop.vis && !s.cap.vis && s.glow === 0, JSON.stringify({ act: s.act, hop: s.hop.vis, cap: s.cap.vis, glow: s.glow }));
else console.log("SKIP  cancel by swap (nothing to swap to in this loadout)");
await page.evaluate(() => { const T = window.__trollOps, G = window.__G; if (G.player.holding !== "gun") T.setHolding("gun"); });

/* ---------------------------------------------------- 5. third person */
// A bot plating up / dosing: frozen mid-act, pinned in place 3 m in front of
// us at a three-quarter angle (a rAF loop holds it and us still for the shot).
const botPose = (kind, k, ang) => page.evaluate(async ({ kind, k, ang }) => {
  const T = window.__trollOps, G = window.__G;
  const b = T.bots.bots.find((x) => x.alive && !x.airborne);
  if (!b) return null;
  cancelAnimationFrame(window.__pin || 0);
  const at = { x: b.pos.x, y: b.pos.y, z: b.pos.z, yaw: b.yaw };
  const fx = -Math.sin(at.yaw + ang), fz = -Math.cos(at.yaw + ang);
  const pin = () => {
    b.act = { kind, t: k * 1e6, dur: 1e6, at: performance.now() + 1e7 };
    b.lastTargetId = null; b.hurtAt = 0;
    b.pos.set(at.x, at.y, at.z); b.yaw = at.yaw;
    T.move.pos.set(at.x + fx * 3, at.y, at.z + fz * 3);
    T.look.yaw = Math.atan2(fx, fz); T.look.pitch = -0.18;
    window.__pin = requestAnimationFrame(pin);
  };
  pin();
  await new Promise((r) => setTimeout(r, 600));
  const rp = G.remotes.byId.get(b.id);
  const u = rp?.rig?.useModels;
  return { id: b.id, wire: G.net.peers.get(b.id)?.useAct || null, plate: !!u?.plate.visible, hop: !!u?.hop.visible, gunHidden: rp?.weaponMesh ? !rp.weaponMesh.visible : null };
}, { kind, k, ang });
const botA = await botPose("plate", 0.75, 0.6);
await shot("tp-bot-plate.png");
check("third person: a bot plating up shows the plate at its chest, gun away", !!botA && botA.plate && !botA.hop && botA.wire?.startsWith("p:") && botA.gunHidden !== false, JSON.stringify(botA));
const botB = await botPose("heal", 0.6, 0.6);
await shot("tp-bot-hopium.png");
check("third person: a bot dosing holds the Hopium, gun away", !!botB && botB.hop && !botB.plate && botB.wire?.startsWith("h:") && botB.gunHidden !== false, JSON.stringify(botB));
await page.evaluate(() => { cancelAnimationFrame(window.__pin || 0); const T = window.__trollOps; T.bots.bots.forEach((b) => { b.act = null; }); });
// Your own body in third person, dosing.
await prime();
await page.evaluate(() => { window.__G.settings.thirdPerson = true; window.__trollOps.startRoyaleAct("heal"); });
await freeze(0.6);
await sleep(500);
const me = await page.evaluate(() => {
  const G = window.__G, rig = G.localRig, u = rig?.useModels;
  // where the injector is on the body: metres above the feet, and to the right
  const root = rig.root, h = u.hop.position;
  return { hop: !!u?.hop.visible, wire: G.net.useAct || null, up: +(h.y).toFixed(2), right: +(h.x).toFixed(2), scale: rig.scale || 1, rootY: +root.position.y.toFixed(2) };
});
await shot("tp-self-hopium.png");
check("third person: your own body holds the Hopium low on the right (the thigh); `ua` on the wire", me.hop && me.wire?.startsWith("h:") && me.right > 0.03, JSON.stringify(me));
await page.evaluate(() => { window.__trollOps.royale().act = null; window.__U.useAnimCancel(); window.__G.settings.thirdPerson = false; });

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
