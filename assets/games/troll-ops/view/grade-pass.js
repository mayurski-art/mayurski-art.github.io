// The last two passes of the world frame (stylised realism, REALISM.md).
//
// ViewmodelPass draws the first-person gun and arms into the frame before
// it is tone mapped, so the gun gets the same exposure and grade as the
// world. It used to be drawn straight to the screen after the composer.
// Bloom, SSAO and the impact effects run before it, so the gun still gets
// none of them, as before.
//
// GradePass is OutputPass (tone mapping, sRGB) plus a colour grade in
// display space: saturation, contrast, and a split tone (one tint pulled
// into the shadows, another into the highlights). Each map sets its look
// with `grade` (setGrade); a map without one is left as it was.

import * as THREE from "three";
import { Pass } from "three/addons/postprocessing/Pass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export class ViewmodelPass extends Pass {
  // `draw()` says whether to draw this frame and does any last placement
  constructor(scene, camera, draw) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.draw = draw;
    this.needsSwap = false;
  }

  render(renderer, writeBuffer, readBuffer) {
    if (!this.draw()) return;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(readBuffer);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = autoClear;
  }
}

const GRADE_FRAGMENT = /* glsl */`
  uniform float uGrade, uSat, uContrast, uShadowAmt, uHighAmt;
  uniform vec3 uShadow, uHigh;
  vec3 gradeColor(vec3 c) {
    const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
    c = clamp(c, 0.0, 1.0);
    float l = dot(c, LW);
    c = mix(vec3(l), c, uSat);
    c = (c - 0.5) * uContrast + 0.5;
    // split tone: each tint's hue (its offset from its own grey) added where it belongs
    float lo = 1.0 - smoothstep(0.0, 0.55, l), hi = smoothstep(0.45, 1.0, l);
    c += (uShadow - dot(uShadow, LW)) * uShadowAmt * lo;
    c += (uHigh - dot(uHigh, LW)) * uHighAmt * hi;
    return clamp(c, 0.0, 1.0);
  }
`;

/* A hex colour as display (sRGB) values: the grade runs after the sRGB encode. */
const _c = new THREE.Color(), _rgb = { r: 0, g: 0, b: 0 };
function srgb(hex, out) {
  _c.setHex(hex).getRGB(_rgb, THREE.SRGBColorSpace);
  out.set(_rgb.r, _rgb.g, _rgb.b);
}

const IDENTITY = { sat: 1, contrast: 1, shadows: 0x808080, shadowsAmt: 0, highlights: 0x808080, highlightsAmt: 0 };

export class GradePass extends OutputPass {
  constructor() {
    super();
    Object.assign(this.uniforms, {
      uGrade: { value: 0 },
      uSat: { value: 1 },
      uContrast: { value: 1 },
      uShadow: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      uShadowAmt: { value: 0 },
      uHigh: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      uHighAmt: { value: 0 },
    });
    const fs = this.material.fragmentShader;
    const head = fs.indexOf("varying vec2 vUv;");
    const end = fs.lastIndexOf("}");
    this.material.fragmentShader = fs.slice(0, head) + GRADE_FRAGMENT + fs.slice(head, end)
      + "\tif (uGrade > 0.5) gl_FragColor.rgb = gradeColor(gl_FragColor.rgb);\n}";
  }

  /* A map's whole look: its grade, exposure (default 1.5) and tone mapping.
     Neutral unless the map asks for `tone: "aces"`: the night maps keep
     ACES, whose toe sinks their purple shade to near black (-tm5). */
  setLook(renderer, map) {
    this.setGrade(map.grade);
    renderer.toneMapping = map.tone === "aces" ? THREE.ACESFilmicToneMapping : THREE.NeutralToneMapping;
    renderer.toneMappingExposure = map.exposure ?? 1.5;
  }

  /* map.grade: { sat, contrast, shadows (hex), shadowsAmt, highlights (hex),
     highlightsAmt }. Tints are sRGB hex, as the map's other colours are. */
  setGrade(grade) {
    const g = { ...IDENTITY, ...(grade || {}) }, u = this.uniforms;
    u.uGrade.value = grade ? 1 : 0;
    u.uSat.value = g.sat;
    u.uContrast.value = g.contrast;
    srgb(g.shadows, u.uShadow.value);
    u.uShadowAmt.value = g.shadowsAmt;
    srgb(g.highlights, u.uHigh.value);
    u.uHighAmt.value = g.highlightsAmt;
  }
}
