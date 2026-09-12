# Troll Ops — Melee Weapons (Godot)

Custom trollface melee weapons. First one in: **Keyboard Warrior**, from
@swishpng's design sheet — an RGB mechanical keyboard fused to a Guts-style
slab sword, "U MAD BRO?" crossguard, trollface pommel.

Open `project.godot` in **Godot 4.7**, press F5. You spawn in a test range
with three dummies. Left click swings.

```
WASD    move          Shift  sprint
Space   jump          Esc    release mouse
LMB     SWING
```

## What's here

```
weapons/melee_weapon.gd              base class — swing, hit window, damage
weapons/keyboard_sword/
  keyboard_sword.gd                  rest pose + procedural swing animations
  keyboard_sword.tscn                the weapon scene
  keyboard_sword.glb                 generated model (7.4k tris)
player/player.gd                     minimal FPS controller
player/test_dummy.gd                 punching bag implementing take_damage()
player/test_range.tscn               the test scene (main scene)
tools/build_keyboard_sword.py        Blender script that generates the .glb
tools/test_melee.gd                  headless smoke test
tools/screenshot.gd                  renders swing frames to disk
```

## The one idea worth understanding

Damage is **not** applied when you click. The swing animation opens a *hit
window* partway through the arc via a call-method track, and closes it after
the follow-through. Only while that window is open can the blade hit
anything. That's what makes a swing feel like it has weight instead of being
an instant hitscan.

In `keyboard_sword.gd` the window is `0.19s → 0.40s` of a `0.58s` swing.
Tune those two numbers to change how the weapon feels — earlier open = more
responsive, longer window = more forgiving.

If an animation has no method tracks, `melee_weapon.gd` falls back to
timers at `window_open`/`window_close` fractions, so a weapon works even
before anyone authors animations for it.

## Regenerating the model

The real model is already built and wired in (`keyboard_sword.glb`). To
change it, edit the tunables at the top of `tools/build_keyboard_sword.py`
and re-run:

```bash
blender --background --python tools/build_keyboard_sword.py
```

Or open Blender (free: <https://www.blender.org/download/>), Scripting tab →
Open → pick the script → Run Script. It overwrites the `.glb` in place, and
Godot re-imports it on next open. Blender costs nothing — there is no quota.

Current cost: **~10.7k triangles** (the "U MAD BRO?" lettering
is real extruded geometry and accounts for ~2.3k of that). Two numbers to
respect if
you change the key field:

- Triangles: aim for 3k–8k for a first-person weapon.
- Primitives (draw calls): keys share a 12-colour palette via `KEY_HUES`.
  Giving each key its own material took this to 995 primitives — one draw
  call per key. Do not do that.

Key caps have no bevel on purpose: invisible at this size, and it tripled
the triangle count.

The script builds everything procedurally — blade, arrayed keycaps with a
per-key RGB emission ramp, riveted crossguard, wrapped grip, trollface
pommel — then joins it into one mesh with the origin at the grip so it
rotates around the hand. Tunables are at the top of the file; change a
number, re-run, iterate on the silhouette.

Still to do by hand in Blender: UV unwrap, and a proper trollface on the
pommel. The pommel has a blocked-in grin and brow ridges so it reads in
silhouette; the real face belongs in a normal map on the flattened front,
not in geometry.

## The same weapon lives in two places

This Godot project is the modeling and prototyping track. The weapon that
players actually swing is in the browser game, built with Three.js in
`../gear.js` (`buildKeyboardSword`). The two are deliberately kept
recognisably identical - same proportions, same parts, same lettering - so
changing one means changing the other.

Where they differ, and why:

- Keycaps: Blender makes 360 separate boxes joined into one mesh; the web
  build uses a single `InstancedMesh`. Same look, and the web version stays
  at one draw call.
- Lettering: Blender extrudes real 3D text. Three.js `TextGeometry` needs a
  font file the game does not ship, so the web build paints the text onto a
  canvas texture instead. Indistinguishable at view-model distance.

## Collision layers

| Layer | Used for |
|-------|----------|
| 1     | world + player bodies |
| 2     | damageable targets — `HitArea` masks this |

Anything you want the sword to hit needs `collision_layer = 2` and a
`take_damage(amount, impulse, point)` method.

## Tests

```bash
godot --headless --script res://tools/test_melee.gd
```

19 checks: scene loads, animations build, hit window opens mid-swing and
closes after, cooldown blocks double-swings, damage lands, and one swing
can't hit the same target twice. Exits non-zero on failure.

To render swing frames, attach `tools/screenshot.gd` to a copy of the test
range as a child node and run that scene — PNGs land in `user://shots`.

## Adding the next weapon

Inherit the base class, set a rest pose, done:

```gdscript
extends MeleeWeapon

const REST_POS := Vector3(0.30, -0.30, -0.62)
const REST_ROT := Vector3(34.0, -16.0, 18.0)
```

Duplicate `keyboard_sword.tscn`, swap the mesh, resize `HitArea` to the new
blade, and tune `damage` / `cooldown` in the inspector.

## Authoring an attack

Two approaches live in `keyboard_sword.gd`, and which one to use depends on
the motion:

- **Arcing cuts** go through `_tip_path_anim()`. You give it the path the
  blade TIP should travel and it solves the grip transform backwards. Do
  not keyframe rotation directly for these: a few degrees of roll move the
  tip further than any plausible hand movement, so the tip ends up
  wandering backwards even when every position offset points forward.
- **Thrusts** keyframe the grip directly. The tip solver aims the blade at
  wherever the tip is heading, which for a straight thrust is almost dead
  ahead - so it leaves the sword in its resting diagonal and just slides it
  forward, which reads as shoving the flat of the board at someone.

Whatever you author, run the arc test:

```bash
godot --headless --script res://tools/test_swing_arc.gd
```

It measures where the blade actually goes rather than whether the animation
plays, which is the only way to catch a swing that runs in reverse - that
looks completely wrong on screen while passing every other check.

One gotcha when screenshotting a pose: the weapon auto-plays `idle` on
ready, and its tracks overwrite anything you `seek()` to on the very next
frame. Call `pause()` after seeking or you will photograph the rest pose
over and over.

## Why the RGB sits under the caps

The obvious way to build a backlit keyboard is to colour the keycaps. It
looks wrong - the blade turns into a pastel candy grid, nothing like the
reference.

A real board has *dark plastic caps with the LED underneath*, so the colour
you see is light escaping around each cap. The model matches that: every key
is a glowing base with a near-black cap sitting on it, slightly smaller, so
a lit rim shows on all four sides.

A single glowing slab under the whole field does not work either. Opaque
caps just occlude it, and light cannot spill sideways in a rasterizer the
way it does on a real board - you get a lit border around the key field and
nothing between the keys. The emissive surface has to be per-key, where the
light actually escapes.

## Emission does not survive the trip to Godot unchanged

glTF carries emission strength through as a raw multiplier, and Godot's
filmic tonemap plus the test scene's bloom amplify it hard. A value tuned by
eye in Blender's EEVEE preview (9.0) blew out to solid white in-engine and
washed the dark caps to pale grey.

The exported value is ~1.35, which looks dim in Blender and correct in
Godot. **Judge emission in the engine, never in the Blender viewport.**
