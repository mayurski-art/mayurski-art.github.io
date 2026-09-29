# Troll Ops hand-off — 2026-09-28 (session 18)

## HUD cleanup (2026-09-28, shipped)
User: no control instructions while playing (incl. Test Range) and no
top-left Kills counter. Gone: V/G/F letters on the gear chips, "Press 4 to
call it in" banner line, 4/5/6 on ready streak slots (now READY), key names
in the pickup / care package / plant / defuse / marker prompts, killcam "Space
to skip" (button just says Skip). Kills box hidden except Zombies (Points).
Kept: "Click to take the mouse back" (only when a relock fails) and the Esc
menu / lobby Controls lists. Touch buttons are inline SVG icons now (no
words; aria-labels carry the names; nade/tac labels follow the loadout).
game.js + style.css `?v=to-hud2`.

## Trollsaber SHIPPED (2026-09-28, queue item 1)
User: Darth Vader's exact hilt, NO text on it, red blade, melee slot, LV 30,
one-hit, deflects frontal rounds while blocking.
- `models/build_trollsaber.blender.py` -> `models/trollsaber.glb` (~39k tris,
  1.2 MB): ESB/ROTJ Vader (MPP) read off a side-on reference: ribbed chrome
  end cap, 6 black T-track grips, black clamp + screw + bubble strip, chrome
  body with black top plate, red pill button, amber slot, pin hole, screws,
  crinkle-black shroud collar, knurled thumb screw, slanted hood. Empties
  TS_Grip / TS_Support / TS_Emitter. `-- render` adds a stand-in blade.
- `trollsaber.js`: hilt streams in (stand-in until then, swapped in place);
  blade = axial-billboard capsule shader (white core, red glow, halo faded
  across the quad) + solid core rod + emitter sprite; self-animating in
  onBeforeRender (ignite 0.2 s, flicker, flare); `SaberTrail` ribbon.
- gear.js `MELEE_DEFS.trollsaber` (damage 400, `deflect` tuning),
  `SABER_BLOCK` guard pose. game.js: ignite on draw, hum bends with swing
  speed, trail only during the cut, hold aim = block (`updateSaberBlock`,
  red arc meter #to-saber-meter; blinks when broken), `tryDeflect` in
  damagePlayer (WEAPON_DEFS rounds inside the front cone; blasts/melee/
  zombies go through), sparks re-aimed from view space. The gun behind a
  held melee weapon no longer scopes in. audio.js saber* sounds.
- Not done: others don't see your block pose or hear your saber (3P shows it
  lit in hand); bots don't react to a block.
- Test: `tools/troll-ops-trollsaber-test.mjs` (13 checks). Tags: gear.js and
  trollsaber.js `?v=ts1` in every importer; loadout `?v=ts1`, inspector /
  remote-players / audio `?v=to-ts1`, game.js + style.css `?v=to-ts1`.

## QUEUE (user, 2026-09-28): do these in this order
1. ~~**Lightsaber: a new weapon.**~~ SHIPPED (see above). The graphics have to be really good, on the
   Green Candles bar: its own Blender build script -> glb (like
   `build_greencandles.blender.py`), glowing emissive blade + halo sprites
   tuned for ACES, detailed hilt, PMREM env map, and real mechanics (not a
   reskinned knife): ignite/retract, hum + swing audio, blade trail on swings.
   User decided: **Trollsaber**, **melee slot** (replaces the knife when
   equipped, still quick-melee, can be held as the active weapon), **red
   blade**, **one-hit kill + deflects frontal bullets while blocking**
   (block drains a meter), **unlock LV 30**.
2. **Grinmington 870: same treatment.** Replace the procedural
   `spec.pump` model with a detailed Blender glb at Green Candles quality,
   keeping the pump / shell-by-shell reload / rack mechanics and hooks
   (`pumpMesh`, `shellMesh`, `loadPort`, forend-parented support hand).
   The shotgun test must still pass.
3. Then everything else in this file (NEXT SESSION list below, reminders,
   bugs, parked ideas).

## Session 18: tactical gloves SHIPPED (Settings → Gloves, on by default)
User's CoD reference: black leather gloves + dark sleeves. Off = the PF look
from before (black rod arms, old hip framing, white showcase inspect arms).
- `models/build_gloves.blender.py` -> `models/gloves.glb` (244 KB): ONE
  skinned glove mesh on a bone rig (Hand, F{i}_{k}, T0-2) with the same
  frame/joints/sizes as hand-model.js buildHumanHand, plus GL_Sleeve. Kept
  lean on purpose (~5.8k tris a glove, 1.3k a sleeve, no subsurf): at ~66k
  per hand the software-rendered tests (SwiftShader) crawled to 3-20 fps and
  the sync test's grenade timings failed. `-- render` + GL_POSE for studio shots.
- `glove-model.js`: buildGlove(side, env) parses its own copy of the glb per
  hand (three r160 has no SkeletonUtils); HAND_POSES + GLOVE_POSES (trigger,
  support, foregrip) are converted into bone space (W⁻¹·R·W); each pose change
  is CPU-skinned once into plain baked meshes (skinned ones never draw);
  physical materials swapped for standard (sheen exported white); charcoal
  accents on knuckle guard / cuff / stitching.
- game.js `placeGlove`: right hand wraps the pistol grip; left hand C-clamps
  the side of the handguard (a hand under it is invisible from the eye),
  fists a vertical foregrip (`mesh.userData.supportStyle = "foregrip"`, the
  Green Candles), or holds the mag when magBlend > 0.35. Sleeves run wrist ->
  PF_ARM_SHOULDER. Poses are placed in gloveRig space (world anchors ->
  worldToLocal). With gloves on the hip framing is 0.2,-0.165,-0.5 (was
  0.22,-0.2,-0.55) so the hands show; inspect keeps the gloves.
- Test Range info box removed (user): N still spawns bots, Esc has the rest.
- `tools/static-serve.mjs [port]`: no-deps local server for trying a
  checkout (user tested the gloves on localhost:5190).
- OPEN: user reported "can't shoot or reload" on localhost; never reproduced
  (headless + in-app pane both fire/reload fine). Suspects: pointer lock not
  engaged, or a device enumerating as a gamepad (Y cycles weapons, d-pad
  right held swaps). Ask for the console snippet output if it recurs.
- Cache-bust: game.js `?v=to-gl1`, weapons/weapon-model `?v=to-gl1` in every
  importer, glove-model `?v=gl3`, gloves.glb `?v=gl3`.

## Session 18 (2026-09-28): Green Candles redesign SHIPPED
Design pass: https://claude.ai/artifact/C1sceMWU1LyUWGZqR8PPU4 (user: "blueprint
is good", wants very high detail). Recommended options taken: charge shot,
tank-swap reload, held level. Sightless became iron sights (ADS otherwise
stared at the back of the dome).
- **Model**: `models/build_greencandles.blender.py` (Blender 5.2 headless;
  `-- render` for Cycles studio shots, env GC_RENDER_DIR/GC_VIEWS/GC_SAMPLES)
  -> `models/greencandles.glb` (~93k tris, 3 MB), authored in game coords.
  Nodes: GC_Body, GC_BodyPrint, GC_Tank (+GC_TankPrint, GC_GaugeFill),
  empties GC_Grip/Support/Muzzle/Aim. User had "KEEP LIT · NO REFUNDS"
  removed; the tank just says GREEN CANDLES.
- **Loader**: weapon-model.js `preloadWeaponModels` / `buildGreenCandles`
  (scale baked in, GC_TUNE glow levels for ACES, per-instance materials,
  hose pulse shader via a `hoseT` attribute, 2 additive halo sprites,
  `setWeaponEnvMap` = small PMREM studio built in game.js that only these
  materials use). Tank = magMesh, so the PF reload pulls it off. New
  per-mesh hooks: `hipOffset`, `hipYaw`, `pfSupportDrop`.
- **Mechanism**: weapons.js fireMode "charge" + `def.charge`,
  `chargedShotDef(def, level)`, WeaponState `charging/chargeT/chargeCap/
  chargeLevel/cancelCharge`, `fire(cells, kick)`. game.js
  `updateCandleCharge` (its own press latch, not fireEdgeTrigger) and
  `updateGreenCandles` (gauge, candle breathe/flare/low-tank flicker,
  reload dark -> relight, hose pulse, halos, full-charge strain, the
  #to-charge ring). Net shot carries `c` (charge level). Audio:
  candleShot / candleCharge hum / tankSwap.
- **It fires actual green candles** (user ask): ballistics.js CandleRound pool draws each
  candleShot round as an upright candlestick-chart bar (body + wicks + glow),
  bigger when charged; rounds slowed to 110 / 150 m/s with `gravityScale`
  0.25 so you can watch them fly. Menu previews refresh once the model loads
  (Play-tab card, operator, Loadout viewer); the Play-tab thumbnail no longer
  auto-swings (it showed the fat gun from behind). Cache-bust `?v=to-gc2`.
- Test: `tools/troll-ops-greencandles-test.mjs` (19 checks, all pass).
  Shotgun, medal and sync tests pass. fps same as the 416.
- User asked about **realistic gloved hands** (CoD-style black tactical
  gloves, from their reference image): told them yes, doable in Blender with
  a finger rig; it would replace the PF black rods. Not started: ask first.
- **Lobby fixes (same session):** phones start with no mode picked, so the
  Scorestreaks tab only showed the versus-only note: now the picker shows
  until a no-streak mode is picked. "Back to arcade" is a pill left of the
  logo on every size (icon-only on phones; the old corner text and the
  copy hidden in Servers are gone). Landscape phones: short tab labels,
  radio/X/$TRUTHS chips top right (they covered Test Range) and hidden off
  the Play tab; portrait: profile button joins that chip row (it had been
  stuck top-left, unpositioned). Cache-bust `?v=to-lobby1`.
- Next asked: Troll Kombat pause button, better mobile UI, landscape only.

# (previous) end of session 17

Work happens on branch `game-improvements` in the worktree `GitHub/to-opus-wt`,
and each finished piece is fast-forwarded onto `main` (`git push origin
game-improvements:main`): "push" means land it on main. After pushing, also
`git pull --ff-only` in the user's own checkout (`GitHub/mayurski-art.github.io`),
or they see stale files there. github.com DNS drops out now and then; retry the
push in a loop. Sync test: `NODE_PATH=<main checkout>/node_modules node
tools/troll-ops-sync-test.mjs` (passes). Cache-bust in troll-ops.html is
`?v=to-lobby1` (game.js, style.css); bump on any change.
Modules imported with their own `?v=` (medals.js, killstreak-ui.js,
achievements.js, audio.js, and weapons.js + weapon-model.js in EVERY importer)
need that tag bumped too, and every importer of one module must use the same
tag or the browser loads two copies.

## NEXT SESSION: start here
Everything left needs the user first (ask before building):
1. **Username rename list** (bots, killfeed, scoreboard, nametags).
2. **Weapon rename list** (display names only; ids stay, or saved loadouts
   and XP break). Include the Grinmington 870 if they want it renamed.
3. **Custom crosshairs**: which options (style, colour, size, gap, dot,
   outline, per class?).
4. **Battle Royale** design doc (players/bots, map, drop-in, zone, loot vs
   loadouts, squads) before any code.
5. **Green Candles redesign** design pass (reference notes further down).
Also parked: troll NFT weapon skins (Tank Runner #1718 first; touches
wallets, ask), more radio songs (user sends mp3s), skins on hold.
Not verified on real hardware: medals, the 870, PF arms (headless only). Ask
how they feel on the user's laptop/phone.

## Session 17 (2026-09-28): Grinmington 870 SHIPPED

The BO2 Remington 870 MCS; the user said "you pick" the name + unlock:
**Grinmington 870**, id `grinmington`, shotgun class, **LV 16** (between
the Sawgrin KSG 11 and Guffaw Saiga 24). weapons.js:
- 8 pellets x 19 dmg, spread 0.085 (tighter than the Widemouth), falloff
  7-19 m: one-shot close. Tube of 8, reserve 40. 70 rpm (BO2's rate) and
  `pumpTime: 0.82`, so the pump animation fills the whole shot cycle.
- **Shell-by-shell reload** (`def.shellReload: { start, each, end, rack }`):
  WeaponState stages `shellStage` start -> shell (x N, +1 ammo each) -> end;
  an empty gun's end opens with a rack. `interruptReload()`: fire mid-reload
  stops loading (`fireQueued` fires as soon as it's back up, ~0.26 s); no
  rack if a shell was already chambered. `abortReload()` on a weapon swap.
  reloadT/reloadTime stay a whole-reload estimate. Any weapon can use
  shellReload now (Widemouth/Sawgrin still mag-style: ask before changing).
- `events` ("shell" | "pump" | "rack") are drained by the viewmodel
  (`drainWeaponEvents`) for `audio.shellIn()` / `audio.pump(dur)`.
Model (weapon-model.js `spec.pump`): ribbed forend group on a longer mag
tube (cap + barrel clamp); the support hand is parented to the forend, so
`userData.pfAnchors` is pre-set (the PF arm lookup only scans direct
children). `pumpMesh`/`pumpRestZ`, `shellMesh` (red hull, brass head),
`loadPort`. game.js: `shellReloadPose` (gun rolls port-side toward you,
muzzle up, a shove as each shell seats; support rod follows the shell via
magHold), `placePump` (forend back/home after a shot and on the rack),
`placeReloadShell`.
Test: `NODE_PATH=<main checkout>/node_modules node tools/troll-ops-shotgun-test.mjs`
(14 checks, all pass). Sync test passes solo.

## Session 17 (2026-09-28): BO2 medals SHIPPED

User picked: **Oswald** (not Barlow), **drawn badges** (not trollface art),
**+points shown**, **sound sting**. Built from the mockup:
- `medals.js` (new): the catalog (label -> shape/glyph/metal/pts; shield =
  kill, chevron = multikill, star = streak, hexagon = feat; silver/gold/red
  = rarity) and `badgeSvg`/`medalSvg`. "N Kill Streak" and "N× Multi Kill"
  are pattern families. Labels compare case-insensitively.
- `killstreak-ui.js`: `splash()` = badge + title + gold +pts under the
  crosshair (top 60%), newest on top, older shrink/fade/lose the badge, max
  3. `banner()` = the "UAV READY / Press 4 to call it in" bar (top 12.5%),
  also used for a peer's Nuclear callout (red). One sting per burst, pitched
  for the rarest metal (`audio.medal(metal)`).
- **Medal points are real**: `onPoints` pays them into the scorestreak meter
  and match XP (PvP). The headshot XP bonus moved INTO the Headshot medal
  (+50), so kill XP totals are unchanged; streaks now fill a bit faster
  (BO2-accurate). XP pops moved above the crosshair (top 41%).
- Streak rungs 3/5/7/10 are star medals now (the old "RAMPAGE — 5 in a
  row" wave banner is gone).
- New medals: **Avenger** (kill the enemy who killed a teammate within 5 s,
  `recentTeamKillers`), **Suicide** (PvP, 0 pts).
- After-action: badge grid with counts + "Medal bonus +N".
- Test: `NODE_PATH=<main checkout>/node_modules node tools/troll-ops-medal-test.mjs`
  (`OUT=<dir>` for screenshots), all pass. Cache-bust `?v=to-medals2`
  (game.js, style.css, killstreak-ui.js, medals.js, achievements.js, audio.js).
- Sync test: "infection: everyone starts a survivor" is timing-flaky under
  load (fails on unchanged main too when two runs share the machine).
Waiting items: see "NEXT SESSION" at the top.

## Session 16 (2026-09-27): logout -> guest fix, then PAUSED by the user

Fixed "Bugs to fix next" #1 (logged out, still `troll_runner`), in
`assets/js/troll-accounts.js`:
- `logout()` ignored signOut's result. supabase-js 2.110 keeps the stored
  session when the access token has expired and the refresh can't go
  through (sessionError path), so the page looked signed out and the next
  load restored the account. Now on any error it removes
  `trollrunner-accounts-auth` and the SSO cookie itself. Reproduced headless
  (expired token + API blocked): old code left the session stored, new
  clears it.
- Cross-origin: sign-out stamps a `trollrunner_sso_out` cookie (time);
  each origin keeps `trollrunner-accounts-auth-at` (set on a SIGNED_IN with
  NEW tokens, on cookie adoption and on the iframe bridge). A local session
  older than the last sign-out is dropped BEFORE createClient (else
  INITIAL_SESSION re-mirrors it into the SSO cookie). Only on
  *.trollrunner.net; not testable on localhost.
- Same-origin tabs: a `storage` listener dispatches auth-changed(null).
Test gotcha: troll-ops.html loads troll-accounts.js from the ABSOLUTE URL
`https://mayurski-art.github.io/assets/js/...`, so headless tests run the
LIVE file unless they route that URL to the local copy.

**Session 16 later (resumed): shipped** end-of-match medal list
(killstreakUi.medal/count/medals(), repeatable Revenge/Longshot/Shutdown via
Achievements onRepeat, "N Kill Streak" rungs, renderMatchMedals on the
game-over panel), range N key + Esc-menu bot buttons, PF arms/reload/
sprint/turn/slide (below), touch EMOTE button + X-hold duo accept,
inspect no longer cancelled by sprinting (user: PF lets you admire the gun
while running), compact Test Range strip on touch. Cache-bust
`?v=to-medals1` (game.js, style.css, killstreak-ui.js, achievements.js).
**BO2 medal mockup** for approval: https://claude.ai/artifact/KBMEkVCr471CLRCqWM5NBG
(drawn silver/gold/red badges: shield = kill, chevrons = multikill, star =
streak, hexagon = feat; centre stack; "UAV READY" banner; after-action grid
with icons). Open questions on the page: font (Barlow Condensed vs Oswald),
drawn badges vs trollface art, show +points or not, a sound sting. Build it
into killstreak-ui.js + renderMatchMedals once the user answers.
**Still waiting on the user:** username + weapon rename lists, Remington
shotgun (name + unlock level), crosshair options, and design docs for
Battle Royale + the Green Candles redesign. Details in the reminders below.

### PF build, session 16: user picked arms + reload + sprint/turn feel
(NOT the flat one-colour guns). All in game.js, shipped:
- `pfArms` / `posePfArms(mesh, magBlend)`: two black MeshBasicMaterial
  rods (unit cylinders, `stretchBetween`) from `PF_ARM_SHOULDER` to the
  hidden hand anchors; the support tip drops `PF_SUPPORT_DROP` under the
  handguard; sidearms put both on the grip. Anchors are cached per mesh
  as `userData.pfAnchors` (support = the hand at `supportHandPos`; build
  order differs per model). Hidden during inspect (inspectArms has its
  own), melee, streak devices.
- Reload: `reloadPose` = envelope only (roll 0.72 rad, sidearms x0.55) +
  `magT`/`magHold`; `placeReloadMag(mesh, t)` runs AFTER the gun is posed
  (screen-space targets need this frame's matrix): rest -> `MAG_HOLD_SCREEN`
  (visible, low-left, slerped upright to `MAG_HOLD_QUAT`) -> off-screen
  `MAG_DROP_SCREEN` swap -> back. Sidearms: straight down in gun frame.
  The support rod follows the mag by `magHold`.
- Sprint cant `sprintCant` (yaw, muzzle up-left), turn lag `turnLagX/Y`
  from look rates (position + yaw + roll), slide camera roll `slideTiltT`.
- Test hooks added: currentWeapon, tryReload, switchWeapon, pfArms,
  setAds, openPauseMenu, endMatch. Screenshot scripts were scratchpad-only.

### Phantom Forces video study (user sent a clip, 2026-09-27)
Source: a 22 s phone recording of a TikTok live of Phantom Forces (Roblox),
`Downloads/ScreenRecording_09-27-2026 20-57-08_1.mov` (888x1920, game area
is y 340-1600). User: "really study the various mechanisms... jumping,
sliding, reloading, aiming, speed, sensitivity... look at the arms,
there's no hands, the front end of the arms are 'hands', black coloured"
+ "study the weapon design too". Nothing built yet; confirm before building.
What the clip shows:
- **Arms:** two thin, pure-black, unlit tapered rods rising from off the
  bottom of the screen. No hands, no fingers, no visible elbow. The rod's
  tip IS the hand: the right rod ends at the pistol grip, the left rod at
  the handguard or magazine. They read as silhouettes, so they never fight
  the gun's colours. Troll Forces today hides its first-person hands on
  guns (user choice, session 9); PF's rods are the answer to "arms without
  ugly hands". Build: one tapered cylinder per arm, MeshBasicMaterial black,
  from a fixed off-screen shoulder to the existing grip/support anchors
  (`gripPos`/`supportHandPos`, the same targets `inspectArms` uses).
- **Weapon design:** low-poly, flat-shaded, one solid colour per gun (the
  AK is plain copper/salmon with a slight sheen), true-to-life
  silhouettes, chunky parts (big mag, top cover, tall front sight). The gun
  is BIG in view: bottom-right ~40% of the screen, muzzle pointing in
  toward the centre. The skinned C7A1 wears a black camo with copper
  crack lines over the same geometry. Loadout menu = a pegboard "gun
  wall" with the weapon hung on it, class tabs (Support, Recon, Carbine,
  Shotgun), blueprints/custom-slot cards.
- **Reload:** the gun rolls ~35-45° (muzzle up, mag side facing you), the
  left rod pulls the magazine out and down off screen, a fresh mag rises
  on the rod and seats, then the gun rolls back. The mag is its own mesh
  that travels with the arm; the old mag is not dropped in the world.
- **Sprint / move:** heavy weapon lag and roll when turning; sprint cants
  the gun diagonally (muzzle up-left). Weapon switch dips the gun off the
  bottom and raises the next.
- **Slide:** camera drops low and fast (sliding down the escalator), gun
  lowered and canted; momentum carries on slopes.
- **Aim (ADS):** iron sights centred, the gun's top (rear sight, top
  cover) fills the lower middle; modest zoom. Hip crosshair is tiny ticks.
- **Melee:** a quick-melee item (pink, held on the black rod) swings out,
  then the gun comes straight back.
- **Feedback:** floating damage numbers in orange italic at the hit (18,
  29), a red arc round the crosshair pointing at the damage source, small
  serif italic score lines ("+100 Enemy Killed", "Headshot Bonus", "Assist
  Counts As Kill"), "Hold [V] to pick up [MOSIN NAGANT]" prompts.
- **Speed / sensitivity:** can't be measured from a phone-filmed stream
  (no input, variable frame timing). Tune by feel against PF instead.
Already in Troll Forces (don't rebuild): slide, dive-to-prone, vault
(movement.js), idle sway + walk bob, damage numbers, hitmarkers, a
damage-direction indicator, weapon pickups. Gaps worth proposing: the
black rod arms, the mag-in-hand reload with a gun roll, sprint cant and
turn lag, slide camera, and a flatter one-colour weapon look (clashes
with skins on the 416; ask).

### FIXED (session 16): can't click "Spawn a bot" in the Test Range
Shipped: N key in the range, Spawn a bot (n/6) + Clear bots in the Esc menu
(renderPauseRange; Clear uses net.dropBot so rigs go too), HUD button kept
for touch and shows <kbd>N</kbd>. Headless gotcha: Esc does NOT release
pointer lock under Playwright, so mouse clicks land on the canvas; call
document.exitPointerLock() before clicking menu buttons in tests.
The button (`#to-range-spawnbot` in troll-ops.html, click handler
`spawnRangeBot` wired at game.js ~6561) lives in the in-match HUD, which is
only on screen while the mouse is pointer-locked to aiming. A locked cursor
can't click anything, and Esc (unlock) opens the pause panel on top, so on
desktop the button is unreachable; only touch can use it. The same trap
applies to ANY clickable control in #to-hud (check for others while fixing).
Proposed fix (confirm with the user before building):
1. **A key for it** while playing the range: e.g. `N` = spawn a bot (check
   it's free first: B third person, H emotes, T inspect, X pick up,
   Enter/Y chat, G/F grenades, 4/5/6 streaks, -/= sens, [/] fov). Show it
   on the button as `<kbd>N</kbd> Spawn a bot` like the sens/fov rows.
2. **The same button in the Esc pause panel** when the match is the range
   (plus "Clear bots"), where the mouse is free, so it's clickable too.
3. Keep the HUD button for touch (body.to-touch-play) and have it NOT take
   focus/pointer on desktop (it's a label there, not a trap).

## Session 15 (2026-09-27): emotes: first person, third person, duo

User ask: emotes in first person, third person, and duo emotes you invite a
teammate to by aiming at them (they hold X). Decided with the user: the
"troll starter pack", duo partners snap face to face, teammates only, 6 s
invite, hold X to accept.
- `emotes.js` holds the list: 3P (the 4 dances, Trollface sit, Dab), 1P
  (Point & laugh, L on forehead, Gun spin, Facepalm: `fp(t)` gives hand
  targets in viewmodel space + camera motion; `pose` is what others see),
  DUO (Dap up, High five, Chest bump, Duo dance: `pose[0]` inviter,
  `pose[1]` accepter, `dist` apart). Wire code: index+1, +64 for the
  accepter's half (emoteCode / poseEmoteCode). FP_HAND_POSES (point, L,
  flat) are merged into hand-model.js's HAND_POSES at startup.
- Wheel (emote-wheel.js) is a ring of all 14, tagged 1P/3P/DUO; duo slices
  are greyed until the crosshair line passes through a teammate's body
  (findDuoTarget: 0.9 m column, feet to head, in sight, within 10 m).
- Duo flow (game.js): pick -> net `{t:"duo", k:"invite", to, e}`; the
  teammate sees "<name> wants to Dap up: hold X" (ring fills, 0.5 s);
  accepting sends `k:"accept"` with the midpoint + direction, both snap and
  start. While an invite is up, X accepts instead of picking up.
- 1P emotes stay first person (the streak arms' real hands, layStreakArm);
  3P and duo pull the camera out (duo at a 3/4 angle, centred on the pair).
- Test: `tools/troll-ops-emote-test.mjs` (two tabs). Sync test still passes.
  The new/changed modules are imported with `?v=to-emotes1`.

## Session 14 (2026-09-27): match chat + in-game profiles

User asks: a chatbox in Troll Forces (match only; the site-wide TROLLCHAT
room was removed from trollrunner.net the same day, DMs/groups kept as
"Messages"), and the player profile inside the game.
- **Match chat** (`chat.js`, class MatchChat): rides the room's broadcast
  channel as `{ t: "chat", n, u, tm, x, tt }` (net.sendChat / onChat);
  nothing is stored. **Enter** = all, **Y** = team (team modes; receivers drop
  the other side's team lines). T stays weapon inspect (it was taken). While
  typing, the input swallows keys and game keys are cleared. Log lives in
  #to-hud bottom-left above the gear chips; closed it shows the last 6 lines
  for 9 s. Touch has no way to type yet.
- **Profiles**: each player's account id travels in hello/here (`u`, uuid-
  checked) as `peer.uid`. Names open the site's profile card
  (TrollrunnerAccounts.openProfileCard) from chat, the paused roster (a
  scoreboard copy) and the lobby "In the room" list. The lobby header has a
  round **your profile** button (openProfile, or sign-in when signed out).
  The Tab scoreboard itself can't be clicked (mouse is locked there).
- Test: `NODE_PATH=<main checkout>/node_modules node tools/troll-ops-chat-test.mjs`
  (two tabs, fake accounts). The sync test still passes.

## Session 13 (2026-09-26): GTA 6 skin "Vice Grin" + skin editor upgrades

Worked in the user's own checkout on `main`, committed + pushed at the end.
**Vice Grin is Final locked** (user, 2026-09-26). New skin `vice` / "Vice Grin" in skins.js, built from Deep Cover
(banner-11) and the GTA VI robbery key art (`skin-art/vice-robbery.jpg`, from
`banners/Jason_and_Lucia_Robbery_With_Logo_landscape...avif`). The user designs
it in the editor; don't overwrite their crops.

Skin tooling added (tools/troll-skin-draw.js, -editor.html, -editor.mjs):
- **Joined box:** `crops.receiver` = one box for upper + lower (JOINS /
  splitJoins); the art runs across the seam. Only skins that have it.
- **Any picture per part:** `art: { part: "banners/banner-11.jpg" }` (a path
  with a folder is under assets/images; bare names are skin-art). Editor strip
  of every banner + skin-art picture (server `GET /images`); Save writes `art`.
- **Text areas on a part's own picture:** `art: { part: { file, textAreas } }`,
  flipped in place on the right side (sides formula).
- **✂ Snip** (S): drag a part-shaped rectangle on the picture, like a screenshot.
- **Box opacity** slider (fades the picture INSIDE the coloured boxes; outside
  stays full), **box layer order** (▲▼ column, PgUp/PgDn; editor view only).
- **Part layers:** `layers: { part: [{ file, src, at, rot, flip, opacity,
  feather, text, lock }] }` lay pieces of any picture over a part's locked
  base without moving it. Edited in the Layers panel + flat part view under
  the parts table. `text: 1` flips a piece in place on the right side.
  Layers flip with ⇆ (`flip`) / ⇅ (`flipY`). **Opacity eraser** (🧽, E) and
  🖌 Restore paint a per-layer mask on the part view (Strength caps how far
  one stroke fades); Save writes it to
  `assets/images/skin-art/masks/<skin>-<layerId>-<ver>.png` (older versions
  of that layer's mask are deleted) and the layer keeps `mask: "<file>"`.
  Unsaved strokes live in the draft as `maskData`. Wheel over the picture
  zooms a selected layer's snip; Size slider and +/− size it on the part.

Vice's stock: plain sky base + the GTA VI logo as a `text: 1` layer, so it
reads correctly on both sides. The raw source files
`banners/gta6-trollbanner.webp` and `banners/Jason_and_Lucia_...avif` are
left untracked on purpose (unused by any skin; banner-17.jpg and
skin-art/vice-robbery.jpg are the converted copies).

### Idea (user, 2026-09-26): troll NFT based weapon skins
Make weapon skins from the user's troll NFTs (OpenSea collection
"trollsoneth"; see the autotrollinfo skill). Thoughts to explore, nothing
decided: a skin per NFT (or per trait set) using the PFP art as banner/layers;
possibly unlocked by holding that NFT (wallet check via the Phase 10 wallet
layer, flag-gated) or as cosmetic-only for everyone. Ask the user before
building; it touches wallets/ownership.

**First candidate: TROLLS #1718 "Tank Runner"** — the user's own troll
(troll_runner bought it for 0.11 ETH, 2026-09-27; lore §66 in
trollrunner-terminal/docs/TROLL-LORE.md). Moustache trollface, black "U MAD
BRO?" cap, neon-green tank top reading RUNNER, grey stone gradient. The art
(1000x1000) is copied to `assets/images/skin-art/trolls-1718-tank-runner.jpg`
(source: trollrunner-terminal/public/lore/), so it's already in the editor's
picture strip. Neon green + black palette. When built: mark text areas round
"U MAD BRO?" and "RUNNER" so both read correctly on the right side.

## Session 12 (2026-09-26): Halloween map "Hollowgrin"

Worktree `GitHub/to-halloween-wt`, branch `halloween-map` (from main cdc07c9).
User ask: "create a halloween themed map. take your time... think deeply.
this map should be able to be played in multiplayer and zombies mode."
Decided with the user: Zombies stays ONE mode; its map card gets a **Change**
button that picks between The Pentagrin and the Halloween map (not a second
mode row).

**Also noted, NOT started: GTA 6 themed skin for the Problem 416.** The user
will SEND the image (GTA-style troll art). When it arrives: put it in
assets/images/banners (or skin-art), add a SKINS entry in skins.js, bake,
then the user fine-tunes the crops in the skin editor. Follow the sides
formula (mirrored placement, text readable on both sides).

### Plan
Map id `hollowgrin`, its own module `hollowgrin.js` (like pentagrin.js),
procedural three.js geometry (no GLBs), registered in MAPS so it's in the
PvP picker too. Night, full moon behind the manor, purple fog, jack-o'-lanterns
(emissive, flicker via onBeforeRender). Only a handful of real lights, all
built at load: NEVER add lights at runtime (see light-pool.js).
- North: **Grinmoor Manor**, 2 floors (ground y 0, upper y 3.6), grand stair
  in the foyer, balcony over the front porch, doors on every side.
- Centre: town square round a dead oak: pumpkin stalls, hay bales, well, cart.
- West: **graveyard** (tombstone rows as low cover, iron fence with gates, a
  mausoleum you can enter). Zombies claw up out of the graves.
- East: **pumpkin patch + corn rows** (tall soft cover, bullets pass), scarecrow.
- South: candy shop + barn. Team spawns split north/south.
Engine work so zombies runs on a map other than the Pentagrin:
1. ZombieDirector takes a per-map zombie layout (windows, floorOf, floors,
   stair links) instead of importing pentagrin.js directly.
2. Zombies on another floor walk to the stair link, climb it, then chase.
   FlowField gets a `needSupport` option so upper-floor fields don't route
   through thin air.
3. Grave spawns rise out of the ground.
4. Max Ammo drop (once a round), so zombie runs don't run dry (both maps).
5. Lobby: zombies map pool + Change button, with its own saved zombies map id.
Verify with tools/troll-ops-map-audit.mjs, -walk, -shots and -fps (NODE_PATH =
main checkout node_modules), plus a zombies logic check, then screenshots.

### Status: v1 SHIPPED to main (cache-bust `?v=to-s12a`)
All of the plan above is built and checked headless:
- Map audit PASS (no traps/floating/blocked spawns; upstairs, balcony and
  mausoleum reachable). fps from the aerial view: 34.8 (Cul-de-Grin 38,
  Grin Site 44), 278 draws/frame (fewer than either).
- Zombie routing sim: 24/24 zombies reach the player across 9 cases (ground to
  upstairs, upstairs to ground, into the mausoleum/corn/shop/barn).
- Live zombies match: grave rises, Max Ammo drop + pickup refills reserve.
- TDM with bots: spawns split N/S, bots cross all three lanes, kills land.
- Lobby: Zombies map card shows Change (Pentagrin / Hollowgrin); picking one
  is saved as `poolMapId`, separate from the versus `mapId`.
Things learned:
- Zombies step ~0.5 m but FlowField treated anything under 1 m as walkable,
  so zombies jammed on hay bales, wells and tables. New `navStep` layout
  option (0.45). Also applied to the Pentagrin, which FIXES a pre-existing
  main bug: zombies stuck at the boardroom table at (0.3, -11.4).
- Interiors at night go black on hemisphere light alone: interior materials
  use `bounce` (emissive = the texture, x0.2) instead of more real lights.
- metreUVs must pick the projection per triangle, not per vertex, or low-poly
  cylinders (the obelisk) smear.
- `matchMapId()` in game.js decides a match's map from the mode itself
  (forceMap / mapPool / room map), not from lobby UI state.
- Test hooks added: `__trollOps.zdir()`, `__trollOps.loadedMapId()`.
Ideas not done: zombie economy (doors, wall-buys, box) is still Pentagrin Z2
backlog for both maps; co-op zombies; remote players on the upper floor for
bots (bots nav is ground-floor only, like every other map).

## Reminders from the user (2026-09-27, not started)

- **Change the usernames.** The names shown in-match (bots, killfeed,
  scoreboard, nametags) need a pass. Ask the user what they want them
  changed to before touching anything.
- **Change the weapon names.** Rename weapons across the loadout, killfeed
  and HUD. Get the new list from the user; weapon ids/storage keys should
  stay put so saved loadouts and XP don't break (display names only).
- **DONE session 17.** **Restyle the killstreak and medal callouts.** The font and display of
  the on-screen titles: HEADSHOT, REVENGE, AVENGER, SUICIDE, double/triple
  kill, the streak "ready" notes, etc. (killstreak-ui.js badges). Target
  look: **Call of Duty: Black Ops 2** — its medal/splash style (the medal
  icon with the title and "+score" underneath, stacking centre-screen,
  BO2's condensed uppercase font). This includes the medal badges
  themselves (the icon art), not just the text. Confirm the look with the
  user (mockup first).
- **DONE session 16-17.** **Show earned medals at the end of the match.** Like BO2's after-action
  screen: the post-match summary should list every medal/badge earned that
  match (with counts, e.g. HEADSHOT x4), not just flash them mid-game.
- **New game mode: Battle Royale.** The user wants a battle royale mode
  added to Troll Forces. Nothing decided yet: player count / bots filling
  the lobby, map (a new big map vs. an existing one), drop-in, shrinking
  zone, looting vs. loadouts, solo/duo/squads. Big build: draft a design
  doc and settle those with the user before any code (see the "design doc
  before big builds" rule).
- **DONE session 17 (Grinmington 870).** **Add a Remington shotgun.** Like the Remington 870 MCS in Call of Duty:
  Black Ops 2: pump action (a pump per shot, shell-by-shell reload you can
  interrupt), wide close-range pellet spread. New weapon in weapons.js +
  model + loadout slot + unlock level; ask the user for its in-game name
  (weapon names are also due a rename pass, see above).
- **Custom weapon crosshairs.** Let players customize their aim crosshair
  (style, colour, size, gap, dot, outline; maybe per weapon class), saved
  with their settings. Ask the user what options they want first.

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

1. **FIXED in session 16 (see top).** **Logged out, but Troll Ops still says `troll_runner`.** After logging
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
