/* Socialize, Troll City: fist fights with the townsfolk (user, 2026-10-07:
   "being able to start a fist fight dual with citizens"; started "by
   running into citizens that can be seen as rude, or through a challenge.
   if you dont accept the challenge you have to sit in jail for 1 minute";
   "pistol should be availble for both citizen and yourself 1:10 odds ...
   if you get shot you bleed out lose conscious and the last thing you see
   is a troll doctor trying to aid you. then you wake up in a bed at the
   doctor's clinic"; the room sees the whole fight).

   - Run into a townsperson (not brushing past) and you get a warning; run
     into another one straight after and that one squares up: hold X to
     accept, walk off or wait it out and the sheriff puts you in the
     courthouse cells for a minute.
   - Or hold X by one to challenge him; he always accepts.
   - The fight: fire throws a punch (it lands up close, roughly in front);
     he jabs back every second or two. Three clean hits each. He goes down
     and stays down a while, or you get floored and come round.
   - One fight in ten, at some point, a side gun turns up: yours (fire to
     shoot, he drops) or his (he draws, you're shot: you bleed out, Doc
     Grin runs over to help, and you wake up on his exam table).
   - Whoever started it drives the citizen and tells the room (rp "duel"
     messages): everyone else's copy of him moves, punches and falls the
     same; your own knock-down shows on your body for them.

   Only the extras fight (no sheriff, doctor or anyone with a job), and
   only where the map has cells (rp.jail: Troll City). */

import * as THREE from "three";
import { rpBusy, rpExtras, rpListeners, rpSeats, sitDown, seated, standUp } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1";
import { touchState } from "../input/touch.js?v=in1-th2";
import { game } from "../core/state.js?v=st1";

const EXTRAS = new Set(["Townsfolk", "Drifter", "Barfly", "Regular", "Gambler"]);
export const DUEL = {
  jailSecs: 60, challengeSecs: 8, gunOdds: 0.1, forceGun: null, gunAt: null,
  bleedSecs: 7, hp: 3, npcHp: 3, punchReach: 1.8, punchCone: 0.62, jabReach: 1.7,
};
// headless tests shorten the waits (tools/troll-ops-duel-test.mjs)
if (typeof window !== "undefined" && window.__trollDuelTune) Object.assign(DUEL, window.__trollDuelTune);

export const duel = {
  phase: null,          // "challenge" | "fight" | "after" | "bleed" | null
  i: -1, n: null,
  t: 0, hp: 0, npcHp: 0,
  act: "square", actT: 0,
  nextJab: 0, punchT: 0, punchCd: 0, landed: false,
  gun: null,            // { at, who, drawn, fired, until }
  ko: 0, bleed: null, jail: null,
  bumps: new Map(), lastBump: null, pubT: 0, fireWas: false, endT: 0,
};
const remote = new Map();   // npc index -> { from, last, x, z, yaw, act, gun }

const npcs = () => game.townNpcs;
const jail = () => (game.isSocial() ? game.builtMap?.map?.rp?.jail?.() || null : null);
const pos = () => game.move.pos;
const send = (m) => game.net.publishRp({ k: "duel", ...m });
const nameOf = (n) => n?.c.name || "The stranger";
const angleTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));   // camera-convention yaw
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* ------------------------------------------------------------- poses */

/* The fighting acts, after the base standing pose: the same on every
   client (the driver's and the room's copies). */
function poseAct(n, rig, act, k, gunOn) {
  const p = rig.parts;
  const bob = Math.sin(performance.now() / 160 + n.seed * 6) * 0.04;
  const guard = () => {
    p.armL.rotation.set(1.25 + bob, 0, 0.3); p.elbowL.rotation.set(2.0, 0, 0);
    p.armR.rotation.set(1.15 - bob, 0, -0.3); p.elbowR.rotation.set(2.1, 0, 0);
  };
  switch (act) {
    case "jab": {
      guard();
      // wound back, then out straight
      const out = k < 0.7 ? 0 : (k - 0.7) / 0.3;
      p.armR.rotation.set(1.0 + out * 0.6, 0, -0.25 + out * 0.2); p.elbowR.rotation.set(2.2 - out * 2.1, 0, 0);
      p.chest.rotation.y = -0.25 + out * 0.45;
      break;
    }
    case "flinch":
      guard();
      p.chest.rotation.x -= 0.35 * (1 - k); p.headPivot.rotation.x = -0.4 * (1 - k);
      break;
    case "down":
      // flat on his back, arms out
      rig.root.rotation.x = -Math.PI / 2;
      rig.root.position.y += 0.16;
      p.armL.rotation.set(0.2, 0, 1.3); p.armR.rotation.set(0.2, 0, -1.3);
      p.elbowL.rotation.set(0.2, 0, 0); p.elbowR.rotation.set(0.2, 0, 0);
      break;
    case "draw":
      p.armR.rotation.set(1.5 * Math.min(1, k * 2), 0, 0); p.elbowR.rotation.set(0.05, 0, 0);
      p.armL.rotation.set(0.3, 0, 0.2); p.elbowL.rotation.set(0.4, 0, 0);
      break;
    case "gloat":
      p.armL.rotation.set(2.9, 0, 0.35 + bob); p.armR.rotation.set(2.9, 0, -0.35 - bob);
      p.elbowL.rotation.set(0.3, 0, 0); p.elbowR.rotation.set(0.3, 0, 0);
      break;
    case "aid":
      // down on a knee over you, hands on the wound
      rig.root.position.y -= 0.42;
      p.legL.rotation.set(1.5, 0, 0.1); p.kneeL.rotation.set(-1.6, 0, 0);
      p.legR.rotation.set(0.2, 0, -0.1); p.kneeR.rotation.set(-1.9, 0, 0);
      p.chest.rotation.x += 0.6;
      p.armL.rotation.set(0.9 + bob, 0, 0.2); p.elbowL.rotation.set(0.4, 0, 0);
      p.armR.rotation.set(0.9 - bob, 0, -0.2); p.elbowR.rotation.set(0.4, 0, 0);
      break;
    default:   // "square"
      guard();
  }
  placeGun(n, rig, gunOn);
}

/* A cheap little revolver: barrel, cylinder, grip. */
function makePistol() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.7, roughness: 0.35 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.7 });
  const add = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m; };
  add(new THREE.BoxGeometry(0.03, 0.03, 0.17), steel, 0, 0.04, -0.09);
  add(new THREE.CylinderGeometry(0.024, 0.024, 0.05, 8), steel, 0, 0.035, 0.0, Math.PI / 2);
  add(new THREE.BoxGeometry(0.028, 0.09, 0.04), wood, 0, -0.02, 0.03, -0.35);
  return g;
}
const _a = new THREE.Vector3(), _q = new THREE.Quaternion();
function placeGun(n, rig, on) {
  if (on && !n.pistol) { n.pistol = makePistol(); game.scene.add(n.pistol); }
  if (!n.pistol) return;
  n.pistol.visible = !!on && rig.root.visible;
  if (!n.pistol.visible) return;
  rig.root.updateMatrixWorld(true);
  rig.parts.handR.getWorldPosition(_a);
  n.pistol.position.copy(_a);
  n.pistol.quaternion.copy(rig.root.getWorldQuaternion(_q));
}
function dropGun(n) { if (n?.pistol) { n.pistol.parent?.remove(n.pistol); n.pistol = null; } }

/* ------------------------------------------------------- our fight */

function extras() {
  const t = npcs();
  if (!t || !jail()) return [];
  return t.list.map((n, i) => ({ n, i })).filter(({ n }) => EXTRAS.has(n.c.role) && !n.c.sit && !n.off && !n.override);
}

function takeOver(i) {
  const n = npcs()?.takeOver(i, (nn, rig) => {
    const k = duel.actT;
    poseAct(nn, rig, duel.act, k, duel.gun?.who === "npc" && duel.gun.drawn && !duel.gun.gone);
  });
  return n;
}

function setAct(act) { duel.act = act; duel.actT = 0; }

export function challengeFrom(i) {
  const n = takeOver(i);
  if (!n) return;
  Object.assign(duel, { phase: "challenge", i, n, t: 0 });
  setAct("square");
  n.yaw = angleTo(n.x, n.z, pos().x, pos().z);   // facing us (NPCs face the camera's way: town-npcs.js walk)
  showWaveBanner(`${nameOf(n)}: "Watch it, troll! Put 'em up!" Hold X to fight, or it's the cells`, 3200);
  send({ e: "start", n: i, x: n.x, z: n.z });
}

export function startFight(i) {
  const n = duel.n && duel.i === i ? duel.n : takeOver(i);
  if (!n) return;
  if (seated) standUp();
  const roll = DUEL.forceGun || (Math.random() < DUEL.gunOdds ? (Math.random() < 0.5 ? "me" : "npc") : null);
  Object.assign(duel, {
    phase: "fight", i, n, t: 0, hp: DUEL.hp, npcHp: DUEL.npcHp, nextJab: 1.4, punchT: 0, punchCd: 0, ko: 0,
    gun: roll ? { at: DUEL.gunAt ?? 2 + Math.random() * 8, who: roll, drawn: false, fired: false, gone: false } : null,
  });
  setAct("square");
  rpBusy.fists = true;
  showWaveBanner(`Fist fight with ${nameOf(n)}! Fire to punch`, 2000);
  send({ e: "start", n: i, x: n.x, z: n.z });
}

/* Fire, in a fight: a jab (or, with the side gun out, the shot). */
export function punch() {
  if (duel.phase !== "fight" || duel.ko > 0) return;
  if (duel.gun?.who === "me" && duel.gun.drawn && !duel.gun.fired && !duel.gun.gone) { shoot(); return; }
  if (duel.punchCd > 0) return;
  duel.punchT = 0.001; duel.punchCd = 0.45; duel.landed = false;
  send({ e: "punch" });
}

function shoot() {
  const n = duel.n;
  duel.gun.fired = true;
  game.audio.revolverShot?.(1, { x: pos().x, y: pos().y + 1.4, z: pos().z });
  setAct("down");
  duel.phase = "after"; duel.endT = 15;
  showWaveBanner(`BANG. ${nameOf(n)} won't be getting up for a while`, 2600);
  send({ e: "bang", n: duel.i, who: "me" });
  send({ e: "down", n: duel.i });
}

function jailMe(why) {
  const J = jail();
  endFight(true);
  if (!J?.cells.length) return;
  const ci = Math.floor(Math.random() * J.cells.length), c = J.cells[ci];
  if (seated) standUp();
  game.move.reset(c.x, c.z, c.y);
  game.look.yaw = c.yaw;
  c.setShut(true); c.shut = true;
  duel.jail = { ci, left: DUEL.jailSecs };
  showWaveBanner(`Sheriff Grimes: "${why} That's a minute in the cells, partner."`, 3200);
  send({ e: "jail", c: ci, on: 1 });
}

function freeMe() {
  const c = jail()?.cells[duel.jail.ci];
  if (c) { c.setShut(false); c.shut = false; }
  send({ e: "jail", c: duel.jail.ci, on: 0 });
  duel.jail = null;
  showWaveBanner("You're free to go. Behave yourself.", 2200);
}

function endFight(quiet = false) {
  if (duel.i >= 0) {
    dropGun(duel.n);
    npcs()?.release(duel.i);
    if (!quiet || duel.phase) send({ e: "end", n: duel.i });
  }
  Object.assign(duel, { phase: null, i: -1, n: null, gun: null, ko: 0, bleed: null });
  rpBusy.fists = false;
  syncFpGun(false);
}

/* ------------------------------------------------------- every frame */

export function updateDuel(dt) {
  const T = npcs();
  if (!game.isSocial() || !T || !jail()) {
    if (duel.phase || duel.jail) { endFight(true); duel.jail = null; }
    hideOverlay();
    return;
  }
  const now = performance.now() / 1000;
  const p = pos();

  // remote fights time out if their driver went quiet
  for (const [i, r] of remote) if (now - r.last > 3) { dropGun(T.list[i]); T.release(i); remote.delete(i); }

  // the cells
  if (duel.jail) {
    duel.jail.left -= dt;
    const c = jail().cells[duel.jail.ci];
    // stay inside (a respawn or a teleport out is fine; walking out isn't)
    if (Math.abs(p.x - c.x) > 3 || Math.abs(p.z - c.z) > 3.4) { /* moved by something else: let it go */ duel.jail.left = Math.min(duel.jail.left, 0); }
    setChip(`In the cells · ${Math.max(0, Math.ceil(duel.jail.left))}s`);
    if (duel.jail.left <= 0) freeMe();
  } else setChip(null);

  // bumping into folk
  if (!duel.phase && !duel.jail && game.player.alive && !seated) {
    const sp = Math.hypot(game.move.velocity.x, game.move.velocity.z);
    if (sp > 2) {
      for (const { n, i } of extras()) {
        if (Math.hypot(n.x - p.x, n.z - p.z) > 0.7 || Math.abs((n.c.y ?? 0) - p.y) > 1) continue;
        bump(i, now);
        break;
      }
    }
  }

  const n = duel.n;
  if (!duel.phase || !n) { hideOverlay(); return; }
  duel.t += dt;
  duel.actT += dt;
  const d = Math.hypot(n.x - p.x, n.z - p.z);

  if (duel.phase === "challenge") {
    n.yaw = angleTo(n.x, n.z, p.x, p.z);
    if (d > 7) jailMe("Walkin' off from a fair fight?");
    else if (duel.t > DUEL.challengeSecs) jailMe("Too yella to fight?");
  } else if (duel.phase === "fight") fightStep(dt, n, p, d);
  else if (duel.phase === "after") {
    duel.endT -= dt;
    if (duel.endT <= 0) endFight();
  } else if (duel.phase === "bleed") bleedStep(dt, n, p);

  // the room sees him move (10 a second)
  duel.pubT -= dt;
  if (duel.pubT <= 0 && duel.n) {
    duel.pubT = 0.1;
    send({ e: "pose", n: duel.i, x: +n.x.toFixed(2), z: +n.z.toFixed(2), yaw: +n.yaw.toFixed(2), a: duel.act, g: duel.gun?.who === "npc" && duel.gun.drawn ? 1 : 0 });
  }
  overlay();
}

/* A bump is a warning; the next one, into somebody else inside
   BUMP_STREAK s, and that one squares up (user: "should be bump into two
   citizens consecutively, but bumping into one citizen results a pop up
   like be careful not to troll the citizens"). Running into the same
   citizen again is still just a warning. */
const BUMP_STREAK = 15;
function bump(i, now) {
  const last = duel.bumps.get(i);
  if (last != null && now - last < 1.5) return;   // still brushing past the same one
  duel.bumps.set(i, now);
  const n = npcs().list[i];
  game.audio.knuckleHit?.({ x: n.x, y: 1.2, z: n.z });
  const prev = duel.lastBump;
  duel.lastBump = { i, at: now };
  if (prev && prev.i !== i && now - prev.at < BUMP_STREAK) { duel.lastBump = null; challengeFrom(i); }
  else showWaveBanner(`${nameOf(n)}: "Hey!" · Careful, don't troll the citizens. One more and it's a fight`, 2600);
}

function fightStep(dt, n, p, d) {
  // he keeps a step off, square to us
  n.yaw = angleTo(n.x, n.z, p.x, p.z);
  n.moving = false;
  if (d > 1.5 && duel.act !== "down") {
    const s = Math.min(d - 1.3, 2.6 * dt);
    n.x += (p.x - n.x) / d * s; n.z += (p.z - n.z) / d * s; n.moving = true;
  }
  if (d > 9) { showWaveBanner(`${nameOf(n)}: "Yeah, run!"`, 1800); endFight(); return; }
  // knocked down: come round
  if (duel.ko > 0) {
    duel.ko -= dt;
    duel.koAt ??= { x: p.x, y: p.y, z: p.z };
    p.set(duel.koAt.x, duel.koAt.y, duel.koAt.z);
    game.move.velocity.set(0, 0, 0);
    if (duel.ko <= 0) {
      // up again, a couple of steps back from him
      const dx = p.x - n.x, dz = p.z - n.z, l = Math.hypot(dx, dz) || 1;
      game.move.reset(p.x + dx / l * 1.5, p.z + dz / l * 1.5, p.y);
      duel.koAt = null;
      send({ e: "up" });
      setAct("gloat");
      duel.phase = "after"; duel.endT = 3;
      showWaveBanner(`${nameOf(n)} wins this one`, 2000);
    }
    return;
  }
  duel.punchCd = Math.max(0, duel.punchCd - dt);
  // our punch: it lands a moment in, up close and in front
  if (duel.punchT > 0) {
    duel.punchT += dt;
    if (!duel.landed && duel.punchT > 0.12) {
      duel.landed = true;
      const off = Math.abs(wrap(angleTo(p.x, p.z, n.x, n.z) - game.look.yaw));
      if (d < DUEL.punchReach && off < DUEL.punchCone) {
        duel.npcHp--;
        game.audio.knuckleHit?.({ x: n.x, y: 1.5, z: n.z });
        send({ e: "hit", n: duel.i, who: "npc" });
        if (duel.npcHp <= 0) {
          setAct("down");
          duel.phase = "after"; duel.endT = 8;
          showWaveBanner(`${nameOf(n)} is out cold. You win!`, 2400);
          send({ e: "down", n: duel.i });
          return;
        }
        setAct("flinch");
        duel.nextJab = Math.max(duel.nextJab, duel.t + 0.6);
      }
    }
    if (duel.punchT > 0.32) duel.punchT = 0;
  }
  if (duel.act === "flinch" && duel.actT > 0.3) setAct("square");

  // the side gun
  const g = duel.gun;
  if (g && !g.drawn && duel.t >= g.at) {
    g.drawn = true;
    if (g.who === "me") {
      g.until = duel.t + 6;
      showWaveBanner("Wait... is that a side gun?! FIRE!", 2200);
      send({ e: "gun", n: duel.i, who: "me" });
    } else {
      setAct("draw");
      g.until = duel.t + 0.9;
      showWaveBanner(`${nameOf(n)} pulls a gun?!`, 1600);
      send({ e: "gun", n: duel.i, who: "npc" });
    }
  }
  if (g?.drawn && !g.fired && !g.gone) {
    if (g.who === "me" && duel.t > g.until) { g.gone = true; showWaveBanner("You fumbled it. Fists it is", 1600); }
    if (g.who === "npc" && duel.t > g.until) {
      g.fired = true;
      game.audio.revolverShot?.(1, { x: n.x, y: 1.4, z: n.z });
      send({ e: "bang", n: duel.i, who: "npc" });
      startBleed();
      return;
    }
  }
  syncFpGun(g?.who === "me" && g.drawn && !g.fired && !g.gone);
  if (g?.who === "npc" && g.drawn && !g.fired) return;   // drawing: no jabs

  // his jab: wind up, then it lands if we're still in front of him
  if (duel.act === "square" && duel.t >= duel.nextJab) setAct("jab");
  if (duel.act === "jab" && duel.actT >= 0.42) {
    if (d < DUEL.jabReach) {
      duel.hp--;
      game.audio.knuckleHit?.({ x: p.x, y: 1.5, z: p.z });
      game.look.pitch += 0.05;
      flash(0.45);
      send({ e: "hit", n: duel.i, who: "me" });
      if (duel.hp <= 0) {
        duel.ko = 2.6;
        flash(1);
        showWaveBanner("You got floored!", 2000);
        send({ e: "down", me: 1 });
      }
    }
    setAct("square");
    duel.nextJab = duel.t + 1.2 + Math.random() * 0.6;
  }
}

/* Shot: down, bleeding, the doc runs over, black, the exam table. */
function startBleed() {
  duel.phase = "bleed";
  duel.bleed = { t: 0, docI: -1, said: false, home: null };
  setAct("gloat");
  syncFpGun(false);
  send({ e: "down", me: 1 });
  const T = npcs();
  const docI = T.list.findIndex((n) => n.c.role === "Doctor");
  if (docI >= 0 && !T.list[docI].override) {
    const doc = T.takeOver(docI, (nn, rig) => poseAct(nn, rig, duel.bleed?.docAct || "square", 0, false));
    const p = pos();
    // too far to run: he's already on his way
    if (Math.hypot(doc.x - p.x, doc.z - p.z) > 24) { const a = Math.random() * Math.PI * 2; doc.x = p.x + Math.cos(a) * 12; doc.z = p.z + Math.sin(a) * 12; }
    duel.bleed.docI = docI;
    duel.bleed.docAct = "square";
    send({ e: "start", n: docI, x: doc.x, z: doc.z });
  }
  showWaveBanner("You've been shot...", 2200);
}

function bleedStep(dt, n, p) {
  const b = duel.bleed;
  b.t += dt;
  // flat out: no moving, eyes on the sky
  game.move.velocity.set(0, 0, 0);
  b.at ??= { x: p.x, y: p.y, z: p.z };
  p.set(b.at.x, b.at.y, b.at.z);
  game.move.eyeHeight += (0.28 - game.move.eyeHeight) * Math.min(1, dt * 3);
  game.look.pitch += (0.35 - game.look.pitch) * Math.min(1, dt * 1.5);
  const T = npcs();
  const doc = b.docI >= 0 ? T.list[b.docI] : null;
  if (doc) {
    const d = Math.hypot(doc.x - p.x, doc.z - p.z);
    doc.yaw = angleTo(doc.x, doc.z, p.x, p.z);
    // the last thing you see: him, over you
    game.look.yaw += wrap(angleTo(p.x, p.z, doc.x, doc.z) - game.look.yaw) * Math.min(1, dt * 2);
    if (d > 0.9) {
      const s = Math.min(d - 0.85, 5 * dt);
      doc.x += (p.x - doc.x) / d * s; doc.z += (p.z - doc.z) / d * s; doc.moving = true;
      b.docAct = "square";
    } else {
      doc.moving = false;
      b.docAct = "aid";
      if (!b.said) { b.said = true; showWaveBanner('Doc Grin: "Hold still, you idiot. Stay with me!"', 2600); }
    }
    send({ e: "pose", n: b.docI, x: +doc.x.toFixed(2), z: +doc.z.toFixed(2), yaw: +doc.yaw.toFixed(2), a: b.docAct, g: 0 });
  }
  if (b.t >= DUEL.bleedSecs + 1.6) wake();
}

function wake() {
  const b = duel.bleed;
  if (b?.docI >= 0) { npcs().release(b.docI); send({ e: "end", n: b.docI }); }
  endFight();
  send({ e: "up" });
  const seats = rpSeats() || [];
  const exam = seats.findIndex((s) => s.kind === "exam");
  if (exam >= 0) sitDown(exam);
  showWaveBanner("You wake up at Doc Grin's. The bill's on the house.", 3200);
}

/* Hold X: take up a challenge, or start one. */
rpExtras.push(() => {
  if (!game.isSocial() || !jail() || duel.jail || !game.player.alive) return null;
  if (duel.phase === "challenge") {
    return { key: "duel-accept", label: `Fight ${nameOf(duel.n)}`, ctx: "Fight", time: 0.35, done: () => startFight(duel.i) };
  }
  if (duel.phase || seated) return null;
  const p = pos();
  let best = null, bestD = 1.8;
  for (const e of extras()) {
    const d = Math.hypot(e.n.x - p.x, e.n.z - p.z);
    if (d < bestD && Math.abs((e.n.c.y ?? 0) - p.y) < 1) { best = e; bestD = d; }
  }
  if (!best) return null;
  return { key: `duel-${best.i}`, label: `Challenge ${nameOf(best.n)} to a fist fight`, ctx: "Fight", time: 0.6, done: () => startFight(best.i) };
});

/* Fire, read here each frame (Socialize has no gun to fire). */
export function duelFire() {
  const fire = !game.localPauseOnly && (game.mouseDown || (game.isTouch && touchState.firing) || (game.gamepadState.connected && game.gamepadState.firing));
  if (fire && !duel.fireWas) punch();
  duel.fireWas = fire;
}

/* --------------------------------------------------- the room's fights */

rpListeners.push((p, m) => {
  if (m.k !== "duel" || game.isBotPeer(p)) return;
  const T = npcs();
  const i = m.n | 0;
  const at = (n) => ({ x: n.x, y: 1.4, z: n.z });
  if (m.e === "punch") { p.punchAt = performance.now(); return; }
  if (m.e === "down" && m.me) { p.duelDown = true; return; }
  if (m.e === "up") { p.duelDown = false; return; }
  if (m.e === "jail") { const c = jail()?.cells[m.c | 0]; if (c) { c.setShut(!!m.on); c.shut = !!m.on; } return; }
  if (!T || !T.list[i] || (duel.i === i && duel.phase)) return;
  const n = T.list[i];
  let r = remote.get(i);
  if (m.e === "start") {
    if (!Number.isFinite(+m.x) || !Number.isFinite(+m.z)) return;
    r = { from: p.id, last: performance.now() / 1000, act: "square", actAt: performance.now(), g: 0 };
    remote.set(i, r);
    n.x = +m.x; n.z = +m.z;
    T.takeOver(i, (nn, rig) => poseAct(nn, rig, r.act, Math.min(1, (performance.now() - r.actAt) / 420), !!r.g));
    return;
  }
  if (!r || r.from !== p.id) return;
  r.last = performance.now() / 1000;
  if (m.e === "pose") {
    if (Number.isFinite(+m.x) && Number.isFinite(+m.z)) {
      n.moving = Math.hypot(+m.x - n.x, +m.z - n.z) > 0.05;
      n.x = +m.x; n.z = +m.z;
    }
    if (Number.isFinite(+m.yaw)) n.yaw = +m.yaw;
    if (typeof m.a === "string" && m.a !== r.act) { r.act = m.a.slice(0, 12); r.actAt = performance.now(); }
    r.g = m.g ? 1 : 0;
  } else if (m.e === "hit") game.audio.knuckleHit?.(at(n));
  else if (m.e === "bang") game.audio.revolverShot?.(1, at(n));
  else if (m.e === "down") { r.act = "down"; r.actAt = performance.now(); }
  else if (m.e === "end") { dropGun(n); T.release(i); remote.delete(i); }
});

/* ------------------------------------------------- what we see of it */

let ui = null;
function ensureUi() {
  if (ui || !game.els?.hud) return ui;
  const veil = document.createElement("div");
  veil.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:9;opacity:0;transition:opacity .25s;background:radial-gradient(ellipse at center, rgba(120,0,0,0) 35%, rgba(150,0,0,.85) 100%)";
  const black = document.createElement("div");
  black.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:10;opacity:0;background:#000";
  const chip = document.createElement("div");
  chip.style.cssText = "position:absolute;top:58px;left:50%;transform:translateX(-50%);z-index:12;padding:7px 14px;border-radius:999px;background:rgba(30,20,12,.86);border:0.5px solid rgba(224,173,79,.5);color:#f4e8cf;font:600 13px/1 'DM Mono',monospace;pointer-events:none";
  chip.hidden = true;
  game.els.hud.append(veil, black, chip);
  ui = { veil, black, chip, flashK: 0, at: performance.now() };
  return ui;
}
function flash(k) { if (ensureUi()) ui.flashK = Math.max(ui.flashK, k); }
function setChip(text) {
  if (!ensureUi()) return;
  ui.chip.hidden = !text;
  if (text) ui.chip.textContent = text;
}
function overlay() {
  if (!ensureUi()) return;
  const now = performance.now(), dt = (now - ui.at) / 1000;
  ui.at = now;
  ui.flashK = Math.max(0, ui.flashK - dt * 1.6);
  let red = ui.flashK, black = 0;
  if (duel.ko > 0) black = Math.min(1, (2.6 - duel.ko) * 3) * (duel.ko < 0.5 ? duel.ko * 2 : 1);
  if (duel.phase === "bleed" && duel.bleed) {
    const t = duel.bleed.t;
    red = Math.min(1, 0.4 + t / DUEL.bleedSecs * 0.6) * (0.85 + Math.sin(t * 5) * 0.15);
    black = Math.max(0, Math.min(1, (t - DUEL.bleedSecs) / 1.4));
  }
  ui.veil.style.opacity = String(red);
  ui.black.style.opacity = String(black);
}
function hideOverlay() { if (ui) { ui.veil.style.opacity = "0"; ui.black.style.opacity = "0"; ui.flashK = 0; } }

/* First person: fists up in a fight, a jab on fire; the side gun in hand. */
export function duelArms() {
  if (duel.phase !== "fight" || duel.ko > 0) return null;
  const k = duel.punchT > 0 ? Math.sin(Math.min(1, duel.punchT / 0.32) * Math.PI) : 0;
  const gun = duel.gun?.who === "me" && duel.gun.drawn && !duel.gun.fired && !duel.gun.gone;
  const R = gun
    ? { pos: [0.14, -0.17, -0.5], rot: [0.05, 0, -Math.PI / 2], pose: "grip" }
    : { pos: [0.15 - k * 0.07, -0.21 + k * 0.08, -0.38 - k * 0.26], rot: [0.55 - k * 0.35, 0.12, -Math.PI / 2], pose: "fist" };
  const L = { pos: [-0.16, -0.2, -0.36], rot: [0.6, -0.12, Math.PI / 2], pose: "fist" };
  return { R, L, gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
}

let fpGun = null;
export function syncFpGun(show) {
  const arms = game.streakArms?.userData?.arms;
  if (!arms) return;
  if (show && !fpGun) fpGun = makePistol();
  if (!fpGun) return;
  const hand = arms[0].hand;
  if (show) {
    if (fpGun.parent !== hand.parent) hand.parent.add(fpGun);
    fpGun.position.copy(hand.position);
    fpGun.quaternion.copy(hand.quaternion);
    fpGun.rotateZ(Math.PI / 2);
    fpGun.scale.setScalar(1.6);
  }
  fpGun.visible = !!show;
}

// headless tests reach in here (tools/troll-ops-duel-test.mjs)
if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollDuel = { duel, DUEL, remote, bump: (i) => bump(i, performance.now() / 1000), challengeFrom, startFight, punch, extras: () => extras().map(({ n, i }) => ({ i, name: n.c.name, x: n.x, z: n.z })) };
}
