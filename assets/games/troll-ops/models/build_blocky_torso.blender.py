"""
The muscular torso for the blocky body (blocky-body.js, preview mockup).
User, 2026-10-11, after the muscular arms: "lets work on the torso now".

    blender --background --python build_blocky_torso.blender.py            # -> models/blocky/torso-muscle.glb
    blender --background --python build_blocky_torso.blender.py -- check   # + review renders (with the arms), models/_renders/blocky-torso
      env TR_SAMPLES (render samples, default 32)

Built like the arms (build_blocky_arms.slab): chamfered blocks, each its
own piece with its own ink outline in the game. A V: broad across the
chest and lats, narrower at the waist; traps sloping up to the neck; two
square pecs with a shelf under them; six abs.

The clothes stay a drawing: every face is box-projected onto the garment's
block template (traits/src/<id>.block.svg: front, back, right and left
regions, 1 mm a unit, y 0 the torso's top = chest + 0.04 m), across the
torso's width at that height, so the tank's neckline, armholes and print
land where they did on the plain block, now wrapped over the muscles.

Pieces, in their joint's frame at scale 1 (game coords, -Z the front):
    chest__*   on the chest joint (the upper half: bends with the spine)
    torso__*   on the torso joint, which pivots at the hips (the lower half)
"""
import importlib.util
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_kit as K  # noqa: E402

# the arm builder (its file name has a dot in it, so load it by path)
_spec = importlib.util.spec_from_file_location("blocky_arms", os.path.join(K.HERE, "build_blocky_arms.blender.py"))
A = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(A)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.join(K.HERE, "blocky", "torso-muscle.glb")
TEMPLATE_PNG = os.path.normpath(os.path.join(K.HERE, "..", "traits", "clothes-tank-runner.block.png"))
TW, TH = 1200, 760                 # the template, mm (rows 560..760: the shoulders' top)
TOP_ROWS = (560, 760)              # the top region's front edge and back edge
TOP = 0.04                         # the torso's top over the chest joint
HIPS = -0.48                       # the hips (the torso joint) in chest coords

# (y in chest coords, width, depth) of the torso, top to bottom: a V, broad
# across the chest and lats, in at the waist, out a touch at the hips
PROFILE = [(0.04, 0.40, 0.18), (-0.07, 0.44, 0.215), (-0.2, 0.40, 0.2), (-0.30, 0.36, 0.188),
           (-0.40, 0.355, 0.185), (-0.48, 0.37, 0.19)]
SQUARE = 5.0      # the section's superellipse exponent: a box with rounded corners
SEGS = 72         # around
# The chest half ends at -0.32, the waist half starts at -0.26: they overlap
# BELOW the RUNNER print (its letters end at -0.235). With the overlap across
# the print, the waist half poked through the chest half when the body
# twisted mid-stride, and the letters' bottoms showed twice (user: "the
# runner text on the tanktop while moving seems to be weird").
SPLIT = (-0.32, -0.26)
TUCK = 0.012      # how far the waist half's top sits inside the chest half (0 at the chest's bottom edge)

# v2 (user: "the pec muscles and ab muscles were just popped on there"):
# no more muscle blocks on a box. Each half is ONE shell, and the muscles
# are its own surface pushed out (a height field over the front), so they
# swell out of the chest and fall back into it, like a tight tank over them.


def smooth(e0, e1, v):
    f = max(0.0, min(1.0, (v - e0) / (e1 - e0)))
    return f * f * (3 - 2 * f)


def section(y):
    """Half-width and half-depth at height y, smooth between the profile's levels."""
    if y >= PROFILE[0][0]:
        return PROFILE[0][1] / 2, PROFILE[0][2] / 2
    for a, b in zip(PROFILE, PROFILE[1:]):
        if y >= b[0]:
            f = smooth(a[0], b[0], y)
            return (a[1] + (b[1] - a[1]) * f) / 2, (a[2] + (b[2] - a[2]) * f) / 2
    return PROFILE[-1][1] / 2, PROFILE[-1][2] / 2


def muscles(x, y):
    """How far the front stands out at (x, y), chest coords, metres."""
    u = abs(x)
    # Pecs: rise gently from under the collarbones, full across the chest,
    # a valley down the breastbone, rolling round toward the armpits, and a
    # firm lower edge (the shelf) that sweeps up toward the outside.
    shelf = -0.152 + 0.05 * (u / 0.2) ** 2
    pec = (0.042 * smooth(0.004, 0.034, u) * (1 - smooth(0.15, 0.205, u))
           * smooth(0.01, -0.075, y) * (1 - smooth(shelf - 0.002, shelf - 0.02, y))
           * (1 - 0.35 * ((u - 0.1) / 0.1) ** 2))
    # Abs: a low raised field under the print, split by a line down the
    # middle and three across, its sides easing into the obliques.
    ab = 0.0
    if -0.45 < y < -0.22:
        field = 0.02 * (1 - smooth(0.07, 0.105, u)) * smooth(-0.43, -0.405, y) * (1 - smooth(-0.255, -0.232, y))
        groove = math.exp(-(x / 0.008) ** 2)
        for yk in (-0.297, -0.356):
            groove += math.exp(-((y - yk) / 0.008) ** 2)
        ab = max(0.0, field * (1 - 0.85 * min(1.0, groove)))
    return max(pec, ab)


def traps(x):
    """The traps: the top rising from the shoulders toward the neck."""
    return 0.04 * (1 - smooth(0.05, 0.19, abs(x)))


def shell(name, y_top, y_bot, origin_y, round_top, round_bot, inset=0.0):
    """One half of the torso between y_top and y_bot (chest coords), in the
    frame of the joint at origin_y. round_*: round that end over (the
    outside ends) or close it flat (the ends hidden in the other half)."""
    R = 0.03
    plan = []      # (y, inset, topness)
    if round_top:
        for i in range(5, 0, -1):
            a = (math.pi / 2) * i / 5
            plan.append((y_top - R + R * math.sin(a), R * (1 - math.cos(a)), math.sin(a)))
    rows = max(8, int((y_top - y_bot) / 0.008))
    for i in range(rows + 1):
        plan.append((y_top - (R if round_top else 0) - (y_top - y_bot - (R if round_top else 0) - (R if round_bot else 0)) * i / rows, 0.0, 0.0))
    if round_bot:
        for i in range(1, 6):
            a = (math.pi / 2) * i / 5
            plan.append((y_bot + R - R * math.sin(a), R * (1 - math.cos(a)), 0.0))
    verts, faces = [], []
    for y, ins, top in plan:
        hw, hd = section(y)
        tuck = inset(y) if callable(inset) else inset
        hw, hd = hw - ins - tuck, hd - ins - tuck
        for k in range(SEGS):
            th = math.tau * k / SEGS
            c, s = math.cos(th), math.sin(th)
            x = hw * math.copysign(abs(c) ** (2 / SQUARE), c)
            z = hd * math.copysign(abs(s) ** (2 / SQUARE), s)
            front = max(0.0, -s) ** 2           # 1 straight ahead, 0 at the sides
            z -= max(0.0, muscles(x, y) - tuck) * front
            yy = y + traps(x) * top * (1 - 0.6 * front)   # the traps sit a little back
            verts.append((x, yy - origin_y, z))
    n = len(plan)
    for r in range(n - 1):
        for k in range(SEGS):
            k2 = (k + 1) % SEGS
            faces.append((r * SEGS + k, r * SEGS + k2, (r + 1) * SEGS + k2, (r + 1) * SEGS + k))
    for end, ring, rounded in ((plan[0], 0, round_top), (plan[-1], n - 1, round_bot)):
        verts.append((0, end[0] + (traps(0) if end[2] else 0) - origin_y, 0))
        c = len(verts) - 1
        if rounded:
            faces += [(c, ring * SEGS + (k + 1) % SEGS, ring * SEGS + k) for k in range(SEGS)]
        else:
            # a flat end (hidden in the other half) on its own copy of the
            # ring: sharing it bent the sides' smooth shading into a dark
            # line across the body where the halves meet
            base = len(verts)
            verts += [verts[ring * SEGS + k] for k in range(SEGS)]
            faces += [(c, base + (k + 1) % SEGS, base + k) for k in range(SEGS)]
    ob = A.outward(K.mesh_obj(name, verts, faces, None))
    return ob


def chest_pieces():
    return {"chest__body": shell("chest__body", TOP, SPLIT[0], 0.0, True, False)}


def waist_pieces():
    # inside the chest half where they overlap: a hair at the chest's bottom
    # edge (so the surface carries straight on), tucked TUCK deep at the top
    # (so a twist or a lean never pushes it out through the chest half)
    tuck = lambda y: 0.0015 + TUCK * smooth(SPLIT[0], SPLIT[1], y)   # noqa: E731
    return {"torso__body": shell("torso__body", SPLIT[1], HIPS, HIPS, False, True, inset=tuck)}


# ---------------------------------------------------------------- the drawing
def clamp(v, lo=-1.0, hi=1.0):
    return max(lo, min(hi, v))


def template_uvs(ob, chest_y):
    """Box-project the template onto ob, stretched across the torso's width
    at each height. chest_y: this piece's joint height in chest coords (0
    for the chest half, HIPS for the waist). Each face takes the region its
    normal points at; u stays 12 mm clear of each region's ink border, so
    the corners don't draw a line (the game's outline does that)."""
    me = ob.data
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        n = poly.normal               # Blender: game x = x, game y = z, game z = -y
        nx, ny, nz = n.x, n.z, -n.y
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            x, y, z = co.x, co.z + chest_y, -co.y
            hw, hd = section(min(y, TOP))
            row = clamp((TOP - y) * 1000, 12, TOP_ROWS[0] - 12)
            fx, fz = clamp(x / hw, -0.94, 0.94), clamp(z / hd, -0.88, 0.88)
            top, bottom = ny > 0.45 and y > TOP - 0.035, ny < -0.6 and y < HIPS + 0.035
            if top:
                # the shoulders' tops (and the traps): the template's TOP
                # region, seen from above, front edge to back edge, so the
                # straps run cleanly over (one stretched row of the front
                # streaked; user: "fix the shoulder graphics rendering")
                hw0, hd0 = section(TOP)
                px = 200 - clamp(x / hw0, -0.99, 0.99) * 200
                row = (TOP_ROWS[0] + TOP_ROWS[1]) / 2 + clamp(z / hd0, -0.97, 0.97) * (TOP_ROWS[1] - TOP_ROWS[0]) / 2
            elif bottom or abs(nz) >= abs(nx):   # (a groove's walls face up or down: the front still)
                px = 200 - fx * 200 if nz < 0 or bottom else 600 + fx * 200
            else:
                px = 900 - fz * 100 if nx > 0 else 1100 + fz * 100
            uv.data[li].uv = (px / TW, 1 - row / TH)


def build():
    tank = K.material("TankTemplate", 0xffffff, 0.8, image=TEMPLATE_PNG)
    parts = {}
    for chest_y, pieces in ((0.0, chest_pieces()), (HIPS, waist_pieces())):
        for n, ob in pieces.items():
            ob.data.materials.clear()
            ob.data.materials.append(tank)
            template_uvs(ob, chest_y)
            parts[n] = ob
    return parts


# ---------------------------------------------------------------- review renders
def check(parts):
    arms = A.build()
    A.place(arms)
    hip_y = A.CHEST - 0.48
    for n, ob in parts.items():
        ob.location = K.B((0, A.CHEST if n.startswith("chest") else hip_y, 0))
    white = K.material("REF_Skin", 0xf3f3ef, 0.6)
    shorts = K.material("REF_Shorts", 0x34363e, 0.8)
    for s in (-1, 1):
        K.box(f"REF_thigh{s}", (s * 0.1, hip_y - 0.1, 0), (0.2, 0.2, 0.2), shorts)
        K.box(f"REF_shin{s}", (s * 0.1, hip_y - 0.4, 0), (0.194, 0.4, 0.194), white)
    K.ico("REF_head", (0, A.CHEST + 0.27, 0), 0.16, white, sub=3, scale=(1.05, 1, 0.55))
    sc = bpy.context.scene
    cam = K.render_setup(samples=int(os.environ.get("TR_SAMPLES", 32)))
    out = os.path.join(K.HERE, "_renders", "blocky-torso")
    os.makedirs(out, exist_ok=True)
    shots = [("body", y, 3.0, 1.0, (0, 0, 0.75)) for y in (0, 35, 90, 180)]
    shots += [("chest", y, 1.5, 1.05, (0, 0, 0.9)) for y in (0, 30)]
    for kind, yaw, dist, h, tgt in shots:
        K.aim(cam, yaw, dist=dist, height=h, target=tgt)
        sc.render.stamp_note_text = f"  blocky torso · {kind} {yaw}  "
        sc.render.filepath = os.path.join(out, f"{kind}{yaw:+04d}.png")
        bpy.ops.render.render(write_still=True)
    print("CHECK", out)


if __name__ == "__main__":
    K.reset_scene()
    P = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    K.export(OUT)
    if ARGS and ARGS[0] == "check":
        check(P)
