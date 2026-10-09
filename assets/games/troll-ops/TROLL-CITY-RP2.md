# Troll City roleplay, phase 2b-2d: sheriff, merchant + horses, conductor

APPROVED by the user 2026-10-09. Socialize mode, Troll City only. Builds on phase 2a (seats, pianist, doctor, `modes/social-rp.js`). Worktree `.claude/worktrees/tf-parallel`, branch `worktree-tf-parallel`.

## Context

The user lifted the hold on Troll City RP phase 2 on 2026-10-09 and picked the big options: horses you can **ride**, and a **real moving train** with riders synced. The survey found the game already has more than HANDOFF.md says:

- The **Grin Express** already runs a 641 m loop and you can ride it (`train.js`, `modes/social-train.js`, test `tools/troll-ops-train-test.mjs`). Nothing goes over the wire: every client places the train from its own `Date.now()`, so 1 s of device skew puts a rider 8 m from where others see them (HANDOFF known limit). 2d is a conductor job on top of this plus a shared clock, not a train build.
- The **jail already locks** (`modes/social-duel.js` `jailMe`, `rp.jail().cells[i].setShut`). Two bugs to fix on the way: a prisoner can free themselves by walking to the back of the cell (the "walked off" check at `social-duel.js:256` is 3.4 m in z, the cell is 4.35 m deep), and any peer can open/shut any cell (`:514` has no sender check); late joiners never see shut doors.
- **Horses are static boxes** merged into the map mesh (`trollcity-kit.js:941-988`). Riding is the one truly new system: own-group horses, a walk/trot/gallop animation, a wider collision footprint, a riding pose for you and for remote riders, claim rules.

Pattern to follow (2a): jobs in `rp-roles.js` `ROLES` (wire letters are already reserved in `net.js:21` `RP_ROLES`: `s` sheriff, `m` merchant, `h` horsekeeper, `c` conductor), spots in `trollcity.js` `rp.*`, logic in `modes/social-rp.js` (NOT game.js, HANDOFF is stale there), hold-X actions via `rpExtras`, role-gated messages like `cure`, the NPC yields via `ROLES[r].npc` + `TownNpcs.setYield`. New code in its own module per system (`modes/social-sheriff.js`, `modes/social-horses.js`, `modes/social-conductor.js`), game.js only gets hooks (CLAUDE.md rule 8).

User decisions (2026-10-09, AskUserQuestion):
- **Cuffing.** A PLAYER sheriff walks up and cuffs you; you're leashed behind them to the cells. When the sheriff is the NPC (nobody holds the badge, today's fist-fight refusal), you get a cuffs-on animation and a seamless transition to waking up in the cell, instead of today's teleport.
- **Griefing guard.** troll_runner can't be cuffed; after release a player can't be cuffed again for 2 min; a sentence is 60 s max.
- **Riding** in both first person (horse's head ahead, hands on reins) and third person (rider on the horse). No forced view switch.
- **Conductor** can hold the train up to 20 s at the station (once per stop), pull the whistle, punch tickets; the timetable otherwise runs on a shared room clock.
- Horses fully rideable; the train real and synced for everyone (earlier today).

Order of build: **2d (clock + conductor, smallest, fixes a live bug) → 2b (sheriff) → 2c (horses, then merchant)**. Each phase: targeted test, one gate, push (no videos).

---

## 0. Shared groundwork (first commit, ~1 h)

- **`modes/room-clock.js`** (new): lift the DJ's clock sync out of `dj-lulz.js:46-131` into a map-independent module. `roomNow()` = `Date.now() + skew`; the room's oldest real peer (same keeper rule: `since`, lower id on a tie, not in your first 1.5 s) broadcasts `{k:"clock", rn, tro}` every 2 s in ANY Socialize room (`tro` = the train hold offset, see 2d); clients keep the max of their last 12 `rn - Date.now()` samples. `dj-lulz.js` keeps its own `rn` in `djstate` (unchanged behaviour on Trolling Loud) but reads skew from room-clock; `club-entry.js:805`'s `roomNow()` shim switches to the import. Today in Troll City `game.djLulz.roomNow()` is `Date.now()` + a stale skew (DJ messages never arrive there: `dj-lulz.js:120` returns early without a `map.dj`).
- **rp message routing.** `social-rp.js:558` forwards only `k:"duel"` to `rpListeners`, despite the comment at `:93`. Change to: forward every `k` not handled inline (`bell/mug/mugtake/pn/cure/offer/take/give`) to the listeners, and let `to`-addressed ones through to them too. All new kinds (`sheriff`, `horse`, `train`, `shop`) ride this. Never put an `id` key in a payload (`net.js:685` spreads the payload after the sender id).
- **Roles.** `rp-roles.js` `ROLES` gains `sheriff {s, "Sheriff", npc:"Sheriff"}`, `merchant {m, "Merchant", npc:"Merchant"}`, `horsekeeper {h, "Horsekeeper", npc:"Horsekeeper"}`, `conductor {c, "Conductor", npc:"Conductor"}`. `net.js:21` already maps the letters; `updateRp` (`social-rp.js:491-501`) then hides Sheriff Grimes, Mr. Kek, Hay Jay and Conductor Choo via `setYield` with no other change. Deputy Doofus stays at his desk reading.
- **Late-joiner state** rule for this phase: anything that must survive a join lives in the holder's 15 Hz state packet (new short keys below), never only in a one-off `rp` message.

New state-packet keys (free per the survey: `hs hg ho mt` plus these unused ones): `cf` cuffed (0/1, +2 bit = leashed), `jl` jail cell+1 (0 free), `ho` horse id+1, `hg` gait, `tk` conductor flags. Three edits each: `game.js:2102-2142` snapshot, `net.js:513` send, `net.js:301-350` parse.

---

## 2d. Conductor + the synced train (~3-4 h)

### Why first
It's the smallest job and it fixes a live bug: every client places the Grin Express from its own `Date.now()` (`modes/social-train.js:30`), so 1 s of device skew = 8 m between where two players see a rider.

### The train on the room clock
- `social-train.js:30`: `tr.update(roomNow()/1000 + tro)` where `tro` is the shared hold offset (seconds, from room-clock). Everyone now agrees on the train's `s` to within one network hop.
- **Remote riders drawn on the train, not 110 ms behind it.** New state key `tc` = car index+1 while `tr.aboard` (0 otherwise). In `remote-players.js` after interpolation (`:598-616`): if `p.tc`, shift the drawn position by the car's motion over the last `RENDER_DELAY` (`car.pose` now vs. the pose `Train.place` kept from 110 ms ago: add `car.prevPose` + timestamp in `train.js:97-121`), and clamp the rider onto that car's deck (`Train.carAt`/`toLocal`). Riders stop drifting off the back of the car at 8 m/s.
- Keeps `train-test`'s guarantees; add a 2-tab check (below).

### The job
- **Take it:** a conductor's cap on a hook by the station door, `trollcity.js` station building (x -10..4, z -45..-38.6): hook at (−3.2, y 1.9, −38.62) on the south wall facing the platform. Hold X 0.6 s = take the job / put the cap back (the doctor's-bag pattern, `social-rp.js:444-454`). Conductor Choo yields.
- **The cap:** worn while you hold the job: a navy pillbox cap with a brass band, built in `cosmetics.js`-style on the rig's head (the outfit rule is hats/shades only, so a hat is fine). Local rig + remote rigs from `rr === "c"`. A ticket punch in the right hand (small brass tool) while aboard.
- **All aboard + hold (once per stop):** on the platform or aboard while the train stands (`state.v === 0` and `leaveIn > 0`): hold X 0.4 s → "All aboard!" banner for everyone, the bell rings, and the train waits up to 20 s more: `publishRp({k:"train", e:"hold", secs:20})` → every client (keeper included) does `tro -= secs` (the timetable slides later); the keeper's next `clock` message carries the new `tro`, so late joiners get it. One hold per stop: the hold is refused while `leaveIn` already reflects one (track `holdAt` = the stop's departure `s`).
- **Whistle:** in the loco cab (deck: local x 2.3..4.35) hold X 0.3 s → `{k:"train", e:"whistle"}`; every client plays `whistle()` from `social-train.js:64-75` positioned at the loco (`audio._tone({at})`). Rate-limited to one per 4 s.
- **Tickets:** aboard, hold X 0.8 s at a rider within 2 m → `{k:"train", e:"punch", to}`; the rider's client shows "Ticket punched · Grin Express" and a small punch sound; the conductor's right arm does a punch-and-return pose (`reachHand` toward the rider's chest, like `poseDrinkArm` `saloon-bar.js:126`). Pure show.
- **Pose while conductor and aboard:** standing with the punch in hand, left hand on a waist rail (reach to the nearest rail point).
- **Role gate:** `hold`, `whistle`, `punch` are honoured only if the sender's `p.role === "conductor"` (the `cure` pattern, `social-rp.js:561-567`).

### Files
`modes/room-clock.js` (new), `modes/social-conductor.js` (new: job, actions, cap, punch, hold/whistle/ticket messages, poses, `window.__trollConductor` hooks), `modes/social-train.js` (room clock + `tro`), `train.js` (`prevPose`, car index on `carAt`), `remote-players.js` (`tc` correction), `trollcity.js` (cap hook prop, `rp.conductor` spot), `rp-roles.js`, `net.js`, `game.js` (snapshot + init hook), `dj-lulz.js`/`club-entry.js` (clock import).

### Test: `tools/troll-ops-conductor-test.mjs` (2 tabs, Supabase blocked)
A takes the cap (Choo hidden on both tabs, B sees `rr:"c"` + the cap mesh); with the train standing A holds → both tabs' `leaveIn` grows by 20 and `tro` matches; a second hold is refused; A whistles from the cab → B's audio hook fires; A punches B → B's chip; both ride: with B's clock skewed 1.5 s (`Date.now` patched in B's init script) the train's `s` on both tabs agrees within 0.2 s because the keeper's `rn` wins, and B sees A on the deck (A's drawn position within 0.6 m of car-local truth while moving). Existing `train-test` still passes.

---

## 2b. Sheriff + jail (~5-6 h)

### Today's jail, fixed on the way
- **Walk-out bug:** `social-duel.js:256` frees you if you're > 3.4 m in z from the drop spot (`door.c = zc+1.2`); cells run to `zc−3.15` (4.35 m), so pressing D at the back of any cell ends the sentence. Fix: the "moved by something else" test becomes "outside the cell's real box" (x 51.3..55.9, z zc±3.3, y within 1.5).
- **Doors on the wire:** `{e:"jail"}` has no sender check and no replay (`:514`). Replace with **derived doors**: your state packet carries `jl` (cell+1 while jailed). Every client shuts cell i while anyone's `jl` (yours or a peer's) names it, opens it when nobody's does. No message, no late-joiner gap, no spoofing; a peer leaving (`net.js:470`) clears their doors by construction. `jailMe`/`freeMe` just set/clear `duel.jail`; the `{e:"jail"}` send and the `:514` branch go.
- Jail logic moves into **`modes/social-jail.js`** (new): `jailPlayer(ci, secs, why, by)`, `updateJail(dt)`, `jailedCell()`, the chip, the door derivation; `social-duel.js` calls it. Cell pick: a free cell first (nobody's `jl` on it), random if all full.

### The badge
- Take it: hold X 0.6 s at the badge on the desk (`trollcity.js:1230`, (47.8, Y+0.8, −6.1)) → `bar.role = "sheriff"`, the desk badge hides (`userData` toggle on its own small mesh: pull that one box out of the merged kit into its own Mesh), Sheriff Grimes yields. Hold again at the desk to put it down. One sheriff at a time (older peer wins, `otherWithRole`).
- Worn: a brass star on the left chest of the local rig and of remote rigs with `rr:"s"` (`rig.parts.chest.add`, like the drink mount `saloon-bar.js:250-254`; mark `userData.shared` so `dispose` leaves the geometry alone). Name tag already shows "Sheriff".

### Cuffing (player sheriff)
- Hold X 1.0 s at a player within 2 m (`rpNearestPlayer`) → `{k:"sheriff", e:"cuff", to}`. The target's client accepts only if `p.role === "sheriff"`, the target isn't the owner (`isOwner`), isn't already cuffed/jailed, and `cuffCooldownUntil < now`. Then `cuffed = { by, until: now+30 }`:
  - hands behind the back (3P: both arms rotated back, wrists together behind the hips via `reachHand` to a hip-space target; FP: `socialArmsFrame` returns no hands), no emotes, no hold-X, no jump, no sprint, a "Cuffed by <name>" chip with the seconds.
  - **Leashed:** each frame the cuffed client steers itself toward the sheriff's drawn position: if dist > 1.4 m, `move.update` with `forward` = 1 toward the sheriff and `yaw` facing them, `speedMult` 1 (the sheriff walks, you keep up), else idle. The player's own inputs are ignored (the club line's `clubHold` pattern, `view/player-update.js:178`: a `cuffHold(dt)` branch before `move.update`). Client-authoritative, so no one is moved by force; your client moves you.
  - Release: 30 s up, the sheriff puts the badge down, the sheriff leaves (peer gone), or the sheriff holds X at you again (uncuff, 0.6 s). Sets `cuffCooldownUntil = now + 120`.
- **Into a cell:** sheriff with a leashed player within 3 m of a cell door holds X 0.8 s at the door → `{k:"sheriff", e:"jail", to, c, secs:60}` → the target's client runs `jailPlayer(c, 60, "Sheriff <name> locks you up.", by)`: walked in (1 s scripted walk through the door like the club's `walkTo`), door shuts behind (derived from `jl`), cuffs off. The sheriff's arm reaches to the door (0.6 s "lock" pose), a lock-click sound from `audio._tone` at the door.
- Sentence max 60 s; a jailed player can't be cuffed again for 2 min after.

### Cuffing (NPC sheriff: the fist-fight refusal, today's `jailMe`)
Replaces the teleport with a short cinematic, reusing the club kick-out machinery (`view/club-entry-cine.js`: letterbox `.club-cine-on`, captions, `placeClubCine(camera)` camera pattern; `modes/club-entry.js:473-552` `startKick`/`kickCues` as the timeline model):
1. Sheriff Grimes walks in from behind your camera (`townNpcs.takeOver(i)` on his index; on remote clients the same takeover from a `{k:"sheriff", e:"npc", n, x, z}` message like the duel's `start` so others see Grimes come for you; otherwise they only see your `cf` pose then `jl`).
2. 3P close on you: your arms go behind your back, Grimes's mitts meet your wrists, a cuff click (two short metallic `_tone`s). Caption: "Sheriff Grimes: \"<why>\"". ~1.8 s.
3. Fade to black 0.5 s (a `.club-cine` full-screen div opacity, new `fade` helper in `club-entry-cine.js`), then cut to 1P lying on the cot (`poseCurbSit`-style: eye at cot height, lying), 0.8 s, then you stand (eye eases up). Caption: "That's a minute in the cells, partner." Door shut (your `jl` is set at the cut).
4. Control back. Total ~4 s. The duel test's timings (`__trollDuelTune`) get a `cineRate` so it can run fast.
Grimes is released and walks back to his post.

### Wanted board
- Three dedicated planes (not the shared `M.wanted` materials, which the gun shop and saloon reuse: `trollcity.js:808,811,967-968`), each its own `CanvasTexture` drawn by a new `wantedPoster({name, crime, reward})` beside `wantedTexture` (`trollcity-kit.js:470-514`): the trollface art in the photo box (never the emoji), the player's name, a crime from a list of 12 ("Horse theft", "Ratio'd the mayor", …), a reward. No PFPs: other players' avatar URLs aren't on the wire and need Supabase (`profile-card.js:85-103`); skip.
- Sheriff holds X 0.6 s at the board (43.45, −9.67) → a small panel (the DJ request panel's styling) listing players in the room; pick one (or "Tear down") → the sheriff's state packet carries `wl`: up to 3 `[shortId, crimeIdx]` pairs (peer ids are short strings; cap at 3 × ~12 chars). Every client repaints the posters from the sheriff's `wl`; a wanted player gets a chip "You're wanted · $<reward>". Jailing a wanted player clears their poster. Putting the badge down clears the board. (In the holder's packet → late joiners see it.)

### Files
`modes/social-jail.js` (new), `modes/social-sheriff.js` (new: badge, cuff/leash/jail actions and messages, poses, board panel, hooks `window.__trollSheriff`), `modes/social-duel.js` (use social-jail, the NPC cuff cine), `view/club-entry-cine.js` (`fade`, a generic caption/letterbox entry point), `trollcity.js` (badge as its own mesh, board planes, `rp.sheriff` spots: desk, board, cell doors), `trollcity-kit.js` (`wantedPoster`), `view/player-update.js` (`cuffHold`), `view/fp-emote.js` (no hands when cuffed), `view/third-person.js` (cuffed arms hook), `remote-players.js` (`cf` pose, badge, `jl`), `rp-roles.js`, `net.js`, `game.js`.

### Test: `tools/troll-ops-sheriff-test.mjs` (2 tabs)
A takes the badge (Grimes hidden on both; B sees the star); A cuffs B (B's `cf`, hands-behind pose on A's tab, B's inputs ignored, B follows A within 2 m over a 10 m walk); A locks B in cell 1 (B's `jl`=2, door shut on BOTH tabs, B held in by walking W and D for 2 s: still in the box); a third tab C joins mid-sentence and sees the door shut; B freed at 4 s (tuned), cooldown refuses a second cuff; owner tab can't be cuffed; wanted: A posts B, B's chip, C's board shows B's name; badge down clears it. Duel test: refusal → cine runs (letterbox on, caption, fade, wake on the cot) → in a cell, and the walk-out bug check (D at the back of the cell for 3 s: still jailed). Existing `duel-test`, `rp-test` pass.

---

## 2c. Horses + merchant (~9-11 h)

### The merchant (Kek & Sons, ~2 h)
No currency exists anywhere in the game (searched), and the user hasn't asked for one, so the shop is roleplay: the merchant hands goods out, nobody pays.
- **Take the job:** hold X 0.6 s at the brass till on the counter (`trollcity.js` `counter()`, till at x −32.4, z −18.0; the scale overlaps it today: move the scale to x −35.0 on the same counter). Mr. Kek yields. Hold again to put it down.
- **Goods** (three, all carried in the hand the way a drink is, reusing the drink system's hold/wire: `saloon-bar.js` `bar.drink {kind, sips}`, `dk` on the wire, `poseDrinkArm`, `syncFpDrink`; new kinds beside beer/whiskey):
  - **Canteen** (`kind:"canteen"`, 6 sips, no tipsy): a tin canteen on a strap. From the shelf behind the counter.
  - **Apple** (`kind:"apple"`, 1 "sip" = a bite, or feed it to a horse: ties into 2c horses, feeding tames an unsaddled horse for the horsekeeper and makes a horse yours to whistle). From the apple barrel by the door, self-serve.
  - **Stetson** (a hat, not a drink): `outfits.js:246` `wearOutfit` knows cap/beanie/bucket only; add `stetson` (brim + crown, two boxes, in the trollcity hide/leather colours) and wear it on the local rig and remote rigs from a new state key `mt` (1 = stetson, room for 2-3 more hats later). Session-only like the club band. From the hat stand on the counter.
- **Who hands what:** canteen and stetson only from the merchant (hold X at the customer within 2 m, 0.5 s, the bar's `give` message pattern `social-rp.js:153` → `{k:"shop", e:"give", to, what}`; the target's client accepts only from `p.role === "merchant"`); the apple barrel is self-serve by anyone. So a merchant on duty matters, and nobody's stuck when there isn't one (apples still work; the hat and canteen are perks of a staffed shop).
- **Merchant acts:** weighing (hold X at the scale 0.8 s: the pans tip, a "count/tend" arm pose from `town-npcs.js:312-318`), ringing the till (hold X at the till while on duty: a drawer slide + bell `_tone`). Both for show.
- **Test:** in `troll-ops-horse-test.mjs` section 0 (same map, same tabs): A takes the job (Kek hidden on both), gives B a stetson (B's `mt`=1, hat mesh on B's rig on A's tab), B takes an apple from the barrel (`dk` apple), B can't take a canteen without the merchant, A hands one over.

### Horses (~16 h, the big one)

**Which horses.** Six become rideable, with stable ids on the wire (`ho` = id+1): the three saddled hitch-rail horses (black (−18.8,−4.35), bay (−17.4,−4.4), white (−9.8,−4.4)), the saddled corral dun (19.5,33.0), and two unsaddled ones the horsekeeper can saddle: the street dun by the trough (−44.6,4.4) and the corral white (20.5,39.0). The grazing paint and the five stall horses stay static kit horses. Their `horse()` calls and static ghostBoxes leave `trollcity.js`; a registry `rp.horses() → { list, M, peg }` replaces them (`materials()` is local to `buildTrollCity`, so `M` is handed over there).

**The model: `view/horse-model.js` (new).** `buildHorse(M, opts)` builds one horse as its own `THREE.Group` (origin at the feet, +x forward, `group.rotation.y = yaw + π/2` in look convention) with a private Kit for the static torso and pivot Groups for the moving parts: four legs (hip pivots at y 1.0, hoof boxes reaching y 0), neck → head (bit point on the head), tail, a saddle group at a **real seat height y 1.58–1.66** (today's saddle is hidden inside the body box), and a reins `THREE.Line` from the bit to the rider's hands. Same `M` textures as the kit horses (no new canvases). `pose(st, t, dt)` does the gaits: walk 1.8 Hz / trot 2.6 Hz with diagonal leg pairs and a nod at the walk; gallop 3.2 Hz rotary order with a body bob and pitch, the tail streaming; idle graze after 10 s parked (the kit's graze angles), tail swish, ear flicks; a 2 s amber sparkle when brushed. Hoofbeats via `audio.step(at, gain)` from the leg phase (two per cycle, never from packets).

**Mount, claim, dismount, park: `modes/social-horses.js` (new).**
- `rpExtras` entry: a saddled, unridden horse within 2.5 m → hold X 0.5 s "Mount the bay horse" (ctx "Ride"). Unsaddled → info "Needs a saddle (the horsekeeper has one)". Refused while seated, in a duel, or if any peer already shows that `ho`.
- Claim = my `ho` on the wire; a simultaneous race is settled like jobs: the older peer keeps it, the younger is dismounted within a packet.
- Dismount: hold X 0.5 s or the crouch key (C / pad crouch / touch crouch), or death / leaving Socialize. Placed 1 m to the horse's left, one human `resolveCircle`, eye eases back down.
- Parking needs no message: everyone saw the rider's rig, and their `ho` dropping to 0 parks the horse there on every client. 60 s after parking (`T.home`, test-tunable) a horse not near home walks home at 3 m/s, sliding on `resolveCircle`; if stuck or > 80 m out it blinks home only when no camera is within 35 m. So late joiners see unridden horses at home (accepted), and everyone converges.

**Riding (the module owns movement while mounted; `move.update` is bypassed, as the club line does).**
- `move.pos` is the horse's feet. Throttle from `iz`: walk 3 / trot 6 / gallop 11 m/s (keyboard W = trot, Shift+W = gallop, Ctrl+W = walk; sticks: half = walk, full = trot, full + the existing sprint rule = gallop), back-up −1.5. Accel 0→11 in ~1.5 s, stop in ~0.8 s.
- Steering from `ix`: 1.6 rad/s at a walk down to 0.9 at a gallop; a standing horse pivots at 1.0 rad/s.
- Camera, both views: the look yaw is dragged with the horse's turn (exactly what the train does, `social-train.js:45`), the mouse / right stick is a free-look offset that eases back at a gallop when you stop looking. FP shows the neck and head 1.2 m ahead and 0.75 m below the eye (eye at 2.47 m: seat 1.62 + 0.85; nothing of the horse is within 0.45 m of the eye). 3P: pivot is the eye, distance +1.4 m, height +0.3.
- Collision: three `resolveCircle` probes along the heading (nose/centre/tail at ±0.9 m, radii 0.45/0.7/0.45, headroom 2.5 m, step-up 0.36). Result: 1.3 m doors block, the 3.4 m stable doors and the corral gates pass, porch roofs under 2.5 m block. The ridden horse's own collider is parked (`max.y = −1`). Ground from colliders with `pen ≥ 0.5` only (fences are 0.4), so a horse never lands on a rail. Map bounds clamped with a 1.2 m margin; the train's `riding` flag is not used.
- Jump: Space at trot or gallop hops 1.3 m (vy 7.6); at a gallop a fence-class collider (0.6–1.3 m high) 3–4.2 m ahead triggers an auto-hop, so a galloping horse clears the corral fence. A walk can't jump (a head toss).
- Written back each frame: `move.pos/velocity/grounded`, `stance = STAND`, `moving = false` (no human steps or arm swing; the gait rides `hg`), `eyeHeight → 2.47`. Not allowed mounted: vault, slide, dive, prone, ropes, swivel, emotes, seats, duels. A drink stays in the right hand; the reins go to the left.

**Rider pose.** 3P / remote: `poseSeated` at `horse.y + 1.62`, legs spread (hips z ±0.42, knees −1.0, shins down the flanks to the stirrups), chest leaning +0.08 (+0.18 at gallop), both hands to the reins with `reachHand` in chest space (`poseDrinkArm`'s space), body yaw = the horse's (overriding `aimRig`'s lag), the head turned to the look yaw within ±1.2 rad. FP: a `horseArms()` branch in `socialArmsFrame` after the club's: both hands low and forward, "fist", a bob per gait; `socialUnarmed()` gains `|| horseRiding()` so troll_runner's hands show too.

**Wire.** `ho` horse id+1, `hg` gait 0–3, `hy` horse yaw (2 dp; `ry` stays the camera yaw for the head and tag), `hs` saddle bitmask (horsekeeper only). A `peerPosers` entry draws the peer's horse at their interpolated, render-delayed position (so the horse lags exactly like the rider), yaw eased to `hy`, gait from `hg`, speed from the snaps, the rider posed seated; `ho` → 0 or the peer leaving parks it. Horse Groups live in `game.scene`, one per registry entry, rebuilt on map change (materials marked `userData.shared`).

**Horsekeeper (~2 h of the 16).** `ROLES.horsekeeper` (Hay Jay yields). Hold X 0.6 s at the saddle peg (−11.62, 1.3, 33) takes the job / hangs it back. Perks: **saddle** an unsaddled rideable (hold 1.5 s; rides `hs`, so it lasts while the horsekeeper is in the room; a rider already on it stays on), **whistle** your last horse to you (hold 0.6 s with no horse near: `{k:"horse", e:"call", h}`, a two-note `_tone`; it trots to you on every client), **brush** a parked horse (hold 1.2 s: `{k:"horse", e:"brush", h}`, ready for 3 min: gallop ×1.12, sparkle, whinny). Both messages honoured only from `p.role === "horsekeeper"`. Feeding an apple (merchant's barrel) to an unsaddled horse counts as a brush for anyone.

**Files.** New `view/horse-model.js`, `modes/social-horses.js`, `tools/troll-ops-horse-test.mjs`. Edited: `trollcity.js` (registry, M handoff, drop 6 static horses), `rp-roles.js`, `social-rp.js` (forward `k:"horse"`, export `setBarRole`), `game.js` (`socialUnarmed`, snapshot `ho hg hy hs`, `initSocialHorses()` after `initSocialRp()`, `updateHorses(dt)` after `updateBar`), `net.js`, `view/player-update.js` (the `rideHorse` branch before `move.update`, footsteps skipped), `view/third-person.js` (rider pose next to the seated block, camera +1.4), `view/fp-emote.js` (reins branch), `outfits.js` (stetson, merchant). Cascade `--suffix hs1`.

**Test: `tools/troll-ops-horse-test.mjs`** (2 tabs; hooks `window.__trollHorses`): 6 rideables listed, 4 saddled, parked at home → mount by hold X at the black horse (eye → 2.47, `moving` false) → turn with D, gallop W+Shift 10 s: > 40 m, gait 3 → a 1.3 m stable side door blocks (z stays < 27.4) → the 3.4 m stable door passes → gallop auto-hop clears the z = 42 corral rail and lands → C dismounts 1 m left, horse parked, stance stand → B sees A's horse under A (`ho` 1, group within 0.3 m of A's drawn position, gait 3, moved > 10 m) → `T.home = 2`: walks home, ends parked within 0.5 m facing `home.yaw` → horsekeeper at the peg (Hay Jay hidden on both tabs, B sees `rr:"h"`) → saddles horse 5, B sees it saddled via `hs` and mounts it → whistle brings horse 0 to A within 8 s on both tabs → brush → `ready` on both → FP and 3P screenshots to `tools/.horse-shots/` (looked at by eye) → no page errors; `rp-test`, `train-test`, `duel-test` still pass (the mount prompt must return null with no horse within 2.5 m so it never shadows seats).

**Risks (and what's done about them).** Straight-line walk-home can snag on walls (slide, then blink home unobserved). Auto-hop timing needs tuning (test step guards it). A diagonal horse can wedge in a 1.3 m doorway (S backs out). Two riders in one hold window (older wins within a packet; the remote poser tolerates two peers on one id for a frame). The `?v=` cascade must put every importer of a changed module on one tag or state splits (HANDOFF rule).

---

## Order, sessions, estimates

| Phase | Hours | Sessions |
|---|---|---|
| 0 shared groundwork (room clock, rp routing, roles, keys) | 1 | with 2d |
| 2d conductor + synced train | 3–4 | 1 |
| 2b sheriff, jail fixes, cuff cine, wanted board | 5–6 | 2 |
| 2c merchant | 2 | with horses |
| 2c horses + horsekeeper | ~16 | 4–5 |
| **Total** | **~28 h** | **~8** |

The old HANDOFF estimates (3–4 h each) assumed led-only horses and a scripted train. The user chose riding and a real synced train, so 2c is the big phase; 2d shrank because the train already exists.

Each phase ships on its own: targeted test → one full gate → push to main, no videos; a HANDOFF shipped-log line per landed phase; `?v=` cascade per phase (`-cd1`, `-sh1`, `-hs1`). One Troll Forces session at a time, `git status` before the first edit.

## Verification (end to end)
- New tests: `troll-ops-conductor-test.mjs`, `troll-ops-sheriff-test.mjs`, `troll-ops-horse-test.mjs` (the merchant checks live in section 0 of the horse test). Run one at a time from the worktree via `.claude/run/runtest.sh <name>`; never in a public room (Supabase blocked in every test).
- Existing tests that must stay green: `rp-test`, `duel-test`, `train-test`, `socialize-test`, `club-entry-test`.
- Screenshots looked at by eye before each push: the cuff cine (two frames), the badge, a wanted poster, the conductor's cap on the platform, FP and 3P riding, a horse mid-hop.
- Full gate `node tools/troll-ops-gate.mjs` once per phase before the push; after the push, curl `trollrunner.net/troll-ops.html` for the new tag.

## First execution step
Write this design next to the others as `assets/games/troll-ops/TROLL-CITY-RP2.md` (short, the decisions and the per-phase plans), replace HANDOFF.md's stale phase-2 notes (lines 25-38: "logic in game.js", "real train riskiest") with a pointer to it, then start phase 0 + 2d.
