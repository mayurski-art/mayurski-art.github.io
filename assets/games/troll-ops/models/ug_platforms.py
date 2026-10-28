"""
Undergrin's platforms (ug-platforms.glb): the platform slabs, their dark
faces, the edge (coping, the yellow line, the ribbed guidance strip, Abstand
halten on the floor), the 1 m tile lines, the bore floors with ballast,
sleepers, rails and their clips, the buffer stop, the bore-end and nose
stairs, the walkway and corridor floors, the plant room floor; and, from
phase 2 of "Troll Forces: Undergrin in Blender", the platform halls'
furniture (moved here from ug_concourse): tube lights, name boards,
roundels, posters, benches (the island's pair now one double bench),
vending, the Zugzielanzeiger over every platform, Fahrplan cases, SOS
columns, bins, speakers, cameras and the Gleis plates. See ug_kit.py.
"""
from ug_kit import *  # noqa: F401,F403
from ug_concourse import hanging_sign  # noqa: E402

GLEIS = {"W": 1, "E": 2}                       # each half's own: its W bore is Gleis 1
ZIEL = {"W": ("TROLLHALLA", "2"), "E": ("TROLL BEACH", "4")}


# ================================================================ helpers

@registered("dfi")
def dfi_display(b, PAL, x, z, y, side, w=2.2, y_ceil=SLAB0 - 0.33):
    """A Zugzielanzeiger hung across the platform on two rods, readable from
    both ends: a dark 0.16 deep case, a black screen a face, the line badge
    (G, white on blue) and the next train in the board's orange LEDs, its
    track's Gleis number and the minutes, the train after it below."""
    h = 0.5
    bx(b, PAL["dark"], x - w / 2, x + w / 2, y, y + h, z - 0.08, z + 0.08)
    ziel, mins = ZIEL[side]
    for sgn in (-1, 1):
        n = (0, 0, sgn)
        fc = Vector((x, y + h / 2, z + sgn * 0.08))
        Uv, Vv = frame(n)
        panel(b, PAL["black"], fc, n, w - 0.08, h - 0.08, o=0.002)
        REG.face("dfi@%.1f,%.1f/%+d" % (x, z, sgn), "@self", fc, n, w, h)
        badge = fc - Uv * (w / 2 - 0.2) + Vv * 0.06
        sign(b, PAL, badge, n, 0.22, 0.22, ["G"], fg="white", bg="stripe", o=0.004, pad=0.02, face=None,
             sid="dfi@%.1f,%.1f/%+d/G" % (x, z, sgn))
        text(b, PAL["board_o"], ziel, badge + Uv * 0.18, n, 0.12, o=0.006, align="l")
        text(b, PAL["board_o"], mins + " MIN", fc + Uv * (w / 2 - 0.08) + Vv * 0.06, n, 0.12, o=0.006, align="r")
        text(b, PAL["board_o"], "GLEIS %d" % GLEIS[side], fc - Uv * (w / 2 - 0.1) - Vv * 0.13, n, 0.07, o=0.006, align="l")
        text(b, PAL["board_o"], "JEETSBURG  " + str(int(mins) + 5), fc + Uv * (w / 2 - 0.08) - Vv * 0.13, n, 0.07, o=0.006, align="r")
    for rx in (-w / 2 + 0.25, w / 2 - 0.25):
        b.cyl(PAL["black"], 0.018, (x + rx, y + h, z), (x + rx, y_ceil, z), seg=6)
        bx(b, PAL["black"], x + rx - 0.06, x + rx + 0.06, y_ceil - 0.02, y_ceil, z - 0.06, z + 0.06)


@registered("fahrplan")
def fahrplan_case(b, PAL, c, normal, side):
    """The timetable in its wall case: a steel frame 0.8 x 1.1, 0.06 deep,
    the white sheet with Fahrplan, the line badge and the minute rows."""
    w, h = 0.8, 1.1
    wbx(b, PAL["steel"], c, normal, w, h, 0.05)
    Uv, Vv = frame(normal)
    fc = Vector(c) + Vector(normal) * 0.05
    panel(b, PAL["white"], fc, normal, w - 0.06, h - 0.06, o=0.002)
    REG.face("fahrplan@%.1f,%.1f,%.1f" % tuple(c), "@self", fc, normal, w, h)
    sign(b, PAL, fc + Vv * 0.44, normal, 0.6, 0.12, ["Fahrplan"], fg="black", o=0.004, pad=0.01, face=None,
         sid="fahrplan@%.1f,%.1f,%.1f/t" % tuple(c))
    sign(b, PAL, fc + Vv * 0.32 - Uv * 0.27, normal, 0.12, 0.1, ["G"], fg="white", bg="stripe", o=0.004, pad=0.01, face=None,
         sid="fahrplan@%.1f,%.1f,%.1f/G" % tuple(c))
    sign(b, PAL, fc + Vv * 0.32 + Uv * 0.07, normal, 0.5, 0.09, ["Richtung " + ZIEL[side][0].title()], fg="black", o=0.004, pad=0.005,
         face=None, align="l", sid="fahrplan@%.1f,%.1f,%.1f/r" % tuple(c))
    # the hours down the left, the minutes in grey rows (too small to read, as on the real sheets)
    for k in range(14):
        v = 0.22 - k * 0.055
        rect(b, PAL["stripe"], fc + Vector(normal) * 0.004, Uv, Vv, -0.34, -0.27, v - 0.018, v + 0.018)
        for j in range(8):
            u = -0.22 + j * 0.07
            rect(b, PAL["grey"], fc + Vector(normal) * 0.004, Uv, Vv, u, u + 0.045, v - 0.012, v + 0.012)
    x0, x1, y0, y1, z0, z1 = wall_box(c, normal, w, h, 0.05)
    collide(x0, x1, y0, y1, z0, z1, pen=2)


@registered("buffer")
def buffer_stop(b, PAL, x, z, facing):
    """A Prellbock at a bore's end: a red steel frame on the rails, the
    beam with its two buffers toward the train and the white chevrons, a
    lamp on top. facing: +-1 along z (the side the train comes from)."""
    f = facing
    za, zb = sorted((z, z + f * 0.7))
    prof = [(z, 0.12), (z, 1.0), (z + f * 0.25, 1.0), (z + f * 0.7, 0.12)]
    for rx in (-0.75, 0.75):
        b.prism(PAL["red"], prof if f > 0 else prof[::-1], x + rx - 0.08, x + rx + 0.08, axis="x")
    bx(b, PAL["red"], x - 1.2, x + 1.2, 0.62, 0.98, min(z + f * 0.05, z + f * 0.3), max(z + f * 0.05, z + f * 0.3))
    for (k, rx) in enumerate((-0.9, -0.45, 0.0, 0.45, 0.9)):
        panel(b, PAL["white"] if k % 2 == 0 else PAL["dark"], (x + rx, 0.8, z + f * 0.3), (0, 0, f), 0.4, 0.32, o=0.002)
    for rx in (-0.75, 0.75):
        b.cyl(PAL["black"], 0.17, (x + rx, 0.8, z + f * 0.3), (x + rx, 0.8, z + f * 0.62), seg=12)
        b.cyl(PAL["steel"], 0.2, (x + rx, 0.8, z + f * 0.62), (x + rx, 0.8, z + f * 0.66), seg=12)
    b.cyl(PAL["black"], 0.06, (x, 0.98, z + f * 0.15), (x, 1.18, z + f * 0.15), seg=8)
    b.cyl(PAL["roundel"], 0.07, (x, 1.18, z + f * 0.15), (x, 1.3, z + f * 0.15), seg=8)
    collide(x - 1.2, x + 1.2, 0.0, 1.0, za, zb)


# ============================================================== PLATFORMS

def station_platforms(b, PAL, s):
    X = lambda x: s * x
    Z = lambda z: s * z
    F = PAL["pfloor"]
    # slabs 0..0.95: west side, island, east side
    for (a, c) in ((-22, -14.25), (-9.75, 9.75), (14.25, 22)):
        bx(b, F, X(a), X(c), T, P, Z(-44), Z(-14))
    # dark platform faces toward the bores; the edge's coping, yellow line,
    # ribbed guidance strip and Abstand halten
    for (xe, sgn) in ((-14.25, 1), (-9.75, -1), (9.75, 1), (14.25, -1)):
        # face normal points into the bore: for x -14.25 the bore is at +x
        nx = sgn
        Uv, Vv = frame((s * nx, 0, 0))
        rect(b, PAL["dark"], Vector((X(xe) + s * nx * 0.005, 0, 0)), Uv, Vv, *sorted((-s * nx * Z(-44), -s * nx * Z(-14))), T + 0.02, P)
        # the coping's lip proud of the face, its top a lighter grey
        xa, xb = sorted((X(xe), X(xe) + s * nx * 0.04))
        bx(b, PAL["lightgrey"], xa, xb, P - 0.12, P + 0.004, Z(-44), Z(-14))
        inn = lambda d: X(xe) - s * nx * d
        ya, yb = sorted((inn(0.0), inn(0.12)))
        hrect(b, PAL["lightgrey"], ya, yb, Z(-44), Z(-14), P + 0.004)
        # the yellow line 0.12..0.45 in from the edge, the full length
        ya, yb = sorted((inn(0.12), inn(0.45)))
        hrect(b, PAL["yellow"], ya, yb, Z(-44), Z(-14), P + 0.004)
        # the guidance strip behind it: white, four ribs along the edge
        ya, yb = sorted((inn(0.5), inn(0.8)))
        hrect(b, PAL["white"], ya, yb, Z(-44), Z(-14), P + 0.005)
        for k in range(4):
            ya, yb = sorted((inn(0.53 + k * 0.07), inn(0.56 + k * 0.07)))
            hrect(b, PAL["lightgrey"], ya, yb, Z(-44), Z(-14), P + 0.007)
        # Abstand halten, twice per edge, inside the strip, reading for someone facing the track
        for zc in (-36, -22):
            sign(b, PAL, (inn(1.25), P + 0.009, Z(zc)), (0, 1, 0), 3.0, 0.42, ["Abstand halten"], fg="dark", o=0.0,
                 up=(s * nx, 0, 0), pad=0.02, face=None, sid="floor@%.2f,%.1f" % (inn(1.25), Z(zc)))
    # yellow zones: round the escalator foot and the west stair's foot
    hrect(b, PAL["yellow"], X(-8), X(8), Z(-31.5), Z(-25.5), P + 0.003)
    hrect(b, PAL["yellow"], X(-21.5), X(-17.5), Z(-44), Z(WSTAIR["foot"]), P + 0.003)
    # the 1 m tiles as paint lines, clear of the edge strips, the yellow zones and the escalators
    holes = [(-8, 8, -31.5, -25.5), (-21.5, -17.5, -44, WSTAIR["foot"]), (ESC_WELL[0], ESC_WELL[1], -25.5, -14)]
    for (a, c, ea, eb) in ((-22, -14.25, None, -14.25), (-9.75, 9.75, -9.75, 9.75), (14.25, 22, 14.25, None)):
        a1 = a + 0.9 if ea is not None and a == ea else a
        c1 = c - 0.9 if eb is not None and c == eb else c
        rs = [(a1, c1, -44.0, -14.0)]
        for h in holes:
            rs = sub_rects(rs, h)
        for (x0, x1, z0, z1) in rs:
            for k in range(math.ceil(x0), math.floor(x1) + 1):
                if x0 < k < x1:
                    hrect(b, PAL["floorline"], X(k) - 0.015, X(k) + 0.015, *sorted((Z(z0), Z(z1))), P + 0.008)
            for k in range(math.ceil(z0), math.floor(z1) + 1):
                if z0 < k < z1:
                    hrect(b, PAL["floorline"], *sorted((X(x0), X(x1))), Z(k) - 0.015, Z(k) + 0.015, P + 0.008)
    # bore floors: ballast flush with the track floor (y 0, what players walk
    # on), sleepers painted on it, rails 0..0.12 at +-0.75 where the
    # colliders have them, clipped to every sleeper: clear of the parked
    # train and the bore-end steps
    rails = {"W": [(-44, -42), (-16, 0)], "E": [(-40.5, 0)]}
    for side in ("W", "E"):
        a, c = BORE_W[side]
        bx(b, PAL["ballast"], X(a), X(c), T - 0.3, T + 0.01, Z(-44), Z(0))   # a hair over the engine's ground plane
        cx = BORE_CX[side]
        # the drain channel down the middle
        hrect(b, PAL["dark"], X(cx) - 0.12, X(cx) + 0.12, *sorted((Z(-44), Z(0))), T + 0.012)
        for (z0, z1) in rails[side]:
            for rx in (-0.75, 0.75):
                bx(b, PAL["rail"], X(cx + rx) - 0.06, X(cx + rx) + 0.06, T, T + 0.12, Z(z0), Z(z1))
                bx(b, PAL["dark"], X(cx + rx) - 0.035, X(cx + rx) + 0.035, T + 0.12, T + 0.125, Z(z0), Z(z1))
            k = 0.35
            while z0 + k < z1:
                z = z0 + k
                hrect(b, PAL["sleeper"], X(cx) - 1.25, X(cx) + 1.25, Z(z) - 0.12, Z(z) + 0.12, T + 0.014)
                for rx in (-0.75, 0.75):
                    for e in (-1, 1):
                        bx(b, PAL["black"], X(cx + rx) + e * 0.07, X(cx + rx) + e * 0.13, T + 0.014, T + 0.05, Z(z) - 0.06, Z(z) + 0.06)
                k += 0.7
    # the parked train's bore ends at a buffer stop
    buffer_stop(b, PAL, X(BORE_CX["W"]), Z(-43.9), s)
    # track-level lamps are concourse's business; nothing here
    # bore-end stairs: at the empty bore's north end (E for the north station) up to both platforms
    # two flights 3 wide centred z -42: from x 11.75 west up to the island
    # (x 9.75) and from 12.25 east up to the side platform, 4 x 0.2375 / 0.5
    za, zb = sorted((Z(-43.5), Z(-40.5)))
    steps_z(b, PAL, za, zb, X(11.75), 4, 0.2375, 0.5, -s, T)
    steps_z(b, PAL, za, zb, X(12.25), 4, 0.2375, 0.5, s, T)
    # the island's nose stair: foot on the walkway at z -12, top flush at z -14
    steps_x(b, PAL, min(X(-1.5), X(1.5)), max(X(-1.5), X(1.5)), Z(-12), 4, 0.2375, 0.5, -s, T)
    # the walkway floor and the corridor floor
    bx(b, PAL["floor"], X(-2), X(2), T, T + 0.02, Z(-14), Z(-8))
    bx(b, PAL["floor"], X(-22), X(-15.75), T, T + 0.02, Z(-12), Z(0))


# ================================================================ furniture

def platform_level(b, PAL, s):
    """Tube lights, name boards, roundels, posters, benches, vending (phase
    1's German words), and phase 2's: the Zugzielanzeiger, the Fahrplan
    cases, SOS columns, bins, speakers, cameras, the Gleis plates."""
    X = lambda x: s * x
    Z = lambda z: s * z
    for row_x in (-18.0, -12.0, 0.0, 12.0, 18.0):
        for k in range(10):
            z = -42.4 + k * 3.2
            if abs(row_x) < 1 and -28 < z < -17:
                continue
            tube_light(b, PAL, X(row_x), Z(z), SLAB0 - 0.33 - 0.02, along="x", L=1.5)
    for z in (-12, -6, -1):
        for side in ("W", "E"):
            tube_light(b, PAL, X(BORE_CX[side]), Z(z), 3.9, along="z", L=1.0)
    tube_light(b, PAL, X(0), Z(-11), 2.95, along="z", L=1.2)
    for z in (-10, -3):
        tube_light(b, PAL, X(-19), Z(z), SLAB0 - 0.02, along="x", L=1.2)
    for (x, z) in ((-6, -5), (6, -5), (-6, -1.5), (6, -1.5)):
        tube_light(b, PAL, X(x), Z(z), SLAB0 - 0.02, along="x", L=1.2)
    for (xw, nx) in ((-22, 1), (22, -1)):
        side = "W" if xw < 0 else "E"
        nrm = (s * nx, 0, 0)
        for zc in (-33.6, -20):
            sign(b, PAL, (X(xw), 2.5, Z(zc)), nrm, 3.0, 0.5, ["Undergrin"], fg="white", bg="roundelblue", o=0.02,
                 sid="nameboard@%.0f,%.1f" % (X(xw), Z(zc)))
        roundel(b, PAL, (X(xw), 2.5, Z(-27.6)), nrm, r=0.55)
        troll_poster(b, PAL, (X(xw), 2.4, Z(-30.6)), nrm, 1.0, 1.4, PAL["salmon"] if nx > 0 else PAL["stripe"], cells=22, o=0.02)
        panel(b, PAL["stripe"] if nx > 0 else PAL["salmon"], (X(xw), 2.4, Z(-23)), nrm, 1.0, 1.4, o=0.02)
        REG.face("poster@%.0f,%.1f,%.0f" % (X(xw), 2.4, Z(-23)), "wall", (X(xw), 2.4, Z(-23)), nrm, 1.0, 1.4)
        sign(b, PAL, (X(xw), 2.75, Z(-23)), nrm, 0.8, 0.5, ["GRINLINE"], fg="black", bg="white", o=0.03, face=None,
             sid="poster@%.0f,%.1f,%.0f/t" % (X(xw), 2.4, Z(-23)))
        panel(b, PAL["cream"], (X(xw), 2.1, Z(-16.5)), nrm, 1.0, 1.4, o=0.02)
        REG.face("poster@%.0f,%.1f,%.1f" % (X(xw), 2.1, Z(-16.5)), "wall", (X(xw), 2.1, Z(-16.5)), nrm, 1.0, 1.4)
        # Bitte zurückbleiben, as the trolls say it
        for (yy, word, col) in ((2.45, "Bitte", "black"), (2.1, "zurück-", "black"), (1.75, "grinsen", "salmon")):
            sign(b, PAL, (X(xw), yy, Z(-16.5)), nrm, 0.9, 0.32, [word], fg=col, o=0.03, face=None,
                 sid="poster@%.0f,%.1f,%.1f/%s" % (X(xw), 2.1, Z(-16.5), word))
        for zb in (-34, -20):
            bench(b, PAL, X(xw + nx * 0.9), Z(zb), P, along="z", L=1.8, back=-s * nx)
        vz = Z(-25)
        REG.begin(b, "vending@%.1f,%.0f" % (X(xw + nx * 0.8), vz))
        REG.face("vending@%.1f,%.0f" % (X(xw + nx * 0.8), vz), "@self", (X(xw + nx * 1.2), P + 1.3, vz), nrm, 0.7, 1.4)
        bx(b, PAL["red"], X(xw + nx * 0.4), X(xw + nx * 1.2), P, P + 2.0, vz - 0.5, vz + 0.5)
        panel(b, PAL["screen"], (X(xw + nx * 1.2), P + 1.25, vz), nrm, 0.6, 0.9, o=0.01)
        sign(b, PAL, (X(xw + nx * 1.2), P + 1.82, vz), nrm, 0.7, 0.18, ["GRINK"], fg="white", o=0.012, face=None,
             sid="vending@%.1f,%.0f/name" % (X(xw + nx * 0.8), vz))
        REG.end()
        # phase 2: the timetable between the poster and the roundel (a bin by the
        # vending machine stood in front of the GRINLINE poster: none there), the
        # PA, the board over the platform
        fahrplan_case(b, PAL, (X(xw), P + 1.5, Z(-29.1)), nrm, side)
        for zc in (-31.8, -17.6):
            speaker(b, PAL, (X(xw), P + 3.5, Z(zc)), nrm)
        dfi_display(b, PAL, X(xw + nx * 3.9), Z(-28), P + 2.55, side)
    # the east platform's far end: a second Fahrplan and bin, a camera
    fahrplan_case(b, PAL, (X(22), P + 1.5, Z(-38)), (-s, 0, 0), "E")
    litter_bin(b, PAL, X(21.1), Z(-36.4), P)
    cctv(b, PAL, (X(22), P + 3.6, Z(-30.2)), (-s, 0, 0))
    cctv(b, PAL, (X(-22), P + 3.6, Z(-30.2)), (s, 0, 0))
    roundel(b, PAL, (X(0), 3.3, Z(-44)), (0, 0, s), r=0.8)
    sign(b, PAL, (X(0), 2.0, Z(-44)), (0, 0, s), 3.6, 0.6, ["Undergrin"], fg="white", o=0.02, sid="endname@%.0f" % Z(-44))
    exit_sign(b, PAL, (X(12), 3.0, Z(-44)), (0, 0, s))
    exit_sign(b, PAL, (X(-19.5), 3.2, Z(-44)), (0, 0, s))
    # the Gleis plates over the bores on the end wall
    for side in ("W", "E"):
        sign(b, PAL, (X(BORE_CX[side]), 4.25, Z(-44)), (0, 0, s), 1.3, 0.42, ["Gleis %d" % GLEIS[side]], fg="black", bg="white",
             o=0.02, pad=0.05, sid="gleis@%.0f,%.0f" % (X(BORE_CX[side]), Z(-44)))
    for xc in (-7.5, 7.5):
        cctv(b, PAL, (X(xc), 4.6, Z(-44)), (0, 0, s))
    hanging_sign(b, PAL, (X(0), SLAB0 - 1.0, Z(-31)), "z", 3.0, ["GRINLINE"], SLAB0 - 0.34)
    hanging_sign(b, PAL, (X(0), SLAB0 - 1.0, Z(-15.5)), "z", 3.0, ["Technikraum"], SLAB0 - 0.34)
    exit_sign(b, PAL, (X(0), 2.6, Z(-14)), (0, 0, -s))
    # the island: one double bench (the old back-to-back pair overlapped), its bins, the SOS columns, a board per track
    double_bench(b, PAL, X(0), Z(-32), P)
    for sx in (-1, 1):
        litter_bin(b, PAL, X(sx * 1.75), Z(-32), P)
        sos_pillar(b, PAL, X(sx * 3.6), Z(-41.6), P, (0, s))
        dfi_display(b, PAL, X(sx * 7.9), Z(-37.5), P + 2.55, "W" if sx < 0 else "E")
    for x in (-6, 6):
        bench(b, PAL, X(x), Z(-28), P, along="z", L=2.0, back=s * (1 if x > 0 else -1))
    for (cxp, cz) in COLS:
        if cz == -22:
            roundel(b, PAL, (X(cxp) - s * (1 if cxp > 0 else -1) * 0.35, 2.4, Z(cz)), (-s * (1 if cxp > 0 else -1), 0, 0), r=0.3)


def build_platforms(PAL):
    b = Builder()
    for s in (1, -1):
        station_platforms(b, PAL, s)
        platform_level(b, PAL, s)
    # the plant room floor
    bx(b, PAL["floor"], -9.75, 9.75, T, T + 0.02, -8, 8)
    b.finish("ug-platforms.glb", bake=False, uv2=2048, quantize=True)
