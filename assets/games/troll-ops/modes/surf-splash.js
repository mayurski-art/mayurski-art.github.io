// Troll Forces — the wipeout splash at Troll Beach (5c polish): when a rider
// goes in (us, a peer), a white crown of water jumps up where they hit, a
// foam ring spreads on the surface and droplets arc out and fall back.
// Plain three.js, pooled (two at once is plenty), a canvas dot for the drops. surfSplash()
// is called by social-surf.js; updateSurfSplash(dt) runs every frame.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";

const LIFE = 1.6;        // s a splash lasts
const DROPS = 110;       // droplets each
const POOL = 2;

let pool = null, fired = 0;
function build() {
  const crownM = new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
  // round droplets: a soft white dot
  const dot = document.createElement("canvas");
  dot.width = dot.height = 32;
  const dg = dot.getContext("2d"), rg = dg.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(0.6, "rgba(245,252,255,0.9)"); rg.addColorStop(1, "rgba(245,252,255,0)");
  dg.fillStyle = rg; dg.fillRect(0, 0, 32, 32);
  const dropM = new THREE.PointsMaterial({ color: 0xffffff, map: new THREE.CanvasTexture(dot), size: 0.16, transparent: true, opacity: 0.95, depthWrite: false });
  // the crown: an open, flared cylinder with a ragged rim
  const crownG = new THREE.CylinderGeometry(0.75, 0.42, 1, 18, 2, true);
  const pos = crownG.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.4) pos.setY(i, pos.getY(i) + 0.22 * Math.sin(i * 2.7) * Math.sin(i * 1.3));
  crownG.translate(0, 0.5, 0);
  const ringG = new THREE.RingGeometry(0.55, 1, 28);
  ringG.rotateX(-Math.PI / 2);
  pool = [];
  for (let k = 0; k < POOL; k++) {
    const g = new THREE.Group();
    g.visible = false;
    const crown = new THREE.Mesh(crownG, crownM.clone());
    const ring = new THREE.Mesh(ringG, ringM.clone());
    ring.position.y = 0.03;
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(DROPS * 3), 3));
    const drops = new THREE.Points(dg, dropM.clone());
    drops.frustumCulled = false;
    for (const m of [crown, ring, drops]) { m.renderOrder = 2; g.add(m); }
    pool.push({ g, crown, ring, drops, vel: new Float32Array(DROPS * 3), t: LIFE, scene: null });
  }
}

/* A splash at (x, y on the water, z), `size` 1 a full wipeout. */
export function surfSplash(x, y, z, size = 1) {
  const scene = game.scene;
  if (!scene) return;
  if (!pool) build();
  fired++;
  const s = pool.reduce((a, b) => (b.t > a.t ? b : a));   // the free (or oldest) one
  if (s.scene !== scene) { s.g.removeFromParent(); scene.add(s.g); s.scene = scene; }
  s.g.position.set(x, y, z);
  s.g.scale.setScalar(size);
  s.g.visible = true;
  s.t = 0;
  const p = s.drops.geometry.attributes.position.array, v = s.vel;
  for (let i = 0; i < DROPS; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.2 + Math.random() * 0.4;
    p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = 0.1; p[i * 3 + 2] = Math.sin(a) * r;
    const out = 1.0 + Math.random() * 2.6;
    v[i * 3] = Math.cos(a) * out; v[i * 3 + 1] = 3.0 + Math.random() * 3.6; v[i * 3 + 2] = Math.sin(a) * out;
  }
  s.drops.geometry.attributes.position.needsUpdate = true;
}

export function updateSurfSplash(dt) {
  if (!pool) return;
  for (const s of pool) {
    if (s.t >= LIFE) continue;
    s.t = Math.min(LIFE, s.t + dt);
    const u = s.t / LIFE;
    // the crown jumps up and falls back, spreading
    const up = u < 0.18 ? u / 0.18 : Math.max(0, 1 - (u - 0.18) / 0.5);
    s.crown.scale.set(0.9 + u * 1.4, Math.max(0.01, up * 1.9), 0.9 + u * 1.4);
    s.crown.material.opacity = 0.9 * Math.min(1, up * 1.5);
    // the foam ring spreads and thins
    s.ring.scale.setScalar(0.8 + u * 3.2);
    s.ring.material.opacity = 0.85 * (1 - u) ** 1.3;
    // the droplets: thrown out, gravity, gone into the water
    const p = s.drops.geometry.attributes.position.array, v = s.vel;
    for (let i = 0; i < DROPS; i++) {
      if (p[i * 3 + 1] < 0) continue;
      v[i * 3 + 1] -= 9.8 * dt;
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
    }
    s.drops.geometry.attributes.position.needsUpdate = true;
    s.drops.material.opacity = 0.95 * (1 - u * u);
    if (s.t >= LIFE) s.g.visible = false;
  }
}

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) window.__trollSurfSplash = { surfSplash, fired: () => fired, live: () => pool?.filter((s) => s.t < LIFE).length ?? 0 };
