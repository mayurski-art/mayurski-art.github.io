"""
Undergrin's twelve shop interiors (ug-shops.glb): the arcade, Grinbiss,
the purple and red rooms, the lounges with the general's portrait,
Apotrolle, the bookshops. Phase 3 of "Troll Forces: Undergrin in Blender":
their signs in German (the brands stay), Greifautomaten in the
arcade, a Dönerspieß, stools and a drinks fridge in the Grinbiss, the
salons' neon, mirror ball, speakers and poufs, the lounges' coffee tables,
sideboard, lamps and plants, the Apotrolle's till, display and waiting
bench, the bookshops' new titles, armchair, lamp and ladder. See ug_kit.py.
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


# --------------------------------------------------- phase 3 shop furniture

@registered("claw")
def claw_machine(b, PAL, x, z, y, facing, seed=0):
    """A Greifautomat against a side wall, facing +-x: a red cabinet 0.8 x
    0.8 x 2.0, the window onto the plush (a cream backing, coloured lumps),
    the claw on its gantry, the lit marquee, the coin slot."""
    f = facing
    n = (f, 0, 0)
    bx(b, PAL["red"], x - 0.4, x + 0.4, y, y + 0.95, z - 0.4, z + 0.4)
    bx(b, PAL["red"], x - 0.4, x + 0.4, y + 1.75, y + 2.0, z - 0.4, z + 0.4)
    for e in (-1, 1):
        bx(b, PAL["steel"], x - 0.4, x + 0.4, y + 0.95, y + 1.75, z + e * 0.37 - 0.03, z + e * 0.37 + 0.03)
    bx(b, PAL["cream"], *sorted((x - f * 0.4, x - f * 0.36)), y + 0.95, y + 1.75, z - 0.37, z + 0.37)
    fc = Vector((x + f * 0.4, y + 1.35, z))
    REG.face("claw@%.1f,%.1f" % (x, z), "@self", fc, n, 0.74, 0.8)
    Uv, Vv = frame(n)
    rng = random.Random(seed)
    for k in range(9):
        u, v = -0.24 + (k % 3) * 0.24 + rng.uniform(-0.03, 0.03), -0.3 + (k // 3) * 0.09
        rect(b, PAL[rng.choice(["pink", "cyan", "yellow", "green", "orange"])], fc - Vector(n) * 0.74, Uv, Vv, u - 0.09, u + 0.09, v - 0.06, v + 0.06)
    bx(b, PAL["steel"], x - 0.36, x + 0.36, y + 1.7, y + 1.73, z - 0.02, z + 0.02)
    b.cyl(PAL["steel"], 0.01, (x, y + 1.7, z + 0.05), (x, y + 1.45, z + 0.05), seg=4)
    for e in (-1, 1):
        b.cyl(PAL["yellow"], 0.012, (x, y + 1.45, z + 0.05), (x, y + 1.36, z + 0.05 + e * 0.06), seg=4)
    panel(b, PAL["neon_c"], (x + f * 0.4, y + 1.87, z), n, 0.7, 0.16, o=0.004)
    text(b, PAL["black"], "GREIFER", (x + f * 0.4, y + 1.87, z), n, 0.09, o=0.008)
    panel(b, PAL["black"], (x + f * 0.4, y + 0.75, z + 0.22), n, 0.1, 0.14, o=0.004)
    b.cyl(PAL["red"], 0.025, (x + f * 0.32, y + 0.95, z - 0.15), (x + f * 0.32, y + 1.08, z - 0.15), seg=6)
    collide(x - 0.4, x + 0.4, y, y + 2.0, z - 0.4, z + 0.4)


@registered("stool")
def bar_stool(b, PAL, x, z, y, m):
    """A bar stool: a round seat 0.75 up on a chrome post, a foot ring."""
    b.cyl(PAL["steel"], 0.2, (x, y, z), (x, y + 0.02, z), seg=12)
    b.cyl(PAL["steel"], 0.025, (x, y, z), (x, y + 0.72, z), seg=6)
    b.cyl(PAL["steel"], 0.15, (x, y + 0.3, z), (x, y + 0.32, z), seg=12)
    b.cyl(m, 0.18, (x, y + 0.72, z), (x, y + 0.78, z), seg=12)
    collide(x - 0.18, x + 0.18, y, y + 0.78, z - 0.18, z + 0.18)


@registered("fridge")
def drinks_fridge(b, PAL, x0, x1, z0, z1, y, facing):
    """A drinks fridge against a wall, its door facing +-x: a white body,
    the door's window onto five shelves of bottles, a lit header."""
    bx(b, PAL["white"], x0, x1, y, y + 2.0, z0, z1)
    f = facing
    xf = x1 if f > 0 else x0
    n = (f, 0, 0)
    zc, w = (z0 + z1) / 2, abs(z1 - z0)
    fc = Vector((xf, y + 1.05, zc))
    REG.face("fridge@%.1f,%.1f" % (xf, zc), "@self", fc, n, w, 1.5)
    panel(b, PAL["glass"], fc, n, w - 0.12, 1.45, o=0.003)
    Uv, Vv = frame(n)
    cols = ["red", "green", "orange", "cream", "stripe"]
    for r in range(5):
        v = -0.6 + r * 0.29
        rect(b, PAL["steel"], fc + Vector(n) * 0.005, Uv, Vv, -w / 2 + 0.08, w / 2 - 0.08, v - 0.1, v - 0.09)
        for k in range(int((w - 0.2) / 0.09)):
            u = -w / 2 + 0.12 + k * 0.09
            rect(b, PAL[cols[(r + k) % 5]], fc + Vector(n) * 0.006, Uv, Vv, u, u + 0.06, v - 0.09, v + 0.1)
    sign(b, PAL, (xf, y + 1.88, zc), n, w - 0.06, 0.16, ["Getränke"], fg="white", bg="roundel", lit=True, o=0.004, pad=0.02,
         face=None, sid="fridge@%.1f,%.1f/t" % (xf, zc))
    collide(x0, x1, y, y + 2.0, z0, z1)


@registered("speakers")
def speaker_stack(b, PAL, x0, x1, z0, z1, y, facing, h=1.6):
    """Two black cabinets stacked, their cones toward +-x."""
    bx(b, PAL["black"], x0, x1, y, y + h, z0, z1)
    bx(b, PAL["dark"], x0, x1, y + 0.78, y + 0.82, z0, z1)
    f = facing
    xf = x1 if f > 0 else x0
    zc = (z0 + z1) / 2
    for (yy, r) in ((0.35, 0.22), (1.05, 0.15), (1.42, 0.07)):
        ring(b, PAL["grey"], (xf, y + yy, zc), (f, 0, 0), r * 0.75, r, seg=16, o=0.004)
        disc(b, PAL["dark"], (xf, y + yy, zc), (f, 0, 0), r * 0.75, seg=16, o=0.003)
    collide(x0, x1, y, y + h, z0, z1)


def mirror_ball(b, PAL, x, z, y_ceil, y):
    """A mirror ball on its chain: two steel cones, a band of white facets."""
    REG.begin(b, "mirrorball@%.1f,%.1f" % (x, z))
    b.cyl(PAL["black"], 0.01, (x, y + 0.3, z), (x, y_ceil, z), seg=4)
    b.cyl(PAL["steel"], 0.3, (x, y, z), (x, y + 0.3, z), seg=12, r2=0.02)
    b.cyl(PAL["steel"], 0.3, (x, y, z), (x, y - 0.3, z), seg=12, r2=0.02)
    b.cyl(PAL["white"], 0.305, (x, y - 0.04, z), (x, y + 0.04, z), seg=12)
    REG.end()


@registered("floorlamp")
def floor_lamp(b, PAL, x, z, y):
    """A standard lamp: a round foot, a brass pole, a lit drum shade."""
    b.cyl(PAL["dark"], 0.16, (x, y, z), (x, y + 0.03, z), seg=12)
    b.cyl(PAL["oak"], 0.015, (x, y, z), (x, y + 1.45, z), seg=6)
    b.cyl(PAL["pendant"], 0.2, (x, y + 1.4, z), (x, y + 1.7, z), seg=14, r2=0.16)
    collide(x - 0.2, x + 0.2, y, y + 1.7, z - 0.2, z + 0.2)


@registered("plant")
def potted_plant(b, PAL, x, z, y, seed=0):
    """A pot plant: a dark pot, a fan of leaves as blades."""
    b.cyl(PAL["dark"], 0.22, (x, y, z), (x, y + 0.45, z), seg=12, r2=0.18)
    disc(b, PAL["brick"], (x, y + 0.451, z), (0, 1, 0), 0.19, seg=12)
    rng = random.Random(seed)
    for k in range(7):
        a = k * math.pi * 2 / 7 + rng.uniform(-0.2, 0.2)
        L = rng.uniform(0.45, 0.75)
        tip = (x + math.cos(a) * 0.25, y + 0.45 + L, z + math.sin(a) * 0.25)
        b.bar(PAL["green"], (x, y + 0.45, z), tip, 0.06, 0.012)
    collide(x - 0.25, x + 0.25, y, y + 1.2, z - 0.25, z + 0.25)


def dress_shop(b, PAL, name, z0, z1, s):
    """One shop of the west row (x -22..-16.3, z0..z1) for s = 1, or the same
    shop turned 180 degrees into the east row for s = -1, exactly as
    maps.js lays its colliders. Everything solid stands on a collider's
    footprint, or gets one of its own (maps/undergrin-props.js); the rest
    is paint on the walls and floors. Phase 3: German words on every sign
    but the brands (Troll Kombat, Grinbiss, Apotrolle), lettered at load."""
    X = lambda x: s * x
    Z = lambda z: s * z
    y = U
    BACK, INNER = -22.0, -16.3                 # the outer wall, the hall-side wall (west row)
    cz = (z0 + z1) / 2

    def floor(m, xa, xb, za, zb):
        hrect(b, m, min(X(xa), X(xb)), max(X(xa), X(xb)), min(Z(za), Z(zb)), max(Z(za), Z(zb)), y + 0.004)

    def box(m, xa, xb, ya, yb, za, zb):
        bx(b, m, *sorted((X(xa), X(xb))), ya, yb, *sorted((Z(za), Z(zb))))

    def on_back(m, zc, yc, w, h, txt=None, tm=None, th=0.2, ty=None):
        REG.face("backsign@%.0f,%.1f,%.0f" % (X(BACK), yc, Z(zc)), "wall", (X(BACK + 0.01), yc, Z(zc)), (s, 0, 0), w, h)
        panel(b, m, (X(BACK + 0.01), yc, Z(zc)), (s, 0, 0), w, h, o=0.0)
        if txt:
            text(b, tm, txt, (X(BACK + 0.02), ty or yc, Z(zc)), (s, 0, 0), th, o=0.01)

    def words(zc, yc, w, h, lines, fg="black", bg=None, wall=BACK, lit=False, face="wall"):
        """Real words on the back (or the hall-side) wall, facing into the shop."""
        nx = s if wall == BACK else -s
        sign(b, PAL, (X(wall + (0.01 if wall == BACK else -0.01)), yc, Z(zc)), (nx, 0, 0), w, h, lines, fg=fg, bg=bg, lit=lit,
             o=0.004, face=face, sid="shop@%.1f,%.1f,%.1f" % (X(wall), yc, Z(zc)))

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

    def low_table(xc, zc, w, d, m_top):
        """A coffee table under 0.6 m (no collider): a top on four short legs."""
        REG.begin(b, "coffeetable@%.1f,%.1f" % (X(xc), Z(zc)))
        box(m_top, xc - w / 2, xc + w / 2, y + 0.36, y + 0.4, zc - d / 2, zc + d / 2)
        for (dx, dz) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            box(PAL["black"], xc + dx * (w / 2 - 0.06) - 0.02, xc + dx * (w / 2 - 0.06) + 0.02, y, y + 0.36,
                zc + dz * (d / 2 - 0.06) - 0.02, zc + dz * (d / 2 - 0.06) + 0.02)
        REG.end()

    def solid(xa, xb, ya, yb, za, zb):
        collide(*sorted((X(xa), X(xb))), ya, yb, *sorted((Z(za), Z(zb))))

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
        # phase 3: two Greifautomaten on the hall-side wall, neon lines (an air hockey table stood
        # on the walk from the cabinets to the Grinbiss doorway: map-walk failed, it went)
        for k, zc in enumerate((-29.5, -28.3)):
            claw_machine(b, PAL, X(-16.75), Z(zc), y, -s, seed=k + 2 * (s > 0))
        band_z(b, PAL["neon_m"], X(BACK), s, y + 2.4, y + 2.45, Z(-35), Z(z1), o=0.004)
        band_z(b, PAL["neon_c"], X(INNER), -s, y + 2.4, y + 2.45, Z(z0), Z(z1), o=0.004, doors=[(Z(-33), 1.8, y + DOOR_H)])
        words(-33, y + 2.85, 1.8, 0.4, ["Spielhalle"], fg="neon_c", bg="black", wall=INNER, lit=True)
        words(-31.4, y + 1.6, 0.55, 0.36, ["Zutritt", "ab 18"], fg="white", bg="roundel", wall=INNER)
    elif name == "grinbiss":
        floor(PAL["cream"], BACK, INNER, z0, z1)
        counter(b, PAL, X(-21.5), X(-20.7), Z(-22), Z(-16), y, PAL["salmon"], PAL["white"])
        # the coffee machine and a till on the counter
        REG.begin(b, "coffee@%.1f,%.1f" % (X(-21.1), Z(-21.2)))
        box(PAL["steel"], -21.4, -20.8, y + 1.1, y + 1.6, -21.6, -20.8)
        box(PAL["black"], -20.81, -20.79, y + 1.25, y + 1.45, -21.35, -21.05)
        REG.end()
        REG.begin(b, "till@%.1f,%.1f" % (X(-21.1), Z(-16.9)))
        box(PAL["dark"], -21.3, -20.9, y + 1.1, y + 1.35, -17.2, -16.6)
        REG.end()
        # the Dönerspieß at its grill, clear of the board in plan
        REG.begin(b, "spit@%.1f,%.1f" % (X(-21.25), Z(-20.5)))
        box(PAL["steel"], -21.48, -21.42, y + 1.1, y + 1.85, -20.75, -20.25)
        box(PAL["fire"], -21.42, -21.41, y + 1.2, y + 1.75, -20.7, -20.3)
        b.cyl(PAL["steel"], 0.01, (X(-21.25), y + 1.1, Z(-20.5)), (X(-21.25), y + 1.9, Z(-20.5)), seg=4)
        b.cyl(PAL["frame"], 0.13, (X(-21.25), y + 1.2, Z(-20.5)), (X(-21.25), y + 1.75, Z(-20.5)), seg=12, r2=0.09)
        REG.end()
        on_back(PAL["black"], -19, y + 2.5, 2.4, 1.0)
        text(b, PAL["board_o"], "GRINBISS", (X(BACK + 0.02), y + 2.8, Z(-19)), (s, 0, 0), 0.24, o=0.01)
        sign(b, PAL, (X(BACK + 0.01), y + 2.32, Z(-19)), (s, 0, 0), 2.2, 0.5, ["Döner 4,50  ·  Pommes 2,50", "Currywurst 3,90  ·  Ayran 1,50"],
             fg="white", o=0.012, pad=0.02, face=None, sid="grinbiss@%.0f,%.0f/menu" % (X(BACK), Z(-19)))
        for tz in (-24, -14):
            table(-17.0, tz, 1.0, 1.0, 0.8, PAL["white"])
        band_z(b, PAL["salmon"], X(BACK), s, y + 0.9, y + 1.1, Z(z0), Z(z1), o=0.0)
        # phase 3: stools at the counter, the drinks fridge by the partition, Imbiss over the hall door
        for sz in (-21.2, -19.9, -18.6, -17.3):
            bar_stool(b, PAL, X(-20.3), Z(sz), y, PAL["salmon"])
        drinks_fridge(b, PAL, *sorted((X(-17.0), X(-16.35))), *sorted((Z(-13.0), Z(-12.2))), y, -s)
        words(-19, y + 2.85, 1.8, 0.4, ["Imbiss"], fg="white", bg="salmon", wall=INNER)
    elif name == "purple":
        m = PAL["purple"] if s > 0 else PAL["red"]
        floor(m, BACK, INNER, z0, z1)
        # trim: bands round all four walls, cut at the doorways
        band_z(b, m, X(BACK), s, y + 0.6, y + 1.3, Z(z0), Z(z1), o=0.0)
        band_z(b, m, X(INNER), -s, y + 0.6, y + 1.3, Z(z0), Z(z1), o=0.0, doors=[(Z(-8), 1.8, y + DOOR_H)])
        for (zw, nz) in ((z0 + 0.15, 1), (z1 - 0.15, -1)):
            band_x(b, m, Z(zw), s * nz, y + 0.6, y + 1.3, X(BACK), X(INNER), o=0.0, doors=[(X(-19), 1.8, y + DOOR_H)])
        band_z(b, m, X(BACK), s, y + 3.0, y + 3.3, Z(z0), Z(z1), o=0.0)
        # phase 3: a salon round the stair well: its name in neon, a mirror ball over the well,
        # speaker stacks in the back corners, poufs by the partition
        words(-6, y + 2.3, 2.6, 0.5, ["Lila Salon" if s > 0 else "Roter Salon"], fg="neon_m" if s > 0 else "fire", bg="black", lit=True)
        mirror_ball(b, PAL, X(-19.5), Z(-7.0), CEIL_SHOP, y + 3.2)
        for (za, zb) in ((-11.8, -11.1), (-0.9, -0.2)):
            speaker_stack(b, PAL, *sorted((X(-21.85), X(-21.15))), *sorted((Z(za), Z(zb))), y, s)
        for (px, pz, pm) in ((-20.6, -3.0, "pink"), (-20.6, -1.8, "cyan"), (-17.4, -3.0, "cyan"), (-17.4, -1.8, "pink")):
            REG.begin(b, "pouf@%.1f,%.1f" % (X(px), Z(pz)))
            box(PAL[pm], px - 0.25, px + 0.25, y + 0.04, y + 0.4, pz - 0.25, pz + 0.25)
            box(PAL["dark"], px - 0.26, px + 0.26, y, y + 0.04, pz - 0.26, pz + 0.26)
            REG.end()
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
            for k in range(3):
                zc = za + 0.45 + k * 0.65
                box(PAL["cream"], -21.65, -21.5, y + 0.5, y + 0.8, zc - 0.22, zc + 0.22)   # cushions
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
        # phase 3: a coffee table before each sofa, a sideboard between them, standard lamps, pot plants
        for zc in (3.1, 9.1):
            low_table(-20.3, zc, 0.6, 1.2, PAL["oak"])
        REG.begin(b, "sideboard@%.1f,%.1f" % (X(-21.72), Z(6.0)))
        box(PAL["frame"], -21.95, -21.5, y, y + 0.85, 5.0, 7.0)
        for k in range(3):
            box(PAL["oak"], -21.5, -21.49, y + 0.1, y + 0.78, 5.05 + k * 0.65, 5.65 + k * 0.65)
        b.cyl(PAL["cream"], 0.1, (X(-21.72), y + 0.85, Z(5.4)), (X(-21.72), y + 1.15, Z(5.4)), seg=10)
        b.cyl(PAL["pendant"], 0.14, (X(-21.72), y + 1.15, Z(5.4)), (X(-21.72), y + 1.35, Z(5.4)), seg=12, r2=0.1)
        REG.end()
        solid(-21.95, -21.5, y, y + 0.85, 5.0, 7.0)
        for zc in (1.62, 10.58):
            floor_lamp(b, PAL, X(-21.62), Z(zc), y)
        for (k, zc) in enumerate((0.6, 11.4)):
            potted_plant(b, PAL, X(-16.8), Z(zc), y, seed=k + 7 * (s > 0))
    elif name == "apotrolle":
        floor(PAL["white"], BACK, INNER, z0, z1)
        counter(b, PAL, X(-21.5), X(-20.7), Z(15), Z(21), y, PAL["white"], PAL["green"])
        # bottle shelves on the hall-side wall, either side of its doorway (z 19)
        for (za, zb, sd) in ((12.5, 17.5, 1), (22.5, 25.5, 2)):
            shelf_wall(b, PAL, X(INNER), Z(za), Z(zb), y, -s, rows=4, seed=int(cz) + sd, d=0.7)
        words(18, y + 2.7, 2.4, 0.8, ["Apotrolle"], fg="green", bg="white")
        # the green cross over the partition doorway (x -19) at the row's z1
        zc = z1
        REG.begin(b, "cross@%.0f,%.0f" % (X(-19), Z(zc)))
        box(PAL["cross"], -19.08, -18.92, y + 2.9, y + 3.5, zc - 0.3, zc + 0.3)
        box(PAL["cross"], -19.08, -18.92, y + 3.1, y + 3.3, zc - 0.8, zc + 0.8)
        box(PAL["cross"], -19.4, -18.6, y + 3.1, y + 3.3, zc - 0.1, zc + 0.1)
        REG.end()
        # phase 3: the till and a box display on the counter, Rezepte over it, Notdienst by the door,
        # a waiting bench on the back wall
        REG.begin(b, "till@%.1f,%.1f" % (X(-21.1), Z(20.3)))
        box(PAL["dark"], -21.3, -20.9, y + 1.1, y + 1.35, 20.0, 20.6)
        REG.end()
        REG.begin(b, "display@%.1f,%.1f" % (X(-21.1), Z(15.8)))
        for k in range(4):
            box(PAL[["white", "cyan", "pink", "green"][k]], -21.35, -20.85, y + 1.1 + k * 0.07, y + 1.16 + k * 0.07, 15.3 + k * 0.05, 16.3 - k * 0.05)
        REG.end()
        words(18, y + 1.75, 1.4, 0.26, ["Rezepte"], fg="white", bg="green")
        words(19, y + 2.95, 1.6, 0.36, ["Notdienst"], fg="white", bg="roundel", wall=INNER)
        REG.begin(b, "waitbench@%.1f,%.1f" % (X(-21.7), Z(23.7)))
        box(PAL["steel"], -21.95, -21.4, y + 0.42, y + 0.46, 22.6, 24.8)
        box(PAL["stripe"], -21.95, -21.85, y + 0.46, y + 0.9, 22.6, 24.8)
        for k in range(3):
            zc = 22.95 + k * 0.75
            box(PAL["green"], -21.85, -21.42, y + 0.46, y + 0.52, zc - 0.32, zc + 0.32)
        for zl in (22.7, 24.7):
            box(PAL["black"], -21.9, -21.45, y, y + 0.42, zl - 0.03, zl + 0.03)
        REG.end()
        solid(-21.95, -21.4, y, y + 0.9, 22.6, 24.8)
    elif name == "books":
        floor(PAL["oak"], BACK, INNER, z0, z1)
        shelf_wall(b, PAL, X(BACK), Z(28), Z(38), y, s, rows=4, seed=int(cz), d=0.6)
        shelf_wall(b, PAL, X(INNER), Z(34.5), Z(39), y, -s, rows=4, seed=int(cz) + 1, d=0.7)
        table(-20.7, 30.0, 1.0, 2.0, 0.8, PAL["oak"])
        words(39.0, y + 2.9, 1.6, 0.5, ["Bücher"], fg="black", bg="cream")
        words(33, y + 2.6, 2.4, 0.3, ["Trollstoi  ·  Krieg und Grinsen"], fg="black", face=None)
        # phase 3: new titles stacked on the table, an armchair and a lamp to read by, the ladder
        REG.begin(b, "stacks@%.1f,%.1f" % (X(-20.7), Z(30.0)))
        for k in range(6):
            zc = 29.3 + (k % 3) * 0.6
            xc = -20.95 if k < 3 else -20.45
            hgt = 0.08 + 0.05 * ((k * 7) % 4)
            box(PAL[["red", "stripe", "green", "orange", "purple", "cyan"][k]], xc - 0.15, xc + 0.15, y + 0.8, y + 0.8 + hgt, zc - 0.2, zc + 0.2)
        REG.end()
        REG.begin(b, "armchair@%.1f,%.1f" % (X(-17.2), Z(28.6)))
        box(PAL["olive"], -17.6, -16.8, y + 0.15, y + 0.45, 28.2, 29.0)
        box(PAL["olive"], -16.95, -16.8, y + 0.45, y + 1.0, 28.2, 29.0)
        for ze in (28.2, 28.85):
            box(PAL["olive"], -17.6, -16.8, y + 0.15, y + 0.65, ze, ze + 0.15)
        box(PAL["dark"], -17.55, -16.85, y, y + 0.15, 28.25, 28.95)
        REG.end()
        solid(-17.6, -16.8, y, y + 1.0, 28.2, 29.0)
        floor_lamp(b, PAL, X(-16.75), Z(27.5), y)
        REG.begin(b, "ladder@%.1f,%.1f" % (X(-21.15), Z(31.75)))
        for e in (-1, 1):
            b.cyl(PAL["oak"], 0.02, (X(-20.9), y, Z(31.75 + e * 0.22)), (X(-21.38), y + 2.15, Z(31.75 + e * 0.22)), seg=6)
        for k in range(1, 7):
            t = k / 7
            xx, yy = -20.9 + (-21.38 + 20.9) * t, y + 2.15 * t
            b.cyl(PAL["oak"], 0.012, (X(xx), yy, Z(31.53)), (X(xx), yy, Z(31.97)), seg=4)
        REG.end()
        solid(-21.4, -20.88, y, y + 2.15, 31.5, 32.0)
    # shop signs over the partition doorways
    name_ = {"purple": "Lila Salon" if s > 0 else "Roter Salon"}.get(name)
    if name_:
        for (zz, nz) in ((z0 + 0.15, 1), (z1 - 0.15, -1)):
            if abs(zz) > 39:
                continue
            sign(b, PAL, (X(-19), y + 2.75, Z(zz)), (0, 0, s * nz), 1.7, 0.3, [name_], fg="white", bg="roundelblue", o=0.0, pad=0.03,
                 sid="shopsign@%.0f,%.1f/%+d" % (X(-19), Z(zz), s * nz))


def build_shops(PAL):
    b = Builder()
    for s in (1, -1):
        for (z0, z1, name) in SHOPS_W:
            dress_shop(b, PAL, name, z0, z1, s)
    b.finish("ug-shops.glb", bake=False, uv2=1024, quantize=True)

