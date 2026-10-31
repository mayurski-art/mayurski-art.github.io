"""
The Howl Ballista (DESIGN-ARSENAL.md Phase 1 step 5, gun 3: the bolt
sniper): Black Ops 2's Ballista, which is FN Herstal's Ballista (the
Unique Alpine TPG design, .338 Lapua). User, 2026-10-30: "exactly like the
Black Ops 2 one", with its scope. References in refs/arms/howl/:
real/fn-ballista-2.jpg (the true right side) sets every proportion,
measured at 0.000552 m a pixel around the grip-hand anchor; the concept
sheet and bo2/ set the surface: a scuffed flat-dark-earth chassis worn to
grey metal, a dark grey fluted barrel and brake, black stock furniture,
a dark mag, the tan scope on a black cantilever mount with a spirit level.

The moving parts follow the convention agreed with the MTAR session
(refs/arms/howl/NOTES.md), whose runtime drives them:
  HB_Bolt      one node, pivoted on the bore at the handle's root: slide z
               by TRAVEL (the rake) and tf_lift (radians, + rotation.z
               lifts the knob); rifle-action.js placeBolt runs both.
  HB_BoltKnob  point: the knob's centre (the trigger hand's target).
  HB_Round     one .338 round in the open action, its case head at the
               raked bolt face (tf_round): shown while the bolt is back.
  HB_Eject     point: where the case leaves the port on the rake.
  HB_Scope     the gun's own scope, mount and level (the default optic);
               HB_Aim sits on its axis. Another optic hides it.
  HB_Trigger, HB_Mag, HB_BipodL / HB_BipodR (folded, never cycled).

    blender --background --python build_ballista.blender.py --              # flat materials -> ballista.glb
    ... -- render                                                           # + check renders (HB_RENDER_DIR)
    ... -- bake [render]                                                    # bake_kit.bake_gun: maps, LOD1

Game coordinates: x right, y up, -z toward the muzzle, metres; the bore on
y 0, the grip hand at z 0.02.
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
FDE = 0x7f6a3e           # the chassis: flat dark earth, as BO2's and the sheet's
WORN = 0x77766f          # worn through to grey metal at every edge

if BAKE:
    import bake_kit
    K = bake_kit.kit_material
    gk.M.update({
        "chassis": K("HB_Chassis", "cerakote", FDE, WORN, Wear=1.0, Patches=0.45, Grain=0.32),
        "guard":   K("HB_Guard", "cerakote", FDE, WORN, Wear=1.0, Patches=0.4, Grain=0.32),
        "stock":   K("HB_Stock", "cerakote", FDE, WORN, Wear=1.0, Patches=0.4, Grain=0.32),
        "scope":   K("HB_ScopeBody", "cerakote", 0x8c7748, WORN, Wear=0.9, Patches=0.4, Grain=0.3, Roughness=0.55),
        "gripm":   K("HB_Grip", "polymer", 0x8f7a55, 0x6a5e48, Wear=0.6, Roughness=0.8),
        "core":    K("HB_Core", "anodized", 0x19191a),
        "steel":   K("HB_Steel", "parkerized", 0x35373a),
        "bolt":    K("HB_Bolt", "parkerized", 0x2b2d30, 0x9a9da0, Wear=0.6, Metallic=0.9, Roughness=0.35),
        "magm":    K("HB_MagBody", "polymer", 0x26231f, Wear=0.5),
        "rubber":  K("HB_Pad", "rubber"),
        "brass":   K("HB_Brass", "brass"),
        "bullet":  K("HB_Bullet", "brass", 0x8c5a36, 0xb07a4e, Wear=0.2),
        "glass":   K("HB_Glass", "anodized", 0x0c141c, 0x0c141c, Wear=0.0, Metallic=0.7, Roughness=0.06),
        "white":   K("HB_Ticks", "polymer", 0xd8d8d2, 0xd8d8d2, Wear=0.0, Roughness=0.5),
        "red":     K("HB_Red", "polymer", 0xb3201c, 0xb3201c, Wear=0.0, Roughness=0.45),
        "green":   K("HB_Level", "polymer", 0x5fd02a, 0x5fd02a, Wear=0.0, Roughness=0.2),
        "dark":    K("HB_Dark", "parkerized", 0x0e0e0e, Wear=0.0, Metallic=0.0, Roughness=0.85),
    })
else:
    gk.M.update({
        "chassis": gk.material("HB_Chassis", FDE, 0.62), "guard": gk.material("HB_Guard", FDE, 0.62),
        "stock": gk.material("HB_Stock", FDE, 0.62), "scope": gk.material("HB_ScopeBody", 0x9d8a62, 0.55),
        "gripm": gk.material("HB_Grip", 0x8f7a55, 0.8),
        "core": gk.material("HB_Core", 0x19191a, 0.42, 0.35), "steel": gk.material("HB_Steel", 0x35373a, 0.5, 0.6),
        "bolt": gk.material("HB_Bolt", 0x2b2d30, 0.35, 0.9), "magm": gk.material("HB_MagBody", 0x26231f, 0.8),
        "rubber": gk.material("HB_Pad", 0x141414, 0.92), "brass": gk.material("HB_Brass", 0xb38f42, 0.3, 1.0),
        "bullet": gk.material("HB_Bullet", 0x8c5a36, 0.32, 1.0), "glass": gk.material("HB_Glass", 0x0c141c, 0.06, 0.7),
        "white": gk.material("HB_Ticks", 0xd8d8d2, 0.5), "red": gk.material("HB_Red", 0xb3201c, 0.45),
        "green": gk.material("HB_Level", 0x5fd02a, 0.2), "dark": gk.material("HB_Dark", 0x0e0e0e, 0.85),
    })

R, L = Vector((1, 0, 0)), Vector((-1, 0, 0))
UP, DN, ZV = Vector((0, 1, 0)), Vector((0, -1, 0)), Vector((0, 0, 1))
# half-widths
HW_RX, HW_HG, HW_GRIP, HW_STOCK, HW_MAG = 0.021, 0.022, 0.015, 0.016, 0.0145
# the receiver (one piece with the tang behind it) and the handguard, rear to front
RX_Z = (0.034, -0.242)                   # hinge face to the handguard
RX_TOP, TANG_TOP = 0.026, -0.021         # the flat top under the rail; the tang behind the receiver
RX_REAR = -0.016                         # where the receiver's rear wall stands (the tang drops behind it)
HG_Z = (-0.242, -0.590)
HG_TOP, HG_BOT, HG_STEP = 0.026, -0.026, -0.043   # the front half steps down to a deeper belly
HG_STEP_Z = -0.432
RAIL_S = 0.024                           # the rail's bed; its teeth top out 9.2 mm above
RAIL_TOP = RAIL_S + 0.0092
RAIL_Z = (-0.027, -0.582)
BRAKE_Z, MUZZLE_Z = -0.819, -0.938
# the bolt: face at rest, the handle's root (the node's pivot, on the bore), the rake
BOLT_FACE, BOLT_ROOT, TRAVEL, LIFT = -0.185, -0.057, 0.090, 1.05
KNOB = Vector((0.036, -0.040, -0.018))   # the knob: out right, down, swept back (fn-ballista-2)
KNOB_R = 0.0115
PORT = dict(z=-0.130, y=0.0055, len=0.102, h=0.023)
ROUND_HEAD = BOLT_FACE + TRAVEL - 0.001  # the round waits just ahead of the raked bolt face
MAG_Z, MAG_TOP, MAG_BOT = (-0.078, -0.184), -0.040, -0.163
TRIG = Vector((0, -0.058, -0.040))
BIPOD_Z = (-0.500, -0.735)
SCOPE_Y = RAIL_TOP + 0.046               # the scope's axis
SCOPE_Z = (0.094, -0.336)                # eyepiece to objective
TURRET_Z = -0.100
RING_Z = (-0.040, -0.158)


# ------------------------------------------------------------------ helpers

def box_outline(z, y0, y1):
    a, b = max(z) + 0.002, min(z) - 0.002
    return [(a, y0), (a, y1), (b, y1), (b, y0)]


def rrect_cut(P, center, normal, along, w, h, r, depth, key, n=3):
    """A rounded-rectangle pocket cut into a face (w along `along`, h
    across), its floor and walls in `key`; r = h/2 makes a stadium."""
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


def picatinny(P, surface, out, across, z0, z1, key="chassis", hw=0.0106, base=0.0035, tooth=0.0035, pitch=0.010):
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


def drum(P, center, normal, r, h, key="core", ribs=24, ticks=0):
    """A turret drum standing on a face: knurled ribs round it, white tick
    marks on its outer rim."""
    local_lathe(P, center, normal, [(0.0, r), (h - 0.0012, r), (h, r - 0.0012), (h, 0.0)], key, segs=32)
    if not gk.HI:
        return           # the knurl and ticks are the bake's (the maps carry them)
    t, n, b = gk.frame_from_normal(normal)
    c = Vector(center)
    for k in range(ribs):
        a = gk.TAU * k / ribs
        d = t * math.cos(a) + b * math.sin(a)
        chamfer_box(P, c + d * r + n * (h * 0.45), (0.0009, 0.0011, h * 0.5), 0.0002, key,
                    (d, d.cross(n).normalized(), n))
    for k in range(ticks):
        a = gk.TAU * k / ticks
        d = t * math.cos(a) + b * math.sin(a)
        chamfer_box(P, c + d * (r + 0.0002) + n * (h * 0.85), (0.0006, 0.0010, 0.0030 if k % 4 == 0 else 0.0018), 0.0001,
                    "white", (d, d.cross(n).normalized(), n))


def fin(P):
    """Rounded edges on the game mesh too, a finer bevel on the bake's high
    pass. Sharp outer miters: gunkit's arc miters throw vertices off to
    infinity on some corners (lathe caps, cut floors)."""
    ob = P.finish(smooth_angle=34, bevel=0.0007 if gk.HI else 0.0006, bevel_segs=3 if gk.HI else 2)
    bv = ob.modifiers.get("bevel")
    if bv:
        bv.miter_outer = "MITER_SHARP"
        bv.use_clamp_overlap = True
    return ob


# ------------------------------------------------------------------ the body

def receiver(P):
    # one tan block (fn-ballista-2): the flat top under the rail, the tang
    # dropping behind the rear wall to the stock's hinge, the mag well's
    # flare, the trigger guard (its opening cut through), the grip's seat
    outline = [(RX_Z[0], TANG_TOP), (0.002, TANG_TOP), (RX_REAR, 0.012), (RX_REAR - 0.008, RX_TOP),
               (RX_Z[1] - 0.002, RX_TOP), (RX_Z[1] - 0.002, -0.040), (-0.236, -0.057), (-0.190, -0.057),
               (-0.188, -0.071), (-0.075, -0.071), (-0.071, -0.090), (-0.061, -0.097), (-0.013, -0.097),
               (-0.007, -0.088), (-0.010, -0.062), (RX_Z[0], -0.062)]
    section_body(P, outline, [dict(z=(RX_Z[0] - 0.001, RX_Z[1] + 0.002), key="chassis", hw=HW_RX, c=0.0035, step=0.003)], smooth=0)
    rrect_cut(P, (HW_RX, -0.0775, -0.042), R, ZV, 0.052, 0.026, 0.008, 0.06, "chassis")   # the guard's opening
    # the bolt's channel, open at the rear wall for the rake
    hole(P, (0, 0, RX_REAR + 0.004), (0, 0, 1), 0.0100, abs(RX_Z[1] - RX_REAR) + 0.004, "dark", segs=20)
    # the port: a stadium with a chamfered lip, through to the bolt
    rrect_cut(P, (HW_RX, PORT["y"], PORT["z"]), R, ZV, PORT["len"] + 0.004, PORT["h"] + 0.004, (PORT["h"] + 0.004) / 2, 0.0012, "chassis")
    rrect_cut(P, (HW_RX - 0.0012, PORT["y"], PORT["z"]), R, ZV, PORT["len"], PORT["h"], PORT["h"] / 2, 0.024, "core")
    # the handle's L-shaped notch behind the port: a short drop where it rests,
    # and the slot it rakes back along when lifted, out through the rear wall
    rrect_cut(P, (HW_RX, 0.004, BOLT_ROOT), R, ZV, 0.016, 0.026, 0.004, 0.020, "core")
    rrect_cut(P, (HW_RX, 0.012, (BOLT_ROOT + RX_REAR) / 2 - 0.004), R, ZV, abs(BOLT_ROOT - RX_REAR) + 0.024, 0.013, 0.004, 0.020, "core")
    for n in (R, L):
        x = n.x * HW_RX
        # the long stadium groove under the port, the seam down to the well
        rrect_cut(P, (x, -0.020, PORT["z"]), n, ZV, PORT["len"], 0.009, 0.0045, 0.0014, "chassis")
        panel_line(P, [(x, -0.036, -0.022), (x, -0.036, -0.200), (x, -0.030, -0.236)], n)
        panel_line(P, [(x, 0.020, -0.200), (x, 0.020, -0.238)], n)
        screw(P, (x, -0.040, -0.226), n, 0.0034)          # the big cross-bolt by the handguard
        screw(P, (x, -0.029, 0.014), n)
        screw(P, (x, -0.029, 0.030), n)
        hole(P, (x, -0.006, -0.204), n, 0.0016, 0.003, "dark", segs=10)
        # the mag release's angled cut ahead of the well
        rrect_cut(P, (x, -0.046, -0.200), n, ZV, 0.016, 0.010, 0.002, 0.003, "core")
        # QD cup on the tang
        local_lathe(P, (x, -0.042, 0.022), n, [(-0.0005, 0.0050), (0.0012, 0.0050), (0.0015, 0.0040), (0.0015, 0.0)], "core", segs=18)
        hole(P, (x + n.x * 0.0015, -0.042, 0.022), n, 0.0028, 0.004, "dark", segs=10)
    # the safety: a ribbed tab on the left of the tang (the handle rakes back over the right)
    chamfer_box(P, (-HW_RX + 0.004, TANG_TOP + 0.002, 0.012), (0.007, 0.005, 0.012), 0.0012, "core")
    for k in range(3):
        chamfer_box(P, (-HW_RX + 0.004, TANG_TOP + 0.0047, 0.008 + 0.004 * k), (0.0065, 0.0008, 0.0012), 0.0003, "core")
    # the stock's hinge: a black block, its latch lever and pin on the right
    chamfer_box(P, (0, -0.040, 0.046), (2 * HW_RX + 0.002, 0.042, 0.024), 0.003, "core")
    chamfer_box(P, (HW_RX + 0.0025, -0.034, 0.048), (0.004, 0.022, 0.010), 0.0014, "core")
    local_lathe(P, (HW_RX + 0.001, -0.052, 0.046), R, [(-0.001, 0.0055), (0.0025, 0.0055), (0.003, 0.0045), (0.003, 0.0)], "core", segs=18)


def handguard(P):
    # an octagon under the rail; the rear half to the receiver's depth, the
    # front half stepping down to a deeper belly (fn-ballista-2); windows
    # through each side between screw bosses, short slots on the front
    # half's lower step, a line of round holes by the receiver
    section_body(P, [(HG_Z[0] + 0.002, HG_TOP), (HG_Z[1] - 0.002, HG_TOP), (HG_Z[1] - 0.002, HG_STEP),
                     (HG_STEP_Z - 0.006, HG_STEP), (HG_STEP_Z + 0.006, HG_BOT), (HG_Z[0] + 0.002, HG_BOT)],
                 [dict(z=(HG_Z[0], HG_Z[1]), key="guard", hw=HW_HG, c=0.006, top=HG_TOP, step=0.003)], smooth=0)
    for n in (R, L):
        x = n.x * HW_HG
        for k in range(6):
            z = -0.272 - 0.057 * k
            rrect_cut(P, (x, 0.004, z), n, ZV, 0.040, 0.021, 0.004, 0.012, "core")
            screw(P, (x, 0.019, z - 0.0285), n, 0.0022)
            screw(P, (x, -0.012, z - 0.0285), n, 0.0022)
        for k in range(5):
            rrect_cut(P, (x, -0.0345, -0.455 - 0.027 * k), n, ZV, 0.018, 0.0055, 0.00275, 0.004, "core")
        for k, y in enumerate((0.013, 0.002, -0.009)):
            hole(P, (x, y, -0.249), n, 0.0019, 0.005, "core", segs=10)
        local_lathe(P, (x, -0.034, -0.575), n, [(-0.0005, 0.0050), (0.0012, 0.0050), (0.0015, 0.0040), (0.0015, 0.0)], "core", segs=18)
        hole(P, (x + n.x * 0.0015, -0.034, -0.575), n, 0.0028, 0.004, "dark", segs=10)   # QD cup at the nose
    # the belly rail under the front step (the underbarrel's), the bipod's mount ahead of it
    picatinny(P, (0, HG_STEP + 0.0024 - 0.0002, 0), DN, R, -0.440, -0.480, hw=0.0100)
    chamfer_box(P, (0, HG_STEP - 0.008, BIPOD_Z[0] - 0.008), (0.032, 0.016, 0.034), 0.003, "core")
    local_lathe(P, (0.016, HG_STEP - 0.010, BIPOD_Z[0] - 0.008), R, [(-0.0005, 0.0055), (0.0030, 0.0055), (0.0036, 0.0)], "core", segs=16)
    screw(P, (0, HG_STEP - 0.016, BIPOD_Z[0] - 0.016), DN, 0.0030)


def lower_panel(P):
    # the perforated accessory panel hung under the handguard's rear half
    # (fn-ballista-2's dotted panel): a long recess and a row of dimples
    section_body(P, [(-0.236, HG_BOT + 0.004), (-0.392, HG_BOT + 0.004), (-0.402, -0.040), (-0.384, -0.057), (-0.250, -0.057), (-0.236, -0.050)],
                 [dict(z=(-0.237, -0.401), key="guard", hw=0.019, c=0.004, step=0.003)], smooth=0)
    for n in (R, L):
        x = n.x * 0.019
        rrect_cut(P, (x, -0.038, -0.318), n, ZV, 0.120, 0.010, 0.005, 0.0012, "guard")
        for k in range(14):
            local_lathe(P, (x, -0.051, -0.252 - 0.0098 * k), n, [(-0.0004, 0.0012), (0.0004, 0.0009), (0.0006, 0.0)], "guard", segs=8)
        screw(P, (x, -0.030, -0.252), n, 0.0020)
        screw(P, (x, -0.030, -0.384), n, 0.0020)


def rail():
    P = Part(PFX + "_Rail")
    picatinny(P, (0, RAIL_S - 0.0024, 0), UP, R, RAIL_Z[0], RAIL_Z[1])
    return fin(P)


def barrel(P):
    # dark grey (BO2's; the real one is tan), a shank in the handguard, the
    # taper, six flutes from the handguard's nose
    lathe(P, [(RX_Z[1] + 0.004, 0.0), (RX_Z[1] + 0.004, 0.0125), (-0.300, 0.0125), (-0.312, 0.0105),
              (-0.600, 0.0102), (BRAKE_Z + 0.002, 0.0094), (BRAKE_Z + 0.002, 0.0)], "steel", segs=40)
    for k in range(6):
        a = gk.TAU * k / 6
        nrm = Vector((math.cos(a), math.sin(a), 0))
        rrect_cut(P, nrm * 0.0098 + Vector((0, 0, -0.705)), nrm, ZV, 0.180, 0.0034, 0.0017, 0.0013, "steel")


def grip(P):
    # FN's tan ergonomic grip: raked back, a finger swell on the front
    # strap, a flared heel; dimples over both sides (the bake carries them)
    section_body(P, [(-0.016, -0.061), (0.028, -0.061), (0.040, -0.090), (0.056, -0.130), (0.072, -0.160),
                     (0.070, -0.168), (0.008, -0.168), (0.004, -0.158), (0.000, -0.138), (-0.006, -0.120),
                     (-0.010, -0.108), (-0.008, -0.096), (-0.013, -0.080)],
                 [dict(axis="v", y=(-0.062, -0.167), key="gripm", hw=HW_GRIP, c=0.005)])
    v = Vector((0, 0.906, -0.423))
    for side, n in ((1, R), (-1, L)):
        o = Vector((side * (HW_GRIP - 0.0006), -0.160, 0.058 if side > 0 else 0.016))
        stipple(P, o, (0, 0, -side), v, 0.034, 0.075, "gripm", pitch=0.0050, r=0.0011, seed=3 + side)


def stock(P):
    # FN's folding stock: a tan beam off the hinge with a long stadium
    # window, a black cheek piece on its adjuster, a tan upright, the black
    # concave butt pad, a tan bracket and a short rail under the butt
    section_body(P, box_outline((0.058, 0.276), -0.054, TANG_TOP),
                 [dict(z=(0.058, 0.276), key="stock", hw=HW_STOCK, c=0.0035, step=0.05)])
    rrect_cut(P, (HW_STOCK, -0.0385, 0.183), R, ZV, 0.132, 0.017, 0.0085, 0.04, "core")
    for n in (R, L):
        x = n.x * HW_STOCK
        panel_line(P, [(x, -0.025, 0.070), (x, -0.025, 0.270)], n)
        screw(P, (x, -0.046, 0.070), n)
        screw(P, (x, -0.046, 0.262), n)
    # the adjuster under the cheek piece (tan) with its slot and lever, the cheek piece (black)
    section_body(P, box_outline((0.150, 0.272), TANG_TOP - 0.002, -0.006),
                 [dict(z=(0.150, 0.272), key="stock", hw=HW_STOCK - 0.002, c=0.003, step=0.05)])
    for n in (R, L):
        rrect_cut(P, (n.x * (HW_STOCK - 0.002), -0.0135, 0.226), n, ZV, 0.060, 0.007, 0.0035, 0.0015, "core")
    chamfer_box(P, (HW_STOCK + 0.001, -0.0135, 0.208), (0.005, 0.006, 0.024), 0.0015, "core")
    section_body(P, [(0.276, -0.007), (0.276, 0.023), (0.140, 0.023), (0.122, 0.020), (0.122, 0.012), (0.150, -0.007)],
                 [dict(z=(0.275, 0.123), key="rubber", hw=HW_STOCK + 0.001, c=0.0045, step=0.004)], smooth=0)
    rrect_cut(P, (0, 0.023, 0.200), UP, ZV, 0.120, 0.014, 0.006, 0.0015, "rubber")
    # the upright to the pad
    section_body(P, box_outline((0.274, 0.290), -0.112, 0.022),
                 [dict(z=(0.274, 0.290), key="stock", hw=HW_STOCK + 0.001, c=0.0035, step=0.01)])
    for n in (R, L):
        local_lathe(P, (n.x * (HW_STOCK + 0.001), -0.030, 0.282), n, [(-0.0005, 0.0048), (0.0012, 0.0048), (0.0015, 0.0038), (0.0015, 0.0)], "core", segs=18)
        hole(P, (n.x * (HW_STOCK + 0.0026), -0.030, 0.282), n, 0.0026, 0.004, "dark", segs=10)
    # the pad: black rubber, its back hollowed (concave), spacer lines
    section_body(P, [(0.290, 0.023), (0.352, 0.023), (0.343, -0.010), (0.339, -0.046), (0.342, -0.080),
                     (0.352, -0.116), (0.290, -0.116)],
                 [dict(axis="v", y=(0.022, -0.115), key="rubber", hw=0.021, c=0.005, step=0.003)])
    for n in (R, L):
        for z in (0.300, 0.312):
            rrect_cut(P, (n.x * 0.021, -0.046, z), n, UP, 0.134, 0.0012, 0.0005, 0.0010, "rubber")
    # under the butt: the tan bracket and its short rail
    section_body(P, box_outline((0.222, 0.272), -0.100, -0.054),
                 [dict(z=(0.222, 0.272), key="stock", hw=0.012, c=0.003, step=0.01)])
    picatinny(P, (0, -0.100 - 0.0024, 0), DN, R, 0.214, 0.300, key="core", hw=0.0090)


def body():
    P = Part(PFX + "_Body")
    receiver(P)
    handguard(P)
    lower_panel(P)
    barrel(P)
    grip(P)
    stock(P)
    return fin(P)


def brake():
    # FN's: a hex collar, a ribbed sleeve, then the brake with four rows
    # of slots a side; its own node so a muzzle attachment can take its place
    P = Part(PFX + "_Brake")
    lathe(P, [(BRAKE_Z, 0.0), (BRAKE_Z, 0.0118), (BRAKE_Z - 0.017, 0.0118), (BRAKE_Z - 0.017, 0.0)], "core", segs=6)
    lathe(P, [(BRAKE_Z - 0.017, 0.0), (BRAKE_Z - 0.017, 0.0112), (BRAKE_Z - 0.053, 0.0112), (BRAKE_Z - 0.053, 0.0)], "core", segs=36)
    for k in range(7):
        z = BRAKE_Z - 0.021 - 0.0047 * k
        lathe(P, [(z, 0.0), (z, 0.0120), (z - 0.0028, 0.0120), (z - 0.0028, 0.0)], "core", segs=36)
    lathe(P, [(BRAKE_Z - 0.053, 0.0), (BRAKE_Z - 0.053, 0.0125), (MUZZLE_Z + 0.003, 0.0125), (MUZZLE_Z, 0.0112), (MUZZLE_Z, 0.0)], "core", segs=36)
    for k in range(4):
        z = BRAKE_Z - 0.066 - 0.014 * k
        rrect_cut(P, (0.0125, 0.0, z), R, ZV, 0.0075, 0.019, 0.0035, 0.03, "dark")
    hole(P, (0, 0, MUZZLE_Z), (0, 0, -1), 0.0058, 0.08, "dark", segs=12)
    return fin(P)


def bolt():
    # one node about the bore: the dark bolt body with its lugs and a spiral
    # flute (seen in the port), the handle's collar, the stem swept back and
    # down to the black ball, the shroud with BO2's slot and red indicator
    P = moving(PFX, "Bolt", (0, 0, BOLT_ROOT), "slide", "z", TRAVEL)
    P.extras["tf_lift"] = LIFT
    lathe(P, [(-0.064, 0.0), (-0.064, 0.0093), (BOLT_FACE + 0.004, 0.0093), (BOLT_FACE + 0.002, 0.0087),
              (BOLT_FACE, 0.0081), (BOLT_FACE, 0.0)], "bolt", segs=40)
    for sy in (1, -1):
        chamfer_box(P, (0, sy * 0.0099, BOLT_FACE + 0.008), (0.009, 0.004, 0.014), 0.0012, "bolt")
    hole(P, (0, 0, BOLT_FACE), (0, 0, -1), 0.0060, 0.0018, "steel", segs=16)
    for f in range(3):
        for k in range(5):
            z = -0.168 + 0.019 * k
            a = f * gk.TAU / 3 + k * 0.32
            nrm = Vector((math.cos(a), math.sin(a), 0))
            along = (ZV + Vector((-math.sin(a), math.cos(a), 0)) * 0.42).normalized()
            rrect_cut(P, nrm * 0.0093 + Vector((0, 0, z)), nrm, along, 0.024, 0.0050, 0.0022, 0.0019, "bolt")
    lathe(P, [(-0.048, 0.0), (-0.048, 0.0106), (-0.064, 0.0106), (-0.064, 0.0)], "steel", segs=32)
    root = Vector((0.0090, 0.0, BOLT_ROOT))
    elbow = Vector((0.030, -0.006, BOLT_ROOT + 0.010))
    tip = KNOB - (KNOB - elbow).normalized() * KNOB_R * 0.6
    sweep(P, catmull([root, elbow, (elbow + tip) / 2 + Vector((0.002, 0, 0)), tip], 12),
          lambda s: 0.0046 - 0.0012 * s, "steel", sides=12, uv=False)
    ax = (KNOB - elbow).normalized()
    local_lathe(P, KNOB, ax, [(-KNOB_R * math.cos(math.radians(a)), KNOB_R * math.sin(math.radians(a))) for a in range(0, 181, 15)],
                "core", segs=24)
    if gk.HI:
        # knurled ball: little pyramids over it (the bake carries them)
        n = 260
        for i in range(n):
            y = 1 - 2 * (i + 0.5) / n
            r_ = math.sqrt(max(0.0, 1 - y * y))
            th = i * math.pi * (3 - math.sqrt(5))
            d = Vector((math.cos(th) * r_, y, math.sin(th) * r_))
            if d.dot(ax) < -0.55:
                continue
            local_lathe(P, KNOB + d * (KNOB_R - 0.0002), d, [(0.0, 0.0008), (0.0006, 0.0)], "core", segs=4, spin=th)
    # the shroud: a black cylinder behind the root, a slot across its end
    # and the red cocking indicator in it (BO2's first-person view)
    lathe(P, [(-0.008, 0.0), (-0.008, 0.0090), (-0.011, 0.0112), (-0.044, 0.0112), (-0.048, 0.0106), (-0.048, 0.0)], "core", segs=32)
    rrect_cut(P, (0, 0.0, -0.008), ZV, UP, 0.024, 0.0050, 0.001, 0.010, "dark")
    chamfer_box(P, (0, -0.0060, -0.010), (0.0030, 0.0050, 0.008), 0.0006, "red")
    chamfer_box(P, (0, 0.0124, -0.028), (0.006, 0.003, 0.016), 0.0010, "core")
    return fin(P)


def round_():
    # one .338 round in the open action, its case head at the raked bolt face
    P = Part(PFX + "_Round", pivot=(0, 0, ROUND_HEAD))
    P.extras["tf_round"] = 1
    h = ROUND_HEAD
    lathe(P, [(h, 0.0), (h, 0.0068), (h - 0.0015, 0.0068), (h - 0.0020, 0.0060), (h - 0.0035, 0.0060), (h - 0.0045, 0.0074),
              (h - 0.054, 0.0071), (h - 0.060, 0.0047), (h - 0.0695, 0.0047), (h - 0.0695, 0.0)], "brass", segs=28)
    lathe(P, [(h - 0.0695, 0.0), (h - 0.0695, 0.0043), (h - 0.078, 0.0043), (h - 0.086, 0.0031), (h - 0.091, 0.0013),
              (h - 0.093, 0.0)], "bullet", segs=28)
    local_lathe(P, (0, 0, h), (0, 0, 1), [(-0.0003, 0.0022), (0.0002, 0.0022), (0.0003, 0.0)], "brass", segs=14)
    return P.finish(smooth_angle=50, bevel=0.0)


def scope():
    # BO2's tan scope, its black cantilever mount and spirit level, one node
    # (hidden together under another optic): eyepiece with a black focus
    # ring, the tube, a turret saddle (a tall tan-capped elevation turret,
    # two black drums on the right with white ticks), the objective bell
    P = Part(PFX + "_Scope")
    e, o = SCOPE_Z
    lathe(P, [(e, 0.0), (e, 0.0172), (e - 0.003, 0.0195), (e - 0.040, 0.0195), (e - 0.050, 0.0150),
              (-0.205, 0.0150), (-0.275, 0.0262), (o + 0.004, 0.0262), (o, 0.0250), (o, 0.0)], "scope", segs=48, cy=SCOPE_Y)
    lathe(P, [(e - 0.012, 0.0), (e - 0.012, 0.0201), (e - 0.024, 0.0201), (e - 0.024, 0.0)], "core", segs=48, cy=SCOPE_Y)
    for k in range(10):
        z = e - 0.0135 - 0.0011 * k
        lathe(P, [(z, 0.0), (z, 0.0206), (z - 0.0005, 0.0206), (z - 0.0005, 0.0)], "core", segs=48, cy=SCOPE_Y)
    lathe(P, [(e - 0.058, 0.0), (e - 0.058, 0.0158), (e - 0.070, 0.0158), (e - 0.070, 0.0)], "core", segs=48, cy=SCOPE_Y)
    lathe(P, [(o + 0.010, 0.0), (o + 0.010, 0.0266), (o, 0.0266), (o, 0.0)], "core", segs=48, cy=SCOPE_Y)
    hole(P, (0, SCOPE_Y, o), (0, 0, -1), 0.0205, 0.012, "glass", segs=24)
    hole(P, (0, SCOPE_Y, e), (0, 0, 1), 0.0140, 0.006, "glass", segs=24)
    # the saddle and turrets
    chamfer_box(P, (0, SCOPE_Y, TURRET_Z), (0.034, 0.032, 0.046), 0.006, "scope")
    drum(P, (0, SCOPE_Y + 0.016, TURRET_Z), UP, 0.0115, 0.010, "core", ticks=0)
    drum(P, (0, SCOPE_Y + 0.026, TURRET_Z), UP, 0.0128, 0.012, "scope", ribs=36, ticks=24)
    drum(P, (0.017, SCOPE_Y, TURRET_Z + 0.012), R, 0.0135, 0.016, "core", ticks=24)
    drum(P, (0.017, SCOPE_Y, TURRET_Z - 0.019), R, 0.0135, 0.016, "core", ticks=24)
    drum(P, (-0.017, SCOPE_Y, TURRET_Z), L, 0.0095, 0.008, "core", ticks=0)
    # the mount: two rings on blocks on the rail, the front one a cantilever
    # plate with lightening holes; the level on its right
    for z in RING_Z:
        chamfer_box(P, (0, RAIL_TOP + 0.005, z), (0.032, 0.010, 0.016), 0.0025, "core")
        chamfer_box(P, (0, (RAIL_TOP + SCOPE_Y) / 2, z), (0.016, SCOPE_Y - RAIL_TOP, 0.012), 0.002, "core")
        lathe(P, [(z + 0.007, 0.0), (z + 0.007, 0.0186), (z - 0.007, 0.0186), (z - 0.007, 0.0)], "core", segs=40, cy=SCOPE_Y)
        chamfer_box(P, (0, SCOPE_Y + 0.019, z), (0.026, 0.006, 0.014), 0.002, "core")
        for sx in (-1, 1):
            screw(P, (sx * 0.010, SCOPE_Y + 0.022, z), UP, 0.0018)
            screw(P, (0.016 * sx, RAIL_TOP + 0.005, z), Vector((sx, 0, 0)), 0.0022)
    zf = RING_Z[1]
    chamfer_box(P, (0.0175, (RAIL_TOP + SCOPE_Y) / 2 + 0.004, zf - 0.004), (0.004, SCOPE_Y - RAIL_TOP + 0.020, 0.040), 0.0015, "core")
    for dy, dz in ((0.008, -0.012), (0.008, 0.004), (-0.006, -0.004), (0.022, -0.004)):
        hole(P, (0.0195, (RAIL_TOP + SCOPE_Y) / 2 + dy, zf + dz), R, 0.0040, 0.008, "dark", segs=12)
    chamfer_box(P, (0.024, RAIL_TOP + 0.012, zf - 0.006), (0.010, 0.009, 0.026), 0.0015, "core")
    lathe(P, [(zf + 0.004, 0.0), (zf + 0.004, 0.0030), (zf - 0.016, 0.0030), (zf - 0.016, 0.0)], "green", segs=14, cx=0.0295, cy=RAIL_TOP + 0.013)
    return fin(P)


def parts():
    rail()
    bolt()
    round_()
    scope()
    # trigger: black, a curved blade about its pin
    P = moving(PFX, "Trigger", tuple(TRIG), "hinge", "x", -0.28)
    sweep(P, catmull([TRIG, TRIG + Vector((0, -0.011, -0.003)), TRIG + Vector((0, -0.020, -0.002)), TRIG + Vector((0, -0.027, 0.004))], 10),
          lambda s: 0.0028 - 0.0006 * s, "core", sides=10, uv=False)
    fin(P)
    # magazine: dark, straight, two recessed panels a side split by a rib, a flat plate
    P = moving(PFX, "Mag", (0, MAG_TOP - 0.006, (MAG_Z[0] + MAG_Z[1]) / 2), "slide", "y", 0.0)
    mz0, mz1 = MAG_Z
    section_body(P, [(mz0, MAG_TOP), (mz1, MAG_TOP), (mz1, MAG_BOT + 0.008), (mz1 - 0.002, MAG_BOT + 0.007),
                     (mz1 - 0.002, MAG_BOT), (mz0 + 0.002, MAG_BOT), (mz0 + 0.002, MAG_BOT + 0.007), (mz0, MAG_BOT + 0.008)],
                 [dict(axis="v", y=(MAG_TOP - 0.001, MAG_BOT + 0.0075), key="magm", hw=HW_MAG, c=0.003),
                  dict(axis="v", y=(MAG_BOT + 0.0075, MAG_BOT + 0.0005), key="magm", hw=HW_MAG + 0.0015, c=0.003)])
    for n in (R, L):
        x = n.x * HW_MAG
        for y in (-0.090, -0.133):
            rrect_cut(P, (x, y, (mz0 + mz1) / 2), n, ZV, 0.094, 0.036, 0.004, 0.0016, "magm")
    fin(P)
    # the bipod's legs, folded forward under the barrel (BO2's: never deployed)
    for side, name in ((-1, "BipodL"), (1, "BipodR")):
        x, y = side * 0.0115, HG_STEP - 0.012
        P = moving(PFX, name, (x, y, BIPOD_Z[0]), "hinge", "x", 1.5)
        lathe(P, [(BIPOD_Z[0] - 0.012, 0.0), (BIPOD_Z[0] - 0.012, 0.0055), (-0.620, 0.0055), (-0.623, 0.0045),
                  (BIPOD_Z[1] + 0.034, 0.0045), (BIPOD_Z[1] + 0.034, 0.0)], "core", segs=16, cx=x, cy=y)
        for k in range(6):
            z = -0.632 - 0.006 * k
            lathe(P, [(z, 0.0), (z, 0.0048), (z - 0.0025, 0.0048), (z - 0.0025, 0.0)], "steel", segs=16, cx=x, cy=y)
        lathe(P, [(BIPOD_Z[1] + 0.034, 0.0), (BIPOD_Z[1] + 0.034, 0.0060), (BIPOD_Z[1] + 0.004, 0.0062), (BIPOD_Z[1], 0.0045),
                  (BIPOD_Z[1], 0.0)], "rubber", segs=16, cx=x, cy=y)
        fin(P)


def points():
    # the grip hand at its anchor (the rig is fitted to it); the support on
    # the handguard's top (buildDetailed drops it 0.05 to the belly); the
    # aim on the scope's axis; another optic sits on the rail over the receiver
    for name, p in (("Grip", (0, -0.100, 0.020)), ("Support", (0, HG_TOP, -0.410)), ("Muzzle", (0, 0, MUZZLE_Z)),
                    ("Aim", (0, SCOPE_Y, TURRET_Z)), ("Under", (0, HG_STEP - 0.0105, -0.460)), ("Rail", (0, RAIL_TOP, -0.100)),
                    ("Eject", (0.024, 0.006, -0.130)), ("BoltKnob", tuple(KNOB))):
        empty(PFX + "_" + name, p)


def recipe():
    body()
    brake()
    parts()
    points()


VIEWS = {
    "side": ((1.85, 0.02, -0.29), (0, -0.01, -0.29), 50),          # the true right side, muzzle right on screen
    "q34": ((1.05, 0.30, 0.55), (0, -0.02, -0.25), 45),             # the sheet's lower-right panel, mirrored to the right side
    "port": ((0.30, 0.10, 0.08), (0.01, 0.010, -0.090), 45),        # the sheet's receiver close-up
    "fp": ((0.10, 0.12, 0.42), (0.0, 0.03, -0.25), 40),             # BO2's first-person angle
    "stock": ((0.60, 0.10, 0.55), (0, -0.04, 0.18), 45),
    "left": ((-1.6, 0.25, -0.15), (0, -0.01, -0.29), 50),
}

if BAKE:
    render = {"dir": os.environ.get("HB_RENDER_DIR", os.path.join(HERE, "_renders")), "views": VIEWS} if "render" in ARGS else None
    # first person carries the detail (2048 maps); everyone else sees the
    # LOD1 at the third-person budget (~6k tris, 256 px): the user's rule
    bake_kit.bake_gun(recipe, "ballista", PFX, HERE, render=render, res=2048, margin_px=6, lod_ratio=0.04, lod_weld=1e-5)
else:
    gk.HI = "hi" in ARGS
    recipe()
    gk.export(os.path.join(os.environ.get("HB_OUT", HERE), "ballista.glb"), PFX)
    if "render" in ARGS:
        gk.render_views(os.environ.get("HB_RENDER_DIR", os.path.join(HERE, "_renders")), VIEWS, PFX)
