"""
Muscular legs for the blocky body (blocky-body.js, preview mockup). User,
2026-10-11, after the arms and the torso: "after that work on the legs".

    blender --background --python build_blocky_legs.blender.py            # -> models/blocky/legs-muscle.glb
    blender --background --python build_blocky_legs.blender.py -- check   # + review renders (whole body), models/_renders/blocky-legs
      env TR_SAMPLES (render samples, default 32)

Same blocks as the arms (build_blocky_arms.slab), but each muscle is the
limb's own belly, not a block stuck on it (the lesson from the torso: "the
pec muscles and ab muscles were just popped on there"):
  - the thigh: full at the front and inside above the knee (the quads),
    under running shorts that stop halfway down, with a hem;
  - the shin: the calf swelling out behind in its upper third, the shin
    flat and straight in front, narrowing to the ankle;
  - a chunky sneaker: black upper, pale sole.
At the top the shorts are flush, each half the torso's width (the legs meet
in the middle, like a blocky avatar's); the bare thighs below part a little.

Pieces for the RIGHT leg (+X out, -Z front), in their joint's frame at
scale 1, the bone straight down -Y; L pieces are mirrors:
    thigh<S>__*   on the hip's splay joint (knee.parent), bone 0.30 long
    knee<S>__*    on the knee, bone 0.295 long (to the ankle)
    ankle<S>__*   on the ankle (not stretched), the sole on the ground
"""
import importlib.util
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_kit as K  # noqa: E402


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(K.HERE, file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


A = _load("blocky_arms", "build_blocky_arms.blender.py")

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.join(K.HERE, "blocky", "legs-muscle.glb")
THIGH, SHIN = 0.30, 0.295          # bone lengths at scale 1 (blocky rig, legs 0.67)


def thigh(S):
    """Hip to knee. levels: (y, width out, depth, x out, z back); the inside
    of a right leg is -x."""
    return {
        # the bare thigh: fullest low and to the front-inside (the quads'
        # teardrop over the knee), then in hard to the knee
        f"thigh{S}__thigh": A.slab(f"thigh{S}__thigh", [
            (-0.04, 0.172, 0.18, 0, 0), (-0.215, 0.178, 0.19, -0.004, -0.012),
            (-0.31, 0.13, 0.14, 0, 0.002)], bevel=0.034, segs=4),
        # running shorts, a little loose over it, flush at the top (from up
        # inside the hips) and stopping halfway down
        f"thigh{S}__shorts": A.slab(f"thigh{S}__shorts", [
            (0.06, 0.198, 0.198, 0, 0), (-0.06, 0.202, 0.206, 0.002, -0.003),
            (-0.15, 0.198, 0.206, 0.003, -0.006)], bevel=0.03, segs=4),
        f"thigh{S}__hem": A.slab(f"thigh{S}__hem", [
            (-0.125, 0.204, 0.212, 0.003, -0.006), (-0.162, 0.204, 0.212, 0.003, -0.006)], bevel=0.012),
    }


def shin(S):
    """Knee to ankle: the calf's belly out behind in the upper third, the
    front straight, a slim ankle that runs on down into the shoe."""
    return {
        f"knee{S}__shin": A.slab(f"knee{S}__shin", [
            (0.03, 0.13, 0.14, 0, 0), (-0.09, 0.16, 0.19, 0.005, 0.032),
            (-0.2, 0.112, 0.124, 0, 0.01), (-0.3, 0.09, 0.1, 0, 0)], bevel=0.03, segs=4),
    }


def shoe(S):
    """A chunky sneaker, flat on the ground under the ankle: the toe out in
    front, the heel just behind the ankle."""
    return {
        # the upper: a collar round the ankle, the foot under it running out
        # to a rounded toe box
        f"ankle{S}__upper": A.slab(f"ankle{S}__upper", [
            (0.085, 0.13, 0.15, 0, 0.022), (0.04, 0.16, 0.22, 0, -0.02), (0.02, 0.166, 0.25, 0, -0.04)], bevel=0.03, segs=4),
        # a thick midsole, its footprint the upper's own
        f"ankle{S}__sole": A.slab(f"ankle{S}__sole", [
            (0.026, 0.17, 0.258, 0, -0.04), (-0.012, 0.172, 0.262, 0, -0.04)], bevel=0.014, segs=3),
    }


COLOURS = {"shorts": 0x34363e, "hem": 0x43464f, "upper": 0x141416, "sole": 0xdcdcd6}


def build():
    parts = {**thigh("R"), **shin("R"), **shoe("R")}
    for n, ob in list(parts.items()):
        ln = n.replace("R__", "L__")
        parts[ln] = K.mirror_x(ob, ln)
    for n, ob in parts.items():
        key = n.split("__")[1]
        m = bpy.data.materials.get(key) or (K.material(key, COLOURS[key], 0.7) if key in COLOURS else A.skin())
        ob.data.materials.clear()
        ob.data.materials.append(m)
    return parts


# ---------------------------------------------------------------- review renders
HIP_Y, HIP_X = A.CHEST - 0.48, 0.1


def check(parts):
    T = _load("blocky_torso", "build_blocky_torso.blender.py")
    for n, ob in T.build().items():
        ob.location = K.B((0, A.CHEST if n.startswith("chest") else HIP_Y, 0))
    A.place(A.build())
    for n, ob in parts.items():
        side = 1 if "R__" in n else -1
        joint = n.split("__")[0][:-1]
        y = {"thigh": HIP_Y, "knee": HIP_Y - THIGH, "ankle": HIP_Y - THIGH - SHIN}[joint]
        ob.location = K.B((side * HIP_X, y, 0))
    K.ico("REF_head", (0, A.CHEST + 0.27, 0), 0.16, K.material("REF_Skin", 0xf3f3ef, 0.6), sub=3, scale=(1.05, 1, 0.55))
    sc = bpy.context.scene
    cam = K.render_setup(samples=int(os.environ.get("TR_SAMPLES", 32)))
    out = os.path.join(K.HERE, "_renders", "blocky-legs")
    os.makedirs(out, exist_ok=True)
    shots = [("body", y, 3.0, 1.0, (0, 0, 0.75)) for y in (0, 35, 90, 180)]
    shots += [("legs", y, 1.6, 0.5, (0, 0, 0.35)) for y in (25, 110)]
    for kind, yaw, dist, h, tgt in shots:
        K.aim(cam, yaw, dist=dist, height=h, target=tgt)
        sc.render.stamp_note_text = f"  blocky legs · {kind} {yaw}  "
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
