// Troll Us web: room signs. In Studio each is a SurfaceGui with one TextLabel on a wall face; here it is a canvas
// texture on a thin plane laid on the same face of the same part.
import * as THREE from 'three';
import { frameMatrix } from './parts.js';

// the outward normal and the plane's width/height for each Roblox face, in the part's own frame
const FACES = {
  Front: { n: [0, 0, -1], w: 0, h: 1, rotY: Math.PI },
  Back: { n: [0, 0, 1], w: 0, h: 1, rotY: 0 },
  Right: { n: [1, 0, 0], w: 2, h: 1, rotY: Math.PI / 2 },
  Left: { n: [-1, 0, 0], w: 2, h: 1, rotY: -Math.PI / 2 },
  Top: { n: [0, 1, 0], w: 0, h: 2, rotX: -Math.PI / 2 },
  Bottom: { n: [0, -1, 0], w: 0, h: 2, rotX: Math.PI / 2 },
};
// Roblox fonts to their nearest web font
const FONT = { GothamBlack: '900', GothamBold: '700', LuckiestGuy: '700' };

function signTexture(text, wStuds, hStuds) {
  const px = 64; // pixels per stud
  const c = document.createElement('canvas');
  c.width = Math.max(64, Math.round(wStuds * px)); c.height = Math.max(32, Math.round(hStuds * px));
  const g = c.getContext('2d');
  if (text.bgTransparency < 1) {
    g.globalAlpha = 1 - text.bgTransparency;
    g.fillStyle = text.bg; g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1;
  }
  const weight = FONT[text.font] || '700';
  // TextScaled: the biggest size that fits the box (with Studio's padding of about 6%)
  let size = text.scaled ? c.height * 0.8 : text.textSize * (px / 50);
  g.font = `${weight} ${size}px "Gotham", "Montserrat", "Arial Black", Arial, sans-serif`;
  const maxW = c.width * 0.88;
  const w = g.measureText(text.text).width;
  if (text.scaled && w > maxW) { size *= maxW / w; g.font = `${weight} ${size}px "Gotham", "Montserrat", "Arial Black", Arial, sans-serif`; }
  g.fillStyle = text.color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text.text, c.width / 2, c.height / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildSigns(nodes) {
  const group = new THREE.Group();
  group.name = 'Signs';
  nodes.forEach((sign, i) => {
    if (sign.kind !== 'sign') return;
    const part = nodes[sign.parent];
    const text = nodes.find((n) => n.parent === i && n.kind === 'text');
    const face = FACES[sign.face];
    if (!part || part.kind !== 'part' || !text || !face) return;
    const size = part.size;
    const w = size[face.w], h = size[face.h];
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: signTexture(text, w, h), transparent: text.bgTransparency > 0, roughness: 0.8 }));
    // lay it on the face, a hair proud of it
    const off = new THREE.Vector3(...face.n).multiply(new THREE.Vector3(size[0] / 2 + 0.02, size[1] / 2 + 0.02, size[2] / 2 + 0.02));
    plane.position.copy(off);
    if (face.rotY != null) plane.rotation.y = face.rotY;
    if (face.rotX != null) plane.rotation.x = face.rotX;
    const holder = new THREE.Group();
    frameMatrix(part.cf, holder.matrix);
    holder.matrix.decompose(holder.position, holder.quaternion, holder.scale);
    holder.add(plane);
    holder.name = 'Sign ' + text.text;
    group.add(holder);
  });
  return group;
}
