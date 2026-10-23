# Grin Beach 5d: court games (basketball, tennis, volleyball)

Draft 2026-10-23, for the user's OK. Socialize, Grin Beach. Builds on the surf
(`modes/social-surf.js`: shared clock, state in the packet, NPCs driven on a
cycle), the arm wrestle (`modes/arm-wrestle.js`: one client drives a bout and
tells the room) and the room clock (`modes/room-clock.js`). The courts are the
ones already built: `COURT`, `TENNIS`, `VB` and `RIMS` in `maps/grinbeach-venice.js`;
the "ready" ballers in `maps/grinbeach-social.js` become the players.

## What the user asked
Real volleyball, basketball and tennis on the courts. "The basketball skills,
dribbles etc. should be really good", "think of NBA 2K", "as well as the tennis
plays". So: basketball is the flagship and gets 2K's feel (dribble moves off a
stick, a shot meter with a green release, contests, layups and dunks); tennis
gets real strokes, spin and scoring, not a pong paddle; volleyball is the
lightest of the three.

## The three tools
- **Blender** (`models/build_grinbeach.blender.py`, new `build_courtgear`):
  `gb-basketball.glb` (0.24 m, eight seams, pebbled normal), `gb-tennis-ball.glb`
  (0.067 m, felt, the curved seam), `gb-volleyball.glb` (0.21 m, 18 panels, white/
  blue/yellow), `gb-racket.glb` (0.69 m, strung with real cross-strings), a ball
  rack for each court (where you take a ball), a chalkboard scoreboard a court
  (its board is a canvas the game writes). The hoop nets go in `gb-venice`: a cone
  of 12 strings with a loose bottom ring, plus a "swish" morph (the net flares and
  snaps back) the game plays on a make. The tennis net already exists.
- **three.js**: everything that moves. One shared ball core (`modes/court-ball.js`),
  a module per sport (`modes/social-hoops.js`, `social-tennis.js`, `social-vball.js`),
  the court session and scoreboard (`modes/court-game.js`), the HUD (shot meter,
  score card) in `core/hud.js` + `style.css`, and `maps/grinbeach-social.js`
  exposing `rp.courts()`.
- **Roblox Studio** (TF_Rig in "Troll Forces Anims (edit).rbxlx", main checkout):
  every pose below, exported one at a time with `tools/troll-ops-roblox-anim.mjs serve`.
  Clips carry **markers** (the tool already exports them): `release`, `contact`,
  `plant`, `toss`. The game fires the ball on the marker, so the hand and the ball
  always agree. About 30 clips over the three sports (list at the end).

## The ball: one physics, every client agrees
Netcode is client-authoritative, so the ball can't have a server. Instead the
ball is **deterministic from its launch**:
- `court-ball.js` steps at a fixed 240 Hz: gravity, drag, Magnus lift from spin,
  bounces (restitution + spin flip on the ground, the rim, the backboard, the
  posts, the nets as soft planes), the hoop test (centre passes down through the
  rim disc), line calls (the bounce point against the court lines).
- A **launch** is `{p, v, w (spin), at (room ms), by}`. Whoever hits the ball
  sends it as rp `{k:"bl", c:<court>, ...}`; every client integrates the same
  numbers from the same room time and gets the same flight, the same rim rattle,
  the same bounce, the same OUT. Late joiners get the last launch from the
  host's packet. Doubles are rounded to 4 dp before sending so every machine
  starts identical.
- A **catch / hit** is the moment a player's swing or hands meet the ball: the
  catcher sends `{k:"bc", c, by, at}`; on a tie the lower id keeps it (the arm
  wrestle's rule). The holder then owns it: dribbling is cosmetic (in the state
  packet), the next launch is theirs.
- Shot outcomes are decided on the shooter's client **before** the launch: the
  meter error becomes a scatter on the launch velocity, so a perfect release
  swishes on everyone's screen and a late one clanks the same way everywhere.

The node test `tools/troll-ops-court-ball-test.mjs` runs the integrator headless:
the same launch twice gives bit-identical flights; a straight-down swish scores;
a rim-front shot bounces; a topspin tennis ball bounces lower and longer than a
slice; a ball on the line is IN.

## Basketball (`social-hoops.js`): NBA 2K on the south half
The south hoop (`RIMS[0]`) hosts the game; the north hoop is free shootaround.
Half court, streetball rules.

**Getting on.** Take a ball from the rack by the fence (hold X, like a surfboard).
Hold X at the scoreboard: "Run it" starts a game; "Next" queues you. 1v1 by
default; 2v2 if four are there; NPC ballers fill empty spots (the shootaround
three plus named legends, below). Winner stays.

**Camera.** On the court the view goes to an over-the-shoulder third person
(the existing 3P with a longer boom, 3.2 m back, 1.6 m up, slight down tilt).
The mouse still turns you. Off the court or on "Leave", the view goes back.

**Handling (the 2K part).**
- Moving with the ball dribbles it automatically: the ball hand is the one away
  from the defender; sprint is a speed dribble, lower and quicker; stop and the
  dribble stays alive (a pound dribble at the hip).
- **Size-up mode: hold right mouse** (controller: the right stick, as in 2K;
  phone: a dribble pad replaces the fire button while you hold the ball). While
  held, mouse motion is the stick, not look:
  - flick left / right: **crossover** to that hand;
  - flick back: **behind the back**;
  - flick forward: **hesitation** (a stutter, then a burst if you move);
  - half-circle: **spin**;
  - flick back + jump: **step-back** (into a shot if you fire);
  - two flicks in rhythm: **combo** (cross-to-behind, double cross), a bigger break.
- Every move has `break` (how far it shifts the defender's feet) and `cost`
  (stamina). The defender's lateral speed and reaction (skill-tiered, below)
  decide if they bite: a bit defender is frozen 0.3-0.6 s and a lane opens; a
  move read is wasted stamina. Holding the ball too long lets the defense set,
  so the game rewards move-then-go.
- **Stamina**: sprinting and moves drain it; low stamina slows you and widens the
  shot meter's error. It refills off the ball.

**Shooting.** Hold fire to go up; the **shot meter** fills beside you (a 2K-style
vertical bar), release in the green for a perfect. The green window is set by:
distance (shrinks with range), contest (a hand within 1 m of the release point
halves it), balance (moving shots and fadeaways shrink it; a set shot after a
stop is widest), stamina, and the shooter's tier. Shot picked by context:
- standing jumper (stopped), pull-up (moving, fire), step-back (RMB back + jump
  + fire), fadeaway (moving away from the rim), floater (inside 3 m, moving,
  quick release, over a contest), bank (angled within 45° of the board),
- **layup** (fire inside 2 m driving): finger roll straight on, euro-step when
  you cut across, reverse when you pass under,
- **dunk** (sprint ≥ 3 m into a clear lane, jump, then fire): an arcade leap, one
  or two hands by direction, the rim gives and snaps back; a defender in the
  lane turns it into a contested layup instead.
Makes: swish (perfect), rattle-in (small error), rim roll. Misses: front rim,
back rim, airball off a wide miss. Two-pointers behind the arc (the painted
line), ones inside. "Excellent release" / "Late" / "Early" flash on the meter.

**Passing** (2v2): E passes to the teammate you look at (chest pass; a bounce pass
if a defender's legs are between; a lob if they're cutting to the rim: catch in
the air near the rim and fire = alley-oop dunk). Passing counts for an assist
line on the scoreboard.

**Defense.** Hold Ctrl (RMB without the ball): **stance**, lower, quicker sideways,
slower forward. Fire: **steal reach**: succeeds if the ball is on the far side of
the handler's dribble cycle and your hand reaches it; a whiff leaves you a step
behind (0.4 s) and the handler's lane open. Jump: **contest / block**: a hand in
the shot's release cone shrinks their green; a hand on the ball path in the
first 0.3 s of flight is a block (the launch gets a deflection from the blocker
and that is the new flight for everyone). Body collision boxes out for rebounds.

**Rebounds.** A miss is live; the ball bounces for real. Jump near it to grab (the
first "bc" wins). On a defensive rebound you must **take it back** past the arc
before scoring; make-it-take-it after a score, **check ball** at the top (the
holder walks it out, the game marks the top of the key).

**Rules.** To 11, win by 2, 2s and 1s. Out of bounds: check to the other side.
Game over: the winner's name on the scoreboard and a wave banner; "Next" steps
on. A daily tally per opponent in this browser (the arm wrestle's), and a court
record: longest made streak, best 3-pt shootout.

**3-pt shootout** (shootaround extra, solo or two players): five racks of five,
the money ball last, 60 s, the scoreboard counts.

**NPC ballers.** Tiers 0.4-0.95 drive reaction (0.5 → 0.15 s), lateral speed,
green window, move repertoire and shot selection. On offense they size up when
you're set, drive when you're a step late, pull up when open at their range,
pass out of a double. On defense they shadow between ball and rim, bite on moves
by `break × (1 − skill)`, contest every shot, box out. Named legends with styles:
**Hoops Hank** (post-up, backs you down, hook), **Crossover Carla** (handles,
pull-up threes), **Big Grin** (rim protector, dunks everything), the shootaround
three (0.5-0.65) as the regulars.

## Tennis (`social-tennis.js`): real strokes, real points
**Getting on.** Hold X at the racket rack by the gate; hold X at the umpire's
chair: play **Deuce Dominguez** (NPC) or the next player to hold X. Formats:
a **tiebreak to 7** (default, ~3 min) or a **pro set to 4 games**. Singles;
doubles later.

**Camera.** The over-the-shoulder 3P from the baseline, boom 5 m back and 2.4 m
up so the whole court reads; it follows you sideways.

**Serve.** Fire tosses; fire again at the toss's apex hits (a timing window:
early is a weak serve, late a fault). Aim left/right with the mouse before the
toss: wide, body, T. Flat (fire), **slice** (right mouse: curves out wide),
**kick** (jump + fire: high bounce). Faults, double faults, lets (the net cord
replays), foot faults no.

**Strokes** (the Top Spin school: press early, the swing lands when the ball
arrives). You run to the ball; the stroke is picked by side (forehand / backhand,
two-handed backhand) and height (groundstroke, half-volley, volley within 2 m of
the net, **overhead smash** on a lob above you). The button you hold shapes it:
- fire: **flat** (fast, low margin),
- fire + W: **topspin** (dips, bounces high and long; the rally stroke),
- right mouse: **slice** (floats, skids low; a short tap = **drop shot**),
- jump + fire: **lob** (high, over a net player; bounces deep),
Hold longer before contact = more power. Direction = where you're looking at
contact (clamped to the court plus error). **Timing** decides the rest: the
ball's position against the body at contact (early → wide, late → cross and
short, perfect → your aim). A green "sweet spot" flash on a clean hit.

**Physics.** Spin (Magnus) curves and dips the flight; bounce flips spin and
changes the bounce height and speed; the net cord dribbles over or drops back;
line calls from the bounce point, a chalk puff and "OUT" / "FAULT" from the chair
(the band's synth voice does the calls: a two-note "out").

**Scoring.** 15 / 30 / 40 / deuce / advantage; the tiebreak counts 1, 2, 3...,
serves alternate every two points, sides change at 6. The score card sits top
centre (server marked). Game point and set point called.

**NPC.** Runs to the predicted bounce, chooses by position: topspin from the
baseline, slice when stretched, drop shot when you're deep, approach-and-volley
when you float a short ball; tiers drive error ellipse, pace and footspeed.
Deuce Dominguez is 0.7; **Ace Alvarez** at 0.9 is the boss.

## Volleyball (`social-vball.js`): 2v2 beach, rally scoring to 15
Hold X at the ball by the referee's chair. 2v2, NPCs fill (the four already
there). **Serve**: toss + hit (the tennis serve, lower). A side gets three
touches: **bump** (fire with the ball low), **set** (fire with the ball above the
head: a high loft to your partner, or over the net if you aim there), **spike**
(jump at the net then fire on a set: aim with the look; a timing window),
**block** (jump at the net as the attacker swings: a hand in the ball's path
deflects it, the deterministic way blocks work in hoops). Ball on the sand: a
point to the other side; serve rotates. To 15, win by 2. The lifeguard's whistle
calls points. NPCs: a passer and a hitter a side, tiers as above.

## HUD
A **score card** top centre during any game (hoops: 7-5, GAME TO 11; tennis:
40-AD, 6-5; vball: 14-13). The **shot meter** at the player's side (hoops) and
the **sweet spot** flash (tennis). Prompts at the racks and chairs reuse the rp
"hold X" bar. Phone: the dribble pad, a shoot button, a stance toggle; every
state measured at desktop and phone widths (no overlapping text).

## Wire
- State packet: `cg` (court game: 0 none, 1 hoops, 2 tennis, 3 vball), `cs` (sport
  state: holding / dribbling L / R / shooting / stance / serving...), `cm` the
  clip id + `ct` its room start (so peers pose the same frame), `cb` ball in hand.
- rp `{k:"crt", ...}`: the **host** (whoever started the game; on a leave, the
  lowest id of those on court) owns the session: roster, score, serve/possession,
  phase; it republishes every 2 s, so a late joiner sees the game.
- rp `bl` launches, `bc` catches (above). Blocks and net cords are ordinary
  launches by the client that caused them.
- Nothing in a public room is touched by testing; the tests block Supabase.

## Build order (one system a commit, a targeted test each, push on the user's word)
Tag suffixes `gb5` → `gb9`. Each phase lands its HANDOFF line.
1. **Ball core + gear** (`court-ball.js`, Blender balls/racket/racks/boards, hoop
   nets with the swish morph, `rp.courts()`): node test. ~1.5 h.
2. **Hoops handling**: pick up, dribble, size-up moves (Studio clips batch 1:
   12 clips), shot meter and shot types, layup/dunk, court camera, the wire for
   ball + handler. Test: two tabs, A dribbles and shoots, B sees the same flight
   and the swish. ~4 h (clips ~1.5 of it).
3. **Hoops game**: host/session, rules, scoreboard, defense, rebounds, NPC ballers
   and legends, the 3-pt shootout, HUD. Test: a scripted 1v1 vs an NPC to 11.
   ~4 h.
4. **Tennis**: racket, serve, strokes, spin bounce, scoring, calls, Deuce and Ace
   (clips batch 2: 9 clips). Test: a scripted tiebreak. ~4 h.
5. **Volleyball**: bump/set/spike/block/serve, 2v2 with NPCs (clips batch 3:
   6 clips). Test: a scripted rally. ~2.5 h.
Pushes after 3, 4 and 5 (basketball can go live on its own).

## Studio clip list (TF_Rig, markers in brackets)
Hoops: `hoop-dribble-r/l` (loop), `hoop-cross`, `hoop-behind`, `hoop-hesi`,
`hoop-spin`, `hoop-stepback` [plant], `hoop-jumper` [release], `hoop-layup`
[release], `hoop-dunk` [release], `hoop-pass` [release], `hoop-stance` (loop),
`hoop-steal`, `hoop-block`, `hoop-grab`.
Tennis: `tn-ready` (loop), `tn-fh`, `tn-bh`, `tn-fh-slice`, `tn-bh-slice`, `tn-volley`,
`tn-smash` [contact], `tn-serve` [toss, contact], `tn-lob`.
Vball: `vb-bump`, `vb-set`, `vb-spike` [contact], `vb-block`, `vb-serve` [toss,
contact], `vb-ready` (loop).

## Rules
- Nothing new in game.js; new modules in `modes/`, props in `maps/`.
- Never import a job module from `menu/buttons.js` or `view/third-person.js`.
- Never `sed -i` over `*.js`; `?v=` cascade once per phase with `--suffix`.
- `surf-test`, `rp-test` stay green.

## Decisions wanted
1. Camera on court: over-the-shoulder 3P (proposed) or a fixed sideline
   "broadcast" camera like 2K's default?
2. Hoops rules: to 11 win by 2, 2s and 1s, make-it-take-it (proposed), or to 21?
3. Dunks as an arcade leap (proposed; the blocky body can't reach 3.05 m
   otherwise), or no dunks, layups only?
4. Order: basketball → tennis → volleyball with a push after each (proposed).
