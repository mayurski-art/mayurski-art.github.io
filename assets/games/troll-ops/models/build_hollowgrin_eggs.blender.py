"""
Troll Forces - Hollowgrin's easter eggs, headless Blender.

Run with:
  blender --background --python build_hollowgrin_eggs.blender.py
  (or, with Blender as a Python module: python build_hollowgrin_eggs.blender.py)

The Meme Gallery in the Troll House's front yard (after the user's photo of
the meme-gallery sculptures): a white trollface bust and a Pepe, each built
at the origin facing +z with its base on y = 0; hollowgrin.js puts them on
their plinths. Writes hg-trollbust.glb and hg-pepe.glb, then quantizes them
(quantize_glb.py).

The trollface is the same carving as Trollface Falls (build_grinleria's
build_trollhead, from the real artwork), in white with black cuts.
"""
import importlib.util
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
spec = importlib.util.spec_from_file_location("build_grinleria", os.path.join(HERE, "build_grinleria.blender.py"))
GLB = importlib.util.module_from_spec(spec)
spec.loader.exec_module(GLB)          # defines everything; builds nothing (main is guarded)

import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix  # noqa: E402
from map_kit import Builder, mat  # noqa: E402
import quantize_glb  # noqa: E402


def blob(b, m, c, r, seg=32, ring=16):
    """A smooth ellipsoid: centre c, radii r (x, y, z)."""
    M = Matrix.Translation(c) @ Matrix.Diagonal((r[0], r[1], r[2], 1))
    verts = bmesh.ops.create_uvsphere(b.bm, u_segments=seg, v_segments=ring, radius=1.0, matrix=M)["verts"]
    faces = {f for v in verts for f in v.link_faces}
    b._tag(faces, m, smooth=True)


def build_pepe():
    """Pepe: a wide green head, heavy-lidded eyes glancing to one side,
    the long brown-red lips. About 1.1 m tall, like the gallery's."""
    b = Builder()
    green = mat("HG_PepeGreen", 0x5c9c3c, 0.45)
    green_dk = mat("HG_PepeGreenDark", 0x4a8530, 0.5)
    white = mat("HG_PepeWhite", 0xf4f2ea, 0.3)
    iris = mat("HG_PepeIris", 0x2a1a12, 0.3)
    lips = mat("HG_PepeLips", 0xb4583e, 0.45)
    mouth = mat("HG_PepeMouth", 0x5a2418, 0.6)
    blob(b, green, (0, 0.5, 0), (0.74, 0.5, 0.58))                   # the head
    blob(b, green, (0, 0.28, 0.06), (0.66, 0.3, 0.56))               # jowls, a flatter base
    for s in (-1, 1):
        x = s * 0.3
        blob(b, green_dk, (x, 0.84, 0.18), (0.31, 0.27, 0.3))        # eye mounds
        blob(b, white, (x, 0.86, 0.4), (0.22, 0.17, 0.14))           # whites
        blob(b, iris, (x + 0.07, 0.84, 0.52), (0.075, 0.075, 0.03))  # pupils, glancing right
        blob(b, green, (x, 0.95, 0.4), (0.235, 0.11, 0.16))          # the droopy upper lid
        blob(b, green_dk, (x, 0.76, 0.42), (0.22, 0.045, 0.13))      # the lower lid
    blob(b, lips, (0.02, 0.47, 0.49), (0.52, 0.065, 0.13))           # upper lip
    blob(b, lips, (0.0, 0.39, 0.46), (0.46, 0.06, 0.12))             # lower lip
    blob(b, mouth, (0.01, 0.43, 0.5), (0.5, 0.012, 0.1))             # the line between
    b.finish("hg-pepe.glb")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    P = GLB.mall_palette()
    GLB.build_trollhead(P, width=1.5, res=150, front=0.62, back=0.55, carve=0.06, name="hg-trollbust",
                        place=(0.0, 0.0, 0.0, 0.0, -0.05, 0.0), colors=(0xf6f6f2, 0xe9e9e4, 0x121212), moss_on=False)
    build_pepe()
    quantize_glb.main([os.path.join(HERE, f) for f in ("hg-trollbust.glb", "hg-pepe.glb")])


if __name__ == "__main__":
    main()
