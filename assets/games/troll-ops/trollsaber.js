// Troll Forces — the Trollsaber (gear.js MELEE_DEFS.trollsaber).
//
// Darth Vader's ESB/ROTJ hilt, no text on it (user calls, 2026-09-28).
// The hilt is a Blender build (models/build_trollsaber.blender.py ->
// trollsaber.glb) that streams in; a plain stand-in hilt holds its place
// until then. The blade is built here, live, because it has to ignite,
// flicker and leave a trail:
//
//  - a capsule "beam" drawn as an axial billboard: one quad strip along the
//    blade that always turns its face to the camera, shaded as the distance
//    to the blade's centre line (white-hot core, red falloff, soft halo), so
//    it reads as a rod of light from any side angle
//  - a solid white core rod for end-on views and the third-person body
//  - an additive halo sprite at the emitter
//
// The view model renders without bloom (its own pass), so the glow is all
// in the shader. Every instance animates itself in onBeforeRender (ignite
// and flicker), so the view model, remote players and the menu preview need
// no per-frame calls from game.js.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const TS_URL = new URL("./models/trollsaber.glb?v=ts1", import.meta.url).href;

export const SABER_BLADE_LEN = 0.88;
export const SABER_EMIT_Z = -0.142;   // inside the shroud (models/build_trollsaber)
const SABER_RED = new THREE.Color(1.0, 0.1, 0.045);
const IGNITE_TIME = 0.34;   // long enough to read as the blade extending
const RETRACT_TIME = 0.16;

// The game's ACES at 1.5 exposure blows Cycles-strength emission to white.
const TUNE = {
  TS_Button: { color: 0xc0181c, emissive: 0xff1a10, emissiveIntensity: 0.18 },
  TS_Amber:  { color: 0xd7801c, emissive: 0xff8a20, emissiveIntensity: 0.25 },
};

let template = null;
let loading = null;
let envMap = null;
const waiting = new Set();   // stand-in hilts to swap once the model lands

export function setSaberEnvMap(tex) { envMap = tex; }

export function preloadTrollsaber() {
  if (!loading) {
    loading = new GLTFLoader().loadAsync(TS_URL).then((gltf) => {
      template = prep(gltf.scene);
      for (const g of waiting) attachHilt(g);
      waiting.clear();
      return true;
    }).catch((e) => { console.warn("[trollsaber] model failed", e); return false; });
  }
  return loading;
}

function prep(scene) {
  scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.userData.shared = true;
      o.castShadow = false;
      o.receiveShadow = false;
    }
    const m = o.material;
    if (!m) return;
    const t = TUNE[m.name];
    if (t) {
      m.color = new THREE.Color(t.color);
      m.emissive = new THREE.Color(t.emissive);
      m.emissiveIntensity = t.emissiveIntensity;
    }
  });
  return scene;
}

/* ------------------------------------------------------------ blade beam */

const BEAM_HALF = 0.075;       // quad half-width: room for the halo
const beamGeoCache = new Map();

function beamGeometry(len) {
  if (beamGeoCache.has(len)) return beamGeoCache.get(len);
  const rows = 28;
  const along = [], side = [], pos = [], idx = [];
  for (let i = 0; i <= rows; i++) {
    const a = -BEAM_HALF + (len + BEAM_HALF * 2) * (i / rows);
    for (const s of [-1, 1]) {
      along.push(a);
      side.push(s);
      pos.push(0, 0, -a);
    }
    if (i < rows) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aAlong", new THREE.Float32BufferAttribute(along, 1));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  g.userData.shared = true;
  beamGeoCache.set(len, g);
  return g;
}

const BEAM_VERT = /* glsl */`
attribute float aAlong;
attribute float aSide;
uniform float uHalf;
varying vec2 vP;
void main() {
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, -aAlong, 1.0);
  vec3 axis = normalize((modelViewMatrix * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
  vec3 toCam = normalize(-mv.xyz);
  vec3 perp = cross(axis, toCam);
  float pl = length(perp);
  perp = pl > 1e-4 ? perp / pl : vec3(1.0, 0.0, 0.0);
  mv.xyz += perp * aSide * uHalf;
  vP = vec2(aSide * uHalf, aAlong);
  gl_Position = projectionMatrix * mv;
}`;

const BEAM_FRAG = /* glsl */`
uniform float uLen;
uniform float uGlow;
uniform float uCore;
uniform float uPower;
uniform vec3 uColor;
varying vec2 vP;
void main() {
  if (uLen < 0.002) discard;
  float a = vP.y;
  float d = length(vec2(vP.x, a - clamp(a, 0.0, uLen)));
  float core = 1.0 - smoothstep(uCore * 0.55, uCore, d);
  float glow = exp(-(d * d) / (uGlow * uGlow));
  float halo = exp(-d / (uGlow * 1.9)) * 0.3;
  // the halo fades out across the whole quad, so its edge never shows
  float edge = 1.0 - smoothstep(0.0, uHalfEdge, abs(vP.x));
  halo *= edge * edge;
  // a hotter band just outside the core, so the edge of the rod reads
  float rim = exp(-pow((d - uCore) / (uCore * 0.9), 2.0)) * 0.5;
  vec3 col = uColor * (glow * 1.35 + halo + rim) * uPower;
  col = mix(col, vec3(1.0, 0.93, 0.9), core);
  // Alpha only where it glows: an alpha of 1 across the whole quad showed as
  // a black box on the menu preview (its canvas is transparent).
  gl_FragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
}`.replace(/uHalfEdge/g, BEAM_HALF.toFixed(4));

function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLen: { value: 0 },
      uHalf: { value: BEAM_HALF },
      uGlow: { value: 0.017 },
      uCore: { value: 0.0058 },
      uPower: { value: 1 },
      uColor: { value: SABER_RED.clone() },
    },
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    premultipliedAlpha: true,   // add the colour as is (ONE, ONE); alpha adds too
    side: THREE.DoubleSide,
  });
}

let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.2, "rgba(255,255,255,0.5)");
  r.addColorStop(0.55, "rgba(255,255,255,0.1)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

/* Deterministic-ish flicker: a couple of incommensurate sines plus a small
   jitter, around 1. Real sabers in the films pulse, they don't strobe. */
function flicker(t, seed) {
  return 1 + 0.045 * Math.sin(t * 31 + seed) + 0.03 * Math.sin(t * 73.7 + seed * 2.1) + (Math.random() - 0.5) * 0.035;
}

/* ------------------------------------------------------------ the weapon */

function standInHilt() {
  const g = new THREE.Group();
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc8cdd2, roughness: 0.2, metalness: 1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.7, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.154, 20), black);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.053;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0175, 0.0175, 0.108, 20), chrome);
  head.rotation.x = Math.PI / 2;
  head.position.z = -0.078;
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.0226, 0.0226, 0.04, 20), black);
  hood.rotation.x = Math.PI / 2;
  hood.position.z = -0.152;
  g.add(hood);
  g.add(body, head);
  g.userData.standIn = true;
  return g;
}

function attachHilt(group) {
  const holder = group.userData.saber?.hiltHolder;
  if (!holder || !template) return;
  for (const c of [...holder.children]) {
    holder.remove(c);
    c.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }
  const src = template.clone(true);
  src.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    if (envMap && o.material.isMeshStandardMaterial) {
      o.material.envMap = envMap;
      o.material.envMapIntensity = o.material.metalness > 0.5 ? 1.15 : 0.5;
    }
    o.castShadow = group.userData.saber.castShadow;
  });
  holder.add(src);
}

/* The saber, grip at the origin, blade down -Z (the melee convention).
   Hand anchors are handed back so gear.js can put its hands on. Options:
   `lit`: start ignited (menus, remote players) instead of off. */
export function buildTrollsaber({ lit = true, castShadow = false } = {}) {
  const group = new THREE.Group();
  const hiltHolder = new THREE.Group();
  group.add(hiltHolder);

  const beamMat = beamMaterial();
  const beam = new THREE.Mesh(beamGeometry(SABER_BLADE_LEN), beamMat);
  beam.position.z = SABER_EMIT_Z;
  beam.frustumCulled = false;
  beam.renderOrder = 5;

  const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff1ec, toneMapped: false });
  const coreGeo = new THREE.CylinderGeometry(0.0046, 0.0046, 1, 12, 1, false);
  coreGeo.translate(0, 0.5, 0);
  coreGeo.rotateX(-Math.PI / 2);          // grows along -Z from its origin
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.z = SABER_EMIT_Z;
  core.renderOrder = 4;

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: SABER_RED, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, opacity: 0.55,
  }));
  halo.position.z = SABER_EMIT_Z - 0.01;
  halo.scale.setScalar(0.13);
  halo.renderOrder = 6;

  group.add(core, beam, halo);

  const saber = {
    hiltHolder, beam, core, halo, castShadow,
    frac: lit ? 1 : 0,        // how much blade is out, 0..1
    target: lit ? 1 : 0,
    power: 1,                 // extra brightness (clash flare), decays to 1
    seed: Math.random() * 100,
    last: performance.now(),
    ignite() { this.target = 1; },
    retract() { this.target = 0; },
    snapOff() { this.target = this.frac = 0; },
    flare(amount = 1) { this.power = Math.max(this.power, 1 + amount); },
    // world-space blade root/tip, for the trail and deflect sparks
    tipLocal: new THREE.Vector3(0, 0, SABER_EMIT_Z - SABER_BLADE_LEN),
    rootLocal: new THREE.Vector3(0, 0, SABER_EMIT_Z),
    get lit() { return this.frac > 0.02; },
  };
  group.userData.saber = saber;

  // Self-animating: ignite/retract with a small overshoot, flicker, flare.
  beam.onBeforeRender = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - saber.last) / 1000);
    saber.last = now;
    if (saber.frac < saber.target) saber.frac = Math.min(saber.target, saber.frac + dt / IGNITE_TIME);
    else if (saber.frac > saber.target) saber.frac = Math.max(saber.target, saber.frac - dt / RETRACT_TIME);
    saber.power = 1 + (saber.power - 1) * Math.exp(-dt * 7);
    // ease-out on the way up: the blade snaps out and settles
    const f = saber.frac;
    const shown = saber.target > 0 ? 1 - Math.pow(1 - f, 3) : f * f;
    const len = SABER_BLADE_LEN * shown;
    const fl = flicker(now / 1000, saber.seed) * saber.power;
    const u = beamMat.uniforms;
    u.uLen.value = len;
    u.uPower.value = fl;
    u.uGlow.value = 0.017 * (0.9 + 0.1 * fl) * Math.min(1.25, 1 + (saber.power - 1) * 0.25);
    core.visible = len > 0.004;
    core.scale.set(1, 1, Math.max(0.001, len));
    // the emitter glows a little even as the blade leaves it
    halo.material.opacity = 0.18 + 0.4 * Math.min(1, shown * 1.5) * Math.min(1.6, fl);
    halo.scale.setScalar(0.1 + 0.05 * shown * fl);
  };
  // The core renders first in the frame; keep it in step when the beam's
  // callback hasn't run yet (first frame of a fresh instance).
  core.scale.set(1, 1, Math.max(0.001, SABER_BLADE_LEN * saber.frac));
  core.visible = saber.frac > 0.01;

  if (template) attachHilt(group);
  else {
    hiltHolder.add(standInHilt());
    waiting.add(group);
    preloadTrollsaber();
  }

  return group;
}

/* ------------------------------------------------------------ swing trail */

/* A fading ribbon behind the blade while it swings: a ring buffer of
   (root, tip) pairs in the parent's space, each pair aging out over
   `life` seconds. Brightest at the tip, where the blade is fastest. */
export class SaberTrail {
  constructor(parent, { samples = 22, life = 0.11 } = {}) {
    this.n = samples;
    this.life = life;
    this.pts = [];            // { r: Vector3, t: Vector3, at: seconds }
    const verts = samples * 2;
    this.pos = new Float32Array(verts * 3);
    this.fade = new Float32Array(verts);
    this.edge = new Float32Array(verts);
    const idx = [];
    for (let i = 0; i < samples - 1; i++) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aFade", new THREE.BufferAttribute(this.fade, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aEdge", new THREE.BufferAttribute(this.edge, 1));
    g.setIndex(idx);
    for (let i = 0; i < samples; i++) { this.edge[i * 2] = 0; this.edge[i * 2 + 1] = 1; }
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { uColor: { value: SABER_RED.clone() } },
      vertexShader: /* glsl */`
        attribute float aFade; attribute float aEdge;
        varying float vFade; varying float vEdge;
        void main() { vFade = aFade; vEdge = aEdge;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; varying float vFade; varying float vEdge;
        void main() {
          float k = vFade * vFade * vEdge * vEdge;
          vec3 c = uColor * k * 0.85 + vec3(1.0, 0.85, 0.8) * pow(vFade, 5.0) * pow(vEdge, 6.0) * 0.4;
          gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0));
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  /* Record where the blade is now (points in the trail parent's space). */
  push(root, tip, now) {
    const last = this.pts[this.pts.length - 1];
    if (last && last.t.distanceToSquared(tip) < 1e-6) { last.at = now; return; }
    this.pts.push({ r: root.clone(), t: tip.clone(), at: now });
    if (this.pts.length > this.n) this.pts.shift();
  }

  clear() { this.pts.length = 0; this.mesh.visible = false; }

  update(now) {
    while (this.pts.length && now - this.pts[0].at > this.life) this.pts.shift();
    const m = this.pts.length;
    this.mesh.visible = m >= 2;
    if (m < 2) return;
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[Math.min(i, m - 1)];
      const f = i < m ? Math.max(0, 1 - (now - p.at) / this.life) : 0;
      // root end sits halfway up the blade: the smear is the fast outer half
      const r = p.r.clone().lerp(p.t, 0.5);
      this.pos.set([r.x, r.y, r.z], i * 6);
      this.pos.set([p.t.x, p.t.y, p.t.z], i * 6 + 3);
      this.fade[i * 2] = this.fade[i * 2 + 1] = f;
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aFade.needsUpdate = true;
    g.setDrawRange(0, (m - 1) * 6);
  }
}
