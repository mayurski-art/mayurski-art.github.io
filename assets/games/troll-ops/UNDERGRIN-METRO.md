# Undergrin redesign: a Metro (2025) station — DESIGN DOC, awaiting the user's OK

Drafted 2026-10-07. Nothing in this doc is built yet. The user asked for a
redesign of Undergrin "inspired by Phantom Forces' Metro" and sent a clip of
the newer **Metro (2025)** map played through the *fleasion* mod (flat
colours, full-bright). The user's call: **"I want the modded version"**, so
the target look is the clip, not the real game's dark lighting.

References (local only, never commit): `refs/metro-2025/` (README.txt lists
each sheet and where it came from). Wiki:
https://roblox-phantom-forces.fandom.com/wiki/Metro/2025

---

## 1. Goal

Replace Undergrin (one 37 x 78 m station box, dark and foggy, the slowest
map we have) with a three-level metro station in the Metro (2025) mould:

- two team-owned platform halls with a yellow U-Bahn train parked at each,
- escalators up to a bright upper concourse: a long hall per side with a glass
  barrel skylight, meeting in a big arched **central atrium** (the main
  fight),
- a row of shops along both long walls upstairs (the safe flank, like
  Metro's shop doorways),
- a track-level loop underneath: both tunnel bores plus a **plant room** under
  a light well in the atrium floor (Metro's "Tunnel" point, shot at from
  above),
- the **purple room** and **red room** stairs linking the shop row down to the
  bores.

Same id (`undergrin`), same name, new blurb. The old `ug-*.glb` set and the
current `MAPS.undergrin` build are replaced wholesale; nothing of the old
layout survives except the idea of a train you can walk through.

## 2. What the references say

Clip (modded) + three YouTube matches (storyboard frames) + the wiki:

| Metro (2025) feature | Keep? | Notes |
|---|---|---|
| Platform hall: grey square columns, flat coffered ceiling, tube lights | yes | |
| Yellow U-Bahn trains, black window band, white doors, blue seats, walk-through | yes | the clip walks straight through a car |
| Yellow painted platform zones + white floors, blue benches, brick accent walls | yes | |
| Angled escalators from platform to the upper halls | yes, straight | wood-brown sides, yellow nosings, dark treads |
| Side halls: salmon/terracotta band on white, thin blue stripe, glass barrel skylight | yes | the signature look |
| Central atrium: round arches, square skylight grid, departure board, clock, pendant lamps, ticket gates, kiosks | yes | |
| Shop row: arcade (black neon carpet), lounge (red sofas, fireplace), café, server room | yes | troll-flavoured contents |
| Purple room / red room with a steel stair down | yes | |
| Basement "Tunnel" room with no cover, shot from the floor above | yes | = plant room under the light well |
| German ads (Bundesluftverkehr, EU flag, ICE) | replaced | our own trollface posters; the station is UNDERGRIN |
| Dark, moody in-game lighting | **no** | user wants the modded full-bright look |

## 3. The look (the "modded" spec)

Flat paint, no photo textures, no shadows, no fog to speak of, every surface
lit evenly. In engine terms:

- `sun.intensity 0` (no shadow pass), `hemi` ~0.5, `ambient` white ~1.35,
  `exposure 1.0`, fog `0xe8e6e2 @ 0.004`, sky black (underground).
- **Zero real lights** (`api.lamp`) in the whole map. Today's Undergrin has 26
  and is the slowest map; this should become one of the fastest. Tube lights,
  EXIT signs, the departure board and pendant lamps are emissive paint only.
- Every Blender material is a flat colour that is NOT in `map-models.js`
  RETEXTURE, so it exports as vertex paint (that is exactly what the mod does
  to the real map). `castShadow: false` on every `mapModel`.

Palette (from the clip):

| Thing | Colour |
|---|---|
| wall tile / ceilings / hall floors | `#e6e4df` white-warm, floors `#ececea` |
| upper-hall band | `#c9704e` salmon, with a `#2f5fd0` stripe above it |
| platform floor zones | `#e5b84a` yellow on `#e8e6e0` |
| columns, escalator wells, track bed | `#8a8d92` grey, `#3e4146` dark |
| train | `#f2c230` body, `#1e1e22` window band, `#f4f4f0` doors, `#2b4bd6` seats |
| benches | `#2d50d8` |
| escalator sides / nosings | `#7a5a3a` brown / `#e8ad22` yellow |
| skylight glass / mullions | `#2a3340` / `#c8c8c4` |
| brick accents | `#8c4a3a` |
| EXIT signs | `#38d060` emissive; board text `#ff8a1e` + `#ff3fa4` |
| purple room / red room trim | `#8a3fc8` / `#c8302a` |

Troll flavour: UNDERGRIN roundels, a "GRINLINE" departure board (Trollhalla,
Jeetsburg, Dust Bowl, Grin Beach...), "MIND THE GRIN" on the platform edge,
trollface posters from our own art (`assets/images/icons`, banners), the
arcade is full of Troll Kombat cabinets, the lounge hangs the troll general's
portrait, the train's destination blind reads TROLLHALLA.

## 4. Layout

Axes as everywhere in this game: x east (+) / west (-), z south (+) /
north (-). **Jeets spawn north (z-), Trolls south (z+).** The map is
point-symmetric: the south half is the north half rotated 180 degrees about
the origin, so both teams get the same map (Metro is praised for being
"somewhat symmetrical"). Dressing differs per shop, geometry does not.

Bounds: x -22..22, z -44..44 (44 x 88 m; today 37 x 78). Outer walls are
1.5 m colliders outside those faces.

Three floors:

| Level | y | What's on it |
|---|---|---|
| **T** track | 0 | both tunnel bores, the plant room, the service corridors, walkways |
| **P** platform | 0.95 | island + side platforms, train floors |
| **U** concourse | 6.0 | halls, atrium, shop rows, purple/red rooms |

P is 0.95, not today's 1.1, on purpose: the bot flow field steps 1 m, so bots
treat the platform edge as walkable (they vault it) instead of needing a
stair; players (STEP_UP 0.36) jump or use the end stairs, as on a real
platform. The U slab is 0.4 thick (5.6..6.0).

### 4.1 Track + platform level, north station (z -44..-14)

```
 x: -22      -14.25 -9.75           9.75  14.25      22
     |  W side |  W   |    island     |  E  | E side  |
     | platform| bore |   platform    | bore| platform|
     |   P     | T    |      P        |  T  |    P    |
                train              (empty track)
```

- **W side platform** x -22..-14.25 at P. Brick back wall with posters and a
  roundel, blue benches, a vending machine, the **west stair** up to the hall
  (foot at z -43.5 on the platform, 17 steps x 0.3 rise / 0.5 run heading
  south, top at z -35, x -21.5..-17.5; the slab has a well there).
- **W bore** x -14.25..-9.75 at T: rails, sleepers, ballast. The **north
  train** is parked here, z -42..-16: two cars 12.5 m long, 3.4 m wide
  (x -13.7..-10.3), floor at P on a 0.95 undercarriage, 3 doors per side per
  car (1.4 wide), seats along the walls, a closed cab at each end, gangway
  between cars. The gap train-to-platform is <= 0.45 so nobody drops into it.
  Walking through the train is the covered crossing between the W side
  platform and the island.
- **Island platform** x -9.75..9.75 at P. Columns 0.7 sq at x +-6, z -40,
  -34, -22, -16 (none in the escalator well). Yellow zone painted round the
  escalator foot. The **twin escalators** rise SOUTH from the platform to the
  hall: feet at z -27, 17 steps x 0.3 / 0.5, tops at z -18.5, lanes centred
  x -1.9 and +1.9 (1.4 wide each, a 0.3 balustrade between). The slab well is
  x -3.6..3.6, z -28..-17. At the platform nose (z -14) a 4-step stair
  (x -1.5..1.5) drops south to T onto the **north walkway** (x -2..2,
  z -14..-8) and the plant room's north door.
- **E bore** x 9.75..14.25 at T: empty track at this station (the south
  train is parked at the far end of this bore). 4-step stairs at the bore's
  north end (z -42) up to the island and the E side platform, like today's
  track-end steps.
- **E side platform** x 14.25..22 at P, same furniture as the west, no stair.
- Hall ceiling: the U slab over the whole station except the escalator well
  and the west stair well. Tube lights in rows (emissive), the coffers drawn
  in the model.

South station = all of the above rotated 180 degrees: the south train sits on
the E bore at z 16..42, the east stair rises from the E side platform at the
south end, escalators rise north, etc.

### 4.2 Track level, central section (z -14..14)

- Both bores run through as enclosed tunnels (ceiling at 4.0, tunnel-shaped
  in the model, box collider). Each has a door (1.8 wide) in its inner wall at
  z -4 / +4 into the plant room, and a door in its outer wall at z -6 (W) /
  +6 (E) into the service corridor under the purple / red room.
- **Plant room** x -9.75..9.75, z -8..8, floor T, ceiling = the atrium slab,
  with the **light well** (x -4..4, z -4..4) open to the atrium 6 m above.
  Doors: north walkway (z -8, x -0.9..0.9), south walkway, W bore, E bore.
  Cover is low only (<= 1.2 m: generator, cable drums, switch cabinets along
  the walls, a pump skid) so the well still sees most of the floor. This is
  the hill in KOTH and the natural S&D / FFA knife fight: exactly Metro's
  "Tunnel" room, "no cover at all, users firing from the upper level can
  easily wipe out anyone trying to capture the point".
- **Service corridors** x -22..-15.75, z -12..0 (west) and x 15.75..22,
  z 0..12 (east), floor T, ceiling at U-0.4, each holding the steel stair
  from the room above (20 steps x 0.3 / 0.3 run along z) and a door into its
  bore. Lockers, a fuse cabinet, a mop bucket.
- The long empty halves of the bores (60 m from a train's nose to the far
  station) are a sniper lane. A works trolley at z +-2 and a signal cabinet at
  z +-10 in each bore break the line into ~25 m pieces; tune in the walk
  tests.

### 4.3 Concourse, U = 6.0

```
 z -44  -40            -16        0        16            40  44
   |stair|  NORTH HALL   |      ATRIUM      |  SOUTH HALL   |stair|
   | well|  (Jeets)      |  arches, board   |  (Trolls)     | well|
   W shops: Arcade | Grinbiss | PURPLE | Lounge | Apotrolle | Books
   E shops: Books  | Apotrolle| Lounge | RED    | Grinbiss  | Arcade
```

- **North hall** x -16..16, z -40..-16, salmon band on white, the blue
  stripe, a glass barrel skylight along z (springs at 9.0, rises 3.0, crown
  12.0), posters on the long walls, two blue benches, a photo booth and a
  ticket machine pair as cover near the escalator top. The escalators arrive
  at the hall's south end (well rails round them); the west stair arrives in
  the NW corner. Doorways west into the shop row at z -33, -19 and east at
  z -33, -19.
- **Atrium** x -16..16, z -16..16, walls to 9.0, round arches (span 14,
  springing 7.5) on the north and south thresholds and a flat ceiling at 15
  with a 20 x 20 skylight grid. Cover: the **light-well rails** (x +-4,
  z +-4, 1.1 high), a **ticket-gate line** at z -12 and z +12 (six 0.3 x 1.2 x
  1.0 gates x -7..7 with 1.1 gaps, a staffed gate box at x +-9), an info desk
  at (-9, 0) 3 x 2, a newsstand at (9, 0) 3 x 2.4, benches at (0, +-9). The
  GRINLINE departure board hangs over z -12 at 9.5, the clock on the south
  arch, pendant lamps down the middle. Two doorways each side into the shop
  rows (z -8, 8).
- **Shop rows** x -22..-16 (west) and 16..22 (east), z -40..40, partitions
  at the z values below (0.3 thick) with a 1.8 doorway in every partition at
  x -19 / 19, so the row is a corridor of rooms from end to end: Metro's
  "move with relative safety" flank. Ceilings flat at 9.6.

  | West unit (z) | Contents | East unit (z) | Contents |
  |---|---|---|---|
  | -40..-26 Arcade | Troll Kombat cabinets, neon-pattern black carpet | -40..-26 Books | shelves, a reading table |
  | -26..-12 Grinbiss | counter, menu board, two tables | -26..-12 Apotrolle | counter, shelves of bottles |
  | -12..0 **Purple room** | purple trim, the steel stair down (well in the floor x -21..-18, z -10..-4) | -12..0 Lounge | red sofas, fireplace, cow-print rug, the general's portrait |
  | 0..14 Lounge | as east | 0..12 **Red room** | red trim, the stair down |
  | 14..26 Apotrolle | as east | 12..26 Grinbiss | as west |
  | 26..40 Books | as east | 26..40 Arcade | as west |

- **South hall** = the north hall rotated; the east stair arrives in its SE
  corner.

### 4.4 Lanes

Per side there are five ways to the other team: the upper hall through the
atrium (the main lane, 56 m end to end down x 0, broken by the gates, desks
and well rails), the shop row (the flank), the two bores (the sneak, hits
the far station's empty track or runs into the parked train), and the
walkways through the plant room (the knife fight). Vertical links per
station: twin escalators, the side stair, the platform-nose stair, two
bore-end stairs, the purple/red stair, plus vaulting the 0.95 platform
edge. "Stuck in place" (the 2026-10-01 complaint) should be gone for good.

## 5. Modes, spawns, bots

- **Spawns** (ring, `[x, z]` or `[x, z, 6]` upstairs), north side:
  `[-18, -40] [18, -40] [-6, -41] [6, -41] [0, -37] [-18, -30] [18, -30]
  [-8, -36, 6] [8, -36, 6]`; south side the negatives. 18 total (today 14).
  `splitSpawnSides` splits along z (the longest gap), so S&D attackers get
  one station and defenders the other.
- **S&D sites:** `pickBombSites` gives a 44 m-wide map sideways spread of
  x +-11.9 on the defenders' half, i.e. on the bores next to the parked train
  and the empty track. If a site snaps somewhere silly, add `bombSites` the way
  Dust Bowl fixes its A/B.
- **KOTH:** `pickHillPoints` starts at the centre on the ground floor = the
  plant room under the light well. Intended.
- **Bots** spawn on the ground floor and live there (platforms, bores, plant
  room, trains); they take stairs via planStair but don't seek the upper
  floor, so the concourse is mostly a player-vs-player space in bot matches.
  Same as the Grinleria today; accepted, noted in HANDOFF's known gaps.
- **Zombies:** none (as today). **Socialize:** none.

## 6. What gets built (assets)

`models/build_undergrin.blender.py` is rewritten from scratch (same file
name); the current `ug-*.glb` are deleted and replaced by:

| GLB | Contents |
|---|---|
| `ug-shell` | outer walls, the U slab with its wells, columns, coffered platform ceiling, bores, plant room, service corridors, hall walls, atrium walls, arches, the skylight vaults and grid |
| `ug-platforms` | platform slabs with yellow zones, edge strips, MIND THE GRIN, bore floors, rails/sleepers, bore-end and nose stairs |
| `ug-escalators` | both escalator pairs, the side stairs, the purple/red steel stairs, well rails (reuse Grinleria's `escalator()` and `steel_stair`) |
| `ug-trains` | the two trains, interiors included |
| `ug-concourse` | gates, desks, newsstand, benches, board, clock, pendants, posters, roundels, tube lights (emissive) |
| `ug-shops` | all twelve shop interiors |
| `ug-plant` | plant room + corridor props |

Every collider lives in `maps.js` (`MAPS.undergrin.build`), the Blender
numbers are copies. Doorways >= 1.8 m. Colliders for the arches are the
walls; the vaults have no collider (ceilings at 9+ are out of reach).

## 7. Phases (one system per commit, `node tools/troll-ops-gate.mjs` before every push)

| # | Phase | Gate |
|---|---|---|
| 0 | this doc approved; refs saved | user OK |
| 1 | **Blockout**: new `MAPS.undergrin` colliders as coloured `api.box`es (no GLBs), bounds, spawns, blurb; `tools/troll-ops-map-walk.mjs` routes for every lane and every vertical link | map-audit, map-walk, bot-stuck, bot-moves pass; fps vs main with `map-fps` |
| 2 | **Light + look pass** on the blockout: the full-bright constants, zero lamps, dressing entry (decals only) | screenshots at the 6 views from `map-shots`; the user signs off the look before any Blender |
| 3 | **Blender A**: shell, platforms, escalators, trains | shots again; walk tests unchanged (colliders don't move) |
| 4 | **Blender B**: concourse, shops, plant props, signage/posters | shots; draw-call count <= today's |
| 5 | **Finish**: loading-screen renders (`map-previews`, bump SHOT_V), ambience (brighter: tube hum, PA chimes, trains), HANDOFF one-liner, memory | gate green, push |

Estimate: 5-7 sessions (Dust Bowl's bazaar took 5 for a smaller change).
Phases 1-2 need no Blender at all, so the layout can be played and changed
cheaply before any art exists.

## 8. Decisions (the user, 2026-10-07)

- **Replace** the old Undergrin outright.
- **Bots adaptive**: they choose for themselves whether to take a stair or
  escalator or vault the 0.95 m platform edge. Every flight is an
  `api.stairs` link, so bots.js `planStair` ranks them by walking distance
  and `updatePerch` sends idle bots upstairs on their own.
- **Light well: yes.**
- **Fully flat** paint, no textures.
- Still open: shop names (4.3) and the blurb; defaults stand unless changed.

## 8b. The questions as first asked

1. **Replace, not add:** the old Undergrin goes away (it is the slowest map).
   Alternative: keep it as "Undergrin Classic" for a while. Recommended:
   replace.
2. **Platform height 0.95** (bots vault it, players jump) vs today's 1.1
   (stairs only). Recommended: 0.95.
3. **The light well** over the plant room (vertical sightline onto the hill)
   — yes/no. Recommended: yes, it is the Metro "Tunnel" feel.
4. **Shop list** in 4.3: swap any names.
5. **Textures:** fully flat (the mod) vs a faint tile on floors. Recommended:
   fully flat; it is also why the map will run fast.
6. **Name/blurb:** keep "Undergrin"; new blurb "Two platforms, two trains,
   the shops upstairs and the plant room under the light well. Mind the grin."

## 9. Risks

- The bores are 88 m straight: without the trolley/cabinet breaks they are
  sniper alleys. Checked in phase 1's walk tests and shots.
- Point symmetry means both trains are on opposite bores; S&D sites on the
  defenders' half will favour one bore. Verify by playing, adjust with
  `bombSites`.
- `surf()` tiling is irrelevant (flat paint), but long flat boxes in the
  BLOCKOUT phase use `api.box` with colours only; no textures, no smear.
- The upper floor is bot-free in practice; if that feels empty, phase 1 can
  move a few bot spawns to the side stairs' feet so bots drift up more.

## 10. Built assets (2026-10-15, branch `claude/tf-undergrin-metro-b6c156`)

`models/build_undergrin.blender.py` is rewritten from scratch. Rebuild one or
more GLBs with
`blender -b -P models/build_undergrin.blender.py -- shell platforms ...`.
The numbers in it are copied from sections 3 and 4. They are not colliders.

| GLB | Size | Contents |
|---|---|---|
| `ug-shell` | 461 KB | outer walls, U slab with its wells, columns, coffered ceiling, bores, plant room and corridor walls, hall and atrium walls, arches, skylight vaults, shop walls, the 20 x 20 atrium grid |
| `ug-platforms` | 224 KB | platform slabs, yellow zones, edge strips, MIND THE GRIN, bore floors, rails and sleepers, bore-end and nose stairs |
| `ug-escalators` | 419 KB | both escalator pairs, the side stairs, the purple and red steel stairs, well rails |
| `ug-trains` | 475 KB | two yellow trains with interiors, trollface ads, TROLLHALLA blinds |
| `ug-concourse` | 1,081 KB | gates, desks, newsstand, benches, the GRINLINE board, clock, pendants, posters, roundels, hanging signs, EXIT signs, tube lights |
| `ug-shops` | 672 KB | the twelve shop interiors, the Troll Kombat arcade, the lounge with the general's portrait, the purple and red rooms |
| `ug-plant` | 134 KB | plant room kit, corridor and bore props |

The new set totals 3.47 MB, within the ~6 MB budget.

**How it's painted**

- Every material is a flat `UG_*` colour that is not in RETEXTURE, so the GLBs carry vertex paint only.
- The emissives keep their own material: tube lights, EXIT signs, board text, screens, neons, fire, pendants, the green cross and headlights.
- There are no lamps or textures in any file.
- The trollface art is a cell mosaic of `assets/pfp/base/og.webp`.

**Checks**

Every GLB was rendered full-bright from the doc's views, with at least two render-and-fix rounds each. The renders are not committed.

**Wiring session to-do**

The assets session touched no game code.

1. `maps.js` `MAPS.undergrin`:
   - colliders from sections 3 and 4
   - spawns from section 5
   - the section 3 lighting constants (sun 0, hemi ~0.5, ambient ~1.35, fog `0xe8e6e2 @ 0.004`, black sky)
   - zero `api.lamp`
   - the seven new `mapModel`s, each with `castShadow: false`
2. Delete the four old GLBs (`ug-station`, `ug-train`, `ug-fittings`, `ug-expansion`) and anything that loads them.
3. Map previews and loading-screen renders, then bump `SHOT_V`.
4. Run the targeted tests (map-audit, map-walk, bot-stuck, map-fps) per CLAUDE.md. Use no gate and never a public room.
5. Add a HANDOFF one-liner.
