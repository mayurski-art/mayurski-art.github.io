// Troll Royale — squads go out of the C-130 together (docs/ROYALE-EXIT.md,
// phase 3): in Duos, Trios and Squads your team lines up in a file at the
// ramp, one behind the other, the front of the file nearest the door, each
// one's right hand holding the right hand of the one in front. They back
// up together, crouch together, and dash at the green, letting go at the
// lip a beat apart.
//
// Nothing new on the wire: every client works the file out from the seats
// (royale-squads.js squadSeats sits a squad side by side in one plane) and
// the shared drop clock. Humans walk themselves there (royale-cine.js);
// the bots of a human's squad are drawn walking it by every client
// (royale.js busPlacers), and the bot host sends them out on its beat.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { reachHand } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";

export const FILE = {
  front: 5.7,        // plane-local z of the front of the file (royale-crew.js RAMP_SPOT)
  gap: 0.9,          // m between one and the next
  x: 0,              // down the middle of the hold
  grip: [-9.7, -9.1],     // hands taken once the file's formed
  release: [0.15, 0.4],   // let go as the front goes off the lip
  dash: 7,           // m/s (royale.js DASH_SPEED)
  lip: 6.25,         // where the floor ends once the ramp's slid in (royale-hold.js HOLD.hinge)
};

const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

/* The file in plane `plane` for team `team`: [{ id, slot }], front first
   (by seat: the squad's humans sat first, its bots after). `me` { id, slot,
   team } is this client; everyone else comes off the remotes (on the bot
   host its bots ride them too), `slotOf(rp)` their seat while aboard. A
   lone member makes no file. */
export function fileRoster(plane, team, me, slotOf, perPlane) {
  const out = [];
  const inPlane = (slot) => slot > 0 && Math.floor((slot - 1) / perPlane) === plane;
  if (!team) return out;
  if (me && me.team === team && inPlane(me.slot)) out.push({ id: me.id, slot: me.slot, me: true });
  for (const rp of game.remotes.byId.values()) {
    if (rp.team !== team || rp.netId === me?.id) continue;
    const slot = slotOf(rp);
    if (inPlane(slot)) out.push({ id: rp.netId, slot, bot: !!game.isBotPeer?.(rp.peer) });
  }
  out.sort((a, b) => a.slot - b.slot || (a.id < b.id ? -1 : 1));
  return out.length > 1 ? out : [];
}

/* Where the k-th of the file stands (plane-local), before the run-up. */
export const fileSpot = (k) => ({ x: FILE.x, z: FILE.front - FILE.gap * k });

/* When the k-th goes off the lip (drop clock): the dash from the run-up
   spot to the floor's end, and a beat to drop. The bot host sends a file
   bot out then (royale.js placeBotsInLobby). */
export const fileOutAt = (k, backBy) => (FILE.lip - (FILE.front - FILE.gap * k - backBy)) / FILE.dash + 0.25;

/* How hard the hands hold, 0 .. 1, at drop clock `t`. */
export const fileGrip = (t) => smooth(FILE.grip[0], FILE.grip[1], t) * (1 - smooth(FILE.release[0], FILE.release[1], t));

/* A bot of the file, drawn walking it (every client the same, off the
   drop clock): from its seat `seat` {x, z} down its side's aisle to its
   spot, the run-up and the crouch with you, then the dash. `C` is the
   cinematic's beats (royale-cine.js CINE). Returns the plane-local spot,
   its facing and its gait, or null outside the file's time. */
const _w = { x: 0, z: 0, yaw: 0, moving: false, mps: 0, forward: 1, lower: 0 };
export function botFilePlace(k, seat, t, C) {
  if (t < C.walkFrom || t > fileOutAt(k, C.backBy) + 0.5) return null;
  const spot = fileSpot(k), side = Math.sign(seat.x) || 1;
  const pts = [{ x: seat.x, z: seat.z }, { x: side * 0.62, z: seat.z + 0.15 }, { x: side * 0.62, z: Math.min(4.6, spot.z - 0.3) }, spot];
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  const pace = Math.max(1.3, len / Math.max(0.5, C.walkBy - C.walkFrom));
  let d = Math.max(0, (t - C.walkFrom) * pace);
  _w.moving = d < len;
  _w.mps = _w.moving ? pace : 0;
  _w.forward = 1;
  _w.lower = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.z - a.z);
    if (d <= l || i === pts.length - 1) {
      const u = l ? Math.min(1, d / l) : 1;
      _w.x = a.x + (b.x - a.x) * u;
      _w.z = a.z + (b.z - a.z) * u;
      _w.yaw = _w.moving ? Math.atan2(-(b.x - a.x), -(b.z - a.z)) : Math.PI;   // there: facing out of the door
      break;
    }
    d -= l;
  }
  if (_w.moving) return _w;
  // The run-up: backwards up the ramp, facing out; then set; then the dash.
  _w.z -= C.backBy * smooth(C.backUp[0], C.backUp[1], t);
  if (t > C.backUp[0] && t < C.backUp[1]) { _w.moving = true; _w.mps = C.backBy / (C.backUp[1] - C.backUp[0]); _w.forward = -1; }
  if (t >= C.crouch[0] && t < 0) _w.lower = 1;
  if (t >= 0) { _w.z += FILE.dash * t; _w.moving = true; _w.mps = FILE.dash; }
  return _w;
}

/* The hands: each pair holds hands behind the one in front, on the
   file's line: his left hand back by his hip, the right hand of the one
   behind forward to it. So the front reaches back (left), the back of the
   file reaches forward (right), and the middle does both. `grip` 0 .. 1,
   `k` your place (0 the front), `n` how many. Chest space (forward -z). */
const _t = new THREE.Vector3();
const POLE_R = new THREE.Vector3(0.7, -1, 0.1), POLE_L = new THREE.Vector3(-0.7, -1, 0.2);
const _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
export function poseFileHands(rig, grip, k, n) {
  if (grip <= 0.01 || n < 2) return;
  const s = rig.scale || 1, p = rig.parts;
  rig.root.updateMatrixWorld(true);
  const hold = (side, x, y, z) => {
    const arm = side < 0 ? p.armL : p.armR, elbow = side < 0 ? p.elbowL : p.elbowR;
    _q0.copy(arm.quaternion); _q1.copy(elbow.quaternion);
    reachHand(rig, side, _t.set(x * s, y * s, z * s), side < 0 ? POLE_L : POLE_R);
    arm.quaternion.slerpQuaternions(_q0, _q2.copy(arm.quaternion), grip);
    elbow.quaternion.slerpQuaternions(_q1, _q2.copy(elbow.quaternion), grip);
  };
  if (k > 0) hold(1, -0.04, -0.48, -(FILE.gap - 0.44));   // forward to the one in front
  if (k < n - 1) hold(-1, -0.04, -0.5, 0.38);            // back to the one behind
  rig.body?.update?.();
}
