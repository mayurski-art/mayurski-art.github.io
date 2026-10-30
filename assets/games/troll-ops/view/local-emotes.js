// Your own emotes: the hold-H wheel, which emote is playing and how, and duo
// emotes (pick one, hold X by a teammate, they hold X to accept).

import { HAND_POSES } from "../weapons/hand-model.js?v=to-grip2-or1-hp1-bx1";
import { FP_HAND_POSES } from "../characters/emotes.js?v=hb4-em1-wst-soc1-ng1c2f1m1u-gt1-gt2-cw1-zr10-bf1-sr1-or1-nf2-em2-cf1-gs2-lh1-fg2-lp1-fg3-rc1-rc4-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-ht2-bx1-cg1-mg1-sp1-chg1";
import { EmoteWheel, EMOTES } from "../characters/emote-wheel.js?v=hb4-em1-wst-soc1c2f1m1u-gt1-gt2-cw1-zr10-bf1-sr1-or1-nf2-em2-nb2-pc2-cf1-gs2-lh1-fg2-lp1-fg3-rc1-rc4-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-ht2-bx1-sf1-cg1-mg1-sp1-chg1";
import * as THREE from "three";
import { segmentBlocked } from "../weapons/ballistics.js?v=cg1-wst-hf1-fu1b7-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-or1-gf1-tg1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416";
import { look, keys } from "../input/keyboard-mouse.js?v=km1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416";
import { touchState } from "../input/touch.js?v=in1-th2-bp1-bf1-pd1-nf1-fs1";
import { initMenuRoster } from "../menu/escape-menu.js?v=em1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-aa0-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-spd1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416";
import { game } from "../core/state.js?v=st1";

export let emoteWheel;
export function stopEmote() { game.emote = null; }
export const emoteKind = () => (game.emote ? EMOTES[game.emote.idx]?.kind ?? null : null);
/* Third person and duo emotes pull the camera out; first person ones don't. */
export const emoteIsTp = () => !!game.emote && emoteKind() !== "fp";
/* This frame's first-person emote: hand targets, gun, camera motion. */
export const fpEmoteFrame = () => (emoteKind() === "fp" ? EMOTES[game.emote.idx].fp(game.emote.t) : null);
/* Nothing to play (a bad index off a hook or old save): no emote. */
export function validEmote() { if (game.emote && !EMOTES[game.emote.idx]) game.emote = null; return game.emote; }

/* Duo emotes (user, 2026-10-04: "it shouldn't be aim at the person. it
   should be a trigger to hold x near a person to send them a emote request.
   and then they receive that notification. and in order for the duo emote to
   activate, that other person has to stand near the other person and hold x.
   also the emote request should have a 30 second limit countdown").
   Pick a duo emote on the wheel and it's armed. Walk up to a teammate (within
   DUO_NEAR) and hold X (DUO_HOLD) to send them the request. They get a
   notification counting down DUO_REQUEST_SECONDS; to accept they come and
   stand by you and hold X too. The accepter works out where both stand
   (their midpoint, facing each other the emote's distance apart) and sends
   it back, so both clients snap to the same spots and start together.
   Teammates only. While it's yours to use, X belongs to the duo (no weapon
   swap or pickup). */
const DUO_NEAR = 3, DUO_REQUEST_SECONDS = 30, DUO_HOLD = 0.6;
export let duoArmed = null;      // { idx, until, hold } picked on the wheel, not sent yet
export let duoOutgoing = null;   // { to, name, idx, until }
export let duoIncoming = null;   // { from, name, idx, until, hold }
export let duoTarget = null;     // the teammate in reach this frame
export let duoXClaimed = false;  // X is the duo's this frame (updatePickupPrompt leaves it alone)
const _duoFrom = new THREE.Vector3(), _duoTo = new THREE.Vector3();
const duoAllowed = () => game.isPvp() && game.net.connected && !game.currentMode().ffa && !!game.net.team && game.player.alive;
const duoTeammate = (rp) => !!rp?.peer && !game.isBotPeer(rp.peer) && rp.alive && rp.peer.team === game.net.team;
/* Close enough to share an emote: DUO_NEAR on the ground, about the same
   floor, nothing solid in between. */
function duoInReach(rp) {
  if (!duoTeammate(rp)) return false;
  const d = Math.hypot(rp.pos.x - game.move.pos.x, rp.pos.z - game.move.pos.z);
  if (d > DUO_NEAR || Math.abs(rp.pos.y - game.move.pos.y) > 1.5) return false;
  _duoFrom.set(game.move.pos.x, game.move.pos.y + 1.1, game.move.pos.z);
  _duoTo.set(rp.pos.x, rp.pos.y + 1.1, rp.pos.z);
  return !segmentBlocked(game.colliders, _duoFrom, _duoTo);
}
export function nearestDuoTeammate() {
  if (!duoAllowed()) return null;
  let best = null, bestD = Infinity;
  for (const rp of game.remotes.byId.values()) {
    if (!duoInReach(rp)) continue;
    const d = Math.hypot(rp.pos.x - game.move.pos.x, rp.pos.z - game.move.pos.z);
    if (d < bestD) { best = rp; bestD = d; }
  }
  return best;
}
/* Picked on the wheel: ready to send with X. A new pick replaces a request
   still waiting for an answer. */
export function armDuo(idx) {
  if (EMOTES[idx]?.kind !== "duo" || !duoAllowed()) return;
  cancelDuoOutgoing();
  duoArmed = { idx, until: performance.now() + DUO_REQUEST_SECONDS * 1000, hold: 0 };
}
function cancelDuoOutgoing() {
  if (duoOutgoing && game.net.connected) game.net.send({ t: "duo", id: game.net.id, to: duoOutgoing.to, k: "cancel", e: duoOutgoing.idx });
  duoOutgoing = null;
}
export function sendDuoInvite(idx, rp = duoTarget) {
  if (!rp || !game.net.connected) return;
  game.net.send({ t: "duo", id: game.net.id, to: rp.netId, k: "invite", e: idx });
  duoOutgoing = { to: rp.netId, name: rp.peer?.name || "operator", idx, until: performance.now() + DUO_REQUEST_SECONDS * 1000 };
  duoArmed = null;
}
export function onDuoMessage(p, m) {
  const idx = m.e | 0;
  if (EMOTES[idx]?.kind !== "duo") return;
  if (m.k === "invite") {
    if (p.team !== game.net.team || game.currentMode().ffa) return;   // teammates only
    duoIncoming = { from: p.id, name: p.name || "operator", idx, until: performance.now() + DUO_REQUEST_SECONDS * 1000, hold: 0 };
    game.audio.stageTick?.();
  } else if (m.k === "cancel") {
    if (duoIncoming?.from === p.id) duoIncoming = null;
  } else if (m.k === "accept") {
    if (!duoOutgoing || duoOutgoing.to !== p.id || duoOutgoing.idx !== idx) return;
    duoOutgoing = null;
    if (!game.player.alive || game.gameState !== "playing") return;
    placeForDuo(m.mx, m.mz, m.dx, m.dz, idx, -1);
    game.emote = { idx, t: 0, role: 0 };
  }
}
/* Stand at the duo spot: `side` -1 is the inviter, +1 the accepter, along
   (dx, dz), which points from the inviter to the accepter. */
function placeForDuo(mx, mz, dx, dz, idx, side) {
  if (![mx, mz, dx, dz].every(Number.isFinite)) return;
  const half = (EMOTES[idx].dist || 1) / 2;
  const x = mx + dx * side * half, z = mz + dz * side * half;
  game.move.pos.x = x; game.move.pos.z = z;
  game.player.pos.x = x; game.player.pos.z = z;
  if (game.move.velocity) game.move.velocity.set(0, 0, 0);
  // Face the partner: the inviter looks along (dx, dz), the accepter back.
  const fx = -side * dx, fz = -side * dz;
  look.yaw = Math.atan2(-fx, -fz);
}
function acceptDuo() {
  const inv = duoIncoming;
  duoIncoming = null;
  const rp = game.remotes.byId.get(inv.from);
  if (!rp || !game.player.alive || game.gameState !== "playing") return;
  let dx = game.move.pos.x - rp.pos.x, dz = game.move.pos.z - rp.pos.z;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len; dz /= len;
  const mx = (game.move.pos.x + rp.pos.x) / 2, mz = (game.move.pos.z + rp.pos.z) / 2;
  game.net.send({ t: "duo", id: game.net.id, to: inv.from, k: "accept", e: inv.idx, mx, mz, dx, dz });
  placeForDuo(mx, mz, dx, dz, inv.idx, 1);
  duoArmed = null;
  cancelDuoOutgoing();
  game.emote = { idx: inv.idx, t: 0, role: 1 };
}
const duoPromptEl = document.createElement("div");
let duoPromptText = "", duoPromptClock = "";
const duoSecondsLeft = (until, now) => Math.max(0, Math.ceil((until - now) / 1000));
/* Per frame: the wheel's duo state, the X hold (accept or send) and the
   prompt with its countdown. */
export function updateDuo(dt) {
  const now = performance.now();
  const live = game.player.alive && game.gameState === "playing";
  if (!live) { duoArmed = null; duoIncoming = null; cancelDuoOutgoing(); }
  if (duoArmed && now > duoArmed.until) duoArmed = null;
  if (duoOutgoing && now > duoOutgoing.until) duoOutgoing = null;
  if (duoIncoming && now > duoIncoming.until) duoIncoming = null;
  if (emoteWheel.isOpen) emoteWheel.setDuo(duoAllowed(), nearestDuoTeammate()?.peer?.name || null);

  const holdingX = keys.has("KeyX") || (game.isTouch && touchState.swap) || !!game.gamepadState.pickup;
  const inviter = duoIncoming ? game.remotes.byId.get(duoIncoming.from) : null;
  const inviterNear = !!inviter && duoInReach(inviter);
  duoTarget = duoArmed && !inviterNear ? nearestDuoTeammate() : null;
  duoXClaimed = inviterNear || !!duoTarget;
  // X accepts a request from someone beside you first, else sends yours.
  const fill = (o) => { o.hold = holdingX ? o.hold + dt : Math.max(0, o.hold - dt * 2); return o.hold >= DUO_HOLD; };
  if (duoIncoming) {
    if (!inviterNear) duoIncoming.hold = 0;
    else if (fill(duoIncoming)) acceptDuo();
  }
  if (duoArmed) {
    if (!duoTarget) duoArmed.hold = 0;
    else if (fill(duoArmed)) sendDuoInvite(duoArmed.idx, duoTarget);
  }

  let text = "", clock = "", ring = 0, cls = "";
  if (duoIncoming) {
    const name = EMOTES[duoIncoming.idx].name;
    text = inviterNear ? `${duoIncoming.name} wants to ${name}: hold X` : `${duoIncoming.name} wants to ${name}: go to them and hold X`;
    clock = `${duoSecondsLeft(duoIncoming.until, now)}s`;
    ring = inviterNear ? Math.min(1, duoIncoming.hold / DUO_HOLD) : 0;
    cls = "is-incoming";
  } else if (duoArmed) {
    const name = EMOTES[duoArmed.idx].name;
    text = duoTarget ? `Hold X: ${name} with ${duoTarget.peer?.name || "operator"}` : `${name}: walk up to a teammate and hold X`;
    clock = `${duoSecondsLeft(duoArmed.until, now)}s`;
    ring = duoTarget ? Math.min(1, duoArmed.hold / DUO_HOLD) : 0;
    cls = "is-armed";
  } else if (duoOutgoing) {
    text = `${EMOTES[duoOutgoing.idx].name}: waiting for ${duoOutgoing.name}`;
    clock = `${duoSecondsLeft(duoOutgoing.until, now)}s`;
    cls = "is-waiting";
  }
  duoPromptEl.hidden = !text;
  if (!text) return;
  if (text !== duoPromptText) duoPromptEl.querySelector("span").textContent = duoPromptText = text;
  if (clock !== duoPromptClock) duoPromptEl.querySelector(".to-duo-clock").textContent = duoPromptClock = clock;
  duoPromptEl.classList.toggle("is-incoming", cls === "is-incoming");
  duoPromptEl.classList.toggle("is-armed", cls === "is-armed");
  duoPromptEl.classList.toggle("is-waiting", cls === "is-waiting");
  duoPromptEl.style.setProperty("--fill", String(ring));
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initLocalEmotes() {
  Object.assign(HAND_POSES, FP_HAND_POSES);   // point / L / flat, for the first-person emotes
  emoteWheel = new EmoteWheel(game.els.hud, (i) => {
    if (game.gameState !== "playing" || !game.player.alive) return;
    if (EMOTES[i].kind === "duo") { armDuo(i); return; }
    game.emote = { idx: i, t: 0, role: 0 };
  });
  duoPromptEl.className = "to-duo-prompt";
  duoPromptEl.hidden = true;
  duoPromptEl.setAttribute("role", "status");
  duoPromptEl.setAttribute("aria-live", "polite");
  duoPromptEl.innerHTML = "<i class=\"to-duo-ring\"></i><span></span><b class=\"to-duo-clock\"></b>";
  game.els.hud.appendChild(duoPromptEl);

  initMenuRoster();
}
