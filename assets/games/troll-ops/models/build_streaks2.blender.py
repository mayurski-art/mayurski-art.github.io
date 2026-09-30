"""
Troll Forces scorestreaks, second batch: the K9 Unit's dog and the VTOL
Warship. (The Swarm flies the Hunter-Killer drone from build_streaks.blender.py.)

    blender --background --python build_streaks2.blender.py

Writes k9-dog.glb and vtol-warship.glb next to this script.

Conventions as build_streaks.blender.py: metres, Blender +Y is the nose
(three.js -Z after the exporter's Y-up flip), and every part the game
animates is its own named node. The names are contract with
streak-entities.js / k9-unit.js:

  k9-dog.glb        K9_Dog (root, origin on the ground under the body)
                      K9_Head > K9_Jaw, K9_Tail,
                      K9_LegFL > K9_LegFL_Lo (and FR, BL, BR)
                    legs swing about their own X axis
  vtol-warship.glb  VTOL_Hull > VTOL_Nacelle_L/R (tilt about X)
                                  > VTOL_Rotor_L/R (spin about the nacelle's up)
"""
import bpy
import bmesh
import math
import os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, rough=0.7, metal=0.0, emit=None, strength=0.0, vcol=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1.0)
        b.inputs["Emission Strength"].default_value = strength
    if vcol:
        n = nt.nodes.new("ShaderNodeVertexColor")
        n.layer_name = "Col"
        nt.links.new(n.outputs["Color"], b.inputs["Base Color"])
    return m


def hexc(h):
    return (((h >> 16) & 255) / 255.0, ((h >> 8) & 255) / 255.0, (h & 255) / 255.0)


def lin(c):
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def active():
    return bpy.context.view_layer.objects.active


def select_only(*objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def apply_scale(o):
    select_only(o)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def sphere(name, r, loc, scale=(1, 1, 1), mat=None, seg=24, rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=rings)
    o = active()
    o.name = name
    o.scale = scale
    apply_scale(o)
    if mat:
        o.data.materials.append(mat)
    return o


def box(name, size, loc, mat=None, bevel=0.0, segs=3, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = active()
    o.name = name
    o.scale = size
    o.rotation_euler = rot
    apply_scale(o)
    if bevel:
        mod = o.modifiers.new("b", "BEVEL")
        mod.width = bevel
        mod.segments = segs
        mod.limit_method = "NONE"
        select_only(o)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if mat:
        o.data.materials.append(mat)
    return o


def cyl(name, r, depth, loc, mat=None, verts=20, rot=(0, 0, 0), r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, vertices=verts, location=loc, rotation=rot)
    o = active()
    o.name = name
    if mat:
        o.data.materials.append(mat)
    return o


def limb(name, a, b, r1, r2, mat=None, verts=14):
    """A tapered round limb from point a to point b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=d.length, vertices=verts, location=(a + b) / 2)
    o = active()
    o.name = name
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    apply_scale(o)
    if mat:
        o.data.materials.append(mat)
    return o


def join(objs, name):
    select_only(*objs)
    bpy.ops.object.join()
    o = active()
    o.name = name
    return o


def smooth_organic(o, voxel, target_tris):
    """Voxel-remesh a blob of overlapping primitives into one smooth skin,
    then decimate it back down to a game budget."""
    select_only(o)
    r = o.modifiers.new("remesh", "REMESH")
    r.mode = "VOXEL"
    r.voxel_size = voxel
    r.adaptivity = 0.0
    bpy.ops.object.modifier_apply(modifier=r.name)
    s = o.modifiers.new("smooth", "SMOOTH")
    s.factor = 0.8
    s.iterations = 6
    bpy.ops.object.modifier_apply(modifier=s.name)
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris > target_tris:
        d = o.modifiers.new("dec", "DECIMATE")
        d.ratio = target_tris / tris
        bpy.ops.object.modifier_apply(modifier=d.name)
    bpy.ops.object.shade_smooth()


def paint(o, fn):
    """Per-corner vertex colours from a function of the world position."""
    me = o.data
    if "Col" not in me.color_attributes:
        me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    col = me.color_attributes["Col"]
    mw = o.matrix_world
    for poly in me.polygons:
        for li in poly.loop_indices:
            p = mw @ me.vertices[me.loops[li].vertex_index].co
            c = lin(fn(p))
            col.data[li].color = (*c, 1.0)


def shell(src, keep, offset, name, mat):
    """A skin-tight layer over part of another mesh (a vest over the torso):
    copy it, keep the faces `keep(world pos)` accepts, and push it out."""
    o = src.copy()
    o.data = src.data.copy()
    o.name = name
    bpy.context.collection.objects.link(o)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    mw = o.matrix_world
    drop = [f for f in bm.faces if not keep(mw @ f.calc_center_median())]
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    # The cut runs along triangle edges and comes out ragged: relax the
    # open border so it reads as a sewn hem.
    for _ in range(8):
        moves = {}
        for v in bm.verts:
            if not v.is_boundary:
                continue
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2:
                moves[v] = (nb[0].co + nb[1].co) / 2
        for v, c in moves.items():
            v.co = v.co.lerp(c, 0.6)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * offset
    bm.to_mesh(o.data)
    bm.free()
    o.data.materials.clear()
    o.data.materials.append(mat)
    select_only(o)
    sol = o.modifiers.new("sol", "SOLIDIFY")
    sol.thickness = 0.008
    sol.offset = 1.0
    bpy.ops.object.modifier_apply(modifier=sol.name)
    bpy.ops.object.shade_smooth()
    return o


def set_origin(o, at):
    bpy.context.scene.cursor.location = at
    select_only(o)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.context.scene.cursor.location = (0, 0, 0)


def parent(child, par):
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()


def export(root, filename):
    select_only(root, *root.children_recursive)
    path = os.path.join(HERE, filename)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB",
                              export_yup=True, export_apply=True)
    tris = 0
    for o in [root, *root.children_recursive]:
        if o.type == "MESH":
            tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    print("Exported", path, "tris", tris)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def ss(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ===================================================================== K9 dog
# A German shepherd, BO2's K9: tan with the black saddle and muzzle, in a
# black tactical vest. About 0.62 m at the shoulder.

TAN = hexc(0xb07a3e)
TAN_LIGHT = hexc(0xd2a468)
CREAM = hexc(0xe0c08e)
SADDLE = hexc(0x1b1510)
MUZZLE = hexc(0x16110d)


def build_dog():
    clear_scene()
    fur = material("K9_Fur", TAN, rough=0.85, vcol=True)
    vest = material("K9_Vest", hexc(0x23262a), rough=0.75, metal=0.05)
    strap = material("K9_Strap", hexc(0x3c4146), rough=0.6, metal=0.3)
    nose_m = material("K9_Nose", hexc(0x0c0b0b), rough=0.3)
    eye_m = material("K9_Eye", hexc(0x2a1606), rough=0.15)
    mouth_m = material("K9_Mouth", hexc(0x2a0e0e), rough=0.5)
    tongue_m = material("K9_Tongue", hexc(0xc85a64), rough=0.45)
    tooth_m = material("K9_Tooth", hexc(0xf1ede2), rough=0.35)
    light_m = material("K9_Light", hexc(0xff2a1a), rough=0.3, emit=hexc(0xff2a1a), strength=6.0)

    # --- torso: chest, ribs, loin, rump and the neck, as one smooth skin.
    parts = [
        sphere("chest", 0.2, (0, 0.24, 0.47), (0.8, 1.05, 1.08)),
        sphere("ribs", 0.19, (0, 0.04, 0.47), (0.8, 1.15, 0.95)),
        sphere("loin", 0.15, (0, -0.16, 0.49), (0.78, 1.1, 0.85)),
        sphere("rump", 0.155, (0, -0.3, 0.49), (0.9, 0.95, 0.95)),
        sphere("neck", 0.115, (0, 0.4, 0.61), (0.82, 1.2, 1.15)),
        sphere("neck2", 0.1, (0, 0.46, 0.68), (0.8, 1.0, 1.0)),
        sphere("shoulderL", 0.08, (0.085, 0.24, 0.42), (0.7, 1.3, 1.5)),
        sphere("shoulderR", 0.08, (-0.085, 0.24, 0.42), (0.7, 1.3, 1.5)),
        sphere("thighL", 0.09, (0.09, -0.3, 0.42), (0.7, 1.35, 1.35)),
        sphere("thighR", 0.09, (-0.09, -0.3, 0.42), (0.7, 1.35, 1.35)),
    ]
    torso = join(parts, "K9_Dog")
    smooth_organic(torso, 0.012, 2200)
    torso.data.materials.clear()
    torso.data.materials.append(fur)

    def torso_col(p):
        c = TAN
        # the black saddle over the back, running up the neck
        top = 0.5 + 0.03 * math.cos(p.y * 9.0)
        saddle = ss(top - 0.03, top + 0.03, p.z) * (1 - ss(0.3, 0.42, p.y)) * (1 - ss(0.36, 0.44, -p.y))
        c = mix(c, SADDLE, saddle)
        c = mix(c, CREAM, ss(0.4, 0.33, p.z))           # pale belly
        c = mix(c, TAN_LIGHT, ss(0.52, 0.6, p.y) * (1 - saddle))  # throat
        return c
    paint(torso, torso_col)

    # --- head, pivoting at the top of the neck.
    head_parts = [
        sphere("skull", 0.1, (0, 0.53, 0.75), (0.95, 1.05, 0.88)),
        sphere("cheeks", 0.08, (0, 0.585, 0.715), (1.08, 0.9, 0.78)),
        sphere("snout", 0.066, (0, 0.665, 0.713), (0.72, 1.55, 0.66)),
        sphere("brow", 0.05, (0, 0.585, 0.785), (1.2, 0.9, 0.5)),
    ]
    head = join(head_parts, "K9_Head")
    smooth_organic(head, 0.007, 1100)
    head.data.materials.clear()
    head.data.materials.append(fur)

    def head_col(p):
        c = TAN
        c = mix(c, MUZZLE, ss(0.6, 0.66, p.y))                     # black muzzle
        c = mix(c, SADDLE, ss(0.79, 0.84, p.z) * 0.55)             # darker crown
        c = mix(c, TAN_LIGHT, ss(0.72, 0.68, p.z) * (1 - ss(0.6, 0.66, p.y)))  # pale cheeks
        return c
    paint(head, head_col)

    nose = sphere("nose", 0.024, (0, 0.765, 0.724), (1.1, 0.9, 0.8), nose_m, seg=16, rings=10)
    eyes = [sphere(f"eye{s}", 0.0135, (s * 0.047, 0.612, 0.77), (1, 0.8, 1), eye_m, seg=12, rings=8) for s in (1, -1)]
    ears = []
    for s in (1, -1):
        e = cyl(f"ear{s}", 0.042, 0.13, (s * 0.058, 0.51, 0.855), fur, verts=4, r2=0.004,
                rot=(math.radians(-8), math.radians(s * 16), math.radians(45)))
        apply_scale(e)
        ear_in = cyl(f"earin{s}", 0.028, 0.1, (s * 0.058, 0.518, 0.848), mouth_m, verts=4, r2=0.003,
                     rot=(math.radians(-8), math.radians(s * 16), math.radians(45)))
        apply_scale(ear_in)
        paint(e, lambda p: mix(TAN, SADDLE, ss(0.85, 0.9, p.z)))
        ears += [e, ear_in]
    for o in [nose, *eyes, *ears]:
        paint(o, lambda p: (1, 1, 1)) if o.data.materials[0] != fur else None
    upper_teeth = []
    for s in (1, -1):
        upper_teeth.append(cyl(f"fang{s}", 0.007, 0.03, (s * 0.022, 0.72, 0.672), tooth_m, verts=6, r2=0.001,
                               rot=(math.radians(180), 0, 0)))
    for o in upper_teeth:
        paint(o, lambda p: (1, 1, 1))
    head = join([head, nose, *eyes, *ears, *upper_teeth], "K9_Head")
    set_origin(head, (0, 0.44, 0.66))

    # --- jaw, hinged under the ear: opens for the bite.
    jaw = sphere("jaw", 0.05, (0, 0.655, 0.667), (0.68, 1.5, 0.42), mouth_m, seg=18, rings=10)
    jaw_fur = sphere("jawfur", 0.046, (0, 0.645, 0.656), (0.74, 1.45, 0.38), fur, seg=18, rings=10)
    paint(jaw_fur, lambda p: MUZZLE)
    tongue = sphere("tongue", 0.03, (0, 0.66, 0.678), (0.8, 1.6, 0.25), tongue_m, seg=14, rings=8)
    teeth = [cyl(f"lfang{s}", 0.006, 0.024, (s * 0.02, 0.71, 0.685), tooth_m, verts=6, r2=0.001) for s in (1, -1)]
    for o in (jaw, tongue, *teeth):
        paint(o, lambda p: (1, 1, 1))
    jaw = join([jaw, jaw_fur, tongue, *teeth], "K9_Jaw")
    set_origin(jaw, (0, 0.57, 0.69))

    # --- tail: a low, bushy shepherd tail.
    tail_parts = [
        limb("t0", (0, -0.4, 0.55), (0, -0.52, 0.45), 0.042, 0.038),
        limb("t1", (0, -0.52, 0.45), (0, -0.58, 0.32), 0.038, 0.03),
        limb("t2", (0, -0.58, 0.32), (0, -0.56, 0.21), 0.03, 0.01),
    ]
    tail = join(tail_parts, "K9_Tail")
    smooth_organic(tail, 0.01, 260)
    tail.data.materials.clear()
    tail.data.materials.append(fur)
    paint(tail, lambda p: mix(SADDLE, TAN, ss(0.5, 0.3, p.z) * 0.6))
    set_origin(tail, (0, -0.39, 0.55))

    # --- legs: upper and lower for each, the lower hinged at the elbow/stifle.
    legs = {}
    for key, x, y0 in (("FL", 0.085, 0.25), ("FR", -0.085, 0.25), ("BL", 0.09, -0.29), ("BR", -0.09, -0.29)):
        front = key[0] == "F"
        if front:
            hip, knee, paw = (x, y0, 0.44), (x, y0 - 0.02, 0.24), (x, y0 + 0.01, 0.04)
            up = join([limb("u", hip, knee, 0.064, 0.045), sphere("k", 0.045, knee, seg=12, rings=8)], "u")
            lo = join([sphere("kl", 0.042, knee, seg=12, rings=8), limb("l", knee, paw, 0.04, 0.032),
                       limb("p", paw, (x, y0 + 0.02, 0.03), 0.032, 0.03)], "lo")
        else:
            hip, knee, hock, paw = (x, y0, 0.46), (x, y0 + 0.07, 0.27), (x, y0 - 0.06, 0.14), (x, y0 - 0.04, 0.04)
            up = join([limb("u", hip, knee, 0.082, 0.05), sphere("k", 0.05, knee, seg=12, rings=8)], "u")
            lo = join([sphere("kl", 0.047, knee, seg=12, rings=8), limb("l", knee, hock, 0.046, 0.033),
                       sphere("h", 0.034, hock, seg=12, rings=8), limb("m", hock, paw, 0.033, 0.03)], "lo")
        pawb = sphere("paw", 0.034, (paw[0], paw[1] + 0.02, 0.028), (0.95, 1.35, 0.7), seg=14, rings=8)
        lo = join([lo, pawb], "lo")
        for o in (up, lo):
            smooth_organic(o, 0.008, 240)
            o.data.materials.clear()
            o.data.materials.append(fur)
        paint(up, lambda p: mix(SADDLE, TAN, ss(0.42, 0.32, p.z)) if not front else TAN)
        paint(lo, lambda p: mix(TAN_LIGHT, TAN, ss(0.05, 0.15, p.z)))
        up.name = f"K9_Leg{key}"
        lo.name = f"K9_Leg{key}_Lo"
        set_origin(up, hip)
        set_origin(lo, knee)
        legs[key] = (up, lo)

    # --- the vest: a padded jacket over the chest and ribs, with a grab
    # handle on top and a red beacon.
    # Fitted over the torso: from behind the shoulders back to the loin,
    # down to just above the belly line.
    vest_o = shell(torso, lambda p: -0.14 < p.y < 0.3 and p.z > 0.4 - 0.12 * max(0.0, p.y - 0.12), 0.012, "vest", vest)
    straps = [shell(torso, (lambda y0: lambda p: abs(p.y - y0) < 0.016)(y0), 0.022, f"strap{i}", strap)
              for i, y0 in enumerate((-0.1, 0.27))]
    handle = box("handle", (0.03, 0.16, 0.035), (0, 0.06, 0.69), strap, bevel=0.012)
    handle_posts = [box(f"hpost{i}", (0.03, 0.025, 0.05), (0, y, 0.665), strap, bevel=0.008) for i, y in enumerate((-0.01, 0.13))]
    pouches = [box(f"pouch{s}", (0.05, 0.12, 0.09), (s * 0.17, 0.06, 0.47), strap, bevel=0.018) for s in (1, -1)]
    beacon = sphere("beacon", 0.018, (0, 0.21, 0.705), (1, 1, 0.8), light_m, seg=12, rings=8)
    collar = cyl("collar", 0.085, 0.035, (0, 0.44, 0.63), strap, verts=20, rot=(math.radians(60), 0, 0))
    vest_all = join([vest_o, handle, *handle_posts, *straps, *pouches, beacon, collar], "K9_Vest")
    for o in (vest_all,):
        paint(o, lambda p: (1, 1, 1))

    root = torso
    set_origin(root, (0, 0, 0))
    parent(vest_all, root)
    parent(head, root)
    parent(jaw, head)
    parent(tail, root)
    for up, lo in legs.values():
        parent(up, root)
        parent(lo, up)
    export(root, "k9-dog.glb")


# ============================================================== VTOL warship
# A heavy tilt-rotor gunship. Guns on the port side (BO2's VTOL circles the
# map port-side-in, like an AC-130), and the rotors on tilting nacelles.

def build_warship():
    clear_scene()
    hull_m = material("VT_Hull", hexc(0x3a4046), rough=0.55, metal=0.35)
    dark = material("VT_Dark", hexc(0x1d2024), rough=0.5, metal=0.5)
    panel = material("VT_Panel", hexc(0x2c3136), rough=0.6, metal=0.3)
    glass = material("VT_Glass", hexc(0x16242c), rough=0.08, metal=0.2)
    gun = material("VT_Gun", hexc(0x121416), rough=0.35, metal=0.85)
    blade = material("VT_Blade", hexc(0x1a1c1e), rough=0.45, metal=0.3)
    stripe = material("VT_Stripe", hexc(0xd8dcd6), rough=0.5, metal=0.1)
    red = material("VT_Red", hexc(0xff2a1a), rough=0.3, emit=hexc(0xff2a1a), strength=8)
    green = material("VT_Green", hexc(0x2aff5a), rough=0.3, emit=hexc(0x2aff5a), strength=8)
    white = material("VT_White", hexc(0xffffff), rough=0.3, emit=hexc(0xffffff), strength=6)

    p = []
    # Fuselage: a long rounded body, a bulbous nose and a tapering tail.
    p.append(box("fuse", (2.7, 8.6, 2.7), (0, 0.4, 0), hull_m, bevel=1.0, segs=6))
    p.append(sphere("nose", 1.32, (0, 4.75, -0.12), (1.0, 1.75, 0.95), hull_m, seg=32, rings=18))
    p.append(sphere("canopy", 0.98, (0, 5.05, 0.5), (0.98, 1.45, 0.66), glass, seg=32, rings=16))
    p.append(cyl("tailcone", 1.25, 5.8, (0, -6.3, 0.35), hull_m, verts=28, r2=0.42, rot=(math.radians(90), 0, 0)))
    p.append(sphere("tailcap", 0.42, (0, -9.2, 0.35), (1, 0.7, 1), hull_m, seg=18, rings=10))
    # A pale band round the waist and a tail stripe, so it reads from the ground.
    p.append(box("band", (2.78, 0.35, 2.78), (0, 2.7, 0), stripe, bevel=1.0, segs=6))
    # Sponsons for the gear, and the belly.
    for s in (1, -1):
        p.append(box(f"sponson{s}", (0.8, 4.2, 1.1), (s * 1.35, 0.3, -0.95), panel, bevel=0.35, segs=4))
    # H tail: a stabiliser and twin fins.
    p.append(box("stab", (6.6, 1.4, 0.18), (0, -8.6, 0.75), hull_m, bevel=0.07))
    for s in (1, -1):
        p.append(box(f"fin{s}", (0.2, 1.6, 2.6), (s * 3.2, -8.75, 1.55), hull_m, bevel=0.08, rot=(math.radians(-12), 0, 0)))
        p.append(box(f"finstripe{s}", (0.22, 0.5, 0.9), (s * 3.2, -8.9, 2.25), stripe, bevel=0.03, rot=(math.radians(-12), 0, 0)))
    # High wing with a fairing over the fuselage.
    p.append(box("wing", (15.4, 2.3, 0.34), (0, 0.8, 1.55), hull_m, bevel=0.14, segs=3))
    p.append(box("wingroot", (2.2, 3.0, 0.7), (0, 0.8, 1.3), hull_m, bevel=0.3, segs=4))
    # Chin sensor ball.
    p.append(sphere("sensor", 0.4, (0, 4.2, -1.22), (1, 1, 1), dark, seg=20, rings=12))
    p.append(cyl("lens", 0.16, 0.12, (0, 4.55, -1.26), glass, verts=16, rot=(math.radians(90), 0, 0)))
    # Port-side gun deck: the 105 mm cannon and the 25 mm chain gun, both
    # pointing out and down to the left.
    p.append(box("gundeck", (0.6, 3.4, 1.0), (-1.4, 0.4, -0.4), panel, bevel=0.2))
    tilt = (0, math.radians(-90 + 25), 0)   # along -X, dipped 25 deg
    p.append(cyl("cannon", 0.19, 2.6, (-2.3, 1.2, -0.72), gun, verts=18, rot=tilt))
    p.append(cyl("cannonbrake", 0.26, 0.4, (-3.45, 1.2, -1.26), gun, verts=18, rot=tilt))
    for i in range(3):
        a = i * 2 * math.pi / 3
        p.append(cyl(f"chain{i}", 0.05, 2.0, (-2.1, -0.4 + 0.1 * math.cos(a), -0.6 + 0.1 * math.sin(a)), gun, verts=10, rot=tilt))
    p.append(cyl("chainhub", 0.17, 0.4, (-1.55, -0.4, -0.35), gun, verts=14, rot=tilt))
    # Window strip along the cabin.
    for i in range(5):
        for s in (1, -1):
            p.append(box(f"win{i}{s}", (0.08, 0.42, 0.32), (s * 1.34, 3.0 - i * 1.0, 0.45), glass, bevel=0.05))
    # Nav lights: red port, green starboard, white tail.
    p.append(sphere("navL", 0.1, (-7.7, 0.8, 1.55), (1, 1, 1), red, seg=10, rings=6))
    p.append(sphere("navR", 0.1, (7.7, 0.8, 1.55), (1, 1, 1), green, seg=10, rings=6))
    p.append(sphere("navT", 0.1, (0, -9.55, 0.4), (1, 1, 1), white, seg=10, rings=6))
    p.append(sphere("beaconTop", 0.12, (0, -1.0, 1.95), (1, 1, 0.6), red, seg=10, rings=6))
    hull = join(p, "VTOL_Hull")
    select_only(hull)
    bpy.ops.object.shade_auto_smooth(angle=math.radians(40))

    for side, sx in (("L", -1), ("R", 1)):
        x = sx * 7.3
        # Nacelle: engine pod on the wingtip, pivoting on the wing.
        nac_parts = [
            cyl("pod", 0.68, 3.2, (x, 0.8, 1.9), hull_m, verts=24),
            sphere("podtop", 0.68, (x, 0.8, 3.5), (1, 1, 0.55), hull_m, seg=24, rings=10),
            sphere("podbot", 0.68, (x, 0.8, 0.3), (1, 1, 0.8), hull_m, seg=24, rings=10),
            cyl("intake", 0.5, 0.3, (x, 0.8, 0.05), dark, verts=20),
            cyl("podband", 0.7, 0.25, (x, 0.8, 2.6), stripe, verts=24),
            cyl("spinner", 0.28, 0.5, (x, 0.8, 3.85), dark, verts=16, r2=0.06),
        ]
        nac = join(nac_parts, f"VTOL_Nacelle_{side}")
        select_only(nac)
        bpy.ops.object.shade_auto_smooth(angle=math.radians(40))
        set_origin(nac, (x, 0.8, 1.55))
        # Proprotor: three long twisted blades.
        blades = []
        for b in range(3):
            bl = box(f"blade{b}", (0.42, 3.6, 0.07), (x, 0.8 + 1.95, 3.75), blade, bevel=0.03)
            set_origin(bl, (x, 0.8, 3.75))
            bl.rotation_euler = (math.radians(6), 0, math.radians(b * 120))
            apply_scale(bl)
            blades.append(bl)
        rotor = join(blades, f"VTOL_Rotor_{side}")
        set_origin(rotor, (x, 0.8, 3.75))
        parent(nac, hull)
        parent(rotor, nac)

    set_origin(hull, (0, 0, 0))
    export(hull, "vtol-warship.glb")


build_dog()
build_warship()
print("STREAKS2 DONE")
