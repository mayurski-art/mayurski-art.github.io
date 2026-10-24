// Troll Forces — Kabukigrin's street signs in real Japanese (user,
// 2026-10-24: "use actual japanese language in the foreign texts").
// Grinjuku's builder letters its boards with made-up glyphs; Kabukigrin's
// build cuts those and writes where each board is (kabukigrin-sign-data.js,
// build_kabukigrin.blender.py). Here each board gets a shop's real name for
// what it is (an izakaya says 居酒屋, a pachinko parlour パチンコ, the post
// office 郵便局), drawn into one canvas atlas: the shop bands read left to
// right, the kanbans top to bottom. Two draws in all: the neon (bright, for
// the bloom) and the ink on the lightboxes.

import * as THREE from "three";
import { KB_SIGNS } from "./kabukigrin-sign-data.js?v=ks1-kbs1";

const JP = "'Hiragino Sans','Yu Gothic','Meiryo','Noto Sans JP','Noto Sans CJK JP',sans-serif";

// what each kind of board says (shop: Grinjuku's shopfront kinds, or the
// function that drew it)
const WORDS = {
  izakaya: ["居酒屋", "大衆酒場", "焼き鳥", "炉端焼", "串カツ", "もつ焼", "立ち飲み", "酒処"],
  ramen: ["ラーメン", "中華そば", "つけ麺", "麺屋", "拉麺", "豚骨"],
  shutter: ["質屋", "金物店", "理容室", "洋品店", "文具店", "靴修理", "古書店", "鍵"],
  glass: ["薬局", "古着屋", "本屋", "眼鏡店", "花屋", "雑貨屋", "喫茶店", "時計店", "写真館", "携帯"],
  pachinko: ["パチンコ", "スロット", "新台入替", "大当り"],
  karaoke: ["カラオケ", "歌広場", "カラオケ館"],
  kanban: ["居酒屋", "焼肉", "カラオケ", "スナック", "麻雀", "漫画喫茶", "寿司", "占い", "整体", "ホテル", "焼き鳥", "ラーメン", "将棋", "歯科", "バー"],
  post_office: ["郵便局"],
  roof: ["不動産", "天然水", "新発売", "生ビール", "英会話", "美容室"],
  // the ramen shops' (kb_street.py): the noren, the ticket machine, the menu board
  noren: ["ラーメン", "らーめん", "中華そば"],
  ticket: ["食券"],
  menu: ["醤油らーめん", "味噌らーめん", "塩らーめん", "とんこつ", "つけ麺"],
};
const CELL = 64;    // atlas px a character
const PAD = 12;     // round each cell: the neon's glow

const hash = (i) => ((i + 1) * 2654435761) >>> 0;
const hex = (c) => `#${c.toString(16).padStart(6, "0")}`;
// in a column, the long-vowel bar and the wave dash stand upright
const TURN = new Set(["ー", "〜", "～"]);

// the house's name, after its trade where there's room ("居酒屋 まるや"), as
// a real street's signs read: a long band with one short word on it read blank
const NAMES = ["まるや", "とり吉", "さくら", "大黒", "福助", "一番", "はなび", "みどり", "げんき", "あかね", "やまと", "銀星", "富士", "こまち", "大吉"];
const NAMED = new Set(["izakaya", "ramen", "shutter", "glass", "kanban"]);

/* What board i says: one of its kind's words that fits its slots, and the
   house's name after it when that fits too, the picks seeded by the board
   (a kanban's two faces, i and i + 1, say the same). */
function wordFor(s, i) {
  const [kind, , , , , , , slots, , , shop] = s;
  const key = WORDS[shop] ? shop : kind === "col" ? "kanban" : shop?.includes("konbini") ? "konbini" : "roof";
  const list = WORDS[key] || ["コンビニ"];
  const fits = list.filter((w) => [...w].length <= slots);
  const pool = fits.length ? fits : [list.reduce((a, b) => ([...a].length <= [...b].length ? a : b))];
  const seed = kind === "col" ? i - (i % 2) : i;
  const word = pool[hash(seed) % pool.length];
  if (!NAMED.has(key)) return word;
  const name = NAMES[hash(seed * 7 + 3) % NAMES.length];
  // a band leaves a quarter of itself clear; a kanban's column runs full
  const both = kind === "row" ? `${word} ${name}` : `${word}${name}`;
  return [...both].length <= Math.floor(slots * (kind === "row" ? 0.75 : 1)) ? both : word;
}

export function buildSigns() {
  // one cell per distinct (kind, word, ink, glow): the atlas's contents
  const cells = new Map(), boards = [];
  KB_SIGNS.forEach((s, i) => {
    const word = wordFor(s, i), chars = [...word];
    const [kind, , , , , , , , ink, glow] = s;
    const key = `${kind}|${word}|${ink}|${glow}`;
    if (!cells.has(key)) {
      const len = Math.ceil(chars.length * CELL * 1.06);
      cells.set(key, { kind, chars, ink, glow, w: (kind === "row" ? len : CELL) + 2 * PAD, h: (kind === "row" ? CELL : len) + 2 * PAD });
    }
    boards.push({ s, cell: cells.get(key), n: chars.length });
  });
  // shelf-pack the cells, tallest first
  const W = 2048, list = [...cells.values()].sort((a, b) => b.h - a.h);
  let x = 0, y = 0, shelf = 0;
  for (const c of list) {
    if (x + c.w > W) { x = 0; y += shelf; shelf = 0; }
    c.x = x; c.y = y;
    x += c.w; shelf = Math.max(shelf, c.h);
  }
  const H = Math.ceil((y + shelf) / 4) * 4;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.textAlign = "center"; g.textBaseline = "middle";
  const letter = (c) => {
    const cx = c.x + c.w / 2;
    if (c.kind === "row") {
      // spaced evenly, squeezed if the font runs wide
      const step = (c.w - 2 * PAD) / c.chars.length, cy = c.y + c.h / 2;
      c.chars.forEach((ch, k) => {
        const sx = Math.min(1, (step * 0.98) / Math.max(1, g.measureText(ch).width));
        g.save(); g.translate(c.x + PAD + (k + 0.5) * step, cy); g.scale(sx, 1); g.fillText(ch, 0, 0); g.restore();
      });
    } else {
      const step = (c.h - 2 * PAD) / c.chars.length;
      c.chars.forEach((ch, k) => {
        g.save(); g.translate(cx, c.y + PAD + (k + 0.5) * step);
        if (TURN.has(ch)) g.rotate(Math.PI / 2);
        g.fillText(ch, 0, 0); g.restore();
      });
    }
  };
  for (const c of list) {
    g.save();
    g.fillStyle = hex(c.ink);
    g.font = `${c.glow ? 900 : 700} ${Math.round(CELL * 0.86)}px ${JP}`;
    // neon: the glow, then the tube crisp over it
    if (c.glow) { g.shadowColor = hex(c.ink); g.shadowBlur = CELL * 0.16; letter(c); g.shadowBlur = 0; }
    letter(c);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  // a quad per board, on its glyph plane, the text's size from the glyphs'
  const geo = { neon: [], ink: [] };
  for (const { s, cell, n } of boards) {
    const [kind, px, py, pz, nx, nz, size, slots] = s;
    const room = slots * size * (kind === "row" ? 1.15 : 1.1);
    let along = n * size * 1.06;
    const k = along > room ? room / along : 1;
    along *= k;
    // the quad covers the cell, its glow pad included
    const across = size * k * (1 + (2 * PAD) / CELL);
    along += size * k * (2 * PAD) / CELL;
    const [w, h] = kind === "row" ? [along, across] : [across, along];
    // a column reads from its top, as a kanban does: the word hangs from the board's first slot
    const cy = kind === "row" ? py : py + (room - along) / 2;
    const rx = nz, rz = -nx;        // right, as the board's reader sees it: up x n
    const u0 = cell.x / W, u1 = (cell.x + cell.w) / W, v1 = 1 - cell.y / H, v0 = 1 - (cell.y + cell.h) / H;
    const corner = (a, b) => [px + rx * a * w / 2, cy + b * h / 2, pz + rz * a * w / 2];
    const quad = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
    const out = cell.glow ? geo.neon : geo.ink;
    const tri = [0, 1, 2, 0, 2, 3];
    for (const t of tri) out.push([...corner(quad[t][0], quad[t][1]), quad[t][2], quad[t][3]]);
  }
  const group = new THREE.Group();
  group.name = "kb-signs";
  const mats = {
    // brighter than white, so the bloom takes it as it takes the tubes
    neon: new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(2.2, 2.2, 2.2), transparent: true, depthWrite: false }),
    ink: new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.45 }),
  };
  for (const [name, verts] of Object.entries(geo)) {
    if (!verts.length) continue;
    const b = new THREE.BufferGeometry();
    b.setAttribute("position", new THREE.Float32BufferAttribute(verts.flatMap((v) => v.slice(0, 3)), 3));
    b.setAttribute("uv", new THREE.Float32BufferAttribute(verts.flatMap((v) => v.slice(3)), 2));
    b.computeBoundingSphere();
    const m = new THREE.Mesh(b, mats[name]);
    m.name = `kb-signs-${name}`;
    m.renderOrder = 2;
    group.add(m);
  }
  return group;
}
