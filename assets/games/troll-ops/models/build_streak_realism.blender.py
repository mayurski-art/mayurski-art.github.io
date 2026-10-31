"""
Troll Forces scorestreaks, the realism pass (docs/STREAK-REALISM.md): the
streak aircraft rebuilt on their real-world references (refs/streaks/<id>).

    blender --background --python build_streak_realism.blender.py [-- <id> ...]

Writes the .glb files next to this script, over the ones the game loads:
  recon-drone.glb    the UAV / Counter-UAV: an RQ-7B Shadow (phase 2)
  hunter-drone.glb   the Hunter-Killer / Swarm drone (phase 3)
  care-package.glb   the wooden supply crate (phase 4)
  drop-heli.glb      the UH-60 Black Hawk that drops it (phase 4)
  helicopter.glb     the Helicopter Gunship: an AH-64E Apache (phase 5)
  strike-jet.glb     the Lightning Strike's F-35A (phase 6)

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
    for sec in sections:
        (s, ha, hb, oa, ob) = sec[:5]
        n = sec[5] if len(sec) > 5 else 2.0     # 2 = ellipse, 4 = near-rectangular
        verts = []
        for i in range(ring):
            t = i / ring * math.tau
            c, sn = math.cos(t), math.sin(t)
            co = [0.0, 0.0, 0.0]
            co[order[0]] = s
            co[order[1]] = oa + ha * math.copysign(abs(c) ** (2.0 / n), c)
            co[order[2]] = ob + hb * math.copysign(abs(sn) ** (2.0 / n), sn)
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
        if axis == "x":        # span along x: chord along y, z up
            secs.append((s, chord / 2, thick / 2, le - chord / 2, z))
        else:                  # a fin, span along z: thickness along x, chord along y
            secs.append((s, thick / 2, chord / 2, z, le - chord / 2))
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


# ------------------------------------------------------- hunter-killer drone

def build_hk():
    """The Hunter-Killer (and the Swarm's drones): a small tube-bodied
    aircraft (refs/streaks/drone) about 0.6 m long with a rounded nose, two
    pairs of thin fold-out wings (a wide pair forward, a short pair aft) and
    a two-blade pusher prop at the tail. The prop is the DroneRotor_0 node
    the game spins (it turns about y, so the prop is built facing up and
    the body tilted to match in the exporter's frame)."""
    clear_scene()
    olive = material("HkOlive", (0.33, 0.35, 0.28), rough=0.55, metal=0.2)
    dark = material("HkDark", (0.1, 0.1, 0.1), rough=0.4, metal=0.4)
    lens = material("HkLens", (0.05, 0.06, 0.08), rough=0.1, metal=0.5)
    prop_mat = material("HkProp", (0.08, 0.08, 0.08), rough=0.35, metal=0.3)
    nav = material("HkBeacon", (0.6, 0.05, 0.03), emit=(1.0, 0.1, 0.05), strength=5)

    hull = []
    hull.append(loft("tube", olive, [
        (0.36, 0.0, 0.0, 0, 0), (0.33, 0.035, 0.035, 0, 0), (0.28, 0.05, 0.05, 0, 0),
        (-0.2, 0.05, 0.05, 0, 0), (-0.3, 0.04, 0.04, 0, 0), (-0.34, 0.0, 0.0, 0, 0)]))
    hull.append(cyl("eye", lens, 0.02, 0.02, (0, 0.34, -0.015), axis="y", verts=10))
    # forward wings, a long thin pair high on the tube; the aft pair short, low
    hull.append(wing("wing_f", olive, [(-0.62, 0.05, 0.012, 0.0, 0.045), (-0.1, 0.08, 0.018, 0.02, 0.045), (0.1, 0.08, 0.018, 0.02, 0.045), (0.62, 0.05, 0.012, 0.0, 0.045)], ring=12))
    hull.append(wing("wing_a", olive, [(-0.46, 0.045, 0.01, -0.2, -0.04), (0.46, 0.045, 0.01, -0.2, -0.04)], ring=12))
    # the tail fin, down from the tube ahead of the prop
    hull.append(wing("fin", olive, [(-0.04, 0.09, 0.012, -0.2, 0), (-0.15, 0.07, 0.01, -0.25, 0)], axis="z", ring=10))
    hull.append(cyl("motor", dark, 0.025, 0.05, (0, -0.33, 0), axis="y", verts=10))
    body = join(hull, "Hk")
    set_origin(body, (0, 0, 0))
    b = sphere("Beacon", nav, 0.015, (0, 0.05, 0.06))
    parent(b, body)
    # the pusher prop: two blades joined, origin at the motor, turned about
    # the body axis by the game as DroneRotor_0 (rotation.y after export)
    # built flat like a rotor (spin about its own z), then the node is tipped
    # to face along the tube: the game's rotation.y += then spins it about
    # the body axis
    prop_pos = (0, -0.37, 0)
    blades = [box(f"blade_{i}", prop_mat, (0.24, 0.02, 0.006), (0, 0, 0), rot=(0, 0, math.radians(i * 90)), bevel=0.002) for i in range(2)]
    prop = join(blades, "DroneRotor_0")
    prop.rotation_euler = (math.radians(90), 0, 0)
    prop.location = prop_pos
    parent(prop, body)
    export(body, "hunter-drone.glb")


# ---------------------------------------------------------- care package

def build_crate():
    """The care package: a wooden supply crate (refs/streaks/carepackage
    ammo-crate), 1.1 m, base on z=0. Planked sides with the gaps between
    boards, steel corner brackets and edge straps, rope handles on two
    sides, a dark stencil band, and the green beacon on the lid that the
    game already uses to find it across a map."""
    clear_scene()
    wood = material("CrateWood", (0.45, 0.33, 0.18), rough=0.85, metal=0.0)
    wood2 = material("CrateWood2", (0.38, 0.27, 0.14), rough=0.85, metal=0.0)
    steel = material("CrateSteel", (0.25, 0.26, 0.25), rough=0.45, metal=0.8)
    rope = material("CrateRope", (0.6, 0.52, 0.36), rough=0.95, metal=0.0)
    band = material("CrateBand", (0.12, 0.12, 0.1), rough=0.8, metal=0.0)
    light = material("PkgLight", (0.35, 0.85, 0.4), rough=0.2, metal=0.0, emit=(0.3, 1.0, 0.4), strength=2)

    s = 1.1
    objs = []
    # the core box a hair inside the planks so the gaps read dark
    objs.append(box("core", band, (s - 0.03, s - 0.03, s * 0.8 - 0.02), (0, 0, s * 0.4)))
    # planks: five boards up each side, alternating tones, with a 1 cm gap
    n = 5
    ph = (s * 0.8) / n
    for i in range(n):
        z = ph * (i + 0.5)
        m = wood if i % 2 == 0 else wood2
        objs.append(box("plank_f%d" % i, m, (s, 0.03, ph - 0.012), (0, -s / 2, z), bevel=0.004))
        objs.append(box("plank_b%d" % i, m, (s, 0.03, ph - 0.012), (0, s / 2, z), bevel=0.004))
        objs.append(box("plank_l%d" % i, m, (0.03, s - 0.03, ph - 0.012), (-s / 2, 0, z), bevel=0.004))
        objs.append(box("plank_r%d" % i, m, (0.03, s - 0.03, ph - 0.012), (s / 2, 0, z), bevel=0.004))
    # the lid: boards running across, a frame round them
    for i in range(n):
        objs.append(box("lid_%d" % i, wood if i % 2 else wood2, (ph - 0.012, s, 0.035), ((i + 0.5) * ph - s * 0.4, 0, s * 0.8 + 0.017), bevel=0.004))
    objs.append(box("lid_frame_a", wood, (s + 0.02, 0.06, 0.045), (0, -s / 2 + 0.02, s * 0.8 + 0.02)))
    objs.append(box("lid_frame_b", wood, (s + 0.02, 0.06, 0.045), (0, s / 2 - 0.02, s * 0.8 + 0.02)))
    # steel corner brackets and the straps up the middle of the long sides
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(box("corner_%d_%d" % (sx, sy), steel, (0.09, 0.09, s * 0.8 + 0.06), (sx * s / 2, sy * s / 2, s * 0.4 + 0.02)))
        objs.append(box("strap_%d" % sx, steel, (0.07, s + 0.05, s * 0.86), (sx * s * 0.28, 0, s * 0.41)))
    # rope handles on the ends
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.11, minor_radius=0.018, location=(sx * (s / 2 + 0.02), 0, s * 0.5), rotation=(0, math.radians(90), 0), major_segments=14, minor_segments=6)
        t = bpy.context.object
        t.name = "rope_%d" % sx
        t.data.materials.append(rope)
        objs.append(t)
    # a dark stencil band on the front and the beacon on the lid
    objs.append(box("stencil", band, (0.5, 0.004, 0.11), (0, -s / 2 - 0.016, s * 0.45)))
    objs.append(cyl("beacon", light, 0.07, 0.1, (0, 0, s * 0.8 + 0.08), axis="z", verts=10))
    root = join(objs, "care_package")
    set_origin(root, (0, 0, 0))
    export(root, "care-package.glb")


# --------------------------------------------------------- UH-60 Black Hawk

def build_blackhawk():
    """The care package's delivery helicopter: a UH-60M Black Hawk
    (refs/streaks/carepackage), built at 0.8 scale (12 m fuselage, 13 m
    rotor). A low wide cabin with the sloped cockpit nose, the engine deck
    and nacelles either side of the mast, the tail boom rising to the
    canted fin with the stabilator low on its back, main gear on struts and
    the tail wheel. MainRotor spins about y, TailRotor about x."""
    clear_scene()
    green = material("HawkGreen", (0.16, 0.19, 0.15), rough=0.55, metal=0.25)
    dark = material("HawkDark", (0.07, 0.08, 0.07), rough=0.5, metal=0.4)
    glass = material("HawkGlass", (0.06, 0.09, 0.11), rough=0.08, metal=0.3)
    blade_mat = material("HawkBlade", (0.06, 0.06, 0.06), rough=0.4, metal=0.3)
    blur = material("HawkBlur", (0.08, 0.08, 0.08), rough=0.8, alpha=0.22)
    nav_r = material("NavRed", (0.6, 0.02, 0.02), emit=(1.0, 0.05, 0.02), strength=6)
    nav_g = material("NavGreen", (0.02, 0.6, 0.1), emit=(0.1, 1.0, 0.2), strength=6)
    strobe = material("StrobeWhite", (0.9, 0.9, 0.9), emit=(1.0, 1.0, 1.0), strength=8)

    k = 0.8
    hull = []
    # fuselage: nose, cockpit, cabin, then the boom tapering up to the tail
    hull.append(loft("fuse", green, [
        (7.6 * k, 0.0, 0.0, 0, 0.9 * k), (7.2 * k, 0.5 * k, 0.5 * k, 0, 1.0 * k), (6.2 * k, 0.9 * k, 0.9 * k, 0, 1.25 * k),
        (5.0 * k, 1.2 * k, 1.15 * k, 0, 1.45 * k, 3.0), (3.2 * k, 1.25 * k, 1.25 * k, 0, 1.55 * k, 3.5), (0.0, 1.25 * k, 1.25 * k, 0, 1.6 * k, 3.5),
        (-2.2 * k, 1.1 * k, 1.1 * k, 0, 1.75 * k, 3.0), (-3.8 * k, 0.55 * k, 0.6 * k, 0, 2.0 * k), (-6.0 * k, 0.35 * k, 0.45 * k, 0, 2.3 * k),
        (-7.6 * k, 0.25 * k, 0.4 * k, 0, 2.6 * k), (-8.0 * k, 0.0, 0.0, 0, 2.7 * k)]))
    # the long nose under the windscreen, a flattened cone out past the glass
    hull.append(loft("nose", green, [(8.6 * k, 0.0, 0.0, 0, 0.85 * k), (8.2 * k, 0.4 * k, 0.3 * k, 0, 0.85 * k), (7.0 * k, 0.8 * k, 0.5 * k, 0, 0.95 * k, 3.0), (5.8 * k, 1.1 * k, 0.6 * k, 0, 1.05 * k, 3.0)]))
    # the engine deck over the cabin and the two nacelles
    hull.append(loft("deck", green, [(3.4 * k, 0.0, 0.0, 0, 2.6 * k), (3.0 * k, 0.9 * k, 0.3 * k, 0, 2.65 * k), (-0.5 * k, 1.0 * k, 0.35 * k, 0, 2.75 * k), (-2.6 * k, 0.7 * k, 0.25 * k, 0, 2.7 * k), (-3.2 * k, 0.0, 0.0, 0, 2.65 * k)]))
    for sx in (-1, 1):
        hull.append(loft("nacelle_%d" % sx, dark, [(2.2 * k, 0.0, 0.0, sx * 0.95 * k, 2.95 * k), (1.8 * k, 0.4 * k, 0.4 * k, sx * 0.95 * k, 2.95 * k), (-1.6 * k, 0.4 * k, 0.4 * k, sx * 0.95 * k, 2.95 * k), (-2.3 * k, 0.25 * k, 0.25 * k, sx * 0.95 * k, 3.0 * k), (-2.5 * k, 0.0, 0.0, sx * 0.95 * k, 3.0 * k)]))
    # the rotor mast and the cockpit glass, cabin windows and doors
    hull.append(cyl("mast", dark, 0.22 * k, 0.9 * k, (0, 0.6 * k, 3.3 * k), axis="z", verts=12))
    hull.append(loft("windscreen", glass, [(7.0 * k, 0.55 * k, 0.45 * k, 0, 1.55 * k), (5.6 * k, 1.0 * k, 0.75 * k, 0, 1.95 * k)], axis="y"))
    for sx in (-1, 1):
        hull.append(box("door_win_%d" % sx, glass, (0.06 * k, 1.6 * k, 0.8 * k), (sx * 1.2 * k, 1.2 * k, 1.9 * k)))
        hull.append(box("door_%d" % sx, dark, (0.04 * k, 1.9 * k, 2.0 * k), (sx * 1.21 * k, 1.2 * k, 1.35 * k)))
        hull.append(box("cockpit_win_%d" % sx, glass, (0.06 * k, 1.1 * k, 0.9 * k), (sx * 1.1 * k, 4.6 * k, 1.9 * k)))
    # the tail: a fin canted forward, the stabilator low across its back
    hull.append(wing("fin", green, [(2.6 * k, 2.2 * k, 0.35 * k, -6.3 * k, 0), (5.0 * k, 1.6 * k, 0.2 * k, -7.6 * k, 0)], axis="z", ring=12))
    hull.append(wing("stab", green, [(-2.2 * k, 1.0 * k, 0.12 * k, -6.9 * k, 2.7 * k), (0, 1.3 * k, 0.16 * k, -6.7 * k, 2.7 * k), (2.2 * k, 1.0 * k, 0.12 * k, -6.9 * k, 2.7 * k)], ring=12))
    # landing gear: main wheels on struts under the cabin, tail wheel
    for sx in (-1, 1):
        hull.append(cyl("strut_%d" % sx, dark, 0.07 * k, 1.1 * k, (sx * 1.4 * k, 3.0 * k, 0.55 * k), axis="z", verts=8))
        hull.append(cyl("wheel_%d" % sx, dark, 0.32 * k, 0.25 * k, (sx * 1.5 * k, 3.0 * k, 0.32 * k), axis="x", verts=14))
    hull.append(cyl("tail_strut", dark, 0.05 * k, 0.9 * k, (0, -6.0 * k, 1.8 * k), axis="z", verts=8))
    hull.append(cyl("tail_wheel", dark, 0.2 * k, 0.18 * k, (0, -6.0 * k, 1.4 * k), axis="x", verts=12))
    # the sling hook under the belly and a pitot on the nose
    hull.append(cyl("hook", dark, 0.1 * k, 0.3 * k, (0, 0.6 * k, 0.4 * k), axis="z", verts=8))
    hull.append(cyl("pitot", dark, 0.03 * k, 1.2 * k, (0.5 * k, 7.6 * k, 1.1 * k), axis="y", verts=6))
    body = join(hull, "Blackhawk")
    set_origin(body, (0, 0, 1.7 * k))
    for name, mat, loc in (("NavL", nav_r, (-1.3 * k, 3.5 * k, 1.1 * k)), ("NavR", nav_g, (1.3 * k, 3.5 * k, 1.1 * k)), ("Strobe", strobe, (0, -7.4 * k, 5.1 * k))):
        o = sphere(name, mat, 0.06 * k, loc)
        parent(o, body)
    # the four-blade main rotor, its hub and the blur disc
    hub = (0, 0.6 * k, 3.85 * k)
    parts = [cyl("hub", dark, 0.35 * k, 0.35 * k, hub, axis="z", verts=12)]
    for b in range(4):
        a = math.radians(b * 90)
        parts.append(box("blade_%d" % b, blade_mat, (6.5 * k, 0.4 * k, 0.05 * k), (hub[0] + math.cos(a) * 3.4 * k, hub[1] + math.sin(a) * 3.4 * k, hub[2] + 0.02), rot=(0, 0, a), bevel=0.01))
    rotor = join(parts, "MainRotor")
    set_origin(rotor, hub)
    parent(rotor, body)
    disc = cyl("MainRotorBlur", blur, 6.6 * k, 0.02, (hub[0], hub[1], hub[2] + 0.02), axis="z", verts=36)
    parent(disc, body)
    # the tail rotor on the left of the fin, four blades, spun about x
    thub = (-0.35 * k, -7.3 * k, 4.2 * k)
    tparts = [cyl("thub", dark, 0.15 * k, 0.2 * k, thub, axis="x", verts=10)]
    for b in range(4):
        a = math.radians(b * 90)
        tparts.append(box("tblade_%d" % b, blade_mat, (0.04 * k, 0.22 * k, 1.5 * k), (thub[0] - 0.02, thub[1] + math.sin(a) * 0.8 * k, thub[2] + math.cos(a) * 0.8 * k), rot=(a, 0, 0), bevel=0.005))
    trotor = join(tparts, "TailRotor")
    set_origin(trotor, thub)
    parent(trotor, body)
    export(body, "drop-heli.glb")


# ------------------------------------------------------------ AH-64E Apache

def build_apache():
    """The Helicopter Gunship: an AH-64E Apache (refs/streaks/helicopter) at
    0.8 scale (14 m, 11.7 m rotor). The narrow tandem cockpit with its flat
    stepped canopy panels, the sensor nose with the chin turret and gun
    under it, engine nacelles high either side behind the cockpit, stub
    wings with rocket pods outboard and missile racks inboard, the slim
    boom to the tail with the stabilator at its tip and the tail rotor on
    the right, the mast radome and the tailwheel gear. MainRotor spins
    about y, TailRotor about x; the game's searchlight and muzzle sit on
    the nose at -z as before."""
    clear_scene()
    olive = material("ApacheOlive", (0.17, 0.19, 0.14), rough=0.6, metal=0.2)
    dark = material("ApacheDark", (0.06, 0.07, 0.06), rough=0.5, metal=0.4)
    glass = material("ApacheGlass", (0.07, 0.1, 0.12), rough=0.08, metal=0.3)
    blade_mat = material("ApacheBlade", (0.05, 0.05, 0.05), rough=0.4, metal=0.3)
    blur = material("ApacheBlur", (0.08, 0.08, 0.08), rough=0.8, alpha=0.22)
    nav_r = material("NavRed", (0.6, 0.02, 0.02), emit=(1.0, 0.05, 0.02), strength=6)
    nav_g = material("NavGreen", (0.02, 0.6, 0.1), emit=(0.1, 1.0, 0.2), strength=6)
    strobe = material("StrobeWhite", (0.9, 0.9, 0.9), emit=(1.0, 1.0, 1.0), strength=8)

    k = 0.8
    hull = []
    # the fuselage: sensor nose, the narrow tandem cockpit rising to the
    # pilot's seat, the engine bay, then the boom tapering to the tail
    hull.append(loft("fuse", olive, [
        (8.6 * k, 0.0, 0.0, 0, 0.9 * k), (8.2 * k, 0.35 * k, 0.35 * k, 0, 0.95 * k), (7.4 * k, 0.5 * k, 0.55 * k, 0, 1.0 * k, 3.0),
        (6.2 * k, 0.55 * k, 0.65 * k, 0, 1.05 * k, 3.0), (4.6 * k, 0.6 * k, 0.75 * k, 0, 1.2 * k, 3.0), (3.0 * k, 0.65 * k, 0.85 * k, 0, 1.35 * k, 3.0),
        (1.2 * k, 0.8 * k, 1.0 * k, 0, 1.75 * k, 3.0), (-1.0 * k, 0.7 * k, 0.8 * k, 0, 1.8 * k, 3.0), (-3.0 * k, 0.4 * k, 0.5 * k, 0, 2.0 * k),
        (-6.0 * k, 0.28 * k, 0.4 * k, 0, 2.3 * k), (-8.4 * k, 0.2 * k, 0.35 * k, 0, 2.6 * k), (-8.9 * k, 0.0, 0.0, 0, 2.65 * k)]))
    # the stepped canopy: gunner's low front panels, pilot's higher behind
    hull.append(loft("canopy_f", glass, [(6.9 * k, 0.0, 0.0, 0, 1.5 * k), (6.4 * k, 0.5 * k, 0.55 * k, 0, 1.75 * k, 3.5), (5.0 * k, 0.55 * k, 0.65 * k, 0, 2.0 * k, 3.5), (4.6 * k, 0.0, 0.0, 0, 2.05 * k)]))
    hull.append(loft("canopy_r", glass, [(4.7 * k, 0.0, 0.0, 0, 2.0 * k), (4.3 * k, 0.55 * k, 0.65 * k, 0, 2.3 * k, 3.5), (2.8 * k, 0.58 * k, 0.65 * k, 0, 2.5 * k, 3.5), (2.0 * k, 0.0, 0.0, 0, 2.4 * k)]))
    # the fuselage spine behind the pilot, up to the engine bay
    hull.append(loft("spine", olive, [(2.4 * k, 0.0, 0.0, 0, 2.2 * k), (2.0 * k, 0.6 * k, 0.35 * k, 0, 2.3 * k, 3.0), (0.4 * k, 0.75 * k, 0.4 * k, 0, 2.35 * k, 3.0), (-1.2 * k, 0.6 * k, 0.3 * k, 0, 2.3 * k), (-2.0 * k, 0.0, 0.0, 0, 2.25 * k)]))
    # the sensor nose: the TADS/PNVS turret, a barrel with the lens windows
    hull.append(cyl("tads", dark, 0.55 * k, 0.8 * k, (0, 8.2 * k, 0.85 * k), axis="y", verts=14))
    hull.append(cyl("tads_lens", glass, 0.22 * k, 0.05 * k, (0.2 * k, 8.62 * k, 0.85 * k), axis="y", verts=10))
    # the chin turret and the gun under the nose, pointing forward
    hull.append(cyl("turret", dark, 0.35 * k, 0.5 * k, (0, 6.3 * k, 0.15 * k), axis="z", verts=12))
    hull.append(cyl("gun", dark, 0.1 * k, 2.2 * k, (0, 7.4 * k, 0.0), axis="y", verts=8))
    # engine nacelles high either side of the fuselage, the exhaust at the back
    for sx in (-1, 1):
        hull.append(loft("nacelle_%d" % sx, olive, [(3.6 * k, 0.0, 0.0, sx * 1.2 * k, 2.2 * k), (3.2 * k, 0.55 * k, 0.55 * k, sx * 1.2 * k, 2.2 * k), (-0.6 * k, 0.55 * k, 0.55 * k, sx * 1.2 * k, 2.25 * k), (-1.8 * k, 0.4 * k, 0.45 * k, sx * 1.25 * k, 2.3 * k), (-2.2 * k, 0.0, 0.0, sx * 1.25 * k, 2.3 * k)]))
        hull.append(cyl("exhaust_%d" % sx, dark, 0.3 * k, 0.5 * k, (sx * 1.25 * k, -1.7 * k, 2.3 * k), axis="y", verts=10))
    # the stub wings, with a rocket pod outboard and a missile rack inboard
    hull.append(wing("stub", olive, [(-3.1 * k, 1.1 * k, 0.2 * k, 1.5 * k, 1.75 * k), (0, 1.3 * k, 0.28 * k, 1.6 * k, 1.75 * k), (3.1 * k, 1.1 * k, 0.2 * k, 1.5 * k, 1.75 * k)], ring=12))
    for sx in (-1, 1):
        hull.append(cyl("pod_%d" % sx, dark, 0.3 * k, 1.9 * k, (sx * 2.7 * k, 1.0 * k, 1.3 * k), axis="y", verts=12))
        hull.append(box("rack_%d" % sx, dark, (0.5 * k, 1.4 * k, 0.12 * k), (sx * 1.7 * k, 1.0 * k, 1.35 * k)))
        for i in range(2):
            hull.append(cyl("msl_%d_%d" % (sx, i), dark, 0.09 * k, 1.5 * k, (sx * (1.55 + i * 0.3) * k, 1.0 * k, 1.2 * k), axis="y", verts=8))
    # the tail: a swept fin up with the stabilator across its top, the tail
    # rotor gearbox on the right of the fin
    hull.append(wing("fin", olive, [(2.5 * k, 2.0 * k, 0.3 * k, -7.2 * k, 0), (4.6 * k, 1.2 * k, 0.18 * k, -8.3 * k, 0)], axis="z", ring=12))
    hull.append(wing("stab", olive, [(-1.9 * k, 0.9 * k, 0.1 * k, -8.3 * k, 4.5 * k), (1.9 * k, 0.9 * k, 0.1 * k, -8.3 * k, 4.5 * k)], ring=12))
    hull.append(cyl("tgear", dark, 0.2 * k, 0.5 * k, (0.3 * k, -7.9 * k, 4.0 * k), axis="x", verts=10))
    # the mast and the Longbow radome on top, the landing gear
    hull.append(cyl("mast", dark, 0.22 * k, 1.0 * k, (0, 1.0 * k, 3.2 * k), axis="z", verts=12))
    hull.append(cyl("radome_stem", dark, 0.12 * k, 0.8 * k, (0, 1.0 * k, 4.3 * k), axis="z", verts=8))
    hull.append(sphere("radome", olive, 0.7 * k, (0, 1.0 * k, 4.8 * k), scale=(1, 1, 0.5)))
    for sx in (-1, 1):
        hull.append(cyl("strut_%d" % sx, dark, 0.07 * k, 1.3 * k, (sx * 1.1 * k, 4.2 * k, 0.3 * k), axis="z", verts=8))
        hull.append(cyl("wheel_%d" % sx, dark, 0.3 * k, 0.22 * k, (sx * 1.2 * k, 4.2 * k, -0.1 * k), axis="x", verts=14))
    hull.append(cyl("tail_strut", dark, 0.05 * k, 0.8 * k, (0, -7.2 * k, 1.9 * k), axis="z", verts=8))
    hull.append(cyl("tail_wheel", dark, 0.18 * k, 0.16 * k, (0, -7.2 * k, 1.5 * k), axis="x", verts=12))
    body = join(hull, "Apache")
    set_origin(body, (0, 0, 1.7 * k))
    for name, mat, loc in (("NavL", nav_r, (-3.1 * k, 1.5 * k, 1.75 * k)), ("NavR", nav_g, (3.1 * k, 1.5 * k, 1.75 * k)), ("Strobe", strobe, (0, -8.3 * k, 4.9 * k))):
        o = sphere(name, mat, 0.06 * k, loc)
        parent(o, body)
    # the four-blade main rotor, hub and blur disc
    hub = (0, 1.0 * k, 3.75 * k)
    parts = [cyl("hub", dark, 0.4 * k, 0.4 * k, hub, axis="z", verts=12)]
    for b in range(4):
        a = math.radians(b * 90)
        parts.append(box("blade_%d" % b, blade_mat, (5.8 * k, 0.45 * k, 0.05 * k), (hub[0] + math.cos(a) * 3.1 * k, hub[1] + math.sin(a) * 3.1 * k, hub[2] + 0.02), rot=(0, 0, a), bevel=0.01))
    rotor = join(parts, "MainRotor")
    set_origin(rotor, hub)
    parent(rotor, body)
    disc = cyl("MainRotorBlur", blur, 5.9 * k, 0.02, (hub[0], hub[1], hub[2] + 0.02), axis="z", verts=36)
    parent(disc, body)
    # the tail rotor on the right of the fin, spun about x
    thub = (0.6 * k, -7.9 * k, 4.0 * k)
    tparts = [cyl("thub", dark, 0.14 * k, 0.2 * k, thub, axis="x", verts=10)]
    for b in range(4):
        a = math.radians(b * 90 + (0 if b % 2 == 0 else 30))
        tparts.append(box("tblade_%d" % b, blade_mat, (0.04 * k, 0.22 * k, 1.4 * k), (thub[0] + 0.02, thub[1] + math.sin(a) * 0.75 * k, thub[2] + math.cos(a) * 0.75 * k), rot=(a, 0, 0), bevel=0.005))
    trotor = join(tparts, "TailRotor")
    set_origin(trotor, thub)
    parent(trotor, body)
    export(body, "helicopter.glb")


# ------------------------------------------------------------- F-35A jet

def build_f35():
    """The Lightning Strike's jet: an F-35A (refs/streaks/airstrike) at 0.8
    scale (12.5 m long, 8.6 m span). A wide flat blended fuselage with the
    pointed nose, the bubble canopy well forward, the two angled intakes
    under the wing roots, trapezoidal wings, the twin canted tails and the
    stabilators, one round nozzle at the back. JetProp is the turbine disc
    inside the nozzle (the game spins it about z); Exhaust is the
    afterburner cone behind it, emissive."""
    clear_scene()
    grey = material("JetGrey", (0.36, 0.38, 0.4), rough=0.45, metal=0.5)
    dark = material("JetDark", (0.12, 0.13, 0.14), rough=0.4, metal=0.5)
    glass = material("JetGlass", (0.1, 0.14, 0.17), rough=0.06, metal=0.4)
    hot = material("JetHot", (0.9, 0.55, 0.25), rough=0.3, metal=0.0, emit=(1.0, 0.45, 0.12), strength=6, alpha=0.75)
    fan = material("JetFan", (0.3, 0.3, 0.32), rough=0.4, metal=0.8)
    nav_r = material("NavRed", (0.6, 0.02, 0.02), emit=(1.0, 0.05, 0.02), strength=6)
    nav_g = material("NavGreen", (0.02, 0.6, 0.1), emit=(0.1, 1.0, 0.2), strength=6)

    k = 0.8
    hull = []
    # the blended fuselage: sharp nose, widening under the canopy into the
    # flat deck between the intakes, narrowing to the nozzle
    hull.append(loft("fuse", grey, [
        (7.8 * k, 0.0, 0.0, 0, 0.0), (7.2 * k, 0.3 * k, 0.3 * k, 0, 0.0), (5.6 * k, 0.65 * k, 0.6 * k, 0, 0.05 * k, 2.5),
        (4.0 * k, 1.1 * k, 0.75 * k, 0, 0.0, 3.0), (2.4 * k, 1.8 * k, 0.85 * k, 0, 0.0, 3.5), (0.6 * k, 2.1 * k, 0.9 * k, 0, 0.0, 3.5),
        (-1.6 * k, 2.0 * k, 0.85 * k, 0, 0.0, 3.5), (-3.6 * k, 1.3 * k, 0.75 * k, 0, 0.0, 3.0), (-5.0 * k, 0.7 * k, 0.6 * k, 0, 0.0, 2.5),
        (-5.6 * k, 0.55 * k, 0.55 * k, 0, 0.0)]))
    # the chines: a flat ledge each side of the forebody running back into the wing root
    hull.append(loft("chine", grey, [(7.0 * k, 0.25 * k, 0.03 * k, 0, -0.02 * k), (5.6 * k, 0.9 * k, 0.05 * k, 0, -0.05 * k), (3.6 * k, 1.6 * k, 0.06 * k, 0, -0.08 * k), (2.2 * k, 2.3 * k, 0.07 * k, 0, -0.1 * k), (1.4 * k, 0.0, 0.0, 0, -0.1 * k)]))
    # the canopy, a bubble forward of the wing
    hull.append(loft("canopy", glass, [(5.4 * k, 0.0, 0.0, 0, 0.45 * k), (4.6 * k, 0.45 * k, 0.5 * k, 0, 0.55 * k), (3.0 * k, 0.5 * k, 0.6 * k, 0, 0.65 * k), (1.4 * k, 0.45 * k, 0.4 * k, 0, 0.65 * k), (0.4 * k, 0.0, 0.0, 0, 0.6 * k)]))
    # the intakes: angled boxes either side under the wing roots, lips open forward
    for sx in (-1, 1):
        hull.append(loft("intake_%d" % sx, grey, [(3.4 * k, 0.5 * k, 0.55 * k, sx * 1.35 * k, -0.35 * k, 3.5), (0.4 * k, 0.55 * k, 0.6 * k, sx * 1.5 * k, -0.3 * k, 3.5), (-1.0 * k, 0.0, 0.0, sx * 1.5 * k, -0.3 * k)]))
        hull.append(box("intake_mouth_%d" % sx, dark, (0.7 * k, 0.05 * k, 0.8 * k), (sx * 1.35 * k, 3.38 * k, -0.35 * k), rot=(0, math.radians(sx * 12), 0)))
    # the wings: trapezoid, leading edge swept, trailing edge nearly straight
    hull.append(wing("wing", grey, [(-5.4 * k, 1.6 * k, 0.08 * k, -2.4 * k, -0.1 * k), (-2.4 * k, 4.0 * k, 0.18 * k, -0.2 * k, -0.1 * k), (0, 5.8 * k, 0.3 * k, 1.4 * k, -0.1 * k),
        (2.4 * k, 4.0 * k, 0.18 * k, -0.2 * k, -0.1 * k), (5.4 * k, 1.6 * k, 0.08 * k, -2.4 * k, -0.1 * k)], ring=12))
    # stabilators at the tail, swept like the wing
    hull.append(wing("stab", grey, [(-2.6 * k, 1.1 * k, 0.06 * k, -4.6 * k, 0.0), (0, 2.2 * k, 0.12 * k, -3.6 * k, 0.0), (2.6 * k, 1.1 * k, 0.06 * k, -4.6 * k, 0.0)], ring=10))
    # twin tails, canted out 20 degrees
    for sx in (-1, 1):
        f = wing("fin_%d" % sx, grey, [(0.0, 2.4 * k, 0.12 * k, -2.6 * k, 0), (1.9 * k, 1.1 * k, 0.06 * k, -4.0 * k, 0)], axis="z", ring=10)
        f.location = (sx * 0.9 * k, 0, 0.6 * k)
        f.rotation_euler = (0, math.radians(-sx * 20), 0)
        hull.append(f)
    # the nozzle: a ring of petals, the turbine disc inside it
    hull.append(cyl("nozzle", dark, 0.55 * k, 0.9 * k, (0, -5.9 * k, 0), axis="y", verts=16, r2=0.5 * k))
    hull.append(cyl("pitot", dark, 0.02 * k, 0.8 * k, (0, 8.1 * k, 0), axis="y", verts=6))
    body = join(hull, "F35")
    set_origin(body, (0, 0, 0))
    for name, mat, loc in (("NavL", nav_r, (-5.35 * k, -3.0 * k, -0.1 * k)), ("NavR", nav_g, (5.35 * k, -3.0 * k, -0.1 * k))):
        o = sphere(name, mat, 0.05 * k, loc)
        parent(o, body)
    # the turbine disc the game spins (JetProp, rotation.z), flat in the nozzle
    blades = []
    for b in range(5):
        blades.append(box("fan_%d" % b, fan, (0.9 * k, 0.1 * k, 0.03 * k), (0, 0, 0), rot=(0, 0, math.radians(b * 36))))
    prop = join(blades, "JetProp")
    prop.rotation_euler = (math.radians(90), 0, 0)
    prop.location = (0, -5.7 * k, 0)
    parent(prop, body)
    # the afterburner cone behind the nozzle
    cone = loft("Exhaust", hot, [(-6.2 * k, 0.42 * k, 0.42 * k, 0, 0), (-7.4 * k, 0.3 * k, 0.3 * k, 0, 0), (-9.0 * k, 0.0, 0.0, 0, 0)], axis="y", ring=14)
    parent(cone, body)
    export(body, "strike-jet.glb")


BUILDS = {"uav": build_shadow, "drone": build_hk, "crate": build_crate, "dropheli": build_blackhawk, "gunship": build_apache, "jet": build_f35}

if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for key in (args or BUILDS.keys()):
        BUILDS[key]()
    print("DONE")
