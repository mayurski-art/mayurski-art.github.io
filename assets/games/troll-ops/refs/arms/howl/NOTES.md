# Howl Ballista: references (DESIGN-ARSENAL.md §4 step 0)

The target look is the user's concept render (2026-10-30, ChatGPT), one
sheet of three panels in this folder: `concept-sheet.webp` (the sheet as
sent), split into `concept-1-34-mirrored.jpg` (the 3/4 view, the gun as a
whole), `concept-2-bolt-closeup-mirrored.jpg` (the receiver: port, bolt
body, handle and knob, wear) and `concept-3-right-side.jpg` (the clean
side profile, muzzle left). `concept-4-port-round.png` is the user's crop
of the port with the bolt body, the frame the visible-round animation
should land on (the MTAR session's shared cocking animation covers it).

Panels 1 and 2 are mirrored, as the 416's renders were: the muzzle points
right with the bolt handle toward the camera, which a right-handed rifle
only does from its left side. Panel 3 is a true right side (muzzle left,
handle near). In game the handle, port and ejection stay on the right;
every feature is matched front to back, not left to right.

Prompt they were made from: "Studio product render of a modern lightweight
bolt-action precision rifle, about 1.2 m long, right side 3/4 view with the
bolt handle facing the camera, on a plain neutral grey background.
Olive-drab cerakote chassis shell over a black anodized aluminium core; the
paint is worn at every edge, showing darker metal underneath. Crisp
45-degree chamfered panels everywhere, no rounded blobs. A long octagonal
front section with rows of M-LOK slots and vent slashes, a short top rail;
a cut-away receiver side showing the polished steel bolt body inside; a
bolt handle with a round knurled knob turned down on the right; a 20 MOA
top rail carrying a large scope; a skeleton stock with an adjustable cheek
riser and butt pad, both with visible adjustment lines and hex screws; a
stippled black grip; a black polymer box magazine for .338 rounds; a
slender fluted front section ending in a slotted muzzle device; a bipod
folded flat under the front section. Hex screws and pins, no text, logos or
markings." Follow-ups asked for the receiver close-up and the side profile;
ChatGPT returned all three on one sheet.

Where the panels disagree, the picks:
- The barrel is plain in every panel, not fluted. Built plain, as rendered
  (the design doc's "fluted barrel" is dropped: the render is the target).
- Vent slashes were asked for and didn't come: the M-LOK rows carry the
  handguard alone. None built.
- Panel 1 shows three slot rows a side on the handguard, panel 3 two; two
  long rows plus the short top-corner row of panel 1 it is.
- The bolt knob is a knurled ball (panels 1 and 2), not the traced gun's
  plain sphere.

What the renders show, and where the builder takes it from
(`models/build_ballista.blender.py`):

| Concept | Builder |
|---|---|
| Olive cerakote chassis, receiver, handguard, stock and cheek riser, worn through at the edges to dark metal | `cerakote` kit surface, olive greener and darker than the 416's grey OD |
| Black core: barrel, brake, bolt shroud, screws, trigger, bipod | `anodized` / `parkerized` kit surfaces |
| One continuous top rail from the receiver's rear to the handguard's nose, the scope rings on it over the receiver | `picatinny` on the body, scope at the traced optic z (-0.131) |
| Receiver: a chamfered block with a stepped panel line, hex screws, the big cut-out on the right showing the bolt body (panel 2) | `receiver()`: `rrect_cut` port, screws, panel lines |
| Polished bolt body with spiral flutes, a bolt shroud behind the receiver, the straight handle angled down, knurled ball knob | `HB_Bolt`: lathe + helical cut on the high pass, knob stippled; pivot on the bore at z -0.065 so lift and rake work on one node |
| Octagonal M-LOK handguard, two long slot rows a side and a short row at the top corner, slots on the belly | `handguard()`: `rrect_cut` rows |
| Bipod folded forward under the handguard, legs along the belly (panel 1 and 3) | `HB_BipodL` / `HB_BipodR`, hinge parts posed folded |
| Plain slender barrel, box brake with three ports a side | `barrel()` lathe; `HB_Brake` own node (a barrel attachment replaces it) |
| Short black polymer mag, 2 x 3 recessed window panels, ribbed base | `HB_Mag`, .338, 7 rounds |
| Black stippled grip with a flared base, integral trigger guard, black trigger | `grip()`, `HB_Trigger` hinge |
| Skeleton stock: a top beam, an angled lower strut, a big triangular window, hex screws at the joints | `stock()` section_body + `rrect_cut` through |
| Cheek riser: an olive block on two posts with adjust slots | `riser()` |
| Butt: black rubber pad on stacked spacer plates, hex screws, QD cups | `butt()` |
| The round in the port (`concept-4`) | a round node the shared animation shows and moves (name pending the MTAR session's convention) |
