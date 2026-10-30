// Troll Forces — the Tactical Nuke's handheld (TACTICAL-NUKE doc, phase 1).
//
// A rugged military handheld in the PLGR / DAGR mould the old CoD
// killstreak remotes were drawn from, not a tablet: a tall olive polymer
// brick with chamfered edges and worn paint, rubber overmould on the
// corners and ribbed side grips, a sun-hooded LCD up top, three soft keys
// and a 4x3 rubber keypad under it, a helical stub antenna and a knurled
// knob on the top, and the red ARM key under a flip-up guard at the
// bottom. The back carries the battery box, its latches and a data plate.
// Same grip anchors ({ right, left }) as before, so view/streak-view.js
// hangs the arms on it.
//
// The guard and the key move by setNukeControls (cover 0 shut .. 1 up,
// press 0..1); drawNukeScreen redraws the LCD and works the keypad: the
// launch code (NUKE_CODE) is punched in key by key before ARM? comes up.

import * as THREE from "three";

const W = 0.088, H = 0.205, D = 0.036;
const SCR_W = 0.064, SCR_H = 0.05, SCR_Y = H / 2 - 0.043;
const PX_W = 256, PX_H = 200;
const FACE_Z = D / 2;                  // the front plane

/* The arming code and when each digit goes in (seconds into the hold).
   streaks/nuke.js times the guard and the key off NUKE_CODE.done. */
export const NUKE_CODE = { digits: "09192008", at: 0.5, step: 0.14 };
NUKE_CODE.done = NUKE_CODE.at + NUKE_CODE.digits.length * NUKE_CODE.step;
/* How many digits are in at `t`. */
export function nukeCodeTyped(t) {
  return Math.max(0, Math.min(NUKE_CODE.digits.length, Math.floor((t - NUKE_CODE.at) / NUKE_CODE.step) + 1));
}

// The mascot is the real trollface art (never the emoji), etched into the
// shell and shown on the boot screen.
const face = new Image();
face.src = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

/* A rounded, chamfered slab w x h x d centred on the origin, its faces on
   +-z. `r` rounds the corners in plan, `b` bevels every edge. */
function slab(w, h, d, r, b, mat) {
  const s = new THREE.Shape();
  const x = -(w / 2 - b), y = -(h / 2 - b), iw = w - 2 * b, ih = h - 2 * b, rr = Math.max(0.0005, Math.min(r, iw / 2, ih / 2));
  s.moveTo(x + rr, y);
  s.lineTo(x + iw - rr, y); s.quadraticCurveTo(x + iw, y, x + iw, y + rr);
  s.lineTo(x + iw, y + ih - rr); s.quadraticCurveTo(x + iw, y + ih, x + iw - rr, y + ih);
  s.lineTo(x + rr, y + ih); s.quadraticCurveTo(x, y + ih, x, y + ih - rr);
  s.lineTo(x, y + rr); s.quadraticCurveTo(x, y, x + rr, y);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.0002, d - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 5,
  });
  g.translate(0, 0, -(d - 2 * b) / 2);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function cyl(rt, rb, h, seg, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }

/* Worn olive paint: mottled, scuffed lighter where hands rub, a few
   scratches through to the grey primer, grime in the low spots. The same
   canvas drives a bump map so the polymer has grain. */
let wearTex = null;
function wear() {
  if (wearTex) return wearTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  let seed = 9192008;
  const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6b43a9b5 >>> 0) / 4294967296);
  g.fillStyle = "#4f5536";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const v = rnd();
    g.fillStyle = v < 0.5 ? `rgba(30,32,18,${0.02 + rnd() * 0.04})` : `rgba(140,146,104,${0.015 + rnd() * 0.03})`;
    const r = 1 + rnd() * 9;
    g.beginPath(); g.arc(rnd() * 256, rnd() * 256, r, 0, Math.PI * 2); g.fill();
  }
  // Scratches through the paint.
  g.lineCap = "round";
  for (let i = 0; i < 46; i++) {
    const x = rnd() * 256, y = rnd() * 256, a = rnd() * Math.PI, l = 4 + rnd() * 22;
    g.strokeStyle = `rgba(170,168,150,${0.12 + rnd() * 0.28})`;
    g.lineWidth = 0.6 + rnd() * 1.1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // Fine grain.
  const img = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 16;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  wearTex = new THREE.CanvasTexture(c);
  wearTex.colorSpace = THREE.SRGBColorSpace;
  wearTex.wrapS = wearTex.wrapT = THREE.RepeatWrapping;
  wearTex.repeat.set(9, 9);       // UVs here are in metres: a tile every 11 cm
  wearTex.anisotropy = 4;
  return wearTex;
}

/* Printed key tops: one atlas, a cell per key, each key's label plane
   showing its own cell. */
const KEY_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "ENT", "MENU", "NAV", "PWR"];
let keyAtlas = null;
function keyLabelTex(i) {
  if (!keyAtlas) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 128;
    const g = c.getContext("2d");
    g.textAlign = "center"; g.textBaseline = "middle";
    KEY_LABELS.forEach((l, k) => {
      const cx = (k % 8) * 64 + 32, cy = Math.floor(k / 8) * 64 + 32;
      g.fillStyle = k === 11 ? "#ffd25a" : "#e9e6d8";
      g.font = l.length > 1 ? "bold 17px monospace" : "bold 36px monospace";
      g.fillText(l, cx, cy + 1);
    });
    keyAtlas = new THREE.CanvasTexture(c);
    keyAtlas.colorSpace = THREE.SRGBColorSpace;
    keyAtlas.anisotropy = 4;
  }
  const t = keyAtlas.clone();
  t.repeat.set(1 / 8, 1 / 2);
  t.offset.set((i % 8) / 8, 1 - (Math.floor(i / 8) + 1) / 2);
  t.needsUpdate = true;
  return t;
}

/* The stencilled face and back markings, on transparent decals. */
function decalTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function decal(w, h, tex, opacity = 1) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
    map: tex, transparent: true, opacity, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  }));
}

export function buildNukeDevice() {
  const group = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xd2d2c8, map: wear(), bumpMap: wear(), bumpScale: 0.6, roughness: 0.74, metalness: 0.04 });
  const plate = new THREE.MeshStandardMaterial({ color: 0x2b2d27, roughness: 0.62, metalness: 0.12 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1a1b19, roughness: 0.93, metalness: 0.0 });
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x24251f, roughness: 0.82, metalness: 0.0 });
  const bezel = new THREE.MeshStandardMaterial({ color: 0x090a09, roughness: 0.45, metalness: 0.25 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8c8f88, roughness: 0.38, metalness: 0.85 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb8913c, roughness: 0.35, metalness: 0.9 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc41a10, roughness: 0.4, emissive: 0x3a0402 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xd8a21c, roughness: 0.55, metalness: 0.05 });

  // The body: an olive slab, a darker inset face plate on the front.
  group.add(slab(W, H, D, 0.012, 0.004, shell));
  const facePlate = slab(W - 0.012, H - 0.03, 0.004, 0.006, 0.0008, plate);
  facePlate.position.set(0, -0.004, FACE_Z - 0.0012);
  group.add(facePlate);
  const PZ = FACE_Z + 0.0008;          // the face plate's front

  // Rubber overmould: corner bumpers wrapping round, and ribbed side grips.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const bw = sy < 0 ? 0.017 : 0.024;
    const b = slab(bw, 0.03, D + 0.006, 0.007, 0.003, rubber);
    b.position.set(sx * (W / 2 - bw / 2 + 0.003), sy * (H / 2 - 0.012), 0);
    group.add(b);
  }
  for (const sx of [-1, 1]) {
    const grip = slab(0.007, H * 0.5, D - 0.004, 0.003, 0.0015, rubber);
    grip.position.set(sx * (W / 2 + 0.0012), -H * 0.08, 0);
    group.add(grip);
    for (let i = 0; i < 9; i++) {
      const rib = box(0.0026, 0.003, D - 0.008, rubber);
      rib.position.set(sx * (W / 2 + 0.0045), -H * 0.08 - H * 0.21 + i * H * 0.0525, 0);
      group.add(rib);
    }
  }

  // Top: the helical stub antenna on its rubber boot, the knurled channel
  // knob, and two brass RF ports between them.
  const boot = cyl(0.0068, 0.0085, 0.014, 14, rubber);
  boot.position.set(W / 2 - 0.016, H / 2 + 0.006, -0.002);
  group.add(boot);
  const prof = [];
  for (let i = 0; i <= 40; i++) {
    const y = i / 40 * 0.05;
    prof.push(new THREE.Vector2(0.0048 + Math.abs(Math.sin(i * Math.PI / 4)) * 0.0011 - (i > 36 ? (i - 36) * 0.0008 : 0), y));
  }
  prof.push(new THREE.Vector2(0, 0.05));
  const whip = new THREE.Mesh(new THREE.LatheGeometry(prof, 14), rubber);
  whip.position.set(W / 2 - 0.016, H / 2 + 0.013, -0.002);
  group.add(whip);
  const knob = cyl(0.0085, 0.0085, 0.012, 28, steel);
  knob.material = new THREE.MeshStandardMaterial({ color: 0x3a3c37, roughness: 0.5, metalness: 0.6, flatShading: true });
  knob.position.set(-W / 2 + 0.018, H / 2 + 0.006, -0.001);
  const knobCap = cyl(0.006, 0.0075, 0.003, 20, steel);
  knobCap.position.set(knob.position.x, H / 2 + 0.0135, -0.001);
  const knobMark = box(0.0012, 0.001, 0.005, amber);
  knobMark.position.set(knob.position.x, H / 2 + 0.0151, 0.001);
  group.add(knob, knobCap, knobMark);
  for (const px of [-0.004, 0.009]) {
    const hex = cyl(0.0034, 0.0034, 0.004, 6, brass);
    hex.position.set(px, H / 2 + 0.002, 0);
    const pin = cyl(0.0012, 0.0012, 0.005, 8, bezel);
    pin.position.set(px, H / 2 + 0.0035, 0);
    group.add(hex, pin);
  }

  // The LCD, sunk in its bezel, under a three-sided sun hood.
  const frame = slab(SCR_W + 0.01, SCR_H + 0.01, 0.003, 0.003, 0.0008, bezel);
  frame.position.set(0, SCR_Y, PZ + 0.0008);
  group.add(frame);
  const canvas = document.createElement("canvas");
  canvas.width = PX_W;
  canvas.height = PX_H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCR_W, SCR_H), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(0, SCR_Y, PZ + 0.0024);
  group.add(screen);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(SCR_W + 0.002, SCR_H + 0.002), new THREE.MeshStandardMaterial({
    color: 0x0a0c0c, roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.16, depthWrite: false,
  }));
  glass.position.set(0, SCR_Y, PZ + 0.0026);
  group.add(glass);
  const hoodTop = slab(SCR_W + 0.016, 0.004, 0.011, 0.001, 0.0008, rubber);
  hoodTop.position.set(0, SCR_Y + SCR_H / 2 + 0.007, PZ + 0.005);
  group.add(hoodTop);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BufferGeometry(), rubber);
    // A wedge: full depth at the top, nothing at the bottom of the screen.
    const x0 = sx * (SCR_W / 2 + 0.0055), t = 0.003, y0 = SCR_Y - SCR_H / 2 - 0.003, y1 = SCR_Y + SCR_H / 2 + 0.009;
    const z0 = PZ, z1 = PZ + 0.0105;
    const xa = x0 - t / 2, xb = x0 + t / 2;
    const v = [
      [xa, y0, z0], [xa, y1, z0], [xa, y1, z1],
      [xb, y0, z0], [xb, y1, z0], [xb, y1, z1],
    ];
    const tri = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3];
    const pos = [];
    for (const i of tri) pos.push(...v[i]);
    side.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    side.geometry.computeVertexNormals();
    side.material = rubber.clone();
    side.material.side = THREE.DoubleSide;
    group.add(side);
  }

  // Status LEDs under the screen's right corner.
  const ledOn = new THREE.MeshBasicMaterial({ color: 0x47ff6a, toneMapped: false });
  const ledRed = new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false });
  const ledOff = new THREE.MeshStandardMaterial({ color: 0x2a1210, roughness: 0.3 });
  const leds = [];
  for (let i = 0; i < 2; i++) {
    const l = cyl(0.0014, 0.0014, 0.0012, 10, i ? ledOff : ledOn);
    l.rotation.x = Math.PI / 2;
    l.position.set(SCR_W / 2 - 0.004 - i * 0.006, SCR_Y - SCR_H / 2 - 0.0085, PZ + 0.0006);
    group.add(l);
    leds.push(l);
  }

  // The keys: three soft keys, then the 4x3 pad. Each a rubber dome with
  // its printed top; `keys` maps a label to { mesh, z }.
  const keys = {};
  const addKey = (label, x, y, w, h) => {
    const k = slab(w, h, 0.0045, 0.0022, 0.0011, keyMat);
    k.position.set(x, y, PZ + 0.0012);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w, h * 1.4) * 0.9, Math.min(w, h * 1.4) * 0.45), new THREE.MeshBasicMaterial({
      map: keyLabelTex(KEY_LABELS.indexOf(label)), transparent: true, depthWrite: false, color: 0xcfcbb8,
    }));
    lab.position.z = 0.00235;
    k.add(lab);
    k.userData.lab = lab;
    group.add(k);
    keys[label] = { mesh: k, z: k.position.z };
  };
  const softY = SCR_Y - SCR_H / 2 - 0.016;
  ["MENU", "NAV", "PWR"].forEach((l, i) => addKey(l, (i - 1) * 0.022, softY, 0.018, 0.008));
  const PAD = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["CLR", "0", "ENT"]];
  PAD.forEach((row, r) => row.forEach((l, c) => addKey(l, (c - 1) * 0.022, softY - 0.016 - r * 0.0148, 0.018, 0.0115)));
  // The well round the pad.
  const padWell = slab(0.07, 0.066, 0.0012, 0.004, 0.0003, bezel);
  padWell.position.set(0, softY - 0.016 - 1.5 * 0.0148, PZ + 0.0001);
  group.add(padWell);

  // The red ARM key under its hinged guard, at the bottom.
  const keyY = -H / 2 + 0.031;
  const well = slab(0.044, 0.03, 0.003, 0.004, 0.0008, bezel);
  well.position.set(0, keyY, PZ + 0.0006);
  group.add(well);
  const key = cyl(0.0095, 0.0105, 0.007, 20, red);
  key.rotation.x = Math.PI / 2;
  key.position.set(0, keyY, PZ + 0.0045);
  group.add(key);
  const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.0118, 0.0014, 6, 24), steel);
  keyRing.position.set(0, keyY, PZ + 0.0022);
  group.add(keyRing);
  // Yellow-and-black hazard border round the well.
  const hazard = decal(0.05, 0.04, decalTex(216, 160, (g, w, h) => {
    g.save();
    g.beginPath(); g.rect(0, 0, w, h); g.rect(14, 14, w - 28, h - 28); g.clip("evenodd");
    g.fillStyle = "#d9a51e"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#121210";
    for (let x = -h; x < w + h; x += 26) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 13, 0); g.lineTo(x + 13 - h, h); g.lineTo(x - h, h); g.fill(); }
    g.restore();
    // Worn off at the corners.
    for (let i = 0; i < 70; i++) { g.clearRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 1 + Math.random() * 2); }
  }));
  hazard.position.set(0, keyY, PZ + 0.0002);
  group.add(hazard);
  // The guard hinges along its bottom edge; at 0 it lies flat over the
  // key, and it flips down and out, clear of the keypad.
  const hinge = new THREE.Group();
  hinge.position.set(0, keyY - 0.016, PZ + 0.0095);
  const coverMat = new THREE.MeshStandardMaterial({ color: 0xd4321c, roughness: 0.3, metalness: 0.05, transparent: true, opacity: 0.68 });
  const cover = slab(0.04, 0.03, 0.0035, 0.004, 0.0008, coverMat);
  cover.position.set(0, 0.0155, 0);
  hinge.add(cover);
  for (const sx of [-1, 1]) {
    const wall = box(0.0025, 0.03, 0.007, coverMat);
    wall.position.set(sx * 0.0188, 0.0155, -0.0036);
    hinge.add(wall);
  }
  const tab = box(0.012, 0.004, 0.004, coverMat);
  tab.position.set(0, 0.032, 0.001);
  hinge.add(tab);
  const pin = cyl(0.0022, 0.0022, 0.046, 8, steel);
  pin.rotation.z = Math.PI / 2;
  hinge.add(pin);
  group.add(hinge);
  for (const sx of [-1, 1]) {
    const knuckle = cyl(0.0034, 0.0034, 0.006, 10, plate);
    knuckle.rotation.z = Math.PI / 2;
    knuckle.position.set(sx * 0.0225, keyY - 0.016, PZ + 0.0095);
    group.add(knuckle);
    const post = box(0.004, 0.004, 0.009, plate);
    post.position.set(sx * 0.0225, keyY - 0.016, PZ + 0.004);
    group.add(post);
  }

  // Back: the raised battery box with its two latches and a data plate.
  const batt = slab(W - 0.024, H * 0.56, 0.007, 0.005, 0.0015, shell);
  batt.position.set(0, -0.02, -D / 2 - 0.0025);
  group.add(batt);
  for (const sy of [-1, 1]) {
    const latch = slab(0.022, 0.006, 0.004, 0.002, 0.0008, plate);
    latch.position.set(0, -0.02 + sy * H * 0.25, -D / 2 - 0.0062);
    group.add(latch);
  }
  const dataPlate = decal(0.05, 0.03, decalTex(400, 240, (g, w, h) => {
    g.fillStyle = "#b9b6a2"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#2a2a24"; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = "#1e1e1a"; g.font = "bold 30px monospace";
    g.fillText("UPLINK, TACTICAL", 22, 50);
    g.font = "24px monospace";
    g.fillText("TU-09(V)2/PSQ", 22, 92);
    g.fillText("NSN 5895-01-919-2008", 22, 130);
    g.fillText("CONT DAAB07-92-C-T419", 22, 168);
    g.fillText("U.S.", 22, 206);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(90,86,60,${Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 1 + Math.random() * 3); }
  }));
  dataPlate.rotation.y = Math.PI;
  dataPlate.position.set(0, 0.002, -D / 2 - 0.0063);
  group.add(dataPlate);
  // Lanyard loop off the bottom left bumper.
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0014, 6, 16), steel);
  loop.position.set(-W / 2 + 0.008, -H / 2 - 0.004, 0);
  group.add(loop);

  // The etched trollface on the battery door, under the data plate.
  const etchTex = new THREE.Texture(face);
  etchTex.colorSpace = THREE.SRGBColorSpace;
  const etchUp = () => { etchTex.image = face; etchTex.needsUpdate = true; };
  if (face.complete && face.naturalWidth) etchUp(); else face.addEventListener("load", etchUp, { once: true });
  const etch = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.022), new THREE.MeshBasicMaterial({
    map: etchTex, transparent: true, opacity: 0.32, color: 0x9aa07c, depthWrite: false,
  }));
  etch.position.set(0, -0.042, -D / 2 - 0.0063);
  etch.rotation.y = Math.PI;
  group.add(etch);

  group.userData.anchors = {
    right: gripAnchor(W / 2, -H * 0.1, 0, -1),
    left: gripAnchor(-W / 2, -H * 0.1, 0, 1),
  };
  group.add(group.userData.anchors.right, group.userData.anchors.left);
  group.userData.screen = { canvas, ctx: canvas.getContext("2d"), tex };
  group.userData.hinge = hinge;
  group.userData.key = key;
  group.userData.keyZ = key.position.z;
  group.userData.keys = keys;
  group.userData.leds = { leds, ledOn, ledRed, ledOff };
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

function gripAnchor(x, y, z, inward) {
  const a = new THREE.Object3D();
  a.position.set(x, y, z);
  a.userData.inward = inward;
  return a;
}

/* Guard angle (0 shut .. 1 flipped up) and key travel (0..1). */
export function setNukeControls(device, cover, press) {
  device.userData.hinge.rotation.x = cover * 2.1;
  device.userData.key.position.z = device.userData.keyZ - press * 0.005;
}

/* The slam on the red key, `s` seconds from the moment it goes down (the
   arm): the hand winds up off the device for a beat, comes down hard, the
   key bottoms out and stays down a moment, and the whole handheld jolts
   with the hit and rings out. { lift 0..1, press 0..1, jolt 0..1 }. */
export const SLAM_WIND = 0.22;
export function nukeSlam(s) {
  if (s < -SLAM_WIND || s > 0.7) return { lift: 0, press: 0, jolt: 0 };
  if (s < -0.05) { const k = (s + SLAM_WIND) / (SLAM_WIND - 0.05); return { lift: k * k * (3 - 2 * k), press: 0, jolt: 0 }; }
  if (s < 0) { const k = (s + 0.05) / 0.05; return { lift: 1 - k * k, press: 0, jolt: 0 }; }   // the strike
  const press = s < 0.28 ? 1 : Math.max(0, 1 - (s - 0.28) / 0.14);
  return { lift: 0, press, jolt: Math.exp(-s * 11) * Math.cos(s * 38) };
}

/* The keypad at `t`: the key of the digit going in now sinks and its top
   lights for the first part of its step; ENT goes after the last digit. */
function workKeys(device, t) {
  const keys = device.userData.keys;
  const C = NUKE_CODE;
  let down = null, k = 0;
  if (t >= C.at && t < C.done + C.step) {
    const i = Math.floor((t - C.at) / C.step);
    k = ((t - C.at) / C.step) - i;
    down = i < C.digits.length ? C.digits[i] : "ENT";
  }
  for (const label in keys) {
    const key = keys[label];
    const p = label === down && k < 0.6 ? Math.sin(k / 0.6 * Math.PI) : 0;
    key.mesh.position.z = key.z - p * 0.0016;
    key.mesh.userData.lab.material.color.setHex(p > 0.2 ? 0xfff2b0 : 0xcfcbb8);
  }
}

/* Redraw the screen and work the keys. `t` is seconds since it came up;
   `armed` once the key went down; `left` the countdown's seconds (null
   before it starts). */
export function drawNukeScreen(device, t, armed, left) {
  workKeys(device, t);
  const { leds, ledOn, ledRed, ledOff } = device.userData.leds;
  leds[1].material = armed || (t > NUKE_CODE.done && (t * 3) % 1 < 0.5) ? ledRed : ledOff;
  leds[0].material = t > 0.15 ? ledOn : ledOff;
  const s = device.userData.screen;
  const g = s.ctx;
  g.fillStyle = "#140604";
  g.fillRect(0, 0, PX_W, PX_H);
  if (t < 0.45) {
    // Boot: scan lines and the trollface coming up out of the static.
    for (let i = 0; i < 80; i++) {
      g.fillStyle = `rgba(255,90,60,${Math.random() * 0.35})`;
      g.fillRect(Math.random() * PX_W, Math.random() * PX_H, 4 + Math.random() * 14, 1);
    }
    if (face.complete && face.naturalWidth) {
      g.globalAlpha = Math.min(1, t / 0.3) * 0.8;
      const h = 96, w = h * face.naturalWidth / face.naturalHeight;
      g.drawImage(face, (PX_W - w) / 2, (PX_H - h) / 2, w, h);
      g.globalAlpha = 1;
    }
    lcd(g);
    s.tex.needsUpdate = true;
    return;
  }
  const red = "#ff3b2a", dim = "rgba(255,59,42,.28)", green = "#5dff7a";
  const typed = nukeCodeTyped(t);
  const accepted = t >= NUKE_CODE.done + NUKE_CODE.step * 0.6;
  g.textBaseline = "top";
  g.fillStyle = red;
  g.font = "bold 19px monospace";
  g.fillText("TACTICAL NUKE", 10, 7);
  // Signal bars and a battery, top right.
  for (let i = 0; i < 4; i++) { g.fillStyle = i < 3 ? red : dim; g.fillRect(PX_W - 62 + i * 6, 22 - i * 4, 4, 4 + i * 4); }
  g.strokeStyle = red; g.lineWidth = 1.5; g.strokeRect(PX_W - 30.5, 10.5, 20, 11); g.fillStyle = red; g.fillRect(PX_W - 10, 13, 2, 5); g.fillRect(PX_W - 28, 13, 12, 6);
  g.fillStyle = dim; g.fillRect(8, 29, PX_W - 16, 1);
  // The map plate: a contour grid; locked until the code is in, then a
  // target ring on its centre.
  const mx = 10, my = 35, mw = PX_W - 20, mh = 76;
  g.strokeStyle = dim;
  g.lineWidth = 1;
  g.strokeRect(mx + 0.5, my + 0.5, mw, mh);
  for (let x = mx + 16; x < mx + mw; x += 16) { g.beginPath(); g.moveTo(x + 0.5, my); g.lineTo(x + 0.5, my + mh); g.stroke(); }
  for (let y = my + 16; y < my + mh; y += 16) { g.beginPath(); g.moveTo(mx, y + 0.5); g.lineTo(mx + mw, y + 0.5); g.stroke(); }
  const cx = mx + mw / 2, cy = my + mh / 2;
  if (!accepted) {
    g.fillStyle = "rgba(20,6,4,.82)";
    g.fillRect(cx - 74, cy - 14, 148, 28);
    g.fillStyle = red;
    g.font = "bold 17px monospace";
    g.textAlign = "center";
    g.fillText("AUTH REQUIRED", cx, cy - 8);
    g.textAlign = "left";
  } else {
    const pulse = (t * 1.6) % 1;
    g.strokeStyle = red;
    g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, 8 + pulse * 26, 0, Math.PI * 2); g.globalAlpha = 1 - pulse; g.stroke(); g.globalAlpha = 1;
    g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(cx - 16, cy); g.lineTo(cx + 16, cy); g.moveTo(cx, cy - 16); g.lineTo(cx, cy + 16); g.stroke();
  }
  // The code row: eight cells filling in as the keys go down.
  const bw = 24, gap = 5, bx0 = (PX_W - (8 * bw + 7 * gap + 8)) / 2, by = 119;
  g.font = "bold 22px monospace";
  g.textAlign = "center";
  for (let i = 0; i < 8; i++) {
    const x = bx0 + i * (bw + gap) + (i >= 4 ? 8 : 0);
    const col = accepted ? green : red;
    g.strokeStyle = i < typed ? col : dim;
    g.lineWidth = 1.5;
    g.strokeRect(x + 0.5, by + 0.5, bw, 30);
    if (i < typed) { g.fillStyle = col; g.fillText(NUKE_CODE.digits[i], x + bw / 2 + 1, by + 5); }
    else if (i === typed && (t * 4) % 1 < 0.55) { g.fillStyle = red; g.fillRect(x + 6, by + 24, bw - 11, 3); }
  }
  g.textAlign = "left";
  // The bottom line: the prompt, ACCEPTED, ARM?, then ARMED and the count.
  g.font = "bold 22px monospace";
  g.textAlign = "center";
  if (!accepted) {
    g.fillStyle = red;
    g.fillText("ENTER CODE", PX_W / 2, 163);
  } else if (!armed) {
    if (t < NUKE_CODE.done + 0.5) { g.fillStyle = green; g.fillText("CODE ACCEPTED", PX_W / 2, 163); }
    else if ((t * 3) % 1 < 0.65) { g.fillStyle = red; g.fillText("ARM?", PX_W / 2, 163); }
  } else {
    g.fillStyle = "rgba(255,59,42,.24)";
    g.fillRect(8, 157, PX_W - 16, 34);
    g.fillStyle = red;
    g.fillText(left != null ? `ARMED  ${Math.max(0, Math.ceil(left))}` : "ARMED", PX_W / 2, 163);
  }
  g.textAlign = "left";
  lcd(g);
  s.tex.needsUpdate = true;
}

/* The panel itself: a faint pixel grid and the edges falling off. */
function lcd(g) {
  g.fillStyle = "rgba(0,0,0,.18)";
  for (let y = 0; y < PX_H; y += 3) g.fillRect(0, y, PX_W, 1);
  const v = g.createRadialGradient(PX_W / 2, PX_H / 2, PX_H * 0.35, PX_W / 2, PX_H / 2, PX_W * 0.72);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,.5)");
  g.fillStyle = v;
  g.fillRect(0, 0, PX_W, PX_H);
}
