"""
Troll Ops — Grin Site props, modelled headlessly in Blender.

Run with:
  blender --background --python build_grinsite.blender.py

Writes gs-*.glb straight into this folder (grinsite-props.js loads them).

Everything is authored in GAME coordinates (x right, y up, z toward the
viewer, metres) and rotated into Blender's Z-up space just before export,
so the numbers here read the same as the collider numbers in maps.js.
Where a model stands in for a collider (the tower, scaffolds, stairs,
cabin), its dimensions are copied from the approved blockout: change one,
change the other.

Flat-painted parts are merged into one vertex-coloured "GS_Paint" material
per model at export (see Builder.finish), so a model costs one draw call
for all its paint plus one per photo-textured material. Only the names in
TEXTURED (which must match grinsite-props.js's GS_RETEXTURE) and emissive
lamps keep their own material.

UVs are world-metre box projections (u,v = the two axes a face doesn't
point along), so a texture tiles at the same real size on every face of
every part. surface-textures.js's retexture() sets the metres-per-tile
through its repeat value (repeat 0.5 = one tile every 2 m).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
import math  # noqa: E402
import random  # noqa: E402,F401
from mathutils import Vector  # noqa: E402

# ------------------------------------------------------------------ tower

def build_tower(P):
    b = Builder()
    L1, L2 = 3.5, 6.7
    b.box(P["slab"], 17, 0.2, 13, 0, 0, 0)
    colX, colZ = [-7.7, -2.6, 2.6, 7.7], [-5.7, 0, 5.7]
    for cx in colX:
        for cz in colZ:
            b.box(P["conc"], 0.6, 3.0, 0.6, cx, 0.2, cz, bevel=0.02)
            h = 2.9 if cx < 0 else 3.8
            b.box(P["conc"], 0.6, h, 0.6, cx, L1, cz, bevel=0.02)
            if cx > 0:
                # starter bars out of the unfinished columns, splayed a touch
                for ox in (-0.2, 0.2):
                    for oz in (-0.2, 0.2):
                        top = L1 + h
                        tip = (cx + ox * 1.25, top + 0.9, cz + oz * 1.25)
                        b.cyl(P["rebar"], 0.016, (cx + ox, top - 0.05, cz + oz), tip, seg=5)
    b.box(P["slab"], 16.6, 0.3, 12.6, 0, 3.2, 0)
    b.box(P["slab"], 10.6, 0.3, 12.6, -3, 6.4, 0)
    # level 2's open east edge: bars left sticking out for the next pour
    z = -6.0
    while z <= 6.01:
        if not (-5.45 < z < -2.65):
            for y in (6.49, 6.61):
                b.cyl(P["rebar"], 0.012, (2.25, y, z), (2.8, y, z), seg=4, smooth=False)
        z += 0.3
    # ground-floor blockwork, half built
    b.box(P["block"], 5, 2.4, 0.3, -5.5, 0.2, -2.2)
    b.box(P["block"], 0.3, 2.4, 5, 3.5, 0.2, -3.5)
    b.box(P["block"], 0.3, 2.4, 4, -3.5, 0.2, 4)
    # parapets
    b.box(P["block"], 16.6, 1.0, 0.3, 0, L1, -6.15)
    b.box(P["block"], 0.3, 1.0, 12.6, -8.15, L1, 0)
    b.box(P["block"], 10.6, 0.6, 0.3, -3, L2, -6.15)
    b.box(P["block"], 0.3, 0.6, 12.6, -8.15, L2, 0)
    # edge protection (colliders: RAIL boxes in maps.js)
    edge_rail(b, P, 8.25, -6.3, 8.25, 6.3, L1)
    edge_rail(b, P, -8.3, 6.25, -1.5, 6.25, L1)
    edge_rail(b, P, 1.5, 6.25, 8.3, 6.25, L1)
    edge_rail(b, P, -8.3, 6.25, 2.3, 6.25, L2)
    edge_rail(b, P, 2.25, -6.3, 2.25, -5.3, L2)
    edge_rail(b, P, 2.25, -2.8, 2.25, 6.3, L2)
    # flight A: ground -> L1, cast concrete, bottom step at z 13.34 running -z
    zA = 6.3 + 11 * 0.64
    for i in range(11):
        b.box(P["conc"], 3, 0.318 * (i + 1), 0.64, 0, 0, zA - 0.64 * (i + 0.5))
    for sx in (-1, 1):
        px = sx * 1.56
        for i in (0, 3, 6, 9, 10):
            t = 0.318 * (i + 1)
            b.box(P["yellow"], 0.05, 1.25, 0.05, px, t - 0.25, zA - 0.64 * (i + 0.5))
        b.bar(P["yellow"], (px, 0.318 + 0.97, zA - 0.32), (px, 0.318 * 11 + 0.97, zA - 0.64 * 10.5), 0.05)
    # flight B: L1 -> L2, on the L1 deck, bottom step at x 7.8 running -x
    for i in range(10):
        b.box(P["conc"], 0.55, 0.32 * (i + 1), 2.5, 7.8 - 0.55 * (i + 0.5), L1, -4)
    for pz in (-5.31, -2.69):
        for i in (0, 3, 6, 9):
            t = L1 + 0.32 * (i + 1)
            b.box(P["yellow"], 0.05, 1.25, 0.05, 7.8 - 0.55 * (i + 0.5), t - 0.25, pz)
        b.bar(P["yellow"], (7.8 - 0.275, L1 + 0.32 + 0.97, pz), (7.8 - 0.55 * 9.5, L1 + 3.2 + 0.97, pz), 0.05)
    b.finish("gs-tower.glb")


def build_foundation(P):
    """West lane: the raised 14 x 24 x 1.2 slab, local origin at its centre
    (map x -23, z 0), with its three step runs."""
    b = Builder()
    b.box(P["slab"], 14, 1.2, 24, 0, 0, 0, bevel=0.03)
    for z in (-8, 8):
        for i in range(4):
            b.box(P["conc"], 0.6, 0.3 * (i + 1), 3, 9.4 - 0.6 * (i + 0.5), 0, z)
    for i in range(4):
        b.box(P["conc"], 3, 0.3 * (i + 1), 0.6, -4, 0, -14.4 + 0.6 * (i + 0.5))
    # starter bars along the back edge, behind the rebar cage
    z = 2.0
    while z <= 10.01:
        for ox in (0.0, 0.25):
            b.cyl(P["rebar"], 0.016, (-6.55 + ox, 1.15, z), (-6.55 + ox, 1.9, z), seg=5, smooth=False)
        z += 0.4
    b.finish("gs-foundation.glb")


# ---------------------------------------------------------------- scaffold

def build_scaffold(P):
    """Local: centred on the deck, stair landing on the +z edge."""
    b = Builder()
    # low deck (collider 5x5x0.35): skirt boards + planks
    for i in range(22):
        b.box(P["plank"], 0.215, 0.05, 5.0, -2.5 + 0.114 + i * 0.2272, 0.30, 0)
    for s in (-1, 1):
        b.box(P["plank"], 5.0, 0.3, 0.05, 0, 0, s * 2.475)
        b.box(P["plank"], 0.05, 0.3, 4.9, s * 2.475, 0, 0)
    # standards
    for px in (-2.3, 2.3):
        for pz in (-2.3, 2.3):
            b.cyl(P["tube"], 0.05, (px, 0.35, pz), (px, 4.62, pz), seg=10)
            b.box(P["steel"], 0.16, 0.015, 0.16, px, 0.35, pz)
    # upper deck (collider y 3.2..3.55): ledgers, transoms, planks
    for s in (-1, 1):
        b.cyl(P["tube"], 0.028, (-2.45, 3.25, s * 2.3), (2.45, 3.25, s * 2.3), seg=8)
        b.cyl(P["tube"], 0.028, (s * 2.3, 3.32, -2.45), (s * 2.3, 3.32, 2.45), seg=8)
    for i in range(5):
        x = -2.0 + i * 1.0
        b.cyl(P["tube"], 0.028, (x, 3.41, -2.45), (x, 3.41, 2.45), seg=8)
    for i in range(22):
        b.box(P["plank"], 0.215, 0.05, 5.0, -2.5 + 0.114 + i * 0.2272, 3.45, 0)
    # toe boards + guardrails: back and both sides full, front beside the stair
    top = 3.55
    runs = [(-2.5, -2.475, 2.5, -2.475), (-2.475, -2.5, -2.475, 2.5), (2.475, -2.5, 2.475, 2.5),
            (-2.5, 2.475, -1.75, 2.475), (1.75, 2.475, 2.5, 2.475)]
    for x0, z0, x1, z1 in runs:
        b.bar(P["toe"], (x0, top + 0.075, z0), (x1, top + 0.075, z1), 0.03, 0.15)
        for hy in (0.5, 1.0):
            b.cyl(P["tube"], 0.028, (x0, top + hy, z0), (x1, top + hy, z1), seg=8)
    for px in (-1.75, 1.75):
        b.cyl(P["tube"], 0.028, (px, top, 2.475), (px, top + 1.05, 2.475), seg=8)
    # sway bracing on the back face
    b.cyl(P["tube"], 0.028, (-2.3, 0.45, -2.35), (2.3, 3.15, -2.35), seg=8)
    b.cyl(P["tube"], 0.028, (2.3, 0.45, -2.38), (-2.3, 3.15, -2.38), seg=8)
    # stair tower: 11 x 0.323 rise, 0.62 run, 3.5 wide, bottom at z 9.32
    steel_stair(b, P, 11, 0.323, 0.62, 3.5, 2.5 + 11 * 0.62, -1)
    b.finish("gs-scaffold.glb")


# ------------------------------------------------------------------ cabin

def build_cabin(P):
    """Site office, 8 x 3.2, walls 0.15, door gap 1.4 centred on +z."""
    b = Builder()
    H = 2.6
    b.box(P["cabin"], 8, H, 0.15, 0, 0, -1.525)
    for s in (-1, 1):
        b.box(P["cabin"], 3.3, H, 0.15, s * 2.35, 0, 1.525)
        b.box(P["cabin"], 0.15, H, 3.2, s * 3.925, 0, 0)
    b.box(P["cabin"], 1.4, 0.45, 0.15, 0, 2.15, 1.525)
    b.box(P["trim"], 8.3, 0.2, 3.5, 0, H, 0)
    b.box(P["trim"], 8.34, 0.06, 3.54, 0, H + 0.2, 0)
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box(P["trim"], 0.16, H, 0.16, sx * 4.0, 0, sz * 1.6)
    b.box(P["trim"], 8.1, 0.14, 3.3, 0, 0, 0)
    windows_s = [-2.35, 2.35]
    windows_n = [-2.0, 2.0]
    # vertical profile ribs, skipping door + windows
    x = -3.75
    while x <= 3.76:
        if all(abs(x - w) > 0.8 for w in windows_n):
            b.box(P["cabin"], 0.06, 2.3, 0.04, x, 0.18, -1.62)
        if abs(x) > 0.85 and all(abs(x - w) > 0.8 for w in windows_s):
            b.box(P["cabin"], 0.06, 2.3, 0.04, x, 0.18, 1.62)
        x += 0.3
    z = -1.3
    while z <= 1.31:
        for s in (-1, 1):
            b.box(P["cabin"], 0.04, 2.3, 0.06, s * 4.02, 0.18, z)
        z += 0.3
    for wx, wz in [(w, 1.525) for w in windows_s] + [(w, -1.525) for w in windows_n]:
        b.box(P["glass"], 1.4, 0.9, 0.17, wx, 1.05, wz)
        for oy in (1.0, 1.95):
            b.box(P["trim"], 1.52, 0.06, 0.2, wx, oy, wz)
        for ox in (-0.73, 0.73):
            b.box(P["trim"], 0.06, 1.0, 0.2, wx + ox, 1.0, wz)
        out = 0.12 if wz > 0 else -0.12
        for i in range(6):
            b.box(P["steel"], 0.02, 0.92, 0.02, wx - 0.6 + i * 0.24, 1.04, wz + out)
    # door frame + open door leaf (hinged on the east jamb, swung out ~100 deg)
    for ox in (-0.72, 0.72):
        b.box(P["trim"], 0.06, 2.12, 0.2, ox, 0, 1.525)
    b.box(P["trim"], 1.5, 0.08, 0.2, 0, 2.1, 1.525)
    a = math.radians(100)
    dirv = Vector((-math.cos(a), 0, math.sin(a)))
    hinge = Vector((0.72, 0, 1.64))
    c = hinge + dirv * 0.5
    ry = math.atan2(-dirv.z, dirv.x)
    b.box(P["trim"], 1.0, 2.05, 0.05, c.x, 0.03, c.z, ry=ry)
    hc = hinge + dirv * 0.88 + Vector((0.05 * math.sin(a), 0, 0.05 * math.cos(a)))
    b.box(P["steel"], 0.04, 0.2, 0.04, hc.x, 1.0, hc.z)
    # sign over the door
    b.box(P["sign_blue"], 1.3, 0.3, 0.02, 0, 2.2, 1.61)
    b.box(P["white"], 1.0, 0.06, 0.01, 0, 2.32, 1.625)
    b.box(P["white"], 0.6, 0.04, 0.01, 0, 2.24, 1.625)
    # roof unit
    b.box(P["white"], 0.9, 0.45, 0.6, 2.4, H + 0.26, -0.4)
    b.box(P["dark"], 0.5, 0.02, 0.45, 2.4, H + 0.71, -0.4)
    # inside: floor, desk with plans + hard hat, chair, whiteboard, cabinet
    b.box(P["floor"], 7.7, 0.02, 2.9, 0, 0.14, 0)
    b.box(P["desk"], 2.2, 0.05, 0.8, -1.8, 0.72, -1.0)
    for ox in (-1.0, 1.0):
        b.box(P["dark"], 0.05, 0.72, 0.7, -1.8 + ox, 0, -1.0)
    b.box(P["paper"], 0.84, 0.004, 0.6, -1.9, 0.77, -1.0, ry=0.12)
    b.box(P["sign_blue"], 0.3, 0.004, 0.2, -1.6, 0.775, -0.95, ry=0.12)
    b.cyl(P["yellow"], 0.16, (-1.0, 0.77, -1.05), (-1.0, 0.92, -1.05), seg=12, r2=0.1)
    b.box(P["yellow"], 0.36, 0.015, 0.4, -1.0, 0.77, -1.05)
    b.box(P["dark"], 0.45, 0.08, 0.45, -1.9, 0.45, -0.3)
    b.box(P["dark"], 0.45, 0.5, 0.06, -1.9, 0.53, -0.08)
    b.cyl(P["steel"], 0.03, (-1.9, 0.12, -0.3), (-1.9, 0.45, -0.3), seg=6)
    b.box(P["white"], 0.02, 0.9, 1.5, -3.84, 1.2, -0.1)
    b.box(P["trim"], 0.03, 0.96, 1.56, -3.85, 1.17, -0.1)
    for i, (y, w) in enumerate([(1.8, 1.0), (1.6, 0.7), (1.4, 1.1)]):
        b.box(P["sign_blue"] if i != 1 else P["sign_red"], 0.005, 0.03, w, -3.825, y, -0.2)
    b.box(P["trim"], 0.5, 1.3, 0.6, 3.45, 0.14, -1.15)
    for y in (0.5, 0.9, 1.3):
        b.box(P["steel"], 0.2, 0.03, 0.01, 3.45, y, -0.845)
    b.finish("gs-cabin.glb")


# ----------------------------------------------------------------- toilet

def build_toilet(P):
    b = Builder()
    b.box(P["loo"], 1.16, 2.1, 1.16, 0, 0.06, 0, bevel=0.04)
    b.box(P["loo_dark"], 1.22, 0.08, 1.22, 0, 0, 0)
    b.frustum(P["white"], 1.24, 1.24, 0.9, 0.9, 2.16, 2.34)
    b.box(P["loo_dark"], 0.82, 1.9, 0.02, 0, 0.14, 0.585)
    b.box(P["white"], 0.14, 0.05, 0.03, 0.28, 1.1, 0.6)
    b.box(P["green"], 0.12, 0.05, 0.02, 0.28, 1.2, 0.6)
    for s in (-1, 1):
        for i in range(4):
            b.box(P["loo_dark"], 0.02, 0.03, 0.5, s * 0.585, 1.75 + i * 0.07, 0)
        b.box(P["loo_dark"], 0.04, 1.9, 0.06, s * 0.6, 0.12, 0.45)
        b.box(P["loo_dark"], 0.04, 1.9, 0.06, s * 0.6, 0.12, -0.45)
    b.cyl(P["dark"], 0.045, (0.35, 2.2, -0.35), (0.35, 2.55, -0.35), seg=8)
    b.finish("gs-toilet.glb")


# ------------------------------------------------------------------ crane

def build_crane(P):
    """Tower crane. Local origin at the mast base, jib along +x."""
    b = Builder()
    Y = P["crane"]
    b.box(P["conc"], 3, 1.5, 3, 0, 0, 0, bevel=0.03)
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box(P["conc"], 1.1, 0.5, 1.1, sx * 0.85, 1.5, sz * 0.85)
    b.box(P["steel"], 1.9, 0.12, 1.9, 0, 1.5, 0)
    half, y0, y1, n = 0.8, 1.62, 26.0, 15
    h = (y1 - y0) / n
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box(Y, 0.15, y1 - y0, 0.15, sx * half, y0, sz * half)
    corners = [(-half, -half), (half, -half), (half, half), (-half, half)]
    for k in range(n + 1):
        y = y0 + k * h
        for i in range(4):
            a, c = corners[i], corners[(i + 1) % 4]
            b.bar(Y, (a[0], y, a[1]), (c[0], y, c[1]), 0.07)
    for k in range(n):
        y = y0 + k * h
        for i in range(4):
            a, c = corners[i], corners[(i + 1) % 4]
            if k % 2:
                a, c = c, a
            b.bar(Y, (a[0], y, a[1]), (c[0], y + h, c[1]), 0.06)
    # ladder inside the mast
    b.bar(P["steel"], (0.3, y0, 0.55), (0.3, y1, 0.55), 0.04)
    b.bar(P["steel"], (-0.3, y0, 0.55), (-0.3, y1, 0.55), 0.04)
    # slewing ring + cab
    b.box(P["steel"], 2.1, 0.5, 2.1, 0, 26.0, 0)
    b.box(Y, 1.9, 0.5, 1.9, 0, 26.5, 0)
    b.box(Y, 1.3, 1.9, 1.4, 1.2, 26.05, 1.55, bevel=0.03)
    b.box(P["glass"], 1.34, 1.0, 1.2, 1.2, 26.8, 1.55)
    b.box(P["glass"], 1.1, 1.0, 1.44, 1.2, 26.8, 1.55)
    # tower head
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.bar(Y, (sx * 0.8, 27.0, sz * 0.8), (sx * 0.12, 32.2, sz * 0.12), 0.12)
    for y in (28.5, 30.2):
        t = (y - 27.0) / 5.2
        r = 0.8 + (0.12 - 0.8) * t
        pts = [(-r, -r), (r, -r), (r, r), (-r, r)]
        for i in range(4):
            a, c = pts[i], pts[(i + 1) % 4]
            b.bar(Y, (a[0], y, a[1]), (c[0], y, c[1]), 0.06)
    b.box(Y, 0.4, 0.3, 0.4, 0, 32.1, 0)
    # jib: triangular lattice, 29 m
    jx0, jx1, yb, yt, jw = 1.0, 30.0, 27.0, 28.25, 0.45
    for sz in (-1, 1):
        b.bar(Y, (jx0, yb, sz * jw), (jx1, yb, sz * jw), 0.1)
    b.bar(Y, (jx0, yt, 0), (jx1 - 0.8, yt, 0), 0.1)
    nj = 20
    dx = (jx1 - jx0) / nj
    for k in range(nj + 1):
        x = jx0 + k * dx
        b.bar(Y, (x, yb, -jw), (x, yb, jw), 0.05)
    for k in range(nj):
        x = jx0 + k * dx
        xm = min(x + dx / 2, jx1 - 0.8)
        for sz in (-1, 1):
            b.bar(Y, (x, yb, sz * jw), (xm, yt, 0), 0.05)
            b.bar(Y, (xm, yt, 0), (x + dx, yb, sz * jw), 0.05)
    for sz in (-1, 1):
        b.bar(Y, (jx1, yb, sz * jw), (jx1 - 0.8, yt, 0), 0.08)
    # counter-jib with walkway, winch and ballast
    cx0, cx1, cw = -1.0, -11.0, 0.8
    for sz in (-1, 1):
        b.bar(Y, (cx0, yb, sz * cw), (cx1, yb, sz * cw), 0.14, 0.3)
        b.bar(P["yellow"], (cx0, yb + 1.0, sz * (cw + 0.05)), (cx1, yb + 1.0, sz * (cw + 0.05)), 0.04)
        for i in range(6):
            x = cx0 + (cx1 - cx0) * i / 5
            b.box(P["yellow"], 0.04, 1.0, 0.04, x, yb + 0.15, sz * (cw + 0.05))
    for i in range(9):
        x = cx0 + (cx1 - cx0) * i / 8
        b.bar(Y, (x, yb, -cw), (x, yb, cw), 0.08)
    b.box(P["grate"], 9.8, 0.04, 1.5, -6.0, yb + 0.15, 0)
    b.box(P["steel"], 1.3, 0.8, 1.1, -4.5, yb + 0.19, 0)
    b.cyl(P["dark"], 0.35, (-4.5, yb + 0.55, -0.6), (-4.5, yb + 0.55, 0.6), seg=14)
    for i, x in enumerate((-8.3, -8.9, -9.5, -10.1)):
        b.box(P["conc"], 0.55, 2.3, 2.0, x, yb - 1.9, 0, bevel=0.02)
    b.box(P["steel"], 2.4, 0.2, 2.1, -9.2, yb - 0.05, 0)
    # the crane's name board on the counter-jib
    b.box(P["white"], 0.03, 0.9, 1.8, -11.05, yb - 0.1, 0)
    b.box(P["sign_red"], 0.035, 0.18, 1.8, -11.05, yb + 0.55, 0)
    # pendant ties
    for sz in (-1, 1):
        b.cyl(P["steel"], 0.035, (0, 32.2, 0), (20.0, yt, sz * 0.02), seg=6, smooth=False)
        b.cyl(P["steel"], 0.035, (0, 32.2, 0), (-10.8, yb + 0.1, sz * cw), seg=6, smooth=False)
    # trolley, hoist ropes, hook block and a hanging bundle of steel beams
    tx = 17.0
    b.box(P["steel"], 1.1, 0.35, 1.1, tx, yb - 0.35, 0)
    hook_y = 14.2
    for ox in (-0.15, 0.15):
        b.cyl(P["black"], 0.016, (tx + ox, yb - 0.35, 0), (tx + ox, hook_y + 0.7, 0), seg=5, smooth=False)
    b.box(P["yellow"], 0.55, 0.75, 0.4, tx, hook_y, 0, bevel=0.03)
    b.cyl(P["dark"], 0.25, (tx, hook_y + 0.5, -0.22), (tx, hook_y + 0.5, 0.22), seg=12)
    b.box(P["black"], 0.08, 0.35, 0.08, tx, hook_y - 0.35, 0)
    load_y = 11.4
    for ox in (-1.7, 1.7):
        for oz in (-0.45, 0.45):
            b.cyl(P["black"], 0.012, (tx, hook_y - 0.3, 0), (tx + ox, load_y + 0.58, oz), seg=4, smooth=False)
    for oz in (-0.42, 0, 0.42):
        b.box(P["rebar"], 4.0, 0.05, 0.3, tx, load_y, oz)
        b.box(P["rebar"], 4.0, 0.46, 0.035, tx, load_y + 0.05, oz)
        b.box(P["rebar"], 4.0, 0.05, 0.3, tx, load_y + 0.51, oz)
    b.finish("gs-crane.glb")


# --------------------------------------------------------------- forklift

def build_forklift(P):
    """Collider 1.4 (x) x 2.6 (z) x 2.2. Forks toward -z."""
    b = Builder()
    Y = P["yellow"]
    b.box(Y, 1.2, 0.7, 1.35, 0, 0.28, 0.175, bevel=0.04)
    b.box(P["dark"], 1.3, 0.95, 0.45, 0, 0.22, 1.07, bevel=0.06)
    b.box(Y, 1.0, 0.22, 0.75, 0, 0.98, 0.45)
    b.box(P["black"], 0.55, 0.12, 0.5, 0, 1.2, 0.4)
    b.box(P["black"], 0.55, 0.5, 0.1, 0, 1.3, 0.68, rx=-0.15)
    b.box(P["dark"], 0.9, 0.32, 0.25, 0, 0.98, -0.38)
    b.cyl(P["dark"], 0.025, (0, 1.2, -0.35), (0, 1.5, -0.18), seg=6)
    b.cyl(P["black"], 0.17, (0, 1.5, -0.2), (0, 1.53, -0.17), seg=14)
    for sx in (-1, 1):
        b.bar(P["dark"], (sx * 0.55, 0.98, -0.45), (sx * 0.55, 2.15, -0.35), 0.07)
        b.bar(P["dark"], (sx * 0.55, 1.2, 0.8), (sx * 0.55, 2.15, 0.72), 0.07)
        b.bar(P["dark"], (sx * 0.55, 2.15, -0.38), (sx * 0.55, 2.15, 0.75), 0.07)
    for i in range(5):
        z = -0.35 + i * 0.27
        b.bar(P["dark"], (-0.55, 2.15, z), (0.55, 2.15, z), 0.04)
    for sx in (-1, 1):
        for z, r in ((-0.3, 0.32), (0.9, 0.27)):
            b.cyl(P["tyre"], r, (sx * 0.5, r, z), (sx * 0.74, r, z), seg=14)
            b.cyl(P["steel"], r * 0.55, (sx * 0.52, r, z), (sx * 0.75, r, z), seg=10)
    for sx in (-1, 1):
        b.box(P["dark"], 0.1, 2.15, 0.12, sx * 0.35, 0.05, -0.6)
    for y in (0.3, 1.2, 2.1):
        b.box(P["dark"], 0.8, 0.08, 0.1, 0, y, -0.62)
    b.box(P["dark"], 0.95, 0.5, 0.06, 0, 0.12, -0.7)
    for sx in (-1, 1):
        b.box(P["steel"], 0.12, 0.5, 0.05, sx * 0.3, 0.1, -0.74)
        b.box(P["steel"], 0.12, 0.05, 0.58, sx * 0.3, 0.06, -1.01)
    b.cyl(P["taillight"], 0.06, (0.4, 1.15, 1.3), (0.4, 1.15, 1.32), seg=8)
    b.cyl(P["headlight"], 0.07, (-0.5, 2.05, -0.44), (-0.5, 2.05, -0.5), seg=8)
    b.cyl(P["headlight"], 0.07, (0.5, 2.05, -0.44), (0.5, 2.05, -0.5), seg=8)
    b.finish("gs-forklift.glb")


# ----------------------------------------------------------------- mixer

def build_mixer(P):
    """Collider 1.6 x 1.6 x 1.8."""
    b = Builder()
    for sx in (-0.45, 0.45):
        b.bar(P["dark"], (sx, 0.02, -0.6), (sx, 1.0, 0.0), 0.06)
        b.bar(P["dark"], (sx, 0.02, 0.6), (sx, 1.0, 0.0), 0.06)
        b.bar(P["dark"], (sx, 0.08, -0.6), (sx, 0.08, 0.6), 0.05)
    b.cyl(P["dark"], 0.04, (-0.55, 1.0, 0), (0.55, 1.0, 0), seg=8)
    b.cyl(P["dark"], 0.03, (-0.72, 0.25, 0.55), (0.72, 0.25, 0.55), seg=8)
    for sx in (-1, 1):
        b.cyl(P["tyre"], 0.25, (sx * 0.6, 0.25, 0.55), (sx * 0.74, 0.25, 0.55), seg=14)
        b.cyl(P["steel"], 0.12, (sx * 0.59, 0.25, 0.55), (sx * 0.75, 0.25, 0.55), seg=10)
    b.bar(P["dark"], (0, 0.9, -0.1), (0, 0.55, -0.78), 0.05)
    b.cyl(P["black"], 0.05, (-0.12, 0.55, -0.78), (0.12, 0.55, -0.78), seg=8)
    t = math.radians(38)
    d = Vector((0, math.sin(t), -math.cos(t)))
    c = Vector((0, 1.13, 0.1))
    O = P["orange"]
    b.cyl(O, 0.46, c - d * 0.22, c + d * 0.14, seg=20)
    b.cyl(O, 0.46, c + d * 0.14, c + d * 0.52, seg=20, r2=0.27)
    b.cyl(O, 0.46, c - d * 0.22, c - d * 0.44, seg=20, r2=0.16)
    b.cyl(P["black"], 0.25, c + d * 0.515, c + d * 0.525, seg=16)
    b.cyl(P["dark"], 0.49, c - d * 0.06, c + d * 0.02, seg=24)
    for i in range(6):
        a = i * math.pi / 3
        off = Vector((math.cos(a), 0, math.sin(a)))
        off = (off - d * off.dot(d)).normalized() * 0.44
        b.cyl(O, 0.035, c + off - d * 0.1, c + off * 0.62 + d * 0.5, seg=5, smooth=False)
    b.box(P["dark"], 0.36, 0.34, 0.42, 0.55, 0.5, 0.25)
    b.box(P["black"], 0.3, 0.02, 0.3, 0.55, 0.84, 0.25)
    b.finish("gs-mixer.glb")


# --------------------------------------------------------- small cover

def build_brick_pallet(P):
    b = Builder()
    y = pallet(b, P, 1.2, 1.2)
    b.box(P["brick"], 1.1, 0.85, 1.1, 0, y, 0)
    for o in (-0.3, 0.3):
        b.box(P["strap"], 1.12, 0.865, 0.03, 0, y, o)
        b.box(P["strap"], 0.03, 0.87, 1.12, o, y, 0)
    b.finish("gs-brick-pallet.glb")


def build_rebar_cage(P):
    b = Builder()
    R = P["rebar"]
    h = 0.55
    pts = [(-h, -h), (0, -h), (h, -h), (h, 0), (h, h), (0, h), (-h, h), (-h, 0)]
    for x, z in pts:
        b.cyl(R, 0.014, (x, 0.05, z), (x, 2.18, z), seg=5, smooth=False)
    for i in range(11):
        y = 0.12 + i * 0.2
        for a, c in (((-h, -h), (h, -h)), ((h, -h), (h, h)), ((h, h), (-h, h)), ((-h, h), (-h, -h))):
            b.bar(R, (a[0], y, a[1]), (c[0], y, c[1]), 0.012)
    for x in (-0.4, 0.4):
        b.box(P["plank"], 0.1, 0.05, 1.3, x, 0, 0)
    b.finish("gs-rebar-cage.glb")


def build_formwork(P):
    """6 m run along x, 0.3 thick, 1.4 tall, freshly poured."""
    b = Builder()
    for s in (-1, 1):
        b.box(P["ply"], 6.0, 1.4, 0.02, 0, 0, s * 0.12)
        for y in (0.25, 0.75, 1.2):
            b.box(P["steel"], 6.1, 0.1, 0.05, 0, y, s * 0.155)
        for i in range(5):
            x = -2.4 + i * 1.2
            b.box(P["timber"], 0.08, 1.46, 0.05, x, 0, s * 0.2)
            for y in (0.3, 0.8, 1.25):
                b.cyl(P["dark"], 0.045, (x + 0.12, y, s * 0.2), (x + 0.12, y, s * 0.24), seg=6)
    for s in (-1, 1):
        b.box(P["ply"], 0.02, 1.4, 0.26, s * 2.99, 0, 0)
    b.box(P["wet"], 5.96, 0.02, 0.22, 0, 1.24, 0)
    b.finish("gs-formwork.glb")


def build_jersey(P):
    b = Builder()
    prof = [(-0.3, 0), (0.3, 0), (0.3, 0.08), (0.2, 0.33), (0.08, 0.9), (-0.08, 0.9), (-0.2, 0.33), (-0.3, 0.08)]
    b.prism(P["conc"], prof, -1.5, 1.5, axis="x")
    for x in (-0.9, 0.9):
        b.box(P["black"], 0.3, 0.1, 0.62, x, 0.0, 0)
    b.finish("gs-jersey.glb")


def build_skip(P):
    """4 x 2 x 1.6 builder's skip, loaded."""
    b = Builder()
    S = P["skip"]
    b.prism(S, [(-1.4, 0.12), (1.4, 0.12), (2.0, 1.55), (-2.0, 1.55)], -0.95, 0.95, axis="z")
    for s in (-1, 1):
        b.box(P["dark"], 2.6, 0.12, 0.14, 0, 0, s * 0.7)
        for x in (-1.2, -0.4, 0.4, 1.2):
            b.box(S, 0.1, 1.4, 0.06, x, 0.14, s * 0.975)
        b.bar(S, (-2.0, 1.58, s * 0.97), (2.0, 1.58, s * 0.97), 0.08)
        b.cyl(P["dark"], 0.07, (s * 1.72, 1.15, -1.05), (s * 1.72, 1.15, 1.05), seg=10)
    for s in (-1, 1):
        b.bar(S, (s * 2.0, 1.58, -0.95), (s * 2.0, 1.58, 0.95), 0.08)
    b.box(P["rubble"], 3.85, 0.04, 1.84, 0, 1.52, 0)
    import random
    rnd = random.Random(7)
    for i in range(14):
        w = rnd.uniform(0.3, 0.7)
        b.box(P["rubble"] if i % 3 else P["block"], w, rnd.uniform(0.15, 0.3), rnd.uniform(0.25, 0.5),
              rnd.uniform(-1.6, 1.6), 1.5, rnd.uniform(-0.7, 0.7),
              ry=rnd.uniform(0, 3), rx=rnd.uniform(-0.3, 0.3), rz=rnd.uniform(-0.3, 0.3))
    for i in range(4):
        b.box(P["timber"], 1.8, 0.05, 0.15, rnd.uniform(-1, 1), 1.6, rnd.uniform(-0.6, 0.6),
              ry=rnd.uniform(0, 3), rz=rnd.uniform(-0.35, 0.35))
    b.finish("gs-skip.glb")


def build_van(P):
    """5 (x) x 2.2 x 2.4 panel van, nose on +x."""
    b = Builder()
    prof = [(-2.45, 0.34), (2.4, 0.34), (2.48, 0.9), (2.35, 1.15), (1.55, 2.02), (1.1, 2.35), (-2.45, 2.35)]
    b.prism(P["van"], prof, -1.0, 1.0, axis="z")
    b.box(P["dark"], 0.14, 0.3, 2.06, 2.45, 0.3, 0)
    b.box(P["dark"], 0.12, 0.25, 2.06, -2.5, 0.3, 0)
    a0, a1 = Vector((2.35, 1.15, 0)), Vector((1.55, 2.02, 0))
    mid = (a0 + a1) / 2
    L = (a1 - a0).length
    nrm = Vector((0.87, 0.8, 0)).normalized()
    ang = math.atan2(a1.y - a0.y, a1.x - a0.x)
    cc = mid + nrm * 0.012
    b.box(P["glass"], L * 0.92, 0.02, 1.84, cc.x, cc.y - 0.01, 0, rz=ang)
    b.box(P["glass"], 0.6, 0.52, 2.02, 1.5, 1.38, 0)
    b.box(P["stripe"], 4.0, 0.12, 2.02, -0.45, 1.05, 0)
    for x in (0.9, -0.3):
        b.box(P["dark"], 0.02, 1.6, 2.01, x, 0.5, 0)
    b.box(P["headlight"], 0.05, 0.14, 0.36, 2.43, 0.95, 0.68)
    b.box(P["headlight"], 0.05, 0.14, 0.36, 2.43, 0.95, -0.68)
    b.box(P["taillight"], 0.04, 0.35, 0.14, -2.47, 0.8, 0.9)
    b.box(P["taillight"], 0.04, 0.35, 0.14, -2.47, 0.8, -0.9)
    b.box(P["dark"], 0.3, 0.18, 1.3, 2.46, 0.52, 0)
    for s in (-1, 1):
        b.box(P["dark"], 0.08, 0.22, 0.12, 2.2, 1.18, s * 1.1)
        for x in (1.65, -1.65):
            b.cyl(P["tyre"], 0.36, (x, 0.36, s * 0.84), (x, 0.36, s * 1.02), seg=16)
            b.cyl(P["steel"], 0.2, (x, 0.36, s * 1.0), (x, 0.36, s * 1.025), seg=10)
    for s in (-1, 1):
        b.bar(P["tube"], (-2.2, 2.45, s * 0.8), (0.9, 2.45, s * 0.8), 0.05)
        for x in (-2.0, -0.5, 0.7):
            b.box(P["tube"], 0.05, 0.1, 0.05, x, 2.35, s * 0.8)
    for s in (-1, 1):
        b.bar(P["steel"], (-2.1, 2.52, s * 0.22), (0.4, 2.52, s * 0.22), 0.04)
    for i in range(9):
        x = -2.0 + i * 0.3
        b.bar(P["steel"], (x, 2.52, -0.22), (x, 2.52, 0.22), 0.025)
    b.finish("gs-van.glb")


def build_block_stack(P):
    """3 x 3 x 1.4: four pallets of concrete blocks."""
    b = Builder()
    for x, z, h in ((-0.75, -0.75, 1.2), (0.75, -0.75, 1.2), (-0.75, 0.75, 1.2), (0.75, 0.75, 0.82)):
        y = pallet(b, P, 1.4, 1.4, x, z)
        b.box(P["block"], 1.3, h, 1.3, x, y, z)
        b.box(P["strap"], 1.32, h + 0.01, 0.03, x, y, z)
    b.finish("gs-block-stack.glb")


def build_timber_stack(P):
    """4 (x) x 2.5 (z) x 1.5 stickered timber."""
    b = Builder()
    for x in (-1.5, 0, 1.5):
        b.box(P["plank"], 0.12, 0.1, 2.5, x, 0, 0)
    y = 0.1
    for layer in range(3):
        for z in (-0.83, 0, 0.83):
            b.box(P["timber"], 4.0 - layer * 0.1, 0.42, 0.78, (layer - 1) * 0.04, y, z)
            for sx in (-1.3, 1.3):
                b.box(P["black"], 0.04, 0.43, 0.8, sx, y, z)
        y += 0.42
        if layer < 2:
            for x in (-1.5, 0, 1.5):
                b.box(P["plank"], 0.06, 0.05, 2.5, x, y, 0)
            y += 0.05
    b.finish("gs-timber-stack.glb")


def build_pipe_stack(P):
    """3 x 3 x 1.6: two concrete culvert sections lying along z, chocked."""
    b = Builder()
    for x in (-0.76, 0.76):
        b.tube_z(P["conc"], x, 0.74, -1.5, 1.5, 0.72, 0.58)
        for z in (-1.1, 1.1):
            for s in (-1, 1):
                b.prism(P["plank"], [(x + s * 0.45, 0), (x + s * 0.75, 0), (x + s * 0.45, 0.2)], z - 0.1, z + 0.1)
    b.finish("gs-pipe-stack.glb")


def build_container(P, key, filename, open_ends=False):
    """6 (x) x 2.5 x 2.6 shipping container. open_ends: the walk-through one,
    doors folded back flat against the sides. Otherwise doors shut on +x."""
    b = Builder()
    T = P[key]
    for s in (-1, 1):
        b.box(T, 6.0, 2.5, 0.12, 0, 0, s * 1.19)
        x = -2.8
        while x <= 2.81:
            b.box(T, 0.12, 2.25, 0.05, x, 0.13, s * 1.27)
            x += 0.28
        b.box(P["dark"], 6.0, 0.14, 0.16, 0, 0, s * 1.2)
        b.box(P["dark"], 6.0, 0.14, 0.16, 0, 2.46, s * 1.2)
    b.box(T, 6.0, 0.12, 2.5, 0, 2.48, 0)
    x = -2.7
    while x <= 2.71:
        b.box(T, 0.1, 0.03, 2.4, x, 2.6, 0)
        x += 0.45
    b.box(P["plank"], 5.9, 0.03, 2.26, 0, 0, 0)
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box(P["dark"], 0.16, 2.62, 0.16, sx * 2.95, 0, sz * 1.2)
        b.box(P["dark"], 0.16, 0.26, 2.5, sx * 2.95, 2.36, 0)
        b.box(P["dark"], 0.16, 0.1, 2.5, sx * 2.95, 0, 0)
        if open_ends:
            for sz in (-1, 1):
                b.box(T, 1.2, 2.34, 0.06, sx * 2.3, 0.12, sz * 1.34)
                for ox in (-0.3, 0.3):
                    b.cyl(P["steel"], 0.02, (sx * 2.3 + ox, 0.2, sz * 1.38), (sx * 2.3 + ox, 2.4, sz * 1.38), seg=6)
        elif sx > 0:
            # shut doors: two leaves, four locking bars with handles
            for sz in (-1, 1):
                b.box(T, 0.06, 2.24, 1.13, 2.93, 0.12, sz * 0.58)
            for zc in (-0.85, -0.3, 0.3, 0.85):
                b.cyl(P["steel"], 0.022, (3.0, 0.18, zc), (3.0, 2.3, zc), seg=6)
                b.box(P["steel"], 0.05, 0.05, 0.22, 3.02, 1.1, zc - 0.1)
            b.box(P["white"], 0.01, 0.12, 0.7, 2.965, 1.9, -0.58)
        else:
            x0 = sx * 2.93
            z = -1.0
            while z <= 1.01:
                b.box(T, 0.06, 2.24, 0.12, x0, 0.12, z)
                z += 0.25
    if not open_ends:
        for sz in (-1, 1):
            b.box(P["white"], 1.6, 0.35, 0.01, 1.2, 1.95, sz * 1.3)
    b.finish(filename)


def build_perimeter(P):
    """The site's outer wall as precast panels: 68 x 68 outside, 1.4 thick,
    6 tall (the collider is api.ghostWalls(0, 0, 68, 68, 6, 1.4))."""
    b = Builder()
    C = P["precast"]
    for s in (-1, 1):
        b.box(C, 68, 6, 1.4, 0, 0, s * 33.3)
        b.box(C, 1.4, 6, 65.2, s * 33.3, 0, 0)
    # panel joints every 4 m on the inside faces, and a coping on top
    for i in range(-8, 9):
        p = i * 4.0
        for s in (-1, 1):
            b.box(P["dark"], 0.04, 6.0, 0.02, p, 0, s * 32.6)
            b.box(P["dark"], 0.02, 6.0, 0.04, s * 32.6, 0, p)
    for s in (-1, 1):
        b.box(C, 68.2, 0.12, 1.6, 0, 6.0, s * 33.3)
        b.box(C, 1.6, 0.12, 65.0, s * 33.3, 6.0, 0)
    b.finish("gs-perimeter.glb")


def build_container_stair(P):
    """8 steps x 0.325 rise x 0.6 run x 2 wide, bottom at local z 0, runs -z."""
    b = Builder()
    steel_stair(b, P, 8, 0.325, 0.6, 2.0, 0.0, -1)
    b.finish("gs-container-stair.glb")


def build_hoarding(P):
    """One inside face of the perimeter: 65.2 m along x, front facing +z."""
    b = Builder()
    L = 65.2
    n = 27
    w = L / n
    for i in range(n):
        x = -L / 2 + w * (i + 0.5)
        b.box(P["hoard"], w - 0.012, 2.44, 0.03, x, 0, 0.015)
    b.box(P["timber"], L, 0.06, 0.09, 0, 2.44, 0.03)
    b.box(P["yellow"], L, 0.12, 0.005, 0, 2.08, 0.032)
    for i, x in enumerate((-24.0, -8.0, 8.0, 24.0)):
        # hard-hat sign (blue disc), hazard triangle, and a white notice board
        b.cyl(P["white"], 0.34, (x - 1.3, 1.5, 0.031), (x - 1.3, 1.5, 0.036), seg=24)
        b.cyl(P["sign_blue"], 0.3, (x - 1.3, 1.5, 0.032), (x - 1.3, 1.5, 0.04), seg=24)
        b.frustum(P["white"], 0.34, 0.006, 0.1, 0.006, 1.38, 1.6, x - 1.3, 0.042)
        b.prism(P["black"], [(x - 0.4, 1.12), (x + 0.4, 1.12), (x, 1.82)], 0.031, 0.036)
        b.prism(P["yellow"], [(x - 0.32, 1.17), (x + 0.32, 1.17), (x, 1.72)], 0.032, 0.04)
        b.box(P["black"], 0.05, 0.22, 0.01, x, 1.33, 0.036)
        b.box(P["black"], 0.05, 0.05, 0.01, x, 1.24, 0.036)
        b.box(P["white"], 1.5, 0.95, 0.01, x + 1.6, 1.05, 0.036)
        b.box(P["sign_red"], 1.5, 0.22, 0.012, x + 1.6, 1.78, 0.036)
        for k in range(4):
            b.box(P["black"], 1.1 - k * 0.18, 0.05, 0.012, x + 1.6, 1.55 - k * 0.14, 0.037)
    b.finish("gs-hoarding.glb")


def build_light_tower(P):
    """Mast light, 9 m. Lamps face -z."""
    b = Builder()
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.bar(P["yellow"], (0, 0.55, 0), (sx * 0.95, 0.06, sz * 0.95), 0.07)
            b.box(P["dark"], 0.25, 0.04, 0.25, sx * 0.95, 0, sz * 0.95)
    b.box(P["yellow"], 0.4, 0.3, 0.4, 0, 0.4, 0)
    b.cyl(P["steel"], 0.12, (0, 0.6, 0), (0, 4.0, 0), seg=10)
    b.cyl(P["steel"], 0.095, (0, 4.0, 0), (0, 7.0, 0), seg=10)
    b.cyl(P["steel"], 0.075, (0, 7.0, 0), (0, 9.0, 0), seg=10)
    b.box(P["dark"], 2.1, 0.1, 0.1, 0, 8.95, 0)
    for x in (-0.78, -0.26, 0.26, 0.78):
        b.box(P["dark"], 0.46, 0.4, 0.22, x, 9.05, 0.02, rx=0.35)
        b.box(P["lamp"], 0.4, 0.34, 0.02, x, 9.08, -0.1, rx=0.35)
    b.cyl(P["black"], 0.02, (0.1, 0.6, 0.1), (0.1, 8.9, 0.1), seg=4, smooth=False)
    b.finish("gs-light-tower.glb")


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    for fn in (build_tower, build_foundation, build_scaffold, build_cabin, build_toilet, build_crane, build_forklift,
               build_mixer, build_brick_pallet, build_rebar_cage, build_formwork, build_jersey,
               build_skip, build_van, build_block_stack, build_timber_stack, build_pipe_stack,
               build_container_stair, build_perimeter, build_hoarding, build_light_tower):
        fn(P)
    build_container(P, "teal", "gs-container-open.glb", open_ends=True)
    for key in ("c_red", "c_blue", "c_green", "c_grey"):
        build_container(P, key, "gs-container-" + key[2:] + ".glb")
    print("ALL GRIN SITE PROPS EXPORTED")


main()
