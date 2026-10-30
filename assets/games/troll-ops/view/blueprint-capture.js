// Troll Forces blueprint capture: the map the match was played on, drawn as
// an architect's plan for the after-action report (modes/after-action.js).
//
// The real level, not a sketch of it: an orthographic camera straight down
// over the arena renders two passes off screen, the surface normals and the
// height (a linear depth, so height for an ortho camera), and this module
// traces them into linework:
//   - an outline wherever the height steps (a wall's edge, a roof, a ledge),
//   - a fainter crease wherever the surface turns (a ridge, a ramp's foot),
//   - contour lines every metre (2 m on a big map) over the open ground,
//   - the ground toned by height and lit from the north-west, so hills read.
// Small maps are cut like a floor plan: everything above the cut height
// (ceilings, roofs over the fight) is sliced off, so you look into the rooms.
// The solid colliders the cut passes through come back with it (`cuts`) for
// the report to hatch as cut walls.
//
// Runs once, at the match's end, while the map is still loaded; about two
// renders of 1024 px and one pass over the pixels.

import * as THREE from "three";

export const BLUEPRINT_SIZE = 1024;
const CUT_ABOVE_FLOOR = 2.4;    // metres over the fight's floor: a plan's cut line
const CUT_MAX_SPAN = 150;       // maps wider than this are drawn from the air, uncut

let rt = null, normalMat = null, depthMat = null;

function targets() {
  if (rt) return;
  rt = new THREE.WebGLRenderTarget(BLUEPRINT_SIZE, BLUEPRINT_SIZE, { depthBuffer: true });
  normalMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
  depthMat = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide, depthPacking: THREE.BasicDepthPacking });
}

/* The height the fight happened at: the median of where people fell. */
function fightFloor(events, fallback) {
  const ys = (events || []).map((e) => e.y).filter(Number.isFinite).sort((a, b) => a - b);
  return ys.length ? ys[ys.length >> 1] : fallback;
}

/* Render the scene into the target with one material on everything, and read
   it back. Sky domes, sprites, lines, particles and characters stay out. */
function pass(renderer, scene, cam, mat) {
  const hidden = [];
  scene.traverse((o) => {
    if (!o.visible) return;
    const m = o.material;
    if (o.isSprite || o.isPoints || o.isLine || o.isSkinnedMesh
        || (m && !Array.isArray(m) && m.side === THREE.BackSide)
        || o.userData?.noBlueprint) { o.visible = false; hidden.push(o); }
  });
  const prev = {
    target: renderer.getRenderTarget(), override: scene.overrideMaterial, bg: scene.background, fog: scene.fog,
    clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), auto: renderer.autoClear,
  };
  scene.overrideMaterial = mat; scene.background = null; scene.fog = null;
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = true;
  renderer.clear();
  renderer.render(scene, cam);
  const px = new Uint8Array(BLUEPRINT_SIZE * BLUEPRINT_SIZE * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, BLUEPRINT_SIZE, BLUEPRINT_SIZE, px);
  renderer.setRenderTarget(prev.target);
  renderer.setClearColor(prev.clear, prev.alpha);
  renderer.autoClear = prev.auto;
  scene.overrideMaterial = prev.override; scene.background = prev.bg; scene.fog = prev.fog;
  for (const o of hidden) o.visible = true;
  return px;
}

/* game-like: { renderer, scene, colliders, ARENA, floorY, events }.
   Returns { canvas, bounds: {minX, minZ, span}, cut, cuts } or null. */
export function captureBlueprint(opts) {
  const raw = captureBlueprintLater(opts);
  return raw && raw.finish();
}

/* The same in two halves: the renders now (the scene must be there), the
   pixels traced into linework (most of the time) when finish() is called.
   Royale's flip (modes/royale-worlds.js) renders the side going away inside
   the swap's frame and leaves the tracing for the report. */
export function captureBlueprintLater({ renderer, scene, colliders = [], arena, floorY = 0, events = [] }) {
  if (!renderer || !scene || !arena) return null;
  try {
    targets();
    const w = arena.maxX - arena.minX, d = arena.maxZ - arena.minZ;
    const span = Math.max(w, d) * 1.04;
    const cx = (arena.minX + arena.maxX) / 2, cz = (arena.minZ + arena.maxZ) / 2;
    const bounds = { minX: cx - span / 2, minZ: cz - span / 2, span };

    // How high to look from, and how deep.
    let topY = -Infinity, botY = Infinity;
    for (const c of colliders) { if (c.max.y > topY) topY = c.max.y; if (c.min.y < botY) botY = c.min.y; }
    if (!Number.isFinite(topY)) { topY = 30; botY = -10; }
    botY = Math.min(botY, floorY) - 12;
    const floor = fightFloor(events, floorY);
    const cut = span <= CUT_MAX_SPAN ? floor + CUT_ABOVE_FLOOR : null;
    const eye = cut ?? topY + 2;
    const range = Math.max(4, eye - botY);

    const cam = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, 0, range);
    cam.position.set(cx, eye, cz);
    cam.up.set(0, 0, -1);            // north (-z) at the top, +x to the right, like the minimap
    cam.lookAt(cx, eye - 1, cz);
    cam.updateMatrixWorld(true);

    const nrm = pass(renderer, scene, cam, normalMat);
    const dep = pass(renderer, scene, cam, depthMat);
    // The solid pieces the cut slices through: hatched as cut walls.
    const cuts = cut == null ? [] : colliders.filter((c) => c.min.y < cut && c.max.y > cut - 0.6 && c.max.y - c.min.y > 0.9);
    let done = null;
    return {
      bounds, cut,
      finish: () => (done ||= { canvas: trace(nrm, dep, { eye, range, span, cut }), bounds, cut, cuts, floor }),
    };
  } catch (e) {
    console.warn("[blueprint] capture failed", e);
    return null;
  }
}

/* The pixels to linework. Both buffers come back bottom row first. */
function trace(nrm, dep, { eye, range, span, cut }) {
  const N = BLUEPRINT_SIZE;
  const H = new Float32Array(N * N);       // height, metres (NaN: nothing there)
  const NX = new Float32Array(N * N), NY = new Float32Array(N * N), NZ = new Float32Array(N * N);
  let hMin = Infinity, hMax = -Infinity;
  for (let y = 0; y < N; y++) {
    const src = (N - 1 - y) * N;            // flip to top row first
    for (let x = 0; x < N; x++) {
      const i = y * N + x, s = (src + x) * 4;
      if (dep[s + 3] < 8) { H[i] = NaN; continue; }
      // BasicDepthPacking: 1 - depth, and depth is linear for an ortho camera
      const h = eye - (1 - dep[s] / 255) * range;
      H[i] = h;
      if (h < hMin) hMin = h;
      if (h > hMax) hMax = h;
      // view-space normals: x right, y up the image (north), z toward the eye (up)
      NX[i] = nrm[s] / 127.5 - 1; NY[i] = nrm[s + 1] / 127.5 - 1; NZ[i] = nrm[s + 2] / 127.5 - 1;
    }
  }
  if (!Number.isFinite(hMin)) { hMin = 0; hMax = 1; }
  const hSpan = Math.max(1, hMax - hMin);
  const mPerPx = span / N;
  const step = span > 120 ? 2 : 1;           // contour interval, metres
  const edgeStep = Math.max(0.35, mPerPx * 1.6);  // a height jump this big is an edge, not a slope

  const canvas = document.createElement("canvas");
  canvas.width = N; canvas.height = N;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(N, N);
  const o = img.data;

  // The sheet: deep navy. Ground: lighter with height, lit from the north-west.
  const BG = [8, 22, 40];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x, p = i * 4;
      const h = H[i];
      if (Number.isNaN(h)) { o[p] = BG[0]; o[p + 1] = BG[1]; o[p + 2] = BG[2]; o[p + 3] = 255; continue; }
      const t = (h - hMin) / hSpan;                                  // 0 low .. 1 high
      const lit = Math.max(0, -0.55 * NX[i] + 0.55 * NY[i] + 0.63 * NZ[i]);   // hillshade
      let r = 14 + t * 22 + lit * 10, g = 34 + t * 38 + lit * 16, b = 62 + t * 58 + lit * 22;

      // the four neighbours, for edges and contours
      let jump = 0, turn = 0, contour = false;
      const band = Math.floor(h / step);
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const j = yy * N + xx, hj = H[j];
        if (Number.isNaN(hj)) { jump = Math.max(jump, 99); continue; }
        jump = Math.max(jump, Math.abs(hj - h));
        turn = Math.max(turn, 1 - (NX[i] * NX[j] + NY[i] * NY[j] + NZ[i] * NZ[j]));
        if (dx + dy > 0 && Math.floor(hj / step) !== band) contour = true;
      }
      if (jump > edgeStep) {
        // an outline: brighter the bigger the step, and brightest at the cut
        const k = Math.min(1, 0.55 + jump / 6);
        const atCut = cut != null && h > cut - 0.25;
        r = r + (215 - r) * k; g = g + (238 - g) * k; b = b + (255 - b) * k;
        if (atCut) { r = 240; g = 250; b = 255; }
      } else if (turn > 0.18) {
        const k = Math.min(0.55, turn);
        r += (150 - r) * k; g += (205 - g) * k; b += (245 - b) * k;
      } else if (contour && NZ[i] < 0.995) {
        // contours only where the ground actually slopes: flat floors stay clean
        r += 26; g += 46; b += 60;
      }
      o[p] = r; o[p + 1] = g; o[p + 2] = b; o[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
