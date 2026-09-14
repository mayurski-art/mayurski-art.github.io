// Troll Ops — remote player rendering.
//
// Peers are drawn slightly in the past (RENDER_DELAY) and interpolated between
// the two snapshots that bracket that moment. Rendering at "now" would mean
// extrapolating from a 15Hz feed, which reads as jitter; a small fixed delay
// buys smooth motion at the cost of aiming very slightly behind live.

import * as THREE from "three";
import { buildHumanoid, poseHumanoid, poseDeath } from "./character.js";
import { buildWeaponMesh } from "./weapon-model.js";
import { WEAPON_DEFS } from "./weapons.js";

const RENDER_DELAY = 110; // ms
const DEATH_FALL_TIME = 0.55; // seconds to collapse before the rig is hidden

export const TEAMS = {
  phantom: { name: "Phantoms", color: 0x8a6ad6, ui: "#a98cf0" },
  ghost:   { name: "Ghosts",   color: 0xd6a85a, ui: "#e8bf76" },
};

// How far the body is folded down in each stance, 0 = upright.
const STANCE_LOWER = { stand: 0, crouch: 0.55, slide: 0.8, prone: 1, vault: 0.3 };

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

    const team = TEAMS[peer.team] || TEAMS.phantom;
    // Limbs are always black - the classic trollface stick-figure look -
    // team color now only marks the name tag, not the body, so Phantoms
    // and Ghosts read as the same silhouette and differ by tag/HUD color.
    this.material = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.1 });

    // Placeholder gun off: the rig carries the peer's actual weapon model
    // instead (see setWeaponModel below), swapped in whenever their loadout
    // changes, so bots and other operators visibly hold what they're
    // shooting rather than a fixed generic rifle shape.
    this.rig = buildHumanoid(this.material, { height: 1.8, gun: false });
    this.group = this.rig.root;

    this.weaponMesh = null;
    this.weaponId = null;
    this.setWeaponModel(peer.weapon);

    // Raycasts hit the invisible, generously-sized hitbox proxies rather
    // than the true stick-figure meshes - those are too thin to reliably
    // land shots on, especially with a controller.
    this.targets = this.rig.hitboxMeshes;

    this.tag = makeNameTag(peer.name || "operator", team.ui);
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
  }

  /* Build and attach the real weapon model for whatever this peer is
     currently holding, replacing whatever was there before. Mirrors the
     same held pose the old placeholder gun used (right hand, arm-relative). */
  setWeaponModel(weaponId) {
    if (weaponId === this.weaponId) return;
    this.weaponId = weaponId;
    const arm = this.rig.parts.armR;
    if (this.weaponMesh) {
      arm.remove(this.weaponMesh);
      this.weaponMesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose?.();
      });
      this.weaponMesh = null;
    }
    const def = WEAPON_DEFS[weaponId];
    if (!def) return;
    const s = this.rig.scale;
    const mesh = buildWeaponMesh(def);
    mesh.position.set(0.30 * s, -0.62 * s - 0.12 * s, -0.12 * s);
    arm.add(mesh);
    this.weaponMesh = mesh;
  }

  setTeam(teamId) {
    if (teamId === this.team) return;
    this.team = teamId;
    // Body stays black on a team switch - only the (already-built) name
    // tag carries the team color.
  }

  hitMeshes() { return this.targets; }

  get alive() { return this.peer.alive !== false; }

  update(dt = 0.016) {
    const snaps = this.peer.snaps;
    this.setTeam(this.peer.team);
    this.setWeaponModel(this.peer.weapon);

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
    let speed = 0;
    if (b.t > a.t) {
      const dx = b.x - a.x, dz = b.z - a.z;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // Local right axis for a yaw-only rotation about Y.
      const rightX = cos, rightZ = -sin;
      const lateral = dx * rightX + dz * rightZ;
      speed = Math.hypot(dx, dz) / ((b.t - a.t) / 1000 || 1);
      strafe = speed > 0.05 ? Math.max(-1, Math.min(1, lateral * 6)) : 0;
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
    if (moving) this.phase += dt * 9 * Math.max(0.35, Math.min(1.6, speed / 4.2));

    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;

    poseHumanoid(this.rig, { phase: this.phase, moving, pitch: this.pitch, lower: this.lower, strafe, speed: gaitSpeed, dt });

    this.tag.position.y = 2.15 - this.lower * 0.75;
  }

  /* Where a shot at this player should be reported from. */
  centre(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + 1.1 - this.lower * 0.5, this.pos.z);
  }

  dispose() {
    this.scene.remove(this.rig.root);
    this.rig.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o !== this.rig.root && o.material && o.material !== this.material) o.material.dispose?.();
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

  update(dt = 0.016) {
    for (const rp of this.byId.values()) rp.update(dt);
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
