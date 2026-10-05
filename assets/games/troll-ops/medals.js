// Troll Forces — the medal set: what each medal looks like and pays.
//
// BO2's medals read at a glance because the badge SHAPE names the family and
// the METAL names the rarity; the glyph inside is only the tiebreak:
//
//   shield  = a kill with something extra    silver = common
//   chevron = multikill                      gold   = rare
//   star    = kills without dying            red    = top of the ladder
//   hexagon = a feat (match-long, objective)
//
// `pts` is real: KillstreakUi pays it into the scorestreak meter and match XP
// when the medal lands, so the "+50" under a medal is never decoration.
// Labels are keys, compared case-insensitively (older peers still send
// "NUCLEAR" on the wire).
//
// Medal ART: a medal with `img` shows medals/<img>.png instead of its drawn
// badge. Those files are placeholder BO2 medals for now (user, 2026-10-05:
// "i will create troll versions of this"). To swap one in, overwrite the file
// of the same name and bump MEDAL_ART_V (sw.js serves art cache-first, so an
// unbumped swap can show the old picture for a day). Medals without `img`
// keep the drawn badge. The drawn badge's metal still tints the title and
// pitches the sting either way.

const MEDAL_ART_V = "bo2-1";

const METAL = {
  silver: { hi: "#f1f5f2", mid: "#aab3ad", lo: "#5f6863", ink: "#222825" },
  gold:   { hi: "#ffe7a8", mid: "#e2a52a", lo: "#8a5a08", ink: "#3b2502" },
  red:    { hi: "#ffb2a6", mid: "#d9432e", lo: "#6e160c", ink: "#2a0602" },
};

const SHAPE = {
  shield: "M32 4 L56 12 V30 C56 45 45 55 32 60 C19 55 8 45 8 30 V12 Z",
  hex: "M32 4 L56 18 V46 L32 60 L8 46 V18 Z",
  star: "M32 3 L39.5 21 L59 22.5 L44 35 L49 54 L32 43.5 L15 54 L20 35 L5 22.5 L24.5 21 Z",
  chevron: "M8 10 H56 V40 L32 58 L8 40 Z",
};

/* Glyphs are drawn in the badge's ink colour: `S` strokes, `F` fills. */
const S = (d, w = 3.5) => `<path d="${d}" fill="none" stroke-width="${w}"/>`;
const F = (d) => `<path d="${d}" stroke="none"/>`;
const GLYPH = {
  head: '<circle cx="32" cy="29" r="9" fill="none" stroke-width="3.5"/>' + S("M32 14 V20 M32 38 V44 M17 29 H23 M41 29 H47"),
  two: S("M20 22 L32 32 L44 22 M20 33 L32 43 L44 33", 4.5),
  three: S("M20 17 L32 26 L44 17 M20 27 L32 36 L44 27 M20 37 L32 46 L44 37", 4),
  four: S("M21 14 L32 22 L43 14 M21 22 L32 30 L43 22 M21 30 L32 38 L43 30 M21 38 L32 46 L43 38", 3.4),
  blood: F("M32 15 C38 24 42 29 42 35 A10 10 0 0 1 22 35 C22 29 26 24 32 15 Z"),
  scope: '<circle cx="32" cy="30" r="12" fill="none" stroke-width="3"/><circle cx="32" cy="30" r="2.5" stroke="none"/>' + S("M32 13 V20 M32 40 V47 M15 30 H22 M42 30 H49", 3),
  back: S("M44 22 A13 13 0 1 0 45 36", 4) + S("M38 16 L46 22 L38 28", 4),
  avenge: S("M22 18 L32 26 L42 18 M32 26 V44 M24 44 H40", 4),
  shut: '<rect x="21" y="20" width="22" height="20" rx="3" fill="none" stroke-width="3.6"/>' + S("M26 25 L38 35 M38 25 L26 35", 3.6),
  up: F("M32 16 L44 30 H37 V44 H27 V30 H20 Z"),
  flaw: S("M20 31 L28 39 L45 21", 5),
  medic: F("M28 17 H36 V26 H45 V34 H36 V43 H28 V34 H19 V26 H28 Z"),
  nuke: '<circle cx="32" cy="31" r="4" stroke="none"/>' + F("M32 17 A14 14 0 0 1 44 24 L36 29 A5 5 0 0 0 32 26 Z M20 24 A14 14 0 0 1 32 17 V26 A5 5 0 0 0 28 29 Z M26 43.5 A14 14 0 0 1 20 38 L28 33 A5 5 0 0 0 30 35.5 Z"),
  bomb: '<circle cx="30" cy="35" r="10" stroke="none"/>' + S("M36 27 L41 21 M41 21 C44 18 47 19 47 16", 3),
  jet: F("M32 13 L35 26 L48 33 V37 L35 33 L34 43 L39 47 V50 L32 48 L25 50 V47 L30 43 L29 33 L16 37 V33 L29 26 Z"),
  // The skull's eye sockets are knocked out in the metal's own mid tone.
  skull: (m) => F("M22 30 A10 10 0 1 1 42 30 V36 H38 V40 H26 V36 H22 Z")
    + `<circle cx="28" cy="30" r="3" fill="${m.mid}" stroke="none"/><circle cx="36" cy="30" r="3" fill="${m.mid}" stroke="none"/>`,
  num: (m, n) => `<text x="32" y="${String(n).length > 1 ? 38 : 40}" text-anchor="middle" stroke="none" font-family="Oswald, sans-serif" font-weight="700" font-size="${String(n).length > 1 ? 19 : 24}">${n}</text>`,
};

const MEDALS = {
  "headshot":        { shape: "shield", glyph: "head", metal: "silver", pts: 50, img: "headshot" },
  "double kill":     { shape: "chevron", glyph: "two", metal: "silver", pts: 50, img: "double-kill" },
  "triple kill":     { shape: "chevron", glyph: "three", metal: "gold", pts: 75, img: "triple-kill" },
  "quad kill":       { shape: "chevron", glyph: "four", metal: "red", pts: 100, img: "quad-kill" },
  "first blood":     { shape: "shield", glyph: "blood", metal: "gold", pts: 100 },
  "longshot":        { shape: "shield", glyph: "scope", metal: "silver", pts: 50, img: "longshot" },
  "revenge":         { shape: "shield", glyph: "back", metal: "silver", pts: 50, img: "revenge" },
  "avenger":         { shape: "shield", glyph: "avenge", metal: "silver", pts: 50, img: "avenger" },
  "shutdown":        { shape: "shield", glyph: "shut", metal: "gold", pts: 75, img: "shutdown" },
  "nuclear":         { shape: "star", glyph: "nuke", metal: "red", pts: 0, img: "nuclear" },
  "comeback":        { shape: "hex", glyph: "up", metal: "gold", pts: 100, img: "comeback" },
  "flawless":        { shape: "hex", glyph: "flaw", metal: "gold", pts: 100, img: "flawless" },
  "combat medic":    { shape: "hex", glyph: "medic", metal: "silver", pts: 50, img: "combat-medic" },
  "bomb specialist": { shape: "hex", glyph: "bomb", metal: "gold", pts: 100, img: "bomb-specialist" },
  "air superiority": { shape: "hex", glyph: "jet", metal: "gold", pts: 0, img: "air-superiority" },
  "suicide":         { shape: "hex", glyph: "skull", metal: "red", pts: 0, img: "suicide" },
};

/* Rungs with art; 3 and 7 keep the drawn star until they get some. */
const STREAK_ART = new Set([5, 10]);

/* Streak rungs and 5+ multikills are families, not fixed labels. */
export function medalDef(label) {
  const key = String(label).toLowerCase();
  if (MEDALS[key]) return MEDALS[key];
  let m = key.match(/^(\d+) kill streak$/);
  if (m) {
    const n = +m[1];
    return { shape: "star", glyph: "num", n, metal: n >= 10 ? "red" : n >= 7 ? "gold" : "silver", pts: 0,
      img: STREAK_ART.has(n) ? `streak-${n}` : "" };
  }
  m = key.match(/^(\d+)× multi kill$/);
  if (m) return { shape: "chevron", glyph: "four", metal: "red", pts: 150, img: `multi-${Math.min(+m[1], 9)}` };
  return { shape: "hex", glyph: "flaw", metal: "silver", pts: 0 };
}

export function medalPoints(label) {
  return medalDef(label).pts;
}

export function medalMetal(label) {
  return medalDef(label).metal;
}

let uid = 0;

/* Badge `<svg>` markup. Gradient ids are unique per call, since several
   copies of one medal can be on screen (splash + after-action list). */
export function badgeSvg(def, { inner = "" } = {}) {
  const m = METAL[def.metal] || METAL.silver;
  const id = `to-medal-g${uid++}`;
  const shape = SHAPE[def.shape] || SHAPE.hex;
  const g = GLYPH[def.glyph];
  const glyph = inner || (typeof g === "function" ? g(m, def.n) : g || "");
  return `<svg viewBox="0 0 64 64" aria-hidden="true">`
    + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.hi}"/><stop offset=".55" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient></defs>`
    + `<path d="${shape}" fill="#0a0c0b" opacity=".55" transform="translate(0 2)"/>`
    + `<path d="${shape}" fill="url(#${id})" stroke="${m.lo}" stroke-width="1.5"/>`
    + `<path d="${shape}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1" transform="translate(32 32) scale(.84) translate(-32 -32)"/>`
    + `<g fill="${m.ink}" stroke="${m.ink}" color="${m.ink}" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`;
}

const artUrl = (name) => new URL(`medals/${name}.png?v=${MEDAL_ART_V}`, import.meta.url).href;

/* A medal's icon markup: its art if it has some, else the drawn badge. */
export function medalIcon(def) {
  if (!def.img) return badgeSvg(def);
  return `<img src="${artUrl(def.img)}" alt="" draggable="false">`;
}

export function medalSvg(label) {
  return medalIcon(medalDef(label));
}

/* Fetch the art up front, so a match's first medal isn't an empty frame
   while its picture downloads. */
if (typeof Image !== "undefined") {
  const names = new Set(Object.values(MEDALS).map((d) => d.img).filter(Boolean));
  for (const n of STREAK_ART) names.add(`streak-${n}`);
  for (let n = 5; n <= 9; n++) names.add(`multi-${n}`);
  for (const n of names) new Image().src = artUrl(n);
}
