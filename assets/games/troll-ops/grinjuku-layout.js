// Troll Forces — "Grinjuku" layout: the one source of truth for the
// Shinjuku map's shape (after VALORANT's Split).
//
// grinjuku.js turns `solids` into colliders (and stairs, ropes, lights);
// models/build_grinjuku.blender.py reads the same data, dumped to
// models/grinjuku-layout.json by tools/troll-ops-grinjuku-layout.mjs, and
// draws a model to fit every solid by its kind. Change the layout here,
// re-dump, re-run Blender: colliders and art can't drift apart.
//
// No imports on purpose (node loads this file for the dump).
//
// Game coordinates: x east, y up, z south, metres. 64 x 84 m, mirrored
// east-west (A is west, B is east). Attackers spawn north, defenders south
// (S&D puts attackers on the low-z half: modes/spawns.js).
//
//   z -42 .. -32   attacker spawn: the station forecourt
//   z -32 ..  -8   three lanes: A Main (west), Mid Top, B Main (east)
//   z  -8 ..   4   the links: Sewers (west), Mid Mail, Vents (east)
//   z   4 ..  24   A site | A Heaven | Mid Bottom | B Heaven | B site
//   z  24 ..  42   the backs and the defender spawn under the rail line
//
// Each Heaven is a terrace 3 m up between its site and mid, reached by a
// stair from the backs, a rope from mid (the rope rooms) and a rope up the
// site face.

export const GJ = {
  bounds: { minX: -32, maxX: 32, minZ: -42, maxZ: 42 },
  heaven: 3.0,                 // terrace walking height
  block: 8,                    // height of the buildings that make the lanes
  lane: { x0: -31.7, x1: -23 },                 // A Main (B mirrored)
  mid: { x0: -7, x1: 7 },
  links: { z0: -8, z1: 4 },
  heavenX: { x0: -14, x1: -6 },                 // A Heaven (B mirrored)
  heavenZ: { z0: 4, z1: 24 },
  shaft: { x0: -10, x1: -6, z0: 8, z1: 11.6 },  // the mid rope room (B mirrored)
  sewer: { z0: -5, z1: -1, ceil: 2.6 },
  vent: { z0: -4, z1: -2, ceil: 2.4 },
  mail: { x0: -7, x1: 7, z0: -8, z1: 4, wall: 0.4, ceil: 3.4, top: 7 },
  sites: [{ id: "A", x: -22, z: 15 }, { id: "B", x: 22, z: 15 }],
};

/* ------------------------------------------------------------- the solids */

const r3 = (v) => Math.round(v * 1000) / 1000;

/* Box with its bottom at y, centred on x/z. `k` is the kind the Blender
   script draws; kinds starting "_" are drawn by their parent (or as part
   of the shell). `f` faces the model (radians about y, 0 = +z). */
function S(list, k, x, z, w, d, h, extra = {}) {
  list.push({ k, x: r3(x), z: r3(z), w: r3(w), d: r3(d), h: r3(h), y: 0, pen: 8, f: 0, ...extra });
}

/* A solid and its east-west mirror (A side -> B side). The twin is drawn
   as `alt` when given. */
function M(list, k, x, z, w, d, h, extra = {}) {
  const { alt, ...rest } = extra;
  S(list, k, x, z, w, d, h, { ...rest, side: "A" });
  S(list, alt || k, -x, z, w, d, h, { ...rest, side: "B", f: r3(-(rest.f ?? 0)) });
}

/* Box from corner to corner (x0..x1, z0..z1), mirrored. */
function MR(list, k, x0, x1, z0, z1, h, extra = {}) {
  M(list, k, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h, extra);
}

/* A wall run along x at z (or along z at x), from a to b, with doorways
   [h0, h1, top]. Each doorway gets a lintel from `top` up to the wall's
   full height, so a door never leaves a slot open to the sky. */
function wallRun(list, k, axis, at, a, b, t, h, holes = [], extra = {}, mirror = false) {
  const put = mirror ? M : S;
  let cur = a;
  const cuts = [...holes].sort((p, q) => p[0] - q[0]);
  for (const [h0, h1, top] of [...cuts, [b, b, 0]]) {
    if (h0 - cur > 0.05) {
      const mid = (cur + h0) / 2, len = h0 - cur;
      if (axis === "x") put(list, k, mid, at, len, t, h, extra);
      else put(list, k, at, mid, t, len, h, extra);
    }
    if (h1 > h0 && top < h) {
      const mid = (h0 + h1) / 2, len = h1 - h0;
      if (axis === "x") put(list, "_lintel", mid, at, len, t, h - top, { ...extra, y: top });
      else put(list, "_lintel", at, mid, t, len, h - top, { ...extra, y: top });
    }
    cur = Math.max(cur, h1);
  }
}

export function grinjukuLayout() {
  const L = GJ, B = L.bounds, H = L.heaven, BH = L.block;
  const solids = [];

  /* ---- the map edge: shopfronts and the station on every side */
  S(solids, "_edge", 0, B.minZ - 0.1, 2 * B.maxX + 1, 0.8, BH, { pen: 20 });
  S(solids, "_edge", 0, B.maxZ + 0.1, 2 * B.maxX + 1, 0.8, BH, { pen: 20 });
  M(solids, "_edge", B.minX - 0.1, 0, 0.8, 2 * B.maxZ + 1, BH, { pen: 20 });

  /* ---- the lanes: two city blocks between A Main, Mid Top and B Main */
  MR(solids, "block", -23, -7, -32, -8, BH, { pen: 20 });

  /* ---- the links. West: the Sewers, a culvert under the street (ceiling
     2.6 m). East: the Vents, a service duct 2 m wide. Both are lit,
     walkable by bots (over the nav's 2.2 m) and open into Mid Mail. */
  const sw = L.sewer, vt = L.vent;
  S(solids, "block", -15, (L.links.z0 + sw.z0) / 2, 16, sw.z0 - L.links.z0, BH, { pen: 20, side: "A" });
  S(solids, "block", -15, (sw.z1 + L.links.z1) / 2, 16, L.links.z1 - sw.z1, BH, { pen: 20, side: "A" });
  S(solids, "sewer", -15, (sw.z0 + sw.z1) / 2, 16, sw.z1 - sw.z0, BH - sw.ceil, { y: sw.ceil, pen: 20, side: "A" });
  S(solids, "block", 15, (L.links.z0 + vt.z0) / 2, 16, vt.z0 - L.links.z0, BH, { pen: 20, side: "B" });
  S(solids, "block", 15, (vt.z1 + L.links.z1) / 2, 16, L.links.z1 - vt.z1, BH, { pen: 20, side: "B" });
  S(solids, "vent", 15, (vt.z0 + vt.z1) / 2, 16, vt.z1 - vt.z0, BH - vt.ceil, { y: vt.ceil, pen: 20, side: "B" });

  /* ---- Mid Mail: the post office in the middle. Doors north (west of
     centre) and south (east of centre) so mid has no straight sightline;
     side doors to the Sewers and the Vents. Ceiling at 3.4, roof to 7. */
  const ml = L.mail, mt = ml.wall;
  wallRun(solids, "mailwall", "x", ml.z0 + mt / 2, ml.x0, ml.x1, mt, ml.top, [[-4, -1, 2.8]]);
  wallRun(solids, "mailwall", "x", ml.z1 - mt / 2, ml.x0, ml.x1, mt, ml.top, [[1, 4, 2.8]]);
  wallRun(solids, "mailwall", "z", ml.x0 + mt / 2, ml.z0 + mt, ml.z1 - mt, mt, ml.top, [[-4.2, -1.8, sw.ceil]]);
  wallRun(solids, "mailwall", "z", ml.x1 - mt / 2, ml.z0 + mt, ml.z1 - mt, mt, ml.top, [[vt.z0, vt.z1, vt.ceil]]);
  S(solids, "_mailroof", 0, (ml.z0 + ml.z1) / 2, ml.x1 - ml.x0, ml.z1 - ml.z0, ml.top - ml.ceil, { y: ml.ceil, pen: 20 });
  S(solids, "counter", 0, -3.2, 5, 0.9, 1.1, { pen: 3 });
  S(solids, "sorting", -4.6, 1.6, 2.4, 1.4, 1.5, { pen: 2 });
  S(solids, "parcels", 4.8, -6.4, 1.6, 1.2, 1.2, { pen: 2 });

  /* ---- the Heavens. A terrace block 3 m up between each site and mid:
     solid underneath, an open shaft over the mid rope room, a tall wall on
     the mid side (Heaven watches its site, not mid), parapets elsewhere
     with gaps for the stair and the site rope. */
  const hx = L.heavenX, hz = L.heavenZ, sh = L.shaft;
  MR(solids, "terrace", hx.x0, hx.x1, sh.z1, hz.z1, H, { pen: 20 });          // under the main deck
  MR(solids, "terrace", hx.x0, sh.x0, hz.z0, sh.z1, H, { pen: 20 });          // west of the shaft
  MR(solids, "terrace", sh.x0, hx.x1, hz.z0, sh.z0, H, { pen: 20 });          // north of the shaft
  MR(solids, "heavenwall", hx.x1 - 0.3, hx.x1, hz.z0, hz.z1, 3.2, { y: H, pen: 20 });
  // site-side parapet, a gap at z 17 .. 19 for the site rope
  wallRun(solids, "parapet", "z", hx.x0 + 0.15, hz.z0, hz.z1, 0.3, 1.0, [[17, 19, 9]], { y: H, pen: 4 }, true);
  // back parapet, a gap at x -13 .. -11 for the stair
  wallRun(solids, "parapet", "x", hz.z1 - 0.15, hx.x0 + 0.3, hx.x1 - 0.3, 0.3, 1.0, [[-13, -11, 9]], { y: H, pen: 4 }, true);
  MR(solids, "parapet", hx.x0 + 0.3, hx.x1 - 0.3, hz.z0, hz.z0 + 0.3, 1.0, { y: H, pen: 4 });
  // rails round the shaft (north and west; south is where the rope tops out)
  MR(solids, "_rail", sh.x0, sh.x1 - 0.3, sh.z0 - 0.3, sh.z0, 1.0, { y: H, pen: 1 });
  MR(solids, "_rail", sh.x0 - 0.3, sh.x0, sh.z0, sh.z1, 1.0, { y: H, pen: 1 });
  // terrace furniture: a water tank and AC units to play round
  MR(solids, "tank", -8.4, -7, 19, 22.4, 1.6, { y: H, pen: 6 });
  MR(solids, "acunit", -12.6, -11.2, 13.6, 14.8, 1.1, { y: H, pen: 3 });

  /* ---- the sites */
  // A Ramps: a 0.9 m loading deck against the block, steps on its west
  MR(solids, "deck", -23, -17, 4, 7.5, 0.9, { pen: 6 });
  MR(solids, "stall", -28.2, -25.8, 17.2, 18.8, 1.3, { pen: 3 });             // takoyaki stall
  MR(solids, "kiosk", -21.5, -18.5, 20.7, 22.3, 2.2, { pen: 6 });             // shuttered kiosk
  MR(solids, "vending", -31.6, -30.7, 9, 11, 1.9, { pen: 3, f: Math.PI / 2 });
  MR(solids, "crates", -16.4, -15, 9.4, 11.2, 1.2, { pen: 2 });
  MR(solids, "bikes", -31.6, -30.8, 22, 26, 1.0, { pen: 0.6, f: Math.PI / 2 });

  /* ---- the lanes' cover */
  MR(solids, "truck", -28.6, -26.6, -21, -16.6, 1.7, { pen: 4 });             // kei truck in A Main
  MR(solids, "crates", -31.6, -29.8, -6, -3.6, 1.3, { pen: 2 });
  MR(solids, "vending", -23.9, -23, -14, -12, 1.9, { pen: 3, f: -Math.PI / 2 });
  S(solids, "planter", -3, -21.5, 1.6, 3, 1.1, { pen: 4 });                   // Mid Top
  S(solids, "planter", 3, -14.5, 1.6, 3, 1.1, { pen: 4 });
  for (const x of [-2.6, 2.6]) S(solids, "_torii", x, -28.5, 0.6, 0.6, 4.6, { pen: 6 });
  S(solids, "torii", 0, -28.5, 7, 0.6, 0.6, { y: 4.2, pen: 6 });
  S(solids, "planter", -2.5, 12, 1.6, 3, 1.1, { pen: 4 });                    // Mid Bottom
  S(solids, "planter", 2.5, 17.5, 1.6, 3, 1.1, { pen: 4 });

  /* ---- the backs and the defender spawn */
  MR(solids, "crates", -27, -25, 27, 29, 1.2, { pen: 2 });
  MR(solids, "konbini", -24, -18, 31, 33, 3.0, { pen: 8 });
  S(solids, "koban", 0, 31.5, 4, 2, 2.6, { pen: 8 });
  // the rail viaduct's piers along the south edge
  for (const x of [-24, -8, 8, 24]) S(solids, "pier", x, 40.8, 1.6, 1.6, BH, { pen: 20 });

  /* ---- the attacker spawn: the station forecourt */
  MR(solids, "shelter", -20, -14, -35.5, -34.5, 2.4, { pen: 2 });
  for (const x of [-24, -8, 8, 24]) S(solids, "pier", x, -40.8, 1.6, 1.6, BH, { pen: 20 });

  /* ---- stairs: back street -> Heaven (each 10 x 0.3 m, the top tread
     flush with the terrace at z 24) */
  const stairs = [];
  for (const s of [-1, 1]) stairs.push({ x: s * 12, z: 30, width: 2, steps: 10, rise: 0.3, run: 0.6, dir: "-z", side: s < 0 ? "A" : "B" });
  // A Ramps' steps, up the deck's west end
  for (const s of [-1, 1]) stairs.push({ x: s * 24.5, z: 5.75, width: 3.5, steps: 3, rise: 0.3, run: 0.5, dir: s < 0 ? "+x" : "-x", side: s < 0 ? "A" : "B" });

  /* ---- ropes: `dir` is the side you step off onto at the top; the
     climber hangs on the other side of the rope */
  const ropes = [];
  for (const s of [-1, 1]) {
    const side = s < 0 ? "A" : "B";
    ropes.push({ id: `${side.toLowerCase()}-mid`, x: s * 9, z: 11.2, y0: 0, y1: H, dir: "+z", side });
    ropes.push({ id: `${side.toLowerCase()}-site`, x: s * 14.4, z: 18, y0: 0, y1: H, dir: s < 0 ? "+x" : "-x", side });
  }

  /* ---- point lights (few: every lit pixel loops over all of them), each
     the colour of the neon nearest it: [x, y, z, colour, intensity, reach] */
  const lights = [
    [-22, 4.5, 12, 0xff6ab8, 16, 17], [22, 4.5, 12, 0x6ad8ff, 16, 17],    // the sites
    [-9, 4.4, 18, 0xffc890, 9, 12], [9, 4.4, 18, 0xffc890, 9, 12],        // the Heavens
    [-8, 2.4, 9.8, 0xcfe0ff, 6, 7], [8, 2.4, 9.8, 0xcfe0ff, 6, 7],        // the rope rooms
    [0, 2.8, -2, 0xf2f4ff, 8, 12],                                        // Mid Mail
    [-15, 2.2, -3, 0x9ad8c0, 10, 13], [15, 2.1, -3, 0xb8c8ff, 10, 13],    // Sewers, Vents
    [0, 4.5, -36, 0xffd8a0, 16, 22], [0, 4.5, 36, 0xffd8a0, 16, 22],      // the spawns
    [0, 4.6, 12, 0xff9a6a, 10, 14],                                       // Mid Bottom's lanterns
  ].map(([x, y, z, color, intensity, distance]) => ({ x, y, z, color, intensity, distance }));

  const xs = [-14, -10, -6, -2, 2, 6, 10, 14];
  const spawns = [...xs.map((x) => [x, -37.5]), ...xs.map((x) => [x, 37])];

  return { solids, stairs, ropes, lights, spawns, sites: L.sites.map((s) => ({ ...s })) };
}
