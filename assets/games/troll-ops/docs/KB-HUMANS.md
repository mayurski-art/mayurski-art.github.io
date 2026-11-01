# Moving humans in Kabukigrin (the club and the streets)

The user (2026-10-31): "i would like the mannequins to look like they are
real in the sense that they move you know. reach for things bend down and
what not ... lets have this in trolling loud club and here and there
sprinkle some trolls and humans in the streets and what not other spots
hanging around outside."

So the people in Kabukigrin's Socialize crowd become a mix of trolls and
real-looking humans, like Hollowgrin's mannequins. These humans move,
though: they walk, sit, dance and drink like the trolls do now. They also
reach for things and bend down: a bottle off the shelf, a can from the
vending machine's slot, a bill off the floor, a lighter, a phone. The club
gets most of them, and small groups hang around outside on the streets.

Status: draft, waiting on the user's picks (section 9).

## 1. What we already have

- **Hollowgrin's mannequins** (`maps/hollowgrin-mannequins.js`,
  `models/build_mannequins.blender.py`) are MakeHuman bodies with period
  clothes and hair, posed once, then baked to one texture with no
  skeleton. They look real but can't move.
- **The cops** (`characters/cop-bodies.js`, `models/build_cops.blender.py`)
  are the same bodies exported with their skeleton (the "game_engine"
  rig). Every frame they follow the stick figure. The spine and head copy
  the rig's turn. Arms and legs are solved to reach the rig's hands and
  feet, bending at the elbows and knees the way the rig bends. So anything
  a troll does, a cop body does too, and `character.js` doesn't change.
  About 0.9 MB per look.
- **The town crowd** (`maps/town-npcs.js`, `maps/kabukigrin-social.js`)
  has about 80 NPCs in the club and about 25 on the street. Each is a
  stick rig with an act: drink, phone, dance, tend, wipe, sit, walk. Far
  ones are posed less often, and another module can take one over
  (`takeOver`), which is how arm wrestling and the candle lines drive the
  VIPs.

The plan joins these: civilian looks built like the cops, worn by town
NPCs, plus a set of new reach-and-bend acts that trolls and humans share.

## 2. The bodies

`models/build_people.blender.py` (new) builds on `build_cops.blender.py`
the way that file builds on the mannequins. It uses the same MakeHuman
bodies, skin, hair and recoloured clothes, adds each outfit's kit, and
exports `ppl-<look>.glb`: rigged, no clips, one mesh, one atlas.

**Budget per look:** about 6k triangles and a 1k atlas, around 0.6 MB.
The cops are 0.9 MB at 2k. A crowd needs more looks than a squad, so
each one is lighter.

**Looks, first batch (8):**

| look | who | seen where |
|---|---|---|
| `clubber_f` | sequin slip dress, heels, long hair | the dance floor, the bar |
| `clubber_m` | bomber jacket, chain, sneakers | the floor, the bar, the line |
| `vip_m` | open-collar suit, watch | the tatami room, the booths |
| `bottle_f` | black bodycon, LED sparkler (the prop is the game's) | bottle service |
| `bartender` | black vest, sleeves rolled, towel on the belt | behind the bar |
| `salaryman` | grey suit, loosened tie, briefcase | A Main, the konbini, asleep by the vending machine |
| `street_f` | oversized hoodie, tote bag, phone in hand | B Main, the yokocho, the pachinko doors |
| `tourist_m` | cap, backpack, camera on a strap | outside the club, the Alta screen |

Each look comes in two or three variations (skin tone, hair, colours) from
the same build. Faces get the mannequins' sheen so they read as made
people, not uncanny ones. No face is ever see-through (the memory rule).

The trollface stays the game's mascot. Trolls still outnumber humans
(section 6), and `vip_m` and `clubber_m` each get a rubber trollface-mask
variant (like the cops' "grin"), so some humans are trolls in disguise.

## 3. The body driver

`characters/cop-bodies.js` turns into `characters/human-bodies.js`. The
cop entries become two looks among many, and the solver and the hitbox
moves stay. Two changes for crowds:

- **Per-NPC cost.** The full solve (every bone, both arms, both legs,
  fingers) only runs within 18 m of the camera. From 18 to 40 m it runs at
  a quarter rate, and fingers stay a fist or open. Beyond 40 m the body
  takes its last pose and stops updating. The stick NPCs already pose
  less often when far away (`poseAcc`), and humans follow the same rule.
- **A cap.** At most 24 human bodies are live in one view. More would
  only happen with the club full and the camera on the balcony. A
  far-away human in a crowded view shows its baked mannequin pose
  instead: the builder also exports a frozen `mq-` style copy of each look
  in a standing pose.

Players stay trolls. A "human" cosmetic for players is possible later
(the cops' grin mask shows how), but it's not part of this.

## 4. Reach and bend: the new acts

There's a new module, `characters/npc-acts.js`. An act is a short clip
written as targets for each beat: where the hands go (a world point from
the map: a shelf, a slot, a spot on the floor), how far the spine bends,
where the head looks, and the knees for a squat. It runs through the
rig's `reachHand` and spine joints, so trolls and humans play the same
act. The human body only adds the real elbows, knees and fingers on top.

| act | the beats | who and where |
|---|---|---|
| `shelf` | turn, reach up to a bottle on the back bar, take it, pour, put it back | bartenders (the bar's bottle wall slots) |
| `fridge` | bend to the glowing fridge, open it, take a can, straighten up | bartenders, the konbini clerk |
| `vend` | press a button, squat, reach into the slot, stand, open the can | salaryman, street_f (B Main's vending machines) |
| `pickup` | spot something, bend at the hips (knees if heavy), pick it up, look at it, pocket it | clubbers on the floor (bills from the money rain), a kid with coins outside the pachinko |
| `shoe` | one knee down, tie a lace, stand up | anyone, now and then |
| `lean` | forearms on a rail or the bar top, shift weight, look round | the bar, the balcony rail, the yokocho counters |
| `light` | cigarette to the mouth, cup the lighter, flick, a puff of smoke | the smokers outside the club and by the Vents |
| `photo` | lift the camera, frame, a flash, check the screen, laugh | tourists at the club sign and the Alta screen |
| `selfie` | phone up at arm's length, a pose, a second try | clubbers, street_f |
| `hand` | hand something to the NPC beside them (a drink, a lighter, a phone), who takes it | pairs on the street, the bar |
| `toast` | glasses up, clink, sip | booths, the tatami room |
| `stretch` / `yawn` | arms up, back arch | the salaryman at dawn by the vending machine |

Every act ends back in the NPC's normal loop, so a drinker who picks up a
bill goes back to drinking. Acts are timed from the room clock, so every
player in the room sees the same bend at the same moment, and nothing
needs to go over the network. The candle lines (`modes/social-lines.js`)
already work this way: when a human VIP does a line, the human body
plays it with no change to that code.

## 5. The club (Trolling Loud)

The club is being rebuilt underground on another branch
(`claude/tl-club-rebuild-a5cb58`: dark, bigger, a balcony over the floor,
stairs). The crowd's spots move with it, so the club placements are built
on top of that branch once it's merged (pick 9.4).

Roughly 40% of the club's crowd are humans and 60% trolls:

- **The bar:** two of the three bartenders human, doing `shelf` and
  `fridge` between wipes. Barflies alternate troll and human, with a
  `lean` and the odd `toast`.
- **The floor:** a third of the dancers human. When the money rain falls,
  two or three do `pickup` on the bills and wave them.
- **The booths and the balcony:** mostly humans in pairs, with `toast`,
  `selfie` and `lean` on the rail.
- **The tatami VIP room:** human VIPs and the bottle-service girl, one VIP
  doing the candle lines.
- **The line outside:** a mix, with a tourist doing `photo` on the sign.

## 6. The streets: sprinkled, not crowded

There are small groups of two or three in spots where people really hang
around. Each has a reason to be there and something to do with their
hands:

- **A Main by the club door:** two smokers (`light`), one troll and one
  human. A tourist pair photographing the vertical sign.
- **B Main's vending machines:** a salaryman doing `vend`. Late in the
  room clock, the same one asleep against it (the troll who sleeps there
  now becomes him, or they take turns).
- **The konbini:** a clerk doing `fridge`, and a street_f leaving with a
  bag.
- **The yokocho (the micro-bars):** a human regular leaning on each
  second bar, trolls on the rest.
- **The pachinko doors:** a kid doing `pickup` on dropped balls, and a
  winner doing `photo` of his ticket.
- **The Alta screen corner:** a group watching, one doing `selfie` with
  it.
- **The Sewers' mouth:** one troll doing `shoe`, sat on the step.

About 20 more NPCs outside, half human. The street's NPCs stay where
versus players never are: Socialize only, as the crowd is today.

## 7. Rule 9 (nothing blocks anything)

No NPC stands in front of a screen, sign, window or doorway face from any
eye point a player can reach. The placement test raycasts from the
standing grid to every screen, sign and door face (the same check as the
candle lines'), with each NPC's box at the size of its body.
The acts move hands and spines, not feet, so a placement that passes
stays clear while the act plays. The `photo` and `selfie` NPCs face
*towards* screens and signs, and the check covers them too.

## 8. Phases

1. **Bodies:** `build_people.blender.py` and 4 looks first (`clubber_f`,
   `clubber_m`, `bartender`, `salaryman`). Show you a four-view sheet of
   each, side by side with a mannequin.
2. **Driver:** `human-bodies.js` (cop-bodies, generalised), the near and
   far rates, the cap, and the frozen stand-ins. One human NPC on the
   Kabukigrin street with screenshots and a frame-time reading.
3. **Acts:** `npc-acts.js` with `shelf`, `vend`, `pickup`, `lean`,
   `light`, played on a troll and a human, from the side and in first
   person.
4. **The other 4 looks and the other acts.**
5. **The streets:** the groups in section 6, with the rule-9 test.
6. **The club:** section 5, after the underground club merges.

Each phase lands as its own commit with its own targeted test, in a
private room, with screenshots before I show it.

## 9. Picks for the user

1. **The mix:** about 40% humans in the club and half outside
   (recommended), or more humans, or humans only in some roles (the bar
   and VIPs).
2. **The looks:** the eight in section 2, or swap or add some (a
   Japanese-street set like a gyaru, a yakuza suit, a host in a white
   suit, or a punk).
3. **Trolls in human bodies:** the rubber trollface-mask variants on two
   looks (recommended), or keep humans fully human.
4. **The club's timing:** build the bodies, the driver, the acts and the
   streets now, and the club once the underground club merges
   (recommended), or wait to do it all together.
