/* Troll Royale: the Boat sails round Trollface Island's lake, and whoever is
   aboard sails with it (maps/trollface-boat.js is the Boat).

   updateRoyale calls this every frame of a match, alive or not: the Boat
   goes where Royale's clock has it (`royale.t`, the seconds since the match
   went live, which a late joiner catches up to, so every screen has it in
   the same place; it waits at its mooring till then), then everything that
   was aboard at its last pose is put back where it stood on the deck at the
   new one: us (turned as it turns), the bots, and the loot lying on it. We
   send where we stand on it (`bt`: x:z, boat-local); everyone draws us
   there on the Boat as it is now, not where the 110 ms-old snapshot left us
   (3.5 m/s would put us 40 cm astern). */

import { Boat } from "../maps/trollface-boat.js?v=tfb1-tfb8-ss1-ss2-ss3-tfm2-hgb2-ugb1-ug1-ugm1-hgb5-hgb6-hgb8";
import { peerPlacers } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1";
import { game } from "../core/state.js?v=st1";

export const boatOf = () => game.builtMap?.map?.boat?.() || null;

/* A peer aboard: on the deck where they stand, the Boat where it is now. */
peerPlacers.push((rp) => {
  const s = rp.peer?.boatAt;
  const boat = s && boatOf();
  if (!boat) return;
  const [lx, lz] = s.split(":").map(Number);
  if (!Number.isFinite(lx) || !Number.isFinite(lz)) return;
  const w = Boat.toWorld(boat.pose, lx, lz);
  rp.pos.x = w.x;
  rp.pos.z = w.z;
});

/* `t`: royale.t; `loot`: royale.loot (its items lie where their x, y, z say). */
export function updateBoat(t, loot) {
  const boat = boatOf();
  if (!boat) return;
  const moved = boat.update(t);
  const me = game.move?.pos;
  if (moved) {
    const pose = boat.pose;
    let turn = pose.ry - boat.prev.ry;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const carry = (p) => {
      const l = boat.aboard(p.x, p.y, p.z);
      if (!l) return false;
      const w = Boat.toWorld(pose, l.x, l.z);
      p.x = w.x;
      p.z = w.z;
      return true;
    };
    if (me && game.player.alive && carry(me)) game.look.yaw += turn;
    for (const b of game.bots.bots) if (b.alive && carry(b.pos)) b.yaw = (b.yaw || 0) + turn;
    for (const it of loot?.items.values() || []) {
      if ((it.y || 0) < 0.4 || !carry(it)) continue;
      it.mesh?.position.set(it.x, it.y, it.z);
    }
  }
  // where we stand on it, for the wire
  const l = me && game.player.alive ? boat.aboard(me.x, me.y, me.z, boat.pose) : null;
  if (game.net) game.net.boatAt = l ? `${l.x.toFixed(2)}:${l.z.toFixed(2)}` : null;
}

export function boatAboard() {
  const boat = boatOf(), me = game.move?.pos;
  return !!(boat && me && boat.aboard(me.x, me.y, me.z, boat.pose));
}
