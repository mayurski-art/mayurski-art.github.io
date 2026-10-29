// Troll Forces — the Play page's stage dressing (char-inspector.js draws it).
//
// Fortnite's Chapter 1 lobby (user, 2026-10-29: the flat rings "don't look
// realistic ... similar to fortnite", with the Season 1 and Season 6 lobbies
// as the look): each of you stands on a round stone plinth, its top an inset
// that glows (yours purple, the party's teal) with a faint column of light
// rising off it; and through Halloween a few jack-o'-lanterns and candles
// stand in front of the plinths, the candles flickering. All of it built
// here from three.js shapes and canvas textures, no files.
//
// Plinths sit under the feet (their tops at y 0, the rig's floor), so the
// operators and the names over them don't move.

import * as THREE from "three";

/* Halloween: through October and to 5 November, as the backdrop reel
   (lobby-fn.js); ?season=halloween / ?season=off force it. */
export function halloween() {
  const force = new URLSearchParams(location.search).get("season");
  if (force) return force === "halloween";
  const d = new Date();
  return d.getMonth() === 9 || (d.getMonth() === 10 && d.getDate() <= 5);
}

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

/* A jack-o'-lantern: a ribbed, squashed ball, its carved face glowing.
   Two maps off one drawing: the skin (orange, the cuts dark at their
   edges) and the glow (the cuts only). SphereGeometry's u 0.25 faces +z,
   the camera. */
function carve(g, w, h) {
  const cx = w * 0.25, cy = h * 0.52, k = 1.7;
  const tri = (x, y, s) => { g.beginPath(); g.moveTo(x - s, y + s * 0.6); g.lineTo(x + s, y + s * 0.6); g.lineTo(x, y - s * 0.75); g.closePath(); g.fill(); };
  tri(cx - 30 * k, cy - 20 * k, 15 * k);
  tri(cx + 30 * k, cy - 20 * k, 15 * k);
  tri(cx, cy + 2 * k, 8 * k);
  g.beginPath();
  g.moveTo(cx - 52 * k, cy + 16 * k);
  g.quadraticCurveTo(cx, cy + 66 * k, cx + 52 * k, cy + 16 * k);
  g.quadraticCurveTo(cx, cy + 40 * k, cx - 52 * k, cy + 16 * k);
  g.fill();
}
let skinTex = null, faceTex = null;
function skin() {
  if (skinTex) return skinTex;
  skinTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = "#e0701c";
    g.fillRect(0, 0, w, h);
    // darker toward the top and bottom
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, "rgba(90,30,0,.45)"); v.addColorStop(0.3, "rgba(0,0,0,0)"); v.addColorStop(0.75, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(70,20,0,.55)");
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    // the cuts: a dark rind round each, the hole itself the glow's
    g.fillStyle = "#3a1200";
    g.save(); g.translate(w * 0.25, h * 0.52); g.scale(1.12, 1.12); g.translate(-w * 0.25, -h * 0.52); carve(g, w, h); g.restore();
    g.fillStyle = "#ffd25a";
    carve(g, w, h);
  });
  return skinTex;
}
function face() {
  if (faceTex) return faceTex;
  faceTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff0a0";
    carve(g, w, h);
  });
  return faceTex;
}
function pumpkin(size) {
  const geo = new THREE.SphereGeometry(1, 32, 20);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), rib = 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * 4)), 0.6);
    p.setXYZ(i, x * rib, y * 0.78 * (y > 0.9 ? 0.92 : 1), z * rib);
  }
  geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map: skin(), roughness: 0.55, emissive: 0xffb040, emissiveMap: face(), emissiveIntensity: 2.4 });
  const body = new THREE.Mesh(geo, m);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x5a4a22, roughness: 0.9 }));
  stem.position.y = 0.86;
  stem.rotation.z = 0.2;
  const g = new THREE.Group();
  g.add(body, stem);
  g.scale.setScalar(size);
  g.position.y = size * 0.75;
  return g;
}

/* A candle: wax, a wick, a flame that flickers (tick). */
let flameTex = null;
function flame() {
  if (flameTex) return flameTex;
  flameTex = canvasTex(64, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h * 0.7, 2, w / 2, h * 0.62, w * 0.5);
    r.addColorStop(0, "rgba(255,250,220,1)");
    r.addColorStop(0.35, "rgba(255,200,90,.9)");
    r.addColorStop(0.7, "rgba(255,120,30,.35)");
    r.addColorStop(1, "rgba(255,80,0,0)");
    g.fillStyle = r;
    g.beginPath();
    g.ellipse(w / 2, h * 0.62, w * 0.42, h * 0.38, 0, 0, Math.PI * 2);
    g.fill();
  });
  return flameTex;
}
const WAX = new THREE.MeshStandardMaterial({ color: 0xefe2c4, roughness: 0.7, emissive: 0xffb860, emissiveIntensity: 0.12 });
function candle(h, r) {
  const g = new THREE.Group();
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 12), WAX);
  wax.position.y = h / 2;
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flame(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  f.scale.set(r * 2.6, r * 5, 1);
  f.position.y = h + r * 2;
  g.add(wax, f);
  g.userData.flame = f;
  return g;
}

/* Halloween in front of the plinths, in the rig's space (the plinths at
   x 0 and +-1.05; the camera in front, +z): pumpkins at the front corners
   and outside the party's plinths, candles in clusters between. */
const PUMPKINS = [[-0.62, 0.62, 0.17, 0.5], [0.66, 0.58, 0.14, -0.4], [-1.62, 0.05, 0.2, 0.7], [1.6, 0.0, 0.17, -0.6], [0.36, 0.86, 0.09, -0.2]];
const CANDLES = [[-0.36, 0.8], [-0.28, 0.9], [-0.45, 0.92], [0.18, 0.95], [0.5, 0.86], [0.6, 0.98], [-1.38, 0.38], [-1.28, 0.5], [-1.5, 0.5], [1.32, 0.42], [1.44, 0.52], [1.25, 0.56], [-0.86, 0.36], [0.9, 0.34]];
export function buildHalloween() {
  const group = new THREE.Group();
  const r = rng(23), flames = [];
  for (const [x, z, s, yaw] of PUMPKINS) {
    const p = pumpkin(s);
    p.position.x = x; p.position.z = z;
    p.rotation.y = yaw;
    group.add(p);
  }
  for (const [x, z] of CANDLES) {
    const c = candle(0.06 + r() * 0.14, 0.022 + r() * 0.014);
    c.position.set(x, 0, z);
    group.add(c);
    flames.push({ f: c.userData.flame, base: c.userData.flame.scale.clone(), ph: r() * 10 });
  }
  // the warm light they throw on your legs and the plinths' fronts
  const warm = new THREE.PointLight(0xff8a2a, 1.6, 3.2, 1.6);
  warm.position.set(0, 0.25, 0.9);
  group.add(warm);
  let t = 0;
  return {
    group,
    tick(dt, still) {
      if (still) return;
      t += dt;
      for (const { f, base, ph } of flames) {
        const k = 1 + 0.12 * Math.sin(t * 13 + ph) + 0.08 * Math.sin(t * 29 + ph * 2);
        f.scale.set(base.x * (2 - k) ** 0.5, base.y * k, 1);
      }
      warm.intensity = 1.6 + 0.18 * Math.sin(t * 11) + 0.1 * Math.sin(t * 23);
    },
  };
}
