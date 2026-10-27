"""
Undergrin's concourse and platform furniture (ug-concourse.glb). Phase 1 of
"Troll Forces: Undergrin in Blender" builds the concourse at prop level: the
atrium (the Abfahrt board, the ticket gates and their Aufsicht boxes, the
information desk, the Grin-Kiosk, the light well's kerb, the clock, the
pendants, the floor's tile lines) and both halls (the Liniennetz board, the
Fotoautomat, the Fahrkarten machines, the safety cabinets, the SOS columns,
bins, speakers, cameras, two pigeons). Every sign's words are real German,
lettered at load (ug_kit sign(), maps/undergrin-signs.js); the board's LED
rows keep the 5 x 7 pixel font. The platform level's furniture here (tube
lights, name boards, benches, vending) is phase 2's; it gets its German
words now. See ug_kit.py.
"""
from ug_kit import *  # noqa: F401,F403


def arrow(b, m, c, normal, size, up=None, o=0.004):
    """A solid arrow `size` long pointing along the sign's up (up: the
    direction it points, in the sign's plane)."""
    Uv, Vv = frame(normal, up)
    cc = Vector(c) + Vector(normal) * o
    rect(b, m, cc, Uv, Vv, -size * 0.11, size * 0.11, -size * 0.5, size * 0.05)
    quad4(b, m, [cc - Uv * (size * 0.3) + Vv * size * 0.05, cc + Uv * (size * 0.3) + Vv * size * 0.05, cc + Vv * (size * 0.5)])


def arrow_sign(b, PAL, c, normal, w, h, lines, direction, fg="white", bg="roundelblue", o=0.02, face="wall", sid=None, pad=0.08):
    """A direction sign: the backing, a drawn arrow at its left end (down,
    up, left or right as the reader sees it; the DIN stack has no arrow
    glyphs everywhere) and the words in the rest."""
    Uv, Vv = frame(normal)
    d = {"down": -Vv, "up": Vv, "left": -Uv, "right": Uv}[direction]
    if bg is not None:
        panel(b, PAL[bg], c, normal, w, h, o=o)
    size = min(h - 2 * pad, 0.5) * 0.95
    ac = Vector(c) - Uv * (w / 2 - pad - size / 2)
    arrow(b, PAL[fg], ac, normal, size, up=tuple(d), o=o + 0.006)
    tw = w - size - pad
    sign(b, PAL, Vector(c) + Uv * ((size + pad) / 2), normal, tw, h, lines, fg=fg, o=o, pad=pad, face=None, sid=sid)
    if face:
        REG.face(sid or "sign@%.1f,%.1f,%.1f" % tuple(c), face, c, normal, w, h)


# ============================================================== the atrium

@registered("gate")
def ticket_gate(b, PAL, x, z, y):
    """A gate cabinet 0.3 (x) x 1.2 (z) x 1.0 (its collider): a stainless
    body on a black plinth, a dark top with the card reader and a screen at
    each end, a lit green arrow on each end face, the glass paddles open
    along its sides."""
    bx(b, PAL["black"], x - 0.14, x + 0.14, y, y + 0.05, z - 0.58, z + 0.58)
    bx(b, PAL["lightgrey"], x - 0.15, x + 0.15, y + 0.05, y + 0.92, z - 0.6, z + 0.6)
    for sx in (-1, 1):
        for zz in (-0.2, 0.2):
            panel(b, PAL["mid"], (x + sx * 0.15, y + 0.5, z + zz), (sx, 0, 0), 0.015, 0.8, o=0.002)
    bx(b, PAL["dark"], x - 0.17, x + 0.17, y + 0.92, y + 1.0, z - 0.62, z + 0.62)
    for e in (-1, 1):
        zc = z + e * 0.4
        panel(b, PAL["stripe"], (x, y + 1.0, zc), (0, 1, 0), 0.18, 0.18, o=0.003)
        ring(b, PAL["white"], (x, y + 1.0, zc), (0, 1, 0), 0.045, 0.06, seg=12, o=0.005)
        panel(b, PAL["screen"], (x, y + 1.0, z + e * 0.14), (0, 1, 0), 0.14, 0.1, o=0.003)
        c = (x, y + 0.74, z + e * 0.6)
        panel(b, PAL["black"], c, (0, 0, e), 0.24, 0.22, o=0.003)
        arrow(b, PAL["exit"], c, (0, 0, e), 0.16, o=0.006)
    for sx in (-1, 1):
        panel(b, PAL["glass"], (x + sx * 0.2, y + 0.95, z), (sx, 0, 0), 0.5, 0.5, o=0.0)
        panel(b, PAL["glass"], (x + sx * 0.2, y + 0.95, z), (-sx, 0, 0), 0.5, 0.5, o=0.0)
        bx(b, PAL["steel"], x + sx * 0.15, x + sx * 0.21, y + 0.68, y + 0.72, z - 0.25, z + 0.25)


@registered("gatebox")
def gate_box(b, PAL, x, z, y, s):
    """The staffed box at the end of the gate line, 1.5 square and 2.2
    tall (its collider): a white base with a blue kick band, a counter
    ledge with a speech grille on the atrium side, glass all round between
    corner posts, the Aufsicht fascia, the ticket-rule plate."""
    bx(b, PAL["white"], x - 0.75, x + 0.75, y, y + 1.1, z - 0.75, z + 0.75)
    for (nx, nz) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        c = (x + nx * 0.75, y + 0.08, z + nz * 0.75)
        panel(b, PAL["stripe"], c, (nx, 0, nz), 1.5, 0.16, o=0.003)
    bx(b, PAL["glass"], x - 0.7, x + 0.7, y + 1.1, y + 1.9, z - 0.7, z + 0.7)
    for (px, pz) in ((-0.72, -0.72), (0.72, -0.72), (-0.72, 0.72), (0.72, 0.72)):
        bx(b, PAL["dark"], x + px - 0.03, x + px + 0.03, y + 1.1, y + 1.9, z + pz - 0.03, z + pz + 0.03)
    for pz in (-0.72, 0.72):
        bx(b, PAL["dark"], x - 0.02, x + 0.02, y + 1.1, y + 1.9, z + pz - 0.025, z + pz + 0.025)
    bx(b, PAL["dark"], x - 0.74, x + 0.74, y + 1.1, y + 1.14, z - 0.74, z + 0.74)
    bx(b, PAL["stripe"], x - 0.75, x + 0.75, y + 1.9, y + 2.2, z - 0.75, z + 0.75)
    for nz in (-1, 1):
        sign(b, PAL, (x, y + 2.05, z + nz * 0.75), (0, 0, nz), 1.4, 0.26, ["Aufsicht"], fg="white", o=0.003,
             face="@self", sid="gatebox@%.0f,%.0f/%+d" % (x, z, nz))
    # the atrium side: the ledge, the grille, the plate
    n = s
    bx(b, PAL["dark"], x - 0.5, x + 0.5, y + 1.06, y + 1.1, z + n * 0.75, z + n * 0.85)
    disc(b, PAL["black"], (x + 0.4, y + 1.4, z + n * 0.7), (0, 0, n), 0.07, seg=12, o=0.004)
    sign(b, PAL, (x, y + 0.7, z + n * 0.75), (0, 0, n), 1.3, 0.32, ["Nur mit gültigem", "Fahrschein"], fg="black",
         bg="cream", o=0.004, pad=0.03, face="@self", sid="gatebox@%.0f,%.0f/rule" % (x, z))


@registered("pendant")
def pendant(b, PAL, x, z, y_ceil, drop):
    """A round pendant: a canopy at the ceiling, the cable, a dark conical
    shade with a white rim, the lit diffuser under it."""
    y = y_ceil - drop
    disc(b, PAL["dark"], (x, y_ceil - 0.01, z), (0, -1, 0), 0.12, seg=12)
    b.cyl(PAL["dark"], 0.1, (x, y_ceil, z), (x, y_ceil - 0.06, z), seg=12)
    b.cyl(PAL["black"], 0.012, (x, y_ceil - 0.06, z), (x, y + 0.45, z), seg=4)
    b.cyl(PAL["dark"], 0.06, (x, y + 0.5, z), (x, y + 0.42, z), seg=10)
    b.cyl(PAL["dark"], 0.14, (x, y + 0.42, z), (x, y + 0.04, z), seg=20, r2=0.55)
    b.cyl(PAL["white"], 0.56, (x, y + 0.04, z), (x, y, z), seg=20)
    disc(b, PAL["pendant"], (x, y - 0.002, z), (0, -1, 0), 0.5, seg=20)


@registered("board")
def departure_board(b, PAL, x, z, y, s):
    """The Abfahrt board (doc decision 8): a dark housing 6 x 1.6 hung on
    two rods, an LED field on both faces in the 5 x 7 lettering: ABFAHRT
    and the line's brand, the Linie / Ziel / Min heads, four trains (the
    next one pink), Troll Beach last; a service hatch underneath."""
    W_, H_, D_ = 6.0, 1.6, 0.34
    bx(b, PAL["dark"], x - W_ / 2 - 0.08, x + W_ / 2 + 0.08, y - 0.08, y + H_ + 0.08, z - D_ / 2, z + D_ / 2)
    trains = [("TROLLHALLA", "2"), ("JEETSBURG", "5"), ("DUST BOWL", "9"), ("TROLL BEACH", "14")]
    for nz in (-1, 1):
        zf = z + nz * D_ / 2
        REG.face("board@%.1f,%.1f/%+d" % (x, z, nz), "@self", (x, y + H_ / 2, zf), (0, 0, nz), W_, H_)
        panel(b, PAL["black"], (x, y + H_ / 2, zf), (0, 0, nz), W_, H_, o=0.003)
        Uv, _ = frame((0, 0, nz))
        at = lambda u, yy: Vector((x, yy, zf)) + Uv * u

        def put(txt, m, u, yy, h, align):
            text(b, PAL[m], txt, at(u, yy), (0, 0, nz), h, o=0.012, align=align)
        top = y + H_
        put("ABFAHRT", "board_o", -2.75, top - 0.2, 0.2, "l")
        put("GRINLINE", "board_p", 2.75, top - 0.2, 0.2, "r")
        rect(b, PAL["dark"], at(0, 0) + Vector((0, 0, nz * 0.008)), Uv, Vector((0, 1, 0)), -2.85, 2.85, top - 0.36, top - 0.345)
        put("LINIE", "board_o", -2.75, top - 0.46, 0.08, "l")
        put("ZIEL", "board_o", -1.9, top - 0.46, 0.08, "l")
        put("MIN", "board_o", 2.75, top - 0.46, 0.08, "r")
        for i, (dest, mins) in enumerate(trains):
            yy = top - 0.7 - i * 0.24
            m = "board_p" if i == 0 else "board_o"
            # the line's letter in a ring of LEDs
            c = at(-2.55, yy)
            for (du, dv, ww, hh) in ((0, 0.1, 0.22, 0.02), (0, -0.1, 0.22, 0.02), (0.1, 0, 0.02, 0.2), (-0.1, 0, 0.02, 0.2)):
                panel(b, PAL[m], c + Uv * du + Vector((0, dv, 0)), (0, 0, nz), ww, hh, o=0.012)
            put("G", m, -2.55, yy, 0.14, "c")
            put(dest, m, -1.9, yy, 0.17, "l")
            put(mins, m, 2.75, yy, 0.17, "r")
    # the service hatch underneath, its handle, a status LED
    rect(b, PAL["black"], (x - 0.6, y - 0.081, z - 0.1), (1, 0, 0), (0, 0, 1), 0, 1.2, 0, 0.2)
    rect(b, PAL["steel"], (x - 0.1, y - 0.083, z - 0.02), (1, 0, 0), (0, 0, 1), 0, 0.2, 0, 0.04)
    disc(b, PAL["exit"], (x + 2.9, y - 0.083, z), (0, -1, 0), 0.02, seg=8)
    for rx in (-2.4, 2.4):
        b.cyl(PAL["black"], 0.022, (x + rx, y + H_ + 0.08, z), (x + rx, ATRIUM_CEIL, z), seg=6)
        b.cyl(PAL["dark"], 0.06, (x + rx, y + H_ + 0.08, z), (x + rx, y + H_ + 0.16, z), seg=8)
        disc(b, PAL["dark"], (x + rx, ATRIUM_CEIL - 0.31, z), (0, -1, 0), 0.1, seg=10)


@registered("clock")
def clock(b, PAL, c, normal):
    """A station clock face: white dial, black bezel, the twelve hour bars
    and sixty minute ticks, the hands at ten past ten."""
    REG.face("clock@%.1f,%.1f,%.1f" % tuple(c), "@self", c, normal, 1.4, 1.4)
    disc(b, PAL["white"], c, normal, 0.7, seg=32, o=0.05)
    ring(b, PAL["black"], c, normal, 0.64, 0.7, seg=32, o=0.06)
    Uv, Vv = frame(normal)
    o3 = Vector(c) + Vector(normal) * 0.062
    for k in range(60):
        a = 2 * math.pi * k / 60
        d = Uv * math.sin(a) + Vv * math.cos(a)
        sd = Uv * math.cos(a) - Vv * math.sin(a)
        r0, w = (0.46, 0.035) if k % 5 == 0 else (0.56, 0.01)
        p0, p1 = o3 + d * r0, o3 + d * 0.61
        quad4(b, PAL["black"], [p0 - sd * (w / 2), p1 - sd * (w / 2), p1 + sd * (w / 2), p0 + sd * (w / 2)])
    o4 = o3 + Vector(normal) * 0.004
    for (ang, L, w) in ((2 * math.pi * (10 + 10 / 60) / 12, 0.34, 0.05), (2 * math.pi * 10 / 60, 0.52, 0.035)):
        d = Uv * math.sin(ang) + Vv * math.cos(ang)
        sd = Uv * math.cos(ang) - Vv * math.sin(ang)
        quad4(b, PAL["black"], [o4 - d * 0.08 - sd * (w / 2), o4 + d * L - sd * (w / 2), o4 + d * L + sd * (w / 2), o4 - d * 0.08 + sd * (w / 2)])
    # the seconds hand: red, with the Bahnhofsuhr's disc
    d = Uv * math.sin(2 * math.pi * 0.62) + Vv * math.cos(2 * math.pi * 0.62)
    o5 = o4 + Vector(normal) * 0.003
    quad4(b, PAL["roundel"], [o5 - d * 0.12 - Uv * 0.006, o5 + d * 0.44 - Uv * 0.006, o5 + d * 0.44 + Uv * 0.006, o5 - d * 0.12 + Uv * 0.006])
    disc(b, PAL["roundel"], o5 + d * 0.44, normal, 0.045, seg=12)
    disc(b, PAL["black"], o5, normal, 0.03, seg=10, o=0.001)


@registered("infodesk")
def info_desk(b, PAL, x, z, y):
    """The information desk, 3 x 2 x 1.1 (its collider): white panels on
    a black plinth, the blue Information band, a dark counter top, two
    screens back to back, a leaflet rack on the counter's end, the i on its
    pole."""
    bx(b, PAL["black"], x - 1.45, x + 1.45, y, y + 0.08, z - 0.95, z + 0.95)
    bx(b, PAL["white"], x - 1.5, x + 1.5, y + 0.08, y + 1.03, z - 1.0, z + 1.0)
    bx(b, PAL["dark"], x - 1.55, x + 1.55, y + 1.03, y + 1.1, z - 1.05, z + 1.05)
    for nz in (-1, 1):
        panel(b, PAL["stripe"], (x, y + 0.62, z + nz * 1.0), (0, 0, nz), 2.8, 0.42, o=0.004)
        sign(b, PAL, (x, y + 0.62, z + nz * 1.0), (0, 0, nz), 2.6, 0.42, ["Information"], fg="white", o=0.006,
             face="@self", sid="info@%.1f,%.1f/%+d" % (x, z, nz))
        for k in (-1, 1):
            panel(b, PAL["lightgrey"], (x + k * 0.75, y + 0.25, z + nz * 1.0), (0, 0, nz), 1.3, 0.02, o=0.004)
    # two screens on a foot, back to back, under the counter's line of sight
    bx(b, PAL["dark"], x - 0.12, x + 0.12, y + 1.1, y + 1.14, z - 0.12, z + 0.12)
    bx(b, PAL["dark"], x - 0.03, x + 0.03, y + 1.14, y + 1.3, z - 0.03, z + 0.03)
    bx(b, PAL["black"], x - 0.28, x + 0.28, y + 1.3, y + 1.62, z - 0.04, z + 0.04)
    for nz in (-1, 1):
        panel(b, PAL["screen"], (x, y + 1.46, z + nz * 0.04), (0, 0, nz), 0.5, 0.27, o=0.003)
    # the leaflet rack on the counter's east end: three tiers of leaflets
    xr = x + 1.25
    bx(b, PAL["steel"], xr - 0.2, xr + 0.2, y + 1.1, y + 1.5, z - 0.05, z + 0.05)
    for k in range(3):
        for (dz, col) in ((-0.12, ("orange", "green", "pink")[k]), (0.12, ("cyan", "yellow", "white")[k])):
            yy = y + 1.16 + k * 0.12
            bx(b, PAL["steel"], xr - 0.18, xr + 0.18, yy, yy + 0.01, z + dz - 0.07, z + dz + 0.07)
            for j in (-1, 0, 1):
                bx(b, PAL[col], xr + j * 0.12 - 0.045, xr + j * 0.12 + 0.045, yy + 0.01, yy + 0.12, z + dz - 0.012, z + dz + 0.012)
    b.cyl(PAL["steel"], 0.03, (x - 1.25, y + 1.1, z), (x - 1.25, y + 2.85, z), seg=8)
    for nz in (-1, 1):
        disc(b, PAL["stripe"], (x - 1.25, y + 3.15, z), (0, 0, nz), 0.35, seg=24, o=0.03)
        sign(b, PAL, (x - 1.25, y + 3.15, z), (0, 0, nz), 0.4, 0.5, ["i"], fg="white", o=0.03, weight=800, pad=0.0,
             face="@self", sid="info@%.1f,%.1f/i%+d" % (x, z, nz))
    bx(b, PAL["stripe"], x - 1.25 - 0.36, x - 1.25 + 0.36, y + 3.14, y + 3.16, z - 0.025, z + 0.025)


@registered("newsstand")
def newsstand(b, PAL, x, z, y):
    """The Grin-Kiosk, 3 x 2.4 (its collider to 2.4): an olive counter with
    the magazine racks stepped into its long faces, an oak top with the
    papers and the till, four posts, a red roof with the name all round and
    a tube under it."""
    bx(b, PAL["black"], x - 1.45, x + 1.45, y, y + 0.08, z - 1.05, z + 1.05)
    bx(b, PAL["olive"], x - 1.5, x + 1.5, y + 0.08, y + 1.1, z - 1.08, z + 1.08)
    bx(b, PAL["oak"], x - 1.55, x + 1.55, y + 1.1, y + 1.16, z - 1.2, z + 1.2)
    for nz in (-1, 1):
        rng = random.Random(int(x * 7 + z + nz))
        # three tiers of magazines leaning in a rack proud of the counter
        for t in range(3):
            yy = y + 0.2 + t * 0.3
            zz = z + nz * (1.08 + 0.04 + 0.03 * t)
            bx(b, PAL["dark"], x - 1.4, x + 1.4, yy - 0.02, yy, z + nz * 1.08, zz + nz * 0.04)
            for k in range(7):
                col = rng.choice(["orange", "pink", "cyan", "green", "yellow", "white", "red", "stripe"])
                cx = x - 1.2 + k * 0.4
                panel(b, PAL[col], (cx, yy + 0.14, zz), (0, 0, nz), 0.3, 0.27, o=0.004)
                panel(b, PAL["white"] if col != "white" else PAL["black"], (cx, yy + 0.24, zz), (0, 0, nz), 0.26, 0.05, o=0.007)
                panel(b, PAL["black"], (cx - 0.04, yy + 0.1, zz), (0, 0, nz), 0.16, 0.012, o=0.007)
                panel(b, PAL["black"], (cx - 0.02, yy + 0.07, zz), (0, 0, nz), 0.2, 0.012, o=0.007)
    # the counter top: stacks of papers, the till, a mint tray
    for (dx, col) in ((-0.9, "cream"), (-0.55, "white"), (-0.2, "cream")):
        for k in range(4):
            bx(b, PAL[col] if k % 2 else PAL["lightgrey"], x + dx - 0.15, x + dx + 0.15, y + 1.16 + k * 0.015, y + 1.175 + k * 0.015, z + 0.55, z + 0.95)
    bx(b, PAL["dark"], x + 0.7, x + 1.1, y + 1.16, y + 1.3, z + 0.3, z + 0.65)
    bx(b, PAL["black"], x + 0.75, x + 1.05, y + 1.3, y + 1.42, z + 0.4, z + 0.45)
    bx(b, PAL["red"], x + 0.2, x + 0.6, y + 1.16, y + 1.22, z - 0.9, z - 0.6)
    for (px, pz) in ((-1.42, -1.12), (1.42, -1.12), (-1.42, 1.12), (1.42, 1.12)):
        bx(b, PAL["dark"], x + px - 0.05, x + px + 0.05, y + 1.16, y + 2.6, z + pz - 0.05, z + pz + 0.05)
    bx(b, PAL["red"], x - 1.7, x + 1.7, y + 2.6, y + 2.85, z - 1.4, z + 1.4)
    bx(b, PAL["dark"], x - 1.6, x + 1.6, y + 2.56, y + 2.6, z - 1.3, z + 1.3)
    tube_light(b, PAL, x, z, y + 2.555, along="x", L=2.4)
    for nz in (-1, 1):
        sign(b, PAL, (x, y + 2.725, z + nz * 1.4), (0, 0, nz), 3.4, 0.25, ["Grin-Kiosk · Zeitungen · Getränke"], fg="white",
             o=0.003, face="@self", sid="news@%.1f,%.1f/z%+d" % (x, z, nz))
    for nx in (-1, 1):
        sign(b, PAL, (x + nx * 1.7, y + 2.725, z), (nx, 0, 0), 2.8, 0.25, ["Grin-Kiosk"], fg="white", o=0.003,
             face="@self", sid="news@%.1f,%.1f/x%+d" % (x, z, nx))


@registered("sign")
def hanging_sign(b, PAL, c, normal_axis, w, lines, y_ceil, bg="roundelblue", fg="white", arrow_dir=None):
    """A double-sided direction sign hung from the ceiling on two rods,
    a white keyline round each face."""
    x, y, z = c
    h = 0.26 * len(lines) + 0.14
    if normal_axis == "z":
        bx(b, PAL[bg], x - w / 2, x + w / 2, y, y + h, z - 0.03, z + 0.03)
    else:
        bx(b, PAL[bg], x - 0.03, x + 0.03, y, y + h, z - w / 2, z + w / 2)
    for sgn in (-1, 1):
        n = (0, 0, sgn) if normal_axis == "z" else (sgn, 0, 0)
        fc = (x + n[0] * 0.03, y + h / 2, z + n[2] * 0.03)
        Uv, Vv = frame(n)
        o3 = Vector(fc) + Vector(n) * 0.003
        for (u0, u1, v0, v1) in ((-w / 2 + 0.04, w / 2 - 0.04, h / 2 - 0.055, h / 2 - 0.04), (-w / 2 + 0.04, w / 2 - 0.04, -h / 2 + 0.04, -h / 2 + 0.055),
                                 (-w / 2 + 0.04, -w / 2 + 0.055, -h / 2 + 0.04, h / 2 - 0.04), (w / 2 - 0.055, w / 2 - 0.04, -h / 2 + 0.04, h / 2 - 0.04)):
            rect(b, PAL[fg], o3, Uv, Vv, u0, u1, v0, v1)
        sid = "sign@%.1f,%.1f,%.1f/%+d" % (x, y, z, sgn)
        if arrow_dir:
            arrow_sign(b, PAL, fc, n, w - 0.1, h - 0.1, lines, arrow_dir, fg=fg, bg=None, o=0.003, face="@self", sid=sid, pad=0.06)
        else:
            sign(b, PAL, fc, n, w, h, lines, fg=fg, o=0.003, pad=0.09, face="@self", sid=sid)
    for rx in (-w / 2 + 0.2, w / 2 - 0.2):
        if normal_axis == "z":
            b.cyl(PAL["black"], 0.015, (x + rx, y + h, z), (x + rx, y_ceil, z), seg=4)
        else:
            b.cyl(PAL["black"], 0.015, (x, y + h, z + rx), (x, y_ceil, z + rx), seg=4)


# ================================================================ the halls

# the walk-in Fotoautomat (maps/undergrin.js UG_BOOTH, north half's numbers)
BOOTH = dict(x0=-7.6, x1=-5.2, z0=-21.2, z1=-19.0, door0=-7.45, door1=-6.3, h=2.5, t=0.08)


@registered("booth")
def photo_booth(b, PAL, s):
    """The Fotoautomat, walk-in (user, 2026-10-27): a 2.4 x 2.2 x 2.5 cabin
    of dark walls (the layout's colliders, maps/undergrin.js UG_BOOTH), a
    1.15 doorway on its hall face with the red curtain gathered at its west
    jamb, the white fascia with the name over it, the sample strip, the
    price and the coin slot on the panel beside it, the red FOTO livery on
    the other three faces. Inside: cream walls, a rubber mat, the ceiling
    tube, and on the back wall the camera behind its window, the screen
    and the flash, where Socialize's photo booth takes your pictures
    (modes/photo-booth.js)."""
    X = lambda x: s * x
    Z = lambda z: s * z
    B = BOOTH
    x0, x1, z0, z1, t, y, h = B["x0"], B["x1"], B["z0"], B["z1"], B["t"], U, B["h"]
    d0, d1 = B["door0"], B["door1"]
    D = PAL["dark"]
    bx(b, D, X(x0), X(x1), y, y + h, Z(z0), Z(z0 + t))                 # back
    bx(b, D, X(x0), X(x0 + t), y, y + h, Z(z0), Z(z1))                 # west
    bx(b, D, X(x1 - t), X(x1), y, y + h, Z(z0), Z(z1))                 # east
    bx(b, D, X(x0), X(d0), y, y + h, Z(z1 - t), Z(z1))                 # the doorway's west jamb
    bx(b, D, X(d1), X(x1), y, y + h, Z(z1 - t), Z(z1))                 # the panel east of it
    bx(b, D, X(d0), X(d1), y + 2.1, y + h, Z(z1 - t), Z(z1))           # the header
    bx(b, D, X(x0), X(x1), y + h - 0.08, y + h, Z(z0), Z(z1))          # the roof
    fn = (0, 0, s)
    cx = (x0 + x1) / 2
    # the hall face: the fascia, the door's frame, the sample panel
    REG.face("booth@%.1f,%.1f/door" % (X((d0 + d1) / 2), Z(z1)), "@self", (X((d0 + d1) / 2), y + 1.05, Z(z1)), fn, d1 - d0, 2.1)
    sign(b, PAL, (X(cx), y + 2.3, Z(z1)), fn, x1 - x0 - 0.1, 0.32, ["Fotoautomat"], fg="black", bg="white", o=0.006,
         face="@self", sid="booth@%.1f,%.1f/name" % (X(cx), Z(z1)))
    for (a, c) in ((d0 - 0.04, d0), (d1, d1 + 0.04)):
        bx(b, PAL["steel"], X(a), X(c), y, y + 2.1, Z(z1), Z(z1 + 0.02))
    bx(b, PAL["steel"], X(d0 - 0.04), X(d1 + 0.04), y + 2.1, y + 2.14, Z(z1), Z(z1 + 0.02))
    pc = (d1 + x1) / 2
    Uv, Vv = frame(fn)
    sc = Vector((X(pc), 0, Z(z1)))
    REG.face("booth@%.1f,%.1f/samples" % (X(pc), Z(z1)), "@self", sc + Vector((0, y + 1.45, 0)), fn, 0.5, 0.9)
    panel(b, PAL["cream"], sc + Vector((0, y + 1.45, 0)), fn, 0.34, 0.86, o=0.006)
    for k in range(4):
        panel(b, PAL["grey"], sc + Vector((0, y + 1.76 - k * 0.2, 0)), fn, 0.24, 0.17, o=0.009)
        panel(b, PAL["white"], sc + Vector((0, y + 1.76 - k * 0.2, 0)), fn, 0.1, 0.11, o=0.011)
    sign(b, PAL, sc + Vector((0, y + 0.86, 0)), fn, 0.42, 0.2, ["4 Fotos", "5 €"], fg="black", bg="yellow", o=0.006,
         pad=0.015, face=None, sid="booth@%.1f,%.1f/price" % (X(pc), Z(z1)))
    panel(b, PAL["lightgrey"], sc + Vector((0, y + 0.55, 0)), fn, 0.2, 0.24, o=0.006)
    panel(b, PAL["black"], sc + Vector((0, y + 0.6, 0)), fn, 0.04, 0.1, o=0.009)
    panel(b, PAL["black"], sc + Vector((0, y + 0.47, 0)), fn, 0.12, 0.03, o=0.009)
    # the curtain on its rail, gathered against the west jamb inside
    zc = z1 - t - 0.06
    bx(b, PAL["steel"], X(d0 - 0.02), X(d1), y + 2.06, y + 2.08, Z(zc - 0.01), Z(zc + 0.01))
    for k in range(5):
        xx = d0 + 0.02 + k * 0.045
        bx(b, PAL["red"] if k % 2 else PAL["roundel"], X(xx - 0.025), X(xx + 0.025), y + 0.1, y + 2.06,
           Z(zc - (0.035 if k % 2 else 0.02)), Z(zc + (0.035 if k % 2 else 0.02)))
    # the livery on the other three faces
    for (fx, fz, cxx, czz) in ((-1, 0, x0, (z0 + z1) / 2), (1, 0, x1, (z0 + z1) / 2), (0, -1, cx, z0)):
        n = (s * fx, 0, s * fz)
        c = (X(cxx), y + 1.35, Z(czz))
        w = (z1 - z0 - 0.14) if fx else (x1 - x0 - 0.14)
        panel(b, PAL["red"], c, n, w, 1.7, o=0.004)
        for dv in (-0.68, 0.68):
            panel(b, PAL["cream"], (c[0], c[1] + dv, c[2]), n, w, 0.08, o=0.007)
        sign(b, PAL, c, n, w - 0.3, 0.95, ["FOTO", "sofort"], fg="cream", o=0.007, weight=800, face=None,
             sid="booth@%.1f,%.1f/side%+d%+d" % (X(cx), Z(z0), fx, fz))
    # inside: cream walls and the backdrop behind you, the mat, the
    # footprints a metre from the lens, the ceiling tube
    yi = y + 0.008
    hrect(b, PAL["black"], X(x0 + t), X(x1 - t), Z(z0 + t), Z(z1 - t), yi)
    for (a, c, ya, yb) in ((d1, x1 - t, 0.0, 2.42), (d0, d1, 2.1, 2.42), (x0 + t, d0, 0.0, 2.42)):
        panel(b, PAL["cream"], (X((a + c) / 2), y + (ya + yb) / 2, Z(z1 - t)), (0, 0, -s), c - a, yb - ya, o=0.003)
    for (dx, dz) in ((-0.13, 0.04), (0.13, -0.04)):
        fx, fz = cx + dx, z0 + 1.2 + dz
        hrect(b, PAL["yellow"], X(fx - 0.06), X(fx + 0.06), Z(fz - 0.13), Z(fz + 0.11), y + 0.012)
        hrect(b, PAL["yellow"], X(fx - 0.05), X(fx + 0.05), Z(fz - 0.2), Z(fz - 0.15), y + 0.012)
    for (fx, xx) in ((1, x0 + t), (-1, x1 - t)):
        panel(b, PAL["cream"], (X(xx), y + 1.25, Z((z0 + z1) / 2)), (s * fx, 0, 0), z1 - z0 - 0.2, 2.3, o=0.003)
    tube_light(b, PAL, X(cx), Z((z0 + z1) / 2), y + h - 0.081, along="x", L=1.2)
    # the back wall inside: the camera's window, the screen, the flash
    bn = (0, 0, s)
    bc = Vector((X(cx), 0, Z(z0 + t)))
    REG.face("booth@%.1f,%.1f/camera" % (X(cx), Z(z0)), "@self", bc + Vector((0, y + 1.45, 0)), bn, 1.0, 1.4)
    panel(b, PAL["lightgrey"], bc + Vector((0, y + 1.3, 0)), bn, x1 - x0 - 0.2, 2.2, o=0.003)
    panel(b, PAL["black"], bc + Vector((0, y + 1.55, 0)), bn, 0.42, 0.3, o=0.006)
    disc(b, PAL["dark"], bc + Vector((0, y + 1.55, 0)), bn, 0.1, seg=16, o=0.009)
    ring(b, PAL["steel"], bc + Vector((0, y + 1.55, 0)), bn, 0.1, 0.12, seg=16, o=0.01)
    disc(b, PAL["exit"], bc + Vector((0.16 * s, y + 1.65, 0)), bn, 0.015, seg=8, o=0.01)
    panel(b, PAL["screen"], bc + Vector((0, y + 1.12, 0)), bn, 0.5, 0.3, o=0.006)
    sign(b, PAL, bc + Vector((0, y + 1.12, 0)), bn, 0.46, 0.22, ["Bitte lächeln"], fg="black", o=0.009, pad=0.02, face=None,
         sid="booth@%.1f,%.1f/smile" % (X(cx), Z(z0)))
    panel(b, PAL["tube"], bc + Vector((0, y + 1.98, 0)), bn, 0.8, 0.14, o=0.006)


@registered("ticketmachine")
def ticket_machine(b, PAL, x, z, y, facing, axis="z"):
    """A Fahrkarten machine 0.8 wide, 0.6 deep, 1.9 tall: a blue body with
    a dark lit header, the screen, the keypad, the card and coin slots and
    the ticket tray. facing +-1 along axis."""
    if axis == "z":
        n = (0, 0, facing)
        bx(b, PAL["stripe"], x - 0.4, x + 0.4, y, y + 1.9, z - 0.3, z + 0.3)
        fc = Vector((x, 0, z + facing * 0.3))
    else:
        n = (facing, 0, 0)
        bx(b, PAL["stripe"], x - 0.3, x + 0.3, y, y + 1.9, z - 0.4, z + 0.4)
        fc = Vector((x + facing * 0.3, 0, z))
    at = lambda u, yy: fc + Uv * u + Vector((0, yy, 0))
    Uv, Vv = frame(n)
    REG.face("ticketmachine@%.1f,%.1f" % (x, z), "@self", at(0, y + 1.05), n, 0.8, 1.5)
    panel(b, PAL["black"], at(0, y + 0.08), n, 0.8, 0.16, o=0.003)
    sign(b, PAL, at(0, y + 1.75), n, 0.78, 0.22, ["Fahrkarten"], fg="white", bg="dark", o=0.003, lit=True, face=None,
         sid="ticketmachine@%.1f,%.1f/name" % (x, z))
    panel(b, PAL["dark"], at(0, y + 1.32), n, 0.6, 0.42, o=0.004)
    panel(b, PAL["screen"], at(0, y + 1.32), n, 0.52, 0.34, o=0.007)
    panel(b, PAL["lightgrey"], at(0, y + 0.86), n, 0.66, 0.42, o=0.004)
    for r in range(4):
        for k in range(3):
            panel(b, PAL["dark"], at(-0.2 + k * 0.08, y + 0.98 - r * 0.07), n, 0.06, 0.05, o=0.008)
    panel(b, PAL["black"], at(0.16, y + 0.98), n, 0.14, 0.02, o=0.008)
    panel(b, PAL["black"], at(0.16, y + 0.86), n, 0.04, 0.1, o=0.008)
    panel(b, PAL["roundel"], at(0.16, y + 0.74), n, 0.14, 0.05, o=0.008)
    panel(b, PAL["black"], at(0, y + 0.42), n, 0.5, 0.16, o=0.004)
    panel(b, PAL["dark"], at(0, y + 0.42), n, 0.44, 0.1, o=0.006)


@registered("netboard")
def network_board(b, PAL, c, normal):
    """The Liniennetz on a wall, 3.2 x 1.8 in an aluminium frame: the title
    bar, the GRINLINE crossing the green H line at Undergrin, a dot and a
    name per station, Sie sind hier, the interval."""
    w, h = 3.2, 1.8
    REG.face("netboard@%.1f,%.1f,%.1f" % tuple(c), "@self", c, normal, w, h)
    panel(b, PAL["white"], c, normal, w, h, o=0.03)
    poster_frame(b, PAL, c, normal, w, h, t=0.05, d=0.045)
    Uv, Vv = frame(normal)
    cc = Vector(c)
    at = lambda u, v: cc + Uv * u + Vv * v
    panel(b, PAL["roundelblue"], at(0, h / 2 - 0.13), normal, w, 0.26, o=0.034)
    sign(b, PAL, at(-0.35, h / 2 - 0.13), normal, 2.3, 0.26, ["Liniennetz"], fg="white", o=0.034, align="l", face=None,
         sid="netboard@%.1f,%.1f,%.1f/title" % tuple(c))
    sign(b, PAL, at(1.1, h / 2 - 0.13), normal, 0.9, 0.2, ["Zugfolge 5 Min"], fg="white", o=0.034, align="r", weight=500,
         face=None, sid="netboard@%.1f,%.1f,%.1f/interval" % tuple(c))
    vg = -0.05      # the G line's height on the board
    gx = [-1.3, -0.65, 0.0, 0.65, 1.3]
    hy = [0.42, 0.18, vg, -0.3, -0.55]
    rect(b, PAL["orange"], cc + Vector(normal) * 0.036, Uv, Vv, -1.35, 1.35, vg - 0.025, vg + 0.025)
    rect(b, PAL["green"], cc + Vector(normal) * 0.037, Uv, Vv, -0.025, 0.025, -0.6, 0.47)
    for u in gx:
        disc(b, PAL["black"], at(u, vg), normal, 0.045, seg=12, o=0.04)
        disc(b, PAL["white"], at(u, vg), normal, 0.03, seg=12, o=0.042)
    for v in hy:
        if v == vg:
            continue
        disc(b, PAL["black"], at(0, v), normal, 0.045, seg=12, o=0.04)
        disc(b, PAL["white"], at(0, v), normal, 0.03, seg=12, o=0.042)
    disc(b, PAL["roundel"], at(0, vg), normal, 0.07, seg=16, o=0.044)
    names_g = ["Trollhalla", "Jeetsburg", "Undergrin", "Dust Bowl", "Troll Beach"]
    for (u, name) in zip(gx, names_g):
        if name == "Undergrin":
            continue
        sign(b, PAL, at(u, vg - 0.11), normal, 0.6, 0.09, [name], fg="black", o=0.04, weight=600, pad=0.004, face=None,
             sid="netboard@%.1f,%.1f,%.1f/%s" % (tuple(c) + (name,)))
    names_h = ["Hollowgrin", "Grinleria", None, "Culdegrin", "Grinsite"]
    for (v, name) in zip(hy, names_h):
        if name:
            sign(b, PAL, at(0.38, v), normal, 0.6, 0.09, [name], fg="black", o=0.04, weight=600, pad=0.004, align="l", face=None,
                 sid="netboard@%.1f,%.1f,%.1f/%s" % (tuple(c) + (name,)))
    sign(b, PAL, at(0.42, vg + 0.12), normal, 0.7, 0.12, ["Undergrin"], fg="black", o=0.044, weight=800, pad=0.004, align="l",
         face=None, sid="netboard@%.1f,%.1f,%.1f/here" % tuple(c))
    sign(b, PAL, at(0.42, vg + 0.02), normal, 0.7, 0.08, ["Sie sind hier"], fg="roundel", o=0.044, weight=600, pad=0.004,
         align="l", face=None, sid="netboard@%.1f,%.1f,%.1f/sie" % tuple(c))
    # the key: the two lines' badges
    for (k, (col, lab)) in enumerate((("orange", "G  Grinline"), ("green", "H  Hollowline"))):
        v = -h / 2 + 0.18
        u = -1.4 + k * 1.1
        panel(b, PAL[col], at(u, v), normal, 0.12, 0.09, o=0.04)
        sign(b, PAL, at(u + 0.45, v), normal, 0.75, 0.09, [lab], fg="black", o=0.04, weight=600, pad=0.004, align="l", face=None,
             sid="netboard@%.1f,%.1f,%.1f/key%d" % (tuple(c) + (k,)))


def framed_poster(b, PAL, c, normal, w, h, bg, cells=24):
    troll_poster(b, PAL, c, normal, w, h, bg, cells=cells, o=0.02)
    poster_frame(b, PAL, c, normal, w, h)


def door_frame(b, PAL, x, nx, zc, y, w=1.8, h=DOOR_H):
    """The frame round a doorway in a wall at x facing nx: two jambs and a
    lintel, dark steel, 0.05 proud."""
    for e in (-1, 1):
        x0, x1, y0, y1, z0, z1 = wall_box((x, y + h / 2, zc + e * (w / 2 + 0.05)), (nx, 0, 0), 0.1, h, 0.05)
        bx(b, PAL["dark"], x0, x1, y0, y1, z0, z1)
    x0, x1, y0, y1, z0, z1 = wall_box((x, y + h + 0.08, zc), (nx, 0, 0), w + 0.2, 0.16, 0.05)
    bx(b, PAL["dark"], x0, x1, y0, y1, z0, z1)


# ============================================================ the platforms

def platform_level(b, PAL, s):
    """Tube lights, name boards, roundels, posters, benches, vending: phase
    2's furniture, in German from phase 1."""
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
    roundel(b, PAL, (X(0), 3.3, Z(-44)), (0, 0, s), r=0.8)
    sign(b, PAL, (X(0), 2.0, Z(-44)), (0, 0, s), 3.6, 0.6, ["Undergrin"], fg="white", o=0.02, sid="endname@%.0f" % Z(-44))
    exit_sign(b, PAL, (X(12), 3.0, Z(-44)), (0, 0, s))
    exit_sign(b, PAL, (X(-19.5), 3.2, Z(-44)), (0, 0, s))
    hanging_sign(b, PAL, (X(0), SLAB0 - 1.0, Z(-31)), "z", 3.0, ["GRINLINE"], SLAB0 - 0.34)
    hanging_sign(b, PAL, (X(0), SLAB0 - 1.0, Z(-15.5)), "z", 3.0, ["Technikraum"], SLAB0 - 0.34)
    exit_sign(b, PAL, (X(0), 2.6, Z(-14)), (0, 0, -s))
    bench(b, PAL, X(0), Z(-32.22), P, along="x", back=s)
    bench(b, PAL, X(0), Z(-31.78), P, along="x", back=-s)
    for x in (-6, 6):
        bench(b, PAL, X(x), Z(-28), P, along="z", L=2.0, back=s * (1 if x > 0 else -1))
    for (cxp, cz) in COLS:
        if cz == -22:
            roundel(b, PAL, (X(cxp) - s * (1 if cxp > 0 else -1) * 0.35, 2.4, Z(cz)), (-s * (1 if cxp > 0 else -1), 0, 0), r=0.3)


# ================================================================ the hall

def hall(b, PAL, s):
    """The hall over the platforms (z -40..-16 on the north half): benches,
    the Fotoautomat and the Fahrkarten pair by the escalator top, framed
    posters, the Liniennetz, cabinets, columns, bins, speakers, cameras,
    pendants, the hanging sign over the escalator, the doorways' frames,
    the bands' tile joints."""
    X = lambda x: s * x
    Z = lambda z: s * z
    for x in (-10, 10):
        bench(b, PAL, X(x), Z(-30), U, along="x", back=-s)
    photo_booth(b, PAL, s)
    ticket_machine(b, PAL, X(6.0), Z(-20), U, s)
    ticket_machine(b, PAL, X(7.0), Z(-20), U, s)
    hall_doors = [(Z(-33), 1.8, U + DOOR_H), (Z(-19), 1.8, U + DOOR_H)]
    for sx in (-1, 1):
        wx = X(sx * 16)
        fs = -s * sx
        nrm = (fs, 0, 0)
        framed_poster(b, PAL, (wx, U + 2.0, Z(-37)), nrm, 1.2, 1.7, PAL["yellow"] if sx < 0 else PAL["cyan"])
        panel(b, PAL["cyan"] if sx < 0 else PAL["yellow"], (wx, U + 2.0, Z(-26)), nrm, 1.2, 1.7, o=0.02)
        REG.face("poster@%.0f,%.1f,%.0f" % (wx, U + 2.0, Z(-26)), "wall", (wx, U + 2.0, Z(-26)), nrm, 1.2, 1.7)
        troll_poster(b, PAL, (wx, U + 2.0, Z(-26)), nrm, 0.9, 0.9, None, cells=18, o=0.03)
        poster_frame(b, PAL, (wx, U + 2.0, Z(-26)), nrm, 1.2, 1.7)
        panel(b, PAL["cream"], (wx, U + 2.0, Z(-29.5)), nrm, 1.2, 1.7, o=0.02)
        REG.face("poster@%.0f,%.1f,%.1f" % (wx, U + 2.0, Z(-29.5)), "wall", (wx, U + 2.0, Z(-29.5)), nrm, 1.2, 1.7)
        poster_frame(b, PAL, (wx, U + 2.0, Z(-29.5)), nrm, 1.2, 1.7)
        words = ([("GRINLINE", "black", 0.3), ("alle 5 Min.", "salmon", 0.3), ("(meistens)", "black", 0.22)] if sx < 0 else
                 [("Lächeln,", "salmon", 0.3), ("Sie werden", "black", 0.26), ("getrollt.", "salmon", 0.3)])
        for k, (word, col, hh) in enumerate(words):
            sign(b, PAL, (wx, U + 2.45 - k * 0.42, Z(-29.5)), nrm, 1.05, hh + 0.08, [word], fg=col, o=0.03, face=None, pad=0.03,
                 sid="poster@%.0f,%.1f,%.1f/%d" % (wx, U + 2.0, Z(-29.5), k))
        roundel(b, PAL, (wx, U + 4.2, Z(-22)), nrm, r=0.5)
        for zd in (-33, -19):
            exit_sign(b, PAL, (wx, U + 2.95, Z(zd)), nrm, w=1.0)
            door_frame(b, PAL, wx, fs, Z(zd), U)
        exit_sign(b, PAL, (wx, U + 2.95, Z(-8)), nrm, w=1.0)
        door_frame(b, PAL, wx, fs, Z(-8), U)
        # the bands' courses: 0.317 tiles, 0.6 wide, cut round the doorways
        joints_z(b, PAL["joint"], wx, fs, U + 1.0, U + 2.9, Z(-40), Z(-16), 0.6, 1.9 / 6, doors=hall_doors)
        joints_z(b, PAL["joint"], wx, fs, U + 1.0, U + 2.9, Z(-16), Z(0), 0.6, 1.9 / 6, doors=[(Z(-8), 1.8, U + DOOR_H)])
        speaker(b, PAL, (wx, U + 4.8, Z(-31)), nrm)
        litter_bin(b, PAL, wx + fs * 0.26, Z(-24), U)
    # the north wall: the Liniennetz, the hydrant, an extinguisher, two SOS columns, bins, cameras
    nw = Z(-40)
    nn = (0, 0, s)
    joints_x(b, PAL["joint"], nw, s, U + 1.0, U + 2.9, X(-16), X(16), 0.6, 1.9 / 6)
    network_board(b, PAL, (X(0), U + 1.7, nw), nn)
    hose_cabinet(b, PAL, (X(-9), U + 0.95, nw), nn)
    extinguisher_cabinet(b, PAL, (X(9), U + 0.8, nw), nn)
    for sx in (-1, 1):
        sos_pillar(b, PAL, X(sx * 4.5), nw + s * 0.18, U, (0, s))
        litter_bin(b, PAL, X(sx * 12.5), nw + s * 0.26, U)
        cctv(b, PAL, (X(sx * 15.2), U + 5.6, nw), nn)
        speaker(b, PAL, (X(sx * 6.5), U + 4.6, nw), nn)
    for x in (-5, 5):
        for z in (-36, -30, -24, -18):
            pendant(b, PAL, X(x), Z(z), vault_y(x) - 0.3, 2.6)
    hanging_sign(b, PAL, (X(0), U + 3.2, Z(-21)), "z", 3.4, ["Zu den Zügen", "Gleis 1 und 2"], vault_y(0) - 0.22, arrow_dir="down")
    if s > 0:
        # two pigeons on the west edge beam
        for (zz, hd) in ((-27.0, 0.4), (-26.35, 2.6)):
            pigeon(b, PAL, X(-16.05), Z(zz), HALL_WALL + 0.25, heading=hd)


# ============================================================== the atrium

def atrium(b, PAL, s):
    """This half's atrium (z -16..0 on the north half): the gate line at
    z -12 with its Aufsicht boxes, the Abfahrt board, a bench, pendants,
    the two-faced clock in the arch, framed posters and direction signs on
    the piers, ticket machines, bins, an SOS column, cabinets, speakers,
    cameras."""
    X = lambda x: s * x
    Z = lambda z: s * z
    for k in range(6):
        ticket_gate(b, PAL, X(-7 + 2.8 * k), Z(-12), U)
    for x in (-9, 9):
        gate_box(b, PAL, X(x), Z(-12), U, s)
    departure_board(b, PAL, X(0), Z(-12), 9.4, s)
    bench(b, PAL, X(0), Z(-9), U, along="x")
    for x in (-8, 0, 8):
        pendant(b, PAL, X(x), Z(-6), ATRIUM_CEIL, 3.6)
    cy = ARCH_SPRING + ARCH_SPAN / 2 - 1.2
    b.cyl(PAL["black"], 0.03, (X(0), ARCH_SPRING + ARCH_SPAN / 2, Z(-15.75)), (X(0), cy + 0.7, Z(-15.75)), seg=4)
    b.cyl(PAL["black"], 0.72, (X(0), cy, Z(-16)), (X(0), cy, Z(-15.5)), seg=32)
    clock(b, PAL, (X(0), cy, Z(-15.5)), (0, 0, s))
    clock(b, PAL, (X(0), cy, Z(-16)), (0, 0, -s))
    pz = Z(-15.5)
    pn = (0, 0, s)
    for sx in (-1, 1):
        framed_poster(b, PAL, (X(sx * 11.5), U + 2.2, pz), pn, 1.4, 2.0, PAL["salmon"] if sx < 0 else PAL["stripe"], cells=26)
        roundel(b, PAL, (X(sx * 11.5), U + 4.4, pz), pn, r=0.45)
        # to the trains: through the arch, which is on the reader's right on the west pier
        arrow_sign(b, PAL, (X(sx * 9.2), U + 3.55, pz), pn, 2.6, 0.62, ["Zu den Zügen", "Gleis 1 und 2"], "right" if sx < 0 else "left",
                   sid="dir@%.1f,%.1f" % (X(sx * 9.2), pz))
        cctv(b, PAL, (X(sx * 7.6), U + 5.6, pz), pn)
        speaker(b, PAL, (X(sx * 13.8), U + 4.9, pz), pn)
    joints_x(b, PAL["joint"], pz, s, U + 1.0, U + 2.9, X(-16), X(-7), 0.6, 1.9 / 6)
    joints_x(b, PAL["joint"], pz, s, U + 1.0, U + 2.9, X(7), X(16), 0.6, 1.9 / 6)
    joints_x(b, PAL["joint"], Z(-16), -s, U + 1.0, U + 2.9, X(-16), X(-7), 0.6, 1.9 / 6)
    joints_x(b, PAL["joint"], Z(-16), -s, U + 1.0, U + 2.9, X(7), X(16), 0.6, 1.9 / 6)
    extinguisher_cabinet(b, PAL, (X(-14.3), U + 0.8, pz), pn)
    # facing into the atrium (east, its panel looked along the pier past the extinguisher)
    sos_pillar(b, PAL, X(-15.8), Z(-15.3), U, (0, s))
    # the west wall's machines, before the gates
    for z in (-11.0, -10.1):
        ticket_machine(b, PAL, X(-15.7), Z(z), U, s, axis="x")
        collide(X(-16), X(-15.4), U, U + 1.9, Z(z) - 0.4, Z(z) + 0.4)
    for sx in (-1, 1):
        litter_bin(b, PAL, X(sx * 15.74), Z(-4.5), U)
        # (south of the lunette window, z -13..-5 on the north half)
        speaker(b, PAL, (X(sx * 16), U + 3.6, Z(-14.5)), (-s * sx, 0, 0))


def floor_lines(b, PAL):
    """The concourse floor's 1 m tiles as paint lines: the atrium (less the
    light well and its kerb) and both halls (less the escalator wells)."""
    m = PAL["floorline"]
    t = 0.03
    yy = U + 0.008      # over the shell's floor paint at U + 0.003
    holes = [(-4.6, 4.6, -4.6, 4.6)]
    for s in (1, -1):
        a, c, d, e = ESC_WELL
        holes.append((s * a, s * c, s * d, s * e) if s > 0 else (-c, -a, -e, -d))
    rs = [(-16.0, 16.0, -40.0, 40.0)]
    for h in holes:
        rs = sub_rects(rs, h)
    for (x0, x1, z0, z1) in rs:
        for k in range(math.ceil(x0), math.floor(x1) + 1):
            if x0 < k < x1:
                hrect(b, m, k - t / 2, k + t / 2, z0, z1, yy)
        for k in range(math.ceil(z0), math.floor(z1) + 1):
            if z0 < k < z1:
                hrect(b, m, x0, x1, k - t / 2, k + t / 2, yy)


def build_concourse(PAL):
    b = Builder()
    for s in (1, -1):
        platform_level(b, PAL, s)
        hall(b, PAL, s)
        atrium(b, PAL, s)
    info_desk(b, PAL, -9, 0, U)
    newsstand(b, PAL, 9, 0, U)
    floor_lines(b, PAL)
    # the light well: a tiled kerb under the rail, a drain grate, the yellow line
    for (a, c, d, e) in ((-4.15, 4.15, -4.15, -3.95), (-4.15, 4.15, 3.95, 4.15), (-4.15, -3.95, -3.95, 3.95), (3.95, 4.15, -3.95, 3.95)):
        bx(b, PAL["lightgrey"], a, c, U, U + 0.15, d, e)
    for (a, c, d, e) in ((-4.35, 4.35, -4.35, -4.15), (-4.35, 4.35, 4.15, 4.35), (-4.35, -4.15, -4.15, 4.15), (4.15, 4.35, -4.15, 4.15)):
        hrect(b, PAL["grate"], a, c, d, e, U + 0.007)
    for (a, c, d, e) in ((-4.6, 4.6, -4.6, -4.4), (-4.6, 4.6, 4.4, 4.6), (-4.6, -4.4, -4.4, 4.4), (4.4, 4.6, -4.4, 4.4)):
        hrect(b, PAL["yellow"], a, c, d, e, U + 0.007)
    for (sx, shops) in ((-1, SHOPS_W), (1, SHOPS_E)):
        for (z0, z1, name) in shops:
            for k in range(2):
                tube_light(b, PAL, sx * 19, z0 + (z1 - z0) * (0.3 + 0.4 * k), CEIL_SHOP - 0.02, along="z", L=1.4)
    b.finish("ug-concourse.glb", bake=False, uv2=2048, quantize=True)
