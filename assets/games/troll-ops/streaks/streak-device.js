// Troll Forces — first-person streak-call devices (DESIGN-ARMS.md Phase 5,
// STREAK-REALISM.md phase 1).
//
// The rugged tablet you raise to call a UAV or gunship (and hold under the
// Lightning Strike map), and the care package's smoke grenade. The tablet
// is built on a Panasonic Toughbook (refs/streaks/pad): a rounded magnesium
// body in grained polymer with rubber corner bumpers and screws, ribbed
// side grips, a raised bezel round a glass-covered screen, hard keys under
// it, a stub antenna and a stylus on the top edge, a battery door and a
// hand strap on the back. Its screen copies ATAK, the real military map
// app: a status bar, this map from above with a grid and friendlies, a card
// for the asset being called, a readout and a CONFIRM bar. The marker is an
// M18 smoke grenade: olive can, red lid, fuze with spoon and pull ring.
//
// Neither carries a hand of its own. Each exposes grip anchors in
// `userData.anchors` ({ right, left } Object3Ds) and view/streak-view.js
// hangs the real sleeved arms off them every frame.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { game } from "../core/state.js?v=st1";

const TABLET_W = 0.25, TABLET_H = 0.165, TABLET_D = 0.016;
const SCREEN_W = TABLET_W - 0.054, SCREEN_H = TABLET_H - 0.056;   // clear of the corner bumpers
const SCREEN_Y = 0.004;                        // the screen sits a touch high: the keys are under it
const SCREEN_PX_W = 512, SCREEN_PX_H = 288;

/* A rounded rectangle in the XY plane, centred. */
function roundedRect(w, h, r, segs = 6) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  s.curveSegments = segs;
  return s;
}

/* A rounded slab: extruded along z with a bevelled edge, centred on z=0. */
function slab(w, h, d, r, { bevel = 0.0025, segs = 6, bevelSegs = 3 } = {}) {
  const shape = roundedRect(w - bevel * 2, h - bevel * 2, Math.max(0.001, r - bevel), segs);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: bevelSegs, curveSegments: segs });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  return g;
}

/* A flat rounded-rect ring (the bezel): outer minus inner. */
function ring(w, h, r, inset, d) {
  const shape = roundedRect(w, h, r, 6);
  const hole = roundedRect(w - inset * 2, h - inset * 2, Math.max(0.001, r - inset), 6);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 6 });
  return g;
}

function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
/* Extrusions are unindexed and the primitives indexed: merge takes one kind. */
function merge(geos) { return mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))); }
function at(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = geo.clone();
  if (rx || ry || rz) g.rotateX(rx), g.rotateY(ry), g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

/* Grained polymer: a speckle in the roughness and a faint bump, from a
   small tiling canvas. The Toughbook's shell has exactly this fleck. */
let _grain = null;
function grainMaps() {
  if (_grain) return _grain;
  const S = 128;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, S, S);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) {
    const v = 90 + Math.floor(rnd() * 110);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 1 + (rnd() < 0.2 ? 1 : 0), 1);
  }
  const rough = new THREE.CanvasTexture(c);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(6, 4);
  // the bump: the same fleck as a height map
  const bump = rough.clone();
  bump.needsUpdate = true;
  _grain = { rough, bump };
  return _grain;
}

let _mats = null;
function mats() {
  if (_mats) return _mats;
  const grain = grainMaps();
  _mats = {
    shell: new THREE.MeshStandardMaterial({ color: 0x4b4f47, roughness: 0.62, metalness: 0.18, roughnessMap: grain.rough, bumpMap: grain.bump, bumpScale: 0.0006 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x777b74, roughness: 0.5, metalness: 0.55, roughnessMap: grain.rough, bumpMap: grain.bump, bumpScale: 0.0004 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141513, roughness: 0.9, metalness: 0.02 }),
    bezel: new THREE.MeshStandardMaterial({ color: 0x0e100f, roughness: 0.45, metalness: 0.25 }),
    keys: new THREE.MeshStandardMaterial({ color: 0x2a2c29, roughness: 0.75, metalness: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9a9b96, roughness: 0.35, metalness: 0.9 }),
    strap: new THREE.MeshStandardMaterial({ color: 0x2c2e27, roughness: 0.95, metalness: 0 }),
    ledGreen: new THREE.MeshBasicMaterial({ color: 0x5dff64, toneMapped: false }),
    ledAmber: new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }),
    lens: new THREE.MeshStandardMaterial({ color: 0x06080c, roughness: 0.1, metalness: 0.6 }),
    // the glass over the screen: near-clear, with the sky in it
    glass: new THREE.MeshStandardMaterial({ color: 0x0a0c0e, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.22, envMapIntensity: 1.8, depthWrite: false }),
    glare: new THREE.MeshBasicMaterial({ map: glareTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  };
  return _mats;
}

/* A soft diagonal light band for the glare on the glass. */
function glareTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 256, 128);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.42, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, "rgba(230,240,255,.55)");
  grad.addColorStop(0.55, "rgba(230,240,255,.25)");
  grad.addColorStop(0.62, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* Landscape rugged tablet, screen facing +Z (the camera). Anchors sit on the
   two short edges at mid-height, oriented with the tablet, so a hand posed
   at one grips that edge with its thumb over the bezel. */
export function buildStreakDevice() {
  const M = mats();
  const group = new THREE.Group();
  const W = TABLET_W, H = TABLET_H, D = TABLET_D;
  const add = (geos, mat) => {
    const m = new THREE.Mesh(geos.length === 1 ? geos[0] : merge(geos), mat);
    group.add(m);
    return m;
  };

  // --- the body: a rounded magnesium slab in grained polymer, a lighter
  // back plate inset into it, and the raised bezel on the front
  add([slab(W, H, D, 0.016, { bevel: 0.003 })], M.shell);
  add([at(slab(W * 0.86, H * 0.8, 0.003, 0.014, { bevel: 0.001, bevelSegs: 2 }), 0, 0, -D / 2)], M.plate);
  const bezelG = ring(SCREEN_W + 0.008, SCREEN_H + 0.008, 0.006, 0.0035, 0.0035);
  bezelG.translate(0, SCREEN_Y, D / 2 - 0.0005);
  add([bezelG], M.bezel);
  // the recessed screen well behind the glass
  add([at(box(SCREEN_W + 0.002, SCREEN_H + 0.002, 0.001), 0, SCREEN_Y, D / 2)], M.bezel);

  // --- rubber: four corner bumpers (rounded caps proud of the shell),
  // the ribbed side grips the hands go on, port covers on the bottom edge
  const rubber = [];
  const bump = slab(0.032, 0.032, D + 0.007, 0.01, { bevel: 0.003, segs: 4, bevelSegs: 2 });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) rubber.push(at(bump, sx * (W / 2 - 0.012), sy * (H / 2 - 0.012), 0));
  for (const sx of [-1, 1]) {
    rubber.push(at(box(0.009, H * 0.46, D + 0.004), sx * (W / 2 - 0.0015), 0, 0));
    for (let i = -3; i <= 3; i++) rubber.push(at(box(0.011, 0.004, D + 0.006), sx * (W / 2 - 0.001), i * 0.0105, 0));
  }
  for (const x of [-0.035, 0.035]) rubber.push(at(box(0.034, 0.005, D - 0.004), x, -H / 2 - 0.0005, 0));
  // the stub antenna: a rubber helical on a steel nut, top right
  rubber.push(at(new THREE.CylinderGeometry(0.0042, 0.0048, 0.052, 8), W / 2 - 0.036, H / 2 + 0.03, -0.002));
  rubber.push(at(new THREE.CylinderGeometry(0.0052, 0.0052, 0.006, 8), W / 2 - 0.036, H / 2 + 0.054, -0.002));
  add(rubber, M.rubber);

  // --- steel: the bumper screws, the antenna nut, the stylus along the top
  // edge, the lanyard loop top left, the battery latches on the back
  const steel = [];
  const screw = new THREE.CylinderGeometry(0.0028, 0.0028, 0.0012, 8);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    steel.push(at(screw, sx * (W / 2 - 0.012), sy * (H / 2 - 0.012), D / 2 + 0.0036, Math.PI / 2));
    steel.push(at(screw, sx * (W / 2 - 0.012), sy * (H / 2 - 0.012), -D / 2 - 0.0036, Math.PI / 2));
  }
  steel.push(at(new THREE.CylinderGeometry(0.006, 0.006, 0.006, 6), W / 2 - 0.036, H / 2 + 0.003, -0.002));
  steel.push(at(new THREE.CylinderGeometry(0.0032, 0.0032, 0.11, 8), -0.015, H / 2 - 0.004, -D / 2 + 0.0035, 0, 0, Math.PI / 2));
  steel.push(at(new THREE.TorusGeometry(0.006, 0.0012, 5, 10), -W / 2 + 0.03, H / 2 + 0.004, 0));
  for (const x of [-0.052, 0.052]) steel.push(at(box(0.012, 0.004, 0.002), x, -0.035, -D / 2 - 0.004));
  add(steel, M.steel);

  // --- back: the battery door and the hand strap across it
  add([at(box(0.1, 0.055, 0.0015), 0, -0.035, -D / 2 - 0.003)], M.keys);
  add([at(box(W * 0.74, 0.034, 0.0025), 0, 0.008, -D / 2 - 0.0055), at(box(0.04, 0.03, 0.003), -0.05, 0.008, -D / 2 - 0.0062)], M.strap);
  add([at(box(0.012, 0.038, 0.0035), 0.052, 0.008, -D / 2 - 0.006)], M.steel);

  // --- front: four hard keys and a nav rocker under the screen, a camera
  // and two LEDs in the top bezel band
  const keys = [];
  for (let i = 0; i < 4; i++) keys.push(at(slab(0.016, 0.007, 0.004, 0.002, { bevel: 0.001, segs: 3, bevelSegs: 1 }), -0.045 + i * 0.02, -H / 2 + 0.0125, D / 2 + 0.001));
  keys.push(at(new THREE.CylinderGeometry(0.007, 0.0075, 0.004, 12), 0.058, -H / 2 + 0.0125, D / 2 + 0.001, Math.PI / 2));
  keys.push(at(new THREE.CylinderGeometry(0.003, 0.003, 0.005, 8), 0.058, -H / 2 + 0.0125, D / 2 + 0.001, Math.PI / 2));
  add(keys, M.keys);
  add([at(new THREE.CylinderGeometry(0.0025, 0.0025, 0.002, 8), 0, H / 2 - 0.009, D / 2 + 0.001, Math.PI / 2)], M.lens);
  const ledG = new THREE.CylinderGeometry(0.0015, 0.0015, 0.002, 6);
  const ledA = new THREE.Mesh(at(ledG, W / 2 - 0.05, H / 2 - 0.009, D / 2 + 0.001, Math.PI / 2), M.ledGreen);
  const ledB = new THREE.Mesh(at(ledG, W / 2 - 0.044, H / 2 - 0.009, D / 2 + 0.001, Math.PI / 2), M.ledAmber);
  group.add(ledA, ledB);

  // --- the screen: a canvas the caller redraws (drawTabletScreen) while
  // held, under a sheet of glass with a band of glare that drifts with the
  // hold
  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_PX_W;
  canvas.height = SCREEN_PX_H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(0, SCREEN_Y, D / 2 + 0.0012);
  group.add(screen);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W + 0.004, SCREEN_H + 0.004), M.glass);
  glass.position.set(0, SCREEN_Y, D / 2 + 0.0028);
  glass.renderOrder = 2;
  group.add(glass);
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W + 0.004, SCREEN_H + 0.004), M.glare.clone());
  glare.position.set(0, SCREEN_Y, D / 2 + 0.003);
  glare.renderOrder = 3;
  group.add(glare);

  group.userData.anchors = {
    right: gripAnchor(W / 2, 0, 0, -1),
    left: gripAnchor(-W / 2, 0, 0, 1),
  };
  group.add(group.userData.anchors.right, group.userData.anchors.left);
  group.userData.screen = { canvas, ctx: canvas.getContext("2d"), tex, glare, leds: [ledA, ledB] };
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

/* An anchor at a tablet edge. `inward` (+1/-1) is which way is "into the
   tablet" along X, so one hand builder serves both sides. */
function gripAnchor(x, y, z, inward) {
  const a = new THREE.Object3D();
  a.position.set(x, y, z);
  a.userData.inward = inward;
  return a;
}

/* ------------------------------------------------------------ the screen */

// ATAK's palette: a dark map, pale UI, cyan friendlies, red hostiles, amber
// for what needs a press.
const UI = "#d8ded4", UI_DIM = "rgba(216,222,212,.55)", AMBER = "#ffb347", RED = "#ff4a3a", CYAN = "#4fc3f7", GREEN = "#6dff4a";
const BAR_H = 24, FOOT_H = 40;
const MAP_Y = BAR_H, MAP_H = SCREEN_PX_H - BAR_H - FOOT_H;

/* The map under everything, drawn once per arena: this map's buildings and
   coast as the minimap sees them, under a grid. Keyed on the arena object
   so a new map redraws it. Without a match (the lab, the lobby) a demo
   block plan stands in. */
let _mapBase = null, _mapFor = null;
function mapBase() {
  const arena = game.ARENA || null;
  if (_mapBase && _mapFor === (arena || "demo")) return _mapBase;
  const c = document.createElement("canvas"); c.width = SCREEN_PX_W; c.height = MAP_H;
  const g = c.getContext("2d");
  g.fillStyle = "#1c211d"; g.fillRect(0, 0, c.width, c.height);
  const rects = [];
  const outlines = [];
  if (arena) {
    const w = arena.maxX - arena.minX, d = arena.maxZ - arena.minZ;
    // square metres on screen, the map's long side across the width
    const k = Math.min(c.width / w, c.height / d) * 0.96;
    const ox = (c.width - w * k) / 2, oz = (c.height - d * k) / 2;
    const to = (x, z) => [ox + (x - arena.minX) * k, oz + (z - arena.minZ) * k];
    if (arena.edge) outlines.push({ poly: arena.edge.map(([x, z]) => to(x, z)), fill: "rgba(96,140,86,.35)", stroke: "rgba(170,210,160,.5)" });
    if (arena.wade) outlines.push({ poly: arena.wade.map(([x, z]) => to(x, z)), fill: "rgba(60,120,190,.45)", stroke: "rgba(120,180,240,.5)" });
    for (const col of game.colliders || []) {
      if (col.min.y > 1.6 || col.moving) continue;
      const [x0, z0] = to(col.min.x, col.min.z), [x1, z1] = to(col.max.x, col.max.z);
      rects.push([x0, z0, Math.max(1, x1 - x0), Math.max(1, z1 - z0)]);
    }
    _mapBase = { canvas: c, to, k, origin: [ox, oz] };
  } else {
    // a demo block plan: streets on a grid, lots of different sizes
    let seed = 11;
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    for (let bx = 0; bx < 7; bx++) for (let bz = 0; bz < 4; bz++) {
      const x0 = 14 + bx * 70, z0 = 10 + bz * 62;
      const n = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) rects.push([x0 + rnd() * 30, z0 + rnd() * 28, 14 + rnd() * 26, 12 + rnd() * 22]);
    }
    const k = 1.1;
    _mapBase = { canvas: c, to: (x, z) => [256 + x * k, MAP_H / 2 + z * k], k, origin: [0, 0] };
  }
  for (const o of outlines) {
    g.beginPath(); o.poly.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
    g.fillStyle = o.fill; g.fill(); g.strokeStyle = o.stroke; g.lineWidth = 1; g.stroke();
  }
  // the grid: MGRS-style squares with a brighter line every fifth
  for (let i = 0; i <= 16; i++) {
    const x = i * (c.width / 16) + 0.5;
    g.strokeStyle = i % 4 === 0 ? "rgba(140,160,145,.28)" : "rgba(140,160,145,.11)";
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke();
  }
  for (let i = 0; i <= 10; i++) {
    const y = i * (c.height / 10) + 0.5;
    g.strokeStyle = i % 5 === 0 ? "rgba(140,160,145,.28)" : "rgba(140,160,145,.11)";
    g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke();
  }
  g.fillStyle = "#3c443d"; g.strokeStyle = "#5a645b"; g.lineWidth = 1;
  for (const [x, y, w, h] of rects) { g.fillRect(x, y, w, h); g.strokeRect(x + 0.5, y + 0.5, w, h); }
  // grid labels down the left and along the top
  g.fillStyle = "rgba(216,222,212,.4)"; g.font = "9px monospace"; g.textBaseline = "top";
  for (let i = 1; i < 16; i += 4) g.fillText(String(24 + i).padStart(2, "0"), i * (c.width / 16) + 3, 2);
  for (let i = 1; i < 10; i += 5) g.fillText(String(55 + i), 3, i * (c.height / 10) + 3);
  _mapFor = arena || "demo";
  return _mapBase;
}

/* Scanlines, a vignette and the backlight's bleed at the edges, once. */
let _overlay = null;
function overlay() {
  if (_overlay) return _overlay;
  const c = document.createElement("canvas"); c.width = SCREEN_PX_W; c.height = SCREEN_PX_H;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,.09)";
  for (let y = 0; y < c.height; y += 3) g.fillRect(0, y, c.width, 1);
  const v = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.45, c.width / 2, c.height / 2, c.width * 0.72);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.42)");
  g.fillStyle = v; g.fillRect(0, 0, c.width, c.height);
  const b = g.createLinearGradient(0, 0, 0, c.height);
  b.addColorStop(0, "rgba(160,190,220,.12)"); b.addColorStop(0.08, "rgba(160,190,220,0)");
  b.addColorStop(0.92, "rgba(160,190,220,0)"); b.addColorStop(1, "rgba(160,190,220,.12)");
  g.fillStyle = b; g.fillRect(0, 0, c.width, c.height);
  _overlay = c;
  return c;
}

const TITLES = { uav: "UAV // RECON", counteruav: "COUNTER-UAV // JAMMER", vsat: "ORBITAL VSAT // UPLINK", gunship: "GUNSHIP // AIR SUPPORT", strike: "LIGHTNING STRIKE",
  k9: "K9 UNIT // RELEASE", warship: "VTOL WARSHIP // GUNNER", swarm: "SWARM // HK DRONES",
  dragonfire: "DRAGONFIRE // PILOT LINK", samturret: "SAM TURRET // AIR DEFENSE" };
const CONFIRMED = { uav: "UAV ONLINE", counteruav: "JAMMING ENEMY", vsat: "SATELLITE ONLINE", gunship: "CONFIRMED — INBOUND", k9: "DOGS RELEASED", warship: "CONFIRMED — BOARDING", swarm: "SWARM INBOUND",
  dragonfire: "LINK UP — LAUNCHING", samturret: "DEPLOYED — ARMED" };
const ASSET = { uav: "RQ-7 SHADOW", counteruav: "RQ-7 / ECM POD", vsat: "AEHF-4 SAT", gunship: "AH-64E", strike: "F-35A x3", k9: "MWD TEAM x6", warship: "CV-22 GUNSHIP", swarm: "SWITCHBLADE x24",
  dragonfire: "QUAD / LMG", samturret: "AVENGER POD" };

/* Redraw the tablet screen. `mode` is what's being called: "uav",
   "gunship", "strike", or anything else for the idle feed. `t` is seconds
   since it came up, `confirmed` flips the page once the thumb has gone
   down. The glare drifts with t, the link LED blinks. */
export function drawTabletScreen(device, mode, t, confirmed) {
  const s = device.userData.screen;
  if (!s) return;
  const g = s.ctx, W = SCREEN_PX_W, H = SCREEN_PX_H;
  g.textBaseline = "top";

  // --- the map and what moves on it
  const base = mapBase();
  g.drawImage(base.canvas, 0, MAP_Y);
  g.save();
  g.beginPath(); g.rect(0, MAP_Y, W, MAP_H); g.clip();
  g.translate(0, MAP_Y);
  const me = game.move?.pos ? base.to(game.move.pos.x, game.move.pos.z) : [W / 2, MAP_H / 2];
  const yaw = game.look?.yaw || 0;
  if (mode === "uav" || mode === "samturret" || mode === "counteruav") {
    // the radar sweep from where we stand, a wedge fading behind its edge
    const a = t * 2.6 - Math.PI / 2;
    const r = Math.max(W, MAP_H);
    const col = mode === "counteruav" ? "255,74,58" : "109,255,74";
    for (let i = 0; i < 18; i++) {
      g.fillStyle = `rgba(${col},${0.16 * (1 - i / 18)})`;
      g.beginPath(); g.moveTo(me[0], me[1]); g.arc(me[0], me[1], r, a - (i + 1) * 0.05, a - i * 0.05); g.closePath(); g.fill();
    }
    g.strokeStyle = `rgba(${col},.9)`; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(me[0], me[1]); g.lineTo(me[0] + Math.cos(a) * r, me[1] + Math.sin(a) * r); g.stroke();
    g.strokeStyle = `rgba(${col},.35)`; g.lineWidth = 1;
    for (const rr of [40, 80, 120]) { g.beginPath(); g.arc(me[0], me[1], rr, 0, Math.PI * 2); g.stroke(); }
  }
  if (mode === "counteruav") {
    // the jammer: static over the map and a red burst pulsing out
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(255,120,100,${Math.random() * 0.35})`;
      g.fillRect(Math.random() * W, Math.random() * MAP_H, 2 + Math.random() * 10, 1);
    }
    const r = 10 + ((t * 90) % 110);
    g.strokeStyle = RED; g.lineWidth = 2; g.globalAlpha = 1 - r / 120;
    g.beginPath(); g.arc(me[0], me[1], r, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
  }
  if (mode === "vsat") {
    // the satellite's footprint sweeping the whole map as a bright band
    const y = ((t * 70) % (MAP_H + 60)) - 30;
    const grad = g.createLinearGradient(0, y - 30, 0, y + 6);
    grad.addColorStop(0, "rgba(109,255,74,0)"); grad.addColorStop(1, "rgba(109,255,74,.3)");
    g.fillStyle = grad; g.fillRect(0, y - 30, W, 36);
    g.strokeStyle = "rgba(109,255,74,.8)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, y + 6.5); g.lineTo(W, y + 6.5); g.stroke();
  }
  if (mode === "strike") {
    g.strokeStyle = RED; g.lineWidth = 2;
    const r = 18 + Math.sin(t * 5) * 3;
    g.beginPath(); g.arc(W / 2, MAP_H / 2, r, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(W / 2 - 34, MAP_H / 2); g.lineTo(W / 2 + 34, MAP_H / 2); g.moveTo(W / 2, MAP_H / 2 - 34); g.lineTo(W / 2, MAP_H / 2 + 34); g.stroke();
  }
  // friendlies (cyan) and whoever the radar already shows (red), as the
  // minimap decides it
  if (game.remotes?.byId && game.isPvp?.()) {
    const show = game.enemiesRevealed?.();
    for (const rp of game.remotes.byId.values()) {
      if (!rp.alive) continue;
      const friendly = !game.currentMode?.().ffa && !!game.net?.team && rp.team === game.net.team;
      if (!friendly && !show) continue;
      const [x, z] = base.to(rp.pos.x, rp.pos.z);
      g.fillStyle = friendly ? CYAN : RED;
      g.beginPath();
      if (friendly) g.arc(x, z, 3.5, 0, Math.PI * 2);
      else { g.moveTo(x, z - 5); g.lineTo(x + 5, z); g.lineTo(x, z + 5); g.lineTo(x - 5, z); g.closePath(); }
      g.fill();
    }
  }
  // us: the blue chevron with a heading cone
  g.save();
  g.translate(me[0], me[1]);
  g.rotate(-yaw);
  g.fillStyle = "rgba(79,195,247,.14)";
  g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 46, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); g.closePath(); g.fill();
  g.fillStyle = "#79c8ff"; g.strokeStyle = "#0b2a44"; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(0, 3); g.lineTo(-5.5, 6); g.closePath(); g.fill(); g.stroke();
  g.restore();
  // compass rose, top right of the map; scale bar, bottom right
  g.strokeStyle = UI_DIM; g.fillStyle = UI; g.lineWidth = 1;
  g.beginPath(); g.arc(W - 24, 22, 13, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(W - 24, 10); g.lineTo(W - 20, 22); g.lineTo(W - 24, 19); g.lineTo(W - 28, 22); g.closePath(); g.fill();
  g.font = "bold 9px monospace"; g.fillText("N", W - 27, 24);
  g.fillStyle = UI; g.fillRect(W - 92, MAP_H - 12, 60, 2); g.fillRect(W - 92, MAP_H - 16, 1, 6); g.fillRect(W - 33, MAP_H - 16, 1, 6);
  g.font = "9px monospace"; g.fillText(`${Math.round(60 / base.k)} m`, W - 88, MAP_H - 27);
  g.restore();

  // --- the asset card, bottom left over the map: what's coming, drawn small
  const CX = 10, CY = MAP_Y + MAP_H - 86, CW = 150, CH = 80;
  g.fillStyle = "rgba(10,14,12,.82)"; g.fillRect(CX, CY, CW, CH);
  g.strokeStyle = UI_DIM; g.lineWidth = 1; g.strokeRect(CX + 0.5, CY + 0.5, CW - 1, CH - 1);
  g.fillStyle = AMBER; g.font = "bold 10px monospace"; g.fillText("ASSET", CX + 8, CY + 6);
  g.fillStyle = UI; g.font = "bold 11px monospace"; g.fillText(ASSET[mode] || "LINK", CX + 52, CY + 5);
  drawAssetGlyph(g, mode, CX + CW / 2, CY + 50, t);

  // --- the readout, bottom right: grid, altitude, channel
  const RX = W - 160, RY = CY, RW = 150;
  g.fillStyle = "rgba(10,14,12,.82)"; g.fillRect(RX, RY, RW, CH);
  g.strokeStyle = UI_DIM; g.strokeRect(RX + 0.5, RY + 0.5, RW - 1, CH - 1);
  g.font = "10px monospace"; g.fillStyle = UI_DIM;
  const gx = Math.round((me[0] - base.origin[0]) / base.k * 10 + 24000) % 100000, gz = Math.round((me[1] - base.origin[1]) / base.k * 10 + 55000) % 100000;
  const lines = [["GRID", `11S NA ${String(gx).padStart(5, "0")} ${String(gz).padStart(5, "0")}`], ["ALT", `${Math.round(412 + (game.move?.pos?.y || 0))} m MSL`],
    ["LINK", mode === "counteruav" ? "ECM  CH 3" : "SAT  CH 7"], ["ETA", confirmed ? "00:0" + Math.max(0, 8 - Math.floor(t)) : "--:--"]];
  lines.forEach(([k, v], i) => { g.fillStyle = UI_DIM; g.fillText(k, RX + 8, RY + 8 + i * 17); g.fillStyle = UI; g.fillText(v, RX + 46, RY + 8 + i * 17); });

  // --- the status bar: title, then GPS, link bars, battery and the zulu clock
  g.fillStyle = "#0b100d"; g.fillRect(0, 0, W, BAR_H);
  g.fillStyle = "rgba(216,222,212,.2)"; g.fillRect(0, BAR_H - 1, W, 1);
  g.fillStyle = UI; g.font = "bold 12px monospace"; g.fillText(TITLES[mode] || "TAC LINK", 10, 6);
  const now = new Date();
  g.font = "11px monospace"; g.fillStyle = UI_DIM;
  g.fillText(`${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")}Z`, W - 78, 7);
  // link bars (the last one blinks while it syncs), battery
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i < 3 || (t * 2) % 1 < 0.5 ? UI : "rgba(216,222,212,.2)";
    g.fillRect(W - 120 + i * 5, 16 - i * 3, 3, 3 + i * 3);
  }
  g.strokeStyle = UI; g.lineWidth = 1; g.strokeRect(W - 150.5, 7.5, 20, 10); g.fillStyle = UI; g.fillRect(W - 130, 10, 2, 5); g.fillRect(W - 149, 9, 14, 7);
  g.fillStyle = (t * 2) % 1 < 0.5 ? GREEN : "rgba(109,255,74,.3)";
  g.beginPath(); g.arc(W - 165, 12, 3.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = UI_DIM; g.font = "10px monospace"; g.fillText("GPS", W - 196, 7);

  // --- the foot: the call's state
  g.fillStyle = "#0b100d"; g.fillRect(0, H - FOOT_H, W, FOOT_H);
  g.fillStyle = "rgba(216,222,212,.2)"; g.fillRect(0, H - FOOT_H, W, 1);
  g.font = "bold 15px monospace";
  if (CONFIRMED[mode]) {
    if (confirmed) {
      g.fillStyle = "rgba(109,255,74,.22)"; g.fillRect(14, H - FOOT_H + 7, W - 28, 26);
      g.strokeStyle = GREEN; g.strokeRect(14.5, H - FOOT_H + 7.5, W - 29, 25);
      g.fillStyle = GREEN; g.fillText(CONFIRMED[mode], 26, H - FOOT_H + 12);
    } else {
      g.fillStyle = "rgba(255,179,71,.12)"; g.fillRect(14, H - FOOT_H + 7, W - 28, 26);
      g.strokeStyle = AMBER; g.lineWidth = 1.5; g.strokeRect(14.5, H - FOOT_H + 7.5, W - 29, 25);
      g.fillStyle = AMBER; g.fillText("CONFIRM", W / 2 - 32, H - FOOT_H + 12);
      g.font = "10px monospace"; g.fillStyle = UI_DIM; g.fillText("PRESS TO TASK", 26, H - FOOT_H + 15); g.fillText("ENC", W - 52, H - FOOT_H + 15);
    }
  } else if (mode === "strike") {
    g.fillStyle = AMBER; g.fillText("MARK 3 TARGETS", 26, H - FOOT_H + 12);
  } else {
    g.fillStyle = UI_DIM; g.fillText("STANDBY", 26, H - FOOT_H + 12);
  }
  g.drawImage(overlay(), 0, 0);
  s.tex.needsUpdate = true;

  // the glass: the glare slides as the tablet rocks in the hands
  if (s.glare) { s.glare.material.map.offset.x = Math.sin(t * 0.9) * 0.12 - 0.05; s.glare.material.map.offset.y = Math.cos(t * 0.7) * 0.06; }
  if (s.leds) s.leds[0].visible = (t * 2) % 1 < 0.5;
}

/* The small line drawing of the asset on the card. */
function drawAssetGlyph(g, mode, cx, cy, t) {
  g.save();
  g.translate(cx, cy);
  g.strokeStyle = UI; g.fillStyle = UI; g.lineWidth = 1.5; g.lineJoin = "round";
  if (mode === "uav" || mode === "counteruav") {
    // the Shadow from above: pod, twin booms, inverted-V tail
    g.beginPath(); g.moveTo(-50, 0); g.lineTo(50, 0); g.stroke();
    g.beginPath(); g.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-14, 2); g.lineTo(-14, 22); g.lineTo(14, 22); g.lineTo(14, 2); g.stroke();
    g.beginPath(); g.moveTo(-22, 22); g.lineTo(22, 22); g.stroke();
    if (mode === "counteruav") { g.fillStyle = RED; g.fillRect(-32, -3, 10, 6); g.fillRect(22, -3, 10, 6); }
  } else if (mode === "vsat") {
    g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(0, 0, 18, 6, 0, 0, Math.PI * 2); g.stroke();
    const a = t * 1.6, sx = Math.cos(a) * 34, sy = Math.sin(a) * 10;
    g.fillRect(sx - 3, sy - 3, 6, 6); g.fillRect(sx - 12, sy - 1.5, 7, 3); g.fillRect(sx + 5, sy - 1.5, 7, 3);
  } else if (mode === "gunship") {
    g.beginPath(); g.ellipse(0, 2, 26, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(20, 0, 34, 4); g.fillRect(50, -8, 4, 14); g.fillRect(-3, -14, 4, 8);
    const b = Math.sin(t * 40) * 40; g.fillRect(-2 - b, -16, b * 2 + 4, 2);
  } else if (mode === "strike") {
    g.beginPath(); g.moveTo(0, -22); g.lineTo(6, -4); g.lineTo(26, 6); g.lineTo(26, 10); g.lineTo(5, 6); g.lineTo(3, 18); g.lineTo(9, 22); g.lineTo(-9, 22); g.lineTo(-3, 18); g.lineTo(-5, 6); g.lineTo(-26, 10); g.lineTo(-26, 6); g.lineTo(-6, -4); g.closePath(); g.fill();
  } else if (mode === "k9") {
    const p = 1 + Math.sin(t * 8) * 0.05;
    g.beginPath(); g.ellipse(0, 6, 13 * p, 11 * p, 0, 0, Math.PI * 2); g.fill();
    for (const [dx, dy] of [[-16, -8], [-6, -17], [6, -17], [16, -8]]) { g.beginPath(); g.ellipse(dx, dy, 5, 6, dx * 0.02, 0, Math.PI * 2); g.fill(); }
  } else if (mode === "warship") {
    g.strokeStyle = UI_DIM; g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.stroke();
    const a = -t * 1.4;
    g.save(); g.translate(Math.cos(a) * 22, Math.sin(a) * 22); g.rotate(a);
    g.fillRect(-2, -9, 4, 18); g.fillRect(-12, -2, 24, 3); g.beginPath(); g.arc(-12, 0, 4, 0, Math.PI * 2); g.arc(12, 0, 4, 0, Math.PI * 2); g.fill();
    g.restore();
  } else if (mode === "swarm") {
    for (let i = 0; i < 10; i++) {
      const x = -50 + ((i * 23 + t * 40) % 100), y = -16 + ((i * 13) % 32) + Math.sin(t * 3 + i) * 2;
      g.fillRect(x - 1.5, y - 4, 3, 8); g.fillRect(x - 6, y - 1, 12, 2);
    }
  } else if (mode === "dragonfire") {
    g.rotate(Math.sin(t * 1.3) * 0.15);
    for (const [dx, dy] of [[-18, -14], [18, -14], [-18, 14], [18, 14]]) {
      g.beginPath(); g.moveTo(0, 0); g.lineTo(dx, dy); g.stroke();
      g.beginPath(); g.arc(dx, dy, 9, 0, Math.PI * 2); g.stroke();
      const a = t * 30 + dx;
      g.beginPath(); g.moveTo(dx - Math.cos(a) * 7, dy - Math.sin(a) * 7); g.lineTo(dx + Math.cos(a) * 7, dy + Math.sin(a) * 7); g.stroke();
    }
    g.fillRect(-5, -10, 10, 20);
  } else if (mode === "samturret") {
    g.fillRect(-14, -6, 11, 9); g.fillRect(3, -6, 11, 9); g.fillRect(-3, -3, 6, 12);
    g.beginPath(); g.moveTo(-10, 18); g.lineTo(0, 6); g.lineTo(10, 18); g.stroke();
  }
  g.restore();
}

/* -------------------------------------------------------- the smoke can */

/* The M18 smoke grenade: an olive-drab can with its label band, a red lid
   (the smoke's colour), the fuze on top with the fly-off lever down the
   side and the pull ring through it, and a strobe on top (the game's
   marker light). Built once per call from shared geometry and materials,
   so the held one and every thrown copy match. Origin at the can's base,
   up +y; 0.115 m tall. `strobe` is the mesh to blink, in userData. */
let _canGeo = null, _canMats = null;
function canParts() {
  if (_canGeo) return;
  _canGeo = {
    body: new THREE.CylinderGeometry(0.032, 0.032, 0.1, 18, 1, true),
    base: new THREE.CylinderGeometry(0.031, 0.0325, 0.006, 18),
    lid: new THREE.CylinderGeometry(0.0315, 0.0325, 0.009, 18),
    fuze: new THREE.CylinderGeometry(0.012, 0.011, 0.012, 12),
    fuzeCap: new THREE.CylinderGeometry(0.006, 0.006, 0.005, 10),
    ring: new THREE.TorusGeometry(0.011, 0.0014, 6, 14),
    pin: new THREE.CylinderGeometry(0.0012, 0.0012, 0.03, 5),
    spoon: merge([at(box(0.012, 0.0015, 0.034), 0, 0, 0.017), at(box(0.012, 0.062, 0.0015), 0, -0.031, 0.0345, -0.05)]),
    strobe: new THREE.SphereGeometry(0.0075, 10, 8),
    hole: new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 8),
  };
  // the label: an olive can with a yellow stencil band and black bars
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#4a4f3a"; g.fillRect(0, 0, 256, 128);
  g.fillStyle = "#d7b24a"; g.fillRect(0, 34, 256, 18);
  g.fillStyle = "#2c2f22";
  for (let i = 0; i < 8; i++) g.fillRect(12 + i * 30, 38, 8 + (i % 3) * 6, 10);
  g.fillStyle = "#c8321f"; g.fillRect(0, 0, 256, 14);
  g.fillStyle = "rgba(0,0,0,.25)"; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 256, 56 + Math.random() * 70, 2 + Math.random() * 20, 1);
  const label = new THREE.CanvasTexture(c);
  label.colorSpace = THREE.SRGBColorSpace;
  _canMats = {
    body: new THREE.MeshStandardMaterial({ map: label, roughness: 0.6, metalness: 0.45 }),
    olive: new THREE.MeshStandardMaterial({ color: 0x4a4f3a, roughness: 0.6, metalness: 0.45 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc8321f, roughness: 0.5, metalness: 0.3, emissive: 0x3a0804 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xa0a29c, roughness: 0.4, metalness: 0.85 }),
    strobe: new THREE.MeshBasicMaterial({ color: 0xff3322, toneMapped: false, transparent: true }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0a0a08, roughness: 0.8 }),
  };
  for (const m of Object.values(_canMats)) m.userData.shared = true;
}
export function buildSmokeCan() {
  canParts();
  const G = _canGeo, M = _canMats;
  const g = new THREE.Group();
  const mesh = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    g.add(m); return m;
  };
  mesh(G.body, M.body, 0, 0.055, 0);
  mesh(G.base, M.olive, 0, 0.003, 0);
  mesh(G.lid, M.red, 0, 0.1045, 0);
  for (let i = 0; i < 4; i++) mesh(G.hole, M.dark, Math.cos(i * Math.PI / 2 + 0.6) * 0.021, 0.109, Math.sin(i * Math.PI / 2 + 0.6) * 0.021);
  mesh(G.fuze, M.steel, 0, 0.115, 0);
  mesh(G.fuzeCap, M.steel, 0, 0.1235, 0);
  mesh(G.spoon, M.steel, 0, 0.1245, 0, 0, 0, 0);
  mesh(G.pin, M.steel, 0, 0.118, 0, 0, 0, Math.PI / 2);
  mesh(G.ring, M.steel, 0.019, 0.118, 0, 0, 0.3, 0);
  const strobe = mesh(G.strobe, M.strobe.clone(), 0, 0.1275, 0);
  g.userData.strobe = strobe;
  return g;
}

/* The care package's smoke grenade, held up ready to throw (BO2 calls a
   care package by throwing one). Lever side toward the palm. The right
   hand wraps the can; `strobe` blinks while it's in the hand. */
export function buildMarkerDevice() {
  const group = new THREE.Group();
  const can = buildSmokeCan();
  can.scale.setScalar(1.15);
  can.position.set(0, -0.03, -0.02);
  can.rotation.y = Math.PI / 2;
  group.add(can);
  group.userData.strobe = can.userData.strobe;

  const right = new THREE.Object3D();
  right.position.set(0, 0.0, -0.02);
  group.add(right);
  group.userData.anchors = { right, left: null };
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}
