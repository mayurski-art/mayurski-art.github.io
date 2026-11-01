// Troll Forces Zombies: where each map's buyables go (design doc "Zombies
// economy", claude.ai/artifact/CX7UuR3ybkeUvvNrbk9muS). Keyed by the map's
// name. modes/zombies/wallbuys.js builds them.
//
// A wall buy: { gun, x, z, y, face }. `gun` is a weapon id, or "starter"
// (your hub-kiosk gun, the first one free). (x, z) is roughly on the wall;
// the builder slides it along `face` onto the nearest collider's surface.
// `face` is the yaw the chalk outline looks out along: its normal is
// (sin face, 0, cos face). `y` is the floor it stands on.
//
// Every spot is checked by tools/troll-ops-zecon-test.mjs (walls) for
// CLAUDE.md rule 9: on a solid wall, nothing in front of it from where a
// player stands, and no sign, window or doorway under it.

const N = Math.PI, E = Math.PI / 2, W = -Math.PI / 2, S = 0;   // facing -z, +x, -x, +z

export const ZOMBIE_BUYS = {
  "The Pentagrin": {
    walls: [
      // the boardroom lobby (the decorative wall buys there step aside)
      { gun: "starter", x: -10.15, z: 13.62, y: 11, face: N },
      { gun: "sixtynine", x: 11.85, z: 13.62, y: 11, face: N },
      { gun: "frags", x: -7.15, z: 6.17, y: 11, face: N },
      // the conference room's north wall, east of its screen
      { gun: "true69", x: 8.85, z: -14.17, y: 11, face: S },
      { gun: "kek", x: -15.03, z: -9.15, y: 5.5, face: W },
      { gun: "howl", x: -12.17, z: 8.85, y: 0, face: E },
      { gun: "soulblazer", x: 20.17, z: -11.15, y: 0, face: W },
    ],
  },
  Hollowgrin: {
    // The Town Square is the start. Railings close the open ground between
    // areas; the manor's own walls and the graveyard's fence fill their parts.
    areas: [
      { id: "square", name: "Town Square", start: true, boxes: [[-16, -12, 36.4, 47]] },
      { id: "manor", name: "Manor", boxes: [[-16, -47, 36.4, -12]] },
      { id: "west", name: "Graveyard", boxes: [[-53, -47, -16, 47]] },
      { id: "midway", name: "Midway", boxes: [[36.4, -47, 51, 47]] },
      { id: "park", name: "Fair Park", boxes: [[51, -47, 89, 47]] },
    ],
    fences: [
      // either side of the manor's front (its wall is the line between)
      { a: [-16, -12], b: [-13, -12] },
      { a: [13, -12], b: [36.4, -12] },
      // the manor's front windows: shut, glass you can't see
      ...[[-10.3, -8.7], [-4.3, -2.9], [2.9, 4.3], [8.7, 10.3]].map(([x0, x1]) => ({ a: [x0, -12.2], b: [x1, -12.2], kind: "invisible" })),
      { a: [-16, -47], b: [-16, 47] },
      { a: [36.4, -47], b: [36.4, 47] },
      { a: [51, -47], b: [51, 47] },
    ],
    doors: [
      // the manor's front door, boarded up
      { id: "manor", label: "Manor door", kind: "barricade", price: 750, a: [-1.1, -12.2], b: [1.1, -12.2], between: ["square", "manor"] },
      // the graveyard fence's own gateway: the leaves hang on its posts
      { id: "graveyard", label: "Graveyard gate", kind: "gate", pillars: false, price: 1000, a: [-16, 0.4], b: [-16, 3.6], between: ["square", "west"] },
      { id: "midway", label: "Midway gate", kind: "gate", price: 1250, a: [36.4, 0.5], b: [36.4, 3.9], between: ["square", "midway"] },
      { id: "park", label: "Fair Park gate", kind: "gate", price: 1500, a: [51, 1], b: [51, 4.4], between: ["midway", "park"] },
      { id: "manor-west", label: "Graveyard gate", kind: "gate", price: 1000, a: [-16, -30], b: [-16, -26.6], between: ["manor", "west"] },
      { id: "manor-midway", label: "Midway gate", kind: "gate", price: 1250, a: [36.4, -30], b: [36.4, -26.6], between: ["manor", "midway"] },
    ],
    walls: [
      // the candy shop's east wall, south of its window
      { gun: "starter", x: -0.97, z: 22.25, y: 0, face: E },
      { gun: "frags", x: -0.97, z: 25.75, y: 0, face: E },
      { gun: "sixtynine", x: 17.85, z: 29.03, y: 0, face: S },
      { gun: "kek", x: -12.57, z: -13.95, y: 0, face: E },
      { gun: "true69", x: 27.85, z: 19.97, y: 0, face: N },
      { gun: "howl", x: -48.65, z: -5.03, y: 0, face: N },
      { gun: "soulblazer", x: 77.03, z: 24.2, y: 0, face: E },
    ],
  },
  "Troll City": {
    walls: [
      { gun: "starter", x: -37.67, z: -11.35, y: 0, face: E },
      { gun: "frags", x: -39.97, z: -13.65, y: 0, face: E },
      { gun: "sixtynine", x: -37.97, z: 10.75, y: 0, face: E },
      { gun: "true69", x: -25.97, z: -15.95, y: 0, face: E },
      { gun: "kek", x: 16.45, z: -21.27, y: 0, face: S },
      { gun: "howl", x: 36.45, z: 21.27, y: 0, face: N },
      { gun: "soulblazer", x: 79.97, z: 5.05, y: 0, face: W },
    ],
  },
};

/* What a wall gun costs, and its ammo (half, as in Call of Duty). The
   starter is free the first time, then STARTER_PRICE. */
export const WALL_PRICES = {
  sixtynine: 500,
  true69: 750,
  kek: 1200,
  howl: 1500,
  soulblazer: 1500,
};
export const STARTER_PRICE = 500;
/* The Frags wall ({ gun: "frags" }): you start a run with none, and it tops
   you up to FRAG_MAX. */
export const FRAG_PRICE = 250;
export const FRAG_MAX = 4;
export const STARTER_AMMO = 250;
export const ammoPrice = (gunId) => Math.round((WALL_PRICES[gunId] ?? STARTER_PRICE) / 2 / 5) * 5;
