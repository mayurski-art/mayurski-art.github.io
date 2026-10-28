"""
Hollowgrin's Trick-or-Treat Lane (phase 3): hg-lane.glb, in map
coordinates. Along the six houses' fronts: the porches (deck boards, steps,
turned posts, railings, the porch roof), the front doors, the picket fences
with their gates swung open, a mailbox at every gate, two bikes against the
fences, a candy bowl and pumpkins on every porch, foam tombstones in two
yards, fake webs in the porch corners; the Troll House's porch pumpkins;
the Meme Gallery's two plinths (the bust and Pepe on them are their own
GLBs).

hollowgrin.js keeps the houses' walls, roofs, windows and their glow, the
Troll House, the carved jack-o'-lanterns, the ghosts and the roof spider,
the lamps, the words, and every collider (LANE_PROPS for the mailboxes and
the bikes). The map is near its 16 MB cap: faces only where they show.
"""
import math
import random

from map_kit import mat
from hg_kit import HGBuilder, fbox, headstone_profile, lathe, pumpkin, slab
from hg_village import palette as village_palette

HOUSES = [(-49.5, -42.5), (-31.0, -24.0), (-19.5, -12.5), (12.5, 19.5), (24.0, 31.0), (39.0, 46.0)]   # hollowgrin.js
ZF = 39.8                      # the houses' fronts
FENCE_Z = 36.95
GALLERY = [(-3.3, 38.3), (3.3, 38.3)]
BANNERS = [(-3.4 - 1.25, -3.4 + 1.25), (3.4 - 1.25, 3.4 + 1.25)]   # the JS's banners on the gallery fence: keep posts off them
TROLL_DOOR_Z = 39.6
MAILBOX_DX = 1.05              # hollowgrin.js LANE_PROPS: mailboxes at (mid + 1.05, 36.5)
MAILBOX_Z = 36.5
BIKES = [0, 3]                 # houses with a bike against the fence: (mid - 2.6, 37.25)


def palette():
    return {
        **village_palette(),
        "deck": mat("HG_PorchDeck", 0x5e5852, 0.85),
        "deck2": mat("HG_PorchDeck2", 0x524c47, 0.85),
        "post": mat("HG_PorchPost", 0xc8c0b0, 0.75),
        "proof": mat("HG_PorchRoof", 0x34323a, 0.8),
        "picket": mat("HG_Picket", 0xd8d2c4, 0.8),
        "picket_dk": mat("HG_PicketDark", 0xa8a294, 0.85),
        "door0": mat("HG_DoorOxblood", 0x5a1e1e, 0.6),
        "door1": mat("HG_DoorGreen", 0x1e3a2a, 0.6),
        "door2": mat("HG_DoorBlack", 0x18181c, 0.6),
        "mail": mat("HG_MailboxBlack", 0x1c1c22, 0.5, 0.3),
        "flag": mat("HG_MailFlag", 0xc02a22, 0.5),
        "bike_r": mat("HG_BikeRed", 0xb8262a, 0.4, 0.4),
        "bike_b": mat("HG_BikeBlue", 0x2a4ab0, 0.4, 0.4),
        "tyre": mat("HG_Tyre", 0x141416, 0.9),
        "chrome": mat("HG_Chrome", 0xb8bcc4, 0.25, 0.8),
        "bowl": mat("HG_CandyBowl", 0xe8701e, 0.4),
        "foam": mat("HG_FoamStone", 0x8a8a90, 0.95),
        "marble": mat("HG_PlinthMarble", 0x121216, 0.3, 0.1),
        "gold": mat("HG_PlinthGold", 0xc8a050, 0.35, 0.6),
        "candy1": mat("HG_Candy1", 0xff4a7a, 0.4),
        "candy2": mat("HG_Candy2", 0xffd23a, 0.4),
        "candy3": mat("HG_Candy3", 0x5ad0ff, 0.4),
    }


def picket(b, m, x, z, h=0.88, w=0.08, ang=0.0, y=0.0):
    """One picket: a flat board with a pointed top, in the vertical plane
    through x, z along the direction ang (0 = along x)."""
    c, s = math.cos(ang), math.sin(ang)
    pts = [(-w / 2, 0.0), (w / 2, 0.0), (w / 2, h - 0.08), (0.0, h), (-w / 2, h - 0.08)]
    b.poly(m, [(x + u * c, y + v, z + u * s) for u, v in pts], [[0, 1, 2, 3, 4]])


def fence_run(b, P, a, e, posts=None):
    """Pickets from a to e along FENCE_Z, two rails behind them, posts."""
    x = a + 0.08
    while x < e - 0.04:
        picket(b, P["picket"], x, FENCE_Z)
        x += 0.17
    for y in (0.3, 0.68):
        b.box(P["picket_dk"], e - a, 0.07, 0.03, (a + e) / 2, y, FENCE_Z + 0.035)
    for px in posts if posts is not None else (a, e):
        b.box(P["picket"], 0.09, 1.0, 0.09, px, 0.0, FENCE_Z + 0.02)
        b.box(P["picket"], 0.13, 0.04, 0.13, px, 1.0, FENCE_Z + 0.02)


def gate(b, P, mid, half, ang=2.3):
    """The gate posts either side of the path and the gate swung in on its
    west hinge, all the way into the yard clear of the path."""
    for s in (-1, 1):
        x = mid + s * half
        b.box(P["picket"], 0.11, 1.08, 0.11, x, 0.0, FENCE_Z + 0.02)
        lathe(b, P["picket"], x, FENCE_Z + 0.02, [(0.055, 1.08), (0.075, 1.13), (0.002, 1.2)], seg=6)
    hx, hz = mid - half + 0.08, FENCE_Z + 0.02
    c, s = math.cos(ang), math.sin(ang)
    L = 2 * half - 0.2
    k = 0.08
    while k < L:
        picket(b, P["picket"], hx + c * k, hz + s * k, h=0.84, ang=ang, y=0.04)
        k += 0.17
    for y in (0.3, 0.66):
        b.bar(P["picket_dk"], (hx, y, hz + 0.03), (hx + c * L, y, hz + s * L + 0.03), 0.06, 0.06)
    b.bar(P["picket_dk"], (hx + c * 0.05, 0.33, hz + s * 0.05 + 0.03), (hx + c * (L - 0.05), 0.63, hz + s * (L - 0.05) + 0.03), 0.05, 0.05)


def porch(b, P, mid, i, rnd):
    """Deck, steps, posts, railings, roof and the front door of house i."""
    x0, x1 = mid - 2.1, mid + 2.1
    za, zb = 38.4, ZF
    # deck: boards running out from the house, the fascia round it
    n = 14
    for k in range(n):
        u0, u1 = x0 + (x1 - x0) * k / n + 0.008, x0 + (x1 - x0) * (k + 1) / n - 0.008
        fbox(b, P["deck" if k % 2 else "deck2"], u0, u1, 0.29, 0.3, za, zb, "+y")
    fbox(b, P["wood_dk"], x0, x1, 0.0, 0.3, za, zb, "-z -x +x")
    # the steps up to it, the middle of the front
    for k, (z0, y) in enumerate(((38.15, 0.2), (37.9, 0.1))):
        fbox(b, P["deck2"], mid - 0.7, mid + 0.7, 0.0, y, z0, z0 + 0.25, "+y -z -x +x")
    # the turned posts
    for s in (-1, 1):
        x = mid + s * 1.95
        fbox(b, P["post"], x - 0.08, x + 0.08, 0.3, 0.55, 38.47, 38.63, "-z +z -x +x")
        lathe(b, P["post"], x, 38.55, [(0.05, 0.55), (0.065, 0.62), (0.045, 0.7), (0.045, 2.2), (0.065, 2.3), (0.05, 2.4), (0.07, 2.58)],
              seg=5, caps=False)
    # railings: the front either side of the steps, the sides back to the house
    for s in (-1, 1):
        xa, xe = mid + s * 0.7, mid + s * 1.95
        lo, hi = min(xa, xe), max(xa, xe)
        b.box(P["post"], hi - lo, 0.05, 0.07, (lo + hi) / 2, 1.15, 38.55)
        b.box(P["post"], hi - lo, 0.04, 0.05, (lo + hi) / 2, 0.42, 38.55)
        x = lo + 0.12
        while x < hi - 0.06:
            b.cyl(P["post"], 0.018, (x, 0.46, 38.55), (x, 1.15, 38.55), seg=3, caps=False)
            x += 0.15
        xs = mid + s * 1.95
        b.box(P["post"], 0.07, 0.05, ZF - 38.6, xs, 1.15, (38.6 + ZF) / 2)
        z = 38.75
        while z < ZF - 0.08:
            b.cyl(P["post"], 0.018, (xs, 0.3, z), (xs, 1.15, z), seg=3, caps=False)
            z += 0.15
        lathe(b, P["post"], mid + s * 0.7, 38.55, [(0.045, 0.3), (0.045, 1.2), (0.06, 1.25), (0.002, 1.32)], seg=5, caps=False)
    # the porch roof, sloping off the house, its fascia and the soffit
    ya, yb = 2.5, 2.78
    zr = 38.1
    b.poly(P["proof"], [(x0 - 0.2, ya, zr), (x1 + 0.2, ya, zr), (x1 + 0.2, yb, ZF), (x0 - 0.2, yb, ZF)], [[0, 3, 2, 1]])
    b.poly(P["post"], [(x0 - 0.2, ya - 0.04, zr), (x1 + 0.2, ya - 0.04, zr), (x1 + 0.2, yb - 0.04, ZF), (x0 - 0.2, yb - 0.04, ZF)], [[0, 1, 2, 3]])
    fbox(b, P["post"], x0 - 0.2, x1 + 0.2, ya - 0.16, ya, zr - 0.03, zr, "-z +y -x +x")
    for s in (-1, 1):
        x = x0 - 0.2 if s < 0 else x1 + 0.2
        b.poly(P["post"], [(x, ya - 0.16, zr), (x, ya, zr), (x, yb, ZF), (x, yb - 0.16, ZF)], [[0, 1, 2, 3]])
    # the front door: casing, a panelled slab, the knob
    door = P[f"door{i % 3}"]
    fbox(b, door, mid - 0.55, mid + 0.55, 0.3, 2.5, ZF - 0.03, ZF, "-z")
    for (py0, py1) in ((0.45, 1.3), (1.45, 2.35)):
        for (px0, px1) in ((mid - 0.45, mid - 0.06), (mid + 0.06, mid + 0.45)):
            fbox(b, door, px0, px1, py0, py1, ZF - 0.05, ZF - 0.03, "-z +y")
    for (a0, a1, y0, y1) in ((mid - 0.68, mid - 0.55, 0.3, 2.62), (mid + 0.55, mid + 0.68, 0.3, 2.62), (mid - 0.68, mid + 0.68, 2.5, 2.62)):
        fbox(b, P["post"], a0, a1, y0, y1, ZF - 0.06, ZF, "-z -x +x +y")
    lathe(b, P["brass"], mid + 0.38, ZF - 0.08, [(0.03, 1.3), (0.03, 1.36)], seg=6)


def candy_bowl(b, P, x, y, z, rnd):
    lathe(b, P["bowl"], x, z, [(0.08, 0.0), (0.17, 0.06), (0.22, 0.13), (0.2, 0.13), (0.15, 0.07)], seg=8, y0=y, caps=False)
    for k in range(6):
        a = k * 1.05 + rnd.uniform(0, 0.4)
        r = rnd.uniform(0.03, 0.13)
        fbox(b, P[f"candy{k % 3 + 1}"], x + math.cos(a) * r - 0.035, x + math.cos(a) * r + 0.035, y + 0.1, y + 0.12 + rnd.uniform(0, 0.03), z + math.sin(a) * r - 0.02, z + math.sin(a) * r + 0.02, "+y")


def web(b, m, c, u, v, size, seed):
    """A fake web in a corner: thin flat threads (one quad each)."""
    rnd = random.Random(seed)
    n = 5
    spokes = []
    for i in range(n):
        t = i / (n - 1)
        d = tuple(u[k] * (1 - t) + v[k] * t for k in range(3))
        L = size * (0.8 + rnd.random() * 0.3)
        spokes.append(tuple(c[k] + d[k] * L for k in range(3)))

    def thread(p, q, w=0.008):
        nx, ny, nz = u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]
        dx, dy, dz = q[0] - p[0], q[1] - p[1], q[2] - p[2]
        sx, sy, sz = dy * nz - dz * ny, dz * nx - dx * nz, dx * ny - dy * nx
        L = math.sqrt(sx * sx + sy * sy + sz * sz) or 1.0
        sx, sy, sz = sx / L * w, sy / L * w, sz / L * w
        b.poly(m, [(p[0] - sx, p[1] - sy, p[2] - sz), (p[0] + sx, p[1] + sy, p[2] + sz), (q[0] + sx, q[1] + sy, q[2] + sz), (q[0] - sx, q[1] - sy, q[2] - sz)], [[0, 1, 2, 3]])
    for s in spokes:
        thread(c, s)
    for k in (0.45, 0.88):
        pts = [tuple(c[j] + (s[j] - c[j]) * k for j in range(3)) for s in spokes]
        for a, e in zip(pts, pts[1:]):
            mid = tuple((a[j] + e[j]) / 2 for j in range(3))
            sag = (mid[0] - c[0] * 0.04, mid[1] - 0.02 * k, mid[2])
            thread(a, sag)
            thread(sag, e)


def mailbox(b, P, x, z, i):
    b.box(P["wood_dk"], 0.09, 1.0, 0.09, x, 0.0, z)
    b.box(P["wood_dk"], 0.22, 0.04, 0.5, x, 1.0, z)
    prof = [(x - 0.1, 1.04), (x + 0.1, 1.04), (x + 0.1, 1.15)] + [(x + 0.1 * math.cos(a), 1.15 + 0.1 * math.sin(a)) for a in (0.6, 1.2, 1.94, 2.54)] + [(x - 0.1, 1.15)]
    b.prism(P["mail"] if i % 2 == 0 else P["picket_dk"], prof, z - 0.24, z + 0.24, axis="z")
    up = i % 3 == 0                      # a letter waiting at every third
    if up:
        b.box(P["flag"], 0.02, 0.22, 0.04, x + 0.115, 1.12, z + 0.12)
        b.box(P["flag"], 0.02, 0.07, 0.12, x + 0.115, 1.27, z + 0.16)
    else:
        b.box(P["flag"], 0.02, 0.04, 0.22, x + 0.115, 1.1, z + 0.06)


def bike(b, P, x, z, frame, lean=0.32, ry=0.0):
    """A kid's bike along x, leaning toward -z (the fence) by `lean`."""
    c, s = math.cos(ry), math.sin(ry)
    cl, sl = math.cos(lean), math.sin(lean)

    def at(u, v, w=0.0):                 # u along, v up, w side (+z), then lean and turn
        vv, ww = v * cl, w - v * sl
        return (x + u * c + ww * s, vv, z - u * s + ww * c)
    R = 0.33
    for cu in (-0.5, 0.5):
        pts = [at(cu + R * math.cos(a), R + R * math.sin(a)) for a in [k / 12 * 2 * math.pi for k in range(13)]]
        for p, q in zip(pts, pts[1:]):
            b.cyl(P["tyre"], 0.03, p, q, seg=3, caps=False)
        for a in (0.0, 1.05, 2.1):
            b.cyl(P["chrome"], 0.006, at(cu + R * math.cos(a), R + R * math.sin(a)), at(cu - R * math.cos(a), R - R * math.sin(a)), seg=3, caps=False)
    m = P[frame]
    hub_r, hub_f, crank, seat, head = at(-0.5, R), at(0.5, R), at(-0.05, 0.28), at(-0.16, 0.72), at(0.36, 0.74)
    for p, q in ((hub_r, crank), (crank, seat), (seat, head), (crank, head), (hub_r, seat), (head, hub_f)):
        b.cyl(m, 0.03, p, q, seg=4, caps=False)
    b.cyl(P["chrome"], 0.018, head, at(0.33, 0.95), seg=4, caps=False)
    b.cyl(P["chrome"], 0.014, at(0.33, 0.95, -0.22), at(0.33, 0.95, 0.22), seg=4, caps=False)
    for w in (-0.22, 0.22):
        b.cyl(P["tyre"], 0.022, at(0.33, 0.95, w), at(0.33, 0.95, w * 1.4), seg=4, caps=False)
    b.cyl(P["chrome"], 0.012, seat, at(-0.18, 0.8), seg=4, caps=False)
    b.lump(P["tyre"], 0.24, 0.06, 0.11, *at(-0.19, 0.8), seed=7, rnd=0.3, jitter=0.01, ry=ry, n=2)


def build_lane(P, R):
    """Trick-or-Treat Lane (phase 3): see the module's notes."""
    b = HGBuilder()
    rnd = random.Random(330)
    for i, (xa, xb) in enumerate(HOUSES):
        mid = (xa + xb) / 2
        R.begin(b, f"lane:porch-{i}")
        porch(b, P, mid, i, rnd)
        candy_bowl(b, P, mid + 0.8, 0.3, 38.7, rnd)
        pumpkin(b, P["pk2"], P["stem"], mid - 0.45, 0.2, 38.27, 0.13, ribs=6, ry=i, seed=400 + i)
        pumpkin(b, P["ghost" if i % 2 else "gourd_y"], P["stem"], mid + 0.48, 0.1, 38.02, 0.1, ribs=6, ry=i * 2, seed=410 + i)
        for s in (-1, 1):                # webs low in the porch's back corners, under the windows
            web(b, P["web"], (mid + s * 1.93, 0.31, ZF - 0.02), (0.0, 0.0, -1.0), (0.0, 1.0, 0.0), 0.45, 30 + i * 2 + (s > 0))
        R.end()
        R.begin(b, f"lane:fence-{i}")
        fence_run(b, P, xa - 0.4, mid - 0.6, posts=[xa - 0.4, (xa - 0.4 + mid - 0.6) / 2])
        fence_run(b, P, mid + 0.6, xb + 0.4, posts=[(mid + 0.6 + xb + 0.4) / 2, xb + 0.4])
        R.end()
        R.begin(b, f"lane:gate-{i}", on=f"lane:fence-{i}")
        gate(b, P, mid, 0.6)
        R.end()
        R.begin(b, f"lane:mailbox-{i}")
        mailbox(b, P, mid + MAILBOX_DX, MAILBOX_Z, i)
        R.end()
        if i in BIKES:
            R.begin(b, f"lane:bike-{i}", on=f"lane:fence-{i}")
            bike(b, P, mid - 2.6, 37.25, "bike_r" if i == 0 else "bike_b")
            R.end()
        if i % 3 == 1:                   # foam tombstones (the JS's old spots, out of the steps' way)
            for k, (dx, dz, kind) in enumerate(((-2.4, 37.5, 0), (-1.8, 37.62, 6), (2.1, 37.48, 1))):
                R.begin(b, f"lane:tomb-{i}-{k}")
                slab(b, P["foam"], headstone_profile(0.55, 1.0, kind), 0.09, mid + dx, 0.0, dz,
                     ry=math.pi + rnd.uniform(-0.2, 0.2), rz=rnd.uniform(-0.1, 0.1))
                R.end()
    # the Troll House: pumpkins either side of the step
    R.begin(b, "lane:troll-pumpkins")
    for k, (x, r, y) in enumerate(((-1.2, 0.3, 0.0), (-1.25, 0.18, 0.43), (1.2, 0.26, 0.0), (1.55, 0.17, 0.0))):
        pumpkin(b, P["pk1" if k % 2 else "pk3"], P["stem"], x, y, TROLL_DOOR_Z - 0.35, r, ribs=7, ry=k * 1.3, seed=420 + k)
    R.end()
    # the Meme Gallery: its fence and gate, the two plinths
    R.begin(b, "lane:gallery-fence")
    for a, e in ((-6.4, -0.7), (0.7, 6.4)):
        inner = [p for p in (a, e, (a + e) / 2) if not any(lo - 0.1 < p < hi + 0.1 for lo, hi in BANNERS)]
        fence_run(b, P, a, e, posts=inner)
    R.end()
    R.begin(b, "lane:gallery-gate", on="lane:gallery-fence")
    gate(b, P, 0.0, 0.7)
    R.end()
    for k, (x, z) in enumerate(GALLERY):
        R.begin(b, f"lane:plinth-{k}")
        # the front (-z) stays flush: the JS's MEME GALLERY plate hangs on it
        fbox(b, P["marble"], x - 0.6, x + 0.6, 0.0, 0.12, z - 0.45, z + 0.5, "+y -x +x +z")
        fbox(b, P["marble"], x - 0.55, x + 0.55, 0.0, 0.88, z - 0.45, z + 0.45, "-z -x +x +z")
        fbox(b, P["gold"], x - 0.555, x + 0.555, 0.84, 0.88, z - 0.452, z + 0.455, "-z -x +x +z")
        fbox(b, P["marble"], x - 0.58, x + 0.58, 0.88, 1.0, z - 0.45, z + 0.48, "+y -z -x +x +z")
        R.end()
    # the porch ghosts are hg-ghost, placed and swayed by the JS: their room
    for i in GHOST_HOUSES:
        mid = (HOUSES[i][0] + HOUSES[i][1]) / 2
        for s in (-1, 1):
            x = mid + s * GHOST_DX
            R.prop(f"lane:ghost-{i}-{'wE'[s > 0]}", (x - 0.42, GHOST_Y - 1.25, GHOST_Z - 0.42), (x + 0.42, GHOST_Y, GHOST_Z + 0.42), on=f"lane:porch-{i}")
    b.finish("hg-lane.glb")


# ------------------------------------------------------------------ the ghost

GHOST_HOUSES = [0, 3]          # hollowgrin.js: the houses with ghosts on the porch (i % 3 == 0)
GHOST_DX, GHOST_Y, GHOST_Z = 1.1, 2.53, 38.6   # each hangs from the porch roof at (mid +- dx, y, z)
# the sheet's profile, top to hem: (t down its length, radius)
GHOST_PROFILE = [(0.0, 0.0), (0.035, 0.09), (0.08, 0.145), (0.14, 0.168), (0.2, 0.162), (0.26, 0.14), (0.31, 0.15),
                 (0.38, 0.215), (0.46, 0.25), (0.55, 0.27), (0.66, 0.29), (0.78, 0.315), (0.9, 0.34), (1.0, 0.36)]


def build_ghost(P, R):
    """A sheet ghost in its own frame: hung from the origin on a thread, a
    sheet thrown over a head and two arms held out a little, falling in
    folds that deepen toward a torn hem; two dark eye holes and an O of a
    mouth facing -z. Faintly lit from within. hollowgrin.js hangs one under
    each ghost porch's roof and sways it."""
    b = HGBuilder()
    sheet = mat("HG_GhostSheet", 0xe4e4ec, 0.85, 0.0, 0x9aa6c8, 0.35)
    dark = mat("HG_GhostEye", 0x07070a, 0.9)
    thread = mat("HG_GhostThread", 0x2a2a30, 0.9)
    L, top = 1.1, -0.1
    seg = 24
    rnd = random.Random(66)
    jag = [rnd.uniform(0.0, 1.0) for _ in range(seg)]

    def radius(t, th):
        r = next(r0 + (r1 - r0) * (t - t0) / (t1 - t0) for (t0, r0), (t1, r1) in zip(GHOST_PROFILE, GHOST_PROFILE[1:]) if t0 <= t <= t1)
        fold = max(0.0, (t - 0.3) / 0.7)
        # the arms: the sheet pushed out at the sides, a little forward
        arm = math.exp(-((t - 0.44) / 0.1) ** 2) * 0.32
        side = max(math.exp(-((th - 0.0 + 0.25) / 0.38) ** 2), math.exp(-((th - math.pi - 0.25) / 0.38) ** 2),
                   math.exp(-((th - 2 * math.pi + 0.25) / 0.38) ** 2))
        return r * (1 + 0.15 * fold * math.sin(6 * th + 0.9 * t) + 0.05 * fold * math.sin(13 * th + 1.7) + arm * side)

    pts, faces = [(0.0, top, 0.0)], []
    for k, (t, _) in enumerate(GHOST_PROFILE[1:]):
        for j in range(seg):
            th = 2 * math.pi * j / seg
            r = radius(t, th)
            y = top - t * L
            if k == len(GHOST_PROFILE) - 2:      # the hem: uneven, torn into points
                y -= 0.07 * abs(math.sin(4.5 * th + 0.6)) + 0.13 * jag[j] ** 3
            pts.append((r * math.cos(th), y, r * math.sin(th)))
    rings = len(GHOST_PROFILE) - 1
    for j in range(seg):
        faces.append([0, 1 + (j + 1) % seg, 1 + j])
    for k in range(rings - 1):
        a, c = 1 + k * seg, 1 + (k + 1) * seg
        for j in range(seg):
            j2 = (j + 1) % seg
            faces.append([a + j, a + j2, c + j2, c + j])
    for f in b.poly(sheet, pts, faces):
        f.smooth = True

    def hole(th, t, w, h):
        """A dark oval on the sheet's face, just proud of it."""
        y = top - t * L
        r = radius(t, th) + 0.004
        c, s = math.cos(th), math.sin(th)
        ring_ = []
        for k in range(8):
            a = 2 * math.pi * k / 8
            u, v = math.cos(a) * w, math.sin(a) * h
            rr = r - abs(u) * 0.35              # follow the head's curve a little
            ring_.append(((rr) * c - u * s, y + v, (rr) * s + u * c))
        b.poly(dark, ring_, [list(range(8))[::-1]])
    front = -math.pi / 2                         # -z
    for e in (-0.33, 0.33):
        hole(front + e, 0.12, 0.028, 0.042)
    hole(front, 0.205, 0.022, 0.03)
    b.cyl(thread, 0.004, (0.0, 0.0, 0.0), (0.0, top - 0.005, 0.0), seg=3, caps=False)
    b.finish("hg-ghost.glb")
