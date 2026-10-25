"""
Troll Forces - Trollface Island (Troll Royale's map), headless Blender.
Design doc: claude.ai/artifact/NJA4xfxahS99UL52jrirn4.

Run with:
  node tools/troll-ops-island-layout.mjs        # layout -> trollface-island-layout.json
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python build_trollface_island.blender.py [-- name ...]

Writes the island's place models, tf-<place>.glb, into this folder (each in
its place's own frame, laid at the layout's centre by maps/trollface-island.js),
then shrinks them with quantize_glb.py, and writes trollface-faces.json
(the obstruction test's faces, eye regions and prop bounds) and
trollface-island-build.json (the layout hash the art was drawn from, every
GLB's size and bounds).

Phase 0 (the builder): the 15 landmarks are drawn by the old builder's own
functions (build_island.blender.py), triangle for triangle, through
tf_kit.TFBuilder so each GLB carries the bake's second UV set; the three
GLBs nothing loaded (tf-bus, tf-busface, tf-skybox) are no longer written.
Later phases replace a place's old function with a tf_<area>.py module.

The playable layout is the contract (trollface-island-layout.json): nothing
here moves a collider, a place, the coast, the lake or the ground field. The
build refuses to run when the layout's JS is newer than the JSON it would
draw from (re-run the layout tool first).
"""
import hashlib
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

import tf_kit  # noqa: E402

LAYOUT = json.load(open(os.path.join(HERE, "trollface-island-layout.json")))

# the map's %-to-metres frame (maps/trollface-island.js P), for the two
# models whose origin is not their place's centre
SX, SZ = 4.54, 3.62
P = lambda px, py: ((px - 50) * SX, (py - 47) * SZ)   # noqa: E731

# where each GLB's origin lands in the map (maps/trollface-island.js mapModel calls)
def origins():
    L = LAYOUT["places"]
    o = {k: (L[k]["x"], 0.0, L[k]["z"]) for k in L}
    o["dock"] = (P(27, 0)[0], 0.0, P(0, 36)[1])                    # the jetty's shore end
    o["bridge"] = ((P(37.6, 0)[0] + P(49.9, 0)[0]) / 2, 0.0, L["bridge"]["z"])   # the deck's middle
    o["cityface"] = o["city"]
    return o


# Faces drawn by the map's code that must stay in view (rule 9): the Shop's
# neon sign, the Portal's door, the Meme Lab's swirl (maps/trollface-island.js).
# Each is owned by the landmark it sits in, whose own frame (the gate's
# coils round the door, the ring round the swirl) is not an obstruction.
def code_faces():
    L = LAYOUT["places"]
    s, p, m = L["shop"], L["portal"], L["memelab"]
    import math
    sw = (math.sin(-0.6), 0.0, math.cos(-0.6))          # the swirl's CircleGeometry turned -0.6 about y
    return [
        {"id": "shop-neon", "owner": "landmark:shop", "c": [s["x"], 8.1, s["z"] + 7.6], "n": [0, 0, 1], "u": [1, 0, 0], "w": 13.6, "h": 5.4},
        {"id": "portal-door", "owner": "landmark:portal", "c": [p["x"] + 2, 8.62, p["z"] - 5], "n": [0, 0, 1], "u": [1, 0, 0], "w": 6.0, "h": 8.0},
        {"id": "memelab-swirl", "owner": "landmark:memelab", "c": [m["x"] - 2, 8.02, m["z"] - 1], "n": [round(sw[0], 4), 0, round(sw[2], 4)],
         "u": [round(-sw[2], 4), 0, round(sw[0], 4)], "w": 10.6, "h": 10.6},
    ]


# Where a player stands to look at them: the dry ground round each place
# (a 1 m grid, 1.6 m up, none inside a collider)
def eyes():
    out = []
    for k, p in LAYOUT["places"].items():
        r = p["r"] + 6
        out.append({"rect": [round(p["x"] - r, 1), round(p["x"] + r, 1), round(p["z"] - r, 1), round(p["z"] + r, 1)], "y": 0.0})
    return out


def check_layout_fresh():
    h = hashlib.sha1()
    for f in LAYOUT["sources"]:
        h.update(open(os.path.join(HERE, "..", f), "rb").read())
    now = h.hexdigest()[:12]
    if now != LAYOUT["hash"]:
        sys.exit(f"trollface-island-layout.json is stale ({LAYOUT['hash']}, the JS is {now}): node tools/troll-ops-island-layout.mjs first")
    print("Trollface Island layout", LAYOUT["hash"], len(LAYOUT["colliders"]), "colliders,", len(LAYOUT["places"]), "places")


LANDMARKS = ["city", "cityface", "peak", "gallery", "shop",
             "memelab", "observatory", "portal", "skate", "cave", "dock", "tree", "boat", "market", "bridge"]


def main():
    import quantize_glb
    check_layout_fresh()
    only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    want = only or LANDMARKS
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # the old landmark builder, its Builder swapped for tf_kit's (its
    # functions make Builder() from their module globals; the city face is
    # drawn by Grinleria's trollhead, so that module's too)
    spec = importlib.util.spec_from_file_location("build_island", os.path.join(HERE, "build_island.blender.py"))
    OLD = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(OLD)
    OLD.Builder = tf_kit.TFBuilder
    OLD.GLB.Builder = tf_kit.TFBuilder
    Pal = OLD.pal()
    Pal.update(OLD.pal4())
    builders = {
        "city": lambda: OLD.build_city(Pal), "cityface": lambda: OLD.build_city_face(Pal), "peak": lambda: OLD.build_peak(Pal),
        "gallery": lambda: OLD.build_gallery(Pal), "shop": lambda: OLD.build_shop(Pal),
        "memelab": lambda: OLD.build_memelab(Pal), "observatory": lambda: OLD.build_observatory(Pal), "portal": lambda: OLD.build_portal(Pal),
        "skate": lambda: OLD.build_skate(Pal), "cave": lambda: OLD.build_cave(Pal), "dock": lambda: OLD.build_dock(Pal),
        "tree": lambda: OLD.build_tree(Pal), "boat": lambda: OLD.build_boat(Pal), "market": lambda: OLD.build_market(Pal),
        "bridge": lambda: OLD.build_bridge(Pal),
    }
    R = tf_kit.Registry()
    O = origins()
    for k in want:
        print(f"-- {k}")
        n0 = len(tf_kit.Report.rows)
        builders[k]()
        if len(tf_kit.Report.rows) == n0:
            print(f"   NOTE {k}: exported outside TFBuilder (no bake UVs, no bounds)")
            continue
        name, tris, verts, _b, lo, hi = tf_kit.Report.rows[-1]
        ox, oy, oz = O[k]
        R.prop(f"landmark:{k}", [lo[0] + ox, lo[1] + oy, lo[2] + oz], [hi[0] + ox, hi[1] + oy, hi[2] + oz], tris=tris)
        # the model sits inside its place's ring (the contract: each
        # landmark's model stays inside its ring), with the two whose origin
        # is off-centre measured from the place
        place = LAYOUT["places"]["city" if k == "cityface" else k]
        r_in = max(abs(lo[0] + ox - place["x"]), abs(hi[0] + ox - place["x"]), abs(lo[2] + oz - place["z"]), abs(hi[2] + oz - place["z"]))
        if r_in > place["r"] + 2.5:
            print(f"   NOTE {k}: model reaches {r_in:.1f} m from the place's centre, ring {place['r']} m")
    paths = [os.path.join(HERE, f"tf-{k}.glb") for k in want]
    quantize_glb.main(paths)
    for row in tf_kit.Report.rows:
        row[3] = os.path.getsize(os.path.join(HERE, row[0] + ".glb"))
    total = sum(r[3] for r in tf_kit.Report.rows)
    print(f"{'GLB':16}{'tris':>8}{'verts':>8}{'bytes':>10}")
    for n, t, v, b, lo, hi in tf_kit.Report.rows:
        print(f"{n:16}{t:8}{v:8}{b:10}")
    print(f"{'total':16}{sum(r[1] for r in tf_kit.Report.rows):8}{'':8}{total:10}  ({total / 1e6:.2f} MB)")
    if not only:
        NL = chr(10)
        with open(os.path.join(HERE, "trollface-faces.json"), "w", newline=NL) as f:
            json.dump({"eyes": eyes(), "known": [], "faces": code_faces() + R.faces, "props": R.props}, f, indent=1)
        with open(os.path.join(HERE, "trollface-island-build.json"), "w", newline=NL) as f:
            json.dump({"layout": LAYOUT["hash"], "glbs": {n: {"bytes": b, "tris": t, "lo": lo, "hi": hi} for n, t, v, b, lo, hi in tf_kit.Report.rows}}, f, indent=1)
        print(f"wrote trollface-faces.json ({len(code_faces()) + len(R.faces)} faces, {len(R.props)} props), trollface-island-build.json")
    bad = R.overlaps()
    if bad:
        print("OVERLAP", bad)
    print("ALL ISLAND LANDMARKS EXPORTED")


if __name__ == "__main__":
    main()
