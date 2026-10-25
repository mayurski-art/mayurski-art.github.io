"""
Trollface Island's build kit (build_trollface_island.blender.py; doc "Troll
Forces: Trollface Island in Blender", claude.ai/artifact/NJA4xfxahS99UL52jrirn4).

Game coordinates (x east, y up, z south), each place drawn in its own frame
(the place's centre at 0, 0) and laid at the layout's centre by the map, as
build_island.blender.py always did.

Two things every place goes through:

- TFBuilder: map_kit's Builder whose finish() adds the bake's second UV set
  ("Lightmap", bake_kit's unwrap) before the export and reports the model's
  bounds and size, so every GLB is bake-ready from phase 0 and the build
  prints a size table. The old builder's functions make Builder() from
  their module globals, so build_trollface_island swaps this class in.
- Registry: what the props leave behind besides geometry: bounds (the
  overlap check), colliders over 0.6 m, and faces that must stay in view
  (CLAUDE.md Troll Forces rule 9; the obstruction test reads
  models/trollface-faces.json). Kabukigrin's (kb_club.py), with the layer
  renamed.
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix

import map_kit
from map_kit import Builder, hexlin, paint_material

HERE = os.path.dirname(os.path.abspath(__file__))
LIGHTMAP_RES = 1024          # the bake atlas a place gets (phase 6 bakes into it)


class Report:
    """What the build prints at the end: one row per GLB."""
    rows = []     # [name, tris, verts, bytes, lo, hi]


def to_object(b, name, paint=None):
    """map_kit Builder.finish up to the object (box UVs, paint folded into
    GS_Paint, game to Blender axes), without exporting: the same steps in the
    same order, so the mesh is the one finish() would export (Kabukigrin's)."""
    bm = b.bm
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    bm.normal_update()
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            c = loop.vert.co
            loop[uv].uv = (c.z, c.y) if ax == 0 else (c.x, c.z) if ax == 1 else (c.x, c.y)
    col = bm.loops.layers.float_color.new("Col")
    paint_idx = b._mi(paint or paint_material())
    white = (1.0, 1.0, 1.0, 1.0)
    for f in bm.faces:
        m = b.mats[f.material_index]
        if m.name in ("GS_Paint", "TF_Paint") or m.get("gs_keep"):
            c = white
        else:
            c = (*hexlin(m["gs_hex"]), 1.0)
            f.material_index = paint_idx
        for loop in f.loops:
            loop[col] = c
    bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.pi / 2, 4, "X"), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    used = {p.material_index for p in me.polygons}
    remap = {}
    for i, m in enumerate(b.mats):
        if i in used:
            remap[i] = len(me.materials)
            me.materials.append(m)
    for p in me.polygons:
        p.material_index = remap[p.material_index]
    me.color_attributes.active_color_name = "Col"
    me.color_attributes.render_color_index = me.color_attributes.active_color_index
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def lightmap_uv(obj, res=LIGHTMAP_RES):
    """The bake's second UV set, as bake_kit lays it (one atlas per GLB),
    the box UVs left active for the export's TEXCOORD_0."""
    from bake_kit import _lightmap_uv
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    _lightmap_uv(obj, 4.0 / res)
    obj.data.uv_layers.active = obj.data.uv_layers["UVMap"]


def game(v):
    """Blender (x, y, z) -> game (x, y-up, z)."""
    return (v.x, v.z, -v.y)


def bounds(obj):
    lo = [min(game(v.co)[a] for v in obj.data.vertices) for a in range(3)]
    hi = [max(game(v.co)[a] for v in obj.data.vertices) for a in range(3)]
    return [round(v, 3) for v in lo], [round(v, 3) for v in hi]


def export(obj, filename):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    path = os.path.join(map_kit.OUT_DIR, filename)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB",
                              export_yup=True, export_apply=True)
    me = obj.data
    lo, hi = bounds(obj)
    Report.rows.append([os.path.splitext(filename)[0], sum(len(p.vertices) - 2 for p in me.polygons), len(me.vertices), 0, lo, hi])
    print("Exported", path, len(me.vertices), "verts")
    bpy.data.objects.remove(obj)
    bpy.data.meshes.remove(me)
    return path


class TFBuilder(Builder):
    """map_kit's Builder with the bake UVs and the size report on finish().
    `bake` is ignored until phase 6: the bake is one step after the last
    geometry (a redrawn mesh never fits an old light map)."""

    def finish(self, filename, bake=None):
        obj = to_object(self, os.path.splitext(filename)[0])
        lightmap_uv(obj)
        return export(obj, filename)


class Registry:
    """What the props leave behind besides geometry: their bounds (the
    overlap check), colliders, and faces that must stay seen."""

    def __init__(self):
        self.props = []        # {id, lo, hi, on}  (on: the prop it stands on)
        self.colliders = []    # [x, z, w, d, h, y, pen]
        self.faces = []        # {id, owner, c, n, u, w, h}
        self._open = None

    def begin(self, b, pid, on=None):
        # every vertex so far is marked; the prop's are the ones left unmarked
        # at end() (bevels free and reuse slots, so no index range would do)
        tag = b.bm.verts.layers.int.get("tf_reg") or b.bm.verts.layers.int.new("tf_reg")
        for v in b.bm.verts:
            if v[tag] == 0:
                v[tag] = -1
        self._open = (b, pid, tag, on)

    def end(self, offset=(0.0, 0.0, 0.0)):
        """Closes the prop; `offset` moves its bounds into map coordinates
        when the builder draws in a place's frame."""
        b, pid, tag, on = self._open
        vs = [v for v in b.bm.verts if v[tag] == 0]
        for v in vs:
            v[tag] = len(self.props) + 1
        k = len(self.props) + 1
        tris = sum(len(f.verts) - 2 for f in {f for v in vs for f in v.link_faces} if all(w[tag] == k for w in f.verts))
        if vs:
            lo = [min(v.co[a] for v in vs) + offset[a] for a in range(3)]
            hi = [max(v.co[a] for v in vs) + offset[a] for a in range(3)]
            self.props.append({"id": pid, "lo": [round(x, 4) for x in lo], "hi": [round(x, 4) for x in hi], "on": on, "tris": tris})
        self._open = None

    def prop(self, pid, lo, hi, on=None, tris=0):
        """A prop registered by its bounds alone (a whole landmark GLB)."""
        self.props.append({"id": pid, "lo": [round(x, 4) for x in lo], "hi": [round(x, 4) for x in hi], "on": on, "tris": tris})

    def collider(self, x, z, w, d, h, y=0.0, pen=3):
        self.colliders.append([round(v, 3) for v in (x, z, w, d, h, y)] + [pen])

    def face(self, fid, owner, c, n, w, h, u=None):
        """A face that must stay in view: centre c, outward normal n (in the
        floor plane), width w along u (default: n turned left), height h."""
        if u is None:
            u = (-n[2], 0.0, n[0])
        self.faces.append({"id": fid, "owner": owner, "c": [round(v, 3) for v in c], "n": list(n), "u": list(u),
                           "w": w, "h": h})

    def overlaps(self):
        """Pairs of props whose bounds cross, unless one stands on the other."""
        bad = []
        on = lambda p: p["on"] if isinstance(p["on"], (list, tuple)) else (p["on"],)      # noqa: E731
        for i, a in enumerate(self.props):
            for c in self.props[i + 1:]:
                if a["id"] == c["id"] or c["id"] in on(a) or a["id"] in on(c):     # one prop in pieces, or stood on
                    continue
                if all(a["lo"][k] < c["hi"][k] - 0.005 and c["lo"][k] < a["hi"][k] - 0.005 for k in range(3)):
                    bad.append((a["id"], c["id"]))
        return bad
