// Grin Sabers — one fighter: a trollface on the Troll Forces rig, a saber
// in both hands, and the state machine the duel runs on.
//
// States:
//   idle      ready stance, free to move, swing, guard, dodge, jump
//   swing     windup -> strike -> recover; combos chain from the strike
//   guard     holding a guard zone (left, right, high, mid)
//   rebound   the blade bounced off a guard; a short opening
//   stagger   hit, guard broken or parried hard: can't act
//   dodge     a quick dash, untouchable for most of it
//   clash     blades locked, mashing
//   disarmed  saber on the floor, go and grab it
//   ko        down for the round
//
// Each frame the owner sets `intent` (input.js for a person, the bot for a
// bot), then calls update(). Hits are decided in resolve.js.

import * as THREE from "three";
import {
  buildHumanoid, poseHumanoid, reachHand, setHandPose, aimRig, flinchRig,
  gaitPhaseRate, poseDeath, DEATH_TIME,
} from "../../troll-ops/characters/character.js?v=gs3";
import { buildSaber, SaberTrail, EMIT_Z } from "../view/saber.js?v=gs3";
import { FORMS, SWING_BASE } from "./forms.js?v=gs3";
import {
  READY, RUN, GUARDS, STAGGER, CLASH, SWINGS, newPose, copyPose, lerpPose, strikePose, smooth, zoneFromAim,
} from "./swings.js?v=gs3";

export const REACH = 1.75;          // chest to chest, the blade can reach about this far
const HAND_GAP = 0.1;               // right fist to left fist along the hilt
const BP_REGEN = 14;                // block points a second, standing/walking/guarding
const DODGE_COST = 12, FEINT_COST = 6;
const GRAVITY = 13, JUMP_V = 6.2;
// Ground speeds, m/s. Walking is the duel footwork (always facing the
// opponent); running breaks the lock-on and faces where you run.
const WALK = { fwd: 3.4, back: 2.8, side: 3.0 }, RUN_SPEED = 6.8;

export function blankIntent() {
  return {
    mx: 0, mz: 0,                 // strafe (+right), forward (+toward the opponent), -1..1
    attack: false,                // pressed this frame
    attackHeld: false,
    dir: null,                    // swing direction for this press: "R" | "L" | "O" | "T" | null (auto)
    heavy: false,                 // bots ask for a heavy outright
    guard: false,                 // held
    aimX: 0, aimY: 0,             // guard aim -1..1
    touchGuard: false,            // guard from a touch button: timed perfect blocks
    flick: null,                  // {x, y}: a quick flick this frame (disarm attempt)
    dodge: false, jump: false,    // pressed this frame
    sprint: false,                // held: run
    mash: false,                  // attack pressed during a clash
  };
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();
const _fwd = new THREE.Vector3(0, 0, -1), _pole = new THREE.Vector3();
const POLE_R = new THREE.Vector3(1, -1, 0.3), POLE_L = new THREE.Vector3(-1, -1, 0.3);

let _flatFace = null;
function faceMaterialFlat(lit) {
  if (_flatFace) return _flatFace;
  _flatFace = new THREE.MeshBasicMaterial({ map: lit.map, color: 0xeeeeee, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
  return _flatFace;
}

/* Sword fists. The rig's mitts are flat cut-outs laid along the forearm, made
   for open hands and gestures; they can't close round a handle. While a
   saber is held they hide and these take over: round ink fists centred ON
   the hilt (the arm's line ends inside them), the right under the emitter,
   the left a fist lower, so the steel shows between and round them. */
const FIST_GEO = new THREE.SphereGeometry(1, 18, 14);
const FIST_MAT = new THREE.MeshBasicMaterial({ color: 0x050505 });
function makeFist(scene) {
  const m = new THREE.Mesh(FIST_GEO, FIST_MAT);
  m.scale.set(0.05, 0.047, 0.043);   // wide across the hilt, short along it
  m.castShadow = true;
  m.visible = false;
  scene.add(m);
  return m;
}

function nameTag(text, colour) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const g = c.getContext("2d");
  g.font = "700 30px 'DM Sans', sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 6; g.strokeStyle = "rgba(0,0,0,0.75)"; g.strokeText(text, 128, 32);
  g.fillStyle = "#fff"; g.fillText(text, 128, 32);
  g.fillStyle = colour; g.fillRect(78, 54, 100, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(0.9, 0.225, 1);
  s.renderOrder = 10;
  return s;
}

export class Fighter {
  constructor(scene, { name = "You", colour = "#3fa9ff", form = "shiicho", isBot = false, light = null } = {}) {
    this.scene = scene;
    this.name = name;
    this.colour = colour;
    this.isBot = isBot;
    this.form = FORMS[form];
    this.rig = buildHumanoid(null, { gun: false });
    this.rig.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    // The face drawn flat, like the artwork: unlit, so a blade held next to
    // it doesn't tint or bloom it. (Cleared trollface flag: the rig would
    // otherwise put its own lit face material back every pose.)
    const head = this.rig.parts.head;
    head.material = faceMaterialFlat(head.material);
    head.userData.trollface = false;
    scene.add(this.rig.root);
    this.tag = nameTag(name, colour);
    scene.add(this.tag);

    this.saber = buildSaber(colour, { light });
    scene.add(this.saber.group);
    this.trail = new SaberTrail(scene, colour);
    this.fists = [makeFist(scene), makeFist(scene)];

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.onGround = true;
    this.phase = 0;
    this.intent = blankIntent();
    this.pose = newPose();
    copyPose(this.pose, READY);
    this.fromPose = newPose();
    this.root0 = new THREE.Vector3(); this.tip0 = new THREE.Vector3();   // blade last frame (world)
    this.root1 = new THREE.Vector3(); this.tip1 = new THREE.Vector3();   // blade now
    this.saberDrop = null;   // { pos, vel, spin, t, landed } while disarmed
    this.reset(0, 0, 0);
  }

  /* Back to full health at (x, z) facing `yaw`, saber off. */
  reset(x, z, yaw) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.hp = 100;
    this.bp = 100;
    this.state = "idle";
    this.t = 0;
    this.dur = 0;
    this.swing = null;
    this.guardZone = "mid";
    this.guardSince = -9;
    this.counterUntil = -9;
    this.flickAt = -9; this.flick = { x: 0, y: 0 };
    this.clash = null;
    this.hitstun = 0;
    this.koT = 0;
    this.lastHitAt = -9;
    this.frozen = true;      // the round intro holds everyone still
    this.combo = 0;
    this.comboDir = 0;
    this.stats = { hits: 0, perfects: 0, disarms: 0, dmg: 0 };
    if (this.saberDrop) { this.saberDrop = null; }
    this.saber.snap = true;
    this.saber.frac = 0; this.saber.target = 0;
    copyPose(this.pose, READY);
    this.trail.clear();
    this.rig.death = null;
    aimRig(this.rig, yaw, 0, { snap: true });
    this.rig.root.position.copy(this.pos);
  }

  get alive() { return this.state !== "ko"; }
  get striking() { return this.state === "swing" && this.swing.phase === "strike"; }
  get windingUp() { return this.state === "swing" && this.swing.phase === "windup"; }
  get iframes() { return this.state === "dodge" && this.t < 0.24; }
  forward(out = _v) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  /* ---------------------------------------------------------- actions */

  startSwing(dir, heavy, now) {
    const chained = this.state === "swing";
    const f = this.form;
    if (!dir) {
      // No direction picked: a combo walks round R, L, O, T.
      dir = ["R", "L", "O", "R", "L", "T"][this.comboDir % 6];
    }
    this.comboDir++;
    this.combo = chained ? this.combo + 1 : 1;
    copyPose(this.fromPose, this.pose);
    const sp = f.speed;
    const counter = now < this.counterUntil;
    let windup = (heavy ? SWING_BASE.heavyWindup : SWING_BASE.windup) / sp;
    if (chained) windup *= SWING_BASE.chainWindup;
    if (counter) windup *= 0.5;
    this.swing = {
      dir, heavy, counter, phase: "windup", t: 0, windup,
      strike: (heavy ? SWING_BASE.heavyStrike : SWING_BASE.strike) / sp,
      recover: SWING_BASE.recover / sp, queued: null, hitDone: false,
      air: !this.onGround, startedAt: now,
    };
    this.counterUntil = -9;
    this.state = "swing";
    this.bp = Math.max(0, this.bp - f.swingCost);
  }

  /* Blocked: the blade bounces back. `hard` (a perfect block): a longer opening. */
  rebound(hard) {
    copyPose(this.fromPose, this.pose);
    this.state = "rebound";
    this.t = 0;
    this.dur = hard ? 0.55 : 0.3;
    this.swing = null;
    this.combo = 0;
    this.saber.flare(0.6);
  }

  stagger(sec) {
    copyPose(this.fromPose, this.pose);
    this.state = "stagger";
    this.t = 0;
    this.dur = sec;
    this.swing = null;
    this.combo = 0;
  }

  /* Knock the saber out of the hands: it flies off and lies on the floor. */
  disarm(awayFrom) {
    this.state = "disarmed";
    this.t = 0;
    this.swing = null;
    this.combo = 0;
    const away = _v.set(this.pos.x - awayFrom.x, 0, this.pos.z - awayFrom.z).normalize();
    const side = _w.set(-away.z, 0, away.x).multiplyScalar(Math.random() < 0.5 ? -1 : 1);
    this.saberDrop = {
      pos: this.saber.group.position.clone(),
      vel: new THREE.Vector3().addScaledVector(away, 2.2).addScaledVector(side, 1.6).setY(4.6),
      spin: 14, landed: false, t: 0,
    };
    this.saber.retract(0.25);
  }

  ko(from) {
    this.state = "ko";
    this.koT = 0;
    this.swing = null;
    const fwd = this.forward();
    const dx = from.pos.x - this.pos.x, dz = from.pos.z - this.pos.z;
    this.rig.deathHint = { dir: fwd.x * dx + fwd.z * dz > 0 ? 1 : -1 };
    this.rig.death = null;
    this.saber.retract(0.5);
  }

  /* --------------------------------------------------------- update */

  update(dt, now, opp, arena, ctx) {
    const it = this.intent;
    const f = this.form;
    this.t += dt;

    // Face the opponent (lock-on), unless down or running. Movement keys
    // always steer relative to the line to the opponent (lockYaw), so
    // turning to run doesn't change what W and D mean.
    const dx = opp.pos.x - this.pos.x, dz = opp.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.01) this.lockYaw = Math.atan2(-dx, -dz);
    this.sprinting = !this.frozen && !!it.sprint && this.state === "idle" && Math.hypot(it.mx, it.mz) > 0.2;
    if (this.state !== "ko" && dist > 0.01) {
      let want = this.lockYaw;
      if (this.sprinting) {
        const L = this.lockYaw, fx = -Math.sin(L), fz = -Math.cos(L), rx = Math.cos(L), rz = -Math.sin(L);
        want = Math.atan2(-(fx * it.mz + rx * it.mx), -(fz * it.mz + rz * it.mx));
      }
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const turn = this.state === "swing" && this.swing.phase !== "windup" ? 4 : 14;
      this.yaw += d * Math.min(1, dt * turn);
    }

    if (it.flick) { this.flickAt = now; this.flick.x = it.flick.x; this.flick.y = it.flick.y; }

    // --- state machine
    if (this.frozen) {
      // round intro: stand still, sabers igniting
    } else switch (this.state) {
      case "idle":
      case "guard": {
        const canGuard = this.bp > 0 || this.state === "guard";
        if (it.attack && (now < this.counterUntil || this.bp >= 4)) { this.startSwing(it.dir, !!it.heavy, now); break; }
        if (it.dodge && this.bp >= DODGE_COST && this.onGround) { this.startDodge(it); break; }
        if (it.jump && this.onGround) { this.vel.y = JUMP_V; this.onGround = false; ctx.emit("jump", this); }
        if (it.guard && canGuard) {
          if (this.state !== "guard") { this.state = "guard"; this.guardSince = now; }
          this.guardZone = it.touchGuard ? this.autoZone(opp) : zoneFromAim(it.aimX, it.aimY);
          this.touchGuard = !!it.touchGuard;
        } else if (this.state === "guard") this.state = "idle";
        break;
      }
      case "swing": {
        const s = this.swing;
        s.t += dt;
        // Hold the button through the start of a light windup: it becomes a heavy.
        if (s.phase === "windup" && !s.heavy && !this.isBot && it.attackHeld && s.t > 0.13 && this.combo === 1 && !s.counter) {
          s.heavy = true;
          s.windup = SWING_BASE.heavyWindup / f.speed;
          s.strike = SWING_BASE.heavyStrike / f.speed;
          this.saber.flare(0.8);
          ctx.emit("heavy", this);
        }
        if (s.phase === "windup" && it.guard) {
          // Feint: guard cancels your own windup.
          this.state = "guard"; this.guardSince = now; this.swing = null; this.combo = 0;
          this.bp = Math.max(0, this.bp - FEINT_COST);
          ctx.emit("feint", this);
          break;
        }
        if (it.attack && s.phase !== "windup") s.queued = { dir: it.dir, heavy: !!it.heavy };
        if (s.phase === "windup" && s.t >= s.windup) {
          s.phase = "strike"; s.t = 0;
          // a step into the swing: a thrust lunges further
          const lunge = (s.dir === "T" ? 3.2 : 1.7) * (dist > 1.1 ? 1 : 0.2);
          const fw = this.forward();
          this.vel.x += fw.x * lunge; this.vel.z += fw.z * lunge;
          ctx.emit("strike", this);
        } else if (s.phase === "strike" && s.t >= s.strike) {
          if (s.queued && this.combo < f.combo && this.bp >= 4) { const q = s.queued; this.startSwing(q.dir, q.heavy, now); break; }
          s.phase = "recover"; s.t = 0;
        } else if (s.phase === "recover") {
          if (s.queued && s.t < s.recover * 0.6 && this.combo < f.combo && this.bp >= 4) { const q = s.queued; this.startSwing(q.dir, q.heavy, now); break; }
          if (s.t >= s.recover) { this.state = "idle"; this.swing = null; this.combo = 0; }
        }
        break;
      }
      case "rebound":
      case "stagger":
        if (this.t >= this.dur) this.state = "idle";
        break;
      case "dodge":
        if (this.t >= this.dur) this.state = "idle";
        break;
      case "clash":
        // resolved by resolve.js when the lock runs out
        break;
      case "disarmed":
        this.updateDrop(dt, now, ctx);
        break;
      case "ko":
        this.koT += dt;
        break;
    }

    // --- block points
    // (not while running: Saber Showdown's rule, so running away costs you)
    if ((this.state === "idle" || this.state === "guard") && this.onGround && !this.frozen && !this.sprinting) {
      this.bp = Math.min(100, this.bp + BP_REGEN * dt);
    }

    // --- movement
    this.move(dt, it, opp, dist, arena);

    // --- pose + blade
    this.applyPose(dt, now, opp);
  }

  autoZone(opp) {
    // Touch guards face the incoming swing when it's known, else mid.
    if (opp.state === "swing") return { R: "left", L: "right", O: "high", T: "mid" }[opp.swing.dir];
    return "mid";
  }

  startDodge(it) {
    this.state = "dodge";
    this.t = 0;
    this.dur = 0.34;
    this.bp -= DODGE_COST;
    let mx = it.mx, mz = it.mz;
    if (Math.hypot(mx, mz) < 0.2) { mx = 0; mz = -1; }   // no direction: hop back
    const l = Math.hypot(mx, mz);
    this.dodgeDir = { mx: mx / l, mz: mz / l };
  }

  move(dt, it, opp, dist, arena) {
    const L = this.lockYaw ?? this.yaw;
    const fw = _v.set(-Math.sin(L), 0, -Math.cos(L));
    const rx = Math.cos(L), rz = -Math.sin(L);
    let tx = 0, tz = 0;
    const st = this.state;
    if (st === "dodge") {
      const k = 1 - this.t / this.dur;
      const sp = 9.5 * k * k + 1;
      tx = (fw.x * this.dodgeDir.mz + rx * this.dodgeDir.mx) * sp;
      tz = (fw.z * this.dodgeDir.mz + rz * this.dodgeDir.mx) * sp;
      this.vel.x = tx; this.vel.z = tz;
    } else {
      const canMove = !this.frozen && st !== "stagger" && st !== "clash" && st !== "ko";
      let mz = canMove ? it.mz : 0, mx = canMove ? it.mx : 0;
      const l = Math.hypot(mx, mz);
      if (l > 1) { mx /= l; mz /= l; }
      let speed = mz < 0 ? WALK.back : WALK.fwd;
      if (Math.abs(mx) > Math.abs(mz)) speed = WALK.side;
      if (this.sprinting) speed = RUN_SPEED;
      if (st === "guard") speed *= 0.55;
      if (st === "swing") speed *= 0.35;
      if (st === "rebound") speed *= 0.5;
      tx = (fw.x * mz + rx * mx) * speed;
      tz = (fw.z * mz + rz * mx) * speed;
      const grip = this.onGround ? 12 : 3;
      this.vel.x += (tx - this.vel.x) * Math.min(1, dt * grip);
      this.vel.z += (tz - this.vel.z) * Math.min(1, dt * grip);
    }
    if (!this.onGround) {
      this.vel.y -= GRAVITY * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.vel.y = 0; this.onGround = true; this.landed = 0.5; }
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // keep apart: the fighters never overlap
    const dx = this.pos.x - opp.pos.x, dz = this.pos.z - opp.pos.z;
    const d = Math.hypot(dx, dz);
    const minD = 0.8;
    if (d < minD && opp.state !== "ko") {
      const push = (minD - d) * 0.5;
      const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
      this.pos.x += nx * push; this.pos.z += nz * push;
    }
    // inside the ring
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > arena.radius) { this.pos.x *= arena.radius / r; this.pos.z *= arena.radius / r; }
  }

  /* ---------------------------------------------------------- posing */

  targetPose(now) {
    const s = this.swing;
    switch (this.state) {
      case "swing": {
        const k = SWINGS[s.dir];
        if (s.phase === "windup") {
          lerpPose(this.pose, this.fromPose, k[0], smooth(s.t / s.windup));
          if (s.heavy) {
            // a heavy draws further back and trembles
            this.pose.g.multiplyScalar(1.06);
            this.pose.twist *= 1.25;
            this.pose.d.x += (Math.random() - 0.5) * 0.03;
            this.pose.d.normalize();
          }
          return null;
        }
        if (s.phase === "strike") { strikePose(this.pose, s.dir, s.t / s.strike); return null; }
        lerpPose(this.pose, k[2], READY, smooth(s.t / s.recover));
        return null;
      }
      case "guard": return GUARDS[this.guardZone];
      case "rebound": lerpPose(this.pose, this.fromPose, READY, smooth(this.t / this.dur)); return null;
      case "stagger": return STAGGER;
      case "clash": return CLASH;
      default: return this.sprinting ? RUN : READY;
    }
  }

  applyPose(dt, now, opp) {
    const rig = this.rig, p = rig.parts;
    const moving = Math.hypot(this.vel.x, this.vel.z) > 0.25 && this.onGround;
    const mps = Math.hypot(this.vel.x, this.vel.z);
    // local velocity: strafe (+right) and forward
    const fw = this.forward(_v);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const fwdV = this.vel.x * fw.x + this.vel.z * fw.z;
    const sideV = this.vel.x * rx + this.vel.z * rz;
    this.phase += gaitPhaseRate(Math.max(0.5, mps)) * dt * (moving ? 1 : 0);

    aimRig(rig, this.yaw, dt, { moving });
    rig.root.position.copy(this.pos);

    if (this.state === "ko") {
      this.showSwordFists(false);
      poseDeath(rig, Math.min(1, this.koT / DEATH_TIME));
      this.placeSaberOnBody(dt, now, false);
      this.tag.visible = false;
      return;
    }
    this.tag.visible = this.showTag !== false;
    this.tag.position.set(this.pos.x, this.pos.y + 2.12, this.pos.z);

    const land = this.landed || 0;
    this.landed = 0;
    poseHumanoid(rig, {
      phase: this.phase, moving, mps, speed: Math.min(1, mps / 4.2), dt,
      strafe: mps > 0.1 ? sideV / mps : 0, forward: mps > 0.1 ? fwdV / mps : 1,
      hold: "none", air: !this.onGround, vy: this.vel.y, land,
      lower: this.state === "guard" ? 0.12 : this.state === "dodge" ? 0.25 : 0.06,
    });

    const armed = this.state !== "disarmed";
    if (armed) {
      const target = this.targetPose(now);
      if (target) {
        // ease toward stance poses; guards snap quicker
        const rate = this.state === "guard" ? 24 : this.state === "stagger" ? 10 : 12;
        lerpPose(this.pose, this.pose, target, 1 - Math.exp(-dt * rate));
      }
      // spine: twist into swings, lean into strikes
      p.spine.rotation.y += this.pose.twist * 0.55;
      p.chest.rotation.y += this.pose.twist * 0.35;
      p.torso.rotation.x -= this.pose.lean * 0.45;
      if (this.state === "clash") p.torso.rotation.x -= 0.15;
      p.chest.updateWorldMatrix(true, false);
      // both hands on the hilt
      const g = this.pose.g, d = this.pose.d;
      _pole.copy(POLE_R);
      reachHand(rig, 1, g, _pole);
      _w.copy(g).addScaledVector(d, -HAND_GAP);
      _pole.copy(POLE_L);
      reachHand(rig, -1, _w, _pole);
      this.showSwordFists(true);
      rig.body.update();
      this.placeSaberInHands();
    } else {
      this.showSwordFists(false);
      setHandPose(rig, 1, "open");
      setHandPose(rig, -1, "open");
      rig.body.update();
    }

    // the blade's world segment, last frame and now
    this.root0.copy(this.root1); this.tip0.copy(this.tip1);
    const sg = this.saber.group;
    const dW = _w.copy(_fwd).applyQuaternion(sg.quaternion);
    this.root1.copy(sg.position).addScaledVector(dW, -EMIT_Z);
    this.tip1.copy(this.root1).addScaledVector(dW, this.saber.length);
    if (this.saber.snap) { this.root0.copy(this.root1); this.tip0.copy(this.tip1); this.saber.snap = false; }
    const fast = this.tip0.distanceTo(this.tip1) / Math.max(dt, 1e-3) > 4.5;
    if (armed && this.saber.lit && (this.state === "swing" || this.state === "clash" || fast)) this.trail.push(this.root1, this.tip1, now);
    this.trail.update(now);
    this.saber.update(dt, now);
  }

  showSwordFists(on) {
    const h = this.rig.hands;
    h.R.group.visible = h.L.group.visible = !on;
    this.fists[0].visible = this.fists[1].visible = on;
  }

  /* The saber group at the right fist, blade along the pose's direction,
     and both sword fists on the hilt. */
  placeSaberInHands() {
    const p = this.rig.parts, sg = this.saber.group;
    p.wristR.getWorldPosition(sg.position);
    p.chest.getWorldQuaternion(_q);
    _v.copy(this.pose.d).applyQuaternion(_q);
    sg.quaternion.setFromUnitVectors(_fwd, _v);
    const [fr, fl] = this.fists;
    fr.position.copy(sg.position);
    fl.position.copy(sg.position).addScaledVector(_v, -HAND_GAP);
    fr.quaternion.copy(sg.quaternion);
    fl.quaternion.copy(sg.quaternion);
  }

  /* Down or dropped: the hilt follows the body or lies where it landed. */
  placeSaberOnBody() {
    if (this.saberDrop) return;
    const p = this.rig.parts, sg = this.saber.group;
    p.wristR.getWorldPosition(sg.position);
  }

  updateDrop(dt, now, ctx) {
    const d = this.saberDrop;
    if (!d) { this.state = "idle"; return; }
    d.t += dt;
    const sg = this.saber.group;
    if (!d.landed) {
      d.vel.y -= 14 * dt;
      d.pos.addScaledVector(d.vel, dt);
      if (d.pos.y <= 0.03) { d.pos.y = 0.03; d.landed = true; ctx.emit("saberLand", this); }
      sg.position.copy(d.pos);
      sg.rotateX(d.spin * dt);
    } else {
      sg.position.copy(d.pos);
      _v.set(1, 0, 0);
      sg.quaternion.slerp(_q.setFromUnitVectors(_fwd, _v), Math.min(1, dt * 10));
    }
    // walk over it to pick it up, or it flies back after 5 s
    const near = Math.hypot(this.pos.x - d.pos.x, this.pos.z - d.pos.z) < 0.95;
    if ((d.landed && near) || d.t > 5) {
      this.saberDrop = null;
      this.state = "idle";
      this.t = 0;
      this.saber.ignite();
      ctx.emit("pickup", this);
    }
  }

  dispose() {
    this.scene.remove(this.rig.root, this.saber.group, this.trail.mesh, this.tag, ...this.fists);
  }
}
