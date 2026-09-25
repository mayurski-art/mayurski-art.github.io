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
  const img = await bannerImage(skin.banner);
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
