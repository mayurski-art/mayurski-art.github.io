# Trollface Operator - procedural rigged character generator
#
# HOW TO RUN
#   1. Open Blender (free: https://www.blender.org/download/)
#   2. Switch to the "Scripting" tab at the top
#   3. Click "Open" and pick this file (or "New" and paste it in)
#   4. Press "Run Script" (the play arrow)
#   5. A .glb lands next to this script, in ../character/
#
# This is the "Trollge" stick-figure look, not a sculpted humanoid: thin
# dark limbs meeting at a point, simple flat mitten hands and feet, and a
# HEAD THAT IS THE REAL 2D TROLLFACE ARTWORK - a lightly-extruded sign-
# board carrying ../../../images/wallpaper/trollface transparent.png as
# its texture, not a modeled face. That PNG is the same flat classic
# trollface used across the site (the mascot rule in CLAUDE.md: always
# the real artwork, never the emoji, never a from-scratch sculpt).
#
# One rig serves every Troll Ops surface: the Godot melee/ranged
# prototypes, the first-person viewmodel arms, and the in-browser locker
# viewer. Units are metres, +Y up on export (Godot's convention). Overall
# height ~1.8m so it drops into the same collision capsules the FPS
# controllers already use.

import bpy
import bmesh
import math
import os
from mathutils import Vector

# ----------------------------------------------------------------------
# Tunables - change these, re-run, iterate on the silhouette
# ----------------------------------------------------------------------

HEIGHT        = 1.8     # crown to feet

HEAD_WIDTH    = 0.58     # the trollface board's width (its long axis)
HEAD_HEIGHT   = 0.54
HEAD_THICK    = 0.045    # "minimal 3D" - a sign, not a sculpted skull
NECK_LEN      = 0.05     # limbs meet almost directly under the head

LIMB_RADIUS   = 0.028    # thin stick limbs, the whole point of the look
HAND_RADIUS   = 0.075    # flat mitten disc
FOOT_LENGTH   = 0.16
FOOT_RADIUS   = 0.035

ARM_OUT       = 0.55     # how far a resting hand sits out to the side
ARM_DROP      = 0.62     # how far a resting arm hangs below the shoulder hub
LEG_SPREAD    = 0.30     # ankle distance out from the centreline, standing
LEG_DROP      = None     # computed below to reach the ground exactly

# Reference pose (see the two Fortnite-style screenshots this was modeled
# from): body leaning slightly forward, one arm raised in a wave, legs
# mid-stride. That pose lives in Godot/runtime as bone rotations - this
# script only builds the REST pose (T-ish stick figure, arms down,
# standing straight) so it can be posed however each game needs.

EXPORT_NAME   = "trollface_operator.glb"
TEXTURE_REL   = os.path.join("..", "..", "..", "..", "images", "wallpaper",
                              "trollface transparent.png")


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------

def clear_scene():
    """Wipe everything so re-running is idempotent."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects,
                  bpy.data.armatures, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def make_material(name, base_color, roughness=0.6, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def make_textured_material(name, image_path):
    """Unlit-ish material driving Base Color from the trollface PNG, alpha
    blended so the transparent background actually cuts the silhouette."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.blend_method = "CLIP"
    if hasattr(mat, "shadow_method"):
        mat.shadow_method = "CLIP"
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.55

    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.location = (-300, 300)
    img = bpy.data.images.load(image_path, check_existing=True)
    tex.image = img

    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    return mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def stick_limb(name, p_from, p_to, radius):
    """A thin capsule-ish cylinder running between two points - the
    'stick' in stick figure. Built as a cylinder with two capping spheres
    so joints don't show a visible seam."""
    p_from = Vector(p_from)
    p_to = Vector(p_to)
    mid = (p_from + p_to) * 0.5
    length = (p_to - p_from).length

    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, depth=length, vertices=8, location=mid,
    )
    limb = bpy.context.active_object
    limb.name = name

    direction = (p_to - p_from).normalized()
    z = Vector((0, 0, 1))
    if direction != z and direction != -z:
        axis = z.cross(direction).normalized()
        angle = z.angle(direction)
        limb.rotation_mode = "AXIS_ANGLE"
        limb.rotation_axis_angle = (angle, axis.x, axis.y, axis.z)
    elif direction == -z:
        limb.rotation_euler = (math.pi, 0, 0)

    bpy.context.view_layer.objects.active = limb
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    for end in (p_from, p_to):
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=radius, segments=8, ring_count=6, location=end,
        )
        cap = bpy.context.active_object
        bpy.ops.object.select_all(action="DESELECT")
        cap.select_set(True)
        limb.select_set(True)
        bpy.context.view_layer.objects.active = limb
        bpy.ops.object.join()

    return limb


def flat_disc(name, radius, thickness, location):
    """A short, fat cylinder standing in for a mitten hand / stub foot."""
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, depth=thickness, vertices=10, location=location,
    )
    obj = bpy.context.active_object
    obj.name = name
    return obj


def head_board(name, width, height, thickness, image_path):
    """The trollface head: a rounded-rect slab, thin along Y (forward),
    with the real trollface PNG mapped onto both the front and back faces
    via simple planar UVs. 'Minimal 3D' means the whole head is basically
    a sign board with a bevel, not a modeled face - the art does all the
    expressive work, same as it does everywhere else on the site."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (width, thickness, height)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # UV every face by orthographic projection down Y BEFORE bevelling -
    # a plain box has exactly 6 faces so this is unambiguous, and doing it
    # first means the bevel's new edge-loop faces just inherit sensible
    # coordinates from their neighbours instead of needing their own
    # projection. (uv.project_from_view needs a 3D viewport, which does
    # not exist in --background mode, so this maps UVs by hand instead.)
    me = obj.data
    me.uv_layers.new(name="UVMap")
    uv = me.uv_layers.active.data
    half_w, half_h = width * 0.5, height * 0.5
    for poly in me.polygons:
        for li in poly.loop_indices:
            vidx = me.loops[li].vertex_index
            co = me.vertices[vidx].co
            # Front/back faces (normal along Y) show the full portrait;
            # the thin edge faces just get a sliver from the same image,
            # which is visually harmless at HEAD_THICK's scale.
            u = (co.x + half_w) / width
            v = (co.z + half_h) / height
            uv[li].uv = (u, v)

    # Round the vertical edges slightly so the board reads as a friendly
    # rounded shape (matching the artwork's own rounded outline) rather
    # than a hard rectangle.
    mod = obj.modifiers.new(name="Bevel", type="BEVEL")
    mod.width = min(width, height) * 0.06
    mod.segments = 3
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(30)
    bpy.ops.object.modifier_apply(modifier="Bevel")

    mat = make_textured_material(f"{name}_Mat", image_path)
    assign(obj, mat)
    return obj


# ----------------------------------------------------------------------
# Body + armature
# ----------------------------------------------------------------------

def build_body(mat_limb, mat_hand, texture_path):
    """Rest pose: standing straight, arms down at the sides - a plain
    stick figure. Positions are absolute world Z (feet at 0)."""
    global LEG_DROP
    neck_z = HEIGHT - NECK_LEN - HEAD_HEIGHT * 0.5
    shoulder_z = neck_z
    hip_z = neck_z - 0.02
    LEG_DROP = hip_z  # legs run from the hip down to the ground (z=0)

    parts = {}

    # Head: the flat trollface board, sitting just above the neck point,
    # facing forward (-Y).
    head_z = HEIGHT - HEAD_HEIGHT * 0.5
    head = head_board("Head", HEAD_WIDTH, HEAD_HEIGHT, HEAD_THICK, texture_path)
    head.location = (0, 0, head_z)
    parts["head"] = [head]

    # Neck: a short stub connecting the head to where the limbs meet -
    # the reference art has the face sitting almost directly on the limb
    # junction, so this is deliberately tiny.
    neck = stick_limb("Neck", (0, 0, head_z - HEAD_HEIGHT * 0.5),
                      (0, 0, neck_z), LIMB_RADIUS * 1.3)
    assign(neck, mat_limb)
    parts["neck"] = [neck]

    # Arms: hang from the same junction point as the neck/legs (the
    # reference has no torso mass at all - everything meets at one hub
    # just under the chin).
    def mk_arm(side, tag):
        shoulder = (side * 0.02, 0, shoulder_z)
        wrist = (side * ARM_OUT, 0, shoulder_z - ARM_DROP)
        limb = stick_limb(f"Arm_{tag}", shoulder, wrist, LIMB_RADIUS)
        assign(limb, mat_limb)
        hand = flat_disc(f"Hand_{tag}", HAND_RADIUS, HAND_RADIUS * 0.5, wrist)
        hand.rotation_euler = (math.pi / 2, 0, 0)
        assign(hand, mat_hand)
        return [limb, hand]

    parts["arm_l"] = mk_arm(-1, "L")
    parts["arm_r"] = mk_arm(1, "R")

    # Legs: from the hub down to the ground, splayed slightly for a
    # standing stance.
    def mk_leg(side, tag):
        hip = (side * 0.02, 0, hip_z)
        ankle = (side * LEG_SPREAD, 0, FOOT_RADIUS)
        limb = stick_limb(f"Leg_{tag}", hip, ankle, LIMB_RADIUS)
        assign(limb, mat_limb)
        foot = flat_disc(f"Foot_{tag}", FOOT_RADIUS, FOOT_LENGTH,
                         (ankle[0], FOOT_LENGTH * 0.15, ankle[2] - FOOT_RADIUS * 0.4))
        foot.rotation_euler = (math.pi / 2, 0, 0)
        assign(foot, mat_hand)
        return [limb, foot]

    parts["leg_l"] = mk_leg(-1, "L")
    parts["leg_r"] = mk_leg(1, "R")

    return parts, neck_z, hip_z, shoulder_z


def build_armature(neck_z, hip_z, shoulder_z):
    """One bone per moving part: Hub (root), Head, two arm chains (single
    bone each - the stick figure has no elbow), two leg chains (single
    bone each - no knee). Named to line up with the `parts` keys above so
    an exporter/animator can map poses straight onto bone rotations."""
    bpy.ops.object.armature_add(location=(0, 0, 0))
    arm_obj = bpy.context.active_object
    arm_obj.name = "TrollfaceRig"
    armature = arm_obj.data
    armature.name = "TrollfaceSkeleton"

    bpy.ops.object.mode_set(mode="EDIT")
    eb = armature.edit_bones
    eb.remove(eb["Bone"])

    def add_bone(name, head, tail, parent=None):
        b = eb.new(name)
        b.head = head
        b.tail = tail
        if parent:
            b.parent = eb[parent]
            b.use_connect = False
        return b

    add_bone("Hub", (0, 0, hip_z), (0, 0, neck_z))
    add_bone("Head", (0, 0, neck_z), (0, 0, neck_z + HEAD_HEIGHT), "Hub")

    for side, tag in ((-1, "L"), (1, "R")):
        shoulder = (side * 0.02, 0, shoulder_z)
        wrist = (side * ARM_OUT, 0, shoulder_z - ARM_DROP)
        add_bone(f"Arm_{tag}", shoulder, wrist, "Hub")

    for side, tag in ((-1, "L"), (1, "R")):
        hip = (side * 0.02, 0, hip_z)
        ankle = (side * LEG_SPREAD, 0, FOOT_RADIUS)
        add_bone(f"Leg_{tag}", hip, ankle, "Hub")

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def parent_and_weight(arm_obj, mesh_objs, bone_name):
    """Join a group's meshes into one object, rigid-bind fully to one
    bone. No smooth blending at joints - the stick-figure look wants
    crisp, rigid segments, not organic deformation.

    The mesh object is named "Mesh_<bone>", NOT "<bone>" - naming it the
    same as its bone causes Blender's glTF exporter to disambiguate one of
    them by appending "_2" (Godot then imports a bone literally called
    "Arm_L_2" instead of "Arm_L"), which silently breaks any importer-side
    code that looks bones up by the name used here.
    """
    if len(mesh_objs) > 1:
        bpy.ops.object.select_all(action="DESELECT")
        for o in mesh_objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = mesh_objs[0]
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active if len(mesh_objs) > 1 else mesh_objs[0]
    obj.name = f"Mesh_{bone_name}"

    vg = obj.vertex_groups.new(name=bone_name)
    vg.add(range(len(obj.data.vertices)), 1.0, "REPLACE")

    obj.parent = arm_obj
    mod = obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj
    return obj


# ----------------------------------------------------------------------
# Assemble
# ----------------------------------------------------------------------

def build():
    clear_scene()

    here = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() \
        else bpy.path.abspath("//")
    texture_path = os.path.normpath(os.path.join(here, TEXTURE_REL))
    if not os.path.exists(texture_path):
        raise FileNotFoundError(
            f"Trollface texture not found at {texture_path} - the head "
            "board needs the real artwork, not a placeholder."
        )

    mat_limb = make_material("Trollface_Limb", (0.02, 0.02, 0.025), roughness=0.7)
    mat_hand = make_material("Trollface_Hand", (0.94, 0.94, 0.95), roughness=0.6)

    parts, neck_z, hip_z, shoulder_z = build_body(mat_limb, mat_hand, texture_path)
    arm_obj = build_armature(neck_z, hip_z, shoulder_z)

    parent_and_weight(arm_obj, parts["head"] + parts["neck"], "Head")
    parent_and_weight(arm_obj, parts["arm_l"], "Arm_L")
    parent_and_weight(arm_obj, parts["arm_r"], "Arm_R")
    parent_and_weight(arm_obj, parts["leg_l"], "Leg_L")
    parent_and_weight(arm_obj, parts["leg_r"], "Leg_R")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.shade_smooth()

    return arm_obj


def export(arm_obj):
    here = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() \
        else bpy.path.abspath("//")
    out_dir = os.path.normpath(os.path.join(here, "..", "character"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, EXPORT_NAME)

    bpy.ops.object.select_all(action="SELECT")

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,   # keep armature modifiers live for skinning
        export_materials="EXPORT",
        export_skins=True,
        export_animations=False,
        export_image_format="AUTO",
    )

    tri_total = 0
    for obj in bpy.context.selected_objects:
        if obj.type == "MESH":
            tri_total += sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print(f"[trollface_operator] exported -> {out_path}")
    print(f"[trollface_operator] ~{tri_total} triangles")
    return out_path


if __name__ == "__main__":
    rig = build()
    export(rig)
