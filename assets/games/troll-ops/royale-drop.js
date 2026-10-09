// Troll Forces — Troll Royale's opening: the sky lobby, the box opening and
// the drop.
//
//   1. Lobby: a glass box floating high over the island, guns all over its
//      floor to try out (no damage; nothing carries over). 90 s on the
//      staging clock game.js already syncs. Where the box hangs and which
//      wall opens come from the match seed, so every client agrees without
//      it going over the wire.
//   2. Belt: at 0:00 one wall slides away and the floor becomes a treadmill
//      that carries everyone out over a ramp and off its edge. You can walk
//      (or run for it); a dozen seconds later the floor goes too, so nobody
//      stays behind.
//   3. Drop: pure freefall, steered with the camera (look down to dive),
//      onto the island. No glider: you land with a roll and no damage.
//
// game.js owns the rules (who is where, the clock, damage). This file owns
// the box, the belt and the flight physics. The paraglider build is still
// here (remote-players.js draws it for the wire's glide code) but nothing
// opens one any more.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { insidePolygon, clampInsidePolygon } from "./edge.js";
import { rollGun, RARITIES, seededRng } from "./royale.js?v=p5-wst-bs1-sb2-fu1b7d-wb1-ar1-ar2";
import { loadModel } from "./battlefield-props.js";

export const DROP = {
  enabled: true,        // tests switch it off to start on the ground, as before
  lobbySeconds: 90,
  boxY: 330,            // the glass box's floor
  boxSize: 40,
  boxH: 7,
  lobbyGuns: 34,
  gunRespawn: 4,        // seconds before a lobby gun is back
  boxOffset: 50,        // the box hangs within this of the island's middle
  beltSpeed: 6,         // m/s the floor carries you toward the opening
  beltLen: 14,          // the ramp outside the opening, metres
  beltW: 10,            // ...and its width (the opening is as wide)
  floorGoneAfter: 12,   // seconds after opening when the floor and ramp go
  fallSpeed: 42,        // freefall, m/s down
  diveSpeed: 60,        // looking down with W held
  fallSteer: 17,        // m/s sideways in freefall
  edgePad: 12,          // fallers are kept this far inside the island edge
  // The glider (unused since the belt: Flight never opens one unless asked).
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

/* The box's frame, tf-skybox (models/build_island.blender.py), loaded when
   the match starts so it's there before you look round. */
const BOX_MODELS = ["tf-skybox"];
function preloadRoyaleModels() {
  for (const m of BOX_MODELS) loadModel(m).catch(() => {});
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

/* The belt's stripes: black and hazard-yellow chevrons on a dark deck, one
   repeat per `BELT_PERIOD` metres along the belt, scrolled by moving the
   texture offset. Shared by the box floor and the ramp. */
const BELT_PERIOD = 2;
let beltTex = null;
function beltTexture() {
  if (beltTex) return beltTex;
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#23262b";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#f2c21b";
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(28, 0); g.lineTo(64, 64); g.lineTo(28, 128); g.lineTo(0, 128); g.lineTo(36, 64); g.closePath();
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.08)";
  g.fillRect(0, 0, 128, 3);
  g.fillRect(0, 125, 128, 3);
  beltTex = new THREE.CanvasTexture(c);
  beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;
  beltTex.colorSpace = THREE.SRGBColorSpace;
  beltTex.anisotropy = 4;
  return beltTex;
}
/* A flat strip `len` along local +x, `w` across, its stripes repeating
   every BELT_PERIOD metres along it. Each strip owns its texture clone so it
   can scroll on its own. */
function beltStrip(len, w, opacity = 1) {
  const tex = beltTexture().clone();
  // A chevron every ~3 m across, so it reads as hazard chevrons, not bent bars.
  tex.repeat.set(len / BELT_PERIOD, Math.max(1, Math.round(w / 3)));
  tex.needsUpdate = true;
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: opacity < 1, opacity, fog: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, w), m);
  mesh.rotation.x = -Math.PI / 2;   // flat; local +x stays +x, the plane's +y lies along -z
  mesh.userData.belt = tex;
  return mesh;
}

/* ---- the drop ------------------------------------------------------------- */

export class RoyaleDrop {
  /* `ctx`: { scene, colliders, edge (island outline or null), bounds, groundAt(x, z, fromY) }. */
  constructor(ctx, seed) {
    this.ctx = ctx;
    this.seed = seed;
    this.phase = "lobby";           // lobby -> belt -> done
    this.beltT = 0;                 // seconds since the wall opened
    this.floorGone = false;
    this.box = null;
    this.boxColliders = [];
    this.wallColliders = {};        // by wall key: "-z", "+z", "-x", "+x"
    this.wallMeshes = {};
    this.floorMesh = null;
    this.floorBelt = null;
    this.ramp = null;
    this.rampColliders = [];
    this.lobbyTaken = new Map();    // lobby gun id -> seconds until it's back
    this.place();
    preloadRoyaleModels();
    this.buildBox();
  }

  /* ---- lobby ---- */

  /* Where the box hangs and which wall opens, from the seed: a point within
     boxOffset of the island's middle with the box and the whole ramp over
     land (the coast would stop you walking off the end: movement.js clamps
     everyone inside the edge). The middle itself if nothing fits. */
  place() {
    const rng = seededRng((this.seed ^ 0xb0c) >>> 0);
    const edge = this.ctx.edge;
    const dirs = [{ x: 0, z: -1, key: "-z" }, { x: 0, z: 1, key: "+z" }, { x: -1, z: 0, key: "-x" }, { x: 1, z: 0, key: "+x" }];
    const reach = DROP.boxSize / 2 + DROP.beltLen + 6;
    let x = 0, z = 0, dir = dirs[Math.floor(rng() * 4)];
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * DROP.boxOffset;
      const px = Math.cos(a) * r, pz = Math.sin(a) * r;
      const d = dirs[Math.floor(rng() * 4)];
      const S = DROP.boxSize / 2;
      const corners = [[px - S, pz - S], [px + S, pz - S], [px - S, pz + S], [px + S, pz + S], [px + d.x * reach, pz + d.z * reach],
        [px + d.x * reach - d.z * DROP.beltW / 2, pz + d.z * reach + d.x * DROP.beltW / 2], [px + d.x * reach + d.z * DROP.beltW / 2, pz + d.z * reach - d.x * DROP.beltW / 2]];
      if (!edge || corners.every(([cx, cz]) => insidePolygon(edge, cx, cz))) { x = px; z = pz; dir = d; break; }
    }
    this.boxCentre = { x, y: DROP.boxY, z };
    this.openDir = dir;
    this.openYaw = Math.atan2(-dir.x, -dir.z);   // look.yaw facing the opening
  }

  buildBox() {
    const { scene, colliders } = this.ctx;
    const S = DROP.boxSize, H = DROP.boxH, y0 = DROP.boxY, t = 0.4;
    const { x: cx, z: cz } = this.boxCentre;
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    // Unlit, so the sun can't glare it white: you see straight through it.
    const glass = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, fog: false });
    const floorGlass = glass.clone();
    floorGlass.opacity = 0.14;
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    // Glass floor, walls and roof.
    this.floorMesh = add(new THREE.BoxGeometry(S, t, S), floorGlass, 0, y0 - t / 2, 0);
    this.floorMesh.renderOrder = 4;
    add(new THREE.BoxGeometry(S, t, S), glass, 0, y0 + H + t / 2, 0).renderOrder = 4;
    for (const [key, w, d, x, z] of [["-z", S, t, 0, -S / 2], ["+z", S, t, 0, S / 2], ["-x", t, S, -S / 2, 0], ["+x", t, S, S / 2, 0]]) {
      const wall = add(new THREE.BoxGeometry(w, H, d), glass.clone(), x, y0 + H / 2, z);
      wall.renderOrder = 4;
      this.wallMeshes[key] = wall;
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
    // Colliders: the floor slab, the walls, the roof (world space).
    const push = (x, z, w, d, h, y) => {
      const c = { min: new THREE.Vector3(cx + x - w / 2, y, cz + z - d / 2), max: new THREE.Vector3(cx + x + w / 2, y + h, cz + z + d / 2), pen: 99 };
      colliders.push(c);
      this.boxColliders.push(c);
      return c;
    };
    this.floorCollider = push(0, 0, S, S, 1, y0 - 1);
    push(0, 0, S, S, 1, y0 + H);
    this.wallColliders["-z"] = push(0, -S / 2 - 0.5, S + 2, 1, H, y0);
    this.wallColliders["+z"] = push(0, S / 2 + 0.5, S + 2, 1, H, y0);
    this.wallColliders["-x"] = push(-S / 2 - 0.5, 0, 1, S + 2, H, y0);
    this.wallColliders["+x"] = push(S / 2 + 0.5, 0, 1, S + 2, H, y0);
  }

  /* Where the `i`th of `n` trolls stands in the box: a ring round the middle. */
  lobbySpot(i, n = 20) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.3;
    const r = DROP.boxSize * 0.34;
    return { x: this.boxCentre.x + Math.cos(a) * r, y: DROP.boxY, z: this.boxCentre.z + Math.sin(a) * r };
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
      items.push({ id: `lobby.${i}`, k: "gun", w: id, a: att, r, x: this.boxCentre.x + x, y: DROP.boxY, z: this.boxCentre.z + z });
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

  dropCollider(c) {
    const { colliders } = this.ctx;
    const i = colliders.indexOf(c);
    if (i >= 0) colliders.splice(i, 1);
    const j = this.boxColliders.indexOf(c);
    if (j >= 0) this.boxColliders.splice(j, 1);
  }

  removeBox() {
    const { scene } = this.ctx;
    for (const c of [...this.boxColliders, ...this.rampColliders]) this.dropCollider(c);
    this.boxColliders = [];
    this.rampColliders = [];
    if (this.box) {
      scene.remove(this.box);
      disposeOwn(this.box);
      this.box = null;
    }
    if (this.ramp) {
      scene.remove(this.ramp);
      disposeOwn(this.ramp);
      this.ramp = null;
    }
  }

  /* ---- belt ---- */

  /* 0:00: the open side's wall goes (its glass sinks into the deck over a
     second), the ramp appears outside it, and the floor starts moving. */
  openBox() {
    if (this.phase !== "lobby") return;
    this.phase = "belt";
    this.beltT = 0;
    const key = this.openDir.key;
    this.dropCollider(this.wallColliders[key]);
    delete this.wallColliders[key];
    this.openWall = this.wallMeshes[key] || null;
    this.buildRamp();
    // The floor's stripes: a belt the size of the deck, a hair over the glass.
    if (this.box) {
      const S = DROP.boxSize;
      this.floorBelt = beltStrip(S, S, 0.85);
      this.floorBelt.rotation.y = this.openYawFlat();
      this.floorBelt.rotation.order = "YXZ";
      this.floorBelt.position.y = DROP.boxY + 0.02;
      this.floorBelt.renderOrder = 3;
      this.box.add(this.floorBelt);
    }
  }

  /* Group yaw that lays a strip's local +x along openDir. */
  openYawFlat() { return Math.atan2(-this.openDir.z, this.openDir.x); }

  /* The treadmill ramp outside the opening: a strip at floor level with low
     rails either side (colliders only; the frame's lip reads as the rail). */
  buildRamp() {
    const { scene, colliders } = this.ctx;
    const S = DROP.boxSize, L = DROP.beltLen, W = DROP.beltW, y0 = DROP.boxY;
    const d = this.openDir, { x: cx, z: cz } = this.boxCentre;
    const g = new THREE.Group();
    const start = S / 2;   // where the wall stood; the ramp starts under it
    g.position.set(cx + d.x * (start + L / 2), 0, cz + d.z * (start + L / 2));
    g.rotation.y = this.openYawFlat();
    const belt = beltStrip(L + 1, W);
    belt.rotation.order = "YXZ";
    belt.position.y = y0 + 0.02;
    g.add(belt);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(L + 1, 0.6, W + 1.2), mat(0x3a3d44, { roughness: 0.7, metalness: 0.3 }));
    deck.position.y = y0 - 0.3;
    g.add(deck);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(L + 1, 0.5, 0.4), mat(0xf2c21b, { roughness: 0.5, metalness: 0.2 }));
      rail.position.set(0, y0 + 0.25, side * (W / 2 + 0.4));
      g.add(rail);
    }
    scene.add(g);
    this.ramp = g;
    this.rampBelt = belt;
    // Colliders, world-aligned (openDir is one of the four axes).
    const along = L + 1, across = W + 1.2;
    const w = d.x ? along : across, dd = d.x ? across : along;
    const ox = cx + d.x * (start + L / 2), oz = cz + d.z * (start + L / 2);
    const push = (x, z, bw, bd, h, y) => {
      const c = { min: new THREE.Vector3(x - bw / 2, y, z - bd / 2), max: new THREE.Vector3(x + bw / 2, y + h, z + bd / 2), pen: 99 };
      colliders.push(c);
      this.rampColliders.push(c);
    };
    push(ox, oz, w, dd, 1, y0 - 1);
    for (const side of [-1, 1]) {
      const rx = ox + (d.x ? 0 : side * (W / 2 + 0.4)), rz = oz + (d.z ? 0 : side * (W / 2 + 0.4));
      push(rx, rz, d.x ? along : 0.4, d.x ? 0.4 : along, 0.6, y0);
    }
  }

  /* Ticks the belt. The wall sinks, the stripes scroll, the floor goes at
     floorGoneAfter (the colliders; the glass fades) and three seconds on the
     phase is done. */
  updateBelt(dt) {
    if (this.phase !== "belt") return;
    this.beltT += dt;
    const k = Math.min(1, this.beltT / 1.2);
    if (this.openWall) {
      this.openWall.scale.y = Math.max(0.001, 1 - k);
      this.openWall.position.y = DROP.boxY + (DROP.boxH * (1 - k)) / 2;
      if (k >= 1) { this.openWall.visible = false; this.openWall = null; }
    }
    const scroll = (mesh) => {
      const tex = mesh?.userData.belt;
      if (tex) tex.offset.x = (tex.offset.x - (DROP.beltSpeed * dt) / BELT_PERIOD) % 1;
    };
    if (!this.floorGone) { scroll(this.floorBelt); scroll(this.rampBelt); }
    if (!this.floorGone && this.beltT >= DROP.floorGoneAfter) {
      this.floorGone = true;
      this.dropCollider(this.floorCollider);
      for (const c of this.rampColliders) this.dropCollider(c);
      this.rampColliders = [];
    }
    if (this.floorGone) {
      const fade = Math.max(0, 1 - (this.beltT - DROP.floorGoneAfter) / 1.5);
      if (this.floorMesh) this.floorMesh.material.opacity = 0.14 * fade;
      if (this.floorBelt) this.floorBelt.material.opacity = 0.85 * fade;
      if (this.rampBelt) this.rampBelt.material.opacity = fade;
      if (this.rampBelt && !this.rampBelt.material.transparent) { this.rampBelt.material.transparent = true; this.rampBelt.material.needsUpdate = true; }
      if (this.ramp) for (const o of this.ramp.children) if (o !== this.rampBelt) { o.material.transparent = true; o.material.opacity = fade; }
    }
    // Everyone's out: the empty box and ramp go too, rather than hang there.
    if (this.beltT >= DROP.floorGoneAfter + 3) { this.phase = "done"; this.removeBox(); }
  }

  /* Standing on the moving floor or the ramp: feet at the deck's height,
     over the box or the ramp footprint. Nothing to stand on once the floor
     has gone. */
  onBelt(pos) {
    if (this.phase !== "belt" || this.floorGone) return false;
    if (Math.abs(pos.y - DROP.boxY) > 1.5) return false;
    const dx = pos.x - this.boxCentre.x, dz = pos.z - this.boxCentre.z, S = DROP.boxSize / 2;
    if (Math.abs(dx) <= S && Math.abs(dz) <= S) return true;
    const d = this.openDir;
    const fwd = dx * d.x + dz * d.z, side = Math.abs(dx * d.z - dz * d.x);
    // A metre past the ramp's end too: the ground check still finds the
    // slab's lip under a body half over it, so the belt has to carry you
    // right off, not stop at the edge.
    return fwd > S && fwd <= S + DROP.beltLen + 1.5 && side <= DROP.beltW / 2 + 0.6;
  }

  /* How far the belt has carried something along openDir this frame. */
  beltStep(dt) { return DROP.beltSpeed * dt; }

  dispose() {
    this.removeBox();
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
      if (this.glider && (height < DROP.autoOpen || (input.open && height < DROP.openBelow))) {
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
