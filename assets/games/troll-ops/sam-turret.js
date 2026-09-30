// Troll Forces — SAM Turret (Black Ops 2 scorestreak).
//
// BO2's SAM Turret is an anti-air launcher you set down on the ground: it
// tracks enemy aircraft by itself and fires surface-to-air missiles at
// them (UAVs, Counter-UAVs, drones, gunships, warships, Dragonfires), never
// at people. Enemies can shoot it to destroy it. Model read off the
// reference render: a folding tripod with round feet, a post and yoke, a
// small sensor head with a white dome, and a four-cell missile pod either
// side. game.js picks targets and applies the kills; this file is the
// model, the aim and the missiles' flight.

import * as THREE from "three";

export const SAM_DURATION = 90;        // seconds on the ground
export const SAM_HP = 500;             // bullets it takes to kill it
export const SAM_RANGE = 140;          // metres it can lock at
export const SAM_LOCK = 0.9;           // seconds on target before a launch
export const SAM_SALVO_GAP = 0.25;     // between the two missiles of a pair
export const SAM_RELOAD = 3.2;         // after a pair
export const SAM_TURN = 2.4;           // rad/s it slews
export const SAM_MISSILES = 8;         // four cells a pod, two pods
export const MISSILE_SPEED = 55;
export const MISSILE_TURN = 3.2;       // rad/s homing
export const MISSILE_LIFE = 5;
export const MISSILE_HIT = 2.2;        // proximity fuse radius

/* ---------------------------------------------------------------- textures */

let paintTex = null;
/* Worn olive-drab: base with a mottled cloud, edge wear and fine grain. */
function paintTexture() {
  if (paintTex) return paintTex;
  const N = 256;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d");
  g.fillStyle = "#5d5f4a";
  g.fillRect(0, 0, N, N);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * N, y = rnd() * N, r = 4 + rnd() * 18;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const light = rnd() > 0.5;
    rg.addColorStop(0, light ? "rgba(122,122,98,.12)" : "rgba(38,40,30,.12)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 90; i++) {                    // chips down to metal
    g.fillStyle = `rgba(150,146,130,${0.15 + rnd() * 0.3})`;
    g.fillRect(rnd() * N, rnd() * N, 1 + rnd() * 4, 1 + rnd() * 2);
  }
  const img = g.getImageData(0, 0, N, N);
  for (let i = 0; i < img.data.length; i += 4) {
    const k = (rnd() - 0.5) * 12;
    img.data[i] += k; img.data[i + 1] += k; img.data[i + 2] += k;
  }
  g.putImageData(img, 0, 0);
  paintTex = new THREE.CanvasTexture(c);
  paintTex.colorSpace = THREE.SRGBColorSpace;
  paintTex.wrapS = paintTex.wrapT = THREE.RepeatWrapping;
  paintTex.repeat.set(3, 3);
  return paintTex;
}

let podFaceTex = null;
/* The pod's front: a 2x2 grid of square cells, each a recessed dark tube
   mouth behind a frame with bolts, stencilled numbers. */
function podFaceTexture() {
  if (podFaceTex) return podFaceTex;
  const N = 256;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d");
  g.fillStyle = "#4f513f"; g.fillRect(0, 0, N, N);
  const cell = N / 2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const x = i * cell, y = j * cell;
    g.fillStyle = "#3a3c2f"; g.fillRect(x + 8, y + 8, cell - 16, cell - 16);
    const rg = g.createRadialGradient(x + cell / 2, y + cell / 2, 4, x + cell / 2, y + cell / 2, cell / 2);
    rg.addColorStop(0, "#0b0c0a"); rg.addColorStop(0.7, "#1c1d18"); rg.addColorStop(1, "#2f3127");
    g.fillStyle = rg; g.fillRect(x + 16, y + 16, cell - 32, cell - 32);
    // cover membrane cross-lines
    g.strokeStyle = "rgba(90,92,74,.55)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x + 18, y + 18); g.lineTo(x + cell - 18, y + cell - 18);
    g.moveTo(x + cell - 18, y + 18); g.lineTo(x + 18, y + cell - 18); g.stroke();
    g.fillStyle = "#8e8c78";
    for (const [bx, by] of [[12, 12], [cell - 12, 12], [12, cell - 12], [cell - 12, cell - 12]]) {
      g.beginPath(); g.arc(x + bx, y + by, 3, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "rgba(210,205,170,.7)";
    g.font = "bold 14px monospace";
    g.fillText(String(i * 2 + j + 1), x + 20, y + cell - 18);
  }
  podFaceTex = new THREE.CanvasTexture(c);
  podFaceTex.colorSpace = THREE.SRGBColorSpace;
  return podFaceTex;
}

/* ---------------------------------------------------------------- geometry */

function bevelBox(w, h, d, r = 0.01) {
  const iw = w - 2 * r, ih = h - 2 * r, cr = Math.min(r * 1.4, iw / 2, ih / 2);
  const s = new THREE.Shape();
  const x0 = -iw / 2, y0 = -ih / 2;
  s.moveTo(x0 + cr, y0);
  s.lineTo(x0 + iw - cr, y0); s.quadraticCurveTo(x0 + iw, y0, x0 + iw, y0 + cr);
  s.lineTo(x0 + iw, y0 + ih - cr); s.quadraticCurveTo(x0 + iw, y0 + ih, x0 + iw - cr, y0 + ih);
  s.lineTo(x0 + cr, y0 + ih); s.quadraticCurveTo(x0, y0 + ih, x0, y0 + ih - cr);
  s.lineTo(x0, y0 + cr); s.quadraticCurveTo(x0, y0, x0 + cr, y0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3 });
  geo.translate(0, 0, -(d - 2 * r) / 2);
  geo.computeVertexNormals();
  return geo;
}

/* A tube between two points. */
function tube(a, b, r, mat, seg = 12) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true;
  return m;
}

const _mats = {};
function mats() {
  if (_mats.paint) return _mats;
  _mats.paint = new THREE.MeshStandardMaterial({ map: paintTexture(), roughness: 0.72, metalness: 0.25 });
  _mats.paintDark = new THREE.MeshStandardMaterial({ map: paintTexture(), color: 0xa9ab9c, roughness: 0.75, metalness: 0.25 });
  _mats.face = new THREE.MeshStandardMaterial({ map: podFaceTexture(), roughness: 0.8, metalness: 0.2 });
  _mats.steel = new THREE.MeshStandardMaterial({ color: 0x8a8c86, roughness: 0.35, metalness: 0.85 });
  _mats.dark = new THREE.MeshStandardMaterial({ color: 0x23241f, roughness: 0.55, metalness: 0.5 });
  _mats.rubber = new THREE.MeshStandardMaterial({ color: 0x1a1a18, roughness: 0.9, metalness: 0 });
  _mats.dome = new THREE.MeshStandardMaterial({ color: 0xe9e8e1, roughness: 0.35, metalness: 0.05 });
  _mats.cage = new THREE.MeshStandardMaterial({ color: 0xcfcdc4, roughness: 0.4, metalness: 0.6 });
  _mats.lamp = new THREE.MeshBasicMaterial({ color: 0x61ff5a, toneMapped: false });
  _mats.lampRed = new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false });
  return _mats;
}

/* The turret, origin at the feet, facing -z. Returns { root, head (yaw),
   cradle (pitch), cells: [Object3D x8 muzzle points], lamp, hitbox }. */
export function buildSamTurretModel() {
  const M = mats();
  const root = new THREE.Group();
  root.name = "SamTurret";
  const add = (geo, mat, x, y, z, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // --- tripod: three legs splayed 120 degrees apart, each an upper tube
  // from the hub collar to a knee clamp, a lower tube to a round foot pad.
  const hubY = 0.95;
  add(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 16), M.paintDark, 0, hubY, 0);       // leg collar
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) + Math.PI / 6;
    const dx = Math.sin(a), dz = Math.cos(a);
    const top = V(dx * 0.07, hubY - 0.02, dz * 0.07);
    const knee = V(dx * 0.42, 0.52, dz * 0.42);
    const foot = V(dx * 0.72, 0.05, dz * 0.72);
    root.add(tube(top, knee, 0.03, M.paint));
    root.add(tube(knee, foot, 0.024, M.paint));
    // knee clamp: a short fat sleeve with a lever
    const k = tube(knee.clone().lerp(top, 0.08), knee.clone().lerp(foot, 0.1), 0.038, M.paintDark);
    root.add(k);
    const lever = add(new THREE.BoxGeometry(0.02, 0.09, 0.02), M.dark, knee.x + dz * 0.04, knee.y + 0.02, knee.z - dx * 0.04);
    lever.rotation.y = a;
    // hinge at the collar
    const hinge = add(new THREE.CylinderGeometry(0.022, 0.022, 0.08, 10), M.steel, top.x, top.y + 0.01, top.z);
    hinge.rotation.set(0, a, Math.PI / 2);
    // brace from the leg to the post
    root.add(tube(V(dx * 0.26, 0.72, dz * 0.26), V(0, 0.62, 0), 0.012, M.dark, 8));
    // foot: a rubber disc on a ball joint
    add(new THREE.SphereGeometry(0.03, 12, 8), M.steel, foot.x, foot.y + 0.02, foot.z);
    add(new THREE.CylinderGeometry(0.075, 0.085, 0.03, 18), M.rubber, foot.x, 0.015, foot.z);
    add(new THREE.CylinderGeometry(0.06, 0.07, 0.02, 18), M.paintDark, foot.x, 0.04, foot.z);
  }
  // Post under the hub, down to the brace ring.
  add(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 14), M.paint, 0, 0.8, 0);
  add(new THREE.TorusGeometry(0.05, 0.012, 8, 18), M.dark, 0, 0.62, 0).rotation.x = Math.PI / 2;

  // --- head: turns in yaw on a bearing above the collar.
  const head = new THREE.Group();
  head.position.y = hubY + 0.07;
  root.add(head);
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 20), M.steel, 0, 0.0, 0, head);           // bearing ring
  add(new THREE.CylinderGeometry(0.085, 0.1, 0.08, 20), M.paintDark, 0, 0.06, 0, head);
  // Yoke arms up either side.
  for (const sx of [-1, 1]) {
    add(bevelBox(0.05, 0.26, 0.12, 0.012), M.paint, sx * 0.13, 0.2, 0, head);
    const trun = add(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 16), M.steel, sx * 0.165, 0.3, 0, head);
    trun.rotation.z = Math.PI / 2;
  }
  add(bevelBox(0.3, 0.05, 0.14, 0.012), M.paintDark, 0, 0.11, 0, head);                   // yoke base

  // --- cradle: pitches on the trunnions, carries the sensor and both pods.
  const cradle = new THREE.Group();
  cradle.position.y = 0.3;
  head.add(cradle);
  add(bevelBox(0.2, 0.18, 0.26, 0.018), M.paint, 0, 0, 0.0, cradle);                       // sensor box
  add(bevelBox(0.12, 0.08, 0.02, 0.006), M.dark, 0, 0.0, -0.135, cradle);                  // sensor window
  const lens = add(new THREE.CylinderGeometry(0.028, 0.03, 0.02, 16), M.dark, 0, 0, -0.145, cradle);
  lens.rotation.x = Math.PI / 2;
  // White radome with its guard cage on top.
  add(new THREE.CylinderGeometry(0.075, 0.08, 0.04, 20), M.paintDark, 0, 0.11, 0.0, cradle);
  add(new THREE.SphereGeometry(0.075, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.dome, 0, 0.13, 0, cradle);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const arc = add(new THREE.TorusGeometry(0.088, 0.004, 5, 16, Math.PI), M.cage, 0, 0.13, 0, cradle);
    arc.rotation.set(0, a, 0);
  }
  add(new THREE.TorusGeometry(0.088, 0.005, 5, 24), M.cage, 0, 0.13, 0, cradle).rotation.x = Math.PI / 2;
  const lamp = add(new THREE.SphereGeometry(0.012, 8, 6), M.lamp, 0.07, 0.07, 0.13, cradle);
  // Pods: a 2x2 cell block each side, bolted to a side arm.
  const cells = [];
  for (const sx of [-1, 1]) {
    const pod = new THREE.Group();
    pod.position.set(sx * 0.38, 0.02, 0.0);
    cradle.add(pod);
    add(bevelBox(0.3, 0.3, 0.52, 0.02), M.paint, 0, 0, 0, pod);
    // front and rear faces with the cell grid
    const face = add(new THREE.PlaneGeometry(0.27, 0.27), M.face, 0, 0, -0.261, pod);
    face.rotation.y = Math.PI;
    const back = add(new THREE.PlaneGeometry(0.27, 0.27), M.face, 0, 0, 0.261, pod);
    void back;
    // raised ribs round the pod and a carry handle on top
    for (const z of [-0.2, 0, 0.2]) add(bevelBox(0.315, 0.315, 0.025, 0.006), M.paintDark, 0, 0, z, pod);
    add(bevelBox(0.03, 0.03, 0.2, 0.008), M.dark, 0, 0.17, 0, pod);
    for (const z of [-0.09, 0.09]) add(new THREE.BoxGeometry(0.02, 0.03, 0.02), M.dark, 0, 0.155, z, pod);
    // side stencil strip and cable
    add(new THREE.BoxGeometry(0.004, 0.06, 0.22), M.dark, sx * 0.152, -0.08, 0.05, pod);
    // mount arm to the cradle
    add(bevelBox(0.14, 0.08, 0.16, 0.01), M.paintDark, -sx * 0.2, -0.02, 0.02, pod);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const p = new THREE.Object3D();
      p.position.set((i - 0.5) * 0.135, (j - 0.5) * 0.135, -0.27);
      pod.add(p);
      cells.push(p);
    }
  }
  // Rear status lights.
  add(new THREE.SphereGeometry(0.01, 8, 6), M.lampRed, -0.07, 0.07, 0.13, cradle);

  // An invisible hit volume for bullets.
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
  hitbox.position.y = 0.8;
  root.add(hitbox);
  return { root, head, cradle, cells, lamp, hitbox };
}

/* ---------------------------------------------------------------- entity */

let missileGeo = null, missileMat = null, flameMat = null;
function missileMesh() {
  if (!missileGeo) {
    const body = new THREE.CylinderGeometry(0.045, 0.045, 0.7, 10);
    body.rotateX(Math.PI / 2);
    missileGeo = body;
    missileMat = new THREE.MeshStandardMaterial({ color: 0xe6e4da, roughness: 0.4, metalness: 0.3 });
    flameMat = new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(missileGeo, missileMat));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 10), missileMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -0.43;
  g.add(nose);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.12, 0.12), missileMat);
    fin.rotation.z = i * Math.PI / 2;
    fin.position.z = 0.28;
    fin.position.x = Math.cos(i * Math.PI / 2) * 0.0;
    g.add(fin);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 8, 1, true), flameMat);
  flame.rotation.x = Math.PI / 2;
  flame.position.z = 0.6;
  g.add(flame);
  g.userData.flame = flame;
  return g;
}

const _to = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3();

export class SamTurret {
  constructor({ id, owned, team, x, y, z, yaw = 0, duration = SAM_DURATION, botId = null }) {
    this.id = id;
    this.owned = !!owned;
    this.team = team;
    this.botId = botId;
    this.duration = duration;
    this.age = 0;
    this.hp = SAM_HP;
    this.dead = false;
    this.pos = new THREE.Vector3(x, y, z);
    this.m = buildSamTurretModel();
    this.root = this.m.root;
    this.root.position.copy(this.pos);
    this.root.rotation.y = yaw;
    this.yaw = 0;              // head yaw relative to the base
    this.pitch = 0.35;
    this.targetId = null;      // eid of what it's locked onto
    this.lockT = 0;
    this.reloadT = 1.5;        // it has to unfold first
    this.salvo = 0;            // missiles left in the current pair
    this.salvoT = 0;
    this.nextCell = 0;
    this.missiles = [];
    this.m.hitbox.userData.sam = this;
    // Set down: it unfolds out of the ground a little.
    this.deployT = 0;
  }

  get alive() { return !this.dead && this.hp > 0 && this.age < this.duration; }
  hitMeshes() { return this.alive ? [this.m.hitbox] : []; }

  /* Slew toward a world point; returns the angle still to go. */
  aimAt(p, dt) {
    const base = this.root.rotation.y;
    const lx = p.x - this.pos.x, lz = p.z - this.pos.z, ly = p.y - (this.pos.y + 1.3);
    const wantYaw = Math.atan2(-lx, -lz) - base;
    const wantPitch = Math.atan2(ly, Math.hypot(lx, lz));
    let dy = wantYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const step = SAM_TURN * dt;
    this.yaw += Math.max(-step, Math.min(step, dy));
    const dp = Math.max(-0.2, Math.min(1.35, wantPitch)) - this.pitch;
    this.pitch += Math.max(-step, Math.min(step, dp));
    return Math.abs(dy) + Math.abs(dp);
  }

  /* Owner: fire one missile from the next cell at `target` ({ id, pos }). */
  launch(targetId) {
    const cell = this.m.cells[this.nextCell++ % this.m.cells.length];
    const from = cell.getWorldPosition(new THREE.Vector3());
    this.m.cradle.getWorldDirection(_fwd).negate();   // cradle faces -z
    return this.spawnMissile(from, _fwd, targetId);
  }

  spawnMissile(from, dir, targetId) {
    const mesh = missileMesh();
    mesh.position.copy(from);
    mesh.lookAt(_to.copy(from).add(dir));
    this.root.parent?.add(mesh);
    const ms = { mesh, pos: from.clone(), dir: dir.clone().normalize(), targetId, t: 0, done: false };
    this.missiles.push(ms);
    return ms;
  }

  /* `targetPos(id)` -> the target's world position or null (gone).
     Returns the missiles that reached their target this frame. */
  updateMissiles(dt, targetPos) {
    const hits = [];
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const ms = this.missiles[i];
      ms.t += dt;
      const tp = targetPos(ms.targetId);
      if (tp) {
        _dir.copy(tp).sub(ms.pos);
        const d = _dir.length();
        if (d < MISSILE_HIT) { hits.push({ targetId: ms.targetId, at: ms.pos.clone() }); ms.done = true; }
        else {
          _dir.divideScalar(d);
          const ang = Math.acos(Math.max(-1, Math.min(1, ms.dir.dot(_dir))));
          const k = ang > 1e-4 ? Math.min(1, (MISSILE_TURN * dt) / ang) : 1;
          ms.dir.lerp(_dir, k).normalize();
        }
      }
      // A short boost straight out of the tube, then full speed.
      const sp = MISSILE_SPEED * Math.min(1, 0.35 + ms.t * 2);
      ms.pos.addScaledVector(ms.dir, sp * dt);
      ms.mesh.position.copy(ms.pos);
      ms.mesh.lookAt(_to.copy(ms.pos).add(ms.dir));
      ms.mesh.userData.flame.scale.set(1, 0.7 + Math.random() * 0.6, 1);
      if (ms.t > MISSILE_LIFE) { hits.push({ targetId: null, at: ms.pos.clone() }); ms.done = true; }
      if (ms.done) {
        ms.mesh.parent?.remove(ms.mesh);
        this.missiles.splice(i, 1);
      }
    }
    return hits;
  }

  update(dt) {
    this.age += dt;
    this.deployT = Math.min(1, this.deployT + dt / 0.8);
    const u = this.deployT;
    this.root.scale.set(1, 0.6 + 0.4 * u * u * (3 - 2 * u), 1);
    this.m.head.rotation.y = this.yaw;
    this.m.cradle.rotation.x = this.pitch;
    this.m.lamp.material = this.targetId ? (Math.sin(this.age * 20) > 0 ? mats().lampRed : mats().lamp) : mats().lamp;
    if (!this.targetId) {
      // Idle sweep of the sky.
      this.yaw += dt * 0.35;
      this.pitch += (0.5 + Math.sin(this.age * 0.4) * 0.2 - this.pitch) * Math.min(1, dt * 2);
    }
    if (this.dead || this.hp <= 0 || this.age >= this.duration) return "expire";
    return null;
  }

  dispose() {
    this.dead = true;
    for (const ms of this.missiles) ms.mesh.parent?.remove(ms.mesh);
    this.missiles.length = 0;
    this.root.parent?.remove(this.root);
  }
}
