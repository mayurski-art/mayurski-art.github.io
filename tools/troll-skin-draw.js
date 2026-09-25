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

/* Banner text a skin rewrites: `lines: [{ box: [x0, y0, x1, y1], text, px,
   color, bg }]`, box as fractions of the banner. The box is painted over in
   `bg` and `text` written back in the banner's own pixel style: Tahoma at
   `px` (its real, tiny size), hard-edged, then blown up with square pixels
   to the box's height — the way the XP dialog art was made. Returns the
   banner itself when a skin has no lines. */
const edited = new Map();
export function editedBanner(img, lines) {
  if (!lines?.length) return img;
  const key = img.src + JSON.stringify(lines);
  if (edited.has(key)) return edited.get(key);
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  for (const l of lines) {
    const [x0, y0, x1, y1] = l.box;
    const bx = x0 * img.width, by = y0 * img.height, bw = (x1 - x0) * img.width, bh = (y1 - y0) * img.height;
    g.fillStyle = l.bg || "#ece9d8";
    g.fillRect(bx, by, bw, bh);
    if (!l.text) continue;
    // Draw small, snap every pixel to ink or paper, then scale up square.
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
    const scale = bh / h;
    g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, w, h, bx, by, w * scale, h * scale);
    g.imageSmoothingEnabled = true;
  }
  edited.set(key, c);
  return c;
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

/* The whole 1024x512 atlas for a skin recipe. */
export async function bakeAtlas(skin, canvas) {
  const ctx = canvas.getContext("2d");
  const img = editedBanner(await bannerImage(skin.banner), skin.lines);
  const R = SKIN_ATLAS.regions;
  // Everything outside a part is trim, including the trim swatch the bevels
  // use, so mip bleed at a part's edge is the trim colour, not a neighbour.
  ctx.fillStyle = skin.palette.trim;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const key of PARTS) {
    const r = R[key];
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    drawCrop(ctx, img, key, skin.crops[key]);
    ctx.restore();
    // Outside the part's real outline: trim.
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h);
    panelPath(key).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = skin.palette.trim;
    ctx.fill("evenodd");
    ctx.restore();
  }
  return canvas;
}
