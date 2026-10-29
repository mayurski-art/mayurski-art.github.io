"""
The arsenal pipeline's test piece (DESIGN-ARSENAL.md Phase 1, the
foundation): a plain AR receiver, handguard, grip, stock and mag built on
gunkit v2, with every standard moving part and point. Not a gun in the
game: it proves the section bodies, the high-to-low bake, the loader, the
gun-action driver and the brass end to end.

    blender --background --python build_armstest.blender.py --              # export models/armstest.glb, flat materials
    blender --background --python build_armstest.blender.py -- bake         # bake_kit.bake_gun: maps, LOD1
    blender --background --python build_armstest.blender.py -- bake render  # + check renders (AT_RENDER_DIR)

Game coordinates: x right, y up, -z toward the muzzle, metres; the bore on
y 0, the grip near z 0.05.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gunkit as gk
from gunkit import (Part, lathe, local_lathe, sweep, catmull, empty, picatinny, section_body, chamfer_box,
                    slot_array, vent_slashes, panel_line, stipple, waffle, screw_set, moving, finish_v2, Vector)

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
BAKE = "bake" in ARGS
PFX = "AT"
OD, BLACK = 0x4d5238, 0x1d1e20

if BAKE:
    import bake_kit
    gk.M.update({
        "recv":   bake_kit.kit_material("AT_Upper", "cerakote", OD),
        "lower":  bake_kit.kit_material("AT_Lower", "anodized"),
        "guard":  bake_kit.kit_material("AT_Guard", "cerakote", OD),
        "poly":   bake_kit.kit_material("AT_Polymer", "polymer"),
        "magm":   bake_kit.kit_material("AT_MagBody", "polymer", 0x2a2a28),
        "rubber": bake_kit.kit_material("AT_Pad", "rubber"),
        "steel":  bake_kit.kit_material("AT_Steel", "parkerized"),
        "dark":   bake_kit.kit_material("AT_Dark", "parkerized", 0x121212, Wear=0.0),
    })
else:
    gk.M.update({
        "recv": gk.material("AT_Upper", OD, 0.6), "lower": gk.material("AT_Lower", BLACK, 0.45, 0.3),
        "guard": gk.material("AT_Guard", OD, 0.6), "poly": gk.material("AT_Polymer", 0x242424, 0.8),
        "magm": gk.material("AT_MagBody", 0x2a2a28, 0.8), "rubber": gk.material("AT_Pad", 0x151515, 0.9),
        "steel": gk.material("AT_Steel", 0x2c2d2d, 0.55, 0.6), "dark": gk.material("AT_Dark", 0x121212, 0.6),
    })

R, L = Vector((1, 0, 0)), Vector((-1, 0, 0))


def body():
    P = Part(PFX + "_Body")
    # upper: chamfered, flat-topped, the ejection port on the right
    section_body(P, [(0.10, -0.015), (0.10, 0.025), (-0.08, 0.025), (-0.08, -0.015)],
                 [dict(z=(0.10, -0.08), key="recv", hw=0.0118, c=0.003, step=0.03)])
    P.cutters.append(gk._slot_solid((0.0118, 0.002, 0.03), (0, 0, 1), R, 0.064, 0.02, 0.007, n=2))
    panel_line(P, [(0.0118, 0.019, 0.095), (0.0118, 0.019, -0.075)], R)
    panel_line(P, [(-0.0118, 0.019, 0.095), (-0.0118, 0.019, -0.075)], L)
    # forward assist
    local_lathe(P, (0.0105, 0.012, 0.075), (1, 0.35, 0), [(0, 0.0062), (0.011, 0.0062), (0.013, 0.005), (0.0135, 0.0)], "recv", segs=12)
    # lower: its own section, a hair under the upper so the split line shows;
    # the mag well hangs below
    section_body(P, [(0.09, -0.015), (0.09, -0.045), (0.035, -0.05), (-0.016, -0.05), (-0.018, -0.068),
                     (-0.062, -0.068), (-0.064, -0.015)],
                 [dict(z=(0.09, -0.064), key="lower", hw=0.0112, c=0.002, top=-0.0156, step=0.008)])
    # trigger guard
    chamfer_box(P, (0, -0.057, 0.012), (0.007, 0.004, 0.058), 0.0012, "lower")
    chamfer_box(P, (0, -0.052, -0.015), (0.007, 0.012, 0.005), 0.0012, "lower")
    # handguard: an octagon-ish section with M-LOK cuts through to the core
    section_body(P, [(-0.08, -0.03), (-0.08, 0.025), (-0.33, 0.025), (-0.33, -0.03)],
                 [dict(z=(-0.081, -0.33), key="guard", hw=0.0168, c=0.0065, step=0.05)])
    for n in (R, L):
        slot_array(P, (n.x * 0.0168, -0.004, -0.115), (0, 0, -0.045), 5, 0.032, 0.0072, n, depth=0.006, along=(0, 0, 1))
        screw_set(P, [(n.x * 0.0167, 0.013, -0.095), (n.x * 0.0167, 0.013, -0.315)], n, key="steel")
    picatinny(P, 0.098, -0.328, 0.025, 0.0105, key="lower", slot="dark")
    # barrel, gas block and a birdcage (merged into the body: no device swap)
    lathe(P, [(-0.33, 0.0), (-0.33, 0.0085), (-0.43, 0.0075), (-0.43, 0.0)], "steel", segs=20)
    lathe(P, [(-0.43, 0.0), (-0.43, 0.0105), (-0.468, 0.0105), (-0.472, 0.0095), (-0.472, 0.0)], "steel", segs=20)
    vent_slashes(P, (0.0105, 0.0, -0.452), 3, 0.009, 0.012, 0.003, R, angle=0.0, depth=0.004)
    # buffer tube and stock, vents on its sides, a rubber pad
    lathe(P, [(0.09, 0.0), (0.09, 0.0135), (0.22, 0.0135), (0.22, 0.0)], "lower", segs=20, cy=0.006)
    section_body(P, [(0.17, 0.03), (0.30, 0.036), (0.30, -0.065), (0.245, -0.065), (0.17, -0.012)],
                 [dict(z=(0.17, 0.292), key="poly", hw=0.0172, c=0.004, step=0.015), dict(z=(0.292, 0.305), key="rubber", hw=0.0185, c=0.003)])
    for n in (R, L):
        vent_slashes(P, (n.x * 0.0172, 0.006, 0.24), 4, 0.011, 0.026, 0.0045, n, angle=0.5)
    # grip: raked, sections down it, stippled sides
    grip = [(0.028, -0.046), (0.07, -0.046), (0.088, -0.145), (0.05, -0.145)]
    section_body(P, grip, [dict(axis="v", y=(-0.046, -0.145), key="poly", hw=0.0135, c=0.004)])
    v = Vector((0, 0.974, -0.226))
    stipple(P, (0.0136, -0.128, 0.078), (0, 0, -1), v, 0.022, 0.062, "poly")
    stipple(P, (-0.0136, -0.128, 0.056), (0, 0, 1), v, 0.022, 0.062, "poly")
    return finish_v2(P)


def parts():
    # carrier: in the port, back on each shot
    P = moving(PFX, "Carrier", (0.006, 0.002, 0.03), "slide", "z", 0.032)
    chamfer_box(P, (0.006, 0.002, 0.03), (0.009, 0.016, 0.075), 0.0015, "steel")
    chamfer_box(P, (0.0102, 0.006, 0.012), (0.002, 0.004, 0.014), 0.0006, "dark")
    finish_v2(P)
    # dust cover: hinged on the port's lower edge, pops open on the first shot
    P = moving(PFX, "DustCover", (0.0128, -0.0095, 0.03), "hinge", "z", -1.7)
    chamfer_box(P, (0.0128, 0.002, 0.03), (0.0012, 0.021, 0.066), 0.0004, "recv")
    finish_v2(P)
    # charging handle: the T behind the rail, pulled back on the reload
    P = moving(PFX, "Charge", (0, 0.019, 0.106), "slide", "z", 0.055)
    chamfer_box(P, (0, 0.019, 0.106), (0.036, 0.007, 0.011), 0.002, "lower")
    chamfer_box(P, (0, 0.019, 0.095), (0.008, 0.005, 0.02), 0.001, "lower")
    finish_v2(P)
    # trigger
    P = moving(PFX, "Trigger", (0, -0.047, 0.03), "hinge", "x", -0.32)
    sweep(P, catmull([(0, -0.044, 0.03), (0, -0.054, 0.026), (0, -0.063, 0.029), (0, -0.068, 0.034)], 8), lambda s: 0.0026, "steel", sides=8, uv=False)
    finish_v2(P)
    # bolt catch: the paddle on the left over the well
    P = moving(PFX, "Catch", (-0.0118, -0.02, -0.03), "hinge", "x", 0.22)
    chamfer_box(P, (-0.0128, -0.024, -0.034), (0.0025, 0.009, 0.017), 0.0008, "lower")
    finish_v2(P)
    # selector: a lever on the left above the grip
    P = moving(PFX, "Selector", (-0.0118, -0.03, 0.062), "hinge", "x", 1.57)
    local_lathe(P, (-0.0112, -0.03, 0.062), (-1, 0, 0), [(0, 0.004), (0.0025, 0.004), (0.003, 0.0)], "lower", segs=12)
    chamfer_box(P, (-0.0138, -0.03, 0.07), (0.0022, 0.0045, 0.017), 0.0008, "lower")
    finish_v2(P)
    # magazine: polymer, waffled sides, curved forward
    P = moving(PFX, "Mag", (0, -0.052, -0.039), "slide", "y", 0.0)
    mag = [(-0.058, -0.05), (-0.019, -0.05), (-0.031, -0.205), (-0.076, -0.205)]
    section_body(P, mag, [dict(axis="v", y=(-0.05, -0.192), key="magm", hw=0.0108, c=0.003),
                          dict(axis="v", y=(-0.192, -0.204), key="poly", hw=0.0124, c=0.003)])
    waffle(P, (0.0109, -0.17, -0.034), (0, 0, -1), (0, 1, 0), 0.026, 0.09, "magm")
    waffle(P, (-0.0109, -0.17, -0.062), (0, 0, 1), (0, 1, 0), 0.026, 0.09, "magm")
    finish_v2(P)


def points():
    for name, p in (("Grip", (0, -0.075, 0.058)), ("Support", (0, -0.03, -0.2)), ("Muzzle", (0, 0, -0.472)),
                    ("Aim", (0, 0.05, 0.06)), ("Under", (0, -0.03, -0.2)), ("Rail", (0, 0.036, 0.0)),
                    ("Eject", (0.016, 0.004, 0.03)), ("ChargeHand", (0, 0.02, 0.118)), ("CatchHand", (-0.022, -0.024, -0.034))):
        empty(PFX + "_" + name, p)


def recipe():
    body()
    parts()
    points()


VIEWS = {
    "side": ((0.9, 0.0, -0.08), (0, -0.04, -0.08), 70),
    "q34": ((0.45, 0.22, -0.55), (0, -0.04, -0.06), 60),
    "macro": ((0.16, 0.05, 0.12), (0.01, -0.01, 0.02), 60),
}

if BAKE:
    render = {"dir": os.environ.get("AT_RENDER_DIR", os.path.join(HERE, "_renders")), "views": VIEWS} if "render" in ARGS else None
    bake_kit.bake_gun(recipe, "armstest", PFX, HERE, render=render)
else:
    gk.HI = "hi" in ARGS
    recipe()
    gk.export(os.path.join(HERE, "armstest.glb"), PFX)
    if "render" in ARGS:
        gk.render_views(os.environ.get("AT_RENDER_DIR", os.path.join(HERE, "_renders")), VIEWS, PFX)
