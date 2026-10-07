// Troll Forces — Phantom Forces movement.
//
// PF players describe that game by how it moves before how it shoots, so this
// module owns the whole stance machine: sprint, slide, dive-to-prone, and
// vault over waist-high geometry.
//
// Position is tracked at the FEET (not the eye, as the old controller did), so
// stance changes are just a change of eye height and crates become walkable
// surfaces instead of invisible walls.

import * as THREE from "three";
import { smoothstep, damp } from "./anim-curves.js";
import { clampInsidePolygon } from "./edge.js";

export const STANCE = { STAND: "stand", CROUCH: "crouch", SLIDE: "slide", PRONE: "prone", VAULT: "vault", ROPE: "rope" };

const EYE = { stand: 1.68, crouch: 1.05, slide: 0.82, prone: 0.5, vault: 1.2, rope: 1.55 };
const STANCE_SPEED = { stand: 1, crouch: 0.48, slide: 1, prone: 0.22, vault: 0, rope: 0 };

const WALK_SPEED = 5.2;
const GRAVITY = 22;
const JUMP_SPEED = 7.0;
const GLIDE_FALL = 2.6;   // m/s: Super Troll's slow fall with jump held
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

// Ropes (a map's api.rope, after VALORANT's Split): walk into one to grab
// it, W climbs (down instead while looking down), jump lets go, and the
// top steps you off onto the floor there. Quiet, and you can shoot.
const ROPE_CLIMB_UP = 3.8;     // m/s: brisk, slower than a sprint
const ROPE_CLIMB_DOWN = 5.0;
const ROPE_ATTACH_R = 0.8;     // from the rope's axis
const ROPE_HANG = 0.5;         // the climber's axis sits this far off the rope
const ROPE_JUMP_OUT = 3.2;     // m/s away from the rope, jumping off
const ROPE_JUMP_UP = 4.2;
const ROPE_COOLDOWN = 0.45;    // s before you can grab again
const ROPE_LOOK_DOWN = -0.45;  // rad of pitch: below this, W climbs down

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
  constructor({ colliders, arena, tuning }) {
    this.colliders = colliders;
    this.arena = arena;

    // Optional per-instance overrides for the module's tuning constants —
    // used by movement-lab.html to feel out new values without touching
    // the constants every other caller (game.js, bots.js) still reads.
    // Omit `tuning` (every real call site does) and behavior is unchanged.
    this.tuning = {
      WALK_SPEED, GRAVITY, JUMP_SPEED,
      SLIDE_BOOST, SLIDE_TIME, SLIDE_COOLDOWN, DIVE_FORWARD,
      ...tuning,
    };

    this.pos = new THREE.Vector3(0, 0, 8);      // feet
    this.velocity = new THREE.Vector3();
    this.stance = STANCE.STAND;
    this.grounded = true;
    this.jumping = false;
    this.sprinting = false;
    this.moving = false;
    this.strafeInput = 0;
    this.justLanded = false;
    this.landSpeed = 0;

    this.eyeHeight = EYE.stand;

    this.slideT = 0;
    this.slideCd = 0;
    this.slideDir = new THREE.Vector3();
    this.diveT = 0;
    this.vault = null;
    this.rope = null;          // the rope we're on (arena.ropes)
    this.ropeCd = 0;
    this.ropeDown = false;     // grabbed from the top: W goes down until released

    this._prevJump = false;
    this._prevCrouch = false;
    this._prevDive = false;

    // U Mad Bro? heroes (game.js sets these per hero; 0/false = normal):
    // extra jumps in the air, a slow fall while jump is held, and a
    // knockback/dash impulse that steering can't fight for `impulseT` s.
    this.maxAirJumps = 0;
    this.airJumpsLeft = 0;
    this.glide = false;
    this.impulseT = 0;
  }

  /* Launch: set the velocity outright and hold off steering for `t` s. */
  impulse(vx, vy, vz, t = 0.35) {
    this.velocity.set(vx, vy, vz);
    if (vy > 0) { this.grounded = false; this.jumping = true; }
    this.impulseT = Math.max(this.impulseT, t);
  }

  /* `y` is the floor to stand on — multi-storey maps spawn above ground. */
  reset(x, z, y = 0) {
    this.pos.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.stance = STANCE.STAND;
    this.eyeHeight = EYE.stand;
    this.slideT = this.slideCd = this.diveT = this.impulseT = this.ropeCd = 0;
    this.vault = null;
    this.rope = null;
    this.grounded = true;
  }

  get onRope() { return this.stance === STANCE.ROPE; }

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
    // A coastline instead of a wall (Trollface Island): see edge.js.
    if (a.edge) clampInsidePolygon(pos, a.edge, RADIUS);
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

  /* A rope within reach at this height. `dir` is the way we're moving
     (null when we're only falling past): it has to point at the rope
     (within ~30°), so running along a wall past one doesn't grab it. */
  findRope(dir) {
    for (const r of this.arena.ropes || []) {
      if (this.pos.y < r.y0 - 0.3 || this.pos.y > r.y1 + 0.3) continue;
      const tx = r.x - this.pos.x, tz = r.z - this.pos.z;
      const d = Math.hypot(tx, tz);
      if (d > ROPE_ATTACH_R) continue;
      if (dir && d > 0.05 && (dir.x * tx + dir.z * tz) / d < 0.85) continue;
      return r;
    }
    return null;
  }

  grabRope(r) {
    this.rope = r;
    this.stance = STANCE.ROPE;
    this.slideT = 0;
    // From the top you're going down: W keeps going down until you let go
    // of it, so walking into the rope doesn't climb straight back out.
    this.ropeDown = this.pos.y > r.y1 - 0.5;
    this.pos.set(r.x - r.dx * ROPE_HANG, Math.max(r.y0, Math.min(this.pos.y, r.y1 - 0.7)), r.z - r.dz * ROPE_HANG);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.jumping = false;
  }

  leaveRope() {
    this.rope = null;
    this.stance = STANCE.STAND;
    this.ropeCd = ROPE_COOLDOWN;
  }

  /* One frame on the rope: pinned beside it, no gravity, no collision (a
     rope is hung in a clear shaft). Returns nothing; the caller returns. */
  climbRope(dt, input, jumpEdge) {
    const r = this.rope;
    let climb = input.forward;
    if (this.ropeDown) {
      if (climb <= 0.1) this.ropeDown = false;
      else climb = -climb;
    } else if ((input.pitch ?? 0) < ROPE_LOOK_DOWN) climb = -climb;
    const vy = climb > 0.1 ? ROPE_CLIMB_UP : climb < -0.1 ? -ROPE_CLIMB_DOWN : 0;
    this.velocity.set(0, vy, 0);
    this.moving = vy !== 0;
    this.sprinting = false;
    this.strafeInput = 0;
    this.justLanded = false;
    this.pos.x = r.x - r.dx * ROPE_HANG;
    this.pos.z = r.z - r.dz * ROPE_HANG;
    this.pos.y += vy * dt;

    if (jumpEdge) {
      // let go, kicking off away from the rope
      this.leaveRope();
      this.impulse(-r.dx * ROPE_JUMP_OUT, ROPE_JUMP_UP, -r.dz * ROPE_JUMP_OUT, 0.2);
    } else if (vy > 0 && this.pos.y >= r.y1 - 0.05) {
      // the top: step off onto the floor beyond, through the vault's lerp
      const to = new THREE.Vector3(r.x + r.dx * (ROPE_HANG + RADIUS), 0, r.z + r.dz * (ROPE_HANG + RADIUS));
      to.y = this.groundHeightAt(to.x, to.z, r.y1 + 0.4);
      if (to.y > r.y1 - 0.5) {
        this.leaveRope();
        this.vault = { from: this.pos.clone(), to, t: 0 };
        this.stance = STANCE.VAULT;
        this.velocity.set(0, 0, 0);
      } else this.pos.y = r.y1 - 0.05;
    } else if (vy < 0 && this.pos.y <= r.y0) {
      this.pos.y = r.y0;
      this.leaveRope();
      this.velocity.set(0, 0, 0);
      this.grounded = true;
    }
    this.applyEye(dt);
  }

  /* input: { forward, strafe, sprint, jump, crouch, dive, yaw, pitch, adsHeld, speedMult }
     (`pitch` only steers a rope climb: looking down, W goes down) */
  update(dt, input) {
    const { yaw, speedMult = 1 } = input;

    this.slideCd = Math.max(0, this.slideCd - dt);
    this.ropeCd = Math.max(0, this.ropeCd - dt);
    if (this.impulseT > 0) this.impulseT = Math.max(0, this.impulseT - dt);
    if (this.diveT > 0) this.diveT = Math.max(0, this.diveT - dt);

    // ---- vault runs to completion, ignoring normal physics
    if (this.vault) {
      this.vault.t += dt;
      const k = Math.min(1, this.vault.t / VAULT_TIME);
      const ease = smoothstep(k);
      this.pos.lerpVectors(this.vault.from, this.vault.to, ease);
      this.pos.y = this.vault.from.y + (this.vault.to.y - this.vault.from.y) * ease + Math.sin(k * Math.PI) * 0.18;
      if (k >= 1) {
        this.pos.copy(this.vault.to);
        this.vault = null;
        this.stance = STANCE.STAND;
        this.velocity.set(0, 0, 0);
        this.grounded = true;
      }
      this.applyEye(dt);
      return;
    }

    // ---- on a rope, climbing replaces walking
    if (this.rope) {
      const jumpEdge = input.jump && !this._prevJump;
      this._prevJump = input.jump;
      this._prevCrouch = input.crouch;
      this._prevDive = input.dive;
      this.climbRope(dt, input, jumpEdge);
      return;
    }

    // ---- facing vectors
    const forwardVec = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const rightVec = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    const ix = input.strafe, iz = input.forward;
    const inputLen = Math.hypot(ix, iz);
    this.moving = inputLen > 0.05;
    // Exposed for the viewmodel's directional strafe sway (DESIGN-ARMS.md
    // Phase 2) — not a new movement-detection system, just surfacing input
    // this function already receives every frame.
    this.strafeInput = ix;

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
      this.velocity.x = d.x * this.tuning.DIVE_FORWARD;
      this.velocity.z = d.z * this.tuning.DIVE_FORWARD;
      this.velocity.y = DIVE_UP;
      this.grounded = false;
      this.stance = STANCE.PRONE;
      this.diveT = DIVE_RECOVER;
    }

    // ---- slide: crouch out of a sprint
    if (crouchEdge && this.grounded && this.slideCd <= 0 && this.diveT <= 0 &&
        this.stance === STANCE.STAND && wantSprint && planarSpeed > SLIDE_MIN_SPEED) {
      this.stance = STANCE.SLIDE;
      this.slideT = this.tuning.SLIDE_TIME;
      this.slideDir.set(this.velocity.x, 0, this.velocity.z).normalize();
      const boosted = planarSpeed * this.tuning.SLIDE_BOOST;
      this.velocity.x = this.slideDir.x * boosted;
      this.velocity.z = this.slideDir.z * boosted;
    } else if (crouchEdge && this.diveT <= 0) {
      if (this.stance === STANCE.STAND) this.stance = STANCE.CROUCH;
      else if (this.stance === STANCE.CROUCH || this.stance === STANCE.PRONE) this.stance = STANCE.STAND;
    }

    // ---- slide decay
    if (this.stance === STANCE.SLIDE) {
      this.slideT -= dt;
      const decay = Math.max(0, this.slideT / this.tuning.SLIDE_TIME);
      const target = this.tuning.WALK_SPEED * (0.55 + decay * 1.1);
      const cur = Math.hypot(this.velocity.x, this.velocity.z) || 1;
      const scale = Math.min(1, target / cur);
      this.velocity.x *= scale;
      this.velocity.z *= scale;
      if (this.slideT <= 0 || !this.grounded) {
        this.stance = this.grounded ? STANCE.CROUCH : STANCE.STAND;
        this.slideCd = this.tuning.SLIDE_COOLDOWN;
      }
    }

    this.sprinting = wantSprint && this.stance === STANCE.STAND && this.grounded;

    // ---- grab a rope: walking into one, or falling past it
    if (this.arena.ropes?.length && this.ropeCd <= 0 && !this.busy && this.stance !== STANCE.SLIDE && this.stance !== STANCE.PRONE) {
      const d = new THREE.Vector3().addScaledVector(forwardVec, iz).addScaledVector(rightVec, ix);
      const dir = this.moving && d.lengthSq() > 1e-4 ? d.normalize() : null;
      const r = dir || (!this.grounded && this.velocity.y < 3) ? this.findRope(dir) : null;
      if (r) {
        this.grabRope(r);
        this.applyEye(dt);
        return;
      }
    }

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
          this.velocity.y = this.tuning.JUMP_SPEED;
          this.grounded = false;
          this.jumping = true;
          if (this.stance === STANCE.SLIDE) { this.stance = STANCE.STAND; this.slideCd = this.tuning.SLIDE_COOLDOWN; }
        }
      } else if (this.airJumpsLeft > 0) {
        this.airJumpsLeft--;
        this.velocity.y = this.tuning.JUMP_SPEED;
        this.jumping = true;
      }
    }

    // ---- horizontal acceleration (no steering authority mid-slide)
    const stanceMult = STANCE_SPEED[this.stance] ?? 1;
    const sprintMult = this.sprinting ? (input.sprintMult || 1.35) : 1;
    const target = this.tuning.WALK_SPEED * stanceMult * sprintMult * speedMult;
    const inertia = input.inertia || 9;

    if (this.stance !== STANCE.SLIDE && this.impulseT <= 0) {
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
    this.velocity.y -= this.tuning.GRAVITY * dt;
    if (this.glide && input.jump && !this.grounded && this.velocity.y < -GLIDE_FALL) this.velocity.y = -GLIDE_FALL;
    this.pos.x += this.velocity.x * dt;
    this.pos.z += this.velocity.z * dt;
    this.pos.y += this.velocity.y * dt;

    this.resolveHorizontal(this.pos, this.pos.y);

    const support = this.groundHeightAt(this.pos.x, this.pos.z, this.pos.y + STEP_UP);
    // `justLanded`/`landSpeed` are a one-frame edge the caller reads and the
    // caller is responsible for clearing — GRAVITY-scale falls only, so a
    // stair-step or the tail end of a crouch doesn't also read as a landing.
    this.justLanded = false;
    if (this.pos.y <= support) {
      const wasFalling = this.velocity.y < -6;
      if (wasFalling && !this.grounded) {
        this.justLanded = true;
        this.landSpeed = -this.velocity.y;
      }
      this.pos.y = support;
      this.velocity.y = 0;
      if (!this.grounded && this.stance === STANCE.PRONE && this.diveT > 0) {
        // landed the dive — skid to a stop
        this.velocity.x *= 0.25;
        this.velocity.z *= 0.25;
      }
      this.grounded = true;
      this.jumping = false;
      this.airJumpsLeft = this.maxAirJumps;
      if (wasFalling && this.stance === STANCE.SLIDE) this.stance = STANCE.CROUCH;
    } else {
      this.grounded = false;
    }

    this.applyEye(dt);
  }

  /* Eases eye height toward the current stance's target. */
  applyEye(dt) {
    const targetEye = EYE[this.stance] ?? EYE.stand;
    this.eyeHeight = damp(this.eyeHeight, targetEye, 12, dt);
  }

  /* Where the camera goes this frame. */
  eyePosition(out = new THREE.Vector3()) {
    return out.copy(this.pos).setY(this.pos.y + this.eyeHeight);
  }
}
