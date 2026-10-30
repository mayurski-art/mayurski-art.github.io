"""
The MTAR (weapons.js id `kek`; DESIGN-ARSENAL.md Phase 1 step 5, gun 2: the
bullpup), on gunkit v2 and the Problem 416's recipe, built to the user's
concept sheet (refs/arms/kek/concept-sheet.webp, picks in its NOTES.md):
a faceted tan polymer shell with panel seams and screws over a black core
that shows at every seam and cut, vent slashes down the forend, stippled
cheek and grip panels, the charging handle forward in its slot on the left,
an open port above the mag on the right with the bolt carrier in it, and a
smoke-glass magazine behind the grip with the brass stack showing through
(MT_Rounds, which the game sinks as the mag empties).

The proportions and the hand anchors are the Tavor trace's (weapon-ars.js
AR_SPECS.kek, via arkit), so the tuned bullpup reload (ar-reload.js
SPECS.kek) lands as before.

    blender --background --python build_mtar.blender.py --              # quick export, flat materials
    ... -- render                                                        # + studio renders (MT_RENDER_DIR)
    ... -- bake                                                          # bake_kit.bake_gun: mtar.glb, maps, LOD1
    ... -- bake render

Game coordinates: x right, y up, -z toward the muzzle, metres; the bore on
y 0, the grip at z 0.02 (gunkit.Ref).
"""
import math
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gunkit as gk
import arkit as ak
import bmesh                                # (after bpy, which gunkit loads)
import bpy
from gunkit import (Part, lathe, sweep, catmull, empty, section_body, chamfer_box, local_lathe,
                    stipple, moving, Vector)

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
BAKE = "bake" in ARGS
PFX = "MT"
TAN = 0xa08a5e            # the sheet's desert tan
WORN = 0x3a3733           # the shell wears through to the dark core polymer
SMOKE = 0x1a1c20          # the mag's glass

if BAKE:
    import bake_kit
    K = bake_kit.kit_material
    gk.M.update({
        "shell":  K("MT_Shell", "polymer", TAN, WORN, Wear=0.85, Patches=0.5, Roughness=0.64),
        "gripm":  K("MT_Grip", "polymer", TAN, WORN, Wear=0.6, Patches=0.2, Roughness=0.78),
        "core":   K("MT_Core", "anodized", 0x1a1b1d),
        "magm":   K("MT_MagBody", "polymer", 0x1b1b1d, Wear=0.5),
        "rubber": K("MT_Pad", "rubber"),
        "steel":  K("MT_Steel", "parkerized", 0x252627),
        "dark":   K("MT_Dark", "parkerized", 0x0e0e0e, Wear=0.0, Metallic=0.0, Roughness=0.85),
        "brass":  K("MT_Brass", "brass"),
    })
else:
    gk.M.update({
        "shell": gk.material("MT_Shell", TAN, 0.64), "gripm": gk.material("MT_Grip", TAN, 0.78),
        "core": gk.material("MT_Core", 0x1a1b1d, 0.42, 0.35), "magm": gk.material("MT_MagBody", 0x1b1b1d, 0.8),
        "rubber": gk.material("MT_Pad", 0x151515, 0.9), "steel": gk.material("MT_Steel", 0x252627, 0.55, 0.6),
        "dark": gk.material("MT_Dark", 0x0e0e0e, 0.85), "brass": gk.material("MT_Brass", 0xb38f42, 0.3, 1.0),
    })
# the glass is no kit surface: it ships its own material, alpha and all
# (bake_kit bakes a flat colour under it and leaves the slot alone)
gk.M["glass"] = gk.material("MT_Glass", SMOKE, 0.3, 0.0, alpha=0.55)
gk.M["dot"] = gk.M["steel"]

R, L = Vector((1, 0, 0)), Vector((-1, 0, 0))
ZV = Vector((0, 0, 1))
S = ak.spec("kek")
REF = gk.Ref(S["lengthM"], S["pxLen"], S["dir"], S["boreY"], S["gripAt"])
O = gk.ars_outline("kek", ak.ARS_JS)
OUTER, HOLE, MAGP = (ak.outline_m(REF, O["outer"]), ak.outline_m(REF, O["holes"][0]), ak.outline_m(REF, O["mag"]))
Z, Y = REF.Z, REF.Y

FRONT, TAIL = Z(176), Z(824)             # the shell's nose and the butt
SEAM1 = -0.104                           # forend / action join
BUTT, PAD = 0.300, 0.344                 # the black butt block, its rubber pad
RAIL_TOP = Y(S["railTop"])               # the rail teeth's tops (0.043, DETAILED.kek railY)
DECK = RAIL_TOP - 0.007                  # the flat top the rail sits on; the rear deck
RAIL_Z = (0.125, -0.215)                 # short top rail, rear to front
HW_F, HW_A, HW_B = 0.026, 0.029, 0.027   # half-widths: forend, action, butt block
HW_GRIP, HW_MAG = 0.0145, 0.0115
PORT = dict(z=0.145, y=0.004, len=0.075, h=0.020, depth=0.020)   # right, above the mag
SLOT = dict(z=-0.145, y=0.018, len=0.125, h=0.0085)             # the handle's slot, left
HANDLE_Z = -0.195
MAG_PIVOT = (0.0, -0.057, 0.155)         # arkit's mag point (top centre), the reload's anchor
AIM_Y = 0.062
FRONT_Z = -0.198                         # front sight, on the rail's nose
ROUND_PITCH, ROUND_MAX = 0.00425, 0.0935 # the stack rises this much a round, this far at most


# ------------------------------------------------------------------ helpers (the 416's)

def rrect_cut(P, center, normal, along, w, h, r, depth, key, n=3):
    """A rounded-rectangle pocket cut into a face (w along `along`, h
    across), its floor and walls in `key`."""
    bm = bmesh.new()
    nv, a = Vector(normal).normalized(), Vector(along).normalized()
    s_ = nv.cross(a).normalized()
    r = min(r, w / 2 - 1e-5, h / 2 - 1e-5)
    loop = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (r - w / 2, h / 2 - r, 90), (r - w / 2, r - h / 2, 180), (w / 2 - r, r - h / 2, 270)):
        for i in range(n + 1):
            ang = math.radians(a0 + 90 * i / n)
            loop.append(Vector(center) + a * (cx + r * math.cos(ang)) + s_ * (cy + r * math.sin(ang)))
    top = [bm.verts.new(p + nv * 0.002) for p in loop]
    bot = [bm.verts.new(p - nv * depth) for p in loop]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    m = len(loop)
    for k in range(m):
        k2 = (k + 1) % m
        bm.faces.new([top[k2], top[k], bot[k], bot[k2]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    P.cutters.append((bm, key))


def hole(P, center, normal, r, depth, key="core", segs=8):
    up = Vector((0, 1, 0)) if abs(Vector(normal).y) < 0.9 else Vector((1, 0, 0))
    P.cutters.append((gk._slot_solid(center, up, normal, 2 * r, 2 * r, depth, n=segs), key))


def pin(P, center, normal, r=0.003, proud=0.0008, key="core"):
    local_lathe(P, center, normal, [(-0.0005, r), (proud * 0.6, r), (proud, r * 0.8), (proud, 0.0)], key, segs=14)


def screw(P, center, normal, r=0.0024, key="core"):
    """A socket-head screw: a domed head with its hex sunk in."""
    local_lathe(P, center, normal, [(-0.0005, r), (0.0006, r), (0.0011, r * 0.82), (0.0013, 0.0)], key, segs=14)
    hole(P, Vector(center) + Vector(normal).normalized() * 0.0013, normal, r * 0.45, 0.0009, "dark", segs=6)


def picatinny(P, surface, out, across, z0, z1, key="core", hw=0.0106, base=0.0035, tooth=0.0035, pitch=0.010):
    """A MIL-STD-1913 rail along z on a face: a dovetailed spine and square
    teeth, 5.2 mm long every 10 mm, their tops chamfered."""
    out, across = Vector(out).normalized(), Vector(across).normalized()
    s0 = Vector(surface)
    L_, zc = abs(z1 - z0), (z0 + z1) / 2
    b = s0 + out * 0.0012
    chamfer_box(P, (b.x, b.y, zc), (0.0026, hw * 1.6, L_), 0.0006, key, (out, across, ZV))
    b = s0 + out * (0.0024 + base / 2)
    chamfer_box(P, (b.x, b.y, zc), (base, hw * 2, L_), 0.0012, key, (out, across, ZV))
    t = s0 + out * (0.0024 + base + tooth / 2 - 0.0002)
    n = int(L_ / pitch)
    z = min(z0, z1) + (L_ - (n - 1) * pitch) / 2
    for k in range(n):
        chamfer_box(P, (t.x, t.y, z + k * pitch), (tooth, hw * 2, 0.0052), 0.0009, key, (out, across, ZV))


def fin(P, parent=None):
    """Finish a part with real rounded edges on the game mesh too, a finer
    bevel on the bake's high pass."""
    return P.finish(parent=parent, smooth_angle=34, bevel=0.0007 if gk.HI else 0.0006, bevel_segs=3 if gk.HI else 2)


# ------------------------------------------------------------------ helpers (the MTAR's)

def poly_cut(P, pts, key, hw=0.08):
    """A prism through the gun (x) on a side polygon [(z, y)]: the trigger
    guard's opening, straight out of the trace."""
    bm = bmesh.new()
    a = [bm.verts.new(Vector((hw, y, z))) for z, y in pts]
    b = [bm.verts.new(Vector((-hw, y, z))) for z, y in pts]
    caps = [bm.faces.new(a), bm.faces.new(list(reversed(b)))]
    for k in range(len(pts)):
        k2 = (k + 1) % len(pts)
        bm.faces.new([a[k2], a[k], b[k], b[k2]])
    bmesh.ops.triangulate(bm, faces=caps)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    P.cutters.append((bm, key))


def seam(P, a, b, normal, width=0.0014, depth=0.0014, key="core"):
    """A panel seam: a narrow groove from a to b on a face, its floor the
    black core (the shell-over-core rule, DESIGN-ARSENAL §3)."""
    a, b = Vector(a), Vector(b)
    along = b - a
    P.cutters.append((gk._slot_solid((a + b) / 2, along, normal, along.length + width, width, depth), key))


def slashes(P, center, n, pitch, length, width, normal, angle=0.55, depth=0.004, key="core"):
    """Angled vent slashes across a flank, their floors black."""
    nv = Vector(normal).normalized()
    up = Vector((0, 1, 0))
    up = (up - nv * up.dot(nv)).normalized()
    fwd = nv.cross(up).normalized()
    along = (up * math.cos(angle) + fwd * math.sin(angle)).normalized()
    for k in range(n):
        c = Vector(center) + fwd * (pitch * (k - (n - 1) / 2))
        P.cutters.append((gk._slot_solid(c, along, nv, length, width, depth), key))


def stipple_panel(P, side, y0, y1, z0, z1, key):
    """A sunk rectangle on one flank (side +1 right, -1 left) with the
    stipple on it (high pass)."""
    hw = HW_A if key == "shell" else HW_GRIP
    rrect_cut(P, (side * hw, (y0 + y1) / 2, (z0 + z1) / 2), (side, 0, 0), ZV, abs(z1 - z0), abs(y1 - y0), 0.004, 0.0009, key)
    if side > 0:
        stipple(P, (hw - 0.0008, y0, max(z0, z1)), (0, 0, -1), (0, 1, 0), abs(z1 - z0), abs(y1 - y0), key)
    else:
        stipple(P, (-hw + 0.0008, y0, min(z0, z1)), (0, 0, 1), (0, 1, 0), abs(z1 - z0), abs(y1 - y0), key)


# ------------------------------------------------------------------ the body

def shell(P):
    # one tan shell on the trace's outline, flat on top where the rail and
    # the rear deck sit: the narrower forend, the action (its bottom follows
    # the trace: the guard, the notch behind the grip, the mag well, the
    # slope to the butt), then the black butt block and its rubber pad
    section_body(P, OUTER, [
        dict(z=(FRONT, SEAM1 + 0.002), key="shell", hw=lambda t: HW_F - 0.0045 * (1 - t), c=0.0055, top=DECK, step=0.005),
        dict(z=(SEAM1, BUTT), key="shell", hw=HW_A, c=0.0065, top=DECK, y=(-0.075, 0.06), step=0.004),
        dict(z=(BUTT - 0.001, PAD), key="core", hw=HW_B, c=0.005, top=DECK, y=(-0.1, 0.06), step=0.006),
        dict(z=(PAD, TAIL), key="rubber", hw=HW_B + 0.0005, c=0.004, top=DECK - 0.002, y=(-0.1, 0.06), step=0.006),
    ])
    # the trigger guard: the trace's own opening, cut through
    poly_cut(P, HOLE, "core")
    # the barrel's way out of the nose, a black collar round it
    hole(P, (0, 0, FRONT), (0, 0, -1), 0.0105, 0.030, "dark", segs=16)
    lathe(P, [(FRONT + 0.003, 0.0), (FRONT + 0.003, 0.0138), (FRONT - 0.004, 0.0138), (FRONT - 0.005, 0.0125), (FRONT - 0.005, 0.0)], "core", segs=32)
    # the butt pad's ribs, the sling slot through the block
    for k in range(10):
        rrect_cut(P, (0, 0.016 - 0.011 * k, TAIL), ZV, R, 2 * HW_B - 0.006, 0.0034, 0.0015, 0.002, "rubber")
    rrect_cut(P, (HW_B, -0.030, 0.322), R, (0, 1, 0), 0.030, 0.0055, 0.0025, 0.06, "dark")
    for n in (R, L):
        x_f, x_a = n.x * HW_F, n.x * HW_A
        # the forend: a row of seven vent slashes, screws at the nose
        slashes(P, (x_f, -0.004, -0.170), 7, 0.0145, 0.028, 0.0058, n)
        screw(P, (x_f, 0.020, -0.226), n)
        screw(P, (x_f, -0.038, -0.226), n)
        # panel seams: the forend join, a long line above the trigger, the
        # butt join leaning back; screws at each join
        seam(P, (x_a, DECK - 0.003, SEAM1 + 0.004), (x_a, -0.046, SEAM1 + 0.010), n)
        seam(P, (x_a, -0.030, SEAM1 + 0.012), (x_a, -0.030, 0.095), n)
        seam(P, (x_a, -0.030, 0.095), (x_a, -0.012, 0.100), n)
        seam(P, (x_a, DECK - 0.003, 0.236), (x_a, -0.088, 0.252), n)
        screw(P, (x_a, 0.024, SEAM1 + 0.016), n)
        screw(P, (x_a, -0.042, SEAM1 + 0.020), n)
        screw(P, (x_a, -0.018, 0.070), n)
        screw(P, (x_a, 0.024, 0.228), n)
        screw(P, (x_a, -0.078, 0.240), n)
        screw(P, (x_a, -0.034, 0.222), n)
        pin(P, (x_a, -0.052, -0.070), n, 0.0030, 0.0008)      # trigger group pin
        pin(P, (x_a, -0.052, 0.098), n, 0.0030, 0.0008)       # sear pin
        # the cheek panel, stippled
        stipple_panel(P, n.x, 0.019, 0.032, 0.100, 0.220, "shell")
    # the belly seams across the forend join and the butt join
    seam(P, (-HW_A + 0.004, -0.0485, SEAM1 + 0.006), (HW_A - 0.004, -0.0485, SEAM1 + 0.006), (0, -1, 0))
    seam(P, (-HW_A + 0.004, -0.0905, 0.254), (HW_A - 0.004, -0.0905, 0.254), (0, -1, 0))
    # the charging handle's slot, left, under the rail
    rrect_cut(P, (-HW_A, SLOT["y"], SLOT["z"]), L, ZV, SLOT["len"] + 0.004, SLOT["h"] + 0.004, 0.0045, 0.0012, "shell")
    rrect_cut(P, (-HW_A - 0.0012, SLOT["y"], SLOT["z"]), L, ZV, SLOT["len"], SLOT["h"], 0.004, 0.009, "core")
    # the port, right: a chamfered surround, then the opening down to the carrier
    rrect_cut(P, (HW_A, PORT["y"], PORT["z"]), R, ZV, PORT["len"] + 0.004, PORT["h"] + 0.004, 0.004, 0.0012, "shell")
    rrect_cut(P, (HW_A - 0.0012, PORT["y"], PORT["z"]), R, ZV, PORT["len"], PORT["h"], 0.0025, PORT["depth"], "core")
    # brass deflector behind the port
    chamfer_box(P, (HW_A + 0.002, PORT["y"] + 0.004, PORT["z"] + PORT["len"] / 2 + 0.007), (0.0045, 0.014, 0.009), 0.002, "shell")
    # the mag well's flared lip, the mag release lever behind it
    chamfer_box(P, (0, -0.0585, 0.157), (2 * HW_MAG + 0.007, 0.006, 0.096), 0.002, "shell")
    chamfer_box(P, (0, -0.050, 0.214), (0.018, 0.012, 0.016), 0.0025, "core")
    for k in range(3):
        chamfer_box(P, (0, -0.0565, 0.209 + 0.004 * k), (0.016, 0.0012, 0.0016), 0.0003, "core")
    # the rear deck behind the rail: a low ridge with the sight line clear
    chamfer_box(P, (0, DECK + 0.0015, 0.215), (0.024, 0.004, 0.170), 0.0012, "shell")


def grip(P):
    # the trace's grip: near vertical, stippled panels sunk in each side,
    # ribs down the back strap, a flared toe; the guard's front strap in
    # front of it is a thin bar (the trace's opening cuts between them)
    section_body(P, OUTER, [dict(axis="v", y=(-0.058, -0.146), z=(-0.032, 0.056), key="gripm", hw=HW_GRIP, c=0.004, step=0.004),
                            dict(axis="v", y=(-0.058, -0.146), z=(-0.10, -0.026), key="gripm", hw=0.0075, c=0.0025, step=0.004)])
    for n in (R, L):
        stipple_panel(P, n.x, -0.128, -0.074, -0.006, 0.014, "gripm")
    back = Vector((0, 0.12, 0.99))
    for k in range(7):
        rrect_cut(P, (0, -0.072 - 0.0085 * k, 0.0345 + 0.0012 * k), back, R, 0.016, 0.0028, 0.0012, 0.0012, "gripm")


def barrel(P):
    ak.barrel(P, REF, S, r=0.0074)


def body():
    P = Part(PFX + "_Body")
    shell(P)
    grip(P)
    barrel(P)
    return fin(P)


def rails():
    P = Part(PFX + "_Rails")
    picatinny(P, (0, DECK - 0.0024, 0), (0, 1, 0), (1, 0, 0), RAIL_Z[0], RAIL_Z[1])
    return fin(P)


def hider():
    # arkit's birdcage on the trace's muzzle, its own node for a muzzle attachment
    ak.device(PFX, REF, S, "birdcage", r=0.0096)


def irons():
    # MBUS-style flip-ups standing on the rail, one node (hidden together
    # under an optic): the rear aperture and the front post's tip on AIM_Y
    P = Part(PFX + "_IronRear")
    base = RAIL_TOP + 0.004
    rz = 0.090
    chamfer_box(P, (0, base, rz + 0.004), (0.026, 0.008, 0.030), 0.002, "core")
    screw(P, (0.013, base, rz + 0.011), R, 0.0018)
    chamfer_box(P, (0, base + 0.0055, rz), (0.021, 0.006, 0.010), 0.0018, "core")
    for sx in (-1, 1):
        chamfer_box(P, (sx * 0.0088, 0.0565, rz), (0.0042, 0.020, 0.012), 0.0014, "core")
    chamfer_box(P, (0, 0.052, rz), (0.010, 0.010, 0.0045), 0.0012, "core")
    chamfer_box(P, (0, AIM_Y, rz), (0.0135, 0.011, 0.0045), 0.0012, "core")
    hole(P, (0, AIM_Y, rz + 0.0023), (0, 0, 1), 0.0022, 0.012, "dark", segs=10)
    local_lathe(P, (0.0109, 0.053, rz), R, [(0, 0.0042), (0.0028, 0.0042), (0.0034, 0.0)], "core", segs=14)
    chamfer_box(P, (0, base, FRONT_Z), (0.026, 0.008, 0.026), 0.002, "core")
    screw(P, (0.013, base, FRONT_Z + 0.007), R, 0.0018)
    for sx in (-1, 1):
        chamfer_box(P, (sx * 0.0088, 0.0555, FRONT_Z), (0.0042, 0.022, 0.012), 0.0014, "core")
    chamfer_box(P, (0, 0.0505, FRONT_Z), (0.012, 0.008, 0.008), 0.0015, "core")
    chamfer_box(P, (0, 0.0555, FRONT_Z), (0.0028, 0.013, 0.0028), 0.0006, "steel")
    local_lathe(P, (0.0109, 0.050, FRONT_Z), R, [(0, 0.0040), (0.0028, 0.0040), (0.0034, 0.0)], "core", segs=14)
    return fin(P)


def parts():
    # carrier: the bolt (rings, cam pin, extractor) and the carrier in the
    # port above the mag, back on each shot
    cy, cx = PORT["y"], 0.003
    P = moving(PFX, "Carrier", (cx, cy, PORT["z"]), "slide", "z", 0.040)
    lathe(P, [(0.270, 0.0), (0.270, 0.0088), (0.160, 0.0088), (0.158, 0.0080), (0.154, 0.0080), (0.152, 0.0088),
              (0.128, 0.0088), (0.126, 0.0068), (0.112, 0.0068), (0.111, 0.0060), (0.109, 0.0068), (0.106, 0.0068),
              (0.105, 0.0060), (0.103, 0.0068), (0.070, 0.0066), (0.069, 0.0)], "steel", segs=36, cx=cx, cy=cy)
    chamfer_box(P, (cx + 0.0095, cy + 0.003, 0.140), (0.004, 0.0055, 0.006), 0.0009, "steel")          # cam pin
    chamfer_box(P, (cx + 0.0068, cy - 0.0005, 0.116), (0.0018, 0.004, 0.012), 0.0005, "core")          # extractor
    chamfer_box(P, (cx + 0.0080, cy - 0.003, 0.175), (0.002, 0.004, 0.034), 0.0006, "core")            # the flat
    fin(P)
    # charging handle: a knob forward in the left slot, its stem inside
    P = moving(PFX, "Charge", (-HW_A, SLOT["y"], HANDLE_Z), "slide", "z", 0.055)
    chamfer_box(P, (-HW_A - 0.0050, SLOT["y"], HANDLE_Z), (0.0100, 0.0078, 0.024), 0.0022, "core")
    chamfer_box(P, (-HW_A + 0.0020, SLOT["y"], HANDLE_Z), (0.0080, 0.0060, 0.010), 0.0008, "core")
    for k in range(4):
        chamfer_box(P, (-HW_A - 0.0102, SLOT["y"], HANDLE_Z - 0.0075 + 0.005 * k), (0.0008, 0.0062, 0.0016), 0.0003, "core")
    fin(P)
    # trigger: a black curved blade hung from the top of the opening
    P = moving(PFX, "Trigger", (0, -0.041, -0.030), "hinge", "x", -0.30)
    sweep(P, catmull([(0, -0.041, -0.030), (0, -0.052, -0.034), (0, -0.062, -0.034), (0, -0.070, -0.029)], 10),
          lambda s: 0.0028 - 0.0007 * s, "core", sides=10, uv=False)
    fin(P)
    # bolt catch: the paddle behind the mag on the left
    P = moving(PFX, "Catch", (-HW_A, -0.030, 0.215), "hinge", "x", 0.22)
    chamfer_box(P, (-HW_A - 0.001, -0.036, 0.218), (0.0025, 0.014, 0.014), 0.0008, "core")
    for k in range(3):
        chamfer_box(P, (-HW_A - 0.0024, -0.032 - 0.0028 * k, 0.218), (0.0010, 0.0011, 0.012), 0.0003, "core")
    fin(P)
    # magazine: the trace's mag, smoke glass with black lips, floorplate,
    # spine and two ribs a side; the brass stack inside is its own node
    P = moving(PFX, "Mag", MAG_PIVOT, "slide", "y", 0.0)
    section_body(P, MAGP, [dict(axis="v", y=(-0.052, -0.064), key="magm", hw=HW_MAG + 0.0004, c=0.003, step=0.004),
                           dict(axis="v", y=(-0.063, -0.154), key="glass", hw=HW_MAG, c=0.0035, step=0.004),
                           dict(axis="v", y=(-0.153, -0.1675), key="magm", hw=HW_MAG + 0.0025, c=0.0035, step=0.004)])
    lean = Vector((0, -0.106, -0.020)).normalized()
    across = R.cross(lean).normalized()
    for n in (R, L):
        for zf in (0.30, 0.68):
            # ribs sit on the flank, a third and two thirds along the mag's depth
            top = gk.span(MAGP, 1, -0.110)
            zc = top[0] + (top[1] - top[0]) * zf
            chamfer_box(P, (n.x * (HW_MAG + 0.0004), -0.110, zc), (0.0022, 0.092, 0.0036), 0.0006, "magm", (n, lean, across))
    # the spine down the back
    top = gk.span(MAGP, 1, -0.110)
    chamfer_box(P, (0, -0.110, top[1] - 0.001), (0.014, 0.092, 0.0030), 0.0008, "magm", (R, lean, across))
    mag = fin(P)
    bpy.context.view_layer.update()
    # the rounds: a double stack lying forward, a black follower under it;
    # the game raises the node as the mag empties (tf_rounds extras)
    P = Part(PFX + "_Rounds")
    P.extras.update({"tf_rounds": 1, "tf_rounds_pitch": ROUND_PITCH, "tf_rounds_max": ROUND_MAX})
    for k in range(21):
        y = -0.067 - ROUND_PITCH * k
        sp = gk.span(MAGP, 1, y)
        zc = (sp[0] + sp[1]) / 2 + 0.004
        x = 0.0043 if k % 2 == 0 else -0.0043
        z0 = zc + 0.029
        lathe(P, [(z0, 0.0), (z0, 0.0045), (z0 - 0.003, 0.0045), (z0 - 0.0035, 0.0040), (z0 - 0.038, 0.0043),
                  (z0 - 0.044, 0.0032), (z0 - 0.049, 0.0025), (z0 - 0.056, 0.0012), (z0 - 0.0585, 0.0)], "brass", segs=10, cx=x, cy=y)
    sp = gk.span(MAGP, 1, -0.160)
    chamfer_box(P, (0, -0.1605, (sp[0] + sp[1]) / 2 + 0.004), (0.017, 0.004, 0.046), 0.0008, "core")
    fin(P, parent=mag)


def points():
    # the trace's anchors (arkit.anchors, what the reload poses were tuned
    # to), the aim raised to the new irons; the v2 points: brass out of the
    # port by the cheek, the support hand on the handle, the catch hand
    # behind the mag
    hand = S["hand"]
    for name, p in (("Grip", tuple(REF.P(*S["gripAt"]))), ("Support", (0, 0.0, Z(hand[0]))), ("Muzzle", (0, 0.0, Z(min(S["muzzle"][:2])))),
                    ("Aim", (0, AIM_Y, 0.090)), ("Under", (0, -0.060, Z(hand[0]))), ("Rail", (0, RAIL_TOP, Z(S["opticX"]))),
                    ("Eject", (HW_A + 0.004, PORT["y"] + 0.002, PORT["z"])), ("ChargeHand", (-HW_A - 0.012, SLOT["y"], HANDLE_Z)),
                    ("CatchHand", (-HW_A - 0.010, -0.040, 0.216))):
        empty(PFX + "_" + name, p)


def recipe():
    body()
    rails()
    hider()
    irons()
    parts()
    points()


VIEWS = {
    "side": ((1.15, 0.0, 0.03), (0, -0.04, 0.03), 55),
    "q34": ((0.55, 0.12, -0.72), (0, -0.04, 0.0), 50),
    "rear": ((0.34, 0.07, 0.46), (0.01, -0.04, 0.14), 55),      # the sheet's close-up: port, cheek, mag
    "left": ((-0.80, 0.10, 0.12), (0, -0.05, 0.0), 50),
    "mag": ((0.22, -0.06, 0.30), (0.0, -0.10, 0.15), 60),
}

if BAKE:
    render = {"dir": os.environ.get("MT_RENDER_DIR", os.path.join(HERE, "_renders")), "views": VIEWS} if "render" in ARGS else None
    # first person carries the detail; everyone else sees the LOD1 at the
    # design's third-person budget (the user's rule, DESIGN-ARSENAL §2)
    bake_kit.bake_gun(recipe, "mtar", PFX, HERE, render=render, res=2048, margin_px=6, lod_ratio=0.07)
else:
    gk.HI = "hi" in ARGS
    recipe()
    gk.export(os.path.join(HERE, "mtar.glb"), PFX)
    if "render" in ARGS:
        gk.render_views(os.environ.get("MT_RENDER_DIR", os.path.join(HERE, "_renders")), VIEWS, PFX)
