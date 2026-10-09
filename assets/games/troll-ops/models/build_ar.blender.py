"""
The detailed first-person assault rifles that share one recipe (arkit):
Type 25, SWAT-556, FAL OSW, SCAR-H, AN-94, SMR and M8A1. (The M27 and MTAR
have their own scripts, build_ar_heh / build_ar_kek.)

    blender --background --python build_ar.blender.py -- <id>           # export models/ar-<id>.glb
    blender --background --python build_ar.blender.py -- <id> render    # + studio renders

Each config below reads off the rifle's traced reference (pixels of the
same image weapon-ars.js was traced from): where the stock, receiver,
handguard and grip run (half-widths by region), which material each takes,
where a band is cut (ycut: a grip or guard hanging under the body), where
a rail sits flat on top, and the barrel and muzzle device.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import arkit as ak
from gunkit import Part, box, auto_body, screw, lathe

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GUN = ARGS[0] if ARGS else "lol"
RENDER = "render" in ARGS


def region(rules, default):
    """rules: [(px0, px1, py0, py1, value)], first match wins (py by band centre)."""
    def f(px, py):
        for (a, b, c, d, v) in rules:
            if min(a, b) <= px <= max(a, b) and min(c, d) <= py <= max(c, d):
                return v
        return default
    return f


TAN = dict(recv=0x5a5038, rail=0x2f2b25, poly=0x534a32, magm=0x4a4230)
KHAKI = dict(recv=0x5c5640, rail=0x34312a, poly=0x2c2a26, magm=0x2c2a26)

CONF = {
    # Type 25: bullpup under a carry handle; tall front post; curved mag behind the grip.
    "lol": dict(pfx="T2", span=(310, 1118), splits=(1095,),
                hw=[(590, 885, 120, 230, 0.0100), (560, 830, 352, 700, 0.0125), (300, 600, 0, 700, 0.0240)], hw0=0.0265,
                key=[(1095, 1130, 0, 700, "dark"), (560, 830, 352, 700, "poly")], key0="recv",
                flat=[(600, 860)], rails=[(602, 858)], ycut=[(560, 830, 352)],
                barrel=0.0080, collar=None, device=("birdcage", 0.0118),
                vents=[(380, 560, 250)], pins=[(640, 300), (930, 300)]),
    # SWAT-556: the SIG receiver and front sight block, the olive quad rail, the olive stock.
    "lmao": dict(pfx="SW", span=(249, 1072), splits=(345, 650, 885), colors=dict(furn=0x3b3a22),
                 hw=[(760, 890, 300, 700, 0.0125), (249, 345, 0, 700, 0.0140), (345, 650, 0, 700, 0.0225),
                     (885, 1080, 0, 700, 0.0190)], hw0=0.0160,
                 key=[(345, 650, 0, 700, "furn"), (885, 1080, 0, 700, "furn"), (760, 890, 300, 700, "poly")], key0="recv",
                 flat=[(360, 640), (652, 850)], rails=[(362, 638), (654, 848)], ycut=[(760, 890, 300)],
                 barrel=0.0082, collar=None, device=("birdcage", 0.0120),
                 vents=[], pins=[(700, 270), (840, 250)]),
    # FAL OSW: the FAL receiver, a railed fore-end, the mag ahead of the grip, a stub stock.
    "rofl": dict(pfx="FA", span=(345, 1243), splits=(440, 1060),
                 hw=[(900, 1050, 300, 700, 0.0125), (345, 440, 0, 700, 0.0140), (440, 730, 0, 700, 0.0220),
                     (1060, 1250, 0, 700, 0.0190)], hw0=0.0180,
                 key=[(1060, 1250, 0, 700, "poly"), (900, 1050, 300, 700, "poly")], key0="recv",
                 flat=[(470, 1040)], rails=[(472, 1038)], ycut=[(900, 1050, 296)],
                 barrel=0.0085, collar=None, device=("birdcage", 0.0122),
                 vents=[(480, 720, 195)], pins=[(800, 250), (980, 250)]),
    # SCAR-H: the long flattop upper, the polymer lower and folding stock, the straight 7.62 mag.
    "mald": dict(pfx="SC", span=(54, 966), splits=(345,), colors=TAN,
                 hw=[(330, 470, 268, 700, 0.0125), (40, 345, 0, 700, 0.0170), (345, 905, 200, 700, 0.0150)], hw0=0.0180,
                 key=[(40, 345, 0, 700, "poly"), (330, 470, 268, 700, "poly"), (345, 640, 205, 700, "poly")], key0="recv",
                 flat=[(365, 900)], rails=[(367, 898)], ycut=[(330, 470, 268)],
                 barrel=0.0080, collar=None, device=("birdcage", 0.0112),
                 vents=[], pins=[(420, 235), (560, 235)]),
    # AN-94: the Kalashnikov receiver, the barrel over its gas tube, tan stock, grip and handguard.
    "coalface": dict(pfx="AN", span=(4, 1262), splits=(300, 700, 995), colors=dict(furn=0x5a4527),
                     hw=[(300, 500, 150, 700, 0.0125), (0, 300, 0, 700, 0.0180), (700, 995, 0, 700, 0.0210),
                         (995, 1270, 0, 700, 0.0120)], hw0=0.0160,
                     key=[(0, 300, 0, 700, "furn"), (700, 995, 0, 700, "furn"), (300, 500, 150, 700, "furn")], key0="recv",
                     flat=[(390, 750)], rails=[(392, 748)], ycut=[(300, 500, 150)],
                     barrel=0.0085, collar=None, device=("brake", 0.0120),
                     vents=[], pins=[(560, 95), (650, 95)]),
    # SMR: a bullpup slab, deep receiver, skeleton grip, short mag at the back.
    "salt": dict(pfx="SM", span=(118, 1134), splits=(),
                 hw=[(640, 1040, 380, 700, 0.0130), (110, 560, 0, 700, 0.0240)], hw0=0.0270,
                 key=[(640, 1040, 380, 700, "poly")], key0="recv",
                 flat=[(300, 800)], rails=[(302, 798)], ycut=[(640, 1040, 378)],
                 barrel=0.0085, collar=None, device=("brake", 0.0132),
                 vents=[(300, 520, 215), (300, 520, 275)], pins=[(700, 330), (1000, 330)]),
    # M8A1: the XM8's moulded body, the carry handle holding the sight, the slab mag.
    "ratio": dict(pfx="M8", span=(43, 1340), splits=(), colors=KHAKI,
                  hw=[(420, 700, 345, 700, 0.0125), (480, 720, 60, 160, 0.0120), (30, 480, 0, 700, 0.0160)], hw0=0.0260,
                  key=[], key0="recv",
                  flat=[(505, 690)], rails=[(507, 688)], ycut=[(420, 700, 345)],
                  barrel=0.0068, collar=None, device=("can", 0.0088),
                  vents=[(1040, 1260, 215)], pins=[(560, 300), (780, 300)]),
}

C = CONF[GUN]
PFX = C["pfx"]
R, S, O = ak.setup(PFX, GUN, **C.get("colors", {}))
Z, Y = R.Z, R.Y
RB = ak.rail_base(R, S)
hw = region(C["hw"], C["hw0"])
key = region(C["key"], C["key0"])

body = Part(PFX + "_Body")
auto_body(body, R, [O["outer"]] + O["holes"], C["span"][0], C["span"][1], hw, key, r=0.0055, step=5, smooth=2,
          splits=C["splits"], flat=[(a, b, RB) for (a, b) in C["flat"]], ycut=C["ycut"])
for (a, b) in C["rails"]:
    ak.rail(body, R, S, a, b)
for (a, b, py) in C["vents"]:                       # slots along the fore-end, both sides
    w = hw((a + b) / 2, py) + 0.0002
    for sx in (-1, 1):
        box(body, (sx * w, Y(py), (Z(a) + Z(b)) / 2), (0.0012, R.m(9), abs(Z(b) - Z(a))), "dark")
ak.pins(body, R, C["pins"], C["hw0"])
ak.barrel(body, R, S, r=C["barrel"], collar=C["collar"])
ak.device(PFX, R, S, C["device"][0], r=C["device"][1])
ak.mag(PFX, R, O)
ak.irons(PFX, R, S)
ak.anchors(PFX, R, S)
mid = (C["span"][0] + C["span"][1]) / 2
ak.finish_and_export(PFX, body, os.path.join(ak.HERE, f"ar-{GUN}.glb"), {
    f"{GUN}-right": ((1.25, 0.0, Z(mid)), (0, -0.03, Z(mid)), 50),
    f"{GUN}-34": ((0.55, 0.25, Z(mid) + 0.45), (0, -0.03, Z(mid)), 50),
} if RENDER else None)
