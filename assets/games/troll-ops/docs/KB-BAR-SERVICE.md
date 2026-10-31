# Kabukigrin bar service: drinks, dizzy spells, passing out

Status: APPROVED 2026-10-31 with the recommended answers (one meter, free drinks, the menu as drafted).

Sit on one of the club's six bar stools (x -16.85, z 9.0 .. 15.5), order a
drink from the bartenders (Shots McGee, Neon Nina, Pourtia; North if the
dialogue session lands him), drink it, and get drunker. Dizzy spells come
more often and hit harder as you go; at the top you pass out, slump, fall off
the stool, black out and come round on the floor. Everyone in the room sees
you go over.

## 1. What's already there (and gets reused)

- **Seats**: `modes/social-rp.js` `sitDown / standUp / holdSeat`, the map's
  `rp.seats` (Kabukigrin: `kbFreeSeats`, kind `"stool"` for the bar). On the
  wire as `se` (seat + 1), posed on peers by `poseSeated`.
- **Drinks in hand**: `bar.drink { kind, sips }`, fire sips (`SIP_TIME`
  1.25 s), drawn first- and third-person by `maps/saloon-bar.js`
  `buildDrink / placeDrinkInHand`, on the wire as `dk`.
- **The meter**: `bar.tipsy` (Troll City's saloon): a beer mug or a whiskey
  shot is +1, decays 1 point a minute, `tipsyFx` sways the camera and
  staggers the walk from 2 up to 6 (full).
- **Hooks**: `rpExtras` (hold-X actions, asked first), `rpListeners` (room
  messages), `peerPosers` (`net/remote-players.js`, pose a peer each frame).

So nothing new goes in `social-rp.js` beyond what the hooks can't reach, and
nothing in game.js.

## 2. Files

| File | What |
|---|---|
| `modes/kb-bar.js` (new) | ordering, the menu, the drink arriving, `orderDrink(player, drinkId)` |
| `modes/drunk.js` (new) | the spells, the pass-out state machine, the screen effects, the peer pose |
| `maps/saloon-bar.js` | the four new drink models + kinds + wire codes |
| `net/net.js` | one state field, `dz` (`game.net.dz`, like `trainAt`) |
| `view/player-update.js` | the frame hooks: `updateDrunk` / `updateKbBar`, the hold while out, the camera's roll, pitch and eye drop, the walk's shove |
| `maps/kabukigrin.js`, `maps/kabukigrin-social.js` | the bar stools carry `bar: true`; `muffle` reads `game.drunkMuffle` |
| `style.css` | the drinks card, the dizzy vignette, the blackout |
| `tools/troll-ops-kb-bar-test.mjs` (new) | the targeted test |

## 3. Ordering (hooks into hold X)

Seated on a Kabukigrin bar stool with empty hands, the pickup prompt says
**Hold X: Order a drink** (an `rpExtras` action, so it rides the existing
prompt, keycap and touch context button). Holding it opens a small menu card
(DM Mono, the club's neon pink accent), four rows, picked with 1-4 (a tap on
a phone), Esc or standing up closes:

| Drink | Sips | Per sip | Total | Glass |
|---|---|---|---|---|
| Sake | 1 | +1.2 | 1.2 | ochoko cup |
| Highball | 3 | +0.4 | 1.2 | tall glass, ice, lemon |
| Grin Sour | 2 | +0.9 | 1.8 | coupe, neon green, glows faintly |
| Green tea | 2 | -0.4 | -0.8 | yunomi, the "sober up" option |

Then the nearest bartender turns to you and a short pour (1.2 s, a glass
clink) puts it in your hand; fire sips, as at the saloon. Free, no currency.
Only one drink at a time; standing up with one keeps it in hand (G sets it
down, as now).

**API for North's dialogue session**: `orderDrink(player, drinkId)` exported
from `modes/kb-bar.js`. `player` is `"me"` (the local player; peers order on
their own tabs), `drinkId` one of `sake | highball | sour | tea`. Returns
`true` if the bartender took it (the glass lands after the 1.2 s pour),
`false` with a reason banner if not (hands full, not on a bar stool). `KB_DRINKS` exports the menu for dialogue copy.

## 4. The intoxication curve

One meter for all of Socialize: `bar.tipsy`, so the saloon's beer counts too
and the doctor's tonic still sobers you. Its ceiling rises from 7 to 8.

| Level | What happens |
|---|---|
| 0 - 2 | nothing |
| 2 - 6 | the saloon's steady `tipsyFx` sway, as now ("You're feeling it…") |
| 3+ | **dizzy spells** start (below) |
| 8 | **pass out** |

Decay stays 1 point a minute, so passing out takes about seven drinks inside
two or three minutes: a choice, never an accident.

## 5. Dizzy spells

A spell is a 1.5 - 3.5 s lurch on top of the steady sway, with an
envelope (0.3 s in, hold, 0.8 s out). With `k = (level - 3) / 5`:

- **How often**: the gap to the next is random around `lerp(40 s, 6 s, k)`
  (+-40 %).
- **How hard**: strength `lerp(0.3, 1, k)`, times a random 0.7 .. 1.

During a spell, scaled by strength:

- **Camera**: a roll lurch to one side (up to 0.22 rad) and a pitch dip,
  a slow yaw drag (the view slides off what you're looking at), and the lens
  breathes ±5 % of the FOV setting (through `game.baseFov`; put back after).
- **Blur and wobble**: a CSS `blur()` on the game canvas (up to 2.5 px), a
  dark vignette that closes in with the spell, and double vision: the last
  render pass (`view/grade-pass.js` `DOUBLE_VISION`) mixes in a ghost of the
  frame that drifts off to one side, also while coming round. On Low quality
  and on phones the blur is skipped; the vignette and the double vision
  stay (user, 2026-10-31).
- **Staggered movement**: the walk input is shoved sideways (the stagger
  term x3) and slowed to 70 %; a strong spell can make you stumble a step
  on your own. Seated: just the body sway, you stay on the stool.
- Sound: the club's music dips and low-passes for the spell (`muffle`'s
  filter, a few hundred Hz lower).

## 6. Passing out and coming round

At 8 the local state machine runs (input frozen, weapon/drink lowered, the
drink dropped on the bar if you had one):

| Phase | Time | You see | `dz` |
|---|---|---|---|
| slump | 1.4 s | the view droops forward and sinks, eyelids close (vignette) | 2 |
| fall | 0.8 s | the view tips 80° sideways and drops to floor height; a thud | 3 |
| out | 4 s | black, "…" and the muffled club; nothing on the HUD but the clock | 3 |
| come round | 2.5 s | two slow blinks on the ceiling lights, then you sit up and stand | 4 |

Standing when it hits: same, without the stool (you crumple where you
stand). You come round on the floor beside the stool (its `stand` spot), the
meter set to 4.5 (still dizzy) and no pass-out for 30 s. Dying, leaving the
match or the map ends it at once.

## 7. Net sync

One small state field, `dz`: absent normal, 1 in a dizzy spell, 2 slumping,
3 down, 4 getting up. Peers run the animation from the phase changes on
their own clock (`peerPosers` in `modes/drunk.js`):

- **1**: a slow upper-body sway (torso/chest roll), seated or walking.
- **2**: on the stool, head and chest fall forward onto the bar, arms slide.
- **3**: tip over sideways off the stool (pivot at the hips, 0.8 s, falling
  away from the bar) and lie on their side on the floor; the body is placed
  at the seat's `stand` spot so the 110 ms snapshot slide hides in the fall.
- **4**: roll up onto a knee and stand, 1.2 s.

Late joiners just see the phase they arrive in (lying there, say). No new
room messages; the `se` seat field drops when the fall starts.

## 8. Test (targeted, private room only)

`tools/troll-ops-kb-bar-test.mjs`: Kabukigrin, Socialize, a private room
code, Supabase blocked, two tabs. Sit on a stool, order each drink (the
menu, the drink in hand, the sips raising the meter by the table above),
force a spell (screenshot the dizzy effect), drink to 8 (screenshot the
slump, the fall from the other tab's view, the blackout), check the other
tab reads `dz` 2 -> 3 -> 4 and poses the body on the floor, then that you
get up with the meter at 4.5. Plus `orderDrink` from the console.

## 9. Decisions for the user

1. **One meter everywhere** (saloon beer counts, you can pass out in Troll
   City too), or Kabukigrin only? *Recommend: one meter.*
2. **Free drinks**, or cost Credits? *Recommend: free.*
3. **Menu** as above (sake, highball, Grin Sour, green tea)? Swap any.
