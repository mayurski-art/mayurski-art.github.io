// Troll Royale — the drop cinematic, phase 1 (doc "Troll Forces: Royale
// drop cinematic"): the last stretch before the green, first person, no
// skip. Phase 1 is the photo and the mask:
//
//   T-36 .. T-30   take your seat: the game walks you to it from wherever
//                  you are and sits you down (user, 2026-10-18)
//   T-29.6 .. T-22 seated, a card: how you spend the wait (user,
//                  2026-10-17): the photo, or music
//   T-22 .. T-16   seated, and either
//                    the photo: your family's (you, her and your baby son)
//                    out of your chest pocket, a long look, your thumb
//                    across it; or
//                    music: the iPod out, the wired earbuds in, a Troll
//                    Radio song you picked, play, and you listen
//   T-16           the jumpmaster cuts in; your head comes up, the photo
//                  or the iPod goes back in the pocket, the song fades
//   T-15 .. T-12   he tells you to mask up; your hands
//                  bring the oxygen mask to your face, the view darkens
//   T-12 .. T-9    three slow breaths, the visor fogging on each
//   T-9  .. T-8    strap off, the mask drops away
// Phase 2 (the hold scene, royale-crew.js has the jumpmaster and the squad
// mate, stick trollface figures):
//   T-8            seatbelt off, on your feet
//   T-7.4 .. T-3.4 down the aisle to the ramp's hinge (the jumpmaster went
//                  ahead); the ramp lowers from T-5, red light since T-15
//   T-1.6 .. T-0.3 you turn round to face into the hold: back to the door
//   T-0            green: the jumpmaster shoves you (user, 2026-10-18)
//                  and you go out backwards off the ramp
//
// Everything runs off the drop clock (royale.planeT), which every client
// already shares, so nothing new goes on the wire. A client that boards
// after T-22 (a late join) skips it. Subtitles only, no voice.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { beginStreakHold, endStreakHold } from "../streaks/hold.js?v=sh1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-cl1-bp1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1";
import { SEAT_SPOTS } from "./royale-hold.js?v=pl1-pl2-sr1-or1-rr1";
import { oxygenMask } from "./royale-mask.js?v=dc1";
import { familyPhoto, setPhotoThumb } from "./royale-photo.js?v=dc1-ph1-op1";
import { ipod, drawIpod, pressIpod } from "./royale-ipod.js?v=dc1";
import { updateCrew, hideCrew, crewSeat, yourRampPath, pathAt, paceFor, CREW } from "./royale-crew.js?v=dc2-rf1-ls1-rr1-ld2";
import { playSfx } from "../sound/sfx-files.js?v=dc4";

export const CINE = {
  start: -28,       // drop clock: the scene takes over
  photoOut: [-27.6, -26.5],   // the photo up out of the pocket
  caress: [-25.3, -23.2],     // the thumb across it, slowly
  interrupt: -22,             // the jumpmaster cuts in
  photoAway: [-21.9, -21.1],  // back in the pocket
  maskFrom: -21,              // the hands go to the mask
  seatFrom: -42,              // walked to your seat from wherever you are
  seatBy: -36.6,              // ...there by now (sooner if you're close)
  sitTime: 0.7,               // turning round and sitting down
  cardFrom: -35.6,            // seated: the opener's card comes up
  buds: [-26.4, -25.8],       // music: the earbuds in
  press: [-25.6, -25.2],      // the thumb on play
  playAt: -25.4,              // the song starts
  fade: [-22, -21.3],         // and fades when he cuts in
  release: 0,       // the green: hands you back, at the ramp
  stand: [-14, -13.45],      // seatbelt off, up on your feet
  walkFrom: -13.4,          // down the aisle to the ramp
  walkBy: -9.4,            // ...there by now, whatever the seat
  turn: [-1.6, -0.3],      // round to face into the hold
  lookDown: [-6, -1.75],   // down past the edge once the ramp's slid in: a long look (user, 2026-10-18)
  lean: 1.3,               // m: the head out past the edge to look straight down (the floor hid most of it)
  zoom: 1.75,              // a longer lens looking down: the island bigger, the floor's edge out of frame
  tail: 1.4,               // GO GO GO, after the green
  raise: [-20.6, -19.5],   // the mask up to the face
  // On the breathing clip (sound/sfx-files.js "breathing" at BREATH_RATE
  // from breathFrom): the visor fogs as each one goes out.
  breaths: [-19.1, -17.43, -15.5],
  breathFrom: -19.2,
  lower: [-15.2, -14.5],     // the strap off, the mask down
  seatedEye: -0.42,        // the eye this much lower, sitting
};

/* What the jumpmaster says, and when. Subtitles only (user, 2026-10-17). */
const LINES = [
  { at: -22, until: -18, who: "Jumpmaster", text: "Hey. Mask on, troll. Air's thin up here." },
  { at: -18, until: -15, who: "Jumpmaster", text: "Deep breaths. That's it." },
  { at: -15, until: -13, who: "Jumpmaster", text: "Okay, off. On your feet." },
  { at: -13, until: -10.6, who: "Jumpmaster", text: "Get to the ramp. Wait for green." },
  { at: -1.7, until: 0, who: "Jumpmaster", text: "Back to the door." },
  { at: 0, until: 1.4, who: "Jumpmaster", text: "GO! GO! GO!" },
];

const cine = { armed: false, on: false, done: false, t: 0, yaw: 0, heard: new Set(), lineAt: null, song: null,
  path: null, pace: 0, side: 1, seatZ: 0, walk: {}, head: 0, stepAcc: 0, last: null, tailUntil: null,
  seating: null };   // T-36 .. T-22: { path, t0, pace, at (arrived), yaw }

/* How you spend the wait: "photo" or "music", and the Troll Radio track.
   Remembered for next time (this browser only). */
const OPENER_KEY = "to-drop-opener";
const opener = (() => {
  try { const s = JSON.parse(localStorage.getItem(OPENER_KEY) || "{}"); return { pick: s.pick === "music" ? "music" : "photo", track: s.track | 0 }; }
  catch { return { pick: "photo", track: 0 }; }
})();
function saveOpener() { try { localStorage.setItem(OPENER_KEY, JSON.stringify(opener)); } catch { /* private window */ } }
/* Tests and the card: set the opener. */
export function setDropOpener(pick, track = opener.track) {
  opener.pick = pick === "music" ? "music" : "photo";
  const n = game.music?.tracks?.length || 1;
  opener.track = ((track % n) + n) % n;
  saveOpener();
  renderCard();
}
export function dropOpener() { return { ...opener }; }

const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

/* 0 down out of view .. 1 sealed on the face. */
export function maskK(t = cine.t) {
  if (!cine.on) return 0;
  return smooth(CINE.raise[0], CINE.raise[1], t) * (1 - smooth(CINE.lower[0], CINE.lower[1], t));
}
/* The breath in the mask: 0 .. 1 at the top of each exhale. */
function breath(t) {
  let b = 0;
  for (const at of CINE.breaths) {
    const u = t - at;
    if (u >= 0 && u < 1) b = Math.max(b, u < 0.45 ? 0 : Math.sin(((u - 0.45) / 0.55) * Math.PI));
  }
  return b;
}

export function dropCineOn() { return cine.on; }
/* The photo or the iPod: 0 in the pocket .. 1 up in front of you. */
function propK(t) {
  if (!cine.on) return 0;
  return smooth(CINE.photoOut[0], CINE.photoOut[1], t) * (1 - smooth(CINE.photoAway[0], CINE.photoAway[1], t));
}
export function photoK(t = cine.t) { return cine.pick === "photo" ? propK(t) : 0; }
export function ipodK(t = cine.t) { return cine.pick === "music" ? propK(t) : 0; }
/* Where you're looking at it (head down), 0..1, until he cuts in. */
function photoLook(t) {
  if (cine.pick !== "photo") return 0;
  return smooth(CINE.photoOut[0] - 0.2, CINE.photoOut[1] + 0.3, t) * (1 - smooth(CINE.interrupt, CINE.interrupt + 0.35, t));
}
/* Music: down at the iPod to pick and press play, then head up, listening. */
function ipodLook(t) {
  if (cine.pick !== "music") return 0;
  return smooth(CINE.photoOut[0] - 0.2, CINE.photoOut[1] + 0.3, t) * (1 - smooth(CINE.playAt + 0.2, CINE.playAt + 1, t));
}
function listening(t) {
  if (cine.pick !== "music") return 0;
  return smooth(CINE.playAt + 0.2, CINE.playAt + 1, t) * (1 - smooth(CINE.interrupt, CINE.interrupt + 0.35, t));
}
export function dropCineIpod() { return ipod(); }
export function dropCineIpodK() { return ipodK(); }
export function dropCinePhoto() { return familyPhoto(); }
export function dropCinePhotoK() { return photoK(); }
/* The thumb's stroke, 0..1 (setPhotoThumb). */
export function dropCineCaress(t = cine.t) {
  const k = (t - CINE.caress[0]) / (CINE.caress[1] - CINE.caress[0]);
  return k > 0 && k < 1 ? k : 0;
}
/* The mask is in the hands (streak-view.js poses it while this is true). */
export function dropCineMask() { return oxygenMask(); }
export function dropCineMaskK() { return maskK(); }

/* A new match: nothing carried over. */
export function resetDropCine() {
  if (cine.on) finish();
  cine.tailUntil = null;
  cine.path = null;
  hideCrew();
  cine.armed = false;
  cine.done = false;
  cine.heard.clear();
  cine.breathClip = cine.stepsClip = false;
  cine.seating = null;
  showUi(false);
  showCard(false);
}

/* From royale.js updateAboardPlayer, every frame aboard. True while the
   scene has you (the hold's own walking rules wait). */
export function updateDropCine(r, dt) {
  const t = r.planeT;
  cine.sq = r.drop?.squadron || null;   // the ridden plane's heading, for the look down (lookStanding)
  const d = r.drop;
  cine.lastT = t;
  // Only a player aboard before the scene starts gets it: a late join
  // boards past T-15 and goes straight to the hold as it was.
  if (!cine.armed && !cine.done && d.phase === "lobby" && t < CINE.start - 0.2) cine.armed = true;
  // Take your seat: walked there and sat down, no steering.
  const seatTime = cine.armed && !cine.on && !cine.done && d.phase === "lobby" && t >= CINE.seatFrom && t < CINE.start && game.player.alive;
  if (seatTime) takeSeat(r, t, dt);
  else cine.seating = null;
  // Sat down: the card, photo or music.
  showCard(seatTime && cine.seating?.at != null && t >= Math.max(CINE.cardFrom, cine.seating.at + CINE.sitTime));
  tickCard(t);
  if (cardOn) padPick();
  if (!cine.on && cine.armed && !cine.done && t >= CINE.start && t < CINE.release) begin(r);
  if (!cine.on) {
    if (seatTime) return true;
    tail(r, t, dt);
    return false;
  }
  cine.t = t;
  if (!game.player.alive || t >= CREW.shoveHit + 0.05 || (d.phase !== "lobby" && d.phase !== "run")) {
    // His hands land: you go over backwards (royale.js runs you off the ramp).
    const shoved = game.player.alive && t >= CREW.shoveHit + 0.05;   // a beat after his hands land
    finish();
    if (shoved) {
      r.pushed = { yaw: game.look.yaw };
      r.autoRun = true;
      cine.tailUntil = CINE.release + CINE.tail;
    }
    tail(r, t, dt);
    return false;
  }
  pin(r, t);
  updateCrew(r, t, dt, cine.walk, cine.side, cine.seatZ);
  // The mask's off: the hands are empty for the walk.
  if (t >= CINE.lower[1] + 0.1 && game.player.holding === "streak" && game.streakDeviceKind === "mask") endStreakHold(true);
  if (t >= CINE.lower[1] + 0.1 && game.player.holding !== "none" && game.player.holding !== "streak") game.setHolding("none");
  // He cuts in: the photo goes away and the hands go to the mask.
  if (t >= CINE.maskFrom && (game.streakDeviceKind === "photo" || game.streakDeviceKind === "ipod")) beginStreakHold(0, "mask");
  if (cine.pick === "photo") setPhotoThumb(familyPhoto(), dropCineCaress(t));
  else music(t);
  look(t, dt);
  cues(t);
  ui(t);
  return true;
}

/* After the green: GO GO GO under the bars a moment longer (the HUD's
   back), and the crew stays put till you're out of the plane. */
function tail(r, t, dt) {
  if (cine.tailUntil != null) {
    if (t < cine.tailUntil && game.player.alive) { showUi(true); ui(t); }
    else { cine.tailUntil = null; showUi(false); }
  }
  if (cine.done && cine.path && r.me === "aboard" && game.player.alive && t < 30) updateCrew(r, t, dt, localYou(r), cine.side, cine.seatZ);
  else hideCrew();
}
const _you = { x: 0, z: 0 };
function localYou(r) {
  const o = r.drop.origin, p = game.move.pos;
  _you.x = p.x - o.x; _you.z = p.z - o.z;
  return _you;
}

/* The seat the squad mate takes (royale.js hides the bot drawn in it), or
   -1 when there's no scene. */
export function dropCineCrewSeat(r) {
  return (cine.on || (cine.done && cine.path)) && r ? crewSeat(r.seat) : -1;
}
/* At the ramp facing in when the green came (the green light's banner says
   how to go out). */
export function dropCineAtRamp() { return (cine.on && cine.t >= CINE.turn[0]) || (cine.done && cine.tailUntil != null); }

/* T-36 on: from wherever you are in the hold to your seat (down your own
   side's aisle, round behind the pallet if you're across the hold from
   it), then round to face across and down onto it. */
const PALLET = { x: 0.43, z0: -4.75, z1: -2.0 };   // royale-hold.js's pallet, with room
function seatingPath(r) {
  const seat = seatOf(r), o = r.drop.origin, p = game.move.pos;
  const sx = seat.pos.x - o.x, sz = seat.pos.z - o.z, side = sx < 0 ? -1 : 1;
  const x0 = p.x - o.x, z0 = p.z - o.z, lane = side * 0.62;
  const pts = [{ x: x0, z: z0 }];
  // Across the hold from your seat, beside the pallet: behind it first.
  if (Math.sign(x0) !== side && Math.abs(x0) > 0.05 && z0 > PALLET.z0 && z0 < PALLET.z1) pts.push({ x: x0, z: PALLET.z1 + 0.15 });
  pts.push({ x: lane, z: pts.at(-1).z }, { x: lane, z: sz }, { x: sx, z: sz });
  return { pts: pts.filter((q, i) => i === 0 || Math.hypot(q.x - pts[i - 1].x, q.z - pts[i - 1].z) > 0.02), yaw: seat.yaw };
}
function takeSeat(r, t, dt) {
  const o = r.drop.origin, p = game.move.pos;
  if (!cine.seating) {
    const { pts, yaw } = seatingPath(r);
    cine.seating = { path: pts, t0: t, pace: Math.min(3.2, paceFor(pts, t, Math.max(t + 1, CINE.seatBy), 1.3)), at: null, yaw, walk: {}, phase: 0 };
    if (game.player.holding !== "none") game.setHolding("none");
  }
  const st = cine.seating, w = pathAt(st.path, st.t0, st.pace, t, st.walk);
  if (!w.moving && st.at == null) st.at = t;
  p.x = o.x + w.x;
  p.z = o.z + w.z;
  if (w.moving) game.move.velocity.set(-Math.sin(w.yaw) * st.pace, game.move.velocity.y, -Math.cos(w.yaw) * st.pace);
  else game.move.velocity.set(0, game.move.velocity.y, 0);
  // Looking the way you walk; there, round to face across the hold.
  const want = st.at == null ? w.yaw : st.yaw;
  game.look.yaw += Math.atan2(Math.sin(want - game.look.yaw), Math.cos(want - game.look.yaw)) * Math.min(1, dt * (st.at == null ? 6 : 4));
  game.look.pitch += (-0.06 - game.look.pitch) * Math.min(1, dt * 4);
}
/* How far down into your seat (0 standing .. 1 sat): the eye's drop and,
   seen in third person, your body (view/third-person.js). */
export function dropCineSitK() {
  const st = cine.seating;
  if (st?.at != null) return smooth(st.at + 0.15, st.at + CINE.sitTime, cine.lastT);
  return cine.on ? 1 - smooth(CINE.stand[0], CINE.stand[1], cine.t) : 0;
}
/* Out of the plane (royale.js jumpOut): the line and the bars go with you
   (the tail only runs while you're aboard). */
export function dropCineOut() {
  if (cine.tailUntil == null) return;
  cine.tailUntil = null;
  showUi(false);
}
/* The scene's in first person: its hands and props only show there. */
export function dropCineFirstPerson() { return cine.on; }

const t0 = (r) => r.planeT;
function begin(r) {
  cine.on = true;
  const seat = seatOf(r);
  cine.yaw = seat.yaw;
  // Your way to the ramp, plane-local.
  const o = r.drop.origin;
  cine.side = seat.pos.x - o.x < 0 ? -1 : 1;
  cine.seatZ = seat.pos.z - o.z;
  cine.path = yourRampPath(cine.side, seat.pos.x - o.x, cine.seatZ);
  cine.pace = paceFor(cine.path, CINE.walkFrom, CINE.walkBy, 2.4);
  cine.head = cine.yaw;
  cine.last = null;
  cine.stepAcc = 0;
  game.setHolding?.("none");
  // The photo, then the mask, go in the hands the way a streak device does.
  cine.pick = opener.pick;
  for (const m of [familyPhoto(), ipod(), oxygenMask()]) if (!m.parent) game.weaponRig.add(m);
  beginStreakHold(0, t0(r) < CINE.maskFrom ? (cine.pick === "music" ? "ipod" : "photo") : "mask");
  document.body.classList.add("to-dropcine");
  showUi(true);
}

function finish() {
  cine.on = false;
  cine.done = true;
  cine.armed = false;
  if (game.player.holding === "streak" && ["mask", "photo", "ipod"].includes(game.streakDeviceKind)) endStreakHold(true);
  oxygenMask().visible = false;
  familyPhoto().visible = false;
  ipod().visible = false;
  stopSong();
  document.body.classList.remove("to-dropcine");
  showUi(false);
}

/* Your seat: in the ghost hold (world), the spot in front of its pan, and
   which way you face (across the hold). */
const _seat = new THREE.Vector3();
function seatOf(r) {
  const hold = r.drop.hold, o = r.drop.origin;
  const s = hold?.seats?.[r.seat]?.local || null;
  const sp = SEAT_SPOTS[r.seat % SEAT_SPOTS.length];
  const lx = s ? s.x : sp.x, lz = s ? s.z : sp.z;
  _seat.set(o.x + lx * 0.84, o.y, o.z + lz);
  return { pos: _seat, yaw: lx < 0 ? -Math.PI / 2 : Math.PI / 2 };
}

/* Seated, then walked to the ramp: you don't steer, whatever the keys say. */
function pin(r, t) {
  const { pos } = seatOf(r);
  const o = r.drop.origin, p = game.move.pos;
  const w = pathAt(cine.path, CINE.walkFrom, cine.pace, t, cine.walk);
  const x = o.x + w.x, z = o.z + w.z;
  if (Math.abs(p.x - x) > 0.25 || Math.abs(p.z - z) > 0.25 || Math.abs(p.y - pos.y) > 0.3) game.move.reset(x, z, pos.y);
  else { p.x = x; p.z = z; }
  if (w.moving) game.move.velocity.set(-Math.sin(w.yaw) * cine.pace, 0, -Math.cos(w.yaw) * cine.pace);
  else game.move.velocity.set(0, 0, 0);
  // Boots on the deck: a step every stride.
  if (cine.last) {
    cine.stepAcc += Math.hypot(x - cine.last.x, z - cine.last.z);
    if (cine.stepAcc > 0.7) { cine.stepAcc = 0; if (!cine.stepsClip) metalStep(); }
  }
  cine.last = { x, z };
}

/* The head: down at the photo, up and round to the jumpmaster when he
   cuts in (he's forward, toward the flight deck), then across the hold, a
   little down while the hands bring the mask up, a slow sway with the
   plane, and a nod on each breath. */
function look(t, dt) {
  if (t >= CINE.stand[0]) { lookStanding(t, dt); return; }
  const k = maskK(t);
  const lift = smooth(CINE.raise[0] - 0.3, CINE.raise[1], t) * (1 - smooth(CINE.raise[1], CINE.raise[1] + 0.8, t));
  const down = photoLook(t) + ipodLook(t) * 0.85;
  const lis = listening(t);
  const glance = smooth(CINE.interrupt, CINE.interrupt + 0.4, t) * (1 - smooth(CINE.raise[0] + 0.2, CINE.raise[0] + 1.1, t));
  const toFront = cine.yaw < 0 ? 0.55 : -0.55;   // the flight deck is -Z: yaw 0
  game.look.yaw = cine.yaw + glance * toFront + Math.sin(t * 0.55) * 0.035 * (1 - down * 0.6) + Math.sin(t * 1.7) * 0.008;
  // Listening: head back a touch against the wall, a small nod on the beat.
  const nod = lis * (0.05 + Math.max(0, Math.sin(t * Math.PI * 2 * 1.15)) * 0.03);
  game.look.pitch = -0.06 - down * 0.3 + nod + glance * 0.3 - lift * 0.16 + k * 0.05 - breath(t) * 0.025 + Math.sin(t * 0.8) * 0.01;
}

/* On your feet: down the aisle the way you walk, then aft at the ramp
   watching it come down, then round to face into the hold (toward your own
   wall, where the jumpmaster holds the strap). */
const _north = new THREE.Vector3(), _northQ = new THREE.Quaternion();
function lookStanding(t, dt) {
  const w = cine.walk;
  let want;
  if (t < CINE.walkFrom) want = cine.yaw;
  else if (w.moving) want = w.yaw;
  else want = Math.PI + cine.side * Math.PI * smooth(CINE.turn[0], CINE.turn[1], t);
  if (t >= CINE.turn[0]) cine.head = want;   // the turn is the script's own
  else cine.head += Math.atan2(Math.sin(want - cine.head), Math.cos(want - cine.head)) * Math.min(1, dt * 5);
  const ramp = smooth(-9.4, -8.4, t) * (1 - smooth(CINE.turn[0], CINE.turn[0] + 0.5, t));
  // The ramp slides in under the floor (royale-planes.js retractAt): a look
  // straight down past the edge at the island, then back up for the turn.
  const down = smooth(CINE.lookDown[0], CINE.lookDown[0] + 0.45, t) * (1 - smooth(CINE.lookDown[1] - 0.35, CINE.lookDown[1], t));
  // Looking down, the head turns so the island's the right way up: map
  // north at the top, as it's drawn (user, 2026-10-18), whichever way the
  // plane runs. Yaw is in the hold's frame, so less the plane's heading.
  let yaw = cine.head;
  if (down > 0 && cine.sq) {
    const fwd = _north.set(0, 0, -1).applyQuaternion(cine.sq.riddenQuat(_northQ));
    const north = -Math.atan2(-fwd.x, -fwd.z);   // world yaw 0 looks -z: the map's top
    yaw += Math.atan2(Math.sin(north - yaw), Math.cos(north - yaw)) * down;
  }
  game.look.yaw = yaw + Math.sin(t * 0.55) * 0.02;
  game.look.pitch = -0.04 - ramp * 0.14 - down * 1.32 + (w.moving ? Math.sin(t * 9) * 0.008 : 0) + Math.sin(t * 0.8) * 0.01;
  cine.lean = down * CINE.lean;
  cine.zoom = 1 + down * (CINE.zoom - 1);
}

/* The eye's drop for sitting (royale.js placeAboardView): up as you stand. */
export function dropCineEye() { return CINE.seatedEye * dropCineSitK(); }
/* ...and how far it leans out aft over the edge (plane-local +z). */
export function dropCineZoom() { return cine.on ? cine.zoom || 1 : 1; }
export function dropCineLean() { return cine.on ? cine.lean || 0 : 0; }

// ---- sound: the Pixabay clips (sound/sfx-files.js); each slot keeps its
// synth version for when its clip isn't in yet.
const BREATH_RATE = 1.15;   // the clip's three breaths fitted to the mask's 4.4 s

function cues(t) {
  const once = (id, at, fn) => { if (t >= at && !cine.heard.has(id)) { cine.heard.add(id); fn(); } };
  once("photo-out", CINE.photoOut[0] + 0.1, paperRustle);
  once("photo-away", CINE.photoAway[0], paperRustle);
  if (cine.pick === "music") {
    once("bud-l", CINE.buds[0] + 0.1, budIn);
    once("bud-r", CINE.buds[1] - 0.15, budIn);
    once("click", CINE.press[0] + 0.15, wheelClick);
  }
  once("seal", CINE.raise[1] - 0.05, maskHiss);
  once("breathing", CINE.breathFrom, () => { cine.breathClip = !!playSfx("breathing", { gain: 0.8, rate: BREATH_RATE }); });
  if (!cine.breathClip) CINE.breaths.forEach((at, i) => { once(`in${i}`, at, breathIn); once(`out${i}`, at + 0.45, breathOut); });
  once("snap", CINE.lower[0], strapSnap);
  once("belt", CINE.stand[0], seatbeltClick);
  once("steps", CINE.walkFrom + 0.1, () => { cine.stepsClip = !!playSfx("steps", { gain: 0.55 }); });
}
const audio = () => (game.audio?._ready?.() ? game.audio : null);
function paperRustle() {
  const a = audio(); if (!a) return;
  a._noise({ duration: 0.22, gain: 0.05, type: "bandpass", freq: 3400, q: 0.9, sweepTo: 2200 });
  a._noise({ duration: 0.12, gain: 0.03, type: "highpass", freq: 4500, delay: 0.14 });
}
function budIn() {
  const a = audio(); if (!a) return;
  a._noise({ duration: 0.08, gain: 0.08, type: "lowpass", freq: 500 });
  a._noise({ duration: 0.03, gain: 0.04, type: "highpass", freq: 3000, delay: 0.05 });
}
function wheelClick() {
  const a = audio(); if (!a) return;
  a._noise({ duration: 0.015, gain: 0.12, type: "highpass", freq: 4200 });
}
function maskHiss() {
  const a = audio(); if (!a || playSfx("mask-hiss", { gain: 0.45 })) return;
  a._noise({ duration: 1.6, gain: 0.07, type: "highpass", freq: 3200, sweepTo: 5200 });
}
function breathIn() {
  const a = audio(); if (!a) return;
  a._noise({ duration: 0.45, gain: 0.1, type: "bandpass", freq: 700, q: 0.8, sweepTo: 1300 });
}
function breathOut() {
  const a = audio(); if (!a) return;
  a._noise({ duration: 0.6, gain: 0.12, type: "bandpass", freq: 1100, q: 0.7, sweepTo: 450 });
  a._noise({ duration: 0.12, gain: 0.05, type: "highpass", freq: 2800, delay: 0.05 });   // the valve's flutter
}
function strapSnap() {
  const a = audio(); if (!a || playSfx("strap-snap", { gain: 0.6 })) return;
  a._noise({ duration: 0.05, gain: 0.3, type: "highpass", freq: 1800 });
  a._tone({ freq: 520, to: 180, duration: 0.07, gain: 0.08, type: "square" });
}
function metalStep() {
  const a = audio(); if (!a) return;
  a._noise({ duration: 0.07, gain: 0.12, type: "lowpass", freq: 900 });
  a._tone({ freq: 140, to: 90, duration: 0.06, gain: 0.05, type: "triangle" });
}
function seatbeltClick() {
  const a = audio(); if (!a || playSfx("belt", { gain: 0.7 })) return;
  for (const d of [0, 0.09]) a._noise({ duration: 0.03, gain: 0.25, type: "highpass", freq: 2600, delay: d });
}

// ---- music: the song on Troll Radio (sound/music.js), through the earbuds

/* Play the picked track from the top, at the player's music volume, and
   remember what the radio was doing so it goes back after. */
function music(t) {
  const dev = ipod();
  const tracks = game.music?.tracks || [];
  const playing = t >= CINE.playAt;
  drawIpod(dev, { mode: playing ? "playing" : "list", tracks, index: opener.track, t: Math.max(0, t - CINE.playAt) });
  const pk = (t - CINE.press[0]) / (CINE.press[1] - CINE.press[0]);
  pressIpod(dev, pk > 0 && pk < 1 ? Math.sin(pk * Math.PI) : 0);
  if (playing && !cine.song && t < CINE.fade[1]) startSong();
  if (cine.song && t >= CINE.fade[0]) {
    const k = Math.min(1, (t - CINE.fade[0]) / (CINE.fade[1] - CINE.fade[0]));
    if (game.music) game.music.el.volume = cine.song.vol * (1 - k);
    if (k >= 1) stopSong();
  }
}
function startSong() {
  const m = game.music;
  if (!m?.hasTracks) { cine.song = { vol: 0 }; return; }
  cine.song = { vol: m.volume, prevPlaying: m.playing, prevIndex: m.order[m.pos], prevPos: m.pos };
  m.playIndex(opener.track);
}
function stopSong() {
  const s = cine.song, m = game.music;
  cine.song = null;
  if (!s || !m || s.vol == null) return;
  m.stop();
  m.el.volume = m.volume;
  // The radio was on before: back to what it was playing. Off: back on
  // its own track, still off.
  if (s.prevPlaying && s.prevIndex != null) m.playIndex(s.prevIndex);
  else if (s.prevPos != null) { m.pos = s.prevPos; m._loadCurrent(false); }
}
export function dropCineSong() { return cine.song ? { index: opener.track, playing: !!game.music?.playing } : null; }

// ---- the opener card (the lobby): photo or music, and which song

let card = null, cardOn = false;
function ensureCard() {
  if (card) return card;
  const parent = document.getElementById("to-hud")?.parentElement || document.body;
  const root = document.createElement("div");
  root.className = "to-dropcine-card";
  root.hidden = true;
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Before the drop");
  // Press X for the photo, Y for music (user, 2026-10-18), and as plain as
  // a Detroit: Become Human choice: the word and its button in a thin
  // bracket frame, a line running down to the scene. The button in the
  // device's own terms (keycap, the pad's face button); on touch you tap it.
  root.innerHTML = `<div class="to-dropcine-card-row">
  <button type="button" data-pick="photo" aria-label="Photo"><span class="to-dropcine-card-word">Photo</span><i class="to-dropcine-card-key is-x" aria-hidden="true">X</i></button>
  <button type="button" data-pick="music" aria-label="Music"><span class="to-dropcine-card-word">Music</span><i class="to-dropcine-card-key is-y" aria-hidden="true">Y</i></button>
</div>
<div class="to-dropcine-card-song">
  <button type="button" data-step="-1" aria-label="Previous song">‹</button>
  <span class="to-dropcine-card-track"></span>
  <button type="button" data-step="1" aria-label="Next song">›</button>
</div>
<i class="to-dropcine-card-time" aria-hidden="true"><b></b></i>`;
  parent.appendChild(root);
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.pick) setDropOpener(b.dataset.pick);
    else if (b.dataset.step) setDropOpener("music", opener.track + +b.dataset.step);
  });
  window.addEventListener("keydown", (e) => {
    if (!cardOn) return;
    const k = e.key.toLowerCase();
    if (k === "x") { setDropOpener("photo"); e.preventDefault(); e.stopPropagation(); }
    else if (k === "y") { setDropOpener("music"); e.preventDefault(); e.stopPropagation(); }
    else if ((e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "ArrowUp" || e.code === "ArrowDown") && opener.pick === "music") {
      setDropOpener("music", opener.track + (e.code === "ArrowLeft" || e.code === "ArrowUp" ? -1 : 1));
      e.preventDefault();
    }
  }, true);
  card = { root, track: root.querySelector(".to-dropcine-card-track"), song: root.querySelector(".to-dropcine-card-song"), keys: [...root.querySelectorAll(".to-dropcine-card-key")], time: root.querySelector(".to-dropcine-card-time b") };
  return card;
}
function showCard(on) {
  if (on === cardOn) return;
  cardOn = on;
  if (!on && !card) return;
  ensureCard().root.hidden = !on;
  if (on) renderCard();
}
function renderCard() {
  if (!card) return;
  for (const b of card.root.querySelectorAll("[data-pick]")) {
    const sel = b.dataset.pick === opener.pick;
    b.classList.toggle("is-on", sel);
    b.setAttribute("aria-pressed", String(sel));
  }
  const tr = game.music?.tracks?.[opener.track];
  card.song.hidden = opener.pick !== "music" || !tr;
  if (tr) card.track.textContent = `${tr.title} · ${tr.artist}`;
  const pad = navigator.getGamepads?.()?.find((p) => p);
  const device = game.isTouch ? "touch" : pad ? "pad" : "keys";
  card.root.dataset.device = device;
  // A PlayStation pad's square and triangle sit where an Xbox pad's X and Y do.
  const ps = device === "pad" && /playstation|dualsense|dualshock|054c/i.test(pad.id);
  card.root.dataset.pad = ps ? "ps" : "";
  const glyphs = ps ? ["\u25A1", "\u25B3"] : ["X", "Y"];
  card.keys.forEach((k, i) => { if (k.textContent !== glyphs[i]) k.textContent = glyphs[i]; });
}
/* The line under the choice runs down to the scene. */
function tickCard(t) {
  if (!card || !cardOn) return;
  const k = Math.max(0, Math.min(1, (CINE.start - t) / (CINE.start - CINE.cardFrom)));
  card.time.style.transform = `scaleX(${k.toFixed(3)})`;
}
/* A controller: the d-pad works the card (its own edges, read here). */
const padPrev = [];
function padPick() {
  const gp = navigator.getGamepads?.()?.find((p) => p) || null;
  if (!gp) return;
  const edge = (i) => { const on = !!gp.buttons[i]?.pressed; const was = padPrev[i]; padPrev[i] = on; return on && !was; };
  // X (2) the photo, Y (3) music (a PlayStation pad's square and triangle);
  // the d-pad steps the song.
  if (edge(2)) setDropOpener("photo");
  if (edge(3)) setDropOpener("music");
  if (opener.pick === "music") {
    if (edge(14) || edge(12)) setDropOpener("music", opener.track - 1);
    if (edge(15) || edge(13)) setDropOpener("music", opener.track + 1);
  }
  if (card && card.root.dataset.device !== "pad") renderCard();
}

// ---- the letterbox, the subtitle, the visor

let el = null;
function ensureUi() {
  if (el) return el;
  const parent = document.getElementById("to-hud")?.parentElement || document.body;
  const root = document.createElement("div");
  root.className = "to-dropcine-ui";
  root.hidden = true;
  root.innerHTML = `<div class="to-dropcine-memory" aria-hidden="true"></div><div class="to-dropcine-visor" aria-hidden="true"><i></i></div>`
    + `<div class="to-dropcine-bar is-top" aria-hidden="true"></div><div class="to-dropcine-bar is-bottom" aria-hidden="true"></div>`
    + `<p class="to-dropcine-sub" aria-live="polite"><b></b><span></span></p>`;
  parent.appendChild(root);
  el = {
    root, memory: root.querySelector(".to-dropcine-memory"), visor: root.querySelector(".to-dropcine-visor"), fog: root.querySelector(".to-dropcine-visor i"),
    sub: root.querySelector(".to-dropcine-sub"), who: root.querySelector(".to-dropcine-sub b"), text: root.querySelector(".to-dropcine-sub span"),
  };
  return el;
}
function showUi(on) {
  if (!on && !el) return;
  const u = ensureUi();
  u.root.hidden = !on;
  u.root.classList.toggle("is-on", on);
  if (!on) { cine.lineAt = null; u.sub.classList.remove("is-on"); }
}
function ui(t) {
  const u = ensureUi();
  const line = LINES.find((l) => t >= l.at && t < l.until) || null;
  if ((line?.at ?? null) !== cine.lineAt) {
    cine.lineAt = line?.at ?? null;
    if (line) { u.who.textContent = line.who; u.text.textContent = line.text; }
    u.sub.classList.toggle("is-on", !!line);
  }
  const k = maskK(t);
  // Lost in the photo: the edges go soft and warm until he cuts in.
  u.memory.style.opacity = String(photoLook(t) * 0.85);
  u.visor.style.opacity = String(k * 0.9);
  u.fog.style.opacity = String(k * breath(t) * 0.75);
}
