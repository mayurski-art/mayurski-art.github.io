# Troll Royale: the jump out of the C-130

User, 2026-10-30: leave the plane like you mean it. Back up, crouch, dash
for the ramp, arms out, spin, a slow-motion look back at the plane, hands
to your chest, dive. Squads hold hands in a line, jump together and fall
as a wheel. Fortnite is the feel to aim for; every pose and shot here is
our own, on our trollface rigs.

Status: DRAFT, waiting for the user's go-ahead. Nothing built yet.

## Today
- T-1.6 you turn your back to the door; at the green the jumpmaster shoves
  you and you stagger out backwards (`royale-cine.js`, `royale-crew.js`
  `CREW.shove`, `royale.js` `r.pushed`).
- Then a 6 s camera show (`royale-fall.js`): a first-person backward flip,
  a long lens from the ramp, a face shot, a low shot. No steering till 6 s.
- Your planemates see the same poses: they spot your `dr` going from
  aboard (1) to freefall (2) and play `poseDrop`'s show on their own clock.
- Squads ride one plane, seated together (`squadSeats`), but each jumps on
  their own. The cinematic's "squad mate" is a local stick figure.

## The new exit (solo)
On the drop clock, so every client sees the same beats with nothing new on
the wire.

| Drop clock | You | Jumpmaster |
|---|---|---|
| T-6 .. T-1.75 | the long look down over the edge (as now) | by the ramp, holding the strap |
| T-1.75 .. T-0.6 | **back-up:** slow steps backwards up the ramp, ~1.6 m, still facing out the door | steps aside, arm out at the door |
| T-0.6 .. T-0 | **set:** a small crouch, weight forward, hands down by the knees | "Wait for it..." |
| T-0 (green) | **dash:** a sprint down the ramp, ~7 m/s, off the lip at ~T+0.9 | "GO! GO! GO!", waving you through |

The shove goes. Late joiners and anyone who missed the scene still get the
dash and the jump below (Space at the green, or the auto-run at the coast).

### The jump (the exit show, ~4.2 s, replaces the 6 s show)
| Show clock | Pose | Camera |
|---|---|---|
| 0 .. 0.3 | **leap:** off the lip, chest open, arms flung out wide, legs trailing | first person: the lip drops away, the horizon tips |
| 0.3 .. 1.9 | **spin:** arms still wide, 1.5 turns about your belly, tipping toward belly-down | **slow-mo glimpse** (below) |
| 1.9 .. 3.3 | **tuck:** still turning, slowing; the hands come in slowly and meet at the middle of your chest | swings round in front: your face and body (the 2026-10-18 "see the face and body" rule) |
| 3.3 .. 4.2 | **dive:** head down, legs together, hands at the chest, then easing into the spread-arm flying pose | pushes in behind your head and into your eyes: first person for the fall |
| 3.3 on | **yours to fly**: push forward to fly, look down to dive, pull back to hover over a spot (all as today) | |

Control comes back at 3.3 s instead of 6 s.

New in the air after the show: diving (looking down, W held) uses the
tucked dive pose, hands at the chest; flying level and hovering keep the
spread-arm arch. Remotes see it too (their pitch and speed are on the wire).

### The slow-mo glimpse
Time can't slow for a room of players, so it's your own picture that
slows, nobody else's game.
- A display clock runs at 0.3x from 0.3 to 1.6 s of the show, then speeds
  up (to about 1.6x) until it has caught up by 2.6 s. Your spin pose, your
  own fall and the camera run on it. You lose ~0.8 s of fall, before you
  could steer anyway.
- The plane you left is drawn on a lagged clock for the same stretch
  (`Squadron.update` gets `t - lag` for the ridden plane only), so it hangs
  there behind you instead of pulling away, then quietly catches up.
- The shot: a 3rd-person camera a little behind and above your shoulder,
  turning with the spin, so your arms and back frame the open ramp: the
  jumpmaster in the door waving, the bots still in their seats (your
  squad mates are already out with you). A longer lens, a soft vignette,
  the wind drops to a low rumble, a heartbeat thump.
- Remotes play your spin through the same clock function, so in their view
  you slow too, just like in yours.

### First person and third person (user, 2026-10-30)
- **In the plane: your choice.** The POV key (and the plane HUD's POV
  button) works through the whole cinematic, run-up and dash included.
  Today the scene forces first person; it stops doing that. In first
  person the eye bobs as you back up, dips for the crouch, and the dash
  gets a FOV kick and footstep thumps. In third person the camera sits
  over your shoulder in the hold, and your body plays every beat: seated,
  mask, the walk, the back-up, the crouch, the dash. The photo/iPod/mask
  close-ups are first-person shots, so those beats cut to first person
  and back.
- **The jump: third person**, leap to dive (the slow-mo glimpse, the tuck,
  the dive), whatever your POV.
- **The fall: first person.** When the show ends (3.3 s) the camera goes
  to your eyes: you see the island under you, your hands out in front when
  you fly level and tucked when you dive. In the wheel you see your
  squad's arms and hands joined round you. The hold-to-view key still
  gives the side, front and low angles above 80 m. Today's third-person
  drop camera is still one POV press away.
- Landing: your normal POV setting comes back with the landing roll.

## Squads (Duo, Trio, Squad)
### The line-up
- Each client works out the file from the squad roster, the leader first
  (the party leader; a bot squad: its lowest id), in the same order on
  every tab. No wire.
- From T-1.75 the squad stands in a file at the ramp, one behind the other,
  0.9 m apart, the leader nearest the door. They back up together, crouch
  together, and each one's right hand reaches back to take the left hand of
  the one behind (`reachHand` IK, as the crew uses).
- At the green they dash in step and go off the lip a beat apart (0.15 s).
- With a real squad, your real teammates replace the stick-figure squad
  mate (solo keeps him).

### The wheel
- Out of the plane each one does the leap and arms-out, then the squad
  pulls into a ring, belly down, facing the middle, hands joined: two face
  each other, three is a triangle, four a square. Radius ~1.1 m.
- The leader flies the wheel: the same steering, dive and hover as solo.
  Everyone else rides it: their stick does nothing but look around.
- **Break off:** Space / pad A. You let go, spin out along your spoke and
  fly on your own. The leader breaking off ends the wheel for everyone.
- **Auto-release:** at 120 m above the ground, everyone lets go and fans
  out a few metres along their spokes, so nobody lands on top of anyone.
- If the leader dies or leaves mid-air, the wheel dissolves the same way.

### Squad sync (client-authoritative)
- The wire already has `dr`: 2 bits of drop state, plus a seat slot above
  them used only aboard. In the air the slot becomes your **wheel slot**:
  `DROP_FALL | (slot + 1) << 2`, the leader as slot 0. No new fields.
- Each rider puts itself at the leader as *it* sees him, plus its slot's
  offset round the leader's heading, and sends that as its position.
- Each client draws other riders the same way (at its own picture of the
  leader, plus their slot's offset), not at the position they sent. So the
  wheel is a perfect ring on every screen, whatever the lag between three
  phones (at 34 m/s, 0.1 s of lag would otherwise be a 3 m gap).
- No shooting in the air, so nothing depends on those positions until the
  ring breaks; from then on everyone's own flight is the truth again,
  starting from where their screen had them.

## Bots
- Bots still go out in a stick off the ramp's end (they don't do the
  run-up), but they do the leap, the spin, the tuck and the dive, through
  the remote pose path everyone uses.
- A bot in your squad lines up and holds hands in the file, jumps with you
  and rides your wheel. The host places it from the host's picture of the
  leader; everyone else draws it by the wheel rule.
- Bot-only squads wheel too: the bot leader steers to its landing spot as
  today, the others ride along (cheaper than flying each one).
- The jumpmaster stays aboard at the door and waves.

## Phases (one system each, each with its own test)
1. **Poses + exit clock.** `modes/royale-exit.js`: the beats, the slow-mo
   display clock, the pose for leap, spin, tuck, dive and the dive-in-flight
   pose; `poseDrop` uses it. Screenshots of each pose, side and 3/4, from
   `troll-ops-pose-lab.mjs`. Test: the clock is the same on every client,
   catches up by 2.6 s, every beat sits where the table says.
2. **Solo run-up + jump.** The back-up, the crouch, the dash in
   `royale-cine.js`/`royale.js`, the jumpmaster without the shove
   (`royale-crew.js`), the exit show's cameras and the slow-mo glimpse in
   `royale-fall.js`, the lagged plane, the POV choice in the plane and
   first person in the fall (with hands). Test: `troll-ops-drop-cine-test.mjs`
   updated (beats, dash speed, off the lip, control at 3.3 s), plus
   `royale-drop`, `royale-fall-look`; screenshots of each shot.
3. **Squad file.** The line-up, hands held, the jump together. Test: a
   Duos/Trios private-room match with bot teammates (Supabase blocked):
   order, spacing, hands meet, a beat apart off the lip.
4. **The wheel.** Slots on `dr`, riding, drawing riders, break-off,
   auto-release, the leader gone. Test: the same match with you as leader
   and as rider (a bot leads), plus a fed-in peer for the draw rule; the
   ring's shape on screen with 0.2 s of fake lag. Screenshots of the wheel
   for two, three and four.
5. **Bots.** Bot exits through the new show, bot squads wheel. Test:
   `royale-squad-drop`, `royale-bots`; 99 bots still land on the island.

Then one live check: two tabs in a **private** room, solo exit and a duo
wheel.

## Decisions for the user
1. DECIDED (user, 2026-10-30: "yes"): "walks slowly backwards while still
   facing forwards" = facing out of the door, backing up the ramp for a
   run-up, then dashing out.
2. DECIDED (user, 2026-10-30): third person for the jump, first person
   for the fall, your choice of POV in the plane (see "First person and
   third person").
3. Break off with Space / pad A, auto-release at 120 m: OK?
4. DECIDED (user, 2026-10-30): yes. Every Duo, Trio and Squad wheels,
   whether it's all humans, humans topped up with bots, or all bots. The
   top-up is already in the game (`bots.js` `fillSquads` fills every
   empty seat).
