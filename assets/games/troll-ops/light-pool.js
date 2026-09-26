// Troll Forces — a fixed set of dynamic lights, borrowed and handed back.
//
// three.js builds every lit shader for an exact light count. Adding a light to
// the scene (a grenade's glow, a blast flash, a fire pool) and removing it
// again changes that count, and every lit material in view recompiles on the
// next frame: a freeze of a second or more on a laptop GPU, once per new
// count, which is the "laggy for the first 30 seconds, then smooth" the game
// had. So the lights all exist from the start, parked at zero intensity, and
// moving one between parents never changes the count.
//
// Sized small on purpose: every light, even at zero, is a loop iteration in
// every lit fragment. When the pool is empty, acquire() returns null and the
// caller simply goes without; these are all visual extras.

import * as THREE from "three";

const POINTS = 3;   // blast flashes and fire pools, rarely more than 3 at once
const SPOTS = 1;    // the gunship's searchlight

export class LightPool {
  constructor(scene) {
    this.home = new THREE.Group();
    this.home.name = "light-pool";
    scene.add(this.home);
    this.free = { point: [], spot: [] };
    for (let i = 0; i < POINTS; i++) this.park(new THREE.PointLight(0xffffff, 0, 1, 2), "point");
    for (let i = 0; i < SPOTS; i++) {
      const s = new THREE.SpotLight(0xffffff, 0, 1, 0.3, 0.5, 1.4);
      s.userData.homeTarget = s.target;
      this.home.add(s.target);
      this.park(s, "spot");
    }
  }

  park(light, kind) {
    light.intensity = 0;
    light.userData.poolKind = kind;
    this.home.add(light);
    light.position.set(0, -500, 0);
    this.free[kind].push(light);
  }

  /* A light of `kind` ("point" | "spot") moved under `parent` (which must be
     in the scene), or null when they're all out. */
  acquire(kind, parent, { color = 0xffffff, intensity = 0, distance = 0, decay = 2, angle, penumbra } = {}) {
    const light = this.free[kind].pop();
    if (!light) return null;
    light.color.set(color);
    light.intensity = intensity;
    light.distance = distance;
    light.decay = decay;
    if (angle != null) light.angle = angle;
    if (penumbra != null) light.penumbra = penumbra;
    light.position.set(0, 0, 0);
    parent.add(light);
    return light;
  }

  release(light) {
    if (!light || !light.userData.poolKind) return;
    if (light.userData.homeTarget) light.target = light.userData.homeTarget;
    this.park(light, light.userData.poolKind);
  }
}
