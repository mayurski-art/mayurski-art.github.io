"""
Undergrin's platforms (ug-platforms.glb): the platform slabs, their dark
faces, the yellow lines and zones, MIND THE GRIN, the bore floors with
ballast, sleepers and rails, the bore-end and nose stairs, the walkway and
corridor floors, the plant room floor. See ug_kit.py.
"""
from ug_kit import *  # noqa: F401,F403


# ============================================================== PLATFORMS

def station_platforms(b, PAL, s):
    X = lambda x: s * x
    Z = lambda z: s * z
    F = PAL["pfloor"]
    # slabs 0..0.95: west side, island, east side
    for (a, c) in ((-22, -14.25), (-9.75, 9.75), (14.25, 22)):
        bx(b, F, X(a), X(c), T, P, Z(-44), Z(-14))
    # dark platform faces toward the bores, with the yellow edge strip + MIND THE GRIN
    for (xe, sgn) in ((-14.25, 1), (-9.75, -1), (9.75, 1), (14.25, -1)):
        # face normal points into the bore: for x -14.25 the bore is at +x
        nx = sgn
        Uv, Vv = frame((s * nx, 0, 0))
        rect(b, PAL["dark"], Vector((X(xe) + s * nx * 0.005, 0, 0)), Uv, Vv, *sorted((-s * nx * Z(-44), -s * nx * Z(-14))), T + 0.02, P)
        # the yellow line 0.12..0.45 in from the edge, the full length
        ya, yb = sorted((X(xe) - s * nx * 0.12, X(xe) - s * nx * 0.45))
        hrect(b, PAL["yellow"], ya, yb, Z(-44), Z(-14), P + 0.004)
        # MIND THE GRIN, twice per edge, inside the line, reading for someone facing the track
        for zc in (-36, -22):
            c = (X(xe) - s * nx * 1.0, P + 0.006, Z(zc))
            text(b, PAL["dark"], "MIND THE GRIN", c, (0, 1, 0), 0.5, o=0.0, up=(s * nx, 0, 0))
    # yellow zones: round the escalator foot and the west stair's foot
    hrect(b, PAL["yellow"], X(-8), X(8), Z(-31.5), Z(-25.5), P + 0.003)
    hrect(b, PAL["yellow"], X(-21.5), X(-17.5), Z(-44), Z(WSTAIR["foot"]), P + 0.003)
    # bore floors: ballast flush with the track floor (y 0, what players walk
    # on), sleepers painted on it, rails 0..0.12 at +-0.75 where the
    # colliders have them: clear of the parked train and the bore-end steps
    rails = {"W": [(-44, -42), (-16, 0)], "E": [(-40.5, 0)]}
    for side in ("W", "E"):
        a, c = BORE_W[side]
        bx(b, PAL["ballast"], X(a), X(c), T - 0.3, T + 0.01, Z(-44), Z(0))   # a hair over the engine's ground plane
        cx = BORE_CX[side]
        for (z0, z1) in rails[side]:
            for rx in (-0.75, 0.75):
                bx(b, PAL["rail"], X(cx + rx) - 0.06, X(cx + rx) + 0.06, T, T + 0.12, Z(z0), Z(z1))
            k = 0.35
            while z0 + k < z1:
                z = z0 + k
                hrect(b, PAL["sleeper"], X(cx) - 1.25, X(cx) + 1.25, Z(z) - 0.12, Z(z) + 0.12, T + 0.014)
                k += 0.7
    # track-level lamps are concourse's business; nothing here
    # bore-end stairs: at the empty bore's north end (E for the north station) up to both platforms
    e = "E" if s > 0 else "W"
    a, c = BORE_W["E"]
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


def build_platforms(PAL):
    b = Builder()
    for s in (1, -1):
        station_platforms(b, PAL, s)
    # the plant room floor
    bx(b, PAL["floor"], -9.75, 9.75, T, T + 0.02, -8, 8)
    b.finish("ug-platforms.glb", bake=False, uv2=1024)

