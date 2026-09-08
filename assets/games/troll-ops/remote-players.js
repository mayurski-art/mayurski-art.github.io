// Troll Ops — remote player rendering.
//
// Peers are drawn slightly in the past (RENDER_DELAY) and interpolated between
// the two snapshots that bracket that moment. Rendering at "now" would mean
// extrapolating from a 15Hz feed, which reads as jitter; a small fixed delay
// buys smooth motion at the cost of aiming very slightly behind live.

import * as THREE from "three";
import { buildHumanoid, poseHumanoid } from "./character.js";

const RENDER_DELAY = 110; // ms

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
    this.material = new THREE.MeshStandardMaterial({ color: team.color, roughness: 0.7, metalness: 0.1 });

    this.rig = buildHumanoid(this.material, { height: 1.8 });
    this.group = this.rig.root;

    // everything except the held weapon counts as a target
    this.targets = [];
    this.rig.root.traverse((o) => {
      if (!o.isMesh) return;
      if (this.rig.parts.gun && isDescendantOf(o, this.rig.parts.gun)) return;
      if (o.material === undefined) return;
      this.targets.push(o);
    });

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
  }

  setTeam(teamId) {
    if (teamId === this.team) return;
    this.team = teamId;
    this.material.color.set((TEAMS[teamId] || TEAMS.phantom).color);
  }

  hitMeshes() { return this.targets; }

  get alive() { return this.peer.alive !== false; }

  update(dt = 0.016) {
    const snaps = this.peer.snaps;
    this.setTeam(this.peer.team);

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

    const moving = !!b.moving;
    if (moving) this.phase += dt * 9;

    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;

    poseHumanoid(this.rig, { phase: this.phase, moving, pitch: this.pitch, lower: this.lower, dt });

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
    });
    this.material.dispose();
    this.tag.material.map?.dispose();
    this.tag.material.dispose();
  }
}

function isDescendantOf(node, ancestor) {
  let o = node;
  while (o) { if (o === ancestor) return true; o = o.parent; }
  return false;
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
