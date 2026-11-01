# Money gun: references (docs/MONEY-RAIN.md 3, CLAUDE.md rules 10 and 11)

The target is the real Cash Cannon, the money gun the Make it rain emote
holds (`weapons/money-gun.js`). It's a prop for an emote, not an arsenal
gun, so there is no Blender bake: it's built in three.js from extruded,
bevelled side profiles so every edge is rounded.

| File | What | From |
|---|---|---|
| `cash-cannon-photo-1.jpg` | the red Cash Cannon from the left-front 3/4, on a table: the long rounded body, the raised lips either side of the bill tray down the top, the dark mouth at the front, the grip leaning back with its trigger guard, the battery door's screws on the grip | Laughing Squid, "The Cash Cannon, A Novelty Device That Spits Out Cash When Triggered" (2014), photo credited to Cash Cannon, 508x480 |
| `cash-cannon-photo-2.jpg` | the same gun from above and behind, lying on a fan of dollar bills: the tray's proportions along the body, the grip's angle and its curved backstrap, the black trigger | same page, 640x441 |
| `money-gun-side.png`, `money-gun-34.png`, `money-gun-top.png` | the game's build: side on, a 3/4, from above; `money-gun-side-vs-ref.png` is the side beside photo 1 | `tools/troll-ops-money-gun-test.mjs` |
| `money-gun-fp-stick.png`, `money-gun-fp-1718.png`, `money-gun-tp.png` | the emote in first person: the stick hands, then TROLLS #1718's; and as another player sees it | same test |

No prompt: the references are photographs of the real product, not renders.

What the photos show, and where the build takes it from:

| Photo | Build |
|---|---|
| A long box body, about 4 : 1 long to tall, noticeably rounded along every edge and corner | `BODY` 0.19 x 0.046 x 0.06 m, a `roundedRect` side profile (r 7 mm) extruded with a 4 mm bevel |
| Two lips along the top edges with the bills lying between them | the two lip boxes, the dark tray, the `stack` (a touch proud, tipped up at the back) |
| The mouth: a dark slot across the top of the nose, the roller inside | the slot box and the rubber `roller` |
| The grip leans back about 20° under the rear, a straight front strap, a curved backstrap, a rounded base that flares a little for the battery door | the grip `Shape` (quadratic curves on the backstrap and base) extruded with a 7 mm bevel, the battery-door plate |
| A thin round trigger guard, a short black trigger | `TorusGeometry` loop, `CapsuleGeometry` trigger |
| Glossy red ABS; black roller and trigger | `red` roughness 0.32 metalness 0.12; `black`, `rubber` |

Picks where they disagree: none; the two photos are the same product. The
"Cash Cannon" logo embossed on the side is left off (no text on props).
