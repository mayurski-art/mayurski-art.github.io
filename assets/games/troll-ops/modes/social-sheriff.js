// Troll Forces — Troll City's sheriff (TROLL-CITY-RP2.md, phase 2b).
//
// Take the badge off the desk in the courthouse and you're the sheriff
// (Sheriff Grimes goes off shift; you wear his hat). Hold X:
//   - by a player: cuff them (their client accepts only from a sheriff,
//     never troll_runner, not someone just let out). Cuffed, their hands go
//     behind their back and they follow you on the leash; again to uncuff.
//   - at a cell door with them in tow: lock them up (60 s at most).
//   - at the wanted board: post up to three players (crimes made up).
//
// Without a player sheriff the town's own does it: refuse a fist fight and
// Sheriff Grimes (or Deputy Doofus, if a player has the badge) comes for
// you: cuffs on, filmed (view/arrest-cine.js), black, and you come round
// on the cot in a cell.
//
// The wire: `cf` (1 cuffed, 2 being arrested by the town), `jl` (the cell,
// modes/social-jail.js), `wl` (the sheriff's board), all on the state
// packet, so a late joiner sees them; the calls are rp "sheriff" messages.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1";
import { bar, otherWithRole, putDownDrink, seated, standUp, rpExtras, rpListeners, rpNearestPlayer, setBarRole } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1";
import { peerPosers } from "../remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1";
import { reachHand, setHandPose } from "../character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u";
import { releaseHeldInputs } from "../menu/pause.js?v=pa1-mb1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1";
import { playerName } from "../menu/lobby.js?v=lb1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1";
import { wantedPoster } from "../trollcity-kit.js?v=tc2-wst-tc3";
import { localPosers } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1";
import { cellsOf, freeMe, inJail, jailCooling, jailMe, jailed, updateJail } from "./social-jail.js?v=sj1";

export const SHERIFF = {
  badgeTime: 0.6, cuffTime: 1.0, uncuffTime: 0.6, lockTime: 0.8, boardTime: 0.5,
  cuffSecs: 30,        // cuffs come off by themselves after this
  sentence: 60,        // s in the cells
  leash: 1.4,          // m behind the sheriff a cuffed player keeps
  reach: 2.0,          // m to cuff someone
  // The town's arrest (a fist fight refused), on its own clock:
  cine: { walk: 1.5, cuffed: 2.25, fade: 3.1, cut: 3.6, wake: 4.1, up: 5.0, end: 5.7 },
};
if (typeof window !== "undefined" && window.__trollSheriffTune) Object.assign(SHERIFF, window.__trollSheriffTune);

export const CRIMES = [
  ["HORSE THIEF", "$500"], ["RATIO'D THE MAYOR", "$69,000"], ["SPOILED THE ENDING", "$1,000"],
  ["DOUBLE PARKED A HORSE", "$12"], ["CHEATED AT CARDS", "$420"], ["SAID 'U MAD BRO' TO A JUDGE", "$1,337"],
  ["STOLE A PIE", "ONE (1) PIE"], ["TROLLING, FIRST DEGREE", "$1,000,000"], ["UNLICENSED YODELING", "$99"],
  ["RICKROLLED THE BAND", "$2,500"], ["PUNCHED A CACTUS", "$5"], ["LOITERING TO TROLL", "$300"],
];

export const sheriff = {
  cuffed: null,     // { by: peer id, name, until: ms }
  cine: null,       // the town's arrest: { t, why, ni, P: {x,y,z,yaw}, from: {x,z}, jailed }
  wanted: [],       // ours, as sheriff: [{ id, crime }]
  remoteArrests: new Map(),   // npc index -> { from, until }
  clicked: false,
};

const spots = () => (game.isSocial() ? game.builtMap?.map?.rp?.sheriff || null : null);
const now = () => performance.now();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const angleTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));
const near = (p, q, r) => Math.hypot(p.x - q.x, p.z - q.z) < r;

/* ------------------------------------------------------------ cuffs */

export const isCuffed = () => !!sheriff.cuffed;
/* The town's arrest or a sheriff's cuffs: is something other than our keys moving us? */
export const sheriffHolds = () => !!(sheriff.cine || sheriff.cuffed);

function cuffMe(p) {
  sheriff.cuffed = { by: p.id, name: p.name || "The sheriff", until: now() + SHERIFF.cuffSecs * 1000 };
  if (seated) standUp();
  if (bar.drink) putDownDrink();
  game.stopEmote?.();
  releaseHeldInputs();
  cuffClick(null);
  showWaveBanner(`${sheriff.cuffed.name} cuffs you. You're coming with me, partner`, 2800);
}
function uncuff(note) {
  if (!sheriff.cuffed) return;
  sheriff.cuffed = null;
  jailed.coolUntil = Math.max(jailed.coolUntil, now() + 120000);   // not again for 2 minutes
  if (note) showWaveBanner(note, 2000);
}

/* Each frame we're held: the leash (follow the sheriff), or the town's arrest (stand still). */
export function sheriffHold(dt) {
  const m = game.move;
  if (sheriff.cine) {
    m.velocity.set(0, 0, 0); m.sprinting = false; m.moving = false;
    return;
  }
  const rp = game.remotes.byId.get(sheriff.cuffed.by);
  let fwd = 0, yaw = game.look.yaw;
  if (rp?.alive) {
    const d = Math.hypot(rp.pos.x - m.pos.x, rp.pos.z - m.pos.z);
    if (d > SHERIFF.leash) { fwd = 1; yaw = angleTo(m.pos.x, m.pos.z, rp.pos.x, rp.pos.z); }
    sheriff.leashSprint = d > 3.2;
  }
  m.update(dt, { forward: fwd, strafe: 0, sprint: !!sheriff.leashSprint, jump: false, crouch: false, dive: false, yaw, pitch: game.look.pitch, adsHeld: false, speedMult: 1, sprintMult: 1.35 });
}

function cuffClick(at) {
  const a = game.audio;
  if (!a?._ready?.()) return;
  for (const [i, f] of [[0, 1900], [1, 1500]]) a._tone({ freq: f, to: f * 0.7, duration: 0.05, gain: 0.09, type: "square", delay: i * 0.09, at });
  a._noise({ duration: 0.08, gain: 0.1, type: "highpass", freq: 3000, delay: 0.02, at });
}
function lockClank(at) {
  const a = game.audio;
  if (!a?._ready?.()) return;
  a._tone({ freq: 260, to: 120, duration: 0.25, gain: 0.12, type: "square", at });
  a._noise({ duration: 0.2, gain: 0.16, type: "bandpass", freq: 900, q: 3, at });
}

/* ------------------------------------------------- the town's arrest */

/* A fist fight refused (modes/social-duel.js): the town's sheriff comes for us. */
export function townArrest(why, secs = SHERIFF.sentence) {
  const J = cellsOf();
  if (!J?.cells.length) return;
  const T = game.townNpcs;
  const p = game.move.pos;
  let ni = T ? T.list.findIndex((n) => n.c.role === "Sheriff" && !n.off && !n.override) : -1;
  if (ni < 0 && T) ni = T.list.findIndex((n) => n.c.role === "Deputy" && !n.override);
  const yaw = game.look.yaw;
  const back = { x: Math.sin(yaw), z: Math.cos(yaw) };   // behind us
  sheriff.cine = { t: 0, why, ni, secs, P: { x: p.x, y: p.y, z: p.z, yaw }, from: { x: p.x + back.x * 4.5, z: p.z + back.z * 4.5 }, jailed: false };
  sheriff.clicked = false;
  if (bar.drink) putDownDrink();
  game.stopEmote?.();
  releaseHeldInputs();
  if (ni >= 0) {
    const n = T.takeOver(ni, (nn, rig) => poseArrester(nn, rig, sheriff.cine?.t ?? 9, sheriff.cine?.P.y ?? 0));
    if (n) { n.x = sheriff.cine.from.x; n.z = sheriff.cine.from.z; }
    game.net.publishRp({ k: "sheriff", e: "arrest", n: ni });
  }
}
export const arrestCine = () => sheriff.cine;
export const npcName = () => game.townNpcs?.list[sheriff.cine?.ni]?.c.name || "The sheriff";

/* The arresting NPC: walks up behind, reaches for the wrists. */
function poseArrester(n, rig, t, feetY) {
  rig.root.position.y = feetY;
  if (t < SHERIFF.cine.walk) return;   // walking (the base gait)
  const p = rig.parts, k = Math.min(1, (t - SHERIFF.cine.walk) / 0.35);
  p.armL.rotation.set(0.85 * k, 0, 0.1); p.elbowL.rotation.set(0.5 * k, 0, 0);
  p.armR.rotation.set(0.85 * k, 0, -0.1); p.elbowR.rotation.set(0.5 * k, 0, 0);
  p.chest.rotation.x += 0.15 * k;
}

function stepCine(dt) {
  const C = sheriff.cine, S = SHERIFF.cine, T = game.townNpcs;
  C.t += dt;
  const n = C.ni >= 0 ? T?.list[C.ni] : null;
  if (n && C.t < S.fade) {
    // walk up to just behind us
    const tx = C.P.x + Math.sin(C.P.yaw) * 0.6, tz = C.P.z + Math.cos(C.P.yaw) * 0.6;
    const k = Math.min(1, C.t / S.walk), e = k * k * (3 - 2 * k);
    n.x = C.from.x + (tx - C.from.x) * e;
    n.z = C.from.z + (tz - C.from.z) * e;
    n.moving = k < 1;
    n.yaw = C.P.yaw;
  }
  if (!sheriff.clicked && C.t >= S.cuffed) { sheriff.clicked = true; cuffClick(null); }
  if (!C.jailed && C.t >= S.cut) {
    C.jailed = true;
    if (n) T.release(C.ni);
    jailMe(null, C.secs, null);
    C.cell = jailed.me?.ci ?? 0;
  }
  if (C.t >= S.end) {
    sheriff.cine = null;
    showWaveBanner(`In the cells for ${Math.ceil(jailed.me?.left ?? C.secs)}s. Think about what you did`, 2600);
  }
}

/* ------------------------------------------------------------ poses */

const _tgt = new THREE.Vector3(), _pole = new THREE.Vector3();
/* Hands behind the back, wrists together (after poseHumanoid). */
const _hang = new THREE.Vector3();
export function poseCuffed(rig, k = 1) {
  if (k <= 0) return;
  const s = rig.scale || 1, w = rig.build || 1;
  for (const side of [-1, 1]) {
    // chest space (character.js reachHand): +X right, -Z forward; from
    // hanging at the side (k 0) to the wrists together behind the hips
    _tgt.set(side * 0.035 * s * w, -0.4 * s, 0.13 * s);
    if (k < 1) _tgt.lerp(_hang.set(side * 0.2 * s * w, -0.55 * s, 0), 1 - k);
    _pole.set(side * 1, -0.3, 1);
    reachHand(rig, side, _tgt, _pole);
    setHandPose(rig, side, "fist");
  }
  rig.body?.update?.();
}

/* Our own body (view/third-person.js, after poseHumanoid). */
export function sheriffPoseLocal(rig) {
  if (sheriff.cuffed) poseCuffed(rig, 1);
  else if (sheriff.cine && sheriff.cine.t > SHERIFF.cine.walk && !sheriff.cine.jailed) poseCuffed(rig, Math.min(1, (sheriff.cine.t - SHERIFF.cine.walk) / 0.5));
}

/* First person: no hands while they're cuffed behind you. */
export function cuffArms() {
  if (!sheriff.cuffed) return null;
  const R = { pos: [0.2, -1.5, -0.3], rot: [0, 0, -Math.PI / 2], pose: "fist" };
  const L = { pos: [-0.2, -1.5, -0.3], rot: [0, 0, Math.PI / 2], pose: "fist" };
  return { R, L, gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
}

/* ------------------------------------------------------------ the job */

function sheriffAction() {
  if (!game.isSocial() || !game.player.alive) return null;
  // Cuffed: nothing in our hands to hold X with.
  if (sheriff.cuffed) return { key: "cuffed", info: true, label: `Cuffed by ${sheriff.cuffed.name} · ${Math.max(0, Math.ceil((sheriff.cuffed.until - now()) / 1000))}s` };
  if (sheriff.cine || inJail()) return null;
  const S = spots();
  if (!S) return null;
  const p = game.move.pos;
  // the badge on the desk
  if (near(p, S.badge, 1.5) && Math.abs(p.y - S.badge.floor) < 1) {
    if (bar.role === "sheriff") {
      return { key: "badge", label: "Put the badge back on the desk", busy: "Unpinning it…", ctx: "Badge", time: SHERIFF.badgeTime,
        done: () => offDuty("The badge is back on the desk.") };
    }
    const other = otherWithRole("sheriff");
    if (other) return { key: "badge", info: true, label: `${other.name || "Someone"} is the sheriff` };
    return { key: "badge", label: "Take the badge (sheriff)", busy: "Pinning it on…", ctx: "Badge", time: SHERIFF.badgeTime,
      done: () => setBarRole("sheriff", "You're the sheriff. Hold X by a player to cuff them, at a cell door to lock them up, at the board to post a wanted man.") };
  }
  if (bar.role !== "sheriff") return null;
  const J = cellsOf();
  // a cell door, somebody of ours in tow
  if (J) {
    const tow = myPrisoner(4);
    if (tow) {
      for (let i = 0; i < J.cells.length; i++) {
        const c = J.cells[i];
        if (!near(p, c.out, 2.4) || c.shut) continue;
        const name = tow.peer.name || "them";
        return { key: `lock:${i}`, label: `Lock ${name} up`, busy: "Keys…", ctx: "Lock", time: SHERIFF.lockTime,
          done: () => {
            game.net.publishRp({ k: "sheriff", e: "jail", to: tow.peer.id, c: i });
            lockClank({ x: c.out.x, y: 1.4, z: c.out.z });
            sheriff.wanted = sheriff.wanted.filter((w) => w.id !== tow.peer.id);
            showWaveBanner(`${name}: ${SHERIFF.sentence}s in the cells`, 1800);
          } };
      }
    }
  }
  // the wanted board
  if (near(p, S.board, 1.6) && Math.abs(p.y - S.board.floor) < 1) {
    return { key: "board", label: "The wanted board", ctx: "Board", time: SHERIFF.boardTime, done: () => board.open() };
  }
  // somebody to cuff (or uncuff)
  const rp = rpNearestPlayer(SHERIFF.reach);
  if (rp) {
    const name = rp.peer.name || "them";
    if ((rp.peer.cuffed | 0) === 1 && cuffedByMe(rp)) {
      return { key: `uncuff:${rp.peer.id}`, label: `Uncuff ${name}`, busy: "Keys…", ctx: "Uncuff", time: SHERIFF.uncuffTime,
        done: () => game.net.publishRp({ k: "sheriff", e: "uncuff", to: rp.peer.id }) };
    }
    if (rp.peer.owner) return { key: `cuff:${rp.peer.id}`, info: true, label: `Nobody cuffs ${name}` };
    if (rp.peer.cuffed || rp.peer.jail) return null;
    return { key: `cuff:${rp.peer.id}`, label: `Cuff ${name}`, busy: "Cuffing…", ctx: "Cuff", time: SHERIFF.cuffTime,
      done: () => { game.net.publishRp({ k: "sheriff", e: "cuff", to: rp.peer.id }); cuffClick(null); sheriff.towing = rp.peer.id; } };
  }
  return null;
}
const cuffedByMe = (rp) => sheriff.towing === rp.peer.id;
function myPrisoner(r) {
  const rp = sheriff.towing ? game.remotes.byId.get(sheriff.towing) : null;
  if (!rp?.alive || (rp.peer.cuffed | 0) !== 1) return null;
  return near(rp.pos, game.move.pos, r) ? rp : null;
}
function offDuty(note) {
  setBarRole(null, note);
  sheriff.wanted = [];
  if (sheriff.towing) game.net.publishRp({ k: "sheriff", e: "uncuff", to: sheriff.towing });
  sheriff.towing = null;
  board.close();
}

/* ------------------------------------------------------------ the room */

function onMessage(p, m) {
  if (m.k !== "sheriff" || game.isBotPeer(p)) return;
  if (m.e === "arrest") {
    // The town's sheriff comes for them: our copy of him walks up behind
    // their body and reaches for the wrists, till they're inside.
    const T = game.townNpcs, i = m.n | 0;
    if (!T?.list[i] || T.list[i].override) return;
    sheriff.remoteArrests.set(i, { from: p.id, until: now() + SHERIFF.cine.cut * 1000, t0: now() });
    T.takeOver(i, (nn, rig) => {
      const r = sheriff.remoteArrests.get(i), rp = game.remotes.byId.get(p.id);
      if (!r || !rp) return;
      const t = (now() - r.t0) / 1000;
      nn.x = rp.pos.x + Math.sin(rp.yaw) * 0.6; nn.z = rp.pos.z + Math.cos(rp.yaw) * 0.6; nn.yaw = rp.yaw;
      poseArrester(nn, rig, Math.max(t, SHERIFF.cine.walk), rp.pos.y);
    });
    return;
  }
  // The rest is a player sheriff's, to us.
  if (p.role !== "sheriff" || m.to !== game.net.id) return;
  if (m.e === "cuff") {
    const no = game.isTrollRunner?.() ? "owner" : inJail() || sheriff.cuffed || sheriff.cine ? "busy" : jailCooling() ? "cool" : null;
    if (no) { game.net.publishRp({ k: "sheriff", e: "nocuff", to: p.id, why: no }); return; }
    cuffMe(p);
  } else if (m.e === "uncuff") {
    if (sheriff.cuffed?.by === p.id) uncuff(`${p.name || "The sheriff"} lets you go`);
  } else if (m.e === "jail") {
    if (sheriff.cuffed?.by !== p.id) return;
    sheriff.cuffed = null;
    jailMe(m.c | 0, SHERIFF.sentence, `Sheriff ${p.name || ""} locks you up. ${SHERIFF.sentence}s`.replace("  ", " "), { walkIn: true });
    lockClank(null);
  } else if (m.e === "nocuff") {
    const why = m.why === "owner" ? "Nobody cuffs the owner" : m.why === "cool" ? "Just let out: give them a couple of minutes" : "They're already in trouble";
    sheriff.towing = null;
    showWaveBanner(why, 1800);
  }
}

/* -------------------------------------------------------- wanted board */

const board = {
  el: null, wasLocked: false,
  isOpen() { return !!this.el && !this.el.hidden; },
  mount() {
    if (this.el) return;
    const el = document.createElement("div");
    el.className = "sheriff-board";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "The wanted board");
    el.hidden = true;
    el.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:30;pointer-events:auto;min-width:min(340px,90vw);max-height:80vh;overflow:auto;"
      + "background:rgba(30,20,12,.94);border:1px solid rgba(224,173,79,.6);border-radius:14px;padding:14px 16px;color:#f4e8cf;font:600 14px/1.35 'DM Sans',sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5)";
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.close) this.close(); else this.toggle(b.dataset.id);
    });
    window.addEventListener("keydown", (e) => {
      if (!this.isOpen()) return;
      if (e.code === "Escape") { e.preventDefault(); this.close(); return; }
      const n = /^Digit(\d)$/.exec(e.code)?.[1];
      if (!n) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const b = this.el.querySelectorAll("button[data-id]")[+n - 1];
      if (b) this.toggle(b.dataset.id);
    }, true);
    (game.els.hud || document.body).appendChild(el);
    this.el = el;
  },
  open() {
    this.mount();
    releaseHeldInputs();
    this.wasLocked = !game.isTouch && !!document.pointerLockElement;
    if (this.wasLocked) game.controls?.unlock?.();
    this.render();
    this.el.hidden = false;
    this.el.querySelector("button")?.focus();
  },
  close() {
    if (!this.isOpen()) return;
    this.el.hidden = true;
    releaseHeldInputs();
    if (this.wasLocked && game.gameState === "playing") game.controls?.lock?.();
  },
  toggle(id) {
    const i = sheriff.wanted.findIndex((w) => w.id === id);
    if (i >= 0) sheriff.wanted.splice(i, 1);
    else if (sheriff.wanted.length < 3) sheriff.wanted.push({ id, crime: Math.floor(Math.random() * CRIMES.length) });
    this.render();
  },
  render() {
    const people = [...game.net.peers.values()].filter((p) => !game.isBotPeer(p));
    const rows = people.map((p, k) => {
      const w = sheriff.wanted.find((x) => x.id === p.id);
      const label = w ? `Take down ${p.name || "someone"}` : `Post ${p.name || "someone"}`;
      return `<button type="button" data-id="${p.id}" style="display:block;width:100%;text-align:left;margin:6px 0;padding:9px 12px;border-radius:10px;border:0.5px solid rgba(224,173,79,.5);background:${w ? "#b8862e" : "rgba(255,255,255,.06)"};color:${w ? "#1c1208" : "#f4e8cf"};font:inherit;cursor:pointer">${k + 1}. ${esc(label)}${w ? ` · ${esc(CRIMES[w.crime][0])}` : ""}</button>`;
    }).join("");
    this.el.innerHTML = `<div style="font:800 18px/1.2 'DM Sans',sans-serif;margin-bottom:6px">Wanted · ${sheriff.wanted.length}/3</div>`
      + (rows || `<p style="margin:8px 0;opacity:.8">Nobody else in town.</p>`)
      + `<button type="button" data-close="1" style="margin-top:8px;padding:8px 14px;border-radius:10px;border:0.5px solid rgba(255,255,255,.3);background:transparent;color:#f4e8cf;font:inherit;cursor:pointer">Done <kbd style="font:inherit;opacity:.7">Esc</kbd></button>`;
  },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const sheriffBoardOpen = () => board.isOpen();

/* The board everyone sees: the sheriff's list (ours, or the oldest player
   sheriff's `wl`), painted on the posters. */
const posterMats = new Map();
let paintedKey = "", paintedOn = null;
function boardList() {
  if (bar.role === "sheriff") return sheriff.wanted;
  const sh = otherWithRole("sheriff");
  if (!sh?.wanted) return [];
  return sh.wanted.split(";").map((e) => { const [id, c] = e.split(":"); return { id, crime: Math.max(0, Math.min(CRIMES.length - 1, c | 0)) }; }).filter((w) => w.id).slice(0, 3);
}
function nameOf(id) {
  if (id === game.net.id) return playerName?.() || "You";
  return game.net.peers.get(id)?.name || "Somebody";
}
function paintBoard(S, list) {
  const key = list.map((w) => `${w.id}:${w.crime}:${nameOf(w.id)}`).join(";");
  if (key === paintedKey && paintedOn === S.posters) return;   // (a rebuilt map has new posters)
  paintedKey = key;
  paintedOn = S.posters;
  for (let i = 0; i < S.posters.length; i++) {
    const w = list[i];
    if (!w) { S.setPoster(i, null); continue; }
    const [crime, reward] = CRIMES[w.crime];
    const name = nameOf(w.id).slice(0, 18);
    const k = `${name}|${w.crime}`;
    let mat = posterMats.get(k);
    if (!mat) { mat = new THREE.MeshStandardMaterial({ map: wantedPoster(name, crime, reward), roughness: 0.95 }); posterMats.set(k, mat); }
    S.setPoster(i, mat);
  }
}

/* ------------------------------------------------------------ each frame */

let chip = null;
function setChip(text) {
  if (!chip) {
    if (!game.els?.hud) return;
    chip = document.createElement("div");
    chip.style.cssText = "position:absolute;top:58px;left:50%;transform:translateX(-50%);z-index:12;padding:7px 14px;border-radius:999px;background:rgba(30,20,12,.86);border:0.5px solid rgba(224,173,79,.5);color:#f4e8cf;font:600 13px/1 'DM Mono',monospace;pointer-events:none";
    chip.hidden = true;
    game.els.hud.append(chip);
  }
  chip.hidden = !text;
  if (text && chip.textContent !== text) chip.textContent = text;
}

export function updateSheriff(dt) {
  const S = spots();
  const jailChip = updateJail(dt);
  if (!S) {
    if (bar.role === "sheriff") offDuty(null);
    sheriff.cuffed = null; sheriff.cine = null;
    if (game.net) { game.net.cuff = 0; game.net.wanted = null; }
    setChip(null);
    return;
  }
  if (sheriff.cine) stepCine(dt);
  // The cuffs: off when time's up, or their sheriff's gone or off duty.
  if (sheriff.cuffed) {
    const by = game.net.peers.get(sheriff.cuffed.by);
    const rp = game.remotes.byId.get(sheriff.cuffed.by);
    if (!by || by.role !== "sheriff") uncuff("The sheriff's gone. The cuffs slip off");
    else if (now() > sheriff.cuffed.until) uncuff("The cuffs come off");
    else if (rp && Math.hypot(rp.pos.x - game.move.pos.x, rp.pos.z - game.move.pos.z) > 25) uncuff("You slipped the leash");
  }
  if (bar.role !== "sheriff" && (sheriff.wanted.length || sheriff.towing)) { sheriff.wanted = []; sheriff.towing = null; board.close(); }
  if (board.isOpen() && bar.role !== "sheriff") board.close();
  // the wire
  game.net.cuff = sheriff.cine && !sheriff.cine.jailed ? 2 : sheriff.cuffed ? 1 : 0;
  game.net.wanted = bar.role === "sheriff" && sheriff.wanted.length ? sheriff.wanted.map((w) => `${w.id}:${w.crime}`).join(";") : null;
  // the desk's badge, the board
  S.setBadge(!(bar.role === "sheriff" || otherWithRole("sheriff")));
  const list = boardList();
  paintBoard(S, list);
  const me = list.find((w) => w.id === game.net.id);
  // remote arrests time out
  for (const [i, r] of sheriff.remoteArrests) {
    if (now() > r.until) { game.townNpcs?.release(i); sheriff.remoteArrests.delete(i); }
  }
  setChip(sheriff.cuffed ? `Cuffed · ${Math.max(0, Math.ceil((sheriff.cuffed.until - now()) / 1000))}s`
    : jailChip || (me ? `You're wanted · ${CRIMES[me.crime][1]}` : null));
}

/* ------------------------------------------------------------ hook up */

rpExtras.unshift(sheriffAction);   // first: cuffed, nothing else can be held
rpListeners.push(onMessage);
localPosers.push(sheriffPoseLocal);   // our own cuffed hands, after the rest of the pose
// Everyone else's cuffed hands (their hat: modes/social-conductor.js).
peerPosers.push((rp) => {
  if (game.isSocial() && (rp.peer?.cuffed | 0)) poseCuffed(rp.rig, 1);
});

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollSheriff = { SHERIFF, sheriff, jailed, board, townArrest, freeMe, boardList: () => boardList() };
}
