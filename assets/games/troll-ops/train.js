// Troll Forces — the Grin Express runs (user, 2026-10-07: "being able to
// ride the train and that the train actually takes you somewhere in real
// time"; a loop round town, Socialize only).
//
// The track is a loop: the north straight past the station, an arc round
// the west end of town, a straight across the south plain, an arc back. The
// train keeps a timetable off the wall clock (a stop at the station, ease
// out, run the loop, ease in), so every client puts it in the same place
// with nothing on the wire. Each car is its own group; its colliders are
// plain boxes the map pushed, rewritten in place every frame from the car's
// footprint (approximate on the curves, exact on the straights). In any
// other mode it stays parked at the station.
//
// Riding is modes/social-train.js: it asks `carAt()` which car deck you're
// on and carries you with it.

export const TRAIN = {
  speed: 8,     // m/s on the run
  ease: 6,      // s to get up to speed, and to stop
  stop: 25,     // s at the station
};

/* The loop: straights at z0 (north, run westward) and z1 (south, eastward)
   between x0 and x1, joined by half circles. `at(s)` is the point and the
   way along it at distance `s` from (x1, z0). */
export class LoopPath {
  constructor({ x0, x1, z0, z1 }) {
    Object.assign(this, { x0, x1, z0, z1 });
    this.r = (z1 - z0) / 2;
    this.zc = (z0 + z1) / 2;
    this.ls = x1 - x0;
    this.la = Math.PI * this.r;
    this.length = 2 * (this.ls + this.la);
  }

  at(s, out = { x: 0, z: 0, dx: 0, dz: 0 }) {
    const { x0, x1, z0, z1, r, zc, ls, la } = this;
    s = ((s % this.length) + this.length) % this.length;
    if (s < ls) return Object.assign(out, { x: x1 - s, z: z0, dx: -1, dz: 0 });
    s -= ls;
    if (s < la) {
      const th = -Math.PI / 2 - s / r;
      return Object.assign(out, { x: x0 + r * Math.cos(th), z: zc + r * Math.sin(th), dx: Math.sin(th), dz: -Math.cos(th) });
    }
    s -= la;
    if (s < ls) return Object.assign(out, { x: x0 + s, z: z1, dx: 1, dz: 0 });
    s -= ls;
    const th = Math.PI / 2 - s / r;
    return Object.assign(out, { x: x1 + r * Math.cos(th), z: zc + r * Math.sin(th), dx: Math.sin(th), dz: -Math.cos(th) });
  }
}

/* Where the train is `t` seconds into the day: how far past the station
   (0 = standing at it), its speed, and how long till it leaves. */
export function timetable(t, length, { speed, ease, stop } = TRAIN) {
  const a = speed / ease;
  const cruise = (length - speed * ease) / speed;
  const period = stop + 2 * ease + cruise;
  const u = ((t % period) + period) % period;
  if (u < stop) return { s: 0, v: 0, leaveIn: stop - u, arriveIn: 0, period };
  const m = u - stop, moveT = 2 * ease + cruise;
  let s, v;
  if (m < ease) { s = 0.5 * a * m * m; v = a * m; }
  else if (m < moveT - ease) { s = speed * ease / 2 + speed * (m - ease); v = speed; }
  else { const r = moveT - m; s = length - 0.5 * a * r * r; v = a * r; }
  return { s, v, leaveIn: period - u + stop, arriveIn: period - u, period };
}

const _p = { x: 0, z: 0, dx: 0, dz: 0 }, _q = { x: 0, z: 0, dx: 0, dz: 0 };

/* The consist on the loop. `cars`: [{ group, boxes: [{ c, x, z, w, d, y,
   h }] (local), len, back (from the head car's centre to this one's),
   decks: [{ x0, x1, z0, z1, y }] (local, where you can stand) }]. */
export class Train {
  constructor(path, cars, { station }) {
    this.path = path;
    this.cars = cars;
    this.station = station;    // the head car's centre, standing at the platform: a distance along the loop
    this.offset = 0;           // seconds added to the clock (tests)
    this.state = { s: 0, v: 0, leaveIn: TRAIN.stop, arriveIn: 0 };
    for (const car of cars) car.pose = { x: 0, z: 0, ry: 0 };
    this.place(0);
  }

  /* Standing at the station (any mode but Socialize). */
  park() { this.state = { s: 0, v: 0, leaveIn: TRAIN.stop, arriveIn: 0 }; this.place(0); }

  /* Socialize: where the timetable has it now. `now` in seconds. */
  update(now) {
    this.state = timetable(now + this.offset, this.path.length);
    this.place(this.state.s);
  }

  /* Every car on the rails `s` metres past the station: placed by its two
     bogies (so a long car sits across a curve like a real one), its boxes
     moved with it. */
  place(s) {
    // the train runs the way the loop's distance grows; cars trail the head
    const head = this.station + s;
    for (const car of this.cars) {
      const mid = head - car.back;
      const half = Math.max(0.5, car.len / 2 - 1.5);
      this.path.at(mid + half, _p);
      this.path.at(mid - half, _q);
      const x = (_p.x + _q.x) / 2, z = (_p.z + _q.z) / 2;
      const dx = _p.x - _q.x, dz = _p.z - _q.z;
      // the car's nose is its local -x
      const ry = Math.atan2(dz, -dx);
      const P = car.pose;
      car.prev = { x: P.x, z: P.z, ry: P.ry };
      P.x = x; P.z = z; P.ry = ry;
      car.group.position.set(x, 0, z);
      car.group.rotation.y = ry;
      const cs = Math.cos(ry), sn = Math.sin(ry), ac = Math.abs(cs), as = Math.abs(sn);
      for (const b of car.boxes) {
        const wx = x + b.x * cs + b.z * sn, wz = z - b.x * sn + b.z * cs;
        const ex = ac * b.w / 2 + as * b.d / 2, ez = as * b.w / 2 + ac * b.d / 2;
        b.c.min.set(wx - ex, b.y, wz - ez);
        b.c.max.set(wx + ex, b.y + b.h, wz + ez);
      }
    }
  }

  /* A world point in a car's frame (its pose, or the one before). */
  static toLocal(pose, x, z) {
    const dx = x - pose.x, dz = z - pose.z, cs = Math.cos(pose.ry), sn = Math.sin(pose.ry);
    return { x: dx * cs - dz * sn, z: dx * sn + dz * cs };
  }
  static toWorld(pose, lx, lz) {
    const cs = Math.cos(pose.ry), sn = Math.sin(pose.ry);
    return { x: pose.x + lx * cs + lz * sn, z: pose.z - lx * sn + lz * cs };
  }

  /* The car and deck under a point (feet at `y`), in its last pose. */
  carAt(x, y, z, pad = 0, prev = true) {
    for (const car of this.cars) {
      const pose = prev ? car.prev || car.pose : car.pose;
      const l = Train.toLocal(pose, x, z);
      for (const d of car.decks) {
        if (Math.abs(y - d.y) > 0.35) continue;
        if (l.x >= d.x0 - pad && l.x <= d.x1 + pad && l.z >= d.z0 - pad && l.z <= d.z1 + pad) return { car, deck: d, local: l };
      }
    }
    return null;
  }
}
