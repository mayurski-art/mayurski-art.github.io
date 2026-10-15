"""
Troll Ops — Undergrin, the Metro (2025) station, headless Blender.

Run with:
  blender --background --python build_undergrin.blender.py            (all seven)
  blender --background --python build_undergrin.blender.py -- shell trains

Writes ug-<name>.glb into this folder (shell, platforms, escalators, trains,
concourse, shops, plant), authored in MAP coordinates (placed at 0,0) from
UNDERGRIN-METRO.md sections 3-4: every number here is a copy of the doc's,
and maps.js (MAPS.undergrin) copies the same numbers for its colliders.
Change one, change the other.

The look is the "modded" full-bright Metro: every material is a flat colour
(none in map-models.js RETEXTURE, so it all folds into vertex paint), no
textures, no lights in the map: tube lights, EXIT signs, the GRINLINE board
and the pendant lamps are emissive paint. Axes: x east, z south, y up.
Levels: track 0, platform 0.95, concourse 6.0 (slab 5.6..6.0). The south
half is the north half turned 180 degrees about the origin (s = -1 below);
only the shop dressing differs.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
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
ESC_WELL = (-3.6, 3.6, -28.0, -17.0)
WSTAIR = dict(x0=-21.5, x1=-17.5, foot=-43.5, n=17, rise=0.3, run=0.5)
WSTAIR_WELL = (-21.5, -17.5, -40.0, -35.0)
PURPLE_WELL = (-21.0, -18.0, -10.0, -4.0)
LIGHT_WELL = (-4.0, 4.0, -4.0, 4.0)
COLS = [(sx * 6.0, z) for sx in (-1, 1) for z in (-40, -34, -22, -16)]
TRAIN_X = (-13.7, -10.3)
CAR_Z = (-35.5, -22.5)          # north train car centres (W bore, z -42..-16)
CAR_L, CAR_W = 12.5, 3.4
DOOR_OFF = (-4.0, 0.0, 4.0)
DOOR_W = 1.4
REPO = os.path.normpath(os.path.join(OUT_DIR, "..", "..", "..", ".."))
ART_TROLL = os.path.join(REPO, "assets", "pfp", "base", "og.webp")

# west shop row (z0, z1, name) and east; the doc's 4.3 table verbatim
SHOPS_W = [(-40, -26, "arcade"), (-26, -12, "grinbiss"), (-12, 0, "purple"), (0, 14, "lounge"), (14, 26, "apotrolle"), (26, 40, "books")]
SHOPS_E = [(-40, -26, "books"), (-26, -12, "apotrolle"), (-12, 0, "lounge"), (0, 12, "red"), (12, 26, "grinbiss"), (26, 40, "arcade")]


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
    panel(b, PAL["black"], c, normal, w, w * 0.4, o=0.0)
    text(b, PAL["exit"], "EXIT", c, normal, w * 0.26, o=0.012)


def vault_y(x, span=16.0, rise=3.0, y0=HALL_WALL):
    R = (span * span + rise * rise) / (2 * rise)
    yc = y0 + rise - R
    return yc + math.sqrt(max(0.0, R * R - x * x))


def bench(b, PAL, x, z, y, along="x", L=2.4):
    """Blue slatted bench on black legs, 2.4 long (the Metro one)."""
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


# ================================================================== SHELL

def tunnel(b, PAL, side, z0, z1, skip_outer=False, skip_inner=False):
    """Tunnel lining (inside faces) of a bore between z0..z1; the outer /
    inner straight wall can be left out for a doorway."""
    cx = BORE_CX[side]
    out_sgn = -1 if side == "W" else 1           # which x side is the outer wall
    hw = 2.25
    arc = [(hw * math.cos(math.pi * i / 10), 1.75 + hw * math.sin(math.pi * i / 10)) for i in range(11)]  # +x .. -x
    prof = [(hw, 0.0), (hw, 1.75)] + arc[1:-1] + [(-hw, 1.75), (-hw, 0.0)]
    pts = [(cx + px, py) for (px, py) in prof]
    for (p0, p1) in zip(pts[:-1], pts[1:]):
        vert = abs(p0[0] - p1[0]) < 1e-6 and abs(p0[1] - p1[1]) > 0.5
        if vert:
            sgn = 1 if p0[0] > cx else -1
            if (sgn == out_sgn and skip_outer) or (sgn == -out_sgn and skip_inner):
                continue
        quad4(b, PAL["tunnel"], [(p0[0], p0[1], z0), (p1[0], p1[1], z0), (p1[0], p1[1], z1), (p0[0], p0[1], z1)])


def portal(b, PAL, side, z, sgn):
    """Headwall over a tunnel mouth at z: the bore's rectangle minus the
    arch, from the lining's springing up to the station ceiling."""
    cx = BORE_CX[side]
    hw = 2.25
    pts = [(cx - hw, 1.75, z), (cx - hw, SLAB0, z), (cx + hw, SLAB0, z), (cx + hw, 1.75, z)]
    pts += [(cx + hw * math.cos(math.pi * i / 10), 1.75 + hw * math.sin(math.pi * i / 10), z) for i in range(1, 10)]
    quad4(b, PAL["grey"], pts)


def station_shell(b, PAL, s):
    """Everything in section 4.1 that is wall, slab or column, for the
    north station (s = 1) or its 180-degree twin (s = -1)."""
    X = lambda x: s * x
    Z = lambda z: s * z
    W = PAL["wall"]
    # outer walls: 1.5 m thick outside x +-22 / z +-44, platform level to the shop ceilings
    bx(b, W, X(-22), X(-23.5), 0, CEIL_SHOP + 0.3, Z(-44), Z(0))
    bx(b, W, X(22), X(23.5), 0, CEIL_SHOP + 0.3, Z(-44), Z(0))
    bx(b, W, X(-23.5), X(23.5), 0, CEIL_SHOP + 0.3, Z(-44), Z(-45.5))
    # brick accent band on the side-platform back walls and the end wall
    band_z(b, PAL["brick"], X(-22), s, P, 3.4, Z(-44), Z(-14))
    band_z(b, PAL["brick"], X(22), -s, P, 3.4, Z(-44), Z(-14))
    band_x(b, PAL["brick"], Z(-44), s, P, 3.4, X(-22), X(22))
    # a white rail strip and a blue stripe over the brick
    band_z(b, PAL["stripe"], X(-22), s, 3.45, 3.6, Z(-44), Z(-14))
    band_z(b, PAL["stripe"], X(22), -s, 3.45, 3.6, Z(-44), Z(-14))
    band_x(b, PAL["stripe"], Z(-44), s, 3.45, 3.6, X(-22), X(22))
    # the concourse slab over the north half, open at the wells
    holes = [ESC_WELL, WSTAIR_WELL, PURPLE_WELL, (LIGHT_WELL[0], LIGHT_WELL[1], LIGHT_WELL[2], 0.0)]
    holes = [(X(a), X(c), Z(d), Z(e)) for (a, c, d, e) in holes]
    holes = [(min(a, c), max(a, c), min(d, e), max(d, e)) for (a, c, d, e) in holes]
    for (a, c, d, e) in slab_minus(b, PAL["slab"], X(-22), X(22), Z(-44), Z(0), SLAB0, U, holes):
        hrect(b, PAL["floor"], a, c, d, e, U + 0.003)
    # columns on the island
    for (cxp, cz) in COLS:
        bx(b, PAL["grey"], X(cxp) - 0.35, X(cxp) + 0.35, P, SLAB0, Z(cz) - 0.35, Z(cz) + 0.35)
    # coffers: beams under the slab, clipped round the wells
    wells = holes[:2]
    for k in range(10):
        zc = Z(-43.0 + k * 3.2)
        for (a, c, d, e) in sub_rects(sub_rects([(-22.0, 22.0, zc - 0.14, zc + 0.14)], wells[0]), wells[1]):
            bx(b, PAL["beam"], a, c, SLAB0 - 0.32, SLAB0, d, e)
    for k in range(11):
        xc = X(-20.0 + k * 4.0)
        for (a, c, d, e) in sub_rects(sub_rects([(xc - 0.14, xc + 0.14, min(Z(-44), Z(-14)), max(Z(-44), Z(-14)))], wells[0]), wells[1]):
            bx(b, PAL["beam"], a, c, SLAB0 - 0.32, SLAB0, d, e)
    # tunnel portals in the station's south face (z -14) and the headwall
    for side in ("W", "E"):
        portal(b, PAL, side, Z(-14), s)
    # the fills either side of the north walkway (x -2..2, z -14..-8), platform to slab
    for (a, c) in ((-9.7, -2.0), (2.0, 9.7)):
        bx(b, W, X(a), X(c), 0, SLAB0, Z(-13.95), Z(-8))
    bx(b, W, X(-2), X(2), 3.0, SLAB0, Z(-13.95), Z(-8))        # walkway ceiling
    # the solid east of the E bore between the side platform's end and the far corridor
    bx(b, W, X(14.3), X(22), 0, SLAB0, Z(-13.95), Z(0))
    # plant room east wall segment on this half (the door is on the other half's wall)
    bx(b, W, X(9.4), X(9.7), 0, SLAB0, Z(-8), Z(0))
    # plant room north wall with its door (x -0.9..0.9), 2.2 tall
    wall_x(b, W, Z(-8.15), Z(-7.85), 0, SLAB0, X(-9.7), X(9.7), doors=[(0.0, 1.8, 2.2)])
    # plant room west wall (between the W bore and the room), door at z -4
    wall_z(b, W, X(-9.7), X(-9.4), 0, SLAB0, Z(-8), Z(0), doors=[(Z(-4), 1.8, 2.2)])
    # W bore tunnel lining z -14..0 (doors: outer at z -6 to the corridor, inner at z -4 to the plant room)
    side = "W" if s > 0 else "E"
    segs = [(-14, -6.9, False, False), (-6.9, -5.1, True, False), (-5.1, -4.9, False, False), (-4.9, -3.1, False, True), (-3.1, 0, False, False)]
    for (z0, z1, so, si) in segs:
        tunnel(b, PAL, side, Z(z0), Z(z1), skip_outer=so, skip_inner=si)
    # the E bore (its doors are on the other half)
    tunnel(b, PAL, "E" if s > 0 else "W", Z(-14), Z(0))
    # service corridor x -22..-15.75, z -12..0 at T: the wall to the bore, end walls
    wall_z(b, W, X(-15.75), X(-14.3), 0, SLAB0, Z(-12), Z(0), doors=[(Z(-6), 1.8, 2.2)])
    bx(b, W, X(-22), X(-15.75), 0, SLAB0, Z(-12.3), Z(-12))
    bx(b, W, X(-22), X(-15.75), 0, SLAB0, Z(0), Z(0.3))
    # the solid between the W side platform's end (z -14) and the corridor (z -12)
    bx(b, W, X(-22), X(-14.3), 0, SLAB0, Z(-14), Z(-12.3))
    # concourse: hall walls x +-16 (6..9) with doorways at z -33, -19 (hall) and -8 (atrium)
    hall_doors = [(Z(-33), 2.0, 2.6), (Z(-19), 2.0, 2.6), (Z(-8), 2.0, 2.6)]
    for sx in (-1, 1):
        xa, xb = X(sx * 16) - 0.15, X(sx * 16) + 0.15
        wall_z(b, W, xa, xb, U, ATRIUM_CEIL, Z(-16), Z(0), doors=[hall_doors[2]])
        wall_z(b, W, xa, xb, U, HALL_WALL, Z(-40), Z(-16), doors=hall_doors[:2])
        fs = -s * sx                                                   # into the hall
        # the shop-side strip from the hall wall top to the shop ceiling
        bx(b, W, X(sx * 16), X(sx * 16) - fs * 0.15, HALL_WALL, CEIL_SHOP, Z(-40), Z(-16))
        # paint: salmon band, blue stripe, on the hall face
        hx = X(sx * 16) + fs * 0.15
        band_z(b, PAL["salmon"], hx, fs, U + 1.0, U + 2.9, Z(-40), Z(-16), doors=hall_doors[:2])
        band_z(b, PAL["stripe"], hx, fs, U + 3.2, U + 3.35, Z(-40), Z(-16))
        band_z(b, PAL["salmon"], hx, fs, U + 1.0, U + 2.9, Z(-16), Z(0), doors=[hall_doors[2]])
        band_z(b, PAL["stripe"], hx, fs, U + 3.2, U + 3.35, Z(-16), Z(0))
        # upper atrium wall: a lunette window into the dark on this half
        for zc in (-9.0,):
            arcp = [Vector((hx, 10.0 + 4.0 * math.sin(math.pi * i / 12), Z(zc) + 4.0 * math.cos(math.pi * i / 12))) for i in range(13)]
            quad4(b, PAL["glass"], [Vector((hx + fs * 0.01, p.y, p.z)) for p in arcp])
            for (p0, p1) in zip(arcp[:-1], arcp[1:]):
                b.bar(PAL["mullion"], (hx + fs * 0.02, p0.y, p0.z), (hx + fs * 0.02, p1.y, p1.z), 0.12)
            b.bar(PAL["mullion"], (hx + fs * 0.02, 10.0, Z(zc) - 4.0), (hx + fs * 0.02, 10.0, Z(zc) + 4.0), 0.12)
            for sp in (-1.4, 1.4):
                b.bar(PAL["mullion"], (hx + fs * 0.02, 10.0, Z(zc) + sp), (hx + fs * 0.02, 10.0 + 4.0 * math.sin(math.acos(sp / 4.0)), Z(zc) + sp), 0.08)
    # hall north wall z -40 (U..12: the vault's tympanum), salmon above the band
    bx(b, W, X(-16.15), X(16.15), U, VAULT_CROWN + 0.3, Z(-40), Z(-40.3))
    band_x(b, PAL["salmon"], Z(-40), s, U + 1.0, U + 2.9, X(-16), X(16))
    band_x(b, PAL["stripe"], Z(-40), s, U + 3.2, U + 3.35, X(-16), X(16))
    band_x(b, PAL["salmon"], Z(-40), s, HALL_WALL + 0.2, VAULT_CROWN + 0.3, X(-16), X(16))
    # the atrium threshold at z -16: piers, the 14 m round arch (springing 7.5) and the spandrel to 15
    zt = Z(-16)
    for (a, c) in ((-16, -7), (7, 16)):
        bx(b, W, X(a), X(c), U, ATRIUM_CEIL, zt - 0.2, zt + 0.2)
    R = ARCH_SPAN / 2
    arcp = [(R * math.cos(math.pi * i / 14), ARCH_SPRING + R * math.sin(math.pi * i / 14)) for i in range(15)]  # +x .. -x
    for zz in (zt - 0.2, zt + 0.2):
        pts = [(-R, ARCH_SPRING, zz), (-R, ATRIUM_CEIL, zz), (R, ATRIUM_CEIL, zz), (R, ARCH_SPRING, zz)] + [(x, y, zz) for (x, y) in arcp[1:-1]]
        quad4(b, W, pts)
    for (p0, p1) in zip(arcp[:-1], arcp[1:]):
        quad4(b, PAL["salmon"], [(p0[0], p0[1], zt - 0.2), (p1[0], p1[1], zt - 0.2), (p1[0], p1[1], zt + 0.2), (p0[0], p0[1], zt + 0.2)])
    # salmon band and stripe on both faces of the threshold piers
    for (face_z, sign) in ((zt - 0.2 * s, -s), (zt + 0.2 * s, s)):
        for (a, c) in ((-16, -7), (7, 16)):
            band_x(b, PAL["salmon"], face_z, sign, U + 1.0, U + 2.9, X(a), X(c))
            band_x(b, PAL["stripe"], face_z, sign, U + 3.2, U + 3.35, X(a), X(c))
    # the hall's barrel skylight: glass, ribs every 4 m, purlins
    xs = [-16 + 32 * i / 16 for i in range(17)]
    prof = [(x, vault_y(x)) for x in xs]
    strip(b, PAL["glass"], prof, Z(-40), Z(-16))
    for k in range(6):
        zc = Z(-38 + 4 * k)
        rib = [(x, y - 0.22) for (x, y) in prof]
        strip(b, PAL["mullion"], rib, zc - 0.15, zc + 0.15)
        for zz in (zc - 0.15, zc + 0.15):
            for (p0, p1) in zip(prof[:-1], prof[1:]):
                quad4(b, PAL["mullion"], [(p0[0], p0[1] - 0.22, zz), (p1[0], p1[1] - 0.22, zz), (p1[0], p1[1], zz), (p0[0], p0[1], zz)])
    for x in (-12, -8, -4, 0, 4, 8, 12):
        y = vault_y(x)
        bx(b, PAL["mullion"], x - 0.1, x + 0.1, y - 0.2, y - 0.02, Z(-40), Z(-16))
    # the vault's edge beam over the hall walls
    for sx in (-1, 1):
        bx(b, PAL["salmon"], X(sx * 16) - 0.15, X(sx * 16) + 0.15, HALL_WALL - 0.05, HALL_WALL + 0.25, Z(-40), Z(-16))


def shop_walls(b, PAL):
    """Shop row walls (not mirrored: the two rows' partitions differ by
    2 m, 4.3): partitions 0.3 thick with a 1.8 doorway at x -19 / 19, end
    walls at z +-40, flat ceilings at 9.6."""
    W = PAL["wall"]
    for (sx, shops) in ((-1, SHOPS_W), (1, SHOPS_E)):
        xa, xb = sorted((sx * 22, sx * 16))
        parts = sorted({z for (z0, z1, _n) in shops for z in (z0, z1)})
        for z in parts:
            if abs(z) == 40:
                bx(b, W, xa, xb, U, CEIL_SHOP, z, z + (0.3 if z > 0 else -0.3))
            else:
                wall_x(b, W, z - 0.15, z + 0.15, U, CEIL_SHOP, xa, xb, doors=[(sx * 19, 1.8, 2.4)])
        bx(b, PAL["ceiling"], xa, xb, CEIL_SHOP, CEIL_SHOP + 0.3, -40, 40)


def build_shell(PAL):
    b = Builder()
    for s in (1, -1):
        station_shell(b, PAL, s)
    shop_walls(b, PAL)
    # the atrium ceiling at 15 with the 20 x 20 skylight grid (one piece)
    rect(b, PAL["ceiling"], (-16, ATRIUM_CEIL, -16), (1, 0, 0), (0, 0, 1), 0, 32, 0, 32)
    rect(b, PAL["glass"], (-10, ATRIUM_CEIL - 0.02, -10), (1, 0, 0), (0, 0, 1), 0, 20, 0, 20)
    for k in range(11):
        t = -10 + 2 * k
        bx(b, PAL["mullion"], t - 0.08, t + 0.08, ATRIUM_CEIL - 0.3, ATRIUM_CEIL - 0.02, -10, 10)
        bx(b, PAL["mullion"], -10, 10, ATRIUM_CEIL - 0.3, ATRIUM_CEIL - 0.02, t - 0.08, t + 0.08)
    bx(b, PAL["mullion"], -10.2, 10.2, ATRIUM_CEIL - 0.45, ATRIUM_CEIL - 0.02, -10.2, -9.9)
    bx(b, PAL["mullion"], -10.2, 10.2, ATRIUM_CEIL - 0.45, ATRIUM_CEIL - 0.02, 9.9, 10.2)
    bx(b, PAL["mullion"], -10.2, -9.9, ATRIUM_CEIL - 0.45, ATRIUM_CEIL - 0.02, -10.2, 10.2)
    bx(b, PAL["mullion"], 9.9, 10.2, ATRIUM_CEIL - 0.45, ATRIUM_CEIL - 0.02, -10.2, 10.2)
    # the light well's slab edge lining (the slab is cut; this is the reveal's paint)
    b.finish("ug-shell.glb", bake=False)


# ============================================================== PLATFORMS

def station_platforms(b, PAL, s):
    X = lambda x: s * x
    Z = lambda z: s * z
    F = PAL["pfloor"]
    # slabs 0..0.95: west side, island, east side
    for (a, c) in ((-22, -14.25), (-9.75, 9.75), (14.25, 22)):
        bx(b, F, X(a), X(c), T, P, Z(-44), Z(-14))
    # dark platform faces toward the bores, with the yellow edge strip + MIND THE GRIN
    for (xe, sgn) in ((-14.25, 1), (-9.75, -1), (9.75, 1), (14.25, -1)):
        # face normal points into the bore: for x -14.25 the bore is at +x
        nx = sgn
        Uv, Vv = frame((s * nx, 0, 0))
        rect(b, PAL["dark"], Vector((X(xe) + s * nx * 0.005, 0, 0)), Uv, Vv, *sorted((-s * nx * Z(-44), -s * nx * Z(-14))), T + 0.02, P)
        # the yellow line 0.12..0.45 in from the edge, the full length
        ya, yb = sorted((X(xe) - s * nx * 0.12, X(xe) - s * nx * 0.45))
        hrect(b, PAL["yellow"], ya, yb, Z(-44), Z(-14), P + 0.004)
        # MIND THE GRIN, twice per edge, inside the line, reading for someone facing the track
        for zc in (-36, -22):
            c = (X(xe) - s * nx * 1.0, P + 0.006, Z(zc))
            text(b, PAL["dark"], "MIND THE GRIN", c, (0, 1, 0), 0.5, o=0.0, up=(s * nx, 0, 0))
    # yellow zones: round the escalator foot and the west stair's foot
    hrect(b, PAL["yellow"], X(-8), X(8), Z(-31.5), Z(-25.5), P + 0.003)
    hrect(b, PAL["yellow"], X(-21.5), X(-17.5), Z(-44), Z(-43.5), P + 0.003)
    # bore floors: ballast bed, sleepers (top quads), rails
    for side in ("W", "E"):
        a, c = BORE_W[side]
        bx(b, PAL["ballast"], X(a), X(c), T - 0.3, T + 0.22, Z(-44), Z(0))
        cx = BORE_CX[side]
        for rx in (-0.72, 0.72):
            bx(b, PAL["rail"], X(cx + rx) - 0.035, X(cx + rx) + 0.035, T + 0.22, T + 0.36, Z(-44), Z(0))
        k = 0.35
        while k < 44:
            z = -44 + k
            hrect(b, PAL["sleeper"], X(cx) - 1.25, X(cx) + 1.25, Z(z) - 0.12, Z(z) + 0.12, T + 0.23)
            k += 0.7
    # track-level lamps are concourse's business; nothing here
    # bore-end stairs: at the empty bore's north end (E for the north station) up to both platforms
    e = "E" if s > 0 else "W"
    a, c = BORE_W["E"]
    # from the bore floor at x 11.75 west up to the island (x 9.75) and from 12.25 east up to the side platform
    steps_z(b, PAL, min(Z(-44), Z(-42.1)), max(Z(-44), Z(-42.1)), X(11.75), 4, 0.1825, 0.5, -s, T + 0.22)
    steps_z(b, PAL, min(Z(-44), Z(-42.1)), max(Z(-44), Z(-42.1)), X(12.25), 4, 0.1825, 0.5, s, T + 0.22)
    # the island's nose stair at z -14 down to the walkway, 4 steps
    steps_x(b, PAL, min(X(-1.5), X(1.5)), max(X(-1.5), X(1.5)), Z(-12.4), 4, 0.2375, 0.4, -s, T)
    # the walkway floor and the corridor floor
    bx(b, PAL["floor"], X(-2), X(2), T - 0.02, T, Z(-12.4), Z(-8))
    bx(b, PAL["floor"], X(-22), X(-15.75), T - 0.02, T, Z(-12), Z(0))


def build_platforms(PAL):
    b = Builder()
    for s in (1, -1):
        station_platforms(b, PAL, s)
    # the plant room floor
    bx(b, PAL["floor"], -9.75, 9.75, T - 0.02, T, -8, 8)
    b.finish("ug-platforms.glb", bake=False)


# ============================================================= ESCALATORS

def escalator_lane(b, PAL, xc, w, z_foot, n, rise, run, s, y0):
    """One lane: dark treads with yellow nosings, wood-brown balustrade
    panels with a black handrail, the comb plates and the top deck."""
    half = w / 2
    z_top = z_foot + s * run * n
    top = y0 + rise * n
    for i in range(n):
        za = z_foot + s * run * i
        yt = y0 + rise * (i + 1)
        # tread (top quad) and riser (quad)
        hrect(b, PAL["dark"], xc - half + 0.1, xc + half - 0.1, za, za + s * run, yt)
        rect(b, PAL["black"], (xc - half + 0.1, yt - rise, za), (1, 0, 0), (0, 1, 0), 0, w - 0.2, 0, rise)
        hrect(b, PAL["nosing"], xc - half + 0.1, xc + half - 0.1, za, za + s * 0.06, yt + 0.004)
    # comb plates
    bx(b, PAL["steel"], xc - half + 0.1, xc + half - 0.1, y0, y0 + 0.02, z_foot, z_foot - s * 0.8)
    bx(b, PAL["steel"], xc - half + 0.1, xc + half - 0.1, top, top + 0.02, z_top, z_top + s * 1.5)
    # balustrades: wood panels following the slope, a flat run at each end
    for side in (-1, 1):
        px = xc + side * (half - 0.05)
        prof = [(z_foot - s * 0.8, y0), (z_foot - s * 0.8, y0 + 1.0), (z_foot, y0 + 1.0), (z_top, top + 1.0), (z_top + s * 1.5, top + 1.0), (z_top + s * 1.5, top), (z_top, top), (z_foot, y0)]
        b.prism(PAL["wood"], prof, px - 0.05, px + 0.05, axis="x")
        hr = 1.02
        b.cyl(PAL["black"], 0.045, (px, y0 + hr, z_foot - s * 0.8), (px, y0 + hr, z_foot), seg=6)
        b.cyl(PAL["black"], 0.045, (px, y0 + hr, z_foot), (px, top + hr, z_top), seg=6)
        b.cyl(PAL["black"], 0.045, (px, top + hr, z_top), (px, top + hr, z_top + s * 1.5), seg=6)
    # the underside, clad: a sloping soffit box from the foot to the top
    prof = [(z_foot - s * 0.8, y0 - 0.02), (z_foot, y0 - 0.02), (z_top, top - 0.35), (z_top + s * 1.5, top - 0.35), (z_top + s * 1.5, top - 0.5), (z_foot - s * 0.8, y0 - 0.3)]
    b.prism(PAL["grey"], prof, xc - half, xc + half, axis="x")


def station_escalators(b, PAL, s):
    X = lambda x: s * x
    Z = lambda z: s * z
    # the twin escalators: feet z -27, rising south, tops z -18.5
    for xc in ESC["x"]:
        escalator_lane(b, PAL, X(xc), ESC["w"], Z(ESC["foot"]), ESC["n"], ESC["rise"], ESC["run"], s, P)
    # the well rails round the escalator well at the concourse: west, east and north edges
    a, c, d, e = ESC_WELL
    rail_run(b, PAL, (X(a), Z(d)), (X(a), Z(e)), U)
    rail_run(b, PAL, (X(c), Z(d)), (X(c), Z(e)), U)
    rail_run(b, PAL, (X(a), Z(d)), (X(c), Z(d)), U)
    # the west side stair: x -21.5..-17.5, foot z -43.5 on the platform, 17 x 0.3 / 0.5 heading south
    w = WSTAIR
    steps_x(b, PAL, min(X(w["x0"]), X(w["x1"])), max(X(w["x0"]), X(w["x1"])), Z(w["foot"]), w["n"], w["rise"], w["run"], s, P)
    # its open side: a wood balustrade + handrail on the x -17.5 edge, following the slope
    px = X(w["x1"]) - s * 0.06
    z_top = Z(w["foot"]) + s * w["run"] * w["n"]
    top = P + w["rise"] * w["n"]
    prof = [(Z(w["foot"]), P), (Z(w["foot"]), P + 1.0), (z_top, top + 1.0), (z_top, top - 0.3)]
    b.prism(PAL["wood"], prof, px - 0.06, px + 0.06, axis="x")
    b.cyl(PAL["black"], 0.045, (px, P + 1.02, Z(w["foot"])), (px, top + 1.02, z_top), seg=6)
    # well rails at the concourse round the stair well (east edge, north edge)
    a, c, d, e = WSTAIR_WELL
    rail_run(b, PAL, (X(c), Z(d)), (X(c), Z(e)), U)
    rail_run(b, PAL, (X(a), Z(d)), (X(c), Z(d)), U)
    # the purple room's steel stair: well x -21..-18, z -10..-4; bottom z -10 at T rising south to z -4 at U
    SP = {"grate": PAL["grate"], "yellow": PAL["nosing"], "steel": PAL["steel"], "toe": PAL["nosing"]}
    steel_stair(b, SP, 20, 0.3, 0.3, 3.0, Z(-10), direction=s, y0=T, x=X(-19.5), closed=True)
    a, c, d, e = PURPLE_WELL
    rail_run(b, PAL, (X(a), Z(d)), (X(a), Z(e)), U)
    rail_run(b, PAL, (X(c), Z(d)), (X(c), Z(e)), U)
    rail_run(b, PAL, (X(a), Z(d)), (X(c), Z(d)), U)
    # the light-well rails, this half's two runs (x +-4 from z -4..0, the z -4 edge)
    rail_run(b, PAL, (X(-4), Z(-4)), (X(4), Z(-4)), U)
    rail_run(b, PAL, (X(-4), Z(-4)), (X(-4), Z(0)), U)
    rail_run(b, PAL, (X(4), Z(-4)), (X(4), Z(0)), U)


def build_escalators(PAL):
    b = Builder()
    for s in (1, -1):
        station_escalators(b, PAL, s)
    b.finish("ug-escalators.glb", bake=False)


# ================================================================= TRAINS

def train_car(b, PAL, s, cz, cab_end):
    """One car of the north train (s = 1; s = -1 turns it into the south
    train's). cab_end: -1 cab on the north end, +1 south end, 0 none."""
    X = lambda x: s * x
    Z = lambda z: s * z
    xc = (TRAIN_X[0] + TRAIN_X[1]) / 2
    hw = CAR_W / 2
    L = CAR_L
    z0, z1 = cz - L / 2, cz + L / 2
    floor = P
    roof = P + 2.45
    # undercarriage (dark), bogies, the floor
    bx(b, PAL["dark"], X(xc - 1.45), X(xc + 1.45), T + 0.3, floor, Z(z0 + 0.2), Z(z1 - 0.2))
    for bz in (cz - 4.2, cz + 4.2):
        bx(b, PAL["black"], X(xc - 1.2), X(xc + 1.2), T + 0.1, T + 0.5, Z(bz - 1.1), Z(bz + 1.1))
        for wz in (bz - 0.75, bz + 0.75):
            for sx in (-1, 1):
                b.cyl(PAL["black"], 0.4, (X(xc + sx * 0.72), T + 0.4, Z(wz)), (X(xc + sx * 0.9), T + 0.4, Z(wz)), seg=10)
    bx(b, PAL["mid"], X(xc - hw + 0.08), X(xc + hw - 0.08), floor - 0.03, floor, Z(z0), Z(z1))
    # side walls: body panels between the door openings, a dark window band,
    # white door pillars, the door heads; both sides alike
    edges = [z0] + [e for d in DOOR_OFF for e in (cz + d - DOOR_W / 2, cz + d + DOOR_W / 2)] + [z1]
    for sx in (-1, 1):
        x = xc + sx * (hw - 0.04)
        for i in range(0, len(edges), 2):
            za, zb = edges[i], edges[i + 1]
            bx(b, PAL["train"], X(x) - 0.04, X(x) + 0.04, floor, roof, Z(za), Z(zb))
            # window band on the outside and inside faces
            for face in (sx, -sx):
                fx = x + face * 0.045
                Uv, Vv = frame((s * face, 0, 0))
                lo, hi = sorted((-s * face * Z(za + 0.18), -s * face * Z(zb - 0.18)))
                rect(b, PAL["band"], Vector((X(fx), 0, 0)), Uv, Vv, lo, hi, floor + 1.0, floor + 1.95)
        for d in DOOR_OFF:
            for dz in (-1, 1):
                pz = cz + d + dz * (DOOR_W / 2 + 0.07)
                bx(b, PAL["door"], X(x) - 0.05, X(x) + 0.05, floor, roof, Z(pz - 0.07), Z(pz + 0.07))
            bx(b, PAL["door"], X(x) - 0.05, X(x) + 0.05, floor + 2.1, roof, Z(cz + d - DOOR_W / 2), Z(cz + d + DOOR_W / 2))
            # the open leaves, slid into their pockets: a white strip on the outside face
            for face in (sx,):
                fx = x + face * 0.05
                Uv, Vv = frame((s * face, 0, 0))
                for dz in (-1, 1):
                    lo, hi = sorted((-s * face * Z(cz + d + dz * (DOOR_W / 2 + 0.14)), -s * face * Z(cz + d + dz * (DOOR_W / 2 + 0.14 + 0.7))))
                    rect(b, PAL["door"], Vector((X(fx), 0, 0)), Uv, Vv, lo, hi, floor + 0.05, floor + 2.05)
                    rect(b, PAL["band"], Vector((X(fx + face * 0.004), 0, 0)), Uv, Vv, lo + 0.12, hi - 0.12, floor + 1.0, floor + 1.85)
        # the yellow skirt line below the floor and the cant rail stripe
        fx = xc + sx * (hw - 0.0)
        Uv, Vv = frame((s * sx, 0, 0))
        lo, hi = sorted((-s * sx * Z(z0), -s * sx * Z(z1)))
        rect(b, PAL["train"], Vector((X(fx + sx * 0.005), 0, 0)), Uv, Vv, lo, hi, floor - 0.45, floor)
        rect(b, PAL["dark"], Vector((X(fx + sx * 0.012), 0, 0)), Uv, Vv, lo, hi, floor - 0.45, floor - 0.38)
    # roof: a shallow dome, light grey on top with the body's yellow at the eaves
    prof = [(xc - hw, roof - 0.01), (xc + hw, roof - 0.01), (xc + hw - 0.1, roof + 0.18), (xc + hw * 0.6, roof + 0.32), (xc - hw * 0.6, roof + 0.32), (xc - hw + 0.1, roof + 0.18)]
    b.prism(PAL["lightgrey"], [(X(px), py) for (px, py) in prof], Z(z0), Z(z1), axis="z")
    bx(b, PAL["grey"], X(xc - 0.6), X(xc + 0.6), roof + 0.32, roof + 0.5, Z(cz - 1.4), Z(cz + 1.4))
    # ceiling (inside) with the light strip
    rect(b, PAL["white"], (X(xc) - hw + 0.08, roof - 0.02, min(Z(z0), Z(z1))), (1, 0, 0), (0, 0, 1), 0, CAR_W - 0.16, 0, L)
    rect(b, PAL["tube"], (X(xc) - 0.25, roof - 0.03, min(Z(z0 + 0.6), Z(z1 - 0.6))), (1, 0, 0), (0, 0, 1), 0, 0.5, 0, L - 1.2)
    # ends: a cab (closed, windscreen, blind, lights) or a gangway opening
    for ez, end in ((z0, -1), (z1, 1)):
        ezw = Z(ez)
        if end == cab_end:
            bx(b, PAL["train"], X(xc - hw), X(xc + hw), floor, roof + 0.2, ezw - 0.06, ezw + 0.06)
            nrm = (0, 0, s * end)
            panel(b, PAL["band"], (X(xc), floor + 1.55, ezw), nrm, 2.6, 0.9, o=0.07)
            panel(b, PAL["black"], (X(xc), roof - 0.17, ezw), nrm, 2.0, 0.34, o=0.07)
            text(b, PAL["board_o"], "TROLLHALLA", (X(xc), roof - 0.17, ezw), nrm, 0.2, o=0.085)
            for sx in (-1, 1):
                panel(b, PAL["headlight"], (X(xc + sx * 1.2), floor + 0.45, ezw), nrm, 0.35, 0.18, o=0.07)
            panel(b, PAL["dark"], (X(xc), floor - 0.2, ezw), nrm, 3.2, 0.5, o=0.02)
            # the cab's back wall inside, a door
            bx(b, PAL["train"], X(xc - hw + 0.1), X(xc + hw - 0.1), floor, roof, ezw - end * s * 1.5 - 0.04, ezw - end * s * 1.5 + 0.04)
            panel(b, PAL["band"], (X(xc), floor + 1.5, ezw - end * s * 1.5), (0, 0, -s * end), 0.7, 0.6, o=0.05)
        else:
            # end wall with a 1.6 wide gangway opening
            for sx in (-1, 1):
                bx(b, PAL["train"], X(xc + sx * 0.8), X(xc + sx * hw), floor, roof + 0.2, ezw - 0.05, ezw + 0.05)
            bx(b, PAL["train"], X(xc - 0.8), X(xc + 0.8), roof - 0.3, roof + 0.2, ezw - 0.05, ezw + 0.05)
    # seats: blue benches along both walls between the doors, backs up the wall
    for sx in (-1, 1):
        for (za, zb) in ((z0 + 0.4, cz - 4.0 - DOOR_W / 2 - 0.15), (cz - 4.0 + DOOR_W / 2 + 0.15, cz - DOOR_W / 2 - 0.15),
                         (cz + DOOR_W / 2 + 0.15, cz + 4.0 - DOOR_W / 2 - 0.15), (cz + 4.0 + DOOR_W / 2 + 0.15, z1 - 0.4)):
            if zb - za < 0.8 or (cab_end == -1 and za < z0 + 1.6) or (cab_end == 1 and zb > z1 - 1.6):
                continue
            x_in = xc + sx * (hw - 0.1)
            bx(b, PAL["seat"], X(x_in), X(x_in - sx * 0.5), floor + 0.25, floor + 0.47, Z(za), Z(zb))
            bx(b, PAL["seat"], X(x_in), X(x_in - sx * 0.1), floor + 0.47, floor + 0.95, Z(za), Z(zb))
            bx(b, PAL["dark"], X(x_in), X(x_in - sx * 0.45), floor, floor + 0.25, Z(za + 0.1), Z(zb - 0.1))
    # grab poles at the doors and the inside posters
    for d in DOOR_OFF:
        for dz in (-0.95, 0.95):
            b.cyl(PAL["nosing"], 0.025, (X(xc), floor, Z(cz + d + dz)), (X(xc), roof, Z(cz + d + dz)), seg=6)


def build_trains(PAL):
    b = Builder()
    for s in (1, -1):
        train_car(b, PAL, s, CAR_Z[0], -1)
        train_car(b, PAL, s, CAR_Z[1], 1)
        # gangway bellows between the cars
        gz = (CAR_Z[0] + CAR_Z[1]) / 2
        xc = (TRAIN_X[0] + TRAIN_X[1]) / 2
        for sx in (-1, 1):
            bx(b, PAL["black"], s * (xc + sx * 0.85), s * (xc + sx * 1.0), P, P + 2.3, s * (gz - 0.5), s * (gz + 0.5))
        bx(b, PAL["black"], s * (xc - 1.0), s * (xc + 1.0), P + 2.2, P + 2.4, s * (gz - 0.5), s * (gz + 0.5))
        bx(b, PAL["mid"], s * (xc - 0.8), s * (xc + 0.8), P - 0.03, P, s * (gz - 0.5), s * (gz + 0.5))
        # posters inside: one trollface per car on the wall over the seats
        for cz in CAR_Z:
            troll_poster(b, PAL, (s * (TRAIN_X[0] + 0.1), P + 2.17, s * (cz - 2.0)), (s, 0, 0), 0.6, 0.4, PAL["stripe"], cells=16, o=0.0)
            troll_poster(b, PAL, (s * (TRAIN_X[1] - 0.1), P + 2.17, s * (cz + 2.0)), (-s, 0, 0), 0.6, 0.4, PAL["salmon"], cells=16, o=0.0)
    b.finish("ug-trains.glb", bake=False)


# ============================================================== CONCOURSE

def ticket_gate(b, PAL, x, z, y, along_x=True):
    """A gate cabinet 0.3 (x) x 1.2 (z) x 1.0 with glass paddles."""
    bx(b, PAL["dark"], x - 0.15, x + 0.15, y, y + 0.95, z - 0.6, z + 0.6)
    bx(b, PAL["white"], x - 0.17, x + 0.17, y + 0.95, y + 1.0, z - 0.62, z + 0.62)
    panel(b, PAL["exit"], (x, y + 1.0, z), (0, 1, 0), 0.12, 0.3, o=0.004)
    panel(b, PAL["glass"], (x + 0.22, y + 0.95, z), (1, 0, 0), 0.5, 0.5, o=0.0)
    panel(b, PAL["glass"], (x - 0.22, y + 0.95, z), (-1, 0, 0), 0.5, 0.5, o=0.0)


def pendant(b, PAL, x, z, y_ceil, drop):
    y = y_ceil - drop
    b.cyl(PAL["black"], 0.02, (x, y_ceil, z), (x, y + 0.4, z), seg=4)
    b.frustum(PAL["dark"], 0.3, 0.3, 1.2, 1.2, y, y + 0.4, x=x, z=z)
    disc(b, PAL["pendant"], (x, y + 0.01, z), (0, -1, 0), 0.55, seg=12)


def departure_board(b, PAL, x, z, y, facing):
    """GRINLINE departures: a dark box with lit orange + pink rows on both
    faces, hung on two rods."""
    w, h, d = 6.0, 1.5, 0.3
    bx(b, PAL["black"], x - w / 2, x + w / 2, y, y + h, z - d / 2, z + d / 2)
    rows = [("GRINLINE", "board_o", 0.2), ("TROLLHALLA  2", "board_p", 0.15), ("JEETSBURG   5", "board_o", 0.15),
            ("DUST BOWL   9", "board_o", 0.15), ("GRIN BEACH 14", "board_o", 0.15)]
    for nz in (-1, 1):
        yy = y + h - 0.25
        for (txt, mname, hh) in rows if nz == facing else rows[:1]:
            text(b, PAL[mname], txt, (x, yy, z + nz * d / 2), (0, 0, nz), hh, o=0.012)
            yy -= 0.27
    for rx in (-2.4, 2.4):
        b.cyl(PAL["black"], 0.02, (x + rx, y + h, z), (x + rx, ATRIUM_CEIL, z), seg=4)


def clock(b, PAL, c, normal):
    disc(b, PAL["white"], c, normal, 0.7, seg=24, o=0.05)
    ring(b, PAL["black"], c, normal, 0.64, 0.7, seg=24, o=0.06)
    Uv, Vv = frame(normal)
    o3 = Vector(c) + Vector(normal) * 0.07
    rect(b, PAL["black"], o3, Uv, Vv, -0.03, 0.03, -0.08, 0.5)
    rect(b, PAL["black"], o3, Uv, Vv, -0.08, 0.36, -0.025, 0.025)


def photo_booth(b, PAL, x, z, y, facing):
    bx(b, PAL["dark"], x - 0.6, x + 0.6, y, y + 2.2, z - 0.5, z + 0.5)
    panel(b, PAL["red"], (x, y + 0.95, z + facing * 0.5), (0, 0, facing), 0.7, 1.9, o=0.01)
    panel(b, PAL["white"], (x, y + 2.0, z + facing * 0.5), (0, 0, facing), 1.1, 0.3, o=0.01)
    text(b, PAL["black"], "PHOTO", (x, y + 2.0, z + facing * 0.5), (0, 0, facing), 0.16, o=0.02)


def ticket_machine(b, PAL, x, z, y, facing):
    bx(b, PAL["stripe"], x - 0.4, x + 0.4, y, y + 1.8, z - 0.3, z + 0.3)
    panel(b, PAL["screen"], (x, y + 1.25, z + facing * 0.3), (0, 0, facing), 0.5, 0.35, o=0.01)
    panel(b, PAL["white"], (x, y + 0.7, z + facing * 0.3), (0, 0, facing), 0.6, 0.5, o=0.01)
    text(b, PAL["black"], "TICKETS", (x, y + 1.6, z + facing * 0.3), (0, 0, facing), 0.1, o=0.012)


def newsstand(b, PAL, x, z, y):
    """3 x 2.4 kiosk: counter, roof, magazine rack, GRIN NEWS sign."""
    bx(b, PAL["olive"], x - 1.5, x + 1.5, y, y + 1.1, z - 1.2, z + 1.2)
    bx(b, PAL["oak"], x - 1.55, x + 1.55, y + 1.1, y + 1.16, z - 1.25, z + 1.25)
    for (px, pz) in ((-1.4, -1.1), (1.4, -1.1), (-1.4, 1.1), (1.4, 1.1)):
        bx(b, PAL["dark"], x + px - 0.05, x + px + 0.05, y + 1.16, y + 2.6, z + pz - 0.05, z + pz + 0.05)
    bx(b, PAL["red"], x - 1.7, x + 1.7, y + 2.6, y + 2.85, z - 1.4, z + 1.4)
    for nz in (-1, 1):
        text(b, PAL["white"], "GRIN NEWS", (x, y + 2.72, z + nz * 1.4), (0, 0, nz), 0.17, o=0.012)
        rng = random.Random(int(x * 7 + z + nz))
        for k in range(6):
            col = rng.choice(["orange", "pink", "cyan", "green", "yellow", "white"])
            panel(b, PAL[col], (x - 1.25 + k * 0.5, y + 0.7, z + nz * 1.2), (0, 0, nz), 0.4, 0.55, o=0.01)
    for nx in (-1, 1):
        text(b, PAL["white"], "NEWS", (x + nx * 1.7, y + 2.72, z), (nx, 0, 0), 0.17, o=0.012)


def info_desk(b, PAL, x, z, y):
    bx(b, PAL["white"], x - 1.5, x + 1.5, y, y + 1.05, z - 1.0, z + 1.0)
    bx(b, PAL["dark"], x - 1.55, x + 1.55, y + 1.05, y + 1.12, z - 1.05, z + 1.05)
    for nz in (-1, 1):
        panel(b, PAL["stripe"], (x, y + 0.6, z + nz * 1.0), (0, 0, nz), 2.6, 0.5, o=0.01)
        text(b, PAL["white"], "INFORMATION", (x, y + 0.6, z + nz * 1.0), (0, 0, nz), 0.2, o=0.02)
    b.cyl(PAL["steel"], 0.03, (x, y + 1.12, z), (x, y + 2.8, z), seg=6)
    disc(b, PAL["stripe"], (x, y + 3.1, z), (0, 0, 1), 0.35, seg=16, o=0.0)
    disc(b, PAL["stripe"], (x, y + 3.1, z), (0, 0, -1), 0.35, seg=16, o=0.0)
    text(b, PAL["white"], "I", (x, y + 3.1, z), (0, 0, 1), 0.35, o=0.01)
    text(b, PAL["white"], "I", (x, y + 3.1, z), (0, 0, -1), 0.35, o=0.01)


def hanging_sign(b, PAL, c, normal_axis, w, lines, y_ceil, bg="roundelblue", fg="white"):
    """A double-sided blue direction sign hung from the ceiling."""
    x, y, z = c
    h = 0.22 * len(lines) + 0.12
    if normal_axis == "z":
        bx(b, PAL[bg], x - w / 2, x + w / 2, y, y + h, z - 0.03, z + 0.03)
        for nz in (-1, 1):
            yy = y + h - 0.17
            for ln in lines:
                text(b, PAL[fg], ln, (x, yy, z + nz * 0.03), (0, 0, nz), 0.15, o=0.012)
                yy -= 0.22
    else:
        bx(b, PAL[bg], x - 0.03, x + 0.03, y, y + h, z - w / 2, z + w / 2)
        for nx in (-1, 1):
            yy = y + h - 0.17
            for ln in lines:
                text(b, PAL[fg], ln, (x + nx * 0.03, yy, z), (nx, 0, 0), 0.15, o=0.012)
                yy -= 0.22
    for rx in (-w / 2 + 0.2, w / 2 - 0.2):
        if normal_axis == "z":
            b.cyl(PAL["black"], 0.015, (x + rx, y + h, z), (x + rx, y_ceil, z), seg=4)
        else:
            b.cyl(PAL["black"], 0.015, (x, y + h, z + rx), (x, y_ceil, z + rx), seg=4)


def station_concourse(b, PAL, s):
    X = lambda x: s * x
    Z = lambda z: s * z
    # --- platform level: tube lights in three rows, station name boards, roundels, posters, benches, vending
    for row_x in (-18.0, -12.0, 0.0, 12.0, 18.0):
        for k in range(10):
            z = -42.4 + k * 3.2
            if abs(row_x) < 1 and -28 < z < -17:
                continue
            tube_light(b, PAL, X(row_x), Z(z), SLAB0 - 0.33 - 0.02, along="x", L=1.5)
    # bulkhead lamps down the tunnels and in the walkway / corridor / plant room
    for z in (-12, -6, -1):
        for side in ("W", "E"):
            tube_light(b, PAL, X(BORE_CX[side]), Z(z), 3.9, along="z", L=1.0)
    tube_light(b, PAL, X(0), Z(-11), 2.95, along="z", L=1.2)
    for z in (-10, -3):
        tube_light(b, PAL, X(-19), Z(z), SLAB0 - 0.02, along="x", L=1.2)
    for (x, z) in ((-6, -5), (6, -5), (-6, -1.5), (6, -1.5)):
        tube_light(b, PAL, X(x), Z(z), SLAB0 - 0.02, along="x", L=1.2)
    # UNDERGRIN name boards on the side-platform back walls (white on blue), roundels, posters
    for (xw, nx) in ((-22, 1), (22, -1)):
        nrm = (s * nx, 0, 0)
        for zc in (-38, -20):
            panel(b, PAL["roundelblue"], (X(xw), 2.5, Z(zc)), nrm, 3.2, 0.5, o=0.02)
            text(b, PAL["white"], "UNDERGRIN", (X(xw), 2.5, Z(zc)), nrm, 0.32, o=0.035)
        roundel(b, PAL, (X(xw), 2.5, Z(-29)), nrm, r=0.55)
        troll_poster(b, PAL, (X(xw), 2.1, Z(-33.5)), nrm, 1.0, 1.4, PAL["salmon"] if nx > 0 else PAL["stripe"], cells=22, o=0.02)
        # a colour-block poster: GRINLINE in two tones
        panel(b, PAL["stripe"] if nx > 0 else PAL["salmon"], (X(xw), 2.1, Z(-24.5)), nrm, 1.0, 1.4, o=0.02)
        panel(b, PAL["white"], (X(xw), 2.45, Z(-24.5)), nrm, 0.8, 0.5, o=0.03)
        text(b, PAL["black"], "GRINLINE", (X(xw), 2.45, Z(-24.5)), nrm, 0.14, o=0.04)
        panel(b, PAL["cream"], (X(xw), 2.1, Z(-16.5)), nrm, 1.0, 1.4, o=0.02)
        text(b, PAL["black"], "MIND", (X(xw), 2.45, Z(-16.5)), nrm, 0.22, o=0.035)
        text(b, PAL["black"], "THE", (X(xw), 2.1, Z(-16.5)), nrm, 0.22, o=0.035)
        text(b, PAL["salmon"], "GRIN", (X(xw), 1.75, Z(-16.5)), nrm, 0.22, o=0.035)
        # benches and a vending machine against the wall
        bench(b, PAL, X(xw + nx * 0.55), Z(-36), P, along="z")
        bench(b, PAL, X(xw + nx * 0.55), Z(-22), P, along="z")
        bx(b, PAL["red"], X(xw), X(xw + nx * 0.8), P, P + 1.9, Z(-41) - 0.5, Z(-41) + 0.5)
        panel(b, PAL["screen"], (X(xw + nx * 0.8), P + 1.2, Z(-41)), nrm, 0.6, 0.9, o=0.01)
        text(b, PAL["white"], "GRINK", (X(xw + nx * 0.8), P + 1.75, Z(-41)), nrm, 0.12, o=0.012)
    # the end wall: a big roundel and TROLLHALLA, plus EXIT over the bore-end stairs
    roundel(b, PAL, (X(0), 3.3, Z(-44)), (0, 0, s), r=0.8)
    text(b, PAL["white"], "UNDERGRIN", (X(0), 2.0, Z(-44)), (0, 0, s), 0.45, o=0.02)
    exit_sign(b, PAL, (X(12), 3.0, Z(-44)), (0, 0, s))
    exit_sign(b, PAL, (X(-19.5), 3.2, Z(-44)), (0, 0, s))
    # hanging direction signs on the island: to the trains, up to the concourse
    hanging_sign(b, PAL, (X(0), SLAB0 - 1.0, Z(-31)), "z", 3.0, ["GRINLINE"], SLAB0 - 0.34)
    hanging_sign(b, PAL, (X(0), SLAB0 - 1.0, Z(-15.5)), "z", 3.0, ["PLANT ROOM"], SLAB0 - 0.34)
    exit_sign(b, PAL, (X(0), 2.6, Z(-14)), (0, 0, -s))
    # on the island columns: roundels on the inner faces at z -22 columns
    for (cxp, cz) in COLS:
        if cz == -22:
            roundel(b, PAL, (X(cxp) - s * (1 if cxp > 0 else -1) * 0.35, 2.4, Z(cz)), (-s * (1 if cxp > 0 else -1), 0, 0), r=0.3)
    # --- concourse: the hall
    for x in (-13.5, 13.5):
        bench(b, PAL, X(x), Z(-28), U, along="z")
    photo_booth(b, PAL, X(-6), Z(-19.5), U, -s)
    ticket_machine(b, PAL, X(5.2), Z(-19.5), U, -s)
    ticket_machine(b, PAL, X(6.2), Z(-19.5), U, -s)
    # posters on the hall's long walls between the doorways, roundels, EXITs over the doors
    for sx in (-1, 1):
        wx = X(sx * 16) - s * sx * 0.15
        nrm = (-s * sx, 0, 0)
        troll_poster(b, PAL, (wx, U + 2.0, Z(-37)), nrm, 1.2, 1.7, PAL["yellow"] if sx < 0 else PAL["cyan"], cells=24, o=0.02)
        panel(b, PAL["cyan"] if sx < 0 else PAL["yellow"], (wx, U + 2.0, Z(-26)), nrm, 1.2, 1.7, o=0.02)
        panel(b, PAL["black"], (wx, U + 2.0, Z(-26)), nrm, 0.9, 0.9, o=0.03)
        panel(b, PAL["cream"], (wx, U + 2.0, Z(-29.5)), nrm, 1.2, 1.7, o=0.02)
        if sx < 0:
            text(b, PAL["black"], "GRINLINE", (wx, U + 2.5, Z(-29.5)), nrm, 0.2, o=0.035)
            text(b, PAL["salmon"], "EVERY", (wx, U + 2.1, Z(-29.5)), nrm, 0.2, o=0.035)
            text(b, PAL["salmon"], "2 MIN", (wx, U + 1.75, Z(-29.5)), nrm, 0.2, o=0.035)
            text(b, PAL["black"], "PROBABLY", (wx, U + 1.4, Z(-29.5)), nrm, 0.14, o=0.035)
        else:
            text(b, PAL["salmon"], "MIND", (wx, U + 2.4, Z(-29.5)), nrm, 0.26, o=0.035)
            text(b, PAL["salmon"], "THE", (wx, U + 2.0, Z(-29.5)), nrm, 0.26, o=0.035)
            text(b, PAL["black"], "GRIN", (wx, U + 1.6, Z(-29.5)), nrm, 0.26, o=0.035)
        roundel(b, PAL, (wx, U + 4.2, Z(-22)), nrm, r=0.5)
        for zd in (-33, -19):
            exit_sign(b, PAL, (wx, U + 2.95, Z(zd)), nrm, w=0.6)
        exit_sign(b, PAL, (wx, U + 2.95, Z(-8)), nrm, w=0.6)
    # hall ceiling: tube lights are not needed under the skylight; a row of pendants down the middle
    for z in (-36, -30, -24, -18):
        pendant(b, PAL, X(0), Z(z), vault_y(0) - 0.3, 2.6)
    # a hanging sign over the escalator top
    hanging_sign(b, PAL, (X(0), U + 3.2, Z(-21)), "z", 3.4, ["TRAINS: DOWN"], vault_y(0) - 0.22)
    # --- atrium (this half): the gate line at z -12, the staffed box, the board, pendants
    for k in range(6):
        ticket_gate(b, PAL, X(-7 + 2.8 * k), Z(-12), U)
    bx(b, PAL["white"], X(-9.6), X(-8.4), U, U + 1.1, Z(-12.6), Z(-11.4))
    bx(b, PAL["dark"], X(-9.65), X(-8.35), U + 1.1, U + 1.16, Z(-12.65), Z(-11.35))
    departure_board(b, PAL, X(0), Z(-12), 9.5, s)
    bench(b, PAL, X(0), Z(-9), U, along="x")
    for x in (-8, 0, 8):
        pendant(b, PAL, X(x), Z(-6), ATRIUM_CEIL, 3.6)
    b.cyl(PAL["black"], 0.03, (X(0), ARCH_SPRING + ARCH_SPAN / 2, Z(-16)), (X(0), ARCH_SPRING + ARCH_SPAN / 2 - 0.5, Z(-16)), seg=4)
    clock(b, PAL, (X(0), ARCH_SPRING + ARCH_SPAN / 2 - 1.2, Z(-16)), (0, 0, s))
    clock(b, PAL, (X(0), ARCH_SPRING + ARCH_SPAN / 2 - 1.2, Z(-16)), (0, 0, -s))
    # posters on the threshold piers (atrium side)
    for sx in (-1, 1):
        troll_poster(b, PAL, (X(sx * 11.5), U + 2.2, Z(-16) + s * 0.2), (0, 0, s), 1.4, 2.0, PAL["salmon"] if sx < 0 else PAL["stripe"], cells=26, o=0.02)
        roundel(b, PAL, (X(sx * 11.5), U + 4.4, Z(-16) + s * 0.2), (0, 0, s), r=0.45)


def build_concourse(PAL):
    b = Builder()
    for s in (1, -1):
        station_concourse(b, PAL, s)
    info_desk(b, PAL, -9, 0, U)
    newsstand(b, PAL, 9, 0, U)
    # the light well's lip: a yellow hazard line round it on the atrium floor
    for (a, c, d, e) in ((-4.5, 4.5, -4.5, -4.1), (-4.5, 4.5, 4.1, 4.5), (-4.5, -4.1, -4.1, 4.1), (4.1, 4.5, -4.1, 4.1)):
        hrect(b, PAL["yellow"], a, c, d, e, U + 0.004)
    # tube lights down both shop rows
    for (sx, shops) in ((-1, SHOPS_W), (1, SHOPS_E)):
        for (z0, z1, name) in shops:
            for k in range(2):
                tube_light(b, PAL, sx * 19, z0 + (z1 - z0) * (0.3 + 0.4 * k), CEIL_SHOP - 0.02, along="z", L=1.4)
    b.finish("ug-concourse.glb", bake=False)


# ================================================================== SHOPS

def shop_floor(b, m, x0, x1, z0, z1, y=U):
    hrect(b, m, x0, x1, z0, z1, y + 0.004)


def tk_cabinet(b, PAL, x, z, y, facing, marquee_text=False):
    """A Troll Kombat arcade cabinet (0.8 wide, 0.9 deep, 1.9 tall) facing +-z."""
    f = facing
    bx(b, PAL["cabinet"], x - 0.4, x + 0.4, y, y + 1.9, z - 0.45, z + 0.45)
    bx(b, PAL["orange"], x - 0.42, x + 0.42, y + 1.55, y + 1.9, z - 0.47, z + 0.47)
    panel(b, PAL["screen"], (x, y + 1.15, z + f * 0.45), (0, 0, f), 0.6, 0.45, o=0.01)
    bx(b, PAL["black"], x - 0.4, x + 0.4, y + 0.8, y + 0.9, z + f * 0.3, z + f * 0.6)
    b.cyl(PAL["red"], 0.03, (x - 0.15, y + 0.9, z + f * 0.5), (x - 0.15, y + 1.05, z + f * 0.5), seg=5)
    for k in range(3):
        b.cyl(PAL["white"], 0.03, (x + 0.05 + 0.12 * k, y + 0.9, z + f * 0.47), (x + 0.05 + 0.12 * k, y + 0.92, z + f * 0.47), seg=6)
    if marquee_text:
        text(b, PAL["black"], "TROLL", (x, y + 1.8, z + f * 0.47), (0, 0, f), 0.1, o=0.012)
        text(b, PAL["black"], "KOMBAT", (x, y + 1.65, z + f * 0.47), (0, 0, f), 0.1, o=0.012)
    else:
        text(b, PAL["black"], "TK", (x, y + 1.72, z + f * 0.47), (0, 0, f), 0.18, o=0.012)


def tk_cabinet_x(b, PAL, x, z, y, facing, marquee_text=False):
    """Same cabinet facing +-x (against a side wall)."""
    f = facing
    bx(b, PAL["cabinet"], x - 0.45, x + 0.45, y, y + 1.9, z - 0.4, z + 0.4)
    bx(b, PAL["orange"], x - 0.47, x + 0.47, y + 1.55, y + 1.9, z - 0.42, z + 0.42)
    panel(b, PAL["screen"], (x + f * 0.45, y + 1.15, z), (f, 0, 0), 0.6, 0.45, o=0.01)
    bx(b, PAL["black"], x + f * 0.3, x + f * 0.6, y + 0.8, y + 0.9, z - 0.4, z + 0.4)
    b.cyl(PAL["red"], 0.03, (x + f * 0.5, y + 0.9, z - 0.15), (x + f * 0.5, y + 1.05, z - 0.15), seg=5)
    if marquee_text:
        text(b, PAL["black"], "TROLL", (x + f * 0.47, y + 1.8, z), (f, 0, 0), 0.1, o=0.012)
        text(b, PAL["black"], "KOMBAT", (x + f * 0.47, y + 1.65, z), (f, 0, 0), 0.1, o=0.012)
    else:
        text(b, PAL["black"], "TK", (x + f * 0.47, y + 1.72, z), (f, 0, 0), 0.18, o=0.012)


def table_and_chairs(b, PAL, x, z, y, m_top, r=0.45):
    b.cyl(PAL["black"], 0.04, (x, y, z), (x, y + 0.72, z), seg=6)
    b.cyl(m_top, r, (x, y + 0.72, z), (x, y + 0.76, z), seg=12)
    b.cyl(PAL["black"], 0.25, (x, y, z), (x, y + 0.03, z), seg=10)
    for (dx, dz) in ((0.75, 0), (-0.75, 0)):
        bx(b, PAL["dark"], x + dx - 0.2, x + dx + 0.2, y + 0.42, y + 0.47, z + dz - 0.2, z + dz + 0.2)
        bx(b, PAL["dark"], x + dx + (0.16 if dx > 0 else -0.2), x + dx + (0.2 if dx > 0 else -0.16), y + 0.47, y + 0.9, z + dz - 0.2, z + dz + 0.2)
        b.cyl(PAL["black"], 0.03, (x + dx, y, z + dz), (x + dx, y + 0.42, z + dz), seg=4)


def shelf_wall(b, PAL, x, z0, z1, y, facing, rows=4, seed=0):
    """Shelving against a wall at x (opening toward facing), with rows of
    coloured books / bottles as flat quads."""
    rng = random.Random(seed)
    d = 0.4
    xa, xb = sorted((x, x + facing * d))
    bx(b, PAL["oak"], xa, xb, y, y + 2.2, min(z0, z1) - 0.03, min(z0, z1))
    bx(b, PAL["oak"], xa, xb, y, y + 2.2, max(z0, z1), max(z0, z1) + 0.03)
    for r in range(rows + 1):
        bx(b, PAL["oak"], xa, xb, y + 0.3 + r * 0.45, y + 0.33 + r * 0.45, min(z0, z1), max(z0, z1))
    cols = ["red", "stripe", "green", "orange", "cream", "purple", "cyan", "white", "black"]
    for r in range(rows):
        zz = min(z0, z1) + 0.05
        while zz < max(z0, z1) - 0.1:
            w = rng.uniform(0.14, 0.4)
            h = rng.uniform(0.22, 0.38)
            panel(b, PAL[rng.choice(cols)], (x + facing * (d - 0.05), y + 0.33 + r * 0.45 + h / 2, zz + w / 2), (facing, 0, 0), w, h, o=0.0)
            zz += w + 0.01


def counter(b, PAL, x0, x1, z0, z1, y, m_front, m_top):
    bx(b, m_front, x0, x1, y, y + 1.0, z0, z1)
    bx(b, m_top, min(x0, x1) - 0.05, max(x0, x1) + 0.05, y + 1.0, y + 1.06, min(z0, z1) - 0.05, max(z0, z1) + 0.05)


def sofa(b, PAL, x, z, y, along_x, L=2.2, m=None):
    m = m or PAL["red"]
    if along_x:
        bx(b, m, x - L / 2, x + L / 2, y + 0.15, y + 0.5, z - 0.45, z + 0.45)
        bx(b, m, x - L / 2, x + L / 2, y + 0.5, y + 0.95, z + 0.25, z + 0.5)
        for sx in (-1, 1):
            bx(b, m, x + sx * (L / 2 - 0.1), x + sx * (L / 2 + 0.1), y + 0.15, y + 0.7, z - 0.45, z + 0.5)
    else:
        bx(b, m, x - 0.45, x + 0.45, y + 0.15, y + 0.5, z - L / 2, z + L / 2)
        bx(b, m, x + 0.25, x + 0.5, y + 0.5, y + 0.95, z - L / 2, z + L / 2)
        for sz in (-1, 1):
            bx(b, m, x - 0.45, x + 0.5, y + 0.15, y + 0.7, z + sz * (L / 2 - 0.1), z + sz * (L / 2 + 0.1))


def cow_rug(b, PAL, x, z, y, w, d, seed=3):
    hrect(b, PAL["white"], x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + 0.006)
    rng = random.Random(seed)
    for _ in range(9):
        bw, bd = rng.uniform(0.25, 0.6), rng.uniform(0.25, 0.6)
        bxp, bzp = rng.uniform(-w / 2 + bw / 2, w / 2 - bw / 2), rng.uniform(-d / 2 + bd / 2, d / 2 - bd / 2)
        hrect(b, PAL["black"], x + bxp - bw / 2, x + bxp + bw / 2, z + bzp - bd / 2, z + bzp + bd / 2, y + 0.008)


def dress_shop(b, PAL, name, x0, x1, z0, z1, side):
    """One unit x0..x1 (the row), z0..z1; side -1 west (wall at x0 = -22,
    hall door on the x1 side), +1 east."""
    x0, x1 = sorted((x0, x1))
    z0, z1 = sorted((z0, z1))
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    L = z1 - z0
    back = x0 if side < 0 else x1          # the outer wall
    inward = 1 if side < 0 else -1         # from the back wall into the room
    y = U
    rng = random.Random(int(cz * 3 + side))
    if name == "arcade":
        shop_floor(b, PAL["carpet"], x0 + 0.05, x1 - 0.05, z0 + 0.2, z1 - 0.2)
        # neon squiggles on the carpet
        for k in range(14):
            m = PAL["neon_m"] if k % 2 else PAL["neon_c"]
            px, pz = rng.uniform(x0 + 0.4, x1 - 0.8), rng.uniform(z0 + 0.5, z1 - 1.0)
            if rng.random() < 0.5:
                hrect(b, m, px, px + rng.uniform(0.4, 1.2), pz, pz + 0.05, y + 0.008)
            else:
                hrect(b, m, px, px + 0.05, pz, pz + rng.uniform(0.4, 1.2), y + 0.008)
        # cabinets along the back wall, facing into the room
        k = 0
        zz = z0 + 1.2
        while zz < z1 - 1.0:
            if abs(zz) < 34.6:          # the side stair lands in this corner (WSTAIR_WELL)
                tk_cabinet_x(b, PAL, back + inward * 0.5, zz, y, inward, marquee_text=(k % 3 == 0))
            zz += 1.0
            k += 1
        # a row across the far partition, clear of its doorway, and a neon sign
        for d in (1.5, 4.6, 5.5):
            tk_cabinet(b, PAL, back + inward * d, z1 - 0.65 if side < 0 else z0 + 0.65, y, -1 if side < 0 else 1, marquee_text=(d == 4.6))
        panel(b, PAL["black"], (back + inward * 0.01, y + 2.9, cz), (inward, 0, 0), 3.4, 0.6, o=0.0)
        text(b, PAL["neon_m"], "TROLL KOMBAT", (back + inward * 0.02, y + 2.9, cz), (inward, 0, 0), 0.34, o=0.01)
    elif name == "books":
        shop_floor(b, PAL["oak"], x0 + 0.05, x1 - 0.05, z0 + 0.2, z1 - 0.2)
        shelf_wall(b, PAL, back, z0 + 0.6, z1 - 0.6, y, inward, rows=3, seed=int(cz))
        # a free-standing double shelf down the middle
        shelf_wall(b, PAL, cx - 0.4, z0 + 4.0, z1 - 4.0, y, 1, rows=3, seed=int(cz) + 1)
        shelf_wall(b, PAL, cx + 0.4, z0 + 4.0, z1 - 4.0, y, -1, rows=3, seed=int(cz) + 2)
        table_and_chairs(b, PAL, back + inward * 4.2, z0 + 1.6, y, PAL["oak"], r=0.55)
        panel(b, PAL["cream"], (back + inward * 0.01, y + 2.9, cz), (inward, 0, 0), 2.6, 0.5, o=0.0)
        text(b, PAL["black"], "TROLLSTOY", (back + inward * 0.02, y + 2.9, cz), (inward, 0, 0), 0.26, o=0.01)
    elif name == "grinbiss":
        shop_floor(b, PAL["cream"], x0 + 0.05, x1 - 0.05, z0 + 0.2, z1 - 0.2)
        counter(b, PAL, back + inward * 0.9, back + inward * 1.9, z0 + 1.0, z0 + 4.5, y, PAL["salmon"], PAL["white"])
        bx(b, PAL["steel"], back + inward * 0.2, back + inward * 0.8, y + 1.0, y + 1.7, z0 + 1.4, z0 + 2.2)   # coffee machine
        bx(b, PAL["red"], back + inward * 0.2, back + inward * 0.8, y, y + 1.0, z0 + 1.2, z0 + 2.4)
        bx(b, PAL["steel"], back + inward * 0.1, back + inward * 0.9, y, y + 1.0, z0 + 2.6, z0 + 4.4)     # fridge
        panel(b, PAL["black"], (back + inward * 0.01, y + 2.6, z0 + 2.8), (inward, 0, 0), 2.6, 1.0, o=0.0)
        text(b, PAL["board_o"], "GRINBISS", (back + inward * 0.02, y + 2.95, z0 + 2.8), (inward, 0, 0), 0.24, o=0.01)
        text(b, PAL["white"], "KEBAP 4  FRIES 2", (back + inward * 0.02, y + 2.5, z0 + 2.8), (inward, 0, 0), 0.12, o=0.01)
        for tz in (z0 + 7.5, z0 + 10.5):
            table_and_chairs(b, PAL, cx + inward * 0.6, tz, y, PAL["white"])
        # a stripe round the walls at 1 m
        band_z(b, PAL["salmon"], back, inward, y + 0.9, y + 1.1, z0, z1, o=0.0)
    elif name == "apotrolle":
        shop_floor(b, PAL["white"], x0 + 0.05, x1 - 0.05, z0 + 0.2, z1 - 0.2)
        counter(b, PAL, back + inward * 1.2, back + inward * 2.0, z0 + 1.0, z0 + 5.0, y, PAL["white"], PAL["green"])
        shelf_wall(b, PAL, back, z0 + 5.5, z1 - 0.6, y, inward, rows=3, seed=int(cz) + 7)
        panel(b, PAL["white"], (back + inward * 0.01, y + 2.7, z0 + 3.0), (inward, 0, 0), 2.4, 0.8, o=0.0)
        text(b, PAL["green"], "APOTROLLE", (back + inward * 0.02, y + 2.7, z0 + 3.0), (inward, 0, 0), 0.22, o=0.01)
        # the green cross out from the hall-side wall over the door
        bx(b, PAL["cross"], cx - 0.08, cx + 0.08, y + 2.9, y + 3.5, (z1 if side < 0 else z0) - 0.3, (z1 if side < 0 else z0) + 0.3)
        bx(b, PAL["cross"], cx - 0.08, cx + 0.08, y + 3.1, y + 3.3, (z1 if side < 0 else z0) - 0.8, (z1 if side < 0 else z0) + 0.8)
        bx(b, PAL["cross"], cx - 0.4, cx + 0.4, y + 3.1, y + 3.3, (z1 if side < 0 else z0) - 0.1, (z1 if side < 0 else z0) + 0.1)
    elif name in ("purple", "red"):
        m = PAL["purple"] if name == "purple" else PAL["red"]
        shop_floor(b, m, x0 + 0.05, x1 - 0.05, z0 + 0.2, z1 - 0.2)
        # trim: a 0.6 m band round all four walls
        band_z(b, m, back, inward, y + 0.6, y + 1.3, z0, z1, o=0.0)
        band_z(b, m, x1 if side < 0 else x0, -inward, y + 0.6, y + 1.3, z0, z1, o=0.0)
        band_x(b, m, z0 + 0.15, 1, y + 0.6, y + 1.3, x0, x1, o=0.0)
        band_x(b, m, z1 - 0.15, -1, y + 0.6, y + 1.3, x0, x1, o=0.0)
        # a stripe at the ceiling too, and some crates by the far wall
        band_z(b, m, back, inward, y + 3.0, y + 3.3, z0, z1, o=0.0)
        zb = z0 + 0.3 if name == "purple" else z1 - 2.3
        for (dx, dz, sz) in ((4.6, 0.8, 0.8), (5.4, 0.9, 0.6), (5.0, 1.7, 0.7)):
            bx(b, PAL["oak"], back + inward * dx - sz / 2, back + inward * dx + sz / 2, y, y + sz, zb + dz - sz / 2, zb + dz + sz / 2)
    elif name == "lounge":
        shop_floor(b, PAL["oak"], x0 + 0.05, x1 - 0.05, z0 + 0.2, z1 - 0.2)
        cow_rug(b, PAL, cx, cz, y, 3.2, 4.0, seed=int(cz))
        sofa(b, PAL, cx, cz - 2.6, y, True)
        sofa(b, PAL, cx, cz + 2.6, y, True, m=PAL["red"])
        bx(b, PAL["black"], cx - 0.4, cx + 0.4, y + 0.4, y + 0.45, cz - 0.6, cz + 0.6)   # coffee table
        # fireplace on the back wall: brick surround, dark opening, fire
        fz = cz
        bx(b, PAL["brick"], back, back + inward * 0.5, y, y + 1.6, fz - 1.1, fz + 1.1)
        bx(b, PAL["black"], back + inward * 0.5, back + inward * 0.52, y + 0.2, y + 1.0, fz - 0.6, fz + 0.6)
        panel(b, PAL["fire"], (back + inward * 0.53, y + 0.5, fz), (inward, 0, 0), 0.8, 0.5, o=0.0)
        bx(b, PAL["oak"], back, back + inward * 0.6, y + 1.6, y + 1.7, fz - 1.2, fz + 1.2)
        # the general's photo over the fireplace, in a frame that hugs it
        general_portrait(b, PAL, (back + inward * 0.08, y + 2.65, fz), (inward, 0, 0), 1.5, o=0.004)
        # standing lamp
        b.cyl(PAL["black"], 0.03, (cx - 1.6, y, cz + 2.6), (cx - 1.6, y + 1.5, cz + 2.6), seg=5)
        b.frustum(PAL["cream"], 0.5, 0.5, 0.3, 0.3, y + 1.5, y + 1.85, x=cx - 1.6, z=cz + 2.6)
    # EXIT over the hall door (on the row's hall-side wall) is in ug-concourse; shop sign over the partition doors here
    sign = {"purple": "PURPLE ROOM", "red": "RED ROOM"}.get(name)
    for (zz, nz) in ((z0 + 0.15, 1), (z1 - 0.15, -1)):
        if abs(zz) > 39 or sign is None:
            continue
        dx = -19 if side < 0 else 19
        panel(b, PAL["roundelblue"], (dx, y + 2.75, zz), (0, 0, nz), 1.7, 0.3, o=0.0)
        text(b, PAL["white"], sign, (dx, y + 2.75, zz), (0, 0, nz), 0.16, o=0.012)


def build_shops(PAL):
    b = Builder()
    for (z0, z1, name) in SHOPS_W:
        dress_shop(b, PAL, name, -22, -16, z0, z1, -1)
    for (z0, z1, name) in SHOPS_E:
        dress_shop(b, PAL, name, 16, 22, z0, z1, 1)
    b.finish("ug-shops.glb", bake=False)


# ================================================================== PLANT

def cabinet(b, PAL, x0, x1, z0, z1, y, h, m=None, face=1):
    m = m or PAL["grey"]
    bx(b, m, x0, x1, y, y + h, z0, z1)
    # a door seam and two indicator lights on the long face toward the room (+-z)
    along_x = abs(x1 - x0) > abs(z1 - z0)
    if along_x:
        fz = max(z0, z1) if face > 0 else min(z0, z1)
        panel(b, PAL["dark"], ((x0 + x1) / 2, y + h * 0.5, fz), (0, 0, face), 0.02, h * 0.8, o=0.005)
        panel(b, PAL["green"], ((x0 + x1) / 2 - 0.15, y + h * 0.85, fz), (0, 0, face), 0.06, 0.06, o=0.006)
        panel(b, PAL["red"], ((x0 + x1) / 2 + 0.15, y + h * 0.85, fz), (0, 0, face), 0.06, 0.06, o=0.006)


def plant_room(b, PAL):
    y = T
    # generator (dark green skid) at the west wall, a pump skid at the east, switch cabinets north & south, cable drums
    bx(b, PAL["olive"], -9.0, -6.8, y + 0.15, y + 1.15, -2.0, 1.0)
    bx(b, PAL["dark"], -9.1, -6.7, y, y + 0.15, -2.1, 1.1)
    bx(b, PAL["nosing"], -9.0, -6.8, y + 0.9, y + 0.95, -2.0, 1.0)
    b.cyl(PAL["dark"], 0.12, (-7.9, y + 1.15, -1.5), (-7.9, y + 1.9, -1.5), seg=8)
    b.cyl(PAL["dark"], 0.3, (-7.9, y + 1.9, -1.5), (-7.9, y + 2.2, -1.5), seg=8)
    # pump skid
    bx(b, PAL["dark"], 6.8, 9.0, y, y + 0.2, -1.5, 1.5)
    for pz in (-0.7, 0.7):
        b.cyl(PAL["stripe"], 0.35, (7.2, y + 0.55, pz), (8.6, y + 0.55, pz), seg=10)
        b.cyl(PAL["steel"], 0.08, (8.6, y + 0.55, pz), (9.6, y + 0.55, pz), seg=6)
    b.cyl(PAL["steel"], 0.08, (9.6, y + 0.55, -0.7), (9.6, y + 4.0, -0.7), seg=6)
    # switch cabinets along the north and south walls (short of the doors)
    for (xa, xb) in ((-9.0, -6.0), (-5.5, -2.5), (2.5, 5.5), (6.0, 9.0)):
        cabinet(b, PAL, xa, xb, -7.7, -7.2, y, 1.2, face=1)
        cabinet(b, PAL, xa, xb, 7.2, 7.7, y, 1.2, face=-1)
    # cable drums
    for (dx, dz, r) in ((-6.2, 5.0, 0.55), (-4.8, 5.4, 0.45), (5.0, -5.0, 0.5)):
        b.cyl(PAL["oak"], r, (dx, y + r, dz - 0.35), (dx, y + r, dz + 0.35), seg=12)
        b.cyl(PAL["oak"], r * 0.35, (dx, y + r, dz - 0.42), (dx, y + r, dz + 0.42), seg=8)
    # pipes along the walls under the ceiling, a bus duct
    for px in (-9.3, 9.3):
        b.cyl(PAL["steel"], 0.12, (px, 4.6, -7.5), (px, 4.6, 7.5), seg=8)
        b.cyl(PAL["stripe"], 0.08, (px, 4.3, -7.5), (px, 4.3, 7.5), seg=6)
    bx(b, PAL["grey"], -9.5, 9.5, 4.9, 5.2, -7.6, -7.3)
    # tube lights round the well (the well itself is the atrium's daylight)
    for (x, z) in ((-6, -6), (6, -6), (-6, 6), (6, 6)):
        tube_light(b, PAL, x, z, SLAB0 - 0.02, along="x", L=1.4)
    # a grey dado round the walls, a conduit run above it, a sign by the north door
    for (xw, sg) in ((-9.4, 1), (9.4, -1)):
        band_z(b, PAL["grey"], xw, sg, y, y + 1.3, -7.85, 7.85, o=0.0)
        b.bar(PAL["dark"], (xw + sg * 0.05, 2.4, -7.8), (xw + sg * 0.05, 2.4, 7.8), 0.08)
    for (zw, sg) in ((-7.85, 1), (7.85, -1)):
        band_x(b, PAL["grey"], zw, sg, y, y + 1.3, -9.4, 9.4, o=0.0, doors=[(0.0, 1.8, 2.2)])
        b.bar(PAL["dark"], (-9.3, 2.4, zw + sg * 0.05), (9.3, 2.4, zw + sg * 0.05), 0.08)
    panel(b, PAL["nosing"], (-3.0, 2.0, -7.84), (0, 0, 1), 0.9, 0.5, o=0.0)
    text(b, PAL["black"], "PLANT", (-3.0, 2.12, -7.84), (0, 0, 1), 0.14, o=0.012)
    text(b, PAL["black"], "ROOM", (-3.0, 1.9, -7.84), (0, 0, 1), 0.14, o=0.012)
    # a hazard line on the floor round the room's middle
    for (a, c, d, e) in ((-4.3, 4.3, -4.3, -4.15), (-4.3, 4.3, 4.15, 4.3), (-4.3, -4.15, -4.15, 4.15), (4.15, 4.3, -4.15, 4.15)):
        hrect(b, PAL["yellow"], a, c, d, e, y + 0.006)


def corridor_props(b, PAL, s):
    """Service corridor x -22..-15.75, z -12..0 (west; s = -1 the east)."""
    X = lambda x: s * x
    Z = lambda z: s * z
    y = T
    # lockers along the outer wall, a fuse cabinet, a mop bucket
    for k in range(4):
        z = -3.0 + k * 0.5
        bx(b, PAL["grey"], X(-22), X(-21.55), y, y + 1.9, Z(z) - 0.24, Z(z) + 0.24)
        panel(b, PAL["dark"], (X(-21.55), y + 1.0, Z(z)), (s, 0, 0), 0.02, 1.6, o=0.005)
    cabinet(b, PAL, X(-17.4), X(-16.2), Z(-0.6), Z(-0.3), y + 0.6, 1.4, m=PAL["grey"])
    b.cyl(PAL["nosing"], 0.2, (X(-16.6), y, Z(-11.2)), (X(-16.6), y + 0.4, Z(-11.2)), seg=10)
    b.cyl(PAL["steel"], 0.015, (X(-16.6), y + 0.4, Z(-11.2)), (X(-16.3), y + 1.5, Z(-11.4)), seg=4)
    # a sign: PLATFORM via the bore door, an arrow
    panel(b, PAL["roundelblue"], (X(-15.75), 2.6, Z(-6)), (-s, 0, 0), 1.6, 0.3, o=0.01)
    text(b, PAL["white"], "TRACK", (X(-15.75), 2.6, Z(-6)), (-s, 0, 0), 0.16, o=0.02)


def bore_props(b, PAL, s):
    """A works trolley at z -2 and a signal cabinet at z -10 in the W bore
    (s = -1: the E bore's at +2 / +10)."""
    X = lambda x: s * x
    Z = lambda z: s * z
    cx = BORE_CX["W"]
    # trolley: a flat yellow deck on four small wheels, a toolbox and a drum on top
    bx(b, PAL["nosing"], X(cx) - 1.0, X(cx) + 1.0, T + 0.5, T + 0.62, Z(-2) - 1.1, Z(-2) + 1.1)
    for (wx, wz) in ((-0.72, -0.8), (0.72, -0.8), (-0.72, 0.8), (0.72, 0.8)):
        b.cyl(PAL["black"], 0.2, (X(cx + wx) - 0.04, T + 0.4, Z(-2 + wz)), (X(cx + wx) + 0.04, T + 0.4, Z(-2 + wz)), seg=8)
    bx(b, PAL["red"], X(cx) - 0.4, X(cx) + 0.4, T + 0.62, T + 1.0, Z(-2) - 0.3, Z(-2) + 0.3)
    b.cyl(PAL["stripe"], 0.3, (X(cx) + 0.4, T + 0.62, Z(-2) + 0.9), (X(cx) + 0.4, T + 1.4, Z(-2) + 0.9), seg=10)
    bx(b, PAL["dark"], X(cx) - 1.0, X(cx) - 0.9, T + 0.62, T + 1.5, Z(-2) - 1.1, Z(-2) + 1.1)
    # signal cabinet beside the track (against the outer wall), with a signal head
    cabinet(b, PAL, X(cx - 2.2), X(cx - 1.6), Z(-10.6), Z(-9.4), T + 0.22, 1.1, m=PAL["grey"])
    b.cyl(PAL["black"], 0.04, (X(cx - 1.9), T + 1.3, Z(-10)), (X(cx - 1.9), T + 3.0, Z(-10)), seg=5)
    bx(b, PAL["black"], X(cx - 1.9) - 0.15, X(cx - 1.9) + 0.15, T + 2.5, T + 3.2, Z(-10) - 0.12, Z(-10) + 0.12)
    disc(b, PAL["red"], (X(cx - 1.9), T + 2.75, Z(-10) + 0.13 * (-s)), (0, 0, -s), 0.1, seg=10)
    disc(b, PAL["green"], (X(cx - 1.9), T + 3.05, Z(-10) + 0.13 * (-s)), (0, 0, -s), 0.1, seg=10)


def build_plant(PAL):
    b = Builder()
    plant_room(b, PAL)
    for s in (1, -1):
        corridor_props(b, PAL, s)
        bore_props(b, PAL, s)
    b.finish("ug-plant.glb", bake=False)


# =================================================================== main

BUILDERS = {"shell": build_shell, "platforms": build_platforms, "escalators": build_escalators, "trains": build_trains,
            "concourse": build_concourse, "shops": build_shops, "plant": build_plant}

if __name__ == "__main__":
    want = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(BUILDERS)
    PAL = ug_palette()
    for name in want:
        BUILDERS[name](PAL)
