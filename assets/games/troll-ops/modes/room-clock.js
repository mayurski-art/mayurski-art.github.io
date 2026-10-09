// Troll Forces — the room's clock, in any Socialize room (TROLL-CITY-RP2.md).
//
// The same trick as DJ Lulz's (dj-lulz.js), without needing a DJ: the room's
// oldest real player (lowest id on a tie) says what time it is every 2 s;
// everyone keeps the largest of their last few `rn - Date.now()` readings
// (the trip only ever makes it look smaller). So the Grin Express stands at
// the same spot on every screen even when two devices' clocks disagree.
//
// It also carries the train's shared hold: `tro` (seconds taken off the
// timetable by the conductor's "all aboard" holds), its count `hseq`, and
// when the last one was (`ha`, room ms), so a late joiner gets them too.

import { game } from "../core/state.js?v=st1";

const SAY_EVERY = 2000;   // ms between the keeper's time checks
const LISTEN_MS = 1500;   // just in: hear the room out before keeping it

export const clock = {
  skew: 0, offs: [], heard: false, room: null, joinAt: 0, lastSent: 0,
  tro: 0, hseq: 0, ha: 0,   // the train's holds (modes/social-conductor.js)
};

export function roomNow() { return Date.now() + clock.skew; }

/* The room's oldest real player (lowest id on a tie). */
export function clockKeeperId() {
  const net = game.net;
  let best = { id: net.id, since: net.since || 0 };
  if (!net.connected) return best.id;
  for (const p of net.peers.values()) {
    if (game.isBotPeer(p)) continue;
    const since = p.since || 0;
    if (since < best.since || (since === best.since && p.id < best.id)) best = { id: p.id, since };
  }
  return best.id;
}
export function isClockKeeper() {
  if (game.net.connected && !clock.heard && performance.now() - clock.joinAt < LISTEN_MS) return false;
  return clockKeeperId() === game.net.id;
}

/* A new room (or out of one): forget the last room's time and holds. */
function resetFor(room) {
  Object.assign(clock, { skew: 0, offs: [], heard: false, room, joinAt: performance.now(), lastSent: 0, tro: 0, hseq: 0, ha: 0 });
}

/* Each frame (Socialize). */
export function updateRoomClock() {
  const net = game.net;
  const room = game.isSocial() && net?.connected ? net.room ?? "room" : null;
  if (room !== clock.room) resetFor(room);
  if (!room) return;
  const now = performance.now();
  if (now - clock.lastSent < SAY_EVERY || !isClockKeeper()) return;
  clock.lastSent = now;
  net.publishRp({ k: "clock", rn: roomNow(), tro: clock.tro, hseq: clock.hseq, ha: clock.ha });
}

/* Off the wire: only the keeper's word counts. */
export function onClockMessage(p, m) {
  if (m.k !== "clock" || game.isBotPeer(p) || p.id !== clockKeeperId()) return;
  if (Number.isFinite(m.rn)) {
    clock.offs.push(m.rn - Date.now());
    if (clock.offs.length > 12) clock.offs.shift();
    clock.skew = Math.max(...clock.offs);
    clock.heard = true;
  }
  // Their holds, unless we've heard of a newer one than they have.
  if ((m.hseq | 0) >= clock.hseq && Number.isFinite(+m.tro)) {
    clock.hseq = m.hseq | 0;
    clock.tro = +m.tro;
    clock.ha = Number.isFinite(+m.ha) ? +m.ha : clock.ha;
  }
}

/* A hold: the timetable slides `secs` later for everyone. `n` is the hold's
   count (one past the last), so each is taken once. */
export function applyHold(n, secs, at) {
  if ((n | 0) <= clock.hseq) return false;
  clock.hseq = n | 0;
  clock.tro -= secs;
  clock.ha = at;
  return true;
}
