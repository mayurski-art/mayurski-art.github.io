// Troll Forces: Troll Beach's court gear (5d, docs/GRIN-BEACH-COURTS.md).
//
// The Blender gear the court games play with, placed on every Troll Beach
// build (Royale too): the hoop nets (gb-hoopnet.glb, their own model so a
// make can flare them), the basketball cart, the tennis hopper, a chalk
// scoreboard at each court (gb-scoreboard.glb; its slate is a canvas the
// court game writes). `COURTS` is where each game's spots are (the cart,
// the hopper, the volleyball's spot, the boards); maps.js hands it out as
// rp.courts().

import * as THREE from "three";
import { loadModel } from "./battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2";
import { COURT, TENNIS, VB, RIMS } from "./grinbeach-venice.js?v=gb1-tb1-tb2-kbb2-kbs1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2";

const G = { ghost: true };
const VX = (VB[0] + VB[1]) / 2;

/* Each court: where you take a ball (`rack`, hold X), its scoreboard
   (`board`: x, z, the yaw its slate faces), and the half the game uses. */
export const COURTS = {
  hoops: { rack: { x: 55.6, z: -13, rot: 0 }, board: { x: 55.8, z: -6.0, rot: -Math.PI / 2 }, hoop: 0 },
  tennis: { rack: { x: 58.3, z: 0.2 }, board: { x: 71.4, z: -1.6, rot: -Math.PI / 2 } },
  vball: { rack: { x: 8.4, z: -13.4 }, board: { x: 9.4, z: -16.6, rot: -Math.PI / 2 } },
};

/* The nets, once loaded: { obj, rim } a hoop; the hoops game flares them. */
export const HOOP_NETS = [];
/* The slates: id -> { canvas, tex, mesh }. */
export const BOARDS = new Map();

/* A make: the net flares out at the foot and stretches down, then springs
   back. `t` 0..1 through the swish (the hoops game drives it). */
export function swishNet(i, t) {
  const n = HOOP_NETS[i];
  if (!n?.obj) return;
  const k = t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t) * (1 - t * 0.6);
  n.obj.scale.set(1 + 0.18 * k, 1 + 0.32 * k, 1 + 0.18 * k);
  n.obj.rotation.y = n.rot + 0.25 * k;
}

/* Write a scoreboard: a title, then rows of [name, score] in chalk. */
export function drawBoard(id, title, rows = [], foot = "") {
  const b = BOARDS.get(id);
  if (!b) return;
  const g = b.canvas.getContext("2d"), W = b.canvas.width, H = b.canvas.height;
  g.fillStyle = "#24302a";
  g.fillRect(0, 0, W, H);
  // old chalk smudged in
  g.globalAlpha = 0.07;
  g.fillStyle = "#e8efe8";
  for (let k = 0; k < 9; k++) g.fillRect((k * 97) % W, (k * 53) % H, 160, 36);
  g.globalAlpha = 1;
  g.fillStyle = "#f2f2ea";
  g.textBaseline = "middle";
  g.font = "700 46px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
  g.textAlign = "center";
  g.fillText(title, W / 2, 48);
  g.fillRect(W * 0.12, 82, W * 0.76, 3);
  g.font = "700 40px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
  rows.slice(0, 3).forEach(([name, score], i) => {
    const y = 132 + i * 58;
    g.textAlign = "left";
    g.fillText(String(name).slice(0, 14), 30, y);
    g.textAlign = "right";
    g.fillText(String(score), W - 30, y);
  });
  if (foot) {
    g.font = "600 28px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
    g.textAlign = "center";
    g.fillStyle = "#f2d23a";
    g.fillText(foot, W / 2, H - 28);
  }
  b.tex.needsUpdate = true;
}

const IDLE = { hoops: ["HOOPS", "Run it to 11"], tennis: ["TENNIS", "Tiebreak to 7"], vball: ["VOLLEYBALL", "2 v 2 to 15"] };

/* Called from buildVenice: the gear, its colliders, the slates. */
export function buildCourtGear(api) {
  HOOP_NETS.length = 0;
  BOARDS.clear();
  const place = (name, x, z, y, rot, then) => loadModel(name).then((obj) => {
    obj.position.set(x, y, z);
    obj.rotation.y = rot;
    api.prop(obj);
    then?.(obj);
  }, (e) => console.warn(name, e?.message || e));

  // the nets under the rims (each its own copy: they swish one at a time)
  RIMS.forEach((r, i) => {
    const slot = { obj: null, rim: r, rot: 0 };
    HOOP_NETS.push(slot);
    place("gb-hoopnet", r.x, r.z, r.y, 0, (obj) => { slot.obj = obj; obj.traverse((n) => { n.castShadow = false; }); });
  });

  // the basketball cart, long side along z by the east sideline
  const H = COURTS.hoops.rack;
  api.box(H.x, H.z, 0.5, 1.4, 1.08, { ...G, pen: 0.6 });
  place("gb-ballcart", H.x, H.z, 0.05, Math.PI / 2);
  // the tennis hopper, inside the west gate
  const T = COURTS.tennis.rack;
  api.box(T.x, T.z, 0.4, 0.4, 1.2, { ...G, pen: 0.6 });
  place("gb-hopper", T.x, T.z, 0.05, 0.4);

  // the scoreboards: an A-frame each, a canvas on its slate
  for (const [id, c] of Object.entries(COURTS)) {
    const B = c.board;
    const y = id === "vball" ? 0 : 0.05;
    api.box(B.x, B.z, 0.7, 1.7, 2.35, { ...G, pen: 0.8 });
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 330;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.876), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    BOARDS.set(id, { canvas, tex, mesh });
    drawBoard(id, IDLE[id][0], [], IDLE[id][1]);
    place("gb-scoreboard", B.x, B.z, y, B.rot, (obj) => {
      mesh.position.set(0, 1.30, 0.04);
      obj.add(mesh);
    });
  }
}

/* rp.courts(): the spots the court games use. */
export function courtSpots() {
  return { ...COURTS, layout: { court: COURT, tennis: TENNIS, vb: VB, vbX: VX, rims: RIMS } };
}
