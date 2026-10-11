// Troll Forces gait: the stick rig run over the ground at a walk, the bot
// run, the player run and the sprint (character.js poseHumanoid), checked
// against a real runner:
//   - cadence (steps a minute) in a human range for the speed;
//   - planted feet don't slide (world speed of a foot on the ground);
//   - the feet actually reach the ground (the IK isn't left short);
//   - a run has flight (both feet up), a walk never does;
//   - the run's hips are low on a planted foot and high in the flight;
//   - standing still, the weight moves from leg to leg with the feet put;
//   - a take-off pitches the body forward more than the steady run.
// User, 2026-10-11: "make the troll move more realistically".
//
// Usage: node tools/troll-ops-gait-test.mjs   (needs Playwright)

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
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".png": "image/png" };
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">
{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__gait.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
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

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("pageerror:", e.message); failures++; });
await page.goto(`${BASE}/__gait.html`);
if (process.env.GAIT_CHAR) await page.evaluate((f) => { window.__charFile = f; }, process.env.GAIT_CHAR);

const res = await page.evaluate(async () => {
  const THREE = await import("three");
  const C = await import("/assets/games/troll-ops/" + (window.__charFile || "character.js") + "?v=gait-test");
  const DT = 1 / 120;
  const out = {};
  const ankle = (rig, k) => rig.parts[k].getWorldPosition(new THREE.Vector3());

  for (const v of [1.4, 4.2, 5.2, 7.0]) {
    const rig = C.buildHumanoid(new THREE.MeshBasicMaterial(), { height: 1.8, gun: false });
    const R = rig.limbRadius;
    let phase = 0, z = 0;
    let slip = 0, slipSum = 0, slipN = 0, short = 0, frames = 0, flight = 0, stance = 0;
    const hipOn = [], hipOff = [];
    const prev = {};
    for (let i = 0; i < 4 / DT; i++) {
      phase += DT * C.gaitPhaseRate(v);
      z -= v * DT;
      rig.root.position.z = z;
      C.poseHumanoid(rig, { phase, moving: true, mps: v, speed: Math.min(1, v / 4.2), forward: 1, dt: DT, hold: "none" });
      rig.root.updateMatrixWorld(true);
      if (i < 1 / DT) continue;          // let the start blend settle
      frames++;
      let down = 0;
      for (const [k, b] of [["ankleL", "ballL"], ["ankleR", "ballR"]]) {
        // The foot's contact: the ankle (heel down) or the ball (heel up,
        // pushing off), whichever is lower; on the ground within 4 mm.
        const an = ankle(rig, k), bl = ankle(rig, b);
        const which = an.y <= bl.y + 0.004 ? "heel" : "ball";
        const a = which === "heel" ? an : bl;
        const planted = a.y < R + 0.004;
        if (planted) {
          down++;
          if (prev[k]?.planted && prev[k].which === which) {
            const sp = Math.hypot(a.x - prev[k].x, a.z - prev[k].z) / DT;
            slip = Math.max(slip, sp); slipSum += sp; slipN++;
          }
        }
        prev[k] = { x: a.x, z: a.z, planted, which };
      }
      // The IK left short: a foot target on the ground the ankle can't reach.
      const yL = ankle(rig, "ankleL").y, yR = ankle(rig, "ankleR").y;
      if (Math.min(yL, yR) > R + 0.04 && v < 2) short++;
      if (down === 0) { flight++; hipOff.push(rig.parts.hips.position.y); } else { stance++; hipOn.push(rig.parts.hips.position.y); }
    }
    const step = C.gaitStepLength(v);
    const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    out[v] = {
      cadence: 60 * v / step, slip, slipMean: slipSum / Math.max(1, slipN), short: short / frames, flight: flight / frames,
      hipOn: avg(hipOn), hipOff: avg(hipOff),
      hipRange: Math.max(...hipOn, ...hipOff) - Math.min(...hipOn, ...hipOff),
    };
  }

  // Standing: weight from leg to leg, feet put.
  {
    const rig = C.buildHumanoid(new THREE.MeshBasicMaterial(), { height: 1.8, gun: false });
    let minX = 0, maxX = 0, drift = 0;
    let a0 = null;
    for (let i = 0; i < 20 / DT; i++) {
      C.poseHumanoid(rig, { moving: false, dt: DT, hold: "none" });
      rig.root.updateMatrixWorld(true);
      const x = rig.parts.hips.position.x;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      const a = ankle(rig, "ankleL");
      if (i === Math.round(2 / DT)) a0 = a;
      if (a0) drift = Math.max(drift, Math.hypot(a.x - a0.x, a.z - a0.z));
    }
    out.idle = { minX, maxX, drift };
  }

  // Take-off: forward pitch in the first moments vs the steady run.
  {
    const rig = C.buildHumanoid(new THREE.MeshBasicMaterial(), { height: 1.8, gun: false });
    for (let i = 0; i < 60; i++) C.poseHumanoid(rig, { moving: false, dt: DT, hold: "none" });
    let phase = 0, peak = 0, steady = 0;
    for (let i = 0; i < 3 / DT; i++) {
      const v = Math.min(5.2, i * DT * 30);   // 0 to 5.2 m/s in ~0.17 s
      phase += DT * C.gaitPhaseRate(v);
      C.poseHumanoid(rig, { phase, moving: true, mps: v, speed: 1, forward: 1, dt: DT, hold: "none" });
      const pitch = rig.parts.torso.rotation.x;
      if (i * DT < 0.4) peak = Math.max(peak, pitch); else steady = pitch;
    }
    out.takeoff = { peak, steady };
  }

  // A jump (7 m/s up, gravity 22) and its landing; then a stair-sized drop.
  {
    const rig = C.buildHumanoid(new THREE.MeshBasicMaterial(), { height: 1.8, gun: false });
    const R = rig.limbRadius;
    for (let i = 0; i < 60; i++) C.poseHumanoid(rig, { moving: false, dt: DT, hold: "none" });
    const footUp = () => {   // the lower ankle's height above the hips' feet line, in the root
      rig.root.updateMatrixWorld(true);
      return Math.min(rig.parts.ankleL.getWorldPosition(new THREE.Vector3()).y, rig.parts.ankleR.getWorldPosition(new THREE.Vector3()).y) - R;
    };
    let vy = 7, apexTuck = 0, fallExt = 1, minHip = Infinity, settled = 0;
    const stand = rig.parts.hips.position.y;
    for (let t = 0; t < 2.5; t += DT) {
      const inAir = t < 2 * 7 / 22;
      const land = !inAir && t - DT < 2 * 7 / 22 ? 0.6 : 0;
      C.poseHumanoid(rig, { moving: false, dt: DT, hold: "none", air: inAir, vy: inAir ? vy : 0, land });
      if (inAir) vy -= 22 * DT;
      if (Math.abs(t - 7 / 22) < DT) apexTuck = footUp();
      if (inAir && vy < -5) fallExt = Math.min(fallExt, footUp());
      if (!inAir) {
        minHip = Math.min(minHip, rig.parts.hips.position.y);
        if (t > 2 * 7 / 22 + 0.8) settled = Math.max(settled, Math.abs(rig.parts.hips.position.y - stand));
      }
    }
    // A stair: 0.06 s in the air, falling slowly.
    const rig2 = C.buildHumanoid(new THREE.MeshBasicMaterial(), { height: 1.8, gun: false });
    for (let i = 0; i < 60; i++) C.poseHumanoid(rig2, { moving: false, dt: DT, hold: "none" });
    let stairLift = 0;
    for (let t = 0; t < 0.06; t += DT) {
      C.poseHumanoid(rig2, { moving: false, dt: DT, hold: "none", air: true, vy: -1.3 });
      rig2.root.updateMatrixWorld(true);
      stairLift = Math.max(stairLift, Math.min(rig2.parts.ankleL.getWorldPosition(new THREE.Vector3()).y, rig2.parts.ankleR.getWorldPosition(new THREE.Vector3()).y) - R);
    }
    out.jump = { apexTuck, fallExt, squash: stand - minHip, settled, stairLift };
  }
  return out;
});

const RANGE = { 1.4: [100, 125], 4.2: [170, 195], 5.2: [180, 205], 7: [195, 222] };
for (const v of [1.4, 4.2, 5.2, 7]) {
  const r = res[v];
  const [lo, hi] = RANGE[v];
  check(`${v} m/s: cadence ${r.cadence.toFixed(0)} steps/min in ${lo}-${hi}`, r.cadence >= lo && r.cadence <= hi);
  // A planted foot holds still: on average under 3 cm/s plus 1% of the
  // speed (a sprint stance is ~12 frames, so its toe-off frame weighs in),
  // and no more than a quarter of the body's speed in any one frame.
  check(`${v} m/s: planted feet don't slide`, r.slipMean < 0.03 + 0.01 * v && r.slip < 0.25 * v + 0.2, `mean ${r.slipMean.toFixed(3)}, peak ${r.slip.toFixed(2)} m/s`);
  if (v < 2) {
    check(`${v} m/s: a walk always has a foot down`, r.flight < 0.02, `flight ${(r.flight * 100).toFixed(0)}%`);
    check(`${v} m/s: the feet reach the ground`, r.short < 0.02, `${(r.short * 100).toFixed(0)}% short`);
    check(`${v} m/s: walking hips rise and fall 2-8 cm`, r.hipRange > 0.02 && r.hipRange < 0.08, `${(r.hipRange * 100).toFixed(1)} cm`);
  } else {
    check(`${v} m/s: a run has flight`, r.flight > 0.2, `${(r.flight * 100).toFixed(0)}%`);
    check(`${v} m/s: hips higher in flight than on a planted foot`, r.hipOff > r.hipOn + 0.01, `${(r.hipOff - r.hipOn) * 100 | 0} cm`);
  }
}
check("standing: the weight moves to both legs", res.idle.minX < -0.015 && res.idle.maxX > 0.015, `hips x ${res.idle.minX.toFixed(3)}..${res.idle.maxX.toFixed(3)}`);
check("standing: the feet stay put", res.idle.drift < 0.07, `drift ${(res.idle.drift * 100).toFixed(1)} cm`);
check("take-off leans forward more than the steady run", res.takeoff.peak > res.takeoff.steady + 0.04, `peak ${res.takeoff.peak.toFixed(2)} vs ${res.takeoff.steady.toFixed(2)} rad`);

const J = res.jump;
check("jump: the knees tuck at the top", J.apexTuck > 0.15, `feet ${(J.apexTuck * 100).toFixed(0)} cm up`);
check("jump: the legs reach down falling", J.fallExt < J.apexTuck - 0.08, `${(J.fallExt * 100).toFixed(0)} vs ${(J.apexTuck * 100).toFixed(0)} cm`);
check("landing: the knees take it", J.squash > 0.06 && J.squash < 0.2, `hips down ${(J.squash * 100).toFixed(0)} cm`);
check("landing: springs back up", J.settled < 0.012, `${(J.settled * 100).toFixed(1)} cm off after 0.8 s`);
check("a stair-sized drop doesn't tuck", J.stairLift < 0.03, `feet ${(J.stairLift * 100).toFixed(1)} cm up`);

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
