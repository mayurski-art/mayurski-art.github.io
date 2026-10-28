"""
Hollowgrin's old midway (phase 4): hg-fair.glb, in map coordinates. The
entrance arch, the two game booths (whack-a-troll with its plush prizes,
ring toss with its bottles and the balloon board), the ticket booth, the
high striker, Madame Lulz's tent and her table, the candy-apple cart, the
popcorn cart and the festoon poles down the midway.

hollowgrin.js keeps the words (the canvas signs), the whack-a-troll heads,
the bulbs and string lights, the glows, the crystal ball and every
collider (MIDWAY_POPCORN for the popcorn cart). The map is at its 16 MB
cap: faces only where they show.
"""
import math
import random

from map_kit import mat
from hg_kit import HGBuilder, facing, fbox, lathe, ring, troll_face
from hg_village import palette as village_palette

ARCH_X, ARCH_Z = 37.3, (2.3, 5.9)
BOOTHS = [(6.8, 11.2, "whack"), (14.4, 18.8, "ring")]        # z0, z1: hollowgrin.js booth()
TICKET = (36.2, 7.6)
STRIKER = (42.5, -17.0)
TENT = (45.5, -30.0, 2.4)
APPLE_CART = (43.2, 24.0)
POPCORN = (46.6, 27.6)                                         # hollowgrin.js MIDWAY_POPCORN
POLES = [(37.6, -36), (41.4, -26.6), (37.6, -24), (41.4, -18), (37.6, -12), (37.6, 0), (41.4, 12), (37.6, 24), (41.4, 30)]
TAU = 2 * math.pi


def palette():
    return {
        **village_palette(),
        "booth": mat("HG_BoothWood", 0x7a5236, 0.85),
        "booth2": mat("HG_BoothWood2", 0x6a462e, 0.85),
        "booth_dk": mat("HG_BoothDark", 0x3a2618, 0.85),
        "str_r": mat("HG_AwningRed", 0xb8222a, 0.8),
        "str_c": mat("HG_AwningCream", 0xe8dcc0, 0.8),
        "str_p": mat("HG_AwningPurple", 0x6a2a9a, 0.8),
        "fgold": mat("HG_FairGold", 0xd0a040, 0.35, 0.6),
        "fascia": mat("HG_FasciaDark", 0x1a0c14, 0.7),
        "plush": mat("HG_PlushWhite", 0xf2f0ea, 0.95),
        "plush_p": mat("HG_PlushPurple", 0x8a5ac8, 0.95),
        "plush_g": mat("HG_PlushGreen", 0x5ab87a, 0.95),
        "plush_o": mat("HG_PlushOrange", 0xe8802a, 0.95),
        "face": mat("HG_PlushFace", 0x18161a, 0.8),
        "cab": mat("HG_WhackCabinet", 0x1e3a2a, 0.6),
        "hole": mat("HG_WhackHole", 0x0c0c0e, 0.9),
        "glass_g": mat("HG_BottleGreen", 0x2a7a4a, 0.15),
        "glass_a": mat("HG_BottleAmber", 0x9a5a1a, 0.15),
        "glass_c": mat("HG_BottleClear", 0xa8c8d0, 0.1),
        "ring_r": mat("HG_TossRingRed", 0xff3a5a, 0.4),
        "ring_y": mat("HG_TossRingYellow", 0xffd23a, 0.4),
        "ring_b": mat("HG_TossRingBlue", 0x3ad0ff, 0.4),
        "bal_r": mat("HG_BalloonRed", 0xd8202a, 0.3),
        "bal_y": mat("HG_BalloonYellow", 0xf0c020, 0.3),
        "bal_b": mat("HG_BalloonBlue", 0x2a7ad8, 0.3),
        "bal_g": mat("HG_BalloonGreen", 0x3ab84a, 0.3),
        "dart": mat("HG_DartFlight", 0xe8e0d0, 0.6),
        "booth_red": mat("HG_TicketRed", 0x9a2a24, 0.8),
        "shingle_f": mat("HG_TicketShingle", 0x2e2630, 0.85),
        "tkt": mat("HG_TicketRoll", 0xe8a84a, 0.7),
        "jar": mat("HG_TipJar", 0x9ab8c0, 0.1),
        "coin": mat("HG_TipCoin", 0xc8a050, 0.3, 0.7),
        "scale_r": mat("HG_ScaleRed", 0xd02a24, 0.6),
        "scale_o": mat("HG_ScaleOrange", 0xe8702a, 0.6),
        "scale_y": mat("HG_ScaleYellow", 0xf0c020, 0.6),
        "tick": mat("HG_ScaleTick", 0xf0ece0, 0.6),
        "puck": mat("HG_StrikerPuck", 0xe02a2a, 0.4),
        "tent_p": mat("HG_TentPurple", 0x4a1a6a, 0.9),
        "tent_k": mat("HG_TentBlack", 0x1c1020, 0.9),
        "cloth": mat("HG_TableCloth", 0x2a1238, 0.9),
        "rug": mat("HG_TentRug", 0x6a1a24, 0.95),
        "card": mat("HG_TarotCard", 0xe8dcc0, 0.7),
        "cart_r": mat("HG_CartRed", 0xb81c24, 0.5),
        "cart_c": mat("HG_CartCream", 0xe8dcc0, 0.6),
        "apple": mat("HG_CandyApple", 0x9a0e16, 0.2),
        "pop": mat("HG_PopcornGlow", 0xffe8a0, 0.7, 0.0, 0xffd27a, 0.9),
        "kettle": mat("HG_PopKettle", 0x9aa0a8, 0.3, 0.8),
        "pole": mat("HG_PoleWood", 0x5a4030, 0.85),
    }


def hbox(b, m, x0, x1, y0, y1, z0, z1):
    """A box by its extents (all six faces)."""
    fbox(b, m, x0, x1, y0, y1, z0, z1, "+x -x +y -y +z -z")


def wheel(b, P, c, r, axis_z=True, spokes=6, m="fgold", tyre="iron"):
    """A spoked cart wheel round c, its axle along z (or x)."""
    ring(b, P[tyre], c, r, 0.025, seg=12, tseg=3, axis="z" if axis_z else "x")
    for k in range(spokes):
        a = k / spokes * TAU
        d = (math.cos(a) * r, math.sin(a) * r)
        e = (c[0] + d[0], c[1] + d[1], c[2]) if axis_z else (c[0], c[1] + d[1], c[2] + d[0])
        b.cyl(P[m], 0.012, c, e, seg=3, caps=False)
    w = 0.05
    a0, a1 = ((c[0], c[1], c[2] - w), (c[0], c[1], c[2] + w)) if axis_z else ((c[0] - w, c[1], c[2]), (c[0] + w, c[1], c[2]))
    b.cyl(P[m], 0.045, a0, a1, seg=6)


def scallops(b, m_list, pts, depth, out):
    """A scalloped hem hanging from the points pts (in order): a pennant
    point under every span, coloured in turn."""
    for i in range(len(pts) - 1):
        a, c = pts[i], pts[i + 1]
        mid = ((a[0] + c[0]) / 2, min(a[1], c[1]) - depth, (a[2] + c[2]) / 2)
        sh = 0.4
        a2 = (a[0], a[1] - depth * sh, a[2])
        c2 = (c[0], c[1] - depth * sh, c[2])
        facing(b, m_list[i % len(m_list)], [a, c, c2, mid, a2], out(mid))


def plush(b, P, x, y, z, s, body, f=(-1.0, 0.0, 0.0)):
    """A plush troll sitting at x, y, z: a soft body, a white head with the
    grin, stubby arms. s scales it (0.13 a shelf prize)."""
    lathe(b, P[body], x, z, [(0.0, 0.0), (s * 0.85, 0.05 * s), (s * 1.0, 0.5 * s), (s * 0.8, 1.0 * s), (s * 0.45, 1.2 * s)], seg=6, y0=y)
    hy = y + 1.75 * s
    lathe(b, P["plush"], x, z, [(0.0, -s * 0.72), (s * 0.62, -s * 0.5), (s * 0.78, 0.0), (s * 0.6, s * 0.5), (0.0, s * 0.75)], seg=8, y0=hy)
    troll_face(b, P["face"], (x, hy, z), s * 0.76, f)
    if s < 0.15:                       # shelf prizes: no arms
        return
    rt = (f[2], 0.0, -f[0])
    for k in (-1, 1):
        a = (x + rt[0] * k * s * 0.85, y + 0.85 * s, z + rt[2] * k * s * 0.85)
        e = (a[0] + rt[0] * k * s * 0.3 + f[0] * s * 0.25, y + 0.45 * s, a[2] + rt[2] * k * s * 0.3 + f[2] * s * 0.25)
        b.cyl(P[body], s * 0.2, a, e, seg=6, r2=s * 0.17)


# ------------------------------------------------------------------ the arch

def arch(b, P, R):
    x = ARCH_X
    R.begin(b, "fair:arch")
    for z in ARCH_Z:
        # a square post: plinth, shaft, capital, a gold ball finial
        hbox(b, P["booth_dk"], x - 0.25, x + 0.25, 0.0, 0.35, z - 0.25, z + 0.25)
        hbox(b, P["barn"], x - 0.2, x + 0.2, 0.35, 4.34, z - 0.2, z + 0.2)
        hbox(b, P["booth_dk"], x - 0.25, x + 0.25, 4.34, 4.48, z - 0.25, z + 0.25)
        lathe(b, P["fgold"], x, z, [(0.0, 4.48), (0.07, 4.5), (0.06, 4.56), (0.18, 4.66), (0.2, 4.76), (0.14, 4.88), (0.0, 4.92)], seg=8)
        for yy in (0.42, 1.2, 2.6):           # gold bands on the shaft
            hbox(b, P["fgold"], x - 0.21, x + 0.21, yy, yy + 0.06, z - 0.21, z + 0.21)
    # the header board between the posts: the sign is laid over it both sides
    hbox(b, P["fascia"], x - 0.2, x + 0.2, 3.5, 4.34, 2.5, 5.7)
    for y0, y1 in ((3.47, 3.53), (4.31, 4.37)):
        hbox(b, P["fgold"], x - 0.22, x + 0.22, y0, y1, 2.5, 5.7)
    # braces from the posts up under the board
    for z, s in ((ARCH_Z[0], 1), (ARCH_Z[1], -1)):
        b.bar(P["booth_dk"], (x, 2.85, z + s * 0.21), (x, 3.52, z + s * 0.85), 0.08, 0.08)
        b.bar(P["fgold"], (x, 3.2, z + s * 0.21), (x, 3.5, z + s * 0.5), 0.04, 0.04)
    R.end()
    for s, xx in ((-1, x - 0.22), (1, x + 0.22)):
        R.face(f"fair:arch-sign-{'w' if s < 0 else 'e'}", "fair:arch", (xx, 3.92, 4.1), (float(s), 0.0, 0.0), 3.9, 0.72)


# ------------------------------------------------------------------ the booths

def booth(b, P, z0, z1, kind, rnd):
    d = z1 - z0
    mz = (z0 + z1) / 2
    wood = (P["booth"], P["booth2"])
    roof = lambda xx: 2.55 + (xx - 45.7) / 3.9 * 0.45          # noqa: E731  the awning's height over x
    # back wall: vertical planks
    n = max(4, round(d / 0.3))
    for k in range(n):
        zc = z0 + (k + 0.5) * d / n
        b.box(wood[k % 2], 0.2, roof(49.6) + 0.02, d / n - 0.012, 49.5, 0.0, zc)
    # side walls: planks up to the awning, a post at each front corner
    for zw in (z0 + 0.1, z1 - 0.1):
        for k in range(12):
            xc = 46.0 + (k + 0.5) * 0.3
            b.box(wood[(k + (zw > mz)) % 2], 0.288, roof(xc) - 0.02, 0.18, xc, 0.0, zw)
        b.box(P["booth_dk"], 0.14, roof(46.05) + 0.02, 0.22, 46.07, 0.0, zw)
        b.box(P["booth_dk"], 3.6, 0.08, 0.22, 47.8, 0.0, zw)
    # the counter: a striped skirt of boards, an overhanging top
    stripes = (P["str_r"], P["str_c"]) if kind == "whack" else (P["str_p"], P["str_c"])
    m = max(4, round((d - 0.4) / 0.24))
    for k in range(m):
        zc = z0 + 0.2 + (k + 0.5) * (d - 0.4) / m
        b.box(stripes[k % 2], 0.05, 0.92, (d - 0.4) / m - 0.01, 46.03, 0.0, zc)
    hbox(b, P["booth_dk"], 46.08, 46.5, 0.0, 0.94, z0 + 0.2, z1 - 0.2)
    hbox(b, P["booth"], 45.92, 46.58, 0.94, 1.02, z0 + 0.16, z1 - 0.16)
    # the awning: striped slats from the back wall out past the posts
    k_n = max(6, round(d / 0.42))
    for k in range(k_n):
        za, zb = z0 - 0.15 + k * (d + 0.3) / k_n, z0 - 0.15 + (k + 1) * (d + 0.3) / k_n
        facing(b, stripes[k % 2], [(45.7, roof(45.7), za), (49.62, roof(49.62), za), (49.62, roof(49.62), zb), (45.7, roof(45.7), zb)], (0.0, 1.0, 0.0))
    # the valance: pennants under the awning's front edge
    pts = [(45.69, roof(45.7) - 0.01, z0 - 0.15 + k * (d + 0.3) / k_n) for k in range(k_n + 1)]
    scallops(b, stripes, pts, 0.28, lambda p: (-1.0, 0.0, 0.0))
    # the fascia the sign hangs on, gold edged, scrolled ends
    hbox(b, P["fascia"], 45.72, 45.78, roof(45.7) - 0.01, 3.46, z0 + 0.3, z1 - 0.3)
    for y0 in (2.72, 3.42):
        hbox(b, P["fgold"], 45.7, 45.79, y0, y0 + 0.05, z0 + 0.3, z1 - 0.3)
    for zz, s in ((z0 + 0.3, -1), (z1 - 0.3, 1)):
        facing(b, P["fascia"], [(45.75, roof(45.7), zz), (45.75, roof(45.7), zz + s * 0.3), (45.75, 3.1, zz)], (-1.0, 0.0, 0.0))
    if kind == "whack":
        whack(b, P, z0, z1)
    else:
        ring_toss(b, P, z0, z1, rnd)


def whack(b, P, z0, z1):
    # the cabinet: dark green, a sloped top with six holes, gold edge
    hbox(b, P["cab"], 47.25, 48.35, 0.0, 0.94, 7.2, 10.8)
    hbox(b, P["fgold"], 47.23, 48.37, 0.94, 0.97, 7.18, 10.82)
    for i in range(6):
        zc = 7.6 + i * 0.56
        lathe(b, P["hole"], 47.45, zc, [(0.0, 0.975), (0.15, 0.975)], seg=10, caps=False)
        ring(b, P["fgold"], (47.45, 0.985, zc), 0.165, 0.018, seg=10, tseg=3)
    # two mallets on the counter
    for zc, ry in ((7.6, 0.3), (10.3, -0.4)):
        hx, hz = 46.25 + math.cos(ry) * 0.18, zc + math.sin(ry) * 0.18
        b.cyl(P["booth_dk"], 0.02, (46.25 - math.cos(ry) * 0.15, 1.04, zc - math.sin(ry) * 0.15), (hx, 1.04, hz), seg=5)
        b.cyl(P["str_r"], 0.06, (hx - math.sin(ry) * 0.1, 1.08, hz + math.cos(ry) * 0.1), (hx + math.sin(ry) * 0.1, 1.08, hz - math.cos(ry) * 0.1), seg=8)
    # prize shelves on the back wall, plush trolls on them
    kinds = ("plush_p", "plush_g", "plush_o", "str_r")
    for j, ys in enumerate((1.45, 2.05)):
        hbox(b, P["booth_dk"], 49.08, 49.4, ys - 0.04, ys, z0 + 0.3, z1 - 0.3)
        for k in range(5):
            plush(b, P, 49.24, ys, z0 + 0.7 + k * (z1 - z0 - 1.4) / 4, 0.12, kinds[(k + j) % 4])
    # big prizes hanging inside the front corners
    for zc, kk in ((z0 + 0.5, "plush_p"), (z1 - 0.5, "plush_g")):
        b.cyl(P["twine"], 0.006, (46.3, roof_y(46.3), zc), (46.3, 2.15, zc), seg=3, caps=False)
        plush(b, P, 46.3, 1.62, zc, 0.19, kk)


def roof_y(xx):
    return 2.55 + (xx - 45.7) / 3.9 * 0.45


def bottle(b, m, x, y, z):
    lathe(b, m, x, z, [(0.0, 0.0), (0.075, 0.0), (0.08, 0.17), (0.04, 0.24), (0.028, 0.32), (0.0, 0.32)], seg=6, y0=y)


def ring_toss(b, P, z0, z1, rnd):
    glass = (P["glass_g"], P["glass_a"], P["glass_c"])
    for tier in range(3):
        x0 = 48.0 + tier * 0.4
        top = 0.9 + tier * 0.3
        hbox(b, P["booth2"] if tier % 2 else P["booth"], x0, x0 + 0.4, 0.0, top, 14.9, 18.3)
        hbox(b, P["str_c"], x0 - 0.01, x0 + 0.41, top - 0.05, top, 14.89, 18.31)
        for i in range(8):
            bottle(b, glass[(i + tier) % 3], x0 + 0.2, top, 15.2 + i * 0.4)
    # rings on the counter, and one round a bottle neck
    rm = (P["ring_r"], P["ring_y"], P["ring_b"])
    for i in range(5):
        ring(b, rm[i % 3], (46.25 + rnd.uniform(-0.1, 0.1), 1.04, 15.4 + i * 0.5), 0.12, 0.02, seg=10, tseg=3)
    ring(b, P["ring_y"], (48.6, 1.42, 16.0), 0.07, 0.016, seg=10, tseg=3)
    # the balloon board on the back wall, darts stuck in it
    hbox(b, P["cork"], 49.32, 49.4, 1.95, 2.9, 14.8, 18.4)
    hbox(b, P["fgold"], 49.3, 49.41, 2.9, 2.95, 14.75, 18.45)
    bm = (P["bal_r"], P["bal_y"], P["bal_b"], P["bal_g"])
    for r_ in range(3):
        for c in range(8):
            if (r_ * 8 + c) % 7 == 3:          # popped
                continue
            zc = 15.0 + c * 0.47 + (0.2 if r_ % 2 else 0.0)
            yc = 2.15 + r_ * 0.3
            lathe(b, bm[(r_ + c) % 4], 49.22, zc, [(0.0, -0.13), (0.09, -0.06), (0.09, 0.06), (0.0, 0.13)], seg=5, y0=yc)
    for zc, yc in ((15.7, 2.3), (16.9, 2.65), (17.6, 2.1)):
        b.cyl(P["iron"], 0.006, (49.32, yc, zc), (49.12, yc + 0.02, zc + 0.02), seg=3, caps=False)
        facing(b, P["dart"], [(49.12, yc - 0.04, zc), (49.04, yc - 0.04, zc), (49.04, yc + 0.06, zc), (49.12, yc + 0.06, zc)], (0.0, 0.0, 1.0))


# ------------------------------------------------------------ the ticket booth

def ticket_booth(b, P, R):
    x, z = TICKET
    x0, x1, z0, z1 = x - 0.8, x + 0.8, z - 0.8, z + 0.8
    R.begin(b, "fair:tickets")
    # the walls, red, battens on the faces the words leave free
    fbox(b, P["booth_red"], x0, x1, 0.0, 2.4, z0, z1, "+x -x +z -z")
    for zz in (z0 + 0.04, z1 - 0.04):
        for xx in (x0 + 0.04, x1 - 0.04):
            hbox(b, P["str_c"], xx - 0.045, xx + 0.045, 0.0, 2.4, zz - 0.045, zz + 0.045)
    for k in range(1, 5):
        zz = z0 + k * 0.32
        hbox(b, P["booth_dk"], x1, x1 + 0.025, 0.2, 2.4, zz - 0.025, zz + 0.025)            # east
        xx = x0 + k * 0.32
        hbox(b, P["booth_dk"], xx - 0.025, xx + 0.025, 0.2, 2.4, z1, z1 + 0.025)            # south
    hbox(b, P["str_c"], x0 - 0.03, x1 + 0.03, 0.0, 0.2, z0 - 0.03, z1 + 0.03)                # skirt
    hbox(b, P["str_c"], x0 - 0.03, x1 + 0.03, 2.3, 2.4, z0 - 0.03, z1 + 0.03)                # frieze
    # the ticket window's casing (the JS glows the window and lays the words)
    for zz0, zz1, y0, y1 in ((7.12, 7.2, 1.04, 1.78), (8.0, 8.08, 1.04, 1.78), (7.12, 8.08, 1.7, 1.78)):
        hbox(b, P["str_c"], x0 - 0.05, x0, y0, y1, zz0, zz1)
    # the sill shelf, the ticket roll and the tip jar at its ends
    hbox(b, P["booth_dk"], x0 - 0.16, x0, 0.98, 1.03, 6.92, 8.34)
    b.cyl(P["tkt"], 0.06, (x0 - 0.09, 1.09, 6.96), (x0 - 0.09, 1.09, 7.08), seg=8)
    lathe(b, P["jar"], x0 - 0.08, 8.24, [(0.0, 0.0), (0.05, 0.0), (0.055, 0.08), (0.045, 0.1), (0.0, 0.1)], seg=8, y0=1.03)
    lathe(b, P["coin"], x0 - 0.08, 8.24, [(0.0, 0.0), (0.045, 0.0), (0.045, 0.03), (0.0, 0.03)], seg=8, y0=1.035)
    # the poster's gold frame on the north face (the poster is the JS's)
    for y0, y1 in ((0.87, 0.94), (1.76, 1.83)):
        hbox(b, P["fgold"], x - 0.74, x + 0.74, y0, y1, z0 - 0.04, z0)
    # a hip roof with a gold finial
    e, y_e, y_a = 1.08, 2.4, 3.35
    corners = [(x - e, z - e), (x + e, z - e), (x + e, z + e), (x - e, z + e)]
    for i in range(4):
        a, c = corners[i], corners[(i + 1) % 4]
        out = ((a[0] + c[0]) / 2 - x, 0.6, (a[1] + c[1]) / 2 - z)
        facing(b, P["shingle_f"], [(a[0], y_e, a[1]), (c[0], y_e, c[1]), (x, y_a, z)], out)
        facing(b, P["shingle_f"], [(a[0], y_e, a[1]), (c[0], y_e, c[1]), (c[0], y_e - 0.08, c[1]), (a[0], y_e - 0.08, a[1])], (out[0], 0.0, out[2]))
        b.bar(P["fgold"], (a[0], y_e + 0.01, a[1]), (x, y_a + 0.01, z), 0.035, 0.035)
    facing(b, P["booth_dk"], [(c[0], y_e - 0.08, c[1]) for c in corners], (0.0, -1.0, 0.0))
    lathe(b, P["fgold"], x, z, [(0.0, 0.0), (0.06, 0.0), (0.1, 0.12), (0.06, 0.24), (0.015, 0.3), (0.015, 0.55), (0.0, 0.6)], seg=8, y0=y_a - 0.02)
    R.end()
    R.face("fair:ticket-window", "fair:tickets", (x0 - 0.01, 1.4, z), (-1.0, 0.0, 0.0), 0.8, 0.6)
    R.face("fair:ticket-sign", "fair:tickets", (x0 - 0.02, 2.0, z), (-1.0, 0.0, 0.0), 1.2, 0.3)
    R.face("fair:ticket-poster", "fair:tickets", (x, 1.35, z0 - 0.02), (0.0, 0.0, -1.0), 1.42, 0.8)


# ------------------------------------------------------------ the high striker

def striker(b, P, R):
    x, z = STRIKER
    R.begin(b, "fair:striker")
    # the base: a planked platform, the strike pad on its west edge
    for k in range(5):
        zc = z - 0.6 + (k + 0.5) * 0.24
        b.box(P["booth"] if k % 2 else P["booth2"], 1.2, 0.3, 0.232, x, 0.0, zc)
    hbox(b, P["booth_dk"], x - 0.62, x + 0.62, 0.0, 0.08, z - 0.62, z + 0.62)
    lathe(b, P["iron"], x - 0.35, z, [(0.0, 0.3), (0.16, 0.3), (0.16, 0.36), (0.12, 0.4), (0.0, 0.4)], seg=10)
    lathe(b, P["puck"], x - 0.35, z, [(0.0, 0.4), (0.09, 0.4), (0.09, 0.43), (0.0, 0.43)], seg=10)
    # the tower: dark post, the painted scale up its west face
    hbox(b, P["booth_dk"], x - 0.175, x + 0.175, 0.3, 5.9, z - 0.175, z + 0.175)
    bands = (P["scale_r"], P["scale_o"], P["scale_y"])
    for k in range(10):
        y0 = 0.5 + k * 0.5
        fbox(b, bands[k * 3 // 10], x - 0.18, x - 0.18, y0, y0 + 0.48, z - 0.15, z + 0.15, "-x")
        fbox(b, P["tick"], x - 0.181, x - 0.181, y0 + 0.46, y0 + 0.5, z - 0.15, z + 0.15, "-x")
    for s in (-1, 1):                       # side rails
        hbox(b, P["fgold"], x - 0.2, x - 0.16, 0.5, 5.5, z + s * 0.17 - 0.015, z + s * 0.17 + 0.015)
    # the guide wire and the puck on it
    b.cyl(P["iron"], 0.008, (x - 0.24, 0.45, z), (x - 0.24, 5.5, z), seg=4, caps=False)
    hbox(b, P["puck"], x - 0.3, x - 0.18, 1.55, 1.68, z - 0.08, z + 0.08)
    # the bell, hung off the tower's face near the top
    b.bar(P["iron"], (x - 0.175, 5.72, z), (x - 0.42, 5.72, z), 0.04, 0.04)
    lathe(b, P["fgold"], x - 0.38, z, [(0.0, 5.7), (0.08, 5.69), (0.17, 5.55), (0.24, 5.42), (0.26, 5.38), (0.0, 5.38)][::-1], seg=12)
    # the sign board on top (the JS lays the words on its west face)
    hbox(b, P["fascia"], x - 0.18, x - 0.08, 5.95, 6.65, z - 1.35, z + 1.35)
    for y0 in (5.93, 6.62):
        hbox(b, P["fgold"], x - 0.2, x - 0.07, y0, y0 + 0.05, z - 1.37, z + 1.37)
    for s in (-1, 1):
        lathe(b, P["fgold"], x - 0.13, z + s * 1.37, [(0.0, 0.0), (0.06, 0.0), (0.08, 0.06), (0.0, 0.14)], seg=6, y0=6.67)
    hbox(b, P["booth_dk"], x - 0.12, x + 0.12, 5.9, 5.95, z - 0.4, z + 0.4)
    R.end()
    R.begin(b, "fair:striker-mallet")
    # the mallet leant against the base
    hx, hz = x - 0.9, z + 0.7
    b.cyl(P["booth"], 0.025, (hx - 0.36, 0.0, hz), (hx + 0.02, 1.05, hz), seg=6)
    b.cyl(P["booth_dk"], 0.1, (hx + 0.02, 1.05, hz - 0.17), (hx + 0.02, 1.05, hz + 0.17), seg=10)
    R.end()
    R.face("fair:striker-sign", "fair:striker", (x - 0.2, 6.3, z), (-1.0, 0.0, 0.0), 2.6, 0.5)


# ------------------------------------------------------------ Madame Lulz's tent

def tent(b, P, R):
    x, z, r = TENT
    R.begin(b, "fair:tent")
    n = 24
    door = 0.27
    h = 2.2
    cols = (P["tent_p"], P["tent_k"])
    for i in range(n):
        a0, a1 = math.pi + door + i / n * (TAU - 2 * door), math.pi + door + (i + 1) / n * (TAU - 2 * door)
        p0 = (x + math.cos(a0) * r, z + math.sin(a0) * r)
        p1 = (x + math.cos(a1) * r, z + math.sin(a1) * r)
        am = (a0 + a1) / 2
        out = (math.cos(am), 0.0, math.sin(am))
        facing(b, cols[i % 2], [(p0[0], 0.0, p0[1]), (p1[0], 0.0, p1[1]), (p1[0], h, p1[1]), (p0[0], h, p0[1])], out)
        # a scallop under the eave all round but the door
        mid = (x + math.cos(am) * (r + 0.27), h - 0.3, z + math.sin(am) * (r + 0.27))
        e0 = (x + math.cos(a0) * (r + 0.25), h, z + math.sin(a0) * (r + 0.25))
        e1 = (x + math.cos(a1) * (r + 0.25), h, z + math.sin(a1) * (r + 0.25))
        facing(b, P["fgold"] if i % 2 else P["tent_p"], [e0, e1, mid], out)
    # the door flaps, tied back either side
    for s in (-1, 1):
        a = math.pi + s * door
        px, pz = x + math.cos(a) * r, z + math.sin(a) * r
        tx, tz = x + math.cos(a + s * 0.42) * (r + 0.12), z + math.sin(a + s * 0.42) * (r + 0.12)
        facing(b, P["tent_p"], [(px, h, pz), (px, 0.0, pz), (tx, 0.0, tz), (tx, 1.0, tz)], (-1.0, 0.0, 0.0))
        b.cyl(P["fgold"], 0.018, (px, 1.05, pz), (tx, 1.0, tz), seg=4, caps=False)
        lathe(b, P["fgold"], tx, tz, [(0.0, 0.0), (0.04, 0.02), (0.02, 0.2), (0.0, 0.2)][::-1], seg=5, y0=0.78)
    # the roof: a striped cone, its eave band, the crescent on the finial
    m = 24
    apex = (x, 4.2, z)
    for i in range(m):
        a0, a1 = i / m * TAU, (i + 1) / m * TAU
        q0 = (x + math.cos(a0) * (r + 0.25), h, z + math.sin(a0) * (r + 0.25))
        q1 = (x + math.cos(a1) * (r + 0.25), h, z + math.sin(a1) * (r + 0.25))
        am = (a0 + a1) / 2
        facing(b, cols[i % 2], [q0, q1, apex], (math.cos(am), 0.9, math.sin(am)))
    lathe(b, P["fgold"], x, z, [(r + 0.26, h - 0.04), (r + 0.26, h + 0.03)], seg=m, caps=False)
    lathe(b, P["fgold"], x, z, [(0.0, 0.0), (0.06, 0.0), (0.12, 0.1), (0.06, 0.2), (0.02, 0.24), (0.02, 0.36), (0.0, 0.36)], seg=8, y0=4.12)
    cres = []
    for k in range(9):                       # a crescent moon, flat, facing west
        t = math.pi * (0.15 + 0.7 * k / 8)
        cres.append((x, 4.66 + math.cos(t) * 0.2, z + math.sin(t) * 0.2))
    for k in range(8, -1, -1):
        t = math.pi * (0.15 + 0.7 * k / 8)
        cres.append((x, 4.66 + math.cos(t) * 0.14, z + math.sin(t) * 0.1 + 0.04))
    for k in range(8):
        facing(b, P["fgold"], [cres[k], cres[k + 1], cres[17 - k - 1], cres[17 - k]], (-1.0, 0.0, 0.0))
    # the sign board over the door, stood clear of the roof
    sx = x - r - 0.3
    hbox(b, P["fascia"], sx + 0.02, sx + 0.07, 2.27, 2.77, z - 1.15, z + 1.15)
    for y0 in (2.25, 2.75):
        hbox(b, P["fgold"], sx + 0.01, sx + 0.08, y0, y0 + 0.04, z - 1.17, z + 1.17)
    for s in (-1, 1):
        b.bar(P["fgold"], (sx + 0.06, 2.3, z + s * 0.9), (sx + 0.35, 2.32, z + s * 0.9), 0.03, 0.03)
    # inside: a rug, the table under its cloth, cards and the ball's stand
    lathe(b, P["rug"], x, z, [(0.0, 0.006), (1.9, 0.006)], seg=16, caps=False)
    tx = x + 0.6
    lathe(b, P["cloth"], tx, z, [(0.0, 0.8), (0.5, 0.8), (0.52, 0.76), (0.55, 0.5), (0.6, 0.02), (0.0, 0.02)][::-1], seg=14)
    lathe(b, P["fgold"], tx, z, [(0.6, 0.0), (0.61, 0.08)], seg=14, caps=False)
    lathe(b, P["fgold"], tx, z, [(0.0, 0.8), (0.1, 0.8), (0.07, 0.83), (0.12, 0.86), (0.0, 0.86)], seg=10)
    for k, (dz, ry) in enumerate(((-0.3, 0.2), (-0.18, -0.1), (0.24, 0.35))):
        cx, cz = tx - 0.28, z + dz
        c, s_ = math.cos(ry), math.sin(ry)
        pts = [(cx + c * u - s_ * v, 0.805, cz + s_ * u + c * v) for u, v in ((-0.05, -0.08), (0.05, -0.08), (0.05, 0.08), (-0.05, 0.08))]
        facing(b, P["card"], pts, (0.0, 1.0, 0.0))
    R.end()
    R.face("fair:tent-sign", "fair:tent", (sx, 2.52, z), (-1.0, 0.0, 0.0), 2.2, 0.45)


# ------------------------------------------------------------ the carts

def apple_cart(b, P, R):
    x, z = APPLE_CART
    R.begin(b, "fair:apples")
    hbox(b, P["cart_r"], x - 0.9, x + 0.9, 0.35, 1.0, z - 0.5, z + 0.5)
    for s in (-1, 1):                         # cream panels and gold beads on the sides
        for k in range(3):
            px = x - 0.6 + k * 0.6
            fbox(b, P["cart_c"], px - 0.24, px + 0.24, 0.45, 0.9, z + s * 0.51, z + s * 0.51, "+z" if s > 0 else "-z")
    hbox(b, P["fgold"], x - 0.92, x + 0.92, 0.98, 1.02, z - 0.52, z + 0.52)
    for s in (-1, 1):
        wheel(b, P, (x - 0.4, 0.3, z + s * 0.56), 0.29)
    lathe(b, P["iron"], x + 0.7, z, [(0.0, 0.0), (0.05, 0.0), (0.05, 0.35), (0.0, 0.35)], seg=6)
    for s in (-1, 1):                         # the push handles
        b.bar(P["booth_dk"], (x + 0.9, 0.85, z + s * 0.35), (x + 1.35, 0.95, z + s * 0.35), 0.04, 0.04)
    b.cyl(P["booth_dk"], 0.025, (x + 1.35, 0.95, z - 0.38), (x + 1.35, 0.95, z + 0.38), seg=6)
    # the apples, on sticks, in two rows
    for i in range(12):
        ax, az = x - 0.7 + (i % 6) * 0.28, z - 0.2 + (i // 6) * 0.4
        lathe(b, P["apple"], ax, az, [(0.0, 0.0), (0.06, 0.005), (0.09, 0.07), (0.07, 0.14), (0.0, 0.15)], seg=6, y0=1.02)
        b.cyl(P["booth"], 0.008, (ax, 1.16, az), (ax, 1.3, az), seg=3, caps=False)
    # the canopy on four posts: a peaked, striped roof with a scalloped hem
    for dx, dz in ((-0.85, -0.45), (0.85, -0.45), (-0.85, 0.45), (0.85, 0.45)):
        b.cyl(P["fgold"], 0.02, (x + dx, 1.0, z + dz), (x + dx, 2.2, z + dz), seg=5)
    k_n = 8
    for k in range(k_n):
        xa, xb = x - 1.05 + k * 2.1 / k_n, x - 1.05 + (k + 1) * 2.1 / k_n
        m_ = P["str_r"] if k % 2 else P["str_c"]
        for s in (-1, 1):
            facing(b, m_, [(xa, 2.2, z + s * 0.65), (xb, 2.2, z + s * 0.65), (xb, 2.45, z), (xa, 2.45, z)], (0.0, 1.0, s * 0.8))
    for s in (-1, 1):
        pts = [(x - 1.05 + k * 2.1 / k_n, 2.2, z + s * 0.65) for k in range(k_n + 1)]
        scallops(b, (P["str_r"], P["str_c"]), pts, 0.14, lambda p, s=s: (0.0, 0.0, float(s)))
    R.end()


def popcorn_cart(b, P, R):
    x, z = POPCORN
    R.begin(b, "fair:popcorn")
    hbox(b, P["cart_r"], x - 0.4, x + 0.4, 0.32, 0.95, z - 0.28, z + 0.28)
    fbox(b, P["cart_c"], x - 0.41, x - 0.41, 0.42, 0.85, z - 0.2, z + 0.2, "-x")
    hbox(b, P["fgold"], x - 0.42, x + 0.42, 0.93, 0.97, z - 0.3, z + 0.3)
    for s in (-1, 1):
        wheel(b, P, (x + 0.1, 0.3, z + s * 0.36), 0.28)
    lathe(b, P["iron"], x - 0.3, z, [(0.0, 0.0), (0.04, 0.0), (0.04, 0.32), (0.0, 0.32)], seg=6)
    # the case: gold corner posts, the lit popcorn piled in it, the kettle
    for dx in (-0.38, 0.38):
        for dz in (-0.26, 0.26):
            b.cyl(P["fgold"], 0.02, (x + dx, 0.97, z + dz), (x + dx, 1.7, z + dz), seg=5)
    hbox(b, P["fgold"], x - 0.4, x + 0.4, 0.97, 1.0, z - 0.28, z + 0.28)
    rnd = random.Random(52)
    lathe(b, P["pop"], x, z, [(0.34, 1.0), (0.3, 1.12), (0.16, 1.2), (0.0, 1.22)], seg=8, caps=False)
    for k in range(6):                        # a few popped kernels heaped on it
        b.lump(P["pop"], 0.1, 0.07, 0.1, x + rnd.uniform(-0.22, 0.22), 1.1 + rnd.uniform(0.0, 0.06), z + rnd.uniform(-0.14, 0.14),
               seed=k, rnd=0.8, jitter=0.02, n=1)
    lathe(b, P["kettle"], x, z, [(0.0, 1.38), (0.12, 1.38), (0.16, 1.46), (0.14, 1.54), (0.0, 1.56)], seg=10)
    b.cyl(P["kettle"], 0.012, (x, 1.56, z), (x, 1.7, z), seg=4)
    # the roof: red, gold edged, a turned finial
    for s in (-1, 1):
        facing(b, P["cart_r"], [(x - 0.46, 1.7, z + s * 0.34), (x + 0.46, 1.7, z + s * 0.34), (x + 0.46, 1.9, z), (x - 0.46, 1.9, z)], (0.0, 1.0, s * 0.8))
        hbox(b, P["fgold"], x - 0.47, x + 0.47, 1.68, 1.71, z + s * 0.34 - 0.02, z + s * 0.34 + 0.02)
    for sx in (-1, 1):
        facing(b, P["cart_c"], [(x + sx * 0.46, 1.7, z - 0.34), (x + sx * 0.46, 1.7, z + 0.34), (x + sx * 0.46, 1.9, z)], (float(sx), 0.0, 0.0))
    lathe(b, P["fgold"], x, z, [(0.0, 0.0), (0.04, 0.0), (0.07, 0.07), (0.03, 0.14), (0.0, 0.2)], seg=8, y0=1.9)
    R.end()


def poles(b, P, R):
    for i, (x, z) in enumerate(POLES):
        R.begin(b, f"fair:pole-{i}")
        lathe(b, P["pole"], x, z, [(0.11, 0.0), (0.11, 0.2), (0.07, 0.26), (0.06, 3.9), (0.08, 4.0), (0.0, 4.16)], seg=6)
        b.bar(P["pole"], (x - 0.32, 3.8, z), (x + 0.32, 3.8, z), 0.07, 0.07)
        for s in (-1, 1):
            b.bar(P["pole"], (x, 3.5, z), (x + s * 0.24, 3.78, z), 0.04, 0.04)
            lathe(b, P["glass_c"], x + s * 0.28, z, [(0.0, 0.0), (0.03, 0.02), (0.0, 0.07)], seg=4, y0=3.84)
        lathe(b, P["fgold"], x, z, [(0.0, 0.0), (0.07, 0.05), (0.0, 0.14)], seg=6, y0=4.14)
        R.end()


def build_fair(P, R):
    """The old midway (phase 4): see the module's notes."""
    b = HGBuilder()
    rnd = random.Random(440)
    arch(b, P, R)
    for z0, z1, kind in BOOTHS:
        R.begin(b, f"fair:booth-{kind}")
        booth(b, P, z0, z1, kind, rnd)
        R.end()
        R.face(f"fair:booth-sign-{kind}", f"fair:booth-{kind}", (45.69, 3.1, (z0 + z1) / 2), (-1.0, 0.0, 0.0), z1 - z0 - 0.8, 0.6)
    ticket_booth(b, P, R)
    striker(b, P, R)
    tent(b, P, R)
    apple_cart(b, P, R)
    popcorn_cart(b, P, R)
    poles(b, P, R)
    b.finish("hg-fair.glb")


# ------------------------------------------------------------------ the carousel
# (moved from build_grinmoor.blender.py in phase 4: the horse remodelled from
# lofted sections, the poles' collars cut back to pay for it)

CAROUSEL = (44.5, -4.0, 4.5)          # x, z, deck radius: hollowgrin.js CAROUSEL


def carousel_palette():
    return {
        "cream": mat("GF_Cream", 0xeee2c8, 0.7),
        "red": mat("GF_Red", 0xb8242c, 0.7),
        "cgold": mat("GF_Gold", 0xd8b050, 0.3, 0.45),
        "brass2": mat("HG_Brass", 0xc8a050, 0.35, 0.4),
        "mirror": mat("GF_Mirror", 0x9ab8d0, 0.15, 0.0, 0x4a6a8a, 0.6),
        "deck": mat("HG_CarouselDeck", 0x8a5a36, 0.8),        # no wood texture: the disc has no UVs for it
        "white": mat("GF_White", 0xf0ece4, 0.6),
        "pumpkin": mat("GF_Pumpkin", 0xe07423, 0.55),
    }


def turn(b, m, cx, cz, prof, seg=24, y0=0.0, a0=0.0, a1=TAU, rmod=None):
    """build_grinmoor's lathe: a profile [(r, y)] revolved about the vertical
    through cx, cz, over the arc a0..a1 (a canopy's stripe); `rmod(theta)`
    scales the radius (flutes, ribs)."""
    full = abs(a1 - a0 - TAU) < 1e-6
    n = seg if full else seg + 1
    pts, idx = [], []
    for r, y in prof:
        if r < 1e-6:
            pts.append((cx, y0 + y, cz))
            idx.append([len(pts) - 1] * n)
            continue
        row = []
        for i in range(n):
            t = a0 + (a1 - a0) * i / seg
            k = rmod(t) if rmod else 1.0
            pts.append((cx + math.cos(t) * r * k, y0 + y, cz + math.sin(t) * r * k))
            row.append(len(pts) - 1)
        idx.append(row)
    faces = []
    for p in range(len(prof) - 1):
        A, B = idx[p], idx[p + 1]
        for i in range(seg):
            j = (i + 1) % n if full else i + 1
            f = []
            for v in (A[i], A[j], B[j], B[i]):
                if v not in f:
                    f.append(v)
            if len(f) >= 3:
                faces.append(f)
    out = b.poly(m, pts, faces)
    # a closed profile (a deck, a drum, a rim) is a solid: turn it outward
    if prof[0] == prof[-1] or (prof[0][0] < 1e-6 and prof[-1][0] < 1e-6):
        import bmesh
        bmesh.ops.recalc_face_normals(b.bm, faces=out)
    for f in out:
        f.smooth = True
    return out


def loft(b, m, pts, radii, seg=8, flat=1.0, caps=True):
    """A smooth limb or body through pts: at each point a ring of radius r
    (squashed across the flank, +z, by `flat`), square to the path."""
    import bmesh
    rings = []
    for i, p in enumerate(pts):
        a, c = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        t = [c[k] - a[k] for k in range(3)]
        L = math.sqrt(sum(v * v for v in t)) or 1.0
        t = [v / L for v in t]
        side = (0.0, 0.0, 1.0)
        u = [t[1] * side[2] - t[2] * side[1], t[2] * side[0] - t[0] * side[2], t[0] * side[1] - t[1] * side[0]]
        Lu = math.sqrt(sum(v * v for v in u)) or 1.0
        u = [v / Lu for v in u]
        w = [u[1] * t[2] - u[2] * t[1], u[2] * t[0] - u[0] * t[2], u[0] * t[1] - u[1] * t[0]]
        r = radii[i]
        rings.append([tuple(p[k] + r * (math.cos(TAU * j / seg) * u[k] + flat * math.sin(TAU * j / seg) * w[k]) for k in range(3))
                      for j in range(seg)])
    vs = [v for rr in rings for v in rr]
    faces = []
    for i in range(len(rings) - 1):
        for j in range(seg):
            j2 = (j + 1) % seg
            faces.append([i * seg + j, i * seg + j2, (i + 1) * seg + j2, (i + 1) * seg + j])
    if caps:
        faces.append(list(range(seg))[::-1])
        faces.append([(len(rings) - 1) * seg + j for j in range(seg)])
    out = b.poly(m, vs, faces)
    bmesh.ops.recalc_face_normals(b.bm, faces=out)
    for f in out:
        f.smooth = True
    return out


def build_carousel(P, R):
    """The still parts: the drum, the canopy, the rounding boards, the step."""
    P = {**P, **carousel_palette()}
    b = HGBuilder()
    cx, cz, r = CAROUSEL
    R.begin(b, "fair:carousel")
    D = 0.8
    turn(b, P["cream"], cx, cz, [(0, 0.3), (D + 0.06, 0.3), (D + 0.06, 0.5), (D, 0.5), (D, 3.85), (D + 0.1, 3.85), (D + 0.1, 4.05), (0, 4.05)], seg=12)
    for i in range(12):
        t = (i + 0.5) / 12 * TAU
        px, pz = cx + math.cos(t) * (D + 0.01), cz + math.sin(t) * (D + 0.01)
        w = 2 * D * math.sin(math.pi / 12) * 0.78
        b.box(P["mirror"] if i % 2 else P["red"], 0.02, 1.7, w, px, 1.3, pz, ry=-t)
        for yy in (1.27, 3.0):
            b.box(P["cgold"], 0.03, 0.06, w + 0.08, px, yy, pz, ry=-t)
        if i in (2, 3, 4):              # the band organ's pipes on the south face
            for k in range(5):
                off = (k - 2) * w / 5
                qx, qz = px + math.sin(t) * off + math.cos(t) * 0.04, pz - math.cos(t) * off + math.sin(t) * 0.04
                b.cyl(P["brass2"], 0.035, (qx, 3.1, qz), (qx, 3.4 + 0.3 * (1 - abs(k - 2) / 2), qz), seg=6)
    seg = 24
    rr = r + 0.6
    for i in range(seg):                # the canopy: stripes in red and cream
        a0, a1 = TAU * i / seg, TAU * (i + 1) / seg
        m = P["red"] if i % 2 else P["cream"]
        turn(b, m, cx, cz, [(rr, 4.6), (rr * 0.55, 5.4), (0.0, 6.35)], seg=2, a0=a0, a1=a1)
        turn(b, m, cx, cz, [(rr * 0.98, 4.58), (rr * 0.53, 5.36), (0.0, 6.3)][::-1], seg=2, a0=a0, a1=a1)
    turn(b, P["cream"], cx, cz, [(rr + 0.02, 3.95), (rr + 0.02, 4.62), (rr - 0.06, 4.62), (rr - 0.06, 3.95), (rr + 0.02, 3.95)], seg=48)
    for i in range(16):                 # the rounding boards' mirrors
        t = (i + 0.5) / 16 * TAU
        px, pz = cx + math.cos(t) * (rr + 0.04), cz + math.sin(t) * (rr + 0.04)
        b.box(P["mirror"], 0.02, 0.36, 0.5, px, 4.1, pz, ry=-t)
        b.box(P["cgold"], 0.025, 0.44, 0.06, px + math.sin(t) * 0.29, 4.06, pz - math.cos(t) * 0.29, ry=-t)
    pts = [(cx + math.cos(i / 48 * TAU) * (rr + 0.03), 3.95, cz + math.sin(i / 48 * TAU) * (rr + 0.03)) for i in range(49)]
    scallops(b, (P["red"], P["cgold"]), pts, 0.2, lambda p: (p[0] - cx, 0.0, p[2] - cz))
    turn(b, P["cgold"], cx, cz, [(rr + 0.04, 4.62), (rr + 0.12, 4.66), (rr + 0.04, 4.7), (rr - 0.1, 4.66), (rr + 0.04, 4.62)], seg=48)
    for i in range(16):                 # the sweeps under the canopy
        t = i / 16 * TAU
        b.bar(P["cream"], (cx + math.cos(t) * D, 4.0, cz + math.sin(t) * D), (cx + math.cos(t) * rr, 4.25, cz + math.sin(t) * rr), 0.08, 0.16)
    b.cyl(P["cgold"], 0.18, (cx, 6.25, cz), (cx, 6.55, cz), seg=10, r2=0.1)
    b.cyl(P["cgold"], 0.035, (cx, 6.55, cz), (cx, 7.35, cz), seg=6)
    turn(b, P["cgold"], cx, cz, [(0, 6.6), (0.13, 6.7), (0.0, 6.85)], seg=10)
    for s in (1, -1):
        facing(b, P["orange"], [(cx, 7.32, cz), (cx, 7.05, cz), (cx + 0.6, 7.2, cz + 0.05)], (0.0, 0.0, float(s)))
    turn(b, P["granite_dk"], cx, cz, [(r + 0.02, 0.0), (r + 0.35, 0.0), (r + 0.35, 0.12), (r + 0.02, 0.12), (r + 0.02, 0.0)], seg=40)
    R.end()
    b.finish("hg-carousel.glb")


def build_ride(P, R):
    """The turning part, about the carousel's centre (origin)."""
    from hg_kit import pumpkin
    P = {**P, **carousel_palette()}
    b = HGBuilder()
    r = CAROUSEL[2]
    turn(b, P["deck"], 0, 0, [(0, 0.3), (r, 0.3), (r, 0.04), (0, 0.04)], seg=40)
    turn(b, P["cgold"], 0, 0, [(r - 0.04, 0.04), (r + 0.03, 0.04), (r + 0.03, 0.3), (r - 0.04, 0.3), (r - 0.04, 0.04)], seg=40)
    for i in range(8):                  # the horses' brass poles, collared
        t = i / 8 * TAU
        x, z = math.cos(t) * 3.3, math.sin(t) * 3.3
        b.cyl(P["brass2"], 0.04, (x, 0.3, z), (x, 3.95, z), seg=8)
        for yy in (0.3, 0.9, 2.3, 3.87):
            b.cyl(P["cgold"], 0.07, (x, yy, z), (x, yy + 0.08, z), seg=8)
    for i in range(8):
        t = (i + 0.5) / 8 * TAU
        b.cyl(P["brass2"], 0.03, (math.cos(t) * 2.0, 0.3, math.sin(t) * 2.0), (math.cos(t) * 2.0, 3.95, math.sin(t) * 2.0), seg=6)
    for i in range(4):                  # four pumpkin coaches
        t = (i + 0.5) / 4 * TAU
        x, z = math.cos(t) * 1.9, math.sin(t) * 1.9
        ox, oz = math.cos(t), math.sin(t)
        pumpkin(b, P["pumpkin"], P["stem"], x, 0.3, z, 0.62, ribs=10, squash=0.82, seed=i)
        b.box(P["black"], 0.04, 0.5, 0.42, x + ox * 0.6, 0.6, z + oz * 0.6, ry=-t)
        for s in (-1, 1):
            b.box(P["cgold"], 0.05, 0.56, 0.05, x + ox * 0.6 - s * oz * 0.24, 0.57, z + oz * 0.6 + s * ox * 0.24, ry=-t)
            wx, wz = x - oz * 0.45 * s, z + ox * 0.45 * s
            b.cyl(P["cgold"], 0.2, (wx - ox * 0.05, 0.52, wz - oz * 0.05), (wx + ox * 0.05, 0.52, wz + oz * 0.05), seg=12)
    b.finish("hg-carousel-ride.glb")


def build_horse(P, R):
    """One carved carousel horse, nose +x, its body's centre at the origin:
    a lofted barrel, an arched neck, a head with a muzzle, legs mid-gallop."""
    P = {**P, **carousel_palette()}
    b = HGBuilder()
    W, S, G, K = P["white"], P["red"], P["cgold"], P["black"]
    # the barrel, from the rump to the chest
    xs = [-0.58, -0.52, -0.4, -0.2, 0.05, 0.28, 0.42, 0.5, 0.55]
    rs = [0.04, 0.14, 0.2, 0.21, 0.2, 0.21, 0.2, 0.15, 0.05]
    ys = [-0.16, -0.18, -0.2, -0.24, -0.25, -0.23, -0.2, -0.18, -0.17]
    loft(b, W, [(x, y, 0.0) for x, y in zip(xs, ys)], rs, seg=10, flat=0.72)
    # the neck, arched, up to the poll
    neck = [(0.36, -0.12, 0.0), (0.46, 0.05, 0.0), (0.54, 0.22, 0.0), (0.6, 0.38, 0.0), (0.64, 0.5, 0.0)]
    loft(b, W, neck, [0.15, 0.13, 0.11, 0.095, 0.085], seg=8, flat=0.62)
    # the head: forehead to muzzle, tucked, with a jaw
    head = [(0.6, 0.55, 0.0), (0.68, 0.53, 0.0), (0.78, 0.47, 0.0), (0.88, 0.4, 0.0), (0.94, 0.36, 0.0), (0.97, 0.34, 0.0)]
    loft(b, W, head, [0.06, 0.085, 0.08, 0.065, 0.058, 0.03], seg=8, flat=0.72)
    loft(b, W, [(0.64, 0.46, 0.0), (0.72, 0.42, 0.0), (0.8, 0.39, 0.0)], [0.05, 0.07, 0.04], seg=6, flat=0.8)
    for s in (-1, 1):
        b.cyl(W, 0.028, (0.63, 0.6, 0.035 * s), (0.6, 0.72, 0.045 * s), seg=4, r2=0.0)                  # ears
        b.box(K, 0.045, 0.035, 0.01, 0.75, 0.5, 0.058 * s)                                                # eyes
        b.box(K, 0.02, 0.02, 0.01, 0.955, 0.36, 0.026 * s)                                               # nostrils
        b.bar(G, (0.66, 0.53, 0.05 * s), (0.93, 0.39, 0.035 * s), 0.014)                                  # bridle
    b.bar(G, (0.78, 0.47, 0.0), (0.78, 0.38, 0.0), 0.012)
    # the mane: gold locks flicking off the crest of the neck
    for k in range(7):
        t = k / 6
        p = (0.4 + t * 0.22, 0.02 + t * 0.5, 0.0)
        q = (p[0] - 0.13, p[1] - 0.02 + 0.03 * math.sin(k * 1.7), 0.05 * (1 if k % 2 else -1))
        facing(b, G, [(p[0] - 0.04, p[1] + 0.03, 0.0), (p[0] + 0.05, p[1] + 0.06, 0.0), q], (0.0, 0.0, 1.0 if k % 2 else -1.0))
    # the tail, flowing
    loft(b, G, [(-0.55, -0.12, 0.0), (-0.68, -0.15, 0.0), (-0.76, -0.3, 0.0), (-0.78, -0.48, 0.0), (-0.74, -0.6, 0.0)], [0.04, 0.07, 0.08, 0.06, 0.015], seg=6, flat=0.6)
    # saddle and blanket, the stirrups hanging
    turn(b, S, 0.02, 0.0, [(0.0, 0.0), (0.2, 0.0), (0.2, 0.03), (0.0, 0.05)], seg=10)
    for s in (-1, 1):
        b.box(S, 0.36, 0.24, 0.02, 0.0, -0.24, 0.155 * s)
        b.box(G, 0.38, 0.03, 0.025, 0.0, -0.25, 0.157 * s)
        b.cyl(G, 0.008, (0.0, -0.02, 0.17 * s), (0.02, -0.4, 0.18 * s), seg=3, caps=False)
        b.box(G, 0.08, 0.02, 0.04, 0.02, -0.42, 0.18 * s)
    b.lump(G, 0.12, 0.08, 0.1, -0.12, 0.0, 0.0, seed=21, rnd=0.6, jitter=0.0, n=2)                   # the cantle
    b.box(G, 0.04, 0.12, 0.05, 0.14, 0.02, 0.0)                                                      # the horn
    # legs mid-gallop: the front pair curled up, the back pair reaching
    for lz, k in ((0.09, 0), (-0.09, 1)):
        top, knee = (0.38, -0.32, lz), (0.58, -0.44 + 0.06 * k, lz)
        hoof = (knee[0] - 0.05, knee[1] - 0.24, lz)
        loft(b, W, [top, knee, hoof], [0.06, 0.045, 0.035], seg=6)
        b.cyl(G, 0.04, hoof, (hoof[0] - 0.02, hoof[1] - 0.05, lz), seg=6)
    for lz, k in ((0.09, 0), (-0.09, 1)):
        hip, hock = (-0.38, -0.3, lz), (-0.6 - 0.04 * k, -0.47, lz)
        hoof = (-0.75 - 0.04 * k, -0.62, lz)
        loft(b, W, [hip, (-0.48, -0.42, lz), hock, hoof], [0.075, 0.055, 0.04, 0.034], seg=6)
        b.cyl(G, 0.04, hoof, (hoof[0] - 0.05, hoof[1] - 0.02, lz), seg=6)
    b.finish("hg-horse.glb")
