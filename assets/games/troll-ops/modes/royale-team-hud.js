// Troll Forces — Troll Royale in teams, phase 2 (docs/ROYALE-SQUADS.md):
// where your team is. A marker over each teammate (through walls, how far
// off, held to the screen's edge when they're behind you or off it), and
// the team panel on the left: each teammate's name and health, or out. The
// minimap already draws them (core/minimap.js: a teammate is friendly).
//
// Teammates are the peers on our side (royale-squads.js: net.team is the
// squad); on the bot host its bots ride the peer map too.
//
// The squad leader (docs/ROYALE-EXIT.md, phase 4: "an indication of where
// the squad leader is at all times, unless the squad leader is dead"):
// their marker wears a gold crown and LEADER, from the plane to the end,
// with an arrow and how far at the screen's edge; the crown flashes red
// while they're down and goes when they're out; their row heads the panel
// ("You lead" when it's you); a crown on the minimap (core/minimap.js reads
// game.teamLeader). Nothing new on the wire: the leader is the squad's
// first human to join (the party leader starts the match, the rest follow
// its invite; royale-squads.js squadSeats seats them in that order, so the
// leader is also the front of the file), an all-bot squad's its lowest id.
// Settled as the squad gets up for the ramp, and it never passes on.

import { game } from "../core/state.js?v=st1";
import * as THREE from "three";
import { squadSize } from "./royale-squads.js?v=sq1-wb1-mt2-hb4";

const HEAD = 2.15;          // the marker's height over their feet (m)
const OVER_TAG = 2.42;      // ...over their own name tag when it shows (remote-players.js: 2.15, 0.38 tall)
const EDGE = 28;            // px from the screen's edge: past it, a marker's held on the ring
const RING_X = 230, RING_Y = 100;   // the ring a held marker rides: inset from the sides, the top and bottom (px)
const v = new THREE.Vector3(), w = new THREE.Vector3();
let marks = null, panel = null, myRow = null;
const rows = new Map();     // id -> { mark, row }
let leader = null;          // the squad leader's net id, once picked (squadLeader)
const CROWN = `<svg class="to-crown" viewBox="0 0 16 12" aria-hidden="true"><path d="M1 3.2 4.6 6 8 1l3.4 5L15 3.2 13.6 11H2.4z"/></svg>`;

/* Our squad's leader (see the top): its net id, us included, or null. */
export function squadLeader() {
  const mine = game.net?.team;
  if (!mine || squadSize() < 2) return (leader = null);
  if (leader) return leader;
  const humans = [], bots = [];
  if (game.net.id) humans.push({ id: game.net.id, since: game.net.since || 0 });
  for (const rp of game.remotes.byId.values()) {
    if (rp.team !== mine) continue;
    if (game.isBotPeer(rp.peer)) bots.push({ id: rp.netId, since: 0 });
    else humans.push({ id: rp.netId, since: rp.peer.since || 0 });
  }
  const by = (a, b) => (a.since - b.since) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const pick = humans.sort(by)[0] || bots.sort(by)[0];
  return pick?.id || null;
}

/* Our teammates, us left out: { id, name, hp, alive, pos, tag (their own
   name tag shows: the marker stands over it, without the name) }. */
export function teammates() {
  const mine = game.net?.team, out = [];
  if (!mine || squadSize() < 2) return out;
  for (const rp of game.remotes.byId.values()) {
    if (rp.team !== mine || rp.netId === game.net.id) continue;
    // (aboard, the plane carries them: where their body's drawn)
    const pos = rp.rig?.root.visible && (rp.drop & 3) === 1 ? rp.rig.root.getWorldPosition(new THREE.Vector3()) : rp.pos;
    out.push({ id: rp.netId, name: rp.peer.name || "operator", hp: Math.max(0, Math.round(rp.peer.hp ?? 100)), alive: rp.alive, pos, tag: !!rp.tag?.visible && !rp.farHidden, down: rp.peer.downed === 1 });
  }
  const lead = squadLeader();
  for (const t of out) t.leader = t.id === lead;
  return out.sort((a, b) => (b.leader - a.leader) || (a.name < b.name ? -1 : 1));
}

function build() {
  marks = document.createElement("div");
  marks.className = "to-team-marks";
  marks.setAttribute("aria-hidden", "true");
  panel = document.createElement("div");
  panel.className = "to-team-panel";
  panel.setAttribute("role", "list");
  panel.setAttribute("aria-label", "Your team");
  myRow = document.createElement("div");
  myRow.className = "to-team-row to-team-me is-leader";
  myRow.setAttribute("role", "listitem");
  myRow.innerHTML = `<b>${CROWN}You lead</b>`;
  panel.append(myRow);
  document.body.append(marks, panel);
}

/* Once a frame while Royale in teams is up (royale.js updateRoyale); `settle`
   once everyone's in (the leader's kept from then on). */
export function updateTeamHud(show = true, settle = true) {
  const list = show ? teammates() : [];
  const lead = list.length ? squadLeader() : null;
  if (settle && lead) leader = lead;
  game.teamLeader = lead;
  if (!list.length && !marks) return;
  if (!marks) build();
  marks.hidden = panel.hidden = !list.length;
  const seen = new Set();
  const cam = game.camera, W = innerWidth, H = innerHeight;
  const me = cam.getWorldPosition(w);
  const iLead = !!lead && lead === game.net.id && game.player.alive;
  myRow.hidden = !iLead;
  myRow.classList.toggle("is-down", !!iLead && !!game.player.downed);
  for (const t of list) {
    seen.add(t.id);
    let e = rows.get(t.id);
    if (!e) {
      const mark = document.createElement("div");
      mark.className = "to-team-mark";
      mark.innerHTML = `<u></u>${CROWN}<i></i><b></b><em>LEADER</em><small></small>`;
      const row = document.createElement("div");
      row.className = "to-team-row";
      row.setAttribute("role", "listitem");
      row.innerHTML = `<b></b><span class="to-team-hp"><span></span></span><small></small>`;
      marks.append(mark);
      panel.append(row);
      rows.set(t.id, e = { mark, row, key: "" });
    }
    if (e.leader !== t.leader) {
      e.leader = t.leader;
      e.mark.classList.toggle("is-leader", t.leader);
      e.row.classList.toggle("is-leader", t.leader);
      e.key = "";
      if (t.leader) panel.insertBefore(e.row, myRow.nextSibling);   // the leader's row heads the panel
    }
    e.mark.classList.toggle("is-down", t.alive && t.down);
    // the panel: name, health, or out
    const key = `${t.name}|${t.alive ? (t.down ? "down" : t.hp) : "out"}`;
    if (key !== e.key) {
      e.key = key;
      e.row.querySelector("b").innerHTML = (t.leader ? CROWN : "") + esc(t.name);
      e.row.querySelector(".to-team-hp > span").style.width = `${t.alive && !t.down ? t.hp : 0}%`;
      e.row.querySelector("small").textContent = !t.alive ? "Out" : t.down ? "Down" : `${t.hp}`;
      e.row.classList.toggle("is-down", t.alive && t.down);
      e.row.classList.toggle("is-out", !t.alive);
      e.row.classList.toggle("is-low", t.alive && t.hp <= 30);
      e.row.setAttribute("aria-label", (t.leader ? "Squad leader, " : "") + (!t.alive ? `${t.name}, out` : t.down ? `${t.name}, down` : `${t.name}, ${t.hp} health`));
      e.mark.querySelector("b").textContent = t.name;
    }
    // the marker: over their head, or held to the edge toward them
    e.mark.hidden = !t.alive;
    if (!t.alive) continue;
    e.mark.classList.toggle("has-tag", t.tag);
    v.set(t.pos.x, (t.pos.y || 0) + (t.tag ? OVER_TAG : HEAD), t.pos.z).project(cam);
    let x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
    const behind = v.z > 1;
    const held = behind || x < EDGE || x > W - EDGE || y < EDGE || y > H - EDGE;
    if (held) {
      // Off the screen or behind you: on a ring inset from the edge (clear
      // of the HUD's corners, the team panel and the plane's letterbox), the
      // way toward them, an arrow pointing on. Behind: along the bottom.
      const dx = behind ? W / 2 - x : x - W / 2, dy = behind ? H : y - H / 2;
      const ang = Math.atan2(dy, dx), c = Math.cos(ang), sn = Math.sin(ang);
      const a = Math.max(60, W / 2 - RING_X), b = Math.max(60, H / 2 - RING_Y);
      const k = 1 / Math.hypot(c / a, sn / b);
      x = W / 2 + c * k;
      y = H / 2 + sn * k;
      e.mark.style.setProperty("--to-arrow", `${ang.toFixed(2)}rad`);
    }
    e.mark.classList.toggle("is-held", held);
    e.mark.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
    const m = Math.round(Math.hypot(t.pos.x - me.x, t.pos.z - me.z));
    const ms = `${m} m`;
    const small = e.mark.querySelector("small");
    if (small.textContent !== ms) small.textContent = ms;
  }
  for (const [id, e] of rows) if (!seen.has(id)) { e.mark.remove(); e.row.remove(); rows.delete(id); }
}
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* The match is over (royale.js teardownRoyale). */
export function clearTeamHud() {
  for (const e of rows.values()) { e.mark.remove(); e.row.remove(); }
  rows.clear();
  leader = game.teamLeader = null;
  if (marks) marks.hidden = panel.hidden = true;
}

/* Labs and tests (tools/troll-ops-royale-leader-test.mjs): hand the crown
   to `id`, as if they'd joined first. */
export function pinSquadLeader(id) { leader = id; }
