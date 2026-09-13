"""
Troll Ops battlefield props — modeled headlessly in Blender, exported as
individually-named .glb files for the game's GLTFLoader.

Run with: blender --background --python build_props.blender.py
Re-export after editing this file, then copy out/*.glb over the .glb files
next to this script (battlefield-props.js loads them from there).

Each object is built at true world scale (Blender units == metres, matching
the game's Three.js world), centred at the origin with its base sitting on
z=0 (Blender Z-up; the exporter's +Y-up option handles the flip to Three's
Y-up so the model lands base-down on Three's y=0 without extra rotation).
"""
import bpy
import os
import math

OUT_DIR = os.path.join(os.path.dirname(bpy.data.filepath) or r"C:\Users\mayur\AppData\Local\Temp\blender-assets", "out")
os.makedirs(OUT_DIR, exist_ok=True)


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


def add_box(name, size, loc, mat, bevel=0.02):
    # primitive_cube_add(size=1) makes a unit cube (edge length 1, i.e. -0.5..0.5
    # per axis) — object scale IS the final edge length, not half of it.
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat)
    return obj


def add_cylinder(name, radius, depth, loc, mat, verts=16, bevel=0.015):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=verts, location=loc)
    obj = bpy.context.object
    obj.name = name
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat)
    return obj


def add_torus(name, major_r, minor_r, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major_r, minor_radius=minor_r, location=loc, major_segments=24, minor_segments=8)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = rot
    obj.data.materials.append(mat)
    return obj


def add_sphere(name, radius, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=12, ring_count=8)
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


def export_glb(obj, filename):
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


# ---------------------------------------------------------------- crateStack

def build_crate_stack():
    clear_scene()
    wood = make_material("CrateWood", (0.42, 0.31, 0.16), roughness=0.85)
    dark = make_material("CrateTrim", (0.16, 0.11, 0.06), roughness=0.7)

    objs = []
    z = 0.0
    sizes = [1.4, 1.22]
    for i, s in enumerate(sizes):
        h = s * 0.72
        crate = add_box(f"crate_{i}", (s, s, h), (0, 0, z + h / 2), wood, bevel=0.03)
        objs.append(crate)
        # corner trim battens
        for sx in (-1, 1):
            for sy in (-1, 1):
                batten = add_box(
                    f"batten_{i}_{sx}_{sy}",
                    (0.06, 0.06, h),
                    (sx * (s / 2 - 0.05), sy * (s / 2 - 0.05), z + h / 2),
                    dark, bevel=0.01,
                )
                objs.append(batten)
        # lid edge line
        lid = add_box(f"lid_{i}", (s + 0.03, s + 0.03, 0.04), (0, 0, z + h), dark, bevel=0.01)
        objs.append(lid)
        z += h

    root = join_all(objs, "crate_stack")
    export_glb(root, "crate-stack.glb")


# --------------------------------------------------------------------- barrel

def build_barrel():
    clear_scene()
    body = make_material("BarrelBody", (0.16, 0.42, 0.22), roughness=0.6, metallic=0.3)
    rim = make_material("BarrelRim", (0.1, 0.11, 0.1), roughness=0.4, metallic=0.6)
    band = make_material("BarrelBand", (0.35, 0.2, 0.12), roughness=0.5, metallic=0.2)

    r, h = 0.55, 1.15
    objs = []
    objs.append(add_cylinder("drum", r, h, (0, 0, h / 2), body, verts=20, bevel=0.02))
    objs.append(add_torus("rim_top", r * 0.96, 0.05, (0, 0, h), rim, rot=(0, 0, 0)))
    objs.append(add_torus("rim_bottom", r * 0.96, 0.05, (0, 0, 0.02), rim, rot=(0, 0, 0)))
    objs.append(add_cylinder("band", r * 1.03, 0.12, (0, 0, h * 0.52), band, verts=20, bevel=0.01))

    root = join_all(objs, "barrel")
    export_glb(root, "barrel.glb")


# ---------------------------------------------------------------- sandbagWall

def build_sandbag_wall():
    clear_scene()
    base_mat = make_material("SandbagBase", (0.6, 0.54, 0.36), roughness=0.95)
    bag_mat = make_material("SandbagBag", (0.54, 0.48, 0.31), roughness=0.98)

    w, h = 4.0, 1.0
    objs = []
    objs.append(add_box("base_fill", (w, 0.9, h), (0, 0, h / 2), base_mat, bevel=0.02))

    n = 6
    for i in range(n):
        off = (i - (n - 1) / 2) * (w / n)
        bag = add_sphere(f"bag_{i}", 0.42, (off, 0, h - 0.1), (1.15, 0.75, 0.6), bag_mat)
        objs.append(bag)
        bag2 = add_sphere(f"bag2_{i}", 0.4, (off + w / (n * 2), 0, h - 0.55), (1.1, 0.7, 0.55), bag_mat)
        objs.append(bag2)

    root = join_all(objs, "sandbag_wall")
    export_glb(root, "sandbag-wall.glb")


# -------------------------------------------------------------- chainBarricade

def build_chain_barricade():
    clear_scene()
    frame_mat = make_material("BarricadeFrame", (0.33, 0.36, 0.32), roughness=0.5, metallic=0.4)
    mesh_mat = make_material("BarricadeMesh", (0.6, 0.63, 0.64), roughness=0.35, metallic=0.6)
    mesh_mat.blend_method = "BLEND"
    bsdf = mesh_mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Alpha"].default_value = 0.55

    w, h = 2.4, 1.8
    objs = []
    for sx in (-1, 1):
        post = add_box(f"post_{sx}", (0.12, 0.12, h), (sx * (w / 2 - 0.06), 0, h / 2), frame_mat, bevel=0.01)
        objs.append(post)
    rail = add_box("rail", (w, 0.1, 0.1), (0, 0, h - 0.05), frame_mat, bevel=0.01)
    objs.append(rail)

    panel = add_box("panel", (w - 0.24, 0.03, h - 0.2), (0, 0, h / 2), mesh_mat, bevel=0)
    objs.append(panel)

    root = join_all(objs, "chain_barricade")
    export_glb(root, "chain-barricade.glb")


# ------------------------------------------------------------ shippingContainer

def build_shipping_container():
    clear_scene()
    body_mat = make_material("ContainerBody", (0.69, 0.25, 0.17), roughness=0.65)
    rib_mat = make_material("ContainerRib", (0.56, 0.18, 0.12), roughness=0.7)
    door_mat = make_material("ContainerDoor", (0.44, 0.14, 0.09), roughness=0.55)

    length, w, h = 6.0, 2.5, 2.6
    objs = []
    objs.append(add_box("shell", (length, w, h), (0, 0, h / 2), body_mat, bevel=0.03))

    rib_count = int(round(length / 0.5))
    for i in range(rib_count):
        off = (i - (rib_count - 1) / 2) * (length / rib_count)
        rib = add_box(f"rib_{i}", (0.06, w + 0.04, h - 0.1), (off, 0, h / 2), rib_mat, bevel=0.005)
        objs.append(rib)

    door = add_box("door", (0.08, w * 0.9, h * 0.92), (length / 2 - 0.05, 0.15, h / 2), door_mat, bevel=0.01)
    door.rotation_euler = (0, 0, 0.35)
    objs.append(door)

    root = join_all(objs, "shipping_container")
    export_glb(root, "shipping-container.glb")


build_crate_stack()
build_barrel()
build_sandbag_wall()
build_chain_barricade()
build_shipping_container()
print("ALL PROPS EXPORTED")
