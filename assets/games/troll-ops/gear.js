// Troll Forces — melee weapons and throwables.
//
// Two systems that share a file because they share a slot in the player's
// head: the thing you swing when someone is already inside your barrel, and
// the thing you throw when they are behind cover. Both resolve damage through
// the same actor callbacks the bullets use, so grunts, zombies, bots and
// remote players all take a grenade the way they take a round.
//
// Grenades are simulated here rather than in ballistics.js: bullets want a
// fixed-step slab test that never bounces, grenades want a fat, bouncy,
// slow-moving body that comes to rest on the floor.

import * as THREE from "three";
import { buildGripHand, buildSupportHand } from "./hand-model.js";
import { smoothstep } from "./anim-curves.js";

export const GRENADE_GRAVITY = 18;   // heavier than real so throws land where you look
const GRAVITY = GRENADE_GRAVITY;
const REST_SPEED = 0.9;      // below this a grenade stops rolling
const RADIUS = 0.11;

/* ------------------------------------------------------------------ melee */

/* Custom trollface melee. Every one of these is a real thing somebody
   built - the keyboard sword exists as a fabricated prop - so the models
   below are read off the design sheets rather than invented here. */
export const MELEE_DEFS = {
  keyboard: {
    id: "keyboard", name: "Keyboard Warrior", rank: 0,
    damage: 120, backstabMult: 1.8, range: 3.0, arc: 0.66, knock: 6.5,
    blurb: "The keyboard is mightier than the sword. U mad bro?",
    model: {
      kind: "keyboard",
      len: 0.78, wide: 0.30, blade: 0.038,
      color: 0x111114, grip: 0x30170d,
      guardWide: 0.42, guardTall: 0.052,
    },
  },
};

export const MELEE_IDS = Object.keys(MELEE_DEFS);

/* Keyboard Warrior rest pose and swing keyframes, ported 1:1 from the Godot
   reference build (troll-melee-1/weapons/keyboard_sword/keyboard_sword.gd)
   so the browser weapon reads as the same sword held the same way — grip at
   the origin, blade down -Z, matching buildKeyboardSword's own convention.

   Every attack there is authored as the path the blade TIP takes rather than
   as raw grip rotation: a few degrees of roll move the tip further than any
   plausible hand movement, so keyframing rotation directly makes the tip
   wander backwards even when every position offset points forward. The grip
   transform is solved backwards from where the tip needs to be. */
// Held upright at guard height, blade tip up and just slightly forward of
// vertical — a real one-handed grip lets the tip droop a few degrees toward
// gravity rather than standing dead straight, which reads as stiff/robotic.
// X near +90° swings the blade (rest: -Z) up to +Y; the small shortfall from
// 90° and the Y/Z tilt are that droop plus a forward cant so the flat
// doesn't read edge-on to the camera.
const REST_POS = new THREE.Vector3(0.40, -0.34, -0.62);
const REST_ROT = new THREE.Euler(
  THREE.MathUtils.degToRad(78), THREE.MathUtils.degToRad(-12), THREE.MathUtils.degToRad(8));
const REST_QUAT = new THREE.Quaternion().setFromEuler(REST_ROT);
const TIP_LOCAL = new THREE.Vector3(0, 0, -0.9);
const REST_TIP = REST_POS.clone().add(TIP_LOCAL.clone().applyQuaternion(REST_QUAT));

/* A basis whose -Z axis points along `dir`, rolled `rollDeg` about it. Falls
   back to a safe up vector when `dir` is near-vertical, which would
   otherwise make the cross product degenerate. */
const _upAxis = new THREE.Vector3(0, 1, 0);
const _backAxis = new THREE.Vector3(0, 0, 1);

function basisPointing(dir, rollDeg) {
  const forward = dir.clone().normalize();     // this becomes the basis's -Z
  const up = Math.abs(forward.dot(_upAxis)) > 0.985 ? _backAxis : _upAxis;
  const right = up.clone().cross(forward).normalize();
  const trueUp = forward.clone().cross(right).normalize();
  const m = new THREE.Matrix4().makeBasis(right, trueUp, forward.clone().negate());
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  return q.premultiply(new THREE.Quaternion().setFromAxisAngle(forward, THREE.MathUtils.degToRad(rollDeg)));
}

/* Turns [t, tipOffset, rollDeg] keys into position+quaternion samplers by
   solving the grip transform at each key from the tip path, same as the
   reference's _tip_path_anim. */
function tipPathTrack(length, keys) {
  const posKeys = [], quatKeys = [];
  for (const [t, tipOffset, rollDeg] of keys) {
    const tipTarget = REST_TIP.clone().add(tipOffset);
    let quat = REST_QUAT.clone();
    if (t > 0 && t < length) {
      const dir = tipTarget.clone().sub(REST_POS).normalize();
      quat = basisPointing(dir, rollDeg);
    }
    const tipLocal = TIP_LOCAL.clone().applyQuaternion(quat);
    posKeys.push({ t, v: tipTarget.clone().sub(tipLocal) });
    quatKeys.push({ t, q: quat });
  }
  return { length, posKeys, quatKeys };
}

/* Straight thrust keyframes the GRIP directly (see the .gd source): the
   tip-path solver aims the blade almost dead ahead for a thrust, which
   leaves the sword in its resting diagonal and just slides it forward —
   reading as shoving the flat of the board rather than stabbing. */
function gripTrack(length, keys) {
  const posKeys = [], quatKeys = [];
  for (const [t, pos, rotDeg] of keys) {
    posKeys.push({ t, v: pos });
    quatKeys.push({ t, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(rotDeg.x), THREE.MathUtils.degToRad(rotDeg.y), THREE.MathUtils.degToRad(rotDeg.z))) });
  }
  return { length, posKeys, quatKeys };
}

/* Diagonal overhead chop, right to left — the strike leg is monotonic down
   and forward so the blade never doubles back mid-cut. */
const SWING_TRACK = tipPathTrack(0.58, [
  [0.00, new THREE.Vector3(0, 0, 0), 0],
  [0.12, new THREE.Vector3(0.52, 0.52, 0.30), -34],   // wind up over the shoulder
  [0.22, new THREE.Vector3(0.38, 0.26, -0.10), -12],  // start the cut
  [0.31, new THREE.Vector3(-0.06, -0.20, -0.46), 22], // through the target
  [0.40, new THREE.Vector3(-0.52, -0.52, -0.58), 48], // follow through
  [0.48, new THREE.Vector3(-0.40, -0.40, -0.30), 30], // settle
  [0.58, new THREE.Vector3(0, 0, 0), 0],
]);
const SWING_WINDOW = { open: 0.19, close: 0.40 };

/* Straight thrust: chambered at the hip, driven point-first down the centre
   line, retracted. A different technique from the chop, not its mirror. */
const THRUST_AIMED = { x: 2, y: -3, z: 55 };
const THRUST_TRACK = gripTrack(0.46, [
  [0.00, REST_POS, { x: 15, y: -20, z: 20 }],
  [0.10, REST_POS.clone().add(new THREE.Vector3(0.10, 0.04, 0.26)), { x: -2, y: -14, z: 40 }],
  [0.16, REST_POS.clone().add(new THREE.Vector3(0.07, 0.03, 0.16)), { x: 1, y: -8, z: 49 }],
  [0.26, REST_POS.clone().add(new THREE.Vector3(-0.05, 0.02, -0.66)), THRUST_AIMED],
  [0.30, REST_POS.clone().add(new THREE.Vector3(-0.06, 0.02, -0.80)), { x: THRUST_AIMED.x + 1, y: THRUST_AIMED.y, z: THRUST_AIMED.z + 3 }],
  [0.38, REST_POS.clone().add(new THREE.Vector3(-0.01, 0.00, -0.26)), { x: 8, y: -16, z: 38 }],
  [0.46, REST_POS, { x: 15, y: -20, z: 20 }],
]);
const THRUST_WINDOW = { open: 0.20, close: 0.32 };

/* Smoothstep-eased lerp across whichever pair of keys straddle `t` — the
   reference uses cubic interpolation; smoothstep between adjacent keys
   reads the same for tracks this short and needs no spline library. */
function sampleTrack(track, t) {
  const { posKeys, quatKeys } = track;
  let i = 0;
  while (i < posKeys.length - 2 && posKeys[i + 1].t < t) i++;
  const a = posKeys[i], b = posKeys[i + 1] || a;
  const span = Math.max(1e-5, b.t - a.t);
  const k = Math.max(0, Math.min(1, (t - a.t) / span));
  const ease = smoothstep(k);
  const pos = a.v.clone().lerp(b.v, ease);
  const quat = quatKeys[i].q.clone().slerp(quatKeys[i + 1]?.q || quatKeys[i].q, ease);
  return { pos, quat };
}

/* Swing state machine. A swing is wind-up (`swing`) then recovery
   (`recover`); damage lands exactly once, on the frame the arc bottoms out,
   so holding the button can't machine-gun a knife. Alternates the chop and
   the thrust like the reference — two different techniques, not one mirrored
   over itself. */
export class MeleeState {
  constructor(def) {
    this.def = typeof def === "string" ? MELEE_DEFS[def] : def;
    this.t = 0;             // seconds into the current swing, 0 = idle
    this.landed = true;     // has this swing's damage already been dealt?
    this.swingIndex = 0;
  }

  get track() { return this.swingIndex % 2 === 0 ? SWING_TRACK : THRUST_TRACK; }
  get window() { return this.swingIndex % 2 === 0 ? SWING_WINDOW : THRUST_WINDOW; }
  get total() { return this.track.length; }
  get busy() { return this.t > 0; }
  canSwing() { return this.t <= 0; }

  start() {
    if (!this.canSwing()) return false;
    this.t = 1e-4;
    this.landed = false;
    return true;
  }

  /* Returns true on the single frame the blade should connect — matches the
     reference's hit window (open_at/close_at) instead of one instant. */
  update(dt) {
    if (this.t <= 0) return false;
    const prevT = this.t;
    this.t += dt;
    let hit = false;
    const w = this.window;
    if (!this.landed && prevT < w.open && this.t >= w.open) { this.landed = true; hit = true; }
    if (this.t >= this.total) { this.t = 0; this.swingIndex++; }
    return hit;
  }

  /* Grip position + orientation for the view model this frame. */
  pose() {
    if (this.t <= 0) return { pos: REST_POS, quat: REST_QUAT };
    return sampleTrack(this.track, Math.min(this.t, this.total));
  }

  /* 0 → 1 → 0 over the whole swing, kept for callers that only need a
     scalar (e.g. a UI flourish, not the pose itself). */
  get phase() {
    if (this.t <= 0) return 0;
    const k = this.t / this.total;
    return k < 0.5 ? k * 2 : (1 - k) * 2;
  }
}

/* First-person melee model — same blocky vocabulary as the guns.

   The keyboard sword mirrors the Blender build in
   assets/games/troll-ops/troll-melee-1/tools/build_keyboard_sword.py, so
   the two stay recognisably the same weapon. Keycaps go through one
   InstancedMesh: 180 separate meshes would be 180 draw calls for a thing
   that lives in the corner of the screen. */
// `includeHands` defaults on for the real in-match view-model, where a
// held weapon with no hands on it would look wrong. The standalone locker/
// inspector preview (inspector.js) passes false: with no arm or body
// attached to explain them, the hand meshes read as disconnected skin-
// coloured fragments floating along the grip instead of someone holding it.
export function buildMeleeMesh(def, includeHands = true) {
  const m = def.model;
  const group = new THREE.Group();
  const mat = (c, rough = 0.45, metal = 0.65) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });

  const GRIP_ANCHOR = new THREE.Vector3(0, 0, 0.06);

  // buildGripHand's scale=1 is tuned against a rifle grip box ~0.05 wide
  // (weapon-model.js); melee grips are much thinner (0.036 here, and the
  // keyboard sword has no grip box at all), so every melee hand is scaled
  // down to match rather than dwarfing the weapon the way the untuned
  // default did on first pass.
  const MELEE_HAND_SCALE = 0.62;

  if (m.kind === "keyboard") {
    const sword = buildKeyboardSword(m, mat, group);
    if (includeHands) {
      const kbHand = buildGripHand(MELEE_HAND_SCALE);
      kbHand.userData.hand = true;   // tossed off and caught back by the inspect
      kbHand.position.copy(GRIP_ANCHOR);
      sword.add(kbHand);
      // Two-handed grip: the keyboard sword is swung with both hands, the
      // support hand choked up behind the primary grip (+Z, toward the
      // pommel end, away from the guard at the blade side) rather than
      // ahead of it — there's no separate foregrip on a sword the way a
      // rifle's handguard gives one.
      const SUPPORT_ANCHOR = GRIP_ANCHOR.clone().add(new THREE.Vector3(0, 0, 0.11));
      const supportHand = buildSupportHand(MELEE_HAND_SCALE * 0.85);
      supportHand.userData.hand = true;
      supportHand.position.copy(SUPPORT_ANCHOR);
      supportHand.rotation.z = Math.PI / 2;
      sword.add(supportHand);
    }
    return sword;
  }

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.15), mat(m.grip, 0.85, 0.05));
  grip.position.copy(GRIP_ANCHOR);
  group.add(grip);
  if (includeHands) {
    const hand = buildGripHand(MELEE_HAND_SCALE);
    hand.position.copy(GRIP_ANCHOR);
    group.add(hand);
  }

  if (m.kind === "bat") {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(m.blade * 0.5, m.wide, m.len, 10), mat(m.color, 0.8, 0.05));
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0, 0, -m.len / 2);
    group.add(shaft);
  } else if (m.kind === "bar") {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(m.wide, m.wide, m.len), mat(m.color, 0.55, 0.4));
    shaft.position.set(0, 0, -m.len / 2);
    group.add(shaft);
    if (m.hook) {
      const hook = new THREE.Mesh(new THREE.BoxGeometry(m.wide, 0.11, m.wide), mat(m.color, 0.55, 0.4));
      hook.position.set(0, -0.05, -m.len + 0.03);
      group.add(hook);
    }
  } else {
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.03), mat(m.grip, 0.7, 0.2));
    guard.position.set(0, 0, -0.01);
    group.add(guard);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(m.wide, m.blade, m.len), mat(m.color, 0.22, 0.9));
    blade.position.set(0, 0, -m.len / 2 - 0.02);
    group.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(m.wide * 0.62, 0.09, 4), mat(m.color, 0.22, 0.9));
    tip.rotation.x = -Math.PI / 2;
    tip.rotation.z = Math.PI / 4;
    tip.position.set(0, 0, -m.len - 0.06);
    group.add(tip);
  }

  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

/* "U MAD BRO?" for the crossguard: black letters inlaid in the silver,
   with a thin bright edge below-right so they read as cut into the guard
   rather than printed on it. Built once and shared - every
   player carries this weapon, so rebuilding the canvas per spawn would leak
   a texture each time. */
let guardTexCache = null;
function guardTextTexture(THREE) {
  if (guardTexCache) return guardTexCache;
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 160;
  const g = c.getContext("2d");
  g.fillStyle = "#c3c7cd";
  g.fillRect(0, 0, c.width, c.height);
  g.font = "600 112px 'DM Sans', system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const x = c.width / 2, y = c.height / 2 + 6;
  const text = "U MAD BRO?";
  g.fillStyle = "#eef0f3"; g.fillText(text, x + 3, y + 3);   // cut edge catching light
  g.fillStyle = "#0b0c0e"; g.fillText(text, x, y);           // the black inlay
  guardTexCache = new THREE.CanvasTexture(c);
  guardTexCache.colorSpace = THREE.SRGBColorSpace;
  guardTexCache.anisotropy = 4;
  return guardTexCache;
}

/* The keyboard on the blade: a real 75% board, in order, 16 keys long and
   six rows deep. Widths are in key units (u). Every row adds up to 16u, so
   the board is a clean rectangle. `null` legends are blank caps. */
const KB_ROWS = [
  [["esc", 1], ["F1", 1], ["F2", 1], ["F3", 1], ["F4", 1], ["F5", 1], ["F6", 1], ["F7", 1],
    ["F8", 1], ["F9", 1], ["F10", 1], ["F11", 1], ["F12", 1], ["prt sc", 1], ["del", 1], ["home", 1]],
  [["~|`", 1], ["!|1", 1], ["@|2", 1], ["#|3", 1], ["$|4", 1], ["%|5", 1], ["^|6", 1], ["&|7", 1],
    ["*|8", 1], ["(|9", 1], [")|0", 1], ["_|-", 1], ["+|=", 1], ["backspace", 2], ["pg up", 1]],
  [["tab", 1.5], ["Q", 1], ["W", 1], ["E", 1], ["R", 1], ["T", 1], ["Y", 1], ["U", 1], ["I", 1],
    ["O", 1], ["P", 1], ["{|[", 1], ["}|]", 1], ["\\", 1.5], ["pg dn", 1]],
  [["caps lock", 1.75], ["A", 1], ["S", 1], ["D", 1], ["F", 1], ["G", 1], ["H", 1], ["J", 1],
    ["K", 1], ["L", 1], [":|;", 1], ["\"|'", 1], ["return", 2.25], ["end", 1]],
  [["⇧ shift", 2.25], ["Z", 1], ["X", 1], ["C", 1], ["V", 1], ["B", 1], ["N", 1], ["M", 1],
    ["<|,", 1], [">|.", 1], ["?|/", 1], ["⇧ shift", 1.75], ["↑", 1], ["fn", 1]],
  [["control", 1.25], ["option", 1.25], ["⌘", 1.25], [null, 7.25], ["⌘", 1], ["option", 1],
    ["←", 1], ["↓", 1], ["→", 1]],
];
const KB_LEN_U = 16;

/* Legends as one texture laid over the whole key field, drawn as an
   ordinary keyboard seen from above: canvas x runs esc -> home, canvas top
   is the F-row. The plane that carries it is turned onto the blade in
   buildKeyboardSword. Pastel RGB, dim like the reference board's backlit
   legends: pink at the guard, through violet, to teal at the tip. */
let keyLegendCache = null;
function keyLegendTexture(THREE) {
  if (keyLegendCache) return keyLegendCache;
  const U = 64;
  const c = document.createElement("canvas");
  c.width = KB_LEN_U * U;
  c.height = KB_ROWS.length * U;
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  g.textAlign = "center";
  g.textBaseline = "middle";
  KB_ROWS.forEach((row, r) => {
    let x = 0;
    for (const [label, w] of row) {
      if (label) {
        const cx = (x + w / 2) * U, cy = (r + 0.5) * U;
        const hue = 320 - (cx / c.width) * 150;
        g.fillStyle = `hsl(${hue}, 70%, 74%)`;
        const [top, bottom] = label.includes("|") && label.length > 1 ? label.split("|") : [null, label];
        if (top) {
          g.font = "500 17px 'DM Sans', system-ui, sans-serif";
          g.fillText(top, cx, cy - 11);
          g.font = "500 20px 'DM Sans', system-ui, sans-serif";
          g.fillText(bottom, cx, cy + 11);
        } else {
          const size = bottom.length === 1 ? 26 : bottom.length <= 3 ? 17 : 13;
          g.font = `500 ${size}px 'DM Sans', system-ui, sans-serif`;
          g.fillText(bottom, cx, cy + 1);
        }
      }
      x += w;
    }
  });
  keyLegendCache = new THREE.CanvasTexture(c);
  keyLegendCache.colorSpace = THREE.SRGBColorSpace;
  keyLegendCache.anisotropy = 8;
  return keyLegendCache;
}

/* RGB backlight, like a gaming board's wave effect: a rainbow sweeping from
   esc to the arrows, glowing up through the gaps between the caps and
   lighting the legends. One shared clock for every copy of the sword; it's
   read off performance.now() when the mesh draws, so nothing has to tick it.
   Brighter than 1 and not tone mapped, so the bloom pass haloes it. */
const KB_RGB_TIME = { value: 0 };
const KB_RGB_GLSL = /* glsl */`
  uniform float uTime;
  vec3 hue2rgb(float h) {
    vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return k * k * (3.0 - 2.0 * k);
  }
  // u: 0 at esc, 1 at the arrows. The hue scrolls toward the tip and a
  // brighter crest rides along with it.
  vec3 rgbWave(float u) {
    float phase = u * 1.1 - uTime * 0.45;
    vec3 c = hue2rgb(fract(phase));
    float crest = 0.65 + 0.35 * pow(0.5 + 0.5 * sin((u * 2.4 - uTime * 1.3) * 6.2832), 3.0);
    return c * crest;
  }
`;
function stampRgbTime() { KB_RGB_TIME.value = performance.now() / 1000; }

function keyUnderglowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: KB_RGB_TIME },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: KB_RGB_GLSL + `
      varying vec2 vUv;
      void main() { gl_FragColor = vec4(rgbWave(vUv.x) * 2.2, 1.0); }`,
    toneMapped: false,
  });
}

function keyLegendRgbMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: KB_RGB_TIME, map: { value: map } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: KB_RGB_GLSL + `
      uniform sampler2D map;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(map, vUv);
        if (t.a < 0.02) discard;
        // Legends take the wave's colour, lifted toward white so they stay
        // readable, like backlit caps.
        vec3 c = mix(rgbWave(vUv.x), vec3(1.0), 0.28) * 1.6;
        gl_FragColor = vec4(c, t.a);
      }`,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/* Leather wrap for the grip: dark diagonal seams over brown, repeating. */
let wrapTexCache = null;
function gripWrapTexture(THREE) {
  if (wrapTexCache) return wrapTexCache;
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#4a2e22";
  g.fillRect(0, 0, 64, 64);
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.08)");
  grad.addColorStop(0.7, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.35)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#1e120d";
  g.fillRect(0, 60, 64, 4);
  wrapTexCache = new THREE.CanvasTexture(c);
  wrapTexCache.colorSpace = THREE.SRGBColorSpace;
  wrapTexCache.wrapS = wrapTexCache.wrapT = THREE.RepeatWrapping;
  wrapTexCache.repeat.set(1, 9);
  return wrapTexCache;
}

/* The trollface art, for the sticker on the board and the pommel. */
let faceTexCache = null;
function trollfaceTexture(THREE) {
  if (faceTexCache) return faceTexCache;
  faceTexCache = new THREE.TextureLoader().load(
    new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href);
  faceTexCache.colorSpace = THREE.SRGBColorSpace;
  return faceTexCache;
}

/* Keyboard Warrior, after the reference render: a real keyboard for a
   blade, a silver "U MAD BRO?" guard, leather grip, trollface pommel.
   Blade runs down -Z, grip at the origin, so it drops into the same
   view-model slot as the guns. Keys face +Y.

   The board lies lengthwise: the keyboard's left end (esc, tab, caps,
   shift, control) sits at the guard and the arrows at the tip, with the
   F-row along the -X edge. */
function buildKeyboardSword(m, mat, group) {
  const GRIP_LEN = 0.34;
  const GUARD_THICK = 0.075;
  const z0 = -(GRIP_LEN * 0.5 + GUARD_THICK);   // where the blade starts
  const len = m.len, wide = m.wide, thick = m.blade;
  const zMid = z0 - len * 0.5;
  const faceUp = thick * 0.5;

  // Case: a black slab with a raised lip round the key well.
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.55, metalness: 0.2 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(wide, thick, len), caseMat);
  slab.position.set(0, 0, zMid);
  group.add(slab);
  const RIM = 0.011, LIP = 0.012;
  for (const [w, l, x, z] of [
    [wide, RIM, 0, z0 - RIM / 2], [wide, RIM, 0, z0 - len + RIM / 2],
    [RIM, len, -wide / 2 + RIM / 2, zMid], [RIM, len, wide / 2 - RIM / 2, zMid],
  ]) {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w, LIP, l), caseMat);
    lip.position.set(x, faceUp + LIP / 2, z);
    group.add(lip);
  }

  // Key field inside the rim. u along the blade (keyboard x) and across it
  // (keyboard rows) come out nearly square at these proportions.
  const fieldL = len - RIM * 2 - 0.006, fieldW = wide - RIM * 2 - 0.006;
  const uL = fieldL / KB_LEN_U, uW = fieldW / KB_ROWS.length;
  const gap = 0.0045;
  const capH = 0.012;
  const zStart = z0 - RIM - 0.003;              // keyboard x = 0 (esc end)
  const xStart = -wide / 2 + RIM + 0.003;       // keyboard row 0 (F-row) edge

  // Caps taper: the top is inset from the base, like sculpted keycaps.
  const capGeo = new THREE.BoxGeometry(1, capH, 1);
  const cp = capGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    if (cp.getY(i) > 0) { cp.setX(i, cp.getX(i) * 0.86); cp.setZ(i, cp.getZ(i) * 0.9); }
  }
  capGeo.computeVertexNormals();
  const keyCount = KB_ROWS.reduce((n, r) => n + r.length, 0);
  const caps = new THREE.InstancedMesh(capGeo,
    new THREE.MeshStandardMaterial({ color: 0x151518, roughness: 0.62, metalness: 0.05 }), keyCount);
  const dummy = new THREE.Object3D();
  let i = 0;
  KB_ROWS.forEach((row, r) => {
    let kx = 0;
    for (const [, w] of row) {
      dummy.position.set(xStart + (r + 0.5) * uW, faceUp + capH / 2 + 0.002, zStart - (kx + w / 2) * uL);
      dummy.scale.set(uW - gap, 1, w * uL - gap);
      dummy.updateMatrix();
      caps.setMatrixAt(i++, dummy.matrix);
      kx += w;
    }
  });
  caps.instanceMatrix.needsUpdate = true;
  group.add(caps);

  // RGB underglow: a lit sheet on the case floor under the caps. The caps
  // hide it except in the gaps between them, which is exactly where a
  // backlit board glows. Same basis as the legends, so its uv.x runs
  // esc -> home.
  const glowBasis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0));
  const underglow = new THREE.Mesh(new THREE.PlaneGeometry(fieldL, fieldW), keyUnderglowMaterial());
  underglow.quaternion.setFromRotationMatrix(glowBasis);
  underglow.position.set(xStart + fieldW / 2, faceUp + 0.0012, zStart - fieldL / 2);
  underglow.onBeforeRender = stampRgbTime;
  underglow.castShadow = false;
  group.add(underglow);
  // The inside of the rim catches the light too, so the glow reads from a
  // low angle where the gaps close up.
  for (const [l, x, z] of [
    [fieldL, xStart - RIM * 0.2, zStart - fieldL / 2],
    [fieldL, xStart + fieldW + RIM * 0.2, zStart - fieldL / 2],
  ]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(l, LIP * 0.9), keyUnderglowMaterial());
    // Standing strip along the blade; its uv.x runs esc -> tip like the sheet.
    strip.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)));   // right-handed; DoubleSide covers the far strip
    strip.material.side = THREE.DoubleSide;
    strip.position.set(x, faceUp + LIP * 0.5, z);
    strip.onBeforeRender = stampRgbTime;
    group.add(strip);
  }

  // Legends: canvas x (esc -> home) must run down the blade (-Z) and the
  // canvas top (the F-row) must sit on the -X edge, facing up. A plane's
  // local +X/+Y carry the canvas right/up, so those two axes are set to
  // world -Z and -X directly; their cross product is +Y, the face normal.
  const legend = new THREE.Mesh(new THREE.PlaneGeometry(fieldL, fieldW), keyLegendRgbMaterial(keyLegendTexture(THREE)));
  legend.onBeforeRender = stampRgbTime;
  legend.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)));
  legend.position.set(xStart + fieldW / 2, faceUp + capH + 0.0026, zStart - fieldL / 2);
  group.add(legend);

  // Status LEDs and a trollface sticker on the case lip at the tip end,
  // where the reference board has its indicators.
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x5dff7a, toneMapped: false });
  for (let k = 0; k < 3; k++) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.003, 0.004), ledMat);
    led.position.set(-wide / 2 + 0.05 + k * 0.016, faceUp + LIP + 0.0015, z0 - len + RIM / 2);
    group.add(led);
  }
  const sticker = new THREE.Mesh(
    new THREE.PlaneGeometry(0.05, 0.047),
    new THREE.MeshStandardMaterial({ map: trollfaceTexture(THREE), transparent: true, alphaTest: 0.3, roughness: 0.5 }));
  sticker.rotation.x = -Math.PI / 2;
  sticker.position.set(wide / 2 - 0.045, faceUp + 0.0012, z0 - len + RIM + 0.012);
  // Sticker sits on the case, just past the last key column.
  sticker.position.z = zStart - fieldL - 0.0005;
  sticker.scale.setScalar(0.28);
  group.add(sticker);

  // Plain plastic underside, with a shallow recessed panel.
  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(wide - 0.03, 0.004, len - 0.03),
    new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.75, metalness: 0.15 }));
  backPanel.position.set(0, -(faceUp + 0.002), zMid);
  group.add(backPanel);

  // Crossguard: a silver bar wider than the blade, "U MAD BRO?" raised on
  // its top face, a row of rivets down each long edge.
  const silver = () => mat(0xc4c8ce, 0.32, 0.35);
  const guardZ = -(GRIP_LEN * 0.5 + GUARD_THICK * 0.5);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(m.guardWide, m.guardTall, GUARD_THICK), silver());
  guard.position.set(0, 0, guardZ);
  group.add(guard);
  // Flanges at each end, standing proud like the reference's end caps.
  for (const s of [-1, 1]) {
    const flange = new THREE.Mesh(new THREE.BoxGeometry(0.018, m.guardTall * 1.9, GUARD_THICK * 1.06), silver());
    flange.position.set(s * (m.guardWide / 2 - 0.009), 0, guardZ);
    group.add(flange);
  }
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(m.guardWide * 0.84, GUARD_THICK * 0.56),
    new THREE.MeshStandardMaterial({ map: guardTextTexture(THREE), roughness: 0.3, metalness: 0.3 }));
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(0, m.guardTall * 0.5 + 0.0012, guardZ);
  group.add(plate);
  const RIVETS = 18;
  const rivets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0055, 8, 5), mat(0xe6e9ee, 0.25, 0.4), RIVETS * 2);
  for (let r = 0; r < RIVETS; r++) {
    for (const [e, side] of [[0, -1], [1, 1]]) {
      dummy.scale.set(1, 0.6, 1);
      dummy.position.set(
        -m.guardWide * 0.42 + m.guardWide * 0.84 * (r / (RIVETS - 1)),
        m.guardTall * 0.5,
        guardZ + side * GUARD_THICK * 0.4);
      dummy.updateMatrix();
      rivets.setMatrixAt(r * 2 + e, dummy.matrix);
    }
  }
  rivets.instanceMatrix.needsUpdate = true;
  group.add(rivets);

  // Silver collar where the grip meets the guard.
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.03, 20), silver());
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0, -GRIP_LEN * 0.5 + 0.012);
  group.add(collar);

  // Leather-wrapped grip.
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.027, GRIP_LEN - 0.02, 20),
    new THREE.MeshStandardMaterial({ map: gripWrapTexture(THREE), roughness: 0.8, metalness: 0.02 }));
  grip.rotation.x = Math.PI / 2;
  grip.position.z = 0.01;
  group.add(grip);

  // Pommel: a silver trollface. A squashed ball for the head, with the art
  // pressed into its top (the key side) as colour and bump, so the grin reads
  // as cast metal rather than a sticker.
  const POMMEL_R = 0.05;
  const pommelZ = GRIP_LEN * 0.5 + POMMEL_R * 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(POMMEL_R, 20, 14), silver());
  head.scale.set(1.1, 0.62, 1.05);
  head.position.set(0, 0, pommelZ);
  group.add(head);
  const faceTex = trollfaceTexture(THREE);
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(POMMEL_R * 1.02, 24),
    new THREE.MeshStandardMaterial({
      color: 0xd6d9de, map: faceTex, bumpMap: faceTex, bumpScale: 0.6,
      transparent: true, alphaTest: 0.3, roughness: 0.3, metalness: 0.35,
    }));
  face.rotation.x = -Math.PI / 2;
  // Chin toward the grip end, so the grin reads upright held point-down.
  face.rotation.z = 0;
  face.position.set(0, POMMEL_R * 0.62 + 0.001, pommelZ);
  group.add(face);

  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

/* -------------------------------------------------------------- throwables */

export const THROWABLE_DEFS = {
  frag: {
    id: "frag", name: "Frag", kind: "lethal", rank: 0,
    carried: 2, fuse: 3.2, cookable: true,
    radius: 8, damage: 190, minDamage: 20, selfMult: 0.75,
    throwSpeed: 20, bounce: 0.32, roll: 0.55,
    color: 0x4b5a3c, glow: 0xff7a2a,
    blurb: "Cook it, bounce it round the corner, count to three.",
  },
  firebomb: {
    id: "firebomb", name: "Firebomb", kind: "lethal", rank: 12,
    carried: 1, fuse: 4, impact: true,
    radius: 3, damage: 45, minDamage: 10, selfMult: 1,
    pool: { radius: 4.4, dps: 85, duration: 7.5 },
    throwSpeed: 18, bounce: 0, roll: 0,
    color: 0x8a5a2a, glow: 0xff9430,
    blurb: "Breaks where it lands and denies the room for seven seconds.",
  },
  flash: {
    id: "flash", name: "Flashbang", kind: "tactical", rank: 0,
    carried: 2, fuse: 1.9, cookable: true,
    radius: 13, damage: 0, minDamage: 0, selfMult: 1,
    blind: 4.2, stun: 3.4,
    throwSpeed: 21, bounce: 0.45, roll: 0.7,
    color: 0x8f959c, glow: 0xffffff,
    blurb: "No damage. Everything in the room forgets what it was doing.",
  },
  smoke: {
    id: "smoke", name: "Smoke", kind: "tactical", rank: 4,
    carried: 2, fuse: 1.6,
    radius: 0, damage: 0, minDamage: 0, selfMult: 1,
    smoke: { radius: 5.2, duration: 16, grow: 1.6 },
    throwSpeed: 19, bounce: 0.3, roll: 0.62,
    color: 0x5c6169, glow: 0xd8dde3,
    blurb: "Buys you the crossing. Nobody sees through it — including you.",
  },
  emp: {
    id: "emp", name: "EMP", kind: "tactical", rank: 9,
    carried: 1, fuse: 2.4, cookable: true,
    radius: 11, damage: 0, minDamage: 0, selfMult: 1,
    emp: { scramble: 6.5, drain: true },
    throwSpeed: 20, bounce: 0.4, roll: 0.5,
    color: 0x2d4a55, glow: 0x4fd6ff,
    blurb: "Kills optics, HUD and radar in the blast. Sights go dark, not you.",
  },
};

export const THROWABLE_IDS = Object.keys(THROWABLE_DEFS);
export const LETHAL_IDS = THROWABLE_IDS.filter((id) => THROWABLE_DEFS[id].kind === "lethal");
export const TACTICAL_IDS = THROWABLE_IDS.filter((id) => THROWABLE_DEFS[id].kind === "tactical");

/* Sphere vs AABB: pushes `pos` out of the box along the shallowest axis and
   returns that axis so the caller can reflect velocity on it. AABB-only
   collision means a grenade can only ever bounce off an axis plane, which is
   exactly what the rest of this game's collision assumes. */
function resolveSphere(pos, colliders) {
  for (const c of colliders) {
    if (pos.x + RADIUS < c.min.x || pos.x - RADIUS > c.max.x) continue;
    if (pos.y + RADIUS < c.min.y || pos.y - RADIUS > c.max.y) continue;
    if (pos.z + RADIUS < c.min.z || pos.z - RADIUS > c.max.z) continue;

    const pen = {
      x: Math.min(pos.x + RADIUS - c.min.x, c.max.x - (pos.x - RADIUS)),
      y: Math.min(pos.y + RADIUS - c.min.y, c.max.y - (pos.y - RADIUS)),
      z: Math.min(pos.z + RADIUS - c.min.z, c.max.z - (pos.z - RADIUS)),
    };
    const axis = pen.x < pen.y ? (pen.x < pen.z ? "x" : "z") : (pen.y < pen.z ? "y" : "z");
    const centre = (c.min[axis] + c.max[axis]) / 2;
    const sign = pos[axis] < centre ? -1 : 1;
    pos[axis] += sign * pen[axis];
    return { axis, sign };
  }
  return null;
}

class Grenade {
  constructor(def, origin, dir, speed, ownerId, fuseLeft) {
    this.def = def;
    this.ownerId = ownerId;
    this.pos = origin.clone();
    this.vel = dir.clone().multiplyScalar(speed);
    this.fuse = fuseLeft;
    this.resting = false;
    this.spin = new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  }
}

class FirePool {
  constructor(def, pos) {
    this.def = def;
    this.pos = pos.clone();
    this.life = def.pool.duration;
    this.tick = 0;
  }
}

/* A smoke cloud is a clump of drifting billboards rather than one sphere:
   overlapping soft puffs read as volume from outside and as a wall from
   inside, which one transparent ball never does. `sightRadius` is what
   line-of-sight tests use, and it grows in as the cloud actually fills. */
const PUFFS = 14;

class SmokeCloud {
  constructor(def, pos) {
    this.def = def;
    this.pos = pos.clone();
    this.pos.y = Math.max(this.pos.y, 0.4);
    this.life = def.smoke.duration;
    this.age = 0;
    this.puffs = [];
    for (let i = 0; i < PUFFS; i++) {
      // Spread through the volume, biased low and wide like real smoke.
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * def.smoke.radius * 0.78;
      this.puffs.push({
        offset: new THREE.Vector3(Math.cos(a) * r, Math.random() * def.smoke.radius * 0.62, Math.sin(a) * r),
        drift: new THREE.Vector3((Math.random() - 0.5) * 0.16, 0.06 + Math.random() * 0.1, (Math.random() - 0.5) * 0.16),
        scale: def.smoke.radius * (0.5 + Math.random() * 0.45),
        spin: (Math.random() - 0.5) * 0.5,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  /* 0 while the canister is still venting, 1 once it's a full wall. */
  get fill() {
    const inT = Math.min(1, this.age / this.def.smoke.grow);
    const outT = Math.min(1, this.life / 2.2);
    return Math.min(inT, outT);
  }

  get sightRadius() { return this.def.smoke.radius * this.fill; }

  blocks(a, b) {
    if (this.fill < 0.25) return false;
    return segmentHitsSphere(a, b, this.pos, this.sightRadius);
  }
}

/* Does the segment a→b pass within `radius` of `centre`? Used for smoke
   line-of-sight; the same closest-point-on-segment test the bots use. */
export function segmentHitsSphere(a, b, centre, radius) {
  if (radius <= 0) return false;
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const acx = centre.x - a.x, acy = centre.y - a.y, acz = centre.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  let t = len2 > 0 ? (acx * abx + acy * aby + acz * abz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = acx - abx * t, dy = acy - aby * t, dz = acz - abz * t;
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

/* Soft round blob, drawn once and shared by every puff. Canvas rather than
   an image file keeps this dependency-free and out of the CSP's way. */
function makePuffTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.72)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class GrenadeSystem {
  /* `lights`: the shared LightPool (light-pool.js). Grenades never add
     lights of their own; see that file for why. */
  constructor(scene, lights = null) {
    this.scene = scene;
    this.lights = lights;
    this.live = [];
    this.pools = [];
    this.clouds = [];
    this.spent = new Set();   // grenade ids already detonated, so a late `boom` can't double up
    this.root = new THREE.Group();
    scene.add(this.root);
    this.geo = new THREE.IcosahedronGeometry(RADIUS, 0);
    this.mats = new Map();
    this.fireGeo = new THREE.CircleGeometry(1, 20);
    this.puffGeo = new THREE.PlaneGeometry(1, 1);
    this.puffTex = makePuffTexture();
  }

  matFor(def) {
    if (!this.mats.has(def.id)) {
      this.mats.set(def.id, new THREE.MeshStandardMaterial({
        color: def.color, roughness: 0.6, metalness: 0.35,
        emissive: new THREE.Color(def.glow), emissiveIntensity: 0.25,
      }));
    }
    return this.mats.get(def.id);
  }

  /* `fuseLeft` lets a cooked grenade leave the hand already ticking. */
  /* `remote` marks someone else's grenade, rendered here from their `throw`
     message: it flies and goes off on screen, but never deals damage — the
     thrower's client already resolved that and reported the hits. Its fuse
     runs a little long so the thrower's `boom` (with the real position)
     normally arrives first; if it never does, it goes off where it lies. */
  throwGrenade(def, origin, dir, ownerId = "player", { power = 1, fuseLeft = null, remote = false, gid = null, team = null } = {}) {
    const g = new Grenade(def, origin, dir, def.throwSpeed * power, ownerId, fuseLeft ?? def.fuse);
    g.remote = remote;
    g.gid = gid;
    g.team = team;
    if (remote) g.fuse += 0.8;
    // Its own copy of the material (same shader, no compile) so the fuse
    // blink can drive its glow. This used to be a PointLight per grenade.
    g.mesh = new THREE.Mesh(this.geo, this.matFor(def).clone());
    g.mesh.position.copy(g.pos);
    this.root.add(g.mesh);
    this.live.push(g);
    return g;
  }

  /* The thrower says it went off at `pos`. Detonate our copy there — or, for
     a grenade we never saw thrown (cooked off in their hand, or the `throw`
     was lost), a fresh one on the spot. */
  remoteBoom(gid, def, pos, ownerId, team, ctx) {
    if (this.spent.has(gid)) return;   // our fallback fuse already set it off
    let i = this.live.findIndex((g) => g.remote && g.gid === gid);
    if (i < 0) {
      this.throwGrenade(def, pos, new THREE.Vector3(0, -1, 0), ownerId, { power: 0, remote: true, gid, team });
      i = this.live.length - 1;
    }
    this.live[i].pos.copy(pos);
    this.detonate(i, ctx);
  }

  clear() {
    for (const g of this.live) { this.root.remove(g.mesh); g.mesh.material.dispose(); }
    for (const p of this.pools) { this.root.remove(p.mesh); this.lights?.release(p.light); }
    for (const c of this.clouds) {
      for (const puff of c.puffs) puff.mesh.material.dispose();
      this.root.remove(c.group);
    }
    this.live.length = 0;
    this.pools.length = 0;
    this.clouds.length = 0;
  }

  /* ctx: { colliders, arena, onExplode(def, pos), onAreaDamage(pos, radius, damage, def) } */
  update(dt, ctx) {
    const { colliders = [], arena, onExplode, onAreaDamage } = ctx;

    for (let i = this.live.length - 1; i >= 0; i--) {
      const g = this.live[i];
      const def = g.def;

      if (!g.resting) {
        g.vel.y -= GRAVITY * dt;
        g.pos.addScaledVector(g.vel, dt);

        // ground
        if (g.pos.y - RADIUS <= 0) {
          g.pos.y = RADIUS;
          if (def.impact && !g.remote) { this.detonate(i, ctx); continue; }
          g.vel.y = Math.abs(g.vel.y) * def.bounce;
          g.vel.x *= def.roll;
          g.vel.z *= def.roll;
        }

        const hit = resolveSphere(g.pos, colliders);
        if (hit) {
          if (def.impact && !g.remote) { this.detonate(i, ctx); continue; }
          // A remote impact grenade waits for the thrower's `boom` instead of
          // guessing — it would otherwise go off twice.
          if (def.impact) { g.vel.set(0, 0, 0); g.resting = true; }
          g.vel[hit.axis] = -g.vel[hit.axis] * def.bounce;
          const other = hit.axis === "y" ? ["x", "z"] : ["x", "y", "z"].filter((a) => a !== hit.axis);
          for (const a of other) g.vel[a] *= def.roll;
        }

        if (arena) {
          g.pos.x = Math.max(arena.minX + RADIUS, Math.min(arena.maxX - RADIUS, g.pos.x));
          g.pos.z = Math.max(arena.minZ + RADIUS, Math.min(arena.maxZ - RADIUS, g.pos.z));
        }

        if (g.vel.lengthSq() < REST_SPEED * REST_SPEED && g.pos.y <= RADIUS + 0.02) {
          g.resting = true;
          g.vel.set(0, 0, 0);
        }
      }

      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += g.spin.x * dt;
      g.mesh.rotation.y += g.spin.y * dt;

      g.fuse -= dt;
      // Blink faster as the fuse runs out — the only warning anyone gets.
      const blink = Math.max(0.08, g.fuse * 0.25);
      g.mesh.material.emissiveIntensity = (Math.sin(g.fuse / blink * Math.PI * 2) > 0 ? 1.6 : 0.15) * (def.kind === "tactical" ? 0.7 : 1);
      if (g.fuse <= 0) { this.detonate(i, ctx); continue; }
    }

    // ---- lingering fire
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const p = this.pools[i];
      p.life -= dt;
      p.tick += dt;
      const fade = Math.min(1, p.life / 1.2);
      if (p.mesh) {
        p.mesh.material.opacity = 0.5 * fade;
        p.mesh.scale.setScalar(p.def.pool.radius * (0.94 + Math.sin(p.tick * 7) * 0.05));
      }
      if (p.light) p.light.intensity = (9 + Math.sin(p.tick * 13) * 3) * fade;
      // Damage ticks four times a second rather than per frame, so a fast
      // machine doesn't burn people faster than a slow one.
      while (p.tick >= 0.25 && p.life > 0) {
        p.tick -= 0.25;
        // Someone else's fire is theirs to score; ours only shows it.
        if (!p.remote) onAreaDamage?.(p.pos, p.def.pool.radius, p.def.pool.dps * 0.25, p.def, { fire: true, botId: p.botId });
      }
      if (p.life <= 0) {
        this.root.remove(p.mesh);
        this.lights?.release(p.light);
        p.light = null;
        // the disc geometry is shared, so only the per-pool material is freed
        p.mesh?.material?.dispose?.();
        this.pools.splice(i, 1);
      }
    }
  }

  detonate(index, ctx) {
    const g = this.live[index];
    this.live.splice(index, 1);
    this.root.remove(g.mesh);
    g.mesh.material.dispose();
    const def = g.def;
    if (g.gid) {
      this.spent.add(g.gid);
      if (this.spent.size > 64) this.spent.delete(this.spent.values().next().value);
    }

    ctx.onExplode?.(def, g.pos.clone());
    // `botId`: a bot we simulate threw it, so the blast is the bot's to score.
    if (def.damage > 0 && !g.remote) ctx.onAreaDamage?.(g.pos.clone(), def.radius, def.damage, def, { botId: g.botId });
    // Flash/EMP get the grenade too: whose it was decides who it affects.
    if (def.blind) ctx.onFlash?.(g.pos.clone(), def, g);
    if (def.emp) ctx.onEmp?.(g.pos.clone(), def, g);
    if (!g.remote) ctx.onDetonate?.(g, g.pos.clone());

    if (def.smoke) this.spawnSmoke(def, g.pos);

    if (def.pool) {
      const p = new FirePool(def, g.pos);
      p.remote = !!g.remote;
      p.botId = g.botId || null;
      p.mesh = new THREE.Mesh(this.fireGeo, new THREE.MeshBasicMaterial({
        color: def.glow, transparent: true, opacity: 0.5, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      p.mesh.rotation.x = -Math.PI / 2;
      p.mesh.position.set(g.pos.x, g.pos.y - RADIUS + 0.05, g.pos.z);
      p.mesh.scale.setScalar(def.pool.radius);
      p.light = this.lights?.acquire("point", this.root, { color: def.glow, intensity: 10, distance: def.pool.radius * 2.4 }) || null;
      p.light?.position.set(g.pos.x, g.pos.y + 0.8, g.pos.z);
      this.root.add(p.mesh);
      this.pools.push(p);
    }
  }

  spawnSmoke(def, pos) {
    const cloud = new SmokeCloud(def, pos);
    cloud.group = new THREE.Group();
    for (const puff of cloud.puffs) {
      puff.mesh = new THREE.Mesh(this.puffGeo, new THREE.MeshBasicMaterial({
        map: this.puffTex, color: def.color, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide, fog: true,
      }));
      puff.mesh.position.copy(cloud.pos).add(puff.offset);
      puff.mesh.scale.setScalar(puff.scale);
      cloud.group.add(puff.mesh);
    }
    this.root.add(cloud.group);
    this.clouds.push(cloud);
    return cloud;
  }

  /* True if smoke stands between these two points — the reason smoke is
     worth throwing. Bots and the flashbang both ask this. */
  blocksSight(a, b) {
    for (const c of this.clouds) if (c.blocks(a, b)) return true;
    return false;
  }

  /* How thick the smoke is at a point, 0..1 — drives the screen haze when
     you're the one standing inside it. */
  densityAt(point) {
    let d = 0;
    for (const c of this.clouds) {
      const r = c.sightRadius;
      if (r <= 0) continue;
      const dist = c.pos.distanceTo(point);
      if (dist < r) d = Math.max(d, (1 - dist / r) * c.fill);
    }
    return Math.min(1, d);
  }

  updateSmoke(dt, camera) {
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.life -= dt;
      c.age += dt;
      const fill = c.fill;

      for (const puff of c.puffs) {
        puff.offset.addScaledVector(puff.drift, dt);
        // Keep the cloud from climbing off its own footprint.
        if (puff.offset.y > c.def.smoke.radius * 0.85) puff.drift.y *= -0.4;
        puff.mesh.position.copy(c.pos).add(puff.offset);
        puff.mesh.scale.setScalar(puff.scale * (0.55 + fill * 0.45) * (1 + Math.sin(c.age * 0.9 + puff.phase) * 0.05));
        puff.mesh.material.opacity = 0.5 * fill;
        // Face the camera, then roll around the view axis, so the spin
        // survives the billboarding instead of being overwritten by it.
        puff.roll = (puff.roll ?? puff.phase) + puff.spin * dt;
        if (camera) {
          puff.mesh.quaternion.copy(camera.quaternion);
          puff.mesh.rotateZ(puff.roll);
        }
      }

      if (c.life <= 0) {
        for (const puff of c.puffs) puff.mesh.material.dispose();
        this.root.remove(c.group);
        this.clouds.splice(i, 1);
      }
    }
  }
}

/* Blast falloff: full damage at the centre, `minDamage` at the edge. */
export function blastDamage(def, distance) {
  if (distance >= def.radius) return 0;
  const t = 1 - distance / def.radius;
  return def.minDamage + (def.damage - def.minDamage) * t * t;
}
