// Troll Forces — the Play page's stage dressing (char-inspector.js draws it).
//
// Fortnite's Chapter 1 lobby (user, 2026-10-29: the flat rings "don't look
// realistic ... similar to fortnite", with the Season 1 and Season 6 lobbies
// as the look): each of you stands on a round stone plinth, its top an inset
// that glows (yours purple, the party's teal) with a faint column of light
// rising off it. Built here from three.js shapes and canvas textures, no
// files. (No pumpkins or candles on the stage: the user, 2026-10-29, "the
// background image takes care of the overall halloween theme".)
//
// Plinths sit under the feet (their tops at y 0, the rig's floor), so the
// operators and the names over them don't move.

import * as THREE from "three";

const canvasTex = (w, h, draw, srgb = true) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
// a seeded random, so every load draws the same stone
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/* Weathered stone: blotches, a few cracks, darker toward the foot. */
let stoneTex = null;
function stone() {
  if (stoneTex) return stoneTex;
  stoneTex = canvasTex(256, 64, (g, w, h) => {
    const r = rng(7);
    g.fillStyle = "#5d5a66";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const v = 70 + r() * 50 | 0;
      g.fillStyle = `rgba(${v},${v - 4},${v + 8},${0.18 + r() * 0.25})`;
      g.beginPath();
      g.arc(r() * w, r() * h, 2 + r() * 9, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = "rgba(25,22,32,.55)";
    g.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      let x = r() * w, y = r() * h * 0.4;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 14; y += 4 + r() * 8; g.lineTo(x, y); }
      g.stroke();
    }
    // the block joints
    g.strokeStyle = "rgba(20,18,28,.7)";
    g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const x = (i + r() * 0.3) * w / 6; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    const fade = g.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(8,6,16,.55)");
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
  });
  stoneTex.wrapS = THREE.RepeatWrapping;
  return stoneTex;
}

/* The inset's glow: bright in the middle, a ring of light at the rim,
   swirls of mist across it. White: the material tints it. */
let glowTex = null;
function glow() {
  if (glowTex) return glowTex;
  glowTex = canvasTex(256, 256, (g, w) => {
    const c = w / 2, rad = g.createRadialGradient(c, c, 0, c, c, c);
    rad.addColorStop(0, "rgba(255,255,255,.95)");
    rad.addColorStop(0.55, "rgba(255,255,255,.55)");
    rad.addColorStop(0.86, "rgba(255,255,255,.9)");
    rad.addColorStop(0.93, "rgba(255,255,255,.45)");
    rad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, w, w);
    const r = rng(11);
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(0,0,0,${0.12 + r() * 0.18})`;
      g.lineWidth = 3 + r() * 8;
      g.beginPath();
      g.arc(c, c, 18 + r() * 90, r() * 6.28, r() * 6.28 + 0.6 + r() * 1.4);
      g.stroke();
    }
  });
  return glowTex;
}
/* The column of light off the top: bright at the foot, gone by the top. */
let beamTex = null;
function beam() {
  if (beamTex) return beamTex;
  beamTex = canvasTex(4, 128, (g, w, h) => {
    const l = g.createLinearGradient(0, h, 0, 0);
    l.addColorStop(0, "rgba(255,255,255,.55)");
    l.addColorStop(0.35, "rgba(255,255,255,.16)");
    l.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = l;
    g.fillRect(0, 0, w, h);
  });
  return beamTex;
}

const additive = (map, color, opacity = 1) => new THREE.MeshBasicMaterial({
  map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
});

/* One plinth: radius `r`, its glow `color`. The group's y 0 is its top. */
export function buildPlinth(r, color) {
  const group = new THREE.Group();
  const H = 0.2;
  const side = new THREE.MeshStandardMaterial({ map: stone(), color: 0xb8b4c4, roughness: 0.92, metalness: 0 });
  const top = new THREE.MeshStandardMaterial({ color: 0x4a4756, roughness: 0.85, metalness: 0 });
  // the drum, a lip round the top, the inset
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, H, 48, 1, true), side);
  drum.position.y = -H / 2 - 0.035;
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.05, 48), [side, top, top]);
  lip.position.y = -0.025;
  const inset = new THREE.Mesh(new THREE.CircleGeometry(r * 0.84, 48), new THREE.MeshStandardMaterial({ color: 0x1b1824, roughness: 0.6, emissive: color, emissiveIntensity: 0.35 }));
  inset.rotation.x = -Math.PI / 2;
  inset.position.y = 0.002;
  const shine = new THREE.Mesh(new THREE.CircleGeometry(r * 0.86, 48), additive(glow(), color, 0.6));
  shine.rotation.x = -Math.PI / 2;
  shine.position.y = 0.006;
  shine.renderOrder = 2;
  // the light rising: two crossed planes would show their edges side-on, so
  // an open cylinder, its inside drawn too
  const column = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.84, 0.9, 40, 1, true), additive(beam(), color, 0.22));
  column.position.y = 0.45;
  column.renderOrder = 3;
  group.add(drum, lip, inset, shine, column);
  group.userData = { shine, column, inset };
  return group;
}
