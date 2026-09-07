// Troll Ops — remote player rendering.
//
// Peers are drawn slightly in the past (RENDER_DELAY) and interpolated between
// the two snapshots that bracket that moment. Rendering at "now" would mean
// extrapolating from a 15Hz feed, which reads as jitter; a small fixed delay
// buys smooth motion at the cost of aiming very slightly behind live.

import * as THREE from "three";

const RENDER_DELAY = 110; // ms

export const TEAMS = {
  phantom: { name: "Phantoms", color: 0x8a6ad6, ui: "#a98cf0" },
  ghost:   { name: "Ghosts",   color: 0xd6a85a, ui: "#e8bf76" },
};

const STANCE_HEIGHT = { stand: 1.8, crouch: 1.25, slide: 1.0, prone: 0.75, vault: 1.5 };

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
  sprite.scale.set(1.6, 0.4, 1);
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
    const mat = new THREE.MeshStandardMaterial({ color: team.color, roughness: 0.7, metalness: 0.1 });
    this.material = mat;

    this.group = new THREE.Group();

    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.85, 4, 10), mat);
    this.body.castShadow = true;
    this.group.add(this.body);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), mat);
    this.head.castShadow = true;
    this.head.userData.isHead = true;
    this.group.add(this.head);

    // grin, same language as the grunts — art, never the emoji
    const dark = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    const eyeGeo = new THREE.SphereGeometry(0.045, 6, 6);
    this.eyeL = new THREE.Mesh(eyeGeo, dark);
    this.eyeR = new THREE.Mesh(eyeGeo, dark);
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.026, 6, 12, Math.PI), dark);
    this.mouth.rotation.x = Math.PI;
    this.group.add(this.eyeL, this.eyeR, this.mouth);

    // stubby held weapon so you can read which way they're pointing
    this.gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.12, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x2a2c28, roughness: 0.5, metalness: 0.6 }),
    );
    this.group.add(this.gun);

    this.tag = makeNameTag(peer.name || "operator", team.ui);
    this.group.add(this.tag);

    this.group.userData.remotePlayer = this;
    scene.add(this.group);

    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.height = STANCE_HEIGHT.stand;
  }

  setTeam(teamId) {
    if (teamId === this.team) return;
    this.team = teamId;
    this.material.color.set((TEAMS[teamId] || TEAMS.phantom).color);
  }

  /* Meshes a bullet can hit. */
  hitMeshes() { return [this.body, this.head]; }

  get alive() { return this.peer.alive !== false; }

  update() {
    const snaps = this.peer.snaps;
    this.setTeam(this.peer.team);

    const visible = this.alive && snaps.length > 0;
    this.group.visible = visible;
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

    const targetH = STANCE_HEIGHT[b.stance] ?? STANCE_HEIGHT.stand;
    this.height += (targetH - this.height) * 0.25;

    const bodyH = this.height * 0.62;
    this.body.position.set(this.pos.x, this.pos.y + bodyH, this.pos.z);
    this.body.scale.y = this.height / STANCE_HEIGHT.stand;

    const headY = this.pos.y + this.height - 0.22;
    this.head.position.set(this.pos.x, headY, this.pos.z);

    // face the way they're looking
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    this.eyeL.position.set(this.pos.x + fx * 0.26 - rx * 0.11, headY + 0.07, this.pos.z + fz * 0.26 - rz * 0.11);
    this.eyeR.position.set(this.pos.x + fx * 0.26 + rx * 0.11, headY + 0.07, this.pos.z + fz * 0.26 + rz * 0.11);
    this.mouth.position.set(this.pos.x + fx * 0.27, headY - 0.04, this.pos.z + fz * 0.27);
    this.mouth.rotation.set(Math.PI, -this.yaw, 0);

    this.gun.position.set(
      this.pos.x + fx * 0.42 + rx * 0.2,
      this.pos.y + this.height * 0.72,
      this.pos.z + fz * 0.42 + rz * 0.2,
    );
    this.gun.rotation.set(this.pitch, this.yaw, 0, "YXZ");

    this.tag.position.set(this.pos.x, this.pos.y + this.height + 0.4, this.pos.z);
  }

  /* Where a shot at this player should be reported from. */
  centre(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + this.height * 0.6, this.pos.z);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose?.();
    });
    this.tag.material.map?.dispose();
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

  update() {
    for (const rp of this.byId.values()) rp.update();
  }

  /* Only enemies are shootable — no friendly fire. */
  hitMeshes(myTeam) {
    const out = [];
    for (const rp of this.byId.values()) {
      if (!rp.alive || rp.team === myTeam) continue;
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
