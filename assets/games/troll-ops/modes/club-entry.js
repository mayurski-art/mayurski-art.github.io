/* Socialize, Trolling Loud: the door (CLUB-ENTRY.md; user, 2026-10-07/08).
   You spawn in the line along the rope with 1-7 clubgoers ahead of you
   (a line of 6-7). It moves up as the two lanes, Big Lulz's and Tank's,
   check people in. At the front you show your ID (signed in: your profile
   card; guests skip it), say whether you're 18, and get a wristband; the
   wristband is your pass through any door for the rest of the session.
   Under 18 and you're thrown out onto the curb and locked out for two
   minutes. troll_runner skips all of it: he spawns inside wearing the
   owner band, which opens every door, VIP and back of house included.

   Phases 1-3 of the doc: the whole flow, solo, and the look: the velvet
   rope Big Lulz unhooks for each person, the bouncers' acts (ID, band,
   wave in), the band on your right wrist (first and third person; the
   clubgoers' too), and security's hand up at a door your band doesn't
   open; the kick-out (the bouncers carry you off and toss you on the curb;
   view/club-entry-cine.js films it).

   Phase 4, the room: every human in the line has a ticket (when they
   joined, on the room clock) and the line keeps them in ticket order, each
   behind the human ahead; the local clubgoers fill in round them. Your band,
   ticket and door phase go out in your state packet (net.js wb, cq, ce),
   and everyone else's copy of the door plays your part of it: the bouncers
   check you, band you, wave you in or throw you out on their screens too,
   and your body holds out the card (a plain gold one), the wrist, gets
   carried, sits on the curb. Whoever doesn't answer at the front in 25 s
   while another human waits goes to the back.

   The pass is a zone fence, not doors: after you move, the spot you're in
   (trollingloud.js entryZoneOf: street / main / vip / back) has to be one
   your band opens, or you're put back where you were. Only on a map with
   `rp.door` (Trolling Loud), only in Socialize. */

import * as THREE from "three";
import { rpExtras } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1";
import { releaseHeldInputs } from "../menu/pause.js?v=pa1-mb1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2";
import { myCardData } from "../profile-card.js?v=pc1-wst-sb2-fu1-wb1";
import { renderClubId, drawMiniLicence } from "../view/club-id-card.js?v=cid1-cid2";
import { isOwner } from "../progression.js?v=p5-wst-sb2-fu1-wb1";
import { reachHand, setFace } from "../character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u";
import { clubWear } from "./club-wear.js?v=cw1c2m1";
import { peerPosers } from "../remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1";
import { game } from "../core/state.js?v=st1";

export const BAND = { none: 0, guest: 1, owner: 2, vip: 3 };
/* The test (?tohooks=1) shortens the waits: window.__trollClub.T. */
const T = { lockSecs: 120, checkSecs: 3.0, idSecs: 2.6, bandSecs: 1.8, afkSecs: 25 };
const SNAP_AT = 0.5;       // into the band act: the moment it snaps shut
const WAVE_SECS = 1.3;     // the bouncer's wave in, after a band
const ROPE_OPEN = 1.4, ROPE_SHUT = 1.5;   // s
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
  phase: "none",           // none queued lane id ask band walk in kick lockout
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
  blocks: [],              // security putting a hand up at you: [{ i, n, t }]
  snapped: false,          // our band's on (the snap's been heard)
  kick: null,              // the kick-out playing: { tc, ... } (startKick)
  sit: 0,                  // sat on the curb after it (1), up as you move off
  cineHide: null,          // view/club-entry-cine.js: take its overlay down
  ticket: 0,               // when we joined the line, on the room clock (ms)
  remotes: new Map(),      // the other humans here: id -> { remote, ph, lane, cq, K, ... }
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
  club.spawns = (club.spawns || 0) + 1;   // (the tests count them)
  resetDoor();
  const d = door();
  if (!d) return;
  addActions();
  club.live = true;
  club.lanes = d.lanes.map((l, k) => {
    const list = game.townNpcs?.list || [];
    const bi = list.findIndex((n) => n.c.name === l.bouncer);
    const b = list[bi];
    const lane = { who: null, t: 0, x: l.x, z: l.z, yaw: b ? yawTo(l.x, l.z, b.x, b.z) : 0, b: null, bi, waveT: 99, w: 0, act: "idle" };
    // Big Lulz (the first lane) also works the rope.
    if (b) lane.b = game.townNpcs.takeOver(bi, (n, rig, dt) => poseBouncer(lane, k === 0, n, rig, dt));
    return lane;
  });
  takeLine(d);
  rope.build(d);
  if (bandNow() > BAND.none) { toLobby(d); return; }
  // Somewhere in the line: 1-7 ahead of you (as many as there are).
  const ahead = 1 + Math.floor(Math.random() * Math.min(7, club.queue.length));
  club.queue.splice(Math.min(ahead, club.queue.length), 0, ME);
  club.ticket = roomNow();
  club.spawnAhead = club.queue.indexOf(ME);   // (the test reads it: the line may have moved since)
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
    const e = { i, n: null, state: k < inLine ? "line" : "inside", t: 0, y0: 0, arm: 0 };
    const n = T_.takeOver(i, (n_, rig, dt) => poseGoer(e, rig, dt));
    e.n = n;
    e.y0 = n.c.y ?? 0;
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
    if (e.n) { e.n.off = false; e.n.c.y = e.y0; e.n.rig.band = 0; }
    game.townNpcs?.release(e.i);
  }
  for (const l of club.lanes) {
    if (l.b) game.townNpcs?.release(l.bi);
    l.card?.parent?.remove(l.card);
  }
  for (const b of club.blocks) game.townNpcs?.release(b.i);
  club.blocks = [];
  for (const R of club.remotes.values()) dropRemote(R);
  club.remotes.clear();
  club.ticket = 0;
  rope.drop();
  clubWear.band = 0;
  clubWear.glow = 0;
  if (game.localRig) { game.localRig.band = 0; game.localRig.root.rotation.x = 0; }
  Object.assign(club, { phase: "none", t: 0, queue: [], npcs: [], lanes: [], lane: -1, walkTo: [], live: false, kick: null, sit: 0 });
  club.cineHide?.();
  ui.hideAll();
}

function go(phase) { club.phase = phase; club.t = 0; }

/* ------------------------------------------------------- each frame */

/* After movement (view/player-update.js): the line and the lanes, our own
   steps through the door, and the fence. */
export function updateClubEntry(dt) {
  const d = door();
  if (!d) { if (club.live) resetDoor(); wireOut(); return; }
  if (!club.live) { wireOut(); return; }   // not spawned here yet
  club.t += dt;
  syncRemotes(d, dt);
  stepNpcs(d, dt);
  stepMe(d, dt);
  fence(d);
  stepBlocks(dt);
  rope.step(d, dt);
  // Our band, on our wrist from the snap on.
  const before = club.phase === "band" && !club.snapped;
  clubWear.band = before ? BAND.none : bandNow();
  clubWear.glow = Math.max(0, clubWear.glow - dt * 0.9);
  const rig = game.localRig;
  if (rig) {
    rig.band = clubWear.band;
    rig.bandMesh?.userData.glow?.(clubWear.glow);
  }
  wireOut();
}

/* Is the door moving us (in the line, at a lane, walking in)? Then
   view/player-update.js lets clubHold() move us instead of the keys. */
export function clubHolds() {
  return club.live && ["queued", "lane", "id", "ask", "band", "walk", "kick"].includes(club.phase);
}
export function clubHold(dt) {
  const d = door();
  const m = game.move;
  m.velocity.set(0, 0, 0);
  m.sprinting = false;
  m.grounded = true;
  if (club.kick) {
    // Carried, thrown: wherever the bouncers have us.
    const b = kickBody(club.kick, club.kick.tc);
    m.pos.set(b.x, b.y, b.z);
    m.moving = false;
    game.look.yaw = b.yaw;
    game.look.pitch = 0;
    return;
  }
  let target = null;
  if (club.phase === "queued") target = slotOf(d, club.queue.indexOf(ME));
  else if (club.phase === "lane") target = club.lanes[club.lane];
  // Up to the rope, and through only once it's off its hook.
  else if (club.phase === "walk" && (club.walkTo.length !== 1 || rope.k > 0.85)) target = club.walkTo[0];
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
  const inLine = club.queue.filter((e) => e.n).length + club.npcs.filter((e) => e.state === "arrive").length;
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
        // His bouncer's off helping throw someone out: he waits.
        if (l.hold) { e.t -= dt; break; }
        if (near(n, l) && e.t > 0.5) {
          n.yaw = l.yaw;
          if (!e.checkT) e.checkT = e.t;
          // The bouncer looks the ID over, then the band: the arm goes out
          // for it, and it's snapped shut.
          const bk = npcBandK(e);
          e.arm = bk > 0 ? Math.min(1, bk / 0.25) * Math.min(1, (1 - bk) / 0.15) : 0;
          if (bk >= SNAP_AT && !n.rig.band) { n.rig.band = BAND.guest; snapSound({ x: n.x, y: 1.1, z: n.z }, 0.5); }
          if (e.t - e.checkT > T.checkSecs) { sendIn(e, l, d); l.waveT = 0; l.waved = e; }
        }
        break;
      }
      case "door":
        target = e.path[0];
        if (e.path.length === 1 && rope.k < 0.85) { target = null; n.yaw = turn(n.yaw, 0, dt * 4); }   // the rope's still up
        else if (near(n, target)) { e.path.shift(); if (!e.path.length) { e.state = "inside"; n.off = true; e.t = 0; } }
        break;
      case "inside":
        if (inLine < want && e.t > 3) { e.state = "arrive"; n.off = false; n.rig.band = 0; n.x = d.arrive.x; n.z = d.arrive.z; e.t = 0; }
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
    if (l.who || l.hold || l.t < LANE_GAP || !front) continue;
    // Another human at the front: their own client sends them up.
    if (front.remote) break;
    if (!near(front.me ? game.move.pos : front.n, d.line[0], 0.25)) break;
    club.queue.shift();
    l.who = front;
    if (front.me) { club.lane = club.lanes.indexOf(l); go("lane"); }
    else { front.state = "lane"; front.lane = club.lanes.indexOf(l); front.t = 0; front.checkT = 0; }
  }
}

/* A clubgoer done at his lane (or bumped off it by another human taking
   it): banded, through the door and inside. */
function sendIn(e, l, d) {
  e.state = "door"; e.t = 0; e.arm = 0;
  if (!e.n.rig.band) e.n.rig.band = BAND.guest;
  e.path = [d.mouth, { x: d.lobby.x + (Math.random() - 0.5) * 2, z: d.lobby.z + 1.5 }];
  l.who = null; l.t = 0;
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
  // Up at the bouncer, eyes on his hands.
  if (["lane", "id", "ask"].includes(club.phase) && club.lane >= 0 && near(p, club.lanes[club.lane], 0.3)) game.look.pitch += (-0.2 - game.look.pitch) * Math.min(1, dt * 3);
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
    case "ask":
      // Nobody home while another human waits: to the back.
      if (club.t > T.afkSecs && othersWaiting()) toBack();
      break;
    case "band":
      game.look.yaw = turn(game.look.yaw, club.lanes[club.lane].yaw, dt * 5);
      game.look.pitch += (-0.55 - game.look.pitch) * Math.min(1, dt * 4);   // down at your wrist
      if (!club.snapped && club.t >= T.bandSecs * SNAP_AT) {
        club.snapped = true;
        clubWear.glow = 1;
        snapSound(null, 1);
      }
      if (club.t > T.bandSecs) {
        freeLane();
        club.walkTo = [d.mouth, { x: d.lobby.x, z: d.lobby.z }];
        go("walk");
      }
      break;
    case "walk":
      if (club.t < 1.2) game.look.pitch += (0 - game.look.pitch) * Math.min(1, dt * 4);
      if (club.walkTo.length && near(p, club.walkTo[0], 0.08)) club.walkTo.shift();
      if (!club.walkTo.length) { go("in"); showWaveBanner("You're in. The band gets you through any door tonight", 2600); }
      break;
    case "kick": {
      // The cinematic's own clock: slow round the landing.
      const K = club.kick;
      K.tc += dt * (K.tc > KICK.slow0 && K.tc < KICK.slow1 ? KICK.slowRate : 1);
      kickCues(K);
      if (K.tc >= KICK.end) endKick();
      break;
    }
    case "lockout": {
      // Stays in lockout till they rejoin; the chip says how.
      const left = club.lockUntil - now();
      ui.chip(left > 0 ? `Bounced · back in line in ${fmt(left)}` : "Hold X to get back in line");
      break;
    }
    default: break;
  }
  if (club.phase !== "lockout") ui.chip(club.phase === "queued" ? "In line · hold X to step out" : null);
}

function freeLane(wave = true) {
  const l = club.lanes[club.lane];
  if (l) { l.who = null; l.t = 0; if (wave) { l.waveT = 0; l.waved = ME; } }
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
    club.snapped = false;
    const who = door()?.lanes[club.lane]?.bouncer || "The bouncer";
    showWaveBanner(`${who} snaps a wristband on you`, 2200);
    go("band");
    return;
  }
  club.kick = startKick(club.lane, ME);
  go("kick");
}

function fmt(s) { const m = Math.floor(s / 60), r = Math.ceil(s % 60); return r === 60 ? `${m + 1}:00` : `${m}:${String(r).padStart(2, "0")}`; }

/* ---------------------------------------------------------- the kick-out */

/* Under 18 (plays in full every time; user, 2026-10-08): your bouncer shakes
   his head, the other one comes round behind you, they take an arm each and
   carry you off your feet across the alley, swing you once and toss you on
   your back by the curb under the scaffold. You come round sat on the curb.
   Times are on the cinematic's own clock, `tc`, which runs slow round the
   landing; view/club-entry-cine.js films it. */
export const KICK = {
  grab: 1.7, lift: 2.0, carry: 2.3, swing: 4.0, fly: 4.4, land: 4.9,
  slow0: 4.62, slow1: 5.0, slowRate: 0.35, cut: 5.7, end: 6.3,
};
const LIFT = 0.26;   // m off your feet while they carry you
const HIP = 0.95;    // feet to hips, for the arc you're thrown in
const LIE_Y = 0.1;   // the hips' height lying on your back
const SIDE = 0.62;   // a bouncer's step out to your side
export const CURB_EYE = 0.95;   // eye height sat on the curb

/* The throw-out of whoever's at lane `li` (us, ME, or another human). The
   other lane's bouncer comes to help unless a human's at his podium. */
function startKick(li, who) {
  const l = club.lanes[li];
  const oi = club.lanes.findIndex((x, i) => i !== li && x.b && !x.kick && !(x.who && (x.who.me || x.who.remote)));
  const K = {
    tc: 0, li, oi, who, me: who === ME, yaw0: who === ME ? game.look.yaw : who.rp.yaw, from: {}, cues: {},
    B0: { x: l.x, z: l.z },
    // Thrown from the middle of the alley, a step in from the lane.
    P1: { x: l.x * 0.35, z: 27.5 },
    // Your bouncer takes the side of you he's on; the other one comes round.
    sideS: l.b ? Math.sign(l.b.x - l.x) || 1 : 1,
  };
  for (const i of [li, oi]) { const b = club.lanes[i]?.b; if (b) K.from[i] = { x: b.x, z: b.z }; }
  l.kick = K;
  if (oi >= 0) { club.lanes[oi].hold = true; club.lanes[oi].kick = K; }
  return K;
}
/* The bouncers let go of it: the lane's free, the helper back to his own. */
function clearKick(K) {
  const l = club.lanes[K.li];
  if (l) { if (l.who === K.who) l.who = null; l.t = 0; l.kick = null; }
  const o = club.lanes[K.oi];
  if (o) { o.hold = false; o.kick = null; }
}

function endKick() {
  const K = club.kick;
  clearKick(K);
  club.lane = -1;
  club.kick = null;
  // Sat on the curb where you landed, looking back at the door.
  game.move.reset(K.P1.x, K.P1.z + 1.1, 0);
  game.look.yaw = 0;
  game.look.pitch = 0.06;
  club.sit = 1;
  if (game.localRig) game.localRig.root.rotation.x = 0;
  club.lockUntil = now() + T.lockSecs;
  club.lastOk.copy(game.move.pos);
  club.cineHide?.();
  go("lockout");
}

/* Where we are at `tc`: feet (the rig's root), facing, and how far over on
   our back (`lie`, radians about our own x). Before the toss we hang
   between the bouncers; thrown, our hips fly an arc and we turn over
   onto our back. */
const _kb = { x: 0, y: 0, z: 0, yaw: 0, lie: 0 };
export function kickBody(K, tc, o = _kb) {
  const { B0, P1 } = K;
  o.yaw = turn(K.yaw0, Math.PI, smooth((tc - KICK.grab) / 0.4));   // turned round to face the street
  o.lie = 0;
  if (tc < KICK.carry) {
    o.x = B0.x; o.z = B0.z;
    o.y = LIFT * smooth((tc - KICK.lift) / (KICK.carry - KICK.lift));
  } else if (tc < KICK.swing) {
    const u = smooth((tc - KICK.carry) / (KICK.swing - KICK.carry));
    o.x = B0.x + (P1.x - B0.x) * u; o.z = B0.z + (P1.z - B0.z) * u;
    o.y = LIFT + Math.abs(Math.sin(tc * 9)) * 0.03;   // their steps
  } else if (tc < KICK.fly) {
    // One swing back toward the door, and forward.
    const s = Math.sin(Math.PI * (tc - KICK.swing) / (KICK.fly - KICK.swing));
    o.x = P1.x; o.z = P1.z - 0.42 * s; o.y = LIFT - 0.1 * s;
  } else {
    const u = Math.min(1, (tc - KICK.fly) / (KICK.land - KICK.fly));
    const th = (Math.PI / 2 - 0.03) * smooth(u);
    const hy = LIFT + HIP + (LIE_Y - LIFT - HIP) * u + 0.75 * 4 * u * (1 - u);
    // Thrown forward and flopping over backwards: the hips sail on, the
    // head comes back toward the door.
    const hz = P1.z + 0.9 * u;
    o.x = P1.x; o.y = hy - HIP * Math.cos(th); o.z = hz + HIP * Math.sin(th);
    o.lie = th;
    // A bounce off the pavement.
    if (tc > KICK.land) o.y += Math.sin(Math.min(1, (tc - KICK.land) / 0.3) * Math.PI) * 0.05;
  }
  return o;
}

/* The sounds, each once as the clock passes it (someone else thrown out:
   at their body, and no stamp, that's on our cinematic). */
const _kc = { x: 0, y: 0, z: 0, yaw: 0, lie: 0 };
function kickCues(K) {
  const a = game.audio;
  if (!a?._ready?.()) return;
  const b = K.me ? game.move.pos : kickBody(K, K.tc, _kc);
  const at = { x: b.x, y: 1, z: b.z };
  const cue = (name, t, fn) => { if (K.tc >= t && !K.cues[name]) { K.cues[name] = 1; if (K.me || name !== "stamp") fn(); } };
  cue("grab", KICK.grab + 0.15, () => {
    a._noise({ duration: 0.12, gain: 0.35, type: "bandpass", freq: 900, q: 1.5, at });
    a._noise({ duration: 0.09, gain: 0.25, type: "bandpass", freq: 700, q: 1.5, delay: 0.1, at });
  });
  cue("lift", KICK.lift + 0.05, () => a._tone({ freq: 190, to: 120, duration: 0.18, gain: 0.08, type: "triangle", at }));
  cue("toss", KICK.fly - 0.05, () => a._noise({ duration: 0.5, gain: 0.4, type: "bandpass", freq: 380, q: 1.2, sweepTo: 1700, at }));
  cue("land", KICK.land, () => {
    a._tone({ freq: 95, to: 36, duration: 0.42, gain: 0.55, type: "sine", at });
    a._noise({ duration: 0.3, gain: 0.5, type: "lowpass", freq: 420, at });
  });
  // The trollface stamped on the shot.
  cue("stamp", KICK.land + 0.12, () => {
    a._tone({ freq: 150, to: 55, duration: 0.2, gain: 0.32, type: "square" });
    a._noise({ duration: 0.12, gain: 0.35, type: "lowpass", freq: 900 });
  });
}

/* Along a path of points at `s` metres in: where, which way, and whether
   it's the end. */
const _pp = { x: 0, z: 0, yaw: 0, done: false };
function alongPath(pts, s, o = _pp) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z);
    o.yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
    if (s <= len || i === pts.length - 2) {
      const k = len > 0 ? Math.min(1, s / len) : 1;
      o.x = a.x + (b.x - a.x) * k; o.z = a.z + (b.z - a.z) * k;
      o.done = i === pts.length - 2 && k >= 1;
      return o;
    }
    s -= len;
  }
  return o;
}

/* A bouncer back to his post at a walk (after a kick-out). True while he's
   still on his way. */
function walkHome(n, dt) {
  const h = n.home;
  if (!h) return false;
  const dx = h.x - n.x, dz = h.z - n.z, dd = Math.hypot(dx, dz);
  n.moving = dd > 0.05;
  if (dd > 0.01) { const st = Math.min(dd, 2.2 * dt); n.x += dx / dd * st; n.z += dz / dd * st; }
  if (dd > 0.3) n.yaw = turn(n.yaw, Math.atan2(-dx, -dz), dt * 8);
  return dd > 0.3;
}

/* Big Lulz or Tank throwing you out. */
const _bk = { x: 0, y: 0, z: 0, yaw: 0, lie: 0 }, _ga = new THREE.Vector3(), _gb = new THREE.Vector3();
function poseKicker(l, n, rig, dt) {
  const K = l.kick, tc = K.tc, p = rig.parts;
  const i = club.lanes.indexOf(l);
  const shaker = i === K.li;
  const side = shaker ? K.sideS : -K.sideS;
  idCard(l, rig, false);
  foldArms(p);
  l.w = l.wl = 0;
  const y0 = n.c.y ?? 0;
  if (tc >= KICK.cut) {
    walkHome(n, dt);
    p.headPivot.rotation.set(0, 0, 0);
    return;
  }
  const from = K.from[i] || n;
  const b = kickBody(K, Math.min(tc, KICK.fly), _bk);
  const sx = b.x + side * SIDE, sz = b.z;   // beside you
  let yaw, moving = false, grip = 0, shake = 0, head = 0;
  if (tc < KICK.grab) {
    if (shaker) {
      // "Nah." A slow shake of the head, arms folded.
      n.x = from.x; n.z = from.z;
      yaw = yawTo(n.x, n.z, K.B0.x, K.B0.z);
      shake = env((tc - 0.2) / 1.35, 0.15, 0.2);
      head = 0.12;
    } else {
      // Round behind you to your other side, at a jog.
      const r = alongPath([from, { x: K.B0.x, z: K.B0.z + 1.1 }, { x: K.B0.x + side * SIDE, z: K.B0.z }], Math.max(0, tc - 0.1) * 4.6);
      n.x = r.x; n.z = r.z;
      moving = !r.done;
      yaw = r.done ? Math.PI : r.yaw;
      // His way round passes the camera's shoulder: out of the shot while
      // he's right on the lens.
      const cam = game.camera.position;
      rig.root.visible = !K.me || Math.hypot(cam.x - n.x, cam.z - n.z) > 2.2;
    }
  } else {
    // At your sides, facing down the alley; an arm each, up you go, and
    // off across the alley with you.
    const k = smooth((tc - KICK.grab) / 0.3);
    if (shaker) { n.x = from.x + (sx - from.x) * k; n.z = from.z + (sz - from.z) * k; }
    else { n.x = sx; n.z = sz; }
    yaw = shaker ? turn(yawTo(from.x, from.z, K.B0.x, K.B0.z), Math.PI, k) : Math.PI;
    moving = (tc > KICK.carry && tc < KICK.swing) || (shaker && k > 0.05 && k < 0.95);
    grip = tc < KICK.fly ? smooth((tc - KICK.grab - 0.1) / 0.25) : Math.max(0, 1 - (tc - KICK.fly) / 0.2);
    head = tc > KICK.fly ? 0.3 : 0.1;
  }
  n.yaw = turn(n.yaw, yaw, Math.min(1, dt * 12));
  n.moving = moving;
  _f.set(-Math.sin(n.yaw), 0, -Math.cos(n.yaw));
  _x.set(Math.cos(n.yaw), 0, -Math.sin(n.yaw));
  if (grip > 0) {
    // His near hand on your upper arm, the other on your forearm; through
    // the release they follow you a moment.
    const ub = kickBody(K, Math.min(tc, KICK.fly + 0.12), _bk);
    const near = side > 0 ? 1 : -1;   // facing down the alley, you're on his right from the +x side
    reachW(rig, near, _ga.set(ub.x + side * 0.27, ub.y + 1.3, ub.z + 0.03), grip);
    reachW(rig, -near, _gb.set(ub.x + side * 0.44, ub.y + 1.1, ub.z - 0.06), grip);
  } else if (tc > KICK.land + 0.25) {
    // Dusting his hands off.
    const e = env((tc - KICK.land - 0.25) / 0.9, 0.2, 0.25);
    const rub = Math.sin(tc * 26) * 0.045;
    reachW(rig, 1, _ga.set(n.x, y0 + 1.12, n.z).addScaledVector(_f, 0.3).addScaledVector(_x, rub), e);
    reachW(rig, -1, _gb.set(n.x, y0 + 1.12, n.z).addScaledVector(_f, 0.3).addScaledVector(_x, -rub), e);
  }
  p.headPivot.rotation.x = head;
  p.headPivot.rotation.y = Math.sin(tc * 8.5) * 0.42 * shake;
}

/* Us, carried and thrown (third person; the cinematic's camera sees it
   whatever your view setting). Over the idle pose: arms out where they hold
   them, legs kicking; flailing in the air; flat on our back, splayed. */
const _kp = { x: 0, y: 0, z: 0, yaw: 0, lie: 0 };
const mix = (a, b, k) => a + (b - a) * k;
function poseKicked(rig, K, tc) {
  const p = rig.parts;
  const b = kickBody(K, tc, _kp);
  rig.root.position.set(b.x, b.y, b.z);
  rig.root.rotation.set(b.lie, b.yaw, 0, "YXZ");
  const held = tc < KICK.grab || tc > KICK.fly + 0.1 ? 0 : smooth((tc - KICK.grab - 0.1) / 0.25);
  const kick = tc < KICK.lift || tc > KICK.fly + 0.1 ? 0 : smooth((tc - KICK.lift) / 0.25);
  const fly = tc < KICK.fly ? 0 : smooth((tc - KICK.fly) / 0.15) * (1 - smooth((tc - KICK.land) / 0.25));
  const lie = smooth((tc - KICK.land) / 0.25);
  const W = Math.min(1, held + fly + lie);
  if (W > 0.001) {
    const w = (h, f, l) => (held * h + fly * f + lie * l) / Math.max(1e-3, held + fly + lie);
    p.armR.rotation.z = mix(p.armR.rotation.z, w(0.75, 1.5 + Math.sin(tc * 17) * 0.35, 1.25), W);
    p.armL.rotation.z = mix(p.armL.rotation.z, -w(0.75, 1.5 + Math.sin(tc * 15 + 1) * 0.35, 1.1), W);
    p.armR.rotation.x = mix(p.armR.rotation.x, w(-0.1, -0.5, 0.3), W);
    p.armL.rotation.x = mix(p.armL.rotation.x, w(-0.1, -0.4, 0.15), W);
    p.elbowR.rotation.x = mix(p.elbowR.rotation.x, w(0.35, 0.5, 0.3), W);
    p.elbowL.rotation.x = mix(p.elbowL.rotation.x, w(0.35, 0.6, 0.45), W);
  }
  // Legs: kicking while they carry you, tucked in the air, one knee up on
  // the ground.
  const s = Math.sin(tc * 12), c = Math.sin(tc * 12 + Math.PI);
  const LW = Math.min(1, kick + fly + lie);
  if (LW > 0.001) {
    const w = (k, f, l) => (kick * k + fly * f + lie * l) / Math.max(1e-3, kick + fly + lie);
    p.legL.rotation.x = mix(p.legL.rotation.x, w(0.35 + 0.55 * s, 0.75, 0.08), LW);
    p.legR.rotation.x = mix(p.legR.rotation.x, w(0.35 + 0.55 * c, 1.05, 0.8), LW);
    p.legL.rotation.z = mix(p.legL.rotation.z, w(0, -0.1, -0.14), LW);
    p.legR.rotation.z = mix(p.legR.rotation.z, w(0, 0.1, 0.1), LW);
    p.kneeL.rotation.x = mix(p.kneeL.rotation.x, w(-0.55 - 0.45 * Math.max(0, -s), -0.9, -0.15), LW);
    p.kneeR.rotation.x = mix(p.kneeR.rotation.x, w(-0.55 - 0.45 * Math.max(0, -c), -1.25, -1.4), LW);
  }
  // Head: up at the bouncer, shaking "no no no" as they carry you, rolled
  // over on the ground.
  p.headPivot.rotation.x = tc < KICK.grab ? -0.12 : mix(0.05, 0.3, fly) - lie * 0.15;
  p.headPivot.rotation.y = Math.sin(tc * 7) * 0.35 * kick;
  p.headPivot.rotation.z = lie * 0.42;
  if (tc > KICK.fly + 0.2) setFace(rig, "sad");
  rig.body?.update?.();
}

/* Sat on the curb: knees up, forearms on them, a sad face. */
const _hip = new THREE.Vector3(), _knee = new THREE.Vector3();
function poseCurbSit(rig) {
  const p = rig.parts;
  p.legL.rotation.set(2.0, 0, 0.12);
  p.legR.rotation.set(1.9, 0, -0.12);
  p.kneeL.rotation.set(-1.85, 0, 0);
  p.kneeR.rotation.set(-1.7, 0, 0);
  p.ankleL.rotation.set(0, 0, 0);
  p.ankleR.rotation.set(0, 0, 0);
  p.torso.rotation.x = 0.25;
  p.headPivot.rotation.x = 0.1;
  rig.root.updateMatrixWorld(true);
  p.hips.getWorldPosition(_hip);
  rig.root.position.y += 0.16 - _hip.y;
  rig.root.updateMatrixWorld(true);
  for (const side of [1, -1]) {
    (side > 0 ? p.kneeR : p.kneeL).getWorldPosition(_knee);
    _knee.y += 0.04;
    reachW(rig, side, _knee, 1);
  }
  setFace(rig, "sad");
  rig.body?.update?.();
}

/* First person after the kick-out: the eye sat low on the curb till you
   move off (view/player-update.js takes this off the eye height). */
export function clubEyeDrop(dt) {
  if (club.sit <= 0) return 0;
  if (!club.live || club.phase !== "lockout") club.sit = 0;
  else if (game.move.moving || !game.move.grounded) club.sitUp = true;
  if (club.sitUp) club.sit = Math.max(0, club.sit - dt / 0.4);
  if (club.sit <= 0) club.sitUp = false;
  return Math.max(0, game.move.eyeHeight - CURB_EYE) * smooth(club.sit);
}

/* ------------------------------------------------------ the line, by X */

function joinLine() {
  if (club.queue.includes(ME)) return;
  club.queue.push(ME);
  club.ticket = roomNow();
  go("queued");
  ui.chip(null);
}
function leaveLine() {
  const i = club.queue.indexOf(ME);
  if (i >= 0) club.queue.splice(i, 1);
  go("none");
  showWaveBanner("You stepped out of the line. Back of it if you want in", 2200);
}

/* Registered on the first spawn, not at load: the views import this module
   before social-rp.js has finished loading. */
let actionsOn = false;
function addActions() {
  if (actionsOn) return;
  actionsOn = true;
  rpExtras.push(lineAction);
  peerPosers.push(posePeer);
  // Gone from the tab at the front while someone waits: to the back.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && club.live && ["lane", "id", "ask"].includes(club.phase) && othersWaiting()) toBack();
  });
}
function lineAction() {
  const d = door();
  if (!d || !club.live || !game.player.alive) return null;
  if (club.phase === "queued") return { key: "club-leave", label: "Step out of the line", ctx: "Leave", time: 0.6, done: leaveLine };
  if (bandNow() > BAND.none || clubHolds()) return null;
  if (club.phase === "lockout" && club.lockUntil > now()) return null;
  const p = game.move.pos;
  if (d.zoneOf(p.x, p.y + 0.1, p.z) !== "street" || Math.hypot(p.x - d.mouth.x, p.z - d.mouth.z) > 16) return null;
  return { key: "club-join", label: "Get in line", ctx: "Line", time: 0.4, done: joinLine };
}

/* ------------------------------------------------------------- the room */

const STALE_MS = 2500;     // a human whose packets stop this long is skipped
const CE = ["lane", "id", "ask", "band", "walk", "kick", "sit"];
const AT_LANE = ["lane", "id", "ask", "band", "kick"];

/* The room's shared clock (DJ Lulz keeps the offset), for tickets. */
function roomNow() { return game.djLulz?.roomNow?.() ?? Date.now(); }

/* Ours, into the state packet (net.js). */
function wireOut() {
  const w = game.net?.club;
  if (!w) return;
  const on = club.live && !!door();
  w.wb = on ? clubWear.band : 0;
  w.cq = on && club.phase === "queued" ? Math.round(club.ticket) : 0;
  let ce = null;
  if (on) {
    if (club.kick) ce = `kick:${club.kick.li}:${club.kick.tc.toFixed(2)}`;
    else if (["lane", "id", "ask", "band", "walk"].includes(club.phase)) ce = `${club.phase}:${Math.max(0, club.lane)}:${club.t.toFixed(2)}`;
    else if (club.sit > 0.5) ce = "sit:0:0";
  }
  w.ce = ce;
}

function parseCe(s) {
  if (typeof s !== "string") return null;
  const [ph, l, t] = s.split(":");
  if (!CE.includes(ph)) return null;
  return { ph, lane: Math.max(0, Math.min(club.lanes.length - 1, l | 0)), t: Math.max(0, Math.min(600, +t || 0)) };
}

/* Everyone else at the door, from their packets: where they are in the
   line, which lane they're at and how far into it, a throw-out to play. */
function syncRemotes(d, dt) {
  const seen = new Set(), ms = performance.now();
  for (const [id, p] of game.net?.peers || []) {
    const rp = game.remotes?.byId?.get(id);
    if (!rp || ms - (p.stateAt || 0) > STALE_MS) continue;
    seen.add(id);
    let R = club.remotes.get(id);
    if (!R) club.remotes.set(id, R = { remote: true, id, p, rp, ph: null, t0: 0, tc: 0, lane: -1, cq: 0, K: null, kicked: false, raw: null });
    R.p = p; R.rp = rp;
    const ce = parseCe(p.ce);
    const ph = ce?.ph || null;
    const fresh = p.ce !== R.raw;
    R.raw = p.ce;
    // Seconds into their phase on our clock, put right when a packet's off.
    if (ph !== R.ph) { R.ph = ph; R.t0 = now() - (ce?.t || 0); R.kicked = false; }
    else if (fresh && ce && Math.abs(now() - R.t0 - ce.t) > 0.3) R.t0 = now() - ce.t;
    R.tc = now() - R.t0;
    R.cq = !ph && p.cq > 0 ? p.cq : 0;
    const want = ce && AT_LANE.includes(ph) && !R.kicked ? ce.lane : -1;
    if (R.lane !== want) {
      leaveLaneR(R, ph === "walk");
      if (want >= 0) claimLane(R, want, d);
    }
    // Thrown out: the same timeline as theirs, our bouncers doing it.
    if (ph === "kick" && !R.K && !R.kicked && R.lane >= 0) { R.K = startKick(R.lane, R); R.K.tc = ce.t; }
    if (R.K) {
      const K = R.K;
      if (ph !== "kick") { clearKick(K); R.K = null; }
      else {
        K.tc += dt * (K.tc > KICK.slow0 && K.tc < KICK.slow1 ? KICK.slowRate : 1);
        if (fresh && Math.abs(K.tc - ce.t) > 0.35) K.tc = ce.t;
        kickCues(K);
        if (K.tc >= KICK.end) { clearKick(K); R.K = null; R.kicked = true; R.lane = -1; }
      }
    }
  }
  for (const [id, R] of club.remotes) if (!seen.has(id)) { dropRemote(R); club.remotes.delete(id); }
  placeRemotes(d);
}

/* Another human takes lane `li`. A clubgoer there is waved straight in; if
   it's ours too (we both went for it at once) the lower id keeps it. */
function claimLane(R, li, d) {
  const l = club.lanes[li];
  if (!l || l.kick) return;
  const w = l.who;
  if (w === ME) {
    if (!["lane", "id"].includes(club.phase) || String(R.id) > String(game.net?.id)) return;
    ui.hideAll();
    club.lane = -1;
    club.queue = [ME, ...club.queue.filter((e) => e !== ME)];
    go("queued");
  } else if (w?.n) sendIn(w, l, d);
  else if (w?.remote) leaveLaneR(w, false);
  l.who = R; l.t = 0;
  R.lane = li;
}
function leaveLaneR(R, waved) {
  const l = club.lanes[R.lane];
  if (l && l.who === R) { l.who = null; l.t = 0; if (waved) { l.waveT = 0; l.waved = R; } }
  R.lane = -1;
}
function dropRemote(R) {
  if (R.K) { clearKick(R.K); R.K = null; }
  leaveLaneR(R, false);
  R.card?.parent?.remove(R.card);
  club.queue = club.queue.filter((e) => e !== R);
  for (const l of club.lanes) if (l.waved === R) l.waved = null;
}

/* The humans in the line, in ticket order, each where they're stood (or
   further back, behind the human ahead). Ourselves too: behind every human
   with an earlier ticket, ahead of every later one. The clubgoers take the
   places left. */
function placeRemotes(d) {
  const rs = [...club.remotes.values()].filter((R) => R.cq > 0).sort((a, b) => a.cq - b.cq || (String(a.id) < String(b.id) ? -1 : 1));
  const q = club.queue.filter((e) => !e.remote);
  let prev = -1;
  for (const R of rs) {
    let s = slotNear(d, R.rp.pos, q.length);
    const mi = q.indexOf(ME);
    const before = mi >= 0 && (R.cq < club.ticket || (R.cq === club.ticket && String(R.id) < String(game.net?.id)));
    if (mi >= 0 && !before) s = Math.max(s, mi + 1);
    s = Math.min(Math.max(s, prev + 1), q.length);
    q.splice(s, 0, R);
    prev = s;
    if (before && q.indexOf(ME) < s) {
      q.splice(q.indexOf(ME), 1);
      q.splice(s, 0, ME);   // straight after them (they're at s - 1 now)
      prev = s - 1;
    }
  }
  club.queue = q;
}
/* The place in the line nearest a spot (off the line: the back). */
function slotNear(d, p, back) {
  let best = back, bd = 1.6;
  d.line.forEach((s, i) => { const dd = Math.hypot(s.x - p.x, s.z - p.z); if (dd < bd) { bd = dd; best = i; } });
  return best;
}

function othersWaiting() {
  for (const R of club.remotes.values()) if (R.cq > 0) return true;
  return false;
}
/* Too slow at the front (or the tab's gone) with someone waiting: to the
   back of the line, with a new ticket. */
function toBack() {
  ui.hideAll();
  ui.hideCard();
  freeLane(false);
  club.queue = club.queue.filter((e) => e !== ME);
  club.queue.push(ME);
  club.ticket = roomNow();
  go("queued");
  showWaveBanner("Took too long. Back of the line", 2400);
}

/* Another human's body for their door phase: the card held out, the wrist
   out for the band, carried and thrown, sat on the curb. Their band on
   their wrist wherever they are. */
const _pw = new THREE.Vector3();
function posePeer(rp, dt) {
  const rig = rp.rig;
  rig.band = club.live && door() ? rp.peer.wb | 0 : 0;
  const R = club.live ? club.remotes.get(rp.peer.id) : null;
  if (!R) return;
  const ph = R.ph;
  if (ph === "kick" && R.K) { poseKicked(rig, R.K, R.K.tc); idCard(R, rig, false); return; }
  if (ph === "sit") { poseCurbSit(rig); idCard(R, rig, false); return; }
  if (ph === "id") {
    // The card out in front at chest height, toward the bouncer.
    const p = rp.pos, y = rp.yaw;
    const k = env(R.tc / T.idSecs, 0.12, 0.12);
    reachW(rig, 1, _pw.set(p.x - Math.sin(y) * 0.42 + Math.cos(y) * 0.08, p.y + 1.22, p.z - Math.cos(y) * 0.42 - Math.sin(y) * 0.08), k);
    idCard(R, rig, k > 0.5);
    rig.body?.update?.();
    return;
  }
  idCard(R, rig, false);
  if (ph === "band") {
    reachW(rig, 1, peerWrist(R, _pw), env(R.tc / T.bandSecs, 0.15, 0.25));
    rig.body?.update?.();
  }
}

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
    if (band > BAND.none) startBlock();
  }
}

/* ------------------------------------------------------------- the look */

const _w = new THREE.Vector3(), _s = new THREE.Vector3(), _pole = new THREE.Vector3(), _v = new THREE.Vector3();
const _qa = new THREE.Quaternion(), _qe = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const smooth = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
const env = (k, a, b) => Math.min(1, Math.max(0, k / a)) * Math.min(1, Math.max(0, (1 - k) / b));

/* The wrist onto a world point (two-bone IK in chest space, a fist short of
   it), blended in by `w` over whatever the arm was already doing. `up`
   lifts the elbow (a hand up high). */
function reachW(rig, side, pt, w, up = 0) {
  if (w <= 0.001) return;
  const p = rig.parts;
  const arm = side > 0 ? p.armR : p.armL, el = side > 0 ? p.elbowR : p.elbowL;
  _qa.copy(arm.quaternion);
  _qe.copy(el.quaternion);
  rig.root.updateMatrixWorld(true);
  arm.getWorldPosition(_s);
  _w.subVectors(pt, _s);
  const len = _w.length();
  _w.multiplyScalar(Math.max(0, len - 0.06) / Math.max(1e-6, len)).add(_s);
  p.chest.worldToLocal(_w);
  _pole.set(side, -1 + up * 1.2, 0.3 - up * 0.7);
  reachHand(rig, side, _w, _pole);
  if (w < 1) {
    _qb.copy(arm.quaternion); arm.quaternion.slerpQuaternions(_qa, _qb, w);
    _qb.copy(el.quaternion); el.quaternion.slerpQuaternions(_qe, _qb, w);
  }
}

/* A bouncer's arms folded across his chest (town-npcs.js "guard"). */
function foldArms(p) {
  p.armL.rotation.set(0.35, 0, 0.05); p.elbowL.rotation.set(0, 0.95, 2.02);
  p.armR.rotation.set(0.42, 0, -0.05); p.elbowR.rotation.set(0, -0.95, -2.02);
}

/* Where a person's right wrist is, held out for the band: ours from where we
   stand (the views draw our arm going there), a clubgoer's off his rig. */
function myWrist(out) {
  const p = game.move.pos, y = game.look.yaw;
  return out.set(p.x - Math.sin(y) * 0.48 + Math.cos(y) * 0.1, p.y + 1.12, p.z - Math.cos(y) * 0.48 - Math.sin(y) * 0.1);
}
function peerWrist(R, out) {
  const p = R.rp.pos, y = R.rp.yaw;
  return out.set(p.x - Math.sin(y) * 0.48 + Math.cos(y) * 0.1, p.y + 1.12, p.z - Math.cos(y) * 0.48 - Math.sin(y) * 0.1);
}
function goerWrist(e, out) {
  const n = e.n, l = club.lanes[e.lane];
  const b = l?.b || n;
  const a = Math.atan2(b.x - n.x, b.z - n.z);
  return out.set(n.x + Math.sin(a) * 0.42 + Math.cos(a) * 0.1, (n.c.y ?? 0) + 1.02, n.z + Math.cos(a) * 0.42 - Math.sin(a) * 0.1);
}

/* How far into the band a clubgoer at a lane is (0..1; below 0 the ID's
   still being looked at). */
function npcBandK(e) {
  if (!e.checkT) return -1;
  const c = T.checkSecs;
  return Math.min(1, (e.t - e.checkT - c * 0.45) / (c * 0.55));
}

/* What a lane's bouncer is doing right now. */
function laneAct(l) {
  if (l.kick) return { act: "kick" };
  const who = l.who;
  if (who?.remote) {
    // Another human: their phase, on their clock.
    const at = who.rp.pos;
    if (who.ph === "id") return { act: "check", to: at, k: who.tc / T.idSecs };
    if (who.ph === "ask") return { act: "ask", to: at };
    if (who.ph === "band") return { act: "band", to: at, k: who.tc / T.bandSecs, wrist: peerWrist(who, _v) };
    return { act: "face", to: at };
  }
  if (who === ME) {
    const at = game.move.pos;
    if (club.phase === "id") return { act: "check", to: at, k: club.t / T.idSecs };
    if (club.phase === "ask") return { act: "ask", to: at };
    if (club.phase === "band") return { act: "band", to: at, k: club.t / T.bandSecs, wrist: myWrist(_v) };
    return { act: "face", to: at };
  }
  if (who) {
    const bk = npcBandK(who);
    if (who.state === "lane" && who.checkT) return bk >= 0 ? { act: "band", to: who.n, k: bk, wrist: goerWrist(who, _v) } : { act: "check", to: who.n };
    return { act: "face", to: who.n };
  }
  if (l.waveT < WAVE_SECS) return { act: "wave", to: l.waved === ME ? game.move.pos : l.waved?.remote ? l.waved.rp.pos : l.waved?.n, k: l.waveT / WAVE_SECS };
  return { act: "idle" };
}

/* Big Lulz and Tank, driven by their lanes: arms folded, scanning the
   street; turn to whoever's up; a hand out for the ID; both hands on the
   wrist, the band snapped shut; an arm swept toward the door. Big Lulz also
   takes the rope off its hook and puts it back. */
const _pR = new THREE.Vector3(), _pL = new THREE.Vector3(), _f = new THREE.Vector3(), _x = new THREE.Vector3();
function poseBouncer(l, lulz, n, rig, dt) {
  l.waveT += dt;
  const a = laneAct(l);
  if (a.act === "kick") { poseKicker(l, n, rig, dt); return; }
  const p = rig.parts;
  const hook = lulz ? rope.hand() : null;
  let yawT = n.home?.yaw ?? Math.PI;
  // A step over to the hook and back (and back to his post after a
  // kick-out).
  let away = false;
  if (n.home) {
    const sx = hook ? hook.x + (n.home.x - hook.x) * 0.5 : n.home.x, sz = hook ? hook.z + (n.home.z - hook.z) * 0.5 : n.home.z;
    const dx = sx - n.x, dz = sz - n.z, dd = Math.hypot(dx, dz);
    n.moving = dd > 0.05;
    if (dd > 0.01) { const st = Math.min(dd, 2.2 * dt); n.x += dx / dd * st; n.z += dz / dd * st; }
    if (dd > 0.4 && !hook) { away = true; yawT = Math.atan2(-dx, -dz); }
  }
  if (away) { /* walking back: eyes where he's going */ }
  else if (hook) yawT = yawTo(n.x, n.z, hook.x, hook.z);
  else if (a.to) yawT = yawTo(n.x, n.z, a.to.x, a.to.z);
  n.yaw = turn(n.yaw, yawT, dt * 6);
  foldArms(p);
  // Facing, and the point straight out in front at chest height.
  _f.set(-Math.sin(n.yaw), 0, -Math.cos(n.yaw));
  _x.set(Math.cos(n.yaw), 0, -Math.sin(n.yaw));   // his right
  const y0 = n.c.y ?? 0;
  let wantR = 0, wantL = 0, head = 0, up = 0;
  l.pR ??= new THREE.Vector3(); l.pL ??= new THREE.Vector3();
  if (hook) {
    // The arm on the hook's side reaches it.
    const side = (hook.x - n.x) * _x.x + (hook.z - n.z) * _x.z > 0 ? 1 : -1;
    (side > 0 ? _pR : _pL).copy(hook);
    if (side > 0) wantR = 1; else wantL = 1;
    head = 0.45;
  } else switch (a.act) {
    case "check": {
      // Hand out, palm up, the ID in it; head down reading it.
      _pR.set(n.x, y0 + 1.18, n.z).addScaledVector(_f, 0.4).addScaledVector(_x, 0.08);
      wantR = 1; head = 0.38;
      break;
    }
    case "ask":
      head = -0.05;   // eyes up on yours: well?
      break;
    case "band": {
      // Both hands to the wrist; at the snap they pull the strap tight.
      const k = a.k;
      const tug = k > SNAP_AT ? Math.sin(Math.min(1, (k - SNAP_AT) / 0.18) * Math.PI) * 0.05 : 0;
      _pR.copy(a.wrist).addScaledVector(_x, 0.07 + tug);
      _pL.copy(a.wrist).addScaledVector(_x, -0.07 - tug);
      const e = env(k, 0.22, 0.2);
      wantR = wantL = e; head = 0.42;
      break;
    }
    case "wave": {
      // An arm swept out toward the door: "go on in".
      const d = door();
      const dx = d.mouth.x - n.x, dz = d.mouth.z - n.z, dl = Math.hypot(dx, dz) || 1;
      const side = dx * _x.x + dz * _x.z > 0 ? 1 : -1;
      const k = smooth(a.k / 0.6);
      const pt = side > 0 ? _pR : _pL;
      pt.set(n.x, y0 + 1.25 - k * 0.12, n.z).addScaledVector(_f, 0.45 * (1 - k)).addScaledVector(_x, side * 0.25 * (1 - k));
      pt.x += dx / dl * 0.62 * k; pt.z += dz / dl * 0.62 * k;
      if (side > 0) wantR = env(a.k, 0.15, 0.3); else wantL = env(a.k, 0.15, 0.3);
      head = 0.05;
      up = 0.3;
      break;
    }
    default: break;
  }
  // Ease the hands in and out, and between targets.
  const r = Math.min(1, dt * 9);
  l.w ??= 0; l.wl ??= 0;
  l.w += (wantR - l.w) * r; l.wl += (wantL - l.wl) * r;
  if (wantR > 0) l.pR.lerp(_pR, l.w < 0.05 ? 1 : r * 1.4);
  if (wantL > 0) l.pL.lerp(_pL, l.wl < 0.05 ? 1 : r * 1.4);
  reachW(rig, 1, l.pR, l.w, up);
  reachW(rig, -1, l.pL, l.wl, up);
  l.head = (l.head ?? 0) + (head - (l.head ?? 0)) * r;
  p.headPivot.rotation.x = l.head;
  const scan = a.act === "idle" && !hook ? Math.sin(n.t * 0.35) * 0.6 : 0;
  l.scan = (l.scan ?? 0) + (scan - (l.scan ?? 0)) * r;
  p.headPivot.rotation.y = l.scan;
  idCard(l, rig, a.act === "check" && !hook && l.w > 0.55);
}

/* The ID in his hand while he reads it: the licence lying in the fist (a
   small painted one, the same for everyone: no one else's picture loads). */
const _el = new THREE.Vector3(), _wr = new THREE.Vector3();
let miniLicence = null;
function idCard(l, rig, on) {
  if (!on) { if (l.card) l.card.visible = false; return; }
  if (!l.card) {
    if (!miniLicence) {
      const c = document.createElement("canvas");
      c.width = 128; c.height = 80;
      drawMiniLicence(c.getContext("2d"), 128, 80);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      miniLicence = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 });
    }
    l.card = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.003, 0.054), miniLicence);
    game.scene.add(l.card);
  }
  // In the fist: a little past the wrist along the forearm, held flat, its
  // long side across his body.
  rig.root.updateMatrixWorld(true);
  rig.parts.wristR.getWorldPosition(_wr);
  rig.parts.elbowR.getWorldPosition(_el);
  _el.subVectors(_wr, _el).normalize();
  l.card.position.copy(_wr).addScaledVector(_el, 0.07);
  l.card.position.y += 0.025;
  l.card.rotation.set(0.25, Math.atan2(_el.x, _el.z), 0, "YXZ");
  l.card.visible = true;
}

/* A clubgoer: stood in the line he keeps his own act from the map (on his
   phone, arms folded, dancing on the spot); at the lane his right arm goes
   out for the band. */
function poseGoer(e, rig) {
  const n = e.n, p = rig.parts;
  if (!n.moving && e.state === "line") {
    const t = n.t + e.i * 1.7;
    switch (n.c.act) {
      case "phone": {
        const up = Math.max(0, Math.sin(t * 0.45 * Math.PI * 2 * 0.25)) ** 6;
        p.armR.rotation.set(0.95, 0, -0.25); p.elbowR.rotation.set(1.55, 0, 0);
        p.armL.rotation.set(0.2, 0, 0.12); p.elbowL.rotation.set(0.3, 0, 0);
        p.headPivot.rotation.x = 0.45 * (1 - up);
        p.headPivot.rotation.y = up * 0.6;
        break;
      }
      case "guard":
        foldArms(p);
        p.headPivot.rotation.y = Math.sin(t * 0.3) * 0.5;
        break;
      case "dance":
        p.headPivot.rotation.z = Math.sin(t * 4.2) * 0.14;
        p.armR.rotation.set(0.3 + Math.sin(t * 4.2) * 0.25, 0, -0.2); p.elbowR.rotation.set(1.2, 0, 0);
        p.armL.rotation.set(0.3 - Math.sin(t * 4.2) * 0.25, 0, 0.2); p.elbowL.rotation.set(1.2, 0, 0);
        rig.root.position.y += Math.abs(Math.sin(t * 4.2)) * 0.03;
        break;
      default: break;
    }
  }
  if (e.arm > 0) reachW(rig, 1, goerWrist(e, _w.clone()), e.arm);
}

/* Our own body in third person (view/third-person.js): the arm out at the
   band. */
export function clubPoseLocal(rig) {
  if (club.live && club.kick) { poseKicked(rig, club.kick, club.kick.tc); return; }
  if (rig.root.rotation.x) rig.root.rotation.x = 0;
  if (club.live && club.sit > 0.5) { poseCurbSit(rig); return; }
  if (!club.live || club.phase !== "band") return;
  const k = club.t / T.bandSecs;
  reachW(rig, 1, myWrist(_s.clone()), env(k, 0.15, 0.25));
}

/* First person (view/fp-emote.js): your arm comes up into view for the
   band, and you look down at it as it's snapped on. */
export function clubArms() {
  if (!club.live) return null;
  // Thrown out: no hands in front of the cinematic's camera.
  if (club.kick) return { R: { pos: [0.3, -1.6, -0.45], rot: [0, 0, -Math.PI / 2], pose: "relaxed" }, L: null, gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
  let e = 0;
  if (club.phase === "band") e = env(club.t / T.bandSecs, 0.15, 0.001);
  else if (club.phase === "walk" && club.t < 0.7) e = 1 - club.t / 0.7;
  if (e <= 0) return null;
  const k = smooth(e);
  // The rod's tip just past where the bouncer's hands are (the world
  // wrist, seen through the main camera, put at the same spot in the
  // viewmodel's narrower lens).
  const ndc = myWrist(_s.clone()).project(game.camera);
  const D = 0.42, ty = Math.tan((29 * Math.PI) / 180), tx = ty * (game.camera.aspect || 16 / 9);
  const hx = Math.max(-0.2, Math.min(0.25, ndc.x * D * tx)) + 0.005, hy = Math.max(-0.3, Math.min(0.1, ndc.y * D * ty));
  return {
    R: { pos: [0.2 + (hx - 0.2) * k, -0.52 + (hy + 0.52) * k, -0.45 + (0.45 - D) * k], rot: [0.2 + k * 0.6, 0.35, -Math.PI / 2], pose: "relaxed" },
    L: null, gun: false, cam: { pitch: 0, yaw: 0 }, social: true,
  };
}

/* The velvet rope across the front door. Closed, it hangs between its two
   posts; for each person let in Big Lulz lifts its west end off the hook
   and it drops and is dragged round the east post to lie along the wall;
   it's hooked back up
   once they're through. */
const rope = {
  mesh: null, cap: null, k: 0, drawn: -1, d: null,
  build(d) {
    this.drop();
    if (!d.rope || !game.scene) return;
    this.d = d;
    this.mat ??= new THREE.MeshStandardMaterial({ color: 0x8a0c1e, roughness: 0.82, metalness: 0, emissive: 0x2a0008, emissiveIntensity: 0.7 });
    this.capMat ??= new THREE.MeshStandardMaterial({ color: 0xd9a93c, roughness: 0.25, metalness: 0.9, emissive: 0x3a2808, emissiveIntensity: 0.6 });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 10), this.capMat);
    this.mesh.frustumCulled = false;
    game.scene.add(this.mesh, this.cap);
    this.k = 0;
    this.drawn = -1;
    this.draw();
  },
  drop() {
    if (this.mesh) { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); }
    this.cap?.parent?.remove(this.cap);
    this.mesh = this.cap = null;
  },
  /* Someone on the way in (or a band wearer at the door) keeps it open. */
  wanted() {
    const d = this.d;
    if (club.phase === "walk") return true;
    for (const e of club.npcs) if (e.state === "door") return true;
    for (const R of club.remotes.values()) {
      const q = R.rp.pos;
      if (R.ph === "walk" || (R.p.wb > 0 && Math.abs(q.x - d.mouth.x) < 2.6 && q.z > 21.4 && q.z < 24.6)) return true;
    }
    const p = game.move.pos;
    if (bandNow() > BAND.none && !clubHolds() && Math.abs(p.x - d.mouth.x) < 2.6 && p.z > 21.4 && p.z < 24.6) return true;
    return false;
  },
  step(d, dt) {
    if (!this.mesh) return;
    const want = this.wanted();
    // The hook end only moves in Big Lulz's hand: it waits for him, and he
    // finishes the ID or band he's on first.
    const l0 = club.lanes[0];
    const busy = !!l0 && ["check", "band"].includes(laneAct(l0).act);
    this.needHand = !busy && this.k < 0.3 && (want ? this.k < 1 : this.k > 0);
    const lulz = l0?.b;
    const far = lulz && this.k < 0.22 && (busy || Math.hypot(lulz.x - this.end.x, lulz.z - this.end.z) > 0.6) && (want ? this.k < 1 : this.k > 0);
    if (!far) this.k = Math.max(0, Math.min(1, this.k + (want ? dt / ROPE_OPEN : -dt / ROPE_SHUT)));
    if (Math.abs(this.k - this.drawn) > 1e-4) this.draw();
  },
  /* Big Lulz's hand on the hook end while it comes off or goes back on. */
  hand() {
    return this.mesh && this.needHand ? this.end : null;
  },
  end: new THREE.Vector3(),
  draw() {
    const { a, b, y } = this.d.rope;
    const k = this.k;
    // Off the hook (k < 0.22), down to the pavement, then dragged round the
    // east post to lie along the wall behind Tank, out of everyone's way.
    const u = (k - 0.22) / 0.78;
    const drop = smooth(u / 0.3), sweep = smooth((u - 0.1) / 0.9);
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    const th = sweep * Math.PI;
    const lr = L * (1 - 0.35 * drop);
    const lift = k < 0.22 ? Math.sin((k / 0.22) * Math.PI) * 0.07 : 0;
    const E = this.end.set(b.x - Math.cos(th) * lr, y - drop * (y - 0.05) + lift, b.z + Math.sin(th) * lr);
    const sag = 0.17 + drop * 0.5;
    const pts = [];
    const N = 28;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const py = Math.max(0.03, E.y + (y - E.y) * t - sag * 4 * t * (1 - t));
      pts.push(new THREE.Vector3(E.x + (b.x - E.x) * t, py, E.z + (b.z - E.z) * t));
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.03, 8, false);
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    // The brass clip on the free end, along the rope.
    this.cap.position.copy(E);
    this.cap.quaternion.setFromUnitVectors(_v.set(0, 1, 0), _x.subVectors(pts[1], pts[0]).normalize());
    this.drawn = k;
  },
};

/* Security puts a hand up when your band doesn't open the door you're at
   (VIP, staff only): the nearest guard turns on you, palm out. */
function startBlock() {
  const T_ = game.townNpcs;
  if (!T_ || club.blocks.length) return;
  const p = game.move.pos;
  let best = -1, bd = 9;
  T_.list.forEach((n, i) => {
    if (n.override || n.off || !/Security|Bouncer|VIP door/.test(n.c.role)) return;
    const dd = Math.hypot(n.x - p.x, n.z - p.z) + Math.abs((n.c.y ?? 0) - p.y) * 3;
    if (dd < bd) { bd = dd; best = i; }
  });
  if (best < 0) return;
  const b = { i: best, t: 0 };
  T_.takeOver(best, (n, rig, dt) => poseBlock(b, n, rig, dt));
  club.blocks.push(b);
}
const BLOCK_SECS = 1.9;
function stepBlocks(dt) {
  club.blocks = club.blocks.filter((b) => {
    b.t += dt;
    if (b.t < BLOCK_SECS) return true;
    game.townNpcs?.release(b.i);
    return false;
  });
}
function poseBlock(b, n, rig, dt) {
  const p = game.move.pos;
  n.yaw = turn(n.yaw, yawTo(n.x, n.z, p.x, p.z), dt * 10);
  const e = env(b.t / BLOCK_SECS, 0.12, 0.2);
  _f.set(-Math.sin(n.yaw), 0, -Math.cos(n.yaw));
  _pR.set(n.x, (n.c.y ?? 0) + 1.55, n.z).addScaledVector(_f, 0.55);
  rig.parts.armL.rotation.set(0.35, 0, 0.05); rig.parts.elbowL.rotation.set(0, 0.95, 2.02);
  reachW(rig, 1, _pR, e, 0.8);
  rig.parts.headPivot.rotation.y = Math.sin(b.t * 13) * 0.22 * e;
}

/* The band snapping shut: a plastic click and a strap tug. */
function snapSound(at, vol = 1) {
  const a = game.audio;
  if (!a?._ready?.()) return;
  a._noise({ duration: 0.04, gain: 0.5 * vol, type: "highpass", freq: 2800, at });
  a._tone({ freq: 2300, to: 1100, duration: 0.045, gain: 0.1 * vol, type: "square", at });
  a._noise({ duration: 0.11, gain: 0.22 * vol, type: "bandpass", freq: 1100, q: 2.5, sweepTo: 500, delay: 0.035, at });
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
    this.card.innerHTML = renderClubId(myCardData());   // the licence (view/club-id-card.js), not the Barracks card
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
.club-card { position: absolute; left: 50%; bottom: 10%; transform: translateX(-50%) rotate(-4deg); width: min(460px, 90vw);
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
    rope: () => ({ on: !!rope.mesh?.parent, k: rope.k }),
    // The room (phase 4): who's in our line where, the others' phases, the wire.
    room: () => ({
      me: game.net?.id, ticket: club.ticket, wire: { ...game.net?.club },
      line: club.queue.map((e) => (e.me ? "me" : e.remote ? e.id : "npc")),
      remotes: [...club.remotes.values()].map((R) => ({
        id: R.id, ph: R.ph, lane: R.lane, cq: R.cq, kick: R.K ? +R.K.tc.toFixed(2) : -1,
        band: R.rp.rig.band | 0, bandMesh: !!R.rp.rig.bandMesh?.parent, card: !!R.card?.visible,
        lie: +R.rp.rig.root.rotation.x.toFixed(2), y: +R.rp.rig.root.position.y.toFixed(2),
      })),
      lanes: club.lanes.map((l) => ({ who: l.who === ME ? "me" : l.who?.remote ? l.who.id : l.who ? "npc" : null, act: laneAct(l).act })),
    }),
    KICK, kick: () => (club.kick ? club.kick.tc : -1),
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
