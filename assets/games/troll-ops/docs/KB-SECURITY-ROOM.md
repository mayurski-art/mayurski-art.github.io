# Security room: CCTV and candle lines v2 (Kabukigrin, Socialize) — DESIGN DOC

Status: APPROVED 2026-11-01 with all five recommended picks (the office,
trays removed, 8 s rush, one chair, owner + VIP bands); not built yet. Builds on
CANDLE-LINES.md (v1, the tatami trays, live on main) and the underground
club (KB-CLUB-UNDERGROUND.md, live on main).

The user's ask: the candle line as in their concept video, done at a
computer, and "the context of having a computer stuff could be like a
security room with cctv camera screens", with CCTV cameras added in the
club.

## 1. The concept video, beat by beat

8.8 s, one shot, a troll at a desk in front of a monitor showing a chart:

1. He reaches **into** the screen and pulls a green candle out of the
   chart. That arm comes out green.
2. Lays it on the desk and rolls a bottle over it like a rolling pin.
3. A card chops it and drags it into a line, then gets flicked away.
4. Face-plant: the whole face goes down on the line, all of it at once,
   no bill.
5. Springs upright.
6. Launches straight up out of frame. The desk sits empty for ~1.5 s.
7. Hands grab the desk edge from below and he hauls himself back up over
   it, grinning.

Floor clutter in the shot: a spilled drink, tissues, a toilet roll, a
lotion bottle.

## 2. Where: the manager's office becomes the security room

The club rebuild kept the office at street level: x -14 .. -6.3,
z 19.1 .. 23.8, floor y 3, ceiling 7.4 (`maps/kabukigrin-rooms.js`). It's
already back of house (the `office` zone, guarded at the door), it
already has a desk, a chair and three fake camera screens
(`camFeeds()`, canvas blobs), and Big Boss already sits there. Its one-way
mirror now looks onto Lulz Square.

So it becomes the security room. No new room, no new collider, no new
door. (Pick 10.1: or a new room off B1 behind the staff stair.)

What changes in the room:

- **The monitor wall** moves to the east wall (the "Heaven wall",
  x -6.31, solid, 4.7 m wide). Today's three screens sit on the desk
  facing the window at x -13.4 and cover the window's lower edge from the
  chair, which breaks rule 9, so they go.
  - A 4 x 2 grid of 24" monitors (0.54 x 0.32 m each, 2 cm black bezels,
    4 cm gaps), y 4.1 .. 4.8, z 20.4 .. 22.8, on a slim wall bracket.
  - Under them, on the desk, the **chart monitor**: one bigger screen
    (0.7 x 0.42 m) showing the $TROLL chart, green candles stepping up.
    This is the one he reaches into.
- **The desk** turns to face east: x -8.2, z 21.6, 1.6 x 0.75 m, top
  y 3.75, black laminate with a glass top (the line's cut on the glass).
  Keyboard, mouse, a radio on a charger, a coffee cup, the bottle.
- **The chair**: one office chair at x -9.1, facing east, back to the
  window, so whoever sits sees the wall and the window shows them from
  the square. (Pick 10.4: one seat or two.)
- **The clutter** (from the video) on the floor beside the desk, not in
  any line of sight to the wall: a spilled cup and its puddle decal,
  crumpled tissues, a toilet roll, a lotion bottle, a pizza box.
- **Light**: the room goes dark, lit by the monitor wall's glow (one
  cool-blue rect light from the wall, no runtime point light, so no
  shader recompile) and a desk lamp.
- **Signs**: a 警備室 (security room) plate on the stair door, and the
  door's existing guard.

## 3. The CCTV cameras

Ten cameras, each a real object in the world and a live feed on the wall.

| # | label | where (x, y, z) | looks at |
|---|---|---|---|
| 1 | 01 SQUARE | -24, 4.2, -0.4, on A Heaven's wall over the stair mouth | Lulz Square and the line at the door |
| 2 | 02 DOOR | -26, -1.0, 1.0, the front stair's ceiling at its foot | down the stair at the Socialize door |
| 3 | 03 BALCONY N | -12.2, -0.9, 4.6, the north arm's NE corner | the north arm's booths |
| 4 | 04 FLOOR NE | -7.2, -0.8, 4.6, the hall's NE ceiling corner | the dance floor from above |
| 5 | 05 FLOOR SW | -31.2, -0.8, 29.6, the hall's SW ceiling corner | the floor towards the bar |
| 6 | 06 BAR | -9.0, -4.1, 9.6, under the east arm, the bar's north end | along the counter and the stools |
| 7 | 07 DJ | -14, -4.0, 12.2, under the north arm's fascia | the stage and the booth (side on, never across the LED wall) |
| 8 | 08 BOOTHS S | -9.0, -0.9, 29.6, the south arm's SE corner | the south arm's booths |
| 9 | 09 VIP | -31.6, 2.6, 24.4, the tatami room's NW corner | the tables and the koi tank, side on |
| 10 | 10 STAFF | -18.5, -1.4, 36, the tunnel's ceiling | the staff stair and the tunnel |

- The spots are first picks from the club's plan; section 8's check
  moves any that block something.
- **The model**: a white dome camera on the ceiling ones (11 cm across,
  6 cm deep), and a bullet camera on a short arm for the wall ones (19 cm
  long, a sunshade hood, a red LED that blinks on the live one). Built in
  code, one instanced mesh per kind.
- **Mounting**: in corners and under fascias, flush with the ceiling or
  the wall, never on a screen, a sign, the LED wall, a mirror or a
  doorway's face (rule 9, section 8).
- **Shootable**: a shot camera sparks, droops on its mount and goes to a
  "NO SIGNAL" card on the wall for 60 s, then it's fixed (the same timer
  as the mirror and the koi tank).

## 4. The feeds

- **Render to texture**: one 256 x 144 render target per camera. Only
  while some player's camera is in the office, one feed renders per frame
  (round robin), so each feed updates at 60/10 = 6 fps, which reads as
  CCTV. Nothing renders when no one's in the room.
- **Cheap renders**: no shadows, no post pass, no FP layer, the far plane
  at 40 m; the club's lights and the LED floor still show.
- **The look**: a monitor shader over the feed: slight desaturation and
  a green-grey tint, grain, scanlines, a soft vignette, and a canvas
  overlay with the label, the date and a running clock
  (`2026-11-01 23:41:07`), REC with a blinking dot on one.
- **It's live**: players and NPCs show up, so you can watch your friends
  on the floor or see who's queuing at the door.
- **Peek**: hold X at the wall to look at one monitor full screen, and
  Q / E (or the pad's bumpers) to flip cameras. Esc or moving lets go.
  Rotating through one feed at a time costs the same as the wall.
- **Chart monitor**: a canvas (no render): the $TROLL candles from
  CANDLE-LINES.md's chart, scrolling, the tallest candle glowing.

## 5. The act: candle lines v2

Sit in the chair and hold X: **"Pull a candle"**, 0.4 s, the same prompt
and ring as v1. Same rules: not with a drink, not mid-fight, not mid-rush,
not in the cooldown ("Market's closed · 1:12"). It plays out by itself,
about 8.4 s. Moving, jumping or getting hit before beat 5 cancels it, and
the crushed candle stays on the glass for 20 s for anyone to finish.

| # | t (s) | first person | third person |
|---|---|---|---|
| 1 | 0.0–0.6 | lean in to the chart monitor, hands up | leans in over the desk |
| 2 | 0.6–1.8 | the right hand pushes **into** the chart monitor; the screen ripples round the wrist (a distortion ring in its shader), grips the tallest candle and pulls it out; the arm's green to the elbow | the same: the hand goes into the screen and comes out with the candle |
| 3 | 1.8–3.0 | lays it on the glass; the left hand rolls the bottle over it twice, it cracks and flattens, green dust puffs | rolls the bottle |
| 4 | 3.0–4.0 | the card chops, chops, drags a line, then flicks off over the shoulder (it lands on the floor and stays with the clutter) | chops, flicks the card |
| 5 | 4.0–4.8 | face-plant: the camera drops onto the line, the screen goes green, one huge sniff, the line's gone | face down on the desk |
| 6 | 4.8–5.2 | springs upright, eyes wide, **STONKS** stamps in | snaps upright |
| 7 | 5.2–7.0 | **launch**: you shoot straight up, through the ceiling and the roof, into the sky over Kabukigrin; the city's lights drop away, apex ~35 m at 6.1 s, then you fall | rockets up with a green trail; the chair spins on its own; the desk sits empty |
| 8 | 7.0–8.4 | you drop back in behind the desk, out of sight; your hands grab its edge in front of you and you haul yourself up over it | two hands on the desk edge, then the grinning head rises over it |

Then the rush and the rug pull from v1's `view/stonks-fx.js`, shorter:
**8 s at x1.25, then 12 s at x0.85** (pick 10.3). The green arm fades out
over the rush.

How the launch works:
- It's a scripted path. Collisions are off for beats 7–8 and you're put
  back in the chair at the end, so nothing can get stuck in the roof.
- The ceiling and the roof get no hole: a dust puff and a crack decal at
  the spot for 3 s, inside and on the roof.
- Nothing can hit you from beat 5 to the end (you're mid-air, out of the
  map's play space).
- Peers see the whole flight, because your position is sent as normal.

## 6. The guard

- **Who**: a security guard NPC, **Lurk** ("Security"), in a black
  bomber, a radio and a cap. A troll body now (the club's NPC kit); a
  human body later, when KB-HUMANS.md's driver lands.
- **Where**: he sits in the chair and watches the wall. Big Boss stands
  by the stair door, on the phone.
- **His line**: about every 2 minutes, when the chair's free of players
  and someone's in the room or watching it through the window, he does
  the whole act, launch and all. The room's oldest client picks the
  moment, the way v1's VIPs are picked.
- **When you walk up**: he gets up and stands by the wall with his arms
  folded while you're in the chair, then sits back down.

## 7. The tatami trays (v1)

Recommended: they go (pick 10.2). The security room is the line now, and
the tatami tables go back to bottle service only. v1's props, timeline,
net and test move over to the new act; the tray kit is deleted.

## 8. Rule 9

- **The cameras**: from a grid of eye points across the hall floor, the
  balcony, the stairs, the square and the tatami room (standing,
  crouched, 0.3 m steps), raycast to grids on the LED wall, both hall
  screens, every sign face, the bar's back shelf, the koi tank, the
  mirror and every doorway, against every camera's box. Any hit moves
  that camera. Then each camera head-on and from two angles.
- **The room**: from eye points across the office (the chair, standing
  at the door, crouched), raycast to the monitor wall, the chart monitor
  and the window. The desk kit and the clutter stay below the chart
  monitor's lower edge and outside the chair-to-wall lines. And the
  window from the square to the room.
- **Overlaps**: a box-overlap check across the cameras, the desk kit,
  the clutter and every existing prop.

## 9. Files and commits (one system each)

1. **Cameras + feeds**: `maps/kabukigrin-cctv.js` (new): the camera
   models, the render targets, the round robin, the monitor shader, the
   shot-out timer. `kabukigrin-rooms.js` loses `camFeeds()` and the desk
   screens, and gains the wall, the desk, the chair and the clutter.
2. **Peek**: `modes/social-cctv.js` (new): hold X at the wall, flip
   cameras.
3. **The act**: `modes/social-lines.js` moves from the tatami tables to
   the chair, with the new beats, the launch path and the guard; the tray
   kit leaves `maps/kabukigrin-lines.js`.
4. **The effect**: `view/stonks-fx.js` gets the 8 s rush and the green
   arm.

**Tests:**
- `tools/troll-ops-cctv-test.mjs` (new), headless, private room, Supabase
  blocked: ten cameras exist; feeds render only with a player in the
  office; each feed's pixels change when an NPC walks through it; a shot
  camera goes to NO SIGNAL and comes back; section 8's raycasts;
  screenshots of the wall, the peek and three cameras.
- `tools/troll-ops-lines-test.mjs` moves to the chair: each beat's
  state, the launch's apex and the return to the chair, the speeds, the
  cooldown, the guard's turn, a cancel; screenshots per beat (first and
  third person).

## 10. Picks for the user

1. **Where**: the manager's office becomes the security room
   (recommended: it's built, guarded, has a desk and fake screens
   already, and its window lets the square see you launch), or a new
   room on B1 behind the staff stair.
2. **The tatami trays**: removed, the security room only (recommended),
   or keep both.
3. **After the climb**: a short rush, 8 s at x1.25 then the 12 s rug pull
   (recommended), or the launch is the whole high (no speed change), or
   keep v1's 20 s.
4. **Seats**: one chair (recommended), or two side by side.
5. **Who gets in**: the owner band and the VIP band (recommended: the
   guard waves VIPs up, the same people v1 let at the trays), or the
   owner band only, as the office is today.
