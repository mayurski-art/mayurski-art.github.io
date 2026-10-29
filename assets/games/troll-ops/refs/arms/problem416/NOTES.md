# Problem 416: references (DESIGN-ARSENAL.md §4 step 0)

The target look is the user's concept renders (2026-10-29), in this folder:
`concept-1-left-34.jpg` (left 3/4), `concept-2-receiver-closeup.jpg` (the
right side of the receiver: port, forward assist, controls, wear) and
`concept-3-right-34.jpg` (right 3/4). Still wanted: a clean side-on HK416
photo (`side.jpg`, Wikimedia Commons) for proportions.

Prompt they were made from: "Studio product render of a modern AR-style
assault rifle (HK416 proportions), side 3/4 view on a plain neutral grey
background. OD green cerakote shell over a black anodized aluminium core; the
paint is worn at the edges, showing darker metal underneath. Crisp 45-degree
chamfered upper and lower receivers with a visible split line, an M-LOK slotted
handguard with a full-length top Picatinny rail, an open ejection port showing
the bolt carrier inside, a forward assist, flip-up iron sights, a waffle-textured
black polymer magazine, a stippled pistol grip, and an adjustable stock with a
QD sling cut."

What the renders show, and where the builder takes it from
(`models/build_problem416.blender.py`):

| Concept | Builder |
|---|---|
| OD cerakote upper, lower, handguard and rail; worn through at every edge | `cerakote` kit surface on all four (the kit's edge wear) |
| Wear reads light grey-silver in the renders; the user's notes say black anodized | kit default: wears to dark anodized metal (DESIGN-ARSENAL §3) |
| Upper and lower meet at a visible split line, the lower a step narrower | `HW_UP` 13.5 mm, `HW_LO` 12.5 mm half-widths |
| Long M-LOK handguard nearly to the muzzle, slots in a row on each side and the belly | `handguard()`: 7 slots a side, 6 under, to z -0.432 |
| Full-length top rail, upper to handguard nose | `picatinny` 0.066 to -0.430 |
| Open port, bolt and carrier showing, dust cover hanging | `P_Carrier` in the port, `P_DustCover` opens on the first shot |
| Forward assist right-rear of the port, brass deflector | `upper()` |
| Flip-up irons (MBUS style) front and rear, OD | `P_IronRear` (both, one node; fold under an optic) |
| Black waffle polymer mag, curved | `P_Mag`, waffle baked to the normal map |
| Stippled grip (black in two renders, OD in one) | black polymer, stipple baked |
| Skeletal OD stock with a window, QD cup, ribbed rubber pad | `stock()` |
| Ambi selector, mag release, pins, trigger guard | `lower()` |
| Vertical foregrip (renders 1 and 3) | not built in: it's the `vert` underbarrel attachment |
| "HK416 / 7.62mm x 51" marking | left off: the gun is the Problem 416 in game |
