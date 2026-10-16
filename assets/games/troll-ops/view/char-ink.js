// Troll Forces character ink: one outline pass for the TROLLS NFT bodies
// (user, 2026-10-16: the outline breaks wherever pieces touch).
//
// Each body piece has had its own inverted-hull ink (blocky-body.js), and a
// hull is hidden inside whatever it touches: the arm against the torso, the
// armhole, the elbow, the shorts on the thigh, the head on the neck. This
// pass inks the edges instead. Every piece of a worn body gets an id
// (tagInk: one per piece hung on a rig joint, so the upper arm, forearm,
// thigh, shin, head and hat are each their own); the pass draws those ids
// and their depth into a target, and wherever the id changes, or the depth
// jumps inside one piece (a forearm folded over its own upper arm), the far
// side of the edge is inked. The line hugs the near piece, as a drawn
// outline does.
//
// In a match the scene's own depth (the composer's target) hides the ids
// behind walls first, so a line never shows a body through a wall; in the
// menu (drawInkOverlay, menu/char-inspector.js) nothing stands in front of
// the operator.
import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";

export const INK_LAYER = 7;
const INK = {
  color: 0x080808,
  width: 0.009,   // the line's width in metres on the body (so it scales with the body on screen)
  minPx: 1.0,     // never thinner than this many pixels (a far-off bot)
  maxPx: 3.2,     // nor thicker (a close-up)
  fold: 0.07,     // metres: a depth jump this big inside one piece is an edge
  retag: 30,      // frames between re-tags (pieces that load late, emote props)
};

/* ── Tagging ───────────────────────────────────────────────────────────── */
const rigs = new Set();
const skipMat = (m) => !m || m.side === THREE.BackSide || m.transparent || m.alphaTest > 0 || m.isLineBasicMaterial;
let nextId = 1;
function tagRig(rig) {
  const joints = new Set(Object.values(rig.parts || {}));
  rig.inkGroups ||= new Map();
  rig.root.traverse((o) => {
    if (!o.isMesh || o.layers.mask === 0) return;   // (the hidden stick hands: off every layer)
    if (Array.isArray(o.material) ? o.material.some(skipMat) : skipMat(o.material)) return;
    let g = o;
    while (g.parent && g.parent !== rig.root && !joints.has(g.parent)) g = g.parent;
    // the chest and hip halves are one rigid torso: no seam between them,
    // and the relief face and the skull back behind it are one head
    const key = g.parent === rig.parts?.chest || g.parent === rig.parts?.torso ? "torso"
      : g === rig.skull || g.parent === rig.parts?.head ? "head" : g;
    if (!rig.inkGroups.has(key)) rig.inkGroups.set(key, (nextId = (nextId % 65000) + 1));
    o.userData.inkId = rig.inkGroups.get(key);
    o.layers.enable(INK_LAYER);
    if (!o.userData.inkHooked) {
      const own = o.onBeforeRender;
      o.onBeforeRender = function (...args) { inkId.call(this); own.apply(this, args); };
      o.userData.inkHooked = own;
    }
  });
}
/* A worn TROLLS body joins the pass (blocky-body.js wearBlocky, once on). */
export function tagInk(rig) { rigs.add(rig); tagRig(rig); }
export function untagInk(rig) {
  rigs.delete(rig);
  rig.root.traverse((o) => {
    if (o.userData.inkId === undefined) return;
    o.layers.disable(INK_LAYER);
    delete o.userData.inkId;
    if (o.userData.inkHooked) { o.onBeforeRender = o.userData.inkHooked; delete o.userData.inkHooked; }
  });
  rig.inkGroups = null;
}
export const inkActive = () => rigs.size > 0;

/* ── The id pass ───────────────────────────────────────────────────────── */
const idMat = new THREE.ShaderMaterial({
  uniforms: { uId: { value: 0 } },
  vertexShader: `
    #include <common>
    #include <skinning_pars_vertex>
    void main() {
      #include <skinbase_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      #include <project_vertex>
    }`,
  fragmentShader: `
    uniform float uId;
    void main() { gl_FragColor = vec4(mod(uId, 256.0) / 255.0, floor(uId / 256.0) / 255.0, 0.0, 1.0); }`,
});
let drawingIds = false;
function inkId() {
  if (!drawingIds || this.userData.inkId === undefined) return;
  idMat.uniforms.uId.value = this.userData.inkId;
  idMat.uniformsNeedUpdate = true;
}
let frame = 0;
function drawIds(renderer, scene, camera, target) {
  if (++frame % INK.retag === 0) for (const r of rigs) tagRig(r);
  const mask = camera.layers.mask, bg = scene.background, fog = scene.fog, ov = scene.overrideMaterial;
  const auto = renderer.shadowMap.autoUpdate, clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
  const was = renderer.getRenderTarget();
  camera.layers.set(INK_LAYER);
  scene.background = null; scene.fog = null; scene.overrideMaterial = idMat;
  renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, false);
  drawingIds = true;
  renderer.render(scene, camera);
  drawingIds = false;
  camera.layers.mask = mask;
  scene.background = bg; scene.fog = fog; scene.overrideMaterial = ov;
  renderer.shadowMap.autoUpdate = auto;
  renderer.setClearColor(clear, alpha);
  renderer.setRenderTarget(was);
}
function makeIdTarget() {
  const t = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(1, 1) });
  t.texture.generateMipmaps = false;
  return t;
}

/* ── The edge shader ───────────────────────────────────────────────────── */
// overlay: write the ink alone (alpha), for drawing over a canvas; else mix
// it into tColor. useScene: hide ids behind the scene's own depth.
const edgeShader = (overlay) => ({
  uniforms: {
    tColor: { value: null }, tId: { value: null }, tIdDepth: { value: null }, tSceneDepth: { value: null },
    useScene: { value: 0 }, resolution: { value: new THREE.Vector2(1, 1) }, cameraNear: { value: 0.1 }, cameraFar: { value: 1000 },
    inkColor: { value: new THREE.Color(INK.color) }, widthM: { value: INK.width }, minPx: { value: INK.minPx }, maxPx: { value: INK.maxPx }, fold: { value: INK.fold },
    tanHalfFov: { value: 0.5 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    #include <packing>
    varying vec2 vUv;
    uniform sampler2D tColor, tId, tIdDepth, tSceneDepth;
    uniform float useScene, cameraNear, cameraFar, widthM, minPx, maxPx, fold, tanHalfFov;
    uniform vec2 resolution;
    uniform vec3 inkColor;
    float viewZ(float d) { return -perspectiveDepthToViewZ(d, cameraNear, cameraFar); }
    // the piece's id at uv (0: none, or hidden behind the scene), and its distance
    float idAt(vec2 uv, out float z) {
      vec4 c = texture2D(tId, uv);
      float id = floor(c.r * 255.0 + 0.5) + floor(c.g * 255.0 + 0.5) * 256.0;
      if (id < 0.5) { z = 1e9; return 0.0; }
      z = viewZ(texture2D(tIdDepth, uv).x);
      if (useScene > 0.5) {
        float sz = viewZ(texture2D(tSceneDepth, uv).x);
        if (sz < z - 0.03) { z = sz; return 0.0; }   // something's in front: no piece here
      }
      return id;
    }
    void main() {
      ${overlay ? "" : "vec4 col = texture2D(tColor, vUv);"}
      float z0;
      float a = idAt(vUv, z0);
      float ink = 0.0;
      if (a > 0.5) {
        // pixels per metre at this depth: the line keeps its width on the body
        float ppm = resolution.y / (2.0 * tanHalfFov * z0);
        float w = clamp(widthM * ppm, minPx, maxPx);
        for (int i = 0; i < 8; i++) {
          float ang = float(i) * 0.785398;
          vec2 dir = vec2(cos(ang), sin(ang)) / resolution;
          for (int k = 0; k < 2; k++) {
            // the line itself, then a soft pixel past it (a cheap anti-alias)
            float r = k == 0 ? w : w + 1.0;
            float z;
            float b = idAt(vUv + dir * r, z);
            float hit = 0.0;
            // another piece behind this one (or nothing): the line on our
            // side; two flush pieces: the line on the higher id's side
            if (b != a && (z > z0 + 0.004 || (abs(z - z0) <= 0.004 && a > b))) hit = 1.0;
            // a fold inside the piece: the line on its near side
            else if (b == a && z - z0 > max(fold, z0 * 0.03)) hit = 1.0;
            ink = max(ink, hit * (k == 0 ? 1.0 : 0.4));
          }
        }
      }
      ${overlay
        ? "gl_FragColor = vec4(inkColor, ink);"
        : "gl_FragColor = vec4(mix(col.rgb, inkColor, ink), col.a);"}
    }`,
});

/* In a match: after the RenderPass, before the rest (game.js). Reads the
   scene's depth off the composer's target (it needs a depthTexture). It
   never draws into a composer target while reading one's depth (with MSAA
   off that depth is attached to it: a feedback loop, a black screen on Low):
   the inked frame goes to its own colour-only target, then back over the
   scene's. */
const copyShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; void main() { gl_FragColor = texture2D(tDiffuse, vUv); }`,
};
export class CharInkPass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
    this.ids = makeIdTarget();
    this.out = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.mat = new THREE.ShaderMaterial({ ...edgeShader(false), depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(this.mat);
    this.copyMat = new THREE.ShaderMaterial({ ...copyShader, depthTest: false, depthWrite: false });
    this.copy = new FullScreenQuad(this.copyMat);
  }
  setSize(w, h) { this.ids.setSize(w, h); this.out.setSize(w, h); this.mat.uniforms.resolution.value.set(w, h); }
  render(renderer, writeBuffer, readBuffer) {
    if (!inkActive()) return;   // no TROLLS body about: nothing to do
    drawIds(renderer, this.scene, this.camera, this.ids);
    const u = this.mat.uniforms;
    u.tColor.value = readBuffer.texture;
    u.tId.value = this.ids.texture;
    u.tIdDepth.value = this.ids.depthTexture;
    u.tSceneDepth.value = readBuffer.depthTexture;
    u.useScene.value = readBuffer.depthTexture ? 1 : 0;
    u.cameraNear.value = this.camera.near;
    u.cameraFar.value = this.camera.far;
    u.tanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / (this.camera.zoom || 1);
    renderer.setRenderTarget(this.out);
    this.quad.render(renderer);
    this.copyMat.uniforms.tDiffuse.value = this.out.texture;
    renderer.setRenderTarget(readBuffer);
    this.copy.render(renderer);
  }
  dispose() { this.ids.dispose(); this.out.dispose(); this.mat.dispose(); this.quad.dispose(); this.copyMat.dispose(); this.copy.dispose(); }
}

/* In the menu: over what the renderer just drew to its canvas (no walls
   there, so no scene depth). */
let overlay = null;
export function drawInkOverlay(renderer, scene, camera) {
  if (!inkActive()) return;
  if (!overlay) {
    const mat = new THREE.ShaderMaterial({ ...edgeShader(true), transparent: true, depthTest: false, depthWrite: false });
    overlay = { ids: makeIdTarget(), mat, quad: new FullScreenQuad(mat), size: new THREE.Vector2() };
  }
  renderer.getDrawingBufferSize(overlay.size);
  if (overlay.ids.width !== overlay.size.x || overlay.ids.height !== overlay.size.y) overlay.ids.setSize(overlay.size.x, overlay.size.y);
  drawIds(renderer, scene, camera, overlay.ids);
  const u = overlay.mat.uniforms;
  u.tId.value = overlay.ids.texture;
  u.tIdDepth.value = overlay.ids.depthTexture;
  u.resolution.value.copy(overlay.size);
  u.cameraNear.value = camera.near;
  u.cameraFar.value = camera.far;
  u.tanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / (camera.zoom || 1);
  const auto = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setRenderTarget(null);
  overlay.quad.render(renderer);
  renderer.autoClear = auto;
}
