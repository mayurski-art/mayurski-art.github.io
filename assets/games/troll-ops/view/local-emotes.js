// Your own emotes: the hold-H wheel, which emote is playing and how, and duo
// emotes (pick one, hold X by a teammate, they hold X to accept).

import { HAND_POSES } from "../hand-model.js?v=to-grip2";
import { FP_HAND_POSES } from "../emotes.js?v=hb4-em1-wst-soc1-ng1";
import { EmoteWheel, EMOTES } from "../emote-wheel.js?v=hb4-em1-wst-soc1";
import * as THREE from "three";
import { segmentBlocked } from "../ballistics.js?v=cg1-wst-hf1-fu1b7";
import { look, keys } from "../input/keyboard-mouse.js?v=km1-gj1-if1-fu1b7b7d";
import { touchState } from "../input/touch.js?v=in1";
import { initMenuRoster } from "../menu/escape-menu.js?v=em1-gj1-fu1b7b7d";
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
