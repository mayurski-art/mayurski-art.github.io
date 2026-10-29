// Troll Royale chests (the island redesign, phase 5): gold trollface chests
// at the places, each spilling better loot than the floor. Every client
// places the same chests and rolls the same contents from the match seed,
// so only "chest opened" travels ({ k: "chest", c }, on the loot channel);
// the three items it spills come out with known ids (`c<id>.<n>`), and
// picking them up is the usual "take".
//
// Finding one: it glows gold and hums, heard within CHEST_HEAR through
// walls; no light beam, so you have to look. Opening: hold X for
// CHEST_OPEN_TIME. An open chest stays where it was, lid up, dark.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { hashSeed, seededRng, rollGun, RARITIES } from "./royale-zone.js?v=p5-wst-bs1-sb2-fu1b7d-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-pi1-fl1-or1-rt1-ut1-gf1-tg1-rb4-hp1-bx1-mg1-sp1-zw1-tfb8-rfx1-rfx2-lz1-ret1-ret2-mrg1-hd1-mrc1-hgb8-tw1-rt2-fd1-ars1";
import { FlowField } from "../bots/nav.js?v=ti1-bs1b7d-fl1-or1-gf1-tg1-tfb8";

export const CHEST_OPEN_TIME = 1;     // seconds of holding X
export const CHEST_REACH = 1.8;       // metres: close enough to open
export const CHEST_HEAR = 15;         // metres: the hum carries this far
const CHEST_DRAW = 110;               // metres: not drawn past this
const SPACING = 6;                    // metres between chest spots
// Spots per place by tier (about 120 on the island); a match uses half of
// each place's, so hot places always have some and nobody learns them all.
const PER_TIER = { hot: 14, mid: 8, minor: 3 };

/* Every chest spot the map has: open ground cells at its places, against a
   wall or cover where there is one (indoors, behind things), SPACING apart.
   The same list every match (seeded from the map, not the match), facing
   away from the wall it's against. A map can bring its own (`chestSpots`,
   from Studio later). */
export function chestSpots(colliders, bounds, pois, { ok = null } = {}) {
  const field = new FlowField(colliders, bounds, 0, { step: 0.34, pad: 0.7 });
  const rng = seededRng(hashSeed(`chests:${pois.length}:${Math.round(bounds.minX)}:${Math.round(bounds.maxZ)}`));
  const cellAt = (ix, iz) => ix < 0 || iz < 0 || ix >= field.w || iz >= field.h || field.blocked[iz * field.w + ix];
  const out = [];
  for (const [pi, p] of pois.entries()) {
    const want = PER_TIER[p.tier] || 0;
    if (!want) continue;
    const walled = [], open = [];
    const r = p.r + 2, c = field.cell;
    for (let iz = Math.floor((p.z - r - field.minZ) / c); iz <= Math.floor((p.z + r - field.minZ) / c); iz++) {
      for (let ix = Math.floor((p.x - r - field.minX) / c); ix <= Math.floor((p.x + r - field.minX) / c); ix++) {
        if (cellAt(ix, iz)) continue;
        const x = field.minX + (ix + 0.5) * c, z = field.minZ + (iz + 0.5) * c;
        if (Math.hypot(x - p.x, z - p.z) > r || (ok && !ok(x, z))) continue;
        // The wall it's against: the blocked neighbour (its back goes there).
        let wx = 0, wz = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (cellAt(ix + dx, iz + dz)) { wx += dx; wz += dz; }
        const spot = { x, z, poi: pi, yaw: wx || wz ? Math.atan2(-wx, -wz) : rng() * Math.PI * 2 };
        (wx || wz ? walled : open).push(spot);
      }
    }
    // Against something first, then the open; shuffled, kept SPACING apart.
    let got = 0;
    for (const list of [walled, open]) {
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      for (const s of list) {
        if (got >= want) break;
        if (out.some((o) => (o.x - s.x) ** 2 + (o.z - s.z) ** 2 < SPACING * SPACING)) continue;
        out.push(s);
        got++;
      }
    }
  }
  return out;
}

/* What a chest holds, the same on every client: a gun a rarity up on the
   floor's (two at a hot place, half the time), ammo, and a heal or plates. */
export function chestContents(seed, id, hot) {
  const rng = seededRng(hashSeed(`${seed}:chest:${id}`));
  let total = 0;
  for (const r of RARITIES) total += r.weight;
  let roll = rng() * total, r = 0;
  while (r < RARITIES.length - 1 && (roll -= RARITIES[r].weight) > 0) r++;
  r = Math.min(RARITIES.length - 1, r + 1 + (hot && rng() < 0.5 ? 1 : 0));
  const { id: w, att } = rollGun(rng, r);
  return [{ k: "gun", w, a: att, r }, { k: "ammo", n: 1 }, rng() < 0.5 ? { k: "heal", n: 1 } : { k: "plate", n: 1 }];
}

// ---- The look: a gold chest with the trollface on its front and a glow on
// the floor. Three instanced draws for every chest on the island.

const GOLD = new THREE.Color(0xe8b23a), BAND = new THREE.Color(0x5a3a14);
function coloured(geo, col) {
  const n = geo.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return geo;
}
// The body: a box with two dark bands round it, its front (+z) plate for the face.
const _bodyGeo = mergeGeometries([
  coloured(new THREE.BoxGeometry(0.9, 0.46, 0.56).translate(0, 0.23, 0), GOLD),
  coloured(new THREE.BoxGeometry(0.08, 0.47, 0.57).translate(-0.3, 0.23, 0), BAND),
  coloured(new THREE.BoxGeometry(0.08, 0.47, 0.57).translate(0.3, 0.23, 0), BAND),
  coloured(new THREE.BoxGeometry(0.2, 0.2, 0.02).translate(0, 0.32, 0.285), BAND),
]);
// The lid: a half round, hinged at the back edge (its origin), so opening it
// is one turn about x.
const _lidGeo = mergeGeometries([
  coloured(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(0, 0, 0.28), GOLD),
  coloured(new THREE.CylinderGeometry(0.29, 0.29, 0.08, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(-0.3, 0, 0.28), BAND),
  coloured(new THREE.CylinderGeometry(0.29, 0.29, 0.08, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(0.3, 0, 0.28), BAND),
]);
const _chestMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.75, roughness: 0.32, emissive: 0x6a4400, emissiveIntensity: 0.5 });
// The trollface plate on the front, and the gold glow on the floor.
const _faceGeo = new THREE.PlaneGeometry(0.34, 0.3).translate(0, 0.25, 0.282);
const _faceTex = new THREE.TextureLoader().load(new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href);
_faceTex.colorSpace = THREE.SRGBColorSpace;
const _faceMat = new THREE.MeshBasicMaterial({ map: _faceTex, color: 0xffe9a8, alphaTest: 0.4, side: THREE.DoubleSide });
const _glowGeo = new THREE.CircleGeometry(1.2, 24).rotateX(-Math.PI / 2).translate(0, 0.04, 0);
const _glowTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d"), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const _glowMat = new THREE.MeshBasicMaterial({ map: _glowTex, color: 0xffb020, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const _m = new THREE.Matrix4(), _lid = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _yAxis = new THREE.Vector3(0, 1, 0), _xAxis = new THREE.Vector3(1, 0, 0), _qx = new THREE.Quaternion();
const _c = new THREE.Color(), _ml = new THREE.Matrix4();

export class ChestField {
  /* `spots`: chestSpots() for this match; `pois` for which ones are hot. */
  constructor(scene, seed, spots, pois, groundAt) {
    this.scene = scene;
    this.seed = seed;
    this.chests = spots.map((s, i) => ({
      id: i, x: s.x, z: s.z, y: s.y ?? groundAt(s.x, s.z), yaw: s.yaw || 0,
      hot: pois?.[s.poi]?.tier === "hot", open: false, lid: 0,
    }));
    this.byId = new Map(this.chests.map((c) => [c.id, c]));
    const n = Math.max(1, this.chests.length);
    this.body = new THREE.InstancedMesh(_bodyGeo, _chestMat, n);
    this.lids = new THREE.InstancedMesh(_lidGeo, _chestMat, n);
    this.faces = new THREE.InstancedMesh(_faceGeo, _faceMat, n);
    this.glow = new THREE.InstancedMesh(_glowGeo, _glowMat, n);
    this.glow.renderOrder = 2;
    for (const m of [this.body, this.lids, this.faces, this.glow]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
    }
    this.body.castShadow = this.lids.castShadow = true;
    this.glow.setColorAt(0, _c.set(0xffffff));
    this.t = 0;
  }

  /* A closed chest within `radius` of (x, z), nearest first. */
  nearest(x, z, radius) {
    let best = null, bestD = radius;
    for (const c of this.chests) {
      if (c.open) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  /* Open chest `id`, on our say or the wire's: the items it spills, in the
     loot field's wire form (ids `c<id>.<n>`), or null if it was already open
     (someone beat us to it). */
  open(id) {
    const c = this.byId.get(id | 0);
    if (!c || c.open) return null;
    c.open = true;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), sx = Math.cos(c.yaw), sz = -Math.sin(c.yaw);
    return chestContents(this.seed, c.id, c.hot).map((it, n) => {
      const side = (n - 1) * 0.7, fwd = 0.95 + (n === 1 ? 0.25 : 0);
      return { id: `c${c.id}.${n}`, ...it, x: c.x + fx * fwd + sx * side, y: c.y, z: c.z + fz * fwd + sz * side };
    });
  }

  /* Draw the chests near `eye`, the lids of the ones opening swinging up;
     the closed chest nearest `ear` hums (audio.chestHumAt) within CHEST_HEAR. */
  update(dt, eye, ear, audio) {
    this.t += dt;
    let n = 0, ng = 0, hum = null, humD = CHEST_HEAR;
    for (const c of this.chests) {
      if (c.open && c.lid < 1) c.lid = Math.min(1, c.lid + dt * 3);
      const d = Math.hypot(c.x - eye.x, c.z - eye.z);
      if (!c.open && ear) {
        const h = Math.hypot(c.x - ear.x, c.z - ear.z);
        if (h < humD) { hum = c; humD = h; }
      }
      if (d > CHEST_DRAW) continue;
      _q.setFromAxisAngle(_yAxis, c.yaw);
      _m.compose(_p.set(c.x, c.y, c.z), _q, _s);
      this.body.setMatrixAt(n, _m);
      this.faces.setMatrixAt(n, _m);
      // The lid hinges at the back top edge (z -0.28, y 0.46) and swings
      // back 110 degrees, with a little bounce at the top.
      const k = c.lid, open = k < 1 ? 1 - (1 - k) ** 3 : 1;
      _qx.setFromAxisAngle(_xAxis, -1.92 * open);
      _lid.compose(_p.set(0, 0.46, -0.28), _qx, _s);
      this.lids.setMatrixAt(n, _ml.multiplyMatrices(_m, _lid));
      n++;
      if (!c.open && d < 60) {
        _m.compose(_p.set(c.x, c.y, c.z), _q, _s.setScalar(0.9 + Math.sin(this.t * 2.2 + c.id) * 0.1));
        _s.set(1, 1, 1);
        this.glow.setMatrixAt(ng, _m);
        this.glow.setColorAt(ng++, _c.setScalar(0.55 + Math.sin(this.t * 2.2 + c.id) * 0.15));
      }
    }
    for (const [m, k] of [[this.body, n], [this.lids, n], [this.faces, n], [this.glow, ng]]) {
      m.count = k;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    audio?.chestHumAt?.(hum ? 1 - humD / CHEST_HEAR : -1, hum ? { x: hum.x, y: hum.y + 0.4, z: hum.z } : null);
  }

  dispose() {
    for (const m of [this.body, this.lids, this.faces, this.glow]) { this.scene.remove(m); m.dispose(); }
  }
}

