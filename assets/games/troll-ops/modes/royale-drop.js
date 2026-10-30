// Troll Forces — Troll Royale's opening: the C-130 drop (PLANES.md).
//
//   1. Aboard: the countdown's 90 s, in the hold of your plane. Twelve
//      C-130s fly in from all round, circle the island and break onto their
//      drop runs (royale-planes.js); you walk the hold (royale-hold.js).
//      Everything about the planes comes from the match seed and the clock,
//      so every client agrees without it going over the wire.
//   2. Run: at 0:00 the ramp lowers and the light goes green. Walk off the
//      ramp (or Space runs you out); past the far coast you're put out.
//   3. Drop: pure freefall, steered with the camera (look down to dive),
//      onto the island. No glider: you land with a roll and no damage.
//
// modes/royale.js owns the rules (who is where, the clock, damage). This
// file owns the drop's clock, the squadron and the flight physics. The
// paraglider build is still here (remote-players.js draws it for the wire's
// glide code) but nothing opens one any more.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clampInsidePolygon } from "../maps/edge.js?v=or1";
import { Squadron, PLANES } from "./royale-planes.js?v=pl1-pl2-pi1-sr1-fl1-or1-dc2-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-rb4-hp1-bx1-mg1-tx1-sp1-kbt1-gb1-pm1-kbk2-zw1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-hd1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416";

export const DROP = {
  enabled: true,        // tests switch it off to start on the ground, as before
  lobbySeconds: 90,
  ghostY: 2000,         // the ghost hold's floor: far above anything that falls, inside the coast
  fallSpeed: 42,        // freefall, m/s down
  diveSpeed: 60,        // looking down with W held
  fallSteer: 17,        // m/s sideways in freefall
  // You, Fortnite-style (user, 2026-10-13: "land where they want to"): push
  // forward with the camera level and you fly, faster than you fall, so the
  // whole island is in reach from the box (it was ~115 m at 17 m/s).
  trackSpeed: 34,       // m/s forward, stick forward, camera level
  trackFall: 32,        // m/s down while you fly forward like that
  backSteer: 10,        // m/s, stick back: brake over one spot
  edgePad: 12,          // fallers are kept this far inside the island edge
  // The glider (unused: Flight never opens one unless asked).
  glideSink: 6.5,       // m/s down under the glider
  glideSpeed: 15,       // m/s forward under the glider
  glideBrake: 7,        // m/s forward holding S
  autoOpen: 32,         // metres above the ground the glider opens by itself
  openBelow: 150,       // a second jump opens it early below this height
};

/* ---- shared art ----------------------------------------------------------- */

let faceTex = null;
function trollfaceTexture() {
  if (faceTex) return faceTex;
  faceTex = new THREE.TextureLoader().load(new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  return faceTex;
}
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o });

/* The trollface paraglider: a ram-air wing arched over the rider. Each cell
   is an airfoil (round open nose, thin tail) with a seam between cells, the
   panels alternating white and pearl, green wingtips, a black nose with the
   cell mouths. The trollface is PRINTED on the canopy: a skin that follows
   the curved top (head to the nose: upright to everyone behind you) and the
   underside (head to the tail: upright to the rider looking up). Lines
   cascade from the underside to two risers at the harness. Origin = the
   harness; the nose points -z. */
const GLIDE = { span: 7.4, chord: 2.6, rise: 3.6, arc: 2.1, cells: 18, sub: 2, rows: 10 };
const glideArch = (t) => {
  const a = (t - 0.5) * GLIDE.arc;
  return { x: Math.sin(a) * GLIDE.span / 2, y: GLIDE.rise + Math.cos(a) * 1.4 - 1.4, nx: Math.sin(a), ny: Math.cos(a) };
};
const glideTaper = (t) => 0.55 + 0.45 * Math.sin(Math.PI * t);
/* Height off the arch at chord fraction u (0 nose, 1 tail): top and bottom skins. */
const glideFoil = (u) => {
  const top = 0.36 * Math.pow(1 - u, 1.3) * Math.min(1, 0.35 + u * 4) + 0.025;
  const bot = -0.09 * Math.sin(Math.PI * Math.min(1, u * 1.25));
  return { top, bot };
};
/* A point on the canopy: span t, chord u, skin side (+1 top, -1 bottom), lifted `out` metres. */
function glidePoint(t, u, side, out = 0, bulge = 0) {
  const p = glideArch(t), k = glideTaper(t), f = glideFoil(u);
  const h = (side > 0 ? f.top + bulge : f.bot) * k + out * side;
  const z = (-0.5 + u) * GLIDE.chord * (0.72 + 0.28 * k);
  return [p.x + p.nx * h, p.y + p.ny * h, z];
}

export function buildParaglider() {
  const g = new THREE.Group();
  const { cells, sub, rows } = GLIDE;
  // Canopy: one indexed patch per cell (shared verts inside a cell, none
  // across cells), so each cell shades round and the seams stay crisp.
  const pos = [], col = [], idx = [];
  const C = (hex) => new THREE.Color(hex);
  const WHITE = C(0xf7f7f3), PEARL = C(0xe2e6ea), GREEN = C(0x55cf4c), INK = C(0x141416), UNDER = C(0xd9dde2);
  for (let c = 0; c < cells; c++) {
    const tip = c === 0 || c === cells - 1;
    const panel = tip ? GREEN : (c % 2 ? PEARL : WHITE);
    for (const side of [1, -1]) {
      const base = pos.length / 3;
      for (let s = 0; s <= sub; s++) {
        const t = (c + s / sub) / cells;
        const bulge = s === 0 || s === sub ? 0 : 0.035;   // cells puff between the ribs
        for (let r = 0; r <= rows; r++) {
          const u = r / rows;
          pos.push(...glidePoint(t, u, side, 0, bulge));
          const k = side > 0 ? (r === 0 ? INK : panel) : (tip ? GREEN : UNDER);
          col.push(k.r, k.g, k.b);
        }
      }
      for (let s = 0; s < sub; s++) {
        for (let r = 0; r < rows; r++) {
          const a = base + s * (rows + 1) + r, b = a + rows + 1;
          if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
          else idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
  }
  // The nose (dark cell mouths), the tail edge, the two tip caps.
  const strip = (pairs) => {
    const base = pos.length / 3;
    for (const [p, q] of pairs) { pos.push(...p, ...q); col.push(INK.r, INK.g, INK.b, INK.r, INK.g, INK.b); }
    for (let i = 0; i < pairs.length - 1; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  };
  const steps = cells * sub;
  for (const u of [0, 1]) {
    const pairs = [];
    for (let i = 0; i <= steps; i++) pairs.push(u === 0 ? [glidePoint(i / steps, 0, -1), glidePoint(i / steps, 0, 1)] : [glidePoint(i / steps, 1, 1), glidePoint(i / steps, 1, -1)]);
    strip(pairs);
  }
  for (const t of [0, 1]) {
    const pairs = [];
    for (let r = 0; r <= rows; r++) pairs.push(t === 0 ? [glidePoint(0, r / rows, 1), glidePoint(0, r / rows, -1)] : [glidePoint(1, r / rows, -1), glidePoint(1, r / rows, 1)]);
    strip(pairs);
  }
  const canopy = new THREE.BufferGeometry();
  canopy.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  canopy.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  canopy.setIndex(idx);
  canopy.computeVertexNormals();
  g.add(new THREE.Mesh(canopy, mat(0xffffff, { vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide, emissive: 0x2a2a2a })));

  // The printed trollface: skins over the middle cells, a hair off the
  // canopy, UVs across the span and down the chord. The image is 800 x 730.
  const faceH = 0.9, faceW = (GLIDE.chord * 0.86 * faceH) * (800 / 730);
  const arcLen = GLIDE.arc * GLIDE.span / 2;
  const t0 = 0.5 - faceW / arcLen / 2, t1 = 0.5 + faceW / arcLen / 2;
  const u0 = 0.06, u1 = u0 + faceH;
  const skin = (side) => {
    const P = [], UV = [], I = [], NS = 24, NR = 12;
    for (let s = 0; s <= NS; s++) {
      const t = t0 + (t1 - t0) * (s / NS);
      for (let r = 0; r <= NR; r++) {
        const u = u0 + (u1 - u0) * (r / NR);
        P.push(...glidePoint(t, u, side, 0.02, side > 0 ? 0.035 * Math.sin(Math.PI * ((t * GLIDE.cells) % 1)) : 0));
        // On top the head points to the nose (upright seen from behind); underneath
        // it points to the tail, which is "up" for the rider looking up at it.
        UV.push(s / NS, side > 0 ? 1 - r / NR : r / NR);
      }
    }
    for (let s = 0; s < NS; s++) {
      for (let r = 0; r < NR; r++) {
        const a = s * (NR + 1) + r, b = a + NR + 1;
        if (side > 0) I.push(a, b, a + 1, b, b + 1, a + 1); else I.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
    geo.setIndex(I);
    geo.computeVertexNormals();
    return geo;
  };
  const faceMat = mat(0xffffff, { map: trollfaceTexture(), transparent: true, alphaTest: 0.4, roughness: 0.8, metalness: 0, side: THREE.DoubleSide, emissive: 0x2a2a2a,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const faceGeo = mergeGeometries([skin(1), skin(-1)]);
  g.add(new THREE.Mesh(faceGeo, faceMat));

  // Lines: A/B/C rows off the underside of every other rib, gathered to
  // two risers just over the shoulders, then down to the harness.
  const lineMat = new THREE.LineBasicMaterial({ color: 0x2a2a2e });
  const linePts = [];
  const riser = (sx) => new THREE.Vector3(sx * 0.32, 1.0, 0);
  for (let i = 0; i <= cells; i += 2) {
    const t = i / cells, sx = t < 0.5 ? -1 : 1;
    for (const u of [0.12, 0.45, 0.8]) {
      const [x, y, z] = glidePoint(t, u, -1);
      const mid = new THREE.Vector3(x * 0.55 + sx * 0.32 * 0.45, y * 0.5 + 1.0 * 0.5 + 0.4, z * 0.4);
      linePts.push(new THREE.Vector3(x, y, z), mid, mid, riser(sx));
    }
  }
  for (const sx of [-1, 1]) linePts.push(riser(sx), new THREE.Vector3(sx * 0.22, 0, 0));
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts), lineMat));
  return g;
}

/* Everyone else's glider: clones of one shared build (geometry and
   materials shared, so never dispose what this returns; just remove it). */
let gliderTemplate = null;
export function sharedParaglider() {
  if (!gliderTemplate) gliderTemplate = buildParaglider();
  return gliderTemplate.clone();
}

/* ---- the drop ------------------------------------------------------------- */

export class RoyaleDrop {
  /* `ctx`: { scene, colliders, edge (island outline or null), bounds }. */
  constructor(ctx, seed) {
    this.ctx = ctx;
    this.seed = seed;
    this.phase = "lobby";           // lobby (aboard, the countdown) -> run (green) -> done
    this.runT = 0;                  // seconds since the green light
    const b = ctx.bounds;
    this.centre = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
    // The ghost hold: the ridden plane's colliders, parked high over the
    // middle (inside the coast, which movement holds everyone to).
    this.origin = new THREE.Vector3(this.centre.x, DROP.ghostY, this.centre.z);
    this.squadron = new Squadron({ scene: ctx.scene, colliders: ctx.colliders, edge: ctx.edge, centre: this.centre }, seed);
  }

  /* The drop clock: the countdown's -90 .. 0, then seconds since the green. */
  clock(stageT) { return this.phase === "lobby" ? -Math.max(0, stageT) : this.runT; }

  /* Board flight `plane`: its hold is built round the ghost colliders. */
  ride(plane) { return this.squadron.ride(plane, this.origin); }
  get hold() { return this.squadron.hold; }

  /* 0:00: green. */
  open() {
    if (this.phase !== "lobby") return;
    this.phase = "run";
    this.runT = 0;
  }

  /* Ticks the squadron; returns the drop clock. */
  update(dt, stageT) {
    if (this.phase === "run") this.runT += dt;
    const t = this.clock(stageT);
    if (this.phase === "done") return t;
    this.squadron.update(t, dt);
    if (this.phase === "run" && t > PLANES.gone) { this.phase = "done"; this.squadron.dispose(); }
    return t;
  }

  dispose() {
    this.squadron.dispose();
    this.phase = "done";
  }
}

/* One flier (you, or a bot): freefall to the ground, landed. The caller
   feeds input and moves its own position from `pos`. `opts.glider` (off by
   default) brings the old paraglider back: fall -> glide -> landed. `opts.vel`
   is the speed you left the edge with. */
export class Flight {
  constructor(pos, edge, opts = {}) {
    this.pos = pos.clone();
    this.vel = opts.vel ? opts.vel.clone() : new THREE.Vector3(0, -8, 0);
    if (this.vel.y > -2) this.vel.y = -2;
    this.state = "fall";   // fall -> (glide ->) landed
    this.edge = edge;
    this.glider = !!opts.glider;
    this.steer = opts.steer || DROP.fallSteer;   // m/s sideways in freefall (bots: royale.js BOT_FALL_STEER)
    this.track = !!opts.track;   // you: stick forward flies (DROP.trackSpeed)
    this.heading = 0;      // glide heading (yaw), set on opening
  }

  /* `input`: { forward, strafe, yaw, pitch, open, coast } (forward/strafe -1..1).
     `groundAt(x, z, fromY)`: the ground height under a point. */
  update(dt, input, groundAt) {
    if (this.state === "landed") return;
    const ground = groundAt(this.pos.x, this.pos.z, this.pos.y) ?? 0;
    const height = this.pos.y - ground;
    this.height = height;   // read by the fall camera (royale-fall.js)
    const fx = -Math.sin(input.yaw), fz = -Math.cos(input.yaw);   // where you look
    const rx = Math.cos(input.yaw), rz = -Math.sin(input.yaw);

    if (this.state === "fall") {
      if (this.glider && (height < DROP.autoOpen || (input.open && height < DROP.openBelow))) {
        this.state = "glide";
        this.heading = input.yaw;
        this.vel.y = Math.max(this.vel.y, -DROP.glideSink * 2);
      } else {
        // Look down and hold W to dive.
        const dive = input.forward > 0 && input.pitch < -0.6;
        // Flying (you): the more level the camera, the more of the push goes
        // forward instead of down; looking down turns it back into a dive.
        const level = this.track && input.forward > 0 ? input.forward * (1 - Math.min(1, Math.max(0, (-input.pitch - 0.2) / 0.5))) : 0;
        const fall = DROP.fallSpeed + (DROP.trackFall - DROP.fallSpeed) * level;
        const targetY = -(dive ? DROP.diveSpeed : fall);
        // Just out of the plane (the drop cinematic's fall, `input.coast`):
        // the speed builds as off a real exit, not in a second or two, so
        // the show doesn't spend the height you'd fly with.
        this.vel.y += (targetY - this.vel.y) * Math.min(1, dt * (input.coast ? 0.25 : 1.6));
        const fwd = input.forward < 0 && this.track ? input.forward * DROP.backSteer
          : input.forward * this.steer + level * (DROP.trackSpeed - this.steer);
        const hx = fx * fwd + rx * input.strafe * this.steer;
        const hz = fz * fwd + rz * input.strafe * this.steer;
        this.vel.x += (hx - this.vel.x) * Math.min(1, dt * 2.5);
        this.vel.z += (hz - this.vel.z) * Math.min(1, dt * 2.5);
      }
    }
    if (this.state === "glide") {
      // The glider turns toward where you look; S slows it, W speeds it.
      let d = input.yaw - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, dt * 1.8);
      const speed = input.forward < -0.2 ? DROP.glideBrake : DROP.glideSpeed + Math.max(0, input.forward) * 3;
      const hx = -Math.sin(this.heading) * speed + rx * input.strafe * 4;
      const hz = -Math.cos(this.heading) * speed + rz * input.strafe * 4;
      this.vel.x += (hx - this.vel.x) * Math.min(1, dt * 2);
      this.vel.z += (hz - this.vel.z) * Math.min(1, dt * 2);
      this.vel.y += (-DROP.glideSink - this.vel.y) * Math.min(1, dt * 2.2);
    }

    this.pos.addScaledVector(this.vel, dt);
    // Nobody falls off into the sea: the island edge (with a margin) holds.
    if (this.edge && clampInsidePolygon(this.pos, this.edge, DROP.edgePad)) {
      this.vel.x *= 0.5;
      this.vel.z *= 0.5;
    }
    const g2 = groundAt(this.pos.x, this.pos.z, this.pos.y + 1) ?? 0;
    if (this.pos.y <= g2) {
      this.pos.y = g2;
      this.vel.set(0, 0, 0);
      this.state = "landed";
    }
  }
}
