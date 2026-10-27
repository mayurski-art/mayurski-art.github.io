"""
Undergrin's twelve shop interiors (ug-shops.glb): the arcade, Grinbiss,
the purple and red rooms, the lounges with the general's portrait,
Apotrolle, the bookshops. See ug_kit.py.
"""
from ug_kit import *  # noqa: F401,F403


# ================================================================== SHOPS

def shop_floor(b, m, x0, x1, z0, z1, y=U):
    hrect(b, m, x0, x1, z0, z1, y + 0.004)


@registered("cabinet")
def tk_cabinet(b, PAL, x, z, y, facing, marquee_text=False):
    """A Troll Kombat arcade cabinet (0.8 wide, 0.9 deep, 1.9 tall) facing +-z."""
    f = facing
    REG.face("tk@%.1f,%.1f" % (x, z), "@self", (x, y + 1.35, z + f * 0.47), (0, 0, f), 0.8, 1.1)
    bx(b, PAL["cabinet"], x - 0.4, x + 0.4, y, y + 1.9, z - 0.45, z + 0.45)
    bx(b, PAL["orange"], x - 0.42, x + 0.42, y + 1.55, y + 1.9, z - 0.47, z + 0.47)
    panel(b, PAL["screen"], (x, y + 1.15, z + f * 0.45), (0, 0, f), 0.6, 0.45, o=0.01)
    bx(b, PAL["black"], x - 0.4, x + 0.4, y + 0.8, y + 0.9, z + f * 0.3, z + f * 0.6)
    b.cyl(PAL["red"], 0.03, (x - 0.15, y + 0.9, z + f * 0.5), (x - 0.15, y + 1.05, z + f * 0.5), seg=5)
    for k in range(3):
        b.cyl(PAL["white"], 0.03, (x + 0.05 + 0.12 * k, y + 0.9, z + f * 0.47), (x + 0.05 + 0.12 * k, y + 0.92, z + f * 0.47), seg=6)
    if marquee_text:
        text(b, PAL["black"], "TROLL", (x, y + 1.8, z + f * 0.47), (0, 0, f), 0.1, o=0.012)
        text(b, PAL["black"], "KOMBAT", (x, y + 1.65, z + f * 0.47), (0, 0, f), 0.1, o=0.012)
    else:
        text(b, PAL["black"], "TK", (x, y + 1.72, z + f * 0.47), (0, 0, f), 0.18, o=0.012)


@registered("cabinet")
def tk_cabinet_x(b, PAL, x, z, y, facing, marquee_text=False):
    """Same cabinet facing +-x (against a side wall)."""
    f = facing
    REG.face("tk@%.1f,%.1f" % (x, z), "@self", (x + f * 0.42, y + 1.35, z), (f, 0, 0), 0.8, 1.1)
    bx(b, PAL["cabinet"], x - 0.4, x + 0.4, y, y + 1.9, z - 0.45, z + 0.45)
    bx(b, PAL["orange"], x - 0.42, x + 0.42, y + 1.55, y + 1.9, z - 0.47, z + 0.47)
    panel(b, PAL["screen"], (x + f * 0.4, y + 1.15, z), (f, 0, 0), 0.6, 0.45, o=0.01)
    bx(b, PAL["black"], x + f * 0.25, x + f * 0.4, y + 0.8, y + 0.9, z - 0.42, z + 0.42)
    b.cyl(PAL["red"], 0.03, (x + f * 0.33, y + 0.9, z - 0.15), (x + f * 0.33, y + 1.05, z - 0.15), seg=5)
    if marquee_text:
        text(b, PAL["black"], "TROLL", (x + f * 0.42, y + 1.8, z), (f, 0, 0), 0.1, o=0.012)
        text(b, PAL["black"], "KOMBAT", (x + f * 0.42, y + 1.65, z), (f, 0, 0), 0.1, o=0.012)
    else:
        text(b, PAL["black"], "TK", (x + f * 0.42, y + 1.72, z), (f, 0, 0), 0.18, o=0.012)


@registered("table")
def table_and_chairs(b, PAL, x, z, y, m_top, r=0.45):
    b.cyl(PAL["black"], 0.04, (x, y, z), (x, y + 0.72, z), seg=6)
    b.cyl(m_top, r, (x, y + 0.72, z), (x, y + 0.76, z), seg=12)
    b.cyl(PAL["black"], 0.25, (x, y, z), (x, y + 0.03, z), seg=10)
    for (dx, dz) in ((0.75, 0), (-0.75, 0)):
        bx(b, PAL["dark"], x + dx - 0.2, x + dx + 0.2, y + 0.42, y + 0.47, z + dz - 0.2, z + dz + 0.2)
        bx(b, PAL["dark"], x + dx + (0.16 if dx > 0 else -0.2), x + dx + (0.2 if dx > 0 else -0.16), y + 0.47, y + 0.9, z + dz - 0.2, z + dz + 0.2)
        b.cyl(PAL["black"], 0.03, (x + dx, y, z + dz), (x + dx, y + 0.42, z + dz), seg=4)


@registered("shelf")
def shelf_wall(b, PAL, x, z0, z1, y, facing, rows=4, seed=0, d=0.4):
    """Shelving against a wall at x (opening toward facing), d deep, with
    rows of coloured books / bottles as flat quads."""
    rng = random.Random(seed)
    xa, xb = sorted((x, x + facing * d))
    bx(b, PAL["oak"], xa, xb, y, y + 2.2, min(z0, z1) - 0.03, min(z0, z1))
    bx(b, PAL["oak"], xa, xb, y, y + 2.2, max(z0, z1), max(z0, z1) + 0.03)
    for r in range(rows + 1):
        bx(b, PAL["oak"], xa, xb, y + 0.3 + r * 0.45, y + 0.33 + r * 0.45, min(z0, z1), max(z0, z1))
    cols = ["red", "stripe", "green", "orange", "cream", "purple", "cyan", "white", "black"]
    for r in range(rows):
        zz = min(z0, z1) + 0.05
        while zz < max(z0, z1) - 0.1:
            w = rng.uniform(0.14, 0.4)
            h = rng.uniform(0.22, 0.38)
            panel(b, PAL[rng.choice(cols)], (x + facing * (d - 0.05), y + 0.33 + r * 0.45 + h / 2, zz + w / 2), (facing, 0, 0), w, h, o=0.0)
            zz += w + 0.01


@registered("counter")
def counter(b, PAL, x0, x1, z0, z1, y, m_front, m_top, h=1.1):
    """A counter on its collider's footprint, h tall (the top included)."""
    bx(b, m_front, x0, x1, y, y + h - 0.06, z0, z1)
    bx(b, m_top, x0, x1, y + h - 0.06, y + h, z0, z1)


def sofa(b, PAL, x, z, y, along_x, L=2.2, m=None):
    m = m or PAL["red"]
    if along_x:
        bx(b, m, x - L / 2, x + L / 2, y + 0.15, y + 0.5, z - 0.45, z + 0.45)
        bx(b, m, x - L / 2, x + L / 2, y + 0.5, y + 0.95, z + 0.25, z + 0.5)
        for sx in (-1, 1):
            bx(b, m, x + sx * (L / 2 - 0.1), x + sx * (L / 2 + 0.1), y + 0.15, y + 0.7, z - 0.45, z + 0.5)
    else:
        bx(b, m, x - 0.45, x + 0.45, y + 0.15, y + 0.5, z - L / 2, z + L / 2)
        bx(b, m, x + 0.25, x + 0.5, y + 0.5, y + 0.95, z - L / 2, z + L / 2)
        for sz in (-1, 1):
            bx(b, m, x - 0.45, x + 0.5, y + 0.15, y + 0.7, z + sz * (L / 2 - 0.1), z + sz * (L / 2 + 0.1))


def cow_rug(b, PAL, x, z, y, w, d, seed=3):
    hrect(b, PAL["white"], x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + 0.006)
    rng = random.Random(seed)
    for _ in range(9):
        bw, bd = rng.uniform(0.25, 0.6), rng.uniform(0.25, 0.6)
        bxp, bzp = rng.uniform(-w / 2 + bw / 2, w / 2 - bw / 2), rng.uniform(-d / 2 + bd / 2, d / 2 - bd / 2)
        hrect(b, PAL["black"], x + bxp - bw / 2, x + bxp + bw / 2, z + bzp - bd / 2, z + bzp + bd / 2, y + 0.008)


def dress_shop(b, PAL, name, z0, z1, s):
    """One shop of the west row (x -22..-16.3, z0..z1) for s = 1, or the same
    shop turned 180 degrees into the east row for s = -1, exactly as
    maps.js lays its colliders. Everything solid stands on a collider's
    footprint; the rest is paint on the walls and floors."""
    X = lambda x: s * x
    Z = lambda z: s * z
    y = U
    BACK, INNER = -22.0, -16.3                 # the outer wall, the hall-side wall (west row)
    cz = (z0 + z1) / 2

    def floor(m, xa, xb, za, zb):
        hrect(b, m, min(X(xa), X(xb)), max(X(xa), X(xb)), min(Z(za), Z(zb)), max(Z(za), Z(zb)), y + 0.004)

    def box(m, xa, xb, ya, yb, za, zb):
        bx(b, m, X(xa), X(xb), ya, yb, Z(za), Z(zb))

    def on_back(m, zc, yc, w, h, txt=None, tm=None, th=0.2, ty=None):
        REG.face("backsign@%.0f,%.1f,%.0f" % (X(BACK), yc, Z(zc)), "wall", (X(BACK + 0.01), yc, Z(zc)), (s, 0, 0), w, h)
        panel(b, m, (X(BACK + 0.01), yc, Z(zc)), (s, 0, 0), w, h, o=0.0)
        if txt:
            text(b, tm, txt, (X(BACK + 0.02), ty or yc, Z(zc)), (s, 0, 0), th, o=0.01)

    def table(xc, zc, w, d, h, m_top):
        """A table on its collider (w x d x h): top, four legs, two stools tucked under."""
        REG.begin(b, "table@%.1f,%.1f" % (X(xc), Z(zc)))
        box(m_top, xc - w / 2, xc + w / 2, y + h - 0.05, y + h, zc - d / 2, zc + d / 2)
        for (dx, dz) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            box(PAL["black"], xc + dx * (w / 2 - 0.08) - 0.03, xc + dx * (w / 2 - 0.08) + 0.03, y, y + h - 0.05,
                zc + dz * (d / 2 - 0.08) - 0.03, zc + dz * (d / 2 - 0.08) + 0.03)
        for dz in (-1, 1):
            b.cyl(PAL["dark"], 0.17, (X(xc), y, Z(zc + dz * d * 0.22)), (X(xc), y + 0.45, Z(zc + dz * d * 0.22)), seg=10)
        REG.end()

    rng = random.Random(int(cz * 3 + s))
    if name == "arcade":
        # carpet: the well takes x -22..-17.5 north of z -35
        floor(PAL["carpet"], BACK, INNER, -35, z1)
        floor(PAL["carpet"], -17.5, INNER, z0, -35)
        for k in range(12):
            m = PAL["neon_m"] if k % 2 else PAL["neon_c"]
            px, pz = rng.uniform(-21.0, -17.8), rng.uniform(-34.4, -27.5)
            if rng.random() < 0.5:
                floor(m, px, px + rng.uniform(0.4, 1.2), pz, pz + 0.05)
            else:
                floor(m, px, px + 0.05, pz, pz + rng.uniform(0.4, 1.2))
        # four Troll Kombat cabinets on the back wall (x -21.9..-21.1), facing in
        for k, zc in enumerate((-33, -31, -29, -27)):
            tk_cabinet_x(b, PAL, X(-21.5), Z(zc), y, s, marquee_text=(k % 2 == 0))
        on_back(PAL["black"], -30, y + 2.9, 3.4, 0.6, "TROLL KOMBAT", PAL["neon_m"], 0.34)
    elif name == "grinbiss":
        floor(PAL["cream"], BACK, INNER, z0, z1)
        counter(b, PAL, X(-21.5), X(-20.7), Z(-22), Z(-16), y, PAL["salmon"], PAL["white"])
        # the coffee machine and a till on the counter
        REG.begin(b, "coffee@%.1f,%.1f" % (X(-21.1), Z(-21.2)))
        box(PAL["steel"], -21.4, -20.8, y + 1.1, y + 1.6, -21.6, -20.8)
        REG.end()
        REG.begin(b, "till@%.1f,%.1f" % (X(-21.1), Z(-16.9)))
        box(PAL["dark"], -21.3, -20.9, y + 1.1, y + 1.35, -17.2, -16.6)
        REG.end()
        on_back(PAL["black"], -19, y + 2.4, 2.4, 1.0)
        text(b, PAL["board_o"], "GRINBISS", (X(BACK + 0.02), y + 2.7, Z(-19)), (s, 0, 0), 0.24, o=0.01)
        text(b, PAL["white"], "KEBAP 4  FRIES 2", (X(BACK + 0.02), y + 2.25, Z(-19)), (s, 0, 0), 0.12, o=0.01)
        for tz in (-24, -14):
            table(-17.0, tz, 1.0, 1.0, 0.8, PAL["white"])
        band_z(b, PAL["salmon"], X(BACK), s, y + 0.9, y + 1.1, Z(z0), Z(z1), o=0.0)
    elif name == "purple":
        m = PAL["purple"] if s > 0 else PAL["red"]
        floor(m, BACK, INNER, z0, z1)
        # trim: bands round all four walls, cut at the doorways
        band_z(b, m, X(BACK), s, y + 0.6, y + 1.3, Z(z0), Z(z1), o=0.0)
        band_z(b, m, X(INNER), -s, y + 0.6, y + 1.3, Z(z0), Z(z1), o=0.0, doors=[(Z(-8), 1.8, y + DOOR_H)])
        for (zw, nz) in ((z0 + 0.15, 1), (z1 - 0.15, -1)):
            band_x(b, m, Z(zw), s * nz, y + 0.6, y + 1.3, X(BACK), X(INNER), o=0.0, doors=[(X(-19), 1.8, y + DOOR_H)])
        band_z(b, m, X(BACK), s, y + 3.0, y + 3.3, Z(z0), Z(z1), o=0.0)
    elif name == "lounge":
        floor(PAL["oak"], BACK, INNER, z0, z1)
        cow_rug(b, PAL, X(-19.25), Z(6), y, 3.5, 3.0, seed=int(cz * s))
        # two red sofas against the back wall (x -21.9..-21, z 2..4.2 and 8..10.2), facing in
        for (za, zb) in ((2.0, 4.2), (8.0, 10.2)):
            REG.begin(b, "sofa@%.1f,%.1f" % (X(-21.45), Z((za + zb) / 2)))
            box(PAL["red"], -21.9, -21.0, y + 0.15, y + 0.5, za, zb)              # seat
            box(PAL["red"], -21.9, -21.65, y + 0.5, y + 0.9, za, zb)             # back
            for ze in (za, zb - 0.2):
                box(PAL["red"], -21.9, -21.0, y + 0.15, y + 0.7, ze, ze + 0.2)   # arms
            box(PAL["dark"], -21.85, -21.05, y, y + 0.15, za + 0.1, zb - 0.1)
            REG.end()
        # the fireplace on the hall-side wall (x -17.3..-16.3, z 5.3..6.7, 1.4 tall)
        fz = 6.0
        REG.begin(b, "fireplace@%.1f,%.1f" % (X(-16.8), Z(fz)))
        box(PAL["brick"], -17.3, INNER, y, y + 1.32, fz - 0.7, fz + 0.7)
        box(PAL["oak"], -17.35, INNER, y + 1.32, y + 1.4, fz - 0.7, fz + 0.7)
        box(PAL["black"], -17.32, -17.3, y + 0.2, y + 0.95, fz - 0.4, fz + 0.4)
        panel(b, PAL["fire"], (X(-17.33), y + 0.45, Z(fz)), (-s, 0, 0), 0.6, 0.4, o=0.0)
        REG.end()
        # the general's photo over it, in a frame that hugs it
        general_portrait(b, PAL, (X(INNER - 0.08), y + 2.65, Z(fz)), (-s, 0, 0), 1.5, o=0.004)
    elif name == "apotrolle":
        floor(PAL["white"], BACK, INNER, z0, z1)
        counter(b, PAL, X(-21.5), X(-20.7), Z(15), Z(21), y, PAL["white"], PAL["green"])
        # bottle shelves on the hall-side wall, either side of its doorway (z 19)
        for (za, zb, sd) in ((12.5, 17.5, 1), (22.5, 25.5, 2)):
            shelf_wall(b, PAL, X(INNER), Z(za), Z(zb), y, -s, rows=4, seed=int(cz) + sd, d=0.7)
        on_back(PAL["white"], 18, y + 2.7, 2.4, 0.8, "APOTROLLE", PAL["green"], 0.22)
        # the green cross over the partition doorway (x -19) at the row's z1
        zc = z1
        REG.begin(b, "cross@%.0f,%.0f" % (X(-19), Z(zc)))
        box(PAL["cross"], -19.08, -18.92, y + 2.9, y + 3.5, zc - 0.3, zc + 0.3)
        box(PAL["cross"], -19.08, -18.92, y + 3.1, y + 3.3, zc - 0.8, zc + 0.8)
        box(PAL["cross"], -19.4, -18.6, y + 3.1, y + 3.3, zc - 0.1, zc + 0.1)
        REG.end()
    elif name == "books":
        floor(PAL["oak"], BACK, INNER, z0, z1)
        shelf_wall(b, PAL, X(BACK), Z(28), Z(38), y, s, rows=4, seed=int(cz), d=0.6)
        shelf_wall(b, PAL, X(INNER), Z(34.5), Z(39), y, -s, rows=4, seed=int(cz) + 1, d=0.7)
        table(-20.7, 30.0, 1.0, 2.0, 0.8, PAL["oak"])
        on_back(PAL["cream"], 39.0, y + 2.9, 1.6, 0.5, "BOOKS", PAL["black"], 0.22)
        text(b, PAL["black"], "TROLLSTOY", (X(BACK + 0.02), y + 2.6, Z(33)), (s, 0, 0), 0.2, o=0.01)
    # shop signs over the partition doorways
    sign = {"purple": "PURPLE ROOM" if s > 0 else "RED ROOM"}.get(name)
    if sign:
        for (zz, nz) in ((z0 + 0.15, 1), (z1 - 0.15, -1)):
            if abs(zz) > 39:
                continue
            panel(b, PAL["roundelblue"], (X(-19), y + 2.75, Z(zz)), (0, 0, s * nz), 1.7, 0.3, o=0.0)
            REG.face("shopsign@%.0f,%.1f/%+d" % (X(-19), Z(zz), s * nz), "wall", (X(-19), y + 2.75, Z(zz)), (0, 0, s * nz), 1.7, 0.3)
            text(b, PAL["white"], sign, (X(-19), y + 2.75, Z(zz)), (0, 0, s * nz), 0.16, o=0.012)


def build_shops(PAL):
    b = Builder()
    for s in (1, -1):
        for (z0, z1, name) in SHOPS_W:
            dress_shop(b, PAL, name, z0, z1, s)
    b.finish("ug-shops.glb", bake=False, uv2=1024, quantize=True)

