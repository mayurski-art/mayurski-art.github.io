// Troll Forces — Troll City's train conductor (TROLL-CITY-RP2.md, phase 2d).
//
// Take the cap off its stand at the end of the platform behind the shops
// and you're the conductor (Conductor Choo goes off shift). Hold X:
//   - on a platform (or aboard) in the last 10 s before the Grin Express
//     leaves: "All aboard!" and the train waits up to 20 s more, for
//     everyone (once a stop);
//   - in the loco's cab: the whistle;
//   - by a rider, aboard: punch their ticket.
// A hold slides the room's timetable (modes/room-clock.js `tro`), so every
// screen has the train in the same place. Only a conductor's calls count.

import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1";
import { bar, otherWithRole, rpExtras, rpListeners, setBarRole } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1";
import { peerPosers } from "../remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1";
import { TRAIN } from "../train.js?v=tr1b7";
import { bell, ride, trainOf, whistle } from "./social-train.js?v=st1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1";
import { applyHold, clock, onClockMessage, roomNow, updateRoomClock } from "./room-clock.js?v=rc1-cd1-sh1";
import { wearJobHat } from "../outfits.js?v=of1m1-nc1-cd1-sh1";

export const CONDUCTOR = {
  capTime: 0.6,       // hold X at the stand: take the cap, or hang it up
  holdTime: 0.4,      // hold X on the platform: all aboard
  holdMax: 20,        // s the train waits for an "all aboard"
  holdWindow: 10,     // ...called in the last this-many s before it leaves
  holdGap: 60000,     // ms: one hold a stop (a stop is 45 s at most)
  whistleTime: 0.3,
  whistleGap: 4000,   // ms between whistles
  punchTime: 0.8,
  reach: 1.4,         // m from the stand
};

const cond = { lastWhistle: 0, punched: 0, heard: { whistle: 0, hold: 0, punch: 0 } };

const spots = () => (game.isSocial() ? game.builtMap?.map?.rp?.conductor || null : null);
const headAt = (tr) => ({ x: tr.cars[0].pose.x, y: 2.5, z: tr.cars[0].pose.z });
const onPlatform = (S, p) => S.platforms.some((b) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && p.y < 1.2);

/* How long the train could still be held for right now (0: it can't). */
function holdable(tr) {
  const st = tr.state;
  if (st.v > 0.05 || st.leaveIn > CONDUCTOR.holdWindow) return 0;
  if (roomNow() - clock.ha < CONDUCTOR.holdGap) return 0;
  // Only as long as it's already stood: the timetable slides back, and
  // further than that would roll it back onto the track it came in on.
  const stood = TRAIN.stop - st.leaveIn;
  return Math.max(0, Math.min(CONDUCTOR.holdMax, Math.floor(stood - 0.25)));
}

/* The nearest other rider on our train within 2 m. */
function riderBeside() {
  let best = null, bestD = 2;
  for (const rp of game.remotes.byId.values()) {
    if (!rp.peer?.trainAt || game.isBotPeer(rp.peer) || !rp.alive) continue;
    const d = Math.hypot(rp.pos.x - game.move.pos.x, rp.pos.z - game.move.pos.z);
    if (d < bestD) { best = rp; bestD = d; }
  }
  return best;
}

/* Hold X: the cap, then the job's calls. */
function conductorAction() {
  const S = spots(), tr = trainOf();
  if (!S || !tr || !game.player.alive) return null;
  const p = game.move.pos;
  if (Math.hypot(p.x - S.stand.x, p.z - S.stand.z) < CONDUCTOR.reach && Math.abs(p.y - S.stand.floor) < 1) {
    if (bar.role === "conductor") {
      return { key: "ccap", label: "Hang the conductor's cap back up", busy: "Hanging it up…", ctx: "Cap", time: CONDUCTOR.capTime,
        done: () => setBarRole(null, "The cap's back on its stand.") };
    }
    const other = otherWithRole("conductor");
    if (other) return { key: "ccap", info: true, label: `${other.name || "Someone"} is the conductor` };
    return { key: "ccap", label: "Take the conductor's cap (conductor)", busy: "Putting it on…", ctx: "Cap", time: CONDUCTOR.capTime,
      done: () => setBarRole("conductor", "You're the conductor. Hold X on the platform to hold the train, in the cab to whistle, by a rider to punch a ticket.") };
  }
  if (bar.role !== "conductor") return null;
  if (ride.car) {
    const rp = riderBeside();
    if (rp) {
      const name = rp.peer.name || "them";
      return { key: `punch:${rp.peer.id}`, label: `Punch ${name}'s ticket`, busy: "Punching…", ctx: "Ticket", time: CONDUCTOR.punchTime,
        done: () => { game.net.publishRp({ k: "train", e: "punch", to: rp.peer.id }); punchSound(null); cond.punched = performance.now(); showWaveBanner(`${name}: ticket punched`, 1400); } };
    }
    if (ride.car === tr.cars[0]) {
      return { key: "whistle", label: "Pull the whistle", ctx: "Whistle", time: CONDUCTOR.whistleTime,
        done: () => {
          if (performance.now() - cond.lastWhistle < CONDUCTOR.whistleGap) return;
          cond.lastWhistle = performance.now();
          game.net.publishRp({ k: "train", e: "whistle" });
          whistle(headAt(tr));
        } };
    }
  }
  if (ride.car || onPlatform(S, p)) {
    const secs = holdable(tr);
    if (secs > 0) return { key: "hold", label: `All aboard! (hold the train ${secs}s)`, ctx: "Hold", time: CONDUCTOR.holdTime, done: () => holdTrain(secs) };
  }
  return null;
}

function holdTrain(secs) {
  const tr = trainOf();
  if (!tr) return;
  const n = clock.hseq + 1, at = roomNow();
  applyHold(n, secs, at);
  game.net.publishRp({ k: "train", e: "hold", n, secs, at });
  allAboard(null, tr);
}
function allAboard(who, tr) {
  bell(headAt(tr));
  const near = Math.hypot(tr.cars[0].pose.x - game.move.pos.x, tr.cars[0].pose.z - game.move.pos.z) < 40;
  if (near || ride.car) showWaveBanner(`${who ? `${who}: ` : ""}All aboard! The Grin Express leaves in ${Math.ceil(tr.state.leaveIn)}s`, 2600);
}
function punchSound(at) {
  const a = game.audio;
  if (!a?._ready?.()) return;
  a._tone({ freq: 2200, to: 900, duration: 0.05, gain: 0.08, type: "square", at });
  a._noise({ duration: 0.06, gain: 0.12, type: "highpass", freq: 2500, delay: 0.02, at });
}

/* Off the wire: the clock, and a conductor's calls. */
function onMessage(p, m) {
  if (m.k === "clock") { onClockMessage(p, m); return; }
  if (m.k !== "train" || game.isBotPeer(p) || p.role !== "conductor") return;
  const tr = trainOf();
  if (!tr) return;
  if (m.e === "hold") {
    const secs = Math.max(0, Math.min(CONDUCTOR.holdMax, +m.secs || 0));
    if (secs && applyHold(m.n, secs, Number.isFinite(+m.at) ? +m.at : roomNow())) { cond.heard.hold++; allAboard(p.name || "The conductor", tr); }
  } else if (m.e === "whistle") {
    cond.heard.whistle++;
    whistle(headAt(tr));
  } else if (m.e === "punch") {
    p.punchAt = performance.now();   // their arm jabs (remote-players.js, as a fist fight's does)
    if (m.to !== game.net.id) return;
    cond.heard.punch++;
    punchSound(null);
    showWaveBanner("Ticket punched · the Grin Express thanks you", 2000);
  }
}

/* Each frame in Socialize: the clock, our cap, the cap on its stand. */
export function updateConductor() {
  const S = spots();
  updateRoomClock();
  if (!S) { if (bar.role === "conductor") setBarRole(null, null); return; }
  const mine = bar.role === "conductor";
  wearJobHat(game.localRig, bar.role);   // a job's hat, whatever the job (outfits.js JOB_HATS)
  const worn = mine || !!otherWithRole("conductor");
  S.setCap(!worn);
}

rpExtras.push(conductorAction);
rpListeners.push(onMessage);
// Everyone else's job hat (the conductor's cap, the sheriff's hat), on their head.
peerPosers.push((rp) => wearJobHat(rp.rig, game.isSocial() ? rp.peer?.role : null));

if (new URLSearchParams(location.search).has("tohooks")) {
  window.__trollConductor = { CONDUCTOR, cond, clock, holdable: () => holdable(trainOf()), roomNow };
}
