// Troll Forces — the Zombies hub: Grin & Sons Funeral Home (design doc
// "Zombie Rush: what's next", phase H0; claude.ai/artifact/4pfaNykEVdLDTmpYkxL1vs).
//
// Zombies start where the dead are laid out. The parlour is
// models/build_zhub.blender.py's (zh-hall, zh-pads, zh-props): each map pad
// is a velvet dais with an open casket at its back, its satin lit in the
// map's colour; the private pad is the family vault behind an iron fence; the
// Weapons kiosk is the embalming table, the Classes kiosk the chapel of rest;
// the two leaderboards hang on the memorial wall; a long-case clock counts
// down the season. The pads' signs, the boards, the clock's dial and the
// plates are modes/zombies/hub.js's: this file is the room, its colliders
// and where everything stands (HUB).
//
// Halloween (phase H0b) runs as long as Chapter One (core/season.js):
// Hollowgrin's jack-o'-lanterns (maps/jack-o-lantern.js), candles,
// cobwebs, bats, ground fog, a ghost by the vault, and the
// fourth pad, the Halloween run (Hollowgrin, double Credits, more of the dead
// in trollface masks).
//
// Never a fighting map: left out of MAP_IDS, only MODES.zhub plays it.

import * as THREE from "three";
import { loadModel } from "../../maps/battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1-hgb6";
import { RETEXTURE } from "../../maps/map-models.js?v=hg6e-sr1-or1-tx1-sp1-kbt1-gb1-kbb2-kbs1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-hgb2-ugb1-ug1-ugm1-hgb5-hgb6-hgb8";
import { halloween } from "../../core/season.js?v=zf1-wb1";
import { carveTexture, jackPieces } from "../../maps/jack-o-lantern.js?v=zf1-wb1";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const SPOOKY = halloween();

/* Where things stand. hub.js reads this; the numbers here are the colliders
   and match build_zhub.blender.py. */
export const HUB = {
  // a pad's floor area: you're on it while your feet are inside
  pads: [
    { id: "p1", map: "pentagrin", x: -15, z: -6, w: 6, d: 5 },
    { id: "p2", map: "hollowgrin", x: -8.4, z: -6, w: 6, d: 5 },
    { id: "p3", map: "trollcity", x: 8.4, z: -6, w: 6, d: 5 },
    // Chapter One only: the Halloween run (credits.js RUN_EVENTS)
    ...(SPOOKY ? [{ id: "p4", map: "hollowgrin", event: "halloween", x: 15, z: -6, w: 6, d: 5 }] : []),
  ],
  private: { id: "priv", x: -15, z: 8, w: 5, d: 5 },
  // the sign over a pad's back edge, facing the room
  signY: 4.3,
  kiosks: [
    { id: "weapons", label: "Weapons", sub: "The Embalming Room", x: 16.6, z: 4, face: -Math.PI / 2 },
    { id: "classes", label: "Classes", sub: "The Chapel of Rest", x: 16.6, z: 10, face: -Math.PI / 2 },
  ],
  // the two boards on the memorial wall: centre, width, height, bottom edge
  boards: [
    { id: "wave", title: "Highest Wave", x: -2.65, z: -14.12, w: 5, h: 4.4, y: 1.3 },
    { id: "kills", title: "Total Kills", x: 2.65, z: -14.12, w: 5, h: 4.4, y: 1.3 },
  ],
  // the long-case clock (its dial and the season's countdown, hub.js), the
  // collection lectern's plate (your Credits, hub.js)
  clock: { x: -19.0, z: 3.6, dialY: 2.23, plateY: 1.08 },
  lectern: { x: -4.2, z: 13.35 },
};

/* Each pad's satin (build_zhub.blender.py ZH_Satin*). */
export const PAD_COLOR = { p1: 0x5a8dff, p2: 0xff7a1a, p3: 0xffb43a, p4: 0xb45cff, priv: 0xd9c9a0 };

const W = 40, D = 30, WALL_H = 7;
const MODELS = ["zh-hall", "zh-pads", "zh-props", ...(SPOOKY ? ["zh-halloween"] : [])];
const CHANDELIERS = [[0, -3.5], [0, 3.5], [0, 10]];

// the GLBs' photo-textured materials: [surface, tiles per metre, lift]
const MAPPING = {
  ...RETEXTURE,
  ZH_Floor: ["wood", 0.9, 0.15],
  ZH_Walnut: ["wood", 1.2, 0.0],
  ZH_Plaster: ["plaster", 0.4],
  ZH_Marble: ["marble", 0.6],
  ZH_Stone: ["rock", 0.9, 0.4],
};

/* The parlour's wallpaper: a green damask, one repeat every 0.6 m. */
let damaskTex = null;
function damask() {
  if (damaskTex) return damaskTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#24402f"; g.fillRect(0, 0, 256, 256);
  // faint vertical stripes in the ground
  g.fillStyle = "rgba(255,255,255,.025)";
  for (let x = 0; x < 256; x += 16) g.fillRect(x, 0, 6, 256);
  // the motif, mirrored left to right, at the centre and the four corners
  const motif = (cx, cy, s) => {
    g.save(); g.translate(cx, cy); g.scale(s, s);
    for (const side of [1, -1]) {
      g.save(); g.scale(side, 1);
      g.beginPath();
      g.moveTo(0, -58);
      g.bezierCurveTo(22, -46, 30, -22, 12, -8);
      g.bezierCurveTo(34, -2, 44, 18, 26, 34);
      g.bezierCurveTo(16, 44, 6, 40, 0, 58);
      g.lineTo(0, -58);
      g.fill();
      g.beginPath(); g.ellipse(30, -30, 6, 12, 0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(36, 22, 5, 9, -0.6, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.restore();
  };
  g.fillStyle = "#335a42";
  motif(128, 128, 1);
  for (const [x, y] of [[0, 0], [256, 0], [0, 256], [256, 256]]) motif(x, y, 0.9);
  // a gold hairline round the centre motif
  g.strokeStyle = "rgba(201,162,74,.35)"; g.lineWidth = 2;
  g.beginPath(); g.ellipse(128, 128, 54, 74, 0, 0, Math.PI * 2); g.stroke();
  damaskTex = new THREE.CanvasTexture(c);
  damaskTex.colorSpace = THREE.SRGBColorSpace;
  damaskTex.wrapS = damaskTex.wrapT = THREE.RepeatWrapping;
  damaskTex.repeat.set(1 / 0.6, 1 / 0.6);
  damaskTex.anisotropy = 8;
  return damaskTex;
}

/* A kiosk's plaque: walnut, a brass rule, the name in cream capitals over
   the room's own name. */
function plaqueTexture(text, sub) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#3a2416"); grad.addColorStop(1, "#24160d");
  g.fillStyle = grad; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = "#c9a24a"; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
  g.strokeStyle = "rgba(201,162,74,.45)"; g.lineWidth = 2; g.strokeRect(16, 16, 480, 96);
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#f3e6c4";
  g.font = `700 52px Georgia, "Times New Roman", serif`;
  g.fillText(text.toUpperCase(), 256, 54);
  g.fillStyle = "#c9a24a";
  g.font = `italic 22px Georgia, "Times New Roman", serif`;
  g.fillText(sub, 256, 96);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* A flat engraved plate (the memorial wall's title). */
function engraved(text, w, h, size) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.clearRect(0, 0, w, h);
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `700 ${size}px Georgia, "Times New Roman", serif`;
  g.fillStyle = "#2a1a0e"; g.fillText(text, w / 2 + 2, h / 2 + 3);
  g.fillStyle = "#f6dc96"; g.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------ Halloween */

/* Hollowgrin's jack-o'-lanterns (maps/jack-o-lantern.js; user, 2026-10-30:
   "lets use the pumpkins we have in the hollowgrin map"), where
   zhub-pumpkins.json puts them: every body, stem, carved face and glow pool
   merged into one mesh each. The faces flicker together (hub.js). */
let poolTex = null;
function poolTexture() {
  if (poolTex) return poolTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,.55)");
  r.addColorStop(0.6, "rgba(255,255,255,.14)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return (poolTex = new THREE.CanvasTexture(c));
}
const CARVE_COLOR = new THREE.Color(0xffb24a).multiplyScalar(2.2);
function jackOLanterns(root) {
  fetch(new URL("../../models/zhub-pumpkins.json", import.meta.url).href).then((r) => r.json()).then((list) => {
    const bodies = [], stems = [], carves = [], pools = [];
    list.forEach((p, i) => {
      const j = jackPieces(p.x, p.y, p.z, { r: p.r, face: p.face, seed: 9100 + i, glow: p.r >= 0.2 });
      const n = j.body.attributes.position.count, col = new THREE.Color(j.hue), rgb = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) col.toArray(rgb, k * 3);
      j.body.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
      bodies.push(j.body); stems.push(j.stem);
      if (j.carve) carves.push(j.carve);
      if (j.pool) pools.push(j.pool);
    });
    const add = (geos, mat, name, shadow = false) => {
      if (!geos.length) return;
      const m = new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), mat);
      m.name = name;
      m.castShadow = shadow;
      root.add(m);
      return m;
    };
    add(bodies, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }), "dress_jacks");
    add(stems, new THREE.MeshStandardMaterial({ color: 0x4a5a26, roughness: 0.8 }), "dress_jack_stems");
    hallFx.carve = new THREE.MeshBasicMaterial({ map: carveTexture(), color: CARVE_COLOR.clone(), alphaTest: 0.5 });
    add(carves, hallFx.carve, "dress_jack_faces");
    hallFx.pool = new THREE.MeshBasicMaterial({ map: poolTexture(), color: new THREE.Color(0xff7a1a).multiplyScalar(0.55),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    add(pools, hallFx.pool, "dress_jack_glow");
  }).catch(() => { /* no pumpkins, then */ });
}
export const CARVE_BASE = CARVE_COLOR;

/* A cobweb in a corner: radial threads and rings on a transparent sheet. */
function webTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.strokeStyle = "rgba(235,235,240,.55)"; g.lineWidth = 1.4;
  const spokes = 9;
  for (let i = 0; i <= spokes; i++) {
    const a = (Math.PI / 2) * i / spokes;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 250, Math.sin(a) * 250); g.stroke();
  }
  for (let r = 30; r < 250; r += 26) {
    g.beginPath();
    for (let i = 0; i <= spokes; i++) {
      const a = (Math.PI / 2) * i / spokes, rr = r * (1 - 0.08 * Math.sin(i * 1.7));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (!i) g.moveTo(x, y); else g.quadraticCurveTo(Math.cos(a - 0.08) * rr * 0.92, Math.sin(a - 0.08) * rr * 0.92, x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Low fog drifting over the floor: a few big soft sheets (hub.js turns them). */
function fogTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  for (let i = 0; i < 40; i++) {
    const x = 30 + Math.random() * 196, y = 30 + Math.random() * 196, r = 30 + Math.random() * 50;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(170,160,200,.07)"); grad.addColorStop(1, "rgba(170,160,200,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const hallFx = { fog: [], ghost: null, carve: null, pool: null };

function dressHalloween(api, root) {
  jackOLanterns(root);
  const web = new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  // the ceiling's corners and the tops of the pads' sign frames
  const XI = W / 2 - 0.62, ZI = D / 2 - 0.62, top = WALL_H - 0.02;
  for (const [x, z, ry] of [[-XI, -ZI, 0], [XI, -ZI, -Math.PI / 2], [XI, ZI, Math.PI], [-XI, ZI, Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), web);
    m.geometry.translate(0.8, -0.8, 0);
    m.position.set(x, top, z);
    m.rotation.set(0, ry + Math.PI / 4, 0);
    m.name = "dress_web";
    root.add(m);
  }
  for (const p of HUB.pads) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), web);
    m.geometry.translate(0.35, -0.35, 0);
    m.position.set(p.x - (p.w - 0.4) / 2 - 0.1, HUB.signY + 0.95, p.z - p.d / 2 - 0.2);
    m.name = "dress_web";
    root.add(m);
  }
  const fogMat = new THREE.MeshBasicMaterial({ map: fogTexture(), transparent: true, depthWrite: false, toneMapped: false });
  for (const [x, z, s] of [[-14, 1, 9], [14, 1, 9], [-11, 12, 7], [11, 12, 7], [-8, -11.5, 7], [8, -11.5, 7]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), fogMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.06, z);
    m.renderOrder = 3;
    m.name = "dress_fog";
    root.add(m);
    hallFx.fog.push(m);
  }
  // Hollowgrin's porch ghost, under the middle chandelier
  loadModel("hg-ghost").then((g) => {
    g.position.set(-9.5, 4.2, 11);
    g.name = "dress_ghost";
    g.traverse((n) => { n.castShadow = false; });
    root.add(g);
    hallFx.ghost = g;
  }).catch(() => {});
}

/* ------------------------------------------------------------ the build */

function place(api, name, root) {
  loadModel(name, MAPPING).then((obj) => {
    obj.traverse((n) => {
      if (!n.isMesh) return;
      n.castShadow = false;
      for (const m of [].concat(n.material)) {
        if (m.name === "ZH_Wallpaper") { m.map = damask(); m.color.set(0xffffff); m.roughness = 0.85; m.needsUpdate = true; }
      }
    });
    root.add(obj);
  });
}

function buildHub(api) {
  const root = new THREE.Group();
  api.prop(root);
  for (const name of MODELS) place(api, name, root);

  // ---- the shell (colliders; zh-hall draws it), the old pillars' places
  api.ghostWalls(0, 0, W, D, WALL_H, 0.6, { pen: 14 });
  for (const x of [-19.4, -9.75, 0, 9.75, 19.4]) {
    // none mid-north (the boards) or mid-south (the front door)
    for (const z of [-14.4, 14.4]) if (x) api.ghostBox(x, z, 1.2, 0.9, WALL_H, { pen: 14 });
  }
  for (const z of [-7.5, 0, 7.5]) for (const x of [-19.4, 19.4]) api.ghostBox(x, z, 0.9, 1.2, WALL_H, { pen: 14 });

  // ---- the pads: ropes down the open sides, the casket, its candelabras,
  // the sign's posts
  const PAD_SIDE_H = 1.1;
  for (const p of HUB.pads) {
    for (const s of [-1, 1]) api.ghostBox(p.x + s * p.w / 2, p.z, 0.12, p.d, PAD_SIDE_H, { pen: 2 });
    const zc = p.z - p.d / 2 + 0.75;
    api.ghostBox(p.x, zc, 2.4, 0.8, 1.45, { pen: 6 });
    for (const s of [-1, 1]) {
      api.ghostBox(p.x + s * 1.65, zc, 0.36, 0.36, 1.7, { pen: 2 });
      api.ghostBox(p.x + s * (p.w / 2 - 0.4), p.z - p.d / 2 - 0.25, 0.24, 0.24, HUB.signY - 0.85, { pen: 2 });
    }
  }
  // the vault: fence on the north and west, piers, the sign's posts
  const v = HUB.private;
  api.ghostBox(v.x, v.z - v.d / 2, v.w, 0.12, 1.2, { pen: 2 });
  api.ghostBox(v.x - v.w / 2, v.z, 0.12, v.d, 1.2, { pen: 2 });
  for (const [x, z] of [[v.x - v.w / 2, v.z - v.d / 2], [v.x + v.w / 2, v.z - v.d / 2], [v.x - v.w / 2, v.z + v.d / 2]]) api.ghostBox(x, z, 0.52, 0.52, 1.8, { pen: 6 });
  for (const s of [-1, 1]) api.ghostBox(v.x + s * (v.w / 2 - 0.4), v.z - v.d / 2 - 0.25, 0.14, 0.14, HUB.signY - 0.85, { pen: 2 });

  // ---- the kiosks: the table, its lamp, the shelves; the altar and the pews
  for (const k of HUB.kiosks) api.ghostBox(k.x, k.z, 1.2, 2.6, 1.1, { pen: 4 });
  api.ghostBox(16.4, 5.65, 0.4, 0.4, 1.9, { pen: 2 });
  api.ghostBox(W / 2 - 0.6 - 0.21, 4, 0.42, 2.56, 2.35, { pen: 4 });
  for (const x of [13.4, 11.7]) api.ghostBox(x - 0.03, 10, 0.62, 2.86, 1.1, { pen: 3 });
  // the memorial wall: its ledge, the wreaths
  api.ghostBox(0, -14.12, 11.0, 0.56, 1.03, { pen: 6 });
  for (const s of [-1, 1]) api.ghostBox(s * 6.5, -13.55, 0.9, 0.6, 1.9, { pen: 2 });
  // the clock, the organ and its bench, the lectern, the ferns
  api.ghostBox(HUB.clock.x, HUB.clock.z, 0.52, 0.78, 2.95, { pen: 6 });
  api.ghostBox(-19.03, -1.95, 0.75, 2.4, 1.6, { pen: 6 });
  api.ghostBox(-18.1, -1.95, 0.4, 1.3, 0.56, { pen: 3 });
  api.ghostBox(HUB.lectern.x + 0.15, HUB.lectern.z, 0.95, 0.55, 1.1, { pen: 3 });
  for (const [x, z] of [[-18, 13], [18, 13], [-18.2, -12.9], [18.2, -12.9]]) api.ghostBox(x, z, 0.7, 0.7, 1.3, { pen: 2 });

  // ---- the plaques the GLBs leave blank
  for (const k of HUB.kiosks) {
    const g = new THREE.Group();
    g.position.set(k.x, 0, k.z);
    g.rotation.y = k.face;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: plaqueTexture(k.label, k.sub), toneMapped: false }));
    sign.position.set(0, 2.9, -0.55);
    g.add(sign);
    // its rods: brass, from the floor behind the furniture
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xc49a48, metalness: 0.6, roughness: 0.35 });
    for (const dx of [-1.15, 1.15]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.9, 8), rodMat);
      rod.position.set(dx, 1.45, -0.6);
      g.add(rod);
    }
    root.add(g);
  }
  const title = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.42), new THREE.MeshBasicMaterial({ map: engraved("In Loving Memory", 1024, 136, 92), transparent: true, toneMapped: false }));
  title.position.set(0, 6.17, -14.4 + 0.25);
  root.add(title);

  // ---- light: the three chandeliers (the caskets' satin glows by itself:
  // a light per casket cost a phone too much)
  for (const [x, z] of CHANDELIERS) {
    const l = new THREE.PointLight(0xffcf8a, SPOOKY ? 9 : 12, 15, 1.6);
    l.position.set(x, 4.9, z);
    root.add(l);
  }
  layOutGuns(root);
  if (SPOOKY) dressHalloween(api, root);
}

/* Two of the game's own guns on the embalming table's bare half, lying on
   their sides, barrels toward the wall. */
function layOutGuns(root) {
  const k = HUB.kiosks.find((q) => q.id === "weapons");
  [["ar-lol", -0.2, -0.55], ["coltlmg", 0.18, -0.45]].forEach(([name, dx, dz]) => {
    loadModel(name).then((gun) => {
      const box = new THREE.Box3().setFromObject(gun), size = box.getSize(new THREE.Vector3());
      const long = size.x >= size.z ? "x" : "z";
      gun.scale.setScalar(0.95 / Math.max(size.x, size.z));
      const holder = new THREE.Group();
      holder.add(gun);
      // its length along z, lying on its side
      if (long === "x") gun.rotation.y = Math.PI / 2;
      holder.rotation.z = Math.PI / 2;
      const b2 = new THREE.Box3().setFromObject(holder);
      holder.position.set(k.x + dx, 0.925 - b2.min.y, k.z + dz);
      holder.name = "dress_gun";
      root.add(holder);
    }).catch(() => {});
  });
}

export const ZHUB = {
  name: "Grin & Sons",
  blurb: "Pick a casket, wait for a squad, go.",
  bounds: { minX: -W / 2 + 0.6, maxX: W / 2 - 0.6, minZ: -D / 2 + 0.6, maxZ: D / 2 - 0.6 },
  playerSpawn: { x: 0, z: 10 },
  // night outside; the room is lit from within
  sky: { top: 0x0b1024, horizon: 0x1c2444, bottom: 0x0a0c16, sun: 0.0, haze: 0.1, clouds: 0.2, cloudColor: 0x39405a, cloudShade: 0x1a1e2c },
  fog: { color: SPOOKY ? 0x2a2236 : 0x2a2420, density: SPOOKY ? 0.012 : 0.006 },
  exposure: 1.0,
  bloom: { threshold: 0.9, strength: SPOOKY ? 0.7 : 0.55, radius: 0.55 },
  ground: { colorA: 0x3a2a1e, colorB: 0x33251a, grid: 0x2a1e14 },
  sun: { color: 0x9fb0d8, intensity: 0.15, pos: [14, 40, 18] },
  hemi: { sky: 0xffe2b8, ground: 0x4a3326, intensity: SPOOKY ? 0.55 : 0.7 },
  ambient: { color: 0xffe8cc, intensity: SPOOKY ? 0.28 : 0.35 },
  // warm lamplight; Halloween leans the shadows violet
  grade: SPOOKY
    ? { shadows: 0x3a2458, shadowsAmt: 0.12, highlights: 0xffd8a0, highlightsAmt: 0.06, sat: 1.08, contrast: 1.06 }
    : { shadows: 0x2a1e18, shadowsAmt: 0.08, highlights: 0xffe4b8, highlightsAmt: 0.06, sat: 1.04, contrast: 1.05 },
  viewFar: 120,
  build: buildHub,
  // the open floor behind the pads, facing them
  spawns: [[0, 10], [-3, 11], [3, 11], [-6, 10], [6, 10], [0, 12.5], [-3, 8.5], [3, 8.5]],
};
