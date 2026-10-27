// Troll Forces — Troll Royale: the Cope Plate and the Hopium as models.
//
// The floor loot (royale-zone.js LootField) and the HUD's gear icons
// (tools/troll-ops-gear-icons.mjs renders gear-icons/plate.png and heal.png
// from these) share them, so the thing on the floor is the thing on the chip.
//
// Each is two draws at most: the solid parts merged into one vertex-coloured
// mesh, plus the Hopium's glowing dose window. Geometry and materials are
// built once and shared by every copy (userData.shared: never disposed).

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* A part: a geometry moved into place and painted one colour. */
function part(geo, color, x = 0, y = 0, z = 0, rx = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "color") g.deleteAttribute(k);
  return g;
}

function merged(parts) {
  const g = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  g.userData.shared = true;
  return g;
}

/* ---- Cope Plate: a ballistic plate (SAPI cut: the top corners clipped
   for the shoulders), curved to a chest, a strap of tape across it. Stands
   upright, face to +z, centred on the origin. --------------------------- */

const PLATE = { w: 0.3, h: 0.38, t: 0.034, clip: 0.075, bow: 0.55 };
let plateGeo = null, plateMat = null;

function plateShape() {
  const { w, h, clip } = PLATE, x = w / 2, y = h / 2;
  const s = new THREE.Shape();
  s.moveTo(-x, -y + 0.02);
  s.quadraticCurveTo(-x, -y, -x + 0.02, -y);
  s.lineTo(x - 0.02, -y);
  s.quadraticCurveTo(x, -y, x, -y + 0.02);
  s.lineTo(x, y - clip);
  s.lineTo(x - clip, y);
  s.lineTo(-x + clip, y);
  s.lineTo(-x, y - clip);
  s.closePath();
  return s;
}

/* Bend a geometry round the vertical axis: the middle stands proud. */
function bow(g) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - PLATE.bow * p.getX(i) * p.getX(i));
  g.computeVertexNormals();
  return g;
}

function buildPlateGeo() {
  const ext = new THREE.ExtrudeGeometry(plateShape(), {
    depth: PLATE.t - 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 4,
  });
  ext.translate(0, 0, -PLATE.t / 2);
  // Face and back the plate's blue; the bevelled rim a darker edge.
  const body = ext.index ? ext.toNonIndexed() : ext;
  const n = body.attributes.position.count;
  const col = new Float32Array(n * 3);
  const face = new THREE.Color(0x5b7fa6), rim = new THREE.Color(0x24344a);
  for (const grp of ext.groups) {
    const c = grp.materialIndex === 0 ? face : rim;
    for (let i = grp.start; i < grp.start + grp.count; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  }
  body.setAttribute("color", new THREE.BufferAttribute(col, 3));
  body.deleteAttribute("uv");
  body.clearGroups();
  // Grip tape across the lower third, and a pale stencil block above it.
  const front = PLATE.t / 2 + 0.001;
  const tape = part(new THREE.BoxGeometry(PLATE.w + 0.006, 0.06, PLATE.t + 0.006), 0x1b232c, 0, -0.08, 0);
  const tag = part(new THREE.BoxGeometry(0.11, 0.05, 0.004), 0xc9d6e4, 0, 0.07, front);
  return bow(merged([body, tape, tag]));
}

export function buildCopePlate() {
  plateGeo ||= buildPlateGeo();
  plateMat ||= Object.assign(new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.5, metalness: 0.25, emissive: 0x16304f, emissiveIntensity: 0.6,
  }), { userData: { shared: true } });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(plateGeo, plateMat));
  g.userData.kind = "plate";
  return g;
}

/* ---- Hopium: a green autoinjector. Needle end down, the glowing dose in
   the window, a grip band, the dark plunger cap with its lime button on
   top. Stands along y, centred on the origin. ---------------------------- */

let hopGeo = null, hopGlowGeo = null, hopMat = null, hopGlowMat = null;

function buildHopiumGeo() {
  const C = (r0, r1, h, y, color, seg = 18) => part(new THREE.CylinderGeometry(r0, r1, h, seg), color, 0, y, 0);
  return merged([
    part(new THREE.CylinderGeometry(0.0035, 0.0035, 0.05, 6), 0xc9ced3, 0, -0.19, 0),   // needle
    C(0.012, 0.03, 0.02, -0.163, 0xe6ebe4),            // needle shroud's nose
    C(0.042, 0.042, 0.04, -0.133, 0xe6ebe4),           // needle shroud
    C(0.04, 0.04, 0.2, 0.0, 0x2f8f45),                 // body
    C(0.0425, 0.0425, 0.016, 0.062, 0xeef3ea),         // grip band
    C(0.044, 0.044, 0.06, 0.13, 0x23302a),             // plunger cap
    C(0.034, 0.044, 0.012, 0.166, 0x23302a),           // its shoulder
    C(0.022, 0.022, 0.016, 0.178, 0xb6ff3c),           // the button
  ]);
}

export function buildHopium() {
  hopGeo ||= buildHopiumGeo();
  if (!hopGlowGeo) { hopGlowGeo = new THREE.CylinderGeometry(0.0425, 0.0425, 0.09, 18); hopGlowGeo.translate(0, -0.03, 0); hopGlowGeo.userData.shared = true; }
  hopMat ||= Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.15 }), { userData: { shared: true } });
  hopGlowMat ||= Object.assign(new THREE.MeshStandardMaterial({
    color: 0x55ff7a, roughness: 0.25, emissive: 0x1d8a33, emissiveIntensity: 1.1,
  }), { userData: { shared: true } });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(hopGeo, hopMat), new THREE.Mesh(hopGlowGeo, hopGlowMat));
  g.userData.kind = "heal";
  return g;
}

/* The floor model for a Royale item kind, or null (guns and ammo boxes are
   built elsewhere). */
export function buildLootModel(kind) {
  return kind === "plate" ? buildCopePlate() : kind === "heal" ? buildHopium() : null;
}
