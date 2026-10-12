"""
Shared kit for the TROLLS NFT trait sets (build_traits.blender.py), on top
of hero_kit.py: a trait is a few rigid pieces named "<joint>__<piece>" in
the rig's REST pose, like a hero body, so hero-bodies.js can wear it.

What this adds:
  surface()   a BVH over a mesh, for fitting a piece to another (a cap to
              the head, a moustache to the face, lettering to the cap)
  sweep()     a tapered tube along a polyline (moustaches, seams, piping)
  lettering() real type (Impact, like the art) wrapped round a surface
  cap()       a six-panel ball cap measured off the head it sits on

All coordinates are GAME coords (metres, feet on y=0, forward -Z, the
wearer's right +X); hero_kit.B() turns them into Blender's.
"""
import math
import os

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import hero_kit as K
from hero_kit import V

TAU = math.tau
IMPACT = "C:/Windows/Fonts/impact.ttf"


def G(p):
    """Blender coords -> game coords (inverse of K.B)."""
    return Vector((p.x, p.z, -p.y))


# ------------------------------------------------------------------ fitting
class Surface:
    """Ray casts against a mesh object, in game coords."""

    def __init__(self, ob):
        me = ob.data
        self.bvh = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])

    def cast(self, origin, direction, dist=5.0):
        loc, nrm, _i, _d = self.bvh.ray_cast(K.B(origin), K.B(direction).normalized(), dist)
        return (G(loc), G(nrm)) if loc is not None else (None, None)

    def out_from(self, center, direction, dist=5.0):
        """The FARTHEST hit along a ray from inside: the outer skin, even
        where a concave mesh is crossed twice."""
        c, d = V(center), V(direction).normalized()
        far = None
        start = c
        for _ in range(8):
            hit, _n = self.cast(start, d, dist)
            if hit is None:
                break
            far = hit
            start = hit + d * 1e-4
        return far

    def front(self, x, y, z0=-1.0):
        """First hit looking straight back (+Z) from in front at (x, y)."""
        hit, _n = self.cast(V(x, y, z0), V(0, 0, 1))
        return hit


def surface(ob):
    return Surface(ob)


# ------------------------------------------------------------------ geometry
def _frames(pts, closed):
    n = len(pts)
    tans = []
    for i in range(n):
        if closed:
            a, b = pts[i - 1], pts[(i + 1) % n]
        else:
            a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]
        tans.append((b - a).normalized())
    ref = Vector((0, 1, 0)) if abs(tans[0].y) < 0.9 else Vector((1, 0, 0))
    nrm = (ref - tans[0] * ref.dot(tans[0])).normalized()
    frames = []
    for i, t in enumerate(tans):
        if i:
            # parallel transport: no twisting along the tube
            nrm = (nrm - t * nrm.dot(t)).normalized()
        frames.append((t, nrm, t.cross(nrm).normalized()))
    return frames


def sweep(name, pts, radii, segs=10, closed=False, mat=None, flat=1.0, flute=0.0, flutes=7):
    """A tube through `pts` (game coords), radius radii[i] at each point
    (a single number: constant). `flat` squashes the cross-section along
    the binormal (a ribbon-ish moustache). Open ends are capped."""
    pts = [V(p) for p in pts]
    if not isinstance(radii, (list, tuple)):
        radii = [radii] * len(pts)
    fr = _frames(pts, closed)
    verts, faces = [], []
    for p, r, (t, n, b) in zip(pts, radii, fr):
        for k in range(segs):
            th = TAU * k / segs
            rr = r * (1 + flute * math.cos(flutes * th))     # fluted: combed strands, cable twists
            verts.append(p + n * (math.cos(th) * rr) + b * (math.sin(th) * rr * flat))
    m = len(pts)
    rings = m if closed else m - 1
    for i in range(rings):
        j = (i + 1) % m
        for k in range(segs):
            k2 = (k + 1) % segs
            faces.append((i * segs + k, i * segs + k2, j * segs + k2, j * segs + k))
    if not closed:
        for end, idx in ((0, 0), (m - 1, (m - 1) * segs)):
            verts.append(pts[end])
            c = len(verts) - 1
            for k in range(segs):
                k2 = (k + 1) % segs
                faces.append((c, idx + k2, idx + k) if end == 0 else (c, idx + k, idx + k2))
    ob = K.mesh_obj(name, verts, faces, mat)
    recalc(ob)
    return ob


def recalc(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return ob


def smooth_path(pts, iters=2):
    """Chaikin corner cutting: a few hand-placed points -> a smooth curve."""
    pts = [V(p) for p in pts]
    for _ in range(iters):
        out = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            out += [a.lerp(b, 0.25), a.lerp(b, 0.75)]
        out.append(pts[-1])
        pts = out
    return pts


def resample(vals, n):
    """Linear resample of a list of numbers to n entries."""
    out = []
    for i in range(n):
        f = i / (n - 1) * (len(vals) - 1)
        a = int(f)
        b = min(a + 1, len(vals) - 1)
        out.append(vals[a] + (vals[b] - vals[a]) * (f - a))
    return out


# ------------------------------------------------------------------ type
def _text_mesh(text, font, shear):
    cu = bpy.data.curves.new("txt", type="FONT")
    cu.body = text
    cu.font = bpy.data.fonts.load(font, check_existing=True)
    cu.size = 1.0
    cu.shear = shear
    cu.extrude = 0.05
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.resolution_u = 6
    ob = bpy.data.objects.new("txt", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    # Glyph faces are long slivers; wrapped round a curve their flat chords
    # sink into the surface. Cut every long edge until the type bends with it.
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for _ in range(8):
        long_e = [e for e in bm.edges if e.calc_length() > 0.07]
        if not long_e:
            break
        bmesh.ops.subdivide_edges(bm, edges=long_e, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    bm.verts.index_update()
    vs = [v.co.copy() for v in bm.verts]
    fs = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    bpy.data.meshes.remove(me)
    return vs, fs


def lettering(name, text, surf, axis_center, y_mid, width, height, depth=0.004, gap=0.0015,
              font=IMPACT, shear=0.0, mat=None, center_fn=None):
    """`text` wrapped round `surf` like a print: centred on the front (-Z),
    `width` x `height` metres of arc, standing `depth` proud of the surface.
    The letters' baseline is horizontal; each point is pushed out from the
    vertical axis through `axis_center` (or center_fn(y) when the surface
    leans, like a cap's crown) until it meets the surface."""
    vs, fs = _text_mesh(text, font, shear)
    xs = [v.x for v in vs]; ys = [v.y for v in vs]; zs = [v.z for v in vs]
    x0, x1, y0, y1, z0, z1 = min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)
    cx = V(axis_center)
    # arc radius at the centre of the print
    mid = surf.out_from(center_fn(y_mid) if center_fn else V(cx.x, y_mid, cx.z), V(0, 0, -1))
    R = (mid - (center_fn(y_mid) if center_fn else V(cx.x, y_mid, cx.z))).length if mid else 0.2
    out = []
    for v in vs:
        s = ((v.x - x0) / (x1 - x0) - 0.5) * width          # arc length, viewer's right +
        y = y_mid + ((v.y - y0) / (y1 - y0) - 0.5) * height
        a = s / R
        d = V(-math.sin(a), 0, -math.cos(a))                 # viewer's right is the wearer's left (-X)
        c = center_fn(y) if center_fn else V(cx.x, y, cx.z)
        hit = surf.out_from(c, d) or (c + d * R)
        out.append(hit + d * (gap + (v.z - z0) / (z1 - z0) * depth))
    ob = K.mesh_obj(name, out, fs, mat, smooth=False)
    recalc(ob)
    K.crisp(ob, bevel=0, angle=35)
    return ob


# ------------------------------------------------------------------ cap
def cap(prefix, head, rim_front=1.858, rim_back=1.80, height=0.145, lean=0.05, brim=0.17,
        clear=0.012, segs=48, rings=14, center_z=0.075, seams=(60, 120, 180, -120, -60)):
    """A six-panel ball cap fitted to `head` (a Surface). The rim follows
    the head round at `clear` metres off it, on a plane tilted from
    rim_front down to rim_back (worn pushed back, like the art); the crown
    rises `height` over the rim front, leaning back by `lean`; the brim
    juts `brim` out the front. Returns dict of pieces (crown, brim, band,
    button, seams) and `center(y)`, the crown's axis at height y, for the
    lettering."""
    def rim_y(phi):
        return (rim_front + rim_back) / 2 + (rim_front - rim_back) / 2 * math.cos(phi)

    def dirv(phi):
        return V(math.sin(phi), 0, -math.cos(phi))   # phi 0 = front (-Z), +pi/2 = +X

    top_y = rim_front + height

    def center(y):
        t = max(0.0, min(1.0, (y - rim_back) / (top_y - rim_back)))
        return V(0, y, center_z + lean * t)

    # head distance from the axis at each azimuth, at any height
    def head_r(phi, y):
        c = center(y)
        hit = head.out_from(c, dirv(phi))
        return (hit - c).length if hit else 0.0

    base = [head_r(TAU * k / segs, rim_y(TAU * k / segs)) + clear for k in range(segs)]
    verts, faces = [], []
    for i in range(rings + 1):
        t = i / rings
        prof = (1 - t ** 2.6) ** (1 / 2.6)                     # steep sides, round top
        for k in range(segs):
            phi = TAU * k / segs
            y = rim_y(phi) + (top_y - rim_y(phi)) * (t ** 0.85)
            r = base[k] * prof
            if t < 0.95:
                r = max(r, head_r(phi, y) + clear * 0.8)
            verts.append(center(y) + dirv(phi) * r)
    for i in range(rings):
        for k in range(segs):
            k2 = (k + 1) % segs
            faces.append((i * segs + k, i * segs + k2, (i + 1) * segs + k2, (i + 1) * segs + k))
    # close the top on the button
    top_c = center(top_y) + V(0, 0.004, 0)
    verts.append(top_c)
    tc = len(verts) - 1
    last = rings * segs
    for k in range(segs):
        faces.append((tc, last + k, last + (k + 1) % segs))
    crown = K.mesh_obj(f"{prefix}_crown", verts, faces)
    recalc(crown)
    sol = crown.modifiers.new("thick", "SOLIDIFY")
    sol.thickness = 0.006
    sol.offset = -1
    K.apply_mods(crown)
    recalc(crown)

    def crown_pt(k, i):
        return V(verts[i * segs + (k % segs)])

    # brim: the front arc of the rim, out and a touch down at the sides
    arc = 70
    rows = []
    n_c = 29
    for c in range(n_c):
        phi = math.radians(-arc + 2 * arc * c / (n_c - 1))
        k = (phi / TAU) * segs
        r0 = (base[int(math.floor(k)) % segs] * (1 - (k % 1)) + base[int(math.floor(k) + 1) % segs] * (k % 1)) - clear * 0.4
        y0 = rim_y(phi)
        p0 = center(y0) + dirv(phi) * r0
        ext = brim * max(0.0, math.cos(phi)) ** 0.55
        row = []
        for rr in range(6):
            u = rr / 5
            fwd = V(0, 0, -1) * ext * u + dirv(phi) * ext * u * 0.25
            droop = -0.012 * u - 0.05 * (math.sin(phi) ** 2) * u ** 1.5 + 0.018 * u * math.cos(phi)
            row.append(p0 + fwd + V(0, droop, 0))
        rows.append(row)
    # sheet wants rows[r][c]: make r the distance out, c across
    grid = [[rows[c][r] for c in range(n_c)] for r in range(6)]
    br = K.sheet(f"{prefix}_brim", grid, thick=0.011)
    K.crisp(br, bevel=0.0025, angle=40)

    band = sweep(f"{prefix}_band", [crown_pt(k, 0) for k in range(segs)], 0.0055, segs=6, closed=True)
    button = K.ico(f"{prefix}_button", top_c + V(0, 0.002, 0), 0.016, sub=2, scale=(1, 0.45, 1))
    seam_obs = []
    for deg in seams:
        k = int(round(math.radians(deg % 360) / TAU * segs)) % segs
        pts = [crown_pt(k, i) for i in range(0, rings + 1)] + [top_c]
        # sit the seam on the outer skin
        pts = [p + (p - center(p.y)).normalized() * 0.0035 if (p - center(p.y)).length > 1e-4 else p for p in pts]
        seam_obs.append(sweep(f"{prefix}_seam{deg}", pts, 0.0024, segs=5))
    # stitched eyelets high on the panels (one between each pair of seams)
    eyelets = []
    for deg in (90, -90, 150, -150, 30, -30):
        if abs(deg) < 60:
            continue   # the front panels carry the print
        k = int(round(math.radians(deg % 360) / TAU * segs)) % segs
        i = int(rings * 0.6)
        p = crown_pt(k, i)
        n = (p - center(p.y)).normalized()
        eyelets.append(K.disc(f"{prefix}_eyelet{deg}", p + n * 0.003, n, 0.0085, 0.003, segs=12))
    return {"crown": crown, "brim": br, "band": band, "button": button, "seams": seam_obs, "center": center,
            "eyelets": eyelets,
            "top_y": top_y}
