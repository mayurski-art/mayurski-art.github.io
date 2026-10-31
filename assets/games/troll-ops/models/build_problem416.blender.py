"""
The Problem 416 (DESIGN-ARSENAL.md Phase 1 step 5, the AR recipe every
later rifle copies): an HK416-proportioned carbine on gunkit v2, built to
the user's concept renders (refs/arms/problem416/: concept-3 for the gun
as a whole, concept-2 for the receiver close up, concept-1 for the stock's
window and the mag's cells). The renders are mirrored (their port shows
with the muzzle to the left, which a real AR only does from its left
side); the game's port stays on the right, so every feature is matched
front to back, not left to right.

OD cerakote shell chipped through to bare aluminium (upper, lower,
handguard, rails, irons, stock, grip), a black core (buffer tube, castle
nut, hider, barrel collar, controls, pad), a parkerized bolt carrier in a
big open port, a black PMAG with recessed cells. The anchors are the old
hand-built 416's (weapon-416.js): grip, support, rail, aim, so the hands
and sights land where they always have.

    python build_problem416.blender.py --                 # (pip bpy) or blender --background --python ...
    ... -- bake                                           # bake_kit.bake_gun: problem416.glb, maps, LOD1
    ... -- bake render                                    # + check renders (PF_RENDER_DIR)

Game coordinates: x right, y up, -z toward the muzzle, metres; the bore on
y BORE, the grip near z 0.02.

Recipe layout, one function per assembly so the next AR (Snubgrin M4, M27)
can copy it and change numbers: upper(), lower(), handguard(), rails(),
barrel(), stock(), grip(), then the moving parts and the points.
"""
import math
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gunkit as gk
import bmesh                                # (after bpy, which gunkit loads)
import bpy
from gunkit import (Part, lathe, sweep, catmull, empty, section_body, chamfer_box, local_lathe,
                    stipple, moving, Vector)

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
BAKE = "bake" in ARGS
PFX = "PF"
OD = 0x4a4b38            # the renders' olive: greyer and darker than army green
WORN = 0x8d9094          # the bare aluminium the renders show where the paint is chipped

if BAKE:
    import bake_kit
    K = bake_kit.kit_material
    gk.M.update({
        "recv":   K("PF_Upper", "cerakote", OD, WORN, Wear=1.0, Patches=0.6),
        "lower":  K("PF_Lower", "cerakote", OD, WORN, Wear=1.0, Patches=0.6),
        "guard":  K("PF_Guard", "cerakote", OD, WORN, Wear=1.0, Patches=0.45),
        "stock":  K("PF_Stock", "polymer", OD, 0x6d7166, Wear=0.9, Patches=0.35, Roughness=0.7),
        "gripm":  K("PF_Grip", "polymer", OD, 0x6d7166, Wear=0.6, Patches=0.15, Roughness=0.75),
        "core":   K("PF_Core", "anodized", 0x1a1b1d),
        "magm":   K("PF_MagBody", "polymer", 0x1e1e1e, Wear=0.6),
        "rubber": K("PF_Pad", "rubber"),
        "steel":  K("PF_Steel", "parkerized", 0x252627),
        "dark":   K("PF_Dark", "parkerized", 0x0e0e0e, Wear=0.0, Metallic=0.0, Roughness=0.85),   # bores, sockets: matte
    })
else:
    gk.M.update({
        "recv": gk.material("PF_Upper", OD, 0.6), "lower": gk.material("PF_Lower", OD, 0.6),
        "guard": gk.material("PF_Guard", OD, 0.6), "stock": gk.material("PF_Stock", OD, 0.7),
        "gripm": gk.material("PF_Grip", OD, 0.75),
        "core": gk.material("PF_Core", 0x1a1b1d, 0.42, 0.35), "magm": gk.material("PF_MagBody", 0x1e1e1e, 0.8),
        "rubber": gk.material("PF_Pad", 0x151515, 0.9), "steel": gk.material("PF_Steel", 0x252627, 0.55, 0.6),
        "dark": gk.material("PF_Dark", 0x0e0e0e, 0.85),
    })

R, L = Vector((1, 0, 0)), Vector((-1, 0, 0))
ZV = Vector((0, 0, 1))
BORE = 0.008
# half-widths: the receiver steps in at the split line so it reads
HW_UP, HW_LO, HW_HG, HW_GRIP, HW_STOCK, HW_MAG = 0.0135, 0.0125, 0.0205, 0.0145, 0.0180, 0.0110
RAIL_Y, RAIL_TOP = 0.025, 0.035          # rail base and the teeth's tops (the old 416's topY)
UP_Z = (0.074, -0.128)                   # upper receiver, rear to front
SPLIT_F, SPLIT_R, SPLIT_STEP = -0.006, -0.013, -0.032   # the split line: front, rear, where it steps
HG_Z = (-0.134, -0.436)                  # handguard (its black nose ring to -0.440)
HG_BOT = -0.020
# the port, big as in concept-2: most of the upper's height, from just
# behind the handguard to the forward assist
PORT = dict(z=-0.061, y=0.0085, len=0.088, h=0.021, depth=0.009)
HIDER_Z, MUZZLE_Z = -0.452, -0.505       # barrel collar end, hider tip
AIM_Y = 0.059
FRONT_Z = -0.424                         # the front sight, on the rail's nose


# ------------------------------------------------------------------ helpers

def box_outline(z, y0, y1):
    """A rectangular side outline a hair longer than the region it feeds
    (section_body samples the region's ends, which must fall inside)."""
    a, b = max(z) + 0.002, min(z) - 0.002
    return [(a, y0), (a, y1), (b, y1), (b, y0)]


def rrect_cut(P, center, normal, along, w, h, r, depth, key, n=3):
    """A rounded-rectangle pocket cut into a face (w along `along`, h
    across), its floor and walls in `key`: recessed panels, M-LOK slots,
    mag cells, rib grooves, the trigger opening (depth through)."""
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


def pin(P, center, normal, r=0.003, proud=0.0008, key="core"):
    """A pin or bolt head standing proud of a face."""
    local_lathe(P, center, normal, [(-0.0005, r), (proud * 0.6, r), (proud, r * 0.8), (proud, 0.0)], key, segs=14)


def screw(P, center, normal, r=0.0026, key="core"):
    """A socket-head screw: a domed head with its hex sunk in."""
    local_lathe(P, center, normal, [(-0.0005, r), (0.0006, r), (0.0011, r * 0.82), (0.0013, 0.0)], key, segs=14)
    hole(P, Vector(center) + Vector(normal).normalized() * 0.0013, normal, r * 0.45, 0.0009, "dark", segs=6)


def picatinny(P, surface, out, across, z0, z1, key="guard", hw=0.0106, base=0.0035, tooth=0.0035, pitch=0.010):
    """A MIL-STD-1913 rail along z on a face: a dovetailed spine and square
    teeth, 5.2 mm long every 10 mm, their tops chamfered (concept-2)."""
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


def engrave(P, lines, origin, normal, along, size, depth=0.0004):
    """Roll-mark text cut into a face (high pass only: the bake carries
    it). lines: [(text, dy)]; origin is the first line's start, the text
    runs along `along` and reads from outside."""
    if not gk.HI:
        return
    nv, a = Vector(normal).normalized(), Vector(along).normalized()
    up = nv.cross(a).normalized()
    for text, dy in lines:
        cu = bpy.data.curves.new("engr", "FONT")
        cu.body = text
        cu.size = size
        cu.extrude = 0.0012
        ob = bpy.data.objects.new("engr", cu)
        bpy.context.scene.collection.objects.link(ob)
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        bm = bmesh.new()
        bm.from_mesh(me)
        o = Vector(origin) + up * dy
        for v in bm.verts:
            x, y, zz = v.co
            v.co = o + a * x + up * y + nv * (zz + 0.0012 - depth)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        P.cutters.append((bm, "dark"))
        bpy.data.objects.remove(ob)
        bpy.data.curves.remove(cu)
        bpy.data.meshes.remove(me)


def fillet(pts, n=5):
    """A closed outline [(z, y, r)] with each corner rounded by its own
    radius r (0 keeps it sharp): the straight runs meet in arcs, as they do
    on a moulded stock and grip (rule 10: square only where the real part is)."""
    out, m = [], len(pts)
    for i in range(m):
        z, y, r = pts[i]
        if r <= 0:
            out.append((z, y))
            continue
        b = Vector((z, y, 0))
        a = Vector((pts[i - 1][0], pts[i - 1][1], 0))
        c = Vector((pts[(i + 1) % m][0], pts[(i + 1) % m][1], 0))
        u1, u2 = a - b, c - b
        l1, l2 = u1.length, u2.length
        u1.normalize()
        u2.normalize()
        th = math.acos(max(-1.0, min(1.0, u1.dot(u2))))
        if th < 1e-3 or th > math.pi - 1e-3:
            out.append((z, y))
            continue
        d = min(r / math.tan(th / 2), 0.45 * l1, 0.45 * l2)
        re = d * math.tan(th / 2)
        p1, p2 = b + u1 * d, b + u2 * d
        cen = b + (u1 + u2).normalized() * (re / math.sin(th / 2))
        a1 = math.atan2(p1.y - cen.y, p1.x - cen.x)
        a2 = math.atan2(p2.y - cen.y, p2.x - cen.x)
        da = (a2 - a1 + math.pi) % gk.TAU - math.pi          # the short way round
        for k in range(n + 1):
            t = a1 + da * k / n
            out.append((cen.x + re * math.cos(t), cen.y + re * math.sin(t)))
    return out


def round_v(P, outline, y0, y1, hw, key, r=0.9, step=0.003, n=4, zwin=None):
    """section_body's down-the-gun loft with rounded sections (the grip,
    the mag): each row a rounded rectangle, its corner radius r of the
    smaller half-size (0.9 is nearly an oval); hw may be a function of t 0..1."""
    k_n = max(2, int(abs(y1 - y0) / step) + 1)
    secs = []
    for k in range(k_n):
        t = k / (k_n - 1)
        y = y0 + (y1 - y0) * t
        sp = gk.span(outline, 1, y, zwin)
        if not sp:
            continue
        w = hw(t) if callable(hw) else hw
        hz = (sp[1] - sp[0]) / 2
        secs.append(gk.rrect_xz(y, (sp[0] + sp[1]) / 2, hz, w, min(w, hz) * r, n))
    gk.loft(P, secs, key)


def round_z(P, outline, z0, z1, hw, key, r=0.006, step=0.003, n=4, ywin=None):
    """The across-the-gun loft with rounded-rectangle sections (the stock's
    housing, leg and butt): rounded edges where section_body has chamfers."""
    k_n = max(2, int(abs(z1 - z0) / step) + 1)
    secs = []
    for k in range(k_n):
        t = k / (k_n - 1)
        z = z0 + (z1 - z0) * t
        sp = gk.span(outline, 0, z, ywin)
        if not sp:
            continue
        w = hw(t) if callable(hw) else hw
        secs.append(gk.rrect(z, w, sp[1], sp[0], r, n))
    gk.loft(P, secs, key)


def fin(P):
    """Rounded edges on the game mesh too (the light catches every chamfer),
    a finer bevel on the bake's high pass. Sharp outer miters: gunkit's arc
    miters throw vertices off to infinity on some corners (lathe caps, cut
    floors). The cut-outs go in as one exact boolean, which now and then
    throws a whole region of a big part away: the part's extents before and
    after are compared and the build stops if any side moved more than 4 mm."""
    pre = [v.co.copy() for v in P.bm.verts]
    lo = [min(p[i] for p in pre) for i in range(3)] if pre else None
    hi = [max(p[i] for p in pre) for i in range(3)] if pre else None
    ob = P.finish(smooth_angle=34, bevel=0.0007 if gk.HI else 0.0006, bevel_segs=3 if gk.HI else 2)
    bv = ob.modifiers.get("bevel")
    if bv:
        bv.miter_outer = "MITER_SHARP"
        bv.use_clamp_overlap = True
    if lo:
        g = [(v.co + ob.location) for v in ob.data.vertices]       # (matrix_world can be stale here)
        g = [(p.x, p.z, -p.y) for p in g]                      # Blender z-up -> game y-up
        lo2 = [min(p[i] for p in g) for i in range(3)]
        hi2 = [max(p[i] for p in g) for i in range(3)]
        off = max(max(abs(a - b) for a, b in zip(lo, lo2)), max(abs(a - b) for a, b in zip(hi, hi2)))
        if off > 0.004:
            raise RuntimeError(f"{ob.name}: the cut-outs dropped geometry ({off * 1000:.1f} mm off its extents "
                               f"{[round(x, 3) for x in lo]}..{[round(x, 3) for x in hi]})")
    return ob


# ------------------------------------------------------------------ the body

def upper(P):
    # flat-topped, 45-degree chamfers; its skirt drops at the rear (the
    # stepped split line in concept-2), a raised band along each top edge
    section_body(P, [(UP_Z[0] + 0.002, SPLIT_R), (UP_Z[0] + 0.002, RAIL_Y), (UP_Z[1] - 0.002, RAIL_Y),
                     (UP_Z[1] - 0.002, SPLIT_F), (SPLIT_STEP - 0.004, SPLIT_F), (SPLIT_STEP + 0.004, SPLIT_R)],
                 [dict(z=UP_Z, key="recv", hw=HW_UP, c=0.003, top=RAIL_Y, step=0.004)])
    for n in (R, L):
        chamfer_box(P, (n.x * (HW_UP + 0.0005), 0.0215, -0.027), (0.0022, 0.006, 0.196), 0.0008, "recv")
    # the port: a chamfered surround, then the opening down to the carrier
    rrect_cut(P, (HW_UP, PORT["y"], PORT["z"]), R, ZV, PORT["len"] + 0.004, PORT["h"] + 0.004, 0.004, 0.0012, "recv")
    rrect_cut(P, (HW_UP - 0.0012, PORT["y"], PORT["z"]), R, ZV, PORT["len"], PORT["h"], 0.0025, PORT["depth"], "core")
    # the dust cover, hanging open under the port (concept-2's ledge)
    chamfer_box(P, (HW_UP + 0.0012, PORT["y"] - PORT["h"] / 2 - 0.0045, PORT["z"] + 0.001),
                (0.0013, 0.0075, PORT["len"] - 0.004), 0.0004, "recv")
    local_lathe(P, (HW_UP + 0.0006, PORT["y"] - PORT["h"] / 2 - 0.0008, PORT["z"] - PORT["len"] / 2 + 0.002), ZV,
                [(0, 0.0012), (PORT["len"] - 0.004, 0.0012), (PORT["len"] - 0.003, 0.0)], "steel", segs=8)
    # forward assist: a teardrop housing over the split behind the port, the
    # plunger, its hex head and the tab (concept-2)
    fa = Vector((HW_UP, -0.004, 0.019))
    chamfer_box(P, (fa.x + 0.0025, fa.y + 0.006, fa.z), (0.006, 0.010, 0.026), 0.0025, "recv")
    local_lathe(P, (fa.x, fa.y, fa.z), R, [(-0.001, 0.0105), (0.0045, 0.0105), (0.0055, 0.0095), (0.0055, 0.0)], "recv", segs=24)
    local_lathe(P, (fa.x + 0.0055, fa.y, fa.z), R, [(-0.0005, 0.0065), (0.0045, 0.0065), (0.0055, 0.0058), (0.006, 0.0)], "core", segs=24)
    local_lathe(P, (fa.x + 0.0112, fa.y, fa.z), R, [(-0.0005, 0.0036), (0.0026, 0.0036), (0.003, 0.0)], "steel", segs=6, spin=0.26)
    chamfer_box(P, (fa.x + 0.0085, fa.y + 0.001, fa.z + 0.0085), (0.0045, 0.006, 0.0065), 0.0012, "core")
    screw(P, (fa.x + 0.0035, fa.y + 0.0122, fa.z - 0.0005), R, 0.0018)
    # brass deflector, between the port and the forward assist
    chamfer_box(P, (HW_UP + 0.0028, 0.0145, -0.0115), (0.0056, 0.011, 0.0085), 0.0024, "recv")
    # the upper's own screws
    for n in (R, L):
        screw(P, (n.x * HW_UP, 0.0185, -0.122), n, 0.0019)
        screw(P, (n.x * HW_UP, 0.0185, 0.066), n, 0.0019)
    # the barrel nut: a black band between the upper and the handguard
    lathe(P, [(UP_Z[1] + 0.001, 0.0), (UP_Z[1] + 0.001, 0.0168), (HG_Z[0] - 0.001, 0.0168), (HG_Z[0] - 0.001, 0.0)], "core", segs=40, cy=0.004)


def lower(P):
    # one outline: the stepped top under the upper's skirt, the flared mag
    # well, the trigger guard (an opening cut through, as in concept-2),
    # the grip's seat and the slope down from the buffer tube; forged, so
    # the guard and the tang sweep in curves (concept-2), the top stays square
    section_body(P, fillet([(0.076, SPLIT_R - 0.0002, 0.0), (0.076, -0.024, 0.005), (0.064, -0.034, 0.010), (0.040, -0.040, 0.008),
                            (0.010, -0.040, 0.004), (0.006, -0.0575, 0.006), (-0.038, -0.0575, 0.005), (-0.044, -0.064, 0.003),
                            (-0.120, -0.064, 0.002), (-0.128, -0.022, 0.003),
                            (-0.127, SPLIT_F - 0.0002, 0.0), (SPLIT_STEP - 0.004, SPLIT_F - 0.0002, 0.0), (SPLIT_STEP + 0.004, SPLIT_R - 0.0002, 0.0)]),
                 [dict(z=(0.074, -0.126), key="lower", hw=HW_LO, c=0.002, step=0.003)])   # (step 0.002 unsmoothed left a sliver that wrecked the bake atlas)
    rrect_cut(P, (0.03, -0.045, -0.021), R, ZV, 0.040, 0.0155, 0.0072, 0.06, "lower")
    # the well's flared mouth and the raised lip along the top of the lower
    chamfer_box(P, (0, -0.0605, -0.082), (2 * HW_LO + 0.0035, 0.008, 0.0795), 0.0018, "lower")
    for n in (R, L):
        x = n.x * HW_LO
        chamfer_box(P, (n.x * (HW_LO + 0.0004), SPLIT_F - 0.003, -0.077), (0.0016, 0.0045, 0.096), 0.0006, "lower")
        # the well's sunk side panel, the fence strip in front of it, pins
        rrect_cut(P, (x, -0.040, -0.103), n, ZV, 0.030, 0.034, 0.003, 0.0008, "lower")
        chamfer_box(P, (n.x * (HW_LO + 0.0006), -0.036, -0.0765), (0.0016, 0.044, 0.014), 0.0006, "lower")
        rrect_cut(P, (x, -0.020, 0.024), n, ZV, 0.040, 0.010, 0.003, 0.0010, "lower")
        pin(P, (x, -0.013, -0.119), n, 0.0034, 0.001)        # pivot pin
        pin(P, (x, -0.026, 0.045), n, 0.0034, 0.001)         # takedown pin
        pin(P, (x, -0.0315, -0.024), n, 0.0022, 0.0007)      # trigger pin
        pin(P, (x, -0.0315, -0.004), n, 0.0022, 0.0007)      # hammer pin
        pin(P, (x, -0.024, 0.012), n, 0.0016, 0.0005)        # selector detent
    # beavertail over the grip, its tail curling down
    round_z(P, fillet([(0.036, -0.0365, 0.0), (0.067, -0.0365, 0.004), (0.065, -0.0425, 0.003), (0.036, -0.0425, 0.0)]),
            0.0365, 0.0665, 0.011, "lower", r=0.0025, step=0.0025)
    # selector on auto, both sides: a hub and its lever toward the stock
    for n in (R, L):
        local_lathe(P, (n.x * HW_LO, -0.033, 0.024), n, [(0, 0.0058), (0.0018, 0.0058), (0.0024, 0.005), (0.0024, 0.0)], "core", segs=20)
        chamfer_box(P, (n.x * (HW_LO + 0.0028), -0.0335, 0.0335), (0.0024, 0.0050, 0.019), 0.001, "core")
        chamfer_box(P, (n.x * (HW_LO + 0.0007), -0.0275, 0.012), (0.0014, 0.0022, 0.0045), 0.0005, "core")
    # right: the bolt release paddle under the port, the horizontal mag
    # release lever across the fence
    chamfer_box(P, (HW_LO + 0.0018, -0.0165, -0.052), (0.0026, 0.019, 0.0068), 0.0011, "core")
    for k in range(4):
        chamfer_box(P, (HW_LO + 0.0034, -0.0095 - 0.0024 * k, -0.052), (0.0010, 0.0010, 0.0066), 0.0003, "core")
    local_lathe(P, (HW_LO + 0.0012, -0.033, -0.050), R, [(-0.0005, 0.0034), (0.0018, 0.0034), (0.0022, 0.0)], "core", segs=14)
    chamfer_box(P, (HW_LO + 0.0024, -0.033, -0.066), (0.0024, 0.0050, 0.034), 0.0011, "core")
    # the roll mark on the well, read from the right (concept-2's HK416 / 7.62)
    engrave(P, [("PROBLEM 416", 0.0), ("5.56mm x 45", -0.0062)], (HW_LO + 0.0004, -0.044, -0.090), R, (0, 0, -1), 0.0052)


def handguard(P):
    # an octagon tube flat on top: two rows of M-LOK slots behind a short
    # side rail at the nose (concept-3), slots on the lower bevels, two
    # screws at the clamp, a black nose ring
    section_body(P, box_outline((HG_Z[0], HG_Z[1] - 0.004), HG_BOT, RAIL_Y),
                 [dict(z=(HG_Z[0], HG_Z[1]), key="guard", hw=HW_HG, c=0.0075, top=RAIL_Y, bot=HG_BOT, step=0.05),
                  dict(z=(HG_Z[1], HG_Z[1] - 0.004), key="core", hw=HW_HG - 0.0015, c=0.009, top=RAIL_Y - 0.001, bot=HG_BOT + 0.001)])
    for n in (R, L):
        for row, y in enumerate((0.0105, -0.0035)):
            for k in range(6):
                z = -0.172 - 0.035 * k - 0.006 * row
                rrect_cut(P, (n.x * HW_HG, y, z), n, ZV, 0.026, 0.0080, 0.0030, 0.007, "core")
        d = Vector((n.x * 0.7071, -0.7071, 0))
        for k in range(5):
            rrect_cut(P, (n.x * (HW_HG - 0.0038), HG_BOT + 0.0038, -0.186 - 0.042 * k), d, ZV, 0.022, 0.0050, 0.0020, 0.005, "core")
        picatinny(P, (n.x * HW_HG, 0.0035, 0.0), n, (0, 1, 0), -0.384, -0.432, hw=0.0090, base=0.0022, tooth=0.0030)
        screw(P, (n.x * HW_HG, 0.0130, -0.146), n)
        screw(P, (n.x * HW_HG, -0.0060, -0.146), n)


def rails():
    # the full-length top rail and the belly rail: their own pass so the
    # teeth stay crisp chamfered blocks
    P = Part(PFX + "_Rails")
    picatinny(P, (0, RAIL_Y - 0.0024, 0), (0, 1, 0), (1, 0, 0), 0.068, HG_Z[1] - 0.002)
    picatinny(P, (0, HG_BOT + 0.0024 - 0.0002, 0), (0, -1, 0), (1, 0, 0), -0.170, HG_Z[1] - 0.004, hw=0.0100)
    return P


def barrel(P):
    lathe(P, [(HG_Z[1] - 0.003, 0.0), (HG_Z[1] - 0.003, 0.0086), (HIDER_Z + 0.004, 0.0084), (HIDER_Z + 0.004, 0.0)], "steel", segs=40, cy=BORE)
    # the collar and crush washer behind the hider
    lathe(P, [(HIDER_Z + 0.004, 0.0), (HIDER_Z + 0.004, 0.0098), (HIDER_Z, 0.0098), (HIDER_Z, 0.0)], "core", segs=40, cy=BORE)


def stock(P):
    # the castle nut and end plate, the buffer tube, then the CTR-style OD
    # stock (concept-3 / -1): a box housing over the tube, a leg down to
    # the toe with the skeleton window between, a tall butt and its black
    # ribbed pad, the QD cup, the side slot, the lock lever
    lathe(P, [(0.074, 0.0), (0.074, 0.0172), (0.082, 0.0172), (0.083, 0.0150), (0.083, 0.0)], "core", segs=40, cy=BORE)
    for k in range(6):
        a = k / 6 * math.tau
        chamfer_box(P, (math.cos(a) * 0.0168, BORE + math.sin(a) * 0.0168, 0.078), (0.003, 0.003, 0.0085), 0.0006, "dark",
                    (Vector((math.cos(a), math.sin(a), 0)), Vector((-math.sin(a), math.cos(a), 0)), ZV))
    lathe(P, [(0.083, 0.0), (0.083, 0.0137), (0.225, 0.0137), (0.225, 0.0)], "core", segs=40, cy=BORE)
    chamfer_box(P, (0, BORE - 0.0185, 0.089), (0.006, 0.010, 0.010), 0.0018, "core")   # the sling loop under the end plate
    # the housing: its nose rounded down onto the tube, the top rising in
    # a curve to the heel, the cheek swelling out mid-length, every edge round
    housing = fillet([(0.101, -0.010, 0.004), (0.101, 0.026, 0.012), (0.175, 0.037, 0.06), (0.272, 0.042, 0.008),
                      (0.272, -0.024, 0.0), (0.180, -0.020, 0.03), (0.130, -0.016, 0.008)])
    round_z(P, housing, 0.1015, 0.2715, lambda t: HW_STOCK * (0.93 + 0.08 * math.sin(math.pi * min(1.0, t * 1.1))),
            "stock", r=0.0075, step=0.003)
    # the leg: from under the housing down to the toe, its belly a long
    # curve, the window's corners round
    leg = fillet([(0.128, -0.012, 0.0), (0.168, -0.014, 0.010), (0.262, -0.042, 0.006), (0.268, -0.046, 0.0),
                  (0.268, -0.091, 0.0), (0.250, -0.092, 0.008), (0.215, -0.076, 0.06), (0.152, -0.025, 0.02),
                  (0.128, -0.016, 0.0)])
    round_z(P, leg, 0.1285, 0.2675, 0.0125, "stock", r=0.0045, step=0.003)
    # the butt upright, its heel and toe rounded
    butt = fillet([(0.256, 0.040, 0.0), (0.277, 0.044, 0.006), (0.277, -0.091, 0.005), (0.252, -0.091, 0.008), (0.256, -0.060, 0.0)])
    round_z(P, butt, 0.2525, 0.2765, 0.0195, "stock", r=0.0055, step=0.003)
    pad = fillet([(0.276, 0.044, 0.0), (0.294, 0.044, 0.007), (0.294, -0.092, 0.007), (0.276, -0.092, 0.0)])
    round_v(P, pad, 0.0435, -0.0915, 0.0210, "rubber", r=0.35, step=0.004)
    for k in range(11):
        y = 0.036 - 0.0122 * k
        rrect_cut(P, (0, y, 0.294), ZV, R, 0.046, 0.0034, 0.0015, 0.002, "rubber")
        for n in (R, L):
            rrect_cut(P, (n.x * 0.021, y, 0.2865), n, ZV, 0.010, 0.0034, 0.0015, 0.0016, "rubber")
    for n in (R, L):
        rrect_cut(P, (n.x * HW_STOCK, 0.025, 0.238), n, ZV, 0.040, 0.0060, 0.0028, 0.003, "core")
        local_lathe(P, (n.x * 0.0195, -0.004, 0.266), n, [(-0.0005, 0.0062), (0.0013, 0.0062), (0.0016, 0.0050), (0.0016, 0.0)], "core", segs=20)
        hole(P, (n.x * (0.0195 + 0.0016), -0.004, 0.266), n, 0.0034, 0.004, "dark", segs=10)
    # two slanted slots through the leg (concept-3)
    for o in (-1, 1):
        rrect_cut(P, (0.0125, -0.043 + o * 0.0076, 0.210 + o * 0.0049), R, Vector((0, -0.54, 0.84)), 0.052, 0.0060, 0.0029, 0.03, "stock")
    chamfer_box(P, (0, -0.0145, 0.125), (0.011, 0.007, 0.034), 0.0022, "core")
    screw(P, (0.0055, -0.0145, 0.112), R, 0.0016)


def grip(P):
    # MOE-style, OD (concept-3): the old 416's rake (the hand rig is fitted
    # to it), moulded round: near-oval sections, the back strap's hump
    # under the beavertail, a finger nub, the heel flaring out; stippled
    # panels sunk in each side, ribs down the back strap
    outline = fillet([(-0.004, -0.038, 0.0), (0.036, -0.038, 0.0), (0.044, -0.056, 0.014), (0.052, -0.104, 0.03),
                      (0.059, -0.124, 0.008), (0.053, -0.134, 0.005), (0.030, -0.136, 0.008), (0.016, -0.131, 0.008),
                      (0.006, -0.097, 0.014), (0.002, -0.084, 0.004), (-0.008, -0.073, 0.006), (-0.003, -0.062, 0.004),
                      (-0.006, -0.048, 0.0)])
    round_v(P, outline, -0.039, -0.1355,
            lambda t: 0.0122 + 0.0026 * min(1.0, t / 0.2) ** 0.5 + 0.0010 * max(0.0, (t - 0.86) / 0.14) ** 2,
            "gripm", r=0.7, step=0.0025, n=5)
    v = Vector((0, 0.976, -0.218))
    for n in (R, L):
        rrect_cut(P, (n.x * HW_GRIP, -0.092, 0.028), n, v, 0.066, 0.022, 0.005, 0.0009, "gripm")
    # the ribs follow the back strap's curve
    for k in range(7):
        y = -0.064 - 0.008 * k
        z0, z1 = gk.span(outline, 1, y + 0.001)[1], gk.span(outline, 1, y - 0.001)[1]
        back = Vector((0, (z1 - z0) / 0.002, 1)).normalized()
        rrect_cut(P, (0, y, (z0 + z1) / 2), back, R, 0.016, 0.0028, 0.0012, 0.0012, "gripm")
    stipple(P, (HW_GRIP - 0.0008, -0.121, 0.040), (0, 0, -1), v, 0.020, 0.058, "gripm")
    stipple(P, (-HW_GRIP + 0.0008, -0.121, 0.020), (0, 0, 1), v, 0.020, 0.058, "gripm")


def body():
    P = Part(PFX + "_Body")
    upper(P)
    lower(P)
    handguard(P)
    barrel(P)
    stock(P)
    grip(P)
    return fin(P)


def hider():
    # a big black slotted hider (concept-1/-3), open at the front; its own
    # node so a muzzle attachment can take its place
    P = Part(PFX + "_Hider")
    lathe(P, [(HIDER_Z, 0.0), (HIDER_Z, 0.0112), (HIDER_Z - 0.004, 0.0122),
              (MUZZLE_Z + 0.0035, 0.0122), (MUZZLE_Z, 0.0112), (MUZZLE_Z, 0.0)], "core", segs=40, cy=BORE)
    for deg in (-60, -15, 30, 75, 120, 165, 210):
        a = math.radians(deg)
        n = Vector((math.cos(a), math.sin(a), 0))
        rrect_cut(P, (n.x * 0.0122, BORE + n.y * 0.0122, MUZZLE_Z + 0.020), n, ZV, 0.032, 0.0036, 0.0017, 0.0055, "dark")
    hole(P, (0, BORE, MUZZLE_Z), (0, 0, -1), 0.0078, 0.034, "dark", segs=12)
    return fin(P)


def irons():
    # MBUS-style flip-ups, front and rear, standing (concept-1/-3), one node
    # (hidden together under an optic; one draw): the rear's aperture and
    # the front post's tip on y AIM_Y; the rear on the upper, the front on
    # the rail's nose; windage and elevation knobs on the right
    P = Part(PFX + "_IronRear")
    base = RAIL_TOP + 0.004
    chamfer_box(P, (0, base, 0.050), (0.026, 0.008, 0.030), 0.002, "guard")
    screw(P, (0.013, base, 0.057), R, 0.0018)
    chamfer_box(P, (0, base + 0.0055, 0.044), (0.021, 0.006, 0.010), 0.0018, "guard")
    for sx in (-1, 1):
        chamfer_box(P, (sx * 0.0088, 0.0535, 0.044), (0.0042, 0.023, 0.012), 0.0014, "guard")
    chamfer_box(P, (0, 0.048, 0.044), (0.010, 0.012, 0.0045), 0.0012, "guard")
    chamfer_box(P, (0, AIM_Y, 0.044), (0.0135, 0.012, 0.0045), 0.0012, "core")
    hole(P, (0, AIM_Y, 0.044 + 0.0023), (0, 0, 1), 0.0022, 0.012, "dark", segs=10)
    local_lathe(P, (0.0109, 0.050, 0.044), R, [(0, 0.0042), (0.0028, 0.0042), (0.0034, 0.0)], "core", segs=14)
    chamfer_box(P, (0, base, FRONT_Z), (0.026, 0.008, 0.026), 0.002, "guard")
    screw(P, (0.013, base, FRONT_Z + 0.007), R, 0.0018)
    for sx in (-1, 1):
        chamfer_box(P, (sx * 0.0088, 0.0515, FRONT_Z), (0.0042, 0.024, 0.012), 0.0014, "guard")
    chamfer_box(P, (0, 0.0455, FRONT_Z), (0.012, 0.008, 0.008), 0.0015, "guard")
    chamfer_box(P, (0, 0.0515, FRONT_Z), (0.0028, 0.015, 0.0028), 0.0006, "steel")
    local_lathe(P, (0.0109, 0.046, FRONT_Z), R, [(0, 0.0040), (0.0028, 0.0040), (0.0034, 0.0)], "core", segs=14)
    return fin(P)


def parts():
    # carrier: the bolt (rings, cam pin, extractor) and the carrier in the
    # big port, back on each shot
    P = moving(PFX, "Carrier", (0.002, PORT["y"], PORT["z"]), "slide", "z", 0.040)
    cy, cx = PORT["y"], 0.002
    lathe(P, [(0.060, 0.0), (0.060, 0.0088), (-0.030, 0.0088), (-0.032, 0.0080), (-0.036, 0.0080), (-0.038, 0.0088),
              (-0.074, 0.0088), (-0.076, 0.0068), (-0.090, 0.0068), (-0.091, 0.0060), (-0.093, 0.0068), (-0.096, 0.0068),
              (-0.097, 0.0060), (-0.099, 0.0068), (-0.110, 0.0066), (-0.111, 0.0)], "steel", segs=36, cx=cx, cy=cy)
    chamfer_box(P, (cx + 0.0095, cy + 0.003, -0.081), (0.004, 0.0055, 0.006), 0.0009, "steel")          # cam pin
    chamfer_box(P, (cx + 0.0068, cy - 0.0005, -0.102), (0.0018, 0.004, 0.012), 0.0005, "core")          # extractor
    chamfer_box(P, (cx + 0.0080, cy - 0.003, -0.050), (0.002, 0.004, 0.034), 0.0006, "core")            # the flat
    chamfer_box(P, (cx, cy + 0.0095, -0.020), (0.006, 0.004, 0.040), 0.0010, "steel")                   # carrier key
    fin(P)
    # charging handle: the T at the back of the upper over the tube, the
    # extended latch out to the right (concept-2's top corner)
    P = moving(PFX, "Charge", (0, 0.0255, 0.080), "slide", "z", 0.055)
    chamfer_box(P, (0, 0.0255, 0.082), (0.036, 0.0065, 0.010), 0.0016, "core")
    chamfer_box(P, (0, 0.0255, 0.069), (0.008, 0.005, 0.020), 0.001, "core")
    chamfer_box(P, (0.0205, 0.0265, 0.0795), (0.010, 0.0055, 0.013), 0.0016, "core")
    for k in range(3):
        chamfer_box(P, (0.0245, 0.0298, 0.0755 + 0.004 * k), (0.004, 0.0009, 0.0016), 0.0003, "core")
    fin(P)
    # trigger: a black curved blade, pulled about its pin
    P = moving(PFX, "Trigger", (0, -0.0315, -0.024), "hinge", "x", -0.30)
    sweep(P, catmull([(0, -0.0315, -0.024), (0, -0.040, -0.027), (0, -0.047, -0.026), (0, -0.0515, -0.021)], 10),
          lambda s: 0.0026 - 0.0006 * s, "core", sides=10, uv=False)
    fin(P)
    # bolt catch: the paddle on the left over the well (palm-slapped)
    P = moving(PFX, "Catch", (-HW_LO, -0.012, -0.038), "hinge", "x", 0.22)
    chamfer_box(P, (-HW_LO - 0.001, -0.017, -0.040), (0.0025, 0.012, 0.016), 0.0008, "core")
    for k in range(3):
        chamfer_box(P, (-HW_LO - 0.0024, -0.0135 - 0.0028 * k, -0.040), (0.0010, 0.0011, 0.014), 0.0003, "core")
    fin(P)
    # magazine: a black PMAG, straight in the well, then curving forward on
    # an arc to its floorplate (concept-1/-3); rounded front and back
    # straps, 3 x 4 recessed cells a side following the curve, a ribbed
    # band and the flared floorplate square to the curve's end
    P = moving(PFX, "Mag", (0, -0.060, -0.082), "slide", "y", 0.0)
    S0, S1, RC = 0.050, 0.203, 0.37          # straight run, length, the curve's radius

    def frame(s):
        """The mag's spine at s down from its top: centre (z, y), the
        tangent (down the mag) and the forward normal, and its half-depth."""
        if s <= S0:
            c, a = (-0.080, -0.020 - s), 0.0
        else:
            a = (s - S0) / RC
            c = (-0.080 - RC * (1 - math.cos(a)), -0.020 - S0 - RC * math.sin(a))
        return Vector(c), Vector((-math.sin(a), -math.cos(a))), Vector((-math.cos(a), math.sin(a))), 0.034 + 0.005 * s / S1

    def at(s, o, x):
        c, _, nf, _ = frame(s)
        p = c + nf * o
        return Vector((x, p.y, p.x))

    fronts, backs = [], []
    for k in range(41):
        c, _, nf, h = frame(S1 * k / 40)
        fronts.append(tuple(c + nf * h))
        backs.append(tuple(c - nf * h))
    round_v(P, fronts + backs[::-1], -0.0205, backs[-1][1] + 0.0003, HW_MAG, "magm", r=0.4, step=0.003)
    c, t, nf, h = frame(S1)
    ax = Vector((0, -t.y, -t.x))                         # up the mag, in game (x, y, z)
    bx = Vector((0, -nf.y, -nf.x))                       # front to back along the floorplate
    fp = c + t * 0.0055
    chamfer_box(P, (0, fp.y, fp.x), (2 * (HW_MAG + 0.0025), 0.0125, 2 * h + 0.004), 0.0035, "magm", (R, ax, bx))
    for n in (R, L):
        for i in range(3):
            for j in range(4):
                s = 0.068 + 0.0345 * j
                p = at(s, 0.0215 * (1 - i), n.x * HW_MAG)
                rrect_cut(P, p, n, at(s - 0.01, 0, 0) - at(s + 0.01, 0, 0), 0.030, 0.0175, 0.003, 0.0013, "magm")
        for k in range(5):
            s = S1 - 0.0065 - 0.0018 * k
            rrect_cut(P, at(s, 0, n.x * HW_MAG), n, at(s, 0.01, 0) - at(s, -0.01, 0), 0.060, 0.0009, 0.0004, 0.0006, "magm")
        rrect_cut(P, (n.x * HW_MAG, -0.048, -0.080), n, ZV, 0.050, 0.010, 0.003, 0.0008, "magm")
    fin(P)


def points():
    # the old 416's anchors (weapon-416.js): grip hand, support on the
    # handguard top (buildDetailed drops it 0.05 to the belly), the reflex
    # at z -0.15 (Rail z + 0.01); the underbarrel on the belly rail's teeth
    for name, p in (("Grip", (0, -0.086, 0.020)), ("Support", (0, 0.025, -0.300)), ("Muzzle", (0, BORE, MUZZLE_Z)),
                    ("Aim", (0, AIM_Y, -0.150)), ("Under", (0, HG_BOT - 0.0100, -0.310)), ("Rail", (0, RAIL_TOP, -0.160)),
                    ("Eject", (0.020, BORE + 0.002, PORT["z"] + 0.012)), ("ChargeHand", (0, 0.027, 0.088)),
                    ("CatchHand", (-0.024, -0.018, -0.040))):
        empty(PFX + "_" + name, p)


def recipe():
    body()
    fin(rails())
    hider()
    irons()
    parts()
    points()


VIEWS = {
    "side": ((1.15, 0.0, -0.10), (0, -0.04, -0.10), 55),
    "q34": ((0.55, 0.12, -0.85), (0, -0.04, -0.10), 50),
    "c3": ((0.95, 0.20, 0.55), (0, -0.04, -0.10), 50),       # concept-3's angle (mirrored, as the game shows it)
    "port": ((0.26, 0.04, 0.10), (0.010, -0.010, -0.030), 55),
    "left": ((-0.75, 0.10, 0.05), (0, -0.05, -0.10), 50),
}

if BAKE:
    render = {"dir": os.environ.get("PF_RENDER_DIR", os.path.join(HERE, "_renders")), "views": VIEWS} if "render" in ARGS else None
    # First person carries the detail (88k tris, 2048 maps); everyone else
    # sees the LOD1 at the design's third-person budget (~6k tris, 256 px):
    # the user, 2026-10-29, "more emphasis in first person POV than third"
    # (lod_weld: the rounded lofts split the game mesh along many more
    # seams, and unwelded the LOD1 only got down to 38k)
    bake_kit.bake_gun(recipe, "problem416", PFX, HERE, render=render, res=2048, margin_px=6, lod_ratio=0.07, lod_weld=1e-5)
else:
    gk.HI = "hi" in ARGS
    recipe()
    gk.export(os.path.join(HERE, "problem416.glb"), PFX)
    if "render" in ARGS:
        gk.render_views(os.environ.get("PF_RENDER_DIR", os.path.join(HERE, "_renders")), VIEWS, PFX)
