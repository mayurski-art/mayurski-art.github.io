"""
Carrot Cake Hair for the blocky body (TROLLS HATS / Carrot Cake Hair, first
worn by TROLLS #989; blocky-body.js HAIRS): the black spiked anime hair of
the NFT's art (refs/trolls-goku-dev.png), modelled rather than drawn. A
drawn hat is bent round the head as a thin cap; spikes that stand out past
the head on every side would be paper from the side, so this one is
blocks, like the arms.

    blender --background --python build_blocky_hair.blender.py            # -> models/blocky/hair-carrot-cake.glb
    blender --background --python build_blocky_hair.blender.py -- check   # + review renders, models/_renders/blocky-hair

In the head-relief's frame (build_blocky_head: centred on the face board,
0.48 x 0.45, the face toward -Z), at scale 1: a skull cap over the top and
back that leaves the face clear below the hairline, and the spikes rooted
in it, each its own piece (the game inks each one, so the clumps read).
Every piece is "hair__<n>": the game colours them by name (HAIRS).
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
OUT = os.path.join(K.HERE, "blocky", "hair-carrot-cake.glb")
HEAD_GLB = os.path.join(K.HERE, "blocky", "head-relief.glb")


def hair_mat():
    return bpy.data.materials.get("hair") or K.material("hair", 0x24242a, 0.6)


def outward(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return ob


# ---------------------------------------------------------------- the cap
# (back: 0.05 past the skull, build_blocky_head BACK 0.19; was 0.125 on the 0.075 slab)
CAP = {"c": (0.0, 0.05, 0.02), "rx": 0.245, "ry": 0.235, "front": 0.07, "back": 0.24}


def hairline(phi):
    """How low the cap comes at angle phi round the head (0 the front,
    +-pi the back): above the brows in front, past the ears at the sides,
    down to the nape behind."""
    a = abs(phi) / math.pi                      # 0 front .. 1 back
    # (high round the sides, so no black frames the face like a hood; it
    # drops only behind the ears)
    return 0.18 - 0.40 * (a ** 2.4)


def cap():
    """Rows from the crown down to the hairline exactly, column by column
    round the head (cutting a full ellipsoid's faces left stair steps)."""
    cx, cy, cz = CAP["c"]
    LAT, LON = 16, 48
    verts = []
    for j in range(LAT + 1):
        for i in range(LON):
            ph = -math.pi + 2 * math.pi * i / LON
            # how far down this column goes: the angle from the top where y
            # meets the hairline
            th_max = math.acos(max(-1.0, min(1.0, (hairline(ph) - cy) / CAP["ry"])))
            th = th_max * j / LAT
            z0 = -math.cos(ph)                   # -1 the front (phi 0, game -z), +1 the back
            rz = CAP["front"] if z0 < 0 else CAP["back"]
            verts.append((cx + CAP["rx"] * math.sin(th) * math.sin(ph), cy + CAP["ry"] * math.cos(th), cz + rz * math.sin(th) * z0))
    faces = []
    for j in range(LAT):
        for i in range(LON):
            i2 = (i + 1) % LON
            faces.append([j * LON + i, j * LON + i2, (j + 1) * LON + i2, (j + 1) * LON + i])
    ob = outward(K.mesh_obj("hair__cap", verts, faces, hair_mat(), smooth=True))
    # a little thickness, so its open edge (the hairline) has a lip
    m = ob.modifiers.new("thick", "SOLIDIFY")
    m.thickness = 0.012
    m.offset = 1.0
    K.apply_mods(ob)
    return ob


# ---------------------------------------------------------------- the spikes
def spike(name, base, tip, width, thin=0.6, bend=(0, 0, 0), flat=(0, 0, 1), sides=6, curve=1.0):
    """A blade of hair from `base` (buried in the cap) to a sharp `tip`,
    bowed toward `bend` at its middle; its section a flattened hexagon,
    `width` across and `thin` of that through `flat` (the thin direction)."""
    a, b, k = Vector(base), Vector(tip), Vector(bend)
    ctrl = (a + b) / 2 + k
    pts = lambda t: a * (1 - t) ** 2 + ctrl * 2 * t * (1 - t) + b * t * t
    tan = lambda t: ((ctrl - a) * 2 * (1 - t) + (b - ctrl) * 2 * t).normalized()
    ts = [0.0, 0.18, 0.38, 0.58, 0.76, 0.9]
    verts, faces = [], []
    for t in ts:
        c, T = pts(t), tan(t)
        n = Vector(flat)
        n = (n - T * n.dot(T))
        if n.length < 1e-4:
            n = T.orthogonal()
        n.normalize()
        w = T.cross(n).normalized()
        r = width / 2 * (1 - t) ** curve
        for s in range(sides):
            th = 2 * math.pi * s / sides
            verts.append(c + w * (math.cos(th) * r) + n * (math.sin(th) * r * thin))
    for r in range(len(ts) - 1):
        for s in range(sides):
            s2 = (s + 1) % sides
            faces.append((r * sides + s, r * sides + s2, (r + 1) * sides + s2, (r + 1) * sides + s))
    verts.append(b)
    tipi = len(verts) - 1
    last = (len(ts) - 1) * sides
    for s in range(sides):
        faces.append((last + s, last + (s + 1) % sides, tipi))
    verts.append(a)
    basei = len(verts) - 1
    for s in range(sides):
        faces.append((basei, (s + 1) % sides, s))
    ob = outward(K.mesh_obj(name, [tuple(v) for v in verts], faces, hair_mat(), smooth=False))
    return ob


# (base, tip, width, extra) in the head frame: x the troll's left (+x out to
# the viewer's right from behind), y up, -z the front. Read off the art:
# a crown of tall spikes fanning up and to the viewer's right, long blades
# straight out at the sides at brow height, a fringe of four hanging over
# the forehead, and the back swept out behind.
SPIKES = [
    # the crown, fanning up and out
    ("crown1", (-0.11, 0.21, 0.02), (-0.32, 0.50, 0.03), 0.19, {"bend": (-0.03, 0.03, 0)}),
    ("crown2", (-0.04, 0.24, 0.02), (-0.09, 0.62, 0.04), 0.2, {"bend": (-0.03, 0.0, 0)}),
    ("crown3", (0.04, 0.24, 0.01), (0.20, 0.60, 0.01), 0.2, {"bend": (-0.02, 0.03, 0)}),
    ("crown4", (0.12, 0.20, 0.01), (0.44, 0.47, 0.01), 0.19, {"bend": (-0.02, 0.05, 0)}),
    ("crown5", (0.16, 0.14, 0.02), (0.55, 0.27, 0.02), 0.17, {"bend": (0.0, 0.05, 0)}),
    # the back half of the crown, up and back (depth from the side)
    ("crown6", (-0.06, 0.22, 0.08), (-0.12, 0.52, 0.28), 0.19, {"flat": (1, 0, 0), "bend": (0, 0.03, -0.02)}),
    ("crown7", (0.07, 0.21, 0.08), (0.20, 0.47, 0.30), 0.18, {"flat": (1, 0, 0), "bend": (0, 0.03, -0.02)}),
    # the sides, straight out at brow height
    ("sideL1", (-0.18, 0.14, 0.02), (-0.57, 0.20, 0.02), 0.17, {"bend": (0, 0.04, 0)}),
    ("sideL2", (-0.20, 0.06, 0.03), (-0.51, 0.03, 0.05), 0.14, {"bend": (0, 0.03, 0)}),
    ("sideR2", (0.20, 0.06, 0.03), (0.49, 0.02, 0.05), 0.14, {"bend": (0, 0.03, 0)}),
    # behind
    ("back1", (0.0, 0.16, 0.10), (0.02, 0.32, 0.38), 0.19, {"flat": (0, 1, 0), "bend": (0, 0.04, 0)}),
    ("back2", (-0.12, 0.08, 0.09), (-0.32, 0.09, 0.33), 0.17, {"flat": (0, 1, 0)}),
    ("back3", (0.12, 0.07, 0.09), (0.32, 0.05, 0.33), 0.17, {"flat": (0, 1, 0)}),
    ("back4", (0.0, -0.03, 0.10), (0.02, -0.16, 0.31), 0.16, {"flat": (0, 1, 0), "bend": (0, 0.03, 0)}),
    # the nape, down over the back of the skull
    ("nape1", (-0.09, -0.06, 0.09), (-0.16, -0.22, 0.17), 0.13, {"flat": (0, 0, 1)}),
    ("nape2", (0.09, -0.07, 0.09), (0.15, -0.23, 0.17), 0.13, {"flat": (0, 0, 1)}),
    # the fringe over the forehead, rooted up on the cap so it covers the
    # cap's front edge, hanging a hair in front of the brow
    # (the eyes are at y ~0.09, x +0.10 and -0.05: the locks end above them,
    # one dipping between them, so the trollface's eyes stay clear)
    ("fringe1", (-0.13, 0.23, -0.035), (-0.19, 0.12, -0.08), 0.12, {"thin": 0.5, "bend": (0, 0, -0.015)}),
    ("fringe2", (-0.04, 0.24, -0.04), (-0.09, 0.13, -0.085), 0.12, {"thin": 0.5, "bend": (0, 0, -0.015)}),
    ("fringe3", (0.03, 0.24, -0.04), (0.03, 0.06, -0.09), 0.11, {"thin": 0.5, "bend": (0, 0, -0.02)}),
    ("fringe4", (0.11, 0.23, -0.035), (0.17, 0.13, -0.085), 0.12, {"thin": 0.5, "bend": (0, 0, -0.015)}),
    ("fringe5", (0.17, 0.21, -0.025), (0.25, 0.12, -0.07), 0.1, {"thin": 0.5, "bend": (0, 0, -0.01)}),
    # locks at the temples, down past the eyes beside the face
    ("templeL", (-0.20, 0.17, -0.01), (-0.26, 0.07, -0.035), 0.09, {"thin": 0.5, "flat": (1, 0, 0)}),
    ("templeR", (0.20, 0.17, -0.01), (0.26, 0.07, -0.035), 0.09, {"thin": 0.5, "flat": (1, 0, 0)}),
]


def build():
    parts = {"hair__cap": cap()}
    for name, base, tip, width, kw in SPIKES:
        n = f"hair__{name}"
        parts[n] = spike(n, base, tip, width, **kw)
    return parts


# ---------------------------------------------------------------- review renders
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
    out = os.path.join(K.HERE, "_renders", "blocky-hair")
    os.makedirs(out, exist_ok=True)
    for yaw in (0, 35, 90, 180):
        K.aim(cam, yaw, dist=2.4, height=1.42, target=(0, 0, 1.42))
        sc.render.stamp_note_text = f"  carrot cake hair · {yaw}  "
        sc.render.filepath = os.path.join(out, f"hair{yaw:+04d}.png")
        bpy.ops.render.render(write_still=True)
    print("CHECK", out)


if __name__ == "__main__":
    K.reset_scene()
    P = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    K.export(OUT)
    if ARGS and ARGS[0] == "check":
        check(P)
