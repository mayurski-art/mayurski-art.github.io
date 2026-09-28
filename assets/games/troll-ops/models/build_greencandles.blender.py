"""
Green Candles, the detailed first-person model (weapons.js id `greencandle`).

    blender --background --python build_greencandles.blender.py            # export .glb
    blender --background --python build_greencandles.blender.py -- render  # + studio renders

Everything is authored in GAME coordinates (x right, y up, -z = muzzle
forward, metres, origin about where the gun sits in the hand) and turned into
Blender Z-up per mesh (RX). The glTF exporter turns it back, so what comes
out in three.js is in game coordinates again.

From the user's product render: a matte grey cone ("the bottle") that widens
back to a domed base ring, a banded brass mid-section with vertical panel
seams, a dark collar holding a glowing lime candle + wick (the emitter), and a
side tank clamped on the left ("GREEN CANDLES" printed down it, a glowing
gauge window) feeding a ribbed green hose into the body, red and blue wires
from its rear cap into the base. Held level: pistol grip under the base,
vertical foregrip under the brass.

Nodes the game reads (weapon-model.js buildGreenCandles):
  GC_Body       everything that never moves (one mesh, one primitive per material)
  GC_Tank       the side tank + hose + wires: the magazine; reload drops it
  GC_GaugeFill  child of GC_Tank; its scale.z is the ammo left (pivot at the rear)
  GC_Grip / GC_Support / GC_Muzzle / GC_Aim   empties (hand anchors, flash, ADS)
Materials the game animates by name: GC_CandleCore, GC_CandleShell, GC_Wick,
GC_HoseGlow (uv.x runs 0..1 along the hose for the shot pulse), GC_Gauge, GC_Led.
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Matrix, Vector

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_GLB = os.path.join(OUT_DIR, "greencandles.glb")
RENDER = "render" in sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else False
RENDER_DIR = os.environ.get("GC_RENDER_DIR", os.path.join(OUT_DIR, "_renders"))
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
    # Matte graphite shell, the render's body colour: very slightly warm.
    "body":   material("GC_Body", 0x45484a, 0.62, 0.25),
    "dark":   material("GC_Dark", 0x1f2123, 0.48, 0.55),
    "steel":  material("GC_Steel", 0x9aa0a4, 0.3, 1.0),
    "brass":  material("GC_Brass", 0xc0913f, 0.28, 1.0),
    "brassD": material("GC_BrassDark", 0x7c5a22, 0.4, 1.0),
    "tank":   material("GC_TankShell", 0x55595c, 0.55, 0.3),
    "rubber": material("GC_Rubber", 0x18191a, 0.88, 0.0),
    "print":  material("GC_Print", 0xe4e8dc, 0.5, 0.0),
    "red":    material("GC_WireRed", 0xb3261e, 0.38, 0.0),
    "blue":   material("GC_WireBlue", 0x2250a8, 0.38, 0.0),
    "glass":  material("GC_Glass", 0x1a2a20, 0.05, 0.0, alpha=0.35),
    "dial":   material("GC_DialFace", 0x101311, 0.6, 0.0),
    "needle": material("GC_Needle", 0xf2f2ea, 0.4, 0.0),
    # Glow: the core is the bright emitter, the shell is the translucent wax.
    "core":   material("GC_CandleCore", 0x7dff4a, 0.4, 0.0, 0x74ff3c, 6.0),
    "shell":  material("GC_CandleShell", 0x8cf266, 0.18, 0.0, 0x4fd62a, 1.2, alpha=0.62),
    "wick":   material("GC_Wick", 0xa8ff7a, 0.4, 0.0, 0x9dff66, 4.0),
    "hose":   material("GC_HoseGlow", 0x6fe83e, 0.3, 0.0, 0x4fd62a, 2.2, alpha=0.9),
    "gauge":  material("GC_Gauge", 0x7dff4a, 0.4, 0.0, 0x6dff3a, 4.0),
    "led":    material("GC_Led", 0x7dff4a, 0.3, 0.0, 0x7dff4a, 8.0),
}
MAT_ORDER = list(M.keys())
FONT = "C:/Windows/Fonts/AGENCYB.TTF"
fnt = bpy.data.fonts.load(FONT) if os.path.exists(FONT) else None
FONT_MONO = "C:/Windows/Fonts/bahnschrift.ttf"
fnt_plate = bpy.data.fonts.load(FONT_MONO) if os.path.exists(FONT_MONO) else None


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
# Main axis runs along z through (0, 0). Rear of the dome +0.232, candle wick -0.378.

def body_r(z):
    """Radius of the grey cone between the base ring (z 0.146) and the brass (z -0.095)."""
    return 0.067 - (0.146 - z) * (0.016 / 0.241)


Z_BRASS0, Z_BRASS1 = -0.097, -0.199
TANK_X, TANK_Y, TANK_R = -0.101, 0.004, 0.0265
TANK_Z0, TANK_Z1 = 0.124, -0.036        # rear / front ends of the shell (caps beyond)

# ------------------------------------------------------------------ the body

body = Part("GC_Body")
body_txt = Part("GC_BodyPrint")

# Dome + base ring + cone + brass under-sleeve + collar + candle socket.
prof = []
for i in range(9):   # dome, back pole to the rim
    t = i / 8 * math.pi / 2
    prof.append((0.186 + 0.046 * math.cos(t), 0.066 * math.sin(t) if i else 0.0, "body"))
prof += [
    (0.1855, 0.069, "dark"), (0.184, 0.0735, "dark"), (0.170, 0.0735, "dark"),
    (0.1692, 0.0708, "dark"), (0.1658, 0.0708, "dark"), (0.165, 0.0735, "dark"),
    (0.151, 0.0735, "dark"), (0.1495, 0.0705, "body"), (0.1475, 0.068, "body"),
    (0.146, 0.067, "body"),
]
for zc in (0.098, 0.018):     # two shallow seam grooves round the cone
    r = body_r(zc)
    prof += [(zc + 0.0012, r, "dark"), (zc + 0.0006, r - 0.0014, "dark"), (zc - 0.0006, r - 0.0014, "body"),
             (zc - 0.0012, r, "body")]
prof += [
    (-0.093, body_r(-0.093), "dark"), (-0.095, 0.0495, "dark"),
    (Z_BRASS1, 0.0455, "dark"),
    (Z_BRASS1 - 0.0015, 0.0495, "dark"), (-0.2035, 0.0515, "dark"), (-0.230, 0.0515, "dark"),
    (-0.2335, 0.0552, "dark"), (-0.2425, 0.0552, "dark"), (-0.2455, 0.0525, "dark"),
    (-0.2465, 0.0395, "dark"), (-0.2440, 0.0375, "dark"), (-0.2155, 0.0375, "dark"), (-0.2155, 0.0, "dark"),
]
lathe(body, prof, "body", segs=64)

# Brass: 8 panels with real gaps (the vertical seams), three raised bands
# over their ends and middle, rivets on the bands.
N_PAN = 8
for k in range(N_PAN):
    a0 = TAU * k / N_PAN + math.radians(1.2) + math.radians(22.5)
    a1 = TAU * (k + 1) / N_PAN - math.radians(1.2) + math.radians(22.5)
    rows_o, rows_i = [], []
    for zi in range(7):
        z = Z_BRASS0 - 0.002 - (Z_BRASS0 - Z_BRASS1 - 0.004) * zi / 6
        ro = 0.0515 - (Z_BRASS0 - z) * (0.0045 / 0.10)
        rows_o.append(ring_pts(0, 0, z, ro, 8, a0, a1, closed=False))
        rows_i.append(ring_pts(0, 0, z, ro - 0.0026, 8, a0, a1, closed=False))
    grid_solid(body, rows_o, rows_i, "brass")
for zc, w in ((Z_BRASS0 - 0.004, 0.007), ((Z_BRASS0 + Z_BRASS1) / 2, 0.009), (Z_BRASS1 + 0.004, 0.007)):
    rb = 0.0515 - (Z_BRASS0 - zc) * (0.0045 / 0.10) + 0.0022
    lathe(body, [(zc + w / 2, rb - 0.0028), (zc + w / 2, rb - 0.0008), (zc + w / 2 - 0.0008, rb),
                 (zc - w / 2 + 0.0008, rb), (zc - w / 2, rb - 0.0008), (zc - w / 2, rb - 0.0028)], "brassD", segs=64)
    if w > 0.008:
        for k in range(N_PAN):
            a = TAU * k / N_PAN
            p = Vector((rb * math.cos(a), rb * math.sin(a), zc))
            local_lathe(body, p, Vector((math.cos(a), math.sin(a), 0)),
                        [(-0.0005, 0.0024), (0.0006, 0.0022), (0.0012, 0.0014), (0.0015, 0.0)], "brass", segs=10)

# Knurled grip ring on the collar: 56 fine ridges.
for k in range(56):
    a = TAU * k / 56
    ex = Vector((-math.sin(a), math.cos(a), 0))
    ey = Vector((math.cos(a), math.sin(a), 0))
    box(body, (0.0527 * math.cos(a), 0.0527 * math.sin(a), -0.2168), (0.0021, 0.0026, 0.0205), "dark",
        (ex, ey, Vector((0, 0, 1))))

# Candle: translucent wax shell, a brighter core inside, a melt pool with the
# wick nub, and wax drips down the side.
candle = [(-0.216, 0.0355, "shell"), (-0.3485, 0.0355, "shell"), (-0.3508, 0.0348, "shell"), (-0.3522, 0.0333, "shell"),
          (-0.3528, 0.029, "shell"), (-0.3505, 0.018, "shell"), (-0.3494, 0.009, "shell"), (-0.3492, 0.0, "shell")]
lathe(body, candle, "shell", segs=40)
lathe(body, [(-0.222, 0.0225), (-0.340, 0.0225), (-0.343, 0.018), (-0.344, 0.0)], "core", segs=24)
lathe(body, [(-0.3480, 0.0078), (-0.3605, 0.0072), (-0.3665, 0.0058), (-0.3695, 0.0038), (-0.3705, 0.0)], "wick", segs=16)
lathe(body, [(-0.3695, 0.0018), (-0.3775, 0.0012), (-0.3782, 0.0)], "dark", segs=8)
for ang, ln, rr in ((math.radians(118), 0.034, 0.0034), (math.radians(205), 0.022, 0.0029),
                    (math.radians(300), 0.041, 0.0036), (math.radians(40), 0.015, 0.0025)):
    pts = [Vector((0.0357 * math.cos(ang), 0.0357 * math.sin(ang), -0.3505 + ln * t)) for t in (0, 0.33, 0.66, 1.0)]
    pts = [p + Vector((math.cos(ang), math.sin(ang), 0)) * (-0.0008 + 0.0006 * math.sin(math.pi * i / 3)) for i, p in enumerate(pts)]
    path = catmull(pts, 10)
    sweep(body, path, lambda s, rr=rr: rr * 0.62 * (0.35 + 0.65 * math.sin(math.pi * min(1, s * 1.1))) + 0.0003, "shell", sides=8, uv=False)

# Screws: a ring round the rear cone, four on the collar front.
for k in range(8):
    a = TAU * k / 8 + TAU / 16
    z = 0.133
    r = body_r(z)
    screw(body, (r * math.cos(a), r * math.sin(a), z), (math.cos(a), math.sin(a), 0.2))
for k in range(4):
    a = TAU * k / 4 + TAU / 8
    screw(body, (0.046 * math.cos(a), 0.046 * math.sin(a), -0.2463), (0, 0, -1), r=0.0026, key="steel")

# Rear dome: two shallow rings pressed into it and a centre pressure valve
# on a bolted boss (the player looks straight at this in first person).
DOME_Z0, DOME_A, DOME_R = 0.186, 0.046, 0.066


def dome_pt(t):   # t 0 = rim .. 1 = pole
    ang = (1 - t) * math.pi / 2
    return DOME_Z0 + DOME_A * math.cos(ang), DOME_R * math.sin(ang)


for tc in (0.30, 0.58):
    z0, r0 = dome_pt(tc - 0.02)
    z1, r1 = dome_pt(tc + 0.02)
    zm, rm = dome_pt(tc)
    lathe(body, [(z0 - 0.002, r0 - 0.002), (z0, r0 + 0.0003), (zm + 0.0006, rm + 0.0008), (z1, r1 + 0.0003),
                 (z1 - 0.002, r1 - 0.002)], "dark", segs=64)
zb = DOME_Z0 + DOME_A - 0.001
local_lathe(body, (0, 0, zb - 0.004), (0, 0, 1), [(0, 0.030), (0.0045, 0.030), (0.0062, 0.0285), (0.0062, 0.0215),
            (0.0075, 0.0200), (0.0105, 0.0200), (0.0115, 0.0185), (0.0115, 0.0)], "steel", segs=48)
for k in range(6):
    a = TAU * k / 6 + TAU / 12
    screw(body, (0.0252 * math.cos(a), 0.0252 * math.sin(a), zb + 0.0020), (0, 0, 1), r=0.0022)
local_lathe(body, (0, 0, zb + 0.0112), (0, 0, 1), [(0, 0.0105), (0.0055, 0.0105), (0.0063, 0.0095), (0.0063, 0.0)], "steel", segs=6)
local_lathe(body, (0, 0, zb + 0.0172), (0, 0, 1), [(0, 0.0048), (0.0075, 0.0048), (0.0075, 0.0)], "steel", segs=16)
local_lathe(body, (0, 0, zb + 0.0245), (0, 0, 1), [(0, 0.0085), (0.0035, 0.0085), (0.0048, 0.0072), (0.0052, 0.0)], "red", segs=24)
box(body, (0, 0, zb + 0.0305), (0.026, 0.0045, 0.0055), "red")

# Maker's plate on top of the cone (what first person looks down on):
# brushed steel, riveted, engraved lines reading across the gun.
PL_A, PL_W = math.radians(90), math.radians(44)
PL_Z0, PL_Z1 = 0.118, 0.040
rows_o, rows_i = [], []
for zi in range(7):
    z = PL_Z0 + (PL_Z1 - PL_Z0) * zi / 6
    rows_o.append(ring_pts(0, 0, z, body_r(z) + 0.0013, 12, PL_A - PL_W / 2, PL_A + PL_W / 2, closed=False))
    rows_i.append(ring_pts(0, 0, z, body_r(z) - 0.0005, 12, PL_A - PL_W / 2, PL_A + PL_W / 2, closed=False))
grid_solid(body, rows_o, rows_i, "steel")
for zz in (PL_Z0 - 0.0045, PL_Z1 + 0.0045):
    for aa in (PL_A - PL_W / 2 + math.radians(4.5), PL_A + PL_W / 2 - math.radians(4.5)):
        r = body_r(zz) + 0.0013
        local_lathe(body, (r * math.cos(aa), r * math.sin(aa), zz), (math.cos(aa), math.sin(aa), 0),
                    [(-0.0004, 0.0021), (0.0005, 0.0019), (0.0010, 0.0011), (0.0012, 0.0)], "brass", segs=10)


def engrave(P, text, size, zc, ac, lift, key="dark", spacing=1.05, font=None):
    """Text wrapped onto the cone: reads across the gun (left to right seen
    from behind), letter tops toward the muzzle."""
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = text
    if font or fnt:
        cu.font = font or fnt
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.space_character = spacing
    cu.extrude = 0.00012
    cu.resolution_u = 3
    ob = bpy.data.objects.new("txt", cu)
    scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    vmap = {}
    for v in me.vertices:
        z = zc - v.co.y
        r = body_r(z) + lift + v.co.z
        ang = ac - v.co.x / r
        vmap[v.index] = P.v((r * math.cos(ang), r * math.sin(ang), z))
    for poly in me.polygons:
        P.face([vmap[i] for i in poly.vertices], key)
    bpy.data.meshes.remove(me)


# Engraved lines (text, letter height, z).
PLATE_LINES = [("GRIN DYNAMICS", 0.0062, 0.101), ("GREEN CANDLES  MK II", 0.0046, 0.088),
               ("SER. 1718  ·  CAL. WAX", 0.0036, 0.076), ("DO NOT LOOK INTO CANDLE", 0.0036, 0.060),
               ("KEEP UPRIGHT WHEN LIT", 0.0030, 0.050)]
for _t, _s, _z in PLATE_LINES:
    engrave(body_txt, _t, _s, _z, PL_A, 0.0013, font=fnt_plate)

# Iron sights (aiming looks along the top): a notched rear leaf on the
# base ring and a front post on the collar with a glowing "flame" bead.
SIGHT_Y = 0.0905          # the sight line, above the axis
REAR_Z, FRONT_Z = 0.160, -0.2375
box(body, (0, 0.0752, REAR_Z), (0.020, 0.006, 0.012), "dark")
for sx in (-1, 1):
    box(body, (sx * 0.0068, 0.0835, REAR_Z), (0.0072, 0.0115, 0.0035), "dark")          # leaf halves
    box(body, (sx * 0.0122, 0.0845, REAR_Z + 0.002), (0.0022, 0.0135, 0.0075), "dark")  # guard ears
    local_lathe(body, (sx * 0.0068, SIGHT_Y - 0.0035, REAR_Z - 0.00176), (0, 0, -1),
                [(0, 0.0010), (0.0003, 0.0010), (0.0003, 0.0)], "print", segs=8)       # white dots
box(body, (0, 0.0797, REAR_Z), (0.0064, 0.0038, 0.0035), "dark")                       # notch floor
box(body, (0, 0.0575, FRONT_Z), (0.012, 0.006, 0.012), "dark")
box(body, (0, 0.0725, FRONT_Z), (0.0036, 0.030, 0.0045), "dark")
local_lathe(body, (0, SIGHT_Y - 0.0015, FRONT_Z), (0, 1, 0),
            [(0, 0.0021), (0.0016, 0.0024), (0.0034, 0.0017), (0.0046, 0.0)], "wick", segs=12)
rows_o, rows_i = [], []
for zi in range(3):
    z = FRONT_Z + 0.004 - 0.004 * zi
    rows_o.append(ring_pts(0, SIGHT_Y - 0.004, z, 0.0092, 12, math.radians(-10), math.radians(190), closed=False))
    rows_i.append(ring_pts(0, SIGHT_Y - 0.004, z, 0.0078, 12, math.radians(-10), math.radians(190), closed=False))
grid_solid(body, rows_o, rows_i, "dark")
for sx in (-1, 1):
    box(body, (sx * 0.0085, 0.0725, FRONT_Z), (0.0016, 0.030, 0.008), "dark")

# Base ring port: a round capped port with a push button (render: "a round
# button/port on its side"), upper left where you can see it.
a = math.radians(152)
port = Vector((0.0735 * math.cos(a), 0.0735 * math.sin(a), 0.1675))
pn = Vector((math.cos(a), math.sin(a), 0))
local_lathe(body, port - pn * 0.002, pn, [(0, 0.0105), (0.0045, 0.0105), (0.0052, 0.0098), (0.0052, 0.0072), (0.0046, 0.0068), (0.0046, 0.0)], "steel", segs=24)
local_lathe(body, port + pn * 0.0040, pn, [(0, 0.0062), (0.0022, 0.0060), (0.0030, 0.0048), (0.0032, 0.0)], "red", segs=20)

# Wire plugs on the base ring, lower left: two grommets the wires run into.
for i, a in enumerate((math.radians(212), math.radians(224))):
    p = Vector((0.0735 * math.cos(a), 0.0735 * math.sin(a), 0.160))
    n = Vector((math.cos(a), math.sin(a), 0))
    local_lathe(body, p - n * 0.002, n, [(0, 0.0058), (0.0045, 0.0058), (0.0052, 0.0050), (0.0052, 0.0)], "rubber", segs=16)

# Dial with a green LED, lower left of the cone (render: "a round dial /
# indicator with a green light on the lower body").
a = math.radians(208)
zd = 0.072
rd = body_r(zd)
dn = Vector((math.cos(a), math.sin(a), 0.066)).normalized()
dp = Vector((rd * math.cos(a), rd * math.sin(a), zd))
local_lathe(body, dp - dn * 0.003, dn, [(0, 0.0165), (0.0052, 0.0165), (0.0062, 0.0155), (0.0062, 0.0128), (0.0052, 0.0122), (0.0052, 0.0)], "steel", segs=32)
local_lathe(body, dp + dn * 0.0021, dn, [(0, 0.0123), (0.0005, 0.0123), (0.0005, 0.0)], "dial", segs=32)
t, n, b = frame_from_normal(dn)
for k in range(9):   # tick marks over a 270 degree sweep
    ang = math.radians(-225 + 270 * k / 8)
    d = t * math.cos(ang) + b * math.sin(ang)
    box(body, dp + dn * 0.0028 + d * 0.0098, (0.0009, 0.0006, 0.0028), "needle", (d.cross(dn).normalized(), dn, d))
ang = math.radians(20)
d = t * math.cos(ang) + b * math.sin(ang)
box(body, dp + dn * 0.0032 + d * 0.004, (0.0008, 0.0005, 0.0085), "needle", (d.cross(dn).normalized(), dn, d))
local_lathe(body, dp + dn * 0.0030, dn, [(0, 0.0016), (0.0009, 0.0012), (0.0011, 0.0)], "steel", segs=10)
local_lathe(body, dp + dn * 0.0047, dn, [(0, 0.0122), (0.0012, 0.0110), (0.0019, 0.0070), (0.0021, 0.0)], "glass", segs=32)
la = math.radians(222)
lz = 0.046
lr = body_r(lz)
ln_ = Vector((math.cos(la), math.sin(la), 0.066)).normalized()
lp = Vector((lr * math.cos(la), lr * math.sin(la), lz))
local_lathe(body, lp - ln_ * 0.002, ln_, [(0, 0.0048), (0.0036, 0.0048), (0.0040, 0.0042), (0.0040, 0.0)], "steel", segs=16)
local_lathe(body, lp + ln_ * 0.0032, ln_, [(0, 0.0031), (0.0014, 0.0026), (0.0022, 0.0012), (0.0024, 0.0)], "led", segs=14)

# Latch seam on the right: a raised hinged access plate with a flip lever.
for (z0, z1) in ((0.090, 0.030),):
    rows_o, rows_i = [], []
    for zi in range(5):
        z = z0 + (z1 - z0) * zi / 4
        r = body_r(z)
        rows_o.append(ring_pts(0, 0, z, r + 0.0018, 8, math.radians(-26), math.radians(26), closed=False))
        rows_i.append(ring_pts(0, 0, z, r - 0.0004, 8, math.radians(-26), math.radians(26), closed=False))
    grid_solid(body, rows_o, rows_i, "dark")
    for zz in (z0 - 0.004, z1 + 0.004):
        for aa in (math.radians(-20), math.radians(20)):
            r = body_r(zz) + 0.0018
            screw(body, (r * math.cos(aa), r * math.sin(aa), zz), (math.cos(aa), math.sin(aa), 0), r=0.0022)
    zl = (z0 + z1) / 2
    r = body_r(zl) + 0.0018
    box(body, (r + 0.0028, 0.0, zl), (0.0045, 0.012, 0.028), "steel",
        (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))))
    box(body, (r + 0.0055, 0.0, zl - 0.011), (0.004, 0.016, 0.006), "steel")

# Tank bracket: two clamp saddles off the body's left flank.
for zc in (0.094, -0.008):
    rb = body_r(zc)
    box(body, (-(rb - 0.004) - 0.012, TANK_Y, zc), (0.030, 0.014, 0.014), "dark")
    local_lathe(body, (TANK_X, TANK_Y, zc - 0.007), (0, 0, 1),
                [(0, TANK_R + 0.0005), (0, TANK_R + 0.0030), (0.0012, TANK_R + 0.0042), (0.0128, TANK_R + 0.0042),
                 (0.014, TANK_R + 0.0030), (0.014, TANK_R + 0.0005)], "dark", segs=40)
    screw(body, (TANK_X - TANK_R - 0.0042, TANK_Y + 0.009, zc), (-1, 0.5, 0), r=0.0024)
    box(body, (TANK_X, TANK_Y - TANK_R - 0.006, zc), (0.012, 0.008, 0.014), "dark")
    screw(body, (TANK_X, TANK_Y - TANK_R - 0.010, zc), (0, -1, 0), r=0.0022)

# ------------------------------------------------------------------ grips

# Mount rail under the rear cone.
box(body, (0, -0.064, 0.093), (0.034, 0.018, 0.098), "dark")
for k in range(5):
    box(body, (0, -0.0735, 0.055 + k * 0.019), (0.036, 0.003, 0.009), "dark")
# Pistol grip: lofted superellipse sections, raked back, finger grooves on
# the front strap, a flared base plate.
secs = []
for i in range(15):
    s = i / 14
    y = -0.071 - 0.118 * s
    rake = math.tan(math.radians(16)) * (0.071 + y) * -1
    cz = 0.112 + rake
    hw = 0.0158 - 0.0012 * math.sin(math.pi * s)
    hd = 0.0232 + 0.0016 * math.sin(math.pi * s * 0.8)
    groove = 0.0026 * max(0.0, math.sin(math.pi * (s - 0.12) / 0.26 * 1.0)) if 0.12 < s < 0.9 else 0.0
    groove = 0.0026 * abs(math.sin(math.pi * (s - 0.12) / 0.26)) if 0.12 < s < 0.9 else 0.0
    secs.append(superellipse(0, cz, y, hw, hd, n=28, front_bulge=-groove))
loft(body, secs, "rubber")
# Base plate
yb = -0.189
rk = math.tan(math.radians(16)) * (0.071 + yb) * -1
secs = [superellipse(0, 0.112 + rk, yb + 0.001, 0.0172, 0.0258, n=28), superellipse(0, 0.112 + rk, yb - 0.006, 0.0172, 0.0258, n=28),
        superellipse(0, 0.112 + rk, yb - 0.008, 0.0150, 0.0236, n=28)]
loft(body, secs, "dark")
# Trigger guard + trigger
tg = [Vector(p) for p in ((0, -0.072, 0.098), (0, -0.098, 0.090), (0, -0.108, 0.070), (0, -0.104, 0.050), (0, -0.090, 0.045), (0, -0.072, 0.048))]
sweep(body, catmull(tg, 20), lambda s: 0.0032, "dark", sides=8, uv=False)
trg = [Vector(p) for p in ((0, -0.071, 0.070), (0, -0.080, 0.068), (0, -0.090, 0.071), (0, -0.095, 0.077))]
sweep(body, catmull(trg, 10), lambda s: 0.0026 * (1.2 - 0.4 * s), "steel", sides=8, uv=False)

# Foregrip: a clamp ring on the body just behind the brass, vertical grip
# with rings, end cap.
zf = -0.058
rf = body_r(zf)
lathe(body, [(zf + 0.011, rf - 0.001), (zf + 0.011, rf + 0.0025), (zf + 0.0095, rf + 0.004), (zf - 0.0095, rf + 0.004),
             (zf - 0.011, rf + 0.0025), (zf - 0.011, rf - 0.001)], "dark", segs=48)
box(body, (0, -rf - 0.008, zf), (0.020, 0.014, 0.022), "dark")
fg = [(0.0, 0.0125), (0.004, 0.0125)]
for k in range(8):
    h = 0.006 + k * 0.0115
    fg += [(h, 0.0138), (h + 0.004, 0.0138), (h + 0.0055, 0.0126), (h + 0.0105, 0.0126)]
fg += [(0.100, 0.0140), (0.104, 0.0152), (0.109, 0.0152), (0.111, 0.0100), (0.1115, 0.0)]
local_lathe(body, (0, -rf - 0.013, zf), (0, -1, 0), fg, "rubber", segs=24)

body_ob = body.finish(bevel=0.0006)
body_txt.finish(smooth_angle=10)

# ------------------------------------------------------------------ the tank (the magazine)

tank = Part("GC_Tank", pivot=(TANK_X, TANK_Y, (TANK_Z0 + TANK_Z1) / 2))
tank_txt = Part("GC_TankPrint", pivot=(TANK_X, TANK_Y, (TANK_Z0 + TANK_Z1) / 2))
tp = []
tp += [(TANK_Z0 + 0.028, 0.0), (TANK_Z0 + 0.028, 0.012, "steel"), (TANK_Z0 + 0.0265, 0.0165, "steel"),
       (TANK_Z0 + 0.022, 0.0175, "steel"), (TANK_Z0 + 0.018, 0.0235, "steel")]
for k in range(4):   # knurl ridges on the rear cap
    z = TANK_Z0 + 0.016 - k * 0.0035
    tp += [(z, 0.0285, "steel"), (z - 0.0017, 0.0285, "steel"), (z - 0.0021, 0.0272, "steel")]
tp += [(TANK_Z0 + 0.0015, 0.0272, "steel"), (TANK_Z0, TANK_R, "tank")]
tp += [(TANK_Z1, TANK_R, "steel"), (TANK_Z1 - 0.0015, 0.0272, "steel")]
for k in range(4):
    z = TANK_Z1 - 0.0035 - k * 0.0035
    tp += [(z, 0.0272, "steel"), (z - 0.0004, 0.0285, "steel"), (z - 0.0021, 0.0285, "steel")]
tp += [(TANK_Z1 - 0.018, 0.0235, "steel"), (TANK_Z1 - 0.022, 0.0175, "steel"), (TANK_Z1 - 0.0265, 0.0165, "steel"),
       (TANK_Z1 - 0.028, 0.012, "steel"), (TANK_Z1 - 0.028, 0.0)]
lathe(tank, tp, "tank", segs=48, cx=TANK_X, cy=TANK_Y)

# Gauge window: a recessed slot up the top-outer face with a bezel, tick
# marks, and the glass over the fill.
GA = math.radians(112)
gn = Vector((math.cos(GA), math.sin(GA), 0))
gt = Vector((-math.sin(GA), math.cos(GA), 0))
gz0, gz1 = TANK_Z0 - 0.010, TANK_Z1 + 0.010
gc = Vector((TANK_X, TANK_Y, 0)) + gn * TANK_R
gl = gz0 - gz1
for side in (-1, 1):
    box(tank, gc + gt * (side * 0.0068) + Vector((0, 0, (gz0 + gz1) / 2)), (0.0032, 0.003, gl + 0.006), "dark", (gt, gn, Vector((0, 0, 1))))
for zz in (gz0 + 0.0015, gz1 - 0.0015):
    box(tank, gc + Vector((0, 0, zz)), (0.0168, 0.003, 0.003), "dark", (gt, gn, Vector((0, 0, 1))))
for k in range(9):
    zz = gz1 + gl * k / 8
    box(tank, gc + gt * 0.0092 + gn * 0.0001 + Vector((0, 0, zz)), (0.0026 if k % 4 else 0.0042, 0.0012, 0.0008), "print", (gt, gn, Vector((0, 0, 1))))
box(tank, gc - gn * 0.0012 + Vector((0, 0, (gz0 + gz1) / 2)), (0.0106, 0.0024, gl), "dial", (gt, gn, Vector((0, 0, 1))))
box(tank, gc + gn * 0.0011 + Vector((0, 0, (gz0 + gz1) / 2)), (0.0104, 0.0006, gl), "glass", (gt, gn, Vector((0, 0, 1))))

# "GREEN CANDLES" printed down the outer face, reading muzzle-left the way
# the inspect animation shows the left side.


def printed(P, text, size, center_z, angle, y_off=0.0):
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = text
    if fnt:
        cu.font = fnt
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.space_character = 1.12
    cu.extrude = 0.00018
    cu.resolution_u = 3
    ob = bpy.data.objects.new("txt", cu)
    scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    n = Vector((math.cos(angle), math.sin(angle), 0))
    up = Vector((-math.sin(angle), math.cos(angle), 0)) * -1 if n.x < 0 else Vector((-math.sin(angle), math.cos(angle), 0))
    along = Vector((0, 0, 1))
    base = Vector((TANK_X, TANK_Y, center_z)) + n * (TANK_R + 0.0004) + up * y_off
    vmap = {}
    for v in me.vertices:
        # local x = reading direction, y = letter up, z = out of the face
        p = base + along * v.co.x + up * v.co.y + n * v.co.z
        # wrap onto the cylinder: push each point out to the radius along its own angle
        rel = Vector((p.x - TANK_X, p.y - TANK_Y, 0))
        rr = TANK_R + 0.0004 + v.co.z
        rel = rel.normalized() * rr
        vmap[v.index] = P.v((TANK_X + rel.x, TANK_Y + rel.y, p.z))
    for poly in me.polygons:
        P.face([vmap[i] for i in poly.vertices], "print")
    bpy.data.meshes.remove(me)


printed(tank_txt, "GREEN CANDLES", 0.0125, 0.044, math.radians(186))
# Hazard band near the front cap
for k in range(10):
    a0 = math.radians(150 + k * 9)
    rows_o = [ring_pts(TANK_X, TANK_Y, TANK_Z1 + 0.012 - dz, TANK_R + 0.0003, 2, a0 + dz * 3, a0 + math.radians(4.5) + dz * 3, closed=False)
              for dz in (0.0, 0.006)]
    rows_i = [ring_pts(TANK_X, TANK_Y, TANK_Z1 + 0.012 - dz, TANK_R - 0.0002, 2, a0 + dz * 3, a0 + math.radians(4.5) + dz * 3, closed=False)
              for dz in (0.0, 0.006)]
    grid_solid(tank, rows_o, rows_i, "print")

# Hose: tank front cap top -> into the body just under the brass. Ribbed
# (radius bumps along it), uv.x runs 0 at the tank to 1 at the body.
_ha = math.radians(146)
_hn = Vector((math.cos(_ha), math.sin(_ha), 0))
_he = Vector((0.0515 * math.cos(_ha), 0.0515 * math.sin(_ha), -0.089))
hose_pts = [(TANK_X, TANK_Y, TANK_Z1 - 0.027), (TANK_X, TANK_Y + 0.001, TANK_Z1 - 0.041),
            (TANK_X + 0.004, TANK_Y + 0.020, -0.100), (TANK_X + 0.020, TANK_Y + 0.046, -0.104),
            tuple(_he + _hn * 0.020 + Vector((0, 0, -0.006))), tuple(_he + _hn * 0.009), tuple(_he)]
hose_path = catmull(hose_pts, 110)
lens = sweep(tank, hose_path, lambda s: 0.0068 + (0.0011 * (0.5 + 0.5 * math.cos(s * TAU * 17)) if 0.06 < s < 0.94 else 0.0),
             "hose", sides=14)
# Fittings: hex nut + ferrule at both ends.
for i0, i1 in ((0, 5), (109, 104)):
    p0, p1 = hose_path[i0], hose_path[i1]
    d = (p1 - p0).normalized()
    t_, n_, b_ = frame_from_normal(d)
    local_lathe(tank, p0 - d * 0.001, d, [(0, 0.0094), (0.0055, 0.0094), (0.0062, 0.0086), (0.0062, 0.0)], "steel", segs=6)
    local_lathe(tank, p0 + d * 0.0055, d, [(0, 0.0082), (0.006, 0.0078), (0.008, 0.0070), (0.008, 0.0)], "steel", segs=18)

# Wires: red and blue from the rear cap's underside, sagging, into the
# grommets on the base ring. Their ends are on the tank, so they leave
# with it on a reload (the grommets stay on the body).
for i, (key, a) in enumerate((("red", math.radians(212)), ("blue", math.radians(224)))):
    start = Vector((TANK_X + 0.004 * (i * 2 - 1), TANK_Y - 0.018, TANK_Z0 + 0.024))
    end = Vector((0.0735 * math.cos(a), 0.0735 * math.sin(a), 0.160)) + Vector((math.cos(a), math.sin(a), 0)) * 0.0045
    mid1 = Vector((TANK_X - 0.012 + i * 0.004, TANK_Y - 0.052 - i * 0.004, TANK_Z0 + 0.034))
    mid2 = Vector((-0.086 + i * 0.006, -0.062 - i * 0.003, 0.158))
    path = catmull([start, start + Vector((0, -0.012, 0.004)), mid1, mid2, end], 40)
    sweep(tank, path, lambda s: 0.0026, key, sides=8, uv=False)
    local_lathe(tank, start + Vector((0, 0.004, 0)), (0, -1, 0), [(0, 0.0042), (0.006, 0.0042), (0.0075, 0.0034), (0.0075, 0.0)], "rubber", segs=12)
    d = (path[-1] - path[-4]).normalized()
    local_lathe(tank, end - d * 0.009, d, [(0, 0.0036), (0.007, 0.0036), (0.0078, 0.0030), (0.0078, 0.0)], "steel", segs=12)

tank_ob = tank.finish(bevel=0.0004)
tank_txt.finish(parent=tank_ob, smooth_angle=10)

# Gauge fill, pivot at the rear end so scale.z = ammo fraction.
gf = Part("GC_GaugeFill", pivot=tuple(gc + Vector((0, 0, gz0 - 0.001))))
box(gf, gc + Vector((0, 0, (gz0 + gz1) / 2)), (0.0092, 0.0014, gl - 0.002), "gauge", (gt, gn, Vector((0, 0, 1))))
gf_ob = gf.finish(parent=tank_ob)

# ------------------------------------------------------------------ anchors


def empty(name, pos, parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.01
    e.location = (RX @ Vector(pos).to_4d()).to_3d()
    scene.collection.objects.link(e)
    return e


empty("GC_Grip", (0, -0.112, 0.118))
empty("GC_Support", (0, -rf - 0.060, zf))
empty("GC_Muzzle", (0, 0, -0.380))
empty("GC_Aim", (0, SIGHT_Y, REAR_Z))

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
print(f"GC export: {OUT_GLB}  tris={tris}  size={os.path.getsize(OUT_GLB) // 1024} KB")

# ------------------------------------------------------------------ studio renders

if RENDER:
    os.makedirs(RENDER_DIR, exist_ok=True)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = int(os.environ.get("GC_SAMPLES", "96"))
    scene.cycles.use_denoising = True
    scene.render.resolution_x = int(os.environ.get("GC_W", "1400"))
    scene.render.resolution_y = int(os.environ.get("GC_H", "900"))
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    grad = world.node_tree.nodes.new("ShaderNodeTexGradient")
    coord = world.node_tree.nodes.new("ShaderNodeTexCoord")
    ramp = world.node_tree.nodes.new("ShaderNodeValToRGB")
    sep = world.node_tree.nodes.new("ShaderNodeSeparateXYZ")
    world.node_tree.links.new(coord.outputs["Generated"], sep.inputs[0])
    mapr = world.node_tree.nodes.new("ShaderNodeMapRange")
    world.node_tree.links.new(sep.outputs["Z"], mapr.inputs["Value"])
    mapr.inputs["From Min"].default_value = 0.3
    mapr.inputs["From Max"].default_value = 0.7
    world.node_tree.links.new(mapr.outputs["Result"], ramp.inputs["Fac"])
    ramp.color_ramp.elements[0].color = (0.035, 0.037, 0.04, 1)
    ramp.color_ramp.elements[1].color = (0.42, 0.44, 0.47, 1)
    world.node_tree.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.9

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

    area("key", (0.9, -0.6, 0.9), 0.8, 90)
    area("fill", (-1.0, -0.2, 0.3), 1.2, 40, (0.9, 0.95, 1.0))
    area("rim", (0.1, 1.1, 0.6), 0.6, 70)
    # floor
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -0.24))
    fl = bpy.context.active_object
    fm = material("floor", 0x2a2c2e, 0.7)
    fl.data.materials.append(fm)

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

    views = os.environ.get("GC_VIEWS", "hero,left,fp,tank,candle,grip").split(",")
    V = {
        "hero":   ((-0.62, 0.30, -0.55), (0, -0.02, -0.06), 55),
        "left":   ((-0.95, 0.05, -0.06), (0, -0.03, -0.06), 55),
        "right":  ((0.95, 0.05, -0.06), (0, -0.03, -0.06), 55),
        "fp":     ((0.13, 0.13, 0.52), (-0.01, -0.01, -0.12), 40),
        "tank":   ((-0.34, 0.14, 0.02), (-0.09, 0.0, 0.02), 70),
        "candle": ((-0.20, 0.12, -0.50), (0, 0, -0.29), 70),
        "grip":   ((-0.30, -0.10, 0.28), (0, -0.09, 0.08), 60),
        "rear":   ((-0.30, 0.05, 0.50), (-0.03, -0.01, 0.12), 60),
    }
    for v in views:
        if v in V:
            shot(v, *V[v])
