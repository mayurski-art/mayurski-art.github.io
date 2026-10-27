"""
Undergrin's escalators and stairs (ug-escalators.glb): both escalator
pairs with their balustrades, the well rails, the side stairs, the purple
and red steel stairs, the light-well rails. See ug_kit.py.
"""
from ug_kit import *  # noqa: F401,F403


# ============================================================= ESCALATORS

def escalator_lane(b, PAL, xc, w, z_foot, n, rise, run, s, y0):
    """One lane: dark treads with yellow nosings, wood-brown balustrade
    panels with a black handrail, the comb plates and the top deck."""
    half = w / 2
    z_top = z_foot + s * run * n
    top = y0 + rise * n
    for i in range(n):
        za = z_foot + s * run * i
        yt = y0 + rise * (i + 1)
        # tread (top quad) and riser (quad)
        hrect(b, PAL["dark"], xc - half + 0.1, xc + half - 0.1, za, za + s * run, yt)
        rect(b, PAL["black"], (xc - half + 0.1, yt - rise, za), (1, 0, 0), (0, 1, 0), 0, w - 0.2, 0, rise)
        hrect(b, PAL["nosing"], xc - half + 0.1, xc + half - 0.1, za, za + s * 0.06, yt + 0.004)
    # comb plates (the top one on the slab's landing, z -18.5..-17)
    bx(b, PAL["steel"], xc - half + 0.1, xc + half - 0.1, y0, y0 + 0.02, z_foot, z_foot - s * 0.8)
    bx(b, PAL["steel"], xc - half + 0.1, xc + half - 0.1, top, top + 0.02, z_top, z_top + s * 1.5)


def escalator_sides(b, PAL, s, z_foot, n, rise, run, y0):
    """The pair's balustrades as the colliders have them: solid from the
    platform to 1.2 over the treads, 0.3 thick outside (x +-2.6..2.9) and
    one block between the lanes (x -1.2..1.2), wood-brown, with steel caps
    and black handrails along the lanes."""
    z_top = z_foot + s * run * n
    lo = y0 + 1.35                      # the slope runs mid-way between the collider's steps
    hi = y0 + rise * n + 1.35
    prof = [(z_foot, y0), (z_foot, lo), (z_top, hi), (z_top, y0)]
    for (xa, xb) in ((-2.9, -2.6), (-1.2, 1.2), (2.6, 2.9)):
        b.prism(PAL["wood"], prof, s * xa if s > 0 else s * xb, s * xb if s > 0 else s * xa, axis="x")
        cap = [(z_foot, lo), (z_foot, lo + 0.03), (z_top, hi + 0.03), (z_top, hi)]
        b.prism(PAL["steel"], cap, min(s * xa, s * xb), max(s * xa, s * xb), axis="x")
    for x in (-2.6, -1.2, 1.2, 2.6):
        b.cyl(PAL["black"], 0.045, (s * x, lo + 0.06, z_foot), (s * x, hi + 0.06, z_top), seg=6)


def station_escalators(b, PAL, s):
    X = lambda x: s * x
    Z = lambda z: s * z
    # the twin escalators: feet z -27, rising south, tops z -18.5
    for xc in ESC["x"]:
        escalator_lane(b, PAL, X(xc), ESC["w"], Z(ESC["foot"]), ESC["n"], ESC["rise"], ESC["run"], s, P)
    escalator_sides(b, PAL, s, Z(ESC["foot"]), ESC["n"], ESC["rise"], ESC["run"], P)
    # the well rails round the escalator well at the concourse: west, east and north edges
    a, c, d, e = ESC_WELL
    rail_run(b, PAL, (X(a - 0.05), Z(d - 0.05)), (X(a - 0.05), Z(e)), U)
    rail_run(b, PAL, (X(c + 0.05), Z(d - 0.05)), (X(c + 0.05), Z(e)), U)
    rail_run(b, PAL, (X(a - 0.05), Z(d - 0.05)), (X(c + 0.05), Z(d - 0.05)), U)
    # the west side stair: x -21.5..-17.5, foot z -42.65 on the platform, 17 x 0.3 / 0.45 heading south
    w = WSTAIR
    steps_x(b, PAL, min(X(w["x0"]), X(w["x1"])), max(X(w["x0"]), X(w["x1"])), Z(w["foot"]), w["n"], w["rise"], w["run"], s, P)
    # (its east side is open, as its colliders: no balustrade)
    # the well rail on the concourse: the east edge clear of the end block (z -40..-35)
    a, c, d, e = WSTAIR_WELL
    rail_run(b, PAL, (X(c + 0.05), Z(-40)), (X(c + 0.05), Z(e)), U)
    # the purple room's steel stair: well x -21..-18, z -10..-4; bottom z -10 at T rising south to z -4 at U
    SP = {"grate": PAL["grate"], "yellow": PAL["nosing"], "steel": PAL["steel"], "toe": PAL["nosing"]}
    steel_stair(b, SP, 20, 0.3, 0.3, 3.0, Z(-10), direction=s, y0=T, x=X(-19.5), closed=True)
    a, c, d, e = PURPLE_WELL
    rail_run(b, PAL, (X(a), Z(d)), (X(a), Z(e)), U)
    rail_run(b, PAL, (X(c), Z(d)), (X(c), Z(e)), U)
    rail_run(b, PAL, (X(a), Z(d)), (X(c), Z(d)), U)
    # the light-well rails, this half's two runs (x +-4 from z -4..0, the z -4 edge)
    rail_run(b, PAL, (X(-4), Z(-4)), (X(4), Z(-4)), U)
    rail_run(b, PAL, (X(-4), Z(-4)), (X(-4), Z(0)), U)
    rail_run(b, PAL, (X(4), Z(-4)), (X(4), Z(0)), U)


def build_escalators(PAL):
    b = Builder()
    for s in (1, -1):
        station_escalators(b, PAL, s)
    b.finish("ug-escalators.glb", bake=False, uv2=1024, quantize=True)

