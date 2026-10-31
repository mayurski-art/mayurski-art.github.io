// Troll Forces — the Pumpkin Head: a limited-time head for Chapter One
// (user, 2026-10-31; the reference, the user's own carved trollface
// jack-o'-lantern, is refs/cosmetics/pumpkin-head/). Worn on the head pivot
// in place of the head: the trollface board, the TROLLS relief head, its
// hat, hair and beard all go while it's on and come back when it's off.
//
// Three looks were mocked up for the user to pick from:
//   "whole"  a plain pumpkin over the whole head, no face;
//   "carved" the real trollface artwork carved through the rind, its lines
//            and the grin lit from inside (the reference photo);
//   "traced" a plain pumpkin with the trollface traced on in milky white.
// The user picked "carved" (2026-10-31): it is the one worn (HEADWEAR); the
// other two stay for labs/pumpkin-lab.html. The trollface itself is always white (user, 2026-10-08), so the light in
// the cuts burns a warm white, not orange.

import * as THREE from "three";

const ART = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
// the grin in the artwork's own 800 x 730 frame (as the bandana's: character.js coveringCanvas)
const GRIN = { x: 410, y: 452, rx: 228, ry: 150 };

/* A pumpkin round the origin: a sphere pulled into ribs, squashed, dimpled
   at the stem and the base (maps/jack-o-lantern.js, the same shape). */
function rib(g, r, ribs, squash, grow = 1) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = Math.pow(Math.abs(Math.sin(a * ribs / 2)), 0.45);
    const sc = (0.9 + 0.1 * k) * grow;
    x *= sc; z *= sc;
    y *= squash;
    const d = Math.hypot(x, z) / r;
    if (y > 0) y -= r * 0.16 * Math.exp(-d * d * 9);
    else y += r * 0.08 * Math.exp(-d * d * 9);
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/* The shell's grid: the face patch is cut on the same lines, so it lies
   on the shell everywhere (a coarser patch sank into the rib grooves). */
const SEG_W = 96, SEG_H = 48;
/* The face's patch of the shell, a hair proud of it, UV 0..1 across the
   front (+z): about `span` radians round, `tall` of the half-turn down. */
function facePatch(r, ribs, squash, span = 2.45, tall = 0.56) {
  const dw = Math.PI * 2 / SEG_W, dh = Math.PI / SEG_H;
  const nw = Math.round(span / dw), nh = Math.round(tall * SEG_H);
  const w0 = Math.round((Math.PI / 2 - span / 2) / dw), h0 = Math.round((SEG_H - nh) / 2);
  const g = new THREE.SphereGeometry(r, nw, nh, w0 * dw, nw * dw, h0 * dh, nh * dh);
  return rib(g, r, ribs, squash, 1.01);
}

/* The rind's colour: a canvas with the ribs' grooves darker and a
   speckle, so it isn't a flat plastic orange. */
let rindTex = null;
function rindTexture() {
  if (rindTex) return rindTex;
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 256);
  // (a yellow-leaning orange: the maps' night grades pull orange toward red)
  grd.addColorStop(0, "#c06a18"); grd.addColorStop(0.18, "#ea8c26"); grd.addColorStop(0.55, "#f59c32"); grd.addColorStop(0.9, "#d27a20"); grd.addColorStop(1, "#985212");
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  let s = 7;
  const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = R() < 0.5 ? "rgba(255,200,120,.08)" : "rgba(90,30,0,.08)";
    g.fillRect(R() * 512, R() * 256, 1 + R() * 3, 1 + R() * 2);
  }
  // long streaks down the ribs
  g.globalAlpha = 0.18;
  for (let i = 0; i < 90; i++) {
    const x = R() * 512;
    g.strokeStyle = R() < 0.5 ? "#ffb060" : "#7a3008";
    g.lineWidth = 0.6 + R() * 1.6;
    g.beginPath(); g.moveTo(x, 10 + R() * 30); g.bezierCurveTo(x + (R() - 0.5) * 8, 90, x + (R() - 0.5) * 8, 170, x + (R() - 0.5) * 6, 246); g.stroke();
  }
  g.globalAlpha = 1;
  rindTex = new THREE.CanvasTexture(c);
  rindTex.colorSpace = THREE.SRGBColorSpace;
  return rindTex;
}

/* The face drawn for a look, from the artwork: a canvas the size of the
   art (800 x 730) whose alpha is where the patch shows. `carved`: the ink
   lines cut (lit), the grin cut whole with its teeth left standing, the
   rest clear; `traced`: the ink in milky white paint, the rest clear. */
function faceCanvas(look, img) {
  const c = document.createElement("canvas");
  c.width = 800; c.height = 730;
  if (!img) return c;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0, 800, 730);
  const d = g.getImageData(0, 0, 800, 730), px = d.data;
  const inGrin = (x, y) => ((x - GRIN.x) / GRIN.rx) ** 2 + ((y - GRIN.y) / GRIN.ry) ** 2 < 1;
  const N = 800 * 730, kind = new Uint8Array(N);   // 0 clear, 1 ink, 2 white
  for (let n = 0; n < N; n++) {
    const i = n * 4, lum = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
    kind[n] = px[i + 3] <= 100 ? 0 : lum < 110 ? 1 : 2;
  }
  // The whites the ink closes in (each tooth, the eye whites) are cut out
  // whole, as on the user's pumpkin; the face's own big white is rind.
  const cut = new Uint8Array(N);
  if (look === "carved") {
    const seen = new Uint8Array(N), stack = new Int32Array(N);
    for (let s = 0; s < N; s++) {
      if (kind[s] !== 2 || seen[s]) continue;
      let top = 0, size = 0;
      const members = [];
      stack[top++] = s; seen[s] = 1;
      while (top) {
        const n = stack[--top];
        members.push(n); size++;
        const x = n % 800;
        for (const m of [n - 800, n + 800, x ? n - 1 : -1, x < 799 ? n + 1 : -1]) {
          if (m >= 0 && m < N && !seen[m] && kind[m] === 2) { seen[m] = 1; stack[top++] = m; }
        }
      }
      if (size < N * 0.03) for (const n of members) cut[n] = 1;
    }
    // the head's own outline isn't carved (the pumpkin is the head): ink
    // within 12 px of the clear outside stays rind
    const near = new Uint8Array(N), R = 12;
    for (let y = 0; y < 730; y++) for (let x = 0; x < 800; x++) {
      if (kind[y * 800 + x]) continue;
      for (let k = -R; k <= R; k++) {
        if (x + k >= 0 && x + k < 800) near[y * 800 + x + k] = 1;
        if (y + k >= 0 && y + k < 730) near[(y + k) * 800 + x] = 1;
      }
    }
    for (let n = 0; n < N; n++) if (near[n] && kind[n] === 1) kind[n] = 0;
  }
  for (let i = 0, n = 0; i < px.length; i += 4, n++) {
    const x = n % 800, y = (n / 800) | 0;
    const ink = kind[n] === 1;
    let a = 0, r = 255, gg = 255, b = 255;
    if (look === "carved") {
      // the inside of the mouth glows white (user, 2026-10-31): the teeth
      // full white, the lines between them a softer white so they still read
      if (cut[n] && inGrin(x, y)) { a = 255; r = 255; gg = 255; b = 255; }
      else if (cut[n]) { a = 255; r = 255; gg = 250; b = 240; }   // the eye whites: cut through
      else if (ink && !inGrin(x, y)) { a = 255; r = 255; gg = 240; b = 214; }   // the lines: scored through
      else if (ink) { a = 255; r = 176; gg = 168; b = 160; }   // between the teeth: lit, a shade down
    } else if (look === "traced") {
      if (ink) { a = 235; r = 246; gg = 242; b = 228; }
    }
    px[i] = r; px[i + 1] = gg; px[i + 2] = b; px[i + 3] = a;
  }
  g.putImageData(d, 0, 0);
  if (look === "carved") {
    // a soft bloom of light round the cuts: the candle showing through the thin rind
    const halo = document.createElement("canvas");
    halo.width = 800; halo.height = 730;
    const h = halo.getContext("2d");
    h.filter = "blur(7px)";
    h.drawImage(c, 0, 0);
    g.globalCompositeOperation = "destination-over";
    g.globalAlpha = 0.32;
    g.drawImage(halo, 0, 0);
    // the mouth pours out more light than the scored lines
    const mouth = document.createElement("canvas");
    mouth.width = 800; mouth.height = 730;
    const mg = mouth.getContext("2d");
    mg.filter = "blur(14px)";
    mg.beginPath(); mg.ellipse(GRIN.x, GRIN.y, GRIN.rx, GRIN.ry, 0, 0, Math.PI * 2); mg.clip();
    mg.drawImage(c, 0, 0);
    g.globalAlpha = 0.5;
    g.drawImage(mouth, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }
  return c;
}

const FACE_MATS = new Map();
function faceMaterial(look) {
  let m = FACE_MATS.get(look);
  if (m) return m;
  const c = faceCanvas(look, null);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  m = look === "carved"
    // lit from inside: its own light, nothing the sun does changes it
    // (brighter than white, so the game's bloom picks the cuts out at night)
    ? new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.04, depthWrite: false, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) })
    : new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, roughness: 0.55, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.18 });
  m.polygonOffset = true; m.polygonOffsetFactor = -2;
  const img = new Image();
  img.onload = () => { c.getContext("2d").drawImage(faceCanvas(look, img), 0, 0); t.needsUpdate = true; };
  img.src = ART;
  FACE_MATS.set(look, m);
  return m;
}

let rindMat = null, stemMat = null, leafMat = null;
const rind = () => rindMat ||= new THREE.MeshStandardMaterial({ map: rindTexture(), roughness: 0.62, metalness: 0, emissive: 0xd89a2a, emissiveIntensity: 0.3, emissiveMap: rindTexture() });   // lit a little from inside: a jack-o'-lantern, never a black ball at night
const stem = () => stemMat ||= new THREE.MeshStandardMaterial({ color: 0x5a5226, roughness: 0.9 });
const leaf = () => leafMat ||= new THREE.MeshStandardMaterial({ color: 0x3f5a22, roughness: 0.8, side: THREE.DoubleSide });

/* A Pumpkin Head of radius `r` (its widest), its base on y 0, its face
   toward +z: a Group. */
export function buildPumpkinHead(look = "carved", r = 0.27) {
  const ribs = 11, squash = 0.86;
  const grp = new THREE.Group();
  grp.name = "pumpkin-head";
  const lift = r * squash * 0.94;
  const body = new THREE.Mesh(rib(new THREE.SphereGeometry(r, SEG_W, SEG_H), r, ribs, squash), rind());
  body.position.y = lift;
  body.castShadow = true;
  grp.add(body);
  // the stem: a twisted, fluted stalk leaning off true, and a curl of vine
  const sg = new THREE.CylinderGeometry(r * 0.07, r * 0.12, r * 0.42, 7, 4);
  const sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i) / (r * 0.42) + 0.5, a = y * 0.9;
    const x = sp.getX(i), z = sp.getZ(i);
    sp.setXYZ(i, x * Math.cos(a) - z * Math.sin(a) + y * y * r * 0.1, sp.getY(i), x * Math.sin(a) + z * Math.cos(a));
  }
  sg.computeVertexNormals();
  const st = new THREE.Mesh(sg, stem());
  st.position.set(0, lift + r * squash * 0.82 + r * 0.17, -r * 0.02);
  st.rotation.z = -0.18;
  st.castShadow = true;
  grp.add(st);
  const curl = new THREE.Mesh(new THREE.TorusGeometry(r * 0.09, r * 0.014, 5, 16, Math.PI * 1.6), stem());
  curl.position.set(-r * 0.12, lift + r * squash * 0.86, r * 0.02);
  curl.rotation.set(0.3, 0.6, 0);
  grp.add(curl);
  const lg = new THREE.CircleGeometry(r * 0.13, 7);
  lg.scale(1, 0.55, 1);
  const lf = new THREE.Mesh(lg, leaf());
  lf.position.set(r * 0.16, lift + r * squash * 0.8, -r * 0.04);
  lf.rotation.set(-1.1, 0.3, 0.4);
  grp.add(lf);
  if (look === "carved" || look === "traced") {
    const patch = new THREE.Mesh(facePatch(r, ribs, squash), faceMaterial(look));
    patch.position.y = lift;
    patch.renderOrder = 2;
    grp.add(patch);
  }
  grp.userData.look = look;
  return grp;
}

/* The head piece in a face key's fifth part ("grin:og:::pumpkin"), "" for
   none, and the look it wears. ?pumpkin=whole|traced on a lab page swaps
   the look. */
const labLook = typeof location !== "undefined" && /labs\//.test(location.pathname) ? new URLSearchParams(location.search).get("pumpkin") : null;
export const HEADWEAR = { pumpkin: labLook || "carved" };
export const headwearOf = (key) => {
  const id = String(key || "").split(":")[4] || "";
  return HEADWEAR[id] ? id : "";
};

/* Wear (or take off) the head piece named in the rig's face key, on its
   head pivot, sized to the head board (the stick troll's, or the bigger
   one a TROLLS body wears). While it's on, everything else on the pivot
   that shows (the board and its relief head, a hat, hair, a beard) is
   hidden, and checked again every call: a TROLLS body puts its cap on
   late, after its pieces load. */
export function syncHeadwear(rig) {
  const pivot = rig.parts?.headPivot, board = rig.parts?.head;
  if (!pivot || !board) return;
  const id = headwearOf(rig.face);
  if (rig.headwearShown !== id) {
    rig.headwearShown = id;
    if (rig.headwearMesh) { pivot.remove(rig.headwearMesh); rig.headwearMesh = null; }
    for (const o of rig.headwearHid || []) o.visible = true;
    rig.headwearHid = [];
    if (id) {
      const w = 0.48 * (rig.scale || 1) * Math.abs(board.scale.x || 1);
      const r = w * 0.6;
      const m = buildPumpkinHead(HEADWEAR[id], r);
      m.position.set(board.position.x, board.position.y - r * 0.86 * 0.94, board.position.z);
      m.rotation.y = Math.PI;   // its face to the game's forward (-z), as the board's
      m.userData.headwear = true;
      pivot.add(m);
      rig.headwearMesh = m;
    }
  }
  if (!id) return;
  const joints = rig.headwearJoints ||= new Set(Object.values(rig.parts).filter((j) => j?.isObject3D && j !== board));
  for (const o of pivot.children) {
    if (o === rig.headwearMesh || !o.visible || joints.has(o) || o.userData.isHitProxy) continue;
    o.visible = false;
    rig.headwearHid.push(o);
  }
}
