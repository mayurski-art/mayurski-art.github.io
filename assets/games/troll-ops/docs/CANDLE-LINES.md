# Candle lines (Kabukigrin, Socialize)

The joke is crypto. A green candle, the one off the stonks chart, gets
crushed on a mirror into green powder, cut into a line with a card, and
snorted through a rolled-up bill. You get a stonks rush, then a rug pull.
Socialize only (the club's `rp` hooks never run in versus). Cosmetic plus
a short speed change. Nothing is won or lost.

Status: draft, waiting on the user's picks (section 9).

## 1. Where the tables go

These are tables that already stand in Studio's furniture
(`kabukigrin-layout.js` colliders). No new collider is needed unless pick 9.1
says so.

| spot | table (centre, size, top) | who reaches it | why |
|---|---|---|---|
| **Tatami VIP room, table 1** | (-29.9, 25.9), 1.2 x 0.8, top 0.75 | VIP and owner bands (the door already guards the room) | bottle service already happens here. It's the "VIP lounge" the joke wants |
| **Tatami VIP room, table 2** | (-29.9, 28.3), 1.2 x 0.8, top 0.75 | same | |
| **Tatami VIP room, table 3** | (-24.9, 27.0), 0.9 x 1.2, top 0.75 | same | |
| *(option)* green room coffee table | new: (-8.5, 32.3), 1.0 x 0.5, top 0.42, in front of the sofa | anyone backstage (staff band) | the "headliner's dressing room" version. Needs one new collider and Studio-matching art |

Each tatami table gets a **mirror tray** with a **candle stand** at the end
away from the koi tank. A player kneels on the cushion beside the table
(the cushions are `rp.seats` already) or stands at its open side.

## 2. Props (built in code, `maps/kabukigrin-lines.js`)

All of it lies flat on the table top. The tallest piece is the candle
stand at 9 cm (rule 9, section 7).

- **Mirror tray.** 36 x 26 cm, a 1 cm gold bevel frame with rounded
  corners, glass at metalness 1 / roughness 0.04 reflecting the club's
  env map (the office mirror's smeared-neon texture as a fallback). A
  few smudges and one old green streak left on it.
- **Green candle stand.** A small acrylic chart block: five candlesticks
  stepping up left to right, each a rounded green body (stonks green
  `0x1fd35a`, emissive 0.35 so it reads in the dark room) with thin
  wicks top and bottom, and one red candle (the dip) in the middle for the
  joke. The far-right candle (the tallest) is the one you take. It's back
  on the stand after every line, as if the market printed a new one.
- **The card.** A matte black card, 85.6 x 54 mm, rounded 3 mm corners,
  with a gold chip and "$TROLL" embossed on it. It does the crushing and
  the cutting. (Pick 9.2: or a hardware-wallet stick.)
- **Green powder.** Two states. The **pile** is ~120 instanced grains,
  seeded, settled into a mound. The **line** is a 12 cm strip with jagged
  edges (a ribbon mesh with seeded noise along both edges) plus loose
  grains beside it. Same green, slightly emissive, with a faint glitter
  sparkle. A clip value in the shader eats the line from one end to the
  other as it's snorted.
- **Rolled bill.** A rolled note, 9 cm long, about 6 mm across. Its
  canvas texture is a green-grey note reading "ONE TROLL", with the
  trollface ART as the portrait (assets/images/icons, never the emoji),
  the serial ending in 420, and the roll's spiral edge visible at each end.

The props are cheap: one draw call per kind across the three tables
(instanced), and the props only animate while someone uses that table.

## 3. The interaction

Hold X by a table (the same prompt and progress ring as every Socialize
hold-X action, through `rpExtras` in `social-rp.js`): **"Cut a line"**,
0.4 s hold. On a pad it's the pad's button name. On touch it's the use
button. The prompt shows when you're within 1.1 m of the table's open side
or kneeling on one of its cushions. You can't start one with a drink in
hand ("Hands full"), during a fight, mid-rush or during your cooldown
("Market's closed · 1:12").

It then plays out by itself (about 5.6 s). Moving, jumping or getting hit
before beat 6 cancels it: the powder stays on the mirror for 20 s, and
anyone, you included, can hold X there to "Finish the line" from beat 5.

## 4. Animation beats

| # | t (s) | first person | third person (what everyone else sees) |
|---|---|---|---|
| 1 | 0.0–0.6 | the camera eases down to the mirror (pitch -55°, a 0.25 m lean), and both hands rise into view | kneels (the cushion pose) or bends at the hips over the table |
| 2 | 0.6–1.2 | the right hand plucks the tall green candle off the stand and lays it on the mirror | right hand reaches the stand, then the mirror (`reachHand`) |
| 3 | 1.2–2.4 | the card presses down three times. The candle squashes and cracks, and a puff of green dust rises with each press. Crunch sfx | right hand pumps on the mirror. A green puff on each press |
| 4 | 2.4–3.6 | chop, chop, then a long drag. The pile spreads into the line. Card scrape sfx | small chopping motion |
| 5 | 3.6–4.2 | the left hand brings the rolled bill up from below the frame to the nose | left hand to face, with the bill in it |
| 6 | 4.2–5.0 | the camera tracks along the line as it vanishes end to end. A big sniff sfx | head sweeps along the table |
| 7 | 5.0–5.6 | the head snaps back (pitch kick +12°, a 4-frame shake), the screen flashes green, and **STONKS** stamps in | head jerks back, then a shake |

The hands are the club's FP hands (gloves, the arms' rig), posed with the
same helpers the drinks use (`setHandPose`, `reachHand`). The gun is
holstered for the whole thing, as it is when you sit.

## 5. The effect: stonks rush, then rug pull

This lives in its own module (`view/stonks-fx.js`) with its own state, so
it coexists with the bar session's tipsy and pass-out. Camera offsets
add to tipsy's, and each is clamped on its own.

**Rush, 20 s:**
- **Speed:** walk and run x1.25 (Socialize only).
- **Vision:** saturation x1.6 and a green split tone in highlights
  (`grade-pass.js`'s `uSat` and tint, multiplied in, not overwritten).
  Bloom +15%. FOV +6°, which eases in.
- **Chart overlay:** a translucent HUD layer. A green candlestick chart
  scrolls up the left and right edges, and the price line spikes each time
  you sprint. A ticker along the top reads "$TROLL +420.69%" and counts up.
  It never covers the crosshair's middle third, the chat, or the prompts.
- **Jitter:** a fast camera tremor, 0.25° at most, plus a heartbeat pulse
  on the vignette. If the game has a reduced-motion setting, the jitter
  scales down with it.
- **Sound:** a heartbeat, a faint ticker tape and a bell on the start.
- **What others see:** a green dusting on your trollface's nose (a
  decal) and a small green up arrow by your nametag.

**Rug pull, 12 s:**
- The chart turns red and crashes off the bottom. "RUGGED" stamps in.
- Saturation x0.6 and a slight grey tint. Speed x0.85.
- Slow heavy sway instead of the jitter. A sigh sfx.
- Then everything eases back to normal over 2 s.

**Cooldown:** 90 s from the snort until your next line. Dying, leaving
the match or the map change ends everything at once.

## 6. Net sync

- **Start:** `publishRp({ k: "line", table, at })`. Every client plays the
  same timeline on that table from `at`, so the props and the third-person
  body match. Only one line runs per table at a time. On a tie, the lower
  id keeps it, the way `otherWithRole` settles other ties.
- **Cancel:** `{ k: "line", table, cancel: beat }` leaves the powder there
  for 20 s, and `{ k: "line", table, finish: true }` ends it.
- **Your state:** one field on the state packet, `stk` (0 = clear, 1 =
  rush, 2 = rug pull), drives the nose decal and the arrow for others.
- A late joiner just sees the clean tables. Nothing persists.

## 7. Rule 9 (nothing blocks anything)

- The props lie on the table tops (0.75 m). The candle stand is under
  9 cm and sits at each table's east end, away from the koi tank
  (x -31.2, y 0.8–2.3). The mirror and the line are under 1.5 cm.
- **Check before showing:** raycast from a grid of eye points across the
  tatami room (standing, crouched and kneeling, at 0.3 m steps) to a
  grid on the koi tank face, the noren, the lattice window and the
  shoji doors, against the props' boxes. Any hit means the prop moves.
  Then screenshots of each table head-on and from two angles. The props
  also never touch the NPCs' cups or each other (box-overlap check).

## 8. Files and commits (one system each)

1. **Map props:** `maps/kabukigrin-lines.js` (new) builds the props, and
   `kabukigrin.js` gets `rp.lines()` (the tables plus the prop handles).
2. **Interaction and anims:** `modes/social-lines.js` (new) handles
   hold-X, the timeline, the FP/TP poses and the net. It's registered from
   `modes/social.js`.
3. **Effect:** `view/stonks-fx.js` (new) handles the rush and rug pull,
   the overlay, grade and speed. It's hooked in `view/player-update.js`
   next to tipsy, as a two-line call.

game.js isn't touched. Each change bumps its own ?v= tags. The cascade
waits for the session that merges the branches (rule 1).

**Test:** `tools/troll-ops-lines-test.mjs` runs headless in a private
room with Supabase blocked. It loads Kabukigrin Socialize as VIP, puts the
player at table 1 and holds X. It steps the clock and checks each beat's
prop state, the speed x1.25, then x0.85, then x1, the cooldown prompt,
the published message, and a cancel. It also runs section 7's raycast,
then takes screenshots of the props per beat and of the rush and the rug
pull.

## 9. Picks for the user

1. **Where:** the tatami VIP room only (recommended: it's already
   guarded and it's the "VIP" joke), or that plus the green room's new
   coffee table, or that plus the three booth tables in the hall
   (public, so anyone can).
2. **The crusher:** a black $TROLL card (recommended), or a
   hardware-wallet stick.
3. **Rush strength:** 20 s at x1.25 speed, then a 12 s rug pull at x0.85.
   Fine, or something else?
4. **NPCs:** should one of the VIP NPCs do a line now and then (Bubbles
   brings a fresh candle)? Recommended yes, about one every 2 minutes,
   with the same props and anim.
