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
BLADE_THICK    = 0.055
TIP_LENGTH     = 0.13    # the wedge at the end

KEY_COLS       = 14      # key field across the blade
KEY_ROWS       = 5
KEY_SIZE       = 0.019
KEY_GAP        = 0.0035
KEY_HEIGHT     = 0.009

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
    """Arrayed keycaps across the blade face, each with its own RGB glow."""
    y0 = GRIP_LENGTH * 0.5 + GUARD_THICK
    pitch = KEY_SIZE + KEY_GAP
    total_w = KEY_COLS * pitch - KEY_GAP
    total_l = KEY_ROWS * pitch - KEY_GAP

    field_start_y = y0 + 0.06
    z_top = BLADE_THICK * 0.5

    keys = []
    for row in range(KEY_ROWS):
        for col in range(KEY_COLS):
            x = -total_w * 0.5 + pitch * col + KEY_SIZE * 0.5
            y = field_start_y + pitch * row + KEY_SIZE * 0.5

            k = new_box(
                f"Key_{row}_{col}",
                (KEY_SIZE, KEY_SIZE, KEY_HEIGHT),
                (x, y, z_top + KEY_HEIGHT * 0.4),
            )
            bevel(k, 0.0015, segments=1)

            # Diagonal rainbow sweep, like a real RGB wave preset.
            hue = ((col / KEY_COLS) * 0.75 + (row / KEY_ROWS) * 0.25) % 1.0
            rgb = hsv_to_rgb(hue, 0.85, 1.0)
            mat = make_material(
                f"KeyGlow_{row}_{col}",
                base_color=(0.05, 0.05, 0.06),
                roughness=0.35,
                emission=rgb,
                emission_strength=3.5,
            )
            assign(k, mat)
            keys.append(k)

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
            radius=0.006, segments=8, ring_count=6,
            location=(x, y - GUARD_THICK * 0.5, -GUARD_HEIGHT * 0.15),
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
    """Trollface head at the base. Sphere now, normal-map the grin later."""
    y = -GRIP_LENGTH * 0.5 - POMMEL_RADIUS * 0.55
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=POMMEL_RADIUS, segments=20, ring_count=14,
        location=(0, y, 0),
    )
    head = bpy.context.active_object
    head.name = "Pommel_Trollface"
    head.scale = (1.0, 0.82, 1.08)

    # Flatten the front so there's a clean face for the trollface decal.
    bpy.context.view_layer.objects.active = head
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    me = head.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for v in bm.verts:
        if v.co.z > POMMEL_RADIUS * 0.45:
            v.co.z = POMMEL_RADIUS * 0.45
    bm.to_mesh(me)
    bm.free()

    return [head]


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
    for o in pommel:
        assign(o, mat_troll)

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
    # while the grip and pommel round off.
    bpy.ops.object.shade_smooth()
    sword.data.use_auto_smooth = True if hasattr(
        sword.data, "use_auto_smooth") else False

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
