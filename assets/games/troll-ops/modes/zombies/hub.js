// Troll Forces Zombies: the hub (Zombie Rush P5).
//
// Zombies starts here, in a public hangout room (MODES.zhub, room QZHB, map
// zhub.js). Four pads stand along the back wall, one per map. Walk onto one
// and you're in its party; the first one on owns it. Thirty seconds after the
// owner stepped on, or as soon as four are on, or when the owner holds X, the
// owner deals a fresh private code to everyone on the pad and the lot of you
// leave the hub for a co-op run on it (coop.js). When the run's over, you come
// back here (8 s, or the end screen's button).
//
// The private pad is yours alone: standing on it makes a party nobody can
// walk into. "Invite Friends" copies a link (?zhub=ROOM&party=CODE) that drops
// a friend into the hub on your pad; you hold X when everyone's there.
//
// The wire (net.js routes "z" + a letter here through run.js):
//   zP  everyone, each second and on a change: where I'm standing
//       { pad, s, py }  pad id or null, when I stepped on (room ms), the
//       private party's code
//   zG  a pad's owner: go  { pad, code, map, m: [ids] }
//
// Nobody runs the hub: every client works out each pad's party from the
// claims it has heard (in step order, ids breaking ties), so they agree
// without a host. The netcode is trusting, as everywhere (net.js).

import * as THREE from "three";
import { game } from "../../core/state.js?v=st1";
import { HUB, hallFx, CARVE_BASE } from "./hub-hall.js?v=zh1-sr1-or1-dm1-zf1-wb1-mt2";
import { SEASON, seasonLeft, halloween } from "../../core/season.js?v=zf1-wb1";
import { setRareLooks } from "../../characters/zombie-models.js?v=zr4c-zp1-or1-zf1-ze1-ze2-wb1";
import { MAPS } from "../../maps/maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1b7b7dc1c2f1m1u-tc3-nc1-cd1-sh1-sg1-bw1-cw1-zr10-zh1-hr2-zp1-jb1-nh1-pi1-sr1-hl1-pf1-ub1-uw1-ug5-or1-bw2-bt1-wf1-wf2-zf1-bp1-is1-gf1-tg1-tcs1-kb0-kb1-kb2-kb3-cl1-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-tcs2-mg1-kb12-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb3-jb6-sp1-hh1-yb1-kbt1-gb1-gb3-rh1-gb4-tb1-gb5-gb7-gb8-gb9-tb2-bl1-kbb1-kbb2-dj2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-tfp1-tfp2-tfp3-tfp4-tfp7-tfb8-tfs1-ss1-ta1-ss2-ss3-ta2-tfm2-rfx1-rm1-kzf1-hgb1-hgb2-hgb3-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-hgb5-hgb6-hgb8-hgb9-tw1-op1-hgo1-wb1-mt2-hb4";
import { makeRoomCode } from "../../net/net.js?v=umb3-rm1-ld2-em1-sb1-cb1-rp1-p22-bh1b7c4-th2-cd1-sh1-cl1-bp1-bw1-bk1-fj1-zr9-zr10-hr2-zp1-rs1-dj2-pl2-nf1-or1-bw2-bt1-dom1-jb3-jb4-sp1-gb4-gb6-gb8-gb9-tfb8-rfx3-tw1-sqd1-lmg1-wb1";
import { roomNow } from "../room-clock.js?v=rc1-cd1-sh1";
import { openKiosk, closeKiosk, kioskOpen } from "../../view/zombies-kiosk.js?v=zk1-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-rm1-kzf1-fp2-lk1-hgb1-hgb2-mrg1-hgb3-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1-nft33-nfh1";
import { credits, zsave, setZsave, payRun, gunAction, kitAction, setRunEvent, RUN_EVENTS } from "./credits.js?v=zc1-zc2-zf1-wb1-mt2-hb4-gc1";
import { fetchRows, hasBackend, monthWindow, weekWindow, windowFor, timeLeft, tallyPlayers } from "../../progression/leaderboard-rows.js?v=lr1-zh1-or1-nd2-gc1";

export const HUB_T = {
  countdown: 30,     // s from the owner stepping on
  claimFresh: 3000,  // ms a claim lasts without a resend
  holdStart: 1,      // s the owner holds X to go early
  returnSecs: 8,     // s on the end screen before the hub
  kioskRange: 2.4,   // m
};
const PARTY_MAX = 4;

/* Runs launched from the public hub's map pads: public, so they show in the
   menu's server list and anyone can drop in (menu/online.js). The private
   pad's runs, and a private hub's, stay off it. */
export const publicRuns = new Set();
const SEND_EVERY = 1;   // s between zP resends

export const hub = {
  room: null,          // the hub room we're in (its code)
  roomCustom: false,   // a private hub (a test's, an invite's)
  pad: null,           // the pad we're standing on
  since: 0,            // when we stepped on it (room ms)
  privCode: null,      // our own private party's code, made on first use
  invite: null,        // the party an invite link put us in
  claims: new Map(),   // id -> { pad, s, py, at }
  holdT: 0,
  holdAt: 0,           // when the hold was last counted (performance.now)
  sendT: 0,
  launched: null,      // { code, map } once we've gone
  flash: new Map(),    // pad -> { text, until } ("Lobby ready!" as a party leaves)
  returnTo: null,      // the hub to come back to after a run
  returnTimer: 0,
};

/* ------------------------------------------------------------ the invite */

// ?zhub=ROOM&party=CODE: a friend's private pad. Read once at load; the
// menu (menu-bo2.js) opens Zombies on it.
const q = new URLSearchParams(location.search);
const clean = (v) => (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
export const inviteLink = q.has("zhub") ? { room: clean(q.get("zhub")), party: clean(q.get("party")) || null } : null;

/* Into the hub from the menu: an invite's room, else the public one. */
export function prepareHubEntry() {
  if (inviteLink?.room && inviteLink.room !== "QZHB") {
    game.els.room.value = inviteLink.room;
    game.roomIsCustom = true;
  } else if (!game.roomIsCustom) {
    game.els.room.value = "";
  }
  hub.invite = inviteLink?.party || null;
}

/* ------------------------------------------------------------ parties */

const padById = (id) => (id === HUB.private.id ? HUB.private : HUB.pads.find((p) => p.id === id) || null);
const me = () => game.net.id;

function liveClaims() {
  const now = performance.now();
  const out = [];
  for (const [id, c] of hub.claims) {
    if (id === me()) continue;
    if (now - c.at > HUB_T.claimFresh || !game.net.peers.has(id)) { hub.claims.delete(id); continue; }
    if (c.pad) out.push({ id, ...c });
  }
  if (hub.pad) out.push({ id: me(), pad: hub.pad, s: hub.since, py: myParty() });
  return out;
}

function myParty() { return hub.pad === HUB.private.id ? (hub.invite || (hub.privCode ||= makeRoomCode())) : null; }

/* The party on a pad (the private pad: one party per code), first on first. */
function partyOn(padId, py = null) {
  const list = liveClaims().filter((c) => c.pad === padId && (padId !== HUB.private.id || c.py === py));
  list.sort((a, b) => a.s - b.s || (a.id < b.id ? -1 : 1));
  const members = list.slice(0, PARTY_MAX);
  const owner = padId === HUB.private.id ? (members.find((c) => c.id === me() && !hub.invite) || members.find((c) => c.py && c.id && ownerOfCode(c)) || members[0]) : members[0];
  return { members, owner: owner?.id || null, full: list.length > PARTY_MAX, ends: members.length && padId !== HUB.private.id ? members[0].s + HUB_T.countdown * 1000 : 0 };
}
// The private party's owner made its code: the one claiming it without an invite.
function ownerOfCode(c) { return c.id === me() ? !hub.invite : !hub.claims.get(c.id)?.inv; }

/* Where are our feet: on a pad, or not. */
function padUnderFoot() {
  const pos = game.move?.pos;
  if (!pos || pos.y > 1.2) return null;
  for (const p of [...HUB.pads, HUB.private]) {
    if (Math.abs(pos.x - p.x) <= p.w / 2 - 0.15 && Math.abs(pos.z - p.z) <= p.d / 2 - 0.15) return p.id;
  }
  return null;
}

/* ------------------------------------------------------------ the wire */

function send(m) {
  if (!game.net.connected) return;
  m.id = me();
  game.net.send(m);
}
function sendClaim() {
  hub.sendT = SEND_EVERY;
  send({ t: "zP", pad: hub.pad, s: hub.since, py: myParty(), inv: hub.pad === HUB.private.id && !!hub.invite ? 1 : 0 });
}

export function onHubMessage(p, m) {
  if (!game.isHub() || !p || game.isBotPeer?.(p)) return;
  if (m.t === "zP") {
    hub.claims.set(p.id, { pad: padById(m.pad) ? m.pad : null, s: +m.s || 0, py: m.py ? clean(m.py) : null, inv: !!m.inv, at: performance.now() });
  } else if (m.t === "zG") {
    const ids = Array.isArray(m.m) ? m.m : [];
    if (padById(m.pad)) hub.flash.set(m.pad, { text: "Lobby ready!", until: performance.now() + 4000 });
    for (const id of ids) hub.claims.delete(id);
    if (ids.includes(me()) && hub.pad === m.pad && !hub.launched && MAPS[m.map]) launch(clean(m.code), m.map, m.pad);
  }
}

/* ------------------------------------------------------------ going in */

function go(padId) {
  const party = partyOn(padId, padId === HUB.private.id ? myParty() : null);
  if (party.owner !== me() || hub.launched) return;
  const pad = padById(padId);
  const map = pad.map || game.loadout.poolMapId || "pentagrin";
  const code = makeRoomCode();
  send({ t: "zG", pad: padId, code, map, m: party.members.map((c) => c.id) });
  launch(code, map, padId);
}

/* Leave the hub for a run on `code`: the quit button's tidy-up, then a
   Zombies start on that code like a typed one (match-start.js). */
function launch(code, map, padId = null) {
  hub.launched = { code, map };
  // the Halloween casket's run: double Credits, more of the dead in masks
  const event = padById(padId)?.event || null;
  setRunEvent(event);
  setRareLooks(RUN_EVENTS[event]?.looks || null);
  if (!hub.roomCustom && padId && padId !== HUB.private.id) publicRuns.add(code);
  const back = { room: hub.room, custom: hub.roomCustom };
  game.els.quitBtn.click();   // forgets any return: set ours after it
  hub.returnTo = back;
  game.modeId = "zombies";
  game.modePicked = true;
  game.els.room.value = code;
  game.roomIsCustom = true;
  game.loadout.poolMapId = map;
  game.startGame();
}

/* After a run: back to the hub we came from. match-end.js calls this when a
   run ends; the end screen's button (menu/buttons.js) skips the wait. */
export function scheduleHubReturn() {
  if (!hub.returnTo) return false;
  clearTimeout(hub.returnTimer);
  game.els.retryBtn.textContent = "Back to the hub";
  hub.returnTimer = setTimeout(returnToHub, HUB_T.returnSecs * 1000);
  return true;
}
export function hubReturnPending() { return !!hub.returnTo && game.gameState === "gameover"; }
export function returnToHub() {
  clearTimeout(hub.returnTimer);
  setRareLooks(null);
  const to = hub.returnTo;
  if (!to || game.gameState !== "gameover") return;
  hub.returnTo = null;
  game.els.retryBtn.textContent = "Drop in again";
  game.els.quitBtn.click();
  game.modeId = "zhub";
  game.modePicked = true;
  game.els.room.value = to.custom ? to.room : "";
  game.roomIsCustom = !!to.custom;
  hub.invite = null;
  game.startGame();
}
/* Quit from a run (pause menu): the hub doesn't call you back. */
export function forgetHubReturn() { clearTimeout(hub.returnTimer); hub.returnTo = null; setRareLooks(null); }

/* ------------------------------------------------------------ the scene */

let built = null;   // { group, signs: Map, mapRoot }

function canvasPlane(w, h, pxW, pxH) {
  const c = document.createElement("canvas");
  c.width = pxW; c.height = pxH;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  return { c, g: c.getContext("2d"), tex, mesh, last: "" };
}

function buildScene() {
  const mapRoot = game.builtMap?.root || null;
  if (built && built.mapRoot === mapRoot) return;
  disposeScene();
  if (!mapRoot) return;
  const group = new THREE.Group();
  const signs = new Map();
  for (const p of [...HUB.pads, HUB.private]) {
    const s = canvasPlane(p.w - 0.4, 1.7, 640, 272);
    s.mesh.position.set(p.x, HUB.signY, p.z - p.d / 2 - 0.25);
    group.add(s.mesh);
    signs.set(p.id, s);
  }
  const boards = new Map();
  for (const b of HUB.boards) {
    const s = canvasPlane(b.w, b.h, 1024, Math.round(1024 * b.h / b.w));
    s.mesh.position.set(b.x, b.y + b.h / 2, b.z);
    group.add(s.mesh);
    boards.set(b.id, s);
  }
  // the long-case clock: its dial (the time), the plate on its trunk door
  // (the season's countdown); the lectern's plate (your Credits)
  const C = HUB.clock;
  const dial = canvasPlane(0.56, 0.56, 256, 256);
  dial.mesh.position.set(C.x + 0.268, C.dialY, C.z);
  dial.mesh.rotation.y = Math.PI / 2;
  const plate = canvasPlane(0.38, 0.48, 256, 320);
  plate.mesh.position.set(C.x + 0.228, C.plateY, C.z);
  plate.mesh.rotation.y = Math.PI / 2;
  const L = HUB.lectern;
  const purse = canvasPlane(0.42, 0.26, 384, 240);
  const n = new THREE.Vector3(0, Math.cos(0.32), -Math.sin(0.32));
  purse.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, Math.sin(0.32), Math.cos(0.32)), n));
  purse.mesh.position.set(L.x, 1.041, L.z + 0.01).addScaledVector(n, 0.012);
  group.add(dial.mesh, plate.mesh, purse.mesh);
  mapRoot.add(group);
  built = { group, signs, boards, mapRoot, dial, plate, purse };
  board.drawn = "";
  refreshBoards();
}

function disposeScene() {
  if (!built) return;
  built.group.parent?.remove(built.group);
  built.group.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
  built = null;
}

/* One pad sign, the reference's: a navy plate, "Starting in: 10s" and
   "Players: 1/4", the numbers in colour, the map's name over them. */
function drawSign(s, lines) {
  const key = JSON.stringify(lines);
  if (key === s.last) return;
  s.last = key;
  const { g, c } = s;
  g.clearRect(0, 0, c.width, c.height);
  // black lacquer in a gold rule (the funeral home's frame: hub-hall.js)
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, "#22170f"); grad.addColorStop(1, "#0e0906");
  g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
  g.lineWidth = 8; g.strokeStyle = "#c9a24a"; g.strokeRect(10, 10, c.width - 20, c.height - 20);
  g.lineWidth = 2; g.strokeStyle = "rgba(201,162,74,.5)"; g.strokeRect(22, 22, c.width - 44, c.height - 44);
  g.textAlign = "center"; g.textBaseline = "middle";
  g.lineJoin = "round";
  const rows = lines.length;
  lines.forEach((parts, i) => {
    const y = c.height / 2 + (i - (rows - 1) / 2) * (rows > 2 ? 72 : 92);
    const size = i === 0 && rows > 2 ? 54 : 60;
    g.font = i === 0 ? `700 ${size}px Georgia, "Times New Roman", serif` : `700 ${size}px "Oswald", "DM Sans", sans-serif`;
    const widths = parts.map(([t]) => g.measureText(t).width);
    let x = c.width / 2 - widths.reduce((a, b) => a + b, 0) / 2;
    parts.forEach(([t, col], k) => {
      g.lineWidth = 9; g.strokeStyle = "#080503"; g.strokeText(t, x + widths[k] / 2, y);
      g.fillStyle = col || "#ffffff"; g.fillText(t, x + widths[k] / 2, y);
      x += widths[k];
    });
  });
  s.tex.needsUpdate = true;
}

/* ------------------------------------------------------------ the boards */

// Highest Wave and Total Kills, weekly and monthly in turn (BOARD_FLIP), like
// the reference's tabs. Every Zombies run a logged-in player finishes is a
// troll-ops row (match-end.js; leaderboard-rows.js reads them): this month's
// are fetched once a minute, and each board adds up its window per player,
// the best wave and the kills summed. Guests aren't filed.
const BOARD_EVERY = 60000;   // ms between re-reads
const BOARD_FLIP = 8000;     // ms on Weekly, then on Monthly
const BOARD_ROWS = 10;
const board = { rows: null, at: 0, busy: false, drawn: "", error: false, period: null };

async function refreshBoards() {
  if (board.busy) return;
  if (!hasBackend()) { board.rows = board.rows || []; board.at = performance.now(); return; }
  board.busy = true;
  try {
    const { start, end } = monthWindow();
    // this month holds this week, bar a week that began last month
    const wk = weekWindow();
    board.rows = await fetchRows({ start: wk.start < start ? wk.start : start, end, mode: "zombies" }) || [];
    board.error = false;
  } catch (err) {
    console.warn("[zombies hub] boards", err);
    board.error = true;
    board.rows = board.rows || [];
  } finally {
    board.busy = false;
    board.at = performance.now();
  }
}

/* Top ten each way over one window. A row without a date (a test's) counts. */
function tally(rows, period = "week") {
  const { start, end } = windowFor(period);
  const inside = (rows || []).filter((r) => !r.achieved_at || (new Date(r.achieved_at) >= start && new Date(r.achieved_at) < end));
  const all = tallyPlayers(inside.map((r) => ({ ...r, meta: { ...r.meta, mode: "zombies", pvp: false } })));
  return {
    wave: all.filter((u) => u.zWave > 0).sort((a, b) => b.zWave - a.zWave || b.zKills - a.zKills).slice(0, BOARD_ROWS).map((u) => [u.name, u.zWave]),
    kills: all.filter((u) => u.zKills > 0).sort((a, b) => b.zKills - a.zKills).slice(0, BOARD_ROWS).map((u) => [u.name, u.zKills]),
  };
}
const boardPeriod = () => board.period || (Math.floor(Date.now() / BOARD_FLIP) % 2 ? "month" : "week");

/* One board, the reference's: a navy panel, the title, "Weekly · Ends in",
   then rank, player and the number down the page. */
function drawBoard(s, title, unit, rows, ends, period) {
  const { g, c } = s;
  const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#120c08"; g.fillRect(0, 0, W, H);
  g.lineWidth = 10; g.strokeStyle = "#c9a24a"; g.strokeRect(12, 12, W - 24, H - 24);
  g.lineWidth = 2; g.strokeStyle = "rgba(201,162,74,.45)"; g.strokeRect(26, 26, W - 52, H - 52);
  g.textBaseline = "middle"; g.lineJoin = "round";
  const text = (t, x, y, size, col, align = "left", weight = 700, serif = false) => {
    g.font = serif ? `${weight} ${size}px Georgia, "Times New Roman", serif` : `${weight} ${size}px "Oswald", "DM Sans", sans-serif`;
    g.textAlign = align;
    g.lineWidth = Math.max(4, size / 7); g.strokeStyle = "#060403"; g.strokeText(t, x, y);
    g.fillStyle = col; g.fillText(t, x, y);
  };
  text(title, W / 2, 70, 70, "#f2cf7a", "center", 700, true);
  text(period === "month" ? "Monthly" : "Weekly", 48, 136, 40, "#ffffff");
  text(`Ends: ${ends}`, W - 48, 136, 40, "#7dff4f", "right");
  g.fillStyle = "rgba(201,162,74,.45)"; g.fillRect(40, 168, W - 80, 3);
  text("Rank", 48, 198, 28, "#b9a27a", "left", 600);
  text("Player", 170, 198, 28, "#b9a27a", "left", 600);
  text(unit, W - 48, 198, 28, "#b9a27a", "right", 600);
  const top = 250, step = Math.min(62, (H - top - 30) / BOARD_ROWS);
  if (!rows.length) {
    text(board.error ? "Board's down. Back soon." : `No runs yet this ${period}.`, W / 2, top + step * 3, 40, "#cfd8f0", "center", 600);
    text("Be the first on it.", W / 2, top + step * 4.2, 34, "#ffd84a", "center", 600);
  }
  const RANK = ["#ffd84a", "#d9e2f2", "#e8a35c"];
  rows.forEach(([name, n], i) => {
    const y = top + step * i;
    if (i % 2 === 0) { g.fillStyle = "rgba(242,207,122,.06)"; g.fillRect(40, y - step / 2, W - 80, step); }
    text(`#${i + 1}`, 48, y, 42, RANK[i] || "#ffffff");
    let nm = String(name);
    g.font = `600 42px "Oswald", "DM Sans", sans-serif`;
    while (nm.length > 3 && g.measureText(nm).width > W - 440) nm = nm.slice(0, -1);
    text(nm === String(name) ? nm : `${nm.slice(0, -1)}.`, 170, y, 42, "#ffffff", "left", 600);
    text(Math.round(n).toLocaleString(), W - 48, y, 42, "#ffffff", "right");
  });
  s.tex.needsUpdate = true;
}

function updateBoards() {
  if (!built) return;
  if (performance.now() - board.at > BOARD_EVERY) refreshBoards();
  const period = boardPeriod();
  const ends = timeLeft(period);
  const t = tally(board.rows, period);
  const key = JSON.stringify([t, ends, board.error, period]);
  if (key === board.drawn) return;
  board.drawn = key;
  drawBoard(built.boards.get("wave"), "Highest Wave", "Wave", t.wave, ends, period);
  drawBoard(built.boards.get("kills"), "Total Kills", "Kills", t.kills, ends, period);
}

function updateSigns() {
  if (!built) return;
  const now = performance.now();
  for (const p of HUB.pads) {
    const flash = hub.flash.get(p.id);
    const party = partyOn(p.id);
    const name = p.event ? [[RUN_EVENTS[p.event].title, "#c58cff"]] : [[MAPS[p.map]?.name || p.map, "#f2cf7a"]];
    if (flash && flash.until > now && !party.members.length) { drawSign(built.signs.get(p.id), [name, [[flash.text, "#7dff4f"]]]); continue; }
    if (!party.members.length) { drawSign(built.signs.get(p.id), [name, p.event ? [[RUN_EVENTS[p.event].blurb, "#ffb347"]] : [["Step on to play"]], [["Players: "], ["0/4", "#7dff4f"]]]); continue; }
    const secs = Math.max(0, Math.ceil((party.ends - roomNow()) / 1000));
    drawSign(built.signs.get(p.id), [name, [["Starting in: "], [`${secs}s`, "#ffd84a"]], [["Players: "], [`${party.members.length}/${PARTY_MAX}`, party.members.length >= PARTY_MAX ? "#ff5a6a" : "#7dff4f"]]]);
  }
  // The private pad: your own party if you're in one, else an invitation.
  const priv = built.signs.get(HUB.private.id);
  if (hub.pad === HUB.private.id) {
    const party = partyOn(HUB.private.id, myParty());
    drawSign(priv, [[["Private", "#d9a6ff"]], [["Lobby ready!", "#7dff4f"]], [["Players: "], [`${party.members.length}/${PARTY_MAX}`, "#7dff4f"]]]);
  } else {
    drawSign(priv, [[["Private", "#d9a6ff"]], [["Your squad only"]], [["Invite friends in", "#ffd84a"]]]);
  }
}

/* ------------------------------------------------------------ the clock */

const ROMAN = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
const SERIF = `Georgia, "Times New Roman", serif`;
const SANS = `"Oswald", "DM Sans", sans-serif`;

/* The long-case clock's face: cream enamel, Roman hours, the hands at the
   local time. */
function drawDial(s, now) {
  const { g, c } = s;
  const R = c.width / 2;
  g.clearRect(0, 0, c.width, c.height);
  g.save();
  g.translate(R, R);
  g.fillStyle = "#c9a24a"; g.beginPath(); g.arc(0, 0, R - 2, 0, Math.PI * 2); g.fill();
  const face = g.createRadialGradient(0, -20, 10, 0, 0, R);
  face.addColorStop(0, "#fbf3dc"); face.addColorStop(1, "#e3d3a8");
  g.fillStyle = face; g.beginPath(); g.arc(0, 0, R - 14, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#2a1a0e"; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R - 54, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#2a1a0e"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `700 22px ${SERIF}`;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    g.save(); g.translate(Math.cos(a) * (R - 36), Math.sin(a) * (R - 36)); g.rotate(a + Math.PI / 2);
    g.fillText(ROMAN[i], 0, 0); g.restore();
  }
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, r0 = R - 18, r1 = R - (i % 5 ? 22 : 26);
    g.lineWidth = i % 5 ? 1.5 : 3;
    g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
  }
  g.font = `italic 13px ${SERIF}`;
  g.fillText("Grin & Sons", 0, 34);
  const d = new Date(now);
  const hand = (frac, len, w) => {
    const a = frac * Math.PI * 2 - Math.PI / 2;
    g.lineWidth = w; g.lineCap = "round"; g.strokeStyle = "#140c06";
    g.beginPath(); g.moveTo(-Math.cos(a) * 12, -Math.sin(a) * 12); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.stroke();
  };
  hand(((d.getHours() % 12) + d.getMinutes() / 60) / 12, R * 0.48, 7);
  hand((d.getMinutes() + d.getSeconds() / 60) / 60, R * 0.7, 4.5);
  g.fillStyle = "#140c06"; g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill();
  g.restore();
  s.tex.needsUpdate = true;
}

/* The trunk door's plate: the season and how long it has left (the lobby's
   countdown, core/season.js), and Halloween while it lasts. */
function drawSeason(s, left) {
  const { g, c } = s;
  const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#c9a24a"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#1a110a"; g.fillRect(8, 8, W - 16, H - 16);
  g.strokeStyle = "rgba(201,162,74,.6)"; g.lineWidth = 2; g.strokeRect(18, 18, W - 36, H - 36);
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#b9a27a"; g.font = `italic 26px ${SERIF}`;
  g.fillText("Season: OG", W / 2, 60);
  g.fillStyle = "#f2cf7a"; g.font = `700 38px ${SERIF}`;
  g.fillText(SEASON.name, W / 2, 106);
  g.fillStyle = "#c9a24a"; g.fillRect(W / 2 - 60, 140, 120, 2);
  const m = left.match(/^(.*) (left)$/);
  g.fillStyle = "#ffffff"; g.font = `700 ${m ? 46 : 34}px ${SANS}`;
  g.fillText(m ? m[1] : left, W / 2, 190);
  if (m) { g.fillStyle = "#b9a27a"; g.font = `600 26px ${SANS}`; g.fillText("LEFT", W / 2, 232); }
  if (halloween()) { g.fillStyle = "#ff9a3a"; g.font = `italic 26px ${SERIF}`; g.fillText("Halloween", W / 2, 276); }
  s.tex.needsUpdate = true;
}

/* The lectern's plate: what's in your collection plate (Credits). */
function drawPurse(s, n) {
  const { g, c } = s;
  const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#b8903c"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#5a3e16"; g.lineWidth = 4; g.strokeRect(10, 10, W - 20, H - 20);
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#3a2608"; g.font = `italic 30px ${SERIF}`;
  g.fillText("Your collection", W / 2, 58);
  g.font = `700 72px ${SERIF}`;
  g.fillText(Math.round(n).toLocaleString(), W / 2, 130);
  g.font = `600 26px ${SANS}`;
  g.fillText("CREDITS", W / 2, 190);
  s.tex.needsUpdate = true;
}

/* Once a second: the clock's hands move every 20 s, the countdown every
   minute, the Credits after a kiosk buy (each read parses the save). */
let plateT = 0;
function updatePlates(dt) {
  if (!built) return;
  plateT -= dt;
  if (plateT > 0 && built.purse.last !== "") return;   // a fresh scene draws at once
  plateT = 1;
  const now = Date.now();
  const tick = Math.floor(now / 20000);
  if (built.dial.last !== tick) { built.dial.last = tick; drawDial(built.dial, now); }
  const left = seasonLeft(now);
  if (built.plate.last !== left) { built.plate.last = left; drawSeason(built.plate, left); }
  const n = credits();
  if (built.purse.last !== n) { built.purse.last = n; drawPurse(built.purse, n); }
}

/* Halloween: the floor fog turning, the ghost swaying on its thread. */
let fxT = 0;
function updateHallFx(dt) {
  fxT += dt;
  hallFx.fog.forEach((m, i) => { if (m.parent) m.rotation.z = fxT * (i % 2 ? 0.02 : -0.015) + i; });
  const gh = hallFx.ghost;
  if (gh?.parent) { gh.rotation.y = Math.sin(fxT * 0.4) * 0.5; gh.position.y = 4.2 + Math.sin(fxT * 0.9) * 0.08; }
  // the jack-o'-lanterns' candles (Hollowgrin's flicker: a quick wobble and
  // the odd gutter)
  if (hallFx.carve) {
    const ft = fxT * 9;
    const f = 1 - 0.22 * (0.5 + 0.5 * Math.sin(ft)) * (0.6 + 0.4 * Math.sin(ft * 2.3 + 1.7)) - (Math.random() < 0.02 ? 0.1 : 0);
    hallFx.carve.color.copy(CARVE_BASE).multiplyScalar(f);
    hallFx.pool?.color.setRGB(1, 0.478, 0.102).multiplyScalar(0.55 * f);
  }
}

/* ------------------------------------------------------------ the HUD */

let ui = null;
function buildUi() {
  if (ui) return;
  const root = document.createElement("div");
  root.className = "zhb";
  root.hidden = true;
  root.innerHTML = `
    <div class="zhb-chips">
      <div class="zhb-chip zhb-credits" aria-label="Credits"><span class="zhb-coin" aria-hidden="true"></span><span class="zhb-credits-n">0</span>&nbsp;Credits</div>
      <div class="zhb-chip zhb-online"><span class="zhb-dot" aria-hidden="true"></span><span class="zhb-online-n">1</span>&nbsp;in the hub</div>
      <button type="button" class="zhb-chip zhb-invite" aria-label="Invite friends: copy a link to your private pad">Invite Friends</button>
    </div>
    <div class="zhb-pad" hidden>
      <div class="zhb-pad-h"></div>
      <div class="zhb-pad-s"></div>
      <div class="zhb-hold" hidden><span class="zhb-key">X</span><span class="zhb-hold-t">Hold to start now</span><i class="zhb-bar"><i></i></i></div>
    </div>
    <div class="zhb-toast" hidden></div>`;
  (game.els.hud || document.body).appendChild(root);
  ui = {
    root,
    online: root.querySelector(".zhb-online-n"),
    credits: root.querySelector(".zhb-credits-n"),
    invite: root.querySelector(".zhb-invite"),
    pad: root.querySelector(".zhb-pad"),
    padH: root.querySelector(".zhb-pad-h"),
    padS: root.querySelector(".zhb-pad-s"),
    hold: root.querySelector(".zhb-hold"),
    holdT: root.querySelector(".zhb-hold-t"),
    bar: root.querySelector(".zhb-bar > i"),
    toast: root.querySelector(".zhb-toast"),
    toastT: 0,
    last: "",
  };
  ui.invite.addEventListener("click", copyInvite);
}

function toast(text, secs = 3) {
  ui.toast.textContent = text;
  ui.toast.hidden = false;
  clearTimeout(ui.toastT);
  ui.toastT = setTimeout(() => { ui.toast.hidden = true; }, secs * 1000);
}

/* The link to our private pad. */
export function inviteUrl() {
  const code = hub.invite || (hub.privCode ||= makeRoomCode());
  const u = new URL(location.href);
  u.search = "";
  u.hash = "";
  u.searchParams.set("zhub", hub.room || "QZHB");
  u.searchParams.set("party", code);
  return u.toString();
}
async function copyInvite() {
  const url = inviteUrl();
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch { /* no clipboard (http, an old browser) */ }
  toast(ok ? "Link copied. Wait on the private pad." : `Send this: ${url}`, ok ? 3 : 8);
}

function updateUi(dt, party) {
  if (!ui) return;
  const humans = 1 + [...game.net.peers.values()].filter((p) => !game.isBotPeer(p)).length;
  ui.online.textContent = String(humans);
  const cr = credits().toLocaleString();
  if (ui.credits.textContent !== cr) ui.credits.textContent = cr;
  // a kiosk screen is up: nothing of ours under it
  if (kioskOpen()) { ui.pad.hidden = true; return; }
  if (!hub.pad) {
    const k = nearKiosk();
    ui.pad.hidden = !k;
    if (k) {
      ui.padH.textContent = `${k.label} kiosk`;
      ui.padS.textContent = k.id === "weapons" ? "Guns for Credits." : "Kits for Credits.";
      ui.hold.hidden = false;
      ui.holdT.textContent = game.isTouch ? "Tap the swap button to open" : "Press to open";
      ui.bar.style.width = "0%";
    }
    return;
  }
  ui.pad.hidden = false;
  const pad = padById(hub.pad);
  const inParty = party.members.some((c) => c.id === me());
  const owner = party.owner === me();
  if (hub.pad === HUB.private.id) {
    ui.padH.textContent = `Private lobby · ${party.members.length}/${PARTY_MAX}`;
    ui.padS.textContent = owner ? "Invite Friends sends them here. Start when you're all in." : "Waiting on the host to start.";
  } else if (!inParty) {
    ui.padH.textContent = `${MAPS[pad.map]?.name || pad.map} · full`;
    ui.padS.textContent = "Four's the most. Try another pad.";
  } else {
    const secs = Math.max(0, Math.ceil((party.ends - roomNow()) / 1000));
    ui.padH.textContent = `${MAPS[pad.map]?.name || pad.map} · ${party.members.length}/${PARTY_MAX}`;
    ui.padS.textContent = `Starting in ${secs}s. Step off to leave.`;
  }
  ui.hold.hidden = !owner;
  ui.holdT.textContent = game.isTouch ? "Hold the swap button to start now" : "Hold to start now";
  ui.bar.style.width = `${Math.min(1, hub.holdT / HUB_T.holdStart) * 100}%`;
}

function nearKiosk() {
  const pos = game.move?.pos;
  if (!pos) return null;
  return HUB.kiosks.find((k) => Math.hypot(pos.x - (k.x - 1.2), pos.z - k.z) < HUB_T.kioskRange) || null;
}

/* ------------------------------------------------------------ each frame */

let wasIn = false;
export function updateHub(dt) {
  if (!wasIn) enterHub();
  buildScene();
  const room = game.net.connected ? game.net.room : null;
  if (room !== hub.room) { hub.room = room; hub.roomCustom = !!room && room !== "QZHB" && !/^QZHB\d+$/.test(room); }

  const under = hub.launched ? null : padUnderFoot();
  if (under !== hub.pad) {
    // stepping off the private pad ends an invite: you're your own again
    if (hub.pad === HUB.private.id && under !== HUB.private.id) hub.invite = null;
    hub.pad = under;
    hub.since = roomNow();
    hub.holdT = 0;
    hub.holdAt = 0;
    sendClaim();
  }
  hub.sendT -= dt;
  if (hub.sendT <= 0) sendClaim();

  // a kiosk: X opens its screen (view/zombies-kiosk.js)
  const xDown = !game.localPauseOnly && (game.keys.has("KeyX") || (game.isTouch && game.touchState?.swap) || !!game.gamepadState?.pickup);
  const kiosk = !hub.pad && !kioskOpen() ? nearKiosk() : null;
  if (kiosk && xDown && !hub.xWas) openKiosk(kiosk.id);
  hub.xWas = xDown;

  const party = hub.pad ? partyOn(hub.pad, myParty()) : null;
  if (party && party.owner === me() && !hub.launched) {
    const held = !game.localPauseOnly && (game.keys.has("KeyX") || (game.isTouch && game.touchState?.swap) || !!game.gamepadState?.pickup);
    // real seconds, not frame time: a slow frame (clamped to 50 ms) mustn't
    // stretch the hold
    const now = performance.now();
    hub.holdT = held ? hub.holdT + Math.min(0.5, (now - (hub.holdAt || now)) / 1000) : 0;
    hub.holdAt = held ? now : 0;
    const isPrivate = hub.pad === HUB.private.id;
    if (hub.holdT >= HUB_T.holdStart || (!isPrivate && (party.members.length >= PARTY_MAX || roomNow() >= party.ends))) go(hub.pad);
  }
  updateSigns();
  updateBoards();
  updatePlates(dt);
  updateHallFx(dt);
  updateUi(dt, party || { members: [], owner: null });
}

/* First frame in the hub: the HUD, and an invite's pad under our feet. */
function enterHub() {
  wasIn = true;
  buildUi();
  ui.root.hidden = false;
  document.body.classList.add("to-zhub");
  hub.launched = null;
  hub.pad = null;
  hub.claims.clear();
  hub.flash.clear();
  if (hub.invite && game.move?.pos) {
    const p = HUB.private;
    game.move.pos.set(p.x + (Math.random() - 0.5) * 2, game.move.pos.y, p.z + (Math.random() - 0.5) * 2);
    toast("You're in your friend's private lobby.", 4);
  }
}

/* Out of the hub (any other mode, the menu): hide what's ours. Called each
   frame we're not in it, cheap when there's nothing to do. */
export function leaveHub() {
  if (!wasIn) return;
  wasIn = false;
  if (ui) ui.root.hidden = true;
  closeKiosk();
  document.body.classList.remove("to-zhub");
  disposeScene();
  if (hub.pad) { hub.pad = null; sendClaim(); }
}

/* Tests (?tohooks=1): window.__trollHub. */
export function hubDebug() {
  return {
    hub, HUB, HUB_T,
    party: (pad, py) => partyOn(pad, py ?? (pad === HUB.private.id ? myParty() : null)),
    signs: () => built ? Object.fromEntries([...built.signs].map(([id, s]) => [id, s.last])) : null,
    under: padUnderFoot,
    inviteUrl,
    endRun: (reason = "dead") => game.endGame(reason),
    // fake this week's rows (no backend in tests)
    setBoardRows: (rows) => { board.rows = rows; board.at = performance.now(); board.error = false; },
    boards: (period = "week") => tally(board.rows, period),
    setBoardPeriod: (p) => { board.period = p; },
    kioskOpen, closeKiosk, openKiosk,
    // Credits (credits.js)
    zc: { zsave, setZsave, payRun, gunAction, kitAction },
    state: () => game.gameState,
    input: () => ({ pauseOnly: !!game.localPauseOnly, x: game.keys.has("KeyX") }),
  };
}
if (q.has("tohooks")) window.__trollHub = hubDebug();
