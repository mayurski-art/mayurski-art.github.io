"""
The Sensei's arms and legs for the blocky body (blocky-body.js KITS
"clothes-sensei"): TROLLS CLOTHES / Sensei, first worn by TROLLS #989 (the
orange gi over a blue undershirt, refs/trolls-goku-dev.png). The gi itself
is the torso's template (traits/src/clothes-sensei.block.svg).

    blender --background --python build_blocky_sensei.blender.py   # -> models/blocky/arms-sensei.glb, legs-sensei.glb

The arms: the undershirt's short blue sleeve over the shoulder, then the
muscular arm bare (build_blocky_arms' pieces), a blue wristband, the fist.
The legs: loose gi trousers gathered in at the ankle over blue boots.

The game colours each piece by its name after "__" (up to a "-"):
    sleeve, band   the undershirt's blue (the wristband too)
    gi, hem        the trousers, the gathered ankle a shade darker
    boot, sole     the boots
    upper, bicep, tricep, fore, fist, knuckles, thumb   skin
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
F = _load("blocky_farmer", "build_blocky_farmer.blender.py")
OUT_ARMS = os.path.join(K.HERE, "blocky", "arms-sensei.glb")
OUT_LEGS = os.path.join(K.HERE, "blocky", "legs-sensei.glb")
COLOURS = {"sleeve": 0x2d5a96, "band": 0x2d5a96, "gi": 0xf2841f, "hem": 0xd96f15, "boot": 0x2d5a96, "sole": 0x24252b}


# ---------------------------------------------------------------- the arms
def arm(S):
    """levels: (y, width out, depth, x out, z back); the front is -z."""
    bare = A.upper_arm(S)
    # the deltoid is under the sleeve's cap: no skin piece to poke through it
    bpy.data.objects.remove(bare.pop(f"arm{S}__delt"), do_unlink=True)
    return {
        **bare,
        # the short sleeve: a third of the way to the elbow, loose, its hem square
        f"arm{S}__sleeve": A.slab(f"arm{S}__sleeve", [
            (0.0, 0.17, 0.165, 0.008, 0), (-0.08, 0.166, 0.162, 0.01, 0), (-0.125, 0.158, 0.156, 0.008, 0)], bevel=0.026, segs=4),
        # its cap over the deltoid
        f"arm{S}__sleeve-cap": A.slab(f"arm{S}__sleeve-cap", [
            (0.05, 0.15, 0.15, 0.006, 0), (-0.02, 0.198, 0.184, 0.02, 0), (-0.11, 0.17, 0.168, 0.016, 0)], bevel=0.034, segs=4),
        **A.forearm(S),
        # the wristband
        f"elbow{S}__band": A.slab(f"elbow{S}__band", [
            (-0.25, 0.116, 0.124, 0, 0), (-0.33, 0.112, 0.12, 0, 0)], bevel=0.014),
        **A.fist(S),
    }


# ---------------------------------------------------------------- the legs
def leg(S):
    return {
        # gi trousers: baggy, fuller over the knee, flush with each other at the top
        f"thigh{S}__gi": A.slab(f"thigh{S}__gi", [
            (0.06, 0.2, 0.2, 0, 0), (-0.15, 0.21, 0.214, 0.004, -0.004), (-0.315, 0.2, 0.206, 0.002, 0)], bevel=0.032, segs=4),
        f"knee{S}__gi-shin": A.slab(f"knee{S}__gi-shin", [
            (0.04, 0.198, 0.206, 0, 0), (-0.09, 0.19, 0.198, 0, 0.004), (-0.18, 0.166, 0.174, 0, 0)], bevel=0.03, segs=4),
        # gathered in at the ankle, over the boot's top
        f"knee{S}__hem": A.slab(f"knee{S}__hem", [
            (-0.165, 0.17, 0.178, 0, 0), (-0.215, 0.158, 0.166, 0, 0)], bevel=0.016),
    }


def boot(S):
    """A boot on the ankle (not stretched): a shaft up under the gathered hem,
    a rounded toe, a dark sole."""
    return {
        f"ankle{S}__boot": A.slab(f"ankle{S}__boot", [
            (0.16, 0.15, 0.16, 0, 0.012), (0.06, 0.158, 0.19, 0, 0.0), (0.028, 0.162, 0.246, 0, -0.035)], bevel=0.03, segs=4),
        f"ankle{S}__sole": A.slab(f"ankle{S}__sole", [
            (0.03, 0.168, 0.256, 0, -0.035), (-0.012, 0.17, 0.26, 0, -0.035)], bevel=0.012, segs=3),
    }


def finish(parts):
    for n, ob in list(parts.items()):
        ln = n.replace("R__", "L__")
        parts[ln] = K.mirror_x(ob, ln)
    for n, ob in parts.items():
        key = n.split("__")[1].split("-")[0]
        m = bpy.data.materials.get(key) or (K.material(key, COLOURS[key], 0.7) if key in COLOURS else A.skin())
        ob.data.materials.clear()
        ob.data.materials.append(m)
    return parts


if __name__ == "__main__":
    K.reset_scene()
    arms = finish(arm("R"))
    legs = finish({**leg("R"), **boot("R")})
    os.makedirs(os.path.dirname(OUT_ARMS), exist_ok=True)
    F.export_only(arms, OUT_ARMS)
    F.export_only(legs, OUT_LEGS)
