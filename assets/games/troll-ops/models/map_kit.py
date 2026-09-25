"""
Shared Blender kit for the Troll Ops map models (build_<map>.blender.py
scripts import it): materials, the bmesh Builder, and common parts
(edge rails, pallets, steel stairs).

Authoring conventions (every map script follows them):
- Everything is in GAME coordinates (x right, y up, z toward the viewer,
  metres); Builder.finish rotates into Blender Z-up just before export.
- UVs are world-metre box projections, so a photo texture tiles at the same
  real size on every face. The game sets tiles-per-metre in map-models.js.
- Flat-painted parts merge into one vertex-coloured "GS_Paint" material per
  model; only TEXTURED names (must match map-models.js RETEXTURE) and
  emissive materials keep their own.
- No environment map in the game: keep metalness low or it renders black.
"""
import bpy
import bmesh
import math
import os
from mathutils import Matrix, Vector

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
UP = Vector((0, 1, 0))


# ------------------------------------------------------------ materials

def hexlin(h):
    """sRGB hex -> linear RGB, which is what glTF base colour factors hold."""
    out = []
    for s in (16, 8, 0):
        v = ((h >> s) & 255) / 255
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# materials grinsite-props.js swaps for a tiled photo texture
TEXTURED = {"GS_Concrete", "GS_Slab", "GS_Block", "GS_Plank", "GS_Timber", "GS_Ply",
            "GS_Brick", "GS_Rubble", "GS_Precast", "GS_Plaster", "GS_PlasterDark", "GS_Rock",
            "GS_Stone", "GS_Tile", "GS_FloorConc", "GS_PlasterLight"}


def paint_material():
    m = bpy.data.materials.get("GS_Paint")
    if m:
        return m
    m = bpy.data.materials.new("GS_Paint")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Roughness"].default_value = 0.6
    b.inputs["Metallic"].default_value = 0.1
    ca = nt.nodes.new("ShaderNodeVertexColor")
    ca.layer_name = "Col"
    nt.links.new(ca.outputs["Color"], b.inputs["Base Color"])
    return m


def mat(name, color, rough=0.8, metal=0.0, emit=None, emit_strength=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m["gs_hex"] = color
    m["gs_keep"] = name in TEXTURED or emit is not None
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*hexlin(color), 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit is not None:
        b.inputs["Emission Color"].default_value = (*hexlin(emit), 1.0)
        b.inputs["Emission Strength"].default_value = emit_strength
    return m


def palette():
    return {
        "conc": mat("GS_Concrete", 0x8e8e88, 0.92),
        "slab": mat("GS_Slab", 0x85857e, 0.92),
        "block": mat("GS_Block", 0x9c988c, 0.95),
        "wet": mat("GS_WetConcrete", 0x6c6c66, 0.55),
        "yellow": mat("GS_Yellow", 0xe8ad22, 0.5, 0.15),
        "crane": mat("GS_CraneYellow", 0xf0b21e, 0.45, 0.1),
        "rebar": mat("GS_Rebar", 0x6a3f24, 0.75, 0.2),
        "tube": mat("GS_Tube", 0xa9b0b6, 0.45, 0.3),
        "steel": mat("GS_Steel", 0x6c7278, 0.55, 0.3),
        "dark": mat("GS_DarkMetal", 0x33373c, 0.6, 0.25),
        "black": mat("GS_Black", 0x151618, 0.7),
        "tyre": mat("GS_Tyre", 0x121212, 0.92),
        "plank": mat("GS_Plank", 0xb0874f, 0.85),
        "timber": mat("GS_Timber", 0xc9a36a, 0.85),
        "ply": mat("GS_Ply", 0x7a4a2a, 0.6),
        "toe": mat("GS_ToeBoard", 0xc8862e, 0.8),
        "brick": mat("GS_Brick", 0xa0523a, 0.9),
        "white": mat("GS_White", 0xe9e9e4, 0.6),
        "strap": mat("GS_Strap", 0xd8d8d0, 0.5),
        "glass": mat("GS_Glass", 0x4f6270, 0.12, 0.0),
        "cabin": mat("GS_CabinPaint", 0xdcd4b4, 0.6, 0.15),
        "trim": mat("GS_CabinTrim", 0x46525b, 0.5, 0.4),
        "floor": mat("GS_Floor", 0x56626b, 0.8),
        "desk": mat("GS_Desk", 0x8a6a48, 0.6),
        "paper": mat("GS_Paper", 0xdfe7ee, 0.7),
        "sign_blue": mat("GS_SignBlue", 0x1f5fb0, 0.5),
        "sign_red": mat("GS_SignRed", 0xc42a22, 0.5),
        "loo": mat("GS_ToiletBlue", 0x2f6fd0, 0.4),
        "loo_dark": mat("GS_ToiletBlueDark", 0x21539e, 0.45),
        "green": mat("GS_Vacant", 0x2fcf52, 0.4, 0.0, 0x2fcf52, 0.6),
        "orange": mat("GS_Orange", 0xd9772b, 0.5, 0.2),
        "skip": mat("GS_SkipYellow", 0xe0a020, 0.55, 0.3),
        "rubble": mat("GS_Rubble", 0x7c7266, 0.95),
        "van": mat("GS_VanWhite", 0xecebe6, 0.3, 0.3),
        "stripe": mat("GS_VanStripe", 0xe0671f, 0.4, 0.2),
        "headlight": mat("GS_Headlight", 0xfff4d8, 0.2, 0.0, 0xfff4d8, 0.5),
        "taillight": mat("GS_Taillight", 0xa01818, 0.3, 0.0, 0xc01818, 0.4),
        "teal": mat("GS_ContainerTeal", 0x3a6a7a, 0.6, 0.15),
        "c_red": mat("GS_ContainerRed", 0x8e3b2a, 0.6, 0.15),
        "c_blue": mat("GS_ContainerBlue", 0x2c5585, 0.6, 0.15),
        "c_green": mat("GS_ContainerGreen", 0x3f6b45, 0.6, 0.15),
        "c_grey": mat("GS_ContainerGrey", 0x8a8f94, 0.6, 0.15),
        "precast": mat("GS_Precast", 0x9b9a92, 0.92),
        "grate": mat("GS_Grate", 0x70767c, 0.55, 0.3),
        "hoard": mat("GS_Hoarding", 0x2d4a3a, 0.75),
        "lamp": mat("GS_Lamp", 0xfff3d0, 0.2, 0.0, 0xfff3d0, 3.0),
        "plaster": mat("GS_Plaster", 0xd2b98e, 0.9),
        "plaster_dk": mat("GS_PlasterDark", 0xb89c72, 0.9),
        "rock": mat("GS_Rock", 0xd0ae80, 0.95),
        "stone": mat("GS_Stone", 0xe8d8b8, 0.95),
        "plaster_lt": mat("GS_PlasterLight", 0xf2e8d2, 0.9),
        "rack_blue": mat("GS_RackBlue", 0x2f64b0, 0.5, 0.1),
        "beam_orange": mat("GS_BeamOrange", 0xe8741e, 0.5, 0.1),
        "cardboard": mat("GS_Cardboard", 0xb58c58, 0.9),
        "tape": mat("GS_Tape", 0xd8c49a, 0.5),
        "wrap": mat("GS_Wrap", 0xaeb8c2, 0.3),
        "panel": mat("GS_WallPanel", 0x7d8a96, 0.6, 0.1),
        "panel_dk": mat("GS_WallPanelDark", 0x4d5660, 0.6, 0.1),
        "trailer": mat("GS_TrailerWhite", 0xe6e6e0, 0.45, 0.1),
        "drum_blue": mat("GS_DrumBlue", 0x2a5fa0, 0.5, 0.1),
        "rubber": mat("GS_Rubber", 0x1a1a1a, 0.9),
        "tile": mat("GS_Tile", 0xffffff, 0.4),
        "floorconc": mat("GS_FloorConc", 0x9a9a94, 0.7),
        "cloth_red": mat("GS_ClothRed", 0xb8322a, 0.9),
        "cloth_blue": mat("GS_ClothBlue", 0x2f5f9e, 0.9),
        "cloth_cream": mat("GS_ClothCream", 0xe8dcc0, 0.9),
        "cloth_green": mat("GS_ClothGreen", 0x3f7a4a, 0.9),
        "palm_leaf": mat("GS_PalmLeaf", 0x5d8a3a, 0.8),
        "palm_trunk": mat("GS_PalmTrunk", 0x7a5e3e, 0.9),
        "terracotta": mat("GS_Terracotta", 0xb8643a, 0.85),
        "rust": mat("GS_Rust", 0x7a4028, 0.85, 0.1),
        "red_lamp": mat("GS_RedLamp", 0xff3020, 0.3, 0.0, 0xff2a1a, 2.5),
        "screen": mat("GS_Screen", 0x9fe6ff, 0.3, 0.0, 0x7fd8ff, 1.2),
        "sign_lit": mat("GS_SignLit", 0xf2f2ea, 0.4, 0.0, 0xf2f2ea, 0.6),
    }


# ------------------------------------------------------------- builder

class Builder:
    """One bmesh per model; primitives go in with a material each."""

    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _tag(self, faces, m, smooth=False):
        idx = self._mi(m)
        for f in faces:
            f.material_index = idx
            f.smooth = smooth

    @staticmethod
    def _faces(verts):
        return {f for v in verts for f in v.link_faces}

    def box(self, m, w, h, d, x, y, z, ry=0.0, rx=0.0, rz=0.0, bevel=0.0):
        """Box of size w (x) h (y) d (z) whose BOTTOM sits on y, centred on x,z,
        like api.box. Rotations turn it about its own centre."""
        M = (Matrix.Translation((x, y + h / 2, z))
             @ Matrix.Rotation(ry, 4, "Y") @ Matrix.Rotation(rx, 4, "X") @ Matrix.Rotation(rz, 4, "Z")
             @ Matrix.Diagonal((w, h, d, 1)))
        verts = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)["verts"]
        faces = self._faces(verts)
        self._tag(faces, m)
        if bevel:
            edges = list({e for v in verts for e in v.link_edges})
            res = bmesh.ops.bevel(self.bm, geom=list(verts) + edges, offset=bevel, offset_type="OFFSET",
                                  segments=1, profile=0.5, affect="EDGES")
            self._tag(res["faces"], m)
        return verts

    @staticmethod
    def _align(a, b):
        a, b = Vector(a), Vector(b)
        d = b - a
        L = d.length
        n = d.normalized()
        if abs(n.y) > 0.999:
            R = Matrix.Rotation(-math.pi / 2 if n.y > 0 else math.pi / 2, 4, "X")
        else:
            R = n.to_track_quat("Z", "Y").to_matrix().to_4x4()
        return Matrix.Translation((a + b) / 2) @ R, L

    def cyl(self, m, r, a, b, seg=8, r2=None, caps=True, smooth=True):
        M, L = self._align(a, b)
        verts = bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=seg,
                                      radius1=r, radius2=r if r2 is None else r2, depth=L, matrix=M)["verts"]
        faces = self._faces(verts)
        idx = self._mi(m)
        for f in faces:
            f.material_index = idx
            f.smooth = smooth and len(f.verts) == 4
        return verts

    def bar(self, m, a, b, w, h=None):
        """Square/rect section member from a to b; h is the section's height
        (kept vertical for horizontal members)."""
        M, L = self._align(a, b)
        M = M @ Matrix.Diagonal((w, h if h else w, L, 1))
        verts = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)["verts"]
        self._tag(self._faces(verts), m)
        return verts

    def poly(self, m, pts, faces_idx):
        vs = [self.bm.verts.new(p) for p in pts]
        out = []
        for fi in faces_idx:
            try:
                out.append(self.bm.faces.new([vs[i] for i in fi]))
            except ValueError:
                pass
        self._tag(out, m)
        bmesh.ops.recalc_face_normals(self.bm, faces=out)
        return out

    def prism(self, m, profile, a0, a1, axis="z"):
        """Extrude a 2D profile. axis 'z': profile is (x, y), runs z a0..a1.
        axis 'x': profile is (z, y), runs x a0..a1."""
        n = len(profile)
        if axis == "z":
            pts = [(u, v, a0) for u, v in profile] + [(u, v, a1) for u, v in profile]
        else:
            pts = [(a0, v, u) for u, v in profile] + [(a1, v, u) for u, v in profile]
        faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
        for i in range(n):
            j = (i + 1) % n
            faces.append([i, j, n + j, n + i])
        return self.poly(m, pts, faces)

    def lump(self, m, w, h, d, x, y, z, seed=0, rnd=0.45, jitter=0.1, ry=0.0, flat_base=True):
        """Boulder / sack / tarp: a subdivided box pushed toward a sphere and
        jittered, sized w x h x d with its bottom on y (like box)."""
        import random
        r = random.Random(seed)
        # a 3x3-per-face subdivided unit cube, verts shared along the seams
        N = 3
        pool = {}

        def vert(p):
            key = tuple(round(c, 5) for c in p)
            if key not in pool:
                pool[key] = self.bm.verts.new(p)
            return pool[key]

        quads = []
        for ax in range(3):
            for sgn in (-0.5, 0.5):
                u_ax, v_ax = [i for i in range(3) if i != ax]
                grid = []
                for i in range(N + 1):
                    row = []
                    for j in range(N + 1):
                        p = [0.0, 0.0, 0.0]
                        p[ax] = sgn
                        p[u_ax] = -0.5 + i / N
                        p[v_ax] = -0.5 + j / N
                        row.append(vert(p))
                    grid.append(row)
                for i in range(N):
                    for j in range(N):
                        q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
                        quads.append(q if (sgn > 0) == (ax != 1) else q[::-1])
        new_faces = [self.bm.faces.new(q) for q in quads]
        allv = set(pool.values())
        R = Matrix.Rotation(ry, 3, "Y")
        for v in allv:
            p = v.co.copy()
            sp = p.normalized() * 0.5
            p = p.lerp(sp * 1.25, rnd)
            p += Vector((r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(-1, 1))) * jitter
            p = Vector((max(-0.5, min(0.5, p.x)), max(-0.5, min(0.55, p.y)), max(-0.5, min(0.5, p.z))))
            if flat_base and p.y < -0.42:
                p.y = -0.5
            p = Vector((p.x * w, (p.y + 0.5) * h, p.z * d))
            v.co = R @ p + Vector((x, y, z))
        bmesh.ops.recalc_face_normals(self.bm, faces=new_faces)
        idx = self._mi(m)
        for fc in new_faces:
            fc.material_index = idx
            fc.smooth = True
        return allv

    def frustum(self, m, w0, d0, w1, d1, y0, y1, x=0.0, z=0.0):
        pts = [(x - w0 / 2, y0, z - d0 / 2), (x + w0 / 2, y0, z - d0 / 2), (x + w0 / 2, y0, z + d0 / 2), (x - w0 / 2, y0, z + d0 / 2),
               (x - w1 / 2, y1, z - d1 / 2), (x + w1 / 2, y1, z - d1 / 2), (x + w1 / 2, y1, z + d1 / 2), (x - w1 / 2, y1, z + d1 / 2)]
        return self.poly(m, pts, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]])

    def tube_z(self, m, x, y, z0, z1, ro, ri, seg=18):
        """Hollow pipe along z (concrete culverts)."""
        pts = []
        for z in (z0, z1):
            for r in (ro, ri):
                for i in range(seg):
                    t = 2 * math.pi * i / seg
                    pts.append((x + r * math.cos(t), y + r * math.sin(t), z))
        # index: ring(zi, ri) start = (zi*2 + ri) * seg
        def R(zi, k): return (zi * 2 + k) * seg
        faces = []
        for i in range(seg):
            j = (i + 1) % seg
            faces.append([R(0, 0) + i, R(0, 0) + j, R(1, 0) + j, R(1, 0) + i])      # outside
            faces.append([R(0, 1) + j, R(0, 1) + i, R(1, 1) + i, R(1, 1) + j])      # bore
            faces.append([R(0, 0) + j, R(0, 0) + i, R(0, 1) + i, R(0, 1) + j])      # end z0
            faces.append([R(1, 0) + i, R(1, 0) + j, R(1, 1) + j, R(1, 1) + i])      # end z1
        vs = [self.bm.verts.new(p) for p in pts]
        out = [self.bm.faces.new([vs[i] for i in f]) for f in faces]
        self._tag(out, m)
        for f in out[0::4] + out[1::4]:
            f.smooth = True
        return out

    def finish(self, filename):
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
        bm.normal_update()
        uv = bm.loops.layers.uv.new("UVMap")
        for f in bm.faces:
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            for loop in f.loops:
                c = loop.vert.co
                loop[uv].uv = (c.z, c.y) if ax == 0 else (c.x, c.z) if ax == 1 else (c.x, c.y)
        # fold every flat-painted face into GS_Paint, its colour in a
        # vertex colour; textured + emissive faces keep their material
        col = bm.loops.layers.float_color.new("Col")
        paint_idx = self._mi(paint_material())
        white = (1.0, 1.0, 1.0, 1.0)
        for f in bm.faces:
            m = self.mats[f.material_index]
            if m.name == "GS_Paint" or m.get("gs_keep"):
                c = white
            else:
                c = (*hexlin(m["gs_hex"]), 1.0)
                f.material_index = paint_idx
            for loop in f.loops:
                loop[col] = c
        # game (x, y-up, z) -> Blender (x, -z, y); the exporter's +Y-up undoes it
        bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.pi / 2, 4, "X"), verts=bm.verts)
        name = os.path.splitext(filename)[0]
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        used = {p.material_index for p in me.polygons}
        remap = {}
        for i, m in enumerate(self.mats):
            if i in used:
                remap[i] = len(me.materials)
                me.materials.append(m)
        for p in me.polygons:
            p.material_index = remap[p.material_index]
        me.color_attributes.active_color_name = "Col"
        me.color_attributes.render_color_index = me.color_attributes.active_color_index
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        path = os.path.join(OUT_DIR, filename)
        bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB",
                                  export_yup=True, export_apply=True)
        print("Exported", path, len(me.vertices), "verts")
        bpy.data.objects.remove(obj)
        bpy.data.meshes.remove(me)


# -------------------------------------------------------------- shared bits

def walls_geo(b, m, cx, cz, w, d, h, t, gaps=None, y=0.0, fill_above=None, lintel=None):
    """Same four walls as maps.js api.walls() (gap = centred opening per side
    n/s/w/e). fill_above: visual wall filled back in over each opening from
    that height (the collider stays open), with an optional lintel material."""
    gaps = gaps or {}
    half = t / 2
    sides = [("n", cx, cz - d / 2 + half, w, t, "x"), ("s", cx, cz + d / 2 - half, w, t, "x"),
             ("w", cx - w / 2 + half, cz, t, d, "z"), ("e", cx + w / 2 - half, cz, t, d, "z")]
    for side, sx, sz, sw, sd, axis in sides:
        gap = gaps.get(side)
        if not gap:
            b.box(m, sw, h, sd, sx, y, sz)
            continue
        span = sw if axis == "x" else sd
        seg = (span - gap) / 2
        if seg > 0.05:
            for sgn in (-1, 1):
                off = sgn * (gap / 2 + seg / 2)
                b.box(m, seg if axis == "x" else sw, h, seg if axis == "z" else sd,
                      sx + off if axis == "x" else sx, y, sz + off if axis == "z" else sz)
        if fill_above is not None and fill_above < h:
            gw, gd = (gap, sd) if axis == "x" else (sw, gap)
            b.box(m, gw, h - fill_above, gd, sx, y + fill_above, sz)
            if lintel is not None:
                b.box(lintel, gw + (0.3 if axis == "x" else 0.04), 0.14, gd + (0.04 if axis == "x" else 0.3),
                      sx, y + fill_above - 0.07, sz)


def arch(b, m, cx, cz, span, depth, y0, along="x", thick=0.35, seg=9):
    """Round arch over an opening, springing at y0 (all above the opening)."""
    R = span / 2
    for i in range(seg):
        a0 = math.pi * i / seg
        a1 = math.pi * (i + 1) / seg
        am = (a0 + a1) / 2
        u = -math.cos(am) * (R + thick / 2)
        v = math.sin(am) * (R + thick / 2)
        L = (R + thick) * (a1 - a0) * 1.05
        rz = am - math.pi / 2
        if along == "x":
            b.box(m, L, thick, depth, cx + u, y0 + v - thick / 2, cz, rz=-rz)
        else:
            b.box(m, depth, thick, L, cx, y0 + v - thick / 2, cz + u, rx=rz)
    for sgn in (-1, 1):
        if along == "x":
            b.box(m, thick, R * 0.55, depth, cx + sgn * (R + thick / 2), y0, cz)
        else:
            b.box(m, depth, R * 0.55, thick, cx, y0, cz + sgn * (R + thick / 2))


def palm(b, P, x, z, h=6.0, lean=(0.4, 0.2), seed=0):
    """Date palm: a gently curving tapered trunk and a crown of drooping fronds."""
    import random
    r = random.Random(seed)
    n = 6
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append(Vector((x + lean[0] * t * t, h * t, z + lean[1] * t * t)))
    for i in range(n):
        r0 = 0.2 - 0.07 * i / n
        b.cyl(P["palm_trunk"], r0, pts[i], pts[i + 1] + Vector((0, 0.05, 0)), seg=8, r2=r0 - 0.012)
        b.cyl(P["palm_trunk"], r0 + 0.035, pts[i] + Vector((0, 0.15, 0)), pts[i] + Vector((0, 0.3, 0)), seg=8)
    top = pts[-1]
    for k in range(11):
        a = 2 * math.pi * k / 11 + r.uniform(-0.15, 0.15)
        L = r.uniform(2.0, 2.8)
        droop = r.uniform(0.5, 1.2)
        d = Vector((math.cos(a), 0, math.sin(a)))
        mid = top + d * (L * 0.5) + Vector((0, 0.45, 0))
        tip = top + d * L + Vector((0, -droop, 0))
        for p0, p1 in ((top, mid), (mid, tip)):
            b.bar(P["palm_leaf"], p0, p1, 0.5, 0.03)
    b.lump(P["palm_trunk"], 0.5, 0.45, 0.5, top.x, top.y - 0.3, top.z, seed=seed)

def edge_rail(b, P, x0, z0, x1, z1, y):
    """Yellow edge protection along a slab edge: posts, top + mid rail, toe board."""
    a, c = Vector((x0, 0, z0)), Vector((x1, 0, z1))
    L = (c - a).length
    n = max(1, math.ceil(L / 2.0))
    for i in range(n + 1):
        p = a.lerp(c, i / n)
        b.box(P["yellow"], 0.05, 1.0, 0.05, p.x, y, p.z)
    for hy, s in ((0.97, 0.05), (0.5, 0.04)):
        b.bar(P["yellow"], (x0, y + hy, z0), (x1, y + hy, z1), s)
    b.bar(P["toe"], (x0, y + 0.075, z0), (x1, y + 0.075, z1), 0.025, 0.15)


def pallet(b, P, w, d, x=0.0, z=0.0, y=0.0):
    for ox in (-w / 2 + 0.06, 0, w / 2 - 0.06):
        b.box(P["plank"], 0.1, 0.1, d, x + ox, y, z)
    n = 5
    for i in range(n):
        oz = -d / 2 + 0.07 + i * (d - 0.14) / (n - 1)
        b.box(P["plank"], w, 0.025, 0.13, x, y + 0.1, z + oz)
    return y + 0.125


def steel_stair(b, P, n, rise, run, width, z_bottom, direction=-1, y0=0.0, x=0.0, closed=True):
    """Open-tread steel stair matching api.stairs(x, z_bottom, width, n, rise,
    run, direction<0 ? '-z' : '+z'). Its collider is solid down to the ground,
    so `closed` hangs plated sides under the stringers to match."""
    s = direction
    half = width / 2
    z_top = z_bottom + s * run * n
    for i in range(n):
        top = y0 + rise * (i + 1)
        zc = z_bottom + s * run * (i + 0.5)
        b.box(P["grate"], width - 0.12, 0.04, run - 0.03, x, top - 0.04, zc)
        b.box(P["yellow"], width - 0.12, 0.02, 0.05, x, top - 0.02, z_bottom + s * run * i + s * 0.025)
    for sx in (-1, 1):
        px = x + sx * (half - 0.04)
        b.bar(P["steel"], (px, y0 + rise * 0.5 - 0.1, z_bottom), (px, y0 + rise * n - 0.1, z_top), 0.06, 0.3)
        if closed:
            b.prism(P["steel"], [(z_bottom, y0), (z_top, y0), (z_top, y0 + rise * n - 0.25)],
                    px - 0.01, px + 0.01, axis="x")
        for i in range(0, n, 3):
            zc = z_bottom + s * run * (i + 0.5)
            t = y0 + rise * (i + 1)
            b.box(P["yellow"], 0.045, 1.0, 0.045, px, t, zc)
        t0 = y0 + rise * 1 + 0.95
        t1 = y0 + rise * n + 0.95
        b.bar(P["yellow"], (px, t0, z_bottom + s * run * 0.5), (px, t1, z_bottom + s * run * (n - 0.5)), 0.05)
        b.box(P["yellow"], 0.045, 1.0, 0.045, px, y0 + rise * n, z_bottom + s * run * (n - 0.5))


