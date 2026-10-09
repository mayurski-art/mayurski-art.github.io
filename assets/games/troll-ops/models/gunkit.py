"""
Shared helpers for the detailed first-person gun builders (build_beast,
build_coltlmg). Lifted from build_grinmington.blender.py: a Part collects
bmesh geometry in game coordinates (x right, y up, -z = muzzle forward,
metres, origin about the grip) and becomes one Blender object.

A builder imports this, fills `M` with its materials, builds its Parts,
drops its empties and calls export(). `M` is read by Part at face time.
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Matrix, Vector

TAU = math.tau
RX = Matrix.Rotation(math.radians(90), 4, "X")   # game (y up) -> Blender (z up)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
M = {}

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



def empty(name, pos):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.01
    e.location = (RX @ Vector(pos).to_4d()).to_3d()
    scene.collection.objects.link(e)
    return e


def export(path, tag):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=False, export_apply=True,
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
    print(f"{tag} export: {path}  tris={tris}  size={os.path.getsize(path) // 1024} KB")


def render_views(render_dir, views, env_prefix="GK"):
    """Studio renders for checking the model: views = {name: (eye, look, lens)} in game coords."""
    os.makedirs(render_dir, exist_ok=True)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = int(os.environ.get(env_prefix + "_SAMPLES", "48"))
    scene.cycles.use_denoising = True
    scene.render.resolution_x = int(os.environ.get(env_prefix + "_W", "1400"))
    scene.render.resolution_y = int(os.environ.get(env_prefix + "_H", "700"))
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
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -0.2))
    bpy.context.active_object.data.materials.append(material("floor", 0x3a3c3e, 0.6))
    cam_d = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam
    for name, (eye, look, lens) in views.items():
        e = (RX @ Vector(eye).to_4d()).to_3d()
        lk = (RX @ Vector(look).to_4d()).to_3d()
        cam.location = e
        cam.rotation_euler = (lk - e).to_track_quat("-Z", "Y").to_euler()
        cam_d.lens = lens
        scene.render.filepath = os.path.join(render_dir, name + ".png")
        bpy.ops.render.render(write_still=True)
        print("rendered", name)


def rsec(c, ex, ey, hw, hh, r, n=5):
    """Rounded rectangle centred on c in the plane (ex, ey): half sizes hw
    along ex, hh along ey."""
    c, ex, ey = Vector(c), Vector(ex).normalized(), Vector(ey).normalized()
    r = min(r, hw * 0.98, hh * 0.98)
    out = []
    for (sx, sy), a0 in (((1, 1), 0.0), ((-1, 1), 90.0), ((-1, -1), 180.0), ((1, -1), 270.0)):
        cx, cy = sx * (hw - r), sy * (hh - r)
        for i in range(n + 1):
            a = math.radians(a0 + 90.0 * i / n)
            out.append(c + ex * (cx + r * math.cos(a)) + ey * (cy + r * math.sin(a)))
    return out


def path_loft(P, centers, size_fn, key, n=5):
    """A solid swept down a path of centres, each section perpendicular to
    the path with its width along x: size_fn(t01) -> (hw, hd, r)."""
    pts = [Vector(c) for c in centers]
    secs = []
    for i, c in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        ex = Vector((1, 0, 0))
        ey = t.cross(ex).normalized()
        hw, hd, r = size_fn(i / (len(pts) - 1))
        secs.append(rsec(c, ex, ey, hw, hd, r, n))
    loft(P, secs, key)


def spike(P, root, direction, length, r, key, sides=5, tip_key=None, spin=0.0):
    """A faceted bone/crystal spike from root along direction, swelling a
    little near the base. tip_key paints the upper part another material."""
    d = Vector(direction).normalized()
    prof = [(-0.004, r * 0.9), (0.0, r), (length * 0.3, r * 0.82, tip_key or key), (length * 0.7, r * 0.38, tip_key or key), (length, 0.0)]
    local_lathe(P, root, d, prof, key, segs=sides, spin=spin)

# ------------------------------------------------------------------ traced references
# The assault rifles (build_ar_*.blender.py) are modelled on the side
# outlines traced for weapon-ars.js: the same pixels of the same reference,
# mapped to game metres exactly as weapon-traced.js maps them, so a part
# lands where the reference has it and the detailed gun sits in the hand
# where the traced one did.

class Ref:
    """weapon-traced.js's mapping: grip at z +0.02, bore on y 0."""
    def __init__(self, lengthM, pxLen, direction, boreY, gripAt):
        self.s = lengthM / (pxLen[1] - pxLen[0])
        self.dir, self.boreY, self.gx = direction, boreY, gripAt[0]

    def Z(self, px):
        return 0.02 + self.dir * (px - self.gx) * self.s

    def Y(self, py):
        return -(py - self.boreY) * self.s

    def P(self, px, py, x=0.0):
        return Vector((x, self.Y(py), self.Z(px)))

    def m(self, npx):
        return npx * self.s


def _pts(s):
    return [tuple(float(v) for v in p.split(",")) for p in s.split()]


def ars_outline(gun_id, js_path=None):
    """The traced outline of one rifle out of weapon-ars.js (AR_SPECS):
    {"outer": [...], "holes": [[...]], "mag": [...], "over": [[...]]}."""
    import re
    js_path = js_path or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "weapon-ars.js")
    src = open(js_path, encoding="utf8").read()
    i = src.index("  " + gun_id + ": {")
    j = src.find("\n  },", i)
    blk = src[i:j]
    body = blk[blk.index("body:"):blk.index("over:")]
    strs = re.findall(r'"([0-9, ]+)"', body)
    over = re.findall(r'poly: "([0-9, ]+)"', blk[blk.index("over:"):blk.index("mag:")])
    mag = re.search(r'mag: {[^}]*poly: "([0-9, ]+)"', blk).group(1)
    return {"outer": _pts(strs[0]), "holes": [_pts(h) for h in strs[1:]], "mag": _pts(mag), "over": [_pts(o) for o in over]}


def _cross(poly, axis, v):
    """Sorted crossings of a closed polygon with the line axis == v
    (axis 0: a vertical line x == v, returns ys; axis 1: y == v, returns xs)."""
    out = []
    n = len(poly)
    for k in range(n):
        a, b = poly[k], poly[(k + 1) % n]
        if (a[axis] > v) != (b[axis] > v):
            t = (v - a[axis]) / (b[axis] - a[axis])
            out.append(a[1 - axis] + t * (b[1 - axis] - a[1 - axis]))
    return sorted(out)


def span(poly, axis, v, win=None):
    """The extent of the polygon across the line axis == v, inside win
    (lo, hi) on the other axis: (lo, hi) in pixels, or None."""
    c = _cross(poly, axis, v)
    lo, hi = None, None
    for k in range(0, len(c) - 1, 2):
        a, b = c[k], c[k + 1]
        if win:
            a, b = max(a, win[0]), min(b, win[1])
        if b <= a:
            continue
        lo = a if lo is None else min(lo, a)
        hi = b if hi is None else max(hi, b)
    return None if lo is None else (lo, hi)


def _smooth(vals, k):
    if k <= 0:
        return vals
    out = []
    for i in range(len(vals)):
        w = vals[max(0, i - k):i + k + 1]
        out.append(sum(w) / len(w))
    return out


def side_loft(P, ref, poly, px0, px1, hw, r, key, step=6, ywin=None, hw_fn=None, pad=0.0, smooth=0, top=None, bot=None, cut=None):
    """A solid following the outline's top and bottom edges from px0 to
    px1: rounded sections, half-width hw (or hw_fn(t01)), corner radius r.
    ywin keeps it to one band of the outline (pixels); smooth averages the
    edges over that many neighbouring samples (traced edges are ragged);
    top / bot pin an edge to a straight line (pixels) for machined parts."""
    n = max(2, int(abs(px1 - px0) / step) + 1)
    rows = []
    for k in range(n):
        t = k / (n - 1)
        px = px0 + (px1 - px0) * t
        sp = span(poly, 0, px, ywin)
        if sp:
            lo = sp[1] if bot is None else bot
            for h in cut or []:          # an opening below (a trigger guard) stops the bottom edge
                hs = span(h, 0, px)
                if hs and hs[0] < lo:
                    lo = hs[0]
            rows.append((t, px, sp[0] if top is None else top, lo))
    if len(rows) < 2:
        return []
    tops = _smooth([r_[2] for r_ in rows], smooth)
    bots = _smooth([r_[3] for r_ in rows], smooth)
    secs = []
    for (t, px, _, _), ty, by in zip(rows, tops, bots):
        w = hw_fn(t) if hw_fn else hw
        secs.append(rrect(ref.Z(px), w, ref.Y(ty) + pad, ref.Y(by) - pad, r, n=4))
    loft(P, secs, key)
    return secs


def rrect_xz(y, zc, hz, hw, r, n=4):
    """A rounded rectangle in the horizontal plane at height y: x across
    +-hw, z across zc +- hz."""
    r = min(r, hw * 0.98, hz * 0.98)
    out = []
    for (sx, sz), a0 in (((1, 1), 0.0), ((-1, 1), 90.0), ((-1, -1), 180.0), ((1, -1), 270.0)):
        cx, cz = sx * (hw - r), zc + sz * (hz - r)
        for i in range(n + 1):
            a = math.radians(a0 + 90.0 * i / n)
            out.append((cx + r * math.cos(a), y, cz + r * math.sin(a)))
    return out


def vert_loft(P, ref, poly, py0, py1, hw, r, key, step=6, xwin=None, hw_fn=None, smooth=0):
    """A solid following the outline's front and back edges from py0 down to
    py1 (grips, mags): horizontal rounded sections."""
    n = max(2, int(abs(py1 - py0) / step) + 1)
    rows = []
    for k in range(n):
        t = k / (n - 1)
        py = py0 + (py1 - py0) * t
        sp = span(poly, 1, py, xwin)
        if sp:
            rows.append((t, py, sp[0], sp[1]))
    if len(rows) < 2:
        return []
    a = _smooth([r_[2] for r_ in rows], smooth)
    b = _smooth([r_[3] for r_ in rows], smooth)
    secs = []
    for (t, py, _, _), x0, x1 in zip(rows, a, b):
        z0, z1 = ref.Z(x0), ref.Z(x1)
        w = hw_fn(t) if hw_fn else hw
        secs.append(rrect_xz(ref.Y(py), (z0 + z1) / 2, abs(z1 - z0) / 2, w, r))
    loft(P, secs, key)
    return secs


def picatinny(P, z0, z1, y_base, hw, key="recv", slot="dark", pitch=0.0052):
    """A rail on y_base from z0 to z1: spine, crown and cross slots."""
    zc, L = (z0 + z1) / 2, abs(z1 - z0)
    box(P, (0, y_base + 0.004, zc), (hw * 2, 0.008, L), key)
    box(P, (0, y_base + 0.0085, zc), (hw * 2 + 0.004, 0.003, L), key)
    for k in range(int(L / pitch)):
        z = min(z0, z1) + pitch / 2 + k * pitch
        box(P, (0, y_base + 0.0102, z), (hw * 2 + 0.0045, 0.0007, pitch * 0.46), slot)


def bands(polys, px):
    """The solid runs across the vertical line x == px through an outline
    and its holes: [(top, bottom)] in pixels."""
    c = []
    for poly in polys:
        c += _cross(poly, 0, px)
    c.sort()
    return [(c[k], c[k + 1]) for k in range(0, len(c) - 1, 2) if c[k + 1] - c[k] > 2.5]


def auto_body(P, ref, polys, px0, px1, hw_fn, key_fn, r=0.004, step=5, smooth=1, splits=(), r_fn=None, flat=(), ycut=()):
    """The whole traced outline (outer + holes) as rounded solids: every
    band of solid down a column is followed across the gun as a track and
    lofted, so stocks, grips, guards and handles each become their own
    piece and the holes stay open. hw_fn(px, py) is the half-width,
    key_fn(px, py) the material; a track ends and restarts at each x in
    splits (a material change). flat = [(px0, px1, py)] holds the top
    band's top edge down to py there (a rail sits on it); ycut = [(px0, px1,
    py)] splits any band crossing py there, so a grip or guard hanging
    under the body is its own piece. Returns the tracks."""
    xs = []
    n = max(2, int(abs(px1 - px0) / step) + 1)
    for k in range(n):
        xs.append(px0 + (px1 - px0) * k / (n - 1))
    for sx in splits:
        if min(px0, px1) < sx < max(px0, px1):
            xs.append(sx)
    xs = sorted(set(xs), reverse=px1 < px0)
    splits = [sx for sx in splits if min(px0, px1) < sx < max(px0, px1)]
    tracks, live = [], []
    for x in xs:
        nxt, used = [], set()
        ivs = bands(polys, x)
        for (fx0, fx1, fpy) in flat:
            if ivs and min(fx0, fx1) <= x <= max(fx0, fx1) and ivs[0][0] < fpy < ivs[0][1]:
                ivs[0] = (fpy, ivs[0][1])
        for (cx0, cx1, cpy) in ycut:
            if min(cx0, cx1) <= x <= max(cx0, cx1):
                cut = []
                for (a, b_) in ivs:
                    if a + 2 < cpy < b_ - 2:
                        cut += [(a, cpy), (cpy, b_)]
                    else:
                        cut.append((a, b_))
                ivs = cut
        for iv in ivs:
            best, bo = None, 0.0
            for t in live:
                if id(t) in used:
                    continue
                o = min(t[-1][2], iv[1]) - max(t[-1][1], iv[0])
                if o > bo:
                    best, bo = t, o
            if best is None:
                best = []
                tracks.append(best)
            best.append((x, iv[0], iv[1]))
            used.add(id(best))
            nxt.append(best)
        if x in splits:              # a material change: every band restarts here
            fresh = []
            for t in nxt:
                t2 = [t[-1]]
                tracks.append(t2)
                fresh.append(t2)
            nxt = fresh
        live = nxt
    for t in tracks:
        if len(t) < 2:
            continue
        tops = _smooth([p[1] for p in t], smooth)
        bots = _smooth([p[2] for p in t], smooth)
        xm, ym = t[len(t) // 2][0], (t[len(t) // 2][1] + t[len(t) // 2][2]) / 2
        key = key_fn(xm, ym)
        secs = []
        for (x, _, _), ty, by in zip(t, tops, bots):
            yc = (ty + by) / 2
            rr = r_fn(x, yc) if r_fn else r
            secs.append(rrect(ref.Z(x), hw_fn(x, yc), ref.Y(ty), ref.Y(by), rr, n=4))
        loft(P, secs, key)
    return tracks


# ------------------------------------------------------------------ slab bodies
# The Green Candles look: flat-sided panels with even rounded edges. The
# traced outline is cleaned (smoothed along the contour, then simplified to
# straight runs), filled with its holes open, and extruded region by region (each its own half-width and material), and
# edge-rounded with a bevel.

def clean_outline(poly, smooth=2, eps=1.6, step=2.0):
    """Resample a traced contour every `step` px, smooth it along the
    contour (moving average, k each side) and Douglas-Peucker it (eps px)."""
    pts = []
    n = len(poly)
    for k in range(n):
        a, b = poly[k], poly[(k + 1) % n]
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        m = max(1, int(d / step))
        for i in range(m):
            t = i / m
            pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    if smooth > 0:
        n = len(pts)
        sm = []
        for i in range(n):
            xs = [pts[(i + j) % n] for j in range(-smooth, smooth + 1)]
            sm.append((sum(p[0] for p in xs) / len(xs), sum(p[1] for p in xs) / len(xs)))
        pts = sm

    def dp(seq):
        if len(seq) < 3:
            return seq
        a, b = seq[0], seq[-1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1e-9
        far, fi = -1, 0
        for i in range(1, len(seq) - 1):
            d = abs((seq[i][0] - a[0]) * dy - (seq[i][1] - a[1]) * dx) / L
            if d > far:
                far, fi = d, i
        if far <= eps:
            return [a, b]
        return dp(seq[:fi + 1])[:-1] + dp(seq[fi:])

    # split the closed loop at its two most distant points so DP runs on open runs
    i0 = 0
    i1 = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
    out = dp(pts[i0:i1 + 1])[:-1] + dp(pts[i1:] + [pts[0]])[:-1]
    return out


def slab_body(P, ref, outer, holes, regions, clip=(), smooth=2, eps=1.6, bevel=0.0022, bevel_segs=2):
    """The traced outline as edge-rounded slabs. regions = [dict(rect=(px0,
    px1, py0, py1), hw=half-width m, key=material)]; an earlier region wins
    where rects overlap. clip = [(px0, px1, py0, py1)] is cut out (a rail's
    bed). The outline is filled with its holes open, sliced along every
    rect edge, and each region extruded to its half-width; a wall stands
    only where a region is wider than its neighbour (or on the outside),
    so equal neighbours join seamlessly; then the edges are rounded."""
    loops = [clean_outline(outer, smooth, eps)] + [clean_outline(h, max(1, smooth - 1), eps * 0.8) for h in holes]
    bm = bmesh.new()
    edges = []
    for lp in loops:
        vs = [bm.verts.new((0.0, ref.Y(py), ref.Z(px))) for (px, py) in lp]
        for k in range(len(vs)):
            edges.append(bm.edges.new((vs[k], vs[(k + 1) % len(vs)])))
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges)
    for e in [e for e in bm.edges if not e.link_faces]:
        bm.edges.remove(e)
    # slice along every finite rect edge
    lines = set()
    for rg in list(regions) + [dict(rect=c) for c in clip]:
        x0, x1, y0, y1 = rg["rect"]
        for px in (x0, x1):
            if -900 < px < 1900:
                lines.add((0, ref.Z(px)))
        for py in (y0, y1):
            if -900 < py < 1900:
                lines.add((1, ref.Y(py)))
    for axis, v in sorted(lines):
        geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
        co, no = (Vector((0, 0, v)), Vector((0, 0, 1))) if axis == 0 else (Vector((0, v, 0)), Vector((0, 1, 0)))
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, dist=1e-7)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))

    def inside(rect, y, z):
        x0, x1 = sorted((ref.Z(rect[0]), ref.Z(rect[1])))
        y0, y1 = sorted((ref.Y(rect[2]), ref.Y(rect[3])))
        return x0 <= z <= x1 and y0 <= y <= y1

    reg = {}
    for f in list(bm.faces):
        c = f.calc_center_median()
        if any(inside(cr, c.y, c.z) for cr in clip):
            bm.faces.remove(f)
            continue
        reg[f] = next((i for i, rg in enumerate(regions) if inside(rg["rect"], c.y, c.z)), None)
        if reg[f] is None:
            bm.faces.remove(f)
            del reg[f]
    hw = [rg["hw"] for rg in regions]

    out = bmesh.new()
    cache = {}

    def V(v, x):
        k = (v.index, round(x, 7))
        if k not in cache:
            cache[k] = out.verts.new((x, v.co.y, v.co.z))
        return cache[k]

    bm.verts.index_update()
    for f, i in reg.items():
        h = hw[i]
        vs = list(f.verts)
        for s in (1, -1):
            seq = vs if s > 0 else vs[::-1]
            nf = out.faces.new([V(v, s * h) for v in seq])
            nf.material_index = i
        for e in f.edges:
            others = [g for g in e.link_faces if g is not f and g in reg]
            hn = hw[reg[others[0]]] if others else 0.0
            if hn >= h - 1e-7:
                continue
            a, b = e.verts
            # keep the wall's winding with the face's loop order
            for lo in f.loops:
                if lo.edge is e:
                    a, b = lo.vert, lo.link_loop_next.vert
            for (x0, x1) in ((hn, h), (-h, -hn)) if hn > 0 else ((-h, h),):
                q = [V(a, x0), V(b, x0), V(b, x1), V(a, x1)]
                if len({id(t) for t in q}) == 4:
                    try:
                        wf = out.faces.new(q)
                        wf.material_index = i
                    except ValueError:
                        pass
    bm.free()
    bmesh.ops.remove_doubles(out, verts=out.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(out, faces=out.faces)
    # round the edges on a temp object, then take the result into the part
    me = bpy.data.meshes.new("slab")
    out.to_mesh(me)
    out.free()
    for rg in regions:
        me.materials.append(M[rg["key"]])
    ob = bpy.data.objects.new("slab", me)
    scene.collection.objects.link(ob)
    if bevel > 0:
        bv = ob.modifiers.new("bevel", "BEVEL")
        bv.width = bevel
        bv.segments = bevel_segs
        bv.limit_method = "ANGLE"
        bv.angle_limit = math.radians(35)
        bv.miter_outer = "MITER_ARC"
        bv.use_clamp_overlap = True
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me2 = bpy.data.meshes.new_from_object(ev)
    nf = len(P.bm.faces)
    P.bm.from_mesh(me2)
    P.bm.faces.ensure_lookup_table()
    keys = [P.mi(rg["key"]) for rg in regions]
    for f in P.bm.faces[nf:]:
        f.material_index = keys[min(f.material_index, len(keys) - 1)]
        f.smooth = True
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    bpy.data.meshes.remove(me2)
    return loops
