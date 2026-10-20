// Troll Forces: who's online and the servers you can join (user,
// 2026-10-14: "allow live sync to see who is online in the main menu,
// whether it is a guest or another user", "allow users to join any servers
// that are already existing; by default it should be public servers").
//
// It rides the site-wide presence channel (assets/js/site-presence.js),
// the one behind the "N Online" count: every Troll Forces tab says what it's
// doing there (setActivity: menu, or the mode, map and room it's in), so the
// menu can list everyone online, guests and accounts, and group the ones
// in a public room into servers. A private code is never put on the wire
// as joinable: those players show as "In a private match".
//
// Public rooms are the quickplay ones (QTDM, QSOC, the Zombies hub QZHB and
// their overflow shards) and a Zombies run launched from one of the public
// hub's map pads (modes/zombies/hub.js publicRuns). Joining one from the
// list is a typed code on that room, the mode and map set to its own; a
// Zombies run already on lets you in when its round ends (coop.js).

import { game } from "../core/state.js?v=st1";
import { MODES } from "../modes/modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d-wb1-ar1-ar2-zh1-fl1-or1-ffa1-dom1-gf1-tg1";
import { MAPS } from "../maps/maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1b7b7dc1c2f1m1u-tc3-nc1-cd1-sh1-sg1-bw1-cw1-zr10-zh1-hr2-zp1-jb1-nh1-pi1-sr1-hl1-pf1-ub1-uw1-ug5-or1-bw2-bt1-wf1-wf2-zf1-bp1-is1-gf1-tg1-tcs1";
import { publicRuns } from "../modes/zombies/hub.js?v=zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-sv1-dj2-bf1-pd1-jb1-pl2-nh1-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-bp1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1";

const TICK_MS = 2000;   // how often our activity is re-read (sent only when it changes)

/* The public rooms everyone gets by default, in the order the list shows
   them when nobody is in them yet. */
const DEFAULT_SERVERS = ["tdm", "ffa", "dom", "koth", "snd", "oitc", "gungame", "infection", "umb", "royale", "social", "zhub"];

/* A quickplay room, or a public hub run. */
export function isPublicRoom(room) {
  if (!room) return false;
  const bases = Object.values(game.QUICKPLAY_BASE || {});
  if (bases.some((b) => room === b || (room.startsWith(b) && /^[2-9]$/.test(room.slice(b.length))))) return true;
  return publicRuns.has(room);
}

/* What this tab is doing, for the presence channel. */
function activity() {
  const s = game.gameState;
  if (s !== "playing" && s !== "paused") return { game: "tf", state: "menu" };
  const mode = game.currentMode();
  const room = game.net?.connected ? game.net.room : null;
  const map = game.loadedMapId || null;
  return {
    game: "tf", state: game.isZombies() ? "zombies" : "match",
    mode: game.modeId, modeName: mode.name, map, mapName: MAPS[map]?.name || map,
    room, pub: isPublicRoom(room),
    wave: game.isZombies() ? game.zdir?.round || 0 : 0,
  };
}

let presence = null;
export function startOnline(p) {
  presence = p;
  const tick = () => { try { presence.setActivity(activity()); } catch { /* the menu still works */ } };
  tick();
  setInterval(tick, TICK_MS);
}

/* One line on what someone is up to, for the Who's Online list. */
export function describe(a) {
  if (!a) return "On trollrunner.net";
  if (a.game !== "tf") return "On trollrunner.net";
  if (a.state === "menu") return "In the Troll Warfare menu";
  const where = a.mapName ? ` on ${a.mapName}` : "";
  const wave = a.state === "zombies" && a.wave ? ` · round ${a.wave}` : "";
  if (!a.room) return `Playing ${a.modeName || "solo"}${where}${wave} (solo)`;
  if (!a.pub) return `In a private match`;
  return `Playing ${a.modeName}${where}${wave}`;
}

/* Everyone online, accounts first, each with what they're doing. */
export function onlinePlayers(roster) {
  const out = [];
  for (const m of roster?.members || []) out.push({ key: m.userId, name: m.username, guest: false, level: m.level, userId: m.userId, viewerId: m.viewerId, activity: m.activity });
  for (const g of roster?.guests || []) out.push({ key: g.viewerId, name: g.label, guest: true, viewerId: g.viewerId, activity: g.activity });
  return out;
}

/* The public servers: every public room someone is in, busiest first, then
   the default public room of each mode nobody is in yet (blank map: the
   first one in decides it). */
export function serverList(roster) {
  const rooms = new Map();
  for (const p of onlinePlayers(roster)) {
    const a = p.activity;
    if (!a || a.game !== "tf" || !a.pub || !a.room || !MODES[a.mode]) continue;
    let s = rooms.get(a.room);
    if (!s) rooms.set(a.room, s = { room: a.room, mode: a.mode, modeName: a.modeName || MODES[a.mode].name, map: a.map, mapName: a.mapName, wave: 0, players: [] });
    s.players.push(p.name);
    s.wave = Math.max(s.wave, a.wave || 0);
  }
  const live = [...rooms.values()].sort((x, y) => y.players.length - x.players.length);
  const base = game.QUICKPLAY_BASE || {};
  for (const id of DEFAULT_SERVERS) {
    const room = base[id];
    if (!room || !MODES[id] || live.some((s) => s.room === room)) continue;
    live.push({ room, mode: id, modeName: MODES[id].name, map: null, mapName: null, wave: 0, players: [] });
  }
  return live;
}

/* Into server `s` from the menu: its mode, its map, its room. `listed`
   false: a private room (an invite's), never put on the public list. */
export function joinServer(s, { listed = true } = {}) {
  if (!s || !MODES[s.mode] || game.gameState === "playing" || game.gameState === "paused") return false;
  // The lobby's own mode button, so everything it sets up for a mode is set.
  document.querySelector(`#to-lo-mode [data-mode="${s.mode}"]`)?.click();
  game.modeId = s.mode;
  game.modePicked = true;
  if (s.map && MAPS[s.map]) {
    if (MODES[s.mode].mapPool) game.loadout.poolMapId = s.map;
    // a versus map is the lobby's button (and the room's host has the last
    // word on it anyway: match-start.js followsHostMap)
    else if (!MODES[s.mode].forceMap) { const b = document.querySelector(`#to-lo-maps [data-map="${s.map}"]`); if (b && !b.disabled) b.click(); }
  }
  if (listed && !isPublicRoom(s.room)) publicRuns.add(s.room);   // a hub run: we list it too, now we're in it
  game.els.room.value = s.room;
  game.roomIsCustom = true;
  game.startGame();
  return true;
}
