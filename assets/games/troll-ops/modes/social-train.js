/* Socialize: ride the Grin Express (train.js) round Troll City.

   Each frame, before we move: the train goes where the timetable has it
   (Socialize only; in a match it stands at the platform), and if we're on
   one of its decks we go with it, turned as it turns. While it's moving
   we stay aboard (a jump lands back on the deck, the side gaps are shut);
   at the station we step off where we like. While aboard, the map's edge
   doesn't hold us back (movement.js `riding`): the loop runs out across the
   plain. Conductor Choo's "all aboard" before it leaves, a whistle as it
   pulls out, the bell as it pulls in. */

import { Train } from "../train.js?v=tr1b7";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4";
import { game } from "../core/state.js?v=st1";

export const ride = { car: null, deck: null, called: false, moving: false };

const trainOf = () => game.builtMap?.map?.rp?.train?.() || null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function updateTrain() {
  const tr = trainOf();
  const mv = game.move;
  if (!tr || !game.isSocial()) {
    if (tr && (tr.state.s || tr.state.v)) tr.park();
    ride.car = null;
    if (mv) mv.riding = false;
    return;
  }
  tr.update(Date.now() / 1000);
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

function whistle(at) {
  const a = game.audio;
  if (!a?._ready?.()) return;
  for (const [f, g] of [[466, 0.07], [587, 0.05], [698, 0.035]]) a._tone({ freq: f, to: f * 0.98, duration: 1.5, gain: g, type: "sawtooth", at });
  a._noise({ duration: 1.4, gain: 0.05, type: "bandpass", freq: 1800, q: 2, at });
}

function bell(at) {
  const a = game.audio;
  if (!a?._ready?.()) return;
  for (let i = 0; i < 3; i++) a._tone({ freq: 1320, duration: 0.7, gain: 0.06, type: "triangle", delay: i * 0.45, at });
}
