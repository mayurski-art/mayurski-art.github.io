// Grin Sabers — Temple courtyard, the first duel arena.
//
// A round stone floor (radius 10 m, fighters kept inside 8.6 m), a ring of
// weathered pillars, two fire braziers, a broken arch behind, and sunset
// hills all round. Flat and fair: no hazards, the pillars stand outside the
// fighting ring.

import * as THREE from "three";

export const ARENA_RADIUS = 8.6;

function floorTexture() {
  const S = 1024, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  const cx = S / 2, cy = S / 2, px = S / 20;   // px per metre (20 m across)
  g.fillStyle = "#8d7a6a";
  g.fillRect(0, 0, S, S);
  // Rings of slabs, each slab its own shade.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rings = [0, 1.4, 2.9, 4.4, 6.0, 7.6, 9.2, 10.1];
  for (let i = 0; i < rings.length - 1; i++) {
    const r0 = rings[i] * px, r1 = rings[i + 1] * px;
    const n = i === 0 ? 1 : Math.round(6 + i * 7);
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2 + i * 0.37, a1 = ((k + 1) / n) * Math.PI * 2 + i * 0.37;
      const l = 46 + rnd() * 16, h = 22 + rnd() * 10;
      g.fillStyle = `hsl(${h} 16% ${l}%)`;
      g.beginPath();
      g.arc(cx, cy, r1, a0, a1);
      g.arc(cx, cy, r0, a1, a0, true);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(40,28,24,0.55)";
      g.lineWidth = 3;
      g.stroke();
    }
  }
  // Gold inlay rings and a grin-shaped arc at the centre.
  g.strokeStyle = "#c9953d";
  g.lineWidth = 7;
  for (const r of [2.9, 6.0]) { g.beginPath(); g.arc(cx, cy, r * px, 0, Math.PI * 2); g.stroke(); }
  g.lineWidth = 12;
  g.lineCap = "round";
  g.beginPath();
  g.arc(cx, cy - 0.25 * px, 0.95 * px, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  // Wear: soft dark blotches and light speckle.
  for (let i = 0; i < 260; i++) {
    const x = rnd() * S, y = rnd() * S, r = 4 + rnd() * 40;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() < 0.6;
    gr.addColorStop(0, dark ? "rgba(30,20,16,0.18)" : "rgba(255,240,220,0.12)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function stoneMat(color, rough = 0.92) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: true });
}

function pillar(h, broken) {
  const g = new THREE.Group();
  const m = stoneMat(0xb39c86);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 1.1), m);
  base.position.y = 0.175;
  g.add(base);
  const shaftH = broken ? h * 0.55 : h;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, shaftH, 10), m);
  shaft.position.y = 0.35 + shaftH / 2;
  g.add(shaft);
  if (broken) {
    // a jagged top
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 6), m);
    cap.position.y = 0.35 + shaftH + 0.05;
    cap.rotation.z = 0.5;
    cap.scale.y = 0.5;
    g.add(cap);
  } else {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 1.0), m);
    cap.position.y = 0.35 + shaftH + 0.15;
    g.add(cap);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function brazier(scene, x, z) {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.6, metalness: 0.7 });
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 1.0, 8), iron);
  stand.position.y = 0.5;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.22, 0.28, 12, 1, true), iron);
  bowl.position.y = 1.12;
  const coals = new THREE.Mesh(new THREE.CircleGeometry(0.38, 12), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
  coals.rotation.x = -Math.PI / 2;
  coals.position.y = 1.2;
  g.add(stand, bowl, coals);
  // Flames: a few additive billboards that flicker in onBeforeRender.
  const c = document.createElement("canvas");
  c.width = 64; c.height = 128;
  const fg = c.getContext("2d");
  const gr = fg.createRadialGradient(32, 92, 2, 32, 80, 60);
  gr.addColorStop(0, "rgba(255,240,180,1)");
  gr.addColorStop(0.3, "rgba(255,150,40,0.85)");
  gr.addColorStop(0.7, "rgba(200,50,10,0.3)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  fg.fillStyle = gr;
  fg.beginPath();
  fg.moveTo(32, 4); fg.quadraticCurveTo(62, 70, 46, 120); fg.lineTo(18, 120); fg.quadraticCurveTo(2, 70, 32, 4);
  fg.fill();
  const tex = new THREE.CanvasTexture(c);
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: 0xffffff }));
    s.position.set((i - 1) * 0.12, 1.55, (i % 2) * 0.08);
    s.scale.set(0.5, 0.9, 1);
    s.userData.seed = i * 2.7;
    g.add(s);
    flames.push(s);
  }
  g.position.set(x, 0, z);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  return (t) => {
    for (const s of flames) {
      const k = 1 + 0.18 * Math.sin(t * 13 + s.userData.seed) + 0.1 * Math.sin(t * 29 + s.userData.seed * 3);
      s.scale.set(0.5 * (2 - k) * 0.9 + 0.05, 0.95 * k, 1);
      s.material.opacity = 0.75 + 0.25 * Math.sin(t * 17 + s.userData.seed);
    }
  };
}

export function buildCourtyard(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // Floor disc and its raised rim.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(10.1, 96), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.9, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(10.15, 0.18, 6, 96), stoneMat(0x9c8571));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.05;
  rim.receiveShadow = true;
  root.add(rim);
  // Two wide steps down to the ground below the courtyard.
  for (const [r, y] of [[11.2, -0.3], [12.4, -0.6]]) {
    const step = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.1, 0.3, 96, 1, true), stoneMat(0x8f7966));
    step.position.y = y + 0.15;
    root.add(step);
    const top = new THREE.Mesh(new THREE.RingGeometry(r - 1.2, r, 96), stoneMat(0x9a836f));
    top.rotation.x = -Math.PI / 2;
    top.position.y = y + 0.3;
    top.receiveShadow = true;
    root.add(top);
  }

  // Pillars round the ring; a few broken.
  const N = 12;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.13;
    const p = pillar(4.2, i % 4 === 1 || i === 6);
    p.position.set(Math.cos(a) * 10.9, -0.3, Math.sin(a) * 10.9);
    p.rotation.y = -a;
    root.add(p);
    if (i === 5) {
      // a fallen drum on the step
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.4, 10), stoneMat(0xb39c86));
      drum.rotation.z = Math.PI / 2;
      drum.rotation.y = -a + 0.6;
      drum.position.set(Math.cos(a + 0.12) * 11.6, -0.05, Math.sin(a + 0.12) * 11.6);
      drum.castShadow = true;
      root.add(drum);
    }
  }

  // The broken arch: the temple gate on the far side, framing the sunset.
  const archM = stoneMat(0xa58e78);
  const arch = new THREE.Group();
  const legL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7, 1.6), archM);
  legL.position.set(-3, 3.5, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.2, 1.6), archM);
  legR.position.set(3, 2.6, 0);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.1, 1.7), archM);
  lintel.position.set(-0.9, 7.4, 0);
  lintel.rotation.z = -0.08;
  arch.add(legL, legR, lintel);
  arch.position.set(-9, -0.6, -14);
  arch.rotation.y = 0.55;
  arch.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(arch);

  // Hills: a rough ring of low dark mounds, far enough to sit in the fog.
  const hillM = new THREE.MeshStandardMaterial({ color: 0x4a2f3e, roughness: 1, flatShading: true });
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = 34 + rnd() * 22, h = 4 + rnd() * 9;
    const w = 7 + rnd() * 10;
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), hillM);
    hill.scale.set(w, h, w * (0.7 + rnd() * 0.6));
    hill.position.set(Math.cos(a) * r, -2.2, Math.sin(a) * r);
    hill.rotation.y = rnd() * 3;
    root.add(hill);
  }
  const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.MeshStandardMaterial({ color: 0x5b3c40, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.62;
  ground.receiveShadow = true;
  root.add(ground);

  const fires = [brazier(root, -6.6, -6.6), brazier(root, 6.6, 6.6)];
  return {
    root,
    radius: ARENA_RADIUS,
    update(t) { for (const f of fires) f(t); },
  };
}
