# Troll Royale: the C-130 drop-in

User's call (2026-10-09): during the Royale countdown, C-130 Hercules fly in
toward the island from all round, the cargo door opens, and the players and
the NPCs drop out. 12 planes in one wave, 9 trolls each, no shooting aboard.
Hold reference: `refs/c130-hold-ref.jpg`. Airframe traced from Wikimedia
Commons C-130 photographs (side and three-quarter).

## The sequence
1. **T−90 s** You start in your plane's hold, airborne: you can stand, walk,
   sit (hold X at a seat), and look out the windows. Your eight planemates
   sit in the other seats.
2. **T−85 s to T−45 s** The squadron forms up. One plane every 3.5 s comes in
   on its own seeded bearing and joins a stacked holding circle over the
   island: radius 300 m, altitudes 330 + 12·i m, 40 m/s.
3. **T−40 s** The upper cargo door swings up and you watch the others circle.
4. **T−8 s** The red jump light comes on and the planes break onto twelve
   straight runs across the island.
5. **T=0** The ramp lowers and the light goes green. You walk off the ramp,
   or Space runs you out. The bots go in a stick, one every 0.6 s. Past the
   far coast the light goes red and anyone still aboard is put out.
6. The fall and the landing roll are today's `Flight`. The zone goes live
   once the last plane is past the island.

## How it works
- **Ghost hold.** The hold's colliders are a static, axis-aligned copy
  parked in the sky. Movement and the colliders never know the plane moves;
  the hold, the bodies in it and the camera are drawn through the plane's
  matrix (`royale-hold.js` `Hold`, `royale-planes.js`).
- **Seats from the lobby order.** Humans by join time, then bots: plane =
  ⌊slot/9⌋, seat = slot mod 9. Paths are a pure function of (seed, stage
  clock), so nothing new goes over the wire. `dr=DROP_BUS` means aboard.
- **The other 11 planes are instanced**, one InstancedMesh per glb part. Only
  your plane has the inside. No new lights: the hold's materials damp the
  sun themselves (the sun's shadow camera can't reach 330 m up).

## Models (Blender, `models/`)
- `build_c130.blender.py` → `c130.glb`: `C130_Hull` > `C130_Liner`,
  `C130_Ramp` (hinge z +6.25, rotation.x −25° shut, 0 level), `C130_Door`
  (0 shut, +64° up into the tail), `C130_Prop_1..4` (spin about z).
- `build_c130_hold.blender.py` → `c130-hold.glb`: `C130_Hold` >
  `Hold_Seat_0..8`. The materials `H_JumpRed`, `H_JumpGreen` and `H_Glow`
  are lit at runtime.
- Shared frame: the origin is the middle of the cargo floor, −z is the nose,
  and the hold runs z −6.25..+6.25 (the ramp reaches +9.35). The finish is
  the same as Green Candles: bevels with hardened normals, weighted normals,
  panel seams as real geometry, single-sided materials.

## Tuning
`PLANES` in `royale-planes.js`, overridable via `window.__trollPlanesTune`:
count 12, seats 9, speed 40, orbitR 300, baseAlt 330, altStep 12,
arriveEvery 3.5, doorAt 40, breakAt 8, stickEvery 0.6.
