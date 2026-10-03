// Troll Forces — Troll Royale's opening: the sky lobby, the Troll Bus and the
// drop.
//
//   1. Lobby: a glass box floating high over the island, guns all over its
//      floor to try out (no damage; nothing carries over). 90 s on the
//      staging clock game.js already syncs.
//   2. Bus: everyone rides the Troll Bus along a straight line across the
//      island. The line comes from the match seed, so every client flies the
//      same one without it going over the wire.
//   3. Drop: jump off any time over the island (anyone left is kicked out at
//      the far edge), freefall, then a trollface paraglider opens near the
//      ground (or earlier, on a second jump) and you steer it down to land.
//
// game.js owns the rules (who is where, the clock, damage). This file owns
// the box, the bus, the glider and the flight physics.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { insidePolygon, clampInsidePolygon } from "./edge.js";
import { rollGun, RARITIES, seededRng } from "./royale.js?v=p5";
import { loadModel } from "./battlefield-props.js";

export const DROP = {
  enabled: true,        // tests switch it off to start on the ground, as before
  lobbySeconds: 90,
  boxY: 330,            // the glass box's floor
  boxSize: 40,
  boxH: 7,
  lobbyGuns: 34,
  gunRespawn: 4,        // seconds before a lobby gun is back
  busY: 215,
  busSpeed: 32,         // m/s
  busLead: 80,          // metres flown before and after the island
  fallSpeed: 42,        // freefall, m/s down
  diveSpeed: 60,        // looking down with W held
  fallSteer: 17,        // m/s sideways in freefall
  glideSink: 6.5,       // m/s down under the glider
  glideSpeed: 15,       // m/s forward under the glider
  glideBrake: 7,        // m/s forward holding S
  autoOpen: 32,         // metres above the ground the glider opens by itself
  openBelow: 150,       // a second jump opens it early below this height
  edgePad: 12,          // gliders are kept this far inside the island edge
};

/* ---- shared art ----------------------------------------------------------- */

let faceTex = null;
function trollfaceTexture() {
  if (faceTex) return faceTex;
  faceTex = new THREE.TextureLoader().load(new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href);
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

/* The Troll Bus: tf-bus + the carved grin on its nose, tf-busface
   (models/build_island.blender.py), loaded when the match starts so they're
   ready long before the lobby ends. The thruster flames flicker in JS. If the
   models never arrive, the old grey-box bus stands in. Faces +X. */
const BUS_MODELS = ["tf-bus", "tf-busface", "tf-skybox"];
function preloadRoyaleModels() {
  for (const m of BUS_MODELS) loadModel(m).catch(() => {});
}
/* A model in a group that disposal must leave alone (its geometry is the
   loader's cache, shared by every later clone). */
function addModel(group, name, onFail) {
  loadModel(name).then((obj) => {
    obj.userData.shared = true;
    group.add(obj);
  }).catch(() => onFail?.());
}
function disposeOwn(root) {
  const skip = new Set();
  root.traverse((o) => { if (o.userData.shared) o.traverse((c) => skip.add(c)); });
  root.traverse((o) => { if (!skip.has(o)) { o.geometry?.dispose(); o.material?.dispose?.(); } });
}

function buildBus() {
  const g = new THREE.Group();
  for (const z of [-1, 1]) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 12), new THREE.MeshBasicMaterial({ color: 0x7fd6ff, transparent: true, opacity: 0.85 }));
    flame.rotation.z = Math.PI / 2;
    flame.position.set(-9.05, 2.2, z * 1.2);
    flame.userData.flame = true;
    g.add(flame);
  }
  addModel(g, "tf-bus", () => g.add(buildGreyBus()));
  addModel(g, "tf-busface");
  return g;
}

/* The grey-box bus, kept as the fallback. */
function buildGreyBus() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(12, 3.6, 3.6), mat(0xf2cf3a));
  body.position.y = 1.8;
  g.add(body);
  const windows = new THREE.Mesh(new THREE.BoxGeometry(10.4, 1.1, 3.66), mat(0x1c2230, { roughness: 0.2, metalness: 0.4 }));
  windows.position.set(-0.4, 2.5, 0);
  g.add(windows);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(12.04, 0.35, 3.64), mat(0x222222));
  stripe.position.y = 1.1;
  g.add(stripe);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.6),
    new THREE.MeshBasicMaterial({ map: trollfaceTexture(), transparent: true, depthWrite: false }));
  face.rotation.y = Math.PI / 2;
  face.position.set(6.03, 1.9, 0);
  g.add(face);
  for (const z of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 3.2), mat(0xd8d8d8));
    wing.position.set(-0.5, 1.4, z * 3.3);
    wing.rotation.x = z * 0.12;
    g.add(wing);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 2.4, 12), mat(0x555a62, { metalness: 0.5 }));
    pod.rotation.z = Math.PI / 2;
    pod.position.set(-6.4, 2.2, z * 1.2);
    g.add(pod);
  }
  for (const [x, z] of [[4, -1.85], [4, 1.85], [-3.6, -1.85], [-3.6, 1.85]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.4, 14), mat(0x151515));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.1, z);
    g.add(wheel);
  }
  return g;
}

/* ---- the drop ------------------------------------------------------------- */

export class RoyaleDrop {
  /* `ctx`: { scene, colliders, edge (island outline or null), bounds, groundAt(x, z, fromY) }. */
  constructor(ctx, seed) {
    this.ctx = ctx;
    this.seed = seed;
    this.phase = "lobby";           // lobby -> bus -> done
    this.busT = 0;
    this.box = null;
    this.boxColliders = [];
    this.lobbyTaken = new Map();    // lobby gun id -> seconds until it's back
    this.path = this.planPath();
    this.bus = null;
    preloadRoyaleModels();
    this.buildBox();
  }

  /* ---- lobby ---- */

  get boxCentre() { return { x: 0, y: DROP.boxY, z: 0 }; }

  buildBox() {
    const { scene, colliders } = this.ctx;
    const S = DROP.boxSize, H = DROP.boxH, y0 = DROP.boxY, t = 0.4;
    const g = new THREE.Group();
    // Unlit, so the sun can't glare it white: you see straight through it.
    const glass = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, fog: false });
    const floorGlass = glass.clone();
    floorGlass.opacity = 0.14;
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    // Glass floor, walls and roof.
    add(new THREE.BoxGeometry(S, t, S), floorGlass, 0, y0 - t / 2, 0).renderOrder = 4;
    add(new THREE.BoxGeometry(S, t, S), glass, 0, y0 + H + t / 2, 0).renderOrder = 4;
    for (const [w, d, x, z] of [[S, t, 0, -S / 2], [S, t, 0, S / 2], [t, S, -S / 2, 0], [t, S, S / 2, 0]]) {
      add(new THREE.BoxGeometry(w, H, d), glass, x, y0 + H / 2, z).renderOrder = 4;
    }
    // The frame round the glass, the deck rim and the hull under it:
    // tf-skybox (models/build_island.blender.py), origin at the floor's middle.
    const frameRoot = new THREE.Group();
    frameRoot.position.y = y0;
    g.add(frameRoot);
    addModel(frameRoot, "tf-skybox");
    // A trollface on the roof, looking down at you.
    const face = add(new THREE.PlaneGeometry(10, 8.5),
      new THREE.MeshBasicMaterial({ map: trollfaceTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false }), 0, y0 + H + 0.3, 0);
    face.rotation.x = Math.PI / 2;
    scene.add(g);
    this.box = g;
    // Colliders: the floor slab, the walls, the roof.
    const push = (x, z, w, d, h, y) => {
      const c = { min: new THREE.Vector3(x - w / 2, y, z - d / 2), max: new THREE.Vector3(x + w / 2, y + h, z + d / 2), pen: 99 };
      colliders.push(c);
      this.boxColliders.push(c);
    };
    push(0, 0, S, S, 1, y0 - 1);
    push(0, 0, S, S, 1, y0 + H);
    push(0, -S / 2 - 0.5, S + 2, 1, H, y0);
    push(0, S / 2 + 0.5, S + 2, 1, H, y0);
    push(-S / 2 - 0.5, 0, 1, S + 2, H, y0);
    push(S / 2 + 0.5, 0, 1, S + 2, H, y0);
  }

  /* Where the `i`th of `n` trolls stands in the box: a ring round the middle. */
  lobbySpot(i, n = 20) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.3;
    const r = DROP.boxSize * 0.34;
    return { x: Math.cos(a) * r, y: DROP.boxY, z: Math.sin(a) * r };
  }

  /* The lobby's guns, as LootField items (ids "lobby.N"): the same on every
     client, from the seed. */
  lobbyGunItems() {
    const rng = seededRng((this.seed ^ 0x51ab1e) >>> 0);
    const items = [];
    const S = DROP.boxSize - 6;
    for (let i = 0; i < DROP.lobbyGuns; i++) {
      const col = i % 7, row = Math.floor(i / 7);
      const x = -S / 2 + (col + 0.5) * (S / 7) + (rng() - 0.5) * 1.5;
      const z = -S / 2 + (row + 0.5) * (S / 5) + (rng() - 0.5) * 1.5;
      if (Math.hypot(x, z) < 4) continue;   // the middle stays clear
      const r = Math.floor(rng() * RARITIES.length);
      const { id, att } = rollGun(rng, r);
      items.push({ id: `lobby.${i}`, k: "gun", w: id, a: att, r, x, y: DROP.boxY, z });
    }
    return items;
  }

  /* A lobby gun was picked up: it's back on the floor in a few seconds. */
  lobbyTake(id) { if (id.startsWith("lobby.")) this.lobbyTaken.set(id, DROP.gunRespawn); }

  /* Ticks the respawn timers; returns the ids due back. */
  lobbyRespawns(dt) {
    const back = [];
    for (const [id, t] of this.lobbyTaken) {
      if (t - dt <= 0) { back.push(id); this.lobbyTaken.delete(id); } else this.lobbyTaken.set(id, t - dt);
    }
    return back;
  }

  removeBox() {
    const { scene, colliders } = this.ctx;
    for (const c of this.boxColliders) {
      const i = colliders.indexOf(c);
      if (i >= 0) colliders.splice(i, 1);
    }
    this.boxColliders = [];
    if (this.box) {
      scene.remove(this.box);
      disposeOwn(this.box);
      this.box = null;
    }
  }

  /* ---- bus ---- */

  /* A straight line across the island through near its middle, from the seed.
     `tIn` / `tOut` are where it crosses the island edge (metres along it). */
  planPath() {
    const rng = seededRng((this.seed ^ 0xb05) >>> 0);
    const a = rng() * Math.PI * 2;
    const dir = { x: Math.cos(a), z: Math.sin(a) };
    const off = (rng() - 0.5) * 70;
    const origin = { x: -dir.z * off, z: dir.x * off };
    const edge = this.ctx.edge;
    let tIn = -150, tOut = 150;
    if (edge) {
      let first = null, last = null;
      for (let t = -500; t <= 500; t += 2) {
        if (insidePolygon(edge, origin.x + dir.x * t, origin.z + dir.z * t)) { if (first === null) first = t; last = t; }
      }
      if (first !== null) { tIn = first; tOut = last; }
    }
    const t0 = tIn - DROP.busLead, t1 = tOut + DROP.busLead;
    return { dir, origin, tIn, tOut, t0, t1, duration: (t1 - t0) / DROP.busSpeed, yaw: Math.atan2(-dir.z, dir.x) };
  }

  /* Metres along the line at bus time `t`. */
  along(t) { return this.path.t0 + t * DROP.busSpeed; }
  busPos(t, out = new THREE.Vector3()) {
    const s = this.along(t), p = this.path;
    return out.set(p.origin.x + p.dir.x * s, DROP.busY, p.origin.z + p.dir.z * s);
  }
  /* Over the island, so jumping is allowed. */
  overIsland(t) { const s = this.along(t); return s >= this.path.tIn && s <= this.path.tOut; }
  /* Past the far edge: anyone still aboard gets kicked out. */
  pastIsland(t) { return this.along(t) > this.path.tOut; }
  /* Bus time at which it passes nearest to (x, z), clamped to the island part. */
  timeNearest(x, z) {
    const p = this.path;
    const s = (x - p.origin.x) * p.dir.x + (z - p.origin.z) * p.dir.z;
    return (Math.max(p.tIn, Math.min(p.tOut, s)) - p.t0) / DROP.busSpeed;
  }

  startBus() {
    this.phase = "bus";
    this.busT = 0;
    this.removeBox();
    this.bus = buildBus();
    this.bus.rotation.y = this.path.yaw;
    this.ctx.scene.add(this.bus);
    this.busPos(0, this.bus.position);
  }

  /* Returns true once the bus has flown the whole line (it's then gone). */
  updateBus(dt) {
    if (this.phase !== "bus") return false;
    this.busT += dt;
    this.busPos(this.busT, this.bus.position);
    this.bus.position.y += Math.sin(this.busT * 1.7) * 0.4;
    for (const o of this.bus.children) if (o.userData.flame) o.scale.x = 0.85 + Math.random() * 0.3;
    if (this.busT >= this.path.duration) { this.endBus(); return true; }
    return false;
  }

  endBus() {
    this.phase = "done";
    if (this.bus) {
      this.ctx.scene.remove(this.bus);
      disposeOwn(this.bus);
      this.bus = null;
    }
  }

  dispose() {
    this.removeBox();
    this.endBus();
  }
}

/* One flier (you, or a bot): freefall, then the glider, then landed. The
   caller feeds input and moves its own position from `pos`. */
export class Flight {
  constructor(pos, edge) {
    this.pos = pos.clone();
    this.vel = new THREE.Vector3(0, -8, 0);
    this.state = "fall";   // fall -> glide -> landed
    this.edge = edge;
    this.heading = 0;      // glide heading (yaw), set on opening
  }

  /* `input`: { forward, strafe, yaw, pitch, open } (forward/strafe -1..1).
     `groundAt(x, z, fromY)`: the ground height under a point. */
  update(dt, input, groundAt) {
    if (this.state === "landed") return;
    const ground = groundAt(this.pos.x, this.pos.z, this.pos.y) ?? 0;
    const height = this.pos.y - ground;
    const fx = -Math.sin(input.yaw), fz = -Math.cos(input.yaw);   // where you look
    const rx = Math.cos(input.yaw), rz = -Math.sin(input.yaw);

    if (this.state === "fall") {
      if (height < DROP.autoOpen || (input.open && height < DROP.openBelow)) {
        this.state = "glide";
        this.heading = input.yaw;
        this.vel.y = Math.max(this.vel.y, -DROP.glideSink * 2);
      } else {
        // Look down and hold W to dive.
        const dive = input.forward > 0 && input.pitch < -0.6;
        const targetY = -(dive ? DROP.diveSpeed : DROP.fallSpeed);
        this.vel.y += (targetY - this.vel.y) * Math.min(1, dt * 1.6);
        const hx = (fx * input.forward + rx * input.strafe) * DROP.fallSteer;
        const hz = (fz * input.forward + rz * input.strafe) * DROP.fallSteer;
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
    // Nobody glides off into space: the island edge (with a margin) holds.
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
