"""
Troll Ops suburban houses — modeled headlessly in Blender for Cul-de-Grin,
same pipeline as build_props.blender.py: run with
    blender --background --python build_houses.blender.py
then copy out/*.glb (and out/*-bake.jpg) over the files next to this script.

Three footprints (small/medium/large) matching the three colour variants
already hardcoded in maps.js's `houses` array (hue 15 terracotta, hue 130
sage, hue 260 violet-grey). Each house is exported with its walls
UNCOLOURED (white vertex-adjacent material slot swapped at runtime isn't
supported by the simple GLTFLoader path this game uses) — so unlike the
battlefield props, colour is baked in per export: this script runs once
per palette and emits a colour-specific file. If a fourth colour is ever
needed, add a tuple to PALETTES and re-run.

Geometry: pitched gable roof (not a flat box — the old api.box() shells
had flat roofs, the #1 thing that read as "placeholder" next to a real
Nuketown house), a recessed door frame with a visible jamb reveal (the
wall's real 0.35m thickness now shows as a stepped-in surface at the
opening instead of a flush cut edge), four inset windows per side with a
matching sill/reveal, a distinct interior wall material so the inside
reads differently from the clapboard exterior, a small chimney, and a
porch overhang on the street-facing wall. The door gap itself is left
OPEN geometry (no door object spans it) so the game's own doorway-gap
logic in maps.js still controls where players can walk through — this
model is exterior dressing around that gap, not a replacement for the
collider. `maps.js`'s `ghostWalls()`/`ghostBox()` calls for these houses
must be kept in sync with `WALL_T`/`ATTIC_WALL_T`/`door_w` below by hand;
there's no shared source of truth between this file and maps.js.

Lightmap bake: each house also gets a combined diffuse-lighting + AO bake
into a second UV channel, exported as "<filename>-bake.jpg" beside the
.glb, picked up automatically at runtime by house-props.js's
loadBakeTexture/applyBakedLightMap (surface-textures.js) with no further
code changes needed. The bake's Cycles sun is deliberately set to match
Cul-de-Grin's own map.sun exactly (color 0xffc898, intensity 1.6, pos
[-35, 22, 30] — see maps.js's MAPS.culdegrin.sun) rather than a generic
overhead light, since these house models currently only appear on that
one map; if a house model is ever reused on a map with a different sun
angle, the baked-in shadow direction will be visibly wrong for that map
and either needs a second bake variant or a switch to AO-only baking.
"""
import bpy
import os
import math
import mathutils

OUT_DIR = os.path.join(os.path.dirname(bpy.data.filepath) or r"C:\Users\mayur\AppData\Local\Temp\blender-assets", "out")
os.makedirs(OUT_DIR, exist_ok=True)

# Matches maps.js's ghostWalls()/ghostBox() calls for the Cul-de-Grin houses
# exactly — change one, change the other, or collision drifts from the mesh
# again the way the old 0.7m guess did.
WALL_T = 0.35
ATTIC_WALL_T = 0.28
BAKE_RES = 1024

# Cul-de-Grin's sun (maps.js MAPS.culdegrin.sun) — see module docstring for
# why the bake is pinned to this one map's lighting.
SUN_COLOR = (1.0, 0.784, 0.596)   # 0xffc898
SUN_INTENSITY = 1.6
SUN_POS = (-35, 22, 30)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block_type in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for block in list(block_type):
            if block.users == 0:
                block_type.remove(block)


def make_material(name, color, roughness=0.85, metallic=0.0):
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
    obj.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat)
    return obj


def add_cylinder(name, radius, depth, loc, mat, verts=4, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=verts, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
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


def add_torus(name, major_r, minor_r, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major_r, minor_radius=minor_r, location=loc, major_segments=24, minor_segments=8)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = rot
    obj.data.materials.append(mat)
    return obj


def add_prism_roof(name, w, d, ridge_h, eave_h, loc, mat):
    """Gable roof: a triangular-prism mesh running along X, ridge along the
    house's long axis. Built from a custom mesh (8 verts) rather than a
    primitive since Blender has no gable-roof primitive."""
    hx, hy = w / 2, d / 2
    verts = [
        (-hx, -hy, 0), (hx, -hy, 0), (hx, hy, 0), (-hx, hy, 0),  # eave rectangle, z=0 local
        (-hx, 0, ridge_h - eave_h), (hx, 0, ridge_h - eave_h),    # ridge line
    ]
    faces = [
        (0, 1, 5, 4),   # -y slope
        (2, 3, 4, 5),   # +y slope
        (0, 4, 3),      # -x gable
        (1, 2, 5),      # +x gable
        (0, 3, 2, 1),   # underside
    ]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = (loc[0], loc[1], loc[2] + eave_h)
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


# door is always on +X (matches maps.js gap side "e"; the game rotates the
# whole model 180° via api's rot for "w"-door houses, same as other props).
# `interior_mat` is a second material for the wall boxes' inward-facing
# surface — a real interior lining plane set just inside each exterior wall
# box, thin enough to read as a distinct interior finish (not the outdoor
# clapboard) whenever the door/window gap or the attic's open dormer lets
# the camera see a wall from the inside, without needing per-face material
# assignment on the primitive box itself.
def build_ground_floor(objs, mats, w, d, wall_h, door_w):
    wall_mat, roof_mat, trim_mat, glass_mat, interior_mat = mats
    hx, hy = w / 2, d / 2
    wall_t = WALL_T
    liner_t = 0.03
    liner_inset = wall_t / 2 - liner_t / 2 - 0.01
    seg = (d - door_w) / 2
    objs.append(add_box("wall_-x", (wall_t, d, wall_h), (-hx, 0, wall_h / 2), wall_mat))
    objs.append(add_box("wall_+y", (w, wall_t, wall_h), (0, hy, wall_h / 2), wall_mat))
    objs.append(add_box("wall_-y", (w, wall_t, wall_h), (0, -hy, wall_h / 2), wall_mat))
    if seg > 0.1:
        objs.append(add_box("wall_+x_a", (wall_t, seg, wall_h), (hx, (door_w / 2 + seg / 2), wall_h / 2), wall_mat))
        objs.append(add_box("wall_+x_b", (wall_t, seg, wall_h), (hx, -(door_w / 2 + seg / 2), wall_h / 2), wall_mat))

    # interior liners — one thin box per wall, inset from the inward face,
    # same footprint minus the door gap so they don't seal the doorway
    objs.append(add_box("liner_-x", (liner_t, d - 0.1, wall_h - 0.1), (-hx + liner_inset, 0, wall_h / 2), interior_mat, bevel=0))
    objs.append(add_box("liner_+y", (w - 0.1, liner_t, wall_h - 0.1), (0, hy - liner_inset, wall_h / 2), interior_mat, bevel=0))
    objs.append(add_box("liner_-y", (w - 0.1, liner_t, wall_h - 0.1), (0, -hy + liner_inset, wall_h / 2), interior_mat, bevel=0))
    if seg > 0.1:
        objs.append(add_box("liner_+x_a", (liner_t, seg - 0.1, wall_h - 0.1), (hx - liner_inset, (door_w / 2 + seg / 2), wall_h / 2), interior_mat, bevel=0))
        objs.append(add_box("liner_+x_b", (liner_t, seg - 0.1, wall_h - 0.1), (hx - liner_inset, -(door_w / 2 + seg / 2), wall_h / 2), interior_mat, bevel=0))

    objs.append(add_box("door_lintel", (wall_t + 0.06, door_w + 0.3, 0.22), (hx, 0, wall_h - 0.6), trim_mat))
    # door jamb reveal — a trim strip along each vertical edge of the
    # opening spanning the wall's full 0.35m depth, so standing in the
    # doorway shows a real stepped-in reveal instead of the old flush cut
    # edge where the wall box's raw end-cap (unlit interior face) showed
    for sy in (-1, 1):
        objs.append(add_box(f"door_jamb_{sy}", (wall_t + 0.02, 0.06, wall_h - 0.22),
                             (hx, sy * (door_w / 2 + 0.03), (wall_h - 0.22) / 2), trim_mat, bevel=0.01))

    porch_depth = 1.6
    objs.append(add_box("porch_roof", (porch_depth, door_w + 1.4, 0.15), (hx + porch_depth / 2, 0, wall_h - 0.15), trim_mat))
    for sy in (-1, 1):
        objs.append(add_cylinder("porch_post", 0.09, wall_h - 0.3, (hx + porch_depth - 0.15, sy * (door_w / 2 + 0.5), (wall_h - 0.3) / 2), trim_mat, verts=8))

    # windows: glass pane recessed to the wall's midplane (a real reveal,
    # not flush against the outer face) plus a sill/reveal frame filling
    # the punched-through wall thickness around it, so the opening reads
    # as a hole through a solid wall rather than a decal on its surface
    win_w, win_h, win_y = 1.1, 1.0, wall_h * 0.55
    win_frame_t = wall_t - 0.03
    for wx in (-w / 4, w / 4):
        objs.append(add_box("window_ny", (win_w, 0.05, win_h), (wx, -hy, win_y), glass_mat, bevel=0))
        objs.append(add_box("window_ny_reveal", (win_w + 0.05, win_frame_t, win_h + 0.05), (wx, -hy, win_y), trim_mat, bevel=0))
        objs.append(add_box("window_py", (win_w, 0.05, win_h), (wx, hy, win_y), glass_mat, bevel=0))
        objs.append(add_box("window_py_reveal", (win_w + 0.05, win_frame_t, win_h + 0.05), (wx, hy, win_y), trim_mat, bevel=0))
    objs.append(add_box("window_nx", (0.05, win_w, win_h), (-hx, 0, win_y), glass_mat, bevel=0))
    objs.append(add_box("window_nx_reveal", (win_frame_t, win_w + 0.05, win_h + 0.05), (-hx, 0, win_y), trim_mat, bevel=0))
    for wx in (-w / 4, w / 4):
        for sy, name in ((-1, "ny"), (1, "py")):
            objs.append(add_box(f"win_trim_{name}_{wx}", (win_w + 0.14, 0.03, win_h + 0.14),
                                 (wx, sy * (hy + 0.05), win_y), trim_mat, bevel=0))
    return win_y


def setup_bake_scene():
    """Cycles + a sun matching Cul-de-Grin's runtime DirectionalLight exactly
    (see module docstring for why). One call, reused by every house bake so
    each render doesn't redeclare the render engine/sun from scratch."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    bpy.ops.object.light_add(type="SUN", location=SUN_POS)
    sun = bpy.context.object
    sun.name = "bake_sun"
    sun.data.energy = SUN_INTENSITY * 3  # Cycles sun strength reads differently than three.js intensity; tuned by eye against the game's dusk look
    sun.data.color = SUN_COLOR
    # aim the sun back at the origin so its direction (not just position) matches map.sun.pos
    direction = bpy.data.objects.new("bake_sun_target", None)
    bpy.context.collection.objects.link(direction)
    direction.location = (0, 0, 0)
    constraint = sun.constraints.new("TRACK_TO")
    constraint.target = direction
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.35, 0.4, 0.55, 1.0)  # flat dusk sky fill, not direct sun color, so bake ambient stays neutral
        bg.inputs["Strength"].default_value = 0.4
    return sun, direction


def bake_lighting(root, filename):
    """UV2-unwraps `root` (already a single joined mesh — join_all runs
    before this is called) and bakes lighting (direct + indirect, no base
    color — this is a lightMap multiply target, not a full render) plus AO
    into one combined image, exported next to the .glb as "<filename minus
    .glb>-bake.jpg". house-props.js's loadBakeTexture looks for exactly
    this name. No-op for a mesh with no materials, since there's nothing
    meaningful to bake onto it."""
    base = os.path.splitext(filename)[0]
    obj = root
    if obj.type != "MESH" or not obj.data.materials:
        return

    uv = obj.data.uv_layers.new(name="UVMap_bake")
    obj.data.uv_layers.active = uv
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.03)
    bpy.ops.object.mode_set(mode="OBJECT")

    img = bpy.data.images.new(f"{obj.name}_bake", width=BAKE_RES, height=BAKE_RES)
    for mat in obj.data.materials:
        if mat is None or not mat.use_nodes:
            continue
        nodes = mat.node_tree.nodes
        tex_node = nodes.new("ShaderNodeTexImage")
        tex_node.name = "BakeTarget"
        tex_node.image = img
        nodes.active = tex_node

    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, use_clear=True)
    ao_img = bpy.data.images.new(f"{obj.name}_ao", width=BAKE_RES, height=BAKE_RES)
    for mat in obj.data.materials:
        if mat is None or not mat.use_nodes:
            continue
        tex_node = mat.node_tree.nodes.get("BakeTarget")
        if tex_node:
            tex_node.image = ao_img
    bpy.ops.object.bake(type="AO", use_clear=True)

    # combine: multiply the AO pass into the lighting pass in Blender's own
    # compositor-free pixel API, so the exported jpg already carries both
    # without needing a runtime shader to blend two lightmaps
    px = list(img.pixels)
    ao_px = ao_img.pixels[:]
    for i in range(0, len(px), 4):
        px[i] *= ao_px[i]
        px[i + 1] *= ao_px[i + 1]
        px[i + 2] *= ao_px[i + 2]
    img.pixels = px
    img.filepath_raw = os.path.join(OUT_DIR, f"{base}-bake.jpg")
    img.file_format = "JPEG"
    img.save()
    bpy.data.images.remove(ao_img)

    for mat in obj.data.materials:
        if mat is None or not mat.use_nodes:
            continue
        tex_node = mat.node_tree.nodes.get("BakeTarget")
        if tex_node:
            mat.node_tree.nodes.remove(tex_node)
    bpy.data.images.remove(img)


def build_house(filename, w, d, wall_h, wall_color, roof_color, trim_color, door_w=3.0):
    clear_scene()
    setup_bake_scene()
    wall_mat = make_material("Wall", wall_color, roughness=0.9)
    roof_mat = make_material("Roof", roof_color, roughness=0.75)
    trim_mat = make_material("Trim", trim_color, roughness=0.6)
    glass_mat = make_material("Glass", (0.08, 0.1, 0.14), roughness=0.2, metallic=0.3)
    chimney_mat = make_material("Chimney", (0.45, 0.32, 0.28), roughness=0.95)
    interior_mat = make_material("WallInterior", tuple(min(1, c * 1.15 + 0.08) for c in wall_color), roughness=0.95)

    objs = []
    hx, hy = w / 2, d / 2
    build_ground_floor(objs, (wall_mat, roof_mat, trim_mat, glass_mat, interior_mat), w, d, wall_h, door_w)

    # pitched gable roof, ridge running along X (the long axis toward the door)
    roof_overhang = 0.6
    eave_h = 0.3
    ridge_h = wall_h + 1.6
    objs.append(add_prism_roof("roof", w + roof_overhang, d + roof_overhang, ridge_h, eave_h, (0, 0, wall_h - eave_h), roof_mat))

    # chimney, offset toward the back-left so silhouettes differ house to house less predictably
    objs.append(add_box("chimney", (0.5, 0.5, 1.4), (-hx * 0.4, hy * 0.5, ridge_h + 0.3), chimney_mat))

    root = join_all(objs, "house")
    bake_lighting(root, filename)
    export_glb(root, filename)


PALETTES = [
    # (filename, w, d, wall_h, wall_color, roof_color, trim_color)
    ("house-terracotta.glb", 12, 10, 3.2, (0.78, 0.60, 0.42), (0.48, 0.25, 0.20), (0.98, 0.95, 0.88)),
    ("house-sage.glb", 14, 12, 3.2, (0.56, 0.63, 0.54), (0.29, 0.35, 0.27), (0.9, 0.88, 0.8)),
    ("house-violet.glb", 11, 11, 3.2, (0.84, 0.79, 0.66), (0.35, 0.29, 0.42), (0.95, 0.92, 0.85)),
]

for filename, w, d, wall_h, wall_color, roof_color, trim_color in PALETTES:
    build_house(filename, w, d, wall_h, wall_color, roof_color, trim_color)


# ------------------------------------------------------------- attic variant

# Second-storey attic added on top of any palette's ground floor: a sniper
# perch reached by an interior stair the game builds separately
# (api.stairs() in maps.js — this model only supplies the visual attic box
# + dormer + taller roof; the actual floor collider and stair colliders
# are ghostBox/box calls in maps.js, same split as the ground floor's
# ghostWalls()+model pairing). `dormer_side` picks which long wall gets
# the window ("+y" or "-y"), so attic houses on opposite sides of the
# street don't all snipe in the same direction.
def build_house_attic(filename, w, d, wall_h, wall_color, roof_color, trim_color, door_w=3.0, dormer_side="+y"):
    clear_scene()
    setup_bake_scene()
    wall_mat = make_material("Wall", wall_color, roughness=0.9)
    roof_mat = make_material("Roof", roof_color, roughness=0.75)
    trim_mat = make_material("Trim", trim_color, roughness=0.6)
    glass_mat = make_material("Glass", (0.08, 0.1, 0.14), roughness=0.2, metallic=0.3)
    chimney_mat = make_material("Chimney", (0.45, 0.32, 0.28), roughness=0.95)
    interior_mat = make_material("WallInterior", tuple(min(1, c * 1.15 + 0.08) for c in wall_color), roughness=0.95)

    objs = []
    hx, hy = w / 2, d / 2
    build_ground_floor(objs, (wall_mat, roof_mat, trim_mat, glass_mat, interior_mat), w, d, wall_h, door_w)

    # attic storey — a smaller inset box sitting on the ground floor's
    # ceiling, walled in on all four sides so it reads as a real room, not
    # just a taller roof void. Thickness matches maps.js's ghostWalls() call
    # for the attic collider (ATTIC_WALL_T) exactly, same sync requirement
    # as the ground floor's WALL_T.
    attic_h = 2.2
    attic_w, attic_d = w - 2.0, d - 2.0
    ahx, ahy = attic_w / 2, attic_d / 2
    az = wall_h
    attic_wall_t = ATTIC_WALL_T
    dsign = 1 if dormer_side == "+y" else -1
    objs.append(add_box("attic_-x", (attic_wall_t, attic_d, attic_h), (-ahx, 0, az + attic_h / 2), wall_mat))
    objs.append(add_box("attic_+x", (attic_wall_t, attic_d, attic_h), (ahx, 0, az + attic_h / 2), wall_mat))
    # the wall opposite the dormer stays solid
    objs.append(add_box("attic_solid_y", (attic_w, attic_wall_t, attic_h), (0, -dsign * ahy, az + attic_h / 2), wall_mat))
    # dormer wall has the window gap
    dormer_w = 1.6
    dseg = (attic_w - dormer_w) / 2
    if dseg > 0.1:
        objs.append(add_box("attic_dormer_a", (dseg, attic_wall_t, attic_h), (-(dormer_w / 2 + dseg / 2), dsign * ahy, az + attic_h / 2), wall_mat))
        objs.append(add_box("attic_dormer_b", (dseg, attic_wall_t, attic_h), (dormer_w / 2 + dseg / 2, dsign * ahy, az + attic_h / 2), wall_mat))
    # dormer jamb reveal, same idea as the ground floor's door_jamb — a trim
    # strip on each vertical edge of the window gap spanning the attic
    # wall's full depth, so the sniper window reads as a hole through a
    # real wall instead of a flush cut edge
    for sx in (-1, 1):
        objs.append(add_box(f"dormer_jamb_{sx}", (0.06, attic_wall_t + 0.02, attic_h - 0.3),
                             (sx * (dormer_w / 2 + 0.03), dsign * ahy, az + (attic_h - 0.3) / 2), trim_mat, bevel=0.01))
    # dormer window glass + trim — this is the sniper window: player stands
    # in the attic and shoots out through it
    dormer_win_h = 1.1
    objs.append(add_box("dormer_glass", (dormer_w - 0.1, 0.04, dormer_win_h), (0, dsign * ahy, az + 1.1), glass_mat, bevel=0))
    objs.append(add_box("dormer_trim", (dormer_w + 0.1, 0.05, dormer_win_h + 0.16), (0, dsign * (ahy + 0.03), az + 1.1), trim_mat, bevel=0))
    # small gabled hood over the dormer, poking out through the main roof
    objs.append(add_prism_roof("dormer_roof", dormer_w + 0.5, 1.0, 0.7, 0.1, (0, dsign * (ahy - 0.3), az + attic_h - 0.1), roof_mat))

    # attic interior liner (opposite/side walls only — the dormer wall keeps
    # its jamb reveal doing that job at the opening) so the perch's inside
    # reads as a distinct interior finish, matching the ground floor's liners
    liner_t = 0.03
    liner_inset = attic_wall_t / 2 - liner_t / 2 - 0.01
    objs.append(add_box("attic_liner_-x", (liner_t, attic_d - 0.1, attic_h - 0.1), (-ahx + liner_inset, 0, az + attic_h / 2), interior_mat, bevel=0))
    objs.append(add_box("attic_liner_+x", (liner_t, attic_d - 0.1, attic_h - 0.1), (ahx - liner_inset, 0, az + attic_h / 2), interior_mat, bevel=0))
    objs.append(add_box("attic_liner_solid_y", (attic_w - 0.1, liner_t, attic_h - 0.1), (0, -dsign * (ahy - liner_inset), az + attic_h / 2), interior_mat, bevel=0))

    # attic floor deck (visual only — the real floor collider is a box in
    # maps.js; this is just so the attic doesn't look hollow from outside
    # through the door gap when the ground floor's ceiling is skipped)
    objs.append(add_box("attic_floor", (attic_w, attic_d, 0.15), (0, 0, az - 0.02), trim_mat, bevel=0))

    # taller pitched roof to clear the attic box, ridge still along X
    roof_overhang = 0.6
    eave_h = 0.3
    ridge_h = az + attic_h + 1.4
    objs.append(add_prism_roof("roof", w + roof_overhang, d + roof_overhang, ridge_h, eave_h, (0, 0, az + attic_h - eave_h), roof_mat))
    objs.append(add_box("chimney", (0.5, 0.5, 1.4), (-hx * 0.4, hy * 0.5, ridge_h + 0.3), chimney_mat))

    root = join_all(objs, "house_attic")
    bake_lighting(root, filename)
    export_glb(root, filename)


ATTIC_VARIANTS = [
    # (filename, w, d, wall_h, wall_color, roof_color, trim_color, dormer_side)
    ("house-sage-attic.glb", 14, 12, 3.2, (0.56, 0.63, 0.54), (0.29, 0.35, 0.27), (0.9, 0.88, 0.8), "+y"),
    ("house-terracotta-attic.glb", 12, 10, 3.2, (0.78, 0.60, 0.42), (0.48, 0.25, 0.20), (0.98, 0.95, 0.88), "-y"),
    ("house-violet-attic.glb", 11, 11, 3.2, (0.84, 0.79, 0.66), (0.35, 0.29, 0.42), (0.95, 0.92, 0.85), "+y"),
]
for filename, w, d, wall_h, wall_color, roof_color, trim_color, dormer_side in ATTIC_VARIANTS:
    build_house_attic(filename, w, d, wall_h, wall_color, roof_color, trim_color, dormer_side=dormer_side)


# --------------------------------------------------------------- portrait frame

# Real 3D picture frame (beveled wooden edge + recessed canvas), replacing
# the flat plane house-props.js used to hang directly on the wall. The
# canvas face is its own material slot ("Canvas") left plain white here —
# house-props.js swaps that slot's material for a MeshStandardMaterial
# using the existing per-house canvas-texture grin art at runtime, so the
# painted joke art is unchanged, it's just mounted in real geometry now
# instead of a bare plane.
def build_portrait_frame():
    clear_scene()
    frame_mat = make_material("Frame", (0.32, 0.22, 0.14), roughness=0.55, metallic=0.1)
    canvas_mat = make_material("Canvas", (1.0, 1.0, 1.0), roughness=0.9)
    canvas_mat.name = "Canvas"

    w, h, depth = 0.9, 1.1, 0.06
    frame_t = 0.07
    objs = []

    # outer frame: four beveled bars forming a border, canvas sits recessed
    # in the middle on its own plane so the game can swap just that face
    objs.append(add_box("frame_top", (w, frame_t, frame_t), (0, 0, h / 2 - frame_t / 2), frame_mat, bevel=0.015))
    objs.append(add_box("frame_bottom", (w, frame_t, frame_t), (0, 0, -h / 2 + frame_t / 2), frame_mat, bevel=0.015))
    objs.append(add_box("frame_left", (frame_t, frame_t, h - frame_t * 2), (-w / 2 + frame_t / 2, 0, 0), frame_mat, bevel=0.015))
    objs.append(add_box("frame_right", (frame_t, frame_t, h - frame_t * 2), (w / 2 - frame_t / 2, 0, 0), frame_mat, bevel=0.015))
    # backing depth so the frame reads as a real object from the side, not paper-thin
    objs.append(add_box("frame_back", (w, depth, h), (0, -depth / 2 + 0.005, 0), frame_mat, bevel=0.01))

    frame_root = join_all(objs, "portrait_frame")

    # canvas plane, separate object (own UVs, own material) recessed slightly
    # in front of the backing so house-props.js can find and re-texture it
    # by name after the GLTFLoader parses this file
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -depth + 0.01, 0))
    canvas = bpy.context.object
    canvas.name = "Canvas"
    canvas.rotation_euler = (1.5707963, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    canvas.scale = (w - frame_t * 1.6, h - frame_t * 1.6, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    canvas.data.materials.append(canvas_mat)

    export_glb_multi([frame_root, canvas], "portrait-frame.glb")


def export_glb_multi(objs, filename):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        use_selection=True,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
    )
    print("Exported", path)


build_portrait_frame()


# ------------------------------------------------------------- yard clutter

# Small Nuketown-style yard props — the kind of specific, slightly-funny
# detail that makes a suburb map feel inhabited instead of just six empty
# shells on a street. All decorative (house-props.js drops them in with
# api.prop(), no collider) except the trash can, which gets a small
# ghostBox since it's tall enough to actually block a bullet at ankle height.

def build_toy_car():
    clear_scene()
    body_mat = make_material("ToyBody", (0.85, 0.15, 0.12), roughness=0.4, metallic=0.1)
    wheel_mat = make_material("ToyWheel", (0.08, 0.08, 0.09), roughness=0.7)
    window_mat = make_material("ToyWindow", (0.6, 0.8, 0.9), roughness=0.2, metallic=0.3)

    objs = []
    objs.append(add_box("body", (0.5, 0.24, 0.16), (0, 0, 0.13), body_mat, bevel=0.02))
    objs.append(add_box("cabin", (0.26, 0.22, 0.12), (0.02, 0, 0.24), body_mat, bevel=0.02))
    objs.append(add_box("windshield", (0.24, 0.2, 0.09), (0.02, 0, 0.235), window_mat, bevel=0.01))
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(add_cylinder("wheel", 0.08, 0.05, (sx * 0.16, sy * 0.135, 0.08), wheel_mat, verts=14, rot=(1.5707963, 0, 0)))

    root = join_all(objs, "toy_car")
    export_glb(root, "toy-car.glb")


def build_garden_gnome():
    clear_scene()
    body_mat = make_material("GnomeBody", (0.16, 0.42, 0.7), roughness=0.7)
    skin_mat = make_material("GnomeSkin", (0.9, 0.7, 0.55), roughness=0.8)
    hat_mat = make_material("GnomeHat", (0.75, 0.14, 0.14), roughness=0.75)
    beard_mat = make_material("GnomeBeard", (0.92, 0.9, 0.85), roughness=0.9)

    objs = []
    objs.append(add_cylinder("body", 0.13, 0.32, (0, 0, 0.16), body_mat, verts=10))
    objs.append(add_sphere("head", 0.11, (0, 0, 0.36), (1, 1, 1), skin_mat))
    objs.append(add_sphere("beard", 0.1, (0, 0.04, 0.3), (1, 0.7, 0.9), beard_mat))
    bpy.ops.mesh.primitive_cone_add(radius1=0.11, depth=0.28, location=(0, 0, 0.52))
    hat = bpy.context.object
    hat.name = "hat"
    hat.data.materials.append(hat_mat)
    objs.append(hat)

    root = join_all(objs, "garden_gnome")
    export_glb(root, "garden-gnome.glb")


def build_trash_can():
    clear_scene()
    can_mat = make_material("CanBody", (0.28, 0.3, 0.32), roughness=0.6, metallic=0.4)
    lid_mat = make_material("CanLid", (0.2, 0.22, 0.24), roughness=0.55, metallic=0.4)

    objs = []
    objs.append(add_cylinder("can", 0.28, 0.75, (0, 0, 0.375), can_mat, verts=16))
    objs.append(add_cylinder("lid", 0.3, 0.06, (0, 0, 0.78), lid_mat, verts=16))

    root = join_all(objs, "trash_can")
    export_glb(root, "trash-can.glb")


def add_strut(name, radius, a, b, mat, verts=8):
    """A cylinder running from point a to point b — for angled struts where
    working out the Euler rotation by hand (as the first cut at this A-frame
    did) is exactly how the legs ended up floating apart from the top bar
    instead of meeting it. Blender's `track_axis` API does the pointing."""
    ax, ay, az = a
    bx, by, bz = b
    mid = ((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
    length = math.sqrt((bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2)
    obj = add_cylinder(name, radius, length, mid, mat, verts=verts)
    direction = mathutils.Vector((bx - ax, by - ay, bz - az))
    obj.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return obj


def build_tire_swing():
    """A-frame swing set with the tire hung from its own top bar, not a
    tire-and-two-rope-stubs floating with nothing above them (the original
    build — the ropes had no frame to run to, which is why in-game it read
    as broken rather than as a swing)."""
    clear_scene()
    tire_mat = make_material("TireRubber", (0.05, 0.05, 0.05), roughness=0.85)
    rope_mat = make_material("SwingRope", (0.55, 0.45, 0.28), roughness=0.9)
    frame_mat = make_material("SwingFrame", (0.35, 0.32, 0.28), roughness=0.55, metallic=0.3)

    TOP_H = 2.3           # top-bar height off the ground
    TIRE_H = 0.75         # tire hangs low enough for a running kid, not an adult
    LEG_SPREAD = 0.9      # how far each leg's foot splays out from the apex
    BAR_HALF = 0.65       # half-length of the top bar each A-frame apex sits at

    objs = []
    # Two A-frames facing each other along y, each a pair of legs crossing
    # from a foot on the ground up to its own end of the top bar — the
    # classic swing-set silhouette, not a single pole (which would rack
    # sideways under any real load).
    for sy in (-1, 1):
        apex = (0, sy * BAR_HALF, TOP_H)
        for sx in (-1, 1):
            foot = (sx * LEG_SPREAD, sy * BAR_HALF, 0)
            objs.append(add_strut(f"leg_{sy}_{sx}", 0.045, foot, apex, frame_mat))

    # Top bar runs along y, connecting the two A-frames at their apex.
    objs.append(add_cylinder("top_bar", 0.05, BAR_HALF * 2, (0, 0, TOP_H), frame_mat, verts=8, rot=(1.5707963, 0, 0)))

    objs.append(add_torus("tire", 0.32, 0.11, (0, 0, TIRE_H), tire_mat, rot=(1.5707963, 0, 0)))
    for sx in (-1, 1):
        objs.append(add_strut(f"rope_{sx}", 0.015, (sx * 0.2, 0, TIRE_H), (0, 0, TOP_H), rope_mat, verts=6))

    root = join_all(objs, "tire_swing")
    export_glb(root, "tire-swing.glb")


def build_streetlamp():
    clear_scene()
    pole_mat = make_material("LampPole", (0.14, 0.15, 0.14), roughness=0.5, metallic=0.5)
    head_mat = make_material("LampHead", (0.1, 0.1, 0.1), roughness=0.4, metallic=0.6)
    glass_mat = make_material("LampGlass", (1.0, 0.92, 0.75), roughness=0.3)

    objs = []
    objs.append(add_cylinder("base", 0.16, 0.15, (0, 0, 0.075), pole_mat, verts=10))
    objs.append(add_cylinder("pole", 0.07, 5.6, (0, 0, 2.9), pole_mat, verts=10))
    # curved arm approximated with two short cylinders meeting at an angle
    objs.append(add_cylinder("arm_a", 0.05, 0.7, (0.15, 0, 5.55), pole_mat, verts=8, rot=(0, 1.1, 0)))
    objs.append(add_box("head_housing", (0.55, 0.3, 0.22), (0.55, 0, 5.75), head_mat, bevel=0.02))
    objs.append(add_box("head_glass", (0.4, 0.2, 0.05), (0.55, 0, 5.63), glass_mat, bevel=0))

    root = join_all(objs, "streetlamp")
    export_glb(root, "streetlamp.glb")


build_toy_car()
build_garden_gnome()
build_trash_can()
build_tire_swing()
build_streetlamp()

print("ALL HOUSES EXPORTED")
