"""
Troll Forces - Hollowgrin (the Halloween map, versus and Zombies), headless
Blender. Design doc: claude.ai/artifact/TkbPnJoMnM7cptWEsevS4k.

Run with:
  node tools/troll-ops-hollowgrin-layout.mjs --check     # the layout -> hollowgrin-layout.json
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python build_hollowgrin.blender.py [-- name ...]

Writes Hollowgrin's models, hg-<name>.glb, into this folder in MAP
coordinates (maps/hollowgrin.js places them at the origin; the carousel's
ride, the horse, the bust and Pepe in their own frames), shrinks them with
quantize_glb.py, and on a full build writes hollowgrin-faces.json (the
obstruction test's faces, eye regions and prop bounds) and
hollowgrin-build.json (the layout hash the art was drawn from, every GLB's
size, triangles and bounds).

Phase 2: the graveyard (hg_graveyard.py, hg-graveyard.glb) and the west
edge (hg_west.py).

Phase 1: Grinmoor Manor (hg_manor.py, hg-manor.glb) and the square
(hg_village.py, hg-square.glb), drawn over the JS's colliders; the JS that
drew them is gone (it keeps the colliders and what glows).

Phase 0 (the builder): the 15 GLBs are drawn by the old builders' own
functions, triangle for triangle (hg_legacy_village.py: the mausoleum, barn
and candy shop; build_grinmoor.blender.py: the park; the eggs script: the
bust and Pepe), through hg_kit.HGBuilder so each GLB carries the bake's
second UV set. The bust is Grinleria's trollhead, which exports itself: no
bake UVs until a later phase draws it. Each later phase replaces old
functions with hg_<area>.py modules and deletes the JS that drew the same
things.

The playable layout is the contract (hollowgrin-layout.json): the colliders
stay the JS's, and nothing here moves one. The build refuses to run when the
map's JS changed since the layout file was checked.
"""
import importlib
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

import hg_kit  # noqa: E402
import tf_kit  # noqa: E402


def load(name, filename):
    """An old builder as a module, its Builder swapped for hg_kit's (its
    functions make Builder() from their module globals)."""
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, filename))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.Builder = hg_kit.HGBuilder
    return mod


# name -> (module key, function, GLB). Map-coordinate GLBs register their
# bounds as a prop (landmark:<name>); the four in their own frames don't.
# The hg_*.py modules (phase 1 on) register their own props and faces.
PARTS = {
    "manor": ("hg_manor", "build_manor", "hg-manor"),
    "square": ("hg_village", "build_square", "hg-square"),
    "oak": ("hg_village", "build_oak", "hg-oak"),
    "graveyard": ("hg_graveyard", "build_graveyard", "hg-graveyard"),
    "west": ("hg_west", "build_west", "hg-west"),
    "cauldron": ("hg_west", "build_cauldron", "hg-cauldron"),
    "garden": ("hg_garden", "build_garden", "hg-garden"),
    "tower": ("hg_chapel", "build_tower", "hg-chapel-tower"),
    "bell": ("hg_chapel", "build_bell", "hg-bell"),
    "clapper": ("hg_chapel", "build_clapper", "hg-bell-clapper"),
    "organ": ("hg_chapel", "build_organ", "hg-organ"),
    "mausoleum": ("village", "build_mausoleum", "hg-mausoleum"),
    "barn": ("hg_village", "build_barn", "hg-barn"),
    "candyshop": ("hg_village", "build_shop", "hg-candyshop"),
    "windmill": ("hg_village", "build_windmill", "hg-windmill"),
    "sails": ("hg_village", "build_sails", "hg-windmill-sails"),
    "southroad": ("hg_village", "build_road", "hg-southroad"),
    "fields": ("hg_fields", "build_fields", "hg-fields"),
    "scarecrow": ("hg_fields", "build_scarecrow", "hg-scarecrow"),
    "lane": ("hg_lane", "build_lane", "hg-lane"),
    "ghost": ("hg_lane", "build_ghost", "hg-ghost"),
    "fair": ("hg_fair", "build_fair", "hg-fair"),
    "carousel": ("hg_fair", "build_carousel", "hg-carousel"),
    "ride": ("hg_fair", "build_ride", "hg-carousel-ride"),
    "horse": ("hg_fair", "build_horse", "hg-horse"),
    "fountain": ("hg_park", "build_fountain", "hg-fountain"),
    "plaza": ("hg_park", "build_plaza", "hg-plaza"),
    "wheelbase": ("hg_park", "build_wheel", "hg-wheelbase"),
    "stalls": ("hg_park", "build_stalls", "hg-stalls"),
    "mansion": ("hg_park", "build_mansion", "hg-mansion"),
    "mountain": ("hg_park", "build_mountain", "hg-mountain"),
    "moat": ("hg_park", "build_moat", "hg-moat"),
    "skull": ("hg_park", "build_skull", "hg-skull"),
    "coaster": ("hg_park", "build_coaster", "hg-coaster"),
    "woods": ("hg_woods", "build_woods", "hg-woods"),
    "woodkit": ("hg_woods", "build_woodkit", "hg-woodkit"),
    "ground": ("hg_ground", "build_ground", "hg-ground"),
    "island": ("hg_island", "build_island", "hg-island"),
    "pepe": ("eggs", "build_pepe", "hg-pepe"),
    "trollbust": ("eggs", None, "hg-trollbust"),
}
OWN_FRAME = {"ride", "horse", "pepe", "trollbust"}
HG_MODULES = {"hg_manor", "hg_village", "hg_graveyard", "hg_west", "hg_garden", "hg_chapel", "hg_fields", "hg_lane", "hg_fair", "hg_park", "hg_woods", "hg_ground", "hg_island"}


def main():
    import quantize_glb
    L = hg_kit.load_layout()
    print("Hollowgrin layout", L["hash"], len(L["colliders"]), "colliders,", len(L["spawns"]), "spawns")
    only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    want = only or list(PARTS)
    bpy.ops.wm.read_factory_settings(use_empty=True)

    mods = {"village": load("hg_legacy_village", "hg_legacy_village.py"),
            "park": load("build_grinmoor", "build_grinmoor.blender.py"),
            "eggs": load("build_hollowgrin_eggs", "build_hollowgrin_eggs.blender.py")}
    V, Pk, E = mods["village"], mods["park"], mods["eggs"]
    pal = {"village": {**V.palette(), **V.hg_palette()}, "park": {**Pk.palette(), **Pk.gf_palette()}}
    R = tf_kit.Registry()

    for k in want:
        mk, fn, glb = PARTS[k]
        print(f"-- {k}")
        n0 = len(tf_kit.Report.rows)
        if k == "trollbust":       # Grinleria's trollhead, exported by itself (no bake UVs)
            E.GLB.build_trollhead(E.GLB.mall_palette(), width=1.5, res=150, front=0.62, back=0.55, carve=0.06, name="hg-trollbust",
                                  place=(0.0, 0.0, 0.0, 0.0, -0.05, 0.0), colors=(0xf6f6f2, 0xe9e9e4, 0x121212), moss_on=False)
        elif mk in HG_MODULES:
            mod = importlib.import_module(mk)
            getattr(mod, fn)(mod.palette(), R)
            continue
        elif mk == "eggs":
            getattr(E, fn)()
        else:
            getattr(mods[mk], fn)(pal[mk])
        if len(tf_kit.Report.rows) == n0:
            print(f"   NOTE {k}: exported outside HGBuilder (no bake UVs, no bounds)")
            continue
        name, tris, verts, _b, lo, hi = tf_kit.Report.rows[-1]
        if k not in OWN_FRAME:
            R.prop(f"landmark:{k}", lo, hi, tris=tris)

    # the hg_*.py GLBs also get 16-bit positions (Kabukigrin's): a manor
    # 40 m across in 0.6 mm steps
    paths = [os.path.join(HERE, PARTS[k][2] + ".glb") for k in want]
    quantize_glb.main([p for k, p in zip(want, paths) if PARTS[k][0] not in HG_MODULES])
    quantize_glb.main([p for k, p in zip(want, paths) if PARTS[k][0] in HG_MODULES], positions=True)
    for row in tf_kit.Report.rows:
        row[3] = os.path.getsize(os.path.join(HERE, row[0] + ".glb"))
    rows = tf_kit.Report.rows
    print(f"{'GLB':20}{'tris':>8}{'verts':>8}{'bytes':>10}")
    for n, t, v, b, lo, hi in rows:
        print(f"{n:20}{t:8}{v:8}{b:10}")
    total = sum(r[3] for r in rows)
    print(f"{'total':20}{sum(r[1] for r in rows):8}{'':8}{total:10}  ({total / 1e6:.2f} MB, HGBuilder GLBs only)")
    NL = chr(10)
    if not only:
        hg_kit.code_faces(R)
        with open(os.path.join(HERE, "hollowgrin-faces.json"), "w", newline=NL) as f:
            json.dump({"eyes": hg_kit.eyes(L), "known": [], "faces": R.faces, "props": R.props}, f, indent=1)
        with open(os.path.join(HERE, "hollowgrin-build.json"), "w", newline=NL) as f:
            json.dump({"layout": L["hash"], "glbs": {n: {"bytes": b, "tris": t, "lo": lo, "hi": hi} for n, t, v, b, lo, hi in rows}}, f, indent=1)
        print(f"wrote hollowgrin-faces.json ({len(R.faces)} faces, {len(R.props)} props), hollowgrin-build.json")
    bad = R.overlaps()
    if bad:
        print("OVERLAP", bad)
    print("ALL HOLLOWGRIN MODELS EXPORTED")


if __name__ == "__main__":
    main()
