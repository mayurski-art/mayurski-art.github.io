// Troll Forces — money thrown over a club's dance floor on the beat drops
// (Kabukigrin in Blender, phase 1: "a small make-it-rain effect in
// club-live.js on the beat drops, the notes settling into the baked
// scatter's spots"). club-live.js's tick runs moneyTick every frame.
//
// A drop is when the music comes back in hard: the DJ's scratch landing
// (S.dropUntil running out), a song's level jumping from quiet to loud on
// its beat grid, or, on the club's own track, the top of every 8-bar
// phrase. Then a handful of the crowd throw: notes go up from hands over
// the floor, turn over and flutter down, drifting to a note already lying
// on the floor (the build's cash, kabukigrin-props.js), land on it in its
// pose and fade, so the floor looks the same after as before.
//
// One draw: an instanced quad per note, from a pool.

import * as THREE from "three";

const POOL = 64;          // notes in the air at most
const THROW = 22;         // notes a drop throws
const NOTE = [0.16, 0.076];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qf = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
// lying flat on the floor turned ry about the world's up, as kb_club.py's flat() lays them
const flatPose = (q, ry) => q.setFromEuler(_e.set(-Math.PI / 2, ry, 0, "YXZ"));

// a banknote in the build's note colour (kb_club.py KBF_Note, so the swap
// to the floor's own note on landing doesn't show): a darker border, a
// portrait oval, the corners' numerals
function noteTexture() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#b3a476"; g.fillRect(0, 0, 128, 64);
  g.strokeStyle = "#8a7e58"; g.lineWidth = 5; g.strokeRect(4, 4, 120, 56);
  g.fillStyle = "#a39668"; g.beginPath(); g.ellipse(84, 32, 17, 21, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#7a6e4c"; g.font = "bold 15px sans-serif"; g.fillText("1000", 12, 24); g.fillText("1000", 12, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* The notes for one club: `spots` the floor's notes [x, y, z, ry] that the
   thrown ones land on (the ones round the dance floor), `area` {x0, x1, z0,
   z1} where the throwers stand, `hand` the height they throw from. */
export function moneyRain(root, S, { spots, area, hand = 1.9 }) {
  if (!spots?.length) return null;
  const mat = new THREE.MeshLambertMaterial({ map: noteTexture(), side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(NOTE[0], NOTE[1]), mat, POOL);
  mesh.name = "club-money";
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  // the two notes the build lays (kb_club.py: note 0xb3a476, note_b 0x7f8fa6)
  const tints = [new THREE.Color(0xffffff), new THREE.Color(0x7f8fa6).multiply(new THREE.Color(1 / 0.70, 1 / 0.64, 1 / 0.46))];
  const notes = [];
  for (let i = 0; i < POOL; i++) {
    notes.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), rx: 0, ry: 0, rz: 0, spin: 0, to: null, landed: 0, left: 0, seed: Math.random() * 10 });
    mesh.setColorAt(i, tints[i % 4 === 3 ? 1 : 0]);
    mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
  }
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(mesh);
  S.money = { mesh, notes, spots, area, hand, phrase: -1, quiet: 0, drops: 0, thrown: 0, landed: 0, lastDrop: 0, force: false };
  return mesh;
}

function throwNotes(M, now) {
  M.drops++;
  M.lastDrop = now;
  // the throwers: spots over the floor, each throwing a little fan of notes,
  // till the drop's handful is gone
  let left = THROW;
  while (left > 0) {
    const hx = M.area.x0 + 0.6 + Math.random() * (M.area.x1 - M.area.x0 - 1.2);
    const hz = M.area.z0 + 0.6 + Math.random() * (M.area.z1 - M.area.z0 - 1.2);
    const n = Math.min(left, 4 + Math.floor(Math.random() * 4));
    left -= n;
    for (let k = 0; k < n; k++) {
      const N = M.notes.find((x) => !x.on);
      if (!N) return;
      // where it'll land: one of the floor's notes, the nearer the likelier
      let best = null, bd = 1e9;
      for (let t = 0; t < 6; t++) {
        const s = M.spots[Math.floor(Math.random() * M.spots.length)];
        const d = Math.hypot(s[0] - hx, s[2] - hz);
        if (d < bd) { bd = d; best = s; }
      }
      N.on = true; N.to = best; N.landed = 0;
      N.p.set(hx + (Math.random() - 0.5) * 0.3, M.hand + Math.random() * 0.3, hz + (Math.random() - 0.5) * 0.3);
      N.v.set((Math.random() - 0.5) * 1.6, 2.6 + Math.random() * 2.2, (Math.random() - 0.5) * 1.6);
      N.rx = Math.random() * 6; N.ry = Math.random() * 6; N.rz = Math.random() * 6;
      N.spin = 4 + Math.random() * 6;
      M.thrown++;
    }
  }
}

/* Every frame (club-live.js's tick): `bp` the beat position (bars land on
   whole multiples of 4), `songLevel` the song grid's level this beat (0..1,
   null without a song). */
export function moneyTick(S, now, dt, bp, songLevel) {
  const M = S.money;
  if (!M) return;
  // the drops
  let drop = M.force;
  M.force = false;
  if (S.dropUntil && S.dropUntil <= now && S.dropUntil > now - dt - 0.05) drop = true;   // the scratch lands
  if (songLevel !== null) {
    if (songLevel < 0.35) M.quiet = now;
    else if (songLevel > 0.7 && now - M.quiet < 2.5 && now - M.lastDrop > 6) drop = true;
  } else {
    const phrase = Math.floor(bp / 32);
    if (M.phrase >= 0 && phrase !== M.phrase) drop = true;
    M.phrase = phrase;
  }
  if (drop && now - M.lastDrop > 1.5) throwNotes(M, now);

  let live = false;
  M.notes.forEach((N, i) => {
    if (!N.on) return;
    live = true;
    if (N.landed) {
      // lying on the floor's own note, in its pose, a moment; then gone, the
      // baked note where it lay
      if (now - N.landed > 1.4) { N.on = false; M.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); return; }
      _p.set(N.to[0], N.to[1] + 0.003, N.to[2]);
      M.mesh.setMatrixAt(i, _m.compose(_p, flatPose(_q, N.to[3]), _s.setScalar(1)));
      return;
    }
    const t = now + N.seed;
    if (N.v.y > -0.6) {
      // thrown: up and over, gravity
      N.v.y -= 9.8 * dt;
      N.p.addScaledVector(N.v, dt);
    } else {
      // fluttering: a slow fall, swaying, steered toward its spot
      const dx = N.to[0] - N.p.x, dz = N.to[2] - N.p.z;
      const tLeft = Math.max(0.25, (N.p.y - N.to[1]) / 0.75);
      N.v.x += ((dx / tLeft) - N.v.x) * Math.min(1, dt * 2.5);
      N.v.z += ((dz / tLeft) - N.v.z) * Math.min(1, dt * 2.5);
      N.v.y = -0.75;
      N.p.x += (N.v.x + Math.sin(t * 5.1) * 0.35) * dt;
      N.p.z += (N.v.z + Math.cos(t * 4.3) * 0.35) * dt;
      N.p.y += N.v.y * dt;
      // settling: the last few centimetres it lies down on its spot
      if (N.p.y <= N.to[1] + 0.06) {
        N.landed = now;
        M.landed++;
        return;
      }
    }
    N.rx += N.spin * dt; N.rz += N.spin * 0.7 * dt; N.ry += dt;
    // flattening out as it nears the floor
    const lie = Math.min(1, Math.max(0, 1 - (N.p.y - N.to[1]) / 0.6));
    _q.setFromEuler(_e.set(N.rx, N.ry, N.rz, "XYZ"));
    if (lie > 0) _q.slerp(flatPose(_qf, N.to[3]), lie);
    M.mesh.setMatrixAt(i, _m.compose(N.p, _q, _s.setScalar(1)));
  });
  if (live || M.wasLive) M.mesh.instanceMatrix.needsUpdate = true;
  M.wasLive = live;
}

/* For the tests: what the notes are doing. */
export function moneyDebug(S) {
  const M = S?.money;
  if (!M) return null;
  return {
    drops: M.drops, thrown: M.thrown, landed: M.landed, spots: M.spots.length,
    air: M.notes.filter((n) => n.on && !n.landed).length,
    lying: M.notes.filter((n) => n.on && n.landed).map((n) => ({ x: n.to[0], z: n.to[2] })),
    force: () => { M.force = true; },
  };
}
