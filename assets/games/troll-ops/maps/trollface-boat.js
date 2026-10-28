// Troll Forces — the Boat on Trollface Island sails round the lake (user,
// 2026-10-26: "The boat should actually continue to sail in a circular
// pattern ... Around the whole body of lake"; arched spans over its channel
// on the two boardwalks, the mast folding under them, rideable).
//
// The loop: a closed curve through BOAT_LOOP (Catmull-Rom), the north leg
// west to east at z 15, the south leg back at z 48, a turn of ~12 m at each
// end; the hull stays 3 m or more off the shore all the way. It crosses the
// boardwalks square at BOAT_ARCHES, where models/tf_roads.py raises an arch
// over an 11 m channel (the builder reads them from the layout). The Boat
// starts each match by where it was built ((99.9, 16.3): the loop passes 1.3 m
// north of it), heading east, and sails
// on Royale's clock (modes/royale-boat.js), so every screen has it in the
// same place.
//
// Its colliders are the build's (TF_BUILT.boat), cut into pieces of 1.5 m or
// less: an axis-aligned box only fits a turned hull when it is small. Every
// frame the pieces are put where the hull is (as maps/train.js does a car's)
// and flagged `moving`, so the scans made once at the start (the bots' grid,
// the stairs, the minimap, the loot and chest spots) leave them out. The
// models ride one group: the hull, the figurehead, and the rig, which folds
// for an arch (tf_lake.py RIG_GLBS): the sail furls onto the boom, the boom
// drops onto the wheelhouse roof, the mast swings aft about its tabernacle.
import * as THREE from "three";
import { loadModel } from "./battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2";
import { RETEXTURE } from "./map-models.js?v=hg6e-sr1-or1-tx1-sp1-kbt1-gb1-kbb2-kbs1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-hgb2";

export const BOAT_LOOP = [[-32, 15], [-14, 15], [-4.79, 15], [4, 15], [30, 17], [66, 15], [77.79, 15], [88, 15], [104, 15],
  [118, 15], [125.5, 17.2], [131, 23.25], [133, 31.5], [131, 39.75], [125.5, 45.8], [118, 48], [100, 48], [80.75, 48],
  [70, 48], [40, 48], [10, 48], [-2.83, 48], [-14, 48], [-32, 48], [-39, 45.8], [-44.1, 39.75], [-46, 31.5],
  [-44.1, 23.25], [-39, 17.2]];

// where the loop crosses the boardwalks (the legs square across them): the
// arches' centres
export const BOAT_ARCHES = [[-4.79, 15], [77.79, 15], [80.75, 48], [-2.83, 48]];

export const BOAT_SPEED = 3.5;      // m/s along the loop (~2 minutes a lap)
const PIECE = 1.5;                  // the longest side of a collider piece

// models/tf_lake.py: the deck, the hold, the hull's plan (nose +x), the rig
export const BOAT_DECK = 2.7;
export const BOAT_HOLD = 0.55;
const PLAN = [[-8.5, -2.9], [-6.0, -3.2], [5.5, -3.2], [8.5, -2.8], [10.6, -1.9], [12.1, -0.95], [12.9, 0.0],
  [12.1, 0.95], [10.6, 1.9], [8.5, 2.8], [5.5, 3.2], [-6.0, 3.2], [-8.5, 2.9]];
const MAST_X = 8.2, PIVOT_Y = BOAT_DECK + 3.0, BOOM_Y = BOAT_DECK + 4.6;
const ROOF_Y = BOAT_DECK + 2.3 + 0.14 + 0.12;     // the boom's rest on the wheelhouse roof
const RIG_SPAN = [-5.8, 8.6];       // local x the rig covers, folded (the mast laid aft) or up
const ARCH_HALF = 1.6;              // an arch's deck and rails along the loop, each side of its centre
const FOLD_RUN = 14;                // m of loop to fold in (and to stand up again)
const FOLD_MARGIN = 3;              // folded this far either side of the arch

/* The loop, sampled every half metre by length: at(s) is the point and the
   heading (the way of travel) `s` metres round it. */
function samplePath(cp) {
  const pts = [], n = cp.length;
  for (let i = 0; i < n; i++) {
    const p0 = cp[(i - 1 + n) % n], p1 = cp[i], p2 = cp[(i + 1) % n], p3 = cp[(i + 2) % n];
    const k = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.5));
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  const len = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1], b = pts[i % pts.length];
    len.push(len[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = len[pts.length];
  const at = (s, out = {}) => {
    s = ((s % total) + total) % total;
    let lo = 0, hi = pts.length;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (len[m] <= s) lo = m; else hi = m; }
    const a = pts[lo], b = pts[(lo + 1) % pts.length], u = (s - len[lo]) / ((len[lo + 1] - len[lo]) || 1);
    out.x = a[0] + (b[0] - a[0]) * u;
    out.z = a[1] + (b[1] - a[1]) * u;
    out.heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return out;
  };
  const nearest = (x, z) => {
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = i; } });
    return len[best];
  };
  return { at, nearest, total };
}

/* Inside the hull's plan (boat-local x, z)? */
export function inHull(lx, lz, pad = 0) {
  let c = false;
  for (let i = 0, j = PLAN.length - 1; i < PLAN.length; j = i++) {
    const [xi, zi] = PLAN[i], [xj, zj] = PLAN[j];
    if ((zi > lz) !== (zj > lz) && lx < ((xj - xi) * (lz - zi)) / (zj - zi) + xi) c = !c;
  }
  if (!c || pad <= 0) return c;
  return inHull(lx + pad, lz) && inHull(lx - pad, lz) && inHull(lx, lz + pad) && inHull(lx, lz - pad);
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Boat {
  /* `origin`: where it was built (LANDMARKS.boat); `boxes`: its colliders
     [x, z, w, d, h, y, pen] in map metres (TF_BUILT.boat.colliders). */
  constructor(root, mapApi, origin, boxes) {
    this.origin = { x: origin.x, z: origin.z };
    this.path = samplePath(BOAT_LOOP);
    this.start = this.path.nearest(origin.x, origin.z);
    this.arches = BOAT_ARCHES.map(([x, z]) => this.path.nearest(x, z));
    this.pose = { x: origin.x, z: origin.z, ry: 0, s: NaN };   // laid on the loop by the first update
    this.prev = { ...this.pose };
    this.fold = 0;
    this.group = new THREE.Group();
    this.group.position.set(origin.x, 0, origin.z);
    root.add(this.group);
    // the colliders, in pieces, boat-local
    this.pieces = [];
    for (const [bx, bz, w, d, h, y, pen] of boxes) {
      const nx = Math.ceil(w / PIECE - 1e-6), nz = Math.ceil(d / PIECE - 1e-6);
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const pw = w / nx, pd = d / nz;
          const lx = bx - origin.x - w / 2 + pw * (i + 0.5), lz = bz - origin.z - d / 2 + pd * (j + 0.5);
          const c = mapApi.ghostBox(origin.x + lx, origin.z + lz, pw, pd, h, { y, pen });
          if (!c) continue;
          c.moving = true;
          this.pieces.push({ c, x: lx, z: lz, w: pw, d: pd, y, h });
        }
      }
    }
    // the models: the hull and the figurehead in the boat's frame, the rig
    // on pivots of its own
    const local = (o) => { o.position.set(0, 0, 0); return o; };
    loadModel("tf-boat-p3", RETEXTURE).then((o) => this.group.add(local(o)));
    loadModel("tf-boatface", RETEXTURE).then((o) => this.group.add(local(o)));
    this.mast = new THREE.Group();      // turns about the tabernacle's top
    this.mast.position.set(MAST_X, PIVOT_Y, 0);
    this.boom = new THREE.Group();      // drops onto the wheelhouse roof
    this.sail = new THREE.Group();      // furls onto the boom
    this.sail.position.set(0, BOOM_Y, 0);
    this.boom.add(this.sail);
    this.group.add(this.mast, this.boom);
    loadModel("tf-boatmast-p3", RETEXTURE).then((o) => { o.position.set(-MAST_X, -PIVOT_Y, 0); this.mast.add(o); });
    loadModel("tf-boatboom-p3", RETEXTURE).then((o) => this.boom.add(local(o)));
    loadModel("tf-boatsail-p3", RETEXTURE).then((o) => { o.position.set(0, -BOOM_Y, 0); this.sail.add(o); });
  }

  /* Seconds since the match went live -> the Boat's place on the loop. It
     gets under way over its first few seconds. */
  distanceAt(t) {
    const tau = 2.5;
    return this.start + BOAT_SPEED * Math.max(0, t - tau * (1 - Math.exp(-Math.max(0, t) / tau)));
  }

  /* Puts the Boat where it is at `t`; false when it hasn't moved. */
  update(t) {
    if (this.hold != null) t = this.hold;   // a test can pin it (map-walk walks aboard at its mooring)
    const s = this.distanceAt(t);
    if (s === this.pose.s) return false;
    const p = this.path.at(s);
    Object.assign(this.prev, this.pose);
    // the nose (local +x) along the way of travel: three's ry turns +x to (cos ry, -sin ry)
    Object.assign(this.pose, { x: p.x, z: p.z, ry: -p.heading, s });
    this.group.position.set(p.x, 0, p.z);
    this.group.rotation.y = this.pose.ry;
    const cs = Math.cos(this.pose.ry), sn = Math.sin(this.pose.ry), ac = Math.abs(cs), as = Math.abs(sn);
    for (const b of this.pieces) {
      const wx = p.x + b.x * cs + b.z * sn, wz = p.z - b.x * sn + b.z * cs;
      const ex = (ac * b.w + as * b.d) / 2, ez = (as * b.w + ac * b.d) / 2;
      b.c.min.set(wx - ex, b.y, wz - ez);
      b.c.max.set(wx + ex, b.y + b.h, wz + ez);
    }
    this.setFold(this.foldAt(s));
    return true;
  }

  /* 0 = sailing, 1 = folded: folded while any of the rig is under an arch
     (with a margin), and over FOLD_RUN metres either side. */
  foldAt(s) {
    let f = 0;
    const L = this.path.total;
    for (const a of this.arches) {
      // the arch's centre in rig terms: how far ahead of the boat's origin it is
      let d = ((a - s) % L + L) % L;
      if (d > L / 2) d -= L;
      // folded while d is within [RIG_SPAN[0] - ARCH_HALF - FOLD_MARGIN, RIG_SPAN[1] + ARCH_HALF + FOLD_MARGIN]
      const lo = RIG_SPAN[0] - ARCH_HALF - FOLD_MARGIN, hi = RIG_SPAN[1] + ARCH_HALF + FOLD_MARGIN;
      f = Math.max(f, smooth(hi + FOLD_RUN, hi, d) * smooth(lo - FOLD_RUN, lo, d));
    }
    return f;
  }

  setFold(f) {
    if (f === this.fold) return;
    this.fold = f;
    const furl = smooth(0, 0.3, f), drop = smooth(0.25, 0.55, f), lay = smooth(0.5, 1, f);
    this.sail.scale.y = Math.max(0.03, 1 - furl);
    this.sail.visible = furl < 0.99;
    this.boom.position.y = (ROOF_Y - BOOM_Y) * drop;
    this.mast.rotation.z = Math.PI / 2 * lay;   // the top swings aft (-x)
  }

  /* A world point in the Boat's frame, at its pose (or the one before). */
  static toLocal(pose, x, z) {
    const dx = x - pose.x, dz = z - pose.z, cs = Math.cos(pose.ry), sn = Math.sin(pose.ry);
    return { x: dx * cs - dz * sn, z: dx * sn + dz * cs };
  }
  static toWorld(pose, lx, lz) {
    const cs = Math.cos(pose.ry), sn = Math.sin(pose.ry);
    return { x: pose.x + lx * cs + lz * sn, z: pose.z - lx * sn + lz * cs };
  }

  /* Aboard: in the hull's plan at the pose before, from the hold floor up. */
  aboard(x, y, z, pose = this.prev) {
    if (y < BOAT_HOLD - 0.15 || y > BOAT_DECK + 8) return null;
    const l = Boat.toLocal(pose, x, z);
    return inHull(l.x, l.z) ? l : null;
  }
}
