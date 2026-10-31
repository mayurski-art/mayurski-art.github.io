"""
Horny for the blocky body (TROLLS HATS / Horny, first worn by TROLLS #2531;
blocky-body.js HAIRS): the two red devil horns of the NFT's art
(refs/trolls-2531.png), modelled rather than drawn. A drawn hat is bent
round the head as a thin cap; horns that stand up off the skull's corners
would be paper from the side, so they're solid, like the Carrot Cake
spikes (build_blocky_hair.blender.py).

    blender --background --python build_blocky_horns.blender.py            # -> models/blocky/horns.glb
    blender --background --python build_blocky_horns.blender.py -- check   # + review renders, models/_renders/blocky-horns

In the head-relief's frame (build_blocky_head: centred on the face board,
0.48 x 0.45, the face toward -Z), at scale 1: each horn is rooted in the
skull at its upper corner and curves up and out to a point, a darker ring
at its base where the NFT's shading sits. Every piece is "horn__<n>" or
"hornbase__<n>": the game colours them by name (HAIRS).
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_kit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.join(K.HERE, "blocky", "horns.glb")
HEAD_GLB = os.path.join(K.HERE, "blocky", "head-relief.glb")


def mat(name, color):
    return bpy.data.materials.get(name) or K.material(name, color, 0.55)


def outward(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return ob


def horn(name, base, tip, width, bend, material, t0=0.0, t1=1.0, sides=14, curve=0.85):
    """A round horn from `base` (buried in the skull) to a sharp `tip`,
    bowed toward `bend` at its middle; only the stretch t0..t1 of it (the
    base ring is the first bit, a shade darker), tapering to the point."""
    a, b, k = Vector(base), Vector(tip), Vector(bend)
    ctrl = (a + b) / 2 + k
    pts = lambda t: a * (1 - t) ** 2 + ctrl * 2 * t * (1 - t) + b * t * t
    tan = lambda t: ((ctrl - a) * 2 * (1 - t) + (b - ctrl) * 2 * t).normalized()
    n = 7
    ts = [t0 + (t1 - t0) * i / n for i in range(n + 1)]
    closed = t1 >= 0.999
    if closed:
        ts = ts[:-1]
    verts, faces = [], []
    for t in ts:
        c, T = pts(t), tan(t)
        u = T.orthogonal().normalized()
        w = T.cross(u).normalized()
        r = width / 2 * (1 - t) ** curve
        for s in range(sides):
            th = 2 * math.pi * s / sides
            verts.append(c + w * (math.cos(th) * r) + u * (math.sin(th) * r))
    for ring in range(len(ts) - 1):
        for s in range(sides):
            s2 = (s + 1) % sides
            faces.append((ring * sides + s, ring * sides + s2, (ring + 1) * sides + s2, (ring + 1) * sides + s))
    last = (len(ts) - 1) * sides
    if closed:
        verts.append(b)
        tipi = len(verts) - 1
        for s in range(sides):
            faces.append((last + s, last + (s + 1) % sides, tipi))
    else:
        verts.append(pts(t1))
        endi = len(verts) - 1
        for s in range(sides):
            faces.append((last + s, last + (s + 1) % sides, endi))
    verts.append(a if t0 <= 0 else pts(t0))
    basei = len(verts) - 1
    for s in range(sides):
        faces.append((basei, (s + 1) % sides, s))
    return outward(K.mesh_obj(name, [tuple(v) for v in verts], faces, material, smooth=True))


# Read off the art (the head 450 px wide there, 0.48 m here): each horn
# about a fifth of the head tall, rooted at the skull's upper corner
# (build_blocky_hair CAP: centre (0, 0.05, 0.02), 0.245 x 0.235), leaning
# out, curving up to a point that turns a little back in.
HORNS = [
    # name, base, tip, width, bend
    # (the face board's top corners hide a horn rooted lower: these rise
    # clear of them, the dark ring just above the skull)
    ("L", (-0.16, 0.13, 0.03), (-0.245, 0.27, 0.0), 0.06, (-0.03, 0.0, 0.0)),
    ("R", (0.16, 0.13, 0.03), (0.245, 0.27, 0.0), 0.06, (0.03, 0.0, 0.0)),
]


def build():
    red, dark = mat("horn", 0xd0381c), mat("hornbase", 0x7e1d10)
    parts = {}
    for n, base, tip, width, bend in HORNS:
        # the dark base ring: from the buried root to just above the skull,
        # a hair wider so it reads
        parts[f"hornbase__{n}"] = horn(f"hornbase__{n}", base, tip, width * 1.06, bend, dark, 0.0, 0.50)
        parts[f"horn__{n}"] = horn(f"horn__{n}", base, tip, width, bend, red, 0.48, 1.0)
    return parts


def check(parts):
    bpy.ops.import_scene.gltf(filepath=HEAD_GLB)
    for ob in bpy.context.selected_objects:
        ob.name = "REF_" + ob.name
        ob.location = K.B((0, 1.3, 0))
        ob.data.materials.clear()
        ob.data.materials.append(bpy.data.materials.get("REF_Skin") or K.material("REF_Skin", 0xf3f3ef, 0.6))
    for ob in parts.values():
        ob.location = K.B((0, 1.3, 0))
    sc = bpy.context.scene
    cam = K.render_setup(samples=int(os.environ.get("TR_SAMPLES", 24)))
    out = os.path.join(K.HERE, "_renders", "blocky-horns")
    os.makedirs(out, exist_ok=True)
    for yaw in (0, 35, 90, 180):
        K.aim(cam, yaw, dist=2.4, height=1.42, target=(0, 0, 1.42))
        sc.render.stamp_note_text = f"  horns · {yaw}  "
        sc.render.filepath = os.path.join(out, f"horns{yaw:+04d}.png")
        bpy.ops.render.render(write_still=True)
    print("CHECK", out)


if __name__ == "__main__":
    K.reset_scene()
    P = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    K.export(OUT)
    if ARGS and ARGS[0] == "check":
        check(P)
