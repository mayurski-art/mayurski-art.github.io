// Troll Ops — 3D props for The Pentagrin.
//
// Modelled on what's actually in "Five": the boardroom conference table with
// its red telephones and flags, the war room's DEFCON panels and wall
// displays, the labs' benches, weapons lockers, prototype teleporter and
// furnace, plus the perk machines, Mystery Box and Pack-a-Punch.
//
// Each helper takes the map builder `api`, so anything that should stop a
// bullet or a body goes through `api.box` (a real collider) and the detail
// rides along as `api.prop` (decorative).

import * as THREE from "three";

const GREY = 0x8b9096;
const DARK = 0x2c3136;
const STEEL = 0x6d747c;
const WOOD = 0x6b4a30;

function mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; }

/* ---------------------------------------------------------- boardroom */

export function conferenceTable(api, { x, z, y, len = 12, wid = 3.2 }) {
  const top = api.mat(WOOD, 0.45, 0.05);
  const leg = api.mat(DARK, 0.5, 0.4);

  // the table itself is cover, so it gets a real collider
  api.box(x, z, wid, len, 0.78, { color: WOOD, y, pen: 1.6, rough: 0.45 });

  const g = new THREE.Group();
  const lip = mesh(new THREE.BoxGeometry(wid + 0.25, 0.08, len + 0.3), top);
  lip.position.set(x, y + 0.82, z);
  g.add(lip);
  for (const lz of [-len * 0.35, 0, len * 0.35]) {
    const l = mesh(new THREE.BoxGeometry(0.3, 0.78, 0.3), leg);
    l.position.set(x, y + 0.39, z + lz);
    g.add(l);
  }
  api.prop(g);

  // chairs down both sides
  for (let i = -2; i <= 2; i++) {
    officeChair(api, { x: x - wid * 0.85, z: z + i * (len / 6), y, face: 1 });
    officeChair(api, { x: x + wid * 0.85, z: z + i * (len / 6), y, face: -1 });
  }

  // the red telephones the boardroom is known for
  redPhone(api, { x: x - 0.6, z: z - len * 0.28, y: y + 0.86 });
  redPhone(api, { x: x + 0.6, z: z + len * 0.3, y: y + 0.86 });
}

export function officeChair(api, { x, z, y, face = 1 }) {
  const m = api.mat(DARK, 0.6, 0.2);
  const g = new THREE.Group();
  const seat = mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), m);
  seat.position.set(x, y + 0.45, z);
  const back = mesh(new THREE.BoxGeometry(0.5, 0.55, 0.09), m);
  back.position.set(x + 0.24 * face, y + 0.74, z);
  const post = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 8), m);
  post.position.set(x, y + 0.22, z);
  const base = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 10), m);
  base.position.set(x, y + 0.03, z);
  g.add(seat, back, post, base);
  api.prop(g);
}

export function redPhone(api, { x, z, y }) {
  const red = api.mat(0xb2231f, 0.4, 0.1);
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(0.22, 0.09, 0.3), red);
  body.position.set(x, y + 0.05, z);
  const handset = mesh(new THREE.BoxGeometry(0.1, 0.08, 0.32), red);
  handset.position.set(x, y + 0.13, z);
  g.add(body, handset);
  api.prop(g);
}

export function flagStand(api, { x, z, y }) {
  const poleMat = api.mat(0xc7a24a, 0.35, 0.7);
  const cloth = api.mat(0x2a3b7a, 0.8, 0);
  const g = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.045, 0.045, 3, 8), poleMat);
  pole.position.set(x, y + 1.5, z);
  const finial = mesh(new THREE.SphereGeometry(0.09, 8, 8), poleMat);
  finial.position.set(x, y + 3.05, z);
  const base = mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.1, 12), api.mat(DARK, 0.5, 0.4));
  base.position.set(x, y + 0.05, z);
  const banner = mesh(new THREE.BoxGeometry(0.04, 1.35, 0.85), cloth);
  banner.position.set(x + 0.06, y + 2.15, z + 0.44);
  g.add(pole, finial, base, banner);
  api.prop(g);
}

/* Metal detector arches, as in the boardroom hallways. */
export function metalDetector(api, { x, z, y, rot = 0 }) {
  const m = api.mat(0x9aa0a6, 0.5, 0.3);
  const g = new THREE.Group();
  const side = new THREE.BoxGeometry(0.16, 2.2, 0.3);
  const l = mesh(side, m), r = mesh(side, m);
  l.position.set(-0.75, 1.1, 0);
  r.position.set(0.75, 1.1, 0);
  const top = mesh(new THREE.BoxGeometry(1.66, 0.22, 0.3), m);
  top.position.set(0, 2.3, 0);
  g.add(l, r, top);
  g.position.set(x, y, z);
  g.rotation.y = rot;
  api.prop(g);
}

/* ---------------------------------------------------------- war room */

/* DEFCON console: a slanted panel with a screen and a big lever. */
export function defconPanel(api, { x, z, y, rot = 0, index = 1 }) {
  const body = api.mat(0x4a5158, 0.55, 0.35);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x2fd0a8 });
  const leverMat = api.mat(0xc2352c, 0.4, 0.3);

  api.box(x, z, 1.5, 0.8, 1.05, { color: 0x4a5158, y, pen: 3 });

  const g = new THREE.Group();
  const face = mesh(new THREE.BoxGeometry(1.5, 0.5, 0.16), body);
  face.position.set(0, 1.2, -0.1);
  face.rotation.x = -0.5;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.3), screenMat);
  screen.position.set(0, 1.28, 0.02);
  screen.rotation.x = -0.5;
  const lever = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.38, 8), leverMat);
  lever.position.set(0.52, 1.32, 0.12);
  lever.rotation.x = 0.4;
  const knob = mesh(new THREE.SphereGeometry(0.075, 8, 8), leverMat);
  knob.position.set(0.52, 1.5, 0.19);
  g.add(face, screen, lever, knob);
  g.position.set(x, y, z);
  g.rotation.y = rot;
  g.userData.defconIndex = index;
  api.prop(g);
  return g;
}

/* Big situation-room wall display. */
export function wallScreen(api, { x, z, y, w = 5, h = 2.6, rot = 0, color = 0x1d4f6b }) {
  const frame = api.mat(DARK, 0.5, 0.4);
  const g = new THREE.Group();
  const bezel = mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.16), frame);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color }),
  );
  glow.position.z = 0.1;
  // faint grid so it reads as a map display rather than a flat panel
  for (let i = 1; i < 5; i++) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(w, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x8fd8ff }),
    );
    line.position.set(0, -h / 2 + (h / 5) * i, 0.11);
    g.add(line);
  }
  g.add(bezel, glow);
  g.position.set(x, y + h / 2 + 1.2, z);
  g.rotation.y = rot;
  api.prop(g);
}

/* ---------------------------------------------------------- labs */

export function labBench(api, { x, z, y, len = 4, rot = 0 }) {
  api.box(x, z, rot ? 1 : len, rot ? len : 1, 0.92, { color: 0x9fa6ab, y, pen: 2, metal: 0.3 });
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: 0x7fe0d0, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.75 });
  for (let i = -1; i <= 1; i++) {
    const off = i * (len * 0.28);
    const flask = mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.24, 10), glass);
    flask.position.set(rot ? x : x + off, y + 1.04, rot ? z + off : z);
    g.add(flask);
  }
  api.prop(g);
}

/* The Ray Gun on the workbench, mid-build. */
export function rayGunTable(api, { x, z, y }) {
  api.box(x, z, 2.2, 1.1, 0.9, { color: 0x9fa6ab, y, pen: 2, metal: 0.3 });
  const g = new THREE.Group();
  const shell = api.mat(0x3f8f4a, 0.4, 0.5);
  const glow = new THREE.MeshBasicMaterial({ color: 0x9dff5c });
  const body = mesh(new THREE.BoxGeometry(0.5, 0.2, 0.18), shell);
  body.position.set(x, y + 1.02, z);
  const barrel = mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.3, 10), shell);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(x + 0.36, y + 1.04, z);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), glow);
  core.position.set(x - 0.1, y + 1.14, z);
  g.add(body, barrel, core);
  api.prop(g);
}

export function weaponsLocker(api, { x, z, y, rot = 0 }) {
  const w = rot ? 0.6 : 1.6;
  const d = rot ? 1.6 : 0.6;
  api.box(x, z, w, d, 2.1, { color: 0x4f5a52, y, pen: 4, metal: 0.4 });
  const g = new THREE.Group();
  const line = api.mat(0x2f372f, 0.6, 0.4);
  const split = mesh(new THREE.BoxGeometry(rot ? 0.66 : 0.06, 2.0, rot ? 0.06 : 0.66), line);
  split.position.set(x, y + 1.05, z);
  const handle = mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), api.mat(STEEL, 0.4, 0.6));
  handle.position.set(x + (rot ? 0.34 : 0.18), y + 1.1, z + (rot ? 0.18 : 0.34));
  g.add(split, handle);
  api.prop(g);
}

/* Prototype teleporter pad — the labs one under construction, and the war
   room one that actually works. */
export function teleporterPad(api, { x, z, y, active = false }) {
  const ring = api.mat(active ? 0x6f7f8a : 0x5a5f63, 0.4, 0.7);
  api.box(x, z, 3, 3, 0.2, { color: 0x585e63, y, pen: 5, metal: 0.5 });

  const g = new THREE.Group();
  for (const [ox, oz] of [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]]) {
    const post = mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.6, 8), ring);
    post.position.set(x + ox, y + 1.3, z + oz);
    g.add(post);
  }
  const cap = mesh(new THREE.TorusGeometry(1.55, 0.09, 8, 20), ring);
  cap.rotation.x = Math.PI / 2;
  cap.position.set(x, y + 2.6, z);
  g.add(cap);

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 24),
    new THREE.MeshBasicMaterial({
      color: active ? 0x66e0ff : 0x35424a,
      transparent: true, opacity: active ? 0.55 : 0.3, side: THREE.DoubleSide,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, y + 0.22, z);
  g.add(glow);
  api.prop(g);
  return g;
}

export function furnace(api, { x, z, y }) {
  api.box(x, z, 3.2, 2.2, 3, { color: 0x4a3f38, y, pen: 6, metal: 0.3 });
  const g = new THREE.Group();
  const mouth = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.1),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a }),
  );
  mouth.position.set(x, y + 1.1, z + 1.12);
  g.add(mouth);
  const flue = mesh(new THREE.CylinderGeometry(0.34, 0.34, 2.4, 10), api.mat(0x3a332e, 0.8, 0.3));
  flue.position.set(x + 1.1, y + 4.1, z);
  g.add(flue);
  api.prop(g);

  const heat = new THREE.PointLight(0xff7a2a, 14, 12, 2);
  heat.position.set(x, y + 1.3, z + 1.6);
  api.prop(heat);
}

/* ---------------------------------------------------------- machines */

const PERK_LOOKS = {
  jugger:  { color: 0xb2231f, label: 0xffd166, name: "Grinnernog" },
  speed:   { color: 0x2f8f4a, label: 0xd9ffe0, name: "Speed Troll" },
  revive:  { color: 0x2f6f9f, label: 0xd0ecff, name: "Quick Grin" },
  doubletap:{ color: 0x8a5ad6, label: 0xe8d9ff, name: "Double Trap" },
};

export function perkMachine(api, { x, z, y, kind = "jugger", rot = 0 }) {
  const look = PERK_LOOKS[kind] || PERK_LOOKS.jugger;
  api.box(x, z, 1.2, 0.9, 2.2, { color: look.color, y, pen: 4, metal: 0.25 });

  const g = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.9),
    new THREE.MeshBasicMaterial({ color: 0x101418 }),
  );
  glass.position.set(0, 1.45, 0.47);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.34),
    new THREE.MeshBasicMaterial({ color: look.label }),
  );
  sign.position.set(0, 2.02, 0.47);
  g.add(glass, sign);
  g.position.set(x, y, z);
  g.rotation.y = rot;
  api.prop(g);

  const lamp = new THREE.PointLight(look.color, 8, 7, 2);
  lamp.position.set(x, y + 2.1, z);
  api.prop(lamp);
  return { name: look.name };
}

export function mysteryBox(api, { x, z, y }) {
  api.box(x, z, 1.6, 1.1, 0.95, { color: WOOD, y, pen: 2 });
  const g = new THREE.Group();
  const lid = mesh(new THREE.BoxGeometry(1.7, 0.12, 1.2), api.mat(0x53381f, 0.6, 0.05));
  lid.position.set(x, y + 1.02, z);
  const q = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x2fd0a8 }),
  );
  q.position.set(x, y + 0.6, z + 0.57);
  g.add(lid, q);
  api.prop(g);
}

export function packAPunch(api, { x, z, y, rot = 0 }) {
  api.box(x, z, 2.0, 1.2, 1.9, { color: 0x2b2f33, y, pen: 5, metal: 0.5 });
  const g = new THREE.Group();
  const slot = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x9dff5c }),
  );
  slot.position.set(0, 1.2, 0.62);
  const arm = mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), api.mat(STEEL, 0.4, 0.7));
  arm.position.set(0.75, 2.2, 0);
  const head = mesh(new THREE.BoxGeometry(0.7, 0.35, 0.7), api.mat(0x3a4046, 0.5, 0.6));
  head.position.set(0.2, 2.6, 0);
  g.add(slot, arm, head);
  g.position.set(x, y, z);
  g.rotation.y = rot;
  api.prop(g);

  const lamp = new THREE.PointLight(0x9dff5c, 12, 9, 2);
  lamp.position.set(x, y + 1.6, z);
  api.prop(lamp);
}

/* Wall-mounted weapon for sale, with its price card. */
export function wallBuy(api, { x, z, y, rot = 0, tint = 0x2a2c28 }) {
  const g = new THREE.Group();
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.9),
    new THREE.MeshBasicMaterial({ color: 0x14181c }),
  );
  const gun = mesh(new THREE.BoxGeometry(1.05, 0.14, 0.1), api.mat(tint, 0.45, 0.6));
  gun.position.set(0, 0.05, 0.09);
  const mag = mesh(new THREE.BoxGeometry(0.12, 0.24, 0.08), api.mat(tint, 0.45, 0.6));
  mag.position.set(-0.1, -0.14, 0.09);
  g.add(card, gun, mag);
  g.position.set(x, y + 1.5, z);
  g.rotation.y = rot;
  api.prop(g);
  return g;
}

/* Elevator doors — a recess with two sliding leaves. */
export function elevatorDoors(api, { x, z, y, rot = 0 }) {
  const g = new THREE.Group();
  const frame = mesh(new THREE.BoxGeometry(2.6, 3, 0.2), api.mat(0x50575d, 0.5, 0.5));
  frame.position.set(0, 1.5, 0);
  const leafMat = api.mat(0x7d858c, 0.35, 0.75);
  const l = mesh(new THREE.BoxGeometry(1.15, 2.7, 0.12), leafMat);
  const r = mesh(new THREE.BoxGeometry(1.15, 2.7, 0.12), leafMat);
  l.position.set(-0.6, 1.4, 0.1);
  r.position.set(0.6, 1.4, 0.1);
  const call = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xffb020 }),
  );
  call.position.set(1.5, 1.5, 0.12);
  g.add(frame, l, r, call);
  g.position.set(x, y, z);
  g.rotation.y = rot;
  api.prop(g);
  return g;
}

/* Boarded window: where zombies come in. Planks are decorative so rounds
   pass through; the barricade logic lives in zombies.js. */
export function boardedWindow(api, { x, z, y, rot = 0 }) {
  const g = new THREE.Group();
  const recess = mesh(new THREE.BoxGeometry(2.2, 1.7, 0.14), api.mat(0x14181c, 0.9, 0));
  recess.position.set(0, 1.5, 0);
  g.add(recess);
  const plank = api.mat(0x7a5433, 0.75, 0.03);
  for (let i = 0; i < 4; i++) {
    const p = mesh(new THREE.BoxGeometry(2.5, 0.26, 0.1), plank);
    p.position.set(0, 0.95 + i * 0.36, 0.12);
    p.rotation.z = (i % 2 ? 1 : -1) * 0.06;
    g.add(p);
  }
  g.position.set(x, y, z);
  g.rotation.y = rot;
  api.prop(g);
  return g;
}

/* Ceiling strip light. */
/* A false lit flag gives the fitting without the light. Point lights are the
   most expensive thing in this renderer, so a ceiling gets a few real ones
   and fills the rest of the run with bars that only look lit. */
export function stripLight(api, { x, z, y, color = 0xdfe9ff, intensity = 10, range = 16, lit = true }) {
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.08, 0.3),
    new THREE.MeshBasicMaterial({ color }),
  );
  bar.position.set(x, y, z);
  api.prop(bar);
  if (!lit) return;
  const l = new THREE.PointLight(color, intensity, range, 2);
  l.position.set(x, y - 0.3, z);
  api.prop(l);
  // api.prop() flags everything a shadow caster, which on a light means a
  // whole cube shadow map. A ceiling full of them exhausts the texture
  // units and the renderer drops the lighting entirely — the room goes black.
  l.castShadow = false;
}
