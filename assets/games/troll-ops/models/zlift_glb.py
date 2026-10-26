"""
Pulls apart the surfaces of a map GLB that would z-fight (user, 2026-10-26:
"some spots in the map actually seem to glitch a little like the water
fountain and road"): faces that face the same way, on parallel planes less
than NEAR apart (0 included), that overlap. The game's camera (near 0.05,
far 300) can't tell those apart past a few tens of metres, so they flicker.

Faces are taken by axis (floors and decals, ceilings, walls), in islands
(the faces of one flat piece, joined by shared corners on one plane). For
two islands that overlap that close, the one further along the faces' normal
(or, on one plane, the smaller: the decal on the floor, the water in the
basin) moves out to CLEAR past the other; the faces that meet its edges at
right angles (a box's sides under its top) are stretched to it, so nothing
opens. Only positions change: the UVs, the bake's included, stay, so the
light maps still fit. In place, every POSITION accessor kept as it was
(float, or 16-bit round the node's centre: quantize_glb.py).

  python zlift_glb.py tf-city-p1.glb ...
"""
import bisect
import json
import math
import struct
import sys
from collections import defaultdict

from quantize_glb import read_glb, write_glb, accessor_values

NEAR = 0.012          # m: closer than this, two overlapping faces flicker
CLEAR = 0.015         # m: moved this far past the other
MIN_AREA = 0.01       # m2: smaller overlaps don't show
FLOAT, SHORT = 5126, 5122


def lift(path):
    j, bin_ = read_glb(path)
    bin_ = bytearray(bin_)
    # the vertices of every primitive, in model metres; the node's transform per mesh
    frames = {}
    for node in j.get("nodes", []):
        if "mesh" in node:
            frames[node["mesh"]] = (node.get("translation", [0, 0, 0]), node.get("scale", [1, 1, 1]))
    verts = {}          # accessor -> list of [x, y, z]
    tris = []           # (accessor, i0, i1, i2)
    for mi, mesh in enumerate(j["meshes"]):
        t, s = frames.get(mi, ([0, 0, 0], [1, 1, 1]))
        for prim in mesh["primitives"]:
            ai = prim["attributes"]["POSITION"]
            if ai not in verts:
                a = j["accessors"][ai]
                vals = accessor_values(j, bin_, ai)
                if a["componentType"] == SHORT:
                    vals = [[max(-1.0, v[k] / 32767.0) * s[k] + t[k] for k in range(3)] for v in vals]
                verts[ai] = [list(v) for v in vals]
            idx = [r[0] for r in accessor_values(j, bin_, prim["indices"])] if "indices" in prim else list(range(len(verts[ai])))
            for i in range(0, len(idx) - 2, 3):
                tris.append((ai, idx[i], idx[i + 1], idx[i + 2]))

    def normal(tri):
        ai, a, b, c = tri
        P = verts[ai]
        u = [P[b][k] - P[a][k] for k in range(3)]
        v = [P[c][k] - P[a][k] for k in range(3)]
        n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        L = math.sqrt(sum(x * x for x in n))
        return n, L

    key = lambda p: (round(p[0], 4), round(p[1], 4), round(p[2], 4))   # noqa: E731
    moved_total = 0
    for ax in range(3):
        o = [k for k in range(3) if k != ax]
        for sign in (1, -1):
            # this direction's faces, joined into flat islands by shared corners
            faces = []
            for tri in tris:
                n, L = normal(tri)
                if L < 1e-9 or sign * n[ax] / L < 0.999:
                    continue
                P = verts[tri[0]]
                d = P[tri[1]][ax]
                if ax == 1 and sign < 0 and d < 0.05:
                    continue              # a box's bottom on the ground: never seen
                faces.append((tri, d, L / 2))
            parent = list(range(len(faces)))

            def find(i):
                while parent[i] != i:
                    parent[i] = parent[parent[i]]
                    i = parent[i]
                return i
            corner = {}
            for fi, (tri, d, _) in enumerate(faces):
                P = verts[tri[0]]
                for vi in tri[1:]:
                    k = key(P[vi])
                    if k in corner:
                        parent[find(fi)] = find(corner[k])
                    else:
                        corner[k] = fi
            islands = defaultdict(list)
            for fi in range(len(faces)):
                islands[find(fi)].append(fi)
            isl = []
            for members in islands.values():
                d = sum(faces[f][1] for f in members) / len(members)
                area = sum(faces[f][2] for f in members)
                boxes = []
                for f in members:
                    tri = faces[f][0]
                    P = verts[tri[0]]
                    pts = [P[v] for v in tri[1:]]
                    boxes.append(([min(p[o[0]] for p in pts), min(p[o[1]] for p in pts)], [max(p[o[0]] for p in pts), max(p[o[1]] for p in pts)]))
                lo = [min(b[0][0] for b in boxes), min(b[0][1] for b in boxes)]
                hi = [max(b[1][0] for b in boxes), max(b[1][1] for b in boxes)]
                isl.append({"d": d, "area": area, "faces": members, "boxes": boxes, "lo": lo, "hi": hi})
            # which faces touch each corner (the sides to stretch with a moved island)
            by_key = defaultdict(list)
            for ti, tri in enumerate(tris):
                P = verts[tri[0]]
                for v in tri[1:]:
                    by_key[key(P[v])].append(ti)
            # in order along the normal: each that lies too close past (or on) an
            # overlapping one moves out to CLEAR past it
            order = sorted(range(len(isl)), key=lambda i: sign * isl[i]["d"])

            def overlap(a, b):
                if a["lo"][0] >= b["hi"][0] or b["lo"][0] >= a["hi"][0] or a["lo"][1] >= b["hi"][1] or b["lo"][1] >= a["hi"][1]:
                    return 0.0
                tot = 0.0
                for (l0, h0) in a["boxes"]:
                    for (l1, h1) in b["boxes"]:
                        w = min(h0[0], h1[0]) - max(l0[0], l1[0])
                        h = min(h0[1], h1[1]) - max(l0[1], l1[1])
                        if w > 0 and h > 0:
                            tot += w * h
                            if tot > MIN_AREA:
                                return tot
                return tot
            along = [sign * isl[i]["d"] for i in order]
            for n_, i in enumerate(order):
                A = isl[i]
                lo_ = bisect.bisect_left(along, sign * A["d"] - NEAR - 1e-6)
                hi_ = bisect.bisect_right(along, sign * A["d"] + NEAR + 1e-6)
                for k in order[lo_:hi_]:
                    if k == i:
                        continue
                    B = isl[k]
                    gap = sign * (A["d"] - B["d"])
                    if gap < 0 or gap >= NEAR:
                        continue
                    # on one plane the smaller moves; else the one further out
                    if gap == 0 and (A["area"], i) > (B["area"], k):
                        continue
                    if overlap(A, B) <= MIN_AREA:
                        continue
                    target = B["d"] + sign * CLEAR
                    shift = target - A["d"]
                    # move the island's corners, and every vertex standing at one
                    # of them on a face at right angles (its sides follow)
                    at = set()
                    for f in A["faces"]:
                        tri = faces[f][0]
                        P = verts[tri[0]]
                        for v in tri[1:]:
                            at.add(key(P[v]))
                    own = {faces[f][0] for f in A["faces"]}
                    for ti in {t_ for kk in at for t_ in by_key.get(kk, ())}:
                        tri = tris[ti]
                        P = verts[tri[0]]
                        ks = [key(P[v]) for v in tri[1:]]
                        n, L = normal(tri)
                        if tri not in own and L > 1e-9 and abs(n[ax]) / L > 0.999:
                            continue          # a parallel face (the other island, a neighbour): stays
                        for v, kk in zip(tri[1:], ks):
                            if kk in at:
                                P[v][ax] = target if (abs(P[v][ax] - A["d"]) < 0.003) else P[v][ax]   # (16-bit positions: within a step)
                    A["d"] = target
                    moved_total += 1
                    break
    # write the positions back where they were
    for ai, P in verts.items():
        a = j["accessors"][ai]
        bv = j["bufferViews"][a["bufferView"]]
        ct = a["componentType"]
        stride = bv.get("byteStride") or (12 if ct == FLOAT else 6)
        base = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        mesh_of = next(mi for mi, m in enumerate(j["meshes"]) for p in m["primitives"] if p["attributes"]["POSITION"] == ai)
        t, s = frames.get(mesh_of, ([0, 0, 0], [1, 1, 1]))
        lo, hi = [math.inf] * 3, [-math.inf] * 3
        for i, p in enumerate(P):
            o = base + i * stride
            if ct == FLOAT:
                struct.pack_into("<fff", bin_, o, *p)
                vals = p
            else:
                vals = [max(-32767, min(32767, round((p[k] - t[k]) / s[k] * 32767))) for k in range(3)]
                struct.pack_into("<hhh", bin_, o, *vals)
            for k in range(3):
                lo[k], hi[k] = min(lo[k], vals[k]), max(hi[k], vals[k])
        a["min"], a["max"] = lo, hi
    write_glb(path, j, bytes(bin_))
    print(f"{path}: {moved_total} surfaces pulled apart")
    return moved_total


if __name__ == "__main__":
    for p in sys.argv[1:]:
        lift(p)
