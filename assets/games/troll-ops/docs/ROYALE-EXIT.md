# Troll Royale: the jump out of the C-130

User, 2026-10-30: leave the plane like you mean it. Back up, crouch, dash
for the ramp, arms out, spin, a slow-motion look back at the plane, hands
to your chest, dive. Squads hold hands in a line and jump together. Fortnite is the feel to aim for; every pose and shot here is
our own, on our trollface rigs.

Status: decisions settled; waiting for the go-ahead to build.

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
  you fly level and tucked when you dive. The hold-to-view key still
  gives the side, front and low angles above 80 m. Today's third-person
  drop camera is still one POV press away.
- Landing: your normal POV setting comes back with the landing roll.

## Squads (Duo, Trio, Squad)
Every Duo, Trio and Squad, whether it's all players, players topped up
with bots, or all bots (the top-up is already in the game: `bots.js`
`fillSquads` fills every empty seat).
- Each client works out the file from the squad roster, the leader first
  (the party leader; a bot squad: its lowest id), in the same order on
  every tab. Everything runs off the shared drop clock, so nothing new
  goes on the wire.
- From T-1.75 the squad stands in a file at the ramp, one behind the other,
  0.9 m apart, the leader nearest the door. They back up together, crouch
  together, and each one's right hand reaches back to take the left hand of
  the one behind (`reachHand` IK, as the crew uses). Bot teammates are
  posed in the file by each client locally, the way the crew is.
- At the green they dash in step, let go at the lip, and go off a beat
  apart (0.15 s), each doing their own leap, spin, tuck and dive.
- Once out, everyone flies on their own (user, 2026-10-30: the falling
  hand-in-hand ring is dropped).
- With a real squad, your teammates replace the stick-figure squad mate
  (solo keeps him).

### Where the leader is (user, 2026-10-30)
"An indication of where the squad leader is at all times, unless the
squad leader is dead."
- The leader: the party leader; a squad with no party, its first human;
  an all-bot squad, its lowest id. The same on every tab, nothing new on
  the wire. It doesn't pass to anyone else when they die.
- Their teammate marker (`royale-team-hud.js` already puts one over each
  teammate, through walls, held to the screen's edge) gets a crown badge
  (a small drawn icon, not an emoji), a gold colour and "LEADER" under the
  name, and stays up the whole match: in the plane, in the fall, on the
  ground. Shape and the word, not only the colour.
- Off screen or behind you: the marker sits on the screen's edge with an
  arrow pointing to them and the distance.
- On the minimap and the compass: a gold crown pip.
- In the team panel: the leader's row first, with the crown.
- Downed (Duo and up): the crown stays, flashing red, so you can go and
  revive them. Eliminated: the leader marker, pip and arrow go.
- You're the leader: your team sees you that way; your own panel row
  says "You lead".

## Bots
- Bots outside your squad still go out in a stick off the ramp's end (no
  run-up), but they do the leap, the spin, the tuck and the dive, through
  the remote pose path everyone uses.
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
3. **Squad file.** The line-up, hands held, the jump together, bot
   teammates included. Test: a Duos/Trios private-room match with bot
   teammates (Supabase blocked): order, spacing, hands meet, a beat apart
   off the lip; screenshots of the file.
4. **The leader marker.** Crown marker, edge arrow, minimap and compass
   pip, panel row, flashing when downed, gone when eliminated. Test: a
   Trios private-room match with bot teammates: marker on the leader in
   the plane, in the fall and on the ground, at the edge when behind you,
   gone when the leader is killed; screenshots of each.
5. **Bots.** Bot exits through the new show. Test: `royale-squad-drop`,
   `royale-bots`; 99 bots still land on the island.

Then one live check: two tabs in a **private** room, a solo exit and a duo
jumping together.

## Decisions (all settled, user 2026-10-30)
1. "Walks slowly backwards while still facing forwards" = facing out of
   the door, backing up the ramp for a run-up, then dashing out.
2. Third person for the jump, first person for the fall, your choice of
   POV in the plane.
3. Squads, bots included, line up and jump together; no hand-in-hand ring
   in the air ("just forget the ring idea").
4. The squad leader is marked at all times unless dead.
