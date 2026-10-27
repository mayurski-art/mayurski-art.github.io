"""
Undergrin's two trains (ug-trains.glb): the yellow U-Bahn cars inside and
out, the gangways, the cabs with their TROLLHALLA blinds, the trollface ads.
See ug_kit.py.
"""
from ug_kit import *  # noqa: F401,F403


# ================================================================= TRAINS

def train_car(b, PAL, s, cz, cab_end):
    """One car of the north train (s = 1; s = -1 turns it into the south
    train's). cab_end: -1 cab on the north end, +1 south end, 0 none."""
    X = lambda x: s * x
    Z = lambda z: s * z
    xc = (TRAIN_X[0] + TRAIN_X[1]) / 2
    hw = CAR_W / 2
    L = CAR_L
    z0, z1 = cz - L / 2, cz + L / 2
    floor = P
    roof = P + 2.3
    # undercarriage (dark), bogies, the floor
    bx(b, PAL["dark"], X(xc - 1.6), X(xc + 1.6), T, floor, Z(z0), Z(z1))
    for bz in (cz - 4.2, cz + 4.2):
        bx(b, PAL["black"], X(xc - 1.2), X(xc + 1.2), T + 0.1, T + 0.5, Z(bz - 1.1), Z(bz + 1.1))
        for wz in (bz - 0.75, bz + 0.75):
            for sx in (-1, 1):
                b.cyl(PAL["black"], 0.4, (X(xc + sx * 0.72), T + 0.4, Z(wz)), (X(xc + sx * 0.9), T + 0.4, Z(wz)), seg=10)
    bx(b, PAL["mid"], X(xc - hw + 0.08), X(xc + hw - 0.08), floor - 0.03, floor, Z(z0), Z(z1))
    # side walls: body panels between the door openings, a dark window band,
    # white door pillars, the door heads; both sides alike
    edges = [z0] + [e for d in DOOR_OFF for e in (cz + d - DOOR_W / 2, cz + d + DOOR_W / 2)] + [z1]
    for sx in (-1, 1):
        x = xc + sx * (hw - 0.04)
        for i in range(0, len(edges), 2):
            za, zb = edges[i], edges[i + 1]
            bx(b, PAL["train"], X(x) - 0.04, X(x) + 0.04, floor, roof, Z(za), Z(zb))
            # window band on the outside and inside faces
            for face in (sx, -sx):
                fx = x + face * 0.045
                Uv, Vv = frame((s * face, 0, 0))
                lo, hi = sorted((-s * face * Z(za + 0.18), -s * face * Z(zb - 0.18)))
                rect(b, PAL["band"], Vector((X(fx), 0, 0)), Uv, Vv, lo, hi, floor + 1.0, floor + 1.95)
        for d in DOOR_OFF:
            for dz in (-1, 1):
                pz = cz + d + dz * (DOOR_W / 2 + 0.07)
                bx(b, PAL["door"], X(x) - 0.05, X(x) + 0.05, floor, roof, Z(pz - 0.07), Z(pz + 0.07))
            bx(b, PAL["door"], X(x) - 0.05, X(x) + 0.05, floor + 2.1, roof, Z(cz + d - DOOR_W / 2), Z(cz + d + DOOR_W / 2))
            # the open leaves, slid into their pockets: a white strip on the outside face
            for face in (sx,):
                fx = x + face * 0.05
                Uv, Vv = frame((s * face, 0, 0))
                for dz in (-1, 1):
                    lo, hi = sorted((-s * face * Z(cz + d + dz * (DOOR_W / 2 + 0.14)), -s * face * Z(cz + d + dz * (DOOR_W / 2 + 0.14 + 0.7))))
                    rect(b, PAL["door"], Vector((X(fx), 0, 0)), Uv, Vv, lo, hi, floor + 0.05, floor + 2.05)
                    rect(b, PAL["band"], Vector((X(fx + face * 0.004), 0, 0)), Uv, Vv, lo + 0.12, hi - 0.12, floor + 1.0, floor + 1.85)
        # the yellow skirt line below the floor and the cant rail stripe
        fx = xc + sx * (hw - 0.0)
        Uv, Vv = frame((s * sx, 0, 0))
        lo, hi = sorted((-s * sx * Z(z0), -s * sx * Z(z1)))
        rect(b, PAL["train"], Vector((X(fx + sx * 0.005), 0, 0)), Uv, Vv, lo, hi, floor - 0.45, floor)
        rect(b, PAL["dark"], Vector((X(fx + sx * 0.012), 0, 0)), Uv, Vv, lo, hi, floor - 0.45, floor - 0.38)
    # roof: a shallow dome, light grey on top with the body's yellow at the eaves
    prof = [(xc - hw, roof - 0.01), (xc + hw, roof - 0.01), (xc + hw - 0.1, roof + 0.18), (xc + hw * 0.6, roof + 0.32), (xc - hw * 0.6, roof + 0.32), (xc - hw + 0.1, roof + 0.18)]
    b.prism(PAL["lightgrey"], [(X(px), py) for (px, py) in prof], Z(z0), Z(z1), axis="z")
    bx(b, PAL["grey"], X(xc - 0.6), X(xc + 0.6), roof + 0.32, roof + 0.5, Z(cz - 1.4), Z(cz + 1.4))
    # ceiling (inside) with the light strip
    rect(b, PAL["white"], (X(xc) - hw + 0.08, roof - 0.02, min(Z(z0), Z(z1))), (1, 0, 0), (0, 0, 1), 0, CAR_W - 0.16, 0, L)
    rect(b, PAL["tube"], (X(xc) - 0.25, roof - 0.03, min(Z(z0 + 0.6), Z(z1 - 0.6))), (1, 0, 0), (0, 0, 1), 0, 0.5, 0, L - 1.2)
    # ends: a cab (closed, windscreen, blind, lights) or a gangway opening
    for ez, end in ((z0, -1), (z1, 1)):
        ezw = Z(ez)
        if end == cab_end:
            bx(b, PAL["train"], X(xc - hw), X(xc + hw), floor, roof + 0.2, ezw - 0.06, ezw + 0.06)
            nrm = (0, 0, s * end)
            panel(b, PAL["band"], (X(xc), floor + 1.55, ezw), nrm, 2.6, 0.9, o=0.07)
            panel(b, PAL["black"], (X(xc), roof - 0.17, ezw), nrm, 2.0, 0.34, o=0.07)
            text(b, PAL["board_o"], "TROLLHALLA", (X(xc), roof - 0.17, ezw), nrm, 0.2, o=0.085)
            for sx in (-1, 1):
                panel(b, PAL["headlight"], (X(xc + sx * 1.2), floor + 0.45, ezw), nrm, 0.35, 0.18, o=0.07)
            panel(b, PAL["dark"], (X(xc), floor - 0.2, ezw), nrm, 3.2, 0.5, o=0.02)
            # the cab's closed partition 1.35 in, white, a window into the cab
            bx(b, PAL["door"], X(xc - hw + 0.1), X(xc + hw - 0.1), floor, roof, ezw - end * s * 1.35 - 0.05, ezw - end * s * 1.35 + 0.05)
            panel(b, PAL["band"], (X(xc), floor + 1.5, ezw - end * s * 1.35), (0, 0, -s * end), 0.7, 0.6, o=0.06)
        else:
            # end wall with a 1.2 wide gangway door
            for sx in (-1, 1):
                bx(b, PAL["train"], X(xc + sx * 0.6), X(xc + sx * hw), floor, roof + 0.2, ezw - 0.05, ezw + 0.05)
            bx(b, PAL["train"], X(xc - 0.6), X(xc + 0.6), floor + 2.05, roof + 0.2, ezw - 0.05, ezw + 0.05)
    # seats: 0.5 x 2.0 blue benches against both walls at cz +-1.9 (the colliders'), backs up the wall
    for sx in (-1, 1):
        for sz in (cz - 1.9, cz + 1.9):
            x_in = xc + sx * (hw - 0.1)
            bx(b, PAL["seat"], X(x_in), X(x_in - sx * 0.5), floor + 0.25, floor + 0.5, Z(sz - 1.0), Z(sz + 1.0))
            bx(b, PAL["seat"], X(x_in), X(x_in - sx * 0.1), floor + 0.5, floor + 0.95, Z(sz - 1.0), Z(sz + 1.0))
            bx(b, PAL["dark"], X(x_in), X(x_in - sx * 0.45), floor, floor + 0.25, Z(sz - 0.9), Z(sz + 0.9))


def build_trains(PAL):
    b = Builder()
    for s in (1, -1):
        train_car(b, PAL, s, CAR_Z[0], -1)
        train_car(b, PAL, s, CAR_Z[1], 1)
        # gangway bellows between the cars
        gz = (CAR_Z[0] + CAR_Z[1]) / 2
        xc = (TRAIN_X[0] + TRAIN_X[1]) / 2
        for sx in (-1, 1):
            bx(b, PAL["black"], s * (xc + sx * 0.85), s * (xc + sx * 0.95), P, P + 2.3, s * (gz - 0.5), s * (gz + 0.5))
        bx(b, PAL["black"], s * (xc - 0.95), s * (xc + 0.95), P + 2.05, P + 2.3, s * (gz - 0.5), s * (gz + 0.5))
        bx(b, PAL["mid"], s * (xc - 0.85), s * (xc + 0.85), P - 0.03, P, s * (gz - 0.5), s * (gz + 0.5))
        # posters inside: one trollface per car on the wall over the seats
        for cz in CAR_Z:
            troll_poster(b, PAL, (s * (TRAIN_X[0] + 0.1), P + 2.07, s * (cz - 2.0)), (s, 0, 0), 0.6, 0.4, PAL["stripe"], cells=16, o=0.0)
            troll_poster(b, PAL, (s * (TRAIN_X[1] - 0.1), P + 2.07, s * (cz + 2.0)), (-s, 0, 0), 0.6, 0.4, PAL["salmon"], cells=16, o=0.0)
    b.finish("ug-trains.glb", bake=False, uv2=1024, quantize=True)

