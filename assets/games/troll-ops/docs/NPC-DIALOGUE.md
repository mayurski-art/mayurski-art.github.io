# NPC dialogue: talk to North — DESIGN DOC

User, 2026-10-31: a Skyrim-style dialogue system for Trollnite. Walk up to an
NPC and press interact: the camera eases onto them, they say a greeting, and
a list of things you can say comes up. Branching topics, a goodbye, simple
conditions and flags. Keyboard, pad and touch. Only NPCs that opt in talk;
the rest of the crowd stays scenery. First speaker: **North**, the
Kabukigrin club's bartender.

Status: **built** with the recommended picks (user via the parent session,
2026-10-31: "go with your recommended picks"): Neon Nina became North,
first-person ease, flags remembered in the browser, North only. Test:
`tools/troll-ops-npc-dialogue-test.mjs`.

## 1. What already exists (reused, not rebuilt)

| Piece | Where | What we take |
|---|---|---|
| Hold-X prompt | `modes/social-rp.js` `rpExtras` (club-entry, hoops, photo booth, band all push into it) | the "Talk to North" prompt is one more `rpExtras` entry: same bar, same X / pad X / touch context button |
| Two-answer question | `modes/club-entry.js` `ui.ask` (the 18+ question) | input detection (`inputKind`), pad read with `padArmed` so a held button isn't an answer, unlock/relock the mouse, `releaseHeldInputs`, opaque touch layout |
| Modal panel | `maps/dj-lulz.js` panel | keys captured while open (`stopImmediatePropagation`), clicks stop at the panel |
| Look easing | `modes/club-entry.js` (`game.look.yaw` / `pitch` eased toward the bouncer) | the camera move (section 4) |
| The cast | `maps/kabukigrin-social.js` `kbNpcs()`, rendered by `maps/town-npcs.js` | a cast entry opts in with one field, `talk` |
| Pause guard | `menu/buttons.js` (Esc doesn't pause while the club ask / DJ panel is up) | add `talkOpen()` to that list |

There is no North in the cast today. The bar has Shots McGee (z 10),
Neon Nina (z 12.2) and Pourtia (z 14.4), all behind the counter at x -14.9
facing the floor. Proposal: **Neon Nina becomes North** (the middle of the
bar, same spot, same index, so no other NPC moves). Pick in section 9.

## 2. Files

| File | System | Commit |
|---|---|---|
| `modes/npc-dialogue.js` | the engine: tree walker, conditions, flags, input, camera ease, the panel and its CSS | 1: engine |
| `modes/talk/north.js` | North's script (data only) | 2: North |
| `maps/kabukigrin-social.js` | North in the cast (`talk: "north"`) | 2: North |
| `menu/buttons.js` | `.to-talk` in the don't-pause list (looked up, not imported) | 1: engine |
| `view/player-update.js` | `updateTalk(dt)` each frame, beside the photo booth's (game.js untouched) | 1: engine |

Built notes: while talking, `game.localPauseOnly` is held on (the pause
menu's own "only my player freezes" flag: no feet, no trigger, no hold X)
and the lens narrows with `camera.zoom`, which game.js's FOV easing leaves
alone. The NPC is driven with `TownNpcs.takeOver` (head to you, hands on the
bar, a gesture while the line types) and released on goodbye.

`?v=` tags bumped per rule 4. If this branch gets merged into another
session's (the bar-drinks session is the likely one), the cascade waits for
that merge.

## 3. Data format

A script is a plain JS object. No DSL, no parser, nothing to download.

```js
export default {
  id: "north",
  name: "North",
  role: "Head bartender",
  // first match wins; `say` can be a string or a list (picked at random)
  greet: [
    { if: "owner", say: "Boss. Your end of the bar's wiped." },
    { if: "tipsy", say: "You're swaying. I'm not. Let's keep it that way." },
    { if: "met", say: ["Back already?", "The stools missed you. I didn't."] },
    { say: "New face. I'm North. Bar's open, mouth's optional.", set: "met" },
  ],
  hub: "main",                       // where you land after greet and after a topic ends
  nodes: {
    main: { options: [
      { text: "What'll it be?", to: "order" },
      { text: "Who are you?", to: "who", if: "!askedWho" },
      { text: "Heard anything?", to: "rumour" },
      { text: "Later.", bye: true, say: "Tip your bartender. Emotionally." },
    ] },
    who: { say: "North. I point drinks the right way.", set: "askedWho", options: [ ... ] },
    order: { service: "bar" },       // hands off to a service (section 7)
    rumour: { pick: ["r1", "r2", "r3"], unseen: true, empty: "rumourDry" },
  },
};
```

Node fields:

| Field | Meaning |
|---|---|
| `say` | the NPC's line (string or list; a list picks one) |
| `options` | what you can say: `{ text, to, if, set, bye, say }`; options whose `if` fails are left out, never greyed |
| `to` | next node; omitted = back to `hub` |
| `set` / `unset` | flags flipped when the node or option fires (`"a b"` for several) |
| `bye` | ends the talk after the NPC's `say` |
| `pick` + `unseen` | a rotating topic: one of these nodes it hasn't used yet; `empty` when all are used |
| `service` | hand off to a registered service (section 7), with a fallback line if none is registered |

Conditions are a tiny closed vocabulary, `!` to negate, space = and:
`met`, any flag name, `owner` (troll_runner), `vip` (VIP or owner band,
club-entry.js), `tipsy` (social-rp.js `bar.tipsy` over half), `drink`
(something in hand), `signedIn`. No `eval`, no expressions.

Flags are per player per NPC, kept in localStorage (`trollops:talk`, try/catch
wrapped), so North remembers you next session in that browser. Nothing goes
on the wire.

## 4. Camera

First person, no cut (the Skyrim feel, and nothing to clip through behind
the bar):

1. On open, `game.look.yaw` / `pitch` ease onto North's face over 0.45 s
   (smoothstep), and the FOV narrows 10% so he fills more of the frame.
2. North's head turns to you (town-npcs.js `headPivot`, clamped to 60°) and
   his act pauses on "wipe" with the rag down.
3. While talking: movement and fire are off, the look is held (mouse and
   right stick do nothing), the weapon is lowered.
4. On goodbye (or walking off is impossible, so: Esc / B / a hit / the match
   ending) the FOV eases back over 0.3 s and control returns. North goes back
   to his loop.

Other players see nothing special: you're standing at the bar. It's all
local.

## 5. UI (BO2 text-menu style)

Same look as the lobby's BO2 menu (`assets/js/bo2-menu.js`): stacked
white text options, the focused one on a soft bar with a left tick, no
boxes round each item.

```
 ┌──────────────────────────────────────────────────────────┐
 │                       (North, centre)                    │
 │                                                          │
 │   NORTH · Head bartender                                 │
 │   "New face. I'm North. Bar's open, mouth's optional."   │
 │                                                          │
 │   ▌ What'll it be?                                       │
 │     Who are you?                                         │
 │     What is this place?                                  │
 │     Heard anything?                                      │
 │     Later.                                               │
 │                                       ↑↓ choose · E · Esc │
 └──────────────────────────────────────────────────────────┘
```

- Lower-left third, over a dark gradient so the club behind stays visible.
  North's face stays in the clear middle of the screen.
- The line types out (fast, ~60 chars/s); any input finishes it, the next
  input picks.
- A picked option is echoed for half a second, dimmed, above North's reply,
  so you can follow the thread.
- Phone: the panel is opaque, sits at the bottom, rows 56 px tall, the touch
  sticks and buttons hide while it's open. Nothing overlaps: checked with
  pixel measurements on the 375 x 812 and 812 x 375 viewports.
- Max 6 options on screen; scripts never need more.
- `role="dialog"`, the options are a `listbox` of real buttons, the line is
  `aria-live`.

## 6. Input

| | Keys | Pad | Touch |
|---|---|---|---|
| start | hold X at North (the usual prompt) | hold X (BO2 use) | the context button, "Talk" |
| move | ↑ ↓ / W S / mouse hover | d-pad / left stick | — |
| pick | E, Enter, Space, click, 1–6 | A | tap the row |
| skip typing | any of the above | A | tap anywhere |
| goodbye | Esc, Tab | B | the "Later." row |

Pad is read the club-entry way: armed only once every button is up, so the
X you held to start doesn't pick the first option.

## 7. North and the bar service (the hook)

The bar-drinks session owns drinks and passing out. This system only needs
a door:

```js
import { registerTalkService } from "./npc-dialogue.js";
registerTalkService("bar", ({ npc, close, back }) => { /* open the drinks menu */ });
```

`order: { service: "bar" }` calls it with `close()` (end the talk) and
`back(line)` (return to the hub). Or, simpler, it returns options to say
right there: `{ say, options: [{ text, run }] }`; picking one calls `run()`
(serve the drink, e.g. kb-bar's `orderDrink("me", "sake")`) and North says
what it returns. A "Never mind" row is added under them. Until it's registered, North says
"Taps are getting rewired. Ask me in a minute." and you go back to the hub.
No drinks built here.

## 8. North's script

Personality: dry, quick, has seen every kind of drunk, likes you a little
more than he lets on. Lines under ~70 characters, sentence case.

**Greeting** (first match): owner "Boss. Your end of the bar's wiped." ·
tipsy "You're swaying. I'm not. Let's keep it that way." · met
"Back already? The stools missed you." / "You again. Good. Quiet night." ·
first time "New face. I'm North. Bar's open, mouth's optional."

**What'll it be?** → "Name your poison." → bar service (section 7).

**Who are you?** → "North. I point drinks the right way."
- "Why North?" → "Never lost a tab. Never lost a customer. Lost a few teeth."
- "Seen it all?" → "Seen a guy propose to the koi tank. So, yes."

**What is this place?** (lore)
→ "Kabukigrin. Grinjuku's loudest block with a club stapled on."
- "Who runs it?" → "Big Boss. Office over the floor, one-way glass. He sees your dancing. Sorry."
- "The koi?" → "VIP tank. Don't tap the glass. They bill you per tap."
- "The DJ?" → "DJ Lulz. Takes requests. Plays his own. Ask anyway."
- "Outside?" → "Tako stall, konbini, pachinko. The metro under it never sleeps."
- (if `vip`) "VIP's nice." → "Course it is. You paid for the carpet."

**Heard anything?** (rumours, one new one per ask, unseen first)
- "When the bass drops in VIP, it rains money. Don't ask whose."
- "Someone keeps lighting green candles on stage. Chart people. Harmless. Mostly."
- "Guy in the bandana got bounced four times tonight. Personal best."
- "Last train in Undergrin? Never leaves. Don't wait for it."
- "Big Boss counts the till twice. Counts me three times."
- when all heard: "That's all I've got. Buy something and I'll remember more."

**Later.** → "Tip your bartender. Emotionally."

Flags: `met`, `askedWho`, rumour ids. Money rain and green candles are the
other sessions' features; the rumours tease them and don't depend on them.

## 9. Picks for the user

1. **Who is North?** (a) Neon Nina becomes North, middle of the bar
   *(recommended)*; (b) North is a fourth bartender; (c) North replaces
   Shots McGee.
2. **Camera:** (a) first-person ease + FOV narrow *(recommended)*; (b) a
   cut to an over-the-shoulder two-shot (third person, like the door's
   kick-out cinematic).
3. **Remember North across sessions** (localStorage) or only for this
   session? Recommended: remember.
4. **Anyone else opt in now?** Recommended: just North; the next ones
   (Big Lulz at the door, Tako Taro, Bandana Benny) once North feels right.

## 10. Checks before showing it

- Targeted test (`tools/troll-ops-npc-dialogue-test.mjs`, headless, private
  room, Supabase blocked): opens on North, walks greet → topic → hub →
  rumour ×6 (no repeats, then the dry line) → order (fallback line) →
  goodbye; flags persist across a reload; a non-talking NPC (Pourtia) gives
  no prompt; pad A/B and keys 1–6 drive it; Esc closes without pausing.
- Screenshots: desktop 1280 x 720, phone 375 x 812 and 812 x 375, with the
  options' boxes measured against the touch buttons and each other.
