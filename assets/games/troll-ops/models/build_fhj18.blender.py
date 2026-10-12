"""
FHJ-18 AA, the detailed model (weapons.js id `fhj18`, FHJ18.md).

    blender --background --python build_fhj18.blender.py            # export .glb
    blender --background --python build_fhj18.blender.py -- render  # + studio renders

Black Ops 2's anti-air launcher, traced off its side-on model render
(refs/fhj18/fhj18-ready-side.webp, the left side, nose to the left; 1890 px
nose to tail = 1.45 m): the fat seeker cap with its glass dome up front and a
ribbed collar behind it, the octagonal middle tube with two green tape bands
and a leather shoulder pad, the long thin rear tube ending in a flared rim
with lugs; under it the battery box at the front, the trigger housing and
raked pistol grip, and the angular cheek fairing; on the left side the
sight unit with its flip-up frame and little glass reflector on top.

Nodes the game reads (weapon-model.js buildDetailed):
  FJ_Body       everything that never moves
  FJ_Mag        the battery box (pivot = its top centre): the reload swaps it
  FJ_Grip / FJ_Support / FJ_Muzzle / FJ_Aim / FJ_Under / FJ_Rail   empties
"""
import os
import sys
import math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gunkit as gk
from gunkit import (Part, Vector, TAU, material, lathe, box, loft, rrect, sweep, catmull, path_loft, on_cyl, empty)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_GLB = os.path.join(OUT_DIR, "fhj18.glb")
RENDER = "render" in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])

gk.M.update({
    "tube":    material("FJ_Tube", 0x1f2226, 0.55, 0.45),
    "cap":     material("FJ_Cap", 0x262a2f, 0.45, 0.5),
    "rear":    material("FJ_Rear", 0x141517, 0.7, 0.2),
    "dark":    material("FJ_Dark", 0x0b0c0d, 0.6, 0.2),
    "box":     material("FJ_Box", 0x1d2023, 0.6, 0.3),
    "body":    material("FJ_Body", 0x1a1d20, 0.55, 0.35),
    "poly":    material("FJ_Polymer", 0x18191b, 0.8, 0.0),
    "tape":    material("FJ_Tape", 0x1d2618, 0.85, 0.0),
    "leather": material("FJ_Leather", 0x40240f, 0.9, 0.0),
    "glass":   material("FJ_Seeker", 0xe2e8ee, 0.08, 0.9),
    "lens":    material("FJ_Lens", 0xa8c2d0, 0.05, 0.0, alpha=0.55),
    "steel":   material("FJ_Steel", 0x45484c, 0.35, 0.9),
})

# The trace: image px -> metres. z runs nose (-) to tail (+); the origin is
# the top of the grip; the tube's axis is y 0.
S = 0.000767
PX0, PY0 = 690, 893
def Z(px): return (px - PX0) * S
def Y(py): return (PY0 - py) * S

R_NOSE, R_COLLAR, R_MID, R_REAR, R_FLARE = 0.0817, 0.0845, 0.074, 0.052, 0.073
MID_TOP, MID_BOT = R_MID, -R_MID

body = Part("FJ_Body")

# ---- the seeker cap: a fat drum with rounded lips and two shallow grooves,
# the glass dome in its face
lathe(body, [(Z(262), 0.0), (Z(262), 0.074), (Z(250), 0.0800), (Z(232), R_NOSE), (Z(205), R_NOSE),
             (Z(201), 0.0808), (Z(193), 0.0808), (Z(189), R_NOSE), (Z(148), R_NOSE), (Z(144), 0.0808),
             (Z(136), 0.0808), (Z(132), R_NOSE), (Z(90), 0.0815), (Z(64), 0.0770), (Z(45), 0.0680),
             (Z(32), 0.0560), (Z(32), 0.0)], "cap", segs=56)
lathe(body, [(Z(33), 0.0), (Z(33), 0.050), (Z(25), 0.046), (Z(18), 0.036), (Z(14), 0.020), (Z(12), 0.0)],
      "glass", segs=40)
lathe(body, [(Z(36), 0.0), (Z(36), 0.0545), (Z(31), 0.0545), (Z(31), 0.0)], "dark", segs=40)   # the bezel

# ---- the ribbed collar
lathe(body, [(Z(422), 0.0), (Z(422), 0.0790), (Z(414), R_COLLAR), (Z(276), R_COLLAR), (Z(264), 0.0790),
             (Z(264), 0.0)], "tube", segs=56)
for k in range(44):              # the grille band of vertical ribs
    a = TAU * k / 44
    on_cyl(body, 0.0, (Z(378) + Z(412)) / 2, R_COLLAR, a, (0.0026, 0.0016, Z(412) - Z(378)), "dark", lift=0.0002)

# ---- the octagonal middle tube
mid = [rrect(z, R_MID, MID_TOP, MID_BOT, 0.030, n=4) for z in (Z(420), Z(424), Z(1330), Z(1336))]
mid[0] = rrect(Z(420), R_MID - 0.004, MID_TOP - 0.004, MID_BOT + 0.004, 0.028, n=4)
mid[-1] = rrect(Z(1336), R_MID - 0.004, MID_TOP - 0.004, MID_BOT + 0.004, 0.028, n=4)
loft(body, mid, "tube")
for px0, px1 in ((1172, 1212), (1240, 1268)):   # green tape bands
    loft(body, [rrect(Z(px0), R_MID + 0.0025, MID_TOP + 0.0025, MID_BOT - 0.0025, 0.031, n=4),
                rrect(Z(px1), R_MID + 0.0025, MID_TOP + 0.0025, MID_BOT - 0.0025, 0.031, n=4)], "tape")
# a seam and rivets along the side, a slot on the top
for sx in (-1, 1):
    box(body, (sx * (R_MID + 0.0004), -0.006, Z(900)), (0.0012, 0.003, Z(1320) - Z(480)), "dark")
    for px in (520, 700, 880, 1060, 1300):
        box(body, (sx * (R_MID + 0.0012), 0.020, Z(px)), (0.0024, 0.006, 0.006), "steel")
box(body, (0, MID_TOP + 0.0005, Z(1100)), (0.012, 0.0012, 0.070), "dark")

# ---- the leather shoulder pad (it rests on the right shoulder: +x)
for k in range(23):
    a = math.radians(-75 + k * 7.5)
    on_cyl(body, 0.0, Z(1090) + (k - 11) * 0.0028, R_MID + 0.002, a, (0.0110, 0.0060, 0.105), "leather", lift=0.0012)
box(body, (0.0, R_MID + 0.014, Z(1090) + 0.006), (0.020, 0.006, 0.012), "steel")   # its buckle, on top
box(body, (0.0, R_MID + 0.020, Z(1090) + 0.006), (0.006, 0.012, 0.022), "tape")    # and its tag

# ---- down to the rear tube, the rear tube, the flared rim with its lugs
lathe(body, [(Z(1366), 0.0), (Z(1366), R_REAR), (Z(1340), 0.064), (Z(1334), 0.0), ], "tube", segs=48)
lathe(body, [(Z(1668), 0.0), (Z(1668), R_REAR), (Z(1362), R_REAR), (Z(1362), 0.0)], "rear", segs=48)
lathe(body, [(Z(1892), 0.0, "dark"), (Z(1892), 0.050), (Z(1886), 0.060), (Z(1872), 0.069),
             (Z(1858), R_FLARE), (Z(1700), R_FLARE), (Z(1688), 0.066), (Z(1664), 0.056), (Z(1664), 0.0)],
     "tube", segs=56)
lathe(body, [(Z(1893), 0.0), (Z(1893), 0.044), (Z(1880), 0.044), (Z(1880), 0.0)], "dark", segs=40)   # the open end
for px in (1712, 1800):          # lugs on top of the rim
    box(body, (0, R_FLARE + 0.006, Z(px)), (0.022, 0.012, 0.030), "tube")
    box(body, (0, R_FLARE + 0.013, Z(px)), (0.026, 0.004, 0.034), "tube")
box(body, (0, MID_TOP + 0.005, Z(470)), (0.020, 0.010, 0.024), "tube")       # front sling lug
box(body, (0, -R_REAR - 0.006, Z(1640)), (0.010, 0.012, 0.016), "steel")     # rear sling loop

# ---- the trigger housing, trigger and guard, the raked grip
loft(body, [rrect(Z(600), 0.030, -0.055, Y(1052), 0.006), rrect(Z(800), 0.030, -0.055, Y(1052), 0.006)], "body")
tg = catmull([(0, Y(1052), Z(618)), (0, Y(1052) - 0.030, Z(626)), (0, Y(1052) - 0.036, Z(670)),
              (0, Y(1052) - 0.020, Z(700))], 16)
sweep(body, tg, lambda s: 0.0040, "body", sides=8, uv=False)
tr = catmull([(0, Y(1052), Z(662)), (0, Y(1052) - 0.016, Z(664)), (0, Y(1052) - 0.026, Z(672))], 8)
sweep(body, tr, lambda s: 0.0030, "steel", sides=6, uv=False)
GRIP_TOP = Vector((0, Y(1052), Z(712)))
GRIP_END = Vector((0, Y(1262), Z(792)))
GRIP_AX = (GRIP_END - GRIP_TOP).normalized()
GLEN = (GRIP_END - GRIP_TOP).length
path_loft(body, [GRIP_TOP + GRIP_AX * (GLEN * k / 10) for k in range(11)],
          lambda t: (0.0150 + 0.0012 * math.sin(math.pi * t), 0.0215 + 0.0020 * math.sin(math.pi * t), 0.0075), "poly")
for k in range(7):               # the grip's texture
    box(body, GRIP_TOP + GRIP_AX * (0.040 + k * 0.022) + Vector((0, 0, 0.0215)), (0.024, 0.0018, 0.005), "dark")

# ---- the cheek fairing under the middle
fair = []
for px, bot in ((786, Y(1100)), (842, Y(1152)), (1000, Y(1152)), (1084, Y(1062)), (1096, -0.064)):
    fair.append(rrect(Z(px), 0.040, -0.050, bot, 0.008))
loft(body, fair, "body")
for sx in (-1, 1):               # its recessed panel and screws
    box(body, (sx * 0.0405, Y(1105), Z(915)), (0.0012, 0.040, 0.110), "dark")
    for px, py in ((852, 1060), (980, 1060), (930, 1135)):
        box(body, (sx * 0.0412, Y(py), Z(px)), (0.0022, 0.005, 0.005), "steel")

# ---- the battery box's mount under the front
loft(body, [rrect(Z(270), 0.034, -0.060, -0.072, 0.004), rrect(Z(596), 0.034, -0.060, -0.072, 0.004)], "body")

# ---- the sight unit on the left side, its flip-up frame and glass
SX = -(R_MID + 0.028)            # its centre, out on the left
box(body, (SX, Y(800), (Z(470) + Z(790)) / 2), (0.056, Y(708) - Y(892), Z(790) - Z(470)), "box")
box(body, (SX, Y(800) + 0.002, (Z(470) + Z(790)) / 2), (0.058, Y(708) - Y(892) - 0.016, Z(790) - Z(470) - 0.016), "box")
box(body, (SX + 0.012, Y(708) + 0.006, Z(560)), (0.026, 0.012, 0.090), "box")          # the housing's top hump
for k in range(9):               # the vent grille, lower rear
    box(body, (SX - 0.0292, Y(860), Z(640) + k * 0.0075), (0.0012, 0.018, 0.0040), "dark")
box(body, (SX - 0.0292, Y(760), Z(560)), (0.0012, 0.032, 0.050), "dark")                 # the panel
box(body, (SX - 0.0296, Y(760), Z(560)), (0.0008, 0.006, 0.006), "glass")                # its little lamp
FT = Y(640)                      # the frame's top
for dx in (-0.020, 0.020):       # the frame's two rails, legs down to the housing
    rail = catmull([(SX + dx, Y(706), Z(452)), (SX + dx, FT, Z(478)), (SX + dx, FT, Z(840)), (SX + dx, Y(690), Z(862))], 20)
    sweep(body, rail, lambda s: 0.0052, "box", sides=6, uv=False)
for px in (480, 838):            # its cross bars
    box(body, (SX, FT, Z(px)), (0.044, 0.006, 0.008), "box")
box(body, (SX, FT + 0.004, Z(650)), (0.050, 0.007, 0.200), "box")                         # the top plate
for k in range(8):               # its ribs
    box(body, (SX, FT + 0.0085, Z(560) + k * 0.018), (0.040, 0.002, 0.006), "dark")
box(body, (SX, Y(660), Z(852)), (0.032, 0.036, 0.010), "box")                             # the rear peep
lathe(body, [(Z(858), 0.0), (Z(858), 0.0055), (Z(845), 0.0055), (Z(845), 0.0)], "dark", segs=14, cx=SX, cy=Y(660))
box(body, (SX, Y(735), Z(820)), (0.040, 0.046, 0.003), "lens")                            # the reflector glass
box(body, (SX, Y(708), Z(820)), (0.042, 0.004, 0.006), "box")

body.finish(bevel=0.0010)

# ---- the battery box (the reload swaps it)
B_TOP, B_BOT = -0.072, Y(1172)
B_Z0, B_Z1 = Z(266), Z(598)
mag = Part("FJ_Mag", pivot=(0, B_TOP, (B_Z0 + B_Z1) / 2))
loft(mag, [rrect(B_Z1, 0.042, B_TOP, B_BOT + 0.020, 0.006), rrect(Z(330), 0.042, B_TOP, B_BOT + 0.020, 0.006),
           rrect(Z(326), 0.045, B_TOP, B_BOT, 0.006), rrect(B_Z0, 0.045, B_TOP, B_BOT, 0.006)], "box")
for sx in (-1, 1):
    for px in (360, 440, 520):   # panel lines
        box(mag, (sx * 0.0423, (B_TOP + B_BOT) / 2 + 0.010, Z(px)), (0.0012, 0.090, 0.0020), "dark")
    box(mag, (sx * 0.0425, B_BOT + 0.045, Z(470)), (0.0012, 0.022, 0.070), "dark")    # the label plate
    box(mag, (sx * 0.0455, B_BOT + 0.030, Z(296)), (0.0012, 0.030, 0.034), "steel")   # the latch
box(mag, (0, B_BOT + 0.010, Z(470)), (0.070, 0.006, 0.180), "dark")                   # its foot
mag.finish(bevel=0.0010)

# ------------------------------------------------------------------ anchors
empty("FJ_Grip", tuple(GRIP_TOP + GRIP_AX * 0.050))
empty("FJ_Support", (0, -0.020, Z(450)))      # under the front of the tube: the arm code drops the hand 5 cm
empty("FJ_Muzzle", (0, 0, Z(12)))
empty("FJ_Aim", (SX, Y(700), Z(830)))         # through the frame, at the glass
empty("FJ_Under", (0, -0.080, Z(420)))
empty("FJ_Rail", (SX, FT, Z(650)))

gk.export(OUT_GLB, "FJ")

if RENDER:
    mz = (Z(14) + Z(1892)) / 2
    gk.render_views(os.environ.get("FJ_RENDER_DIR", os.path.join(OUT_DIR, "_renders")), {
        "fhj18-left": ((-2.4, -0.02, mz), (0, -0.02, mz), 42),
        "fhj18-right": ((2.4, -0.02, mz), (0, -0.02, mz), 42),
        "fhj18-34": ((-1.1, 0.55, -0.9), (0, -0.02, mz - 0.1), 40),
    }, "FJ")
