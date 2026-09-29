"""
Grinmington 870, the detailed first-person model (weapons.js id `grinmington`).

    blender --background --python build_grinmington.blender.py            # export .glb
    blender --background --python build_grinmington.blender.py -- render  # + studio renders

Game coordinates like the other builds (x right, y up, -z = muzzle forward,
metres, origin about the grip). Read off BO2's Remington 870 MCS: black
receiver with a top rail and a ghost-ring rear sight, short barrel under a
vented heat shield ending in a toothed breaching muzzle with a front post,
a ribbed pump riding the magazine tube, a barrel clamp with a sling loop and
a flashlight slung under the muzzle, a raked pistol grip, an M4-style
collapsible stock on a buffer tube, and a four-shell side saddle on the left.
No text on it.

Nodes the game reads (weapon-model.js buildGrinmington):
  GM_Body       everything that never moves
  GM_Pump       forend + action bars (pivot = its rest centre; slides on z)
  GM_Breacher   the muzzle device (hidden when a barrel attachment goes on)
  GM_IronRear / GM_IronFront   ghost ring + front post (hidden under an optic)
  GM_Shell      one loose shell for the reload (origin at its middle, head +z)
  GM_Grip / GM_Support / GM_Muzzle / GM_Aim / GM_Port / GM_Under   empties
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Matrix, Vector

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_GLB = os.path.join(OUT_DIR, "grinmington.glb")
RENDER = "render" in sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else False
RENDER_DIR = os.environ.get("GM_RENDER_DIR", os.path.join(OUT_DIR, "_renders"))
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
    "recv":   material("GM_Receiver", 0x232527, 0.42, 0.75),
    "poly":   material("GM_Polymer", 0x17181a, 0.72, 0.0),
    "steel":  material("GM_Steel", 0x8a9096, 0.3, 1.0),
    "dark":   material("GM_Dark", 0x0b0c0d, 0.6, 0.3),
    "barrel": material("GM_Barrel", 0x2c2f32, 0.32, 0.85),
    "rubber": material("GM_Rubber", 0x0e0e0f, 0.9, 0.0),
    "hull":   material("GM_Hull", 0xa8231c, 0.5, 0.0),
    "brass":  material("GM_Brass", 0xc09a4a, 0.3, 1.0),
    "lens":   material("GM_Lens", 0xdfe8ef, 0.05, 0.0, 0xcfe6ff, 0.6),
    "dot":    material("GM_Dot", 0xff9a2a, 0.4, 0.0, 0xff8a20, 2.0),
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
BORE_Y = 0.010            # barrel axis
TUBE_Y = -0.024           # magazine tube axis
R_Z0, R_Z1 = 0.078, -0.170   # receiver rear / front
R_TOP, R_BOT, R_HW = 0.030, -0.046, 0.018
RAIL_TOP = 0.036
MUZZLE_Z = -0.664
PUMP_Z = -0.340           # forend rest centre
PUMP_LEN = 0.170
SIGHT_Y = 0.058
REAR_SIGHT_Z = 0.058
GRIP_TOP = Vector((0, -0.040, 0.028))
GRIP_AX = Vector((0, -0.95, 0.31)).normalized()     # down and back (a raked grip)
GRIP_LEN = 0.118


def rrect(z, hw, ytop, ybot, r, n=6, x0=0.0):
    """Rounded rectangle in the XY plane at z, CCW seen from +z."""
    r = min(r, hw * 0.98, (ytop - ybot) * 0.49)
    out = []
    corners = [((x0 + hw - r, ytop - r), 0.0), ((x0 - hw + r, ytop - r), 90.0),
               ((x0 - hw + r, ybot + r), 180.0), ((x0 + hw - r, ybot + r), 270.0)]
    for (cx, cy), a0 in corners:
        for i in range(n + 1):
            a = math.radians(a0 + 90.0 * i / n)
            out.append((cx + r * math.cos(a), cy + r * math.sin(a), z))
    return out


def on_cyl(P, cy, cz, r, ang, size, key, lift=0.0, cx=0.0):
    """A box laid on a cylinder (axis along z through (cx, cy)) at angle ang."""
    rad = Vector((math.cos(ang), math.sin(ang), 0))
    tan = Vector((-math.sin(ang), math.cos(ang), 0))
    c = Vector((cx, cy, cz)) + rad * (r + lift)
    box(P, c, size, key, (tan, rad, Vector((0, 0, 1))))


body = Part("GM_Body")

# ---- receiver: a rounded block with chamfered ends
loft(body, [
    rrect(R_Z0, R_HW - 0.002, R_TOP - 0.004, R_BOT + 0.004, 0.006),
    rrect(R_Z0 - 0.004, R_HW, R_TOP, R_BOT, 0.005),
    rrect(R_Z1 + 0.004, R_HW, R_TOP, R_BOT, 0.005),
    rrect(R_Z1, R_HW - 0.002, R_TOP - 0.003, R_BOT + 0.003, 0.006),
], "recv")
# milled flutes down both flanks
for sx in (-1, 1):
    for y in (0.016, -0.004):
        box(body, (sx * (R_HW + 0.0002), y, -0.045), (0.0012, 0.0035, 0.170), "dark")
# ejection port (right) with the bolt face showing
box(body, (R_HW + 0.0003, 0.006, -0.068), (0.0016, 0.024, 0.070), "dark")
box(body, (R_HW - 0.0010, 0.006, -0.062), (0.0016, 0.016, 0.040), "steel")
for i in range(5):
    box(body, (R_HW + 0.0002, 0.006 - 0.008 + i * 0.004, -0.043), (0.0012, 0.0012, 0.010), "dark")
# loading port underneath, with the shell lifter
box(body, (0, R_BOT - 0.0003, -0.080), (0.024, 0.0016, 0.096), "dark")
box(body, (0, R_BOT + 0.0015, -0.076), (0.016, 0.0012, 0.070), "steel")
# trigger-group pins, both sides
for sx in (-1, 1):
    for z in (0.020, 0.058):
        screw(body, (sx * R_HW, -0.034, z), (sx, 0, 0), r=0.0026, key="steel")
# action release lever (left, ahead of the guard) and the safety button
box(body, (-R_HW - 0.0012, -0.040, -0.004), (0.0024, 0.006, 0.016), "steel")
local_lathe(body, (R_HW, -0.050, 0.046), (1, 0, 0), [(0, 0.0032), (0.003, 0.0032), (0.0038, 0.0024), (0.0038, 0.0)], "dark", segs=14)
local_lathe(body, (-R_HW, -0.050, 0.046), (-1, 0, 0), [(0, 0.0032), (0.0015, 0.0032), (0.0018, 0.0)], "dark", segs=14)

# ---- top rail (Picatinny): base plus cross ribs; optics sit at RAIL_TOP
box(body, (0, R_TOP + 0.0025, -0.050), (0.021, 0.005, 0.220), "recv")
for i in range(15):
    z = 0.052 - i * 0.0147
    box(body, (0, RAIL_TOP - 0.0008, z), (0.021, 0.0016, 0.0050), "recv")
    for sx in (-1, 1):
        box(body, (sx * 0.0100, RAIL_TOP - 0.0022, z), (0.0016, 0.0020, 0.0050), "recv")

# ---- barrel, heat shield, breacher (separate), front sight (separate)
lathe(body, [
    (R_Z1 + 0.004, 0.0, "barrel"),
    (R_Z1 + 0.004, 0.0120, "barrel"),
    (R_Z1 - 0.010, 0.0120, "barrel"),
    (R_Z1 - 0.014, 0.0105, "barrel"),
    (-0.600, 0.0105, "barrel"),
    (-0.601, 0.0092, "dark"),
    (-0.580, 0.0092, "dark"),
    (-0.580, 0.0, "dark"),
], "barrel", segs=40, cy=BORE_Y)

HS_Z0, HS_Z1, HS_R = -0.200, -0.560, 0.0158
a0, a1 = math.radians(-18), math.radians(198)
rows, cols = 18, 30
outer, inner = [], []
for i in range(rows + 1):
    z = HS_Z0 + (HS_Z1 - HS_Z0) * i / rows
    ro, ri = [], []
    for j in range(cols + 1):
        a = a0 + (a1 - a0) * j / cols
        ro.append((HS_R * math.cos(a), BORE_Y + HS_R * math.sin(a), z))
        ri.append(((HS_R - 0.0014) * math.cos(a), BORE_Y + (HS_R - 0.0014) * math.sin(a), z))
    outer.append(ro)
    inner.append(ri)
grid_solid(body, outer, inner, "recv")
# vent slots in three rows along the shield
for ang in (math.radians(58), math.radians(90), math.radians(122)):
    for k in range(7):
        z = -0.238 - k * 0.046
        on_cyl(body, BORE_Y, z, HS_R, ang, (0.0055, 0.0010, 0.026), "dark", lift=0.0001)
# shield mounting bands
for z in (-0.205, -0.555):
    lathe(body, [(z + 0.005, HS_R - 0.0004), (z + 0.004, HS_R + 0.0012), (z - 0.004, HS_R + 0.0012), (z - 0.005, HS_R - 0.0004)],
          "recv", segs=36, cy=BORE_Y)

# ---- magazine tube, cap, barrel clamp with sling loop
lathe(body, [
    (R_Z1 + 0.003, 0.0, "barrel"),
    (R_Z1 + 0.003, 0.0115, "barrel"),
    (-0.555, 0.0115, "steel"),
    (-0.555, 0.0128, "steel"),
    (-0.574, 0.0128, "steel"),
    (-0.577, 0.0110, "steel"),
    (-0.577, 0.0, "steel"),
], "barrel", segs=36, cy=TUBE_Y)
for k in range(16):   # knurled cap
    on_cyl(body, TUBE_Y, -0.5655, 0.0128, TAU * k / 16, (0.0014, 0.0008, 0.016), "dark", lift=0.0001)
CLAMP_Z = -0.535
lathe(body, [(CLAMP_Z + 0.010, 0.0120), (CLAMP_Z + 0.009, 0.0138), (CLAMP_Z - 0.009, 0.0138), (CLAMP_Z - 0.010, 0.0120)], "recv", segs=36, cy=BORE_Y)
lathe(body, [(CLAMP_Z + 0.010, 0.0112), (CLAMP_Z + 0.009, 0.0138), (CLAMP_Z - 0.009, 0.0138), (CLAMP_Z - 0.010, 0.0112)], "recv", segs=36, cy=TUBE_Y)
for sx in (-1, 1):
    box(body, (sx * 0.0126, (BORE_Y + TUBE_Y) / 2, CLAMP_Z), (0.0030, 0.034, 0.018), "recv")
    screw(body, (sx * 0.0141, (BORE_Y + TUBE_Y) / 2, CLAMP_Z), (sx, 0, 0), r=0.0024, key="steel")
loop = [Vector((-0.0150 - 0.0085 * (1 - math.cos(TAU * i / 40)) / 2 * 2, (BORE_Y + TUBE_Y) / 2 + 0.0085 * math.sin(TAU * i / 40), CLAMP_Z))
        for i in range(41)]
sweep(body, loop, lambda s: 0.0014, "steel", sides=8, uv=False)

# ---- flashlight slung under the muzzle, on a mount off the clamp
LIGHT_Y = -0.057
box(body, (0, (TUBE_Y - 0.0125 + LIGHT_Y + 0.013) / 2, CLAMP_Z + 0.004), (0.012, 0.012, 0.030), "recv")
lathe(body, [
    (-0.462, 0.0, "poly"),
    (-0.462, 0.0090, "poly"),
    (-0.466, 0.0122, "poly"),
    (-0.472, 0.0128, "recv"),
    (-0.575, 0.0128, "recv"),
    (-0.582, 0.0162, "recv"),
    (-0.606, 0.0168, "recv"),
    (-0.609, 0.0150, "steel"),
    (-0.609, 0.0140, "lens"),
    (-0.606, 0.0, "lens"),
], "recv", segs=40, cy=LIGHT_Y)
for k in range(10):   # grip rings on the body
    z = -0.490 - k * 0.0075
    lathe(body, [(z + 0.0015, 0.0128), (z + 0.0010, 0.0134), (z - 0.0010, 0.0134), (z - 0.0015, 0.0128)], "recv", segs=32, cy=LIGHT_Y)
for k in range(8):    # bezel scallops
    on_cyl(body, LIGHT_Y, -0.594, 0.0168, TAU * k / 8, (0.0040, 0.0010, 0.022), "dark", lift=0.0001)

# ---- pistol grip: raked, finger-grooved, flared base
nrm = Vector((1, 0, 0)).cross(GRIP_AX).normalized()        # forward face of the grip
xax = Vector((1, 0, 0))
secs = []
N = 16
for i in range(N + 1):
    t = i / N
    c = GRIP_TOP + GRIP_AX * (GRIP_LEN * t)
    hw = 0.0150 + (0.0022 if t > 0.9 else 0.0) + 0.0012 * math.sin(t * math.pi)
    back = 0.0200 + 0.0035 * math.sin(t * math.pi * 0.9)
    front = 0.0190
    if 0.18 < t < 0.88:
        front += 0.0028 * math.cos((t - 0.18) / 0.70 * 3 * TAU) - 0.0008
    if t > 0.92:
        front += 0.004
        back += 0.004
    ring = []
    for k in range(28):
        a = TAU * k / 28
        ca, sa = math.cos(a), math.sin(a)
        u = hw * math.copysign(abs(ca) ** (2 / 2.6), ca)
        dv = front if sa > 0 else back
        v = dv * math.copysign(abs(sa) ** (2 / 2.6), sa)
        p = c + xax * u + nrm * v
        ring.append((p.x, p.y, p.z))
    secs.append(ring)
loft(body, secs, "poly")
# stipple panels on the grip flanks
for sx in (-1, 1):
    for i in range(6):
        for j in range(3):
            t = 0.24 + i * 0.1
            c = GRIP_TOP + GRIP_AX * (GRIP_LEN * t) + nrm * (-0.008 + j * 0.008) + xax * (sx * 0.0168)
            box(body, c, (0.0010, 0.0040, 0.0040), "dark", (xax, GRIP_AX, nrm))

# ---- trigger guard and trigger
guard = catmull([(0, R_BOT + 0.002, -0.020), (0, -0.066, -0.014), (0, -0.071, 0.006), (0, -0.066, 0.024)], 24)
sweep(body, guard, lambda s: 0.0030, "recv", sides=10, uv=False)
trig = catmull([(0, R_BOT, 0.004), (0, -0.054, 0.002), (0, -0.061, 0.007), (0, -0.064, 0.014)], 16)
sweep(body, trig, lambda s: 0.0022 - 0.0006 * s, "steel", sides=8, uv=False)

# ---- stock: adapter, buffer tube, collapsible body, butt pad
loft(body, [
    rrect(R_Z0, R_HW - 0.002, R_TOP - 0.004, R_BOT + 0.004, 0.006),
    rrect(0.096, 0.0150, 0.012, -0.030, 0.010),
    rrect(0.104, 0.0150, 0.010, -0.024, 0.012),
], "recv")
TUBE_S_Y = -0.007
lathe(body, [
    (0.100, 0.0, "recv"), (0.100, 0.0150, "recv"), (0.110, 0.0150, "recv"), (0.112, 0.0138, "recv"),
    (0.330, 0.0138, "recv"), (0.330, 0.0, "recv"),
], "recv", segs=36, cy=TUBE_S_Y)
for z in (0.106, 0.118):   # castle nut
    lathe(body, [(z + 0.003, 0.0150), (z + 0.002, 0.0168), (z - 0.002, 0.0168), (z - 0.003, 0.0150)], "steel", segs=36, cy=TUBE_S_Y)
stock_secs = []
for i, z in enumerate((0.175, 0.182, 0.300, 0.334)):
    t = (z - 0.175) / (0.334 - 0.175)
    ybot = -0.040 - 0.060 * t
    ytop = 0.015 if i else 0.010
    hw = 0.0172 if 0 < i < 3 else 0.0160
    stock_secs.append(rrect(z, hw, ytop, ybot, 0.007))
loft(body, stock_secs, "poly")
loft(body, [rrect(0.334, 0.0168, 0.016, -0.101, 0.008), rrect(0.352, 0.0168, 0.016, -0.101, 0.008)], "rubber")
for i in range(9):    # pad texture
    box(body, (0, 0.010 - i * 0.0135, 0.3525), (0.030, 0.0030, 0.0012), "dark")
box(body, (0, -0.045, 0.200), (0.010, 0.010, 0.030), "poly")         # adjustment latch
box(body, (0, -0.052, 0.206), (0.008, 0.005, 0.016), "dark")
for sx in (-1, 1):    # sling slots
    box(body, (sx * 0.0173, -0.032, 0.262), (0.0012, 0.008, 0.030), "dark")

# ---- side saddle, left flank: four shells, brass down
box(body, (-R_HW - 0.0016, -0.006, -0.080), (0.0032, 0.052, 0.120), "poly")
for k in range(4):
    z = -0.034 - k * 0.0255
    local_lathe(body, (-0.0310, -0.034, z), (0, 1, 0), [
        (0.0, 0.0118, "brass"), (0.0018, 0.0118, "brass"), (0.0020, 0.0108, "brass"),
        (0.0120, 0.0108, "hull"), (0.0600, 0.0106, "hull"), (0.0612, 0.0086, "hull"), (0.0616, 0.0, "hull")], "hull", segs=20)
for y in (-0.016, 0.012):   # retaining straps
    box(body, (-0.0290, y, -0.080), (0.0100, 0.0050, 0.118), "poly")

body_ob = body.finish(bevel=0.00035)

# ---- the pump: ribbed forend on the tube, action bars back into the receiver
pump = Part("GM_Pump", pivot=(0, TUBE_Y, PUMP_Z))
PZ0, PZ1 = PUMP_Z + PUMP_LEN / 2, PUMP_Z - PUMP_LEN / 2
prof = [(PZ0, 0.0118, "poly"), (PZ0, 0.0215, "poly"), (PZ0 - 0.004, 0.0248, "poly")]
z = PZ0 - 0.012
for k in range(11):
    prof += [(z, 0.0248, "poly"), (z - 0.0015, 0.0232, "poly"), (z - 0.0055, 0.0232, "poly"), (z - 0.0070, 0.0248, "poly")]
    z -= 0.0118
prof += [(PZ1 + 0.018, 0.0248, "poly"), (PZ1 + 0.010, 0.0282, "poly"), (PZ1 + 0.002, 0.0282, "poly"), (PZ1, 0.0250, "poly"), (PZ1, 0.0118, "poly")]
lathe(pump, prof, "poly", segs=44, cy=TUBE_Y)
for sx in (-1, 1):
    box(pump, (sx * 0.0246, TUBE_Y, PUMP_Z - 0.004), (0.0014, 0.0070, 0.120), "dark")          # side slots
    box(pump, (sx * 0.0150, -0.011, PZ0 + 0.052), (0.0030, 0.0060, 0.110), "steel")           # action bars
pump_ob = pump.finish(bevel=0.0003)

# ---- breacher: toothed standoff with side ports (separate: hidden under a device)
br = Part("GM_Breacher")
lathe(br, [(-0.599, 0.0105), (-0.599, 0.0162), (-0.603, 0.0166), (-0.650, 0.0166), (-0.651, 0.0110), (-0.640, 0.0104), (-0.640, 0.0)],
      "recv", segs=40, cy=BORE_Y)
for k in range(6):
    a = TAU * k / 6 + TAU / 12
    on_cyl(br, BORE_Y, MUZZLE_Z + 0.0065, 0.0140, a, (0.0068, 0.0046, 0.0130), "recv")
    rad = Vector((math.cos(a + TAU / 12), math.sin(a + TAU / 12), 0))
    local_lathe(br, Vector((0, BORE_Y, -0.625)) + rad * 0.0166, rad, [(0, 0.0034), (0.0004, 0.0034), (0.0004, 0.0)], "dark", segs=12)
br_ob = br.finish(bevel=0.0003)

# ---- iron sights (separate: hidden under an optic)
ir = Part("GM_IronRear")
box(ir, (0, RAIL_TOP + 0.003, REAR_SIGHT_Z), (0.022, 0.006, 0.014), "recv")
for sx in (-1, 1):
    box(ir, (sx * 0.0092, SIGHT_Y - 0.001, REAR_SIGHT_Z), (0.0040, 0.019, 0.010), "recv")
box(ir, (0, (RAIL_TOP + 0.006 + SIGHT_Y - 0.0046) / 2, REAR_SIGHT_Z), (0.0035, SIGHT_Y - 0.0046 - RAIL_TOP - 0.006, 0.004), "recv")
ring = [Vector((0.0046 * math.cos(TAU * i / 32), SIGHT_Y + 0.0046 * math.sin(TAU * i / 32), REAR_SIGHT_Z)) for i in range(33)]
sweep(ir, ring, lambda s: 0.0014, "recv", sides=8, uv=False)
ir.finish(bevel=0.0003)

FRONT_Z = -0.582
fs = Part("GM_IronFront")
base_y = BORE_Y + HS_R + 0.0012
box(fs, (0, base_y + 0.003, FRONT_Z), (0.012, 0.006, 0.016), "recv")
box(fs, (0, (base_y + SIGHT_Y) / 2 + 0.003, FRONT_Z), (0.0026, SIGHT_Y - base_y - 0.004, 0.0045), "recv")
local_lathe(fs, (0, SIGHT_Y - 0.0016, FRONT_Z + 0.0023), (0, 0, 1), [(0, 0.0011), (0.0004, 0.0011), (0.0005, 0.0)], "dot", segs=10)
for sx in (-1, 1):
    box(fs, (sx * 0.0068, (base_y + SIGHT_Y) / 2 + 0.001, FRONT_Z), (0.0022, SIGHT_Y - base_y - 0.006, 0.0110), "recv")
fs.finish(bevel=0.0003)

# ---- the loose shell for the reload, along z, head at +z
sh = Part("GM_Shell")
lathe(sh, [(0.029, 0.0, "brass"), (0.029, 0.0118, "brass"), (0.0272, 0.0118, "brass"), (0.0270, 0.0108, "brass"),
           (0.0170, 0.0108, "hull"), (-0.0290, 0.0106, "hull"), (-0.0302, 0.0086, "hull"), (-0.0306, 0.0, "hull")], "hull", segs=24)
sh.finish()

# ------------------------------------------------------------------ anchors


def empty(name, pos, parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.01
    e.location = (RX @ Vector(pos).to_4d()).to_3d()
    scene.collection.objects.link(e)
    return e


grip_mid = GRIP_TOP + GRIP_AX * 0.050
empty("GM_Grip", tuple(grip_mid))
empty("GM_Support", (0, TUBE_Y + 0.022, PUMP_Z - 0.020))
empty("GM_Muzzle", (0, BORE_Y, MUZZLE_Z))
empty("GM_Aim", (0, SIGHT_Y, REAR_SIGHT_Z))
empty("GM_Port", (0, R_BOT - 0.004, -0.080))
empty("GM_Under", (0, TUBE_Y - 0.0248, PUMP_Z - 0.010))
empty("GM_Rail", (0, RAIL_TOP, -0.050))

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
print(f"GM export: {OUT_GLB}  tris={tris}  size={os.path.getsize(OUT_GLB) // 1024} KB")

# ------------------------------------------------------------------ studio renders

if RENDER:
    os.makedirs(RENDER_DIR, exist_ok=True)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = int(os.environ.get("GM_SAMPLES", "64"))
    scene.cycles.use_denoising = True
    scene.render.resolution_x = int(os.environ.get("GM_W", "1400"))
    scene.render.resolution_y = int(os.environ.get("GM_H", "700"))
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.30, 0.31, 0.33, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8

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

    area("key", (0.9, -0.6, 0.9), 0.9, 80)
    area("fill", (-1.0, -0.2, 0.3), 1.2, 35, (0.9, 0.95, 1.0))
    area("rim", (0.1, 1.1, 0.6), 0.6, 60)
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -0.16))
    bpy.context.active_object.data.materials.append(material("floor", 0x3a3c3e, 0.6))

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

    views = os.environ.get("GM_VIEWS", "right,left,fp,front,grip").split(",")
    V = {
        "right": ((1.25, 0.05, -0.16), (0, -0.01, -0.16), 50),
        "left":  ((-1.25, 0.05, -0.16), (0, -0.01, -0.16), 50),
        "fp":    ((-0.10, 0.10, 0.42), (0.0, 0.0, -0.25), 40),
        "front": ((-0.30, 0.10, -0.95), (0, -0.01, -0.45), 50),
        "grip":  ((0.30, -0.08, 0.20), (0, -0.05, 0.02), 55),
    }
    for v in views:
        if v in V:
            shot(v, *V[v])
