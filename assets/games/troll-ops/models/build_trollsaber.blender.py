"""
Trollsaber, the detailed hilt (gear.js MELEE_DEFS id `trollsaber`).

    blender --background --python build_trollsaber.blender.py            # export .glb
    blender --background --python build_trollsaber.blender.py -- render  # + studio renders

Game coordinates like the other builds (x right, y up, blade out along -z,
metres, origin at the grip). The blade is NOT in here: weapon code builds it
live (trollsaber.js) so it can ignite, flicker and trail. Render mode adds
a stand-in blade so the studio shots read.

Darth Vader's ESB/ROTJ hilt (the MPP flash prop), proportions read off a
side-on reference: chrome ribbed end cap, six black T-track grips, the black
clamp with its screw and calculator bubble strip, the chrome body with the
black top plate, red pill activator, amber slot window, pin hole and screws,
then the black crinkle-finish shroud collar with the knurled thumb screw and
the hood cut away on the slant. No text anywhere on it (user call).

Nodes the game reads (trollsaber.js):
  TS_Hilt                      the whole hilt (one mesh, one primitive per material)
  TS_Grip / TS_Support / TS_Emitter   empties (hands, blade root)
Materials tuned by name in the game: TS_Button, TS_Amber.
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Matrix, Vector

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_GLB = os.path.join(OUT_DIR, "trollsaber.glb")
RENDER = "render" in sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else False
RENDER_DIR = os.environ.get("TS_RENDER_DIR", os.path.join(OUT_DIR, "_renders"))
TAU = math.tau
RX = Matrix.Rotation(math.radians(90), 4, "X")   # game (y up) -> Blender (z up)

# ------------------------------------------------------------------ scene

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def hexlin(h):
    out = []
    for s in (16, 8, 0):
        v = ((h >> s) & 255) / 255
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def material(name, color, rough=0.5, metal=0.0, emit=None, emit_strength=0.0, alpha=1.0, trans=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*hexlin(color), 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit is not None:
        b.inputs["Emission Color"].default_value = (*hexlin(emit), 1.0)
        b.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED" if hasattr(m, "surface_render_method") else m.surface_render_method
    if trans > 0:
        b.inputs["Transmission Weight"].default_value = trans
    return m



M = {
    "steel":   material("TS_Chrome", 0xd3d8dd, 0.12, 1.0),
    "steelD":  material("TS_Steel", 0x8d9399, 0.3, 1.0),
    "grip":    material("TS_Grip", 0x0d0d0e, 0.55, 0.1),
    "clamp":   material("TS_Clamp", 0x111213, 0.3, 0.4),
    "shroud":  material("TS_Shroud", 0x161617, 0.88, 0.1),
    "dark":    material("TS_Dark", 0x070707, 0.6, 0.2),
    "bubble":  material("TS_Bubble", 0x1a1a1c, 0.08, 0.0),
    "button":  material("TS_Button", 0xc0181c, 0.28, 0.0, 0xff2a18, 0.4),
    "amber":   material("TS_Amber", 0xd7801c, 0.3, 0.0, 0xff8a20, 0.6),
}
MAT_ORDER = list(M.keys())




# ------------------------------------------------------------------ bmesh helpers
# A Part collects bmesh geometry in game coords with a material index per
# face, then becomes one Blender object.

class Part:
    def __init__(self, name, pivot=(0, 0, 0)):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.pivot = Vector(pivot)
        self.mats = []
        self.bevel = []   # (vert set) groups that get a modifier bevel

    def mi(self, key):
        mat = M[key]
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def face(self, verts, key, uvs=None):
        f = self.bm.faces.new(verts)
        f.material_index = self.mi(key)
        f.smooth = True
        if uvs:
            for loop, uv in zip(f.loops, uvs):
                loop[self.uv].uv = uv
        return f

    def v(self, p):
        return self.bm.verts.new(p)

    def finish(self, parent=None, smooth_angle=34, bevel=0.0, bevel_segs=2):
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for vert in bm.verts:
            vert.co = (RX @ (vert.co - self.pivot).to_4d()).to_3d()
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me)
        scene.collection.objects.link(ob)
        ob.location = (RX @ self.pivot.to_4d()).to_3d()
        if parent:
            ob.parent = parent
            ob.matrix_parent_inverse = parent.matrix_world.inverted()
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        if bevel > 0:
            bv = ob.modifiers.new("bevel", "BEVEL")
            bv.width = bevel
            bv.segments = bevel_segs
            bv.limit_method = "ANGLE"
            bv.angle_limit = math.radians(40)
            bv.harden_normals = True
            bv.miter_outer = "MITER_ARC"
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle), keep_sharp_edges=True)
        wn = ob.modifiers.new("wn", "WEIGHTED_NORMAL")
        wn.keep_sharp = True
        ob.select_set(False)
        return ob


def ring_pts(cx, cy, z, r, segs, a0=0.0, a1=TAU, closed=True, squash=1.0):
    n = segs if closed else segs + 1
    out = []
    for k in range(n):
        a = a0 + (a1 - a0) * k / segs
        out.append((cx + r * math.cos(a), cy + r * math.sin(a) * squash, z))
    return out


def lathe(P, prof, key, segs=48, cx=0.0, cy=0.0, squash=1.0):
    """prof: [(z, r, key?)...] rear to front. A point with r == 0 closes the
    end. Per-band material: a third item on the band's first point."""
    rings = []
    for pt in prof:
        z, r = pt[0], pt[1]
        if r <= 1e-7:
            rings.append([P.v((cx, cy, z))])
        else:
            rings.append([P.v(p) for p in ring_pts(cx, cy, z, r, segs, squash=squash)])
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        k = prof[i][2] if len(prof[i]) > 2 else key
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for j in range(segs):
                P.face([a[0], b[(j + 1) % segs], b[j]], k)
        elif len(b) == 1:
            for j in range(segs):
                P.face([a[j], a[(j + 1) % segs], b[0]], k)
        else:
            for j in range(segs):
                P.face([a[j], a[(j + 1) % segs], b[(j + 1) % segs], b[j]], k)
    # open ends get a cap
    for ring, pt in ((rings[0], prof[0]), (rings[-1], prof[-1])):
        if len(ring) > 1:
            P.face(ring, pt[2] if len(pt) > 2 else key)
    return rings


def grid_solid(P, outer, inner, key, close_u=False):
    """Two matching grids of points (rows x cols) -> a closed solid shell."""
    O = [[P.v(p) for p in row] for row in outer]
    I = [[P.v(p) for p in row] for row in inner]
    rows, cols = len(O), len(O[0])
    cu = cols if close_u else cols - 1
    for i in range(rows - 1):
        for j in range(cu):
            j2 = (j + 1) % cols
            P.face([O[i][j], O[i][j2], O[i + 1][j2], O[i + 1][j]], key)
            P.face([I[i][j], I[i + 1][j], I[i + 1][j2], I[i][j2]], key)
    for j in range(cu):
        j2 = (j + 1) % cols
        P.face([O[0][j], I[0][j], I[0][j2], O[0][j2]], key)
        P.face([O[-1][j], O[-1][j2], I[-1][j2], I[-1][j]], key)
    if not close_u:
        for i in range(rows - 1):
            P.face([O[i][0], O[i + 1][0], I[i + 1][0], I[i][0]], key)
            P.face([O[i][-1], I[i][-1], I[i + 1][-1], O[i + 1][-1]], key)


def box(P, center, size, key, basis=None):
    """Axis box in a local basis (ex, ey, ez game vectors) around center."""
    ex, ey, ez = basis or (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
    c = Vector(center)
    hx, hy, hz = (s / 2 for s in size)
    vs = []
    for sx, sy, sz in ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                       (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)):
        vs.append(P.v(c + ex * (sx * hx) + ey * (sy * hy) + ez * (sz * hz)))
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (0, 4, 7, 3)):
        P.face([vs[i] for i in f], key)


def frame_from_normal(n, up=Vector((0, 1, 0))):
    """Basis whose local +y is the normal n (a part standing on a surface)."""
    n = Vector(n).normalized()
    t = up.cross(n) if abs(n.dot(up)) < 0.95 else Vector((1, 0, 0)).cross(n)
    t.normalize()
    b = n.cross(t).normalized()
    return t, n, b


def local_lathe(P, origin, normal, prof, key, segs=16, spin=0.0):
    """A lathe standing on a surface: prof is [(h, r)], h along the normal."""
    t, n, b = frame_from_normal(normal)
    o = Vector(origin)
    rings = []
    for pt in prof:
        h, r = pt[0], pt[1]
        c = o + n * h
        if r <= 1e-7:
            rings.append([P.v(c)])
        else:
            rings.append([P.v(c + t * (r * math.cos(spin + TAU * k / segs)) + b * (r * math.sin(spin + TAU * k / segs)))
                          for k in range(segs)])
    for i in range(len(rings) - 1):
        a, bb = rings[i], rings[i + 1]
        k = prof[i][2] if len(prof[i]) > 2 else key
        if len(a) == 1:
            for j in range(segs):
                P.face([a[0], bb[j], bb[(j + 1) % segs]], k)
        elif len(bb) == 1:
            for j in range(segs):
                P.face([a[j], bb[0], a[(j + 1) % segs]], k)
        else:
            for j in range(segs):
                P.face([a[j], bb[j], bb[(j + 1) % segs], a[(j + 1) % segs]], k)
    for ring, pt in ((rings[0], prof[0]), (rings[-1], prof[-1])):
        if len(ring) > 1:
            P.face(list(reversed(ring)) if ring is rings[0] else ring, pt[2] if len(pt) > 2 else key)


def screw(P, pos, normal, r=0.0034, key="steel"):
    """Socket-head cap screw: domed head with a dark hex socket."""
    local_lathe(P, pos, normal, [(-0.001, r * 1.05), (0.0004, r), (0.0011, r * 0.93), (0.0016, r * 0.7), (0.0018, 0.0)], key, segs=14)
    t, n, b = frame_from_normal(normal)
    c = Vector(pos) + n * 0.00172
    hexr = r * 0.42
    ring = [P.v(c + t * (hexr * math.cos(TAU * k / 6 + 0.3)) + b * (hexr * math.sin(TAU * k / 6 + 0.3))) for k in range(6)]
    P.face(ring, "dark")


def catmull(points, n):
    """Catmull-Rom through points, n samples."""
    pts = [Vector(p) for p in points]
    pts = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    segs = len(points) - 1
    for i in range(n):
        u = i / (n - 1) * segs
        s = min(int(u), segs - 1)
        t = u - s
        p0, p1, p2, p3 = pts[s], pts[s + 1], pts[s + 2], pts[s + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
    return out


def sweep(P, path, radius_fn, key, sides=12, uv=True):
    """Tube along a sampled path (parallel-transport frames), radius_fn(s01).
    uv.x = arc length 0..1 (the hose pulse runs along it)."""
    n = len(path)
    lens = [0.0]
    for i in range(1, n):
        lens.append(lens[-1] + (path[i] - path[i - 1]).length)
    L = lens[-1]
    tan0 = (path[1] - path[0]).normalized()
    ref = Vector((0, 1, 0)) if abs(tan0.y) < 0.9 else Vector((1, 0, 0))
    nrm = tan0.cross(ref).normalized()
    rings = []
    prev_t = tan0
    for i in range(n):
        t = (path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized()
        axis = prev_t.cross(t)
        if axis.length > 1e-8:
            ang = prev_t.angle(t)
            nrm = (Matrix.Rotation(ang, 3, axis.normalized()) @ nrm).normalized()
        prev_t = t
        bn = t.cross(nrm).normalized()
        r = radius_fn(lens[i] / L)
        rings.append([P.v(path[i] + nrm * (r * math.cos(TAU * k / sides)) + bn * (r * math.sin(TAU * k / sides)))
                      for k in range(sides)])
    for i in range(n - 1):
        u0, u1 = lens[i] / L, lens[i + 1] / L
        for k in range(sides):
            k2 = (k + 1) % sides
            P.face([rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]], key,
                   [(u0, k / sides), (u0, (k + 1) / sides), (u1, (k + 1) / sides), (u1, k / sides)] if uv else None)
    P.face(list(reversed(rings[0])), key, [(0.0, 0.5)] * sides if uv else None)
    P.face(rings[-1], key, [(1.0, 0.5)] * sides if uv else None)
    return lens


def loft(P, sections, key):
    """Closed solid through a list of equal-length point loops, capped."""
    rings = [[P.v(p) for p in sec] for sec in sections]
    n = len(rings[0])
    for i in range(len(rings) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            P.face([rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]], key)
    P.face(list(reversed(rings[0])), key)
    P.face(rings[-1], key)


def superellipse(cx, cz, y, hw, hd, n=24, p=3.2, front_bulge=0.0):
    out = []
    for k in range(n):
        a = TAU * k / n
        c, s = math.cos(a), math.sin(a)
        x = hw * math.copysign(abs(c) ** (2 / p), c)
        z = hd * math.copysign(abs(s) ** (2 / p), s)
        if s < 0:
            z -= front_bulge * abs(s)
        out.append((cx + x, y, cz + z))
    return out


# ------------------------------------------------------------------ dimensions (game coords)
# Axis along z. Everything is placed by S = distance from the pommel face
# (the real hilt is ~30 cm; proportions read off a side-on reference of the
# ESB/ROTJ prop), converted with gz(). The hand sits on the grips.
Z0 = 0.130


def gz(s):
    return Z0 - s


R_BODY = 0.0175          # chrome MPP body
R_CLAMP = 0.0205
R_SHROUD = 0.0226
S_GRIP0, S_GRIP1 = 0.007, 0.111
S_CLAMP0, S_CLAMP1 = 0.111, 0.154
S_BLOCK0, S_BLOCK1 = 0.2475, 0.2615
S_TIP = 0.300
S_EMIT = 0.272
EMIT_Z = gz(S_EMIT)

hilt = Part("TS_Hilt")

# Main body of revolution: chrome end cap, ribbed pommel, the long chrome
# tube under the grips/clamp/controls. (Profile runs pommel -> emitter.)
prof = [
    (gz(0.0000), 0.0, "steel"),
    (gz(0.0000), 0.0120, "steel"),
    (gz(0.0006), 0.0158, "steel"),
    (gz(0.0020), 0.0174, "steel"),
    (gz(0.0048), 0.0176, "steel"),
    (gz(0.0060), 0.0168, "steel"),
]
# ribbed chrome under the rear of the grips
s = 0.0065
for i in range(7):
    prof += [(gz(s), 0.0170, "steel"), (gz(s + 0.0012), 0.0158, "steelD"), (gz(s + 0.0018), 0.0158, "steel"), (gz(s + 0.0022), 0.0170, "steel")]
    s += 0.0024
prof += [
    (gz(s + 0.0005), R_BODY - 0.0006, "steel"),
    (gz(S_BLOCK0 + 0.002), R_BODY - 0.0006, "steel"),
]
lathe(hilt, prof, "steel", segs=64)

# Pommel face: concentric rings on the end cap.
for r0 in (0.0035, 0.0068, 0.0100):
    local_lathe(hilt, (0, 0, gz(0.0) + 0.0001), (0, 0, 1),
                [(0, r0 + 0.0009), (0.0003, r0 + 0.0006), (0.0003, r0 - 0.0006), (0, r0 - 0.0009)], "steelD", segs=48)

# Six black grips (T-track), wide bars with narrow chrome gaps, screwed at
# the ends.
NGRIP = 6
for k in range(NGRIP):
    a = TAU * k / NGRIP + TAU / 12
    rad = Vector((math.cos(a), math.sin(a), 0))
    tan = Vector((-math.sin(a), math.cos(a), 0))
    ax = Vector((0, 0, 1))
    zc = gz((S_GRIP0 + S_GRIP1) / 2)
    ln = S_GRIP1 - S_GRIP0
    w = 2 * R_BODY * math.sin(TAU / NGRIP / 2) * 0.66
    box(hilt, rad * (R_BODY + 0.0010) + Vector((0, 0, zc)), (w * 0.55, 0.0024, ln), "grip", (tan, rad, ax))      # T stem
    box(hilt, rad * (R_BODY + 0.0030) + Vector((0, 0, zc)), (w, 0.0018, ln), "grip", (tan, rad, ax))             # T face
    for sz in (S_GRIP0 + 0.004, S_GRIP1 - 0.004):
        screw(hilt, rad * (R_BODY + 0.0039) + Vector((0, 0, gz(sz))), rad, r=0.0011, key="steel")

# Clamp: black ring with lip grooves, the bar underneath with its screw and
# the calculator bubble strip along the bottom.
lathe(hilt, [
    (gz(S_CLAMP0), R_BODY - 0.0004, "clamp"),
    (gz(S_CLAMP0), R_CLAMP - 0.0006, "clamp"),
    (gz(S_CLAMP0 + 0.0008), R_CLAMP, "clamp"),
    (gz(S_CLAMP1 - 0.0008), R_CLAMP, "clamp"),
    (gz(S_CLAMP1), R_CLAMP - 0.0006, "clamp"),
    (gz(S_CLAMP1), R_BODY - 0.0004, "clamp"),
], "clamp", segs=64)
for sg in (S_CLAMP0 + 0.004, S_CLAMP1 - 0.004):
    lathe(hilt, [(gz(sg) + 0.0005, R_CLAMP + 0.0001), (gz(sg) + 0.0003, R_CLAMP - 0.0005),
                 (gz(sg) - 0.0003, R_CLAMP - 0.0005), (gz(sg) - 0.0005, R_CLAMP + 0.0001)], "dark", segs=64)
zc = gz((S_CLAMP0 + S_CLAMP1) / 2)
cl = S_CLAMP1 - S_CLAMP0 - 0.004
box(hilt, (0, -0.0205, zc), (0.0150, 0.0070, cl), "clamp")                  # clamp jaw bar
box(hilt, (0, -0.0262, zc), (0.0130, 0.0050, cl - 0.001), "clamp")          # tapered bar
for sx in (-1, 1):
    box(hilt, (sx * 0.0072, -0.0240, zc), (0.0010, 0.0080, cl - 0.004), "dark")
screw(hilt, (0.0076, -0.0240, zc), (1, 0, 0), r=0.0034, key="steel")        # clamp screw (camera side)
screw(hilt, (-0.0076, -0.0240, zc), (-1, 0, 0), r=0.0024, key="steelD")
# bubble strip: six clear domes under the bar
for i in range(6):
    sz = S_CLAMP0 + 0.0055 + i * (cl - 0.006) / 5
    local_lathe(hilt, (0, -0.0287, gz(sz)), (0, -1, 0),
                [(0, 0.0026), (0.0010, 0.0025), (0.0019, 0.0017), (0.0024, 0.0)], "bubble", segs=16)

# Chrome body controls. The top plate (black, rounded rear) with its small
# knob; the red pill button and the amber slot window on the right side; a
# pin hole and a slot screw.
S_PLATE0, S_PLATE1 = 0.2065, 0.2470
pl = S_PLATE1 - S_PLATE0
box(hilt, (0, R_BODY + 0.0012, gz((S_PLATE0 + S_PLATE1) / 2)), (0.0110, 0.0034, pl), "clamp")
local_lathe(hilt, (0, R_BODY - 0.0005, gz(S_PLATE0)), (0, 1, 0),
            [(0, 0.0055), (0.0034, 0.0055), (0.0034, 0.0)], "clamp", segs=20)          # rounded rear end
local_lathe(hilt, (0, R_BODY + 0.0029, gz(0.2145)), (0, 1, 0),
            [(0, 0.0034), (0.0012, 0.0033), (0.0016, 0.0026), (0.0016, 0.0)], "dark", segs=20)   # plate knob


def pill(P, s0, s1, ang, width, lift, key, depth=0.0012):
    """A rounded-end pill laid on the body at angle `ang` (radians from +x
    toward +y), running from s0 to s1."""
    rad = Vector((math.cos(ang), math.sin(ang), 0))
    tan = Vector((-math.sin(ang), math.cos(ang), 0))
    rr = width / 2
    ring = []
    n = 10
    for i in range(n + 1):                            # front semicircle (toward -z)
        t = math.pi / 2 - math.pi * i / n
        ring.append((gz(s1 - rr) - rr * math.cos(t), rr * math.sin(t)))
    for i in range(n + 1):                            # rear semicircle
        t = -math.pi / 2 - math.pi * i / n
        ring.append((gz(s0 + rr) - rr * math.cos(t), rr * math.sin(t)))
    base = R_BODY - 0.0004
    bottom = [P.v(rad * base + tan * y + Vector((0, 0, z))) for z, y in ring]
    top = [P.v(rad * (base + lift) + tan * y * 0.92 + Vector((0, 0, z))) for z, y in ring]
    m = len(ring)
    for i in range(m):
        j = (i + 1) % m
        P.face([bottom[i], bottom[j], top[j], top[i]], key)
    P.face(list(reversed(top)), key)


BTN_A = math.radians(24)
SLOT_A = math.radians(-20)
pill(hilt, 0.2180, 0.2285, BTN_A, 0.0052, 0.0020, "button")              # red activator
pill(hilt, 0.2170, 0.2330, SLOT_A, 0.0070, 0.0007, "clamp")              # slot surround
pill(hilt, 0.2185, 0.2315, SLOT_A, 0.0032, 0.0011, "amber")              # amber window
local_lathe(hilt, (math.cos(0.0) * (R_BODY - 0.0004), 0, gz(0.2110)), (1, 0, 0),
            [(0, 0.0007), (0.0004, 0.0007), (0.0004, 0.0)], "dark", segs=10)        # pin hole
screw(hilt, (R_BODY - 0.0002, 0.0, gz(0.2450)), (1, 0, 0), r=0.0022, key="steel")    # slot screw
screw(hilt, (-(R_BODY - 0.0002), 0.0, gz(0.2300)), (-1, 0, 0), r=0.0020, key="steel")

# The shroud: a black crinkle-finish collar round the bulb holder, and the
# hood that runs forward over the top and is cut away on the slant.
lathe(hilt, [
    (gz(S_BLOCK0), R_BODY - 0.0004, "shroud"),
    (gz(S_BLOCK0), R_SHROUD - 0.0004, "shroud"),
    (gz(S_BLOCK0 + 0.0006), R_SHROUD, "shroud"),
    (gz(S_BLOCK1), R_SHROUD, "shroud"),
    (gz(S_BLOCK1), 0.0140, "shroud"),
], "shroud", segs=64)

R_IN = R_SHROUD - 0.0026
Y_LOW = -0.0190          # the cut starts this low at the collar
Y_HIGH = R_SHROUD - 0.0020   # and ends near the top at the tip


def s_cut(y):
    t = (y - Y_LOW) / (Y_HIGH - Y_LOW)
    return S_BLOCK1 + max(0.0, min(1.0, t)) * (S_TIP - S_BLOCK1)


a_min = math.asin(max(-1.0, (Y_LOW + 0.0004) / R_SHROUD))
a0, a1 = a_min, math.pi - a_min
cols = 56
rows = 14
outer, inner = [], []
for i in range(rows + 1):
    t = i / rows
    ro, ri = [], []
    for j in range(cols + 1):
        a = a0 + (a1 - a0) * j / cols
        yo = R_SHROUD * math.sin(a)
        so = S_BLOCK1 + t * (s_cut(yo) - S_BLOCK1)
        ro.append((R_SHROUD * math.cos(a), yo, gz(so)))
        yi = R_IN * math.sin(a)
        si = S_BLOCK1 + t * (s_cut(yo) - S_BLOCK1)
        ri.append((R_IN * math.cos(a), yi, gz(si)))
    outer.append(ro)
    inner.append(ri)
grid_solid(hilt, outer, inner, "shroud")

# Bulb holder inside the hood: rounded black cap with a chrome rim.
local_lathe(hilt, (0, 0, gz(S_BLOCK1)), (0, 0, -1),
            [(0, 0.0142), (0.0030, 0.0142, "steelD"), (0.0036, 0.0132), (0.0060, 0.0120, "clamp"),
             (0.0085, 0.0098), (0.0102, 0.0060), (0.0108, 0.0)], "steelD", segs=48)

# Thumb screw on the hood top (knurled chrome knob on a stem) and the flat
# chrome bolt where the shroud meets the body.
top_y = R_SHROUD
local_lathe(hilt, (0, top_y - 0.0006, gz(0.2665)), (0, 1, 0),
            [(0, 0.0022), (0.0030, 0.0022), (0.0030, 0.0046), (0.0036, 0.0050), (0.0072, 0.0050),
             (0.0078, 0.0044), (0.0080, 0.0)], "steel", segs=40)
for k in range(24):   # knurl ridges
    a = TAU * k / 24
    rad = Vector((math.cos(a), 0, math.sin(a)))
    box(hilt, Vector((0, top_y + 0.0048, gz(0.2665))) + rad * 0.0050,
        (0.0009, 0.0034, 0.0006), "steelD", (Vector((-math.sin(a), 0, math.cos(a))), Vector((0, 1, 0)), rad))
local_lathe(hilt, (0, R_BODY + 0.0028, gz(0.2445)), (0, 1, 0),
            [(0, 0.0046), (0.0008, 0.0046), (0.0016, 0.0036), (0.0018, 0.0)], "steel", segs=32)
box(hilt, (0, R_BODY + 0.0046, gz(0.2445)), (0.0060, 0.0005, 0.0009), "dark")          # bolt slot
# tab the thumb screw clamps through
box(hilt, (0, top_y + 0.0003, gz(0.2640)), (0.0110, 0.0012, 0.0120), "steel")

hilt_ob = hilt.finish(bevel=0.00035)

# ------------------------------------------------------------------ anchors


def empty(name, pos, parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.01
    e.location = (RX @ Vector(pos).to_4d()).to_3d()
    scene.collection.objects.link(e)
    return e


empty("TS_Grip", (0, 0, gz(0.080)))
empty("TS_Support", (0, 0, gz(0.022)))
empty("TS_Emitter", (0, 0, EMIT_Z))

# ------------------------------------------------------------------ export

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", use_selection=False, export_apply=True,
                          export_yup=True, export_extras=False)
tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for ob in scene.objects:
    if ob.type == "MESH":
        me = ob.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        print(f"  {ob.name}: {len(me.loop_triangles)} tris")
        ob.evaluated_get(dg).to_mesh_clear()
print(f"TS export: {OUT_GLB}  tris={tris}  size={os.path.getsize(OUT_GLB) // 1024} KB")

# ------------------------------------------------------------------ studio renders

if RENDER:
    os.makedirs(RENDER_DIR, exist_ok=True)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = int(os.environ.get("TS_SAMPLES", "96"))
    scene.cycles.use_denoising = True
    scene.render.resolution_x = int(os.environ.get("TS_W", "1400"))
    scene.render.resolution_y = int(os.environ.get("TS_H", "900"))
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.03, 0.032, 0.036, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0

    # stand-in blade: white-hot core inside a red glow shell
    blade_len = 0.88
    core = material("blade_core", 0xffffff, 0.5, 0.0, 0xfff0ea, 30.0)
    shell = material("blade_glow", 0xff2010, 0.5, 0.0, 0xff1a0a, 12.0, alpha=0.35)
    for r, m in ((0.0068, core), (0.0125, shell)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r, depth=blade_len,
                                            location=(RX @ Vector((0, 0, EMIT_Z - blade_len / 2)).to_4d()).to_3d(),
                                            rotation=(math.radians(90), 0, 0))
        bpy.context.active_object.data.materials.append(m)

    def area(name, loc, size, power, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.size = size
        ld.energy = power
        ld.color = color
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = loc
        d = Vector((0, 0, 0)) - Vector(loc)
        lo.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

    area("key", (0.6, -0.5, 0.7), 0.6, 45)
    area("fill", (-0.8, -0.2, 0.2), 1.0, 18, (0.85, 0.9, 1.0))
    area("rim", (0.0, 0.9, 0.5), 0.5, 40)
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -0.06))
    bpy.context.active_object.data.materials.append(material("floor", 0x1c1d1f, 0.55))

    cam_d = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def shot(name, eye_game, look_game, lens=50):
        e = (RX @ Vector(eye_game).to_4d()).to_3d()
        lk = (RX @ Vector(look_game).to_4d()).to_3d()
        cam.location = e
        cam.rotation_euler = (lk - e).to_track_quat("-Z", "Y").to_euler()
        cam_d.lens = lens
        scene.render.filepath = os.path.join(RENDER_DIR, name + ".png")
        bpy.ops.render.render(write_still=True)
        print("rendered", name)

    views = os.environ.get("TS_VIEWS", "right,hilt,emitter,under,full").split(",")
    V = {
        "side":    ((0.0, 0.0, 0.0), (0, 0, 0), 50),
        "right":   ((0.46, 0.03, -0.02), (0, 0, -0.02), 50),
        "hilt":    ((0.22, 0.14, -0.10), (0, 0, -0.04), 55),
        "emitter": ((0.10, 0.07, -0.26), (0, 0, -0.14), 60),
        "under":   ((0.14, -0.18, 0.03), (0, -0.01, 0.0), 55),
        "full":    ((0.9, 0.35, -0.40), (0, 0, -0.42), 40),
    }
    for v in views:
        if v in V:
            shot(v, *V[v])
