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
  keyboard_sword.tscn                the weapon scene (placeholder geometry)
player/player.gd                     minimal FPS controller
player/test_dummy.gd                 punching bag implementing take_damage()
player/test_range.tscn               the test scene (main scene)
tools/build_keyboard_sword.py        Blender script → generates the real model
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

## Getting the real model in

The weapon currently uses **placeholder boxes** sized to match the real
model. To replace them:

1. Install Blender — it's free: <https://www.blender.org/download/>
2. Open the Scripting tab → Open → `tools/build_keyboard_sword.py` → Run
3. It writes `weapons/keyboard_sword/keyboard_sword.glb`
4. In Godot, open `keyboard_sword.tscn`, delete the four `MeshInstance3D`
   nodes under `Model`, and drag the `.glb` in as a child of `Model`

Because the placeholder matches the real dimensions, the hit box, animations
and hand position all stay correct after the swap. Nothing else changes.

The script builds everything procedurally — blade, arrayed keycaps with a
per-key RGB emission ramp, riveted crossguard, wrapped grip, trollface
pommel — then joins it into one mesh with the origin at the grip so it
rotates around the hand. Tunables are at the top of the file; change a
number, re-run, iterate on the silhouette.

Still to do by hand in Blender: UV unwrap, the "U MAD BRO?" text on the
crossguard, and the trollface grin on the pommel (normal map on the
flattened front face, not sculpted geometry).

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
