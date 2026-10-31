// Troll Forces — Troll Royale in teams: Solo, Duo, Trio, Squad (user,
// 2026-10-30; docs/ROYALE-SQUADS.md). Phase 1: the size, the squads, last
// team standing.
//
// A team is a side of its own: net.team is the squad's id (a party's, from
// its leader: menu/invites.js room.partyLead), bots carry theirs as
// Bot.team ("b0", "b1", ... and the seats a party leaves empty take the
// party's), so everything the team modes already check (no friendly fire,
// bots' targets, the minimap, team chat) keeps teammates apart from
// everyone else. The modes themselves are modes.js royale_duo/trio/squad.

import { game, room } from "../core/state.js?v=st1";
import { MODES } from "./modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d-wb1-ar1-ar2-zh1-fl1-or1-ffa1-dom1-gf1-tg1-kb9-sp1-gb2-tb1-dm1-tfb8-ug1-ugm1-hgb8-hgb9-mt2";

/* The Royale card's choices, smallest first. */
export const SQUAD_SIZES = [
  { n: 1, mode: "royale", label: "Solo" },
  { n: 2, mode: "royale_duo", label: "Duo" },
  { n: 3, mode: "royale_trio", label: "Trio" },
  { n: 4, mode: "royale_squad", label: "Squad" },
];

/* The size you picked (kept), and your party's (menu/invites.js): the
   Royale you deploy into is the bigger, so a party of three never lands
   in Duos. */
const SIZE_KEY = "trollops:royale-size";
export function sizePref() {
  try { return Math.min(4, Math.max(1, Number(localStorage.getItem(SIZE_KEY)) || 1)); } catch { return 1; }
}
export function setSizePref(n) { try { localStorage.setItem(SIZE_KEY, String(n)); } catch {} }
export const partySize = () => room.partySize?.() || 1;
export const royaleModeFor = (n = sizePref()) => SQUAD_SIZES[Math.min(4, Math.max(n, partySize())) - 1].mode;

/* The size the current mode plays (1: solo or not Royale). */
export const squadSize = (mode = game.currentMode?.()) => mode?.squad || 1;
/* A Royale mode, any size. */
export const isRoyaleMode = (id) => !!MODES[id]?.royale && (id === "royale" || MODES[id]?.base === "royale");

/* Our squad's id: short, the same on every tab of the party (its leader's
   viewer id, hashed), and never a team modes name. */
export function squadId(key = room.partyLead?.() || game.net?.id || "solo") {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return "s" + (h >>> 0).toString(36);
}

/* On joining the room (match-start.js): our side is our squad. */
export function joinSquad() { game.net.setTeam(squadId()); }

/* The humans in the room by squad, us included: { squadId: count }. The bot
   host tops each up to the size (bots.js fillSquads). */
export function humanSquads() {
  const out = {};
  const add = (t) => { if (t) out[t] = (out[t] || 0) + 1; };
  add(game.net.team);
  for (const p of game.net.peers.values()) if (!game.isBotPeer(p)) add(p.team);
  return out;
}

/* How many teams are still in it, out of a royaleAliveList(). */
export const teamsAlive = (alive) => new Set(alive.map((a) => a.team || a.id)).size;
/* Anyone on our team still standing (us included)? */
export const myTeamAlive = (alive) => alive.some((a) => a.me || (a.team && a.team === game.net.team));

/* Phase 4: the drop together. Seats in the squadron, as slots (Squadron.seatOf:
   `per` to a plane): each party's squad from the start of a plane of its
   own, so a party never splits across two planes; its bots right after
   it; the bot squads in the seats left. `humans` [{ id, team }] in join
   order (every client has the same list); `bots` [{ id, team }] (the
   host's). Returns Map id -> slot. */
export function squadSeats(humans, bots, per, count) {
  const slots = new Map(), taken = new Set();
  const put = (id, s) => { while (taken.has(s)) s++; slots.set(id, s); taken.add(s); return s + 1; };
  [...new Set(humans.map((h) => h.team))].forEach((team, k) => {
    let s = (k % count) * per;
    for (const h of humans) if (h.team === team) s = put(h.id, s);
    for (const b of bots) if (b.team === team) s = put(b.id, s);
  });
  let s = 0;
  for (const b of bots) if (!slots.has(b.id)) s = put(b.id, s);
  return slots;
}

/* Phase 4: bot squads stick together. A bot more than `near` from its
   squad's lead (a human teammate if there is one, else the bot with the
   lowest id) heads back to them when nobody's in sight; past `far`, that
   comes first. royale.js royaleBotObjective asks after the zone. */
export const FOLLOW = { near: 15, far: 40 };
export function botSquadGoal(b) {
  if (squadSize() < 2 || b.seenId || b.downed) return null;
  let lead = null;
  const take = (id, pos, human) => {
    if (!lead || (human && !lead.human) || (human === lead.human && id < lead.id)) lead = { id, pos, human };
  };
  if (game.player.alive && !game.player.downed && game.net.team === b.team) take(game.net.id, game.move.pos, true);
  for (const rp of game.remotes.byId.values()) {
    if (rp.team !== b.team || !rp.alive || rp.peer.downed === 1 || rp.netId === b.id) continue;
    const bot = game.bots.byId(rp.netId);
    take(rp.netId, bot ? bot.pos : rp.pos, !game.isBotPeer(rp.peer));
  }
  if (!lead || (!lead.human && b.id < lead.id)) return null;   // nobody, or it leads
  const d = Math.hypot(lead.pos.x - b.pos.x, lead.pos.z - b.pos.z);
  if (d < FOLLOW.near) return null;
  return { id: `squad-${lead.id}`, x: lead.pos.x, z: lead.pos.z, radius: FOLLOW.near * 0.5, urgent: d > FOLLOW.far };
}
