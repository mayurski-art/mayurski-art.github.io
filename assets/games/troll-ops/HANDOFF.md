# Troll Ops hand-off — 2026-09-24 (end of session 4)

Work happens on branch `game-improvements` in the worktree `GitHub/to-opus-wt`,
and each finished piece is fast-forwarded onto `main` (`git push origin
game-improvements:main`): "push" means land it on main. After pushing, also
`git pull --ff-only` in the user's own checkout (`GitHub/mayurski-art.github.io`),
or they see stale files there. Sync test: `NODE_PATH=<main checkout>/node_modules
node tools/troll-ops-sync-test.mjs` (passes). Cache-bust in troll-ops.html is
`?v=to-gs1` (game.js + style.css); bump it on any change to either.

## Start here (next session): weapon skins

The user is starting the **weapon skins revision** next. The maps work is
paused, not blocked: all layouts are approved (see "Maps: where it stands").

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
model like weapon-416.js). **Propose a plan first** and get the user's OK;
ask what "revisions" they mean before assuming it's the Blender route.

Blender lessons from the maps work that carry straight over:
- `models/build_grinsite.blender.py` has a reusable `Builder` (bmesh
  primitives in game coordinates, rotated to Z-up only at export, world-metre
  box UVs, one-call glTF export). Copy its pattern.
- `models/bake_surfaces.blender.py` bakes seamless procedural texture sets
  (colour/rough/normal) by sampling 4D noise on a torus; the same trick
  would make tileable wear, scratches or camo.
- **No environment map in this renderer**: anything with metalness above
  ~0.3, and the ambientCG "metal" set, renders near-black. Keep metalness low
  or add an env map deliberately (it would change every map's look).
- glTF base colours are linear; convert sRGB hex first (`hexlin()`).

## Maps: where it stands

The plan is the doc "Troll Ops maps rework":
https://claude.ai/artifact/DuitoHJf53Uu6PYopkh2Jc (re-read it first; the user
edits it). Order agreed: finish layouts -> real props (Blender) and swap each
rebuild in -> Cul-de-Grin + Grin Beach polish -> shared fixes last.

1. **Grin Site: DONE and live on main (commit faeb1e4).** The rebuild replaced
   the old `grinsite` (same id, still first in the map list; `grinsite_wip` is
   gone). Every collider is the approved blockout's; the boxes are ghost
   colliders (`api.box(..., { ghost: true })`) and 27 models draw the site
   (`models/gs-*.glb`, built by `models/build_grinsite.blender.py`, placed by
   `grinsite-props.js`'s `gsModel()`). Added colliders: guardrails round each
   scaffold top deck, office desk + cabinet. Walk test 12/12, sync test pass.
   Headless fps about 10% below the old map (22-24 vs 25-28). Doc updated with
   a "live with real props" section and screenshots.
2. **Dust Bowl, The Depot, Undergrin: layouts APPROVED (user ticked all three
   on Sep 24, no comments), ready for real props.** Blockouts are hidden maps
   `dustbowl_wip`, `depot_wip`, `undergrin_wip` (ids ending `_wip` are
   filtered out of MAP_IDS). Do each like Grin Site: a `build_<map>.blender.py`
   using the same Builder, ghost colliders, walk test, swap in for the live id
   (keep the map-list order). Map order is still "decide later".
3. Then Cul-de-Grin + Grin Beach polish (see the doc).
4. Shared fixes last: per-face metre UVs for `api.box` (procedural boxes still
   smear on N-S faces; the modelled maps don't), and a map check tool.

Map helpers now in tools/ (all need `NODE_PATH=<main checkout>/node_modules`):
- `tools/troll-ops-map-shots.mjs`: screenshots from set views (`VIEWS` is
  keyed by map id, currently the Grin Site views under `grinsite_wip`: rename
  the key to use it). `OUT=<dir>` picks where the jpgs go.
- `tools/troll-ops-map-walk.mjs [mapId]`: holds W from given spots and checks
  max height / end position (Grin Site's 12 runs; edit `RUNS` per map).
- `tools/troll-ops-map-fps.mjs`: fps A/B between maps (edit its map list).

New in the map API (maps.js): `api.box(..., { ghost: true })` = collider
only (stairs pass it through); `api.floodlight(x, z, aim, color, { bare: true })`
= light without the pole mesh; `ground: { surface: "dirt", tile: 3 }` = lit,
textured, shadow-catching ground instead of the grid shader.
`battlefield-props.js`'s `loadModel(name, mapping)` / `placeModel` take a
per-map retexture table, and loaded models now receive shadows.

## Backlog (not for now)

Lean (controls decision), bots throwing grenades, Infection mode, sending
melee swings to other players, third-person aim camera blocked by the head,
one-handed third-person sword grip, trollface head small/grey vs references.
The shared `shipping-container.glb` (other maps) is metal-textured and renders
near-black for the no-env-map reason above; Grin Site uses its own gs-container-*.

## Gotchas

- `textures/concrete_*` is actually a split-face **block** wall texture, very
  pale. For poured concrete use the baked `cast` set (surface-textures.js).
- Blender models: flat-painted parts are merged into one vertex-coloured
  `GS_Paint` material per model at export (draw calls). Materials listed in
  the script's `TEXTURED` set must match `GS_RETEXTURE` in grinsite-props.js,
  or they get merged into paint and lose their texture.
- Test hooks (`?tohooks=1`) now expose `renderer` and `scene` too.
- WIP maps: view one headlessly by setting `T.loadout.mapId` with mode "ops"
  behind `?tohooks=1`.
- Inline `node -e '...'` breaks on apostrophes; write a .cjs file instead. A
  "does the file already mention X" guard can be fooled by a comment (it
  skipped adding an import this session).
- The docs connector (the maps doc) takes images as: Artifact asset upload to
  the doc's URL -> connector `create` blob from the asset id ->
  `![alt](blob/<id>)`.
- Files are CRLF on disk (autocrlf); Git Bash grep hides the `\r`, so
  multi-line string replacements fail unless you normalise line endings.
- The game auto-pauses without pointer lock in the in-app browser; drive it
  with headless Playwright + `--use-angle=d3d11` (real GPU).
- Audit rule: "has a stair next to it" is not "reachable". Check headroom and
  prove stairs with a walk-up test. `api.stairs(x, z, ...)`'s origin is the
  BOTTOM step's outer edge; it runs toward `dir`.
- The menu character inspector camera sits on +z; rigs face -z.
