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
import { lakeWaterMaterial } from "./lake-water.js?v=wf2";

const JSON_URL = new URL("../models/hollowgrin-island.json", import.meta.url).href;
const HAZE_FADE = [30, 110];   // camera height (m): the ground haze full below, gone above
const PLANE_PAD = 2;           // the ground plane's margin round the play area here
// the rind's ground (hg_island.py): Blender material -> [colour, warmth, its strength]
// (the warmth low: at 0.4 the beach glowed like a neon line, user 2026-10-28)
const RIND = { HG_IslandSand: [0xf5b85e, 0xd88a2a, 0.2], HG_IslandSoil: [0xb8844a, 0x8a5418, 0.1] };
// the pools' water (lake-water.js colours) and the low glow of the brew in it:
// dark as night water is, the green in its shallows and froth
const BREW = { shallow: 0x23401a, deep: 0x050c06, sand: 0x141a0e, foam: 0x8fb86a, glow: 0x1c6a12, glowK: 0.1, bed: 0x080c06 };
const MOON = [-30, 40, -60];   // hollowgrin.js HOLLOWGRIN.sun.pos: the full moon the brew shows
const PATH_W = 4;              // a trodden path's width (m)

/* What the island's ground shaders share (user, 2026-10-28: the brew "still
   looks fake", the rind "looks flat", the land "too dark / bare"): a mask
   over the island, 1 m a texel (r: the paths, g: the clearings, b: how far
   in from the coast, 1 past 24 m), the time, the night sky the brew shows. */
const U = {
  uHgiMask: { value: null },
  uHgiBox: { value: new THREE.Vector4() },
  uHgiTime: { value: 0 },
  uHgiMoon: { value: new THREE.Vector3(...MOON).normalize() },
  uHgiMoonCol: { value: new THREE.Color(0xdfe6ff) },
  uHgiHorizon: { value: new THREE.Color(0x2a1838) },
  uHgiZenith: { value: new THREE.Color(0x05060f) },
  uHgiSwirl: { value: new THREE.Color(0x2fbf2a).multiplyScalar(0.22) },
};
const GLSL_COMMON = `
  varying vec3 vHgiP;
  uniform sampler2D uHgiMask;
  uniform vec4 uHgiBox;
  uniform float uHgiTime;
  uniform vec3 uHgiMoon, uHgiMoonCol, uHgiHorizon, uHgiZenith, uHgiSwirl;
  float hgiH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hgiN(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hgiH(i), hgiH(i + vec2(1, 0)), f.x), mix(hgiH(i + vec2(0, 1)), hgiH(i + vec2(1, 1)), f.x), f.y);
  }
  float hgiF(vec2 p) { return 0.5 * hgiN(p) + 0.25 * hgiN(p * 2.03 + 1.7) + 0.125 * hgiN(p * 4.01 + 3.1) + 0.0625 * hgiN(p * 8.1 + 5.3); }
  vec4 hgiMask() { return texture2D(uHgiMask, (vHgiP.xz - uHgiBox.xy) / uHgiBox.zw); }
  vec3 hgiLin(vec3 c) { return pow(c, vec3(2.2)); }`;
const VERT_POS = `#include <project_vertex>
  { vec4 hgiW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    hgiW = instanceMatrix * hgiW;
  #endif
    vHgiP = (modelMatrix * hgiW).xyz; }`;

/* Adds to a material's shader once (on top of the night look's own patch,
   hollowgrin.js nightFx): `frag` maps shader chunks to code put after them. */
function patch(mat, key, frag) {
  if (!mat || mat.userData.hgi) return;
  mat.userData.hgi = key;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = function (sh, r) {
    prev?.call(this, sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHgiP;")
      .replace("#include <project_vertex>", VERT_POS);
    let fs = sh.fragmentShader.replace("#include <common>", `#include <common>\n${GLSL_COMMON}`);
    for (const [chunk, code] of Object.entries(frag)) fs = fs.replace(`#include <${chunk}>`, `#include <${chunk}>\n${code}`);
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `${prevKey}|hgi-${key}`;
  mat.needsUpdate = true;
}

// the land: moss, dead grass and mud in patches, dry clearings, trodden
// paths, going sandy toward the beach; the texture's grain kept through it
const LAND_FRAG = {
  color_fragment: `{
    vec4 mk = hgiMask(); vec2 p = vHgiP.xz;
    vec3 grain = diffuseColor.rgb / max(diffuse, vec3(1e-4));
    float d = clamp(dot(grain, vec3(0.3, 0.59, 0.11)) * 1.8, 0.0, 1.0);
    vec3 c = mix(vec3(0.22, 0.29, 0.15), vec3(0.42, 0.38, 0.23), smoothstep(0.32, 0.72, hgiF(p * 0.03)));
    c = mix(c, vec3(0.33, 0.25, 0.17), smoothstep(0.58, 0.85, hgiF(p * 0.11 + 5.0)) * 0.65);
    c = mix(c, vec3(0.5, 0.45, 0.27), mk.g * 0.9);
    c = mix(c, vec3(0.48, 0.37, 0.24), smoothstep(0.12, 0.6, mk.r));
    c = mix(vec3(0.62, 0.42, 0.22), c, smoothstep(0.08, 0.55, mk.b));
    diffuseColor.rgb = hgiLin(c) * mix(0.7, 1.25, d) * mix(0.88, 1.08, hgiN(p * 1.4));
  }`,
};
// the beach: grain and broad patches, damp and darker where it meets the land
const SAND_FRAG = {
  color_fragment: `
    vec4 hgiMk = hgiMask();
    float hgiWet = smoothstep(0.12, 0.42, hgiMk.b);
    float hgiPatch = hgiF(vHgiP.xz * 0.07);
    diffuseColor.rgb *= mix(0.62, 1.15, hgiPatch) * mix(vec3(1.0, 0.86, 0.72), vec3(1.0, 1.04, 1.08), hgiF(vHgiP.xz * 0.025 + 9.0)) * mix(0.8, 1.1, hgiN(vHgiP.xz * 2.3))
      * mix(vec3(1.0), vec3(0.5, 0.4, 0.33), hgiWet);`,
  emissivemap_fragment: "totalEmissiveRadiance *= 1.0 - hgiWet * 0.75;",
};
// the soil down the cliff top: strata, not one flat band
const SOIL_FRAG = {
  color_fragment: "diffuseColor.rgb *= mix(0.68, 1.1, hgiN(vec2((vHgiP.x + vHgiP.z) * 0.09, vHgiP.y * 1.4))) * mix(0.85, 1.05, hgiN(vHgiP.xz * 0.6));",
};
// the brew: the night sky and the moon in it on broad ripples that read from
// the plane, slow green swirls in the deep (lake-water.js's own shader under it)
const BREW_FRAG = {
  emissivemap_fragment: `{
    float t = uTime; vec2 p = vLakePos.xz;
    vec2 sl = lakeSlope(p * 0.35, t * 0.6) * 0.5;
    vec3 n = normalize(vec3(-sl.x, 1.0, -sl.y));
    vec3 V = normalize(cameraPosition - vLakePos);
    float fr = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
    vec3 R = reflect(-V, n);
    vec3 sky = mix(uHgiHorizon, uHgiZenith, smoothstep(0.0, 0.6, R.y));
    float glint = pow(max(dot(R, uHgiMoon), 0.0), 260.0) * 3.0;
    float deep = smoothstep(1.5, 12.0, lakeD);
    float swirl = smoothstep(0.55, 0.8, hgiF(p * 0.09 + vec2(t * 0.035, -t * 0.025))) * deep;
    totalEmissiveRadiance += (sky * fr * 0.9 + uHgiMoonCol * glint) * (1.0 - lakeFoam) + uHgiSwirl * swirl;
  }`,
};
// mist lying in the pools, under the banks' tops, drifting
const MIST_FRAG = {
  color_fragment: "diffuseColor.a *= smoothstep(0.38, 0.78, hgiF(vHgiP.xz * 0.06 + uHgiTime * vec2(0.02, 0.013)));",
};

/* The paths (from the village's sides out to the eyes, the nose, the grin,
   the stem and the beach) and the clearings, seeded; map metres. */
function groundLayout(S, B) {
  const R = rng(4421);
  const pools = [S.mouth, ...S.eyes, S.nose];
  const cx = (B.minX + B.maxX) / 2, cz = (B.minZ + B.maxZ) / 2;
  const gates = [[cx, B.minZ], [cx, B.maxZ], [B.minX, cz], [B.maxX, cz]];
  const nearest = (poly, x, z) => {
    let best = null, bd = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, az] = poly[j], [bx, bz] = poly[i], ex = bx - ax, ez = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
      const px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz);
      if (d < bd) { bd = d; best = [px, pz]; }
    }
    return best;
  };
  const centre = (poly) => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
  const gateFor = (e) => gates.reduce((a, g) => (Math.hypot(g[0] - e[0], g[1] - e[1]) < Math.hypot(a[0] - e[0], a[1] - e[1]) ? g : a));
  // each path's far end: a pool's bank (the eyes, the nose, three spots
  // along the grin's top), the stem's foot, the beach (west, east, south-west, south-east)
  const ends = [];
  for (const p of [...S.eyes, S.nose]) { const g = gateFor(centre(p)); ends.push([g, nearest(p, g[0], g[1])]); }
  const [m0, m1] = [Math.min(...S.mouth.map((p) => p[0])), Math.max(...S.mouth.map((p) => p[0]))];
  for (const k of [0.25, 0.5, 0.75]) { const top = nearest(S.mouth, m0 + (m1 - m0) * k, cz); ends.push([gateFor(top), top]); }
  const stem = clampIn(S.coast, [S.stem[0], S.stem[1] + 14], [cx, cz]);
  ends.push([gateFor(stem), stem]);
  for (const [dx, dz] of [[-1, 0], [1, 0], [-0.7, 0.7], [0.7, 0.7]]) { const b = clampIn(S.coast, [cx + dx * 400, cz + dz * 400], [cx, cz]); ends.push([gateFor(b), b]); }
  const paths = ends.map(([gate, to]) => {
    const len = Math.hypot(to[0] - gate[0], to[1] - gate[1]), n = Math.max(2, Math.round(len / 10));
    const nx = -(to[1] - gate[1]) / len, nz = (to[0] - gate[0]) / len;
    const pts = [];
    let off = 0;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      off = i === 0 || i === n ? 0 : off * 0.6 + (R() - 0.5) * 7;
      pts.push([gate[0] + (to[0] - gate[0]) * k + nx * off, gate[1] + (to[1] - gate[1]) * k + nz * off]);
    }
    return pts;
  });
  const clearings = [];
  const xs = S.coast.map((p) => p[0]), zs = S.coast.map((p) => p[1]);
  for (let tries = 0; clearings.length < 24 && tries < 900; tries++) {
    const x = Math.min(...xs) + R() * (Math.max(...xs) - Math.min(...xs)), z = Math.min(...zs) + R() * (Math.max(...zs) - Math.min(...zs)), r = 9 + R() * 11;
    if (!inside(S.coast, x, z) || distTo(S.coast, x, z) < r + 14) continue;
    if (x > B.minX - 30 && x < B.maxX + 30 && z > B.minZ - 30 && z < B.maxZ + 30) continue;
    if (pools.some((p) => inside(p, x, z) || distTo(p, x, z) < r + 4)) continue;
    if (clearings.some(([a, b, q]) => Math.hypot(a - x, b - z) < q + r + 10)) continue;
    clearings.push([x, z, r]);
  }
  return { paths, clearings };
}
/* The point where the line from `inner` out to `p` leaves the coast, a few metres in. */
function clampIn(coast, p, inner) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const k = (lo + hi) / 2, x = inner[0] + (p[0] - inner[0]) * k, z = inner[1] + (p[1] - inner[1]) * k;
    if (inside(coast, x, z) && distTo(coast, x, z) > 3) lo = k; else hi = k;
  }
  return [inner[0] + (p[0] - inner[0]) * lo, inner[1] + (p[1] - inner[1]) * lo];
}
function onPath(paths, x, z, pad) {
  return paths.some((pts) => distTo(pts, x, z) < PATH_W / 2 + pad);
}
/* The mask texture (see U), drawn once. */
function groundMask(S, { paths, clearings }) {
  const xs = S.coast.map((p) => p[0]), zs = S.coast.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - 4, z0 = Math.floor(Math.min(...zs)) - 4;
  const w = Math.ceil(Math.max(...xs)) + 4 - x0, h = Math.ceil(Math.max(...zs)) + 4 - z0;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  const trace = (pts, close) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(x - x0, z - z0) : g.moveTo(x - x0, z - z0))); if (close) g.closePath(); };
  g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
  // b: in from the coast, 0 at it, 1 by ~24 m
  g.fillStyle = "rgb(0,0,255)"; trace(S.coast, true); g.fill();
  g.lineJoin = g.lineCap = "round";
  for (const [lw, a] of [[48, 0.22], [36, 0.25], [24, 0.3], [12, 0.45], [4, 0.8]]) { g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = lw; trace(S.coast, true); g.stroke(); }
  // r and g added on top (lighter keeps the channels apart), soft-edged
  g.globalCompositeOperation = "lighter";
  for (const [lw, a] of [[PATH_W * 2.2, 0.25], [PATH_W * 1.5, 0.3], [PATH_W, 0.55]]) {
    g.strokeStyle = `rgba(255,0,0,${a})`; g.lineWidth = lw;
    for (const pts of paths) { trace(pts, false); g.stroke(); }
  }
  for (const [x, z, r] of clearings) {
    const grad = g.createRadialGradient(x - x0, z - z0, r * 0.4, x - x0, z - z0, r * 1.25);
    grad.addColorStop(0, "rgba(0,255,0,1)"); grad.addColorStop(1, "rgba(0,255,0,0)");
    g.fillStyle = grad; g.beginPath(); g.arc(x - x0, z - z0, r * 1.25, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false;
  tex.colorSpace = THREE.NoColorSpace;
  U.uHgiMask.value = tex;
  U.uHgiBox.value.set(x0, z0, w, h);
}

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
let layout = null;   // groundLayout, once (it's seeded)

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
  const brews = [];        // the pools' water
  const hazeK = haze.value.x;
  let gone = false, untrim = () => {};
  Promise.all([load("hg-island"), load("hg-woodkit"), fetch(JSON_URL).then((r) => r.json())]).then(([land, kit, S]) => {
    if (gone) return;
    untrim = trimPlane(scene, bounds, bakeRect);
    const pools = [S.mouth, ...S.eyes, S.nose];
    const root = [S.stem[0], S.stem[1] + 8];   // hg_island.py's stem root
    layout ||= groundLayout(S, bounds);
    if (!U.uHgiMask.value) groundMask(S, layout);
    const { paths, clearings } = layout;
    const open = (x, z, pad) => onPath(paths, x, z, pad) || clearings.some(([a, b, r]) => Math.hypot(a - x, b - z) < r + pad);
    // the ground haze lifts as the camera climbs (one mesh's hook, every frame it's drawn)
    let hook = null;
    land.traverse((n) => {
      if (!n.isMesh || hook) return;
      hook = n;
      n.onBeforeRender = (renderer, sc, camera) => {
        const [a, b] = HAZE_FADE, k = Math.min(1, Math.max(0, (camera.position.y - a) / (b - a)));
        haze.value.x = hazeK * (1 - k * k * (3 - 2 * k));
        U.uHgiTime.value = performance.now() / 1000;
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
      patch(m, n.userData.blenderMat === "HG_IslandSand" ? "sand" : "soil", n.userData.blenderMat === "HG_IslandSand" ? SAND_FRAG : SOIL_FRAG);
    });
    land.traverse((n) => { if (n.isMesh && n.userData.blenderMat === "HG_IslandGrass") patch(n.material, "land", LAND_FRAG); });
    group.add(land);
    // the brew: the model's flat glowing green read as plastic from the
    // plane (user, 2026-10-28: "doesnt look realistic"), so each pool gets
    // the top side's lake water (lake-water.js) in a witch's brew's colours,
    // murky green going black in the deep, a sickly froth at the edge, a
    // low glow of its own; the model's sheet stays under it as the bed
    land.updateMatrixWorld(true);
    let bedY = null;
    land.traverse((n) => {
      // the banks: wet mud, their green glow gone (it framed each pool in neon)
      if (n.isMesh && n.userData.blenderMat === "HG_IslandBank") { n.material.color.setHex(0x161a10); n.material.emissiveIntensity = 0.05; }
      if (!n.isMesh || n.userData.blenderMat !== "HG_IslandBrew") return;
      // the bed: dark mud, its neon gone (it lit the water up from below)
      n.material.color.setHex(BREW.bed);
      n.material.emissive.setHex(BREW.glow);
      n.material.emissiveIntensity = BREW.glowK;
      n.geometry.computeBoundingBox();
      bedY = Math.max(bedY ?? -Infinity, _p.copy(n.geometry.boundingBox.max).applyMatrix4(n.matrixWorld).y);
    });
    if (bedY != null) {
      for (const pool of pools) {
        const shape = new THREE.Shape(pool.map(([x, z]) => new THREE.Vector2(x, -z)));
        const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, bedY + 0.06, 0);
        const mat = lakeWaterMaterial(pool, BREW);
        mat.emissive.setHex(BREW.glow);
        mat.emissiveIntensity = BREW.glowK;
        patch(mat, "brew", BREW_FRAG);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 2;
        mesh.onBeforeRender = mat.userData.tick;
        group.add(mesh);
        brews.push(mesh);
        // two sheets of mist in the pool, under the banks' tops
        for (const [dy, a] of [[0.35, 0.1], [0.7, 0.07]]) {
          const mist = new THREE.MeshBasicMaterial({ color: 0x6f8a6a, transparent: true, opacity: a, depthWrite: false });
          patch(mist, "mist", MIST_FRAG);
          const sheet = new THREE.Mesh(geo.clone().translate(0, dy, 0), mist);
          sheet.renderOrder = 3;
          group.add(sheet);
          brews.push(sheet);
        }
      }
    }
    // the woods ring's trees off the cliff, out of the brew, clear of the stem
    scene.traverse((o) => {
      const spots = o.isInstancedMesh && o.userData.woodsSpots;
      if (!spots) return;
      spots.forEach(([x, z], i) => {
        if (inside(S.coast, x, z) && distTo(S.coast, x, z) > 6 && !pools.some((p) => inside(p, x, z) || distTo(p, x, z) < 2)
          && Math.hypot(x - root[0], z - root[1]) > 11 && !open(x, z, 1)) return;
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
      && Math.hypot(x - root[0], z - root[1]) > 13 && !open(x, z, r + 0.5);
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
      for (const m of brews) { m.geometry.dispose(); m.material.dispose(); }
      brews.length = 0;
      haze.value.x = hazeK;
      scene.remove(group);
    },
  };
}
