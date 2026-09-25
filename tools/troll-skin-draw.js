// Troll Ops skin drawing, shared by the baker (troll-skin-bake.html) and the
// editor (troll-skin-editor.html), so what you drag in the editor is exactly
// what gets baked.
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
const trollface = await loadImage(new URL("../assets/images/wallpaper/trollface%20transparent.png", import.meta.url).href);

/* ---------------------------------------------------------------- helpers */

// Seeded random, so a skin bakes the same every time.
function rng(seed) {
  let s = 0;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function rgb(hex) {
  const n = typeof hex === "number" ? hex : parseInt(String(hex).replace("#", ""), 16);
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
function tracePath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}
// Pixels per metre along a panel, to size details in real units.
const ppm = (key) => SKIN_ATLAS.regions[key].w / (panelBounds(key).z1 - panelBounds(key).z0);

/* The trollface's line work as a single colour: the dark lines of the art
   become opaque, the white face goes clear. What engravings and stamps
   are made of. */
function trollLines(color, size, { fill = 0 } = {}) {
  const c = document.createElement("canvas");
  c.width = c.height = Math.ceil(size);
  const x = c.getContext("2d");
  const ar = trollface.width / trollface.height;
  const w = ar >= 1 ? size : size * ar, h = ar >= 1 ? size / ar : size;
  x.drawImage(trollface, (size - w) / 2, (size - h) / 2, w, h);
  const d = x.getImageData(0, 0, c.width, c.height);
  const [cr, cg, cb] = rgb(color);
  for (let i = 0; i < d.data.length; i += 4) {
    const a = d.data[i + 3] / 255;
    const lum = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 765;
    const line = Math.max(0, Math.min(1, (0.6 - lum) / 0.4));
    d.data[i] = cr; d.data[i + 1] = cg; d.data[i + 2] = cb;
    d.data[i + 3] = 255 * a * Math.max(line, fill);
  }
  x.putImageData(d, 0, 0);
  return c;
}
function trollSticker(size) {
  // The full-colour face with a die-cut white border and a soft shadow.
  const pad = Math.ceil(size * 0.1);
  const c = document.createElement("canvas");
  c.width = c.height = Math.ceil(size + pad * 2);
  const x = c.getContext("2d");
  const ar = trollface.width / trollface.height;
  const w = ar >= 1 ? size : size * ar, h = ar >= 1 ? size / ar : size;
  const ox = pad + (size - w) / 2, oy = pad + (size - h) / 2;
  // White silhouette, dilated by stamping it round a circle.
  const sil = document.createElement("canvas");
  sil.width = sil.height = c.width;
  const s = sil.getContext("2d");
  s.drawImage(trollface, ox, oy, w, h);
  s.globalCompositeOperation = "source-in";
  s.fillStyle = "#fff";
  s.fillRect(0, 0, sil.width, sil.height);
  const border = Math.max(2, size * 0.055);
  x.shadowColor = "rgba(0,0,0,.45)";
  x.shadowBlur = border * 1.2;
  x.shadowOffsetY = border * 0.5;
  for (let a = 0; a < 16; a++) {
    x.drawImage(sil, Math.cos(a / 16 * Math.PI * 2) * border, Math.sin(a / 16 * Math.PI * 2) * border);
    x.shadowColor = "transparent";
  }
  x.drawImage(trollface, ox, oy, w, h);
  return c;
}

/* ------------------------------------------------------------- the crops */

/* Where a part's crop sits on the banner, in banner pixels: centre, size and
   turn. An unturned, unflipped crop is kept inside the banner (it slides
   in from an edge), exactly as the first skins were baked; a turned one is
   left where it's put, and anything past the banner's edge shows trim. */
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

/* ------------------------------------------------------------- the panels */

function panelDetails(ctx, skin, key, r, rand) {
  const pal = skin.palette;
  const m = ppm(key);
  if (key === "handguard") {
    // Vent slots along the lower half, like a free-float guard's M-LOK
    // cut-outs: dark recesses with a lit lower lip.
    const n = 5, w = 0.022 * m, h = 0.0075 * m;
    for (let i = 0; i < n; i++) {
      const x = r.x + r.w * (0.1 + i * 0.13), y = r.y + r.h * 0.7;
      ctx.fillStyle = "rgba(0,0,0,.55)";
      roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + h / 2, y + h + 0.5); ctx.lineTo(x + w - h / 2, y + h + 0.5); ctx.stroke();
    }
  } else if (key === "grip") {
    // Stippled texture, for grip.
    for (let i = 0; i < 900; i++) {
      const x = r.x + rand() * r.w, y = r.y + rand() * r.h;
      ctx.fillStyle = rand() < 0.5 ? "rgba(0,0,0,.28)" : "rgba(255,255,255,.14)";
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  } else if (key === "mag") {
    // Ribs near the feed end and a baseplate in the trim colour.
    for (let i = 0; i < 4; i++) {
      const y = r.y + r.h * (0.1 + i * 0.045);
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(r.x, y, r.w, 2);
      ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(r.x, y + 2, r.w, 1);
    }
    ctx.fillStyle = pal.trim;
    ctx.fillRect(r.x, r.y + r.h * 0.93, r.w, r.h * 0.07);
  } else if (key === "lower") {
    // The rollmark, engraved above the trigger.
    ctx.save();
    ctx.font = `600 ${Math.round(0.0062 * m)}px "DM Mono", ui-monospace, monospace`;
    const [rs, rt, align] = skin.rollmark || [0.965, 0.66, "right"];
    ctx.textAlign = align;
    const x = r.x + r.w * rs, y = r.y + r.h * (1 - rt);
    ctx.fillStyle = "rgba(255,255,255,.22)";
    ctx.fillText("PROBLEM 416", x + 1, y + 1);
    ctx.fillText("CAL 5.56 · SAFE · TROLL", x + 1, y + 1 + 0.0082 * m);
    ctx.fillStyle = pal.ink;
    ctx.globalAlpha = 0.8;
    ctx.fillText("PROBLEM 416", x, y);
    ctx.fillText("CAL 5.56 · SAFE · TROLL", x, y + 0.0082 * m);
    ctx.restore();
  } else if (key === "stock") {
    // Sling slot at the toe.
    ctx.fillStyle = "rgba(0,0,0,.55)";
    roundRect(ctx, r.x + r.w * 0.62, r.y + r.h * 0.8, r.w * 0.14, r.h * 0.05, r.h * 0.025); ctx.fill();
  }
}
function roundRect(ctx, x, y, w, h, rad) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawEmblem(ctx, skin) {
  const e = skin.emblem;
  if (!e) return;
  const [key, s, t, size] = e.at;
  const r = SKIN_ATLAS.regions[key];
  const px = size * r.h;
  const cx = r.x + s * r.w, cy = r.y + (1 - t) * r.h;
  const color = e.color || skin.palette.ink;
  if (e.style === "sticker") {
    const img = trollSticker(px);
    ctx.drawImage(img, cx - img.width / 2, cy - img.height / 2);
  } else if (e.style === "engrave") {
    // Cut into the surface: dark lines with a lit lower edge.
    const lit = trollLines("#ffffff", px);
    const cut = trollLines(color, px);
    ctx.globalAlpha = 0.35;
    ctx.drawImage(lit, cx - px / 2 + 1, cy - px / 2 + 1);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(cut, cx - px / 2, cy - px / 2);
    ctx.globalAlpha = 1;
  } else {
    // Stamp: one ink colour, a little worn.
    const img = trollLines(color, px, { fill: 0 });
    const x = img.getContext("2d");
    const rand = rng(skin.id + "stamp");
    x.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(0,0,0,${0.3 + rand() * 0.5})`; x.fillRect(rand() * px, rand() * px, 1 + rand() * 3, 1 + rand() * 2); }
    ctx.globalAlpha = 0.9;
    ctx.drawImage(img, cx - px / 2, cy - px / 2);
    ctx.globalAlpha = 1;
  }
}

/* The whole 1024x512 atlas for a skin recipe. */
export async function bakeAtlas(skin, canvas) {
  const ctx = canvas.getContext("2d");
  const pal = skin.palette;
  const img = await bannerImage(skin.banner);
  const rand = rng(skin.id);
  const R = SKIN_ATLAS.regions;
  // Everything outside a panel is trim, so mip bleed at a panel's edge is
  // the trim colour rather than a neighbour's art.
  ctx.fillStyle = pal.trim;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --- trim swatch: the bevels and edges. Brushed, rounded across its width.
  const tr = R.trim;
  const g = ctx.createLinearGradient(0, tr.y, 0, tr.y + tr.h);
  g.addColorStop(0, "rgba(0,0,0,.35)"); g.addColorStop(0.5, "rgba(255,255,255,.12)"); g.addColorStop(1, "rgba(0,0,0,.35)");
  ctx.fillStyle = g; ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = rand() < 0.5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.07)";
    ctx.fillRect(tr.x, tr.y + rand() * tr.h, tr.w, 1);
  }

  for (const key of PARTS) {
    const r = R[key];
    const pts = panelPath(key);
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    drawCrop(ctx, img, key, skin.crops[key]);
    panelDetails(ctx, skin, key, r, rand);
    // Form: lit from above, a little shade underneath.
    const f = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    f.addColorStop(0, "rgba(255,255,255,.10)"); f.addColorStop(0.4, "rgba(255,255,255,0)");
    f.addColorStop(0.75, "rgba(0,0,0,0)"); f.addColorStop(1, "rgba(0,0,0,.2)");
    ctx.fillStyle = f; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();

    // Outside the outline: trim. Inside: an inlaid border — a band of trim
    // with a shadow line inside it, following the part's real shape.
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h);
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = pal.trim;
    ctx.fill("evenodd");
    ctx.restore();
    ctx.save();
    tracePath(ctx, pts); ctx.clip();
    ctx.lineJoin = "round";
    tracePath(ctx, pts);
    ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = pal.trim; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1.5; ctx.stroke();
    // Wear: chips off the paint along the edges, showing bare metal.
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const chips = Math.floor(len / 45 * (0.4 + rand()));
      for (let k = 0; k < chips; k++) {
        const u = rand();
        const x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
        ctx.fillStyle = `rgba(190,195,200,${0.25 + rand() * 0.35})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 2 + rand() * 5, 1 + rand() * 2.5, Math.atan2(y1 - y0, x1 - x0), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  drawEmblem(ctx, skin);
  return canvas;
}
