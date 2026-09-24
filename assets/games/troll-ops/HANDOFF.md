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

## Still to do (asked for, not started)

1. **Aim assist doesn't work** — diagnosed, not fixed. `applyAimAssist()` only
   runs when the gamepad right stick is deflected (`usingGamepadLook` in the
   gamepad poll, game.js ~2724). Mouse and touch never get it, and targets come
   only from `occupants()` (players/bots), so range targets, zombies and
   grunts are never assisted. Fix: also run it for touch look (and decide
   with the user whether mouse gets it), and add non-player targets.
2. **ADS during the pre-match countdown** — let players scope in/out while
   staging (look at the `frozen`/staging gates in updatePlayer / WeaponState
   update; ADS is blocked there).
3. **Optics: clear view through every sight when aimed.** User named the
   ACOG 4x and Coyote; go through all optics (iron, reflex, coyote, acog,
   scope8) on several guns incl. the new Problem 416 model and check the
   aim point lines up and nothing (housing, rail, reticle plane) blocks the
   centre. Note the 416 uses its own aimY/aimZ in weapon-416.js.
4. **Main menu redesign** — user: "looks vibe coded". Specifically hates the
   giant Map Select box. Propose a direction with a mockup first (per the
   design-doc-first rule), then build.
5. **All maps rework** — object placement and construction should make sense
   and feel complete. Big: plan/design doc first, one map at a time.

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
