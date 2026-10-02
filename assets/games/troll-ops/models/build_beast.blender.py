"""
THE BEAST (weapons.js id `beast`).

    blender --background --python build_beast.blender.py            # export .glb
    blender --background --python build_beast.blender.py -- render  # + studio renders

Structure: a modern AK/AR hybrid (the user's reference, a two-tone tactical
rifle): flattop upper on an angular lower with a flared magwell, a long
faceted handguard that sweeps down into a blade under the barrel, a long
thin barrel to an A-frame front sight and a slotted flash hider, a raked
grip, a curved mag with windows, and a tactical stock on a buffer tube.

Style (Phantom Forces' modded "THE BEAST"): bone and ivory over dark
olive-steel. The handguard is the beast's head: glowing eyes either side
of its front, a brow ridge, and teeth along the blade edge. A mane of bone
and crystal spikes splays off both sides of the upper round a glowing blue
core; glowing veins crack the flanks; talons curl off the grip; teeth run
the stock's comb. Nothing rises into the sight line over the rail.

Nodes the game reads (weapon-model.js buildDetailed):
  BE_Body       everything that never moves
  BE_Mag        the curved magazine (pivot = its top centre, the mag point)
  BE_Brake      flash hider (hidden when a barrel attachment goes on)
  BE_IronRear / BE_IronFront   flip-up aperture + front post (hidden under an optic)
  BE_Grip / BE_Support / BE_Muzzle / BE_Aim / BE_Under / BE_Rail   empties
"""
import os
import sys
import math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gunkit as gk
from gunkit import (Part, Vector, TAU, material, lathe, box, loft, rrect, local_lathe, sweep,
                    catmull, path_loft, spike, empty)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_GLB = os.path.join(OUT_DIR, "beast.glb")
RENDER = "render" in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])

gk.M.update({
    "bone":   material("BE_Bone", 0xe2d8bc, 0.55, 0.0),
    "boneD":  material("BE_BoneDark", 0xa89a78, 0.65, 0.0),
    "ivory":  material("BE_Ivory", 0xf6f2e8, 0.3, 0.0),
    "steel":  material("BE_Steel", 0x2c322b, 0.4, 0.7),
    "dark":   material("BE_Dark", 0x0f110f, 0.6, 0.3),
    "core":   material("BE_Core", 0x8fe6ff, 0.2, 0.0, 0x48c8ff, 6.0),
    "vein":   material("BE_Vein", 0x5fd0ff, 0.3, 0.0, 0x2fb4ff, 3.0),
})

X = Vector((1, 0, 0))
BORE_Y = 0.012
U_Z0, U_Z1 = 0.075, -0.165          # upper receiver rear / front
U_TOP, U_BOT, U_HW = 0.027, -0.004, 0.0155
L_TOP, L_BOT = -0.004, -0.040       # lower receiver
RAIL_TOP = 0.0375
SIGHT_Y = 0.062
REAR_Z = 0.048
HG0, HG1 = U_Z1 - 0.002, -0.334     # handguard rear / front (the head goes on from there)
FRONT_Z = -0.506
MUZZLE_Z = -0.600
GRIP_TOP = Vector((0, -0.036, 0.028))
GRIP_AX = Vector((0, -0.93, 0.37)).normalized()
MAG_TOP = Vector((0, -0.044, -0.092))


def strip(P, x, z0, y0, z1, y1, key, w=0.0026, t=0.0012):
    """A thin flat strip on a flank at x from (z0, y0) to (z1, y1)."""
    a, b = Vector((0, y0, z0)), Vector((0, y1, z1))
    ez = (b - a).normalized()
    ey = ez.cross(X).normalized()
    box(P, (a + b) / 2 + Vector((x, 0, 0)), (t, w, (b - a).length), key, (X, ey, ez))


def rail(P, z0, z1, y_base, hw):
    """Picatinny: a spine with cross slots."""
    box(P, (0, y_base + 0.0035, (z0 + z1) / 2), (hw * 2, 0.007, abs(z1 - z0)), "steel")
    box(P, (0, y_base + 0.0080, (z0 + z1) / 2), (hw * 2 + 0.004, 0.003, abs(z1 - z0)), "steel")
    for k in range(int(abs(z1 - z0) / 0.0052)):
        box(P, (0, y_base + 0.0097, min(z0, z1) + 0.0026 + k * 0.0052), (hw * 2 + 0.0045, 0.0008, 0.0024), "dark")


body = Part("BE_Body")

# ---- upper receiver, flattop rail, forward assist, port
loft(body, [rrect(U_Z0, U_HW - 0.002, U_TOP - 0.003, U_BOT, 0.003), rrect(U_Z0 - 0.004, U_HW, U_TOP, U_BOT, 0.003),
            rrect(U_Z1 + 0.004, U_HW, U_TOP, U_BOT, 0.003), rrect(U_Z1, U_HW - 0.002, U_TOP - 0.003, U_BOT, 0.003)], "bone")
rail(body, U_Z0 - 0.004, HG1 + 0.012, U_TOP, 0.0100)
local_lathe(body, (U_HW - 0.002, 0.013, 0.032), (0.7, 0.3, 0.4), [(0, 0.0062), (0.015, 0.0062), (0.019, 0.0056), (0.019, 0.0)], "steel", segs=14)
box(body, (U_HW + 0.0006, 0.011, -0.040), (0.0014, 0.014, 0.052), "dark")          # ejection port
box(body, (0, U_TOP - 0.004, U_Z0 + 0.008), (0.018, 0.008, 0.018), "steel")         # charging handle
box(body, (0, U_TOP - 0.004, U_Z0 + 0.018), (0.034, 0.006, 0.006), "steel")
# ---- angular lower with the flared magwell (its front face raked forward)
loft(body, [rrect(U_Z0 - 0.002, U_HW - 0.001, L_TOP, L_BOT, 0.003), rrect(-0.052, U_HW - 0.001, L_TOP, L_BOT, 0.003),
            rrect(-0.060, U_HW + 0.001, L_TOP, L_BOT - 0.012, 0.003), rrect(-0.124, U_HW + 0.001, L_TOP, L_BOT - 0.012, 0.003),
            rrect(-0.140, U_HW - 0.002, L_TOP, L_BOT - 0.002, 0.003), rrect(-0.146, U_HW - 0.004, L_TOP, L_TOP - 0.012, 0.003)], "bone")
box(body, (U_HW, -0.022, -0.050), (0.004, 0.010, 0.010), "steel")                  # mag release
box(body, (-U_HW - 0.001, -0.016, 0.040), (0.003, 0.006, 0.018), "steel")          # selector
for z in (0.052, -0.010):
    for sx in (-1, 1):
        local_lathe(body, (sx * (U_HW - 0.001), L_BOT + 0.010, z), (sx, 0, 0), [(0, 0.0030), (0.0010, 0.0026), (0.0014, 0.0)], "steel", segs=10)
# ---- trigger guard (angular) and trigger
tg = [Vector(p) for p in ((0, L_BOT, 0.022), (0, L_BOT - 0.018, 0.016), (0, L_BOT - 0.018, -0.030), (0, L_BOT - 0.004, -0.050))]
sweep(body, catmull(tg, 14), lambda s: 0.0026, "steel", sides=4, uv=False)
sweep(body, catmull([(0, L_BOT, -0.004), (0, L_BOT - 0.010, -0.002), (0, L_BOT - 0.016, 0.004)], 8), lambda s: 0.0022, "steel", sides=6, uv=False)
# ---- raked grip with a beavertail, finger flutes, talons off the base
grip_path = [GRIP_TOP + GRIP_AX * (k * 0.0112) for k in range(11)]
path_loft(body, grip_path, lambda t: (0.0118 + 0.0016 * math.sin(math.pi * t), 0.0170 + 0.0020 * math.sin(math.pi * t), 0.004), "bone")
box(body, GRIP_TOP + Vector((0, 0.006, 0.026)), (0.022, 0.010, 0.020), "bone")      # beavertail
for k in range(3):
    box(body, GRIP_TOP + GRIP_AX * (0.032 + k * 0.024) + Vector((0, 0, -0.0185)), (0.022, 0.007, 0.005), "boneD")
gb = GRIP_TOP + GRIP_AX * 0.112
box(body, gb, (0.026, 0.006, 0.040), "steel")
for sx in (-0.008, 0.0, 0.008):
    tal = catmull([gb + Vector((sx, 0.002, -0.014)), gb + Vector((sx * 1.3, -0.008, -0.026)), gb + Vector((sx * 1.4, -0.006, -0.040)),
                   gb + Vector((sx * 1.4, 0.004, -0.048))], 12)
    sweep(body, tal, lambda t: 0.0040 * (1 - t) + 0.0004, "ivory", sides=7, uv=False)

# ---- the long faceted handguard, deep at the back and sweeping up into a
# blade under the barrel, vents down its flanks, teeth along the blade
def hg_sec(t):
    z = HG0 + (HG1 - HG0) * t
    hw = 0.0215 - 0.0020 * t
    top = U_TOP - 0.0005          # flush under the rail
    bot = BORE_Y - 0.044 + 0.020 * t ** 0.8       # the blade rises toward the head
    return rrect(z, hw, top, bot, 0.0035, n=2)


loft(body, [hg_sec(k / 10) for k in range(11)], "bone")
for sx in (-1, 1):
    for k in range(3):
        z0 = HG0 - 0.022 - k * 0.048
        strip(body, sx * 0.0210, z0, BORE_Y - 0.004, z0 - 0.032, BORE_Y + 0.003, "dark", w=0.004)
    strip(body, sx * 0.0212, -0.320, BORE_Y + 0.002, -0.250, BORE_Y - 0.004, "vein", w=0.0022)
    strip(body, sx * 0.0214, -0.250, BORE_Y - 0.004, -0.190, BORE_Y + 0.001, "vein", w=0.0018)
for k in range(7):
    t = 0.2 + k * 0.12
    z = HG0 + (HG1 - HG0) * t
    bot = BORE_Y - 0.044 + 0.020 * t ** 0.8
    for sx in (-1, 1):
        spike(body, (sx * 0.010, bot + 0.002, z), (sx * 0.15, -1, -0.25), 0.006 + 0.005 * t, 0.0021, "ivory", sides=4)

# ---- THE HEAD on the front: a faceted beast's head, the barrel out of its
# open jaws. Brow and cheeks wider than the handguard, big glowing eyes
# under angry brow ridges, horns swept back past the cheeks, fangs.
HEAD = [  # (z, half width, top, bottom of the upper head)
    (HG1 + 0.002, 0.0200, 0.0262, BORE_Y - 0.020),
    (-0.344, 0.0262, 0.0420, 0.0150),
    (-0.366, 0.0272, 0.0445, 0.0180),
    (-0.390, 0.0236, 0.0410, 0.0205),
    (-0.418, 0.0188, 0.0360, 0.0212),
    (-0.446, 0.0150, 0.0318, 0.0214),
    (-0.466, 0.0110, 0.0290, 0.0218),
    (-0.476, 0.0062, 0.0262, 0.0226),
]
loft(body, [rrect(z, hw, top, bot, 0.004, n=2) for (z, hw, top, bot) in HEAD], "bone")
JAW = [  # the lower jaw, hinged under the cheeks, hanging open
    (-0.334, 0.0195, 0.0040, BORE_Y - 0.036),
    (-0.360, 0.0190, 0.0030, -0.0230),
    (-0.396, 0.0160, 0.0012, -0.0180),
    (-0.430, 0.0128, 0.0008, -0.0120),
    (-0.456, 0.0094, 0.0010, -0.0070),
    (-0.466, 0.0060, 0.0012, -0.0040),
]
loft(body, [rrect(z, hw, top, bot, 0.004, n=2) for (z, hw, top, bot) in JAW], "bone")
box(body, (0, 0.0115, -0.350), (0.030, 0.024, 0.020), "dark")                     # the throat
box(body, (0, 0.0040, -0.405), (0.020, 0.0030, 0.090), "dark")                    # tongue/palate shadow
# the bridge of the nose and the nostrils
box(body, (0, 0.0325, -0.432), (0.010, 0.006, 0.070), "boneD")
for sx in (-1, 1):
    box(body, (sx * 0.0040, 0.0275, -0.4745), (0.0030, 0.0030, 0.0040), "dark")
for sx in (-1, 1):
    # angry brow ridge, slanting down toward the snout over the eye
    a, b = Vector((sx * 0.0255, 0.0465, -0.354)), Vector((sx * 0.0150, 0.0395, -0.398))
    ez = (b - a).normalized()
    ey = ez.cross(X).normalized()
    box(body, (a + b) / 2, (0.010, 0.0055, (b - a).length), "boneD", (X, ey, ez))
    # cheekbone ridge and the jaw hinge
    box(body, (sx * 0.0270, 0.0220, -0.372), (0.0040, 0.0070, 0.040), "boneD")
    local_lathe(body, (sx * 0.0190, 0.0030, -0.346), (sx, 0, 0), [(0, 0.0080), (0.0030, 0.0070), (0.0040, 0.0)], "boneD", segs=10)
    # the eye: a deep dark socket, a big glowing eye, a slit pupil
    eye_c = Vector((sx * 0.0236, 0.0335, -0.382))
    eye_n = Vector((sx * 0.88, 0.18, -0.44))
    local_lathe(body, eye_c, eye_n, [(-0.003, 0.0105), (0.0008, 0.0100), (0.0012, 0.0)], "dark", segs=16)
    local_lathe(body, eye_c + eye_n.normalized() * 0.0002, eye_n, [(-0.002, 0.0078), (0.0020, 0.0074), (0.0042, 0.0)], "core", segs=14)
    box(body, eye_c + eye_n.normalized() * 0.0045, (0.0014, 0.0090, 0.0016), "dark", (eye_n.normalized(), Vector((0, 1, 0)), eye_n.normalized().cross(Vector((0, 1, 0)))))
    # horns: off the back of the brow, swept back and out, then up
    horn = catmull([(sx * 0.0200, 0.0410, -0.346), (sx * 0.0360, 0.0480, -0.322), (sx * 0.0500, 0.0590, -0.292),
                    (sx * 0.0580, 0.0740, -0.262), (sx * 0.0590, 0.0880, -0.240)], 18)
    sweep(body, horn, lambda t: 0.0072 * (1 - t) ** 0.9 + 0.0004, "ivory", sides=8, uv=False)
    # cheek spikes swept back under the horns
    spike(body, (sx * 0.0270, 0.0260, -0.348), (sx * 0.7, 0.2, 0.7), 0.022, 0.0040, "ivory", sides=4)
    spike(body, (sx * 0.0255, 0.0140, -0.356), (sx * 0.7, -0.1, 0.7), 0.016, 0.0034, "ivory", sides=4)
    # fangs: big canines at the front, a row of teeth back along both jaws
    spike(body, (sx * 0.0078, 0.0222, -0.462), (0, -1, -0.12), 0.0175, 0.0030, "ivory", sides=5)
    spike(body, (sx * 0.0070, 0.0010, -0.452), (0, 1, -0.15), 0.0120, 0.0026, "ivory", sides=5)
    for k in range(5):
        zz = -0.446 + k * 0.016
        spike(body, (sx * (0.0128 + k * 0.0020), 0.0212, zz), (sx * 0.1, -1, 0), 0.0075, 0.0019, "ivory", sides=4)
        spike(body, (sx * (0.0108 + k * 0.0020), 0.0012, zz + 0.008), (sx * 0.1, 1, 0), 0.0060, 0.0017, "ivory", sides=4)

# ---- barrel (bone, long and thin), A-frame front sight, dark muzzle section
lathe(body, [(HG1 + 0.004, 0.0), (HG1 + 0.004, 0.0088), (-0.522, 0.0086), (-0.522, 0.0)], "bone", segs=24, cy=BORE_Y)
lathe(body, [(-0.522, 0.0), (-0.522, 0.0102), (MUZZLE_Z + 0.040, 0.0102), (MUZZLE_Z + 0.040, 0.0)], "steel", segs=24, cy=BORE_Y)
box(body, (0, BORE_Y + 0.004, FRONT_Z), (0.018, 0.024, 0.030), "steel")                 # gas block
for (z0, z1) in ((-0.492, -0.505), (-0.520, -0.513)):                                  # the A-frame legs
    sweep(body, [Vector((0, BORE_Y + 0.014, z0)), Vector((0, SIGHT_Y - 0.008, z1))], lambda s: 0.0032, "steel", sides=4, uv=False)
box(body, (0, SIGHT_Y - 0.007, -0.509), (0.008, 0.005, 0.014), "steel")
for sx in (-1, 1):
    box(body, (sx * 0.0065, SIGHT_Y - 0.004, -0.509), (0.0022, 0.012, 0.012), "steel")    # post ears

# ---- the mane: bone and crystal spikes splayed off both sides of the upper,
# tallest over the middle, swept back; a glowing core at its front
N = 9
for i in range(N):
    t = i / (N - 1)
    zz = -0.120 + 0.180 * t
    h = 0.024 + 0.030 * math.sin(math.pi * (0.15 + 0.8 * t))
    for sx in (-1, 1):
        spike(body, (sx * (U_HW - 0.001), U_TOP - 0.006, zz), (sx * 0.80, 0.50, 0.55 + 0.25 * t), h, 0.0068,
              "bone", sides=5, tip_key="ivory", spin=0.5 * i)
        if i < N - 1:
            spike(body, (sx * (U_HW + 0.001), 0.010, zz + 0.011), (sx * 0.95, 0.25, 0.5), h * 0.5, 0.0045, "ivory", sides=4, spin=0.2 * i)
for sx in (-1, 1):
    c = Vector((sx * (U_HW + 0.004), U_TOP - 0.004, -0.140))
    box(body, c + Vector((-sx * 0.004, -0.004, 0)), (0.004, 0.012, 0.028), "boneD")
    local_lathe(body, c, (sx * 0.7, 0.7, -0.2), [(-0.006, 0.0), (-0.004, 0.0090), (0.005, 0.0100), (0.017, 0.0)], "core", segs=6)
    spike(body, c + Vector((sx * 0.004, 0.004, 0.006)), (sx * 0.8, 0.6, 0.35), 0.034, 0.0060, "core", sides=5)
    # veins cracking the flanks of the upper and lower
    for seg in ((0.070, 0.006, 0.020, -0.002), (0.020, -0.002, -0.040, 0.004), (-0.040, 0.004, -0.120, -0.006),
                (0.040, -0.012, -0.010, -0.030), (-0.070, -0.020, -0.120, -0.034)):
        strip(body, sx * (U_HW + 0.0004), *seg, "vein")

# ---- buffer tube and the tactical stock (cheek riser, hollow lower, pad)
lathe(body, [(U_Z0, 0.0), (U_Z0, 0.0140), (0.300, 0.0140), (0.300, 0.0)], "steel", segs=20, cy=0.006)
ST0, ST1 = 0.165, 0.352
loft(body, [rrect(z, hw, top, bot, 0.004, n=2) for (z, hw, top, bot) in (
    (ST0, 0.0150, 0.022, -0.012), (ST0 + 0.030, 0.0160, 0.030, -0.016), (0.300, 0.0165, 0.031, -0.020), (ST1, 0.0168, 0.031, -0.024))], "bone")
# the lower arm of the stock, angled down to the heel, open between
sweep(body, [Vector((0, -0.016, ST0 + 0.040)), Vector((0, -0.044, 0.260)), Vector((0, -0.074, ST1 - 0.004))],
      lambda t: 0.0070, "bone", sides=4, uv=False)
box(body, (0, -0.074, ST1 - 0.010), (0.030, 0.012, 0.020), "bone")
loft(body, [rrect(ST1, 0.0185, 0.036, -0.086, 0.006, n=2), rrect(ST1 + 0.020, 0.0185, 0.036, -0.086, 0.006, n=2)], "steel")   # pad
for k in range(8):          # teeth along the comb
    zz = ST0 + 0.030 + k * 0.020
    spike(body, (0, 0.029, zz), (0, 1, 0.6), 0.010 + 0.004 * math.sin(math.pi * k / 7), 0.0035, "ivory", sides=4, spin=math.pi / 4)
for i, (zz, ln) in enumerate(((0.290, 0.034), (0.330, 0.040))):
    for sx in (-1, 1):
        spike(body, (sx * 0.012, 0.024, zz), (sx * 0.6, 0.65, 0.7), ln, 0.0052, "bone", sides=5, tip_key="ivory", spin=0.3 * i)
for sx in (-1, 1):
    strip(body, sx * 0.0170, ST0 + 0.040, 0.008, ST1 - 0.010, 0.000, "vein", w=0.0020)

body.finish(bevel=0.0003)

# ---- curved magazine with windows down both sides
mag = Part("BE_Mag", pivot=tuple(MAG_TOP))
mpath = catmull([MAG_TOP + Vector((0, 0.004, 0)), MAG_TOP + Vector((0, -0.080, -0.012)), MAG_TOP + Vector((0, -0.148, -0.058)),
                 MAG_TOP + Vector((0, -0.186, -0.094))], 14)
path_loft(mag, mpath, lambda t: (0.0128, 0.0175 + 0.002 * t, 0.003), "bone", n=2)
for k in (3, 5, 7, 9, 11):
    ez = (mpath[k + 1] - mpath[k - 1]).normalized()
    ey = ez.cross(X).normalized()
    for sx in (-1, 1):
        box(mag, mpath[k] + X * (sx * 0.0128), (0.0012, 0.020, 0.010), "dark", (X, ey, ez))
box(mag, mpath[-1] + Vector((0, -0.003, 0)), (0.029, 0.007, 0.042), "steel")
mag.finish(bevel=0.0003)

# ---- slotted flash hider (hidden under a barrel attachment)
br = Part("BE_Brake")
lathe(br, [(MUZZLE_Z + 0.042, 0.0), (MUZZLE_Z + 0.042, 0.0118), (MUZZLE_Z + 0.002, 0.0118), (MUZZLE_Z, 0.0104), (MUZZLE_Z, 0.0)],
      "steel", segs=24, cy=BORE_Y)
for k in range(4):
    a = TAU * k / 4 + TAU / 8
    rad = Vector((math.cos(a), math.sin(a), 0))
    box(br, Vector((0, BORE_Y, MUZZLE_Z + 0.016)) + rad * 0.0118, (0.0030, 0.0012, 0.022), "dark",
        (Vector((-math.sin(a), math.cos(a), 0)), rad, Vector((0, 0, 1))))
br.finish(bevel=0.0002)

# ---- irons: a flip-up aperture on the rail, the post in the A-frame
ir = Part("BE_IronRear")
box(ir, (0, RAIL_TOP + 0.004, REAR_Z), (0.022, 0.008, 0.022), "steel")
box(ir, (0, (RAIL_TOP + 0.008 + SIGHT_Y - 0.0058) / 2, REAR_Z), (0.015, SIGHT_Y - 0.0058 - RAIL_TOP - 0.008, 0.004), "steel")
ring = [Vector((0.0042 * math.cos(TAU * i / 24), SIGHT_Y + 0.0042 * math.sin(TAU * i / 24), REAR_Z)) for i in range(25)]
sweep(ir, ring, lambda s: 0.0016, "steel", sides=8, uv=False)
ir.finish(bevel=0.0002)
fs = Part("BE_IronFront")
box(fs, (0, SIGHT_Y - 0.003, -0.509), (0.0024, 0.010, 0.0030), "steel")
local_lathe(fs, (0, SIGHT_Y - 0.0016, -0.5074), (0, 0, 1), [(0, 0.0010), (0.0004, 0.0010), (0.0005, 0.0)], "core", segs=10)
fs.finish(bevel=0.0002)

# ------------------------------------------------------------------ anchors
empty("BE_Grip", tuple(GRIP_TOP + GRIP_AX * 0.050))
empty("BE_Support", (0, BORE_Y - 0.036, -0.270))
empty("BE_Muzzle", (0, BORE_Y, MUZZLE_Z))
empty("BE_Aim", (0, SIGHT_Y, REAR_Z))
empty("BE_Under", (0, BORE_Y - 0.040, -0.262))
empty("BE_Rail", (0, RAIL_TOP, -0.060))

gk.export(OUT_GLB, "BE")

if RENDER:
    gk.render_views(os.environ.get("BE_RENDER_DIR", os.path.join(OUT_DIR, "_renders")), {
        "beast-left": ((-1.35, 0.04, -0.10), (0, -0.01, -0.10), 50),
        "beast-34": ((-0.60, 0.30, -0.70), (0, 0.0, -0.20), 50),
        "beast-fp": ((-0.05, 0.10, 0.45), (0.0, 0.03, -0.25), 40),
        "beast-head": ((-0.32, 0.10, -0.62), (0.0, 0.02, -0.40), 50),
    }, "BE")
