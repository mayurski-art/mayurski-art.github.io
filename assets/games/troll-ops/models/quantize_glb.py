"""
Shrinks the map GLBs the Blender scripts export, in place, with no
dependencies (plain Python):

  - vertex colours  float RGBA  -> normalized unsigned-byte RGBA
  - normals         float XYZ   -> normalized signed-byte XYZ (+ pad)
  - UVs dropped on materials the game never textures (everything not in
    map-models.js RETEXTURE: the flat GS_Paint and the emissive lamps)

Positions stay float. Byte normals need KHR_mesh_quantization, which
three.js's GLTFLoader supports; it is added to extensionsUsed/Required.
A model that is already quantized is left alone.

  python quantize_glb.py gl-shell.glb gl-shops.glb ...
"""
import json
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FLOAT, BYTE, UBYTE, USHORT, UINT = 5126, 5120, 5121, 5123, 5125
SIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
COUNT = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def textured_names():
    src = open(os.path.join(HERE, "..", "map-models.js"), encoding="utf8").read()
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


def main(paths):
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

        def normal_accessor(ai):
            a = j["accessors"][ai]
            vals = accessor_values(j, bin_, ai)
            data = bytearray()
            for (x, y, z) in vals:
                data += struct.pack("<bbbb", *(max(-127, min(127, round(c * 127))) for c in (x, y, z)), 0)
            new_accs.append({"bufferView": add_view(bytes(data), stride=4, target=34962), "componentType": BYTE,
                             "normalized": True, "count": a["count"], "type": "VEC3"})
            return len(new_accs) - 1

        for mesh in j["meshes"]:
            for prim in mesh["primitives"]:
                mat = j["materials"][prim["material"]]["name"] if "material" in prim else ""
                attrs = {}
                for k, ai in prim["attributes"].items():
                    if k == "COLOR_0":
                        attrs[k] = color_accessor(ai)
                    elif k == "NORMAL":
                        attrs[k] = normal_accessor(ai)
                    elif k.startswith("TEXCOORD") and mat not in keep_uv:
                        continue
                    else:
                        attrs[k] = copy_accessor(ai, target=34962)
                prim["attributes"] = attrs
                if "indices" in prim:
                    prim["indices"] = copy_accessor(prim["indices"], target=34963)
        # anything else that points at accessors (animations, skins) we don't
        # make; refuse rather than corrupt
        assert not j.get("animations") and not j.get("skins") and not j.get("images"), \
            "animated, skinned or image-carrying GLBs are not handled"
        j["accessors"] = new_accs
        j["bufferViews"] = new_views
        j["buffers"] = [{"byteLength": len(new_bin)}]
        for key in ("extensionsUsed", "extensionsRequired"):
            j[key] = sorted(set(j.get(key, [])) | {"KHR_mesh_quantization"})
        write_glb(path, j, bytes(new_bin))
        print(f"{os.path.basename(path)}: {before} -> {os.path.getsize(path)} bytes")


if __name__ == "__main__":
    main(sys.argv[1:])
