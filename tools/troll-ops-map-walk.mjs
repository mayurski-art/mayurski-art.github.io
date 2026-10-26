// Troll Ops walk test: holds W from set spots on each map and checks where
// the player ends up (stairs climbed, doors passed, rails holding).
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-map-walk.mjs [mapId ...]
//
// Each run: [x, feetY, z, faceX, faceZ, seconds, label, check(result)], where
// result = { startY, maxY, end: [x, y, z] }. Every map starts with a warm-up
// walk: the first run after a map loads crawls while models stream in, and
// used to fail for that reason alone. Headless Chrome with the real GPU
// (--use-angle=d3d11); the sim runs slower than real time, so runs are long.

import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };

const RUNS = {
  grinsite: [  [0, 0, 14.2, 0, -1, 4, "flight A -> level 1", (r) => r.maxY >= 3.4],
  [7.7, 3.5, -4, -1, 0, 4, "flight B -> level 2", (r) => r.maxY >= 6.6],
  [-24, 0, -14.2, 0, -1, 4, "NW scaffold stair", (r) => r.maxY >= 3.45],
  [24, 0, 14.2, 0, 1, 4, "SE scaffold stair", (r) => r.maxY >= 3.45],
  [-24, 0, 14.2, 0, 1, 4, "SW scaffold stair", (r) => r.maxY >= 3.45],
  [28, 0, -2.5, 0, -1, 3.5, "container stair", (r) => r.maxY >= 2.5],
  [-13.2, 0, 8, -1, 0, 2.5, "foundation east steps", (r) => r.maxY >= 1.1],
  [-27, 0, -14.8, 0, 1, 2.5, "foundation north steps", (r) => r.maxY >= 1.1],
  [20.8, 0, 1, 1, 0, 2.5, "through the open container", (r) => r.end[0] > 27.5],
  [-4, 0, -19, 0, -1, 1.5, "into the site office", (r) => r.end[2] < -21.5],
  [24, 3.55, -24, 1, 0, 2, "scaffold side rail holds", (r) => r.end[0] < 26.2 && r.end[1] > 3.4],
  [24, 3.55, -24, 0, -1, 2, "scaffold back rail holds", (r) => r.end[2] > -26.2 && r.end[1] > 3.4],
  ],
  dustbowl: [  [-3.5, 0, -0.5, 0, -1, 4, "house stair -> roof", (r) => r.maxY >= 3.4],
  [-30, 0, 23, 0, -1, 2.5, "channel -> north bank (W)", (r) => r.maxY >= 1.1],
  [30, 0, 14.2, 0, 1, 2.5, "street -> north bank (E)", (r) => r.maxY >= 1.1],
  [-10, 0, 27.2, 0, 1, 2.5, "channel -> south bank", (r) => r.maxY >= 1.1],
  [12, 0, 27.2, 0, 1, 2.5, "channel -> south bank (E)", (r) => r.maxY >= 1.1],
  [0, 1.2, 17.5, 0, 1, 2.5, "north bank -> footbridge", (r) => r.end[2] > 21 && r.end[1] > 1.1],
  [-7, 0, 10, 0, 1, 2.5, "cut-through house", (r) => r.end[2] > 17],
  [-16, 0, 6, 0, -1, 2.5, "through north house", (r) => r.end[2] < -2.5],
  [-27, 0, -20, 0, -1, 2.5, "into courtyard (S gate)", (r) => r.end[2] < -24],
  [0, 0, 1.5, 0, -1, 2, "into centre house (S door)", (r) => r.end[2] < -1],
  [-20.75, 0, 5.2, 0, -1, 4, "carpet-shop stair -> landing", (r) => r.maxY >= 3.25],
  [-20.75, 3.3, -2.2, 1, 0, 2, "landing -> carpet-shop roof", (r) => r.end[0] > -18.5 && r.end[1] > 3.2],
  [2, 0, -8.6, 1, 0, 1.6, "over the minaret plinth", (r) => r.maxY >= 0.29 && r.end[0] > 9],
  [-19.5, 0, -27, 0, -1, 2.5, "loading dock stair -> dock", (r) => r.maxY >= 1.45 && r.end[2] < -31],
  [-17.5, 1.2, 18.5, 0, 1, 2.5, "plank crossing bank to bank", (r) => r.end[2] > 30 && r.end[1] > 1.1],
  ],
  grinjuku: [  [-24.5, 0, -30, 0, 1, 6, "down A Main", (r) => r.end[2] > -2],
  [0, 0, -33, 0, 1, 3, "under the torii, Mid Top", (r) => r.end[2] > -20],
  [-27, 0, 5.75, 1, 0, 2.5, "A Ramps steps -> deck", (r) => r.maxY >= 0.85],
  [27, 0, 5.75, -1, 0, 2.5, "B Ramps steps -> deck", (r) => r.maxY >= 0.85],
  [-12, 0, 31, 0, -1, 4, "A Back stair -> A Heaven", (r) => r.maxY >= 2.95 && r.end[2] < 23],
  [12, 0, 31, 0, -1, 4, "B Back stair -> B Heaven", (r) => r.maxY >= 2.95 && r.end[2] < 23],
  [-22, 0, -3, 1, 0, 4, "through the Sewers into Mail", (r) => r.end[0] > -6],
  [22, 0, -3, -1, 0, 4, "through the Vents into Mail", (r) => r.end[0] < 6],
  [-2.5, 0, -12, 0, 1, 3, "Mid Top -> Mail (N door)", (r) => r.end[2] > -7],
  [2.5, 0, 8, 0, -1, 3, "Mid Bottom -> Mail (S door)", (r) => r.end[2] < 0],
  [-12, 3, 15, -1, 0, 2, "A Heaven site parapet holds", (r) => r.end[0] > -13.75 && r.end[1] > 2.9],
  [-8, 3, 15, 1, 0, 2, "A Heaven mid wall holds", (r) => r.end[0] < -6.3 && r.end[1] > 2.9],
  [-12, 3, 9.8, 1, 0, 2, "A shaft rail holds", (r) => r.end[0] < -10.3 && r.end[1] > 2.9],
  [-9, 0, 9.4, 0, 1, 3, "A mid rope -> A Heaven", (r) => r.end[1] > 2.95],
  [16.2, 0, 18, -1, 0, 3, "B site rope -> B Heaven", (r) => r.end[1] > 2.95],
  ],
  depot: [  [-23, 0, 7.6, 0, 1, 4, "west stair -> south catwalk", (r) => r.maxY >= 4.9],
  [23, 0, -7.6, 0, -1, 4, "east stair -> north catwalk", (r) => r.maxY >= 4.9],
  [25.5, 5.0, -12, 0, 1, 3, "east catwalk -> into office", (r) => r.end[2] > -5 && r.end[1] > 4.9],
  [-12, 0, 5, 0, -1, 3, "aisle run between racks", (r) => r.end[2] < -3],
  [0, 5.0, 19, 0, -1, 1.5, "south catwalk rail holds", (r) => r.end[2] > 17 && r.end[1] > 4.9],
  [22, 5.0, 0, -1, 0, 2, "office glass holds", (r) => r.end[0] > 16.2],
  ],
  // Undergrin (UNDERGRIN-METRO.md, 2026-10-15): every vertical link, the
  // five lanes a side, the rails that hold. P 0.95 is vaulted, not walked:
  // holding W at the platform face stays on the track.
  undergrin: [  [-1.9, 0.95, -30, 0, 1, 5, "N escalator (west lane) -> hall", (r) => r.maxY >= 6.0 && r.end[2] > -18.5],
  [1.9, 0.95, -30, 0, 1, 5, "N escalator (east lane) -> hall", (r) => r.maxY >= 6.0 && r.end[2] > -18.5],
  [-1.9, 0.95, 30, 0, -1, 5, "S escalator -> hall", (r) => r.maxY >= 6.0 && r.end[2] < 18.5],
  [-19.5, 0.95, -43.8, 0, 1, 5.5, "west stair -> concourse", (r) => r.maxY >= 6.0 && r.end[2] > -35],
  [19.5, 0.95, 43.8, 0, -1, 5.5, "east stair -> concourse", (r) => r.maxY >= 6.0 && r.end[2] < 35],
  [0, 0.95, -16, 0, 1, 3, "N platform nose -> down to the walkway", (r) => r.end[2] > -11 && r.end[1] < 0.2],
  [0, 0, -9, 0, -1, 3, "N walkway -> up the nose steps", (r) => r.maxY >= 0.95 && r.end[2] < -14.5],
  [12, 0, -42, -1, 0, 3, "E bore end -> steps -> island", (r) => r.maxY >= 0.95 && r.end[0] < 9.5],
  [12, 0, -42, 1, 0, 3, "E bore end -> steps -> east side platform", (r) => r.maxY >= 0.95 && r.end[0] > 14.5],
  [-19.5, 0, -11.5, 0, 1, 5, "service corridor -> steel stair -> purple room", (r) => r.maxY >= 6.0 && r.end[2] > -4],
  [19.5, 0, 11.5, 0, -1, 5, "service corridor -> steel stair -> red room", (r) => r.maxY >= 6.0 && r.end[2] < 4],
  [12, 0, -30, -1, 0, 2, "platform edge holds a walker (vault it)", (r) => r.maxY < 0.3 && r.end[0] > 9.3],
  // lanes
  [5.5, 6, -38, 0, 1, 18, "main lane: north hall -> gates -> atrium -> south arch", (r) => r.end[2] > 16 && r.end[1] > 5.9],
  [-19, 6, -38.5, 0, 1, 7, "west shop row: Arcade -> Grinbiss doorways", (r) => r.end[2] > -12.5],
  [-17.1, 6, -11, 0, 1, 4, "purple room: the ledge past the stair well", (r) => r.end[2] > -3.5 && r.end[1] > 5.9],
  [-19, 6, -2, 0, 1, 12, "west shop row: Lounge -> Apotrolle -> Books", (r) => r.end[2] > 30 && r.end[1] > 5.9],
  [19, 6, 38.5, 0, -1, 7, "east shop row: Arcade -> Grinbiss doorways", (r) => r.end[2] < 12.5],
  [-11, 0, 40, 0, -1, 16, "west bore sneak: south station -> tunnel -> past the trolley", (r) => r.end[2] < -10],
  [11, 0, -40, 0, 1, 16, "east bore sneak: north station -> tunnel", (r) => r.end[2] > 10],
  [0, 0, -10.5, 0, 1, 8, "walkway -> plant room -> south walkway", (r) => r.end[2] > 8.5],
  [-12, 0, -4, 1, 0, 3, "W bore -> door -> plant room", (r) => r.end[0] > -9.5],
  [-17, 0, -6, 1, 0, 3, "service corridor -> door -> W bore", (r) => r.end[0] > -14],
  [-16, 0.95, -35.75, 1, 0, 4, "west side platform -> through the train -> island", (r) => r.end[0] > -9.5 && r.end[1] > 0.9],
  [-12, 0.95, -40.3, 0, 1, 8, "along inside the train to the far cab", (r) => r.end[2] > -18 && r.end[2] < -17],
  [12, 0.95, 40.3, 0, -1, 8, "along inside the south train", (r) => r.end[2] < 18 && r.end[2] > 17],
  // rails
  [0, 6, -30, 0, 1, 2, "escalator well rail holds", (r) => r.end[2] < -28.3 && r.end[1] > 5.9],
  [0, 6, -6, 0, 1, 2, "light-well rail holds", (r) => r.end[2] < -4.3 && r.end[1] > 5.9],
  [-16.5, 6, -37, -1, 0, 2, "west stair well rail holds", (r) => r.end[0] > -17.2 && r.end[1] > 5.9],
  ],
  culdegrin: [  [-10.4, 0, 0, -1, 0, 2.5, "into west-middle house", (r) => r.end[0] < -14],
  [10.4, 0, 0, 1, 0, 2.5, "into east-middle house", (r) => r.end[0] > 14],
  [-22.7, 0, -4.2, 0, 1, 4, "sage-attic stair", (r) => r.maxY >= 3.2],
  [21.7, 0, 13.9, 0, 1, 4, "terracotta-attic stair", (r) => r.maxY >= 3.2],
  [-11.3, 0, -18, -1, 0, 2.5, "into west-north house", (r) => r.end[0] < -14],
  [11.3, 0, 18, 1, 0, 2.5, "into east-south house", (r) => r.end[0] > 14],
  [0, 0, 26, 0, -1, 6, "down the street", (r) => r.end[2] < 3],
  ],
  grinbeach: [  [-19.8, 0, -5.4, 0, -1, 3.5, "west ramp up", (r) => r.maxY >= 3.0],
  [-19.8, 3.1, -11.9, 1, 0, 2, "west ramp top -> onto deck", (r) => r.end[0] > -17 && r.end[1] > 3],
  [-6.2, 0, -13.4, 0, -1, 3.5, "east ramp up", (r) => r.maxY >= 3.0],
  [-6.2, 3.1, -19.9, -1, 0, 2, "east ramp top -> onto deck", (r) => r.end[0] < -9 && r.end[1] > 3],
  [-13, 3.1, -8, 0, -1, 8, "deck run to the end", (r) => r.end[2] < -40 && r.end[2] > -44.1 && r.end[1] > 3],
  [-38, 0, -4, -1, 0, 6, "in through the Muscle Beach gate", (r) => r.end[0] < -43],
  [36, 0, 3, 1, 0, 8, "onto the basketball court", (r) => r.end[0] > 42],
  [55.5, 0, 2.5, 1, 0, 5, "in through the tennis gate", (r) => r.end[0] > 59],
  ],
  // The Grinleria (grinleria-layout.js): escalators, the bridges, the
  // balustrades, and the doors that make its flanks (shop links, a stock
  // room into the service corridor, the corridors' ends, the street doors).
  grinleria: [  [-13.8, 0, -3.45, -1, 0, 5, "west escalator up", (r) => r.maxY >= 4.4],
  [13.8, 0, 3.45, 1, 0, 5, "east escalator up", (r) => r.maxY >= 4.4],
  [-8, 4.5, -12, 0, 1, 2, "upper balustrade holds", (r) => r.end[2] < -9.9 && r.end[1] > 4.4],
  [0, 4.5, -12, 0, 1, 7, "across the mid bridge", (r) => r.end[2] > 11 && r.end[1] > 4.4],
  [27, 4.5, -13, 0, 1, 7, "across the east end deck", (r) => r.end[2] > 11 && r.end[1] > 4.4],
  [0, 0, -9, 0, 1, 3, "onto the ice by the north gate", (r) => r.end[2] > -4],
  [-22.5, 0, -24, 1, 0, 3, "Trolliffany -> Trapple link", (r) => r.end[0] > -18.5],
  [16.6, 0, -25, 0, -1, 3, "GameStonk stock room -> corridor", (r) => r.end[2] < -29.5],
  [-28, 0, -30.15, -1, 0, 4, "corridor -> Neiman fitting rooms", (r) => r.end[0] < -33.5],
  [29, 0, -22, 1, 0, 3, "Troll Locker side door -> food court", (r) => r.end[0] > 33],
  [46.9, 0, -29, 0, -1, 4, "food court -> valet drive", (r) => r.end[2] < -34],
  [0, 0, 29.5, 0, 1, 4, "south corridor fire exit -> garage", (r) => r.end[2] > 34],
  ],
  // Hollowgrin's outskirts (hollowgrin.js buildOutskirts): the chapel's door
  // and side door, the aisle, the glasshouse and hut doors, the bridge, the Troll House.
  hollowgrin: [  [-36.5, 0, 2, -1, 0, 3, "graveyard gate -> chapel door", (r) => r.end[0] < -40.6],
  [-42.6, 0, 9.5, 0, -1, 3, "churchyard -> chapel side door", (r) => r.end[2] < 5],
  [-40.0, 0, 2, -1, 0, 8, "chapel aisle -> up the chancel steps", (r) => r.end[0] < -47.6 && r.end[1] > 0.25],
  [-42.6, 0, 6.0, 0, -1, 7, "chapel cross aisle, side door -> centre aisle", (r) => r.end[2] < 2.0],
  [-6.5, 0, -31, 0, -1, 3, "glasshouse south door", (r) => r.end[2] < -36],
  [-12, 0, -38.5, 1, 0, 3, "glasshouse west door", (r) => r.end[0] > -7],
  [-44.6, 0, -34, 0, -1, 3, "witch's hut south door", (r) => r.end[2] < -38.5],
  [-46, 0, 35, 1, 0, 6, "over the covered bridge", (r) => r.end[0] > -33 && r.maxY >= 0.5],
  [0, 0, 36, 0, 1, 3, "into the Troll House", (r) => r.end[2] > 40.5],
  [38.5, 0, -4, 1, 0, 2.5, "onto the carousel", (r) => r.maxY >= 0.28],
  // phase 6a: the barn's loft (stair up its east edge, rail gap at the top),
  // the lowered west door, the mausoleum's door
  [25.3, 0, 27.7, -1, 0, 4, "barn: up the loft stair onto the loft", (r) => r.end[0] < 19.6 && r.end[1] > 2.3],
  [19.0, 2.4, 22.5, 1, 0, 2, "barn: the loft rail holds", (r) => r.end[0] < 20.4 && r.end[1] > 2.3],
  [14, 0, 24.5, 1, 0, 3, "barn: in through the west door", (r) => r.end[0] > 18.5],
  [-21, 0, 11, -1, 0, 3, "into the mausoleum", (r) => r.end[0] < -26.5],
  // phase 6b: the park fence and its gaps, the wheel's stair and lamp deck, a stall
  [46, 0, 2.5, 1, 0, 4, "park: in through the main gate", (r) => r.end[0] > 55],
  [47, 0, 15, 1, 0, 3, "park: the fence holds", (r) => r.end[0] < 51],
  [47, 0, 35, 1, 0, 3, "park: the lane runs through", (r) => r.end[0] > 53],
  [77.2, 0, 1.6, 0, -1, 4, "wheel: up the stair to the lamp deck", (r) => r.end[1] > 5.8],
  [75, 6, -7, -1, 0, 2, "wheel: the deck rail holds", (r) => r.end[0] > 73.9 && r.end[1] > 5.8],
  [56.35, 0, -6.5, 0, -1, 3, "stall: in through the counter flap", (r) => r.end[2] < -9.5],
  [55, 0, -6.5, 0, -1, 3, "stall: the counter stops you", (r) => r.end[2] > -8.3],
  // phase 6c: U Mad Mansion
  [69.5, 0, 15.5, 0, 1, 4, "mansion: up the steps, in the front door", (r) => r.end[2] > 21.5 && r.end[1] > 0.35],
  [68, 0.4, 21.75, -1, 0, 3, "mansion: foyer into the endless hall", (r) => r.end[0] < 64.5],
  [68.2, 0.4, 28.2, -1, 0, 4, "mansion: up the ballroom stair to the attic", (r) => r.end[1] > 4.1],
  [69.5, 4.2, 23, 0, -1, 3, "mansion: out onto the upper gallery", (r) => r.end[2] < 20.3 && r.end[1] > 4.1],
  [66, 4.2, 19.5, 0, -1, 2, "mansion: the gallery rail holds", (r) => r.end[2] > 18.2 && r.end[1] > 4.1],
  [75.4, 0.4, 29.4, 0, 1, 2, "mansion: out the back door", (r) => r.end[2] > 30.8],
  [64, 4.2, 26.5, 0, 1, 2, "mansion: the stairwell rail holds", (r) => r.end[1] > 4.1],
  // phase 6d: the moat (bridges + wading), the cave path through Skull Mountain
  [69.5, 0, 11, 0, 1, 4, "moat: over the north bridge", (r) => r.end[2] > 17 && r.maxY >= 0.5],
  [61, 0, 11, 0, 1, 5, "moat: wade across", (r) => r.end[2] > 17],
  [62, 0, 35, 1, 0, 5, "mountain: into the cave path", (r) => r.end[0] > 74.5],
  [75.1, 0, 35, 0, -1, 3, "mountain: out its north end", (r) => r.end[2] < 30.4],
  [78.8, 0, 21.7, 1, 0, 3, "moat: east bridge to the lawn", (r) => r.end[0] > 84.5 && r.maxY >= 0.5],
  [66, 0, 36.5, 1, 0, 4, "mountain: the rock stops you", (r) => r.end[0] < 76.3],
  // phase 6e: the coaster station, the brake deck's stair and rail
  [53.0, 0, -20.15, 1, 0, 3, "coaster: up onto the loading platform", (r) => r.end[1] > 1.1 && r.end[0] > 57],
  [82.2, 0, -19.5, 0, -1, 5, "coaster: up the stair to the brake deck", (r) => r.end[1] > 8.9],
  [81.5, 9, -33.5, -1, 0, 2, "coaster: the brake deck rail holds", (r) => r.end[0] > 80.1 && r.end[1] > 8.9],
  [62, 0, -6.5, 0, -1, 4, "coaster: through the stall alley", (r) => r.end[2] < -14],
  [60, 0, -14, 1, 0, 4, "coaster: along the walkway behind the stalls", (r) => r.end[0] > 70],
  ],
  // Trollface Island (trollface-island.js). Landmark centres: peak (56.8, -43.4),
  // cave (-9.1, -32.6), portal (120.8, -100.6), skate (131.7, -61.5), bridge z 77.8 from x -56.3 to
  // -0.5, boat (99.9, 16.3), gallery (-99, 45.3), shop (38.6, 77.8).
  trollface: [  [56.8, 0, -12, 0, -1, 4, "peak: up to the first terrace", (r) => r.maxY >= 4.5],
  [77.6, 4.7, -43.4, -1, 0, 4, "peak: first terrace -> second", (r) => r.maxY >= 8.4],
  [56.8, 8.7, -57.6, 0, 1, 4, "peak: second terrace -> third", (r) => r.maxY >= 12],
  [51.0, 12.3, -37.5, 1, 0, 6, "peak: third terrace -> the east balcony", (r) => r.maxY >= 17.9],
  [63.3, 18.1, -38.3, -1, 0, 6, "peak: east balcony -> west balcony", (r) => r.maxY >= 23.9],
  [50.3, 24.1, -38.4, 1, 0, 6, "peak: west balcony -> the hut", (r) => r.maxY >= 29.9],
  [-9.1, 0, -16, 0, -1, 7, "cave: through the tunnel", (r) => r.end[2] < -45],
  [116.8, 0, -85.8, 0, -1, 4, "portal: up onto the plateau", (r) => r.maxY >= 2.2],
  [122.8, 3.0, -99.0, 0, -1, 4, "portal: up the dais to the door", (r) => r.maxY >= 4.4],
  [101.8, 0, -98.4, 1, 0, 8, "portal: in through the blast door", (r) => r.end[0] > 110],
  [100.8, 0, -102.1, 1, 0, 6, "portal: up the west flight", (r) => r.maxY >= 2.9],
  [124.7, 0, -65.5, 1, 0, 30, "skate: over the big bowl and out", (r) => r.end[0] > 153 && r.maxY >= 1.7],
  [128.7, 0, -50.5, 1, 0, 30, "skate: along the half-pipe, deck to deck", (r) => r.end[0] > 156 && r.maxY >= 2.3],
  [125.7, 0, -53.5, -1, 0, 14, "skate: through the small bowl", (r) => r.end[0] < 113 && r.maxY >= 1.1],
  [157.7, 0, -85.1, -1, 0, 6, "skate: in the snack shack's door", (r) => r.end[0] < 152],
  [-61, 0, 77.8, 1, 0, 15, "bridge: across the river, dry", (r) => r.end[0] > 0],
  [85, 0, 16.3, 1, 0, 5, "boat: up onto the deck", (r) => r.maxY >= 1.2],
  [-99, 0, 64, 0, -1, 4, "gallery: in the south door", (r) => r.end[2] < 56],
  [38.6, 0, 90, 0, -1, 4, "shop: in the front door", (r) => r.end[2] < 83],
  ],
};

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
// ANGLE=swiftshader STEP=1 for a machine without a d3d11 GPU (Linux containers):
// STEP drives movement at a fixed 60 Hz instead of waiting on frames
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
await ctx.route(/supabase/, (r) => r.abort());
// Kabukigrin (docs/KABUKIGRIN.md) keeps Grinjuku's B side and routes, and
// walls A site into a club: every way into the hall is a doorway now. A
// Ramps' deck went with the club's front wall (it stood in front of the
// pole dancer's screen), so its route goes too
RUNS.kabukigrin = [...RUNS.grinjuku.filter((r) => r[6] !== "A Ramps steps -> deck"),
  [-27.6, 0, -2, 0, 1, 3.5, "A Main -> the club's main door", (r) => r.end[2] > 7],
  [-27, 0, 29, 0, -1, 3, "kitchen -> hall (west back door)", (r) => r.end[2] < 21],
  [-16, 0, 29, 0, -1, 3, "green room -> hall (east back door)", (r) => r.end[2] < 21],
  [-27.5, 0, 37, 0, -1, 3, "yard -> kitchen (west yard door)", (r) => r.end[2] < 31],
  [-15.5, 0, 37, 0, -1, 3, "yard -> green room (east yard door)", (r) => r.end[2] < 31],
  [-2, 0, 28.5, -1, 0, 3, "the backs -> green room (east door)", (r) => r.end[0] < -9],
  [-22, 0, 27.6, 1, 0, 2.5, "kitchen -> green room (partition door)", (r) => r.end[0] > -17],
  [-27.6, 0, 12, 0, -1, 3.5, "hall -> A Main (out the main door)", (r) => r.end[2] < 0],
  // phase 3: both Mains end to end past the street furniture (poles, bollards, kei trucks)
  [24.5, 0, -30, 0, 1, 6, "down B Main", (r) => r.end[2] > -2],
  [24.5, 0, 1, 0, -1, 6, "up B Main", (r) => r.end[2] < -26],
  [-24.5, 0, 1, 0, -1, 6, "up A Main", (r) => r.end[2] < -26],
];
const maps = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(RUNS);
let fails = 0;
for (const map of maps) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("ERR", e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (map) => {
    const T = window.__trollOps;
    // Trollface Island only exists in Troll Royale (buildMap falls back to
    // Grinsite for it elsewhere): Royale with no bots and no drop
    const royale = map === "trollface";
    if (royale) { T.DROP.enabled = false; if (T.els.noBots) T.els.noBots.checked = true; }
    T.setMode(royale ? "royale" : "ops"); T.loadout.mapId = map;
    await T.startGame(); if (T.isStaging()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
  }, map);
  await new Promise((r) => setTimeout(r, +(process.env.SETTLE || 6000)));   // SETTLE=ms for a map that loads slowly
  console.log(`\n${map}`);
  for (const [x, y, z, fx, fz, secs, label, check] of [[0, 0, 0, 0, 1, 1.5, "warm-up", () => true], ...RUNS[map]]) {
    const r = await page.evaluate(async ([x, y, z, fx, fz, secs, step]) => {
      const T = window.__trollOps;
      T.keys.clear();
      T.move.pos.set(x, y, z); T.move.velocity?.set(0, 0, 0);
      await new Promise((r) => setTimeout(r, 400));
      T.look.yaw = Math.atan2(-fx, -fz); T.look.pitch = 0;
      const startY = T.move.pos.y;
      let maxY = startY;
      if (step) {
        // stepped: drive the movement controller at a fixed 60 Hz in one go,
        // for software GL that can't render fast enough to walk in real time
        const yaw = Math.atan2(-fx, -fz);
        for (let i = 0; i < secs * 60; i++) {
          T.move.update(1 / 60, { forward: 1, strafe: 0, yaw, speedMult: 1, sprintMult: 1.35 });
          maxY = Math.max(maxY, T.move.pos.y);
        }
      } else {
        T.keys.add("KeyW");
        const t0 = performance.now();
        while (performance.now() - t0 < secs * 1000) {
          T.look.yaw = Math.atan2(-fx, -fz);
          maxY = Math.max(maxY, T.move.pos.y);
          await new Promise((r) => setTimeout(r, 50));
        }
        T.keys.delete("KeyW");
      }
      return { startY: +startY.toFixed(2), maxY: +maxY.toFixed(2), end: [+T.move.pos.x.toFixed(1), +T.move.pos.y.toFixed(2), +T.move.pos.z.toFixed(1)] };
    }, [x, y, z, fx, fz, secs, !!process.env.STEP]);
    if (label === "warm-up") continue;
    const ok = check(r);
    if (!ok) fails++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(40)} max y ${r.maxY}  end ${JSON.stringify(r.end)}`);
  }
  await page.close();
}
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
