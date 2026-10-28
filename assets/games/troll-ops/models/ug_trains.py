"""
Undergrin's two trains (ug-trains.glb): the yellow U-Bahn cars inside and
out, the gangways, the cabs with their TROLLHALLA blinds, the trollface ads;
from phase 2 of "Troll Forces: Undergrin in Blender" the cream lining, the
window mullions, the seats' places and pinstripe, the glass screens and
yellow poles at the bays' ends, the grab rails and straps, the LED strips
over the doors, the thresholds, the car numbers, U badges and open buttons,
the cab's pillar, line badge, tail lights and coupler. See ug_kit.py.
"""
from ug_kit import *  # noqa: F401,F403


# ================================================================= TRAINS

CAR_NO = {(1, CAR_Z[0]): "1047", (1, CAR_Z[1]): "1048", (-1, CAR_Z[0]): "1123", (-1, CAR_Z[1]): "1124"}

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
    bx(b, PAL["dark"], X(xc - 1.6), X(xc + 1.6), T, floor - 0.03, Z(z0), Z(z1))   # under the floor plate (no shared top)
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
            # the inside's cream lining
            Uv, Vv = frame((-s * sx, 0, 0))
            lo, hi = sorted((s * sx * Z(za), s * sx * Z(zb)))
            rect(b, PAL["liner"], Vector((X(x - sx * 0.043), 0, 0)), Uv, Vv, lo, hi, floor, roof - 0.02)
            # window band on the outside and inside faces, its panes split by black mullions
            for face in (sx, -sx):
                fx = x + face * 0.045
                Uv, Vv = frame((s * face, 0, 0))
                lo, hi = sorted((-s * face * Z(za + 0.18), -s * face * Z(zb - 0.18)))
                rect(b, PAL["band"], Vector((X(fx), 0, 0)), Uv, Vv, lo, hi, floor + 1.0, floor + 1.95)
                rect(b, PAL["black"], Vector((X(fx + face * 0.002), 0, 0)), Uv, Vv, lo, hi, floor + 1.62, floor + 1.66)
                panes = max(1, round((hi - lo) / 1.3))
                for k in range(1, panes):
                    u = lo + k * (hi - lo) / panes
                    rect(b, PAL["black"], Vector((X(fx + face * 0.002), 0, 0)), Uv, Vv, u - 0.03, u + 0.03, floor + 1.0, floor + 1.95)
        for d in DOOR_OFF:
            for dz in (-1, 1):
                pz = cz + d + dz * (DOOR_W / 2 + 0.07)
                bx(b, PAL["door"], X(x) - 0.05, X(x) + 0.05, floor, roof, Z(pz - 0.07), Z(pz + 0.07))
            bx(b, PAL["door"], X(x) - 0.05, X(x) + 0.05, floor + 2.1, roof, Z(cz + d - DOOR_W / 2), Z(cz + d + DOOR_W / 2))
            # inside over the door: the LED strip with the train's Ziel
            n_in = (-s * sx, 0, 0)
            dc = (X(x - sx * 0.05), floor + 2.2, Z(cz + d))
            panel(b, PAL["black"], dc, n_in, 1.1, 0.15, o=0.002)
            text(b, PAL["board_o"], "TROLLHALLA", dc, n_in, 0.08, o=0.005)
            # the door's threshold, yellow on the floor inside
            xa, xb = sorted((X(x - sx * 0.05), X(x - sx * 0.35)))
            hrect(b, PAL["nosing"], xa, xb, *sorted((Z(cz + d - DOOR_W / 2), Z(cz + d + DOOR_W / 2))), floor + 0.003)
            # the green open buttons on the pillars, outside
            for dz in (-1, 1):
                pz = cz + d + dz * (DOOR_W / 2 + 0.07)
                disc(b, PAL["green"], (X(x + sx * 0.05), floor + 1.2, Z(pz)), (s * sx, 0, 0), 0.04, seg=10, o=0.003)
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
        # the car's number low by each end, the U badge between the doors
        for ez in (z0 + 0.9, z1 - 0.9):
            text(b, PAL["dark"], CAR_NO[(s, cz)], (X(x + sx * 0.045), floor + 0.55, Z(ez)), (s * sx, 0, 0), 0.09, o=0.004)
        for d in (-1.9, 1.9):
            sign(b, PAL, (X(x + sx * 0.045), floor + 0.6, Z(cz + d)), (s * sx, 0, 0), 0.3, 0.3, ["U"], fg="white", bg="roundelblue",
                 o=0.004, pad=0.03, face=None, sid="train@%.1f,%.1f/U%+d" % (X(x), Z(cz + d), sx))
    # roof: a shallow dome, light grey on top with the body's yellow at the eaves
    prof = [(xc - hw, roof - 0.01), (xc + hw, roof - 0.01), (xc + hw - 0.1, roof + 0.18), (xc + hw * 0.6, roof + 0.32), (xc - hw * 0.6, roof + 0.32), (xc - hw + 0.1, roof + 0.18)]
    b.prism(PAL["lightgrey"], [(X(px), py) for (px, py) in prof], Z(z0), Z(z1), axis="z")
    for (bz, bl) in ((cz - 4.0, 1.6), (cz, 2.8), (cz + 4.0, 1.6)):
        bx(b, PAL["grey"], *sorted((X(xc - 0.6), X(xc + 0.6))), roof + 0.32, roof + 0.5, *sorted((Z(bz - bl / 2), Z(bz + bl / 2))))
        bx(b, PAL["dark"], *sorted((X(xc - 0.62), X(xc + 0.62))), roof + 0.5, roof + 0.52, *sorted((Z(bz - bl / 2), Z(bz + bl / 2))))
    # the overhead grab rails, and straps along the seat bays (none in front of the posters, CLAUDE.md rule 9)
    for sx in (-1, 1):
        rx = xc + sx * 0.75
        za, zb = sorted((z0 + 1.6, z1 - 1.6))
        b.cyl(PAL["steel"], 0.018, (X(rx), roof - 0.12, Z(za)), (X(rx), roof - 0.12, Z(zb)), seg=6)
        for e in (za, zb):
            b.cyl(PAL["steel"], 0.015, (X(rx), roof - 0.12, Z(e)), (X(rx), roof, Z(e)), seg=6)
        poster_z = cz - 2.0 if sx < 0 else cz + 2.0
        for sz in (cz - 1.9, cz + 1.9):
            for k in range(-2, 3):
                z = sz + k * 0.42
                if abs(z - poster_z) < 1.3:
                    continue
                b.cyl(PAL["black"], 0.01, (X(rx), roof - 0.12, Z(z)), (X(rx), floor + 2.0, Z(z)), seg=4)
                bx(b, PAL["nosing"], *sorted((X(rx - 0.012), X(rx + 0.012))), floor + 1.92, floor + 2.0, Z(z) - 0.04, Z(z) + 0.04)
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
            panel(b, PAL["black"], (X(xc), floor + 1.55, ezw), nrm, 0.08, 0.9, o=0.072)
            panel(b, PAL["black"], (X(xc), floor + 1.08, ezw), nrm, 2.7, 0.05, o=0.072)
            sign(b, PAL, (X(xc - 1.05), floor + 2.05, ezw), nrm, 0.3, 0.26, ["G"], fg="white", bg="stripe", o=0.075, pad=0.02,
                 face=None, sid="cab@%.1f,%.1f/G" % (X(xc), ezw))
            for sx in (-1, 1):
                panel(b, PAL["roundel"], (X(xc + sx * 1.45), floor + 0.45, ezw), nrm, 0.14, 0.14, o=0.07)
            bx(b, PAL["black"], *sorted((X(xc - 0.25), X(xc + 0.25))), floor - 0.35, floor - 0.05, *sorted((ezw, ezw + s * end * 0.35)))
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
            # three places a bench: the seams, the yellow pinstripe on the backs
            xa, xb = sorted((X(x_in), X(x_in - sx * 0.5)))
            for k in (-1, 1):
                zz = Z(sz + k * 0.333)
                hrect(b, PAL["seam"], xa, xb, zz - 0.012, zz + 0.012, floor + 0.502)
                rect(b, PAL["seam"], (X(x_in - sx * 0.102), 0, 0), *frame((-s * sx, 0, 0)), *sorted((s * sx * (zz - 0.012), s * sx * (zz + 0.012))), floor + 0.5, floor + 0.95)
            rect(b, PAL["nosing"], (X(x_in - sx * 0.102), 0, 0), *frame((-s * sx, 0, 0)), *sorted((s * sx * Z(sz - 1.0), s * sx * Z(sz + 1.0))), floor + 0.8, floor + 0.82)
            # the screens at the bay's ends (their glass left out: flat paint can't
            # be seen through, so only the steel frame shows), the yellow pole at
            # each screen's aisle corner
            for e in (-1, 1):
                ez = sz + e * 0.97
                za, zb = sorted((Z(ez - 0.015), Z(ez + 0.015)))
                bx(b, PAL["steel"], xa, xb, floor + 0.5, floor + 0.54, za, zb)
                bx(b, PAL["steel"], xa, xb, floor + 1.76, floor + 1.8, za, zb)
                bx(b, PAL["steel"], *sorted((X(x_in), X(x_in - sx * 0.04))), floor + 0.54, floor + 1.76, za, zb)
                b.cyl(PAL["nosing"], 0.02, (X(x_in - sx * 0.5), floor, Z(ez)), (X(x_in - sx * 0.5), roof, Z(ez)), seg=8)


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
    b.finish("ug-trains.glb", bake=False, uv2=2048, quantize=True)

