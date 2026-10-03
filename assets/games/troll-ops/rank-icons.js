// Troll Forces rank + prestige icons (prestige phase 2, design doc
// "Troll Forces: Prestige + Profile Card"). Pure SVG strings, drawn in code
// so they stay crisp at any size and need no image files.
//
// Rank: 14 designs over levels 1-69, about five levels each, the way BO2
// steps its insignia: steel chevrons, then rockers under them, bronze and
// silver bars, stars, and a gold wreathed star at the top (66-69).
// Prestige: the real trollface art (never the emoji) inside a frame that
// escalates P1-P10, and its own crowned mark for Prestige Master.

// The same transparent trollface art the rig head wears (character.js), so
// it is already in the cache by the time an icon draws.
const TROLL_ART = new URL("../../images/wallpaper/trollface transparent.png", import.meta.url).href;

let uid = 0;
const id = (p) => `tfr-${p}-${++uid}`;

/* Metal gradients: [highlight, mid, shadow, outline]. */
const METAL = {
  steel:  ["#e6ebef", "#9aa5ae", "#4f5960", "#1b2024"],
  bronze: ["#ffd3a1", "#d08a4c", "#7a4520", "#2a160a"],
  silver: ["#ffffff", "#c9d0d6", "#7d868e", "#22282d"],
  gold:   ["#fff3b8", "#f2c14e", "#a8700f", "#3a2504"],
};

function grad(gid, m) {
  const [hi, mid, lo] = METAL[m];
  return `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".45" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>`;
}

const chevron = (y, fill, stroke) =>
  `<path d="M10 ${y} L32 ${y - 12} L54 ${y} L54 ${y + 9} L32 ${y - 3} L10 ${y + 9} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>`;
const rocker = (y, fill, stroke) =>
  `<path d="M10 ${y} Q32 ${y + 10} 54 ${y} L54 ${y + 7} Q32 ${y + 17} 10 ${y + 7} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>`;
// An officer's bar: a broad plate with a bevelled inner line.
const bar = (y, fill, stroke) =>
  `<rect x="13" y="${y}" width="38" height="12" rx="2.5" fill="${fill}" stroke="${stroke}" stroke-width="1.8"/>`
  + `<rect x="17" y="${y + 3}" width="30" height="6" rx="1.5" fill="none" stroke="${stroke}" stroke-opacity=".45" stroke-width="1"/>`;
function starPath(cx, cy, r) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r;
    d += `${i ? "L" : "M"}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)} `;
  }
  return d + "Z";
}
const star = (cx, cy, r, fill, stroke) =>
  `<path d="${starPath(cx, cy, r)}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round"/>`;
function wreath(fill, stroke, full = true) {
  // Laurel: leaves along an arc round the bottom, each laid along the arc,
  // from just off the bottom centre up either side.
  let out = "";
  for (const side of full ? [-1, 1] : [-1]) {
    for (let i = 0; i < 6; i++) {
      const deg = 100 + i * 19;                 // 100 (bottom) .. 195 (up the side)
      const a = (deg * Math.PI) / 180;
      const x = 32 - side * 23 * Math.cos(a), y = 31 + Math.sin(a) * 23;
      const rot = side < 0 ? deg : 180 - deg;   // long axis along the arc
      out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.4" ry="7" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
    }
  }
  return out;
}

/* Tier 0-13 for a level 1-69. */
export function rankTier(level) {
  return Math.max(0, Math.min(13, Math.floor((Math.max(1, level) - 1) / 5)));
}

/* The rank icon for a level, as an SVG string (64x64 viewBox). */
export function rankIconSvg(level, size = 28) {
  const t = rankTier(level);
  const metal = t <= 4 ? "steel" : t <= 6 ? "bronze" : t <= 10 ? "silver" : "gold";
  const g = id("g"), [, , , ink] = METAL[metal];
  const f = `url(#${g})`;
  let body = "";
  switch (t) {
    case 0: body = chevron(36, f, ink); break;
    case 1: body = chevron(30, f, ink) + chevron(42, f, ink); break;
    case 2: body = chevron(24, f, ink) + chevron(36, f, ink) + chevron(48, f, ink); break;
    case 3: body = chevron(20, f, ink) + chevron(31, f, ink) + chevron(42, f, ink) + rocker(47, f, ink); break;
    case 4: body = chevron(16, f, ink) + chevron(27, f, ink) + chevron(38, f, ink) + rocker(42, f, ink) + rocker(51, f, ink); break;
    case 5: body = bar(26, f, ink); break;
    case 6: body = bar(17, f, ink) + bar(35, f, ink); break;
    case 7: body = star(32, 32, 20, f, ink); break;
    case 8: body = `<circle cx="32" cy="32" r="24" fill="none" stroke="${f}" stroke-width="4"/><circle cx="32" cy="32" r="24" fill="none" stroke="${ink}" stroke-width=".8"/>` + star(32, 32, 16, f, ink); break;
    case 9: body = star(20, 32, 13, f, ink) + star(44, 32, 13, f, ink); break;
    case 10: body = star(32, 21, 12, f, ink) + star(18, 41, 12, f, ink) + star(46, 41, 12, f, ink); break;
    case 11: body = wreath(f, ink, false) + star(34, 28, 17, f, ink); break;
    case 12: body = wreath(f, ink) + star(24, 28, 11, f, ink) + star(40, 28, 11, f, ink); break;
    default: body = wreath(f, ink) + star(32, 27, 19, f, ink) + `<path d="M24 8 L28 14 L32 6 L36 14 L40 8 L39 17 L25 17 Z" fill="${f}" stroke="${ink}" stroke-width="1.2" stroke-linejoin="round"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="tf-rank-icon" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><defs>${grad(g, metal)}</defs>${body}</svg>`;
}

/* Prestige frames: [metal or colour stops, outer shape]. */
const PRESTIGE = [
  null,
  { name: "Prestige 1", stops: ["#ffd3a1", "#c07a3c", "#5e3214"], shape: "ring" },
  { name: "Prestige 2", stops: ["#ffffff", "#bfc7ce", "#6b747c"], shape: "ring" },
  { name: "Prestige 3", stops: ["#fff3b8", "#f2c14e", "#9a650c"], shape: "ring" },
  { name: "Prestige 4", stops: ["#b8ffd6", "#2fbf71", "#0b5a30"], shape: "shield" },
  { name: "Prestige 5", stops: ["#c6e2ff", "#3b8bff", "#123a85"], shape: "shield" },
  { name: "Prestige 6", stops: ["#ffc2c2", "#e23a3a", "#6b0f0f"], shape: "shield" },
  { name: "Prestige 7", stops: ["#ead2ff", "#9b4dff", "#3f1475"], shape: "burst" },
  { name: "Prestige 8", stops: ["#fff3b8", "#2a2a2a", "#000000"], shape: "burst" },
  { name: "Prestige 9", stops: ["#ffffff", "#d7dde3", "#8c96a0"], shape: "wings" },
  { name: "Prestige 10", stops: ["#fff1a8", "#ff7a1a", "#9a1a00"], shape: "wings" },
  { name: "Prestige Master", stops: ["#ffffff", "#ffd36b", "#c2410c"], shape: "master" },
];

export function prestigeName(p) {
  return PRESTIGE[Math.max(1, Math.min(11, p))]?.name || "";
}

function frame(shape, f, ink) {
  switch (shape) {
    case "ring":
      return `<circle cx="32" cy="32" r="27" fill="${f}" stroke="${ink}" stroke-width="2"/>`;
    case "shield":
      return `<path d="M32 3 L56 11 L54 36 Q50 52 32 61 Q14 52 10 36 L8 11 Z" fill="${f}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>`;
    case "burst": {
      let d = "";
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12, r = i % 2 ? 24 : 31;
        d += `${i ? "L" : "M"}${(32 + Math.cos(a) * r).toFixed(1)} ${(32 + Math.sin(a) * r).toFixed(1)} `;
      }
      return `<path d="${d}Z" fill="${f}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>`;
    }
    case "wings":
    case "master": {
      const wing = (s) => `<path d="M${32 + s * 14} 30 Q${32 + s * 30} 14 ${32 + s * 31} 26 Q${32 + s * 27} 30 ${32 + s * 31} 34 Q${32 + s * 25} 38 ${32 + s * 29} 44 Q${32 + s * 20} 46 ${32 + s * 14} 40 Z" fill="${f}" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/>`;
      let out = wing(-1) + wing(1) + `<circle cx="32" cy="34" r="21" fill="${f}" stroke="${ink}" stroke-width="2"/>`;
      if (shape === "master") {
        out += `<path d="M20 15 L25 4 L32 12 L39 4 L44 15 Z" fill="${f}" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/>`;
      }
      return out;
    }
  }
  return "";
}

/* Where a prestige icon's art sits: the centre and radius of its face disc. */
function prestigeGeom(p) {
  const def = PRESTIGE[Math.max(1, Math.min(11, p))];
  const cy = def.shape === "wings" || def.shape === "master" ? 34 : 32;
  const r = def.shape === "burst" || def.shape === "shield" ? 19 : 20;
  return { def, cy, r };
}

/* The prestige icon for prestige 1-11 (11 = Prestige Master). `noArt` leaves
   the face disc empty (the canvas path draws the art in itself). */
export function prestigeIconSvg(p, size = 28, { noArt = false } = {}) {
  const { def, cy, r } = prestigeGeom(p);
  const g = id("p"), clip = id("c");
  const [hi, mid, lo] = def.stops;
  const ink = "#0d0b08";
  return `<svg xmlns="http://www.w3.org/2000/svg" class="tf-prestige-icon" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">`
    + `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>`
    + `<clipPath id="${clip}"><circle cx="32" cy="${cy}" r="${r}"/></clipPath></defs>`
    + frame(def.shape, `url(#${g})`, ink)
    + `<circle cx="32" cy="${cy}" r="${r + 1.5}" fill="#fff" stroke="${ink}" stroke-width="1.5"/>`
    + (noArt ? "" : `<image href="${TROLL_ART}" x="${32 - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`)
    + `</svg>`;
}

/* The icon a player shows: prestige icon once they've prestiged, else the
   rank icon for their level. */
export function playerIconSvg(level, prestige = 0, size = 28) {
  return prestige > 0 ? prestigeIconSvg(prestige, size) : rankIconSvg(level, size);
}

/* ---- canvas versions, for name tags over players' heads. An SVG drawn
   into a canvas can't load images of its own, so the art is drawn in here.
   One 64x64 canvas per icon, built once and cached. */
const OWNER_ART = new URL("../../images/icons/pfp.png", import.meta.url).href;
const canvasCache = new Map();
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const svgImg = (svg) => loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
function coverCircle(ctx, img, cx, cy, r, focusY = 0.5, zoom = 1) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  const s = (2 * r * zoom) / Math.min(img.width, img.height);
  const w = img.width * s, h = img.height * s;
  ctx.drawImage(img, cx - w / 2, cy - h * focusY, w, h);
  ctx.restore();
}

/* Resolves to a 64x64 canvas: the owner's crowned troll, a prestige icon, or
   the rank icon for `level`. */
export function playerIconCanvas(level, prestige = 0, owner = false) {
  const key = owner ? "owner" : prestige > 0 ? `p${Math.min(11, prestige)}` : `r${rankTier(level)}`;
  if (!canvasCache.has(key)) {
    canvasCache.set(key, (async () => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const ctx = c.getContext("2d");
      if (owner) {
        ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2);
        ctx.fillStyle = "#2a1a4a"; ctx.fill();
        coverCircle(ctx, await loadImg(OWNER_ART), 32, 32, 28, 0.28, 1.9);
        ctx.lineWidth = 3; ctx.strokeStyle = "#ffcf4d";
        ctx.beginPath(); ctx.arc(32, 32, 29, 0, Math.PI * 2); ctx.stroke();
      } else if (prestige > 0) {
        ctx.drawImage(await svgImg(prestigeIconSvg(prestige, 64, { noArt: true })), 0, 0, 64, 64);
        const { cy, r } = prestigeGeom(prestige);
        coverCircle(ctx, await loadImg(TROLL_ART), 32, cy, r);
      } else {
        ctx.drawImage(await svgImg(rankIconSvg(level, 64)), 0, 0, 64, 64);
      }
      return c;
    })().catch(() => null));
  }
  return canvasCache.get(key);
}
