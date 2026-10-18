// Troll Forces — water for a lake of any shape (Trollface Island's, user
// 2026-10-18: the lake was a flat cyan sheet). After map-dressing.js's
// beachWaterMaterial, but the shore is a polygon, not a straight line: a
// small texture holds each spot's distance to the shore (baked once, 1 m a
// texel), and the shader runs sand -> turquoise shallows -> deep blue on it,
// with a foam line washing at the edge and wave normals faded with distance
// (so they don't shimmer from the plane). Lit, so fog and the sun behave;
// see-through in the shallows, where you wade.

import * as THREE from "three";

const REACH = 24;   // metres: the distance texture saturates past this (deep water)

/* Distance from each texel centre to the nearest shore edge, 0 outside. */
function shoreDistance(poly, minX, minZ, w, h, cell) {
  const data = new Uint8Array(w * h * 4);
  const inside = (x, z) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  };
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const x = minX + (tx + 0.5) * cell, z = minZ + (ty + 0.5) * cell;
      let d = 0;
      if (inside(x, z)) {
        d = Infinity;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [ax, az] = poly[j], [bx, bz] = poly[i];
          const ex = bx - ax, ez = bz - az;
          const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
          d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t));
        }
      }
      const v = Math.round(Math.min(1, d / REACH) * 255);
      const o = (ty * w + tx) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/* `poly`: the shore, [[x, z], ...] in metres. Call `tick()` on the
   returned material's userData before it draws (the mesh's onBeforeRender). */
export function lakeWaterMaterial(poly, { shallow = 0x3fd0d8, deep = 0x1673b8, sand = 0xcdb98a, foam = 0xf4fbfa } = {}) {
  const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
  const cell = 1;
  const minX = Math.min(...xs) - 2, minZ = Math.min(...zs) - 2;
  const w = Math.ceil((Math.max(...xs) + 2 - minX) / cell), h = Math.ceil((Math.max(...zs) + 2 - minZ) / cell);
  const uniforms = {
    uTime: { value: 0 },
    uDist: { value: shoreDistance(poly, minX, minZ, w, h, cell) },
    uBox: { value: new THREE.Vector4(minX, minZ, w * cell, h * cell) },
    uShallow: { value: new THREE.Color(shallow) },
    uDeep: { value: new THREE.Color(deep) },
    uSand: { value: new THREE.Color(sand) },
    uFoam: { value: new THREE.Color(foam) },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.2, transparent: true, depthWrite: false });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLakePos;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvLakePos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vLakePos;
        uniform float uTime;
        uniform sampler2D uDist;
        uniform vec4 uBox;
        uniform vec3 uShallow, uDeep, uSand, uFoam;
        float lakeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float lakeNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(lakeHash(i), lakeHash(i + vec2(1, 0)), f.x), mix(lakeHash(i + vec2(0, 1)), lakeHash(i + vec2(1, 1)), f.x), f.y);
        }
        // slope of a few small travelling waves at p (d/dx, d/dz): a lake's chop, not a sea's swell
        vec2 lakeSlope(vec2 p, float t) {
          vec2 s = vec2(0.0);
          vec4 W[4];
          W[0] = vec4(0.80, 0.60, 0.90, 0.8);
          W[1] = vec4(-0.50, 0.87, 1.70, 1.3);
          W[2] = vec4(0.20, -0.98, 2.90, 2.0);
          W[3] = vec4(-0.95, -0.30, 4.30, 2.7);
          float A[4]; A[0] = 0.11; A[1] = 0.07; A[2] = 0.04; A[3] = 0.025;
          for (int k = 0; k < 4; k++) {
            vec2 d = normalize(W[k].xy);
            float ph = dot(d, p) * W[k].z - t * W[k].w;
            s += d * (A[k] * W[k].z * cos(ph));
          }
          return s;
        }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float lakeD = texture2D(uDist, (vLakePos.xz - uBox.xy) / uBox.zw).r * ${REACH.toFixed(1)};   // metres from the shore
        vec3 lakeCol = mix(uShallow, uDeep, smoothstep(1.5, 16.0, lakeD));
        lakeCol = mix(uSand, lakeCol, smoothstep(0.0, 1.6, lakeD));          // the sand bed through the first metre or so
        float t = uTime;
        float wash = 0.7 + 0.35 * sin(t * 0.6 + vLakePos.x * 0.05 + vLakePos.z * 0.03);
        float lakeFoam = smoothstep(0.45, 0.0, abs(lakeD - wash)) * (0.45 + 0.55 * lakeNoise(vLakePos.xz * 0.8 + t * 0.25));
        lakeFoam = clamp(lakeFoam + smoothstep(0.35, 0.0, lakeD) * 0.5, 0.0, 1.0);
        diffuseColor.rgb = mix(lakeCol, uFoam, lakeFoam);
        diffuseColor.a = mix(0.62, 0.9, smoothstep(0.5, 10.0, lakeD)) + lakeFoam * 0.1;`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.85, lakeFoam);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        {
          float fade = 1.0 - smoothstep(20.0, 90.0, distance(cameraPosition, vLakePos));
          vec2 sl = lakeSlope(vLakePos.xz, uTime) * fade * (1.0 - lakeFoam * 0.7);
          normal = normalize((viewMatrix * vec4(normalize(vec3(-sl.x, 1.0, -sl.y)), 0.0)).xyz);
        }`);
  };
  m.customProgramCacheKey = () => "troll-lake-water";
  m.userData.tick = () => { uniforms.uTime.value = performance.now() / 1000; };
  return m;
}

/* A falling sheet's texture: streaks that scroll down (offset.y by the
   caller). Repeats both ways. */
export function fallsTexture() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(190,235,255,0.55)";
  g.fillRect(0, 0, 128, 256);
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = r() * 128, y = r() * 256, len = 40 + r() * 120, wd = 1 + r() * 3;
    g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.5})`;
    g.fillRect(x, y, wd, len);
    if (y + len > 256) g.fillRect(x, y - 256, wd, len);   // wrap so it tiles
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
