"""
Troll Knight (U Mad Bro? hero), from refs/knight-ref.jpg: a muscular
trollface in dark plate, blue cape, trollface brooch, a bare muscled sword
arm with a bandaged forearm. The keyboard greatsword is the game's own
(gear.js "keyboard"), carried on his back by hero-bodies.js.

    blender --background --python build_hero_knight.blender.py               # build + export
    blender --background --python build_hero_knight.blender.py -- check       # + review renders (models/_renders/knight)
      env HK_SAMPLES (timelapse render samples, default 24)

Pieces are "<joint>__<piece>" (hero_kit.py). The stick rig's limbs hug the
body, so arms and legs are drawn a little outward (OFFSETS) and taper back
to the true wrist and ankle, where the weapons are held. Elbow and knee
caps cover the gap the offset opens when a joint bends.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_kit as K  # noqa: E402
from hero_kit import V, loft, ico, box, disc, sheet, paint, mirror_x  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.join(K.HERE, "hero-knight.glb")

K.reset_scene()
# No timelapse (user, 2026-10-03: "i dont want any timelapse videos"). The
# renderer only spins up for "-- check" review renders; "-- snap" still
# writes stage frames if ever wanted.
tl = K.Timelapse("knight", enabled=("check" in ARGS or "snap" in ARGS), samples=int(os.environ.get("HK_SAMPLES", 24)))
J = K.REST
# v6 "sharp" pass (user: "graphics sharp like the green candles gun"): rounder
# pieces everywhere, crisp bevelled plate edges (K.crisp_all), rolled trims.
K.SEG_SCALE = 1.6
tl.quiet = "snap" not in ARGS


def side_pt(name, s, dx=0.0, dy=0.0, dz=0.0):
    """A rest joint for side s (-1 left, +1 right) pushed outward by dx."""
    j = J[name + ("L" if s < 0 else "R")]
    return V(j[0] + s * dx, j[1] + dy, j[2] + dz)


# ---------------------------------------------------------------- 0. the rig
K.stick_rig(face=False)
# His own head: wider, heavier jaw, a deep skull on a bull neck.
# v5 (user: "make the face bigger"): ~20% bigger, a flatter front so the
# drawing reads large, a deeper skull behind.
K.trollface_head(w=0.6, h=0.56, jaw=0.12, depth_front=0.16, depth_back=0.26, lift=0.04, jut=0.25, skull=0.2)
tl.snap("head v9: egg-shaped, the drawing on the front only, a clean white skull round it")

# ---------------------------------------------------------------- 1. cuirass
def pecs(th, t):
    # th pi/2 is the front (-Z). Two pec swells high on the chest, a
    # shallow centre groove, a little lat flare at the sides.
    front = math.sin(th)
    k = 1.0
    if front > 0 and 0.45 < t < 0.9:
        lift = math.sin((t - 0.45) / 0.45 * math.pi)
        side = abs(math.cos(th))
        k += 0.2 * lift * front * max(0, 1 - abs(side - 0.42) * 1.8)
        k -= 0.07 * lift * max(0, 1 - side / 0.12) * front
    if abs(math.cos(th)) > 0.8 and 0.3 < t < 0.8:
        k += 0.07
    # A six-pack hammered into the plate (a muscle cuirass): three rows of
    # two bumps either side of the centre line, low on the front.
    if front > 0.55 and 0.06 < t < 0.42:
        row = math.sin((t - 0.06) / 0.12 * math.pi) ** 2
        col = math.exp(-((abs(math.cos(th)) - 0.13) / 0.07) ** 2)
        k += 0.05 * row * col * front
    return k


# V-taper: a narrow waist under a huge chest (the ref is a bodybuilder).
# v5 (user: "body bigger, more muscle"): ~18% broader and deeper.
cuirass = loft("chest__cuirass", (0, 0.99, 0), (0, 1.49, 0), [
    (0.00, 0.145, 0.128, 0, 0.0),
    (0.16, 0.158, 0.135, 0, -0.008),
    (0.38, 0.210, 0.158, 0, -0.02),
    (0.60, 0.275, 0.180, 0, -0.032),
    (0.80, 0.292, 0.178, 0, -0.026),
    (0.92, 0.255, 0.150, 0, -0.01),
    (1.00, 0.125, 0.095, 0, 0.0),
], segs=26, shape=pecs)
K.subdivide(cuirass, 1)
paint(cuirass, "iron")
paint(K.trim("chest__waisttrim", (0, 0.995, 0), (0, 1.1, 0), 0.145, 0.128, width=0.016, segs=26), "ironDark")
# Centre ridge (the plate's crease) and two rows of rivets down the sides.
paint(loft("chest__ridge", (0, 1.2, -0.17), (0, 1.38, -0.19), [(0, 0.010, 0.006), (1, 0.010, 0.006)], segs=6), "ironDark")
for s in (-1, 1):
    for i, y in enumerate((1.08, 1.16, 1.24, 1.32)):
        r = 0.17 + 0.07 * i / 3
        paint(ico(f"chest__rivet{'L' if s < 0 else 'R'}{i}", (s * r * 0.92, y, -0.08), 0.013, sub=1), "ironDark")
tl.snap("cuirass v5: 18% bigger, huge pecs, six-pack hammered in")

# ---------------------------------------------------------------- 2. waist
paint(loft("spine__belt", (0, 0.94, 0), (0, 1.03, 0), [(0, 0.165, 0.138), (1, 0.163, 0.136)], segs=20), "leather")
paint(box("spine__buckle", (0, 0.985, -0.145), (0.08, 0.07, 0.022), bevel=0.006), "gold")
paint(loft("hips__pelvis", (0, 0.77, 0), (0, 0.96, 0), [(0, 0.168, 0.12), (0.6, 0.164, 0.125), (1, 0.156, 0.128)], segs=18), "cloth")
# Tassets: four hanging plates, each a curved slab that flares out.
for i, ang in enumerate((-0.9, -0.3, 0.3, 0.9)):
    cx, cz = math.sin(ang), -math.cos(ang)
    top = V(cx * 0.168, 0.94, cz * 0.142)
    bot = V(cx * 0.205, 0.74, cz * 0.185)
    t = loft(f"hips__tasset{i}", top, bot, [(0, 0.066, 0.013), (1, 0.075, 0.013)], segs=8)
    paint(t, "iron")
tl.snap("waist: belt + gold buckle, breeches, four tassets")

# ---------------------------------------------------------------- 3. arms
SH = 0.175   # how far the shoulder is drawn out from the rig's arm root
EL = 0.115   # ... the elbow
for s in (-1, 1):
    tag = "L" if s < 0 else "R"
    shoulder = V(s * (0.12 + SH), 1.355, 0.0)
    elbow = side_pt("elbow", s, EL)
    wrist = side_pt("wrist", s)
    if s < 0:
        # Left: full plate. Pauldron of three lames, rerebrace, couter,
        # vambrace, gauntlet.
        paint(ico(f"arm{tag}__pauldome", shoulder + V(-0.005, 0.05, 0.0), 0.18, sub=3, scale=(1.0, 0.72, 1.05)), "iron")
        paint(K.trim(f"arm{tag}__ptrim", shoulder + V(-0.005, 0.05, 0.0), shoulder + V(-0.005, 0.25, 0.0), 0.172, 0.18, width=0.014, lip=0.006), "gold")
        for k, (y, r) in enumerate(((1.355, 0.19), (1.29, 0.185), (1.225, 0.17))):
            lame = loft(f"arm{tag}__pauldron{k}", V(shoulder.x - 0.01 * k, y + 0.06, 0.0), V(shoulder.x - 0.03 - 0.01 * k, y - 0.03, 0.0),
                        [(0, 0.04, 0.04), (0.35, r * 0.9, r * 0.88), (1, r, r * 0.95)], segs=16, cap_b=False)
            paint(lame, "iron" if k != 1 else "ironDark")
        paint(loft(f"arm{tag}__rerebrace", shoulder + V(0, -0.06, 0), elbow, [(0, 0.098, 0.098), (0.45, 0.096, 0.094), (1, 0.074, 0.072)], segs=14), "iron")
        paint(K.trim(f"arm{tag}__rtrim", elbow + (shoulder - elbow) * 0.05, shoulder, 0.074, 0.072), "ironDark")
        paint(loft(f"elbow{tag}__vambrace", elbow, wrist + V(0, 0.03, 0), [(0, 0.078, 0.075), (0.32, 0.088, 0.082), (1, 0.06, 0.057)], segs=14), "iron")
        paint(ico(f"elbow{tag}__couter", elbow, 0.092, sub=2, scale=(1, 0.9, 1)), "ironDark")
        # The gauntlet's flared cuff; the articulated plated hand itself is
        # built in the game (hero-bodies.js) so every finger can move.
        paint(loft(f"elbow{tag}__cuff", wrist + V(0, 0.085, 0), wrist + V(0, -0.005, 0),
                   [(0, 0.066, 0.062), (0.6, 0.074, 0.07), (1, 0.086, 0.08)], segs=14, cap_b=False), "ironDark")
        paint(K.trim(f"elbow{tag}__vtrim", elbow + (wrist - elbow) * 0.08, wrist, 0.084, 0.078), "gold")
    else:
        # Right: the bare sword arm. Deltoid, bicep, a bandaged forearm, a
        # big white fist. Cape strap over the shoulder.
        def bicep(th, t):
            # A peaked bicep on one face and a horseshoe tricep on the other.
            front = -math.sin(th)
            peak = math.sin(min(1, t / 0.72) * math.pi)
            return 1 + 0.3 * peak * max(0, front) ** 1.5 + 0.16 * peak * max(0, -front) ** 2
        paint(ico(f"arm{tag}__deltoid", shoulder + V(-0.005, 0.015, 0.0), 0.155, sub=3, scale=(1.0, 1.05, 1.0)), "skin")
        paint(loft(f"arm{tag}__bicep", shoulder + V(0, -0.05, 0), elbow, [(0, 0.12, 0.12), (0.42, 0.112, 0.118), (1, 0.078, 0.078)], segs=18, shape=bicep), "skin")
        paint(ico(f"elbow{tag}__elbow", elbow, 0.078, sub=2), "skin")
        def brachio(th, t):
            return 1 + 0.2 * math.sin(min(1, t / 0.45) * math.pi) * max(0, math.cos(th))
        fore = loft(f"elbow{tag}__forearm", elbow, wrist + V(0, 0.02, 0), [(0, 0.078, 0.075), (0.28, 0.092, 0.085), (1, 0.056, 0.052)], segs=14, shape=brachio)
        paint(fore, "skin")
        for k in range(4):
            t = 0.42 + k * 0.15
            c = elbow.lerp(wrist, t)
            r = 0.086 - 0.026 * t
            paint(loft(f"elbow{tag}__wrap{k}", c + V(0, 0.022, 0), c + V(0, -0.022, 0), [(0, r + 0.006, r + 0.004), (1, r + 0.005, r + 0.004)], segs=12, twist=k * 0.3), "bandage")
        # A last bandage turn at the wrist; the hand is the game's articulated one.
        paint(loft(f"elbow{tag}__wristwrap", wrist + V(0, 0.05, 0), wrist + V(0, -0.005, 0),
                   [(0, 0.06, 0.056), (1, 0.058, 0.054)], segs=12), "bandage")
tl.snap("arms v6: plate trims, gauntlet cuff + bandaged wrist (articulated hands come in-game)")

# ---------------------------------------------------------------- 4. legs
HP, KN, AN = 0.115, 0.078, 0.04   # outward draw at hip, knee, ankle
for s in (-1, 1):
    tag = "L" if s < 0 else "R"
    hip = V(s * HP, 0.86, 0.0)
    knee = side_pt("knee", s, KN)
    ankle = side_pt("ankle", s, AN)
    paint(K.trim(f"thigh{tag}__ctrim", knee + V(0, 0.05, 0), hip, 0.088, 0.09), "ironDark")
    paint(loft(f"thigh{tag}__cuisse", hip, knee + V(0, 0.03, 0), [(0, 0.13, 0.132), (0.35, 0.128, 0.13), (1, 0.088, 0.09)], segs=18), "iron")
    paint(ico(f"knee{tag}__poleyn", knee + V(0, 0, -0.03), 0.085, sub=2, scale=(1, 1.05, 0.9)), "ironDark")
    def calf(th, t):
        return 1 + 0.2 * math.sin(min(1, t / 0.6) * math.pi) * max(0, math.sin(th))
    paint(K.trim(f"knee{tag}__gtrim", knee + V(0, -0.005, 0), ankle, 0.088, 0.088), "gold")
    paint(loft(f"knee{tag}__greave", knee, ankle + V(0, 0.07, 0), [(0, 0.088, 0.088), (0.35, 0.095, 0.1), (1, 0.066, 0.066)], segs=16, shape=calf), "iron")
    # Sabaton: the sole sits on the floor (y 0), toe pointing forward (-Z).
    paint(loft(f"ankle{tag}__sabaton", V(ankle.x, 0.05, 0.06), V(ankle.x, 0.04, -0.19),
               [(0, 0.07, 0.055), (0.35, 0.075, 0.055), (0.75, 0.064, 0.044), (1, 0.034, 0.028)], segs=12), "ironDark")
tl.snap("legs v5: thick thighs, big calves, bigger boots")

# ---------------------------------------------------------------- 5. cape
# Hung from the shoulders, wrapping round them at the top, falling in
# deep folds to the back of the knees and flaring wide.
rows = []
for r in range(11):
    v = r / 10
    y = 1.46 - v * 1.04
    row = []
    for c in range(15):
        u = c / 14 - 0.5
        half = 0.36 + 0.17 * v
        x = u * 2 * half
        wrap = 0.0   # (run 3: wrapping it round the shoulders cut into the pauldron)
        z = 0.205 + 0.15 * v - wrap + 0.04 * math.sin(u * math.pi * 6 + 0.6) * v ** 0.7
        row.append((x, y, z))
    rows.append(row)
cape = sheet("chest__cape", rows, thick=0.014)
paint(cape, "cape")
# The collar the cape hangs from, rolled over both shoulders.
paint(loft("chest__capecollar", (-0.37, 1.43, 0.11), (0.37, 1.43, 0.11), [(0, 0.03, 0.04), (0.5, 0.04, 0.055), (1, 0.03, 0.04)], segs=10), "cape")
tl.snap("cape v5: wider for the bigger frame")

# ---------------------------------------------------------------- 6. gorget + brooch
# A broad low gorget collar on the chest and a thick bull neck up into the head.
paint(loft("chest__gorget", (0, 1.4, 0), (0, 1.49, 0), [(0, 0.2, 0.145), (0.45, 0.15, 0.115), (1, 0.105, 0.088)], segs=20, cap_a=False), "iron")
paint(loft("neckPivot__neck", (0, 1.44, 0.005), (0, 1.58, 0.02), [(0, 0.105, 0.095), (1, 0.095, 0.088)], segs=16), "skin")
brooch_face = K.material("trollface", 0xffffff, 0.5, image=K.TROLLFACE_PNG)
# Brooch high on the right chest, the cape cord running from it over the
# right shoulder; a sword baldric across the chest to the left hip.
paint(disc("chest__brooch", (0.15, 1.375, -0.235), (0.18, 0.1, -1), 0.062, 0.02, segs=22, face_mat=brooch_face), "gold")
paint(loft("chest__cord", (0.17, 1.385, -0.22), (0.31, 1.45, 0.07), [(0, 0.013, 0.013), (1, 0.013, 0.013)], segs=6), "gold")
for k, (a, b) in enumerate((((0.28, 1.45, -0.1), (0.06, 1.27, -0.255)), ((0.06, 1.27, -0.255), (-0.17, 0.99, -0.165)))):
    paint(loft(f"chest__baldric{k}", a, b, [(0, 0.03, 0.008), (1, 0.03, 0.008)], segs=6), "leather")
tl.snap("bull neck + low gorget, trollface brooch, cape cord, sword baldric")

# ---------------------------------------------------------------- 7. crisp
K.crisp_all()
tl.snap("crisp pass: bevelled plate edges, hardened normals, rolled trims")

# ---------------------------------------------------------------- 8. paint
MATS = {
    # Polished: the game gives these the weapon studio's reflections
    # (hero-bodies.js dressMaterial), like the Green Candles' steel.
    "iron": K.material("Iron", 0x56606b, 0.28, metal=0.72, coat=0.25),
    "ironDark": K.material("IronDark", 0x24282d, 0.36, metal=0.6),
    "leather": K.material("Leather", 0x5b3a22, 0.7),
    "cloth": K.material("Breeches", 0x2b2a2e, 0.85, sheen=0.3),
    "gold": K.material("Gold", 0xd6a53a, 0.24, metal=0.85),
    "skin": K.material("Skin", 0xf4f2ec, 0.55),
    "bandage": K.material("Bandage", 0xe2d8c2, 0.85),
    "cape": K.material("Cape", 0x1a3f9e, 0.8, sheen=0.15),   # deeper: the game sun washed 0x2357c4 to baby blue
}
K.apply_paint(MATS)
tl.snap("paint: dark iron, gold, leather, white skin, deep royal-blue cape")

tris = K.export(OUT)
tl.snap(f"exported hero-knight.glb ({tris} tris)")

if "check" in ARGS:
    tl.check()
if "turntable" in ARGS:
    tl.turntable()
    K.stitch("knight")
