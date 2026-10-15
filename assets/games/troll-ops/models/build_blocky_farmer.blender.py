"""
The Farmer's arms and legs for the blocky body (blocky-body.js KITS
"clothes-farmer"): TROLLS CLOTHES / Farmer, first worn by TROLLS #820. User,
2026-10-15: the full farmer, plaid long sleeves and denim overalls to the
boots. Every token with the Farmer trait wears these.

    blender --background --python build_blocky_farmer.blender.py   # -> models/blocky/arms-farmer.glb, legs-farmer.glb

Built like the muscular arms and legs (build_blocky_arms.slab: chamfered
blocks, each its own piece with its own ink outline in the game), but
CLOTHED: the sleeves and trouser legs hang a little loose over where the
muscles were, so they read as cloth on the arm, not skin.

The game colours each piece by its name after "__" (up to a "-"):
    sleeve, cuff   the shirt's check (blocky-body.js plaidMaterial: a tile
                   per 0.12 m on box-projected UVs, the check 60 mm like
                   the torso's template, traits/src/clothes-farmer.block.svg)
    denim, hem     the overalls; boot, sole the work boots
    fist, knuckles, thumb   skin
Pieces for the RIGHT side (+X out, -Z front) in their joint's frame at
scale 1, the bone straight down -Y; L pieces are mirrors. The joints and
bone lengths are the muscular ones' (build_blocky_arms / _legs).
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
OUT_ARMS = os.path.join(K.HERE, "blocky", "arms-farmer.glb")
OUT_LEGS = os.path.join(K.HERE, "blocky", "legs-farmer.glb")
TILE = 0.12        # one tile of the check, metres (blocky-body.js plaidMaterial)


def box_uvs(ob):
    """Box-project UVs, one unit a TILE: each face takes the plane its
    normal points most along, so the check runs straight on every side."""
    me = ob.data
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            u, v = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][ax]
            uv.data[li].uv = (u / TILE, v / TILE)
    return ob


# ---------------------------------------------------------------- the arms
def arm(S):
    """levels: (y, width out, depth, x out, z back); the front is -z."""
    return {
        # the upper sleeve: loose over the biceps and triceps, a touch fuller
        # at the top where the shoulder seam sits
        f"arm{S}__sleeve": A.slab(f"arm{S}__sleeve", [
            (0.0, 0.17, 0.165, 0.008, 0), (-0.15, 0.158, 0.156, 0.008, 0), (-0.315, 0.138, 0.138, 0.002, 0.004)], bevel=0.03, segs=4),
        # the shoulder: the sleeve's cap over the deltoid
        f"arm{S}__sleeve-cap": A.slab(f"arm{S}__sleeve-cap", [
            (0.05, 0.15, 0.15, 0.006, 0), (-0.02, 0.198, 0.184, 0.02, 0), (-0.13, 0.16, 0.16, 0.016, 0)], bevel=0.034, segs=4),
        # the forearm's sleeve, down to the cuff
        f"elbow{S}__sleeve-fore": A.slab(f"elbow{S}__sleeve-fore", [
            (0.04, 0.142, 0.142, 0, 0), (-0.09, 0.152, 0.15, 0.01, -0.008), (-0.25, 0.128, 0.13, 0, 0)], bevel=0.03, segs=4),
        # the buttoned cuff at the wrist, a little tighter and squarer
        f"elbow{S}__cuff": A.slab(f"elbow{S}__cuff", [
            (-0.235, 0.134, 0.138, 0, 0), (-0.33, 0.124, 0.13, 0, 0)], bevel=0.016),
        **A.fist(S),
    }


# ---------------------------------------------------------------- the legs
def leg(S):
    return {
        # overalls: straight, loose legs, flush with each other at the top
        # (each half the torso's width, like the shorts were)
        f"thigh{S}__denim": A.slab(f"thigh{S}__denim", [
            (0.06, 0.198, 0.198, 0, 0), (-0.15, 0.2, 0.204, 0.002, -0.002), (-0.315, 0.184, 0.19, 0, 0)], bevel=0.03, segs=4),
        f"knee{S}__denim-shin": A.slab(f"knee{S}__denim-shin", [
            (0.04, 0.182, 0.19, 0, 0), (-0.12, 0.176, 0.184, 0, 0.004), (-0.22, 0.172, 0.18, 0, 0)], bevel=0.028, segs=4),
        # the rolled hem over the boot tops
        f"knee{S}__hem": A.slab(f"knee{S}__hem", [
            (-0.2, 0.186, 0.194, 0, 0), (-0.262, 0.186, 0.194, 0, 0)], bevel=0.014),
    }


def boot(S):
    """A work boot on the ankle (not stretched): a tall shaft under the hem,
    a round toe, a thick dark sole with a heel."""
    return {
        f"ankle{S}__boot": A.slab(f"ankle{S}__boot", [
            (0.13, 0.15, 0.17, 0, 0.016), (0.06, 0.162, 0.2, 0, 0.0), (0.03, 0.168, 0.25, 0, -0.035)], bevel=0.03, segs=4),
        f"ankle{S}__sole": A.slab(f"ankle{S}__sole", [
            (0.032, 0.176, 0.262, 0, -0.035), (-0.014, 0.178, 0.266, 0, -0.035)], bevel=0.012, segs=3),
    }


COLOURS = {"sleeve": 0xf6f3ee, "cuff": 0xf6f3ee, "denim": 0x3f6fa6, "hem": 0x2f5a8c, "boot": 0x6b4423, "sole": 0x2a2420}


def finish(parts):
    for n, ob in list(parts.items()):
        ln = n.replace("R__", "L__")
        parts[ln] = K.mirror_x(ob, ln)
    for n, ob in parts.items():
        key = n.split("__")[1].split("-")[0]
        m = bpy.data.materials.get(key) or (K.material(key, COLOURS[key], 0.7) if key in COLOURS else A.skin())
        ob.data.materials.clear()
        ob.data.materials.append(m)
        if key in ("sleeve", "cuff"):
            box_uvs(ob)
    return parts


def export_only(parts, path):
    for ob in bpy.context.scene.objects:
        ob.hide_set(ob.name not in parts)
    names = set(parts)
    keep = [ob for ob in bpy.context.scene.objects if ob.name in names]
    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    # K.export selects every non-REF mesh: park the others as REF_ for this file
    renamed = []
    for ob in bpy.context.scene.objects:
        if ob.type == "MESH" and ob not in keep and not ob.name.startswith("REF_"):
            renamed.append((ob, ob.name))
            ob.name = "REF_" + ob.name
    K.export(path)
    for ob, name in renamed:
        ob.name = name


if __name__ == "__main__":
    K.reset_scene()
    arms = finish({**arm("R")})
    legs = finish({**leg("R"), **boot("R")})
    os.makedirs(os.path.dirname(OUT_ARMS), exist_ok=True)
    export_only(arms, OUT_ARMS)
    export_only(legs, OUT_LEGS)
