// Troll Forces: Grin Beach's surf (GRIN BEACH 5a). A strip of real waves
// from the seawall out to where the flat far sea takes over: the mesh is
// displaced in the vertex shader from the WAVES table, and the same table is
// seaHeight()/seaSlope() in JS, so anything that rides or wades the water
// (surfers, NPCs) sits exactly on what's drawn.
//
// Every client runs the same sea: SEA_CLOCK() is the wall clock folded to
// 120 s, and every wave's period divides 120 s, so the sea loops seamlessly
// and two machines a few hundred ms apart see the same set rolling in.
//
// The heights are bumps on a flat sea (troughs at 0, crests up), so the water
// never dips under the sand plane beneath it; the strip's edges fade to flat
// where it meets the far sea (beachWaterMaterial in map-dressing.js).

import * as THREE from "three";

/* Where the strip lies: the shore (the seawall's sea face) and how far out. */
export const SURF = {
  shore: -21,       // z of the tideline
  depth: 40,        // metres out (z -21 .. -61)
  halfW: 86,        // x -86 .. 86 (past both bluffs: the map is wider east)
  y: 0.06,          // flat sea level (just proud of the sand under it)
  breakIn: 10,      // the break band, metres out: W0 sharpens and its lip foams
  breakOut: 16,
};

/* The swell, the long swell and two chops: direction (unit, +z is toward the
   shore), wavelength L m, period T s (each divides 120), amplitude A m. W0 is
   the rideable one: it shoals and sharpens in the break band, and a set
   envelope sends bigger waves through once a minute. */
export const WAVES = [
  { dir: [0.0, 1.0], L: 26, T: 8, A: 0.55 },
  { dir: [0.16, 0.987], L: 44, T: 12, A: 0.18 },
  { dir: [-0.6, 0.8], L: 9, T: 4.8, A: 0.07 },
  { dir: [0.707, 0.707], L: 5.5, T: 3, A: 0.035 },
];
export const SET_PERIOD = 60;

/* The sea's clock, the same on every client. */
export const SEA_CLOCK = () => (Date.now() % 120000) / 1000;

const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* How big the waves are at (x, metres out): nothing in the swash, building
   to the break, easing off further out, flat at the strip's edges. */
function envGeneral(x, dz) {
  return smooth(0.5, 6, dz) * (1 - smooth(32, SURF.depth, dz)) * (1 - smooth(SURF.halfW - 10, SURF.halfW, Math.abs(x)));
}
function envSwell(x, dz) {
  const shoal = smooth(1.5, SURF.breakIn, dz) * (1.3 - 0.65 * smooth(SURF.breakOut, 34, dz));
  return shoal * (1 - smooth(32, SURF.depth, dz)) * (1 - smooth(SURF.halfW - 10, SURF.halfW, Math.abs(x)));
}
/* How peaky W0 is: a rolling swell out back, a steep face in the break. */
function sharpness(dz) {
  return 1.2 + 2.6 * smooth(SURF.breakIn - 6, SURF.breakIn, dz) * (1 - smooth(SURF.breakOut, SURF.breakOut + 8, dz));
}
/* The set: bigger waves for a while, once a minute (0.55 .. 1). */
export function setEnv(t, x = 0) {
  return 0.55 + 0.45 * (0.5 + 0.5 * Math.sin((TAU * t) / SET_PERIOD + x * 0.015));
}

/* W0's phase at (x, z, t): crests where sin = 1. */
export function swellPhase(x, z, t) {
  const w = WAVES[0];
  return (TAU / w.L) * (w.dir[0] * x + w.dir[1] * z) - (TAU / w.T) * t;
}

/* The water's height above SURF.y at (x, z) at sea time t. */
export function seaHeight(x, z, t) {
  const dz = SURF.shore - z;
  if (dz < 0 || dz > SURF.depth || Math.abs(x) > SURF.halfW) return 0;
  const c0 = 0.5 + 0.5 * Math.sin(swellPhase(x, z, t));
  let h = WAVES[0].A * envSwell(x, dz) * setEnv(t, x) * Math.pow(c0, sharpness(dz));
  const g = envGeneral(x, dz);
  for (let k = 1; k < WAVES.length; k++) {
    const w = WAVES[k];
    const ph = (TAU / w.L) * (w.dir[0] * x + w.dir[1] * z) - (TAU / w.T) * t;
    h += w.A * g * (0.5 + 0.5 * Math.sin(ph));
  }
  return h;
}

/* The slope of the water (dh/dx, dh/dz), by central differences. */
export function seaSlope(x, z, t, out = { x: 0, z: 0 }) {
  const e = 0.1;
  out.x = (seaHeight(x + e, z, t) - seaHeight(x - e, z, t)) / (2 * e);
  out.z = (seaHeight(x, z + e, t) - seaHeight(x, z - e, t)) / (2 * e);
  return out;
}

/* The same functions in GLSL, written from the same table. */
function glslWaves() {
  const f = (n) => (Number.isInteger(n) ? `${n}.0` : `${n}`);
  const w0 = WAVES[0];
  const chops = WAVES.slice(1).map((w) =>
    `  h += ${f(w.A)} * g * (0.5 + 0.5 * sin(${f(TAU / w.L)} * dot(vec2(${f(w.dir[0])}, ${f(w.dir[1])}), p) - ${f(TAU / w.T)} * t));`).join("\n");
  return `
float surfSmooth(float a, float b, float x) { return smoothstep(a, b, x); }
float surfEnvG(float x, float dz) {
  return surfSmooth(0.5, 6.0, dz) * (1.0 - surfSmooth(32.0, ${f(SURF.depth)}, dz)) * (1.0 - surfSmooth(${f(SURF.halfW - 10)}, ${f(SURF.halfW)}, abs(x)));
}
float surfEnvS(float x, float dz) {
  float shoal = surfSmooth(1.5, ${f(SURF.breakIn)}, dz) * (1.3 - 0.65 * surfSmooth(${f(SURF.breakOut)}, 34.0, dz));
  return shoal * (1.0 - surfSmooth(32.0, ${f(SURF.depth)}, dz)) * (1.0 - surfSmooth(${f(SURF.halfW - 10)}, ${f(SURF.halfW)}, abs(x)));
}
float surfSharp(float dz) {
  return 1.2 + 2.6 * surfSmooth(${f(SURF.breakIn - 6)}, ${f(SURF.breakIn)}, dz) * (1.0 - surfSmooth(${f(SURF.breakOut)}, ${f(SURF.breakOut + 8)}, dz));
}
float surfSet(float t, float x) { return 0.55 + 0.45 * (0.5 + 0.5 * sin(${f(TAU / SET_PERIOD)} * t + x * 0.015)); }
float surfPhase(vec2 p, float t) { return ${f(TAU / w0.L)} * dot(vec2(${f(w0.dir[0])}, ${f(w0.dir[1])}), p) - ${f(TAU / w0.T)} * t; }
float surfHeight(vec2 p, float t) {
  float dz = ${f(SURF.shore)} - p.y;
  if (dz < 0.0 || dz > ${f(SURF.depth)} || abs(p.x) > ${f(SURF.halfW)}) return 0.0;
  float c0 = 0.5 + 0.5 * sin(surfPhase(p, t));
  float h = ${f(w0.A)} * surfEnvS(p.x, dz) * surfSet(t, p.x) * pow(c0, surfSharp(dz));
  float g = surfEnvG(p.x, dz);
${chops}
  return h;
}`;
}

/* The strip's material: displaced, normals from the height field, coloured
   like the far sea (shallows to deep), foam on the swash, on the breaking
   lip and on the whitewater rolling in behind it. The underside is a murky
   green, for a camera dipped under a crest. */
function surfMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0.25, side: THREE.DoubleSide });
  const WAVE = glslWaves();
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
uniform float uSeaT;
varying vec3 vSeaPos;
varying float vSeaH;
varying float vSeaSlope;
${WAVE}`)
      .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
{
  vec2 pp = (modelMatrix * vec4(position, 1.0)).xz;
  float e = 0.25;
  float hx = surfHeight(pp + vec2(e, 0.0), uSeaT) - surfHeight(pp - vec2(e, 0.0), uSeaT);
  float hz = surfHeight(pp + vec2(0.0, e), uSeaT) - surfHeight(pp - vec2(0.0, e), uSeaT);
  objectNormal = normalize(vec3(-hx / (2.0 * e), 1.0, -hz / (2.0 * e)));
  vSeaSlope = hz / (2.0 * e);
}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
{
  vec2 pp = (modelMatrix * vec4(position, 1.0)).xz;
  vSeaH = surfHeight(pp, uSeaT);
  transformed.y += vSeaH;
}`)
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvSeaPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uSeaT, uTime, uShore;
uniform vec3 uShallow, uDeep, uFoam, uUnder, uFace;
varying vec3 vSeaPos;
varying float vSeaH;
varying float vSeaSlope;
float sfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sfNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sfHash(i), sfHash(i + vec2(1, 0)), f.x), mix(sfHash(i + vec2(0, 1)), sfHash(i + vec2(1, 1)), f.x), f.y);
}
float sfPhase(vec2 p, float t) { return ${(TAU / WAVES[0].L).toFixed(6)} * dot(vec2(${WAVES[0].dir[0].toFixed(4)}, ${WAVES[0].dir[1].toFixed(4)}), p) - ${(TAU / WAVES[0].T).toFixed(6)} * t; }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
float seaDz = uShore - vSeaPos.z;
vec3 seaCol = mix(uShallow, uDeep, smoothstep(0.0, 28.0, seaDz));
seaCol = mix(vec3(0.78, 0.70, 0.52), seaCol, smoothstep(0.0, 2.2, seaDz));
// The swell's shape in the colour: the shoreward face is thin water with the
// low sun behind it (it glows green), the back and the trough sit darker.
float face = smoothstep(0.02, 0.22, -vSeaSlope) * smoothstep(0.05, 0.35, vSeaH);
float back = smoothstep(0.02, 0.2, vSeaSlope);
float trough = (1.0 - smoothstep(0.0, 0.25, vSeaH)) * smoothstep(4.0, 10.0, seaDz) * (1.0 - smoothstep(30.0, 40.0, seaDz));
seaCol = mix(seaCol, uFace, face * 0.75);
seaCol *= 1.0 - 0.18 * back - 0.16 * trough;
float t = uTime;
// the swash: a foam edge running up and back (as on the far sea)
float wash = 1.4 + 1.0 * sin(t * 0.55 + vSeaPos.x * 0.04) + 0.3 * sin(t * 1.3 + vSeaPos.x * 0.17);
float edge = smoothstep(0.55, 0.0, abs(seaDz - wash)) * (0.55 + 0.45 * sfNoise(vSeaPos.xz * vec2(0.9, 2.0) + t * 0.3));
float behind = smoothstep(wash + 0.2, wash - 0.6, seaDz) * 0.35;
// the swell's crest: c0 = 1 on it; the foam noise rides in with the wave
float c0 = 0.5 + 0.5 * sin(sfPhase(vSeaPos.xz, uSeaT));
float rideN = sfNoise(vec2(vSeaPos.x * 0.7, (vSeaPos.z - ${(WAVES[0].L / WAVES[0].T).toFixed(4)} * uSeaT) * 1.6));
float rideN2 = sfNoise(vec2(vSeaPos.x * 2.3, (vSeaPos.z - ${(WAVES[0].L / WAVES[0].T).toFixed(4)} * uSeaT) * 4.1));
float band = smoothstep(${(SURF.breakIn - 3).toFixed(1)}, ${SURF.breakIn.toFixed(1)}, seaDz) * (1.0 - smoothstep(${SURF.breakOut.toFixed(1)}, ${(SURF.breakOut + 4).toFixed(1)}, seaDz));
float lip = smoothstep(0.78, 0.97, c0) * band * smoothstep(0.1, 0.3, vSeaH);
// inside the break: the broken wave rolls in as whitewater, thinning out
float inside = smoothstep(1.5, 4.0, seaDz) * (1.0 - smoothstep(${(SURF.breakIn - 1).toFixed(1)}, ${(SURF.breakIn + 1).toFixed(1)}, seaDz));
// the broken wave's whitewater, thickest on its crest and front, trailing
// a soup of foam behind it
float white = (smoothstep(0.5, 0.92, c0) * 0.85 + 0.08) * inside * smoothstep(0.4, 0.7, rideN);
float streaks = smoothstep(0.66, 0.82, rideN2) * smoothstep(0.3, 0.7, c0) * (inside + band) * 0.35;
float foamAmt = clamp(edge + behind + lip * (0.6 + 0.4 * rideN2) + white + streaks, 0.0, 1.0) * step(0.0, seaDz);
diffuseColor.rgb = mix(seaCol, uFoam, foamAmt);
if (!gl_FrontFacing) diffuseColor.rgb = uUnder;`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.85, foamAmt);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
totalEmissiveRadiance += uFoam * foamAmt * 0.08 + uFace * face * (1.0 - foamAmt) * 0.22;`);
  };
  m.customProgramCacheKey = () => "troll-surf-sea";
  return m;
}

/* The strip: one mesh, one draw. Its own clock uniform runs off SEA_CLOCK;
   `detail` halves the segments (low graphics tier). */
export function buildSurfStrip({ shallow = 0x48c8c0, deep = 0x1d5f8f, foam = 0xf4fbfa, detail = 1 } = {}) {
  const uniforms = {
    uSeaT: { value: 0 },
    uTime: { value: 0 },
    uShore: { value: SURF.shore },
    uShallow: { value: new THREE.Color(shallow) },
    uDeep: { value: new THREE.Color(deep) },
    uFoam: { value: new THREE.Color(foam) },
    uUnder: { value: new THREE.Color(0x1c4a40) },
    uFace: { value: new THREE.Color(0x3fd6b0) },
  };
  const segX = Math.round(SURF.halfW * 4 * detail), segZ = Math.round(SURF.depth * 2 * detail);
  const geo = new THREE.PlaneGeometry(SURF.halfW * 2, SURF.depth, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, SURF.y, SURF.shore - SURF.depth / 2);
  // Bounds that hold the tallest crest, or the strip pops out of view.
  geo.computeBoundingBox();
  geo.boundingBox.max.y += 1.2;
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, surfMaterial(uniforms));
  mesh.name = "surf-strip";
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.onBeforeRender = () => {
    uniforms.uSeaT.value = SEA_CLOCK();
    uniforms.uTime.value = performance.now() / 1000;
  };
  mesh.userData.seaUniforms = uniforms;
  return mesh;
}
