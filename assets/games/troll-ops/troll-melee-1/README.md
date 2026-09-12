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

Current cost: **~7.4k triangles, 16 primitives**. Two numbers to respect if
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

Still to do by hand in Blender: UV unwrap, the "U MAD BRO?" text on the
crossguard, and a proper trollface on the pommel. The pommel currently has
a blocked-in grin and brow ridges so it reads in silhouette; the real face
belongs in a normal map on the flattened front, not in geometry.

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
