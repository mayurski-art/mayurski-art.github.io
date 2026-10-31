// Engineer (perks.js): enemy scorestreaks marked through walls. Every enemy
// streak in the world (drones, the Swarm, gunships, the warship, SAM
// turrets, Dragonfires, dogs, their care packages) gets a small amber
// diamond on screen wherever it is, walls or not.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { hasPerk } from "../progression/perks.js?v=pk1-cl1-bp1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";
import { streakEntities } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-hb4-jx2";

let layer = null;
const _p = new THREE.Vector3();

/* Whether a streak entity is the other side's. Ours (not a bot's we host)
   never is; one with a side is hostile unless it's ours; one without (a
   drone copy) is hostile unless we own it. */
function hostile(e) {
  if (e.owned && !e.botId) return false;
  const ffa = !!game.currentMode?.()?.ffa;
  if (e.team) return ffa || !game.net.team || e.team !== game.net.team;
  return !e.owned;
}

function positions(e, out) {
  if (Array.isArray(e.dogs)) { for (const d of e.dogs) if (d?.alive && d.pos) out.push(d.pos); return; }
  if (e.pos?.isVector3) { out.push(e.pos); return; }
  if (e.root) out.push(e.root.getWorldPosition(new THREE.Vector3()));
}

export function updateEngineerMarks() {
  const on = hasPerk("engineer") && game.gameState === "playing" && game.player.alive;
  if (!on) { if (layer) layer.hidden = true; return; }
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "to-engineer-marks";
    layer.setAttribute("aria-hidden", "true");
    game.els.hud.appendChild(layer);
  }
  layer.hidden = false;
  const at = [];
  for (const e of streakEntities.values()) if (hostile(e)) positions(e, at);
  while (layer.children.length < at.length) layer.appendChild(document.createElement("i"));
  const w = layer.clientWidth || window.innerWidth, h = layer.clientHeight || window.innerHeight;
  [...layer.children].forEach((m, i) => {
    const pos = at[i];
    if (!pos) { m.hidden = true; return; }
    _p.set(pos.x, pos.y + 0.6, pos.z).project(game.camera);
    const vis = _p.z < 1 && Math.abs(_p.x) < 1.02 && Math.abs(_p.y) < 1.02;
    m.hidden = !vis;
    if (vis) m.style.transform = `translate(${((_p.x + 1) / 2) * w}px, ${((1 - _p.y) / 2) * h}px) rotate(45deg)`;
  });
}
