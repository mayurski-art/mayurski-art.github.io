# Stylised realism: Cul-de-Grin first (design)

Status: **approved by the user 2026-10-13. Building on branch `tf-realism` (worktree `.claude/worktrees/tf-realism`).**

## Why

After Hood Warfare 2 (UE5), the user wants Troll Forces to look more real, but as a mix of cartoon and realism (Valorant, Fortnite, Overwatch). The characters stay trollfaces, so full realism would clash. The fix is light and surfaces, not new characters.

## Decisions (user, 2026-10-13)

**Locked by the user**
- Stylised realism, not full realism.
- Characters unchanged: white faces, ink lines. A soft rim is allowed.
- Cul-de-Grin first, with before/after screenshots. One map at a time after that.

**My defaults**
1. **Bake sky, bounce and the house lamps into a second UV (UV1) per GLB; the sun stays dynamic.** The 6 house GLBs are placed 16 times at 0 or 180 degrees, so a baked sun would be wrong on half of them. A sky bake looks right at any turn. three r160 adds a lightMap to irradiance, so the bake replaces hemi + ambient (hemi 0.9 to 0.45, ambient 0.5 to 0.2, lightMapIntensity about 0.6, tuned by luma). The 8 runtime house lamps go (baked in).
2. **Environment map from the sky dome**, set once at boot and swapped per map. The texture isn't part of the shader key, so no recompile. envMapIntensity 0.5 on map materials. Metal stops rendering black.
3. **Colour grade after tone mapping** (`GradePass` extends OutputPass): lift, gamma, gain, split-tone, saturation, contrast. No extra vignette. All tiers. The gun is drawn inside the composer (`ViewmodelPass`) so it gets the same grade.
4. **Rim = a fresnel term in the character materials**, sun-coloured. Never on the face, hands or guns. No new light.
5. **Perf:** GLB materials are shared per model instead of cloned per placement (440 materials on Cul-de-Grin). Merging the 16 houses is a later task.
6. Bakes ship as WebP. About 1.3 MB for the whole map.

## Built from what exists

| Need | Reuse | Where |
|---|---|---|
| Lightmap hook | `applyBakedLightMap` (fix: `channel = 1`) | surface-textures.js:100 |
| Bake loader | `BAKED`, `loadBakeTexture` | battlefield-props.js:29 |
| Model clone | `loadModel` | battlefield-props.js:64 |
| UVs + export | `Builder.finish` | models/map_kit.py:364 |
| UV stripping | `quantize_glb` | models/quantize_glb.py:144 |
| Old bake recipe | the sun-pinned house bake | models/build_houses.blender.py:31 |
| PMREM from a scene | the weapon studio | view/viewmodels.js:115 |
| Per-map light hook | `applyEnvironment` | game.js:1612 |
| Decals (walls too) | `dressMap` | map-dressing.js:498 |
| onBeforeCompile wrapper | `nightFx` | hollowgrin.js:186 |
| Ink-rim precedent | `cloth()` | outfits.js:20 |

## Build order (each step is its own commit, screenshot after)

| # | Step | Likely h |
|---|---|---|
| P0 | This doc; fixed camera views; Cul-de-Grin before shots | 1 |
| P1 | Environment map (sky moves to view/sky.js, view/environment.js); lightmap channel fix | 3 |
| P2 | Grade pass + gun inside the composer (warm its target-bound shaders) | 3 |
| P3a | Bake pipeline (map_kit UV1, models/bake_kit.py, quantize keeps UV1), house bakes, shared materials, the 8 lamps gone | 6 |
| P3b | Street and ground bake, bevels on curbs, posts, columns | 4 |
| P4 | Wear: graffiti and cracks on walls and sidewalks, glossy puddles, lawn patches | 3.5 |
| P5 | Rim light | 2.5 |
| P6 | Before/after sheet, luma check, fps x3, previews, cache tags `sr1`, HANDOFF | 2.5 |

No gate between steps (user, 2026-10-13); one gate when the user says push.

## Rollout (after buy-in)
The environment map, grade and rim reach every map at once (the grade is neutral until a map sets `grade`). Per map: a `grade` block, the hemi/ambient retune, a bake step in its Blender builder (indoor maps bake their lamps and drop them), a ground bake, wear decals. Procedural maps (Troll City, Trolling Loud, Pentagrin, range, hub) can't be baked: they get the environment, grade, rim and retune. Order: Grin Site, Hollowgrin, Undergrin, Depot, Dust Bowl, Grinleria, Grin Beach, Grinjuku, Trollface Island, then the procedural ones.

### How a map is baked (2026-10-14)
1. `node tools/troll-ops-map-placements.mjs <map>`: loads the map headless and writes `models/<map>-placements.json` (bounds, bake colours, every placed model, every point light).
2. In the map's builder, once: `bake_every_model(sky=(hemi sky, sky horizon, strength), ground=<ground colour>, context="<map>"[, lamps=40])`. `context` stands the rest of the map up round each model as it bakes; `lamps=40` bakes the map's point lights in (40 W a candela matches three), and then the map stops making them. Strength about 1.0 for a hemi near 1, higher for a strong hemi (Grin Beach 1.4, Grinjuku 1.7).
3. `blender --background --python models/bake_map_ground.blender.py -- <map> [strength] [lamp watts]`: the ground bake; it prints the rect for `groundBake`.
4. maps.js: `groundBake: { file: "<map>-ground", rect }`, hemi and ambient about halved, a `grade`, the models' names in battlefield-props.js `BAKED`, `groundLight()` on flat or scenery meshes the game draws (the road, palms, a city outside the wall: outside the rect they take the open-sky edge).
5. Shots before (`ROOT_DIR=<main checkout>`) and after, luma, the prefetch manifest.

Lessons from the rollout:
- Cycles doesn't denoise a bake. A surface lit only by bounce (the Depot's roof, under its office) is speckled at 128 samples: `finish(..., bake=dict(samples=512, blur=2))` for that model.
- A closed, white, lamp-lit room bakes hot (the Grinleria): turn its models down in `BAKED` (0.75 π) rather than re-bake.
- A ceiling over strip lights gets almost nothing in the bake (Grinjuku's sewers went black): keep a little ambient (0.22 there).
- A prop standing on a baked floor (crate stacks) or scenery outside the rect (Dust Bowl's city) takes `groundLight(obj, bake, [x, z, r])`: the floor's average light round a spot, as a 1×1 light map. Projecting from above paints a prop with its own shadow, and outside the rect clamps to the bright edge.
- A loaded model's copies share geometry: `applyGroundLightMap` gives each copy its own (each palm its own spot).

Done: Cul-de-Grin, Grin Site, Dust Bowl, Grin Beach, Grinjuku (its 12 fill lights baked), the Depot (its 9 lamps baked), the Grinleria (its 15 lamps baked). Grade only: Hollowgrin (hand-lit night), Undergrin (its Metro redesign is pending), Troll City, Trolling Loud, Trollface Island, the Pentagrin, the Hub, the range.

## Verification
- `MODE=view OUT=.claude/realism-after node tools/troll-ops-map-shots.mjs tools/troll-ops-map-views.json culdegrin` after every step, against `.claude/realism-before/`.
- `tools/troll-ops-map-fps.mjs culdegrin` x3, before and after. Baseline (headless Intel, 2026-10-13): 12.3 fps, 1067 draws, 564 meshes, 440 materials.
- A luma check: interiors and the porch at least 0.18, lawn shade at least 0.12, under 2 % blown pixels.

## Results: Cul-de-Grin (2026-10-14)
Built: P0-P5 and the P6 checks on `tf-realism`. The cache cascade (`--suffix sr1`) runs after merging main, right before the gate.
- Light maps: 6 house models, the lounge and kitchen, cg-surround (2048 atlas) and a top-down ground bake (`cg-ground-bake.webp`, 2048 over 120 m) that `applyGroundLightMap` projects by world x/z onto the ground plane, road, cg-street and cg-ground. The 8 runtime house lamps are gone; hemi 0.45, ambient 0.2.
- fps x3 each, same sitting: before 11.0 / 11.3 / 11.8, after 11.3 / 12.0 / 11.5. Draws 1028 to 989, program switches ~97 to ~75, materials 440 to 344.
- Luma (mean, before / after): inside-house 0.25 / 0.22, porch 0.46 / 0.48, house-yard 0.46 / 0.53, street 0.43 / 0.47, aerial 0.51 / 0.52; no blown pixels.
- Wear: tags, a trollface piece, grime streaks, sidewalk cracks, lawn dirt, glossy puddles (`shiny`), lawn `patches`. Rim: `view/rim-light.js` on outfits, hero and blocky bodies, and (thinner) the ink stick body: bots are ink only, so that's where it shows.

## Notes
- A light map needs intensity PI: three divides its light by PI like any light's, the Cycles light-only bake doesn't. At 1 every house read 3x too dark.
- cg-street carried old floor slabs at y 0.03 over the houses' own floors (unlit once the lamps went). Removed. Look for duplicates like it before baking a map.
- The attic floor maps.js drew is in the attic models now (maps.js keeps its colliders), so it bakes with the house.
- The gun draws inside the composer since P2: tools that grab frames (map-previews) turn `ViewmodelPass` off.
- Puddle reflection: envMapIntensity 1.2 read as pink paint at sunset, 0.5 vanished; 0.8.
- Hollowgrin's map-shots come out blank: the map loads slower than the tool's 6 s wait. Fix the wait before its rollout step.

## Open questions (my default in brackets)
- Bake the sun per placement too (16 GLBs, +3.5 MB)? [no]
- Gun inside the composer, or just tint its lights per map? [inside; tint as fallback]
