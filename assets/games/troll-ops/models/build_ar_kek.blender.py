"""
MTAR, the detailed first-person model (weapons.js id `kek`).

    blender --background --python build_ar_kek.blender.py            # export .glb
    blender --background --python build_ar_kek.blender.py -- render  # + studio renders

The Tavor bullpup on its traced outline (arkit): one moulded shell, wide
at the back where the action and mag sit, the fore-end narrower; the
trigger guard run all the way down to the grip; a rail over the top; the
mag behind the grip; a birdcage on the barrel.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import arkit as ak
from gunkit import Part, box, slab_body, screw

PFX = "MT"
OUT_GLB = os.path.join(ak.HERE, "ar-kek.glb")
RENDER = "render" in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
R, S, O = ak.setup(PFX, "kek")
Z, Y = R.Z, R.Y
RB = ak.rail_base(R, S)


body = Part(PFX + "_Body")
# the top cut flat to the rail bed all the way back (nothing stands up in
# the sight line); the guard and grip, the butt pad, the narrower fore-end, the action / stock shell
slab_body(body, R, O["outer"], O["holes"], [
    dict(rect=(-999, 500, 190, 999), hw=0.0125, key="poly"),
    dict(rect=(800, 1999, -999, 999), hw=0.0265, key="dark"),
    dict(rect=(-999, 345, -999, 999), hw=0.0225, key="recv"),
    dict(rect=(-999, 1999, -999, 999), hw=0.0265, key="recv"),
], clip=[(318, 1999, -999, RB)], smooth=3, eps=2.6, bevel=0.003, bevel_segs=3)
ak.rail(body, R, S, 320, 590)
for sx in (-1, 1):
    box(body, (sx * 0.0267, Y(150), Z(672)), (0.0012, R.m(22), R.m(70)), "dark")       # ejection ports
    box(body, (sx * 0.0230, Y(132), Z(250)), (0.0012, R.m(10), R.m(150)), "dark")      # fore-end vent slot
    for px in (420, 560, 760):
        screw(body, (sx * 0.0266, Y(170), Z(px)), (sx, 0, 0), r=0.0024)
box(body, (-0.0240, Y(126), Z(300)), (0.006, 0.008, 0.012), "steel")                   # charging handle
ak.barrel(body, R, S, r=0.0068)
ak.device(PFX, R, S, "birdcage", r=0.0096)
ak.mag(PFX, R, O)
ak.irons(PFX, R, S)
ak.anchors(PFX, R, S)
ak.finish_and_export(PFX, body, OUT_GLB, {
    "kek-right": ((1.3, 0.0, Z(500)), (0, -0.03, Z(500)), 50),
    "kek-34": ((0.55, 0.25, Z(500) + 0.45), (0, -0.03, Z(500)), 50),
} if RENDER else None)
