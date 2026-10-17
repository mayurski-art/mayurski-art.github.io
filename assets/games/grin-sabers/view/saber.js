// Grin Sabers — the saber: an original troll hilt plus a glowing blade.
//
// The blade is the Troll Forces Trollsaber's (troll-ops/weapons/trollsaber.js):
// a camera-facing quad strip shaded by distance to the blade's centre line,
// white-hot core, coloured falloff, soft halo, plus a solid core rod for
// end-on views. It's copied here, not imported, because that module also
// streams in the Vader-style hilt we don't use (design decision 3: original
// hilts only), and here every blade has its own colour.
//
// Grip at the origin, blade down -Z.

import * as THREE from "three";

export const BLADE_LEN = 0.9;
export const EMIT_Z = -0.13;
const IGNITE_TIME = 0.34;
const RETRACT_TIME = 0.2;
const BEAM_HALF = 0.075;

export const BLADE_COLOURS = [
  { id: "blue", name: "Blue", hex: "#3fa9ff" },
  { id: "green", name: "Green", hex: "#3dff6e" },
  { id: "purple", name: "Purple", hex: "#b25cff" },
  { id: "yellow", name: "Yellow", hex: "#ffd23a" },
  { id: "red", name: "Red", hex: "#ff2a1a" },
  { id: "white", name: "White", hex: "#e8f4ff" },
];

const beamGeoCache = new Map();
function beamGeometry(len) {
  if (beamGeoCache.has(len)) return beamGeoCache.get(len);
  const rows = 28, along = [], side = [], pos = [], idx = [];
  for (let i = 0; i <= rows; i++) {
    const a = -BEAM_HALF + (len + BEAM_HALF * 2) * (i / rows);
    for (const s of [-1, 1]) { along.push(a); side.push(s); pos.push(0, 0, -a); }
    if (i < rows) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aAlong", new THREE.Float32BufferAttribute(along, 1));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
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
  float edge = 1.0 - smoothstep(0.0, ${BEAM_HALF.toFixed(4)}, abs(vP.x));
  halo *= edge * edge;
  float rim = exp(-pow((d - uCore) / (uCore * 0.9), 2.0)) * 0.5;
  vec3 col = uColor * (glow * 1.35 + halo + rim) * uPower;
  col = mix(col, vec3(1.0, 0.96, 0.94), core);
  gl_FragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
}`;

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

function flicker(t, seed) {
  return 1 + 0.045 * Math.sin(t * 31 + seed) + 0.03 * Math.sin(t * 73.7 + seed * 2.1) + (Math.random() - 0.5) * 0.035;
}

/* The Grin hilt: brushed steel body, black ridged grip, a gold emitter
   shroud with a notched crown, and a $TROLL coin set in the pommel.
   Original design (no film prop). */
const HILT_MATS = {
  steel: new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.28, metalness: 1 }),
  black: new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.75, metalness: 0.2 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.32, metalness: 1 }),
};
let _coinTex = null;
function coinTexture() {
  if (_coinTex) return _coinTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#d9a441"; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#7a5414"; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#5c3d0b"; g.font = "bold 46px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("$T", 64, 68);
  _coinTex = new THREE.CanvasTexture(c);
  _coinTex.colorSpace = THREE.SRGBColorSpace;
  return _coinTex;
}
function cyl(r0, r1, len, mat, z, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, seg), mat);
  m.rotation.x = Math.PI / 2;
  m.position.z = z;
  m.castShadow = true;
  return m;
}
function buildHilt() {
  const g = new THREE.Group();
  // body: z from +0.12 (pommel) to -0.13 (emitter)
  g.add(cyl(0.018, 0.018, 0.12, HILT_MATS.black, 0.04));          // grip
  for (let i = 0; i < 6; i++) g.add(cyl(0.0205, 0.0205, 0.006, HILT_MATS.black, -0.012 + i * 0.019, 16));   // ridges
  g.add(cyl(0.0175, 0.0175, 0.07, HILT_MATS.steel, -0.055));       // upper body
  g.add(cyl(0.024, 0.019, 0.045, HILT_MATS.gold, -0.108));         // emitter shroud
  g.add(cyl(0.021, 0.021, 0.022, HILT_MATS.steel, 0.112));          // pommel ring
  const coin = new THREE.Mesh(new THREE.CircleGeometry(0.019, 24), new THREE.MeshStandardMaterial({ map: coinTexture(), roughness: 0.35, metalness: 0.9 }));
  coin.position.z = 0.1235;
  g.add(coin);
  // the crown notches round the emitter
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.016), HILT_MATS.gold);
    t.position.set(Math.cos(a) * 0.022, Math.sin(a) * 0.022, -0.134);
    g.add(t);
  }
  // activation button
  const btn = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.007, 0.016), new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff2010, emissiveIntensity: 0.6 }));
  btn.position.set(0, 0.019, -0.06);
  g.add(btn);
  return g;
}

/* The whole saber. `light`: a PointLight the blade drives (its colour and
   strength), so the blade lights the ground and the fighter's body. */
export function buildSaber(colourHex = "#3fa9ff", { light = null } = {}) {
  const color = new THREE.Color(colourHex);
  const group = new THREE.Group();
  group.add(buildHilt());

  const beamMat = new THREE.ShaderMaterial({
    uniforms: {
      uLen: { value: 0 }, uHalf: { value: BEAM_HALF }, uGlow: { value: 0.019 },
      uCore: { value: 0.0062 }, uPower: { value: 1 }, uColor: { value: color.clone() },
    },
    vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeometry(BLADE_LEN), beamMat);
  beam.position.z = EMIT_Z;
  beam.frustumCulled = false;
  beam.renderOrder = 5;

  const coreGeo = new THREE.CylinderGeometry(0.0062, 0.0062, 1, 12, 1, false);
  coreGeo.translate(0, 0.5, 0);
  coreGeo.rotateX(-Math.PI / 2);
  const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  core.position.z = EMIT_Z;
  core.renderOrder = 4;

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
  halo.position.z = EMIT_Z - 0.01;
  halo.scale.setScalar(0.14);
  halo.renderOrder = 6;
  group.add(core, beam, halo);

  if (light) { light.color.copy(color); group.add(light); light.position.set(0, 0, EMIT_Z - BLADE_LEN * 0.6); }

  const saber = {
    group, beam, core, halo, light, color,
    frac: 0, target: 0, power: 1, seed: Math.random() * 100,
    igniteTime: IGNITE_TIME, retractTime: RETRACT_TIME,
    ignite(time = IGNITE_TIME) { this.target = 1; this.igniteTime = time; },
    retract(time = RETRACT_TIME) { this.target = 0; this.retractTime = time; },
    flare(amount = 1) { this.power = Math.max(this.power, 1 + amount); },
    setColour(hex) { this.color.set(hex); beamMat.uniforms.uColor.value.copy(this.color); halo.material.color.copy(this.color); if (this.light) this.light.color.copy(this.color); },
    get lit() { return this.frac > 0.05; },
    get length() { return BLADE_LEN * this.shown; },
    shown: 0,
    /* Advance ignite/flicker. Called once a frame by the owner. */
    update(dt, now) {
      if (this.frac < this.target) this.frac = Math.min(this.target, this.frac + dt / this.igniteTime);
      else if (this.frac > this.target) this.frac = Math.max(this.target, this.frac - dt / this.retractTime);
      this.power = 1 + (this.power - 1) * Math.exp(-dt * 7);
      const f = this.frac;
      this.shown = this.target > 0 ? 1 - Math.pow(1 - f, 3) : f * f;
      const len = BLADE_LEN * this.shown;
      const fl = flicker(now, this.seed) * this.power;
      const u = beamMat.uniforms;
      u.uLen.value = len;
      u.uPower.value = fl;
      u.uGlow.value = 0.019 * (0.9 + 0.1 * fl) * Math.min(1.35, 1 + (this.power - 1) * 0.3);
      core.visible = len > 0.004;
      core.scale.set(1, 1, Math.max(0.001, len));
      halo.material.opacity = 0.18 + 0.4 * Math.min(1, this.shown * 1.5) * Math.min(1.6, fl);
      halo.scale.setScalar(0.1 + 0.05 * this.shown * fl);
      if (this.light) this.light.intensity = 0.8 * this.shown * Math.min(2.5, fl);
    },
  };
  group.userData.saber = saber;
  return saber;
}

/* A fading ribbon behind the blade while it swings (Trollsaber's trail),
   in world space. */
export class SaberTrail {
  constructor(scene, colourHex, { samples = 22, life = 0.12 } = {}) {
    this.n = samples;
    this.life = life;
    this.pts = [];
    const verts = samples * 2;
    this.pos = new Float32Array(verts * 3);
    this.fade = new Float32Array(verts);
    const edge = new Float32Array(verts);
    const idx = [];
    for (let i = 0; i < samples - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    for (let i = 0; i < samples; i++) { edge[i * 2] = 0; edge[i * 2 + 1] = 1; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aFade", new THREE.BufferAttribute(this.fade, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aEdge", new THREE.BufferAttribute(edge, 1));
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(colourHex) } },
      vertexShader: /* glsl */`
        attribute float aFade; attribute float aEdge;
        varying float vFade; varying float vEdge;
        void main() { vFade = aFade; vEdge = aEdge; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; varying float vFade; varying float vEdge;
        void main() {
          float k = vFade * vFade * vEdge * vEdge;
          vec3 c = uColor * k * 0.9 + vec3(1.0) * pow(vFade, 5.0) * pow(vEdge, 6.0) * 0.4;
          gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0));
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  setColour(hex) { this.mat.uniforms.uColor.value.set(hex); }

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
      const r = p.r.clone().lerp(p.t, 0.45);
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

/* Sparks: a small pool of additive points flung from a contact. */
export class Sparks {
  constructor(scene, max = 160) {
    this.max = max;
    this.p = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.05, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
    scene.add(this.points);
  }

  burst(at, colourHex, n = 24, speed = 3.5) {
    const c = new THREE.Color(colourHex);
    for (let i = 0; i < n; i++) {
      if (this.p.length >= this.max) this.p.shift();
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 - 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      const white = Math.random() < 0.45;
      this.p.push({ x: at.x, y: at.y, z: at.z, v, life: 0.25 + Math.random() * 0.35, age: 0, c: white ? new THREE.Color(1, 0.95, 0.85) : c });
    }
  }

  update(dt) {
    let k = 0;
    for (let i = this.p.length - 1; i >= 0; i--) {
      const s = this.p[i];
      s.age += dt;
      if (s.age >= s.life) { this.p.splice(i, 1); continue; }
      s.v.y -= 9 * dt;
      s.x += s.v.x * dt; s.y += s.v.y * dt; s.z += s.v.z * dt;
      if (s.y < 0.01) { s.y = 0.01; s.v.y *= -0.3; s.v.x *= 0.6; s.v.z *= 0.6; }
    }
    for (const s of this.p) {
      const f = 1 - s.age / s.life;
      this.pos[k * 3] = s.x; this.pos[k * 3 + 1] = s.y; this.pos[k * 3 + 2] = s.z;
      this.col[k * 3] = s.c.r * f * 2; this.col[k * 3 + 1] = s.c.g * f * 2; this.col[k * 3 + 2] = s.c.b * f * 2;
      k++;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, k);
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }
}
