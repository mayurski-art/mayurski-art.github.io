"""
Troll Forces — Hollowgrin's village buildings (map detail pass phase 6a).

Since phase 0 of the Blender build-out (doc "Troll Forces: Hollowgrin in
Blender") this is a module: build_hollowgrin.blender.py imports it and runs
its builds through hg_kit's builder (bake UVs, the size report). The barn
and the candy shop moved to hg_village.py in phase 3; it retires once the
mausoleum moves too.

Old standalone run (no names = all; no bake UVs):
  blender --background --python hg_legacy_village.py -- mausoleum

Writes hg-mausoleum.glb in MAP coordinates
(placed at the origin), drawn over the colliders hollowgrin.js already
builds: change an opening there, change it here. The JS keeps everything
that glows, flickers or carries a canvas (candles, the stained glass, the
TROLL plaque, the shop sign, the jars, the awnings, the lamps' lights).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
import math  # noqa: E402
import random  # noqa: E402

TEXTURED.update({"HG_Granite", "HG_GraniteDark", "HG_BarnRed", "HG_BarnWood", "HG_Clapboard",
                 "HG_Brick", "HG_Floorboards"})


def hg_palette():
    return {
        "granite": mat("HG_Granite", 0x8c8c94, 0.9),
        "granite_dk": mat("HG_GraniteDark", 0x5a5a62, 0.9),
        "joint": mat("HG_Joint", 0x2a2a30, 0.95),
        "bronze": mat("HG_Bronze", 0x3d6a58, 0.45, 0.3),
        "bronze_dk": mat("HG_BronzeDark", 0x26402f, 0.5, 0.3),
        "recess": mat("HG_Recess", 0x26262c, 0.95),
        "barn": mat("HG_BarnRed", 0xc8382c, 0.85),
        "barnwood": mat("HG_BarnWood", 0x8a6a48, 0.85),
        "trim": mat("HG_TrimWhite", 0xd9d2c2, 0.75),
        "roofmetal": mat("HG_RoofMetal", 0x4a524e, 0.5, 0.25),
        "roofrib": mat("HG_RoofRib", 0x5c6662, 0.45, 0.25),
        "iron": mat("HG_Iron", 0x1c1c22, 0.55, 0.3),
        "clap": mat("HG_Clapboard", 0x5b3a6e, 0.8),
        "shoptrim": mat("HG_ShopTrim", 0xe0762a, 0.65),
        "shopdark": mat("HG_ShopDark", 0x2a1832, 0.7),
        "brick": mat("HG_Brick", 0x8a4a3a, 0.9),
        "floor": mat("HG_Floorboards", 0x6a4a30, 0.8),
        "wainscot": mat("HG_Wainscot", 0x4a2e22, 0.6),
        "tin": mat("HG_Tin", 0xc8c0a8, 0.5, 0.2),
        "paper": mat("HG_Wallpaper", 0x2e5a50, 0.85),
        "tar": mat("HG_Tar", 0x1e1e22, 0.95),
        "brass": mat("HG_Brass", 0xc8a050, 0.35, 0.4),
        "glass": mat("HG_GlassDark", 0x1a2028, 0.1),
        "warm": mat("HG_WarmGlass", 0xffd08a, 0.3, 0.0, 0xffb860, 1.6),
        "lamp": mat("HG_Lamp", 0xfff0c8, 0.2, 0.0, 0xffd890, 3.0),
        "hay": mat("HG_Hay", 0xb89a50, 1.0),
        "tool": mat("HG_ToolSteel", 0x6a6e74, 0.5, 0.3),
        "handle": mat("HG_Handle", 0x8a6a40, 0.8),
        "rope": mat("HG_Rope", 0x9a8458, 1.0),
    }


# The wall helpers (Wall, spans_free, heights_free, fluted_shaft,
# gable_prism) live in hg_kit.py since phase 1: the hg_*.py modules use them.
from hg_kit import Wall, fluted_shaft, gable_prism, heights_free, spans_free  # noqa: E402,F401


# ------------------------------------------------------------ mausoleum

def build_mausoleum(P):
    """Over: walls x -31..-25, z 8..14 (0.5 thick, 3.2 tall), door east
    (z 11, 1.8 wide, 2.5 tall); slab 6.8 x 6.8 x 0.35 at y 3.2; columns at
    (-24.55, 9.3 / 12.7); step (-24.4, 11) 1.2 x 4.2 x 0.18; sarcophagus
    (-28.4, 11) 1.1 x 2.3 x 0.95 + lid."""
    b = Builder()
    G, GD, J = P["granite"], P["granite_dk"], P["joint"]
    x0, x1, z0, z1, h, t = -31.0, -25.0, 8.0, 14.0, 3.2, 0.5
    door = {"c": 11.0, "w": 1.8, "spans": [(0, 2.5)]}
    walls = [Wall("x", z0 + t / 2, x0, x1, h, t, out=-1), Wall("x", z1 - t / 2, x0, x1, h, t, out=1),
             Wall("z", x0 + t / 2, z0 + t, z1 - t, h, t, out=-1),
             Wall("z", x1 - t / 2, z0 + t, z1 - t, h, t, holes=[door], out=1)]
    for w in walls:
        w.solid(b, G)
        w.courses(b, J, every=0.5, block=1.2, y0=0.4)
        w.courses(b, J, every=0.6, block=1.0, y0=0.0, side=-1)
    # plinth course round the outside, split at the door
    for (cx, cz, w_, d_) in ((-28, z0 - 0.05, 6.3, 0.2), (-28, z1 + 0.05, 6.3, 0.2), (x0 - 0.05, 11, 0.2, 6.3)):
        b.box(GD, w_, 0.4, d_, cx, 0, cz, bevel=0.02)
    for (za, zb) in ((z0 - 0.15, 10.1), (11.9, z1 + 0.15)):
        b.box(GD, 0.2, 0.4, zb - za, x1 + 0.05, 0, (za + zb) / 2, bevel=0.02)
    b.box(GD, 6.3, 0.05, 6.3, -28, 0.4, 11)          # (hidden under the walls' joint line)
    # corner antae
    for cx in (x0 + 0.25, x1 - 0.25):
        for cz in (z0 - 0.02, z1 + 0.02):
            b.box(G, 0.62, h - 0.4, 0.12, cx, 0.4, cz)
    for cz in (z0 + 0.25, z1 - 0.25):
        for cx in (x0 - 0.02, x1 + 0.02):
            b.box(G, 0.12, h - 0.4, 0.62, cx, 0.4, cz)
    # door surround: a stepped frame, a lintel with a keystone
    for side in (-1, 1):
        zz = 11 + side * 1.05
        b.box(GD, 0.14, 2.6, 0.3, x1 + 0.07, 0, zz)
    b.box(GD, 0.16, 0.36, 2.6, x1 + 0.08, 2.5, 11)
    b.box(G, 0.2, 0.42, 0.34, x1 + 0.1, 2.47, 11)
    # the bronze doors, open outward flat against the front wall
    for side in (-1, 1):
        z_in, z_out = 11 + side * 0.9, 11 + side * 1.8
        zc = (z_in + z_out) / 2
        b.box(P["bronze"], 0.05, 2.45, 0.86, x1 + 0.2, 0.02, zc)
        for (lo, hi) in ((0.15, 1.1), (1.3, 2.3)):
            b.box(P["bronze_dk"], 0.02, hi - lo, 0.62, x1 + 0.235, lo, zc)
            b.box(P["bronze"], 0.02, hi - lo - 0.16, 0.46, x1 + 0.25, lo + 0.08, zc)
        b.cyl(P["brass"], 0.04, (x1 + 0.26, 1.2, zc - side * 0.3), (x1 + 0.3, 1.2, zc - side * 0.3), seg=8)
    # the steps (collider: the 0.18 slab) and a lower lip
    b.box(GD, 1.2, 0.18, 4.2, -24.4, 0, 11, bevel=0.015)
    b.box(GD, 0.4, 0.09, 3.8, -23.6, 0, 11, bevel=0.015)
    # Doric columns in antis
    for cz in (9.3, 12.7):
        cx = -24.55
        b.cyl(GD, 0.3, (cx, 0.18, cz), (cx, 0.3, cz), seg=20)
        b.cyl(G, 0.27, (cx, 0.3, cz), (cx, 0.38, cz), seg=20)
        fluted_shaft(b, G, cx, cz, 0.38, 2.92, 0.235, 0.2)
        b.cyl(G, 0.2, (cx, 2.92, cz), (cx, 3.04, cz), seg=20, r2=0.29)
        b.box(G, 0.62, 0.12, 0.62, cx, 3.04, cz, bevel=0.01)
        b.box(G, 0.64, 0.04, 0.64, cx, 3.16, cz)
    # entablature: architrave, frieze with triglyphs, cornice
    ex0, ex1, ez0, ez1 = -31.4, -24.2, 7.6, 14.4
    W, D = ex1 - ex0, ez1 - ez0
    cx, cz = (ex0 + ex1) / 2, (ez0 + ez1) / 2
    b.box(G, W, 0.14, D, cx, 3.2, cz)
    b.box(GD, W - 0.04, 0.17, D - 0.04, cx, 3.34, cz)
    b.box(G, W + 0.36, 0.1, D + 0.36, cx, 3.51, cz, bevel=0.02)
    b.box(G, W + 0.24, 0.04, D + 0.24, cx, 3.47, cz)
    for zz in [ez0 + 0.3 + i * 0.75 for i in range(9)]:
        for xx in (ex1 + 0.01, ex0 - 0.01):
            b.box(G, 0.06, 0.17, 0.32, xx, 3.34, zz)
    for xx in [ex0 + 0.35 + i * 0.75 for i in range(10)]:
        for zz in (ez0 - 0.01, ez1 + 0.01):
            b.box(G, 0.32, 0.17, 0.06, xx, 3.34, zz)
    # pediments + roof: ridge along x, gables east and west
    rise = 1.3
    base = D + 0.36
    gable_prism(b, G, base - 0.3, rise - 0.2, 3.61, ex1 - 0.15, ex1 + 0.04, axis="x", c=cz)
    gable_prism(b, G, base - 0.3, rise - 0.2, 3.61, ex0 - 0.04, ex0 + 0.15, axis="x", c=cz)
    # tympanum recess (east) for the relief the JS hangs there
    gable_prism(b, P["recess"], base - 1.4, rise - 0.75, 3.75, ex1 + 0.03, ex1 + 0.05, axis="x", c=cz)
    slope = math.atan2(rise, base / 2)
    L = math.hypot(base / 2, rise) + 0.1
    for s in (-1, 1):
        zc = cz + s * base / 4
        b.box(GD, W + 0.5, 0.16, L, cx, 3.61 + rise / 2 - 0.08, zc, rx=s * slope)
        # raking cornices on both gables
        for xx in (ex1 + 0.2, ex0 - 0.2):
            b.box(G, 0.2, 0.14, L, xx, 3.61 + rise / 2, zc, rx=s * slope)
    # roll-top ridge, acroteria at the apex and the eaves
    b.cyl(G, 0.11, (ex0 - 0.25, 3.61 + rise + 0.02, cz), (ex1 + 0.25, 3.61 + rise + 0.02, cz), seg=10)
    for xx in (ex1 + 0.2, ex0 - 0.2):
        b.box(G, 0.22, 0.42, 0.42, xx, 3.61 + rise - 0.05, cz, bevel=0.03)
        b.cyl(GD, 0.14, (xx, 3.61 + rise + 0.37, cz), (xx, 3.61 + rise + 0.55, cz), seg=12, r2=0.02)
        for s in (-1, 1):
            b.box(G, 0.22, 0.3, 0.3, xx, 3.61, cz + s * (base / 2 - 0.1))
    # inside: polished floor, coffered ceiling, niches, the stained window
    b.box(GD, 5.0, 0.02, 5.0, -28, 0, 11)
    for i in range(1, 4):
        b.box(J, 5.0, 0.012, 0.03, -28, 0.02, 8.5 + i * 1.25)
        b.box(J, 0.03, 0.012, 5.0, -30.5 + i * 1.25, 0.02, 11)
    for i in range(5):
        b.box(G, 5.0, 0.14, 0.1, -28, 3.06, 8.5 + i * 1.25)
        b.box(G, 0.1, 0.14, 5.0, -30.5 + i * 1.25, 3.06, 11)
    for zz, s in ((z0 + t, 1), (z1 - t, -1)):
        for xx in (-29.6, -27.6, -26.2):
            for lv in (0.6, 1.75):
                b.box(G, 0.95, 0.85, 0.06, xx, lv, zz + s * 0.03)
                b.box(P["recess"], 0.75, 0.65, 0.02, xx, lv + 0.1, zz + s * 0.065)
                b.box(P["brass"], 0.4, 0.16, 0.02, xx, lv + 0.35, zz + s * 0.08)
            b.box(GD, 1.0, 0.06, 0.18, xx, 0.55, zz + s * 0.09)
        # an urn on the ledge of each wall
        b.cyl(P["bronze"], 0.1, (-28.6, 0.6, zz + s * 0.12), (-28.6, 0.92, zz + s * 0.12), seg=12, r2=0.06)
    # stained window on the west wall: arched stone frame both faces
    for face, xx in ((1, x0 + t + 0.02), (-1, x0 - 0.02)):
        for side in (-1, 1):
            b.box(GD, 0.06, 1.3, 0.14, xx, 1.2, 11 + side * 0.62)
        b.box(GD, 0.06, 0.1, 1.4, xx, 1.1, 11)
        arch(b, GD, xx, 11, 1.1, 0.06, 2.5, along="z", thick=0.12, seg=9)
    # the sarcophagus: plinth, panelled chest, gabled lid, lion feet
    sx, sz = -28.4, 11.0
    b.box(GD, 1.3, 0.12, 2.5, sx, 0, sz, bevel=0.02)
    b.box(G, 1.1, 0.83, 2.3, sx, 0.12, sz, bevel=0.015)
    for s in (-1, 1):
        b.box(GD, 0.02, 0.5, 1.8, sx + s * 0.56, 0.3, sz)
        b.box(G, 0.02, 0.38, 1.66, sx + s * 0.575, 0.36, sz)
        b.box(GD, 0.8, 0.5, 0.02, sx, 0.3, sz + s * 1.16)
    b.box(GD, 1.24, 0.08, 2.44, sx, 0.95, sz, bevel=0.02)
    gable_prism(b, G, 1.2, 0.18, 1.03, sz - 1.2, sz + 1.2, axis="z", c=sx)
    for (ox, oz) in ((-0.5, -1.1), (0.5, -1.1), (-0.5, 1.1), (0.5, 1.1)):
        b.lump(GD, 0.22, 0.16, 0.22, sx + ox, 0, sz + oz, seed=int(ox * 10 + oz * 7), rnd=0.6, jitter=0.02)
    b.finish("hg-mausoleum.glb")


BUILDS = {"mausoleum": build_mausoleum}
FILES = {"mausoleum": "hg-mausoleum.glb"}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    names = argv or list(BUILDS)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    P.update(hg_palette())
    import quantize_glb
    for n in names:
        BUILDS[n](P)
        quantize_glb.main([os.path.join(OUT_DIR, FILES[n])])


if __name__ == "__main__":
    main()
