// Troll Forces — Troll Royale (battle royale), phase 1: "Mini Royale".
//
// One life, land with a pistol, loot the rest, and a closing circle (the
// Cringe) that squeezes everyone together until one troll is left. Design:
// the "Troll Forces Battle Royale design" doc (HANDOFF.md has the link).
//
// Nothing here is sent over the wire unless it has to be. Every client
// builds the same zone and the same floor loot from one match seed (the room
// code + the match number, like the map vote), and runs the zone off the
// shared match clock. Only changes to the loot are messages: someone picked
// an item up ("take"), or dropped one ("add": a swapped gun, a death's gear).
//
// game.js owns the rules (damage, pickups, the end); this file owns the
// zone maths, the loot tables and everything drawn for them.

import * as THREE from "three";
import { WEAPON_DEFS } from "./weapons.js?v=to-gl1";
import { buildWeaponMesh, stripLights } from "./weapon-model.js?v=gm1";
import { ATTACHMENTS, SLOTS, defaultLoadoutFor, resolveWeapon } from "./attachments.js";
import { FlowField } from "./nav.js";

/* ---- tuning ------------------------------------------------------------ */

export const ROYALE = {
  players: 10,            // the room is padded with bots up to this
  startWeapon: "pocketgrin",
  maxArmor: 150,          // 3 plates
  plateHp: 50,
  carryPlates: 3,
  carryHeals: 2,
  plateTime: 1.1,         // seconds to put one on
  healTime: 2.6,          // seconds from pressing to full
  lootSpacing: 4.5,       // metres between floor loot spots
  lootPerSqM: 1 / 95,     // floor loot density (Grin Beach: ~60 items)
  gunDetail: 26,          // metres: gun models inside this, a beam beyond
  // Phase 1 is sized for an existing ~70-80 m map: `frac` is the circle's
  // radius as a share of the first circle's. The island (phase 3) gets the
  // doc's longer timings.
  phases: [
    { wait: 45, close: 30, frac: 0.62, dps: 1 },
    { wait: 35, close: 25, frac: 0.38, dps: 2 },
    { wait: 30, close: 20, frac: 0.22, dps: 4 },
    { wait: 25, close: 20, frac: 0.1, dps: 7 },
    { wait: 20, close: 20, frac: 0, dps: 12 },
  ],
};

export const RARITIES = [
  { id: "common",    name: "Common",    color: 0xb9bec6, css: "#b9bec6", attachments: 0, weight: 50 },
  { id: "uncommon",  name: "Uncommon",  color: 0x5fd35a, css: "#5fd35a", attachments: 1, weight: 30 },
  { id: "rare",      name: "Rare",      color: 0x3f8cff, css: "#3f8cff", attachments: 2, weight: 14 },
  { id: "epic",      name: "Epic",      color: 0xb55cff, css: "#b55cff", attachments: 3, weight: 5 },
  { id: "legendary", name: "Legendary", color: 0xffc23a, css: "#ffc23a", attachments: 4, weight: 1 },
];

// What a floor spot holds. Guns are the point; the rest keeps you alive.
const KIND_WEIGHTS = [["gun", 46], ["ammo", 22], ["plate", 20], ["heal", 12]];

export const ITEM_NAMES = { plate: "Cope Plate", heal: "Hopium", ammo: "Ammo box" };

/* Materials are freed a few seconds late: a shader warm-up (renderer
   .compileAsync) still polling one that was disposed under it throws. */
function disposeLater(...things) {
  setTimeout(() => { for (const t of things) t?.dispose?.(); }, 5000);
}

/* ---- seeded randomness --------------------------------------------------- */

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/* mulberry32: small, fast, and the same on every browser. */
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, list, weightOf) {
  let total = 0;
  for (const x of list) total += weightOf(x);
  let r = rng() * total;
  for (const x of list) { r -= weightOf(x); if (r <= 0) return x; }
  return list[list.length - 1];
}

/* ---- the zone ------------------------------------------------------------ */

/* The whole zone for a match, decided up front: circle 0 covers the map,
   each next circle sits wholly inside the one before. `state(t)` answers
   for any moment of the match, so a client that joins late, or a frame that
   hitches, still agrees with everyone else. */
export class RoyaleZone {
  constructor(bounds, rng, phases = ROYALE.phases) {
    this.phases = phases;
    const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
    const r0 = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 2;
    // Circles shrink against the map's own size, not the corner-to-corner
    // cover circle, so phase 1 already bites into the edges.
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2;
    this.circles = [{ x: cx, z: cz, r: r0 }];
    for (const ph of phases) {
      const prev = this.circles[this.circles.length - 1];
      const r = Math.min(prev.r, ph.frac * span);
      // Somewhere inside the last circle, and not hanging far off the map.
      const room = Math.max(0, Math.min(prev.r, span) - r);
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * room * 0.85;
      let x = prev.x + Math.cos(a) * d, z = prev.z + Math.sin(a) * d;
      x = THREE.MathUtils.clamp(x, bounds.minX + r * 0.5, bounds.maxX - r * 0.5);
      z = THREE.MathUtils.clamp(z, bounds.minZ + r * 0.5, bounds.maxZ - r * 0.5);
      this.circles.push({ x, z, r });
    }
    this.length = phases.reduce((s, p) => s + p.wait + p.close, 0);
  }

  /* `t`: seconds since the match went live. */
  state(t) {
    let t0 = 0;
    for (let i = 0; i < this.phases.length; i++) {
      const ph = this.phases[i], a = this.circles[i], b = this.circles[i + 1];
      if (t < t0 + ph.wait) {
        return { phase: i + 1, stage: "wait", x: a.x, z: a.z, r: a.r, next: b, left: t0 + ph.wait - t, dps: i === 0 ? 0 : this.phases[i - 1].dps };
      }
      if (t < t0 + ph.wait + ph.close) {
        const k = (t - t0 - ph.wait) / ph.close;
        return { phase: i + 1, stage: "closing", x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, r: a.r + (b.r - a.r) * k,
          next: b, left: t0 + ph.wait + ph.close - t, dps: ph.dps };
      }
      t0 += ph.wait + ph.close;
    }
    const last = this.circles[this.circles.length - 1];
    return { phase: this.phases.length, stage: "final", x: last.x, z: last.z, r: last.r, next: null, left: 0, dps: this.phases[this.phases.length - 1].dps * 1.5 };
  }

  static outside(s, x, z) { return Math.hypot(x - s.x, z - s.z) > s.r; }
}

/* The wall (a tall glowing cylinder you can see across the map) and the
   next circle marked on the ground. No lights: see light-pool.js. */
const CRINGE = new THREE.Color(0x7dff4a);
export class ZoneVisual {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    const wallGeo = new THREE.CylinderGeometry(1, 1, 60, 96, 1, true);
    wallGeo.translate(0, 26, 0);
    this.wallMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: { value: 0 }, uColor: { value: CRINGE.clone() }, uAlpha: { value: 1 } },
      vertexShader: `varying vec2 vUv; varying float vY;
        void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; varying float vY;
        void main() {
          float band = 0.5 + 0.5 * sin(vUv.x * 380.0 + vY * 0.9 - uTime * 2.2);
          float fade = smoothstep(58.0, 6.0, vY) * smoothstep(-5.0, 1.0, vY);
          float base = mix(0.16, 0.34, band);
          float foot = smoothstep(4.0, 0.0, vY) * 0.35;
          gl_FragColor = vec4(uColor * (0.9 + band * 0.3), (base * fade + foot) * uAlpha);
        }`,
    });
    this.wall = new THREE.Mesh(wallGeo, this.wallMat);
    this.wall.frustumCulled = false;
    this.wall.renderOrder = 8;
    this.next = new THREE.Mesh(
      new THREE.RingGeometry(0.985, 1, 128, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    this.next.rotation.x = -Math.PI / 2;
    this.next.position.y = 0.06;
    this.next.renderOrder = 7;
    this.group.add(this.wall, this.next);
    scene.add(this.group);
  }

  update(s, time) {
    this.wallMat.uniforms.uTime.value = time;
    this.wall.position.set(s.x, 0, s.z);
    this.wall.scale.set(Math.max(0.5, s.r), 1, Math.max(0.5, s.r));
    this.wall.visible = s.r > 0.3;
    const n = s.next;
    this.next.visible = !!n && n.r > 0.3;
    if (n) {
      this.next.position.set(n.x, 0.06, n.z);
      // A ring that stays about 0.5 m thick at any size.
      this.next.scale.set(n.r, n.r, 1);
    }
  }

  dispose() {
    this.scene.remove(this.group);
    disposeLater(this.wall.geometry, this.wallMat, this.next.geometry, this.next.material);
  }
}

/* ---- loot ---------------------------------------------------------------- */

/* A gun def at a rarity: that many random attachments, never two in one
   slot. Snipers always keep glass. */
export function rollGun(rng, rarityIdx, weaponId = null) {
  const ids = Object.keys(WEAPON_DEFS).filter((id) => !WEAPON_DEFS[id].hidden);
  const id = weaponId || ids[Math.floor(rng() * ids.length)];
  const att = { ...defaultLoadoutFor(id) };
  if (WEAPON_DEFS[id].cls === "sniper") att.optic = "scope8";
  const slots = [...SLOTS];
  const want = RARITIES[rarityIdx].attachments;
  for (let n = 0; n < want && slots.length; n++) {
    const slot = slots.splice(Math.floor(rng() * slots.length), 1)[0];
    const choices = Object.keys(ATTACHMENTS[slot]).filter((c) => c !== att[slot] && c !== "none" && c !== "standard" && c !== "iron");
    if (slot === "optic" && WEAPON_DEFS[id].cls === "sniper") continue;
    if (choices.length) att[slot] = choices[Math.floor(rng() * choices.length)];
  }
  return { id, att };
}

/* A floor item, before it has a mesh. */
function rollItem(rng) {
  const kind = pickWeighted(rng, KIND_WEIGHTS, (k) => k[1])[0];
  if (kind !== "gun") return { k: kind, n: 1 };
  const r = RARITIES.indexOf(pickWeighted(rng, RARITIES, (x) => x.weight));
  const { id, att } = rollGun(rng, r);
  return { k: "gun", w: id, a: att, r };
}

/* Where floor loot goes: open ground-floor cells of the bots' nav grid (so
   every item can be walked to), thinned to ROYALE.lootSpacing apart. */
export function lootSpots(colliders, bounds, rng) {
  const field = new FlowField(colliders, bounds, 0, { step: 0.6 });
  const open = [];
  for (let iz = 1; iz < field.h - 1; iz++) {
    for (let ix = 1; ix < field.w - 1; ix++) {
      if (!field.blocked[iz * field.w + ix]) open.push([ix, iz]);
    }
  }
  const area = (bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ);
  const want = Math.round(area * ROYALE.lootPerSqM);
  const out = [];
  const minD2 = ROYALE.lootSpacing * ROYALE.lootSpacing;
  for (let tries = 0; tries < want * 30 && out.length < want && open.length; tries++) {
    const [ix, iz] = open[Math.floor(rng() * open.length)];
    const x = field.minX + (ix + 0.5) * field.cell, z = field.minZ + (iz + 0.5) * field.cell;
    if (out.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < minD2)) continue;
    out.push({ x, z });
  }
  return out;
}

const _beamTex = (() => {
  const c = document.createElement("canvas");
  c.width = 16; c.height = 128;
  const g = c.getContext("2d");
  // Bright at the foot, gone at the top, and soft across its width, so it
  // reads as light rather than a stick.
  const img = g.createImageData(16, 128);
  for (let y = 0; y < 128; y++) {
    const up = Math.pow(y / 127, 1.6);
    for (let x = 0; x < 16; x++) {
      const across = Math.exp(-(((x + 0.5) / 16 - 0.5) ** 2) / 0.018);
      const a = Math.round(255 * up * across);
      const i = (y * 16 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  return t;
})();

const _itemGeo = {
  plate: new THREE.BoxGeometry(0.34, 0.05, 0.44),
  heal: new THREE.CylinderGeometry(0.08, 0.08, 0.3, 14),
  ammo: new THREE.BoxGeometry(0.36, 0.2, 0.22),
  ring: new THREE.RingGeometry(0.34, 0.42, 32),
};
const _itemMat = {
  plate: new THREE.MeshStandardMaterial({ color: 0x5b7fa6, roughness: 0.45, metalness: 0.2, emissive: 0x16304f, emissiveIntensity: 0.6 }),
  heal: new THREE.MeshStandardMaterial({ color: 0x55ff7a, roughness: 0.3, emissive: 0x1d8a33, emissiveIntensity: 0.9 }),
  ammo: new THREE.MeshStandardMaterial({ color: 0x6b6a3a, roughness: 0.8 }),
};
for (const g of Object.values(_itemGeo)) g.userData.shared = true;

/* Everything lying on the ground in a Royale match, keyed by id: "s<n>" for
   the seeded floor loot, "<netId>.<n>" for whatever someone dropped. */
export class LootField {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map();
    this.dropSeq = 0;
    this.time = 0;
  }

  clear() {
    for (const it of this.items.values()) this.removeMeshes(it);
    this.items.clear();
    this.dropSeq = 0;
  }

  spawnSeeded(spots, rng, groundAt) {
    spots.forEach((p, i) => {
      this.add({ id: `s${i}`, ...rollItem(rng), x: p.x, y: groundAt(p.x, p.z), z: p.z });
    });
  }

  nextDropId(ownerId) { return `${ownerId}.${++this.dropSeq}`; }

  /* `m`: the wire form, { id, k, x, y, z, w?, a?, r?, n?, ammo? }. */
  add(m) {
    if (this.items.has(m.id)) return this.items.get(m.id);
    const it = { ...m, t: Math.random() * 6, mesh: null, gun: null, def: null };
    if (it.k === "gun") it.def = resolveWeapon(it.w, it.a || defaultLoadoutFor(it.w));
    const group = new THREE.Group();
    group.position.set(it.x, (it.y || 0), it.z);
    const color = it.k === "gun" ? RARITIES[it.r | 0].color
      : it.k === "plate" ? 0x7fb2ff : it.k === "heal" ? 0x55ff7a : 0xd9d27a;
    // A beam you can spot from across the map, and a ring on the floor.
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.5, it.k === "gun" ? 2.6 + (it.r | 0) * 0.5 : 1.4),
      new THREE.MeshBasicMaterial({ map: _beamTex, color, transparent: true, opacity: it.k === "gun" ? 0.5 : 0.32,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = beam.geometry.parameters.height / 2;
    beam.userData.billboard = true;
    const ring = new THREE.Mesh(_itemGeo.ring, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    group.add(beam, ring);
    if (it.k !== "gun") {
      const body = new THREE.Mesh(_itemGeo[it.k], _itemMat[it.k]);
      body.position.y = it.k === "plate" ? 0.2 : 0.22;
      if (it.k === "heal") body.rotation.z = 0.2;
      group.add(body);
      it.body = body;
    }
    it.beam = beam;
    it.ring = ring;
    it.mesh = group;
    this.scene.add(group);
    this.items.set(it.id, it);
    return it;
  }

  take(id) {
    const it = this.items.get(id);
    if (!it) return null;
    this.removeMeshes(it);
    this.items.delete(id);
    return it;
  }

  removeMeshes(it) {
    if (!it.mesh) return;
    this.scene.remove(it.mesh);
    disposeLater(it.beam.geometry, it.beam.material, it.ring.material);
    if (it.gun) this.disposeGun(it);
    it.mesh = null;
  }

  disposeGun(it) {
    it.mesh.remove(it.gun);
    it.gun.traverse((o) => { if (o.isMesh && !o.geometry?.userData.shared) o.geometry?.dispose(); });
    it.gun = null;
  }

  /* Bob and spin; a gun's real model only while it's close (60 guns' worth of
     meshes on the map at once costs more draws than a whole map does). */
  update(dt, camera, viewer) {
    this.time += dt;
    const near2 = ROYALE.gunDetail * ROYALE.gunDetail, far2 = (ROYALE.gunDetail + 8) ** 2;
    for (const it of this.items.values()) {
      it.t += dt;
      const d2 = (it.x - viewer.x) ** 2 + (it.z - viewer.z) ** 2;
      if (it.k === "gun") {
        if (!it.gun && d2 < near2) {
          it.gun = stripLights(buildWeaponMesh(it.def));
          it.gun.traverse((o) => { if (o.isMesh) o.castShadow = false; });
          it.gun.rotation.set(0, 0, Math.PI / 2 + 0.15);
          it.mesh.add(it.gun);
        } else if (it.gun && d2 > far2) this.disposeGun(it);
        if (it.gun) {
          it.gun.position.y = 0.34 + Math.sin(it.t * 2.2) * 0.04;
          it.gun.rotation.y = it.t * 0.8;
        }
      } else if (it.body) {
        it.body.rotation.y = it.t * 1.1;
        it.body.position.y = 0.22 + Math.sin(it.t * 2.4) * 0.03;
      }
      // Beams face the camera around their own upright axis.
      it.beam.rotation.y = Math.atan2(camera.position.x - it.x, camera.position.z - it.z);
      it.beam.material.opacity = (it.k === "gun" ? 0.42 : 0.26) + Math.sin(it.t * 3) * 0.06;
    }
  }

  /* Nearest item within `radius` of (x, z) that `ok(item)` accepts. */
  nearest(x, z, radius, ok = null) {
    let best = null, bestD = radius;
    for (const it of this.items.values()) {
      const d = Math.hypot(it.x - x, it.z - z);
      if (d < bestD && (!ok || ok(it))) { best = it; bestD = d; }
    }
    return best;
  }

  /* The wire form of an item (for "add"). */
  static wire(it) {
    const m = { id: it.id, k: it.k, x: +it.x.toFixed(2), y: +(it.y || 0).toFixed(2), z: +it.z.toFixed(2) };
    if (it.k === "gun") { m.w = it.w; m.a = it.a; m.r = it.r | 0; if (it.ammo != null) m.ammo = it.ammo; }
    if (it.n) m.n = it.n;
    return m;
  }
}

/* A gun lying on the ground stands for its whole kit: `a` (attachments) and
   `r` (rarity). A picked-up gun keeps both when it's dropped again. */
export function gunDisplayName(it) {
  return `${RARITIES[it.r | 0].name} ${WEAPON_DEFS[it.w]?.name || it.w}`;
}
