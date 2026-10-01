"""
Troll Forces - The Grinleria (the Houston mall map), headless Blender.

Run with:
  node tools/troll-ops-grinleria-layout.mjs          # layout -> grinleria-layout.json
  blender --background --python build_grinleria.blender.py
  (or, with Blender as a Python module: python build_grinleria.blender.py)
  ONLY=shell,atrium ... builds just those models.
Every model written is then shrunk by quantize_glb.py (byte colours and
normals, no UVs where the game never textures).

Writes gl-*.glb into this folder, in MAP coordinates (placed at 0,0). Every
collider in grinleria-layout.js has a `kind`; this script draws a model to
fit each one, so the art can't drift from the colliders. Glass, the ice,
signs, the vault glazing and the lights are drawn in grinleria.js instead
(transparent / canvas-textured / live), so they are NOT here.

Models:
  gl-shell    building walls, floors, ceilings, columns, the vault's ribs
  gl-shops    shopfront frames and fascias, every shop interior
  gl-atrium   the rink's boards, the Trollboni, escalators, concourse props
  gl-wings    Neiman Narcus and the food court (stalls, fountain, tables)
  gl-outside  the valet drive, the garage level, the skyline round the map
"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
from mathutils import Vector  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "grinleria-layout.json")))
GL = D["GL"]
SOLIDS = D["solids"]
ANCHORS = D.get("anchors", [])
STORES = {s["id"]: s for s in D["STORES"]}
U, SY, ROOF = GL["up"], GL["slabY"], GL["roof"]
FRONT, BACK, ENDX = GL["front"], GL["back"], GL["endX"]
WINGX, BZ = GL["wingX"], GL["bldZ"]
ATR = GL["atrium"]
BOUNDS = GL["bounds"]
ONLY = set(filter(None, os.environ.get("ONLY", "").split(",")))


def kinds(*ks):
    return [s for s in SOLIDS if s["k"] in ks]


def hexrgb(h):
    return int(h.lstrip("#"), 16)


# ------------------------------------------------------------- materials

def mall_palette():
    P = palette()
    P.update({
        "marble": mat("GS_Marble", 0xffffff, 0.3),
        "marble_up": mat("GS_MarbleUp", 0xffffff, 0.3),
        "woodfloor": mat("GS_WoodFloor", 0xb98a5a, 0.6),
        "floorconc": mat("GS_FloorConc", 0x9a9a94, 0.7),
        "asphalt": mat("GS_Asphalt", 0x55575a, 0.9),
        "pavement": mat("GS_Pavement", 0xc8c2b6, 0.85),
        "wall": mat("GL_Wall", 0xefe8da, 0.85),
        "wall_warm": mat("GL_WallWarm", 0xe6d9c2, 0.85),
        "ceiling": mat("GL_Ceiling", 0xf4f2ec, 0.9),
        "column": mat("GL_Column", 0xf3efe6, 0.6),
        "bronze": mat("GL_Bronze", 0x5a4a3a, 0.45, 0.2),
        "bronze_dk": mat("GL_BronzeDark", 0x2f2822, 0.5, 0.2),
        "steel": mat("GL_Steel", 0xc8ccd0, 0.35, 0.25),
        "steel_dk": mat("GL_SteelDark", 0x6c7076, 0.45, 0.25),
        "chrome": mat("GL_Chrome", 0xe2e4e8, 0.2, 0.25),
        "black": mat("GL_Black", 0x17181a, 0.6),
        "rubber": mat("GL_Rubber", 0x111111, 0.85),
        "white": mat("GL_White", 0xf6f6f2, 0.5),
        "board": mat("GL_Board", 0xfbfbf8, 0.35),
        "kick": mat("GL_Kick", 0xf0c419, 0.5),
        "red": mat("GL_Red", 0xc8202a, 0.45),
        "blue": mat("GL_Blue", 0x1f5fb8, 0.45),
        "navy": mat("GL_Navy", 0x14284a, 0.5),
        "green": mat("GL_Green", 0x2d7a46, 0.6),
        "yellow": mat("GL_Yellow", 0xf2c200, 0.5),
        "orange": mat("GL_Orange", 0xf26a1b, 0.5),
        "pink": mat("GL_Pink", 0xf06ea8, 0.6),
        "purple": mat("GL_Purple", 0x6a3fa0, 0.6),
        "teal": mat("GL_Teal", 0x6fd3c7, 0.5),
        "wood": mat("GL_Wood", 0x9a6a3e, 0.6),
        "wood_lt": mat("GL_WoodLight", 0xd2b48c, 0.6),
        "wood_dk": mat("GL_WoodDark", 0x5a3a22, 0.6),
        "leather": mat("GL_Leather", 0x6b2a22, 0.6),
        "leather_bk": mat("GL_LeatherBlack", 0x1e1a18, 0.55),
        "fabric": mat("GL_Fabric", 0x8a8f99, 0.95),
        "cream": mat("GL_Cream", 0xf3ead6, 0.7),
        "soil": mat("GL_Soil", 0x3a2a1e, 0.95),
        "leaf": mat("GS_Leaf", 0x4f7a34, 0.85),
        "leaf_dk": mat("GS_LeafDark", 0x3b6128, 0.85),
        "glassdk": mat("GL_GlassDark", 0x2a3640, 0.15),
        "mirror": mat("GL_Mirror", 0xb9c4cc, 0.08, 0.2),
        "skin": mat("GL_Mannequin", 0xeeeae2, 0.4),
        "ice_edge": mat("GL_IceEdge", 0xdfe9f2, 0.2),
        "paint_line": mat("GL_Line", 0xf2f2ea, 0.6),
        "paint_yel": mat("GL_LineYellow", 0xf2c94c, 0.6),
        "conc": mat("GS_Concrete", 0x8e8e88, 0.92),
        "limestone": mat("GL_Limestone", 0xd9ccb0, 0.85),
        "tower_glass": mat("GL_TowerGlass", 0x5d7488, 0.2),
        "tower_frame": mat("GL_TowerFrame", 0x8c96a0, 0.5),
        "hedge": mat("GL_Hedge", 0x355e2a, 0.9),
        "water": mat("GL_Water", 0x3a8fb0, 0.1),
        # light-giving: their own materials (the kit keeps emissive ones)
        "lamp": mat("GS_Lamp", 0xfff3d0, 0.2, 0.0, 0xfff3d0, 3.0),
        "lamp_cool": mat("GL_LampCool", 0xeef6ff, 0.2, 0.0, 0xeef6ff, 2.2),
        "downlight": mat("GL_Downlight", 0xfff6e0, 0.2, 0.0, 0xfff1d4, 4.0),
        "screen": mat("GS_Screen", 0x9fe6ff, 0.3, 0.0, 0x7fd8ff, 1.2),
        "screen_g": mat("GL_ScreenGame", 0x7cff6a, 0.3, 0.0, 0x58e04a, 1.0),
        "neon_pink": mat("GL_NeonPink", 0xff4fa0, 0.3, 0.0, 0xff3d96, 2.5),
        "neon_blue": mat("GL_NeonBlue", 0x5ac8ff, 0.3, 0.0, 0x3ab8ff, 2.5),
        "exit": mat("GL_Exit", 0x30d158, 0.3, 0.0, 0x30d158, 2.0),
        "redlamp": mat("GS_RedLamp", 0xff3020, 0.3, 0.0, 0xff2a1a, 2.5),
        "beacon": mat("GL_Beacon", 0xffffff, 0.3, 0.0, 0xfff4c0, 6.0),
        "window_lit": mat("GL_WindowLit", 0xffe6b0, 0.4, 0.0, 0xffd890, 0.8),
    })
    return P


# ------------------------------------------------------------- local frame

class Frame:
    """A solid's own frame: local x across its face, local z out of its
    front (f = 0 faces +z), y up from its bottom. w/d are LOCAL sizes."""

    def __init__(self, s):
        self.x, self.z, self.y = s["x"], s["z"], s.get("y", 0)
        self.f = s.get("f", 0) or 0
        q = abs(math.sin(self.f)) > 0.7
        self.w = s["d"] if q else s["w"]
        self.d = s["w"] if q else s["d"]
        self.h = s["h"]
        self.c, self.s = math.cos(self.f), math.sin(self.f)

    def p(self, lx, ly, lz):
        return (self.x + lx * self.c + lz * self.s, self.y + ly, self.z - lx * self.s + lz * self.c)

    def box(self, b, m, w, h, d, lx, ly, lz, rx=0.0, rz=0.0, ry=0.0, bevel=0.0):
        X, Y, Z = self.p(lx, ly, lz)
        b.box(m, w, h, d, X, Y, Z, ry=self.f + ry, rx=rx, rz=rz, bevel=bevel)

    def cyl(self, b, m, r, a, c, seg=10, r2=None, caps=True):
        b.cyl(m, r, self.p(*a), self.p(*c), seg=seg, r2=r2, caps=caps)

    def bar(self, b, m, a, c, w, h=None):
        b.bar(m, self.p(*a), self.p(*c), w, h)


def sbox(b, m, s, inset=0.0, h=None, y=None):
    """The solid itself as a plain box."""
    b.box(m, s["w"] - inset, h if h is not None else s["h"], s["d"] - inset, s["x"], s["y"] if y is None else y, s["z"])


# ------------------------------------------------------------- small parts

def plant(b, P, x, y, z, r=0.5, h=1.2, seed=0):
    """A leafy shrub: a few overlapping leaf lumps."""
    rnd = random.Random(seed)
    for i in range(5):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0, r * 0.45)
        s = rnd.uniform(0.55, 0.8) * r * 2
        b.lump(P["leaf"] if i % 2 else P["leaf_dk"], s, h * rnd.uniform(0.5, 0.8), s,
               x + math.cos(a) * d, y + rnd.uniform(0, h * 0.35), z + math.sin(a) * d, seed=seed * 7 + i, rnd=0.6, jitter=0.08)


def chair(b, P, fr, lx, lz, face, seat=None, frame=None):
    """Bistro chair at local (lx, lz) of a frame, facing `face` (local)."""
    seat = seat or P["black"]
    frame = frame or P["steel_dk"]
    c, s = math.cos(face), math.sin(face)

    def L(px, pz):
        return lx + px * c + pz * s, lz - px * s + pz * c
    for px, pz in ((-0.18, -0.18), (0.18, -0.18), (-0.18, 0.18), (0.18, 0.18)):
        X, Z = L(px, pz)
        fr.box(b, frame, 0.03, 0.45, 0.03, X, 0, Z)
    X, Z = L(0, 0)
    fr.box(b, seat, 0.42, 0.05, 0.42, X, 0.45, Z, ry=face)
    X, Z = L(0, -0.2)
    fr.box(b, seat, 0.42, 0.4, 0.04, X, 0.5, Z, ry=face)


def planter_box(b, P, s, palm_tree=False, seed=0):
    """Marble-clad planter with a bronze lip and greenery (or a palm)."""
    sbox(b, P["limestone"], s, h=s["h"] - 0.06)
    y = s["y"]
    b.box(P["bronze"], s["w"] + 0.04, 0.06, s["d"] + 0.04, s["x"], y + s["h"] - 0.06, s["z"])
    b.box(P["soil"], s["w"] - 0.16, 0.02, s["d"] - 0.16, s["x"], y + s["h"] - 0.04, s["z"])
    if palm_tree:
        palm(b, P, s["x"], s["z"], h=5.2, lean=(0.25, 0.15), seed=seed)
        return
    n = max(1, round(max(s["w"], s["d"]) / 1.0))
    for i in range(n):
        t = (i + 0.5) / n - 0.5
        px = s["x"] + (t * s["w"] if s["w"] >= s["d"] else 0)
        pz = s["z"] + (t * s["d"] if s["d"] > s["w"] else 0)
        plant(b, P, px, y + s["h"] - 0.05, pz, r=min(s["w"], s["d"]) * 0.45, h=0.9, seed=seed * 13 + i)


def downlight_grid(b, P, x0, x1, z0, z1, y, step=3.0, r=0.14):
    nx = max(1, int((x1 - x0) / step))
    nz = max(1, int((z1 - z0) / step))
    for i in range(nx):
        for j in range(nz):
            x = x0 + (i + 0.5) * (x1 - x0) / nx
            z = z0 + (j + 0.5) * (z1 - z0) / nz
            b.poly(P["downlight"], [(x + r * math.cos(k * math.pi / 4), y - 0.004, z + r * math.sin(k * math.pi / 4)) for k in range(8)],
                   [list(range(8))])


# ================================================================== shell

VAULT = {"x0": -26.0, "x1": 26.0, "z": 10.0, "spring": ROOF, "crown": GL["vaultTop"]}
SKY = {"x0": 40.0, "x1": 48.0, "z0": -4.0, "z1": 4.0}            # food court skylight


def vault_y(z):
    t = max(0.0, 1 - (z / VAULT["z"]) ** 2)
    return VAULT["spring"] + (VAULT["crown"] - VAULT["spring"]) * math.sqrt(t)


def rect_minus(r, holes):
    """Split rectangle r = (x0, x1, z0, z1) into pieces that avoid `holes`."""
    out = [r]
    for h in holes:
        nxt = []
        for (x0, x1, z0, z1) in out:
            hx0, hx1, hz0, hz1 = h
            if hx1 <= x0 or hx0 >= x1 or hz1 <= z0 or hz0 >= z1:
                nxt.append((x0, x1, z0, z1))
                continue
            if hz0 > z0:
                nxt.append((x0, x1, z0, hz0))
            if hz1 < z1:
                nxt.append((x0, x1, hz1, z1))
            if hx0 > x0:
                nxt.append((x0, hx0, max(z0, hz0), min(z1, hz1)))
            if hx1 < x1:
                nxt.append((hx1, x1, max(z0, hz0), min(z1, hz1)))
        out = nxt
    return [r for r in out if r[1] - r[0] > 0.01 and r[3] - r[2] > 0.01]


def rbox(b, m, r, y, h):
    x0, x1, z0, z1 = r
    b.box(m, x1 - x0, h, z1 - z0, (x0 + x1) / 2, y, (z0 + z1) / 2)


def build_shell(P):
    b = Builder()
    SX = ENDX + 0.3

    # ---- the building's long walls: limestone outside, cream inside, a
    # dark glazed band and a cornice; filled back in over each door
    for s in kinds("_bldwall"):
        row = s["row"]
        sbox(b, P["limestone"], s, h=10.4)
        b.box(P["wall"], s["w"], 9.0, 0.02, s["x"], 0, row * (BZ + 0.0))            # inside face
        b.box(P["glassdk"], s["w"], 1.6, 0.04, s["x"], 5.2, row * (BZ + 0.52))      # glazed band outside
        b.box(P["limestone"], s["w"], 0.35, 0.3, s["x"], 10.4, row * (BZ + 0.4))    # cornice
    for row in (-1, 1):
        for dx, dw in ((-46.9, 3), (46.9, 3), (0, 2)):
            x = dx
            top = 3.0 if dw > 2 else 2.4
            b.box(P["limestone"], dw, 10.4 - top, 0.5, x, top, row * (BZ + 0.25))
            for sx in (-1, 1):
                b.box(P["bronze_dk"], 0.12, top, 0.56, x + sx * (dw / 2 - 0.06), 0, row * (BZ + 0.25))
            b.box(P["bronze_dk"], dw, 0.14, 0.56, x, top - 0.14, row * (BZ + 0.25))
            if dw > 2:
                b.box(P["bronze_dk"], 0.08, top - 0.14, 0.06, x, 0, row * (BZ + 0.25))        # door split
                for sx in (-0.75, 0.75):                                                     # push bars
                    b.box(P["chrome"], 0.6, 0.05, 0.05, x + sx, 1.05, row * (BZ - 0.02))
                    b.box(P["chrome"], 0.6, 0.05, 0.05, x + sx, 1.05, row * (BZ + 0.52))
            else:
                b.box(P["steel_dk"], dw - 0.24, top - 0.14, 0.06, x, 0, row * (BZ + 0.25))   # steel fire door
                b.box(P["chrome"], 0.8, 0.05, 0.06, x, 1.0, row * (BZ - 0.03))
                b.box(P["exit"], 0.6, 0.22, 0.05, x, top + 0.15, row * (BZ - 0.03))           # EXIT box

    # ---- wing end walls
    for s in kinds("_endwall"):
        sbox(b, P["limestone"], s, h=10.4)
        sx = 1 if s["x"] > 0 else -1
        b.box(P["wall_warm"], 0.02, 9.0, s["d"] - 1, sx * WINGX, 0, 0)

    # ---- upper floor: slabs, decks, mid bridge. Ceiling paint underneath,
    # marble on top, a bronze fascia round every edge on the atrium.
    for s in kinds("_slab", "_deck", "_bridge"):
        sbox(b, P["ceiling"], s, h=0.288)
        b.box(P["marble_up"], s["w"], 0.012, s["d"], s["x"], U - 0.012, s["z"])
    for row in (-1, 1):                                   # fascia along the atrium edge
        for (a, c) in ((-GL["bridges"]["endIn"], -GL["bridges"]["mid"]), (GL["bridges"]["mid"], GL["bridges"]["endIn"])):
            b.box(P["bronze"], c - a, 0.6, 0.05, (a + c) / 2, SY - 0.12, row * (ATR["z1"] - 0.02))
            b.box(P["cream"], c - a, 0.05, 0.12, (a + c) / 2, SY - 0.17, row * (ATR["z1"] - 0.06))
    for sx in (-1, 1):
        x = sx * (GL["bridges"]["mid"] + 0.02)
        b.box(P["bronze"], 0.05, 0.6, 2 * ATR["z1"], x, SY - 0.12, 0)
        x = sx * (GL["bridges"]["endIn"] - 0.02)
        b.box(P["bronze"], 0.05, 0.6, 2 * ATR["z1"], x, SY - 0.12, 0)
    # ceilings under the upper floor: downlights over the concourses, the
    # cross-concourses and along the service corridors
    for row in (-1, 1):
        z0, z1 = sorted((row * (ATR["z1"] + 0.6), row * FRONT))
        downlight_grid(b, P, -ENDX, ENDX, z0, z1, SY, step=3.2)
        z0, z1 = sorted((row * (BACK + 0.3), row * BZ))
        for x in range(-30, 31, 5):                                         # fluorescent strips
            b.box(P["lamp_cool"], 1.4, 0.04, 0.16, x, SY - 0.06, row * (BACK + 2.1))
        b.cyl(P["steel_dk"], 0.09, (-ENDX, SY - 0.3, row * (BZ - 0.4)), (ENDX, SY - 0.3, row * (BZ - 0.4)), seg=8)
        b.cyl(P["red"], 0.06, (-ENDX, SY - 0.5, row * (BZ - 0.25)), (ENDX, SY - 0.5, row * (BZ - 0.25)), seg=8)
    for sx in (-1, 1):
        x0, x1 = sorted((sx * GL["bridges"]["endIn"], sx * SX))
        downlight_grid(b, P, x0 + 0.5, x1, -ATR["z1"] + 0.5, ATR["z1"] - 0.5, SY, step=3.4)

    # ---- the upper level's facades over the wing entrances (wing side
    # gets a cream panel for the big sign; the mall side shop-cream)
    for s in kinds("_facade"):
        sbox(b, P["wall"], s)
        sx = 1 if s["x"] > 0 else -1
        b.box(P["bronze"], 0.08, 0.2, s["d"], sx * (ENDX + 0.34), U - 0.1, 0)
        b.box(P["bronze_dk"], 0.06, 2.4, 16, sx * (ENDX + 0.33), 5.6, 0)        # sign backer (sign: grinleria.js)

    # ---- columns (round in their square colliders), bronze rings
    for s in kinds("column", "_column_up"):
        y0, y1 = s["y"], s["y"] + s["h"]
        b.cyl(P["column"], 0.3, (s["x"], y0, s["z"]), (s["x"], y1, s["z"]), seg=16)
        b.cyl(P["bronze"], 0.34, (s["x"], y0, s["z"]), (s["x"], y0 + 0.18, s["z"]), seg=16)
        b.cyl(P["bronze"], 0.33, (s["x"], y1 - 0.25, s["z"]), (s["x"], y1 - 0.12, s["z"]), seg=16)
        b.cyl(P["cream"], 0.36, (s["x"], y1 - 0.12, s["z"]), (s["x"], y1, s["z"]), seg=16)

    # ---- roof: ceiling at 9 everywhere but the vault and the skylight
    holes = [(VAULT["x0"], VAULT["x1"], -VAULT["z"], VAULT["z"]), (SKY["x0"], SKY["x1"], SKY["z0"], SKY["z1"])]
    for r in rect_minus((-WINGX, WINGX, -BZ, BZ), holes):
        rbox(b, P["ceiling"], r, ROOF, 0.1)
        rbox(b, P["steel_dk"], r, ROOF + 0.1, 0.5)
        rbox(b, P["conc"], r, ROOF + 0.6, 0.06)
    # ceiling lights: the upper concourses, the end decks, the wings
    for row in (-1, 1):
        z0, z1 = sorted((row * (ATR["z1"] + 0.4), row * FRONT))
        for x in range(-30, 31, 4):
            b.box(P["lamp"], 1.2, 0.03, 0.3, x, ROOF - 0.03, (z0 + z1) / 2)
    for sx in (-1, 1):
        for z in (-8, -4, 0, 4, 8):
            for x in (27.5, 30.5):
                b.box(P["lamp"], 0.3, 0.03, 1.2, sx * x, ROOF - 0.03, z)
        for x in (37, 41, 45, 49, 53):
            for z in range(-28, 29, 4):
                if sx > 0 and SKY["x0"] - 0.5 < x < SKY["x1"] + 0.5 and SKY["z0"] - 0.5 < z < SKY["z1"] + 0.5:
                    continue
                b.cyl(P["downlight"], 0.22, (sx * x, ROOF - 0.012, z), (sx * x, ROOF - 0.002, z), seg=10, smooth=False)
    # coffers in the wings' ceilings
    for sx in (-1, 1):
        for x in (35, 39, 43, 47, 51):
            b.box(P["cream"], 0.12, 0.25, 2 * BZ, sx * x, ROOF - 0.25, 0)
        for z in range(-28, 29, 8):
            b.box(P["cream"], WINGX - SX, 0.25, 0.12, sx * (SX + WINGX) / 2, ROOF - 0.25, z)

    # ---- the vault: white steel arches every 4 m, purlins, glazed ends
    # (the glass itself is grinleria.js)
    N = 24
    zs = [VAULT["z"] * math.cos(math.pi * i / N) for i in range(N + 1)]
    pts = [(z, vault_y(z)) for z in zs]
    x = VAULT["x0"]
    xs = []
    while x <= VAULT["x1"] + 0.01:
        xs.append(x)
        x += 4.0
    for x in xs:
        for (z0, y0), (z1, y1) in zip(pts, pts[1:]):
            b.bar(P["white"], (x, y0, z0), (x, y1, z1), 0.14, 0.26)
    for i in range(1, N):
        z, y = pts[i]
        if i % 2 == 0:
            b.bar(P["white"], (VAULT["x0"], y, z), (VAULT["x1"], y, z), 0.08, 0.1)
    for sx in (-1, 1):                                   # end walls: mullions + a rose window ring
        x = sx * VAULT["x1"]
        for i in range(-4, 5):
            z = i * 2.2
            if abs(z) < VAULT["z"]:
                b.box(P["white"], 0.12, vault_y(z) - ROOF, 0.1, x, ROOF, z)
        b.box(P["white"], 0.12, 0.1, 2 * VAULT["z"], x, ROOF + 2.6, 0)
        for k in range(24):
            a0, a1 = 2 * math.pi * k / 24, 2 * math.pi * (k + 1) / 24
            r = 1.6
            b.bar(P["white"], (x, 12.4 + r * math.sin(a0), r * math.cos(a0)), (x, 12.4 + r * math.sin(a1), r * math.cos(a1)), 0.14)
    # edge beams the vault springs from
    for row in (-1, 1):
        b.box(P["white"], VAULT["x1"] - VAULT["x0"], 0.6, 0.5, 0, ROOF - 0.3, row * VAULT["z"])
    for sx in (-1, 1):
        b.box(P["white"], 0.5, 0.6, 2 * VAULT["z"], sx * VAULT["x1"], ROOF - 0.3, 0)
    # food court skylight frame: a hipped lantern
    sk = SKY
    for x in (sk["x0"], sk["x1"]):
        b.box(P["white"], 0.2, 1.2, sk["z1"] - sk["z0"], x, ROOF, 0)
    for z in (sk["z0"], sk["z1"]):
        b.box(P["white"], sk["x1"] - sk["x0"], 1.2, 0.2, (sk["x0"] + sk["x1"]) / 2, ROOF, z)
    for x in (41.6, 43.2, 44.8, 46.4):
        b.box(P["white"], 0.08, 0.08, sk["z1"] - sk["z0"], x, ROOF + 1.15, 0)

    # ---- floors: polished marble through the whole building (the map has
    # no ground plane of its own), then the service corridors' concrete
    b.box(P["marble"], 2 * WINGX, 0.01, 2 * BZ, 0, -0.01, 0)
    for row in (-1, 1):
        z0, z1 = sorted((row * (BACK + 0.3), row * BZ))
        rbox(b, P["floorconc"], (-SX, SX, z0, z1), 0.0, 0.008)
        # corridor walls: bumper rail and a safety stripe
        for zz in (row * (BACK + 0.31), row * (BZ - 0.01)):
            b.box(P["yellow"], 2 * SX, 0.12, 0.04, 0, 0.35, zz)
            b.box(P["wall_warm"], 2 * SX, 0.3, 0.02, 0, 0, zz)
        for x in (-29.5, -12.5, 4.5, 21.5):                 # exit signs along the corridor
            b.box(P["exit"], 0.5, 0.2, 0.04, row * x, SY - 0.45, row * (BACK + 0.33))

    # wing floor inlays: a carpet run through the department store, the
    # Texas star round the fountain
    for z0, z1 in ((-14, -9), (9, 14)):
        b.box(P["fabric"], 14, 0.006, z1 - z0, -46, 0, (z0 + z1) / 2)
    star = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        r = 7.2 if k % 2 == 0 else 2.9
        star.append((44 + r * math.cos(a), 0.007, r * math.sin(a)))
    b.poly(P["bronze"], star + [(44, 0.007, 0)], [[10, k, (k + 1) % 10] for k in range(10)])
    ring = 64
    for k in range(ring):
        a0, a1 = 2 * math.pi * k / ring, 2 * math.pi * (k + 1) / ring
        for r0, r1, m in ((7.6, 8.0, P["bronze"]),):
            b.poly(m, [(44 + r0 * math.cos(a0), 0.008, r0 * math.sin(a0)), (44 + r1 * math.cos(a0), 0.008, r1 * math.sin(a0)),
                       (44 + r1 * math.cos(a1), 0.008, r1 * math.sin(a1)), (44 + r0 * math.cos(a1), 0.008, r0 * math.sin(a1))], [[0, 1, 2, 3]])
    b.finish("gl-shell.glb")


# ================================================================== shops

_PM = {}


def pm(hexv, rough=0.6, metal=0.0):
    """A flat paint by colour (merged into GS_Paint at export)."""
    key = (hexv, rough)
    if key not in _PM:
        _PM[key] = mat(f"GL_C{hexv:06x}_{int(rough * 100)}", hexv, rough, metal)
    return _PM[key]


THEMES = {
    # floor: a palette key or a hex; wall: the shop's own wall colour
    "jewel": {"floor": 0x1f3a3a, "wall": 0xe6f1ee, "accent": 0x86d8cf},
    "tech": {"floor": 0xb9b5ad, "wall": 0xf4f4f2, "accent": 0xdedcd6},
    "games": {"floor": 0x2b2d31, "wall": 0x22252b, "accent": 0xd8202a},
    "shoes": {"floor": "woodfloor", "wall": 0x2a2a2a, "accent": 0xe2231a},
    "sports": {"floor": "woodfloor", "wall": 0x1a2c4e, "accent": 0xf2a900},
    "beauty": {"floor": 0xf1f1ef, "wall": 0x161616, "accent": 0xffffff},
    "restaurant": {"floor": "woodfloor", "wall": 0x5c3322, "accent": 0xf3c46b},
    "cafe": {"floor": "woodfloor", "wall": 0xeadcc2, "accent": 0x6b4a2a},
    "toys": {"floor": 0xf0efe8, "wall": 0xf6c700, "accent": 0xd01012},
    "band": {"floor": 0x1b1b1b, "wall": 0x121212, "accent": 0xff2d55},
    "athletic": {"floor": "woodfloor", "wall": 0xf4f1ea, "accent": 0xc8102e},
    "plush": {"floor": 0xf7d9e6, "wall": 0xfff6fa, "accent": 0xd6336c},
    "coffee": {"floor": "woodfloor", "wall": 0x13432f, "accent": 0xe9f3ee},
    "lux": {"floor": 0xe8e2d6, "wall": 0xe8e2d6, "accent": 0xc8a96a},
}


def store_box(st):
    """Interior extents of a shop: x0, x1, near z (front), far z (back), floor y, ceiling y."""
    row = st["row"]
    y0 = 0.0 if st["lvl"] == "g" else U
    y1 = SY if st["lvl"] == "g" else ROOF
    x0 = st["x0"] + (0 if abs(st["x0"]) == ENDX else 0.15)
    x1 = st["x1"] - (0 if abs(st["x1"]) == ENDX else 0.15)
    return x0, x1, row * (FRONT + 0.3), row * BACK, y0, y1


def floor_mat(P, theme):
    f = THEMES[theme]["floor"]
    return P[f] if isinstance(f, str) else pm(f, 0.35)


def storefront(b, P, st):
    """Frames, kickplate, mullions and fascia (the glass is grinleria.js)."""
    row = st["row"]
    y0 = 0.0 if st["lvl"] == "g" else U
    top = SY if st["lvl"] == "g" else ROOF
    gtop = y0 + 3.0
    zc = row * (FRONT + 0.15)
    x0, x1 = st["x0"], st["x1"]
    # fascia over the whole front (doors included): dark bronze, a lit
    # reveal under it; the sign is mounted on it in grinleria.js
    b.box(P["bronze_dk"], x1 - x0, top - gtop, 0.3, (x0 + x1) / 2, gtop, zc)
    b.box(P["lamp"], x1 - x0 - 0.2, 0.03, 0.06, (x0 + x1) / 2, gtop + 0.02, row * (FRONT - 0.03))
    b.box(P["bronze"], x1 - x0, 0.08, 0.34, (x0 + x1) / 2, gtop - 0.08, zc)
    # unit pilasters at the ends (cream stone)
    for x in (x0, x1):
        b.box(P["limestone"], 0.5, top - y0, 0.4, x, y0, row * (FRONT + 0.1))
    doors = [(d["x"] - d["w"] / 2, d["x"] + d["w"] / 2) for d in st.get("doors", [])]
    for s in [q for q in SOLIDS if q["k"] == "_front" and q.get("store") == st["id"]]:
        a, c = s["x"] - s["w"] / 2, s["x"] + s["w"] / 2
        b.box(P["bronze_dk"], c - a, 0.25, 0.3, s["x"], y0, zc)                    # kickplate
        n = max(1, math.ceil((c - a) / 1.6))
        for i in range(n + 1):
            x = a + (c - a) * i / n
            b.box(P["bronze"], 0.06, gtop - y0 - 0.25, 0.12, x, y0 + 0.25, zc)
    for (a, c) in doors:
        for x in (a, c):
            b.box(P["bronze"], 0.1, gtop - y0, 0.32, x, y0, zc)
        b.box(P["steel_dk"], c - a, 0.01, 0.3, (a + c) / 2, y0, zc)                 # threshold
    if not st["open"]:
        closed_display(b, P, st, y0, gtop)


def closed_display(b, P, st, y0, gtop):
    """A shop with its doors locked: a lit window display behind the glass
    (the collider is the front itself; nothing deeper is reachable)."""
    row = st["row"]
    x0, x1 = st["x0"] + 0.25, st["x1"] - 0.25
    zf, zb = row * (FRONT + 0.3), row * (FRONT + 1.9)
    accent = hexrgb(st["fg"])
    back = hexrgb(st["bg"])
    b.box(pm(back, 0.5), x1 - x0, gtop - y0, 0.06, (x0 + x1) / 2, y0, zb)
    b.box(P["limestone"], x1 - x0, 0.18, abs(zb - zf), (x0 + x1) / 2, y0, (zf + zb) / 2)
    b.box(pm(accent, 0.4), x1 - x0 - 1.2, 0.03, 0.04, (x0 + x1) / 2, y0 + 2.6, zb - row * 0.05)
    rnd = random.Random(hash(st["id"]) & 0xffff)
    n = 4
    for i in range(n):
        x = x0 + (x1 - x0) * (i + 0.5) / n
        zc = (zf + zb) / 2
        if i % 2 == 0:
            mannequin(b, P, x, y0 + 0.18, zc, face=0 if row > 0 else math.pi, outfit=pm(back if back > 0x333333 else accent, 0.7), seed=rnd.randint(0, 999))
        else:
            b.box(P["white"], 0.6, 0.9, 0.6, x, y0 + 0.18, zc)
            b.box(pm(rnd.choice([0x8a4a22, 0x1a1a1a, 0xc8a96a, 0x6b1f2a]), 0.45), 0.42, 0.3, 0.16, x, y0 + 1.08, zc)   # handbag
            b.bar(P["bronze"], (x - 0.12, y0 + 1.38, zc), (x + 0.12, y0 + 1.38, zc), 0.025)
        b.cyl(P["downlight"], 0.08, (x, gtop - 0.02, zc), (x, gtop, zc), seg=8, smooth=False)


def mannequin(b, P, x, y, z, face=0.0, outfit=None, seed=0):
    """A shop dummy: legs, torso in an outfit, arms, a head."""
    outfit = outfit or P["black"]
    c, s = math.cos(face), math.sin(face)

    def at(lx, ly, lz):
        return (x + lx * c + lz * s, y + ly, z - lx * s + lz * c)
    b.cyl(P["chrome"], 0.16, at(0, 0, 0), at(0, 0.03, 0), seg=10)
    for lx in (-0.09, 0.09):
        b.cyl(P["skin"], 0.055, at(lx, 0.03, 0), at(lx, 0.82, 0), seg=8, r2=0.07)
    b.cyl(outfit, 0.17, at(0, 0.78, 0), at(0, 1.45, 0), seg=10, r2=0.2)
    for lx in (-0.24, 0.24):
        b.cyl(outfit, 0.05, at(lx, 1.42, 0), at(lx * 1.15, 0.95, 0.04), seg=8)
        b.cyl(P["skin"], 0.035, at(lx * 1.15, 0.95, 0.04), at(lx * 1.2, 0.8, 0.06), seg=6)
    b.cyl(P["skin"], 0.045, at(0, 1.45, 0), at(0, 1.56, 0), seg=8)
    b.lump(P["skin"], 0.2, 0.25, 0.22, *at(0, 1.55, 0), seed=seed, rnd=0.9, jitter=0.0)


def build_shops(P):
    b = Builder()
    # ---- every shop: front, floor, lights
    for st in STORES.values():
        storefront(b, P, st)
        if not st["open"]:
            continue
        th = THEMES[st["theme"]]
        x0, x1, zf, zb, y0, y1 = store_box(st)
        za, zz = sorted((zf, zb))
        b.box(floor_mat(P, st["theme"]), x1 - x0, 0.012, zz - za, (x0 + x1) / 2, y0, (za + zz) / 2)
        # ceiling: a drop ceiling (upstairs, under the roof), light panels
        if st["lvl"] == "u":
            b.box(pm(th["wall"], 0.8), x1 - x0, 0.06, zz - za, (x0 + x1) / 2, ROOF - 0.7, (za + zz) / 2)
            y1 = ROOF - 0.7
        nx = max(1, round((x1 - x0) / 3.2))
        nz = 3
        for i in range(nx):
            for j in range(nz):
                x = x0 + (x1 - x0) * (i + 0.5) / nx
                z = za + (zz - za) * (j + 0.5) / nz
                b.box(P["lamp"], 0.9, 0.03, 0.9, x, y1 - 0.03, z)
        # the back wall's feature panel (split round a stock-room door)
        row = st["row"]
        holes = []
        if st.get("backDoor"):
            d = st["backDoor"]
            holes.append((d["x"] - d["w"] / 2 - 0.2, d["x"] + d["w"] / 2 + 0.2))
        cuts = [(x0 + 0.4, x1 - 0.4)]
        for (h0, h1) in holes:
            nxt = []
            for (a, c) in cuts:
                if h1 <= a or h0 >= c:
                    nxt.append((a, c))
                    continue
                if h0 > a:
                    nxt.append((a, h0))
                if h1 < c:
                    nxt.append((h1, c))
            cuts = nxt
        for (a, c) in cuts:
            b.box(pm(th["accent"], 0.5), c - a, (y1 - y0) - 0.9, 0.04, (a + c) / 2, y0 + 0.3, row * (BACK - 0.03))
        if st.get("backDoor"):
            d = st["backDoor"]
            for x in (d["x"] - d["w"] / 2, d["x"] + d["w"] / 2):
                b.box(P["steel_dk"], 0.08, 2.3, 0.36, x, y0, row * (BACK + 0.15))
            b.box(P["steel_dk"], d["w"], 0.08, 0.36, d["x"], y0 + 2.3, row * (BACK + 0.15))
            b.box(P["exit"], 0.5, 0.18, 0.04, d["x"], y0 + 2.5, row * (BACK - 0.03))
            b.box(P["wall_warm"], d["w"], SY - 2.38, 0.3, d["x"], y0 + 2.38, row * (BACK + 0.15))

    # ---- walls between the shops (and their backs): the wall colour of
    # whichever open shop each face looks into
    def owner(lvl, row, x, z=None):
        for st in STORES.values():
            if st["lvl"] == lvl and st["row"] == row and st["open"] and st["x0"] - 0.01 <= x <= st["x1"] + 0.01:
                return st
        return None
    for s in kinds("_divider", "_back", "_corridorend"):
        sbox(b, P["wall"], s)
        lvl = s.get("lvl", "g")
        row = s["row"]
        if s["k"] == "_divider":
            for side in (-1, 1):
                fx = s["x"] + side * 0.16
                st = owner(lvl, row, fx)
                if st and abs(fx) < ENDX + 0.01:
                    b.box(pm(THEMES[st["theme"]]["wall"], 0.8), 0.02, s["h"], s["d"], fx, s["y"], s["z"])
        elif s["k"] == "_back":
            a, c = s["x"] - s["w"] / 2, s["x"] + s["w"] / 2
            for st in STORES.values():
                if st["lvl"] != lvl or st["row"] != row or not st["open"]:
                    continue
                lo, hi = max(a, st["x0"]), min(c, st["x1"])
                if hi - lo > 0.05:
                    b.box(pm(THEMES[st["theme"]]["wall"], 0.8), hi - lo, s["h"], 0.02, (lo + hi) / 2, s["y"], row * (BACK - 0.01))
    # link doorways: frames
    for st in STORES.values():
        if not st.get("link"):
            continue
        L = st["link"]
        y0 = 0.0 if st["lvl"] == "g" else U
        x = st["x1"] if L["side"] == "e" else st["x0"] if L["side"] == "w" else (st["x0"] + st["x1"]) / 2
        if abs(x) == ENDX:
            x = math.copysign(ENDX + 0.15, x)
        for z in (L["z"] - L["w"] / 2, L["z"] + L["w"] / 2):
            b.box(P["bronze"], 0.36, 2.6, 0.08, x, y0, z)
        b.box(P["wall"], 0.3, (SY if st["lvl"] == "g" else ROOF) - y0 - 2.6, L["w"], x, y0 + 2.6, L["z"])
        b.box(P["bronze"], 0.36, 0.08, L["w"] + 0.08, x, y0 + 2.6, L["z"])

    # ---- shop interiors
    draw_props(b, P, "shops")
    b.finish("gl-shops.glb")


# ================================================================== props

def region(s):
    if abs(s["z"]) > BZ:
        return "outside"
    if abs(s["x"]) > ENDX + 0.3:
        return "wings"
    if FRONT <= abs(s["z"]) <= BACK:
        return "shops"
    return "atrium"


def draw_props(b, P, where):
    for s in SOLIDS + ANCHORS:
        fn = PROPS.get(s["k"])
        if fn and region(s) == where:
            fn(b, P, s, Frame(s))


def p_case(b, P, s, F):
    """Jewellery case: walnut base, lit glass top (dark glass + sparkle)."""
    F.box(b, P["wood_dk"], F.w, 0.75, F.d, 0, 0, 0)
    F.box(b, P["bronze"], F.w + 0.02, 0.03, F.d + 0.02, 0, 0.75, 0)
    F.box(b, P["glassdk"], F.w - 0.04, 0.22, F.d - 0.04, 0, 0.78, 0)
    F.box(b, P["lamp"], F.w - 0.1, 0.01, F.d - 0.1, 0, 0.77, 0)
    rnd = random.Random(int(abs(s["x"] * 7 + s["z"] * 3)))
    for i in range(int(F.w * 3)):
        lx = -F.w / 2 + 0.15 + (F.w - 0.3) * (i + 0.5) / int(F.w * 3)
        F.box(b, P["teal"] if i % 3 == 0 else P["white"], 0.1, 0.07, 0.1, lx, 0.79, rnd.uniform(-F.d / 4, F.d / 4))
        F.cyl(b, P["chrome"], 0.025, (lx, 0.87, 0), (lx, 0.9, 0), seg=6)
    F.box(b, P["black"], F.w + 0.05, 0.08, F.d + 0.05, 0, 0, 0)


def p_backcase(b, P, s, F):
    F.box(b, P["wood_dk"], F.w, 1.05, F.d, 0, 0, 0)
    F.box(b, P["bronze"], F.w, 0.03, F.d, 0, 1.05, 0)
    F.box(b, P["mirror"], F.w - 0.4, 1.6, 0.04, 0, 1.3, -F.d / 2 + 0.05)
    for i in range(5):
        F.box(b, P["teal"], 0.3, 0.2, 0.3, -F.w / 2 + 0.6 + i * (F.w - 1.2) / 4, 1.08, 0.05)
        F.box(b, P["white"], 0.31, 0.03, 0.31, -F.w / 2 + 0.6 + i * (F.w - 1.2) / 4, 1.2, 0.05)


def p_hoststand(b, P, s, F):
    """Grand Lulz: the host stand and the dessert counter by the door."""
    F.box(b, P["wood"], F.w, 1.0, F.d, 0, 0, 0)
    F.box(b, P["wood_dk"], F.w + 0.06, 0.05, F.d + 0.06, 0, 1.0, 0)
    for i in range(4):
        F.cyl(b, P["cream"], 0.13, (-F.w / 2 + 0.5 + i * 0.7, 1.05, 0), (-F.w / 2 + 0.5 + i * 0.7, 1.16, 0), seg=12)
    F.box(b, P["black"], 0.3, 0.02, 0.4, F.w / 2 - 0.3, 1.05, 0)
    F.cyl(b, P["bronze"], 0.015, (F.w / 2 - 0.15, 1.05, 0), (F.w / 2 - 0.15, 1.45, 0), seg=6)
    F.box(b, P["lamp"], 0.14, 0.14, 0.14, F.w / 2 - 0.15, 1.45, 0)


def booth_bench(b, P, F, lx, lz, length, face):
    """A high-backed leather booth seat, its back on the far side from `face`."""
    sgn = 1 if face > 0 else -1
    F.box(b, P["wood_dk"], length, 0.45, 0.6, lx, 0, lz)
    F.box(b, P["leather"], length, 0.12, 0.55, lx, 0.45, lz + sgn * 0.02)
    F.box(b, P["leather"], length, 0.75, 0.16, lx, 0.5, lz - sgn * 0.25)
    F.box(b, P["wood_dk"], length + 0.04, 0.06, 0.2, lx, 1.25, lz - sgn * 0.25)


def p_booth(b, P, s, F):
    """A booth: two benches back to back with a table between (along the
    long side of the box)."""
    L = max(F.w, F.d)
    along = F.w >= F.d
    # draw in a frame turned so the length runs along local x
    G = Frame({**s, "f": (s.get("f", 0) or 0) + (0 if along else math.pi / 2)})
    booth_bench(b, P, G, 0, -0.25 - 0.0, L, 1)
    G.box(b, P["wood"], L - 0.2, 0.05, 0.4, 0, 0.72, 0.2)
    G.box(b, P["steel_dk"], 0.1, 0.72, 0.1, 0, 0, 0.2)
    G.cyl(b, P["lamp"], 0.12, (0, 1.9, 0.2), (0, 2.1, 0.2), seg=10, r2=0.05)
    G.cyl(b, P["black"], 0.005, (0, 2.1, 0.2), (0, SY - (s.get("y", 0)) - 0.01, 0.2), seg=4)


def p_booths(b, P, s, F):
    """Grand Lulz west half: a run of booths down the room."""
    L = max(F.w, F.d)
    along = F.w >= F.d
    G = Frame({**s, "f": (s.get("f", 0) or 0) + (0 if along else math.pi / 2)})
    # two-person tables between facing benches, the run's long axis local x
    for lx in (-L / 2 + 0.3, L / 2 - 0.3):
        G.box(b, P["wood_dk"], 0.6, 0.45, s["w"] if not along else s["d"], lx, 0, 0)
    for lx in (-L / 2 + 0.35, L / 2 - 0.35):
        G.box(b, P["leather"], 0.5, 0.12, 1.1, lx, 0.45, 0)
        G.box(b, P["leather"], 0.16, 0.75, 1.1, lx + math.copysign(0.2, lx), 0.5, 0)        # high back
    G.box(b, P["wood"], L - 1.4, 0.05, 0.9, 0, 0.72, 0)
    G.box(b, P["steel_dk"], 0.12, 0.72, 0.12, 0, 0, 0)
    G.cyl(b, P["lamp"], 0.14, (0, 1.9, 0), (0, 2.1, 0), seg=10, r2=0.06)
    G.cyl(b, P["black"], 0.005, (0, 2.1, 0), (0, SY - 0.01, 0), seg=4)
    for lx in (-0.5, 0.5):
        G.box(b, P["white"], 0.24, 0.02, 0.24, lx, 0.77, 0.2)
        G.cyl(b, P["glassdk"], 0.035, (lx + 0.2, 0.77, -0.2), (lx + 0.2, 0.92, -0.2), seg=6)


def p_pass(b, P, s, F):
    """Grand Lulz: the kitchen pass, heat lamps, a tiled kitchen beyond."""
    F.box(b, P["steel"], F.w, 1.05, F.d, 0, 0, 0)
    F.box(b, P["chrome"], F.w + 0.04, 0.04, F.d + 0.04, 0, 1.05, 0)
    for i in range(6):
        lx = -F.w / 2 + 0.5 + i * (F.w - 1) / 5
        F.box(b, P["white"], 0.28, 0.02, 0.28, lx, 1.09, 0)
        b.lump(P["orange"] if i % 2 else P["green"], 0.18, 0.06, 0.18, *F.p(lx, 1.11, 0), seed=i, rnd=0.8)
        F.cyl(b, P["redlamp"], 0.07, (lx, 1.75, 0), (lx, 1.85, 0), seg=8, r2=0.04)
    F.box(b, P["steel_dk"], F.w, 0.08, 0.5, 0, 1.9, 0)


def p_ptable(b, P, s, F):
    """Trapple: long blond-wood table with devices laid out in rows."""
    L, W = max(F.w, F.d), min(F.w, F.d)
    G = Frame({**s, "f": (s.get("f", 0) or 0) + (0 if F.w >= F.d else math.pi / 2)})
    G.box(b, P["wood_lt"], L, 0.06, W, 0, 0.84, 0)
    for lx in (-L / 2 + 0.25, L / 2 - 0.25):
        G.box(b, P["wood_lt"], 0.08, 0.84, W - 0.1, lx, 0, 0)
    G.box(b, P["wood_lt"], L - 0.5, 0.08, 0.08, 0, 0.3, 0)
    n = int(L / 0.6)
    for i in range(n):
        lx = -L / 2 + 0.3 + i * (L - 0.6) / max(1, n - 1)
        for lz in (-W / 4, W / 4):
            if i % 3 == 1:
                G.box(b, P["steel"], 0.32, 0.015, 0.22, lx, 0.9, lz)                      # laptop base
                G.box(b, P["screen"], 0.32, 0.21, 0.01, lx, 0.915, lz - 0.1, rx=-0.25)
            else:
                G.box(b, P["black"], 0.075, 0.012, 0.155, lx, 0.9, lz)                    # phone
                G.box(b, P["screen"], 0.065, 0.002, 0.14, lx, 0.912, lz)


def p_genius(b, P, s, F):
    """Trapple: the genius bar, stools, and a video wall above it."""
    F.box(b, P["wood_lt"], F.w, 1.05, F.d, 0, 0, 0)
    F.box(b, P["white"], F.w + 0.04, 0.04, F.d + 0.1, 0, 1.05, 0.03)
    for i in range(6):
        lx = -F.w / 2 + 0.6 + i * (F.w - 1.2) / 5
        F.cyl(b, P["steel"], 0.025, (lx, 0, F.d / 2 + 0.55), (lx, 0.72, F.d / 2 + 0.55), seg=6)
        F.cyl(b, P["wood_lt"], 0.18, (lx, 0.72, F.d / 2 + 0.55), (lx, 0.76, F.d / 2 + 0.55), seg=12)
        F.cyl(b, P["steel"], 0.2, (lx, 0, F.d / 2 + 0.55), (lx, 0.02, F.d / 2 + 0.55), seg=12)
    F.box(b, P["black"], F.w + 1.0, 1.9, 0.06, 0, 1.55, -F.d / 2 + 0.02)
    F.box(b, P["screen"], F.w + 0.8, 1.7, 0.02, 0, 1.65, -F.d / 2 + 0.06)


def p_bar(b, P, s, F):
    """Grand Lulz: the bar. Brass rail, stools, bottles on lit shelves."""
    F.box(b, P["wood_dk"], F.w, 1.05, F.d, 0, 0, 0)
    F.box(b, P["wood"], F.w + 0.1, 0.06, F.d + 0.2, 0, 1.05, 0.05)
    F.cyl(b, P["bronze"], 0.03, (-F.w / 2, 0.2, F.d / 2 + 0.1), (F.w / 2, 0.2, F.d / 2 + 0.1), seg=8)
    for i in range(6):
        lx = -F.w / 2 + 0.6 + i * (F.w - 1.2) / 5
        F.cyl(b, P["bronze"], 0.03, (lx, 0, F.d / 2 + 0.6), (lx, 0.72, F.d / 2 + 0.6), seg=6)
        F.cyl(b, P["leather"], 0.19, (lx, 0.72, F.d / 2 + 0.6), (lx, 0.8, F.d / 2 + 0.6), seg=12)
    for k, y in enumerate((1.4, 1.85, 2.3)):
        F.box(b, P["mirror"], F.w, 0.4, 0.03, 0, y, -F.d / 2 - 0.12)
        F.box(b, P["lamp"], F.w, 0.02, 0.2, 0, y - 0.02, -F.d / 2 - 0.05)
        for i in range(int(F.w / 0.16)):
            lx = -F.w / 2 + 0.1 + i * 0.16
            col = (P["green"], P["bronze"], P["glassdk"], P["red"], P["cream"])[(i * 7 + k) % 5]
            F.cyl(b, col, 0.035, (lx, y, -F.d / 2 - 0.05), (lx, y + 0.24, -F.d / 2 - 0.05), seg=6)
            F.cyl(b, col, 0.012, (lx, y + 0.24, -F.d / 2 - 0.05), (lx, y + 0.32, -F.d / 2 - 0.05), seg=4)


def shelf_unit(b, P, F, body, levels, fill):
    """Wall shelving: a carcass and `levels` shelves; `fill(lx, y, lz, w)`
    stocks one shelf."""
    F.box(b, body, F.w, F.h, 0.08, 0, 0, -F.d / 2 + 0.04)
    for lx in (-F.w / 2 + 0.03, F.w / 2 - 0.03):
        F.box(b, body, 0.06, F.h, F.d, lx, 0, 0)
    for i in range(levels):
        y = 0.12 + i * (F.h - 0.2) / levels
        F.box(b, body, F.w, 0.03, F.d, 0, y, 0)
        fill(y + 0.03, i)
    F.box(b, body, F.w, 0.06, F.d, 0, F.h - 0.06, 0)


def p_shelf(b, P, s, F):
    """GameStonk: game boxes, a TV running a game on top."""
    rnd = random.Random(int(abs(s["x"] * 13 + s["z"])))
    cols = [P["red"], P["blue"], P["green"], P["black"], P["white"], P["orange"], P["purple"]]

    def fill(y, i):
        n = int(F.w / 0.16)
        for k in range(n):
            lx = -F.w / 2 + 0.1 + k * (F.w - 0.2) / max(1, n - 1)
            F.box(b, rnd.choice(cols), 0.13, 0.19, 0.03, lx, y, F.d / 2 - 0.1)
    shelf_unit(b, P, F, P["black"], 4, fill)
    F.box(b, P["black"], min(1.6, F.w - 0.2), 0.95, 0.06, 0, F.h + 0.15, -F.d / 2 + 0.1)
    F.box(b, P["screen_g"], min(1.5, F.w - 0.3), 0.85, 0.02, 0, F.h + 0.2, -F.d / 2 + 0.14)


def p_makeupwall(b, P, s, F):
    """Sephtroll: rows of bottles and palettes under lit strips."""
    rnd = random.Random(int(abs(s["x"] * 11 + s["z"])))
    cols = [P["pink"], P["red"], P["white"], P["black"], pm(0xd9a38a), pm(0x8a3b5a), pm(0xf2d2c2)]

    def fill(y, i):
        n = int(F.w / 0.09)
        F.box(b, P["lamp"], F.w - 0.1, 0.01, 0.04, 0, y + 0.3, F.d / 2 - 0.03)
        for k in range(n):
            lx = -F.w / 2 + 0.06 + k * (F.w - 0.12) / max(1, n - 1)
            F.cyl(b, rnd.choice(cols), 0.025, (lx, y, F.d / 2 - 0.12), (lx, y + rnd.uniform(0.08, 0.16), F.d / 2 - 0.12), seg=6)
    shelf_unit(b, P, F, P["white"], 5, fill)
    F.box(b, P["black"], F.w, 0.2, 0.1, 0, F.h, -F.d / 2 + 0.05)


def p_gondola(b, P, s, F):
    """GameStonk: a double-sided gondola of consoles and controllers."""
    F.box(b, P["black"], F.w, F.h - 0.1, 0.1, 0, 0, 0)
    for side in (-1, 1):
        for y in (0.15, 0.6, 1.05):
            F.box(b, P["black"], F.w, 0.03, F.d / 2, 0, y, side * F.d / 4)
            for k in range(int(F.w / 0.4)):
                lx = -F.w / 2 + 0.25 + k * 0.4
                F.box(b, P["white"] if k % 2 else P["black"], 0.3, 0.07 if y > 0.5 else 0.35, 0.22, lx, y + 0.03, side * F.d / 4)
    F.box(b, P["red"], F.w, 0.12, F.d, 0, F.h - 0.12, 0)


def p_makeupgondola(b, P, s, F):
    """Sephtroll: a mirrored gondola of palettes."""
    F.box(b, P["black"], F.w, 1.1, F.d, 0, 0, 0)
    F.box(b, P["white"], F.w + 0.04, 0.03, F.d + 0.04, 0, 1.1, 0)
    for side in (-1, 1):
        F.box(b, P["mirror"], F.w - 0.4, 0.35, 0.03, 0, 1.13, side * 0.1)
        for k in range(int(F.w / 0.22)):
            lx = -F.w / 2 + 0.2 + k * 0.22
            F.box(b, pm([0xd9a38a, 0x8a3b5a, 0xf2d2c2, 0xc23b6a][k % 4], 0.4), 0.16, 0.015, 0.12, lx, 1.13, side * (F.d / 2 - 0.12))


def p_demo(b, P, s, F):
    """GameStonk: a demo station with a TV and a console on a podium."""
    F.box(b, P["black"], F.w, 0.9, F.d, 0, 0, 0)
    F.box(b, P["red"], F.w + 0.02, 0.04, F.d + 0.02, 0, 0.9, 0)
    F.box(b, P["black"], F.w - 0.2, 0.4, 0.06, 0, 0.94, -F.d / 2 + 0.15)
    F.box(b, P["screen_g"], F.w - 0.3, 0.32, 0.02, 0, 0.98, -F.d / 2 + 0.19)
    F.box(b, P["white"], 0.3, 0.06, 0.2, 0, 0.94, 0.2)


def p_testerbar(b, P, s, F):
    F.box(b, P["white"], F.w, 0.9, F.d, 0, 0, 0)
    F.box(b, P["black"], F.w + 0.02, 0.04, F.d + 0.02, 0, 0.9, 0)
    for lx in (-0.5, 0.5):
        F.box(b, P["mirror"], 0.5, 0.4, 0.03, lx, 0.94, -F.d / 2 + 0.1)
        for k in range(5):
            F.cyl(b, P["lamp"], 0.025, (lx - 0.28, 0.98 + k * 0.08, -F.d / 2 + 0.12), (lx - 0.28, 1.0 + k * 0.08, -F.d / 2 + 0.12), seg=6)


def p_shoewall(b, P, s, F):
    """Troll Locker / Neiman's shoe salon: angled shoe shelves."""
    rnd = random.Random(int(abs(s["x"] * 5 + s["z"] * 17)))
    cols = [P["white"], P["black"], P["red"], P["blue"], pm(0xc8c0b0), pm(0x2f6f4f), P["orange"]]

    def fill(y, i):
        n = int(F.w / 0.34)
        for k in range(n):
            lx = -F.w / 2 + 0.2 + k * (F.w - 0.4) / max(1, n - 1)
            c = rnd.choice(cols)
            F.box(b, c, 0.11, 0.06, 0.28, lx, y, 0.02)
            F.box(b, c, 0.1, 0.05, 0.12, lx, y + 0.05, -0.06)
            F.box(b, P["white"], 0.11, 0.02, 0.28, lx, y, 0.02)
    shelf_unit(b, P, F, P["black"] if s["k"] == "shoewall" and region(s) == "shops" else P["wood_lt"], 5, fill)
    F.box(b, P["lamp"], F.w - 0.1, 0.03, 0.05, 0, F.h - 0.1, F.d / 2 - 0.05)


def p_jerseywall(b, P, s, F):
    """H-Town Threads: jerseys hung on the wall in the city's colours."""
    F.box(b, P["navy"], F.w, F.h, 0.1, 0, 0, -F.d / 2 + 0.05)
    cols = [pm(0xce1141), pm(0xeb6e1f), pm(0x002d62), pm(0xf2a900), P["white"], pm(0xa6192e)]
    n = int(F.w / 0.75)
    for k in range(n):
        lx = -F.w / 2 + 0.4 + k * (F.w - 0.8) / max(1, n - 1)
        for row, y in enumerate((0.25, 1.15)):
            c = cols[(k + row * 3) % len(cols)]
            F.box(b, c, 0.5, 0.62, 0.04, lx, y, -F.d / 2 + 0.14)
            F.box(b, c, 0.72, 0.18, 0.04, lx, y + 0.44, -F.d / 2 + 0.14)
            F.box(b, P["white"] if c is not P["white"] else P["navy"], 0.16, 0.2, 0.01, lx, y + 0.22, -F.d / 2 + 0.17)
            F.cyl(b, P["chrome"], 0.01, (lx, y + 0.62, -F.d / 2 + 0.14), (lx, y + 0.72, -F.d / 2 + 0.06), seg=4)
    F.box(b, P["lamp"], F.w - 0.1, 0.04, 0.06, 0, F.h - 0.06, -F.d / 2 + 0.2)


def p_tshirts(b, P, s, F):
    """Folded tees on a table (H-Town Threads) / a low bench (Troll Locker)."""
    if s["k"] == "bench" or (F.h < 0.6):
        return p_bench(b, P, s, F)
    F.box(b, P["wood"], F.w, 0.06, F.d, 0, F.h - 0.06, 0)
    for lx in (-F.w / 2 + 0.1, F.w / 2 - 0.1):
        F.box(b, P["black"], 0.06, F.h - 0.06, F.d - 0.1, lx, 0, 0)
    cols = [P["navy"], pm(0xeb6e1f), P["white"], pm(0xce1141), P["black"]]
    n = int(F.w / 0.4)
    for k in range(n):
        lx = -F.w / 2 + 0.25 + k * (F.w - 0.5) / max(1, n - 1)
        for lz in (-F.d / 4, F.d / 4):
            F.box(b, cols[(k + int(lz > 0)) % 5], 0.32, 0.12 + 0.04 * (k % 3), 0.26, lx, F.h, lz)


def p_shoeplinth(b, P, s, F):
    F.cyl(b, P["white"], F.w / 2, (0, 0, 0), (0, F.h, 0), seg=16)
    F.cyl(b, P["red"], F.w / 2 + 0.02, (0, F.h - 0.04, 0), (0, F.h, 0), seg=16)
    for k in range(3):
        a = k * 2.1
        lx, lz = math.cos(a) * 0.35, math.sin(a) * 0.35
        F.box(b, [P["white"], P["black"], P["red"]][k], 0.12, 0.08, 0.3, lx, F.h, lz, ry=a)


def p_roundrack(b, P, s, F):
    """Clothing rack: chrome ring on a pole, garments hung all round."""
    r = min(F.w, F.d) / 2 - 0.05
    F.cyl(b, P["chrome"], 0.25, (0, 0, 0), (0, 0.03, 0), seg=12)
    F.cyl(b, P["chrome"], 0.02, (0, 0, 0), (0, F.h, 0), seg=6)
    ring = 16
    for k in range(ring):
        a0, a1 = 2 * math.pi * k / ring, 2 * math.pi * (k + 1) / ring
        F.bar(b, P["chrome"], (r * math.cos(a0), F.h, r * math.sin(a0)), (r * math.cos(a1), F.h, r * math.sin(a1)), 0.02)
    rnd = random.Random(int(abs(s["x"] * 31 + s["z"] * 7)))
    theme = rnd.choice([[0x1a1a1a, 0x3a3a3a, 0xc8102e], [0x2f4f6f, 0xe8e2d6, 0x8a6a4a], [0x6b1f2a, 0xd9c27a, 0x1a1a1a]])
    for k in range(22):
        a = 2 * math.pi * k / 22
        c = pm(theme[k % 3], 0.9)
        x, z = r * math.cos(a), r * math.sin(a)
        F.box(b, c, 0.04, 0.85, 0.42, x, F.h - 0.9, z, ry=-a)


def p_table4(b, P, s, F):
    """Cafe table for four (Cheesecake Trollery: white cloth; Trollbucks: wood)."""
    cafe = s["k"] == "cafetable"
    top = P["wood"] if cafe else P["white"]
    F.cyl(b, P["black"], 0.04, (0, 0, 0), (0, F.h - 0.04, 0), seg=8)
    F.cyl(b, P["black"], 0.25, (0, 0, 0), (0, 0.03, 0), seg=10)
    if cafe:
        F.cyl(b, top, F.w / 2 - 0.1, (0, F.h - 0.04, 0), (0, F.h, 0), seg=16)
    else:
        F.box(b, top, F.w - 0.1, 0.04, F.d - 0.1, 0, F.h - 0.04, 0)
        F.box(b, top, F.w - 0.06, 0.25, F.d - 0.06, 0, F.h - 0.27, 0)
        for lx, lz in ((-0.2, -0.15), (0.2, 0.15)):
            F.cyl(b, P["cream"], 0.08, (lx, F.h, lz), (lx, F.h + 0.06, lz), seg=10)
    for k in range(4):
        a = k * math.pi / 2
        chair(b, P, F, math.sin(a) * 0.85, math.cos(a) * 0.85, a + math.pi,
              seat=P["leather_bk"] if not cafe else P["wood_dk"], frame=P["bronze_dk"])


def p_dessert(b, P, s, F):
    """Cheesecake Trollery: the dessert case (cheesecakes, lit) /
    Trollbucks: the coffee bar (espresso machines, menu)."""
    coffee = s["k"] == "coffeebar"
    F.box(b, P["wood_dk"] if not coffee else P["green"], F.w, 0.85, F.d, 0, 0, 0)
    F.box(b, P["white"], F.w + 0.04, 0.04, F.d + 0.04, 0, 0.85, 0)
    if coffee:
        for lx in (-1.5, 0, 1.5):
            F.box(b, P["chrome"], 0.7, 0.45, 0.5, lx, 0.89, -0.05)
            F.box(b, P["black"], 0.5, 0.05, 0.3, lx, 1.34, -0.05)
            for k in range(3):
                F.cyl(b, P["white"], 0.04, (lx - 0.2 + k * 0.2, 1.39, 0), (lx - 0.2 + k * 0.2, 1.49, 0), seg=8)
        F.box(b, P["black"], F.w, 1.0, 0.06, 0, 1.6, -F.d / 2 - 0.15)
        F.box(b, P["cream"], F.w - 0.3, 0.8, 0.02, 0, 1.7, -F.d / 2 - 0.11)
        return
    F.box(b, P["glassdk"], F.w - 0.1, 0.55, F.d - 0.1, 0, 0.89, 0)
    F.box(b, P["lamp"], F.w - 0.2, 0.01, F.d - 0.2, 0, 1.43, 0)
    for k in range(9):
        lx = -F.w / 2 + 0.4 + k * (F.w - 0.8) / 8
        for y in (0.9, 1.15):
            F.cyl(b, P["cream"], 0.13, (lx, y, 0), (lx, y + 0.09, 0), seg=12)
            F.cyl(b, [P["red"], P["bronze"], P["yellow"], P["pink"]][k % 4], 0.13, (lx, y + 0.09, 0), (lx, y + 0.11, 0), seg=12)


def p_bin(b, P, s, F):
    """Brick Problem: pick-a-brick bins / Build-A-Troll: plush bins."""
    plush = s["k"] == "plushbin"
    F.box(b, P["white"] if plush else P["yellow"], F.w, F.h - 0.1, F.d, 0, 0, 0)
    F.box(b, P["pink"] if plush else P["red"], F.w + 0.04, 0.1, F.d + 0.04, 0, F.h - 0.1, 0)
    rnd = random.Random(int(abs(s["x"] * 3 + s["z"] * 29)))
    for k in range(18 if not plush else 7):
        lx, lz = rnd.uniform(-F.w / 2 + 0.2, F.w / 2 - 0.2), rnd.uniform(-F.d / 2 + 0.2, F.d / 2 - 0.2)
        if plush:
            c = rnd.choice([pm(0xf2c7d8), pm(0xc8e6f2), pm(0xf7e2a8), pm(0xd8c8f0), P["white"]])
            b.lump(c, 0.35, 0.3, 0.35, *F.p(lx, F.h - 0.2, lz), seed=k, rnd=0.9, jitter=0.03)
        else:
            c = rnd.choice([P["red"], P["blue"], P["yellow"], P["green"], P["white"], P["black"]])
            F.box(b, c, 0.16, 0.1, 0.08, lx, F.h - 0.18 + rnd.uniform(0, 0.12), lz, ry=rnd.uniform(0, 3))


def p_statue(b, P, s, F):
    """Brick Problem: a life-size troll built of bricks (grin and all)."""
    F.box(b, P["black"], F.w, 0.2, F.d, 0, 0, 0)
    body = [(-0.25, 0.2, 0.4, 0.7), (0.25, 0.2, 0.4, 0.7), (0, 0.9, 0.85, 0.75)]
    for (lx, y, w, h) in body:
        for i in range(int(h / 0.1)):
            F.box(b, P["blue"] if y < 0.8 else P["red"], w, 0.095, 0.4, lx, y + i * 0.1, 0)
    for lx in (-0.55, 0.55):
        F.box(b, P["red"], 0.22, 0.6, 0.22, lx, 1.0, 0)
    # the head: a wide grin of yellow bricks with a black smile
    for i in range(6):
        F.box(b, P["yellow"], 0.9 - abs(i - 2.5) * 0.06, 0.095, 0.7, 0, 1.68 + i * 0.1, 0)
    F.box(b, P["black"], 0.62, 0.05, 0.02, 0, 1.82, 0.36)
    for lx in (-0.32, 0.32):
        F.box(b, P["black"], 0.08, 0.12, 0.02, lx, 1.84, 0.36)
    for lx in (-0.18, 0.18):
        F.box(b, P["white"], 0.14, 0.08, 0.02, lx, 2.05, 0.36)
        F.box(b, P["black"], 0.05, 0.05, 0.02, lx, 2.06, 0.37)
    for k in range(6):
        F.cyl(b, P["yellow"], 0.05, (-0.25 + k * 0.1, 2.28, 0), (-0.25 + k * 0.1, 2.33, 0), seg=8)


def p_stuffer(b, P, s, F):
    """Build-A-Troll: the stuffing machine, a clear drum of fluff."""
    F.box(b, P["pink"], F.w, 1.0, F.d, 0, 0, 0)
    F.cyl(b, P["glassdk"], 0.6, (0, 1.0, 0), (0, 2.2, 0), seg=16)
    for k in range(9):
        a = k * 0.7
        b.lump(P["white"], 0.3, 0.22, 0.3, *F.p(math.cos(a) * 0.3, 1.05 + k * 0.12, math.sin(a) * 0.3), seed=k, rnd=0.9, jitter=0.03)
    F.cyl(b, P["pink"], 0.65, (0, 2.2, 0), (0, 2.4, 0), seg=16)
    F.cyl(b, P["chrome"], 0.06, (0, 0.6, F.d / 2), (0, 0.6, F.d / 2 + 0.3), seg=8)


def p_brickwall(b, P, s, F):
    """Pick-a-brick wall: a grid of clear tubes full of colour /
    a plush wall of cubbies."""
    plush = s["k"] == "plushwall"
    F.box(b, P["white"] if plush else P["black"], F.w, F.h, F.d, 0, 0, 0)
    cols = [P["red"], P["blue"], P["yellow"], P["green"], P["white"], P["orange"], P["purple"], P["pink"]]
    nx, ny = int(F.w / 0.45), 4
    for i in range(nx):
        for j in range(ny):
            lx = -F.w / 2 + 0.25 + i * (F.w - 0.5) / max(1, nx - 1)
            y = 0.2 + j * 0.45
            if plush:
                F.box(b, pm(0xf2d6e2), 0.4, 0.4, 0.05, lx, y, F.d / 2 - 0.02)
                b.lump(cols[(i * 3 + j) % 8], 0.28, 0.3, 0.2, *F.p(lx, y + 0.05, F.d / 2), seed=i * 9 + j, rnd=0.9, jitter=0.02)
            else:
                F.cyl(b, cols[(i * 5 + j * 3) % 8], 0.15, (lx, y + 0.2, F.d / 2), (lx, y + 0.2, F.d / 2 + 0.06), seg=10)
    F.box(b, P["lamp"], F.w - 0.1, 0.03, 0.06, 0, F.h - 0.05, F.d / 2)


def p_tshirtwall(b, P, s, F):
    """Hot Trollpic: band tees on a black wall / Lulzlemon: rolled yoga mats."""
    yoga = s["k"] == "yogawall"
    F.box(b, P["white"] if yoga else P["black"], F.w, F.h, F.d, 0, 0, 0)
    n = int(F.w / 0.6)
    for i in range(n):
        lx = -F.w / 2 + 0.35 + i * (F.w - 0.7) / max(1, n - 1)
        if yoga:
            for j in range(3):
                c = pm([0xc8102e, 0x6fb7c9, 0x2f2f2f, 0xd8c3a5, 0x9b6fb0][(i + j) % 5])
                F.cyl(b, c, 0.07, (lx - 0.3, 0.35 + j * 0.55, F.d / 2 + 0.08), (lx + 0.3, 0.35 + j * 0.55, F.d / 2 + 0.08), seg=10)
        else:
            for j, y in enumerate((0.25, 1.1)):
                c = P["black"] if (i + j) % 2 else pm(0x2a2a2a)
                F.box(b, c, 0.5, 0.62, 0.03, lx, y, F.d / 2 + 0.03)
                F.box(b, c, 0.7, 0.18, 0.03, lx, y + 0.44, F.d / 2 + 0.03)
                F.box(b, [P["neon_pink"], P["white"], P["red"], P["yellow"]][(i * 3 + j) % 4], 0.26, 0.24, 0.01, lx, y + 0.2, F.d / 2 + 0.05)


def p_counter(b, P, s, F):
    F.box(b, P["black"], F.w, F.h, F.d, 0, 0, 0)
    F.box(b, P["wood_lt"], F.w + 0.06, 0.04, F.d + 0.06, 0, F.h, 0)
    F.box(b, P["black"], 0.3, 0.25, 0.04, 0.4, F.h + 0.04, 0, rx=-0.3)
    F.box(b, P["screen"], 0.26, 0.2, 0.01, 0.4, F.h + 0.06, 0.03, rx=-0.3)


def p_bench(b, P, s, F):
    """Slatted wood bench on steel legs."""
    F.box(b, P["steel_dk"], 0.06, 0.42, F.d - 0.1, -F.w / 2 + 0.2, 0, 0)
    F.box(b, P["steel_dk"], 0.06, 0.42, F.d - 0.1, F.w / 2 - 0.2, 0, 0)
    for k in range(5):
        lz = -F.d / 2 + 0.06 + k * (F.d - 0.12) / 4
        F.box(b, P["wood"], F.w, 0.04, 0.09, 0, F.h - 0.05, lz)


PROPS = {
    "case": p_case, "backcase": p_backcase, "hoststand": p_hoststand, "booth": p_booth, "booths": p_booths,
    "pass": p_pass, "ptable": p_ptable, "genius": p_genius, "bar": p_bar, "shelf": p_shelf,
    "makeupwall": p_makeupwall, "gondola": p_gondola, "makeupgondola": p_makeupgondola, "demo": p_demo,
    "testerbar": p_testerbar, "shoewall": p_shoewall, "jerseywall": p_jerseywall, "tshirts": p_tshirts,
    "shoeplinth": p_shoeplinth, "roundrack": p_roundrack, "table4": p_table4, "cafetable": p_table4,
    "dessert": p_dessert, "coffeebar": p_dessert, "bin": p_bin, "plushbin": p_bin, "statue": p_statue,
    "stuffer": p_stuffer, "brickwall": p_brickwall, "plushwall": p_brickwall, "tshirtwall": p_tshirtwall,
    "yogawall": p_tshirtwall, "counter": p_counter, "bench": p_bench,
}


# ================================================================== atrium

def p_zamboni(b, P, s, F):
    """The Trollboni: an ice resurfacer, long axis local z (f turns it)."""
    # local: x across (1.9), z along (3.8), front at +z
    W, L = F.w, F.d
    F.box(b, P["white"], W, 0.75, L - 0.3, 0, 0.35, -0.1, bevel=0.04)                 # lower body
    F.box(b, P["blue"], W + 0.02, 0.18, L - 0.28, 0, 0.6, -0.1)                         # stripe
    F.box(b, P["white"], W - 0.1, 0.85, 1.4, 0, 1.1, -0.9, bevel=0.06)                  # snow tank
    F.box(b, P["blue"], W - 0.08, 0.1, 1.42, 0, 1.6, -0.9)
    F.box(b, P["white"], W - 0.2, 0.5, 1.1, 0, 0.95, 0.85, bevel=0.05)                  # engine hood
    F.box(b, P["black"], 0.55, 0.12, 0.5, 0, 1.1, 0.25)                                 # seat
    F.box(b, P["black"], 0.55, 0.55, 0.1, 0, 1.15, 0.0)
    F.cyl(b, P["black"], 0.2, (0.0, 1.55, 0.55), (0.0, 1.6, 0.68), seg=12)               # wheel
    F.cyl(b, P["steel_dk"], 0.025, (0.0, 1.05, 0.75), (0.0, 1.55, 0.6), seg=6)
    for lx in (-W / 2 + 0.05, W / 2 - 0.05):                                            # roll bar
        F.box(b, P["black"], 0.06, 1.2, 0.06, lx, 1.05, -0.05)
    F.box(b, P["black"], W - 0.04, 0.06, 0.06, 0, 2.25, -0.05)
    F.box(b, P["steel"], W + 0.1, 0.25, 0.45, 0, 0.1, -L / 2 + 0.25)                    # conditioner
    F.box(b, P["blue"], W + 0.12, 0.08, 0.47, 0, 0.35, -L / 2 + 0.25)
    for lz in (-0.75, 0.95):
        for lx in (-W / 2 + 0.05, W / 2 - 0.05):
            F.cyl(b, P["rubber"], 0.3, (lx - math.copysign(0.12, lx), 0.3, lz), (lx + math.copysign(0.1, lx), 0.3, lz), seg=14)
            F.cyl(b, P["steel"], 0.16, (lx + math.copysign(0.1, lx), 0.3, lz), (lx + math.copysign(0.11, lx), 0.3, lz), seg=10)
    F.box(b, P["headlight"], 0.2, 0.1, 0.03, -0.5, 0.9, L / 2 - 0.12)
    F.box(b, P["headlight"], 0.2, 0.1, 0.03, 0.5, 0.9, L / 2 - 0.12)
    F.cyl(b, P["orange"], 0.07, (0.6, 2.28, -0.05), (0.6, 2.4, -0.05), seg=8)            # beacon


def p_goal(b, P, s, F):
    """Hockey net: red pipe frame, white mesh lines. Mouth at local +z."""
    W, D, H = F.w, F.d, 1.2
    W = max(F.w, F.d)
    D = min(F.w, F.d)
    G = Frame({**s, "f": (s.get("f", 0) or 0) + (math.pi / 2 if F.w < F.d else 0)})
    for lx in (-W / 2 + 0.03, W / 2 - 0.03):
        G.cyl(b, P["red"], 0.03, (lx, 0, D / 2), (lx, H, D / 2), seg=8)
    G.cyl(b, P["red"], 0.03, (-W / 2, H, D / 2), (W / 2, H, D / 2), seg=8)
    G.cyl(b, P["red"], 0.025, (-W / 2, 0.02, -D / 2), (W / 2, 0.02, -D / 2), seg=6)
    for lx in (-W / 2 + 0.03, W / 2 - 0.03):
        G.cyl(b, P["red"], 0.025, (lx, 0.02, D / 2), (lx, 0.02, -D / 2), seg=6)
        G.cyl(b, P["white"], 0.012, (lx, H, D / 2), (lx * 0.8, 0.02, -D / 2), seg=4)
    for k in range(9):
        lx = -W / 2 + k * W / 8
        G.cyl(b, P["white"], 0.008, (lx, H, D / 2), (lx * 0.85, 0.02, -D / 2), seg=3)
    for k in range(5):
        t = k / 4
        G.cyl(b, P["white"], 0.008, (-W / 2, H * (1 - t), D / 2 - t * D), (W / 2, H * (1 - t), D / 2 - t * D), seg=3)


def p_planter(b, P, s, F):
    palm_tree = s.get("y", 0) < 1 and region(s) == "atrium" and abs(s["x"]) > 15 and abs(s["z"]) < 9
    planter_box(b, P, s, palm_tree=palm_tree, seed=int(abs(s["x"] * 10 + s["z"])))


def p_kiosk(b, P, s, F):
    """Concourse cart: counter, a canopy on four posts, goods by kind."""
    k = next((q for q in D["KIOSKS"] if abs(q["x"] - s["x"]) < 0.01 and abs(q["z"] - s["z"]) < 0.01), {})
    col = pm(hexrgb(k.get("bg", "#333333")), 0.5)
    F.box(b, P["wood_dk"], F.w, 0.95, F.d, 0, 0.1, 0)
    F.box(b, col, F.w + 0.02, 0.25, F.d + 0.02, 0, 0.6, 0)
    F.box(b, P["cream"], F.w + 0.1, 0.05, F.d + 0.1, 0, 1.05, 0)
    F.box(b, P["black"], F.w - 0.2, 0.1, F.d - 0.2, 0, 0, 0)
    for lx in (-F.w / 2 + 0.08, F.w / 2 - 0.08):
        for lz in (-F.d / 2 + 0.08, F.d / 2 - 0.08):
            F.cyl(b, P["bronze"], 0.03, (lx, 1.1, lz), (lx, 2.35, lz), seg=6)
    F.box(b, col, F.w + 0.4, 0.12, F.d + 0.4, 0, 2.35, 0)
    F.box(b, P["bronze"], F.w + 0.44, 0.04, F.d + 0.44, 0, 2.47, 0)
    F.box(b, P["lamp"], F.w, 0.02, F.d, 0, 2.33, 0)
    kind = k.get("kind")
    rnd = random.Random(int(abs(s["x"] * 17)))
    if kind == "food":
        F.box(b, P["glassdk"], F.w - 0.4, 0.5, F.d - 0.5, 0, 1.1, 0)
        for i in range(8):
            lx = -F.w / 2 + 0.45 + i * (F.w - 0.9) / 7
            F.cyl(b, pm(0xb5651d, 0.6), 0.09, (lx, 1.15, 0.05), (lx, 1.15, -0.05), seg=10)          # pretzels
            F.cyl(b, pm(0xb5651d, 0.6), 0.09, (lx, 1.38, 0.05), (lx, 1.38, -0.05), seg=10)
    elif kind == "phone":
        for i in range(10):
            for j in range(3):
                lx = -F.w / 2 + 0.3 + i * (F.w - 0.6) / 9
                F.box(b, rnd.choice([P["red"], P["blue"], P["pink"], P["black"], P["teal"], P["yellow"]]), 0.08, 0.15, 0.01, lx, 1.2 + j * 0.25, 0, rx=0.1)
        F.box(b, P["white"], F.w - 0.3, 0.75, 0.03, 0, 1.15, -0.02)
    elif kind == "shades":
        F.box(b, P["mirror"], 0.5, 0.7, 0.03, 0, 1.1, 0)
        for i in range(12):
            for j in range(3):
                lx = -F.w / 2 + 0.25 + i * (F.w - 0.5) / 11
                F.box(b, P["black"], 0.15, 0.05, 0.02, lx, 1.2 + j * 0.3, F.d / 2 - 0.1)
    elif kind == "candy":
        for i in range(6):
            lx = -F.w / 2 + 0.35 + i * (F.w - 0.7) / 5
            F.cyl(b, P["glassdk"], 0.15, (lx, 1.1, 0), (lx, 1.55, 0), seg=10)
            F.cyl(b, rnd.choice([P["pink"], P["red"], P["yellow"], P["teal"], P["purple"]]), 0.13, (lx, 1.1, 0), (lx, 1.4, 0), seg=10)


def p_massage(b, P, s, F):
    """Two massage chairs, a little sales podium between."""
    for lx in (-0.65, 0.65):
        F.box(b, P["leather_bk"], 0.8, 0.5, 0.9, lx, 0, 0)
        F.box(b, P["leather_bk"], 0.8, 0.85, 0.3, lx, 0.45, -0.32, rx=-0.25)
        F.box(b, P["black"], 0.2, 0.25, 0.75, lx - 0.35, 0.5, 0.05)
        F.box(b, P["black"], 0.2, 0.25, 0.75, lx + 0.35, 0.5, 0.05)
        F.box(b, P["leather_bk"], 0.6, 0.3, 0.4, lx, 0.0, 0.55, rx=0.6)
    F.box(b, P["steel_dk"], 0.25, 1.1, 0.25, 0, 0, 0.2)
    F.box(b, P["screen"], 0.22, 0.3, 0.02, 0, 0.8, 0.33, rx=-0.3)


def p_infodesk(b, P, s, F):
    """Guest services: a curved-front desk with a big 'i'."""
    F.box(b, P["wood_dk"], F.w, F.h, F.d, 0, 0, 0)
    F.box(b, P["limestone"], F.w + 0.1, 0.06, F.d + 0.1, 0, F.h, 0)
    F.box(b, P["bronze"], F.w + 0.02, 0.08, F.d + 0.02, 0, 0.1, 0)
    F.box(b, P["black"], 0.4, 0.3, 0.04, -0.6, F.h + 0.06, 0.1, rx=-0.3)
    F.box(b, P["screen"], 0.36, 0.26, 0.01, -0.6, F.h + 0.08, 0.12, rx=-0.3)
    F.cyl(b, P["bronze"], 0.03, (0, 0, 0), (0, 3.6, 0), seg=8)
    F.box(b, P["navy"], 0.9, 0.9, 0.08, 0, 2.9, 0)
    F.box(b, P["white"], 0.12, 0.42, 0.1, 0, 3.0, 0)
    F.box(b, P["white"], 0.12, 0.1, 0.1, 0, 3.52, 0)


def p_photobooth(b, P, s, F):
    F.box(b, P["red"], F.w, F.h, F.d - 0.3, 0, 0, -0.15)
    F.box(b, P["black"], F.w - 0.4, 1.7, 0.05, 0, 0.1, F.d / 2 - 0.32)
    F.box(b, P["neon_pink"], F.w + 0.02, 0.06, F.d - 0.28, 0, F.h - 0.25, -0.15)
    F.box(b, P["white"], 0.5, 0.18, 0.04, F.w / 2 - 0.35, 1.0, F.d / 2 - 0.3)


def p_kiddieride(b, P, s, F):
    """Coin-op ride: a little red car with a grinning face on its nose."""
    F.box(b, P["yellow"], F.w, 0.25, F.d, 0, 0, 0)
    F.box(b, P["red"], F.w - 0.2, 0.55, F.d - 0.4, 0, 0.25, 0, bevel=0.08)
    F.box(b, P["red"], F.w - 0.3, 0.3, 0.6, 0, 0.75, -0.25, bevel=0.06)
    F.box(b, P["white"], 0.6, 0.05, 0.02, 0, 0.5, F.d / 2 - 0.2)
    for lx in (-0.2, 0.2):
        F.box(b, P["black"], 0.08, 0.08, 0.02, lx, 0.62, F.d / 2 - 0.2)
    F.cyl(b, P["black"], 0.12, (0, 0.9, 0.15), (0, 0.92, 0.3), seg=10)
    F.box(b, P["steel_dk"], 0.25, 1.0, 0.2, 0, 0.25, -F.d / 2 + 0.1)
    F.box(b, P["screen"], 0.15, 0.1, 0.02, 0, 1.0, -F.d / 2 + 0.21)


def p_lounge(b, P, s, F):
    """Leather lounge sofa on the end decks."""
    F.box(b, P["leather"], F.w, 0.42, F.d, 0, 0, 0.05)
    F.box(b, P["leather"], F.w, 0.45, 0.25, 0, 0.4, -F.d / 2 + 0.12)
    for lx in (-F.w / 2 + 0.12, F.w / 2 - 0.12):
        F.box(b, P["leather"], 0.24, 0.25, F.d, lx, 0.4, 0.05)
    F.box(b, P["wood_dk"], F.w - 0.1, 0.06, F.d, 0, 0, 0.05)


def p_boxes(b, P, s, F):
    rnd = random.Random(int(abs(s["x"] * 7)))
    for i in range(3):
        for j in range(2):
            w = rnd.uniform(0.45, 0.6)
            F.box(b, P["cardboard"], w, 0.42, F.d * 0.9, -F.w / 2 + 0.35 + i * 0.4, j * 0.45, 0, ry=rnd.uniform(-0.1, 0.1))
            F.box(b, P["tape"], 0.08, 0.005, F.d * 0.9, -F.w / 2 + 0.35 + i * 0.4, j * 0.45 + 0.42, 0)
    F.box(b, P["wrap"], 0.6, 0.4, 0.6, 0, 0.9, 0)


def p_cart(b, P, s, F):
    """Stock cart: two shelves, grab bar, wheels, a few boxes."""
    for y in (0.15, 0.75):
        F.box(b, P["steel"], F.w, 0.04, F.d, 0, y, 0)
    for lx in (-F.w / 2 + 0.03, F.w / 2 - 0.03):
        for lz in (-F.d / 2 + 0.03, F.d / 2 - 0.03):
            F.box(b, P["steel"], 0.03, 0.8, 0.03, lx, 0.1, lz)
            F.cyl(b, P["rubber"], 0.06, (lx, 0.06, lz - 0.03), (lx, 0.06, lz + 0.03), seg=8)
    F.cyl(b, P["steel"], 0.015, (-F.w / 2, 1.05, -F.d / 2 + 0.05), (-F.w / 2, 1.05, F.d / 2 - 0.05), seg=6)
    F.box(b, P["cardboard"], 0.5, 0.35, 0.5, -0.3, 0.79, 0)
    F.box(b, P["cardboard"], 0.4, 0.3, 0.4, 0.3, 0.19, 0)


def escalator(b, P, e):
    """Escalator over its stepped collider: truss sides, treads, comb
    plates, black handrails on stainless decking (glass is grinleria.js)."""
    n, rise, run, w = e["steps"], e["rise"], e["run"], e["width"]
    sgn = e["dir"]
    x0, z = e["x0"], e["z"]
    x1 = x0 + sgn * run * n
    top = rise * n
    half = w / 2
    # side trusses, clad to the floor (the collider is solid below)
    for side in (-1, 1):
        zz = z + side * (half - 0.08)
        prof = [(x0, 0.0), (x1, 0.0), (x1, top + 0.2), (x0 + sgn * 0.0, 0.3)]
        # as a prism along z: profile (x, y)
        b.prism(P["steel_dk"], [(px, py) for px, py in prof], zz - 0.08, zz + 0.08, axis="z")
        # stainless deck cap that carries the glass, and the handrail
        b.bar(P["steel"], (x0 - sgn * 0.6, 0.12, zz), (x0, 0.3 + 0.05, zz), 0.18, 0.12)
        b.bar(P["steel"], (x0, 0.35, zz), (x1, top + 0.2, zz), 0.18, 0.12)
        b.bar(P["steel"], (x1, top + 0.2, zz), (x1 + sgn * 0.5, top + 0.08, zz), 0.18, 0.12)
        hr = 1.0
        b.cyl(P["rubber"], 0.045, (x0 - sgn * 0.9, 0.95, zz), (x0, 0.3 + hr, zz), seg=8)
        b.cyl(P["rubber"], 0.045, (x0, 0.3 + hr, zz), (x1, top + hr, zz), seg=8)
        b.cyl(P["rubber"], 0.045, (x1, top + hr, zz), (x1 + sgn * 0.8, top + hr - 0.05, zz), seg=8)
        b.cyl(P["rubber"], 0.12, (x0 - sgn * 0.9, 0.55, zz - 0.05), (x0 - sgn * 0.9, 0.55, zz + 0.05), seg=14)
        b.cyl(P["rubber"], 0.12, (x1 + sgn * 0.8, top + hr - 0.42, zz - 0.05), (x1 + sgn * 0.8, top + hr - 0.42, zz + 0.05), seg=14)
    # treads with yellow nosings, comb plates top and bottom
    for i in range(n):
        xc = x0 + sgn * run * (i + 0.5)
        yt = rise * (i + 1)
        b.box(P["steel_dk"], run, 0.04, w - 0.32, xc, yt - 0.04, z)
        b.box(P["kick"], 0.05, 0.012, w - 0.32, x0 + sgn * (run * i + 0.03), yt, z)
        b.box(P["black"], 0.02, rise, w - 0.32, x0 + sgn * run * i, yt - rise, z)
    b.box(P["steel"], 0.7, 0.02, w - 0.2, x0 - sgn * 0.35, 0.0, z)
    b.box(P["kick"], 0.05, 0.022, w - 0.3, x0 - sgn * 0.03, 0.0, z)
    b.box(P["steel"], 0.7, 0.02, w - 0.2, x1 + sgn * 0.35, top, z)
    # the underside you see from the floor: a clad soffit
    b.box(P["steel"], 0.02, top, w, x1 - sgn * 0.01, 0, z)


def board_run(b, P, s):
    """Dasher boards: white boards, yellow kick strip, a capped top."""
    sbox(b, P["board"], s)
    along_x = s["w"] > s["d"]
    w, d = (s["w"], s["d"] + 0.02) if along_x else (s["w"] + 0.02, s["d"])
    b.box(P["kick"], w, 0.18, d, s["x"], 0.02, s["z"])
    b.box(P["black"], w if along_x else s["w"] + 0.08, 0.05, s["d"] + 0.08 if along_x else d, s["x"], s["h"], s["z"])
    # stanchions for the glass (glass: grinleria.js)
    n = max(1, int((s["w"] if along_x else s["d"]) / 1.8))
    L = s["w"] if along_x else s["d"]
    for i in range(n + 1):
        t = -L / 2 + L * i / n
        x, z = (s["x"] + t, s["z"]) if along_x else (s["x"], s["z"] + t)
        b.box(P["steel"], 0.05, 0.9, 0.05, x, s["h"], z)


def balustrade(b, P, s):
    """The glass balustrade's steel: a top rail and a base shoe."""
    along_x = s["w"] > s["d"]
    L = s["w"] if along_x else s["d"]
    a = (s["x"] - L / 2, s["z"]) if along_x else (s["x"], s["z"] - L / 2)
    c = (s["x"] + L / 2, s["z"]) if along_x else (s["x"], s["z"] + L / 2)
    y = s["y"]
    b.cyl(P["steel"], 0.035, (a[0], y + s["h"], a[1]), (c[0], y + s["h"], c[1]), seg=10)
    b.box(P["bronze_dk"], s["w"] + (0.06 if not along_x else 0), 0.1, s["d"] + (0.06 if along_x else 0), s["x"], y, s["z"])


def build_atrium(P):
    b = Builder()
    for s in kinds("_board"):
        board_run(b, P, s)
    for s in kinds("_rail"):
        balustrade(b, P, s)
    for e in D["escalators"]:
        escalator(b, P, e)
    # rubber matting round the rink, skate-safe
    R = GL["rink"]
    for z0, z1 in ((R["z0"] - 1.4, R["z0"] - 0.1), (R["z1"] + 0.1, R["z1"] + 1.4)):
        b.box(P["rubber"], R["x1"] - R["x0"] + 2.6, 0.01, z1 - z0, 0, 0.0, (z0 + z1) / 2)
    for x0, x1 in ((R["x0"] - 1.4, R["x0"] - 0.1), (R["x1"] + 0.1, R["x1"] + 1.4)):
        b.box(P["rubber"], x1 - x0, 0.01, R["z1"] - R["z0"] - 0.2, (x0 + x1) / 2, 0.0, 0)
    draw_props(b, P, "atrium")
    b.finish("gl-atrium.glb")


PROPS.update({
    "zamboni": p_zamboni, "goal": p_goal, "planter": p_planter, "kiosk": p_kiosk, "massage": p_massage,
    "infodesk": p_infodesk, "photobooth": p_photobooth, "kiddieride": p_kiddieride, "lounge": p_lounge,
    "boxes": p_boxes, "cart": p_cart,
})


# ================================================================== wings

def p_beauty(b, P, s, F):
    """Neiman Narcus cosmetics: four glass counters round a mirrored,
    lit pillar."""
    W = F.w
    for k in range(4):
        a = k * math.pi / 2
        G = Frame({**s, "f": a})
        G.box(b, P["white"], W - 0.2, 0.85, 0.7, 0, 0, W / 2 - 0.35)
        G.box(b, P["black"], W - 0.2, 0.1, 0.72, 0, 0, W / 2 - 0.35)
        G.box(b, P["glassdk"], W - 0.3, 0.18, 0.6, 0, 0.85, W / 2 - 0.35)
        G.box(b, P["lamp"], W - 0.4, 0.01, 0.5, 0, 0.86, W / 2 - 0.35)
        for i in range(8):
            lx = -W / 2 + 0.45 + i * (W - 0.9) / 7
            G.cyl(b, [P["pink"], P["cream"], P["red"], P["black"]][i % 4], 0.03, (lx, 1.03, W / 2 - 0.35), (lx, 1.13, W / 2 - 0.35), seg=6)
        G.box(b, P["mirror"], 0.4, 0.5, 0.04, W / 2 - 0.6, 1.03, W / 2 - 0.55, rx=-0.15)
    # the pillar: mirror panels, a light ring, a crown
    F.box(b, P["mirror"], 0.9, 3.4, 0.9, 0, 0, 0)
    for y in (1.2, 2.4):
        F.box(b, P["lamp"], 0.94, 0.04, 0.94, 0, y, 0)
    F.box(b, P["bronze"], 1.1, 0.25, 1.1, 0, 3.4, 0)
    F.box(b, P["white"], 1.6, 0.6, 1.6, 0, 3.65, 0)


def p_mannequins(b, P, s, F):
    """Runway platform: white, lit edge; the dummies stand on its anchors."""
    F.box(b, P["white"], F.w, F.h, F.d, 0, 0, 0)
    F.box(b, P["lamp"], F.w + 0.02, 0.03, F.d + 0.02, 0, F.h - 0.08, 0)
    looks = [pm(0x1a1a1a, 0.8), pm(0x8a1c2b, 0.8), pm(0xd8c7a8, 0.8)]
    for i, q in enumerate([m for m in SOLIDS if m["k"] == "_mannequin" and abs(m["x"] - s["x"]) < 0.3 and abs(m["z"] - s["z"]) < 2.2]):
        mannequin(b, P, q["x"], q["y"], q["z"], face=-math.pi / 2 if s["x"] < 0 else math.pi / 2, outfit=looks[i % 3], seed=i)


def p_displaytable(b, P, s, F):
    """Handbags on a walnut table."""
    F.box(b, P["wood_dk"], F.w, 0.06, F.d, 0, F.h - 0.06, 0)
    for lx in (-F.w / 2 + 0.15, F.w / 2 - 0.15):
        F.box(b, P["bronze"], 0.06, F.h - 0.06, F.d - 0.2, lx, 0, 0)
    for i, c in enumerate((0x6b1f2a, 0x1a1a1a, 0xc8a96a, 0x2f4f6f)):
        lx = -F.w / 2 + 0.35 + i * (F.w - 0.7) / 3
        F.box(b, pm(c, 0.45), 0.36, 0.26, 0.14, lx, F.h, 0)
        F.bar(b, P["bronze"], (lx - 0.1, F.h + 0.36, 0), (lx + 0.1, F.h + 0.36, 0), 0.02)


def p_cashwrap(b, P, s, F):
    F.box(b, P["wood_dk"], F.w, F.h, F.d, 0, 0, 0)
    F.box(b, P["limestone"], F.w + 0.06, 0.05, F.d + 0.06, 0, F.h, 0)
    for lx in (-0.7, 0.7):
        F.box(b, P["black"], 0.35, 0.28, 0.04, lx, F.h + 0.05, 0.1, rx=-0.3)
        F.box(b, P["screen"], 0.31, 0.24, 0.01, lx, F.h + 0.07, 0.12, rx=-0.3)
    F.box(b, P["white"], 0.5, 0.35, 0.3, 0, F.h + 0.05, -0.2)                         # gift box stack
    F.box(b, P["black"], 0.52, 0.04, 0.32, 0, F.h + 0.4, -0.2)


def p_fitting(b, P, s, F):
    """The fitting rooms: cubicle curtains, mirrors, a 'FITTING ROOMS' lamp."""
    row = s["row"]
    for w in [q for q in SOLIDS if q["k"] == "_fitting" and q["row"] == row]:
        sbox(b, P["cream"], w)
        b.box(P["wood_dk"], w["w"] + 0.02, 0.08, w["d"] + 0.02, w["x"], w["h"], w["z"])
    for x0, x1 in ((-35.4, -32.3), (-38.4, -35.4), (-40.4, -38.4)):
        zc = row * 27.45
        b.box(P["fabric"], x1 - x0 - 0.2, 2.1, 0.04, (x0 + x1) / 2, 0.2, zc)        # curtain, drawn open a bit
        b.cyl(P["chrome"], 0.015, (x0, 2.35, zc), (x1, 2.35, zc), seg=6)
        b.box(P["mirror"], 0.9, 1.7, 0.03, (x0 + x1) / 2, 0.3, row * (BZ - 0.03))
        b.box(P["wood_dk"], 0.9, 0.06, 0.35, (x0 + x1) / 2, 0.45, row * (BZ - 0.2))   # bench
    b.box(P["lamp"], 1.8, 0.3, 0.05, -37.8, 2.65, row * 25.55)


def p_ottoman(b, P, s, F):
    F.cyl(b, P["leather"], F.w / 2, (0, 0.05, 0), (0, F.h, 0), seg=16)
    F.cyl(b, P["bronze"], F.w / 2 - 0.05, (0, 0, 0), (0, 0.05, 0), seg=16)


def p_fountain(b, P, s, F):
    """The basin of Trollface Falls: octagonal limestone with a bronze lip
    and water (the grotto and the carved head are build_falls)."""
    cx, cz = s["x"], s["z"]
    R_out = 3.5 / math.cos(math.pi / 8)       # octagon over the 7 m collider
    R_in = R_out - 0.35
    for k in range(8):
        a0 = math.pi / 8 + k * math.pi / 4
        a1 = a0 + math.pi / 4
        quad_o = [(cx + R_out * math.cos(a0), cz + R_out * math.sin(a0)), (cx + R_out * math.cos(a1), cz + R_out * math.sin(a1))]
        quad_i = [(cx + R_in * math.cos(a0), cz + R_in * math.sin(a0)), (cx + R_in * math.cos(a1), cz + R_in * math.sin(a1))]
        (ox0, oz0), (ox1, oz1) = quad_o
        (ix0, iz0), (ix1, iz1) = quad_i
        h = s["h"]
        pts = [(ox0, 0, oz0), (ox1, 0, oz1), (ix1, 0, iz1), (ix0, 0, iz0),
               (ox0, h, oz0), (ox1, h, oz1), (ix1, h, iz1), (ix0, h, iz0)]
        b.poly(P["limestone"], pts, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]])
        lip = [(ox0, h, oz0), (ox1, h, oz1), (ix1, h, iz1), (ix0, h, iz0),
               (ox0, h + 0.05, oz0), (ox1, h + 0.05, oz1), (ix1, h + 0.05, iz1), (ix0, h + 0.05, iz0)]
        b.poly(P["bronze"], lip, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]])
    # the water and the basin floor
    oct_pts = [(cx + R_in * math.cos(math.pi / 8 + k * math.pi / 4), 0.42, cz + R_in * math.sin(math.pi / 8 + k * math.pi / 4)) for k in range(8)]
    b.poly(P["water"], oct_pts + [(cx, 0.42, cz)], [[8, k, (k + 1) % 8] for k in range(8)])
    floor_pts = [(x, 0.02, z) for (x, _, z) in oct_pts]
    b.poly(P["navy"], floor_pts + [(cx, 0.02, cz)], [[8, k, (k + 1) % 8] for k in range(8)])


def p_stall(b, P, s, F):
    """Food court stall: branded counter, steel top, kitchen behind, menu
    lightbox and soffit (the menu text is grinleria.js)."""
    st = next((q for q in D["STALLS"] if q["name"] == s.get("name")), None)
    col = pm(hexrgb(st["bg"]) if st else 0x444444, 0.45)
    row = -1 if s["z"] < 0 else 1
    x0, x1 = st["x0"], st["x1"]
    W = x1 - x0
    # counter
    F.box(b, col, F.w, F.h - 0.05, F.d, 0, 0, 0)
    F.box(b, P["steel"], F.w + 0.06, 0.05, F.d + 0.2, 0, F.h - 0.05, 0.05)
    F.box(b, P["black"], F.w, 0.12, F.d, 0, 0, 0)
    if st and st.get("stripes"):
        for k in range(3):
            F.box(b, P["white"], F.w + 0.01, 0.06, F.d + 0.01, 0, 0.3 + k * 0.18, 0)
    for lx in (-F.w / 2 + 0.6, 0.3):
        F.box(b, P["black"], 0.35, 0.25, 0.3, lx, F.h, -0.05)                     # registers
        F.box(b, P["screen"], 0.3, 0.2, 0.01, lx, F.h + 0.03, 0.11, rx=-0.3)
    F.box(b, P["chrome"], 0.6, 0.35, 0.35, F.w / 2 - 0.6, F.h, -0.1)              # drinks
    # kitchen: tiled back wall, steel worktop, fryers / grills, a hood
    zb = row * (BZ - 0.02)
    b.box(P["white"], W - 0.25, 2.6, 0.02, (x0 + x1) / 2, 0, zb)
    b.box(col, W - 0.25, 0.3, 0.025, (x0 + x1) / 2, 2.0, zb - row * 0.01)
    for kq in [q for q in SOLIDS if q["k"] == "_kitchen" and abs(q["x"] - s["x"]) < 0.01 and q["z"] * s["z"] > 0]:
        sbox(b, P["steel"], kq)
        for i in range(3):
            x = kq["x"] - kq["w"] / 2 + 0.7 + i * (kq["w"] - 1.4) / 2
            b.box(P["black"], 0.9, 0.04, 0.6, x, kq["h"], kq["z"])
            b.box(P["steel_dk"], 0.5, 0.15, 0.4, x, kq["h"] + 0.04, kq["z"])
        b.box(P["steel"], kq["w"], 0.5, 1.2, kq["x"], 2.6, row * (BZ - 0.6))
        b.box(P["lamp"], kq["w"] - 0.3, 0.02, 0.8, kq["x"], 2.58, row * (BZ - 0.6))
    # soffit + menu lightbox frame over the counter
    b.box(col, W, 1.2, 4.4, (x0 + x1) / 2, 3.6, row * (BZ - 2.2))
    b.box(P["black"], W - 0.6, 1.0, 0.08, (x0 + x1) / 2, 2.55, row * 28.05)
    b.box(P["lamp"], W - 0.2, 0.03, 0.08, (x0 + x1) / 2, 3.58, row * 27.9)


def p_stallwall(b, P, s, F):
    sbox(b, P["wall"], s)


def p_fctable(b, P, s, F):
    """Food court table for four, molded chairs."""
    F.cyl(b, P["steel_dk"], 0.05, (0, 0, 0), (0, 0.72, 0), seg=8)
    F.box(b, P["steel_dk"], 0.6, 0.03, 0.08, 0, 0, 0)
    F.box(b, P["steel_dk"], 0.08, 0.03, 0.6, 0, 0, 0)
    F.box(b, P["white"], F.w, 0.04, F.d, 0, 0.72, 0)
    rnd = random.Random(int(abs(s["x"] * 3 + s["z"] * 11)))
    seat = rnd.choice([P["orange"], P["teal"], P["yellow"], P["red"]])
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4 * 0
        chair(b, P, F, math.sin(a) * 0.85, math.cos(a) * 0.85, a + math.pi, seat=seat, frame=P["steel"])
    if rnd.random() < 0.6:
        F.box(b, P["red"], 0.35, 0.02, 0.28, rnd.uniform(-0.2, 0.2), 0.76, rnd.uniform(-0.2, 0.2))   # a tray
        F.cyl(b, P["white"], 0.04, (0.1, 0.78, 0.05), (0.1, 0.94, 0.05), seg=8)


def p_hightop(b, P, s, F):
    F.cyl(b, P["black"], 0.04, (0, 0, 0), (0, F.h - 0.04, 0), seg=8)
    F.cyl(b, P["black"], 0.28, (0, 0, 0), (0, 0.03, 0), seg=12)
    F.cyl(b, P["wood"], F.w / 2, (0, F.h - 0.04, 0), (0, F.h, 0), seg=16)
    for k in range(3):
        a = k * 2 * math.pi / 3
        x, z = math.cos(a) * 0.7, math.sin(a) * 0.7
        F.cyl(b, P["black"], 0.025, (x, 0, z), (x, 0.75, z), seg=6)
        F.cyl(b, P["wood_dk"], 0.2, (x, 0.75, z), (x, 0.8, z), seg=12)
        F.cyl(b, P["chrome"], 0.15, (x, 0.3, z), (x, 0.32, z), seg=10)


def build_wings(P):
    b = Builder()
    draw_props(b, P, "wings")
    # department signage hangers over the store floor
    for z in (-10, 10):
        b.box(P["bronze_dk"], 0.06, 1.4, 6, -44, ROOF - 1.6, z)
        b.cyl(P["black"], 0.008, (-44, ROOF - 0.2, z - 2.5), (-44, ROOF, z - 2.5), seg=4)
        b.cyl(P["black"], 0.008, (-44, ROOF - 0.2, z + 2.5), (-44, ROOF, z + 2.5), seg=4)
    b.finish("gl-wings.glb")


PROPS.update({
    "beauty": p_beauty, "mannequins": p_mannequins, "displaytable": p_displaytable, "cashwrap": p_cashwrap,
    "fitting": p_fitting, "ottoman": p_ottoman, "fountain": p_fountain, "stall": p_stall,
    "_stallwall": p_stallwall, "fctable": p_fctable, "hightop": p_hightop,
})


# ================================================================== outside

def p_car(b, P, s, F):
    rnd = random.Random(int(abs(s["x"] * 13 + s["z"])))
    paint = rnd.choice([P["car_red"], P["car_blue"], P["car_silver"], P["black"], P["white"], P["navy"]])
    # the kit's sedan fills a 4 x 2 box nose on +x; our frame's local z is
    # the long axis here (f = pi/2 turns it along x)
    sedan(b, P, paint, x=s["x"], z=s["z"], ry=(s.get("f", 0) or 0) - math.pi / 2)


def p_palmplanter(b, P, s, F):
    F.cyl(b, P["limestone"], F.w / 2, (0, 0, 0), (0, F.h, 0), seg=16)
    F.cyl(b, P["bronze"], F.w / 2 + 0.03, (0, F.h - 0.05, 0), (0, F.h, 0), seg=16)
    F.cyl(b, P["soil"], F.w / 2 - 0.08, (0, F.h - 0.04, 0), (0, F.h - 0.02, 0), seg=16)
    palm(b, P, s["x"], s["z"], h=6.5, lean=(0.3, -0.2), seed=int(abs(s["x"] * 3)))


def p_barrier(b, P, s, F):
    """Garage: a concrete planter-bollard block with hazard stripes."""
    F.box(b, P["conc"], F.w, F.h, F.d, 0, 0, 0, bevel=0.05)
    for k in range(4):
        F.box(b, P["kick"] if k % 2 == 0 else P["black"], F.w + 0.01, 0.1, F.d + 0.01, 0, 0.1 + k * 0.12, 0)


def p_canopycol(b, P, s, F):
    """Valet porte-cochere column (round, limestone)."""
    F.cyl(b, P["limestone"], 0.22, (0, 0, 0), (0, F.h, 0), seg=14)
    F.cyl(b, P["bronze"], 0.26, (0, 0, 0), (0, 0.3, 0), seg=14)
    F.cyl(b, P["bronze"], 0.26, (0, F.h - 0.3, 0), (0, F.h - 0.15, 0), seg=14)


def p_garagecol(b, P, s, F):
    F.box(b, P["conc"], F.w + 0.1, GL["garageDeck"], F.d + 0.1, 0, 0, 0)
    F.box(b, P["kick"], F.w + 0.12, 0.9, F.d + 0.12, 0, 0, 0)
    for k in range(4):
        F.box(b, P["black"], F.w + 0.13, 0.1, F.d + 0.13, 0, 0.1 + k * 0.2, 0)


def p_valet(b, P, s, F):
    """Valet podium with a key box and an umbrella."""
    F.box(b, P["wood_dk"], F.w, F.h, F.d, 0, 0, 0)
    F.box(b, P["bronze"], F.w + 0.06, 0.04, F.d + 0.06, 0, F.h, 0)
    F.box(b, P["black"], F.w * 0.7, 0.4, 0.06, 0, F.h * 0.3, F.d / 2 + 0.01)
    F.cyl(b, P["bronze"], 0.025, (0.8, 0, 0), (0.8, 2.3, 0), seg=6)
    F.cyl(b, P["navy"], 1.1, (0.8, 2.05, 0), (0.8, 2.4, 0), seg=10, r2=0.05)


def p_paystation(b, P, s, F):
    F.box(b, P["steel_dk"], F.w, F.h, F.d, 0, 0, 0)
    F.box(b, P["kick"], F.w + 0.02, 0.2, F.d + 0.02, 0, F.h, 0)
    F.box(b, P["screen"], 0.3, 0.22, 0.02, 0, 0.95, F.d / 2 + 0.01)
    F.box(b, P["black"], 0.2, 0.06, 0.03, 0, 0.7, F.d / 2 + 0.01)


def p_monument(b, P, s, F):
    """THE GRINLERIA monument sign: stone plinth, a bronze panel (lettering
    is grinleria.js), planting at its foot."""
    F.box(b, P["limestone"], F.w, 0.5, F.d, 0, 0, 0)
    F.box(b, P["bronze_dk"], F.w - 0.3, F.h - 0.5, F.d - 0.3, 0, 0.5, 0)
    F.box(b, P["limestone"], F.w, 0.15, F.d, 0, F.h, 0)
    F.box(b, P["lamp"], F.w - 0.2, 0.03, 0.05, 0, 0.5, F.d / 2 + 0.02)


def p_garagesign(b, P, s, F):
    """Garage level wall: painted concrete with 'LEVEL P1' (text: grinleria.js)."""
    F.box(b, P["conc"], F.w, F.h, F.d, 0, 0, 0)
    F.box(b, P["blue"], F.w + 0.01, 0.9, F.d + 0.01, 0, 1.0, 0)
    F.box(b, P["kick"], F.w + 0.01, 0.15, F.d + 0.01, 0, 0.1, 0)


def streetlamp_pole(b, P, x, z, face):
    b.cyl(P["black"], 0.08, (x, 0, z), (x, 6.0, z), seg=8)
    b.cyl(P["black"], 0.04, (x, 6.0, z), (x + math.cos(face) * 1.2, 6.2, z + math.sin(face) * 1.2), seg=6)
    b.box(P["black"], 0.6, 0.15, 0.3, x + math.cos(face) * 1.4, 6.05, z + math.sin(face) * 1.4)
    b.box(P["lamp"], 0.5, 0.02, 0.24, x + math.cos(face) * 1.4, 6.03, z + math.sin(face) * 1.4)


def skyline(b, P):
    """Houston round the map: Uptown towers, and Williams Tower to the
    north-west with its beacon. All far outside the bounds (art only)."""
    rnd = random.Random(21)
    win = P["glassdk"]               # afternoon: dark glazing bands, not lit windows

    def tower(x, z, w, d, h, body, crown=None):
        b.box(body, w, h, d, x, -0.5, z)
        # lit window bands on the faces toward the map
        for y in range(4, int(h) - 2, 4):
            if rnd.random() < 0.55:
                b.box(win, w * rnd.uniform(0.3, 0.9), 0.6, d + 0.06, x, y, z)
        if crown:
            crown(x, z, w, d, h)

    # Williams Tower: a slim stepped glass shaft, a peaked crown, a beacon
    wx, wz = -95.0, -230.0
    for i, (w, h0, h1) in enumerate(((26, 0, 170), (22, 170, 205), (16, 205, 222))):
        b.box(P["tower_glass"], w, h1 - h0, w, wx, h0, wz)
        for k in (-1, 1):
            b.box(P["tower_frame"], 1.2, h1 - h0, w + 0.2, wx + k * w / 2, h0, wz)
            b.box(P["tower_frame"], w + 0.2, h1 - h0, 1.2, wx, h0, wz + k * w / 2)
    b.poly(P["tower_frame"], [(wx - 8, 222, wz - 8), (wx + 8, 222, wz - 8), (wx + 8, 222, wz + 8), (wx - 8, 222, wz + 8), (wx, 240, wz)],
           [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [3, 2, 1, 0]])
    b.cyl(P["beacon"], 1.6, (wx, 240, wz), (wx, 243, wz), seg=10)
    for y in range(8, 220, 6):
        if rnd.random() < 0.35:
            w = 26.2 if y < 170 else 22.2
            b.box(win, w, 0.5, w, wx, y, wz)

    # the rest of Uptown: a ring of towers well beyond the map's edges
    for i in range(26):
        a = 2 * math.pi * i / 26 + rnd.uniform(-0.08, 0.08)
        r = rnd.uniform(170, 260)
        x, z = r * math.cos(a) * 1.25, r * math.sin(a)
        if abs(x - wx) < 60 and abs(z - wz) < 60:
            continue
        w, d = rnd.uniform(18, 34), rnd.uniform(18, 34)
        h = rnd.uniform(25, 120)
        body = rnd.choice([P["tower_glass"], P["limestone"], P["conc"], P["glassdk"]])
        tower(x, z, w, d, h, body)


def build_outside(P):
    b = Builder()
    B = BOUNDS
    # ---- north: sidewalk, curb, the drive, a far kerb and hedge
    zn0 = -(BZ + 0.5)
    b.box(P["pavement"], 2 * B["maxX"], 0.12, 2.5, 0, 0, zn0 - 1.25)
    b.box(P["limestone"], 2 * B["maxX"], 0.14, 0.2, 0, 0, zn0 - 2.5)
    b.box(P["asphalt"], 2 * B["maxX"], 0.01, 4.5, 0, 0, -37.25)
    for x in range(-54, 55, 6):                                            # lane dashes
        b.box(P["paint_line"], 2.4, 0.012, 0.14, x, 0, -37.25)
    for x0 in (-49.5, 44.3):                                               # crosswalks at the doors
        for k in range(8):
            b.box(P["paint_line"], 0.45, 0.013, 4.4, x0 + k * 0.75, 0, -37.25)
    b.box(P["limestone"], 2 * B["maxX"], 0.6, 0.5, 0, 0, -39.5)              # far side: a low wall
    b.box(P["hedge"], 2 * B["maxX"], 0.9, 0.8, 0, 0.6, -39.6)
    b.box(P["pavement"], 2 * B["maxX"] + 40, 0.1, 30, 0, -0.1, -55)          # ground beyond
    b.box(P["asphalt"], 900, 0.02, 900, 0, -0.14, 0)                           # the city round it all
    b.box(P["pavement"], 2 * B["maxX"] + 40, 0.1, 30, 0, -0.1, 55)
    b.box(P["asphalt"], 2 * B["maxX"] + 200, 0.02, 14, 0, -0.05, -48)        # Westheimer Rd
    for x in range(-150, 151, 8):
        b.box(P["paint_yel"], 3, 0.03, 0.15, x, -0.04, -48)
    for x in (-40, -20, 0, 20, 40):
        streetlamp_pole(b, P, x, -40.2, -math.pi / 2)
    # valet canopies over the street doors: a slab on the four columns
    for cx in (-46.9, 46.9):
        b.box(P["limestone"], 9.4, 0.5, 5.6, cx, 4.6, -36.6)
        b.box(P["bronze_dk"], 9.5, 0.12, 5.7, cx, 4.55, -36.6)
        for x in (cx - 3, cx, cx + 3):
            for z in (-35.2, -38.0):
                b.cyl(P["downlight"], 0.15, (x, 4.54, z), (x, 4.55, z), seg=8, smooth=False)
    # ---- south: the garage level
    zs0 = BZ + 0.5
    b.box(P["floorconc"], 2 * B["maxX"], 0.01, B["maxZ"] - zs0, 0, 0, (zs0 + B["maxZ"]) / 2)
    for s in kinds("_garagedeck"):
        sbox(b, P["conc"], s)
        for x in range(-52, 53, 6):                                         # deck beams and lights
            b.box(P["conc"], 0.4, 0.4, s["d"], x, s["y"] - 0.4, s["z"])
            b.box(P["lamp_cool"], 1.2, 0.04, 0.14, x + 3, s["y"] - 0.05, s["z"])
    for x in range(-53, 54, 3):                                             # parking stalls
        b.box(P["paint_line"], 0.1, 0.012, 4.6, x, 0, 37.2)
    b.box(P["paint_yel"], 2 * B["maxX"], 0.012, 0.15, 0, 0, 34.6)
    for s in kinds("_edge"):
        if s["z"] > 0:
            # garage outer wall: a parapet with openings, columns between
            b.box(P["conc"], s["w"], 1.1, s["d"], s["x"], 0, s["z"])
            for x in range(-54, 55, 6):
                b.box(P["conc"], 0.5, GL["garageDeck"] + 0.4, 0.6, x, 0, s["z"])
            b.box(P["conc"], s["w"], 0.6, s["d"], s["x"], GL["garageDeck"] - 0.2, s["z"])
    # ---- the props out here
    draw_props(b, P, "outside")
    skyline(b, P)
    b.finish("gl-outside.glb")


PROPS.update({
    "car": p_car, "garagecar": p_car, "palmplanter": p_palmplanter, "barrier": p_barrier,
    "canopycol": p_canopycol, "garagecol": p_garagecol, "valet": p_valet, "paystation": p_paystation,
    "monument": p_monument, "garagesign": p_garagesign,
})


# ========================================================= Trollface Falls

TROLLFACE_PNG = os.path.join(HERE, "..", "..", "..", "images", "wallpaper", "trollface transparent.png")
FALLS = {"x": 44.0, "head": (45.25, 3.12, 0.3), "lip": (44.05, 3.02, -1.5)}


def _blur(a, n=1):
    import numpy as np
    for _ in range(n):
        p = np.pad(a, 1, mode="edge")
        a = (p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:] + p[1:-1, :-2] + p[1:-1, 1:-1] + p[1:-1, 2:]
             + p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]) / 9.0
    return a


def build_trollhead(P, width=2.8, res=180, front=0.62, back=0.42, carve=0.09):
    """The trollface carved in stone: the real artwork's outline is the
    silhouette, its ink lines are cut in as grooves, and the solid swells
    from a rounded rim to a full face. Weathered stone, darker in the cuts,
    moss creeping up from below. Writes gl-trollhead.glb."""
    import numpy as np
    img = bpy.data.images.load(TROLLFACE_PNG)
    W, H = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)        # rows bottom-up
    rh = int(res * H / W)
    ys = ((np.arange(rh) + 0.5) * H / rh).astype(int)
    xs = ((np.arange(res) + 0.5) * W / res).astype(int)
    sub = px[ys][:, xs]
    alpha = sub[..., 3]
    lum = sub[..., 0] * 0.3 + sub[..., 1] * 0.59 + sub[..., 2] * 0.11
    inside = alpha > 0.5
    ink = np.clip((0.6 - lum) / 0.45, 0, 1) * inside
    ink = _blur(ink, 1)
    # rounded silhouette: distance in from the edge (4-neighbour erosion)
    d = np.zeros(inside.shape, np.float32)
    cur = inside.copy()
    for _ in range(res // 3):
        d += cur
        p = np.pad(cur, 1)
        cur = cur & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
        if not cur.any():
            break
    t = np.clip(d / (res * 0.16), 0, 1)
    dome = np.sqrt(1 - (1 - t) ** 2)
    dome = _blur(dome, 1) * inside
    # a gentle overall bulge, fuller in the middle of the face
    yy, xx = np.mgrid[0:rh, 0:res]
    cx, cy = res * 0.5, rh * 0.5
    bulge = np.clip(1 - (((xx - cx) / (res * 0.55)) ** 2 + ((yy - cy) / (rh * 0.55)) ** 2), 0, 1) ** 0.6
    cell = width / res
    rows = np.where(inside.any(axis=1))[0]
    row0 = int(rows.min()) if len(rows) else 0                  # the artwork's empty margin below the chin
    zf = (front * (0.55 * dome + 0.45 * dome * bulge) - carve * ink * np.clip(dome * 3, 0, 1))
    zb = -back * dome

    # vertices: front and back sheets on the same grid
    idx_f = -np.ones((rh, res), int)
    idx_b = -np.ones((rh, res), int)
    verts, cols = [], []
    rnd = random.Random(5)
    stone_a, stone_b = hexlin(0xa5967d), hexlin(0x8a7b63)      # the grotto's weathered rock
    groove = hexlin(0x3a322a)
    moss = hexlin(0x4f6a2e)
    for i in range(rh):
        for j in range(res):
            if not inside[i, j]:
                continue
            x = (j - res / 2) * cell
            y = (i - row0) * cell
            n = 0.5 + 0.5 * math.sin(j * 0.21 + i * 0.13) * math.sin(i * 0.17 - j * 0.07)
            n = min(1.0, n + 0.35 * max(0.0, math.sin(j * 0.9) * math.sin(j * 0.23 + 1.3)) * (1 - i / rh))
            base = [stone_a[k] * (1 - n) + stone_b[k] * n for k in range(3)]
            g = float(ink[i, j]) * 0.85
            sp = 0.88 + 0.24 * rnd.random()                             # speckle, like the rock's grain
            c = [(base[k] * sp) * (1 - g) + groove[k] * g for k in range(3)]
            m = max(0.0, 1 - i / (rh * 0.22)) * (0.55 + 0.45 * rnd.random())
            c = [c[k] * (1 - m) + moss[k] * m for k in range(3)]
            idx_f[i, j] = len(verts)
            verts.append((x, y, float(zf[i, j])))
            cols.append((*c, 1.0))
            idx_b[i, j] = len(verts)
            verts.append((x, y, float(zb[i, j])))
            mb = max(0.0, 1 - i / (rh * 0.35))
            cb = [base[k] * (1 - mb) + moss[k] * mb for k in range(3)]
            cols.append((*cb, 1.0))
    faces = []
    edges = {}
    for i in range(rh - 1):
        for j in range(res - 1):
            q = (idx_f[i, j], idx_f[i, j + 1], idx_f[i + 1, j + 1], idx_f[i + 1, j])
            if min(q) < 0:
                continue
            faces.append(q)
            qb = (idx_b[i, j], idx_b[i + 1, j], idx_b[i + 1, j + 1], idx_b[i, j + 1])
            faces.append(qb)
            for a, b in ((q[0], q[1]), (q[1], q[2]), (q[2], q[3]), (q[3], q[0])):
                key = (min(a, b), max(a, b))
                edges[key] = edges.get(key, 0) + 1
    # stitch the rim: every front edge used by one quad joins its back twin
    back_of = {}
    for i in range(rh):
        for j in range(res):
            if idx_f[i, j] >= 0:
                back_of[idx_f[i, j]] = idx_b[i, j]
    for i in range(rh - 1):
        for j in range(res - 1):
            q = (idx_f[i, j], idx_f[i, j + 1], idx_f[i + 1, j + 1], idx_f[i + 1, j])
            if min(q) < 0:
                continue
            for a, b in ((q[0], q[1]), (q[1], q[2]), (q[2], q[3]), (q[3], q[0])):
                if edges[(min(a, b), max(a, b))] == 1:
                    faces.append((b, a, back_of[a], back_of[b]))

    # the rim comes off the pixel grid stair-stepped: relax it along itself
    # (front and back together) until the outline runs smooth
    rim = {}
    for (a, bb), cnt in edges.items():
        if cnt == 1:
            rim.setdefault(a, []).append(bb)
            rim.setdefault(bb, []).append(a)
    for _ in range(8):
        new = {}
        for v, nb in rim.items():
            if len(nb) != 2:
                continue
            x = 0.5 * verts[v][0] + 0.25 * (verts[nb[0]][0] + verts[nb[1]][0])
            y = 0.5 * verts[v][1] + 0.25 * (verts[nb[0]][1] + verts[nb[1]][1])
            new[v] = (x, y)
        for v, (x, y) in new.items():
            verts[v] = (x, y, verts[v][2])
            bv = back_of[v]
            verts[bv] = (x, y, verts[bv][2])

    # place it: facing -x (back down the mall), tilted back a touch,
    # cocked to one side, sat on the grotto's top
    hx, hy, hz = FALLS["head"]
    yaw, pitch, roll = -math.pi / 2, -0.12, 0.07
    from mathutils import Matrix
    M = (Matrix.Translation((hx, hy, hz)) @ Matrix.Rotation(yaw, 4, "Y")
         @ Matrix.Rotation(pitch, 4, "X") @ Matrix.Rotation(roll, 4, "Z"))
    Rz = Matrix.Rotation(math.pi / 2, 4, "X")                 # game -> Blender (the kit's convention)
    out = [tuple(Rz @ M @ Vector(v)) for v in verts]
    me = bpy.data.meshes.new("gl-trollhead")
    me.from_pydata(out, [], faces)
    me.validate()
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for k, c in enumerate(cols):
        attr.data[k].color = c
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(paint_material())
    me.color_attributes.active_color_name = "Col"
    me.color_attributes.render_color_index = me.color_attributes.active_color_index
    obj = bpy.data.objects.new("gl-trollhead", me)
    bpy.context.scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    path = os.path.join(OUT_DIR, "gl-trollhead.glb")
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_yup=True, export_apply=True)
    print("Exported", path, len(verts), "verts")
    bpy.data.objects.remove(obj)
    bpy.data.meshes.remove(me)


def fern(b, P, x, y, z, size=1.0, seed=0, droop=0.6):
    """A fern: a rosette of arching, tapering fronds with leaflets."""
    rnd = random.Random(seed)
    n = rnd.randint(9, 13)
    for k in range(n):
        a = 2 * math.pi * k / n + rnd.uniform(-0.2, 0.2)
        L = size * rnd.uniform(0.7, 1.05)
        rise = rnd.uniform(0.35, 0.7)
        dvec = Vector((math.cos(a), 0, math.sin(a)))
        pts = []
        for s in range(5):
            t = s / 4
            p = Vector((x, y, z)) + dvec * (L * t) + Vector((0, L * (rise * t - droop * t * t), 0))
            pts.append(p)
        m = P["leaf"] if k % 2 else P["leaf_dk"]
        for s in range(4):
            w = 0.07 * size * (1 - s / 4) + 0.012
            b.bar(m, pts[s], pts[s + 1], w, 0.012)
            # leaflets either side
            mid = (pts[s] + pts[s + 1]) / 2
            side = Vector((-dvec.z, 0, dvec.x)) * (0.16 * size * (1 - s / 5))
            b.bar(m, mid, mid + side + Vector((0, -0.03, 0)), 0.05 * size, 0.008)
            b.bar(m, mid, mid - side + Vector((0, -0.03, 0)), 0.05 * size, 0.008)


def flowers(b, P, x, y, z, seed=0, r=0.35):
    """A flowering clump (bromeliad / impatiens colours)."""
    rnd = random.Random(seed)
    b.lump(P["leaf_dk"], r * 2, r * 0.9, r * 2, x, y, z, seed=seed, rnd=0.8, jitter=0.05)
    cols = [P["pink"], pm(0xff8a3d), P["white"], pm(0xd6336c), P["yellow"]]
    c = rnd.choice(cols)
    for k in range(9):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0, r * 0.9)
        px, pz = x + math.cos(a) * d, z + math.sin(a) * d
        py = y + r * 0.7 + rnd.uniform(0, 0.12)
        b.cyl(c, 0.06, (px, py, pz), (px, py + 0.05, pz), seg=6)
        b.cyl(P["yellow"], 0.018, (px, py + 0.05, pz), (px, py + 0.06, pz), seg=4)


def build_falls(P):
    """The grotto under the carved head: stacked mossy boulders filling the
    collider, a stone lip the waterfall pours over, ferns and flowers in the
    ledges, a palm bed behind. (The water itself is grinleria.js.)"""
    b = Builder()
    stone = P["stone"]
    rocks = [
        # x, y, z, w, h, d, seed      (game coords; the collider is x 44.1..46.7, z -2.3..2.3, to y 3.25)
        (44.7, 0.0, -1.5, 1.6, 1.7, 1.5, 1), (45.8, 0.0, -1.6, 1.7, 1.9, 1.5, 2), (44.6, 0.0, 0.1, 1.5, 1.5, 1.8, 3),
        (45.9, 0.0, 0.5, 1.8, 2.0, 1.9, 4), (44.8, 0.0, 1.7, 1.6, 1.4, 1.3, 5), (45.9, 0.0, 1.9, 1.6, 1.6, 1.2, 6),
        (45.1, 1.4, -1.2, 1.5, 1.3, 1.5, 7), (45.8, 1.6, 0.0, 1.6, 1.3, 1.9, 8), (45.0, 1.3, 1.3, 1.5, 1.2, 1.4, 9),
        (45.4, 2.45, 0.3, 1.7, 0.85, 2.7, 10), (45.6, 2.3, -1.6, 1.2, 1.0, 1.1, 11),
    ]
    for (x, y, z, w, h, d, sd) in rocks:
        b.lump(stone, w, h, d, x, y, z, seed=sd, rnd=0.85, jitter=0.14)
    # stones at the water's edge
    for k, (x, z) in enumerate(((43.6, 0.9), (43.7, 2.0), (44.2, -2.5), (46.9, -1.0), (47.0, 1.4))):
        b.lump(stone, 0.6, 0.45, 0.55, x, 0.25, z, seed=40 + k, rnd=0.7, jitter=0.08)
    # the lip the water pours over, and the cleft behind it
    lx, ly, lz = FALLS["lip"]
    b.box(P["stone"], 0.7, 0.14, 1.2, lx + 0.25, ly - 0.14, lz, rz=0.08)
    b.lump(P["stone"], 0.8, 0.9, 0.5, lx + 0.4, ly - 0.1, lz - 0.85, seed=51, rnd=0.85)
    b.lump(P["stone"], 0.8, 0.8, 0.5, lx + 0.4, ly - 0.1, lz + 0.8, seed=52, rnd=0.85)
    # moss on the ledges
    for k, (x, y, z) in enumerate(((44.4, 1.55, -0.6), (44.3, 1.4, 1.0), (45.0, 2.7, -1.0), (46.3, 2.9, 1.0), (44.6, 0.42, 2.4), (46.4, 0.42, -2.2))):
        b.lump(P["leaf_dk"] if k % 2 else P["leaf"], 0.9, 0.12, 0.7, x, y, z, seed=60 + k, rnd=0.9, jitter=0.03)
    # ferns and flowers tucked into the rock
    for k, (x, y, z, s) in enumerate(((44.35, 1.5, -2.0, 0.9), (46.4, 2.6, -1.3, 1.1), (46.5, 2.4, 1.9, 1.0), (44.3, 1.2, 1.9, 0.8),
                                      (45.9, 3.15, -0.9, 0.7), (46.3, 0.5, 2.6, 0.9), (43.9, 0.45, -2.4, 0.7))):
        fern(b, P, x, y, z, size=s, seed=70 + k)
    for k, (x, y, z) in enumerate(((44.25, 1.0, 0.75), (46.1, 1.9, -2.1), (44.5, 2.2, 1.7), (46.6, 0.5, 0.4))):
        flowers(b, P, x, y, z, seed=80 + k)
    # ivy trailing down the back
    rnd = random.Random(90)
    for k in range(10):
        x0, z0 = 46.6 + rnd.uniform(-0.1, 0.2), rnd.uniform(-1.8, 1.8)
        y0 = rnd.uniform(2.2, 3.0)
        L = rnd.uniform(0.8, 1.8)
        b.bar(P["leaf_dk"], (x0, y0, z0), (x0 + 0.15, y0 - L, z0 + rnd.uniform(-0.2, 0.2)), 0.12, 0.03)
    # a collar of rock the carved head rises out of (kept clear of the grin)
    for k, (x, y, z, w, h, d) in enumerate(((45.7, 2.85, -0.95, 1.3, 1.0, 1.1), (45.7, 2.85, 1.55, 1.3, 1.0, 1.1), (46.0, 2.95, 0.3, 1.1, 1.3, 2.6),
                                            (44.8, 2.95, -1.05, 0.7, 0.7, 0.6), (44.8, 2.95, 1.65, 0.7, 0.7, 0.6))):
        b.lump(stone, w, h, d, x, y, z, seed=120 + k, rnd=0.85, jitter=0.1)
    # moss over the crown and down the cheeks, ivy trailing off the back
    hx, hy, hz = FALLS["head"]
    # (the carved head's crown is about 2 m over its base, lower at the sides)
    for k, (dx, y, dz, w) in enumerate(((0.25, 4.98, 0.2, 1.2), (0.3, 4.8, -0.65, 0.75), (0.32, 4.75, 1.15, 0.8), (0.5, 3.25, -1.1, 0.9), (0.5, 3.25, 1.7, 0.9))):
        b.lump(P["leaf_dk"] if k % 2 else P["leaf"], w, 0.26, w * 0.75, hx + dx, y, hz + dz, seed=140 + k, rnd=0.9, jitter=0.04)
    rnd = random.Random(150)
    for k in range(9):
        z0 = hz + rnd.uniform(-1.0, 1.5)
        y0 = 4.85 + rnd.uniform(-0.25, 0.15)
        L = rnd.uniform(1.0, 2.0)
        b.bar(P["leaf_dk"] if k % 2 else P["leaf"], (hx + 0.35, y0, z0), (hx + 0.55, y0 - L, z0 + rnd.uniform(-0.25, 0.25)), 0.1, 0.03)
    fern(b, P, 44.95, 3.35, -1.35, size=0.85, seed=160)
    fern(b, P, 44.95, 3.35, 1.95, size=0.85, seed=161)
    flowers(b, P, 45.1, 3.25, 2.25, seed=162, r=0.3)
    b.finish("gl-falls.glb")
    build_trollhead(P)


def p_palmbed(b, P, s, F):
    planter_box(b, P, s, palm_tree=True, seed=17)
    palm(b, P, s["x"] + 0.2, s["z"] + 1.0, h=4.0, lean=(-0.5, 0.4), seed=23)
    for k, dz in enumerate((-1.2, 1.3)):
        fern(b, P, s["x"], s["h"], s["z"] + dz, size=0.8, seed=100 + k)


PROPS.update({"palmbed": p_palmbed})


# ================================================================== main

MODELS = {
    "shell": build_shell,
    "shops": build_shops,
    "atrium": build_atrium,
    "wings": build_wings,
    "outside": build_outside,
    "falls": build_falls,
}


def main():
    import time
    import quantize_glb
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    P = mall_palette()
    for name, fn in MODELS.items():
        if ONLY and name not in ONLY:
            continue
        fn(P)
    # shrink what was just written (byte colours/normals, no unused UVs)
    fresh = [os.path.join(OUT_DIR, f) for f in sorted(os.listdir(OUT_DIR))
             if f.startswith("gl-") and f.endswith(".glb") and os.path.getmtime(os.path.join(OUT_DIR, f)) >= t0 - 1]
    quantize_glb.main(fresh)


main()
