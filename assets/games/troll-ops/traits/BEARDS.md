# Beards on the TROLLS body: the process, and how to make it better

A working prompt for anyone (me included) putting a FACIALS beard trait on
the blocky NFT body. First beard: **Beard Brown** (TROLLS #820). The goal
(user, 2026-10-15): get it right once, then any TROLLS NFT with that beard
just wears it.

## The bar

- It looks like **that** beard on **that** NFT (refs/trolls-<token>.png):
  shape, colour, how far it hangs.
- It is **attached to the trollface itself, not in front of it**. There's no
  gap, ledge or ink ring where the beard meets the face. The face's own jaw
  line disappears into the hair.
- It reads from every angle: front, three-quarter, side, behind, and from
  above in third person. It isn't a card from the side, and it doesn't clip
  through the chest.
- It's the game's style: ink outline, flat fill, toon bands like the face.

## How it's built now

1. **Trace the drawing.** The outline lives in `tools/troll-ops-beard-art.mjs`, which writes `traits/src/facial-beard-<colour>.svg` and its `.depth.svg` from it (locks with lit edges and dark clefts, a tufty outer edge, seeded so a re-run is identical). Edit the outline there, not the svg.
   - It uses a tall head frame, 1000 × 1300 (the 1033-row head frame plus
     267 rows of hang below the chin; `traits.js` TALL).
   - The inner edge follows the face art's real silhouette and the grin's
     bottom edge, measured off `trollface transparent.png`. Its sides run
     x≈140–870 and the jaw slants to y≈930 at the bottom left.
   - Ink goes round the **outside only**. Along the inner edge, short hair
     tufts cross onto the face instead of an outline.
   - Bake it with `node tools/troll-ops-bake-traits.mjs --compose .claude/nft-820/compose-820.png eyes-bloodshot facial-beard-brown hat-camper`
     and check it flat on the face first.
2. **On the stick body:** a flat plane, with its hang bent forward
   (`traits.js` headPlane).
3. **On the block body:** a volume (`blocky-body.js` beardVolume, swapped in
   by reliefHead).
   - **Back surface = the face's real surface.** `headHeights` bins the
     relief head's vertices into a 72-column height map in the head pivot's
     frame (frontmost z per bin). It then fills outward to cover the parts of
     the beard past the face, keeping how far outside the head each point is.
     The beard's back sits on that map, sunk 3 mm in.
   - **Sideburns curl back** past the face's edge, by the distance outside
     the head (`curl`), so from the side they wrap the jaw.
   - **The hang rests on the chest.** Below the chin, the back is a smooth
     minimum of the jaw surface and the chest's front, so it drapes from one
     onto the other. The chest's front is **raycast** onto the torso's own
     meshes (the beard waits for `rig.torsoReady`), each point taking the
     most forward hit up to 2.5 cm above it so the hair rolls over the
     block's rounded top edge.
   - **Thickness comes from a distance field** over the drawing's silhouette:
     zero at every edge, so the beard is flush with the face, and full at
     `taper` in (2.8 cm on the jaw, 6 cm in the hang).
   - **Shading:** the front gets the drawing with the face's toon tones
     (CLOTH_TONES); the back gets the silhouette in dark brown. One shared
     node grid gives smooth normals, and the faces run one cell past the
     silhouette so the drawing's alpha makes the edge.
4. **Check it** in `tools/trait-preview.html?token=820`:
   `__preview.orbit` = { tx, ty: head, dist 1.0, yaw 0 / -0.7 / -1.57 / 3.14 }.

## What went wrong on the way (don't repeat)

- **A flat card in front of a rounded head.** It boxed the face in from the
  front and stuck out like a sign from the side.
- **A thick slab with an ink ring round the grin.** It read as a mask with a
  hole cut out ("attached in front of it").
- **A guessed forward offset for the hang.** First it sat inside the pecs,
  then it floated 5 cm off the chest. Measure the surface instead of
  guessing.
- **A formula for the chest's top.** It put the rounded edge 2 cm low and
  a band of shirt showed across the beard. Binning the torso's vertices
  didn't work either: its big flat faces have none mid-chest. Raycast it,
  and wait for the torso glb to land first.
- **Live matrices taken before the rig is posed.** They produced NaN, and the
  whole beard vanished. Guard with `posed`.

## What I can still do better (ranked)

Done 2026-10-15: 1 to 5 (shots in `.claude/nft-820/beard-steps/`).

1. **Ride the chest too, not just the head.** The beard is rigid on the
   head. If the head looks down, or the cheek welds to a rifle, the hang
   goes into the chest. A per-vertex blend (jaw rows follow the head, hang
   rows follow the chest, like 2-bone skinning in the vertex shader) keeps it
   draped through every animation. This is the biggest gap for real play.
2. **Let the art set the shape: a depth image.** Bake a grayscale
   `facial-beard-<colour>.depth.png` from the SVG (white = full). Then the
   chin bulge, the moustache line and the thinner sideburns come from the
   drawing, not one distance-field profile, and each beard gets its own
   shape.
3. **A 3D ink outline.** Today the outline is only the drawing's stroke, so
   from the side the edge has no line. The arms' inverted-hull ink
   (`armInk`) on the beard would outline it from every angle.
4. **Fewer vertices.** The grid is about 105k vertices (both surfaces,
   every node). Keep only the nodes the drawn cells use, and drop to a
   coarser grid where the depth is flat: the target is under 15k. Cache the
   built geometry per trait, so 8 players with the beard share one.
5. **Hair, not lines.** Paint the front as clumps and locks, with a light
   edge on each and a darker cleft between them, like the NFT's painted
   beard. Make the outer silhouette tufty (jagged locks at the hem and
   cheeks). It's free in 3D, because the alpha makes the edge.
6. **Trace the NFT tighter.** Measure the reference's beard against its
   face (cheek start, jaw width, hang length as a fraction of the face
   height) and fit the SVG to those numbers, the way the face's edge was
   fitted.
7. **Sideburns to the ears, and from behind.** Carry the curl further, so
   from the back a little hair shows past the skull at the jaw, as a real
   beard would.
8. **One table for every beard.** A `BEARDS` entry per FACIALS beard trait
   (colour, hair dark, thickness, chin rows, depth image) instead of the
   one constant set, so the next beard is a drawing plus one line.
9. **Tests that measure, not just look.** Render the head from 8 yaws and 3
   pitches and pixel-scan for:
   - sky or shirt showing between the beard and the face (a gap);
   - beard pixels behind the chest (clipping);
   - the face's jaw ink showing through (not covered).
   Run it in the ADS cheek weld and on the run.
10. **Other facials with it.** A beard plus a moustache trait: the
    moustache plane has to sit on the beard's front, not the face's.
