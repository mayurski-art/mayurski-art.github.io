// Troll Radio, synced to the squad leader (user, 2026-10-29: "option to
// sync music with squad leader. so members can make a request to the squad
// leader and they should receive a notification similar to how they
// receive squad invite notifications").
//
// A party member (menu/invites.js: party.in) asks; the leader gets the
// invite card (Accept, J, or Not now). On yes the leader's radio tells
// each follower what it's on, over the same site-wide presence channel:
//   radio-sync-req  member -> leader   please
//   radio-sync-ok   leader -> member   yes (then radio-state follows)
//   radio-state     leader -> member   { i: track, t: seconds, p: playing, s: sent at }
//                                      on any change, and every few seconds
//   radio-sync-stop either way         done
// The follower plays the same track from the same place, re-synced when
// the leader changes track, pauses, seeks or drifts. Working your own radio
// (play, skip, a playlist row) stops following. Leaving the party ends it.
//
// The radio panel (menu/radio.js) draws it from game.radioSync.view().

import { game } from "../core/state.js?v=st1";
import { viewerId } from "../../../js/site-presence.js?v=to-bo2d-ol1-iv1-mv1-wo1-ll2";

const SYNC = {
  tick: 500,        // ms between checks of the leader's radio
  beat: 4000,       // ms between position updates while nothing changes
  drift: 1.5,       // s off the leader's position before a follower seeks
  askAgain: 20000,  // ms before a member can ask again
  lag: 3,           // s: the most of the send delay a follower makes up
};

let presence = null;
// from menu/invites.js (handed in by menu-bo2.js, which owns that import):
// our party's leader, whether a viewer's in the party we lead, the card
let partyLeader = () => null, partyHas = () => false, showRequest = () => false;
// following: the leader we follow; asked: the leader we asked (and when);
// followers: (a leader's) members who follow us
// (last*: what the followers were last told)
const sync = { following: null, asked: null, askedAt: 0, followers: new Set(), last: "", lastT: null, lastP: false, lastAt: 0, seekTo: null };

const nameOf = (v) => presence?.nameOf(v)?.name || "";
const changed = () => dispatchEvent(new Event("trollforces:radio-sync"));

/* What the leader's radio is doing, for its followers. */
function state() {
  const m = game.music;
  return { i: m.order[m.pos] ?? 0, t: Math.round(m.time * 100) / 100, p: !!m.playing, s: Date.now() };
}
function sendState(to = [...sync.followers]) {
  const st = state();
  for (const v of to) presence?.send("radio-state", { to: v, ...st });
}

/* A member: ask the leader. A line for the panel, or "". */
function request() {
  const lead = partyLeader();
  if (!presence?.live) return "Sync needs the connection to trollrunner.net.";
  if (!lead) return "Join a squad to sync with its leader.";
  if (sync.following === lead) return "";
  if (sync.asked === lead && performance.now() - sync.askedAt < SYNC.askAgain) return `Already asked ${nameOf(lead) || "your leader"}.`;
  sync.asked = lead;
  sync.askedAt = performance.now();
  presence.send("radio-sync-req", { to: lead });
  changed();
  return `Asked ${nameOf(lead) || "your leader"} to sync.`;
}

/* Stop following (tell: let the leader know). */
function stopFollowing(tell = true) {
  if (!sync.following && !sync.asked) return;
  if (tell && sync.following) presence?.send("radio-sync-stop", { to: sync.following });
  sync.following = sync.asked = null;
  sync.seekTo = null;
  changed();
}
/* A leader: let every follower go. */
function stopLeading() {
  for (const v of sync.followers) presence?.send("radio-sync-stop", { to: v });
  sync.followers.clear();
  changed();
}

function onReq(d, from) {
  if (d.to !== viewerId() || !partyHas(from)) return;
  if (sync.followers.has(from)) { presence.send("radio-sync-ok", { to: from }); sendState([from]); return; }
  showRequest(from, " wants to sync their music to your radio.", () => {
    if (!partyHas(from)) return;
    sync.followers.add(from);
    presence.send("radio-sync-ok", { to: from });
    sendState([from]);
    changed();
  });
}
function onOk(d, from) {
  if (d.to !== viewerId() || from !== partyLeader() || sync.asked !== from) return;
  sync.asked = null;
  sync.following = from;
  changed();
}
function onStop(d, from) {
  if (d.to !== viewerId()) return;
  if (sync.followers.delete(from)) { changed(); return; }
  if (sync.following === from || sync.asked === from) stopFollowing(false);
}

/* The follower's radio onto the leader's: same track, same place. */
function onState(d, from) {
  if (d.to !== viewerId() || from !== sync.following) return;
  const m = game.music, i = d.i | 0;
  if (!m.tracks[i]) return;
  const lag = Math.max(0, Math.min(SYNC.lag, (Date.now() - Number(d.s || 0)) / 1000)) || 0;
  const target = Math.max(0, Number(d.t) || 0) + (d.p ? lag : 0);
  if (m.order[m.pos] !== i) {
    if (d.p) m.playIndex(i);
    else { m.pause(); const at = m.order.indexOf(i); m.pos = at < 0 ? 0 : at; m._loadCurrent(false); }
    sync.seekTo = { t: target, at: performance.now(), p: !!d.p };
  } else if (Math.abs(m.time - target) > SYNC.drift) {
    sync.seekTo = { t: target, at: performance.now(), p: !!d.p };
  }
  if (d.p && !m.playing) m.play();
  if (!d.p && m.playing) m.pause();
  applySeek();
}
/* A seek waits for the track's length (seek() needs it). */
function applySeek() {
  const m = game.music, s = sync.seekTo;
  if (!s || !m.duration) return;
  sync.seekTo = null;
  m.seek(s.t + (s.p ? (performance.now() - s.at) / 1000 : 0));
}

/* The radio panel's own controls (menu/radio.js) say when the player
   works their radio: a follower who does stops following. */
function tookOver() {
  if (!sync.following) return;
  stopFollowing(true);
}

function tick() {
  // a follower whose leader left (or whose party's over): done
  const lead = partyLeader();
  if ((sync.following || sync.asked) && (sync.following || sync.asked) !== lead) stopFollowing(false);
  if (sync.following) applySeek();
  // a leader: drop who's left the party; tell the rest on change or beat
  for (const v of [...sync.followers]) if (!partyHas(v)) { sync.followers.delete(v); changed(); }
  if (!sync.followers.size) return;
  const st = state(), sig = `${st.i}|${st.p}`, now = performance.now();
  // a seek: the time's off from where it would have run to
  const expect = sync.lastT == null ? st.t : sync.lastT + (sync.lastP ? (now - sync.lastAt) / 1000 : 0);
  const jumped = Math.abs(st.t - expect) > SYNC.drift;
  if (sig !== sync.last || jumped || now - sync.lastAt > SYNC.beat) {
    sync.last = sig;
    sendState();
    sync.lastT = st.t; sync.lastP = st.p; sync.lastAt = now;
  }
}

/* For the radio panel: who we follow or lead, and what we can do. */
function view() {
  const lead = partyLeader();
  if (lead) {
    return { role: "member", leader: nameOf(lead) || "your squad leader", following: sync.following === lead, asked: sync.asked === lead };
  }
  if (sync.followers.size) return { role: "leader", followers: [...sync.followers].map(nameOf).filter(Boolean) };
  return { role: null };
}

export function initRadioSync(p, party) {
  presence = p;
  ({ partyLeader, partyHas, showRequest } = party);
  p.on?.("radio-sync-req", onReq);
  p.on?.("radio-sync-ok", onOk);
  p.on?.("radio-sync-stop", onStop);
  p.on?.("radio-state", onState);
  game.radioSync = { view, request, stop: () => { stopFollowing(true); stopLeading(); }, tookOver };
  setInterval(tick, SYNC.tick);
  // A new track's seek lands the moment its length is known, not at the
  // next tick: else the follower plays the song's start first (and on a
  // busy tab, a match loading, the tick runs late, seconds of it).
  game.music?.el?.addEventListener("durationchange", () => { if (sync.following) applySeek(); });
  addEventListener("trollforces:party", changed);
}
