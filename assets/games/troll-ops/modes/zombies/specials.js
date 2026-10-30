// Troll Forces Zombies: the late-wave threats (design doc "Zombie Rush:
// what's next", phase M2; claude.ai/artifact/4pfaNykEVdLDTmpYkxL1vs).
//
//   Spitter    (wave 14+) hangs back and lobs acid: a glob in an arc that
//              splashes where you stood and leaves a pool that burns for a
//              few seconds. Wind-up: it rears back (the "spit" clip).
//   Bloater    (wave 16+) slow and swollen; it bursts when it dies or when it
//              reaches you, hurting everyone near and wrecking deployables.
//   Armoured   (wave 20+) a riot helmet and a vest (models/build_zarmour):
//              headshots chip the helmet until it flies off, body shots are
//              cut by the vest.
//   Crawler    any walker-type zombie a heavy hit leaves badly hurt may lose
//              its legs and come on dragging itself (the "crawl" clip, the
//              legs hidden by their bones like a popped head).
//
// horde.js calls the hooks (attach, damage, step, death); run.js runs the
// frame (globs, pools, debris) and hands this file the local player and the
// deployables. Co-op: the host decides; spits, bursts and helmets go out as
// "x" events (coop.js), the spit and the crawl as animation states, and every
// client hurts only its own player.

import * as THREE from "three";
import { loadModel } from "../../maps/battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1-hgb6";

export const SPECIALS = {
  spitter: {
    near: 5, far: 16,          // m: it spits from this band, and keeps out of the near end
    cd: 4.5,                   // s between spits
    windup: 0.53,              // s from rearing back to the release (the clip's frame 16)
    hit: 18, splash: 1.3,      // a direct splash: damage, radius
    pool: { r: 1.5, life: 6, dps: 12, depDps: 25 },
  },
  bloater: { reach: 1.7, radius: 4.2, damage: 48, depDamage: 320 },
  armoured: { helmet: 0.5, headThrough: 0.15, vest: 0.6 },   // helmet hp share; damage through it; body damage under the vest
  crawl: { below: 0.45, odds: 0.35, speed: 0.42, reach: 1.2 },
};

/* What run.js gives this file each frame (setSpecialsHooks). */
const hooks = {
  feet: () => null,           // the local player's feet (Vector3)
  hurt: (dmg, at) => {},      // the local player takes `dmg` from `at`
  deployables: () => [],      // host: { alive, pos, box } list
  hitDeployable: (e, dmg) => {},
  host: () => true,
  out: (ev) => {},            // host: an "x" event for the wire
  scene: () => null,
  impact: (at, opts) => {},
  sound: (kind, at) => {},
};
export function setSpecialsHooks(h) { Object.assign(hooks, h); }

/* ------------------------------------------------------------ armour */

let armour = null;
export function preloadArmour() {
  armour ||= Promise.all([loadModel("zombie-helmet"), loadModel("zombie-vest")]).then(([helmet, vest]) => {
    for (const o of [helmet, vest]) o.traverse((n) => {
      if (!n.isMesh) return;
      n.castShadow = true;
      const m = n.material;
      if (m?.name === "ZA_Visor") { m.transparent = true; m.opacity = 0.55; m.depthWrite = false; m.roughness = 0.05; }
    });
    return { helmet, vest };
  }).catch(() => null);
  return armour;
}

/* Pin a piece under `bone` at `offset` from the bone's rest position (root
   space, metres; the bodies face -z, the GLBs +z, so it's turned round): the
   skeleton is put back in its bind pose for the moment of the fitting, so it
   lines up whatever the clip is doing. */
function pin(z, piece, boneName, offset, scale = 1) {
  const bone = z.body?.bones[boneName];
  if (!bone) return null;
  const root = z.body.root;
  const skinned = [];
  z.body.model.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  for (const s of skinned) s.skeleton.pose();
  root.updateMatrixWorld(true);
  const at = root.worldToLocal(bone.getWorldPosition(new THREE.Vector3())).add(offset);
  piece.position.copy(at);
  piece.rotation.set(0, Math.PI, 0);
  piece.scale.setScalar(scale);
  root.add(piece);
  bone.attach(piece);
  return piece;
}

function attachArmour(z) {
  const S = SPECIALS.armoured;
  z.helmetHp = z.maxHp * S.helmet;
  preloadArmour().then((kit) => {
    if (!kit || !z.body || z.disposed) return;
    if (z.helmetHp > 0) z.helmet = pin(z, kit.helmet.clone(), "head", new THREE.Vector3(0, 0.085, -0.015), 0.82);
    z.vest = pin(z, kit.vest.clone(), "spine_03", new THREE.Vector3(0, 0.02, -0.01));
  });
}

/* The helmet comes off: off the bone, into the air with a spin, then gone. */
const debris = [];
export function knockHelmet(z) {
  z.helmetHp = 0;
  const h = z.helmet;
  if (!h) return;
  z.helmet = null;
  const scene = hooks.scene();
  if (!scene) { h.parent?.remove(h); return; }
  scene.attach(h);
  const yaw = z.mesh.rotation.y;
  // back off the head (it faces -sin, -cos of its yaw) and up
  debris.push({ obj: h, t: 0, v: new THREE.Vector3(Math.sin(yaw) * 1.6 + (Math.random() - 0.5), 3.2, Math.cos(yaw) * 1.6 + (Math.random() - 0.5)),
    spin: new THREE.Vector3(6 + Math.random() * 4, Math.random() * 4, 3), floor: z.groundY });
  hooks.sound("helmet", h.position);
  hooks.impact(h.position.clone(), { surface: "concrete", scale: 1.5 });
}

/* ------------------------------------------------------------ the hooks */

/* A new zombie (horde.js constructor). */
export function attachSpecial(z) {
  if (z.type.id === "armoured" && z.body) attachArmour(z);
  if (z.type.id === "spitter") z.spitCd = 1.5 + Math.random() * 2;
}

/* Its share of a hit (horde.js takeDamage, the host's or solo). Returns the
   damage that gets through. */
export function specialDamage(z, dmg, isHead) {
  if (z.type.id !== "armoured") return dmg;
  const S = SPECIALS.armoured;
  if (isHead && z.helmetHp > 0) {
    z.helmetHp -= dmg;
    if (z.helmetHp <= 0) { knockHelmet(z); hooks.out(["k", z.nid]); }
    return dmg * S.headThrough;
  }
  return isHead ? dmg : dmg * S.vest;
}

/* A heavy hit that didn't kill (horde.js): some go down on their arms. */
export function maybeCrawl(z, heavy) {
  const C = SPECIALS.crawl;
  if (!heavy || z.crawling || !z.body?.actions.crawl || z.type.boss || z.type.leaps) return;
  if (!["walker", "runner", "armoured"].includes(z.type.id)) return;
  if (z.hp > z.maxHp * C.below || Math.random() >= C.odds) return;
  z.makeCrawler();
}

/* This frame's special move, before the walking (horde.js update). Returns
   true when it took the frame (the spitter planted for a spit, the bloater
   going up). `t`: { pos (eye), feetY, dist, chase, clear() }. */
export function specialStep(z, dt, t) {
  if (z.type.id === "spitter") return spitterStep(z, dt, t);
  if (z.type.id === "bloater" && t.chase && t.dist <= SPECIALS.bloater.reach && Math.abs(t.feetY - z.groundY) < 0.8) {
    z.killedBy = null; z.killCash = 0;
    z.takeDamage(z.hp + 1, false);   // it pops itself (burst() comes with the death)
    return true;
  }
  return false;
}

function spitterStep(z, dt, t) {
  const S = SPECIALS.spitter;
  z.spitCd = Math.max(0, (z.spitCd || 0) - dt);
  if (z.spitT > 0) {
    // planted, rearing back, then the release
    z.spitT -= dt;
    z.velocity.set(0, 0, 0);
    z._face(Math.atan2(-(t.pos.x - z.mesh.position.x), -(t.pos.z - z.mesh.position.z)), dt * 2);
    if (z.spitT <= 0) spit(z, t);
    return true;
  }
  if (!t.chase || z.staggerT > 0) return false;
  const level = Math.abs(t.feetY - z.groundY) < 3;
  if (z.spitCd <= 0 && level && t.dist >= S.near && t.dist <= S.far && t.clear()) {
    z.spitT = S.windup;
    z.spitAim = { x: t.pos.x, y: t.feetY, z: t.pos.z };
    z.attackT = 0;
    z.play?.("spit", 0.1);
    z.voiceEvent = "snarl";
    return true;
  }
  // between spits it keeps its distance: no closer than the near band
  if (t.dist < S.far * 0.6 && t.dist > S.near && z.spitCd > 0) {
    z.velocity.multiplyScalar(Math.max(0, 1 - 8 * dt));
    z._face(Math.atan2(-(t.pos.x - z.mesh.position.x), -(t.pos.z - z.mesh.position.z)), dt);
    z.idling = true;
    return true;
  }
  return false;
}

/* The release: a glob from the mouth to where the target stood. */
function spit(z, t) {
  z.spitCd = SPECIALS.spitter.cd * (0.8 + Math.random() * 0.4);
  const head = z.body?.bones.head?.getWorldPosition(new THREE.Vector3()) || z.mesh.position.clone().setY(z.groundY + 1.6);
  const to = z.spitAim || { x: t.pos.x, y: t.feetY, z: t.pos.z };
  const ev = ["s", z.nid, +head.x.toFixed(2), +head.y.toFixed(2), +head.z.toFixed(2), +to.x.toFixed(2), +to.y.toFixed(2), +to.z.toFixed(2)];
  hooks.out(ev);
  launchGlob(ev.slice(2));
}

/* A death (horde.js takeDamage, or the wire's): a bloater bursts. */
export function specialDeath(z) {
  if (z.type.id !== "bloater" || z.burst) return;
  z.burst = true;
  const at = (z.body?.bones.spine_02?.getWorldPosition(new THREE.Vector3()) || z.mesh.position.clone().setY(z.groundY + 1));
  if (hooks.host()) hooks.out(["b", z.nid, +at.x.toFixed(2), +at.y.toFixed(2), +at.z.toFixed(2)]);
  burst(at, z);
}

/* ------------------------------------------------------------ the wire */

/* coop.js: an "x" event from the host. `byNid` finds a mirrored zombie. */
export function onSpecialEvent(ev, byNid) {
  const [, sub] = ev;
  if (sub === "s") {
    const z = byNid(ev[2]);
    if (z?.proxy && !z.dying) { z.play?.("spit", 0.1); z.attackT = 0.9; }
    launchGlob(ev.slice(3));
  } else if (sub === "b") {
    const z = byNid(ev[2]);
    if (z) z.burst = true;
    burst(new THREE.Vector3(ev[3], ev[4], ev[5]), z);
  } else if (sub === "k") {
    const z = byNid(ev[2]);
    if (z) knockHelmet(z);
  }
}

/* ------------------------------------------------------------ globs and pools */

const globs = [];
const pools = [];
let globGeo = null, globMat = null, poolTex = null;

function acidMaterial() {
  globMat ||= new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5fd41e), toneMapped: false });
  return globMat;
}

function acidPoolTexture() {
  if (poolTex) return poolTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  r.addColorStop(0, "rgba(190,255,90,.95)"); r.addColorStop(0.55, "rgba(120,220,40,.75)");
  r.addColorStop(0.85, "rgba(60,140,20,.35)"); r.addColorStop(1, "rgba(40,90,10,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = "rgba(230,255,170,.6)";
    g.beginPath(); g.arc(30 + Math.random() * 68, 30 + Math.random() * 68, 2 + Math.random() * 4, 0, Math.PI * 2); g.fill();
  }
  poolTex = new THREE.CanvasTexture(c);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
}

/* [fx, fy, fz, tx, ty, tz]: from the mouth to the floor, an arc. */
function launchGlob([fx, fy, fz, tx, ty, tz]) {
  const scene = hooks.scene();
  if (!scene) return;
  globGeo ||= new THREE.IcosahedronGeometry(0.08, 1);
  const mesh = new THREE.Mesh(globGeo, acidMaterial());
  mesh.position.set(fx, fy, fz);
  scene.add(mesh);
  const d = Math.hypot(tx - fx, tz - fz);
  globs.push({ mesh, from: new THREE.Vector3(fx, fy, fz), to: new THREE.Vector3(tx, ty, tz), k: 0, time: 0.55 + d * 0.035, arc: 1.2 + d * 0.12 });
  hooks.sound("spit", mesh.position);
}

function splash(at) {
  const S = SPECIALS.spitter;
  hooks.impact(at.clone().setY(at.y + 0.1), { surface: "zombie", scale: 2.2 });
  hooks.sound("splash", at);
  const feet = hooks.feet();
  if (feet && Math.hypot(feet.x - at.x, feet.z - at.z) < S.splash && Math.abs(feet.y - at.y) < 1.2) hooks.hurt(S.hit, at);
  const scene = hooks.scene();
  if (!scene) return;
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(S.pool.r, 24), new THREE.MeshBasicMaterial({
    map: acidPoolTexture(), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(at.x, at.y + 0.03, at.z);
  mesh.renderOrder = 2;
  mesh.name = "zacid";
  scene.add(mesh);
  pools.push({ mesh, at: at.clone(), t: S.pool.life, tick: 0 });
}

/* The bloater going up: a cloud, gore, a stain, and the hurt. */
function burst(at, z) {
  const B = SPECIALS.bloater;
  hooks.impact(at.clone(), { surface: "blood", scale: 5 });
  hooks.impact(at.clone().setY(at.y + 0.3), { surface: "zombie", scale: 4 });
  hooks.sound("burst", at);
  if (z?.mesh) z.mesh.visible = false;          // nothing left of it to fall
  const scene = hooks.scene();
  if (scene) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({
      color: 0x8fbf3a, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false,
    }));
    cloud.position.copy(at);
    cloud.name = "zburst";
    scene.add(cloud);
    debris.push({ obj: cloud, t: 0, cloud: true, r: B.radius });
  }
  const feet = hooks.feet();
  if (feet) {
    const d = Math.hypot(feet.x - at.x, feet.z - at.z);
    if (d < B.radius && Math.abs(feet.y - (at.y - 1)) < 2) hooks.hurt(Math.round(B.damage * (1 - 0.6 * d / B.radius)), at);
  }
  if (hooks.host()) {
    for (const e of hooks.deployables()) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - at.x, e.pos.z - at.z);
      if (d < B.radius) hooks.hitDeployable(e, Math.round(B.depDamage * (1 - 0.5 * d / B.radius)));
    }
  }
}

/* ------------------------------------------------------------ each frame */

export function updateSpecials(dt) {
  const S = SPECIALS.spitter;
  for (let i = globs.length - 1; i >= 0; i--) {
    const g = globs[i];
    g.k = Math.min(1, g.k + dt / g.time);
    g.mesh.position.lerpVectors(g.from, g.to, g.k);
    g.mesh.position.y += 4 * g.arc * g.k * (1 - g.k);
    g.mesh.scale.setScalar(1 + 0.25 * Math.sin(g.k * 20));
    if (g.k < 1) continue;
    g.mesh.parent?.remove(g.mesh);
    globs.splice(i, 1);
    splash(g.to);
  }
  const feet = hooks.feet();
  for (let i = pools.length - 1; i >= 0; i--) {
    const p = pools[i];
    p.t -= dt;
    p.mesh.material.opacity = Math.min(1, p.t / 1.2);
    p.mesh.rotation.z += dt * 0.3;
    if (p.t <= 0) { p.mesh.parent?.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); pools.splice(i, 1); continue; }
    p.tick -= dt;
    if (p.tick > 0) continue;
    p.tick = 0.5;   // the burn comes in half-second bites
    if (feet && Math.hypot(feet.x - p.at.x, feet.z - p.at.z) < S.pool.r && Math.abs(feet.y - p.at.y) < 0.7) hooks.hurt(Math.round(S.pool.dps * 0.5), p.at);
    if (hooks.host()) for (const e of hooks.deployables()) {
      if (e.alive && Math.hypot(e.pos.x - p.at.x, e.pos.z - p.at.z) < S.pool.r) hooks.hitDeployable(e, Math.round(S.pool.depDps * 0.5));
    }
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.t += dt;
    if (d.cloud) {
      const k = Math.min(1, d.t / 0.35);
      d.obj.scale.setScalar(0.4 + (d.r * 0.8) * k);
      d.obj.material.opacity = 0.45 * Math.max(0, 1 - d.t / 1.6);
      if (d.t >= 1.6) { d.obj.parent?.remove(d.obj); d.obj.geometry.dispose(); d.obj.material.dispose(); debris.splice(i, 1); }
      continue;
    }
    // a helmet: up, spinning, down to the floor, a moment there, gone
    const o = d.obj;
    if (o.position.y > d.floor + 0.12) {
      d.v.y -= 9.8 * dt;
      o.position.addScaledVector(d.v, dt);
      o.rotation.x += d.spin.x * dt; o.rotation.y += d.spin.y * dt; o.rotation.z += d.spin.z * dt;
    } else o.position.y = d.floor + 0.12;
    if (d.t > 5) { o.parent?.remove(o); debris.splice(i, 1); }
  }
}

/* The run's over: no globs, pools or helmets left lying about. */
export function clearSpecials() {
  for (const g of globs) g.mesh.parent?.remove(g.mesh);
  for (const p of pools) { p.mesh.parent?.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); }
  for (const d of debris) d.obj.parent?.remove(d.obj);
  globs.length = 0; pools.length = 0; debris.length = 0;
}

/* Tests (__trollOps.zrun().specials). */
export function specialsDebug() {
  return { globs, pools, debris, SPECIALS, spitAt: (from, to) => launchGlob([...from, ...to]), burstAt: (at) => burst(new THREE.Vector3(...at), null) };
}
