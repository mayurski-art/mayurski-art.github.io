# Trolling Loud goes underground — DESIGN DOC

Status: APPROVED 2026-10-31 on all six picks as drafted; BUILT the same day
on branch `claude/tl-club-rebuild-a5cb58` (not pushed). As built, it
differs from this draft in four places, each found by a check:
- The geometry is drawn in code (`maps/kabukigrin-under.js`), not
  rebuilt in Blender: the old street-level club is cut out of the Blender
  models at load (`cutOldClub`), and the dug club's near-black surfaces
  need no bake.
- The balcony's north arm stops at the front stair (x -27.8): running to
  the west wall it crossed in front of the DJ's LED wall (rule 9). The
  balcony bar moved to the north arm's east end; the hall's two screens
  hang on the north and south walls under the arms, over the booths.
- The DJ stair (S4) runs down the west wall from the south arm; the
  stage is x -31.5 .. -28, z 8 .. 16.
- Brightness: every club view averages 8 to 34 (today's hall 77); the
  over-200 share is 0.1 to 4 % (target was 3 %): the lights are small in
  a dark frame, and they read. One visibility spot is under 1.6: a player
  on the north arm seen against the DJ's LED wall (head 1.17), a black
  silhouette on the brightest thing in the room.

The user's ask: the club is too bright with its lights on and sits
awkwardly at the end of the street. Make it dark (the club's lights pop
against near-black), bigger, and underground, with stairs down, a balcony
over the dance floor, and street signs that lead players to the door.

"Trolling Loud" is no longer a map of its own: since 2026-10-24 the club is
Trolling Loud's Tokyo branch inside **Kabukigrin**, on Grinjuku's A side
(docs/KABUKIGRIN.md). So this is a rework of Kabukigrin's west half.

---

## 1. Today, measured

Before shots (`tools/troll-ops-kabukigrin-club-shots.mjs`, high tier),
mean luma of the frame, 0-255:

| View | Mean | Pixels under 20 | Pixels over 200 |
|---|---|---|---|
| hall (from the mezzanine) | **76.9** | 19 % | 6.3 % |
| ceiling | 72.0 | 16 % | 3.2 % |
| bar | 62.6 | 28 % | 2.5 % |
| dj | 57.8 | 25 % | 3.4 % |
| floor | 44.1 | 49 % | 2.1 % |
| marquee (A Main, outside) | 59.4 | 41 % | 4.2 % |
| mid bottom (outside) | 31.2 | 64 % | 1.4 % |

The inside of the club is brighter than the street at midnight. The cause
is the walls, not the lights: the hall is lined floor to ceiling in red
slatted panels (`slatTexture`) that the baked pink and cyan lights wash
across, so every wall reads as a lit red surface and the lasers, LED tiles
and neon have nothing dark to pop against.

"Awkward at the end of the street": A Main runs south from the forecourt
and dead-ends in the club's front wall at z 4; the club is a box with a
marquee stuck on its face (marquee shot).

## 2. The idea in one line

**The club drops two floors under a new open square.** The A-side block
that holds the hall today comes down to a rain-slick plaza, **Lulz Square**,
that A Main runs straight into. In the square a lit stair mouth, Kabukicho
style (sign stack, canopy, bouncer), leads down to **B1, the balcony**, a
ring that looks over **B2, the dance floor**, one big dark room under the
whole square.

You come down the stair, step out onto the balcony and the whole club
opens below you: that is the reveal.

## 3. Footprint and levels

Coordinates as Kabukigrin: x east, y up, z south, metres.

| Level | y | What |
|---|---|---|
| Street / Lulz Square | 0 | the square, open sky, rain, the stair mouths |
| Slab | -0.5 .. 0 | the square's floor = the club's ceiling |
| B1 balcony | -3.6 | the ring, glass rails, 3.1 m headroom |
| B2 dance floor | -7.5 | the hall, 7.0 m to the ceiling |

```
          x -32                 -20                 -8   -6
  z 0     ......A Main.......[S1 stair mouth]..........
  z 4     ┌──────────────── north balcony (B1) ──────┬──┐
          │ DJ  │                                     │E │
          │stage│        DANCE FLOOR (B2)             │A │ east
          │ +LED│        12 x 12, LED tiles           │S │ balcony
          │ wall│        A site centre (-20, 17)      │T │ (B1)
          │     │                                     │  │ bar
          │     │                     main bar (B2) ──┤  │ under it
  z 26    ├─────┴──────── south balcony (B1) ─────────┴──┤
  z 30    └─────────────────[S2 back stair]──────────────┘
                     back of house (street level, as today)
```

- **The hall (B2):** x -32 .. -7, z 4 .. 30, **25 x 26 m (650 m²), twice
  today's 17 x 19 m**. Underground it can run under the riser and A
  Heaven's footprint, which it can't at street level.
- **Balcony (B1):** a U on three sides, 4 m deep: north (z 4 .. 8), east
  (x -11 .. -7) and south (z 26 .. 30). Glass rails 1.05 m. Two booths and
  a sofa line on each arm facing the floor; a small **balcony bar** on the
  north arm. The west side stays open full height for the DJ wall.
- **Dance floor:** 12 x 12 black glass with the LED tiles (the 128 BPM
  shader in `club-live.js`, scaled to 144 tiles at today's tile size), lit
  step-down edge. **Bomb site A on its centre** (pick in 9.1).
- **DJ stage:** the west wall, x -32 .. -28, z 11 .. 23, 0.6 m up: the
  booth, the crystal LED wall (now 12 x 6 m), the nested arches, speaker
  stacks. Faces east at the balcony's east arm, so the DJ and the balcony
  look at each other across the floor.
- **Main bar:** under the east balcony, at floor level, x -11, z 10 .. 24
  (where it is today, relative to the floor): counter, stools, the
  shootable bottle wall, two fridges.
- **Ceiling:** the chandelier and mirror ball hang from the slab over the
  floor's centre; lasers sweep from the balcony fascias.

## 4. Stairs and routes

| # | Name | From → to | Shape |
|---|---|---|---|
| S1 | **Front stair** | Lulz Square at the end of A Main (x -28 .. -24, z 0) → north balcony | straight, 2.5 m wide, 20 risers of 0.18 m, 6 m run, under a canopy; the Socialize door is at its head |
| S2 | **Back stair** | back of house (x -18 .. -15, z 34) → south balcony | straight, 2 m wide, service concrete, the defenders' way in |
| S3 | **Grand stair** | north balcony → dance floor | 4 m wide, 22 risers, along the bar's north end (x -12 .. -8, z 8 .. 14.6), landing beside the bar |
| S4 | **Service stair** | south balcony → floor, behind the DJ stage (x -31 .. -29) | 1.5 m, the DJ's and the bouncers' way down |

- Every tread is a collider step of 0.18 m (the walkers' step-up is
  higher), so players and bots walk them without jumping. Riser height and
  tread depth match Undergrin's stairs, which pass `bot-stairs` and
  `map-walk`.
- **A Heaven stays** at street level (3.0 m terrace on the square's east
  side), with its rope from the riser on Mid Bottom unchanged. It now
  watches Lulz Square and both stair mouths, which makes it the A side's
  power position over the stairs.
- **Mid to the club:** the riser stays as today; a new side stair (S5,
  1.5 m) runs from the square's east edge under the Heaven terrace down to
  the east balcony, so attackers from mid have their own way down (pick
  in 9.3).
- The old routes into A site (the front doors, the two back doors, the two
  ropes, the office stair) are replaced by S1 .. S5. The site rope is
  gone: nothing to rope down into.

## 5. How the ground goes down

Every Troll Forces map's floor is y 0 except Trollface Island, which has a
height field (`core/ground-field.js`): walking, bots and their grid,
bullets, line of sight and loot all read `floorAt(x, z)`.

Kabukigrin gets a **ground field** too: 0 everywhere except a well at
-7.5 over the dug-out rect (the hall plus the stair wells), with 0.25 m
cells so the bilinear edge sits inside the walls. The square's floor, the
balcony and the stairs are colliders above it, exactly the way the
mezzanine sits over the bar today. Two things that read y 0 directly need
a hole cut where the stairs open: the ground mesh and its bake
(`kabukigrin-ground`, `cutRects`), and the rain (it must stop at the
square's slab, not fall into the club).

## 6. Lighting: near-black, lights that pop

The rule: **surfaces are dark, only light sources are bright.**

- **Materials:** the red slats, the quilted booths and the floor go
  near-black (albedo about 0.03: black slats, black velvet booths, black
  concrete). Under the same lights a 0.03 surface returns a tenth of what
  today's red does. Only emissive things stay bright: the LED tiles, the
  crystal wall, the neon, the bottle wall's backlight, the fridges, the
  balcony's under-rail strips.
- **Bake:** the club's part of `kb-shell` and `kb-props` re-baked with its
  lamps at about a quarter of today's energy, so pools of colour land on
  the floor and the bar top and fall off fast; the walls stay black. The
  street side's bake is unchanged.
- **Live, on the beat** (unchanged count, no new runtime lights:
  runtime-light recompile trap): the floor's pink wash on `uKick`, the DJ
  wall's cyan, the marquee's pink, all borrowed from today's 14.
- **Haze:** the height haze (`view/post-look.js`) on the hall floor goes
  thicker and darker, so the lasers and moving heads show as beams.
- **Blacklight:** UV tubes along the balcony fascias. The trollface heads
  are white, so under it every head glows: you can always find the
  players in a dark club (pick in 9.5).
- **Targets**, measured from the same views as section 1: hall mean luma
  **under 30** (today 77) with pixels over 200 **kept at 3 % or more**
  (the lights still pop); `troll-ops-kabukigrin-club-luma.mjs` (can you
  see a player) still at 1.6 or better on every spot.

## 7. Signs that lead to the door

Real Japanese where it's Japanese (house rule), lettered by
`kabukigrin-signs.js` like the street's other signs.

| Where | Sign |
|---|---|
| Forecourt, A Main's corner (the attacker spawn sees it) | a blade sign, TROLLING LOUD → with 地下クラブ (basement club) under it, pink |
| Down A Main, every ~12 m | painted pavement arrows in pink, catching the wet street |
| The stair mouth (S1) | the marquee, moved onto the canopy (TROLLING LOUD, 東京), and a vertical sign stack beside it: B1 / B2 and 入口 (entrance) ↓, the way Kabukicho's basement clubs stack their floors |
| Mid Bottom, the Heaven wall | today's LED windows become an arrow strip pointing south to the square, the cyan trollface stays |
| Back of house, the staff stair (S2) | 関係者以外立入禁止 (staff only) ↓ B1 |
| Inside, B1 | floor numbers at each stair foot: B1 / B2 |

Every sign gets rule 9's check: raycast from a grid of eye points to a grid
on its face; none stands in front of another sign, a screen or a doorway.

## 8. What moves with it

**NPCs (Socialize, `kabukigrin-social.js`):**
- The door: the line stays along A Main (it already queues there); the
  bouncers and the rope move to S1's head; a second bouncer at S1's foot.
- 18 ravers on the new floor, the six roamers' film-the-DJ stops moved to
  the floor's west edge; rail watchers on all three balcony arms; booth
  guests on the balcony; bartenders at both bars.
- **DJ Lulz:** the booth spot moves down to the new stage; the request
  panel and the now-playing chip are unchanged. The sound zones (full in
  the hall, muffled outside) re-drawn: full on B1 and B2, muffled up the
  stairs, low on the square, nothing past A Main.
- The borrowed rooms (tatami VIP and koi tank, green room, office) are in
  the back of house at street level and stay; the office's one-way mirror
  loses its view (it looked over the old floor), so it becomes a window
  onto the square.

**Bots (`bots/nav.js`):**
- The grid reads the field and the colliders, so B1 and B2 are two more
  levels, like the mezzanine over the bar today. Stairs are the only links
  between them.
- S&D attackers must path to A site down S1, S3 or S5; defenders down S2.
  Checked with `map-walk` (every spawn to both sites), `bot-stairs` on
  each stair (SEED runs) and a short bot match on the map.
- Spawns don't move.

**The other club sessions:** four sessions are building club interactions
on their own branches (bar drinks, candle lines, money rain, North's
dialogue). Their spots in the hall (the bar, the bartender North at
x -14.9, z 12.2, the money throwers) move with it; the tatami VIP tables
don't. Plan: they land first; this branch re-anchors their spots after it
merges theirs (pick in 9.6).

## 9. Picks

1. **A site, in versus and S&D.** (a) **On the dance floor, underground**
   (my pick: the club is the point of the A side; three ways down keep it
   fair) or (b) in Lulz Square at street level, with the club as a flank.
2. **Street level over the club.** (a) **The open square** (my pick: A Main
   stops dead-ending and the club gets a front you walk up to) or (b) a
   low entrance building over the stair.
3. **Mid's way down.** (a) **A new side stair from the square to the east
   balcony** (my pick) or (b) none: mid goes through the square to S1.
4. **Size.** (a) **25 x 26 m hall, floor 7.5 m down** (my pick: twice
   today) or (b) bigger, pushing under A Main's west block too.
5. **Blacklight heads.** (a) **Yes** (my pick) or (b) no.
6. **Order with the four club sessions.** (a) **They land first, this
   branch re-anchors their spots after** (my pick) or (b) this lands first
   and they rebase.

## 10. Build, in commits

One system per commit, each with its own test.

| Step | What | Test |
|---|---|---|
| 1 Geometry | the ground field, the dig, Lulz Square, the hall, the balcony, S1 .. S5 as colliders (`kabukigrin-layout.js`) and in Blender (`models/kb_club.py`, rebuilt GLBs) | new `troll-ops-kb-underground-test.mjs`: a player walks S1 down to B1, S3 to B2, and back up; map-audit |
| 2 Lighting | near-black materials, the re-bake, the haze, the blacklight | club shots + luma (targets in 6), club-luma |
| 3 Signage | the signs in 7 | rule-9 obstruction test, head-on and two angles |
| 4 Club live layer | the floor, the DJ, ceiling, ball, lasers, screens moved down | kabukigrin-club-test |
| 5 Nav | bot links on the stairs and balcony | map-walk, bot-stairs SEED runs, a private-room bot match |
| 6 Socialize | the door, the crowd, DJ Lulz, sound zones | club-entry-test, club-crowd-test, dj-test |

Then the ?v= tags (once, after any merge), the before/after shots, one
HANDOFF line. Size budget: today's GLBs plus bakes are 8.6 MB; the
square plus a larger hall should stay under 10 MB.
