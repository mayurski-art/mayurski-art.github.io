// Troll Forces — Trollface Island's lit shop signs (doc "Troll Forces:
// Trollface Island in Blender", phase 1). The Blender build draws each shop a
// dark sign band and writes where it is (trollface-island-built.js, signs:
// [text, x, y, z, nx, nz, w, h, colour]); here every board gets its word
// drawn into one canvas atlas and a plane a centimetre proud of the band,
// unlit (MeshBasicMaterial: it glows for the bloom like the Shop's neon).
import * as THREE from "three";

const CELL_H = 96;          // atlas pixels a board's height
const PX_PER_M = 100;       // a board's width in atlas pixels per metre

export function buildIslandSigns(signs) {
  const group = new THREE.Group();
  if (!signs.length) return group;
  const widths = signs.map((s) => Math.ceil(s[6] * PX_PER_M));
  const c = document.createElement("canvas");
  c.width = Math.max(...widths);
  c.height = CELL_H * signs.length;
  const g = c.getContext("2d");
  g.fillStyle = "#0c0d0e";
  g.fillRect(0, 0, c.width, c.height);
  signs.forEach(([text, , , , , , w, h, colour], i) => {
    const y0 = i * CELL_H, W = widths[i];
    const hex = "#" + colour.toString(16).padStart(6, "0");
    // a thin rule in the sign's colour round the board, the word in the middle
    g.strokeStyle = hex; g.lineWidth = 3;
    g.strokeRect(6, y0 + 6, W - 12, CELL_H - 12);
    g.fillStyle = hex;
    g.shadowColor = hex; g.shadowBlur = 14;
    g.textAlign = "center"; g.textBaseline = "middle";
    let px = Math.floor(CELL_H * 0.78);
    g.font = `bold ${px}px Impact, 'Arial Black', sans-serif`;
    while (g.measureText(text).width > W - 30 && px > 20) { px -= 4; g.font = `bold ${px}px Impact, 'Arial Black', sans-serif`; }
    g.fillText(text, W / 2, y0 + CELL_H / 2 + 4);
    g.shadowBlur = 0;
    void h;
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const geos = [];
  signs.forEach(([, x, y, z, nx, nz, w, h], i) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const u1 = widths[i] / c.width, v0 = 1 - (i + 1) / signs.length, v1 = 1 - i / signs.length;
    geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, v1, u1, v1, 0, v0, u1, v0], 2));
    geo.rotateY(Math.atan2(nx, nz));              // a plane faces +z; turn it to its normal
    geo.translate(x + nx * 0.012, y, z + nz * 0.012);
    geos.push(geo);
  });
  for (const geo of geos) group.add(new THREE.Mesh(geo, mat));
  return group;
}
