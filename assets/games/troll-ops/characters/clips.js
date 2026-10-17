/* Animation clips made in Roblox Studio (tools/troll-ops-roblox-anim.mjs
   writes them to characters/clips/<name>.json from the TF_Rig there).

   A clip holds, per game joint (rig.parts names), a local quaternion per
   keyframe and, for joints that slide (hips, shoulders), an offset from the
   rest position. Roblox and three.js share axes, so a pose IS the joint's
   turn. A gait clip runs one stride cycle: u 0 is the left foot landing
   ahead, u 0.5 the right one, the same phase _poseHumanoid's legs use.

   The legs are never played from a clip: they stay on the gait's foot
   placement IK so the feet plant on the real ground (user, 2026-10-17).
   A clip drives the body above them, eased in over the procedural pose. */
import * as THREE from "three";

const EASE = [
  (t) => t,                                        // Linear (any direction)
  (t) => t, (t) => t,
  () => 0, () => 0, () => 0,                       // Constant: hold until the next key
  (t) => t * t * t,                                // Cubic In
  (t) => 1 - Math.pow(1 - t, 3),                   // Cubic Out
  (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), // Cubic InOut
];

export function prepareClip(json) {
  const joints = {};
  for (const [name, j] of Object.entries(json.joints)) {
    joints[name] = { q: Float32Array.from(j.q), p: j.p ? Float32Array.from(j.p) : null, ease: j.ease || null };
  }
  return { ...json, joints, times: Float32Array.from(json.times) };
}

const cache = new Map();
/* Fetch a clip by name (characters/clips/<name>.json); one request per name. */
export function loadClip(name) {
  if (!cache.has(name)) {
    const url = new URL(`./clips/${name}.json`, import.meta.url);
    cache.set(name, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`clip ${name}: ${r.status}`);
      return r.json();
    }).then(prepareClip));
  }
  return cache.get(name);
}

const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
/* The clip at time t (seconds; a looping clip wraps): fills out[name] with
   { q: Quaternion, p: Vector3 | null } for every joint it drives. */
export function sampleClip(clip, t, out = {}) {
  const T = clip.times, n = T.length, len = clip.length || T[n - 1];
  if (clip.loop && len > 0) t = ((t % len) + len) % len;
  t = Math.max(T[0], Math.min(T[n - 1], t));
  let i = 0;
  while (i < n - 2 && T[i + 1] <= t) i++;
  const span = T[i + 1] - T[i];
  const raw = span > 0 ? (t - T[i]) / span : 0;
  for (const name in clip.joints) {
    const j = clip.joints[name];
    const k = (EASE[j.ease ? j.ease[i] : 0] || EASE[0])(raw);
    const o = out[name] || (out[name] = { q: new THREE.Quaternion(), p: null });
    _qa.fromArray(j.q, i * 4);
    _qb.fromArray(j.q, (i + 1) * 4);
    o.q.slerpQuaternions(_qa, _qb, k);
    if (j.p) {
      o.p = o.p || new THREE.Vector3();
      o.p.set(
        j.p[i * 3] + (j.p[i * 3 + 3] - j.p[i * 3]) * k,
        j.p[i * 3 + 1] + (j.p[i * 3 + 4] - j.p[i * 3 + 1]) * k,
        j.p[i * 3 + 2] + (j.p[i * 3 + 5] - j.p[i * 3 + 2]) * k,
      );
    }
  }
  return out;
}

/* A gait clip at stride phase u (0..1). */
export function sampleGait(clip, u, out) {
  return sampleClip(clip, (((u % 1) + 1) % 1) * clip.length, out);
}

/* Blend the joints in `names` from wherever the procedural pose put them
   toward the sample, by w (0..1). A slide (the shoulders' roll) adds on top
   of where the pose put the joint, so a body that moved its sockets (the
   blocky body's broad shoulders) keeps them. Hip slides are skipped: their
   height stays the gait's, which the planted feet hold up. */
export function applyClip(rig, sample, w, names) {
  if (!(w > 0)) return;
  const p = rig.parts;
  for (const name of names) {
    const s = sample[name], o = p[name];
    if (!s || !o) continue;
    o.quaternion.slerp(s.q, w);
    if (s.p && name !== "hips") o.position.addScaledVector(s.p, w * (rig.scale || 1));
  }
}

/* What a clip may drive, by body region (legs never: see the top). */
export const CLIP_HIPS = ["hips"];
export const CLIP_SPINE = ["torso", "spine", "chest"];
export const CLIP_ARM_L = ["shoulderL", "armL", "elbowL", "wristL"];
export const CLIP_ARM_R = ["shoulderR", "armR", "elbowR", "wristR"];

/* Give a rig its gait clips: { sprint, "sprint-gun" } (prepared clips). */
export function setRigClips(rig, clips) {
  rig.clips = clips;
}

/* The game's clips, filled as they load; every rig buildHumanoid makes
   shares this one object, so a rig built before they land picks them up.
   ?clips=0 in the page's address leaves them out (to compare). */
export const GAME_CLIPS = {};
const OFF = typeof location !== "undefined" && new URLSearchParams(location.search).get("clips") === "0";
if (!OFF && typeof fetch !== "undefined") {
  for (const name of ["sprint", "sprint-gun"]) {
    loadClip(name).then((c) => { GAME_CLIPS[name] = c; }, (e) => console.warn(e.message));
  }
}
