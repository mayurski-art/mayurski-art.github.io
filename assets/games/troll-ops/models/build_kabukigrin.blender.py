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
triangle for triangle. Then the club is cut out of it: the props Studio removed (their colliders are
gone from kabukigrin-layout.js), the street dressing where the club's walls
are (CLEAR, was kabukigrin.js clearForClub), and the dance floor's hole over
the mirror pit (DANCE, was cutDanceFloor). Those cut parts are objects named
"gj" in each GLB; the club's own geometry goes in objects named "kb".

Phase 4 (the bake): each of kb-shell and kb-props is light-mapped as one
atlas over all its objects (bake()), the rest of the map standing round it
and the fixed lights in (bake_lamps); kabukigrin-placements.json, written
here, lists both for bake_map_ground.blender.py too.

The playable layout is the contract: nothing here moves a collider.
"""
import importlib.util
import inspect
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
G_lantern = G.lantern   # (Kabukigrin hangs its own: kb_lantern)
G_glyphs_on_board, G_kanban, G_shopfront = G.glyphs_on_board, G.kanban, G.shopfront   # (and letters its signs)

KB = json.load(open(os.path.join(HERE, "kabukigrin-layout.json")))
CLUB = json.load(open(os.path.join(HERE, "kabukigrin-club.json")))

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


# Grinjuku hangs a lantern at each end of an izakaya's or ramen shop's sign
# band, 0.3 m out and 2.58 .. 3.0 m up: in front of the band (2.78 .. 3.33,
# 0.25 deep), rule 9 (user, 2026-10-24). Kabukigrin's hang lower, on the
# pilasters either side of the shop, under the band, lantern and caps all in
# kb-neon (no bake). The shell still draws the old caps where they were, so
# it stays gj-shell face for face (the gj bake fits it), and cut_club drops
# them after the unwrap: LANTERN_CAPS (game x, z, radius, y0, y1).
LANTERN_CAPS = []
_lanterns = []


def kb_lantern(ne, sh, P, face, t, y, o, white=False, r=0.18, h=0.42):
    G_lantern(_Discard(), sh, P, face, t, y, o, white, r, h)
    x, z = face.world(t, o)
    LANTERN_CAPS.append((x, z, r * 0.7, y - h - 0.06, y + 0.06))
    # shopfront hangs them in pairs, at a + 0.25 then c - 0.25; the
    # pilasters' middles are 0.425 further out (pad 0.35)
    _lanterns.append(t)
    left = len(_lanterns) % 2 == 1
    if not left:
        assert t > _lanterns[-2], "lanterns not in pairs"
    tt = t - 0.425 if left else t + 0.425
    r2, h2, top = 0.16, 0.38, 2.62
    x, z = face.world(tt, o)
    STREET["lanterns"].append((x, z, r2, top - h2 - 0.06, top + 0.06))
    ne.cyl(P["lantern_w" if white else "lantern"], r2, (x, top - h2, z), (x, top, z), seg=10)
    ne.cyl(P["black"], r2 * 0.7, (x, top, z), (x, top + 0.06, z), seg=10)
    ne.cyl(P["black"], r2 * 0.7, (x, top - h2 - 0.06, z), (x, top - h2, z), seg=10)


def is_old_cap(P):
    """Is a face (game points) one of the old lantern caps' (a cylinder of
    that radius round that axis, between those heights)?"""
    for (x, z, r, y0, y1) in LANTERN_CAPS:
        if (all(y0 - 0.002 <= p[1] <= y1 + 0.002 for p in P)
                and all(abs(math.hypot(p[0] - x, p[2] - z) - r) < 0.004 or math.hypot(p[0] - x, p[2] - z) < 0.004 for p in P)):
            return True
    return False


# Grinjuku's signs carry made-up glyphs (glyph_strokes); Kabukigrin's say
# real Japanese (user, 2026-10-24). The glyphs are still drawn, so the shell
# stays gj-shell face for face and the builder's rng runs as it did, then
# cut after the unwrap (GLYPH_CUT: thin game boxes round each board's glyph
# plane); each board goes to maps/kabukigrin-sign-data.js (SIGNS), where
# kabukigrin-signs.js letters it: [kind, x, y, z, nx, nz, size, slots,
# ink, glow, shop], "row" left to right, "col" top to bottom.
SIGNS = []
GLYPH_CUT = []
_shop = [None]


def cleared(x, y, z):
    """Is (x, y, z) in a box the club cleared of Grinjuku (CLEAR,
    STUDIO_CUT, PHASE1_CUT)? A sign or a shop there was cut with it."""
    return any(b[0] <= x <= b[1] and b[2] <= y <= b[3] and b[4] <= z <= b[5] for b in CLEAR + STUDIO_CUT + PHASE1_CUT)


def _sign(kind, p, n, g, slots, m, shop):
    if cleared(*p):
        return
    SIGNS.append([kind, round(p[0], 3), round(p[1], 3), round(p[2], 3), n[0], n[1], round(g, 3), slots,
                  int(m["gs_hex"]), 1 if m.name.startswith("GJ_Neon") else 0, shop])


def _cut(face, ta, tb, y0, y1, o, dt=0.0):
    """A thin game box round the plane `o` out of `face`, t ta..tb (or, dt
    set, round the plane across t at ta, o from o .. tb)."""
    pad = 0.004
    if dt:
        (xa, za), (xb, zb) = face.world(ta, o), face.world(ta, tb)
    else:
        (xa, za), (xb, zb) = face.world(ta, o), face.world(tb, o)
    GLYPH_CUT.append((min(xa, xb) - pad, max(xa, xb) + pad, y0 - pad, y1 + pad, min(za, zb) - pad, max(za, zb) + pad))


def _normal(face, along=0):
    """The face's outward normal (along=0), or +-1 along its run, as (x, z)."""
    if along:
        return (along, 0) if face.ax == "x" else (0, along)
    return (0, face.n) if face.ax == "x" else (face.n, 0)


def kb_glyphs_on_board(b, m, face, t0, t1, y0, y1, o, rng, cols=None):
    G_glyphs_on_board(b, m, face, t0, t1, y0, y1, o, rng, cols)
    h = y1 - y0
    g = h * 0.78
    n = cols or max(1, int((t1 - t0) / (g * 1.15)))
    span = n * g * 1.15
    start = (t0 + t1) / 2 - span / 2 + g * 0.075
    _cut(face, start - 0.01, start + span, y0, y1, o + 0.012)
    x, z = face.world((t0 + t1) / 2, o + 0.014)
    shop = _shop[0] or inspect.stack()[1].function
    _sign("row", (x, y0 + h * 0.11 + g / 2, z), _normal(face), g, n, m, shop)


def kb_kanban(sh, ne, P, face, t, y0, height, rng, out=1.0):
    # what the kanban will pick, peeked: a lightbox (dark glyphs) or a dark
    # board with neon ones
    st = rng.getstate()
    lightbox = rng.random() < 0.4
    if lightbox:
        rng.choice(["lightbox", "lightbox_r", "lightbox_y", "lightbox_b"])
        ink = P["sign_back"]
    else:
        ink = P[G.neon_pick(rng)]
    rng.setstate(st)
    STREET["kanban"].append((face, t, y0, height, out))
    G_kanban(sh, ne, P, face, t, y0, height, rng, out)
    w, o0 = 0.26, 0.12
    g = out * 0.7
    n = max(2, int((height - 0.3) / (g * 1.1)))
    top = y0 + height - 0.18 - 0.1 * g
    bot = y0 + height - 0.18 - n * g * 1.1
    oc = o0 + out / 2
    for side in (-1, 1):
        ts = t + side * (w / 2 + 0.012)
        _cut(face, ts, o0 + (out - g) / 2 + g + 0.01, bot, top, o0 + (out - g) / 2 - 0.01, dt=1)
        x, z = face.world(t + side * (w / 2 + 0.014), oc)
        _sign("col", (x, (top + bot) / 2, z), _normal(face, side), g, n, ink, "kanban")


# the ramen shops: their fronts built properly (kb_street.py), in the bay
# Grinjuku's shopfront left between its pilasters, its insides cut (RAMEN_CUT)
RAMEN = []
RAMEN_CUT = []


def kb_shopfront(sh, ne, P, face, t0, t1, kind, rng):
    xm, zm = face.world((t0 + t1) / 2, 0.0)
    if kind == "ramen" and not cleared(xm, 1.0, zm):
        RAMEN.append((face, t0, t1))
        a, c = t0 + 0.35, t1 - 0.35
        (xa, za), (xb, zb) = face.world(a, -0.075), face.world(c, 0.06)
        RAMEN_CUT.append((min(xa, xb) - 0.005, max(xa, xb) + 0.005, -0.01, 2.62, min(za, zb) - 0.005, max(za, zb) + 0.005))
    STREET["shops"].append((face, t0, t1, kind))
    _shop[0] = kind
    try:
        G_shopfront(sh, ne, P, face, t0, t1, kind, rng)
    finally:
        _shop[0] = None


# Phase 3, the street: what Grinjuku's builders put on each street face, as
# they draw it (none of these wrappers touches the rng, so the shell stays
# gj-shell face for face), for kb_street.py to fit its furniture round:
# the buildings, their shops, everything on the floors above (windows, AC
# units, balconies, ledges) and the new lanterns
STREET = {"buildings": [], "shops": [], "upper": [], "lanterns": [], "kanban": []}
G_building, G_upper_floors = G.building, G.upper_floors


def kb_building(sh, ne, P, face, t0, t1, base_y, top, depth, rng, street, style=None):
    STREET["buildings"].append((face, t0, t1, base_y, top, street))
    return G_building(sh, ne, P, face, t0, t1, base_y, top, depth, rng, street, style)


class _Rec:
    """A face that draws as the face it wraps and notes every piece:
    (face, what, t0, t1, y, h, o0, o1)."""

    def __init__(self, face, P):
        self.f, self.P = face, P
        self.ax, self.at, self.t0, self.n = face.ax, face.at, face.t0, face.n

    def world(self, t, o):
        return self.f.world(t, o)

    def box(self, b, m, t0, t1, y, h, o0, o1):
        self.f.box(b, m, t0, t1, y, h, o0, o1)
        what = "ac" if m is self.P["ac"] else "balcony" if (m is self.P["sill"] and max(o0, o1) > 0.5) else "box"
        STREET["upper"].append((self.f, what, min(t0, t1), max(t0, t1), y, h, min(o0, o1), max(o0, o1)))

    def quad(self, b, m, t0, t1, y, h, o):
        self.f.quad(b, m, t0, t1, y, h, o)
        STREET["upper"].append((self.f, "window", min(t0, t1), max(t0, t1), y, h, 0.0, o))

    def cyl_out(self, b, m, r, t, y, o0, o1, seg=10):
        self.f.cyl_out(b, m, r, t, y, o0, o1, seg)


def kb_upper_floors(sh, ne, P, face, t0, t1, y0, top, mat_wall, rng, windows="punched"):
    return G_upper_floors(sh, ne, P, _Rec(face, P), t0, t1, y0, top, mat_wall, rng, windows)


def is_glyph(P):
    return any(inside(P, b) for b in GLYPH_CUT) or any(inside(P, b) for b in RAMEN_CUT)


def write_signs():
    path = os.path.join(HERE, "..", "maps", "kabukigrin-sign-data.js")
    rows = ",\n".join("  " + json.dumps(s, ensure_ascii=False) for s in SIGNS)
    with open(path, "w", encoding="utf8", newline="\n") as f:
        f.write("// Written by models/build_kabukigrin.blender.py: the street's sign boards,\n"
                "// lettered by kabukigrin-signs.js. [kind, x, y, z, nx, nz, size, slots,\n"
                "// ink, glow, shop]. Don't edit by hand.\n"
                f"export const KB_SIGNS = [\n{rows},\n];\n")
    print(f"  signs: {len(SIGNS)} boards ({sum(s[0] == 'col' for s in SIGNS)} kanban faces), {len(GLYPH_CUT)} glyph cuts")


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


def game(v):
    """Blender (x, y, z) -> game (x, y-up, z)."""
    return v.x, v.z, -v.y


# phase 3: the Grinjuku props Kabukigrin draws again at prop level, at the
# same colliders (kb_street.py): cut from gj-props like the removed ones
REDRAWN = {"truck", "crates"}


def gone_props():
    """The footprints of the Grinjuku props Studio removed (their colliders are
    gone from Kabukigrin's layout), as boxes (game x0, x1, y0, y1, z0, z1):
    a prop stays inside its collider's footprint, its roof and sign up to
    about 2.6 m (build_grinjuku's rule)."""
    out = []
    for s in G.SOLIDS:
        if s["k"] in G.PROPS and (not kb_has(s) or s["k"] in REDRAWN):
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
        if (LANTERN_CAPS and is_old_cap(P)) or is_glyph(P):
            dead.append(f)
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


# Phase 3: the pachinko parlour's room behind Studio's glass (kb_street
# PARLOUR): Grinjuku's facade there and the building's inside cut open after
# the unwrap, the ground kept (game x0, x1, y0, y1, z0, z1)
PARLOUR_CUT = [
    (-31.78, -31.45, 0.03, 2.75, -24.15, -6.35),     # the facade's plane, to the glass's head
    (-35.7, -31.7, 0.03, 3.05, -24.15, -6.35),       # the building's inside, the room's height
]


def cut_boxes(obj, boxes):
    """Opens boxes in a model: faces that cross a box are bisected at its
    planes (UVs interpolate, as the dance floor's cut), then every face whose
    middle is inside goes. The ground (flat at y 0) is kept."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    gone = 0
    for x0, x1, y0, y1, z0, z1 in boxes:
        lo, hi = (x0, -z1, y0), (x1, -z0, y1)          # Blender: x, y = -game z, z = game y

        def crossing():
            out = []
            for f in bm.faces:
                if all(v.co.z < 0.03 for v in f.verts):
                    continue
                if all(min(v.co[a] for v in f.verts) < hi[a] and max(v.co[a] for v in f.verts) > lo[a] for a in range(3)):
                    out.append(f)
            return out
        for a in range(3):
            for val in (lo[a], hi[a]):
                fs = crossing()
                if not fs:
                    break
                co, no = [0, 0, 0], [0, 0, 0]
                co[a], no[a] = val, 1
                geom = list({e for f in fs for e in f.edges}) + fs + list({v for f in fs for v in f.verts})
                bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, dist=1e-5)
        dead = []
        for f in bm.faces:
            c = f.calc_center_median()
            if all(lo[a] + 1e-4 < c[a] < hi[a] - 1e-4 for a in range(3)) and not all(v.co.z < 0.03 for v in f.verts):
                dead.append(f)
        bmesh.ops.delete(bm, geom=dead, context="FACES")
        gone += len(dead)
    bm.to_mesh(me)
    bm.free()
    print(f"  {obj.name}: {gone} faces cut for the parlour")


# ------------------------------------------------------------- the bake (phase 4)

# Grinjuku's night sky and asphalt (build_grinjuku's bake, maps hemi sky and
# sky horizon); 40 W a candela, as there
BAKE_SKY = (0x6a5aa8, 0x3a1a4a, 1.7)
BAKE_GROUND = 0x2a2a30
LAMP_W = 40
# the light maps hold half the light (kabukigrin.js lights them at 2 PI): the
# club's lamp-lit walls and bar run past 1, which an 8-bit image would clip
BAKE_SCALE = 0.5
# the borrowed rooms' lights stay live (kabukigrin.js LIVE_LIGHTS: their
# insides are drawn in code, unbaked): the green room, the tatami room, the office
LIVE_LIGHTS = {(-13, 29), (-28, 27), (-10, 21.5)}
# Grinjuku's A site and A Heaven lights, which the club's took the place of,
# and its Vents light, which Kabukigrin turns lantern red (its own in the
# layout). Its A rope room's (the riser now) and the Sewers' stay: the doc
# counted them replaced, but nothing of the club's lights either, and gj-shell's
# bake carried them into Kabukigrin until now
GJ_REPLACED = {(-22, 12), (-9, 18), (15, -3)}
# the live lights fell off as 1 / d^1.6 (club-live.js addLight), a baked lamp
# as 1 / d^2: the club's are turned up to light the hall's walls as they did
CLUB_LAMP_K = 2.0
# what the game draws over the bake in code, which must shade it: the hall's
# ceiling (kabukigrin.js clubInterior), as boxes (w, h, d, x, y, z)
BAKE_OCCLUDERS = [(17.3, 0.3, 19.2, -23.05, 7.4, 14.0)]


def bake_lamps():
    """The fixed lights: the doc's 14 (3.3: the club's six and the layout's
    red Vents light, Grinjuku's other seven) and the two of Grinjuku's that
    kept the riser and the Sewers lit. [x, y, z, colour, intensity, distance]
    as the placements file has them."""
    out = []
    for x, y, z, hexc, power, rng in KB["lights"]:
        if (x, z) not in LIVE_LIGHTS:
            out.append([x, y, z, int(hexc[1:], 16), round(power * CLUB_LAMP_K, 3), rng])
    gj = json.load(open(os.path.join(HERE, "grinjuku-placements.json")))["lights"]
    out += [L for L in gj if (L[0], L[2]) not in GJ_REPLACED]
    assert len(out) == 16, f"{len(out)} lamps"
    return out


def write_placements():
    """models/kabukigrin-placements.json, as tools/troll-ops-map-placements.mjs
    writes it for a map that places its models with mapModel (Kabukigrin loads
    its own): what stands round each model while it bakes, and the ground
    bake's (bake_map_ground.blender.py) models and lamps."""
    spec = {"map": "kabukigrin", "bounds": {"minX": -32, "maxX": 32, "minZ": -42, "maxZ": 42},
            "sky": [BAKE_SKY[0], BAKE_SKY[1]], "ground": BAKE_GROUND,
            "placements": [[n, 0, 0, 0, 0, 1, 1, 1] for n in ("kb-shell", "kb-props", "kb-neon", "gj-skyline")],
            "lights": bake_lamps(), "occluders": BAKE_OCCLUDERS}
    with open(os.path.join(HERE, "kabukigrin-placements.json"), "w", newline="\n") as f:
        json.dump(spec, f, indent=1)
        f.write("\n")
    return spec


def bake(objs, name, res=2048):
    """One light map for a GLB's objects (one atlas: their materials are
    shared), the rest of the map standing round them, the lamps in.
    KB_BAKE=0 skips it, for a quick look at the geometry (its light map is then wrong)."""
    if os.environ.get("KB_BAKE") == "0":
        return
    from bake_kit import bake_lightmap, import_context, remove_context
    spec = json.load(open(os.path.join(HERE, "kabukigrin-placements.json")))
    # (the context's materials and pictures go after too: the club's pieces
    # find their materials by name, and a GLB's would be found first)
    before, pics = set(bpy.data.materials), set(bpy.data.images)
    ctx = import_context([(os.path.join(HERE, n + ".glb"), x, z, yaw, y, (sx, sy, sz))
                          for (n, x, y, z, yaw, sx, sy, sz) in spec["placements"]
                          if n != name and os.path.exists(os.path.join(HERE, n + ".glb"))])
    lights = [((x, y, z), col, inten * LAMP_W, 0.15) for (x, y, z, col, inten, _d) in spec["lights"]]
    bake_lightmap(objs, os.path.join(HERE, name + "-bake.webp"), res=res, samples=128, sky=BAKE_SKY,
                  ground=BAKE_GROUND, lights=lights, blur=1, occluders=spec.get("occluders", ()), scale=BAKE_SCALE)
    remove_context(ctx)
    for m in set(bpy.data.materials) - before:
        bpy.data.materials.remove(m)
    for i in set(bpy.data.images) - pics:
        bpy.data.images.remove(i)


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
        if p["mat"] == "GS_Timber" and abs(x + 31.66) < 0.01 and abs(z + 15.25) < 0.01 and h > 5:
            # the pachinko front's backing: open now over the glass (the
            # parlour's room is behind it), kept under it and over its head
            b.box(m, w, 0.28, d, x, 0.0, z)
            b.box(m, w, h - 2.74, d, x, 2.74, z)
            n += 1
            continue
        if p["mat"] == "GS_Tile" and abs(x + 31.55) < 0.01 and abs(z + 15.25) < 0.01 and d < 0.1:
            continue        # the doors' meeting mullion: they slide open now (code), it'd stand in the doorway
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
    G.lantern = kb_lantern
    G.glyphs_on_board, G.kanban, G.shopfront = kb_glyphs_on_board, kb_kanban, kb_shopfront
    G.building, G.upper_floors = kb_building, kb_upper_floors
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
        fn(pr, G.NEONB if kb_has(s) and s["k"] not in REDRAWN else _Discard(), P, s)
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
    if os.environ.get("KB_STREET_DUMP"):
        # what the street's faces carry, for planning (no export)
        f2 = lambda f: [f.ax, round(f.at, 3), round(f.t0, 3), f.n]   # noqa: E731
        dump = {"buildings": [[f2(f), *[round(v, 3) for v in r]] for f, *r in STREET["buildings"]],
                "shops": [[f2(f), round(a, 3), round(c, 3), k] for f, a, c, k in STREET["shops"]],
                "upper": [[f2(f), w, *[round(v, 3) for v in r]] for f, w, *r in STREET["upper"]],
                "lanterns": STREET["lanterns"], "signs": SIGNS}
        json.dump(dump, open(os.environ["KB_STREET_DUMP"], "w"))
        return
    import kb_street
    write_placements()
    out = []
    o = to_object(sh, "gj")
    cut_club(o)
    cut_boxes(o, PARLOUR_CUT + kb_street.BAND_CUTS)
    objs = [o] + [c for c in [club_part("kb-shell")] if c]
    bake(objs, "kb-shell")
    out.append(export(objs, "kb-shell.glb"))
    o = to_object(ne, "gj")
    cut_club(o)
    cut_boxes(o, PARLOUR_CUT + kb_street.BAND_CUTS)
    out.append(export([o] + [c for c in [club_part("kb-neon")] if c], "kb-neon.glb"))
    out.append(props_part())
    write_signs()
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
    objs = [o] + [c for c in [club_part("kb-props"), hero_part(), props, parlour_object()] if c]
    bake(objs, "kb-props")
    return export(objs, "kb-props.glb")


def parlour_object():
    """The pachinko parlour's room (kb_street.py): its own object and paint,
    KB_Parlour, which the game lights from inside."""
    import kb_club
    import kb_street
    b, R = Builder(), kb_club.Registry()
    kb_street.pachinko_parlour(b, kb_club.palette(), R)
    m = bpy.data.materials.get("KB_Parlour") or kb_paint().copy()
    m.name = "KB_Parlour"
    o = to_object(b, "kbpachi", paint=m)
    from bake_kit import _lightmap_uv
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    _lightmap_uv(o, 4.0 / 1024)
    o.data.uv_layers.active = o.data.uv_layers["UVMap"]
    print(f"  kb-props: the pachinko parlour, {len(o.data.polygons)} faces")
    return o


def props_object():
    """The club's props (kb_club.py, placed in kb_props.py) as one object,
    "kbp", their registry written out: the prop colliders for the game,
    the faces and bounds for the obstruction test."""
    import kb_props
    import kb_street
    import random
    b, R = kb_props.place()
    P = kb_street.ramen_palette(kb_props.K.palette())
    rng = random.Random(30)
    for i, (face, t0, t1) in enumerate(RAMEN):
        # drawn 0.11 m out: some shops' bays are closed at the facade's plane
        # (a terrace's, a block's face across them), the recessed ones lose nothing
        kb_street.ramen_front(kb_street.Out(face, 0.11), b, P, R, f"ramen-{i}", t0, t1, rng, SIGNS)
    print(f"  kb-props: {len(RAMEN)} ramen fronts")
    # phase 3: the street's furniture, fitted round what is on the Mains' walls
    S = kb_street.street_space(STREET, SIGNS, CLUB, KB, cleared, kb_street.STREET_CODE_FACES, R)
    kb_street.furnish(b, P, R, STREET, S, random.Random(31))
    hp = kb_street.street_palette(P)
    kb_street.ramen_stall(b, hp, R)
    kb_street.band_ends(b, hp, R)
    for s in G.SOLIDS:
        if s["k"] == "truck" and kb_has(s):
            kb_street.kei_truck(b, hp, R, f"kei-{s['side'].lower()}", s["x"] - math.copysign(0.08, s["x"]), s["z"],   # (its mirrors off the pachinko glass's front: rule 9)
                                s.get("f", 0) or 0, random.Random(int(s["x"])))
        if s["k"] == "crates" and kb_has(s):
            kb_street.crate_stack(b, hp, R, f"crates-{int(s['x'])}-{int(s['z'])}", s["x"], s["z"], s["w"], s["d"], s["h"], s.get("f", 0) or 0, random.Random(int(s["x"] * 7 + s["z"])))
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
        "// of the Studio layout's (kabukigrin-layout.js): [x, z, w, d, h, y, pen];",
        "// and the notes on the floor, [x, y, z, ry] (club-live.js's thrown money lands there).",
        "export const KB_PROPS = {",
        "  colliders: [",
        rows + ",",
        "  ],",
        "  cash: [",
        ("," + NL).join("    [" + ",".join(f"{v:g}" for v in c) + "]" for c in R.cash) + ",",
        "  ],",
        "};",
        "",
    ]
    with open(js, "w", newline=NL) as f:
        f.write(NL.join(lines))
    import kb_props
    import kb_street
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
        json.dump({"eyes": kb_props.EYES + kb_street.EYES, "known": kb_props.KNOWN + kb_street.KNOWN, "faces": faces, "props": R.props + heroes}, f, indent=1)
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
    """Is generated piece `h` left out of the build? The ones Blender models
    now (phase 1): the hall's booths and their tables, its bar stools, the
    mezzanine's sound desk; and the DJ wall's two red drapes (user,
    2026-10-24: "no drapes"; the south one hid the tatami window's end)."""
    k, lo = h["key"], h["lo"]
    return (k in ("gen:7524a13f", "gen:8180f38e", "gen:2771c445") or (k == "gen:b05ec518" and lo[0] < -5)
            or (k == "gen:9bd833bb" and lo[1] > 2.9))


def hero_part():
    """Studio's generate_mesh pieces (the marquee box, the kanji panels, the
    office's, the tatami room's and the yokocho's pieces) from the Studio
    export, kb-town.glb, with their textures; light-map UVs for the bake.
    The pieces left out (remodelled) aren't imported."""
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
