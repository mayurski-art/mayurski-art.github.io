"""
Troll Forces Zombies — the armoured zombie's riot gear (design doc "Zombie
Rush: what's next", phase M2). Two small static GLBs the game pins to a
zombie's bones (modes/zombies/horde.js armour):

  zombie-helmet.glb  a riot helmet: navy shell, a smoked visor (ZA_Visor, the
                     game makes it see-through), hinge pivots, a chin strap.
                     Origin = the middle of the head; it flies off when shot
                     enough (headshots chip it first).
  zombie-vest.glb    a black tactical vest: front and back plates, shoulder
                     and side straps, magazine and radio pouches. Origin = the
                     middle of the chest.

Game coordinates (x left-right, y up, +z the way the zombie faces), metres,
sized for the walker body (the game scales by the zombie's build).

Run with:
  blender --background --python build_zarmour.blender.py
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from map_kit import mat  # noqa: E402
from tf_kit import Report, TFBuilder  # noqa: E402
from hg_kit import lathe  # noqa: E402


def palette():
    return {
        "shell": mat("ZA_Shell", 0x1b2433, 0.35, 0.1),
        "trim": mat("ZA_Trim", 0x0e0f12, 0.6),
        "visor": mat("ZA_Visor", 0x1a1f26, 0.08, 0.2, 0x000000, 0.0),
        "metal": mat("ZA_Metal", 0x8a8f96, 0.35, 0.7),
        "strap": mat("ZA_Strap", 0x17181b, 0.85),
        "vest": mat("ZA_Vest", 0x1f2226, 0.8),
        "pouch": mat("ZA_Pouch", 0x2b2f35, 0.85),
        "buckle": mat("ZA_Buckle", 0x3a3d42, 0.5, 0.3),
        "decal": mat("ZA_Decal", 0xd9dde2, 0.6),
    }


def arc_shell(b, m, r, y0, y1, a0, a1, seg=14, thick=0.008):
    """A curved band round the y axis: radius r, heights y0..y1, from angle
    a0 to a1 (radians, 0 = +z, toward +x), `thick` deep."""
    pts, faces = [], []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        for rr in (r, r + thick):
            for y in (y0, y1):
                pts.append((math.sin(a) * rr, y, math.cos(a) * rr))
    for i in range(seg):
        k, n = i * 4, (i + 1) * 4
        # inner, outer, top, bottom
        faces += [[k, k + 1, n + 1, n], [k + 2, n + 2, n + 3, k + 3], [k + 1, k + 3, n + 3, n + 1], [k, n, n + 2, k + 2]]
    faces += [[0, 2, 3, 1], [seg * 4, seg * 4 + 1, seg * 4 + 3, seg * 4 + 2]]
    b.poly(m, pts, faces)


def build_helmet(P):
    b = TFBuilder()
    # the shell: a dome over the crown, down to the brow
    lathe(b, P["shell"], 0, 0, [(0.132, -0.035), (0.137, 0.015), (0.133, 0.065), (0.118, 0.105), (0.088, 0.137),
                                (0.048, 0.155), (0.0, 0.16)], seg=24)
    # down over the ears and the nape (not the face)
    arc_shell(b, P["shell"], 0.128, -0.115, -0.03, math.radians(70), math.radians(290), seg=16, thick=0.01)
    arc_shell(b, P["trim"], 0.131, -0.122, -0.11, math.radians(70), math.radians(290), seg=16, thick=0.012)
    lathe(b, P["trim"], 0, 0, [(0.138, -0.04), (0.141, -0.035), (0.141, -0.025), (0.138, -0.02)], seg=24, caps=False)
    # the visor: a smoked shield across the face, hinged at the temples
    arc_shell(b, P["visor"], 0.152, -0.135, 0.045, math.radians(-78), math.radians(78), seg=16, thick=0.005)
    arc_shell(b, P["trim"], 0.153, 0.04, 0.058, math.radians(-80), math.radians(80), seg=16, thick=0.008)
    for s in (-1, 1):
        b.cyl(P["metal"], 0.018, (s * 0.142, 0.02, 0.0), (s * 0.158, 0.02, 0.0), seg=10)
        b.cyl(P["trim"], 0.012, (s * 0.157, 0.02, 0.0), (s * 0.163, 0.02, 0.0), seg=8)
    # a white band and a shield badge on the front of the shell
    arc_shell(b, P["decal"], 0.1335, 0.07, 0.08, math.radians(-40), math.radians(40), seg=8, thick=0.004)
    # the chin strap, hanging loose under the jaw
    for s in (-1, 1):
        b.bar(P["strap"], (s * 0.12, -0.09, 0.02), (s * 0.06, -0.17, 0.06), 0.02, 0.006)
    b.bar(P["strap"], (-0.06, -0.17, 0.06), (0.06, -0.17, 0.06), 0.02, 0.006)
    b.box(P["buckle"], 0.025, 0.018, 0.01, 0.0, -0.18, 0.062)
    b.finish("zombie-helmet.glb")


def build_vest(P):
    b = TFBuilder()
    W, H = 0.40, 0.44          # the plates
    y0 = -0.27                 # bottom edge, below the chest's middle
    # front and back plates, rounded a little at the corners
    for z, d in ((0.135, 0.055), (-0.13, 0.045)):
        b.box(P["vest"], W, H, d, 0.0, y0, z, bevel=0.012)
    # the sides: cummerbund straps round the ribs
    for s in (-1, 1):
        for yy in (y0 + 0.05, y0 + 0.17):
            b.box(P["strap"], 0.03, 0.06, 0.26, s * (W / 2 - 0.01), yy, 0.0)
        b.box(P["buckle"], 0.035, 0.04, 0.04, s * (W / 2 + 0.005), y0 + 0.06, 0.08)
    # shoulder straps over the top, front plate to back
    for s in (-1, 1):
        x = s * 0.12
        b.bar(P["vest"], (x, y0 + H - 0.01, 0.13), (x, y0 + H + 0.07, 0.04), 0.07, 0.025)
        b.bar(P["vest"], (x, y0 + H + 0.07, 0.04), (x, y0 + H + 0.07, -0.05), 0.07, 0.025)
        b.bar(P["vest"], (x, y0 + H + 0.07, -0.05), (x, y0 + H - 0.01, -0.125), 0.07, 0.025)
    # the front: a row of three magazine pouches, a radio, a name tape
    for i in (-1, 0, 1):
        x = i * 0.105
        b.box(P["pouch"], 0.09, 0.13, 0.05, x, y0 + 0.03, 0.18, bevel=0.006)
        b.box(P["strap"], 0.092, 0.03, 0.052, x, y0 + 0.13, 0.181)
        b.box(P["buckle"], 0.02, 0.02, 0.01, x, y0 + 0.125, 0.208)
    b.box(P["pouch"], 0.07, 0.12, 0.045, -0.12, y0 + 0.24, 0.18, bevel=0.006)
    b.cyl(P["trim"], 0.006, (-0.13, y0 + 0.36, 0.18), (-0.13, y0 + 0.44, 0.18), seg=6)
    b.box(P["decal"], 0.14, 0.035, 0.004, 0.08, y0 + 0.33, 0.164)
    # the webbing rows across the front plate
    for yy in (y0 + 0.2, y0 + 0.26):
        b.box(P["strap"], W - 0.04, 0.012, 0.006, 0.0, yy, 0.164)
    b.finish("zombie-vest.glb")


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    build_helmet(P)
    build_vest(P)
    for n, t, v, by, lo, hi in Report.rows:
        print(f"{n:16}{t:7} tris {os.path.getsize(os.path.join(os.path.dirname(os.path.abspath(__file__)), n + '.glb')) / 1e3:7.1f} kB {lo} {hi}")
    print("ARMOUR EXPORTED")


main()
