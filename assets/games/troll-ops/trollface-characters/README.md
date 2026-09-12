# Trollface Operator — shared character rig

The one playable-character model every Troll Ops surface uses: the
Godot melee/ranged prototypes (`../troll-melee-1`, `../troll-greencandles`),
the first-person viewmodel arms in both, and the in-browser locker viewer
on the lobby's Match Setup panel.

Look: the "Trollge" stick figure — thin dark limbs meeting at a hub under
the chin, simple flat mitten hands and feet, and a head that is the real,
flat trollface artwork (`../../../images/wallpaper/trollface transparent.png`)
lightly extruded into a sign board, not a sculpted face. Same silhouette
as the site's runtime rig in `../character.js` (`buildHumanoid`).

## Regenerating the model

```bash
blender --background --python tools/build_trollface_character.py
```

Or open Blender, Scripting tab → Open → pick the script → Run Script. It
overwrites `character/trollface_operator.glb` in place. After
regenerating, copy the new `.glb` into both Godot projects — they each
keep their own copy since Godot doesn't resolve `res://` paths outside a
project:

```bash
cp character/trollface_operator.glb ../troll-melee-1/character/
cp character/trollface_operator.glb ../troll-greencandles/character/
```

Then reimport in Godot (`godot --headless --path <project> --import`) and
re-run each project's `tools/test_viewmodel_arms.gd`.

## What's here

```
tools/build_trollface_character.py   Blender script that generates the .glb
tools/screenshot.py                  renders front/3-quarter/back previews
character/trollface_operator.glb     generated model (~1.3k tris)
character/_preview/*.png             reference renders from screenshot.py
```

## Rig structure

`TrollfaceRig > Skeleton3D > {Mesh_Head, Mesh_Arm_L, Mesh_Arm_R,
Mesh_Leg_L, Mesh_Leg_R}`, each mesh rigidly weighted 1.0 to its
like-named bone (`Head`, `Arm_L`, `Arm_R`, `Leg_L`, `Leg_R`, all children
of a `Hub` root bone). No elbows or knees — a stick figure doesn't need
them, and every joint is a single rigid bone.

**Meshes and bones are named differently on purpose.** A mesh object
named identically to its bone (e.g. both called `Arm_L`) makes Blender's
glTF exporter silently rename one side of the collision — the bone
imports into Godot as `Arm_L_2` instead of `Arm_L`, breaking any
`find_bone("Arm_L")` lookup with no error anywhere. Meshes are prefixed
`Mesh_` to sidestep this. See the `parent_and_weight()` docstring in the
build script for the full explanation.

## Using it in a new scene

Both Godot projects show the pattern in `player/viewmodel_arms.gd`:
instance the `.glb`, hide the `Mesh_Head`/`Mesh_Leg_*` meshes (first
person only wants arms), and pose the `Arm_L`/`Arm_R` bones directly via
`Skeleton3D.set_bone_pose_rotation()` rather than reparenting mesh nodes
(which would detach them from the skin binding).

The browser locker viewer (`../char-inspector.js`) takes a different
path: it doesn't load this `.glb` at all, it reuses the runtime
`buildHumanoid()`/`poseHumanoid()` rig from `../character.js` so the
character shown in the menu is provably the same one bots and other
players use in a match. Keep the two rigs' proportions in sync by eye if
you tune one — they're built independently (Blender vs. Three.js
primitives) but are meant to read as the same character.

## Mascot rule

Never use the troll Unicode emoji. The head texture is the real artwork
at `../../../images/wallpaper/trollface transparent.png` — if that file
moves, update `TEXTURE_REL` in the build script and the `TROLLFACE_TEXTURE`
loader path in `../character.js` together.
