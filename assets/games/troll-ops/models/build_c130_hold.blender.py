"""
The C-130's cargo hold, the inside the Troll Royale riders walk round
(royale-hold.js). From the user's reference (a dark olive bay, "8 GAUGE"
ammo cans, the long "$TROLL" crate, jerry cans, pistols, mags and a grenade
on the deck) and a real Hercules' hold: quilted olive insulation between
the frames, red webbing troop seats down both walls, the roller tracks in
the floor, the static-line cables overhead, the jump lights by the ramp.

    blender --background --python build_c130_hold.blender.py

Writes c130-hold.glb next to this script. Same frame as c130.glb (shares
its section maths, see build_c130.blender.py): metres, Blender +Y forward,
origin the middle of the cargo floor. The hold runs y -6.25 .. +6.25,
the walls at |x| 1.56 on the floor; aft of the ramp hinge it lines the
upswept tail as far as the door hinge.

Names royale-hold.js reads:
  Hold_Seat_0..8    empties at each seat pan's middle, z = the pan; the
                    seat faces the aisle (x < 0: faces +x)
  H_JumpRed, H_JumpGreen, H_Glow    materials it lights (emissive)
"""
import bpy
import math
import os
import sys

import importlib.util
from mathutils import Matrix, Vector

_spec = importlib.util.spec_from_file_location("build_c130", os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_c130.blender.py"))
C = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(C)

HERE = C.HERE
HOLD_FWD, HOLD_AFT = 6.25, C.HINGE_Y
BAYS = 24
BAY = (HOLD_FWD - HOLD_AFT) / BAYS

# The lining's half profile, the wall at the floor up over the ceiling to
# the middle: (x, z).
PROF = [(1.56, 0.0), (1.63, 0.35), (1.69, 0.8), (1.72, 1.3), (1.70, 1.8), (1.60, 2.25),
        (1.40, 2.55), (1.05, 2.70), (0.55, 2.75), (0.0, 2.76)]

# Seats: (side, y). Port (x < 0) five, starboard four, all facing the aisle.
SEATS = [(-1, 4.3), (1, 3.4), (-1, 2.5), (1, 1.6), (-1, 0.7), (1, -0.2), (-1, -1.1), (1, -2.0), (-1, -2.9)]
SEAT_X = 1.30          # the pan's middle
SEAT_Z = 0.44

LINING = (0x4a, 0x50, 0x3a)
LINING_DK = (0x3a, 0x3f, 0x2d)
FRAME = (0x5c, 0x60, 0x58)
DECK = (0x34, 0x36, 0x33)
DECK_DK = (0x24, 0x26, 0x24)
WEB = (0x9a, 0x22, 0x1c)
TUBE = (0xa8, 0xac, 0xa6)
WOOD = (0x8a, 0x52, 0x22)
WOOD_DK = (0x5e, 0x36, 0x16)
CAN = (0x3b, 0x44, 0x2b)
STENCIL = (0xe0, 0xc2, 0x4a)
CREAM = (0xd8, 0xcf, 0xa6)
STRAP = (0xe3, 0xb1, 0x1c)
GUN = (0x1c, 0x1d, 0x1f)
BRASS = (0xb8, 0x8a, 0x3a)
RUBBER = (0x15, 0x15, 0x14)
RED = (0xd0, 0x1e, 0x16)
WHITE = (0xee, 0xec, 0xe4)

M = {}


def resample(pts, n):
    """n points evenly along a polyline."""
    d = [0.0]
    for a, b in zip(pts, pts[1:]):
        d.append(d[-1] + math.dist(a, b))
    out = []
    for k in range(n):
        t = d[-1] * k / (n - 1)
        i = max(0, min(len(pts) - 2, next((j for j in range(len(d) - 1) if d[j + 1] >= t), len(d) - 2)))
        f = (t - d[i]) / max(1e-9, d[i + 1] - d[i])
        out.append(tuple(pts[i][c] + (pts[i + 1][c] - pts[i][c]) * f for c in range(len(pts[0]))))
    return out


HALF = resample(PROF, 15)                         # wall at the floor -> the middle of the ceiling
FULL = HALF + [(-x, z) for x, z in reversed(HALF[:-1])]   # right floor -> over -> left floor


def inward(x, z):
    v = Vector((-x, 0, 1.3 - z))
    return v.normalized()


def box(name, c, size, colour, mat="frame"):
    (x, y, z), (w, d, h) = c, size
    v = [(x + sx * w / 2, y + sy * d / 2, z + sz * h / 2) for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    o = C.mesh_from(name, v, f, M[mat], lambda q: (x, y, z))
    C.paint(o, C.flat(colour))
    return o


def tube(name, a, b, r, colour, mat="frame", n=10):
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    t = d.cross(Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))).normalized()
    u = d.cross(t)
    rings = []
    for p in (a, b):
        rings.append([tuple(p + (t * math.cos(2 * math.pi * k / n) + u * math.sin(2 * math.pi * k / n)) * r) for k in range(n)])
    o = C.loft(name, rings, M[mat], lambda q: tuple(a + d * (Vector(q) - a).dot(d)), cap0=True, cap1=True)
    C.paint(o, C.flat(colour))
    return o


def cyl_x(name, c, r, length, colour, mat="frame", n=12):
    x, y, z = c
    return tube(name, (x - length / 2, y, z), (x + length / 2, y, z), r, colour, mat, n)


def text(body, font, size, loc, facing, colour, mat="stencil", align="CENTER", depth=0.0):
    """Paint stencilled on a face: `facing` is the face's outward axis
    ('+x', '-x', '+y', '-y', '+z')."""
    cu = bpy.data.curves.new("t", "FONT")
    cu.body = body
    f = os.path.join("C:/Windows/Fonts", font)
    if os.path.exists(f):
        cu.font = bpy.data.fonts.load(f, check_existing=True)
    cu.size = size
    cu.extrude = depth
    cu.resolution_u = 3 if size >= 0.1 else 2
    cu.fill_mode = "FRONT"
    cu.align_x = align
    cu.align_y = "CENTER"
    o = bpy.data.objects.new("txt", cu)
    C.link(o)
    # the text's right, up and normal as world axes
    R = {"+x": (0, 1, 0), "-x": (0, -1, 0), "-y": (1, 0, 0), "+y": (-1, 0, 0), "+z": (1, 0, 0)}[facing]
    U = (0, 1, 0) if facing == "+z" else (0, 0, 1)
    N = Vector(R).cross(Vector(U))
    o.rotation_euler = Matrix((R, U, tuple(N))).transposed().to_euler()
    o.location = loc
    C.select_only(o)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.0004)
    bpy.ops.mesh.dissolve_limited(angle_limit=math.radians(4))
    bpy.ops.mesh.quads_convert_to_tris()
    bpy.ops.object.mode_set(mode="OBJECT")
    o.data.materials.clear()
    o.data.materials.append(M[mat])
    C.paint(o, C.flat(colour))
    return o


# =================================================================== shell

def build_lining():
    """Quilted insulation blankets between the frames: every bay puffs
    inward, stitched in panels round the profile."""
    per = 4
    ys = [HOLD_FWD - BAY * k / per for k in range(BAYS * per + 1)]
    arcs = [0.0]
    for a, b in zip(FULL, FULL[1:]):
        arcs.append(arcs[-1] + math.dist(a, b))
    rings = []
    for i, y in enumerate(ys):
        fy = (i % per) / per
        r = []
        for (x, z), s in zip(FULL, arcs):
            fa = (s / 0.62) % 1.0
            puff = 0.035 * math.sin(math.pi * fy) * math.sin(math.pi * fa)
            n = inward(x, z)
            r.append((x + n.x * puff, y, z + n.z * puff))
        rings.append(r)
    wins = [(s * 1.70, y, C.WINDOW_Z) for y in C.WINDOWS_Y for s in (1, -1)]

    def skip(i, j):
        y = (ys[i] + ys[i + 1]) / 2
        x = (FULL[j][0] + FULL[j + 1][0]) / 2
        z = (FULL[j][1] + FULL[j + 1][1]) / 2
        return any(abs(x - wx) < 0.3 and math.hypot(y - wy, z - wz) < 0.27 for wx, wy, wz in wins)

    o = C.loft("lining", rings, M["lining"], lambda q: (0, q.y, 1.3), closed=False, skip=skip, flip=True)
    C.paint(o, lambda p, n: LINING_DK if (p.z < 0.25) else LINING)
    return o


def build_frames():
    """A frame at every bay: a channel standing proud of the lining."""
    out = []
    for k in range(BAYS + 1):
        y = HOLD_FWD - k * BAY
        pts = resample(FULL, 40)
        rings = []
        for x, z in pts:
            n = inward(x, z)
            rings.append([(x, y - 0.03, z), (x + n.x * 0.075, y - 0.03, z + n.z * 0.075),
                          (x + n.x * 0.075, y + 0.03, z + n.z * 0.075), (x, y + 0.03, z)])
        o = C.loft("frame", rings, M["frame"], lambda q, y=y: (q.x * 1.3, y, 1.3 + (q.z - 1.3) * 1.3), closed=False)
        C.paint(o, C.flat(FRAME))
        out.append(o)
    return out


def build_windows():
    """The two round windows each side: a rubber-ringed frame on the
    lining and a well through to the skin (c130.glb's glass faces out, so
    the world shows through)."""
    out = []
    for y in C.WINDOWS_Y:
        for s in (1, -1):
            top, bot, hw = C.section(y)
            # the well, from the lining out to the skin
            rings = []
            for x in (s * 1.66, s * (hw - 0.02)):
                rings.append([(x, y + 0.22 * math.cos(2 * math.pi * k / 20), C.WINDOW_Z + 0.22 * math.sin(2 * math.pi * k / 20)) for k in range(20)])
            o = C.loft("well", rings, M["frame"], lambda q, s=s: (q.x, y, C.WINDOW_Z), flip=True)
            C.paint(o, C.flat(DECK_DK))
            out.append(o)
            # the frame ring
            rings = []
            for r, x in ((0.21, s * 1.64), (0.36, s * 1.66), (0.36, s * 1.73), (0.21, s * 1.70)):
                rings.append([(x, y + r * math.cos(2 * math.pi * k / 24), C.WINDOW_Z + r * math.sin(2 * math.pi * k / 24)) for k in range(24)])
            o = C.loft("wframe", rings[:3], M["frame"], lambda q, s=s: (s * 1.8, y, C.WINDOW_Z))
            C.paint(o, C.flat(RUBBER))
            out.append(o)
    return out


def build_floor():
    out = []
    out.append(box("deck", (0, 0, -0.04), (3.12, HOLD_FWD - HOLD_AFT, 0.08), DECK, "deck"))
    # the roller tracks: a channel each side of the middle with rollers in it
    for s in (1, -1):
        x = s * 0.62
        for e in (-1, 1):
            out.append(box("rail", (x + e * 0.075, 0, 0.012), (0.018, HOLD_FWD - HOLD_AFT - 0.2, 0.024), FRAME))
        n = int((HOLD_FWD - HOLD_AFT - 0.3) / 0.28)
        for k in range(n):
            y = HOLD_FWD - 0.25 - k * 0.28
            out.append(cyl_x("roller", (x, y, 0.008), 0.026, 0.13, TUBE, n=8))
    # tie-down rings, a grid in the deck
    for k in range(12):
        y = HOLD_FWD - 0.55 - k * 1.04
        for x in (-1.18, -0.18, 0.18, 1.18):
            rings = []
            for r, z in ((0.05, 0.003), (0.05, 0.012), (0.035, 0.012), (0.035, 0.003)):
                rings.append([(x + r * math.cos(2 * math.pi * j / 8), y + r * math.sin(2 * math.pi * j / 8), z) for j in range(8)])
            o = C.loft("ring", rings, M["frame"], lambda q, x=x, y=y: (x, y, 0.0075 + (q.z - 0.0075) * 0.1) if math.hypot(q.x - x, q.y - y) > 0.042 else (q.x + (q.x - x) * 4, q.y + (q.y - y) * 4, 0.0075))
            C.paint(o, C.flat(TUBE))
            out.append(o)
    # floor plate joints
    for k in range(1, 6):
        y = HOLD_FWD - k * (HOLD_FWD - HOLD_AFT) / 6
        out.append(box("joint", (0, y, 0.001), (3.1, 0.012, 0.004), DECK_DK, "deck"))
    return out


def build_bulkheads():
    """The forward bulkhead (the flight deck's wall, with the crew hatch,
    steps up to it and the placards) and the aft frame round the ramp
    opening, joining the hold to the tail's lining."""
    out = []
    y = HOLD_FWD
    verts = [(0, y, 1.3)] + [(x, y, z) for x, z in FULL]
    faces = [(0, k, k + 1) for k in range(1, len(FULL))] + [(0, len(FULL), 1)]
    faces = [(0, k, k + 1) for k in range(1, len(FULL))]
    o = C.mesh_from("fwd", verts + [(0, y, 0)], faces + [(0, len(FULL), len(FULL) + 1), (0, len(FULL) + 1, 1)], M["lining"], lambda q: (0, y + 1, 1.3))
    C.paint(o, C.flat(LINING_DK))
    out.append(o)
    # the crew hatch, left of the middle, up three steps
    out.append(box("hatch", (-0.9, y - 0.03, 1.55), (0.72, 0.05, 1.12), FRAME))
    out.append(box("hatchin", (-0.9, y - 0.06, 1.55), (0.62, 0.03, 1.02), LINING_DK))
    out.append(box("handle", (-0.66, y - 0.1, 1.55), (0.04, 0.05, 0.18), TUBE))
    for k in range(3):
        out.append(box("step", (-0.9, y - 0.2 - (2 - k) * 0.25, 0.25 + k * 0.33), (0.7, 0.26, 0.05), DECK, "deck"))
        out.append(box("stepside", (-0.53, y - 0.45, 0.48), (0.03, 0.7, 0.96), FRAME))
    out.append(tube("rail", (-0.5, y - 0.95, 0.9), (-0.5, y - 0.1, 1.9), 0.02, TUBE))
    # placards
    out.append(box("plac1", (0.75, y - 0.03, 1.9), (0.62, 0.02, 0.26), WHITE))
    out.append(text("NO SMOKING", "STENCIL.TTF", 0.075, (0.75, y - 0.045, 1.94), "-y", RED))
    out.append(text("FASTEN SEAT BELTS", "AGENCYB.TTF", 0.05, (0.75, y - 0.045, 1.85), "-y", (0x22, 0x22, 0x22)))
    out.append(box("plac2", (0.75, y - 0.03, 1.45), (0.5, 0.02, 0.36), (0x2a, 0x2e, 0x22)))
    out.append(text("TROLL AIR\nMOBILITY", "STENCIL.TTF", 0.07, (0.75, y - 0.045, 1.45), "-y", STENCIL))
    # the aft frame: hold profile -> the tail's lining, both halves
    ring = C.fuse_ring(HOLD_AFT, 0.12)
    right = ring[0:C.SIDE_N + 1]                  # top -> the opening's edge
    a = resample([(p[0], p[2]) for p in right], 16)
    b = resample(list(reversed(HALF)), 16)        # ceiling middle -> wall at the floor
    for s in (1, -1):
        verts, faces = [], []
        for (ax, az), (bx, bz) in zip(a, b):
            verts += [(s * ax, HOLD_AFT, az), (s * bx, HOLD_AFT, bz)]
        for k in range(15):
            faces.append((2 * k, 2 * k + 2, 2 * k + 3, 2 * k + 1))
        o = C.mesh_from("aftframe", verts, faces, M["frame"], lambda q: (q.x, HOLD_AFT - 1, q.z))
        C.select_only(o)
        sol = o.modifiers.new("sol", "SOLIDIFY")
        sol.thickness = 0.06
        bpy.ops.object.modifier_apply(modifier=sol.name)
        C.paint(o, C.flat(FRAME))
        out.append(o)
    return out


def build_tail_lining():
    """Lines the upswept tail over the ramp, the sides and the roof only:
    the bottom is the opening (the ramp and the door close it)."""
    ys = [HOLD_AFT - (HOLD_AFT - C.DOOR_Y) * k / 12 for k in range(13)]
    rings = []
    for y in ys:
        r = C.fuse_ring(y, 0.12)
        rings.append(r[C.SIDE_N:] + r[:C.SIDE_N + 1] if False else r[C.SIDE_N + C.BOT_N:] + r[:C.SIDE_N + 1])
    o = C.loft("tailin", rings, M["lining"], lambda q: (0, q.y, C.section(q.y)[0] - 1.2), closed=False, flip=True)
    C.paint(o, C.flat(LINING_DK))
    out = [o]
    # the tail's frames
    for k in range(1, 6):
        y = HOLD_AFT - (HOLD_AFT - C.DOOR_Y) * k / 6
        r = C.fuse_ring(y, 0.12)
        pts = r[C.SIDE_N + C.BOT_N:] + r[:C.SIDE_N + 1]
        zc = C.section(y)[0] - 1.2
        rings = []
        for x, _, z in pts:
            n = Vector((-x, 0, zc - z)).normalized()
            rings.append([(x, y - 0.03, z), (x + n.x * 0.07, y - 0.03, z + n.z * 0.07), (x + n.x * 0.07, y + 0.03, z + n.z * 0.07), (x, y + 0.03, z)])
        o = C.loft("tframe", rings, M["frame"], lambda q, y=y, zc=zc: (q.x * 1.5, y, zc + (q.z - zc) * 1.5), closed=False)
        C.paint(o, C.flat(FRAME))
        out.append(o)
    return out


def build_overhead():
    out = []
    # the static-line cables and their hangers
    for s in (1, -1):
        out.append(tube("cable", (s * 0.55, HOLD_FWD - 0.3, 2.6), (s * 0.55, HOLD_AFT + 0.2, 2.6), 0.009, TUBE, n=8))
        for k in range(5):
            y = HOLD_FWD - 0.5 - k * 2.8
            out.append(tube("hanger", (s * 0.55, y, 2.6), (s * 0.55, y, 2.75), 0.012, FRAME, n=6))
    # dome lights in the ceiling every fourth bay
    for k in range(2, BAYS, 4):
        y = HOLD_FWD - (k + 0.5) * BAY
        out.append(box("lamp", (0, y, 2.72), (0.34, 0.16, 0.05), FRAME))
        out.append(box("lampglow", (0, y, 2.69), (0.28, 0.11, 0.02), WHITE, "glow"))
    # the jump lights either side of the ramp frame
    for s in (1, -1):
        x = s * 1.42
        out.append(box("jumpbox", (x, HOLD_AFT + 0.14, 1.95), (0.16, 0.1, 0.42), (0x1a, 0x1b, 0x1a)))
        for z, mat, col in ((2.07, "red", (0xff, 0x30, 0x20)), (1.83, "green", (0x30, 0xff, 0x60))):
            rings = []
            for r, yy in ((0.066, HOLD_AFT + 0.188), (0.06, HOLD_AFT + 0.212)):
                rings.append([(x + r * math.cos(2 * math.pi * k / 14), yy, z + r * math.sin(2 * math.pi * k / 14)) for k in range(14)])
            o = C.loft("lens", rings, M[mat], lambda q, z=z: (x, HOLD_AFT + 0.1, z), cap1=True)
            C.paint(o, C.flat(col))
            out.append(o)
        out.append(text("JUMP", "STENCIL.TTF", 0.05, (x, HOLD_AFT + 0.192, 2.21), "+y", STENCIL))
    return out


# =================================================================== seats

def build_seats():
    out = []
    for s in (1, -1):
        ys = [y for side, y in SEATS if side == s]
        y0, y1 = max(ys) + 0.45, min(ys) - 0.45
        fx, bx = s * 1.06, s * 1.58
        out.append(tube("front", (fx, y0, SEAT_Z), (fx, y1, SEAT_Z), 0.022, TUBE))
        out.append(tube("rear", (bx, y0, SEAT_Z + 0.02), (bx, y1, SEAT_Z + 0.02), 0.02, TUBE))
        out.append(tube("back", (s * 1.64, y0, 1.12), (s * 1.64, y1, 1.12), 0.02, TUBE))
        for y in [y0] + [(a + b) / 2 for a, b in zip(sorted(ys), sorted(ys)[1:])] + [y1]:
            out.append(tube("leg", (fx, y, SEAT_Z), (s * 1.0, y, 0.0), 0.018, TUBE))
            out.append(tube("strut", (bx, y, SEAT_Z + 0.02), (s * 1.64, y, 1.12), 0.015, TUBE))
        for y in ys:
            # the pan: webbing straps across the seat's depth, sagging
            for k in range(6):
                yy = y - 0.21 + k * 0.084
                verts, faces = [], []
                for j in range(5):
                    t = j / 4
                    x = fx + (bx - fx) * t
                    z = SEAT_Z + 0.01 - 0.035 * math.sin(math.pi * t)
                    verts += [(x, yy - 0.034, z), (x, yy + 0.034, z), (x, yy - 0.034, z + 0.008), (x, yy + 0.034, z + 0.008)]
                for j in range(4):
                    a = 4 * j
                    faces += [(a + 2, a + 3, a + 7, a + 6), (a, a + 4, a + 5, a + 1), (a, a + 2, a + 6, a + 4), (a + 1, a + 5, a + 7, a + 3)]
                o = C.mesh_from("web", verts, faces, M["web"], lambda q: (q.x, yy, SEAT_Z - 0.3))
                C.paint(o, C.flat(WEB))
                out.append(o)
            # the back: straps up the wall
            for k in range(5):
                yy = y - 0.18 + k * 0.09
                out.append(box("webback", (s * 1.615, yy, 0.8), (0.012, 0.07, 0.62), WEB, "web"))
            # the belt, its buckle hanging off the front
            out.append(box("belt", (fx - s * 0.01, y + 0.1, SEAT_Z - 0.12), (0.01, 0.045, 0.24), (0x2c, 0x2c, 0x28), "web"))
            out.append(box("buckle", (fx - s * 0.015, y + 0.1, SEAT_Z - 0.25), (0.016, 0.06, 0.05), TUBE))
    return out


# =================================================================== cargo

def ammo_can(c, rot=False):
    x, y, z = c
    w, d, h = (0.30, 0.17, 0.21) if rot else (0.17, 0.30, 0.21)
    out = [box("can", (x, y, z + h / 2), (w, d, h), CAN, "can"),
           box("lid", (x, y, z + h + 0.012), (w + 0.01, d + 0.01, 0.024), (0x34, 0x3c, 0x26), "can"),
           box("handle", (x, y, z + h + 0.035), (0.03 if not rot else 0.12, 0.12 if not rot else 0.03, 0.016), (0x26, 0x2a, 0x1e), "can")]
    if rot:
        out.append(text("8 GAUGE", "STENCIL.TTF", 0.045, (x, y - d / 2 - 0.001, z + 0.13), "-y", STENCIL))
        out.append(text("TAK 400 RDS", "AGENCYB.TTF", 0.022, (x, y - d / 2 - 0.001, z + 0.085), "-y", STENCIL))
    else:
        sx = 1 if x > 0 else -1
        face = "-x" if sx > 0 else "+x"
        out.append(text("8 GAUGE", "STENCIL.TTF", 0.045, (x - sx * (w / 2 + 0.001), y, z + 0.13), face, STENCIL))
        out.append(text("TAK 400 RDS", "AGENCYB.TTF", 0.022, (x - sx * (w / 2 + 0.001), y, z + 0.085), face, STENCIL))
    return out


def jerry(c):
    x, y, z = c
    out = [box("jerry", (x, y, z + 0.235), (0.17, 0.34, 0.47), CREAM, "can")]
    for k in (-1, 0, 1):
        out.append(box("jh", (x, y + k * 0.07, z + 0.5), (0.03, 0.035, 0.05), CREAM, "can"))
    out.append(cyl_x("cap", (x, y + 0.12, z + 0.5), 0.03, 0.06, (0x30, 0x30, 0x2c)))
    return out


def pistol(c, yaw):
    """A pistol lying on its side: slide, frame, the grip out sideways, the
    trigger guard; built at the origin and turned to yaw."""
    x, y, z = c
    parts = [box("slide", (0.02, 0, 0.026), (0.2, 0.034, 0.03), GUN, "gun"),
             box("frame", (0.0, 0, 0.008), (0.16, 0.03, 0.016), GUN, "gun"),
             box("grip", (-0.06, 0.065, 0.016), (0.048, 0.11, 0.03), GUN, "gun"),
             box("guard", (0.0, 0.03, 0.012), (0.05, 0.045, 0.008), GUN, "gun"),
             box("sight", (0.11, 0, 0.044), (0.012, 0.008, 0.008), GUN, "gun")]
    o = C.join(parts, "pistol")
    o.rotation_euler = (0, 0, yaw)
    o.location = (x, y, z)
    C.select_only(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return [o]


def mag(c):
    x, y, z = c
    return [box("mag", (x, y, z + 0.06), (0.03, 0.022, 0.12), GUN, "gun"),
            box("rounds", (x, y, z + 0.124), (0.022, 0.012, 0.012), BRASS, "gun")]


def grenade(c):
    x, y, z = c
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.065, location=(x, y, z + 0.065), segments=16, ring_count=10)
    o = bpy.context.view_layer.objects.active
    o.data.materials.append(M["can"])
    C.paint(o, lambda p, n: RED if abs(p.z - (z + 0.085)) < 0.012 else (0x2a, 0x30, 0x22))
    return [o, box("spoon", (x + 0.02, y, z + 0.135), (0.06, 0.018, 0.01), TUBE),
            cyl_x("pin", (x - 0.02, y, z + 0.14), 0.012, 0.01, TUBE)]


def strap_over(y, hw, h, z0=0.06):
    """A yellow ratchet strap from a floor ring up over a load and down."""
    path = [(-hw - 0.12, 0.0), (-hw - 0.01, z0 + h * 0.3), (-hw, z0 + h + 0.004), (hw, z0 + h + 0.004), (hw + 0.01, z0 + h * 0.3), (hw + 0.12, 0.0)]
    verts, faces = [], []
    for x, z in path:
        verts += [(x, y - 0.025, z + 0.003), (x, y + 0.025, z + 0.003)]
    for k in range(len(path) - 1):
        faces.append((2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2))
    o = C.mesh_from("strap", verts, faces, M["web"], lambda q: (0, y, 0.2))
    C.select_only(o)
    sol = o.modifiers.new("sol", "SOLIDIFY")
    sol.thickness = 0.006
    bpy.ops.object.modifier_apply(modifier=sol.name)
    C.paint(o, C.flat(STRAP))
    return [o, box("ratchet", (hw + 0.05, y, z0 + h * 0.15), (0.05, 0.07, 0.09), TUBE)]


def build_cargo():
    out = []
    # the pallet in the middle, forward, with the $TROLL crate strapped on
    out.append(box("pallet", (0, 3.35, 0.03), (0.86, 2.5, 0.06), (0x80, 0x84, 0x80), "frame"))
    cy, cl, cw, ch = 3.3, 1.9, 0.74, 0.5
    z0 = 0.06
    out.append(box("crate", (0, cy, z0 + ch / 2), (cw, cl, ch), WOOD, "wood"))
    # battens round the edges and two bands
    for yy in (cy - cl / 2 + 0.04, cy - 0.3, cy + 0.3, cy + cl / 2 - 0.04):
        out.append(box("band", (0, yy, z0 + ch / 2), (cw + 0.02, 0.07, ch + 0.02), WOOD_DK, "wood"))
    for sx in (-1, 1):
        for sz in (0, 1):
            out.append(box("batten", (sx * (cw / 2 + 0.005), cy, z0 + 0.03 + sz * (ch - 0.06)), (0.015, cl, 0.06), WOOD_DK, "wood"))
    for sx in (-1, 1):
        for sy in (-1, 1):
            out.append(box("corner", (sx * (cw / 2 - 0.02), cy + sy * (cl / 2 - 0.02), z0 + ch / 2), (0.06, 0.06, ch + 0.03), (0x2c, 0x2c, 0x2a), "frame"))
    for sx, face in ((1, "+x"), (-1, "-x")):
        xx = sx * (cw / 2 + 0.013)
        out.append(text("$TROLL", "STENCIL.TTF", 0.2, (xx, cy, z0 + ch * 0.6), face, STENCIL))
        out.append(text("M-LULZ SURFACE-TO-SURFACE PRANK   (x2)", "AGENCYB.TTF", 0.032, (xx, cy, z0 + ch * 0.26), face, STENCIL))
        out.append(text("HANDLE WITH LULZ  ·  THIS SIDE UP", "AGENCYB.TTF", 0.026, (xx, cy, z0 + ch * 0.16), face, STENCIL))
    for yy in (cy - 0.62, cy + 0.62):
        out += strap_over(yy, cw / 2, ch)
    # on the crate: two pistols and their mags laid out
    top = z0 + ch + 0.006
    out += pistol((0.12, cy - 0.5, top), 0.3)
    out += pistol((-0.14, cy - 0.15, top), 2.8)
    for k in range(3):
        out += mag((0.18 + k * 0.045 - 0.1, cy + 0.15, top))
    # 8 gauge cans, three stacked at the crate's forward end
    out += ammo_can((0, cy + cl / 2 + 0.2, 0.06), rot=True)
    out += ammo_can((0, cy + cl / 2 + 0.2, 0.06 + 0.235), rot=True)
    # the forward right corner: more cans and two jerry cans
    for k, (x, y, z) in enumerate(((1.2, 5.75, 0), (1.2, 5.42, 0), (1.2, 5.75, 0.235), (0.98, 5.9, 0))):
        out += ammo_can((x, y, z))
    out += jerry((0.6, 5.95, 0))
    out += jerry((0.35, 5.98, 0))
    # under the port seats: mags, a grenade, a pistol
    for k in range(4):
        out += mag((-1.25 + (k % 2) * 0.05, -0.3 - k * 0.07, 0))
    out += grenade((-1.2, -1.75, 0))
    out += grenade((1.22, 0.55, 0))
    out += pistol((-1.18, -2.3, 0), 1.2)
    out += pistol((1.2, -1.2, 0), -0.6)
    return out


# =================================================================== build

def build():
    C.clear_scene()
    M["lining"] = C.material("H_Lining", rough=0.95, metal=0.0)
    M["frame"] = C.material("H_Frame", rough=0.42, metal=0.7)
    M["deck"] = C.material("H_Deck", rough=0.55, metal=0.55)
    M["web"] = C.material("H_Webbing", rough=0.85, metal=0.0)
    M["wood"] = C.material("H_Wood", rough=0.72, metal=0.0)
    M["can"] = C.material("H_Can", rough=0.5, metal=0.35)
    M["stencil"] = C.material("H_Stencil", rough=0.6, metal=0.0)
    M["gun"] = C.material("H_Gun", rough=0.32, metal=0.85)
    M["glow"] = C.material("H_Glow", rough=0.5, metal=0.0)
    M["red"] = C.material("H_JumpRed", rough=0.2, metal=0.0)
    M["green"] = C.material("H_JumpGreen", rough=0.2, metal=0.0)
    parts = [build_lining()]
    parts += build_frames()
    parts += build_windows()
    parts += build_floor()
    parts += build_bulkheads()
    parts += build_tail_lining()
    parts += build_overhead()
    parts += build_seats()
    parts += build_cargo()
    import collections
    cnt = collections.Counter()
    for o in parts:
        cnt[o.name.split(".")[0]] += sum(len(p.vertices) - 2 for p in o.data.polygons)
    print("PARTS", cnt.most_common(12))
    hold = C.join(parts, "C130_Hold")
    print("PRE-FINISH", sum(len(p.vertices) - 2 for p in hold.data.polygons))
    C.finish(hold, bevel=0.0)
    C.set_origin(hold, (0, 0, 0))
    seats = []
    for i, (s, y) in enumerate(SEATS):
        e = bpy.data.objects.new(f"Hold_Seat_{i}", None)
        e.location = (s * SEAT_X, y, SEAT_Z)
        C.link(e)
        C.parent(e, hold)
        seats.append(e)
    C.select_only(hold, *seats)
    path = os.path.join(HERE, "c130-hold.glb")
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_yup=True, export_apply=True)
    print("Exported", path, "tris", sum(len(p.vertices) - 2 for p in hold.data.polygons))


build()
print("HOLD DONE")
