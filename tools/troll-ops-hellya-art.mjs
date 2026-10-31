// Write FACIALS / HellYa: traits/src/face-hellya.svg, the trollface with
// its closed grin opened into a wide laugh (TROLLS #2531, refs/trolls-2531.png:
// the same grin, the lips apart, a row of upper teeth hanging from the top
// lip, a shorter row of lower teeth up from the bottom lip, the mouth dark
// between). The grin's inside is found in trollface transparent.png itself:
// every tooth is flood-filled off the teeth rows, their union closed up and
// grown under the lip's ink is the mouth, and the new upper teeth keep the
// art's own tooth spacing (each old upper tooth's left edge is a gap in the
// new row). Like the gold tooth and the cracked eyes it swaps in for the
// whole face (character.js FACE_ART "hellya"), in the png's own frame
// (800 x 730).
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-hellya-art.mjs
//   node tools/troll-ops-bake-traits.mjs --only face-hellya
// Also writes .claude/blocky-shots/hellya-check.png (the face, 2D) to look at.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FACE = join(ROOT, "assets/images/wallpaper/trollface transparent.png");
const OUT = join(ROOT, "assets/games/troll-ops/traits/src/face-hellya.svg");
const CHECK = join(ROOT, ".claude/blocky-shots/hellya-check.png");
// the art has two rows of teeth (upper, a bite line, lower): these rows
// cross them (face art px); a tooth is a white region bounded by ink that
// stays inside the grin's box
const ROWS = [400, 415, 430, 462, 480, 496], X0 = 130, X1 = 710, BOX = [110, 290, 730, 590], MAX_AREA = 40000;
const CLOSE = 12;      // px: the teeth's union closed up over the gaps and the bite line
const SMOOTH = 14;     // px: the lips' edges averaged along the row
const GROW = 7;        // px out past the teeth, under the lip's ink (no white seam)
const TAPER = 34;      // px: the mouth closes to a corner at each end
const INSET = 46;      // px: the teeth stop this short of each corner (a wedge of tooth
                       // pinched in the closing lips read as a fang; user, 2026-10-31)
const DROP = 22;       // px: the jaw drops this much further than the grin's inside (the NFT's mouth is taller)
const UPPER = 0.40;    // the upper teeth's share of the mouth's height (its middle height: the
const LOWER = 0.24;    // lower teeth's), the same depth all along the row, so no corner tooth
                       // hangs down like a fang where the grin is tall (user, 2026-10-31)
const INK = "#0b0b0b", TOOTH = "#f6f6f2", MOUTH = "#141212";

const browser = await chromium.launch();
const page = await browser.newPage();
const found = await page.evaluate(async ({ png, ROWS, X0, X1, BOX, MAX_AREA }) => {
  const img = new Image(); img.src = "data:image/png;base64," + png; await img.decode();
  const W = img.width, H = img.height, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, W, H).data;
  const white = (k) => d[k * 4 + 3] > 128 && d[k * 4] + d[k * 4 + 1] + d[k * 4 + 2] > 450;
  const seen = new Uint8Array(W * H);
  const teeth = [];
  for (const ROW of ROWS) for (let x = X0; x <= X1; x++) {
    const k0 = ROW * W + x;
    if (!white(k0) || seen[k0]) continue;
    // flood this white region; keep it if it's a tooth (small, inside the box)
    const st = [k0], px = [];
    seen[k0] = 1;
    let bx0 = x, bx1 = x, by0 = ROW, by1 = ROW, out = false;
    while (st.length) {
      const k = st.pop(), kx = k % W, ky = (k / W) | 0;
      px.push(k);
      bx0 = Math.min(bx0, kx); bx1 = Math.max(bx1, kx); by0 = Math.min(by0, ky); by1 = Math.max(by1, ky);
      if (kx < BOX[0] || ky < BOX[1] || kx > BOX[2] || ky > BOX[3] || px.length > MAX_AREA) { out = true; break; }
      for (const q of [k - 1, k + 1, k - W, k + W]) if (!seen[q] && white(q)) { seen[q] = 1; st.push(q); }
    }
    if (out) continue;
    // the tooth's rows: top and bottom per column
    const top = {}, bot = {};
    for (const k of px) { const kx = k % W, ky = (k / W) | 0; top[kx] = Math.min(top[kx] ?? 1e9, ky); bot[kx] = Math.max(bot[kx] ?? -1, ky); }
    teeth.push({ x0: bx0, x1: bx1, y0: by0, y1: by1, top, bot });
  }
  return { W, H, teeth };
}, { png: readFileSync(FACE).toString("base64"), ROWS, X0, X1, BOX, MAX_AREA });

const { W, H } = found;
const teeth = found.teeth.filter((t) => t.x1 - t.x0 > 6).sort((a, b) => a.x0 - b.x0);
console.log(`${teeth.length} teeth:`, teeth.map((t) => `${t.x0}-${t.x1} y${t.y0}-${t.y1}`).join("  "));
if (teeth.length < 8) throw new Error("the teeth weren't found (ROWS / BOX)");

// the mouth: the teeth's union, top and bottom per column, closed up over
// the gaps between teeth (a running min / max), then the lips' edges
// smoothed along the row and grown GROW px under the ink
const topAt = [], botAt = [];
for (const t of teeth) for (const x in t.top) { const k = +x; topAt[k] = Math.min(topAt[k] ?? 1e9, t.top[x]); botAt[k] = Math.max(botAt[k] ?? -1, t.bot[x]); }
const mx0 = Math.min(...teeth.map((t) => t.x0)), mx1 = Math.max(...teeth.map((t) => t.x1));
const run = (arr, x, r, pick) => { let v = null; for (let i = -r; i <= r; i++) { const u = arr[x + i]; if (u != null && (v == null || pick(u, v))) v = u; } return v; };
const topC = [], botC = [];
for (let x = mx0 - CLOSE; x <= mx1 + CLOSE; x++) { topC[x] = run(topAt, x, CLOSE, (a, b) => a < b); botC[x] = run(botAt, x, CLOSE, (a, b) => a > b); }
const avg = (arr, x, r) => { let s = 0, n = 0; for (let i = -r; i <= r; i++) { const u = arr[x + i]; if (u != null) { s += u; n++; } } return s / n; };
const L = mx0 - CLOSE - GROW, R = mx1 + CLOSE + GROW;
const clampX = (x) => Math.max(mx0 - CLOSE, Math.min(mx1 + CLOSE, x));
// the corners: the lips meet, the mouth closing to a point over TAPER px
const taper = (x) => { const d = Math.min(x - L, R - x); return d >= TAPER ? 1 : Math.pow(Math.max(0, d) / TAPER, 0.6); };
const lips = (x) => {
  const xi = clampX(Math.round(x)), k = taper(x);
  const t = avg(topC, xi, SMOOTH) - GROW, b = avg(botC, xi, SMOOTH) + GROW + DROP * k, m = (t + b) / 2;
  return [m + (t - m) * k, m + (b - m) * k];
};
const top = (x) => lips(x)[0], bot = (x) => lips(x)[1];
const xs = [];
for (let x = L; x <= R; x += 3) xs.push(x);
if (xs[xs.length - 1] !== R) xs.push(R);
const f = (v) => v.toFixed(1);
// the teeth's own columns: in from the corners, with a square end each side
const xsT = [L + INSET, ...xs.filter((x) => x > L + INSET && x < R - INSET), R - INSET];
const edge = (fn, pts = xs) => pts.map((x) => `${f(x)} ${f(fn(x))}`).join(" L");
const edgeBack = (fn, pts = xs) => [...pts].reverse().map((x) => `${f(x)} ${f(fn(x))}`).join(" L");
// the mouth's outline: along the top lip left to right, back along the bottom
const mouthPath = `M${edge(top)} L${edgeBack(bot)} Z`;
// the upper teeth: a band of one depth under the top lip (the mouth's middle
// height's share of it, never more than the mouth is tall here); the lower:
// the same over the bottom lip
const mid = xs.filter((x) => x > L + (R - L) * 0.3 && x < R - (R - L) * 0.3).map((x) => bot(x) - top(x)).sort((a, b) => a - b);
const HMID = mid[mid.length >> 1];
const depth = (x, share) => Math.min(HMID * share, (bot(x) - top(x)) * 0.5);
const upperBottom = (x) => top(x) + depth(x, UPPER);
const lowerTop = (x) => bot(x) - depth(x, LOWER);
const upperPath = `M${edge(top, xsT)} L${edgeBack(upperBottom, xsT)} Z`;
const lowerPath = `M${edge(lowerTop, xsT)} L${edgeBack(bot, xsT)} Z`;
// the gaps between the new teeth: at each old upper tooth's left edge (the
// art's separators; the upper row's teeth are the ones whose bottoms sit on
// the bite line), the upper ones straight down, the lower ones up
const bite = teeth.reduce((a, t) => a + t.y1, 0) / teeth.length;
const upperRow = teeth.filter((t) => t.y0 < bite - 20);
const seps = upperRow.slice(1).map((t, i) => (t.x0 + upperRow[i].x1) / 2).filter((x) => x > L + INSET + 12 && x < R - INSET - 12);
const upperSeps = seps.map((x) => `M${f(x)} ${f(top(x))} L${f(x)} ${f(upperBottom(x))}`).join(" ");
// the lower row has fewer, bigger teeth: every other gap
const lowerSeps = seps.filter((_, i) => i % 2 === 1).map((x) => `M${f(x)} ${f(lowerTop(x))} L${f(x)} ${f(bot(x))}`).join(" ");

const svg = `<!--
  TROLLS #2531's face (FACIALS / HellYa, refs/trolls-2531.png): the trollface
  with its grin opened into a laugh: the lips apart, the upper teeth hanging
  from the top lip, a shorter row of lower teeth up from the bottom lip and
  the mouth dark between. GENERATED by tools/troll-ops-hellya-art.mjs from
  the art's own grin (its teeth flood-filled, their union the mouth). In the
  trollface png's frame (${W} x ${H}), so it swaps in for the face.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <clipPath id="mouth"><path d="${mouthPath}"/></clipPath>
  </defs>
  <image href="../../../../images/wallpaper/trollface%20transparent.png" width="${W}" height="${H}"/>
  <g clip-path="url(#mouth)">
    <!-- the open mouth -->
    <path d="${mouthPath}" fill="${MOUTH}"/>
    <!-- the upper teeth, then the lower -->
    <path d="${upperPath}" fill="${TOOTH}" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>
    <path d="${lowerPath}" fill="${TOOTH}" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>
    <path d="${upperSeps}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    <path d="${lowerSeps}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
  </g>
  <!-- the lips' ink round the open mouth (the jaw dropped past the art's own line) -->
  <path d="${mouthPath}" fill="none" stroke="${INK}" stroke-width="13" stroke-linejoin="round"/>
</svg>
`;
writeFileSync(OUT, svg.replace(/\n/g, "\r\n"));
console.log("wrote", OUT);

// a 2D look at it (the svg with the face inlined)
mkdirSync(dirname(CHECK), { recursive: true });
const inline = svg.replace(/href="[^"]*trollface%20transparent\.png"/g, `href="data:image/png;base64,${readFileSync(FACE).toString("base64")}"`);
await page.setViewportSize({ width: W, height: H });
await page.setContent(`<!doctype html><html><body style="margin:0;background:#8fb3a6">${inline}</body></html>`);
writeFileSync(CHECK, await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } }));
console.log("wrote", CHECK);
await browser.close();
