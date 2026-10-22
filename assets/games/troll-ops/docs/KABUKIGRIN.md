# Kabukigrin: Grinjuku x Trolling Loud — DESIGN DOC

Status: APPROVED 2026-10-20 (all six decisions in section 7 settled as
drafted). Drafted 2026-10-20. Nothing in this doc is built yet. The user's ask: combine
the Japanese map (Grinjuku, Shinjuku at night after VALORANT's Split) with
the Trolling Loud nightclub, as "a well detailed design that blends both
maps nicely". Working name **Kabukigrin** (Kabukicho + grin, after
Hollowgrin / Undergrin / Pentagrin); alternatives at the end.

Both maps stay in the game as they are. Kabukigrin is a third map, id
`kabukigrin`, in the versus pool and the Socialize list.

---

## 1. The idea in one line

**Grinjuku's A side goes indoors.** The street map keeps its proven Split
bones (three lanes, two sites, a Heaven over each, four ropes, the same
spawns and bomb sites), and Trolling Loud's Tokyo branch is built *into*
the west half: the A site is the dance floor, A Heaven is the mezzanine,
the backs behind A are the back of house, and A Main is the club's street
with the marquee, the line and the bouncers. The B side stays the rainy
Shinjuku alley it is today.

Why this split and not a club dropped somewhere else:

- Every Grinjuku region already has a Trolling Loud twin at the same scale
  and the same height: Heaven (3 m terrace watching its site) is the
  mezzanine (4.5 m, glass rails, watching the dance floor); the site rope
  and the mid rope room are the club's rigging rope and service riser; the
  Heaven stair from the backs is the office stair; the backs under the rail
  viaduct are the loading yard. Nothing about the way the map plays has to
  change; the walk routes and rope tests keep passing.
- The two halves meet down the middle, so the contrast *is* the map: from
  Mid Bottom you see a rain-slick post office on one side and, on the
  other, a wall of LED breathing on a 128 BPM clock with a cyan trollface
  three metres tall. Inside, the club is Trolling Loud; step out of the
  front door and you are in Grinjuku.
- S&D: attackers plant A on the dance floor.

## 2. What each map brings

| From Grinjuku | From Trolling Loud |
|---|---|
| the 64 x 84 m plan, bounds, spawns, bomb sites, Mid Mail, Mid Top's torii, Sewers, Vents, both Heavens, four ropes, two stairs | the beat clock (`U`, 128 BPM) and everything on it: neon, LED tiles, lasers, the real lights |
| the whole B side as is: B Main's kei truck and vending, B Heaven's tank and AC unit, B site's takoyaki stall, shuttered kiosk, bikes | the hall: dance floor over the mirror pit, DJ stage with the crystal wall and the nested arches, the fringe chandelier, mirror ball, starburst, moving heads |
| the look: violet sky, magenta haze, rain-slick asphalt with puddles that catch the neon, flyers and cans in the gutters | booths, cocktail tables, stools, columns ringed in light, the bar with its shootable bottles, speaker stacks, road cases |
| `grinjuku-layout.js` → Blender pipeline (one source for colliders and art) | Socialize: the door (CLUB-ENTRY.md: the line, ID, 18+, wristband, rope, kick-out), DJ Lulz and song requests, the crowd, seats |
| the gj-skyline.glb far city (reused unchanged) | things that answer a bullet: signs short out, the ball spins up, bottles shatter, the record scratches |

## 2.1 Inspiration: Japanese maps and nightclub maps elsewhere

What the good ones do, and the one thing each lends Kabukigrin. Nothing is
copied; these are the moves.

| Map | What it does well | What we take |
|---|---|---|
| **Black Ops 2 — Plaza** (the nightlife plaza; BO2 is already the menu's language, `menu-bo2.js`) | neon on every side of a sunken open-air floor, a raised walkway ringing it, wet ground throwing the signs back | the mezzanine as a ring you read the whole floor from; the puddles in A Main tinted to catch the marquee; the load-screen card in Plaza's register |
| **Black Ops 2 — Magma** (a Japanese town) | pachinko parlour, stacked kanji signage, a station as the frame | the **pachinko parlour** on A Main's west wall (see 3.5 a) |
| **Black Ops Cold War — Miami / Miami Strike** | the club sits mid-map with a glass front onto the strip; the Strike cut is "in and around the nightclub" with the docks and garages behind it; a rooftop pool over it all | the shot-out glass front onto the lane; the loading yard as the club's back lane; a rooftop pool as the Sky Bar option (7) |
| **Modern Warfare III — Tokyo** (Season 4, 2024) | a nightlife block where only two buildings (the Hotel, the Manga shop) have an upper floor, so they are the fight; an Arcade and a courtyard of kiosks break the long lane | confirms the plan: the club and B Heaven are the only highs; the yokocho in the Vents is our kiosk courtyard (3.5 b) |
| **Black Ops 6 — Eclipse, Bounty** | Eclipse: an underground club with the dance floor dead centre, the DJ booth and a raised platform beside it, a Lounge and a VIP you spot the centre from; Bounty: a VIP lounge valued for its view *over* the nightclub | the office window over the floor (3.5 d); VIP as a watching room, not a dead end |
| **Rainbow Six Siege — Coastline** (Ibiza club) | VIP lounge with an aquarium wall, the Blue Bar, a DJ booth, the Sunrise Bar on the roof | the **koi tank** VIP wall (3.5 c); the Sky Bar's name and rooftop placement |
| **Rainbow Six Siege — Skyscraper** (a Nagoya house) | shoji, tatami, a karesansui garden, lanterns, a shoes-off threshold | the **tatami VIP room** with shoji doors (3.5 c) |
| **Hitman 3 — Berlin** (Club Hölle) | a rave in an industrial shell: concrete back of house, smoke and lasers over a dense crowd, the DJ as the room's clock | the back of house kept raw concrete and steel against the hall's velvet; crowd density on the floor over count |
| **Payday 2 — Nightclub** | the manager's office over the floor with a one-way window, the safe, the back alley with the dumpster, the roof | the **office with a one-way window** on the mezzanine (3.5 d); a safe as the Cops and Robbers hook, if that mode resumes |
| **Yakuza / Like a Dragon — Kamurocho** (Kabukicho) | the Champion District: a covered alley of tiny five-seat bars (Golden Gai); stacked hostess-club signs; Club SEGA; karaoke; the batting centre | the **yokocho in the Vents** (3.5 b); the kanji strip sign; an arcade front on the forecourt's shelter wall |
| **Cyberpunk 2077 — Japantown, Jig-Jig Street, Afterlife** | neon kanji holograms in pink/cyan, vertical signage, a bar under concrete | the club's three colours: pink, cyan, sakura; the vertical strip sign |
| **Overwatch — Kanezaka, Hanamura** | a ramen shop, an arcade, a cat café, the tanuki statue; the arcade-and-shrine mix | a **ramen counter** beside B's konbini, a tanuki by the koban (3.5 e) |
| **Fortnite — Mega City** | an elevated line carrying lit trains through a neon city | the **passing train** on the south viaduct (3.5 f), on `train.js`'s pattern |
| **Valorant — Split** | the base Grinjuku already follows: three lanes, Heavens, ropes | unchanged |

Not taken: World at War / Vanguard's **Castle**, Overwatch's shrine
courtyards, BO3's 1940s Morg City club. Kabukigrin is modern Kabukicho at
midnight, not feudal Japan or noir.

## 3. The plan

Game coordinates as Grinjuku: x east, y up, z south, metres; 64 x 84 m.
Attackers spawn north (the station forecourt), defenders south (under the
rail viaduct). North is up.

```
        x -32      -23       -14   -6       6    14       23      32
z -42   ┌──────────────────────────────────────────────────────────┐
        │   STATION FORECOURT — attacker spawn, the shelter        │
        │   ▲ the marquee and the kanji strip sign face this way   │
z -32   ├─────────┬──────────────────┬────────┬─────────────────┬──┤
        │ A MAIN  │                  │ MID    │                 │B │
        │ the     │   west block     │ TOP    │   east block    │M │
        │ line    │   club billboard │ torii  │   (unchanged)   │A │
        │ (Soc.)  │   on its south   │        │                 │I │
z -8    │         │   face           │        │                 │N │
        │         ├──────────────────┤  MID   ├─────────────────┤  │
        │ podiums │ SEWERS (culvert) │  MAIL  │ VENTS (duct)    │  │
z 4     ╠═════════╧══════════════════╬════════╪═════════════════╤══╤
        ║ TROLLING LOUD TOKYO        ║ riser  │ MID  │ B HEAVEN │B │
        ║ DJ wall   DANCE FLOOR  bar ║ MEZZ   │ BOT  │ 3 m      │SITE
        ║ (west)    = A SITE   ────▶ ║ (A Hv) │      │ tank, AC │stall
        ║ booths    plant here       ║ 3 m    │      │          │kiosk
z 24    ╠════════════════════════════╩════════╡      ├──────────┴──┤
        ║ BACK OF HOUSE: kitchen, green room, │ the backs: crates,  │
        ║ office stair, loading yard          │ konbini, koban      │
z 42    └──────────── rail viaduct piers, defender spawn ───────────┘
```

Double lines are the club. Everything east of x -6 and north of z 4 is
Grinjuku today, untouched except where section 5 says.

### 3.1 The club, room by room

All numbers are the Grinjuku solids they replace, so the colliders the
bots already walk stay where they are. Heights: club floor 0 (the street
is 0; one 0.15 m sill at each door), hall ceiling 7.4, mezzanine deck 3.0
(= Heaven), mezzanine ceiling 7.4, roof 8.0 (= `GJ.block`), parapet 1.1.

| Room | Footprint (x, z) | What it is | Was |
|---|---|---|---|
| **Front** | the north wall at z 4, x -32 .. -14 | the club's street face on A Main: a 4 m main door (x -28 .. -24) under the marquee, a 3 m loading door (x -20 .. -17) at the dock, a shot-out window band between them (y 1.2 .. 2.4, shoot-through, not walkable), rolled steel shutters, a vertical kanji strip sign on the corner at x -31.5 | open: A site was entered along the whole lane width |
| **Dock** | -23 .. -17, 4 .. 7.5, 0.9 m up | the loading deck with its three steps on the west, inside the hall now: amps and road cases on it, the stage's flight cases | A Ramps' deck |
| **Hall** | -31.4 .. -14.4, 4.4 .. 23.6 | the main room, 17 x 19 m, ceiling 7.4, slatted panels and quilted red booths round the walls, columns ringed in light holding the mezzanine | A site |
| **Dance floor** | -27 .. -17, 10 .. 20 | 10 x 10 black glass over the mirror pit, 100 LED tiles on the beat (Trolling Loud's 14 x 14 at the same tile size), a lit step-down edge; **bomb site A stays (-22, 15), its centre** | the stall and the kiosk (both move to B side's existing twins; see 5) |
| **DJ stage** | -31.4 .. -28, 10 .. 20, top 0.45 | against the west edge wall, facing east across the floor to the mezzanine: booth, decks, the troll DJ bobbing, the crystal LED wall 10 x 5.5 on the edge wall behind, five nested arches (the sixth is cut for the ceiling), speaker stacks at its ends | the vending machine at x -31.6 |
| **Bar** | the mezzanine's west face, x -14.4, z 8 .. 20 | the main bar under the overhang: 12 m of dark wood counter, stools, the backlit bottle wall split into shelf segments a bullet empties one at a time, two fridges glowing | the terrace's blank face |
| **Mezzanine** | -14 .. -6, 4 .. 24, deck at 3.0 | A Heaven, roofed: glass rails on the site side (parapet today), two booths and a sofa facing the floor, the tank becomes the sound desk, the AC unit a flight case; the Heaven wall on the mid side stays (3.2 m, now the club's east wall with its LED windows, see 3.2) | A Heaven |
| **Riser** | -10 .. -6, 8 .. 11.6 | the mid rope room: a steel door off Mid Bottom into a cable riser, trunking and patch panels on the walls, the rope up the shaft to the mezzanine (dressed as a black rigging rope with a sandbag). The attackers' way onto the club's upper floor from mid, as today | the mid rope room |
| **Rigging rope** | x -14.4, z 18 | the site rope, from the hall floor up through the glass-rail gap to the mezzanine; a lighting-truss rope with a sandbag and a coiled tail | the site rope |
| **Back of house** | -32 .. -6, 24 .. 34 | behind the hall's south wall (z 24, doors at x -27 and x -16): the kitchen (steel tops, a pass), the green room (sofa, lit mirror, a karaoke rig), the office stair (x -12, z 24 .. 30, the Heaven stair today) up to the mezzanine, a noren curtain over the staff door | the backs |
| **Loading yard** | -32 .. -6, 34 .. 42 | open to the sky under the viaduct: the tour van (the kei truck pattern, black), dumpsters, beer crates, a paper lantern string, the defender spawns at z 37 unchanged | the backs' crates and the konbini (the konbini moves east, see 5) |
| **Roof / Sky Bar** | -32 .. -6, 4 .. 24, at 8.0 | **versus: unreachable** (the office stair stops at the mezzanine; the roof is a parapet silhouette). **Socialize (later phase):** a steel stair continues from the office landing to a small Sky Bar with the skyline all round, like Trolling Loud's | the block top, never walkable |

Routes into A site are the same three as today, each now a doorway: from
A Main (the main door and the loading door), from the backs (the two
back-of-house doors), and from above (the two ropes, the office stair).
Nothing new links the Sewers to the club: the culvert gets the club's bass
through its south wall and a "STAFF ONLY" steel door that is set dressing,
so mid-to-A stays exactly as tight as it is.

### 3.2 The seam: what the club shows the street

This is where the blend lives, so it gets its own list.

- **The marquee** over the main door, facing north up A Main and the
  forecourt: TROLLING LOUD in the sign atlas' pink, a halo, and under it a
  smaller 東京 in white. One of the 14 real lights sits under it and kicks
  on the beat, so the whole lane breathes pink from the spawn.
- **The kanji strip sign** on the front corner (x -31.5, z 4), stacked
  Kabukicho style: トローリング・ラウド reading downward, cyan, steady (not on
  the beat; the street's neon is calm, the club's is not).
- **The club video wall** on the west block's south face (x -23 .. -7 at
  z -8), looking over the Sewers' mouth at the club: a 12 x 4 m LED screen
  that plays animated loops, the way the screens over Times Square and the
  Shibuya scramble do (user, 2026-10-20). Each loop is a short clip,
  8-12 fps, 6-10 s: the trollface ads, a DJ Lulz tonight card, the Troll
  Runner sticker spots, a $TROLL ticker, the Kabukigrin logo sting; the
  clips play in a row, with a two-frame white flash between them. Drawn by
  the live layer as one emissive canvas texture (a sprite sheet per clip,
  drawn into a 1024 x 512 canvas each frame it changes, `needsUpdate` only
  then), so it costs one texture upload per frame change and no light; a
  pink-cyan wash from it on the lane's puddles is painted in, not lit.
- **The Alta screen** (the second one, B side): the tallest B-side block
  at the plaza corner gets a 10 x 6 m screen up on its face, Studio Alta
  style, playing the same loops a few clips out of step with the club's,
  so the two never show the same frame. The B side keeps its steady neon
  otherwise: the screen is the one thing that moves over there.
- **The east wall on Mid Bottom** (the Heaven wall, x -6, z 4 .. 24,
  y 3 .. 6.2): six LED windows 1.6 x 1.2 in a row at y 4, glass, with the
  mezzanine's light behind them, pulsing on `uKick`; above them the big
  **cyan trollface** (Trolling Loud's `trollCyan`, 3.3 m, shootable group).
  A player in Mid Bottom sees the club's pulse all match long.
- **The front window band** (shot-out, 1.2 .. 2.4): light and tiles flicker
  through it onto the lane's puddles; the puddle decals in `aMain` get a
  pink `color` so they catch it.
- **Sound.** The club's own track plays from the booth through Trolling
  Loud's muffled chain. The lowpass and the panner are driven by the
  listener's zone: full in the hall; muffled in the back of house and on the
  mezzanine's far side; through the walls and lowest in A Main, Mid Bottom
  and the Sewers; nothing on B side. Start Troll Radio and the lights follow
  your song instead, as on Trolling Loud.
- **Rain.** Grinjuku's rain-slick dressing covers every outdoor area; inside
  the club there is none. Walk through the main door and the floor goes from
  puddles to mirror-black.

### 3.3 Lights (14, all made at build time)

Trolling Loud's cap is 14 (HANDOFF). Grinjuku's A-side four (A site, A
Heaven, A rope room, Sewers) are replaced; two are added.

| # | Where | Colour | On the beat? |
|---|---|---|---|
| 1 | dance floor centre, y 5 | pink `0xff2ab4` | yes, `uKick` |
| 2 | DJ wall, y 4 | cyan `0x3ff0ff` | yes |
| 3 | bar, y 2.6 | warm `0xffb84a` | no |
| 4 | mezzanine, y 5.5 | violet `0xa060ff` | yes, soft |
| 5 | back of house, y 2.8 | fluorescent `0xe8f2ff` | no |
| 6 | marquee, outside, y 4.6 | pink | yes |
| 7 .. 14 | Grinjuku's eight unchanged: B site, B Heaven, B rope room, Mid Mail, Vents, both spawns, Mid Bottom's lanterns | as today | no |

### 3.4 The look, side by side

| | Street (B side, mid, spawns) | Club |
|---|---|---|
| sky, fog, exposure, bloom | Grinjuku's as is | same scene; the club's ceiling hides the sky |
| floors | rain-slick asphalt, puddles, oil, tyre marks, cracks | mirror-black marble (hall), boards (bar), concrete (back of house), black glass (dance floor) |
| walls | shopfront shutters, tile, concrete, the post office's cream | slatted panels with a red wash, quilted red and black, teal mosaic (the bar's end wall), gold frames |
| neon | steady: vending machines, shop signs, Mid Top's torii lanterns | on the clock: every tube, tile, arch, the chandelier, the marquee |
| screens | the Alta screen on the corner block (video loops) | the club video wall over the Sewers' mouth (the same loops, out of step) |
| detail bar (user, 2026-10-20: "good graphics and details") | every street surface from the realism pass stays: puddles, oil, tyre marks, grime decals, shutters' stickers, the baked light in the GLB | every club surface gets the same: scuffed marble, bottle rings on the bar, cable runs along the stage, confetti in the dance-floor seams, finger marks on the glass rail; new Studio parts have no baked light, so phase 6 bakes AO and the 14 lights into the new GLB (the Blender bake Grinjuku used) |
| Tokyo on the club | — | shoji-pattern LED panels either side of the crystal wall; a noren over the staff door; paper lanterns in the yard; a purikura booth and a beer fridge in the lobby corner; sakura pink `0xff9ad0` as the lasers' third colour |

### 3.5 Borrowed pieces (from 2.1), placed

Each sits on an existing collider or adds none, so the walk routes and
the rope test are untouched.

- **(a) The pachinko parlour** — A Main's west wall (the `_edge` at x -32,
  z -32 .. 4), opposite the club: a 20 m lit shopfront, sliding glass doors
  (cosmetic, no doorway), rows of machines glimpsed through the glass as a
  looping emissive texture, a steady white-and-red sign. Its sound zone is
  a wash of ball-chatter and jingles that fights the club's bass in the
  lane: the two loudest buildings in Kabukicho glaring at each other across
  the line. Magma / Kamurocho.
- **(b) The yokocho in the Vents** — the east link (x 7 .. 23, z -4 .. -2,
  ceiling 2.4) keeps its exact collider and becomes a covered micro-bar
  alley: six tiny bar fronts alternating sides, three stools each (Socialize
  seats), red lanterns on a wire, a cat on a crate, hand-painted menus. Its
  light (#13 in 3.3) turns from duct-blue `0xb8c8ff` to lantern red
  `0xff8a5a`. The west link stays the Sewers so the two links read as
  different places: the club's basement wall on one side, Golden Gai on the
  other. Kamurocho's Champion District; MWIII Tokyo's kiosk courtyard.
- **(c) The tatami VIP room** — back of house's south-west corner (x -32 ..
  -24, z 24 .. 30): shoji doors off the hall's south-west door, a raised
  tatami floor (0.3 m sill: shoes line on the step), low black tables, a
  **koi tank wall** along x -32 (a 6 x 1.5 m emissive water texture with
  slow-drifting koi, one of the shootable groups: a hit cracks the glass
  and the fish scatter), one cocktail table's worth of neon. The VIP band
  (reserved in CLUB-ENTRY.md) opens it; the owner band too. In versus it's
  a room on the defenders' side with one door and a shoot-through window
  onto the hall. (As built, phase 3b: two doors, the hall's west back door
  and one to the kitchen in line with it, since the room sits on the
  kitchen -> hall route and that route had to stay.) Skyscraper's tatami;
  Coastline's aquarium.
- **(d) The manager's office** — the mezzanine's south end (x -14 .. -6,
  z 20 .. 24, over the back-of-house doors): a desk, a safe, monitors
  showing the dance floor cams, and a **one-way mirror window** 4 x 1.2 at
  y 4.2 facing north over the floor. From inside it's glass; from the floor
  it's mirror, until a bullet goes through it (then it's a shot-out frame
  for the round, as the front window band). The office stair (the Heaven
  stair) lands here, so defenders coming up from the backs arrive in the
  office and look down the floor: Heaven's job, reframed. Payday 2; BO6
  Bounty's VIP view. The safe is set dressing until Cops and Robbers wants
  it.
- **(e) Street props on B side** — a ramen counter with a hanging noren
  and two stools against B's konbini (24 .. 18, 31 .. 33, its north face), a
  stone tanuki by the koban's door, a capsule-toy rack by B Main's vending
  machine. Decals and kit only, no colliders over 0.6 m. Kanezaka.
- **(f) The train** — a six-car Yamanote-green train on the south viaduct
  (y 8, z 40.8, the piers already stand) every ~90 s on the room clock,
  east to west, lit windows sweeping the backs and the yard, a rumble that
  shakes the bottle wall (`uKick`-style nudge). Above the 8 m blocks so it
  never enters play; `train.js`'s Grin Express pattern with a new body.
  Mega City; the viaduct Grinjuku already has.

Costs: (a), (e), (f) are dressing and one ambience zone each; (b) is a
re-dress of one existing link plus six seats; (c) and (d) are two new
rooms inside the club's footprint (each one door, one window) and one
shootable group each. None changes a spawn, a site, a rope or a route.

## 4. Modes

| Mode | Plays? | Notes |
|---|---|---|
| versus (TDM, FFA, etc.) | yes | Grinjuku's spawns and the perimeter unchanged |
| Search & Destroy | yes | A on the dance floor (-22, 15), B unchanged (22, 15) |
| Socialize | **yes** (new for the Grinjuku side) | added to `MODES.socialize.maps`; details below |
| Zombies | not at launch | Trolling Loud's spawns come off the street and over parapets; Grinjuku has none. Possible later: the forecourt and the yard |
| Cops and Robbers | no | Trolling Loud only (paused) |

### 4.1 Socialize on Kabukigrin

Trolling Loud's door, moved to the front of the club, with the whole east
half of Grinjuku as the street you roam while you wait or after a kick-out.

- **The line** forms in A Main along the west edge wall: the rope lane from
  the main door (x -29, z 2) running north to z -14, posts every 1.5 m,
  6-7 NPCs, you dropped in at random (CLUB-ENTRY.md 9).
- **Two podiums** at the door: Big Lulz at (-26.5, 2.4), Tank at (-24.5,
  2.4); the red velvet rope between chrome posts at x -28 / -24, z 3.6.
- **Band wearers spawn** in the lobby corner inside the main door (≈ -27, 7).
  troll_runner spawns inside with the owner band. Guest band opens the hall,
  bar, mezzanine; owner band adds the back of house (and the Sky Bar when
  built).
- **Kick-out** plays out of the main door onto A Main's puddles.
- **DJ Lulz** at the booth (-30, 15), the requests, the record, the booth
  chain: `dj-lulz.js` as is, pointed at this map's `rp.dj`.
- **The crowd:** ~80 NPCs inside (Trolling Loud has 119 in a hall twice this
  size; density matched, not count), plus ~25 on the street, new to the
  Grinjuku side: the takoyaki vendor and two customers at B site's stall, a
  konbini clerk, the koban officer leaning in his door, pairs under
  umbrellas strolling Mid Top and B Main, two smokers by the Vents, a guy
  asleep against B Main's vending machine. The bandana guy's 150 s slot
  (club-entry.js) carries over.
- **Seats:** the booths, the bar stools, the mezzanine sofa, the green room
  sofa; outside, the forecourt shelter's bench and the backs' crates.

## 5. Changes to the Grinjuku side (small, listed in full)

- The A-side **takoyaki stall and shuttered kiosk** are inside the club's
  footprint. They are not mirrored any more: B site keeps its own (already
  there, `M()` twins), A loses them. Nothing moves.
- The A-side **konbini** (-24 .. -18, 31 .. 33) becomes the loading yard's
  dumpster and crate run at the same footprint (same collider box, new
  kind). B's konbini stays.
- The A-side **vending machine** at x -31.6 goes (the DJ wall is there).
  The one at x -23.9, z -13 in A Main stays and gets a band poster.
- **`aMain` puddles** take a pink tint; `aSite` loses its puddle, oil and
  crack decals (it is indoors now) and gains none: the club's floor is a
  material, not dressing.
- The **mid rope** and **site rope** keep their ids, positions and `dir`.
  `rope-test` runs unchanged.
- **Spawns, bounds, bomb sites, Mid Mail, Sewers, Vents, Mid Top, B
  everything:** untouched.

## 6. How it is built: the Roblox Studio round trip

User's call (2026-10-20): export the two live maps into Roblox Studio,
remodel the combined map there, export it back. The Troll City redesign
already runs this way (doc "Troll City redesign in Roblox Studio";
`tools/troll-ops-map-capture.mjs`, `-to-studio`, `-from-studio`,
`maps/trollcity-studio.js`), so Kabukigrin reuses that pipeline and the
same rule: **Studio owns the statics, code owns what moves.** No Blender.

### 6.1 The place

A new place of its own: `assets/games/troll-ops/Kabukigrin (edit).rbxl`,
untracked like `Troll City (edit).rbxl` and `TrollFace Island (edit).rbxl`,
never committed. The user makes it (File > New, Baseplate, Save As), then I
drive it over the Studio MCP; only the user saves (Ctrl+S). Never run Luau
in the other two places. 1 m = 3 studs, same axes as three.js (y up, -z
north); the layout's origin is Studio's origin and the root's WorldPivot is
pinned there from the start (the Troll City lesson).

### 6.2 Step A: the two live maps into the place

`node tools/troll-ops-map-to-studio.mjs --map grinjuku` and
`--map trollingloud` into the same place; the tool grows a `--map` beyond
Troll City:

- **Grinjuku** lands at the origin, as the base. Its colliders are already
  a box list (`grinjuku-layout.js` solids), so each becomes a Part named by
  its kind and side (`A/terrace_3`, `B/stall_1`, `mid/mailwall_2`),
  CanCollide, with its `pen` as an attribute; stairs, ropes, lights, spawns
  and sites become Markers. Its art is the four GLBs (`gj-shell`, `gj-props`,
  `gj-neon`, `gj-skyline`), which the exporter reads with GLTFLoader and
  sends as EditableMesh MeshParts per material (the `meshes` path the tool
  already has), `gj-skyline` locked as reference.
- **Trolling Loud** lands at x +120 as a parts library (`TL_Library`), to
  pull from. `trollingloud.js`, `-kit.js` and `-kitchen.js` join the
  capture's WATCHED list so every piece knows its builder (`booth`,
  `column`, `speakers`, `cases`, `cocktail`, `stool`, `armchair`, `plant`,
  the stage, the bar, the chandelier): one Model per prop. The `Neon`
  batches aren't the Kit, so the capture hooks `Neon.flush` too and sends
  them as locked Live meshes: they are the pulsing layer and stay code (6.4).
- Both exports are re-runnable; the place keeps what Studio changed.

### 6.3 Step B: remodel in Studio

Section 3 is the brief; the Studio work is laying it out for real:

- Clear the A side's Grinjuku pieces that go (the stall, the kiosk, the
  vending machine, the konbini; 5) into `ServerStorage.KB_SetAside`, never
  Destroy (Troll City lost markers that way).
- Build the club's shell from Parts (Roblox material family → the game's
  surface map, as Troll City's new Parts do): walls, the mezzanine deck, the
  stage, the bar counter, the back of house, the yard. CanCollide Parts are
  the colliders; see-through non-colliding Parts are trim.
- Drag the club's furniture in from `TL_Library` (booths, columns, speaker
  stacks, cases, cocktail tables, stools, the DJ booth, the fridge). Dragged
  pieces keep their piece number, so the export rebuilds them from the
  game's own geometry and materials wherever they went.
- Hero props with `generate_mesh`, as Troll City's: the marquee, the kanji
  strip sign, the koi tank, the tatami platform and shoji doors, the pachinko
  front, the noren, lanterns, the tanuki, the ramen counter, the tour van,
  the train body. Short prompts, three at a time, `ScaleTo` after; raycasts
  exclude the preview folder.
- Markers, by name, in each model's `Markers` folder: the 16 spawns, the two
  sites, the four ropes (`a-mid`, `a-site`, `b-mid`, `b-site`), the stairs,
  the 14 lights with colour and beat flag, every seat (`seat:booth_3:1`),
  the line slots and the two podiums, the lobby spawn, the NPC spots
  (`npc:vendor`, `npc:koban`), the audio zones (`zone:hall`, `zone:boh`,
  `zone:aMain`), the shootable groups (`shoot:koi`, `shoot:mirror`), the
  VIP and back-of-house door zones.
- `tools/troll-ops-map-preview-studio.mjs` drops the code-drawn live layer
  (the dance tiles, the arches, the chandelier) into `KB_Preview` so the
  statics are built round it at the right heights.

### 6.4 Step C: back into the game

`node tools/troll-ops-map-from-studio.mjs --map kabukigrin --write`
(the tool takes `--map` and per-map output paths) writes:

- `models/kb-town.glb`: every still piece, one mesh per material, keyed by
  the Kit's material key or `gen:<hash>`;
- `maps/kabukigrin-layout.js`: the colliders from CanCollide Parts, the
  stairs, ropes, lights, spawns, sites and every marker above.

`maps/kabukigrin.js` then loads them the way `trollcity-studio.js` does and
adds the **live layer in code**, which is Trolling Loud's: the 128 BPM
clock (`U`), the dance floor's LED tiles over the mirror pit, the nested
arches and the starburst, the chandelier, mirror ball and moving heads,
the lasers, the bottle wall segments, the shootable signs, the troll DJ, the
crystal wall, the marquee's beat, the east wall's LED windows, the koi and
the mirror window (`onShot`), the train, the muffled booth chain, the line,
the door and the seats (`rp`). Those builders move out of `trollingloud.js`
into `maps/club-live.js` with a `plan` argument (DANCE, STAGE, the arches'
frame, the bar's segments) so both maps call them; `trollingloud.js` with
its own plan is pixel-identical (`trollingloud-shots`).

Registration as before: `MAPS.kabukigrin`, `MODES.socialize.maps`,
`map-load-screen.js`, `prefetch-manifest.json`, `ambience.js`.

Contract test, after Troll City's: colliders and markers match the layout,
the 16 spawns and 2 sites are where section 3 puts them, the three routes
into A are the only ones (`map-walk`), the ropes climb (`rope-test`), and
the GLB stays under Troll City's 17.5 MB.

Performance: the same light cap as Trolling Loud (14), half its NPCs; GLB
size and phone fps are the checks, by `tools/troll-ops-map-fps.mjs`
against main.

### 6.5 Phases (each its own session, tests named)

| # | Phase | Done when |
|---|---|---|
| 0 | the tools take `--map`: capture reads a GLB-built map (Grinjuku) and watches Trolling Loud's builders + `Neon`; from-studio gets per-map outputs; the new place made by the user and both maps exported into it | both maps stand in the place; a no-edit export round-trips Grinjuku byte-for-byte (contract test) |
| 1 | Studio: clear the A side, build the club's shell and back of house from Parts, drag the library furniture in, place the markers | export → `kabukigrin_wip` loads with colliders; `map-walk` and `rope-test` pass; 3 routes into A |
| 2 | `maps/club-live.js` extraction; Trolling Loud rebuilt on it | `trollingloud-shots` matches before/after; `trollingloud-test` passes |
| 3 | the live layer on Kabukigrin (dance floor, stage, chandelier, bar, lights, seam pieces) over the Studio statics; the two video screens and their loops (clips drawn with the user); `generate_mesh` hero props: marquee, kanji strip, DJ wall frame | shots from 6 views reviewed by the user |
| 3b | the borrowed rooms in Studio + their live bits: the yokocho (3.5 b), the tatami VIP and koi wall (c), the office and its mirror window (d) | shots reviewed; `club-entry-test` passes with the VIP door guarded |
| 4 | the clock, audio zones, light leak, shootables | `dj-test` adapted passes; walking the seam sounds right |
| 5 | Socialize: the line, podiums, lobby spawn, DJ Lulz, the two crowds, seats from markers | `club-entry-test`, `club-room-test`, `club-crowd-test` with `MAP=kabukigrin` |
| 6 | polish: pink puddles, posters, the pachinko front (a), B's street props (e), the train (f), load screen, blurb; drop the `_wip` | GLB size and phone fps within budget; the vote pool shows it |
| 7 (opt.) | the Sky Bar (Socialize only), Zombies spawns | — |

About 7-9 sessions, going by Troll City's redesign (phases 1-2 in two
days) and Trolling Loud (2-3).

## 7. Decisions (all SETTLED 2026-10-20)

1. **The concept:** A side indoors, B side as is.
2. **Name:** Kabukigrin. Blurb: *"Kabukicho after midnight. Trolling Loud's
   Tokyo branch on one side of the street, the alleys on the other, and a
   bomb site on the dance floor."*
3. **The ropes:** both kept as ropes (bots proven), dressed as rigging.
4. **The roof:** closed in versus; the Sky Bar in Socialize later (phase 7).
5. **Zombies:** out at launch.
6. **The borrowed pieces (3.5):** SETTLED 2026-10-20, all six: (b) the
   yokocho, (c) the tatami VIP with the koi wall and (d) the office window
   in phase 3b; (a) the pachinko front, (e) B's street props and (f) the
   train in phase 6.
