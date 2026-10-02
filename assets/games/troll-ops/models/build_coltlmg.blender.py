"""
Colt LMG, the detailed first-person model (weapons.js id `coltlmg`).

    blender --background --python build_coltlmg.blender.py            # export .glb
    blender --background --python build_coltlmg.blender.py -- render  # + studio renders

The M16-pattern light machine gun: a flattop upper with a full-length rail,
forward assist and brass deflector, a long square ribbed handguard over a
heavy barrel, the A2 triangle front sight, a birdcage flash hider, the A2
pistol grip and fixed stock, and a 100-round drum on a short neck.

Nodes the game reads (weapon-model.js buildDetailed):
  CL_Body       everything that never moves
  CL_Mag        neck + drum (pivot = its top centre, the mag point)
  CL_Hider      flash hider (hidden when a barrel attachment goes on)
  CL_IronRear / CL_IronFront   flip-up rear aperture + A2 post (hidden under an optic)
  CL_Grip / CL_Support / CL_Muzzle / CL_Aim / CL_Under / CL_Rail   empties
"""
import os
import sys
import math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gunkit as gk
from gunkit import (Part, Vector, TAU, material, lathe, box, loft, rrect, local_lathe, sweep,
                    catmull, path_loft, empty)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_GLB = os.path.join(OUT_DIR, "coltlmg.glb")
RENDER = "render" in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])

gk.M.update({
    "recv":   material("CL_Receiver", 0x2a2c2e, 0.45, 0.6),
    "poly":   material("CL_Polymer", 0x1a1b1c, 0.75, 0.0),
    "steel":  material("CL_Steel", 0x3a3d40, 0.32, 0.9),
    "dark":   material("CL_Dark", 0x0c0d0e, 0.6, 0.3),
    "drum":   material("CL_Drum", 0x24262a, 0.5, 0.5),
    "brass":  material("CL_Brass", 0xc09a4a, 0.3, 1.0),
    "dot":    material("CL_Dot", 0xffffff, 0.4, 0.0, 0xd8f0ff, 1.0),
})

X = Vector((1, 0, 0))
BORE_Y = 0.008
U_Z0, U_Z1 = 0.072, -0.168       # upper receiver rear / front
U_TOP, U_BOT, U_HW = 0.026, -0.006, 0.0150
L_TOP, L_BOT = -0.006, -0.040    # lower receiver
RAIL_TOP = 0.036
SIGHT_Y = 0.060
REAR_Z = 0.040
FRONT_Z = -0.470
MUZZLE_Z = -0.600
GRIP_TOP = Vector((0, -0.036, 0.028))
GRIP_AX = Vector((0, -0.93, 0.36)).normalized()
MAG_TOP = Vector((0, -0.040, -0.085))
HG0, HG1 = U_Z1 - 0.004, -0.420


def rail(P, z0, z1, y_base, hw):
    """Picatinny: a spine with cross slots."""
    box(P, (0, y_base + 0.004, (z0 + z1) / 2), (hw * 2, 0.008, abs(z1 - z0)), "recv")
    box(P, (0, y_base + 0.0085, (z0 + z1) / 2), (hw * 2 + 0.004, 0.003, abs(z1 - z0)), "recv")
    n = int(abs(z1 - z0) / 0.0052)
    for k in range(n):
        z = min(z0, z1) + 0.0026 + k * 0.0052
        box(P, (0, y_base + 0.0102, z), (hw * 2 + 0.0045, 0.0007, 0.0024), "dark")


body = Part("CL_Body")

# ---- upper receiver with the flattop rail, forward assist, deflector, port
loft(body, [rrect(U_Z0, U_HW - 0.002, U_TOP - 0.003, U_BOT, 0.004), rrect(U_Z0 - 0.004, U_HW, U_TOP, U_BOT, 0.004),
            rrect(U_Z1 + 0.004, U_HW, U_TOP, U_BOT, 0.004), rrect(U_Z1, U_HW - 0.003, U_TOP - 0.004, U_BOT, 0.004)], "recv")
rail(body, U_Z0 - 0.004, U_Z1 + 0.004, U_TOP, 0.0105)
local_lathe(body, (U_HW - 0.002, 0.012, 0.030), (0.7, 0.3, 0.4), [(0, 0.0065), (0.016, 0.0065), (0.020, 0.0060), (0.020, 0.0)], "recv", segs=14)
box(body, (U_HW + 0.004, 0.006, 0.004), (0.008, 0.016, 0.012), "recv")                 # deflector
box(body, (U_HW + 0.0004, 0.010, -0.040), (0.0012, 0.014, 0.050), "dark")              # ejection port
box(body, (U_HW + 0.0010, 0.010, -0.040), (0.0010, 0.012, 0.048), "recv")              # dust cover
box(body, (0, U_TOP - 0.004, U_Z0 + 0.006), (0.018, 0.008, 0.016), "recv")              # charging handle
box(body, (0, U_TOP - 0.004, U_Z0 + 0.016), (0.034, 0.006, 0.006), "recv")
# ---- lower receiver and the flared magazine well
loft(body, [rrect(U_Z0 - 0.002, U_HW - 0.001, L_TOP, L_BOT, 0.004), rrect(-0.050, U_HW - 0.001, L_TOP, L_BOT, 0.004),
            rrect(-0.060, U_HW - 0.001, L_TOP, L_BOT - 0.010, 0.004), rrect(-0.120, U_HW - 0.001, L_TOP, L_BOT - 0.010, 0.004),
            rrect(-0.125, U_HW - 0.003, L_TOP, L_BOT - 0.006, 0.004)], "recv")
loft(body, [rrect(-0.058, 0.0160, L_BOT - 0.008, L_BOT - 0.016, 0.003), rrect(-0.122, 0.0160, L_BOT - 0.008, L_BOT - 0.016, 0.003)], "recv")
for z in (0.050, -0.010):        # pins
    for sx in (-1, 1):
        local_lathe(body, (sx * (U_HW - 0.001), L_BOT + 0.010, z), (sx, 0, 0), [(0, 0.0032), (0.0010, 0.0028), (0.0014, 0.0)], "steel", segs=10)
box(body, (U_HW, -0.020, -0.050), (0.004, 0.010, 0.010), "steel")                     # mag release
box(body, (-U_HW - 0.001, -0.016, 0.040), (0.003, 0.006, 0.018), "steel")             # selector
box(body, (-U_HW - 0.001, -0.024, -0.070), (0.003, 0.016, 0.026), "steel")             # bolt catch
# ---- trigger guard, trigger
tg = catmull([(0, L_BOT, 0.020), (0, L_BOT - 0.016, 0.014), (0, L_BOT - 0.020, -0.010), (0, L_BOT - 0.012, -0.040), (0, L_BOT - 0.002, -0.046)], 16)
sweep(body, tg, lambda s: 0.0028, "recv", sides=8, uv=False)
tr = catmull([(0, L_BOT, -0.004), (0, L_BOT - 0.010, -0.002), (0, L_BOT - 0.016, 0.004)], 8)
sweep(body, tr, lambda s: 0.0022, "steel", sides=6, uv=False)
# ---- A2 pistol grip with the finger nub
grip_path = [GRIP_TOP + GRIP_AX * (k * 0.0110) for k in range(11)]
path_loft(body, grip_path, lambda t: (0.0118 + 0.0015 * math.sin(math.pi * t), 0.0165 + 0.0025 * math.sin(math.pi * t), 0.006), "poly")
box(body, GRIP_TOP + GRIP_AX * 0.036 + Vector((0, 0, -0.0185)), (0.020, 0.010, 0.008), "poly")
for k in range(8):
    box(body, GRIP_TOP + GRIP_AX * (0.020 + k * 0.010) + Vector((0, 0, 0.018)), (0.020, 0.0015, 0.004), "dark")

# ---- barrel (heavy), A2 front sight base, gas block
lathe(body, [(U_Z1, 0.0), (U_Z1, 0.0130), (U_Z1 - 0.012, 0.0130), (U_Z1 - 0.014, 0.0112), (MUZZLE_Z + 0.002, 0.0108),
             (MUZZLE_Z + 0.002, 0.0)], "steel", segs=28, cy=BORE_Y)
box(body, (0, BORE_Y + 0.010, FRONT_Z), (0.022, 0.024, 0.022), "steel")                # sight base / gas block
box(body, (0, BORE_Y - 0.016, FRONT_Z), (0.010, 0.012, 0.018), "steel")               # bayonet lug
# ---- the long square handguard, ribbed, with a heat-shield slot row
secs = []
for k in range(10):
    t = k / 9
    zz = HG0 + (HG1 - HG0) * t
    secs.append(rrect(zz, 0.0225, BORE_Y + 0.020, BORE_Y - 0.024, 0.010))
loft(body, secs, "poly")
for k in range(14):             # ribs
    zz = HG0 - 0.012 - k * 0.0175
    for sx in (-1, 1):
        box(body, (sx * 0.0226, BORE_Y - 0.002, zz), (0.0020, 0.030, 0.006), "poly")
    box(body, (0, BORE_Y + 0.0202, zz), (0.030, 0.0020, 0.006), "poly")
for k in range(8):              # vents
    zz = HG0 - 0.025 - k * 0.028
    for sx in (-1, 1):
        box(body, (sx * 0.0228, BORE_Y + 0.009, zz), (0.0012, 0.006, 0.014), "dark")
loft(body, [rrect(HG0 + 0.004, 0.0240, BORE_Y + 0.022, BORE_Y - 0.026, 0.011), rrect(HG0 - 0.004, 0.0240, BORE_Y + 0.022, BORE_Y - 0.026, 0.011)], "recv")   # delta ring
loft(body, [rrect(HG1 + 0.002, 0.0235, BORE_Y + 0.021, BORE_Y - 0.025, 0.011), rrect(HG1 - 0.006, 0.0220, BORE_Y + 0.019, BORE_Y - 0.023, 0.010)], "recv")   # end cap
# carry strap loop under the handguard front
box(body, (0, BORE_Y - 0.030, HG1 + 0.020), (0.006, 0.010, 0.014), "steel")

# ---- A2 stock on the buffer
ST0, ST1 = U_Z0, 0.330


def st_top(t):
    return U_TOP - 0.006 - 0.004 * t


secs = []
for k in range(8):
    t = k / 7
    zz = ST0 + (ST1 - ST0) * t
    secs.append(rrect(zz, 0.0140 + 0.003 * t, st_top(t), -0.024 - 0.064 * t ** 1.1, 0.008))
loft(body, secs, "poly")
loft(body, [rrect(ST1, 0.0175, st_top(1.0), -0.089, 0.008), rrect(ST1 + 0.012, 0.0175, st_top(1.0) - 0.001, -0.088, 0.008)], "dark")   # butt plate
box(body, (0.0177, -0.040, ST1 + 0.006), (0.002, 0.020, 0.006), "steel")               # trap door
box(body, (0, -0.072, 0.240), (0.010, 0.004, 0.026), "steel")                          # sling swivel
body.finish(bevel=0.0003)

# ---- the drum: a short neck and a 100-round drum, axis across the gun
mag = Part("CL_Mag", pivot=tuple(MAG_TOP))
neck = [MAG_TOP + Vector((0, 0.004, 0)), MAG_TOP + Vector((0, -0.030, -0.004)), MAG_TOP + Vector((0, -0.055, -0.010))]
path_loft(mag, neck, lambda t: (0.0118, 0.0160, 0.003), "drum")
DC = MAG_TOP + Vector((0, -0.112, -0.004))
DR = 0.068
for sx in (-1, 1):
    # each half: a lathe across x, rim lip, then the face
    local_lathe(mag, DC, (sx, 0, 0), [(0.0, DR * 0.98), (0.004, DR), (0.020, DR), (0.024, DR * 0.95), (0.026, DR * 0.55, "dark"),
                                       (0.028, DR * 0.5), (0.030, 0.0)], "drum", segs=40)
    # winding key on each face
    local_lathe(mag, DC + Vector((sx * 0.029, 0, 0)), (sx, 0, 0), [(0, 0.012), (0.004, 0.011), (0.006, 0.0)], "steel", segs=16)
    box(mag, DC + Vector((sx * 0.035, 0, 0)), (0.006, 0.006, 0.030), "steel")
for k in range(12):     # stiffening ribs round the rim
    a = TAU * k / 12
    c = DC + Vector((0, math.sin(a) * (DR + 0.0008), math.cos(a) * (DR + 0.0008)))
    rad = Vector((0, math.sin(a), math.cos(a)))
    box(mag, c, (0.040, 0.003, 0.010), "dark", (X, rad, X.cross(rad)))
mag.finish(bevel=0.0003)

# ---- birdcage flash hider
fh = Part("CL_Hider")
lathe(fh, [(MUZZLE_Z + 0.006, 0.0), (MUZZLE_Z + 0.006, 0.0115), (MUZZLE_Z - 0.044, 0.0115), (MUZZLE_Z - 0.046, 0.0100),
           (MUZZLE_Z - 0.046, 0.0)], "steel", segs=24, cy=BORE_Y)
for k in range(5):
    a = TAU * k / 6 + TAU / 4
    rad = Vector((math.cos(a), math.sin(a), 0))
    c = Vector((0, BORE_Y, MUZZLE_Z - 0.026)) + rad * 0.0115
    box(fh, c, (0.0032, 0.0012, 0.026), "dark", (Vector((-math.sin(a), math.cos(a), 0)), rad, Vector((0, 0, 1))))
fh.finish(bevel=0.0002)

# ---- irons: a flip-up aperture on the rail, the A2 post on the base
ir = Part("CL_IronRear")
box(ir, (0, RAIL_TOP + 0.004, REAR_Z), (0.024, 0.008, 0.024), "recv")
box(ir, (0, (RAIL_TOP + 0.008 + SIGHT_Y) / 2, REAR_Z), (0.016, SIGHT_Y - RAIL_TOP - 0.008, 0.004), "recv")
ring = [Vector((0.0042 * math.cos(TAU * i / 24), SIGHT_Y + 0.0042 * math.sin(TAU * i / 24), REAR_Z)) for i in range(25)]
sweep(ir, ring, lambda s: 0.0016, "recv", sides=8, uv=False)
for sx in (-1, 1):
    box(ir, (sx * 0.0085, SIGHT_Y - 0.002, REAR_Z), (0.004, 0.020, 0.006), "recv")
ir.finish(bevel=0.0002)
fs = Part("CL_IronFront")
fy0 = BORE_Y + 0.022
loft(fs, [[(sx * w, y, FRONT_Z + dz) for (sx, w, y) in ((1, 0.010, fy0), (1, 0.003, SIGHT_Y - 0.004), (-1, 0.003, SIGHT_Y - 0.004), (-1, 0.010, fy0))]
          for dz in (0.006, -0.006)], "steel")      # the triangle
box(fs, (0, SIGHT_Y - 0.003, FRONT_Z), (0.0024, 0.010, 0.0030), "steel")
for sx in (-1, 1):
    box(fs, (sx * 0.0060, SIGHT_Y - 0.002, FRONT_Z), (0.0018, 0.010, 0.010), "steel")
local_lathe(fs, (0, SIGHT_Y - 0.0016, FRONT_Z + 0.0016), (0, 0, 1), [(0, 0.0010), (0.0004, 0.0010), (0.0005, 0.0)], "dot", segs=10)
fs.finish(bevel=0.0002)

# ------------------------------------------------------------------ anchors
empty("CL_Grip", tuple(GRIP_TOP + GRIP_AX * 0.050))
empty("CL_Support", (0, BORE_Y - 0.022, -0.300))
empty("CL_Muzzle", (0, BORE_Y, MUZZLE_Z - 0.046))
empty("CL_Aim", (0, SIGHT_Y, REAR_Z))
empty("CL_Under", (0, BORE_Y - 0.026, -0.300))
empty("CL_Rail", (0, RAIL_TOP, -0.060))

gk.export(OUT_GLB, "CL")

if RENDER:
    gk.render_views(os.environ.get("CL_RENDER_DIR", os.path.join(OUT_DIR, "_renders")), {
        "colt-right": ((1.35, 0.06, -0.12), (0, -0.01, -0.12), 50),
        "colt-34": ((0.55, 0.30, 0.50), (0, -0.02, -0.14), 50),
        "colt-fp": ((-0.05, 0.10, 0.40), (0.0, 0.03, -0.25), 40),
    }, "CL")
