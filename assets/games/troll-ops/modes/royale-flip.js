// Troll Royale: Two Worlds, phase 3 — the flip cinematic (doc "Troll
// Royale: Two Worlds", https://claude.ai/artifact/H3TtEw5CjmuMpWTBfjPyez).
// A small model of the whole island, both faces, turns over 180 degrees like
// a page in a book, the camera still and facing it, your marker on it, so
// you see where you'll come down. Once a match (MODES.royale.sides), when
// the second storm circle has closed (8:00 on Trollface Island), from this
// face to the other. It runs off a clock every client already shares (the
// wall clock since the match went live,
// which every tab hits together off the owner's countdown: royale.t adds up
// frame time, so a slow tab's falls behind), so every tab rolls together and
// nothing goes on the wire. Under the flip, at SWAP_AT (the camera is on the
// model), the world itself turns over: royale.js swapRoyaleSide loads the
// other side's map and sets everyone down at the matching spot (phase 4).
// That happens on every tab, the dead and the late included, cinematic or not.
//
//   0    .. 0.5   fade to black      5.4 .. 7.6  hold on the new face
//   0.5  .. 1.0   fade in on it       7.6 .. 8.1  fade to black
//   1.0  .. 1.8   hold                8.1         back to you
//   1.8  .. 5.4   the roll            8.1 .. 8.8  fade in
//
// The faces are the real islands shot straight down from the game
// (tools/troll-ops-flip-faces.mjs -> ui/flip/*.webp). The same coast serves
// both (the underside was built on it), so a roll would show the far face
// mirrored: the model is two slabs, one per face, swapped while edge-on.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";

const ISLAND_URL = new URL("../models/hollowgrin-island.json", import.meta.url).href;
const FACE_URL = (side) => new URL(`../ui/flip/${side}.webp`, import.meta.url).href;
const FACE_BOX_URL = new URL("../ui/flip/box.json", import.meta.url).href;
// where each side's map sits in the island's frame (its own coords minus this)
const SIDE_OFFSET = { trollface: [0, 0] };

export const FLIP = {
  len: 8.8,
  fade: [[0, 0.5, 1], [0.5, 1.0, -1], [7.6, 8.1, 1], [8.1, 8.8, -1]],   // [from, to, +1 darker / -1 lighter]
  roll: [1.8, 5.4],
  away: [0.5, 8.1],          // the camera is on the model
  scale: 1 / 8,              // the model to the island
  thick: 46,                 // the island's rock between its faces (m, full size)
  stage: new THREE.Vector3(0, 2400, 0),   // where the model hangs, far over the map
  orbit: { dist: 34, height: 15, spin: 0 },   // close, the model most of the screen (user, 2026-10-28: "closer to the users screens")
  swapAt: 0.6,               // the world swaps under the model (s into the flip)
};

const cine = { kind: null, t: 0, from: null, to: null, yaw0: 0, banner: false };
let model = null;   // { root, turn, slabs: { side: Group }, markers: { side: Mesh }, island }
let loading = null;
let island = null, islandLoad = null;   // models/hollowgrin-island.json (the coast, the play box, the offset)

/* The island's shapes, fetched once (the model and the swap both use them). */
function loadIsland() {
  islandLoad ||= fetch(ISLAND_URL).then((r) => r.json()).then((j) => { island = j; SIDE_OFFSET.hollowgrin = j.offset; return j; })
    .catch(() => { islandLoad = null; return null; });
  return islandLoad;
}
let veil = null;

const _axis = new THREE.Vector3();
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

/* On while either cinematic has the camera (input is held: royale.js stageFrozen). */
export function flipCineOn() { return !!cine.kind && cine.t >= FLIP.away[0] && cine.t < FLIP.away[1]; }
/* Which, and how far in (tests). */
export function flipCineState() { return { kind: cine.kind, t: cine.t, from: cine.from, to: cine.to }; }

// A test page (?tohooks=1) plays neither unless it sets window.__flipAt (the
// royale tests were written before them); then the flip comes at that match time.
const TEST_PAGE = /[?&]tohooks=1/.test(location.search);

/* When the flip comes: the end of the second circle's close, unless the
   map says (royale.flipAt) or a test page does (window.__flipAt). */
export function flipAt(r) {
  if (TEST_PAGE) return window.__flipAt;
  if (Number.isFinite(r.map?.royale?.flipAt)) return r.map.royale.flipAt;
  const ph = r.zone.phases;
  return ph.slice(0, 2).reduce((s, p) => s + p.wait + p.close, 0);
}

function sides() { return game.currentMode()?.sides || null; }
function otherSide(side) { return sides()?.find((s) => s !== side) || side; }

/* Each frame, from updateRoyale. Returns the side to swap the world to, the
   one frame it's time (royale.js swapRoyaleSide), else null. */
export function updateRoyaleFlip(r, dt) {
  const both = sides();
  if (!both || !r || (TEST_PAGE && !Number.isFinite(window.__flipAt))) { endCine(); return null; }
  const here = game.loadedMapId;
  // the flip: the match's time passes the second circle
  if (r.live && !r.flipped) loadIsland();
  const at = r.flipT ?? flipAt(r), now = r.liveAt ? (Date.now() - r.liveAt) / 1000 : r.t;   // (held once it fires: the swap brings the other side's phases)
  if (r.live && !r.over && !r.flipped && now >= at) {
    r.flipped = true;
    r.flipT = at;
    if (game.player.alive && now - at < 1) startCine("flip", here, otherSide(here), now - at);
  }
  if (cine.kind === "flip") cine.t = now - at;
  if (cine.kind) {
    tick();
    if (cine.t >= FLIP.len) endCine();
  }
  void dt;
  if (!r.flipped || r.swapped || now < at + FLIP.swapAt || (!island && islandLoad)) return null;
  r.swapped = true;
  return otherSide(here);
}

/* Where (x, z) on side `from` comes down on side `to`, in that side's map
   metres: the same point of the island, kept inside Hollowgrin's walls. */
export function matchingSpot(from, to, x, z) {
  const [ix, iz] = landingSpot(from, to, x, z), o = SIDE_OFFSET[to] || [0, 0];
  return [ix + o[0], iz + o[1]];
}

function startCine(kind, from, to, t) {
  cine.kind = kind;
  cine.from = from;
  cine.to = to;
  cine.t = t;
  cine.yaw0 = 0;   // from the south, north up: the faces read like the minimap
  cine.banner = false;
  ensureModel();
  hideOwnView(true);
}

/* The gun and the HUD are yours, not the shot's: off for the cinematic. */
function hideOwnView(on) {
  game.weaponScene.visible = !on;
  const hud = document.getElementById("to-hud");
  if (hud) hud.style.opacity = on ? "0" : "";
}

/* Back to normal: the model hidden, the veil off. */
export function endCine() {
  if (!cine.kind) return;
  cine.kind = null;
  if (model) model.root.visible = false;
  if (veil) veil.style.opacity = "0";
  hideOwnView(false);
}

/* A match over. */
export function resetRoyaleFlip() { endCine(); }

function tick() {
  // the veil: black between the world and the model
  let dark = 0;
  for (const [a, b, dir] of FLIP.fade) if (cine.t >= a && cine.t < b) dark = dir > 0 ? smooth(a, b, cine.t) : 1 - smooth(a, b, cine.t);
  showVeil(dark);
  if (!cine.banner && cine.t >= FLIP.roll[0]) {
    cine.banner = true;
    game.showWaveBanner("The island turns over", 2600);
  }
  if (!model?.island) return;
  model.root.visible = flipCineOn();
  // one turn, like a page in a book (user, 2026-10-28: "just one forward
  // facing horizontal flip", "like as if you are flipping a page in a
  // book"): the camera holds still, facing it, and it turns over side to
  // side round the axis running away from the camera, the spine's
  const a = Math.PI * smooth(FLIP.roll[0], FLIP.roll[1], cine.t);
  _axis.set(Math.sin(cine.yaw0), 0, Math.cos(cine.yaw0));
  model.turn.quaternion.setFromAxisAngle(_axis, a);
  const second = a > Math.PI / 2;
  for (const [side, slab] of Object.entries(model.slabs)) {
    slab.visible = side === (second ? cine.to : cine.from);
    slab.quaternion.setFromAxisAngle(_axis, second ? -Math.PI : 0);   // (the far face, the right way up once over)
  }
  // your marker: where you are now on the face you leave, where you'll come
  // down on the one you go to (into Hollowgrin's walls, if that's it)
  const you = game.player.alive ? game.move.pos : game.camera.position;
  for (const [side, m] of Object.entries(model.markers)) {
    const [ix, iz] = side === cine.from ? toIsland(cine.from, you.x, you.z) : landingSpot(cine.from, cine.to, you.x, you.z);
    m.position.set(ix * FLIP.scale, FLIP.thick * FLIP.scale / 2 + 0.9 + 0.25 * Math.sin(cine.t * 5), iz * FLIP.scale);
    m.visible = model.slabs[side].visible;
  }
}

function toIsland(side, x, z) { const o = SIDE_OFFSET[side] || [0, 0]; return [x - o[0], z - o[1]]; }
/* Where a spot on one face comes down on the other: the same point of the
   island, kept inside the play area there (Hollowgrin is walled). */
function landingSpot(from, to, x, z) {
  let [ix, iz] = toIsland(from, x, z);
  const play = island?.play;
  if (to === "hollowgrin" && play) {
    const o = SIDE_OFFSET.hollowgrin;
    ix = Math.min(play[1] - 3, Math.max(play[0] + 3, ix + o[0])) - o[0];
    iz = Math.min(play[3] - 3, Math.max(play[2] + 3, iz + o[1])) - o[1];
  }
  return [ix, iz];
}

/* Each frame the cinematic has the camera (view/player-update.js). */
export function placeFlipCamera(camera) {
  const o = FLIP.orbit, yaw = cine.yaw0 + cine.t * o.spin;
  camera.position.set(FLIP.stage.x + Math.sin(yaw) * o.dist, FLIP.stage.y + o.height, FLIP.stage.z + Math.cos(yaw) * o.dist);
  camera.lookAt(FLIP.stage.x, FLIP.stage.y - 2, FLIP.stage.z);
}

function showVeil(k) {
  if (!veil) {
    veil = document.createElement("div");
    veil.className = "to-flip-veil";
    veil.setAttribute("aria-hidden", "true");
    Object.assign(veil.style, { position: "fixed", inset: "0", background: "#000", opacity: "0", pointerEvents: "none", zIndex: "40" });
    document.body.appendChild(veil);
  }
  veil.style.opacity = String(k.toFixed(3));
}

/* The model: built once, the first time a cinematic needs it. */
function ensureModel() {
  if (model || loading) return;
  loading = Promise.all([loadIsland(), fetch(FACE_BOX_URL).then((r) => r.json())]).then(([island, box]) => {
    const root = new THREE.Group();
    root.name = "royale-flip";
    root.position.copy(FLIP.stage);
    root.visible = false;
    const turn = new THREE.Group();
    root.add(turn);
    const k = FLIP.scale, h = FLIP.thick * k;
    const coast = island.coast.map(([x, z]) => [(x - island.offset[0]) * k, (z - island.offset[1]) * k]);
    const shape = new THREE.Shape(coast.map(([x, z]) => new THREE.Vector2(x, -z)));
    const rock = new THREE.MeshBasicMaterial({ color: 0x2a2624, fog: false });
    const rockSide = new THREE.MeshBasicMaterial({ color: 0x4a423c, fog: false });
    const body = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 1 });
    body.rotateX(-Math.PI / 2);
    body.translate(0, -h / 2, 0);
    const loader = new THREE.TextureLoader();
    const slabs = {}, markers = {};
    for (const side of sides()) {
      const slab = new THREE.Group();
      slab.add(new THREE.Mesh(body, [rock, rockSide]));
      const tex = loader.load(FACE_URL(side));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const top = new THREE.ShapeGeometry(shape);
      top.rotateX(-Math.PI / 2);
      top.translate(0, h / 2 + 0.02, 0);
      const pos = top.attributes.position, uv = top.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) / k, z = pos.getZ(i) / k;
        uv.setXY(i, (x - box.x0) / (box.x1 - box.x0), 1 - (z - box.z0) / (box.z1 - box.z0));
      }
      slab.add(new THREE.Mesh(top, new THREE.MeshBasicMaterial({ map: tex, fog: false })));
      // your marker: a bright pin over your spot
      const pin = new THREE.Group();
      const glow = new THREE.MeshBasicMaterial({ color: 0x7ee8ff, fog: false });
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.4, 12), glow);
      tip.rotation.x = Math.PI;
      tip.position.y = 0.7;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), glow);
      head.position.y = 1.6;
      pin.add(tip, head);
      slab.add(pin);
      turn.add(slab);
      slabs[side] = slab;
      markers[side] = pin;
    }
    game.scene.add(root);
    model = { root, turn, slabs, markers, island };
  }).catch(() => { loading = null; });
}
