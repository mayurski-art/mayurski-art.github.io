"""
Troll Forces scorestreaks, third batch: the Orbital VSAT satellite.

    blender --background --python build_streaks3.blender.py

Writes orbital-vsat.glb next to this script: the satellite that crosses
the sky while a VSAT is up (streak-entities.js VsatSatellite), the lobby
preview and the HUD icon (render_streak_icons.blender.py).

Conventions as build_streaks2.blender.py: metres, Blender +Y is "forward"
(the antenna plate).
  orbital-vsat.glb  VSAT_Bus > VSAT_Wing_L/R (solar arrays)
"""
import bpy
import math
import os
import random
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))


def material(name, color, rough=0.7, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1.0)
        b.inputs["Emission Strength"].default_value = strength
    return m


def hexc(h):
    """A #rrggbb as Blender wants it: LINEAR. Raw sRGB here renders a
    near-black solar cell as mid-grey and washes the gold foil out."""
    c = (((h >> 16) & 255) / 255.0, ((h >> 8) & 255) / 255.0, (h & 255) / 255.0)
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


def join(objs, name):
    select_only(*objs)
    bpy.ops.object.join()
    o = active()
    o.name = name
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




# ============================================================ Orbital VSAT
# Modelled on a GPS Block IIR bird (the user's reference): a boxy bus in
# crinkled gold/bronze foil, the earth-facing front a round plate bristling
# with helix antennas, two tall four-panel solar wings on booms with copper
# hinge brackets, finned radiators, a thruster bell and a magnetometer boom.
# In the sky the game pitches it nose-down so the plate looks at the map.

def build_vsat():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(7)
    golds = [material(f"VS_Gold{i}", hexc(c), rough=r, metal=0.95) for i, (c, r) in enumerate(
        [(0xd9a431, 0.28), (0xb07a1c, 0.36), (0xe8c050, 0.24), (0x946218, 0.4)])]
    seam = material("VS_Seam", hexc(0x2a2210), rough=0.6, metal=0.4)
    silver = material("VS_Silver", hexc(0xc8ccd2), rough=0.25, metal=0.95)
    steel = material("VS_Steel", hexc(0x8d949c), rough=0.35, metal=0.9)
    copper = material("VS_Copper", hexc(0xb0643a), rough=0.35, metal=0.9)
    fin = material("VS_Fin", hexc(0x2b2f35), rough=0.45, metal=0.6)
    cellm = material("VS_Cell", hexc(0x2e333b), rough=0.6, metal=0.1)
    cell2 = material("VS_Cell2", hexc(0x383e48), rough=0.6, metal=0.1)
    framem = material("VS_Frame", hexc(0x202328), rough=0.8, metal=0.2)
    band = material("VS_Band", hexc(0xe4e2d8), rough=0.5, metal=0.1)
    nozzle = material("VS_Nozzle", hexc(0x5a5e63), rough=0.3, metal=0.9)

    BW, BD, BH = 2.0, 1.9, 2.1   # bus width (x), depth (y), height (z)
    p = [box("core", (BW, BD, BH), (0, 0, 0), golds[0], bevel=0.04)]

    # Crinkled blanket: slabs of foil in different tones, slightly skewed,
    # proud of each face, so it catches light unevenly like real MLI.
    def foil_face(axis, sign):
        spans = {"x": (BD, BH), "y": (BW, BH), "z": (BW, BD)}[axis]
        n = 0
        for i in range(3):
            for j in range(3):
                a = (-0.5 + (i + 0.5) / 3) * spans[0]
                b = (-0.5 + (j + 0.5) / 3) * spans[1]
                w = spans[0] / 3 * random.uniform(0.82, 0.96)
                h = spans[1] / 3 * random.uniform(0.82, 0.96)
                t = random.uniform(0.02, 0.05)
                m = random.choice(golds)
                rz = random.uniform(-0.05, 0.05)
                if axis == "x":
                    p.append(box(f"fx{sign}{n}", (t, w, h), (sign * (BW / 2 + t / 2), a, b), m, rot=(rz, 0, 0)))
                elif axis == "y":
                    p.append(box(f"fy{sign}{n}", (w, t, h), (a, sign * (BD / 2 + t / 2), b), m, rot=(0, rz, 0)))
                else:
                    p.append(box(f"fz{sign}{n}", (w, h, t), (a, b, sign * (BH / 2 + t / 2)), m, rot=(0, 0, rz)))
                n += 1
    for ax in ("x", "y", "z"):
        for sg in (1, -1):
            foil_face(ax, sg)
    for sx in (1, -1):
        for sy in (1, -1):
            p.append(box(f"edge{sx}{sy}", (0.07, 0.07, BH + 0.1), (sx * BW / 2, sy * BD / 2, 0), seam))

    # Radiators: each side face is a 2 x 3 grid of dark louvered panels
    # (vertical slats), the boom coming out between the columns.
    for sx in (1, -1):
        for cy in (-0.45, 0.45):
            for cz in (-0.65, 0.0, 0.65):
                p.append(box(f"rad{sx}{cy}{cz}", (0.05, 0.78, 0.56), (sx * (BW / 2 + 0.06), cy, cz), fin))
                for k in range(6):
                    p.append(box(f"slat{sx}{cy}{cz}{k}", (0.08, 0.05, 0.5),
                                 (sx * (BW / 2 + 0.1), cy - 0.31 + k * 0.124, cz), steel))

    # Front: the antenna deck. A collar, a big silver plate, and helix
    # antennas (a rod wound with copper rings): an outer ring of 8, inner 4.
    fy = BD / 2 + 0.05
    face = (math.radians(90), 0, 0)
    p.append(cyl("collar", 0.95, 0.12, (0, fy, 0), steel, verts=40, rot=face))
    p.append(cyl("plate", 0.88, 0.1, (0, fy + 0.1, 0), silver, verts=40, rot=face))
    p.append(cyl("plateRim", 0.9, 0.04, (0, fy + 0.16, 0), steel, verts=40, rot=face))
    helix = [(0.62, i * math.pi / 4 + math.pi / 8) for i in range(8)] + [(0.28, i * math.pi / 2) for i in range(4)]
    for k, (r, a) in enumerate(helix):
        x, z = math.cos(a) * r, math.sin(a) * r
        L = 0.7 if r > 0.5 else 0.8
        y0 = fy + 0.15
        p.append(cyl(f"hrod{k}", 0.025, L, (x, y0 + L / 2, z), steel, verts=8, rot=face))
        for c in range(4):
            p.append(cyl(f"hcoil{k}_{c}", 0.052, 0.022, (x, y0 + 0.1 + c * (L - 0.15) / 3, z), copper, verts=10, rot=face))
        p.append(sphere(f"htip{k}", 0.04, (x, y0 + L, z), mat=silver, seg=8, rings=5))

    # Top: an instrument box with little whip antennas.
    p.append(box("instr", (0.8, 0.7, 0.35), (0.25, 0.35, BH / 2 + 0.2), golds[2], bevel=0.03))
    for k, (x, y) in enumerate([(0.05, 0.6), (0.5, 0.55), (0.3, 0.1), (-0.3, -0.5)]):
        p.append(cyl(f"whip{k}", 0.02, 0.22, (x, y, BH / 2 + 0.45), copper, verts=6))
        p.append(box(f"whipcap{k}", (0.08, 0.08, 0.05), (x, y, BH / 2 + 0.57), copper))

    # Thruster bell low on the front-left, and the magnetometer boom.
    p.append(cyl("thrBase", 0.14, 0.2, (0.15, fy + 0.02, -0.92), nozzle, verts=16, rot=face))
    p.append(cyl("thrBell", 0.08, 0.35, (0.15, fy + 0.25, -0.92), nozzle, verts=20, r2=0.2,
                 rot=(math.radians(-90), 0, 0)))
    a, b = Vector((0.8, 0.8, -0.95)), Vector((2.5, 1.7, -1.45))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=(b - a).length, vertices=8, location=(a + b) / 2)
    rod = active()
    rod.name = "magboom"
    rod.rotation_mode = "QUATERNION"
    rod.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((b - a).normalized())
    apply_scale(rod)
    rod.data.materials.append(silver)
    p.append(rod)
    p.append(sphere("magpad", 0.12, tuple(b), (1, 1, 0.5), silver, seg=12, rings=8))

    bus = join(p, "VSAT_Bus")
    select_only(bus)
    bpy.ops.object.shade_auto_smooth(angle=math.radians(30))

    # Solar wings, proportioned off the reference: each wing is a little
    # narrower than the bus and ~1.5x its height, on a short boom that meets
    # the wing's vertical middle. Four panels stacked along Z; each panel is
    # dark cells in full-width HORIZONTAL strips, and between panels runs a
    # pale gap crossed by dark spacer blocks. A copper bracket at the middle
    # gap on the inner edge takes the boom.
    PW, PH, GAP = 1.55, 0.72, 0.1
    total = 4 * PH + 3 * GAP
    root_x = BW / 2 + 0.45                     # where the boom meets the wing
    for side, sx in (("L", -1), ("R", 1)):
        parts = [
            cyl("boom", 0.045, 0.45, (sx * (BW / 2 + 0.22), 0, 0), steel, verts=10, rot=(0, math.radians(90), 0)),
            box("bracket", (0.3, 0.12, 0.16), (sx * (root_x + 0.1), 0, 0), copper),
            box("bracketPin", (0.12, 0.2, 0.08), (sx * (root_x + 0.02), 0, 0), copper),
        ]
        cx = sx * (root_x + PW / 2)
        for k in range(4):
            zc = -total / 2 + PH / 2 + k * (PH + GAP)
            parts.append(box(f"pframe{k}", (PW, 0.04, PH), (cx, 0, zc), framem))
            rows = 11
            ch = (PH - 0.06) / rows
            for r in range(rows):
                parts.append(box(f"cell{k}{r}", (PW - 0.07, 0.06, ch - 0.018),
                                 (cx, 0, zc - PH / 2 + 0.03 + (r + 0.5) * ch),
                                 cellm if (r + k) % 2 else cell2))
            if k < 3:
                gz = zc + PH / 2 + GAP / 2
                parts.append(box(f"gap{k}", (PW, 0.02, GAP), (cx, -0.01, gz), band))
                for d in range(5):
                    parts.append(box(f"spacer{k}{d}", (0.07, 0.04, GAP + 0.01),
                                     (cx - PW / 2 + 0.12 + d * (PW - 0.24) / 4, 0, gz), framem))
        wing = join(parts, f"VSAT_Wing_{side}")
        # The join takes on the boom cylinder's unapplied 90-degree turn;
        # bake it in, or the tilt below replaces it and the wing spins sideways.
        apply_scale(wing)
        set_origin(wing, (sx * (BW / 2), 0, 0))
        wing.rotation_euler = (math.radians(12), 0, 0)
        parent(wing, bus)

    export(bus, "orbital-vsat.glb")


build_vsat()
print("STREAKS3 DONE")
