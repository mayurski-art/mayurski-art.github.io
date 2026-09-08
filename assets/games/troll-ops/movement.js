// Troll Ops — Phantom Forces movement.
//
// PF players describe that game by how it moves before how it shoots, so this
// module owns the whole stance machine: sprint, slide, dive-to-prone, vault
// over waist-high geometry, and lean peeking.
//
// Position is tracked at the FEET (not the eye, as the old controller did), so
// stance changes are just a change of eye height and crates become walkable
// surfaces instead of invisible walls.

import * as THREE from "three";

export const STANCE = { STAND: "stand", CROUCH: "crouch", SLIDE: "slide", PRONE: "prone", VAULT: "vault" };

const EYE = { stand: 1.68, crouch: 1.05, slide: 0.82, prone: 0.5, vault: 1.2 };
const STANCE_SPEED = { stand: 1, crouch: 0.48, slide: 1, prone: 0.22, vault: 0 };

const WALK_SPEED = 5.2;
const GRAVITY = 22;
const JUMP_SPEED = 7.0;
const RADIUS = 0.35;
const STEP_UP = 0.36;        // ledges at or below this are walked over, not blocked

const SLIDE_BOOST = 1.55;    // multiplier on entry speed
const SLIDE_TIME = 0.85;
const SLIDE_COOLDOWN = 0.7;  // stops slide-spam becoming the fastest way to move
const SLIDE_MIN_SPEED = 3.2; // must actually be moving to start one

const DIVE_FORWARD = 9.5;
const DIVE_UP = 3.4;
const DIVE_RECOVER = 0.75;   // locked out of standing while you pick yourself up

const VAULT_TIME = 0.34;
const VAULT_MIN = 0.35;      // ledge heights we can mantle, relative to the feet
const VAULT_MAX = 1.55;
const VAULT_REACH = 1.05;

const LEAN_ANGLE = 0.24;     // radians of camera roll at full lean
const LEAN_OFFSET = 0.42;    // metres the head shifts sideways
const LEAN_SPEED = 8;

/* Highest walkable surface under (x,z) that isn't above `ceiling`.
   Shared with the enemy AI so grunts stand on platforms too. */
export function groundHeightAt(colliders, x, z, ceiling, radius = RADIUS * 0.8) {
  let best = 0;
  for (const c of colliders) {
    if (c.max.y > ceiling + 1e-3) continue;
    if (x < c.min.x - radius || x > c.max.x + radius) continue;
    if (z < c.min.z - radius || z > c.max.z + radius) continue;
    if (c.max.y > best) best = c.max.y;
  }
  return best;
}

/* Push a circle out of anything tall enough to block it at this feet height. */
export function resolveCircle(colliders, pos, radius, feetY, headroom = 2, stepUp = STEP_UP) {
  for (const c of colliders) {
    if (c.max.y <= feetY + stepUp) continue;       // low enough to walk onto
    if (c.min.y > feetY + headroom) continue;      // overhead, we pass under
    const cx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
    const cz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      const push = radius - d;
      pos.x += (dx / d) * push;
      pos.z += (dz / d) * push;
    } else if (d2 <= 1e-6) {
      // Centre is inside the box, so there's no push direction to derive —
      // leave by the nearest face instead of always heading +x, which can't
      // escape a wall that spans that axis.
      const toMinX = pos.x - c.min.x, toMaxX = c.max.x - pos.x;
      const toMinZ = pos.z - c.min.z, toMaxZ = c.max.z - pos.z;
      const m = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
      if (m === toMinX) pos.x = c.min.x - radius;
      else if (m === toMaxX) pos.x = c.max.x + radius;
      else if (m === toMinZ) pos.z = c.min.z - radius;
      else pos.z = c.max.z + radius;
    }
  }
}

export class MovementController {
  constructor({ colliders, arena }) {
    this.colliders = colliders;
    this.arena = arena;

    this.pos = new THREE.Vector3(0, 0, 8);      // feet
    this.velocity = new THREE.Vector3();
    this.stance = STANCE.STAND;
    this.grounded = true;
    this.jumping = false;
    this.sprinting = false;
    this.moving = false;

    this.eyeHeight = EYE.stand;
    this.lean = 0;                               // smoothed -1..1
    this.leanRoll = 0;
    this.leanOffset = new THREE.Vector3();

    this.slideT = 0;
    this.slideCd = 0;
    this.slideDir = new THREE.Vector3();
    this.diveT = 0;
    this.vault = null;

    this._prevJump = false;
    this._prevCrouch = false;
    this._prevDive = false;
  }

  /* `y` is the floor to stand on — multi-storey maps spawn above ground. */
  reset(x, z, y = 0) {
    this.pos.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.stance = STANCE.STAND;
    this.eyeHeight = EYE.stand;
    this.slideT = this.slideCd = this.diveT = 0;
    this.vault = null;
    this.lean = 0;
    this.grounded = true;
  }

  get crouched() { return this.stance === STANCE.CROUCH || this.stance === STANCE.SLIDE || this.stance === STANCE.PRONE; }
  get busy() { return this.stance === STANCE.VAULT || this.diveT > 0; }

  groundHeightAt(x, z, ceiling) {
    return groundHeightAt(this.colliders, x, z, ceiling);
  }

  resolveHorizontal(pos, feetY) {
    // Bounds first, geometry second. A map's bounds can sit outside its
    // perimeter wall, and clamping last would shove us back into that wall
    // with no way out.
    const a = this.arena;
    pos.x = Math.max(a.minX + RADIUS, Math.min(a.maxX - RADIUS, pos.x));
    pos.z = Math.max(a.minZ + RADIUS, Math.min(a.maxZ - RADIUS, pos.z));
    resolveCircle(this.colliders, pos, RADIUS, feetY, this.eyeHeight);
  }

  /* Is there a mantle-able ledge directly ahead? Returns the landing spot. */
  findVault(dir) {
    const feetY = this.pos.y;
    const probe = this.pos.clone().addScaledVector(dir, VAULT_REACH);
    let best = null;
    for (const c of this.colliders) {
      const top = c.max.y - feetY;
      if (top < VAULT_MIN || top > VAULT_MAX) continue;
      if (probe.x < c.min.x - RADIUS || probe.x > c.max.x + RADIUS) continue;
      if (probe.z < c.min.z - RADIUS || probe.z > c.max.z + RADIUS) continue;
      if (!best || c.max.y > best.max.y) best = c;
    }
    if (!best) return null;

    const landing = this.pos.clone().addScaledVector(dir, VAULT_REACH + RADIUS * 2);
    landing.y = best.max.y;
    // Refuse if something taller is sitting where we'd land.
    for (const c of this.colliders) {
      if (c === best) continue;
      if (c.max.y <= landing.y + 0.2) continue;
      if (landing.x < c.min.x - RADIUS || landing.x > c.max.x + RADIUS) continue;
      if (landing.z < c.min.z - RADIUS || landing.z > c.max.z + RADIUS) continue;
      return null;
    }
    return landing;
  }

  /* input: { forward, strafe, sprint, jump, crouch, dive, leanDir, yaw, adsHeld, speedMult } */
  update(dt, input) {
    const { yaw, speedMult = 1 } = input;

    this.slideCd = Math.max(0, this.slideCd - dt);
    if (this.diveT > 0) this.diveT = Math.max(0, this.diveT - dt);

    // ---- vault runs to completion, ignoring normal physics
    if (this.vault) {
      this.vault.t += dt;
      const k = Math.min(1, this.vault.t / VAULT_TIME);
      const ease = k * k * (3 - 2 * k);
      this.pos.lerpVectors(this.vault.from, this.vault.to, ease);
      this.pos.y = this.vault.from.y + (this.vault.to.y - this.vault.from.y) * ease + Math.sin(k * Math.PI) * 0.18;
      if (k >= 1) {
        this.pos.copy(this.vault.to);
        this.vault = null;
        this.stance = STANCE.STAND;
        this.velocity.set(0, 0, 0);
        this.grounded = true;
      }
      this.applyEye(dt, input.leanDir, yaw);
      return;
    }

    // ---- facing vectors
    const forwardVec = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const rightVec = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    const ix = input.strafe, iz = input.forward;
    const inputLen = Math.hypot(ix, iz);
    this.moving = inputLen > 0.05;

    const wantSprint = input.sprint && this.moving && iz > 0.1 && !input.adsHeld;
    const jumpEdge = input.jump && !this._prevJump;
    const crouchEdge = input.crouch && !this._prevCrouch;
    const diveEdge = input.dive && !this._prevDive;
    this._prevJump = input.jump;
    this._prevCrouch = input.crouch;
    this._prevDive = input.dive;

    const planarSpeed = Math.hypot(this.velocity.x, this.velocity.z);

    // ---- dive: launch from a sprint, land prone
    if (diveEdge && this.grounded && this.diveT <= 0 && this.stance !== STANCE.PRONE && planarSpeed > SLIDE_MIN_SPEED) {
      const d = new THREE.Vector3().addScaledVector(forwardVec, iz).addScaledVector(rightVec, ix);
      if (d.lengthSq() < 1e-4) d.copy(forwardVec);
      d.normalize();
      this.velocity.x = d.x * DIVE_FORWARD;
      this.velocity.z = d.z * DIVE_FORWARD;
      this.velocity.y = DIVE_UP;
      this.grounded = false;
      this.stance = STANCE.PRONE;
      this.diveT = DIVE_RECOVER;
    }

    // ---- slide: crouch out of a sprint
    if (crouchEdge && this.grounded && this.slideCd <= 0 && this.diveT <= 0 &&
        this.stance === STANCE.STAND && wantSprint && planarSpeed > SLIDE_MIN_SPEED) {
      this.stance = STANCE.SLIDE;
      this.slideT = SLIDE_TIME;
      this.slideDir.set(this.velocity.x, 0, this.velocity.z).normalize();
      const boosted = planarSpeed * SLIDE_BOOST;
      this.velocity.x = this.slideDir.x * boosted;
      this.velocity.z = this.slideDir.z * boosted;
    } else if (crouchEdge && this.diveT <= 0) {
      if (this.stance === STANCE.STAND) this.stance = STANCE.CROUCH;
      else if (this.stance === STANCE.CROUCH || this.stance === STANCE.PRONE) this.stance = STANCE.STAND;
    }

    // ---- slide decay
    if (this.stance === STANCE.SLIDE) {
      this.slideT -= dt;
      const decay = Math.max(0, this.slideT / SLIDE_TIME);
      const target = WALK_SPEED * (0.55 + decay * 1.1);
      const cur = Math.hypot(this.velocity.x, this.velocity.z) || 1;
      const scale = Math.min(1, target / cur);
      this.velocity.x *= scale;
      this.velocity.z *= scale;
      if (this.slideT <= 0 || !this.grounded) {
        this.stance = this.grounded ? STANCE.CROUCH : STANCE.STAND;
        this.slideCd = SLIDE_COOLDOWN;
      }
    }

    this.sprinting = wantSprint && this.stance === STANCE.STAND && this.grounded;

    // ---- vault or jump
    if (jumpEdge && !this.busy) {
      const d = new THREE.Vector3().addScaledVector(forwardVec, iz).addScaledVector(rightVec, ix);
      const dir = d.lengthSq() > 1e-4 ? d.normalize() : forwardVec.clone();
      const landing = this.grounded || this.velocity.y < 2 ? this.findVault(dir) : null;
      if (landing) {
        this.vault = { from: this.pos.clone(), to: landing, t: 0 };
        this.stance = STANCE.VAULT;
        this.velocity.set(0, 0, 0);
      } else if (this.grounded) {
        if (this.stance === STANCE.CROUCH || this.stance === STANCE.PRONE) {
          this.stance = STANCE.STAND;
        } else {
          this.velocity.y = JUMP_SPEED;
          this.grounded = false;
          this.jumping = true;
          if (this.stance === STANCE.SLIDE) { this.stance = STANCE.STAND; this.slideCd = SLIDE_COOLDOWN; }
        }
      }
    }

    // ---- horizontal acceleration (no steering authority mid-slide)
    const stanceMult = STANCE_SPEED[this.stance] ?? 1;
    const sprintMult = this.sprinting ? (input.sprintMult || 1.35) : 1;
    const target = WALK_SPEED * stanceMult * sprintMult * speedMult;
    const inertia = input.inertia || 9;

    if (this.stance !== STANCE.SLIDE) {
      if (this.moving) {
        const nx = ix / inputLen, nz = iz / inputLen;
        const moveDir = new THREE.Vector3()
          .addScaledVector(forwardVec, nz)
          .addScaledVector(rightVec, nx);
        if (moveDir.lengthSq() > 0) moveDir.normalize();
        const air = this.grounded ? 1 : 0.35;
        this.velocity.x += (moveDir.x * target - this.velocity.x) * Math.min(1, dt * inertia * air);
        this.velocity.z += (moveDir.z * target - this.velocity.z) * Math.min(1, dt * inertia * air);
      } else if (this.grounded) {
        this.velocity.x += (0 - this.velocity.x) * Math.min(1, dt * inertia);
        this.velocity.z += (0 - this.velocity.z) * Math.min(1, dt * inertia);
      }
    }

    // ---- integrate
    this.velocity.y -= GRAVITY * dt;
    this.pos.x += this.velocity.x * dt;
    this.pos.z += this.velocity.z * dt;
    this.pos.y += this.velocity.y * dt;

    this.resolveHorizontal(this.pos, this.pos.y);

    const support = this.groundHeightAt(this.pos.x, this.pos.z, this.pos.y + STEP_UP);
    if (this.pos.y <= support) {
      const wasFalling = this.velocity.y < -6;
      this.pos.y = support;
      this.velocity.y = 0;
      if (!this.grounded && this.stance === STANCE.PRONE && this.diveT > 0) {
        // landed the dive — skid to a stop
        this.velocity.x *= 0.25;
        this.velocity.z *= 0.25;
      }
      this.grounded = true;
      this.jumping = false;
      if (wasFalling && this.stance === STANCE.SLIDE) this.stance = STANCE.CROUCH;
    } else {
      this.grounded = false;
    }

    this.applyEye(dt, input.leanDir, yaw);
  }

  /* Eye height + lean, with the lean blocked when it would put the head in a wall. */
  applyEye(dt, leanDir, yaw) {
    const targetEye = EYE[this.stance] ?? EYE.stand;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, dt * 12);

    const canLean = this.stance !== STANCE.SLIDE && this.stance !== STANCE.PRONE && this.stance !== STANCE.VAULT;
    let want = canLean ? (leanDir || 0) : 0;

    if (want !== 0) {
      const rightVec = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const head = this.pos.clone();
      head.y += this.eyeHeight;
      head.addScaledVector(rightVec, want * LEAN_OFFSET);
      for (const c of this.colliders) {
        if (head.y < c.min.y || head.y > c.max.y) continue;
        if (head.x < c.min.x - 0.18 || head.x > c.max.x + 0.18) continue;
        if (head.z < c.min.z - 0.18 || head.z > c.max.z + 0.18) continue;
        want = 0;
        break;
      }
    }

    this.lean += (want - this.lean) * Math.min(1, dt * LEAN_SPEED);
    this.leanRoll = -this.lean * LEAN_ANGLE;
    const rightVec = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    this.leanOffset.copy(rightVec).multiplyScalar(this.lean * LEAN_OFFSET);
  }

  /* Where the camera goes this frame. */
  eyePosition(out = new THREE.Vector3()) {
    return out.copy(this.pos).add(this.leanOffset).setY(this.pos.y + this.eyeHeight);
  }
}
