"""
The posable hand's mesh (characters/rig-hand.js), cut from MakeHuman's base
body (user, 2026-10-21: "we need realistic hands"; the hand sheet in
refs/trolls-1718-hand-poses.webp). Roblox Studio's generator refuses hands
and a hand built from capsules read as a mannequin's, so this takes a real
one: MakeHuman's hm08 base mesh and its default rig's skin weights, both
released CC0 (the MPFB add-on ships them).

    blender --background --python build_rig_hand.blender.py      # -> models/hands/rig-hand.json
      env MPFB_DATA (the add-on's data folder; found under %APPDATA% by default)
      env MH_TARGETS "path:weight,..." (MakeHuman targets applied first; default TARGETS)

What it writes: the right hand from a little up the forearm, smoothed once
(a Catmull-Clark level, the weights carried through), in the hand's own
frame in metres (game coords): the wrist joint at the origin, the fingers
down -Y, the back of the hand +X, the palm -X, the thumb to the front -Z.
JSON, not a GLB, because rig-hand.js binds it to its own bones: `joints`
(root, then index middle ring little thumb, 0..2 each, in rig-hand.js's
bone order) and the mesh's `position`, `normal`, `index`, `skinIndex` and
`skinWeight` (four per vertex, into that bone order).
"""
import glob
import gzip
import json
import os
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_kit as K  # noqa: E402

OUT = os.path.join(K.HERE, "hands", "rig-hand.json")


def mpfb_data():
    if os.environ.get("MPFB_DATA"):
        return os.environ["MPFB_DATA"]
    base = os.path.join(os.environ.get("APPDATA", ""), "Blender Foundation", "Blender")
    hits = glob.glob(os.path.join(base, "*", "extensions", "*", "mpfb", "data", "3dobjs", "base.obj"))
    if not hits:
        sys.exit("MakeHuman's MPFB add-on not found: set MPFB_DATA")
    return os.path.dirname(os.path.dirname(sorted(hits)[-1]))


# MakeHuman's bones (default rig, right side) -> rig-hand.js's, in its order
BONES = ["root",
         "index0", "index1", "index2", "middle0", "middle1", "middle2",
         "ring0", "ring1", "ring2", "little0", "little1", "little2",
         "thumb0", "thumb1", "thumb2"]
MH = {"wrist.R": "root", "metacarpal1.R": "root", "metacarpal2.R": "root", "metacarpal3.R": "root", "metacarpal4.R": "root",
      "lowerarm02.R": "root", "lowerarm01.R": "root"}
for n, name in ((1, "thumb"), (2, "index"), (3, "middle"), (4, "ring"), (5, "little")):
    for k in range(3):
        MH[f"finger{n}-{k + 1}.R"] = f"{name}{k}"
# where each bone's head is: MakeHuman's joint helpers (small cubes in base.obj)
HEADS = {"root": "joint-r-hand"}
for n, name in ((1, "thumb"), (2, "index"), (3, "middle"), (4, "ring"), (5, "little")):
    for k in range(3):
        HEADS[f"{name}{k}"] = f"joint-r-finger-{n}-{k + 1}"
HAND = {b for b in MH if b not in ("lowerarm01.R", "lowerarm02.R")}
FOREARM = 0.045     # metres of forearm kept above the wrist (it runs up into the arm's cut)
# MakeHuman's own shape targets, applied to the base body before the cut:
# the sheet's hands are a grown man's, chunkier than the neutral base's
TARGETS = "macrodetails/universal-male-young-maxmuscle-maxweight:1,hands/r-hand-fingers-diameter-incr:1,hands/measure-wrist-circ-incr:0.5"


def apply_targets(data, verts):
    spec = os.environ.get("MH_TARGETS", TARGETS)
    for item in filter(None, spec.split(",")):
        rel, w = item.rsplit(":", 1)
        path = os.path.join(data, "targets", rel + ".target.gz")
        with gzip.open(path, "rt") as f:
            for line in f:
                p = line.split()
                if len(p) == 4 and not line.startswith("#"):
                    verts[int(p[0])] += Vector((float(p[1]), float(p[2]), float(p[3]))) * float(w)
        print("target", rel, w)


def read_obj(path):
    verts, faces, groups, cur = [], [], {}, None
    with open(path) as f:
        for line in f:
            if line.startswith("v "):
                verts.append(Vector([float(x) for x in line.split()[1:4]]))
            elif line.startswith("g "):
                cur = line.split()[1]
            elif line.startswith("f "):
                ids = [int(t.split("/")[0]) - 1 for t in line.split()[1:]]
                if cur == "body":
                    faces.append(ids)
                else:
                    groups.setdefault(cur, set()).update(ids)
    return verts, faces, groups


def build():
    data = mpfb_data()
    verts, faces, groups = read_obj(os.path.join(data, "3dobjs", "base.obj"))
    apply_targets(data, verts)
    with open(os.path.join(data, "rigs", "standard", "weights.default.json")) as f:
        weights = json.load(f)["weights"]
    centre = lambda g: sum((verts[i] for i in groups[g]), Vector()) / len(groups[g])
    # MakeHuman's units are decimetres, Y up
    J = {b: centre(c) * 0.1 for b, c in HEADS.items()}
    # the hand's frame: Y back up the hand from the middle knuckle, Z from
    # the index's knuckle to the little finger's, X out of the back
    o = J["root"]
    y = (o - J["middle0"]).normalized()
    z = (J["little0"] - J["index0"])
    z = (z - y * z.dot(y)).normalized()
    x = y.cross(z)
    R = Matrix((x, y, z))                    # rows: world -> hand
    to_hand = lambda p: R @ (p * 0.1 - o)

    # per vertex: rig-hand bone weights, and how much of it is the hand
    vw = {}
    for bone, pairs in weights.items():
        if bone not in MH:
            continue
        for vi, w in pairs:
            d = vw.setdefault(vi, {})
            d[MH[bone]] = d.get(MH[bone], 0) + w
            if bone in HAND:
                d["_hand"] = d.get("_hand", 0) + w
    keep = set()
    for vi, d in vw.items():
        p = to_hand(verts[vi])
        if d.get("_hand", 0) > 0.02 or (p.y <= FOREARM and p.length < 0.12 and sum(v for k, v in d.items() if k != "_hand") > 0.5):
            keep.add(vi)
    hand_faces = [f for f in faces if all(i in keep for i in f)]
    used = sorted({i for f in hand_faces for i in f})
    remap = {vi: n for n, vi in enumerate(used)}

    # into Blender to smooth it once (the weights ride along as vertex groups)
    K.reset_scene()
    me = bpy.data.meshes.new("hand")
    me.from_pydata([tuple(K.B(to_hand(verts[vi]))) for vi in used], [], [[remap[i] for i in f] for f in hand_faces])
    me.validate()
    ob = bpy.data.objects.new("hand", me)
    bpy.context.scene.collection.objects.link(ob)
    vg = {b: ob.vertex_groups.new(name=b) for b in BONES}
    for vi in used:
        for b, w in vw[vi].items():
            if b != "_hand" and w > 0:
                vg[b].add([remap[vi]], w, "ADD")
    m = ob.modifiers.new("sub", "SUBSURF")
    m.levels = 1
    m.boundary_smooth = "PRESERVE_CORNERS"
    K.apply_mods(ob)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    me = ob.data
    for p in me.polygons:
        p.use_smooth = True
    me.update()

    inv = K.RX.inverted()
    G = lambda v: (inv @ Vector(v).to_4d()).to_3d()      # Blender -> game
    pos, nrm, si, sw = [], [], [], []
    names = [g.name for g in ob.vertex_groups]
    for v in me.vertices:
        p = G(v.co)
        n = (inv.to_3x3() @ v.normal).normalized()
        pos += [round(c, 4) for c in p]
        nrm += [round(c, 3) for c in n]
        ws = sorted(((g.weight, BONES.index(names[g.group])) for g in v.groups if g.weight > 0.002), reverse=True)[:4]
        tot = sum(w for w, _ in ws) or 1.0
        ws = (ws or [(1.0, 0)]) + [(0.0, 0)] * 4
        si += [b for _, b in ws[:4]]
        sw += [round(w / tot, 3) for w, _ in ws[:4]]
    idx = [i for p in me.polygons for i in p.vertices]
    out = {
        "source": "MakeHuman hm08 base mesh + default rig weights (CC0), right hand; models/build_rig_hand.blender.py",
        "targets": os.environ.get("MH_TARGETS", TARGETS),
        "bones": BONES,
        "joints": {b: [round(c, 5) for c in to_hand(J[b] * 10)] for b in BONES},
        "position": pos, "normal": nrm, "index": idx, "skinIndex": si, "skinWeight": sw,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print("EXPORT", OUT, "verts", len(me.vertices), "tris", len(idx) // 3, "bytes", os.path.getsize(OUT))
    for b in BONES:
        print(" ", b, out["joints"][b])


build()
