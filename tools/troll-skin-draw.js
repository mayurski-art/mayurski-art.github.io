// Troll Ops skin drawing, shared by the baker (troll-skin-bake.html) and the
// editor (troll-skin-editor.html), so what you drag in the editor is exactly
// what gets baked.
//
// A skin is the banner and nothing else: each part of the gun shows its own
// crop of the banner, and everything outside a part's outline is the skin's
// trim colour (the bevels and edges).
//
// A skin's crop per part is [cx, cy, zoom, rot, flip]:
//   cx, cy  centre of the crop, as a fraction of the banner's width/height
//   zoom    how much of the banner's WIDTH the part spans
//   rot     degrees the crop box is turned on the banner (optional, 0)
//   flip    1 mirrors the art along the part (optional, 0)
// The crop's height follows from the part's shape, so art is never stretched.

import { SKIN_ATLAS } from "../assets/games/troll-ops/skins.js";
import { PANELS_416, panelBounds } from "../assets/games/troll-ops/weapon-416.js";

export const PARTS = ["upper", "lower", "handguard", "stock", "grip", "mag"];

export const loadImage = (src) => new Promise((ok, bad) => {
  const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src;
});
const banners = {};
export const bannerImage = async (file) => (banners[file] ||= await loadImage(new URL(`../assets/images/banners/${file}`, import.meta.url).href));

/* Banner pieces a skin moves around: text it rewrites, and bits of art it
   lifts off the banner (the trollface), each placed as you like.

     lines:   [{ box, text, px, color, dx, dy, size, rot, flip }]
     cutouts: [{ name, box, dx, dy, size, rot, flip }]

   `box` is [x0, y0, x1, y1] as fractions of the banner: where the piece
   starts. That spot is painted over in the paper colour round it, and the
   piece drawn back moved by dx/dy (fractions of the banner's width/height),
   scaled by `size`, turned `rot` degrees and mirrored by `flip` — all about
   its own middle, and independent of how any part crops the banner.

   Text is written in the banner's own pixel style: Tahoma at `px` (its real,
   tiny size), hard-edged, blown up with square pixels to the box's height.
   A cutout keeps only the art: the paper round it is keyed out, starting
   from the box's edges, so the face's white inside survives.

   The returned canvas carries `pieces`: where each piece ended up, in banner
   pixels, for the editor to outline. Returns the banner itself when a skin
   moves nothing. */
const edited = new Map();
export function editedBanner(img, lines, cutouts) {
  if (!lines?.length && !cutouts?.length) return img;
  // Only a banner file is cached; a canvas passed in (already edited) isn't.
  const key = img.src ? img.src + JSON.stringify([lines, cutouts]) : null;
  if (key && edited.has(key)) return edited.get(key);
  const W = img.width, H = img.height;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  const orig = document.createElement("canvas");
  orig.width = W; orig.height = H;
  orig.getContext("2d").drawImage(img, 0, 0);   // the untouched pixels, read before any painting
  const og = orig.getContext("2d", { willReadFrequently: true });
  const rect = (b) => {
    const x = Math.round(b[0] * W), y = Math.round(b[1] * H);
    return { x, y, w: Math.round((b[2] - b[0]) * W), h: Math.round((b[3] - b[1]) * H) };
  };

  // 1. Lift every piece off: paint its box in the paper colour round it.
  const all = [...(cutouts || []).map((p) => ({ p, kind: "cut" })), ...(lines || []).map((p) => ({ p, kind: "line" }))];
  for (const { p } of all) {
    const r = rect(p.box);
    if (p.bg === "rows") fillRows(og, g, r);
    else { g.fillStyle = p.bg || paperAround(og, r); g.fillRect(r.x, r.y, r.w, r.h); }
  }

  // 2. Put each back where it's been moved to.
  const placed = [];
  const put = (p, art, w, h, kind, i) => {
    const r = rect(p.box);
    const size = p.size || 1;
    const cx = r.x + w / 2 + (p.dx || 0) * W, cy = r.y + h / 2 + (p.dy || 0) * H;
    g.save();
    g.translate(cx, cy);
    if (p.rot) g.rotate(p.rot * Math.PI / 180);
    if (p.flip) g.scale(-1, 1);
    g.scale(size, size);
    g.imageSmoothingEnabled = kind === "cut";
    g.drawImage(art, -w / 2, -h / 2, w, h);
    g.restore();
    placed.push({ kind, i, cx, cy, w: w * size, h: h * size, rot: p.rot || 0 });
  };
  (cutouts || []).forEach((p, i) => {
    const r = rect(p.box);
    put(p, keyedCutout(og, r), r.w, r.h, "cut", i);
  });
  (lines || []).forEach((l, i) => {
    const r = rect(l.box);
    if (!l.text) { placed.push({ kind: "line", i, cx: r.x + r.w / 2, cy: r.y + r.h / 2, w: r.w, h: r.h, rot: 0 }); return; }
    const small = l.smooth ? smoothText(l, r.h) : pixelText(l);
    const scale = r.h / small.height;
    put(l, small, small.width * scale, small.height * scale, "line", i);
  });
  c.pieces = placed;
  if (key) edited.set(key, c);
  return c;
}

/* Paint a box out row by row, each row the average of the pixels just
   outside its left and right edges: follows a gradient (the XP title bar)
   where one flat colour would leave a patch. */
function fillRows(og, g, r) {
  const W = og.canvas.width;
  const xl = Math.max(0, r.x - 3), xr = Math.min(W - 1, r.x + r.w + 2);
  const left = og.getImageData(xl, r.y, 1, r.h).data, right = og.getImageData(xr, r.y, 1, r.h).data;
  for (let y = 0; y < r.h; y++) {
    const i = y * 4;
    g.fillStyle = `rgb(${(left[i] + right[i]) >> 1}, ${(left[i + 1] + right[i + 1]) >> 1}, ${(left[i + 2] + right[i + 2]) >> 1})`;
    g.fillRect(r.x, r.y + y, r.w, 1);
  }
}

/* A line in a smooth display face at full size (for titles, not the pixel
   lettering): `font` family, `weight`, `color`, and a `shadow` colour
   dropped down-right the way XP draws window titles. The canvas is exactly
   `h` tall, so it maps 1:1 onto the box. */
function smoothText(l, h) {
  const px = Math.round(h * (l.scale || 0.78));
  const font = `${l.weight || "bold"} ${px}px ${l.font || '"Trebuchet MS", "Segoe UI", sans-serif'}`;
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  g.font = font;
  const off = Math.max(1, Math.round(px * 0.06));
  c.width = Math.ceil(g.measureText(l.text).width) + off * 2 + 4;
  c.height = Math.round(h);
  g.font = font;
  g.textBaseline = "middle";
  if (l.shadow) { g.fillStyle = l.shadow; g.fillText(l.text, 2 + off, h / 2 + off); }
  g.fillStyle = l.color || "#ffffff";
  g.fillText(l.text, 2, h / 2);
  return c;
}

/* The paper colour: the average of the pixels just round a box's edge. */
function paperAround(og, r) {
  const d = og.getImageData(r.x, r.y, r.w, r.h).data;
  let n = 0, R = 0, G = 0, B = 0;
  const at = (x, y) => { const i = (y * r.w + x) * 4; R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; };
  for (let x = 0; x < r.w; x += 3) { at(x, 0); at(x, r.h - 1); }
  for (let y = 0; y < r.h; y += 3) { at(0, y); at(r.w - 1, y); }
  return `rgb(${Math.round(R / n)}, ${Math.round(G / n)}, ${Math.round(B / n)})`;
}

/* A box of art with the paper round it made clear: flood from the box's
   edges through anything close to the paper colour, so light areas inside
   an outline (the trollface's white face) stay. Edges are softened a pixel. */
function keyedCutout(og, r) {
  const img = og.getImageData(r.x, r.y, r.w, r.h);
  const d = img.data, w = r.w, h = r.h;
  let n = 0, R = 0, G = 0, B = 0;
  const sample = (x, y) => { const i = (y * w + x) * 4; R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; };
  for (let x = 0; x < w; x += 2) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y += 2) { sample(0, y); sample(w - 1, y); }
  R /= n; G /= n; B /= n;
  const TOL = 40;
  const near = (p) => Math.abs(d[p] - R) + Math.abs(d[p + 1] - G) + Math.abs(d[p + 2] - B) < TOL;
  const clear = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => { const k = y * w + x; if (!clear[k] && near(k * 4)) { clear[k] = 1; stack.push(k); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const k = stack.pop(), x = k % w, y = (k - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  for (let k = 0; k < w * h; k++) {
    if (clear[k]) { d[k * 4 + 3] = 0; continue; }
    // Half-clear any kept pixel touching the cleared paper: a soft edge.
    const x = k % w, y = (k - x) / w;
    if ((x > 0 && clear[k - 1]) || (x < w - 1 && clear[k + 1]) || (y > 0 && clear[k - w]) || (y < h - 1 && clear[k + w])) d[k * 4 + 3] = 150;
  }
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  out.getContext("2d").putImageData(img, 0, 0);
  return out;
}

/* One line of text at its real pixel size, every pixel ink or clear. */
function pixelText(l) {
  const px = l.px || 11;
  const small = document.createElement("canvas");
  const sg = small.getContext("2d");
  const font = `${px}px Tahoma, Verdana, "Segoe UI", sans-serif`;
  sg.font = font;
  const w = Math.ceil(sg.measureText(l.text).width) + 2, h = Math.ceil(px * 1.4);
  small.width = w; small.height = h;
  sg.font = font;
  sg.textBaseline = "alphabetic";
  sg.fillStyle = "#000";
  sg.fillText(l.text, 1, Math.round(px * 1.05));
  const d = sg.getImageData(0, 0, w, h);
  const [r, gg, b] = rgb(l.color || "#000000");
  for (let i = 0; i < d.data.length; i += 4) {
    const on = d.data[i + 3] > 160;
    d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; d.data[i + 3] = on ? 255 : 0;
  }
  sg.putImageData(d, 0, 0);
  return small;
}
function rgb(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* Panel outline in atlas pixels. Drawn as seen from the gun's left side:
   muzzle to the left, stock to the right. */
export function panelPath(key) {
  const r = SKIN_ATLAS.regions[key];
  const b = panelBounds(key);
  return PANELS_416[key].pts.map(([z, y]) => [
    r.x + ((z - b.z0) / (b.z1 - b.z0)) * r.w,
    r.y + (1 - (y - b.y0) / (b.y1 - b.y0)) * r.h,
  ]);
}

/* Where a part's crop sits on the banner, in banner pixels: centre, size and
   turn. An unturned, unflipped crop is kept inside the banner (it slides
   in from an edge); a turned one is left where it's put, and anything past
   the banner's edge shows trim. */
export function cropFrame(img, key, crop) {
  const r = SKIN_ATLAS.regions[key];
  const [cx, cy, zoom, rot = 0, flip = 0] = crop;
  let sw = zoom * img.width;
  let sh = sw * (r.h / r.w);
  let x = cx * img.width, y = cy * img.height;
  if (!rot && !flip) {
    if (sh > img.height) { sh = img.height; sw = sh * (r.w / r.h); }
    x = Math.max(sw / 2, Math.min(img.width - sw / 2, x));
    y = Math.max(sh / 2, Math.min(img.height - sh / 2, y));
  }
  return { x, y, sw, sh, rot, flip: !!flip };
}

function drawCrop(ctx, img, key, crop) {
  const r = SKIN_ATLAS.regions[key];
  const f = cropFrame(img, key, crop);
  if (!f.rot && !f.flip) {
    ctx.drawImage(img, f.x - f.sw / 2, f.y - f.sh / 2, f.sw, f.sh, r.x, r.y, r.w, r.h);
    return;
  }
  // Banner -> part: move the crop centre to the origin, undo its turn,
  // mirror if flipped, scale to the part, centre on the part.
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.scale(r.w / f.sw, r.h / f.sh);
  if (f.flip) ctx.scale(-1, 1);
  ctx.rotate(-f.rot * Math.PI / 180);
  ctx.translate(-f.x, -f.y);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/* The whole 1024x1024 atlas for a skin recipe: left side on top, right below. */
export async function bakeAtlas(skin, canvas) {
  const ctx = canvas.getContext("2d");
  const img = editedBanner(await bannerImage(skin.banner), skin.lines, skin.cutouts);
  const R = SKIN_ATLAS.regions;
  // Everything outside a part is trim, including the trim swatch the bevels
  // use, so mip bleed at a part's edge is the trim colour, not a neighbour.
  ctx.fillStyle = skin.palette.trim;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --- left side (top half)
  for (const key of PARTS) {
    const r = R[key];
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    drawCrop(ctx, img, key, skin.crops[key]);
    ctx.restore();
  }
  trimOutlines(ctx, skin, 0);

  // --- right side (bottom half): the same art, placed the same along the
  // gun (the model mirrors it), with the writing turned back so it reads
  // correctly from the right too.
  const dy = SKIN_ATLAS.rightY;
  const raw = await bannerImage(skin.banner);
  const flipped = new Map();   // one right-side banner per crop angle
  for (const key of PARTS) {
    const r = R[key];
    const crop = skin.crops[key];
    const rot = crop[3] || 0;
    if (!flipped.has(rot)) flipped.set(rot, rightBanner(raw, skin, rot));
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y + dy, r.w, r.h); ctx.clip();
    ctx.translate(0, dy);
    if ((skin.right?.flipV || []).includes(key)) {
      // Upside down on the right side only: mirror about the region's middle.
      ctx.translate(0, 2 * r.y + r.h);
      ctx.scale(1, -1);
    }
    drawCrop(ctx, flipped.get(rot), key, crop);
    ctx.restore();
  }
  trimOutlines(ctx, skin, dy);
  return canvas;
}

/* The banner as the gun's right side needs it, for a part cropped at `rot`
   degrees. Mirrored along the crop's direction, so that once the model
   mirrors the whole side the writing reads correctly again:
     - banner text lines are rewritten mirrored, in the same spot: only the
       letters flip, so nothing next to them (a moved trollface) is caught;
     - marked text areas (writing in the banner art itself) are flipped in
       place, pixels and all.
   Done on the banner, before cropping, so a word split across two parts
   still comes out whole and in order on each. */
function rightBanner(raw, skin, rot) {
  const areas = textAreas(skin, raw);
  const R = rightPieces(skin);
  // Reflecting across the line square to the crop (angle a) turns a piece at
  // rot θ, flip f into one at rot 2a - θ with the flip toggled.
  const mirror = (list) => list.map((l) => ({ ...l, rot: 2 * rot - (l.rot || 0), flip: l.flip ? 0 : 1 }));
  const base = editedBanner(raw, mirror(R.lines), R.cutouts);
  // Right-only text goes on last, over any text area it replaces.
  const finish = (c) => (R.newLines.length ? editedBanner(c, mirror(R.newLines), []) : c);
  if (!areas.length) return finish(base);
  const c = document.createElement("canvas");
  c.width = base.width; c.height = base.height;
  const g = c.getContext("2d");
  g.drawImage(base, 0, 0);
  const a = rot * Math.PI / 180;
  for (const quad of areas) {
    const cx = quad.reduce((s, p) => s + p[0], 0) / 4, cy = quad.reduce((s, p) => s + p[1], 0) / 4;
    g.save();
    g.beginPath();
    quad.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    // Reflect across the line through the area's centre, square to the crop.
    g.translate(cx, cy);
    g.rotate(a);
    g.scale(-1, 1);
    g.rotate(-a);
    g.translate(-cx, -cy);
    g.drawImage(base, 0, 0);
    g.restore();
  }
  return finish(c);
}

/* The right side's own pieces. `skin.right` can override each banner text
   line and cutout by index (`lines`, `cutouts`: objects merged over the
   left side's), add text only the right side has (`newLines`), and flip
   parts upside down (`flipV`: part names). An override with text "" leaves
   that line off the right side. */
export function rightPieces(skin) {
  const r = skin.right || {};
  return {
    lines: (skin.lines || []).map((l, i) => ({ ...l, ...(r.lines?.[i] || {}) })),
    cutouts: (skin.cutouts || []).map((c, i) => ({ ...c, ...(r.cutouts?.[i] || {}) })),
    newLines: r.newLines || [],
    flipV: r.flipV || [],
  };
}

/* Outside each part's real outline: trim. `dy` picks the half. */
function trimOutlines(ctx, skin, dy) {
  for (const key of PARTS) {
    const r = SKIN_ATLAS.regions[key];
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y + dy, r.w, r.h);
    panelPath(key).forEach(([x, y], i) => (i ? ctx.lineTo(x, y + dy) : ctx.moveTo(x, y + dy)));
    ctx.closePath();
    ctx.fillStyle = skin.palette.trim;
    ctx.fill("evenodd");
    ctx.restore();
  }
}

/* The skin's marked text areas ([x0, y0, x1, y1] fractions of the banner)
   as four corners in banner pixels. Banner text lines aren't in here: the
   right side rewrites those itself (see rightBanner). */
export function textAreas(skin, img) {
  const W = img.width, H = img.height;
  return (skin.textAreas || []).map(([x0, y0, x1, y1]) => [[x0 * W, y0 * H], [x1 * W, y0 * H], [x1 * W, y1 * H], [x0 * W, y1 * H]]);
}
