# Troll Forces (troll-ops) hand-off

Trimmed 2026-10-05. The full pre-trim log, with every build narration and old tag history, is at `git show fd23167:assets/games/troll-ops/HANDOFF.md`. Phase 2a's original notes are in commit ddd63a7.

**House rule for this file:** keep it short.
- When a task ships, move it to the one-line **Shipped log** at the bottom.
- Keep only what still constrains future work: architecture, rules, gotchas.
- Add a section for live work, then fold it down when it's done.

Design docs live next to this file: `COPS-AND-ROBBERS.md` (approved plan), `ZOMBIES.md` (Pentagrin zombies), `DESIGN-ARMS.md`, `DESIGN-PF.md` (both done).

---

## 1. Open work and plans (newest first)

### Dust Bowl (bazaar redesign done 2026-10-07)
Open: watch spawn S3 (0, -33) in playtests; the loading dock sits on the wall-strip sightline 14-17 m from it. A crate stack between them would fix it but closes that line.
Any later Dust Bowl edit holds to: bounds, spawns and the perimeter collider unchanged; nothing solid within 3 m of the S&D sites, which must stay at A (14.48, -18.21) and B (14.37, 14.24); all 15 dustbowl walk routes passing; the five 45 m+ east-west lines in the north half kept open (z -34.3 to -33, -29.3, -26.7, -18.8 to -15.5, -15 to -12); frame rate checked with tools/troll-ops-map-fps.mjs against a worktree of main. Every solid piece is a collider in maps.js plus the matching mesh in models/build_dustbowl.blender.py, sized from the same numbers.

### Troll City roleplay, phase 2 remainder (Socialize, Troll City only): ON HOLD
The user put this on hold on 2026-10-05; don't start it unless asked. Phase 2a has shipped: seats, the pianist, the doctor. Still to build, in this order (estimates from 2026-10-05, mostly test time):
- **2b:** sheriff + jail (3-4 h): badge, cuff, cells, wanted board. The courthouse geometry for the office and jail is already in.
- **2c:** merchant + horsekeeper (3-4 h). Riding horses is the big piece; saddled horses that are only led around (no riding) would save about 1.5 h.
- **2d:** train conductor (2-4 h). A real moving train with riders is the riskiest item; a scripted ride (depart, fade out, arrive back) takes about 1 h.
- **Not yet checked by eye:** 2a's seated bodies and the pianist's hands. The tests pass, but no screenshot was taken (a scratch screenshot script hung while loading). Look in game before building on them.

Follow the 2a pattern:
- Jobs and their wire letters go in `rp-roles.js` (`ROLES`, `rr`); spots and furniture go in `trollcity.js` (`rp.*`).
- The logic goes in game.js, after the saloon-bar code.
- One player per job, first come first served. On a tie the older peer keeps it, like the apron.
- A role-gated `rp` message is only honoured from a peer holding that role, like `cure`.
- The NPC who normally holds that job hides via `TownNpcs.setYield`.
- Test template: `tools/troll-ops-rp-test.mjs`.

### Cops and Robbers (co-op heist, Trolling Loud only): PAUSED, resume at phase 1
- The plan is APPROVED; see `COPS-AND-ROBBERS.md` (phases and hook sites). User-facing doc v3.1: https://claude.ai/artifact/D1n9QkSTibBhGSik7hx1mW
- Phase 0 is done and approved by the user (2026-10-04).
  - Officer bodies: `cop-bodies.js`, `cop-lab.html`, `models/build_cops.blender.py`, `cop-*.glb`.
  - Officer mechanics: aim, run, crouch-walk, downed.
  - 12 officers cost about 2% frame time over 12 stick figures.
- **Next: phase 1, the solo heist.** In order:
  - `modes.js` entry plus a `?heist=1` reveal
  - `heist-core.js` plus its Node test
  - `heistLayout()` in `trollingloud.js`
  - `BotManager.spawn` / `remove`
  - the `game.js` hooks
  - `heist.js` director
  - `heist-hud.js` tracker
  - drill, bags, van, end screens
- Remaining size: about 11 planned sessions (phases 1-5); phase 0 ran about 3x its estimate.
- Police are the plain human officer. Officer Grin (`cop-grin.glb`, the trollface mask) is a player cosmetic, never an enemy.
- Bouncers there are AI enemies, separate from the Socialize NPCs.
- How the body works:
  - `syncCopBody(rig, rp.bodyPose)` runs after posing. `bodyPose` holds gait, lower, mps, moving, forward, strafe, ads, reload and death.
  - Bots wear it through `bot.body = "patrol"`, sent as the `bd` wire field.
  - Officers always fall onto their back. The rifle drops to the floor (`cop.drop`) and goes back in hand on respawn.
  - character.js is untouched; never "fix" the rig for trolls.
- Rig quirks the officer body works around:
  - The stick rig leans BACK 7-10 degrees in a run and a crouch; the officer cancels it with `rigBack`.
  - The rig turns its neck and head AGAINST the aim pitch; `syncCopBody` flips it for real heads.

### Zombies (ZR4 done): gotchas
- **One mesh per zombie:** build_zombies.blender.py `atlas_merge` joins every part onto a 2048x1024 atlas (skin = left half, cloth/mask 512 cells, shoes/teeth/eyes 256). The per-zombie tint only touches u < 0.5 (zombie-models.js `skinTinted`); a new part must get a cell, not its own material.
- **Also:** a popped head is `bones.head` scaled to 0.001, re-applied after every mixer update (clips key it). Gore materials are pre-compiled in warmShaders via `goreStandIns()`; any new gore material must join it or the first kill stalls a frame.
- **Design doc v2:** https://claude.ai/artifact/Motm585y8qJeknjWVv9CuC

### U Mad Bro? (funny FFA mode, Prestige 2): ON HOLD
The user said "HOLD OFF" until they say go.
- Done so far: phase 1 (mode + funny layer), phase 2 (hero kits), and the Knight body.
- Order when resumed:
  1. Hunter (+ Doge)
  2. Super Troll
  3. Metamorph (both forms)
  4. Trollernaut pointstreak (1,500 pts / 40 s): 10 s invincible, then 3x HP at 0.75x speed; diamond gauntlet on the RIGHT hand whose punches launch people
  5. funny weapons
  6. Horde (co-op, on Hollowgrin)
- Each hero gets a different head:
  - Hunter: ram-skull helm
  - Metamorph: half Pepe, half chrome
  - Super Troll: classic head + cape collar
  - Trollernaut: oversized and glossy
- Bot heroes get HP and speed only, no abilities.
- Melee weapons are stand-ins:
  - Knight: keyboard x1.3
  - Hunter: reaper
  - Super Troll: saber
  - Metamorph: halo
  - Brute: x2
- Known gaps:
  - The `hr` wire field doesn't render for heroes without a GLB.
  - FFA modes still show the team score bar.
  - Never tested with two real players.
- Weapon pitches (none approved individually):
  - RGB Keyboard Greatsword
  - Rubber Chicken
  - Ban Hammer (fake BANNED screen)
  - Copium Launcher
  - Ratio Rifle
  - Doge Cannon
  - Dial-Up Shotgun
  - Trollface Boomerang
  - Diamond Gauntlet
  - the user's Reverse Uno card (reflects for a short window)
- **Design doc:** https://claude.ai/code/artifact/d5986295-491c-476a-b5b1-7313909a6ee2
- Hero refs are `refs/*-ref.jpg` (local only, never commit).

### The user's 2026-10-02 wish list (not ordered or confirmed)
- **Tablet streak animation:** the right hand presses confirm. The tablet never says "boarding" or "onboarding".
- **Royale bus-deploy cinematic,** in third and first person.
- **Animated weapon skins** with effects coming off them.
- **"For You" emote:** only while falling in Royale. The troll reaches out a hand romantically, with face, hand, body and background shots.

### Backlog (needs a design doc / the user's go first)
- **Audio + dialogue pass.** BO2 cadence (streak callouts, match flow, objectives, medals, chatter, Royale lines) in a troll voice, with original wording. The doc must decide:
  - TTS vs recorded
  - audio.js hooks
  - a voice setting
  - a chatter rate limit for 100 players
- **Flamethrower.** It must be a "VERY unique design" with its own silhouette like Green Candles, not a stock military flamer. Steps:
  1. a doc pitching 2-3 concepts
  2. a Blender glb
  3. a tank-swap reload
  4. fire stream and burn FX
- **Halloween skin for the Problem 416:** pumpkins, reaper, bone, violet and orange.
- **Troll-NFT weapon skins.** It touches wallets, so ask first. First candidate: TROLLS #1718 "Tank Runner" (art at `assets/images/skin-art/trolls-1718-tank-runner.jpg`). Skins in general are on hold.
- **Royale:**
  - duos/squads and Troll Court; needs N teams, since only phantom/ghost exist
  - real art for the bus, glider and lobby box (ask before Blender work on landmarks)
  - loot race: two players can take the same item in one latency window
  - grenades should be looted
- **Waiting on the user:**
  - rename lists for usernames and weapons (display names only; ids must stay)
  - custom crosshair options
  - more radio mp3s. Add them to `music.js` TRACKS, then run `node tools/troll-ops-beatgrid.mjs`.
- **On hold:**
  - Grinleria leftovers
  - more cosmetic slots
  - Royale landmark art
- **Cancelled 2026-10-03:** Purge XP; $TRUTHS tournaments; the whole 2026-09-30 open-asks list.

### Small known gaps (fix if touched)
- **Flaky test:** trollingloud-test's "zombies reach a player on the ground (bar)" scores 1.6-2.5 m against a < 2.5 limit, on main as well, so it fails about 1 run in 3.
- **Bots:**
  - Bots use the ground floor only on every map, and rarely visit Hollowgrin's far districts.
  - Bots don't shoot down the VTOL Warship or Swarm drones.
  - K9 dogs walk the ground flow field only, and nobody but you calls them.
  - Bots ignore an enemy UAV beyond the minimap.
- **Killcam** doesn't record swivels.
- **Zombie rounds:** mid-round shader compiles; warm those materials in warmShaders.
- **Hollowgrin:** the chapel bell doesn't swing and the rides are silent.
- **Grinleria:** static escalators, no zombies layout, upper level unused by bots.
- **Shotguns:** Widemouth and Sawgrin still use mag reloads. Ask before switching them to `shellReload`.
- **Map-vote previews:** the `?v=mp1` tag wasn't bumped after the Hollowgrin 6f re-shot.
- **Old unreproduced report:** "can't shoot or reload" on localhost. Suspects: no pointer lock, or a device enumerating as a gamepad. Ask for console output if it recurs.

---

## 2. User rules (still binding)

**Process**
- Design doc before big or ambiguous builds, and get the OK at each phase gate.
- Merge each finished phase to main.
- Parallel sessions each use their own worktree + branch. Commit only your own files.
- No build timelapses or turntables (Blender `-- check` renders for review only).
- Run headless tests ONE AT A TIME.

**Art**
- Never the troll emoji. The mascot is the trollface artwork.
- Generated art must read as the trollface style.
- Reference screenshots from other studios in `refs/` are LOCAL ONLY. `refs/western/` and `refs/nightclub/` are committed.
- Strip AI metadata from user art by re-encoding it through a canvas.

**Naming**
- The display name is Troll Forces. ids, URLs and storage keys stay `troll-ops`.
- Teams show as Trolls (phantom) and Jeets (ghost).

**Hands**
- First-person arms are the black PF rods only (gloves were removed 2026-10-05); "we're not using white hands".
- No first-person hands on guns. The rods act out first-person emotes; a held prop sits where a hand would hold it and the rod tip touches it (lean-cup.js rodTip).

**HUD**
- No control/key hints while playing. The one exception is Royale's pulsing X / "D-pad →" pickup keycap and the hold-X keycap prompts (bar, DJ).
- No Kills counter top-left (Zombies shows Points).

**Gameplay**
- XP was cut to a tenth ("way too much xp"); don't raise it.
- TDM is first to 50.
- Max 3 streaks per loadout. BO2 names are kept and streaks must be "very accurate to Black Ops 2".
- Lean was dropped; Q is aim.
- Pad: Y = swap; L3 / R3 = swivel; L3+R3 = emotes. Desktop: H = emotes, T = inspect.
- Chat: Enter = all, Y = team.

**Owner `troll_runner`**
- No level, a gold OWNER badge, and everything unlocked.
- Every gate must go through getRank / rankUnlocked / isUnlocked / prestigeUnlocked.
- View mode and the Socialize mode switch are owner-only.

**Prestige**
- Troll Forces only; the site level never resets.
- Level curve `120n + 2n^2`, cap 69; P1-10, then 11 = Prestige Master.
- Nothing relocks.
- Clan tags are 4 chars A-Z0-9.
- Guests never prestige.
- Reward maps (Pentagrin P4, Trollface P8) are private rooms only.

**Socialize**
- "No fighting, no scorestreaks." One public room, QSOC.
- Roleplay is Socialize-only (`isSocial()`). Bar, seats, piano and doctor are on Troll City; DJ Lulz is on Trolling Loud.
- NPC name tags: only roleplay jobs, within 12 m.

**Lights**
- Never `new THREE.*Light` at runtime; borrow from `light-pool.js`.
- Maps make their real lights at build time (Trolling Loud ≤ 14).
- Gfx tiers never change shadow type or light count.

**Zombies**
- Zombies is ONE mode; its map card has a Change button.
- Bodies are MakeHuman / MPFB 2, CC0 packs only.
- 1/40 trollmask rare.

**Skins**
- Only the Problem 416 wears skins. Each part is "the banner only".
- The user designs skins in the editor; don't overwrite their crops.
- Final-locked skins: You Have a Problem, Vice Grin.
- Sides formula: the right side mirrors the left, and writing still reads correctly on both.

**Weapons**
- Peacemakers: alternate L/R fire, 12 rounds, right-click fans the hammer.
- Trollsaber: Vader's hilt, red blade, no text.
- Green Candles says only "GREEN CANDLES" on the tank.

---

## 3. How things work (reference)

### Versioning and deploy
- **Cache-bust tags:**
  - troll-ops.html loads `game.js?v=…` and `menu-bo2.js?v=…`.
  - Bump the tag of every changed module AND of its importers, cascading.
  - **Every importer must use the same `?v=`,** or the module loads twice with split state. This bites maps.js (game / loadout / menu-bo2), progression.js, character.js and rank-icons.js.
- **Merge conflicts** are almost always tag lines: keep both suffixes (e.g. `-rp1-dj1`) and keep importers consistent.
- **Deploy:** push to main, then confirm with `curl -s https://trollrunner.net/troll-ops.html | grep game.js?v=`.
  - Pages can silently skip a deploy; an empty commit kicks it.
- **Service worker** (`/sw.js`, registered in game.js; off on localhost unless `?sw=1`, `?sw=0` unregisters):
  - Troll Forces art and `assets/vendor` are served cache-first and re-checked daily.
  - `?v=` scripts are cached by full URL, newest 3 tags per file.
  - A new asset type or folder means updating `kindOf` in sw.js.
- **CSP:** troll-ops.html img-src and connect-src need `blob:` (GLTF textures). A new fetch target needs connect-src.

### Netcode (net.js)
- **Transport:** Supabase broadcast, BroadcastChannel locally.
- **Batching:** sends within 50 ms go out as one `{t:"batch"}`. Supabase drops past 30 events/s, and past 24 hosted bots each bot sends at 10 Hz.
- **Host:** the longest in the room (`since`, lowest id on a tie). Room map, stage clock, bots, S&D and infection all follow the host.
- **Room map:** every versus room plays the host's map (`followsHostMap`, `roomMapHint`).
- **Socialize mode switch:** `publishMode {t:"mode",mode,map,ms}`, accepted only from an `owner` peer.
  - `roomModeSeq` rides as `ms`.
  - An owner switch adds 2 and a match end adds 1.
  - Match end → 8 s → back to the hangout.
- **`publishRp(payload)`** spreads the payload over `{t:"rp", id}`. **Never name a payload field `t`** (it overwrites the message type).
  - rp kinds: offer/take/give/bell/cure, and the `dj*` kinds (dj-lulz.js).
- **State packet extras:**
  - `dk`/`ds` drink
  - `rr` role
  - `se` seat
  - `pn` piano tune
  - `em` emote (index+1, +64 = duo accepter)
  - `sv` swivel
  - `fc` face cosmetic
  - `hr` hero
  - `lv`/`pg`/`ow`/`cl`/`cc` (level / prestige / owner / clan / card)
  - `dr`/`ro` (Royale drop / roll)
  - `bl` block
  - `bs` bot skill
- **Other messages:**
  - `chat {n,u,tm,x,tt}` (nothing stored)
  - `duo` invite/accept/cancel
  - `fx` (fling/pin, applied by the target or the bot host)
  - `loot`, `deflect`, `cuav`, `k9`, `streak`, `bomb`, `stage`/`ready`, `vote`
  - air hits `kind:"air"`

### Map hooks (any map may export them)
- `onShot(point)`
- `attachAudio(audio)`
- `attachMusic(music)`
- `onFrame({live, radio, song})`
- `zombieLayout()`
- `rp: {bar, seats(), doctor, npcs()}`
- `dj: {spot, club, input()}`
- `debug()`
- `bombSites: [{id, x, z}]`: S&D plants there instead of at `pickBombSites`' guess. Ground level, open floor, any raised floor more than 5.5 m away (the plant check is 2D).
- `api.rope(x, z, y0, y1, {dir, ghost})`: a climbing rope (movement.js `STANCE.ROPE`) and a `rope: true` floor link for bots. Hang it in a clear shaft: a climb ignores collision. `dir` is the side you step off at the top.

Map rules:
- Blockout colliders stay in the map JS; Blender GLBs go over them via `mapModel` / `hgModel`. The numbers in the Blender builders are COPIES of the colliders: change one, change the other.
- Spawns may be `[x, z, floorY]`.
- `api.stairs` origin is the bottom step's outer edge.
- Doorways ≥ 1.7 m for zombies.
- Zombie floors stay ≤ 0.4 m over the ground.
- A zombie link's end must be on the floor it names.

### Socialize and roleplay
- **Socialize:** `MODES.social` (pvp, social, noStreaks).
  - `isSocial()` gates damage, fire, ADS, reload, melee, cook, weapon swap and inspect. No bots.
  - The gun is never drawn and the wire sends `w:null`.
  - `body.to-social` hides the combat HUD; `els.hud` stays because the emote wheel and the DJ chip live in it.
- **Troll City bar:**
  - The spots are `BAR` in trollcity.js; the logic is game.js `updateBar` / `barAction`; the meshes are saloon-bar.js.
  - Fire sips, G puts the drink down, `tipsyFx` sways the camera.
  - `barAction` is the single hold-X dispatcher for Socialize; DJ Lulz's booth action is checked inside it.
- **Seats:** `SEATS` is filled by wrappers round the kit builders, plus `rpFurniture()`. Hold X to sit; move, jump or C to stand.
- **Pianist:** `PianoVoice` (WebAudio).
- **Townsfolk:** `town-npcs.js`, cast from `townNpcs()`.
  - Local, seeded, no collision, not networked.
  - LOD: full rate < 40 m, a few poses a second to 85 m, hidden beyond.
  - Each NPC is 4 draws (body, 2 mitts, face) plus 4 for its shadow, so a big cast needs the map's `rp` options:
    - `npcShadows: false` turns the shadows off.
    - `view: { zoneOf, sees }` draws only the rooms the camera can see into.
    - `beat()` puts the dancers on the music's clock.
  - Trolling Loud (`clubNpcs()`, 119 NPCs) uses all three, which keeps its draws at or under a TDM match's.
  - The faces render from both sides, so a screenshot can't show which way an NPC faces; look at the knees.
- **DJ Lulz** (`dj-lulz.js`, Trolling Loud, Socialize):
  - He plays music.js TRACKS for the room through the booth chain (`TROLLINGLOUD.dj.input()` → muffled lowpass + panner).
  - **Requests:** hold X at the booth (0, -12.9) to open the panel. A request goes PENDING (2.6 s), then QUEUED. One per player; queue max 6. A request mixes the DJ's own pick out after ≥ 25 s.
  - **Who keeps the queue:** the room's oldest player broadcasts `djstate {seq, now, q, rn}`.
  - **Clock sync:** clients take the MAX of their recent `rn - Date.now()` samples as the clock offset (latency only shrinks it).
  - **Drift:** small drift is played out at 0.97 / 1.03 speed; over 0.4 s it seeks.
  - **Audio traps:** never reassign `currentTime` every frame while `play()` is pending, or the seek restarts forever.
  - **Volume:** your own radio mutes the DJ for you only. The volume is per player in localStorage.
- **Beat grid:**
  - `tools/troll-ops-beatgrid.mjs` (ffmpeg + node FFT) writes `music-beats.js`: per track bpm, offset, downbeat and per-beat kick / level digits.
  - Trolling Loud's `onFrame({song})` drives `uBeatPos` / `uKick` / `uLevel` from it, for the DJ's record or your radio.
  - The dance floor (kit `neonPatch`, `aRip` tiles) cycles 4 beat patterns every 8 bars. Without a song it runs the 128 BPM synth clock.

### Combat systems
- **Streaks:**
  - Each key 4/5/6 fires its own row. `lockStreak` keeps the charge (COOLDOWN / JAMMED).
  - Bots: `BOT_STREAK_POOL`, `updateBotStreaks` (bot host). Sky cap: 2 air streaks per team + 1 bot warship.
  - Aircraft hitboxes via `attachAirHitbox`.
  - `raycastWorld` returns a DISTANCE.
- **Weapons:**
  - detailed GLB guns: weapon-model.js `DETAILED` + models/gunkit.py
  - finishes: skins.js `FINISHES` + `applyFinish`
  - shell reloads: `def.shellReload`
  - Green Candles: `chargedShotDef`
  - melee meshes need `userData.meleeId`
  - gear.js `basisPointing` is a mirrored basis on purpose
- **Royale:**
  - royale.js: zone, loot, seeded rng; royale-drop.js: lobby, bus, glider
  - seed = hash(room:matchesPlayed), adopted from the stage owner's `sd`
  - Trollface Island: map-% → metres x = (px-50)*4.54, z = (py-47)*3.62; edge is a polygon clamp (edge.js); wading at y < 0.5
  - crowd LOD past 24 trolls
  - the trollface.io art is REFERENCE ONLY
- **Heroes:**
  - hero-bodies.js: rigid `<joint>__<piece>` GLB pieces + an ink hull, built by `models/build_hero_<id>.blender.py` (hero_kit.py)
  - `applyHeroLoadout` must run after `resetInfection`
- **Prestige / cards:**
  - progression.js, rank-icons.js, calling-cards.js, profile-card.js, record.js
  - A new reward card goes in CARDS AND in SQL `troll_forces_card_allowed()`.
  - `troll_forces_card.sql` must be re-run for the phase 5 cards.

### Skin editor (the user's tool)
- `node tools/troll-skin-editor.mjs` in the USER's checkout → http://127.0.0.1:5174/tools/troll-skin-editor.html. Never test on 5174; use 5180 from a worktree.
- Before touching skins.js:
  1. copy the user's diff and jpgs into your worktree
  2. commit and push
  3. in their checkout: `git stash push -- <files>` then `git pull --ff-only`
  4. restart their server
- An open editor tab's next Save overwrites your change: have the user hard-refresh first.
- **Data:**
  - `crops [cx,cy,zoom,rot,flip]`, `lines`, `cutouts`, `textAreas`, `right` overrides, `layers` (masks in `skin-art/masks/`), `art`/`paper` keying
  - atlas 1024², right side at `SKIN_ATLAS.rightY`
- **Gotchas:**
  - Text areas must hug the letters.
  - The 3D view lights the left side harder; check atlas pixels before "fixing" a colour.
- `node tools/troll-skin-bake.mjs` re-bakes. Revert `factory-thumb.jpg` if nothing changed.

### Blender
- `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python <script> [-- args]`
- Shared kits: `models/map_kit.py`, `hero_kit.py`, `gunkit.py`.
- Quantize with `quantize_glb.py`.
- glTF base colours are LINEAR: use `hexlin()`.
- No env map, so metalness > 0.3 renders black.
- MPFB:
  - The palette needs `use_fake_user`.
  - `join()` merges UVs by name: rename every part's layer to "UVMap" first.
  - Never call `read_factory_settings`.
  - Remove the "Delete.*" MASK modifiers.
  - Pose-bone scale doesn't survive glTF.
- three r160 has no SkeletonUtils; local `cloneSkinned()` helpers exist.

### Gotchas (misc)
- Files are CRLF on disk (autocrlf): normalise before multi-line string replacements, or use the Edit tool.
- Inline `node -e` breaks on apostrophes: write a script file.
- game.js skips the arena render while `body.to-bo2-cover` is set. If the lobby is black behind a screen, that class is why.
- `menu-bo2.js` drives the old lobby by clicking its hidden buttons; new weapons, modes and maps appear automatically.
- Perf: real lights recompile every lit shader, double-sided mist and shadowed woods kill fps, and the first view measured reads low.
- Headless tests: launch with `--use-angle=d3d11`. This Chromium rejects `--use-gl=swiftshader` and falls back to software rendering, where a multi-tab match takes about 20 s per screenshot (it looks hung, or runs out of memory).
- Concurrency: other sessions share the main checkout. Commit work in progress early (an autostash once swallowed a session's edits).

---

## 4. Tests and tools

**Running tests**
- Run as `NODE_PATH=<main checkout>/node_modules node tools/<name>.mjs`, one at a time.
- Use GPU flags (`--use-angle=d3d11`) for anything with hold timers or audio: bar, rp, dj, trollingloud.
- `?tohooks=1` exposes `window.__trollOps`, which includes `djLulz`, `music`, `builtMap()`, `move`, `look`, `net`.

**Test-writing traps**
- Teleport with `T.move.pos` (the feet), never `player.pos`.
- `waitForFunction(async…)` resolves at once.
- Wait for `builtMap()` before reading map state.
- Esc doesn't release pointer lock in Playwright.
- troll-accounts.js loads from an absolute live URL, so route it locally.

**Socialize / roleplay**
- `socialize-test` (3 tabs)
- `bar-test`
- `rp-test`
- `dj-test` (2 players, SHOTS=dir)
- `club-crowd-test` (Trolling Loud's crowd). Shots: `MODE=social node tools/troll-ops-trollingloud-shots.mjs [views]`, `VIEW=x,y,z,lx,ly,lz,fov` for a custom camera.

**Maps**
- `trollingloud-test` (SKIP_Z=1)
- `trollingloud-shots` (TIER=low)
- `map-audit` (Pentagrin's 4 unused spawns are a known FAIL)
- `map-walk` (STEP=1)
- `map-shots` (MODE=view)
- `map-fps` (noisy; do 3-5 runs)
- `map-previews` (re-run after any map look change; WAIT=25000)
- `asset-cache-test`
- `room-map-test`

**Bots**
- `bot-stuck-test`
- `bot-moves-test`
- `bot-streaks(2)-test`
- `royale-*` (perf: `royale-fps.mjs 20 100`)

**Combat**
- `streaks-bo2`
- `cuav-cooldown`
- `saber(-mp)`
- `greencandles`
- `shotgun`
- `peacemakers`
- `knuckles`
- `3p-hold`
- `dragonfire`
- `medal-test`
- `emote-test`
- `chat-test`
- `sync-test`
- `view-mode-test`
- `custom-guns-test`
- `guest-progress-test`
- `zombie-test`
- `cop-ingame` (12 officers in a real Trolling Loud match, downed and respawn)
- `cop-body-test` (lab pose sweep: hands on the gun, feet on the floor)

**Known pre-existing failures**
- bot-moves "every kind of throwable" (the Firebomb was removed)
- trollsaber "menu preview lit"
- cuav-cooldown (2 stale checks)
- royale-bots "most picked something up"
- view-mode "W + Space flies"
- the sync Infection step is flaky

**Tools**
- `static-serve.mjs [port]`
- `hero-preview.html`
- `troll-ops-beatgrid.mjs`
- `troll-ops-cop-shots.mjs` (officer pose contact sheets: POSES, YAW, T, CAM, FOCUS, EVAL)
- `troll-ops-grinleria-layout.mjs`

---

## 5. Shipped log (one line each; details are in git)

- **2026-10-08** (weapons batch, -wb1)
  - Sidearms: Sixty-Nine (Five-seveN, rank 0 starter) and TRUE-69 (BO2 KAP-40, auto) replace the M9, Deagle, Chortle and Golden Grin; traced from photos (weapon-pistols.js), slides cycle/lock/release (view/pistol-action.js). Test: troll-ops-pistols-test.mjs.
  - Snipers: BO2's SVU-AS, DSR 50, Ballista, XPR-50 as Snort SVU / Deadpan DSR / Howl Ballista / Smug XPR (weapon-snipers.js); bolts cycle (view/rifle-action.js, audio boltBeat); BO2 full-screen scope (view/sniper-scope.js). Test: troll-ops-snipers-test.mjs.
  - SMGs: BO2's MP7, Vector K10, PDW-57 under their own names (weapon-smgs.js; ids snicker/cope/seethe), irons fold under glass. Test: troll-ops-smgs-test.mjs.
  - Traced guns share weapon-traced.js (side outline from a reference -> extruded body, mag node, irons, attachments).
  - Attachments fit by class, BO2 style (attachments.js CLASS_FIT): no dot on a sniper, no scope on a pistol, no ACOG on short guns; loadout and royale only offer what fits.
- **2026-10-07**
  - Batch (11 asks, branch tf-grinjuku):
    - Bots hit 28/37/55% (recruit/regular/veteran); misses hit the wall behind you (combat/bot-fire.js botMissDistance).
    - Troll Royale: no bus. At 0:00 a wall of the sky box opens and the floor/treadmill carries everyone off the edge; pure freefall (royale-drop.js, modes/royale.js).
    - Cloud save: boot writes no longer stomp another device's loadout/streaks (settled after the first pull, content compare, push missing keys). Still whole-blob, last writer wins.
    - K9 dogs go through doorways (nav.js `blockBy: "centre"`); so do bots (bots.js ground "doors" grid, 0.4 m cells, `snap` 4.4 m; old grid as a second opinion).
    - Bump one citizen: a warning; a second one straight after squares up (social-duel.js BUMP_STREAK). Ike holds his hammer and tongs with arm IK.
    - Seated legs bent on the seat; set a mug down on the bar/tables; pour animation at the taps.
    - Iron Ike works the forge (smithy.js).
    - Playable piano + sheet music (menu/piano-panel.js, piano-sheets.js; rp "pn").
    - Grin Express loop, Socialize only (train.js, modes/social-train.js; movement `riding`).
    - Fist fights with townsfolk: jail, a 1:10 side gun, bleed-out to Doc Grin's (modes/social-duel.js; rp "duel").
    - Socialize is limited to Troll City and Trolling Loud (MODES.social.maps).
    - Trolling Loud's door, phase 1 of CLUB-ENTRY.md (modes/club-entry.js): line of 6-7 NPCs, two lanes, ID card, 18+, guest/owner wristband as a zone fence (trollingloud.js entryZoneOf). Plain poses/UI; phases 2-5 to come.
    - Club entry phase 2, the look: velvet rope Big Lulz unhooks, bouncer acts (ID, band, wave in), wristbands on the right wrist in first and third person (wristwear.js buildWristband, character.js syncWristband, modes/club-wear.js), security's hand up at VIP/staff doors.
    - Club entry phase 3, the kick-out: "No" plays the bouncers carrying you out and tossing you on the curb, every time (view/club-entry-cine.js films it; camera.zoom is its lens), then sat on the curb, 2 min lockout.
    - Club entry phase 4, the room: line tickets keep humans in join order; band/ticket/door phase on the wire (net.js wb, cq, ce); everyone's copy of the door plays your check, band, walk-in or throw-out, your body poses via remote-players.js peerPosers; 25 s AFK at the question (or a hidden tab) with a human waiting = back of the line. Test: tools/troll-ops-club-room-test.mjs. Phase 5 (pad/touch prompts) ON HOLD (user).
    - No more face colours anywhere (user): picker gone, faceMaterial ignores the old tint part (keys keep "og" for compatibility), townsfolk untinted.
    - Trolling Loud guests (Clubgoer/Raver/VIP/Barfly) wear outfits (outfits.js: clothes on the joints, merged into one skinned mesh per material, ~2-3 draw calls a guest); staff stay plain. "No bandanas" sign by the door. Pushed without a full gate at the user's say-so (targeted tests only).
    - Known limits: mugs set down before you joined aren't shown; device clock skew shifts where others see a train rider.
  - Follow-ups (-fu1): rope climbing pose (remote-players.js poseRope); Trolling Loud seats (booths/sofas/armchairs/stools; a seat's optional `reach` works from in front only) and emotes play seated (a duo still stands you up); fire cuts a magazine reload short when rounds are left (`reloadCut` skips the done sound); Infection's infected always get the keyboard sword; Troll Royale loading shot (map-previews `MODE` shoots a map in its own mode); Troll City sign boards stood off their frames (they z-fought); no aim assist while cooking a throwable; dragonfire.js imported under one tag.
  - Grinjuku (Shinjuku at night, after VALORANT's Split): versus + S&D with designed sites A (-22, 15) / B (22, 15), Heavens 3 m up, Sewers/Mail/Vents, 4 ropes (new: walk in to grab, look down to descend, jump off; bots climb them, dogs don't). grinjuku-layout.js is the one source of truth for colliders and build_grinjuku.blender.py (gj-*.glb, 5.3 MB). Tests: map-walk (15 routes), troll-ops-rope-test.mjs (20, in the gate), bot-stairs rope check.
  - Dust Bowl bazaar 5 (redesign done): power wires across the street, laundry to the centre house, rooftop tanks (colliders, unreachable roofs), three smoke plumes in the city (dustbowl-city.js citySmoke, one Points draw), new loading-screen renders (map-load-screen.js SHOT_V: per-map shot tags, dustbowl hq2).
  - Dust Bowl bazaar 4: channel water works: plank crossing at x -17.5 (walk route 15), culvert pipe + three rubble piles as sub-1.5 m cover, pipe run on the south bank (broken at its stairs), culvert outlets in the north bank face (z 20), sluice frame at x 27.
  - Dust Bowl bazaar 3: north loading yard: a 1.5 m dock at (-17, -32.6), the 3rd high spot, with a stair (walk route 14), shutter and hoist; three crate/cart islands in the rock band. Watch S3 (0, -33): the dock sits on the wall-strip line 14-17 m from it.
  - Dust Bowl bazaar 2c: minaret plaza: paving, a 0.3 m plinth (walk route 13), a door at the minaret's foot, two stone benches, lantern strings from the balcony to two poles and the centre roof. Phase 2 done. Paving avoids GS_Stone (it takes the dark rock texture in game).
  - Dust Bowl bazaar 2b: west side carpets + tea under turquoise/blue, east side repair + produce under red/ochre; sagging shop awnings, tarps over the two western alleys (not site B's). Goods that stand on the street are colliders (maps.js, the models' SHOP_GOODS). db-market.glb 0.90 -> 1.23 MB.
- **2026-10-06**
  - Dust Bowl bazaar 2a: carpet-shop roof at (-16, 0) is the 2nd high spot: outside stair up the west wall to a landing, 1.9 m north screen, 0.9 m parapets on the other sides. Walk routes 11-12 cover it.
  - game.js split, phase 1a: touch, gamepad and aim assist moved to input/ (touch.js, gamepad.js, aim-assist.js) by `tools/troll-ops-split.mjs`; modules reach game.js through `game.X` (core/state.js, filled by game.js's linkGame table, never by importing game.js). New gate step: tools/troll-ops-input-test.mjs (fake pad + touch, every control).
  - game.js split, phase 1b: Troll Royale rules moved to modes/royale.js (royale.js next door still holds zone + loot).
  - game.js split, phase 1c: HUD helpers (killfeed, hitmarkers, damage numbers, streak HUD) to core/hud.js, minimap to core/minimap.js.
  - game.js split, phase 1d (phase 1 done): scorestreaks to streaks/ (calling, fire, k9, dragonfire, warship, air, bot-streaks) and the U Mad Bro? hero kit to modes/umb-heroes.js; game.js 16,712 -> 11,793 lines. Gate step 1 now runs tools/troll-ops-linkcheck.mjs (every game.X a module writes needs a setter in linkGame). Already failing before the split, still to fix: streak-holster (streaks off the secondary come back on melee), streak-control (veteran bot streak rate 1.4x vs 2x), cuav-cooldown (gunship cooldown 60 s vs 90, pad wheel pick, max-level readout).
  - game.js split, phase 2a: menu code to menu/ (settings, escape-menu, radio, mode-picker, lobby); game.js 11,793 -> 10,990 lines. New gate step: tools/troll-ops-menu-test.mjs (every lobby panel, a slider/check/select save, heroes, room code).
  - game.js split, phase 2b (phase 2 done): combat to combat/ (weapons, melee, throwables, damage, scoring, killcam-present); game.js 10,990 -> 9,178 lines. Already failing before the split (timing-sensitive, still to fix): shotgun pump/reload checks, saber-deflect right/high aim, trollsaber menu preview lit, soulblazer charm rest/settle + a 404, fx3 swivel/sad-face/veteran XP.
  - Killcam: the replay shows grenades in flight and their blasts (killcam.js records every grenade), and the killer's view scopes in and out with them (ADS on every pose: their gun comes up to the sight, the lens zooms). Gate step 4 runs tools/troll-ops-killcam-test.mjs. Not chased: in the test, a host-simulated bot's throw arm never showed on its track (rp.throwT stayed 0), so the replay's throw-arm pose is only proven for the recorder math.
  - game.js split, phase 3a: modes/infection.js (Infection proper, ~200 lines; the old "Infection" label also covered KOTH, S&D, startGame, the load screen and staging) and modes/objectives.js (KOTH scoring + all of S&D); game.js 9,178 -> 8,540 lines. New gate step: tools/troll-ops-objectives-test.mjs.
  - game.js split, phase 3b: modes/match-end.js (results screen, XP, medals, intermission, map vote) and modes/social.js (Socialize room mode; its initSocial also wires Start/Retry/Resume/range-bot buttons that sat under that label, for menu/ later); game.js 8,540 -> 8,109 lines. Already failing before (same on cfb1c2a): view-mode "W + Space flies forward and up" (climbs ~2.4 m).
  - game.js split, phase 3c (phase 3 done): modes/match-start.js (joinQuickplay, startGame, map loading screen, staging + intro, shader warm-up, beginMatch); game.js 8,109 -> 7,381 lines. Already failing before (same on d36549b): zombie "it crouches, leaps and lands" (timing).
  - game.js split, phase 4a: modes/social-rp.js (saloon bar, seats, piano, doctor); game.js 7,381 -> 6,907 lines.
  - game.js split, phase 4b: view/third-person.js (chase/emote/death cameras, swivel, updateLocalRig); game.js 6,907 -> 6,597 lines. Already failing before (same on c87510e): saber-deflect right/high/blade-moves.
  - game.js split, phase 4c: view/player-update.js (updatePlayer, regen, fly view, candle charge, HUD cache); game.js 6,597 -> 6,212 lines.
  - game.js split, phase 4d (phase 4 done): view/viewmodels.js, weapon-view.js, melee-view.js, streak-view.js, fp-emote.js; game.js 6,212 -> 4,070 lines. Already failing before (same on df14828): shotgun test crash (reading visible), streak-holster secondary x10.
  - Long-standing test failures fixed (57f39d9, 0c2a6f7: stale checks, map-load and wall-clock timing) and the scorestreak HUD icon 404 since phase 1 (core/hud.js resolved streak-icons/ under core/). Still loading twice under mixed tags (caches only, harmless): movement.js, hand-model.js, dragonfire.js.
  - game.js split, phase 5a: input/keyboard-mouse.js (pointer lock, mouse look, key bindings), core/scoreboard.js; game.js 4,070 -> 3,843 lines.
  - game.js split, phase 5b: view/local-emotes.js (emote wheel state, duo emotes); game.js 3,843 -> 3,661 lines.
  - game.js split, phase 5c: modes/spawns.js (spawn scoring, sides, spreading, range bots); game.js 3,661 -> 3,422 lines. bot-stairs test is flaky on main too (different flights fail run to run).
  - game.js split, phase 5d: combat/bot-fire.js (bot targets, shot fx, anti-air, bot damage); game.js 3,422 -> 3,236 lines.
  - game.js split, phase 5e: streaks/hold.js (streak call window, tablet dive, melee holster); game.js 3,236 -> 3,096 lines.
  - game.js split, phase 5f: menu/pause.js (pause open/close, solo vs live-room pause, resume); game.js 3,096 -> 3,032 lines.
  - game.js split, phase 5g: modes/bot-skill.js (room bot skill, veteran XP boost), modes/match-clock.js; game.js 3,032 -> 2,968 lines.
  - game.js split, phase 5h (split done): menu/buttons.js (Start/Retry/Resume/Quit, pointer-lock and tab-hidden pause) out of modes/social.js; game.js 2,970 lines (from 16,712).
  - game.js split, phase 0: `node tools/troll-ops-gate.mjs` (parse, every mode, bot movement, both room tests; ~12 min, `--quick` skips the room tests) is the pre-push gate; `core/state.js` is the home for shared state as systems move out; session rules in CLAUDE.md. Nothing moved yet.
  - Bot host = the oldest LIVE client (net.hostId: a state message in the last 15 s, not flagged slow); a stuck or hidden tab no longer freezes everyone's bots or sets the room's map.

- **2026-10-05**
  - Gloves removed (setting, model, every glove branch); gun-hold rods start further out so more arm shows; the first-person Rolex sits on the left rod (game.js placeRodWatch).
  - Rolex wristwear cosmetic (Cosmetics > Wrist; face key 4th part; wristwear.js) and the Pour up lean emote (emote 17, lean-cup.js; cup, ice, Sprite bottle, pour, swirl, sip; others see it). Also fixed the BO2 menu option screens (Face, Face colour, Hero never opened). Test: tools/troll-ops-lean-test.mjs.
  - BO2 medal art (placeholder until the user's troll versions): medals/<name>.png, swap a file and bump MEDAL_ART_V in medals.js.
  - Dust Bowl bazaar phase 1: a city outside the wall (ring houses, blocks out to ~175 m, mosque, minarets, water towers, poles, palms) and mountains, built at load by dustbowl-city.js (no download, no colliders, no shadows); city-wall towers and sealed gates (db-perimeter.glb renamed db-walls.glb); viewFar 440.
  - Soul Blazer hellfire shotgun (rank 0): Blender model (models/build_soulblazer.blender.py), swinging charms, jaw, flank-skull shell counter, fire FX, port-load relight reload, bespoke admire (soul-blazer.js). Remote relight isn't networked. Test: tools/troll-ops-soulblazer-test.mjs.
  - Trolling Loud Socialize crowd: 119 club NPCs, including bouncers, the door line, bartenders, the go-go and dancers on the beat, VIP booths, the mezzanine, terrace and roof. New `phone` act, the `guard` arms now fold, and the terrace armchairs face their table. Test: tools/troll-ops-club-crowd-test.mjs.
  - Zombies ZR4 part 2: each zombie is one skinned mesh on one atlas (was 4-7). Draws with 12 zombies: Hollowgrin 515 -> 399, Pentagrin ~4300 -> 2377; fps about 2x on Hollowgrin.
  - Zombies ZR4 part 1: head-pop on headshot kills, blood hits ("blood" surface), a glossy blood pool under each body, synthesized groans/snarls/death gurgles per zombie voice (audio.js `_zombieVoice`), throttled horde-wide. Test: tools/troll-ops-zombie-test.mjs (ALL PASS).
  - One map per room: everyone in a versus room follows the host's map (game.js `followsHostMap`, net.js `publishRoomMap`). Test: tools/troll-ops-room-map-test.mjs.
  - DJ Lulz song requests + club lights on each song's beat grid (dj-lulz.js, music-beats.js).
- **2026-10-04**
  - Roleplay 2a: seats, pianist, doctor (rp-roles.js).
  - Saloon bar + bartender + ~27 townsfolk (saloon-bar.js, town-npcs.js).
  - Socialize mode + owner mode switch.
  - Service worker: maps download once.
  - Stuck-bot fixes (crates, nav snapping, stair ends, unstick).
  - Trolling Loud nightclub map.
  - Troll City map + Peacemakers + Knuckle Grinners + bandana.
  - Cops and Robbers phase 0 (officer bodies + mechanics).
- **2026-10-03**
  - One map per room.
  - Prestige phases 1-5 (core, rank icons, combat record, profile card + Barracks, rewards).
  - U Mad Bro? phases 1-2 + Knight body.
  - BO2 stick look.
  - Hitbox lab.
- **About 10-03/04, see git log**
  - Match intro (TDM / S&D).
  - BO2 killcam.
  - Halo Blade.
  - Hollowgrin Halloween versus map.
- **2026-10-02**
  - BO2 Zombies menu over the troll-map planet (shared with the site home).
  - Zombie redesign ZR1-3 (MPFB walker / runner / woman / worker / trollmask / leaper).
  - Hollowgrin 6a-6h: park, U Mad Mansion, Skull Mountain, The Grinder, chapel, mannequins.
  - Realism pass on all maps.
  - Map passes 3-5 (island landmarks, PvP dressing, Grin Beach water).
  - View mode.
  - Grin Beach palms.
  - VTOL mobile fix.
- **2026-10-01**
  - The Grinleria map.
  - Hollowgrin expansion.
  - Bot streaks phases 2-3.
  - Map passes 1-2.
  - Custom guns THE BEAST, Hyuck Colt LMG, Ghost Glass finish.
  - Undergrin expansion.
- **2026-09-30**
  - Fix lists fx1-fx3: Dragonfire, SAM turret, cosmetics, swivel, bot anti-air, controller card.
  - Bot streaks phase 1.
  - 100-troll Royale + crowd LOD.
  - Royale phase C (late join).
  - XP cut.
  - Daily login XP.
- **2026-09-29**
  - Trollface Island Royale map + sky lobby / bus / glider.
  - Chainsaw, Reaper's Grin.
  - K9, VTOL Warship, Swarm, Counter-UAV.
  - HUD layout editor.
  - Games hub trimmed.
- **2026-09-28**
  - Troll Royale phases 1-2.
  - Trollsaber (+ multiplayer).
  - Green Candles redesign.
  - Tactical gloves.
  - Grinmington 870.
  - BO2 medals.
  - HUD cleanup.
  - Trolls vs Jeets.
- **2026-09-27**
  - PF arms / feel.
  - Logout fix.
  - Duo / 1P / 3P emotes.
  - Match chat + profiles.
- **2026-09-26**
  - Vice Grin skin.
  - Hollowgrin map + multi-map zombies.
  - Emote wheel.
  - Two-hand gun hold.
  - "Troll Forces" rename.
- **2026-09-25 and earlier**
  - BO2 streak overhaul (Lightning tablet, care package, Hunter-Killer, gunship).
  - Graphics tiers.
  - Inspect animations.
  - Light pool / lag fix.
  - Touch HUD.
  - Skin editor + "You Have a Problem".
  - Infection.
  - Third-person camera.
  - The 6 PvP maps reworked.
  - Pentagrin zombies.
