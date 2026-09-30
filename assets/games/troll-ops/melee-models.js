// Troll Forces — the Halloween melee weapons: the Reaper's Grin (a scythe
// knife) and the Chainsaw. Same convention as every melee model (gear.js
// buildMeleeMesh): the grip at the origin, the blade running down -Z.
// A model can carry `userData.tick(dt, busy, rev)`: the chainsaw runs its
// chain with it, squeezes its throttle and puffs exhaust as `rev` (0..1)
// climbs; game.js calls it for the held weapon.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const std = (color, rough = 0.5, metal = 0.2, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...o });

let faceTex = null;
function trollface() {
  if (faceTex) return faceTex;
  faceTex = new THREE.TextureLoader().load(new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  return faceTex;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* ---- the Reaper's Grin ------------------------------------------------------
   A reaper's scythe cut down to a knife: a curved black blade hooking up to
   a point, its cutting edge glowing violet, a notched spine; bone spikes for
   a guard round a violet soul gem; a wrapped grip; a grinning skull pommel. */
function buildReaperFallback() {
  const g = new THREE.Group();
  const steel = std(0x24202b, 0.28, 0.85);
  const bone = std(0xe8e1d1, 0.6, 0.05);
  const wrap = std(0x1a1120, 0.9, 0.05);
  const violet = new THREE.MeshBasicMaterial({ color: 0xc27bff });

  // Blade profile in (u along the blade, v sideways): the edge (+v) sweeps
  // out and up into the hooked tip, the spine comes back straighter.
  const L = 0.34, base = 0.024;
  const edgeCurve = new THREE.QuadraticBezierCurve(new THREE.Vector2(0, base), new THREE.Vector2(0.19, 0.085), new THREE.Vector2(L, 0.125));
  const spineCurve = new THREE.QuadraticBezierCurve(new THREE.Vector2(L, 0.125), new THREE.Vector2(0.22, 0.03), new THREE.Vector2(0, -base));
  const shape = new THREE.Shape();
  shape.moveTo(0, -base);
  shape.lineTo(0, base);
  for (const p of edgeCurve.getPoints(18).slice(1)) shape.lineTo(p.x, p.y);
  // Two notches in the spine, like a reaper's blade.
  const spinePts = spineCurve.getPoints(18).slice(1);
  spinePts.forEach((p, i) => {
    if (i === 7 || i === 12) shape.lineTo(p.x, p.y - 0.012);
    shape.lineTo(p.x, p.y);
  });
  const T = 0.007;
  const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.0025, bevelSegments: 1, curveSegments: 1 });
  // (u, v, thickness) -> (x = v, y = thickness, z = -u), starting past the guard.
  const toBlade = (geo) => { geo.rotateX(Math.PI / 2); geo.rotateY(Math.PI / 2); geo.translate(0, T / 2, -0.045); return geo; };
  g.add(new THREE.Mesh(toBlade(bladeGeo), steel));
  // The glowing edge: a thin tube along the cutting edge, both faces.
  const edge3 = edgeCurve.getPoints(24).map((p) => new THREE.Vector3(p.y + 0.002, 0, -0.045 - p.x));
  const edgeTube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge3), 40, 0.0028, 5, false);
  g.add(new THREE.Mesh(edgeTube, violet));
  // A faint violet fuller down the middle of the blade.
  const mid3 = edgeCurve.getPoints(16).map((p, i, a) => {
    const s = spineCurve.getPoint(1 - i / (a.length - 1));
    return new THREE.Vector3((p.y + s.y) / 2, 0, -0.045 - (p.x + s.x) / 2);
  }).slice(1, -3);
  for (const side of [1, -1]) {
    const fuller = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mid3), 24, 0.0016, 4, false),
      new THREE.MeshBasicMaterial({ color: 0x7a3fc0 }));
    fuller.position.y = side * (T / 2 + 0.0024);
    g.add(fuller);
  }

  // Guard: two curved bone spikes and the soul gem.
  for (const s of [1, -1]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.075, 6), bone);
    spike.rotation.z = -s * Math.PI / 2 - s * 0.45;
    spike.position.set(s * 0.04, 0.008, -0.035);
    g.add(spike);
  }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.03, 10), std(0x3b2a4a, 0.4, 0.6));
  collar.rotation.x = Math.PI / 2;
  collar.position.z = -0.03;
  g.add(collar);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.013), new THREE.MeshStandardMaterial({ color: 0x9b4dff, emissive: 0x9b4dff, emissiveIntensity: 1.4, roughness: 0.2 }));
  gem.position.set(0, 0.021, -0.03);
  g.add(gem);

  // Grip: dark wrap with raised violet bands.
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.018, 0.13, 10), wrap);
  grip.rotation.x = Math.PI / 2;
  grip.position.z = 0.05;
  g.add(grip);
  for (let i = 0; i < 5; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.0178, 0.0028, 5, 14), std(0x5b2d8c, 0.5, 0.3));
    band.position.z = -0.005 + i * 0.026;
    g.add(band);
  }

  // Pommel: a bone skull wearing the grin.
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), bone);
  skull.scale.set(1, 0.95, 1.1);
  skull.position.z = 0.14;
  g.add(skull);
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9b4dff }));
    eye.position.set(s * 0.011, 0.024, 0.132);
    g.add(eye);
  }
  const grin = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.042), new THREE.MeshBasicMaterial({ map: trollface(), transparent: true, depthWrite: false }));
  grin.rotation.x = -Math.PI / 2;
  grin.position.set(0, 0.0305, 0.146);
  g.add(grin);
  return g;
}

/* ---- the Chainsaw -----------------------------------------------------------
   After the classic horror saw: a rust-red powerhead with the pull-start
   cover and its grille on the right, a black hoop handle over the front, a
   wrapped rear handle (where you hold it, the origin), and a long steel bar
   with the chain running round it, both well bloodied. */
function buildChainsawFallback() {
  const g = new THREE.Group();
  const rust = std(0x7e1f1a, 0.62, 0.35);
  const rustDark = std(0x4e1210, 0.7, 0.3);
  const black = std(0x151515, 0.55, 0.35);
  const steel = std(0xb9bcc1, 0.34, 0.85);
  const tan = std(0xb59a6c, 0.95, 0.02);
  const blood = std(0x6a0707, 0.35, 0.1, { emissive: 0x1a0000 });
  const rand = seeded(0xc4a1);

  // Rear handle: a tan wrapped grip inside a black frame.
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.04, 0.13), tan);
  handle.position.set(0, 0, 0.0);
  g.add(handle);
  for (const [y, z, h, d] of [[0.045, 0, 0.012, 0.15], [-0.045, 0, 0.012, 0.15], [0, 0.072, 0.1, 0.012]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, d), black);
    bar.position.set(0, y, z);
    g.add(bar);
  }

  // Powerhead.
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.24), rust);
  body.position.set(0, 0.02, -0.19);
  g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 14, 1, false, 0, Math.PI), rust);
  top.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  top.position.set(0, 0.095, -0.19);
  g.add(top);
  const skid = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.25), rustDark);
  skid.position.set(0, -0.06, -0.19);
  g.add(skid);
  // Pull-start cover on the right, with its grille and the cord handle.
  const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 20), rustDark);
  cover.rotation.z = Math.PI / 2;
  cover.position.set(0.072, 0.02, -0.19);
  g.add(cover);
  const grille = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.034, 18), black);
  grille.rotation.z = Math.PI / 2;
  grille.position.set(0.074, 0.02, -0.19);
  g.add(grille);
  for (let i = 0; i < 7; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.004, 0.09), std(0x2f2f2f, 0.5, 0.5));
    rib.position.set(0.075, 0.02 - 0.036 + i * 0.012, -0.19);
    g.add(rib);
  }
  const cordGrip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.05), black);
  cordGrip.position.set(0.07, 0.1, -0.1);
  g.add(cordGrip);
  // Front hoop handle, arched over the powerhead.
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 22, Math.PI), black);
  hoop.position.set(0, 0.02, -0.26);
  g.add(hoop);
  // Spark plug boot and a few scuffs of bare metal.
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.04, 8), black);
  plug.position.set(-0.03, 0.14, -0.14);
  g.add(plug);

  // The bar.
  const BAR_LEN = 0.55, BAR_H = 0.075, z0 = -0.3, zTip = z0 - BAR_LEN;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.01, BAR_H, BAR_LEN), steel);
  bar.position.set(0, -0.015, z0 - BAR_LEN / 2);
  g.add(bar);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(BAR_H / 2, BAR_H / 2, 0.01, 18), steel);
  nose.rotation.z = Math.PI / 2;
  nose.position.set(0, -0.015, zTip);
  g.add(nose);
  for (let i = 0; i < 5; i++) {   // rivets
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.013, 6), std(0x777a80, 0.4, 0.8));
    r.rotation.z = Math.PI / 2;
    r.position.set(0, -0.015 + (i % 2 ? 0.015 : -0.015), z0 - 0.06 - i * 0.1);
    g.add(r);
  }

  // The chain: teeth round the bar's edge, on one path so they can run.
  const yc = -0.015, R = BAR_H / 2 + 0.006;
  const straight = BAR_LEN, half = Math.PI * R;
  const pathLen = 2 * straight + half;
  const place = (s, out) => {
    s = ((s % pathLen) + pathLen) % pathLen;
    if (s < straight) return out.set(0, yc + R, z0 - s), 0;                     // top, going out
    s -= straight;
    if (s < half) { const a = s / R; return out.set(0, yc + Math.cos(a) * R, zTip - Math.sin(a) * R), a; }   // round the nose
    s -= half;
    return out.set(0, yc - R, zTip + s), Math.PI;                              // underneath, coming back
  };
  const N = 64;
  const teeth = new THREE.InstancedMesh(new THREE.BoxGeometry(0.016, 0.012, 0.018), std(0x2a2a2a, 0.45, 0.7), N);
  const bloodyTeeth = new THREE.InstancedMesh(new THREE.BoxGeometry(0.017, 0.013, 0.012), blood, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), X = new THREE.Vector3(1, 0, 0);
  const bloodMask = Array.from({ length: N }, () => rand() < 0.55);
  const zero = new THREE.Vector3(0, 0, 0);
  const layChain = (offset) => {
    for (let i = 0; i < N; i++) {
      const ang = place(offset + (i / N) * pathLen, p);
      q.setFromAxisAngle(X, -ang);
      m4.compose(p, q, one);
      teeth.setMatrixAt(i, m4);
      m4.compose(p, q, bloodMask[i] ? one : zero);
      bloodyTeeth.setMatrixAt(i, m4);
    }
    teeth.instanceMatrix.needsUpdate = true;
    bloodyTeeth.instanceMatrix.needsUpdate = true;
  };
  layChain(0);
  g.add(teeth, bloodyTeeth);

  // Blood: splatter on both faces of the bar, thickest toward the tip.
  for (let i = 0; i < 46; i++) {
    const k = Math.pow(rand(), 0.6);
    const s = 0.006 + rand() * 0.018;
    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.002, s * (0.5 + rand()), s * (0.8 + rand() * 1.6)), blood);
    const side = rand() < 0.5 ? 1 : -1;
    drop.position.set(side * 0.0058, yc + (rand() - 0.5) * BAR_H * 0.9, z0 - 0.04 - k * (BAR_LEN - 0.05));
    drop.rotation.x = (rand() - 0.5) * 0.8;
    g.add(drop);
  }
  for (let i = 0; i < 8; i++) {   // and a few spots on the powerhead
    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.012 + rand() * 0.02, 0.012 + rand() * 0.02), blood);
    drop.position.set(-0.061, -0.02 + rand() * 0.1, -0.1 - rand() * 0.17);
    g.add(drop);
  }

  // The chain idles slowly and screams round as it revs.
  let offset = 0;
  g.userData.tick = (dt, busy, rev = busy ? 1 : 0) => {
    offset += dt * (0.35 + rev * 3.4);
    layChain(offset);
  };
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

/* ---- the Blender models (models/build_halloween_melee.blender.py) ----------
   Both stream in as GLBs. A build before they land gets the procedural
   stand-in above; it's swapped for the real model in place when the file
   arrives, so nothing has to be rebuilt. */

const URLS = {
  reaper: new URL("./models/reaper.glb?v=hw1", import.meta.url).href,
  chainsaw: new URL("./models/chainsaw.glb?v=hw2", import.meta.url).href,
};
const templates = {};
const waiting = { reaper: new Set(), chainsaw: new Set() };
let loading = null;
let envMap = null;

export function setHalloweenEnvMap(tex) { envMap = tex; }

export function preloadHalloweenMelee() {
  if (!loading) {
    const loader = new GLTFLoader();
    loading = Promise.all(Object.entries(URLS).map(([k, url]) => loader.loadAsync(url).then((gltf) => {
      templates[k] = gltf.scene;
      gltf.scene.traverse((o) => { if (o.isMesh) o.geometry.userData.shared = true; });
      for (const holder of waiting[k]) fill(holder, k);
      waiting[k].clear();
    }).catch((e) => console.warn(`[melee] ${k} model failed`, e))));
  }
  return loading;
}

// Every metal needs the weapon environment or it renders black.
function dress(root, castShadow = false) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    const m = o.material;
    if (envMap && m.isMeshStandardMaterial) {
      m.envMap = envMap;
      m.envMapIntensity = m.metalness > 0.5 ? 1.25 : 0.5;
    }
    o.castShadow = castShadow;
    o.receiveShadow = false;
  });
}

/* The engraving on the handle's panels: our own hooded reaper wearing the
   grin, a scythe over its shoulder, cut in pale gold. */
let engraveTex = null;
function engravingTexture() {
  if (engraveTex) return engraveTex;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 1024;
  const g = c.getContext("2d");
  const gold = "rgba(196,168,112,0.95)";
  g.strokeStyle = gold; g.fillStyle = gold; g.lineCap = "round"; g.lineJoin = "round";
  // The scythe: a long shaft on a slant and its blade curling over the top.
  g.lineWidth = 9;
  g.beginPath(); g.moveTo(206, 980); g.lineTo(70, 120); g.stroke();
  g.lineWidth = 7;
  g.beginPath(); g.moveTo(70, 124); g.quadraticCurveTo(170, 40, 236, 150); g.quadraticCurveTo(180, 96, 84, 150); g.stroke();
  // The hood and cloak: a pointed cowl flowing down into ragged hems.
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(128, 250); g.quadraticCurveTo(40, 290, 44, 430); g.quadraticCurveTo(30, 640, 40, 900);
  g.lineTo(70, 860); g.lineTo(96, 930); g.lineTo(124, 870); g.lineTo(152, 940); g.lineTo(180, 872); g.lineTo(214, 910);
  g.quadraticCurveTo(222, 640, 212, 430); g.quadraticCurveTo(214, 290, 128, 250);
  g.stroke();
  for (let i = 0; i < 6; i++) {   // folds in the cloth
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(70 + i * 24, 520 + (i % 2) * 30); g.quadraticCurveTo(76 + i * 24, 700, 66 + i * 26, 860); g.stroke();
  }
  // The void in the hood the grin sits in.
  g.fillStyle = "rgba(20,16,12,0.55)";
  g.beginPath(); g.ellipse(128, 390, 62, 76, 0, 0, Math.PI * 2); g.fill();
  // A bony hand on the shaft.
  g.fillStyle = gold;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(160 + i * 9, 620 - i * 4, 5, 14, -0.4, 0, Math.PI * 2); g.fill(); }
  engraveTex = new THREE.CanvasTexture(c);
  engraveTex.colorSpace = THREE.SRGBColorSpace;
  engraveTex.anisotropy = 8;
  // The grin itself, tinted gold, once the art has loaded.
  const img = new Image();
  img.onload = () => {
    const off = document.createElement("canvas");
    off.width = 128; off.height = 128;
    const o = off.getContext("2d");
    o.drawImage(img, 0, 0, 128, 128);
    o.globalCompositeOperation = "source-in";
    o.fillStyle = gold;
    o.fillRect(0, 0, 128, 128);
    g.drawImage(off, 128 - 60, 390 - 62, 120, 120);
    engraveTex.needsUpdate = true;
  };
  img.src = new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
  return engraveTex;
}

function fill(holder, kind) {
  for (const c of [...holder.children]) {
    if (c.userData.hand) continue;
    holder.remove(c);
    c.traverse((o) => { if (!o.geometry?.userData.shared) o.geometry?.dispose(); o.material?.dispose?.(); });
  }
  const src = templates[kind].clone(true);
  dress(src);
  if (kind === "reaper") fitReaper(holder, src);
  else fitChainsaw(holder, src);
  holder.add(src);
  holder.userData.detailed = true;
}

/* The knife: the blade and its trim go under one pivot group so the game
   can fold it shut and flick it open (holder.userData.setFold(0..1)). */
function fitReaper(holder, src) {
  const pivotNode = src.getObjectByName("RG_Pivot");
  const piv = pivotNode ? pivotNode.position.clone() : new THREE.Vector3(0, 0, -0.068);
  const pivot = new THREE.Group();
  pivot.position.copy(piv);
  for (const name of ["RG_Blade", "RG_BladeTrim"]) {
    const n = src.getObjectByName(name);
    if (!n) continue;
    n.parent.remove(n);
    n.position.sub(piv);
    pivot.add(n);
  }
  src.add(pivot);
  holder.userData.setFold = (k) => { pivot.rotation.y = -k * Math.PI * 0.97; };
  // The engraving on both handle panels.
  const panel = src.getObjectByName("RG_Panel");
  const at = panel ? panel.position : new THREE.Vector3(0.001, 0.009, 0.01);
  const mat = new THREE.MeshStandardMaterial({ map: engravingTexture(), transparent: true, roughness: 0.45, metalness: 0.85, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, envMap, envMapIntensity: 1 });
  for (const side of [1, -1]) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.019, 0.1), mat);
    d.rotation.x = -side * Math.PI / 2;
    if (side < 0) d.rotation.z = Math.PI;
    d.position.set(at.x + 0.004, side * (Math.abs(at.y) + 0.0004), at.z);
    src.add(d);
  }
}

/* The saw: the chain's teeth run round the bar (numbers from the Blender
   build: BAR_Z0, BAR_LEN, BAR_H, BAR_YC). */
function fitChainsaw(holder, src) {
  const BAR_Z0 = -0.30, BAR_LEN = 0.56, BAR_H = 0.078, YC = -0.018;
  const zTip = BAR_Z0 - BAR_LEN, R = BAR_H / 2 + 0.0045, straight = BAR_LEN + 0.02, half = Math.PI * R;
  const z0 = BAR_Z0 + 0.02;
  const pathLen = 2 * straight + half;
  const place = (s, out) => {
    s = ((s % pathLen) + pathLen) % pathLen;
    if (s < straight) { out.set(0, YC + R, z0 - s); return 0; }
    s -= straight;
    if (s < half) { const a = s / R; out.set(0, YC + Math.cos(a) * R, zTip - Math.sin(a) * R); return a; }
    s -= half;
    out.set(0, YC - R, zTip + s);
    return Math.PI;
  };
  const N = 72;
  const toothGeo = new THREE.BoxGeometry(0.0125, 0.0085, 0.0145);
  toothGeo.translate(0, 0.002, 0);
  const cutterGeo = new THREE.BoxGeometry(0.004, 0.006, 0.009);
  cutterGeo.translate(0.004, 0.007, -0.002);
  const steel = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.35, metalness: 1, envMap, envMapIntensity: 1.2 });
  const blood = new THREE.MeshStandardMaterial({ color: 0x5a0404, roughness: 0.25, metalness: 0 });
  const teeth = new THREE.InstancedMesh(toothGeo, steel, N);
  const cutters = new THREE.InstancedMesh(cutterGeo, steel, N);
  const bloody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0132, 0.009, 0.01), blood, N);
  const mask = Array.from({ length: N }, (_, i) => ((i * 2654435761) >>> 0) % 100 < 55);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1),
    none = new THREE.Vector3(0, 0, 0), flip = new THREE.Vector3(-1, 1, 1), X = new THREE.Vector3(1, 0, 0);
  const lay = (offset) => {
    for (let i = 0; i < N; i++) {
      const ang = place(offset + (i / N) * pathLen, p);
      q.setFromAxisAngle(X, -ang);
      m4.compose(p, q, one); teeth.setMatrixAt(i, m4);
      m4.compose(p, q, i % 2 ? one : flip); cutters.setMatrixAt(i, m4);
      m4.compose(p, q, mask[i] ? one : none); bloody.setMatrixAt(i, m4);
    }
    teeth.instanceMatrix.needsUpdate = cutters.instanceMatrix.needsUpdate = bloody.instanceMatrix.needsUpdate = true;
  };
  lay(0);
  for (const im of [teeth, cutters, bloody]) { im.frustumCulled = false; src.add(im); }
  const throttle = src.getObjectByName("CS_Throttle");
  const exhaust = src.getObjectByName("CS_Exhaust");
  const smoke = exhaust ? new ExhaustSmoke() : null;
  let offset = 0;
  holder.userData.tick = (dt, busy, rev = busy ? 1 : 0) => {
    offset += dt * (0.3 + rev * 3.8);
    lay(offset);
    // The trigger squeezes up into the handle with the throttle.
    if (throttle) throttle.rotation.x = rev * 0.32;
    if (smoke && holder.parent) smoke.update(dt, rev, exhaust, holder.parent);
  };
  holder.userData.disposeFx = () => smoke?.dispose();
}

/* Two-stroke exhaust: soft grey puffs out of the muffler, a lazy one now and
   then at idle, a dark rolling stream while it revs. They live in the
   saw's parent (the view model rig), so they hang in the air and trail
   behind as the saw moves instead of riding along glued to it. */
let puffTex = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,0.9)");
  r.addColorStop(0.45, "rgba(255,255,255,0.45)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}
const _exPos = new THREE.Vector3(), _exDir = new THREE.Vector3(), _exQ = new THREE.Quaternion();
class ExhaustSmoke {
  constructor(n = 18) {
    this.puffs = [];
    this.next = 0;
    this.parent = null;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: 0x8a8a86, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      s.renderOrder = 2;
      this.puffs.push({ s, age: 0, life: 1, vel: new THREE.Vector3(), size: 0.05 });
    }
  }

  update(dt, rev, exhaust, parent) {
    if (this.parent !== parent) {
      for (const p of this.puffs) { p.s.removeFromParent(); parent.add(p.s); }
      this.parent = parent;
    }
    this.next -= dt;
    if (this.next <= 0 && exhaust.parent) {
      this.next = rev > 0.2 ? 0.035 + (1 - rev) * 0.06 : 0.45 + Math.random() * 0.35;
      const p = this.puffs.find((q) => !q.s.visible) || this.puffs[0];
      // Out of the muffler (the saw's -x side), in the rig's frame.
      exhaust.getWorldPosition(_exPos);
      parent.worldToLocal(_exPos);
      exhaust.getWorldQuaternion(_exQ);
      _exDir.set(-1, 0.35, 0.1).applyQuaternion(_exQ);
      const pq = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      _exDir.applyQuaternion(pq).normalize();
      p.s.position.copy(_exPos);
      p.vel.copy(_exDir).multiplyScalar(0.12 + rev * 0.35);
      p.vel.y += 0.05;
      p.age = 0;
      p.life = 0.55 + Math.random() * 0.4 + rev * 0.3;
      p.size = 0.025 + rev * 0.03;
      p.dark = rev;
      p.s.visible = true;
    }
    for (const p of this.puffs) {
      if (!p.s.visible) continue;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) { p.s.visible = false; continue; }
      p.vel.multiplyScalar(Math.max(0, 1 - dt * 2.2));
      p.vel.y += dt * 0.08;
      p.s.position.addScaledVector(p.vel, dt);
      p.s.scale.setScalar(p.size * (1 + k * 3));
      p.s.material.opacity = (1 - k) * (0.2 + p.dark * 0.16);
      p.s.material.color.setScalar(0.42 - p.dark * 0.24);
    }
  }

  dispose() {
    for (const p of this.puffs) { p.s.removeFromParent(); p.s.material.dispose(); }
  }
}

/* The builders gear.js calls. */
export function buildReaperKnife() {
  const h = new THREE.Group();
  h.userData.kind = "reaper";
  if (templates.reaper) { fill(h, "reaper"); return h; }
  h.add(buildReaperFallback());
  waiting.reaper.add(h);
  preloadHalloweenMelee();
  return h;
}

export function buildChainsaw() {
  const h = new THREE.Group();
  h.userData.kind = "chainsaw";
  if (templates.chainsaw) { fill(h, "chainsaw"); return h; }
  const fb = buildChainsawFallback();
  h.add(fb);
  h.userData.tick = (dt, busy, rev) => fb.userData.tick?.(dt, busy, rev);
  waiting.chainsaw.add(h);
  preloadHalloweenMelee();
  return h;
}
