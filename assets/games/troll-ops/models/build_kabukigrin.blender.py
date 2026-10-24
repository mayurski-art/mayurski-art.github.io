"""
Troll Forces - Kabukigrin (Grinjuku with Trolling Loud's Tokyo branch in its
A side), headless Blender. Design doc: claude.ai/artifact/ESCtEQZrXQ3MFZZg9MjWsw.

Run with:
  node tools/troll-ops-kabukigrin-layout.mjs        # layout -> kabukigrin-layout.json
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python build_kabukigrin.blender.py

Writes kb-shell, kb-props, kb-neon .glb into this folder (map coordinates),
then shrinks them with quantize_glb.py. The far city stays gj-skyline.

Phase 0 (the builder): the Grinjuku part is drawn by Grinjuku's own
functions (build_grinjuku.blender.py), so it is gj-shell / gj-props / gj-neon
triangle for triangle; its light-map UVs are unwrapped on the WHOLE model the
way bake_kit does it, which gives gj-shell's and gj-props' UVs byte for byte,
so their bakes (gj-shell-bake.webp, gj-props-bake.webp) still light it. Only
then is the club cut out of it: the props Studio removed (their colliders are
gone from kabukigrin-layout.js), the street dressing where the club's walls
are (CLEAR, was kabukigrin.js clearForClub), and the dance floor's hole over
the mirror pit (DANCE, was cutDanceFloor). Those cut parts are objects named
"gj" in each GLB; the club's own geometry goes in objects named "kb" (no
bake yet: phase 4).

The playable layout is the contract: nothing here moves a collider.
"""
import importlib.util
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import map_kit  # noqa: E402
from map_kit import Builder, hexlin, paint_material  # noqa: E402

_sp = importlib.util.spec_from_file_location("build_grinjuku", os.path.join(HERE, "build_grinjuku.blender.py"))
G = importlib.util.module_from_spec(_sp)
_sp.loader.exec_module(G)

KB = json.load(open(os.path.join(HERE, "kabukigrin-layout.json")))
GJ_RES = 2048   # gj-shell-bake.webp and gj-props-bake.webp: the unwrap's margin is 4 texels of it

# the dance floor over the mirror pit (kabukigrin.js DANCE)
DANCE = (-27.0, -17.0, 10.0, 20.0)
# Grinjuku's street dressing where the club's walls now are (kabukigrin.js
# CLEAR, game x0, x1, y0, y1, z0, z1): a triangle wholly inside one box goes,
# bar the ground's (flat at y 0)
CLEAR = [
    (-31.75, -14.25, -0.01, 7.45, 3.9, 5.6),
    (-31.75, -30.7, 0.05, 7.45, 4, 23.8),
    (-31.75, -14.4, 0.05, 7.45, 23, 24.1),
    (-14.7, -13.6, 0.05, 3.6, 4, 23.8),
    (-6.2, -4.4, 0.05, 8.8, 13.6, 14.4),
    (-24.6, -22.85, 2.7, 8.6, -8.35, 3.25),
    (15.8, 22.8, 3.45, 7.75, -32.6, -31.85),
    (-31.75, -24.2, 0.31, 6.0, 24.2, 29.85),
    (-31.75, -29.9, 0.05, 5.42, -24.6, -5.9),
]


def kb_has(s):
    """Is Grinjuku solid `s` still a collider in Kabukigrin's layout?"""
    for c in KB["colliders"]:
        x, z, w, d = c[:4]
        if abs(x - s["x"]) < 0.01 and abs(z - s["z"]) < 0.01 and abs(w - s["w"]) < 0.01 and abs(d - s["d"]) < 0.01:
            return True
    return False


# ------------------------------------------------------------- export

def to_object(b, name):
    """map_kit Builder.finish up to the object (box UVs, paint folded into
    GS_Paint, game to Blender axes), without exporting: the same steps in the
    same order, so the mesh is the one finish() would bake."""
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
    paint_idx = b._mi(paint_material())
    white = (1.0, 1.0, 1.0, 1.0)
    for f in bm.faces:
        m = b.mats[f.material_index]
        if m.name == "GS_Paint" or m.get("gs_keep"):
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


def unwrap(obj):
    from bake_kit import _lightmap_uv
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    _lightmap_uv(obj, 4.0 / GJ_RES)
    obj.data.uv_layers.active = obj.data.uv_layers["UVMap"]


def game(v):
    """Blender (x, y, z) -> game (x, y-up, z)."""
    return v.x, v.z, -v.y


def cut_club(obj, gone_tag=None):
    """Takes the club out of a Grinjuku model, after its unwrap: the removed
    props' faces (tagged `gone_tag` while drawing), the CLEAR boxes and the
    dance floor's hole (the flat ground in DANCE, clipped at its edges)."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    # (faces, not triangles: the exporter then splits them as it split gj-*)
    tag = bm.faces.layers.int.get("kb_gone")
    dead = []
    for f in bm.faces:
        if tag is not None and f[tag]:
            dead.append(f)
            continue
        P = [game(v.co) for v in f.verts]
        flat0 = all(abs(p[1]) < 0.02 for p in P)
        if flat0:
            continue
        for (x0, x1, y0, y1, z0, z1) in CLEAR:
            if all(x0 <= p[0] <= x1 and y0 <= p[1] <= y1 and z0 <= p[2] <= z1 for p in P):
                dead.append(f)
                break
    bmesh.ops.delete(bm, geom=list(set(dead)), context="FACES")
    # the dance floor: clip the ground's faces at its four edges, then drop inside
    x0, x1, z0, z1 = DANCE

    def ground_faces():
        return [f for f in bm.faces if all(abs(v.co.z) < 0.06 for v in f.verts)
                and max(v.co.x for v in f.verts) > x0 and min(v.co.x for v in f.verts) < x1
                and max(-v.co.y for v in f.verts) > z0 and min(-v.co.y for v in f.verts) < z1]
    # Blender: game x = x, game z = -y
    for co, no in (((x0, 0, 0), (1, 0, 0)), ((x1, 0, 0), (1, 0, 0)), ((0, -z0, 0), (0, 1, 0)), ((0, -z1, 0), (0, 1, 0))):
        fs = ground_faces()
        if not fs:
            break
        geom = list({e for f in fs for e in f.edges}) + fs + list({v for f in fs for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, dist=1e-5)
    inside = []
    for f in bm.faces:
        if not all(abs(v.co.z) < 0.06 for v in f.verts):
            continue
        c = f.calc_center_median()
        if x0 < c.x < x1 and z0 < -c.y < z1:
            inside.append(f)
    bmesh.ops.delete(bm, geom=inside, context="FACES")
    if tag is not None:
        bm.faces.layers.int.remove(tag)
    bm.to_mesh(me)
    bm.free()
    print(f"  {obj.name}: cut {len(set(dead))} club faces, {len(inside)} dance-floor faces")


def export(objs, filename):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(map_kit.OUT_DIR, filename)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB",
                              export_yup=True, export_apply=True)
    print("Exported", path, sum(len(o.data.vertices) for o in objs), "verts")
    for o in objs:
        me = o.data
        bpy.data.objects.remove(o)
        bpy.data.meshes.remove(me)
    return path


# ------------------------------------------------------------- the Grinjuku part

class _Discard(Builder):
    """Where a removed prop's glow goes."""


def grinjuku_part(P):
    """Grinjuku's shell, props and neon, drawn by its own functions, in its
    own order (the neon's draws interleave: shell, props, skyline)."""
    G.NEONB = Builder()
    sh = Builder()
    G.facades(sh, G.NEONB, P)
    G.post_office(sh, G.NEONB, P)
    G.heavens(sh, G.NEONB, P)
    G.stairs_geo(sh, P)
    G.ground_paint(sh, P)

    pr = Builder()
    gone = pr.bm.faces.layers.int.new("kb_gone")
    removed = 0
    for s in G.SOLIDS:
        fn = G.PROPS.get(s["k"])
        if not fn:
            continue
        if kb_has(s):
            fn(pr, G.NEONB, P, s)
            continue
        # drawn (the unwrap needs the whole model) and tagged to go; its glow dropped
        before = set(pr.bm.faces)
        fn(pr, _Discard(), P, s)
        for f in pr.bm.faces:
            if f not in before:
                f[gone] = 1
        removed += 1
    G.ropes_geo(pr, P)
    G.wires(pr, G.NEONB, P)
    print(f"  props: {removed} Grinjuku props left out (their colliders are gone)")

    # the skyline's glow lives in gj-neon too (its model stays gj-skyline)
    finish = Builder.finish
    Builder.finish = lambda self, *a, **k: None
    try:
        G.build_skyline(P)
    finally:
        Builder.finish = finish
    return sh, pr, G.NEONB


def main():
    import quantize_glb
    bpy.ops.wm.read_factory_settings(use_empty=True)
    P = G.gj_palette()
    print("Kabukigrin layout", KB.get("hash"), len(KB["colliders"]), "colliders")
    sh, pr, ne = grinjuku_part(P)
    out = []
    for b, name in ((sh, "kb-shell"), (pr, "kb-props")):
        o = to_object(b, "gj")
        unwrap(o)
        cut_club(o)
        out.append(export([o], name + ".glb"))
    o = to_object(ne, "gj")
    cut_club(o)
    out.append(export([o], "kb-neon.glb"))
    quantize_glb.main(out)


if __name__ == "__main__":
    main()
