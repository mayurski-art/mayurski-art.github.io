// Troll Forces profile card, shared (Barracks, menu-bo2.js): "Share on X"
// opens X's post composer with a line about your card and a link to the
// game; "Save as photo" draws the card onto a canvas and downloads it as a
// PNG (X's intent link can't carry an image, so you attach this one).
//
// `d` is the card's data, the same shape renderCard() takes (profile-card.js).

import { cardById, cleanClan } from "../calling-cards.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2";
import { playerIconCanvas, prestigeName } from "../rank-icons.js?v=rk1";

const GAME_URL = "https://trollrunner.net/troll-ops.html";
const FALLBACK_EMBLEM = new URL("../../../images/wallpaper/trollface transparent.png", import.meta.url).href;
const OWNER_ICON = new URL("../../../images/icons/pfp.png", import.meta.url).href;

const fullName = (d) => { const c = cleanClan(d.clan); return `${c ? `[${c}] ` : ""}${d.name}`; };

/* The post: who, the headline numbers when there's a record, the link. */
export function cardPostText(d) {
  const r = d.record;
  const bits = r ? [`K/D ${r.kd.toFixed(2)}`, `W/L ${r.wl.toFixed(2)}`, `best streak ${r.bestStreak}`] : [];
  return `My Troll Forces card: ${fullName(d)}${bits.length ? ` · ${bits.join(" · ")}` : ""}. Problem?`;
}

export function shareCardOnX(d) {
  const url = `https://x.com/intent/post?text=${encodeURIComponent(cardPostText(d))}&url=${encodeURIComponent(GAME_URL)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ── Save as photo ─────────────────────────────────────────────────────── */
function loadImage(src, cors) {
  return new Promise((res) => {
    if (!src) { res(null); return; }
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
/* `img` drawn to fill (x, y, w, h), cropped like CSS object-fit: cover. */
function cover(g, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}
function panel(g, x, y, w, h, fill) {
  g.save();
  roundRect(g, x, y, w, h, 12);
  g.fillStyle = fill; g.fill();
  g.lineWidth = 2; g.strokeStyle = "rgba(255,176,32,.45)"; g.stroke();
  g.restore();
}
function fitText(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

/* The card at 2x the Barracks size (1520 wide), on its dark plate with the
   site's name along the bottom. Resolves to a PNG blob. */
async function drawCard(d, withAvatar) {
  await document.fonts?.ready;
  const W = 1520, PAD = 40, GAP = 12, RANK = 200;
  const H_TOP = (W - 2 * PAD - RANK - 2 * GAP) / 4;           // emblem square, banner 3:1
  const STATS_Y = PAD + H_TOP + 16, STATS_H = 104;
  const H = STATS_Y + (d.record ? STATS_H : 0) + 70;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a0d06"); bg.addColorStop(1, "#070302");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  const card = cardById(d.card);
  const [emblem, banner, ownerIcon] = await Promise.all([
    withAvatar && d.avatarUrl ? loadImage(d.avatarUrl, true) : null,
    loadImage(card.src, true),
    d.owner ? loadImage(OWNER_ICON, true) : null,
  ]);
  const em = emblem || await loadImage(FALLBACK_EMBLEM, true);

  // emblem
  const ex = PAD, bx = PAD + H_TOP + GAP, bw = H_TOP * 3, rx = bx + bw + GAP;
  panel(g, ex, PAD, H_TOP, H_TOP, "#120806");
  if (em) { g.save(); roundRect(g, ex + 1, PAD + 1, H_TOP - 2, H_TOP - 2, 11); g.clip(); cover(g, em, ex, PAD, H_TOP, H_TOP); g.restore(); }
  // calling card, darkened at the foot, the name over it
  panel(g, bx, PAD, bw, H_TOP, "#120806");
  g.save();
  roundRect(g, bx + 1, PAD + 1, bw - 2, H_TOP - 2, 11); g.clip();
  if (banner) cover(g, banner, bx, PAD, bw, H_TOP);
  const shade = g.createLinearGradient(0, PAD + H_TOP, 0, PAD + H_TOP * 0.52);
  shade.addColorStop(0, "rgba(0,0,0,.78)"); shade.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = shade; g.fillRect(bx, PAD, bw, H_TOP);
  g.font = '600 52px Oswald, "Arial Narrow", sans-serif';
  g.textBaseline = "alphabetic";
  g.shadowColor = "rgba(0,0,0,.95)"; g.shadowBlur = 12; g.shadowOffsetY = 4;
  const clan = cleanClan(d.clan);
  let tx = bx + 20;
  const ty = PAD + H_TOP - 18;
  if (clan) { g.fillStyle = "#ffd27a"; const t = `[${clan}] `; g.fillText(t, tx, ty); tx += g.measureText(t).width; }
  g.fillStyle = "#f3ece4";
  g.fillText(fitText(g, d.name, bx + bw - 20 - tx), tx, ty);
  g.restore();
  // rank: the Owner badge, or the rank icon and level
  const rg = g.createLinearGradient(0, PAD, 0, PAD + H_TOP);
  rg.addColorStop(0, "#2a1608"); rg.addColorStop(1, "#0d0603");
  panel(g, rx, PAD, RANK, H_TOP, rg);
  const cx = rx + RANK / 2, cy = PAD + H_TOP / 2;
  if (d.owner) {
    const bw2 = 168, bh = 44, bx2 = cx - bw2 / 2, by = cy - bh / 2;
    g.save();
    roundRect(g, bx2, by, bw2, bh, bh / 2);
    const og = g.createLinearGradient(bx2, by, bx2 + bw2, by + bh);
    og.addColorStop(0, "#3b2700"); og.addColorStop(1, "#150c00");
    g.fillStyle = og; g.fill();
    g.shadowColor = "rgba(255,190,40,.45)"; g.shadowBlur = 18;
    g.lineWidth = 2; g.strokeStyle = "#ffcf4d"; g.stroke();
    g.restore();
    const ir = 17, ix = bx2 + 4 + ir, iy = cy;
    g.save();
    g.beginPath(); g.arc(ix, iy, ir, 0, Math.PI * 2); g.fillStyle = "#2a1a4a"; g.fill(); g.clip();
    if (ownerIcon) { const s = ir * 2 * 1.9; g.drawImage(ownerIcon, ix - s / 2, iy - ir - s * 0.28 + ir * 0.6, s, s * ownerIcon.height / ownerIcon.width); }
    g.restore();
    g.beginPath(); g.arc(ix, iy, ir, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = "#ffcf4d"; g.stroke();
    g.font = '700 22px Oswald, "Arial Narrow", sans-serif';
    g.fillStyle = "#ffd76a"; g.textAlign = "left"; g.textBaseline = "middle";
    if ("letterSpacing" in g) g.letterSpacing = "3px";
    g.fillText("OWNER", ix + ir + 12, cy + 1);
    if ("letterSpacing" in g) g.letterSpacing = "0px";
  } else if (d.level) {
    const p = d.prestige | 0;
    // the canvas icon: an SVG can't load its own troll art inside a canvas
    const icon = await playerIconCanvas(d.level, p, false).catch(() => null);
    if (icon) g.drawImage(icon, cx - 56, cy - 86, 112, 112);
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.font = '600 30px "DM Mono", monospace'; g.fillStyle = "#ffd27a";
    g.fillText(`LV ${d.level}`, cx, cy + 62);
    if (p > 0) { g.font = '20px "DM Mono", monospace'; g.fillStyle = "#c9b8a6"; g.fillText(fitText(g, prestigeName(p), RANK - 20), cx, cy + 92); }
  }
  // the headline six
  if (d.record) {
    const r = d.record, pct = (x) => `${(x * 100).toFixed(1)}%`;
    const cells = [["K/D", r.kd.toFixed(2)], ["W/L", r.wl.toFixed(2)], ["SPM", Math.round(r.spm).toLocaleString()],
      ["Accuracy", pct(r.accuracy)], ["Headshots", r.headshots.toLocaleString()], ["Best streak", String(r.bestStreak)]];
    const cw = (W - 2 * PAD - 5 * GAP) / 6;
    cells.forEach(([k, v], i) => {
      const x = PAD + i * (cw + GAP);
      g.save();
      roundRect(g, x, STATS_Y, cw, STATS_H, 12);
      g.fillStyle = "rgba(255,255,255,.05)"; g.fill();
      g.lineWidth = 2; g.strokeStyle = "rgba(243,236,228,.1)"; g.stroke();
      g.restore();
      g.textAlign = "center"; g.textBaseline = "alphabetic";
      g.font = '20px "DM Mono", monospace'; g.fillStyle = "#c9b8a6";
      if ("letterSpacing" in g) g.letterSpacing = "1px";
      g.fillText(k.toUpperCase(), x + cw / 2, STATS_Y + 36);
      if ("letterSpacing" in g) g.letterSpacing = "0px";
      g.font = '600 38px Oswald, sans-serif'; g.fillStyle = "#f3ece4";
      g.fillText(v, x + cw / 2, STATS_Y + 84);
    });
  }
  // the site, along the foot
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.font = '600 24px Oswald, "Arial Narrow", sans-serif'; g.fillStyle = "#ff8a1f";
  if ("letterSpacing" in g) g.letterSpacing = "3px";
  g.fillText("TROLL FORCES", PAD, H - 26);
  if ("letterSpacing" in g) g.letterSpacing = "0px";
  g.textAlign = "right"; g.font = '20px "DM Mono", monospace'; g.fillStyle = "#c9b8a6";
  g.fillText("trollrunner.net", W - PAD, H - 26);
  return new Promise((res, rej) => {
    try { c.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"); } catch (e) { rej(e); }
  });
}

/* Download the card as a PNG. An avatar served without CORS would block
   the export, so that one try goes again with the trollface in its place. */
export async function saveCardPhoto(d) {
  let blob;
  try { blob = await drawCard(d, true); } catch { blob = await drawCard(d, false); }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `troll-forces-card-${String(d.name || "troll").replace(/[^a-z0-9_-]+/gi, "-")}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return blob;
}
