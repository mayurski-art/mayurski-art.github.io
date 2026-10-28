"""
Grinmoor Manor (phase 1 of "Troll Forces: Hollowgrin in Blender"): the shell
and everything still inside it, hg-manor.glb, in map coordinates.

Drawn over the colliders maps/hollowgrin.js lays (frozen in
hollowgrin-layout.json): the walls and their openings, the floors, the grand
stair, the porch and balcony, the chimneys, the turret, and the furniture
blocks. Numbers here are the JS's: change an opening there, change it here.
The JS keeps what glows or flickers (the candles, the lamp glass, the lit
windows, the fireplace's embers, the jack-o'-lanterns, the lights) and the
portraits (house-props.js).
"""
import math
import random

from map_kit import TEXTURED, mat
from hg_kit import HGBuilder, Wall, casings, clapboard, facing, fbox, gable_prism, lathe, ring, skin, slates

TEXTURED.update({"HG_Floorboards", "HG_Brick", "HG_GraniteDark"})

# the JS's numbers (hollowgrin.js MANOR, WALL_T, SLAB_Y, UP, CEIL, WALL_H, STAIR)
X0, X1, Z0, Z1 = -13.0, 13.0, -28.0, -12.0
T = 0.4
SLAB_Y, UP, CEIL, WALL_H = 3.3, 3.6, 6.6, 6.9
STAIR = dict(x=0.0, z=-14.8, width=3.0, steps=12, rise=0.3, run=0.5)
HOLE = (-1.6, 1.6, -20.8, -14.8)       # x0, x1, z0, z1
MID_X, MID_Z = 0.0, -20.0

# hollowgrin.js wall() calls: [axis, at, a, b, out, holes]
WALLS = [
    ("x", Z1 - T / 2, X0, X1, 1, [
        {"c": 0, "w": 2.2, "spans": [(0, 2.7), (UP, UP + 2.4)]},
        {"c": -3.6, "w": 1.4, "spans": [(1.0, 2.5)]},
        {"c": 3.6, "w": 1.4, "spans": [(1.0, 2.5)]},
        {"c": -9.5, "w": 1.6, "spans": [(1.0, 2.5), (4.5, 5.9)]},
        {"c": 9.5, "w": 1.6, "spans": [(1.0, 2.5), (4.5, 5.9)]}]),
    ("x", Z0 + T / 2, X0, X1, -1, [
        {"c": -8, "w": 1.8, "spans": [(0, 2.4), (4.5, 5.9)]},
        {"c": 8, "w": 1.8, "spans": [(0, 2.4), (4.5, 5.9)]},
        {"c": -3, "w": 1.4, "spans": [(1.0, 2.5), (4.5, 5.9)]},
        {"c": 3, "w": 1.4, "spans": [(1.0, 2.5), (4.5, 5.9)]}]),
    ("z", X0 + T / 2, Z0 + T, Z1 - T, -1, [
        {"c": -20, "w": 2.0, "spans": [(0, 2.5), (4.5, 5.9)]},
        {"c": -15.5, "w": 1.4, "spans": [(1.0, 2.5), (4.5, 5.9)]}]),
    ("z", X1 - T / 2, Z0 + T, Z1 - T, 1, [
        {"c": -20, "w": 2.0, "spans": [(0, 2.5), (4.5, 5.9)]},
        {"c": -15.5, "w": 1.4, "spans": [(1.0, 2.5), (4.5, 5.9)]},
        {"c": -23.4, "w": 1.2, "spans": [(1.0, 2.4)]}]),
]
PART_HOLES = ([{"c": -16.5, "w": 1.8, "spans": [(0, 2.4)]}, {"c": -24.5, "w": 1.8, "spans": [(0, 2.4)]}],
              [{"c": -16.5, "w": 1.8, "spans": [(0, 2.3)]}, {"c": -24.5, "w": 1.8, "spans": [(0, 2.3)]}])

# the rooms, by x along the long walls: (x0, x1, ground paper, upstairs paper)
ROOMS = [(X0 + T, -5.125, "paper_green", "paper_violet"),
         (-4.875, 4.875, "paper_red", "paper_umber"),
         (5.125, X1 - T, "paper_teal", "paper_green")]


def palette():
    return {
        "siding": mat("HG_Siding", 0x4c4656, 0.85),
        "core": mat("HG_ManorCore", 0x4a4052, 0.85),
        "trim": mat("HG_ManorTrim", 0xb8ad98, 0.75),
        "trim_dk": mat("HG_TrimDark", 0x2b2420, 0.7),
        "shutter": mat("HG_Shutter", 0x1f2e27, 0.85),
        "slate1": mat("HG_Slate1", 0x3e4050, 0.8),
        "slate2": mat("HG_Slate2", 0x4a4c5c, 0.8),
        "slate3": mat("HG_Slate3", 0x353744, 0.8),
        "slate4": mat("HG_Slate4", 0x45403f, 0.85),
        "ridge": mat("HG_RidgeLead", 0x2a2c30, 0.5, 0.3),
        "granite_dk": mat("HG_GraniteDark", 0x5a5a62, 0.9),
        "stone": mat("HG_Stone", 0x77757c, 0.9),
        "brick": mat("HG_Brick", 0x8a4a3a, 0.9),
        "floor": mat("HG_Floorboards", 0x6a4a30, 0.8),
        # inside: wallpaper, panelling and ceilings glow faintly of their own
        # colour (the bounce light the JS gave its rooms) until the bake
        "plaster": mat("HG_CeilingPlaster", 0x6a6258, 0.95, emit=0x6a6258, emit_strength=0.07),
        "wainscot": mat("HG_Wainscot", 0x4a2e22, 0.6, emit=0x4a2e22, emit_strength=0.22),
        "panel": mat("HG_WainscotPanel", 0x3c2419, 0.6, emit=0x3c2419, emit_strength=0.22),
        "paper_green": mat("HG_PaperGreen", 0x2c4636, 0.85, emit=0x2c4636, emit_strength=0.17),
        "paper_red": mat("HG_PaperRed", 0x52262a, 0.85, emit=0x52262a, emit_strength=0.17),
        "paper_teal": mat("HG_PaperTeal", 0x26404c, 0.85, emit=0x26404c, emit_strength=0.17),
        "paper_violet": mat("HG_PaperViolet", 0x45304e, 0.85, emit=0x45304e, emit_strength=0.17),
        "paper_umber": mat("HG_PaperUmber", 0x3e372c, 0.85, emit=0x3e372c, emit_strength=0.17),
        "oak": mat("HG_Oak", 0x5a3a24, 0.6),
        "oak_dk": mat("HG_OakDark", 0x34221a, 0.55),
        "velvet": mat("HG_Velvet", 0x5a2446, 0.95),
        "velvet_dk": mat("HG_VelvetDark", 0x3a1c32, 0.95),
        "sheet": mat("HG_DustSheet", 0xb8b2a4, 0.95),
        "linen": mat("HG_Linen", 0xc8c0ac, 0.9),
        "iron": mat("HG_Iron", 0x1c1c22, 0.55, 0.3),
        "brass": mat("HG_Brass", 0xc8a050, 0.35, 0.4),
        "glass": mat("HG_GlassDark", 0x1a2028, 0.1),
        "ivory": mat("HG_Ivory", 0xe0d8c0, 0.4),
        "ebony": mat("HG_Ebony", 0x121014, 0.4),
        "dial": mat("HG_Dial", 0xd8cfb4, 0.6),
        "soot": mat("HG_Soot", 0x141214, 1.0),
        "log": mat("HG_Log", 0x3a2a1c, 0.9),
        "rot": mat("HG_RotGreen", 0x5a6a3a, 0.9),
        "meat": mat("HG_RoastMeat", 0x6a3a22, 0.7),
        "bone": mat("HG_Bone", 0xd8d0b8, 0.7),
        "wine": mat("HG_Wine", 0x3a0a14, 0.2),
        "pewter": mat("HG_Pewter", 0x8a8c90, 0.4, 0.4),
        "cake": mat("HG_Cake", 0x6a5a6a, 0.8),
        "rug": mat("HG_Rug", 0x4a1c22, 0.95),
        "rug2": mat("HG_RugBorder", 0x8a6a3a, 0.95),
        "rug3": mat("HG_RugBlue", 0x1c2a44, 0.95),
        "red": mat("HG_BookRed", 0x6a1a1a, 0.7),
        "green": mat("HG_BookGreen", 0x1e3a24, 0.7),
        "blue": mat("HG_BookBlue", 0x1c2a4a, 0.7),
        "tan": mat("HG_BookTan", 0x8a6a42, 0.7),
        "black": mat("HG_BookBlack", 0x1a1618, 0.7),
        "plum": mat("HG_BookPlum", 0x3e1a3a, 0.7),
        "gilt": mat("HG_Gilt", 0xb89040, 0.35, 0.5),
    }


def box2(b, m, x0, x1, y0, y1, z0, z1, **kw):
    """A box by its extents."""
    b.box(m, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, **kw)


# ------------------------------------------------------------------ the shell

def shell(b, P):
    rnd = random.Random(7)
    walls = []
    for axis, at, a, b_, out, holes in WALLS:
        w = Wall(axis, at, a, b_, WALL_H, T, holes=holes, out=out)
        walls.append(w)
        w.solid(b, P["core"])
        # outside: a granite plinth, lap siding over it, corner boards
        skin(b, P["granite_dk"], w, a - (0.1 if axis == "x" else 0), b_ + (0.1 if axis == "x" else 0), 0, 0.6, 0.1, side=1, top=True)
        skin(b, P["trim"], w, a, b_, 0.6, 0.68, 0.13, side=1, top=True)       # water table
        clapboard(b, P["siding"], w, a, b_, 0.68, WALL_H - 0.4, every=0.22, proud=0.03)
        skin(b, P["trim"], w, a, b_, SLAB_Y - 0.05, SLAB_Y + 0.22, 0.06, side=1, top=True)   # the band between the storeys
        skin(b, P["trim"], w, a, b_, WALL_H - 0.4, WALL_H, 0.05, side=1)          # frieze under the eaves
        casings(b, P["trim"], w, fw=0.14, proud=0.06)
        casings(b, P["oak_dk"], w, fw=0.09, proud=0.03, sill=False, side=-1)
        for hole in holes:
            for lo, hi in hole["spans"]:
                window(b, P, w, hole, lo, hi, rnd)
        # inside: wainscot, a chair rail and wallpaper per room and floor
        for y0, y1, k in ((0.0, SLAB_Y, 2), (UP, CEIL, 3)):
            if axis == "x":
                for rx0, rx1, *paper in ROOMS:
                    interior(b, P, w, max(a, rx0), min(b_, rx1), y0, y1, P[paper[k - 2]])
            else:
                room = ROOMS[0] if at < 0 else ROOMS[2]
                interior(b, P, w, a, b_, y0, y1, P[room[k]])
    # corner boards: one on each face, the side one lapping the front one
    for cx, sx in ((X0, -1), (X1, 1)):
        for cz, sz in ((Z0, -1), (Z1, 1)):
            box2(b, P["trim"], *sorted((cx - sx * 0.24, cx + sx * 0.06)), 0.6, WALL_H, *sorted((cz, cz + sz * 0.06)))
            box2(b, P["trim"], *sorted((cx, cx + sx * 0.06)), 0.6, WALL_H, *sorted((cz - sz * 0.24, cz + sz * 0.06)))

    # the partitions, both floors: parlour | foyer | dining, bedroom | gallery | library
    for px in (-5.0, 5.0):
        for k, (y, h) in enumerate(((0.0, SLAB_Y), (UP, CEIL - UP))):
            w = Wall("z", px, Z0 + T, Z1 - T, h, 0.25, holes=PART_HOLES[k], y=y, out=1)
            w.solid(b, P["core"])
            for side in (-1, 1):
                room = ROOMS[0] if (px < 0 and side < 0) else ROOMS[2] if (px > 0 and side > 0) else ROOMS[1]
                paper = P[room[2 + k]]
                skin(b, P["wainscot"], w, Z0 + T, Z1 - T, 0, 0.18, 0.04, side)
                skin(b, P["panel"], w, Z0 + T, Z1 - T, 0.18, 1.0, 0.02, side)
                skin(b, P["oak_dk"], w, Z0 + T, Z1 - T, 1.0, 1.07, 0.05, side, top=True)
                skin(b, paper, w, Z0 + T, Z1 - T, 1.07, h, 0.012, side)
                casings(b, P["oak_dk"], w, fw=0.09, proud=0.03, sill=False, side=side)

    # floors: the ground floor's boards (the world is the floor), the upstairs
    # slab round the stairwell, the ceiling
    for rx0, rx1, *_ in ROOMS:
        fbox(b, P["floor"], rx0, rx1, 0.0, 0.03, Z0 + T, Z1 - T, "+y")
    hx0, hx1, hz0, hz1 = HOLE
    for x0, x1, z0, z1 in ((X0 + T, hx0, Z0 + T, Z1 - T), (hx1, X1 - T, Z0 + T, Z1 - T),
                           (hx0, hx1, Z0 + T, hz0), (hx0, hx1, hz1, Z1 - T)):
        fbox(b, P["plaster"], x0, x1, SLAB_Y, UP, z0, z1, "-y")
        fbox(b, P["floor"], x0, x1, SLAB_Y, UP, z0, z1, "+y")
    # the stairwell's trim, a nosing round the hole
    for x0, x1, z0, z1 in ((hx0 - 0.06, hx0, hz0, hz1), (hx1, hx1 + 0.06, hz0, hz1), (hx0 - 0.06, hx1 + 0.06, hz1, hz1 + 0.06)):
        box2(b, P["oak_dk"], x0, x1, SLAB_Y - 0.05, UP + 0.02, z0, z1)
    fbox(b, P["plaster"], X0 + T, X1 - T, CEIL, CEIL + 0.3, Z0 + T, Z1 - T, "-y")
    # beams across the parlour's and the dining room's ceilings
    for rx0, rx1 in ((X0 + T, -5.125), (5.125, X1 - T)):
        for z in (-25.5, -22.5, -19.5, -16.5, -13.8):
            box2(b, P["oak_dk"], rx0, rx1, SLAB_Y - 0.22, SLAB_Y, z - 0.1, z + 0.1)
    # crown moulding round each upstairs room
    for rx0, rx1, *_ in ROOMS:
        for z0, z1 in ((Z0 + T, Z0 + T + 0.1), (Z1 - T - 0.1, Z1 - T)):
            box2(b, P["trim"], rx0, rx1, CEIL - 0.14, CEIL, z0, z1)
        for x0, x1 in ((rx0, rx0 + 0.1), (rx1 - 0.1, rx1)):
            box2(b, P["trim"], x0, x1, CEIL - 0.14, CEIL, Z0 + T, Z1 - T)
    # ceiling rose over the chandelier
    lathe(b, P["trim"], 0.0, -17.8, [(0.45, CEIL - 0.02), (0.42, CEIL - 0.06), (0.25, CEIL - 0.1), (0.08, CEIL - 0.14), (0.0, CEIL - 0.15)], seg=16)
    return walls


def interior(b, P, w, a, b_, y0, y1, paper):
    """An outer wall's inside face over one room: skirting, wainscot
    panels, the chair rail, wallpaper (heights absolute: the wall's y is 0)."""
    if b_ - a < 0.1:
        return
    skin(b, P["wainscot"], w, a, b_, y0, y0 + 0.18, 0.04, side=-1)
    skin(b, P["panel"], w, a, b_, y0 + 0.18, y0 + 1.0, 0.02, side=-1)
    skin(b, P["oak_dk"], w, a, b_, y0 + 1.0, y0 + 1.07, 0.05, side=-1, top=True)
    skin(b, paper, w, a, b_, y0 + 1.07, y1, 0.012, side=-1)


def window(b, P, w, hole, lo, hi, rnd):
    """An opening's dressing: a door leaf swung open, or a window's sash
    frame with its glass broken out (the opening stays open: zombies climb
    in by the upstairs ones, and bullets go through), a hood over it and
    louvred shutters hung open either side."""
    c, hw = hole["c"], hole["w"] / 2
    door = lo < 0.05
    out = w.out
    if door:
        # the leaf stands open inside, flat to the wall's inner face
        # double doors (the front, 2.2 wide) fold back either side; a single
        # leaf folds back to the low side
        leaves = [(-1, hw), (1, hw)] if hole["w"] > 2.1 else [(-1, hole["w"])]
        for side, leaf in leaves:
            hinge = c + side * hw
            s0, s1 = sorted((hinge, hinge + side * leaf))
            w.slab(b, P["oak_dk"], s0, s1, lo + 0.02, hi - 0.04, w.face(-0.05), 0.05)
            for pl, ph in ((0.15, 0.95), (1.15, hi - 0.25)):
                w.slab(b, P["oak"], s0 + 0.1, s1 - 0.1, lo + pl, lo + ph, w.face(-0.085), 0.02)
            free = hinge + side * leaf
            w.slab(b, P["brass"], free - side * 0.12 - 0.03, free - side * 0.12 + 0.03, lo + 1.0, lo + 1.12, w.face(-0.1), 0.03)
        # a threshold and a hood with brackets outside
        w.slab(b, P["granite_dk"], c - hw - 0.1, c + hw + 0.1, 0.0, 0.04, w.face(0.12), 0.25)
    else:
        # the jamb liners and the top sash (frame, bars, a few shards left)
        sash_lo = lo + (hi - lo) * 0.55
        across = w.at
        w.slab(b, P["trim"], c - hw, c + hw, sash_lo, sash_lo + 0.05, across, 0.05)
        w.slab(b, P["trim"], c - hw, c + hw, hi - 0.05, hi, across, 0.05)
        for s in (-1, 1):
            w.slab(b, P["trim"], c + s * hw - (0.05 if s > 0 else 0), c + s * hw + (0.05 if s < 0 else 0), sash_lo, hi, across, 0.05)
        w.slab(b, P["trim"], c - 0.015, c + 0.015, sash_lo, hi, across, 0.035)
        w.slab(b, P["trim"], c - hw, c + hw, (sash_lo + hi) / 2 - 0.015, (sash_lo + hi) / 2 + 0.015, across, 0.035)
        for k in range(4):
            if rnd.random() < 0.6:
                sx = c + (-hw + 0.05 if k % 2 == 0 else 0.02)
                sy = sash_lo + 0.05 if k < 2 else (sash_lo + hi) / 2 + 0.02
                ww, hh = rnd.uniform(0.1, hw - 0.1), rnd.uniform(0.06, (hi - sash_lo) / 2 - 0.08)
                w.slab(b, P["glass"], sx, sx + ww, sy, sy + hh, across, 0.006)
        # a moulded hood over the head
        w.slab(b, P["trim"], c - hw - 0.24, c + hw + 0.24, hi + 0.14, hi + 0.24, w.face(0.08), 0.16)
        w.slab(b, P["trim"], c - hw - 0.18, c + hw + 0.18, hi + 0.24, hi + 0.28, w.face(0.06), 0.12)
        # louvred shutters, open, one hanging askew
        sw = hole["w"] * 0.5
        for side in (-1, 1):
            along = c + side * (hw + 0.14 + sw / 2 + 0.03)
            ask = 0.2 if (round(c * 7 + lo * 3) % 5 == 0 and side > 0) else 0.0
            shutter(b, P["shutter"], w, along, sw, lo + (-0.12 if ask else 0), hi - lo, out, ask)


def shutter(b, m, w, along, sw, y0, h, out, askew):
    """A louvred shutter flat to the wall: a frame (stiles, three rails)
    and slats, their faces only; one hangs askew off a lost hinge."""
    base = w.at + out * (w.t / 2 + 0.035)
    piv = (along, y0 + h)

    def P(a, y, off):
        # turned about the top hinge corner when askew
        da, dy = a - piv[0], y - piv[1]
        c, s = math.cos(askew), math.sin(askew)
        a2, y2 = piv[0] + da * c - dy * s, piv[1] + da * s + dy * c
        acr = base + out * off
        return (a2, y2, acr) if w.axis == "x" else (acr, y2, a2)
    n = (0.0, 0.0, float(out)) if w.axis == "x" else (float(out), 0.0, 0.0)

    def plate(a0, a1, l0, l1, off):
        facing(b, m, [P(a0, l0, off), P(a1, l0, off), P(a1, l1, off), P(a0, l1, off)], n)
    for a0, a1 in ((along - sw / 2, along - sw / 2 + 0.06), (along + sw / 2 - 0.06, along + sw / 2)):
        plate(a0, a1, y0, y0 + h, 0.04)
    for yy in (y0, y0 + h / 2 - 0.03, y0 + h - 0.06):
        plate(along - sw / 2 + 0.06, along + sw / 2 - 0.06, yy, yy + 0.06, 0.04)
    plate(along - sw / 2 + 0.06, along + sw / 2 - 0.06, y0, y0 + h, 0.0)     # the dark back between the slats
    y = y0 + 0.08
    while y < y0 + h - 0.1:
        if abs(y - (y0 + h / 2)) > 0.06:
            # a slat: tilted, its upper edge set back
            a0, a1 = along - sw / 2 + 0.06, along + sw / 2 - 0.06
            facing(b, m, [P(a0, y, 0.035), P(a1, y, 0.035), P(a1, y + 0.06, 0.008), P(a0, y + 0.06, 0.008)], (n[0], 0.6, n[2]))
        y += 0.075


# ------------------------------------------------------------------ the roof

def roof(b, P):
    S = [P["slate1"], P["slate2"], P["slate3"], P["slate1"], P["slate4"]]
    eave, rise, half = WALL_H, 4.0, (Z1 - Z0) / 2 + 0.5
    # the main roof: ridge along x at z -20
    slates(b, S, "x", X0 - 0.6, X1 + 0.6, (Z1 + 0.5, eave), (MID_Z, eave + rise), seed=11)
    slates(b, S, "x", X0 - 0.6, X1 + 0.6, (Z0 - 0.5, eave), (MID_Z, eave + rise), seed=12)
    b.cyl(P["ridge"], 0.09, (X0 - 0.7, eave + rise + 0.12, MID_Z), (X1 + 0.7, eave + rise + 0.12, MID_Z), seg=8)
    # cresting along the ridge: iron spears
    x = X0 + 0.5
    while x < X1 - 0.3:
        b.cyl(P["iron"], 0.012, (x, eave + rise + 0.18, MID_Z), (x, eave + rise + 0.62, MID_Z), seg=3, caps=False)
        b.cyl(P["iron"], 0.035, (x, eave + rise + 0.6, MID_Z), (x, eave + rise + 0.72, MID_Z), seg=4, r2=0.0)
        x += 0.45
    b.box(P["iron"], X1 - X0 - 0.8, 0.025, 0.025, 0.0, eave + rise + 0.42, MID_Z)
    # gable ends: siding triangles, bargeboards, a louvred vent, a finial
    for gx, s in ((X0, -1), (X1, 1)):
        gable_prism(b, P["siding"], Z1 - Z0, rise, eave, gx - 0.2 - 0.02 * s, gx + 0.2 + 0.02 * s, axis="x", c=MID_Z)
        # shingle courses in the gable, each stepped proud of the one above
        gable_courses(b, P["siding"], "x", gx + s * 0.18, s, MID_Z, Z1 - Z0, eave, rise)
        rake = math.hypot(half, rise)
        ang = math.atan2(rise, half)
        for sz in (-1, 1):
            zc = MID_Z + sz * half / 2
            b.box(P["trim"], 0.08, 0.32, rake, gx + s * 0.62, eave + rise / 2 - 0.2, zc, rx=sz * ang)
            # gingerbread drops under the bargeboard
            for i in range(1, 12):
                t = i / 12
                zz = MID_Z + sz * half * t
                yy = eave + rise * (1 - t) - 0.4
                b.cyl(P["trim"], 0.035, (gx + s * 0.62, yy, zz), (gx + s * 0.62, yy - 0.22, zz), seg=6, r2=0.012)
        b.cyl(P["trim"], 0.06, (gx + s * 0.62, eave + rise - 0.6, MID_Z), (gx + s * 0.62, eave + rise + 0.9, MID_Z), seg=8, r2=0.02)
        b.cyl(P["iron"], 0.015, (gx + s * 0.62, eave + rise + 0.9, MID_Z), (gx + s * 0.62, eave + rise + 1.4, MID_Z), seg=4)
        # half-moon vent with louvres
        ring(b, P["trim"], (gx + s * 0.2, eave + 1.0, MID_Z), 0.7, 0.06, seg=14, tseg=5, axis="x", arc=math.pi)
        for k in range(5):
            yy = eave + 1.0 + 0.1 + k * 0.12
            ww = 2 * math.sqrt(max(0.0, 0.66 ** 2 - (yy - eave - 1.0) ** 2))
            b.box(P["trim_dk"], 0.04, 0.04, ww, gx + s * 0.19, yy, MID_Z, rz=0.4 * s)
        b.box(P["trim"], 0.08, 0.1, 1.5, gx + s * 0.2, eave + 0.94, MID_Z)
    # eaves: fascia, soffit and paired brackets along the long sides
    for ez, s in ((Z1 + 0.5, 1), (Z0 - 0.5, -1)):
        b.box(P["trim"], X1 - X0 + 1.2, 0.26, 0.06, 0.0, eave - 0.12, ez)
        b.box(P["trim_dk"], X1 - X0 + 1.1, 0.04, 0.5, 0.0, eave - 0.12, ez - s * 0.25)
        x = X0 + 0.4
        while x < X1 - 0.3:
            if not (s > 0 and abs(x) < 5.8):
                for dx in (-0.09, 0.09):
                    b.prism(P["trim"], [(ez - s * 0.5, eave - 0.1), (ez - s * 0.06, eave - 0.1), (ez - s * 0.42, eave - 0.6),
                                        (ez - s * 0.5, eave - 0.6)], x + dx - 0.035, x + dx + 0.035, axis="x")
            x += 1.2
    # the cross gable over the entrance: ridge along z at x 0
    cw, crise, cz0, cz1 = 5.6, 3.0, -20.0, Z1 + 0.5
    for s in (-1, 1):
        slates(b, S, "z", cz0, cz1, (s * (cw + 0.1), eave), (0.0, eave + crise), seed=20 + s)
    b.cyl(P["ridge"], 0.08, (0.0, eave + crise + 0.1, cz0), (0.0, eave + crise + 0.1, cz1 + 0.1), seg=8)
    gable_prism(b, P["siding"], cw * 2 - 0.6, crise - 0.15, eave, Z1 - 0.4, Z1 + 0.02, axis="z", c=0.0)
    gable_courses(b, P["siding"], "z", Z1 + 0.02, 1, 0.0, cw * 2 - 0.6, eave, crise - 0.15, skip=(eave + 0.5, eave + 1.9, 0.75))
    clen, cang = math.hypot(cw, crise), math.atan2(crise, cw)
    for s in (-1, 1):
        b.box(P["trim"], clen, 0.32, 0.08, s * cw / 2, eave + crise / 2 - 0.2, Z1 + 0.56, rz=-s * cang)
        for i in range(1, 9):
            t = i / 9
            xx, yy = s * cw * t, eave + crise * (1 - t) - 0.4
            b.cyl(P["trim"], 0.035, (xx, yy, Z1 + 0.56), (xx, yy - 0.22, Z1 + 0.56), seg=6, r2=0.012)
    b.cyl(P["trim"], 0.06, (0.0, eave + crise - 0.6, Z1 + 0.56), (0.0, eave + crise + 0.9, Z1 + 0.56), seg=8, r2=0.02)
    b.cyl(P["iron"], 0.015, (0.0, eave + crise + 0.9, Z1 + 0.56), (0.0, eave + crise + 1.5, Z1 + 0.56), seg=4)
    # the round attic window's frame (its glow is the JS's)
    ring(b, P["trim"], (0.0, eave + 1.2, Z1 + 0.05), 0.62, 0.08, seg=20, tseg=6, axis="z")
    for a in range(4):
        ang = a * math.pi / 4
        b.box(P["trim"], 1.2, 0.04, 0.03, 0.0, eave + 1.18, Z1 + 0.04, rz=ang)
    # chimneys: the parlour's up the west wall, the one through the ridge
    chimney(b, P, X0 - 0.45, -25.0, 0.9, 2.0, 0.0, 12.4)
    chimney(b, P, 6.0, -20.0, 1.2, 1.2, eave + 2.2, eave + 5.8)


def gable_courses(b, m, axis, at, s, c, base, y0, rise, every=0.26, skip=None):
    """Shingle courses over a gable triangle (base wide at y0, its apex
    rise above, centred on c, on the plane at = x or z), facing s: each
    course a face tilted proud at its butt and the butt's underside, cut to
    the rakes in steps (the bargeboards hide the steps). skip, (y0, y1,
    half-width), leaves a window clear."""
    y = y0 + 0.02
    n = (float(s), 0.0, 0.0) if axis == "x" else (0.0, 0.0, float(s))
    while y < y0 + rise - 0.15:
        top = y + every
        half = base / 2 * (1 - (top - y0) / rise)
        spans = [(c - half, c + half)]
        if skip and skip[0] < top and y < skip[1]:
            spans = [(c - half, c - skip[2]), (c + skip[2], c + half)]
        for a0, a1 in spans:
            if a1 - a0 < 0.1:
                continue
            bt, tp = at + s * 0.03, at + s * 0.004
            if axis == "x":
                facing(b, m, [(bt, y, a0), (bt, y, a1), (tp, top, a1), (tp, top, a0)], n)
                fbox(b, m, min(at, bt), max(at, bt), y, y, a0, a1, "-y")
            else:
                facing(b, m, [(a0, y, bt), (a1, y, bt), (a1, top, tp), (a0, top, tp)], n)
                fbox(b, m, a0, a1, y, y, min(at, bt), max(at, bt), "-y")
        y = top


def chimney(b, P, x, z, w, d, y0, y1):
    box2(b, P["brick"], x - w / 2, x + w / 2, y0, y1 - 0.4, z - d / 2, z + d / 2)
    if y0 < 0.1:
        box2(b, P["stone"], x - w / 2 - 0.08, x + w / 2 + 0.08, 0.0, 0.8, z - d / 2 - 0.08, z + d / 2 + 0.08)
        b.frustum(P["stone"], w + 0.16, d + 0.16, w, d, 0.8, 1.0, x=x, z=z)
    # corbelled cap, a stone slab, two pots
    box2(b, P["brick"], x - w / 2 - 0.08, x + w / 2 + 0.08, y1 - 0.4, y1 - 0.2, z - d / 2 - 0.08, z + d / 2 + 0.08)
    box2(b, P["stone"], x - w / 2 - 0.12, x + w / 2 + 0.12, y1 - 0.2, y1, z - d / 2 - 0.12, z + d / 2 + 0.12)
    pots = [(0.0, -d / 4), (0.0, d / 4)] if d > w else [(-w / 4, 0.0), (w / 4, 0.0)] if w > 1.0 else [(0.0, 0.0)]
    for k, (dx, dz) in enumerate(pots):
        lathe(b, P["brick"] if k % 2 else P["stone"], x + dx, z + dz,
              [(0.16, 0), (0.14, 0.15), (0.12, 0.45), (0.15, 0.5), (0.15, 0.56), (0.1, 0.56)], seg=10, y0=y1)
        lathe(b, P["soot"], x + dx, z + dz, [(0.1, 0.5), (0.002, 0.52)], seg=8, y0=y1)


def turret(b, P):
    tx, tz, tr, th = 12.5, -27.5, 2.4, 11.0
    seg = 20
    lathe(b, P["granite_dk"], tx, tz, [(tr + 0.12, 0), (tr + 0.12, 0.6), (tr + 0.02, 0.68)], seg=seg)
    # clapboard rings, each flaring at its foot
    y = 0.68
    while y < th - 0.5:
        lathe(b, P["siding"], tx, tz, [(tr + 0.004, y), (tr + 0.024, y), (tr + 0.004, y + 0.2)], seg=seg, caps=False)
        y += 0.19
    lathe(b, P["trim"], tx, tz, [(tr + 0.06, SLAB_Y - 0.05), (tr + 0.06, SLAB_Y + 0.22)], seg=seg)
    lathe(b, P["trim"], tx, tz, [(tr + 0.05, th - 0.5), (tr + 0.05, th - 0.15), (tr + 0.3, th - 0.05), (tr + 0.3, th + 0.08), (tr - 0.2, th + 0.08)], seg=seg)
    # brackets under the cornice
    for i in range(16):
        a = 2 * math.pi * i / 16
        cx, cz = tx + math.cos(a) * (tr + 0.12), tz + math.sin(a) * (tr + 0.12)
        b.box(P["trim"], 0.08, 0.35, 0.2, cx, th - 0.5, cz, ry=-a)
    # the cone: slate rings, a lead roll at the top, an iron finial
    roof_h, roof_r = 5.5, tr + 0.6
    k, y = 0, th
    while y < th + roof_h - 0.4:
        f0 = (y - th) / roof_h
        f1 = min(1.0, (y + 0.32 - th) / roof_h)
        m = (P["slate1"], P["slate2"], P["slate3"], P["slate4"])[k % 4]
        lathe(b, m, tx, tz, [(roof_r * (1 - f0) + 0.04, y), (roof_r * (1 - f1) + 0.01, y + 0.34)], seg=seg, caps=False)
        lathe(b, m, tx, tz, [(roof_r * (1 - f0) + 0.005, y), (roof_r * (1 - f0) + 0.04, y)], seg=seg, caps=False)
        y += 0.27
        k += 1
    lathe(b, P["ridge"], tx, tz, [(0.35, th + roof_h - 0.6), (0.12, th + roof_h - 0.1), (0.08, th + roof_h)], seg=12)
    lathe(b, P["iron"], tx, tz, [(0.05, th + roof_h), (0.03, th + roof_h + 0.5), (0.11, th + roof_h + 0.6), (0.11, th + roof_h + 0.7),
                                 (0.02, th + roof_h + 0.8), (0.02, th + roof_h + 1.2), (0.002, th + roof_h + 1.6)], seg=8)
    # frames round the lit windows (their glow is the JS's)
    for a, wy in ((0.5, 4.6), (1.6, 4.6), (1.05, 8.2), (2.4, 8.2)):
        nx, nz = math.sin(a), math.cos(a)
        ux, uz = nz, -nx
        cx, cz = tx + nx * (tr + 0.05), tz + nz * (tr + 0.05)
        for s in (-1, 1):
            b.box(P["trim"], 0.1, 1.45, 0.1, cx + ux * s * 0.42, wy - 0.72, cz + uz * s * 0.42, ry=a)
        b.box(P["trim"], 1.0, 0.1, 0.12, cx, wy + 0.62, cz, ry=a)
        b.box(P["trim"], 1.1, 0.08, 0.2, cx + nx * 0.04, wy - 0.76, cz + nz * 0.04, ry=a)
        b.box(P["trim"], 1.1, 0.06, 0.18, cx + nx * 0.03, wy + 0.72, cz + nz * 0.03, ry=a)
        b.box(P["trim"], 0.03, 1.2, 0.03, cx + nx * 0.02, wy - 0.6, cz + nz * 0.02, ry=a)
        b.box(P["trim"], 0.7, 0.03, 0.03, cx + nx * 0.02, wy + 0.1, cz + nz * 0.02, ry=a)


# ------------------------------------------------------------------ porch, stair, rails

def baluster_run(b, P, axis, at, a, b_, y, every=0.2, h=1.05):
    """A rail like hollowgrin.js railing(): a moulded handrail, a shoe rail
    and square balusters with a bead; posts at both ends."""
    L = b_ - a
    c = (a + b_) / 2
    def put(m, along0, along1, y0, y1, d):
        if axis == "x":
            box2(b, m, along0, along1, y0, y1, at - d / 2, at + d / 2)
        else:
            box2(b, m, at - d / 2, at + d / 2, y0, y1, along0, along1)
    put(P["oak_dk"], a, b_, y + h - 0.1, y + h - 0.02, 0.12)
    put(P["oak_dk"], a - 0.02, b_ + 0.02, y + h - 0.02, y + h + 0.02, 0.14)
    put(P["oak_dk"], a, b_, y + 0.05, y + 0.11, 0.08)
    n = max(2, round(L / every))
    for i in range(1, n):
        s = a + L * i / n
        put(P["trim_dk"], s - 0.022, s + 0.022, y + 0.11, y + h - 0.1, 0.044)
    for s in (a, b_):
        put(P["oak_dk"], s - 0.06, s + 0.06, y, y + h + 0.1, 0.12)
        if axis == "x":
            b.cyl(P["oak_dk"], 0.06, (s, y + h + 0.1, at), (s, y + h + 0.2, at), seg=8, r2=0.03)
        else:
            b.cyl(P["oak_dk"], 0.06, (at, y + h + 0.1, s), (at, y + h + 0.2, s), seg=8, r2=0.03)


def porch(b, P):
    # the deck (collider 10.8 x 3.6 x 0.25), its boards and a skirt
    box2(b, P["oak_dk"], -5.4, 5.4, 0.0, 0.2, -12.0, -8.4)
    x = -5.4
    while x < 5.39:
        fbox(b, P["floor"], x + 0.005, min(5.4, x + 0.14) - 0.005, 0.2, 0.25, -12.0, -8.36, "+y +z")
        x += 0.14
    box2(b, P["trim"], -5.42, 5.42, 0.18, 0.26, -8.38, -8.32)
    # a shallow step down to the path (no collider: lower than a stride)
    box2(b, P["granite_dk"], -1.8, 1.8, 0.0, 0.12, -8.32, -7.95, bevel=0.01)
    # the balcony over it (collider 10.8 x 3.6 at 3.3 .. 3.6): fascia, a
    # beadboard ceiling, its floor
    box2(b, P["plaster"], -5.4, 5.4, SLAB_Y, SLAB_Y + 0.04, -12.0, -8.4)
    z = -11.9
    while z < -8.45:
        fbox(b, P["trim"], -5.35, 5.35, SLAB_Y - 0.015, SLAB_Y, z, z + 0.05, "-y +z")
        z += 0.12
    box2(b, P["floor"], -5.4, 5.4, SLAB_Y + 0.04, UP, -12.0, -8.4)
    box2(b, P["trim"], -5.5, 5.5, SLAB_Y - 0.12, UP + 0.02, -8.46, -8.34)
    for sx in (-1, 1):
        box2(b, P["trim"], sx * 5.42 - 0.06, sx * 5.42 + 0.06, SLAB_Y - 0.12, UP + 0.02, -12.0, -8.34)
    # turned columns (collider 0.36 square, 0.25 .. 3.3) with fretwork brackets
    for cx in (-4.8, 4.8):
        box2(b, P["trim"], cx - 0.2, cx + 0.2, 0.25, 0.55, -9.0, -8.6, bevel=0.015)
        lathe(b, P["trim"], cx, -8.8, [(0.17, 0.55), (0.17, 0.62), (0.12, 0.7), (0.14, 0.82), (0.11, 0.95), (0.1, 2.75), (0.13, 2.85),
                                       (0.11, 2.95), (0.16, 3.05), (0.16, SLAB_Y - 0.12)], seg=14)
        for s in (-1, 1):
            b.prism(P["trim"], [(cx + s * 0.1, SLAB_Y - 0.12), (cx + s * 0.75, SLAB_Y - 0.12), (cx + s * 0.1, SLAB_Y - 0.75)], -8.84, -8.76, axis="z")
        b.prism(P["trim"], [(-9.0, SLAB_Y - 0.12), (-9.6, SLAB_Y - 0.12), (-9.0, SLAB_Y - 0.55)], cx - 0.04, cx + 0.04, axis="x")
    # pilasters where the porch meets the house
    for cx in (-5.3, 5.3):
        box2(b, P["trim"], cx - 0.12, cx + 0.12, 0.25, SLAB_Y - 0.12, -11.98, -11.9)
    # the balcony's rails (colliders: hollowgrin.js railing())
    baluster_run(b, P, "x", -8.45, -5.4, 5.4, UP)
    baluster_run(b, P, "z", -5.35, -12.0, -8.45, UP)
    baluster_run(b, P, "z", 5.35, -12.0, -8.45, UP)
    # lanterns either side of the door: the iron cages (the glass is the JS's)
    for lx in (-1.6, 1.6):
        z = Z1 + 0.08
        for dx, dz in ((-0.12, -0.12), (0.12, -0.12), (-0.12, 0.12), (0.12, 0.12)):
            box2(b, P["iron"], lx + dx - 0.015, lx + dx + 0.015, 2.08, 2.5, z + dz - 0.015, z + dz + 0.015)
        box2(b, P["iron"], lx - 0.15, lx + 0.15, 2.06, 2.1, z - 0.15, z + 0.15)
        b.frustum(P["iron"], 0.34, 0.34, 0.06, 0.06, 2.5, 2.66, x=lx, z=z)
        lathe(b, P["iron"], lx, z, [(0.05, 1.9), (0.02, 2.06)], seg=6)
        box2(b, P["iron"], lx - 0.02, lx + 0.02, 2.62, 2.66, Z1 - 0.02, z)
        box2(b, P["iron"], lx - 0.03, lx + 0.03, 2.5, 2.8, Z1 - 0.01, Z1 + 0.02)


def stair(b, P):
    x, z0, w, n, rise, run = STAIR["x"], STAIR["z"], STAIR["width"], STAIR["steps"], STAIR["rise"], STAIR["run"]
    for i in range(n):
        zc = z0 - run * (i + 0.5)
        h = rise * (i + 1)
        box2(b, P["oak_dk"], x - w / 2, x + w / 2, 0.0, h - 0.04, zc - run / 2, zc + run / 2)
        box2(b, P["floor"], x - w / 2 + 0.02, x + w / 2 - 0.02, h - 0.04, h, zc - run / 2, zc + run / 2 + 0.035)
        # the runner, its brass rod at the riser
        box2(b, P["velvet"], x - 0.8, x + 0.8, h, h + 0.012, zc - run / 2, zc + run / 2 + 0.03)
        box2(b, P["velvet"], x - 0.8, x + 0.8, h - rise, h, zc + run / 2 + 0.03, zc + run / 2 + 0.045)
        b.cyl(P["brass"], 0.012, (x - 0.86, h - rise + 0.03, zc + run / 2 + 0.05), (x + 0.86, h - rise + 0.03, zc + run / 2 + 0.05), seg=6)
    # the runner across the landing at the top and the hall at the foot
    box2(b, P["velvet"], x - 0.8, x + 0.8, 0.03, 0.04, z0 + 0.05, z0 + 2.2)
    # panelled stringers on both open sides
    top = rise * n
    for s in (-1, 1):
        sx = x + s * (w / 2 + 0.03)
        for i in range(n):
            zc = z0 - run * (i + 0.5)
            h = rise * (i + 1)
            box2(b, P["wainscot"], sx - 0.03, sx + 0.03, 0.0, h, zc - run / 2, zc + run / 2)
            if h > 0.7:
                box2(b, P["panel"], sx - 0.04 if s < 0 else sx + 0.02, sx - 0.02 if s < 0 else sx + 0.04, 0.2, h - 0.35, zc - run / 2 + 0.06, zc + run / 2 - 0.06)
        # the handrail up the slope, balusters two a step, newels top and foot
        L = math.hypot(n * run, top)
        ang = math.atan2(rise, run)
        hx = x + s * (w / 2 - 0.06)
        b.box(P["oak_dk"], 0.1, 0.08, L, hx, top / 2 + 0.88, z0 - n * run / 2, rx=ang)
        for i in range(n):
            for f in (0.25, 0.75):
                zz = z0 - run * (i + f)
                yy = rise * (i + 1)
                rail_y = 0.92 + (z0 - zz) * rise / run
                box2(b, P["trim_dk"], hx - 0.02, hx + 0.02, yy, rail_y, zz - 0.02, zz + 0.02)
        lathe(b, P["oak_dk"], hx, z0 - 0.15, [(0.11, 0), (0.11, 0.2), (0.08, 0.3), (0.08, 1.05), (0.11, 1.12), (0.11, 1.2),
                                               (0.07, 1.26), (0.09, 1.32), (0.04, 1.42)], seg=10)
        b.cyl(P["brass"], 0.07, (hx, 1.36, z0 - 0.15), (hx, 1.37, z0 - 0.15), seg=10)
    # the stairwell's rails upstairs (colliders: railing())
    hx0, hx1, hz0, hz1 = HOLE
    baluster_run(b, P, "z", hx0 - 0.05, hz0, hz1, UP)
    baluster_run(b, P, "z", hx1 + 0.05, hz0, hz1, UP)
    baluster_run(b, P, "x", hz1 + 0.05, hx0 - 0.1, hx1 + 0.1, UP)


# ------------------------------------------------------------------ the rooms

def chandelier(b, P):
    cy, cz = 4.9, -17.8
    # chain links down from the rose
    b.cyl(P["iron"], 0.012, (0.0, CEIL - 0.15, cz), (0.0, cy + 0.5, cz), seg=4, caps=False)
    ring(b, P["iron"], (0.0, cy, cz), 0.75, 0.03, seg=28, tseg=5)
    ring(b, P["iron"], (0.0, cy + 0.35, cz), 0.4, 0.025, seg=20, tseg=5)
    lathe(b, P["iron"], 0.0, cz, [(0.03, cy - 0.35), (0.09, cy - 0.25), (0.06, cy - 0.1), (0.04, cy + 0.2), (0.07, cy + 0.38), (0.03, cy + 0.55)], seg=10)
    for i in range(8):
        a = i / 8 * 2 * math.pi
        cx, czz = math.cos(a) * 0.75, cz + math.sin(a) * 0.75
        b.cyl(P["iron"], 0.015, (math.cos(a) * 0.06, cy - 0.15, cz + math.sin(a) * 0.06), (cx, cy - 0.02, czz), seg=4)
        lathe(b, P["brass"], cx, czz, [(0.02, -0.03), (0.06, 0.0), (0.06, 0.012), (0.04, 0.02)], seg=8, y0=cy)
        # drops of glass hanging off the hoop
        b.cyl(P["glass"], 0.018, ((cx * 0.9), cy - 0.03, cz + (czz - cz) * 0.9), ((cx * 0.9), cy - 0.16, cz + (czz - cz) * 0.9), seg=4, r2=0.0)
    for i in range(6):
        a = i / 6 * 2 * math.pi + 0.3
        b.cyl(P["iron"], 0.012, (0.0, cy + 0.2, cz), (math.cos(a) * 0.4, cy + 0.35, cz + math.sin(a) * 0.4), seg=4)


def parlour(b, P, R):
    # the fireplace on the west wall (collider 0.7 x 2.4 x 1.5 at -12.25, -25)
    fx, fz = X0 + T + 0.35, -25.0
    R.begin(b, "manor:fireplace")
    box2(b, P["stone"], fx - 0.35, fx + 0.38, 0.0, 1.5, fz - 1.2, fz - 0.45)
    box2(b, P["stone"], fx - 0.35, fx + 0.38, 0.0, 1.5, fz + 0.45, fz + 1.2)
    box2(b, P["stone"], fx - 0.35, fx + 0.38, 0.95, 1.5, fz - 0.45, fz + 0.45)
    box2(b, P["soot"], fx - 0.35, fx - 0.3, 0.0, 0.95, fz - 0.45, fz + 0.45)
    box2(b, P["soot"], fx - 0.35, fx + 0.3, 0.9, 0.95, fz - 0.45, fz + 0.45)
    for s in (-1, 1):
        box2(b, P["soot"], fx - 0.35, fx + 0.3, 0.0, 0.95, fz + s * 0.45 - (0.03 if s > 0 else 0), fz + s * 0.45 + (0.03 if s < 0 else 0))
    box2(b, P["granite_dk"], fx + 0.3, fx + 0.42, 0.95, 1.08, fz - 0.55, fz + 0.55)                  # the lintel
    b.box(P["granite_dk"], 0.2, 0.25, 0.25, fx + 0.36, 1.0, fz, bevel=0.01)                         # keystone
    box2(b, P["granite_dk"], fx - 0.35, fx + 0.55, 1.5, 1.64, fz - 1.35, fz + 1.35, bevel=0.015)       # the mantel shelf
    for s in (-1, 1):
        box2(b, P["stone"], fx + 0.36, fx + 0.48, 0.0, 1.5, fz + s * 1.05 - 0.15, fz + s * 1.05 + 0.15, bevel=0.01)
    box2(b, P["brick"], fx - 0.35, fx + 0.25, 1.64, SLAB_Y, fz - 0.9, fz + 0.9)                     # the chimney breast
    box2(b, P["granite_dk"], fx + 0.38, fx + 1.1, 0.0, 0.05, fz - 1.0, fz + 1.0)                     # hearth
    # andirons and logs in the firebox (the embers are the JS's)
    for s in (-1, 1):
        lathe(b, P["iron"], fx + 0.2, fz + s * 0.3, [(0.04, 0), (0.03, 0.25), (0.05, 0.3), (0.002, 0.36)], seg=6)
        box2(b, P["iron"], fx - 0.2, fx + 0.2, 0.08, 0.12, fz + s * 0.3 - 0.02, fz + s * 0.3 + 0.02)
    for k, (dy, ry) in enumerate(((0.14, 0.1), (0.14, -0.2), (0.25, 0.4))):
        b.cyl(P["log"], 0.07, (fx - 0.15, 0.12 + dy, fz - 0.38 + k * 0.05), (fx + 0.15, 0.12 + dy, fz + 0.35 - k * 0.05), seg=7)
    # on the mantel: a carriage clock, candlesticks, a skull, two bottles
    box2(b, P["oak_dk"], fx + 0.05, fx + 0.25, 1.64, 1.9, fz - 0.12, fz + 0.12, bevel=0.01)
    b.cyl(P["dial"], 0.07, (fx + 0.255, 1.79, fz), (fx + 0.26, 1.79, fz), seg=12)
    for s in (-1, 1):
        lathe(b, P["brass"], fx + 0.15, fz + s * 0.95, [(0.06, 0), (0.05, 0.02), (0.015, 0.05), (0.02, 0.2), (0.012, 0.28), (0.035, 0.3), (0.03, 0.32)], seg=8, y0=1.64)
    b.lump(P["bone"], 0.16, 0.15, 0.18, fx + 0.15, 1.64, fz - 0.55, seed=3, rnd=0.7, jitter=0.01)
    for k, dz in enumerate((0.5, 0.62)):
        lathe(b, P["glass"] if k else P["wine"], fx + 0.12, fz + dz, [(0.04, 0), (0.04, 0.16), (0.012, 0.22), (0.012, 0.27)], seg=8, y0=1.64)
    R.end()
    # the sofa (collider 2.4 x 0.9 x 0.85 at -8.6, -21.2), its back to the south
    sx, sz = -8.6, -21.2
    R.begin(b, "manor:sofa")
    box2(b, P["oak_dk"], sx - 1.15, sx + 1.15, 0.1, 0.35, sz - 0.42, sz + 0.42)
    for k in range(3):
        b.box(P["velvet"], 0.66, 0.16, 0.6, sx - 0.68 + k * 0.68, 0.35, sz - 0.06, bevel=0.03)
    b.box(P["velvet"], 2.2, 0.62, 0.2, sx, 0.35, sz + 0.32, bevel=0.04)
    for k in range(5):                                    # buttons of the tufted back
        for yy in (0.6, 0.8):
            b.cyl(P["velvet_dk"], 0.02, (sx - 0.8 + k * 0.4, yy, sz + 0.21), (sx - 0.8 + k * 0.4, yy, sz + 0.215), seg=6)
    for s in (-1, 1):
        b.cyl(P["velvet"], 0.13, (sx + s * 1.05, 0.62, sz - 0.42), (sx + s * 1.05, 0.62, sz + 0.42), seg=10)
        box2(b, P["velvet"], sx + s * 1.05 - 0.12, sx + s * 1.05 + 0.12, 0.1, 0.62, sz - 0.42, sz + 0.42)
        for t in (-1, 1):
            lathe(b, P["oak_dk"], sx + s * 1.05, sz + t * 0.35, [(0.04, 0), (0.05, 0.05), (0.03, 0.1)], seg=6)
    R.end()
    # the rug, a tea table on it
    R.begin(b, "manor:parlour-rug")
    box2(b, P["rug"], sx - 1.6, sx + 1.6, 0.03, 0.04, -24.3, -22.1)
    for x0, x1, z0, z1 in ((sx - 1.6, sx + 1.6, -24.3, -24.1), (sx - 1.6, sx + 1.6, -22.3, -22.1), (sx - 1.6, sx - 1.4, -24.3, -22.1), (sx + 1.4, sx + 1.6, -24.3, -22.1)):
        box2(b, P["rug2"], x0, x1, 0.04, 0.045, z0, z1)
    R.end()
    R.begin(b, "manor:tea-table", on="manor:parlour-rug")
    b.box(P["oak"], 1.0, 0.05, 0.55, sx, 0.42, -23.0, bevel=0.01)
    for dx in (-0.42, 0.42):
        for dz in (-0.2, 0.2):
            lathe(b, P["oak_dk"], sx + dx, -23.0 + dz, [(0.025, 0.04), (0.035, 0.12), (0.022, 0.3), (0.03, 0.42)], seg=6)
    lathe(b, P["pewter"], sx + 0.2, -23.0, [(0.06, 0), (0.07, 0.08), (0.04, 0.16), (0.05, 0.2)], seg=10, y0=0.47)
    b.box(P["linen"], 0.18, 0.04, 0.24, sx - 0.25, 0.47, -23.05, ry=0.3)
    R.end()
    # the armchair under a dust sheet (collider 0.9 cube at -11.2, -18)
    R.begin(b, "manor:sheeted-chair")
    b.lump(P["sheet"], 0.92, 0.5, 0.92, -11.2, 0.0, -18.0, seed=5, rnd=0.25, jitter=0.03)
    b.lump(P["sheet"], 0.3, 0.75, 0.92, -11.5, 0.25, -18.0, seed=6, rnd=0.5, jitter=0.03)
    for s in (-1, 1):
        b.lump(P["sheet"], 0.62, 0.32, 0.2, -11.15, 0.38, -18.0 + s * 0.36, seed=7 + s, rnd=0.6, jitter=0.02)
    b.lump(P["sheet"], 0.98, 0.12, 0.98, -11.2, 0.0, -18.0, seed=9, rnd=0.8, jitter=0.04)   # the hem pooled on the floor
    R.end()


def foyer(b, P, R):
    # the grandfather clock (collider 0.6 x 0.45 x 2.3 at -3.8, -27.1)
    cx, cz = -3.8, -27.1
    R.begin(b, "manor:clock")
    b.box(P["oak_dk"], 0.6, 0.35, 0.45, cx, 0.0, cz, bevel=0.015)
    b.box(P["oak"], 0.46, 1.2, 0.36, cx, 0.35, cz)
    box2(b, P["glass"], cx - 0.14, cx + 0.14, 0.6, 1.4, cz + 0.18, cz + 0.19)
    b.cyl(P["brass"], 0.09, (cx, 0.75, cz + 0.12), (cx, 0.75, cz + 0.14), seg=12)
    b.box(P["brass"], 0.015, 0.6, 0.015, cx, 0.78, cz + 0.13)
    b.box(P["oak_dk"], 0.56, 0.65, 0.42, cx, 1.55, cz, bevel=0.015)
    b.cyl(P["dial"], 0.2, (cx, 1.9, cz + 0.21), (cx, 1.9, cz + 0.225), seg=20)
    for k in range(12):
        a = k / 12 * 2 * math.pi
        b.box(P["ebony"], 0.012, 0.04, 0.005, cx + math.sin(a) * 0.16, 1.88 + math.cos(a) * 0.16, cz + 0.228, rz=-a)
    b.box(P["ebony"], 0.012, 0.13, 0.005, cx + 0.03, 1.9, cz + 0.232, rz=-0.5)
    b.box(P["ebony"], 0.012, 0.09, 0.005, cx - 0.04, 1.88, cz + 0.232, rz=2.0)
    b.prism(P["oak_dk"], [(cx - 0.32, 2.2), (cx + 0.32, 2.2), (cx, 2.3)], cz - 0.22, cz + 0.23, axis="z")
    b.box(P["oak_dk"], 0.66, 0.05, 0.48, cx, 2.15, cz)
    R.end()
    # an upright piano (collider 1.4 x 0.6 x 0.85 at 3.6, -26.9): the
    # candelabra stands on its top
    px, pz = 3.6, -26.9
    R.begin(b, "manor:piano")
    box2(b, P["ebony"], px - 0.7, px + 0.7, 0.0, 1.25, pz - 0.3, pz + 0.05)
    box2(b, P["ebony"], px - 0.7, px + 0.7, 0.62, 0.72, pz + 0.05, pz + 0.3)
    box2(b, P["ivory"], px - 0.6, px + 0.6, 0.72, 0.75, pz + 0.08, pz + 0.28)
    for k in range(36):
        if k % 7 not in (2, 6):
            box2(b, P["ebony"], px - 0.585 + k * 0.034, px - 0.57 + k * 0.034, 0.75, 0.78, pz + 0.08, pz + 0.19)
    for s in (-1, 1):
        box2(b, P["ebony"], px + s * 0.66 - 0.04, px + s * 0.66 + 0.04, 0.0, 0.75, pz + 0.05, pz + 0.3)
        lathe(b, P["ebony"], px + s * 0.62, pz + 0.26, [(0.03, 0.0), (0.045, 0.1), (0.03, 0.6)], seg=6)
    box2(b, P["oak_dk"], px - 0.4, px + 0.4, 0.82, 1.08, pz + 0.04, pz + 0.07)    # the music desk
    b.box(P["linen"], 0.3, 0.22, 0.01, px - 0.12, 0.86, pz + 0.075, rx=-0.15)
    b.box(P["linen"], 0.3, 0.22, 0.01, px + 0.2, 0.86, pz + 0.075, rx=-0.15)
    box2(b, P["ebony"], px - 0.72, px + 0.72, 1.25, 1.29, pz - 0.32, pz + 0.07)
    lathe(b, P["iron"], px, pz - 0.12, [(0.08, 0), (0.05, 0.02), (0.02, 0.05), (0.02, 0.32)], seg=8, y0=1.29)
    for dx in (-0.2, 0.2):
        b.cyl(P["iron"], 0.012, (px, 1.55, pz - 0.12), (px + dx, 1.6, pz - 0.12), seg=4)
        lathe(b, P["brass"], px + dx, pz - 0.12, [(0.02, -0.02), (0.035, 0.0), (0.03, 0.02)], seg=6, y0=1.6)
    lathe(b, P["brass"], px, pz - 0.12, [(0.02, -0.02), (0.035, 0.0), (0.03, 0.02)], seg=6, y0=1.6)
    R.end()
    # a piano stool, a coat stand by the door, a rug down the hall
    R.begin(b, "manor:stool")
    lathe(b, P["oak_dk"], px, pz + 0.75, [(0.18, 0.45), (0.18, 0.5), (0.04, 0.42), (0.04, 0.12), (0.15, 0.02), (0.15, 0.0)], seg=10)
    R.end()
    R.begin(b, "manor:coat-stand")
    lathe(b, P["oak_dk"], -2.55, -12.85, [(0.22, 0), (0.2, 0.04), (0.04, 0.1), (0.035, 1.8), (0.05, 1.85), (0.002, 1.95)], seg=8)
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        b.cyl(P["oak_dk"], 0.015, (-2.55, 1.65, -12.85), (-2.55 + math.cos(a) * 0.2, 1.78, -12.85 + math.sin(a) * 0.2), seg=4)
    b.lump(P["velvet_dk"], 0.28, 0.7, 0.18, -2.55, 1.05, -12.68, seed=9, rnd=0.5, jitter=0.02)
    b.cyl(P["ebony"], 0.13, (-2.68, 1.82, -12.85), (-2.68, 1.98, -12.85), seg=10)   # a top hat
    b.cyl(P["ebony"], 0.2, (-2.68, 1.8, -12.85), (-2.68, 1.82, -12.85), seg=10)
    R.end()
    R.begin(b, "manor:hall-runner")
    box2(b, P["rug3"], -0.8, 0.8, 0.03, 0.04, -27.4, -21.1)
    box2(b, P["rug2"], -0.8, 0.8, 0.04, 0.045, -27.4, -27.25)
    box2(b, P["rug2"], -0.8, 0.8, 0.04, 0.045, -21.25, -21.1)
    R.end()


def dining(b, P, R):
    tx, tz = 9.0, -20.0
    # the long table (collider 1.4 x 5.2 x 0.82)
    R.begin(b, "manor:table")
    box2(b, P["oak_dk"], tx - 0.7, tx + 0.7, 0.74, 0.82, tz - 2.6, tz + 2.6, bevel=0.01)
    box2(b, P["oak_dk"], tx - 0.6, tx + 0.6, 0.62, 0.74, tz - 2.5, tz + 2.5)
    for dx in (-0.6, 0.6):
        for dz in (-2.45, 0.0, 2.45):
            lathe(b, P["oak_dk"], tx + dx, tz + dz, [(0.05, 0), (0.07, 0.08), (0.04, 0.16), (0.08, 0.32), (0.04, 0.5), (0.05, 0.62)], seg=8)
    # the cloth, rotten and torn at the hem
    box2(b, P["linen"], tx - 0.74, tx + 0.74, 0.82, 0.83, tz - 2.64, tz + 2.64)
    rnd = random.Random(41)
    for s in (-1, 1):
        z = tz - 2.6
        while z < tz + 2.6:
            ln = rnd.uniform(0.2, 0.5)
            drop = rnd.uniform(0.12, 0.38)
            box2(b, P["linen"], tx + s * 0.74 - 0.005, tx + s * 0.74 + 0.005, 0.83 - drop, 0.83, z, min(tz + 2.62, z + ln - 0.03))
            z += ln
    R.end()
    # the rotten feast (the candles stand on the JS's candelabra spots)
    R.begin(b, "manor:feast", on="manor:table")
    y = 0.83
    for cz in (-21.6, -18.4):
        lathe(b, P["iron"], tx, cz, [(0.08, 0), (0.06, 0.02), (0.025, 0.05), (0.02, 0.22), (0.04, 0.24), (0.03, 0.28)], seg=8, y0=y)
        for dx in (-0.18, 0.18):
            b.cyl(P["iron"], 0.01, (tx, y + 0.2, cz), (tx + dx, y + 0.28, cz), seg=4)
            lathe(b, P["iron"], tx + dx, cz, [(0.015, -0.02), (0.03, 0.0), (0.025, 0.01)], seg=6, y0=y + 0.28)
    for k in range(5):                                   # places laid both sides
        for s in (-1, 1):
            pz = tz - 2.0 + k * 1.0
            px = tx + s * 0.45
            b.cyl(P["pewter"], 0.13, (px, y, pz), (px, y + 0.015, pz), seg=12)
            if rnd.random() < 0.7:
                b.lump(P["rot"] if rnd.random() < 0.5 else P["meat"], 0.12, 0.05, 0.1, px, y + 0.015, pz, seed=k * 2 + s, rnd=0.6, jitter=0.01)
            gx, gz = px - s * 0.2, pz + 0.22
            if rnd.random() < 0.8:
                lathe(b, P["pewter"], gx, gz, [(0.035, 0), (0.01, 0.02), (0.008, 0.08), (0.03, 0.1), (0.035, 0.16)], seg=8, y0=y)
            else:
                b.box(P["pewter"], 0.18, 0.06, 0.06, gx, y, gz, rz=1.57, ry=rnd.uniform(0, 3))     # a goblet knocked over
            box2(b, P["pewter"], px - s * 0.17 - 0.008, px - s * 0.17 + 0.008, y, y + 0.006, pz - 0.1, pz + 0.1)
    # the roast on its platter, a cake with a slice gone, bottles, a skull
    b.cyl(P["pewter"], 0.32, (tx, y, tz - 0.6), (tx, y + 0.02, tz - 0.6), seg=16)
    b.lump(P["meat"], 0.42, 0.24, 0.3, tx, y + 0.02, tz - 0.6, seed=12, rnd=0.7, jitter=0.03)
    for s in (-1, 1):
        b.cyl(P["bone"], 0.025, (tx + s * 0.12, y + 0.12, tz - 0.6 - 0.12), (tx + s * 0.2, y + 0.24, tz - 0.6 - 0.24), seg=5)
    lathe(b, P["pewter"], tx, tz + 0.7, [(0.12, 0), (0.04, 0.03), (0.04, 0.12), (0.2, 0.14), (0.2, 0.16)], seg=14, y0=y)
    lathe(b, P["cake"], tx, tz + 0.7, [(0.17, 0), (0.17, 0.13), (0.15, 0.15), (0.002, 0.15)], seg=14, y0=y + 0.16)
    b.lump(P["rot"], 0.2, 0.05, 0.2, tx + 0.03, y + 0.3, tz + 0.72, seed=4, rnd=0.6, jitter=0.02)
    for k, (bx, bz) in enumerate(((tx - 0.2, tz + 1.4), (tx + 0.22, tz + 1.6), (tx - 0.1, tz - 1.4))):
        lathe(b, P["wine"] if k % 2 else P["glass"], bx, bz, [(0.045, 0), (0.045, 0.2), (0.015, 0.27), (0.015, 0.33), (0.02, 0.34)], seg=8, y0=y)
    b.box(P["glass"], 0.08, 0.08, 0.33, tx + 0.25, y, tz - 1.6, ry=0.7)                     # one rolled over
    b.lump(P["bone"], 0.17, 0.16, 0.2, tx - 0.25, y, tz + 0.05, seed=8, rnd=0.7, jitter=0.01)
    R.end()
    # the chairs, high Gothic backs, five a side, pushed back at odd angles
    for k in range(5):
        for s in (-1, 1):
            cz = tz - 2.0 + k * 1.0
            cx = tx + s * 1.1
            R.begin(b, f"manor:chair-{k}-{s}")
            ry = rnd.uniform(-0.12, 0.12)
            b.box(P["oak_dk"], 0.45, 0.06, 0.45, cx, 0.42, cz, ry=ry)
            b.box(P["velvet"], 0.4, 0.03, 0.4, cx, 0.48, cz, ry=ry)
            for dx in (-0.19, 0.19):
                for dz in (-0.19, 0.19):
                    b.box(P["oak_dk"], 0.04, 0.42, 0.04, cx + dx, 0.0, cz + dz)
            bx = cx + s * 0.21
            for dz in (-0.19, 0.19):
                b.box(P["oak_dk"], 0.05, 0.75, 0.05, bx, 0.48, cz + dz)
            b.prism(P["oak_dk"], [(cz - 0.2, 1.08), (cz + 0.2, 1.08), (cz + 0.2, 1.15), (cz, 1.32), (cz - 0.2, 1.15)], bx - 0.02, bx + 0.02, axis="x")
            for dz in (-0.07, 0.07):
                b.box(P["oak_dk"], 0.02, 0.55, 0.025, bx, 0.53, cz + dz)
            R.end()


def bedroom(b, P, R):
    # the four-poster (collider 2.0 x 2.4 x 0.6 at -9.2, -24.6, upstairs)
    bx, bz, y = -9.2, -24.6, UP
    R.begin(b, "manor:bed")
    box2(b, P["oak_dk"], bx - 0.98, bx + 0.98, y + 0.2, y + 0.38, bz - 1.18, bz + 1.18)
    b.box(P["linen"], 1.86, 0.18, 2.2, bx, y + 0.38, bz + 0.05, bevel=0.04)
    b.lump(P["velvet"], 1.95, 0.16, 1.5, bx, y + 0.5, bz + 0.4, seed=21, rnd=0.3, jitter=0.03)
    for dx in (-0.45, 0.45):
        b.lump(P["linen"], 0.6, 0.16, 0.38, bx + dx, y + 0.56, bz - 0.85, seed=int(dx * 10) + 30, rnd=0.6, jitter=0.02)
    for dx in (-0.94, 0.94):
        for dz in (-1.14, 1.14):
            lathe(b, P["oak_dk"], bx + dx, bz + dz, [(0.06, 0), (0.06, 0.4), (0.045, 0.5), (0.05, 0.8), (0.035, 0.9), (0.035, 2.3),
                                                     (0.05, 2.36), (0.03, 2.42)], seg=8, y0=y)
    for dz in (-1.14, 1.14):
        box2(b, P["oak_dk"], bx - 0.94, bx + 0.94, y + 2.25, y + 2.38, bz + dz - 0.03, bz + dz + 0.03)
    for dx in (-0.94, 0.94):
        box2(b, P["oak_dk"], bx + dx - 0.03, bx + dx + 0.03, y + 2.25, y + 2.38, bz - 1.14, bz + 1.14)
    box2(b, P["velvet_dk"], bx - 0.94, bx + 0.94, y + 2.36, y + 2.38, bz - 1.14, bz + 1.14)
    # the headboard, carved arch
    b.prism(P["oak_dk"], [(bx - 0.92, y + 0.38), (bx + 0.92, y + 0.38), (bx + 0.92, y + 1.3), (bx + 0.5, y + 1.5), (bx, y + 1.6),
                          (bx - 0.5, y + 1.5), (bx - 0.92, y + 1.3)], bz - 1.2, bz - 1.12, axis="z")
    # tattered drapes tied back at the posts
    rnd = random.Random(5)
    for dx in (-0.94, 0.94):
        for dz in (-1.14, 1.14):
            for k in range(3):
                h = rnd.uniform(1.4, 2.1)
                b.box(P["velvet_dk"], 0.12, h, 0.03, bx + dx + (0.06 if dx < 0 else -0.06) * k * 0.6, y + 2.36 - h, bz + dz + (0.05 if dz < 0 else -0.05) * k,
                      rz=rnd.uniform(-0.05, 0.05))
    R.end()
    # the wardrobe (collider 0.8 x 1.6 x 2.3 at -11.9, -22.4), doors to the east
    wx, wz = -11.9, -22.4
    R.begin(b, "manor:wardrobe")
    box2(b, P["oak_dk"], wx - 0.4, wx + 0.38, y, y + 2.2, wz - 0.8, wz + 0.8)
    box2(b, P["oak_dk"], wx - 0.44, wx + 0.44, y + 2.2, y + 2.32, wz - 0.86, wz + 0.86, bevel=0.015)
    for s in (-1, 1):
        box2(b, P["oak"], wx + 0.38, wx + 0.41, y + 0.2, y + 2.05, wz + s * 0.4 - 0.36, wz + s * 0.4 + 0.36)
        box2(b, P["oak_dk"], wx + 0.41, wx + 0.42, y + 0.35, y + 1.9, wz + s * 0.4 - 0.26, wz + s * 0.4 + 0.26)
        b.cyl(P["brass"], 0.02, (wx + 0.42, y + 1.1, wz + s * 0.06), (wx + 0.46, y + 1.1, wz + s * 0.06), seg=6)
    R.end()
    # the coffin on trestles (collider 0.9 x 2.2 x 0.8 at -3.2, -25.6), lid against the wall
    cx, cz = -3.2, -25.6
    R.begin(b, "manor:coffin")
    for dz in (-0.75, 0.75):
        for dx in (-0.35, 0.35):
            b.box(P["oak_dk"], 0.05, 0.56, 0.06, cx + dx, y, cz + dz, rx=0.12 if dx < 0 else -0.12)
        box2(b, P["oak_dk"], cx - 0.42, cx + 0.42, y + 0.5, y + 0.56, cz + dz - 0.06, cz + dz + 0.06)
    coffin_shape(b, P, cx, y + 0.56, cz, 0.48)
    R.end()
    R.begin(b, "manor:coffin-lid")
    # stood on its foot, leaning on the partition
    b.box(P["oak_dk"], 0.06, 1.95, 0.85, -4.62, y + 0.05, -25.2, rz=0.15)
    b.box(P["velvet"], 0.02, 1.7, 0.6, -4.57, y + 0.15, -25.2, rz=0.15)
    R.end()


def coffin_shape(b, P, cx, y0, cz, h):
    """An open coffin: the six-sided box, lined, with a body-shaped hollow."""
    lid = [(-0.3, -1.08), (0.3, -1.08), (0.44, 0.4), (0.22, 1.08), (-0.22, 1.08), (-0.44, 0.4)]
    n = len(lid)
    def wallring(m, pts_in, y_a, y_b):
        vs = [(cx + px, y_a, cz + pz) for px, pz in pts_in] + [(cx + px, y_b, cz + pz) for px, pz in pts_in]
        faces = [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)] + [list(range(n))[::-1], [n + i for i in range(n)]]
        b.poly(m, vs, faces)
    wallring(P["oak_dk"], lid, y0, y0 + 0.06)
    inner = [(px * 0.86, pz * 0.93) for px, pz in lid]
    for i in range(n):
        a, c = lid[i], lid[(i + 1) % n]
        ia, ic = inner[i], inner[(i + 1) % n]
        vs = [(cx + a[0], y0 + 0.06, cz + a[1]), (cx + c[0], y0 + 0.06, cz + c[1]), (cx + c[0], y0 + h, cz + c[1]), (cx + a[0], y0 + h, cz + a[1]),
              (cx + ia[0], y0 + 0.06, cz + ia[1]), (cx + ic[0], y0 + 0.06, cz + ic[1]), (cx + ic[0], y0 + h, cz + ic[1]), (cx + ia[0], y0 + h, cz + ia[1])]
        b.poly(P["oak_dk"], vs, [[0, 1, 2, 3], [5, 4, 7, 6], [3, 2, 6, 7]])
    wallring(P["velvet"], inner, y0 + 0.06, y0 + 0.09)
    b.lump(P["linen"], 0.36, 0.1, 0.3, cx, y0 + 0.09, cz + 0.8, seed=2, rnd=0.6, jitter=0.01)


def gallery(b, P, R):
    """The upstairs hall: a runner to the stair head, a console table under
    a cracked mirror between the north windows."""
    R.begin(b, "manor:gallery-runner")
    box2(b, P["rug"], -0.75, 0.75, UP, UP + 0.012, -26.85, HOLE[2] - 0.1)
    for z0, z1 in ((-26.85, -26.73), (HOLE[2] - 0.22, HOLE[2] - 0.1)):
        box2(b, P["rug2"], -0.75, 0.75, UP + 0.012, UP + 0.016, z0, z1)
    R.end()
    R.begin(b, "manor:console")
    zc = Z0 + T + 0.22
    box2(b, P["oak_dk"], -0.7, 0.7, UP + 0.8, UP + 0.86, zc - 0.2, zc + 0.2, bevel=0.01)
    for dx in (-0.62, 0.62):
        for dz in (-0.14, 0.14):
            lathe(b, P["oak_dk"], dx, zc + dz, [(0.025, 0), (0.035, 0.1), (0.02, 0.5), (0.03, 0.8)], seg=6, y0=UP)
    lathe(b, P["pewter"], -0.35, zc, [(0.07, 0), (0.05, 0.02), (0.015, 0.05), (0.015, 0.3), (0.04, 0.32)], seg=8, y0=UP + 0.86)
    b.lump(P["bone"], 0.16, 0.15, 0.18, 0.3, UP + 0.86, zc, seed=31, rnd=0.7, jitter=0.01)
    box2(b, P["gilt"], -0.55, 0.55, UP + 1.2, UP + 2.45, Z0 + T, Z0 + T + 0.05)
    box2(b, P["glass"], -0.45, 0.45, UP + 1.3, UP + 2.35, Z0 + T + 0.05, Z0 + T + 0.06)
    for x0, y0, x1, y1 in ((-0.3, 2.2, 0.1, 1.5), (0.1, 1.5, 0.35, 2.3), (0.1, 1.5, -0.4, 1.4)):
        L = math.hypot(x1 - x0, y1 - y0)
        b.box(P["ivory"], L, 0.008, 0.004, (x0 + x1) / 2, UP + (y0 + y1) / 2, Z0 + T + 0.062, rz=math.atan2(y1 - y0, x1 - x0))
    R.end()


def library(b, P, R):
    y = UP
    rnd = random.Random(17)
    books = [P["red"], P["green"], P["blue"], P["tan"], P["black"], P["plum"], P["red"], P["tan"]]
    # two cases (colliders 0.5 deep, 2.6 tall): along the partition facing
    # east, and on the east wall facing west
    for bid, (bx, bz, d, L, face) in enumerate(((5.4, -20.6, 0.5, 4.4, 1), (12.25, -22.5, 0.5, 2.4, -1))):
        R.begin(b, f"manor:bookcase-{bid}")
        z0, z1 = bz - L / 2, bz + L / 2
        x0, x1 = bx - d / 2, bx + d / 2
        box2(b, P["oak_dk"], x0, x1, y, y + 0.12, z0, z1)
        box2(b, P["oak_dk"], (x0 if face > 0 else x1 - 0.03), (x0 + 0.03 if face > 0 else x1), y, y + 2.6, z0, z1)
        box2(b, P["oak_dk"], x0 - 0.03, x1 + 0.03, y + 2.48, y + 2.6, z0 - 0.03, z1 + 0.03, bevel=0.01)
        bays = max(1, round(L / 1.1))
        for k in range(bays + 1):
            zz = z0 + (L - 0.05) * k / bays
            box2(b, P["oak_dk"], x0, x1, y, y + 2.48, zz, zz + 0.05)
        for sh in range(6):
            sy = y + 0.12 + sh * 0.4
            box2(b, P["oak_dk"], x0, x1, sy - 0.03, sy, z0, z1)
            if sh == 5:
                continue
            for k in range(bays):
                za = z0 + (L - 0.05) * k / bays + 0.05
                zb = z0 + (L - 0.05) * (k + 1) / bays
                z = za + 0.01
                lean = False
                while z < zb - 0.04:
                    bw = rnd.uniform(0.03, 0.07)
                    bh = rnd.uniform(0.24, 0.36)
                    bd = rnd.uniform(0.2, 0.3)
                    if rnd.random() < 0.06 and z + 0.3 < zb:
                        z += rnd.uniform(0.1, 0.25)        # a gap
                        lean = True
                        continue
                    m = rnd.choice(books)
                    fx = x1 - bd / 2 - 0.02 if face > 0 else x0 + bd / 2 + 0.02
                    if lean:
                        b.box(m, bd, bh, bw, fx, sy, z + bw / 2 + 0.06, rx=-0.35)
                        lean = False
                        z += bw + 0.12
                        continue
                    fbox(b, m, fx - bd / 2, fx + bd / 2, sy, sy + bh, z, z + bw, ("+x" if face > 0 else "-x") + " +y")
                    if rnd.random() < 0.35:
                        gx = fx + face * bd / 2
                        b.box(P["gilt"], 0.004, 0.015, bw * 0.8, gx, sy + bh * 0.75, z + bw / 2)
                    z += bw + 0.004
        # a skull and a candle stub on top
        b.lump(P["bone"], 0.16, 0.15, 0.18, bx, y + 2.6, z0 + 0.4, seed=bid + 3, rnd=0.7, jitter=0.01)
        R.end()
    # the writing desk (collider 1.8 x 0.9 x 0.8 at 8.8, -20.6)
    dx, dz = 8.8, -20.6
    R.begin(b, "manor:desk")
    box2(b, P["oak_dk"], dx - 0.9, dx + 0.9, y + 0.74, y + 0.8, dz - 0.45, dz + 0.45, bevel=0.01)
    for s in (-1, 1):
        box2(b, P["oak_dk"], dx + s * 0.6 - 0.28, dx + s * 0.6 + 0.28, y, y + 0.74, dz - 0.42, dz + 0.42)
        for k in range(3):
            box2(b, P["oak"], dx + s * 0.6 - 0.24, dx + s * 0.6 + 0.24, y + 0.06 + k * 0.22, y + 0.24 + k * 0.22, dz - 0.44, dz - 0.42)
            b.cyl(P["brass"], 0.015, (dx + s * 0.6, y + 0.15 + k * 0.22, dz - 0.44), (dx + s * 0.6, y + 0.15 + k * 0.22, dz - 0.47), seg=6)
    box2(b, P["velvet_dk"], dx - 0.5, dx + 0.3, y + 0.8, y + 0.805, dz - 0.3, dz + 0.3)
    # an open book, a quill in its well, a globe
    for s in (-1, 1):
        b.box(P["linen"], 0.22, 0.02, 0.3, dx + 0.0 + s * 0.11, y + 0.805, dz - 0.05, rz=s * 0.06)
    lathe(b, P["ebony"], dx + 0.35, dz - 0.2, [(0.04, 0), (0.04, 0.05), (0.02, 0.06)], seg=8, y0=y + 0.8)
    b.box(P["linen"], 0.01, 0.25, 0.02, dx + 0.35, y + 0.85, dz - 0.2, rz=0.4)
    b.cyl(P["brass"], 0.02, (dx + 0.7, y + 0.8, dz + 0.1), (dx + 0.7, y + 0.92, dz + 0.1), seg=6)
    b.lump(P["tan"], 0.26, 0.26, 0.26, dx + 0.7, y + 0.92, dz + 0.1, seed=9, rnd=1.0, jitter=0.0)
    ring(b, P["brass"], (dx + 0.7, y + 1.05, dz + 0.1), 0.16, 0.008, seg=16, tseg=4, axis="x")
    R.end()
    # the reading chair (the JS's 0.7 box at 8.8, -22.2)
    R.begin(b, "manor:reading-chair")
    b.box(P["velvet_dk"], 0.72, 0.42, 0.7, dx, y, -22.2, bevel=0.03)
    b.box(P["velvet_dk"], 0.72, 0.6, 0.18, dx, y + 0.42, -22.47, bevel=0.03)
    for s in (-1, 1):
        b.cyl(P["velvet_dk"], 0.1, (dx + s * 0.33, y + 0.55, -22.55), (dx + s * 0.33, y + 0.55, -21.9), seg=8)
    R.end()


def build_manor(P, R):
    b = HGBuilder()
    shell(b, P)
    roof(b, P)
    turret(b, P)
    porch(b, P)
    stair(b, P)
    chandelier(b, P)
    parlour(b, P, R)
    foyer(b, P, R)
    dining(b, P, R)
    bedroom(b, P, R)
    gallery(b, P, R)
    library(b, P, R)
    # rocking chair on the porch, between the door and the east window
    R.begin(b, "manor:rocking-chair")
    rx, rz, y = 1.95, -11.25, 0.25          # on the porch deck
    for s in (-1, 1):
        ring(b, P["oak_dk"], (rx + s * 0.24, y + 0.6, rz), 0.6, 0.02, seg=10, tseg=4, axis="x", arc=1.0, a0=math.pi - 0.5)
        b.box(P["oak_dk"], 0.04, 0.45, 0.04, rx + s * 0.24, y + 0.04, rz + 0.18)
        b.box(P["oak_dk"], 0.04, 1.1, 0.04, rx + s * 0.24, y + 0.05, rz - 0.24, rx=-0.15)
    b.box(P["oak"], 0.5, 0.04, 0.45, rx, y + 0.45, rz, rx=0.08)
    for k in range(5):
        b.box(P["oak"], 0.04, 0.6, 0.02, rx - 0.18 + k * 0.09, y + 0.55, rz - 0.3, rx=-0.15)
    b.box(P["oak_dk"], 0.52, 0.06, 0.05, rx, y + 1.12, rz - 0.36, rx=-0.15)
    R.end()
    for face in FACES:
        R.face(*face)
    b.finish("hg-manor.glb")


# Faces rule 9 keeps clear: the front door, the ground-floor windows behind
# the porch, the portraits (house-props.js hangs them).
FACES = [
    ("door:manor-front", "manor", (0.0, 1.35, Z1 + 0.02), (0, 0, 1), 2.2, 2.7),
    ("door:manor-balcony", "manor", (0.0, UP + 1.2, Z1 + 0.02), (0, 0, 1), 2.2, 2.4),
    ("window:manor-porch-w", "manor", (-3.6, 1.75, Z1 + 0.02), (0, 0, 1), 1.4, 1.5),
    ("window:manor-porch-e", "manor", (3.6, 1.75, Z1 + 0.02), (0, 0, 1), 1.4, 1.5),
    ("portrait:parlour", "manor", (-5.2, 2.0, -21.0), (-1, 0, 0), 0.9, 1.1),
    ("portrait:foyer", "manor", (0.0, 2.1, Z0 + T + 0.05), (0, 0, 1), 0.9, 1.1),
    ("portrait:dining", "manor", (12.35, 2.0, -17.9), (-1, 0, 0), 0.9, 1.1),
]
