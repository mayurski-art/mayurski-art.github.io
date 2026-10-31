# Scorestreak realism

Bring every scorestreak, and the pad you call them on, up to the stylised
realism the maps and Arsenal v2 guns already have. **Gameplay doesn't
change**: same costs, timings, hitboxes, speeds, paths, HP, node names the
code spins (MainRotor, TailRotor, DroneRotor_0..3, ReconProp, JetProp,
VSAT_Wing_L/R) and network ids. Only models, materials, effects and the
pad's screen change.

References for each streak are in `refs/streaks/<id>/` with a NOTES.md.

## The streaks

| id | Now | Real-world reference | Pipeline | What changes |
|---|---|---|---|---|
| pad (all calls) | box tablet, flat green canvas | Panasonic Toughbook / Getac rugged tablet; ATAK map UI | three.js (procedural, it's held 30 cm from the eye) | Rounded shell with textured polymer, rubber corner bumpers and screws, hand straps on the back, hinge/port blocks; screen behind glass with a moving glare streak, subtle scanlines and backlight bleed; ATAK-style UI (real map tile of the current map, MGRS grid, compass rose, battery/GPS/link bars) per streak |
| carepackage marker | plain cylinder | M18 smoke grenade | three.js | Olive can, spoon, pin ring, yellow stencil band; denser coloured smoke |
| uav | small fixed-wing prop plane | RQ-7B Shadow | Blender (`build_streaks.blender.py` recon) | Twin booms, inverted-V tail, pusher prop with blur disc, sensor ball, nav lights; minimap gets a real radar sweep |
| counteruav | UAV in red | RQ-7B + AN/ALQ-131 jammer pods | Blender (same plane, pod variant) | Underwing jammer pods instead of the red repaint (red kept as a stripe so it still reads apart); minimap static + sweep stutter when jammed |
| carepackage | helicopter.glb + box crate | UH-60M Black Hawk; wooden ammo crate | Blender | Crate: planked wood, steel corners, rope handles, stencils. Heli: see decision 2 |
| drone (HK) + swarm | 4-rotor mini quad | Switchblade 300 (see decision 1) | Blender | Tube body, fold-out tandem wings, pusher prop blur, seeker nose; thin exhaust trail when diving |
| airstrike | strike-jet.glb | F-35A | Blender | Proper planform, canted tails, DSI intakes, canopy glass, RAM grey; afterburner cone + heat shimmer, wingtip vapour on the pull-up |
| samturret | procedural tripod launcher | Avenger Stinger pod on a MANPADS tripod | three.js (procedural, it's already there) | Pod reshaped to Avenger's 4-tube box with end caps that pop, sight block, cable runs; launch flash and white smoke trail |
| k9 | voxel-remeshed dog | Belgian Malinois in a K9 vest | Blender (`build_streaks2`) | Malinois proportions and coat (fawn body, black mask and ears), MOLLE vest with handle; same rig and clips |
| helicopter (Gunship) | attack heli | AH-64E Apache | Blender | Tandem cockpit, stub wings with Hellfire/rocket pods, chin gun, mast sensor; rotor blur discs, engine heat shimmer |
| dragonfire | ducted quad, procedural | BO2's Dragonfire, detailed off a Skydio X2D (motors, arms, gimbal) | three.js (procedural, it's flown in first person) | Carbon arms, motor bells, prop blur inside the ducts, gimbal camera, belt-fed LMG; small downwash dust when low |
| vsat | satellite | AEHF / WGS bus | Blender (`build_streaks3`) | Gold-foil bus with panel seams, two long solar wings with cell grid, dish cluster; sun glint as it crosses |
| warship | VTOL gunship | CV-22 Osprey airframe + AC-130 side guns | Blender (`build_streaks2`) | Osprey nacelles and high wing, sponsons, 25 mm and 105 mm in the side; flares, prop blur |

**Not included**: the Tactical Nuke (its PLGR handheld and blast were built
for realism two weeks ago; say if you want it in) and the Royale C-130
(not a streak).

**Roblox Studio**: nothing planned. Every model here is hard-surface and
Blender's builders already own them; Studio comes in only if the K9 run
cycle needs re-authoring (it shouldn't: same rig).

## Shared effects (three.js, one module `streaks/streak-fx.js`)

- Rotor/prop blur discs: a radial-gradient disc with motion streaks that
  replaces spinning blades above a speed, blades stay visible below it.
- Exhaust: heat shimmer (screen-space refraction quad, off on low quality)
  and a soft additive cone for the jet; thin smoke trails for missiles.
- Nav lights: red/green wingtips, white strobes, blinking on a real cadence.
- Minimap/HUD: radar sweep for UAV (rotating wedge, pings fade), VSAT
  sweeps the whole map at once with facing ticks, Counter-UAV static.
  Pure canvas drawing on the existing minimap, no new DOM.

## Budget

Streak GLBs total about 3.1 MB today (largest c130 is not a streak). Cap:
each model 600 KB, all streak models 4 MB. Phone check per phase: a
streak on screen must not drop an iPhone-class frame (tested at 4x CPU
throttle headless, plus the user's phone at the end). Tris: aircraft
≤ 15k, HK drone ≤ 4k (24 in the air for Swarm), pad ≤ 6k (one, in the hands), dog ≤ 10k and
Dragonfire ≤ 20k (where they are today). `tools/troll-ops-streak-sheet.mjs`
checks all of it and is each phase's test.

## How each one is checked

For every model: four views (side, front 3/4, rear 3/4, top) rendered in
a three.js sheet lab (`labs/streak-sheet.html`, like arms-sheet) so it's
lit like the game, set beside its reference photos, iterated until it
matches. Plus one in-game shot of it doing its job. Each phase gets its own
targeted test (model loads, named nodes still there, gameplay hooks fire,
size under budget), added to `tools/`.

## Phases

0. Sheet lab + baseline sheets of today's models + test harness.
1. The pad and the smoke marker (the thing you look at most).
2. UAV + Counter-UAV + minimap sweep/static.
3. HK + Swarm.
4. Care package crate + drop heli.
5. Gunship.
6. Lightning Strike jet.
7. VSAT.
8. VTOL Warship.
9. K9.
10. Dragonfire + SAM Turret.
11. Phone pass, streak icons re-rendered from the new models
    (`render_streak_icons.blender.py`), cache tags, HANDOFF.

One commit per streak (one system each), ?v= tags bumped per commit.

## Decisions for you

1. **HK drone shape.** Real loitering munition (Switchblade 300: tube with
   pop-out wings and a pusher prop) or keep it a quadcopter and just make
   that realistic? Switchblade is the real-world match for "hand toss,
   hunts, one kill"; flight paths stay the same either way.
2. **Care package heli.** Today the care drop and the Gunship share
   helicopter.glb. Split them (UH-60 Black Hawk drops crates, AH-64 Apache
   is the Gunship), about +350 KB, or keep one model?
3. **Counter-UAV look.** Jammer pods with a red stripe (real), or keep the
   all-red plane (easier to spot)?
4. **Nuke.** Leave it out (default) or add a pass?
