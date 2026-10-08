// First-person emotes and Socialize's free hands: the streak arms act them
// out in front of the camera.

import { gaitPhaseRate } from "../character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2";
import { bar, barSipK, atPiano, piano, syncFpDrink } from "../modes/social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2c3";
import * as THREE from "three";
import { hideFpEmoteProps, fpEmoteRodTip } from "../emotes.js?v=hb4-em1-wst-soc1-ng1c2";
import { inspectArms, pfArms, stretchBetween } from "./weapon-view.js?v=wv1-si1-gj1-if1-fu1b7b7dc2";
import { EMOTES } from "../emote-wheel.js?v=hb4-em1-wst-soc1c2";
import { game } from "../core/state.js?v=st1";
import { duelArms } from "../modes/social-duel.js?v=sd1b7b7dec1c2c3";
import { clubArms } from "../modes/club-entry.js?v=ce1c1c2c3";

/* A first-person emote (emotes.js `fp`): the gun goes away (or does the
   trick), and the streak arms' real hands act it out in front of the camera.
   Runs after updateWeaponView, so it has the last word on the viewmodel. */
export let fpEmoteArmsOn = false;


/* Socialize, first person: no gun, so your own hands swing at the bottom of
   the view with your stride (user: "empty hands should be replaced by
   running/walking animation arms moving"): low and loose at a walk, pumping
   up into view at a sprint, dropping out of sight when you stand still.
   Same hand targets as the first-person emotes (viewmodel space). */
export const socialArms = { phase: 0, k: 0, run: 0, at: 0 };
function socialArmsFrame() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - (socialArms.at || now)) / 1000);
  socialArms.at = now;
  const speed = Math.hypot(game.move.velocity.x, game.move.velocity.z);
  const moving = game.move.moving && game.move.grounded && speed > 0.3;
  socialArms.k += ((moving ? 1 : 0) - socialArms.k) * Math.min(1, dt * 6);
  socialArms.run += ((game.move.sprinting ? 1 : 0) - socialArms.run) * Math.min(1, dt * 5);
  if (moving) socialArms.phase += dt * gaitPhaseRate(speed);
  const k = socialArms.k, run = socialArms.run;
  const fight = duelArms();   // a fist fight: fists up (social-duel.js)
  if (fight) return fight;
  const band = clubArms();   // Trolling Loud's door: the arm out for the band
  if (band) return band;
  const hand = (side) => {
    // Right and left swing opposite each other, like the legs.
    const sw = Math.sin(socialArms.phase + (side > 0 ? 0 : Math.PI));
    const lift = Math.max(0, sw);   // the forward swing comes up into view
    // The view's bottom edge is about y -0.25 this far out (the viewmodel
    // lens is ~58°): standing still they sit below it, walking they rise
    // into it on each forward swing, sprinting they pump well up.
    return {
      pos: [
        side * (0.22 - run * 0.04),
        -0.46 + k * (0.19 + run * 0.04) + lift * k * (0.08 + run * 0.09),
        -0.45 - sw * k * (0.05 + run * 0.06),
      ],
      rot: [0.25 + run * 0.3 + lift * k * (0.25 + run * 0.35), side * 0.12, -side * Math.PI / 2],
      pose: run > 0.5 ? "fist" : "relaxed",
    };
  };
  // A drink (the saloon bar) rides in the right hand: held up in view and
  // steady, bobbing with the walk; a sip brings it to the mouth, tipped.
  let R = hand(1);
  if (bar.drink) {
    const s = barSipK();
    const bob = Math.sin(socialArms.phase * 2) * 0.008 * k;
    // At the top of a sip the rim is at your lip, so what you see is the
    // glass tipping up past you, not a face-full of foam.
    R = {
      pos: [0.17 - s * 0.11, -0.18 + bob + s * 0.12, -0.4 + s * 0.16],
      rot: [s * 0.95, 0.1 - s * 0.1, -Math.PI / 2],
      pose: "grip",
    };
  }
  // At the piano: both hands out on the keys, busy while a tune's going.
  if (atPiano()) {
    const a = piano.playing ? 1 : 0.15, t = piano.t;
    const keysHand = (side, rate) => ({
      pos: [side * 0.17 + Math.sin(t * 1.9 + side) * 0.03 * a, -0.3 + Math.max(0, Math.sin(t * rate)) * 0.02 * a, -0.44],
      rot: [0.95, side * 0.1, -side * Math.PI / 2], pose: "relaxed",
    });
    return { R: keysHand(1, 11), L: keysHand(-1, 9), gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
  }
  return { R, L: hand(-1), gun: false, cam: { pitch: barSipK() * 0.06, yaw: 0 }, social: true };
}

const _emoteRodTip = new THREE.Vector3();
export function updateFpEmoteView() {
  const f = game.fpEmoteFrame() || (game.socialUnarmed() && game.player.alive ? socialArmsFrame() : null);
  if (!f) {
    if (fpEmoteArmsOn) { game.hideStreakArms(); fpEmoteArmsOn = false; }
    syncFpDrink(false);
    hideFpEmoteProps();
    return;
  }
  inspectArms.visible = false;
  if (game.activeMeleeMesh) game.activeMeleeMesh.visible = false;
  // The gun is put away: so are the rods that hold it, or they hang in view
  // as a second pair beside the emote's.
  // Socialize has no gun to do a trick with: the hands act it out alone.
  const gun = !game.socialUnarmed() && f.gun;
  if (!gun) pfArms.visible = false;
  if (game.activeWeaponMesh) {
    game.activeWeaponMesh.visible = !!gun && game.player.holding === "gun";
    if (gun) {
      game.activeWeaponMesh.position.y += f.gun.lift || 0;
      game.activeWeaponMesh.rotateZ(f.gun.spin || 0);
    }
  }
  fpEmoteArmsOn = true;
  poseFreeArms(f);
  // An emote's own props in your hands (Pour up's cup and bottle).
  const props = game.emoteKind() === "fp" ? EMOTES[game.emote.idx].fpProps : null;
  if (props) {
    props(game.streakArms, game.streakArms.userData.arms[0].hand, game.streakArms.userData.arms[1].hand, game.emote.t);
    // The rods have no hand to wrap round it: each ends with its tip just
    // touching the prop, coming in from outside (user: "the end of
    // the arm should slightly touch the cup but the arm shouldnt be seen
    // being inside of the cup").
    game.streakArms.userData.arms.forEach((arm, i) => {
      if (arm.rod.visible && fpEmoteRodTip(i === 0 ? 1 : -1, game.STREAK_SHOULDER[i], arm.hand.position, _emoteRodTip)) stretchBetween(arm.rod, game.STREAK_SHOULDER[i], _emoteRodTip);
    });
  } else hideFpEmoteProps();
  // The saloon bar's drink, in the right hand (not during an emote).
  syncFpDrink(!!f.social);
}

/* Both streak arms placed straight from hand targets in viewmodel space
   ({R, L}: {pos, rot, pose} or null), not off a device's grip anchors: the
   first-person emotes and the K9 whistle. */
export function poseFreeArms(f) {
  game.streakArms.visible = true;
  const arms = game.streakArms.userData.arms;
  ["R", "L"].forEach((k, i) => {
    const arm = arms[i], h = f[k];
    // The black rods act the emote out, no fingers at all (user: "it makes it
    // even funnier"). The white hand stays placed, unseen, as the point the
    // rod reaches for and the frame anything held in it hangs off.
    arm.hand.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = false;
    arm.rod.visible = !!h;
    if (!h) return;
    arm.hand.position.set(h.pos[0], h.pos[1], h.pos[2]);
    arm.hand.rotation.set(h.rot[0], h.rot[1], h.rot[2], "YXZ");
    stretchBetween(arm.rod, game.STREAK_SHOULDER[i], arm.hand.position);
  });
}
