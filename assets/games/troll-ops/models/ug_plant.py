"""
Undergrin's plant room, service corridors and bore props (ug-plant.glb):
the generator, switch cabinets, cable drums, the pump skid, the dado and
conduit, lockers, the fuse cabinet, the works trolleys and signal
cabinets; phase 3 of "Troll Forces: Undergrin in Blender" adds German
plates (Technikraum, Zu den Gleisen, Hochspannung, Erste Hilfe), a valve
drop, Feuerlöscher cabinets, the Dienstplan board, the bores' bulkhead
lamps, cable runs and km plates, all on the walls. See ug_kit.py.
"""
from ug_kit import *  # noqa: F401,F403
from ug_concourse import arrow_sign  # noqa: E402


# ================================================================== PLANT

def cabinet(b, PAL, x0, x1, z0, z1, y, h, m=None, face=1):
    m = m or PAL["grey"]
    bx(b, m, x0, x1, y, y + h, z0, z1)
    # a door seam and two indicator lights on the long face toward the room (+-z)
    along_x = abs(x1 - x0) > abs(z1 - z0)
    if along_x:
        fz = max(z0, z1) if face > 0 else min(z0, z1)
        panel(b, PAL["dark"], ((x0 + x1) / 2, y + h * 0.5, fz), (0, 0, face), 0.02, h * 0.8, o=0.005)
        panel(b, PAL["green"], ((x0 + x1) / 2 - 0.15, y + h * 0.85, fz), (0, 0, face), 0.06, 0.06, o=0.006)
        panel(b, PAL["red"], ((x0 + x1) / 2 + 0.15, y + h * 0.85, fz), (0, 0, face), 0.06, 0.06, o=0.006)


def plant_half(b, PAL, s):
    """The plant room's north half (s = 1) or its 180-degree twin: the
    generator, switch cabinets, cable drums and pump skid on their
    colliders, a dado and conduit on the walls."""
    X = lambda x: s * x
    Z = lambda z: s * z
    y = T
    # generator x -9.3..-6.9, z -6.5..-5.1, 1.2 tall: olive engine on a dark skid, a yellow stripe, an exhaust
    REG.begin(b, "generator@%.1f,%.1f" % (X(-8.1), Z(-5.8)))
    bx(b, PAL["dark"], X(-9.3), X(-6.9), y, y + 0.15, Z(-6.5), Z(-5.1))
    bx(b, PAL["olive"], X(-9.2), X(-7.0), y + 0.15, y + 1.05, Z(-6.4), Z(-5.2))
    bx(b, PAL["nosing"], X(-9.2), X(-7.0), y + 0.85, y + 0.9, Z(-6.4), Z(-5.2))
    b.cyl(PAL["dark"], 0.1, (X(-8.0), y + 1.05, Z(-5.8)), (X(-8.0), y + 1.2, Z(-5.8)), seg=8)
    REG.end()
    # switch cabinets x -7..-5 and 4..6 on the north wall (z -7.7..-7.1)
    for (xa, xb) in ((-7.0, -5.0), (4.0, 6.0)):
        REG.begin(b, "switch@%.0f,%.1f" % (X((xa + xb) / 2), Z(-7.4)))
        cabinet(b, PAL, X(xa), X(xb), Z(-7.7), Z(-7.1), y, 1.2, face=s)
        REG.end()
    # cable drums standing on end
    for (dx, dz, r, h) in ((7.0, -6.3, 0.6, 1.0), (8.3, -4.8, 0.5, 0.9)):
        REG.begin(b, "drum@%.1f,%.1f" % (X(dx), Z(dz)))
        b.cyl(PAL["oak"], r, (X(dx), y, Z(dz)), (X(dx), y + 0.08, Z(dz)), seg=14)
        b.cyl(PAL["oak"], r * 0.55, (X(dx), y + 0.08, Z(dz)), (X(dx), y + h - 0.08, Z(dz)), seg=12)
        b.cyl(PAL["dark"], r * 0.9, (X(dx), y + 0.12, Z(dz)), (X(dx), y + h - 0.12, Z(dz)), seg=14)
        b.cyl(PAL["oak"], r, (X(dx), y + h - 0.08, Z(dz)), (X(dx), y + h, Z(dz)), seg=14)
        REG.end()
    # pump skid x 5.5..7.5, z -2.5..-0.9, 0.9 tall: two blue pumps on a dark frame
    REG.begin(b, "pump@%.1f,%.1f" % (X(6.5), Z(-1.7)))
    bx(b, PAL["dark"], X(5.5), X(7.5), y, y + 0.2, Z(-2.5), Z(-0.9))
    for pz in (-2.1, -1.3):
        b.cyl(PAL["stripe"], 0.3, (X(5.7), y + 0.55, Z(pz)), (X(7.3), y + 0.55, Z(pz)), seg=10)
    REG.end()
    # a grey dado on the bore walls (x +-9.75) and the north face (z -8), a conduit above it
    band_z(b, PAL["grey"], X(-9.75), s, y, y + 1.3, Z(-8), Z(0), o=0.0, doors=[(Z(-4), 1.8, DOOR_H)])
    band_z(b, PAL["grey"], X(9.75), -s, y, y + 1.3, Z(-8), Z(0), o=0.0)
    for (xa, xb) in ((-9.75, -2.0), (2.0, 9.75)):
        band_x(b, PAL["grey"], Z(-8), s, y, y + 1.3, X(xa), X(xb), o=0.0)
        b.bar(PAL["dark"], (X(xa), 2.6, Z(-7.95)), (X(xb), 2.6, Z(-7.95)), 0.08)
    b.bar(PAL["dark"], (X(-9.7), 2.6, Z(-8)), (X(-9.7), 2.6, Z(0)), 0.08)
    b.bar(PAL["dark"], (X(9.7), 2.6, Z(-8)), (X(9.7), 2.6, Z(0)), 0.08)
    # pipes along the bore walls under the ceiling, a bus duct along the north face
    for px in (-9.55, 9.55):
        b.cyl(PAL["steel"], 0.12, (X(px), 4.6, Z(-7.8)), (X(px), 4.6, Z(0)), seg=8)
        b.cyl(PAL["stripe"], 0.08, (X(px), 4.3, Z(-7.8)), (X(px), 4.3, Z(0)), seg=6)
    bx(b, PAL["grey"], X(-9.7), X(9.7), 4.9, 5.2, Z(-7.6), Z(-7.3))
    # Technikraum by the door (phase 3: in German, lettered at load)
    nrm = (0, 0, s)
    sign(b, PAL, (X(-3.0), 2.0, Z(-7.99)), nrm, 0.9, 0.5, ["Technikraum", "nur Personal"], fg="black", bg="nosing", o=0.0, pad=0.05,
         sid="plantsign@%.0f,%.1f" % (X(-3.0), Z(-8)))


def plant_room(b, PAL):
    for s in (1, -1):
        plant_half(b, PAL, s)
    # tube lights round the well (the well itself is the atrium's daylight)
    for (x, z) in ((-6, -6), (6, -6), (-6, 6), (6, 6)):
        tube_light(b, PAL, x, z, SLAB0 - 0.02, along="x", L=1.4)
    # a hazard line on the floor round the room's middle
    for (a, c, d, e) in ((-4.3, 4.3, -4.3, -4.15), (-4.3, 4.3, 4.15, 4.3), (-4.3, -4.15, -4.15, 4.15), (4.15, 4.3, -4.15, 4.15)):
        hrect(b, PAL["yellow"], a, c, d, e, T + 0.026)


def corridor_props(b, PAL, s):
    """Service corridor x -22..-15.75, z -12..0 (west; s = -1 the east)."""
    X = lambda x: s * x
    Z = lambda z: s * z
    y = T
    # lockers on the outer wall (x -21.95..-21.45, z -11.8..-10.2), a fuse cabinet
    # by the end wall (x -17..-16, z -0.5..0), a mop bucket (r 0.25 at -16.5, -11.5)
    for k in range(3):
        za = -11.8 + k * 1.6 / 3
        REG.begin(b, "locker@%.1f,%.1f" % (X(-21.7), Z(za + 0.8 / 3)))
        bx(b, PAL["grey"], X(-21.95), X(-21.45), y, y + 2.0, Z(za), Z(za + 1.6 / 3 - 0.02))
        panel(b, PAL["dark"], (X(-21.45), y + 1.0, Z(za + 0.8 / 3)), (s, 0, 0), 0.02, 1.7, o=0.005)
        REG.end()
    REG.begin(b, "fusebox@%.1f,%.1f" % (X(-16.5), Z(-0.25)))
    bx(b, PAL["grey"], X(-17.0), X(-16.0), y, y + 1.8, Z(-0.5), Z(0))
    panel(b, PAL["nosing"], (X(-16.5), y + 1.4, Z(-0.5)), (0, 0, -s), 0.3, 0.3, o=0.005)
    REG.end()
    REG.begin(b, "mop@%.1f,%.1f" % (X(-16.5), Z(-11.5)))
    b.cyl(PAL["nosing"], 0.25, (X(-16.5), y, Z(-11.5)), (X(-16.5), y + 0.4, Z(-11.5)), seg=10)
    b.cyl(PAL["steel"], 0.015, (X(-16.5), y + 0.4, Z(-11.5)), (X(-16.4), y + 1.4, Z(-11.6)), seg=4)
    REG.end()
    # over the bore door: Zu den Gleisen, straight on (phase 3: in German)
    arrow_sign(b, PAL, (X(-15.75), 2.75, Z(-6)), (-s, 0, 0), 1.8, 0.4, ["Zu den Gleisen"], "up", o=0.01,
               sid="tracksign@%.2f,%.0f" % (X(-15.75), Z(-6)))


def bore_props(b, PAL, s):
    """A works trolley at z -2 and a signal cabinet at z -10 in the W bore
    (s = -1: the E bore's at +2 / +10)."""
    X = lambda x: s * x
    Z = lambda z: s * z
    # works trolley against the outer wall: x -14.25..-12.65, z -2.2..0.2, 1.0 tall
    xa, xb, za, zb = -14.25, -12.65, -2.2, 0.2
    xm, zm = (xa + xb) / 2, (za + zb) / 2
    REG.begin(b, "trolley@%.1f,%.0f" % (X(xm), Z(zm)))
    bx(b, PAL["nosing"], X(xa), X(xb), T + 0.45, T + 0.57, Z(za), Z(zb))
    for (wx, wz) in ((-0.55, -0.9), (0.55, -0.9), (-0.55, 0.9), (0.55, 0.9)):
        b.cyl(PAL["black"], 0.2, (X(xm + wx) - 0.04, T + 0.22, Z(zm + wz)), (X(xm + wx) + 0.04, T + 0.22, Z(zm + wz)), seg=8)
    bx(b, PAL["dark"], X(xa + 0.1), X(xb - 0.1), T + 0.05, T + 0.45, Z(za + 0.3), Z(zb - 0.3))
    bx(b, PAL["red"], X(xm - 0.35), X(xm + 0.35), T + 0.57, T + 1.0, Z(zm - 0.6), Z(zm - 0.05))
    b.cyl(PAL["stripe"], 0.3, (X(xm), T + 0.57, Z(zm + 0.6)), (X(xm), T + 1.0, Z(zm + 0.6)), seg=10)
    REG.end()
    # signal cabinet against the outer wall at z +10 (x -13.95..-13.35, 2.0 tall), its head on top
    REG.begin(b, "signal@%.2f,%.0f" % (X(-13.65), Z(10)))
    cabinet(b, PAL, X(-13.95), X(-13.35), Z(9.4), Z(10.6), T, 2.0, m=PAL["grey"])
    # the signal lamps on its face toward the track
    panel(b, PAL["black"], (X(-13.35), T + 1.6, Z(10)), (s, 0, 0), 0.3, 0.7, o=0.005)
    REG.face("signal@%.2f,%.0f" % (X(-13.35), Z(10)), "@self", (X(-13.35), T + 1.6, Z(10)), (s, 0, 0), 0.3, 0.7)
    disc(b, PAL["red"], (X(-13.35), T + 1.45, Z(10)), (s, 0, 0), 0.09, seg=10, o=0.01)
    disc(b, PAL["green"], (X(-13.35), T + 1.75, Z(10)), (s, 0, 0), 0.09, seg=10, o=0.01)
    REG.end()


# ================================================================ phase 3

def warning_plate(b, PAL, c, normal, word, sid):
    """The yellow lightning triangle with its word under it, flat on a
    cabinet door or a wall."""
    Uv, Vv = frame(normal)
    cc = Vector(c) + Vector(normal) * 0.006
    quad4(b, PAL["black"], [cc - Uv * 0.13 - Vv * 0.09, cc + Uv * 0.13 - Vv * 0.09, cc + Vv * 0.14])
    cc2 = cc + Vector(normal) * 0.002
    quad4(b, PAL["nosing"], [cc2 - Uv * 0.1 - Vv * 0.07, cc2 + Uv * 0.1 - Vv * 0.07, cc2 + Vv * 0.105])
    cc3 = cc2 + Vector(normal) * 0.002
    quad4(b, PAL["black"], [cc3 - Uv * 0.01 + Vv * 0.07, cc3 + Uv * 0.025 + Vv * 0.07, cc3 + Uv * 0.0 - Vv * 0.04])
    sign(b, PAL, Vector(c) - Vv * 0.17, normal, 0.36, 0.07, [word], fg="black", bg="nosing", o=0.006, pad=0.005, face=None, sid=sid)


def first_aid(b, PAL, c, normal):
    """Erste Hilfe: a green wall box with the white cross, its word above."""
    wbx(b, PAL["green"], c, normal, 0.4, 0.35, 0.14)
    fc = Vector(c) + Vector(normal) * 0.14
    panel(b, PAL["white"], fc, normal, 0.2, 0.06, o=0.003)
    panel(b, PAL["white"], fc, normal, 0.06, 0.2, o=0.003)
    sign(b, PAL, Vector(c) + Vector((0, 0.27, 0)), normal, 0.5, 0.12, ["Erste Hilfe"], fg="white", bg="green", o=0.004, pad=0.01,
         sid="firstaid@%.1f,%.1f,%.1f" % tuple(c))
    x0, x1, y0, y1, z0, z1 = wall_box(c, normal, 0.4, 0.35, 0.14)
    collide(x0, x1, y0, y1, z0, z1, pen=2)


def valve_drop(b, PAL, x, z, nx, y_top, y_bot, y_wheel):
    """A pipe dropping down a wall from the run under the ceiling, a red
    handwheel on it, a bracket top and bottom."""
    b.cyl(PAL["steel"], 0.06, (x, y_bot, z), (x, y_top, z), seg=8)
    for yy in (y_bot + 0.2, y_top - 0.3):
        bx(b, PAL["dark"], min(x, x - nx * 0.15), max(x, x - nx * 0.15), yy - 0.03, yy + 0.03, z - 0.04, z + 0.04)
    b.cyl(PAL["red"], 0.05, (x, y_wheel, z), (x + nx * 0.18, y_wheel, z), seg=6)
    ring(b, PAL["red"], (x + nx * 0.18, y_wheel, z), (nx, 0, 0), 0.13, 0.17, seg=14)
    for k in range(2):
        a = k * math.pi / 2
        p0 = Vector((x + nx * 0.18, y_wheel + math.cos(a) * 0.15, z + math.sin(a) * 0.15))
        p1 = Vector((x + nx * 0.18, y_wheel - math.cos(a) * 0.15, z - math.sin(a) * 0.15))
        b.bar(PAL["red"], tuple(p0), tuple(p1), 0.025)
    b.cyl(PAL["steel"], 0.09, (x, y_bot, z), (x, y_bot + 0.08, z), seg=8)


def bore_lamp(b, PAL, x, z, nx, y=2.0):
    """A bulkhead lamp on a tunnel wall: a dark cage, the lit lens."""
    wbx(b, PAL["dark"], (x, y, z), (nx, 0, 0), 0.34, 0.18, 0.09)
    panel(b, PAL["headlight"], (x + nx * 0.09, y, z), (nx, 0, 0), 0.26, 0.11, o=0.003)
    for du in (-0.06, 0.06):
        rect(b, PAL["dark"], (x + nx * 0.095, 0, 0), *frame((nx, 0, 0)), *sorted((-nx * (z + du - 0.008), -nx * (z + du + 0.008))), y - 0.055, y + 0.055)


def plant_phase3(b, PAL, s):
    """Phase 3 of the doc, the plant room's walls only (the floor seen from
    the light well's rail stays as it was: the room is the KOTH hill):
    warning plates on the switch cabinets, a valve drop, Erste Hilfe, a
    Feuerlöscher cabinet, the Ausgang over the door; the corridor's
    Feuerlöscher, Dienstplan board and wall pipes; the bores' bulkhead
    lamps, cable runs and distance plates."""
    X = lambda x: s * x
    Z = lambda z: s * z
    for (xa, xb) in ((-7.0, -5.0), (4.0, 6.0)):
        xc = (xa + xb) / 2
        warning_plate(b, PAL, (X(xc), 0.95, Z(-7.1)), (0, 0, s), "Hochspannung", "hv@%.0f,%.1f" % (X(xc), Z(-7.1)))
    valve_drop(b, PAL, X(9.6), Z(-6.4), -s, 4.6, 0.4, 1.35)
    first_aid(b, PAL, (X(9.75), 1.6, Z(-1.6)), (-s, 0, 0))
    extinguisher_cabinet(b, PAL, (X(-9.75), 1.3, Z(-1.6)), (s, 0, 0))
    exit_sign(b, PAL, (X(0), 2.85, Z(-7.7)), (0, 0, s), w=1.2)
    # the corridor (x -22..-15.75, z -12..0 at T), on the outer wall past the purple room's
    # stair (x -21..-18, z -10..-4): behind it they would be out of sight
    extinguisher_cabinet(b, PAL, (X(-22), 1.3, Z(-1.1)), (s, 0, 0))
    REG.begin(b, "dienstplan@%.1f,%.1f" % (X(-22), Z(-2.6)))
    wbx(b, PAL["frame"], (X(-22), 1.65, Z(-2.6)), (s, 0, 0), 0.95, 0.65, 0.03)
    panel(b, PAL["oak"], (X(-22), 1.65, Z(-2.6)), (s, 0, 0), 0.85, 0.55, o=0.032)
    for (du, dv, w, h) in ((-0.22, 0.08, 0.2, 0.28), (0.02, 0.1, 0.2, 0.28), (0.25, 0.04, 0.2, 0.28), (-0.1, -0.17, 0.28, 0.14)):
        Uv, Vv = frame((s, 0, 0))
        panel(b, PAL["white"], Vector((X(-22), 1.65, Z(-2.6))) + Uv * du + Vv * dv, (s, 0, 0), w, h, o=0.036)
    REG.end()
    sign(b, PAL, (X(-22), 2.1, Z(-2.6)), (s, 0, 0), 0.95, 0.16, ["Dienstplan"], fg="black", o=0.034, pad=0.01,
         sid="dienstplan@%.1f,%.1f/t" % (X(-22), Z(-2.6)))
    for yy in (2.75, 2.92):
        b.cyl(PAL["steel"], 0.05, (X(-21.9), yy, Z(-11.9)), (X(-21.9), yy, Z(-0.1)), seg=8)
    # the bores, z -14..0 of this half: lamps and cables on all four tunnel walls, clear of the doors
    walls = [(-14.24, 1, [(-6.9, -5.1)]), (-10.04, -1, [(-4.9, -3.1)]), (10.04, 1, []), (14.24, -1, [])]
    for (wx, nx, doors) in walls:
        for z in (-12.5, -9.0, -1.5):
            if any(d0 - 0.4 < z < d1 + 0.4 for (d0, d1) in doors):
                continue
            bore_lamp(b, PAL, X(wx), Z(z), s * nx)
        spans, za = [], -14.0
        for (d0, d1) in doors:
            spans.append((za, d0 - 0.1))
            za = d1 + 0.1
        spans.append((za, 0.0))
        for (z0, z1) in spans:
            for k, yy in enumerate((1.32, 1.42, 1.52)):
                b.cyl(PAL["black"] if k != 1 else PAL["dark"], 0.03, (X(wx + nx * 0.05), yy, Z(z0)), (X(wx + nx * 0.05), yy, Z(z1)), seg=6)
            zz = z0 + 0.6
            while zz < z1 - 0.3:
                bx(b, PAL["grey"], *sorted((X(wx), X(wx + nx * 0.09))), 1.26, 1.58, *sorted((Z(zz) - 0.02, Z(zz) + 0.02)))
                zz += 1.5
    for (wx, nx, km) in ((-10.04, -1, "3,8"), (10.04, 1, "3,8")):
        sign(b, PAL, (X(wx), 1.9, Z(-7.0)), (s * nx, 0, 0), 0.4, 0.22, ["km " + km], fg="black", bg="white", o=0.004, pad=0.02,
             sid="km@%.1f,%.1f" % (X(wx), Z(-7.0)))


def build_plant(PAL):
    b = Builder()
    plant_room(b, PAL)  # (both halves)
    for s in (1, -1):
        corridor_props(b, PAL, s)
        bore_props(b, PAL, s)
        plant_phase3(b, PAL, s)
    b.finish("ug-plant.glb", bake=False, uv2=1024, quantize=True)

