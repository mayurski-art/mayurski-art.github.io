// Troll Forces — the court games' opening (Troll Beach, Socialize). Before
// a hoops game (modes/hoops-game.js) tips off or a tennis match
// (modes/social-tennis.js) serves, everyone in it gets a few seconds of
// letterboxed shots, the TDM intro's language (modes/match-intro.js: the
// same overlay classes, style.css .to-intro*):
//
//   title  a high drift over the court, the sport and the matchup;
//   foe    a roll call of the other side from the front, slightly above and
//          tilted, each with a callout and a cheap shot;
//   whip   a whip pan across the court with the VS slam;
//   us     your teammate(s) from down low, warm; alone, that's you;
//   hero   round your own body into the over-the-shoulder camera the court
//          plays in, so the cut back is one move.
//
// The host stamps the game with `introAt` / `introUntil` (room ms); every
// client in the game runs the same timeline off the room clock, so a late
// packet still lands on the tip-off. Nobody moves or hits till it's over
// (view/player-update.js freezes the stick while courtIntroOn(); the games
// gate their fire). Spectators by the court aren't filmed: their view is
// their own.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { roomNow } from "./room-clock.js?v=rc1-cd1-sh1";
import { raycastWorld } from "../weapons/ballistics.js?v=cg1-wst-hf1-fu1b7-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-or1-gf1-tg1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";

export const CI = {
  secs: 5.8,                                  // what the games stamp
  plan: [["title", 0.9], ["foe", 1.9], ["whip", 0.45], ["us", 1.55], ["hero", 1.0]],
  zoom: 1.12,                                 // a longer lens while it plays
  lines: {
    hoops: {
      foe: ["Calls every foul", "Only shoots threes", "Travels. Constantly.", "Posts up the referee", "Ankle insurance: none", "Hasn't missed since 2011 (allegedly)", "Dunks on cousins at Thanksgiving", "Reaches on every dribble"],
      us: ["Green or nothing", "Carrying, obviously", "Doesn't pass. Ever.", "Built for the fourth quarter", "Cooked on the first dribble", "Rim protector (self-declared)"],
    },
    tennis: {
      foe: ["Serves at 180 and misses", "Grunts on every ball", "Argues every line call", "Slices everything", "Second-serve merchant", "Lives at the net", "Moonballs when nervous"],
      us: ["Sweet spot or nothing", "Topspin from the baseline", "Never double faults (allegedly)", "Drop-shot enjoyer", "Aces for breakfast"],
    },
  },
};

/* The one playing: { spec, t0, total, shot, seg, ... } */
export const intro = { on: null };
export const courtIntroOn = () => !!intro.on;

const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const _up = new THREE.Vector3(0, 1, 0), _fwd = new THREE.Vector3(0, 0, -1);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _dir = new THREE.Vector3(), _look = new THREE.Vector3(), _pos = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _roll = new THREE.Quaternion(), _proj = new THREE.Vector3();

/* spec: {
     id        the game's id (one intro a game)
     sport     "hoops" | "tennis"
     at, until room ms: the host's stamp
     kicker, title, sub   the title card ("Troll Beach", "HOOPS", "A vs B")
     foeName, usName      the plates
     foes, us  actor ids (us: you first)
     actor(id) -> { name, x, y, z, yaw } | null, read fresh every shot
     self()    -> { feet: {x,y,z}, yaw, name }
   } */
export function startCourtIntro(spec) {
  if (intro.on?.spec.id === spec.id) return;
  const total = Math.max(0.5, (spec.until - spec.at) / 1000);
  const nominal = CI.plan.reduce((s, x) => s + x[1], 0);
  intro.on = { spec, total, scale: total / nominal, shot: null, seg: -1, roll: null, from: null, whip: null, subject: null, tags: new Map(), posedAt: 0 };
  ui.mount();
  ui.open(spec);
  game.audio?.introRiser?.(Math.max(1, (spec.until - roomNow()) / 1000));
}
export function stopCourtIntro() {
  if (!intro.on) return;
  intro.on = null;
  ui.close();
}

/* -------------------------------------------------------------- actors */

function group(ids) {
  const S = intro.on.spec;
  const list = ids.map((id) => { const a = S.actor(id); return a && { id, ...a }; }).filter(Boolean);
  if (!list.length) return null;
  const c = new THREE.Vector3();
  for (const a of list) c.add(_v.set(a.x, a.y || 0, a.z));
  c.multiplyScalar(1 / list.length);
  return { list, c };
}

/* Each actor framed from in front (their facing), from whichever bearing
   has the room, slightly above for the other side, from below for ours. */
function rollCall(ids, villain) {
  const g = group(ids);
  if (!g) return null;
  const list = g.list.slice(0, 3).map((a, i) => {
    const facing = a.yaw ?? 0;
    const head = _v.set(a.x, (a.y || 0) + 1.35, a.z);
    const want = villain ? 3.6 : 3.0;
    let best = { ang: facing, free: -1 };
    for (const off of [0, 0.55, -0.55, 1.1, -1.1, 1.8, -1.8, Math.PI]) {
      const ang = facing + off;
      _dir.set(-Math.sin(ang), villain ? 0.22 : -0.17, -Math.cos(ang)).normalize();
      const free = raycastWorld(game.colliders, head, _dir, want);
      if (free > best.free + 0.4) best = { ang, free };
      if (free >= want - 0.05) break;
    }
    return { actor: a, ang: best.ang, tilt: villain ? (i % 2 ? -0.12 : 0.12) : 0 };
  });
  return { villain, list, seg: -1 };
}

/* ------------------------------------------------------------- the shots */

/* Each frame while it plays (view/player-update.js). Returns whether our
   own body is in the shot (it always is: the court plays in third person). */
export function placeCourtIntro(camera) {
  const I = intro.on;
  if (!I) return true;
  const S = I.spec;
  const t = (roomNow() - S.at) / 1000;
  if (t >= I.total || roomNow() >= S.until) { stopCourtIntro(); return true; }
  camera.zoom = CI.zoom;
  camera.updateProjectionMatrix();
  // which shot, how far through it
  let acc = 0, idx = CI.plan.length - 1, k = 1;
  for (let i = 0; i < CI.plan.length; i++) {
    const d = CI.plan[i][1] * I.scale;
    if (t < acc + d) { idx = i; k = (t - acc) / d; break; }
    acc += d;
  }
  const id = CI.plan[idx][0];
  if (I.shot !== id) enterShot(I, id, camera);
  if (id === "title") placeTitle(I, camera, k);
  else if (id === "foe") placeRoll(I, camera, I.roll, k);
  else if (id === "whip") placeWhip(I, camera, k);
  else if (id === "us") placeRoll(I, camera, I.roll, k);
  else placeHero(I, camera, k);
  ui.tags(I, camera, id);
  if (id === "hero" && k > 0.84) ui.el.classList.add("is-opening");
  return true;
}

function enterShot(I, id, camera) {
  I.shot = id;
  const S = I.spec;
  ui.el.dataset.shot = id;
  ui.el.classList.remove("is-cut");
  ui.clearTags(I);
  if (id === "title") {
    ui.title(S.kicker, S.title, S.sub);
    ui.plate(null);
  } else if (id === "foe") {
    ui.title(null);
    I.roll = rollCall(S.foes, true);
    if (!I.roll) { I.roll = null; return; }
    ui.plate(S.sport === "tennis" ? "Across the net" : "The other side", S.foeName, `${I.roll.list.length} troll${I.roll.list.length === 1 ? "" : "s"}`, "#ff4d3d");
    game.audio?.introHit?.();
  } else if (id === "whip") {
    ui.plate(null);
    I.whip = { from: { pos: camera.position.clone(), quat: camera.quaternion.clone() } };
    // where the next shot starts, so the pan lands on it
    const mates = S.us.slice(1);
    I.roll = rollCall(mates.length ? mates : S.us.slice(0, 1), false);
    if (I.roll) placeRoll(I, camera, I.roll, 0, true);
    I.whip.to = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
    camera.position.copy(I.whip.from.pos); camera.quaternion.copy(I.whip.from.quat);
    game.audio?.introWhoosh?.();
    setTimeout(() => { if (intro.on === I) game.audio?.introSlam?.(); }, 160 * I.scale);
  } else if (id === "us") {
    ui.title(null);
    const mates = S.us.slice(1);
    if (!I.roll || I.roll.villain) I.roll = rollCall(mates.length ? mates : S.us.slice(0, 1), false);
    ui.plate(mates.length ? "Your side" : "You", S.usName, mates.length ? `${mates.length + 1} trolls` : (S.sport === "tennis" ? "Singles. Just you." : "Just you. Good luck."), "#ffd76a");
  } else if (id === "hero") {
    const self = S.self();
    ui.plate("You", self.name, S.usName, "#ffd76a");
    ui.clearTags(I);
    I.from = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
  }
}

/* Wide, high and slow over the court between the two sides. */
function placeTitle(I, camera, k) {
  const S = I.spec;
  const a = group(S.us)?.c || _v.set(S.self().feet.x, 0, S.self().feet.z).clone();
  const b = group(S.foes)?.c || a.clone().add(_w.set(0, 0, -12));
  const mid = _v.addVectors(a, b).multiplyScalar(0.5);
  const span = Math.max(14, a.distanceTo(b) + 6);
  _dir.subVectors(b, a).setY(0).normalize();
  const side = _w.set(-_dir.z, 0, _dir.x);
  const ang = -0.35 + 0.3 * ease(k);
  _pos.copy(mid).addScaledVector(side, Math.cos(ang) * span * 0.55).addScaledVector(_dir, Math.sin(ang) * span * 0.55);
  _pos.y = mid.y + span * 0.36 + 5 - 2 * k;
  _look.copy(mid); _look.y += 1;
  setCam(camera, _pos, _look, 0, 2);
}

/* A quick cut to each troll in turn, a slow arc across each. */
function placeRoll(I, camera, roll, k, silent = false) {
  if (!roll?.list.length) { placeTitle(I, camera, k); return; }
  const n = roll.list.length;
  const seg = Math.min(n - 1, Math.floor(k * n));
  const u = clamp01(k * n - seg);
  if (seg !== roll.seg && !silent) {
    roll.seg = seg;
    I.subject = roll.list[seg].actor;
    if (k > 0) ui.cut(I, roll.villain);
  }
  const { actor, ang, tilt } = roll.list[seg];
  const v = roll.villain;
  const a = ang + (v ? -0.18 : 0.22) * (u - 0.5);
  const dist = v ? 3.5 - 0.8 * easeOut(u) : 3.0 - 0.6 * easeOut(u);
  const S = I.spec, fresh = S.actor(actor.id) || actor;   // where they stand now
  _pos.set(fresh.x - Math.sin(a) * dist, (fresh.y || 0) + (v ? 2.15 : 0.85), fresh.z - Math.cos(a) * dist);
  _look.set(fresh.x, (fresh.y || 0) + (v ? 1.3 : 1.5), fresh.z);
  setCam(camera, _pos, _look, tilt * (1 - 0.3 * u), 0.7);
}

/* Out of the last foe on a hard pan, the cut under the flash, into the
   first of ours out of the same pan. */
function placeWhip(I, camera, k) {
  const W = I.whip;
  if (!W) return;
  const PAN = 1.25;
  if (k < 0.5) {
    const u = easeIn(k * 2);
    camera.position.copy(W.from.pos);
    _q.setFromAxisAngle(_up, -PAN * u);
    camera.quaternion.copy(_q).multiply(W.from.quat);
  } else {
    const u = 1 - easeOut((k - 0.5) * 2);
    camera.position.copy(W.to.pos);
    _q.setFromAxisAngle(_up, PAN * u);
    camera.quaternion.copy(_q).multiply(W.to.quat);
  }
}

/* Round our own body from the front to over the right shoulder, where the
   court camera (view/third-person.js) picks it up. */
function placeHero(I, camera, k) {
  const self = I.spec.self();
  const f = self.feet;
  const fwd = _dir.set(-Math.sin(self.yaw), 0, -Math.cos(self.yaw));
  const orbit = ease(clamp01(k / 0.8));
  const ang = Math.PI * (1 - orbit);                  // π = in front, 0 = behind
  const r = 2.6 - 0.4 * orbit;
  const c = Math.cos(ang), s = Math.sin(ang);
  _pos.set(f.x, f.y, f.z);
  _pos.x -= (fwd.x * c - fwd.z * s) * r;
  _pos.z -= (fwd.x * s + fwd.z * c) * r;
  _pos.x += -fwd.z * 0.7 * orbit;
  _pos.z += fwd.x * 0.7 * orbit;
  _pos.y = f.y + 1.35 + 0.45 * orbit;
  _look.set(f.x, f.y + 1.3, f.z).addScaledVector(fwd, 3 * orbit);
  setCam(camera, _pos, _look, 0, 0.35);
  const inK = ease(clamp01(k / 0.25));
  if (I.from && inK < 1) {
    camera.position.lerpVectors(I.from.pos, camera.position, inK);
    _q.copy(camera.quaternion);   // (slerpQuaternions copies its first argument in before it reads the second)
    camera.quaternion.slerpQuaternions(I.from.quat, _q, inK);
  }
  // the lens comes back to the game's over the last stretch
  const z = CI.zoom - (CI.zoom - 1) * ease(clamp01((k - 0.7) / 0.3));
  camera.zoom = z;
  camera.updateProjectionMatrix();
}

/* The camera at pos looking at look, rolled, pulled in off any wall in
   between (the fences, the chair). */
function setCam(camera, pos, look, roll, minDist) {
  _w.subVectors(pos, look);
  const want = _w.length();
  _w.normalize();
  const free = raycastWorld(game.colliders, look, _w, want);
  const len = Math.max(minDist, Math.min(want, free - 0.25));
  camera.position.copy(look).addScaledVector(_w, len);
  _m.lookAt(camera.position, look, _up);
  camera.quaternion.setFromRotationMatrix(_m);
  if (roll) camera.quaternion.multiply(_roll.setFromAxisAngle(_fwd, roll));
}

/* --------------------------------------------------------------- overlay */

const ui = {
  el: null,
  mount() {
    if (this.el) return;
    this.el = document.createElement("div");
    this.el.className = "to-intro to-court-intro";
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="to-intro-grade" aria-hidden="true"></div>
      <div class="to-intro-streaks" aria-hidden="true"></div>
      <div class="to-intro-bar to-intro-bar-t" aria-hidden="true"></div>
      <div class="to-intro-bar to-intro-bar-b" aria-hidden="true"></div>
      <div class="to-intro-tags" aria-hidden="true"></div>
      <div class="to-intro-title" aria-hidden="true"><p class="to-intro-kicker"></p><h2 class="to-intro-head"></h2><p class="to-intro-sub"></p></div>
      <div class="to-intro-plate" aria-hidden="true"><span class="to-intro-plate-kicker"></span><strong class="to-intro-plate-name"></strong><span class="to-intro-plate-sub"></span></div>
      <div class="to-intro-vs" aria-hidden="true">VS</div>
      <div class="to-intro-flash" aria-hidden="true"></div>`;
    (game.els?.hud || document.body).appendChild(this.el);
    this.tagsEl = this.el.querySelector(".to-intro-tags");
  },
  $(sel) { return this.el.querySelector(sel); },
  open(spec) {
    clearTimeout(this._hideT);
    this.el.hidden = false;
    this.el.className = "to-intro to-court-intro";
    this.el.dataset.shot = "";
    this.el.style.setProperty("--intro-whip", `${(0.45 * (intro.on?.scale || 1)).toFixed(2)}s`);
    void this.el.offsetWidth;
    this.el.classList.add("is-on");
    document.body.classList.add("to-intro-on");
  },
  close() {
    document.body.classList.remove("to-intro-on");
    if (game.camera && game.camera.zoom !== 1) { game.camera.zoom = 1; game.camera.updateProjectionMatrix(); }
    if (!this.el) return;
    this.el.classList.remove("is-on");
    this.el.dataset.shot = "";
    this.tagsEl.textContent = "";
    this._hideT = setTimeout(() => { if (!intro.on) this.el.hidden = true; }, 380);
  },
  title(kicker, head, sub) {
    const box = this.$(".to-intro-title");
    if (kicker == null) { box.classList.remove("is-on"); return; }
    this.$(".to-intro-kicker").textContent = kicker;
    this.$(".to-intro-head").textContent = head;
    this.$(".to-intro-sub").textContent = sub || "";
    box.classList.remove("is-on"); void box.offsetWidth; box.classList.add("is-on");
  },
  plate(kicker, name, sub, color) {
    const p = this.$(".to-intro-plate");
    if (kicker == null) { p.classList.remove("is-on"); return; }
    this.$(".to-intro-plate-kicker").textContent = kicker;
    this.$(".to-intro-plate-name").textContent = name;
    this.$(".to-intro-plate-sub").textContent = sub || "";
    p.style.setProperty("--intro-accent", color || "#fff");
    p.classList.remove("is-on"); void p.offsetWidth; p.classList.add("is-on");
  },
  cut(I, villain) {
    this.el.classList.remove("is-cut"); void this.el.offsetWidth; this.el.classList.add("is-cut");
    this.clearTags(I);
    game.audio?.introTick?.(villain);
  },
  clearTags(I) { this.tagsEl.textContent = ""; I.tags.clear(); },
  /* A bracketed callout beside whoever the roll call is on. */
  tags(I, camera, shot) {
    if (shot !== "foe" && shot !== "us") { if (I.tags.size) this.clearTags(I); return; }
    const a = I.subject;
    if (!a) return;
    const S = I.spec, villain = shot === "foe";
    const lines = (CI.lines[S.sport] || CI.lines.hoops)[villain ? "foe" : "us"];
    const w = this.el.clientWidth, h = this.el.clientHeight;
    const fresh = S.actor(a.id) || a;
    _proj.set(fresh.x, (fresh.y || 0) + 1.95, fresh.z).project(camera);
    const onScreen = _proj.z < 1 && Math.abs(_proj.x) < 0.92 && Math.abs(_proj.y) < 0.9;
    const key = shot + ":" + a.id;
    let tag = I.tags.get(key);
    if (!tag) {
      if (!onScreen) return;
      tag = document.createElement("div");
      const self = a.id === S.us[0];
      tag.className = "to-intro-tag" + (villain ? " is-enemy" : "") + (self ? " is-self" : "");
      const name = document.createElement("strong");
      name.textContent = self ? `${a.name} (you)` : a.name;
      const line = document.createElement("span");
      line.textContent = lines[hash(a.id + S.id) % lines.length];
      tag.append(name, line);
      this.tagsEl.appendChild(tag);
      I.tags.set(key, tag);
    }
    tag.style.visibility = onScreen ? "" : "hidden";
    if (onScreen) tag.style.transform = `translate(${((_proj.x + 1) / 2) * w + Math.min(90, w * 0.08)}px, ${((1 - _proj.y) / 2) * h}px)`;
  },
};

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollCourtIntro = { CI, intro, stop: stopCourtIntro, state: () => intro.on && { id: intro.on.spec.id, sport: intro.on.spec.sport, shot: intro.on.shot, t: +((roomNow() - intro.on.spec.at) / 1000).toFixed(2), total: intro.on.total, bodyOn: document.body.classList.contains("to-intro-on") } };
}
