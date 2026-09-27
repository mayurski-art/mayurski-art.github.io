// Troll Forces — kill cam, Black Ops 2 style.
//
// BO2's killcam doesn't orbit your body: it replays the last few seconds
// before you died through the killer's own eyes — their gun in front of the
// camera, their tracers, you walking into it and going down — slowing
// right at the kill, then drops you back in.
//
// To do that without new netcode, every client keeps a short rolling
// history of what it already renders: each remote actor's pose (position,
// yaw, pitch, stance, alive, weapon) and our own, sampled ~30 Hz, plus every
// shot it drew. On death, KillCam plays that history back from the killer's
// seat. game.js poses the world from `sampleAt()` each frame (remote rigs,
// our own third-person rig, re-fired tracers) and renders the killer's gun
// as the viewmodel; this file owns the timeline and the camera.
//
// When there is no history for the killer (a scorestreak entity, a zombie,
// someone who joined a second ago), it falls back to a slow push-in on
// where you fell from the killer's side — held steady, never spinning.

import * as THREE from "three";

export const KILLCAM_PRE = 3.0;        // replay seconds before the killing shot
const KILLCAM_POST = 1.45;              // replay seconds after it: the whole fall
const SLOW_FROM = 0.2;                  // slow-mo starts this long before the kill
const SLOW_TO = 0.45;                   // …and ends this long after it
const SLOW = 0.4;                       // replay speed during slow-mo
const HISTORY = 6;                      // seconds kept per actor
const SAMPLE_DT = 1 / 30;
const EYE = 1.62;
const FALLBACK_TIME = 2.6;

/* Wall-clock length of a full replay (what the respawn timer has to cover). */
export const KILLCAM_DURATION = (KILLCAM_PRE - SLOW_FROM) + (SLOW_FROM + SLOW_TO) / SLOW + (KILLCAM_POST - SLOW_TO);

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

export class KillCam {
  constructor(camera) {
    this.camera = camera;
    this.active = false;
    this.mode = null;            // "replay" | "fallback"
    this.tracks = new Map();     // actor id -> [{ t, x, y, z, yaw, pitch, lower, alive, wid, moving }]
    this.shots = [];             // { t, id, ox.., dx.., wid, quiet }
    this.killerId = null;
    this.deathT = 0;
    this.rt = 0;                 // replay clock (recorder time)
    this.prevRt = 0;
    this.t = 0;                  // wall seconds since start
    this.deathPos = new THREE.Vector3();
    this.killerPos = new THREE.Vector3();
    this._s = {};
    this._euler = new THREE.Euler(0, 0, 0, "YXZ");
  }

  /* ---------------- recording ---------------- */

  /* One actor's rendered pose at recorder time `t` (seconds). Throttled to
     SAMPLE_DT per actor; old samples fall off the front. Not recorded while
     a replay is playing — that would be recording the replay. */
  record(t, id, s) {
    if (this.active) return;
    let tr = this.tracks.get(id);
    if (!tr) { tr = []; this.tracks.set(id, tr); }
    const last = tr[tr.length - 1];
    if (last && t - last.t < SAMPLE_DT) return;
    tr.push({ t, x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch || 0, lower: s.lower || 0,
      alive: s.alive !== false, wid: s.wid || null, moving: !!s.moving, bot: !!s.bot });
    while (tr.length && tr[0].t < t - HISTORY) tr.shift();
  }

  noteShot(t, id, origin, dir, wid, quiet = false) {
    if (this.active || !id) return;
    this.shots.push({ t, id, ox: origin.x, oy: origin.y, oz: origin.z, dx: dir.x, dy: dir.y, dz: dir.z, wid, quiet });
    while (this.shots.length && this.shots[0].t < t - HISTORY) this.shots.shift();
  }

  /* Drop everything (new match / map). */
  clear() {
    this.tracks.clear();
    this.shots.length = 0;
    this.cancel();
  }

  /* Interpolated pose of `id` at replay time `t`, or null. The returned
     object is reused per id-less call — copy what you keep. */
  sampleAt(id, t, out = this._s) {
    const tr = this.tracks.get(id);
    if (!tr || !tr.length) return null;
    if (t <= tr[0].t) return Object.assign(out, tr[0]);
    const last = tr[tr.length - 1];
    if (t >= last.t) return Object.assign(out, last);
    let i = tr.length - 2;
    while (i > 0 && tr[i].t > t) i--;
    const a = tr[i], b = tr[i + 1];
    const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
    out.t = t;
    out.x = a.x + (b.x - a.x) * k;
    out.y = a.y + (b.y - a.y) * k;
    out.z = a.z + (b.z - a.z) * k;
    out.yaw = lerpAngle(a.yaw, b.yaw, k);
    out.pitch = a.pitch + (b.pitch - a.pitch) * k;
    out.lower = a.lower + (b.lower - a.lower) * k;
    out.alive = k < 0.5 ? a.alive : b.alive;
    out.wid = b.wid;
    out.moving = b.moving;
    out.bot = b.bot;
    return out;
  }

  /* ---------------- playback ---------------- */

  /* `now` is the recorder time of the death. `selfId` is our own track. */
  start({ deathPos, killerId, killerPos, now, selfId }) {
    this.active = true;
    this.t = 0;
    this.deathPos.copy(deathPos);
    this.selfId = selfId;
    const tr = killerId && this.tracks.get(killerId);
    if (tr && tr.length > 6 && tr[tr.length - 1].t > now - 0.8) {
      this.mode = "replay";
      this.killerId = killerId;
      this.deathT = now;
      this.rt = this.prevRt = Math.max(tr[0].t, now - KILLCAM_PRE);
      this.duration = (now - SLOW_FROM - this.rt) + (SLOW_FROM + SLOW_TO) / SLOW + (KILLCAM_POST - SLOW_TO);
      this.killerWeapon = this.sampleAt(killerId, now)?.wid || null;
      return;
    }
    this.mode = "fallback";
    this.killerId = null;
    this.duration = FALLBACK_TIME;
    if (killerPos) this.killerPos.copy(killerPos);
    else this.killerPos.set(deathPos.x + 4, deathPos.y + 1.5, deathPos.z + 4);
  }

  get replaying() { return this.active && this.mode === "replay"; }
  get done() { return this.t >= (this.duration || 0); }
  /* 0..1 through the slow-mo tail, for the HUD's "the kill" beat. */
  get atKill() { return this.replaying && this.rt >= this.deathT - 0.05; }

  /* Advance and drive the camera. Returns true while it owns the camera. */
  update(dt) {
    if (!this.active) return false;
    this.t += dt;
    if (this.mode === "replay") {
      this.prevRt = this.rt;
      // Real time, slow-mo through the shot and the start of the fall, then
      // real time again so the body hits the ground with its full weight.
      const since = this.rt - this.deathT;
      const speed = since < -SLOW_FROM || since > SLOW_TO ? 1 : SLOW;
      this.rt += dt * speed;
      if (this.rt >= this.deathT + KILLCAM_POST) { this.cancel(); return false; }
      this.poseKillerCamera();
      return true;
    }
    if (this.done) { this.cancel(); return false; }
    this.poseFallbackCamera();
    return true;
  }

  /* Through the killer's eyes. Bots don't send a pitch (and their yaw
     leads their body), so for a bot the view is steered onto where we were
     standing while we're roughly in front of it — the shot reads as the bot
     tracking you, the way a player's killcam would. */
  poseKillerCamera() {
    const k = this.sampleAt(this.killerId, this.rt, this._k || (this._k = {}));
    if (!k) return;
    const eyeY = k.y + EYE - k.lower * 0.7;
    this.camera.position.set(k.x, eyeY, k.z);
    let yaw = k.yaw, pitch = k.pitch;
    const me = this.selfId && this.sampleAt(this.selfId, Math.min(this.rt, this.deathT), this._m || (this._m = {}));
    if (me) {
      const dx = me.x - k.x, dz = me.z - k.z;
      const toMe = Math.atan2(-dx, -dz);
      let d = toMe - yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const flat = Math.hypot(dx, dz);
      const toPitch = Math.atan2((me.y + 1.25 - me.lower * 0.5) - eyeY, Math.max(0.5, flat));
      if (k.bot) {
        // Steer fully when we're within ~50° of where it faces, fade out wider.
        const w = Math.max(0, Math.min(1, (0.9 - Math.abs(d)) / 0.35));
        yaw += d * w;
        pitch = toPitch * w;
      }
    }
    this._euler.set(pitch, yaw, 0);
    this.camera.quaternion.setFromEuler(this._euler);
  }

  /* No history: from the killer's side, a slow steady push toward where
     we fell. */
  poseFallbackCamera() {
    const k = Math.min(1, this.t / FALLBACK_TIME);
    const e = 1 - Math.pow(1 - k, 2);
    const from = this.killerPos;
    const to = this.deathPos;
    const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
    const dist = Math.max(2, dir.length());
    dir.normalize();
    const start = Math.min(dist, 7), end = Math.max(2.2, start - 2.5);
    const back = start + (end - start) * e;
    this.camera.position.set(to.x - dir.x * back, to.y + 1.9, to.z - dir.z * back);
    this.camera.lookAt(to.x, to.y + 0.9, to.z);
  }

  /* Shots fired in (prevRt, rt] of the replay, for re-drawing. */
  shotsSince(out = []) {
    out.length = 0;
    if (!this.replaying) return out;
    for (const s of this.shots) if (s.t > this.prevRt && s.t <= this.rt) out.push(s);
    return out;
  }

  cancel() {
    this.active = false;
    this.mode = null;
    this.t = this.duration || 0;
  }
}
