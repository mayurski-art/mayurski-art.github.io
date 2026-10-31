"""
The Howl Ballista (DESIGN-ARSENAL.md Phase 1 step 5, gun 3: the bolt
sniper), on gunkit v2 and the Problem 416's recipe, built to the user's
concept sheet (refs/arms/howl/: concept-3 for the side profile and the
proportions, concept-2 for the receiver, port, bolt and knob, concept-1
for the stock and the 3/4 read). Panels 1 and 2 are mirrored; the game's
handle, port and ejection stay on the right.

An olive cerakote chassis worn through at the edges over a black core: an
octagonal M-LOK handguard with one long top rail, a deep receiver section
with a big port showing the polished, spiral-fluted bolt, the straight
handle and its knurled ball knob, a stippled black grip, a skeleton stock
with a cheek riser on posts and a stacked butt pad, a plain barrel and a
three-port brake, a black .338 box mag, a bipod folded under the
handguard.

The moving parts follow the convention agreed with the MTAR session
(refs/arms/howl/NOTES.md), whose runtime drives them:
  HB_Bolt    one node, pivoted on the bore at the bolt's rest z: slide z by
             TRAVEL (rake), and tf_lift (radians, + rotation.z lifts the
             knob) for the lift; rifle-action.js placeBolt runs both.
  HB_BoltKnob  point: the knob's centre (the trigger hand's target).
  HB_Round   one .338 round in the open action, its case head at the raked
             bolt face (tf_round): shown while the bolt is back.
  HB_Eject   point: where the case leaves the port on the rake.
  HB_Trigger, HB_Mag, HB_BipodL / HB_BipodR (posed folded, never cycled).

    blender --background --python build_ballista.blender.py --              # flat materials -> ballista.glb
    ... -- render                                                           # + check renders (HB_RENDER_DIR)
    ... -- bake [render]                                                    # bake_kit.bake_gun: maps, LOD1

Game coordinates: x right, y up, -z toward the muzzle, metres; the bore on
y 0, the grip hand at z 0.02 (the traced Ballista's anchor, weapon-snipers.js).
"""
import math
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gunkit as gk
import bmesh                                # (after bpy, which gunkit loads)
from gunkit import (Part, lathe, sweep, catmull, empty, section_body, chamfer_box, local_lathe,
                    stipple, moving, panel_line, Vector)

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
BAKE = "bake" in ARGS
PFX = "HB"
OLIVE = 0x585b37         # the concept's chassis: a greener, lighter olive than the 416's OD
WORN = 0x6b6e70          # the edges wear to grey-dark metal (concept-2)

if BAKE:
    import bake_kit
    K = bake_kit.kit_material
    gk.M.update({
        "chassis": K("HB_Chassis", "cerakote", OLIVE, WORN, Wear=1.0, Patches=0.5),
        "guard":   K("HB_Guard", "cerakote", OLIVE, WORN, Wear=1.0, Patches=0.4),
        "stock":   K("HB_Stock", "cerakote", OLIVE, WORN, Wear=0.9, Patches=0.45),
        "gripm":   K("HB_Grip", "polymer", 0x1c1c1c, Wear=0.5, Roughness=0.78),
        "core":    K("HB_Core", "anodized", 0x18191b),
        "steel":   K("HB_Steel", "parkerized", 0x222324),
        "bolt":    K("HB_Bolt", "parkerized", 0xa7abae, 0xd2d5d8, Wear=0.25, Metallic=1.0, Roughness=0.2),
        "magm":    K("HB_MagBody", "polymer", 0x1a1a1a, Wear=0.5),
        "rubber":  K("HB_Pad", "rubber"),
        "brass":   K("HB_Brass", "brass"),
        "bullet":  K("HB_Bullet", "brass", 0x8c5a36, 0xb07a4e, Wear=0.2),
        "dark":    K("HB_Dark", "parkerized", 0x0e0e0e, Wear=0.0, Metallic=0.0, Roughness=0.85),
    })
else:
    gk.M.update({
        "chassis": gk.material("HB_Chassis", OLIVE, 0.62), "guard": gk.material("HB_Guard", OLIVE, 0.62),
        "stock": gk.material("HB_Stock", OLIVE, 0.66), "gripm": gk.material("HB_Grip", 0x1c1c1c, 0.8),
        "core": gk.material("HB_Core", 0x18191b, 0.42, 0.35), "steel": gk.material("HB_Steel", 0x222324, 0.55, 0.6),
        "bolt": gk.material("HB_Bolt", 0xa7abae, 0.2, 1.0), "magm": gk.material("HB_MagBody", 0x1a1a1a, 0.8),
        "rubber": gk.material("HB_Pad", 0x141414, 0.92), "brass": gk.material("HB_Brass", 0xb38f42, 0.3, 1.0),
        "bullet": gk.material("HB_Bullet", 0x8c5a36, 0.32, 1.0), "dark": gk.material("HB_Dark", 0x0e0e0e, 0.85),
    })

R, L = Vector((1, 0, 0)), Vector((-1, 0, 0))
UP, ZV = Vector((0, 1, 0)), Vector((0, 0, 1))
# half-widths
HW_CH, HW_HG, HW_GRIP, HW_STOCK, HW_MAG = 0.020, 0.022, 0.0145, 0.016, 0.0135
# the action, the receiver section of the chassis and the handguard, rear to front
ACT_Z = (-0.112, -0.300)                 # the black action under the rail (the bolt exits its rear)
CH_Z = (0.045, -0.300)                   # chassis: grip seat to the handguard
CH_TOP, CH_TOP_REAR = 0.016, -0.017      # chassis top beside the action; behind it, where the shroud rides
HG_Z = (-0.300, -0.690)                  # handguard
HG_TOP, HG_BOT = 0.0225, -0.024
RAIL_S = 0.0225                          # the rail's bed; its teeth top out 9.2 mm above
RAIL_TOP = RAIL_S + 0.0092
BRAKE_Z, MUZZLE_Z = -0.798, -0.872
# the bolt: face at rest, the handle's root (the node's pivot, on the bore), the rake
BOLT_FACE, BOLT_ROOT, TRAVEL, LIFT = -0.222, -0.099, 0.090, 1.05
KNOB = Vector((0.040, -0.036, -0.111))   # the knob's centre: out right, down, a lean forward (concept-2)
KNOB_R = 0.0095
# the port: from the chamber mouth back over the bolt body (the raked face sits at -0.132)
PORT = dict(z=-0.172, y=0.004, len=0.104, h=0.022, depth=0.023)
ROUND_HEAD = BOLT_FACE + TRAVEL + 0.001  # the round waits just ahead of the raked bolt face
# the mag (concept: well ahead of the trigger, as a long .338 action has it)
MAG_Z = (-0.140, -0.242)
MAG_TOP, MAG_BOT = -0.028, -0.170
TRIG = Vector((0, -0.040, -0.074))       # the trigger's pin
BIPOD_Z = (-0.494, -0.688)               # its mount behind, the legs folded forward along the belly


# ------------------------------------------------------------------ helpers (the 416's)

def box_outline(z, y0, y1):
    a, b = max(z) + 0.002, min(z) - 0.002
    return [(a, y0), (a, y1), (b, y1), (b, y0)]


def rrect_cut(P, center, normal, along, w, h, r, depth, key, n=3):
    """A rounded-rectangle pocket cut into a face (w along `along`, h
    across), its floor and walls in `key`."""
    bm = bmesh.new()
    nv, a = Vector(normal).normalized(), Vector(along).normalized()
    s_ = nv.cross(a).normalized()
    r = min(r, w / 2 - 1e-5, h / 2 - 1e-5)
    loop = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (r - w / 2, h / 2 - r, 90), (r - w / 2, r - h / 2, 180), (w / 2 - r, r - h / 2, 270)):
        for i in range(n + 1):
            ang = math.radians(a0 + 90 * i / n)
            loop.append(Vector(center) + a * (cx + r * math.cos(ang)) + s_ * (cy + r * math.sin(ang)))
    top = [bm.verts.new(p + nv * 0.002) for p in loop]
    bot = [bm.verts.new(p - nv * depth) for p in loop]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    m = len(loop)
    for k in range(m):
        k2 = (k + 1) % m
        bm.faces.new([top[k2], top[k], bot[k], bot[k2]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    P.cutters.append((bm, key))


def hole(P, center, normal, r, depth, key="core", segs=8):
    up = Vector((0, 1, 0)) if abs(Vector(normal).y) < 0.9 else Vector((1, 0, 0))
    P.cutters.append((gk._slot_solid(center, up, normal, 2 * r, 2 * r, depth, n=segs), key))


def screw(P, center, normal, r=0.0024, key="core"):
    """A socket-head screw: a domed head with its hex sunk in."""
    local_lathe(P, center, normal, [(-0.0005, r), (0.0006, r), (0.0011, r * 0.82), (0.0013, 0.0)], key, segs=14)
    hole(P, Vector(center) + Vector(normal).normalized() * 0.0013, normal, r * 0.45, 0.0009, "dark", segs=6)


def picatinny(P, surface, out, across, z0, z1, key="core", hw=0.0106, base=0.0035, tooth=0.0035, pitch=0.010):
    out, across = Vector(out).normalized(), Vector(across).normalized()
    s0 = Vector(surface)
    L_, zc = abs(z1 - z0), (z0 + z1) / 2
    b = s0 + out * 0.0012
    chamfer_box(P, (b.x, b.y, zc), (0.0026, hw * 1.6, L_), 0.0006, key, (out, across, ZV))
    b = s0 + out * (0.0024 + base / 2)
    chamfer_box(P, (b.x, b.y, zc), (base, hw * 2, L_), 0.0012, key, (out, across, ZV))
    t = s0 + out * (0.0024 + base + tooth / 2 - 0.0002)
    n = int(L_ / pitch)
    z = min(z0, z1) + (L_ - (n - 1) * pitch) / 2
    for k in range(n):
        chamfer_box(P, (t.x, t.y, z + k * pitch), (tooth, hw * 2, 0.0052), 0.0009, key, (out, across, ZV))


def bar(P, a, b, w, h, c, key, side=R):
    """A chamfered flat bar from a to b in the gun's side plane, w across
    the gun, h across the bar (a stock strut)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    along = d.normalized()
    across = side.cross(along).normalized()
    chamfer_box(P, (a + b) / 2, (w, h, d.length), c, key, (Vector(side), across, along))


def fin(P):
    """Real rounded edges on the game mesh too, a finer bevel on the bake's
    high pass. Sharp outer miters: gunkit's arc miters throw vertices off
    to infinity on some of this gun's corners (the lathe caps, cut floors)."""
    ob = P.finish(smooth_angle=34, bevel=0.0007 if gk.HI else 0.0006, bevel_segs=3 if gk.HI else 2)
    bv = ob.modifiers.get("bevel")
    if bv:
        bv.miter_outer = "MITER_SHARP"
        bv.use_clamp_overlap = True
    return ob


# ------------------------------------------------------------------ the body

def action(P):
    # the black steel action under the rail, mostly sunk in the chassis;
    # the port cuts through it to the bolt
    lathe(P, [(ACT_Z[0], 0.0), (ACT_Z[0], 0.0155), (ACT_Z[1], 0.0155), (ACT_Z[1], 0.0)], "core", segs=40)
    # the rail's bed over the action (the rail runs on, over the handguard)
    chamfer_box(P, (0, (0.011 + RAIL_S) / 2, (ACT_Z[0] + ACT_Z[1]) / 2), (0.024, RAIL_S - 0.011, abs(ACT_Z[1] - ACT_Z[0])), 0.0025, "core")
    # the bolt's channel down the action, open at the back for the rake
    hole(P, (0, 0, ACT_Z[0] + 0.002), (0, 0, 1), 0.0099, abs(ACT_Z[1] - ACT_Z[0]), "dark", segs=20)
    # the recoil lug's band where the action meets the handguard
    lathe(P, [(ACT_Z[1] + 0.006, 0.0), (ACT_Z[1] + 0.006, 0.0175), (ACT_Z[1] - 0.004, 0.0175), (ACT_Z[1] - 0.004, 0.0)], "core", segs=40)


def chassis(P):
    # one side outline: beside the action up to CH_TOP, behind it down to
    # where the shroud rides; under it the mag well's flare, the trigger
    # guard (cut through), the grip's seat and the hinge at the back
    outline = [(CH_Z[0], CH_TOP_REAR), (-0.106, CH_TOP_REAR), (-0.114, CH_TOP), (CH_Z[1] + 0.002, CH_TOP),
               (CH_Z[1] + 0.002, -0.026), (-0.262, -0.046), (-0.250, -0.047), (-0.247, -0.059), (-0.129, -0.059),
               (-0.124, -0.047), (-0.117, -0.050), (-0.111, -0.088), (-0.099, -0.095), (-0.042, -0.095),
               (-0.031, -0.086), (-0.024, -0.052), (0.032, -0.048), (CH_Z[0], -0.042)]
    section_body(P, outline, [dict(z=(CH_Z[0] - 0.002, CH_Z[1] + 0.004), key="chassis", hw=HW_CH, c=0.003, step=0.003)], smooth=0)
    rrect_cut(P, (HW_CH, -0.0715, -0.0725), R, ZV, 0.060, 0.033, 0.010, 0.06, "chassis")   # the guard's opening
    # the port: a chamfered surround, then the opening through to the bolt
    rrect_cut(P, (HW_CH, PORT["y"], PORT["z"]), R, ZV, PORT["len"] + 0.005, PORT["h"] + 0.005, 0.005, 0.0013, "chassis")
    rrect_cut(P, (HW_CH - 0.0013, PORT["y"], PORT["z"]), R, ZV, PORT["len"], PORT["h"], 0.003, PORT["depth"], "core")
    for n in (R, L):
        x = n.x * HW_CH
        # the sunk lower panel under the port, its chamfered step (concept-2)
        rrect_cut(P, (x, -0.030, -0.190), n, ZV, 0.088, 0.020, 0.004, 0.0012, "chassis")
        # the skirt's long seam toward the handguard
        panel_line(P, [(x, -0.012, -0.236), (x, -0.012, -0.290), (x, -0.020, -0.298)], n)
        screw(P, (x, -0.008, -0.262), n)
        screw(P, (x, -0.040, -0.108), n)
        screw(P, (x, -0.028, 0.022), n)
        hole(P, (x, 0.008, -0.240), n, 0.0026, 0.004, "dark", segs=12)   # the takedown pin's hole ahead of the port
        local_lathe(P, (x, -0.024, 0.030), n, [(-0.0005, 0.0055), (0.0012, 0.0055), (0.0015, 0.0045), (0.0015, 0.0)], "core", segs=18)
        hole(P, (x + n.x * 0.0015, -0.024, 0.030), n, 0.0030, 0.004, "dark", segs=10)   # QD cup over the grip
    # the safety: a small ribbed tab on the left of the tang (the handle rakes back over the right)
    chamfer_box(P, (-HW_CH + 0.003, CH_TOP_REAR + 0.002, -0.040), (0.006, 0.005, 0.012), 0.0012, "core")
    for k in range(3):
        chamfer_box(P, (-HW_CH + 0.003, CH_TOP_REAR + 0.0047, -0.044 + 0.004 * k), (0.0055, 0.0008, 0.0012), 0.0003, "core")
    # mag release paddle at the back of the well
    chamfer_box(P, (0, -0.064, -0.125), (0.014, 0.007, 0.006), 0.0015, "core")
    # the stock's hinge block, black (concept-1)
    chamfer_box(P, (0, -0.029, 0.054), (2 * HW_CH + 0.002, 0.034, 0.020), 0.003, "core")
    local_lathe(P, (HW_CH + 0.001, -0.029, 0.054), R, [(-0.001, 0.0065), (0.0025, 0.0065), (0.003, 0.0055), (0.003, 0.0)], "core", segs=20)
    screw(P, (HW_CH + 0.004, -0.029, 0.054), R, 0.0026)


def handguard(P):
    # chamfered octagon tube, flat on top for the rail; two rows of M-LOK
    # slots a side (concept-3), slots on the belly bevels, a short belly
    # rail behind the bipod for an underbarrel, a black nose ring
    section_body(P, box_outline((HG_Z[0], HG_Z[1] - 0.006), HG_BOT, HG_TOP),
                 [dict(z=(HG_Z[0], HG_Z[1]), key="guard", hw=HW_HG, c=0.008, top=HG_TOP, bot=HG_BOT, step=0.05),
                  dict(z=(HG_Z[1], HG_Z[1] - 0.006), key="core", hw=HW_HG - 0.002, c=0.009, top=HG_TOP - 0.001, bot=HG_BOT + 0.001)])
    for n in (R, L):
        x = n.x * HW_HG
        for k in range(9):
            rrect_cut(P, (x, 0.0075, -0.330 - 0.040 * k), n, ZV, 0.030, 0.0075, 0.0030, 0.008, "core")
        for k in range(7):
            rrect_cut(P, (x, -0.0085, -0.352 - 0.044 * k), n, ZV, 0.026, 0.0065, 0.0028, 0.008, "core")
        d = Vector((n.x * 0.7071, -0.7071, 0))
        for k in range(6):
            rrect_cut(P, (n.x * (HW_HG - 0.0040), HG_BOT + 0.0040, -0.398 - 0.046 * k), d, ZV, 0.022, 0.0050, 0.0020, 0.006, "core")
        screw(P, (x, 0.0110, -0.308), n)
        screw(P, (x, -0.0110, -0.308), n)
        local_lathe(P, (x, -0.004, -0.664), n, [(-0.0005, 0.0055), (0.0012, 0.0055), (0.0015, 0.0045), (0.0015, 0.0)], "core", segs=18)
        hole(P, (x + n.x * 0.0015, -0.004, -0.664), n, 0.0030, 0.004, "dark", segs=10)   # QD cup at the nose
    picatinny(P, (0, HG_BOT + 0.0024 - 0.0002, 0), (0, -1, 0), (1, 0, 0), -0.318, -0.378, hw=0.0100)
    # the bipod's mount under the belly (its legs are their own parts)
    chamfer_box(P, (0, HG_BOT - 0.008, BIPOD_Z[0] + 0.004), (0.030, 0.016, 0.030), 0.003, "core")
    local_lathe(P, (0.015, -0.034, BIPOD_Z[0]), R, [(-0.0005, 0.0050), (0.0030, 0.0050), (0.0036, 0.0)], "core", segs=16)
    screw(P, (0, HG_BOT - 0.016, BIPOD_Z[0] + 0.010), (0, -1, 0), 0.0028)


def rail():
    # one rail, the receiver to the handguard's nose (concept-3), its own
    # pass so the teeth stay crisp
    P = Part(PFX + "_Rail")
    picatinny(P, (0, RAIL_S - 0.0024, 0), (0, 1, 0), (1, 0, 0), -0.086, HG_Z[1] + 0.002)
    return fin(P)


def barrel(P):
    # plain and slender (all three panels show it unfluted): the shank in the
    # handguard, a step, then the taper to the brake
    lathe(P, [(ACT_Z[1] - 0.004, 0.0), (ACT_Z[1] - 0.004, 0.0120), (-0.360, 0.0120), (-0.372, 0.0098),
              (BRAKE_Z + 0.003, 0.0088), (BRAKE_Z + 0.003, 0.0)], "steel", segs=40)


def grip(P):
    # black, stippled, a gentle rake (the hand rig's), finger nub, flared base
    section_body(P, [(-0.023, -0.046), (0.030, -0.046), (0.040, -0.066), (0.050, -0.098), (0.058, -0.128),
                     (0.066, -0.150), (0.068, -0.162), (0.010, -0.163), (0.008, -0.152), (0.000, -0.128),
                     (-0.008, -0.104), (-0.014, -0.090), (-0.010, -0.080), (-0.016, -0.066), (-0.022, -0.052)],
                 [dict(axis="v", y=(-0.047, -0.162), key="gripm", hw=HW_GRIP, c=0.0045)])
    v = Vector((0, 0.937, -0.349))
    for n in (R, L):
        rrect_cut(P, (n.x * HW_GRIP, -0.106, 0.026), n, v, 0.074, 0.026, 0.006, 0.0009, "gripm")
    stipple(P, (HW_GRIP - 0.0008, -0.140, 0.039), (0, 0, -1), v, 0.024, 0.066, "gripm")
    stipple(P, (-HW_GRIP + 0.0008, -0.140, 0.015), (0, 0, 1), v, 0.024, 0.066, "gripm")
    back = Vector((0, 0.349, 0.937))
    for k in range(6):
        c = Vector((0, -0.070 - 0.012 * k, 0.040 + 0.0045 * k))
        rrect_cut(P, c, back, R, 0.018, 0.0030, 0.0012, 0.0012, "gripm")


def stock(P):
    # skeleton (concept-1/-3): the top beam off the hinge, the rear upright,
    # a strut down and back between them, a thin black bar from the grip's
    # base to the upright's foot; windows through the beam and the upright
    section_body(P, box_outline((0.064, 0.262), -0.040, -0.012),
                 [dict(z=(0.064, 0.262), key="stock", hw=HW_STOCK, c=0.0035, step=0.05)])
    section_body(P, box_outline((0.230, 0.262), -0.162, -0.012),
                 [dict(z=(0.230, 0.262), key="stock", hw=HW_STOCK, c=0.0035, step=0.01)])
    bar(P, (0, -0.036, 0.078), (0, -0.142, 0.234), 2 * HW_STOCK - 0.004, 0.014, 0.003, "stock")
    bar(P, (0, -0.156, 0.060), (0, -0.157, 0.234), 0.014, 0.006, 0.0015, "core")
    for z in (0.100, 0.152, 0.204):
        rrect_cut(P, (HW_STOCK, -0.026, z), R, ZV, 0.036, 0.012, 0.004, 0.04, "core")
    for y in (-0.050, -0.098):
        rrect_cut(P, (HW_STOCK, y, 0.246), R, UP, 0.034, 0.012, 0.004, 0.04, "core")
    for n in (R, L):
        x = n.x * HW_STOCK
        # length-of-pull adjust lines up the upright, its lock screws
        for k in range(5):
            rrect_cut(P, (x, -0.124 - 0.006 * k, 0.246), n, ZV, 0.020, 0.0012, 0.0005, 0.0006, "stock")
        screw(P, (x, -0.020, 0.246), n)
        screw(P, (x, -0.150, 0.246), n)
        screw(P, (x, -0.026, 0.074), n)
    # the cheek riser on two posts, its channel and adjust lines
    section_body(P, box_outline((0.086, 0.214), 0.014, 0.031),
                 [dict(z=(0.086, 0.214), key="stock", hw=HW_STOCK + 0.001, c=0.004, step=0.05)])
    rrect_cut(P, (0, 0.031, 0.150), UP, ZV, 0.110, 0.012, 0.004, 0.003, "stock")
    for z in (0.110, 0.190):
        lathe(P, [(z - 0.0045, 0.0), (z - 0.0045, 0.0045), (z + 0.0045, 0.0045), (z + 0.0045, 0.0)], "core", segs=16, cy=0.001)
        chamfer_box(P, (0, 0.001, z), (0.010, 0.026, 0.009), 0.002, "core")
        for k in range(4):
            chamfer_box(P, (0.0052, -0.004 + 0.004 * k, z), (0.0006, 0.0008, 0.007), 0.0002, "dark")
    # the butt: stacked spacer plates and the black pad
    section_body(P, box_outline((0.262, 0.283), -0.165, 0.010),
                 [dict(z=(0.262, 0.283), key="core", hw=0.0195, c=0.004, step=0.01)])
    for z in (0.269, 0.276):
        for n in (R, L):
            rrect_cut(P, (n.x * 0.0195, -0.077, z), n, UP, 0.190, 0.0012, 0.0005, 0.0008, "dark")
    section_body(P, box_outline((0.283, 0.318), -0.168, 0.013),
                 [dict(z=(0.283, 0.318), key="rubber", hw=0.0210, c=0.0065, step=0.006)])
    for k in range(12):
        rrect_cut(P, (0, 0.002 - 0.0135 * k, 0.318), ZV, R, 0.034, 0.0030, 0.0013, 0.0015, "rubber")


def body():
    P = Part(PFX + "_Body")
    action(P)
    chassis(P)
    handguard(P)
    barrel(P)
    grip(P)
    stock(P)
    return fin(P)


def brake():
    # a black cylinder brake with three big ports a side, the bore open at
    # the front; its own node so a muzzle attachment can take its place
    P = Part(PFX + "_Brake")
    lathe(P, [(BRAKE_Z, 0.0), (BRAKE_Z, 0.0105), (BRAKE_Z - 0.004, 0.0128), (MUZZLE_Z + 0.004, 0.0128),
              (MUZZLE_Z, 0.0112), (MUZZLE_Z, 0.0)], "core", segs=40)
    for k in range(3):
        z = BRAKE_Z - 0.019 - 0.018 * k
        rrect_cut(P, (0.0128, 0.0, z), R, ZV, 0.011, 0.017, 0.0025, 0.03, "dark")
        rrect_cut(P, (0.0, 0.0128, z), UP, ZV, 0.006, 0.006, 0.0025, 0.006, "dark")
    hole(P, (0, 0, MUZZLE_Z), (0, 0, -1), 0.0060, 0.08, "dark", segs=12)
    screw(P, (0.0, -0.0128, BRAKE_Z - 0.008), (0, -1, 0), 0.0020)
    return fin(P)


def bolt():
    # the bolt as one node about the bore: the polished body with its lugs
    # and three spiral flutes (concept-2), the handle's collar, the stem out
    # right and down to the knurled ball, the black shroud behind
    P = moving(PFX, "Bolt", (0, 0, BOLT_ROOT), "slide", "z", TRAVEL)
    P.extras["tf_lift"] = LIFT
    lathe(P, [(-0.108, 0.0), (-0.108, 0.0092), (BOLT_FACE + 0.004, 0.0092), (BOLT_FACE + 0.002, 0.0086),
              (BOLT_FACE, 0.0080), (BOLT_FACE, 0.0)], "bolt", segs=40)
    for sy in (1, -1):
        chamfer_box(P, (0, sy * 0.0098, BOLT_FACE + 0.008), (0.009, 0.004, 0.014), 0.0012, "bolt")
    hole(P, (0, 0, BOLT_FACE), (0, 0, -1), 0.0060, 0.0018, "steel", segs=16)
    # the flutes: a helix of short straight cuts, three starts
    for f in range(3):
        for k in range(5):
            z = -0.200 + 0.019 * k
            a = f * gk.TAU / 3 + k * 0.32
            nrm = Vector((math.cos(a), math.sin(a), 0))
            tang = Vector((-math.sin(a), math.cos(a), 0))
            along = (ZV + tang * 0.42).normalized()
            rrect_cut(P, nrm * 0.0092 + Vector((0, 0, z)), nrm, along, 0.024, 0.0050, 0.0022, 0.0019, "bolt")
    lathe(P, [(-0.092, 0.0), (-0.092, 0.0104), (-0.108, 0.0104), (-0.108, 0.0)], "steel", segs=32)
    root = Vector((0.0085, -0.002, BOLT_ROOT))
    sweep(P, catmull([root, root + (KNOB - root) * 0.35 + Vector((0.002, 0, 0)), KNOB - (KNOB - root).normalized() * KNOB_R * 0.6], 10),
          lambda s: 0.0042 - 0.0012 * s, "steel", sides=12, uv=False)
    ax = (KNOB - root).normalized()
    local_lathe(P, KNOB, ax, [(-KNOB_R * math.cos(math.radians(a)), KNOB_R * math.sin(math.radians(a)))
                              for a in range(0, 181, 15)], "steel", segs=24)
    if gk.HI:
        # knurled: little pyramids over the ball (the bake carries them)
        n = 220
        for i in range(n):
            y = 1 - 2 * (i + 0.5) / n
            r_ = math.sqrt(max(0.0, 1 - y * y))
            th = i * math.pi * (3 - math.sqrt(5))
            d = Vector((math.cos(th) * r_, y, math.sin(th) * r_))
            if d.dot(ax) < -0.55:
                continue          # under the stem
            local_lathe(P, KNOB + d * (KNOB_R - 0.0002), d, [(0.0, 0.00075), (0.0006, 0.0)], "steel", segs=4, spin=th)
    # the shroud: black, stepped, a cocking stud on top
    lathe(P, [(-0.054, 0.0), (-0.054, 0.0075), (-0.057, 0.0098), (-0.084, 0.0108), (-0.088, 0.0112), (-0.092, 0.0112), (-0.092, 0.0)],
          "core", segs=32)
    chamfer_box(P, (0, 0.0120, -0.066), (0.006, 0.004, 0.014), 0.0012, "core")
    hole(P, (0, 0, -0.054), (0, 0, 1), 0.0028, 0.002, "dark", segs=10)
    return fin(P)


def round_():
    # one .338 round lying in the open action, its case head at the raked
    # bolt face, the bullet toward the chamber (shown while the bolt is back)
    P = Part(PFX + "_Round", pivot=(0, 0, ROUND_HEAD))
    P.extras["tf_round"] = 1
    h = ROUND_HEAD
    lathe(P, [(h, 0.0), (h, 0.0068), (h - 0.0015, 0.0068), (h - 0.0020, 0.0060), (h - 0.0035, 0.0060), (h - 0.0045, 0.0074),
              (h - 0.054, 0.0071), (h - 0.060, 0.0047), (h - 0.0695, 0.0047), (h - 0.0695, 0.0)], "brass", segs=28)
    lathe(P, [(h - 0.0695, 0.0), (h - 0.0695, 0.0043), (h - 0.078, 0.0043), (h - 0.086, 0.0031), (h - 0.091, 0.0013),
              (h - 0.093, 0.0)], "bullet", segs=28)
    local_lathe(P, (0, 0, h), (0, 0, 1), [(-0.0003, 0.0022), (0.0002, 0.0022), (0.0003, 0.0)], "brass", segs=14)   # primer
    return P.finish(smooth_angle=50, bevel=0.0)


def parts():
    rail()
    bolt()
    round_()
    # trigger: a black curved blade about its pin
    P = moving(PFX, "Trigger", tuple(TRIG), "hinge", "x", -0.28)
    sweep(P, catmull([TRIG, TRIG + Vector((0, -0.011, -0.003)), TRIG + Vector((0, -0.021, -0.002)), TRIG + Vector((0, -0.028, 0.004))], 10),
          lambda s: 0.0026 - 0.0006 * s, "core", sides=10, uv=False)
    fin(P)
    # magazine: a black .338 box, 2 x 3 recessed windows a side (concept-1),
    # ribs and a flared floorplate
    P = moving(PFX, "Mag", (0, MAG_TOP - 0.006, (MAG_Z[0] + MAG_Z[1]) / 2), "slide", "y", 0.0)
    mz0, mz1 = MAG_Z
    section_body(P, [(mz0, MAG_TOP), (mz1, MAG_TOP), (mz1, MAG_BOT + 0.012), (mz1 - 0.003, MAG_BOT + 0.010),
                     (mz1 - 0.003, MAG_BOT), (mz0 + 0.003, MAG_BOT), (mz0 + 0.003, MAG_BOT + 0.010), (mz0, MAG_BOT + 0.012)],
                 [dict(axis="v", y=(MAG_TOP - 0.001, MAG_BOT + 0.011), key="magm", hw=HW_MAG, c=0.003),
                  dict(axis="v", y=(MAG_BOT + 0.011, MAG_BOT + 0.0005), key="magm", hw=HW_MAG + 0.002, c=0.003)])
    for n in (R, L):
        x = n.x * HW_MAG
        for i in range(2):
            for j in range(3):
                rrect_cut(P, (x, -0.076 - 0.028 * j, -0.165 - 0.052 * i), n, ZV, 0.044, 0.023, 0.003, 0.0014, "magm")
        for k in range(4):
            rrect_cut(P, (x, -0.0655 + 0.0018 * k, -0.191), n, ZV, 0.094, 0.0008, 0.0003, 0.0005, "magm")
    fin(P)
    # the bipod's legs, folded forward along the belly (posed, never cycled)
    for side, name in ((-1, "BipodL"), (1, "BipodR")):
        x = side * 0.0105
        P = moving(PFX, name, (x, -0.034, BIPOD_Z[0]), "hinge", "x", 1.5)
        lathe(P, [(BIPOD_Z[0] - 0.006, 0.0), (BIPOD_Z[0] - 0.006, 0.0050), (-0.600, 0.0050), (-0.602, 0.0040),
                  (BIPOD_Z[1] + 0.012, 0.0040), (BIPOD_Z[1] + 0.012, 0.0)], "core", segs=16, cx=x, cy=-0.034)
        for k in range(4):
            lathe(P, [(-0.612 - 0.006 * k, 0.0), (-0.612 - 0.006 * k, 0.0043), (-0.614 - 0.006 * k, 0.0043), (-0.614 - 0.006 * k, 0.0)],
                  "steel", segs=16, cx=x, cy=-0.034)
        lathe(P, [(BIPOD_Z[1] + 0.012, 0.0), (BIPOD_Z[1] + 0.012, 0.0055), (BIPOD_Z[1] + 0.002, 0.0060), (BIPOD_Z[1], 0.0045),
                  (BIPOD_Z[1], 0.0)], "rubber", segs=16, cx=x, cy=-0.034)
        fin(P)


def points():
    # the traced Ballista's grip hand (the rig is fitted to it), the support
    # on the handguard top (buildDetailed drops it 0.05 to the belly), the
    # scope over the action, the underbarrel on the belly rail
    for name, p in (("Grip", (0, -0.100, 0.020)), ("Support", (0, HG_TOP, -0.410)), ("Muzzle", (0, 0, MUZZLE_Z)),
                    ("Aim", (0, 0.062, -0.150)), ("Under", (0, HG_BOT - 0.0105, -0.348)), ("Rail", (0, RAIL_TOP, -0.170)),
                    ("Eject", (0.022, 0.006, -0.162)), ("BoltKnob", tuple(KNOB))):
        empty(PFX + "_" + name, p)


def recipe():
    body()
    brake()
    parts()
    points()


VIEWS = {
    "side": ((1.75, 0.0, -0.27), (0, -0.03, -0.27), 50),
    "c1": ((0.95, 0.25, 0.80), (0, -0.04, -0.28), 45),        # concept-1's angle (mirrored, as the game shows it)
    "port": ((0.30, 0.05, -0.03), (0.01, -0.010, -0.140), 50), # concept-2
    "stock": ((0.55, 0.10, 0.45), (0, -0.07, 0.17), 50),
    "under": ((0.60, -0.45, -0.45), (0, -0.05, -0.45), 45),
    "left": ((-1.3, 0.25, -0.10), (0, -0.04, -0.27), 50),
}

if BAKE:
    render = {"dir": os.environ.get("HB_RENDER_DIR", os.path.join(HERE, "_renders")), "views": VIEWS} if "render" in ARGS else None
    # first person carries the detail (2048 maps); everyone else sees the
    # LOD1 at the third-person budget (~6k tris, 256 px): the user's rule
    bake_kit.bake_gun(recipe, "ballista", PFX, HERE, render=render, res=2048, margin_px=6, lod_ratio=0.07)
else:
    gk.HI = "hi" in ARGS
    recipe()
    gk.export(os.path.join(os.environ.get("HB_OUT", HERE), "ballista.glb"), PFX)
    if "render" in ARGS:
        gk.render_views(os.environ.get("HB_RENDER_DIR", os.path.join(HERE, "_renders")), VIEWS, PFX)
