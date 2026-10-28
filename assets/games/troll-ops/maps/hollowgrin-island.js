// Troll Forces — Hollowgrin Island ("Troll Royale: Two Worlds"): Trollface
// Island's underside, a Halloween trollface pumpkin round the village, seen
// from the planes and the fall. Scenery only, for Troll Royale on Hollowgrin
// (hollowgrin.js royale.scenery): the fight stays inside Hollowgrin's
// invisible walls; nothing here is a collider.
//
// models/hg_island.py draws hg-island.glb (the dark land, the glowing orange
// rind and the cliff under it, the brew pools of the grin, eyes and nose, the
// stem) from models/hollowgrin-island.json, which this reads too. This adds
// the woods over the rest of the island (hg-woodkit.glb's pieces, instanced),
// takes the woods ring's trees off the cliff, out of the pools and away from
// the stem, cuts the ground plane back to the play area so the pools by the
// wall show, and lifts the ground haze as the camera climbs (it hides the
// land from the sky).

import * as THREE from "three";

const JSON_URL = new URL("../models/hollowgrin-island.json", import.meta.url).href;
const HAZE_FADE = [30, 110];   // camera height (m): the ground haze full below, gone above
const PLANE_PAD = 2;           // the ground plane's margin round the play area here
// the rind's ground (hg_island.py): Blender material -> [colour, warmth, its strength]
const RIND = { HG_IslandSand: [0xffa448, 0xff8a1c, 0.4], HG_IslandSoil: [0xd88a3a, 0xc06414, 0.25] };

function inside(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function distTo(poly, x, z) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i], ex = bx - ax, ez = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
    best = Math.min(best, Math.hypot(x - ax - ex * t, z - az - ez * t));
  }
  return best;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/* The map's ground plane (maps.js: bounds + 24 m, at the origin), cut back
   to the play area + PLANE_PAD; returns the undo. Its light map's UVs are
   world x/z over `bakeRect`, so they're projected again. */
function trimPlane(scene, B, bakeRect) {
  const w = B.maxX - B.minX + 24, d = B.maxZ - B.minZ + 24;
  let plane = null;
  scene.traverse((o) => {
    const p = o.isMesh && o.geometry.type === "PlaneGeometry" && o.geometry.parameters;
    if (p && !plane && p.width === w && p.height === d) plane = o;
  });
  if (!plane) return () => {};
  const old = plane.geometry;
  const nw = B.maxX - B.minX + 2 * PLANE_PAD, nd = B.maxZ - B.minZ + 2 * PLANE_PAD;
  const geo = new THREE.PlaneGeometry(nw, nd);
  // the plane lies at the origin, rotated flat (local y = -world z)
  geo.translate((B.minX + B.maxX) / 2, -(B.minZ + B.maxZ) / 2, 0);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * nw / w, 0.5 + (uv.getY(i) - 0.5) * nd / d);
  plane.geometry = geo;
  if (old.attributes.uv1 && bakeRect) {
    const [x0, z0, size] = bakeRect, pos = geo.attributes.position, v = new THREE.Vector3(), a = new Float32Array(pos.count * 2);
    plane.updateWorldMatrix(true, false);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(plane.matrixWorld);
      a[2 * i] = (v.x - x0) / size;
      a[2 * i + 1] = (v.z - z0) / size;
    }
    geo.setAttribute("uv1", new THREE.BufferAttribute(a, 2));
  }
  return () => { plane.geometry = old; geo.dispose(); };
}

/* Loads the island into `scene`; returns { dispose }. `load(name)` gives a
   model's root (hollowgrin.js: retextured, the night look on it), `bounds`
   the play area, `bakeRect` the ground bake's, `haze` the ground haze
   uniform (x its strength). */
export function islandScenery(scene, { load, bounds, bakeRect, haze }) {
  const group = new THREE.Group();
  group.name = "hg-island";
  scene.add(group);
  const hiddenRing = [];   // [InstancedMesh, index, matrix] the ring trees taken away
  const hazeK = haze.value.x;
  let gone = false, untrim = () => {};
  Promise.all([load("hg-island"), load("hg-woodkit"), fetch(JSON_URL).then((r) => r.json())]).then(([land, kit, S]) => {
    if (gone) return;
    untrim = trimPlane(scene, bounds, bakeRect);
    const pools = [S.mouth, ...S.eyes, S.nose];
    const root = [S.stem[0], S.stem[1] + 8];   // hg_island.py's stem root
    // the ground haze lifts as the camera climbs (one mesh's hook, every frame it's drawn)
    let hook = null;
    land.traverse((n) => {
      if (!n.isMesh || hook) return;
      hook = n;
      n.onBeforeRender = (renderer, sc, camera) => {
        const [a, b] = HAZE_FADE, k = Math.min(1, Math.max(0, (camera.position.y - a) / (b - a)));
        haze.value.x = hazeK * (1 - k * k * (3 - 2 * k));
      };
    });
    // the rind is pumpkin-orange ground: the retexture's sand and dirt keep
    // their grain but come back pale, so the hue goes back on, with a little
    // warmth of its own through the same grain to hold it under the moon
    land.traverse((n) => {
      const hue = n.isMesh && RIND[n.userData.blenderMat];
      if (!hue) return;
      const m = n.material;
      m.color.setHex(hue[0]);
      m.emissive.setHex(hue[1]);
      m.emissiveMap = m.map;
      m.emissiveIntensity = hue[2];
      m.needsUpdate = true;
    });
    group.add(land);
    // the woods ring's trees off the cliff, out of the brew, clear of the stem
    scene.traverse((o) => {
      const spots = o.isInstancedMesh && o.userData.woodsSpots;
      if (!spots) return;
      spots.forEach(([x, z], i) => {
        if (inside(S.coast, x, z) && distTo(S.coast, x, z) > 6 && !pools.some((p) => inside(p, x, z) || distTo(p, x, z) < 2)
          && Math.hypot(x - root[0], z - root[1]) > 11) return;
        const keep = new THREE.Matrix4();
        o.getMatrixAt(i, keep);
        hiddenRing.push([o, i, keep]);
        o.setMatrixAt(i, HIDDEN);
      });
      o.instanceMatrix.needsUpdate = true;
    });
    // the woods over the rest of the island: past the ring, clear of the
    // rind, the brew and the stem
    kit.updateMatrixWorld(true);
    const R = rng(1031);
    const B = bounds, ring = 24;
    const xs = S.coast.map((p) => p[0]), zs = S.coast.map((p) => p[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const spots = new Map();
    const ok = (x, z, r) => inside(S.coast, x, z) && distTo(S.coast, x, z) > 8 + r
      && !(x > B.minX - ring && x < B.maxX + ring && z > B.minZ - ring && z < B.maxZ + ring)
      && !pools.some((p) => inside(p, x, z) || distTo(p, x, z) < 2.5 + r)
      && Math.hypot(x - root[0], z - root[1]) > 13;
    const put = (name, n, r, s0, s1) => {
      for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
        const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0);
        if (!ok(x, z, r)) continue;
        if (!spots.has(name)) spots.set(name, []);
        spots.get(name).push([x, z, R() * 6.28, s0 + R() * (s1 - s0)]);
        i++;
      }
    };
    for (let k = 0; k < 4; k++) put(`tree${k}`, 160, 1, 0.85, 1.3);
    for (let k = 0; k < 2; k++) put(`pine${k}`, 320, 1.5, 0.8, 1.35);
    for (let k = 0; k < 2; k++) put(`bramble${k}`, 80, 0.8, 0.8, 1.4);
    for (let k = 0; k < 2; k++) put(`stump${k}`, 30, 0.6, 0.9, 1.1);
    for (let k = 0; k < 2; k++) put(`log${k}`, 20, 2.4, 0.9, 1.1);
    put("toad0", 50, 0.6, 0.8, 1.4);
    for (const [name, list] of spots) {
      kit.getObjectByName(name)?.traverse((m) => {
        if (!m.isMesh) return;
        const inst = new THREE.InstancedMesh(m.geometry, m.material, list.length);
        list.forEach(([x, z, ry, sc], i) => {
          _e.set(0, ry, 0);
          _q.setFromEuler(_e);
          _m.compose(_p.set(x, -0.04, z), _q, _s.set(sc, sc * (0.9 + (i % 3) * 0.1), sc)).multiply(m.matrixWorld);
          inst.setMatrixAt(i, _m);
        });
        inst.computeBoundingSphere();
        inst.castShadow = false;
        inst.receiveShadow = true;
        group.add(inst);
      });
    }
  });
  return {
    group,
    dispose() {
      gone = true;
      for (const [o, i, keep] of hiddenRing) { o.setMatrixAt(i, keep); o.instanceMatrix.needsUpdate = true; }
      hiddenRing.length = 0;
      untrim();
      haze.value.x = hazeK;
      scene.remove(group);
    },
  };
}
