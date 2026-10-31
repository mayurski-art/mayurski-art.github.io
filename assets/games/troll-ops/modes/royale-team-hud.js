// Troll Forces — Troll Royale in teams, phase 2 (docs/ROYALE-SQUADS.md):
// where your team is. A marker over each teammate (through walls, how far
// off, held to the screen's edge when they're behind you or off it), and
// the team panel on the left: each teammate's name and health, or out. The
// minimap already draws them (core/minimap.js: a teammate is friendly).
//
// Teammates are the peers on our side (royale-squads.js: net.team is the
// squad); on the bot host its bots ride the peer map too.

import { game } from "../core/state.js?v=st1";
import * as THREE from "three";
import { squadSize } from "./royale-squads.js?v=sq1-wb1-mt2-hb4";

const HEAD = 2.15;          // the marker's height over their feet (m)
const OVER_TAG = 2.42;      // ...over their own name tag when it shows (remote-players.js: 2.15, 0.38 tall)
const EDGE = 28;            // px from the screen's edge for one held there
const v = new THREE.Vector3();
let marks = null, panel = null;
const rows = new Map();     // id -> { mark, row }

/* Our teammates, us left out: { id, name, hp, alive, pos, tag (their own
   name tag shows: the marker stands over it, without the name) }. */
export function teammates() {
  const mine = game.net?.team, out = [];
  if (!mine || squadSize() < 2) return out;
  for (const rp of game.remotes.byId.values()) {
    if (rp.team !== mine || rp.netId === game.net.id) continue;
    out.push({ id: rp.netId, name: rp.peer.name || "operator", hp: Math.max(0, Math.round(rp.peer.hp ?? 100)), alive: rp.alive, pos: rp.pos, tag: !!rp.tag?.visible && !rp.farHidden, down: rp.peer.downed === 1 });
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : 1));
}

function build() {
  marks = document.createElement("div");
  marks.className = "to-team-marks";
  marks.setAttribute("aria-hidden", "true");
  panel = document.createElement("div");
  panel.className = "to-team-panel";
  panel.setAttribute("role", "list");
  panel.setAttribute("aria-label", "Your team");
  document.body.append(marks, panel);
}

/* Once a frame while Royale in teams is up (royale.js updateRoyale). */
export function updateTeamHud(show = true) {
  const list = show ? teammates() : [];
  if (!list.length && !marks) return;
  if (!marks) build();
  marks.hidden = panel.hidden = !list.length;
  const seen = new Set();
  const cam = game.camera, W = innerWidth, H = innerHeight;
  const me = game.player.alive ? game.move.pos : cam.position;
  for (const t of list) {
    seen.add(t.id);
    let e = rows.get(t.id);
    if (!e) {
      const mark = document.createElement("div");
      mark.className = "to-team-mark";
      mark.innerHTML = `<i></i><b></b><small></small>`;
      const row = document.createElement("div");
      row.className = "to-team-row";
      row.setAttribute("role", "listitem");
      row.innerHTML = `<b></b><span class="to-team-hp"><span></span></span><small></small>`;
      marks.append(mark);
      panel.append(row);
      rows.set(t.id, e = { mark, row, key: "" });
    }
    // the panel: name, health, or out
    const key = `${t.name}|${t.alive ? (t.down ? "down" : t.hp) : "out"}`;
    if (key !== e.key) {
      e.key = key;
      e.row.querySelector("b").textContent = t.name;
      e.row.querySelector(".to-team-hp > span").style.width = `${t.alive && !t.down ? t.hp : 0}%`;
      e.row.querySelector("small").textContent = !t.alive ? "Out" : t.down ? "Down" : `${t.hp}`;
      e.row.classList.toggle("is-down", t.alive && t.down);
      e.row.classList.toggle("is-out", !t.alive);
      e.row.classList.toggle("is-low", t.alive && t.hp <= 30);
      e.row.setAttribute("aria-label", !t.alive ? `${t.name}, out` : t.down ? `${t.name}, down` : `${t.name}, ${t.hp} health`);
      e.mark.querySelector("b").textContent = t.name;
    }
    // the marker: over their head, or held to the edge toward them
    e.mark.hidden = !t.alive;
    if (!t.alive) continue;
    e.mark.classList.toggle("has-tag", t.tag);
    v.set(t.pos.x, (t.pos.y || 0) + (t.tag ? OVER_TAG : HEAD), t.pos.z).project(cam);
    let x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
    const behind = v.z > 1;
    if (behind) { x = W - x; y = H - EDGE; }
    const held = behind || x < EDGE || x > W - EDGE || y < EDGE || y > H - EDGE;
    x = Math.min(W - EDGE, Math.max(EDGE, x));
    y = Math.min(H - EDGE, Math.max(EDGE, y));
    e.mark.classList.toggle("is-held", held);
    e.mark.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
    const m = Math.round(Math.hypot(t.pos.x - me.x, t.pos.z - me.z));
    const ms = `${m} m`;
    const small = e.mark.querySelector("small");
    if (small.textContent !== ms) small.textContent = ms;
  }
  for (const [id, e] of rows) if (!seen.has(id)) { e.mark.remove(); e.row.remove(); rows.delete(id); }
}

/* The match is over (royale.js teardownRoyale). */
export function clearTeamHud() {
  for (const e of rows.values()) { e.mark.remove(); e.row.remove(); }
  rows.clear();
  if (marks) marks.hidden = panel.hidden = true;
}
