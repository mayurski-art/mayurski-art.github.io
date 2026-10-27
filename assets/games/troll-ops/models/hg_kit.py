"""
Hollowgrin's build kit (build_hollowgrin.blender.py; doc "Troll Forces:
Hollowgrin in Blender", claude.ai/artifact/TkbPnJoMnM7cptWEsevS4k).

Game coordinates (x east, y up, z south) and, unlike the island, every GLB
drawn in MAP coordinates (placed at the origin by maps/hollowgrin.js), as the
village and park builders always did.

The builder and the registry are Trollface Island's (tf_kit.py), shared
rather than copied: HGBuilder's finish() adds the bake's second UV set and
reports the GLB's bounds and size; Registry records prop bounds and the
faces rule 9 keeps in view (tools/troll-ops-obstruction-test.mjs reads
models/hollowgrin-faces.json). What is Hollowgrin's own lives here: the
layout file the build draws to, the faces the map's code draws (its signs),
and where a player's eye can be.
"""
import json
import os

from tf_kit import Registry, Report, TFBuilder  # noqa: F401  (re-exported for the hg_*.py modules)

HERE = os.path.dirname(os.path.abspath(__file__))
LAYOUT_FILE = os.path.join(HERE, "hollowgrin-layout.json")


class HGBuilder(TFBuilder):
    """tf_kit's builder: the bake UVs (one atlas per GLB) and the size
    report on finish(). The bake itself waits for phase 6."""


def load_layout():
    """The playable layout (tools/troll-ops-hollowgrin-layout.mjs), checked
    against the JS it came from: a JS edit since the file was written stops
    the build until the layout tool has looked (and kept its hash)."""
    import hashlib
    L = json.load(open(LAYOUT_FILE))
    h = hashlib.sha1()
    for f in L["sources"]:
        # line endings dropped, as the layout tool does
        h.update(open(os.path.join(HERE, "..", f), "rb").read().replace(b"\r\n", b"\n"))
    now = h.hexdigest()[:12]
    if now != L["sourceHash"]:
        raise SystemExit(f"hollowgrin-layout.json is stale (the JS is {now}, the file {L['sourceHash']}): "
                         "node tools/troll-ops-hollowgrin-layout.mjs --check first")
    return L


# Faces the map's code draws that must stay in view (rule 9): the signs and
# the doors of today's buildings. [id, owner, centre, outward normal, w, h];
# the owner is the prop the face belongs to ("landmark:<glb>" for a GLB, a
# plain name for code-built places with no prop yet). Each place's hg_*.py
# module takes its faces over when it rebuilds the place.
CODE_FACES = [
    ["sign:troll-and-treat", "landmark:candyshop", (-6.0, 4.3, 20.78), (0, 0, -1), 7.4, 1.35],
    ["door:candyshop", "landmark:candyshop", (-6.0, 1.25, 20.8), (0, 0, -1), 1.8, 2.5],
    ["sign:troll-plaque", "landmark:mausoleum", (-24.72, 2.85, 11.0), (1, 0, 0), 1.8, 0.45],
    ["door:mausoleum", "landmark:mausoleum", (-25.0, 1.25, 11.0), (1, 0, 0), 1.8, 2.5],
    ["sign:u-mad-mansion", "landmark:mansion", (69.5, 2.66, 17.15), (0, 0, -1), 3.9, 0.56],
    ["door:u-mad-mansion", "landmark:mansion", (69.5, 1.8, 20.45), (0, 0, -1), 1.8, 2.8],
    ["sign:st-grinsworths", "chapel", (-38.97, 4.16, 2.0), (1, 0, 0), 2.6, 0.42],
    ["sign:rest-in-pepe-east", "graveyard-gate", (-15.95, 3.1, 2.0), (1, 0, 0), 2.6, 0.5],
    ["sign:rest-in-pepe-west", "graveyard-gate", (-16.05, 3.1, 2.0), (-1, 0, 0), 2.6, 0.5],
    ["sign:grinmoor-fair-east", "midway-arch", (37.43, 3.92, 4.1), (1, 0, 0), 3.9, 0.72],
    ["sign:grinmoor-fair-west", "midway-arch", (37.17, 3.92, 4.1), (-1, 0, 0), 3.9, 0.72],
]


def code_faces(R):
    for fid, owner, c, n, w, h in CODE_FACES:
        R.face(fid, owner, c, n, w, h)


def eyes(L):
    """Where a player stands: the ground over the whole map (the test skips
    the eyes inside colliders), on a 1 m grid, 1.6 m up."""
    B = L["bounds"]
    return [{"rect": [B["minX"], B["maxX"], B["minZ"], B["maxZ"]], "y": 0.0}]
