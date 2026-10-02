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
