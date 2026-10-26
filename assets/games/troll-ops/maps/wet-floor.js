// Troll Forces — a wet floor patched into a lit material: pools and
// streaks of standing water laid out in world metres (so a floor cut into
// pieces stays one floor), near-mirror inside a pool, the dry floor between
// them a little glossier than it was, and the wet darker, as wet ground is.
// The rest of the material (its maps, its light map, clubFx's wash and
// disco) is left as it was: whatever onBeforeCompile it had runs first.
//
// What a pool shows: the world env (the sky) is too dark at night to read,
// so a floor can hang a reflection probe instead (hangProbe): the scene
// drawn into a cube from one point, once the map has loaded, box-projected
// onto the room it stands in so the signs land where they are. It counts
// only where the floor is wet and adds no diffuse light, so the dry floor
// looks as it did.
//
// Kabukigrin's hall (spilt drinks on the marble) and A Main (rain on the
// asphalt), doc phase 1: "strong specular, roughness that varies".

import * as THREE from "three";
import { useWorldEnv } from "../view/environment.js?v=sr1-ss1-ss2-ss3";

const f = (v) => Number(v).toFixed(4);
const v3 = (a) => `vec3(${a.map(f).join(", ")})`;

/* rect: [x0, z0, x1, z1], world metres, edged over `edge` m.
   cover: how much of it is pooled (0..1). scale: metres across a pool.
   pool: a pool's roughness. dry: the floor between, as a share of its own.
   dark: the wet's colour, as a share. env: the reflection's strength;
   clamp: its brightest (a lit bar's glow would turn a pool into a lamp).
   probe: { at: [x, y, z], box: [x0, y0, z0, x1, y1, z1] } for hangProbe;
   without one the pools reflect the world env (the sky). */
export function wetFloor(mat, { rect, cover = 0.45, scale = 2.4, edge = 1, pool = 0.05, dry = 0.8, dark = 0.72, env = 0.9, clamp = 4, probe = null } = {}) {
  const [x0, z0, x1, z1] = rect;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey?.bind(mat);
  // the noise's threshold: cover 0 none, 1 all of it
  const thr = 0.78 - cover * 0.56;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWetW;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWetW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    let frag = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vWetW;
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p) {
  vec2 i = floor(p), u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(wHash(i), wHash(i + vec2(1, 0)), u.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), u.x), u.y);
}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
float wetM;
{
  vec2 q = vWetW.xz;
  float inR = min(min(q.x - ${f(x0)}, ${f(x1)} - q.x), min(q.y - ${f(z0)}, ${f(z1)} - q.y));
  vec2 p = q / ${f(scale)};
  // pools, broken up, and long thin streaks where it ran
  float n = wNoise(p) * 0.55 + wNoise(p * 2.3 + 5.1) * 0.3 + wNoise(p * 6.7 + 1.7) * 0.15;
  n = max(n, wNoise(q * vec2(0.35, 1.6) + 9.2) * 0.92);
  wetM = smoothstep(${f(thr - 0.06)}, ${f(thr + 0.06)}, n) * smoothstep(0.0, ${f(edge)}, inR);
  diffuseColor.rgb *= mix(1.0, ${f(dark)}, wetM);
}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor * ${f(dry)}, ${f(pool)} + 0.05 * wNoise(vWetW.xz * 3.1), wetM);`);
    if (probe) {
      const b = probe.box;
      // box projection: the reflected ray run out to the room's walls, and
      // the cube read from the probe toward that point
      frag = frag
        .replace("reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );", `reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			{
				vec3 rv = reflectVec + vec3(1e-5);
				vec3 tMax = (${v3([b[3], b[4], b[5]])} - vWetW) / rv, tMin = (${v3([b[0], b[1], b[2]])} - vWetW) / rv;
				vec3 t3 = mix(tMin, tMax, step(0.0, rv));
				float t = max(0.0, min(min(t3.x, t3.y), t3.z));
				reflectVec = normalize(vWetW + reflectVec * t - ${v3(probe.at)});
			}`)
        .replace("#include <lights_fragment_maps>", `#include <lights_fragment_maps>
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	radiance = min(radiance, vec3(${f(clamp)})) * wetM;
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectDiffuse )
	iblIrradiance *= 0.0;
#endif`);
    }
    sh.fragmentShader = frag;
  };
  const key = `wet-${rect.join(",")}-${cover}-${scale}-${pool}-${dry}-${dark}-${clamp}-${probe ? [probe.at, probe.box].join(",") : ""}`;
  mat.customProgramCacheKey = () => `${prevKey ? prevKey() : ""}|${key}`;
  if (probe) {
    mat.envMapIntensity = env;
    mat.userData.wetProbe = probe;
  } else useWorldEnv(mat, env);
  mat.needsUpdate = true;
  return mat;
}

/* The probe of a floor wetFloor gave one, on `mesh` (any mesh with that
   material, in the scene): drawn once, `delay` ms after both the mesh's
   first draw (which hands it the renderer) and `when` (the map's models
   placed), into a PMREM the material's env becomes. Drawn outside the
   frame (a timer), so it never nests in a render. */
export function hangProbe(mesh, { size = 256, when = Promise.resolve(), delay = 500 } = {}) {
  const mat = mesh.material, probe = mat.userData.wetProbe;
  if (!probe) return;
  let rs = null, ready = false, started = false, env = null;
  const go = () => {
    if (!rs || !ready || started) return;
    started = true;
    setTimeout(() => draw(...rs), delay);
  };
  when.then(() => { ready = true; go(); });
  const prev = mesh.onBeforeRender;
  mesh.onBeforeRender = function (renderer, scene, ...rest) {
    prev?.call(this, renderer, scene, ...rest);
    if (!rs) { rs = [renderer, scene]; go(); }
  };
  const draw = (renderer, scene) => {
    if (!mesh.parent) return;   // the map was unloaded meanwhile
    const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(0.05, 300, rt);
    cam.position.set(...probe.at);
    cam.updateMatrixWorld(true);
    const pmrem = new THREE.PMREMGenerator(renderer);
    cam.update(renderer, scene);
    const next = pmrem.fromCubemap(rt.texture);
    pmrem.dispose();
    rt.dispose();
    env?.dispose();
    env = next;
    mat.envMap = env.texture;
    mat.needsUpdate = true;
  };
}
