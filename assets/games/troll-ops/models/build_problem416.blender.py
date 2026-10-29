"""
The Problem 416 (DESIGN-ARSENAL.md Phase 1 step 5, the AR recipe every
later rifle copies): an HK416-proportioned carbine on gunkit v2. OD
cerakote shell (upper, lower, handguard, stock) over a black anodized core
(buffer tube, forward assist, charging handle, catch), a parkerized barrel
and carrier, black polymer grip and waffle mag. The look is the user's
concept renders (refs/arms/problem416/NOTES.md); the anchors are the old
hand-built 416's (weapon-416.js), so the hands, sights and attachments land
where they always have.

    python build_problem416.blender.py --                 # (pip bpy) or blender --background --python ...
    ... -- bake                                           # bake_kit.bake_gun: problem416.glb, maps, LOD1
    ... -- bake render                                    # + check renders (PF_RENDER_DIR)

Game coordinates: x right, y up, -z toward the muzzle, metres; the bore on
y BORE, the grip near z 0.02.

Recipe layout, one function per assembly so the next AR (Snubgrin M4, M27)
can copy it and change numbers: upper(), lower(), handguard(), barrel(),
stock(), grip(), then the moving parts and the points.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gunkit as gk
from gunkit import (Part, lathe, sweep, catmull, empty, picatinny, section_body, chamfer_box, local_lathe,
                    slot_array, vent_slashes, panel_line, stipple, waffle, screw_set, moving, finish_v2, Vector)

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
BAKE = "bake" in ARGS
PFX = "PF"
OD = 0x4a5135

if BAKE:
    import bake_kit
    K = bake_kit.kit_material
    gk.M.update({
        "recv":   K("PF_Upper", "cerakote", OD),
        "lower":  K("PF_Lower", "cerakote", OD),
        "guard":  K("PF_Guard", "cerakote", OD),
        "stock":  K("PF_Stock", "polymer", 0x434a32, Wear=0.25),
        "core":   K("PF_Core", "anodized"),
        "poly":   K("PF_Polymer", "polymer"),
        "magm":   K("PF_MagBody", "polymer", 0x232322),
        "rubber": K("PF_Pad", "rubber"),
        "steel":  K("PF_Steel", "parkerized"),
        "dark":   K("PF_Dark", "parkerized", 0x101010, Wear=0.0, Metallic=0.0, Roughness=0.85),   # slots, sockets: matte
    })
else:
    gk.M.update({
        "recv": gk.material("PF_Upper", OD, 0.6), "lower": gk.material("PF_Lower", OD, 0.6),
        "guard": gk.material("PF_Guard", OD, 0.6), "stock": gk.material("PF_Stock", 0x434a32, 0.8),
        "core": gk.material("PF_Core", 0x1c1d1f, 0.42, 0.35), "poly": gk.material("PF_Polymer", 0x242424, 0.8),
        "magm": gk.material("PF_MagBody", 0x232322, 0.8), "rubber": gk.material("PF_Pad", 0x151515, 0.9),
        "steel": gk.material("PF_Steel", 0x2c2d2d, 0.55, 0.6), "dark": gk.material("PF_Dark", 0x121212, 0.6),
    })

R, L = Vector((1, 0, 0)), Vector((-1, 0, 0))
BORE = 0.008
# half-widths: the receiver steps in at the split line so it reads
HW_UP, HW_LO, HW_HG, HW_GRIP, HW_STOCK, HW_MAG = 0.0135, 0.0125, 0.0195, 0.0145, 0.0175, 0.0115
RAIL_Y, RAIL_TOP = 0.025, 0.035          # rail base and crown (the old 416's topY)
UP_Z = (0.072, -0.128)                   # upper receiver, rear to front
HG_Z = (-0.124, -0.432)                  # handguard
PORT = dict(z=-0.034, y=0.0085, len=0.056, h=0.017, depth=0.009)
MUZZLE_Z = -0.538


def box_outline(z, y0, y1):
    """A rectangular side outline a hair longer than the region it feeds
    (section_body samples the region's ends, which must fall inside)."""
    a, b = max(z) + 0.002, min(z) - 0.002
    return [(a, y0), (a, y1), (b, y1), (b, y0)]


def upper(P):
    # flat-topped, 45-degree chamfers, the port cut on the right
    section_body(P, box_outline(UP_Z, -0.004, RAIL_Y),
                 [dict(z=UP_Z, key="recv", hw=HW_UP, c=0.003, step=0.05)])
    P.cutters.append(gk._slot_solid((HW_UP, PORT["y"], PORT["z"]), (0, 0, 1), R, PORT["len"], PORT["h"], PORT["depth"], n=2))
    # forward assist behind the port, its housing, and the brass deflector
    chamfer_box(P, (HW_UP + 0.002, 0.011, 0.030), (0.006, 0.015, 0.018), 0.0015, "recv")
    local_lathe(P, (HW_UP + 0.004, 0.012, 0.030), (1, 0.3, 0),
                [(0, 0.0062), (0.008, 0.0062), (0.0095, 0.0052), (0.010, 0.0)], "core", segs=14)
    chamfer_box(P, (HW_UP + 0.0015, 0.017, 0.004), (0.004, 0.008, 0.012), 0.0012, "recv")
    panel_line(P, [(HW_UP, 0.021, 0.068), (HW_UP, 0.021, -0.124)], R)
    panel_line(P, [(-HW_UP, 0.021, 0.068), (-HW_UP, 0.021, -0.124)], L)


def lower(P):
    # its own section a step narrower than the upper (the split line), the
    # mag well hanging below, the trigger guard, the static selector
    section_body(P, [(0.072, -0.0045), (0.072, -0.016), (0.060, -0.026), (0.040, -0.032), (-0.036, -0.032),
                     (-0.040, -0.062), (-0.118, -0.062), (-0.125, -0.012), (-0.120, -0.0045)],
                 [dict(z=(0.070, -0.122), key="lower", hw=HW_LO, c=0.002, top=-0.0045, step=0.006)])
    chamfer_box(P, (0, -0.052, -0.012), (0.008, 0.004, 0.050), 0.0012, "lower")
    chamfer_box(P, (0, -0.042, 0.010), (0.008, 0.022, 0.005), 0.0012, "lower")
    # selector, left, set to auto (static: it never moves on a shot)
    local_lathe(P, (-HW_LO, -0.016, 0.034), L, [(0, 0.0045), (0.0015, 0.0045), (0.002, 0.0)], "core", segs=12)
    chamfer_box(P, (-HW_LO - 0.0018, -0.016, 0.026), (0.0022, 0.0045, 0.016), 0.0008, "core")
    # mag release, right
    local_lathe(P, (HW_LO, -0.020, -0.028), R, [(0, 0.0042), (0.0016, 0.0042), (0.0022, 0.0)], "core", segs=12)
    # takedown and pivot pins
    for n in (R, L):
        screw_set(P, [(n.x * HW_LO, -0.010, 0.060), (n.x * HW_LO, -0.010, -0.112)], n, r=0.0024, key="core")
    # the mag well's raised border and the pocket over the trigger (baked)
    for n in (R, L):
        x = n.x * HW_LO
        panel_line(P, [(x, -0.008, -0.044), (x, -0.058, -0.044), (x, -0.058, -0.114), (x, -0.010, -0.118)], n)
        panel_line(P, [(x, -0.008, 0.048), (x, -0.026, 0.048), (x, -0.026, -0.036)], n)


def handguard(P):
    # an octagon-ish tube flat on top for the rail; M-LOK slots on both sides
    # and the belly
    section_body(P, box_outline(HG_Z, -0.024, RAIL_Y),
                 [dict(z=HG_Z, key="guard", hw=HW_HG, c=0.0075, top=RAIL_Y, step=0.06)])
    for n in (R, L):
        slot_array(P, (n.x * HW_HG, 0.0, -0.165), (0, 0, -0.040), 7, 0.026, 0.0075, n, depth=0.007, along=(0, 0, 1))
        screw_set(P, [(n.x * HW_HG, 0.016, -0.140), (n.x * HW_HG, 0.016, -0.418)], n, key="core")
    slot_array(P, (0, -0.024, -0.175), (0, 0, -0.048), 6, 0.026, 0.0075, Vector((0, -1, 0)), depth=0.007, along=(0, 0, 1))
    # the full-length top rail, upper to the handguard's nose
    picatinny(P, 0.066, -0.430, RAIL_Y, 0.0105, key="guard", slot="dark")


def barrel(P):
    lathe(P, [(HG_Z[1] + 0.002, 0.0), (HG_Z[1] + 0.002, 0.0085), (-0.500, 0.0078), (-0.500, 0.0)], "steel", segs=20, cy=BORE)


def stock(P):
    # the castle nut, the buffer tube, then the OD polymer stock: a housing
    # over the tube, a strut down to the butt, a window between them, the
    # QD sling cup and a rubber pad
    lathe(P, [(0.070, 0.0), (0.070, 0.0165), (0.080, 0.0165), (0.080, 0.0)], "core", segs=16, cy=BORE)
    lathe(P, [(0.080, 0.0), (0.080, 0.0135), (0.205, 0.0135), (0.205, 0.0)], "core", segs=20, cy=BORE)
    section_body(P, [(0.113, 0.032), (0.255, 0.036), (0.268, 0.030), (0.268, -0.070), (0.252, -0.075),
                     (0.236, -0.075), (0.150, -0.012), (0.113, -0.010)],
                 [dict(z=(0.115, 0.253), key="stock", hw=HW_STOCK, c=0.004, step=0.012),
                  dict(z=(0.253, 0.266), key="rubber", hw=HW_STOCK + 0.001, c=0.003)])
    d = Vector((0.0, -0.585, 0.811))      # along the strut, up-front to down-back
    P.cutters.append(gk._slot_solid((HW_STOCK, -0.0316, 0.201), d, R, 0.05, 0.012, 0.04, n=4))
    for n in (R, L):
        P.cutters.append(gk._slot_solid((n.x * HW_STOCK, 0.018, 0.195), (0, 0, 1), n, 0.04, 0.006, 0.003, n=3))
        P.cutters.append(gk._slot_solid((n.x * HW_STOCK, -0.058, 0.244), (0, 0, 1), n, 0.009, 0.009, 0.004, n=6))
        vent_slashes(P, (n.x * (HW_STOCK + 0.001), -0.030, 0.259), 4, 0.008, 0.06, 0.0015, n, angle=0.0, depth=0.0015, both=False)


def grip(P):
    # the old 416's outline (the hand rig is fitted to it), stippled sides
    section_body(P, [(-0.004, -0.032), (0.034, -0.032), (0.051, -0.110), (0.047, -0.124), (0.032, -0.131),
                     (0.016, -0.129), (0.004, -0.084), (-0.006, -0.048)],
                 [dict(axis="v", y=(-0.032, -0.129), key="poly", hw=HW_GRIP, c=0.004)])
    v = Vector((0, 0.976, -0.218))
    stipple(P, (HW_GRIP + 0.0001, -0.122, 0.044), (0, 0, -1), v, 0.024, 0.068, "poly")
    stipple(P, (-HW_GRIP - 0.0001, -0.122, 0.020), (0, 0, 1), v, 0.024, 0.068, "poly")


def body():
    P = Part(PFX + "_Body")
    upper(P)
    lower(P)
    handguard(P)
    barrel(P)
    stock(P)
    grip(P)
    return finish_v2(P)


def hider():
    # A2-style birdcage: slots all round but the bottom; its own node so a
    # muzzle attachment can take its place
    P = Part(PFX + "_Hider")
    lathe(P, [(-0.500, 0.0), (-0.500, 0.0105), (-0.5345, 0.0105), (MUZZLE_Z, 0.0095), (MUZZLE_Z, 0.0)], "steel", segs=20, cy=BORE)
    import math
    for deg in (20, 70, 110, 160):
        a = math.radians(deg)
        n = Vector((math.cos(a), math.sin(a), 0))
        P.cutters.append(gk._slot_solid((n.x * 0.0105, BORE + n.y * 0.0105, -0.521), (0, 0, 1), n, 0.022, 0.0032, 0.004, n=2))
    P.cutters.append(gk._slot_solid((0, BORE, MUZZLE_Z), (0, 1, 0), (0, 0, -1), 0.0095, 0.0095, 0.012, n=6))
    return finish_v2(P)


def irons():
    # flip-up front and rear, one node (hidden together under an optic; one
    # draw): the rear's aperture and the front post's tip on y AIM_Y
    P = Part(PFX + "_IronRear")
    chamfer_box(P, (0, RAIL_TOP + 0.0025, 0.050), (0.022, 0.005, 0.026), 0.0015, "guard")
    chamfer_box(P, (0, 0.052, 0.046), (0.018, 0.026, 0.005), 0.0012, "guard")
    for sx in (-1, 1):
        chamfer_box(P, (sx * 0.0085, 0.044, 0.047), (0.003, 0.012, 0.009), 0.0008, "guard")
    P.cutters.append(gk._slot_solid((0, AIM_Y, 0.046), (0, 1, 0), (0, 0, 1), 0.0048, 0.0048, 0.012, n=6))
    chamfer_box(P, (0, RAIL_TOP + 0.0025, -0.418), (0.022, 0.005, 0.020), 0.0015, "guard")
    for sx in (-1, 1):
        chamfer_box(P, (sx * 0.0085, 0.049, -0.418), (0.003, 0.022, 0.008), 0.0008, "guard")
    chamfer_box(P, (0, 0.049, -0.418), (0.0025, 0.020, 0.0025), 0.0006, "steel")
    return finish_v2(P)


AIM_Y = 0.059


def parts():
    # carrier: the bolt and carrier in the port, back on each shot
    P = moving(PFX, "Carrier", (0.0045, BORE, PORT["z"]), "slide", "z", 0.034)
    lathe(P, [(0.030, 0.0), (0.030, 0.0075), (-0.018, 0.0075), (-0.019, 0.0066), (-0.022, 0.0066), (-0.023, 0.0075),
              (-0.050, 0.0075), (-0.052, 0.0055), (-0.064, 0.0052), (-0.064, 0.0)], "steel", segs=16, cx=0.0045, cy=BORE)
    chamfer_box(P, (0.0105, BORE + 0.003, -0.040), (0.004, 0.004, 0.005), 0.0008, "dark")
    chamfer_box(P, (0.0105, BORE - 0.002, -0.008), (0.003, 0.003, 0.016), 0.0006, "dark")
    finish_v2(P)
    # dust cover: hinged on the port's lower edge, hangs open after the first shot
    P = moving(PFX, "DustCover", (HW_UP + 0.0003, PORT["y"] - PORT["h"] / 2 - 0.0005, PORT["z"]), "hinge", "z", -2.9)
    chamfer_box(P, (HW_UP + 0.0006, PORT["y"], PORT["z"]), (0.0012, PORT["h"] + 0.0012, PORT["len"] + 0.002), 0.0004, "recv")
    chamfer_box(P, (HW_UP + 0.0014, PORT["y"] + 0.004, PORT["z"] + 0.022), (0.0012, 0.004, 0.006), 0.0004, "recv")
    finish_v2(P)
    # charging handle: the T at the back of the upper, over the buffer tube
    P = moving(PFX, "Charge", (0, 0.0255, 0.080), "slide", "z", 0.055)
    chamfer_box(P, (0, 0.0255, 0.081), (0.034, 0.0065, 0.010), 0.0015, "core")
    chamfer_box(P, (0, 0.0255, 0.068), (0.008, 0.005, 0.020), 0.001, "core")
    chamfer_box(P, (-0.0145, 0.0262, 0.0795), (0.006, 0.004, 0.006), 0.0008, "core")
    finish_v2(P)
    # trigger: a curved blade, pulled about its pin
    P = moving(PFX, "Trigger", (0, -0.032, -0.016), "hinge", "x", -0.32)
    sweep(P, catmull([(0, -0.030, -0.016), (0, -0.040, -0.019), (0, -0.048, -0.016), (0, -0.0525, -0.010)], 8),
          lambda s: 0.0024, "steel", sides=8, uv=False)
    finish_v2(P)
    # bolt catch: the paddle on the left over the well (palm-slapped)
    P = moving(PFX, "Catch", (-HW_LO, -0.012, -0.038), "hinge", "x", 0.22)
    chamfer_box(P, (-HW_LO - 0.001, -0.017, -0.040), (0.0025, 0.010, 0.016), 0.0008, "core")
    chamfer_box(P, (-HW_LO - 0.0022, -0.021, -0.040), (0.0015, 0.004, 0.013), 0.0005, "core")
    finish_v2(P)
    # magazine: black polymer, curved, waffled sides, a wider floorplate
    P = moving(PFX, "Mag", (0, -0.060, -0.080), "slide", "y", 0.0)
    mag = [(-0.112, -0.020), (-0.044, -0.020), (-0.046, -0.080), (-0.058, -0.160), (-0.078, -0.228), (-0.082, -0.240),
           (-0.154, -0.240), (-0.152, -0.228), (-0.130, -0.160), (-0.116, -0.080)]
    section_body(P, mag, [dict(axis="v", y=(-0.020, -0.227), key="magm", hw=HW_MAG, c=0.003),
                          dict(axis="v", y=(-0.227, -0.2395), key="poly", hw=HW_MAG + 0.0015, c=0.003)])
    v = Vector((0, 0.978, 0.211))
    waffle(P, (HW_MAG + 0.0001, -0.200, -0.082), (0, 0, -1), v, 0.052, 0.12, "magm", cell=0.0085, height=0.0008, land=0.78)
    waffle(P, (-HW_MAG - 0.0001, -0.200, -0.134), (0, 0, 1), v, 0.052, 0.12, "magm", cell=0.0085, height=0.0008, land=0.78)
    finish_v2(P)


def points():
    # the old 416's anchors (weapon-416.js): grip hand, support on the
    # handguard top (buildDetailed drops it 0.05 to the belly), the reflex
    # at z -0.15 (Rail z + 0.01), the underbarrel at -0.31
    for name, p in (("Grip", (0, -0.086, 0.020)), ("Support", (0, 0.025, -0.300)), ("Muzzle", (0, BORE, MUZZLE_Z)),
                    ("Aim", (0, AIM_Y, -0.150)), ("Under", (0, -0.025, -0.310)), ("Rail", (0, RAIL_TOP, -0.160)),
                    ("Eject", (0.018, BORE + 0.002, PORT["z"])), ("ChargeHand", (0, 0.027, 0.088)),
                    ("CatchHand", (-0.024, -0.018, -0.040))):
        empty(PFX + "_" + name, p)


def recipe():
    body()
    hider()
    irons()
    parts()
    points()


VIEWS = {
    "side": ((1.1, 0.0, -0.13), (0, -0.05, -0.13), 60),
    "q34": ((0.62, 0.22, -0.80), (0, -0.05, -0.12), 55),
    "port": ((0.20, 0.05, -0.02), (0.012, 0.0, -0.03), 60),
    "left": ((-0.75, 0.10, 0.05), (0, -0.05, -0.10), 50),
}

if BAKE:
    render = {"dir": os.environ.get("PF_RENDER_DIR", os.path.join(HERE, "_renders")), "views": VIEWS} if "render" in ARGS else None
    bake_kit.bake_gun(recipe, "problem416", PFX, HERE, render=render, margin_px=4)
else:
    gk.HI = "hi" in ARGS
    recipe()
    gk.export(os.path.join(HERE, "problem416.glb"), PFX)
    if "render" in ARGS:
        gk.render_views(os.environ.get("PF_RENDER_DIR", os.path.join(HERE, "_renders")), VIEWS, PFX)
