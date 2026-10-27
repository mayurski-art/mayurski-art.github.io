"""
Undergrin's shell (ug-shell.glb): outer walls, the concourse slab with its
wells, columns, the coffered platform ceiling, the bores' linings and
portals, the plant room and corridor walls, the hall and atrium walls, the
arches, the skylight vaults, the shop walls, the atrium's skylight grid.
See ug_kit.py.
"""
from ug_kit import *  # noqa: F401,F403


# ================================================================== SHELL

def tunnel(b, PAL, side, z0, z1, skip_outer=False, skip_inner=False):
    """Tunnel lining (inside faces) of a bore between z0..z1; the outer /
    inner straight wall can be left out for a doorway."""
    cx = TUN_CX * (-1 if side == "W" else 1)
    out_sgn = -1 if side == "W" else 1           # which x side is the outer wall
    hw, sp, rv = TUN_HW, TUN_SPRING, TUN_CROWN - TUN_SPRING
    arc = [(hw * math.cos(math.pi * i / 10), sp + rv * math.sin(math.pi * i / 10)) for i in range(11)]  # +x .. -x
    prof = [(hw, 0.0), (hw, sp)] + arc[1:-1] + [(-hw, sp), (-hw, 0.0)]
    pts = [(cx + px, py) for (px, py) in prof]
    for (p0, p1) in zip(pts[:-1], pts[1:]):
        vert = abs(p0[0] - p1[0]) < 1e-6 and abs(p0[1] - p1[1]) > 0.5
        if vert:
            sgn = 1 if p0[0] > cx else -1
            if (sgn == out_sgn and skip_outer) or (sgn == -out_sgn and skip_inner):
                continue
        # (straight walls 1 cm proud of the wall boxes behind them: they z-fought)
        q = [(px - 0.01 * (1 if px > cx else -1) if abs(abs(px - cx) - hw) < 1e-6 else px, py) for (px, py) in (p0, p1)]
        quad = [(q[0][0], q[0][1], z0), (q[1][0], q[1][1], z0), (q[1][0], q[1][1], z1), (q[0][0], q[0][1], z1)]
        # face it into the bore (the game culls back faces): flip when its
        # normal points away from the tunnel axis
        e1 = Vector(quad[1]) - Vector(quad[0])
        e2 = Vector(quad[2]) - Vector(quad[1])
        mid = (Vector(quad[0]) + Vector(quad[2])) / 2
        if e1.cross(e2).dot(Vector((cx, sp, mid.z)) - mid) < 0:
            quad = quad[::-1]
        quad4(b, PAL["tunnel"], quad)


def portal(b, PAL, side, z, sgn):
    """Headwall over a tunnel mouth at z: the bore's rectangle minus the
    arch, from the lining's springing up to the station ceiling."""
    cx = TUN_CX * (-1 if side == "W" else 1)
    hw, sp, rv = TUN_HW, TUN_SPRING, TUN_CROWN - TUN_SPRING
    pts = [(cx - hw, sp, z), (cx - hw, SLAB0, z), (cx + hw, SLAB0, z), (cx + hw, sp, z)]
    pts += [(cx + hw * math.cos(math.pi * i / 10), sp + rv * math.sin(math.pi * i / 10), z) for i in range(1, 10)]
    quad4(b, PAL["grey"], pts)
    quad4(b, PAL["grey"], pts[::-1])          # seen from the platform and from the bore
    # the 0.3 inner wall's end face beside the portal
    xi = cx + hw if side == "W" else cx - hw
    xo = -9.75 if side == "W" else 9.75
    face = [(xi, 0.0, z), (xo, 0.0, z), (xo, SLAB0, z), (xi, SLAB0, z)]
    quad4(b, PAL["grey"], face)
    quad4(b, PAL["grey"], face[::-1])


def station_shell(b, PAL, s):
    """Everything in section 4.1 that is wall, slab or column, for the
    north station (s = 1) or its 180-degree twin (s = -1)."""
    X = lambda x: s * x
    Z = lambda z: s * z
    W = PAL["wall"]
    # outer walls: 1.5 m thick outside x +-22 / z +-44, platform level to the shop ceilings
    bx(b, W, X(-22), X(-23.5), 0, CEIL_SHOP + 0.3, Z(-44), Z(0))
    bx(b, W, X(22), X(23.5), 0, CEIL_SHOP + 0.3, Z(-44), Z(0))
    bx(b, W, X(-23.5), X(23.5), 0, CEIL_SHOP + 0.3, Z(-44), Z(-45.5))
    # brick accent band on the side-platform back walls and the end wall
    band_z(b, PAL["brick"], X(-22), s, P, 3.4, Z(-44), Z(-14))
    band_z(b, PAL["brick"], X(22), -s, P, 3.4, Z(-44), Z(-14))
    band_x(b, PAL["brick"], Z(-44), s, P, 3.4, X(-22), X(22))
    # a white rail strip and a blue stripe over the brick
    band_z(b, PAL["stripe"], X(-22), s, 3.45, 3.6, Z(-44), Z(-14))
    band_z(b, PAL["stripe"], X(22), -s, 3.45, 3.6, Z(-44), Z(-14))
    band_x(b, PAL["stripe"], Z(-44), s, 3.45, 3.6, X(-22), X(22))
    # the concourse slab over the north half, open at the wells
    holes = [ESC_WELL, WSTAIR_WELL, PURPLE_WELL, (LIGHT_WELL[0], LIGHT_WELL[1], LIGHT_WELL[2], 0.0)]
    holes = [(X(a), X(c), Z(d), Z(e)) for (a, c, d, e) in holes]
    holes = [(min(a, c), max(a, c), min(d, e), max(d, e)) for (a, c, d, e) in holes]
    for (a, c, d, e) in slab_minus(b, PAL["slab"], X(-22), X(22), Z(-44), Z(0), SLAB0, U, holes):
        hrect(b, PAL["floor"], a, c, d, e, U + 0.003)
    # columns on the island
    for (cxp, cz) in COLS:
        bx(b, PAL["grey"], X(cxp) - 0.35, X(cxp) + 0.35, P, SLAB0, Z(cz) - 0.35, Z(cz) + 0.35)
    # coffers: beams under the slab, clipped round the wells
    wells = holes[:2]
    for k in range(10):
        zc = Z(-43.0 + k * 3.2)
        for (a, c, d, e) in sub_rects(sub_rects([(-22.0, 22.0, zc - 0.14, zc + 0.14)], wells[0]), wells[1]):
            bx(b, PAL["beam"], a, c, SLAB0 - 0.32, SLAB0, d, e)
    for k in range(11):
        xc = X(-20.0 + k * 4.0)
        for (a, c, d, e) in sub_rects(sub_rects([(xc - 0.14, xc + 0.14, min(Z(-44), Z(-14)), max(Z(-44), Z(-14)))], wells[0]), wells[1]):
            bx(b, PAL["beam"], a, c, SLAB0 - 0.32, SLAB0, d, e)
    # tunnel portals in the station's south face (z -14) and the headwall
    for side in ("W", "E"):
        portal(b, PAL, side, Z(-14), s)
    # the solids either side of the north walkway (x -2..2, z -14..-8), track to slab
    for (a, c) in ((-9.75, -2.0), (2.0, 9.75)):
        bx(b, W, X(a), X(c), 0, SLAB0, Z(-13.95), Z(-8))
    bx(b, W, X(-2), X(2), 3.0, SLAB0, Z(-13.95), Z(-8))        # walkway ceiling
    # the plant room's door is the walkway's full 4 m: only a lintel from 2.4
    bx(b, W, X(-2), X(2), DOOR_H, SLAB0, Z(-8), Z(-7.7))
    # the solid east of the E bore between the side platform's end and the far corridor
    bx(b, W, X(14.3), X(22), 0, SLAB0, Z(-13.95), Z(0))
    # the bores' 0.3 inner walls (inside the bores), the plant room's sides:
    # the W one has the door at z -4, the E one's door is on the other half
    wall_z(b, PAL["grey"], X(-10.05), X(-9.75), 0, SLAB0, Z(-14), Z(0), doors=[(Z(-4), 1.8, DOOR_H)])
    bx(b, PAL["grey"], X(9.75), X(10.05), 0, SLAB0, Z(-14), Z(0))
    # W bore tunnel lining z -14..0 (doors: outer at z -6 to the corridor, inner at z -4 to the plant room)
    side = "W" if s > 0 else "E"
    segs = [(-14, -6.9, False, False), (-6.9, -5.1, True, False), (-5.1, -4.9, False, False), (-4.9, -3.1, False, True), (-3.1, 0, False, False)]
    for (z0, z1, so, si) in segs:
        tunnel(b, PAL, side, Z(z0), Z(z1), skip_outer=so, skip_inner=si)
    # the E bore (its doors are on the other half)
    tunnel(b, PAL, "E" if s > 0 else "W", Z(-14), Z(0))
    # service corridor x -22..-15.75, z -12..0 at T: the wall to the bore, end walls
    wall_z(b, W, X(-15.75), X(-14.25), 0, SLAB0, Z(-12), Z(0), doors=[(Z(-6), 1.8, DOOR_H)])
    bx(b, W, X(-22), X(-15.75), 0, SLAB0, Z(-12.3), Z(-12))
    bx(b, W, X(-22), X(-15.75), 0, SLAB0, Z(0), Z(0.3))
    # the solid between the W side platform's end (z -14) and the corridor (z -12)
    bx(b, W, X(-22), X(-14.3), 0, SLAB0, Z(-14), Z(-12.3))
    # concourse: hall walls x +-16 (6..9) with doorways at z -33, -19 (hall) and -8 (atrium)
    hall_doors = [(Z(-33), 1.8, DOOR_H), (Z(-19), 1.8, DOOR_H), (Z(-8), 1.8, DOOR_H)]
    for sx in (-1, 1):
        xa, xb = X(sx * 16), X(sx * 16.3)
        wall_z(b, W, xa, xb, U, ATRIUM_CEIL, Z(-16), Z(0), doors=[hall_doors[2]])
        wall_z(b, W, xa, xb, U, HALL_WALL, Z(-40), Z(-16), doors=hall_doors[:2])
        fs = -s * sx                                                   # into the hall
        # the shop-side strip from the hall wall top to the shop ceiling
        bx(b, W, X(sx * 16), X(sx * 16.3), HALL_WALL, CEIL_SHOP, Z(-40), Z(-16))
        # paint: salmon band, blue stripe, on the hall face
        hx = X(sx * 16)
        # (a band's doorways give the door top as a height, not a rise)
        band_doors = [(zc, w, U + h) for (zc, w, h) in hall_doors]
        band_z(b, PAL["salmon"], hx, fs, U + 1.0, U + 2.9, Z(-40), Z(-16), doors=band_doors[:2])
        band_z(b, PAL["stripe"], hx, fs, U + 3.2, U + 3.35, Z(-40), Z(-16))
        band_z(b, PAL["salmon"], hx, fs, U + 1.0, U + 2.9, Z(-16), Z(0), doors=[band_doors[2]])
        band_z(b, PAL["stripe"], hx, fs, U + 3.2, U + 3.35, Z(-16), Z(0))
        # upper atrium wall: a lunette window into the dark on this half
        for zc in (-9.0,):
            arcp = [Vector((hx, 10.0 + 4.0 * math.sin(math.pi * i / 12), Z(zc) + 4.0 * math.cos(math.pi * i / 12))) for i in range(13)]
            quad4(b, PAL["glass"], [Vector((hx + fs * 0.01, p.y, p.z)) for p in arcp])
            for (p0, p1) in zip(arcp[:-1], arcp[1:]):
                b.bar(PAL["mullion"], (hx + fs * 0.02, p0.y, p0.z), (hx + fs * 0.02, p1.y, p1.z), 0.12)
            b.bar(PAL["mullion"], (hx + fs * 0.02, 10.0, Z(zc) - 4.0), (hx + fs * 0.02, 10.0, Z(zc) + 4.0), 0.12)
            for sp in (-1.4, 1.4):
                b.bar(PAL["mullion"], (hx + fs * 0.02, 10.0, Z(zc) + sp), (hx + fs * 0.02, 10.0 + 4.0 * math.sin(math.acos(sp / 4.0)), Z(zc) + sp), 0.08)
    # hall north wall z -40 (U..12: the vault's tympanum), salmon above the band
    bx(b, W, X(-16.15), X(16.15), U, VAULT_CROWN + 0.3, Z(-40), Z(-40.3))
    band_x(b, PAL["salmon"], Z(-40), s, U + 1.0, U + 2.9, X(-16), X(16))
    band_x(b, PAL["stripe"], Z(-40), s, U + 3.2, U + 3.35, X(-16), X(16))
    band_x(b, PAL["salmon"], Z(-40), s, HALL_WALL + 0.2, VAULT_CROWN + 0.3, X(-16), X(16))
    # the atrium threshold at z -16: piers, the 14 m round arch (springing 7.5) and the spandrel to 15
    zt = Z(-15.75)
    for (a, c) in ((-16, -7), (7, 16)):
        bx(b, W, X(a), X(c), U, ATRIUM_CEIL, zt - 0.25, zt + 0.25)
    R = ARCH_SPAN / 2
    arcp = [(R * math.cos(math.pi * i / 14), ARCH_SPRING + R * math.sin(math.pi * i / 14)) for i in range(15)]  # +x .. -x
    for zz in (zt - 0.25, zt + 0.25):
        pts = [(-R, ARCH_SPRING, zz), (-R, ATRIUM_CEIL, zz), (R, ATRIUM_CEIL, zz), (R, ARCH_SPRING, zz)] + [(x, y, zz) for (x, y) in arcp[1:-1]]
        quad4(b, W, pts)
    for (p0, p1) in zip(arcp[:-1], arcp[1:]):
        quad4(b, PAL["salmon"], [(p0[0], p0[1], zt - 0.25), (p1[0], p1[1], zt - 0.25), (p1[0], p1[1], zt + 0.25), (p0[0], p0[1], zt + 0.25)])
    # salmon band and stripe on both faces of the threshold piers
    for (face_z, sign) in ((zt - 0.25 * s, -s), (zt + 0.25 * s, s)):
        for (a, c) in ((-16, -7), (7, 16)):
            band_x(b, PAL["salmon"], face_z, sign, U + 1.0, U + 2.9, X(a), X(c))
            band_x(b, PAL["stripe"], face_z, sign, U + 3.2, U + 3.35, X(a), X(c))
    # the hall's barrel skylight: glass, ribs every 4 m, purlins
    xs = [-16 + 32 * i / 16 for i in range(17)]
    prof = [(x, vault_y(x)) for x in xs]
    strip(b, PAL["glass"], prof, Z(-40), Z(-16))
    for k in range(6):
        zc = Z(-38 + 4 * k)
        rib = [(x, y - 0.22) for (x, y) in prof]
        strip(b, PAL["mullion"], rib, zc - 0.15, zc + 0.15)
        for zz in (zc - 0.15, zc + 0.15):
            for (p0, p1) in zip(prof[:-1], prof[1:]):
                quad4(b, PAL["mullion"], [(p0[0], p0[1] - 0.22, zz), (p1[0], p1[1] - 0.22, zz), (p1[0], p1[1], zz), (p0[0], p0[1], zz)])
    for x in (-12, -8, -4, 0, 4, 8, 12):
        y = vault_y(x)
        bx(b, PAL["mullion"], x - 0.1, x + 0.1, y - 0.2, y - 0.02, Z(-40), Z(-16))
    # the vault's edge beam over the hall walls
    for sx in (-1, 1):
        bx(b, PAL["salmon"], X(sx * 16) - 0.15 * sx * s, X(sx * 16.3), HALL_WALL - 0.05, HALL_WALL + 0.25, Z(-40), Z(-16))


def shop_walls(b, PAL):
    """Shop row walls (not mirrored: the two rows' partitions differ by
    2 m, 4.3): partitions 0.3 thick with a 1.8 doorway at x -19 / 19, end
    walls at z +-40, flat ceilings at 9.6."""
    W = PAL["wall"]
    for (sx, shops) in ((-1, SHOPS_W), (1, SHOPS_E)):
        xa, xb = sorted((sx * 22, sx * 16.3))
        parts = sorted({z for (z0, z1, _n) in shops for z in (z0, z1)})
        for z in parts:
            if abs(z) == 40 and z * sx < 0:
                # the row's far end: a plain end wall
                bx(b, W, xa, xb, U, CEIL_SHOP, z, z + (0.3 if z > 0 else -0.3))
            elif abs(z) == 40:
                # the stair end: the side stair's well (x 17.5..22) runs on to
                # the outer end wall at +-44 beside the hall's 4 m end block
                ze = 44 if z > 0 else -44
                bx(b, W, sx * 17.5, sx * 16.3, U, CEIL_SHOP, z, ze)
                bx(b, PAL["ceiling"], sx * 22, sx * 17.5, CEIL_SHOP, CEIL_SHOP + 0.3, z, ze)
            else:
                wall_x(b, W, z - 0.15, z + 0.15, U, CEIL_SHOP, xa, xb, doors=[(sx * 19, 1.8, DOOR_H)])
        bx(b, PAL["ceiling"], xa, xb, CEIL_SHOP, CEIL_SHOP + 0.3, -40, 40)


def build_shell(PAL):
    b = Builder()
    for s in (1, -1):
        station_shell(b, PAL, s)
    shop_walls(b, PAL)
    # the atrium ceiling at 15 with the 20 x 20 skylight grid (one piece)
    rect(b, PAL["ceiling"], (-16, ATRIUM_CEIL, -16), (1, 0, 0), (0, 0, 1), 0, 32, 0, 32)
    rect(b, PAL["glass"], (-10, ATRIUM_CEIL - 0.02, -10), (1, 0, 0), (0, 0, 1), 0, 20, 0, 20)
    for k in range(11):
        t = -10 + 2 * k
        bx(b, PAL["mullion"], t - 0.08, t + 0.08, ATRIUM_CEIL - 0.3, ATRIUM_CEIL - 0.02, -10, 10)
        bx(b, PAL["mullion"], -10, 10, ATRIUM_CEIL - 0.3, ATRIUM_CEIL - 0.02, t - 0.08, t + 0.08)
    bx(b, PAL["mullion"], -10.2, 10.2, ATRIUM_CEIL - 0.45, ATRIUM_CEIL - 0.02, -10.2, -9.9)
    bx(b, PAL["mullion"], -10.2, 10.2, ATRIUM_CEIL - 0.45, ATRIUM_CEIL - 0.02, 9.9, 10.2)
    bx(b, PAL["mullion"], -10.2, -9.9, ATRIUM_CEIL - 0.45, ATRIUM_CEIL - 0.02, -10.2, 10.2)
    bx(b, PAL["mullion"], 9.9, 10.2, ATRIUM_CEIL - 0.45, ATRIUM_CEIL - 0.02, -10.2, 10.2)
    # the light well's slab edge lining (the slab is cut; this is the reveal's paint)
    b.finish("ug-shell.glb", bake=False, uv2=2048)

