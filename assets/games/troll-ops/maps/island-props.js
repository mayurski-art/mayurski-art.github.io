// Troll Forces — trees, rocks and cover as data (doc "Troll Royale map in
// Roblox Studio", phase 4). A map lists its props as [kind, x, z, yaw, scale]
// and this draws each kind as instanced meshes (one draw a part, however many
// there are) and lays each prop's colliders, so Studio (or a scatter tool)
// can move every tree and crate without touching code.
//
// A kind is built once, at scale 1, standing on y 0 and facing +z: its parts
// (geometry + material, `shade` = each instance takes a colour off `palette`)
// and its colliders [cx, cz, w, d, h, y, pen] in that frame. A prop turned by
// `yaw` gets each collider's world bounding box (long kinds split into short
// boxes so a turned wall stays tight).
//
// Data: { kinds: ["oak", ...], items: [[k, x*10, z*10, yawDeg, scale*100]] }.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SURFACES } from "./surface-textures.js?v=hg6e-sr1-or1-tx1-sp1-kbt1-pm1-ss1-ss2-ss3";

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

/* Push each vertex out or in a little (same vertex, same push). */
function lumpy(g, r, amt) {
  const p = g.attributes.position, seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(k)) seen.set(k, 1 + (r() - 0.5) * amt);
    const s = seen.get(k);
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}

const merge = (geos) => {
  const out = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  out.computeVertexNormals();
  return out;
};
const at = (g, x, y, z) => { g.translate(x, y, z); return g; };

function texMat(surface, color, tile, o = {}) {
  const s = SURFACES[surface];
  const mk = (t) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(1 / tile, 1 / tile); c.needsUpdate = true; return c; };
  return new THREE.MeshStandardMaterial({ color, map: mk(s.color), normalMap: mk(s.normal), roughness: 1, ...o });
}

const LEAF = [0x2f9e44, 0x3fbf62, 0x2a8a3c, 0x58c46a, 0x4caf50, 0x7bc95a];
const PINE = [0x1f6b45, 0x26805a, 0x1d5c3f, 0x2e7d4f];
const BUSH = [0x2f9e44, 0x3a9d3a, 0x4caf50, 0x2a7a3c, 0x5fae4a];
const BARREL = [0xc0392b, 0x2e6fb5, 0x3c8d40, 0xd68a1c];

/* The kinds' geometry and materials, built on first use. */
let KINDS = null;
function kinds() {
  if (KINDS) return KINDS;
  const r = rng(0x9e7a11);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o });
  const leaf = std(0xffffff, { flatShading: true });
  const trunk = std(0x6b4a2e);
  const rock = texMat("rock", 0xf4f2ee, 2.2, { flatShading: true });
  // Plain colours: a wood texture cloned before it had loaded drew black.
  const wood = std(0xb5854c, { flatShading: true });
  const bark = std(0x7a5534, { flatShading: true });
  const trim = std(0x5a3d22, { flatShading: true });
  const hay = std(0xd9b44a, { roughness: 1 });
  const metal = std(0xffffff, { roughness: 0.55, metalness: 0.3 });
  const bag = std(0xb59f72, { roughness: 1, flatShading: true });

  const crowns = [0, 1, 2].map((k) => {
    const s = 1.7 + r() * 0.6;
    const g = lumpy(new THREE.IcosahedronGeometry(s, 1), r, 0.22);
    g.scale(1, 0.8, 1);
    const a = (k / 3) * Math.PI * 2;
    return at(g, Math.cos(a) * 0.9, 3.4 + s * 0.4 + k * 0.3, Math.sin(a) * 0.9);
  });
  const cones = [0, 1, 2].map((k) => at(new THREE.ConeGeometry(2.6 * (1 - k * 0.24), 2.6, 8), 0, 2.8 + k * 1.45, 0));
  const stone = (s, x, z) => { const g = lumpy(new THREE.DodecahedronGeometry(s, 0), r, 0.3); return at(g, x, s * 0.35, z); };
  const boulderTop = lumpy(new THREE.DodecahedronGeometry(1.5, 1), r, 0.3);
  boulderTop.scale(1.3, 0.75, 1);
  boulderTop.translate(0, 0.63, 0);
  const wallStones = [];
  for (let i = 0; i < 5; i++) { const g = lumpy(new THREE.DodecahedronGeometry(0.55, 0), r, 0.35); g.scale(1.4, 1, 1); wallStones.push(at(g, -1.6 + i * 0.8, 0.42, 0)); }
  for (let i = 0; i < 4; i++) { const g = lumpy(new THREE.DodecahedronGeometry(0.42, 0), r, 0.35); g.scale(1.5, 0.9, 1); wallStones.push(at(g, -1.2 + i * 0.8, 0.9, (r() - 0.5) * 0.1)); }
  const crate = (x, y, z, ry) => { const g = new THREE.BoxGeometry(1.1, 1.1, 1.1); g.rotateY(ry); return at(g, x, y + 0.55, z); };
  // A crate's dark frame: its twelve edges, a touch proud of the faces.
  const crateTrim = (x, y, z, ry) => {
    const e = 0.56, t = 0.13, out = [];
    for (const a of [-e, e]) for (const b of [-e, e]) {
      out.push(at(new THREE.BoxGeometry(t, 1.14, t), a, 0, b));
      out.push(at(new THREE.BoxGeometry(1.14, t, t), 0, a, b));
      out.push(at(new THREE.BoxGeometry(t, t, 1.14), a, b, 0));
    }
    return out.map((g) => { g.rotateY(ry); return at(g, x, y + 0.55, z); });
  };
  const bale = (z) => { const g = new THREE.CylinderGeometry(0.75, 0.75, 1.3, 14); g.rotateZ(Math.PI / 2); return at(g, 0, 0.75, z); };
  const log = (y, z) => { const g = new THREE.CylinderGeometry(0.32, 0.34, 4, 9); g.rotateZ(Math.PI / 2); return at(g, 0, y, z); };
  const barrel = (x, z) => at(new THREE.CylinderGeometry(0.38, 0.38, 1.0, 12), x, 0.5, z);
  const bags = [];
  for (let row = 0; row < 4; row++) for (let i = 0; i < 4; i++) {
    const g = lumpy(new THREE.SphereGeometry(0.5, 7, 5), r, 0.12);
    g.scale(0.74, 0.3, 0.62);
    bags.push(at(g, -1.1 + i * 0.73 + (row % 2) * 0.36 - 0.18, 0.15 + row * 0.26, 0));
  }
  const seg = (n, len, w, d, h, pen) => Array.from({ length: n }, (_, i) => [-len / 2 + (i + 0.5) * (len / n), 0, len / n, d, h, 0, pen]);

  KINDS = {
    oak: { parts: [{ geo: at(new THREE.CylinderGeometry(0.24, 0.33, 3.2, 7), 0, 1.6, 0), mat: trunk },
      { geo: merge(crowns), mat: leaf, palette: LEAF }], cols: [[0, 0, 0.53, 0.53, 3.2, 0, 4]] },
    pine: { parts: [{ geo: at(new THREE.CylinderGeometry(0.3, 0.3, 2.6, 7), 0, 1.3, 0), mat: trunk },
      { geo: merge(cones), mat: leaf, palette: PINE }], cols: [[0, 0, 0.48, 0.48, 2.6, 0, 4]] },
    bush: { parts: [{ geo: at(lumpy(new THREE.IcosahedronGeometry(1, 1), r, 0.25).scale(1, 0.7, 1), 0, 0.35, 0), mat: leaf, palette: BUSH }],
      cols: [], noShadow: true },
    boulder: { parts: [{ geo: merge([boulderTop, stone(0.4, 2.1, 0.6), stone(0.3, -1.9, -0.9)]), mat: rock }],
      cols: [[0, 0, 3.3, 2.7, 1.8, 0, 6]] },
    rockwall: { parts: [{ geo: merge(wallStones), mat: rock }], cols: seg(4, 4, 1, 0.9, 1.15, 6) },
    crates: { parts: [{ geo: merge([crate(-0.6, 0, 0, 0.05), crate(0.6, 0, 0.05, -0.08), crate(-0.05, 1.1, 0, 0.3)]), mat: wood },
      { geo: merge([...crateTrim(-0.6, 0, 0, 0.05), ...crateTrim(0.6, 0, 0.05, -0.08), ...crateTrim(-0.05, 1.1, 0, 0.3)]), mat: trim }],
      cols: [[0, 0, 2.3, 1.25, 1.1, 0, 2], [0, 0, 1.3, 1.3, 1.1, 1.1, 2]] },
    hay: { parts: [{ geo: merge([bale(-0.78), bale(0.78)]), mat: hay }], cols: [[0, 0, 1.3, 3.1, 1.5, 0, 3]] },
    logs: { parts: [{ geo: merge([log(0.33, -0.34), log(0.33, 0.34), log(0.88, 0)]), mat: bark }], cols: seg(4, 4, 1, 1.35, 1.2, 4) },
    barrels: { parts: [{ geo: merge([barrel(-0.45, -0.2), barrel(0.42, -0.25), barrel(0, 0.48)]), mat: metal, palette: BARREL }],
      cols: [[0, 0, 1.7, 1.7, 1.0, 0, 2]] },
    sandbags: { parts: [{ geo: merge(bags), mat: bag }], cols: seg(3, 3, 1, 0.65, 1.05, 6) },
  };
  return KINDS;
}

/* The world colliders of one prop: [x, z, w, d, h, y, pen] (y over its ground). */
export function propColliders(kind, x, z, yawDeg, s) {
  const K = kinds()[kind];
  if (!K) return [];
  const t = (yawDeg * Math.PI) / 180, c = Math.cos(t), sn = Math.sin(t), ac = Math.abs(c), as = Math.abs(sn);
  return K.cols.map(([cx, cz, w, d, h, y, pen]) => [
    x + (cx * c + cz * sn) * s, z + (-cx * sn + cz * c) * s,
    (ac * w + as * d) * s, (as * w + ac * d) * s, h * s, y * s, pen]);
}

/* Draw a map's props under `root` and lay their colliders through `api`
   (null: draw only). `groundY(x, z)` stands them on the hills. */
export function buildIslandProps(root, api, data, groundY = () => 0) {
  const K = kinds();
  const byKind = new Map();
  for (const it of data.items) {
    const name = data.kinds[it[0]];
    if (!K[name]) continue;
    if (!byKind.has(name)) byKind.set(name, []);
    byKind.get(name).push(it);
  }
  const dummy = new THREE.Object3D(), col = new THREE.Color(), r = rng(0x51ab);
  let instances = 0, draws = 0, colliders = 0;
  for (const [name, items] of byKind) {
    const kind = K[name];
    for (const part of kind.parts) {
      const mesh = new THREE.InstancedMesh(part.geo, part.mat, items.length);
      items.forEach(([, x10, z10, yaw, s100], i) => {
        const x = x10 / 10, z = z10 / 10, s = s100 / 100;
        dummy.position.set(x, groundY(x, z), z);
        dummy.rotation.set(0, (yaw * Math.PI) / 180, 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (part.palette) mesh.setColorAt(i, col.set(part.palette[Math.floor(r() * part.palette.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.08));
      });
      mesh.castShadow = !kind.noShadow;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.userData.props = name;
      root.add(mesh);
      instances += items.length;
      draws++;
    }
    if (!api) continue;
    for (const [, x10, z10, yaw, s100] of items) {
      const x = x10 / 10, z = z10 / 10;
      for (const [cx, cz, w, d, h, y, pen] of propColliders(name, x, z, yaw, s100 / 100)) {
        api.ghostBox(cx, cz, w, d, h, { y: y + groundY(cx, cz), pen });
        colliders++;
      }
    }
  }
  return { instances, draws, colliders };
}

export const PROP_KINDS = ["oak", "pine", "bush", "boulder", "rockwall", "crates", "hay", "logs", "barrels", "sandbags"];
