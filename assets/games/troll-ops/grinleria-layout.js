// Troll Forces — "The Grinleria" layout: the one source of truth for the
// mall map's shape.
//
// grinleria.js turns `solids` into colliders (and stairs, lights, glass,
// signs); models/build_grinleria.blender.py reads the same data, dumped to
// models/grinleria-layout.json by tools/troll-ops-grinleria-layout.mjs, and
// draws a model to fit every solid by its kind. Change the layout here,
// re-dump, re-run Blender: colliders and art can't drift apart.
//
// No imports on purpose (node loads this file for the dump).
//
// Game coordinates: x east, y up, z south, metres. 112 x 80 m. The layout
// is 180° rotationally symmetric for fairness ((x, z) -> (-x, -z) swaps the
// teams' halves); each half is dressed as different shops (`alt` kinds).
//
//   z -40 .. -32.5   outside, north: the Westheimer valet drive
//   z -32 .. -28.3   service corridor behind the north shops (ground floor)
//   z -28 .. -16     north shops, two floors
//   z -16 .. -10     north concourses, two floors
//   z -10 ..  10     the atrium: ice rink under the glass vault
//   ...and the same turned round to the south, where outside is the
//   parking garage's ground level.
//   x -55 .. -32.3   west wing: Neiman Narcus (one tall floor)
//   x  32.3 .. 55    east wing: the food court and its fountain

export const GL = {
  bounds: { minX: -56, maxX: 56, minZ: -40, maxZ: 40 },
  wingX: 55,                   // inside face of the wings' end walls
  bldZ: 32,                    // inside face of the building's long walls
  up: 4.5,                     // upper concourse walking height
  slabY: 4.2,                  // underside of the upper floor
  roof: 9,                     // ceiling height (wings, upper level)
  vaultTop: 15.5,              // crown of the glass barrel vault
  atrium: { x0: -26, x1: 26, z0: -10, z1: 10 },   // open to the vault (the end decks fill |x| > 21.55 upstairs)
  rink: { x0: -13, x1: 13, z0: -6, z1: 6, board: 1.1, t: 0.2, gate: 2.4 },
  front: 16,                   // shop fronts at |z| = 16 (walls 16 .. 16.3)
  back: 28,                    // shop backs at |z| = 28 (walls 28 .. 28.3)
  units: [-32, -19.2, -6.4, 6.4, 19.2, 32],
  endX: 32,                    // the mall block ends at |x| = 32; wings beyond
  railH: 1.05,
  // escalator feet 1.7 m clear of the rink boards (x 13.1), so you can walk
  // round the rink end and step on
  esc: { width: 1.5, steps: 15, rise: 0.3, run: 0.45, z: 3.45, x0: 14.8 },
  bridges: { mid: 1.6, endIn: 21.55 },
  columns: { xs: [-20.7, -14, -7, 7, 14, 20.7], z: 10.45, size: 0.7 },
  garageDeck: 3.1,             // underside of the garage deck over the south strip
};

/* Shops. row -1 = north (z < 0), +1 = south. lvl "g" ground / "u" upper.
   doors: openings in the shop front ({x, w}); link: a doorway through a
   side wall ({side: "w"|"e"|"mid", z, w}); backDoor: a door through the
   back wall into the service corridor ({x, w}). Grand Lulz Cafe takes two
   units ("mid" = its own part wall). */
export const STORES = [
  // ---- ground floor, north
  { id: "tiffany", lvl: "g", row: -1, x0: -32, x1: -19.2, open: true, doors: [{ x: -25.6, w: 4 }], link: { side: "e", z: -24, w: 2 },
    name: "TROLLIFFANY & CO.", style: "serif", bg: "#0e2a2a", fg: "#86d8cf", theme: "jewel" },
  { id: "trapple", lvl: "g", row: -1, x0: -19.2, x1: -6.4, open: true, doors: [{ x: -16, w: 2.6 }, { x: -9.6, w: 2.6 }],
    name: "TRAPPLE", style: "logo", bg: "#f4f4f2", fg: "#1d1d1f", theme: "tech" },
  { id: "vuittroll", lvl: "g", row: -1, x0: -6.4, x1: 6.4, open: false,
    name: "LOUIS VUITTROLL", style: "serif-spaced", bg: "#3a2a1c", fg: "#e8d3a6", theme: "lux" },
  { id: "gamestonk", lvl: "g", row: -1, x0: 6.4, x1: 19.2, open: true, doors: [{ x: 12.8, w: 3 }], backDoor: { x: 16.6, w: 1.6 },
    name: "GAMESTONK", style: "bold", bg: "#d8202a", fg: "#ffffff", sub: "TO THE MOON", theme: "games" },
  { id: "trolllocker", lvl: "g", row: -1, x0: 19.2, x1: 32, open: true, doors: [{ x: 25.6, w: 3 }], link: { side: "e", z: -22, w: 2 },
    name: "TROLL LOCKER", style: "bold-stripe", bg: "#111111", fg: "#ffffff", stripe: "#e2231a", theme: "shoes" },
  // ---- ground floor, south (the north row turned 180°)
  { id: "htown", lvl: "g", row: 1, x0: -32, x1: -19.2, open: true, doors: [{ x: -25.6, w: 3 }], link: { side: "w", z: 22, w: 2 },
    name: "H-TOWN THREADS", style: "bold", bg: "#11223f", fg: "#f2a900", sub: "SPACE CITY FITS", theme: "sports" },
  { id: "sephtroll", lvl: "g", row: 1, x0: -19.2, x1: -6.4, open: true, doors: [{ x: -12.8, w: 3 }], backDoor: { x: -16.6, w: 1.6 },
    name: "SEPHTROLL", style: "spaced", bg: "#111111", fg: "#ffffff", theme: "beauty" },
  { id: "trolex", lvl: "g", row: 1, x0: -6.4, x1: 6.4, open: false,
    name: "TROLEX", style: "serif-spaced", bg: "#0b3b26", fg: "#d8c27a", theme: "lux" },
  { id: "grandlulz", lvl: "g", row: 1, x0: 6.4, x1: 32, open: true, doors: [{ x: 9.6, w: 2.6 }, { x: 16, w: 2.6 }, { x: 25.6, w: 4 }], link: { side: "mid", z: 24, w: 2 },
    name: "GRAND LULZ CAFE", style: "script", bg: "#2b1a12", fg: "#f3c46b", sub: "OPEN LATE · U MAD?", theme: "restaurant" },
  // ---- upper floor, north
  { id: "cheesecake", lvl: "u", row: -1, x0: -32, x1: -19.2, open: true, doors: [{ x: -25.6, w: 3 }],
    name: "THE CHEESECAKE TROLLERY", style: "script", bg: "#3b2a18", fg: "#f5d99a", theme: "cafe" },
  { id: "grucci", lvl: "u", row: -1, x0: -19.2, x1: -6.4, open: false,
    name: "GRUCCI", style: "serif-spaced", bg: "#141414", fg: "#d9c27a", theme: "lux" },
  { id: "brick", lvl: "u", row: -1, x0: -6.4, x1: 6.4, open: true, doors: [{ x: 0, w: 3 }],
    name: "BRICK PROBLEM", style: "bold", bg: "#f6c700", fg: "#d01012", sub: "THE BRICK STORE", theme: "toys" },
  { id: "cartroll", lvl: "u", row: -1, x0: 6.4, x1: 19.2, open: false,
    name: "CARTROLL", style: "serif", bg: "#5a0f16", fg: "#f3e2c0", theme: "lux" },
  { id: "hottrollpic", lvl: "u", row: -1, x0: 19.2, x1: 32, open: true, doors: [{ x: 25.6, w: 3 }],
    name: "HOT TROLLPIC", style: "grunge", bg: "#0d0d0d", fg: "#ff2d55", theme: "band" },
  // ---- upper floor, south
  { id: "lulzlemon", lvl: "u", row: 1, x0: -32, x1: -19.2, open: true, doors: [{ x: -25.6, w: 3 }],
    name: "LULZLEMON", style: "spaced", bg: "#c8102e", fg: "#ffffff", theme: "athletic" },
  { id: "zarg", lvl: "u", row: 1, x0: -19.2, x1: -6.4, open: false,
    name: "ZARG", style: "serif-spaced", bg: "#f2efe9", fg: "#111111", theme: "lux" },
  { id: "buildatroll", lvl: "u", row: 1, x0: -6.4, x1: 6.4, open: true, doors: [{ x: 0, w: 3 }],
    name: "BUILD-A-TROLL", style: "bold", bg: "#ffffff", fg: "#d6336c", sub: "WORKSHOP", theme: "plush" },
  { id: "prahaha", lvl: "u", row: 1, x0: 6.4, x1: 19.2, open: false,
    name: "PRAHAHA", style: "serif-spaced", bg: "#111111", fg: "#ffffff", theme: "lux" },
  { id: "trollbucks", lvl: "u", row: 1, x0: 19.2, x1: 32, open: true, doors: [{ x: 25.6, w: 3 }],
    name: "TROLLBUCKS RESERVE", style: "round", bg: "#0b3d2c", fg: "#e9f3ee", theme: "coffee" },
];

/* The two wings past the mall block: the department-store anchor and the
   food court. Each team spawns in one. */
export const WINGS = {
  west: { name: "NEIMAN NARCUS", style: "serif", bg: "#141414", fg: "#ffffff" },
  east: { name: "GRINLERIA EATS", style: "bold", bg: "#0f3b5a", fg: "#ffd166", sub: "FOOD COURT" },
};

/* Food court stalls along the east wing's long walls, with a walkway
   (x 44.9 .. 48.9) left for the street doors. */
export const STALLS = [
  { x0: 32.3, x1: 38.6, row: -1, name: "TRICK-FIL-A", bg: "#e51636", fg: "#ffffff" },
  { x0: 38.6, x1: 44.9, row: -1, name: "PANDEMONIUM EXPRESS", bg: "#c8102e", fg: "#ffd200" },
  { x0: 48.9, x1: 55, row: -1, name: "TACO TROLL", bg: "#5b2a86", fg: "#ffffff" },
  { x0: 32.3, x1: 38.6, row: 1, name: "WHATAGRINNER", bg: "#ff6a13", fg: "#ffffff", stripes: true },
  { x0: 38.6, x1: 44.9, row: 1, name: "GRINNABON", bg: "#14306b", fg: "#ffffff" },
  { x0: 48.9, x1: 55, row: 1, name: "SBARROLL", bg: "#1f7a3a", fg: "#ffffff" },
];

export const KIOSKS = [
  { x: -24, z: -13, name: "AUNTIE TROLL'S", sub: "PRETZELS", bg: "#1b5fa8", fg: "#ffffff", kind: "food" },
  { x: 10, z: -13, name: "CASE PROBLEM", sub: "PHONE CASES", bg: "#262626", fg: "#7fe066", kind: "phone" },
  { x: 24, z: 13, name: "SHADES OF TROLL", sub: "SUNGLASSES", bg: "#111111", fg: "#ffd166", kind: "shades" },
  { x: -10, z: 13, name: "SUGAR RUSH", sub: "CANDY", bg: "#ff5fa2", fg: "#ffffff", kind: "candy" },
];

/* Doors through the building's long walls (|z| = 32): the wings' street
   doors and the service corridors' fire exits. */
export const OUTER_DOORS = [
  { x: -46.9, w: 3, kind: "entrance" }, { x: 46.9, w: 3, kind: "entrance" }, { x: 0, w: 2, kind: "exit" },
];

/* ------------------------------------------------------------- the solids */

const r3 = (v) => Math.round(v * 1000) / 1000;

/* Box with its bottom at y, centred on x/z. `k` is the kind the Blender
   script draws; kinds starting "_" are drawn by their parent (or as part of
   the shell, the stairs...). `f` faces the model (radians about y, 0 = +z). */
function S(list, k, x, z, w, d, h, extra = {}) {
  list.push({ k, x: r3(x), z: r3(z), w: r3(w), d: r3(d), h: r3(h), y: 0, pen: 8, f: 0, ...extra });
}

/* A solid and its 180° twin. The twin is drawn as `alt` when given (the
   same box dressed for the other half's shop). */
function S2(list, k, x, z, w, d, h, extra = {}) {
  const { alt, ...rest } = extra;
  S(list, k, x, z, w, d, h, rest);
  S(list, alt || k, -x, -z, w, d, h, { ...rest, f: r3((rest.f ?? 0) + Math.PI) });
}

/* A wall run along x at z (or along z at x), from a to b, with openings. */
function wallRun(list, k, axis, at, a, b, t, h, y, holes = [], extra = {}) {
  let cur = a;
  const cuts = [...holes].sort((p, q) => p[0] - q[0]);
  for (const [h0, h1] of [...cuts, [b, b]]) {
    if (h0 - cur > 0.05) {
      const mid = (cur + h0) / 2, len = h0 - cur;
      if (axis === "x") S(list, k, mid, at, len, t, h, { y, ...extra });
      else S(list, k, at, mid, t, len, h, { y, ...extra });
    }
    cur = Math.max(cur, h1);
  }
}

export function grinleriaLayout() {
  const L = GL;
  const solids = [];
  const U = L.up, SY = L.slabY, WX = L.wingX, BZ = L.bldZ, B = L.bounds;
  const WT = 0.3;                         // shop wall thickness
  const SX = L.endX + WT;                 // the mall block's outer edge

  /* ---- the building shell and the map edge */
  for (const s of [-1, 1]) {
    S(solids, "_endwall", s * (WX + 0.5), 0, 1, 2 * BZ + 1, 10);                       // wing end walls
    const holes = OUTER_DOORS.map((d) => [s * d.x - d.w / 2, s * d.x + d.w / 2]);
    wallRun(solids, "_bldwall", "x", s * (BZ + 0.25), -WX - 1, WX + 1, 0.5, 10, 0, holes, { row: s });
    S(solids, "_edge", 0, s * (B.maxZ - 0.25), B.maxX * 2, 0.5, 6, { row: s });       // far side of the street / garage
  }

  /* ---- upper floor: a slab over each side (shops, concourse, service
     corridor), the mid bridge, the end decks over the atrium's ends, and
     the facades that close the upper level above the wing entrances */
  for (const row of [-1, 1]) {
    S(solids, "_slab", 0, row * (BZ + L.atrium.z1) / 2, 2 * SX, BZ - L.atrium.z1, 0.3, { y: SY, pen: 10 });
  }
  S(solids, "_bridge", 0, 0, 2 * L.bridges.mid, 2 * L.atrium.z1, 0.3, { y: SY, pen: 10 });
  for (const s of [-1, 1]) {
    const x0 = L.bridges.endIn, x1 = SX;
    S(solids, "_deck", s * (x0 + x1) / 2, 0, x1 - x0, 2 * L.atrium.z1, 0.3, { y: SY, pen: 10 });
    S(solids, "_facade", s * (L.endX + WT / 2), 0, WT, 2 * L.front, L.roof - U, { y: U, pen: 10 });
  }
  // the garage deck over the south strip, and the valet canopy's roof is art only
  S(solids, "_garagedeck", 0, (BZ + 0.5 + B.maxZ - 0.5) / 2, 2 * B.maxX, B.maxZ - BZ - 1, 0.4, { y: L.garageDeck, pen: 10 });

  /* ---- glass balustrades round the atrium hole */
  const RAIL = { y: U, pen: 0.3 };
  const rt = 0.1, rh = L.railH;
  for (const row of [-1, 1]) {
    const z = row * (L.atrium.z1 + rt / 2);
    for (const [a, b] of [[-L.bridges.endIn, -L.bridges.mid], [L.bridges.mid, L.bridges.endIn]]) {
      S(solids, "_rail", (a + b) / 2, z, b - a, rt, rh, RAIL);
    }
  }
  for (const s of [-1, 1]) {
    S(solids, "_rail", s * (L.bridges.mid - rt / 2), 0, rt, 2 * L.atrium.z1, rh, RAIL);
    // the end decks' inner edge, open where the escalators arrive
    const ex = s * (L.bridges.endIn + rt / 2);
    const e0 = L.esc.z - L.esc.width / 2 - 0.05, e1 = L.esc.z + L.esc.width / 2 + 0.05;
    for (const [a, b] of [[-L.atrium.z1, -e1], [-e0, e0], [e1, L.atrium.z1]]) {
      S(solids, "_rail", ex, (a + b) / 2, rt, b - a, rh, RAIL);
    }
  }

  /* ---- columns along the atrium edge, both floors */
  for (const x of L.columns.xs) for (const row of [-1, 1]) {
    const c = L.columns.size;
    S(solids, "column", x, row * L.columns.z, c, c, SY, { pen: 10 });
    S(solids, "_column_up", x, row * L.columns.z, c, c, L.roof - U, { y: U, pen: 10 });
  }

  /* ---- escalators: two at each end of the atrium, rising outward onto
     the end decks. Each is a stepped run like api.stairs, solid below. */
  const escalators = [];
  for (const s of [-1, 1]) for (const zs of [-1, 1]) {
    const E = L.esc;
    const z = zs * E.z;
    escalators.push({ x0: s * E.x0, z, dir: s, width: E.width, steps: E.steps, rise: E.rise, run: E.run, moving: zs * s < 0 ? "up" : "down" });
    for (let i = 0; i < E.steps; i++) {
      S(solids, "_step", s * (E.x0 + E.run * (i + 0.5)), z, E.run, E.width, E.rise * (i + 1), { pen: 6 });
    }
  }

  /* ---- the ice rink: dasher boards with four gates, the Trollboni, nets */
  const R = L.rink, g = R.gate / 2;
  for (const z of [R.z0, R.z1]) wallRun(solids, "_board", "x", z, R.x0, R.x1, R.t, R.board, 0, [[-g, g]], { pen: 2 });
  for (const x of [R.x0, R.x1]) wallRun(solids, "_board", "z", x, R.z0 + R.t / 2, R.z1 - R.t / 2, R.t, R.board, 0, [[-g, g]], { pen: 2 });
  S(solids, "zamboni", -2.5, 0, 3.8, 1.9, 2.1, { pen: 4, f: Math.PI / 2 });
  S2(solids, "goal", -11, 0, 1.1, 1.9, 1.2, { pen: 0.3, f: Math.PI / 2 });

  /* ---- atrium floor: planters by the escalators, benches round the rink */
  S2(solids, "planter", -17.6, -8.0, 2.6, 1.2, 0.9, { pen: 4 });
  S2(solids, "planter", 17.6, -8.0, 2.6, 1.2, 0.9, { pen: 4 });
  for (const x of [-9, -4.5, 4.5, 9]) S2(solids, "bench", x, -8.1, 2.2, 0.6, 0.48, { pen: 2 });

  /* ---- ground concourses and the cross-concourses at the block's ends */
  for (const k of KIOSKS) S(solids, "kiosk", k.x, k.z, 2.6, 1.4, 1.25, { pen: 3, name: k.name, f: k.z < 0 ? 0 : Math.PI });
  S2(solids, "massage", -6, -13.3, 2.4, 1.1, 1.3, { pen: 3 });
  S2(solids, "planter", 29.2, -13, 1.4, 2.6, 0.9, { pen: 4 });
  S2(solids, "infodesk", -29, 0, 1.6, 3.2, 1.1, { pen: 3, f: Math.PI / 2 });

  /* ---- upper concourses and end decks */
  const UY = { y: U };
  S2(solids, "planter", -10.5, -14.6, 2.4, 1.0, 0.9, { ...UY, pen: 4 });
  S2(solids, "photobooth", 3.8, -14.7, 1.7, 1.2, 2.2, { ...UY, pen: 3 });
  S2(solids, "kiddieride", -17, -14.2, 1.3, 1.9, 1.3, { ...UY, pen: 3 });
  S2(solids, "bench", -23, -14.9, 2.2, 0.6, 0.48, { ...UY, pen: 2 });
  S2(solids, "lounge", 28.5, -5, 1.0, 2.6, 0.85, { ...UY, pen: 2, f: -Math.PI / 2 });
  S2(solids, "planter", 24.5, -8.6, 2.4, 1.0, 0.9, { ...UY, pen: 4 });

  /* ---- shop shells: fronts with doors, dividers, the back wall onto the
     service corridor (ground) / the plant space (upper) */
  for (const lvl of ["g", "u"]) {
    const y = lvl === "g" ? 0 : U;
    const h = lvl === "g" ? SY : L.roof - U;
    for (const row of [-1, 1]) {
      const shops = STORES.filter((s) => s.lvl === lvl && s.row === row);
      for (const st of shops) {
        const holes = (st.doors || []).map((d) => [d.x - d.w / 2, d.x + d.w / 2]);
        // glass: rounds go through (an open shop's front more easily
        // than a closed one, which has its shutter down behind the glass)
        wallRun(solids, "_front", "x", row * (L.front + WT / 2), st.x0, st.x1, WT, h, y, holes, { store: st.id, row, lvl, pen: st.open ? 1.2 : 3 });
      }
      const backHoles = shops.filter((s) => s.backDoor).map((s) => [s.backDoor.x - s.backDoor.w / 2, s.backDoor.x + s.backDoor.w / 2]);
      wallRun(solids, "_back", "x", row * (L.back + WT / 2), -SX, SX, WT, h, y, backHoles, { row, lvl });
      const z0 = L.front + WT, z1 = L.back;
      for (const x of L.units) {
        const ends = Math.abs(x) === L.endX;
        const wx = ends ? Math.sign(x) * (L.endX + WT / 2) : x;
        // a doorway through this wall? ("mid": Grand Lulz Cafe's own part
        // wall, which falls on the unit line between its two units)
        let hole = null;
        for (const st of shops) {
          if (!st.link) continue;
          const edgeX = st.link.side === "e" ? st.x1 : st.link.side === "w" ? st.x0 : (st.x0 + st.x1) / 2;
          if (Math.abs(edgeX - x) < 0.01) hole = st.link;
        }
        const zA = Math.min(row * z0, row * z1), zB = Math.max(row * z0, row * z1);
        const holes = hole ? [[hole.z - hole.w / 2, hole.z + hole.w / 2]] : [];
        wallRun(solids, "_divider", "z", wx, zA, zB, WT, h, y, holes, { row, lvl });
      }
      // service corridor ends: a door into each wing
      if (lvl === "g") {
        for (const s of [-1, 1]) {
          const cz0 = L.back + WT, cz1 = BZ, mid = row * (cz0 + cz1) / 2;
          const zA = Math.min(row * cz0, row * cz1), zB = Math.max(row * cz0, row * cz1);
          wallRun(solids, "_corridorend", "z", s * (L.endX + WT / 2), zA, zB, WT, SY, 0, [[mid - 1, mid + 1]], { row });
        }
      }
    }
  }
  /* ---- shop interiors (written for the north shop; S2 adds its twin in
     the south shop it turns into, dressed as `alt`) */
  // Trolliffany (N0) <-> Grand Lulz east half
  S2(solids, "case", -25.6, -21.2, 3.2, 0.9, 1.0, { pen: 2, alt: "hoststand" });
  S2(solids, "case", -30.2, -22.5, 0.9, 3.0, 1.0, { pen: 2, alt: "booth" });
  S2(solids, "case", -21.4, -21.6, 0.9, 3.0, 1.0, { pen: 2, alt: "booth" });
  S2(solids, "backcase", -25.6, -27.2, 6, 0.8, 1.05, { pen: 3, alt: "pass" });
  // Trapple (N1) <-> Grand Lulz west half
  S2(solids, "ptable", -16, -22.2, 1.2, 3.6, 0.9, { pen: 2, alt: "booths" });
  S2(solids, "ptable", -9.6, -22.2, 1.2, 3.6, 0.9, { pen: 2, alt: "booths" });
  S2(solids, "genius", -12.8, -27.2, 7, 0.8, 1.05, { pen: 3, alt: "bar" });
  // GameStonk (N3) <-> Sephtroll (S1)
  S2(solids, "shelf", 7.0, -22.4, 0.6, 5, 2.0, { pen: 2, alt: "makeupwall" });
  S2(solids, "shelf", 10.6, -27.4, 6.4, 0.6, 2.0, { pen: 2, alt: "makeupwall" });
  S2(solids, "gondola", 13.4, -22.6, 3.2, 1.0, 1.5, { pen: 2, alt: "makeupgondola" });
  S2(solids, "demo", 9.8, -19.4, 2.0, 0.8, 1.3, { pen: 2, alt: "testerbar" });
  // Troll Locker (N4) <-> H-Town Threads (S0)
  S2(solids, "shoewall", 19.8, -22.4, 0.6, 5, 2.0, { pen: 2, alt: "jerseywall" });
  S2(solids, "shoewall", 25.6, -27.4, 8, 0.6, 2.0, { pen: 2, alt: "jerseywall" });
  S2(solids, "bench", 25.6, -21.8, 3.0, 0.6, 0.45, { pen: 2, alt: "tshirts" });
  S2(solids, "shoeplinth", 29.6, -19.6, 1.4, 1.4, 1.1, { pen: 2, alt: "roundrack" });

  // upper: Cheesecake Trollery (UN0) <-> Trollbucks Reserve (US4)
  for (const [x, z] of [[-28.6, -20], [-22.6, -20], [-28.6, -24], [-22.6, -24]]) S2(solids, "table4", x, z, 1.2, 1.2, 0.78, { ...UY, pen: 2, alt: "cafetable" });
  S2(solids, "dessert", -25.6, -27.2, 6, 0.8, 1.1, { ...UY, pen: 3, alt: "coffeebar" });
  // Brick Problem (UN2) <-> Build-A-Troll (US2)
  S2(solids, "bin", -3, -20.8, 1.4, 1.4, 1.0, { ...UY, pen: 2, alt: "plushbin" });
  S2(solids, "bin", 3, -20.8, 1.4, 1.4, 1.0, { ...UY, pen: 2, alt: "plushbin" });
  S2(solids, "statue", 0, -24, 1.4, 1.4, 2.4, { ...UY, pen: 4, alt: "stuffer" });
  S2(solids, "brickwall", 0, -27.4, 10, 0.6, 2.0, { ...UY, pen: 2, alt: "plushwall" });
  // Hot Trollpic (UN4) <-> Lulzlemon (US0)
  S2(solids, "roundrack", 22.6, -21, 1.4, 1.4, 1.45, { ...UY, pen: 0.6, alt: "roundrack" });
  S2(solids, "roundrack", 28.6, -21, 1.4, 1.4, 1.45, { ...UY, pen: 0.6, alt: "roundrack" });
  S2(solids, "tshirtwall", 25.6, -27.4, 8, 0.6, 2.0, { ...UY, pen: 2, alt: "yogawall" });
  S2(solids, "counter", 25.6, -24.2, 2.4, 0.8, 1.05, { ...UY, pen: 3, alt: "counter" });

  /* ---- service corridors: carts and stock, on the way through */
  S2(solids, "boxes", -24, -30.4, 1.4, 1.2, 1.3, { pen: 2 });
  S2(solids, "cart", -8, -30.9, 1.4, 0.8, 1.1, { pen: 1.5 });
  S2(solids, "boxes", 8, -30.3, 1.2, 1.4, 1.5, { pen: 2 });
  S2(solids, "cart", 24, -30.9, 1.4, 0.8, 1.1, { pen: 1.5 });

  /* ---- west wing: Neiman Narcus */
  S(solids, "beauty", -38, 0, 3.6, 3.6, 1.05, { pen: 3 });
  S(solids, "_pillar", -38, 0, 0.9, 0.9, 3.6, { pen: 6 });
  for (const s of [-1, 1]) {
    for (const [x, z] of [[-42.6, 4.6], [-36, 11.6], [-41.4, 16], [-46.8, 10.4]]) S(solids, "roundrack", x, s * z, 1.4, 1.4, 1.45, { pen: 0.6 });
    S(solids, "mannequins", -35, s * 21.6, 1.2, 3.6, 0.35, { pen: 4 });
    for (const dz of [-1.1, 0, 1.1]) S(solids, "_mannequin", -35, s * 21.6 + dz, 0.5, 0.5, 1.85, { y: 0.35, pen: 0.5 });
    S(solids, "displaytable", -41, s * 22.6, 2.2, 1.1, 0.9, { pen: 2 });
    S(solids, "cashwrap", -47.6, s * 20.6, 3.0, 1.2, 1.05, { pen: 3, f: s < 0 ? 0 : Math.PI });
    // fitting rooms in the corner by the service corridor's door
    const fz0 = s * 25.6, fz1 = s * BZ;                     // the block's front at |z| 25.6
    wallRun(solids, "_fitting", "x", fz0, -40.4, -32.3, 0.15, 2.5, 0, [[-38.6, -37.0]], { row: s });
    wallRun(solids, "_fitting", "z", -40.4, Math.min(fz0, fz1), Math.max(fz0, fz1), 0.15, 2.5, 0, [], { row: s });
    for (const x of [-35.4, -38.4]) {
      // cubicle partitions off the aisle (the aisle runs along |z| 26..27.4)
      const a = s * 27.4, b = s * BZ;
      S(solids, "_fitting", x, (a + b) / 2, 0.1, Math.abs(b - a), 2.3, { pen: 1, row: s });
    }
    S(solids, "fitting", -36.4, s * 28.8, 8.1, 6.4, 0, { pen: 0, row: s, ghost: true });      // art anchor only
    // shoe salon wall + seats along the far wall
    S(solids, "shoewall", -54.6, s * 6, 0.6, 7, 2.0, { pen: 2, f: Math.PI / 2 });
    S(solids, "ottoman", -49.5, s * 12.5, 1.1, 1.1, 0.45, { pen: 2 });
  }

  /* ---- east wing: the food court round Trollface Falls */
  // octagonal basin as three boxes (a cross plus a square): walkable rim
  // height, you can hop in for a splash
  const FX = 44;
  S(solids, "fountain", FX, 0, 7, 2.9, 0.55, { pen: 6 });
  S(solids, "_fountain", FX, 0, 2.9, 7, 0.55, { pen: 6 });
  S(solids, "_fountain", FX, 0, 5, 5, 0.55, { pen: 6 });
  // Trollface Falls: a mossy rock grotto in the pool, the trollface carved
  // in stone on top looking back down the mall, a waterfall out of the
  // cleft beside it, ferns and palms (models/build_grinleria.blender.py)
  S(solids, "falls", FX + 1.4, 0, 2.6, 4.6, 2.7, { y: 0.55, pen: 10 });
  S(solids, "_head", FX + 1.3, 0.3, 1.0, 2.6, 2.4, { y: 3.25, pen: 10 });
  S(solids, "palmbed", FX + 5.6, 0, 1.4, 3.2, 0.9, { pen: 4 });
  for (const st of STALLS) {
    const cx = (st.x0 + st.x1) / 2, w = st.x1 - st.x0;
    S(solids, "stall", cx, st.row * 27.6, w - 0.8, 0.8, 1.05, { pen: 3, name: st.name, f: st.row < 0 ? 0 : Math.PI });
    S(solids, "_kitchen", cx, st.row * 31.4, w - 0.8, 0.9, 0.95, { pen: 3, row: st.row });
  }
  for (const s of [-1, 1]) {
    for (const x of [38.6, 44.9, 48.9]) S(solids, "_stallwall", x, s * 30, 0.25, 4, 3.6, { pen: 6 });
  }
  for (const [x, z] of [[36.5, 5], [36.5, 11], [40.5, 13], [44.5, 13], [48.5, 13], [36.5, 18.5], [41.5, 20], [46.5, 20]]) {
    for (const s of [-1, 1]) S(solids, "fctable", x, s * z, 1.1, 1.1, 0.76, { pen: 1.5 });
  }
  for (const s of [-1, 1]) {
    S(solids, "hightop", 34.8, s * 1.8, 0.9, 0.9, 1.1, { pen: 1.5 });
    S(solids, "planter", FX, s * 7.6, 3.0, 1.0, 0.9, { pen: 4 });
    S(solids, "hightop", 52.4, s * 11.6, 0.9, 0.9, 1.1, { pen: 1.5 });
  }

  /* ---- outside, north: the valet drive (and turned round, the garage) */
  for (const x of [-34, -6, 14, 30]) S2(solids, "car", x, -37.4, 4.0, 2.0, 1.4, { pen: 2, f: Math.PI / 2, alt: "garagecar" });
  for (const x of [-36, -20, -6.5, 6.5, 20, 36]) S2(solids, "palmplanter", x, -33.6, 1.4, 1.4, 0.7, { pen: 4, alt: "barrier" });
  for (const [x, z] of [[42.9, -34.4], [50.9, -34.4], [42.9, -38.8], [50.9, -38.8], [-50.9, -34.4], [-42.9, -34.4], [-50.9, -38.8], [-42.9, -38.8]]) {
    S2(solids, "canopycol", x, z, 0.5, 0.5, 4.6, { pen: 8, alt: "garagecol" });
  }
  S2(solids, "valet", -27, -34.2, 1.0, 0.8, 1.2, { pen: 2, alt: "paystation" });
  S2(solids, "monument", -13, -34.4, 5, 0.8, 2.2, { pen: 8, alt: "garagesign" });

  /* ---- point lights (few: every lit pixel loops over all of them) */
  const lights = [
    // ground concourses, under the slab
    ...[-21, 0, 21].flatMap((x) => [[x, 3.7, -13], [-x, 3.7, 13]]),
    // the service corridors
    [-14, 3.6, -30.2], [14, 3.6, 30.2],
    // the wings
    [-43, 7.6, -14], [-43, 7.6, 14], [43, 7.6, -14], [43, 7.6, 14],
    // the garage
    [-20, 2.6, 36], [20, 2.6, 36],
    // a warm wash on the carved trollface at the falls
    [41.6, 5.4, 0.6],
  ].map(([x, y, z]) => ({ x, y, z }));

  // West team: four in Neiman Narcus, one outside each street door (under
  // the valet canopy, in the garage); east the same turned round.
  const west = [[-51, -6], [-51, 6], [-51, -17], [-51, 17], [-46.9, -36.4], [-46.9, 36.4]];
  const spawns = [...west, ...west.map(([x, z]) => [-x, -z])];

  return { solids: solids.filter((s) => !s.ghost), anchors: solids.filter((s) => s.ghost), escalators, lights, spawns };
}
