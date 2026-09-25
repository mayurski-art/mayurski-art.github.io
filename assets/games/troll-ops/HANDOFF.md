# Troll Ops hand-off — 2026-09-24 (end of session 3)

Work happens on branch `game-improvements` in the worktree `GitHub/to-opus-wt`,
and each finished piece is fast-forwarded onto `main` (`git push origin
game-improvements:main`) — "push" means land it on main. After pushing, also
`git pull --ff-only` in the user's own checkout (`GitHub/mayurski-art.github.io`),
or they see stale files there (they asked "is the menu not pushed?" because of
this). Sync test: `NODE_PATH=<main checkout>/node_modules node
tools/troll-ops-sync-test.mjs` (passes). Cache-bust in troll-ops.html is
`?v=to-maps1` (game.js + style.css); bump it on any change to either.

## Start here (next session)

1. **Maps rework, phase "real props"** — the four rebuild layouts are done as
   hidden plain-box blockouts (see Still to do #1). Grin Site's layout is
   APPROVED: start modelling its props in Blender, then swap `grinsite_wip`
   in for the live `grinsite`. Re-read the doc first
   (https://claude.ai/artifact/DuitoHJf53Uu6PYopkh2Jc) — the user may have
   ticked or commented on the Dust Bowl / Depot / Undergrin layouts.
2. Then the other three maps the same way, then Cul-de-Grin + Grin Beach polish.
3. Then **weapon skins via Blender** (Still to do #2).
4. Shared fixes (UV scale on every box, the map check tool) come LAST.

## Done (commit 667366a)

1. **Head movement** (character.js "head and neck"): `aimRig()` lets the body
   follow the aim a beat late while chest/neck/head take up the difference
   (neck fastest, then head, then chest). Head stays level while running
   (counters lean, hip roll, pelvis bob), idle glances after 1.2s still,
   `flinchRig`/`flinchRigFrom` on hits (local player, our shots, our bots'
   shots, and every client via new net `onHitSeen`). Remote heads follow the
   sent aim. Preview: `tools/troll-head.html`.
2. **Firing shake** tied to attachments: new per-class stats `shakeScale`,
   `shakeVert`, `shakeSide`, `shakeRecover`, `shakeJolt` (weapons.js). Grips,
   brake, comp and suppressor modify them (attachments.js). Camera shake is a
   damped spring per axis (`fireShake` in game.js); the viewmodel kick
   and a new roll follow the same stats. "Stability" bar and "Shake" delta
   chip in the loadout.
3. **White discs removed**: they were the additive impact sparks (confirmed by
   screenshot). New `impact-fx.js`: dark chips + ragged dust, coloured per
   surface, normals from ballistics. Remote muzzles puff smoke. Sparks remain
   only for explosions / heli gun.
4. **Weapon skins** on the Problem 416 (default rifle, has every panel type,
   and its name pairs with the "You have a problem" banner). New panelled
   model `weapon-416.js` with UV'd extruded parts; 16 skins in `skins.js`,
   baked by `tools/troll-skin-bake.mjs` to `skins/<id>.jpg` (60-110 KB each)
   plus thumbs. Customize has a Skin strip; choice saved per weapon with the
   attachments; sent over the net as `sk`; sync test checks it.
5. **Main-menu operator** faces the camera holding the equipped (skinned)
   primary, emotes every ~10s. Body-held guns hide viewmodel hands.
6. **Buy $TRUTHS** link beside the X link on the main menu (pump.fun mint
   HsryXB2BdWJuRXAY29hDcw2g4BPH57Q5nL1qu8kQpump, same as the terminal).

## Done (session 2, 2026-09-24)

1. **Aim assist** now runs for touch (thumb down on the look pad) as well as
   the gamepad stick, and locks onto zombies, wave grunts and range plates,
   not just players/bots (`aimAssistPoints()` in game.js). Runs for
   mouse/trackpad too (user asked for every device): mouse counts as
   steering for 200ms after it moves, gets half the pull and a gentler
   0.72 sticky slowdown. Verified headless: touch and a moving mouse both pull
   a 0.07 rad miss onto a range plate; a still mouse is not dragged.
2. **ADS during the pre-match countdown**: `wantAds` no longer inherits the
   staging freeze (only death / local pause). Verified: adsT reaches 1 while
   staging.
3. **Optics clear view**: Coyote, ACOG and 8x were solid black discs when
   aimed: capped tube cylinders, 55%-opaque tinted glass, and mount legs
   drawn up to the glass centre (inside the tube, on the sight line). Now
   open-ended `sleeve()` tubes with an unlit black lining, glass fades clear
   with adsT (`fadeOpticGlass`), legs start under the housing, the Coyote
   turret sits on top of the tube. Tube optics carry `adsDistance` (eye
   relief) and `adsWeaponFov`, so the eyepiece comes up to the eye instead of
   a pinhole. Checked all 5 optics on problem416, grinstock, smg, deadpan and
   bellow: reticle on the true centre, nothing blocks the view. Hip view
   unchanged. Cache-bust now `?v=to-aa2`.

## Done (session 3, 2026-09-24)

1. **Main menu v2 BUILT** from the approved canvas
   (https://claude.ai/artifact/XXhnWGcoA1BfCYvUC49LKa, board Main.dc.html).
   Top tab bar (Play / Loadout / Gear / Scorestreaks / Servers / Settings),
   grouped Versus/Solo mode list, loadout card with attachment chips, map card
   -> right-hand map drawer, big DEPLOY, footer (Back to arcade, radio, X,
   Buy $TRUTHS). Loadout + Customize share the Loadout tab via a
   Weapons/Customize switch. The room roster moved into Servers. Ballistics
   bars are gone from the Play screen (still in the Weapons view).
   - Every old element id survived; "deploy" is still the Play/home panel.
   - Phone (<760px cabinet): bottom tab bar, bottom sheet with scrolling mode
     chips, map row, full-width Deploy. The operator is visible on phones
     again (the old char view had negative width). Landscape phones
     (<=520px tall) get a compact desktop layout.
   - Checked at 1440x900, 1280x720, 390x844, 844x390; smoke test (modes,
     forced maps, drawer + Esc + focus return, Deploy) and sync test pass.
   - The user edits the canvas; re-read it before any menu change and port
     only the diff. Cache-bust is `?v=to-menu2`.

## Still to do (asked for, not started)

1. **All maps rework — plan approved, blockouts DONE, props next.** The plan is the
   doc "Troll Ops maps rework": https://claude.ai/artifact/DuitoHJf53Uu6PYopkh2Jc
   (re-read it first; the user edits it). Decisions: keep the four themes
   (construction site, desert village, warehouse, subway); shrink Dust Bowl
   90x90 -> 72x72; model hero props in Blender (models/build_props.blender.py
   pipeline); map order: user said it doesn't matter, Grin Site first;
   the shared fixes (per-face metre UVs for every box so N-S walls stop
   smearing, and tools/troll-ops-map-audit.mjs) ship LAST, after the maps.
   Each map: top-down blockout in the doc for review -> build -> walk-up test
   -> screenshots + sync test -> merge.
   - Already shipped (commit 228c3dc): every dead-end stair fixed (Grin Site
     scaffolds, Depot catwalk + columns, Cul-de-Grin attic stairwells, Grin
     Beach towers), Undergrin track exits, Dust Bowl centre stairs, doubled
     cover removed. Cache-bust `?v=to-maps1`.
   - BLOCKOUTS DONE for all four rebuilds, hidden map ids grinsite_wip,
     dustbowl_wip, depot_wip, undergrin_wip (ids ending _wip are filtered out
     of MAP_IDS; on the feature branch, NOT on main). Each is walk-tested and
     in the doc with a top-down plan + views. Grin Site layout approved (plus
     south-lane cover); the other three await the user's OK in the doc.
   - AGREED ORDER from here: finish layouts -> real props (Blender, replace
     the plain boxes, then swap each _wip map in for the live one) -> weapon
     skins (Blender PBR, see item 2) -> shared fixes (UV scale, map check) last.
   - Helper scripts used (scratchpad, not in repo): a plan renderer (colliders
     -> labelled top-down PNG), a walk-up test (hold W from a stair bottom,
     assert max y) and a headroom scan. Worth moving into tools/ with the
     map check at the end.
   - Audit gotcha: "has a stair next to it" is not "reachable". Check
     HEADROOM too (ceiling < 1.8m above a walkable top = dead end), and prove
     stairs with a walk-up test (hold W from the bottom, assert max y). The
     api.stairs(x, z, ...) origin is the BOTTOM step; it runs toward dir.

2. **Weapon skins via Blender** (user idea, not started). Blender 5.2.1 LTS is
   installed at C:/Program Files/Blender Foundation/Blender 5.2/blender.exe and
   runs headless (`--background --python`). Could bake real PBR maps (colour,
   roughness, normal) for the 416 skins, and model proper .glb guns with UVs
   so every weapon can wear skins. Propose a plan before building.

## Backlog (not for now)

Lean (controls decision), bots throwing grenades, Infection mode, sending
melee swings to other players, third-person aim camera blocked by the head,
one-handed third-person sword grip, trollface head small/grey vs references.
Skins for other weapons would need their own panelled models like weapon-416.

## Gotchas found this session

- Blockout WIP maps are real `MAPS` entries (`grinsite_wip` etc.) filtered
  out of `MAP_IDS`; view one headlessly by setting `T.loadout.mapId` with
  mode "ops" behind `?tohooks=1`. They are on the branch (and harmless on
  main, since nothing lists them).
- Inline `node -e '...'` scripts break on apostrophes in the text; write a
  .cjs file in the scratchpad and run that instead.
- The docs connector (the maps doc) takes images as: Artifact asset upload
  to the doc's URL -> connector `create` blob from the asset id -> `![alt](blob/<id>)`.

- Files are CRLF on disk (autocrlf) — Git Bash grep hides the `\r`, so
  multi-line string replacements fail unless you normalise line endings.
- The game auto-pauses without pointer lock in the in-app browser; drive it
  with headless Playwright + `--use-angle=d3d11` (real GPU, ~40fps).
- The menu character inspector camera sits on +z; rigs face -z, so it
  showed the operator from behind until this session.
