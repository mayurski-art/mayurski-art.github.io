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
import { HUB } from "../../zhub.js?v=zh1";
import { MAPS } from "../../maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1b7b7dc1c2f1m1u-tc3-nc1-cd1-sh1-sg1-bw1-cw1-zr10-zh1";
import { makeRoomCode } from "../../net.js?v=umb3-rm1-ld2-em1-sb1-cb1-rp1-p22-bh1b7c4-th2-cd1-sh1-cl1-bp1-bw1-bk1-fj1-zr9-zr10";
import { roomNow } from "../room-clock.js?v=rc1-cd1-sh1";
import { openKiosk, closeKiosk, kioskOpen } from "../../view/zombies-kiosk.js?v=zk1-zh1-zc1";
import { credits, zsave, setZsave, payRun, gunAction, kitAction } from "./credits.js?v=zc1";
import { fetchRows, hasBackend, monthWindow, weekWindow, windowFor, timeLeft, tallyPlayers } from "../../leaderboard-rows.js?v=lr1-zh1";

export const HUB_T = {
  countdown: 30,     // s from the owner stepping on
  claimFresh: 3000,  // ms a claim lasts without a resend
  holdStart: 1,      // s the owner holds X to go early
  returnSecs: 8,     // s on the end screen before the hub
  kioskRange: 2.4,   // m
};
const PARTY_MAX = 4;
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
    if (ids.includes(me()) && hub.pad === m.pad && !hub.launched && MAPS[m.map]) launch(clean(m.code), m.map);
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
  launch(code, map);
}

/* Leave the hub for a run on `code`: the quit button's tidy-up, then a
   Zombies start on that code like a typed one (match-start.js). */
function launch(code, map) {
  hub.launched = { code, map };
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
export function forgetHubReturn() { clearTimeout(hub.returnTimer); hub.returnTo = null; }

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
  mapRoot.add(group);
  built = { group, signs, boards, mapRoot };
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
  const r = 26;
  g.beginPath(); g.roundRect(8, 8, c.width - 16, c.height - 16, r);
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, "#1b2f6e"); grad.addColorStop(1, "#0f1a3e");
  g.fillStyle = grad; g.fill();
  g.lineWidth = 8; g.strokeStyle = "#7fa8ff"; g.stroke();
  g.textAlign = "center"; g.textBaseline = "middle";
  g.lineJoin = "round";
  const rows = lines.length;
  lines.forEach((parts, i) => {
    const y = c.height / 2 + (i - (rows - 1) / 2) * (rows > 2 ? 72 : 92);
    const size = i === 0 && rows > 2 ? 54 : 60;
    g.font = `700 ${size}px "Oswald", "DM Sans", sans-serif`;
    const widths = parts.map(([t]) => g.measureText(t).width);
    let x = c.width / 2 - widths.reduce((a, b) => a + b, 0) / 2;
    parts.forEach(([t, col], k) => {
      g.lineWidth = 9; g.strokeStyle = "#060b1c"; g.strokeText(t, x + widths[k] / 2, y);
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
  g.fillStyle = "#0d1733"; g.beginPath(); g.roundRect(6, 6, W - 12, H - 12, 22); g.fill();
  g.lineWidth = 10; g.strokeStyle = "#1f2f5c"; g.stroke();
  g.textBaseline = "middle"; g.lineJoin = "round";
  const text = (t, x, y, size, col, align = "left", weight = 700) => {
    g.font = `${weight} ${size}px "Oswald", "DM Sans", sans-serif`;
    g.textAlign = align;
    g.lineWidth = Math.max(4, size / 7); g.strokeStyle = "#050a18"; g.strokeText(t, x, y);
    g.fillStyle = col; g.fillText(t, x, y);
  };
  text(title, W / 2, 66, 74, "#ffffff", "center");
  text(period === "month" ? "Monthly" : "Weekly", 48, 136, 40, "#ffffff");
  text(`Ends: ${ends}`, W - 48, 136, 40, "#7dff4f", "right");
  g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(40, 168, W - 80, 3);
  text("Rank", 48, 198, 28, "#9fb0d8", "left", 600);
  text("Player", 170, 198, 28, "#9fb0d8", "left", 600);
  text(unit, W - 48, 198, 28, "#9fb0d8", "right", 600);
  const top = 250, step = Math.min(62, (H - top - 30) / BOARD_ROWS);
  if (!rows.length) {
    text(board.error ? "Board's down. Back soon." : `No runs yet this ${period}.`, W / 2, top + step * 3, 40, "#cfd8f0", "center", 600);
    text("Be the first on it.", W / 2, top + step * 4.2, 34, "#ffd84a", "center", 600);
  }
  const RANK = ["#ffd84a", "#d9e2f2", "#e8a35c"];
  rows.forEach(([name, n], i) => {
    const y = top + step * i;
    if (i % 2 === 0) { g.fillStyle = "rgba(255,255,255,.05)"; g.fillRect(40, y - step / 2, W - 80, step); }
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
    const name = [[MAPS[p.map]?.name || p.map, "#ffd84a"]];
    if (flash && flash.until > now && !party.members.length) { drawSign(built.signs.get(p.id), [name, [[flash.text, "#7dff4f"]]]); continue; }
    if (!party.members.length) { drawSign(built.signs.get(p.id), [name, [["Step on to play"]], [["Players: "], ["0/4", "#7dff4f"]]]); continue; }
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
    hub.holdT = held ? hub.holdT + dt : 0;
    const isPrivate = hub.pad === HUB.private.id;
    if (hub.holdT >= HUB_T.holdStart || (!isPrivate && (party.members.length >= PARTY_MAX || roomNow() >= party.ends))) go(hub.pad);
  }
  updateSigns();
  updateBoards();
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
