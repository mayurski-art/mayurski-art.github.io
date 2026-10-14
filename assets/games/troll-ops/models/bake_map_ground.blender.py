"""
Troll Forces — a map's ground light map (stylised realism, REALISM.md).

Run with:
  blender --background --python bake_map_ground.blender.py -- <mapId>

Reads <mapId>-placements.json (tools/troll-ops-map-placements.mjs: every
model the map places, its bounds and bake colours), stands the finished
models up where the map puts them, and bakes the sky light on the ground
from above into <mapId>-ground-bake.webp. maps.js gives the map
groundBake: { file: "<mapId>-ground", rect } with the rect printed here;
the game projects it onto the ground plane by world x/z.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from map_kit import OUT_DIR  # noqa: E402
from bake_kit import bake_ground, import_context, remove_context  # noqa: E402


def main():
    map_id = sys.argv[sys.argv.index("--") + 1]
    with open(os.path.join(OUT_DIR, map_id + "-placements.json")) as f:
        spec = json.load(f)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    b = spec["bounds"]
    # the game's ground plane is the bounds plus 12 m a side; a square on it
    size = math.ceil((max(b["maxX"] - b["minX"], b["maxZ"] - b["minZ"]) + 24) / 8) * 8
    cx, cz = (b["minX"] + b["maxX"]) / 2, (b["minZ"] + b["maxZ"]) / 2
    rect = (cx - size / 2, cz - size / 2, size)
    ctx = import_context([
        (os.path.join(OUT_DIR, name + ".glb"), x, z, yaw, y, (sx, sy, sz))
        for (name, x, y, z, yaw, sx, sy, sz) in spec["placements"]
        if os.path.exists(os.path.join(OUT_DIR, name + ".glb"))
    ])
    up, horizon = spec["sky"]
    bake_ground(os.path.join(OUT_DIR, map_id + "-ground-bake.webp"), rect,
                res=2048 if size > 64 else 1024, samples=128,
                sky=(up or 0x8aa2cc, horizon or up or 0x8aa2cc, 1.0), color=spec["ground"] or 0x808080, blur=2)
    remove_context(ctx)
    print("GROUND BAKE", map_id, "rect: [%g, %g, %g]" % rect)


main()
