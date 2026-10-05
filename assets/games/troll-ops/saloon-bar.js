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

export const BEER_SIPS = 4;
export const WHISKEY_SIPS = 1;
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
  onset: 2,            // nothing shows below this
  max: 6,
  decay: 1 / 60,       // points per second: a mug a minute
};

/* The drink on the wire (state `dk`): 0 nothing, otherwise kind * 10 +
   sips left, kind 1 beer, 2 whiskey. Beer with 0 sips left is an empty
   mug (10). */
export function drinkCode(d) {
  if (!d) return 0;
  return (d.kind === "whiskey" ? 20 : 10) + Math.max(0, Math.min(9, d.sips | 0));
}
export function drinkFromCode(c) {
  c |= 0;
  if (c < 10 || c >= 30) return null;
  return { kind: c >= 20 ? "whiskey" : "beer", sips: c % 10 };
}
export function drinkMax(kind) { return kind === "whiskey" ? WHISKEY_SIPS : BEER_SIPS; }

/* ------------------------------------------------------------- the models */

const GLASS = new THREE.MeshStandardMaterial({ color: 0xdfe8e4, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.38, depthWrite: false });
const BEER = new THREE.MeshStandardMaterial({ color: 0xd88a1c, roughness: 0.35, emissive: 0x3a1c02, emissiveIntensity: 0.4 });
const FOAM = new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.9 });
const WHISKEY = new THREE.MeshStandardMaterial({ color: 0x9a4a12, roughness: 0.25, emissive: 0x2a0c00, emissiveIntensity: 0.4 });

/* A beer mug or a shot glass, base at the origin, standing up +Y. The
   handle sticks out along +X. `setSips(n)` sets how full it looks. */
export function buildDrink(kind = "beer") {
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

/* After poseHumanoid: the right forearm comes up to hold the drink in front
   of the chest, and to the mouth for a sip (`sip` 0..1..0). */
export function poseDrinkArm(rig, sip = 0) {
  const p = rig.parts;
  const s = Math.max(0, Math.min(1, sip));
  p.armR.rotation.set(0.35 + s * 1.15, 0, -0.12 - s * 0.25);
  p.elbowR.rotation.set(1.35 + s * 0.75, 0, 0);
  if (p.gripR) p.gripR.rotation.set(-s * 0.6, 0, 0);
}

/* A drink in a body's right hand (rig.parts.gripR), upright. */
export function mountDrink(rig, drink) {
  drink.scale.setScalar(1.25);
  drink.rotation.set(0, Math.PI / 2, 0);
  drink.position.set(0, -0.06, 0.02);
  rig.parts.gripR.add(drink);
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
