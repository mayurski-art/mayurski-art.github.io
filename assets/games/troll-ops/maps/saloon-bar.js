// Troll Forces — the Rusty Grin Saloon bar (Socialize roleplay, phase 1).
//
// User, 2026-10-04: "allow for drinks to be dispensed from barrels in the
// troll city saloon … allow users to grab beer mugs and refill themselves
// etc. bartender role that anyone can fill." Socialize only.
//
// This file is the parts that aren't game flow: the mug and shot glass,
// where they sit in a hand (first person and on a body), the arm pose for
// holding and sipping, the drink's wire code, and the tipsy wobble.
// game.js (updateBar) runs the interactions; trollcity.js places the props
// and lists the spots on the map as `rp.bar`.

import * as THREE from "three";
import { reachHand, setHandPose } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1-pk1-mb1-mb2-nft2531-fs1-fs2-rb1-rgb1-bdn1-msk1";

export const BEER_SIPS = 4;
export const WHISKEY_SIPS = 1;
// Kek & Sons' goods (modes/social-shop.js) ride the drink's hand and wire too
export const CANTEEN_SIPS = 6;
export const APPLE_BITES = 3;
// Kabukigrin's bar (modes/kb-bar.js, docs/KB-BAR-SERVICE.md): sake in an
// ochoko, a highball, the glowing Grin Sour, and green tea to steady you
export const SAKE_SIPS = 1, HIGHBALL_SIPS = 3, SOUR_SIPS = 2, TEA_SIPS = 2;
export const DRINK_KINDS = new Set(["beer", "whiskey", "canteen", "apple", "sake", "highball", "sour", "tea"]);
/* Only the saloon's own make you tipsy. */
export const isLiquor = (kind) => kind === "beer" || kind === "whiskey" || kind === "sake" || kind === "highball" || kind === "sour";
/* The glass goes back to the bar when it's empty (a mug you keep and refill). */
export const glassGoesBack = (kind) => kind === "whiskey" || kind === "sake" || kind === "highball" || kind === "sour" || kind === "tea";
export const GRAB_TIME = 0.35;            // hold X at the rack for a mug
export const FILL_TIME = 2.0;             // hold X at a tap, empty to full
export const FILL_TIME_BARTENDER = 0.8;   // the bartender pours faster
export const POUR_TIME = 0.9;             // the bartender's whiskey
export const SIP_TIME = 1.25;             // one sip, up and back down
export const APRON_TIME = 0.6;            // hold X at the hook: take or hang up the apron
export const OFFER_SECONDS = 15;          // a drink held out waits this long
export const REACH = 1.3;                 // how close a spot has to be
export const BARTENDER_LEAVE_SECONDS = 8; // out of the saloon this long hangs the apron up

/* Tipsy: every beer sip and the shot add to it, it wears off by itself. */
export const TIPSY = {
  perBeerSip: 0.25,    // a whole mug is one point
  perShot: 1,
  // ...and Kabukigrin's round (docs/KB-BAR-SERVICE.md 3): green tea takes some off
  perSip: { beer: 0.25, whiskey: 1, sake: 1.2, highball: 0.4, sour: 0.9, tea: -0.4 },
  onset: 2,            // nothing shows below this
  max: 6,              // the steady sway's full strength
  cap: 8,              // you pass out (modes/drunk.js)
  decay: 1 / 60,       // points per second: a mug a minute
};
export const tipsyPerSip = (kind) => TIPSY.perSip[kind] || 0;

/* The drink on the wire (state `dk`): 0 nothing, otherwise kind * 10 +
   sips left, kind 1 beer, 2 whiskey. Beer with 0 sips left is an empty
   mug (10). */
const KIND_CODE = { beer: 10, whiskey: 20, canteen: 30, apple: 40, sake: 50, highball: 60, sour: 70, tea: 80 };
const CODE_KIND = ["beer", "whiskey", "canteen", "apple", "sake", "highball", "sour", "tea"];
export function drinkCode(d) {
  if (!d) return 0;
  return (KIND_CODE[d.kind] || 10) + Math.max(0, Math.min(9, d.sips | 0));
}
export function drinkFromCode(c) {
  c |= 0;
  if (c < 10 || c >= 90) return null;
  return { kind: CODE_KIND[Math.floor(c / 10) - 1], sips: c % 10 };
}
const MAX_SIPS = { beer: BEER_SIPS, whiskey: WHISKEY_SIPS, canteen: CANTEEN_SIPS, apple: APPLE_BITES, sake: SAKE_SIPS, highball: HIGHBALL_SIPS, sour: SOUR_SIPS, tea: TEA_SIPS };
export function drinkMax(kind) { return MAX_SIPS[kind] || BEER_SIPS; }

/* ------------------------------------------------------------- the models */

const GLASS = new THREE.MeshStandardMaterial({ color: 0xdfe8e4, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.38, depthWrite: false });
const BEER = new THREE.MeshStandardMaterial({ color: 0xd88a1c, roughness: 0.35, emissive: 0x3a1c02, emissiveIntensity: 0.4 });
const FOAM = new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.9 });
const WHISKEY = new THREE.MeshStandardMaterial({ color: 0x9a4a12, roughness: 0.25, emissive: 0x2a0c00, emissiveIntensity: 0.4 });

/* A beer mug or a shot glass, base at the origin, standing up +Y. The
   handle sticks out along +X. `setSips(n)` sets how full it looks. */
export function buildDrink(kind = "beer") {
  if (kind === "canteen") return buildCanteen();
  if (kind === "apple") return buildApple();
  if (kind === "sake" || kind === "tea") return buildCup(kind);
  if (kind === "highball") return buildHighball();
  if (kind === "sour") return buildCoupe();
  const g = new THREE.Group();
  const whiskey = kind === "whiskey";
  const r = whiskey ? 0.024 : 0.042, h = whiskey ? 0.055 : 0.115;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.94, h, 14, 1, true), GLASS);
  wall.position.y = h / 2;
  wall.renderOrder = 2;
  g.add(wall);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.94, h * 0.12, 14), GLASS);
  base.position.y = h * 0.06;
  g.add(base);
  if (!whiskey) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(h * 0.3, 0.008, 6, 12, Math.PI), GLASS);
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(r, h * 0.52, 0);
    g.add(handle);
  }
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.86, 1, 14), whiskey ? WHISKEY : BEER);
  g.add(liquid);
  const foam = whiskey ? null : new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.012, 14), FOAM);
  if (foam) g.add(foam);
  const max = drinkMax(kind), floor = h * 0.12;
  g.userData.kind = kind;
  g.userData.height = h;
  g.userData.radius = r;
  g.userData.setSips = (sips) => {
    const k = Math.max(0, Math.min(1, sips / max));
    liquid.visible = k > 0;
    const top = floor + (h * 0.88 - floor) * k;
    liquid.scale.y = Math.max(0.001, top - floor);
    liquid.position.y = floor + (top - floor) / 2;
    if (foam) { foam.visible = k > 0; foam.position.y = top + 0.006; }
  };
  g.userData.setSips(max);
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

/* Kek & Sons' tin canteen: a flat round flask on its edge, a cap, a strap
   loop. Held like a mug (its "radius" is its half-thickness to the palm). */
const TIN = new THREE.MeshStandardMaterial({ color: 0x9aa3a6, roughness: 0.45, metalness: 0.6 });
const CANVAS = new THREE.MeshStandardMaterial({ color: 0x8a7350, roughness: 0.95 });
function buildCanteen() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.038, 18), TIN);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.07;
  g.add(body);
  const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.067, 0.067, 0.03, 18), CANVAS);   // the felt cover round it
  cover.rotation.z = Math.PI / 2;
  cover.position.y = 0.07;
  cover.scale.set(1, 0.6, 1);
  g.add(cover);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.03, 10), TIN);
  neck.position.y = 0.145;
  g.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 10), CANVAS);
  cap.position.y = 0.165;
  g.add(cap);
  g.userData.kind = "canteen";
  g.userData.height = 0.17;
  g.userData.radius = 0.03;
  g.userData.setSips = () => {};
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}
/* An apple off the barrel: it gets smaller a bite at a time. */
const APPLE = new THREE.MeshStandardMaterial({ color: 0xc0262a, roughness: 0.45 });
const STEM = new THREE.MeshStandardMaterial({ color: 0x4a2e12, roughness: 0.9 });
function buildApple() {
  const g = new THREE.Group();
  const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), APPLE);
  fruit.position.y = 0.042;
  fruit.scale.y = 0.9;
  g.add(fruit);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.022, 5), STEM);
  stem.position.y = 0.088;
  g.add(stem);
  g.userData.kind = "apple";
  g.userData.height = 0.09;
  g.userData.radius = 0.042;
  g.userData.setSips = (bites) => {
    const k = 0.45 + 0.55 * Math.max(0, Math.min(1, bites / APPLE_BITES));
    fruit.scale.set(k, 0.9 * (0.6 + 0.4 * k), k);
  };
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

/* ------------------------------------------- Kabukigrin's bar (kb-bar.js) */

/* A liquid column that reads its fill from `setSips`: base at `floor`, the
   top at `h * 0.88` when full. */
function liquidFill(g, liquid, max, h, floor, onTop = null) {
  g.userData.setSips = (sips) => {
    const k = Math.max(0, Math.min(1, sips / max));
    liquid.visible = k > 0;
    const top = floor + (h * 0.88 - floor) * k;
    liquid.scale.y = Math.max(0.001, top - floor);
    liquid.position.y = floor + (top - floor) / 2;
    onTop?.(top, k);
  };
  g.userData.setSips(max);
}
const finishDrink = (g, kind, h, r) => { g.userData.kind = kind; g.userData.height = h; g.userData.radius = r; g.traverse((o) => { if (o.isMesh) o.castShadow = false; }); return g; };
const PORCELAIN = new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.3 });
const INDIGO = new THREE.MeshStandardMaterial({ color: 0x2b3f7a, roughness: 0.35 });
const CELADON = new THREE.MeshStandardMaterial({ color: 0x4d6b55, roughness: 0.4 });
const SAKE = new THREE.MeshStandardMaterial({ color: 0xe9e4cf, roughness: 0.1, transparent: true, opacity: 0.8 });
const TEA = new THREE.MeshStandardMaterial({ color: 0x9fb04a, roughness: 0.2, emissive: 0x1e2a06, emissiveIntensity: 0.3 });
const HIGHBALL = new THREE.MeshStandardMaterial({ color: 0xe6c36a, roughness: 0.1, transparent: true, opacity: 0.72, emissive: 0x3a2a05, emissiveIntensity: 0.25 });
const ICE = new THREE.MeshStandardMaterial({ color: 0xeef7ff, roughness: 0.05, transparent: true, opacity: 0.6 });
const LEMON = new THREE.MeshStandardMaterial({ color: 0xf5d83a, roughness: 0.6 });
const SOUR = new THREE.MeshStandardMaterial({ color: 0x5aff3c, roughness: 0.1, emissive: 0x2cff10, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });

/* An ochoko (sake: small, a blue ring under the lip) or a yunomi (tea:
   taller, celadon). Ceramic, so the liquid shows only from above. */
function buildCup(kind) {
  const g = new THREE.Group();
  const tea = kind === "tea";
  const r = tea ? 0.03 : 0.026, h = tea ? 0.07 : 0.045;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r * (tea ? 0.86 : 0.7), h, 16, 1, true), tea ? CELADON : PORCELAIN);
  wall.material.side = THREE.DoubleSide;
  wall.position.y = h / 2;
  g.add(wall);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(r * (tea ? 0.86 : 0.7), r * (tea ? 0.86 : 0.7), h * 0.1, 16), tea ? CELADON : PORCELAIN);
  foot.position.y = h * 0.05;
  g.add(foot);
  if (!tea) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.005, 0.0022, 6, 20), INDIGO);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = h * 0.82;
    g.add(ring);
  }
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.8, 1, 16), tea ? TEA : SAKE);
  g.add(liquid);
  liquidFill(g, liquid, drinkMax(kind), h, h * 0.1);
  return finishDrink(g, kind, h, r);
}

/* A highball: a tall straight glass, two ice cubes, a lemon wheel on the rim. */
function buildHighball() {
  const g = new THREE.Group();
  const r = 0.03, h = 0.14;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, h, 16, 1, true), GLASS);
  wall.position.y = h / 2;
  wall.renderOrder = 2;
  g.add(wall);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r * 0.96, h * 0.08, 16), GLASS);
  base.position.y = h * 0.04;
  g.add(base);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.9, 1, 16), HIGHBALL);
  g.add(liquid);
  const cubes = [[-0.008, 0.012], [0.009, -0.006]].map(([x, z]) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), ICE);
    c.position.set(x, 0, z);
    c.rotation.set(0.3, x * 40, 0.2);
    g.add(c);
    return c;
  });
  const lemon = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 14), LEMON);
  lemon.rotation.z = 0.35;
  lemon.position.set(r * 0.9, h + 0.008, 0);
  g.add(lemon);
  // the ice rides the level down; the lemon goes with the last sip
  liquidFill(g, liquid, HIGHBALL_SIPS, h, h * 0.08, (top, k) => { cubes.forEach((c, i) => { c.position.y = Math.max(h * 0.08 + 0.012, top - 0.008 - i * 0.004); }); lemon.visible = k > 0; });
  return finishDrink(g, "highball", h, r);
}

/* The Grin Sour: a coupe on a stem, neon green and glowing. */
function buildCoupe() {
  const g = new THREE.Group();
  const h = 0.11, r = 0.042;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.004, 16), GLASS);
  foot.position.y = 0.002;
  g.add(foot);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.055, 8), GLASS);
  stem.position.y = 0.03;
  g.add(stem);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(r, 0.012, 0.045, 18, 1, true), GLASS);
  bowl.position.y = 0.08;
  bowl.renderOrder = 2;
  g.add(bowl);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 12), GLASS);
  bottom.position.y = 0.058;
  g.add(bottom);
  // the bowl flares, so the liquid is a cone from its floor
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, 0.013, 1, 18), SOUR);
  g.add(liquid);
  const floor = 0.06, full = h * 0.88;
  g.userData.setSips = (sips) => {
    const k = Math.max(0, Math.min(1, sips / SOUR_SIPS));
    liquid.visible = k > 0;
    const top = floor + (full - floor) * k;
    liquid.scale.set(k, Math.max(0.001, top - floor), k);
    liquid.position.y = floor + (top - floor) / 2;
  };
  g.userData.setSips(SOUR_SIPS);
  return finishDrink(g, "sour", h, r);
}

/* Where a drink sits relative to a hand from hand-model.js (palm faces -Y,
   fingers point -Z, in the hand's own frame), for the right hand (side 1)
   or the left (-1). The hand is turned palm-inward by the arm frames, so
   its local ∓X is world up: the drink stands along that, the handle into
   the palm. */
const _off = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function placeDrinkInHand(drink, hand, side = 1) {
  const h = drink.userData.height || 0.1;
  // base a little below the fingers, the glass in front of the palm
  _off.set(side * h * 0.55, -0.06, -0.045).applyQuaternion(hand.quaternion);
  drink.position.copy(hand.position).add(_off);
  _q.setFromEuler(_e.set(0, side > 0 ? 0 : Math.PI, side * Math.PI / 2));
  drink.quaternion.copy(hand.quaternion).multiply(_q);
}

/* -------------------------------------------------- a body holding a drink */

/* After poseHumanoid: the right hand comes up to hold the drink in front
   of the chest, and to the mouth for a sip (`sip` 0..1..0). `pour` 0..1:
   the arm held out under a tap instead. `high`: perched at a counter (a bar
   stool), the hold sits a hand higher so the glass clears the bar top.

   User, 2026-10-08: the NPCs "are holding their cups incorrectly". Fixed
   arm angles kept the arm's rest splay, so the mug was held out to the side
   at arm's length, and it hung off the wrist joint, so the open mitt went
   through the glass. Now the hand is reached to a spot in front of the chest
   with the same two-bone IK as the Pour up cup (lean-cup.js), closed in a
   fist through the handle, the glass on the inside of the fist. */
export function poseDrinkArm(rig, sip = 0, pour = 0, high = false) {
  const p = rig.parts;
  const s = Math.max(0, Math.min(1, sip));
  const o = Math.max(0, Math.min(1, pour)) * (1 - s);
  const k = rig.scale || 1, w = rig.build || 1;
  // chest-space targets (character.js reachHand): +X the right side, -Z forward
  _tgt.set(0.1 * k * w, (high ? -0.17 : -0.25) * k, -0.3 * k);
  _tgt.lerp(_a.set(0.1 * k * w, -0.3 * k, -0.5 * k), o);            // out under the tap
  // up to the mouth: the trollface board's grin is ~0.26 m over the chest
  // joint (character.js head), so the fist goes a little below and in front
  // of it and the tipped rim lands on the grin. The glass is on the inside
  // of the fist and the tipped rim comes back toward the face, so the fist
  // sits off to the right and forward by however big the glass is.
  const dr = rig.heldDrink, dsc = dr ? dr.scale.y : 1.25 * k;
  const inward = ((dr?.userData.radius || 0.042) + 0.022) * dsc;
  const back = 0.44 * (dr?.userData.height || 0.115) * dsc;
  _tgt.lerp(_a.set(0.08 * k * w + inward, 0.2 * k, -0.06 * k + (0.063 - back)), s);
  reachHand(rig, 1, _tgt, _pole);
  setHandPose(rig, 1, "fist");
  if (p.gripR) p.gripR.rotation.set(0, 0, 0);
  // Redraw the ink body with the arm up: poseHumanoid drew it hanging.
  rig.body?.update?.();
  const d = rig.heldDrink;
  if (!d || d.parent !== rig.root || !p.handR) return;
  rig.root.updateMatrixWorld(true);
  palmCentre(rig, k, _palm);
  // The handle is in the fist (it sticks out +X, to the right), so the
  // glass stands on the inside of the hand; a sip tips its top back to the
  // face (+Z) about the fist.
  const sc = d.scale.y, h = d.userData.height || 0.1, r = d.userData.radius || 0.04;
  d.rotation.set(s * 1.15, 0, 0);
  _a.set(r + 0.022, h * 0.52, 0).multiplyScalar(sc).applyEuler(d.rotation);
  d.position.copy(_palm).sub(_a);
}
const _tgt = new THREE.Vector3(), _a = new THREE.Vector3(), _palm = new THREE.Vector3(), _hE = new THREE.Vector3();
const _pole = new THREE.Vector3(1, -1, 0.3), _po = new THREE.Vector3();
/* The middle of the right mitt's palm in the rig's root frame: out past the
   wrist along the forearm, a little to the inside (lean-cup.js palmCentre). */
function palmCentre(rig, k, out) {
  const p = rig.parts;
  p.elbowR.getWorldPosition(_hE);
  p.handR.getWorldPosition(out);
  rig.root.worldToLocal(_hE);
  rig.root.worldToLocal(out);
  _hE.subVectors(out, _hE).normalize();
  return out.addScaledVector(_hE, 0.075 * k).add(_po.set(-0.035 * k, 0, -0.02 * k));
}

/* ------------------------------------------------------------- pouring */

/* User, 2026-10-07: "there should be a cool animation that occurs as you
   are holding whatever button they need to hold to fill up their mugs."
   While someone holds X at a tap: a stream of beer from the spout down to
   their mug, splashes and foam where it lands, a gurgle, and the mug fills
   as the hold goes (social-rp.js drives it, for us and for the room). */
const STREAM = new THREE.MeshBasicMaterial({ color: 0xf0a030, transparent: true, opacity: 0.8, depthWrite: false });
const SPLASH = new THREE.MeshBasicMaterial({ color: 0xfff3d8, transparent: true, opacity: 0.9, depthWrite: false });
const STREAM_GEO = new THREE.CylinderGeometry(0.008, 0.011, 1, 6, 1, true).translate(0, -0.5, 0);
const DROP_GEO = new THREE.SphereGeometry(0.009, 5, 4);
const DROPS = 10;

export class PourFx {
  constructor(scene) {
    this.group = new THREE.Group();
    this.stream = new THREE.Mesh(STREAM_GEO, STREAM);
    this.stream.renderOrder = 3;
    this.group.add(this.stream);
    this.drops = [];
    for (let i = 0; i < DROPS; i++) {
      const m = new THREE.Mesh(DROP_GEO, SPLASH);
      m.visible = false;
      this.group.add(m);
      this.drops.push({ m, v: new THREE.Vector3(), life: 0 });
    }
    this.group.visible = false;
    this.t = 0;
    this.soundT = 0;
    scene.add(this.group);
  }

  /* `from` the spout, `toY` where it lands (the mug's rim), `on` pouring. */
  update(dt, from, toY, on, audio) {
    this.t += dt;
    const live = this.drops.some((d) => d.life > 0);
    this.group.visible = on || live;
    if (!this.group.visible) return;
    const fall = Math.max(0.05, from.y - toY);
    this.stream.visible = on;
    if (on) {
      // A wobbling stream, thicker where it leaves the spout.
      this.stream.position.set(from.x + Math.sin(this.t * 31) * 0.002, from.y, from.z + Math.cos(this.t * 27) * 0.002);
      this.stream.scale.set(1 + Math.sin(this.t * 40) * 0.15, fall, 1 + Math.cos(this.t * 37) * 0.15);
      // Splashes off the rim, a few at a time.
      for (const d of this.drops) {
        if (d.life > 0 || Math.random() > dt * 22) continue;
        const a = Math.random() * Math.PI * 2, s = 0.25 + Math.random() * 0.45;
        d.m.position.set(from.x, toY, from.z);
        d.v.set(Math.cos(a) * s, 0.5 + Math.random() * 0.6, Math.sin(a) * s);
        d.life = 0.25 + Math.random() * 0.15;
        d.m.visible = true;
        break;
      }
      // The gurgle: little bursts of filtered noise, pitched up as it fills.
      this.soundT -= dt;
      if (this.soundT <= 0 && audio?._ready?.()) {
        this.soundT = 0.11 + Math.random() * 0.08;
        audio._noise({ duration: 0.16, gain: 0.07, type: "bandpass", freq: 380 + Math.random() * 420 + (1 - fall) * 300, q: 4, at: { x: from.x, y: toY, z: from.z } });
      }
    }
    for (const d of this.drops) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.v.y -= 9.8 * dt;
      d.m.position.addScaledVector(d.v, dt);
      if (d.life <= 0) d.m.visible = false;
    }
  }

  dispose() {
    this.group.parent?.remove(this.group);
  }
}

/* A drink in a body's right hand: posed into the fist by poseDrinkArm. */
export function mountDrink(rig, drink) {
  drink.scale.setScalar(1.25 * (rig.scale || 1));   // a big troll's mug is a big mug
  rig.heldDrink = drink;
  rig.root.add(drink);
}

/* ---------------------------------------------------------------- tipsy */

/* Camera roll, a slow look drift and a stagger in the walk, from how tipsy
   you are and the clock. Nothing below TIPSY.onset. */
export function tipsyFx(level, t) {
  const k = Math.max(0, Math.min(1, (level - TIPSY.onset) / (TIPSY.max - TIPSY.onset)));
  if (k <= 0) return { k: 0, roll: 0, yaw: 0, pitch: 0, stagger: 0 };
  return {
    k,
    roll: Math.sin(t * 0.73) * 0.05 * k + Math.sin(t * 1.9) * 0.012 * k,
    yaw: Math.sin(t * 0.41) * 0.0025 * k,      // per frame, a drift
    pitch: Math.sin(t * 0.57 + 1) * 0.04 * k,
    stagger: Math.sin(t * 1.3) * 0.35 * k + Math.sin(t * 3.1) * 0.1 * k,
  };
}
