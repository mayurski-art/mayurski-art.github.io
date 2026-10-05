<!-- The approved build plan for the Cops and Robbers mode. Player-facing design doc: https://claude.ai/artifact/D1n9QkSTibBhGSik7hx1mW (private to the owner). -->

# Cops and Robbers: co-op heist mode on Trolling Loud

## Context
The user wants a co-op game exclusive to the Trolling Loud map, called **Cops and Robbers**, with police officers and nightclub bouncers modelled like the zombies and the Hollowgrin priest and beggar. They asked for more thinking and planning before any building, then added HUD requirements for an objective tracker. This plan folds in four code research passes (bodies, networking and modes, bot AI, HUD layout) and one design review. Nothing is built yet.

User-facing design doc (v2, private): https://claude.ai/artifact/D1n9QkSTibBhGSik7hx1mW. Source: session scratchpad `cops-and-robbers.html`.

All paths below are under `tf-club-wt/assets/games/troll-ops/` (worktree `C:\Users\mayur\OneDrive\Documents\GitHub\tf-club-wt`, branch `tf-nightclub`). The main checkout stays untouched.

## Decisions
**Locked by the user**
- Players are the robbers; every cop is AI. 1-4 players.
- Bouncers are first-line guards; stealth is possible before the alarm.
- Full police roster, escalating: patrol, riot shield, K9 handler, detective, SWAT, sniper, helicopter.
- Bodies in the style of the zombies and the Hollowgrin mannequins.
- An objective tracker, Call of Duty style (spec below). **It is for Cops and Robbers only.**

**My defaults (stand unless the user changes them)**
- Police go down like any enemy. Before the alarm, a bouncer hit from behind is knocked out silently.
- Rewards: match XP plus a weekly leaderboard for biggest take. No cash shop (browser-saved cash is editable).
- Difficulty scales with crew size, plus a Normal / Hard / Mayhem picker.
- "Mask up" pulls on the existing bandana cosmetic and makes the heist live.
- Clubbers: a beat-bouncing crowd during casing, gone in the blackout. Built last.
- Solo: one second wind (auto-revive once), then the next time down is a bust.
- **Menu (user, 2026-10-04):** a new "Co-op" row on the main screen directly BELOW Public Match and ABOVE Socialize (Socialize is the hangout room on branch troll-forces-socialize, itself under Public Match). Inside: Quick join (a public crew of up to 4), Private crew (room code), Solo. Hidden until the mode unhides.

## The objective tracker (user's spec)
Scope: only when `isHeist()`. No other mode's HUD changes.

**First appearance: centre, then fly to the left**
- A new objective appears centred horizontally, slightly above the middle:
  - desktop: 28% of screen height (the free band is 19-39%, between the streak banner and the "+100" XP pops at 41%)
  - landscape phone: 18% (free band 10-25%)
- Content: a small gold caption "NEW OBJECTIVE", the objective text in large Oswald, and an optional hint line.
- It never overlaps other text:
  - All heist announcements go through one queue, so two never show at once.
  - It waits for the pre-match countdown (`#to-staging`, 26-42%) to finish.
  - Before showing, it measures the on-screen boxes of anything visible in the band (`#to-ks-banner`, `#to-xp-pops`, `#to-streak-mark`, `#to-bomb-status`, `#to-spawnguard`, `#hud-wave-banner`). It shifts to the nearest clear slot inside the band, or waits up to 1.5 s.
  - The mode sets `noStreaks`, so the streak banner never fires here.
- It holds about 1.8 s, then moves and shrinks onto the tracker's headline on the left over about 0.55 s. The panel edge flashes gold and a sound plays.
- When an objective completes, the old headline ticks green and drops into the checklist before the next one flies in.
- `prefers-reduced-motion`: no travel, just a fade out at centre and a fade in on the panel.
- The game has no centre-to-corner animation today, so this is new: measure both boxes, then animate a transform (FLIP).

**The persistent panel (desktop and gamepad)**
- Position: left 18 px, top 244 px (under the minimap), 300 px wide, down to about 49% of the height. Below that is chat and the streak strip.
- Contents: caption, headline, hint or progress bar (drill time, bags, countdowns), the checklist, optional loot with cash values.
- It folds to headline-only a few seconds after the last change. The scoreboard key shows the full list.
- Style matches the HUD: panel `rgba(6,9,7,.55)` with a 1 px `rgba(255,255,255,.12)` border, gold `#ffdf6b`, Oswald / DM Sans / DM Mono.
- Added to the player-draggable HUD list (`hud-layout.js:13-20`).

**Mobile: a task button instead of the panel**
- A round 44 px button with a checklist icon, to the right of the minimap (top 8, left about `sl + 20 + 96k`). That spot is free in this mode.
- Style copied from the touch buttons (`style.css:2623-2633`); icon is an inline SVG (24 viewBox, stroke 2), not a canvas (`.to-cabinet canvas` stretches canvases).
- The centre intro flies into the button. The button pulses and shows a gold dot until opened.
- A one-line headline shows beside the button for a few seconds after each change.
- Tap opens a sheet with the headline and checklist; it closes on a tap outside or after 5 s.
- The pause menu gets an Objectives tab as well.

**Objective markers**
- A diamond with distance on the current objective, drawn through walls, sliding to the screen edge with an arrow when it's off-screen.
- DOM elements projected each frame (projection as at `game.js:2850`).

All tracker DOM is appended to `els.hud` (`#to-hud`), which already hides its children during the killcam and intro. Interactive parts need `pointer-events: auto`.

## Match design (summary; full version in the design doc)
- **Flow:** casing (unmasked, hands empty) → mask up → alarm (blackout, emergency red) → police by wanted level, in a 70 s assault / 25 s lull rhythm → escape.
- **Wanted level:** five stars on a timer from the alarm (+0:15, +1:30, +3:30, +5:30, +8:00), each adding types. Police alive at once: 4-8 solo, 8-14 for four players, 8 on phones.
- **Objectives:** reach the manager's office (upper floor), drill the safe (hold F; 90 s, jams twice), bag the loot, move bags to the getaway, escape.
- **Optional loot:** VIP cash, the DJ's chain, bar tills.
- **Map features already there:**
  - safe at (-16, -21.2) upstairs (`trollingloud.js:950`)
  - office window over the VIP lounge
  - terrace over the south alley (the bag-throw route)
  - vans in the alley (`:1125`), tour bus in the yard (`:1147`)
  - sound booth, which becomes the alarm panel
- **Going down:** downed (30 s bleedout, teammate holds F for 3 s) → custody (bail after 45 s, costs 10% of the take, shown as a timer card) → busted when everyone is out.

## Architecture (what the research settled)
**The mode is a team mode with one all-AI side**
- Entry: `{ id: "heist", pvp: true, ffa: false, heist: true, forceMap: "trollingloud", hidden: true, noStreaks: true }`.
- This reuses rooms, loading sync, staging, the bot host and hit reporting. It needs about 15 guarded hooks; opening the roughly 25 `isPvp()` gates for a `pvp:false` mode would be more.
- Zombies is offline single-player (`game.js:10649-10670`), so it isn't the base.
- Hook sites that assume symmetric PvP and need a heist branch:
  - teams: `net.setTeam("phantom")` instead of `chooseTeam` (`game.js:10665`)
  - bot fill: three sites (`game.js:11199`, `12510`, `12581`)
  - spawns: robbers spawn in the south alley (`game.js:8908`, `11103`)
  - death, respawn, killcam (`game.js:11926-11974`, `12648`)
  - HUD team chips and intro lines (`game.js:11163`, `10953`, `10974`); scoreboard (`game.js:6621`)
  - kill payouts, medals, weapon drops (`game.js:4943-5008`)
  - `endMatch` reporting: results must not reach the PvP ladder (`game.js:11594-11608`)
  - the intermission vote (`game.js:11643`, `11723`)
  - the interact key and touch button, which are S&D-only today (`game.js:6560`, `13245`, `11171`)

**Police are bots**
- Bots run on the host and are already synced to every client as remote players (`net.js:497-555`), including a body id (`hr`).
- New `BotManager.spawn({team, x, y, z, profile})` and `remove(id)` in `bots.js` (after `:1118`).
- A profile sets hp, armor, a copy of the difficulty row, weapon, body id and grenade counts. Spawning upstairs needs `groundY` set (today y is forced to 0).
- Spawn police as "regular" skill, so the veteran XP boost doesn't apply (`game.js:3753`).
- Give bots no frags near objectives: they would frag any two players standing together (`bots.js:776`).

**Director and state**
- `heist-core.js`: pure, no imports. Phases, objectives, stars, assault/lull, drill, bags, and a `merge()` for network state. Testable in plain Node; the pacing tool runs on it.
- `heist.js`: the host-side director. Spawns police out of sight at map entry points, cleans up corpses, drives the map mood.
- Network: one new `heist` message (`net.js:249`), following S&D's split (`net.js:376-383`): the acting player owns hold-F progress, events are idempotent, and a host snapshot reconciles.
- Downed is a stance: send `"down"` in the existing stance field and add it to `STANCE_LOWER` (`remote-players.js:186`). Keep `player.alive` true while downed, because dead remote players vanish after about 9 s.
- The mask is the existing bandana face key.
- Host loss: the new host adopts the old bots' last positions, then continues from the mirrored heist state. A hidden host tab should hand over hosting.

**Stealth needs no perception changes in bots.js**
- Before the alarm only bouncers exist. They get `targets: []`, so they fall to the hold-a-post branch (`bots.js:499-509`).
- One small change: honour `objective.yaw` so a posted bouncer faces a direction.
- The sight cone, suspicion meter and noise live in `heist-ai.js` on the host. Gunshot noise and the suppressor flag are already observable (`game.js:5309`).
- Casing needs an unarmed hold (`remote-players.js:604`, `game.js:8830`).

**Type simplifications that keep the player-facing result**
- Sniper: a rooted bot; the director fires his shots and the laser is drawn from heist state. Bot aim pitch isn't sent over the wire, and bot fire range is 38 m.
- Helicopter: searchlight, presentation and outdoor pressure. It doesn't shoot. Only one pooled spotlight exists.
- K9: the handler bot owns the pack, so the dogs attack robbers and stop when he's removed (`game.js:2949-2959`).
- Riot shield: a hit resolver at `game.js:7657`, starting from the keyboard sword's block.

**Map**
- `trollingloud.js` gains `heistLayout()` beside `zombieLayout()` (`:1622`): bouncer posts and routes, public and staff zones, loot, safe, alarm panel, police entry points per floor, escape zones, cruiser spots.
- It also gains `setMood("club" | "blackout" | "alarm" | "assault")`. Moods change colours and uniforms only (`S.kill` `:1371`, `L.base` `:1365`, a `uPower` uniform in the kit). The light count never changes.
- The map's own synth swaps patterns per phase (`scheduleTrack`, `:1499`).

## Bodies
**Approach: fit the skeleton to the body, then copy rotations**
- The bots' stick-figure rig has both arms leaving one centre point and both legs leaving one hip point. A realistic body can't follow that as it is.
- `fitRig(rig, measurements)` in `character.js` rewrites the rig's joint offsets, limb lengths and hit proxies to a real body's proportions. The rig's own arm and leg solvers then work with real lengths.
- Four guarded reads make the rig respect the fit: shoulder x (forced to 0 each frame, `:1085`), the gun stock pocket (`:1355-1363`), ankle height (`:993`), lie height (`:1744`).
- `cop-bodies.js` copies joint rotations onto the skinned body's bones each frame (pelvis, spine 1-3, neck, head, upper and lower arms, hands, thighs, calves, feet). No IK. Rest offsets are computed once at load.
- The copy runs after all posing, at the end of `RemotePlayers.update` (`remote-players.js:729-737`).
- The head hitbox shrinks from 0.255 to about 0.12 radius for police.
- Proportions are set in Blender; bone scale doesn't survive glTF export.

**Scope**
- About five skinned bodies: officer (man), officer (woman), bouncer, suit (head bouncer and detective), tactical (SWAT, riot, sniper).
- Kit is rigid pieces on the rig's joints, through the existing hero-bodies path: cap, helmet and visor, gas mask, vest, belt, shield.
- Budget: about 12k triangles and 1 MB per body, one texture each. No more than about 12 skinned police alive, the same as zombies.
- Builder: `models/build_cops.blender.py`, forked from the zombie builder, with no clips, emitting rest measurements.

**Fallback if the proof fails:** rigid armour pieces on the existing rig (the Knight's method, `hero-bodies.js:24`). No runtime work; the roster leans armoured.

## Files
- **New:** `heist-core.js`, `heist.js`, `heist-ai.js`, `heist-hud.js`, `cop-bodies.js`, `cop-lab.html`, `models/build_cops.blender.py`, `COPS-AND-ROBBERS.md` (the design and these findings, for future sessions).
- **Thin hooks:** `game.js`, `bots.js`, `net.js`, `modes.js`, `character.js`, `remote-players.js`, `menu-bo2.js`, `hud-layout.js`, `style.css`, `trollingloud.js`, `leaderboard.js`.
- **Tools:** `tools/troll-ops-cop-body-test.mjs`, `tools/troll-ops-heist-test.mjs`, a Node test for `heist-core.js`, later a pacing tool.
- Heist modules load by dynamic import at match start with dependencies passed in, so `character.js` isn't loaded twice under different cache-bust tags.
- Another session is editing `game.js`, `bots.js` and `net.js` on main. Hooks stay small, and I merge main often.

## Phases
Each phase merges to main behind the `hidden` flag when its tests pass. A `?heist=1` switch reveals the mode for testing.

**Before phase 0** (blocked while in plan mode)
- Publish design doc v3 with the tracker's centre-then-left animation, the mobile task button and the research corrections.
- Write `COPS-AND-ROBBERS.md`, a short HANDOFF pointer and the memory note.

**Phase 0: body proof**
1. `build_cops.blender.py`: one patrol officer; send the user renders.
2. `character.js`: `fitRig` and the four guarded reads.
3. `cop-bodies.js`: apply and sync; hide the stick body, head board and mitts.
4. `cop-lab.html`: the officer holding real guns, with pose sliders.
5. `troll-ops-cop-body-test.mjs`: sweep run, strafe, crouch, aim pitch, reload and both deaths. Assert no NaN, bone error under 1 cm, hand to grip under 2 cm, feet within 2 cm of the ground.
6. In game on a range bot; run the third-person hold test and a 12-cop frame-rate check.
7. Screenshots to the user for a yes or no before any other body.

**Phase 1: solo heist**
1. `modes.js` entry, `isHeist()`, the `?heist=1` reveal.
2. `heist-core.js` plus its Node test.
3. `heistLayout()`; extend the map test so every point is on a floor and reachable.
4. `BotManager.spawn` / `remove`; run the bot stair test on this map (bots have never been tested on its three floors).
5. The `game.js` hooks listed above; a `__trollOps.heist` test hook.
6. `heist.js`: the star-driven spawner with patrol police.
7. `heist-hud.js`: the tracker (centre intro, fly to the left, panel, mobile button), markers, stars, drill bar on the existing hold-F prompt.
8. Drill, bags (carry, throw), van escape, "Heist complete" and "Busted" screens through `finishRun`.
9. The alarm trips on mask-up for now.

**Phase 2: co-op.** Rooms capped at 4, the `heist` message and merge, downed / revive / custody, host adopt and hand-over. Tested with two tabs.

**Phase 3: bouncers and stealth.** Bouncer bodies, posts and routes, cone and suspicion, knockouts, noise, casing rules, the alarm panel, the keycard.

**Phase 4: the full roster.** Profiles per type, shield, K9, detective mark, SWAT, sniper, helicopter, cruisers, the pacing tool.

**Phase 5: atmosphere and launch.** Moods, music patterns, sounds, the crowd, the leaderboard branch, medals, the menu entry, a phone pass, unhide.

Rough size: 12 work sessions. The mode is playable solo after phase 1.

## Verification
- **Phase 0:** the cop-body test passes; lab and in-game screenshots look right against the zombie and mannequin quality bar; 12 police hold the frame rate of the 12-zombie check.
- **Phase 1:** `troll-ops-heist-test.mjs` asserts:
  - no robber-side bots; police count follows the stars
  - a lethal hit gives downed, never a respawn
  - the drill jams twice; bags to the van reach the end screen
  - a stubbed leaderboard never receives `pvp: true`
  - the light count stays constant
- **Tracker checks** (in the Browser pane, using measured boxes, not eyeballing):
  - the intro's box doesn't intersect any other visible HUD text, on desktop and at phone size
  - the intro ends on the panel headline's box
  - at phone size the button sits clear of the minimap and the move zone
- **Regression:** the Trolling Loud map test, the zombie test, the bot stair test and a versus match still pass after each hook lands.
- **After each push:** curl the live `?v=` tag (Pages deploys can stall).
