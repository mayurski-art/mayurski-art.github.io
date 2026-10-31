"""
Troll Forces scorestreaks, the realism pass (docs/STREAK-REALISM.md): the
streak aircraft rebuilt on their real-world references (refs/streaks/<id>).

    blender --background --python build_streak_realism.blender.py [-- <id> ...]

Writes the .glb files next to this script, over the ones the game loads:
  recon-drone.glb    the UAV / Counter-UAV: an RQ-7B Shadow (phase 2)

Conventions as build_streaks.blender.py: metres, Blender +Y is the nose
(the exporter's +Y-up makes that three.js -Z), models centred on the hull.
Named nodes are a contract with streaks/streak-entities.js:
  ReconProp            the pusher prop (spun about its axis)
  ReconPropBlur        the blur disc behind it
  NavL / NavR / Strobe the wingtip and tail lights (blinked)
  JamPodL / JamPodR    the ALQ-131 jammer pods, shown on a Counter-UAV only
  JamStripe            the red band on a Counter-UAV's tail booms

The shapes come from lofts: an elliptical section at each station along an
axis, bridged into one smooth skin, which is how a fuselage, a wing, a pod
or a boom reads as the real thing rather than a bevelled box.
"""
import bpy
import bmesh
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RING = 24          # verts round a lofted section


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, rough=0.6, metal=0.1, emit=None, strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit is not None:
        b.inputs["Emission Color"].default_value = (*emit, 1.0)
        b.inputs["Emission Strength"].default_value = strength
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
    return m


def loft(name, mat, sections, axis="y", ring=RING, caps=True, smooth=True):
    """One skin through elliptical sections. Each section is
    (station, half_a, half_b, offset_u, offset_v): station along `axis`,
    half sizes and offsets across the other two axes (a along the first of
    the remaining axes in x,y,z order, b along the second). A half size of 0
    closes the loft to a point there."""
    bm = bmesh.new()
    order = {"x": (0, 1, 2), "y": (1, 0, 2), "z": (2, 0, 1)}[axis]
    rings = []
    for (s, ha, hb, oa, ob) in sections:
        verts = []
        for i in range(ring):
            t = i / ring * math.tau
            co = [0.0, 0.0, 0.0]
            co[order[0]] = s
            co[order[1]] = oa + ha * math.cos(t)
            co[order[2]] = ob + hb * math.sin(t)
            verts.append(bm.verts.new(co))
        rings.append(verts)
    bm.verts.ensure_lookup_table()
    for a, b in zip(rings, rings[1:]):
        for i in range(ring):
            j = (i + 1) % ring
            try:
                bm.faces.new((a[i], a[j], b[j], b[i]))
            except ValueError:
                pass
    if caps:
        for r in (rings[0], rings[-1][::-1]):
            try:
                bm.faces.new(r)
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    me.materials.append(mat)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return obj


def wing(name, mat, span_sections, axis="x", ring=RING):
    """A lifting surface as a loft of lenticular sections along the span:
    each entry (station, chord, thickness, le_offset, z) puts a section of
    that chord and thickness with its leading edge offset back along y."""
    secs = []
    for (s, chord, thick, le, z) in span_sections:
        if axis == "x":
            secs.append((s, chord / 2, thick / 2, le - chord / 2, z))
        else:
            secs.append((s, chord / 2, thick / 2, le - chord / 2, z))
    return loft(name, mat, secs, axis=axis, ring=ring)


def cyl(name, mat, r, length, loc, axis="y", verts=14, r2=None):
    r2 = r if r2 is None else r2
    secs = [(-length / 2, r, r, 0, 0), (length / 2, r2, r2, 0, 0)]
    obj = loft(name, mat, secs, axis=axis, ring=verts)
    obj.location = loc
    return obj


def box(name, mat, size, loc, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.rotation_euler = rot
    if bevel:
        m = o.modifiers.new("Bevel", "BEVEL")
        m.width = bevel
        m.segments = 2
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.materials.append(mat)
    return o


def sphere(name, mat, r, loc, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=18, ring_count=10)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def apply_transforms(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def join(objs, name):
    apply_transforms(objs)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    j = bpy.context.object
    j.name = name
    return j


def set_origin(obj, loc):
    bpy.context.scene.cursor.location = loc
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.context.scene.cursor.location = (0, 0, 0)


def parent(child, par):
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()


def export(root, filename):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for c in root.children_recursive:
        c.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = os.path.join(HERE, filename)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_yup=True, export_apply=True)
    print("Exported", path, os.path.getsize(path) // 1024, "KB")


# ------------------------------------------------------------ RQ-7B Shadow

def build_shadow():
    """The UAV: an RQ-7B Shadow (refs/streaks/uav). A fat pod fuselage with
    the sensor turret under its chin and the pusher engine at its back, a
    high straight wing of 5 m, twin tail booms off the wing carrying an
    inverted-V tail, and a two-blade pusher prop between the booms. The
    Counter-UAV is the same airframe with ALQ-131 jammer pods under the
    wings and a red band on the booms (nodes shown by the game)."""
    clear_scene()
    grey = material("ShadowGrey", (0.66, 0.68, 0.66), rough=0.5, metal=0.2)
    dark = material("ShadowDark", (0.16, 0.17, 0.16), rough=0.45, metal=0.3)
    lens = material("ShadowLens", (0.03, 0.04, 0.06), rough=0.1, metal=0.5)
    prop_mat = material("ShadowProp", (0.08, 0.08, 0.08), rough=0.35, metal=0.3)
    blur = material("ShadowBlur", (0.1, 0.1, 0.1), rough=0.8, alpha=0.28)
    nav_r = material("NavRed", (0.6, 0.02, 0.02), emit=(1.0, 0.05, 0.02), strength=6)
    nav_g = material("NavGreen", (0.02, 0.6, 0.1), emit=(0.1, 1.0, 0.2), strength=6)
    strobe = material("StrobeWhite", (0.9, 0.9, 0.9), emit=(1.0, 1.0, 1.0), strength=8)
    red = material("JamRed", (0.62, 0.08, 0.06), rough=0.5, metal=0.2)
    pod_mat = material("PodGrey", (0.5, 0.52, 0.5), rough=0.5, metal=0.3)

    hull = []
    # the pod: blunt nose, deep belly, tapering to the engine at the back
    hull.append(loft("fuse", grey, [
        (1.55, 0.0, 0.0, 0, 0.02),
        (1.45, 0.14, 0.13, 0, 0.0),
        (1.2, 0.24, 0.22, 0, -0.02),
        (0.8, 0.28, 0.27, 0, -0.03),
        (0.2, 0.28, 0.28, 0, -0.02),
        (-0.4, 0.26, 0.26, 0, 0.0),
        (-0.9, 0.2, 0.2, 0, 0.03),
        (-1.25, 0.12, 0.12, 0, 0.05),
        (-1.4, 0.0, 0.0, 0, 0.05),
    ]))
    # the engine fairing on the back of the pod, the exhaust stub
    hull.append(loft("engine", dark, [(-0.6, 0.0, 0.0, 0, 0.2), (-0.7, 0.14, 0.1, 0, 0.2), (-1.1, 0.12, 0.09, 0, 0.18), (-1.25, 0.0, 0.0, 0, 0.17)]))
    hull.append(cyl("exhaust", dark, 0.035, 0.2, (0.14, -1.2, 0.08), axis="y", verts=10))
    # the sensor turret under the belly: a ball on a short neck, lens forward
    hull.append(cyl("turret_neck", dark, 0.1, 0.1, (0, 0.35, -0.3), axis="z", verts=12))
    hull.append(sphere("turret", dark, 0.17, (0, 0.35, -0.42)))
    hull.append(cyl("turret_lens", lens, 0.07, 0.04, (0, 0.5, -0.42), axis="y", verts=12))
    # fixed tricycle gear: a nose strut and two mains behind the turret
    for (x, y) in ((0, 1.1), (-0.42, -0.1), (0.42, -0.1)):
        hull.append(cyl(f"strut_{x}_{y}", dark, 0.02, 0.36, (x, y, -0.4), axis="z", verts=6))
        hull.append(cyl(f"wheel_{x}_{y}", dark, 0.07, 0.05, (x, y, -0.58), axis="x", verts=12))
    # the GPS dome on the nose top
    hull.append(sphere("dome", grey, 0.06, (0, 1.05, 0.24), scale=(1, 1, 0.6)))
    # the wing: 5 m straight, 0.58 chord, high on the pod, tips rounded off
    hull.append(wing("wing", grey, [
        (-2.5, 0.3, 0.03, 0.08, 0.26), (-2.35, 0.5, 0.06, 0.16, 0.26), (-1.8, 0.58, 0.085, 0.22, 0.26),
        (0, 0.6, 0.09, 0.24, 0.26),
        (1.8, 0.58, 0.085, 0.22, 0.26), (2.35, 0.5, 0.06, 0.16, 0.26), (2.5, 0.3, 0.03, 0.08, 0.26)]))
    # wing root fairing onto the pod
    hull.append(loft("wing_root", grey, [(-0.5, 0.0, 0.0, 0.1, 0.24), (-0.3, 0.45, 0.1, 0.0, 0.24), (0.3, 0.45, 0.1, 0.0, 0.24), (0.5, 0.0, 0.0, -0.1, 0.24)], axis="x"))
    # twin tail booms off the wing's underside, back to the tail
    for sx in (-1, 1):
        hull.append(loft(f"boom_{sx}", dark, [(0.1, 0.055, 0.05, sx * 0.72, 0.16), (-2.1, 0.04, 0.04, sx * 0.72, 0.16), (-2.2, 0.0, 0.0, sx * 0.72, 0.16)], axis="y"))
        # the inverted-V tail: a surface from each boom down and in to meet under the centre
        hull.append(wing(f"vtail_{sx}", grey, [(sx * 0.72, 0.5, 0.04, -1.8, 0.16), (sx * 0.05, 0.42, 0.03, -1.9, -0.5)], axis="x", ring=16))
    # the tail cone joining the V at the bottom
    hull.append(loft("tail_join", grey, [(-1.6, 0.0, 0.0, 0, -0.5), (-1.75, 0.07, 0.06, 0, -0.5), (-2.05, 0.05, 0.05, 0, -0.5), (-2.15, 0.0, 0.0, 0, -0.5)], axis="y"))
    # a pitot on the nose, an antenna on the back
    hull.append(cyl("pitot", dark, 0.012, 0.3, (0.18, 1.5, 0.02), axis="y", verts=6))
    hull.append(cyl("antenna", dark, 0.01, 0.18, (-0.1, -0.2, 0.33), axis="z", verts=6))
    body = join(hull, "Shadow")
    set_origin(body, (0, 0, 0))

    # the lights, their own nodes so the game blinks them
    for name, mat, loc in (("NavL", nav_r, (-2.48, 0.06, 0.26)), ("NavR", nav_g, (2.48, 0.06, 0.26)), ("Strobe", strobe, (0, -1.3, 0.1))):
        o = sphere(name, mat, 0.035, loc)
        parent(o, body)
    # the pusher prop between the booms, behind the engine, and its blur disc
    prop_pos = (0, -1.32, 0.17)
    blades = []
    for b in range(2):
        blades.append(box(f"blade_{b}", prop_mat, (0.075, 0.014, 0.88), prop_pos, rot=(0, math.radians(b * 90), 0), bevel=0.004))
    blades.append(cyl("spinner", dark, 0.05, 0.1, prop_pos, axis="y", verts=10, r2=0.03))
    prop = join(blades, "ReconProp")
    set_origin(prop, prop_pos)
    parent(prop, body)
    disc = cyl("ReconPropBlur", blur, 0.45, 0.01, (0, -1.33, 0.17), axis="y", verts=28)
    parent(disc, body)
    # the Counter-UAV's jammer pods under the wings (ALQ-131: a long pod
    # with a flat-nosed ram-air front and a tapered tail) on short pylons
    for sx, name in ((-1, "JamPodL"), (1, "JamPodR")):
        pod = loft("pod", pod_mat, [(0.6, 0.0, 0.0, 0, 0), (0.55, 0.09, 0.1, 0, 0), (0.3, 0.12, 0.13, 0, 0), (-0.35, 0.12, 0.13, 0, 0), (-0.65, 0.07, 0.08, 0, 0), (-0.75, 0.0, 0.0, 0, 0)], axis="y")
        pod.location = (sx * 1.3, 0.1, 0.03)
        pylon = box("pylon", pod_mat, (0.05, 0.3, 0.14), (sx * 1.3, 0.1, 0.15))
        fin = box("fin", pod_mat, (0.16, 0.12, 0.02), (sx * 1.3, -0.55, -0.02))
        p = join([pod, pylon, fin], name)
        parent(p, body)
    stripe = loft("JamStripe", red, [(-1.0, 0.062, 0.057, -0.72, 0.16), (-1.5, 0.058, 0.053, -0.72, 0.16)], axis="y", caps=False)
    stripe2 = loft("stripe2", red, [(-1.0, 0.062, 0.057, 0.72, 0.16), (-1.5, 0.058, 0.053, 0.72, 0.16)], axis="y", caps=False)
    stripe = join([stripe, stripe2], "JamStripe")
    parent(stripe, body)
    export(body, "recon-drone.glb")


BUILDS = {"uav": build_shadow}

if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for key in (args or BUILDS.keys()):
        BUILDS[key]()
    print("DONE")
