/* Socialize: ride the Grin Express (train.js) round Troll City.

   Each frame, before we move: the train goes where the timetable has it
   (Socialize only; in a match it stands at the platform), and if we're on
   one of its decks we go with it, turned as it turns. While it's moving
   we stay aboard (a jump lands back on the deck, the side gaps are shut);
   at the station we step off where we like. While aboard, the map's edge
   doesn't hold us back (movement.js `riding`): the loop runs out across the
   plain. Conductor Choo's "all aboard" before it leaves, a whistle as it
   pulls out, the bell as it pulls in.

   The timetable runs off the room's clock (modes/room-clock.js), not this
   device's, plus the conductor's holds (`clock.tro`), so every screen has
   the train in the same place. A rider sends where they stand on their car
   (`tc`: car:x:z, car-local); everyone draws them there on the car as it
   is now, not where the 110 ms-old snapshots left them (8 m/s would put
   them most of a metre off the back). */

import { Train } from "../train.js?v=tr1b7";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1";
import { peerPlacers } from "../remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1";
import { clock, roomNow } from "./room-clock.js?v=rc1-cd1-sh1";
import { game } from "../core/state.js?v=st1";

export const ride = { car: null, deck: null, called: false, moving: false };

export const trainOf = () => game.builtMap?.map?.rp?.train?.() || null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* The train's clock, in seconds: the room's, less the conductor's holds. */
export const trainClock = () => roomNow() / 1000 + clock.tro;

/* Where we stand on our car, for the wire (`tc`), or null off it. */
export function trainWire() {
  const tr = trainOf();
  if (!ride.car || !tr) return null;
  const i = tr.cars.indexOf(ride.car);
  if (i < 0) return null;
  const l = Train.toLocal(ride.car.pose, game.move.pos.x, game.move.pos.z);
  return `${i}:${l.x.toFixed(2)}:${l.z.toFixed(2)}`;
}

/* A peer riding: on their car's deck, where the car is now. */
peerPlacers.push((rp) => {
  const s = rp.peer?.trainAt;
  if (!s || !game.isSocial()) return;
  const tr = trainOf();
  const [i, lx, lz] = s.split(":").map(Number);
  const car = tr?.cars[i | 0];
  if (!car || !Number.isFinite(lx) || !Number.isFinite(lz)) return;
  const w = Train.toWorld(car.pose, lx, lz);
  rp.pos.x = w.x;
  rp.pos.z = w.z;
});

export function updateTrain() {
  const tr = trainOf();
  const mv = game.move;
  if (!tr || !game.isSocial()) {
    if (tr && (tr.state.s || tr.state.v)) tr.park();
    ride.car = null;
    if (mv) mv.riding = false;
    if (game.net) game.net.trainAt = null;
    return;
  }
  tr.update(trainClock());
  const st = tr.state, moving = st.v > 0.05, pos = mv.pos;

  // On a deck (by where our feet were on it last frame), or, while it
  // moves, still on the car we boarded.
  let hit = tr.carAt(pos.x, pos.y, pos.z, 0.05, true);
  if (!hit && ride.car && moving) hit = { car: ride.car, deck: ride.deck, local: Train.toLocal(ride.car.prev, pos.x, pos.z) };
  if (hit && (mv.grounded || ride.car) && game.player.alive) {
    const { car, deck } = hit;
    let { x: lx, z: lz } = hit.local;
    if (moving) { lx = clamp(lx, deck.x0 + 0.3, deck.x1 - 0.3); lz = clamp(lz, deck.z0 + 0.3, deck.z1 - 0.3); }
    const w = Train.toWorld(car.pose, lx, lz);
    pos.x = w.x; pos.z = w.z;
    let turn = car.pose.ry - car.prev.ry;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    game.look.yaw += turn;
    ride.car = car; ride.deck = deck;
  } else ride.car = null;
  mv.riding = !!ride.car;
  tr.aboard = !!ride.car;   // the test reads it
  if (game.net) game.net.trainAt = trainWire();   // the wire's `tc`

  // The calls: all aboard before it leaves, a whistle as it goes, the bell
  // as it comes in. Heard round the station; the banner only up close.
  const head = tr.cars[0].pose, at = { x: head.x, y: 2.5, z: head.z };
  const near = Math.hypot(head.x - pos.x, head.z - pos.z) < 30;
  if (!moving && st.leaveIn < 8 && !ride.called) {
    ride.called = true;
    if (near || ride.car) showWaveBanner(`All aboard! The Grin Express leaves in ${Math.ceil(st.leaveIn)}s`, 2400);
  }
  if (moving && !ride.moving) whistle(at);
  if (!moving && ride.moving) { bell(at); ride.called = false; if (ride.car) showWaveBanner("Troll City! All change", 1800); }
  ride.moving = moving;
}

export function whistle(at) {
  const a = game.audio;
  if (!a?._ready?.()) return;
  for (const [f, g] of [[466, 0.07], [587, 0.05], [698, 0.035]]) a._tone({ freq: f, to: f * 0.98, duration: 1.5, gain: g, type: "sawtooth", at });
  a._noise({ duration: 1.4, gain: 0.05, type: "bandpass", freq: 1800, q: 2, at });
}

export function bell(at) {
  const a = game.audio;
  if (!a?._ready?.()) return;
  for (let i = 0; i < 3; i++) a._tone({ freq: 1320, duration: 0.7, gain: 0.06, type: "triangle", delay: i * 0.45, at });
}
