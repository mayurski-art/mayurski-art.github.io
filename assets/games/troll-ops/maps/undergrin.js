// Troll Forces: Undergrin, the Metro (2025) station. The playable layout:
// every collider and stairs link (buildUndergrinParts), and the seven
// ug-*.glb that draw it (models/build_undergrin.blender.py, from this
// file's numbers through tools/troll-ops-undergrin-layout.mjs and
// models/undergrin-layout.json: the build refuses to export when this file
// has moved on since the dump). Doc: Troll Forces: Undergrin in Blender.
// Moved out of maps.js in phase 0 (2026-10-27), unchanged.

import { mapModel } from "./map-models.js?v=hg6e-sr1-or1-tx1-sp1-kbt1-gb1-kbb2-kbs1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-ugb1-ug1";
import { UG_PROPS } from "./undergrin-props.js?v=ugp1-ug1-ug2";
import { buildUndergrinSigns } from "./undergrin-signs.js?v=ugs1-ug1-ug2";

/* Undergrin (2026-10-15): a Phantom Forces "Metro (2025)" station in the
   modded full-bright look, UNDERGRIN-METRO.md. Every number here is the
   doc's (section 4); models/build_undergrin.blender.py draws the same
   numbers, so a change here is a change there. Three levels: track T at 0,
   platform P at 0.95 (bots vault it, players jump or take the end steps),
   concourse U at 6.0 on a 0.4 slab. The south half is the north half turned
   180 degrees about the origin (station(-1) below), so both teams get the
   same map. Flat colours only and no api.lamp: the look is the ambient. */
/* The occlusion bake's strength (models/bake_undergrin_ao.blender.py, the
   ug-*-ao.webp atlases; doc decision 1): 0 is the pure flat full-bright
   station, 1 the full bake. The user picks it on side-by-side shots. */
export const UG_AO = 0.4;

/* The walk-in Fotoautomat in each hall (north half's numbers; the south's
   is turned 180 degrees about the origin): its outer walls, the doorway on
   its south face. UG_BOOTHS: where Socialize's photo booth
   (modes/photo-booth.js) takes your pictures, per half: the floor inside,
   the camera in the back wall and where it looks, the spot you stand on
   (the footprints, a metre from the lens) and the way it faces. */
export const UG_BOOTH = { x0: -7.6, x1: -5.2, z0: -21.2, z1: -19.0, door0: -7.45, door1: -6.3 };
export const UG_BOOTHS = [1, -1].map((s) => {
  const B = UG_BOOTH, U = 6.0, cx = (B.x0 + B.x1) / 2;
  const P = (x, y, z) => [s * x, y, s * z];
  const xs = [s * (B.x0 + 0.08), s * (B.x1 - 0.08)].sort((a, b) => a - b);
  const zs = [s * (B.z0 + 0.08), s * (B.z1 - 0.08)].sort((a, b) => a - b);
  return {
    id: s > 0 ? "north" : "south", floor: U,
    x0: xs[0], x1: xs[1], z0: zs[0], z1: zs[1],
    cam: P(cx, U + 1.62, B.z0 + 0.12), look: P(cx, U + 1.48, B.z1),
    spot: P(cx, U, B.z0 + 1.2), yaw: s > 0 ? 0 : Math.PI,
  };
});

export const UG = {
  wall: 0xe6e4df, floor: 0xececea, band: 0xc9704e, stripe: 0x2f5fd0, zone: 0xe5b84a, platform: 0xe8e6e0,
  grey: 0x8a8d92, dark: 0x3e4146, train: 0xf2c230, trainBand: 0x1e1e22, trainDoor: 0xf4f4f0, seat: 0x2b4bd6,
  bench: 0x2d50d8, escSide: 0x7a5a3a, nosing: 0xe8ad22, glass: 0x2a3340, mullion: 0xc8c8c4, brick: 0x8c4a3a,
  exit: 0x38d060, board: 0xff8a1e, boardPink: 0xff3fa4, purple: 0x8a3fc8, red: 0xc8302a,
};

/* Undergrin's colliders are the walk-tested blockout's (~1,100 boxes); what
   you see is the ug-*.glb set (models/build_undergrin.blender.py, the same
   numbers). The build runs against a stand-in api whose box, cylinder and
   stairs keep only the colliders and stair links, then drops in the models:
   no shadows anywhere (the map has no sun). */
export function buildUndergrin(api) {
  const solid = Object.create(api), realBox = api.box;
  solid.box = (x, z, w, d, h, opts = {}) => api.ghostBox(x, z, w, d, h, { y: opts.y ?? 0, pen: opts.pen ?? 0.9 });
  solid.cylinder = (x, z, r, h, opts = {}) => {
    if (opts.solid !== false) api.ghostBox(x, z, r * 2, r * 2, h, { y: opts.y ?? 0, pen: opts.pen ?? 4 });
  };
  // api.stairs builds its treads with api.box: swapped for the collider-only one meanwhile
  solid.stairs = (...args) => {
    api.box = solid.box;
    try { return api.stairs(...args); } finally { api.box = realBox; }
  };
  buildUndergrinParts(solid);
  // the Blender props' own colliders (bins, cabinets, columns), after the
  // layout's so the layout dump can leave them out (it is the build's input)
  for (const [x, z, w, d, h, y, pen] of UG_PROPS.colliders) api.ghostBox(x, z, w, d, h, { y, pen });
  for (const part of ["shell", "platforms", "escalators", "trains", "concourse", "shops", "plant"]) {
    mapModel(api, `ug-${part}`, { x: 0, z: 0, castShadow: false, ao: UG_AO });
  }
  // the signs' words, lettered in German at load (undergrin-signs.js)
  api.prop(buildUndergrinSigns());
}

function buildUndergrinParts(api) {
  const P = 0.95, U = 6.0, S0 = U - 0.4;          // platform, concourse floor, slab underside
  const H = 16;                                    // outer walls, above the atrium ceiling
  // A solid by its extents, x0..x1 / z0..z1 / y0..y1 (any order).
  const R = (x0, z0, x1, z1, y0, y1, color, opts = {}) =>
    api.box((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(z1 - z0), y1 - y0, { color, y: y0, pen: 8, ...opts });
  // Rects less a hole: the pieces of each [x0, z0, x1, z1] outside it.
  const cut = (rects, [hx0, hz0, hx1, hz1]) => rects.flatMap(([x0, z0, x1, z1]) => {
    if (hx0 >= x1 || hx1 <= x0 || hz0 >= z1 || hz1 <= z0) return [[x0, z0, x1, z1]];
    const out = [];
    if (hz0 > z0) out.push([x0, z0, x1, hz0]);
    if (hz1 < z1) out.push([x0, hz1, x1, z1]);
    const za = Math.max(z0, hz0), zb = Math.min(z1, hz1);
    if (hx0 > x0) out.push([x0, za, hx0, zb]);
    if (hx1 < x1) out.push([hx1, za, x1, zb]);
    return out;
  });

  /* ---- the box: outer walls 1.5 m outside the bounds; brick behind the side platforms */
  for (const s of [-1, 1]) {
    R(s * 22, -45.5, s * 23.5, 45.5, S0, H, UG.wall);
    R(s * 22, -45.5, s * 23.5, -14, 0, S0, UG.brick);
    R(s * 22, -14, s * 23.5, 14, 0, S0, UG.wall);
    R(s * 22, 14, s * 23.5, 45.5, 0, S0, UG.brick);
    R(-22, s * 44, 22, s * 45.5, 0, H, UG.wall);
  }

  /* ---- the concourse slab, 5.6..6.0, less its wells */
  let slab = [[-22, -44, 22, 44]];
  for (const well of [
    [-2.9, -28, 2.9, -18.5], [-2.9, 18.5, 2.9, 28],      // escalators (z -18.5..-17 past the top is the landing)
    [-22, -44, -17.5, -35], [17.5, 35, 22, 44],          // west / east side stairs
    [-4, -4, 4, 4],                                      // the light well over the plant room
    [-21, -10, -18, -4], [18, 4, 21, 10],                // purple / red steel stairs
  ]) slab = cut(slab, well);
  for (const [x0, z0, x1, z1] of slab) R(x0, z0, x1, z1, S0, U, UG.floor);

  /* ---- no rail colliders in the bores: ug-platforms draws the rails. As
     12 cm boxes they bobbed a bot's feet between 0 and 0.12, which put the
     0.95 platforms either side of bots.js SAME_LEVEL (0.9) from one frame to
     the next: a bot that dropped into a bore flipped between "stairs" and
     "same floor" every tick and never got out (the bot-stairs flake). */

  /* ---- one station, in the north station's coordinates (section 4.1);
     s = -1 turns it about the origin for the south station. */
  const station = (s) => {
    const X = (x) => s * x, Z = (z) => s * z;
    const D = (dir) => (s > 0 ? dir : (dir[0] === "+" ? "-" : "+") + dir[1]);
    const B = (x0, z0, x1, z1, y0, y1, color, opts) => R(X(x0), Z(z0), X(x1), Z(z1), y0, y1, color, opts);
    const ST = (x, z, w, n, rise, run, dir, opts) => api.stairs(X(x), Z(z), w, n, rise, run, D(dir), opts);

    // platforms at P: west side, island, east side; the bores between stay at track level
    B(-22, -44, -14.25, -14, 0, P, UG.platform);
    B(-9.75, -44, 9.75, -14, 0, P, UG.platform);
    B(14.25, -44, 22, -14, 0, P, UG.platform);
    // yellow paint: a strip along every platform edge, the zone round the escalator foot
    for (const [x0, x1] of [[-14.85, -14.25], [-9.75, -9.15], [9.15, 9.75], [14.25, 14.85]]) B(x0, -44, x1, -14, P, P + 0.02, UG.zone, { pen: 1 });
    B(-3.6, -31, 3.6, -28, P, P + 0.02, UG.zone, { pen: 1 });
    // columns 0.7 square at x +-6, platform to slab (none in the escalator well)
    for (const x of [-6, 6]) for (const z of [-40, -34, -22, -16]) B(x - 0.35, z - 0.35, x + 0.35, z + 0.35, P, S0, UG.grey);

    // the train in the west bore, z -42..-16: two 12.5 m cars 3.4 wide (x -13.7..-10.3)
    // on a 0.95 undercarriage, a 1 m gangway between, a closed cab at each end
    const tx0 = -13.7, tx1 = -10.3;
    B(tx0, -42, tx1, -16, 0, P, UG.dark);                               // undercarriage, floor at P
    B(tx0, -42, tx1, -16, P + 2.3, P + 2.5, UG.trainBand);              // roof
    for (const [c0, c1] of [[-42, -29.5], [-28.5, -16]]) {
      const cz = (c0 + c1) / 2, cabEnd = c0 === -42 ? c0 : c1, gangEnd = c0 === -42 ? c1 : c0;
      // side walls, 0.1 thick, three 1.4 m doors a side at cz -3.8, cz, cz +3.8
      for (const [w0, w1] of [[tx0, tx0 + 0.1], [tx1 - 0.1, tx1]]) {
        let from = c0;
        for (const dz of [cz - 3.8, cz, cz + 3.8]) { B(w0, from, w1, dz - 0.7, P, P + 2.3, UG.train, { pen: 3 }); from = dz + 0.7; }
        B(w0, from, w1, c1, P, P + 2.3, UG.train, { pen: 3 });
      }
      // the cab: 1.35 m behind a closed partition, and the train's end wall
      const cab = cabEnd === c0 ? c0 + 1.35 : c1 - 1.35;
      B(tx0 + 0.1, cab - 0.05, tx1 - 0.1, cab + 0.05, P, P + 2.3, UG.trainDoor, { pen: 3 });
      B(tx0 + 0.1, cabEnd, tx1 - 0.1, cabEnd === c0 ? c0 + 0.1 : c1 - 0.1, P, P + 2.3, UG.train, { pen: 3 });
      // the gangway end: a 1.2 m door in the middle
      B(tx0 + 0.1, gangEnd - 0.05, -12.6, gangEnd + 0.05, P, P + 2.3, UG.train, { pen: 3 });
      B(-11.4, gangEnd - 0.05, tx1 - 0.1, gangEnd + 0.05, P, P + 2.3, UG.train, { pen: 3 });
      // blue seats along both walls between the doors
      for (const sz of [cz - 1.9, cz + 1.9]) {
        B(tx0 + 0.1, sz - 1, tx0 + 0.6, sz + 1, P, P + 0.5, UG.seat, { pen: 1.5 });
        B(tx1 - 0.6, sz - 1, tx1 - 0.1, sz + 1, P, P + 0.5, UG.seat, { pen: 1.5 });
      }
    }
    B(-12.95, -29.5, -12.85, -28.5, P, P + 2.3, UG.train, { pen: 3 });   // gangway walls
    B(-11.15, -29.5, -11.05, -28.5, P, P + 2.3, UG.train, { pen: 3 });

    // twin escalators up to the hall: feet at z -27, 17 x 0.3 / 0.5 heading south,
    // lanes centred x +-1.9; stepped balustrades 1.2 m over the treads, 0.3
    // thick outside (x +-2.6..2.9: the doc's 3.6 well sealed the island nose
    // off the bots' coarse grid against the x +-6 columns), the middle
    // filling x -1.2..1.2. The slab well is x +-2.9 to match.
    for (const x of [-1.9, 1.9]) ST(x, -27, 1.4, 17, 0.3, 0.5, "+z", { y: P, color: UG.dark, pen: 6 });
    for (let i = 0; i < 17; i++) {
      const z0 = -27 + i * 0.5, top = P + 0.3 * (i + 1) + 1.2;
      B(-2.9, z0, -2.6, z0 + 0.5, P, top, UG.escSide, { pen: 4 });
      B(2.6, z0, 2.9, z0 + 0.5, P, top, UG.escSide, { pen: 4 });
      B(-1.2, z0, 1.2, z0 + 0.5, P, top, UG.escSide, { pen: 4 });
    }
    // well rails on the slab round the escalator hole
    B(-3.0, -28.1, 3.0, -28, U, U + 1.1, UG.mullion, { pen: 0.3 });
    for (const x of [-3.0, 2.9]) B(x, -28.1, x + 0.1, -18.5, U, U + 1.1, UG.mullion, { pen: 0.3 });

    // the west stair: foot z -42.65 on the side platform, 17 x 0.3 / 0.45 south
    // to z -35. The 1.35 m landing at the end wall is for the bots: from the
    // old foot (z -43.5, half a metre off the wall) a bot coming down ended on
    // the bottom tread at 1.25, a level with no floor, and wandered off.
    ST(-19.5, -42.65, 4, 17, 0.3, 0.45, "+z", { y: P, color: UG.dark, pen: 6 });
    B(-17.5, -40, -17.4, -35, U, U + 1.1, UG.mullion, { pen: 0.3 });   // rail on the well's east edge (the end block holds z -44..-40)

    // platform nose: 4 steps down to the walkway (x -2..2, z -14..-8)
    ST(0, -12, 3, 4, 0.2375, 0.5, "-z", { color: UG.platform, pen: 6 });
    // the east bore's end: 4 steps up to the island and to the side platform
    ST(11.75, -42, 3, 4, 0.2375, 0.5, "-x", { color: UG.grey, pen: 6 });
    ST(12.25, -42, 3, 4, 0.2375, 0.5, "+x", { color: UG.grey, pen: 6 });

    // platform furniture: benches, a vending machine, both side platforms; island benches
    for (const sx of [-1, 1]) {
      for (const z of [-34, -20]) B(sx * 21.1 - 0.3, z - 0.9, sx * 21.1 + 0.3, z + 0.9, P, P + 0.5, UG.bench, { pen: 1.5 });
      B(sx * 21.2 - 0.4, -25.5, sx * 21.2 + 0.4, -24.5, P, P + 2.0, UG.dark, { pen: 3 });
    }
    B(-1.2, -32.5, 1.2, -31.5, P, P + 0.5, UG.bench, { pen: 1.5 });
    for (const x of [-6, 6]) B(x - 0.3, -29, x + 0.3, -27, P, P + 0.5, UG.bench, { pen: 1.5 });
    // tube lights under the slab, roundels and posters on the brick (emissive paint later)
    for (const sx of [-1, 1]) {
    }

    /* ---- track level, this half of the central section (4.2) */
    B(-9.75, -14, -2, -8, 0, S0, UG.wall);                                // solid beside the walkway
    B(2, -14, 9.75, -8, 0, S0, UG.wall);
    B(-2, -14, 2, -8, 0, 0.02, UG.floor, { pen: 1 });                     // walkway floor
    // plant room door: the walkway's full 4 m, a lintel at 2.4 (the doc's 1.8
    // sealed the room on the bots' coarse stair-planning grid, and a 3.0 with
    // 0.5 jambs left corners that two bots passing wedged on)
    B(-2, -8, 2, -7.7, 2.4, S0, UG.wall);
    B(-22, -14, -14.25, -12, 0, S0, UG.wall);                             // solid round the service corridor
    B(-22, 0, -14.25, 14, 0, S0, UG.wall);
    B(-15.75, -12, -14.25, -6.9, 0, S0, UG.wall);                         // corridor / bore wall, door at z -6
    B(-15.75, -5.1, -14.25, 0, 0, S0, UG.wall);
    B(-15.75, -6.9, -14.25, -5.1, 2.4, S0, UG.wall);
    B(-22, -12, -15.75, 0, 0, 0.02, UG.floor, { pen: 1 });                // corridor floor
    B(-10.05, -14, -9.75, -4.9, 0, S0, UG.grey);                          // the bore's inner wall, door at z -4
    B(-10.05, -3.1, -9.75, 14, 0, S0, UG.grey);
    B(-10.05, -4.9, -9.75, -3.1, 2.4, S0, UG.grey);
    B(-14.25, -14, -9.75, 14, 4.0, S0, UG.grey);                          // tunnel ceiling at 4
    B(-14.25, -2.2, -12.65, 0.2, 0, 1.0, UG.dark, { pen: 2 });            // works trolley at z -1, against the outer wall (centred, it cut the bore on the coarse grid; at z -2 it pinched the door)
    B(-13.95, 9.4, -13.35, 10.6, 0, 2.0, UG.grey, { pen: 3 });            // signal cabinet at z 10
    // the plant room's low cover, this half
    B(-9.3, -6.5, -6.9, -5.1, 0, 1.2, UG.dark, { pen: 2 });               // generator
    for (const x of [-7, 4]) B(x, -7.7, x + 2, -7.1, 0, 1.2, UG.grey, { pen: 2 });   // switch cabinets
    api.cylinder(X(7), Z(-6.3), 0.6, 1.0, { color: UG.escSide, pen: 2 });  // cable drums
    api.cylinder(X(8.3), Z(-4.8), 0.5, 0.9, { color: UG.escSide, pen: 2 });
    B(5.5, -2.5, 7.5, -0.9, 0, 0.9, UG.grey, { pen: 2 });                 // pump skid
    // the corridor: the steel stair up to the purple room (20 x 0.3 / 0.3), lockers, fuses, a mop bucket
    ST(-19.5, -10, 3, 20, 0.3, 0.3, "+z", { color: UG.dark, pen: 6 });
    B(-21.95, -11.8, -21.45, -10.2, 0, 2.0, UG.grey, { pen: 3 });
    B(-17, -0.5, -16, 0, 0, 1.8, UG.grey, { pen: 3 });
    api.cylinder(X(-16.5), Z(-11.5), 0.25, 0.4, { color: UG.red, pen: 1 });

    /* ---- concourse, this half (4.3): the end block, the hall, its arch, the shop row */
    B(-17.5, -44, 22, -40, U, 12.4, UG.wall);                             // the hall's end wall, 4 m thick (the side stair's well is beside it)
    B(-16, -40, 16, -16, 12, 12.4, UG.glass);                             // barrel skylight (flat here), crown 12
    for (const m of [1, -1]) {                                            // vault haunches, 9.6 up to the crown
      B(m * -16, -40, m * -14.5, -16, 9.6, 12, UG.wall);
      B(m * -14.5, -40, m * -13, -16, 10.8, 12, UG.wall);
    }
    B(-16, -16, -7, -15.5, U, 15, UG.wall);                               // arch piers, span 14
    B(7, -16, 16, -15.5, U, 15, UG.wall);
    B(-7, -16, 7, -15.5, 12, 15, UG.wall);                                // the arch head (round in the model)
    B(-16.6, -16, -16, 16, 10, 15, UG.wall);                              // atrium wall above the shop row
    // hall furniture: benches, a photo booth and ticket machines by the escalator top
    for (const m of [1, -1]) B(m * -11.2, -30.3, m * -8.8, -29.7, U, U + 0.5, UG.bench, { pen: 1.5 });
    // the Fotoautomat, walk-in (user, 2026-10-27: "users should be able to
    // enter inside of it"): 2.4 x 2.2 x 2.5, walls 0.08, a 1.15 doorway on
    // its south face (the curtain gathered at its west jamb), a roof
    {
      const [x0, x1, z0, z1, t, h] = [UG_BOOTH.x0, UG_BOOTH.x1, UG_BOOTH.z0, UG_BOOTH.z1, 0.08, U + 2.5];
      B(x0, z0, x1, z0 + t, U, h, UG.dark, { pen: 3 });                     // back
      B(x0, z0, x0 + t, z1, U, h, UG.dark, { pen: 3 });                     // west
      B(x1 - t, z0, x1, z1, U, h, UG.dark, { pen: 3 });                     // east
      B(x0, z1 - t, UG_BOOTH.door0, z1, U, h, UG.dark, { pen: 3 });          // the doorway's west jamb
      B(UG_BOOTH.door1, z1 - t, x1, z1, U, h, UG.dark, { pen: 3 });          // the front panel east of it
      B(UG_BOOTH.door0, z1 - t, UG_BOOTH.door1, z1, U + 2.1, h, UG.dark, { pen: 3 });   // the header
      B(x0, z0, x1, z1, h - 0.08, h, UG.dark, { pen: 3 });                  // the roof
    }
    for (const x of [5.6, 6.6]) B(x, -20.3, x + 0.8, -19.7, U, U + 1.9, UG.grey, { pen: 3 });
    // atrium, this half: the gate line at z -12, its staffed boxes, a bench, the light-well rails
    for (const x of [-7, -4.2, -1.4, 1.4, 4.2, 7]) B(x - 0.15, -12.6, x + 0.15, -11.4, U, U + 1.0, UG.grey, { pen: 2 });
    for (const m of [1, -1]) B(m * -9.75, -12.75, m * -8.25, -11.25, U, U + 2.2, UG.grey, { pen: 3 });
    B(-1.2, -9.25, 1.2, -8.75, U, U + 0.5, UG.bench, { pen: 1.5 });
    B(-4.1, -4.1, -4, 4.1, U, U + 1.1, UG.mullion, { pen: 0.3 });
    B(-4.1, -4.1, 4.1, -4, U, U + 1.1, UG.mullion, { pen: 0.3 });
    // the shop row's inner wall, 0.3 inside the row, six 1.8 doorways
    let from = -40;
    for (const dz of [-33, -19, -8, 8, 19, 33]) {
      B(-16.3, from, -16, dz - 0.9, U, 9.6, UG.wall);
      B(-16.3, dz - 0.9, -16, dz + 0.9, U + 2.4, 9.6, UG.wall);
      from = dz + 0.9;
    }
    B(-16.3, from, -16, 40, U, 9.6, UG.wall);
    // partitions at z -26, -12, 0, 12, 26 (this row; the other half draws the
    // other row's), door at x -19
    for (const z of [-26, -12, 0, 12, 26]) {
      B(-22, z - 0.15, -19.9, z + 0.15, U, 9.6, UG.wall);
      B(-18.1, z - 0.15, -16.3, z + 0.15, U, 9.6, UG.wall);
      B(-19.9, z - 0.15, -18.1, z + 0.15, U + 2.4, 9.6, UG.wall);
    }
    B(-22, -44, -17.5, -40, 9.6, 10, UG.wall);                            // shop-row ceilings at 9.6
    B(-22, -40, -16, 40, 9.6, 10, UG.wall);
    // the shops, west row: Arcade -40..-26, Grinbiss -26..-12, Purple room -12..0
    for (const z of [-33, -31, -29, -27]) B(-21.9, z - 0.45, -21.1, z + 0.45, U, U + 1.9, UG.trainBand, { pen: 3 });   // Troll Kombat cabinets
    B(-21, -34, -17, -27, U, U + 0.02, UG.trainBand, { pen: 1 });          // the neon carpet
    B(-21.5, -22, -20.7, -16, U, U + 1.1, UG.wall, { pen: 2 });            // Grinbiss counter
    for (const z of [-24, -14]) B(-17.5, z - 0.5, -16.5, z + 0.5, U, U + 0.8, UG.escSide, { pen: 1.5 });   // tables
    B(-18, -10, -17.9, -4, U, U + 1.0, UG.purple, { pen: 0.3 });          // purple room: rails round the stair well
    B(-21.1, -10, -21, -4, U, U + 1.0, UG.purple, { pen: 0.3 });
    B(-21, -10.1, -18, -10, U, U + 1.0, UG.purple, { pen: 0.3 });
    B(-22, -12, -21.9, 0, U, U + 0.3, UG.purple, { pen: 1 });             // purple trim
    // west row, south half: Lounge 0..12, Apotrolle 12..26, Books 26..40
    for (const z of [2, 8]) B(-21.9, z, -21, z + 2.2, U, U + 0.9, UG.red, { pen: 2 });          // red sofas
    B(-17.3, 5.3, -16.3, 6.7, U, U + 1.4, UG.brick, { pen: 3 });                                // fireplace
    B(-21, 4.5, -17.5, 7.5, U, U + 0.02, UG.trainBand, { pen: 1 });                             // the cow-print rug
    B(-21.5, 15, -20.7, 21, U, U + 1.1, UG.wall, { pen: 2 });                                   // Apotrolle counter
    for (const [z0, z1] of [[12.5, 17.5], [22.5, 25.5]]) B(-17, z0, -16.3, z1, U, U + 2.2, UG.grey, { pen: 3 });   // shelves of bottles
    B(-21.9, 28, -21.4, 38, U, U + 2.2, UG.escSide, { pen: 3 });                                // bookshelves
    B(-17, 34.5, -16.3, 39, U, U + 2.2, UG.escSide, { pen: 3 });
    B(-21.2, 29, -20.2, 31, U, U + 0.8, UG.escSide, { pen: 1.5 });                              // reading table
  };
  station(1);
  station(-1);

  /* ---- what the two halves share: the atrium's middle and its ceiling */
  R(-9.75, -8, 9.75, 8, 0, 0.02, UG.floor, { pen: 1 });                   // plant room floor
  R(-16.6, -16, 16.6, 16, 15, 15.4, UG.glass);                            // atrium ceiling, the skylight grid
  R(-10.5, -1, -7.5, 1, U, U + 1.1, UG.grey, { pen: 2 });                 // info desk
  R(7.5, -1.2, 10.5, 1.2, U, U + 2.4, UG.brick, { pen: 3 });              // newsstand
}
