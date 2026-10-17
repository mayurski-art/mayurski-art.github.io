// Grin Sabers — boot, menus and the frame loop. The game itself lives in
// the folders: combat/ (fighters, swings, hits), bots/, modes/ (the duel),
// view/ (scene, saber), arenas/, input/, ui/, sound/.
//
// ?debug exposes window.__gs for the headless tests (tools/grin-sabers-*.mjs).

import * as THREE from "three";
import { createView, DuelCamera } from "./view/scene.js?v=gs2";
import { Sparks, BLADE_COLOURS } from "./view/saber.js?v=gs2";
import { buildCourtyard } from "./arenas/courtyard.js?v=gs2";
import { Duel, ROUNDS_TO_WIN } from "./modes/duel.js?v=gs2";
import { TIERS } from "./bots/duel-bot.js?v=gs2";
import { Input } from "./input/input.js?v=gs2";
import { Hud } from "./ui/hud.js?v=gs2";
import { sfx, Hum, unlockAudio, isMuted, setMuted } from "./sound/sfx.js?v=gs2";
import { flinchRigFrom } from "../troll-ops/characters/character.js?v=gs2";

const $ = (id) => document.getElementById(id);
const canvas = $("gs-canvas");
const view = createView(canvas);
const cam = new DuelCamera(view.camera);
const arena = buildCourtyard(view.scene);
const sparks = new Sparks(view.scene);
const input = new Input(canvas);
const hud = new Hud();
const hums = [new Hum(1), new Hum(0.93)];
// one light per blade, made once (see scene.js on light counts)
const lights = [0, 1].map(() => { const l = new THREE.PointLight(0xffffff, 0, 4, 1.6); return l; });
for (const l of lights) view.scene.add(l);

let colour = BLADE_COLOURS[0].hex;
try { colour = localStorage.getItem("gs_colour") || colour; } catch { /* storage off */ }

let mode = "menu";            // menu | play | paused | result
let duel = null;              // the duel being played or watched
let tier = 1;
let timeScale = 1;            // debug
let slowmo = 1, slowmoT = 0;
let hitstop = 0;
let simNow = 0;
let snapCam = true;
let manual = false;           // tests: the sim only moves through __gs.step()
let camHold = null;           // tools: a fixed camera { pos, look } for posed shots

/* ------------------------------------------------------------ events */

const _l = new THREE.Line3(), _cp = new THREE.Vector3();
function bladePoint(f, at) {
  _l.set(f.root1, f.tip1);
  return _l.closestPointToPoint(at, true, _cp).clone();
}
const isMe = (f) => duel?.kind === "bot" && f === duel.a;
const watching = () => mode === "play" || mode === "paused";

const ctx = {
  emit(type, d) { onEvent(type, d); },
  flinch(def, dx, dz, k) { flinchRigFrom(def.rig, new THREE.Vector3(dx, 0, dz), k); },
};

function onEvent(type, d) {
  const loud = watching();
  switch (type) {
    case "strike":
      if (loud) sfx.whoosh(d.swing?.heavy);
      break;
    case "hit": {
      sparks.burst(d.at, d.att.colour, d.heavy ? 40 : 22, d.heavy ? 5 : 3.5);
      if (loud) sfx.hit(d.heavy);
      hitstop = d.heavy ? 0.09 : 0.05;
      if (isMe(d.def) || isMe(d.att)) cam.shake(d.heavy ? 1 : 0.5);
      if (loud && isMe(d.att) && (d.counter || d.heavy)) hud.callout(d.counter ? "Counter!" : "Bonk!", "#ffc861");
      break;
    }
    case "block": {
      sparks.burst(bladePoint(d.def, d.at), "#fff4d8", 18, 3);
      if (loud) sfx.block();
      hitstop = 0.035;
      if (isMe(d.def) || isMe(d.att)) cam.shake(0.25);
      break;
    }
    case "perfect": {
      const at = bladePoint(d.def, d.at);
      sparks.burst(at, d.def.colour, 30, 4.5);
      sparks.burst(at, "#ffffff", 16, 2.5);
      d.def.saber.flare(1.2);
      if (loud) sfx.perfect();
      hitstop = 0.08;
      if (loud && isMe(d.def)) hud.callout("Perfect block", "#ffffff");
      if (loud && isMe(d.att)) hud.callout("Parried", "#ff9a8a");
      break;
    }
    case "disarm":
      sparks.burst(bladePoint(d.def, d.at), "#ffffff", 40, 5);
      if (loud) sfx.disarm();
      hitstop = 0.1;
      if (loud && isMe(d.def)) hud.callout("Disarmed them!", "#ffc861");
      if (loud && isMe(d.att)) hud.callout("Disarmed. Grab it!", "#ff9a8a");
      break;
    case "guardbreak":
      sparks.burst(bladePoint(d.def, d.at), "#ffc861", 24, 4);
      if (loud) sfx.guardbreak();
      if (isMe(d.def) || isMe(d.att)) cam.shake(0.7);
      if (loud) hud.callout(isMe(d.def) ? "Guard broken" : "Guard break!", isMe(d.def) ? "#ff9a8a" : "#ffc861");
      break;
    case "clash":
      if (loud) { sfx.clash(); hud.callout("Clash! Mash attack", "#ffffff"); }
      cam.shake(0.6);
      break;
    case "clashEnd":
      if (loud) sfx.clashEnd();
      if (loud && d.winner) hud.callout(isMe(d.winner) ? "Won the clash" : "Lost the clash", isMe(d.winner) ? "#ffc861" : "#ff9a8a");
      break;
    case "ko":
      sparks.burst(d.at, d.att.colour, 60, 6);
      if (loud) sfx.ko();
      slowmo = 0.3; slowmoT = 1.2;
      cam.shake(1);
      break;
    case "feint":
      if (loud) sfx.feint();
      break;
    case "jump":
    case "dodge":
      if (loud && type === "dodge") sfx.dodge();
      break;
    case "pickup":
      if (loud) sfx.ignite();
      break;
    case "roundStart":
      snapCam = true;
      if (d.duel.kind === "bot") {
        hud.setPips(d.duel.wins.a, d.duel.wins.b, ROUNDS_TO_WIN);
        hud.banner(`Round ${d.round}`, "", 1.6);
      }
      break;
    case "ignite":
      if (loud) sfx.ignite();
      break;
    case "fight":
      if (d.kind === "bot") { hud.banner("Fight!", "", 0.9); if (loud) sfx.bell(); }
      break;
    case "roundEnd": {
      const du = d.duel;
      if (du.kind !== "bot") break;
      hud.setPips(du.wins.a, du.wins.b, ROUNDS_TO_WIN);
      const sub = d.why === "time" ? "Time" : "";
      if (d.winner === du.a) hud.banner(d.matchOver ? "You win" : "Round to you", sub || "Problem?", 2.6);
      else if (d.winner === du.b) hud.banner(d.matchOver ? "Bonked" : `Round to ${du.b.name}`, sub, 2.6);
      else hud.banner("Draw", sub, 2.6);
      break;
    }
    case "matchEnd":
      if (d.duel.kind === "demo") setTimeout(() => { if (mode === "menu" || mode === "result") startDemo(); }, 600);
      else showResult(d.duel, d.winner);
      break;
  }
}

/* ------------------------------------------------------------- modes */

function clearDuel() {
  if (duel) duel.dispose();
  duel = null;
  sparks.p.length = 0;
}

function startDemo() {
  clearDuel();
  const pairs = [[2, 3], [1, 2], [3, 3], [0, 1]];
  const pick = pairs[Math.floor(Math.random() * pairs.length)];
  duel = new Duel({ scene: view.scene, arena, ctx, kind: "demo", lights, demoTiers: pick });
  snapCam = true;
}

function startDuel(t) {
  tier = t;
  clearDuel();
  duel = new Duel({ scene: view.scene, arena, ctx, kind: "bot", tier, colour, lights });
  hud.setNames("You", TIERS[tier].name, colour, TIERS[tier].colour);
  hud.setPips(0, 0, ROUNDS_TO_WIN);
  mode = "play";
  input.enabled = true;
  input.wantLock = !view.touch;
  document.body.classList.add("playing");
  showMenu(null);
  hud.show(true);
  $("gs-touch").hidden = !view.touch;
  snapCam = true;
  if (!view.touch && canvas.requestPointerLock && !window.__gsHeadless) canvas.requestPointerLock();
}

function toMenu(card = "main") {
  mode = "menu";
  input.enabled = false;
  input.wantLock = false;
  if (document.pointerLockElement) document.exitPointerLock();
  document.body.classList.remove("playing");
  hud.show(false);
  $("gs-touch").hidden = true;
  for (const h of hums) h.stop();
  startDemo();
  showMenu(card);
}

function pause(on) {
  if (on && mode === "play") {
    mode = "paused";
    input.wantLock = false;
    if (document.pointerLockElement) document.exitPointerLock();
    showMenu("pause");
  } else if (!on && mode === "paused") {
    mode = "play";
    input.wantLock = !view.touch;
    showMenu(null);
    if (!view.touch && canvas.requestPointerLock) canvas.requestPointerLock();
  }
}

function showResult(du, winner) {
  mode = "result";
  input.enabled = false;
  input.wantLock = false;
  if (document.pointerLockElement) document.exitPointerLock();
  document.body.classList.remove("playing");
  $("gs-touch").hidden = true;
  const won = winner === du.a;
  $("gs-result-title").textContent = won ? `You beat ${du.b.name}` : `${du.b.name} got you`;
  const s = du.a.stats;
  const bits = [`${du.wins.a}–${du.wins.b} in rounds`, `${s.perfects} perfect block${s.perfects === 1 ? "" : "s"}`];
  if (s.disarms) bits.push(`${s.disarms} disarm${s.disarms === 1 ? "" : "s"}`);
  $("gs-result-line").textContent = bits.join(" · ") + (won ? ". Problem?" : ".");
  setTimeout(() => { if (mode === "result") { hud.show(false); showMenu("result"); } }, 900);
}

/* ------------------------------------------------------------- menus */

const cards = ["main", "tiers", "colour", "help", "result", "pause"];
function showMenu(card) {
  const menu = $("gs-menu");
  menu.hidden = !card;
  for (const c of cards) $(`gs-menu-${c}`).hidden = c !== card;
  if (card) $(`gs-menu-${card}`).querySelector("button")?.focus({ preventScroll: true });
  menu.querySelector(".gs-back").hidden = !(card === "main" || card === "tiers");
}

$("gs-menu").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  unlockAudio();
  sfx.ui();
  if (b.dataset.tier) { startDuel(Number(b.dataset.tier)); return; }
  const act = b.dataset.act;
  if (act === "rematch") { startDuel(tier); return; }
  if (act === "resume") { pause(false); return; }
  if (act === "quit") { toMenu("main"); return; }
  if (b.dataset.go) {
    if (mode === "result" || mode === "paused") { toMenu(b.dataset.go); return; }
    showMenu(b.dataset.go);
  }
});

function drawSwatches() {
  const box = $("gs-swatches");
  box.innerHTML = "";
  for (const c of BLADE_COLOURS) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(c.hex === colour));
    b.style.setProperty("--c", c.hex);
    b.innerHTML = `<i></i>${c.name}`;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      colour = c.hex;
      try { localStorage.setItem("gs_colour", colour); } catch { /* storage off */ }
      unlockAudio();
      sfx.ignite();
      drawSwatches();
      box.querySelector(`[aria-checked="true"]`)?.focus();
    });
    box.appendChild(b);
  }
}
drawSwatches();

const muteBtn = $("gs-mute");
function drawMute() {
  const m = isMuted();
  muteBtn.setAttribute("aria-pressed", String(m));
  muteBtn.setAttribute("aria-label", m ? "Sound off. Unmute" : "Sound on. Mute");
}
muteBtn.addEventListener("click", () => { unlockAudio(); setMuted(!isMuted()); drawMute(); });
drawMute();
addEventListener("pointerdown", () => unlockAudio(), { once: true });
addEventListener("keydown", () => unlockAudio(), { once: true });

/* -------------------------------------------------------------- loop */

let last = performance.now();
let firstFrame = true;
function frame(t) {
  requestAnimationFrame(frame);
  const real = Math.min(0.05, (t - last) / 1000);
  last = t;

  if (input.takeMute()) { setMuted(!isMuted()); drawMute(); }
  if (input.takePause()) {
    if (mode === "play") pause(true);
    else if (mode === "paused") pause(false);
  }

  if (slowmoT > 0) { slowmoT -= real; if (slowmoT <= 0) slowmo = 1; }
  let dt = real * timeScale * slowmo;
  if (hitstop > 0) { hitstop -= real; dt *= 0.08; }
  if (mode === "paused") dt = 0;

  if (manual) dt = 0;
  if (duel) {
    if (mode === "play" && !manual) input.read(duel.me);
    if (dt > 0) { simNow += dt; duel.update(dt, simNow); }
    const { a, b } = duel;
    if (camHold) { view.camera.position.copy(camHold.pos); view.camera.lookAt(camHold.look); }
    else if (duel.kind === "bot") cam.follow(a, b, real, snapCam);
    else cam.spectate(a, b, real, snapCam);
    snapCam = false;
    if (a.clash && dt > 0 && Math.random() < 0.5) sparks.burst(a.clash.at, Math.random() < 0.5 ? a.colour : b.colour, 3, 2.2);

    // hums: louder when the blade moves fast and the camera is near
    const camPos = view.camera.position;
    [a, b].forEach((f, i) => {
      const sp = f.tip0.distanceTo(f.tip1) / Math.max(dt, 1e-3);
      const near = Math.max(0, 1 - f.pos.distanceTo(camPos) / 14);
      hums[i].update(watching() ? f.saber.shown : 0, dt > 0 ? sp : 0, near);
    });
    if (mode === "play" || mode === "paused") hud.update(a, b, duel.clock, view.camera, input.aim, real);
  }

  sparks.update(dt);
  arena.update(t / 1000);
  view.render();

  if (firstFrame) { firstFrame = false; splashReady(); }
}

/* ------------------------------------------------------------ splash */

// The poster stays up until a key, click or tap: that gesture also lets the
// browser start audio. ?debug skips it (tests).
const splash = $("gs-loading");
let splashUp = !new URLSearchParams(location.search).has("debug");
function splashReady() {
  if (!splashUp) { splash.classList.add("gone"); return; }
  splash.classList.add("ready");
  splash.focus({ preventScroll: true });
}
function closeSplash(e) {
  if (!splashUp || !splash.classList.contains("ready")) return;
  e?.preventDefault?.();
  splashUp = false;
  unlockAudio();
  sfx.ignite();
  splash.classList.add("gone");
  showMenu("main");
}
splash.addEventListener("click", closeSplash);
addEventListener("keydown", (e) => { if (splashUp) closeSplash(e); }, true);

/* -------------------------------------------------------------- boot */

startDemo();
showMenu("main");
requestAnimationFrame(frame);

if (new URLSearchParams(location.search).has("debug")) {
  window.__gs = {
    THREE, view, input, TIERS,
    get duel() { return duel; },
    get mode() { return mode; },
    startDuel, toMenu, startDemo,
    setTimeScale(k) { timeScale = k; },
    /* skip the round intro */
    skipIntro() { if (duel && duel.phase === "intro") { duel.phaseT = 9; duel.a.saber.ignite(0.01); duel.b.saber.ignite(0.01); } },
    /* Take the sim off the frame clock (the headless GPU is too slow to
       press keys against), then advance it `sec` seconds in 60 Hz steps.
       `each(k)` runs before every step, for scripted intents. */
    manual(on) { manual = on; },
    step(sec, each = null) {
      const n = Math.round(sec * 60);
      for (let k = 0; k < n; k++) {
        each?.(k);
        simNow += 1 / 60;
        duel.update(1 / 60, simNow);
        sparks.update(1 / 60);
      }
    },
    get now() { return simNow; },
    /* Hold the camera still (the poster tool), or null to let it follow again. */
    holdCamera(pos, look, fov = null) {
      camHold = pos ? { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look) } : null;
      if (fov) { view.camera.fov = fov; view.camera.updateProjectionMatrix(); }
    },
    sparks,
    events: [],
  };
  const orig = onEvent;
  ctx.emit = (type, d) => { window.__gs.events.push({ type, t: simNow, att: d?.att?.name, def: d?.def?.name, winner: d?.winner?.name }); orig(type, d); };
}
