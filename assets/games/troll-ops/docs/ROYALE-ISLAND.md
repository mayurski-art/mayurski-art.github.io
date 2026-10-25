# Troll Royale: Trollface Island, map pass (design, 2026-10-14)

Scope: the island's layout, points of interest (POIs), loot, cover and pacing.
Not in scope: global shading (the stylised-realism pass owns it) and Blender
landmark art (on hold; ask first). Everything new here is built from the map's
own grey-box kit (`GreyKit`: merged meshes per material, AABB colliders).

## What the survey found (2026-10-14, after the C-130 went live)

- **A flat meadow with long sightlines.** Away from the landmarks the island
  is open grass with ~45 lone boulders and the tree clumps. From most fields
  you can see (and be seen from) 150 m in three directions.
- **Loot doesn't make places matter.** 281 floor items (134 guns), spread by
  area: 168 of 168 dry 20 m cells have loot within 25 m. Only ~46% lands near
  a landmark, and only because landmarks cover that much ground. Rarity is the
  same everywhere (common 50, uncommon 30, rare 14, epic 5, legendary 1 per
  100 guns). The Boat and the Bridge get nothing. There's no reason to drop
  hot and no reward for the risk.
- **Most landmarks are shells.** Only Troll City has rooms (four ground-floor
  lobbies). The Observatory and the Shop are one room each; the Market,
  Gallery and Meme Lab are open; nothing has an upper floor to fight from.
- **The lake splits the island.** It's 22% of the land, in the middle, a slow
  wade with no cover. The only crossings are the south Bridge and wading; the
  Dock is a dead end.
- **Thin, empty edges.** The west meadow (between Meme Lab and the Gallery),
  the east coast (the Boat to the Marketplace) and the south shore have no
  POI at all.
- **Pacing** (HANDOFF "small known gaps"): with 99 bots, ~10 are left by 2.5
  min while the zone runs ~9.5 min. Still open: fewer bots, or a post-kill
  cooldown.

## The proposal

Plan image: sent with this doc (the island, today's loot, the tiers, the new POIs and crossings).

### 1. POI tiers and loot (code only, no new geometry)
- Each landmark gets a tier. **Hot:** Troll City, Troll Peak, The Portal, the
  Skate Bowl. **Mid:** the Cave, Gallery, Shop, Marketplace, Observatory,
  Meme Lab, the Boat. **Minor:** the Dock, Old Tree, the Bridge.
- `lootSpots` takes a weight per spot: hot POIs 2.5x the density with rarity
  shifted up one step on a third of the guns, mid 1.5x, open field 0.6x. The
  total stays ~280 items, so the frame cost doesn't move.
- Loot goes indoors too (city lobbies, Observatory, Shop) and on the Boat and
  the Bridge.
- Bots' landing picks weight hot POIs, so a hot drop is a real fight.
- The zone's last circles lean toward POIs with cover, not open meadow.

### 2. Cover and crossings
- Hedgerows, dry-stone walls and fences across the big meadows. Boulders come
  in groups of 3-5 instead of singletons.
- Target: no dry spot more than ~15 m from hard cover (measured by script,
  as the loot cells were).
- Two boardwalks across the lake (west: the Cave to the Bridge; east: Troll
  Peak to the south shore), waist-high rails for cover, so the lake is a
  route rather than a moat.

### 3. New POIs in the empty stretches (grey box, two floors each)
- **Cope Farm** (west meadow): a barn with a hayloft, a silo, hay bales.
- **Ratio Radio** (east coast): a radio mast with a climbable platform, and
  the station shack.
- **Jeet Junction** (north road): a truck stop, its store and the canopy.
- **Lakeside Cabins** (south shore): three cabins and a jetty.
- **Hopium Isle** (mid-lake): a small islet with reeds and a supply crate,
  reached by the east boardwalk.

### 4. Pacing (your call)
Pick one:
- **a. Shorter zone** to match the kills: ~6 min instead of ~9.5.
- **b. Post-kill cooldown for bots:** after a kill a bot loots and heals for
  10-20 s before it hunts again.
- **c. Fewer bots:** 64 instead of 99.

The POI tiers (phase 1) will also bunch the early fights, which speeds things
up a little more. My pick: **b**. It keeps the 100-troll feel and the full
zone.

## Perf budget
- New geometry goes through GreyKit (merged per material): at most +10 draw
  calls and +60k triangles for the whole pass. Hedges and grass go through
  instanced clutter (thinned by graphics tier).
- No new lights (light-pool rule).
- Gate per phase: `troll-ops-map-fps.mjs trollface` and `royale-fps.mjs 20
  100` within 5% of main; royale-drop, royale-island, royale-bots and
  royale-phase-c pass.

## Phases (each: before/after shots, fps, tests, push on your OK)
1. POI tiers and weighted loot, bot landings, zone lean.
2. Cover pass and lake boardwalks.
3. The five new POIs.
4. Pacing, the option you pick.

## Blender build-out: style sheet (phase 0, 2026-10-25)

The island's Blender build (doc "Troll Forces: Trollface Island in Blender",
builder `models/build_trollface_island.blender.py`, kit `models/tf_kit.py`)
keeps to this sheet from phase 1 on. Refs: `refs/island/` (the overview,
Troll City, Troll Peak, Rage Ranch, Lighthouse Point).

- **Look.** Low-poly faceted, night-lit: flat-shaded rock and ground with
  visible facets, bevelled edges on built things (0.02-0.05 m), no smooth
  shading except on cylinders and the dome. Every place reads as one
  silhouette from 330 m (the dome, the mountain, the bowl, the gate, the
  pyramid, the lighthouse, the cooling towers) and keeps it in its far shell.
- **Materials.** One vertex-painted TF_Paint for every flat colour (map_kit
  folds them); photo surfaces only from the shared set (GS_Tile, GS_Plank,
  GS_Marble, GS_Concrete, the rock, sand, grass and dirt sets), plus one
  decal and graffiti atlas and two trim sheets (phase 1). Emissive only on
  real light sources and signs, never a whole wall. Nothing new unless a
  phase argues for it in its review.
- **Palette.** Troll City blue 0x3a9ee6 / 0x7b98e0 / 0x86c4ee and yellow
  0xf2cf4a with 0xfff1c2 windows; the Peak's purple 0x7b5cc7 family with
  snow; the Portal's green glow; wood 0x8a6a3e-0x5c4327; red barn 0xa8322a;
  lighthouse white with a 0xd23b2f band. Grass and sand stay the ground
  shader's.
- **Prop scale.** A door is 2.2 x 1.0 m, a table 0.75 m high, a crate 0.9 m,
  a bottle 0.3 m, a car 4.4 x 1.8 x 1.5 m, a lamp post 4 m, a sign board at
  2.4-3.0 m. Props cluster inside a place's ring; between places only the
  cover kit (hedgerows 1.1 m, dry-stone walls 1.0 m, fences 1.2 m, boulder
  groups 1-2.5 m) and instanced clutter.
- **Graffiti and motif.** The trollface recurs on purpose at five places
  (the dome, the Portal's gate, a city mosaic, the Peak hut's window, the
  Ranch's scarecrow and barn, the Shop's neon as an outline) and nowhere
  else; graffiti tags at most one per wall face, none on a sign or screen.
- **Rule 9 checklist per place.** Every sign, screen, window, doorway and
  lit face registered (`Registry.face`); raycast from the eye grid round
  the place; shot head-on and from two angles; no prop bounds crossing
  another's unless it stands on it; nothing flush-mounted behind a proud
  piece.
- **Budget per place.** Hot 1.2 MB, mid 0.6 MB, minor 0.3 MB, new 0.4 MB;
  one material set shared; a far shell past 120 m; 14 MB for the whole
  island's GLBs plus bakes.
