# Troll Ops hand-off — 2026-09-25 (end of session 9)

Work happens on branch `game-improvements` in the worktree `GitHub/to-opus-wt`,
and each finished piece is fast-forwarded onto `main` (`git push origin
game-improvements:main`): "push" means land it on main. After pushing, also
`git pull --ff-only` in the user's own checkout (`GitHub/mayurski-art.github.io`),
or they see stale files there. github.com DNS drops out now and then; retry the
push in a loop. Sync test: `NODE_PATH=<main checkout>/node_modules node
tools/troll-ops-sync-test.mjs` (passes). Cache-bust in troll-ops.html is
`?v=to-s9h` (game.js + style.css); bump it on any change to either.

## Reminders from the user (2026-09-26)

- **More songs to add.** The user has more tracks for the in-game radio.
  Ask them for the files, drop the mp3s in `music/` and add each to
  `TRACKS` in `music.js` (title, artist, src). Radio shuffles by default now
  (storage key `trollops:radio-v2`).
- The game is now called **Troll Forces** (display name only; the URL,
  folder, storage keys and ids still say troll-ops on purpose).
- Done 2026-09-26: **emote wheel** (hold H, emote-wheel.js; emotes are
  `DANCES` from character.js, index rides the state packet as `em`,
  front-facing emote camera; moving/firing/8 s ends it). Not yet on the
  touch HUD, and remote emotes aren't covered by the sync test. Also done:
  two-handed gun hold (chest `gunMount` + arm IK, needs `gripPos` and
  `supportHandPos` on a weapon mesh), weapon preview stage right of
  Loadout/Customize/Gear/Scorestreaks, primary thumbnail in the Play card.

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

### Session 9 status: ALL DONE and on main (last commit bd93ae0)
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
7. (Late asks) The in-game 416 now matches the skin editor: **no
   first-person hands on guns** (user picked "hide the hands"; meshes stay,
   tagged `userData.hand`, just invisible; melee + streak device keep
   theirs). The Problem 416's **butt pad and charging handle wear the skin's
   accent** (red-orange), the "two pops of colour on the stock" the user
   liked from an older build.

### Open / offered, not done
- In-game lighting makes the gun paler than the editor (whites read blue:
  weaponScene's AmbientLight 0xaab8ff + rim light). Offered "match editor
  colours"; the user chose only hiding the hands. Ask before changing.
- Not verified on real hardware: the user's HP laptop, a real phone/iPad
  (headless + emulation only). Ask how it felt.

## NEXT: Green Candles redesign (user asked 2026-09-25, NOT started)

User: "take your time in redesigning the green candles weapon. I believe we
already have this weapon but it's a very terrible version. And also make sure
that the mechanism of the weapon is pristine as well." Asked to park it here
until the streak work is done. Ask before starting; do a design pass first
(see the design-doc-before-big-builds rule).

Existing version: `weapons.js` id `greencandle` (rank 28, sight none),
model in `weapon-model.js` (~line 78: "side tank ('Green Candles'), fed by a
hose forward into the horn"); its cell glow used to be a PointLight, now
stripped (`stripLights`, never add runtime lights: light-pool.js).

Reference art the user sent (two images, in chat only, not on disk: ask
them to drop copies into assets/images if you need the files):
1. The trollface character in a black "problem?" tee with a brown backpack,
   holding the gun up two-handed like a Ghostbusters thrower, blue sky.
2. A clean product render of the same gun standing upright, grey background.
The gun, from the render:
- Main body: a tall cone/bottle shape, matte dark grey, widening to a
  rounded, domed base (a separate base ring with a round button/port on
  its side).
- A brass/gold banded mid-section (vertical panel seams) between the grey
  base and a dark grey collar near the top.
- Muzzle: a glowing lime-green translucent cylinder (a "candle") sitting in
  the collar, with a thinner green nub/wick on top. This is the emitter.
- Side tank: a smaller grey cylinder clamped to the body's left side on a
  bracket, "GREEN CANDLES" printed vertically on it, a glowing green
  vertical window slot (fill gauge) down its length, metal end caps.
- A glowing green ribbed hose arcs from the tank's top into the body just
  under the gold section.
- Red and blue wires loop from the tank's bottom cap into the base.
- Details: a small screw, a round dial/indicator with a green light on the
  lower body, a panel seam/latch on the right side.
"Mechanism pristine": the firing behaviour, recoil, reload (tank swap?),
glow feedback (gauge drains with ammo, candle pulses on fire) all need to
be clean, not just the model. Check how it fires today before proposing.

## Session 11: scorestreak + streak animation overhaul (2026-09-25)

### Status: done, verified headless, pushed to main (see git log)
BO2-accurate rework of every streak, on the user's ask ("all scorestreaks
need to be very accurate to call of duty black ops 2, including care
packages", "not so rushed", "lightning strike: I want to see the tablet and
choosing target spots, then the explosions"):
- **Lightning Strike** (`streak-tablet.js`, new): a rugged tablet slides up
  with an orthographic overhead render of the live map (render target ->
  canvas, gamma by hand, fog off for the shot), blips, you-arrow. Mark 3
  spots (mouse moves a reticle while pointer-locked, click marks, right
  click undoes, Esc cancels; pad sticks/A/B; touch taps). Player frozen
  while it's up. Nothing spent until the 3rd mark. Then `AirstrikeRun`
  per mark (strikeDelay(i) = 4 + 1.7 i s): red smoke, a jet on one
  constant-speed line, 5 bombs released and falling on real arcs, blasts in
  game time. Wire: `mark` with `runs: [{x,z,delay}]` + yaw/team (old single
  x/z still accepted).
- **Care package**: hold a smoke marker (viewmodel `buildMarkerDevice`),
  fire/its key throws it (`MarkerCanister`, bounces, settles, red smoke).
  Wire `marker` (throw origin/dir, copies fly it for show) then `drop` at
  the rest point (replaces the copy). Heli brakes into a hover over the
  smoke (s = v(t - h tanh(t/h))), crate slung on a cable, cut at 6.5 s,
  free-falls (no chute in BO2), slams down, crushes anyone under it
  (owner decides, 400 dmg, killfeed "Care Package"). Floating icon of the
  contents (`streakIconTexture`). Capture: owner 0.8 s, teammate 1.6 s,
  enemy steal 3.5 s ("Stealing the care package…").
- **Hunter-Killer**: comes out in the hand (viewmodel = the real drone
  model), spins up, tossed at 0.6 s (`launchPendingDrone`; target picked
  at the toss, LOS-preferred). Climbs (cut short under a roof), then
  hunts: straight at the chest when visible, else follows the bots' flow
  field (`droneRoute`, nav.js, per floor height). Swept AABB collision
  (`sweepWorld` gives the face normal) so it slides along walls with 0.35
  m clearance; hitting cover within 6 m of the target detonates. Retargets
  when the target dies (`retarget` msg). Splash via areaDamage (spares
  teammates, hurts the caller). Red LOCKED bracket on the target
  (`.to-hk-lock`). Copies fly the same steering; target can be the local
  player ("HUNTER-KILLER INBOUND — MOVE"). Test over 6 maps, 73 launches:
  0 clips, 67 hits, 4 cover blasts near the target, 2 expired (Depot).
- **Gunship**: heading from the path derivative (was tail-first), muzzle
  and searchlight on the nose (-z), flies in and out from off the map
  (HELI_ENTER/EXIT), fires only with line of sight, cosmetic tracers on
  every client (copies can target the local player).
- **UAV**: remote-press beat, plane circles high for the whole duration.
- **Blasts** (`BlastFx`): fireball (additive core + opaque body), smoke
  column, shock ring; no lights.
- **Tablet/device**: raise and lower animate both ways; the gun comes back
  from the lowered pose. Pre-existing bug fixed: updateMeleeView re-showed
  the gun every frame, so it sat beside any streak device.

Test scripts live in the session scratchpad (not the repo): streak-shots,
strike, cp, hk, hklogic (drone pathing over maps), remote (every streak
wire message against one client). Worth moving into tools/ if reused.

### Original bug list (all fixed above)

User: "really fix the scorestreaks and scorestreak animations, they are quite
buggy, the biggest issue for now". Filmed every streak headless (scratchpad
harness: grant a streak, call it, screenshot a sequence with a chase camera
rendered from a second PerspectiveCamera over the game scene).

Bugs found:
- Gunship flies TAIL-FIRST its whole orbit: wantYaw = -tangent + PI/2 is the
  mirror of the model forward (-sin yaw, -cos yaw). Its muzzle and
  searchlight sat at +z = the TAIL. It also popped into existence mid-orbit,
  started at yaw 0 and blinked out at the end. No tracers.
- Lightning Strike jet: lerped 24 m in 2.4 s (crawling), then jumped to
  40 m/s; spawned 12 m from the mark in plain sight; bombs were setTimeout
  (ignored pause, not tied to the jet) and exploded with no bomb visible.
  Explosions were sparks + a light only.
- UAV recon plane popped into existence 34 m above the caller.
- Hunter-Killer: remote copies were updated with a null target, so on
  everyone else's screen it flew straight north and blew up wherever it got.
  Plus every item in "Bugs to fix next #2" below.
- Streak device: gun/device swap was an instant pop both ways.
- Care package: sway snapped to 0 on touchdown; crate blinked out when opened.

## Graphics setting (session 10, on main)
Settings → Graphics: Auto / High / Medium / Low, in both the lobby and Esc
panels (`settings.gfx`). High = SSAO + bloom + 2048 shadows, Medium drops
SSAO (the big one: it re-renders the scene every frame; measured 21 → 31
fps), Low also drops bloom and uses 1024 shadows. Auto sheds tiers BEFORE
resolution when a 2 s window is under 40 fps, climbs back after 3 windows
over 57, won't retry a tier that just failed, and remembers where it
settled per device (`trollops:gfx-auto`). Tiers never change shadow type
or light count (that would recompile every shader mid-match). Purely local.
Hook: `__trollOps.gfx()`.

## Inspect animations (session 10, on main)
- **Long guns (4.2 s):** raised to screen centre side-on (left side, muzzle
  left, whole gun fills ~72% of the width, aspect-aware), slow drift, a
  wrist twist through muzzle-away to the right side, drift, back to the
  hip. Keyframed in `GUN_INSPECT_KEYS` (Catmull-Rom via `sampleKeys`),
  blended from the live hip pose by `applyGunInspect`. Sidearms keep the
  old 2.2 s twirl.
- **Showcase arms:** the block hands stay hidden (the user's rule); during
  the gun inspect only, `inspectArms` draws sleeves from off-screen
  shoulders to fists at the built hand anchors (support fist dropped under
  the handguard so it doesn't cover the skin). Shoulders swap with
  sin(yaw) so the arms never cross.
- **Keyboard Warrior (3.6 s):** wind-up, toss with an end-over-end flip,
  floats centre screen keys-out (esc left, RGB running), barrel-rolls down
  into a catch. The hands are moved into the rig and sink off screen while
  it's airborne; `restoreMeleeHands` puts them back whenever the toss
  isn't playing (cancel, death, weapon swap, mesh rebuild).
- Test hook: `__trollOps.setInspectFreeze(t)` pins the animation at t.

## Bugs to fix next (reported by the user 2026-09-25, not started)

1. **Logged out, but Troll Ops still says `troll_runner`.** After logging
   out, opening Troll Ops should make you a guest; instead the callsign is
   still the account. Name comes from `playerName()` in game.js (~1597), which
   reads `TrollrunnerAccounts.getCachedProfile()`. Suspects, check in order:
   - `assets/js/troll-accounts.js` `adoptSsoCookie()`: if the logout ran on
     another origin/subdomain, the shared SSO cookie may not have been
     cleared (`writeSsoCookie(null)` has to run on sign-out, on the same
     cookie domain), so Troll Ops adopts the old session again.
   - This origin's own Supabase session in localStorage survives a logout
     done elsewhere (`adoptSsoCookie` returns early when a local session
     exists, so a stale local session wins over a missing cookie).
   - game.js only redraws on `trollrunner:auth-changed`; make sure a
     sign-out fires it and that a stale callsign/net name isn't kept.
   Repro: log in, log out from the main site, open /troll-ops. Expect
   "operator"/guest.

2. **Hunter-Killer drone is dumb and just crashes.** User isn't sure the
   homing works at all. Code: `case "drone"` + `spawnDrone()` in game.js
   (~600-670), the detonation block in the streak loop (~790), and
   `HunterDrone.update()` in streak-entities.js (~352). What I saw:
   - Target is `nearestHostileTo(move.pos)`, picked ONCE at launch, only
     from `remotes.byId`, ignoring line of sight. No target (or the target
     dies) = it flies straight and burns out after `DRONE_LIFETIME` 12 s.
     Should re-acquire a new nearest target when the current one dies, and
     prefer visible targets. Check bots really are in `remotes.byId`.
   - No world collision or ground clearance at all: it flies through walls
     and can dive into the floor. Needs obstacle avoidance (climb over,
     then dive) or at least a raycast; hitting a wall should detonate there.
   - Turning: `DRONE_TURN` 2.8 rad/s at `DRONE_SPEED` 17 gives a ~6 m turn
     circle, so a target behind or close to you makes it orbit. Launch
     upward first, then turn toward the target.
   - Splash loop skips the target with `rp.id === target.id`, but
     RemotePlayer keys by `.netId` (see the comment at the `case "drone"`),
     so the target is probably hit twice. Use `netId`.
   - Add a lock-on cue so the user can tell homing works: target name in
     the banner, a marker on the locked enemy, maybe a drone-cam.
   - **Self-damage:** the user wants the blast to be able to kill the
     caller if they set it off right next to themselves. Today splash only
     checks remotes, never the local player; add a distance check against
     `move.pos` within `DRONE_SPLASH_RADIUS` (and on "expire" blasts).
   Test in a bot match: launch with a bot behind you, behind a wall, and
   with no bots, and screenshot the flight.

## Where we are

Session 7 built the **weapon skin editor**; the user designs skins in it
themselves. Session 8 finished **"You Have a Problem"**: it is **Final
locked** and on main. Its stock wears its own picture (the trollface stick
figure on the trim blue: see `art` below), the first part to use one.

**Next session: likely the other fifteen skins** (on hold at the user's
word; ask first). The user is testing the Problem 416 in the game, then comes back to design the rest in the editor, one
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
