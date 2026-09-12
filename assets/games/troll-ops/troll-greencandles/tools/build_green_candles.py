# Green Candles - procedural blockout generator
#
# HOW TO RUN
#   1. Open Blender (free: https://www.blender.org/download/)
#   2. Switch to the "Scripting" tab at the top
#   3. Click "Open" and pick this file (or "New" and paste it in)
#   4. Press "Run Script" (the play arrow)
#   5. Two .glb files land next to this script, in ../weapons/green_candles/
#      - green_candles.glb       body + tank + grip (everything but the cell)
#      - green_candles_cell.glb  the fuel cell alone, so Godot can animate
#        it detaching and reinserting on reload
#
# Built grip-first: the origin sits at the pistol grip so it aims around
# the hand, not the muzzle. Units are metres.
#
# HELD LIKE A RIFLE/LAUNCHER, NOT A BOTTLE ROCKET: the barrel (housing ->
# horn -> brass collar) runs along local BLENDER +Y, which export_yup=True
# maps to GODOT -Z (forward) - exactly like a rifle laid along its
# sightline. The glowing fuel cell rides on top of the barrel (Blender Z,
# which becomes Godot +Y/up), where a rocket launcher's sight or a GL's
# drum sits.
#
# Do not build "forward" along Blender Z out of habit: Blender Z is UP in
# Blender's own viewport, and export_yup=True sends it to Godot's +Y (also
# up) - so a barrel built along Blender Z lands standing vertically in
# Godot, which is exactly the "held upright like a bottle rocket" bug an
# earlier revision of this script had. Blender's Y axis is the one that
# becomes Godot's forward (-Z) axis. Verified empirically in-engine, not
# just from the axis-convention docs - see the troll-greencandles session
# notes on why "should be right" isn't the same as "measured right."
#
# Same silhouette as the Three.js buildTankLauncher() model in
# ../../weapon-model.js - keep both in sync if you tune one, though that
# model is still vertical; port this orientation fix there too when able.

import bpy
import bmesh
import math
import os
from mathutils import Vector

# ----------------------------------------------------------------------
# Tunables - change these, re-run, iterate on the silhouette
# ----------------------------------------------------------------------

LEN            = 0.62    # overall barrel reference length (grip to muzzle)

HOUSING_SIZE   = (0.09, 0.117, LEN * 0.34)   # x, y, z - grip/trigger box

HORN_LENGTH    = LEN * 0.5
HORN_FRONT_R   = 0.05    # radius at the muzzle end
HORN_BACK_R    = 0.088   # radius at the housing end

BRASS_LENGTH   = 0.05
BRASS_FRONT_R  = 0.052
BRASS_BACK_R   = 0.062

CELL_RADIUS    = 0.042
CELL_HEIGHT    = 0.22    # stands upright (local Y) on top of the barrel
CELL_NUB_H     = CELL_HEIGHT * 0.16
CELL_SIT_Z     = LEN * 0.5   # how far along the barrel (forward = +Z) the cell sits

COLLAR_HEIGHT  = 0.018   # dark socket ring the cell seats into

TANK_SIZE      = (0.05, LEN * 0.34, 0.075)
TANK_OFFSET_X  = -0.10

GRIP_SIZE      = (0.05, 0.16, 0.06)
GRIP_TILT_DEG  = 16.0

TRIGGER_SIZE   = (0.03, 0.05, 0.04)

EXPORT_NAME      = "green_candles.glb"
EXPORT_CELL_NAME = "green_candles_cell.glb"


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
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def new_cylinder(name, radius_a, radius_b, height, location, rotation=(0, 0, 0), verts=16):
    """Cone/cylinder along the given rotation. radius_a is the +axis end."""
    bpy.ops.mesh.primitive_cone_add(
        vertices=verts, radius1=radius_b, radius2=radius_a,
        depth=height, location=location, rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    return obj


def bevel(obj, width, segments=2):
    mod = obj.modifiers.new(name="Bevel", type="BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(40)
    return mod


def make_material(name, base_color, roughness=0.5, metallic=0.0,
                   emission=None, emission_strength=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base_color, alpha)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1.0:
        mat.blend_method = "BLEND"
    return mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def apply_all_modifiers(objs):
    for o in objs:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)


def join_objects(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj


def apply_authoring_to_export_rotation(obj):
    """Converts the authoring frame (+Z forward, +Y up) into the frame
    export_yup=True actually turns into Godot's (-Z forward, +Y up).
    The correct sign here was re-verified with tools/inspect_model.gd
    (real exported AABB, not arithmetic) after fixing FORWARD_ROT to no
    longer misdirect the barrel's own axis - do the same if this is ever
    touched again: change one sign, export, print the AABB, don't reason
    it out by hand. Applied as a real transform (not left as a node
    rotation) so the origin-set/transform_apply calls that follow bake it
    into the mesh."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.rotation_euler = (math.radians(-90), 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)


# ----------------------------------------------------------------------
# Parts
# ----------------------------------------------------------------------
# Every part below is authored in an AUTHORING frame where +Z is "forward
# along the barrel" and +Y is "up" - the natural way to think about a gun
# without also juggling Blender's Y-up-on-export quirk while placing every
# single part. primitive_cone_add() already builds a cone/cylinder with
# its long axis along local Z by default, which is exactly this frame's
# forward axis - so barrel parts need NO rotation at all. (An earlier
# revision rotated them +90deg about X "to point them forward," which
# actually swings a Z-axis cone's long axis onto authoring Y instead -
# confirmed by rendering the model and seeing the horn come out as a
# squat disc rather than a tapered tube. Lesson: rotating a primitive to
# "face a direction" needs the actual rotated axis checked, not assumed.)
#
# The whole assembly gets ONE corrective rotation in build_body()/
# build_cell() right before export, converting authoring-Z-forward into
# Blender-Y-forward - which is what export_yup=True then correctly turns
# into Godot's -Z (forward). Doing the axis fix once at the end, instead
# of re-deriving every part's coordinates in Blender's own frame, is what
# actually keeps this maintainable - and it's the one thing worth
# VERIFYING IN-ENGINE rather than trusting arithmetic for, since a wrong
# sign here reproduces the exact "stands up like a bottle rocket" bug an
# earlier revision shipped.

FORWARD_ROT = (0, 0, 0)   # cones already run along local Z, the authoring-forward axis


def build_housing():
    """Grip/trigger box at the back of the barrel."""
    housing = new_box("Housing", HOUSING_SIZE, (0, 0, HOUSING_SIZE[2] * 0.5))
    bevel(housing, 0.006)
    return [housing]


def build_horn_and_collar():
    """Tapered horn body plus the brass collar band at the muzzle end.

    Authoring +Z is forward (away from the shooter), so each part after
    the housing needs to sit further along +Z than the one before it,
    center placed a half-length past the previous part's far face - not
    HOUSING_SIZE[2] minus the new part's own half-length, which pulls it
    backward into overlapping the housing instead of extending past it.
    """
    horn_z = HOUSING_SIZE[2] + HORN_LENGTH * 0.5
    horn = new_cylinder(
        "Horn", HORN_FRONT_R, HORN_BACK_R, HORN_LENGTH,
        (0, 0, horn_z), rotation=FORWARD_ROT,
    )
    bevel(horn, 0.004, segments=1)

    brass_z = HOUSING_SIZE[2] + HORN_LENGTH + BRASS_LENGTH * 0.5
    brass = new_cylinder(
        "BrassCollar", BRASS_FRONT_R, BRASS_BACK_R, BRASS_LENGTH,
        (0, 0, brass_z), rotation=FORWARD_ROT,
    )
    return [horn, brass], brass_z + BRASS_LENGTH * 0.5


def build_cell_socket():
    """Dark ring on top of the barrel the fuel cell seats into."""
    socket = new_cylinder(
        "CellSocket", CELL_RADIUS * 1.12, CELL_RADIUS * 1.12, COLLAR_HEIGHT,
        (0, HORN_BACK_R * 0.62, CELL_SIT_Z),
    )
    return [socket]


def build_fuel_cell():
    """The glowing green fuel cylinder, as its own separate mesh so Godot
    can pull it out and reinsert it on reload. Built in its OWN local
    space (not offset onto the barrel) - green_candles.gd positions it at
    runtime relative to the socket."""
    cell = new_cylinder("FuelCell", CELL_RADIUS, CELL_RADIUS, CELL_HEIGHT, (0, 0, 0))
    nub = new_cylinder("FuelCellNub", CELL_RADIUS * 0.3, CELL_RADIUS * 0.3, CELL_NUB_H,
                        (0, 0, CELL_HEIGHT * 0.5 + CELL_NUB_H * 0.5))
    return [cell, nub]


def build_tank_and_hose():
    """Side tank ('GREEN CANDLES') and the hose feeding the fuel cell."""
    tank_z = HOUSING_SIZE[2] * 0.4
    tank = new_box("Tank", TANK_SIZE, (TANK_OFFSET_X, 0, tank_z))
    bevel(tank, 0.005)

    stripe_size = (0.006, TANK_SIZE[1] * 0.62, TANK_SIZE[2] * 1.01)
    stripe = new_box("TankStripe", stripe_size,
                      (TANK_OFFSET_X - TANK_SIZE[0] * 0.5 - 0.003, 0, tank_z))

    hose_len = HORN_LENGTH * 0.4
    hose = new_cylinder(
        "Hose", 0.009, 0.009, hose_len,
        (TANK_OFFSET_X * 0.55, HORN_BACK_R * 0.3, CELL_SIT_Z + hose_len * 0.2),
        rotation=(math.radians(70), 0, math.radians(20)),
    )

    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.026, minor_radius=0.009,
        location=(TANK_OFFSET_X * 0.3, HORN_BACK_R * 0.55, CELL_SIT_Z),
        rotation=(0, math.radians(90), 0),
    )
    elbow = bpy.context.active_object
    elbow.name = "HoseElbow"

    return [tank, stripe, hose, elbow]


def build_grip_and_trigger():
    """Pistol grip under the housing, angled back, plus a trigger block."""
    grip = new_box("Grip", GRIP_SIZE, (0, -HOUSING_SIZE[1] * 0.5, HOUSING_SIZE[2] * 0.15))
    bpy.context.view_layer.objects.active = grip
    grip.rotation_euler = (math.radians(GRIP_TILT_DEG), 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    bevel(grip, 0.006)

    trigger = new_box("Trigger", TRIGGER_SIZE, (0, -HOUSING_SIZE[1] * 0.35, HOUSING_SIZE[2] * 0.42))

    return [grip, trigger]


def build_details():
    """Vent slit + control button called out on the reference photo."""
    vent = new_box("Vent", (0.05, 0.006, 0.045),
                    (0, HOUSING_SIZE[1] * 0.5 + 0.003, HOUSING_SIZE[2] * 0.25))

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=0.012, depth=0.01,
        location=(HOUSING_SIZE[0] * 0.35, HOUSING_SIZE[1] * 0.5 + 0.006, HOUSING_SIZE[2] * 0.7),
        rotation=(math.radians(90), 0, 0),
    )
    button = bpy.context.active_object
    button.name = "Button"

    return [vent, button]


# ----------------------------------------------------------------------
# Build + export
# ----------------------------------------------------------------------

def build_materials():
    # Cool gunmetal, close to the reference's near-black anodized body.
    mat_dark = make_material("Dark", base_color=(0.048, 0.052, 0.058), roughness=0.45, metallic=0.65)
    mat_brass = make_material("Brass", base_color=(0.62, 0.47, 0.19), roughness=0.3, metallic=0.9)

    # Emission does not survive the trip to Godot unchanged (see the
    # troll-melee-1 README) - a value that looks like a moderate glow in
    # Blender's viewport blows out to solid pale mint under the test
    # scene's filmic tonemap + bloom, especially over a surface this large.
    # A saturated, slightly darker base color plus a much lower emission
    # strength holds a toxic green instead of washing to near-white.
    mat_glow = make_material(
        "GreenGlow", base_color=(0.05, 0.62, 0.10), roughness=0.25, metallic=0.05,
        emission=(0.14, 0.95, 0.20), emission_strength=0.45, alpha=0.95,
    )
    mat_vent = make_material(
        "VentGlow", base_color=(0.08, 0.7, 0.12), roughness=0.4,
        emission=(0.2, 1.0, 0.22), emission_strength=0.4,
    )
    return mat_dark, mat_brass, mat_glow, mat_vent


def build_body(mat_dark, mat_brass, mat_glow, mat_vent):
    """Everything except the fuel cell: housing, barrel, tank, grip."""
    housing = build_housing()
    horn_collar, _ = build_horn_and_collar()
    socket = build_cell_socket()
    tank_hose = build_tank_and_hose()
    grip_trigger = build_grip_and_trigger()
    details = build_details()

    for o in housing + grip_trigger + socket:
        assign(o, mat_dark)
    for o in horn_collar:
        assign(o, mat_dark if o.name == "Horn" else mat_brass)
    for o in tank_hose:
        assign(o, mat_glow if o.name in ("TankStripe", "Hose", "HoseElbow") else mat_dark)
    assign(details[0], mat_vent)   # Vent
    assign(details[1], mat_dark)   # Button

    everything = housing + horn_collar + socket + tank_hose + grip_trigger + details
    apply_all_modifiers(everything)
    body = join_objects(everything, "GreenCandlesBody")
    apply_authoring_to_export_rotation(body)

    # Origin at the grip so it aims around the hand, matching the
    # RangedWeapon convention (position/rotation set on this node).
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    _smooth(body)
    return body


def build_cell(mat_glow):
    parts = build_fuel_cell()
    for o in parts:
        assign(o, mat_glow)
    apply_all_modifiers(parts)
    cell = join_objects(parts, "FuelCell")

    # Origin at the cell's own base (not its bounding-box centre) so
    # green_candles.gd can position/animate it by where it SITS, not by
    # its midpoint.
    bpy.context.scene.cursor.location = (0, 0, -CELL_HEIGHT * 0.5)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    _smooth(cell)
    return cell


def _smooth(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if hasattr(bpy.ops.object, "shade_smooth_by_angle"):
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    else:
        bpy.ops.object.shade_smooth()
        if hasattr(obj.data, "use_auto_smooth"):
            obj.data.use_auto_smooth = True
            obj.data.auto_smooth_angle = math.radians(35)


def export_one(obj, filename):
    here = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() \
        else bpy.path.abspath("//")
    out_dir = os.path.normpath(os.path.join(here, "..", "weapons", "green_candles"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, filename)

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,             # Godot expects +Y up
        export_apply=True,
        export_materials="EXPORT",
    )

    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print(f"[green_candles] exported -> {out_path}  (~{tris} triangles)")
    return out_path


def _debug_export_socket_only():
    """One-off: exports JUST the CellSocket so its exported-space position
    can be measured directly instead of hand-derived through the
    authoring-to-export rotation. Not called by the normal build - invoke
    manually when re-deriving CELL_SEATED_POS in green_candles.gd."""
    clear_scene()
    socket = build_cell_socket()[0]
    apply_authoring_to_export_rotation(socket)
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    export_one(socket, "_debug_socket.glb")


if __name__ == "__main__":
    clear_scene()
    mat_dark, mat_brass, mat_glow, mat_vent = build_materials()

    body = build_body(mat_dark, mat_brass, mat_glow, mat_vent)
    cell = build_cell(mat_glow)

    export_one(body, EXPORT_NAME)
    export_one(cell, EXPORT_CELL_NAME)
