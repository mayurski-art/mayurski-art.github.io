"""
Troll Ops scorestreak aircraft — the Hunter-Killer drone and the helicopter
gunship, modeled headlessly in Blender and exported as .glb for the game's
GLTFLoader.

Run with: blender --background --python build_streaks.blender.py
Then copy out/*.glb over the .glb files next to this script.

Same conventions as build_props.blender.py: Blender units == metres matching
the Three.js world, and the exporter's +Y-up option handles the flip to
Three's Y-up.

ONE IMPORTANT DIFFERENCE from the static props. These fly, and their rotors
spin, so the rotors CANNOT be joined into the body mesh the way every prop in
build_props.blender.py is. Each spinning part is exported as its own named
node, parented to the hull, so scorestreaks.js can find it by name with
scene.traverse() and turn it every frame. The names below are contract:
changing them breaks the spin.

Also unlike the props, these are centred on their own hull rather than sitting
base-on-z=0 — they are positioned in the air by the game, and a rotor that
orbits an origin down at the landing gear looks wrong.
"""
import bpy
import os
import math

OUT_DIR = os.path.join(os.path.dirname(bpy.data.filepath) or r"C:\Users\mayur\AppData\Local\Temp\blender-assets", "out")
os.makedirs(OUT_DIR, exist_ok=True)

# Node names the game looks for. Keep in sync with scorestreaks.js.
MAIN_ROTOR = "MainRotor"
TAIL_ROTOR = "TailRotor"
DRONE_ROTOR = "DroneRotor"      # prefix; four of them get _0.._3


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block_type in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for block in list(block_type):
            if block.users == 0:
                block_type.remove(block)


def make_material(name, color, roughness=0.8, metallic=0.0):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def add_box(name, size, loc, mat, bevel=0.02, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = rot
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat)
    return obj


def add_cylinder(name, radius, depth, loc, mat, verts=16, bevel=0.015, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=verts, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = rot
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat)
    return obj


def add_sphere(name, radius, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=16, ring_count=10)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def join_all(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name
    return joined


def set_origin(obj, location):
    """Move an object's origin to a world point without moving its geometry —
    a rotor has to turn about its own hub, not the hull's centre."""
    bpy.context.scene.cursor.location = location
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.context.scene.cursor.location = (0, 0, 0)


def export_hierarchy(root, filename):
    """Exports the root and everything parented to it, keeping child nodes as
    separate named nodes (no join), so the game can animate them."""
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = os.path.join(OUT_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        use_selection=True,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
    )
    print("Exported", path)


# ------------------------------------------------------- hunter-killer drone

def build_drone():
    """Small quadcopter, ~0.8m across. Reads as a thrown piece of hardware
    rather than an aircraft — it exists for about four seconds."""
    clear_scene()
    shell = make_material("DroneShell", (0.13, 0.14, 0.13), roughness=0.45, metallic=0.5)
    trim = make_material("DroneTrim", (0.55, 0.13, 0.1), roughness=0.5, metallic=0.3)
    blade_mat = make_material("DroneBlade", (0.08, 0.09, 0.08), roughness=0.35, metallic=0.4)
    lens = make_material("DroneLens", (0.75, 0.2, 0.16), roughness=0.15, metallic=0.1)

    arm_len = 0.30
    body_parts = []
    # Flattened hull.
    body_parts.append(add_box("hull", (0.26, 0.26, 0.09), (0, 0, 0), shell, bevel=0.02))
    # A nose so it visibly points at what it is chasing. The dark collar
    # between hull and lens keeps the two red parts from merging into one blob.
    body_parts.append(add_box("nose", (0.11, 0.14, 0.07), (0, 0.17, 0), trim, bevel=0.015))
    body_parts.append(add_cylinder("collar", 0.05, 0.03, (0, 0.245, 0), shell, verts=12,
                                   rot=(math.radians(90), 0, 0)))
    body_parts.append(add_sphere("eye", 0.04, (0, 0.275, 0), (1, 0.8, 1), lens))
    # Warhead slung underneath — this thing is a flying grenade.
    body_parts.append(add_cylinder("charge", 0.06, 0.16, (0, 0.02, -0.075), trim, verts=12,
                                   rot=(math.radians(90), 0, 0)))

    hubs = []
    for i, (sx, sy) in enumerate([(-1, -1), (1, -1), (-1, 1), (1, 1)]):
        ax, ay = sx * arm_len * 0.72, sy * arm_len * 0.72
        body_parts.append(add_box(f"arm_{i}", (0.05, 0.05, 0.035),
                                  (ax * 0.6, ay * 0.6, 0), shell, bevel=0.008,
                                  rot=(0, 0, math.radians(45 if sx * sy > 0 else -45))))
        # Motor can, part of the hull.
        body_parts.append(add_cylinder(f"motor_{i}", 0.035, 0.05, (ax, ay, 0.03), shell, verts=10, bevel=0.005))
        hubs.append((i, ax, ay))

    hull = join_all(body_parts, "drone_hull")

    # Rotors stay separate, one node each, origin at their own motor.
    for i, ax, ay in hubs:
        blades = []
        for b in range(2):
            blades.append(add_box(f"blade_{i}_{b}", (0.20, 0.022, 0.006),
                                  (ax, ay, 0.062), blade_mat, bevel=0.002,
                                  rot=(0, 0, math.radians(b * 90))))
        rotor = join_all(blades, f"{DRONE_ROTOR}_{i}")
        set_origin(rotor, (ax, ay, 0.062))
        rotor.parent = hull
        rotor.matrix_parent_inverse = hull.matrix_world.inverted()

    export_hierarchy(hull, "hunter-drone.glb")


# --------------------------------------------------------- helicopter gunship

def build_helicopter():
    """Attack helicopter, ~8m nose to tail. Big enough to read clearly from
    the ground at patrol altitude, which is the whole point of the reward."""
    clear_scene()
    body_mat = make_material("HeliBody", (0.16, 0.19, 0.16), roughness=0.6, metallic=0.25)
    dark = make_material("HeliDark", (0.09, 0.1, 0.09), roughness=0.5, metallic=0.45)
    glass = make_material("HeliGlass", (0.1, 0.16, 0.18), roughness=0.12, metallic=0.1)
    accent = make_material("HeliAccent", (0.45, 0.12, 0.1), roughness=0.55, metallic=0.2)
    blade_mat = make_material("HeliBlade", (0.07, 0.08, 0.07), roughness=0.4, metallic=0.35)

    parts = []
    # Fuselage: narrower than it is tall, like a real gunship — a wide slab
    # reads as a brick from the ground, which is where it will be seen from.
    parts.append(add_box("fuse_mid", (1.15, 3.1, 1.2), (0, 0.1, 0), body_mat, bevel=0.12))
    parts.append(add_box("fuse_nose", (0.95, 1.6, 0.85), (0, 2.05, -0.16), body_mat, bevel=0.14))
    parts.append(add_sphere("nose_cap", 0.48, (0, 2.8, -0.2), (1.0, 1.3, 0.82), body_mat))
    # Stepped-down canopy, sitting in front of the mast rather than under it.
    parts.append(add_box("canopy_front", (0.82, 0.95, 0.52), (0, 2.15, 0.36), glass, bevel=0.05))
    parts.append(add_box("canopy_rear", (0.9, 0.9, 0.6), (0, 1.3, 0.5), glass, bevel=0.05))
    # Tail boom, tapering, with a proper fin.
    parts.append(add_box("boom", (0.38, 2.1, 0.4), (0, -2.25, 0.22), body_mat, bevel=0.05))
    parts.append(add_box("boom_aft", (0.3, 1.3, 0.34), (0, -3.55, 0.3), body_mat, bevel=0.04))
    parts.append(add_box("fin", (0.12, 0.55, 1.5), (0, -4.15, 0.95), body_mat, bevel=0.05))
    parts.append(add_box("stab", (2.0, 0.45, 0.1), (0, -3.5, 0.22), body_mat, bevel=0.03))
    # Stub wings with rocket pods, so it reads as armed.
    for sx in (-1, 1):
        parts.append(add_box(f"wing_{sx}", (1.05, 0.7, 0.13), (sx * 1.0, 0.3, 0.05), body_mat, bevel=0.03))
        parts.append(add_cylinder(f"pod_{sx}", 0.2, 1.1, (sx * 1.5, 0.3, -0.12), accent,
                                  verts=12, rot=(math.radians(90), 0, 0)))
    # Chin turret, hung clearly BELOW the nose so the gun is visible.
    parts.append(add_sphere("turret", 0.3, (0, 2.3, -0.78), (1, 1, 0.85), dark))
    parts.append(add_cylinder("gun_l", 0.055, 1.15, (-0.08, 2.9, -0.8), dark, verts=8,
                              rot=(math.radians(90), 0, 0)))
    parts.append(add_cylinder("gun_r", 0.055, 1.15, (0.08, 2.9, -0.8), dark, verts=8,
                              rot=(math.radians(90), 0, 0)))
    # Rotor mast: tall enough that the disc clears the canopy.
    parts.append(add_cylinder("mast_base", 0.28, 0.34, (0, 0.35, 0.72), body_mat, verts=12))
    parts.append(add_cylinder("mast", 0.13, 0.62, (0, 0.35, 1.12), dark, verts=10))
    parts.append(add_sphere("rotor_head", 0.2, (0, 0.35, 1.44), (1, 1, 0.7), dark))
    # Tail rotor pylon and hub, offset to one side like the real thing.
    parts.append(add_cylinder("tail_hub", 0.11, 0.26, (0.22, -4.15, 0.95), dark, verts=10,
                              rot=(0, math.radians(90), 0)))
    # Skids, clearly proud of the belly.
    for sx in (-1, 1):
        parts.append(add_cylinder(f"skid_{sx}", 0.065, 2.9, (sx * 0.92, 0.3, -1.12), dark,
                                  verts=8, rot=(math.radians(90), 0, 0)))
        for fy in (1.0, -0.55):
            parts.append(add_box(f"strut_{sx}_{fy}", (0.085, 0.085, 0.55),
                                 (sx * 0.92, 0.3 + fy, -0.82), dark, bevel=0.01))

    hull = join_all(parts, "helicopter_hull")

    # --- main rotor: four blades evenly around the disc (90° apart, not 45°,
    # or all four bunch into a half-disc), own node, origin at the mast head.
    main_z = 1.46
    blades = []
    for b in range(4):
        blades.append(add_box(f"mblade_{b}", (0.34, 7.6, 0.055), (0, 0.35, main_z), blade_mat,
                              bevel=0.01))
    for b, blade in enumerate(blades):
        set_origin(blade, (0, 0.35, main_z))
        blade.rotation_euler = (0, 0, math.radians(b * 90))
    main = join_all(blades, MAIN_ROTOR)
    set_origin(main, (0, 0.35, main_z))
    main.parent = hull
    main.matrix_parent_inverse = hull.matrix_world.inverted()

    # --- tail rotor: spins about X (the boom axis is Y, so the disc faces
    # sideways), three blades, own node.
    tail_pos = (0.3, -4.15, 0.95)
    tblades = []
    for b in range(3):
        tblades.append(add_box(f"tblade_{b}", (0.06, 1.5, 0.2), tail_pos, blade_mat, bevel=0.006))
    for b, blade in enumerate(tblades):
        set_origin(blade, tail_pos)
        blade.rotation_euler = (math.radians(b * 60), 0, 0)
    tail = join_all(tblades, TAIL_ROTOR)
    set_origin(tail, tail_pos)
    tail.parent = hull
    tail.matrix_parent_inverse = hull.matrix_world.inverted()

    export_hierarchy(hull, "helicopter.glb")


# ------------------------------------------------------------- care package

def build_care_package():
    """Air-dropped supply crate, ~1.1m. Distinct from crate-stack.glb so a
    package is never mistaken for scenery you can't pick up."""
    clear_scene()
    case = make_material("PkgCase", (0.2, 0.23, 0.2), roughness=0.7, metallic=0.2)
    strap = make_material("PkgStrap", (0.55, 0.42, 0.12), roughness=0.85)
    light = make_material("PkgLight", (0.35, 0.85, 0.4), roughness=0.2, metallic=0.0)

    s = 1.1
    objs = []
    objs.append(add_box("case", (s, s, s * 0.8), (0, 0, s * 0.4), case, bevel=0.05))
    # Hazard straps banding the crate BOTH ways, so it reads as strapped from
    # any angle — running them one way left two faces blank.
    for sx in (-1, 1):
        objs.append(add_box(f"strap_x_{sx}", (0.13, s + 0.05, s * 0.84),
                            (sx * s * 0.27, 0, s * 0.4), strap, bevel=0.01))
        objs.append(add_box(f"strap_y_{sx}", (s + 0.05, 0.13, s * 0.84),
                            (0, sx * s * 0.27, s * 0.4), strap, bevel=0.01))
    objs.append(add_box("lid", (s + 0.05, s + 0.05, 0.07), (0, 0, s * 0.8), case, bevel=0.02))
    # Beacon, so it's findable across a map.
    objs.append(add_cylinder("beacon", 0.08, 0.12, (0, 0, s * 0.86), light, verts=10))
    # Corner feet.
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(add_box(f"foot_{sx}_{sy}", (0.13, 0.13, 0.1),
                                (sx * s * 0.4, sy * s * 0.4, 0.05), strap, bevel=0.01))

    root = join_all(objs, "care_package")
    export_glb_single(root, "care-package.glb")


def export_glb_single(obj, filename):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    path = os.path.join(OUT_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        use_selection=True,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
    )
    print("Exported", path)


build_drone()
build_helicopter()
build_care_package()
print("ALL STREAK MODELS EXPORTED")
