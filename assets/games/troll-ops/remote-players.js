// Troll Forces — remote player rendering.
//
// Peers are drawn slightly in the past (RENDER_DELAY) and interpolated between
// the two snapshots that bracket that moment. Rendering at "now" would mean
// extrapolating from a 15Hz feed, which reads as jitter; a small fixed delay
// buys smooth motion at the cost of aiming very slightly behind live.

import * as THREE from "three";
import { buildHumanoid, poseHumanoid, poseDeath, poseThrowArm, gaitPhaseRate, mountHeldWeapon, aimRig, THROW_TIME, DANCES, DEATH_TIME, ParryState } from "./character.js?v=to-hb4-em1-fc1-wst-soc1";
import { poseEmoteCode } from "./emotes.js?v=hb4-em1-wst-soc1";
import { buildWeaponMesh, stripLights } from "./weapon-model.js?v=p5-em1-wst";
import { WEAPON_DEFS } from "./weapons.js?v=p5bm-wst";
import { MeleeState, buildMeleeMesh, MELEE_DEFS } from "./gear.js?v=to-hb1kb3-bk1-wst-ig1";
import { cleanFaceKey } from "./cosmetics.js?v=hb4-fc1-wst-soc1";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { sharedParaglider } from "./royale-drop.js?v=rp3-wst-bs1";
import { applyHeroBody, syncHeroBody } from "./hero-bodies.js?v=umb3g-nf-wst-ig1-soc1";
import { playerIconCanvas } from "./rank-icons.js?v=rk1";
import { buildDrink, drinkFromCode, mountDrink, poseDrinkArm } from "./saloon-bar.js?v=sb1";

const RENDER_DELAY = 110; // ms
// The fall itself is DEATH_TIME (character.js); the body then stays down
// this long before it's cleared, rather than vanishing the moment it lands.
const BODY_LINGER = 8;
const SWIVEL_TIME = 0.5;   // game.js swivel, played on their body   // seconds a body stays down after the fall (respawning clears it sooner)

/* U Mad Bro?'s cartoon deaths: the body is launched up and away, does one
   full flip about the hips, and lands where the normal fall finishes it.
   The flip is timed to the flight so it ends upright (a whole turn) and
   the death pose lies flat. Purely visual; each client rolls its own. */
let funnyDeaths = false;
export function setFunnyDeaths(on) { funnyDeaths = !!on; }
const LAUNCH_G = 18, LAUNCH_UP = 8, LAUNCH_OUT = 3, LAUNCH_PIVOT = 0.9;
function startLaunch(root) {
  const a = Math.random() * Math.PI * 2;
  return { x: root.position.x, y: root.position.y, z: root.position.z, vx: Math.cos(a) * LAUNCH_OUT, vz: Math.sin(a) * LAUNCH_OUT, t: 0, dir: Math.random() < 0.5 ? -1 : 1 };
}
function stepLaunch(rig, L, dt) {
  const root = rig.root;
  const T = (2 * LAUNCH_UP) / LAUNCH_G;
  L.t = Math.min(T, L.t + dt);
  const t = L.t;
  root.position.set(L.x + L.vx * t, L.y + LAUNCH_UP * t - 0.5 * LAUNCH_G * t * t, L.z + L.vz * t);
  if (t >= T) { root.rotation.x = 0; return; }
  const ang = L.dir * Math.PI * 2 * (t / T);
  root.rotation.x = ang;
  const dz = -LAUNCH_PIVOT * Math.sin(ang), yaw = root.rotation.y;
  root.position.x += dz * Math.sin(yaw);
  root.position.y += LAUNCH_PIVOT * (1 - Math.cos(ang));
  root.position.z += dz * Math.cos(yaw);
}

/* Troll Royale's landing: a tuck and roll forward, then you run. `k` 0..1
   through it (0 = upright). The rig turns head-over-heels about a point at
   hip height, so it tumbles in place instead of pivoting on its feet. Call
   it every frame after the rig is placed and posed; outside a roll it just
   puts the rig upright. Shared by the local body, bots and peers. */
export const ROLL_TIME = 0.8;
const ROLL_PIVOT = 0.55;
export function rollRig(rig, k) {
  const root = rig.root;
  if (root.rotation.order !== "YXZ") root.rotation.order = "YXZ";
  if (!(k > 0 && k < 1)) { root.rotation.x = 0; return; }
  const a = -Math.PI * 2 * k * k * (3 - 2 * k);
  root.rotation.x = a;
  const dz = -ROLL_PIVOT * Math.sin(a), yaw = root.rotation.y;
  root.position.x += dz * Math.sin(yaw);
  root.position.y += ROLL_PIVOT * (1 - Math.cos(a));
  root.position.z += dz * Math.cos(yaw);
}

/* Troll Royale's drop on any rig (you, bots, peers). `state` is the wire's
   `dr`: 2 = freefall, belly down, arms and legs spread, a flutter in the
   wind; 3 = hanging under the glider, hands up on the lines, legs loose.
   `t` is seconds, for the flutter. Call after poseHumanoid and rollRig. */
export const DROP_BUS = 1, DROP_FALL = 2, DROP_GLIDE = 3;
const FALL_PIVOT = 1.0;   // tip over about the belly, not the feet
export function poseDrop(rig, state, t) {
  const p = rig.parts, root = rig.root;
  if (root.rotation.order !== "YXZ") root.rotation.order = "YXZ";
  const f = Math.sin(t * 11) * 0.07, f2 = Math.sin(t * 7.3 + 1) * 0.06;
  p.torso.rotation.set(0, 0, 0);
  p.chest.rotation.set(0, 0, 0);
  for (const j of [p.kneeL, p.kneeR, p.ankleL, p.ankleR, p.elbowL, p.elbowR]) j.rotation.set(0, 0, 0);
  if (state === DROP_FALL) {
    const a = -1.35;
    root.rotation.x = a;
    const dz = -FALL_PIVOT * Math.sin(a), yaw = root.rotation.y;
    root.position.x += dz * Math.sin(yaw);
    root.position.y += FALL_PIVOT * (1 - Math.cos(a));
    root.position.z += dz * Math.cos(yaw);
    p.chest.rotation.x = -0.25;   // chest up, arching into the wind
    p.armL.rotation.set(1.1 + f, 0, 1.2);
    p.armR.rotation.set(1.1 - f, 0, -1.2);
    p.elbowL.rotation.x = 0.8;
    p.elbowR.rotation.x = 0.8;
    p.legL.rotation.set(-0.2, 0, 0.3 + f2);
    p.legR.rotation.set(-0.2, 0, -0.3 - f2);
    p.kneeL.rotation.x = -0.9;
    p.kneeR.rotation.x = -0.9;
  } else if (state === DROP_GLIDE) {
    root.rotation.x = 0;
    p.armL.rotation.set(2.75, 0, 0.3);
    p.armR.rotation.set(2.75, 0, -0.3);
    p.elbowL.rotation.x = 0.35;
    p.elbowR.rotation.x = 0.35;
    p.legL.rotation.set(0.25 + f, 0, 0.05);
    p.legR.rotation.set(0.2 - f, 0, -0.05);
    p.kneeL.rotation.x = -0.35;
    p.kneeR.rotation.x = -0.3;
  }
  rig.body.update();
}

/* A gun in someone else's hands never moves its parts (no pump, no mag
   out, no inspect), so its twenty-odd meshes become one per material: the
   biggest draw-call saving there is with a room full of bots (Troll Royale
   runs 18). Hidden meshes (the first-person hands) are left out; a mesh
   that animates itself (onBeforeRender) or won't merge stays as it is.
   The root keeps its userData (grip/support points for mountHeldWeapon). */
const _mergeInv = new THREE.Matrix4();
const _mergeM = new THREE.Matrix4();
function mergeHeld(mesh) {
  mesh.updateMatrixWorld(true);
  _mergeInv.copy(mesh.matrixWorld).invert();
  const groups = new Map();
  const loose = [];
  const shown = (o) => { for (let p = o; p && p !== mesh; p = p.parent) if (!p.visible || p.userData.hand) return false; return true; };
  mesh.traverse((o) => {
    if (!o.isMesh || o === mesh || !shown(o)) return;
    _mergeM.multiplyMatrices(_mergeInv, o.matrixWorld);
    const custom = o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender;
    if (custom || Array.isArray(o.material) || o.isInstancedMesh || o.isSkinnedMesh) {
      loose.push({ o, m: _mergeM.clone() });
      return;
    }
    const g = o.geometry;
    const key = `${o.material.uuid}|${Object.keys(g.attributes).sort().join(",")}|${g.index ? 1 : 0}|${Object.keys(g.morphAttributes).length}`;
    if (!groups.has(key)) groups.set(key, { mat: o.material, geos: [], shadow: false });
    const e = groups.get(key);
    e.geos.push(g.clone().applyMatrix4(_mergeM));
    e.shadow = e.shadow || o.castShadow;
  });
  const out = new THREE.Group();
  out.userData = mesh.userData;
  out.scale.copy(mesh.scale);
  for (const e of groups.values()) {
    const merged = e.geos.length === 1 ? e.geos[0] : mergeGeometries(e.geos, false);
    if (!merged) { for (const g of e.geos) out.add(new THREE.Mesh(g, e.mat)); continue; }
    if (e.geos.length > 1) for (const g of e.geos) g.dispose();
    const m = new THREE.Mesh(merged, e.mat);
    m.castShadow = e.shadow;
    out.add(m);
  }
  for (const { o, m } of loose) {
    o.parent.remove(o);
    o.matrixAutoUpdate = true;
    m.decompose(o.position, o.quaternion, o.scale);
    out.add(o);
  }
  return out;
}

/* Materials are freed a few seconds late: a shader warm-up (renderer
   .compileAsync) still polling one that was disposed under it throws. */
function disposeLater(obj) {
  const geos = [], mats = [];
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) geos.push(o.geometry);
    if (o.material) mats.push(o.material);
  });
  setTimeout(() => { for (const g of geos) g.dispose(); for (const m of mats) m.dispose?.(); }, 5000);
}

export const TEAMS = {
  phantom: { name: "Trolls",   color: 0x8a6ad6, ui: "#a98cf0" },
  ghost:   { name: "Jeets",    color: 0xd6a85a, ui: "#e8bf76" },
};

// Name tags read relative to the local player, not by team identity: white
// for friendlies, red for enemies - so who's who is obvious at a glance
// instead of requiring the player to remember which color is their team.
const FRIENDLY_TAG_COLOR = "#ffffff";
const ENEMY_TAG_COLOR = "#ff4d3d";

// How far the body is folded down in each stance, 0 = upright.
export const STANCE_LOWER = { stand: 0, crouch: 0.55, slide: 0.8, prone: 1, vault: 0.3 };

/* `rank` ({ level, prestige, owner }) puts the player's rank icon in front
   of the name (prestige phase 2); it draws in once its art has loaded. */
function makeNameTag(text, colorHex, rank = null) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const icon = rank ? 48 : 0;
  let fs = 30;
  ctx.font = `bold ${fs}px 'DM Mono', monospace`;
  while (fs > 18 && ctx.measureText(text).width > 248 - icon) { fs -= 2; ctx.font = `bold ${fs}px 'DM Mono', monospace`; }
  const w = Math.min(248 - icon, ctx.measureText(text).width);
  const x0 = 128 - (icon + w) / 2;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,.85)";
  ctx.strokeText(text, x0 + icon, 32, 248 - icon);
  ctx.fillStyle = colorHex;
  ctx.fillText(text, x0 + icon, 32, 248 - icon);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  if (rank) {
    playerIconCanvas(rank.level, rank.prestige, rank.owner).then((c) => {
      if (!c) return;
      ctx.drawImage(c, x0, 10, 44, 44);
      tex.needsUpdate = true;
    });
  }
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
    this.ads = 0;         // aiming down sights, 0..1 (smoothed from the wire)
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
    // Trollsaber: how far into the guard the arm is, whether the blade was
    // out last frame, and sounds for game.js to play at this body
    // ({ kind: "ignite" | "retract" | "swing", at }), drained each frame.
    this.blockT = 0;
    this.parry = new ParryState();   // last deflect's parry (game.js onRemoteDeflect)
    this.swivelSeen = null;                  // their swivel counter (sv); a change starts a spin
    this.swivelT = 9;
    this.swivelDir = 0;
    this.saberOut = false;
    this.sfx = [];
  }

  get saber() { return this.meleeMesh?.userData.saber || null; }

  /* Middle of the blade in world space (deflect sparks), or null. */
  bladeMid(out = new THREE.Vector3()) {
    const s = this.saber;
    if (!s || !this.saberOut) return null;
    out.copy(s.tipLocal).lerp(s.rootLocal, 0.45);
    return this.meleeMesh.localToWorld(out);
  }

  /* Start playing a swing the peer announced, with the sword in the fist and
     the gun put away until it's done - the same swap the local body makes. */
  startMelee(kind, defId) {
    if (!this.ensureMelee(defId)) return;
    this.melee.t = 0;
    this.melee.swingIndex = kind & 1;
    this.melee.start();
    if (this.melee.saber) this.sfx.push({ kind: "swing", at: this.centre() });
  }

  /* The melee state and the sword in the fist, built the first time either
     a swing or a peer holding their melee weapon needs them. */
  ensureMelee(defId) {
    if (!MELEE_DEFS[defId]) return false;
    if (!this.melee || this.melee.def.id !== defId) this.melee = new MeleeState(defId);
    // A different melee weapon from last time (keyboard -> saber): rebuild.
    if (this.meleeMesh && this.meleeMesh.userData.meleeId !== defId) {
      this.meleeMesh.parent?.remove(this.meleeMesh);
      this.meleeMesh = null;
      this.saberOut = false;
    }
    if (!this.meleeMesh) {
      this.meleeMesh = buildMeleeMesh(this.melee.def, false, { held3p: true });
      this.meleeMesh.scale.setScalar(1.1);
      this.meleeMesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.meleeMesh.userData.meleeId = defId;
      this.rig.parts.gripR.add(this.meleeMesh);
    }
    return true;
  }

  get swinging() { return !!this.melee?.busy; }

  startParry(side, up) { this.parry.start(side, up); }

  /* Melee state for the killcam's recorder (killcam.js `record`). */
  meleeSample() {
    const on = !!this.meleeMesh?.visible;
    return {
      mid: on ? this.meleeMesh.userData.meleeId : null,
      sw: on && this.swinging ? Math.min(1, this.melee.t / this.melee.total) : -1,
      si: this.melee ? this.melee.swingIndex & 1 : 0,
      bk: on ? this.blockT : 0,
    };
  }

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
      disposeLater(this.weaponMesh);
      this.weaponMesh = null;
    }
    const def = WEAPON_DEFS[weaponId];
    if (!def) return;
    const mesh = mergeHeld(stripLights(buildWeaponMesh(def, { skin })));
    mountHeldWeapon(this.rig, mesh);
    this.weaponMesh = mesh;
  }

  /* Socialize roleplay: the mug or shot glass in their right hand (the
     wire's `dk`), lifted to the mouth while they sip (`ds`). */
  updateDrink(dt, emoting) {
    const d = this.alive && !emoting ? drinkFromCode(this.peer.drink) : null;
    const kind = d?.kind || null;
    if (kind !== this.drinkKind) {
      this.drinkKind = kind;
      if (this.drinkMesh) { this.drinkMesh.parent?.remove(this.drinkMesh); this.drinkMesh = null; }
      if (kind) { this.drinkMesh = buildDrink(kind); mountDrink(this.rig, this.drinkMesh); }
    }
    if (!this.drinkMesh) { this.sipK = 0; return; }
    this.drinkMesh.userData.setSips(d.sips);
    if (this.weaponMesh) this.weaponMesh.visible = false;
    // Up to the mouth while they're sipping, back down after.
    this.sipK = (this.sipK || 0) + ((this.peer.sipping ? 1 : 0) - (this.sipK || 0)) * Math.min(1, dt * 7);
    poseDrinkArm(this.rig, this.sipK);
  }

  setTeam(teamId) {
    this.team = teamId;
  }

  /* Recolor the name tag white (friendly) or red (enemy) relative to
     whoever's looking. ffa/no local team means everyone reads as an enemy. */
  setLocalTeam(myTeam, ffa) {
    const friendly = !ffa && !!myTeam && this.team === myTeam;
    const color = friendly ? FRIENDLY_TAG_COLOR : ENEMY_TAG_COLOR;
    // Rank arrives with their state messages, so the tag redraws when it
    // lands or changes, not only on a team colour change.
    const p = this.peer;
    const rank = p.owner ? { owner: true } : p.level ? { level: p.level, prestige: p.prestige | 0 } : null;
    const rankKey = rank ? (rank.owner ? "o" : `${rank.level}.${rank.prestige}`) : "";
    // Clan tag (prestige phase 4) in front: `[TRLL] name`.
    // Socialize roleplay: their role after the name (saloon-bar.js).
    const base = p.clan ? `[${p.clan}] ${p.name || "operator"}` : (p.name || "operator");
    const text = p.role === "bartender" ? `${base} · Bartender` : base;
    if (color === this.tagColor && rankKey === this.tagRank && text === this.tagText) return;
    this.tagColor = color;
    this.tagRank = rankKey;
    this.tagText = text;
    const tex = this.tag.material.map;
    this.tag.material.map = null;
    this.tag.material.dispose();
    tex.dispose();
    const fresh = makeNameTag(this.tagText, color, rank);
    this.tag.material = fresh.material;
  }

  hitMeshes() { return this.targets; }

  get alive() { return this.peer.alive !== false; }

  update(dt = 0.016, myTeam = null, ffa = false) {
    const snaps = this.peer.snaps;
    this.setTeam(this.peer.team);
    this.setLocalTeam(myTeam, ffa);
    this.setWeaponModel(this.peer.weapon, this.peer.skin || null);
    // Their cosmetic face; poseHumanoid puts it on (character.js setFace).
    this.rig.face = cleanFaceKey(this.peer.face);
    // U Mad Bro? hero body (hero-bodies.js), from the wire's hero id.
    applyHeroBody(this.rig, this.peer.hero);
    syncHeroBody(this.rig);

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
    // Emoting (the peer's `em`, see emotes.js): weapons away.
    // cineEmote: a pose the match intro (match-intro.js) holds them in, local only.
    const em = this.alive ? (this.peer.emote | 0) || (this.cineEmote | 0) : 0;
    if (em !== this.emCode) { this.emCode = em; this.emoteT = 0; }   // a new emote starts from 0
    this.emoteT = em ? (this.emoteT || 0) + dt : 0;
    if (this.meleeMesh) this.meleeMesh.visible = sword && !em;
    if (this.weaponMesh) this.weaponMesh.visible = !sword && !em;
    // The blade snaps out when it comes into their hand and goes back in
    // when it leaves, with the sound, like our own.
    const saberOut = !!this.saber && this.meleeMesh.visible && this.alive;
    if (saberOut !== this.saberOut) {
      this.saberOut = saberOut;
      if (saberOut) { this.saber.snapOff(); this.saber.ignite(); }
      if (snaps.length) this.sfx.push({ kind: saberOut ? "ignite" : "retract", at: this.centre() });
    }
    // The Halo Blade does the same: its prongs unfold as it's drawn.
    const halo = this.meleeMesh?.userData.halo;
    const haloOut = !!halo && this.meleeMesh.visible && this.alive;
    if (haloOut !== !!this.haloOut) {
      this.haloOut = haloOut;
      if (haloOut) { halo.snapOff(); halo.ignite(); }
      if (snaps.length) this.sfx.push({ kind: haloOut ? "haloIgnite" : "haloRetract", at: this.centre() });
    }
    const guard = saberOut && meleeHeld && !swinging && !!this.peer.blocking;
    this.blockT += ((guard ? 1 : 0) - this.blockT) * Math.min(1, dt * 14);
    this.parry.update(dt);

    // Just died: hold the last known pose and play a collapse instead of
    // instantly popping out of existence. Respawning (alive flips back to
    // true) cancels the fall immediately.
    if (!this.alive && this.wasAlive) {
      this.dying = true;
      this.deathT = 0;
      // Running into it carries them forward onto their face; otherwise
      // the round puts them down on their back.
      const last = snaps[snaps.length - 1];
      this.rig.deathHint = { dir: last?.moving && Math.random() < 0.55 ? -1 : 1 };
      this.launch = funnyDeaths ? startLaunch(this.rig.root) : null;
    }
    if (this.alive) this.dying = false;
    this.wasAlive = this.alive;

    rollRig(this.rig, 0);
    if (this.dying) {
      this.deathT += dt;
      this.rig.root.visible = true;
      this.tag.visible = false;
      this.setGlider(false);
      // The body goes down empty-handed: no gun or blade left floating in
      // the fist (user: weapons not visible on death, show the body).
      if (this.weaponMesh) this.weaponMesh.visible = false;
      if (this.meleeMesh) this.meleeMesh.visible = false;
      poseDeath(this.rig, Math.min(1, this.deathT / DEATH_TIME));
      if (this.launch) stepLaunch(this.rig, this.launch, dt);
      if (this.deathT >= DEATH_TIME + BODY_LINGER) this.dying = false;
      return;
    }
    // The match intro puts its own callouts up; the floating tag would double them.
    this.tag.visible = !this.cineEmote;

    const visible = this.alive && snaps.length > 0;
    this.rig.root.visible = visible;
    if (!visible) { this.setGlider(false); return; }

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

    // Troll Royale's drop: nobody's drawn riding the bus (they're inside
    // it); in the air they skydive, then hang under a glider.
    const drop = b.drop | 0;
    this.drop = drop;
    this.setGlider(drop === DROP_GLIDE);
    if (drop === DROP_BUS) {
      this.rig.root.visible = false;
      this.tag.visible = false;
      return;
    }

    // A landing roll: tucked all the way down while it lasts.
    const roll = (b.roll || 0) >= (a.roll || 0) ? (a.roll || 0) + ((b.roll || 0) - (a.roll || 0)) * k : b.roll || 0;
    const wantLower = roll > 0 ? 1 : STANCE_LOWER[b.stance] ?? 0;
    this.lower += (wantLower - this.lower) * Math.min(1, dt * 8);
    this.ads += ((b.ads || 0) - this.ads) * Math.min(1, dt * 14);

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
    // A swivel they started: the body spins the full turn over SWIVEL_TIME.
    if ((this.peer.swivel | 0) !== this.swivelSeen) {
      const first = this.swivelSeen === null;   // just met them: take the count, don't spin
      this.swivelSeen = this.peer.swivel | 0;
      if (this.swivelSeen && !first) { this.swivelT = 0; this.swivelDir = Math.sign(this.swivelSeen); }
    }
    if (this.swivelT < SWIVEL_TIME) {
      this.swivelT += dt;
      const k = Math.min(1, this.swivelT / SWIVEL_TIME);
      this.rig.root.rotation.y += -this.swivelDir * Math.PI * 2 * k * k * (3 - 2 * k);
    }

    // Two-handed carry (armL on the support hand instead of a free run
    // swing) for anything but a sidearm — matches weapon-model.js's own
    // !isPistol gate for whether a weapon actually has a support hand mesh.
    // Nothing on the wire (Socialize: empty hands): arms hang free, no carry.
    const unarmed = !sword && !this.peer.weapon;
    const hasGun = !sword && !unarmed && WEAPON_DEFS[this.weaponId]?.cls !== "sidearm";
    const swing = swinging ? {
      t: Math.min(1, this.melee.t / this.melee.total),
      kind: this.melee.swingIndex % 2 === 0 ? "swing" : "thrust",
    } : null;
    // Their reload: the wire's progress (15 Hz) run on smoothly in between.
    const wireRl = sword ? 0 : this.peer.reload || 0;
    if (!wireRl) this.reloadK = 0;
    else if (wireRl !== this.reloadSeen || !this.reloadK) this.reloadK = wireRl;
    else this.reloadK = Math.min(0.999, this.reloadK + dt / (this.peer.reloadTime || 2.3));
    this.reloadSeen = wireRl;
    if (em && poseEmoteCode(this.rig, em, this.emoteT)) {
      // posed
    } else poseHumanoid(this.rig, {
      phase: this.phase, moving, pitch: this.pitch, lower: this.lower, strafe, forward,
      speed: gaitSpeed, mps: this.gaitMps ?? speed, dt, hasGun,
      hold: sword ? "melee" : unarmed ? "none" : "gun", swing, block: this.blockT, ads: sword || unarmed ? 0 : this.ads,
      fired: this.peer.shotAt ? (performance.now() - this.peer.shotAt) / 1000 : Infinity,
      reload: this.reloadK,
      parry: this.parry.sample(),
    });

    if (this.throwT > 0) poseThrowArm(this.rig, 1 - this.throwT / THROW_TIME);
    this.updateDrink(dt, !!em);
    rollRig(this.rig, roll);
    if (drop) {
      this.dropT = (this.dropT || 0) + dt;
      poseDrop(this.rig, drop, this.dropT);
      if (this.weaponMesh) this.weaponMesh.visible = false;
      if (this.meleeMesh) this.meleeMesh.visible = false;
    }

    this.tag.position.y = 2.15 - this.lower * 0.75;
  }

  /* Killcam playback (killcam.js): pose from a recorded sample instead of
     the live snapshots. Runs after update() in the same frame, so it simply
     wins; the next ordinary update() puts everything back. `hidden` is the
     killer, whose eyes the camera is in. */
  replayPose(s, dt, hidden = false) {
    const root = this.rig.root;
    this.tag.visible = false;
    if (hidden || !s || !s.alive) { root.visible = false; return; }
    root.visible = true;
    if (s.wid && WEAPON_DEFS[s.wid]) this.setWeaponModel(s.wid, this.skin);
    // Sword in the fist at that moment (held, or mid quick-melee): show it,
    // swinging or in the saber guard as recorded.
    const sword = !!s.mid && this.ensureMelee(s.mid);
    if (this.weaponMesh) this.weaponMesh.visible = !sword;
    if (this.meleeMesh) this.meleeMesh.visible = sword;
    if (sword && this.saber) { this.saber.target = 1; this.saber.frac = Math.max(this.saber.frac, 0.999); }
    root.position.set(s.x, s.y, s.z);
    if (s.moving) this.replayPhase = (this.replayPhase || 0) + dt * gaitPhaseRate(3.6);
    aimRig(this.rig, s.yaw, dt, { moving: s.moving });
    poseHumanoid(this.rig, {
      phase: this.replayPhase || 0, moving: s.moving, pitch: s.pitch, lower: s.lower, strafe: 0, forward: 1,
      speed: s.moving ? 0.85 : 0, mps: s.moving ? 3.6 : 0, dt,
      hasGun: !sword && WEAPON_DEFS[this.weaponId]?.cls !== "sidearm", hold: sword ? "melee" : "gun",
      swing: sword && s.sw >= 0 ? { t: s.sw, kind: s.si % 2 === 0 ? "swing" : "thrust" } : null,
      block: sword && s.sw < 0 ? s.bk : 0,
    });
  }

  /* Shadows off for a far-away troll (RemotePlayers' crowd LOD). Meshes
     that never cast one stay that way. */
  setShadow(on) {
    if (this.shadowOn === on) return;
    if (this.shadowOn === undefined && on) { this.shadowOn = true; return; }
    this.shadowOn = on;
    this.rig.root.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.castShadow0 ??= o.castShadow;
      o.castShadow = on && o.userData.castShadow0;
    });
  }

  /* Where a shot at this player should be reported from. */
  centre(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + 1.1 - this.lower * 0.5, this.pos.z);
  }

  /* The glider over their head (a clone of the shared one: removed, never
     disposed). */
  setGlider(on) {
    if (on && !this.glider) {
      this.glider = sharedParaglider();
      this.glider.position.y = 1.7;
      this.rig.root.add(this.glider);
    } else if (!on && this.glider) {
      this.glider.parent?.remove(this.glider);
      this.glider = null;
    }
  }

  dispose() {
    this.setGlider(false);
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
const FAR_HIDE = 150;   // metres: a crowd's trolls past this aren't drawn

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

  /* `eye` (the camera) turns on level of detail in a crowd (Troll Royale's
     100): a troll 40 m off is posed every 2nd frame, 100 m off every 4th,
     staggered, with the skipped time handed over; past 40 m it casts no
     shadow. Small rooms pose everyone every frame, as before. */
  update(dt = 0.016, myTeam = null, ffa = false, eye = null) {
    const lod = !!eye && this.byId.size > 24;
    this.frame = (this.frame || 0) + 1;
    let i = 0;
    for (const rp of this.byId.values()) {
      i++;
      if (!lod) { rp.setShadow(true); rp.update(dt, myTeam, ffa); continue; }
      const d2 = (rp.pos.x - eye.x) ** 2 + (rp.pos.z - eye.z) ** 2;
      rp.setShadow(d2 < 40 * 40);
      const every = d2 > 100 * 100 ? 4 : d2 > 40 * 40 ? 2 : 1;
      rp.lodDt = (rp.lodDt || 0) + dt;
      if ((this.frame + i) % every) continue;
      const step = Math.min(0.1, rp.lodDt);
      rp.lodDt = 0;
      rp.update(step, myTeam, ffa);
      // Past 150 m a troll is a couple of pixels: not drawn at all (the body
      // was most of a 100-troll frame). Still placed, so it can still be hit.
      // A glider is 7 m wide, so it stays in sight twice as far.
      const far = rp.drop === DROP_GLIDE ? FAR_HIDE * 2 : FAR_HIDE;
      if (d2 > far * far && !rp.dying) { rp.rig.root.visible = false; rp.tag.visible = false; }
    }
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
