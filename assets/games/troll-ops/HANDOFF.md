# Troll Ops hand-off — 2026-09-24

Branch: `game-improvements` (worktree `GitHub/to-opus-wt`). `main` has NOT been
fast-forwarded — the user decides when. Sync test (`tools/troll-ops-sync-test.mjs`)
passes on the pushed commit. Run it with Playwright on the path, e.g.
`NODE_PATH=<main checkout>/node_modules node tools/troll-ops-sync-test.mjs`.
Cache-bust: game.js / style.css are at `?v=to-skins1` in troll-ops.html.

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
   not just players/bots (`aimAssistPoints()` in game.js). Mouse still never
   and mouse/trackpad too (user asked for every device): mouse counts as
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

1. **All maps rework** — object placement and construction should make sense
   and feel complete. Big: plan/design doc first, one map at a time.

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

- Files are CRLF on disk (autocrlf) — Git Bash grep hides the `\r`, so
  multi-line string replacements fail unless you normalise line endings.
- The game auto-pauses without pointer lock in the in-app browser; drive it
  with headless Playwright + `--use-angle=d3d11` (real GPU, ~40fps).
- The menu character inspector camera sits on +z; rigs face -z, so it
  showed the operator from behind until this session.
