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
CLUB = json.load(open(os.path.join(HERE, "kabukigrin-club.json")))
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

# What else Studio deleted from Grinjuku by hand (found by diffing kb-town's
# Grinjuku chunks against gj-*: no moves, only these): same rule as CLEAR
STUDIO_CUT = [
    # the bike rack (bikes -31.2, 24) past its collider: Studio sliced it at a
    # part's edge, leaving half wheels in the west wall; the whole rack goes
    (-32.05, -30.35, -0.01, 1.0, 21.9, 26.1),
    (-24.55, -22.95, -0.01, 2.8, 3.6, 7.55),      # by the Sewers' mouth on A Main, under the club's screen
    (-24.05, -17.95, -0.01, 3.05, 30.9, 33.1),    # the backs' stall (its collider kept: the yard's counter)
    (-18.45, -14.05, 2.75, 3.4, 3.95, 4.3),       # a lightbox on the hall's front wall
    (7.95, 21.55, 2.25, 2.37, -4.05, -1.95),      # the strip lights under B's lintel
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


def gone_props():
    """The footprints of the Grinjuku props Studio removed (their colliders are
    gone from Kabukigrin's layout), as boxes (game x0, x1, y0, y1, z0, z1):
    a prop stays inside its collider's footprint, its roof and sign up to
    about 2.6 m (build_grinjuku's rule)."""
    out = []
    for s in G.SOLIDS:
        if s["k"] in G.PROPS and not kb_has(s):
            y = s.get("y", 0)
            out.append((s["x"] - s["w"] / 2 - 0.08, s["x"] + s["w"] / 2 + 0.08, y - 0.01, y + max(s["h"], 2.4) + 0.6,
                        s["z"] - s["d"] / 2 - 0.08, s["z"] + s["d"] / 2 + 0.08))
    return out


def inside(P, box):
    x0, x1, y0, y1, z0, z1 = box
    return all(x0 <= p[0] <= x1 and y0 <= p[1] <= y1 and z0 <= p[2] <= z1 for p in P)


def cut_club(obj, gone=()):
    """Takes the club out of a Grinjuku model: the removed props (`gone`:
    their footprints, every face wholly inside one), the CLEAR boxes and the
    dance floor's hole (the flat ground in DANCE, clipped at its edges)."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    # (faces, not triangles: the exporter then splits them as it split gj-*)
    dead = []
    for f in bm.faces:
        P = [game(v.co) for v in f.verts]
        if any(inside(P, b) for b in gone):
            dead.append(f)
            continue
        if all(abs(p[1]) < 0.02 for p in P):
            continue
        if any(inside(P, b) for b in CLEAR) or any(inside(P, b) for b in STUDIO_CUT):
            dead.append(f)
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
    hole = []
    for f in bm.faces:
        if not all(abs(v.co.z) < 0.06 for v in f.verts):
            continue
        c = f.calc_center_median()
        if x0 < c.x < x1 and z0 < -c.y < z1:
            hole.append(f)
    bmesh.ops.delete(bm, geom=hole, context="FACES")
    bm.to_mesh(me)
    bm.free()
    print(f"  {obj.name}: cut {len(set(dead))} club faces, {len(hole)} dance-floor faces")


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


# ------------------------------------------------------------- the club

# which GLB a club piece goes in, by the Grinjuku model whose material it took
CLUB_GLB = {"gj-shell": "kb-shell", "gj-props": "kb-props", "gj-neon": "kb-neon"}


def club_material(name, color, rough, metal, emit=None, strength=1.0):
    """A club piece's material, named by its key in the old Studio export
    ("glb:<gj model>:<material>|<tint>|<shadow>|n", "gen:<hash>||1"), so the
    game lights, shades and retextures it as it did. Kept as it is (never
    folded into GS_Paint)."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m["gs_hex"] = 0xffffff
    m["gs_keep"] = True
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit[:3], 1.0)
        b.inputs["Emission Strength"].default_value = strength
    return m


def texture_average(key):
    """A generated piece's texture, averaged to one linear colour."""
    path = os.path.join(HERE, "kb-hero", key[4:] + ".jpg")
    if not os.path.exists(path):
        return hexlin(0x808080)
    img = bpy.data.images.load(path)
    px = list(img.pixels)
    n = len(px) // 4
    srgb = [sum(px[c::4]) / n for c in range(3)]
    bpy.data.images.remove(img)
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in srgb)


def club_part(glb):
    """The club's still pieces for one GLB, plain: every Part Studio added (a
    box; on a collider, the collider's own numbers) in its material and tint,
    and in kb-props the generate_mesh hero pieces as boxes in their texture's
    average colour (their meshes come back through Blender later)."""
    b = Builder()
    n = 0
    for p in CLUB["boxes"]:
        if CLUB_GLB[p["file"]] != glb:
            continue
        x, z, w, d, h, y = p["b"]
        name = f"glb:{p['file']}:{p['mat']}|{p['tint']}|{1 if p['shadow'] else 0}|n"
        m = club_material(name, hexlin(int(p["tint"], 16)), p["rough"], p["metal"], p["emit"], p["emitStrength"])
        b.box(m, w, h, d, x, y, z)
        n += 1
    if glb == "kb-props":
        avg = {}
        for hp in CLUB["heroes"]:
            key = hp["key"]
            if key not in avg:
                avg[key] = club_material(f"{key}||1", texture_average(key), 0.85, 0.0)
            lo, hi = hp["lo"], hp["hi"]
            b.box(avg[key], max(hi[0] - lo[0], 0.02), max(hi[1] - lo[1], 0.02), max(hi[2] - lo[2], 0.02),
                  (lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2)
            n += 1
    if not n:
        return None
    o = to_object(b, "kb")
    from bake_kit import _lightmap_uv
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    _lightmap_uv(o, 4.0 / 1024)
    o.data.uv_layers.active = o.data.uv_layers["UVMap"]
    print(f"  {glb}: {n} club pieces")
    return o


# ------------------------------------------------------------- the Grinjuku part

class _Discard(Builder):
    """Where a removed prop's glow goes."""


def grinjuku_part(P):
    """Grinjuku's shell and neon, drawn by its own functions in its own order
    (the neon's draws interleave: shell, props, skyline). The props are drawn
    too, for their glow, but kb-props takes Grinjuku's from gj-props.glb
    itself (props_part): map_kit's lump() jitters its corners in a set's
    order, which changes every run, so a redrawn gj-props never matches the
    UVs its bake was made on."""
    G.NEONB = Builder()
    sh = Builder()
    G.facades(sh, G.NEONB, P)
    G.post_office(sh, G.NEONB, P)
    G.heavens(sh, G.NEONB, P)
    G.stairs_geo(sh, P)
    G.ground_paint(sh, P)

    pr = Builder()
    removed = 0
    for s in G.SOLIDS:
        fn = G.PROPS.get(s["k"])
        if not fn:
            continue
        # a removed prop's glow goes with it
        fn(pr, G.NEONB if kb_has(s) else _Discard(), P, s)
        removed += not kb_has(s)
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
    return sh, G.NEONB


def main():
    import quantize_glb
    bpy.ops.wm.read_factory_settings(use_empty=True)
    P = G.gj_palette()
    print("Kabukigrin layout", KB.get("hash"), len(KB["colliders"]), "colliders")
    sh, ne = grinjuku_part(P)
    out = []
    o = to_object(sh, "gj")
    unwrap(o)
    cut_club(o)
    out.append(export([o] + [c for c in [club_part("kb-shell")] if c], "kb-shell.glb"))
    o = to_object(ne, "gj")
    cut_club(o)
    out.append(export([o] + [c for c in [club_part("kb-neon")] if c], "kb-neon.glb"))
    out.append(props_part())
    quantize_glb.main(out)


def props_part():
    """kb-props: gj-props.glb as built and baked, the club cut out of it."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, "gj-props.glb"))
    o = [ob for ob in bpy.context.scene.objects if ob.type == "MESH"][0]
    o.name = "gj"
    cut_club(o, gone_props())
    return export([o] + [c for c in [club_part("kb-props")] if c], "kb-props.glb")


if __name__ == "__main__":
    main()
