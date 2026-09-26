// Troll Forces — remote player rendering.
//
// Peers are drawn slightly in the past (RENDER_DELAY) and interpolated between
// the two snapshots that bracket that moment. Rendering at "now" would mean
// extrapolating from a 15Hz feed, which reads as jitter; a small fixed delay
// buys smooth motion at the cost of aiming very slightly behind live.

import * as THREE from "three";
import { buildHumanoid, poseHumanoid, poseDeath, poseThrowArm, gaitPhaseRate, mountHeldWeapon, aimRig, THROW_TIME, DANCES } from "./character.js";
import { EMOTES } from "./emote-wheel.js";
import { buildWeaponMesh, stripLights } from "./weapon-model.js";
import { WEAPON_DEFS } from "./weapons.js";
import { MeleeState, buildMeleeMesh, MELEE_DEFS } from "./gear.js";

const RENDER_DELAY = 110; // ms
const DEATH_FALL_TIME = 0.55; // seconds to collapse before the rig is hidden

export const TEAMS = {
  phantom: { name: "Phantoms", color: 0x8a6ad6, ui: "#a98cf0" },
  ghost:   { name: "Ghosts",   color: 0xd6a85a, ui: "#e8bf76" },
};

// Name tags read relative to the local player, not by team identity: white
// for friendlies, red for enemies - so who's who is obvious at a glance
// instead of requiring the player to remember which color is their team.
const FRIENDLY_TAG_COLOR = "#ffffff";
const ENEMY_TAG_COLOR = "#ff4d3d";

// How far the body is folded down in each stance, 0 = upright.
export const STANCE_LOWER = { stand: 0, crouch: 0.55, slide: 0.8, prone: 1, vault: 0.3 };

function makeNameTag(text, colorHex) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 30px 'DM Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,.85)";
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = colorHex;
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(1.5, 0.38, 1);
  sprite.renderOrder = 20;
  return sprite;
}

export class RemotePlayer {
  constructor(peer, scene) {
    this.peer = peer;
    this.netId = peer.id;
    this.scene = scene;
    this.team = peer.team;

    // Limbs are always black - the classic trollface stick-figure look -
    // team identity no longer tints anything on the body or tag; the tag
    // instead reads friendly (white) vs enemy (red) relative to whoever
    // is looking, set via setLocalTeam() below.
    this.material = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.1 });

    // Placeholder gun off: the rig carries the peer's actual weapon model
    // instead (see setWeaponModel below), swapped in whenever their loadout
    // changes, so bots and other operators visibly hold what they're
    // shooting rather than a fixed generic rifle shape.
    this.rig = buildHumanoid(this.material, { height: 1.8, gun: false });
    this.group = this.rig.root;

    this.weaponMesh = null;
    this.weaponId = null;
    this.skin = null;
    this.setWeaponModel(peer.weapon, peer.skin);

    // Raycasts hit the invisible, generously-sized hitbox proxies rather
    // than the true stick-figure meshes - those are too thin to reliably
    // land shots on, especially with a controller.
    this.targets = this.rig.hitboxMeshes;

    this.tagText = peer.name || "operator";
    this.tagColor = null; // resolved on first setLocalTeam() call
    this.tag = makeNameTag(this.tagText, FRIENDLY_TAG_COLOR);
    this.tag.position.y = 2.15;
    this.rig.root.add(this.tag);

    this.rig.root.userData.remotePlayer = this;
    scene.add(this.rig.root);

    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.lower = 0;
    this.phase = Math.random() * Math.PI * 2;

    this.wasAlive = true;
    this.dying = false;
    this.deathT = 0;

    // Melee swings they tell us about (net "melee"). The same MeleeState the
    // swinger runs, so the arm takes exactly as long as theirs did.
    this.melee = null;
    this.meleeMesh = null;
    this.meleeSeen = peer.meleeSeq | 0;
    this.throwSeen = peer.throwSeq | 0;
    this.throwT = 0;
  }

  /* Start playing a swing the peer announced, with the sword in the fist and
     the gun put away until it's done - the same swap the local body makes. */
  startMelee(kind, defId) {
    if (!this.ensureMelee(defId)) return;
    this.melee.t = 0;
    this.melee.swingIndex = kind & 1;
    this.melee.start();
  }

  /* The melee state and the sword in the fist, built the first time either
     a swing or a peer holding their melee weapon needs them. */
  ensureMelee(defId) {
    if (!MELEE_DEFS[defId]) return false;
    if (!this.melee || this.melee.def.id !== defId) this.melee = new MeleeState(defId);
    if (!this.meleeMesh) {
      this.meleeMesh = buildMeleeMesh(this.melee.def, false);
      this.meleeMesh.scale.setScalar(1.1);
      this.meleeMesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.rig.parts.gripR.add(this.meleeMesh);
    }
    return true;
  }

  get swinging() { return !!this.melee?.busy; }

  /* Build and attach the real weapon model for whatever this peer is
     currently holding, replacing whatever was there before. Mirrors the
     same held pose the old placeholder gun used (right hand, arm-relative). */
  setWeaponModel(weaponId, skin = null) {
    if (weaponId === this.weaponId && skin === this.skin) return;
    this.weaponId = weaponId;
    this.skin = skin;
    const arm = this.rig.parts.armR;
    if (this.weaponMesh) {
      this.weaponMesh.parent?.remove(this.weaponMesh);
      this.weaponMesh.traverse((o) => {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        if (o.material) o.material.dispose?.();
      });
      this.weaponMesh = null;
    }
    const def = WEAPON_DEFS[weaponId];
    if (!def) return;
    const mesh = stripLights(buildWeaponMesh(def, { skin }));
    mountHeldWeapon(this.rig, mesh);
    this.weaponMesh = mesh;
  }

  setTeam(teamId) {
    this.team = teamId;
  }

  /* Recolor the name tag white (friendly) or red (enemy) relative to
     whoever's looking. ffa/no local team means everyone reads as an enemy. */
  setLocalTeam(myTeam, ffa) {
    const friendly = !ffa && !!myTeam && this.team === myTeam;
    const color = friendly ? FRIENDLY_TAG_COLOR : ENEMY_TAG_COLOR;
    if (color === this.tagColor) return;
    this.tagColor = color;
    const tex = this.tag.material.map;
    this.tag.material.map = null;
    this.tag.material.dispose();
    tex.dispose();
    const fresh = makeNameTag(this.tagText, color);
    this.tag.material = fresh.material;
  }

  hitMeshes() { return this.targets; }

  get alive() { return this.peer.alive !== false; }

  update(dt = 0.016, myTeam = null, ffa = false) {
    const snaps = this.peer.snaps;
    this.setTeam(this.peer.team);
    this.setLocalTeam(myTeam, ffa);
    this.setWeaponModel(this.peer.weapon, this.peer.skin || null);

    if ((this.peer.meleeSeq | 0) !== this.meleeSeen) {
      this.meleeSeen = this.peer.meleeSeq | 0;
      if (this.alive) this.startMelee(this.peer.meleeKind, this.peer.meleeDef);
    }
    if (this.melee) this.melee.update(dt);
    if ((this.peer.throwSeq | 0) !== this.throwSeen) {
      this.throwSeen = this.peer.throwSeq | 0;
      this.throwT = THROW_TIME;
    }
    if (this.throwT > 0) this.throwT = Math.max(0, this.throwT - dt);
    if (!this.alive && this.melee) this.melee.t = 0;
    const swinging = this.swinging;
    // Holding the melee weapon outright (switched to it, or infected): the
    // wire sends its id as the weapon.
    const meleeHeld = !!MELEE_DEFS[this.peer.weapon] && this.ensureMelee(this.peer.weapon);
    const sword = swinging || meleeHeld;
    // Emoting (the peer's `em`, see emote-wheel.js): weapons away.
    const em = this.alive ? (this.peer.emote | 0) : 0;
    this.emoteT = em ? (this.emoteT || 0) + dt : 0;
    if (this.meleeMesh) this.meleeMesh.visible = sword && !em;
    if (this.weaponMesh) this.weaponMesh.visible = !sword && !em;

    // Just died: hold the last known pose and play a collapse instead of
    // instantly popping out of existence. Respawning (alive flips back to
    // true) cancels the fall immediately.
    if (!this.alive && this.wasAlive) { this.dying = true; this.deathT = 0; }
    if (this.alive) this.dying = false;
    this.wasAlive = this.alive;

    if (this.dying) {
      this.deathT += dt;
      this.rig.root.visible = true;
      this.tag.visible = false;
      poseDeath(this.rig, this.deathT / DEATH_FALL_TIME);
      if (this.deathT >= DEATH_FALL_TIME) this.dying = false;
      return;
    }
    this.tag.visible = true;

    const visible = this.alive && snaps.length > 0;
    this.rig.root.visible = visible;
    if (!visible) return;

    const target = performance.now() - RENDER_DELAY;
    let a = null, b = null;
    for (let i = snaps.length - 1; i >= 0; i--) {
      if (snaps[i].t <= target) { a = snaps[i]; b = snaps[i + 1] || null; break; }
    }
    if (!a) a = snaps[0];
    if (!b) b = snaps[snaps.length - 1];

    let k = 0;
    if (a !== b && b.t > a.t) k = Math.max(0, Math.min(1, (target - a.t) / (b.t - a.t)));

    this.pos.set(
      a.x + (b.x - a.x) * k,
      a.y + (b.y - a.y) * k,
      a.z + (b.z - a.z) * k,
    );
    this.yaw = lerpAngle(a.yaw, b.yaw, k);
    this.pitch = a.pitch + (b.pitch - a.pitch) * k;

    const wantLower = STANCE_LOWER[b.stance] ?? 0;
    this.lower += (wantLower - this.lower) * Math.min(1, dt * 8);

    // Strafe (and the leg-swing rate below) are not sent over the wire
    // (net.js snapshots carry position/yaw/pitch/stance/moving only) -
    // derive actual ground speed locally from how far the player moved
    // between the two bracketing snapshots, projected onto their own
    // left/right axis for strafe. Cheap, needs no protocol change.
    let strafe = 0;
    let forward = 1;
    let speed = 0;
    if (b.t > a.t) {
      const dx = b.x - a.x, dz = b.z - a.z;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // Local right/forward axes for a yaw-only rotation about Y (forward
      // is -Z at yaw 0, matching movement.js/character.js's convention).
      const rightX = cos, rightZ = -sin;
      const fwdX = -sin, fwdZ = -cos;
      const lateral = dx * rightX + dz * rightZ;
      const along = dx * fwdX + dz * fwdZ;
      speed = Math.hypot(dx, dz) / ((b.t - a.t) / 1000 || 1);
      if (speed > 0.05) {
        strafe = Math.max(-1, Math.min(1, lateral * 6));
        // Signed -1 (full backpedal) .. 1 (full forward run); a pure
        // strafe with no fore/aft component lands at 0.
        forward = Math.max(-1, Math.min(1, along * 6));
      } else {
        strafe = 0;
        forward = 1;
      }
    }

    // `moving` (from the wire) gates whether the legs animate at all; the
    // measured speed then sets how fast that cycle plays, so a bot easing
    // into a strafe or barely drifting doesn't play a full sprint-speed jog -
    // it used to always report moving:true and always advance at one fixed
    // rate regardless of how fast (or slow) it was actually travelling.
    const moving = !!b.moving;
    // Same 4.2 m/s reference speed used to drive the phase rate above,
    // reused here as the 0..1 intensity that scales stride/arm-swing/lean
    // so a jog and a sprint are visibly different gaits, not just the same
    // cycle replayed faster.
    const gaitSpeed = Math.max(0, Math.min(1, speed / 4.2));
    // Cadence from the real speed, so the planted foot moves exactly as fast
    // as the ground under it.
    if (moving) this.phase += dt * gaitPhaseRate(this.gaitMps = (this.gaitMps ?? speed) + (speed - (this.gaitMps ?? speed)) * Math.min(1, dt * 6));

    this.rig.root.position.copy(this.pos);
    // Their head leads toward where they aim; the body turns after it.
    aimRig(this.rig, this.yaw, dt, { moving });

    // Two-handed carry (armL on the support hand instead of a free run
    // swing) for anything but a sidearm — matches weapon-model.js's own
    // !isPistol gate for whether a weapon actually has a support hand mesh.
    const hasGun = !sword && WEAPON_DEFS[this.weaponId]?.cls !== "sidearm";
    const swing = swinging ? {
      t: Math.min(1, this.melee.t / this.melee.total),
      kind: this.melee.swingIndex % 2 === 0 ? "swing" : "thrust",
    } : null;
    if (em && EMOTES[em - 1]) {
      DANCES[EMOTES[em - 1].dance](this.rig, this.emoteT);
    } else poseHumanoid(this.rig, {
      phase: this.phase, moving, pitch: this.pitch, lower: this.lower, strafe, forward,
      speed: gaitSpeed, mps: this.gaitMps ?? speed, dt, hasGun,
      hold: sword ? "melee" : "gun", swing,
    });

    if (this.throwT > 0) poseThrowArm(this.rig, 1 - this.throwT / THROW_TIME);

    this.tag.position.y = 2.15 - this.lower * 0.75;
  }

  /* Where a shot at this player should be reported from. */
  centre(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + 1.1 - this.lower * 0.5, this.pos.z);
  }

  dispose() {
    this.scene.remove(this.rig.root);
    this.rig.root.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o !== this.rig.root && o.material && o.material !== this.material && !o.material.userData?.shared) o.material.dispose?.();
    });
    this.material.dispose();
    this.tag.material.map?.dispose();
    this.tag.material.dispose();
  }
}

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/* Owns the set of remote players and keeps it in sync with Net's peer map. */
export class RemotePlayers {
  constructor(scene) {
    this.scene = scene;
    this.byId = new Map();
  }

  sync(peers) {
    for (const [id, peer] of peers) {
      if (!this.byId.has(id)) this.byId.set(id, new RemotePlayer(peer, this.scene));
    }
    for (const [id, rp] of this.byId) {
      if (!peers.has(id)) { rp.dispose(); this.byId.delete(id); }
    }
  }

  update(dt = 0.016, myTeam = null, ffa = false) {
    for (const rp of this.byId.values()) rp.update(dt, myTeam, ffa);
  }

  /* Pass a team to spare friendlies, or null in free-for-all. */
  hitMeshes(myTeam) {
    const out = [];
    for (const rp of this.byId.values()) {
      if (!rp.alive) continue;
      if (myTeam && rp.team === myTeam) continue;
      out.push(...rp.hitMeshes());
    }
    return out;
  }

  resolve(object) {
    let o = object;
    while (o) {
      if (o.userData?.remotePlayer) return o.userData.remotePlayer;
      o = o.parent;
    }
    return null;
  }

  clear() {
    for (const rp of this.byId.values()) rp.dispose();
    this.byId.clear();
  }
}
