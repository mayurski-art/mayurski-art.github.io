// Troll Forces — Kabukigrin's train (doc docs/KABUKIGRIN.md 3.5 f; phase 6):
// a six-car Yamanote-green commuter train along the south viaduct every
// PERIOD seconds, east to west, on the wall clock (every client sees it in
// the same place, nothing on the wire). The viaduct is the far city's
// (gj-skyline: deck top y 9.2 across x -130 .. 130, its tracks at z 42 and
// 44.4, a train parked on the second); this one runs the first, in the
// parked train's livery: silver, a green stripe, cool lit windows. Far over
// the 8 m blocks it never enters play: no colliders, no shadows. Its windows
// throw a pale strip of light that sweeps along the backs under it, and it
// rumbles past (the club's sfx "rumble", kabukigrin.js onFrame).

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { place } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1";

const PERIOD = 90;          // s from one train to the next
const SPEED = 16;           // m/s along the viaduct
const Z = 42.0, Y = 9.4;    // the free track's middle, the cars' floor
const DECK = 128;           // a car past this |x| is off the deck's end: not drawn
const CAR = 20.0, GAP = 0.4, N = 6, W = 2.9, H = 3.2;
const LENGTH = N * (CAR + GAP);
const START = DECK + 8, RUN = 2 * START + LENGTH;   // in at the east end, out at the west

let TRAIN = null;

/* One car's geometries by material, at the origin, its length along x. */
function carGeometry(cab) {
  const steel = [], green = [], lit = [], dark = [];
  steel.push(place(new THREE.BoxGeometry(CAR, H, W), { y: H / 2 }));
  green.push(place(new THREE.BoxGeometry(CAR + 0.02, 0.34, W + 0.02), { y: 1.0 }));
  green.push(place(new THREE.BoxGeometry(CAR + 0.02, 0.12, W + 0.02), { y: 2.68 }));
  dark.push(place(new THREE.BoxGeometry(CAR - 1.2, 0.5, W - 0.6), { y: -0.2 }));       // underframe
  for (const bx of [-CAR / 2 + 2.6, CAR / 2 - 2.6]) dark.push(place(new THREE.BoxGeometry(2.6, 0.55, W - 0.4), { x: bx, y: -0.28 }));   // bogies
  for (const side of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const wx = -8.6 + k * 2.85;
      lit.push(place(new THREE.PlaneGeometry(1.6, 0.9), { x: wx, y: 2.05, z: side * (W / 2 + 0.012), ry: side > 0 ? 0 : Math.PI }));
      if (k < 6) dark.push(place(new THREE.BoxGeometry(1.2, 1.9, 0.02), { x: wx + 1.42, y: 1.25, z: side * (W / 2 + 0.01) }));   // doors
    }
  }
  if (cab) {
    // the lead car's west face: a dark windscreen over the green band
    dark.push(place(new THREE.BoxGeometry(0.04, 1.1, W - 0.5), { x: -CAR / 2 - 0.02, y: 2.1 }));
    lit.push(place(new THREE.PlaneGeometry(0.5, 0.18), { x: -CAR / 2 - 0.045, y: 0.7, z: -0.8, ry: -Math.PI / 2 }));
    lit.push(place(new THREE.PlaneGeometry(0.5, 0.18), { x: -CAR / 2 - 0.045, y: 0.7, z: 0.8, ry: -Math.PI / 2 }));
  }
  return { steel, green, lit, dark };
}

/* The train and its light, parked out of sight till trainFrame runs it. */
export function buildTrain(root) {
  const mats = {
    // (not metal: there is no sky to mirror, and at night a metal body reads black)
    steel: new THREE.MeshStandardMaterial({ color: 0xd4d8de, metalness: 0.15, roughness: 0.4, emissive: 0x202630 }),
    green: new THREE.MeshStandardMaterial({ color: 0x38b048, roughness: 0.5, emissive: 0x0c2a10 }),
    lit: new THREE.MeshBasicMaterial({ color: 0xdfe8ff, toneMapped: false }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.7 }),
  };
  const group = new THREE.Group(), cars = [];
  for (let i = 0; i < N; i++) {
    const car = new THREE.Group(), parts = carGeometry(i === 0);
    for (const [k, list] of Object.entries(parts)) {
      const g = mergeGeometries(list, false);
      list.forEach((q) => q.dispose());
      car.add(new THREE.Mesh(g, mats[k]));
    }
    car.position.x = i * (CAR + GAP) + CAR / 2;
    group.add(car);
    cars.push(car);
  }
  // the window light down on the backs (north of the viaduct), as long as the train
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g = c.getContext("2d"), grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, "rgba(255,255,255,0)"); grad.addColorStop(0.5, "rgba(255,255,255,1)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const glow = new THREE.Mesh(place(new THREE.PlaneGeometry(LENGTH, 5), { x: LENGTH / 2, y: 0.03 - Y, z: -3.2, rx: -Math.PI / 2 }),
    new THREE.MeshBasicMaterial({ map: tex, color: 0xcfe0ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  group.add(glow);
  group.position.set(START, Y, Z);
  group.visible = false;
  group.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  root.add(group);
  TRAIN = { group, cars, glow };
  return TRAIN;
}

/* Each frame: where the train is on the clock; `sfx` (the club's), its
   rumble from the car nearest `ear` while it passes. */
let nextRumble = 0;
export function trainFrame(sfx, ear) {
  if (!TRAIN) return;
  const t = (Date.now() / 1000) % PERIOD, s = t * SPEED;
  const on = s < RUN;
  TRAIN.group.visible = on;
  if (!on) return;
  const x0 = START - s;   // the lead car's west end
  TRAIN.group.position.x = x0;
  for (const car of TRAIN.cars) car.visible = Math.abs(x0 + car.position.x) < DECK;
  TRAIN.glow.visible = Math.abs(x0 + LENGTH / 2) < DECK + LENGTH / 2;
  if (!sfx || !ear) return;
  const now = performance.now() / 1000;
  if (nextRumble > now) return;
  nextRumble = now + 0.3;
  const x = Math.min(x0 + LENGTH, Math.max(x0, ear.x));
  if (Math.abs(x) < DECK && Math.hypot(x - ear.x, Z - ear.z) < 70) sfx("rumble", { x, y: Y + 0.5, z: Z });
}

/* A frame off the clock, for tests: { visible, x } */
export function trainState() {
  return TRAIN ? { visible: TRAIN.group.visible, x: TRAIN.group.position.x } : null;
}
