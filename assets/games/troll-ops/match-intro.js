// Troll Forces — match intro cinematic (Team Deathmatch, Search & Destroy).
//
// Runs inside the pre-match staging countdown, when everyone is already
// standing frozen on their spawn. Five shots, letterboxed:
//
//   title  — a high establishing drift over the gap between the two spawns,
//            mode and map stamped across it.
//   enemy  — a crane down onto the enemy line from the front, Dutch-tilted,
//            graded red. Each troll gets a callout as the camera passes,
//            and they're all busy being rude (middle fingers, point & laugh).
//   whip   — a whip pan out of the enemy shot with a VS slam on the cut.
//   squad  — a low-angle hero dolly along your own team, graded warm, all of
//            them dabbing and flossing like they've already won.
//   hero   — the camera swings round your own body and pushes into your
//            eyes, so the cut back to first person is a single move.
//
// Search & Destroy's later rounds only have a 3 s countdown: they get the
// short cut (squad + hero). Everything is laid out in fractions of a nominal
// timeline and squeezed to fit whatever time is left on the clock, so a
// client that joins late or sits on the loading screen still lands on GO.
//
// game.js owns the cast (who stands where, how to pose them) and the camera
// hand-back; this file owns the timeline, the camera moves and the overlay.

import * as THREE from "three";

const FULL = [
  { id: "title", d: 0.9 },
  { id: "enemy", d: 2.8 },
  { id: "whip", d: 0.5 },
  { id: "squad", d: 2.8 },
  { id: "hero", d: 1.4 },
];
const SHORT = [
  { id: "squad", d: 1.25 },
  { id: "hero", d: 0.95 },
];
export const INTRO_FULL_SECONDS = FULL.reduce((s, x) => s + x.d, 0);

const ENEMY_POSES = ["bird", "laugh", "loser", "headbang", "bird", "facepalm"];
const SQUAD_POSES = ["dab", "floss", "groove", "wave", "dab", "headbang"];

const ENEMY_LINES = [
  "Certified camper", "Hasn't touched grass", "Spawn-trap enjoyer", "Reloads after every shot",
  "Main character syndrome", "Ping: questionable", "Paper hands", "Thinks crouching is a plan",
  "Rage-quits at 0–3", "Aims with their feet", "Lagging on purpose", "Peaked in 2011",
];
const SQUAD_LINES = [
  "Will steal your kills", "Probably carrying", "Lives for the dab", "Bought the dip",
  "Here for the emotes", "Doesn't miss (allegedly)", "Revives nobody", "Trust the process",
  "Built different", "Never reloads", "Big grin energy", "Problem? None.",
];

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));

const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _roll = new THREE.Quaternion();
const _proj = new THREE.Vector3();
const _fwd = new THREE.Vector3(0, 0, -1);

/* A group of actors standing together: where they are, which way they face,
   and how wide the line is, measured across that facing. */
function frameGroup(actors, faceToward) {
  const c = new THREE.Vector3();
  for (const a of actors) c.add(a.pos);
  c.multiplyScalar(1 / actors.length);
  const f = new THREE.Vector3(faceToward.x - c.x, 0, faceToward.z - c.z);
  if (f.lengthSq() < 1e-4) f.set(0, 0, -1);
  f.normalize();
  const r = new THREE.Vector3(-f.z, 0, f.x);   // to the line's left, seen from the front
  let s0 = Infinity, s1 = -Infinity, front = -Infinity;
  for (const a of actors) {
    _v.subVectors(a.pos, c);
    const s = _v.dot(r);
    a.lane = s;
    s0 = Math.min(s0, s); s1 = Math.max(s1, s);
    front = Math.max(front, _v.dot(f));
  }
  return { c, f, r, s0, s1, front, ground: c.y, actors: [...actors].sort((a, b) => a.lane - b.lane) };
}

export class MatchIntro {
  /* camera: the world camera. host: the HUD element the overlay lives in.
     raycast(origin, dir, len) -> distance to the first wall (or len). */
  constructor({ camera, host, raycast, audio }) {
    this.camera = camera;
    this.raycast = raycast;
    this.audio = audio;
    this.active = false;
    this.selfVisible = true;
    this.el = document.createElement("div");
    this.el.className = "to-intro";
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="to-intro-grade" aria-hidden="true"></div>
      <div class="to-intro-streaks" aria-hidden="true"></div>
      <div class="to-intro-bar to-intro-bar-t" aria-hidden="true"></div>
      <div class="to-intro-bar to-intro-bar-b" aria-hidden="true"></div>
      <div class="to-intro-tags" aria-hidden="true"></div>
      <div class="to-intro-title" aria-hidden="true">
        <p class="to-intro-kicker"></p>
        <h2 class="to-intro-head"></h2>
        <p class="to-intro-sub"></p>
      </div>
      <div class="to-intro-plate" aria-hidden="true">
        <span class="to-intro-plate-kicker"></span>
        <strong class="to-intro-plate-name"></strong>
        <span class="to-intro-plate-sub"></span>
      </div>
      <div class="to-intro-vs" aria-hidden="true">VS</div>
      <div class="to-intro-flash" aria-hidden="true"></div>
      <p class="to-intro-clock" aria-live="off"></p>
      <button type="button" class="to-intro-skip" aria-label="Skip the match intro">Skip <kbd>Space</kbd></button>`;
    host.appendChild(this.el);
    this.$ = (sel) => this.el.querySelector(sel);
    this.tagsEl = this.$(".to-intro-tags");
    this.clockEl = this.$(".to-intro-clock");
    this.$(".to-intro-skip").addEventListener("click", (e) => { e.stopPropagation(); this.skip(); });
    this.onEnd = null;
    this.camPos = new THREE.Vector3();
    this.pull = 0;
  }

  /* opts:
       length     — wall seconds available
       short      — the 2-shot round version
       modeName, mapName, roleMine, roleEnemy (S&D: Attacking / Defending)
       mine, enemy — { name, ui } of each team
       cast()     — { mine: [actor], enemy: [actor] }, read fresh per shot
                    (bots still streaming in on a guest at t = 0).
                    actor: { id, name, pos: Vector3 (feet), pose(name|null) }
       self()     — { feet: Vector3, eye: Vector3, yaw, pitch, name } */
  start(opts) {
    this.opts = opts;
    this.plan = opts.short ? SHORT : FULL;
    const nominal = this.plan.reduce((s, x) => s + x.d, 0);
    this.scale = opts.length / nominal;
    this.total = opts.length;
    this.el.style.setProperty("--intro-whip", `${(0.5 * this.scale).toFixed(2)}s`);
    this.t = 0;
    this.shotIdx = -1;
    this.shot = null;
    this.active = true;
    this.selfVisible = true;
    this.posed = new Set();
    this.squadRoll = this.enemyRoll = this.subject = null;
    this.tags = new Map();
    this.tagsEl.textContent = "";
    this.el.hidden = false;
    this.el.className = "to-intro";
    void this.el.offsetWidth;
    this.el.classList.add("is-on");
    if (opts.short) this.el.classList.add("is-short");
    this.$(".to-intro-skip").hidden = false;
    this.audio?.introRiser?.(opts.length);
  }

  skip() {
    if (!this.active) return;
    this.stop();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.selfVisible = true;
    for (const a of this.posed) a.pose(null);
    this.posed.clear();
    this.el.classList.remove("is-on");
    this.el.dataset.shot = "";
    this.tagsEl.textContent = "";
    this.tags.clear();
    // Let the bars slide off before the overlay goes.
    clearTimeout(this._hideT);
    this._hideT = setTimeout(() => { if (!this.active) this.el.hidden = true; }, 380);
    this.onEnd?.();
  }

  /* Seconds left on the staging clock, for the corner readout. */
  setClock(left) {
    const whole = Math.max(0, Math.ceil(left));
    if (whole !== this._clockShown) {
      this._clockShown = whole;
      this.clockEl.textContent = whole > 0 ? `Live in ${whole}` : "";
    }
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    if (this.t >= this.total) {
      this.placeHero(1);
      this.stop();
      return;
    }
    // Which shot, and how far through it.
    let acc = 0, idx = this.plan.length - 1, k = 1;
    for (let i = 0; i < this.plan.length; i++) {
      const d = this.plan[i].d * this.scale;
      if (this.t < acc + d) { idx = i; k = (this.t - acc) / d; break; }
      acc += d;
    }
    if (idx !== this.shotIdx) this.enterShot(idx);
    const id = this.plan[idx].id;
    if (id === "title") this.placeTitle(k);
    else if (id === "enemy") this.placeRoll(this.enemyRoll, k);
    else if (id === "whip") this.placeWhip(k);
    else if (id === "squad") this.placeRoll(this.squadRoll, k);
    else this.placeHero(k);
    this.updateTags(id);
    if (id === "hero" && k > 0.86) this.el.classList.add("is-opening");
  }

  /* ---------------- shots ---------------- */

  enterShot(idx) {
    this.shotIdx = idx;
    const id = this.plan[idx].id;
    this.el.dataset.shot = id;
    this.el.classList.remove("is-cut");
    const o = this.opts;
    const cast = o.cast();
    const self = o.self();
    const centre = o.centre || new THREE.Vector3();
    const mine = [{ id: "self", name: self.name, pos: self.feet.clone(), pose: () => {}, self: true }, ...cast.mine];
    const towardEnemy = cast.enemy.length ? frameGroup(cast.enemy, centre).c : centre;

    // Re-read at every shot: a guest's bots can still be streaming in at t = 0.
    this.squadG = frameGroup(mine, towardEnemy);
    this.enemyG = cast.enemy.length ? frameGroup(cast.enemy, this.squadG.c) : null;
    // Teammates only (you get the hero shot); alone, the squad shot is you.
    const mates = this.squadG.actors.filter((a) => !a.self);
    if (!this.squadRoll || id === "squad") this.squadRoll = this.rollCall(mates.length ? mates : this.squadG.actors.filter((a) => a.self), false);

    if (id === "title") {
      this.setTitle(o.modeName, o.mapName, o.short ? "" : `${o.mine.name} vs ${o.enemy.name}`);
      this.setPlate(null);
    } else if (id === "enemy") {
      this.setTitle(null);
      if (!this.enemyG) { this.t += this.plan[idx].d * this.scale; return; }   // nobody there: straight on
      this.enemyRoll = this.rollCall(this.enemyG.actors, true);
      this.setPlate("Enemy team", o.enemy.name, this.plateSub(o.roleEnemy, this.enemyG.actors.length), "#ff4d3d");
      this.poseGroup(this.enemyG.actors, ENEMY_POSES);
      this.audio?.introHit?.();
    } else if (id === "whip") {
      this.setPlate(null);
      this.whipFrom = { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone() };
      this.placeRoll(this.squadRoll, 0);
      this.whipTo = { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone() };
      this.camera.position.copy(this.whipFrom.pos);
      this.camera.quaternion.copy(this.whipFrom.quat);
      this.audio?.introWhoosh?.();
      setTimeout(() => { if (this.active) this.audio?.introSlam?.(); }, 160 * this.scale);
    } else if (id === "squad") {
      this.setTitle(null);
      const n = this.squadG.actors.length;
      this.setPlate("Your squad", o.mine.name, n === 1 ? "Just you. Good luck." : this.plateSub(o.roleMine, n), o.mine.ui);
      this.poseGroup(mates, SQUAD_POSES);
      if (o.short) this.audio?.introHit?.();
    } else if (id === "hero") {
      this.setPlate("You", self.name, o.roleMine || o.mine.name, o.mine.ui);
      this.tagsEl.textContent = "";
      this.tags.clear();
      this.heroFrom = { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone() };
      this.$(".to-intro-skip").hidden = true;
    }
  }

  plateSub(role, n) {
    const head = `${n} troll${n === 1 ? "" : "s"}`;
    return role ? `${role} · ${head}` : head;
  }

  poseGroup(actors, poses) {
    for (const a of actors) {
      const name = poses[hash(a.id + ":" + (this.opts.seed || 0)) % poses.length];
      a.pose(name);
      this.posed.add(a);
    }
  }

  /* Wide, high and slow over the space between the two spawns. */
  placeTitle(k) {
    const a = this.squadG.c;
    const b = this.enemyG ? this.enemyG.c : this.squadG.c.clone().addScaledVector(this.squadG.f, 30);
    const mid = _v.addVectors(a, b).multiplyScalar(0.5);
    const span = Math.max(16, a.distanceTo(b));
    _dir.subVectors(b, a).setY(0).normalize();
    const side = _w.set(-_dir.z, 0, _dir.x);
    const ang = -0.35 + 0.3 * ease(k);
    const pos = new THREE.Vector3()
      .copy(mid)
      .addScaledVector(side, Math.cos(ang) * span * 0.55)
      .addScaledVector(_dir, Math.sin(ang) * span * 0.55);
    pos.y = mid.y + span * 0.38 + 6 - 2 * k;
    const look = mid.clone();
    look.y += 1;
    this.setCam(pos, look, 0, 2);
  }

  /* A team spawns spread along its whole side of the map, not in a line, so
     each team shot is a roll call: a quick cut to every troll in turn (left
     to right as the team faces), each framed from whichever side has a
     clear view of them. Enemies are shot from slightly above with a Dutch
     tilt that flips every cut; your squad from down low, looking up. */
  rollCall(actors, villain) {
    const MAX = this.opts.short ? 2 : 5;
    const list = actors.slice(0, MAX).map((a, i) => {
      const facing = a.yaw ?? 0;
      const head = a.pos.clone();
      head.y += 1.35;
      const want = villain ? 3.6 : 3.0;
      let best = { ang: facing, free: -1 };
      for (const off of [0, 0.55, -0.55, 1.1, -1.1, 1.8, -1.8, Math.PI]) {
        const ang = facing + off;
        _dir.set(-Math.sin(ang), villain ? 0.22 : -0.17, -Math.cos(ang)).normalize();
        const free = this.raycast ? this.raycast(head, _dir, want) : want;
        if (free > best.free + 0.4) best = { ang, free };
        if (free >= want - 0.05) break;
      }
      return { actor: a, ang: best.ang, roll: villain ? (i % 2 ? -0.12 : 0.12) : 0 };
    });
    return { villain, list, seg: -1 };
  }

  placeRoll(roll, k) {
    if (!roll || !roll.list.length) return;
    const n = roll.list.length;
    const seg = Math.min(n - 1, Math.floor(k * n));
    const u = clamp01(k * n - seg);
    if (seg !== roll.seg) {
      roll.seg = seg;
      this.subject = roll.list[seg].actor;
      if (k > 0) this.cut();
    }
    const { actor, ang, roll: tilt } = roll.list[seg];
    const v = roll.villain;
    const a = ang + (v ? -0.18 : 0.22) * (u - 0.5);       // a slow arc across each cut
    const dist = v ? 3.5 - 0.8 * easeOut(u) : 3.0 - 0.6 * easeOut(u);
    const pos = new THREE.Vector3(actor.pos.x - Math.sin(a) * dist, actor.pos.y + (v ? 2.15 : 0.85), actor.pos.z - Math.cos(a) * dist);
    const look = new THREE.Vector3(actor.pos.x, actor.pos.y + (v ? 1.3 : 1.5), actor.pos.z);
    this.setCam(pos, look, tilt * (1 - 0.3 * u), 0.7);
  }

  /* A hard cut between two trolls: a white blink and a tick. */
  cut() {
    this.el.classList.remove("is-cut");
    void this.el.offsetWidth;
    this.el.classList.add("is-cut");
    this.tagsEl.textContent = "";
    this.tags.clear();
    this.audio?.introTick?.(this.shotIdx >= 0 && this.plan[this.shotIdx].id === "enemy");
  }

  /* Out of the enemy shot on a hard pan, cut under the flash, and settle
     into the squad shot out of the same pan. */
  placeWhip(k) {
    const PAN = 1.25;
    if (k < 0.5) {
      const u = easeIn(k * 2);
      this.camera.position.copy(this.whipFrom.pos);
      _q.setFromAxisAngle(_up, -PAN * u);
      this.camera.quaternion.copy(_q).multiply(this.whipFrom.quat);
    } else {
      const u = 1 - easeOut((k - 0.5) * 2);
      this.camera.position.copy(this.whipTo.pos);
      _q.setFromAxisAngle(_up, PAN * u);
      this.camera.quaternion.copy(_q).multiply(this.whipTo.quat);
    }
  }

  /* Round your own body from the front, then into your head. */
  placeHero(k) {
    const self = this.opts.self();
    const fwd = _dir.set(-Math.sin(self.yaw), 0, -Math.cos(self.yaw));
    const orbit = ease(clamp01(k / 0.72));
    const ang = Math.PI * (1 - orbit);                  // π = in front, 0 = behind
    const r = 2.7 - 1.3 * orbit;
    const pos = new THREE.Vector3().copy(self.feet);
    // Rotate the forward vector by `ang` about the vertical.
    const c = Math.cos(ang), s = Math.sin(ang);
    pos.x -= (fwd.x * c - fwd.z * s) * r;
    pos.z -= (fwd.x * s + fwd.z * c) * r;
    // Ends over the right shoulder rather than dead behind the head, which
    // at this range is a wall of trollface.
    pos.x += -fwd.z * 0.75 * orbit;
    pos.z += fwd.x * 0.75 * orbit;
    pos.y = self.feet.y + 1.45 + 0.35 * (1 - orbit);
    const look = new THREE.Vector3().copy(self.feet);
    look.y += 1.45;
    look.addScaledVector(fwd, 2 * orbit);
    this.setCam(pos, look, 0, 0.35);
    // Ease in from wherever the last shot left the camera.
    const inK = ease(clamp01(k / 0.25));
    if (this.heroFrom && inK < 1) {
      this.camera.position.lerpVectors(this.heroFrom.pos, this.camera.position, inK);
      this.camera.quaternion.slerpQuaternions(this.heroFrom.quat, this.camera.quaternion, inK);
    }
    // The last stretch: into the eyes and onto the aim.
    const push = ease(clamp01((k - 0.62) / 0.38));
    if (push > 0) {
      _q2.setFromEuler(new THREE.Euler(self.pitch, self.yaw, 0, "YXZ"));
      this.camera.position.lerp(self.eye, push);
      this.camera.quaternion.slerp(_q2, push);
    }
    this.selfVisible = push < 0.3;
  }

  /* Camera at `pos` looking at `look`, rolled, and pulled in off any wall
     between the subject and the lens (smoothed, so a lamp post sliding
     past doesn't make the shot jump). */
  setCam(pos, look, roll, minDist) {
    _dir.subVectors(pos, look);
    const want = _dir.length();
    _dir.normalize();
    const free = this.raycast ? this.raycast(look, _dir, want) : want;
    const len = Math.max(minDist, Math.min(want, free - 0.25));
    this.camera.position.copy(look).addScaledVector(_dir, len);
    _m.lookAt(this.camera.position, look, _up);
    this.camera.quaternion.setFromRotationMatrix(_m);
    if (roll) this.camera.quaternion.multiply(_roll.setFromAxisAngle(_fwd, roll));
  }

  /* ---------------- overlay ---------------- */

  setTitle(kicker, head, sub) {
    const box = this.$(".to-intro-title");
    if (kicker == null) { box.classList.remove("is-on"); return; }
    this.$(".to-intro-kicker").textContent = kicker;
    this.$(".to-intro-head").textContent = head;
    this.$(".to-intro-sub").textContent = sub || "";
    box.classList.remove("is-on");
    void box.offsetWidth;
    box.classList.add("is-on");
  }

  setPlate(kicker, name, sub, color) {
    const p = this.$(".to-intro-plate");
    if (kicker == null) { p.classList.remove("is-on"); return; }
    this.$(".to-intro-plate-kicker").textContent = kicker;
    this.$(".to-intro-plate-name").textContent = name;
    this.$(".to-intro-plate-sub").textContent = sub || "";
    p.style.setProperty("--intro-accent", color || "#fff");
    p.classList.remove("is-on");
    void p.offsetWidth;
    p.classList.add("is-on");
  }

  /* A bracketed callout pinned beside whoever the roll call is on. */
  updateTags(shot) {
    if (shot !== "enemy" && shot !== "squad") {
      if (this.tags.size) { this.tagsEl.textContent = ""; this.tags.clear(); }
      return;
    }
    const villain = shot === "enemy";
    const lines = villain ? ENEMY_LINES : SQUAD_LINES;
    const w = this.el.clientWidth, h = this.el.clientHeight;
    for (const a of this.subject ? [this.subject] : []) {
      const key = shot + ":" + a.id;
      _proj.copy(a.pos);
      _proj.y += 1.95;
      _proj.project(this.camera);
      const onScreen = _proj.z < 1 && Math.abs(_proj.x) < 0.92 && Math.abs(_proj.y) < 0.9;
      let tag = this.tags.get(key);
      if (!tag) {
        if (!onScreen) continue;
        tag = document.createElement("div");
        tag.className = "to-intro-tag" + (villain ? " is-enemy" : "") + (a.self ? " is-self" : "");
        const name = document.createElement("strong");
        name.textContent = a.self ? `${a.name} (you)` : a.name;
        const line = document.createElement("span");
        line.textContent = lines[hash(a.id + shot) % lines.length];
        tag.append(name, line);
        this.tagsEl.appendChild(tag);
        this.tags.set(key, tag);
      }
      tag.style.visibility = onScreen ? "" : "hidden";
      // Off to the side of the head, so the face stays clear.
      if (onScreen) tag.style.transform = `translate(${((_proj.x + 1) / 2) * w + Math.min(90, w * 0.08)}px, ${((1 - _proj.y) / 2) * h}px)`;
    }
  }
}
