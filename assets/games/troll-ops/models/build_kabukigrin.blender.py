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

# Phase 1: the Grinjuku pieces the club's props take the place of
PHASE1_CUT = [
    (-14.05, -13.65, 2.99, 4.07, 3.96, 17.04),     # the parapet on the hall side of the mezzanine: a glass rail now
    (-12.66, -11.14, 2.99, 4.3, 13.54, 14.86),     # the AC unit on the mezzanine: road cases now
]


def kb_has(s):
    """Is Grinjuku solid `s` still a collider in Kabukigrin's layout?"""
    for c in KB["colliders"]:
        x, z, w, d = c[:4]
        if abs(x - s["x"]) < 0.01 and abs(z - s["z"]) < 0.01 and abs(w - s["w"]) < 0.01 and abs(d - s["d"]) < 0.01:
            return True
    return False


# ------------------------------------------------------------- export

def kb_paint():
    """The club's flat paint: like GS_Paint (vertex colours) but its own
    material, so it never shares Grinjuku's baked GS_Paint in the game."""
    m = bpy.data.materials.get("KB_Paint")
    if m:
        return m
    m = paint_material().copy()
    m.name = "KB_Paint"
    return m


def to_object(b, name, paint=None):
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
    paint_idx = b._mi(paint or paint_material())
    white = (1.0, 1.0, 1.0, 1.0)
    for f in bm.faces:
        m = b.mats[f.material_index]
        if m.name in ("GS_Paint", "KB_Paint") or m.get("gs_keep"):
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
        if any(inside(P, b) for b in CLEAR) or any(inside(P, b) for b in STUDIO_CUT) or any(inside(P, b) for b in PHASE1_CUT):
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


# the Studio boxes the club's props draw now (phase 1): the stage and its
# step, the bar counter, and the counter's glow and tile top
MODELLED_COLLIDERS = {154, 155, 156}


def modelled_box(p):
    if p["collider"] in MODELLED_COLLIDERS:
        return True
    x, z, w, d, h, y = p["b"]
    return abs(x + 15.9) < 0.01 and abs(z - 12.2) < 0.01 and p["mat"] in ("GJ_NeonViolet", "GS_Tile")


def club_part(glb):
    """The club's still pieces for one GLB, plain: every Part Studio added (a
    box; on a collider, the collider's own numbers) in its material and tint."""
    b = Builder()
    n = 0
    for p in CLUB["boxes"]:
        if CLUB_GLB[p["file"]] != glb or modelled_box(p):
            continue
        x, z, w, d, h, y = p["b"]
        name = f"glb:{p['file']}:{p['mat']}|{p['tint']}|{1 if p['shadow'] else 0}|n"
        m = club_material(name, hexlin(int(p["tint"], 16)), p["rough"], p["metal"], p["emit"], p["emitStrength"])
        b.box(m, w, h, d, x, y, z)
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
    quantize_glb.main(out, positions=True)


def props_part():
    """kb-props: gj-props.glb as built and baked, the club cut out of it; the
    club's Parts; Studio's generated hero pieces."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, "gj-props.glb"))
    o = [ob for ob in bpy.context.scene.objects if ob.type == "MESH"][0]
    o.name = "gj"
    cut_club(o, gone_props())
    props = props_object()
    return export([o] + [c for c in [club_part("kb-props"), hero_part(), props] if c], "kb-props.glb")


def props_object():
    """The club's props (kb_club.py, placed in kb_props.py) as one object,
    "kbp", their registry written out: the prop colliders for the game,
    the faces and bounds for the obstruction test."""
    import kb_props
    b, R = kb_props.place()
    write_registry(R)
    o = to_object(b, "kbp", paint=kb_paint())
    from bake_kit import _lightmap_uv
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    _lightmap_uv(o, 4.0 / 2048)
    o.data.uv_layers.active = o.data.uv_layers["UVMap"]
    print(f"  kb-props: the club's props, {len(o.data.polygons)} faces, {len(R.props)} props, {len(R.colliders)} colliders")
    return o


def write_registry(R):
    """maps/kabukigrin-props.js (the colliders the props need) and
    models/kabukigrin-faces.json (faces that must stay in view, every
    prop's bounds); prints the props whose bounds cross."""
    js = os.path.join(HERE, "..", "maps", "kabukigrin-props.js")
    NL = chr(10)
    rows = ("," + NL).join("    [" + ",".join(f"{v:g}" for v in c) + "]" for c in R.colliders)
    lines = [
        "// Written by models/build_kabukigrin.blender.py: the colliders Kabukigrin's",
        "// Blender props need (anything over 0.6 m, a shelf that sticks out), on top",
        "// of the Studio layout's (kabukigrin-layout.js): [x, z, w, d, h, y, pen].",
        "export const KB_PROPS = {",
        "  colliders: [",
        rows + ",",
        "  ],",
        "};",
        "",
    ]
    with open(js, "w", newline=NL) as f:
        f.write(NL.join(lines))
    import kb_props
    faces = kb_props.CODE_FACES + R.faces
    heroes = []
    for h in CLUB["heroes"]:
        if remodelled(h):
            continue
        lo, hi = list(h["lo"]), list(h["hi"])
        if h["key"] == "gen:e26da464":
            lo[1], hi[1] = VALANCE    # raised (hero_part)
        heroes.append({"id": f"hero:{h['key'][4:]}", "lo": lo, "hi": hi, "on": None})
    with open(os.path.join(HERE, "kabukigrin-faces.json"), "w", newline=NL) as f:
        json.dump({"eyes": kb_props.EYES, "known": kb_props.KNOWN, "faces": faces, "props": R.props + heroes}, f, indent=1)
    # the overlap pass: no two props' bounds cross, unless one stands on the other
    # (the floor's scatter and the wall slats span whole rooms: their own
    # placement keeps them off the furniture)
    solid = [p for p in R.props if not p["id"].startswith(("cash-", "floor-", "slats-"))]
    bad = []
    for i, a in enumerate(solid):
        for c in solid[i + 1:]:
            if a.get("on") == c["id"] or c.get("on") == a["id"] or (a.get("on") and a.get("on") == c.get("on")):
                continue
            if all(a["lo"][k] < c["hi"][k] - 0.003 and c["lo"][k] < a["hi"][k] - 0.003 for k in range(3)):
                bad.append((a["id"], c["id"]))
    print(f"  registry: {len(R.colliders)} colliders, {len(faces)} faces, {len(R.props)} props; overlaps: {len(bad)}")
    heavy = sorted(R.props, key=lambda p: -p.get("tris", 0))[:12]
    print("  heaviest: " + ", ".join(f"{p['id']} {p.get('tris', 0)}" for p in heavy))
    for a, c in bad:
        print(f"    OVERLAP {a} x {c}")


HERO_KEEP = 0.15
VALANCE = (5.98, 7.36)   # where the DJ's valance hangs (Studio had it 5 .. 7, over the LED wall)   # the share of a generated piece's triangles kept


def remodelled(h):
    """Is generated piece `h` one Blender models now (phase 1)? The hall's
    booths and their tables, its bar stools, the mezzanine's sound desk."""
    k, lo = h["key"], h["lo"]
    return k in ("gen:7524a13f", "gen:8180f38e") or (k == "gen:b05ec518" and lo[0] < -5)         or (k == "gen:9bd833bb" and lo[1] > 2.9)


def hero_part():
    """Studio's generate_mesh pieces (the marquee box, the kanji panels, the DJ
    drapes, the office's, the tatami room's and the yokocho's pieces) from the
    Studio export, kb-town.glb, with their textures; light-map UVs for the
    bake. The pieces Blender models now are left out."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, "kb-town.glb"))
    new = [ob for ob in bpy.data.objects if ob not in before]
    heroes = [ob for ob in new if ob.type == "MESH" and any(m and m.name.startswith("gen:") for m in ob.data.materials)]
    for ob in new:
        if ob not in heroes:
            bpy.data.objects.remove(ob)
    if not heroes:
        return None
    drop = [(h["lo"], h["hi"]) for h in CLUB["heroes"] if remodelled(h)]
    bpy.ops.object.select_all(action="DESELECT")
    for ob in heroes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = heroes[0]
    if len(heroes) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = "hero"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    gone = []
    for f in bm.faces:
        c = game(f.calc_center_median())
        if any(all(lo[a] - 0.01 <= c[a] <= hi[a] + 0.01 for a in range(3)) for lo, hi in drop):
            gone.append(f)
    bmesh.ops.delete(bm, geom=gone, context="FACES")
    # Studio's valance over the DJ hung 5 .. 7 m, over the LED wall's top
    # metre (it ends at 5.95; rule 9): squashed up between the wall's top and
    # the hall's ceiling, so it frames the wall instead
    vi = next((i for i, m in enumerate(o.data.materials) if m and m.name.startswith("gen:e26da464")), None)
    if vi is not None:
        vs = {v for f in bm.faces if f.material_index == vi for v in f.verts}
        for v in vs:
            y = v.co.z    # Blender z is the game's y
            v.co.z = VALANCE[0] + (y - 5.0) * (VALANCE[1] - VALANCE[0]) / 2.0
        print(f"  kb-props: the DJ valance raised to {VALANCE[0]} .. {VALANCE[1]} m ({len(vs)} corners)")
    bm.to_mesh(o.data)
    bm.free()
    # generate_mesh pieces are dense (1,900 triangles on a flat kanji panel):
    # a quarter of them keeps the shapes and the pictures, at a quarter of
    # the download
    n0 = len(o.data.polygons)
    dec = o.modifiers.new("decimate", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = HERO_KEEP
    bpy.ops.object.modifier_apply(modifier=dec.name)
    print(f"  kb-props: hero pieces decimated {n0} -> {len(o.data.polygons)} faces")
    from bake_kit import _lightmap_uv
    _lightmap_uv(o, 4.0 / 1024)
    o.data.uv_layers.active = o.data.uv_layers[0]
    print(f"  kb-props: Studio's hero pieces, {len(o.data.polygons)} faces ({len(gone)} left out: Blender's now)")
    return o


if __name__ == "__main__":
    main()
