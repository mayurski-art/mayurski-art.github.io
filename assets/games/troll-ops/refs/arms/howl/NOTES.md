# Howl Ballista: references (DESIGN-ARSENAL.md §4 step 0)

**The target is Black Ops 2's Ballista itself** (user, 2026-10-30: "make
the Ballista exactly like the Call of Duty Black Ops 2 one, not a reference
to the Problem 416; no weapon should reference that"). The shared form
language of §3 no longer applies to this gun: it copies the BO2 model, as
the MTAR copies its own.

## The references

**The concept sheet** (ChatGPT from the prompt below with the BO2 and FN
photos attached, 2026-10-30): `concept-sheet.webp`, split into
`concept-1-right-side.jpg` (the whole gun, scope on, bipod deployed),
`concept-2-receiver-right.jpg` (port, bolt body, handle and knob, the
cantilever mount and spirit level, worn tan) and `concept-3-left-34.jpg`
(the left side, 3/4 from the front, muzzle left). Panels 1 and 2 are the
true right side, not mirrored: seen from the right, the muzzle points to
the viewer's right with the handle toward the camera, as in
real/fn-ballista-2.jpg. (Corrected 2026-10-30 when measuring the FN photo.) This sheet is the
surface target; BO2's renders and the FN photos below settle anything it
leaves out or gets wrong.

Picks where the sheet differs from the game:
- Bipod: the sheet deploys it; the game's is folded forward under the
  handguard (BO2 trivia: "an unusable, folded bipod"). Built folded.
- Scope caps and turret numbers: the sheet's turrets read 100-500 like
  BO2's; the game bake carries no text (no markings rule), the knurl and
  the white tick marks only.
- Mag: the sheet's is grey-black with two recessed windows and a flat
  floorplate, BO2's dark brown-black; built dark polymer with the windows.
- Barrel: dark grey steel as in the game (the sheet agrees), not the FN's tan.

`bo2/`: Black Ops 2's own renders, from the Call of Duty wiki
(callofduty.fandom.com/wiki/Ballista, CC-BY-SA): `Ballista_BOII.webp`
(first person, the whole right side: receiver, port, scope, rail, handguard,
bipod), `Ballista_Bolt_Cycling_BOII.webp` (the hand on the knob), `Ballista_Reloading_BOII.webp`
(the gun rolled over: handguard slots, belly rail, the mag with a .338
round), `Ballista_Iron_Sight_BOII.webp`, `Ballista_Upgraded_BO2.webp`
(the Zombies Pack-a-Punch skin, colours only), `Ballista_Menu_Icon_BOII.webp`
(the whole gun from the left-front: brake, barrel, folded bipod, stock),
`user-fp-1.png` (the user's screenshot of the same first-person view).

`real/`: the FN Ballista the game modelled (FN Herstal's entry to the US
Army's Precision Sniper Rifle program, a Unique Alpine TPG design, .338
Lapua Magnum, 8-round mag, 26 in barrel), from IMFDB: `fn-ballista-1.jpg`
(left side) and `fn-ballista-2.jpg` (right side, large: the proportions
come from this one). The game's gun is this rifle with a darker barrel and
brake, a scuffed tan finish and its own scope.

`olive-concept/`: the first ChatGPT concept (an olive chassis in the §3
language), superseded the same day; kept for the record, not a target.

## What the BO2 Ballista is (what the builder copies)

- **Chassis**: FDE tan aluminium, scuffed and dirty (bare grey metal on the
  edges, grime in the recesses), hard-edged machined panels. One long flat
  top: the receiver's rail runs straight into the handguard's as a single
  full-length rail.
- **Receiver**: a tall tan block; a big open ejection port on the right,
  the dark steel bolt body in it; the bolt handle sweeps back and down
  with a round black knob; a black trigger in a cut trigger guard; a
  cross-bolt and pins on the side; the tang behind the receiver drops to
  the stock hinge.
- **Handguard**: long tan octagonal section, full-length top rail; on
  each side two long stadium slots (upper) and a row of short slots over a
  side-rail strip (lower), plus a line of small round holes near the
  receiver; a perforated tan accessory panel under the belly ahead of the
  mag well; the bipod's mount on the belly rail near the nose.
- **Bipod**: black, folded forward under the handguard, legs along the
  belly (unusable in game).
- **Barrel and brake**: in the game the barrel is dark grey steel (the real
  one is tan), long and slender from the handguard's nose; a black
  cylindrical brake with three rows of slots.
- **Stock**: folding skeleton, tan, a hinge block right behind the tang; a
  tan frame with a big open window, a black adjustable cheek piece on top
  and a black vertical butt pad at the back with a monopod rail under it;
  an open loop at the bottom rear.
- **Grip**: tan, dimpled (the FN's ergonomic grip with its finger swell).
- **Mag**: dark (black-brown) box, .338, straight sides, flat floorplate;
  "Made by Hobo Commando MP, in Bavaria, Germany" on the side in the game
  (not reproduced: no markings).
- **Scope** (user, 2026-10-30: "I want that scope"): BO2's tan "Royce &
  Wesley" scope is part of this gun. A long tan tube with a wide objective
  bell at the front, a tan eyepiece with a black focus ring, a tall black
  elevation turret with a tan knurled cap and white range numbers (100 to
  500) and a matching black windage turret on the right; a black cantilever
  ring mount with lightening holes that lifts the scope up and forward off
  the rail; a small spirit level (green bubble vial in a black housing)
  clamped to the rail ahead of the mount. Built into the glb as `HB_Scope`
  (its own node): with the default 8x optic the game shows this scope and
  hides the generic scope8 model, aiming down its axis; an ACOG hides
  `HB_Scope` and sits on the bare rail. The scope overlay keys off
  `scopeKey` "scope8", which buildDetailed must set as the traced path does.

Panel note: the game's port and handle are on the right, as in all the BO2
renders; `fn-ballista-1.jpg` is the left side.

## Prompt (ChatGPT) for a concept sheet: the whole gun with its scope

"Studio product render of a modern bolt-action precision rifle in the
style of Call of Duty: Black Ops 2's Ballista, right side 3/4 view with the
bolt handle toward the camera, plain neutral grey background. Flat dark
earth tan aluminium chassis, heavily scuffed and dirty, with bare grey metal
showing on every edge; hard machined panels with crisp edges. A tall
receiver block with a large open ejection port on the right showing the
dark steel bolt body inside, a bolt handle swept back and down ending in a
round black knob, a black trigger in a cut-out guard. One flat top rail
running the full length from the receiver to the nose of a long octagonal
tan front section; that section has two long stadium-shaped slots on each
side, a row of short slots over a side rail strip below them, a line of
small round holes near the receiver, and a perforated tan panel under its
belly; a black bipod folded forward under it. A long slender dark grey
steel front tube ending in a black cylindrical muzzle device with three
rows of slots. A folding skeleton stock: a tan frame with a big open
window, a black adjustable cheek piece on top, a black vertical recoil pad
at the back with a short rail under it, a hinge block in front. A tan
dimpled ergonomic grip. A dark box magazine for .338 rounds with straight
sides. On the rail, a long tan rifle scope: a wide objective bell at the
front, a tan eyepiece with a black focus ring, a tall black elevation
turret with a tan knurled cap and a black windage turret on the right,
both with white range numbers; the scope held up and forward in a black
cantilever ring mount with lightening holes, and a small spirit level with
a green bubble vial clamped to the rail just ahead of the mount. Scuffed
tan paint on the scope too. No text, logos or brand names."

Follow-up 1 (receiver and scope mount): "Same rifle, same lighting and
background. Close-up of the right side of the receiver and the scope
mount: the open port with the dark steel bolt body and its lugs, the
swept-back handle and round black knob, the trigger and guard, the top of
the magazine, the black cantilever ring mount and the spirit level on the
rail above, scuffed tan paint worn to grey metal around the port."

Follow-up 2 (profile): "Same rifle, same lighting and background. Clean
side-on profile of the right side, perfectly horizontal, muzzle pointing
left, whole rifle in frame with space around it, no perspective."

## Builder (`models/build_ballista.blender.py`)

The first builder (commit e6333949) was built to the olive concept; it was
rebuilt to the BO2 references above. Proportions are measured off
real/fn-ballista-2.jpg at 0.000552 m a pixel (1.29 m overall) around the
grip-hand anchor (0, -0.100, 0.020); the surface follows the sheet and
BO2 (FDE 0x7f6a3e, grime from the kit's Grain, light Patches). Node conventions agreed with the MTAR
session (2026-10-30) stand unchanged: `HB_Bolt` one moving part (slide z)
pivoted on the bore at the bolt's rest z, with `tf_lift` (radians,
positive rotation.z lifts the knob); `HB_BoltKnob` point ("BoltKnob" in
gunkit.POINTS and weapon-model.js gunPoints); `HB_Round` (tf_round) in the
chamber ahead of the raked bolt face; `HB_Eject` at the port; `HB_Trigger`,
`HB_Mag`, `HB_BipodL` / `HB_BipodR` folded; `HB_Scope` (the gun's own 8x,
above) with `HB_Aim` on its axis. Materials: the kit's cerakote in FDE tan
worn to grey (chassis and scope), parkerized dark steel for the barrel and
bolt, anodized black for the mount, turrets and brake, polymer for the mag,
rubber for the pad, a glass material for the lenses (a plain gunkit
material survives the bake as its own slot).
