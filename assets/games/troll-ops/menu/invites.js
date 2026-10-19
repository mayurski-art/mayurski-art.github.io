// Troll Forces: invite someone online to play with you (user, 2026-10-16:
// "users should be able to click on another user or guest's name and there
// should be a button to invite them").
//
// The Invite button is on the profile card (an account's) and the guest
// card (progression/profile-card.js), opened from the party list, Who's
// Online, the roster and chat. An invite is a message on the site-wide
// presence channel (assets/js/site-presence.js send/on) to that viewer:
//   - in a match with a room, it's that room (its mode and map);
//   - in the menu, we start a private match in the lobby's mode on a fresh
//     code, and the invite is to that.
// The one invited gets a card at the top of the screen, "<name> invited you
// to <mode>": Join (out of whatever match they're in, into ours) or Not now.
// Who sent it is read off the roster (presence nameOf), never the message.

import { game } from "../core/state.js?v=st1";
import { MODES } from "../modes/modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d-wb1-ar1-ar2-zh1-fl1-or1-ffa1-dom1";
import { MAPS } from "../maps/maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1b7b7dc1c2f1m1u-tc3-nc1-cd1-sh1-sg1-bw1-cw1-zr10-zh1-hr2-zp1-jb1-nh1-pi1-sr1-hl1-pf1-ub1-uw1-ug5-or1-bw2-bt1-wf1-wf2-zf1-bp1";
import { makeRoomCode } from "../net/net.js?v=umb3-rm1-ld2-em1-sb1-cb1-rp1-p22-bh1b7c4-th2-cd1-sh1-cl1-bp1-bw1-bk1-fj1-zr9-zr10-hr2-zp1-rs1-dj2-pl2-nf1-or1-bw2-bt1-dom1";
import { joinServer } from "./online.js?v=ol1-sv1-dj2-mg1-pd1-jb1-pl2-nh1-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-bp1-kp1-bl1-rg1-tb1-ut1";
import { viewerId } from "../../../js/site-presence.js?v=to-bo2d-ol1-iv1";
import { closeProfileCard } from "../progression/profile-card.js?v=pc1-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zh1-zc1-zc2-nf1-or1-nb2";

const INVITE = {
  seconds: 30,      // how long an invite card stays up
  again: 8,         // seconds before the same person can invite you again
  sendGap: 4,       // seconds between your invites to the same person
};
const ROOM = /^[A-Z0-9]{1,8}$/;

let presence = null;
const lastFrom = new Map(), lastTo = new Map();
const playing = () => game.gameState === "playing" || game.gameState === "paused";

/* Where an invite from us goes right now: { room, mode, map } or an error. */
function where() {
  if (playing()) {
    const room = game.net?.connected ? game.net.room : null;
    if (!room) return { error: "You're playing solo. Start a private match to invite someone." };
    return { room, mode: game.modeId, map: game.loadedMapId || null };
  }
  const mode = MODES[game.modeId]?.name && game.modePicked ? game.modeId : "tdm";
  return { room: makeRoomCode(), mode, map: null, start: true };
}

/* Invite `target` ({ viewerId, name }). Returns a line for the card's
   status ("Invite sent to ..."). */
export function invitePlayer(target) {
  if (!presence?.live) return "Invites need the connection to trollrunner.net. Try again in a moment.";
  if (!target?.viewerId || target.viewerId === viewerId()) return "";
  const t = performance.now();
  if (t - (lastTo.get(target.viewerId) || -1e9) < INVITE.sendGap * 1000) return `Invite already sent to ${target.name}.`;
  const w = where();
  if (w.error) return w.error;
  lastTo.set(target.viewerId, t);
  presence.send("invite", { to: target.viewerId, room: w.room, mode: w.mode, map: w.map });
  if (w.start) {
    // From the menu: into our private match first, so the room's there
    // when they join it. The card goes (the match is starting under it).
    closeProfileCard();
    joinServer({ room: w.room, mode: w.mode, map: null }, { listed: false });
    return `Invite sent to ${target.name}. Starting your private ${MODES[w.mode].name} match.`;
  }
  return `Invite sent to ${target.name}.`;
}

/* ── The card the invited player sees ─────────────────────────────────── */
let card = null, timer = 0, pending = null;
function hide() { if (card) card.hidden = true; clearTimeout(timer); pending = null; }
/* Mid-match the mouse is the game's (pointer lock): J takes the invite. */
document.addEventListener("keydown", (e) => {
  if (!pending || e.code !== "KeyJ" || e.repeat || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "")) return;
  e.preventDefault();
  const d = pending;
  hide();
  join(d);
}, true);
function show(who, d) {
  if (!card) {
    card = document.createElement("div");
    card.className = "to-invite";
    card.setAttribute("role", "alertdialog");
    card.setAttribute("aria-live", "assertive");
    card.innerHTML = `<p class="to-invite-text"></p><p class="to-invite-key"><kbd>J</kbd> to join</p><div class="to-invite-acts"><button type="button" data-act="join">Join</button><button type="button" data-act="no">Not now</button></div><i class="to-invite-clock"></i>`;
    document.body.appendChild(card);
  }
  const mode = MODES[d.mode]?.name || "a match";
  const map = d.map && MAPS[d.map]?.name;
  const p = card.querySelector(".to-invite-text");
  p.replaceChildren();
  const b = document.createElement("b");
  b.textContent = who.name;
  p.append(b, ` invited you to ${mode}${map ? ` on ${map}` : ""}.`);
  card.querySelector('[data-act="join"]').onclick = () => { hide(); join(d); };
  card.querySelector('[data-act="no"]').onclick = hide;
  pending = d;
  // the key hint, while the mouse can't reach the buttons
  card.querySelector(".to-invite-key").hidden = !document.pointerLockElement;
  // over the game even in full screen: only the full-screen element's own
  // subtree shows then
  const host = document.fullscreenElement || document.body;
  if (card.parentNode !== host) host.appendChild(card);
  card.hidden = false;
  // the clock bar runs down the card's life
  const clock = card.querySelector(".to-invite-clock");
  clock.style.animation = "none";
  void clock.offsetWidth;
  clock.style.animation = `to-invite-clock ${INVITE.seconds}s linear forwards`;
  clearTimeout(timer);
  timer = setTimeout(hide, INVITE.seconds * 1000);
}

/* Into their room: out of the match we're in first (the pause menu's Leave
   match, so the match's XP is banked). */
async function join(d) {
  if (playing()) {
    game.els.quitBtn?.click();
    for (let i = 0; i < 40 && playing(); i++) await new Promise((r) => setTimeout(r, 50));
  }
  joinServer({ room: d.room, mode: d.mode, map: d.map }, { listed: false });
}

function onInvite(d, from) {
  if (d.to !== viewerId() || !ROOM.test(String(d.room)) || !MODES[d.mode]) return;
  if (d.map != null && !MAPS[d.map]) d.map = null;
  const who = presence.nameOf(from);
  if (!who) return;
  const t = performance.now();
  if (t - (lastFrom.get(from) || -1e9) < INVITE.again * 1000) return;
  lastFrom.set(from, t);
  // already in that room: nothing to join
  if (playing() && game.net?.room === d.room) return;
  show(who, d);
}

export function initInvites(p) {
  presence = p;
  p.on?.("invite", onInvite);
}
