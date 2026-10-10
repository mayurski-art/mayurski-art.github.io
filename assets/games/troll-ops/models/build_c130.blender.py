"""
Troll Royale's drop plane: a Lockheed C-130 Hercules, traced from side and
three-quarter photographs (29.8 m long, 40.4 m span, the high straight
wing, four turboprops, the upswept tail with the ramp and the upper cargo
door under it).

    blender --background --python build_c130.blender.py

Writes c130.glb next to this script.

Conventions as build_streaks2.blender.py: metres, Blender +Y is the nose
(three.js -Z after the exporter's Y-up flip). The ORIGIN is the middle of
the cargo floor: the hold royale-hold.js builds in the game sits on it,
12.5 m long (Blender y -6.25 .. +6.25), 3.1 m wide, 2.74 m high. Every
part the game moves is its own node; the names are contract with
royale-planes.js:

  C130_Hull                 the airframe (one vertex-coloured material)
    C130_Liner              the dark inside of the hull, seen through the
                            open ramp (the ridden plane hides it: its hold
                            is drawn instead)
    C130_Ramp               hinged at the floor's aft edge (y -6.25, z 0),
                            exported shut; rotation.x 0 = level with the floor
    C130_Door               the upper cargo door, hinged at its aft top edge,
                            exported shut; it swings up into the tail
    C130_Prop_1..4          left to right, spinning about the nose axis
"""
import bpy
import bmesh
import math
import os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))

HINGE_Y = -6.25          # the ramp's hinge, the hold's aft end
DOOR_Y = -12.6           # the upper door's hinge
SLOT_X = 1.6             # half width of the opening under the tail
RAMP_LEN = 3.1
RAMP_SHUT = math.radians(-25)
WINDOWS_Y = (3.385, -1.823)  # the round windows, both sides: mid-bay between the hold's frames (build_c130_hold cuts its lining here)
WINDOW_Z = 1.55

OLIVE = (0x62, 0x6b, 0x48)
OLIVE_DK = (0x52, 0x59, 0x3c)
DARK = (0x22, 0x24, 0x20)
BLACK = (0x16, 0x17, 0x15)
GLASS = (0x0e, 0x16, 0x1b)
BOOT = (0x2c, 0x2f, 0x2a)
DECK = (0x33, 0x35, 0x30)
YELLOW = (0xe8, 0xc0, 0x1a)
RED = (0xff, 0x2a, 0x1a)
GREEN = (0x2a, 0xff, 0x5a)
WHITE = (0xf0, 0xf0, 0xea)


def rgb(c):
    return tuple(x / 255.0 for x in c)


def lin(c):
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


MATS = {}


def material(name, rough=0.62, metal=0.15, side_dark=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = True     # exported single-sided: from inside the hold the hull is not there
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    n = nt.nodes.new("ShaderNodeVertexColor")
    n.layer_name = "Col"
    nt.links.new(n.outputs["Color"], b.inputs["Base Color"])
    return m


def link(o):
    bpy.context.collection.objects.link(o)
    return o


def select_only(*objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def join(objs, name):
    select_only(*objs)
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
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


def paint(o, fn):
    """Per-corner colours from fn(world position, face normal) -> 0..255 rgb."""
    me = o.data
    if "Col" not in me.color_attributes:
        me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    col = me.color_attributes["Col"]
    mw = o.matrix_world
    for poly in me.polygons:
        n = (mw.to_3x3() @ poly.normal).normalized()
        for li in poly.loop_indices:
            p = mw @ me.vertices[me.loops[li].vertex_index].co
            c = lin(rgb(fn(p, n)))
            col.data[li].color = (*c, 1.0)


def flat(c):
    return lambda p, n: c


def mesh_from(name, verts, faces, mat, inside=None, flip=False):
    """A mesh object from vertex and quad lists. `inside(face centre)` gives a
    point the face must face away from (each face is flipped to suit)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    for f in faces:
        try:
            bm.faces.new([vs[i] for i in f])
        except ValueError:
            pass
    bm.normal_update()
    if inside:
        for f in bm.faces:
            c = f.calc_center_median()
            out = (c - Vector(inside(c))).dot(f.normal) > 0
            if out == flip:
                f.normal_flip()
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    o.data.materials.append(mat)
    return o


def loft(name, rings, mat, inside, closed=True, cap0=False, cap1=False, skip=None, flip=False):
    """Quads between consecutive rings (equal point counts). skip(i, j) drops
    the quad between ring i and i+1 at points j, j+1."""
    n = len(rings[0])
    verts = [p for r in rings for p in r]
    faces = []
    for i in range(len(rings) - 1):
        for j in range(n if closed else n - 1):
            if skip and skip(i, j):
                continue
            j2 = (j + 1) % n
            faces.append((i * n + j, i * n + j2, (i + 1) * n + j2, (i + 1) * n + j))
    if cap0:
        faces.append(tuple(range(n)))
    if cap1:
        k = (len(rings) - 1) * n
        faces.append(tuple(range(k, k + n)))
    return mesh_from(name, verts, faces, mat, inside, flip)


def smooth(o, angle=40):
    select_only(o)
    bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))


def finish(o, bevel=0.018, angle=34, segs=2):
    """The Green Candles finish (build_greencandles.blender.py): a small
    bevel on the creases with hardened normals, smooth by angle keeping the
    sharp edges, and weighted normals, so panels read flat and every edge
    catches a crisp highlight."""
    select_only(o)
    bpy.ops.mesh.customdata_custom_splitnormals_clear() if o.data.has_custom_normals else None
    if bevel > 0:
        bv = o.modifiers.new("bevel", "BEVEL")
        bv.width = bevel
        bv.segments = segs
        bv.limit_method = "ANGLE"
        bv.angle_limit = math.radians(42)
        bv.harden_normals = True
        bv.miter_outer = "MITER_ARC"
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle), keep_sharp_edges=True)
    wn = o.modifiers.new("wn", "WEIGHTED_NORMAL")
    wn.keep_sharp = True
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def catmull(pts, x):
    """Smooth interpolation through (x, value-tuple) knots."""
    pts = sorted(pts, key=lambda k: k[0])
    if x <= pts[0][0]:
        return pts[0][1]
    if x >= pts[-1][0]:
        return pts[-1][1]
    for k in range(len(pts) - 1):
        x0, x1 = pts[k][0], pts[k + 1][0]
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0)
            p0 = pts[max(0, k - 1)][1]
            p1 = pts[k][1]
            p2 = pts[k + 1][1]
            p3 = pts[min(len(pts) - 1, k + 2)][1]
            # monotone-ish: blend the Catmull-Rom with the straight line
            out = []
            for a, b, c, d in zip(p0, p1, p2, p3):
                cr = 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t ** 3)
                ln = b + (c - b) * t
                out.append(0.6 * cr + 0.4 * ln)
            return tuple(out)


# ================================================================ fuselage

# (y, top z, bottom z, half width), nose to tail.
FUSE = [
    (11.45, (1.30, 1.10, 0.04)),
    (11.38, (1.70, 0.62, 0.50)),
    (11.15, (2.05, 0.22, 0.88)),
    (10.75, (2.50, -0.08, 1.24)),
    (10.20, (3.02, -0.34, 1.58)),
    (9.55, (3.36, -0.52, 1.88)),
    (8.75, (3.55, -0.66, 2.06)),
    (7.70, (3.60, -0.70, 2.15)),
    (HINGE_Y, (3.60, -0.70, 2.15)),
    (-8.0, (3.60, 0.12, 2.10)),
    (-10.0, (3.56, 1.02, 1.96)),
    (-12.0, (3.50, 1.90, 1.66)),
    (DOOR_Y, (3.48, 2.12, 1.55)),
    (-13.6, (3.45, 2.50, 1.20)),
    (-14.8, (3.40, 2.84, 0.74)),
    (-15.55, (3.32, 3.02, 0.30)),
    (-15.80, (3.22, 3.12, 0.04)),
]
FUSE_Y = sorted({11.45, 11.38, 11.28, 11.15, 10.95, 10.75, 10.5, 10.2, 9.9, 9.55, 9.15, 8.75, 8.2, 7.7, 6.25, 4.5, 3.6, 2.4,
                 1.0, -0.5, -2.0, -3.5, -5.0, -6.25, -7.0, -8.0, -9.06, -10.0, -11.0, -12.0, -12.6, -13.1, -13.6, -14.2,
                 -14.8, -15.2, -15.55, -15.8}, reverse=True)
SIDE_N = 26      # points down each side from the top to the opening's edge
BOT_N = 8        # points across the bottom between the opening's edges
N_TOP, N_BOT = 2.2, 3.0


def section(y):
    top, bot, hw = catmull(FUSE, y)
    return top, bot, hw


def ring_point(y, top, bot, hw, phi):
    """phi 0 = top, pi/2 = right side, pi = bottom; a superellipse, rounder on top."""
    zc = (top + bot) / 2
    h = (top - bot) / 2
    s, c = math.sin(phi), math.cos(phi)
    n = N_TOP if c >= 0 else N_BOT
    x = hw * math.copysign(abs(s) ** (2 / n), s)
    z = zc + h * math.copysign(abs(c) ** (2 / n), c)
    return (x, y, z)


def edge_phi(hw):
    """The angle on the bottom where |x| = SLOT_X (the opening's edge)."""
    r = min(0.97, SLOT_X / max(hw, 1e-3))
    return math.pi - math.asin(r ** (N_BOT / 2))


def fuse_ring(y, inset=0.0):
    top, bot, hw = section(y)
    top, bot, hw = top - inset, bot + inset, max(0.02, hw - inset)
    pe = edge_phi(hw)
    pts = []
    for k in range(SIDE_N):                     # right side, top -> opening edge
        pts.append(ring_point(y, top, bot, hw, pe * k / SIDE_N))
    for k in range(BOT_N):                      # across the bottom, right -> left
        pts.append(ring_point(y, top, bot, hw, pe + (2 * math.pi - 2 * pe) * k / BOT_N))
    for k in range(SIDE_N):                     # left side, opening edge -> top
        pts.append(ring_point(y, top, bot, hw, (2 * math.pi - pe) + pe * k / SIDE_N))
    return pts


def fuse_axis(c):
    top, bot, hw = section(c.y)
    return (0, c.y, (top + bot) / 2)


def in_slot(i, j):
    """The bottom quads between the ramp's hinge and the door's hinge: the opening."""
    y0, y1 = FUSE_Y[i], FUSE_Y[i + 1]
    return y0 <= HINGE_Y + 1e-6 and y1 >= DOOR_Y - 1e-6 and SIDE_N <= j < SIDE_N + BOT_N


def build_fuselage(mat):
    rings = [fuse_ring(y) for y in FUSE_Y]
    hull = loft("fuse", rings, mat, fuse_axis, skip=in_slot)

    def colour(p, n):
        if p.y > 10.72 and p.z < 2.15:
            return BLACK                       # the radome
        if p.z < 0.2 and -6.2 < p.y < 9:
            return OLIVE_DK                    # the belly
        return OLIVE

    paint(hull, colour)
    return hull


def build_liner(mat):
    ys = [y for y in FUSE_Y if y <= 6.25]
    rings = [fuse_ring(y, 0.1) for y in ys]

    def skip(i, j):
        return ys[i] <= HINGE_Y + 1e-6 and ys[i + 1] >= DOOR_Y - 1e-6 and SIDE_N <= j < SIDE_N + BOT_N

    liner = loft("liner", rings, mat, fuse_axis, skip=skip, cap0=True, flip=True)
    floor = mesh_from("linerfloor", [(-1.55, 6.25, 0), (1.55, 6.25, 0), (1.55, HINGE_Y, 0), (-1.55, HINGE_Y, 0)],
                      [(0, 1, 2, 3)], mat, lambda c: (c.x, c.y, c.z - 1))
    o = join([liner, floor], "C130_Liner")
    paint(o, lambda p, n: (0x26, 0x29, 0x20) if p.z > 0.05 else DECK)
    return o


def surface_patch(name, mat, y0, y1, a0, a1, colour, lift=0.025, ny=4, na=4):
    """A pane laid on the fuselage between stations y0..y1 and ring angles a0..a1."""
    rings = []
    for iy in range(ny + 1):
        y = y0 + (y1 - y0) * iy / ny
        top, bot, hw = section(y)
        r = []
        for ia in range(na + 1):
            a = a0 + (a1 - a0) * ia / na
            x, yy, z = ring_point(y, top, bot, hw, a)
            zc = (top + bot) / 2
            d = Vector((x, 0, z - zc)).normalized()
            r.append((x + d.x * lift, yy, z + d.z * lift))
        rings.append(r)
    o = loft(name, rings, mat, fuse_axis, closed=False)
    paint(o, flat(colour))
    return o


def build_glazing(mat):
    mat = MATS["glass"]
    """The flight deck's windows: the windscreen, the side panes, the
    eyebrows over them and the chin windows by the nose gear."""
    p = []
    for a0, a1 in ((0.05, 0.40), (0.47, 0.86), (0.93, 1.22)):
        for s in (1, -1):
            lo, hi = (a0, a1) if s > 0 else (-a1, -a0)
            p.append(surface_patch("ws", mat, 10.62, 10.08, lo, hi, GLASS))
    for s in (1, -1):
        lo, hi = (0.22, 0.62) if s > 0 else (-0.62, -0.22)
        p.append(surface_patch("brow", mat, 9.98, 9.62, lo, hi, GLASS, ny=2, na=2))
        lo, hi = (2.05, 2.4) if s > 0 else (-2.4, -2.05)
        p.append(surface_patch("chin", mat, 10.85, 10.35, lo, hi, GLASS, ny=2, na=2))
        lo, hi = (1.28, 1.5) if s > 0 else (-1.5, -1.28)
        p.append(surface_patch("side", mat, 9.75, 9.2, lo, hi, GLASS, ny=2, na=2))
    # The round paratroop windows (the hold cuts its walls to match): one-sided
    # discs facing out, so from inside the hold you see through them.
    for y in WINDOWS_Y:
        for s in (1, -1):
            top, bot, hw = section(y)
            verts, faces = [], []
            c = (s * (hw + 0.02), y, WINDOW_Z)
            verts.append(c)
            for k in range(14):
                a = 2 * math.pi * k / 14
                verts.append((c[0], y + 0.22 * math.cos(a), WINDOW_Z + 0.22 * math.sin(a)))
            for k in range(14):
                faces.append((0, 1 + k, 1 + (k + 1) % 14))
            o = mesh_from("win", verts, faces, mat, lambda q, s=s: (q.x - s, q.y, q.z))
            paint(o, flat(GLASS))
            p.append(o)
    return p


# ==================================================================== wings

def airfoil(chord, t, camber=0.0, n=18):
    """Points round an airfoil (x along the chord 0..c from the leading edge,
    z up), starting at the trailing edge over the top."""
    pts = []
    xs = [0.5 * (1 - math.cos(math.pi * k / n)) for k in range(n + 1)]
    def yt(x):
        return 5 * t * (0.2969 * math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
    def yc(x):
        return camber * 4 * x * (1 - x)
    for x in reversed(xs):
        pts.append((x * chord, (yc(x) + yt(x)) * chord))
    for x in xs[1:-1]:
        pts.append((x * chord, (yc(x) - yt(x)) * chord))
    return pts


def build_wing(mat):
    """The high wing: a constant-chord centre section out past the outer
    engines, tapered outer panels with a little dihedral, rounded tips."""
    def plan(x):
        ax = abs(x)
        if ax <= 9.0:
            return 1.90, 4.90, 0.17, 3.86
        k = (ax - 9.0) / (20.15 - 9.0)
        le = 1.90 - 0.55 * k
        chord = 4.90 - 2.35 * k
        t = 0.17 - 0.05 * k
        z = 3.86 + (ax - 9.0) * math.tan(math.radians(2.5))
        return le, chord, t, z

    xs = [-20.2, -20.05, -19.6, -17, -14, -11.5, -9.0, -6, -3, 0, 3, 6, 9.0, 11.5, 14, 17, 19.6, 20.05, 20.2]
    rings = []
    for x in xs:
        le, chord, t, z = plan(x)
        tipk = 1.0
        if abs(x) > 19.6:
            tipk = 0.35 if abs(x) >= 20.2 else 0.72
        c = chord * (0.6 + 0.4 * tipk)
        lei = le - (chord - c) * 0.3
        ring = [(x, lei - u, z + v * tipk) for u, v in airfoil(c, t, 0.015)]
        rings.append(ring)

    def inside(c):
        x = c.x
        le, chord, t, z = plan(x)
        return (x, le - chord * 0.4, z)

    w = loft("wing", rings, mat, inside, cap0=True, cap1=True)

    def colour(p, n):
        le, chord, t, z = plan(p.x)
        if p.y > le - 0.32 and abs(p.x) > 2.3:
            return BOOT                        # the de-icing boots on the leading edge
        return OLIVE

    paint(w, colour)
    # the wing-to-body fairing over the fuselage
    fr = []
    for y in (2.2, 1.6, 0.4, -1.5, -3.0, -3.6):
        hw = 1.35 if -3.0 <= y <= 1.6 else 0.8
        r = []
        for k in range(12):
            a = math.pi * k / 11
            r.append((-hw * math.cos(a), y, 3.45 + 0.5 * math.sin(a)))
        fr.append(r)
    fair = loft("fair", fr, mat, lambda c: (0, c.y, 3.4), closed=False)
    paint(fair, flat(OLIVE))
    return [w, fair]


def build_tail(mat):
    parts = []
    # tailplane: root at the fuselage, a little taper and sweep on the leading edge
    xs = [-8.05, -7.9, -6, -3.5, -1.2, 0, 1.2, 3.5, 6, 7.9, 8.05]
    rings = []
    for x in xs:
        k = abs(x) / 8.05
        le = -14.55 - 1.45 * k
        chord = 3.75 - 1.9 * k
        tip = 0.5 if abs(x) >= 8.0 else 1.0
        rings.append([(x, le - u, 3.22 + v * tip) for u, v in airfoil(chord, 0.12)])
    tp = loft("tailplane", rings, mat, lambda c: (c.x, -14.55 - 1.45 * abs(c.x) / 8.05 - 1.2, 3.22), cap0=True, cap1=True)
    paint(tp, lambda p, n: BOOT if p.y > -14.85 - 1.45 * abs(p.x) / 8.05 and abs(p.x) > 1.2 else OLIVE)
    parts.append(tp)
    # fin: a tall swept leading edge, an almost upright rudder line
    zs = [3.1, 3.6, 5.0, 6.5, 8.0, 9.3, 9.62]
    rings = []
    for z in zs:
        k = (z - 3.4) / (9.6 - 3.4)
        le = -13.0 - 3.35 * max(0, k)
        te = -18.15 + 0.35 * max(0, k)
        chord = te - le if te - le > 0 else 0.3
        chord = abs(le - te)
        t = 0.13
        tip = 0.4 if z >= 9.6 else 1.0
        rings.append([(v * tip, le - u, z) for u, v in airfoil(chord, t)])
    fin = loft("fin", rings, mat, lambda c: (0, c.y, c.z), cap1=True)
    paint(fin, flat(OLIVE))
    parts.append(fin)
    # dorsal fillet: a thin ridge running forward from the fin along the spine
    rings = []
    for y, h, w in ((-8.6, 0.02, 0.05), (-10.0, 0.18, 0.18), (-11.6, 0.42, 0.26), (-13.2, 0.75, 0.34), (-14.2, 0.9, 0.36)):
        top = section(y)[0]
        rings.append([(-w, y, top - 0.15), (-w * 0.6, y, top + h * 0.8), (0, y, top + h), (w * 0.6, y, top + h * 0.8), (w, y, top - 0.15)])
    dor = loft("dorsal", rings, mat, lambda c: (0, c.y, section(c.y)[0] - 0.3), closed=False)
    paint(dor, flat(OLIVE))
    parts.append(dor)
    return parts


# ================================================================ nacelles

ENGINES = [(-9.85, 1), (-4.92, 2), (4.92, 3), (9.85, 4)]
HUB_Y = 4.25


def eng_z(x):
    ax = abs(x)
    return 3.70 + max(0, ax - 9.0) * math.tan(math.radians(2.5))


def build_nacelle(mat, x):
    zc = eng_z(x)
    # (y, top, bottom, half width) relative to the engine's line
    st = [(4.05, 0.42, -0.42, 0.44), (3.85, 0.52, -0.78, 0.6), (3.4, 0.6, -1.08, 0.68), (2.5, 0.62, -1.15, 0.7),
          (1.2, 0.62, -1.1, 0.68), (-0.6, 0.6, -0.95, 0.62), (-2.2, 0.52, -0.72, 0.52), (-3.6, 0.38, -0.42, 0.36),
          (-4.6, 0.18, -0.14, 0.12)]
    rings = []
    for y, t, b, hw in st:
        r = []
        for k in range(20):
            phi = 2 * math.pi * k / 20
            s, c = math.sin(phi), math.cos(phi)
            n = 2.3
            px = hw * math.copysign(abs(s) ** (2 / n), s)
            h = t if c >= 0 else -b
            pz = h * math.copysign(abs(c) ** (2 / n), c)
            r.append((x + px, y, zc + pz))
        rings.append(r)
    nac = loft("nacelle", rings, mat, lambda c: (x, c.y, zc - 0.2), cap0=True, cap1=True)
    paint(nac, lambda p, n: DARK if p.y > 3.95 and p.z < zc - 0.35 else OLIVE)
    parts = [nac]
    # the chin intake's mouth and the exhaust stub on the outboard flank
    verts = [(x - 0.42, 3.92, zc - 0.5), (x + 0.42, 3.92, zc - 0.5), (x + 0.36, 3.92, zc - 0.98), (x - 0.36, 3.92, zc - 0.98)]
    mouth = mesh_from("mouth", verts, [(0, 1, 2, 3)], mat, lambda c: (c.x, c.y - 1, c.z))
    paint(mouth, flat(BLACK))
    parts.append(mouth)
    sx = 1 if x > 0 else -1
    ex = []
    for y in (0.2, -0.9):
        r = []
        for k in range(8):
            a = 2 * math.pi * k / 8
            r.append((x + sx * 0.66 + 0.12 * math.cos(a), y, zc + 0.12 + 0.16 * math.sin(a)))
        ex.append(r)
    exh = loft("exh", ex, MATS["metal"], lambda c: (x + sx * 0.66, c.y, zc + 0.12), cap0=True)
    paint(exh, flat(DARK))
    parts.append(exh)
    return parts


def build_prop(mat, x, num):
    zc = eng_z(x)
    parts = []
    # the spinner
    rings = []
    for y, r in ((4.05, 0.43), (4.3, 0.45), (4.6, 0.38), (4.85, 0.24), (5.0, 0.1), (5.05, 0.01)):
        rings.append([(x + r * math.cos(2 * math.pi * k / 16), y, zc + r * math.sin(2 * math.pi * k / 16)) for k in range(16)])
    sp = loft("spinner", rings, MATS["metal"], lambda c: (x, c.y, zc), cap1=True)
    paint(sp, flat(DARK))
    parts.append(sp)
    # four broad paddle blades, twisted, with the yellow tips
    for b in range(4):
        base = 2 * math.pi * b / 4 + math.radians(20)
        rings = []
        for r, chord, twist in ((0.38, 0.22, 52), (0.6, 0.34, 44), (1.0, 0.38, 34), (1.5, 0.34, 24), (1.85, 0.27, 18), (2.0, 0.2, 16), (2.05, 0.08, 15)):
            tw = math.radians(twist)
            ring = []
            for k in range(8):
                a = 2 * math.pi * k / 8
                u = 0.5 * chord * math.cos(a)        # along the chord
                v = 0.03 * math.sin(a) * (chord / 0.38)   # thickness
                # blade frame: radial e_r, chord in the disc tangent turned by twist toward the axis
                cu, su = math.cos(tw), math.sin(tw)
                tang = (u * cu, -u * su)             # (tangential, axial)
                thick = (v * su, v * cu)
                t_ = tang[0] + thick[0]
                ax = tang[1] + thick[1]
                er = (math.cos(base), math.sin(base))
                et = (-math.sin(base), math.cos(base))
                px = x + er[0] * r + et[0] * t_
                pz = zc + er[1] * r + et[1] * t_
                ring.append((px, HUB_Y + ax, pz))
            rings.append(ring)
        bl = loft("blade", rings, MATS["blade"], lambda c, base=base: (x + math.cos(base) * (c - Vector((x, 0, zc))).length, HUB_Y, zc + math.sin(base) * (c - Vector((x, 0, zc))).length), cap1=True)

        def bc(p, n):
            rr = math.hypot(p.x - x, p.z - zc)
            return YELLOW if rr > 1.8 else BLACK

        paint(bl, bc)
        parts.append(bl)
    prop = join(parts, f"C130_Prop_{num}")
    finish(prop, bevel=0.006, angle=50)
    set_origin(prop, (x, HUB_Y, zc))
    return prop


def build_sponsons(mat):
    """The main-gear fairings bulging from the lower sides under the wing
    (their inner faces stay outside the hold's walls, |x| > 1.75)."""
    out = []
    for s in (1, -1):
        st = [(2.0, 0.06, 0.25), (1.5, 0.38, 0.72), (0.8, 0.52, 0.92), (-4.6, 0.52, 0.92), (-5.5, 0.4, 0.75), (-6.1, 0.08, 0.3)]
        rings = []
        for y, hw, hh in st:
            r = []
            for k in range(14):
                phi = 2 * math.pi * k / 14
                sn, c = math.sin(phi), math.cos(phi)
                px = hw * math.copysign(abs(sn) ** (2 / 2.6), sn)
                pz = hh * math.copysign(abs(c) ** (2 / 2.6), c)
                r.append((s * (2.27 + px), y, 0.42 + pz))
            rings.append(r)
        o = loft("sponson", rings, mat, lambda c, s=s: (s * 2.27, c.y, 0.42), cap0=True, cap1=True)
        paint(o, lambda p, n: OLIVE_DK if p.z < -0.1 else OLIVE)
        out.append(o)
    return out


def build_details(mat):
    out = []

    def blob(name, c, r, colour, seg=10):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=c, segments=seg, ring_count=6)
        o = bpy.context.view_layer.objects.active
        o.name = name
        o.data.materials.append(mat)
        paint(o, flat(colour))
        return o

    out.append(blob("navL", (-20.2, 0.6, 3.86 + 11.2 * math.tan(math.radians(2.5))), 0.11, RED))
    out.append(blob("navR", (20.2, 0.6, 3.86 + 11.2 * math.tan(math.radians(2.5))), 0.11, GREEN))
    out.append(blob("navT", (0, -15.85, 3.18), 0.09, WHITE))
    out.append(blob("beacon", (0, 1.2, 4.42), 0.14, RED))
    out.append(blob("beaconB", (0, -3.0, -0.72), 0.12, RED))
    # the paratroop doors' outlines, aft of the gear fairings: a dark frame each side
    for s in (1, -1):
        out.append(surface_patch("pdoor", mat, -4.9, -5.95, s * 1.42 - 0.12, s * 1.42 + 0.12, OLIVE_DK, lift=0.012, ny=2, na=2) if s > 0 else
                   surface_patch("pdoor", mat, -4.9, -5.95, -1.54, -1.30, OLIVE_DK, lift=0.012, ny=2, na=2))
    # the crew door, front left
    out.append(surface_patch("cdoor", mat, 8.4, 7.4, -2.0, -1.62, OLIVE_DK, lift=0.012, ny=2, na=2))
    return out


# ==================================================================== seams

SEAM = (0x33, 0x38, 0x27)


def build_seams(mat):
    """Panel joints as real strips standing a few mm proud of the skin: the
    circumferential frames, the ramp and door outlines, a stringer line.
    Cut geometry, not paint, so they stay crisp at any distance."""
    out = []
    for y in (8.25, 6.25, 4.6, 2.9, 1.1, -0.6, -2.3, -4.0, -6.0):
        pe = edge_phi(section(y)[2])
        out.append(surface_patch("seam", mat, y + 0.018, y - 0.018, -pe + 0.02, pe - 0.02, SEAM, lift=0.006, ny=1, na=40))
    # the outline of the opening under the tail (ramp and door edges, both sides)
    for s in (1, -1):
        ys = [HINGE_Y - k * (HINGE_Y - DOOR_Y) / 14 for k in range(15)]
        for y0, y1 in zip(ys, ys[1:]):
            pe0 = edge_phi(section(y0)[2])
            a = s * (pe0 - 0.035)
            out.append(surface_patch("seam", mat, y0, y1, a - 0.03, a + 0.03, SEAM, lift=0.007, ny=1, na=1))
    # the ramp/door split line across the bottom
    y = HINGE_Y - RAMP_LEN * math.cos(RAMP_SHUT)
    pe = edge_phi(section(y)[2])
    out.append(surface_patch("seam", mat, y + 0.02, y - 0.02, pe, 2 * math.pi - pe, SEAM, lift=0.03, ny=1, na=8))
    # a stringer line along each flank above the windows
    for s in (1, -1):
        a = s * 1.12
        out.append(surface_patch("seam", mat, 8.0, -6.0, a - 0.008, a + 0.008, SEAM, lift=0.006, ny=10, na=1))
    return out


def wing_surface(x, frac, upper=True):
    """A point on the wing skin at span x, chord fraction frac."""
    ax = abs(x)
    if ax <= 9.0:
        le, chord, t, z = 1.90, 4.90, 0.17, 3.86
    else:
        k = (ax - 9.0) / (20.15 - 9.0)
        le, chord, t, z = 1.90 - 0.55 * k, 4.90 - 2.35 * k, 0.17 - 0.05 * k, 3.86 + (ax - 9.0) * math.tan(math.radians(2.5))
    u = frac
    yt = 5 * t * (0.2969 * math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4)
    yc = 0.015 * 4 * u * (1 - u)
    return (x, le - u * chord, z + (yc + yt if upper else yc - yt) * chord)


def build_wing_lines(mat):
    """The flap and aileron hinge lines and their end cuts, upper and lower."""
    out = []
    spans = [(2.4, 9.0, 0.70), (9.2, 14.4, 0.72), (14.6, 19.4, 0.74)]   # inner flap, outer flap, aileron
    for s in (1, -1):
        for x0, x1, f in spans:
            for upper in (True, False):
                lift = 0.012 if upper else -0.012
                verts, faces = [], []
                n = 6
                for k in range(n + 1):
                    x = s * (x0 + (x1 - x0) * k / n)
                    a = wing_surface(x, f - 0.004, upper)
                    b = wing_surface(x, f + 0.004, upper)
                    verts += [(a[0], a[1], a[2] + lift), (b[0], b[1], b[2] + lift)]
                for k in range(n):
                    faces.append((2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2))
                for x in (x0, x1):
                    xx = s * x
                    m = len(verts)
                    for kk in range(4):
                        ff = f + (1 - f) * kk / 3
                        p = wing_surface(xx, min(0.995, ff), upper)
                        verts += [(p[0] - 0.012, p[1], p[2] + lift), (p[0] + 0.012, p[1], p[2] + lift)]
                    for kk in range(3):
                        faces.append((m + 2 * kk, m + 2 * kk + 1, m + 2 * kk + 3, m + 2 * kk + 2))
                o = mesh_from("flap", verts, faces, mat, (lambda c, up=upper: (c.x, c.y, c.z - (1 if up else -1))))
                paint(o, flat(SEAM))
                out.append(o)
    return out


# ================================================================ ramp, door

def build_ramp(mat):
    """Built lowered (level with the floor, hinge at y HINGE_Y z 0), then
    turned shut."""
    y0, y1 = HINGE_Y, HINGE_Y - RAMP_LEN
    w = SLOT_X - 0.04
    verts = [(-w, y0, 0), (w, y0, 0), (w, y1, 0), (-w, y1, 0),
             (-w, y0, -0.62), (w, y0, -0.62), (w, y1, -0.12), (-w, y1, -0.12)]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    o = mesh_from("C130_Ramp", verts, faces, mat, lambda c: (0, (y0 + y1) / 2, -0.3))
    # ribs on the deck so it reads as a ramp, toe plates at the end
    ribs = []
    for k in range(6):
        y = y0 - 0.3 - k * 0.5
        rv = [(-w + 0.1, y, 0), (w - 0.1, y, 0), (w - 0.1, y - 0.06, 0), (-w + 0.1, y - 0.06, 0),
              (-w + 0.1, y, 0.03), (w - 0.1, y, 0.03), (w - 0.1, y - 0.06, 0.03), (-w + 0.1, y - 0.06, 0.03)]
        rf = [(4, 5, 6, 7), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
        ribs.append(mesh_from("rib", rv, rf, mat, lambda c, y=y: (0, y - 0.03, -0.1)))
    o = join([o, *ribs], "C130_Ramp")

    def colour(p, n):
        return DECK if n.z > 0.5 else OLIVE_DK
    paint(o, colour)
    set_origin(o, (0, HINGE_Y, 0))
    finish(o, bevel=0.012)
    o.rotation_euler = (RAMP_SHUT, 0, 0)
    return o


def build_door(mat):
    """The upper door: the fuselage's bottom between the shut ramp's end and
    the door hinge, given some thickness, hinged at its aft top edge."""
    y_end = HINGE_Y - RAMP_LEN * math.cos(RAMP_SHUT)
    rings = []
    ny = 5
    for iy in range(ny + 1):
        y = y_end + (DOOR_Y - y_end) * iy / ny
        top, bot, hw = section(y)
        pe = edge_phi(hw)
        r = []
        for k in range(BOT_N + 1):
            x, yy, z = ring_point(y, top, bot, hw, pe + (2 * math.pi - 2 * pe) * k / BOT_N)
            r.append((x, yy, z - 0.01))
        rings.append(r)
    o = loft("C130_Door", rings, mat, lambda c: (0, c.y, c.z + 1), closed=False)
    select_only(o)
    sol = o.modifiers.new("sol", "SOLIDIFY")
    sol.thickness = 0.08
    sol.offset = 1.0
    bpy.ops.object.modifier_apply(modifier=sol.name)
    paint(o, lambda p, n: OLIVE_DK if n.z < 0 else (0x2a, 0x2d, 0x24))
    finish(o, bevel=0.01)
    top, bot, hw = section(DOOR_Y)
    set_origin(o, (0, DOOR_Y, bot + 0.04))
    return o


# =================================================================== build

def build():
    clear_scene()
    paintm = material("C130_Paint", rough=0.72, metal=0.12)
    linerm = material("C130_Liner", rough=0.9, metal=0.0)
    MATS["glass"] = material("C130_Glass", rough=0.06, metal=0.35)
    MATS["metal"] = material("C130_Metal", rough=0.38, metal=0.8)
    MATS["blade"] = material("C130_Blade", rough=0.88, metal=0.0)
    parts = [build_fuselage(paintm)]
    parts += build_glazing(paintm)
    parts += build_wing(paintm)
    parts += build_tail(paintm)
    parts += build_sponsons(paintm)
    parts += build_details(paintm)
    parts += build_seams(paintm)
    parts += build_wing_lines(paintm)
    props = []
    for x, num in ENGINES:
        parts += build_nacelle(paintm, x)
        props.append(build_prop(paintm, x, num))
    hull = join(parts, "C130_Hull")
    finish(hull)
    set_origin(hull, (0, 0, 0))
    liner = build_liner(linerm)
    ramp = build_ramp(paintm)
    door = build_door(paintm)
    for c in (liner, ramp, door, *props):
        parent(c, hull)
    select_only(hull, *hull.children_recursive)
    path = os.path.join(HERE, "c130.glb")
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_yup=True, export_apply=True)
    tris = 0
    for o in [hull, *hull.children_recursive]:
        if o.type == "MESH":
            tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    print("Exported", path, "tris", tris)


if __name__ == "__main__":
    build()
    print("C130 DONE")
