"""
TROLLS NFT traits (opensea.io/collection/trollsoneth) for the Troll Forces
operator: one GLB per trait, so a token's look is a permutation of parts.
The operator stays a stick figure; clothes are fitted pieces that give it
a body only where the garment is (user, 2026-10-11).

    blender --background --python build_traits.blender.py -- all          # every trait -> models/traits/trait-<id>.glb
    blender --background --python build_traits.blender.py -- hat-goatfarm # one trait
    blender --background --python build_traits.blender.py -- check 1718   # a token on the stick rig -> models/_renders/traits/1718
      env TR_SAMPLES (render samples, default 32)

Pieces are "<joint>__<trait>_<part>" (hero_kit.py), so hero-bodies.js can
wear them. Ref art for a token: refs/trolls-<id>.png (local only).
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_kit as K  # noqa: E402
import trait_kit as T  # noqa: E402
from hero_kit import V  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT_DIR = os.path.join(K.HERE, "traits")
K.SEG_SCALE = 1.4


# ---------------------------------------------------------------- materials
def mat(key):
    spec = {
        "capBlack": ("CapBlack", 0x17171a, 0.82, 0, 0, 0.25),
        "capSeam": ("CapSeam", 0x2c2c31, 0.75, 0, 0, 0.2),
        "print": ("PrintWhite", 0xf1f1ee, 0.6, 0, 0, 0),
        "stache": ("Stache", 0x0b0b0c, 0.55, 0, 0.15, 0),
        "lime": ("TankLime", 0x84ec2e, 0.78, 0, 0, 0.3),
        "printBlack": ("PrintBlack", 0x0c0c0d, 0.62, 0, 0, 0),
        "trim": ("TankTrim", 0x121213, 0.7, 0, 0, 0.2),
        "skin": ("Skin", 0xf4f2ec, 0.55, 0, 0, 0),
        "ink": ("Ink", 0x050505, 0.9, 0, 0, 0),
    }[key]
    name, col, rough, metal, coat, sheen = spec
    return bpy.data.materials.get(name) or K.material(name, col, rough, metal=metal, coat=coat, sheen=sheen)


def wear(ob, key):
    ob.data.materials.clear()
    ob.data.materials.append(mat(key))
    return ob


# ---------------------------------------------------------------- the head
def head_obj(export_name="REF_head"):
    """The 3D trollface head the other traits fit to. Built once per scene;
    exported only by the head trait (REF_ pieces never are)."""
    for n in ("headPivot__head", "REF_head"):
        ob = bpy.data.objects.get(n)
        if ob:
            return ob
    return K.trollface_head(name=export_name)


def head_surface():
    return T.surface(head_obj())


def b_head_troll():
    head_obj("headPivot__head")


# ---------------------------------------------------------------- HATS: Goatfarm Hat
def b_hat_goatfarm():
    hs = head_surface()
    c = T.cap("headPivot__goatfarm", hs, rim_front=1.86, rim_back=1.765, height=0.15, lean=0.06, brim=0.17)
    for k in ("crown", "brim", "button"):
        wear(c[k], "capBlack")
    wear(c["band"], "capSeam")
    for s in c["seams"] + c["eyelets"]:
        wear(s, "capSeam")
    cs = T.surface(c["crown"])
    # "U MAD BRO?" across the front panels, big and tight like the art
    T.lettering("headPivot__goatfarm_print", "U MAD BRO?", cs, (0, 0, 0), 1.935, width=0.29, height=0.075,
                depth=0.003, center_fn=c["center"], mat=mat("print"))


# ---------------------------------------------------------------- FACIALS: French Moustache
# User's ref sheet (2026-10-11): two fat combed lobes pinched at the middle,
# tapering out past the cheeks into tips that curl up and back in.
STACHE = [  # one half, on the face plane (x, y)
    (0.0, 1.717), (0.03, 1.713), (0.068, 1.708), (0.105, 1.711), (0.142, 1.721), (0.175, 1.734),
    (0.203, 1.746), (0.225, 1.759), (0.236, 1.776), (0.229, 1.791), (0.214, 1.794), (0.205, 1.784),
    (0.209, 1.774),
]
STACHE_R = [0.012, 0.027, 0.032, 0.028, 0.02, 0.014, 0.0105, 0.0086, 0.0072, 0.006, 0.005, 0.0044, 0.004]


def b_facial_french_moustache():
    hs = head_surface()
    path = T.smooth_path([V(x, y, 0) for x, y in STACHE], iters=3)
    radii = T.resample(STACHE_R, len(path))
    pts = []
    last_z = -0.09
    for p, r in zip(path, radii):
        hit = hs.front(p.x, p.y)
        z = hit.z if hit else last_z
        last_z = z
        pts.append(V(p.x, p.y, z - r * 0.55 - 0.002))
    # Mirror the half into the full bar (shared centre point once).
    full = [V(-p.x, p.y, p.z) for p in reversed(pts)] + pts[1:]
    rr = list(reversed(radii)) + radii[1:]
    wear(T.sweep("headPivot__stache", full, rr, segs=28, flat=0.55, flute=0.05, flutes=9), "stache")


# ---------------------------------------------------------------- CLOTHES: Tank Runner
# The torso the clothes fit to: half-widths across (rx) and front-back (rz)
# by height, a little boxy, pecs on the front.
TORSO = [  # y, rx, rz
    (0.84, 0.142, 0.1), (0.95, 0.136, 0.097), (1.05, 0.139, 0.1), (1.15, 0.152, 0.108),
    (1.25, 0.177, 0.12), (1.32, 0.192, 0.124), (1.37, 0.186, 0.118), (1.41, 0.152, 0.1),
    (1.44, 0.098, 0.082), (1.46, 0.078, 0.072),
]


def torso_pt(phi, y, grow=0.0):
    """A point on the torso: phi 0 = front (-Z), pi/2 = the wearer's right (+X)."""
    for (y0, a0, b0), (y1, a1, b1) in zip(TORSO, TORSO[1:]):
        if y <= y1 or (y1, a1, b1) == TORSO[-1]:
            f = max(0.0, min(1.0, (y - y0) / (y1 - y0)))
            f = f * f * (3 - 2 * f)
            rx, rz = a0 + (a1 - a0) * f, b0 + (b1 - b0) * f
            break
    p = 2.5
    s, c = math.sin(phi), math.cos(phi)
    x = rx * math.copysign(abs(s) ** (2 / p), s)
    z = -rz * math.copysign(abs(c) ** (2 / p), c)
    k = 1.0
    if c > 0 and 1.17 < y < 1.36:
        lift = math.sin((y - 1.17) / 0.19 * math.pi)
        side = abs(s)
        k += 0.16 * lift * c * max(0.0, 1 - abs(side - 0.42) * 2.0)   # pecs
        k -= 0.05 * lift * c * max(0.0, 1 - side / 0.14)               # the groove between
    return V(x * (1 + grow / max(rx, 1e-3)) * 1, y, z * k * (1 + grow / max(rz, 1e-3)))


def tank_top(phi):
    """Where the tank stops, by azimuth (deg from the front): a low scoop
    neck, high under the straps, deep armholes, a higher back."""
    a = abs(math.degrees(phi)) % 360
    a = 360 - a if a > 180 else a
    keys = [(0, 1.258), (18, 1.295), (31, 1.37), (44, 1.355), (62, 1.3), (90, 1.268), (118, 1.3),
            (136, 1.355), (149, 1.38), (162, 1.35), (180, 1.322)]
    for (a0, y0), (a1, y1) in zip(keys, keys[1:]):
        if a <= a1:
            f = (a - a0) / (a1 - a0)
            f = f * f * (3 - 2 * f)
            return y0 + (y1 - y0) * f
    return keys[-1][1]


def b_clothes_tank_runner():
    segs = 64
    hem = 0.875
    # skin: the chest the scoop shows, the shoulders, the neck
    sv, sf = [], []
    ys = [1.18 + i * (1.46 - 1.18) / 20 for i in range(21)]
    for y in ys:
        for k in range(segs):
            sv.append(torso_pt(T.TAU * k / segs, y))
    for i in range(len(ys) - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            sf.append((i * segs + k, i * segs + k2, (i + 1) * segs + k2, (i + 1) * segs + k))
    wear(T.recalc(K.mesh_obj("chest__tankrunner_skin", sv, sf)), "skin")
    wear(K.loft("neckPivot__tankrunner_neck", (0, 1.4, 0.008), (0, 1.6, 0.02),
                [(0, 0.082, 0.074), (0.5, 0.074, 0.068), (1, 0.076, 0.07)], segs=18), "skin")

    # the tank: per-column loft from the hem to the neckline/armholes, a hair off the skin
    lift = 0.007
    rows = 26
    tv, tf = [], []
    for i in range(rows + 1):
        t = i / rows
        for k in range(segs):
            phi = T.TAU * k / segs
            y = hem + (tank_top(phi) - hem) * t
            tv.append(torso_pt(phi, y, grow=lift))
    for i in range(rows):
        for k in range(segs):
            k2 = (k + 1) % segs
            tf.append((i * segs + k, i * segs + k2, (i + 1) * segs + k2, (i + 1) * segs + k))
    shell = T.recalc(K.mesh_obj("chest__tankrunner_body", tv, tf))
    sol = shell.modifiers.new("thick", "SOLIDIFY")
    sol.thickness = 0.004
    sol.offset = -1
    K.apply_mods(shell)
    wear(shell, "lime")
    # Black binding round the neck and armholes (user's ref sheet), broken
    # where the straps take over; a plain rolled hem.
    top = [V(tv[rows * segs + k]) for k in range(segs)]

    def in_strap(k):
        a = (360 * k / segs) % 360
        a = 360 - a if a > 180 else a
        return 27 <= a <= 41 or 140 <= a <= 154

    runs, cur = [], []
    start = next(k for k in range(segs) if in_strap(k))     # begin at a strap so runs never wrap
    for i in range(1, segs + 1):
        k = (start + i) % segs
        if in_strap(k):
            if len(cur) > 1:
                runs.append(cur)
            cur = []
        else:
            cur.append(top[k])
    for n, run in enumerate(runs):
        wear(T.sweep(f"chest__tankrunner_binding{n}", run, 0.0068, segs=8), "trim")
    wear(T.sweep("spine__tankrunner_hem", [V(tv[k]) for k in range(segs)], 0.006, segs=6, closed=True), "lime")
    # Wide straps over the shoulders, bound on both edges.
    skin_s = T.surface(bpy.data.objects["chest__tankrunner_skin"])

    def over_shoulder(x, lift_off, ymin=0.0):
        ctr = V(x, 1.34, 0.0)
        pts = []
        for i in range(29):
            a = -0.35 + (math.pi + 0.55) * i / 28      # front, up over, down the back
            d = V(0, math.sin(a), -math.cos(a))
            hit = skin_s.out_from(ctr, d)
            if hit and hit.y >= ymin:
                pts.append(hit + d * lift_off)
        return T.smooth_path(pts, 1)

    for side in (-1, 1):
        sk = "R" if side > 0 else "L"
        wear(T.sweep(f"chest__tankrunner_strap{sk}", over_shoulder(side * 0.12, 0.006), 0.031, segs=12, flat=0.15), "lime")
        for e, ek in ((-0.03, "in"), (0.03, "out")):
            wear(T.sweep(f"chest__tankrunner_strap{sk}_{ek}", over_shoulder(side * 0.12 + e * side, 0.009, 1.355),
                         0.0068, segs=8), "trim")
    # RUNNER: heavy italic across the chest, like the ref sheet
    tank_s = T.surface(shell)
    T.lettering("chest__tankrunner_print", "RUNNER", tank_s, (0, 0, 0), 1.14, width=0.3, height=0.068,
                depth=0.0025, font="C:/Windows/Fonts/seguibli.ttf", mat=mat("printBlack"))    # the stick upper arms, out of the armholes (the rig's own arms leave
    # the chest centre, inside the tank)
    for side, key in ((-1, "L"), (1, "R")):
        el = K.REST["elbow" + key]
        wear(K.loft(f"arm{key}__tankrunner_arm", (side * 0.178, 1.3, 0.004), el,
                    [(0, 0.034, 0.034), (1, 0.032, 0.032)], segs=10), "ink")


TRAITS = {
    "head-troll": b_head_troll,
    "hat-goatfarm": b_hat_goatfarm,
    "facial-french-moustache": b_facial_french_moustache,
    "clothes-tank-runner": b_clothes_tank_runner,
}
TOKENS = {
    1718: ["head-troll", "hat-goatfarm", "facial-french-moustache", "clothes-tank-runner"],
}


# ---------------------------------------------------------------- run
def export_trait(tid):
    K.reset_scene()
    TRAITS[tid]()
    os.makedirs(OUT_DIR, exist_ok=True)
    K.export(os.path.join(OUT_DIR, f"trait-{tid}.glb"))


def check(token):
    K.reset_scene()
    K.stick_rig(face=False)
    for tid in TOKENS[token]:
        TRAITS[tid]()
    for ob in bpy.context.scene.objects:   # the fitting head never shows twice
        if ob.name == "REF_head":
            ob.hide_render = True
    sc = bpy.context.scene
    cam = K.render_setup(samples=int(os.environ.get("TR_SAMPLES", 32)))
    out = os.path.join(K.HERE, "_renders", "traits", str(token))
    os.makedirs(out, exist_ok=True)
    shots = [("body", y, 4.2, 1.25, (0, 0, 0.98)) for y in (0, 35, 90, 180)]
    shots += [("head", y, 1.6, 1.8, (0, 0, 1.76)) for y in (0, 40, 115)]
    for kind, yaw, dist, h, tgt in shots:
        K.aim(cam, yaw, dist=dist, height=h, target=tgt)
        sc.render.stamp_note_text = f"  TROLLS #{token} · {kind} {yaw}  "
        sc.render.filepath = os.path.join(out, f"{kind}{yaw:+04d}.png")
        bpy.ops.render.render(write_still=True)
    print("CHECK", out)


if ARGS and ARGS[0] == "check":
    check(int(ARGS[1]))
elif ARGS and ARGS[0] == "all":
    for tid in TRAITS:
        export_trait(tid)
elif ARGS and ARGS[0] in TRAITS:
    export_trait(ARGS[0])
else:
    print("usage: -- all | -- <trait id> | -- check <token>")
