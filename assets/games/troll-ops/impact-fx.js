// Troll Ops — what a bullet leaves behind where it lands.
//
// Hits used to throw additive round point sprites: on a wall at any range
// they stacked into a glowing white disc that read as a projection, not a
// strike. A bullet hitting concrete throws dark chips and a little dust, so
// that's what this draws:
//   chips — small opaque flecks, jagged, coloured by what was hit, falling
//           under gravity and landing;
//   dust  — a few soft, ragged puffs, normal-blended (never additive), that
//           billow off the surface and thin out;
//   sparks — the old additive sparks, kept for explosions and the gunship's
//           chin gun, where a glow is the point. Coloured per particle, so a
//           new burst no longer recolours every spark already in the air.

import * as THREE from "three";

const CHIP_MAX = 360;
const DUST_MAX = 96;
const SPARK_MAX = 240;

/* Pixels per metre at distance 1 for the current camera and canvas, so
   particles are sized in world units and shrink properly with range. */
const _size = new THREE.Vector2();
function pxPerMetre(camera, renderer) {
  renderer.getDrawingBufferSize(_size);
  return _size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}

function pool(max, material) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3).fill(-1000);
  const col = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const size = new Float32Array(max);
  const seed = new Float32Array(max).map(() => Math.random());
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aLife", new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  return {
    points, geo, pos, col, life, size, max, cursor: 0,
    p: Array.from({ length: max }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, T: 1, s0: 0, s1: 0, rest: 0 })),
  };
}

const VERT = /* glsl */`
  attribute vec3 aColor;
  attribute float aLife;
  attribute float aSize;
  attribute float aSeed;
  uniform float uPx;
  uniform float uMaxPx;
  varying vec3 vColor;
  varying float vLife;
  varying float vSeed;
  void main() {
    vColor = aColor; vLife = aLife; vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aLife <= 0.0 ? 0.0 : min(uMaxPx, aSize * uPx / max(0.25, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

function chipMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 600 }, uMaxPx: { value: 10 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vLife; varying float vSeed;
      void main() {
        // A turned, lopsided quad with one corner knocked off: a fleck of
        // grit, never a dot.
        float a = vSeed * 6.2831;
        vec2 c = gl_PointCoord - 0.5;
        c = mat2(cos(a), -sin(a), sin(a), cos(a)) * c;
        c.x *= 1.0 + vSeed * 0.8;
        if (max(abs(c.x), abs(c.y)) > 0.36 || c.x + c.y > 0.42 - vSeed * 0.2) discard;
        float shade = 0.75 + 0.25 * step(0.0, c.y);
        gl_FragColor = vec4(vColor * shade, 1.0);
      }
    `,
  });
}

function dustMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 600 }, uMaxPx: { value: 140 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vLife; varying float vSeed;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + vSeed * 91.7) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        // Ragged, lumpy edge and a mottled body, so it reads as a puff of
        // grit rather than a clean disc.
        float n = noise(c * 5.0 + vSeed * 13.0) * 0.6 + noise(c * 11.0 - vSeed * 7.0) * 0.4;
        float r = length(c) * 2.0 + (n - 0.5) * 0.55;
        float body = smoothstep(1.0, 0.35, r);
        float a = body * (0.55 + n * 0.45) * vLife;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * (0.85 + n * 0.25), a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

function sparkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 600 }, uMaxPx: { value: 18 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vLife;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        gl_FragColor = vec4(vColor, smoothstep(1.0, 0.0, d) * vLife);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

const _c = new THREE.Color();
const _n = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();

function emit(P, n, fill) {
  for (let i = 0; i < n; i++) {
    const idx = P.cursor++ % P.max;
    const q = P.p[idx];
    q.alive = true; q.t = 0; q.rest = 0;
    fill(q, idx, i);
    P.col[idx * 3] = _c.r; P.col[idx * 3 + 1] = _c.g; P.col[idx * 3 + 2] = _c.b;
  }
  P.geo.attributes.aColor.needsUpdate = true;
}

/* Surface tones. Chips are the broken material, a shade darker than the
   face; dust is the pale powder it grinds into. */
export const SURFACE = {
  concrete: { chip: 0x55574f, dust: 0xb9b6a8 },
  ground:   { chip: 0x4a4436, dust: 0xa89c80 },
  wood:     { chip: 0x6b4a2c, dust: 0xc2a882 },
  ink:      { chip: 0x0b0b0b, dust: 0x3a3a3a },   // the troll operators
  grunt:    { chip: 0x3a1410, dust: 0x6e4a40 },
  zombie:   { chip: 0x3f5a26, dust: 0x7c8a5e },
  smoke:    { chip: 0x000000, dust: 0x9a9a92 },
};

export class ImpactFx {
  constructor(scene) {
    this.chips = pool(CHIP_MAX, chipMaterial());
    this.dust = pool(DUST_MAX, dustMaterial());
    this.sparks = pool(SPARK_MAX, sparkMaterial());
    // Dust after chips: it's transparent and should sit over them.
    this.dust.points.renderOrder = 2;
    scene.add(this.chips.points, this.dust.points, this.sparks.points);
  }

  /* A round striking something. `normal` is the face it hit (defaults to
     up); `dir` is the round's travel, which the debris partly carries on
     through. `surface` picks the tones (see SURFACE); `scale` < 1 for a
     lighter cosmetic strike. */
  hit(point, { normal = null, dir = null, surface = "concrete", scale = 1 } = {}) {
    const S = SURFACE[surface] || SURFACE.concrete;
    _n.copy(normal || THREE.Object3D.DEFAULT_UP).normalize();
    // Two tangents, to scatter debris across the face.
    _t1.set(1, 0, 0);
    if (Math.abs(_n.x) > 0.9) _t1.set(0, 0, 1);
    _t1.cross(_n).normalize();
    _t2.crossVectors(_n, _t1);
    // Debris kicks out of the face, and back toward the shooter.
    const back = dir ? -0.35 : 0;

    const chipN = Math.round((4 + Math.random() * 3) * scale);
    _c.setHex(S.chip);
    emit(this.chips, chipN, (q) => {
      const out = 1.6 + Math.random() * 2.6;
      const a = Math.random() * Math.PI * 2, spread = Math.random() * 1.6;
      q.x = point.x + _n.x * 0.02; q.y = point.y + _n.y * 0.02; q.z = point.z + _n.z * 0.02;
      q.vx = _n.x * out + (_t1.x * Math.cos(a) + _t2.x * Math.sin(a)) * spread + (dir ? dir.x * back * out : 0);
      q.vy = _n.y * out + (_t1.y * Math.cos(a) + _t2.y * Math.sin(a)) * spread + 0.8 + (dir ? dir.y * back * out : 0);
      q.vz = _n.z * out + (_t1.z * Math.cos(a) + _t2.z * Math.sin(a)) * spread + (dir ? dir.z * back * out : 0);
      q.T = 0.55 + Math.random() * 0.5;
      q.s0 = q.s1 = 0.018 + Math.random() * 0.022;
      q.grav = 9.8;
      // Flecks off a floor lie on it; flecks off a wall fall to the ground.
      q.floor = _n.y > 0.5 ? point.y + 0.01 : 0.01;
    });

    const dustN = Math.max(1, Math.round((2 + Math.random() * 2) * scale));
    _c.setHex(S.dust);
    emit(this.dust, dustN, (q, idx, i) => {
      const out = 0.5 + Math.random() * 0.7;
      const a = Math.random() * Math.PI * 2, spread = 0.25 + Math.random() * 0.3;
      q.x = point.x + _n.x * 0.04; q.y = point.y + _n.y * 0.04; q.z = point.z + _n.z * 0.04;
      q.vx = _n.x * out + (_t1.x * Math.cos(a) + _t2.x * Math.sin(a)) * spread;
      q.vy = _n.y * out + (_t1.y * Math.cos(a) + _t2.y * Math.sin(a)) * spread + 0.15;
      q.vz = _n.z * out + (_t1.z * Math.cos(a) + _t2.z * Math.sin(a)) * spread;
      q.T = 0.7 + Math.random() * 0.5 + i * 0.1;
      q.s0 = (0.07 + Math.random() * 0.05) * (0.7 + scale * 0.3);
      q.s1 = q.s0 * (3 + Math.random() * 1.5);
      q.grav = -0.25;       // warm grit hangs, then drifts up a touch
      q.drag = 3.2;
      q.alpha = 0.45;
    });
  }

  /* A short grey puff at a muzzle: gun smoke, read at a distance as "fired
     from here" without a glow. */
  puff(point, dir, strength = 1) {
    _c.setHex(SURFACE.smoke.dust);
    emit(this.dust, 2, (q, idx, i) => {
      q.x = point.x; q.y = point.y; q.z = point.z;
      const sp = (0.6 + i * 0.5) * strength;
      q.vx = (dir?.x || 0) * sp + (Math.random() - 0.5) * 0.3;
      q.vy = (dir?.y || 0) * sp + 0.2;
      q.vz = (dir?.z || 0) * sp + (Math.random() - 0.5) * 0.3;
      q.T = 0.45 + Math.random() * 0.25;
      q.s0 = 0.06; q.s1 = 0.26 + Math.random() * 0.1;
      q.grav = -0.4; q.drag = 3.5; q.alpha = 0.28;
    });
  }

  /* The old additive burst, for blasts and anything meant to glow. */
  sparksAt(pos, color, count = 10) {
    _c.setHex(color);
    emit(this.sparks, count, (q) => {
      q.x = pos.x; q.y = pos.y; q.z = pos.z;
      q.vx = (Math.random() - 0.5) * 4; q.vy = Math.random() * 3 + 1; q.vz = (Math.random() - 0.5) * 4;
      q.T = 0.4; q.s0 = 0.06; q.s1 = 0.005; q.grav = 9.8;
    });
  }

  update(dt, camera, renderer) {
    const px = pxPerMetre(camera, renderer);
    for (const P of [this.chips, this.dust, this.sparks]) {
      P.points.material.uniforms.uPx.value = px;
      const pos = P.pos, life = P.geo.attributes.aLife.array, size = P.geo.attributes.aSize.array;
      for (let i = 0; i < P.max; i++) {
        const q = P.p[i];
        if (!q.alive) { life[i] = 0; continue; }
        q.t += dt;
        if (q.t >= q.T) { q.alive = false; life[i] = 0; pos[i * 3 + 1] = -1000; continue; }
        const k = q.t / q.T;
        if (q.drag) {
          const d = Math.max(0, 1 - q.drag * dt);
          q.vx *= d; q.vy *= d; q.vz *= d;
        }
        q.vy -= (q.grav ?? 9.8) * dt;
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        // Chips land and lie there for the rest of their life.
        if (P === this.chips && q.y < q.floor) { q.y = q.floor; q.vx *= 0.3; q.vz *= 0.3; q.vy = 0; }
        pos[i * 3] = q.x; pos[i * 3 + 1] = q.y; pos[i * 3 + 2] = q.z;
        // Chips stay solid and shrink away at the very end; dust fades from
        // the start; sparks fade linearly.
        life[i] = P === this.chips ? (k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2)
          : P === this.dust ? (q.alpha ?? 0.4) * Math.min(1, k * 8) * (1 - k)
          : 1 - k;
        size[i] = P === this.chips ? q.s0 * Math.max(0.05, life[i])
          : q.s0 + (q.s1 - q.s0) * (P === this.dust ? 1 - (1 - k) * (1 - k) : k);
      }
      P.geo.attributes.position.needsUpdate = true;
      P.geo.attributes.aLife.needsUpdate = true;
      P.geo.attributes.aSize.needsUpdate = true;
    }
  }

  clear() {
    for (const P of [this.chips, this.dust, this.sparks]) {
      for (const q of P.p) q.alive = false;
    }
  }
}
