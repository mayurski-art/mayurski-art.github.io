"""
M27, the detailed first-person model (weapons.js id `heh`).

    blender --background --python build_ar_heh.blender.py            # export .glb
    blender --background --python build_ar_heh.blender.py -- render  # + studio renders

Modelled on the M27 outline traced for weapon-ars.js (gunkit Ref /
ars_outline): every part sits where the reference photo has it, in the
same game coordinates the traced gun uses. The HK416 family: a flattop
upper, a free-floated quad rail, the stepped E-stock, the HK grip, a
30-round curved mag, a flip-up rear and a post front sight.

Nodes the game reads (weapon-model.js buildDetailed):
  M2_Body, M2_Mag (pivot = the mag point), M2_Hider, M2_IronRear /
  M2_IronFront, and empties M2_Grip / M2_Support / M2_Muzzle / M2_Aim /
  M2_Under / M2_Rail.
"""
import os
import sys
import math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gunkit as gk
from gunkit import (Part, Vector, TAU, material, lathe, box, loft, rrect, local_lathe, sweep, catmull,
                    empty, screw, Ref, ars_outline, side_loft, vert_loft, span, picatinny)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_GLB = os.path.join(OUT_DIR, "ar-heh.glb")
RENDER = "render" in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])

gk.M.update({
    # the Green Candles recipe: low-metal greys, warmed (the view-model
    # lights are blue, weapon-model.js GC_TUNE; a metal finish just
    # mirrors the blue sky), a step apart so the parts read separately in
    # the hand, matte polymer, and bright steel on the small parts
    "recv":  material("M2_Receiver", 0x48433d, 0.5, 0.3),
    "rail":  material("M2_Rail", 0x3a3631, 0.52, 0.3),
    "poly":  material("M2_Polymer", 0x2b2722, 0.8, 0.0),
    "steel": material("M2_Steel", 0x9aa0a4, 0.3, 1.0),
    "dark":  material("M2_Dark", 0x15120f, 0.6, 0.3),
    "magm":  material("M2_Mag", 0x35312c, 0.58, 0.2),
    "dot":   material("M2_Dot", 0xffffff, 0.4, 0.0, 0xd8f0ff, 1.0),
})

R = Ref(0.94, (83, 1276), -1, 180, (480, 300))
O = ars_outline("heh")
OUT = O["outer"]
Z, Y = R.Z, R.Y

RAIL_TOP = Y(128)
SIGHT_Y = Y(92)
UP_HW, LO_HW, HG_HW = 0.0150, 0.0140, 0.0215

body = Part("M2_Body")

# ---- upper receiver (flattop) with its rail, port, assist, charging handle
RB = 128 + 0.0105 / R.s          # rail base, pixels: the rail sits on it
side_loft(body, R, OUT, 440, 748, UP_HW, 0.004, "recv", step=40, top=RB, bot=215)
side_loft(body, R, OUT, 436, 441, UP_HW - 0.003, 0.004, "recv", step=5, top=RB + 3, bot=212)   # rear chamfer
picatinny(body, Z(452), Z(752), RAIL_TOP - 0.0102, 0.0105, "recv")
box(body, (UP_HW + 0.0004, Y(176), Z(640)), (0.0012, R.m(24), R.m(80)), "dark")          # ejection port
box(body, (UP_HW + 0.0010, Y(176), Z(640)), (0.0010, R.m(20), R.m(76)), "recv")          # dust cover
local_lathe(body, (UP_HW - 0.002, Y(170), Z(560)), (0.7, 0.3, 0.4), [(0, 0.0062), (0.015, 0.0062), (0.019, 0.0056), (0.019, 0.0)], "recv", segs=14)
box(body, (UP_HW + 0.004, Y(186), Z(590)), (0.008, 0.014, 0.010), "recv")                # brass deflector
box(body, (0, RAIL_TOP - 0.006, Z(446)), (0.034, 0.006, 0.006), "recv")                  # charging handle

# ---- lower receiver, the guard opening left open, the flared magwell
hole = max(O["holes"], key=lambda h: (max(p[0] for p in h) - min(p[0] for p in h)) * (max(p[1] for p in h) - min(p[1] for p in h)))
# one lower receiver: the outline's own bottom edge (grip boss, the flared
# magwell) with the trigger guard opening left open
side_loft(body, R, OUT, 434, 740, LO_HW, 0.0045, "recv", step=5, top=213, ywin=(205, 300), smooth=2, cut=[hole],
          hw_fn=lambda t: LO_HW + (0.0018 if t > 0.58 else 0.0))
for px in (470, 600):
    for sx in (-1, 1):
        local_lathe(body, (sx * (LO_HW - 0.0005), Y(232), Z(px)), (sx, 0, 0), [(0, 0.0030), (0.0010, 0.0027), (0.0014, 0.0)], "steel", segs=10)
box(body, (LO_HW + 0.0006, Y(262), Z(600)), (0.004, 0.010, 0.010), "steel")             # mag release
box(body, (-LO_HW - 0.001, Y(236), Z(520)), (0.003, 0.006, 0.020), "steel")             # selector
box(body, (-LO_HW - 0.001, Y(246), Z(660)), (0.003, 0.016, 0.024), "steel")             # bolt catch
hx0, hx1 = min(p[0] for p in hole), max(p[0] for p in hole)
hy1 = max(p[1] for p in hole)
guard = catmull([(0, Y(250), Z(hx0 - 2)), (0, Y(hy1 + 2), Z(hx0 + 12)), (0, Y(hy1 + 3), Z((hx0 + hx1) / 2)),
                 (0, Y(hy1 + 2), Z(hx1 - 8)), (0, Y(262), Z(hx1 + 4))], 18)
sweep(body, guard, lambda s: 0.0028, "recv", sides=8, uv=False)
trig = catmull([(0, Y(252), Z(hx0 + 26)), (0, Y(266), Z(hx0 + 24)), (0, Y(280), Z(hx0 + 30))], 8)
sweep(body, trig, lambda s: 0.0021, "steel", sides=6, uv=False)

# ---- HK grip, raked, with a stippled back strap
vert_loft(body, R, OUT, 286, 428, 0.0125, 0.006, "poly", step=6, xwin=(395, 540), smooth=2,
          hw_fn=lambda t: 0.0118 + 0.0016 * math.sin(math.pi * min(1, t * 1.2)))

# ---- buffer tube and the stepped E-stock with its cheek ridge
lathe(body, [(Z(436), 0.0), (Z(436), 0.0145), (Z(150), 0.0145), (Z(150), 0.0)], "recv", segs=24, cy=Y(186))
side_loft(body, R, OUT, 112, 420, 0.0175, 0.007, "poly", step=8, ywin=(140, 365), smooth=3,
          hw_fn=lambda t: 0.0190 - 0.0025 * t)
side_loft(body, R, OUT, 86, 114, 0.0198, 0.004, "dark", step=7, ywin=(140, 365), smooth=1)     # butt pad

# ---- the quad rail: round-edged tube, rails on top, both sides and under
side_loft(body, R, OUT, 744, 1078, HG_HW, 0.007, "rail", step=60, top=RB, bot=214)
side_loft(body, R, OUT, 1076, 1086, HG_HW - 0.003, 0.006, "rail", step=5, top=RB + 2, bot=211)   # front cap
picatinny(body, Z(762), Z(1078), RAIL_TOP - 0.0102, 0.0105, "rail")
hg_mid = (Y(128) + Y(214)) / 2
for sx in (-1, 1):
    for k in range(int(R.m(1078 - 790) / 0.0052)):
        z = Z(790) - 0.0026 - k * 0.0052
        box(body, (sx * (HG_HW + 0.0010), hg_mid, z), (0.0022, 0.016, 0.0024), "dark")
    for px in (800, 960, 1060):
        screw(body, (sx * (HG_HW + 0.0002), hg_mid + 0.012, Z(px)), (sx, 0, 0), r=0.0026)
    box(body, (sx * (HG_HW + 0.0004), hg_mid - 0.012, Z(910)), (0.0012, 0.008, R.m(200)), "dark")   # cover slot
for k in range(int(R.m(1078 - 790) / 0.0052)):
    z = Z(790) - 0.0026 - k * 0.0052
    box(body, (0, Y(214) - 0.0012, z), (0.016, 0.0024, 0.0024), "dark")

# ---- barrel, gas block / front sight base
lathe(body, [(Z(1080), 0.0), (Z(1080), 0.0095), (Z(1094), 0.0095), (Z(1098), 0.0076), (Z(1214), 0.0072),
             (Z(1214), 0.0)], "steel", segs=28)
box(body, (0, 0.006, Z(1062)), (0.020, 0.026, R.m(30)), "steel")
body.finish(bevel=0.0004, bevel_segs=1)

# ---- the 30-round mag, curved, ribbed
magPoly = O["mag"]
mtop = min(p[1] for p in magPoly)
mtop_x = [p[0] for p in magPoly if p[1] <= mtop + 4]
pivot = R.P((min(mtop_x) + max(mtop_x)) / 2, mtop + 6)
mag = Part("M2_Mag", pivot=tuple(pivot))
mbot = max(p[1] for p in magPoly)
vert_loft(mag, R, magPoly, mtop + 1, mbot - 10, 0.0118, 0.004, "magm", step=8, smooth=2)
vert_loft(mag, R, magPoly, mbot - 12, mbot - 1, 0.0130, 0.004, "poly", step=4, smooth=1)       # baseplate
for sx in (-1, 1):                                                                       # the two stiffening ribs
    for frac in (0.32, 0.68):
        pts = []
        for k in range(12):
            py = mtop + 12 + (mbot - 26 - mtop) * k / 11
            sp = span(magPoly, 1, py)
            if sp:
                pts.append(Vector((sx * 0.0120, Y(py), Z(sp[0] + (sp[1] - sp[0]) * frac))))
        if len(pts) > 3:
            sweep(mag, catmull(pts, 16), lambda s_: 0.0011, "magm", sides=6, uv=False)
mag.finish(bevel=0.0003)

# ---- flash hider: a slotted birdcage
fh = Part("M2_Hider")
lathe(fh, [(Z(1212), 0.0), (Z(1212), 0.0105), (Z(1272), 0.0105), (Z(1276), 0.0092), (Z(1276), 0.0)], "steel", segs=24)
for k in range(5):
    a = TAU * k / 6 + TAU / 4
    rad = Vector((math.cos(a), math.sin(a), 0))
    c = Vector((0, 0, Z(1250))) + rad * 0.0105
    box(fh, c, (0.0030, 0.0012, R.m(34)), "dark", (Vector((-math.sin(a), math.cos(a), 0)), rad, Vector((0, 0, 1))))
fh.finish(bevel=0.0002)

# ---- irons: a flip-up aperture on the rail, a post at the front
REAR_Z, FRONT_Z = Z(523), Z(1040)
ir = Part("M2_IronRear")
box(ir, (0, RAIL_TOP + 0.004, REAR_Z), (0.024, 0.008, 0.022), "recv")
box(ir, (0, (RAIL_TOP + 0.008 + SIGHT_Y) / 2, REAR_Z), (0.016, SIGHT_Y - RAIL_TOP - 0.008, 0.004), "recv")
ring = [Vector((0.0040 * math.cos(TAU * i / 24), SIGHT_Y + 0.0040 * math.sin(TAU * i / 24), REAR_Z)) for i in range(25)]
sweep(ir, ring, lambda s: 0.0015, "recv", sides=8, uv=False)
for sx in (-1, 1):
    box(ir, (sx * 0.0085, SIGHT_Y - 0.002, REAR_Z), (0.004, 0.020, 0.006), "recv")
ir.finish(bevel=0.0002)
fs = Part("M2_IronFront")
box(fs, (0, RAIL_TOP + 0.004, FRONT_Z), (0.022, 0.008, 0.016), "recv")
for sx in (-1, 1):
    box(fs, (sx * 0.0062, (RAIL_TOP + SIGHT_Y) / 2 + 0.002, FRONT_Z), (0.0022, SIGHT_Y - RAIL_TOP - 0.002, 0.010), "recv")
box(fs, (0, (RAIL_TOP + SIGHT_Y) / 2, FRONT_Z), (0.0026, SIGHT_Y - RAIL_TOP, 0.0030), "steel")
local_lathe(fs, (0, SIGHT_Y - 0.0016, FRONT_Z + 0.0016), (0, 0, 1), [(0, 0.0010), (0.0004, 0.0010), (0.0005, 0.0)], "dot", segs=10)
fs.finish(bevel=0.0002)

# ------------------------------------------------------------------ anchors
empty("M2_Grip", tuple(R.P(480, 300)))
empty("M2_Support", tuple(R.P(900, 131)))
empty("M2_Muzzle", tuple(R.P(1276, 180)))
empty("M2_Aim", (0, SIGHT_Y, REAR_Z))
empty("M2_Under", tuple(R.P(900, 214)))
empty("M2_Rail", tuple(R.P(680, 128)))

gk.export(OUT_GLB, "M2")

if RENDER:
    gk.render_views(os.environ.get("M2_RENDER_DIR", os.path.join(OUT_DIR, "_renders")), {
        "m27-right": ((1.35, 0.0, -0.1), (0, -0.03, -0.1), 50),
        "m27-34": ((0.55, 0.28, 0.45), (0, -0.03, -0.12), 50),
        "m27-fp": ((-0.05, 0.08, 0.38), (0.0, 0.0, -0.25), 40),
    }, "M2")
