# Troll Forces (troll-ops) hand-off

Cleaned 2026-10-12. Older, longer versions: `git show 702f867:assets/games/troll-ops/HANDOFF.md` (before this clean-up) and `git show fd23167:assets/games/troll-ops/HANDOFF.md` (before the 2026-10-05 trim, with every build narration and old tag history).

**House rule for this file:** keep it short.
- Live work gets a section in part 1. When it ships, it becomes one line in the **Shipped log** (part 5) and its section is folded away.
- Keep only what still constrains future work: architecture, rules, gotchas.

Design docs live next to this file: `ROYALE-ISLAND.md` (Trollface Island map pass: phase 1 done, 2-3 next), `COPS-AND-ROBBERS.md`, `TROLL-CITY-RP2.md`, `TROLLS-TRAITS.md`, `CLASSES.md`, `FHJ18.md`, `CLUB-ENTRY.md` (done), `ZOMBIES.md` (the old Pentagrin design; Zombie Rush replaces it), `DESIGN-ARMS.md` and `DESIGN-PF.md` (both done), `REALISM.md`.

---

## 1. Open work and plans (newest first)

### Tasks to do, in order (updated 2026-10-15)
Start each session on a fresh branch or worktree from origin/main.
0. **Button redesign** (doc: claude.ai/code/artifact/155e6ccf-d906-40da-82b6-be82466ddded, decisions in it): five phases, phase 5 the Phantom Forces style in-match public chatbox (T). Then the NFT outline breaks where pieces touch.
1. **Stylised realism follow-ups** (live -sr1; how a map is baked, the lessons: `REALISM.md`):
   - Re-render the map-select previews (`tools/troll-ops-map-previews.mjs <map>` for the 7 baked maps) and bump each one's `SHOT_V` in map-load-screen.js; they still show the old lighting.
   - Bake Trollface Island the same way (placements, `bake_every_model`, ground bake, `BAKED`, hemi/ambient halved, before/after shots).
   - Test reds seen at the -sr1 push, not from it: `view-mode-test` "W + Space flies forward and up" fails on main too (fix it); `remote-body-test` is flaky on main and the branch; `input-test` twice threw "pos.clone is not a function" under machine load (passed 3x alone; no stack caught: rerun with page-error stacks and find the caller).
   - krypto2009 easter eggs: ask the user for his photos first (wish list).
2. **Then hand the user ONE test checklist** (add the BO2 reloads: rifles, SMGs, LMGs, pistols) covering everything shipped since 2026-10-12 (Zombie Rush P1-P7 and the controller buy/deploy, the Kek & Sons merchant and the horses, incl. the hub, Credits and the kiosks, weekly/monthly leaderboards, the High-graphics glow and box fixes, the Royale lag and fights, Show FPS, the phone menu, bot heads, Ghostface Killers).
- **Troll Royale island pass** (`ROYALE-ISLAND.md`): phase 1 shipped (POI loot tiers, the bots' post-kill calm). Next: phase 2 (cover, lake boardwalks), then phase 3 (five new POIs).
- Paused or on hold (sections below): tf-parallel leftovers, Troll City RP 2c, Cops and Robbers, U Mad Bro?, the TROLLS wallet check.

**References (local only, git-ignored, in the MAIN checkout's `assets/games/troll-ops/refs/`):** `zombie-rush/` (the user's Roblox screenshots, named, plus `originals/`), `zombies-clips/clip1.mp4, clip2.mp4` (gameplay recordings), `pf-reloads/BRIEF.md` (the BO2 reload brief).

### Zombie Rush (P1-P7 built)
Zombies rebuilt to play like Roblox's Zombie Rush Survival: a 3D hub, then a co-op 1-4 wave run with cash, upgrades, deployables and bosses, then Credits between runs. Plan: `C:\Users\mayur\.claude\plans\ok-just-switched-buzzing-magpie.md`. P1-P4 shipped (part 5).
- **The hub (P5):** `MODES.zhub` (social + `hub`, hidden, room QZHB, never owner-switched), map `zhub.js` (`HUB`: pads, private pad, kiosks, boards), logic `modes/zombies/hub.js`.
  - Nobody hosts it: each client sends `zP` {pad, s, py} (where it stands) and works out every party itself, first on first. The owner sends `zG` {code, map, m} at 30 s, 4/4 or hold X; members `launch()` = quit button + Zombies start on that code. `scheduleHubReturn` (match-end) brings a run back 8 s after its end screen.
  - Private pad: one party per code (`py`), never walk-in. Invite link `?zhub=ROOM&party=CODE` opens the menu on Zombies and drops the friend on the pad.
  - Boards flip Weekly/Monthly every 8 s (leaderboard-rows.js over the filed rows): best wave, kills summed. Guests aren't filed.
  - Kiosks (X, or the menu's Zombies > Weapons / Classes): view/zombies-kiosk.js, pictures from view/zombies-thumbs.js.
  - After a load with no click (a launch, the return) the player is on the pause screen, as with Socialize's return.
  - Test: `tools/troll-ops-zhub-test.mjs` (private hub code, never QZHB; in the gate's rooms step).
- **Credits (P6):** `modes/zombies/credits.js`, key `trollops:zombies` (cloud-save synced; guests in memory only; troll_runner owns every gun). A run pays 1 a kill + 25 a cleared wave + 200 for the win (match-end, once). Six gun tiers open at best wave 0/5/10/15/20/25, first gun free, others 400-9,000; gun levels 1-10 (+6% dmg, +8% mag, -4% reload; 150 x lv^1.6); Rookie kit levels 1-10 (turret 600 x lv, others 300 x lv; kits.js statsAt). The equipped gun replaces the loadout primary in runs (upgrades.js equipKioskGun). Earn-only. Test: `tools/troll-ops-zcredits-test.mjs` (gate input step).
- **P7 (animation pass):** bite timing, turning, stagger (zombies.js); melee lunge (combat/melee.js LUNGE, zombies only); tier-up flourish (run.js); deploy unfold + turret arming, turret flash + co-op blood (deployables.js); swap raise (combat/weapons.js swapRaise); downed camera (player-update.js); revive ring (view/revive-ring.js); bat/shovel two-handed tracks (gear.js heldTrack / SWINGS, tuned frame by frame); boss cloth tint + glow (zombie-models.js); controller d-pad buy/deploy (view/zombies-hud.js → input/gamepad.js padHooks.zombies). Tests: zanim, zpad, zdeploy, zcoop.
- Refs (local only, main checkout): `refs/zombie-rush/` (hub pads, boards, kiosks, Weapons tier screens, Classes / Rookie kit, the in-match HUD), `refs/zombies-clips/`.

### Weapon animations: Black Ops 2 reloads (live: rifles -ar1; SMGs, LMGs, pistols -br1, main 1641012b)
`view/ar-reload.js`: the nine BO2 rifles, the three SMGs, the three LMGs and the two pistols (keyed by `model.build`, else by id) reload the BO2 way, taken frame by frame from first-person BO2 footage (`refs/pf-reloads/FOOTAGE-NOTES.md`, local: how to watch YouTube in the browser pane and pull frames to canvas, the rifle video's timeline, what each rifle does).
- The other classes' videos (Krystalize; not yet in FOOTAGE-NOTES): SMGs `fgEPhScjUVY` (MP7 0-20 s, PDW-57 20-50, Vector 50-74), LMGs `dEIfIt4caSI` (Mk 48 0-57, QBB 57-92, LSAT 92-133, HAMR 133-170), pistols `uXcvlVRBEQ0` (Five-seven 0-16, KAP-40 76-91). The slow-mo reload is near the end of each gun's stretch. With the browser pane hidden, `computer screenshot` comes back stale: use `zoom` on a region (sometimes twice).
- Each rifle is a spec: `up` (the held pose: where the well sits, which way muzzle and top point, camera space), `fetch`/`present` (where the hand gets and shows the new mag), `rockIn`, and `finish` (the empty reload's pose, handle point and pull, gun-local, and its sound). `build()` makes the tac and empty timelines from it; weapon-view blends the hip pose into the held poses, the mag and the left hand follow their keys (`posePfArms(..., hand)`), `audio.rifleBeat` plays the beats.
- Families from the footage: stood on end at the right (SWAT-556, M27, FAL, Type 25), lower and less rolled (SCAR-H, MTAR), leaning left (M8A1), rolled the other way and worked from the right (AN-94, SMR). Empty finishes: FAL over the top, M27/SWAT/Type 25 catch slap, SCAR-H and M8A1 forward side handle, AN-94 across to the right.
- SMGs: MP7 stood up at the right, mag up into the grip, empty racks the rear T-handle; Vector leans left, empty stands up for the side handle; PDW-57 rolled so its top mag faces the hand (`pullOut`/`under` up, `palm: "top"`), empty racks the front side handle.
- LMGs (ours aren't BO2's, so each wears the nearest): Colt LMG = HAMR (drum shown off, handle over the top), M60 = Mk 48 / LSAT (raised, slap the top cover), RPK = QBB LSW (stood up, worked from the right, drum rocked in). A drum keeps its rest roll (`magRestRotationZ`).
- Pistols: Five-seven muzzle up-right, KAP-40 up-left; the empty reload ends on the hand racking the slide, and the slide drops then (`arSlideAt` -> pistol-action's `releaseAt`), no rifle beat.
- The hand palms the mag's base so the TROLLS body's block fist never hides it. A cut reload (fire) eases back over 0.14 s. Carbines, THE BEAST, the 416, snipers, shotguns and the battle rifles keep the old reload.
- Tune with a frozen-frame lab (set `reloadT` via a getter, screenshot both bodies; hide the `?tohooks` debug panel, it covers the gun). A gun whose mag seats deep in the grip (the MP7) needs its `well` further left, or the stood-up body swings off screen. Test: `tools/troll-ops-arreload-test.mjs` (gate input step; all 17 guns).
- Not yet: checked by eye in a real match (headless frames only). On the TROLLS body the block arm holding a pistol's grip covers the bottom of the gun and the incoming mag (the left fist itself never does).

### TROLLS NFT looks (`TROLLS-TRAITS.md`)
Live blocky bodies: #1718 and #989 (troll_runner), #33 (bradz_), #820 (guccibeardd), #1262 (big_elva001), #2630 (karlezetroll), #2631 (lacksss).
- Next: outline breaks where pieces touch. #33's holder when the user names one. When the troll dev signs up, move #989's holder (cosmetics.js BODIES) to his account. The head is a skull now (build_blocky_head BACK 0.19): anything new behind it (a hat's back, hair, a back card) sits past RELIEF.back / CAP.back.
- #989's face lesson: the user wants the CLASSIC trollface (outline, jaw, cheek folds, chin lines) with only the expression changed (traits/src/face-gum.svg masks the trollface's features and clips the new ones from the user's drawing). Don't hand-draw faces or paste a whole outside drawing.
- Later: **the wallet check** (phase 3: `ownerOf` on the contract) to replace the stopgap lock to the troll_runner account (cosmetics.js `BODIES` `owner`, `canWearBody`). Honest-client like everything else: `bk` on the wire is drawn only with `ow`.
- Code: blocky-body.js (`wearBlocky`, `ownBody`, `applyBlocky`), character.js `reshapeRig` and the opt-in `rig.gunHold` / `rig.rigidTorso`, traits.js. Pieces: models/build_blocky_*.blender.py -> models/blocky/*.glb (hero_kit.py). Art: traits/src/*.svg, baked by tools/troll-ops-bake-traits.mjs.
- Check: tools/trait-preview.html, tools/troll-ops-blocky-ingame.mjs.
- Gotchas: a preview must MOVE the rig (`_footLock` pins planted feet). The body is ~30 cm shorter than the stick and its hitboxes follow it.
- Open (not asked for yet): the moustache is a flat card, the arms are long for blocky proportions, the right arm partly blocks the over-the-shoulder view.

### tf-parallel batch (branch `worktree-tf-parallel`, worktree `.claude/worktrees/tf-parallel`)
Plan: `C:\Users\mayur\.claude\plans\keen-twirling-chipmunk.md`. Phases 1, 2, 6, 7 are on main.
- **On that branch, NOT on main (user 2026-10-10: later):** the Troll City band, RP 2c (merchant + horses), the kitchen, arm wrestling, Grin Beach 5a (unwired WIP, cc9919e). The branch's own HANDOFF has their notes. Merge main into it before pushing any of it.
- **Grin Beach is on hold** (user 2026-10-10). The C-130 drop-in came off hold 2026-10-14 and was ported to main's code on branch `tf-royale-map`.

### Troll City roleplay 2b-2d (Socialize, Troll City only): IN PROGRESS
Design: **`TROLL-CITY-RP2.md`**. Done: 0 groundwork, 2d conductor, 2b sheriff. Next: 2c merchant + rideable horses (~8 sessions; partly built on tf-parallel). Each phase ships alone: targeted test, push.
- **Not yet checked by eye:** 2a's seated bodies and the pianist's hands.
- The 2a pattern:
  - Jobs and their wire letters go in `rp-roles.js` (`ROLES`, `rr`); spots and furniture in `trollcity.js` (`rp.*`).
  - The logic goes in its own module under `modes/` (like `modes/social-rp.js`); game.js only gets hooks.
  - One player per job, first come first served; on a tie the older peer keeps it.
  - A role-gated `rp` message is only honoured from a peer holding that role, like `cure`.
  - The NPC who normally holds that job hides via `TownNpcs.setYield`.
  - Test template: `tools/troll-ops-rp-test.mjs`.

### Cops and Robbers (co-op heist, Trolling Loud only): PAUSED, resume at phase 1
- Plan APPROVED: `COPS-AND-ROBBERS.md` (phases and hook sites). User-facing doc v3.1: https://claude.ai/artifact/D1n9QkSTibBhGSik7hx1mW
- Phase 0 is done (officer bodies: `cop-bodies.js`, `cop-lab.html`, `models/build_cops.blender.py`, `cop-*.glb`; aim, run, crouch-walk, downed; 12 officers cost ~2% frame time over 12 stick figures).
- **Phase 1, the solo heist, in order:** `modes.js` entry + `?heist=1` reveal; `heist-core.js` + Node test; `heistLayout()` in `trollingloud.js`; `BotManager.spawn` / `remove`; game.js hooks; `heist.js` director; `heist-hud.js`; drill, bags, van, end screens. About 11 sessions left (phase 0 ran ~3x its estimate).
- Police are the plain human officer. Officer Grin (`cop-grin.glb`) is a player cosmetic, never an enemy. Bouncers there are AI enemies, separate from the Socialize NPCs.
- The body: `syncCopBody(rig, rp.bodyPose)` after posing (gait, lower, mps, moving, forward, strafe, ads, reload, death); bots wear it via `bot.body = "patrol"` (wire `bd`); officers fall onto their back, the rifle drops (`cop.drop`) and returns on respawn. character.js is untouched; never "fix" the rig for trolls.
- Rig quirks it works around: the stick rig leans BACK 7-10° in a run and crouch (`rigBack` cancels it); the rig turns neck and head AGAINST the aim pitch (`syncCopBody` flips it for real heads).

### U Mad Bro? (funny FFA mode, Prestige 2): ON HOLD until the user says go
- Done: phase 1 (mode + funny layer), phase 2 (hero kits), the Knight body.
- Order when resumed: Hunter (+ Doge); Super Troll; Metamorph (both forms); Trollernaut pointstreak (1,500 pts / 40 s: 10 s invincible, then 3x HP at 0.75x speed, diamond gauntlet on the RIGHT hand whose punches launch people); funny weapons; Horde (co-op, Hollowgrin).
- Heads: Hunter ram-skull helm; Metamorph half Pepe, half chrome; Super Troll classic head + cape collar; Trollernaut oversized and glossy. Bot heroes get HP and speed only.
- Stand-in melee: Knight keyboard x1.3, Hunter reaper, Super Troll saber, Metamorph halo, Brute x2.
- Known gaps: `hr` doesn't render for heroes without a GLB; FFA modes still show the team score bar; never tested with two real players.
- Weapon pitches (none approved): RGB Keyboard Greatsword, Rubber Chicken, Ban Hammer (fake BANNED screen), Copium Launcher, Ratio Rifle, Doge Cannon, Dial-Up Shotgun, Trollface Boomerang, Diamond Gauntlet, the user's Reverse Uno card (reflects for a short window).
- Design doc: https://claude.ai/code/artifact/d5986295-491c-476a-b5b1-7313909a6ee2. Hero refs `refs/*-ref.jpg` (local only).

### Dust Bowl (bazaar redesign done 2026-10-07)
- Watch spawn S3 (0, -33) in playtests: the loading dock sits on the wall-strip sightline 14-17 m from it. A crate stack would fix it but closes that line.
- Any later edit keeps: bounds, spawns and the perimeter collider; nothing solid within 3 m of the S&D sites A (14.48, -18.21) and B (14.37, 14.24); all 15 walk routes passing; the five 45 m+ east-west lines in the north half open (z -34.3 to -33, -29.3, -26.7, -18.8 to -15.5, -15 to -12); fps checked with tools/troll-ops-map-fps.mjs against a worktree of main. Every solid piece is a collider in maps.js plus the matching mesh in models/build_dustbowl.blender.py, from the same numbers.

### Wish list (the user's ideas; not scheduled)
- **The troll coin economy (2026-10-12, keep in mind):**
  - Everything stays free to play.
  - Boosts and perks are bought with the user's own troll-paired coin (made later), the way Roblox zombies games sell them for Robux (Zombie Rush's "+50%" boosts are the model).
  - Ways to earn the coin back: weekly leaderboards such as most time spent playing or most team deathmatches won.
  - The constant circulation encourages spending, hopefully raises the coin's liquidity, and players are rewarded through the coin.
  - Notes from Claude: keep boosts to Zombies (PvE) or cosmetics, never PvP stats. Before a prize has real value, pay out only for public matches with results checked by the server (the netcode trusts clients, and bots play). Have a lawyer look at the "dividends" framing and at minors playing. Zombies Credits stay earn-only until then. Needs a design doc and the user's go.
- **Rolling animations (2026-10-12):** a combat / dive roll for the stick troll, in first and third person.
- **Tablet streak animation:** the right hand presses confirm. The tablet never says "boarding" or "onboarding".
- **Animated weapon skins** with effects coming off them.
- **krypto2009 easter eggs (2026-10-13, keep in mind):** krypto2009 (the user's friend on X) plasters real trollface graffiti and stickers on walls worldwide (Buenos Aires, New York; a red-white-blue spray piece signed "KRYPTO2009"). Hide tributes in the maps: his trollface pieces on walls, sticker-bombed poles, a signed piece somewhere worth finding. Best slot: the stylised-realism wear pass (P4 graffiti on Cul-de-Grin, then each map's rollout). Build from his real pieces (ask the user for the photos, keep them in `refs/`, local only), the real trollface art only, credited.
- **Troll City town hall computers: BUILT 2026-10-20** (branch claude/tf-trollcity-redesign-866e7e, lands with the Troll City redesign): three Studio-made "Troll-o-Graph" terminals in the clerk's office (maps/trollcity-hall.js COMPUTERS, modes/social-computers.js, test tools/troll-ops-computers-test.mjs). Hold X (the phone's swap button), Socialize only. trolltruths.com is framed in the game (troll-ops.html CSP frame-src); opensea.io/collection/trollsoneth and trollface.io refuse framing (X-Frame-Options DENY), so they open in a new tab from a click.
- **Troll City donation kiosk: BUILT 2026-10-20** (same branch): a Studio-made kiosk in the town hall's front hall (COMPUTERS key "donate"); hold X, then a click opens https://finance.trollrunner.net (the home page's Donate wallet) in a new tab. No wallet or payment handling in the game.
- **Crypto at Ramirez Bank (2026-10-20, keep in mind):** support the $TROLL-paired tokens ($TROLLIONS, $TRUTHS) at Troll City's bank (Banker Bux). Safe first step: read-only live price boards from public feeds (e.g. DexScreener), a "trade on Jupiter" terminal that opens in a new tab, and optionally a wallet connect that shows holdings (the site's wallet layer). No in-game money movement until the coin-economy notes above are settled (legal, minors, client-trusted netcode). Needs a design doc.
- **"For You" emote:** only while falling in Royale. The troll reaches out a hand romantically, with face, hand, body and background shots.

### Backlog (needs a design doc / the user's go first)
- **Audio + dialogue pass:** BO2 cadence (streak callouts, match flow, objectives, medals, chatter, Royale lines) in a troll voice, original wording. The doc decides TTS vs recorded, audio.js hooks, a voice setting, a chatter rate limit for 100 players.
- **Flamethrower:** a "VERY unique design" with its own silhouette like Green Candles. Steps: a doc pitching 2-3 concepts, a Blender glb, a tank-swap reload, fire stream and burn FX.
- **Halloween skin for the Problem 416:** pumpkins, reaper, bone, violet and orange.
- **Troll-NFT weapon skins** (wallets: ask first). First candidate: TROLLS #1718 "Tank Runner" (`assets/images/skin-art/trolls-1718-tank-runner.jpg`). Skins in general are on hold.
- **Royale:** duos/squads and Troll Court (needs N teams; only phantom/ghost exist); landmark art (ask before Blender work on landmarks); loot race (two players can take one item in a latency window); looted grenades.
- **Waiting on the user:** rename lists for usernames and weapons (display names only; ids stay); custom crosshair options; more radio mp3s (add to `music.js` TRACKS, then `node tools/troll-ops-beatgrid.mjs`).
- **On hold:** Grinleria leftovers, more cosmetic slots, Royale landmark art.
- **Cancelled 2026-10-03:** Purge XP; $TRUTHS tournaments; the whole 2026-09-30 open-asks list.

### Small known gaps (fix if touched)
- **Royale length:** the post-kill calm (30-45 s, 2026-10-14) stretched the end (last two alive past 345 s, was ~240 s), but the middle still thins fast: ~10 left at ~220 s while the zone runs ~9.5 min (troll-ops-royale-pace). The next dial is early-phase bot sight (ROYALE_BOT_SIGHT); ask before changing it.
- **Bots:** Hollowgrin's west edge (chapel, witch's hollow, creek) still only gets ~1% of bot time, and on Grin Beach only ~1/3 of bots ever go up (bot-floors wants 40%: 19/60 before main was merged in, 21/60 after; the `POST_*` dials); Undergrin's bot-stuck check is red on main and passes with -fl1; don't shoot down the VTOL Warship or Swarm drones; ignore an enemy UAV beyond the minimap. K9 dogs walk the ground flow field only, and nobody but you calls them.
- **Killcam** doesn't record swivels.
- **Zombies:** mid-round shader compiles (warm those materials in warmShaders). Each zombie is one atlas mesh: a new part needs an atlas cell, not its own material (build_zombies.blender.py `atlas_merge`; the tint only touches u < 0.5). A popped head is `bones.head` scaled to 0.001, re-applied after every mixer update. Any new gore material must join `goreStandIns()`.
- **Hollowgrin:** the chapel bell doesn't swing and the rides are silent.
- **Grinleria:** static escalators, no zombies layout.
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
- No phase videos (user 2026-10-08: "I dont need videos"): tests, push; screenshots for self-checks only.
- No gate (user 2026-10-14: "no gate going forward"): targeted tests per change (running several at once is fine), then push on the user's say. tools/troll-ops-gate.mjs stays in the repo, unused.

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
- Pad is Black Ops 2's Xbox 360 default (user 2026-10-14): X reload / hold use, Y swap, LB tactical, RB lethal, L3 sprint, R3 melee, d-pad right streak, up/down scroll streaks, left tap inspect / hold emotes. Desktop: H = emotes, T = inspect.
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
  - royale.js: zone, loot, seeded rng; royale-drop.js: the drop clock and Flight; royale-planes.js: the squadron; royale-hold.js: the C-130 hold (PLANES.md)
  - Aboard, riders are placed every frame (remote-players.js crowd LOD skips frames otherwise; the plane does 40 m/s)
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
- Run as `NODE_PATH=<main checkout>/node_modules node tools/<name>.mjs`.
- Use GPU flags (`--use-angle=d3d11`) for anything with hold timers or audio: bar, rp, dj, trollingloud.
- `?tohooks=1` exposes `window.__trollOps`, which includes `djLulz`, `music`, `builtMap()`, `move`, `look`, `net`.
- Refactoring a map: `troll-ops-map-fingerprint.mjs <map> --out f` before, `--against f` after; IDENTICAL means every mesh, light, collider, seat and zombie spawn is unchanged.

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
- `bot-floors-test` (headless 5v5 bot TDM per map: time off the ground floor, per district, Hollowgrin by name, kills, sim cost; `--report`, `ROOT_DIR=` another checkout for before/after)
- `bot-stairs-test`
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
- Flaky, pass alone: input-test "look pad turns", killcam-test (slow load), throw-test's two-tab `ck` checks, club-entry-test "both bouncers carry you", trollingloud-test "zombies reach a player on the ground (bar)" (~1 run in 3, main too), bot-head-test (runs close to its 0.28 limit)

**Tools**
- `static-serve.mjs [port]`
- `hero-preview.html`
- `troll-ops-beatgrid.mjs`
- `troll-ops-cop-shots.mjs` (officer pose contact sheets: POSES, YAW, T, CAM, FOCUS, EVAL)
- `troll-ops-grinleria-layout.mjs`
- `troll-ops-trace.mjs` + `troll-ops-gun-compare.mjs` (trace a gun off a side-on reference, check the spec against it)
- `troll-ops-cache-cascade.mjs --suffix <tag> --base origin/main` (the ?v= cascade; reports modules imported under two tags; `--unify` after merges)
- `troll-ops-royale-perf.mjs` (Royale frame cost by stage, one piece switched off at a time; AUDIT=1 lists mesh groups), `troll-ops-royale-pace.mjs [s]` (who is left, kills, time-to-kill)
- `troll-ops-text-scan.mjs` (shared measured no-overlap scan for UI tests)

---

## 5. Shipped log (newest first; one line each, details in git)
- **2026-10-20** (-tcs1) Troll City redesigned in Roblox Studio (doc "Troll City redesign in Roblox Studio"; models/tc-town.glb + maps/trollcity-layout.js, exported by tools/troll-ops-map-from-studio.mjs): twice as long and wide, the town square at the centre, St. Grinsworth's chapel (maps/trollcity-chapel.js), the town hall closing Main Street (maps/trollcity-hall.js: courtroom, four cells, council chamber, sheriff's office), six east shops (maps/trollcity-east.js), ~60 Studio-generated props, the Troll-o-Graph computers + donation kiosk (modes/social-computers.js). K9 grids count only what a dog meets (K9.head 1.2 m): a 2.4 m lintel had sealed the saloon back room. Tests: trollcity-contract (--moved), computers, rp, socialize, sheriff, shop, duel, bar, band, conductor, train, train-board, horse, smith, arm-wrestle, saloon-sound, bot-stuck, k9-doors, zcoop. Left: phase 3 (spawns/ZSPAWNS for the bigger town, bot routes, phone fps; GLB is 17.5 MB).
- **2026-10-20** (-su1) Socialize is weapon-free for everyone, troll_runner included (user): no gun, melee or throwable comes out (game.js socialUnarmed() is just isSocial(); handsFull/HAND_JOBS gone from modes/social-rp.js). Test: socialize (menu-order check now allows the Server Browser row), bar.
- **2026-10-19** (-tw1) Troll Forces is now Troll Warfare in every name players see (titles, menu brand, logo, home/arcade tiles, share card, chat, leaderboard, home-screen app name); comments, paths, storage keys and Supabase tables keep the old name. Tests: menu, exit-links, public-chat, online, linkcheck (chat-test profile-click FAILs already on main).
- **2026-10-18** (-rf1) Third-person camera finds room (view/third-person.js): with a wall right behind you it tries the other shoulder, then higher; with empty hands (the Royale plane, Socialize) it can swing round beside or in front of you and look at you, so your body stays in frame instead of the camera ending up inside it (user: "users should be able to see themselves"). Test: drop-cine (third person walking to and in your seat), 3p-hold, free-look.
- **2026-10-18** (-rf1) Royale drop fixes from a playthrough (royale-cine.js, royale-crew.js, royale.js, royale-fall.js; view/player-update.js, view/third-person.js): T-36 the game walks you to your seat from wherever you are (round the pallet) and sits you; the photo/music card only once seated (T-29.6); the scene is first person even with third person on (your body walks and sits in third person before it); at the green the jumpmaster steps in and shoves you out backwards (no key); the fall shots are framed on your face and body (exit long lens, over your face, close below as you roll); the GO subtitle and bars clear when you leave the plane. Test: drop-cine (+ royale-drop, royale-mp, 3p-hold, free-look; view-mode and socialize fail one check each on main too).
- **2026-10-18** (-ph1) Royale drop photo is the user's trollface pin-up art (modes/royale-photo.js, textures/royale-photo.jpg, 720 px, 62 KB) in place of the drawn family print. Test: drop-cine.
- **2026-10-18** (-wf1) Trollface Island: no more flicker on the lake and the plazas (maps/trollface-island.js): the lake and the 4 plazas are holes in the island top, so their floors no longer z-fight the grass 12-25 mm under them (striped from the plane). Test: royale-island; before/after shots from 330 m.
- **2026-10-18** (-bc1) Troll Royale bots hop and slide a fifth as often (bots.js rules.calm, set by match-start.js): a hundred bots in fights rolling every 0.5 s read as heads bobbing nonstop. Test: roomsync, royale-island.
- **2026-10-18** (-rp2) A crowd's far trolls move smoothly and stop blinking (net/remote-players.js): on a skipped LOD frame they still slide to the snapshot position (glide), so they no longer jump at 15-20 Hz; the far hide is 200 m (was 150) with a 12 m band so one on the line doesn't pop in and out. Test: sync, load-sync, royale-mp.
- **2026-10-18** (-wf2) Trollface Island's lake looks like water (maps/lake-water.js, new): sand bed through see-through shallows, turquoise to deep blue by a baked distance-to-shore texture, a foam line washing at the edge, a moving chop; the waterfall streaks pour down. Test: royale-island; shots from 120 m, the shore, on the water.
- **2026-10-18** (-tc1) Third-person camera swings round you only aboard the Royale plane (view/third-person.js royaleAboard): elsewhere with empty hands it made the view spin as you turned; it stays behind you, free look (Alt) still shows your face. Test: drop-cine, 3p-hold, free-look.
- **2026-10-18** (-tc2) Third person in the Royale plane stays inside the hold (view/third-person.js holdRoom): 2.1 m back, kept to a box inside the hull (its curve isn't a collider), no swing-round spots anywhere; sat against the wall it goes once across the aisle to face you. Test: drop-cine, 3p-hold, free-look; probe of camera vs hold while walking.
- **2026-10-18** (-ls1, -rp3) Royale bots after the drop: upright and on the ground (characters/character.js landing spring stepped at <= 1/60 s: posed 0.1 s at a time it ran away, sinking far bots kilometres; net/remote-players.js poseDrop clears the half roll the fall show leaves, z = PI, which had half the bots standing on their heads in the ground). Test: royale-drop, remote-body, drop-cine, sync; probe of 99 landed bots over 33 s: 0 sunk, 0 near flicker.
- **2026-10-18** (-rr1) The C-130 ramp slides back in under the floor after it opens (royale-planes.js retractAt -2.7, rampPose; royale-hold.js setRamp/dropRampFloor): the hold ends at the hinge over open air, and the drop cinematic looks straight down through it (royale-cine.js lookDown) before the turn. Test: drop-cine (new look-down check), royale-drop, royale-mp.
- **2026-10-18** (-op1) Drop opener: the photo is an instant print showing the whole picture, matte and darker (royale-photo.js); the card is X photo / Y music, with pad face buttons, keycaps or plain tap tiles by device and the song row only for music (royale-cine.js, style.css). Test: drop-cine (X/Y checks).
- **2026-10-18** (-bz1) The pre-match countdown is a military buzzer, not a tick (sound/audio.js stageTick: low rasp each second, two sharp pulses for the last 3, a long buzz at GO from match-start.js). Test: roomsync.
- **2026-10-18** (-ld1) The look down out of the C-130 sees the island (royale-planes.js: the run slows 40 -> 26 m/s, runDist; each plane runs f.lead s ahead of the drop clock so it is ~110 m over land at T-2.6 but keeps >= 7 s over land after the green; ramp at -6, slid in by -2.8; royale-cine.js lookDown -3.4..-1.75 with a 0.62 m lean past the edge, dropCineLean in royale.js placeAboardView). Test: drop-cine, royale-drop (exit speed now > 16), royale-mp, royale-island; probe: 99/99 bots land on the island.
- **2026-10-18** (-an1) No grenades inside the C-130 (throwables.js startCook/releaseCook check royaleAboard; guns + melee already did). Test: .claude/run/aboard-arms.mjs.
- **2026-10-18** (-zf1) Trollface Island ground flicker: the lake hole crossed the coast at the river mouth and broke the top's triangulation (~9000 m2 of grass drawn twice, some over the U Mad Bro Shop paving); LAKE_HOLE stops 0.4 m inside the coast. Ground + paving get polygonOffset (SINK) so floors resting on them always win. Probes: .claude/run/zf/.
- **2026-10-18** (-rt1) Optic reticles (reflex/Coyote dot, ACOG chevron, 8x crosshair) draw over everything, so they showed on the outside of the scope; now hidden (attachment-models.js sightMark) and shown only in first person once aimed (weapon-view.js fadeOpticGlass). Probe: .claude/run/scope/probe.mjs.
- **2026-10-18** (-ld2/-ld3) A long look down at the whole island: the drop cinematic runs 6 s earlier (CINE + CREW + subtitles; red light T-21), the ramp opens T-9.2 and slides in by T-6, look down T-6..T-1.75 (pitch ~-1.5, lean 0.9 m). Run slowed to 20 m/s, LOOK_IN 150 m at LOOK_AT 3.9 s, LAND_LEFT 6: all 12 planes over land for the whole look, 99/99 bots still land on the island. drop-cine + royale-drop tests retimed.
- **2026-10-18** (-na1) Nothing equips in the C-130 either (user): setHolding refuses gun/melee aboard; switchWeapon, cycleWeapon, tryReload and ADS are off aboard (the cinematic used to let 1/2/3 bring a gun up). Probe: .claude/run/noarms.mjs.
- **2026-10-18** (-na2) Aboard, a gun/blade asked for leaves the hands empty instead of being refused: the mask streak hold ending used to leave you holding "streak".
- **2026-10-18** (-fs1) Phones: Android/iPad go fullscreen (landscape) on the first tap; iPhone Safari can't (pages can't hide its bars), so a one-time tip: Hide Toolbar from the address bar, or Add to Home Screen (troll-forces.webmanifest, display fullscreen + apple-mobile-web-app tags) for no bars at all. input/fullscreen.js; probe .claude/run/pwa.mjs.
- **2026-10-18** (-bp1) Troll Royale bots: one set skill (rules.skill = regular, the Bot skill setting ignored; no veteran XP); zone ~14 min (waits 200/140/100/70/40); pace director in royale.js (bot-on-bot damage from 25% x (alive/target)^6 toward a curve ~70@3 min, 45@6, 22@9, 8@11), applied in botDealDamage. Measured: 35 left at 5.6 min (was 20 at 5:14; target ~47) — still ahead of the curve, tuning continues. Probes .claude/run/pacek*.mjs.
- **2026-10-18** (-bp1) Drop cinematic: look-down turns the head so the island is north-up and zooms 1.75x (camera.zoom, royale.js placeAboardView; lean 1.3 m); opener card redone Detroit-style (word + key in bracket frames, timer line; PS pads get square/triangle; tap the key on touch). Plane touch HUD trimmed (body.to-aboard).
- **2026-10-19** (-kp1) Troll Royale pace director deals in kills, not damage (royale.js royaleBotHit, royalePaceTick; bot-fire.js botDealDamage): bot-on-bot damage near full (75-100% by phase), kill credits come in along the curve (faster when behind it, cap 2), a lethal bot-on-bot hit with no credit leaves the loser on 6 hp; it breaks off ~25 m and heals (royaleBotFlee, also any bot under 40 hp with no armour still being shot), the winner is calm 20 s. Measured: 69 left @3:14 (target 68), 51 @5:14 (49), 42 @6:14 (42). Test: royale-pace.
- **2026-10-19** (-bl1) Troll Royale bots loot like players (royale.js royaleBotLoot/royaleBotObjective): they search the circle they are in until it is time to rotate (wait left < 15 s + walk time), not only the next circle, so they no longer all walk into it and pile up; search 60 m on the pistol, 40 m hurt or out of plates, 20 m otherwise; loot with other bots by it costs 12 m a bot (10 m grid); a hurt bot runs up to 40 m for a heal. Armed bots 22 -> 87 of 95 by 0:40, nearest-bot median 6-7 -> 10-11 m, curve unchanged (60 left @4:11, target 61). Test: royale-pace.
- **2026-10-19** (-rg1) Troll Royale bots regenerate like you (royale.js updateRoyaleBot: 12 hp/s after 4.5 s unhit, player-update.js regenPlayer values): with ~22 heals on the island nearly every bot spent the match under 40 hp. Under-40 bots 60-70 -> 4-17; full run with -kp1/-bl1: 91 @1:00, 69 @3:14, 50 @5:14, 35 @7:14, 20 @9:14, 8 @11:14, last bot @12:58 (target within 1 throughout); bot fight first-wound-to-death median ~18 s / 9 hits. Test: royale-pace 900.
- **2026-10-19** (-tb1) Third person never turns round to show your face (view/third-person.js): the Royale plane's across-the-aisle shot (-tc2) is gone; sat or walking with no room behind you aboard, it's first person until there's room again (user: remove the "see your face" camera). Shoulder swap and free look (Alt) stay. Test: drop-cine, 3p-hold, free-look.
- **2026-10-19** No page zoom on phones (troll-ops.html loads assets/js/no-zoom.js): double tap or a pinch zoomed the whole page and left the HUD out of place mid-match (user, in Troll Royale). Viewport lock, touch-action pan-x pan-y on the page, Safari gesture events cancelled; the touch controls still get every touch. Test: bo2pad.
- **2026-10-19** (-ut1) Every module on one ?v= tag again: character.js, weapon-model.js, social-rp.js, cop-bodies.js and club-entry.js were each imported under two tags (loaded twice, split state), now the newest tag + -ut1 everywhere incl. labs; cascade to troll-ops.html. Test: import-check ALL PASS, --load (only nft-lab fails, a missing untracked ref png).
- **2026-10-19** (-is1) Royale island in Studio, phase 1a: Trollface Island's 424 colliders are data (maps/trollface-island-colliders.js ISLAND_SOLIDS, named by landmark), which the map lays in place of its code (the code still lays them for tools/troll-ops-island-colliders.mjs, which writes the file with --write and checks a match within 1 cm without). A JS module, not the doc's .json, so it rides the ?v= tags. Test: island-colliders, royale-island, royale-drop, royale-mp.
- **2026-10-19** (-is1) Royale island in Studio, phase 1b, the round trip (studio/trollface-island/): tools/troll-ops-island-to-studio.mjs writes island.json (coast, lake, ground paint per 2 m cell from groundMask, colliders, POIs, spawns, deck loot); build-island.luau lays it in the Studio place (terrain at y 0, Colliders parts with i/n/pen, locked Markers, 1 m = 3 studs; serve the checkout on 5193 and loadstring it over the MCP); from-studio.luau posts the Colliders to tools/troll-ops-island-from-studio.mjs (5296), which checks or --writes the colliders file. No-edit trip: 424 back, all within 1 cm. tools/troll-ops-island-contract-test.mjs checks the Contracts table against contract.json (frame rate by hand). Ground and model export come with phases 3 and 5. Test: island-contract, island-colliders, from-studio round trip.
- **2026-10-19** (-gf1) Royale island in Studio, phase 2, ground height (new core/ground-field.js: a map's `groundField` heightfield, floorAt bilinear, terrainHit ray march; set by maps.js settleMap at each load, which also stands the spawns, out of game.js): movement.js groundHeightAt starts at the ground, not y 0; bullets, raycastWorld and segmentBlocked stop at it; nav.js measures a box on a hill from the ground under it; royale.js royaleGround reads it. No map has a field yet (Trollface Island's comes with phase 3), so every map plays as before. Test: ground-field (test hill: walk over, fall on, loot, landing, bot on the slope, grid route, shots blocked), royale-bots, royale-island, island-contract, bot-floors, bot-stairs, snipers, rope.
- **2026-10-19** (-tg1) Royale island in Studio, phase 3, terrain: tools/troll-ops-island-sculpt.mjs writes sculpt.json (`keep` 0 on and round the coast (8 m), lake, paths, 0.8 of each POI ring, every collider (+1.5 m), spawns; a starter meadow sculpt, up to 3.4 m, 1.2 m per 2 m at most); studio/trollface-island/sculpt.luau lays it in the Studio terrain (painted top two voxels deep); from-studio.luau now also sends the terrain (heights blended from 4 voxel columns, paint per 2 m cell) and tools/troll-ops-island-from-studio.mjs --write holds keep-0 points at 0, refuses over 1.5 m per 2 m, and writes maps/trollface-island-ground.js (Int16 cm base64 + repaint overrides). The map: TROLLFACE_ISLAND.groundField, a hills mesh over the slab, kit pieces and instanced clutter stood on the ground. Contract test adds slope, flat POI floors, flat under colliders, low shore, flat spawns. Test: island-contract, ground-field, royale-island, royale-bots, royale-drop; hill shots.
- **2026-10-20** (-arw1) Arrow keys walk like WASD (view/player-update.js, input/keyboard-mouse.js): Up/Down/Left/Right feed the same move input, so foot, view-mode flying, seats and everything else on ix/iz; Left/Right double-tap swivels like A/D. Royale spectate already cycled on Left/Right; the drop-cine music card keeps the arrows for track picking while it's up. Tests: arrow-keys, arrow-rides (arrow-only swivel, Dragonfire, Troll City horse, Royale freefall).
- **2026-10-17** (-dc4) Sound clips, drop cinematic phase 4 (new sound/sfx-files.js + sfx/*.mp3, 404 KB, sources in sfx/SOURCES.md; royale-cine.js, royale.js, royale-fall.js, streaks/nuke.js, sw.js): the first loaded sounds, 14 Pixabay clips decoded into the game's AudioContext (same master volume and mute); each slot keeps its synth sound until its clip is in. Drop: mask hiss, breathing (the fog breaths moved to T-13.1/-11.43/-9.5 to match), strap, belt, steps, ramp latch, wind in with the ramp, exit gust, fall wind loop (louder and higher with speed), cut whooshes. Nuke: looped alarm, missile, blast, beeps. mp3 not ogg (iPhone Safari). Test: drop-cine, nuke (+ royale-drop, load-sync, asset-cache: its tagged-scripts check fails on main too).
- **2026-10-17** (-dc3) Royale drop cinematic phase 3, the fall (new modes/royale-fall.js; poseDrop in net/remote-players.js, royale.js, royale-drop.js, view/player-update.js, view/third-person.js): 6 s show off the ramp, no steering (the look stays free to aim). Out backwards: a first-person backward flip onto your back, cut to a camera left where you went out (long lens), beside you, below you as you roll belly-down and turn flat, then the usual camera behind. Out forwards: a head-first tip. The show's fall builds speed slowly (Flight coast) so it costs ~130 m, not ~230. Crouch held (C, Ctrl, touch, pad) cycles side/low/wide every 1.5 s down to 80 m. Others see the flip (back/forward read off their motion vs facing). Test: drop-cine (+ royale-drop, royale-mp, sync, input, remote-body).
- **2026-10-17** (-dc2) Royale drop cinematic phase 2, the hold (modes/royale-crew.js; royale-cine.js, royale-planes.js, royale.js): the jumpmaster and the squad mate are stick trollface rigs (user: "just another stick figure for now"), local only off the drop clock. He walks down to you, leans in and taps his mouth at T-16, points aft, goes ahead to the ramp, twirls a finger (turn round), chops GO. The squad mate takes the seat across (that bot is hidden), holds his mask on with both hands, rises, lines up. You stand at T-8, walk to the hinge, red light at T-15, the ramp down from T-5, turn to face in at T-1.6; at the green you're handed back at the ramp and Space steps you back out. Hands placed by IK (reachHand); the test measures the lean and the hands. Test: drop-cine (+ royale-drop, royale-mp, streak-holster, nuke, royale: Hopium flakes on main).
- **2026-10-17** (-ne1) Nuke end title: "You went nuclear" only on the caller's own tab (combat/scoring.js onRoomEnd checks nk.id, not the name; two guests are both "operator"). Test: nuke (+ drop-cine).
- **2026-10-17** (-dc1) Royale drop cinematic phase 1 (modes/royale-cine.js + royale-mask/photo/ipod.js; doc "Troll Forces: Royale drop cinematic"): a lobby card T-40..T-22 picks the opener, Photo or Music (← → / ↑ ↓ song, tap, d-pad; remembered in localStorage). T-22..T-8, players aboard before T-22 only: seated and pinned facing across the hold, scripted head, letterbox + jumpmaster subtitles (no voice), HUD out. Photo = a worn family print (him, her, baby son) held low, thumb across it, warm edges; Music = a click-wheel iPod, earbuds in, the picked Troll Radio song plays (game.music), fades at T-16 and the radio goes back as it was. T-16 the jumpmaster cuts in, T-15 the oxygen mask (streak-hold kinds photo/ipod/mask), three breaths with visor fog, T-8 on your feet. Synth sfx. Phase 2 = #989 jumpmaster + stick squad mate. Test: drop-cine 56/56 (+ royale-drop, royale-mp, streak-holster, nuke; royale's Hopium/Cringe hp checks flake).
- **2026-10-17** (-tn2) Tactical Nuke phase 2, the blast (streaks/nuke-blast.js): the missile for the last 3 s, then at zero every client flashes white and everyone is down for good (player down with no respawn/killcam, remotes and bots vaporised, the host's bots frozen via BotManager.frozen, HUD gone); the nuke's cameras (view/player-update.js) run 12 s: your eye, a wide shot from past the map edge, a push in as it whites out; a sprite mushroom cloud (rolling cap shaded under, cooling fire core, trollface ink in the cap), ground ring + dust, sky and fog to burnt orange; then endMatch(title, { won }) with the caller's side (FFA: the caller) as winner, the caller's `end` carries `nk`; score limit and clock wait while one is inbound. Test: nuke (+ roomsync, killcam, bot-streaks, input, medal, dom, ffa).
- **2026-10-17** (-ml1) Medal splash moved above the crosshair (style.css only): it sat on the streak devices held low (tablet, nuke handheld) and the streak strip. Tall screens stack three upward from the crosshair; short screens show the newest only; phones show it as one line (small badge + name) in the gap under the streak banner. Test: medal-layout (desktop 960x540 + 1280x800, phone 844x390 + 667x375), medal.
- **2026-10-17** (-tn1) Tactical Nuke phase 1, earn and call (streaks/nuke.js, nuke-device.js; doc "Troll Forces: Tactical Nuke"): the Nuclear medal (25 without dying) banks it in TDM/FFA only, one per match, kept through death; a red HUD row; N, a tap on the row, or d-pad right held 0.5 s raises the olive handheld (boot screen with the trollface, safety cover, red key), armed 1.6 s in; one `nuke` streak message, everyone runs a 10 s countdown (banner, counter, siren, red pulse, sky to orange-red), the match keeps going; zero is a placeholder flash until phase 2 (missile, detonation, match end). Test: nuke (+ input, zpad, bo2pad, roomsync, streak-holster, medal, bot-streaks).
- **2026-10-17** (-cq1) Create a Class: the whole class at a glance in the detail pane (menu/class-preview.js): primary + attachments, secondary, melee, throwable, three perks, three streaks; follows the highlighted class; desktop gun view 24cqh there, phones a two-row card under the gun. Test: class-preview-phone.
- **2026-10-17** (-dom1) Domination (modes/domination.js, mode `dom`): flags A/B/C placed off the spawn sides (or a map's `domFlags`), ~10 s to take alone (2x max with a crowd), contested holds, a held flag scores 1 every 3 s, kills score nothing, first to 200; the bot host runs the flags and sends `dom` state/caps (net.publishDom); bots go for flags their side lacks; HUD chips, capture bar, rings + minimap; KotH tick moved to objectives.js updateObjectives. Test: dom (+ objectives, roomsync).
- **2026-10-17** (-cp1) Create a Class on phones: the gun preview shows sideways and upright (it was display:none in both BO2 phone blocks; the BO2 menu always uses the hero stage, the detail pane sits under it). Test: class-preview-phone.
- **2026-10-17** (-rc1..-rc5) Roblox Studio as the animation workshop (doc "Troll Forces: Roblox Studio as the animation and gun workshop"): TF_Rig in Studio, tools/troll-ops-roblox-anim.mjs/.luau export clips to characters/clips/*.json (characters/clips.js); every troll plays the Studio sprint and the PF gun sprint (gun across the chest; aim/fire ends it), bots at their 4.2 m/s top speed; #989 wears Sensei v3, a logo-free gi made in Studio (legs/torso-sensei3.glb); Bubblegum bubble at the lips; NFT characters into Studio as a trait library (tools/troll-ops-to-studio.mjs/.luau). Open: the ink pass speckles where pieces meet. Tests: clips, gait, 3p-hold, nft-face, emote, sync, load-sync.
- **2026-10-17** (-rb1, -fg3, -hd1) TROLLS #989: the user's own trollface drawing on a head built from its outline (head-989.glb, FACE_HEADS), hairline above the eyes; Roblox Studio body (tools/troll-ops-roblox-body.mjs, blocky legs/torso-rbx989.glb) in the NFT lab only (?pieces=rbx989), in game is phase 2 of the "Roblox bodies for NFT characters" doc. Tests: nft-face, nft-hold, 3p-hold, bot-head.
- **2026-10-17** (-bt1) Troll City saloon sound (modes/social-saloon-sound.js): Piano Pete plays the house tunes on his own (room clock), one earshot falloff for every instrument (muffled through the walls), murmur, clinks and laughs inside only. Test: saloon-sound.
- **2026-10-17** (-bt1) Troll City station timetable board (maps/train-board.js): a chalkboard gantry over the platform, next arrival / departs m:ss / status, off the train's own timetable. Test: train-board.
- **2026-10-17** (-bt1) Club door: Bandana Benny every 90 s, and a player in a bandana gets asked to take it off. Test: club-bandana.
- **2026-10-17** (-bt1) Trolling Loud: the floor lights come from the mirror ball, not the DJ booth. Test: tl-disco.
- **2026-10-17** (-bt1, sabers -ap1) Tests can't trap the desktop cursor: assets/js/automation-pointer-lock.js fakes pointer lock under navigator.webdriver (troll-ops input/keyboard-mouse.js, grin-sabers input/input.js).
- **2026-10-16** (-ht1 -mj1 -sn1 -lp1 -bw2) NFT caps toon-shaded (no see-through in the menu); French Moustache joint gaps filled; Royale ramp waits for 0:00 (a room-map note to a newcomer ended the sky lobby); Pour up with a TROLLS body (fist stops off the cup, holds the bottle's base; trip off the emote clock); ported from tf-parallel: the saloon band (BAND.md; sound/songs.js, menu/notation.js, characters/instruments.js, sound/instrument-voices.js, modes/social-band.js), arm wrestling (modes/arm-wrestle.js) and the Trolling Loud kitchen (maps/trollingloud-kitchen.js, view/swing-doors.js). tf-parallel's Grin Beach WIP stays there.
- **2026-10-16** (-mr1 -bf1 -gt1 -ci5 -fg2 -wh1 -bd1 -ms1) TROLLS faces flipped left to right like the NFTs (HEAD.mirror; hats flipped back so prints read); #2630 blindfold moulded on (SHELLS) and tongue on the right; #2631 gold tooth fills a whole tooth (face-gold-tooth.svg); no grey ring round face traits; #989 keeps the trollface eyes; #33 wizard hat modelled (wizardHat); #820 beard inner edge traced from the face (no sliver in 3/4); French Moustache a moulded shell (tips on the cheeks). Art tag tr6. Tests: blocky-ingame all seven tokens.
- **2026-10-16** (-fc1 -bj1 -nk1 -nk2 -hv1 -fm1) TROLLS faces closer to the NFTs: #33 Cracked Eyes painted into the trollface (face-cracked.svg, FACE_TRAITS reads eyes); beard hem follows the jaw (JAW); head 0.69 -> 0.85, hit sphere counter-scaled to stay put; neck tried and dropped; head-flat/head-jaw candidates (HEAD.model, game on relief); French Moustache slim (tools/troll-ops-moustache-art.mjs, art tag tr3). Tests: blocky-ingame 33/820/1718, nft-face.
- **2026-10-16** (-ci2 -ci3 -ci4) NFT outline: one line per piece (hull hidden only when its own piece is inked), then two weights (bold outside, half-width 70% inside, warm near-black) and cut-out pieces (face, beard, hats) inked by their drawn alpha. view/char-ink.js INK exported. Test: blocky-ingame.
- **2026-10-16** (-dl1) TROLLS design lab, tools/nft-lab.html (localhost): any token or trait mix on the game rig, live DESIGN/INK sliders, Game vs mine, poses and emotes, turnaround, Copy for Claude; ref art from refs/ or the chain.
- **2026-10-16** (-em2) Emotes on TROLLS bodies (block middle finger `birdFinger`, dab by reachHand, facepalm/L/sad hands to `facePoint` on the posed head, laugh holds the belly); Bubblegum (wire 19, `token: 989`: the wearer and troll_runner, cosmetics.js `mayEmoteToken`, the wheel lays out only usable slices); Crutches (wire 20, placed armpit to ground each frame; `rig.emoteBits`); #820's beard tinted back to the NFT's brown. tools/troll-ops-emote-shots.mjs for frozen-frame sheets. Tests: emote, sync, load-sync, nft-hold, 3p-hold, import-check.
- **2026-10-16** (-gl1) Rotating a phone turned the menus black and white: the globe lost its WebGL context (iOS rarely restores it). assets/js/menu-globe.js now shows the stand-in planet and rebuilds the map after 1.2 s, keeping view, pins and map mode. Checked by forcing WEBGL_lose_context on index.html and troll-ops.html.
- **2026-10-16** (-nb2) TROLLS #33 (Magician Hat, Cracked Eyes, Jester), #2630 (Trucker Hat Microsoft, Blindfold, Licky, Tshirt Black) and #2631 (Trucker Hat Yobucks, Glasses Reading, Gold Tooth, Trainer): 11 traits drawn (traits/src), kits on the farmer/sensei pieces. NFT head rebuilt with a real skull (BACK 0.19; hats, Carrot Cake Hair and back cards moved out with it; glb tag bb3). Tests: blocky-ingame all seven tokens, emote-shots heads at 4 angles.
- **2026-10-16** (-nb2) Pour up after-effect (view/lean-trip.js): 24 s purple wash, drifting trollfaces, slow sway after the sip. Test: lean-trip.
- **2026-10-16** (-nb2) Invites (menu/invites.js) and public chat (menu/public-chat.js) on the site presence channel (site-presence.js send/on/nameOf): Invite on profile cards and the new guest card, Join / Not now (J mid-match); a Chat pill for everyone with unread badge, notifications, a mute bell; live only, no history. Tests: invite, public-chat, party-list, online, menu, emote.
- **2026-10-16** (-pc2) Public chat mid-match: a PUBLIC channel in the match chatbox (net/chat.js; U, Tab steps ALL/TEAM/PUBLIC; [PUBLIC] lines, none when muted); the box closes if it can't take focus (intro). #33 is Bradz_'s. Tests: public-chat, invite, blocky-ingame 33. chat-test's two profile-click checks fail on main since before 873a6afa (not this).
- **2026-10-16** (-sb1) #989: the Sensei badges sit higher (front on the upper chest, back between the shoulders), the two nape spikes are gone (build_blocky_hair; ART_V tr2, GLB bb4). Test: blocky-ingame 989.
- **2026-10-16** (-cf1) Crutches: three hobbles, then a crutch slips: a stumble, the crutches fly, a faceplant with a bounce and a leg twitch (emotes.js poseCrutchFall; 7.5 s). Test: emote (fall check), emote-shots crutches.
- **2026-10-16** (-gs2) Gun spin: the gun twirls end over end on its grip (weapon-view.js gunTwirl, before the arms are posed; support hand lets go; long guns held out and low), not rolled round the barrel. Test: emote, first-person shots rifle + pistol.
- **2026-10-16** (-tb1) Redesign phase 1, button tiers (style.css .tf-btn--primary/--secondary; bo2-menu.js item `tier`): Public Match is the orange Primary, list rows highlight with a soft rounded fill, the footer is 44px Secondary. Mock-ups: https://claude.ai/artifact/NFh6BM4oGovAf33MrY5YKx. Test: menu.
- **2026-10-16** (-dk1) Redesign phase 2, the dock: Emote/Chat/Barracks/Options show on the top menu only (.to-bo2.is-top; user: you could press Emote from inside Barracks); Animations is an Options row now. Tests: menu, party-list.
- **2026-10-16** (-gf1) GIFs in the public chat: 14 of the site's trollface GIFs (ui/gifs/, 180px), a GIF grid in the panel and a strip over the match chatbox on PUBLIC; the wire carries only an id checked against public-chat.js GIFS. Test: public-chat.
- **2026-10-16** (-sc1) Redesign phase 3, the social column on the right: you + who's online with an Invite button each, the public chat card (last 3 lines, GIFs too; Open) at its foot; the operator moved to the middle; the footer strip no longer swallows clicks above it. Tests: invite, party-list, public-chat, menu.
- **2026-10-16** (-lb1) Redesign phase 4: every lobby's go button (Find Match, Start, Hang out, ...) is its orange Primary (deployRow tier). Redesign done; globe + asteroids kept. Tests: menu, online.
- **2026-10-16** (-lh1) L on forehead makes a real L: hand pose "L" (character.js: the stick mitt `lsign`, index + thumb out), block fists get an index and thumb block on it (blocky-body.js `fistFingers`, replaces birdFinger; FIST_FINGERS), the wrist turned so it reads the right way round; cop fingers open index + thumb; hero bodies hide the mitt. Tests: emote, remote-body (alone: parallel runs flake its jump checks), blocky-ingame 1718, emote-shots loser HEAD=1 on 989 + 820.
- **2026-10-16** (-fh1) NFT head side profile: the face was a 0.03 m flat dome, a straight edge side-on; build_blocky_head FRONT 0.065, P_FRONT 2.0, JUT 0.2 (a brow, nose and chin in profile; glb tag bb5). Front trait cards sit out at RELIEF.front 0.085 and bend round the dome (wrapCard), the cap front 0.09. Tests: blocky-ingame 989 + 1262, emote-shots HEAD=1 side/front/3-4 on 989, 820, 1262, 33, 2631.
- **2026-10-16** (-ci1) NFT outline breaks: view/char-ink.js inks the edges between a TROLLS body's pieces (an id per piece on a rig joint, torso halves and head one each; id + depth target, edges on the far side, width in metres on the body). Game: CharInkPass after the RenderPass, hidden behind the scene's depth (composer target has a depthTexture; draws via its own target, no feedback loop on Low); menu: drawInkOverlay. Only runs when a body is worn. Tests: blocky-ingame 989 + 1718, emote, menu; emote-shots CELL=900 for big frames.
- **2026-10-15** (-nb1) troll_runner wears every TROLLS body, current and future (cosmetics.js `mayWear`; everyone else stays holder-only). Barracks, Options and Emote moved to footer pills by Animations (portrait phones wrap them under the online count); your own name opens the Barracks; Cosmetics > Body has a search box (name or #token). Tests: menu, online, loupe.
- **2026-10-15** (-or1) Game files organised into folders: the top level is game.js, style.css, the prefetch manifest and this file; modules live in bots/ characters/ combat/ core/ input/ maps/ menu/ modes/ (modes/zombies/) net/ progression/ sound/ streaks/ view/ weapons/, design docs in docs/, labs and inspectors in labs/ and menu/. Renamed on the way: royale.js -> modes/royale-zone.js, zombies.js -> modes/zombies/horde.js, zhub.js -> modes/zombies/hub-hall.js, dragonfire.js -> streaks/dragonfire-drone.js. Moves go through tools/troll-ops-move.mjs (git mv + every path + tags); tools/troll-ops-import-check.mjs checks every import, relative path and tag (`--load` opens every page). A test that names a game file in a regex or path piece needs a hand fix after a move. Already red before the moves: chat profile-click, remote-body, shotgun pump, soulblazer, zombie mask (its tag), club-crowd, drink-hold NaN; flaky: dragonfire, royale heal, dj, bot-stairs in game (HEAD failed it too on a seed).
- **2026-10-14** (-fl1, landed on main 2026-10-15) Bots use every floor and district: per-map posts (bots.js `placesFor`: spots on every upper floor reachable from the ground, one a ground square of 18 m), picked out of a fight and in one at half pace (`POST_*`: up 32%, ground 28%, else a hunt; never two high posts running), ground picks lean to empty, cold districts; a held post shuffles and keeps its footing, fights from up high don't close in off the edge. Fixes on the way: stair feet and posts behind a doorway the old grid seals use the chase grid (Troll City saloon, Hollowgrin chapel), a post names the flight that reaches it (`via`, Grinleria escalators), nav.js steer walks off an unrouted sliver, a bot just off a stair walks on before giving up. Off-ground bot time 0-8% -> 8-41%, near-empty districts gone (Hollowgrin 5/15 -> 0-1), kills about a fifth fewer per minute (spread out, not all on the nearest enemy); a hold boxed in against a wall ends after 4 s still (`POST_STILL`), and a bot that wants to move but stays within 1.5 m for 6 s out of a fight side-steps and re-plans (`DRIFT_*`; one paced Hollowgrin's 9 m park ride deck, 1 bots-step run in 9). Cost: the posts are built at map load (`prepPlaces`, game.js after `rebuildNav`; Hollowgrin ~150 ms behind the loading screen), so no match tick is slower than main's (headless slowest tick ~20 ms on both); per-tick bot time as before (headless p50/p90 unchanged), map-fps within noise, Royale untouched (`navCell >= 1` keeps the old perches). Tests: bot-floors (new), bot-stairs (stray lines fixed), bot-host.
- **2026-10-14** Troll Royale island phase 1 (-pi1, ROYALE-ISLAND.md): POI tiers on Trollface Island's landmarks (`LANDMARKS[].tier`, royale.js `POI_TIERS`): hot places 2.5x loot with a third of their guns a rarity up, mid 1.5x, open 0.6x, same total; loot on the Boat's deck and the Bridge (bots leave raised loot); bot landings and the last circles lean to POIs; a Royale bot is calm 30-45 s after a kill (bot-fire.js `killedAt`). Tests: royale-bots (calm), royale-island (deck loot).
- **2026-10-14** Royale C-130 drop-in (-pl2, PLANES.md; built 2026-10-10 on tf-parallel, ported onto today's main): you start aboard one of 12 C-130s, nine trolls a plane, seated planemates, door at 0:40, red at 0:08, ramp + green at 0:00, walk off or Space, then today's flying fall (stick forward flies) off the ramp; bots spread their landings from their own plane's exit; replaces the sky-lobby box, belt and glider. Tests: royale-drop-test, royale-phase-c-test.

- **2026-10-14** (-br1, LIVE main 1641012b; gate not run, user said push) Black Ops 2 reloads for the SMGs (MP7, Vector, PDW-57), LMGs (Colt = HAMR, M60 = Mk 48, RPK = QBB) and pistols (Five-seven, KAP-40, slide racked to finish an empty one), from BO2 footage; procedural drum mags keep their roll through any reload. Tests: arreload (361), pistols, smgs.

- **2026-10-14** (-sr1; stylised realism) Env map from the sky, a post-tonemap grade per map, the gun drawn inside the composer, a sun-coloured rim on characters; Cycles light-map bakes (sky, bounce, lamps; runtime lamps removed) for Cul-de-Grin, Grin Site, Dust Bowl, Grin Beach, Grinjuku, the Depot and the Grinleria, grades for the rest (how a map is baked, and the lessons: REALISM.md; krypto2009 eggs still wait on photos); wear decals and glossy puddles. Tests: input, menu, killcam, rope, view-mode, remote-body, fps, every map's bots move.
- **2026-10-15** (-hl1) Radio: Headlines (Drake), beat grid 152 BPM. Tests: dj, menu, trollingloud.
- **2026-10-15** (-nf1) TROLLS #820 body for guccibeardd ONLY (Camper Hat, Beard Brown, Eyes Bloodshot, Farmer): a reusable trait library (traits.js TOKENS/TRAIT_ART, blocky-body.js KITS per garment, so the next NFT reuses drawn traits); net bk = the token, shown only on its holder (cosmetics.js mayWear); a 3D beard grown from the face and draped on the raycast chest (traits/BEARDS.md, tools/troll-ops-beard-art.mjs); first-person block arms for any NFT body with the garment's sleeves, the fist dropped when aimed so it never covers the sight. Tests: blocky-ingame TOKEN=820/1718, nft-fp-shot BODY=trolls-820/1718/0.
- **2026-10-15** (-nf1) TROLLS #1262 body for big_elva001 ONLY (Baker Hat, Face Mask UMADBRO, Glasses Thug, Sweater Black): the mask is a thin shell off the face (blocky-body.js SHELLS, the beard's volume, `lift`), the shades go on over it (OVER_FACIAL / OVER_SHELL), a flat cap with a front-only bill (HATS brimBack null), the sweater on the farmer's pieces in black. Tests: blocky-ingame TOKEN=1262, nft-fp-shot BODY=trolls-1262.
- **2026-10-15** (-nf1) Title menu party list: everyone online (presence roster) listed under your row, up to 8 then "+N more online" (opens Who's Online), offline players drop off on the next sync; on phones the rows that would run into the controls below fold into the more line; "Everything unlocked" gone (owner XP line, next-unlock). Test: party-list (fake presence channel).
- **2026-10-15** (-nf1) Free look in third person (view/free-look.js): hold Alt / hold the pad's Select (a tap still switches 1P/3P) / tap the touch eye, and the look input orbits the camera round your troll to its face while your aim, movement and the wire stay put; let go and it eases back behind. Test: free-look.
- **2026-10-15** (-nx1) NFT body fixes from a close look (user): lower-face shells (beard, bandana) end on a curved hem under the jaw, clear of the shirt (blocky-body.js `hemmed`, `BEARD.hem`); the relief face's ink hull is rim-only (`rimInk`: it poked through the farmer's nostril as spikes); arms skip the sneaker's colour keys (`SHOE_PARTS`: #1718's upper arms were painted the shoe's black). Still open: outline breaks where pieces touch, the head's flat side profile. Tests: blocky-ingame TOKEN=820/1262/1718, nft-fp-shot.
- **2026-10-15** (-pf1, LIVE main 11d0f601) Troll City frames hug their art (`framedPicture` fits `artAspect`); the general is never cropped. Undergrin Metro: the seven flat-paint ug-*.glb + builder landed unwired (UNDERGRIN-METRO.md section 10). Tests: map-shots trollcity + undergrin.
- **2026-10-15** (-ub1, -uw1, LIVE main 837a26a3) Undergrin rebuilt as a Metro (2025) station in the modded full-bright look (UNDERGRIN-METRO.md): blockout colliders, zero lamps, drawn by seven flat-paint ug-*.glb (old four deleted), shop partitions added. Tests: map-audit, map-walk 28/28, bot-stuck; bot-stairs flake fixed in phase 5 (next line).
- **2026-10-15** (-ug5, -nl1, LIVE main 7908dc12) Undergrin phase 5: atrium loading shot, bright ambience (tube hum, PA chime, trains), bore rails and the west stairs' foot fixed. Bots now read their chase field on the floor they're on (-nl1, bots.js navLevelAt), which ends the bot-stairs flake (UNDERGRIN-METRO.md section 12). Tests: loading screen, ambience-test, seeded bot-stairs 16/16, the all-maps sim, bot-stuck, oitc-bots. Open: the in-game half of bot-stairs-test has a ReferenceError (lines from hunt() pasted into run()); map-walk "N escalator (west lane)" fails on main too.
- **2026-10-15** (-nf2) TROLLS #989 body (the troll dev's Goku token, on troll_runner until he signs up): Carrot Cake Hair modelled in Blender (models/build_blocky_hair.blender.py, blocky-body.js HAIRS; traits.js MODELLED skips its drawing), Sensei gi (build_blocky_sensei.blender.py arms/legs, clothes-sensei.block.svg, KITS fp override for bare forearms + wristbands), its own face (traits.js tokenFace -> rig.nftFace, character.js FACE_ART gum: the trollface with only the expression swapped, traits/src/face-gum.svg). Bubblegum emote still to build. Tests: blocky-ingame TOKEN=989/820/1262/1718, nft-fp-shot BODY=trolls-989/1718, emote, menu, import-check --load.
- **2026-10-14** (-nh1) Radio: Natural Habitat (070 Shake feat. Ken Carson; from the user's screen recording, ends 207 s with a fade), beat grid 148 BPM. Tests: dj, menu, trollingloud.
- **2026-10-14** (-jb1) Radio: OUT WEST and GATTI (JACKBOYS), DArkSide (Bring Me The Horizon; from the user's screen recording, ends 164 s with a fade), 192k, beat grids 140 / 71.6 / 112 BPM. Tests: dj, menu, trollingloud.

- **2026-10-14** (-bf1; the user's 4 phone bugs)
  - The phone magnifier: every touch control and the canvas cancel the long-press default (input/touch.js). Test: loupe.
  - Swap cycles primary, secondary, melee (touch SWAP, a tap of X, the pad's Y), in the range, Zombies and the waves too; stands down for a co-op revive in reach. Test: swap.
  - Royale freefall steers like Fortnite: stick forward with the camera level flies you across the island (reach 135 m to 351 m). Test: royale-drop (now in the full run).
  - The gun no longer shows through the TROLLS body: measured, it sat 5-6 cm in the chest and through the forearms, the reload mag in the thigh, the menu carry 7.5 cm in the forearm; blocky-body.js GUN_HOLD retuned (character.js hooks). Test: nft-hold (surface-sampled, old code fails 55).

- **2026-10-14** (-aa0 to -pd1, LIVE main fd500ff; pushed on the user's say with the gate's rerun still going; the first run's 19 reds were the machine overloaded, the real five passed alone)
  - Aim assist gone (stick and thumb; the Dragonfire's nose gun keeps its pull). Auto reload on an empty mag. Tests: input, reload-death.
  - Rooms: a joiner takes the room's map from anyone in the match and the host's versus mode; whoever's match ends tells the room ("end"). Tests: roomsync, zjoin.
  - Zombies: drop into a run mid-round, spawn in when it's cleared; a host retaking a run keeps its wave; skip button says "all needed". Tests: zjoin, zcoop.
  - One in the Chamber bots: one lethal round, knife when dry. Killcam gun wears the killer's finish. Tests: oitc-bots, skin-sync.
  - Menu: Who's Online and Server Browser (menu/online.js on site-presence setActivity; hub publicRuns). Test: online.
  - Socialize: a player can take Trolling Loud's decks (rp role dj). Test: dj.
  - Pad is Black Ops 2's Xbox 360 default (-pd1): X reload / hold use, Y swap, LB tactical, RB lethal, L3 sprint (latched, a pushed stick no longer sprints), R3 melee, d-pad right streak (hold: end), up/down scroll streaks both ways, left tap inspect / hold emotes; Back third person. Swivel is off the pad. Prompts name X by the pad's own letters (controller-layout.js padButtonName). Test: bo2pad.
  - Phone: a 1P / 3P camera button beside Emote (to-touch-pov; movable in Customize HUD). Test: bo2pad.

- **2026-10-13** (-ar1, LIVE main 0588c6a; gate red only on zhub-test, passed solo, user said push)
  - Black Ops 2 rifle reloads for the nine BO2 rifles, from BO2 footage: tac and empty, each rifle's own pose and finish, right on the stick arms and the TROLLS block arms. Test: arreload.

- **2026-10-13** (-zp1, LIVE main 10ad34e; full gate skipped on the user's say, link check fixed)
  - Zombie Rush P7 done: lunge, tier-up flourish, deploy unfold, swap raise, downed camera, revive ring, bat/shovel swings with both hands (a real spade), turret flash and co-op blood, boss tint on clothes. Tests: zanim, zdeploy, zcoop.
  - Controller in Zombie Rush: d-pad prompts instead of 4-9; down walks the highlight, up buys/deploys, R2/A places, B cancels. Test: zpad.

- **2026-10-13** (-hr2, LIVE main 10ad34e)
  - Troll City RP 2c, from tf-parallel without the band: Kek & Sons the merchant (stetson, canteen, apples; social-shop.js) and six horses to ride with the horsekeeper (saddle, whistle, brush; social-horses.js). Riding puts the guns away (handsFull). Tests: shop-test, horse-test (the whistle check can miss under load; solo passes). The saloon band is still only on tf-parallel.

- **2026-10-13** (-zc1/-zc2, main 032863f, live confirmed; gate green 54 min, three tests passed on their solo retry)
  - Zombie Rush P7 so far: the bite lands with the claw (dodgeable), zombies turn instead of snapping, heavy hits stagger them back. Test: zanim-test.
  - Phone buttons show what they do (view/touch-icons.js: mug / shot / keys / fist on fire, an icon on the hold-X button); the TROLLS NFT body's emotes use its block arms (nft-fp-shot).
  - Checks: `troll-ops-gate.mjs --quick` between tasks, the full gate (parallel, solo retry) once before the push (CLAUDE.md rule 3).
  - Zombie Rush P6: Credits (runs pay; guns in six tiers with levels, Rookie kit levels; credits.js) and the real Weapons / Classes kiosk screens. Test: zcredits-test.
  - Aim assist: none on a mouse (Phantom Forces), toned down on a pad and a thumb (CoD); recoil at 70% on every gun (weapons.js RECOIL_SCALE). Test: input-test.

- **2026-10-13** (-zh1, main 0e6283d, live confirmed; gate red only on bot-host-test (net::ERR_NETWORK_IO_SUSPENDED, PC slept), user said push)
  - Leaderboards (user 2026-10-13: logged-in players, weekly + monthly, all time on the profile card): one write per match (reportGameResult, meta gains pvp/won/assists/headshots/streak), leaderboard-rows.js adds rows up per window; menu Leaderboards Weekly/Monthly row; profile card all-time Zombies. Never call `TrollLeaderboard.record` for troll-ops: it files a second RPC with the weekly total as the score.
  - Zombie Rush P6 placeholders: Weapons / Classes kiosk screens and a Credits chip.
  - Zombie Rush P5, the hub: Zombies starts in a public hub (QZHB) with four map pads, a private pad + invite link, kiosks, and Highest Wave / Total Kills boards; pads launch co-op runs on a fresh code and runs come back. Test: zhub-test.

- **2026-10-12** (-zr10, the Zombie Rush branch's first push)
  - Sideways-phone menu: a half-scrolled row fades out above the description, the operator stands below the party box; the text scan clips to scroll boxes. Test: menu-phone-test.
  - High graphics: bloom threshold 1.2 by default (sunlit trollfaces haloed white; Troll City drops its override, night maps keep theirs); SSAO skips see-through meshes (view/ssao.js: a box round every face and loot beam).
  - Settings > Show FPS (core/fps-meter.js): top centre, fps / worst frame / graphics level. Test: fps-test.
  - Troll Royale lag (royale-perf): floor guns baked to one mesh per material, crowd LOD (no SSAO in a crowd, shadows within 15 m, gun detail within 20 m, posing by distance and on-screen), loot search every 0.5 s, bot tracers end where they land, far-sound budget (audio.js), stick-body rebuild ~5x cheaper (character.js).
  - Troll Royale fights: bots land spread over loot spots they can reach and dive only when they can make it; bot-vs-bot damage and sight raised by phase; kills from ~19 s (royale-pace).
  - Bot heads: scoped in, the head dips onto the stock; a one-frame stop no longer restarts a bot's legs (remote-players.js `STOP_HOLD`). Test: bot-head-test.
  - TROLLS body polish: the menu carry holds a broad body's gun the match's way, the body takes off the expression and face covering, first-person arms are its arms, the menu operator is bigger and never cut mid-screen.
  - Radio: Ghostface Killers (21 Savage, Offset, Metro Boomin feat. Travis Scott), beat grid 83 BPM.
  - Zombie Rush P4, co-op: a private code makes a 1-4 run (menu: Zombies Co-op; blank = solo, never public). The host runs horde, waves, bosses and deployables ("z"+letter, modes/zombies/coop.js); others see mirrored zombies (`Zombie.proxy`) and send hits; a kill pays its maker. Waves x(1+0.45/extra player), skip break is a vote, a downed player has 30 s for a 4 s hold-X revive, all down = lost, host handoff, late-join sync. Test: zcoop-test.
  - Zombie Rush P3, bosses: brute from wave 12; Meatwagon halfway through waves 10/20, The Grinlord on wave 30 (summons, slam that breaks deployables); boss bar in the top line (modes/zombies/boss.js). Test: zboss-test.
  - Zombie Rush P2, the Rookie kit: Deployables column (7/8/9 or tap, hold = grid): Auto Turret, spiked Barricade, Explosive Barrel (chains); rising prices (kits.js `priceOf`), health bars (modules: modes/zombies/{kits,deployables}.js, view/zombies-bars.js, models/build_zkit.blender.py). Tests: zdeploy-test, zrun-test.
  - Zombie Rush P1, the run loop: cash per kill and wave, upgrade column (max health, gun tiers, bat then shovel; keys 4/5/6), infinite reserve, 15 s skippable break (K), down not dead, win at wave 30 (modes/zombies/{run,economy,upgrades}.js, view/zombies-hud.js). Test: zrun-test (shared no-overlap scan tools/troll-ops-text-scan.mjs).
- **2026-10-12** Arcade links go home (-hm1): the menu's Arcade link and row open trollrunner.net's Arcade menu (index.html?open=arcade), not games.html; the home page's Leaderboard is a panel there.
- **2026-10-12** FHJ-18 AA launcher (-fj1, FHJ18.md): Secondary > Launchers, 6 missiles a life, ADS-only lock-on (combat/launcher.js) on aircraft and SAM Turrets, `aa` on the wire, 1 bot in 5 carries it; UAV fixes (one downed UAV no longer ends the team's radar; downing a Counter-UAV lifts the lockout). Test: fhj18-test.
- **2026-10-12** Trolling Loud's bandana guy (-cw1, club-entry.js): on the room clock (a slot every 150 s, 70% with him) he walks up, shrugs, gets kicked out and leaves; a human at his lane comes first. Tests: club-entry-test 6, club-room-test 6.
- **2026-10-12** Crip walk emote (-cw1, emotes.js `poseCripWalk`, wire 18), feet planted with character.js `placeFoot`. Test: emote-test.
- **2026-10-11** TROLLS #1718 body cosmetic (-bk1): Cosmetics > Body, locked to troll_runner until the wallet check; the blocky troll reshapes the live rig (character.js `reshapeRig`, hit capsules follow), `bk` on the wire (drawn only with `ow`). Tests: blocky-ingame, 3p-hold, gait, remote-body, menu, killcam.
- **2026-10-11** Bodies (-gt1/-gt2, character.js): a runner's gait (real stride and cadence, Hermite swing, two-bone legs, lean, idle weight shift); jump, fall and land poses for everyone (remote ones read off height); planted feet pinned (`_footLock`), per-troll `gaitStyle`, backward-lean and head-pitch sign bugs fixed, hit stagger, emote cross-fades. Tests: gait-test, body-air-test, remote-body-test, emote-test, killcam-test.
- **2026-10-11** Frozen bots (-bw1): a stalled host no longer leaves the bots to nobody (net.js prune, `js` in state, `retireBots`); bot watch (modes/bot-watch.js) lets a non-host take over from a frozen host (`stall`, net.distrust). Grinleria escalators got collider rails. Tests: bot-host-test, escalator-test, bot-stairs-test.
- **2026-10-10** Five classes and BO2's perks (-cl1, CLASSES.md): Create a Class (five classes, rename), sixteen perks, `pk` bits; bots carry a perk a tier (-bp1); Engineer re-rolls your care package; menu hover previews; trollrunner.net/tf. Tests: classes-test, perks-test, exit-links-test.
- **2026-10-10** Radio: nine more songs (-sg1), beat grids regenerated.
- **2026-10-09** Troll City RP 2d, the conductor (-cd1): `modes/room-clock.js` (the room's shared time; the Grin Express runs on it), riders' car-local spot (`tc`), `modes/social-conductor.js` (cap, all aboard, whistle, tickets). Test: conductor-test.
- **2026-10-09** Troll City RP 2b, the sheriff (-sh1): `modes/social-sheriff.js` (badge, cuffs, leash, cells, wanted board), `modes/social-jail.js`, the arrest scene (view/arrest-cine.js). Wire cf / jl / wl. Job modules are never imported by third-person or buttons (import loop through social-rp). Tests: sheriff-test, duel-test.
- **2026-10-09** Club entry phase 5 (-ce5), CLUB-ENTRY.md done: the 18+ question answers on a pad and on touch. On a pad the line's hold is D-pad right like every hold-to-use (X is melee), not the doc's "hold X". Tests: club-entry-test (solo, pad, phone), club-room-test (3 tabs).
- **2026-10-08** Assault rifles (-ar1/-ar2): Black Ops 2's nine, traced (weapon-ars.js; ids kek/lol/lmao/rofl/heh/mald/coalface/salt/ratio), then Blender GLBs (models/build_ar*.blender.py, gunkit `slab_body`). Cascade `--unify` fixes tags a merge split. Test: ars-test.
- **2026-10-08** Weapons batch (-wb1): BO2 pistols (Sixty-Nine, TRUE-69; view/pistol-action.js), snipers with bolts and the BO2 scope (weapon-snipers.js, view/rifle-action.js, view/sniper-scope.js), SMGs (weapon-smgs.js), shared tracing (weapon-traced.js), attachments by class (attachments.js `CLASS_FIT`). Tests: pistols-test, snipers-test, smgs-test.
- **2026-10-08** tf-parallel batch: Troll City glitches (-tc3, guard tools/troll-ops-trollcity-audit.mjs), drinks held properly (-cup1), no body clothing (-nc1), Hawaii club ID (-cid1/-cid2, view/club-id-card.js), visible grenade throws (-th2, combat/throw-anim.js). Tests: drink-hold-test, club-entry-test, throw-test.
- **2026-10-07** Batch (branch tf-grinjuku): bots hit 28/37/55% with misses striking the wall behind you; Royale's open-wall freefall drop; cloud save no longer stomps another device; K9 dogs and bots through doorways; Troll City fist fights, jail, bump warnings, seats, mugs, pour, smithy, piano and sheet music, the Grin Express; Socialize limited to Troll City and Trolling Loud; club entry phases 1-4 (line, ID, wristbands, kick-out, the shared room); no face colours; Trolling Loud guests in outfits. Follow-ups (-fu1): rope pose, Trolling Loud seats, reload cut by fire, Infection's keyboard sword.
- **2026-10-07** Grinjuku (Shinjuku at night, after VALORANT's Split): versus + S&D, Heavens, Sewers, 4 climbing ropes (bots climb them); grinjuku-layout.js is the single source for colliders and the Blender build. Tests: map-walk, rope-test.
- **2026-10-06/07** Dust Bowl bazaar redesign, phases 1-5: the city outside the wall, carpet-shop and loading-dock high spots, the minaret plaza, shops and awnings, channel crossings, wires, laundry, smoke.
- **2026-10-06** game.js split (phases 0-5h): 16,712 -> 2,970 lines into core/ input/ view/ combat/ modes/ streaks/ menu/ (modules reach game.js through `game.X`, core/state.js); the pre-push gate tools/troll-ops-gate.mjs with linkcheck, input, menu, objectives and killcam steps. Also: bot host = the oldest LIVE client.
- **2026-10-05** Gloves removed; Rolex wristwear and the Pour up emote; BO2 medal art (placeholders, `MEDAL_ART_V`); Soul Blazer hellfire shotgun; Trolling Loud's 119-NPC Socialize crowd; Zombies ZR4 (one atlas mesh per zombie, head pops, blood, zombie voices); one map per room; DJ Lulz song requests.
- **2026-10-04** Roleplay 2a (seats, pianist, doctor); saloon bar and townsfolk; Socialize mode + owner switch; service worker; stuck-bot fixes; Trolling Loud; Troll City + Peacemakers + Knuckle Grinners; Cops and Robbers phase 0.
- **2026-10-03 and about 10-03/04** One map per room; Prestige 1-5; U Mad Bro? 1-2 + Knight; BO2 stick look; hitbox lab; match intro; BO2 killcam; Halo Blade; Hollowgrin Halloween map.
- **2026-10-02** BO2 Zombies menu over the troll-map planet; zombie redesign ZR1-3; Hollowgrin 6a-6h; realism pass; map passes 3-5; view mode; Grin Beach palms; VTOL mobile fix.
- **2026-10-01** The Grinleria; Hollowgrin and Undergrin expansions; bot streaks 2-3; map passes 1-2; THE BEAST, Hyuck Colt LMG, Ghost Glass.
- **2026-09-30** Fix lists fx1-fx3; bot streaks 1; 100-troll Royale + crowd LOD; Royale late join; XP cut; daily login XP.
- **2026-09-29** Trollface Island Royale + sky lobby, bus, glider; Chainsaw, Reaper's Grin; K9, VTOL Warship, Swarm, Counter-UAV; HUD layout editor.
- **2026-09-28** Troll Royale 1-2; Trollsaber; Green Candles redesign; Grinmington 870; BO2 medals; HUD cleanup; Trolls vs Jeets.
- **2026-09-27 and earlier** PF arms and feel; duo/1P/3P emotes; match chat and profiles; Vice Grin; Hollowgrin + multi-map zombies; emote wheel; two-hand hold; the "Troll Forces" rename; BO2 streak overhaul; graphics tiers; inspects; light pool; touch HUD; skin editor; Infection; third-person camera; the 6 PvP maps; Pentagrin zombies.
