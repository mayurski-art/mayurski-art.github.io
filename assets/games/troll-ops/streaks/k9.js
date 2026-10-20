// Troll Forces K9 Unit: who a pack may chase, stairs, sight, and dogs taking
// damage. Moved out of game.js (split phase 1).

import * as THREE from "three";
import { raycastWorld } from "../weapons/ballistics.js?v=cg1-wst-hf1-fu1b7-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-or1-gf1-tg1";
import { streakEntities } from "./calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-er1";
import { HUNTER_DOG_BITE, heroFx, HUNTER_PIN } from "../modes/umb-heroes.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-tcs1-er1";
import { spawnComicWord, showWaveBanner, pushKillfeed } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1";
import { K9 } from "../bots/k9-unit.js?v=k9c-bs1-sb2-gj1b7b7d-sr1-fl1-or1-gf1-tg1-tcs1";
import { SCORE } from "./scorestreaks.js?v=umb1-wst-sb2-fu1-wb1-ar1-ar2-cl1-bp1-fj1-zc1-zc2-nf1-or1";
import { game } from "../core/state.js?v=st1";
import { hasPerk, peerHas } from "../progression/perks.js?v=pk1-cl1-bp1-fj1-zc1-zc2-nf1-or1";

/* A pack that's hostile to us: shootable, and on our radar as a threat. */
export function k9Hostile(pack) {
  if (pack.owned && !pack.botId) return false;   // ours (a bot's pack we host can be the enemy's)
  if (pack.botId && !game.currentMode().ffa && pack.team === game.net.team) return false;
  return !!game.currentMode().ffa || !game.net.team || pack.team !== game.net.team;
}

/* Who a pack may go for: its owner's enemies (bots and peers both live in
   remotes). The owner is never on the list. */
/* Every stair on the map as { a, b } (foot and top, feet height), for the
   dogs to get between floors: the ones maps.js laid with api.stairs, plus a
   zombies map's own links (Hollowgrin's grand stair is built by hand). */
let k9StairCache = null;
export function k9Stairs() {
  if (k9StairCache?.map === game.builtMap) return k9StairCache.list;
  const list = [...(game.builtMap?.stairs || [])];
  const zl = game.builtMap?.map?.zombieLayout?.();
  for (const l of zl?.links || []) {
    const fy = (id) => zl.floors?.[id] ?? 0;
    list.push({ a: { x: l.a.x, y: fy(l.from), z: l.a.z }, b: { x: l.b.x, y: fy(l.to), z: l.b.z } });
  }
  k9StairCache = { map: game.builtMap, list };
  return list;
}
/* Can a dog (feet at `from`) see a troll (feet at `to`)? */
const _k9Eye = new THREE.Vector3(), _k9Dir = new THREE.Vector3();
function k9CanSee(from, to) {
  _k9Eye.set(from.x, from.y + 0.6, from.z);
  _k9Dir.set(to.x - from.x, to.y + 1.1 - _k9Eye.y, to.z - from.z);
  const len = _k9Dir.length();
  if (len < 0.01) return true;
  _k9Dir.divideScalar(len);
  return raycastWorld(game.colliders, _k9Eye, _k9Dir, len) >= len - 0.3;
}

function k9Hostiles(pack) {
  const ffa = game.currentMode().ffa;
  const out = [];
  // Cold Blooded (perks.js): the dogs don't pick you.
  for (const rp of game.remotes.byId.values()) {
    if (!rp.alive || rp.netId === pack.ownerId || peerHas(rp.peer, "coldblooded")) continue;
    if (!ffa && pack.team && rp.team === pack.team) continue;
    out.push({ id: rp.netId, pos: rp.pos, alive: true });
  }
  if (!hasPerk("coldblooded") && game.streakOwnerHates(pack.team, pack.botId)) out.push({ id: game.net.id, pos: game.move.pos, alive: true });
  return out;
}

export function updateK9(id, pack, dt) {
  if (!pack.owned) {
    if (pack.updateCopy(dt) === "expire") { pack.dispose(); streakEntities.delete(id); }
    return;
  }
  const ownerBot = pack.botId ? game.bots.byId(pack.botId) : null;
  const out = pack.updateOwned(dt, {
    hostiles: () => k9Hostiles(pack),
    canSee: k9CanSee,
    ownerPos: ownerBot ? (ownerBot.alive ? ownerBot.pos : null) : game.player.alive ? game.move.pos : null,
    onBite: (dog, targetId, dmg) => {
      game.audio.bark?.(dog.pos);
      if (pack.hunter) {
        // U Mad Bro? Hunter's Doge: one bite pins them, then it trots off.
        if (pack.pinned) return;
        pack.pinned = true;
        game.streakDamage(pack.botId, targetId, HUNTER_DOG_BITE, "k9");
        heroFx(targetId, "pin", { s: HUNTER_PIN });
        spawnComicWord(dog.pos, false, "PINNED!");
        pack.duration = pack.age + HUNTER_PIN + 0.3;
        return;
      }
      game.streakDamage(pack.botId, targetId, dmg, "k9");
    },
  });
  if (game.net.active && pack.snapT <= 0) {
    pack.snapT = 1 / K9.snapHz;
    game.net.publishStreak({ kind: "k9", action: "pos", eid: id, team: pack.team, d: pack.snapshot() });
  }
  if (out === "expire") {
    if (game.net.active) game.net.publishStreak({ kind: "k9", action: "end", eid: id });
    if (!pack.botId && !pack.hunter) showWaveBanner("K9 UNIT CALLED OFF", 1400);
    pack.dispose();
    streakEntities.delete(id);
  }
}

/* A dog taking damage from us, one of our bots, or a hit off the wire. Only
   the pack's owner applies it; anyone else forwards it. True if it died. */
export function damageDog(pack, i, dmg, byId) {
  if (!pack.dogs[i]?.alive) return false;
  if (!pack.owned) {
    if (game.net.active) game.net.publishStreak({ kind: "k9", action: "hit", eid: pack.id, i, dmg: Math.round(dmg), by: byId });
    return false;
  }
  if (!pack.damage(i, dmg)) return false;
  game.audio.bark?.(pack.dogs[i].pos, true);
  if (game.net.active) game.net.publishStreak({ kind: "k9", action: "die", eid: pack.id, i, by: byId });
  return true;
}

export function dogKilledBy(byId) {
  if (byId !== game.net.id) return;
  game.awardScore(SCORE.dogKill);
  pushKillfeed(`K9 down  +${SCORE.dogKill}`);
  game.audio.kill();
}
