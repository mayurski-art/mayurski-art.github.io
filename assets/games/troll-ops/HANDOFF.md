# Troll Ops hand-off — 2026-09-25 (end of session 5)

Work happens on branch `game-improvements` in the worktree `GitHub/to-opus-wt`,
and each finished piece is fast-forwarded onto `main` (`git push origin
game-improvements:main`): "push" means land it on main. After pushing, also
`git pull --ff-only` in the user's own checkout (`GitHub/mayurski-art.github.io`),
or they see stale files there. github.com DNS dropped out a few times this
session; retry the push in a loop rather than giving up. Sync test:
`NODE_PATH=<main checkout>/node_modules node tools/troll-ops-sync-test.mjs`
(passes). Cache-bust in troll-ops.html is `?v=to-perf1` (game.js + style.css);
bump it on any change to either.

## Start here (next session): weapon skins

The user is starting the **weapon skins revision** next. **The maps rework is
finished** (see "Maps: done"), so nothing map-side is waiting.

What exists today (session 1, commit 667366a):
- Only the **Problem 416** (`problem416`, the default rifle) is skinnable:
  `SKINNABLE` in skins.js. It has its own panelled, UV'd model,
  `weapon-416.js` (extruded parts, every panel type).
- **16 skins** in `skins.js` (`SKINS`, ids: problem, green, hitman, livewire,
  buytroll, jungle, gladiator, tie, knight, frog, diamond, keyboard, brute,
  lightspeed, office, order), each tied to a banner image.
- Baked by `node tools/troll-skin-bake.mjs [id,...]` (runs
  tools/troll-skin-bake.html headless) to `skins/<id>.jpg` (1024x512 atlas,
  60-110 KB) plus `skins/<id>-thumb.jpg` for the picker.
- Customize screen has a Skin strip; the choice is saved per weapon with the
  attachments, sent over the net as `sk`, and the sync test checks that a skin
  shows on the other client.
- The main-menu operator holds the equipped, skinned primary.

The user's idea (not started): **skins via Blender**. Blender 5.2.1 LTS is at
`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe` and runs headless
(`--background --python`). Two directions: bake real PBR maps (colour,
roughness, normal) for the 416 skins, and model proper .glb guns with UVs so
every weapon can wear skins (today other weapons would each need a panelled
model like weapon-416.js). **Ask what "revisions" they mean, then propose a
plan and get their OK before building.**

Blender know-how from the maps that carries straight over:
- `models/map_kit.py` is the shared kit every `build_<map>.blender.py`
  imports: the `Builder` (bmesh primitives in game coordinates, rotated to
  Z-up only at export, world-metre box UVs, one-call glTF export), `lump()`
  (boulders, sacks), `walls_geo()`, `arch()`, `palm()`, `sedan()`,
  `steel_stair()`, `edge_rail()`, `pallet()`, and the palette.
- At export, flat-painted parts merge into one vertex-coloured `GS_Paint`
  material per model (a model costs one draw for its paint plus one per
  photo-textured material). Names in `TEXTURED` keep their own material and
  must match `RETEXTURE` in map-models.js.
- `models/bake_surfaces.blender.py -- <name>` bakes seamless procedural texture
  sets (colour/rough/normal) by sampling 4D noise on a torus: dirt, cast
  concrete, sand, plaster, tile and grass so far. The same trick would make
  tileable wear, scratches or camo for skins.
- **No environment map in this renderer**: metalness above ~0.3, and the
  ambientCG "metal" set, render near-black. Keep metalness low, or add an env
  map deliberately (it would change every map's look).
- glTF base colours are linear; convert sRGB hex first (`hexlin()`).

## Maps: done

Everything in the maps doc (https://claude.ai/artifact/DuitoHJf53Uu6PYopkh2Jc,
now with a "Status" section at the top) is on main:

| Map | What shipped | Commit |
| --- | --- | --- |
| Grin Site | 27 modelled props, dirt ground, cast concrete | faeb1e4 |
| Dust Bowl | desert village, 72 x 72 (db-*.glb) | 20f2b73 |
| The Depot | racking, catwalk ring, glass office, loading bay (dp-*) | e0f013f |
| Undergrin | tiled station, train, mezzanines, red tunnel mouths (ug-*) | a9155ef |
| Cul-de-Grin | fences/trees/houses beyond the edge, sidewalks, cars, furniture (cg-*) | a622b74 |
| Grin Beach | modelled pier with working ramps, cars + food truck (gb-*) | 3caa986 |
| Shared | metre UVs on every box; map check tool | b9d3854 |
| Perf | Undergrin: half the lamps, no model shadows | 48302f7 |

How every rebuilt map is put together: the approved blockout's colliders stay
in maps.js as **ghosts** (`api.box(..., { ghost: true })`, `api.ghostWalls`,
`api.cylinder(..., { ghost: true })`), and `mapModel(api, "<file>", {...})`
(map-models.js) draws the models. Change a collider, change the model to
match. No `_wip` maps remain.

Bugs fixed on the way: Grin Beach's pier ramps were dead ends (they topped out
against an unbroken railing; a fire ring sat on the west ramp's first step);
the pier deck ran 4 m past the map edge.

Performance (headless, `tools/troll-ops-map-fps.mjs`): five maps match or beat
their pre-rework builds; Undergrin is ~19 fps vs ~23 for its blockout. The
cost is per-pixel shading of the station, spread across all four models (no
single culprit). If it matters, next steps would be fewer lit surfaces in
view or fewer point lights; don't expect shadows to help (already off).

### Map tools (all need `NODE_PATH=<main checkout>/node_modules`)
- `tools/troll-ops-map-audit.mjs [ids]`: the map check. Fails on floating
  solids, blocked spawns and traps (reachable but no way back); reports
  unreachable tops and overlaps. All six maps pass; planted faults are
  caught. Not for pentagrin (elevators read as traps). `AUDIT_AT="x,z"` dumps
  walkable levels round a point.
- `tools/troll-ops-map-walk.mjs [ids]`: 47 walk runs across the six maps
  (stairs, doors, rails, ramps). All pass.
- `tools/troll-ops-map-shots.mjs [views.json] [ids]`: screenshots from the
  cameras in `tools/troll-ops-map-views.json`; `OUT=<dir>` for output.
- `tools/troll-ops-map-fps.mjs [ids]`: fps + draws/frame; `ROOT_DIR=<checkout>`
  measures another build (e.g. a `git worktree add --detach` of an old commit).

## Tasks to pick from (user: "we will pick things up tomorrow")

The user will choose which of these to do; don't start one unasked. Weapon
skins (above) are a separate track. Pointers were checked on Sep 25.

1. **Bots throw grenades.** Bots never throw today (no grenade code in
   bots.js). Reuse the player's throw path (`startCook(slot)` ~game.js:3559,
   `grenadeCtx()` ~3515) so bot grenades hit the same damage, killfeed and net
   code. Decide when a bot throws: target behind cover it can't shoot, 2+
   enemies clustered, or holding an objective (KOTH hill, S&D site); cap it
   (one per life, cooldown) so it isn't spam. Scale with `settings.botSkill`.
   Done when bots visibly throw in a match, damage lands, and remote clients
   see it (the sync test covers grenades from players; add a bot case).
2. **Send melee swings to other players.** `swingMelee()` (~game.js:3607) is
   local only: other players see the damage but not the swing. Add a message
   through `net.send()` (net.js ~134; follow how `onHitSeen` is sent and
   handled ~net.js:224) and play the swing on the remote rig
   (remote-players.js). Extend tools/troll-ops-sync-test.mjs with a check.
3. **Third-person fixes** (toggle with B, `toggleThirdPerson()` ~game.js:1007;
   local body ~game.js:2465):
   - the aim camera is blocked by the player's own head: offset the camera
     over the shoulder and/or hide the head board when it's between camera
     and crosshair;
   - one-handed sword grip: the keyboard sword (gear.js ~44-214, Godot
     reference in troll-melee-1/weapons/keyboard_sword) should sit in one hand
     in third person, not a two-handed rifle pose;
   - the trollface head reads small and grey next to the reference art: the
     head board is 0.34 x 0.32 x scale (character.js ~345) with
     `TROLLFACE_HEAD_MAT` (~39). Try a bigger board and brighter material
     (likely emissive/unlit-ish like the art), and compare screenshots
     against assets/games/troll-ops/trollface-characters.
4. **Infection mode.** New entry in modes.js (next to tdm/koth/oitc/snd/
   gungame): one or two players start infected, killed survivors join the
   infected, survivors win if anyone lasts the timer. Needs: team swap on
   death, infected loadout (melee only, faster?), HUD survivor count, bots
   that play both sides, net sync of team changes. Draft rules with the user
   first (see the "design doc before big builds" habit).
5. **Lean.** Needs a controls decision from the user first (Q/E? hold or
   toggle? gamepad binding?). Then: camera roll + sideways offset, a matching
   upper-body tilt on the rig, peeking reduces the exposed hitbox, sent over
   the net so others see it.
6. **Small visual leftovers:** the shared `shipping-container.glb` (still used
   by Pentagrin and battlefield props) is metal-textured and renders
   near-black (no env map): repaint it like Grin Site's gs-container-*. Grin
   Beach's lifeguard towers are meant to be red but render dark brown (red
   tint x dark wood photo): flat red paint or a model.
7. **Undergrin frame rate** (optional): ~19 fps headless vs ~23 before the
   rework; see "Maps: done".

## Gotchas

- `textures/concrete_*` is a split-face **block** wall texture, very pale. For
  poured concrete use the baked `cast` set.
- Texture sets in surface-textures.js load lazily (first access), so a map
  only downloads what it uses.
- Test hooks (`?tohooks=1`) expose `renderer` and `scene` too.
- The first walk run after a map loads crawls while models stream in: always
  warm up first (the walk tool does).
- `house-*.glb` (Cul-de-Grin houses) have no floor: cg-street lays boards.
- Cul-de-Grin's picket fences cross each front path: route walk tests round them.
- Inline `node -e '...'` breaks on apostrophes (even in comments): write a
  .cjs file instead. A "does the file already mention X" guard can be fooled
  by a comment.
- The docs connector takes images as: Artifact asset upload to the doc's URL
  -> connector `create` blob from the asset id -> `![alt](blob/<id>)`.
- Files are CRLF on disk (autocrlf); normalise line endings before multi-line
  string replacements.
- The game auto-pauses without pointer lock in the in-app browser; drive it
  with headless Playwright + `--use-angle=d3d11` (real GPU).
- `api.stairs(x, z, ...)`'s origin is the BOTTOM step's outer edge; it runs
  toward `dir`. Prove stairs with a walk-up test, not by eye.
- The menu character inspector camera sits on +z; rigs face -z.
