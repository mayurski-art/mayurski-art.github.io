/* Socialize, Trolling Loud: the door (CLUB-ENTRY.md; user, 2026-10-07/08).
   You spawn in the line along the rope with 1-7 clubgoers ahead of you
   (a line of 6-7). It moves up as the two lanes, Big Lulz's and Tank's,
   check people in. At the front you show your ID (signed in: your profile
   card; guests skip it), say whether you're 18, and get a wristband; the
   wristband is your pass through any door for the rest of the session.
   Under 18 and you're thrown out onto the curb and locked out for two
   minutes. troll_runner skips all of it: he spawns inside wearing the
   owner band, which opens every door, VIP and back of house included.

   Phase 1 of the doc: the whole flow, solo, with plain poses and plain
   UI. The rope, the bouncers' acts, the bands on the wrist (phase 2), the
   kick-out cinematic (3) and the room seeing any of it (4) come later.

   The pass is a zone fence, not doors: after you move, the spot you're in
   (trollingloud.js entryZoneOf: street / main / vip / back) has to be one
   your band opens, or you're put back where you were. Only on a map with
   `rp.door` (Trolling Loud), only in Socialize. */

import * as THREE from "three";
import { rpExtras } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7d";
import { releaseHeldInputs } from "../menu/pause.js?v=pa1-mb1-if1-fu1b7b7dec1";
import { renderCard, myCardData } from "../profile-card.js?v=pc1-wst-sb2-fu1";
import { isOwner } from "../progression.js?v=p5-wst-sb2-fu1";
import { game } from "../core/state.js?v=st1";

export const BAND = { none: 0, guest: 1, owner: 2, vip: 3 };
/* The test (?tohooks=1) shortens the waits: window.__trollClub.T. */
const T = { lockSecs: 120, checkSecs: 2.2, idSecs: 2.6, bandSecs: 1.4 };
const WALK = 1.5;          // m/s, people in the line
const LANE_GAP = 1.2;      // s a lane stays empty between people
const OPENS = {            // which zones each band lets you into
  0: ["street"],
  1: ["street", "main"],
  2: ["street", "main", "vip", "back"],
  3: ["street", "main", "vip"],
};

export const club = {
  band: BAND.none,
  room: undefined,         // the room the band was given in (a new room, a new band)
  phase: "none",           // none queued lane id ask band walk in lockout
  t: 0,                    // seconds in this phase
  lockUntil: 0,            // performance.now() the lockout ends
  queue: [],               // the line, front first: {me} or an npc entry
  npcs: [],                // every clubgoer the door drives
  lanes: [],               // [{ who, t, x, z, yaw, bouncer }]
  lane: -1,                // our lane, checking
  walkTo: [],              // our scripted walk's remaining points
  lastOk: new THREE.Vector3(),
  fenceMsgAt: 0,
  live: false,
  want: 0,                 // clubgoers kept in the line (6 or 7)
};
const ME = { me: true };

const door = () => (game.isSocial() ? game.builtMap?.map?.rp?.door : null) || null;
const now = () => performance.now() / 1000;
const yawTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));

/* ------------------------------------------------------------- the band */

function roomKey() { return game.net?.room ?? "solo"; }
/* The band for the session, in this room (survives the room going to a
   match and back; a different room or a reload starts over). The owner's
   is there from the start, every time. */
function bandNow() {
  if (isOwner()) return BAND.owner;
  if (club.room !== roomKey()) { club.band = BAND.none; club.room = roomKey(); }
  return club.band;
}
export function clubBand() { return door() ? bandNow() : BAND.none; }

/* ------------------------------------------------------------- spawning */

/* After the match puts us down (modes/match-start.js): in the line, or in
   the lobby with a band on. */
export function clubSpawn() {
  resetDoor();
  const d = door();
  if (!d) return;
  club.live = true;
  club.lanes = d.lanes.map((l) => {
    const b = game.townNpcs?.list.find((n) => n.c.name === l.bouncer);
    return { who: null, t: 0, x: l.x, z: l.z, yaw: b ? yawTo(l.x, l.z, b.x, b.z) : 0 };
  });
  takeLine(d);
  if (bandNow() > BAND.none) { toLobby(d); return; }
  // Somewhere in the line: 1-7 ahead of you (as many as there are).
  const ahead = 1 + Math.floor(Math.random() * Math.min(7, club.queue.length));
  club.queue.splice(Math.min(ahead, club.queue.length), 0, ME);
  const slot = slotOf(d, club.queue.indexOf(ME));
  game.move.reset(slot.x, slot.z, 0);
  game.look.yaw = yawTo(slot.x, slot.z, d.mouth.x, d.mouth.z);
  game.look.pitch = 0;
  go("queued");
  club.lastOk.copy(game.move.pos);
}

function toLobby(d) {
  game.move.reset(d.lobby.x, d.lobby.z, d.lobby.y);
  game.look.yaw = d.lobby.yaw;
  go("in");
  club.lastOk.copy(game.move.pos);
}

/* The clubgoers along the rope, driven by the door from now on: 6 or 7 of
   them in the line, the rest inside (out of sight) till there's room. */
function takeLine(d) {
  const T_ = game.townNpcs;
  if (!T_) return;
  const goers = [];
  T_.list.forEach((n, i) => {
    if (n.c.role === "Clubgoer" && Math.abs(n.c.z - d.line[0].z) < 0.5 && n.c.x < d.line[0].x + 0.5) goers.push(i);
  });
  goers.sort((a, b) => T_.list[b].c.x - T_.list[a].c.x);   // nearest the door first
  const inLine = Math.min(goers.length, 6 + (Math.random() < 0.5 ? 1 : 0));
  club.want = inLine;
  goers.forEach((i, k) => {
    const n = T_.takeOver(i, () => {});
    const e = { i, n, state: k < inLine ? "line" : "inside", t: 0, y0: n.c.y ?? 0 };
    club.npcs.push(e);
    if (e.state === "line") {
      club.queue.push(e);
      const s = d.line[club.queue.length - 1];
      n.x = s.x; n.z = s.z;
    } else n.off = true;
  });
}

function resetDoor() {
  for (const e of club.npcs) {
    if (e.n) { e.n.off = false; e.n.c.y = e.y0; }
    game.townNpcs?.release(e.i);
  }
  Object.assign(club, { phase: "none", t: 0, queue: [], npcs: [], lanes: [], lane: -1, walkTo: [], live: false });
  ui.hideAll();
}

function go(phase) { club.phase = phase; club.t = 0; }

/* ------------------------------------------------------- each frame */

/* After movement (view/player-update.js): the line and the lanes, our own
   steps through the door, and the fence. */
export function updateClubEntry(dt) {
  const d = door();
  if (!d) { if (club.live) resetDoor(); return; }
  if (!club.live) return;   // not spawned here yet
  club.t += dt;
  stepNpcs(d, dt);
  stepMe(d, dt);
  fence(d);
}

/* Is the door moving us (in the line, at a lane, walking in)? Then
   view/player-update.js lets clubHold() move us instead of the keys. */
export function clubHolds() {
  return club.live && ["queued", "lane", "id", "ask", "band", "walk"].includes(club.phase);
}
export function clubHold(dt) {
  const d = door();
  const m = game.move;
  m.velocity.set(0, 0, 0);
  m.sprinting = false;
  m.grounded = true;
  let target = null;
  if (club.phase === "queued") target = slotOf(d, club.queue.indexOf(ME));
  else if (club.phase === "lane") target = club.lanes[club.lane];
  else if (club.phase === "walk") target = club.walkTo[0];
  m.moving = false;
  if (!target) return;
  const dx = target.x - m.pos.x, dz = target.z - m.pos.z, dist = Math.hypot(dx, dz);
  if (dist > 0.03) {
    const s = Math.min(dist, WALK * (club.phase === "walk" ? 1.3 : 1) * dt);
    m.pos.x += dx / dist * s;
    m.pos.z += dz / dist * s;
    m.moving = dist > 0.1;
  }
  m.pos.y = floorAt(d, m.pos.z);
  // Walking in, look where you're going.
  if (club.phase === "walk" && dist > 0.2) game.look.yaw = turn(game.look.yaw, Math.atan2(-dx, -dz), dt * 6);
}

/* A place in the line; past the rope's end the line just bunches up at it. */
const slotOf = (d, k) => d.line[Math.max(0, Math.min(k, d.line.length - 1))];
const floorAt = (d, z) => (z < 22.3 ? d.lobby.y : 0);
function turn(a, b, k) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + diff * Math.min(1, k);
}

/* The clubgoers: up the line, to a free lane, checked, in through the
   door, and (out of sight) back to the end of the alley to queue again. */
function stepNpcs(d, dt) {
  const inLine = club.queue.filter((e) => !e.me).length + club.npcs.filter((e) => e.state === "arrive").length;
  const want = club.want;
  for (const e of club.npcs) {
    const n = e.n;
    e.t += dt;
    let target = null;
    switch (e.state) {
      case "line": target = slotOf(d, club.queue.indexOf(e)); break;
      case "lane": {
        const l = club.lanes[e.lane];
        target = l;
        if (near(n, l) && e.t > 0.5) {
          n.yaw = l.yaw;
          if (!e.checkT) e.checkT = e.t;
          if (e.t - e.checkT > T.checkSecs) { e.state = "door"; e.t = 0; e.path = [d.mouth, { x: d.lobby.x + (Math.random() - 0.5) * 2, z: d.lobby.z + 1.5 }]; l.who = null; l.t = 0; }
        }
        break;
      }
      case "door":
        target = e.path[0];
        if (near(n, target)) { e.path.shift(); if (!e.path.length) { e.state = "inside"; n.off = true; e.t = 0; } }
        break;
      case "inside":
        if (inLine < want && e.t > 3) { e.state = "arrive"; n.off = false; n.x = d.arrive.x; n.z = d.arrive.z; e.t = 0; }
        break;
      case "arrive":
        target = d.line[Math.min(club.queue.length, d.line.length - 1)];
        if (near(n, target, 0.6)) { e.state = "line"; club.queue.push(e); }
        break;
    }
    if (target) walk(n, target, dt, e.state === "lane" && e.checkT ? null : target);
    else n.moving = false;
    n.c.y = floorAt(d, n.z);
    if (game.townNpcs?.view) n.zone = game.townNpcs.view.zoneOf(n.x, n.c.y + 1, n.z);
  }
  // The front of the line goes to a free lane.
  for (const l of club.lanes) {
    l.t += dt;
    const front = club.queue[0];
    if (l.who || l.t < LANE_GAP || !front) continue;
    if (!near(front.me ? game.move.pos : front.n, d.line[0], 0.25)) break;
    club.queue.shift();
    l.who = front;
    if (front.me) { club.lane = club.lanes.indexOf(l); go("lane"); }
    else { front.state = "lane"; front.lane = club.lanes.indexOf(l); front.t = 0; front.checkT = 0; }
  }
}

function near(a, b, r = 0.12) { return Math.hypot(a.x - b.x, a.z - b.z) < r; }
function walk(n, target, dt) {
  const dx = target.x - n.x, dz = target.z - n.z, dist = Math.hypot(dx, dz);
  n.moving = dist > 0.08;
  if (dist < 0.02) return;
  const s = Math.min(dist, WALK * dt);
  n.x += dx / dist * s;
  n.z += dz / dist * s;
  if (dist > 0.15) n.yaw = Math.atan2(-dx, -dz);
}

/* Our own way through it. */
function stepMe(d, dt) {
  const p = game.move.pos;
  switch (club.phase) {
    case "lane": {
      const l = club.lanes[club.lane];
      if (!near(p, l, 0.05)) break;
      game.look.yaw = turn(game.look.yaw, l.yaw, dt * 5);
      if (club.t > 0.6) {
        const signed = !!window.TrollrunnerAccounts?.getCachedProfile?.();
        if (signed) { ui.showCard(); go("id"); }
        else { ui.ask(answer); go("ask"); }
      }
      break;
    }
    case "id":
      game.look.yaw = turn(game.look.yaw, club.lanes[club.lane].yaw, dt * 5);
      if (club.t > T.idSecs) { ui.hideCard(); ui.ask(answer); go("ask"); }
      break;
    case "band":
      if (club.t > T.bandSecs) {
        freeLane();
        club.walkTo = [d.mouth, { x: d.lobby.x, z: d.lobby.z }];
        go("walk");
      }
      break;
    case "walk":
      if (club.walkTo.length && near(p, club.walkTo[0], 0.08)) club.walkTo.shift();
      if (!club.walkTo.length) { go("in"); showWaveBanner("You're in. The band gets you through any door tonight", 2600); }
      break;
    case "lockout": {
      const left = club.lockUntil - now();
      ui.chip(left > 0 ? `Bounced · back in line in ${fmt(left)}` : "Hold X to get back in line");
      if (left <= 0 && club.t > 0) { /* stays in lockout till they rejoin; the chip says how */ }
      break;
    }
    default: break;
  }
  if (club.phase !== "lockout") ui.chip(club.phase === "queued" ? "In line · hold X to step out" : null);
}

function freeLane() {
  const l = club.lanes[club.lane];
  if (l) { l.who = null; l.t = 0; }
  club.lane = -1;
}

/* The 18+ question is up: the mouse is free for its buttons on purpose
   (menu/buttons.js doesn't pause for it). */
export function clubAskOpen() { return !!ui.dialog && !ui.dialog.hidden; }

/* The answer at the door: "Yeah" (18+) or "No". */
function answer(adult) {
  if (club.phase !== "ask") return;
  if (adult) {
    club.band = BAND.guest;
    club.room = roomKey();
    showWaveBanner("Big Lulz snaps a wristband on you. Rope's open", 2200);
    go("band");
    return;
  }
  // Phase 3 makes this the cinematic. For now: straight out on the curb.
  freeLane();
  const d = door();
  showWaveBanner(`"Nah. Come back when you're 18."`, 3000);
  game.move.reset(d.curb.x, d.curb.z, 0);
  game.look.yaw = d.curb.yaw;
  club.lockUntil = now() + T.lockSecs;
  club.lastOk.copy(game.move.pos);
  go("lockout");
}

function fmt(s) { const m = Math.floor(s / 60), r = Math.ceil(s % 60); return r === 60 ? `${m + 1}:00` : `${m}:${String(r).padStart(2, "0")}`; }

/* ------------------------------------------------------ the line, by X */

function joinLine() {
  if (club.queue.includes(ME)) return;
  club.queue.push(ME);
  go("queued");
  ui.chip(null);
}
function leaveLine() {
  const i = club.queue.indexOf(ME);
  if (i >= 0) club.queue.splice(i, 1);
  go("none");
  showWaveBanner("You stepped out of the line. Back of it if you want in", 2200);
}

rpExtras.push(() => {
  const d = door();
  if (!d || !club.live || !game.player.alive) return null;
  if (club.phase === "queued") return { key: "club-leave", label: "Step out of the line", ctx: "Leave", time: 0.6, done: leaveLine };
  if (bandNow() > BAND.none || clubHolds()) return null;
  if (club.phase === "lockout" && club.lockUntil > now()) return null;
  const p = game.move.pos;
  if (d.zoneOf(p.x, p.y + 0.1, p.z) !== "street" || Math.hypot(p.x - d.mouth.x, p.z - d.mouth.z) > 16) return null;
  return { key: "club-join", label: "Get in line", ctx: "Line", time: 0.4, done: joinLine };
});

/* ------------------------------------------------------------ the fence */

function fence(d) {
  const p = game.move.pos;
  if (clubHolds()) { club.lastOk.copy(p); return; }
  const zone = d.zoneOf(p.x, p.y + 0.1, p.z);
  const band = bandNow();
  if (OPENS[band].includes(zone)) { club.lastOk.copy(p); return; }
  p.copy(club.lastOk);
  game.move.velocity.set(0, 0, 0);
  if (now() - club.fenceMsgAt > 1.6) {
    club.fenceMsgAt = now();
    showWaveBanner(band === BAND.none ? "Wristband only. Line's out front" : zone === "vip" ? "VIP only" : "Staff only", 1500);
  }
}

/* ------------------------------------------------------------------ UI */

const ui = {
  root: null, card: null, dialog: null, chipEl: null, onAnswer: null, wasLocked: false,
  mount() {
    if (this.root) return;
    injectCss();
    this.root = document.createElement("div");
    this.root.className = "club-entry";
    this.root.innerHTML = `
      <div class="club-card" hidden></div>
      <div class="club-ask" role="dialog" aria-modal="true" aria-labelledby="club-ask-q" hidden>
        <p id="club-ask-q">You 18 or older?</p>
        <div class="club-ask-btns">
          <button type="button" data-a="1" aria-label="Yeah, I'm 18 or older">Yeah <kbd>1</kbd></button>
          <button type="button" data-a="0" aria-label="No, I'm under 18">No <kbd>2</kbd></button>
        </div>
      </div>
      <div class="club-chip" hidden></div>`;
    (game.els.hud || document.body).appendChild(this.root);
    this.card = this.root.querySelector(".club-card");
    this.dialog = this.root.querySelector(".club-ask");
    this.chipEl = this.root.querySelector(".club-chip");
    this.dialog.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-a]");
      if (b) this.answer(b.dataset.a === "1");
    });
    window.addEventListener("keydown", (e) => {
      if (this.dialog.hidden) return;
      const yes = e.code === "Digit1" || e.code === "KeyY" || e.code === "Numpad1";
      const no = e.code === "Digit2" || e.code === "KeyN" || e.code === "Numpad2";
      if (!yes && !no) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.answer(yes);
    }, true);
  },
  showCard() {
    this.mount();
    this.card.innerHTML = renderCard(myCardData());
    this.card.hidden = false;
  },
  hideCard() { if (this.card) this.card.hidden = true; },
  ask(fn) {
    this.mount();
    this.onAnswer = fn;
    releaseHeldInputs();
    this.wasLocked = !game.isTouch && !!document.pointerLockElement;
    if (this.wasLocked) game.controls?.unlock?.();
    this.dialog.hidden = false;
    this.dialog.querySelector("button")?.focus();
  },
  answer(yes) {
    if (this.dialog.hidden) return;
    this.dialog.hidden = true;
    releaseHeldInputs();
    if (this.wasLocked && game.gameState === "playing") game.controls?.lock?.();
    const fn = this.onAnswer;
    this.onAnswer = null;
    fn?.(yes);
  },
  chip(text) {
    if (!text) { if (this.chipEl) this.chipEl.hidden = true; return; }
    this.mount();
    if (this.chipEl.textContent !== text) this.chipEl.textContent = text;
    this.chipEl.hidden = false;
  },
  hideAll() {
    if (!this.root) return;
    this.card.hidden = this.dialog.hidden = this.chipEl.hidden = true;
    this.onAnswer = null;
  },
};

function injectCss() {
  if (document.getElementById("club-entry-css")) return;
  const s = document.createElement("style");
  s.id = "club-entry-css";
  s.textContent = `
.club-entry { position: absolute; inset: 0; pointer-events: none; z-index: 30; font-family: inherit; }
.club-card { position: absolute; left: 50%; bottom: 12%; transform: translateX(-50%) rotate(-4deg); width: min(360px, 86vw);
  filter: drop-shadow(0 10px 24px rgba(0,0,0,.55)); animation: club-card-up .45s cubic-bezier(.2,.8,.2,1); }
@keyframes club-card-up { from { transform: translate(-50%, 60%) rotate(-10deg); opacity: 0; } }
.club-ask { position: absolute; left: 50%; top: 58%; transform: translate(-50%, -50%); pointer-events: auto; text-align: center;
  background: rgba(14,10,18,.88); border: 1px solid rgba(255,63,180,.55); border-radius: 14px; padding: 16px 22px 18px;
  box-shadow: 0 0 28px rgba(255,63,180,.25); color: #fff; min-width: min(300px, 86vw); }
.club-ask p { margin: 0 0 12px; font-size: 20px; font-weight: 700; letter-spacing: .02em; }
.club-ask-btns { display: flex; gap: 10px; justify-content: center; }
.club-ask button { font: inherit; font-size: 16px; font-weight: 700; padding: 10px 18px; border-radius: 10px; cursor: pointer; color: #fff;
  background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.25); min-width: 108px; }
.club-ask button[data-a="1"] { background: #ff3fb4; border-color: #ff3fb4; color: #160612; }
.club-ask button:focus-visible { outline: 2px solid #ffd080; outline-offset: 2px; }
.club-ask kbd { font: inherit; font-size: 11px; opacity: .7; margin-left: 6px; padding: 1px 5px; border-radius: 4px; border: 1px solid currentColor; }
.club-chip { position: absolute; left: 50%; top: 14%; transform: translateX(-50%); padding: 6px 12px; border-radius: 999px;
  background: rgba(14,10,18,.8); border: 1px solid rgba(255,63,180,.5); color: #fff; font-size: 14px; font-weight: 600; white-space: nowrap; }
@media (max-width: 760px) { .club-ask p { font-size: 18px; } .club-chip { font-size: 12px; top: 18%; } }
`;
  document.head.appendChild(s);
}

if (new URLSearchParams(location.search).has("tohooks")) {
  window.__trollClub = {
    club, T, BAND, answer: (yes) => ui.answer(yes), join: joinLine, leave: leaveLine, band: () => clubBand(),
    // Other tests that need the club's floor: already through the door, banded.
    pass() {
      const i = club.queue.indexOf(ME);
      if (i >= 0) club.queue.splice(i, 1);
      if (bandNow() === BAND.none) { club.band = BAND.guest; club.room = roomKey(); }
      ui.hideAll();
      go("in");
      club.lastOk.copy(game.move.pos);
    },
  };
}
