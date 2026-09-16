// Troll Ops — end-of-life kill cam.
//
// PvP dying already freezes the player's own camera (updatePlayer's `frozen`
// branch) for the few seconds before respawn. This borrows exactly that
// window: for DURATION seconds after a death, the main camera is driven by
// KillCam instead of the player's look state, orbiting from the killer's
// position toward where the player fell. No new render target, no second
// composer pass — it's the same `camera` object, just puppeted briefly.
//
// Authority-free by design: everyone already renders a copy of every other
// player and bot (remote-players.js / bots.js), so the killer's position at
// the moment of death is just read off whichever of those two owns that id.
// Nothing is simulated for the cam and nothing is sent over the wire.

import * as THREE from "three";

export const KILLCAM_DURATION = 2.6; // seconds, camera-only — respawn timing is untouched
const ORBIT_RADIUS = 3.2;
const ORBIT_HEIGHT = 1.7;
const LOOK_HEIGHT = 1.5;

export class KillCam {
  constructor(camera) {
    this.camera = camera;
    this.active = false;
    this.t = 0;
    this.killerPos = new THREE.Vector3();
    this.deathPos = new THREE.Vector3();
    this.startYaw = 0;
    this._tmp = new THREE.Vector3();
  }

  /* `killerPos` may be null (killed by a scorestreak entity with no seat to
     orbit, or the killer despawned the instant it fired) — in that case the
     cam holds a slow orbit around the death spot instead of pointing at
     nothing. */
  start(deathPos, killerPos) {
    this.active = true;
    this.t = 0;
    this.deathPos.copy(deathPos);
    if (killerPos) {
      this.killerPos.copy(killerPos);
      this.hasKiller = true;
    } else {
      this.hasKiller = false;
      this.killerPos.set(deathPos.x + ORBIT_RADIUS, deathPos.y, deathPos.z);
    }
    this.startYaw = Math.atan2(
      this.killerPos.x - deathPos.x,
      this.killerPos.z - deathPos.z,
    );
  }

  get done() { return this.t >= KILLCAM_DURATION; }

  /* Drives `camera` in place. Returns true while it still owns the camera,
     so the caller knows not to also run its own look/position code this
     frame. */
  update(dt) {
    if (!this.active) return false;
    this.t += dt;
    if (this.done) { this.active = false; return false; }

    const k = Math.min(1, this.t / KILLCAM_DURATION);
    // Ease in fast, hold, then drift — a hard cut to a moving shot reads
    // better than one that's already sweeping the instant it appears.
    const settle = Math.min(1, this.t / 0.4);
    const orbit = this.startYaw + k * 0.9 * (this.hasKiller ? 1 : 1.6);

    this._tmp.set(
      this.deathPos.x + Math.sin(orbit) * ORBIT_RADIUS * settle + (this.killerPos.x - this.deathPos.x) * (1 - settle),
      this.deathPos.y + ORBIT_HEIGHT,
      this.deathPos.z + Math.cos(orbit) * ORBIT_RADIUS * settle + (this.killerPos.z - this.deathPos.z) * (1 - settle),
    );
    this.camera.position.copy(this._tmp);

    const lookAt = this._lookAt || (this._lookAt = new THREE.Vector3());
    lookAt.set(this.deathPos.x, this.deathPos.y + LOOK_HEIGHT, this.deathPos.z);
    this.camera.lookAt(lookAt);
    return true;
  }

  cancel() {
    this.active = false;
    this.t = KILLCAM_DURATION;
  }
}
