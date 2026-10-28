"""
Shrinks an exported GLB with KHR_mesh_quantization (three.js's GLTFLoader
and Blender's importer read it as is, no decoder): positions as 16-bit
integers under one uniform scale and offset on the mesh's node (about a
millimetre over a whole station), normals as 8-bit, the second UV set (the
light or occlusion map's, 0..1) and the vertex colours as 16-bit, and the
first UV set, where the primitive's material has no texture (flat paint
never reads it), pointed at the second's data instead of stored (Blender's
importer reads TEXCOORD_n from 0 up, so the bake still finds layer 1).
Indices, images and everything else are copied.

  from glb_quantize import quantize_glb; quantize_glb(path)
  blender --background --python glb_quantize.py -- a.glb b.glb

Undergrin's build calls it on every ug-*.glb (map_kit finish(quantize=True);
doc "Troll Forces: Undergrin in Blender", the budget's guards). Needs only
numpy and json, so it runs inside Blender's Python as it is.
"""
import json
import struct
import sys

import numpy as np

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def _read(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, ver, total = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "not a GLB"
    jl, jt = struct.unpack_from("<II", data, 12)
    j = json.loads(data[20:20 + jl].decode("utf-8"))
    off = 20 + jl
    bin_ = b""
    if off < len(data):
        bl, bt = struct.unpack_from("<II", data, off)
        bin_ = data[off + 8:off + 8 + bl]
    return j, bin_


def _write(path, j, bin_):
    js = json.dumps(j, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    bin_ += b"\0" * ((4 - len(bin_) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942))
        f.write(bin_)


def _accessor(j, bin_, i):
    a = j["accessors"][i]
    bv = j["bufferViews"][a["bufferView"]]
    dt = np.dtype(COMP[a["componentType"]])
    n = NCOMP[a["type"]]
    stride = bv.get("byteStride", dt.itemsize * n)
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    if stride == dt.itemsize * n:
        arr = np.frombuffer(bin_, dtype=dt, count=a["count"] * n, offset=start).reshape(a["count"], n)
    else:
        rows = [np.frombuffer(bin_, dtype=dt, count=n, offset=start + k * stride) for k in range(a["count"])]
        arr = np.array(rows)
    return arr.astype(np.float64)


def quantize_glb(path, out=None):
    j, bin_ = _read(path)
    if "KHR_mesh_quantization" in j.get("extensionsUsed", []):
        return path
    textured = set()
    for k, m in enumerate(j.get("materials", [])):
        pbr = m.get("pbrMetallicRoughness", {})
        if any(t in pbr for t in ("baseColorTexture", "metallicRoughnessTexture")) or any(
                t in m for t in ("normalTexture", "emissiveTexture", "occlusionTexture")):
            textured.add(k)
    # the bufferViews the vertex attributes live in are rebuilt; the rest copied
    attr_views = set()
    for mesh in j["meshes"]:
        for p in mesh["primitives"]:
            for acc in p["attributes"].values():
                attr_views.add(j["accessors"][acc]["bufferView"])
    chunks, views = [], []

    def push(data, stride=None, target=None):
        pos = sum(len(c) for c in chunks)
        pad = (4 - pos % 4) % 4
        if pad:
            chunks.append(b"\0" * pad)
            pos += pad
        chunks.append(data)
        v = {"buffer": 0, "byteOffset": pos, "byteLength": len(data)}
        if stride:
            v["byteStride"] = stride
        if target:
            v["target"] = target
        views.append(v)
        return len(views) - 1
    remap = {}
    for i, bv in enumerate(j["bufferViews"]):
        if i in attr_views:
            continue
        o = bv.get("byteOffset", 0)
        nv = dict(bv)
        remap[i] = push(bin_[o:o + bv["byteLength"]], bv.get("byteStride"), bv.get("target"))
        nv.update(views[remap[i]])
        views[remap[i]] = nv
    for a in j["accessors"]:
        if a.get("bufferView") in remap:
            a["bufferView"] = remap[a["bufferView"]]
    for im in j.get("images", []):
        if "bufferView" in im:
            im["bufferView"] = remap[im["bufferView"]]
    accessors = j["accessors"]

    def add_acc(arr, comp, typ, normalized=False, minmax=False):
        dt = np.dtype(COMP[comp])
        n = NCOMP[typ]
        size = dt.itemsize * n
        stride = (size + 3) // 4 * 4
        buf = np.zeros((len(arr), stride), dtype=np.uint8)
        buf[:, :size] = np.ascontiguousarray(arr.astype(dt)).view(np.uint8).reshape(len(arr), size)
        bv = push(buf.tobytes(), stride, 34962)
        acc = {"bufferView": bv, "componentType": comp, "count": int(len(arr)), "type": typ}
        if normalized:
            acc["normalized"] = True
        if minmax:
            acc["min"] = [int(v) for v in arr.min(axis=0)]
            acc["max"] = [int(v) for v in arr.max(axis=0)]
        accessors.append(acc)
        return len(accessors) - 1
    users = {}
    for ni, node in enumerate(j["nodes"]):
        if "mesh" in node:
            users.setdefault(node["mesh"], []).append(ni)
    for mi, mesh in enumerate(j["meshes"]):
        nodes = users.get(mi, [])
        assert len(nodes) == 1, "mesh %d is on %d nodes" % (mi, len(nodes))
        node = j["nodes"][nodes[0]]
        assert not any(k in node for k in ("matrix", "rotation", "scale")) and not any(node.get("translation", [0, 0, 0])), \
            "mesh %d's node has a transform" % mi
        pos = [_accessor(j, bin_, p["attributes"]["POSITION"]) for p in mesh["primitives"]]
        lo = np.min([p.min(axis=0) for p in pos], axis=0)
        hi = np.max([p.max(axis=0) for p in pos], axis=0)
        centre = (lo + hi) / 2
        step = max(float((hi - lo).max()) / 65534.0, 1e-6)
        node["translation"] = [float(v) for v in centre]
        node["scale"] = [step, step, step]
        for p, P in zip(mesh["primitives"], pos):
            at = p["attributes"]
            q = np.clip(np.round((P - centre) / step), -32767, 32767)
            new = {"POSITION": add_acc(q, 5122, "VEC3", minmax=True)}
            if "NORMAL" in at:
                N = _accessor(j, bin_, at["NORMAL"])
                N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
                new["NORMAL"] = add_acc(np.round(N * 127), 5120, "VEC3", normalized=True)
            for k, v in at.items():
                if k in ("POSITION", "NORMAL"):
                    continue
                A = _accessor(j, bin_, v)
                if k == "TEXCOORD_0" and p.get("material") not in textured:
                    continue
                if k.startswith("TEXCOORD") and A.min() >= 0.0 and A.max() <= 1.0:
                    new[k] = add_acc(np.round(A * 65535), 5123, "VEC2", normalized=True)
                elif k.startswith("COLOR") and A.min() >= 0.0 and A.max() <= 1.0:
                    new[k] = add_acc(np.round(A * 65535), 5123, j["accessors"][v]["type"], normalized=True)
                else:
                    new[k] = add_acc(A, 5126, j["accessors"][v]["type"], minmax=False)
            # the first UV slot shares the second's data where it was dropped:
            # no bytes, and Blender's importer (which reads TEXCOORD_n from 0
            # up) still finds the occlusion set as layer 1
            if "TEXCOORD_0" not in new and "TEXCOORD_1" in new:
                new = {"TEXCOORD_0": new["TEXCOORD_1"], **new}
            p["attributes"] = new
    # drop the accessors nothing points at any more, renumbering the rest
    used = set()
    for mesh in j["meshes"]:
        for p in mesh["primitives"]:
            used.update(p["attributes"].values())
            if "indices" in p:
                used.add(p["indices"])
    for sk in j.get("skins", []):
        if "inverseBindMatrices" in sk:
            used.add(sk["inverseBindMatrices"])
    for an in j.get("animations", []):
        for smp in an["samplers"]:
            used.update((smp["input"], smp["output"]))
    keep = sorted(used)
    ren = {o: k for k, o in enumerate(keep)}
    j["accessors"] = [accessors[o] for o in keep]
    for mesh in j["meshes"]:
        for p in mesh["primitives"]:
            p["attributes"] = {k: ren[v] for k, v in p["attributes"].items()}
            if "indices" in p:
                p["indices"] = ren[p["indices"]]
    # and the bufferViews nothing points at
    vused = sorted({a["bufferView"] for a in j["accessors"] if "bufferView" in a} | {im["bufferView"] for im in j.get("images", []) if "bufferView" in im})
    vren = {o: k for k, o in enumerate(vused)}
    j["bufferViews"] = [views[o] for o in vused]
    for a in j["accessors"]:
        if "bufferView" in a:
            a["bufferView"] = vren[a["bufferView"]]
    for im in j.get("images", []):
        if "bufferView" in im:
            im["bufferView"] = vren[im["bufferView"]]
    # the bytes, compacted in the new order
    whole = b"".join(chunks)
    out_chunks, pos = [], 0
    for v in j["bufferViews"]:
        pad = (4 - pos % 4) % 4
        if pad:
            out_chunks.append(b"\0" * pad)
            pos += pad
        out_chunks.append(whole[v["byteOffset"]:v["byteOffset"] + v["byteLength"]])
        v["byteOffset"] = pos
        pos += v["byteLength"]
    new_bin = b"".join(out_chunks)
    j["buffers"] = [{"byteLength": len(new_bin) + (4 - len(new_bin) % 4) % 4}]
    for key in ("extensionsUsed", "extensionsRequired"):
        j.setdefault(key, [])
        if "KHR_mesh_quantization" not in j[key]:
            j[key].append("KHR_mesh_quantization")
    _write(out or path, j, new_bin)
    return out or path


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    import os
    for a in args:
        before = os.path.getsize(a)
        quantize_glb(a)
        print("quantized %s: %.3f -> %.3f MB" % (a, before / 1e6, os.path.getsize(a) / 1e6))
