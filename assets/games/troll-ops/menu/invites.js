// Troll Forces: invite someone online to play with you (user, 2026-10-16:
// "users should be able to click on another user or guest's name and there
// should be a button to invite them").
//
// The Invite button is on the profile card (an account's) and the guest
// card (progression/profile-card.js), opened from the party list, Who's
// Online, the roster and chat. An invite is a message on the site-wide
// presence channel (assets/js/site-presence.js send/on) to that viewer:
//   - in a match with a room, it's that room (its mode and map);
//   - in the menu, it's to our party (user, 2026-10-25: "it shouldnt
//     automatically start a game. it should bring them into the lobby and
//     then the host can decide from there"): nothing starts. Whoever joins
//     waits in their own menu, in our party, and when we start a match,
//     any match, the party follows us into its room.
// The one invited gets a card at the top of the screen, "<name> invited you
// to <mode>": Join (out of whatever match they're in, into ours) or Not now.
// Who sent it is read off the roster (presence nameOf), never the message.
//
// The party is messages on the same channel: party-join (to the host),
// party-go (the host's room, once its match is up), party-leave (either
// way). The host's room box takes the party's code, so a match it starts
// is private to the party unless it picks a public one; either way the
// party is told the room it really landed in.
//
// Each side's look (face and body, cosmetics.js) rides along: the host's
// on its party invite, a member's on party-join, and party-look when either
// changes it, so the lobby stands everyone on a pad in their own operator
// (user, 2026-10-27; partyView() and the "trollforces:party" event).

import { game, room } from "../core/state.js?v=st1";
import { MODES } from "../modes/modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d-wb1-ar1-ar2-zh1-fl1-or1-ffa1-dom1-gf1-tg1-kb9-sp1-gb2-tb1-dm1-tfb8-ug1-ugm1-hgb8-hgb9-mt2-hb4";
import { MAPS } from "../maps/maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1b7b7dc1c2f1m1u-tc3-nc1-cd1-sh1-sg1-bw1-cw1-zr10-zh1-hr2-zp1-jb1-nh1-pi1-sr1-hl1-pf1-ub1-uw1-ug5-or1-bw2-bt1-wf1-wf2-zf1-bp1-is1-gf1-tg1-tcs1-kb0-kb1-kb2-kb3-cl1-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-tcs2-mg1-kb12-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb3-jb6-sp1-hh1-yb1-kbt1-gb1-gb3-rh1-gb4-tb1-gb5-gb7-gb8-gb9-tb2-bl1-kbb1-kbb2-dj2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-tfp1-tfp2-tfp3-tfp4-tfp7-tfb8-tfs1-ss1-ta1-ss2-ss3-ta2-tfm2-rfx1-rm1-kzf1-hgb1-hgb2-hgb3-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-hgb5-hgb6-hgb8-hgb9-tw1-op1-hgo1-wb1-mt2-hb4";
import { makeRoomCode } from "../net/net.js?v=umb3-rm1-ld2-em1-sb1-cb1-rp1-p22-bh1b7c4-th2-cd1-sh1-cl1-bp1-bw1-bk1-fj1-zr9-zr10-hr2-zp1-rs1-dj2-pl2-nf1-or1-bw2-bt1-dom1-jb3-jb4-sp1-gb4-gb6-gb8-gb9-tfb8-rfx3-tw1-sqd1-lmg1-wb1";
import { joinServer } from "./online.js?v=ol1-sv1-dj2-mg1-pd1-jb1-pl2-nh1-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-bp1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-wo1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-rm1-kzf1-fp2-lk1-hgb1-hgb2-mrg1-hgb3-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5-sr6-sr7";
import { viewerId } from "../../../js/site-presence.js?v=to-bo2d-ol1-iv1-mv1-wo1";

const INVITE = {
  seconds: 30,      // how long an invite card stays up
  again: 8,         // seconds before the same person can invite you again
  sendGap: 4,       // seconds between your invites to the same person
};
const ROOM = /^[A-Z0-9]{1,8}$/;
/* A party: you and three more (user, 2026-10-30: "lets increase it to 4";
   it was 3), one on each pad of the lobby's stage. */
export const PARTY_SIZE = 4;

let presence = null;
const lastFrom = new Map(), lastTo = new Map();

/* Our look, as lobby.js has it ({ face, body }); and theirs, as sent: only
   short ids get through (the operator view checks them against what it
   knows, so an unknown one draws the default). */
let lookSource = () => null;
export function setLookSource(fn) { lookSource = fn; }
const ID = /^[a-z0-9_#:-]{1,40}$/i;
function cleanLook(l) {
  if (!l || typeof l !== "object") return null;
  const face = ID.test(String(l.face)) ? String(l.face) : null, body = ID.test(String(l.body)) ? String(l.body) : null;
  return face || body ? { face, body } : null;
}
const myLook = () => cleanLook(lookSource());
const playing = () => game.gameState === "playing" || game.gameState === "paused";

/* Where an invite from us goes right now: { room, mode, map } or an error. */
function where() {
  if (playing()) {
    const room = game.net?.connected ? game.net.room : null;
    if (!room) return { error: "You're playing solo. Start a private match to invite someone." };
    return { room, mode: game.modeId, map: game.loadedMapId || null };
  }
  const mode = MODES[game.modeId]?.name && game.modePicked ? game.modeId : "tdm";
  return { room: hostParty().room, mode, map: null, party: true };
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
  if (w.party && party.members.size >= PARTY_SIZE - 1) return `Your party is full (${PARTY_SIZE} of ${PARTY_SIZE}).`;
  lastTo.set(target.viewerId, t);
  presence.send("invite", { to: target.viewerId, room: w.room, mode: w.mode, map: w.map, party: !!w.party, ...(w.party ? { look: myLook() } : {}) });
  if (w.party) {
    party.invited.add(target.viewerId);
    return `Invite sent to ${target.name}. They'll wait in your party until you start a match.`;
  }
  return `Invite sent to ${target.name}.`;
}

/* ── The party ────────────────────────────────────────────────────────── */
// host: our own party (room, invited, members: viewerIds); in: the one
// we're waiting in ({ host viewerId, room, mode }). One or the other.
// looks: viewerId -> { face, body } of whoever's in it with us.
const party = { room: null, invited: new Set(), members: new Set(), sentRoom: null, in: null, looks: new Map(),
  // Squads (user, 2026-10-30): a leader's squad joined up with another's.
  // link (a leader's): { leader: theirs, lead: we asked (so we start the
  // match), people: [{ v, look }] their squad, its leader first, mode:
  // "together" | "versus" }. askedTo: the leader we asked. roster (a
  // member's, from our leader): { mine, other, mode }. team: the side the
  // party-go put us on (a joined squad's).
  link: null, askedTo: null, roster: null, team: null };
// (link.name, roster.mineName / otherName: the squads' names, when set)
/* Whose party we play Troll Royale in teams with: its leader's viewer id,
   ours when we lead or play alone (modes/royale-squads.js squadId). */
room.partyLead = () => party.in?.host || viewerId();
// ...and how many of us there are (the size Royale in teams starts at)
room.partySize = () => 1 + (party.in ? partyView().people.length : party.members.size);
const TEAM_IDS = ["phantom", "ghost"];
/* The squad's name: its leader's to pick (user, 2026-10-30: "users should
   be able to customize the name of their squads ... just the squad
   leader"), kept on the account (net/cloud-save.js), sent with the roster. */
const SQUAD_NAME_KEY = "trollops:squad-name";
export const SQUAD_NAME_MAX = 20;
function cleanName(n) {
  const t = String(n ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, SQUAD_NAME_MAX);
  return t || null;
}
export function squadName() { try { return cleanName(localStorage.getItem(SQUAD_NAME_KEY)); } catch { return null; } }
/* The leader names its squad (null/"" back to the default). */
export function setSquadName(n) {
  if (party.in) return;
  const t = cleanName(n);
  try { t ? localStorage.setItem(SQUAD_NAME_KEY, t) : localStorage.removeItem(SQUAD_NAME_KEY); } catch {}
  sentSig = "";
  partyTick();
  renderParty();
}
const SQUAD_MODES = ["together", "versus"];

/* Who stands on the pads beside us: our squad (members, or the host we're
   waiting on and the rest of their squad), and a joined squad: their names
   and looks (lobby-fn.js, lobby.js). squad: { lead (we start), mode,
   people (theirs, their leader first) } or null. */
const nameOf = (v) => presence?.nameOf(v)?.name || "";
export function partyView() {
  const me = viewerId(), person = (x, host) => ({ viewerId: x.v, name: nameOf(x.v), look: x.look || null, host });
  let people, squad = null;
  if (party.in) {
    const r = party.roster;
    people = r ? r.mine.filter((x) => x.v !== me).map((x) => person(x, x.v === party.in.host))
      : [person({ v: party.in.host, look: party.looks.get(party.in.host) }, true)];
    if (r?.other?.length) squad = { lead: false, mode: r.mode, name: r.otherName, people: r.other.map((x, i) => person(x, i === 0)).filter((p) => p.name) };
  } else {
    people = [...party.members].map((v) => person({ v, look: party.looks.get(v) }, false));
    const l = party.link;
    if (l) squad = { lead: l.lead, mode: l.mode, name: l.name || null, people: l.people.map((x, i) => person(x, i === 0)).filter((p) => p.name) };
  }
  const myName = party.in ? party.roster?.mineName || null : squadName();
  return { host: !party.in, open: !playing(), people: people.filter((p) => p.name), squad, myName };
}

/* ── Squads: a leader asks another leader; on yes, the two join up. The
   one who asked starts the match, and picks Together (one side) or Versus
   (squad against squad). ──────────────────────────────────────────────── */
const mySquad = () => [{ v: viewerId(), look: myLook() }, ...[...party.members].map((v) => ({ v, look: party.looks.get(v) || null }))];
function cleanSquad(list) {
  return (Array.isArray(list) ? list : []).filter((x) => x && typeof x.v === "string" && x.v.length < 80).slice(0, PARTY_SIZE).map((x) => ({ v: x.v, look: cleanLook(x.look) }));
}
/* Ask `target`'s squad to join up with ours. A line for the card. */
export function squadUp(target) {
  if (!presence?.live) return "Squads need the connection to trollrunner.net. Try again in a moment.";
  if (!target?.viewerId || target.viewerId === viewerId()) return "";
  if (party.in) return "Only a squad leader can join up with another squad.";
  if (party.link) return `Your squad is already joined up with ${nameOf(party.link.leader) || "another squad"}.`;
  if (party.members.has(target.viewerId)) return `${target.name} is already in your squad.`;
  party.askedTo = target.viewerId;
  presence.send("squad-req", { to: target.viewerId, size: 1 + party.members.size });
  return `Squad request sent to ${target.name}. If they say yes, your squads join up.`;
}
/* The leader who asked: Together or Versus. */
export function setSquadMode(mode) {
  if (!party.link?.lead || !SQUAD_MODES.includes(mode) || party.link.mode === mode) return;
  party.link.mode = mode;
  sentSig = "";
  partyTick();
  renderParty();
}
/* Either leader: go back to separate squads. */
export function leaveSquad() {
  if (!party.link) return;
  presence?.send("squad-leave", { to: party.link.leader });
  party.link = null;
  party.team = null;
  sentSig = "";
  partyTick();
  renderParty();
}
function onSquadReq(d, from) {
  if (d.to !== viewerId() || party.in || party.link || !presence.nameOf(from)) return;
  show(presence.nameOf(from), { squad: true, from, size: Math.max(1, Math.min(PARTY_SIZE, d.size | 0)) });
}
function acceptSquad(from) {
  if (party.in || party.link) return;
  party.link = { leader: from, lead: false, people: [], mode: "together" };
  presence.send("squad-ok", { to: from, squad: mySquad(), name: squadName() });
  sentSig = "";
  renderParty();
}
function onSquadOk(d, from) {
  if (d.to !== viewerId() || party.askedTo !== from || party.in || party.link) return;
  party.askedTo = null;
  party.link = { leader: from, lead: true, people: cleanSquad(d.squad), mode: "together", name: cleanName(d.name) };
  sentSig = "";
  partyTick();
  renderParty();
}
function onSquadRoster(d, from) {
  const l = party.link;
  if (d.to !== viewerId() || !l || from !== l.leader) return;
  l.people = cleanSquad(d.squad);
  l.name = cleanName(d.name);
  if (!l.lead && SQUAD_MODES.includes(d.mode)) l.mode = d.mode;
  sentSig = "";   // (our members hear of it)
  renderParty();
}
function onSquadLeave(d, from) {
  if (d.to !== viewerId() || party.link?.leader !== from) return;
  party.link = null;
  party.team = null;
  sentSig = "";
  renderParty();
}
/* A member hears both squads from its leader. */
function onPartyRoster(d, from) {
  if (d.to !== viewerId() || !party.in || from !== party.in.host) return;
  party.roster = { mine: cleanSquad(d.mine), other: d.other ? cleanSquad(d.other) : null, mode: SQUAD_MODES.includes(d.mode) ? d.mode : "together",
    mineName: cleanName(d.mineName), otherName: cleanName(d.otherName) };
  renderParty();
}
/* The side this device asks for when its match starts (net.js chooseTeam):
   a joined squad's; nobody else's (the room balances them). */
function myTeam() {
  if (party.in) return party.team;
  if (!party.link) return null;
  return party.link.lead ? "phantom" : party.team;
}
let sentSig = "";
/* A leader keeps the other leader and its own members told who's where. */
function sendRosters() {
  if (party.in) return;
  const mine = mySquad(), other = party.link?.people || null, mode = party.link?.mode || "together";
  const mineName = squadName(), otherName = party.link?.name || null;
  const sig = JSON.stringify([mine, other, mode, party.link?.leader || null, mineName, otherName]);
  if (sig === sentSig) return;
  sentSig = sig;
  if (party.link) presence?.send("squad-roster", { to: party.link.leader, squad: mine, mode, name: mineName });
  for (const m of party.members) presence?.send("party-roster", { to: m, mine, other, mode, mineName, otherName });
}
/* Our look changed (a face or body picked): everyone in the party sees it. */
export function partyLookChanged() {
  const look = myLook(), to = party.in ? [party.in.host] : [...party.members];
  for (const v of to) presence?.send("party-look", { to: v, look });
}
function onPartyLook(d, from) {
  if (d.to !== viewerId() || !(party.members.has(from) || party.in?.host === from)) return;
  party.looks.set(from, cleanLook(d.look));
  renderParty();
}
function hostParty() {
  if (party.in) leaveParty(false);
  if (!party.room) party.room = makeRoomCode();
  return party;
}
function leaveParty(tell = true) {
  if (party.in) {
    if (tell) presence?.send("party-leave", { to: party.in.host });
    party.in = null;
    party.looks.clear();
    party.roster = null;
    party.team = null;
  }
  renderParty();
}
function dropMembers() {
  if (party.link) leaveSquad();
  for (const m of party.members) presence?.send("party-leave", { to: m });
  party.members.clear(); party.invited.clear(); party.looks.clear(); party.room = null; party.sentRoom = null;
  renderParty();
}
/* Once our match is up, the party is told its room (and again if we move
   to another one); back in the menu, they wait for the next. */
function partyTick() {
  if (game.net) game.net.preferTeam = myTeam();
  if (party.in) {
    // the host went offline: the party's over
    if (!presence?.nameOf(party.in.host)) { party.in = null; party.looks.clear(); party.roster = null; party.team = null; renderParty(); }
    return;
  }
  for (const m of [...party.members]) if (!presence?.nameOf(m)) { party.members.delete(m); party.looks.delete(m); }
  // the other leader went offline: back to our own squad
  if (party.link && !presence?.nameOf(party.link.leader)) { party.link = null; party.team = null; sentSig = ""; }
  sendRosters();
  if (!party.members.size && !party.link) { if (party.room && !party.invited.size) party.room = null; renderParty(); return; }
  const room = playing() && game.net?.connected ? game.net.room : null;
  if (!room) { party.sentRoom = null; renderParty(); return; }
  if (room === party.sentRoom) return;
  party.sentRoom = room;
  for (const m of goMessages(room)) presence.send("party-go", m);
  renderParty();
}
/* Where our match is, for everyone who follows us into it: our members on
   our side; the joined squad's leader on theirs (it brings its own
   members), when we're the one who starts. */
function goMessages(room) {
  const go = { room, mode: game.modeId, map: game.loadedMapId || null }, ours = myTeam();
  const out = [...party.members].map((m) => ({ to: m, ...go, team: ours }));
  if (party.link?.lead) out.push({ to: party.link.leader, ...go, team: party.link.mode === "versus" ? "ghost" : "phantom" });
  return out;
}
function onPartyJoin(d, from) {
  if (d.to !== viewerId() || !party.invited.has(from)) return;
  // full (more invites went out than there were pads): they're told, and
  // drop back out of the party
  if (!party.members.has(from) && party.members.size >= PARTY_SIZE - 1) { party.invited.delete(from); presence?.send("party-leave", { to: from }); return; }
  party.members.add(from);
  party.looks.set(from, cleanLook(d.look));
  // our next match is the party's room (lobby.js reads the box on input)
  if (!playing() && game.els.room) {
    game.els.room.value = party.room;
    game.els.room.dispatchEvent(new Event("input"));
  }
  renderParty();
  partyTick();
}
function onPartyGo(d, from) {
  // from our leader, or (a joined squad's other leader) from the one who starts
  const ours = party.in && from === party.in.host, linked = !party.in && party.link && !party.link.lead && from === party.link.leader;
  if (d.to !== viewerId() || !(ours || linked) || !ROOM.test(String(d.room)) || !MODES[d.mode]) return;
  party.team = TEAM_IDS.includes(d.team) ? d.team : null;
  if (game.net) game.net.preferTeam = party.team;
  if (playing() && game.net?.room === d.room) return;
  if (d.map != null && !MAPS[d.map]) d.map = null;
  join(d);
}
function onPartyLeave(d, from) {
  if (d.to !== viewerId()) return;
  if (party.in && from === party.in.host) { party.in = null; party.looks.clear(); renderParty(); return; }
  party.members.delete(from);
  party.looks.delete(from);
  renderParty();
}

/* The party, under the Who's Online column: who's in it, and for a
   member, who we're waiting on and a Leave. */
let partyEl = null;
function renderParty() {
  if (!partyEl) {
    partyEl = document.createElement("div");
    partyEl.className = "to-party";
    partyEl.setAttribute("role", "status");
    partyEl.setAttribute("aria-live", "polite");
    partyEl.innerHTML = `<p class="to-party-text"></p><button type="button" class="tf-btn tf-btn--secondary to-party-leave">Leave party</button>`;
    partyEl.querySelector(".to-party-leave").addEventListener("click", () => { if (party.in) leaveParty(); else if (!party.members.size && party.link) leaveSquad(); else dropMembers(); });
  }
  const list = document.querySelector(".to-bo2-party-others");
  if (list && partyEl.parentNode !== list.parentNode) list.before(partyEl);
  const names = [...party.members].map((m) => presence?.nameOf(m)?.name).filter(Boolean);
  const text = partyEl.querySelector(".to-party-text");
  const leave = partyEl.querySelector(".to-party-leave");
  if (party.in) {
    const host = presence?.nameOf(party.in.host)?.name || "the host";
    text.textContent = `In ${host}'s party. Waiting for them to start a match.`;
    leave.textContent = "Leave party";
  } else if (names.length) {
    text.textContent = `Your party: ${names.join(", ")}. Start any match and they come with you.`;
    leave.textContent = "Disband";
  } else if (party.link) {
    const other = nameOf(party.link.leader) || "another squad";
    text.textContent = party.link.lead ? `Joined up with ${other}'s squad. Start any match and they come with you.` : `Joined up with ${other}'s squad. Waiting for them to start a match.`;
    leave.textContent = "Split squads";
  }
  text.title = text.textContent;   // (the lobby shows it on one line)
  partyEl.hidden = playing() || !(party.in || names.length || party.link);
  dispatchEvent(new Event("trollforces:party"));
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
  accept(d);
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
  p.append(b, d.text ? d.text : d.squad ? `'s squad (${d.size}) wants to join up with yours. They'll start the match.`
    : d.party ? ` invited you to their party. They'll pick the match.` : ` invited you to ${mode}${map ? ` on ${map}` : ""}.`);
  // (a request, not an invite: Accept, J to accept)
  const yes = card.querySelector('[data-act="join"]');
  yes.textContent = d.onAccept ? "Accept" : "Join";
  card.querySelector(".to-invite-key").lastChild.textContent = d.onAccept ? " to accept" : " to join";
  yes.onclick = () => { hide(); accept(d); };
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

/* Join pressed: a match's invite goes into it; a party's into the party,
   back to the menu if we're in a match, to wait for the host. */
async function accept(d) {
  if (d.onAccept) { d.onAccept(); return; }
  if (d.squad) { acceptSquad(d.from); return; }
  if (!d.party) { join(d); return; }
  if (playing()) {
    game.els.quitBtn?.click();
    for (let i = 0; i < 40 && playing(); i++) await new Promise((r) => setTimeout(r, 50));
  }
  if (party.members.size) dropMembers();
  party.in = { host: d.from, room: d.room, mode: d.mode };
  party.looks.clear();
  party.looks.set(d.from, cleanLook(d.look));
  presence.send("party-join", { to: d.from, look: myLook() });
  renderParty();
}

/* Troll Radio's squad sync (sound/radio-sync.js): who leads our party,
   who's in the one we lead, and the invite card for a member's request. */
export const partyLeader = () => party.in?.host || null;
export const partyHas = (v) => party.members.has(v);
export function showRequest(from, text, onAccept) {
  const who = presence?.nameOf(from);
  if (!who) return false;
  show(who, { from, text, onAccept });
  return true;
}

function onInvite(d, from) {
  if (d.to !== viewerId() || !ROOM.test(String(d.room)) || !MODES[d.mode]) return;
  if (d.map != null && !MAPS[d.map]) d.map = null;
  const who = presence.nameOf(from);
  if (!who) return;
  const t = performance.now();
  if (t - (lastFrom.get(from) || -1e9) < INVITE.again * 1000) return;
  lastFrom.set(from, t);
  // already in that room or that party: nothing to join
  if (playing() && game.net?.room === d.room) return;
  if (d.party && party.in?.host === from) return;
  show(who, { ...d, party: !!d.party, from });
}

export function initInvites(p) {
  presence = p;
  p.on?.("invite", onInvite);
  p.on?.("party-join", onPartyJoin);
  p.on?.("party-go", onPartyGo);
  p.on?.("party-leave", onPartyLeave);
  p.on?.("party-look", onPartyLook);
  p.on?.("party-roster", onPartyRoster);
  p.on?.("squad-req", onSquadReq);
  p.on?.("squad-ok", onSquadOk);
  p.on?.("squad-roster", onSquadRoster);
  p.on?.("squad-leave", onSquadLeave);
  setInterval(partyTick, 1000);
  // headless tests (tools/troll-ops-fn-stage-test.mjs): a member joins with
  // a look, as if their party-join came in (the presence channel is offline there)
  if (/[?&]tohooks=1/.test(location.search)) window.__toInvites = {
    fakeMember(viewer, name, look) {
      const real = presence;
      presence = { ...real, live: true, nameOf: (v) => (v === viewer ? { name } : real?.nameOf?.(v)), send() {} };
      party.invited.add(viewer);
      onPartyJoin({ to: viewerId(), look }, viewer);
    },
    view: () => partyView(),
    // a squad joined up with ours, as if its leader had said yes (theirs:
    // [{ viewer, name, look }], their leader first); and what we'd send
    fakeSquad(theirs, { lead = true } = {}) {
      const real = presence, names = new Map(theirs.map((t) => [t.viewer, t.name])), sent = [];
      presence = { ...real, live: true, nameOf: (v) => (names.has(v) ? { name: names.get(v) } : real?.nameOf?.(v)), send: (t, d) => sent.push({ t, ...d }) };
      party.askedTo = lead ? theirs[0].viewer : null;
      if (lead) onSquadOk({ to: viewerId(), squad: theirs.map((t) => ({ v: t.viewer, look: t.look })) }, theirs[0].viewer);
      else { acceptSquad(theirs[0].viewer); onSquadRoster({ to: viewerId(), squad: theirs.map((t) => ({ v: t.viewer, look: t.look })), mode: "together" }, theirs[0].viewer); }
      return sent;
    },
    setSquadName,
    goFor: (room = "SQD1") => ({ go: goMessages(room), mine: myTeam() }),   // what a started match sends
    setSquadMode, leaveSquad,
  };
}
