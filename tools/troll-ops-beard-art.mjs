// Write a FACIALS beard's art from its outline (BEARDS.md 5, "hair, not
// lines"): traits/src/facial-beard-<colour>.svg and its .depth.svg, from one
// smooth outline (the face side + the outer edge), so the drawing, the
// tufty silhouette and the depth image always agree.
//
//   node tools/troll-ops-beard-art.mjs            # Beard Brown
//
// The outer edge grows tufts (locks pointing out and down, longest at the
// hem); the front is painted as locks flowing from the face to the edge,
// each with a lit side and a dark cleft between, like the NFT's beard.
// Seeded, so a re-run gives the same beard. Then bake:
//   node tools/troll-ops-bake-traits.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../assets/games/troll-ops/traits/src");

// Beard Brown (TROLLS #820): the outer edge from the left sideburn under the
// hat, round the hem, up to the right one; the inner edge back along the
// face's right side, under the grin, up its left side (traced, see the
// svg's history).
const BEARD = {
  id: "facial-beard-brown",
  outer: "M150 440 C104 520 88 640 104 760 C126 878 220 987 290 1050 C322 1081 346 1123 372 1140 C400 1148 420 1128 448 1145 C476 1157 500 1139 526 1154 C554 1142 580 1156 606 1137 C634 1126 656 1145 684 1128 C716 1096 760 1042 812 972 C880 878 936 780 930 650 C926 560 900 490 860 440",
  inner: "M860 440 C874 490 884 530 872 570 C852 622 816 668 772 708 C700 764 600 792 500 798 C420 802 320 796 250 772 C206 742 176 694 156 640 C134 580 134 510 150 440",
  base: "#6e3b17", lit: "#9a5a2a", mid: "#7c4520", dark: "#4a250d", cleft: "#341807",
  shade: "#52290f",
};

// --- path sampling (M + C only) ---
function sample(d, step = 4) {
  const n = d.match(/-?\d+(\.\d+)?/g).map(Number);
  const pts = [[n[0], n[1]]];
  for (let i = 2; i + 5 < n.length; i += 6) {
    const [x0, y0] = pts[pts.length - 1];
    const [x1, y1, x2, y2, x3, y3] = n.slice(i, i + 6);
    const len = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
    const k = Math.max(2, Math.ceil(len / step));
    for (let j = 1; j <= k; j++) {
      const t = j / k, u = 1 - t;
      pts.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
                u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
    }
  }
  return resample(pts, step);
}
function resample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    let seg = Math.hypot(bx - ax, by - ay);
    while (carry + seg >= step) {
      const t = (step - carry) / seg;
      ax += (bx - ax) * t; ay += (by - ay) * t;
      out.push([ax, ay]);
      seg = Math.hypot(bx - ax, by - ay);
      carry = 0;
    }
    carry += seg;
  }
  out.push(pts[pts.length - 1]);
  return out;
}
let seed = 820;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const f = (v) => Math.round(v * 10) / 10;
const poly = (pts) => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L");
const smooth = (pts) => {   // Catmull-Rom through the points, as cubic beziers
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
};

// --- the tufty outer edge: locks out and down, longest at the hem, none
// up under the hat brim ---
function tufted(outer) {
  const pts = [];
  let i = 0;
  const at = (k) => outer[Math.min(outer.length - 1, k)];
  while (i < outer.length - 1) {
    // uneven: mostly small tufts, now and then a long lock
    const big = rnd() < 0.22;
    const span = big ? 7 + Math.floor(rnd() * 5) : 3 + Math.floor(rnd() * 4);
    const a = at(i), b = at(i + span), mid = at(i + (span >> 1));
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l, ny = dx / l;                   // outward
    // hair hangs: lean the tuft down, and toward the hem's middle
    nx = nx * 0.75 + (500 - mid[0]) * 0.0005; ny = ny * 0.75 + 0.4;
    const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
    const y = mid[1];
    const reach = y < 500 ? 0.1 : y < 620 ? 0.45 : y > 1080 ? 1.2 : 0.85;
    const len = span * 4 * (0.6 + rnd() * 0.7) * reach * (big ? 1.25 : 1);
    pts.push(a);
    // the notch dips a little in, the tip hooks down past the middle
    const tip = at(i + Math.round(span * (0.45 + rnd() * 0.35)));
    pts.push([tip[0] + nx * len, tip[1] + ny * len]);
    if (big && rnd() < 0.6) {   // a split end on a long lock
      const t2 = at(i + Math.round(span * 0.85));
      pts.push([t2[0] + nx * len * 0.25, t2[1] + ny * len * 0.25]);
      pts.push([t2[0] + nx * len * 0.6 + 2, t2[1] + ny * len * 0.6]);
    }
    const n = at(i + span);
    pts.push([n[0] - nx * 3 * reach, n[1] - ny * 3 * reach]);
    i += span;
  }
  pts.push(outer[outer.length - 1]);
  return pts;
}

// a tapered stroke as a filled shape: nothing at either end, widest past
// the middle
function wedge(pts, w) {
  const L = [], R = [];
  for (let s = 0; s < pts.length; s++) {
    const pa = pts[Math.max(0, s - 1)], pb = pts[Math.min(pts.length - 1, s + 1)];
    const dx = pb[0] - pa[0], dy = pb[1] - pa[1], l = Math.hypot(dx, dy) || 1;
    const t = s / (pts.length - 1), ww = w * Math.sin(Math.PI * Math.pow(t, 0.8));
    L.push([pts[s][0] - (dy / l) * ww, pts[s][1] + (dx / l) * ww]);
    R.push([pts[s][0] + (dy / l) * ww, pts[s][1] - (dx / l) * ww]);
  }
  return `<path d="${smooth([...L, ...R.reverse()])}Z"/>`;
}

// --- locks: guides from the face side to the outer edge; each guide
// carries a few locks (tapered teardrops), with a lit stroke on the left
// (the NFT's light) and a cleft between neighbours ---
function locks(inner, outer) {
  const at = (pts, u) => pts[Math.min(pts.length - 1, Math.round(u * (pts.length - 1)))];
  const G = 24, shapes = { fill: [], lit: [], cleft: [] };
  for (let g = 0; g <= G; g++) {
    const u = g / G;
    const a = at(inner, 1 - u), b = at(outer, u);
    const jitter = (rnd() - 0.5) * 0.02;
    const c = at(outer, Math.min(1, Math.max(0, u + jitter)));
    // a guide: from inside the face edge, bowing a little toward the
    // middle, past the outer edge (the tufts' tips)
    const m = [(a[0] + c[0]) / 2 + (500 - (a[0] + c[0]) / 2) * 0.08, (a[1] + c[1]) / 2 + 12];
    const start = [a[0] + (a[0] - c[0]) * 0.04, a[1] + (a[1] - c[1]) * 0.04];
    const end = [c[0] + (c[0] - m[0]) * 0.08, c[1] + (c[1] - m[1]) * 0.08];
    const q = (t) => {
      const u1 = 1 - t;
      return [u1 * u1 * start[0] + 2 * u1 * t * m[0] + t * t * end[0], u1 * u1 * start[1] + 2 * u1 * t * m[1] + t * t * end[1]];
    };
    const span = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const n = Math.max(1, Math.round(span / 120));
    for (let k = 0; k < n; k++) {
      const t0 = k / n + rnd() * 0.08, t1 = Math.min(1, (k + 1) / n + 0.12 + rnd() * 0.1);
      const p = [], L = [], R = [];
      for (let s = 0; s <= 8; s++) p.push(q(t0 + (t1 - t0) * (s / 8)));
      const w = 9 + rnd() * 9;
      for (let s = 0; s <= 8; s++) {
        const pa = p[Math.max(0, s - 1)], pb = p[Math.min(8, s + 1)];
        const dx = pb[0] - pa[0], dy = pb[1] - pa[1], l = Math.hypot(dx, dy) || 1;
        // fat a third of the way down, a point at the end
        const t = s / 8, ww = w * Math.sin(Math.PI * Math.min(1, t * 1.5 + 0.12)) * (1 - t * 0.85);
        L.push([p[s][0] - (dy / l) * ww, p[s][1] + (dx / l) * ww]);
        R.push([p[s][0] + (dy / l) * ww, p[s][1] - (dx / l) * ww]);
      }
      const tone = [BEARD.base, BEARD.mid, BEARD.base, "#663615"][Math.floor(rnd() * 4)];
      shapes.fill.push(`<path fill="${tone}" d="${smooth([...L, ...R.reverse()])}Z"/>`);
      // the lit edge: a short light wedge down the lock's left side
      const side = L[0][0] < R[0][0] ? L : R;
      const lit = [];
      for (let s = 1; s <= 5; s++) lit.push([(side[s][0] * 2 + p[s][0]) / 3, (side[s][1] * 2 + p[s][1]) / 3]);
      shapes.lit.push(wedge(lit, 2.2 + rnd() * 1.4));
    }
    // the cleft half-way to the next guide
    if (g < G) {
      const a2 = at(inner, 1 - (g + 0.5) / G), c2 = at(outer, (g + 0.5) / G);
      const m2 = [(a2[0] + c2[0]) / 2 + (500 - (a2[0] + c2[0]) / 2) * 0.08, (a2[1] + c2[1]) / 2 + 12];
      const s0 = 0.2 + rnd() * 0.3;
      // bow toward the middle only as far as the strip is wide
      const m2b = [(a2[0] + c2[0]) / 2, (a2[1] + c2[1]) / 2 + 6];
      const p0 = [a2[0] + (c2[0] - a2[0]) * s0, a2[1] + (c2[1] - a2[1]) * s0];
      const e2 = [c2[0] + (c2[0] - m2b[0]) * 0.04, c2[1] + (c2[1] - m2b[1]) * 0.04];
      const cl = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8, u1 = 1 - t;
        cl.push([u1 * u1 * p0[0] + 2 * u1 * t * m2b[0] + t * t * e2[0], u1 * u1 * p0[1] + 2 * u1 * t * m2b[1] + t * t * e2[1]]);
      }
      shapes.cleft.push(wedge(cl.slice(Math.round(rnd() * 3)), 3.5 + rnd() * 2.5));
    }
  }
  return shapes;
}

const outer = sample(BEARD.outer), inner = sample(BEARD.inner);
const edge = tufted(outer);
const outline = poly(edge) + " " + BEARD.inner.replace(/^M[\d. ]+/, "L860 440 ") + " Z";
const outerOnly = poly(edge);
const L = locks(inner, outer);

// short tufts crossing onto the face along the inner edge (no outline
// there: the hair grows over the face's edge)
const faceTufts = [];
for (let i = 4; i < inner.length - 4; i += 3 + Math.floor(rnd() * 3)) {
  const [x, y] = inner[i], [x2, y2] = inner[i + 1];
  const dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l;   // toward the face
  const len = 7 + rnd() * 12;
  const tx = x + nx * len + dx / l * (rnd() * 10 - 3), ty = y + ny * len + dy / l * 6;
  faceTufts.push(`<path fill="${rnd() < 0.5 ? BEARD.base : BEARD.mid}" d="M${f(x - dx / l * 5 - nx * 3)} ${f(y - dy / l * 5 - ny * 3)} Q${f((x + tx) / 2 - nx * 2)} ${f((y + ty) / 2 - ny * 2)} ${f(tx)} ${f(ty)} Q${f(x + nx * 3)} ${f(y + ny * 3)} ${f(x + dx / l * 6 - nx * 3)} ${f(y + dy / l * 6 - ny * 3)} Z"/>`);
}

const head = `<!--
  TROLLS trait: FACIALS / Beard Brown (TROLLS #820). GENERATED by
  tools/troll-ops-beard-art.mjs (edit the outline there, not here): a full
  bushy beard painted as locks (lit left edges, dark clefts), a tufty outer
  edge, inked round the outside only; the inner edge follows the face art's
  silhouette and the grin's bottom, so the whole grin shows.
  Frame: 1000 x 1300 (traits.js TALL): the head frame's 1033 rows on top,
  the hang below. The block body builds it as a volume (blocky-body.js
  beardVolume); the stick body bends the hang forward (traits.js).
-->`;
const svg = `${head}
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1300" width="1000" height="1300">
  <defs>
    <path id="beard" d="${outline}"/>
    <clipPath id="clip"><use href="#beard"/></clipPath>
    <filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  <use href="#beard" fill="${BEARD.base}"/>
  <g clip-path="url(#clip)">
    <!-- the locks -->
    <g>${L.fill.join("")}</g>
    <!-- shade: under the grin, and the far right (the NFT's light is on the left) -->
    <g filter="url(#soft)"><path fill="${BEARD.shade}" opacity="0.5" d="M240 800 C320 831 420 841 500 841 C600 841 700 823 790 760 C800 820 780 880 740 930 C640 900 560 880 500 880 C420 880 330 870 270 860 Z"/>
    <path fill="${BEARD.dark}" opacity="0.6" d="M940 440 C960 640 900 860 760 1010 C700 1080 650 1130 600 1170 L700 1170 C800 1060 900 900 960 640 Z M780 708 C860 640 900 560 880 440 L950 440 C960 620 900 780 800 900 Z"/>
    <g fill="${BEARD.cleft}" opacity="0.9">${L.cleft.join("")}</g>
    <g fill="${BEARD.lit}" opacity="0.85">${L.lit.join("")}</g>
  </g>
  <g>${faceTufts.join("")}</g>
  <!-- the ink edge round the OUTSIDE only, tufts and all -->
  <path d="${outerOnly}" fill="none" stroke="#0a0a0a" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
`;
writeFileSync(join(SRC, `${BEARD.id}.svg`), svg);

const depth = `<!--
  TROLLS trait: FACIALS / Beard Brown, its DEPTH (blocky-body.js
  beardVolume, BEARDS.md 2). GENERATED by tools/troll-ops-beard-art.mjs, the
  same outline as the drawing. White the fullest (BEARD.thick max), black
  none: thin sideburns, fuller down the jaw, the big mass under the chin,
  thinning to the hem; each lock a little proud of its cleft.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1300" width="1000" height="1300">
  <defs>
    <path id="beard" d="${outline}"/>
    <clipPath id="clip"><use href="#beard"/></clipPath>
    <linearGradient id="down" x1="0" y1="440" x2="0" y2="1160" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#3a3a3a"/>
      <stop offset="0.35" stop-color="#8a8a8a"/>
      <stop offset="0.62" stop-color="#d0d0d0"/>
      <stop offset="1" stop-color="#5a5a5a"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="28"/></filter>
    <filter id="lock" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>
  <rect width="1000" height="1300" fill="#000"/>
  <g clip-path="url(#clip)">
    <use href="#beard" fill="url(#down)"/>
    <g filter="url(#soft)">
      <ellipse cx="500" cy="930" rx="250" ry="120" fill="#ffffff"/>
      <ellipse cx="200" cy="760" rx="80" ry="140" fill="#b4b4b4"/>
      <ellipse cx="800" cy="760" rx="80" ry="140" fill="#b4b4b4"/>
    </g>
    <g filter="url(#lock)" fill="#000" opacity="0.3">${L.cleft.join("")}</g>
  </g>
</svg>
`;
writeFileSync(join(SRC, `${BEARD.id}.depth.svg`), depth);
console.log("wrote", BEARD.id, ".svg + .depth.svg");
