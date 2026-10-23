// Troll Forces, Troll Beach 5d: the court ball (modes/court-ball.js), in node.
//   - the same launch twice steps to bit-identical flights (every client agrees)
//   - a solved jumper from the free-throw line and from deep swish; a short
//     one hits the front rim; a bank off the board can go in
//   - a dribble bounces back to the hand
//   - tennis: topspin dips in and kicks high, slice skids low, flat goes long;
//     a low ball hits the net, a ball skimming it hits the cord
//   - volleyball: the sand kills the bounce
//
// Usage: node tools/troll-ops-court-ball-test.mjs

import { newBall, stepBall, advanceBall, makeLaunch, hoopsWorld, tennisWorld, vballWorld, solveShot, solveDrive, HZ } from "../assets/games/troll-ops/modes/court-ball.js";

// copies of maps/grinbeach-venice.js (it imports three, node can't load it)
const COURT = { x: 48, z: -6, w: 14, d: 26, lines: [41.5, 54.5, -18.5, 6.5], hoopZ: [-17.8, 5.8], rimY: 3.05 };
const RIMS = COURT.hoopZ.map((hz, i) => ({ x: COURT.x, y: COURT.rimY, z: hz + (i === 0 ? 0.38 : -0.38) }));
const TENNIS = { x: 64.5, z: -6.1, w: 15, d: 27.8, dw: 10.97 / 2, dl: 23.77 / 2, netY: 0.914, postY: 1.07 };
const VB = [-1, 7, -19.5, -4.5];

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
const run = (world, L, secs = 4) => { const b = newBall(world, L); for (let i = 0; i < secs * HZ && !b.rest; i++) stepBall(b); return b; };
const kinds = (b) => b.events.map((e) => e.kind);

const H = hoopsWorld(COURT, RIMS);
const rim = RIMS[0];

// 1. determinism
{
  const L = makeLaunch([48.3, 2.2, -10.1], [0.13, 6.4, -4.9], [-8, 0.5, 0], 1000);
  const a = run(H, L), b = run(H, L);
  check("the same launch gives the same flight, bit for bit", a.p.every((x, i) => x === b.p[i]) && a.n === b.n && JSON.stringify(a.events) === JSON.stringify(b.events), `${a.p.map((x) => x.toFixed(3))} / ${a.n} steps / ${a.events.length} events`);
  // advanceBall from a room clock lands on the same step count
  const c = newBall(H, L);
  advanceBall(c, 1000 + 1500);
  const d = newBall(H, L);
  for (let i = 0; i < 6; i++) advanceBall(d, 1000 + 250 * (i + 1));
  check("stepping by the room clock in pieces matches one go", c.n === d.n && c.p.every((x, i) => x === d.p[i]), `${c.n} / ${d.n}`);
}

// 2. jumpers
const shot = (from, apex, spin = [-12, 0, 0]) => {
  const L = solveShot(H, from, rim, apex, spin, 0);
  return run(H, L);
};
{
  const ft = shot([48, 2.3, rim.z + 4.6], 1.1);
  check("a solved free throw goes in", kinds(ft).includes("score"), kinds(ft).join(","));
  const deep = shot([45.5, 2.4, rim.z + 6.4], 1.6);
  check("a solved three goes in", kinds(deep).includes("score"), kinds(deep).join(","));
  const swish = ft.events.find((e) => e.kind === "score");
  check("the free throw is a swish (no rim, no board)", swish?.clean, kinds(ft).join(","));
  // short: aim the solved launch 4 % slower
  // short: the solved launch a touch slower, till it catches the front rim
  const L = solveShot(H, [48, 2.3, rim.z + 4.6], rim, 1.1, [-12, 0, 0], 0);
  let ks = [];
  for (let f = 0.995; f > 0.95; f -= 0.0025) {
    const short = run(H, { ...L, v: L.v.map((x) => x * f) });
    ks = kinds(short);
    if (ks[0] === "rim") break;
  }
  check("a short one hits the front rim first", ks[0] === "rim", ks.join(","));
  // a bank: aim at a spot on the board above the rim from the side
  let banked = false;
  for (let k = 0; k < 40 && !banked; k++) {
    const from = [44.6, 2.3, rim.z + 2.6];
    const target = { x: 48 - 0.08 - k * 0.006, y: 3.45, z: COURT.hoopZ[0] + 0.12 };
    const Lb = solveShot(H, from, target, 0.7, [-10, 0, 0], 0);
    const bb = run(H, Lb);
    if (kinds(bb).includes("board") && kinds(bb).includes("score")) banked = true;
  }
  check("off the glass and in (a bank shot exists from the wing)", banked);
}

// 3. a dribble: down hard from the hip, back up to about the hip
{
  const b = run(H, makeLaunch([48, 1.0, -4], [0, -5.2, 0], [0, 0, 0], 0), 0.6);
  const up = b.events.find((e) => e.kind === "bounce");
  let top = 0;
  const c = newBall(H, makeLaunch([48, 1.0, -4], [0, -5.2, 0], [0, 0, 0], 0));
  for (let i = 0; i < HZ * 0.6; i++) { stepBall(c); if (c.events.length) top = Math.max(top, c.p[1]); }
  check("a dribble bounces back up past the hip", up && top > 0.8, `peak ${top.toFixed(2)} m`);
}

// 4. tennis
const T = tennisWorld(TENNIS);
const base = TENNIS.z + TENNIS.dl;   // the near baseline (+z side), hitting toward −z
const tshot = (vy, vz, wx) => run(T, makeLaunch([TENNIS.x, 1.0, base - 0.3], [0, vy, vz], [wx, 0, 0], 0), 3);
const firstBounce = (b) => b.events.find((e) => e.kind === "bounce");
{
  // hitting toward −z: topspin rotates the top forward, ω along −x... for
  // v = (0, 0, −s), topspin ω = (−w, 0, 0) gives ω × v = (0, −w·s, 0): down
  // the same stroke three ways: topspin dips shorter, slice floats longer
  const bt = firstBounce(tshot(3.2, -26, -260)), bf = firstBounce(tshot(3.2, -26, 0)), bs = firstBounce(tshot(3.2, -26, 160));
  check("topspin dips in shorter than flat", bt && bf && bt.p[2] > bf.p[2], `topspin z ${bt?.p[2]}, flat z ${bf?.p[2]}`);
  check("slice floats longer than flat", bs && bf && bs.p[2] < bf.p[2], `slice z ${bs?.p[2]}`);
  // rally balls: topspin hit higher over the net, slice low
  const top = tshot(6, -26, -260), slice = tshot(2.5, -24, 160);
  const far = TENNIS.z - TENNIS.dl, bt2 = firstBounce(top), bs2 = firstBounce(slice);
  const inn = (e) => e && e.p[2] > far && e.p[2] < TENNIS.z;
  check("a topspin rally ball and a slice both land in", inn(bt2) && inn(bs2), `topspin z ${bt2?.p[2]}, slice z ${bs2?.p[2]} (in: ${far.toFixed(2)}..${TENNIS.z})`);
  // after the bounce: topspin kicks up higher than slice
  const peakAfter = (b) => { let pk = 0, seen = false; const c = newBall(T, b.launch); for (let i = 0; i < HZ * 3; i++) { stepBall(c); if (c.events.some((e) => e.kind === "bounce")) seen = true; if (seen) pk = Math.max(pk, c.p[1]); if (c.events.filter((e) => e.kind === "bounce").length > 1) break; } return pk; };
  const kt = peakAfter(top), ks = peakAfter(slice);
  check("topspin kicks up higher than slice off the bounce", kt > ks + 0.15, `${kt.toFixed(2)} vs ${ks.toFixed(2)} m`);
  const net = tshot(0.4, -22, 0);
  check("a low drive hits the net", kinds(net).includes("net"), kinds(net).join(","));
  // skim the cord: from the service line, straight at the strap
  let cord = false;
  for (let k = 0; k < 30 && !cord; k++) {
    const b = run(T, makeLaunch([TENNIS.x, 1.0, TENNIS.z + 4], [0, 0.5 + k * 0.03, -14], [0, 0, 0], 0), 2);
    if (kinds(b).includes("cord")) cord = true;
  }
  check("a ball skimming the tape clips the cord", cord);
}

// 4b. the stroke solver lands a drive, a slice and a lob on the spot
{
  const from = [TENNIS.x - 2, 1.0, base - 0.5], spot = [TENNIS.x + 2.5, 0, TENNIS.z - TENNIS.dl + 2.5];
  for (const [name, speed, spin, lob] of [["topspin", 26, [-220, 0, 0], false], ["slice", 20, [140, 0, 0], false], ["lob", 19, [-60, 0, 0], true]]) {
    const L = solveDrive(T, from, spot, speed, spin, 0, lob);
    const b = run(T, L, 4);
    const e = firstBounce(b);
    const miss = e ? Math.hypot(e.p[0] - spot[0], e.p[2] - spot[2]) : 99;
    check(`the solver lands a ${name} within 0.4 m of the spot, over the net`, miss < 0.4 && !kinds(b).slice(0, kinds(b).indexOf("bounce")).includes("net"), `off by ${miss.toFixed(2)} m, ${kinds(b).slice(0, 3)}`);
  }
}

// 5. volleyball on sand
{
  const V = vballWorld(VB);
  const b = run(V, makeLaunch([3, 3, -8], [0, -2, -1], [0, 0, 0], 0), 3);
  const first = b.events.find((e) => e.kind === "bounce");
  let pk = 0;
  const c = newBall(V, b.launch);
  let hitSand = false;
  for (let i = 0; i < HZ * 3; i++) { stepBall(c); if (c.events.length) hitSand = true; if (hitSand) pk = Math.max(pk, c.p[1]); }
  check("the sand kills the volleyball's bounce", first && pk < 0.6, `bounce peak ${pk.toFixed(2)} m`);
  check("and it comes to rest", b.rest || c.rest);
}

console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
