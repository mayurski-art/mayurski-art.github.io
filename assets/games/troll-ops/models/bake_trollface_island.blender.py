"""
Troll Forces - Trollface Island's light bake (phase 6 of the doc "Trollface
Island in Blender", claude.ai/artifact/NJA4xfxahS99UL52jrirn4).

Run with:
  NODE_PATH=<main checkout>/node_modules node tools/troll-ops-map-placements.mjs trollface
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python bake_trollface_island.blender.py [-- name ...]

The place GLBs are finished (build_trollface_island.blender.py) with the
bake's UV set already in them (TEXCOORD_1, tf_kit.lightmap_uv), so this bakes
them as they are: it stands the whole island up where the map puts it
(trollface-placements.json), and for each tf-* place bakes the sky light on
it, shaded by every other place, into tf-<place>-bake.webp, laid out by that
UV set (one atlas per GLB). The GLBs are not rewritten. The sun stays a
real-time light; the sky is the map's hemisphere (hemi.sky over
hemi.ground), the bounce plane the grass. The three faces Grinleria's
trollhead exports (tf-cityface, tf-portalface, tf-boatface) have no bake UVs
and stay unbaked, as does the bust. Then the ground: bake_map_ground.blender.py
trollface, and `-- shrink trollface-ground` here.

Each bake is saved again at WebP quality 70 (QUALITY): a light map is smooth,
so it halves for nothing you can see, which keeps the island under its 14 MB.
`-- shrink <name> ...` only does that, to bakes made elsewhere.
"""
import json
import os
import struct
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from bake_kit import bake_lightmap, import_context  # noqa: E402

SKY = (0xcfe6ff, 0x4f7a45, 1.0)          # maps/trollface-island.js hemi: sky over ground
GROUND = 0x5aa84d                        # the meadow
SAMPLES = 64
QUALITY = 70


def shrink(path):
    img = bpy.data.images.load(path)
    img.save(filepath=path, quality=QUALITY)
    bpy.data.images.remove(img)
SKIP = {"tf-cityface", "tf-portalface", "tf-boatface",
        "tf-coast-p3"}                   # the cliffs hang below the bake's ground plane: they'd bake black


def importable(path):
    """Blender's glTF importer drops a TEXCOORD_1 with no TEXCOORD_0 beside
    it, and a place with no textured material (the Portal, the Peak, the
    coast, the Cave, the Boat) exports only its bake UVs. The copy it imports
    lists them as TEXCOORD_0 as well; the GLB itself is not touched."""
    data = open(path, "rb").read()
    n = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + n])
    changed = False
    for m in j.get("meshes", []):
        for prim in m["primitives"]:
            a = prim["attributes"]
            if "TEXCOORD_1" in a and "TEXCOORD_0" not in a:
                a["TEXCOORD_0"] = a["TEXCOORD_1"]
                changed = True
    if not changed:
        return path
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    rest = data[20 + n:]
    out = os.path.join(tempfile.gettempdir(), "tfbake-" + os.path.basename(path))
    with open(out, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + len(rest)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js + rest)
    return out


def main():
    only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if only[:1] == ["shrink"]:
        for name in only[1:]:
            shrink(os.path.join(HERE, name + "-bake.webp"))
        return
    spec = json.load(open(os.path.join(HERE, "trollface-placements.json")))
    places = [p for p in spec["placements"] if p[0].startswith("tf-") or p[0].startswith("hg-")]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    by_name = {}
    for (name, x, y, z, yaw, sx, sy, sz) in places:
        objs = import_context([(importable(os.path.join(HERE, name + ".glb")), x, z, yaw, y, (sx, sy, sz))])
        by_name.setdefault(name, []).extend(o for o in objs if o.type == "MESH")
    # already baked are skipped (delete a bake, or name the place, to redo it)
    want = [n for n in by_name if n.startswith("tf-") and n not in SKIP
            and (n in only if only else not os.path.exists(os.path.join(HERE, n + "-bake.webp")))]
    for name in want:
        objs = []
        for o in by_name[name]:
            uvs = o.data.uv_layers
            if len(uvs) < 2:             # a piece with no bake UVs (a canvas's frame): shades the rest, stays unbaked
                print(f"NOTE {name}: {o.name} has {len(uvs)} UV layers, left unbaked")
                continue
            uvs[len(uvs) - 1].name = "Lightmap"
            objs.append(o)
        if not objs:
            continue
        bake_lightmap(objs, os.path.join(HERE, name + "-bake.webp"), res="auto", samples=SAMPLES,
                      sky=SKY, ground=GROUND, blur=1, uv=False)
        shrink(os.path.join(HERE, name + "-bake.webp"))
    print("TROLLFACE ISLAND BAKED", len(want))


if __name__ == "__main__":
    main()
