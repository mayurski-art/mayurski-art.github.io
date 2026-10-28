"""
Troll Forces - Undergrin, the Metro (2025) station, headless Blender.
Doc: "Troll Forces: Undergrin in Blender" (claude.ai/artifact/M7gvL8E3RboNCNp3PMkePM).

Run with:
  node tools/troll-ops-undergrin-layout.mjs          # maps/undergrin.js -> undergrin-layout.json
  blender --background --python build_undergrin.blender.py            (all seven)
  blender --background --python build_undergrin.blender.py -- shell trains

Writes ug-<name>.glb into this folder (shell, platforms, escalators, trains,
concourse, shops, plant), each drawn by its own module (ug_<name>.py) with
the kit and the station's numbers in ug_kit.py, in MAP coordinates (placed
at 0,0). The playable layout is the contract: the build reads
undergrin-layout.json (the game's own colliders, stairs links and spawns)
and refuses to run when maps/undergrin.js has changed since it was dumped.
After all seven, the registry writes undergrin-faces.json (the obstruction
test) and, once props need them, undergrin-signs.json and
maps/undergrin-props.js.

The look is the "modded" full-bright Metro: every material is a flat colour
(none in map-models.js RETEXTURE, so it all folds into vertex paint), no
textures, no lights in the map: tube lights, EXIT signs, the GRINLINE board
and the pendant lamps are emissive paint. Each GLB carries a second UV set
("Lightmap", TEXCOORD_1) for the occlusion bake (decision 1 of the doc).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ug_kit import REG, load_layout, check_layout, assert_layout, ug_palette, write_registry  # noqa: E402
import ug_shell  # noqa: E402
import ug_platforms  # noqa: E402
import ug_escalators  # noqa: E402
import ug_trains  # noqa: E402
import ug_concourse  # noqa: E402
import ug_shops  # noqa: E402
import ug_plant  # noqa: E402

BUILDERS = {"shell": ug_shell.build_shell, "platforms": ug_platforms.build_platforms, "escalators": ug_escalators.build_escalators,
            "trains": ug_trains.build_trains, "concourse": ug_concourse.build_concourse, "shops": ug_shops.build_shops,
            "plant": ug_plant.build_plant}

if __name__ == "__main__":
    want = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(BUILDERS)
    layout = load_layout()
    check_layout(layout)
    assert_layout(layout)
    PAL = ug_palette()
    for name in want:
        BUILDERS[name](PAL)
    if set(want) == set(BUILDERS):
        write_registry(REG)
    else:
        print("registry not written: build all seven for undergrin-faces.json")
