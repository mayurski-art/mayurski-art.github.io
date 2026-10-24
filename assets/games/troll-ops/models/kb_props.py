"""
Where Kabukigrin's club props stand (phase 1: the hall, the DJ stage, the
bar, the mezzanine, the riser). Numbers come from the layout's colliders
(kabukigrin-layout.js) and the live layer's (maps/kabukigrin.js PLAN,
club-live.js): kept here next to each prop so a moved wall shows up as a
wrong number in one place.

The doc's "dock" (x -23 .. -17, z 4 .. 7.5) isn't in today's layout: Studio
put the front booth there. Its road cases stand by the stage instead.
"""
import math
import random

from map_kit import Builder

import kb_club as K

HALL = (-31.7, -14.4, 4.1, 23.8)       # x0, x1, z0, z1 to the walls' inner faces
DANCE = (-27.0, -17.0, 10.0, 20.0)
CEIL = 7.4
DC = (-22.0, 15.0)

# The faces the live layer draws that props must not cover (CLAUDE.md
# Troll Forces rule 9): centre, outward normal, width (along u), height.
# The crystal wall's lower middle is the DJ booth and the DJ themself
# (code, by design): its face is the band above them and the sides.
CODE_FACES = [
    {"id": "screen-pole", "owner": "code", "c": [-19.9, 5.1, 4.07], "n": [0, 0, 1], "u": [1, 0, 0], "w": 5.6, "h": 3.15},
    {"id": "screen-swish", "owner": "code", "c": [-21.5, 4.3, 23.75], "n": [0, 0, -1], "u": [-1, 0, 0], "w": 6.4, "h": 3.6},
    {"id": "crystal-top", "owner": "code", "c": [-31.62, 4.35, 15.0], "n": [1, 0, 0], "u": [0, 0, -1], "w": 10.0, "h": 3.2},
    {"id": "crystal-n", "owner": "code", "c": [-31.62, 1.7, 11.2], "n": [1, 0, 0], "u": [0, 0, -1], "w": 2.4, "h": 2.1},
    {"id": "crystal-s", "owner": "code", "c": [-31.62, 1.7, 18.8], "n": [1, 0, 0], "u": [0, 0, -1], "w": 2.4, "h": 2.1},
    {"id": "sign-trollcyan", "owner": "code", "c": [-31.58, 4.65, 15.0], "n": [1, 0, 0], "u": [0, 0, -1], "w": 3.3, "h": 3.3},
    {"id": "sign-dj", "owner": "code", "c": [-29.13, 1.07, 15.0], "n": [1, 0, 0], "u": [0, 0, -1], "w": 0.62, "h": 0.62},
    {"id": "bottle-wall", "owner": "code", "c": [-14.46, 2.07, 12.2], "n": [-1, 0, 0], "u": [0, 0, 1], "w": 7.6, "h": 1.65},
    {"id": "door-main", "owner": "code", "c": [-27.6, 1.7, 4.11], "n": [0, 0, 1], "u": [1, 0, 0], "w": 4.4, "h": 3.4},
    {"id": "door-back-w", "owner": "code", "c": [-27.0, 1.4, 23.79], "n": [0, 0, -1], "u": [-1, 0, 0], "w": 2.4, "h": 2.8},
    {"id": "door-back-e", "owner": "code", "c": [-16.0, 1.4, 23.79], "n": [0, 0, -1], "u": [-1, 0, 0], "w": 2.4, "h": 2.8},
    {"id": "window-tatami", "owner": "code", "c": [-29.95, 2.0, 23.79], "n": [0, 0, -1], "u": [-1, 0, 0], "w": 3.5, "h": 1.0},
    {"id": "mirror-office", "owner": "code", "c": [-13.86, 4.6, 21.6], "n": [-1, 0, 0], "u": [0, 0, 1], "w": 3.6, "h": 1.2},
    {"id": "door-office", "owner": "code", "c": [-12.0, 4.2, 18.89], "n": [0, 0, -1], "u": [-1, 0, 0], "w": 1.6, "h": 2.4},
    {"id": "drape-n", "owner": "hero", "c": [-31.04, 3.7, 9.0], "n": [1, 0, 0], "u": [0, 0, -1], "w": 2.0, "h": 6.6},
    {"id": "drape-s", "owner": "hero", "c": [-31.04, 3.7, 21.0], "n": [1, 0, 0], "u": [0, 0, -1], "w": 2.0, "h": 6.6},
    {"id": "door-riser", "owner": "code", "c": [-6.0, 1.5, 9.8], "n": [1, 0, 0], "u": [0, 0, -1], "w": 3.6, "h": 3.0},
]


# Known, and left for the user to decide (the obstruction test prints them,
# doesn't fail on them): a pair here is never a Blender prop.
KNOWN = [
    {"face": "window-tatami", "prop": "hero:2771c445",
     "why": "Studio's south DJ drape (z 20 .. 22) hangs 0.6 m off the west wall, 1.8 m from the tatami window's "
            "west end: from the hall's north end it hides the window's westmost 0.6 m. A curtain can't hang "
            "flatter; moving it opens the LED wall's south edge."},
]

# Where a player stands to look at them (the obstruction test's eye points:
# a 1 m grid, 1.6 m up, none inside a collider)
EYES = [
    {"rect": [-31.7, -14.4, 4.1, 23.8], "y": 0.0},      # the hall
    {"rect": [-31.7, -28.0, 10.0, 20.0], "y": 0.45},    # the stage
    {"rect": [-14.0, -6.3, 4.3, 19.0], "y": 3.0},       # the mezzanine
    {"rect": [-10.0, -6.0, 8.0, 11.6], "y": 0.0},       # the riser
    {"rect": [-6.0, -1.0, 6.0, 14.0], "y": 0.0},        # Mid Bottom, by the riser's door
]


def place():
    b, R = Builder(), K.Registry()
    P = K.palette()
    rng = random.Random(2610)

    # ---- the trusses along the front and back walls, over the screens'
    # tops (front 6.7, back 6.1): par cans clamped under them, none in
    # front of the pole screen (x -22.7 .. -17.1)
    lens = [P["lens"], P["lens_pk"]]
    x0, x1 = -31.0, -15.2
    span = x1 - x0
    front_cans = [f for f in [i / 12 + 0.02 for i in range(12)] if not (-22.9 <= x0 + span * f <= -16.9)]
    K.truss(b, P, R, "truss-front", x0, 4.75, x1, 4.75, 7.0, hang=(0.06, 0.5, 0.94), roof=CEIL,
            cans=[(f, lens[i % 2]) for i, f in enumerate(front_cans)], can_aim=(0.0, -1.0, 0.35))
    K.truss(b, P, R, "truss-back", x0, 23.25, x1, 23.25, 7.0, hang=(0.06, 0.5, 0.94), roof=CEIL,
            cans=[(i / 12 + 0.02, lens[(i + 1) % 2]) for i in range(12)], can_aim=(0.0, -1.0, -0.35))
    # the ceiling grid over the hall, clear of the chandelier's rods and the trusses
    K.ceiling_grid(b, P, R, -31.6, -14.5, 5.2, 22.8, [-31 + 2 * i for i in range(9)], [6 + 2 * i for i in range(9)], CEIL - 0.02)

    # ---- speaker stacks in the front corners, toed in to the dance floor
    for pid, x, z in (("stack-w", -30.85, 4.85), ("stack-e", -15.0, 4.85)):
        K.speaker_stack(b, P, R, pid, x, z, math.atan2(DC[0] - x, DC[1] - z))
    # road cases and an amp rack by the stage (under 0.6 m: no collider)
    K.road_case(b, P, R, "case-a", -31.35, 6.15, 0.6, 0.55, 0.6, ry=math.pi / 2)
    K.road_case(b, P, R, "case-amp", -31.35, 6.85, 0.6, 0.58, 0.5, ry=math.pi / 2)
    K.cable_drum(b, P, R, "cable-drum", -30.75, 7.4)
    # the stage feed: from the stage's north end round to the west stack
    K.cable_run(b, P, [(-28.25, 9.85), (-29.4, 8.6), (-29.9, 6.9), (-30.0, 5.75)])

    # ---- the DJ stage (colliders 154, 155) and what stands on it
    K.stage(b, P, R, -31.7, -28.0, 10.0, 20.0, 0.45, (-28.0, -27.6, 11.0, 19.0, 0.22))
    for pid, z in (("wedge-n", 12.9), ("wedge-s", 17.1)):
        K.monitor_wedge(b, P, R, pid, -28.55, z, 0.45, -math.pi / 2)
    K.dj_laptop(b, P, R, -29.6, 15.75, 1.59, -math.pi / 2)
    K.cable_loom(b, P, [(-30.2, 13.0), (-31.25, 12.2), (-31.25, 10.4)], 0.45)

    # ---- the bar (colliders 156, 157): counter, its top, the back bar's cabinet
    K.bar_counter(b, P, R, -16.4, -15.4, 8.4, 16.0, top=1.1)
    K.bar_top(b, P, R, rng, -16.4, -15.4, 8.4, 16.0, 1.1)
    K.back_bar_cabinet(b, P, R, -14.75, -14.4, 8.4, 16.0, top=1.0)
    R.collider(-14.575, 12.2, 0.35, 7.6, 1.0, 0, pen=3)
    K.ice_well(b, P, R, -14.72, -14.42, 12.2, 1.03)
    # the two fridges, upright at the back bar's south end (nothing stands in front of them)
    K.beer_fridge(b, P, R, rng, "fridge-1", -14.62, -14.07, 16.15, 16.75)
    K.beer_fridge(b, P, R, rng, "fridge-2", -14.62, -14.07, 16.8, 17.4)
    for i, z in enumerate((9.0, 10.3, 11.6, 12.9, 14.2, 15.5)):
        K.bar_stool(b, P, R, f"stool{i}", -16.85, z)

    # ---- the booths (colliders 119, 121, 123) and their tables (120, 122, 124)
    K.booth(b, P, R, "booth-front", -22.0, 4.55, 2.5, 0.8, 1.2, +1)
    K.booth(b, P, R, "booth-back-w", -23.3, 23.4, 2.5, 0.8, 1.2, -1)
    K.booth(b, P, R, "booth-back-e", -19.7, 23.4, 2.5, 0.8, 1.2, -1)
    for pid, x, z in (("table-front", -22.0, 5.5), ("table-back-w", -23.3, 22.45), ("table-back-e", -19.7, 22.45)):
        K.cocktail_table(b, P, R, pid, x, z)
        K.table_top(b, P, R, rng, pid, x, z, 0.75)

    # ---- the hall's shell: slats with depth, two light-ringed columns,
    # exit signs, extinguishers, a coat check, bins
    gap_pad = 0.1
    K.battens(b, P, R, "slats-w", "z", -31.7, 4.15, 7.35, 0.0, CEIL, +1)
    K.battens(b, P, R, "slats-front-w", "x", 4.11, -31.65, -29.85, 0.0, CEIL, +1)
    K.battens(b, P, R, "slats-front-door", "x", 4.11, -29.8, -25.4, 3.4, CEIL, +1,
              gaps=[(-27.8 - gap_pad, -27.4 + gap_pad, 3.4, 3.7)])
    K.battens(b, P, R, "slats-front-m", "x", 4.11, -25.35, -23.05, 0.0, CEIL, +1, gaps=[(-24.6, -24.2, 0.0, CEIL)])
    K.battens(b, P, R, "slats-front-e", "x", 4.01, -23.0, -14.45, 0.0, CEIL, +1,
              gaps=[(-22.7 - gap_pad, -17.1 + gap_pad, 3.5 - gap_pad, 6.7 + gap_pad)])
    K.battens(b, P, R, "slats-back-w", "x", 23.79, -31.65, -28.25, 0.0, CEIL, -1,
              gaps=[(-31.7, -28.2, 1.5 - gap_pad, 2.5 + gap_pad), (-28.8, -28.5, 0.75, 1.5)])
    K.battens(b, P, R, "slats-back-wdoor", "x", 23.79, -28.2, -25.8, 2.8, CEIL, -1,
              gaps=[(-27.2 - gap_pad, -26.8 + gap_pad, 2.8, 3.1)])
    K.battens(b, P, R, "slats-back-m", "x", 23.79, -25.75, -17.25, 0.0, CEIL, -1,
              gaps=[(-24.7 - gap_pad, -18.3 + gap_pad, 2.5 - gap_pad, 6.1 + gap_pad), (-25.7, -24.7, 0.85, 1.85), (-17.85, -17.45, 0.75, 1.5)])
    K.battens(b, P, R, "slats-back-edoor", "x", 23.79, -17.2, -14.8, 2.8, CEIL, -1,
              gaps=[(-16.2 - gap_pad, -15.8 + gap_pad, 2.8, 3.1)])
    K.pilaster(b, P, R, "column-w", -31.575, 7.6, 0.25, 0.4, CEIL - 0.16, [1.2, 2.6, 4.0, 5.4, 6.8], P["ring_pk"])
    K.pilaster(b, P, R, "column-front", -24.4, 4.235, 0.4, 0.25, CEIL - 0.16, [1.2, 2.6, 4.0, 5.4, 6.8], P["ring_cy"])
    K.exit_sign(b, P, R, "exit-main", -27.6, 3.48, 4.11, (0, 1))
    K.exit_sign(b, P, R, "exit-back-w", -27.0, 2.88, 23.79, (0, -1))
    K.exit_sign(b, P, R, "exit-back-e", -16.0, 2.88, 23.79, (0, -1))
    K.extinguisher_cabinet(b, P, R, "ext-back-w", -28.65, 0.8, 23.79, (0, -1))
    K.extinguisher_cabinet(b, P, R, "ext-back-e", -17.65, 0.8, 23.79, (0, -1))
    K.coat_check(b, P, R, "coat-check", -25.65, -24.75, 23.79, 0.9, 1.8, -1)
    K.bin_(b, P, R, "bin-bar", -16.2, 7.4)
    K.bin_(b, P, R, "bin-door", -24.95, 4.55)

    # ---- the rigging rope's foot (Rope_2 at -14.4, 18): a sandbag, the tail coiled
    R.begin(b, "rope-foot")
    b.box(P["fabric"], 0.32, 0.17, 0.2, -14.86, 0, 18.35, ry=0.3, bevel=0.05)
    for i in range(14):
        a0, a1 = 2 * math.pi * i / 14, 2 * math.pi * (i + 1) / 14
        for k, r in enumerate((0.16, 0.13)):
            b.cyl(P["cable"], 0.012, (-14.95 + math.cos(a0) * r, 0.012 + k * 0.022, 17.75 + math.sin(a0) * r),
                  (-14.95 + math.cos(a1) * r, 0.012 + k * 0.022, 17.75 + math.sin(a1) * r), seg=5, caps=False)
    R.end()

    # ---- the mezzanine (deck at 3.0): the glass rail where the parapet was,
    # two booths, a sofa, low tables, road cases on the AC unit's collider,
    # the sound desk
    Y = 3.0
    K.glass_rail(b, P, R, "rail-mezz", -13.85, 4.34, 17.0, Y)
    K.lounge_booth(b, P, R, "mezz-booth-n", -7.1, -6.3, 4.45, 6.45, Y)
    R.collider(-6.7, 5.45, 0.8, 2.0, 1.1, Y, pen=3)
    K.lounge_booth(b, P, R, "mezz-booth-s", -7.1, -6.3, 17.15, 18.85, Y)
    R.collider(-6.7, 18.0, 0.8, 1.7, 1.1, Y, pen=3)
    K.sofa(b, P, R, "mezz-sofa", -7.15, -6.3, 11.8, 13.8, Y)
    R.collider(-6.725, 12.8, 0.85, 2.0, 0.76, Y, pen=2)
    for pid, x, z, w, d in (("mezz-table-n", -7.75, 5.45, 0.5, 0.9), ("mezz-table-m", -7.8, 12.8, 0.5, 1.0), ("mezz-table-s", -7.75, 18.0, 0.5, 0.8)):
        K.low_table(b, P, R, pid, x, z, Y, w, d)
        R.begin(b, pid + "-top", on=pid)
        K.ashtray(b, P, x + 0.05, Y + 0.42, z - d * 0.25)
        for k in range(2):
            gz = z + d * (0.1 + 0.18 * k)
            b.cyl(P["glass_ware"], 0.035, (x - 0.08, Y + 0.42, gz), (x - 0.08, Y + 0.53, gz), r2=0.04, seg=10)
        R.end()
    K.road_case(b, P, R, "mezz-case-lo", -11.9, 14.2, 1.36, 0.58, 1.16, y=Y, wheels=False)
    K.road_case(b, P, R, "mezz-case-hi", -11.95, 14.2, 1.2, 0.5, 1.0, y=Y + 0.585, wheels=False, on="mezz-case-lo")
    K.sound_desk(b, P, R, -7.25, -6.35, 14.0, 17.0, Y)

    # ---- the riser (the mid rope room, x -10 .. -6, z 8 .. 11.6)
    K.riser(b, P, R, -10.0, -6.0, 8.0, 11.6, -6.2)

    # ---- the lived-in floor: notes on the dance floor's rim and the stage
    # lip, confetti and litter over the hall, never under the furniture
    avoid = [(-27.0, -17.0, 10.0, 20.0), (-31.7, -27.6, 10.0, 20.0), (-16.6, -15.2, 8.3, 16.1), (-17.15, -16.55, 8.7, 15.8),
             (-23.4, -20.6, 4.1, 5.9), (-24.7, -18.3, 21.9, 23.8), (-31.7, -29.9, 4.1, 7.4), (-16.0, -14.1, 4.1, 5.8),
             (-25.3, -24.1, 4.1, 4.9), (-16.5, -15.9, 7.1, 7.7), (-15.1, -14.4, 17.2, 18.7)]
    rim = 0.5
    for i, rect in enumerate(((-27.0, -17.0, DANCE[2] - rim, DANCE[2] - 0.05), (-27.0, -17.0, DANCE[3] + 0.05, DANCE[3] + rim),
                              (-27.55, -27.05, 10.0, 20.0))):
        K.scatter_floor(b, P, R, random.Random(40 + i), f"cash-rim{i}", rect, 9, 30, 2, avoid=avoid[1:])
    K.scatter_floor(b, P, R, random.Random(50), "cash-stage", (-28.35, -28.08, 10.15, 12.3), 6, 10, 0, y=0.45)
    K.scatter_floor(b, P, R, random.Random(51), "cash-stage-s", (-28.35, -28.08, 17.7, 19.85), 5, 10, 0, y=0.45)
    K.scatter_floor(b, P, R, random.Random(52), "floor-hall", (-31.5, -14.6, 4.3, 23.6), 6, 260, 40, avoid=avoid)
    K.scatter_floor(b, P, R, random.Random(53), "floor-mezz", (-13.5, -6.5, 12.0, 18.8), 2, 40, 8, y=Y,
                    avoid=[(-7.3, -6.3, 11.7, 19.0), (-8.1, -7.5, 11.3, 18.5), (-12.7, -11.1, 13.5, 14.9)])
    return b, R
