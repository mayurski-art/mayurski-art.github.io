// Bot watch: a backstop for a room whose bots stand frozen.
//
// One client runs the bots for the room (net.js hostId); everyone else only
// draws what it sends. Twice that client stopped moving them without the
// liveness rule noticing (2026-10-05, 2026-10-10/11: the second was two
// clients each leaving the bots to the other, fixed in net.js). Whatever
// the next way is, every client now watches the bots it's shown:
//   - not hosting: most bots frozen for two windows running, it stops
//     trusting that host (net.distrust; the next live client hosts, often
//     this one, and fills a fresh set) and tells the room. Others take the
//     word only if they see the same freeze themselves.
//   - hosting: its own bots frozen, it says why on the console once and
//     rebuilds the bots' nav, as a map load does.
// Called every frame of a live match (match-clock.js updateMatchClock).

import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1";
import { game } from "../core/state.js?v=st1";

const WINDOW = 6;      // seconds per measure
const WINDOWS = 2;     // frozen this many windows running = stalled
const GRACE = 8;       // seconds after the match goes live (bots being placed)
const STILL = 0.3;     // metres in a window that count as standing still
const SHARE = 0.8;     // of the alive bots
const MIN_BOTS = 4;
const TRUST_MS = 60000;

const W = { key: null, grace: GRACE, t: 0, path: new Map(), at: new Map(), frozen: 0, selfChecked: false, last: null };

function restart(grace = 0) {
  W.grace = Math.max(W.grace, grace);
  W.t = 0;
  W.path.clear();
  W.at.clear();
}

/* The share of bots that barely moved in the window so far, and how many. */
function measure() {
  const d = [...W.path.values()];
  return { n: d.length, still: d.length ? d.filter((x) => x < STILL).length / d.length : 0 };
}

export function watchBots(dt) {
  const net = game.net;
  // Troll Royale parks the bots far from anyone (LOD): still on purpose.
  if (!net?.connected || !game.isPvp() || game.isRoyale() || game.isStaging() || game.gameState !== "playing") { W.key = null; return; }
  if (!net.onStall) net.onStall = onStall;
  // A new match (the key clears between them): grace again, and the host check may run again.
  const key = `${net.room}|${game.loadedMapId}`;
  if (W.key !== key) { W.key = key; W.selfChecked = false; W.frozen = 0; W.grace = GRACE; restart(); }
  if (W.grace > 0) { W.grace -= dt; return; }

  W.t += dt;
  for (const p of net.peers.values()) {
    if (!/^bot-/.test(p.id)) continue;
    const s = p.snaps?.at(-1);
    if (!p.alive || !s) { W.at.delete(p.id); continue; }
    const prev = W.at.get(p.id);
    W.path.set(p.id, (W.path.get(p.id) || 0) + (prev ? Math.hypot(s.x - prev[0], s.z - prev[1]) : 0));
    W.at.set(p.id, [s.x, s.z]);
  }
  if (W.t < WINDOW) return;
  const m = measure();
  W.last = m;
  W.frozen = m.n >= MIN_BOTS && m.still >= SHARE ? W.frozen + 1 : 0;
  restart();
  if (W.frozen < WINDOWS) return;
  W.frozen = 0;
  if (net.isBotHost()) selfCheck(m);
  else takeOver(net.hostId(), m);
}

/* Someone else saw the host's bots freeze: take their word only if ours
   are frozen too (a few seconds in, most of them still). */
function onStall(msg) {
  const net = game.net;
  if (!W.key || net.isBotHost() || msg.host !== net.hostId()) return;
  const m = W.t >= 3 ? measure() : W.last;
  if (m && m.n >= MIN_BOTS && m.still >= SHARE) takeOver(msg.host, m, true);
}

function takeOver(host, m, told = false) {
  const net = game.net;
  console.warn(`[bot-watch] ${Math.round(m.still * 100)}% of ${m.n} bots frozen; not trusting host ${host} for ${TRUST_MS / 1000}s${told ? " (another player saw it too)" : ""}`);
  net.distrust(host, TRUST_MS);
  if (!told) net.publishStall(host);
  W.frozen = 0;
  restart(GRACE);
  showWaveBanner("Bots restarted");
}

/* We host and our own bots stand still: say why, once a match, and give
   them their nav again. */
function selfCheck(m) {
  if (W.selfChecked) return;
  W.selfChecked = true;
  const B = game.bots;
  const sample = B.bots.slice(0, 6).map((b) => `${b.id}:stuck${(b.stuckT || 0).toFixed(1)}/hops${b.stuckHops | 0}/${b.stairPlan ? "stair" : b.perch ? "perch" : b.lastSeen ? "hunt" : "roam"}`);
  console.warn(`[bot-watch] hosting, ${Math.round(m.still * 100)}% of ${m.n} bots frozen on ${game.loadedMapId}; nav ${B.fieldSrc ? "built" : "MISSING"}; rebuilding it. ${sample.join(" ")}`);
  B.rebuildNav(game.colliders, game.ARENA, 0);
  restart(GRACE);
}

/* Tests: the watch's state. */
export const botWatch = W;
