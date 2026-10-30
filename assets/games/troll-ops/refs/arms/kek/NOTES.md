# MTAR (kek): references (DESIGN-ARSENAL.md §4 step 0, Phase 1 step 5 gun 2)

The target look is the user's concept sheet (ChatGPT, 2026-10-30), in this
folder: `concept-sheet.webp`, three panels in one image: top a right 3/4
view, bottom left the rear half from the right (port, cheek, mag, trigger),
bottom right the left-side profile. Proportions come from the Tavor trace
already in `weapons/weapon-ars.js` (AR_SPECS.kek, traced off Commons'
"IWI-Tavor-TAR-21w1 new noBG.png"); the sheet drives surface and colour.

Prompt it was made from: "Studio product render of a modern bullpup assault
rifle (IWI Tavor / MTAR-21 proportions, magazine behind the pistol grip),
right-side 3/4 view on a plain neutral grey background. Faceted tan (FDE)
polymer shell with crisp 45-degree chamfered edges and visible panel seams,
over a black functional core that shows at the seams and through every
cut-out. Rows of diagonal vent slashes on the forend, stippled texture on
the cheek panel and the pistol grip, hex screws and pins at the panel joins.
Dark smoke-grey translucent polymer magazine behind the grip with
round-count windows showing the cartridges. Short Picatinny top rail with a
folding front sight. Charging handle sitting forward in its slot on the left
of the forend. Open ejection port behind the grip beside the cheek, bolt
visible inside. Paint worn at the edges showing darker material underneath;
varied roughness between polymer, paint and steel, no flat colour anywhere.
No text, logos or markings."

The three panels disagree in places; the picks (the user, 2026-10-30, "lets
just get to building"):

- The grip is OD in the 3/4 and tan in the other two: **tan, stippled**.
- A charging handle shows on both sides (behind the port on the right,
  forward of it on the left): **left side only, forward in its slot**, as on
  the real Tavor.
- The port is above the grip in the 3/4 and above the mag in the close-up:
  **above the mag, behind the grip, by the cheek** (the close-up), which is
  where the brass has to come from.
- The forend is TAR/X95 length, longer than a real MTAR-21: the trace's
  length stands; the slashes and the handle slot scale to it.

What the sheet shows, and where the builder takes it from
(`models/build_mtar.blender.py`):

| Concept | Builder |
|---|---|
| One tan polymer shell, faceted, chamfered, panel seams front to back | `shell()`: `section_body` on the trace's outline, `panel_line` seams, `cerakote`-style wear on `polymer` |
| Black core at the butt, the trigger guard, the slots and seams | `core` surfaces under every cut; black butt plate, trigger bow, controls |
| Diagonal vent slashes on the forend, two rows a side | `vent_slashes` on the forend flanks |
| Stippled cheek panel (right) and grip panels | `stipple` on the cheek rectangle and both grip sides |
| Hex screws and pins at the panel joins | `screw` / `pin` along the seams |
| Short top rail with a folding front sight and a rear aperture | `picatinny` z 0.09 to -0.05, `P_IronRear` (both irons, one node) |
| Translucent smoke-grey mag, brass showing through round-count windows | `P_Mag`: smoke polymer body, a `P_Rounds` brass stack inside (the game drops it as you fire) |
| Open port above the mag, the bolt inside | `P_Carrier` in the port, back on each shot |
| Charging handle forward in its left-side slot | `P_Charge`, left, slides back on the empty reload |
| Trigger with the guard run down to the grip (the trace's hole) | `P_Trigger`; the guard is the shell's own opening |
| Birdcage flash hider | `P_Hider` (a muzzle attachment takes its place) |
