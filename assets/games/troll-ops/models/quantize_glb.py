"""
Shrinks the map GLBs the Blender scripts export, in place, with no
dependencies (plain Python):

  - vertex colours  float RGBA  -> normalized unsigned-byte RGBA
  - normals         float XYZ   -> normalized signed-byte XYZ (+ pad)
  - UVs dropped on materials the game never textures (everything not in
    map-models.js RETEXTURE: the flat GS_Paint and the emissive lamps),
    except TEXCOORD_1, the baked light map's (bake_kit.py), which every
    material keeps, as normalized unsigned shorts

Positions stay float, unless main(..., positions=True) (Kabukigrin's build):
then each mesh's positions are 16-bit normalized round its centre, the
node's translation and uniform scale undoing it (uniform, so normals need
nothing): 84 m across in 1.3 mm steps. Byte normals need KHR_mesh_quantization, which
three.js's GLTFLoader supports; it is added to extensionsUsed/Required.
A model that is already quantized is left alone; positions_only() then
quantizes just its float positions, the same way, every other view kept byte
for byte (Trollface Island's places, after their bakes: the bake UVs and so
the light maps are untouched).

  python quantize_glb.py gl-shell.glb gl-shops.glb ...
  python quantize_glb.py --positions tf-city-p1.glb ...
"""
import json
import math
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FLOAT, BYTE, UBYTE, SHORT, USHORT, UINT = 5126, 5120, 5121, 5122, 5123, 5125
SIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
COUNT = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def textured_names():
    src = open(os.path.join(HERE, "..", "maps", "map-models.js"), encoding="utf8").read()
    block = src[src.index("export const RETEXTURE"):]
    block = block[:block.index("};")]
    return set(re.findall(r"^\s*(\w+):\s*\[", block, re.M))


def read_glb(path):
    d = open(path, "rb").read()
    magic, ver, total = struct.unpack("<III", d[:12])
    assert magic == 0x46546C67, "not a glb"
    jlen = struct.unpack("<I", d[12:16])[0]
    j = json.loads(d[20:20 + jlen])
    off = 20 + jlen
    blen = struct.unpack("<I", d[off:off + 4])[0]
    bin_ = d[off + 8:off + 8 + blen]
    return j, bin_


def write_glb(path, j, bin_):
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    bin_ += b"\0" * ((4 - len(bin_) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942) + bin_)


def accessor_values(j, bin_, ai):
    a = j["accessors"][ai]
    bv = j["bufferViews"][a["bufferView"]]
    n, comps, ct = a["count"], COUNT[a["type"]], a["componentType"]
    size = SIZE[ct]
    stride = bv.get("byteStride") or comps * size
    base = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    fmt = {5126: "f", 5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I"}[ct]
    out = []
    for i in range(n):
        o = base + i * stride
        out.append(struct.unpack_from("<" + fmt * comps, bin_, o))
    return out


def main(paths, positions=False):
    keep_uv = textured_names()
    for path in paths:
        j, bin_ = read_glb(path)
        if "KHR_mesh_quantization" in j.get("extensionsUsed", []):
            print(path, "already quantized")
            continue
        before = os.path.getsize(path)
        new_bin = bytearray()
        new_views, new_accs = [], []
        remap = {}

        def add_view(data, stride=None, target=None):
            while len(new_bin) % 4:
                new_bin.append(0)
            v = {"buffer": 0, "byteOffset": len(new_bin), "byteLength": len(data)}
            if stride:
                v["byteStride"] = stride
            if target:
                v["target"] = target
            new_bin.extend(data)
            new_views.append(v)
            return len(new_views) - 1

        def copy_accessor(ai, target=None):
            if ("copy", ai) in remap:
                return remap[("copy", ai)]
            a = dict(j["accessors"][ai])
            vals = accessor_values(j, bin_, ai)
            ct, comps = a["componentType"], COUNT[a["type"]]
            fmt = {5126: "f", 5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I"}[ct]
            data = b"".join(struct.pack("<" + fmt * comps, *v) for v in vals)
            a["bufferView"] = add_view(data, target=target)
            a.pop("byteOffset", None)
            new_accs.append(a)
            remap[("copy", ai)] = len(new_accs) - 1
            return remap[("copy", ai)]

        def color_accessor(ai):
            a = j["accessors"][ai]
            vals = accessor_values(j, bin_, ai)
            norm = a["componentType"] != FLOAT
            div = 255.0 if a["componentType"] == UBYTE else 65535.0 if a["componentType"] == USHORT else 1.0
            data = bytearray()
            for v in vals:
                c = [x / div if norm else x for x in v] + [1.0] * (4 - len(v))
                # glTF vertex colours are linear; keep them linear in 8 bits
                data += bytes(max(0, min(255, round(x * 255))) for x in c[:4])
            new_accs.append({"bufferView": add_view(bytes(data), stride=4, target=34962), "componentType": UBYTE,
                             "normalized": True, "count": a["count"], "type": "VEC4"})
            return len(new_accs) - 1

        def uv01_accessor(ai):
            # a light-map UV lies in 0..1: 16 bits each is plenty
            a = j["accessors"][ai]
            vals = accessor_values(j, bin_, ai)
            data = bytearray()
            for (u, v) in vals:
                data += struct.pack("<HH", *(max(0, min(65535, round(c * 65535))) for c in (u, v)))
            new_accs.append({"bufferView": add_view(bytes(data), stride=4, target=34962), "componentType": USHORT,
                             "normalized": True, "count": a["count"], "type": "VEC2"})
            return len(new_accs) - 1

        def normal_accessor(ai):
            a = j["accessors"][ai]
            vals = accessor_values(j, bin_, ai)
            data = bytearray()
            for (x, y, z) in vals:
                data += struct.pack("<bbbb", *(max(-127, min(127, round(c * 127))) for c in (x, y, z)), 0)
            new_accs.append({"bufferView": add_view(bytes(data), stride=4, target=34962), "componentType": BYTE,
                             "normalized": True, "count": a["count"], "type": "VEC3"})
            return len(new_accs) - 1

        # positions=True: each mesh's frame (centre, half-size)
        frames = {}
        if positions:
            for mi, mesh in enumerate(j["meshes"]):
                lo, hi = [math.inf] * 3, [-math.inf] * 3
                for prim in mesh["primitives"]:
                    a = j["accessors"][prim["attributes"]["POSITION"]]
                    for k in range(3):
                        lo[k], hi[k] = min(lo[k], a["min"][k]), max(hi[k], a["max"][k])
                frames[mi] = ([(lo[k] + hi[k]) / 2 for k in range(3)], max((hi[k] - lo[k]) / 2 for k in range(3)) or 1.0)

        def position_accessor(ai, mi):
            c, s = frames[mi]
            vals = accessor_values(j, bin_, ai)
            data = bytearray()
            lo, hi = [32767] * 3, [-32767] * 3
            for v in vals:
                q = [max(-32767, min(32767, round((v[k] - c[k]) / s * 32767))) for k in range(3)]
                for k in range(3):
                    lo[k], hi[k] = min(lo[k], q[k]), max(hi[k], q[k])
                data += struct.pack("<hhhh", *q, 0)
            new_accs.append({"bufferView": add_view(bytes(data), stride=8, target=34962), "componentType": SHORT,
                             "normalized": True, "count": len(vals), "type": "VEC3", "min": lo, "max": hi})
            return len(new_accs) - 1

        for mi, mesh in enumerate(j["meshes"]):
            for prim in mesh["primitives"]:
                mat = j["materials"][prim["material"]]["name"] if "material" in prim else ""
                # a piece named by its Studio key ("glb:<model>:<material>|<tint>|...",
                # Kabukigrin's club) is textured as its material is
                if mat.startswith("glb:"):
                    mat = mat.split("|")[0].split(":")[-1]
                # a material with its own picture keeps its UVs whatever its name
                pbr = j["materials"][prim["material"]].get("pbrMetallicRoughness", {}) if "material" in prim else {}
                own_map = "baseColorTexture" in pbr
                attrs = {}
                for k, ai in prim["attributes"].items():
                    if k == "POSITION" and positions:
                        attrs[k] = position_accessor(ai, mi)
                    elif k == "COLOR_0":
                        attrs[k] = color_accessor(ai)
                    elif k == "NORMAL":
                        attrs[k] = normal_accessor(ai)
                    elif k == "TEXCOORD_1":
                        attrs[k] = uv01_accessor(ai)
                    elif k.startswith("TEXCOORD") and mat not in keep_uv and not own_map:
                        continue
                    else:
                        attrs[k] = copy_accessor(ai, target=34962)
                prim["attributes"] = attrs
                if "indices" in prim:
                    prim["indices"] = copy_accessor(prim["indices"], target=34963)
        # an embedded picture (Kabukigrin's Studio pieces) keeps its bytes in a
        # view of its own
        for img in j.get("images", []):
            if "bufferView" in img:
                v = j["bufferViews"][img["bufferView"]]
                o = v.get("byteOffset", 0)
                img["bufferView"] = add_view(bytes(bin_[o:o + v["byteLength"]]))
        # anything else that points at accessors (animations, skins) we don't
        # make; refuse rather than corrupt
        assert not j.get("animations") and not j.get("skins"), \
            "animated or skinned GLBs are not handled"
        for node in j.get("nodes", []):
            if "mesh" in node and node["mesh"] in frames:
                assert not any(k in node for k in ("translation", "rotation", "scale", "matrix")), "a placed node"
                c, s = frames[node["mesh"]]
                node["translation"], node["scale"] = c, [s, s, s]
        j["accessors"] = new_accs
        j["bufferViews"] = new_views
        j["buffers"] = [{"byteLength": len(new_bin)}]
        for key in ("extensionsUsed", "extensionsRequired"):
            j[key] = sorted(set(j.get(key, [])) | {"KHR_mesh_quantization"})
        write_glb(path, j, bytes(new_bin))
        print(f"{os.path.basename(path)}: {before} -> {os.path.getsize(path)} bytes")


def positions_only(paths):
    for path in paths:
        j, bin_ = read_glb(path)
        before = os.path.getsize(path)
        meshes = {}
        for mi, mesh in enumerate(j["meshes"]):
            accs = [prim["attributes"]["POSITION"] for prim in mesh["primitives"]]
            if all(j["accessors"][ai]["componentType"] == FLOAT for ai in accs):
                meshes[mi] = accs
        if not meshes:
            print(path, "positions already quantized")
            continue
        new_bin = bytearray()
        moved = {}

        def put(data):
            while len(new_bin) % 4:
                new_bin.append(0)
            o = len(new_bin)
            new_bin.extend(data)
            return o

        float_views = {j["accessors"][ai]["bufferView"] for accs in meshes.values() for ai in accs}
        views = []
        for vi, v in enumerate(j["bufferViews"]):
            if vi in float_views:
                continue
            o = v.get("byteOffset", 0)
            nv = dict(v, byteOffset=put(bin_[o:o + v["byteLength"]]))
            moved[vi] = len(views)
            views.append(nv)
        for img in j.get("images", []):
            if "bufferView" in img:
                img["bufferView"] = moved[img["bufferView"]]
        for a in j["accessors"]:
            if a.get("bufferView") in moved:
                a["bufferView"] = moved[a["bufferView"]]
        for node in j.get("nodes", []):
            if node.get("mesh") not in meshes:
                continue
            assert not any(k in node for k in ("translation", "rotation", "scale", "matrix")), "a placed node"
            accs = meshes[node["mesh"]]
            lo = [min(j["accessors"][ai]["min"][k] for ai in accs) for k in range(3)]
            hi = [max(j["accessors"][ai]["max"][k] for ai in accs) for k in range(3)]
            c = [(lo[k] + hi[k]) / 2 for k in range(3)]
            sc = max((hi[k] - lo[k]) / 2 for k in range(3)) or 1.0
            for ai in dict.fromkeys(accs):
                vals = accessor_values(j, bin_, ai)
                data = bytearray()
                qlo, qhi = [32767] * 3, [-32767] * 3
                for v in vals:
                    q = [max(-32767, min(32767, round((v[k] - c[k]) / sc * 32767))) for k in range(3)]
                    for k in range(3):
                        qlo[k], qhi[k] = min(qlo[k], q[k]), max(qhi[k], q[k])
                    data += struct.pack("<hhhh", *q, 0)
                views.append({"buffer": 0, "byteOffset": put(bytes(data)), "byteLength": len(data), "byteStride": 8, "target": 34962})
                j["accessors"][ai] = {"bufferView": len(views) - 1, "componentType": SHORT, "normalized": True,
                                      "count": len(vals), "type": "VEC3", "min": qlo, "max": qhi}
            node["translation"], node["scale"] = c, [sc, sc, sc]
        j["bufferViews"] = views
        j["buffers"] = [{"byteLength": len(new_bin)}]
        write_glb(path, j, bytes(new_bin))
        print(f"{os.path.basename(path)}: {before} -> {os.path.getsize(path)} bytes (positions)")


if __name__ == "__main__":
    if sys.argv[1:2] == ["--positions"]:
        positions_only(sys.argv[2:])
    else:
        main(sys.argv[1:])
