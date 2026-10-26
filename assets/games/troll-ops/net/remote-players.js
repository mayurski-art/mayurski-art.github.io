// Troll Forces — remote player rendering.
//
// Peers are drawn slightly in the past (RENDER_DELAY) and interpolated between
// the two snapshots that bracket that moment. Rendering at "now" would mean
// extrapolating from a 15Hz feed, which reads as jitter; a small fixed delay
// buys smooth motion at the cost of aiming very slightly behind live.

import * as THREE from "three";
import { buildHumanoid, poseHumanoid, poseDeath, poseThrowArm, gaitPhaseRate, gaitFromVelocity, mountHeldWeapon, aimRig, THROW_TIME, DANCES, DEATH_TIME, ParryState } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { poseEmoteCode, EMOTES, ROLE_BIT } from "../characters/emotes.js?v=hb4-em1-wst-soc1-ng1c2f1m1u-gt1-gt2-cw1-zr10-bf1-sr1-or1-nf2-em2-cf1-gs2-lh1-fg2-lp1-fg3-rc1-rc4-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-ht2-bx1-cg1-mg1-sp1-chg1";
import { THROW, parseThrowWire, poseThrowBody, clearThrowBody } from "../combat/throw-anim.js?v=ta1-th2-cl1-bp1-gt1-gt2-cw1-fj1-zr10-zc1-zc2-bf1-sr1-nf1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { buildWeaponMesh, stripLights } from "../weapons/weapon-model.js?v=p5-em1-wst-hf1-wb1-ar1-ar2-fj1-br1-or1-rt1-ut1-rb4-hp1-bx1-mg1-sp1";
import { WEAPON_DEFS } from "../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1";
import { MeleeState, buildMeleeMesh, MELEE_DEFS } from "../weapons/gear.js?v=to-hb1kb3-bk1-wst-ig1-th2-zr5-zr9-zr10-zp1-or1-rb4-hp1-bx1-mg1-sp1";
import { cleanFaceKey, mayWear, mayEmoteToken } from "../characters/cosmetics.js?v=hb4-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-fj1-zr10-zc1-zc2-bf1-sr1-nf1-or1-nf2-nb1-em2-nb2-pc2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-sf1-mg1-sp1";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { sharedParaglider } from "../modes/royale-drop.js?v=rp3-wst-bs1-sb2-fu1b7b7d-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-bf1-pl2-pi1-sr1-fl1-or1-dc2-dc3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-rb4-hp1-bx1-mg1-tx1-sp1-kbt1-gb1-pm1-kbk2-zw1-tfp7-tfb8-ss1-ss2-ss3";
import { applyHeroBody, syncHeroBody } from "../characters/hero-bodies.js?v=umb3g-nf-wst-ig1-soc1c2f1m1u-th2-gt1-gt2-cw1-zr9-zr10-zp1-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { applyCopBody, syncCopBody } from "../characters/cop-bodies.js?v=cb2-sb2c2m1-gt1-gt2-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { playerIconCanvas } from "../progression/rank-icons.js?v=rk1-or1";
import { buildDrink, drinkFromCode, drinkMax, FILL_TIME, mountDrink, poseDrinkArm } from "../maps/saloon-bar.js?v=sb1b7-cup1-gt1-gt2-cw1-zr10-hr2-zp1-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { poseSeated, poseLapHands, posePraying, posePianoArms, roleLabel } from "../modes/rp-roles.js?v=rp1b7-cd1-sh1-dj2-or1-bw2-sp1";
import { peerHas } from "../progression/perks.js?v=pk1-cl1-bp1-fj1-zc1-zc2-nf1-or1";
import { wearBlocky, setReliefFace } from "../characters/blocky-body.js?v=bk1-cw1-zr10-bf1-sr1-nf1-nx1-or1-nf2-em2-nb2-sb1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-gt1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-rb1-fg3-hd1-rc1-rc3-rc4-rc5-ls1-ut1-er1-cl1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-hl1-mg1-sp1-rh1-ci6-pm1";

/* Socialize seats: game.js hands over the map's seat list (rp.seats), so a
   peer's `seat` (index + 1) can be looked up for its height and kind. */
let seatList = () => null;
export function setSeatLookup(fn) { seatList = fn || (() => null); }

const RENDER_DELAY = 110; // ms
const STOP_HOLD = 0.25;     // s a `moving: false` must hold before the legs stop
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

/* A peer in a Socialize fist fight (modes/social-duel.js "duel" messages):
   flat on their back when floored or shot, else a jab just after they threw
   one. After rollRig, which puts the rig upright. */
function poseDuelPeer(rig, peer) {
  if (peer.duelDown) {
    rig.root.rotation.x = -Math.PI / 2;
    rig.root.position.y += 0.16;
    return;
  }
  const t = (performance.now() - (peer.punchAt || 0)) / 320;
  if (!(t >= 0 && t < 1)) return;
  const k = Math.sin(t * Math.PI), p = rig.parts;
  p.armR.rotation.set(1.1 + k * 0.5, 0, -0.2); p.elbowR.rotation.set(2.0 - k * 1.9, 0, 0);
  p.armL.rotation.set(1.25, 0, 0.3); p.elbowL.rotation.set(2.0, 0, 0);
  rig.body?.update?.();
}

/* Modes that pose peers their own way (modes/club-entry.js: at the club
   door) add `fn(remotePlayer, dt)` here; each runs after the peer's pose,
   every frame. */
export const peerPosers = [];
/* ...and modes that know better where a peer is than the 110 ms-old
   snapshots (modes/social-train.js: a rider stays on their car's deck)
   add `fn(remotePlayer)`; each runs right after the position is
   interpolated, before anything is posed there. */
export const peerPlacers = [];
/* ...and Troll Royale's planes (modes/royale.js): a rider aboard (`dr` 1)
   is drawn only if they're in your plane. Each `fn(remotePlayer, snap)`
   returns null, or `{ m, seatY }` after setting rp.pos (and rp.yaw) in the
   plane's own frame: m the plane's matrix, seatY set when they're sat down. */
export const busPlacers = [];

/* Troll Royale's drop on any rig (you, bots, peers). `state` is the wire's
   `dr`: 2 = freefall, belly down, arms and legs spread, a flutter in the
   wind; 3 = hanging under the glider, hands up on the lines, legs loose.
   `t` is seconds, for the flutter. Call after poseHumanoid and rollRig. */
export const DROP_BUS = 1, DROP_FALL = 2, DROP_GLIDE = 3;
const FALL_PIVOT = 1.0;   // tip over about the belly, not the feet
const _planeQ = new THREE.Quaternion();

/* The first FALL_SHOW s off the ramp (the drop cinematic's fall, modes/
   royale-fall.js): out backwards (`back`, facing into the hold) you go
   over in one backward flip and land on your back, head aft, arms and
   legs up at the sky; then you roll over onto your belly (about your own
   length) and turn flat to face the way you were, into the usual belly-
   down fall. Out forwards it's a head-first tip into the belly-down pose.
   The body's turn as a quaternion (with the facing `yaw`), shared by the
   pose and the first-person camera of the tumble. */
export const FALL_SHOW = 6;
export const FALL_FLIP = 1.5;
const BELLY = -1.35;
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _ax = new THREE.Vector3();
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const qYaw = (y, out) => out.setFromAxisAngle(_ax.set(0, 1, 0), y);
const qX = (a, out) => out.setFromAxisAngle(_ax.set(1, 0, 0), a);
const qY = (a, out) => out.setFromAxisAngle(_ax.set(0, 1, 0), a);
export function fallShowQuat(t, yaw, back, out) {
  if (!back) return qYaw(yaw, out).multiply(qX(BELLY * ease(t / 0.9), _qa));
  if (t < FALL_FLIP) {
    // Over backwards: once right round, then on to your back.
    const k = t / FALL_FLIP, a = (2 * Math.PI + Math.PI / 2) * (1 - (1 - k) * (1 - k));
    return qYaw(yaw, out).multiply(qX(a, _qa));
  }
  if (t < 4.5) return qYaw(yaw, out).multiply(qX(Math.PI / 2 + Math.sin(t * 2.3) * 0.08, _qa));
  if (t < 5.2) {
    // Rolled over about your own length: belly down now, head still aft.
    return qYaw(yaw, out).multiply(qX(Math.PI / 2, _qa)).multiply(qY(Math.PI * ease((t - 4.5) / 0.7), _qb));
  }
  // Flat turn back round to face the way you were, settling into the arch.
  const k = ease((t - 5.2) / (FALL_SHOW - 5.2));
  return qYaw(yaw + Math.PI * (1 - k), out).multiply(qX(-Math.PI / 2 + (Math.PI / 2 + BELLY) * k, _qa));
}
/* How far on your back the show has you: 1 limbs up at the sky, 0 the
   belly-down spread. */
export function fallShowBackK(t, back) {
  if (!back) return 0;
  return t < 4.5 ? 1 : 1 - ease((t - 4.5) / 0.9);
}
const _pv = new THREE.Vector3();
function poseFallShow(rig, t, back, f, f2, yaw = rig.root.rotation.y) {
  const p = rig.parts, root = rig.root;
  fallShowQuat(t, yaw, back, root.quaternion);
  // About the belly, not the feet (as the belly-down pose).
  _pv.set(0, FALL_PIVOT, 0);
  root.position.add(_pv).sub(_pv.applyQuaternion(root.quaternion));
  const up = fallShowBackK(t, back);
  // On your back: arms reaching up at the sky, legs drawn up, flailing
  // (harder while you go over); belly down: the usual spread and arch.
  const flail = up * (t < FALL_FLIP ? 0.35 : 0.18);
  const s1 = Math.sin(t * 9) * flail, s2 = Math.sin(t * 7 + 2) * flail;
  const mix = (a, b) => b + (a - b) * up;
  p.chest.rotation.x = mix(0.15, -0.25);
  p.armL.rotation.set(mix(1.5 + s1, 1.1 + f), 0, mix(0.7 - s2, 1.2));
  p.armR.rotation.set(mix(1.5 - s2, 1.1 - f), 0, mix(-0.7 + s1, -1.2));
  p.elbowL.rotation.x = mix(0.5, 0.8);
  p.elbowR.rotation.x = mix(0.5, 0.8);
  p.legL.rotation.set(mix(1.0 + s2, -0.2), 0, mix(0.2, 0.3 + f2));
  p.legR.rotation.set(mix(0.8 - s1, -0.2), 0, mix(-0.2, -0.3 - f2));
  p.kneeL.rotation.x = mix(-1.3, -0.9);
  p.kneeR.rotation.x = mix(-1.1, -0.9);
}

/* `show` (a freefall's first FALL_SHOW s): whether they went out
   backwards; null for a fall without the show. `showYaw` the way they
   went out (the body keeps it through the show), else their facing. */
export function poseDrop(rig, state, t, show = null, showYaw = undefined) {
  const p = rig.parts, root = rig.root;
  if (root.rotation.order !== "YXZ") root.rotation.order = "YXZ";
  const f = Math.sin(t * 11) * 0.07, f2 = Math.sin(t * 7.3 + 1) * 0.06;
  p.torso.rotation.set(0, 0, 0);
  p.chest.rotation.set(0, 0, 0);
  for (const j of [p.kneeL, p.kneeR, p.ankleL, p.ankleR, p.elbowL, p.elbowR]) j.rotation.set(0, 0, 0);
  if (state === DROP_FALL && show != null && t < FALL_SHOW) {
    poseFallShow(rig, t, show, f, f2, showYaw);
    rig.body.update();
    return;
  }
  // The show turns the body by quaternion; on its back (pitched past 90°)
  // that reads back as a half roll (z = PI, yaw turned round). Everything
  // after sets only x and y, so the roll stayed: bots landed standing on
  // their heads, legs up, head through the island (user, 2026-10-18: "troll
  // bots appear to be in the ground"). Off with it.
  if (root.rotation.z !== 0) root.rotation.set(0, root.rotation.y + (Math.abs(root.rotation.z) > 1.57 ? Math.PI : 0), 0);
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

/* On a rope (movement.js STANCE.ROPE) on any rig: the free (left) hand up
   on the rope above the head, the gun hand left as poseHumanoid aimed it,
   one knee drawn up round the rope and the other leg hanging. `t` is the
   climb phase: it only advances while they climb, so the hand-over-hand and
   the leg swap stop when they hang still. Call after poseHumanoid. */
export function poseRope(rig, t) {
  const p = rig.parts, s = Math.sin(t), c = Math.cos(t);
  p.torso.rotation.set(0, 0, 0);
  p.chest.rotation.x = -0.12;   // leaning back off the rope a touch
  p.armL.rotation.set(2.65 + s * 0.25, 0, 0.2);
  p.elbowL.rotation.set(0.45 - s * 0.35, 0, 0);
  const up = 0.5 + 0.5 * c;     // which leg is drawn up, 1 = left
  p.legL.rotation.set(0.25 + up * 0.85, 0, 0.08);
  p.legR.rotation.set(1.1 - up * 0.85, 0, -0.08);
  p.kneeL.rotation.set(-0.35 - up * 1.0, 0, 0);
  p.kneeR.rotation.set(-1.35 + up * 1.0, 0, 0);
  p.ankleL.rotation.set(0.3, 0, 0);
  p.ankleR.rotation.set(0.3, 0, 0);
  rig.body.update();
}
export const ROPE_CLIMB_RATE = 5.5;   // phase per second while climbing

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
const COLD_TAG_COLOR = "#e6e4d8";

// How far the body is folded down in each stance, 0 = upright.
export const STANCE_LOWER = { stand: 0, crouch: 0.55, slide: 0.8, prone: 1, vault: 0.3, rope: 0 };

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
    // Their way of moving (character.js gaitStyle) from their id, so every
    // screen shows them the same.
    this.rig.styleSeed = [...String(peer.id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
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
  /* Their throw, from the `ck` field (draw/pin/hold, advanced here between
     packets) and the `nade` message (throwSeq: the whip). A hold whose `ck`
     stops coming was put away (died, cancelled) after a short grace. */
  updateThrowHold(dt) {
    const raw = this.alive ? this.peer.throwCk : null;
    if (raw !== this.thrRaw) {
      this.thrRaw = raw;
      const ck = parseThrowWire(raw);
      if (ck && (ck.phase !== "throw" || this.thr?.phase !== "throw")) this.thr = { phase: ck.phase, t: ck.t, kind: ck.kind };
    }
    if (this.thrWhip) { this.thrWhip = false; if (this.thr?.phase !== "throw") this.thr = { phase: "throw", t: 0, kind: this.thr?.kind || "frag" }; }   // the `nade` just landed (once)
    const s = this.thr;
    if (!s) return;
    s.t += dt;
    if (s.phase === "throw") { if (s.t > THROW.WIND + THROW.WHIP + 0.2) this.thr = null; return; }
    if (s.phase === "draw" && s.t >= THROW.DRAW) s.phase = "pin";
    if (s.phase === "pin" && s.t >= THROW.PIN) s.phase = "hold";
    this.thrLost = raw ? 0 : (this.thrLost || 0) + dt;
    if (this.thrLost > 0.35 || !this.alive) this.thr = null;
  }

  updateDrink(dt, emoting) {
    const d = this.alive && !emoting ? drinkFromCode(this.peer.drink) : null;
    const kind = d?.kind || null;
    if (kind !== this.drinkKind) {
      this.drinkKind = kind;
      if (this.drinkMesh) { this.drinkMesh.parent?.remove(this.drinkMesh); this.drinkMesh = null; }
      if (kind) { this.drinkMesh = buildDrink(kind); mountDrink(this.rig, this.drinkMesh); }
    }
    if (!this.drinkMesh) { this.sipK = 0; this.pourK = 0; return; }
    // Filling at a tap (`ds` 2): the level rises as they pour.
    this.pourFill = this.peer.pouring ? Math.min(1, (this.pourFill || 0) + dt / FILL_TIME) : 0;
    this.drinkMesh.userData.setSips(d.sips + (drinkMax(kind) - d.sips) * this.pourFill);
    if (this.weaponMesh) this.weaponMesh.visible = false;
    // Up to the mouth while they're sipping, back down after; held out
    // under the tap while they pour.
    this.sipK = (this.sipK || 0) + ((this.peer.sipping ? 1 : 0) - (this.sipK || 0)) * Math.min(1, dt * 7);
    this.pourK = (this.pourK || 0) + ((this.peer.pouring ? 1 : 0) - (this.pourK || 0)) * Math.min(1, dt * 7);
    poseDrinkArm(this.rig, this.sipK, this.pourK);
  }

  setTeam(teamId) {
    this.team = teamId;
  }

  /* Recolor the name tag white (friendly) or red (enemy) relative to
     whoever's looking. ffa/no local team means everyone reads as an enemy. */
  setLocalTeam(myTeam, ffa) {
    const friendly = !ffa && !!myTeam && this.team === myTeam;
    // Cold Blooded (perks.js): an enemy whose name never shows red.
    const color = friendly ? FRIENDLY_TAG_COLOR : peerHas(this.peer, "coldblooded") ? COLD_TAG_COLOR : ENEMY_TAG_COLOR;
    // Rank arrives with their state messages, so the tag redraws when it
    // lands or changes, not only on a team colour change.
    const p = this.peer;
    const rank = p.owner ? { owner: true } : p.level ? { level: p.level, prestige: p.prestige | 0 } : null;
    const rankKey = rank ? (rank.owner ? "o" : `${rank.level}.${rank.prestige}`) : "";
    // Clan tag (prestige phase 4) in front: `[TRLL] name`.
    // Socialize roleplay: their job after the name (rp-roles.js).
    const base = p.clan ? `[${p.clan}] ${p.name || "operator"}` : (p.name || "operator");
    const job = roleLabel(p.role);
    const text = job ? `${base} · ${job}` : base;
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
    // Cops and Robbers: a realistic body (cop-bodies.js) from the wire's body
    // id; a hero's own body wins. It is moved after the pose (syncBody).
    applyCopBody(this.rig, this.peer.hero ? null : this.peer.body || null);
    // A TROLLS body (blocky-body.js): on the token's holder only (its
    // username, cosmetics.js mayWear), and never under a hero or cop body.
    // A bot under no body of its own wears the NFT body's 3D trollface head
    // (user, 2026-10-23: every NPC's), as the townsfolk do; off before a body goes on.
    const reliefOn = !!(this.peer.isBot || this.peer.botSkill) && !this.peer.hero && !this.peer.body && !(this.peer.look && mayWear(this.peer.look, this.peer.name));
    if (!reliefOn) setReliefFace(this.rig, false);
    wearBlocky(this.rig, this.peer.look && mayWear(this.peer.look, this.peer.name) && !this.peer.hero && !this.peer.body ? this.peer.look : 0);
    if (reliefOn) setReliefFace(this.rig);

    if ((this.peer.meleeSeq | 0) !== this.meleeSeen) {
      this.meleeSeen = this.peer.meleeSeq | 0;
      if (this.alive) this.startMelee(this.peer.meleeKind, this.peer.meleeDef);
    }
    if (this.melee) this.melee.update(dt);
    if ((this.peer.throwSeq | 0) !== this.throwSeen) {
      this.throwSeen = this.peer.throwSeq | 0;
      this.throwT = THROW_TIME;
      this.thrWhip = true;   // updateThrowHold: the whip
    }
    if (this.throwT > 0) this.throwT = Math.max(0, this.throwT - dt);
    this.updateThrowHold(dt);
    if (!this.alive && this.melee) this.melee.t = 0;
    const swinging = this.swinging;
    // Holding the melee weapon outright (switched to it, or infected): the
    // wire sends its id as the weapon.
    const meleeHeld = !!MELEE_DEFS[this.peer.weapon] && this.ensureMelee(this.peer.weapon);
    const sword = swinging || meleeHeld;
    // Emoting (the peer's `em`, see emotes.js): weapons away.
    // cineEmote: a pose the match intro (match-intro.js) holds them in, local only.
    let em = this.alive ? (this.peer.emote | 0) || (this.cineEmote | 0) : 0;
    // a TROLLS token's own emote (#989's Bubblegum) plays only on its
    // wearer or the owner (cosmetics.js mayEmoteToken)
    const tokEm = EMOTES[(em & (ROLE_BIT - 1)) - 1]?.token;
    if (tokEm && !mayEmoteToken(tokEm, this.rig.blocky?.token || 0, this.peer.name)) em = 0;
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
      // An officer always goes down on his back (his body lies flat, the
      // rifle beside him: cop-bodies.js).
      this.rig.deathHint = { dir: !this.rig.cop && last?.moving && Math.random() < 0.55 ? -1 : 1 };
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
      // An officer drops his rifle on the floor beside him instead.
      if (this.weaponMesh && !(this.rig.cop && !this.launch)) this.weaponMesh.visible = false;
      if (this.meleeMesh) this.meleeMesh.visible = false;
      this.bodyPose = { death: this.launch ? 0 : Math.min(1, this.deathT / DEATH_TIME) };
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

    const { a, b, k } = bracket(snaps);
    this.pos.set(
      a.x + (b.x - a.x) * k,
      a.y + (b.y - a.y) * k,
      a.z + (b.z - a.z) * k,
    );
    this.yaw = lerpAngle(a.yaw, b.yaw, k);
    this.pitch = a.pitch + (b.pitch - a.pitch) * k;
    this.stance = b.stance;
    for (const f of peerPlacers) f(this);

    // Troll Royale's drop: aboard, only your planemates are drawn (in your
    // plane, posed in its frame); in the air they skydive.
    let drop = b.drop | 0;
    // Just out of the plane: the fall's opening show from the top (poseDrop).
    if (drop === DROP_FALL && (this.drop & 3) === DROP_BUS) { this.dropT = 0; this.fallBack = null; }
    this.drop = drop;
    this.setGlider(drop === DROP_GLIDE);
    let aboard = null;
    if (drop === DROP_BUS) {
      for (const f of busPlacers) if ((aboard = f(this, b))) break;
      if (!aboard) {
        this.rig.root.visible = false;
        this.tag.visible = false;
        return;
      }
      drop = 0;
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
    // Measured over ~150 ms of snapshots, not the last gap alone: the
    // times are when packets arrived, so one gap jitters the speed (and the
    // stride with it). Strafe/forward are the VELOCITY on their own axes,
    // scaled like third-person.js does for your body (the old raw
    // displacement x6 meant different legs at 15 Hz and at the host's
    // every-frame bot feed for the same speed).
    let strafe = 0;
    let forward = 1;
    let speed = 0;
    let vy = 0;
    let a0 = b;
    for (let i = snaps.indexOf(b) - 1; i >= 0; i--) { a0 = snaps[i]; if (b.t - a0.t >= 150) break; }
    if (b.t > a0.t) {
      const span = (b.t - a0.t) / 1000;
      const vx = (b.x - a0.x) / span, vz = (b.z - a0.z) / span;
      vy = (b.y - a0.y) / span;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // Local right/forward axes for a yaw-only rotation about Y (forward
      // is -Z at yaw 0, matching movement.js/character.js's convention).
      const rightX = cos, rightZ = -sin;
      const fwdX = -sin, fwdZ = -cos;
      speed = Math.hypot(vx, vz);
      if (speed > 0.05) {
        strafe = Math.max(-1, Math.min(1, (vx * rightX + vz * rightZ) * 6));
        // Signed -1 (full backpedal) .. 1 (full forward run); a pure
        // strafe with no fore/aft component lands at 0.
        forward = Math.max(-1, Math.min(1, (vx * fwdX + vz * fwdZ) * 6));
      }
    }
    // Off the ground? Not on the wire: read it off their height. A jump (or
    // a bot's hop) rises fast, a fall drops fast; a stair step is too small
    // and short for either. Once up, they're up until they've come down and
    // stopped (the apex's pause isn't a landing), and the landing's force is
    // the fastest fall seen.
    let land = 0;
    const grounded = b.stance === "stand" || b.stance === "crouch";
    if (!this.air && grounded && (vy > 3.5 || vy < -3)) { this.air = true; this.airFall = Math.min(0, vy); }
    else if (this.air) {
      this.airFall = Math.min(this.airFall, vy);
      if (!grounded || (this.airFall < -1.5 && Math.abs(vy) < 0.8)) {
        if (grounded) land = Math.max(0, Math.min(1, (-this.airFall - 2.5) / 9));
        this.air = false;
      }
    }

    // `moving` (from the wire) gates whether the legs animate at all; the
    // measured speed then sets how fast that cycle plays, so a bot easing
    // into a strafe or barely drifting doesn't play a full sprint-speed jog -
    // it used to always report moving:true and always advance at one fixed
    // rate regardless of how fast (or slow) it was actually travelling.
    // On a rope the body rises with pos; the legs hang still.
    // A bot's `moving` drops for a frame or two between steering decisions
    // while it is still under way. Each blip read as a dead stop and a
    // restart, a speed spike that nodded the head hard (user, 2026-10-12:
    // "the heads of the troll bots seem to be flopping up and down"), so a
    // stop only counts once it has held for STOP_HOLD.
    if (b.moving) this.stopT = 0; else this.stopT = (this.stopT || 0) + dt;
    // a bot sat in a chapel pew or knelt at its rail (bots.js rest)
    const resting = b.stance === "sit" || b.stance === "pray";
    const moving = (!!b.moving || this.stopT < STOP_HOLD) && b.stance !== "rope" && !resting && aboard?.seatY == null;
    // Same 4.2 m/s reference speed used to drive the phase rate above,
    // reused here as the 0..1 intensity that scales stride/arm-swing/lean
    // so a jog and a sprint are visibly different gaits, not just the same
    // cycle replayed faster.
    const gaitSpeed = Math.max(0, Math.min(1, speed / 4.2));
    // Cadence from the real speed, so the planted foot moves exactly as fast
    // as the ground under it. Smoothed every frame, stopped or not, so a
    // restart picks up from the real speed, not one left from the last run.
    this.gaitMps = (this.gaitMps ?? speed) + (speed - (this.gaitMps ?? speed)) * Math.min(1, dt * 6);
    if (moving) this.phase += dt * gaitPhaseRate(this.gaitMps, this.rig.legScale);

    this.rig.root.position.copy(this.pos);
    // Off the plane's bank: upright again before the yaw goes on.
    if (this.tilted) { this.rig.root.rotation.x = this.rig.root.rotation.z = 0; this.tilted = false; }
    // Never on the ground with a roll (poseDrop says why).
    if (this.rig.root.rotation.z !== 0) { this.rig.root.rotation.order = "YXZ"; this.rig.root.rotation.z = 0; }
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
    const unarmed = !sword && (!this.peer.weapon || !!aboard);   // aboard: guns slung
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
    // what the body's own corrections need to know (cop-bodies.js)
    this.bodyPose = {
      gait: !em, lower: this.lower, mps: moving ? this.gaitMps ?? speed : 0, moving, forward, strafe,
      ads: sword ? 0 : this.ads, reload: this.reloadK,
    };
    // A Soul Blazer in their hands snaps its jaw on each of their shots
    // (soul-blazer.js; its charms swing on their own).
    const sbm = this.weaponMesh?.userData.sb;
    if (sbm && this.peer.shotAt) sbm.lastShot = this.peer.shotAt;
    if (em && poseEmoteCode(this.rig, em, this.emoteT)) {
      this.bodyPose.gait = false;
    } else poseHumanoid(this.rig, {
      air: !!this.air, vy, land,
      phase: this.phase, moving, pitch: this.pitch, lower: this.lower, strafe, forward,
      speed: gaitSpeed, mps: this.gaitMps ?? speed, dt, hasGun,
      // A bot's top speed (4.2 m/s) is its sprint: it plays the sprint clip
      // there (characters/clips.js), as a player's 7 m/s sprint does.
      sprint: this.peer.isBot || this.peer.botSkill ? Math.max(0, Math.min(1, ((this.gaitMps ?? speed) - 3.2) / 0.8)) : null,
      hold: sword ? "melee" : unarmed ? "none" : "gun", swing, block: this.blockT, ads: sword || unarmed ? 0 : this.ads,
      fired: this.peer.shotAt ? (performance.now() - this.peer.shotAt) / 1000 : Infinity,
      reload: this.reloadK,
      parry: this.parry.sample(),
    });

    // A grenade in hand (their `ck`) and the throw: the right arm, pin and all
    // (combat/throw-anim.js). Without a `ck` (an older client) the old overhand.
    if (this.thr && this.alive && !em) {
      poseThrowBody(this.rig, this.thr.phase, this.thr.t, this.thr.kind);
      if (this.weaponMesh) this.weaponMesh.visible = false;
    } else {
      clearThrowBody(this.rig);
      if (this.throwT > 0) poseThrowArm(this.rig, 1 - this.throwT / THROW_TIME);
    }
    this.updateDrink(dt, !!em);
    // Socialize: sat down, and at the piano both hands on the keys.
    // (an emote plays sat down too: the emote has the arms, the seat the legs)
    const seat = this.peer.seat && this.alive ? seatList()?.[this.peer.seat - 1] : null;
    if (seat) {
      if (seat.kind === "piano" && !em) posePianoArms(this.rig, this.pianoT = (this.pianoT || 0) + dt, 0.5, !!this.peer.piano || performance.now() - (this.peer.keysAt || 0) < 700);
      poseSeated(this.rig, seat.y, seat.kind === "stool" ? 0.55 : 0);
    }
    if (aboard?.seatY != null) poseSeated(this.rig, aboard.seatY, 0.1);
    // a bot in a pew (the seat 0.45 above its feet) or at the rail (on the
    // kneeler's velvet): its gun put away
    if (resting && !seat && this.alive) {
      this.restT = (this.restT || 0) + dt;
      if (b.stance === "sit") { poseSeated(this.rig, this.pos.y + 0.45); poseLapHands(this.rig); }
      else posePraying(this.rig, this.pos.y + 0.09, this.restT);
      if (this.weaponMesh) this.weaponMesh.visible = false;
      this.bodyPose.gait = false;
    }
    rollRig(this.rig, roll);
    // Socialize fist fights (modes/social-duel.js): their jab, or flat out
    if (!seat && !em) poseDuelPeer(this.rig, this.peer);
    for (const f of peerPosers) f(this, dt);
    if (b.stance === "rope" && !em) {
      if (b.moving) this.ropeT = (this.ropeT || 0) + dt * ROPE_CLIMB_RATE;
      poseRope(this.rig, this.ropeT || 0);
      this.bodyPose.gait = false;
    }
    if (drop || roll > 0) this.bodyPose.gait = false;
    // Which way they went out isn't on the wire: facing the way they move
    // (the plane's way, so facing into the hold) is out backwards.
    if (drop === DROP_FALL && this.fallBack === null && this.dropT > 0.15 && speed > 3) { this.fallBack = forward > 0; this.fallYaw = this.yaw; }
    if (drop) {
      this.dropT = (this.dropT || 0) + dt;
      poseDrop(this.rig, drop, this.dropT, this.fallBack === undefined ? null : this.fallBack ?? true, this.fallBack == null ? undefined : this.fallYaw);
      if (this.weaponMesh) this.weaponMesh.visible = false;
      if (this.meleeMesh) this.meleeMesh.visible = false;
    }

    this.tag.position.y = 2.15 - this.lower * 0.75;
    if (aboard) {
      // Posed in the plane's frame; now out where the plane is, banked with it.
      const root = this.rig.root;
      root.position.applyMatrix4(aboard.m);
      root.quaternion.premultiply(_planeQ.setFromRotationMatrix(aboard.m));
      this.tilted = true;
      this.pos.copy(root.position);   // where they are, for the far-hide and the minimap
      if (this.peer.isBot || this.peer.botSkill) this.tag.visible = false;   // nine tags in a hold is noise; players keep theirs
      if (this.weaponMesh) this.weaponMesh.visible = false;
    }
  }

  /* Killcam playback (killcam.js): pose from a recorded sample instead of
     the live snapshots. Runs after update() in the same frame, so it simply
     wins; the next ordinary update() puts everything back. `hidden` is the
     killer, whose eyes the camera is in. */
  replayPose(s, dt, hidden = false) {
    const root = this.rig.root;
    clearThrowBody(this.rig);
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
    // How fast and which way they really moved, from the recording (the
    // old fixed 3.6 m/s straight ahead ran every replayed body the same,
    // strafing or walking). A jump of a few metres is a cut, not a speed.
    const kp = this.kcPrev;
    if (kp && dt > 0 && Math.hypot(s.x - kp.x, s.z - kp.z) < 3) {
      const k = Math.min(1, dt * 10);
      this.kcVx += ((s.x - kp.x) / dt - this.kcVx) * k;
      this.kcVz += ((s.z - kp.z) / dt - this.kcVz) * k;
    } else this.kcVx = this.kcVz = 0;
    this.kcPrev = { x: s.x, z: s.z };
    const kg = gaitFromVelocity(s.yaw, this.kcVx, this.kcVz, this.kcGait || (this.kcGait = {}));
    if (s.moving) this.replayPhase = (this.replayPhase || 0) + dt * gaitPhaseRate(kg.speed, this.rig.legScale);
    aimRig(this.rig, s.yaw, dt, { moving: s.moving });
    poseHumanoid(this.rig, {
      phase: this.replayPhase || 0, moving: s.moving, pitch: s.pitch, lower: s.lower, strafe: kg.strafe, forward: kg.forward,
      speed: s.moving ? Math.min(1, kg.speed / 4.2) : 0, mps: s.moving ? kg.speed : 0, dt,
      hasGun: !sword && WEAPON_DEFS[this.weaponId]?.cls !== "sidearm", hold: sword ? "melee" : "gun",
      swing: sword && s.sw >= 0 ? { t: s.sw, kind: s.si % 2 === 0 ? "swing" : "thrust" } : null,
      block: sword && s.sw < 0 ? s.bk : 0,
    });
    this.bodyPose = { gait: true, lower: s.lower || 0, mps: s.moving ? kg.speed : 0, moving: !!s.moving, forward: kg.forward, strafe: kg.strafe };
    this.syncBody(s.pitch || 0);
  }

  /* A crowd's skipped frame (RemotePlayers' LOD): the pose waits its turn,
     but the troll still slides to where the snapshots put it, so one 40 m
     off moves smoothly instead of in 15-20 Hz jumps (user, 2026-10-18:
     Troll Royale's bots looked glitchy). On the ground only: the drop's,
     the roll's and the plane's placements are their own. */
  glide() {
    const snaps = this.peer.snaps;
    if (!this.alive || !snaps.length || this.drop || this.tilted || this.dying || !this.rig.root.visible) return;
    const { a, b, k } = bracket(snaps);
    _glide.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k).sub(this.pos);
    this.pos.add(_glide);
    this.rig.root.position.add(_glide);
  }

  /* A realistic body follows the rig once it is posed for the frame
     (update, then any killcam replayPose). */
  syncBody(pitch = this.pitch || 0) {
    if (this.rig.cop) syncCopBody(this.rig, { ...this.bodyPose, pitch: this.dying ? 0 : pitch });
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

  /* Gun detail for a troll in a crowd (RemotePlayers' LOD): past
     CROWD_DETAIL its gun keeps only its big pieces. A gun is a dozen small
     meshes, most of a troll's draw calls, and at that range they're a few
     pixels (user, 2026-10-12: Troll Royale lags from the moment the bots
     spawn; 99 trolls were ~3,800 draw calls a frame). */
  setDetail(on) {
    const m = this.weaponMesh;
    if (!m || (this.detailOn === on && this.detailMesh === m)) return;
    this.detailOn = on;
    this.detailMesh = m;
    m.traverse((o) => {
      if (!o.isMesh || o === m) return;
      const g = o.geometry;
      const tris = g ? (g.index ? g.index.count : g.attributes.position?.count || 0) / 3 : 0;
      if (tris >= SMALL_PART) return;
      if (!on) { o.userData.lodWas ??= o.visible; o.visible = false; }
      else if (o.userData.lodWas !== undefined) { o.visible = o.userData.lodWas; delete o.userData.lodWas; }
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
    applyCopBody(this.rig, null);   // the rifle back from the floor
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

/* The two snapshots RENDER_DELAY ago falls between, and how far along. */
const _glide = new THREE.Vector3();
function bracket(snaps) {
  const target = performance.now() - RENDER_DELAY;
  let a = null, b = null;
  for (let i = snaps.length - 1; i >= 0; i--) {
    if (snaps[i].t <= target) { a = snaps[i]; b = snaps[i + 1] || null; break; }
  }
  if (!a) a = snaps[0];
  if (!b) b = snaps[snaps.length - 1];
  let k = 0;
  if (a !== b && b.t > a.t) k = Math.max(0, Math.min(1, (target - a.t) / (b.t - a.t)));
  return { a, b, k };
}

/* Owns the set of remote players and keeps it in sync with Net's peer map. */
const FAR_HIDE = 200;   // metres: a crowd's trolls past this aren't drawn
const FAR_BAND = 12;    // metres: ...and come back only this much nearer
const CROWD_SHADOW = 15;   // metres: a crowd's trolls past this cast no shadow
const CROWD_DETAIL = 20;   // metres: past this a crowd's guns lose their small parts
const SMALL_PART = 60;     // triangles: a gun part this small is "small"

export class RemotePlayers {
  constructor(scene, camera = null) {
    this.scene = scene;
    this.camera = camera;   // a crowd poses who's off-screen less often
    this.byId = new Map();
    this.frustum = new THREE.Frustum();
    this.viewProj = new THREE.Matrix4();
    this.sphere = new THREE.Sphere(new THREE.Vector3(), 1.4);
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
     shadow. Small rooms pose everyone every frame, as before.
     In a crowd, on screen: every frame within 15 m, every 2nd to 40 m, 3rd
     to 100 m, 4th past it; off screen every 8th (2026-10-12: posing 99
     trolls in the sky lobby, all within 40 m, was ~20 ms of CPU a frame). */
  update(dt = 0.016, myTeam = null, ffa = false, eye = null) {
    const lod = !!eye && this.byId.size > 24;
    const cam = lod ? this.camera : null;
    if (cam) {
      this.viewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.viewProj);
    }
    // game.js reads it: SSAO is off in a crowd (it redraws every troll).
    this.crowd = lod;
    this.frame = (this.frame || 0) + 1;
    let i = 0;
    for (const rp of this.byId.values()) {
      i++;
      if (!lod) { rp.setShadow(true); rp.setDetail(true); rp.update(dt, myTeam, ffa); rp.syncBody(); continue; }
      const d2 = (rp.pos.x - eye.x) ** 2 + (rp.pos.z - eye.z) ** 2;
      rp.setShadow(d2 < CROWD_SHADOW * CROWD_SHADOW);
      rp.setDetail(d2 < CROWD_DETAIL * CROWD_DETAIL);
      let every = d2 > 100 * 100 ? 4 : d2 > 40 * 40 ? 3 : d2 > 15 * 15 ? 2 : 1;
      if (cam && d2 > 3 * 3) {
        this.sphere.center.set(rp.pos.x, rp.pos.y + 1, rp.pos.z);
        if (!this.frustum.intersectsSphere(this.sphere)) every = 8;
      }
      // Your planemates (Troll Royale, aboard: `tilted`) ride at 40 m/s; a
      // skipped frame leaves them metres behind the hold. Eight of them.
      if (rp.tilted) every = 1;
      rp.lodDt = (rp.lodDt || 0) + dt;
      if ((this.frame + i) % every) { rp.glide(); continue; }
      const step = Math.min(0.1, rp.lodDt);
      rp.lodDt = 0;
      rp.update(step, myTeam, ffa);
      rp.syncBody();
      // Past FAR_HIDE a troll is a few pixels: not drawn at all (the body
      // was most of a 100-troll frame). Still placed, so it can still be hit.
      // A glider is 7 m wide, so it stays in sight twice as far. Once hidden
      // it comes back only FAR_BAND nearer, so one walking along the line
      // doesn't blink (user, 2026-10-18: bots "disappear in and out").
      const far = (rp.drop === DROP_GLIDE ? FAR_HIDE * 2 : FAR_HIDE) - (rp.farHidden ? FAR_BAND : 0);
      rp.farHidden = d2 > far * far && !rp.dying;
      if (rp.farHidden) { rp.rig.root.visible = false; rp.tag.visible = false; }
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
