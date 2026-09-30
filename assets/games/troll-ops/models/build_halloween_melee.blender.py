"""
The Halloween melee weapons, detailed models (gear.js MELEE_DEFS `chainsaw`
and `reaper`, loaded by melee-models.js).

    blender --background --python build_halloween_melee.blender.py            # export both .glb
    blender --background --python build_halloween_melee.blender.py -- render  # + studio renders

Game coordinates like the other builds (x right, y up, blade out along -z,
metres, origin at the grip), turned into Blender Z-up per mesh (RX); the glTF
exporter turns it back.

Chainsaw (chainsaw.glb): after the classic horror saw the user sent. Rust-red
lofted powerhead, the pull-start cover with its louvred grille on the right,
fuel cap and hump on top, muffler on the left, a black hoop handle over the
front, the tan wrapped rear handle in its D frame (the grip), and a long bar
with a darker rail, rivets, the clutch cover and bar nuts, well bloodied.
The chain is NOT in here: melee-models.js runs its teeth round the bar live.
  CS_Body  (one mesh)   CS_Throttle (the trigger, pivots at its origin)
  CS_Grip / CS_Support / CS_Exhaust  empties

Reaper's Grin (reaper.glb): a reaper's scythe cut down to a knife. A curved
black blade hooking up to the point with a notched spine and a heel spike,
a glowing violet edge and fuller, bone horns round an iron collar and a
violet soul gem, a wrapped grip with bands, and a bone skull pommel with
glowing eyes (the game prints the trollface grin on it, at RG_Face).
  RG_Knife (one mesh)   RG_Grip / RG_Face  empties
Materials tuned by name in the game: RG_Glow, RG_Gem.
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Matrix, Vector

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
RENDER = "render" in sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else False
RENDER_DIR = os.environ.get("HW_RENDER_DIR", os.path.join(OUT_DIR, "_renders"))
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


# ------------------------------------------------------------------ materials

M = {
    # Chainsaw
    "paint":   material("CS_Paint", 0x7a1c17, 0.46, 0.25),
    "paintD":  material("CS_PaintDark", 0x4a100d, 0.55, 0.25),
    "black":   material("CS_Black", 0x121212, 0.5, 0.1),
    "wrap":    material("CS_Wrap", 0xb3976a, 0.95, 0.0),
    "grille":  material("CS_Grille", 0x1e1e1f, 0.4, 0.7),
    "bar":     material("CS_Bar", 0xb8bcc2, 0.3, 1.0),
    "barD":    material("CS_BarDark", 0x6f747b, 0.45, 1.0),
    "nut":     material("CS_Nut", 0x9ea3aa, 0.3, 1.0),
    "blood":   material("CS_Blood", 0x520303, 0.18, 0.0),
    "bloodD":  material("CS_BloodDry", 0x2e0302, 0.6, 0.0),
    # Reaper's Grin
    "rblade":  material("RG_Blade", 0xdde0e4, 0.1, 1.0),
    "grind":   material("RG_Grind", 0xb3b8bf, 0.32, 1.0),
    "rhandle": material("RG_HandleSteel", 0xc2c6cc, 0.34, 1.0),
    "panel":   material("RG_Panel", 0x9ea3aa, 0.5, 1.0),
    "liner":   material("RG_Liner", 0x2a2c30, 0.45, 0.8),
    "screw":   material("RG_Screw", 0x2f86e0, 0.22, 1.0),
    "dark":    material("RG_Dark", 0x080609, 0.7, 0.0),
}

import random
rnd = random.Random(0xC4A1)


def prism(P, outline, x0, x1, key, side_key=None):
    """A flat plate: the (y, z) outline extruded from x0 to x1 (game coords)."""
    a = [P.v((x0, y, z)) for (y, z) in outline]
    b = [P.v((x1, y, z)) for (y, z) in outline]
    n = len(outline)
    P.face(list(reversed(a)), key)
    P.face(b, key)
    for k in range(n):
        k2 = (k + 1) % n
        P.face([a[k], a[k2], b[k2], b[k]], side_key or key)


def rrect(z, hw, hh, yc, n=28, p=3.0, xc=0.0):
    """A rounded rectangle cross-section in the x-y plane at depth z."""
    out = []
    for k in range(n):
        t = TAU * k / n
        c, s = math.cos(t), math.sin(t)
        out.append((xc + hw * math.copysign(abs(c) ** (2 / p), c), yc + hh * math.copysign(abs(s) ** (2 / p), s), z))
    return out


def splat(P, center, normal, r, key, pts=11):
    """A blood splat: an irregular flat blob a hair off a surface, with a few
    satellite drops round it."""
    t, n, b = frame_from_normal(normal)
    c = Vector(center) + n * 0.0004
    ring = []
    for k in range(pts):
        a = TAU * k / pts
        rr = r * (0.6 + rnd.random() * 0.55)
        ring.append(P.v(c + t * (math.cos(a) * rr) + b * (math.sin(a) * rr * (0.7 + rnd.random() * 0.5))))
    P.face(ring, key)
    for _ in range(rnd.randint(1, 3)):
        a = rnd.random() * TAU
        d = r * (1.3 + rnd.random() * 0.9)
        rr = r * (0.12 + rnd.random() * 0.22)
        cc = c + t * (math.cos(a) * d) + b * (math.sin(a) * d)
        P.face([P.v(cc + t * (math.cos(TAU * j / 6) * rr) + b * (math.sin(TAU * j / 6) * rr)) for j in range(6)], key)


def empty(name, pos):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.01
    e.location = (RX @ Vector(pos).to_4d()).to_3d()
    scene.collection.objects.link(e)
    return e


def export(path, prefix):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in scene.objects:
        if ob.name.startswith(prefix):
            ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_extras=False)
    tris = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in scene.objects:
        if ob.type == "MESH" and ob.name.startswith(prefix):
            me = ob.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            tris += len(me.loop_triangles)
            ob.evaluated_get(dg).to_mesh_clear()
    print(f"export {path} tris={tris} size={os.path.getsize(path) // 1024} KB")


# ================================================================== CHAINSAW
# Game coords: origin in the rear handle's grip, bar out along -z, the
# pull-start on the +x (right) side. Numbers the game reads back (chain path)
# are the CS_* constants in melee-models.js; keep them in step.

BAR_Z0, BAR_LEN, BAR_H, BAR_T, BAR_YC = -0.30, 0.56, 0.078, 0.0085, -0.018

body = Part("CS_Body")

# Rear handle: the wrapped grip, ribbed, inside a D-shaped black frame.
prof = []
for i in range(15):
    z = 0.065 - i * 0.0095
    prof.append((z, 0.0165 if i % 2 == 0 else 0.0178))
lathe(body, [(0.078, 0.0)] + [(z, r) for z, r in prof] + [(-0.075, 0.0)], "wrap", segs=20)
frame = catmull([(0, 0.0, -0.085), (0, -0.036, -0.07), (0, -0.05, 0.0), (0, -0.04, 0.075), (0, -0.005, 0.1),
                 (0, 0.035, 0.092), (0, 0.052, 0.03), (0, 0.05, -0.05), (0, 0.03, -0.09)], 40)
sweep(body, frame, lambda s: 0.0105, "black", sides=12, uv=False)

# Powerhead: a lofted, rounded shell, fatter in the middle.
secs = []
for z, hw, hh, yc in ((-0.085, 0.045, 0.058, 0.018), (-0.11, 0.058, 0.08, 0.028), (-0.17, 0.062, 0.088, 0.032),
                      (-0.24, 0.06, 0.084, 0.03), (-0.285, 0.054, 0.072, 0.022), (-0.305, 0.045, 0.058, 0.016)):
    secs.append(rrect(z, hw, hh, yc))
loft(body, secs, "paint")
# The engine hump and fuel cap on top.
loft(body, [rrect(-0.13, 0.038, 0.012, 0.118, p=2.4), rrect(-0.16, 0.042, 0.024, 0.122, p=2.4),
            rrect(-0.23, 0.04, 0.02, 0.118, p=2.4), rrect(-0.255, 0.032, 0.01, 0.112, p=2.4)], "paintD")
local_lathe(body, (-0.022, 0.118, -0.105), (0, 1, 0), [(0, 0.017), (0.012, 0.017), (0.016, 0.014), (0.017, 0)], "black", segs=18)
for k in range(10):   # grip ridges round the cap
    a = TAU * k / 10
    box(body, (-0.022 + math.cos(a) * 0.017, 0.124, -0.105 + math.sin(a) * 0.017), (0.004, 0.012, 0.004), "black")
# Skid plate under it.
box(body, (0, -0.058, -0.2), (0.11, 0.012, 0.2), "paintD")

# Pull-start cover (right), louvred grille and the cord handle.
local_lathe(body, (0.058, 0.03, -0.19), (1, 0, 0), [(0.0, 0.078), (0.008, 0.078), (0.016, 0.072), (0.021, 0.063), (0.022, 0.0)], "paintD", segs=36)
for i in range(7):
    y = 0.03 - 0.045 + i * 0.015
    half = math.sqrt(max(0.0, 0.052 ** 2 - (y - 0.03) ** 2))
    if half > 0.006:
        box(body, (0.082, y, -0.19), (0.006, 0.006, half * 2), "grille")
local_lathe(body, (0.058, 0.03, -0.19), (1, 0, 0), [(0.0, 0.056), (0.0235, 0.056), (0.0235, 0.052), (0.02, 0.052)], "black", segs=36)
box(body, (0.07, 0.112, -0.1), (0.022, 0.018, 0.05), "black")
cord = catmull([(0.07, 0.108, -0.1), (0.074, 0.09, -0.13), (0.078, 0.07, -0.15)], 10)
sweep(body, cord, lambda s: 0.0022, "black", sides=6, uv=False)

# Muffler on the left.
box(body, (-0.066, 0.0, -0.25), (0.02, 0.05, 0.07), "barD")
for i in range(4):
    box(body, (-0.077, -0.015 + i * 0.01, -0.25), (0.003, 0.004, 0.05), "black")

# Front hoop handle, over the top and down both sides.
hoop = catmull([(-0.075, -0.035, -0.28), (-0.078, 0.06, -0.275), (-0.05, 0.155, -0.27), (0.0, 0.175, -0.268),
                (0.05, 0.155, -0.27), (0.078, 0.06, -0.275), (0.075, -0.035, -0.28)], 48)
sweep(body, hoop, lambda s: 0.0125, "black", sides=14, uv=False)

# Clutch cover where the bar goes in (right side) with the two bar nuts.
loft(body, [rrect(-0.28, 0.02, 0.05, BAR_YC + 0.005, xc=0.028, p=2.6), rrect(-0.33, 0.018, 0.045, BAR_YC + 0.004, xc=0.026, p=2.6),
            rrect(-0.37, 0.012, 0.03, BAR_YC + 0.003, xc=0.02, p=2.6)], "paintD")
for z in (-0.315, -0.345):
    local_lathe(body, (0.046, BAR_YC, z), (1, 0, 0), [(0, 0.0085), (0.006, 0.0085), (0.007, 0.006), (0.007, 0)], "nut", segs=6)

# The bar: a flat plate with a round nose, a darker rail round its edge.
def bar_outline(inset=0.0):
    pts = []
    h = BAR_H / 2 - inset
    tip = BAR_Z0 - BAR_LEN
    for k in range(10):
        pts.append((BAR_YC + h, BAR_Z0 + 0.02 - k * (BAR_LEN - 0.02) / 10))
    for k in range(17):
        a = math.pi * k / 16
        pts.append((BAR_YC + h * math.cos(a), tip - h * math.sin(a)))
    for k in range(1, 10):
        pts.append((BAR_YC - h, tip + k * (BAR_LEN - 0.02) / 10))
    pts.append((BAR_YC - h * 0.9, BAR_Z0 + 0.03))
    pts.append((BAR_YC + h * 0.9, BAR_Z0 + 0.03))
    return pts


prism(body, bar_outline(), -BAR_T / 2, BAR_T / 2, "barD")
for side in (1, -1):
    x = side * (BAR_T / 2 + 0.0003)
    ring = [body.v((x, y, z)) for (y, z) in bar_outline(0.007)]
    body.face(ring if side > 0 else list(reversed(ring)), "bar")
for k in range(5):
    for side in (1, -1):
        local_lathe(body, (side * BAR_T / 2, BAR_YC + (0.02 if k % 2 else -0.02), BAR_Z0 - 0.07 - k * 0.1), (side, 0, 0),
                    [(0, 0.0045), (0.0012, 0.004), (0.0016, 0)], "nut", segs=10)

# Blood: splats on both faces of the bar, heaviest toward the nose; drips
# along the bottom edge; spray on the front of the powerhead.
for i in range(34):
    k = rnd.random() ** 0.55
    z = BAR_Z0 - 0.04 - k * (BAR_LEN - 0.06)
    y = BAR_YC + (rnd.random() - 0.5) * BAR_H * 0.75
    side = 1 if rnd.random() < 0.5 else -1
    splat(body, (side * (BAR_T / 2 + 0.0004), y, z), (side, 0, 0), 0.004 + rnd.random() * 0.011 * (0.4 + k),
          "blood" if rnd.random() < 0.7 else "bloodD")
for i in range(14):
    a = rnd.random() * TAU
    splat(body, (math.cos(a) * 0.022, 0.018 + math.sin(a) * 0.03, -0.3056), (0, 0, -1), 0.0025 + rnd.random() * 0.005, "blood")
for i in range(8):
    splat(body, (-0.061, 0.0 + rnd.random() * 0.1, -0.12 - rnd.random() * 0.15), (-1, 0, 0), 0.003 + rnd.random() * 0.008, "bloodD")

body.finish(bevel=0.0012, bevel_segs=2)

# The throttle trigger under the rear handle, its own node so the game can
# squeeze it when the saw revs: pivots at its front end (the node origin).
throttle = Part("CS_Throttle", pivot=(0, -0.017, -0.052))
box(throttle, (0, -0.025, -0.03), (0.009, 0.013, 0.04), "black")
box(throttle, (0, -0.031, -0.014), (0.0095, 0.007, 0.016), "black")
throttle.finish(bevel=0.0008, bevel_segs=1)

empty("CS_Grip", (0, 0, 0))
empty("CS_Support", (0.0, 0.175, -0.268))
empty("CS_Exhaust", (-0.08, 0.0, -0.25))   # the muffler outlet: exhaust smoke comes out here
export(os.path.join(OUT_DIR, "chainsaw.glb"), "CS_")

# ================================================================== REAPER'S GRIN
# A karambit folder after the user's reference: a hooked mirror blade with
# three holes and a notched spine on a pivot, a satin steel handle that
# flares at the butt with a darker liner round it, an inset panel on each
# face (the game prints its engraving there: a hooded trollface reaper),
# blue anodised screws and a thumb stud. Origin mid-grip, blade out along
# -z (open), the flat facing +/-y, the edge (inside of the hook) toward +x.
# The blade is its own node pivoting on RG_Pivot about y, so the game can
# fold it shut and flick it open.

PIV = Vector((0.0, 0.0, -0.068))
HT = 0.017          # handle thickness
BT = 0.0042         # blade thickness


def smooth01(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def handle_outline():
    left, right = [], []
    for k in range(17):
        z = 0.082 - k * (0.154 / 16)
        bend = 0.011 * smooth01(z / 0.085)   # the handle bows toward the edge side down to the butt
        left.append((bend - (0.0145 + 0.0075 * smooth01((z - 0.03) / 0.05)), z))
        right.append((bend + 0.0145 + 0.0125 * smooth01((z - 0.015) / 0.065) - 0.002 * smooth01((-z - 0.03) / 0.04), z))
    top = []
    for k in range(1, 8):   # round the top end over the pivot
        a = math.pi * k / 8
        top.append((-0.0165 * math.cos(a), -0.072 - 0.012 * math.sin(a)))
    butt = [(0.031 - k * 0.0102, 0.086 + 0.002 * math.sin(math.pi * k / 5)) for k in range(1, 6)]
    return left + top + list(reversed(right)) + butt


def scale_outline(pts, k, cx=0.0, cz=0.0):
    return [(cx + (x - cx) * k, cz + (z - cz) * k) for (x, z) in pts]


def plate(P, outline, y0, y1, key, side_key=None):
    """An outline in x-z extruded through y (the knife's flat faces +/-y)."""
    a = [P.v((x, y0, z)) for (x, z) in outline]
    b = [P.v((x, y1, z)) for (x, z) in outline]
    n = len(outline)
    P.face(list(reversed(a)), key)
    P.face(b, key)
    for k in range(n):
        k2 = (k + 1) % n
        P.face([a[k], a[k2], b[k2], b[k]], side_key or key)


handle = Part("RG_Handle")
HO = handle_outline()
plate(handle, HO, -HT / 2, -0.0025, "rhandle")
plate(handle, HO, 0.0025, HT / 2, "rhandle")
# The liner between the scales, a hair inside them all round (shrunk about
# the handle's own bowed centre line), so it shows only as a dark seam.
LINER = [(0.011 * smooth01(z / 0.085) + (x - 0.011 * smooth01(z / 0.085)) * 0.95, z * 0.985) for (x, z) in HO]
plate(handle, LINER, -0.0026, 0.0026, "liner")
for side in (1, -1):   # the inset panel the engraving sits on
    panel = [(x * 0.72 + 0.001, z) for (x, z) in HO if -0.05 < z < 0.07]
    ring = [handle.v((x, side * (HT / 2 + 0.0002), z)) for (x, z) in panel]
    handle.face(ring if side > 0 else list(reversed(ring)), "panel")
# Screws (blue anodised) both faces, and the pivot bolt.
for (x, z, r) in ((0.0, PIV.z, 0.0052), (-0.006, -0.018, 0.0034), (0.006, 0.032, 0.0034), (0.013, 0.068, 0.0036)):
    for side in (1, -1):
        screw(handle, (x, side * HT / 2, z), (0, side, 0), r=r, key="screw")
for side in (1, -1):
    local_lathe(handle, (0.012, side * HT / 2, 0.078), (0, side, 0), [(0, 0.0032), (0.0006, 0.0032), (0.0006, 0.0)], "dark", segs=12)
handle_ob = handle.finish(bevel=0.0011, bevel_segs=3)

blade = Part("RG_Blade", pivot=PIV)
spine = [(-0.012, -0.062), (-0.0155, -0.075)]
for k in range(8):   # jimping on the spine by the thumb
    z = -0.08 - k * 0.0034
    spine.append((-0.0185 if k % 2 == 0 else -0.0165, z))
# A karambit hook: the spine sweeps round and the point pulls hard back
# toward the edge side; the edge is the inside of the curve.
spine += [(-0.021, -0.115), (-0.0205, -0.133), (-0.014, -0.155), (-0.001, -0.176), (0.019, -0.194), (0.043, -0.207),
          (0.068, -0.2135), (0.088, -0.213), (0.104, -0.207)]
edge = [(0.093, -0.2005), (0.074, -0.1975), (0.054, -0.1905), (0.037, -0.178), (0.025, -0.161), (0.0185, -0.141),
        (0.0175, -0.12), (0.019, -0.1), (0.021, -0.082), (0.019, -0.066), (0.012, -0.058)]
BO = spine + edge
plate(blade, BO, -BT / 2, BT / 2, "rblade")
blade_ob = blade.finish(bevel=0.0006, bevel_segs=2)
# The grind lines and thumb stud ride with the blade on the same pivot, as
# their own mesh: the hole boolean wants the plate on its own.
trim = Part("RG_BladeTrim", pivot=PIV)
# A satin grind line inside the edge on both faces (the edge itself mirror).
for side in (1, -1):
    grind = [Vector((x - 0.006 * (1 - k / len(edge)), side * (BT / 2 + 0.0002), z)) for k, (x, z) in enumerate(reversed(edge[1:-1]))]
    sweep(trim, grind, lambda s: 0.0007, "grind", sides=5, uv=False)
# Thumb stud.
local_lathe(trim, (-0.011, BT / 2, -0.083), (0, 1, 0), [(0, 0.0032), (0.004, 0.003), (0.0048, 0.0)], "rhandle", segs=12)
local_lathe(trim, (-0.011, -BT / 2, -0.083), (0, -1, 0), [(0, 0.0032), (0.004, 0.003), (0.0048, 0.0)], "rhandle", segs=12)
trim.finish()

# Three holes through the blade (a boolean, applied on export).
for i, (x, z, r) in enumerate(((-0.0065, -0.1, 0.0056), (-0.0045, -0.119, 0.0046), (0.0005, -0.136, 0.0036))):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r, depth=0.03, location=(RX @ Vector((x, 0, z)).to_4d()).to_3d(),
                                        rotation=(0, 0, 0))
    cut = bpy.context.active_object
    cut.name = f"cut_{i}"   # RX maps game y (through the flat) to Blender z, the cylinder's own axis
    mod = blade_ob.modifiers.new(f"hole{i}", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cut
    mod.solver = "EXACT"
    cut.hide_render = True
    cut.hide_viewport = True
# The boolean has to run before the bevel/normals modifiers.
for i in range(3):
    m = blade_ob.modifiers[f"hole{i}"]
    bpy.context.view_layer.objects.active = blade_ob
    bpy.ops.object.modifier_move_to_index(modifier=m.name, index=i)

empty("RG_Grip", (0, 0, 0))
empty("RG_Pivot", tuple(PIV))
empty("RG_Panel", (0.001, HT / 2 + 0.0004, 0.01))
export(os.path.join(OUT_DIR, "reaper.glb"), "RG_")

# ------------------------------------------------------------------ studio renders

if RENDER:
    os.makedirs(RENDER_DIR, exist_ok=True)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = int(os.environ.get("HW_SAMPLES", "96"))
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 900
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.03, 0.032, 0.036, 1)

    def area(name, loc, size, power, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.size = size
        ld.energy = power
        ld.color = color
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

    area("key", (0.8, -0.6, 0.9), 0.8, 90)
    area("fill", (-1.0, -0.3, 0.3), 1.2, 30, (0.85, 0.9, 1.0))
    area("rim", (0.0, 1.1, 0.6), 0.6, 70)
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

    def only(prefix):
        for ob in scene.objects:
            if ob.type == "MESH":
                ob.hide_render = not ob.name.startswith(prefix)

    only("CS_")
    shot("chainsaw-right", (1.25, 0.35, -0.55), (0, 0.0, -0.35), 40)
    shot("chainsaw-left", (-1.2, 0.45, -0.3), (0, 0.0, -0.35), 40)
    only("RG_")
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.16, 0.17, 0.19, 1)
    shot("reaper-side", (0.03, 0.95, -0.06), (0.03, 0, -0.06), 50)
    shot("reaper-3q", (0.45, 0.62, 0.2), (0.03, 0, -0.06), 50)
