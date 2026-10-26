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
Each later phase replaces a place's old function with a tf_<area>.py module:
phase 1, Troll City (tf_city.py) and Troll Peak (tf_peak.py); phase 5 adds
the five new places (tf_new.py).

The playable layout is the contract (trollface-island-layout.json): nothing
here moves a place, the coast, the lake or the ground field. A rebuilt
place's colliders are the build's (the doc: "colliders inside a place's ring
change when it is rebuilt", approved with that phase's shots): they go to
maps/trollface-island-built.js with the place's deck loot spots and sign
boards, and maps/trollface-island.js lays them instead of its old code for
that place. After a build: node tools/troll-ops-island-colliders.mjs --write
(the data file follows the game), then node tools/troll-ops-island-layout.mjs.
The build refuses to run when the layout's JS is newer than the JSON it
would draw from (re-run the layout tool first).
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
import tf_city  # noqa: E402
import tf_peak  # noqa: E402
import tf_portal  # noqa: E402
import tf_skate  # noqa: E402
import tf_lake  # noqa: E402
import tf_roads  # noqa: E402
import tf_coast  # noqa: E402
import tf_mid  # noqa: E402
import tf_new  # noqa: E402

BUILT = ("city", "peak", "skate", "portal", "cave", "dock", "tree", "boat", "bridge", "roads", "shop", "memelab", "gallery", "observatory", "market",
         "ranch", "lodge", "light", "plant", "gas")        # the places a tf_<area>.py module draws (their colliders are the build's)
# a rebuilt place's GLB gets a new name (the asset service worker re-checks
# art daily: an old name would reach returning players a visit late)
GLB_NAME = {"city": "tf-city-p1", "peak": "tf-peak-p1", "skate": "tf-skate-p2", "portal": "tf-portal-p2",
            "cave": "tf-cave-p3", "dock": "tf-dock-p3", "tree": "tf-tree-p3", "boat": "tf-boat-p3", "bridge": "tf-bridge-p3", "roads": "tf-roads-p4", "coast": "tf-coast-p3",
            "shop": "tf-shop-p4", "memelab": "tf-memelab-p4",
            "gallery": "tf-gallery-p4", "observatory": "tf-observatory-p4", "market": "tf-market-p4",
            "ranch": "tf-ranch-p5", "lodge": "tf-lodge-p5", "light": "tf-light-p5", "plant": "tf-plant-p5", "gas": "tf-gas-p5"}

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
    o["portalface"] = o["portal"]
    o["boatface"] = o["boat"]
    o["roads"] = (0.0, 0.0, 0.0)
    o["coast"] = (0.0, 0.0, 0.0)
    return o


# Faces drawn by the map's code that must stay in view (rule 9): none left
# here. The modules that place them register them: the Portal's door
# (tf_portal.py), the Shop's neon and the Meme Lab's swirl (tf_mid.py), each
# owned by the prop it sits on.
def code_faces():
    return []          # phase 4: tf_mid.py registers the Shop's neon and the Meme Lab's swirl with their places


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


def door_clear(faces):
    """Royale's keep-clear rects ([x0, z0, x1, z1], map metres) for a place's
    doorways: 3 m out in front of each door face and 2 m in behind it, half a
    metre wider than the door each side; no chest or floor loot lands there."""
    out = []
    for f in faces:
        if not (f["id"].startswith("door:") or f["id"].endswith("-door")):
            continue
        (cx, _, cz), (nx, _, nz), (ux, _, uz) = f["c"], f["n"], f["u"]
        hw = f["w"] / 2 + 0.5
        pts = [(cx + ux * a + nx * d, cz + uz * a + nz * d) for a in (-hw, hw) for d in (-2.0, 3.0)]
        out.append([round(min(p[0] for p in pts), 2), round(min(p[1] for p in pts), 2),
                    round(max(p[0] for p in pts), 2), round(max(p[1] for p in pts), 2)])
    return out


def write_built(built):
    """maps/trollface-island-built.js: what the map lays for a rebuilt place
    besides its GLB: its colliders [x, z, w, d, h, y, pen], its deck loot
    spots {x, z, y} and its sign boards [text, x, y, z, nx, nz, w, h, colour]
    (lettered by trollface-island-signs.js), the Peak hut's window."""
    NL = chr(10)
    path = os.path.join(HERE, "..", "maps", "trollface-island-built.js")
    out = ["// Written by models/build_trollface_island.blender.py: what the map lays for",
           "// a place its tf_<area>.py module rebuilt, besides its GLB. Colliders are",
           "// [x, z, w, d, h, y, pen] in map metres (they replace the map's old code for",
           "// that place), loot the deck spots up on floors and roofs, clear the rects",
           "// in front of doors Royale keeps chests and floor loot out of, signs the boards",
           "// trollface-island-signs.js letters. Don't edit by hand.",
           "export const TF_BUILT = {"]
    for k, v in built.items():
        out.append(f"  {k}: {{")
        out.append("    colliders: [")
        out.append(("," + NL).join("      [" + ",".join(f"{x:g}" for x in c) + "]" for c in v["colliders"]) + ",")
        out.append("    ],")
        out.append("    loot: [" + ", ".join(json.dumps(s, separators=(",", ":")) for s in v["loot"]) + "],")
        out.append("    clear: [" + ", ".join(json.dumps(r, separators=(",", ":")) for r in v["clear"]) + "],")
        out.append("    signs: [")
        out.append(("," + NL).join("      " + json.dumps(s, separators=(",", ":")) for s in v["signs"]) + ("," if v["signs"] else ""))
        out.append("    ],")
        for key in ("window", "door", "neon", "swirl", "busts", "glass", "face"):
            if key in v:
                out.append(f"    {key}: {json.dumps(v[key])},")
        out.append("  },")
    out.append("};")
    with open(path, "w", newline=NL) as f:
        f.write(NL.join(out) + NL)
    print("wrote maps/trollface-island-built.js:", ", ".join(f"{k} {len(v['colliders'])} colliders, {len(v['loot'])} loot spots, {len(v['signs'])} signs" for k, v in built.items()))


LANDMARKS = ["city", "cityface", "peak", "gallery", "shop",
             "memelab", "observatory", "portal", "portalface", "skate", "boatface", "roads", "coast", "cave", "dock", "tree", "boat", "market", "bridge",
             "ranch", "lodge", "light", "plant", "gas"]


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
    R = tf_kit.Registry()
    O = origins()
    built = {}        # place -> {colliders, loot, signs, ...} for trollface-island-built.js

    def modern(k, mod):
        P = dict(Pal)
        P.update(mod.palette())
        n0, f0 = len(R.colliders), len(R.faces)
        extra = mod.build(tf_kit.TFBuilder(), P, R, (O[k][0], O[k][2]))
        built[k] = {"colliders": R.colliders[n0:], "loot": list(mod.LOOT), "signs": list(mod.SIGNS),
                    "clear": door_clear(R.faces[f0:])}
        if k == "peak":
            built[k]["window"] = [round(v, 2) for v in extra]
        if k == "portal":
            built[k]["door"] = extra["door"]
        built[k].update(getattr(mod, "EXTRA", {}))
        if getattr(mod, "GLASS", None):
            built[k]["glass"] = list(mod.GLASS)

    builders = {
        "city": lambda: modern("city", tf_city), "cityface": lambda: OLD.build_city_face(Pal), "peak": lambda: modern("peak", tf_peak),
        "gallery": lambda: modern("gallery", tf_mid.GALLERY), "shop": lambda: modern("shop", tf_mid.SHOP),
        "memelab": lambda: modern("memelab", tf_mid.LAB), "observatory": lambda: modern("observatory", tf_mid.OBS), "portal": lambda: modern("portal", tf_portal),
        "portalface": lambda: tf_portal.portal_face(OLD.GLB, Pal),
        "skate": lambda: modern("skate", tf_skate), "cave": lambda: modern("cave", tf_lake.CAVE), "dock": lambda: modern("dock", tf_lake.DOCK),
        "tree": lambda: modern("tree", tf_lake.TREE), "boat": lambda: modern("boat", tf_lake.BOAT),
        "boatface": lambda: tf_lake.boat_face(OLD.GLB, Pal), "market": lambda: modern("market", tf_mid.MARKET),
        "bridge": lambda: modern("bridge", tf_lake.BRIDGE),
        "ranch": lambda: modern("ranch", tf_new.RANCH), "lodge": lambda: modern("lodge", tf_new.LODGE), "light": lambda: modern("light", tf_new.LIGHT),
        "plant": lambda: modern("plant", tf_new.PLANT), "gas": lambda: modern("gas", tf_new.GAS), "roads": lambda: modern("roads", tf_roads), "coast": lambda: tf_coast.build(tf_kit.TFBuilder(), {**Pal, **tf_coast.palette()}, R, (0.0, 0.0)),
    }
    for k in want:
        print(f"-- {k}")
        n0 = len(tf_kit.Report.rows)
        builders[k]()
        if len(tf_kit.Report.rows) == n0:
            print(f"   NOTE {k}: exported outside TFBuilder (no bake UVs, no bounds)")
            continue
        name, tris, verts, _b, lo, hi = tf_kit.Report.rows[-1]
        ox, oy, oz = O[k]
        if k not in BUILT and k != "coast":      # a modern place registers its own props; the coast hangs outside the play area
            R.prop(f"landmark:{k}", [lo[0] + ox, lo[1] + oy, lo[2] + oz], [hi[0] + ox, hi[1] + oy, hi[2] + oz], tris=tris)
        # the model sits inside its place's ring (the contract: each
        # landmark's model stays inside its ring), with the two whose origin
        # is off-centre measured from the place
        place = LAYOUT["places"].get({"cityface": "city", "portalface": "portal", "boatface": "boat"}.get(k, k))
        if place is None:       # the roads span the island
            continue
        r_in = max(abs(lo[0] + ox - place["x"]), abs(hi[0] + ox - place["x"]), abs(lo[2] + oz - place["z"]), abs(hi[2] + oz - place["z"]))
        if r_in > place["r"] + 2.5:
            print(f"   NOTE {k}: model reaches {r_in:.1f} m from the place's centre, ring {place['r']} m")
    paths = [os.path.join(HERE, GLB_NAME.get(k, f"tf-{k}") + ".glb") for k in want]
    quantize_glb.main(paths)
    # 16-bit positions too (phase 7, the 14 MB budget), not the roads': their
    # paint lies 4 mm over the asphalt and 440 m in 16 bits is 6.7 mm
    quantize_glb.positions_only([p for p in paths if "tf-roads" not in p])
    for row in tf_kit.Report.rows:
        row[3] = os.path.getsize(os.path.join(HERE, row[0] + ".glb"))
    total = sum(r[3] for r in tf_kit.Report.rows)
    print(f"{'GLB':16}{'tris':>8}{'verts':>8}{'bytes':>10}")
    for n, t, v, b, lo, hi in tf_kit.Report.rows:
        print(f"{n:16}{t:8}{v:8}{b:10}")
    print(f"{'total':16}{sum(r[1] for r in tf_kit.Report.rows):8}{'':8}{total:10}  ({total / 1e6:.2f} MB)")
    NL = chr(10)
    if all(k in want for k in BUILT):
        write_built(built)
    if not only:
        with open(os.path.join(HERE, "trollface-faces.json"), "w", newline=NL) as f:
            json.dump({"eyes": eyes(), "known": [], "faces": code_faces() + R.faces, "props": R.props}, f, indent=1)
        with open(os.path.join(HERE, "trollface-island-build.json"), "w", newline=NL) as f:
            json.dump({"layout": LAYOUT["hash"], "glbs": {n: {"bytes": b, "tris": t, "lo": lo, "hi": hi} for n, t, v, b, lo, hi in tf_kit.Report.rows}}, f, indent=1)
        print(f"wrote trollface-faces.json ({len(code_faces()) + len(R.faces)} faces, {len(R.props)} props), trollface-island-build.json")
    bad = R.overlaps()
    if bad:
        print("OVERLAP", bad)
    heavy = sorted((p for p in R.props if p["tris"]), key=lambda p: -p["tris"])[:12]
    print("heaviest props:", ", ".join(f"{p['id']} {p['tris']}" for p in heavy))
    print("ALL ISLAND LANDMARKS EXPORTED")


if __name__ == "__main__":
    main()
