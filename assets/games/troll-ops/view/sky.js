// The sky dome (map detail pass, phase 1; out of game.js for the stylised
// realism pass): the map's three-colour gradient, a band of haze on the
// horizon, the sun (a disc and its glow, off for indoor and night maps), and
// a layer of slow clouds lit from the sun's side. All one shader on the dome:
// no geometry, no lights. Clouds cost an fbm per pixel, so Graphics > Medium
// halves them and Low turns them off (uCloudQ). The colours are set from the
// map's sRGB hex, so they read as written. view/environment.js draws the same
// shader into the world reflection map.

import * as THREE from "three";
import { setRim } from "./rim-light.js?v=sr1";

export const SKY_UNIFORMS = () => ({
  uTop: { value: new THREE.Color(0x1a2e4a) },
  uHorizon: { value: new THREE.Color(0x6b8a5e) },
  uBottom: { value: new THREE.Color(0x2a3324) },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(0xffffff) },
  uSunSize: { value: 0.03 },      // disc radius, radians
  uSunGlow: { value: 0.0 },
  uHaze: { value: 0.0 },
  uCloud: { value: 0.0 },         // coverage 0..1
  uCloudQ: { value: 2 },          // 0 off, 1 cheap, 2 full
  uCloudColor: { value: new THREE.Color(0xffffff) },
  uCloudShade: { value: new THREE.Color(0x8090a0) },
  uTime: { value: 0 },
});

export const SKY_VERTEX = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SKY_FRAGMENT = /* glsl */`
  uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor, uCloudColor, uCloudShade;
  uniform float uSunSize, uSunGlow, uHaze, uCloud, uCloudQ, uTime;
  varying vec3 vDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5, t = 0.0;
    for (int i = 0; i < 5; i++) {
      if (float(i) >= 2.0 + uCloudQ * 1.5) break;
      v += a * noise(p);
      t += a;
      p = p * 2.03 + vec2(17.0, 9.0);
      a *= 0.5;
    }
    return v / t;   // 0..1 whatever the octave count, so coverage means the same on every tier
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 color = h > 0.0
      ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.75, h), 0.8))
      : mix(uHorizon, uBottom, smoothstep(0.0, -0.3, h));
    // haze: the horizon colour pulled up into the lowest few degrees
    color = mix(color, uHorizon, uHaze * exp(-abs(h) * 9.0));
    float c = max(dot(d, uSunDir), 0.0);
    // glow round the sun, wide and soft, then tight and hot
    color += uSunColor * uSunGlow * (0.18 * pow(c, 6.0) + 0.55 * pow(c, 90.0));
    if (uCloud > 0.0 && uCloudQ > 0.0 && h > 0.0) {
      vec2 p = d.xz / (h + 0.12) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
      float n = fbm(p);
      float cov = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.32, n) * smoothstep(0.0, 0.18, h);
      // lit edge toward the sun, shaded underside away from it
      float lit = 0.45 + 0.55 * smoothstep(0.35, 0.8, fbm(p + uSunDir.xz * 0.12));
      vec3 cloud = mix(uCloudShade, uCloudColor, lit) + uSunColor * uSunGlow * 0.35 * pow(c, 4.0);
      color = mix(color, cloud, cov * 0.92);
    }
    // the disc itself, in front of the clouds' thin edges
    float disc = smoothstep(cos(uSunSize), cos(uSunSize * 0.82), dot(d, uSunDir)) * step(0.001, uSunGlow);
    color = mix(color, uSunColor * 1.6 + 0.3, disc);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export const skyMat = new THREE.ShaderMaterial({
  uniforms: SKY_UNIFORMS(),
  vertexShader: SKY_VERTEX,
  fragmentShader: SKY_FRAGMENT,
  side: THREE.BackSide,
  fog: false,
  depthWrite: false,
});

export const sky = new THREE.Mesh(new THREE.SphereGeometry(250, 24, 16), skyMat);
// Drawn first and centred on the camera every frame (a skybox), so a map
// bigger than the dome (Trollface Island) never looks past its edge.
sky.renderOrder = -1;
sky.frustumCulled = false;
sky.onBeforeRender = () => {
  const now = performance.now() / 1000;
  skyMat.uniforms.uTime.value = now;
  if (meteors) updateMeteors(now);
};

/* The map's sky: gradient, sun disc and glow (a map without `sky.sun` has
   none: indoors, night), horizon haze, clouds. The disc sits where the sun
   light comes from. */
export function applySky(map) {
  const u = skyMat.uniforms, sk = map.sky;
  u.uTop.value.set(sk.top);
  u.uHorizon.value.set(sk.horizon);
  u.uBottom.value.set(sk.bottom);
  u.uSunDir.value.set(...map.sun.pos).normalize();
  u.uSunColor.value.set(sk.sunColor ?? map.sun.color);
  setRim(map.sun.color);   // the characters' rim light takes the sun's colour
  u.uSunGlow.value = sk.sun ?? 0;
  u.uSunSize.value = sk.sunSize ?? 0.03;
  u.uHaze.value = sk.haze ?? 0;
  u.uCloud.value = sk.clouds ?? 0;
  u.uCloudColor.value.set(sk.cloudColor ?? 0xffffff);
  u.uCloudShade.value.set(sk.cloudShade ?? 0x8a96a6);
  setStarField(!!map.stars);
}

/* Graphics tier: 0 no clouds, 1 cheap, 2 full. */
export function setSkyCloudQuality(q) { skyMat.uniforms.uCloudQ.value = q; }

/* Stars for a space sky: points just inside the dome, so they ride along
   with it (it follows the camera) and never get closer. A denser, tinted
   band across the sky reads as the Milky Way. */
let starField = null;
function setStarField(on) {
  if (!on) {
    if (starField) { sky.remove(starField); starField.geometry.dispose(); starField.material.dispose(); starField = null; }
    if (meteors) { sky.remove(meteors.mesh); meteors.mesh.geometry.dispose(); meteors.mesh.material.dispose(); meteors = null; }
    return;
  }
  if (starField) return;
  makeMeteors();
  const N = 5200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  let s = 0x5eed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < N; i++) {
    const band = i < N * 0.45;
    let x, y, z;
    do {
      x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1;
      if (band) y = y * 0.16 + x * 0.45;   // a tilted band
    } while (x * x + y * y + z * z > 1 || x * x + y * y + z * z < 0.05);
    const l = Math.hypot(x, y, z), r = 240;
    pos.set([x / l * r, y / l * r, z / l * r], i * 3);
    const b = 0.45 + rnd() * 0.55;
    const tint = rnd();
    col.set(tint < 0.12 ? [b, b * 0.8, b * 1.2] : tint < 0.22 ? [b * 1.15, b, b * 0.8] : [b, b, b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  starField = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, transparent: true, opacity: 0.95 }));
  starField.renderOrder = -1;
  sky.add(starField);
}

/* Shooting stars over a space sky (user, 2026-10-26: "we should also add
   shooting stars in the game"): a few at a time, one every few seconds, each
   a bright head with a fading tail sweeping a short arc across the upper
   sky, just inside the stars. Additive triangles on the dome, on the sky's
   own clock (performance.now), so they cost nothing to light. */
const METEORS = 3, METEOR_R = 235;
let meteors = null;
function makeMeteors() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(METEORS * 9), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(METEORS * 9), 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  sky.add(mesh);
  // staggered so the first comes soon after the map loads
  meteors = { mesh, list: Array.from({ length: METEORS }, (_, i) => ({ t0: -1, dur: 0, next: i * 2.5 + 0.5, a: new THREE.Vector3(), b: new THREE.Vector3() })) };
}
const _d = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3();
function updateMeteors(now) {
  const pos = meteors.mesh.geometry.attributes.position, col = meteors.mesh.geometry.attributes.color;
  meteors.list.forEach((m, i) => {
    if (m.next != null) { m.t0 = now + m.next; m.next = null; }   // the first: once the clock is known
    if (m.dur && now > m.t0 + m.dur) { m.t0 = now + 2 + Math.random() * 5; m.dur = 0; }   // gone: the next in 2-7 s
    if (!m.dur && now >= m.t0) {
      // a start high in the sky and a way across it, along the dome
      const az = Math.random() * Math.PI * 2, el = 0.35 + Math.random() * 0.75;
      m.a.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
      _s.set(Math.random() - 0.5, -0.35 - Math.random() * 0.4, Math.random() - 0.5);
      m.b.copy(_s).addScaledVector(m.a, -_s.dot(m.a)).normalize();   // tangent, heading down-sky
      m.dur = 0.9 + Math.random() * 0.7;
      m.sweep = 0.4 + Math.random() * 0.3;
    }
    const u = m.dur ? (now - m.t0) / m.dur : -1;
    for (let k = 0; k < 9; k++) { pos.array[i * 9 + k] = 0; col.array[i * 9 + k] = 0; }
    if (u < 0 || u > 1) return;
    const th = m.sweep * u, tail = Math.min(th, m.sweep * 0.5), fade = Math.sin(Math.PI * u);
    _d.copy(m.a).multiplyScalar(Math.cos(th)).addScaledVector(m.b, Math.sin(th));            // the head
    _t.copy(m.a).multiplyScalar(Math.cos(th - tail)).addScaledVector(m.b, Math.sin(th - tail));   // the tail's end
    const tb = _s.copy(m.b).multiplyScalar(Math.cos(th)).addScaledVector(m.a, -Math.sin(th));    // the way it goes
    const side = tb.cross(_d).normalize().multiplyScalar(1.4);
    const o = i * 9;
    pos.array.set([_d.x * METEOR_R + side.x, _d.y * METEOR_R + side.y, _d.z * METEOR_R + side.z,
      _d.x * METEOR_R - side.x, _d.y * METEOR_R - side.y, _d.z * METEOR_R - side.z,
      _t.x * METEOR_R, _t.y * METEOR_R, _t.z * METEOR_R], o);
    col.array.set([fade, fade * 0.97, fade * 0.9, fade, fade * 0.97, fade * 0.9, 0, 0, 0], o);
  });
  pos.needsUpdate = true;
  col.needsUpdate = true;
}
