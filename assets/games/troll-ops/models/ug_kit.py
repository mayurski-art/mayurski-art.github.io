"""
Undergrin's Blender kit (doc "Troll Forces: Undergrin in Blender", phase 0):
the station's numbers, the modded full-bright palette, the drawing helpers
(boxes by extents, painted bands, the 5 x 7 lettering, the trollface
mosaic posters, the general's portrait, benches, steps, rails), the layout
contract (models/undergrin-layout.json, dumped from maps/undergrin.js by
tools/troll-ops-undergrin-layout.mjs; the build refuses to run when the
file has moved on since) and the registry every prop goes through: its
bounds (the overlap pass), the collider it needs (anything over 0.6 m) and
the faces that must stay in view (CLAUDE.md Troll Forces rule 9; the
obstruction test reads models/undergrin-faces.json).

One module per GLB imports this: ug_shell, ug_platforms, ug_escalators,
ug_trains, ug_concourse, ug_shops, ug_plant; build_undergrin.blender.py
runs them. Game coordinates throughout: x east, z south, y up. Levels:
track 0, platform 0.95, concourse 6.0 (slab 5.6..6.0). The south half is
the north half turned 180 degrees about the origin (s = -1 in the
modules); only the shop dressing differs.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
import hashlib  # noqa: E402
import json  # noqa: E402
import math  # noqa: E402
import random  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402


T, P, U = 0.0, 0.95, 6.0
SLAB0 = 5.6                     # concourse slab bottom
CEIL_SHOP = 9.6                 # shop row ceilings
HALL_WALL = 9.0                 # hall walls, vault springing
VAULT_CROWN = 12.0
ATRIUM_CEIL = 15.0
ARCH_SPAN, ARCH_SPRING = 14.0, 7.5
BORE_W = {"W": (-14.25, -9.75), "E": (9.75, 14.25)}
BORE_CX = {"W": -12.0, "E": 12.0}
ESC = dict(x=(-1.9, 1.9), w=1.4, foot=-27.0, n=17, rise=0.3, run=0.5)
ESC_WELL = (-2.9, 2.9, -28.0, -18.5)     # the blockout's: a 3.6 well cut the island nose off the bots' grid
WSTAIR = dict(x0=-21.5, x1=-17.5, foot=-42.65, n=17, rise=0.3, run=0.45)   # a 1.35 m landing at the wall
WSTAIR_WELL = (-22.0, -17.5, -44.0, -35.0)  # beside the hall's 4 m end block (x -17.5..22, z -44..-40)
PURPLE_WELL = (-21.0, -18.0, -10.0, -4.0)
LIGHT_WELL = (-4.0, 4.0, -4.0, 4.0)
COLS = [(sx * 6.0, z) for sx in (-1, 1) for z in (-40, -34, -22, -16)]
TRAIN_X = (-13.7, -10.3)
CAR_Z = (-35.75, -22.25)        # north train car centres (W bore, z -42..-29.5 and -28.5..-16)
CAR_L, CAR_W = 12.5, 3.4
DOOR_OFF = (-3.8, 0.0, 3.8)
DOOR_W = 1.4
# central-section bores: outer wall at +-14.25, the 0.3 inner wall inside the
# bore (x -10.05..-9.75), so the lining spans 4.2; straight to the door
# lintels at 2.4, an elliptical vault to the 4.0 tunnel ceiling
TUN_CX, TUN_HW, TUN_SPRING, TUN_CROWN = 12.15, 2.1, 2.4, 4.0
DOOR_H = 2.4                    # every doorway's lintel (the blockout's)
REPO = os.path.normpath(os.path.join(OUT_DIR, "..", "..", "..", ".."))
ART_TROLL = os.path.join(REPO, "assets", "pfp", "base", "og.webp")

# west shop row (z0, z1, name) and east: point-symmetric (the blockout moved
# the west Lounge/Apotrolle split from the doc's 14 to 12)
SHOPS_W = [(-40, -26, "arcade"), (-26, -12, "grinbiss"), (-12, 0, "purple"), (0, 12, "lounge"), (12, 26, "apotrolle"), (26, 40, "books")]
SHOPS_E = [(-40, -26, "books"), (-26, -12, "apotrolle"), (-12, 0, "lounge"), (0, 12, "red"), (12, 26, "grinbiss"), (26, 40, "arcade")]


# ---------------------------------------------------------- the layout contract

LAYOUT_FILE = os.path.join(OUT_DIR, "undergrin-layout.json")
LAYOUT_SOURCE = os.path.normpath(os.path.join(OUT_DIR, "..", "maps", "undergrin.js"))


def load_layout():
    """models/undergrin-layout.json: the game's own colliders, stairs links,
    spawns and sites (tools/troll-ops-undergrin-layout.mjs)."""
    with open(LAYOUT_FILE, encoding="utf-8") as f:
        return json.load(f)


def check_layout(layout):
    """Refuses to build when maps/undergrin.js has moved on since the layout
    was dumped: art and colliders never part."""
    with open(LAYOUT_SOURCE, "rb") as f:
        now = hashlib.sha1(f.read()).hexdigest()[:12]
    if now != layout["hash"]:
        raise SystemExit("maps/undergrin.js (%s) is newer than models/undergrin-layout.json (%s): "
                         "run `node tools/troll-ops-undergrin-layout.mjs`, then build again" % (now, layout["hash"]))


def has_box(layout, x0, y0, z0, x1, y1, z1, tol=0.002):
    """Whether the layout has a collider with these extents."""
    want = (min(x0, x1), min(y0, y1), min(z0, z1), max(x0, x1), max(y0, y1), max(z0, z1))
    for c in layout["colliders"]:
        if all(abs(c[i] - want[i]) <= tol for i in range(6)):
            return True
    return False


def assert_layout(layout):
    """The numbers the modules draw to, checked against the colliders they
    came from (a moved wall fails here, not in a shot)."""
    checks = [
        ("the west side platform", (-22, 0, -44, -14.25, P, -14)),
        ("the island platform", (-9.75, 0, -44, 9.75, P, -14)),
        ("the escalator well's west balustrade, first step", (-2.9, P, -27, -2.6, P + 0.3 + 1.2, -26.5)),
        ("the north train's undercarriage", (TRAIN_X[0], 0, -42, TRAIN_X[1], P, -16)),
        ("the plant room's north lintel", (-2, DOOR_H, -8, 2, SLAB0, -7.7)),
        ("the west shop row's inner wall, first bay", (-16.3, U, -40, -16, CEIL_SHOP, -33.9)),
        ("the atrium's north arch head", (-7, 12, -16, 7, 15, -15.5)),
        ("the works trolley in the west bore", (-14.25, 0, -2.2, -12.65, 1.0, 0.2)),
    ]
    for (what, box) in checks:
        if not has_box(layout, *box):
            raise SystemExit("the layout has no collider for %s %s: the numbers in ug_kit.py no longer match maps/undergrin.js" % (what, box))


# ---------------------------------------------------------------- registry

class Registry:
    """What the props leave behind besides geometry: their bounds (the
    overlap pass), the colliders they need (maps/undergrin-props.js, from
    phase 1), the faces that must stay in view (models/undergrin-faces.json,
    the obstruction test) and the signs the game letters at load
    (models/undergrin-signs.json, from phase 1)."""

    def __init__(self):
        self.props = []        # {id, lo, hi, on, tris}  (on: the prop it stands on)
        self.colliders = []    # [x, z, w, d, h, y, pen]
        self.faces = []        # {id, owner, c, n, u, w, h}
        self.signs = []        # {id, c, n, w, h, text, fg, bg}
        self._open = None

    def begin(self, b, pid=None, on=None):
        """Starts a prop: every vertex so far is marked, and the prop's are
        the ones left unmarked at end() (the Kabukigrin registry's way: a
        vertex count read back from the bmesh lagged behind bmesh.ops).
        pid None: named from its kind and centre at end()."""
        if self._open is not None:
            raise RuntimeError("a prop inside a prop: %r opened while %r is open" % (pid, self._open[1]))
        bm = b.bm
        tag = bm.verts.layers.int.get("ug_reg") or bm.verts.layers.int.new("ug_reg")
        for v in bm.verts:
            if v[tag] == 0:
                v[tag] = -1
        self._open = (b, pid, tag, on, len(self.faces))

    def end(self, kind=None):
        b, pid, tag, on, f0 = self._open
        self._open = None
        bm = b.bm
        vs = [v for v in bm.verts if v[tag] == 0]
        if not vs:
            return None
        k = len(self.props) + 1
        for v in vs:
            v[tag] = k
        faces = {f for v in vs for f in v.link_faces}
        tris = sum(len(f.verts) - 2 for f in faces if all(w[tag] == k for w in f.verts))
        lo = [min(v.co[a] for v in vs) for a in range(3)]
        hi = [max(v.co[a] for v in vs) for a in range(3)]
        if pid is None:
            pid = "%s@%.1f,%.1f" % (kind or "prop", (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2)
        # the faces registered meanwhile as "@self" are this prop's own
        for f in self.faces[f0:]:
            if f["owner"] == "@self":
                f["owner"] = pid
        self.props.append({"id": pid, "lo": [round(x, 4) for x in lo], "hi": [round(x, 4) for x in hi], "on": on, "tris": tris})
        return pid

    def collider(self, x, z, w, d, h, y=0.0, pen=3):
        self.colliders.append([round(v, 3) for v in (x, z, w, d, h, y)] + [pen])

    def face(self, fid, owner, c, n, w, h, u=None):
        """A face that must stay in view: centre c, outward normal n (in the
        floor plane), width w along u (default: n turned left), height h.
        owner "@self" inside a prop: that prop (set at end()); "wall": the
        wall it is painted on (any prop in front of it is in the way)."""
        if u is None:
            u = (-n[2], 0.0, n[0])
        self.faces.append({"id": fid, "owner": owner, "c": [round(float(v), 3) for v in c], "n": [round(float(v), 3) for v in n],
                           "u": [round(float(v), 3) for v in u], "w": w, "h": h})

    def sign(self, sid, c, n, w, h, text, fg, bg=None):
        """A sign the game letters at load (maps/undergrin-signs.js, phase 1)."""
        self.signs.append({"id": sid, "c": [round(float(v), 3) for v in c], "n": [round(float(v), 3) for v in n], "w": w, "h": h,
                           "text": text, "fg": fg, "bg": bg})


REG = Registry()


def registered(kind):
    """Every call of the decorated drawing function (first argument the
    Builder) is a prop in the registry: its bounds under the id
    <kind>@x,z from its centre, and the faces it registers as "@self"
    meanwhile are its own."""
    def deco(fn):
        def wrap(b, *a, **kw):
            REG.begin(b)
            out = fn(b, *a, **kw)
            REG.end(kind)
            return out
        wrap.__name__ = fn.__name__
        wrap.__doc__ = fn.__doc__
        return wrap
    return deco


def doorway_faces():
    """Every doorway as a face nothing may stand in front of, on both sides:
    the hall and atrium doors into the shop rows (x +-16.15), the shop
    partitions' doors (x +-19), the plant room's doors (the walkways' full
    4 m), the bores' doors into the plant room and the corridors."""
    out = []

    def door(fid, c, n, w, h=DOOR_H):
        for sgn in (-1, 1):
            nn = (n[0] * sgn, 0.0, n[2] * sgn)
            out.append({"id": "%s/%+d" % (fid, sgn), "owner": "wall", "c": [round(v, 3) for v in c], "n": list(nn),
                        "u": [-nn[2], 0.0, nn[0]], "w": w, "h": h})
    for s in (1, -1):
        for sx in (-1, 1):
            for z in (-33, -19, -8):
                door("door-hall@%.0f,%.0f" % (s * sx * 16.15, s * z), (s * sx * 16.15, U + DOOR_H / 2, s * z), (1, 0, 0), 1.8)
        door("door-plant@%.0f" % (s * -7.85), (0.0, DOOR_H / 2, s * -7.85), (0, 0, 1), 4.0)
        door("door-bore@%.0f,%.0f" % (s * -9.9, s * -4), (s * -9.9, DOOR_H / 2, s * -4.0), (1, 0, 0), 1.8)
        door("door-corridor@%.0f,%.0f" % (s * -15, s * -6), (s * -15.0, DOOR_H / 2, s * -6.0), (1, 0, 0), 1.8)
    for sx in (-1, 1):
        for z in (-26, -12, 0, 12, 26):
            door("door-shop@%.0f,%.0f" % (sx * 19, z), (sx * 19.0, U + DOOR_H / 2, float(z)), (0, 0, 1), 1.8)
    return out


def eye_regions():
    """Where a player stands to look at the faces (the obstruction test's eye
    points: a 1 m grid, 1.6 m up, none inside a collider): the bores, the
    plant room, the walkways and corridors at track level; the platforms and
    the trains' floors; the concourse less its wells."""
    out = []
    for (a, c, d, e) in ((-14.25, -9.75, -44, 44), (9.75, 14.25, -44, 44), (-9.75, 9.75, -8, 8),
                         (-2, 2, -14, -8), (-2, 2, 8, 14), (-22, -15.75, -12, 0), (15.75, 22, 0, 12)):
        out.append({"rect": [a, c, d, e], "y": T})
    for (d, e) in ((-44, -14), (14, 44)):
        for (a, c) in ((-22, -14.25), (-9.75, 9.75), (14.25, 22)):
            out.append({"rect": [a, c, d, e], "y": P})
    out.append({"rect": [TRAIN_X[0], TRAIN_X[1], -42, -16], "y": P})
    out.append({"rect": [-TRAIN_X[1], -TRAIN_X[0], 16, 42], "y": P})
    wells = [ESC_WELL, WSTAIR_WELL, PURPLE_WELL, LIGHT_WELL]
    wells += [(-c, -a, -e, -d) for (a, c, d, e) in wells[:3]]
    rs = [(-22.0, 22.0, -44.0, 44.0)]
    for h in wells:
        rs = sub_rects(rs, h)
    for (a, c, d, e) in rs:
        out.append({"rect": [a, c, d, e], "y": U})
    return out


def write_registry(R):
    """models/undergrin-faces.json (the obstruction test: eyes, faces, every
    prop's bounds), models/undergrin-signs.json when there are signs, and
    maps/undergrin-props.js when a prop needs a collider; prints the props
    whose bounds cross."""
    NL = chr(10)
    with open(os.path.join(OUT_DIR, "undergrin-faces.json"), "w", newline=NL) as f:
        json.dump({"eyes": eye_regions(), "known": [], "faces": R.faces + doorway_faces(), "props": R.props}, f, indent=1)
    if R.signs:
        with open(os.path.join(OUT_DIR, "undergrin-signs.json"), "w", newline=NL) as f:
            json.dump({"signs": R.signs}, f, indent=1)
    if R.colliders:
        js = os.path.join(OUT_DIR, "..", "maps", "undergrin-props.js")
        rows = ("," + NL).join("    [" + ",".join(f"{v:g}" for v in c) + "]" for c in R.colliders)
        with open(js, "w", newline=NL) as f:
            f.write(NL.join([
                "// Written by models/build_undergrin.blender.py: the colliders Undergrin's",
                "// Blender props need (anything over 0.6 m), on top of the layout's",
                "// (maps/undergrin.js): [x, z, w, d, h, y, pen].",
                "export const UG_PROPS = {",
                "  colliders: [",
                rows + ",",
                "  ],",
                "};",
                "",
            ]))
    # the overlap pass: no two props' bounds cross, unless one stands on the other
    bad = []
    for i, a in enumerate(R.props):
        for c in R.props[i + 1:]:
            if a["on"] == c["id"] or c["on"] == a["id"]:
                continue
            if all(a["lo"][k] < c["hi"][k] - 0.005 and c["lo"][k] < a["hi"][k] - 0.005 for k in range(3)):
                bad.append((a["id"], c["id"]))
    print("registry: %d props, %d faces (+%d doorways), %d signs, %d colliders%s" % (
        len(R.props), len(R.faces), len(doorway_faces()), len(R.signs), len(R.colliders),
        ("; OVERLAP " + ", ".join("%s x %s" % p for p in bad)) if bad else ""))
    return bad



# ---------------------------------------------------------------- palette

def ug_palette():
    """Section 3's palette. UG_* names are not in RETEXTURE, so finish()
    folds them into GS_Paint vertex colour; only the emissives keep a
    material of their own."""
    return {
        "wall": mat("UG_Wall", 0xe6e4df, 0.85),
        "floor": mat("UG_Floor", 0xececea, 0.8),
        "slab": mat("UG_Slab", 0xd9d6d0, 0.85),
        "beam": mat("UG_Beam", 0xc9c6c0, 0.85),
        "ceiling": mat("UG_Ceiling", 0xdedbd5, 0.85),
        "pfloor": mat("UG_PlatformFloor", 0xe8e6e0, 0.8),
        "yellow": mat("UG_Zone", 0xe5b84a, 0.7),
        "salmon": mat("UG_Salmon", 0xc9704e, 0.85),
        "stripe": mat("UG_Stripe", 0x2f5fd0, 0.6),
        "grey": mat("UG_Grey", 0x8a8d92, 0.8),
        "dark": mat("UG_Dark", 0x3e4146, 0.7),
        "tunnel": mat("UG_Tunnel", 0x5c6066, 0.9),
        "black": mat("UG_Black", 0x151618, 0.7),
        "white": mat("UG_White", 0xf4f4f0, 0.6),
        "lightgrey": mat("UG_LightGrey", 0xc8c8c4, 0.6),
        "mid": mat("UG_Mid", 0xb0b2b0, 0.7),
        "train": mat("UG_Train", 0xf2c230, 0.5),
        "band": mat("UG_WindowBand", 0x1e1e22, 0.4),
        "door": mat("UG_TrainDoor", 0xf4f4f0, 0.5),
        "seat": mat("UG_Seat", 0x2b4bd6, 0.9),
        "bench": mat("UG_Bench", 0x2d50d8, 0.8),
        "wood": mat("UG_EscWood", 0x7a5a3a, 0.8),
        "nosing": mat("UG_Nosing", 0xe8ad22, 0.6),
        "glass": mat("UG_Glass", 0x2a3340, 0.3),
        "mullion": mat("UG_Mullion", 0xc8c8c4, 0.5),
        "brick": mat("UG_Brick", 0x8c4a3a, 0.9),
        "purple": mat("UG_Purple", 0x8a3fc8, 0.7),
        "red": mat("UG_Red", 0xc8302a, 0.7),
        "steel": mat("UG_Steel", 0x9a9ea4, 0.5, 0.2),
        "rail": mat("UG_Rail", 0x9a9ea4, 0.4, 0.3),
        "sleeper": mat("UG_Sleeper", 0x5a524a, 0.9),
        "ballast": mat("UG_Ballast", 0x4a4c50, 0.95),
        "concrete": mat("UG_StairConcrete", 0xb8b9b6, 0.85),
        "grate": mat("UG_Grate", 0x70767c, 0.6, 0.3),
        "oak": mat("UG_Oak", 0xa07a4a, 0.8),
        "green": mat("UG_Green", 0x2fa050, 0.7),
        "orange": mat("UG_Orange", 0xe07a2a, 0.6),
        "pink": mat("UG_Pink", 0xe050a0, 0.6),
        "cyan": mat("UG_Cyan", 0x30c0d0, 0.6),
        "cabinet": mat("UG_Cabinet", 0x3a1c4a, 0.7),
        "carpet": mat("UG_Carpet", 0x121214, 0.95),
        "cream": mat("UG_Cream", 0xf0e6c8, 0.9),
        "frame": mat("UG_Frame", 0x6b4a2e, 0.8),
        "olive": mat("UG_Olive", 0x6f7a5a, 0.8),
        "screenoff": mat("UG_ScreenOff", 0x1a2030, 0.3),
        "roundel": mat("UG_RoundelRed", 0xd8242a, 0.6),
        "roundelblue": mat("UG_RoundelBlue", 0x1b3f9e, 0.6),
        # emissives (gs_keep: exported as their own material, no light needed)
        "tube": mat("UG_Tube", 0xfaf8f0, 0.4, 0.0, 0xfff6e0, 1.6),
        "exit": mat("UG_Exit", 0x38d060, 0.4, 0.0, 0x38d060, 1.4),
        "board_o": mat("UG_BoardOrange", 0xff8a1e, 0.4, 0.0, 0xff8a1e, 1.5),
        "board_p": mat("UG_BoardPink", 0xff3fa4, 0.4, 0.0, 0xff3fa4, 1.5),
        "screen": mat("UG_Screen", 0x5fe0ff, 0.3, 0.0, 0x4fd0ff, 1.2),
        "neon_m": mat("UG_NeonMagenta", 0xff40c0, 0.3, 0.0, 0xff40c0, 1.6),
        "neon_c": mat("UG_NeonCyan", 0x40e0ff, 0.3, 0.0, 0x40e0ff, 1.6),
        "fire": mat("UG_Fire", 0xff9a30, 0.3, 0.0, 0xff8020, 1.8),
        "pendant": mat("UG_Pendant", 0xfff0c8, 0.3, 0.0, 0xfff0c8, 1.8),
        "cross": mat("UG_GreenCross", 0x30e060, 0.3, 0.0, 0x30e060, 1.2),
        "headlight": mat("UG_Headlight", 0xfff4d8, 0.2, 0.0, 0xfff4d8, 1.0),
    }


# ---------------------------------------------------------------- helpers

def bx(b, m, x0, x1, y0, y1, z0, z1, **kw):
    """Box by extents (any order)."""
    x0, x1 = sorted((x0, x1))
    y0, y1 = sorted((y0, y1))
    z0, z1 = sorted((z0, z1))
    if x1 - x0 < 1e-4 or y1 - y0 < 1e-4 or z1 - z0 < 1e-4:
        return
    b.box(m, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, **kw)


def quad4(b, m, pts):
    f = b.bm.faces.new([b.bm.verts.new(Vector(p)) for p in pts])
    b._tag([f], m)
    return f


def hrect(b, m, x0, x1, z0, z1, y):
    """Horizontal quad facing up."""
    x0, x1 = sorted((x0, x1))
    z0, z1 = sorted((z0, z1))
    return quad4(b, m, [(x0, y, z0), (x0, y, z1), (x1, y, z1), (x1, y, z0)])


def rect(b, m, o, Uv, Vv, u0, u1, v0, v1):
    """One quad on the plane through o spanned by U, V (normal U x V)."""
    o, Uv, Vv = Vector(o), Vector(Uv), Vector(Vv)
    return quad4(b, m, [o + Uv * u0 + Vv * v0, o + Uv * u1 + Vv * v0, o + Uv * u1 + Vv * v1, o + Uv * u0 + Vv * v1])


def frame(normal, up=None):
    """(U, V) for a sign whose face normal is `normal`: U runs to the
    reader's right, V up; the floor's default reads for someone facing
    north (up = -z)."""
    n = Vector(normal)
    if up is None:
        up = Vector((0, 0, -1)) if abs(n.y) > 0.5 else Vector((0, 1, 0))
    V = Vector(up)
    return V.cross(n), V


def panel(b, m, c, normal, w, h, o=0.0, up=None):
    """A w x h quad centred on c, facing `normal`, o out from c."""
    Uv, Vv = frame(normal, up)
    o3 = Vector(c) + Vector(normal) * o
    return rect(b, m, o3, Uv, Vv, -w / 2, w / 2, -h / 2, h / 2)


def rects(grid):
    """Greedy rectangle cover of a grid of keys (None = empty):
    [(key, i0, i1, j0, j1)] in cells."""
    H, W = len(grid), len(grid[0])
    used = [[False] * W for _ in range(H)]
    out = []
    for j in range(H):
        for i in range(W):
            if used[j][i] or grid[j][i] is None:
                continue
            k = grid[j][i]
            i1 = i
            while i1 + 1 < W and not used[j][i1 + 1] and grid[j][i1 + 1] == k:
                i1 += 1
            j1 = j
            while j1 + 1 < H and all(not used[j1 + 1][x] and grid[j1 + 1][x] == k for x in range(i, i1 + 1)):
                j1 += 1
            for y in range(j, j1 + 1):
                for x in range(i, i1 + 1):
                    used[y][x] = True
            out.append((k, i, i1 + 1, j, j1 + 1))
    return out


def rects2(grid):
    """rects() row-major and column-major, whichever needs fewer quads."""
    a = rects(grid)
    H, W = len(grid), len(grid[0])
    t = [[grid[j][i] for j in range(H)] for i in range(W)]
    c = [(k, j0, j1, i0, i1) for (k, i0, i1, j0, j1) in rects(t)]
    return a if len(a) <= len(c) else c


FONT = {
    "^": "..#.. .#.#. #...# ..... ..... ..... .....",
    "A": ".###. #...# #...# ##### #...# #...# #...#", "B": "####. #...# #...# ####. #...# #...# ####.",
    "C": ".#### #.... #.... #.... #.... #.... .####", "D": "####. #...# #...# #...# #...# #...# ####.",
    "E": "##### #.... #.... ####. #.... #.... #####", "F": "##### #.... #.... ####. #.... #.... #....",
    "G": ".#### #.... #.... #.### #...# #...# .####", "H": "#...# #...# #...# ##### #...# #...# #...#",
    "I": "##### ..#.. ..#.. ..#.. ..#.. ..#.. #####", "J": "..### ...#. ...#. ...#. ...#. #..#. .##..",
    "K": "#...# #..#. #.#.. ##... #.#.. #..#. #...#", "L": "#.... #.... #.... #.... #.... #.... #####",
    "M": "#...# ##.## #.#.# #.#.# #...# #...# #...#", "N": "#...# ##..# #.#.# #..## #...# #...# #...#",
    "O": ".###. #...# #...# #...# #...# #...# .###.", "P": "####. #...# #...# ####. #.... #.... #....",
    "Q": ".###. #...# #...# #...# #.#.# #..#. .##.#", "R": "####. #...# #...# ####. #.#.. #..#. #...#",
    "S": ".#### #.... #.... .###. ....# ....# ####.", "T": "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..",
    "U": "#...# #...# #...# #...# #...# #...# .###.", "V": "#...# #...# #...# #...# #...# .#.#. ..#..",
    "W": "#...# #...# #...# #.#.# #.#.# ##.## #...#", "X": "#...# #...# .#.#. ..#.. .#.#. #...# #...#",
    "Y": "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..", "Z": "##### ....# ...#. ..#.. .#... #.... #####",
    "0": ".###. #...# #..## #.#.# ##..# #...# .###.", "1": "..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.",
    "2": ".###. #...# ....# ...#. ..#.. .#... #####", "3": "##### ...#. ..#.. ...#. ....# #...# .###.",
    "4": "...#. ..##. .#.#. #..#. ##### ...#. ...#.", "5": "##### #.... ####. ....# ....# #...# .###.",
    "6": "..##. .#... #.... ####. #...# #...# .###.", "7": "##### ....# ...#. ..#.. .#... .#... .#...",
    "8": ".###. #...# #...# .###. #...# #...# .###.", "9": ".###. #...# #...# .#### ....# ...#. .##..",
    " ": "..... ..... ..... ..... ..... ..... .....", "-": "..... ..... ..... ##### ..... ..... .....",
    ".": "..... ..... ..... ..... ..... .##.. .##..", ":": "..... .##.. .##.. ..... .##.. .##.. .....",
    "&": ".##.. #..#. #..#. .##.. #.#.# #..#. .##.#", "!": "..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..",
    ">": "#.... .#... ..#.. ...#. ..#.. .#... #....", "<": "....# ...#. ..#.. .#... ..#.. ...#. ....#",
    "/": "....# ....# ...#. ..#.. .#... #.... #....", "'": "..#.. ..#.. ..... ..... ..... ..... .....",
    ",": "..... ..... ..... ..... .##.. .##.. ..#..",
}
FONT = {k: v.split() for k, v in FONT.items()}


def text_width(s, h):
    return (len(s) * 6 - 1) * h / 7


def text(b, m, s, c, normal, h, o=0.012, align="c", up=None):
    """5x7 pixel lettering as merged quads, `h` tall, centred on c (align
    c), starting at c (l) or ending at c (r), o out along the normal."""
    s = s.upper()
    rows, cols = 7, len(s) * 6 - 1
    grid = [[None] * cols for _ in range(rows)]
    for ci, ch in enumerate(s):
        g = FONT.get(ch, FONT[" "])
        for r in range(7):
            for k in range(5):
                if g[r][k] == "#":
                    grid[r][ci * 6 + k] = 1
    cell = h / 7
    W = cols * cell
    Uv, Vv = frame(normal, up)
    c = Vector(c) + Vector(normal) * o
    if align == "c":
        org = c - Uv * (W / 2) - Vv * (h / 2)
    elif align == "l":
        org = c - Vv * (h / 2)
    else:
        org = c - Uv * W - Vv * (h / 2)
    for (_k, i0, i1, j0, j1) in rects2(grid):
        rect(b, m, org, Uv, Vv, i0 * cell, i1 * cell, (7 - j1) * cell, (7 - j0) * cell)
    return W


_IMG = {}


def image_cells(path, crop, cx, cy):
    """Average an image (optionally cropped: x0, y0, x1, y1 from the top
    left) down to cy rows x cx columns of sRGB rgb, alpha over white."""
    key = (path, crop, cx, cy)
    if key in _IMG:
        return _IMG[key]
    img = bpy.data.images.load(path, check_existing=True)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
    if crop:
        x0, y0, x1, y1 = crop
        px = px[y0:y1, x0:x1]
    a = px[..., 3:4]
    rgb = px[..., :3] * a + (1 - a)
    H, W = rgb.shape[:2]
    out = np.zeros((cy, cx, 3), dtype=np.float32)
    for j in range(cy):
        for i in range(cx):
            blk = rgb[j * H // cy:max(j * H // cy + 1, (j + 1) * H // cy), i * W // cx:max(i * W // cx + 1, (i + 1) * W // cx)]
            out[j, i] = blk.reshape(-1, 3).mean(0)
    _IMG[key] = out
    return out


def mosaic_mat(hx):
    return mat("UG_M%06x" % hx, hx, 0.8)


def troll_poster(b, PAL, c, normal, w, h, bg, cells=30, o=0.012, up=None, crop=(210, 190, 810, 790)):
    """Trollface line art as a cell mosaic on a coloured backing (none when
    bg is None): black lines and the white inside of the face; the white
    outside is skipped so the backing shows."""
    g = image_cells(ART_TROLL, crop, cells, cells)
    lum = g.mean(axis=2)
    key = [[("k" if lum[j, i] < 0.6 else "w") for i in range(cells)] for j in range(cells)]
    # flood the outside white from the border on a fine grid (the thin
    # outline breaks up at poster resolution and the flood would leak into
    # the face), then a cell is outside when most of it is
    F = 160
    fine = image_cells(ART_TROLL, crop, F, F).mean(axis=2) > 0.85
    out = np.zeros((F, F), dtype=bool)
    stack = [(j, i) for j in range(F) for i in range(F) if (j in (0, F - 1) or i in (0, F - 1)) and fine[j, i]]
    while stack:
        j, i = stack.pop()
        if out[j, i] or not fine[j, i]:
            continue
        out[j, i] = True
        for dj, di in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            jj, ii = j + dj, i + di
            if 0 <= jj < F and 0 <= ii < F and not out[jj, ii]:
                stack.append((jj, ii))
    outside = [[out[j * F // cells:(j + 1) * F // cells, i * F // cells:(i + 1) * F // cells].mean() > 0.5 and key[j][i] == "w"
                for i in range(cells)] for j in range(cells)]
    grid = [[None if outside[j][i] else key[j][i] for i in range(cells)] for j in range(cells)]
    REG.face("poster@%.1f,%.1f,%.1f" % tuple(c), "wall", c, normal, w, h)
    if bg is not None:
        panel(b, bg, c, normal, w, h, o, up=up)
    Uv, Vv = frame(normal, up)
    org = Vector(c) + Vector(normal) * (o + 0.006) - Uv * (w / 2) - Vv * (h / 2)
    cw, ch = w / cells, h / cells
    for (k, i0, i1, j0, j1) in rects2(grid):
        rect(b, PAL["black"] if k == "k" else PAL["white"], org, Uv, Vv, i0 * cw, i1 * cw, (cells - j1) * ch, (cells - j0) * ch)


ART_GENERAL = os.path.join(OUT_DIR, "..", "ui", "western", "troll-general.jpg")
GENERAL_ASPECT = 900 / 1077   # the photo's width / height


def portrait_mat(name, c, normal, w, h):
    """The general's actual photo (ui/western/troll-general.jpg), embedded
    in the GLB. Kept out of the vertex paint (gs_keep) and out of RETEXTURE,
    so the game shows it as exported. finish() gives every face planar UVs
    in metres (game z, y on an x-facing wall); a Mapping node (exported as
    KHR_texture_transform) turns those into 0..1 across this one canvas."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m["gs_hex"] = 0xffffff
    m["gs_keep"] = True
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 1.0
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "UVMap"
    mp = nt.nodes.new("ShaderNodeMapping")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(ART_GENERAL, check_existing=True)
    tex.extension = "CLIP"
    # u runs to the viewer's right: -z on a +x-facing wall, +z on a -x one
    su = -1.0 if normal[0] > 0 else 1.0
    mp.inputs["Scale"].default_value = (su / w, 1.0 / h, 1.0)
    mp.inputs["Location"].default_value = (0.5 - su * c[2] / w, 0.5 - c[1] / h, 0.0)
    nt.links.new(uvn.outputs["UV"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return m


def general_portrait(b, PAL, c, normal, h, o=0.0, border=0.08):
    """The troll general's photo, h tall at its own aspect, in a frame
    that hugs it: the frame is the canvas plus `border` all round. `normal`
    is +-x (the lounges' back walls). Returns the frame's outer size."""
    w = h * GENERAL_ASPECT
    x, y, z = c
    nx = normal[0]
    REG.face("portrait@%.1f,%.1f,%.1f" % tuple(c), "wall", c, normal, w + 2 * border, h + 2 * border)
    bx(b, PAL["frame"], min(x - nx * 0.06, x), max(x - nx * 0.06, x), y - h / 2 - border, y + h / 2 + border,
       z - w / 2 - border, z + w / 2 + border)
    panel(b, portrait_mat("UG_Portrait%s" % ("W" if nx > 0 else "E"), c, normal, w, h), c, normal, w, h, o)
    return w + 2 * border, h + 2 * border


def sub_rects(rs, hole):
    """Axis-aligned rectangles (x0, x1, z0, z1) minus a hole."""
    hx0, hx1, hz0, hz1 = hole
    out = []
    for (x0, x1, z0, z1) in rs:
        if hx1 <= x0 or hx0 >= x1 or hz1 <= z0 or hz0 >= z1:
            out.append((x0, x1, z0, z1))
            continue
        if z0 < hz0:
            out.append((x0, x1, z0, hz0))
        if hz1 < z1:
            out.append((x0, x1, hz1, z1))
        zz0, zz1 = max(z0, hz0), min(z1, hz1)
        if x0 < hx0:
            out.append((x0, hx0, zz0, zz1))
        if hx1 < x1:
            out.append((hx1, x1, zz0, zz1))
    return [r for r in out if r[1] - r[0] > 1e-4 and r[3] - r[2] > 1e-4]


def slab_minus(b, m, x0, x1, z0, z1, y0, y1, holes):
    rs = [(min(x0, x1), max(x0, x1), min(z0, z1), max(z0, z1))]
    for h in holes:
        rs = sub_rects(rs, h)
    for (a, c, d, e) in rs:
        bx(b, m, a, c, y0, y1, d, e)
    return rs


def wall_z(b, m, xa, xb, y0, y1, z0, z1, doors=()):
    """Wall running along z between xa..xb, with doorways (zc, w, h)."""
    z0, z1 = sorted((z0, z1))
    cur = z0
    for (zc, w, h) in sorted(doors):
        bx(b, m, xa, xb, y0, y1, cur, zc - w / 2)
        bx(b, m, xa, xb, y0 + h, y1, zc - w / 2, zc + w / 2)
        cur = zc + w / 2
    bx(b, m, xa, xb, y0, y1, cur, z1)


def wall_x(b, m, za, zb, y0, y1, x0, x1, doors=()):
    x0, x1 = sorted((x0, x1))
    cur = x0
    for (xc, w, h) in sorted(doors):
        bx(b, m, cur, xc - w / 2, y0, y1, za, zb)
        bx(b, m, xc - w / 2, xc + w / 2, y0 + h, y1, za, zb)
        cur = xc + w / 2
    bx(b, m, cur, x1, y0, y1, za, zb)


def band_z(b, m, x, sign, y0, y1, z0, z1, doors=(), o=0.01):
    """A painted band on a wall at x (facing sign), cut round doorways."""
    z0, z1 = sorted((z0, z1))
    Uv, Vv = frame((sign, 0, 0))
    cur = z0
    segs = []
    for (zc, w, h) in sorted(doors):
        if h > y0:
            segs.append((cur, zc - w / 2))
            if h < y1:
                rect(b, m, Vector((x + sign * o, 0, 0)), Uv, Vv, *sorted((-sign * (zc - w / 2), -sign * (zc + w / 2))), max(y0, h), y1)
            cur = zc + w / 2
    segs.append((cur, z1))
    for (a, c) in segs:
        if c - a > 1e-3:
            rect(b, m, Vector((x + sign * o, 0, 0)), Uv, Vv, *sorted((-sign * a, -sign * c)), y0, y1)


def band_x(b, m, z, sign, y0, y1, x0, x1, doors=(), o=0.01):
    x0, x1 = sorted((x0, x1))
    Uv, Vv = frame((0, 0, sign))
    cur = x0
    segs = []
    for (xc, w, h) in sorted(doors):
        if h > y0:
            segs.append((cur, xc - w / 2))
            if h < y1:
                rect(b, m, Vector((0, 0, z + sign * o)), Uv, Vv, *sorted((sign * (xc - w / 2), sign * (xc + w / 2))), max(y0, h), y1)
            cur = xc + w / 2
    segs.append((cur, x1))
    for (a, c) in segs:
        if c - a > 1e-3:
            rect(b, m, Vector((0, 0, z + sign * o)), Uv, Vv, *sorted((sign * a, sign * c)), y0, y1)


def strip(b, m, prof, z0, z1):
    """Quads between consecutive (x, y) profile points, extruded z0..z1."""
    for (p0, p1) in zip(prof[:-1], prof[1:]):
        quad4(b, m, [(p0[0], p0[1], z0), (p1[0], p1[1], z0), (p1[0], p1[1], z1), (p0[0], p0[1], z1)])


def strip_x(b, m, prof, x0, x1):
    """Same, profile is (z, y), extruded x0..x1."""
    for (p0, p1) in zip(prof[:-1], prof[1:]):
        quad4(b, m, [(x0, p0[1], p0[0]), (x1, p0[1], p0[0]), (x1, p1[1], p1[0]), (x0, p1[1], p1[0])])


def disc(b, m, c, normal, r, seg=24, o=0.0):
    Uv, Vv = frame(normal)
    o3 = Vector(c) + Vector(normal) * o
    pts = [o3 + Uv * (r * math.cos(2 * math.pi * i / seg)) + Vv * (r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    quad4(b, m, pts)


def ring(b, m, c, normal, r0, r1, seg=24, o=0.0):
    Uv, Vv = frame(normal)
    o3 = Vector(c) + Vector(normal) * o
    for i in range(seg):
        a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
        quad4(b, m, [o3 + Uv * (r0 * math.cos(a0)) + Vv * (r0 * math.sin(a0)), o3 + Uv * (r1 * math.cos(a0)) + Vv * (r1 * math.sin(a0)),
                     o3 + Uv * (r1 * math.cos(a1)) + Vv * (r1 * math.sin(a1)), o3 + Uv * (r0 * math.cos(a1)) + Vv * (r0 * math.sin(a1))])


def roundel(b, PAL, c, normal, r=0.5, label="UNDERGRIN"):
    """The UNDERGRIN roundel: red ring, blue bar, white lettering (none on
    the small ones)."""
    REG.face("roundel@%.1f,%.1f,%.1f" % tuple(c), "wall", c, normal, 2 * r, 2 * r)
    ring(b, PAL["roundel"], c, normal, r * 0.62, r, seg=16, o=0.015)
    panel(b, PAL["roundelblue"], c, normal, r * 2.3, r * 0.42, o=0.03)
    if label and r >= 0.4:
        text(b, PAL["white"], label, c, normal, r * 0.26, o=0.045)


def tube_light(b, PAL, x, z, y, along="x", L=1.2):
    if along == "x":
        rect(b, PAL["tube"], (x - L / 2, y, z - 0.08), (1, 0, 0), (0, 0, 1), 0, L, 0, 0.16)
    else:
        rect(b, PAL["tube"], (x - 0.08, y, z - L / 2), (1, 0, 0), (0, 0, 1), 0, 0.16, 0, L)


def exit_sign(b, PAL, c, normal, w=0.7):
    """EXIT: a dark box with green lit lettering, hung flat on a wall or
    from a ceiling bracket."""
    REG.face("exit@%.1f,%.1f,%.1f" % tuple(c), "wall", c, normal, w, w * 0.4)
    panel(b, PAL["black"], c, normal, w, w * 0.4, o=0.0)
    text(b, PAL["exit"], "EXIT", c, normal, w * 0.26, o=0.012)


def vault_y(x, span=16.0, rise=3.0, y0=HALL_WALL):
    R = (span * span + rise * rise) / (2 * rise)
    yc = y0 + rise - R
    return yc + math.sqrt(max(0.0, R * R - x * x))


@registered("bench")
def bench(b, PAL, x, z, y, along="x", L=2.4, back=1):
    """Blue slatted bench on black legs, 2.4 long (the Metro one); `back`
    is the side (+-1 across it) its back is on."""
    if back < 0:
        # draw it turned: mirror the across offsets
        return _bench_flip(b, PAL, x, z, y, along, L)
    w = L if along == "x" else 0.55
    d = 0.55 if along == "x" else L
    if along == "x":
        bx(b, PAL["bench"], x - L / 2, x + L / 2, y + 0.42, y + 0.47, z - 0.28, z + 0.28)
    else:
        bx(b, PAL["bench"], x - 0.28, x + 0.28, y + 0.42, y + 0.47, z - L / 2, z + L / 2)
    # back slats
    if along == "x":
        bx(b, PAL["bench"], x - L / 2, x + L / 2, y + 0.6, y + 0.9, z + 0.22, z + 0.28)
    else:
        bx(b, PAL["bench"], x + 0.22, x + 0.28, y + 0.6, y + 0.9, z - L / 2, z + L / 2)
    for s in (-1, 1):
        if along == "x":
            lx = x + s * (L / 2 - 0.3)
            bx(b, PAL["black"], lx - 0.04, lx + 0.04, y, y + 0.42, z - 0.25, z + 0.25)
            bx(b, PAL["black"], lx - 0.04, lx + 0.04, y + 0.42, y + 0.95, z + 0.2, z + 0.28)
        else:
            lz = z + s * (L / 2 - 0.3)
            bx(b, PAL["black"], x - 0.25, x + 0.25, y, y + 0.42, lz - 0.04, lz + 0.04)
            bx(b, PAL["black"], x + 0.2, x + 0.28, y + 0.42, y + 0.95, lz - 0.04, lz + 0.04)


def _bench_flip(b, PAL, x, z, y, along, L):
    if along == "x":
        bx(b, PAL["bench"], x - L / 2, x + L / 2, y + 0.42, y + 0.47, z - 0.28, z + 0.28)
        bx(b, PAL["bench"], x - L / 2, x + L / 2, y + 0.6, y + 0.9, z - 0.28, z - 0.22)
    else:
        bx(b, PAL["bench"], x - 0.28, x + 0.28, y + 0.42, y + 0.47, z - L / 2, z + L / 2)
        bx(b, PAL["bench"], x - 0.28, x - 0.22, y + 0.6, y + 0.9, z - L / 2, z + L / 2)
    for s in (-1, 1):
        if along == "x":
            lx = x + s * (L / 2 - 0.3)
            bx(b, PAL["black"], lx - 0.04, lx + 0.04, y, y + 0.42, z - 0.25, z + 0.25)
            bx(b, PAL["black"], lx - 0.04, lx + 0.04, y + 0.42, y + 0.95, z - 0.28, z - 0.2)
        else:
            lz = z + s * (L / 2 - 0.3)
            bx(b, PAL["black"], x - 0.25, x + 0.25, y, y + 0.42, lz - 0.04, lz + 0.04)
            bx(b, PAL["black"], x - 0.28, x - 0.2, y + 0.42, y + 0.95, lz - 0.04, lz + 0.04)


def steps_x(b, PAL, x0, x1, z_foot, n, rise, run, direction, y0, m=None, nosing=True):
    """Solid stair as one sawtooth prism (treads along z), yellow nosings."""
    m = m or PAL["concrete"]
    s = direction
    prof = [(z_foot, y0)]
    for i in range(n):
        za = z_foot + s * run * i
        prof.append((za, y0 + rise * (i + 1)))
        prof.append((za + s * run, y0 + rise * (i + 1)))
    z_top = z_foot + s * run * n
    prof.append((z_top, y0 - 0.02))
    b.prism(m, prof, x0, x1, axis="x")
    if nosing:
        for i in range(n):
            za = z_foot + s * run * i
            yt = y0 + rise * (i + 1)
            hrect(b, PAL["nosing"], x0 + 0.05, x1 - 0.05, za, za + s * 0.06, yt + 0.004)


def steps_z(b, PAL, z0, z1, x_foot, n, rise, run, direction, y0, m=None):
    """Stair rising along x (treads along x)."""
    m = m or PAL["concrete"]
    s = direction
    prof = [(x_foot, y0)]
    for i in range(n):
        xa = x_foot + s * run * i
        prof.append((xa, y0 + rise * (i + 1)))
        prof.append((xa + s * run, y0 + rise * (i + 1)))
    prof.append((x_foot + s * run * n, y0 - 0.02))
    b.prism(m, prof, z0, z1, axis="z")
    for i in range(n):
        xa = x_foot + s * run * i
        yt = y0 + rise * (i + 1)
        hrect(b, PAL["nosing"], xa, xa + s * 0.06, z0 + 0.05, z1 - 0.05, yt + 0.004)


def rail_run(b, PAL, a, c, y, h=1.1, m=None, posts=2.0):
    """Well rail: posts, top rail, mid rail (steel)."""
    m = m or PAL["steel"]
    a, c = Vector((a[0], y, a[1])), Vector((c[0], y, c[1]))
    L = (c - a).length
    n = max(1, math.ceil(L / posts))
    for i in range(n + 1):
        p = a.lerp(c, i / n)
        b.box(m, 0.05, h, 0.05, p.x, y, p.z)
    b.bar(m, (a.x, y + h - 0.025, a.z), (c.x, y + h - 0.025, c.z), 0.05)
    b.bar(m, (a.x, y + h * 0.5, a.z), (c.x, y + h * 0.5, c.z), 0.035)

