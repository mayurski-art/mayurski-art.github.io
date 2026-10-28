"""
Troll Forces - Hollowgrin's light bake (phase 6 of "Troll Forces: Hollowgrin
in Blender", claude.ai/artifact/TkbPnJoMnM7cptWEsevS4k).

Run with:
  NODE_PATH=<main checkout>/node_modules node tools/troll-ops-map-placements.mjs hollowgrin
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python bake_hollowgrin.blender.py [-- name ... | ground]

The hg-* GLBs are finished (build_hollowgrin.blender.py) with the bake's UV
set in them (TEXCOORD_1, tf_kit.lightmap_uv, packed for 1024), so this bakes
them as they are, as Trollface Island's bake does: it stands the whole map up
where hollowgrin.js puts it (hollowgrin-placements.json) and bakes, into
hg-<name>-bake.webp by that UV set, the night sky (the map's hemisphere) and
the fixed lamps, shaded by everything else. The moon stays a real-time light.
Four lamps stay live, and so stay out of the bake (LIVE): the manor's porch,
the carousel, the mausoleum's green and the bonfire (it flickers).

Unbaked: the Studio pieces with no bake UVs (the oak, the skull, the
cauldron, the scarecrow, the bust, Pepe), the ghosts (they drift), the woods'
kit (instanced) and the mannequins. `-- ground` bakes the grass under it all
(hollowgrin-ground-bake.webp) and prints the rect for groundBake.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from bake_kit import bake_ground, bake_lightmap, import_context  # noqa: E402
import importlib.util  # noqa: E402

# Trollface Island's helpers (its .blender.py name isn't importable as is):
# importable() hands Blender a GLB with no TEXCOORD_0 as one it can read,
# shrink() saves a bake again at WebP quality 70
_spec = importlib.util.spec_from_file_location("bake_trollface_island", os.path.join(HERE, "bake_trollface_island.blender.py"))
_tf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_tf)
importable, shrink = _tf.importable, _tf.shrink

SKY = (0x6c78c0, 0x2a1838, 1.1)          # hollowgrin.js hemi.sky over sky.horizon, a little over its 1.25 hemi's half
GROUND = 0x4a5634                        # the grass (ground.colorA)
SAMPLES = 64
LAMP_W = 40                              # watts a candela (REALISM.md)
LIVE = [(0.0, -10.4), (44.5, -4.0), (-28.0, 11.0), (17.8, 12.8)]   # porch, carousel, mausoleum, bonfire
SKIP = {"hg-ghost", "hg-woodkit"}
# models of thousands of small pieces get a few texels a piece at 1024 (the
# manor's porch baked black): these bake at 2048 on the same UV set
RES = {"hg-manor": 2048}


def baked_lights(spec):
    out = []
    for (x, y, z, col, inten, _d) in spec["lights"]:
        if any(abs(x - lx) < 0.3 and abs(z - lz) < 0.3 for lx, lz in LIVE):
            continue
        out.append(((x, y, z), col, inten * LAMP_W, 0.15))
    return out


def main():
    only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    spec = json.load(open(os.path.join(HERE, "hollowgrin-placements.json")))
    lights = baked_lights(spec)
    print("lamps baked", len(lights), "of", len(spec["lights"]))
    places = [p for p in spec["placements"] if p[0].startswith("hg-")]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    by_name = {}
    for (name, x, y, z, yaw, sx, sy, sz) in places:
        objs = import_context([(importable(os.path.join(HERE, name + ".glb")), x, z, yaw, y, (sx, sy, sz))])
        by_name.setdefault(name, []).extend(o for o in objs if o.type == "MESH")
    if only == ["ground"]:
        b = spec["bounds"]
        size = math.ceil((max(b["maxX"] - b["minX"], b["maxZ"] - b["minZ"]) + 24) / 8) * 8
        cx, cz = (b["minX"] + b["maxX"]) / 2, (b["minZ"] + b["maxZ"]) / 2
        rect = (cx - size / 2, cz - size / 2, size)
        path = os.path.join(HERE, "hollowgrin-ground-bake.webp")
        bake_ground(path, rect, res=2048, samples=128, sky=SKY, color=GROUND, blur=2, lights=lights)
        shrink(path)
        print("GROUND BAKE hollowgrin rect: [%g, %g, %g]" % rect)
        return
    # already baked are skipped (delete a bake, or name the model, to redo it)
    want = [n for n in by_name if n not in SKIP
            and (n in only if only else not os.path.exists(os.path.join(HERE, n + "-bake.webp")))]
    done = 0
    for name in want:
        objs = []
        for o in by_name[name]:
            uvs = o.data.uv_layers
            if len(uvs) < 2:
                print(f"NOTE {name}: {o.name} has {len(uvs)} UV layers, left unbaked")
                continue
            uvs[len(uvs) - 1].name = "Lightmap"
            objs.append(o)
        if not objs:
            continue
        bake_lightmap(objs, os.path.join(HERE, name + "-bake.webp"), res=RES.get(name, 1024), samples=SAMPLES,
                      sky=SKY, ground=GROUND, lights=lights, blur=1, uv=False)
        shrink(os.path.join(HERE, name + "-bake.webp"))
        done += 1
        print("BAKED", name, os.path.getsize(os.path.join(HERE, name + "-bake.webp")), flush=True)
    print("HOLLOWGRIN BAKED", done)


if __name__ == "__main__":
    main()
