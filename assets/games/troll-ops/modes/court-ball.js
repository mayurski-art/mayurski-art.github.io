// Troll Forces — the court ball (Troll Beach 5d, docs/GRIN-BEACH-COURTS.md).
//
// One ball physics for the three courts: a basketball, a tennis ball, a
// volleyball. There's no server, so the ball is DETERMINISTIC FROM ITS
// LAUNCH: whoever hits it sends { p, v, w, at } (position, velocity, spin,
// room ms) and every client steps the same numbers at the same fixed rate
// from the same moment, so the swish, the rim rattle and the OUT happen the
// same way on every screen. The step uses only + - * / and Math.sqrt (no
// sin, exp or pow: those may round differently between browsers), and a
// launch is rounded to 4 dp before it's sent.
//
// A world is a court: its ground height, its boxes (backboards, fences,
// chairs), its rims (a torus each, with the hoop test), its nets (a soft
// vertical sheet with a cord on top). Events (bounce, rim, board, net,
// cord, score) carry their step index, so the sounds land together too.
//
// No imports: the node test (tools/troll-ops-court-ball-test.mjs) runs it.

export const HZ = 240;
export const DT = 1 / HZ;
const G = 9.81;

/* The balls. `k` is the drag factor (½ρ·Cd·A / m, so a = −k|v|v); `kM` the
   Magnus factor (a = kM · ω × v); `e` the bounce (ground), `mu` the skid
   friction, `I` the moment factor (I = I·m·r²: a hollow shell is ⅔). */
export const BALLS = {
  hoops:  { r: 0.12,   k: 0.0205, kM: 0.0052, e: 0.78, mu: 0.6,  I: 2 / 3, eRim: 0.55, eBoard: 0.62 },
  tennis: { r: 0.0335, k: 0.0204, kM: 0.00125, e: 0.75, mu: 0.55, I: 2 / 3, eRim: 0.5, eBoard: 0.5 },
  vball:  { r: 0.105,  k: 0.036,  kM: 0.0035, e: 0.25, mu: 0.8,  I: 2 / 3, eRim: 0.5, eBoard: 0.5 },   // sand: a dead bounce
};

/* Round a launch the way the wire carries it (4 dp), so the sender steps
   the same numbers the others will. */
export const r4 = (x) => Math.round(x * 1e4) / 1e4;
export function makeLaunch(p, v, w, at, by = "") {
  return { p: p.map(r4), v: v.map(r4), w: w.map(r4), at: Math.round(at), by };
}

/* ------------------------------------------------------------ the worlds */

/* The basketball court (maps/grinbeach-venice.js COURT, RIMS): the slab,
   the two backboards (1.8 x 1.05, 0.05 thick, faces at hoopZ), the rims
   (r 0.23, a 0.01 tube), the end fences, the poles. */
export function hoopsWorld(COURT, RIMS) {
  const C = COURT;
  const boxes = [];
  for (const [i, hz] of C.hoopZ.entries()) {
    const s = i === 0 ? 1 : -1;   // the board faces +z at the south hoop
    const z0 = Math.min(hz, hz - s * 0.05), z1 = Math.max(hz, hz - s * 0.05);
    boxes.push({ x0: C.x - 0.9, x1: C.x + 0.9, y0: 2.375, y1: 3.425, z0, z1, kind: "board", hoop: i });
    // the pole and the arm behind it: dead, like the fence
    boxes.push({ x0: C.x - 0.1, x1: C.x + 0.1, y0: 0, y1: 3.55, z0: hz - s * 1.9, z1: hz - s * 1.7, kind: "pole" });
  }
  for (const fz of [C.z - C.d / 2 - 0.2, C.z + C.d / 2 + 0.2]) {
    boxes.push({ x0: C.x - C.w / 2, x1: C.x + C.w / 2, y0: 0, y1: 3.4, z0: fz - 0.05, z1: fz + 0.05, kind: "fence" });
  }
  return {
    sport: "hoops", ball: BALLS.hoops, ground: 0.056, boxes,
    rims: RIMS.map((r, i) => ({ x: r.x, y: r.y, z: r.z, R: 0.23, t: 0.01, i })),
    nets: [], bounds: [C.x - C.w / 2 - 6, C.x + C.w / 2 + 6, C.z - C.d / 2 - 6, C.z + C.d / 2 + 6],
  };
}

/* The tennis court (TENNIS): the net across z (0.914 m at the strap, 1.07 at
   the posts, 0.914 m outside the doubles lines), the chain link round it,
   the umpire's chair. */
export function tennisWorld(T) {
  const half = T.dw + 0.914;
  const x0 = T.x - T.w / 2, x1 = T.x + T.w / 2, z0 = T.z - T.d / 2, z1 = T.z + T.d / 2;
  return {
    sport: "tennis", ball: BALLS.tennis, ground: 0.056,
    boxes: [
      { x0, x1, y0: 0, y1: 3.4, z0: z0 - 0.05, z1: z0 + 0.05, kind: "fence" },
      { x0, x1, y0: 0, y1: 3.4, z0: z1 - 0.05, z1: z1 + 0.05, kind: "fence" },
      { x0: x0 - 0.05, x1: x0 + 0.05, y0: 0, y1: 3.4, z0, z1, kind: "fence" },
      { x0: x1 - 0.05, x1: x1 + 0.05, y0: 0, y1: 3.4, z0, z1, kind: "fence" },
      { x0: T.x + T.dw + 1.1, x1: T.x + T.dw + 2.1, y0: 0, y1: 1.86, z0: T.z - 0.5, z1: T.z + 0.5, kind: "chair" },
    ],
    rims: [],
    // the net: a sheet across z at T.z from x a to b; its top sags from the
    // posts (hp) to the strap (hc) as a parabola
    nets: [{ z: T.z, a: T.x - half, b: T.x + half, hc: T.netY, hp: T.postY, y0: 0.06 }],
    bounds: [x0, x1, z0, z1],
  };
}

/* The volleyball court (VB: x0, x1, z0, z1), the net across z −12 from
   x −2 to 8, its tape at 2.36 and its bottom band at 1.48. Sand, so the
   ground is 0. */
export function vballWorld(VB) {
  return {
    sport: "vball", ball: BALLS.vball, ground: 0, boxes: [], rims: [],
    nets: [{ z: (VB[2] + VB[3]) / 2, a: -2, b: 8, hc: 2.36, hp: 2.36, y0: 1.48 }],
    bounds: [VB[0] - 8, VB[1] + 8, VB[2] - 8, VB[3] + 8],
  };
}

/* ------------------------------------------------------------- the step */

/* A ball in flight: launched at `at` (room ms) from launch.p with launch.v
   and launch.w; `n` steps taken. */
export function newBall(world, launch) {
  const L = launch;
  return {
    world, launch: L, n: 0,
    p: [L.p[0], L.p[1], L.p[2]], v: [L.v[0], L.v[1], L.v[2]], w: [L.w[0], L.w[1], L.w[2]],
    events: [], rest: false, through: -1, lastRim: -1e9, netT: 0, bounces: 0, boarded: false,
  };
}

const hyp3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

/* The net's height at x (a parabola from the posts down to the strap). */
function netTop(net, x) {
  const m = (net.a + net.b) / 2, h = (net.b - net.a) / 2;
  const u = (x - m) / h;
  return net.hc + (net.hp - net.hc) * u * u;
}

/* A bounce off a surface with normal n (unit): the normal part reverses by
   e; the contact point's slip is cut by friction (and the spin with it),
   up to rolling. The tennis ball's topspin kicks forward and its slice
   skids low out of this, as do a basketball's backspin and its "shooter's
   roll" on the rim. */
function bounce(b, n, e, mu) {
  const r = b.world.ball.r, I = b.world.ball.I;
  const v = b.v, w = b.w;
  const vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
  if (vn >= 0) return 0;
  // the contact point is at −r·n: its velocity is v + ω × (−r n)
  const cx = w[1] * -n[2] * r - w[2] * -n[1] * r;
  const cy = w[2] * -n[0] * r - w[0] * -n[2] * r;
  const cz = w[0] * -n[1] * r - w[1] * -n[0] * r;
  let ux = v[0] + cx - vn * n[0], uy = v[1] + cy - vn * n[1], uz = v[2] + cz - vn * n[2];
  const us = hyp3(ux, uy, uz);
  // the normal impulse (per unit mass) and the friction it allows
  const jn = -(1 + e) * vn;
  if (us > 1e-6) {
    // the impulse that would stop the slip entirely (rolling): |u| / (1 + 1/I)
    const jRoll = us / (1 + 1 / I);
    const jt = Math.min(mu * jn, jRoll);
    ux /= us; uy /= us; uz /= us;
    v[0] -= jt * ux; v[1] -= jt * uy; v[2] -= jt * uz;
    // the torque of −jt·u at −r·n: Δω = (−r n) × (−jt u) / (I r²) = (n × u) jt / (I r)
    const k = jt / (I * r);
    w[0] += (n[1] * uz - n[2] * uy) * k;
    w[1] += (n[2] * ux - n[0] * uz) * k;
    w[2] += (n[0] * uy - n[1] * ux) * k;
  }
  v[0] += jn * n[0]; v[1] += jn * n[1]; v[2] += jn * n[2];
  return -vn;
}

function event(b, kind, speed, extra) {
  b.events.push({ kind, n: b.n, speed: r4(speed), p: [r4(b.p[0]), r4(b.p[1]), r4(b.p[2])], ...extra });
}

/* One fixed step. */
export function stepBall(b) {
  if (b.rest) return;
  const W = b.world, B = W.ball, p = b.p, v = b.v, w = b.w, r = B.r;
  b.n++;
  // forces: gravity, drag, Magnus
  const s = hyp3(v[0], v[1], v[2]);
  const ax = -B.k * s * v[0] + B.kM * (w[1] * v[2] - w[2] * v[1]);
  const ay = -G - B.k * s * v[1] + B.kM * (w[2] * v[0] - w[0] * v[2]);
  const az = -B.k * s * v[2] + B.kM * (w[0] * v[1] - w[1] * v[0]);
  v[0] += ax * DT; v[1] += ay * DT; v[2] += az * DT;
  // spin decays slowly in the air (0.25 %/s at 240 Hz ≈ 1 − 1e−5 a step)
  w[0] *= 0.99999; w[1] *= 0.99999; w[2] *= 0.99999;
  const py = p[1], pz = p[2];
  p[0] += v[0] * DT; p[1] += v[1] * DT; p[2] += v[2] * DT;

  // the hoop: the centre passes down through the rim's disc
  for (const R of W.rims) {
    if (py >= R.y && p[1] < R.y) {
      const dx = p[0] - R.x, dz = p[2] - R.z;
      if (dx * dx + dz * dz < R.R * R.R && b.through < 0) {
        b.through = R.i; b.netT = 0.35;
        event(b, "score", s, { hoop: R.i, clean: b.lastRim < b.n - HZ * 1.5 && !b.boarded });
      }
    }
    // the rim: a torus; the nearest point on its centre circle
    const dx = p[0] - R.x, dz = p[2] - R.z, dh = Math.sqrt(dx * dx + dz * dz);
    if (dh < 1e-6) continue;
    const qx = R.x + dx / dh * R.R, qz = R.z + dz / dh * R.R;
    const ex = p[0] - qx, ey = p[1] - R.y, ez = p[2] - qz, d = hyp3(ex, ey, ez);
    const lim = r + R.t;
    if (d < lim && d > 1e-6) {
      const n = [ex / d, ey / d, ez / d];
      p[0] += n[0] * (lim - d); p[1] += n[1] * (lim - d); p[2] += n[2] * (lim - d);
      const hit = bounce(b, n, B.eRim, 0.35);
      if (hit > 0.4 && b.n - b.lastRim > HZ * 0.06) event(b, "rim", hit, { hoop: R.i });
      b.lastRim = b.n;
    }
  }
  // the net under a made basket: a cloth cone (0.23 m at the rim, 0.14 at
  // its foot 0.42 below) holds the ball in and drags it, so it drops
  // straight out of the bottom
  if (b.netT > 0) {
    b.netT -= DT;
    const R = W.rims[b.through];
    const u = (R.y - p[1]) / 0.42;
    if (u >= 0 && u <= 1) {
      const dx = p[0] - R.x, dz = p[2] - R.z, d = Math.sqrt(dx * dx + dz * dz);
      const room = Math.max(0.01, 0.23 - 0.09 * u - r * 0.55);
      if (d > room) {
        p[0] = R.x + dx / d * room; p[2] = R.z + dz / d * room;
        const out = (v[0] * dx + v[2] * dz) / d;
        if (out > 0) { v[0] -= dx / d * out * 1.3; v[2] -= dz / d * out * 1.3; }
      }
      const k = 1 - 9 * DT;
      v[0] *= k; v[2] *= k;
      if (v[1] < -2) v[1] *= 1 - 5 * DT;
    }
  }

  // boxes: closest point on the box, push out, bounce
  for (const X of W.boxes) {
    const cx = p[0] < X.x0 ? X.x0 : p[0] > X.x1 ? X.x1 : p[0];
    const cy = p[1] < X.y0 ? X.y0 : p[1] > X.y1 ? X.y1 : p[1];
    const cz = p[2] < X.z0 ? X.z0 : p[2] > X.z1 ? X.z1 : p[2];
    const ex = p[0] - cx, ey = p[1] - cy, ez = p[2] - cz, d = hyp3(ex, ey, ez);
    if (d >= r) continue;
    let n;
    if (d > 1e-6) n = [ex / d, ey / d, ez / d];
    else {
      // centre inside: out the nearest face
      const f = [[p[0] - X.x0, [-1, 0, 0]], [X.x1 - p[0], [1, 0, 0]], [p[1] - X.y0, [0, -1, 0]], [X.y1 - p[1], [0, 1, 0]], [p[2] - X.z0, [0, 0, -1]], [X.z1 - p[2], [0, 0, 1]]];
      f.sort((a, c) => a[0] - c[0]);
      n = f[0][1];
    }
    const pen = r - d;
    p[0] += n[0] * pen; p[1] += n[1] * pen; p[2] += n[2] * pen;
    const e = X.kind === "board" ? B.eBoard : X.kind === "fence" ? 0.25 : 0.45;
    const hit = bounce(b, n, e, X.kind === "fence" ? 0.9 : 0.4);
    if (hit > 0.4) event(b, X.kind, hit, X.hoop != null ? { hoop: X.hoop } : undefined);
    if (X.kind === "board") b.boarded = true;
  }

  // nets: a soft sheet; within a ball of the top, the cord
  for (const N of W.nets) {
    const crossed = (pz - N.z) * (p[2] - N.z) <= 0 && pz !== p[2];
    if (!crossed || p[0] < N.a || p[0] > N.b) continue;
    const top = netTop(N, p[0]);
    if (p[1] - r > top || p[1] + r < N.y0) continue;   // clear over it (or, volleyball, under the band)
    if (p[1] > top - r * 0.6) {
      // the cord: it takes most of the pace and pops it up; it can trickle over
      const sp = Math.abs(v[2]);
      v[2] *= 0.28; v[0] *= 0.6;
      v[1] = Math.abs(v[1]) * 0.3 + sp * 0.12;
      event(b, "cord", sp);
    } else {
      // into the sheet: it gives, and drops the ball on this side
      const sp = Math.abs(v[2]);
      p[2] = pz;
      v[2] = -v[2] * 0.08; v[0] *= 0.3; v[1] *= 0.3;
      w[0] *= 0.2; w[1] *= 0.2; w[2] *= 0.2;
      event(b, "net", sp);
    }
  }

  // the ground
  const gy = W.ground + r;
  if (p[1] < gy) {
    p[1] = gy;
    const vy = -v[1];
    const hit = bounce(b, [0, 1, 0], B.e * (vy < 1.2 ? 0.6 : 1), B.mu);
    if (hit > 0.35) { b.bounces++; event(b, "bounce", hit); }
    // rolling to rest
    if (Math.abs(v[1]) < 0.35) {
      v[1] = 0;
      const k = 1 - (W.sport === "vball" ? 3 : 0.6) * DT;
      v[0] *= k; v[2] *= k; w[0] *= k; w[1] *= k; w[2] *= k;
      if (v[0] * v[0] + v[2] * v[2] < 0.0025) { b.rest = true; event(b, "rest", 0); }
    }
  }
  // far out of the court: dead
  const bd = W.bounds;
  if (p[0] < bd[0] || p[0] > bd[1] || p[2] < bd[2] || p[2] > bd[3]) {
    if (!b.rest) { b.rest = true; event(b, "dead", s); }
  }
}

/* Step a ball up to room time `now` (ms); at most `maxSteps` at a time (a
   late joiner catches up over a few frames). Returns the events that fired. */
export function advanceBall(b, now, maxSteps = HZ * 4) {
  const target = Math.floor((now - b.launch.at) / 1000 * HZ);
  const from = b.events.length;
  let k = 0;
  while (b.n < target && !b.rest && k++ < maxSteps) stepBall(b);
  return b.events.slice(from);
}

/* Where the ball will be after `secs` (a prediction from its current state:
   NPCs and aim use it). Doesn't touch the ball. */
export function predict(b, secs, until) {
  const c = { ...b, p: [...b.p], v: [...b.v], w: [...b.w], events: [], rest: b.rest };
  const out = [];
  const steps = Math.floor(secs * HZ);
  for (let i = 0; i < steps && !c.rest; i++) {
    stepBall(c);
    if (until && until(c)) break;
    if (i % 6 === 0) out.push([c.p[0], c.p[1], c.p[2], (i + 1) * DT]);
  }
  return { ball: c, path: out };
}

/* ------------------------------------------------------------ launches */

/* The velocity that puts a ball from p through `target` at the top of an
   arc `apex` metres above the higher of the two (ignoring drag; the shot
   code corrects for it with a few predict() passes). */
export function arcTo(p, target, apex) {
  const top = Math.max(p[1], target[1]) + apex;
  const vy = Math.sqrt(2 * G * (top - p[1]));
  const tUp = vy / G, tDown = Math.sqrt(2 * (top - target[1]) / G);
  const t = tUp + tDown;
  return [(target[0] - p[0]) / t, vy, (target[2] - p[2]) / t, t];
}

/* A shot at the hoop that goes in: arcTo the rim's centre, then nudged by
   simulation until the ball's centre crosses the rim plane within `tol` of
   the centre (drag and the release height make plain arcTo come up short). */
export function solveShot(world, p, rim, apex, spin, at) {
  let aim = [rim.x, rim.y, rim.z];
  let best = null;
  for (let it = 0; it < 6; it++) {
    const [vx, vy, vz] = arcTo(p, aim, apex);
    const L = makeLaunch(p, [vx, vy, vz], spin, at);
    const b = newBall({ ...world, rims: [], boxes: [], nets: [] }, L);
    let prevY = b.p[1], hit = null;
    for (let i = 0; i < HZ * 4; i++) {
      stepBall(b);
      if (prevY >= rim.y && b.p[1] < rim.y && b.v[1] < 0) { hit = [b.p[0], b.p[2]]; break; }
      prevY = b.p[1];
      if (b.rest) break;
    }
    best = L;
    if (!hit) { aim = [aim[0], aim[1] + 0.3, aim[2]]; continue; }
    const ex = hit[0] - rim.x, ez = hit[1] - rim.z;
    if (ex * ex + ez * ez < 0.0004) break;
    aim = [aim[0] - ex, aim[1], aim[2] - ez];
  }
  return best;
}
