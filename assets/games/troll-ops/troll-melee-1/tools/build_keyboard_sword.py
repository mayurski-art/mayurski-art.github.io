# Keyboard Warrior - procedural blockout generator
#
# HOW TO RUN
#   1. Open Blender (free: https://www.blender.org/download/)
#   2. Switch to the "Scripting" tab at the top
#   3. Click "Open" and pick this file (or "New" and paste it in)
#   4. Press "Run Script" (the play arrow)
#   5. A .glb lands next to this script, in ../weapons/keyboard_sword/
#
# The sword is built grip-first: the origin sits at the handle so it
# rotates around the hand, not the blade. Units are metres. The whole
# thing is ~1.1m long, oversized on purpose - it should read as absurd.

import bpy
import bmesh
import math
import os
from mathutils import Vector

# ----------------------------------------------------------------------
# Tunables - change these, re-run, iterate on the silhouette
# ----------------------------------------------------------------------

BLADE_LENGTH   = 0.78    # keyboard body, grip to tip
BLADE_WIDTH    = 0.30    # matches a full-size board
BLADE_THICK    = 0.038   # slimmer - a board, not a plank
TIP_LENGTH     = 0.15    # the wedge at the end

# The key field fills the blade face on both sides. Cap size is derived
# from the blade, so changing BLADE_WIDTH/LENGTH rescales the keys instead
# of leaving a bare slab or overflowing the edge.
KEY_COLS       = 10      # keys across the width
KEY_ASPECT     = 1.25    # cap length / width - keeps caps square-ish
KEY_HUES       = 12      # shared RGB materials (NOT one per key)
KEY_GAP        = 0.0035
KEY_HEIGHT     = 0.008
KEY_MARGIN     = 0.016   # bezel around the key field

GUARD_WIDTH    = 0.42    # the "U MAD BRO?" crossbar
GUARD_HEIGHT   = 0.052
GUARD_THICK    = 0.075

GRIP_LENGTH    = 0.26
GRIP_RADIUS    = 0.026

POMMEL_RADIUS  = 0.055   # trollface head

EXPORT_NAME    = "keyboard_sword.glb"


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------

def clear_scene():
    """Wipe everything so re-running is idempotent."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def new_box(name, size, location):
    """Axis-aligned box. size/location are (x, y, z) tuples."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = Vector(size)
    return obj


def bevel(obj, width, segments=2):
    mod = obj.modifiers.new(name="Bevel", type="BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(40)
    return mod


def make_material(name, base_color, roughness=0.6, metallic=0.0,
                  emission=None, emission_strength=0.0):
    """Minimal PBR material. Emission drives the RGB key glow."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def hsv_to_rgb(h, s, v):
    """Rainbow ramp for the per-key RGB backlight."""
    i = int(h * 6.0)
    f = h * 6.0 - i
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    return [(v, t, p), (q, v, p), (p, v, t),
            (p, q, v), (t, p, v), (v, p, q)][i % 6]


# ----------------------------------------------------------------------
# Parts
# ----------------------------------------------------------------------
# Layout along +Y: grip at origin, blade extends forward.
#   Y = 0            -> hand / grip centre
#   Y = +GUARD       -> crossguard
#   Y = +BLADE       -> keyboard body
#   Y = -POMMEL      -> trollface head

def build_blade():
    """The keyboard chassis - a long flat box with a wedge tip."""
    y0 = GRIP_LENGTH * 0.5 + GUARD_THICK
    body_len = BLADE_LENGTH - TIP_LENGTH

    body = new_box(
        "Blade_Body",
        (BLADE_WIDTH, body_len, BLADE_THICK),
        (0, y0 + body_len * 0.5, 0),
    )
    bevel(body, 0.004)

    # Tip: a box with the far face collapsed to a chisel edge.
    tip = new_box(
        "Blade_Tip",
        (BLADE_WIDTH, TIP_LENGTH, BLADE_THICK),
        (0, y0 + body_len + TIP_LENGTH * 0.5, 0),
    )
    bpy.context.view_layer.objects.active = tip
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    me = tip.data
    bm = bmesh.new()
    bm.from_mesh(me)
    ys = [v.co.y for v in bm.verts]
    far = max(ys)
    for v in bm.verts:
        if abs(v.co.y - far) < 1e-5:
            v.co.x *= 0.12   # pinch to a point
            v.co.z *= 0.35
    bm.to_mesh(me)
    bm.free()
    bevel(tip, 0.003)

    return [body, tip]


def build_keys():
    """Keycaps covering both blade faces, lit by a shared RGB palette.

    Cap size is derived from the blade dimensions. Both faces get keys -
    it is a sword, you see both sides mid-swing.
    """
    y0 = GRIP_LENGTH * 0.5 + GUARD_THICK
    z_top = BLADE_THICK * 0.5

    # Fit KEY_COLS keys across the usable width.
    usable_w = BLADE_WIDTH - KEY_MARGIN * 2.0
    key_w = (usable_w - KEY_GAP * (KEY_COLS - 1)) / KEY_COLS
    pitch_x = key_w + KEY_GAP
    total_w = KEY_COLS * pitch_x - KEY_GAP

    # Row count follows from the cap aspect ratio rather than being fixed:
    # pinning rows makes caps stretch into strips whenever the blade is
    # long. Rows are then re-fitted to the exact field length so the last
    # row lands flush with the tip.
    field_start_y = y0 + KEY_MARGIN
    field_end_y = y0 + (BLADE_LENGTH - TIP_LENGTH) - KEY_MARGIN
    field_len = field_end_y - field_start_y

    rows = max(int(round(field_len / (key_w * KEY_ASPECT + KEY_GAP))), 1)
    pitch_y = (field_len + KEY_GAP) / float(rows)
    key_l = pitch_y - KEY_GAP

    # A shared palette. Reusing materials keeps the export to a handful of
    # primitives instead of one per key - 990 unique materials would mean
    # ~990 draw calls for a single weapon.
    palette = []
    for i in range(KEY_HUES):
        rgb = hsv_to_rgb(i / float(KEY_HUES), 0.9, 1.0)
        palette.append(make_material(
            f"KeyGlow_{i:02d}",
            base_color=(rgb[0] * 0.55, rgb[1] * 0.55, rgb[2] * 0.55),
            roughness=0.32,
            emission=rgb,
            emission_strength=1.6,
        ))

    keys = []
    for side, z_sign in ((0, 1.0), (1, -1.0)):
        for row in range(rows):
            for col in range(KEY_COLS):
                x = -total_w * 0.5 + pitch_x * col + key_w * 0.5
                y = field_start_y + pitch_y * row + key_l * 0.5

                k = new_box(
                    f"Key_{side}_{row}_{col}",
                    (key_w, key_l, KEY_HEIGHT),
                    (x, y, z_sign * (z_top + KEY_HEIGHT * 0.4)),
                )
                # No bevel on caps: invisible at this scale, and it would
                # roughly triple the triangle count of the whole weapon.

                # Diagonal rainbow sweep, like a real RGB wave preset.
                t = (col / float(KEY_COLS)) * 0.7 + (row / float(rows)) * 0.3
                assign(k, palette[int(t * KEY_HUES) % KEY_HUES])
                keys.append(k)

    print(f"[keyboard_sword] key field: {KEY_COLS} x {rows} x2 sides "
          f"({key_w * 1000:.0f} x {key_l * 1000:.0f}mm caps, "
          f"{KEY_HUES} shared materials)")
    return keys


def build_guard():
    """Crossguard - the 'U MAD BRO?' bar. Text goes in the texture."""
    y = GRIP_LENGTH * 0.5 + GUARD_THICK * 0.5
    guard = new_box(
        "Guard",
        (GUARD_WIDTH, GUARD_THICK, GUARD_HEIGHT),
        (0, y, 0),
    )
    bevel(guard, 0.006, segments=3)

    # Rivet studs along the front face, as in the fabricated prop.
    rivets = []
    count = 11
    span = GUARD_WIDTH * 0.82
    for i in range(count):
        x = -span * 0.5 + span * (i / (count - 1))
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.0085, segments=10, ring_count=8,
            location=(x, y - GUARD_THICK * 0.52, -GUARD_HEIGHT * 0.12),
        )
        r = bpy.context.active_object
        r.name = f"Rivet_{i}"
        rivets.append(r)

    return [guard] + rivets


def build_grip():
    """Wrapped handle - a tapered cylinder with ridges."""
    bpy.ops.mesh.primitive_cylinder_add(
        radius=GRIP_RADIUS, depth=GRIP_LENGTH,
        vertices=16, location=(0, 0, 0),
    )
    grip = bpy.context.active_object
    grip.name = "Grip"
    grip.rotation_euler[0] = math.radians(90)   # stand it along Y

    bpy.context.view_layer.objects.active = grip
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    # Ridges for the leather wrap.
    me = grip.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.subdivide_edges(
        bm,
        edges=[e for e in bm.edges
               if abs(e.verts[0].co.y - e.verts[1].co.y) > 1e-4],
        cuts=9, use_grid_fill=False,
    )
    for v in bm.verts:
        band = math.sin(v.co.y * 90.0)
        if abs(v.co.x) > 1e-5 or abs(v.co.z) > 1e-5:
            scale = 1.0 + band * 0.07
            v.co.x *= scale
            v.co.z *= scale
    bm.to_mesh(me)
    bm.free()

    return [grip]


def build_pommel():
    """Trollface head at the base.

    A flattened sphere for the skull, plus a raised grin bar and two brow
    ridges so the mascot reads in silhouette. The fine detail of the face
    belongs in a normal map painted onto the flat front - this is just
    enough geometry that it isn't a featureless ball.
    """
    y = -GRIP_LENGTH * 0.5 - POMMEL_RADIUS * 0.55
    face_z = POMMEL_RADIUS * 0.48

    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=POMMEL_RADIUS, segments=22, ring_count=16,
        location=(0, y, 0),
    )
    head = bpy.context.active_object
    head.name = "Pommel_Trollface"
    head.scale = (1.05, 0.80, 1.12)

    bpy.context.view_layer.objects.active = head
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Flatten the front into a clean plane for the face decal.
    me = head.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for v in bm.verts:
        if v.co.z > face_z:
            v.co.z = face_z
    bm.to_mesh(me)
    bm.free()

    parts = [head]

    # The grin - a wide flattened box, slightly curved by tapering the ends.
    grin = new_box(
        "Pommel_Grin",
        (POMMEL_RADIUS * 1.30, POMMEL_RADIUS * 0.30, 0.006),
        (0, y - POMMEL_RADIUS * 0.10, face_z + 0.002),
    )
    bpy.context.view_layer.objects.active = grin
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    me = grin.data
    bm = bmesh.new()
    bm.from_mesh(me)
    xs = [abs(v.co.x) for v in bm.verts]
    far_x = max(xs) if xs else 1.0
    for v in bm.verts:
        # Curl the mouth corners up into a smirk.
        t = (abs(v.co.x) / far_x) if far_x else 0.0
        v.co.y += t * t * POMMEL_RADIUS * 0.22
    bm.to_mesh(me)
    bm.free()
    bevel(grin, 0.0015, segments=1)
    parts.append(grin)

    # Brow ridges above the grin.
    for i, sx in enumerate((-1.0, 1.0)):
        brow = new_box(
            f"Pommel_Brow_{i}",
            (POMMEL_RADIUS * 0.46, POMMEL_RADIUS * 0.16, 0.005),
            (sx * POMMEL_RADIUS * 0.34,
             y + POMMEL_RADIUS * 0.30,
             face_z + 0.002),
        )
        brow.rotation_euler[1] = math.radians(-10.0 * sx)
        bevel(brow, 0.0012, segments=1)
        parts.append(brow)

    return parts


# ----------------------------------------------------------------------
# Assemble
# ----------------------------------------------------------------------

def build():
    clear_scene()

    mat_chassis = make_material("Chassis", (0.055, 0.055, 0.062),
                                roughness=0.42, metallic=0.65)
    mat_metal   = make_material("Guard_Metal", (0.62, 0.63, 0.66),
                                roughness=0.28, metallic=1.0)
    mat_leather = make_material("Grip_Leather", (0.19, 0.09, 0.05),
                                roughness=0.85)
    mat_troll   = make_material("Trollface_Metal", (0.74, 0.75, 0.78),
                                roughness=0.22, metallic=1.0)
    mat_ink     = make_material("Trollface_Ink", (0.02, 0.02, 0.025),
                                roughness=0.55)

    blade  = build_blade()
    keys   = build_keys()
    guard  = build_guard()
    grip   = build_grip()
    pommel = build_pommel()

    for o in blade:
        assign(o, mat_chassis)
    for o in guard:
        assign(o, mat_metal)
    for o in grip:
        assign(o, mat_leather)
    # Chrome skull, dark ink for the grin and brows so the face reads.
    for o in pommel:
        assign(o, mat_ink if ("Grin" in o.name or "Brow" in o.name)
               else mat_troll)

    everything = blade + keys + guard + grip + pommel

    # Apply modifiers, then join into a single mesh.
    for o in everything:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)

    bpy.ops.object.select_all(action="DESELECT")
    for o in everything:
        o.select_set(True)
    bpy.context.view_layer.objects.active = blade[0]
    bpy.ops.object.join()

    sword = bpy.context.active_object
    sword.name = "KeyboardSword"

    # Origin at the grip so it swings around the hand, and transforms
    # applied so Godot imports it at a sane scale/rotation.
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Smooth shading with an angle threshold keeps the keycaps crisp
    # while the grip and pommel round off. Blender 4.1 removed
    # use_auto_smooth in favour of shade_smooth_by_angle().
    if hasattr(bpy.ops.object, "shade_smooth_by_angle"):
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    else:
        bpy.ops.object.shade_smooth()
        if hasattr(sword.data, "use_auto_smooth"):
            sword.data.use_auto_smooth = True
            sword.data.auto_smooth_angle = math.radians(35)

    return sword


def export(sword):
    here = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() \
        else bpy.path.abspath("//")
    out_dir = os.path.normpath(os.path.join(here, "..", "weapons",
                                            "keyboard_sword"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, EXPORT_NAME)

    bpy.ops.object.select_all(action="DESELECT")
    sword.select_set(True)
    bpy.context.view_layer.objects.active = sword

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,             # Godot expects +Y up
        export_apply=True,
        export_materials="EXPORT",
    )

    tris = sum(len(p.vertices) - 2 for p in sword.data.polygons)
    print(f"[keyboard_sword] exported -> {out_path}")
    print(f"[keyboard_sword] ~{tris} triangles")
    return out_path


if __name__ == "__main__":
    sword = build()
    export(sword)
