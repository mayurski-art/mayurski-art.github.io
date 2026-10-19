// Troll Forces — the Grin Express's timetable board on Troll City's platform
// (Socialize). A painted chalkboard hung on a gantry over the platform,
// both faces alike: when it next pulls in, when it leaves, and how it's
// doing. It reads the train's own state (train.js timetable(), off the
// room clock and the conductor's holds), so every screen shows the same.
//
//   boardRows(state)   the words on the board (pure; the test reads it)
//   buildTrainBoard()  the gantry and the board, built with the map's kit;
//                      update(state) each frame (modes/social-train.js),
//                      and the canvas is only redrawn when the words change.

import * as THREE from "three";

export const BOARD = {
  w: 2.1, h: 1.3,       // m, the board
  under: 2.25,          // m, its bottom above the platform (walk under it)
  allAboard: 10,        // s before leaving: "All aboard!"
  departed: 20,         // s after leaving: "Departed"
  arriving: 25,         // s before arriving: "Arriving"
  px: [1024, 634],      // the canvas
};

const mmss = (s) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/* What the board says for the train's `state` ({ v, leaveIn, arriveIn,
   period }; null: parked, not running). */
export function boardRows(st) {
  if (!st || !st.period) return { arrives: "Here", departs: "No service", status: "Resting", tone: "dim", every: "" };
  const standing = st.v <= 0.05 && st.arriveIn <= 0;
  const every = `Round town every ${mmss(st.period)}`;
  if (standing) {
    const soon = st.leaveIn <= BOARD.allAboard;
    return { arrives: "Here now", departs: mmss(st.leaveIn), status: soon ? "All aboard!" : "Boarding", tone: soon ? "warn" : "go", every };
  }
  const stop = st.leaveIn - st.arriveIn;                     // its stop here
  const out = st.period - stop - st.arriveIn;                // s since it left
  const status = out < BOARD.departed ? "Departed" : st.arriveIn < BOARD.arriving ? "Arriving" : "On time";
  return { arrives: mmss(st.arriveIn), departs: mmss(st.leaveIn), status, tone: status === "Departed" ? "gone" : status === "Arriving" ? "warn" : "ok", every };
}

const TONE = { go: "#a8f0a0", warn: "#ffd772", gone: "#ff9a8a", ok: "#f4f1e6", dim: "#b8b4a8" };
const CHALK = "#f1eee2";
const SLAB = "Rockwell, 'Rockwell Extra Bold', Georgia, serif";

/* A little seeded noise, so every build's board looks the same. */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/* The slate: green-black, wiped chalk clouds, a painted header plank. */
function paintSlate(g, W, H) {
  const R = rng(1872);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#22332b"); grad.addColorStop(1, "#18241e");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // old wipes: soft pale arcs
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(230,236,226,${(0.025 + R() * 0.035).toFixed(3)})`;
    g.lineWidth = 18 + R() * 40;
    g.beginPath();
    const x = R() * W, y = R() * H, r = 60 + R() * 200;
    g.arc(x, y, r, R() * 6, R() * 6 + 1 + R() * 2);
    g.stroke();
  }
  // grain
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(255,255,255,${(R() * 0.05).toFixed(3)})`;
    g.fillRect(R() * W, R() * H, 1 + R() * 2, 1);
  }
  // the header plank, painted cream with a dark rule
  const hh = H * 0.24;
  g.fillStyle = "#e9dcc0"; g.fillRect(0, 0, W, hh);
  for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(80,50,20,${(0.03 + R() * 0.05).toFixed(3)})`; g.fillRect(0, R() * hh, W, 1 + R() * 2); }
  g.fillStyle = "#3a1e12"; g.fillRect(0, hh - 6, W, 6);
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `900 ${Math.round(hh * 0.5)}px ${SLAB}`;
  g.fillStyle = "rgba(0,0,0,.22)"; g.fillText("GRIN EXPRESS", W / 2 + 4, hh * 0.42 + 4);
  g.fillStyle = "#3a1e12"; g.fillText("GRIN EXPRESS", W / 2, hh * 0.42);
  g.font = `italic 700 ${Math.round(hh * 0.2)}px Georgia, serif`;
  g.fillText("Troll City station  ·  arrivals & departures", W / 2, hh * 0.8);
  // flaked paint on the plank
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,250,235,${(0.08 + R() * 0.25).toFixed(3)})`; g.fillRect(R() * W, R() * hh, 1 + R() * 5, 1 + R() * 3); }
  // the chalk ruled lines between the rows
  g.strokeStyle = "rgba(241,238,226,.35)"; g.lineWidth = 3;
  for (const f of [0.475, 0.665, 0.855]) { g.beginPath(); g.moveTo(W * 0.05, H * f); g.lineTo(W * 0.95, H * f + (R() - 0.5) * 4); g.stroke(); }
}

/* Chalk: the letters, then bitten by the slate (grain knocked out). */
function chalkText(g, text, x, y, size, color, align, R, font = SLAB, weight = 800) {
  g.save();
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align; g.textBaseline = "middle";
  g.fillStyle = color;
  g.globalAlpha = 0.95;
  g.fillText(text, x, y);
  g.globalAlpha = 0.35;
  g.fillText(text, x + 1.5, y - 1);   // a doubled stroke
  // grain in the strokes: flecks of slate showing through
  const w = g.measureText(text).width;
  g.restore();
  const x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  for (let i = 0; i < text.length * 26; i++) {
    g.fillStyle = `rgba(28,42,35,${(0.3 + R() * 0.5).toFixed(2)})`;
    g.fillRect(x0 + R() * w, y - size / 2 + R() * size, 1 + R() * 2, 1 + R() * 2);
  }
}

export class TrainBoardFace {
  constructor() {
    const [W, H] = BOARD.px;
    this.W = W; this.H = H;
    this.slate = document.createElement("canvas");
    this.slate.width = W; this.slate.height = H;
    paintSlate(this.slate.getContext("2d"), W, H);
    this.canvas = document.createElement("canvas");
    this.canvas.width = W; this.canvas.height = H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.92, emissive: 0xffffff, emissiveMap: this.texture, emissiveIntensity: 0.22,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.key = null;
    this.rows = null;
    this.draws = 0;
    this.draw(boardRows(null));
  }

  /* Redraw only when the words change (once a second at most). */
  update(st) {
    const r = boardRows(st);
    const key = `${r.arrives}|${r.departs}|${r.status}|${r.every}`;
    if (key !== this.key) this.draw(r);
  }

  draw(r) {
    const { W, H } = this, g = this.canvas.getContext("2d");
    const R = rng(7 + this.draws % 5);
    g.globalCompositeOperation = "source-over";
    g.drawImage(this.slate, 0, 0);
    const L = W * 0.07, Rx = W * 0.93;
    const label = (t, y) => chalkText(g, t, L, y, 58, "rgba(241,238,226,.85)", "left", R, "Georgia, serif", "italic 700");
    label("Next arrival", H * 0.38);
    chalkText(g, r.arrives, Rx, H * 0.38, r.arrives.length > 5 ? 74 : 92, CHALK, "right", R);
    label("Departs in", H * 0.57);
    chalkText(g, r.departs, Rx, H * 0.57, r.departs.length > 5 ? 62 : 92, CHALK, "right", R);
    label("Status", H * 0.76);
    chalkText(g, r.status, Rx, H * 0.76, 72, TONE[r.tone] || CHALK, "right", R);
    // not by colour alone: a mark beside the status
    const mark = { go: "●", warn: "▲", gone: "■", ok: "●", dim: "○" }[r.tone] || "";
    g.save(); g.font = `40px ${SLAB}`; g.fillStyle = TONE[r.tone] || CHALK; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(mark, W * 0.36, H * 0.765); g.restore();
    g.save();
    g.font = `italic 600 36px Georgia, serif`; g.fillStyle = "rgba(241,238,226,.7)"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(r.every ? `${r.every}  ·  mind the gap, partner` : "Mind the gap, partner", W / 2, H * 0.93, W * 0.88);
    g.restore();
    this.rows = r;
    this.key = `${r.arrives}|${r.departs}|${r.status}|${r.every}`;
    this.draws++;
    this.texture.needsUpdate = true;
  }
}

/* The gantry over the platform at (x, z), the board across it facing
   ±x (along the platform), both faces the same. `K` the map's kit, `M` its
   materials, `place` its geometry placer. Returns the face to update. */
export function buildTrainBoard(K, M, place, { x, z, floor, span = 2.3 }) {
  const face = new TrainBoardFace();
  const { w, h, under } = BOARD;
  const top = floor + under + h;
  // two posts at the platform's edges, a beam across, iron hangers
  for (const s of [-span / 2, span / 2]) {
    K.solid(x, z + s, 0.16, 0.16, top + 0.25 - floor, { y: floor, pen: 3, mat: M.post });
    K.box(M.trimDark, x, floor, z + s, 0.24, 0.12, 0.24);
  }
  K.box(M.post, x, top + 0.25, z, 0.2, 0.18, span + 0.3);
  for (const s of [-w * 0.35, w * 0.35]) K.box(M.blackIron, x, top, z + s, 0.03, 0.25, 0.03);
  // the board's frame, then the slate on both faces
  K.box(M.trimDark, x, floor + under - 0.06, z, 0.1, h + 0.12, w + 0.14);
  for (const o of [1, -1]) {
    K.add(face.material, place(new THREE.PlaneGeometry(w, h), { x: x + o * 0.056, y: floor + under + h / 2, z, ry: o > 0 ? Math.PI / 2 : -Math.PI / 2 }), { shadow: false, live: true });
  }
  return face;
}
