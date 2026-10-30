// Troll Forces — the jack-o'-lantern, shared: Hollowgrin's porches, piers
// and patch (maps/hollowgrin.js), and the Zombies hub's Halloween dressing
// (modes/zombies/hub-hall.js; user, 2026-10-30: "lets use the pumpkins we
// have in the hollowgrin map"). A ribbed body and stem and, carved, the real
// trollface artwork cut through the skin so its lines glow, with a warm pool
// on the ground under it. The pieces come back placed, for the caller to
// merge with its own materials.

import * as THREE from "three";

/* The same seeded stream as Hollowgrin's (so its jacks don't move). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m4 = new THREE.Matrix4();
function place(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _m4.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1));
  geo.applyMatrix4(_m4);
  return geo;
}

/* The carved face: the real trollface artwork, its ink lines cut through
   the skin so they glow. Everything that isn't ink is left transparent,
   so the pumpkin shows round the cuts. */
let carveTex = null;
export function carveTexture() {
  if (carveTex) return carveTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    const g = c.getContext("2d");
    const s = Math.min(236 / img.width, 236 / img.height);
    const w = img.width * s, h = img.height * s;
    g.drawImage(img, (256 - w) / 2, (256 - h) / 2 + 6, w, h);
    const d = g.getImageData(0, 0, 256, 256);
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      const lum = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
      const ink = px[i + 3] > 100 && lum < 110;
      px[i] = 255; px[i + 1] = 214; px[i + 2] = 120;
      px[i + 3] = ink ? 255 : 0;
    }
    g.putImageData(d, 0, 0);
    t.needsUpdate = true;
  };
  img.src = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
  return (carveTex = t);
}

/* A pumpkin: a sphere pulled into ribs, squashed, dimpled at the stem. */
export function pumpkinGeo(r, { ribs = 10, squash = 0.78, seg = 18 } = {}) {
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7));
  ribPumpkin(g, r, ribs, squash);
  return g;
}

function ribPumpkin(g, r, ribs, squash, grow = 1) {
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
}

/* The carved front of a jack-o'-lantern: a patch of the same ribbed shell,
   a hair proud of it, UV-mapped 0..1 across the face. */
function carvePatchGeo(r, ribs, squash) {
  const g = new THREE.SphereGeometry(r, 16, 12, Math.PI / 2 - 1.0, 2.0, Math.PI * 0.22, Math.PI * 0.56);
  ribPumpkin(g, r, ribs, squash, 1.018);
  return g;
}

/* A jack-o'-lantern standing on y at (x, z), its face turned `face`
   (radians about y, 0 = toward +z): { body, hue, stem, carve, pool, phase }
   (carve and pool null when it isn't carved or doesn't glow on the ground). */
export function jackPieces(x, y, z, { r = 0.3, face = 0, carved = true, seed = 1, glow = true } = {}) {
  const R = rng(seed * 97 + 13);
  const ribs = 9 + Math.floor(R() * 3), squash = 0.72 + R() * 0.12;
  const hue = [0xd8641c, 0xe07423, 0xcf5a17, 0xe8842c][Math.floor(R() * 4)];
  const body = place(pumpkinGeo(r, { ribs, squash }), { x, y: y + r * squash * 0.95, z, ry: R() * 6 });
  const stem = place(new THREE.CylinderGeometry(r * 0.08, r * 0.13, r * 0.45, 6), { x, y: y + r * squash * 1.75, z, rz: (R() - 0.5) * 0.6, rx: (R() - 0.5) * 0.6 });
  if (!carved) return { body, hue, stem, carve: null, pool: null, phase: 0 };
  const phase = R();
  const carve = place(carvePatchGeo(r, ribs, squash), { x, y: y + r * squash * 0.95, z, ry: face });
  let pool = null;
  if (glow) {
    const gr = r * 5.5;
    pool = place(new THREE.PlaneGeometry(gr, gr), { x: x + Math.sin(face) * r, y: y + 0.03, z: z + Math.cos(face) * r, rx: -Math.PI / 2 });
  }
  return { body, hue, stem, carve, pool, phase };
}
