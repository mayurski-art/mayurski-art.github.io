"""
Muscular arms for the blocky body (blocky-body.js, preview mockup). User,
2026-10-11: "focus on the arms ... work closely on blender ... make the
arms muscular".

    blender --background --python build_blocky_arms.blender.py              # -> models/blocky/arms-muscle.glb
    blender --background --python build_blocky_arms.blender.py -- check     # + review renders, models/_renders/blocky-arms
      env TR_SAMPLES (render samples, default 32)

The muscles are BLOCKS, like the rest of the body: chamfered, slightly
tapered boxes, overlapping where the muscles do, each its own piece so each
gets its own ink outline in the game. (v1 sculpted round masses on a tube:
they read as soft clay next to the hard boxes of the torso and legs.)

Each piece is authored for the RIGHT arm in its own joint's frame, in game
coords at scale 1: origin at the joint, the bone straight down -Y, +X out
(away from the body), -Z the front. blocky-body.js lines -Y up with the
live bone and stretches each piece to its length; the L pieces are mirrors.
    arm<S>__*     on the arm pivot (the shoulder), bone 0.30 long
    elbow<S>__*   on the elbow, bone 0.325 long (to the hand)
    hand<S>__*    on the hand joint (the wrist)
"""
import os
import sys

import bpy
import bmesh

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_kit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.join(K.HERE, "blocky", "arms-muscle.glb")
UPPER, FORE = 0.30, 0.325          # bone lengths at scale 1 (blocky rig, build 0.25)


def skin():
    return bpy.data.materials.get("Skin") or K.material("Skin", 0xf3f3ef, 0.6)


def outward(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return ob


def slab(name, levels, bevel=0.02, segs=3):
    """A block through `levels` [(y, width out, depth, ox, oz)] top to bottom:
    a box whose section changes down its length (a muscle's belly is a level
    wider than the ends), every edge rounded by `bevel`."""
    vs, fs = [], []
    for y, w, d, ox, oz in levels:
        vs += [(ox + sx * w / 2, y, oz + sz * d / 2) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for i in range(len(levels) - 1):
        a, b = 4 * i, 4 * (i + 1)
        fs += [(a + k, a + (k + 1) % 4, b + (k + 1) % 4, b + k) for k in range(4)]
    n = 4 * (len(levels) - 1)
    fs += [(0, 3, 2, 1), (n, n + 1, n + 2, n + 3)]
    ob = outward(K.mesh_obj(name, vs, fs, skin(), smooth=False))
    m = ob.modifiers.new("bev", "BEVEL")
    m.width = bevel
    m.segments = segs
    m.profile = 0.6          # a touch fuller than round: pillowy, not chamfered
    m.harden_normals = True
    wn = ob.modifiers.new("wn", "WEIGHTED_NORMAL")
    wn.keep_sharp = True
    K.apply_mods(ob)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


# ---------------------------------------------------------------- the pieces
def upper_arm(S):
    """Shoulder to elbow: the core, the deltoid cap over the shoulder (top
    level with the torso's, wider than the arm, its point tucking in a third
    of the way down), the biceps on the front, the triceps behind."""
    # levels: (y, width out, depth, x out, z back); the front is -z
    return {
        # v3: the core is slimmer than the muscles on it, so each muscle
        # breaks the silhouette (and gets its own ink line in the game)
        f"arm{S}__upper": slab(f"arm{S}__upper", [
            (0.0, 0.115, 0.115, 0, 0), (-0.15, 0.112, 0.11, 0, 0), (-0.31, 0.104, 0.104, 0, 0.004)], bevel=0.024),
        f"arm{S}__delt": slab(f"arm{S}__delt", [
            (0.05, 0.15, 0.15, 0.006, 0), (-0.02, 0.196, 0.182, 0.02, 0), (-0.165, 0.10, 0.11, 0.02, 0)], bevel=0.034, segs=4),
        # the biceps' belly: a level wider and further forward than its ends
        f"arm{S}__bicep": slab(f"arm{S}__bicep", [
            (-0.08, 0.09, 0.05, 0.002, -0.045), (-0.17, 0.114, 0.09, 0.004, -0.06), (-0.275, 0.08, 0.05, 0, -0.045)], bevel=0.03, segs=4),
        # the triceps' peak sits higher, under the deltoid, and flares out the
        # side (its outer head: the bump under the shoulder seen from the front)
        f"arm{S}__tricep": slab(f"arm{S}__tricep", [
            (-0.03, 0.11, 0.05, 0.012, 0.042), (-0.12, 0.13, 0.085, 0.016, 0.052), (-0.24, 0.085, 0.045, 0.004, 0.044)], bevel=0.028, segs=4),
    }


def forearm(S):
    """Elbow to wrist: heavy under the elbow, its belly pushed out the
    front-outside (the brachioradialis), narrowing hard to a squarish wrist.
    (A separate swell block read as a plate stuck on.)"""
    return {
        f"elbow{S}__fore": slab(f"elbow{S}__fore", [
            (0.035, 0.11, 0.11, 0, 0), (-0.09, 0.148, 0.144, 0.016, -0.013), (-0.33, 0.09, 0.1, 0, 0)], bevel=0.03, segs=4),
    }


def fist(S):
    """A clenched fist hanging at the side, as wide as the wrist and then
    some, down -Y from the wrist: the back of the hand out (+X), a knuckle
    ridge on the outside-bottom edge, the thumb across the front."""
    return {
        f"hand{S}__fist": slab(f"hand{S}__fist", [
            (0.0, 0.098, 0.118, 0, -0.002), (-0.06, 0.104, 0.126, 0.002, -0.002), (-0.125, 0.1, 0.122, 0, -0.002)], bevel=0.026, segs=4),
        f"hand{S}__knuckles": slab(f"hand{S}__knuckles", [
            (-0.07, 0.05, 0.12, 0.03, -0.004), (-0.132, 0.05, 0.122, 0.03, -0.004)], bevel=0.018),
        f"hand{S}__thumb": slab(f"hand{S}__thumb", [
            (-0.025, 0.052, 0.032, -0.014, -0.064), (-0.1, 0.048, 0.03, -0.014, -0.064)], bevel=0.013),
    }


def build():
    parts = {**upper_arm("R"), **forearm("R"), **fist("R")}
    for n, ob in list(parts.items()):
        ln = n.replace("R__", "L__")
        parts[ln] = K.mirror_x(ob, ln)
        parts[ln].data.materials.clear()
        parts[ln].data.materials.append(skin())
    return parts


# ---------------------------------------------------------------- review renders
# The blocky rig at rest (build 0.25, legs 0.67): chest 1.083, the arm pivots
# out at the torso's sides.
CHEST, PIV_X = 1.083, 0.265


def place(parts):
    for n, ob in parts.items():
        side = 1 if "R__" in n else -1
        joint = n.split("__")[0][:-1]
        y = {"arm": CHEST, "elbow": CHEST - UPPER, "hand": CHEST - UPPER - FORE}[joint]
        ob.location = K.B((side * PIV_X, y, 0))


def context_body():
    """Stand-ins for the rest of the blocky body (REF_, never exported)."""
    tank = K.material("REF_Tank", 0x78ec1c, 0.8)
    shorts = K.material("REF_Shorts", 0x34363e, 0.8)
    white = K.material("REF_Skin", 0xf3f3ef, 0.6)
    hip = CHEST - 0.48
    K.box("REF_torso", (0, CHEST + 0.04 - 0.26, 0), (0.4, 0.52, 0.2), tank)
    for s in (-1, 1):
        K.box(f"REF_thigh{s}", (s * 0.1, hip - 0.1, 0), (0.2, 0.2, 0.2), shorts)
        K.box(f"REF_shin{s}", (s * 0.1, hip - 0.4, 0), (0.194, 0.4, 0.194), white)
    K.ico("REF_head", (0, CHEST + 0.25, 0), 0.16, white, sub=3, scale=(1.05, 1, 0.55))


def check(parts):
    place(parts)
    context_body()
    sc = bpy.context.scene
    cam = K.render_setup(samples=int(os.environ.get("TR_SAMPLES", 32)))
    out = os.path.join(K.HERE, "_renders", "blocky-arms")
    os.makedirs(out, exist_ok=True)
    shots = [("body", y, 3.0, 1.0, (0, 0, 0.75)) for y in (0, 35, 90, 180)]
    shots += [("arm", y, 1.25, 0.95, (0.27, 0, 0.85)) for y in (60, 110)]
    for kind, yaw, dist, h, tgt in shots:
        K.aim(cam, yaw, dist=dist, height=h, target=tgt)
        sc.render.stamp_note_text = f"  blocky arms · {kind} {yaw}  "
        sc.render.filepath = os.path.join(out, f"{kind}{yaw:+04d}.png")
        bpy.ops.render.render(write_still=True)
    print("CHECK", out)


if __name__ == "__main__":   # build_blocky_torso imports slab() and build() for its renders
    K.reset_scene()
    P = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    K.export(OUT)
    if ARGS and ARGS[0] == "check":
        check(P)
