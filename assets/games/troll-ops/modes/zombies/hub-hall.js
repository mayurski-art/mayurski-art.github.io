// Troll Forces — the Zombies hub (Zombie Rush P5).
//
// Where Zombies starts: a bright, blocky hall like Zombie Rush's lobby. Four
// map pads along the back (stand on one and you're in its party), a private
// pad by the west wall, the Weapons and Classes kiosks on the east, and the
// two leaderboards on the north wall. The pads' signs, the boards and the
// kiosk prompts are modes/zombies/hub.js's: this file is the room and where
// everything stands (HUB).
//
// Never a fighting map: left out of MAP_IDS, only MODES.zhub plays it.

import * as THREE from "three";

/* Where things stand. hub.js reads this; the numbers here are the colliders. */
export const HUB = {
  // a pad's floor area: you're on it while your feet are inside
  pads: [
    { id: "p1", map: "pentagrin", x: -15, z: -6, w: 6, d: 5 },
    { id: "p2", map: "hollowgrin", x: -8.4, z: -6, w: 6, d: 5 },
    { id: "p3", map: "trollcity", x: 8.4, z: -6, w: 6, d: 5 },
  ],
  private: { id: "priv", x: -15, z: 8, w: 5, d: 5 },
  // the sign over a pad's back edge, facing the room
  signY: 4.3,
  kiosks: [
    { id: "weapons", label: "Weapons", x: 16.6, z: 4, face: -Math.PI / 2 },
    { id: "classes", label: "Classes", x: 16.6, z: 10, face: -Math.PI / 2 },
  ],
  // the two boards on the north wall, at the end of the aisle between the
  // pads: centre, width, height, bottom edge
  boards: [
    { id: "wave", title: "Highest Wave", x: -2.65, z: -14.12, w: 5, h: 4.4, y: 1.3 },
    { id: "kills", title: "Total Kills", x: 2.65, z: -14.12, w: 5, h: 4.4, y: 1.3 },
  ],
};

const W = 40, D = 30, WALL_H = 7;
const PAD_GLOW = 0xb45cff;

/* A crate face: blue panel, orange frame, hazard stripes, a white X. */
let crateTex = null;
function crateTexture() {
  if (crateTex) return crateTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#f08a24"; g.fillRect(0, 0, 256, 256);
  // hazard band inside the frame
  g.save();
  g.beginPath(); g.rect(18, 18, 220, 220); g.rect(34, 34, 188, 188); g.clip("evenodd");
  g.fillStyle = "#f6d23a"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#1d1d22";
  for (let i = -256; i < 512; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 11, 0); g.lineTo(i + 11 + 256, 256); g.lineTo(i + 256, 256); g.fill(); }
  g.restore();
  g.fillStyle = "#3f86e8"; g.fillRect(34, 34, 188, 188);
  g.strokeStyle = "#cfe2ff"; g.lineWidth = 16; g.lineCap = "square";
  g.beginPath(); g.moveTo(52, 52); g.lineTo(204, 204); g.moveTo(204, 52); g.lineTo(52, 204); g.stroke();
  g.fillStyle = "#3f86e8"; g.fillRect(108, 108, 40, 40);
  g.strokeStyle = "#cfe2ff"; g.lineWidth = 8; g.strokeRect(112, 112, 32, 32);
  crateTex = new THREE.CanvasTexture(c);
  crateTex.colorSpace = THREE.SRGBColorSpace;
  crateTex.anisotropy = 4;
  return crateTex;
}

/* A plain text sign (the kiosks'): white bold capitals on a dark plate. */
function labelTexture(text, { w = 512, h = 128, bg = "#16233c", fg = "#ffffff", edge = "#f08a24" } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = edge; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = fg;
  g.font = `800 ${Math.round(h * 0.52)}px "DM Sans", system-ui, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildHub(api) {
  const root = new THREE.Group();
  api.prop(root);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
  const add = (geo, mat, x, y, z, { shadow = true } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true;
    root.add(m);
    return m;
  };

  // ---- the hall: pale walls, orange pillars, a blue band along the top
  api.walls(0, 0, W, D, WALL_H, 0.6, { color: 0xc9d4e6, pen: 14 });
  const band = std(0x3a63b8);
  for (const x of [-19.4, -9.75, 0, 9.75, 19.4]) {
    // none mid-north: the boards hang there
    for (const z of [-14.4, 14.4]) if (x || z > 0) api.box(x, z, 1.2, 0.9, WALL_H, { color: 0xe8682c, pen: 14 });
  }
  for (const z of [-7.5, 0, 7.5]) for (const x of [-19.4, 19.4]) api.box(x, z, 0.9, 1.2, WALL_H, { color: 0xe8682c, pen: 14 });
  add(new THREE.BoxGeometry(W, 0.6, 0.3), band, 0, WALL_H - 0.5, -14.25);
  add(new THREE.BoxGeometry(W, 0.6, 0.3), band, 0, WALL_H - 0.5, 14.25);
  add(new THREE.BoxGeometry(0.3, 0.6, D), band, -19.25, WALL_H - 0.5, 0);
  add(new THREE.BoxGeometry(0.3, 0.6, D), band, 19.25, WALL_H - 0.5, 0);
  // a darker dado round the foot of the walls, crate panels up the sides
  const dado = std(0x7f91b4, { roughness: 0.5 });
  add(new THREE.BoxGeometry(W - 1.2, 1.1, 0.12), dado, 0, 0.55, 14.34, { shadow: false });
  add(new THREE.BoxGeometry(0.12, 1.1, D - 1.2), dado, -19.34, 0.55, 0, { shadow: false });
  add(new THREE.BoxGeometry(0.12, 1.1, D - 1.2), dado, 19.34, 0.55, 0, { shadow: false });
  add(new THREE.BoxGeometry(W - 1.2, 1.1, 0.12), dado, 0, 0.55, -14.34, { shadow: false });
  const panelMat = new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.5, metalness: 0.1 });
  for (const [x, z, ry] of [[-19.32, -3.75, Math.PI / 2], [-19.32, 3.75, Math.PI / 2], [19.32, -3.75, -Math.PI / 2], [-19.32, 11.2, Math.PI / 2],
    [-14.6, 14.32, Math.PI], [-4.9, 14.32, Math.PI], [4.9, 14.32, Math.PI], [14.6, 14.32, Math.PI]]) {
    const m = add(new THREE.PlaneGeometry(3.2, 3.2), panelMat, x, 3.2, z, { shadow: false });
    m.rotation.y = ry;
  }

  // the floor: big pale tiles with dark seams, a blue walkway up the middle
  const floorTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#c3ccd9"; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#e9eef5"; g.fillRect(4, 4, 248, 248);
    g.fillStyle = "#dfe6ef"; g.fillRect(14, 14, 228, 228);
    g.strokeStyle = "rgba(150,165,190,.35)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(128, 14); g.lineTo(128, 242); g.moveTo(14, 128); g.lineTo(242, 128); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(W / 3, D / 3);
    t.anisotropy = 8;
    return t;
  })();
  const floor = add(new THREE.PlaneGeometry(W - 1.2, D - 1.2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.42, metalness: 0.05 }), 0, 0.004, 0, { shadow: false });
  floor.rotation.x = -Math.PI / 2;
  const walk = add(new THREE.PlaneGeometry(4, 27.6), new THREE.MeshStandardMaterial({ color: 0x5f7bb0, roughness: 0.5 }), 0, 0.008, 0.2, { shadow: false });
  walk.rotation.x = -Math.PI / 2;
  for (const dx of [-2.1, 2.1]) {
    const edge = add(new THREE.PlaneGeometry(0.18, 27.6), new THREE.MeshStandardMaterial({ color: 0xf6d23a, roughness: 0.5 }), dx, 0.01, 0.2, { shadow: false });
    edge.rotation.x = -Math.PI / 2;
  }

  // a skylight frame overhead (open: the sky shows through), steel trusses
  const truss = std(0x4a78d0, { metalness: 0.4, roughness: 0.45 });
  for (const z of [-10, -3.3, 3.3, 10]) add(new THREE.BoxGeometry(W, 0.35, 0.35), truss, 0, WALL_H + 0.2, z, { shadow: false });

  // ---- the board wall: a dark backing either side of a lit window
  const backing = std(0x1a2440);
  add(new THREE.BoxGeometry(11.2, 5.4, 0.2), backing, 0, 0.9 + 2.7, -14.3, { shadow: false });
  add(new THREE.BoxGeometry(11.8, 0.25, 0.4), std(0xf08a24), 0, 6.3, -14.25, { shadow: false });

  // ---- the pads: a dark deck, a glowing rim, glass sides you can't walk through
  const deck = std(0x2c3140, { roughness: 0.4, metalness: 0.3 });
  const rim = new THREE.MeshStandardMaterial({ color: PAD_GLOW, emissive: PAD_GLOW, emissiveIntensity: 1.6, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xd7a8ff, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0, depthWrite: false });
  const glassEdge = new THREE.MeshStandardMaterial({ color: 0xf2e6ff, emissive: 0xd9a6ff, emissiveIntensity: 0.6 });
  const pad = (p, sides) => {
    add(new THREE.BoxGeometry(p.w, 0.08, p.d), deck, p.x, 0.04, p.z, { shadow: false });
    const t = 0.14;
    add(new THREE.BoxGeometry(p.w, 0.1, t), rim, p.x, 0.07, p.z - p.d / 2 + t / 2, { shadow: false });
    add(new THREE.BoxGeometry(p.w, 0.1, t), rim, p.x, 0.07, p.z + p.d / 2 - t / 2, { shadow: false });
    add(new THREE.BoxGeometry(t, 0.1, p.d), rim, p.x - p.w / 2 + t / 2, 0.07, p.z, { shadow: false });
    add(new THREE.BoxGeometry(t, 0.1, p.d), rim, p.x + p.w / 2 - t / 2, 0.07, p.z, { shadow: false });
    // a grille down the middle, like the reference's vents
    const grille = std(0x1a1d26);
    for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(p.w * 0.5, 0.02, 0.08), grille, p.x, 0.09, p.z + i * 0.32, { shadow: false });
    // glass sides: knee-high panes on the named sides, colliders included
    const GH = 1.1;
    for (const s of sides) {
      const alongX = s === "n" || s === "s";
      const len = alongX ? p.w : p.d;
      const cx = s === "w" ? p.x - p.w / 2 : s === "e" ? p.x + p.w / 2 : p.x;
      const cz = s === "n" ? p.z - p.d / 2 : s === "s" ? p.z + p.d / 2 : p.z;
      api.ghostBox(cx, cz, alongX ? len : 0.12, alongX ? 0.12 : len, GH, { pen: 2 });
      const pane = add(new THREE.BoxGeometry(alongX ? len : 0.06, GH, alongX ? 0.06 : len), glass, cx, GH / 2, cz, { shadow: false });
      pane.renderOrder = 2;
      add(new THREE.BoxGeometry(alongX ? len : 0.1, 0.08, alongX ? 0.1 : len), glassEdge, cx, GH, cz, { shadow: false });
    }
  };
  for (const p of HUB.pads) pad(p, ["w", "e"]);
  pad(HUB.private, ["n", "w"]);
  // sign posts behind each pad (hub.js hangs the sign on them)
  const post = std(0x9aa6ba, { metalness: 0.5, roughness: 0.35 });
  for (const p of [...HUB.pads, HUB.private]) {
    for (const dx of [-p.w / 2 + 0.4, p.w / 2 - 0.4]) {
      api.box(p.x + dx, p.z - p.d / 2 - 0.25, 0.14, 0.14, HUB.signY - 0.9, { color: 0x9aa6ba, pen: 2 });
    }
  }

  // hazard stripes in front of the pads and round the private one
  const stripeTex = (() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 32;
    const g = c.getContext("2d");
    g.fillStyle = "#f6d23a"; g.fillRect(0, 0, 256, 32);
    g.fillStyle = "#1d1d22";
    for (let i = -32; i < 288; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 48, 32); g.lineTo(i + 32, 32); g.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  })();
  const stripe = (x, z, len, rotY = 0) => {
    const t = stripeTex.clone(); t.needsUpdate = true; t.repeat.set(len / 2, 1);
    const m = add(new THREE.PlaneGeometry(len, 0.25), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), x, 0.012, z, { shadow: false });
    m.rotation.set(-Math.PI / 2, 0, rotY);
  };
  stripe(-11.7, -3.2, 13.4);
  stripe(11.7, -3.2, 13.4);
  stripe(HUB.private.x + HUB.private.w / 2 + 0.35, HUB.private.z, HUB.private.d, Math.PI / 2);

  // ---- crates: stacks in the corners and between the kiosks
  const crateMat = new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.55, metalness: 0.1 });
  const crate = (x, z, s = 2.2, y = 0, rot = 0) => {
    api.ghostBox(x, z, s, s, s, { y, pen: 4 });
    const m = add(new THREE.BoxGeometry(s, s, s), crateMat, x, y + s / 2, z);
    m.rotation.y = rot;
  };
  crate(-17.6, -12.6); crate(-17.6, -10.3); crate(-17.6, -12.6, 2.2, 2.2); crate(-15.3, -12.6);
  crate(17.6, -12.6); crate(17.6, -10.3); crate(17.6, -12.6, 2.2, 2.2); crate(15.3, -12.6);
  crate(17.4, 13); crate(-17.4, 13); crate(-17.4, 13, 1.6, 2.2);
  crate(-7.2, -13.2, 1.6); crate(7.2, -13.2, 1.6);

  // ---- kiosks: a counter, a tilted screen, a sign overhead
  const counter = std(0x2d3a58, { metalness: 0.3, roughness: 0.45 });
  const trim = std(0xf08a24);
  const screen = new THREE.MeshStandardMaterial({ color: 0x0c1428, emissive: 0x2a6ad8, emissiveIntensity: 0.9, roughness: 0.2 });
  for (const k of HUB.kiosks) {
    const g = new THREE.Group();
    g.position.set(k.x, 0, k.z);
    g.rotation.y = k.face;
    root.add(g);
    // the collider is axis-aligned: the kiosks face west, so it's d along x
    api.ghostBox(k.x, k.z, 1.2, 2.6, 1.1, { pen: 4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.2), counter);
    body.position.y = 0.55; body.castShadow = body.receiveShadow = true; g.add(body);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.08, 1.3), trim);
    lip.position.y = 1.12; g.add(lip);
    const scr = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.06), screen);
    scr.position.set(0, 1.62, -0.25); scr.rotation.x = -0.35; g.add(scr);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: labelTexture(k.label), toneMapped: false }));
    sign.position.set(0, 2.9, -0.55); g.add(sign);
    for (const dx of [-1.1, 1.1]) {
      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), post);
      rod.position.set(dx, 2.0, -0.55); g.add(rod);
    }
  }

  // ---- light: daylight through the skylight, a purple wash off the pads
  for (const p of HUB.pads) {
    const l = new THREE.PointLight(PAD_GLOW, 6, 7, 2);
    l.position.set(p.x, 1.2, p.z);
    root.add(l);
  }
}

export const ZHUB = {
  name: "The Hub",
  blurb: "Pick a pad, wait for a squad, go.",
  bounds: { minX: -W / 2 + 0.6, maxX: W / 2 - 0.6, minZ: -D / 2 + 0.6, maxZ: D / 2 - 0.6 },
  playerSpawn: { x: 0, z: 10 },
  sky: { top: 0x3f8ee8, horizon: 0xbfe0ff, bottom: 0xd8e8f8, sun: 0.9, haze: 0.2, clouds: 0.5, cloudColor: 0xffffff, cloudShade: 0xb8c8e0 },
  fog: { color: 0xd8e6f6, density: 0.004 },
  exposure: 0.95,
  bloom: { threshold: 0.85, strength: 0.55, radius: 0.5 },
  ground: { colorA: 0xe4ebf4, colorB: 0xd8e1ec, grid: 0xc2cddc },
  sun: { color: 0xfff6e8, intensity: 2.0, pos: [14, 40, 18] },
  hemi: { sky: 0xdbe8ff, ground: 0x8a96ab, intensity: 1.2 },
  ambient: { color: 0xffffff, intensity: 0.6 },
  // stylised realism (view/grade-pass.js): a clean sunny day, a little more colour
  grade: { shadows: 0x2a3a58, shadowsAmt: 0.06, highlights: 0xfff4e0, highlightsAmt: 0.04, sat: 1.06, contrast: 1.04 },
  viewFar: 200,
  build: buildHub,
  // the open floor behind the pads, facing them
  spawns: [[0, 10], [-3, 11], [3, 11], [-6, 10], [6, 10], [0, 12.5], [-3, 8.5], [3, 8.5]],
};
