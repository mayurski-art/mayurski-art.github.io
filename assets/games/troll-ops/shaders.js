// Troll Ops — custom GLSL: impact screen shader (chromatic aberration + vignette + damage flash),
// muzzle flash sprite material, tracer material, ground/skybox shaders.
import * as THREE from "three";

export const ImpactShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uHitFlash: { value: 0 },      // 0..1, pulses red on taking damage
    uAberration: { value: 0 },    // 0..1, spikes on heavy recoil / explosions
    uVignette: { value: 0.35 },
    uLowHp: { value: 0 },         // 0..1, red pulse when low health
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uHitFlash;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uLowHp;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec2 center = vec2(0.5);
      vec2 dir = uv - center;
      float dist = length(dir);

      float ab = uAberration * 0.006;
      float r = texture2D(tDiffuse, uv + dir * ab).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - dir * ab).b;
      vec3 color = vec3(r, g, b);

      float vig = smoothstep(0.35, 1.0, dist) * uVignette;
      color *= 1.0 - vig;

      color = mix(color, vec3(0.9, 0.05, 0.05), uHitFlash * 0.35 * (1.0 - dist * 0.4));

      float lowPulse = (sin(uTime * 5.0) * 0.5 + 0.5) * uLowHp;
      float lowVig = smoothstep(0.25, 0.95, dist);
      color = mix(color, vec3(0.5, 0.0, 0.0), lowVig * lowPulse * 0.5);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function makeMuzzleFlashMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uColor: { value: new THREE.Color(0xfff2c0) } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uIntensity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec2 c = vUv - 0.5;
        float d = length(c) * 2.0;
        float core = smoothstep(1.0, 0.0, d);
        float spikes = pow(abs(sin(atan(c.y, c.x) * 4.0)), 8.0) * 0.5;
        float a = clamp((core + core * spikes) * uIntensity, 0.0, 1.0);
        gl_FragColor = vec4(uColor * (1.2 + spikes), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function makeTracerMaterial(color = 0xfff6c8) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float edge = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
        gl_FragColor = vec4(uColor, edge * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

export function makeImpactSparkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffcf6b) } },
    vertexShader: /* glsl */`
      attribute float aLife;
      attribute float aSeed;
      varying float vLife;
      uniform float uTime;
      void main() {
        vLife = aLife;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = mix(6.0, 0.5, 1.0 - aLife) * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying float vLife;
      uniform vec3 uColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        float a = smoothstep(1.0, 0.0, d) * vLife;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// Ground shader — subtle grid + grime for the arena floor, cheap and stylized.
export function makeGroundMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColorA: { value: new THREE.Color(0x4a5240) },
      uColorB: { value: new THREE.Color(0x363f2e) },
      uGridColor: { value: new THREE.Color(0x8fae6e) },
    },
    vertexShader: /* glsl */`
      varying vec2 vWorldXZ;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldXZ = world.xz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uGridColor;
      varying vec2 vWorldXZ;
      float grid(vec2 p, float size) {
        vec2 g = abs(fract(p / size - 0.5) - 0.5) / fwidth(p / size);
        return 1.0 - min(min(g.x, g.y), 1.0);
      }
      void main() {
        float n = fract(sin(dot(floor(vWorldXZ * 0.2), vec2(12.9898, 78.233))) * 43758.5453);
        vec3 base = mix(uColorA, uColorB, n * 0.4);
        float g1 = grid(vWorldXZ, 4.0) * 0.05;
        float g2 = grid(vWorldXZ, 20.0) * 0.1;
        vec3 color = base + uGridColor * (g1 + g2);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

// Enemy dissolve-on-death shader
export function makeEnemyDissolveMaterial(baseColor) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(baseColor) },
      uDissolve: { value: 0 }, // 0 = alive, 1 = fully gone
      uEdgeColor: { value: new THREE.Color(0x9dff5c) },
      uLit: { value: 0.8 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform vec3 uEdgeColor;
      uniform float uDissolve;
      uniform float uLit;
      varying vec2 vUv;
      varying vec3 vNormal;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        float a = hash(i), b = hash(i + vec2(1,0)), c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      void main() {
        float n = noise(vUv * 18.0);
        if (n < uDissolve) discard;
        float edge = smoothstep(uDissolve, uDissolve + 0.08, n);
        float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
        vec3 lit = uColor * (uLit + rim * 0.4);
        vec3 color = mix(uEdgeColor, lit, edge);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}
