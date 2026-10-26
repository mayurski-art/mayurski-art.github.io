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
trollface.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from bake_kit import bake_lightmap, import_context  # noqa: E402

SKY = (0xcfe6ff, 0x4f7a45, 1.0)          # maps/trollface-island.js hemi: sky over ground
GROUND = 0x5aa84d                        # the meadow
SAMPLES = 64
SKIP = {"tf-cityface", "tf-portalface", "tf-boatface"}


def main():
    only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    spec = json.load(open(os.path.join(HERE, "trollface-placements.json")))
    places = [p for p in spec["placements"] if p[0].startswith("tf-") or p[0].startswith("hg-")]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    by_name = {}
    for (name, x, y, z, yaw, sx, sy, sz) in places:
        objs = import_context([(os.path.join(HERE, name + ".glb"), x, z, yaw, y, (sx, sy, sz))])
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
    print("TROLLFACE ISLAND BAKED", len(want))


if __name__ == "__main__":
    main()
