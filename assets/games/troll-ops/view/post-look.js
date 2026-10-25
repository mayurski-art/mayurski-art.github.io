// Troll Forces — a map's post look past the grade (game.js's composer):
// its bloom and its height haze.
//
// Haze (Kabukigrin phase 4: neon reads better through it): boxes of fog
// that thin with height, map.haze = [{ box: [x0, y0, z0, x1, y1, z1], color,
// density, falloff, edge }]. density is per metre at the box's floor (y0),
// falloff the height over which it drops by e, edge the soft margin round
// the box's sides (m). A pass after the ink, before the AO: it reads the
// scene's depth off the composer's target, rebuilds each pixel's world
// position and integrates the fog along the eye ray through each box
// (exp(-y / falloff) has a closed form along a straight line). Never on
// the gun: the viewmodel draws later.

import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

// 0.82 haloed every sunlit trollface; a map can override (map.bloom)
const BLOOM_DEFAULT = { strength: 0.55, radius: 0.5, threshold: 1.2 };
export const makeBloom = () => new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM_DEFAULT.strength, BLOOM_DEFAULT.radius, BLOOM_DEFAULT.threshold);

const MAX = 6;

const hazeShader = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
    uN: { value: 0 },
    uLo: { value: Array.from({ length: MAX }, () => new THREE.Vector3()) },
    uHi: { value: Array.from({ length: MAX }, () => new THREE.Vector3()) },
    uCol: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
    uFall: { value: Array.from({ length: MAX }, () => new THREE.Vector2(1, 1)) },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D tDiffuse, tDepth;
    uniform mat4 uProjInv, uCamWorld;
    uniform vec3 uCamPos;
    uniform int uN;
    uniform vec3 uLo[${MAX}], uHi[${MAX}];
    uniform vec4 uCol[${MAX}];
    uniform vec2 uFall[${MAX}];
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = texture2D(tDepth, vUv).x;
      vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
      vec3 wp = (uCamWorld * vec4(v.xyz / v.w, 1.0)).xyz;
      vec3 rd = wp - uCamPos;
      float len = length(rd);
      rd /= len;
      if (d >= 1.0) len = 400.0;   // the sky: through the box and out
      vec3 inv = 1.0 / (rd + vec3(equal(rd, vec3(0.0))) * 1e-6);
      for (int i = 0; i < ${MAX}; i++) {
        if (i >= uN) break;
        vec3 t0 = (uLo[i] - uCamPos) * inv, t1 = (uHi[i] - uCamPos) * inv;
        vec3 tn = min(t0, t1), tf = max(t0, t1);
        float ta = max(max(max(tn.x, tn.y), tn.z), 0.0), tb = min(min(min(tf.x, tf.y), tf.z), len);
        if (tb <= ta) continue;
        float h = uFall[i].x, seg = tb - ta;
        float ya = uCamPos.y + rd.y * ta - uLo[i].y, dy = rd.y * seg;
        // the integral of exp(-y / h) over the segment
        float od = abs(dy) > 1e-3 ? seg * h * (exp(-ya / h) - exp(-(ya + dy) / h)) / dy : seg * exp(-ya / h);
        // softened at the box's sides, by where the segment's middle is
        vec2 m = (uCamPos + rd * (ta + tb) * 0.5).xz;
        vec2 e = min(m - uLo[i].xz, uHi[i].xz - m);
        od *= uCol[i].a * clamp(min(e.x, e.y) / uFall[i].y, 0.0, 1.0);
        c.rgb = mix(c.rgb, uCol[i].rgb, 1.0 - exp(-od));
      }
      gl_FragColor = c;
    }`,
};

export class HazePass extends Pass {
  constructor(camera) {
    super();
    this.camera = camera;
    this.enabled = false;
    this.mat = new THREE.ShaderMaterial({ ...hazeShader, uniforms: THREE.UniformsUtils.clone(hazeShader.uniforms), depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(this.mat);
  }
  /* map.haze, or none (the pass is off) */
  setHaze(list = []) {
    const u = this.mat.uniforms, n = Math.min(MAX, list.length);
    u.uN.value = n;
    for (let i = 0; i < n; i++) {
      const { box, color, density, falloff = 2, edge = 1 } = list[i];
      u.uLo.value[i].set(box[0], box[1], box[2]);
      u.uHi.value[i].set(box[3], box[4], box[5]);
      const c = new THREE.Color(color);   // (linear: the scene's light before the tone map)
      u.uCol.value[i].set(c.r, c.g, c.b, density);
      u.uFall.value[i].set(falloff, Math.max(0.01, edge));
    }
    this.enabled = n > 0;
  }
  render(renderer, writeBuffer, readBuffer) {
    // (the scene's depth: the target the RenderPass drew into; this draws
    // into the other one, whose own depth is attached, so no feedback loop)
    if (!readBuffer.depthTexture) return;
    const u = this.mat.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.uProjInv.value.copy(this.camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(this.camera.matrixWorld);
    u.uCamPos.value.setFromMatrixPosition(this.camera.matrixWorld);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

/* Per map (applyEnvironment): a map lit bright enough that plain lit
   surfaces pass the bloom's threshold (the Grinleria's sunlit marble and
   ice) raises it, so only real lights and emissives bloom; its haze. */
export function applyPostLook(map, bloom, haze) {
  bloom.threshold = map.bloom?.threshold ?? BLOOM_DEFAULT.threshold;
  bloom.strength = map.bloom?.strength ?? BLOOM_DEFAULT.strength;
  bloom.radius = map.bloom?.radius ?? BLOOM_DEFAULT.radius;
  haze.setHaze(map.haze);
}
