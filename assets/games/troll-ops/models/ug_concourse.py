"""
Undergrin's concourse and platform furniture (ug-concourse.glb): tube
lights, name boards, roundels, posters, benches, vending machines, EXIT and
hanging signs, the photo booth and ticket machines, the ticket gates and
their boxes, the departure board, pendants, the clock, the information
desk and the newsstand. See ug_kit.py.
"""
from ug_kit import *  # noqa: F401,F403


# ============================================================== CONCOURSE

@registered("gate")
def ticket_gate(b, PAL, x, z, y, along_x=True):
    """A gate cabinet 0.3 (x) x 1.2 (z) x 1.0 with glass paddles."""
    bx(b, PAL["dark"], x - 0.15, x + 0.15, y, y + 0.95, z - 0.6, z + 0.6)
    bx(b, PAL["white"], x - 0.17, x + 0.17, y + 0.95, y + 1.0, z - 0.62, z + 0.62)
    panel(b, PAL["exit"], (x, y + 1.0, z), (0, 1, 0), 0.12, 0.3, o=0.004)
    panel(b, PAL["glass"], (x + 0.22, y + 0.95, z), (1, 0, 0), 0.5, 0.5, o=0.0)
    panel(b, PAL["glass"], (x - 0.22, y + 0.95, z), (-1, 0, 0), 0.5, 0.5, o=0.0)


@registered("pendant")
def pendant(b, PAL, x, z, y_ceil, drop):
    y = y_ceil - drop
    b.cyl(PAL["black"], 0.02, (x, y_ceil, z), (x, y + 0.4, z), seg=4)
    b.frustum(PAL["dark"], 0.3, 0.3, 1.2, 1.2, y, y + 0.4, x=x, z=z)
    disc(b, PAL["pendant"], (x, y + 0.01, z), (0, -1, 0), 0.55, seg=12)


@registered("board")
def departure_board(b, PAL, x, z, y, facing):
    """GRINLINE departures: a dark box with lit orange + pink rows on both
    faces, hung on two rods."""
    w, h, d = 6.0, 1.5, 0.3
    for nz in (-1, 1):
        REG.face("board@%.1f,%.1f/%+d" % (x, z, nz), "@self", (x, y + h / 2, z + nz * d / 2), (0, 0, nz), w, h)
    bx(b, PAL["black"], x - w / 2, x + w / 2, y, y + h, z - d / 2, z + d / 2)
    rows = [("GRINLINE", "board_o", 0.2), ("TROLLHALLA  2", "board_p", 0.15), ("JEETSBURG   5", "board_o", 0.15),
            ("DUST BOWL   9", "board_o", 0.15), ("GRIN BEACH 14", "board_o", 0.15)]
    for nz in (-1, 1):
        yy = y + h - 0.25
        for (txt, mname, hh) in rows if nz == facing else rows[:1]:
            text(b, PAL[mname], txt, (x, yy, z + nz * d / 2), (0, 0, nz), hh, o=0.012)
            yy -= 0.27
    for rx in (-2.4, 2.4):
        b.cyl(PAL["black"], 0.02, (x + rx, y + h, z), (x + rx, ATRIUM_CEIL, z), seg=4)


@registered("clock")
def clock(b, PAL, c, normal):
    REG.face("clock@%.1f,%.1f,%.1f" % tuple(c), "@self", c, normal, 1.4, 1.4)
    disc(b, PAL["white"], c, normal, 0.7, seg=24, o=0.05)
    ring(b, PAL["black"], c, normal, 0.64, 0.7, seg=24, o=0.06)
    Uv, Vv = frame(normal)
    o3 = Vector(c) + Vector(normal) * 0.07
    rect(b, PAL["black"], o3, Uv, Vv, -0.03, 0.03, -0.08, 0.5)
    rect(b, PAL["black"], o3, Uv, Vv, -0.08, 0.36, -0.025, 0.025)


@registered("booth")
def photo_booth(b, PAL, x, z, y, facing):
    """1.5 square, 2.3 tall (its collider)."""
    REG.face("booth@%.1f,%.1f" % (x, z), "@self", (x, y + 1.2, z + facing * 0.75), (0, 0, facing), 1.4, 2.2)
    bx(b, PAL["dark"], x - 0.75, x + 0.75, y, y + 2.3, z - 0.75, z + 0.75)
    panel(b, PAL["red"], (x, y + 0.95, z + facing * 0.75), (0, 0, facing), 0.8, 1.9, o=0.01)
    panel(b, PAL["white"], (x, y + 2.08, z + facing * 0.75), (0, 0, facing), 1.3, 0.3, o=0.01)
    text(b, PAL["black"], "PHOTO", (x, y + 2.08, z + facing * 0.75), (0, 0, facing), 0.16, o=0.02)


@registered("ticketmachine")
def ticket_machine(b, PAL, x, z, y, facing):
    REG.face("ticketmachine@%.1f,%.1f" % (x, z), "@self", (x, y + 1.05, z + facing * 0.3), (0, 0, facing), 0.8, 1.5)
    bx(b, PAL["stripe"], x - 0.4, x + 0.4, y, y + 1.9, z - 0.3, z + 0.3)
    panel(b, PAL["screen"], (x, y + 1.3, z + facing * 0.3), (0, 0, facing), 0.5, 0.35, o=0.01)
    panel(b, PAL["white"], (x, y + 0.75, z + facing * 0.3), (0, 0, facing), 0.6, 0.5, o=0.01)
    text(b, PAL["black"], "TICKETS", (x, y + 1.7, z + facing * 0.3), (0, 0, facing), 0.1, o=0.012)


@registered("newsstand")
def newsstand(b, PAL, x, z, y):
    """3 x 2.4 kiosk: counter, roof, magazine rack, GRIN NEWS sign."""
    bx(b, PAL["olive"], x - 1.5, x + 1.5, y, y + 1.1, z - 1.2, z + 1.2)
    bx(b, PAL["oak"], x - 1.55, x + 1.55, y + 1.1, y + 1.16, z - 1.25, z + 1.25)
    for (px, pz) in ((-1.4, -1.1), (1.4, -1.1), (-1.4, 1.1), (1.4, 1.1)):
        bx(b, PAL["dark"], x + px - 0.05, x + px + 0.05, y + 1.16, y + 2.6, z + pz - 0.05, z + pz + 0.05)
    bx(b, PAL["red"], x - 1.7, x + 1.7, y + 2.6, y + 2.85, z - 1.4, z + 1.4)
    for nz in (-1, 1):
        text(b, PAL["white"], "GRIN NEWS", (x, y + 2.72, z + nz * 1.4), (0, 0, nz), 0.17, o=0.012)
        REG.face("news@%.1f,%.1f/z%+d" % (x, z, nz), "@self", (x, y + 2.72, z + nz * 1.4), (0, 0, nz), 3.4, 0.25)
        rng = random.Random(int(x * 7 + z + nz))
        for k in range(6):
            col = rng.choice(["orange", "pink", "cyan", "green", "yellow", "white"])
            panel(b, PAL[col], (x - 1.25 + k * 0.5, y + 0.7, z + nz * 1.2), (0, 0, nz), 0.4, 0.55, o=0.01)
    for nx in (-1, 1):
        text(b, PAL["white"], "NEWS", (x + nx * 1.7, y + 2.72, z), (nx, 0, 0), 0.17, o=0.012)
        REG.face("news@%.1f,%.1f/x%+d" % (x, z, nx), "@self", (x + nx * 1.7, y + 2.72, z), (nx, 0, 0), 2.8, 0.25)


@registered("infodesk")
def info_desk(b, PAL, x, z, y):
    bx(b, PAL["white"], x - 1.5, x + 1.5, y, y + 1.05, z - 1.0, z + 1.0)
    bx(b, PAL["dark"], x - 1.55, x + 1.55, y + 1.05, y + 1.12, z - 1.05, z + 1.05)
    for nz in (-1, 1):
        panel(b, PAL["stripe"], (x, y + 0.6, z + nz * 1.0), (0, 0, nz), 2.6, 0.5, o=0.01)
        text(b, PAL["white"], "INFORMATION", (x, y + 0.6, z + nz * 1.0), (0, 0, nz), 0.2, o=0.02)
        REG.face("info@%.1f,%.1f/%+d" % (x, z, nz), "@self", (x, y + 0.6, z + nz * 1.0), (0, 0, nz), 2.6, 0.5)
    b.cyl(PAL["steel"], 0.03, (x, y + 1.12, z), (x, y + 2.8, z), seg=6)
    disc(b, PAL["stripe"], (x, y + 3.1, z), (0, 0, 1), 0.35, seg=16, o=0.0)
    disc(b, PAL["stripe"], (x, y + 3.1, z), (0, 0, -1), 0.35, seg=16, o=0.0)
    text(b, PAL["white"], "I", (x, y + 3.1, z), (0, 0, 1), 0.35, o=0.01)
    text(b, PAL["white"], "I", (x, y + 3.1, z), (0, 0, -1), 0.35, o=0.01)


@registered("sign")
def hanging_sign(b, PAL, c, normal_axis, w, lines, y_ceil, bg="roundelblue", fg="white"):
    """A double-sided blue direction sign hung from the ceiling."""
    x, y, z = c
    h = 0.22 * len(lines) + 0.12
    for sgn in (-1, 1):
        n = (0, 0, sgn) if normal_axis == "z" else (sgn, 0, 0)
        REG.face("sign@%.1f,%.1f,%.1f/%+d" % (x, y, z, sgn), "@self", (x + n[0] * 0.03, y + h / 2, z + n[2] * 0.03), n, w, h)
    if normal_axis == "z":
        bx(b, PAL[bg], x - w / 2, x + w / 2, y, y + h, z - 0.03, z + 0.03)
        for nz in (-1, 1):
            yy = y + h - 0.17
            for ln in lines:
                text(b, PAL[fg], ln, (x, yy, z + nz * 0.03), (0, 0, nz), 0.15, o=0.012)
                yy -= 0.22
    else:
        bx(b, PAL[bg], x - 0.03, x + 0.03, y, y + h, z - w / 2, z + w / 2)
        for nx in (-1, 1):
            yy = y + h - 0.17
            for ln in lines:
                text(b, PAL[fg], ln, (x + nx * 0.03, yy, z), (nx, 0, 0), 0.15, o=0.012)
                yy -= 0.22
    for rx in (-w / 2 + 0.2, w / 2 - 0.2):
        if normal_axis == "z":
            b.cyl(PAL["black"], 0.015, (x + rx, y + h, z), (x + rx, y_ceil, z), seg=4)
        else:
            b.cyl(PAL["black"], 0.015, (x, y + h, z + rx), (x, y_ceil, z + rx), seg=4)


def station_concourse(b, PAL, s):
    X = lambda x: s * x
    Z = lambda z: s * z
    # --- platform level: tube lights in three rows, station name boards, roundels, posters, benches, vending
    for row_x in (-18.0, -12.0, 0.0, 12.0, 18.0):
        for k in range(10):
            z = -42.4 + k * 3.2
            if abs(row_x) < 1 and -28 < z < -17:
                continue
            tube_light(b, PAL, X(row_x), Z(z), SLAB0 - 0.33 - 0.02, along="x", L=1.5)
    # bulkhead lamps down the tunnels and in the walkway / corridor / plant room
    for z in (-12, -6, -1):
        for side in ("W", "E"):
            tube_light(b, PAL, X(BORE_CX[side]), Z(z), 3.9, along="z", L=1.0)
    tube_light(b, PAL, X(0), Z(-11), 2.95, along="z", L=1.2)
    for z in (-10, -3):
        tube_light(b, PAL, X(-19), Z(z), SLAB0 - 0.02, along="x", L=1.2)
    for (x, z) in ((-6, -5), (6, -5), (-6, -1.5), (6, -1.5)):
        tube_light(b, PAL, X(x), Z(z), SLAB0 - 0.02, along="x", L=1.2)
    # UNDERGRIN name boards on the side-platform back walls (white on blue), roundels, posters
    for (xw, nx) in ((-22, 1), (22, -1)):
        nrm = (s * nx, 0, 0)
        for zc in (-33.6, -20):
            panel(b, PAL["roundelblue"], (X(xw), 2.5, Z(zc)), nrm, 3.0, 0.5, o=0.02)
            REG.face("nameboard@%.0f,%.1f" % (X(xw), Z(zc)), "wall", (X(xw), 2.5, Z(zc)), nrm, 3.0, 0.5)
            text(b, PAL["white"], "UNDERGRIN", (X(xw), 2.5, Z(zc)), nrm, 0.32, o=0.035)
        roundel(b, PAL, (X(xw), 2.5, Z(-27.6)), nrm, r=0.55)
        troll_poster(b, PAL, (X(xw), 2.4, Z(-30.6)), nrm, 1.0, 1.4, PAL["salmon"] if nx > 0 else PAL["stripe"], cells=22, o=0.02)
        # a colour-block poster: GRINLINE in two tones
        panel(b, PAL["stripe"] if nx > 0 else PAL["salmon"], (X(xw), 2.4, Z(-23)), nrm, 1.0, 1.4, o=0.02)
        REG.face("poster@%.0f,%.1f,%.0f" % (X(xw), 2.4, Z(-23)), "wall", (X(xw), 2.4, Z(-23)), nrm, 1.0, 1.4)
        panel(b, PAL["white"], (X(xw), 2.75, Z(-23)), nrm, 0.8, 0.5, o=0.03)
        text(b, PAL["black"], "GRINLINE", (X(xw), 2.75, Z(-23)), nrm, 0.14, o=0.04)
        panel(b, PAL["cream"], (X(xw), 2.1, Z(-16.5)), nrm, 1.0, 1.4, o=0.02)
        REG.face("poster@%.0f,%.1f,%.1f" % (X(xw), 2.1, Z(-16.5)), "wall", (X(xw), 2.1, Z(-16.5)), nrm, 1.0, 1.4)
        text(b, PAL["black"], "MIND", (X(xw), 2.45, Z(-16.5)), nrm, 0.22, o=0.035)
        text(b, PAL["black"], "THE", (X(xw), 2.1, Z(-16.5)), nrm, 0.22, o=0.035)
        text(b, PAL["salmon"], "GRIN", (X(xw), 1.75, Z(-16.5)), nrm, 0.22, o=0.035)
        # benches (0.6 x 1.8 at x +-21.1) and a vending machine (x +-20.8..21.6, z -25) against the wall
        for zb in (-34, -20):
            bench(b, PAL, X(xw + nx * 0.9), Z(zb), P, along="z", L=1.8, back=-s * nx)
        vz = Z(-25)
        REG.begin(b, "vending@%.1f,%.0f" % (X(xw + nx * 0.8), vz))
        REG.face("vending@%.1f,%.0f" % (X(xw + nx * 0.8), vz), "@self", (X(xw + nx * 1.2), P + 1.3, vz), nrm, 0.7, 1.4)
        bx(b, PAL["red"], X(xw + nx * 0.4), X(xw + nx * 1.2), P, P + 2.0, vz - 0.5, vz + 0.5)
        panel(b, PAL["screen"], (X(xw + nx * 1.2), P + 1.25, vz), nrm, 0.6, 0.9, o=0.01)
        text(b, PAL["white"], "GRINK", (X(xw + nx * 1.2), P + 1.82, vz), nrm, 0.12, o=0.012)
        REG.end()
    # the end wall: a big roundel and TROLLHALLA, plus EXIT over the bore-end stairs
    roundel(b, PAL, (X(0), 3.3, Z(-44)), (0, 0, s), r=0.8)
    text(b, PAL["white"], "UNDERGRIN", (X(0), 2.0, Z(-44)), (0, 0, s), 0.45, o=0.02)
    REG.face("endname@%.0f" % Z(-44), "wall", (X(0), 2.0, Z(-44)), (0, 0, s), text_width("UNDERGRIN", 0.45), 0.5)
    exit_sign(b, PAL, (X(12), 3.0, Z(-44)), (0, 0, s))
    exit_sign(b, PAL, (X(-19.5), 3.2, Z(-44)), (0, 0, s))
    # hanging direction signs on the island: to the trains, up to the concourse
    hanging_sign(b, PAL, (X(0), SLAB0 - 1.0, Z(-31)), "z", 3.0, ["GRINLINE"], SLAB0 - 0.34)
    hanging_sign(b, PAL, (X(0), SLAB0 - 1.0, Z(-15.5)), "z", 3.0, ["PLANT ROOM"], SLAB0 - 0.34)
    exit_sign(b, PAL, (X(0), 2.6, Z(-14)), (0, 0, -s))
    # island benches: back to back at z -32, and along z beside the x +-6 columns at z -28
    bench(b, PAL, X(0), Z(-32.22), P, along="x", back=s)
    bench(b, PAL, X(0), Z(-31.78), P, along="x", back=-s)
    for x in (-6, 6):
        bench(b, PAL, X(x), Z(-28), P, along="z", L=2.0, back=s * (1 if x > 0 else -1))
    # on the island columns: roundels on the inner faces at z -22 columns
    for (cxp, cz) in COLS:
        if cz == -22:
            roundel(b, PAL, (X(cxp) - s * (1 if cxp > 0 else -1) * 0.35, 2.4, Z(cz)), (-s * (1 if cxp > 0 else -1), 0, 0), r=0.3)
    # --- concourse: the hall
    for x in (-10, 10):
        bench(b, PAL, X(x), Z(-30), U, along="x", back=-s)
    photo_booth(b, PAL, X(-6), Z(-20), U, s)
    ticket_machine(b, PAL, X(6.0), Z(-20), U, s)
    ticket_machine(b, PAL, X(7.0), Z(-20), U, s)
    # posters on the hall's long walls between the doorways, roundels, EXITs over the doors
    for sx in (-1, 1):
        wx = X(sx * 16)
        nrm = (-s * sx, 0, 0)
        troll_poster(b, PAL, (wx, U + 2.0, Z(-37)), nrm, 1.2, 1.7, PAL["yellow"] if sx < 0 else PAL["cyan"], cells=24, o=0.02)
        panel(b, PAL["cyan"] if sx < 0 else PAL["yellow"], (wx, U + 2.0, Z(-26)), nrm, 1.2, 1.7, o=0.02)
        REG.face("poster@%.0f,%.1f,%.0f" % (wx, U + 2.0, Z(-26)), "wall", (wx, U + 2.0, Z(-26)), nrm, 1.2, 1.7)
        panel(b, PAL["black"], (wx, U + 2.0, Z(-26)), nrm, 0.9, 0.9, o=0.03)
        panel(b, PAL["cream"], (wx, U + 2.0, Z(-29.5)), nrm, 1.2, 1.7, o=0.02)
        REG.face("poster@%.0f,%.1f,%.1f" % (wx, U + 2.0, Z(-29.5)), "wall", (wx, U + 2.0, Z(-29.5)), nrm, 1.2, 1.7)
        if sx < 0:
            text(b, PAL["black"], "GRINLINE", (wx, U + 2.5, Z(-29.5)), nrm, 0.2, o=0.035)
            text(b, PAL["salmon"], "EVERY", (wx, U + 2.1, Z(-29.5)), nrm, 0.2, o=0.035)
            text(b, PAL["salmon"], "2 MIN", (wx, U + 1.75, Z(-29.5)), nrm, 0.2, o=0.035)
            text(b, PAL["black"], "PROBABLY", (wx, U + 1.4, Z(-29.5)), nrm, 0.14, o=0.035)
        else:
            text(b, PAL["salmon"], "MIND", (wx, U + 2.4, Z(-29.5)), nrm, 0.26, o=0.035)
            text(b, PAL["salmon"], "THE", (wx, U + 2.0, Z(-29.5)), nrm, 0.26, o=0.035)
            text(b, PAL["black"], "GRIN", (wx, U + 1.6, Z(-29.5)), nrm, 0.26, o=0.035)
        roundel(b, PAL, (wx, U + 4.2, Z(-22)), nrm, r=0.5)
        for zd in (-33, -19):
            exit_sign(b, PAL, (wx, U + 2.95, Z(zd)), nrm, w=0.6)
        exit_sign(b, PAL, (wx, U + 2.95, Z(-8)), nrm, w=0.6)
    # hall ceiling: tube lights are not needed under the skylight; two rows of pendants
    # at x +-5 (one row down the middle hung 3 m in front of the TRAINS: DOWN sign
    # below: rule 9, the obstruction test, phase 0)
    for x in (-5, 5):
        for z in (-36, -30, -24, -18):
            pendant(b, PAL, X(x), Z(z), vault_y(x) - 0.3, 2.6)
    # a hanging sign over the escalator top
    hanging_sign(b, PAL, (X(0), U + 3.2, Z(-21)), "z", 3.4, ["TRAINS: DOWN"], vault_y(0) - 0.22)
    # --- atrium (this half): the gate line at z -12, the staffed box, the board, pendants
    for k in range(6):
        ticket_gate(b, PAL, X(-7 + 2.8 * k), Z(-12), U)
    # the staffed boxes at x +-9: 1.5 square, 2.2 tall, a window all round
    for x in (-9, 9):
        REG.begin(b, "gatebox@%.0f,%.0f" % (X(x), Z(-12)))
        bx(b, PAL["white"], X(x) - 0.75, X(x) + 0.75, U, U + 1.1, Z(-12) - 0.75, Z(-12) + 0.75)
        bx(b, PAL["glass"], X(x) - 0.7, X(x) + 0.7, U + 1.1, U + 1.9, Z(-12) - 0.7, Z(-12) + 0.7)
        bx(b, PAL["stripe"], X(x) - 0.78, X(x) + 0.78, U + 1.9, U + 2.2, Z(-12) - 0.78, Z(-12) + 0.78)
        REG.end()
    departure_board(b, PAL, X(0), Z(-12), 9.5, s)
    bench(b, PAL, X(0), Z(-9), U, along="x")
    for x in (-8, 0, 8):
        pendant(b, PAL, X(x), Z(-6), ATRIUM_CEIL, 3.6)
    # a two-faced clock hung in the arch (the threshold is z -16..-15.5)
    cy = ARCH_SPRING + ARCH_SPAN / 2 - 1.2
    b.cyl(PAL["black"], 0.03, (X(0), ARCH_SPRING + ARCH_SPAN / 2, Z(-15.75)), (X(0), cy + 0.7, Z(-15.75)), seg=4)
    b.cyl(PAL["black"], 0.72, (X(0), cy, Z(-16)), (X(0), cy, Z(-15.5)), seg=24)
    clock(b, PAL, (X(0), cy, Z(-15.5)), (0, 0, s))
    clock(b, PAL, (X(0), cy, Z(-16)), (0, 0, -s))
    # posters on the threshold piers (atrium side)
    for sx in (-1, 1):
        troll_poster(b, PAL, (X(sx * 11.5), U + 2.2, Z(-15.5)), (0, 0, s), 1.4, 2.0, PAL["salmon"] if sx < 0 else PAL["stripe"], cells=26, o=0.02)
        roundel(b, PAL, (X(sx * 11.5), U + 4.4, Z(-15.5)), (0, 0, s), r=0.45)


def build_concourse(PAL):
    b = Builder()
    for s in (1, -1):
        station_concourse(b, PAL, s)
    info_desk(b, PAL, -9, 0, U)
    newsstand(b, PAL, 9, 0, U)
    # the light well's lip: a yellow hazard line round it on the atrium floor
    for (a, c, d, e) in ((-4.5, 4.5, -4.5, -4.1), (-4.5, 4.5, 4.1, 4.5), (-4.5, -4.1, -4.1, 4.1), (4.1, 4.5, -4.1, 4.1)):
        hrect(b, PAL["yellow"], a, c, d, e, U + 0.004)
    # tube lights down both shop rows
    for (sx, shops) in ((-1, SHOPS_W), (1, SHOPS_E)):
        for (z0, z1, name) in shops:
            for k in range(2):
                tube_light(b, PAL, sx * 19, z0 + (z1 - z0) * (0.3 + 0.4 * k), CEIL_SHOP - 0.02, along="z", L=1.4)
    b.finish("ug-concourse.glb", bake=False, uv2=2048)

