// Troll Forces — the signs that lead to Kabukigrin's club, underground
// since docs/KB-CLUB-UNDERGROUND.md (section 7). Real Japanese where it's
// Japanese (user, 2026-10-24), lettered with the map's jpSign:
//   - the front stair's canopy in Lulz Square, the marquee on its face
//     (TROLLING LOUD, 東京) looking up A Main, a bulb chase under it
//   - a sign stack beside it, Kabukicho's basement-club way: the name down
//     a blade, the floors (B1 バルコニー, B2 ダンスフロア) and the way in (入口)
//   - a blade on A Main's corner at the forecourt: 地下クラブ (basement club),
//     and TROLLING LOUD ahead on a board under it
//   - pink arrows painted down A Main's wet street
//   - on Mid Bottom, under the LED windows: クラブ入口 (club entrance) toward the riser
//   - the yard's staff stair: 関係者以外立入禁止 (staff only)
//   - inside, the floor numbers at the stairs' feet
// Each face is registered for the obstruction test (signFaces).

import * as THREE from "three";
import { place } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1";
import { sign } from "./club-live.js?v=cl1-kb4-kb6-kb11-tx1-ch1-sp1-hh1-yb1-kbt1-dj2-mn1-gr1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1-kbc1-kbc2-kbc3";
import { FL, B1, HALL } from "./kabukigrin-under.js?v=kbu1-kbc1-kbc2-kbc3-zf1-zft1";

// the canopy over the front stair (S1's well: x -27.5 .. -24.5, z 4.5 .. 9.9)
const CANOPY = { x0: -27.9, x1: -24.1, z0: 3.9, z1: 10.3, y: 3.0 };
// (its board's east edge on the front stair's west wall, x -27.75: the square's west lane stays 2.75 m clear)
const PYLON = { x: -28.5, z: 6.4 };
// (clear of the corner kanban's front, z -31.9 .. -28.2, and over the shop bands, y 2.8 .. 3.3)
const BLADE = { x: -23.75, z: -27 };
const ARROWS_Z = [-25, -15, -5];

/* The pink chevron painted on the street (one canvas, every arrow). */
function arrowMat() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 192;
  const g = c.getContext("2d");
  g.fillStyle = "#ff3fb4";
  g.shadowColor = "#ff3fb4";
  g.shadowBlur = 10;
  g.beginPath();
  g.moveTo(64, 14); g.lineTo(118, 86); g.lineTo(84, 86); g.lineTo(84, 178); g.lineTo(44, 178); g.lineTo(44, 86); g.lineTo(10, 86);
  g.closePath();
  g.fill();
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
}

export function buildClubSigns({ root, K, N, M, S, jpSign }) {
  // a word on a board: `w` from the text's own shape at height `h`
  const word = (text, x, y, z, h, ry, { color = "#ffffff", vertical = false, k = 1.2, beat = 0.05 } = {}) => {
    const s = jpSign(text, { color, vertical, size: 96 });
    N.quad(s.mat, x, y, z, h * s.aspect, h, { ry, k, beat });
    return h * s.aspect;
  };

  /* ---- the front stair's canopy: four posts on the slot's parapets, a
     black roof, the marquee on its north face looking up A Main */
  {
    const { x0, x1, z0, z1, y } = CANOPY, cx = (x0 + x1) / 2;
    for (const [px, pz] of [[-27.62, 4.62], [-24.38, 4.62], [-27.62, 10.03], [-24.38, 10.03]]) K.box(M.blackMetal, px, 1.05, pz, 0.12, y - 1.05, 0.12);
    K.box(M.blackMetal, cx, y, (z0 + z1) / 2, x1 - x0, 0.14, z1 - z0);
    K.box(M.blackGloss, cx, y - 0.02, z0 + 0.06, x1 - x0, 1.62, 0.12);           // the fascia
    K.box(M.gold, cx, y + 1.6, z0 + 0.06, x1 - x0 + 0.04, 0.04, 0.16);
    K.api.ghostBox(cx, (z0 + z1) / 2, x1 - x0, z1 - z0, 0.14, { y, pen: 4 });
    K.api.ghostBox(cx, z0 + 0.06, x1 - x0, 0.12, 1.62, { y: y - 0.02, pen: 4 });
    sign(S, N, M, "logo", cx, y + 1.05, z0 - 0.01, 0.78, { ry: Math.PI, group: 1, halo: 0xff3fb4, haloK: 0.35, beat: 0.35 });
    word("東京", cx, y + 0.36, z0 - 0.01, 0.34, Math.PI, { beat: 0.1 });
    for (let i = 0; i < 18; i++) {
      N.add(M.neon, new THREE.SphereGeometry(0.035, 6, 4).translate(x0 + 0.15 + i * ((x1 - x0 - 0.3) / 17), y - 0.04, z0 - 0.02), { color: 0xffd080, k: 2.2, chase: 1, phase: i / 18, beat: 0.2 });
    }
    // under the roof, down the stair: a pink strip on each side
    for (const x of [-27.45, -24.55]) N.bar(M.neon, x, y - 0.1, (z0 + z1) / 2, 0.03, 0.03, z1 - z0 - 0.4, {}, { color: 0xff2ab4, k: 1.6, chase: 0.8, chaseLen: 3, beat: 0.4 });
    // the light it puts on the wet square in front of it, on the beat
    N.quad(M.neonHalo, cx, 0.03, z0 - 1.6, 5.2, 3.6, { rx: -Math.PI / 2, color: 0xff2ab4, k: 0.3, beat: 0.8 });
  }

  /* ---- the sign stack beside it: a post, the name down a blade (cyan and
     steady: the street's neon is calm), the floors and the way in on boards */
  {
    const { x, z } = PYLON;
    K.box(M.blackMetal, x, 0, z, 0.24, 5.9, 0.24);
    K.box(M.blackGloss, x, 1.9, z, 0.86, 3.9, 0.14);
    K.api.ghostBox(x, z, 0.86, 0.24, 5.9, { pen: 6 });
    const strip = jpSign("トローリング・ラウド", { vertical: true, color: "#3ff0ff" });
    const sh = 3.6, sw = sh * strip.aspect;
    for (const [dz, ry] of [[-0.075, Math.PI], [0.075, 0]]) N.quad(strip.mat, x, 1.9 + 3.9 / 2, z + dz, sw, sh, { ry, k: 1.15, beat: 0, group: 3 });
    S.signs.push({ group: 3, x, y: 1.9 + 3.9 / 2, z, w: sw, h: sh, ry: 0 });
    // the boards: B1, B2, and the way in (the arrow points at the stair from each side)
    K.box(M.blackGloss, x, 0.55, z, 1.5, 1.2, 0.12);
    K.api.ghostBox(x, z, 1.5, 0.12, 1.2, { y: 0.55, pen: 3 });
    for (const [dz, ry, way] of [[-0.065, Math.PI, "← 入口"], [0.065, 0, "入口 →"]]) {
      word("B1  バルコニー", x, 1.5, z + dz, 0.22, ry, { color: "#ffd2f0" });
      word("B2  ダンスフロア", x, 1.18, z + dz, 0.22, ry, { color: "#ffd2f0" });
      word(way, x, 0.82, z + dz, 0.3, ry, { color: "#ff3fb4", k: 1.6, beat: 0.25 });
    }
  }

  /* ---- A Main's north end, seen from the forecourt: a blade off the west
     block's corner, and a board under it naming the club ahead */
  {
    const { x, z } = BLADE;
    K.box(M.blackMetal, x + 0.45, 6.45, z, 0.9, 0.08, 0.08);
    K.box(M.blackGloss, x, 4.2, z, 0.7, 2.3, 0.14);
    for (const [dz, ry] of [[-0.075, Math.PI], [0.075, 0]]) word("地下クラブ", x, 4.2 + 1.15, z + dz, 1.9, ry, { vertical: true, color: "#ff3fb4", k: 1.3, beat: 0.1 });
    K.box(M.blackGloss, x - 0.3, 3.5, z, 2.1, 0.5, 0.12);
    // (down to the board's top, 4.0: one solid, not one floating over the other)
    K.api.ghostBox(x, z, 0.7, 0.14, 2.5, { y: 4.0, pen: 4 });
    K.api.ghostBox(x - 0.3, z, 2.1, 0.12, 0.5, { y: 3.5, pen: 4 });
    word("TROLLING LOUD ↑", x - 0.3, 3.75, z - 0.065, 0.3, Math.PI, { color: "#ffffff" });
    word("TROLLING LOUD ↓", x - 0.3, 3.75, z + 0.065, 0.3, 0, { color: "#ffffff" });
  }

  /* ---- the arrows painted down A Main, pointing at the square */
  {
    const mat = arrowMat();
    for (const z of ARROWS_Z) K.root.add(new THREE.Mesh(place(new THREE.PlaneGeometry(1.1, 1.65), { x: -27.6, y: 0.035, z, rx: -Math.PI / 2, ry: Math.PI }), mat));
  }

  /* ---- Mid Bottom: under the LED windows on the Heaven wall, toward the
     riser door (its rope up to A Heaven, the square under it) */
  K.box(M.blackGloss, -5.99, 1.95, 14, 0.04, 0.6, 3.2);
  word("クラブ入口 →", -5.95, 2.25, 14, 0.4, Math.PI / 2, { color: "#3ff0ff", k: 1.4, beat: 0.15 });

  /* ---- the yard: the staff stair down to the tunnel */
  K.box(M.blackGloss, -20, 1.75, 34.24, 3.3, 0.9, 0.04);
  word("関係者以外立入禁止", -20, 2.35, 34.27, 0.3, 0, { color: "#ff4040", k: 1.3 });
  word("B1 ↓", -20, 1.95, 34.27, 0.3, 0, { color: "#ffffff" });

  /* ---- inside: the floor numbers at the stairs' feet */
  word("B1", -24.53, B1 + 1.9, 9.2, 0.5, -Math.PI / 2, { color: "#ff3fb4", k: 1.4 });
  word("B2", HALL.x1 - 0.03, FL + 2.7, 12.7, 0.5, -Math.PI / 2, { color: "#ff3fb4", k: 1.4 });
}

/* Their faces and the props they hang on, for the obstruction test
   (tools/troll-ops-obstruction-test.mjs): a face's own props are its
   owner's (the canopy, the stack, the blade), so they can't block it but
   can block anything else. */
export function signFaces() {
  const f = (id, owner, c, n, w, h) => ({ id, owner, c, n, u: [n[2] || 0, 0, -(n[0] || 0)], w, h });
  const { x0, x1, z0, z1, y } = CANOPY;
  return {
    faces: [
      f("sign-marquee", "canopy", [-26, 4.05, z0 - 0.01], [0, 0, -1], 3.6, 1.0),
      f("sign-stack-n", "pylon", [PYLON.x, 3.85, PYLON.z - 0.08], [0, 0, -1], 0.8, 3.7),
      f("sign-stack-s", "pylon", [PYLON.x, 3.85, PYLON.z + 0.08], [0, 0, 1], 0.8, 3.7),
      f("sign-floors-n", "pylon", [PYLON.x, 1.15, PYLON.z - 0.07], [0, 0, -1], 1.4, 1.0),
      f("sign-blade-n", "blade", [BLADE.x, 5.35, BLADE.z - 0.08], [0, 0, -1], 0.65, 2.1),
      f("sign-blade-s", "blade", [BLADE.x, 5.35, BLADE.z + 0.08], [0, 0, 1], 0.65, 2.1),
      f("sign-club-ahead", "blade", [BLADE.x - 0.3, 3.75, BLADE.z - 0.07], [0, 0, -1], 2.0, 0.45),
      f("sign-midbottom", "code", [-5.95, 2.25, 14], [1, 0, 0], 3.0, 0.5),
      f("sign-staff", "code", [-20, 2.1, 34.27], [0, 0, 1], 3.2, 0.8),
      f("sign-b1", "code", [-24.53, B1 + 1.9, 9.2], [-1, 0, 0], 0.6, 0.5),
      f("sign-b2", "code", [HALL.x1 - 0.03, FL + 2.7, 12.7], [-1, 0, 0], 0.6, 0.5),
    ],
    props: [
      { id: "canopy", on: null, lo: [x0, y - 0.02, z0], hi: [x1, y + 1.6, z1] },
      { id: "canopy-posts", on: "canopy", lo: [-27.7, 1.05, 4.55], hi: [-24.3, y, 10.1] },
      { id: "pylon", on: null, lo: [PYLON.x - 0.75, 0, PYLON.z - 0.12], hi: [PYLON.x + 0.75, 5.9, PYLON.z + 0.12] },
      { id: "blade", on: null, lo: [BLADE.x - 1.35, 3.5, BLADE.z - 0.07], hi: [BLADE.x + 0.75, 6.5, BLADE.z + 0.07] },
    ],
  };
}
