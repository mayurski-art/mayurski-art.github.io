# Troll Ops hand-off — 2026-09-25 (end of session 8)

Work happens on branch `game-improvements` in the worktree `GitHub/to-opus-wt`,
and each finished piece is fast-forwarded onto `main` (`git push origin
game-improvements:main`): "push" means land it on main. After pushing, also
`git pull --ff-only` in the user's own checkout (`GitHub/mayurski-art.github.io`),
or they see stale files there. github.com DNS drops out now and then; retry the
push in a loop. Sync test: `NODE_PATH=<main checkout>/node_modules node
tools/troll-ops-sync-test.mjs` (passes). Cache-bust in troll-ops.html is
`?v=to-s9d` (game.js + style.css); bump it on any change to either.

## Session 9 task list (2026-09-25)

**Skins are ON HOLD** (user: no more skins for now). Work these instead:

1. **Startup lag.** On the user's HP laptop the game lags for ~30 s after
   loading, then runs smooth. Likely shader compiles / texture uploads / model
   streaming happening mid-play: warm them up behind the loading screen.
2. **Care package animation.** Needs work; sometimes when deployed it looks
   like the hunter-killer drone deploy animation plays instead (glitch).
3. **Grenade deploy glitch.** Believed fixed; re-check and harden anyway.
   **Smoke grenade**: add one if it doesn't exist.
4. **Team Deathmatch = first to 50 kills.**
5. **Every device**: iPad, desktop, laptop, phones. Phones play in
   **landscape** with a CoD Mobile-style touch HUD (left move stick, right
   look area, fire/ADS/jump/crouch/reload/grenade buttons; rotate prompt in
   portrait).
6. (Added mid-session) **Keyboard Warrior RGB wave**: glow between the keys
   sweeping along the board like a gaming keyboard.

### Session 9 status: ALL SIX DONE and on main
1. Lag: the cause was runtime lights. Every grenade/blast/fire pool/gunship
   searchlight added a light, and each new light COUNT recompiles every lit
   shader (2-2.6 s freezes, smooth once each count had been seen). Now
   `light-pool.js` (3 point + 1 spot, parked at 0) is borrowed from; grenade
   glow is emissive; third-person guns `stripLights()`. `warmShaders()`
   compiles during staging. `adaptResolution()` scales pixel ratio from fps.
   **Rule: never `new THREE.*Light` at runtime in the world scene.**
2. Care package: the "hunter-killer glitch" was key 4 firing the PRICIEST
   ready streak (HK 350 > package 300). Keys 4/5/6 now call their own row;
   touch taps the row. The drop itself: heli pass, freefall, chute, sway,
   thump, fold, green smoke (all from `age` + id hash, so clients agree).
   Also `groundAimPoint` had never used the crosshair: `raycastWorld`
   returns a DISTANCE, not an object.
3. Grenades: `cancelCook()` on death/pause/blur/unlock (releasing G on the
   death cam used to throw one); throw origin can't pass through a wall.
   Smoke already existed (tactical, rank 4).
4. TDM `scoreLimit: 50`.
5. Touch (body.to-touch-play, --k scale by height): floating stick, left
   FIRE, drag-to-aim right FIRE, TAC button, counts on grenade buttons,
   streak rows tappable + CONFIRM while marking, rotate card in portrait,
   fullscreen + orientation lock where supported (Android).
6. Keyboard RGB: underglow sheet + rim strips + legends share one shader
   clock (`KB_RGB_TIME`, stamped in onBeforeRender).

## Where we are

Session 7 built the **weapon skin editor**; the user designs skins in it
themselves. Session 8 finished **"You Have a Problem"**: it is **Final
locked** and on main. Its stock wears its own picture (the trollface stick
figure on the trim blue: see `art` below), the first part to use one.

**Next session: the other fifteen skins.** The user is testing the Problem
416 in the game first, then comes back to design the rest in the editor, one
at a time, the same way. None of them is locked; their crops are rough first
passes. Ask which skin they want to start on. Expect requests like: a part
wearing its own picture (drop the file in assets/images/skin-art, add `art`),
text rewritten or added, text areas marked (Green Room's TROLL still needs
them), right-side tweaks.

## Weapon skins (session 7)

### The editor: how the user works
- Run `node tools/troll-skin-editor.mjs` in the user's checkout, open
  http://127.0.0.1:5174/tools/troll-skin-editor.html (takes 5175, 5176... if
  5174 is busy). It serves that checkout and Save writes into it: skins.js plus
  `skins/<id>.jpg` and `<id>-thumb.jpg`, re-baked on the spot.
- **The user edits in their own checkout, not the worktree.** Before changing
  skins.js or the skin tools: `git diff` their skins.js (they may have saved
  since you last looked) and copy it, plus any re-baked `skins/<id>.jpg` and
  `-thumb.jpg`, into the worktree; make the change there, commit, push.
  Then sync their checkout with `git stash push -m "<what>" -- <those files>`
  and `git pull --ff-only`. (`git checkout --` on their files is refused by
  the permission guard: it discards work. Stash keeps it recoverable.) After
  any change to the editor server (tools/troll-skin-editor.mjs), restart the
  5174 server from their checkout.
- To try a change before the user sees it, run a second editor from the
  worktree (`node tools/troll-skin-editor.mjs 5180`) and drive it with
  headless Playwright (`NODE_PATH=<checkout>/node_modules`,
  `--use-angle=d3d11`): `window.__editor.save(id)` re-bakes and saves into
  the worktree; the `#view` canvas with the `[data-cam]`/`[data-pan]`
  buttons gives close-ups of the gun. Stop it afterwards; the user's editor
  is 5174, never 5180.
- **An open editor tab keeps its own copy of the skin.** If it was opened
  before a change, its next Save overwrites the change (this dropped the text
  areas once). Always tell the user to refresh (Ctrl+Shift+R) before saving;
  if the skin then shows unsaved, that's an old draft: Revert skin.
- Unsaved edits live in localStorage (per skin) and survive a refresh.

### What a skin is (skins.js)
- **The banner only**, per part: no emblem, rollmark, vents, stipple, ribs,
  border or wear (user rule). Only the Problem 416 (`weapon-416.js`) wears skins.
- `crops`: per part `[cx, cy, zoom, rot, flip]` (fractions of the banner; zoom
  = share of the banner's width). Unturned crops are kept inside the banner.
- `lines`: text rewritten on the banner in its own pixel lettering (Tahoma at
  its real size, hard-edged, scaled up square). `cutouts`: art lifted off the
  banner (the trollface), paper keyed out from the box edges. Both are movable
  pieces (dx, dy, size, rot, flip).
- `textAreas`: boxes round writing baked into the banner art.
- `right`: the right side's own: `crops` per part, `lines`/`cutouts` overrides
  by index (text "" leaves a line off), `newLines` (right-only text; `smooth`
  title style, `bg: "rows"` paints out a gradient bar), `flipV` (parts upside
  down on the right).
- `final: true`: the Final lock; the editor folds down to the gun.
- `art`: a part's own picture in place of the banner, e.g.
  `art: { stock: "problem-stock.jpg" }` (files in assets/images/skin-art). That
  part's crop is a crop of the picture, on both sides (the right just mirrors
  it: no text flipping). The editor shows the picture when the part is
  selected. `{ file, bg, paper }` keys the picture's white paper out onto
  `bg` (paper: extra [x, y] seeds for white shut in by lines). You Have a
  Problem's stock: the trollface stick figure on the trim blue.

### The sides formula (user rule, in memory too)
The right side **mirrors** the left: the same art at the same spot along the
gun (weapon-416.js maps both faces by z). **Writing still reads correctly on
both sides.** The atlas is 1024x1024: top half = left side, bottom half
(`SKIN_ATLAS.rightY`) = right side, baked from the banner with each text line
redrawn mirrored and each text area flipped in place along the part's crop
direction, before cropping (so a word split across parts stays whole).

### Editor features
Drag/zoom/rotate/flip part boxes (Shift = one axis); per-part locks, **per
side**; Left side / Right side switch (a part not edited on the right follows
the left, shown as "same as left"); Banner pieces (text, trollface; right-only
text); Text areas mode (draw/remove boxes); Right ↕ tick; 3D view with pan
(right-drag or arrows) and zoom; atlas preview (both halves); Final lock /
Unlock to edit. Code: tools/troll-skin-editor.html, tools/troll-skin-editor.mjs,
drawing shared with the baker in tools/troll-skin-draw.js.

### Skin gotchas
- The 3D view (editor and game) lights the gun's left side harder than the
  right, so the same colour reads darker on the right. The atlas is right;
  check pixel values before "fixing" a colour.
- Keyed pictures (`art` with `bg`): white shut in by lines survives the
  edge flood. List those pockets (connected light regions not touching the
  picture's edge, with size and a seed pixel) in a headless page, keep the
  ones that belong to the art (the trollface and its eyes/teeth), and add the
  rest to `paper`. Seeds flood at a lower cut-off (lum > 120) than the open
  paper (> 200), so small greyish gaps go too.
- Text areas must hug the letters: a box that also covers neighbouring art
  flips that art too. Text *lines* are safe (redrawn, not pixel-flipped).
- Thin strokes vanish in pixel lettering at the normal ink cut-off; "$" and
  "|" columns use a lower one.
- Text areas marked so far: You Have a Problem, Buy $TROLL, Speed of Light.
  Other banners with writing (Green Room's TROLL) need them marked in the editor.
- Removed from the gun model because they sat on the art: fire selector,
  ejection-port cover, forward assist.
- Batch re-bake: `NODE_PATH=<checkout>/node_modules node tools/troll-skin-bake.mjs [ids]`
  (it also rewrites factory-thumb.jpg; revert that if nothing changed).

## Session 8: done and on main
- Per-part pictures (`art`) in skins.js, the baker and the editor — 67d3368
- Paper keyed out onto a colour, with `paper` seeds — 269abe9, c5c935c
- You Have a Problem: stock figure turned by the user, then Final locked — this commit

## Session 6: done and on main
- Bots throw grenades (1 frag + 1 flash a life; clusters, objectives, lob over cover; skill scales) — 089c3d8
- Melee swings sent over the net + overhand throw arm on remote/3rd-person rigs — 089c3d8
- S&D plant/defuse moved E -> hold F (F still throws tactical off-site) — c528a4d
- LEAN: DROPPED by the user. Q stays aim. Don't build it.
- Third person: parallel over-shoulder camera, own head ghosts on ADS; every head 1.4x + half-emissive (hitbox 0.24) — d04ddf2
- Painted shipping containers (gs-container-*), no metal texture on props, red lifeguard towers — 271bc55
- Infection mode (modes.js INFECTION, game.js 'Infection' block, bots meleeOnly, net 'infect') — fd731f6
- Keyboard Warrior rebuilt from the user's reference render (real 16x6 layout, silver guard, leather grip, trollface pommel) — a5e28f2
- Undergrin fps: now on par with Grin Site headless (18-22), left alone.

## Infection notes
- Survivors = phantom slot, Infected = ghost slot, relabelled via teamName().
- Bot host picks first infected 8s after GO (2 if 8+), clock starts then.
- Bots-only matches end in ~40s (infected snowball); survivor bots kite swords.

## Blender (for later, if skins move to real models)
Not started, and not what the user meant by the skins revision. Blender 5.2.1
LTS is at `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe` and runs
headless (`--background --python`); it could model UV'd .glb guns so every
weapon can wear skins (today only weapon-416.js is panelled).

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

## Session-5 task list

All done in session 6 (see above); lean was dropped by the user.

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
