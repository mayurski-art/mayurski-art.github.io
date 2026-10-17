// Grin Sabers — renderer, post (bloom so the blades glow), sky, lights and
// the duel camera.
//
// Light count is fixed from the first frame (sun, sky fill, one point light
// per saber): adding lights later recompiles every material, a visible
// hitch (the Troll Forces lesson).

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export function createView(canvas) {
  const touch = matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !touch, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, touch ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8a4f5e, 26, 90);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 400);
  camera.position.set(0, 3, 8);

  // Sunset sky: a big inside-out sphere, gradient from the horizon glow up
  // to dusk violet, with the sun's disc low in the west.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: new THREE.Vector3(-0.8, 0.12, -0.6).normalize() } },
    vertexShader: /* glsl */`varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun; varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 top = vec3(0.13, 0.08, 0.26), mid = vec3(0.62, 0.28, 0.42), low = vec3(1.0, 0.56, 0.32);
        vec3 c = mix(low, mid, smoothstep(-0.02, 0.18, h));
        c = mix(c, top, smoothstep(0.15, 0.7, h));
        float s = max(0.0, dot(vDir, uSun));
        c += vec3(1.0, 0.7, 0.4) * pow(s, 18.0) * 0.6 + vec3(1.0, 0.85, 0.6) * smoothstep(0.9975, 0.999, s) * 2.0;
        c = mix(c, vec3(0.32, 0.17, 0.24), smoothstep(0.0, -0.25, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), skyMat);
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xffc7a2, 0x3a2638, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb27a, 2.4);
  sun.position.set(-14, 9, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -13; sc.right = 13; sc.top = 13; sc.bottom = -13; sc.near = 1; sc.far = 45;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.45, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(Math.round(w / 2), Math.round(h / 2));
    camera.aspect = w / h;
    // Portrait phones: widen the view so both fighters fit.
    camera.fov = w < h ? 74 : 58;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  return { renderer, scene, camera, composer, sun, touch, render: () => composer.render() };
}

/* The duel camera: over the player's shoulder, looking past them at the
   opponent, so both blades are in view. Eased so hits and dodges don't jerk
   it. `shake` decays on its own. */
export class DuelCamera {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3(0, 3, 8);
    this.look = new THREE.Vector3(0, 1.2, 0);
    this.shakeK = 0;
    this.orbit = 0;
    this._p = new THREE.Vector3();
    this._l = new THREE.Vector3();
  }

  shake(k) { this.shakeK = Math.max(this.shakeK, k); }

  /* Behind `me`, facing `them`. */
  follow(me, them, dt, snap = false) {
    const dx = them.pos.x - me.pos.x, dz = them.pos.z - me.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const fx = dx / d, fz = dz / d;
    const rx = -fz, rz = fx;   // right of the line me -> them
    const back = 3.1 + Math.min(1.6, Math.max(0, d - 2) * 0.35);
    const portrait = this.cam.aspect < 1;
    const side = portrait ? 0.55 : 1.25;
    this._p.set(me.pos.x - fx * back + rx * side, 2.15 + me.pos.y * 0.6 + (portrait ? 0.45 : 0), me.pos.z - fz * back + rz * side);
    // look past the shoulder, not at the back of your own head
    const ahead = Math.min(d, 3) * 0.75;
    this._l.set(me.pos.x + fx * ahead + rx * side * 0.55, 1.15 + (me.pos.y + them.pos.y) * 0.3, me.pos.z + fz * ahead + rz * side * 0.55);
    this.ease(dt, snap ? 1 : 1 - Math.exp(-dt * 9));
  }

  /* Side-on, slowly turning round the pair: the title screen demo and
     (later) spectators. */
  spectate(a, b, dt, snap = false) {
    this.orbit += dt * 0.12;
    const mx = (a.pos.x + b.pos.x) / 2, mz = (a.pos.z + b.pos.z) / 2;
    const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
    const r = 2.9 + d * 0.75;
    this._p.set(mx + Math.cos(this.orbit) * r, 1.75, mz + Math.sin(this.orbit) * r);
    this._l.set(mx, 1.15, mz);
    this.ease(dt, snap ? 1 : 1 - Math.exp(-dt * 3));
  }

  ease(dt, k) {
    this.pos.lerp(this._p, k);
    this.look.lerp(this._l, k);
    this.cam.position.copy(this.pos);
    if (this.shakeK > 0.001) {
      const s = this.shakeK * 0.06;
      this.cam.position.x += (Math.random() - 0.5) * s;
      this.cam.position.y += (Math.random() - 0.5) * s;
      this.shakeK *= Math.exp(-dt * 12);
    }
    this.cam.lookAt(this.look);
  }
}
