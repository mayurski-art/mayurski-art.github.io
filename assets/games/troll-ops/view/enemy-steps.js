// Footsteps for everyone who isn't you. Panned, so the direction of the
// sound is real information: the thing you actually listen for in a PF
// fight. Tracked per-actor by distance travelled rather than a timer, so
// someone walking slowly is quieter and rarer than someone sprinting.
// (Moved out of game.js with the perks: Dead Silence mutes a player's steps
// for everyone else, Awareness turns everyone else's up for you.)

import { game } from "../core/state.js?v=st1";
import { footprints, hero, heroActive } from "../modes/umb-heroes.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1";
import { hasPerk, peerHas, PERK_TUNE } from "../perks.js?v=pk1-cl1-bp1-fj1-zc1-zc2-nf1";

const stepTrack = new Map();
const STEP_STRIDE = 1.9;     // metres between footfalls
const STEP_HEARING = 34;     // beyond this we don't bother emitting
const STEP_VOLUME = 0.16;    // louder than your own steps: these are the ones worth hearing

export function updateEnemySteps() {
  const seen = new Set();
  const sources = [];
  for (const rp of game.remotes.byId.values()) {
    if (rp.alive) sources.push({ key: `r${rp.netId}`, pos: rp.pos, rope: rp.stance === "rope", silent: peerHas(rp.peer, "deadsilence") });
  }
  for (const b of game.bots.bots) {
    if (b.alive) sources.push({ key: `b${b.id}`, pos: b.pos, rope: b.stance === "rope" });
  }
  const volume = STEP_VOLUME * (hasPerk("awareness") ? PERK_TUNE.awarenessSteps : 1);

  for (const s of sources) {
    seen.add(s.key);
    let t = stepTrack.get(s.key);
    if (!t) { stepTrack.set(s.key, { last: s.pos.clone(), dist: 0 }); continue; }

    const moved = s.pos.distanceTo(t.last);
    t.last.copy(s.pos);
    // A teleport (respawn, net correction) shouldn't fire a burst of steps.
    if (moved > 3 || s.rope) { t.dist = 0; continue; }   // a rope climb is silent
    t.dist += moved;

    if (t.dist >= STEP_STRIDE) {
      t.dist -= STEP_STRIDE;
      if (heroActive() && hero().id === "hunter" && game.player.alive) footprints().drop(s.pos, game.look.yaw);
      if (!s.silent && s.pos.distanceTo(game.player.pos) < STEP_HEARING) game.audio.step(s.pos, volume);
    }
  }

  for (const key of stepTrack.keys()) if (!seen.has(key)) stepTrack.delete(key);
}
