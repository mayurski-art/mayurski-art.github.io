// Troll Forces — the toolkit behind "Trolling Loud", the neon nightclub map
// (trollingloud.js): neon tubes batched into one draw call, the LED screens,
// the club's shared clock (one beat drives every light), the disco-ball and
// uplight wash patched into lit materials, the canvas textures, and the
// structural builders (walls with doors, slabs with holes, glass rails).
//
// Batching and the canvas-texture cache come from trollcity-kit.js. Nothing
// here loads a model, and nothing adds a light at runtime (light-pool.js).

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { rng, canvasTex, tex, place } from "./trollcity-kit.js?v=tc2-wst-tc3";

export const T = 0.3;   // wall thickness

/* ============================================================ the club clock

   Everything that pulses reads these uniforms, shared by every material
   that needs them. They're set once a frame (trollingloud.js tick) from
   absolute time, so the three render passes a frame (shadow, SSAO, main)
   can't triple-step anything. */
export const U = {
  uTime: { value: 0 },
  uBeatPos: { value: 0 },      // beats since the clock started
  uKick: { value: 0 },         // 1 on the beat, decaying
  uLevel: { value: 1 },        // the song's loudness 0..1: its quiet bits dim the floor
  uKill: { value: new Float32Array(16) },   // per sign group: 1 = shot out
  uPlayer: { value: new THREE.Vector3(0, -99, 0) },
  uBall: { value: new THREE.Vector3(0, 6.6, -3) },
  uBallRot: { value: 0 },
  uDisco: { value: 0.55 },
};

/* ================================================================= neon

   One material for every tube, strip and LED tile in the club: vertex
   colours carry the (HDR) colour, `aNeon` the behaviour:
     x  phase along the tube (the chase runs along it)
     y  how much it chases (0 steady, 1 a full running light)
     z  how hard it kicks on the beat
     w  its kill group (a sign you shot goes dark for a few seconds)
   and `aRip` lights it up round the player (the dance floor tiles). */
function neonPatch(sh) {
  Object.assign(sh.uniforms, { uTime: U.uTime, uBeatPos: U.uBeatPos, uKick: U.uKick, uLevel: U.uLevel, uKill: U.uKill, uPlayer: U.uPlayer });
  sh.vertexShader = sh.vertexShader
    .replace("#include <common>", `#include <common>
      attribute vec4 aNeon;
      attribute float aRip;
      uniform float uTime, uBeatPos, uKick, uLevel;
      uniform float uKill[16];
      uniform vec3 uPlayer;
      varying float vGlow;`)
    .replace("#include <begin_vertex>", `#include <begin_vertex>
      {
        float wave = 0.5 + 0.5 * sin(6.2832 * (uBeatPos * 0.25 - aNeon.x));
        float g = mix(1.0, 0.22 + 0.78 * wave * wave, aNeon.y);
        g *= 1.0 + aNeon.z * (uKick - 0.3);
        vec4 nw = modelMatrix * vec4(transformed, 1.0);
        if (aRip > 0.0) {
          // The dance floor's tiles (1 m, on the half metre; the floor's
          // middle is 0,-3, trollingloud.js DC). A new show every eight
          // bars, each stepping on the beat: a checkerboard flipping, rings
          // stepping out over the bar, a band sweeping across on the
          // eighths, diamonds firing outward. The bar's one flashes it all.
          vec2 tc = floor(nw.xz);
          vec2 fc = tc + vec2(0.5, 3.5);
          float b = floor(uBeatPos + 0.02);
          float show = mod(floor(uBeatPos / 32.0), 4.0);
          float hit;
          if (show < 1.0) hit = mod(tc.x + tc.y + b, 2.0);
          else if (show < 2.0) hit = 1.0 - smoothstep(0.7, 1.3, abs(length(fc) - (mod(b, 4.0) * 2.0 + 1.0)));
          else if (show < 3.0) hit = step(abs(tc.x + 7.0 - (mod(floor(uBeatPos * 2.0), 8.0) * 2.0 - 0.5)), 1.0);
          else hit = step(mod(abs(fc.x) + abs(fc.y) - b * 2.0, 6.0), 1.6);
          float one = step(mod(b, 4.0), 0.5);
          g *= (0.3 + 0.7 * uLevel) * mix(0.4, 1.0, hit);
          g += uKick * uLevel * (hit * 1.9 + one * 0.45);
        }
        g *= 1.0 - uKill[int(aNeon.w + 0.5)];
        float d = length(nw.xz - uPlayer.xz);
        g += aRip * (1.8 * exp(-d * d * 0.5) + 0.5 * exp(-pow(d - mod(uTime * 4.0, 7.0), 2.0) * 3.0) * step(abs(nw.y - uPlayer.y), 2.5));
        vGlow = max(g, 0.0);
      }`);
  sh.fragmentShader = sh.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying float vGlow;")
    .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse * vGlow, opacity );");
}

export function neonMat({ map = null, additive = false, transparent = false, side = THREE.FrontSide, key = "" } = {}) {
  const m = new THREE.MeshBasicMaterial({
    map, vertexColors: true, toneMapped: false, side,
    transparent: additive || transparent,
    depthWrite: !(additive || transparent),
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  m.userData.neon = true;
  m.onBeforeCompile = neonPatch;
  m.customProgramCacheKey = () => `tl-neon-${additive}-${transparent}-${!!map}-${key}`;
  return m;
}

/* Gathers neon pieces per material, then merges each list to one mesh. */
export class Neon {
  constructor(root) {
    this.root = root;
    this.lists = new Map();
    this.meshes = [];
  }

  /* Add a geometry with one colour and behaviour. `phase` is a number, or
     a function of the vertex's uv.x (0..1 along a tube). */
  add(mat, geo, { color = 0xffffff, k = 1, phase = 0, chase = 0, beat = 0.25, group = 0, rip = 0 } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "uv") g.deleteAttribute(name);
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    const c = new THREE.Color(color).multiplyScalar(k);
    const col = new Float32Array(n * 3), neo = new Float32Array(n * 4), rp = new Float32Array(n);
    const uv = g.attributes.uv;
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      neo[i * 4] = typeof phase === "function" ? phase(uv.getX(i)) : phase;
      neo[i * 4 + 1] = chase;
      neo[i * 4 + 2] = beat;
      neo[i * 4 + 3] = group;
      rp[i] = rip;
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute("aNeon", new THREE.Float32BufferAttribute(neo, 4));
    g.setAttribute("aRip", new THREE.Float32BufferAttribute(rp, 1));
    g.clearGroups();
    let l = this.lists.get(mat);
    if (!l) this.lists.set(mat, (l = []));
    l.push(g);
    return g;
  }

  /* A tube through `pts` ([x, y, z]...), smooth (catmull) or straight. The
     chase runs `len / chaseLen` cycles along it. */
  tube(mat, pts, { r = 0.035, smooth = true, closed = false, seg = 0, radial = 5, chaseLen = 6, phase0 = 0, ...o } = {}) {
    const v = pts.map((p) => new THREE.Vector3(...p));
    const curve = smooth
      ? new THREE.CatmullRomCurve3(v, closed, "centripetal")
      : (() => { const path = new THREE.CurvePath(); for (let i = 0; i < v.length - 1; i++) path.add(new THREE.LineCurve3(v[i], v[i + 1])); if (closed) path.add(new THREE.LineCurve3(v[v.length - 1], v[0])); return path; })();
    const len = curve.getLength();
    const g = new THREE.TubeGeometry(curve, seg || Math.max(4, Math.ceil(len * (smooth ? 4 : 1))), r, radial, closed && smooth);
    return this.add(mat, g, { phase: (u) => phase0 + (u * len) / chaseLen, ...o });
  }

  /* A straight glowing bar (LED strip), `y` its bottom. */
  bar(mat, x, y, z, w, h, d, rot = {}, o = {}) {
    return this.add(mat, place(new THREE.BoxGeometry(w, h, d), { x, y: y + h / 2, z, ...rot }), o);
  }

  /* A flat quad facing `ry` (0 = +z), centred on x, y, z. */
  quad(mat, x, y, z, w, h, { ry = 0, rx = 0, uv = null, ...o } = {}) {
    const g = new THREE.PlaneGeometry(w, h);
    if (uv) {
      const a = g.attributes.uv;
      for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1]));
    }
    return this.add(mat, place(g, { x, y, z, rx, ry }), o);
  }

  flush() {
    for (const [mat, geos] of this.lists) {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      if (mat.transparent) skipOverride(mesh);
      this.root.add(mesh);
      this.meshes.push(mesh);
    }
    this.lists.clear();
  }
}

/* SSAO renders the scene once more with its own normal material over
   everything; glass, beams and halos would print dark rings into the
   ambient occlusion. Skip a mesh whenever it's drawn with any material but
   its own (the draw range is read right after onBeforeRender). */
export function skipOverride(mesh, then = null) {
  mesh.onBeforeRender = function (r, s, c, geo, mat, grp) {
    geo.drawRange.count = mat === mesh.material ? Infinity : 0;
    then?.call(this, r, s, c, geo, mat, grp);
  };
  return mesh;
}

/* ======================================================= the LED screens

   Unlit, procedural, animated in the shader: nothing redraws a canvas a
   frame. "crystal" is the diamond-mirror wall behind the DJ (a grid of
   faceted tiles twinkling ice blue and white); "plasma" the VIP lounge's
   oval ceiling (violet and cyan plasma). */
export function ledMat(kind) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uKick: U.uKick, uBeatPos: U.uBeatPos });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vLed;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLed = uv;");
    const body = kind === "crystal" ? `
        vec2 p = vLed * vec2(18.0, 13.0);
        vec2 q = vec2(p.x + p.y, p.x - p.y) * 0.7071;
        vec2 id = floor(q), f = fract(q) - 0.5;
        float rnd = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
        float edge = smoothstep(0.42, 0.5, max(abs(f.x), abs(f.y)));
        float facet = 0.55 + 0.45 * sign(f.x * f.y);
        float tw = pow(0.5 + 0.5 * sin(uTime * (1.2 + rnd * 2.4) + rnd * 40.0), 24.0) * step(0.55, fract(rnd * 7.31));
        float sweep = exp(-pow(fract(vLed.x * 0.5 + vLed.y * 0.3 - uBeatPos * 0.125) - 0.5, 2.0) * 60.0);
        // a deep blue ground with sparse bright glints: a pale wall here
        // swallowed the white trollface of anyone standing in front of it
        vec3 ice = mix(vec3(0.05, 0.10, 0.38), vec3(0.30, 0.55, 0.95), facet * (0.35 + 0.65 * rnd));
        vec3 col = (ice * (0.17 + 0.2 * uKick) + vec3(0.85, 0.92, 1.0) * (tw * 1.1 + sweep * 0.22) + vec3(0.5, 0.7, 1.0) * edge * 0.3) * 0.62;
        diffuseColor = vec4(col, 1.0);` : `
        vec2 p = (vLed - 0.5) * 6.0;
        float t = uTime * 0.45;
        float v = sin(p.x * 1.3 + t) + sin(p.y * 1.7 - t * 1.3) + sin(length(p + vec2(sin(t), cos(t * 0.7))) * 2.2 - t * 2.0) + sin(p.x * p.y * 0.35 + t);
        vec3 col = 0.55 + 0.45 * cos(6.2832 * (vec3(0.78, 0.58, 0.88) + v * 0.18 + vec3(0.0, 0.12, 0.3)));
        col *= vec3(0.9, 0.55, 1.2);
        float streak = pow(abs(sin(v * 3.0 + t)), 18.0);
        float rim = smoothstep(0.32, 0.5, length(vLed - 0.5));
        diffuseColor = vec4((col * (0.6 + 0.25 * uKick) + vec3(0.7, 0.9, 1.0) * streak * 0.5 - rim * 0.25) * 0.8, 1.0);`;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vLed;\nuniform float uTime, uKick, uBeatPos;")
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", `vec4 diffuseColor; {${body}\n}`);
  };
  m.customProgramCacheKey = () => `tl-led-${kind}`;
  return m;
}

/* ================================================ lit materials: club fx

   Patched into lit (standard) materials:
     wash   { color, top, strength, base } a coloured uplight strongest at a
            surface's foot (floor-level LED wash on the walls)
     disco  the mirror ball's spots, swept round the hall as it turns.
            Points under the mezzanine get few (the slab shades them).
   No real lights for either. */
export function clubFx(mat, { wash = null, disco = false } = {}) {
  if (!wash && !disco) return mat;
  const f = (v) => v.toFixed(4);
  const c = wash ? new THREE.Color(wash.color) : null;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uKick: U.uKick, uBall: U.uBall, uBallRot: U.uBallRot, uDisco: U.uDisco });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vClubW;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvClubW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    let add = "";
    if (wash) add += `
      totalEmissiveRadiance += vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)}) * ${f(wash.strength)} * (0.85 + 0.3 * uKick) * (1.0 - smoothstep(${f(wash.base ?? 0)}, ${f(wash.top)}, vClubW.y));`;
    if (disco) add += `
      {
        vec3 dv = vClubW - uBall;
        float dl = length(dv);
        vec3 dn = dv / max(dl, 0.001);
        float ca = cos(uBallRot), sa = sin(uBallRot);
        dn.xz = mat2(ca, -sa, sa, ca) * dn.xz;
        vec2 cell = vec2(atan(dn.z, dn.x), asin(clamp(dn.y, -1.0, 1.0))) / 0.15;
        vec2 id = floor(cell), fr = fract(cell) - 0.5;
        float rnd = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
        float spot = smoothstep(0.3, 0.1, length(fr)) * step(0.5, rnd);
        float inHall = step(abs(vClubW.x), 14.0) * step(-17.0, vClubW.z) * step(vClubW.z, 13.0);
        float shade = (vClubW.y < 4.25 && (abs(vClubW.x) > 9.5 || vClubW.z > 8.5)) ? 0.15 : 1.0;
        totalEmissiveRadiance += spot * inHall * shade * uDisco * mix(vec3(0.55, 0.7, 1.0), vec3(1.0, 0.55, 0.9), rnd) * (7.0 / (dl + 3.0));
      }`;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vClubW;\nuniform float uKick, uBallRot, uDisco;\nuniform vec3 uBall;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>${add}`);
  };
  const key = `tl-fx-${wash ? `${wash.color}-${wash.top}-${wash.strength}-${wash.base ?? 0}` : ""}-${disco}`;
  mat.customProgramCacheKey = () => key;
  return mat;
}

/* ============================================================== builders

   An axis-aligned wall of thickness T: `axis` "x" runs west-east at z =
   `at`, "z" north-south at x = `at`, from `a` to `b`, `y` its foot. `holes`
   cut doors and windows: [{ c, w, spans: [[lo, hi], ...] }], heights from
   `y`; a span from 0 is a door. Windows stay open (a sill below, a lintel
   above) unless `glass`. One opening per column: stack storeys in its
   spans. (After trollcity.js's wall(), less the frontier trim.) */
export function wall(K, { axis, at, a, b, y = 0, h, t = T, mat, pen = 8, holes = [], frame = null, glass = null }) {
  const X = axis === "x";
  const piece = (s, e, lo, hi) => {
    if (e - s < 0.02 || hi - lo < 0.02) return;
    const c = (s + e) / 2;
    K.solid(X ? c : at, X ? at : c, X ? e - s : t, X ? t : e - s, hi - lo, { y: y + lo, pen, mat });
  };
  let cur = a;
  for (const hole of [...holes].sort((p, q) => p.c - q.c)) {
    const s = hole.c - hole.w / 2, e = hole.c + hole.w / 2;
    piece(cur, s, 0, h);
    let lo = 0;
    const spans = [...hole.spans].sort((p, q) => p[0] - q[0]);
    for (const [sLo, sHi] of spans) { piece(s, e, lo, sLo); lo = sHi; }
    piece(s, e, lo, h);
    cur = e;
    for (const [sLo, sHi] of spans) {
      const cx = X ? hole.c : at, cz = X ? at : hole.c;
      if (sLo > 0.05 && (hole.glass ?? glass)) {
        K.api.ghostBox(cx, cz, X ? hole.w : 0.06, X ? 0.06 : hole.w, sHi - sLo, { y: y + sLo, pen: 0.3 });
        K.add(hole.glass ?? glass, place(new THREE.PlaneGeometry(hole.w, sHi - sLo), { x: cx, y: y + (sLo + sHi) / 2, z: cz, ry: X ? 0 : Math.PI / 2 }), { shadow: false });
      }
      if (!frame) continue;
      // a slim metal frame round the opening, both faces
      const fw = 0.08, dd = t + 0.04;
      for (const side of [-1, 1]) {
        const o = hole.c + side * (hole.w / 2 + fw / 2 - 0.01);
        K.box(frame, X ? o : at, y + sLo, X ? at : o, X ? fw : dd, sHi - sLo, X ? dd : fw);
      }
      K.box(frame, cx, y + sHi, cz, X ? hole.w + fw * 2 : dd, fw, X ? dd : hole.w + fw * 2);
      if (sLo > 0.05) K.box(frame, cx, y + sLo - fw, cz, X ? hole.w + fw * 2 : dd, fw, X ? dd : hole.w + fw * 2);
    }
  }
  piece(cur, b, 0, h);
}

/* A wall's facing, in its own material: planes `side` (+1/-1, along the
   wall's normal) of the wall at `at`, from `a` to `b` and `v0` to `v1`
   (heights from `y`), with the same `holes` as the wall cut out. */
export function lining(K, mat, { axis, at, side, a, b, y = 0, v0 = 0, v1, holes = [], t = T }) {
  const X = axis === "x";
  const cut = holes.flatMap((h) => h.spans.map(([lo, hi]) => [h.c - h.w / 2, h.c + h.w / 2, lo, hi]));
  const off = at + side * (t / 2 + 0.012);
  for (const [u0, u1, w0, w1] of cutRects(a, b, v0, v1, cut)) {
    for (let u = u0; u < u1 - 0.01; u += 8) {
      const ue = Math.min(u1, u + 8);
      const g = new THREE.PlaneGeometry(ue - u, w1 - w0);
      const c = (u + ue) / 2;
      K.add(mat, place(g, { x: X ? c : off, y: y + (w0 + w1) / 2, z: X ? off : c, ry: X ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2) }), { shadow: false });
    }
  }
}

/* Rectangles of [x0, x1, z0, z1] minus the holes (also rectangles): cut
   into strips, for slabs and decks. */
export function cutRects(x0, x1, z0, z1, holes = []) {
  let out = [[x0, x1, z0, z1]];
  for (const [hx0, hx1, hz0, hz1] of holes) {
    const next = [];
    for (const [a0, a1, b0, b1] of out) {
      if (hx1 <= a0 || hx0 >= a1 || hz1 <= b0 || hz0 >= b1) { next.push([a0, a1, b0, b1]); continue; }
      if (hx0 > a0) next.push([a0, hx0, b0, b1]);
      if (hx1 < a1) next.push([hx1, a1, b0, b1]);
      const m0 = Math.max(a0, hx0), m1 = Math.min(a1, hx1);
      if (hz0 > b0) next.push([m0, m1, b0, hz0]);
      if (hz1 < b1) next.push([m0, m1, hz1, b1]);
    }
    out = next;
  }
  return out.filter(([a0, a1, b0, b1]) => a1 - a0 > 0.04 && b1 - b0 > 0.04);
}

/* A floor deck: its collider (top at `top`, `h` thick), a top face, an
   underside, and the edge faces, each in its own material (null skips
   it). Rectangles from cutRects. Long decks are laid in 8 m sections so
   the tiling never smears. */
export function deck(K, rects, { top, h = 0.3, topMat = null, under = null, edge = null, pen = 8 }) {
  for (const [x0, x1, z0, z1] of rects) {
    K.api.ghostBox((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h, { y: top - h, pen });
    for (let x = x0; x < x1 - 0.01; x += 8) {
      const xe = Math.min(x1, x + 8);
      for (let z = z0; z < z1 - 0.01; z += 8) {
        const ze = Math.min(z1, z + 8);
        const cx = (x + xe) / 2, cz = (z + ze) / 2;
        if (topMat) K.add(topMat, place(new THREE.PlaneGeometry(xe - x, ze - z), { x: cx, y: top + 0.001, z: cz, rx: -Math.PI / 2 }), { shadow: false });
        if (under) K.add(under, place(new THREE.PlaneGeometry(xe - x, ze - z), { x: cx, y: top - h - 0.001, z: cz, rx: Math.PI / 2 }), { shadow: false });
      }
    }
    if (edge) K.box(edge, (x0 + x1) / 2, top - h, (z0 + z1) / 2, x1 - x0, h, z1 - z0);
  }
}

/* A glass balustrade: a gold cap rail on clear panels, a dark shoe. It
   stops bodies; a bullet goes through (pen 0.3). */
export function glassRail(K, M, { axis, at, a, b, y, h = 1.05 }) {
  const X = axis === "x";
  const len = b - a, c = (a + b) / 2;
  const x = X ? c : at, z = X ? at : c;
  K.api.ghostBox(x, z, X ? len : 0.1, X ? 0.1 : len, h, { y, pen: 0.3 });
  K.box(M.gold, x, y + h - 0.05, z, X ? len : 0.09, 0.06, X ? 0.09 : len);
  K.box(M.blackMetal, x, y, z, X ? len : 0.1, 0.08, X ? 0.1 : len);
  K.add(M.glassRail, place(new THREE.PlaneGeometry(len, h - 0.14), { x, y: y + 0.08 + (h - 0.14) / 2, z, ry: X ? 0 : Math.PI / 2 }), { shadow: false });
  const n = Math.max(1, Math.round(len / 1.4));
  for (let i = 0; i <= n; i++) {
    const s = a + (len * i) / n;
    K.box(M.gold, X ? s : at, y, X ? at : s, 0.05, h - 0.05, 0.05);
  }
}

/* ============================================================== textures */

const TROLL_URL = new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
let trollImg = null;
const trollWaiters = [];
function withTroll(then) {
  if (trollImg?.complete && trollImg.naturalWidth) return then(trollImg);
  trollWaiters.push(then);
  if (trollImg) return;
  trollImg = new Image();
  trollImg.onload = () => { for (const f of trollWaiters.splice(0)) f(trollImg); };
  trollImg.src = TROLL_URL;
}

/* A canvas texture drawn now, and again once the trollface art loads. */
function trollTex(name, w, h, draw, opts = {}) {
  return tex(name, () => {
    const t = canvasTex(w, h, (g) => draw(g, w, h, null), opts);
    withTroll((img) => {
      const g = t.image.getContext("2d");
      g.clearRect(0, 0, w, h);
      draw(g, w, h, img);
      t.needsUpdate = true;
    });
    return t;
  });
}

/* The trollface artwork's ink as a neon outline: the black linework kept,
   recoloured, glowing; the white face and the background dropped. */
function neonTroll(g, img, x, y, w, h, color, { blur = 22, fill = null } = {}) {
  if (!img) return;
  const s = Math.min(w / img.width, h / img.height);
  const dw = Math.round(img.width * s), dh = Math.round(img.height * s);
  const c = document.createElement("canvas");
  c.width = dw; c.height = dh;
  const cg = c.getContext("2d");
  cg.drawImage(img, 0, 0, dw, dh);
  const px = cg.getImageData(0, 0, dw, dh);
  const d = px.data;
  const rgb = new THREE.Color(color);
  const R = rgb.r * 255, G = rgb.g * 255, B = rgb.b * 255;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    const ink = d[i + 3] > 40 && lum < 110;
    if (ink) { d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255; }
    else if (fill && d[i + 3] > 40) { d[i] = fill[0]; d[i + 1] = fill[1]; d[i + 2] = fill[2]; d[i + 3] = fill[3]; }
    else d[i + 3] = 0;
  }
  cg.putImageData(px, 0, 0);
  const ox = x + (w - dw) / 2, oy = y + (h - dh) / 2;
  g.save();
  g.shadowColor = color;
  for (const b of [blur, blur * 0.4]) { g.shadowBlur = b; g.drawImage(c, ox, oy); }
  g.shadowBlur = 0;
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = 0.55;
  g.drawImage(c, ox, oy);
  g.restore();
}

/* Neon lettering: a soft outer glow, the tube, a hot white core. */
function neonText(g, text, x, y, size, color, { font = "'Brush Script MT', 'Segoe Script', cursive", weight = 700, maxW = 9999, outline = false } = {}) {
  g.save();
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.shadowColor = color;
  for (const [blur, lw, col] of [[size * 0.5, size * 0.09, color], [size * 0.18, size * 0.07, color], [0, size * 0.025, "#ffffff"]]) {
    g.shadowBlur = blur;
    g.strokeStyle = col;
    g.lineWidth = lw;
    g.strokeText(text, x, y, maxW);
  }
  if (!outline) {
    g.shadowBlur = size * 0.2;
    g.fillStyle = "rgba(255,255,255,0.10)";
    g.fillText(text, x, y, maxW);
  }
  g.restore();
}

/* The club's signs, all on one canvas (one draw call for every sign):
   `SIGNS` names each rectangle; signUV() gives its UVs. */
const ATLAS_W = 2048, ATLAS_H = 2048;
export const SIGNS = {
  logo:      { r: [0, 0, 2048, 420], text: "Trolling Loud", color: "#ff3fb4", size: 300 },
  trollCyan: { r: [0, 420, 640, 1060], troll: "#3ff0ff" },
  trollPink: { r: [640, 420, 1280, 1060], troll: "#ff4fd8" },
  umad:      { r: [1280, 420, 2048, 700], text: "u mad?", color: "#ffb02e", size: 210 },
  problem:   { r: [1280, 700, 2048, 980], text: "Problem?", color: "#3fffc0", size: 190 },
  vip:       { r: [1280, 980, 1664, 1240], text: "VIP", color: "#40f0d0", size: 170, block: true },
  bar:       { r: [1664, 980, 2048, 1240], text: "BAR", color: "#ffb02e", size: 170, block: true },
  lol:       { r: [0, 1060, 640, 1340], text: "lol", color: "#ff3fb4", size: 240 },
  exit:      { r: [640, 1060, 960, 1220], text: "EXIT", color: "#ff2a3a", size: 110, block: true, box: true },
  rooftop:   { r: [960, 1060, 1280, 1340], text: "ROOF ↑", color: "#5aa8ff", size: 92, block: true },
  noTroll:   { r: [0, 1340, 1024, 1600], text: "no trolling on the dance floor", color: "#c86bff", size: 86, block: true },
  rest:      { r: [1024, 1340, 1536, 1600], text: "RESTROOMS", color: "#7ad8ff", size: 84, block: true },
  coat:      { r: [1536, 1340, 2048, 1600], text: "COAT CHECK", color: "#ffd84a", size: 84, block: true },
  staff:     { r: [0, 1600, 512, 1800], text: "STAFF ONLY", color: "#f4f4f4", size: 78, block: true, box: true },
  sky:       { r: [512, 1600, 1280, 1860], text: "Sky Bar", color: "#5aa8ff", size: 200 },
  dj:        { r: [1280, 1600, 2048, 1860], text: "DJ LULZ", color: "#ff4fd8", size: 170, block: true },
  pawn:      { r: [0, 1860, 512, 2048], text: "PAWN", color: "#ffd84a", size: 120, block: true },
  open:      { r: [512, 1860, 900, 2048], text: "OPEN 24H", color: "#ff2a3a", size: 92, block: true },
  nails:     { r: [900, 1860, 1400, 2048], text: "LOL NAILS", color: "#ff7ad8", size: 100, block: true },
  mart:      { r: [1400, 1860, 2048, 2048], text: "TROLL MART", color: "#5affb0", size: 100, block: true },
};

export function signsTexture() {
  return trollTex("tl-signs", ATLAS_W, ATLAS_H, (g, W, H, img) => {
    g.clearRect(0, 0, W, H);
    for (const s of Object.values(SIGNS)) {
      const [x0, y0, x1, y1] = s.r;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (s.troll) { neonTroll(g, img, x0 + 30, y0 + 30, x1 - x0 - 60, y1 - y0 - 60, s.troll); continue; }
      if (s.box) {
        g.save();
        g.fillStyle = "rgba(10,6,14,0.85)";
        g.fillRect(x0 + 10, y0 + 10, x1 - x0 - 20, y1 - y0 - 20);
        g.restore();
      }
      neonText(g, s.text, cx, cy, s.size, s.color, s.block
        ? { font: "'Arial Black', 'Helvetica Neue', Arial, sans-serif", weight: 900, maxW: x1 - x0 - 40 }
        : { maxW: x1 - x0 - 40 });
    }
  });
}

export function signUV(name) {
  const [x0, y0, x1, y1] = SIGNS[name].r;
  return [x0 / ATLAS_W, 1 - y1 / ATLAS_H, x1 / ATLAS_W, 1 - y0 / ATLAS_H];
}
export function signAspect(name) {
  const [x0, y0, x1, y1] = SIGNS[name].r;
  return (x1 - x0) / (y1 - y0);
}

/* Tufted leather: diamond buttoning, the hollows dark, the puffs lit. */
export function quiltTexture(base = "#9a1028", hi = "#ff4a6a") {
  return tex(`tl-quilt-${base}`, () => canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    const n = 4, s = W / n;
    for (let i = -1; i <= n; i++) for (let j = -1; j <= n; j++) {
      const cx = i * s + (j % 2 ? s / 2 : 0), cy = j * s * 0.5;
      const r = g.createRadialGradient(cx - s * 0.1, cy - s * 0.12, 2, cx, cy, s * 0.62);
      r.addColorStop(0, hi);
      r.addColorStop(0.55, base);
      r.addColorStop(1, "rgba(0,0,0,0.55)");
      g.fillStyle = r;
      g.beginPath();
      g.moveTo(cx, cy - s * 0.5); g.lineTo(cx + s * 0.5, cy); g.lineTo(cx, cy + s * 0.5); g.lineTo(cx - s * 0.5, cy);
      g.fill();
    }
    g.fillStyle = "rgba(0,0,0,0.6)";
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n * 2; j++) {
      g.beginPath();
      g.arc(i * s + (j % 2 ? s / 2 : 0), j * s * 0.5, 3, 0, Math.PI * 2);
      g.fill();
    }
  }, { repeat: true }));
}

/* Crocodile-embossed leather (the VIP booths). */
export function crocTexture(base = "#1f4a34") {
  return tex(`tl-croc-${base}`, () => canvasTex(256, 256, (g, W, H) => {
    const R = rng(77);
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 20) {
      let x = (y / 20) % 2 ? -10 : 0;
      while (x < W) {
        const w = 16 + R() * 14;
        g.fillStyle = `rgba(255,255,255,${(0.04 + R() * 0.08).toFixed(3)})`;
        g.beginPath();
        if (g.roundRect) g.roundRect(x + 1.5, y + 1.5, w - 3, 17, 5);
        else g.rect(x + 1.5, y + 1.5, w - 3, 17);
        g.fill();
        g.strokeStyle = "rgba(0,0,0,0.45)";
        g.lineWidth = 2;
        g.stroke();
        x += w;
      }
    }
  }, { repeat: true }));
}

/* Teal and gold glass mosaic (the VIP walls). */
export function mosaicTexture() {
  return tex("tl-mosaic", () => canvasTex(256, 256, (g, W, H) => {
    const R = rng(91);
    g.fillStyle = "#0b2a2c";
    g.fillRect(0, 0, W, H);
    const s = 16;
    for (let x = 0; x < W; x += s) for (let y = 0; y < H; y += s) {
      const k = R();
      const c = k < 0.06 ? `hsl(45,80%,${55 + R() * 20}%)` : `hsl(${172 + R() * 18},${45 + R() * 30}%,${16 + R() * 22}%)`;
      g.fillStyle = c;
      g.fillRect(x + 1, y + 1, s - 2, s - 2);
    }
  }, { repeat: true }));
}

/* Vertical slats with a dark gap (the hall's columns and wall panels). */
export function slatTexture() {
  return tex("tl-slats", () => canvasTex(128, 128, (g, W, H) => {
    g.fillStyle = "#120d10";
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 16) {
      const r = g.createLinearGradient(x, 0, x + 12, 0);
      r.addColorStop(0, "#3a2a26"); r.addColorStop(0.5, "#6a4a3e"); r.addColorStop(1, "#2a1c1a");
      g.fillStyle = r;
      g.fillRect(x + 1, 0, 12, H);
    }
  }, { repeat: true }));
}

/* A dance-floor tile's glow: a soft rounded square, bright at the rim. */
export function tileGlowTexture() {
  return tex("tl-tile", () => canvasTex(64, 64, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const r = g.createRadialGradient(32, 32, 4, 32, 32, 40);
    r.addColorStop(0, "rgba(255,255,255,0.55)");
    r.addColorStop(0.7, "rgba(255,255,255,0.25)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(3, 3, W - 6, H - 6);
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 2;
    g.strokeRect(4, 4, W - 8, H - 8);
  }, { srgb: false }));
}

/* Hanging silver strands for the fringe chandelier (alpha). Wide, soft
   strands: at a distance the mipmaps blur them into a curtain instead of
   shimmering (thin, hard ones crawl). */
export function fringeTexture() {
  return tex("tl-fringe", () => canvasTex(256, 128, (g, W, H) => {
    const R = rng(13);
    g.clearRect(0, 0, W, H);
    for (let x = 0; x < W; x += 4) {
      const len = H * (0.75 + R() * 0.25);
      const gr = g.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, "rgba(255,255,255,0.9)");
      gr.addColorStop(0.8, "rgba(255,255,255,0.55)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(x + 1, 0, 2, len);
    }
  }, { srgb: false, repeat: true }));
}

/* A laser beam's falloff along its length (bright at the source). */
export function beamTexture() {
  return tex("tl-beam", () => canvasTex(256, 16, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.5, "rgba(255,255,255,0.45)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    const ac = g.createLinearGradient(0, 0, 0, H);
    ac.addColorStop(0, "rgba(0,0,0,1)"); ac.addColorStop(0.5, "rgba(0,0,0,0)"); ac.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = ac;
    g.fillRect(0, 0, W, H);
  }, { srgb: false }));
}

/* Mirror-ball facets: a grid of little squares, each catching the light
   differently. */
export function facetTexture() {
  return tex("tl-facets", () => canvasTex(256, 128, (g, W, H) => {
    const R = rng(5);
    for (let x = 0; x < W; x += 8) for (let y = 0; y < H; y += 8) {
      const v = 70 + R() * 185;
      g.fillStyle = `rgb(${v},${v},${Math.min(255, v + 20)})`;
      g.fillRect(x, y, 7, 7);
    }
  }));
}

/* Lit office windows for the skyline: mostly dark, warm and cool lights,
   whole floors on, a few colour-washed. One repeat is 8 x 8 windows. */
export function windowsTexture() {
  return tex("tl-windows", () => canvasTex(256, 256, (g, W, H) => {
    const R = rng(23);
    g.fillStyle = "#07060c";
    g.fillRect(0, 0, W, H);
    for (let j = 0; j < 8; j++) {
      const floorOn = R() < 0.16;
      for (let i = 0; i < 8; i++) {
        const on = floorOn ? R() < 0.8 : R() < 0.12;
        if (!on) { g.fillStyle = "#11101a"; g.fillRect(i * 32 + 6, j * 32 + 8, 20, 18); continue; }
        const k = R();
        g.fillStyle = k < 0.55 ? `hsl(40,${60 + R() * 30}%,${55 + R() * 20}%)` : k < 0.85 ? `hsl(205,40%,${60 + R() * 20}%)` : `hsl(${290 + R() * 40},80%,60%)`;
        g.fillRect(i * 32 + 6, j * 32 + 8, 20, 18);
      }
    }
  }, { repeat: true }));
}

/* A speaker cabinet's front: two cones and a horn. */
export function speakerTexture() {
  return tex("tl-speaker", () => canvasTex(128, 256, (g, W, H) => {
    g.fillStyle = "#0c0c0e";
    g.fillRect(0, 0, W, H);
    const cone = (cx, cy, r) => {
      const gr = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      gr.addColorStop(0, "#3a3a40"); gr.addColorStop(0.25, "#111"); gr.addColorStop(0.9, "#202024"); gr.addColorStop(1, "#050505");
      g.fillStyle = gr;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    };
    cone(64, 70, 50);
    cone(64, 180, 50);
    g.fillStyle = "#1a1a1e";
    g.fillRect(34, 236, 60, 14);
  }));
}

/* The troll DJ: the trollface artwork in headphones, a dark hoodie under
   it (alpha around). */
export function djTexture() {
  return trollTex("tl-dj", 256, 320, (g, W, H, img) => {
    g.clearRect(0, 0, W, H);
    // hoodie
    g.fillStyle = "#15121c";
    g.beginPath();
    g.moveTo(24, H); g.quadraticCurveTo(30, 190, 128, 176); g.quadraticCurveTo(226, 190, 232, H);
    g.fill();
    g.strokeStyle = "#ff4fd8"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(104, 196); g.lineTo(98, 260); g.moveTo(152, 196); g.lineTo(158, 260); g.stroke();
    // face
    if (img) {
      const s = Math.min(200 / img.width, 190 / img.height);
      g.drawImage(img, 128 - (img.width * s) / 2, 8, img.width * s, img.height * s);
    }
    // headphones
    g.strokeStyle = "#101014"; g.lineWidth = 12;
    g.beginPath(); g.arc(128, 104, 98, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    g.fillStyle = "#16161a";
    for (const x of [24, 210]) { g.beginPath(); g.ellipse(x + 11, 120, 20, 32, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#3ff0ff";
    for (const x of [24, 210]) { g.beginPath(); g.ellipse(x + 11, 120, 8, 14, 0, 0, Math.PI * 2); g.fill(); }
  });
}

/* The roof flag: the trollface on deep purple. */
export function flagTexture() {
  return trollTex("tl-flag", 256, 160, (g, W, H, img) => {
    g.fillStyle = "#2a0a3a";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#ff3fb4";
    g.fillRect(0, H - 14, W, 14);
    if (img) {
      const s = Math.min(150 / img.width, 120 / img.height);
      g.drawImage(img, W / 2 - (img.width * s) / 2, 10, img.width * s, img.height * s);
    }
  });
}

/* The tour bus's side: black, a magenta stripe, the trollface and the name. */
export function busTexture() {
  return trollTex("tl-bus", 1024, 256, (g, W, H, img) => {
    g.fillStyle = "#0e0c12";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#1c1826";
    for (let x = 120; x < W - 60; x += 110) g.fillRect(x, 34, 92, 70);
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, "#ff3fb4"); gr.addColorStop(1, "#6a3cff");
    g.fillStyle = gr;
    g.fillRect(0, 150, W, 22);
    if (img) {
      const s = Math.min(150 / img.width, 140 / img.height);
      g.drawImage(img, 40, 104 - (img.height * s) / 2 + 40, img.width * s, img.height * s);
    }
    g.font = "italic 900 54px 'Arial Black', Arial, sans-serif";
    g.fillStyle = "#f4f0ff";
    g.fillText("TROLLING LOUD WORLD TOUR", 240, 228);
  });
}
