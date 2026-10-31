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
import { MODES } from "../modes/modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d-wb1-ar1-ar2-zh1-fl1-or1-ffa1-dom1-gf1-tg1-kb9-sp1-gb2-tb1-dm1-tfb8-ug1-ugm1-hgb8-hgb9-mt2-hb4";
import { MAPS } from "../maps/maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1b7b7dc1c2f1m1u-tc3-nc1-cd1-sh1-sg1-bw1-cw1-zr10-zh1-hr2-zp1-jb1-nh1-pi1-sr1-hl1-pf1-ub1-uw1-ug5-or1-bw2-bt1-wf1-wf2-zf1-bp1-is1-gf1-tg1-tcs1-kb0-kb1-kb2-kb3-cl1-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-tcs2-mg1-kb12-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb3-jb6-sp1-hh1-yb1-kbt1-gb1-gb3-rh1-gb4-tb1-gb5-gb7-gb8-gb9-tb2-bl1-kbb1-kbb2-dj2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-tfp1-tfp2-tfp3-tfp4-tfp7-tfb8-tfs1-ss1-ta1-ss2-ss3-ta2-tfm2-rfx1-rm1-kzf1-hgb1-hgb2-hgb3-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-hgb5-hgb6-hgb8-hgb9-tw1-op1-hgo1-wb1-mt2-hb4";
import { publicRuns } from "../modes/zombies/hub.js?v=zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-sv1-dj2-bf1-pd1-jb1-pl2-nh1-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-bp1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-rm1-kzf1-fp2-lk1-hgb1-hgb2-mrg1-hgb3-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1-nft33-nfh1-nfh5-ll1";

const TICK_MS = 2000;   // how often our activity is re-read (sent only when it changes)

/* The public rooms everyone gets by default, in the order the list shows
   them when nobody is in them yet. */
const DEFAULT_SERVERS = ["tdm", "ffa", "dom", "koth", "snd", "oitc", "gungame", "infection", "umb", "royale", "royale_duo", "royale_trio", "royale_squad", "social", "zhub"];

/* A quickplay room, or a public hub run. */
export function isPublicRoom(room) {
  if (!room) return false;
  const bases = Object.values(game.QUICKPLAY_BASE || {});
  if (bases.some((b) => room === b || (room.startsWith(b) && /^[2-9]$/.test(room.slice(b.length))))) return true;
  return publicRuns.has(room);
}

/* Friends can join you mid-match (user, 2026-10-31: "make it so that
   friends can join in the middle of their other friends matches. unless
   they have their settings changed to not allow others to join"). On
   unless turned off in Options, kept on the account (net/cloud-save.js).
   Off, a private match's code stays off the wire altogether: it shows as
   "(private)" and nobody gets a Join. A public room is open to all anyway. */
const FRIENDS_JOIN_KEY = "trollops:friends-join";   // "off" when turned off
export function friendsCanJoin() { try { return localStorage.getItem(FRIENDS_JOIN_KEY) !== "off"; } catch { return true; } }
export function setFriendsCanJoin(on) {
  try { localStorage.setItem(FRIENDS_JOIN_KEY, on ? "on" : "off"); } catch {}
  tick();
}

/* What this tab is doing, for the presence channel. In the Public Match
   lobby, its vote and readiness (menu/map-vote.js, set by menu-bo2.js). */
let lobbyActivity = () => null;
export function setLobbyActivity(fn) { lobbyActivity = fn; }
function activity() {
  const s = game.gameState;
  if (s !== "playing" && s !== "paused") return lobbyActivity() || { game: "tf", state: "menu" };
  const mode = game.currentMode();
  const room = game.net?.connected ? game.net.room : null;
  const map = game.loadedMapId || null;
  const pub = isPublicRoom(room), open = !!room && (pub || friendsCanJoin());
  return {
    game: "tf", state: game.isZombies() ? "zombies" : "match",
    mode: game.modeId, modeName: mode.name, map, mapName: MAPS[map]?.name || map,
    room: open ? room : null, pub, open, priv: !!room && !open,
    wave: game.isZombies() ? game.zdir?.round || 0 : 0,
  };
}

let presence = null;
const tick = () => { try { presence?.setActivity(activity()); } catch { /* the menu still works */ } };
export function startOnline(p) {
  presence = p;
  tick();
  setInterval(tick, TICK_MS);
}
/* Now, not on the next tick: a vote or a ready shows up straight away. */
export const pushActivity = tick;

/* Where on the network a tab outside Troll Forces is (user, 2026-10-25:
   "see what other players are doing ... playing a certain game or even on
   a different website like trolltruths.com"), from the host and page every
   presence client sends. */
const SITES = {
  "trolltruths.com": "On trolltruths.com", "terminal.trollrunner.net": "On trolltruths.com",
  "maps.trollrunner.net": "On Troll Maps", "stickers.trollrunner.net": "Looking at the stickers",
};
const PAGES = [
  [/troll-ops|^\/tf\//, "In Troll Forces"],
  [/troll-kombat/, "Playing Troll Kombat"],
  [/troll-man/, "Playing Troll Man"],
  [/sabers/, "Playing Grin Sabers"],
  [/trollus/, "Playing Troll Us"],
  [/world/, "On Trollface Island"],
  [/games/, "In the arcade"],
  [/stickers/, "Looking at the stickers"],
  [/maps/, "On Troll Maps"],
  [/pfp/, "In PFP Studio"],
  [/chat/, "In TROLLCHAT"],
  [/desktop/, "On the desktop"],
];
function placeOf(host, path) {
  const h = (host || "").replace(/^www\./, "");
  if (SITES[h]) return SITES[h];
  if (h && !/(^|\.)trollrunner\.net$|github\.io$|^localhost$|^127\.0\.0\.1$/.test(h)) return `On ${h}`;
  const p = (path || "/").toLowerCase();
  for (const [re, line] of PAGES) if (re.test(p)) return line;
  return "On the trollrunner.net home page";
}

/* One line on what someone is up to, for the Who's Online list. `o` is
   their roster entry (its host and page), for when they aren't in a
   Troll Forces tab. */
export function describe(a, o = null) {
  if (!a || a.game !== "tf") return placeOf(o?.host, o?.path);
  if (a.state === "menu") return "In the Trollnite menu";
  if (a.state === "lobby") return `In the ${a.modeName || "Public Match"} lobby${a.ready ? " (ready)" : ""}`;
  const where = a.mapName ? ` on ${a.mapName}` : "";
  const wave = a.state === "zombies" && a.wave ? ` · round ${a.wave}` : "";
  if (!a.room) return `Playing ${a.modeName || "solo"}${where}${wave} (${a.priv ? "private" : "solo"})`;
  // (a private code stays off the wire; what they're playing doesn't)
  if (!a.pub) return `Playing ${a.modeName || "a match"}${where}${wave} (private)`;
  return `Playing ${a.modeName}${where}${wave}`;
}

/* Everyone online, accounts first, each with what they're doing. */
export function onlinePlayers(roster) {
  const out = [];
  for (const m of roster?.members || []) out.push({ key: m.userId, name: m.username, guest: false, level: m.level, userId: m.userId, viewerId: m.viewerId, activity: m.activity, host: m.host, path: m.path });
  for (const g of roster?.guests || []) out.push({ key: g.viewerId, name: g.label, guest: true, viewerId: g.viewerId, activity: g.activity, host: g.host, path: g.path });
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
