"""
Troll City (build_trollface_island.blender.py, phase 1): the island's hot
place rebuilt as a real block, after refs/island/troll-city.webp.

Drawn in the city's own frame (the dome at 0, 0; x east, z south; the map
lays it at LANDMARKS.city). The plan:

  the dome (r 11, drum 5 m, the Grinleria trollface carving on its south
  face from tf-cityface) in a paved square with the fountain south of it
  the 6 m main street round the square (|x| or |z| from 23 to 29), kerbed
  eight shops you can walk into on the far side of it, two and three
  floors, blue and yellow with the art's black outlines, each with a lit
  sign band (lettered by maps/trollface-island-signs.js), a striped awning
  over its lit shopfront, a counter and the trade's stuff inside:
    north row (fronts south): Books, Pizza, Hotel; the yellow tower; Deli
    east column (fronts west): Arcade, Games
    south row (fronts north): Repair, Bar; the blue tower
  the Hotel and the Arcade are the two towers taller than the rest: three
  floors, a switchback stair inside up to the roof (out through a stair
  head), so their roofs look over the others'
  planks between the roofs: Books-Pizza-Hotel at 10.2 m, Repair-Bar at
  6.8; a steel stair down from the Arcade's roof to the Games', one up the
  Bar's back wall from the street
  the west side stays open for the road in (the switchback road ends there):
  the bus stop, the cars along the kerb, the lamp posts at the corners
  crates and pallets in the alleys, bins at the doors, AC units and vents
  on the roofs, drainpipes at the corners, one poster a wall at most

Every solid thing over 0.6 m registers a collider (map coordinates, the
Registry) and every shop's sign, door and shopfront a face (rule 9: nothing
stands inside 3 m in front of them: the cars, lamps and benches keep to the
square's side of the street). Upper floors and roofs are player-only (the
nav grid has one floor): their loot comes from deck spots (LOOT).
"""
import math
import random

from map_kit import mat

FL = 3.4                   # a floor's height
WALL = 0.3                 # a shop's wall
RISE, RUN, STAIR_W = 0.31, 0.5, 1.4
STREET = (23.0, 29.0)      # the main street's inner and outer edge from the centre
DOME_R, DRUM_H = 11.0, 5.0
TOWER_YELLOW = (12.0, -33.5, 6.0, 6.0, 40.0)     # x, z, w, d, h: the aerial tower
TOWER_BLUE = (-12.0, 33.5, 8.0, 10.0, 24.0)

# name, x, z, w, d, floors, body colour, front side, sign colour, awning colours
SHOPS = [
    ("Books", -27.0, -33.5, 10.0, 9.0, 3, "blue_a", "s", 0xf2cf4a, ("red", "white")),
    ("Pizza", -15.0, -33.5, 10.0, 9.0, 3, "yellow", "s", 0xe0409a, ("purple", "white")),
    ("Hotel", -2.0, -33.5, 12.0, 9.0, 3, "blue_b", "s", 0x7fe0ff, ("blue", "white")),
    ("Deli", 24.0, -33.5, 10.0, 9.0, 2, "blue_c", "s", 0x57d24f, ("green", "white")),
    ("Arcade", 33.5, -12.0, 9.0, 12.0, 3, "yellow_dk", "w", 0xe0409a, ("red", "white")),
    ("Games", 33.5, 4.25, 9.0, 10.0, 2, "blue_a", "w", 0xf2cf4a, ("yellow", "ink")),
    ("Repair", 6.0, 33.5, 12.0, 9.0, 2, "blue_c", "n", 0x57d24f, ("green", "white")),
    ("Bar", 22.0, 33.5, 10.0, 9.0, 2, "blue_b", "n", 0xff3a2a, ("red", "ink")),
]
STAIR_SHOPS = ("Hotel", "Arcade")

LOOT = []      # deck loot spots in map coordinates (the map adds them to lootExtra)
SIGNS = []     # [text, x, y, z, nx, nz, w, h, colour] in map coordinates


def palette():
    P = {
        "dome": mat("TF_Dome", 0x2c2c30, 0.45, 0.1),
        "dome_seam": mat("TF_DomeSeam", 0x47474d, 0.5, 0.1),
        "ink": mat("TF_Ink", 0x111114, 0.7),
        "blue_a": mat("TF_TowerAzure", 0x3a9ee6, 0.55),
        "blue_b": mat("TF_TowerPeri", 0x7b98e0, 0.55),
        "blue_c": mat("TF_TowerSky", 0x86c4ee, 0.55),
        "yellow": mat("TF_TowerYellow", 0xf2cf4a, 0.6),
        "yellow_dk": mat("TF_TowerYellowDark", 0xd8ad2a, 0.6),
        "window": mat("TF_Window", 0xfff1c2, 0.3, 0.0, 0xffe7a8, 0.55),
        "window_off": mat("TF_WindowOff", 0x2d4057, 0.25, 0.1),
        "shopglass": mat("TF_ShopGlassLit", 0xbfe6ff, 0.15, 0.0, 0x6f90a8, 0.45),
        "roof": mat("TF_Roof", 0x5d636c, 0.85),
        "unit": mat("TF_RoofUnit", 0xa8b0b8, 0.5, 0.2),
        "skylight": mat("TF_Skylight", 0x7fe0ff, 0.2, 0.0, 0x5fc8f0, 0.4),
        "antenna": mat("TF_Antenna", 0x7a2a22, 0.5, 0.2),
        "beacon": mat("TF_Beacon", 0xff3a2a, 0.3, 0.0, 0xff2a1a, 3.0),
        "lamp": mat("TF_Lamp", 0xfff6dc, 0.2, 0.0, 0xfff1d0, 1.2),
        "pole": mat("TF_Pole", 0x2f3338, 0.5, 0.3),
        "tile": mat("GS_Tile", 0xa8aab2, 0.5),
        "asphalt": mat("GS_Asphalt", 0xffffff, 0.9),
        "pavement": mat("GS_Pavement", 0xbdbdb8, 0.8),
        "kerb": mat("TF_Kerb", 0xb9b6ae, 0.8),
        "paint": mat("TF_RoadPaint", 0xf0eee6, 0.6),
        "board": mat("TF_SignBoard", 0x0c0d0e, 0.5),
        "steel": mat("TF_Steel", 0x6b7078, 0.5, 0.5),
        "plank": mat("GS_Plank", 0xffffff, 0.8),
        "wood": mat("TF_Counter", 0x9a7b55, 0.7),
        "wood_dk": mat("TF_WoodDark", 0x5c4327, 0.75),
        "crate": mat("TF_Crate", 0x8a6a3e, 0.8),
        "stone": mat("GS_Concrete", 0xffffff, 0.8),
        "water": mat("TF_FountainWater", 0x3fb7ff, 0.1, 0.0, 0x2a7fd0, 0.7),
        "bin": mat("TF_Bin", 0x2a4a2a, 0.6, 0.2),
        "chrome": mat("TF_Chrome", 0xd0d4d8, 0.25, 0.9),
        "red": mat("TF_AwnRed", 0xd23b2f, 0.7),
        "white": mat("TF_AwnWhite", 0xf2f2ee, 0.7),
        "green": mat("TF_AwnGreen", 0x2f8f4e, 0.7),
        "blue": mat("TF_AwnBlue", 0x2f63e0, 0.7),
        "purple": mat("TF_AwnPurple", 0x8a3fc4, 0.7),
        "pink": mat("TF_AwnPink", 0xe0409a, 0.7),
        "car_a": mat("TF_CarBlue", 0x2a55c8, 0.35, 0.3),
        "car_b": mat("TF_CarYellow", 0xf2b324, 0.35, 0.3),
        "car_c": mat("TF_CarGrey", 0xc4c8cc, 0.35, 0.4),
        "tyre": mat("TF_Tyre", 0x1a1a1c, 0.9),
        "glass": mat("TF_CarGlass", 0x9fd2f0, 0.1, 0.1),
        "screen": mat("TF_ArcadeScreen", 0x7fffa0, 0.3, 0.0, 0x57ff70, 1.0),
        "cabinet": mat("TF_Cabinet", 0x2b2f6e, 0.5),
        "book_a": mat("TF_BookRed", 0xc23a30, 0.7),
        "book_b": mat("TF_BookBlue", 0x2f63a0, 0.7),
        "book_c": mat("TF_BookGreen", 0x3f8f4e, 0.7),
        "bed": mat("TF_Bed", 0xe8e4da, 0.8),
        "blanket": mat("TF_Blanket", 0x7b3a3a, 0.8),
        "leather": mat("TF_Leather", 0x5a2e2a, 0.5),
        "cash": mat("TF_Cash", 0x4fa860, 0.6),
        "fridge": mat("TF_Fridge", 0xe8ecef, 0.3, 0.3),
        "cheese": mat("TF_Cheese", 0xf2c94c, 0.6),
        "meat": mat("TF_Meat", 0xc45a5a, 0.6),
        "box_a": mat("TF_BoxGreen", 0x57d24f, 0.6),
        "box_b": mat("TF_BoxPink", 0xff5ca8, 0.6),
        "box_d": mat("TF_BoxBlue", 0x3a8ef0, 0.6),
    }
    return P


def flat(b, m, x, y, z, w, d, ry=0.0):
    """One upward quad (2 triangles): road paint, a blanket, a rug."""
    c, s = math.cos(ry), math.sin(ry)
    pts = []
    for (u, v) in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)):
        pts.append((x + u * c + v * s, y, z - u * s + v * c))
    return b.poly(m, pts, [[0, 3, 2, 1]])


def quad(b, m, c, n, u, w, h):
    """One upright quad (2 triangles) centred at c, facing n, w along u, h up:
    a window pane, a poster, a flag."""
    cx, cy, cz = c
    ux, uz = u
    pts = [(cx - ux * w / 2, cy - h / 2, cz - uz * w / 2), (cx + ux * w / 2, cy - h / 2, cz + uz * w / 2),
           (cx + ux * w / 2, cy + h / 2, cz + uz * w / 2), (cx - ux * w / 2, cy + h / 2, cz - uz * w / 2)]
    # wind it so the normal is n (u x up = n when u = n turned left)
    f = b.poly(m, pts, [[0, 1, 2, 3]])
    nx, nz = n
    if f and (f[0].normal.x * nx + f[0].normal.z * nz) < 0:
        import bmesh
        bmesh.ops.reverse_faces(b.bm, faces=f)
    return f


class City:
    """One build: the builder, the registry, the place's origin."""

    def __init__(self, b, P, R, origin):
        self.b, self.P, self.R = b, P, R
        self.ox, self.oz = origin
        self.rng = random.Random(1337)
        LOOT.clear()
        SIGNS.clear()

    # ---- registry in map coordinates
    def col(self, x, z, w, d, h, y=0.0, pen=0.9):
        self.R.collider(self.ox + x, z + self.oz, w, d, h, y, pen)

    def face(self, fid, owner, c, n, w, h):
        self.R.face(fid, owner, (self.ox + c[0], c[1], self.oz + c[2]), (n[0], 0.0, n[1]), w, h)

    def begin(self, pid, on=None):
        self.R.begin(self.b, pid, on)

    def end(self):
        self.R.end((self.ox, 0.0, self.oz))

    def loot(self, x, y, z):
        LOOT.append({"x": round(self.ox + x, 2), "z": round(self.oz + z, 2), "y": round(y, 2)})

    def sign(self, text, x, y, z, nx, nz, w, h, colour):
        SIGNS.append([text, round(self.ox + x, 2), round(y, 2), round(self.oz + z, 2), nx, nz, w, h, colour])


# ------------------------------------------------------------- the ground

def ground(C):
    b, P = C.b, C.P
    i, o = STREET
    # the main street: four strips of asphalt round the square, and the
    # pavements out to the shop fronts
    for (x, z, w, d) in ((0, -(i + o) / 2, 2 * o, o - i), (0, (i + o) / 2, 2 * o, o - i),
                         (-(i + o) / 2, 0, o - i, 2 * i), ((i + o) / 2, 0, o - i, 2 * i)):
        b.box(P["asphalt"], w, 0.04, d, x, 0.0, z)
    for (x, z, w, d) in ((0, -34.5, 80, 11), (0, 34.5, 80, 11), (34.5, 0, 11, 58)):
        b.box(P["pavement"], w, 0.06, d, x, 0.0, z)
    # kerbs: a lip 0.12 high along both edges of the street
    for r, y in ((i, 0.0), (o, 0.0)):
        for (x, z, w, d) in ((0, -r, 2 * r + 0.3, 0.3), (0, r, 2 * r + 0.3, 0.3), (-r, 0, 0.3, 2 * r - 0.3), (r, 0, 0.3, 2 * r - 0.3)):
            b.box(P["kerb"], w, 0.14, d, x, y, z)
    # the centre line, dashed, and the crossing at the road in (west side)
    for k in range(-12, 13):
        for (x, z, w, d) in ((k * 2.3, -(i + o) / 2, 1.2, 0.14), (k * 2.3, (i + o) / 2, 1.2, 0.14),
                             (-(i + o) / 2, k * 2.3, 0.14, 1.2), ((i + o) / 2, k * 2.3, 0.14, 1.2)):
            if abs(x) < o - 1 and abs(z) < o - 1:
                flat(b, P["paint"], x, 0.048, z, w, d)
    for k in range(6):
        flat(b, P["paint"], -(i + o) / 2, 0.048, -3.0 + k * 1.2, 0.5, 2.4)
    # the square's paving: a ring of tiles round the dome's plinth
    b.box(P["tile"], 2 * i - 0.4, 0.03, 2 * i - 0.4, 0, 0.0, 0)


# ------------------------------------------------------------- the dome

def dome(C):
    """The black drum and hemisphere (its face is tf-cityface, the Grinleria
    carving), the plinth with its steps, the beacon. Colliders: a disc r 11
    h 5 and the crown r 8 h 5.5, as the map laid them."""
    b, P = C.b, C.P
    C.begin("dome")
    b.cyl(P["dome"], DOME_R, (0, 0, 0), (0, DRUM_H, 0), seg=40, caps=False)
    b.cyl(P["dome_seam"], DOME_R + 0.45, (0, 0, 0), (0, 0.7, 0), seg=40)
    b.cyl(P["stone"], DOME_R + 1.2, (0, 0, 0), (0, 0.35, 0), seg=40)                  # the plinth's step
    b.cyl(P["dome_seam"], DOME_R + 0.08, (0, DRUM_H - 0.12, 0), (0, DRUM_H + 0.12, 0), seg=40, caps=False)
    LAT, SEG = 11, 40
    pts, faces = [], []
    for i in range(LAT + 1):
        e = (math.pi / 2) * i / LAT
        for j in range(SEG):
            a = 2 * math.pi * j / SEG
            pts.append((DOME_R * math.cos(e) * math.sin(a), DRUM_H + DOME_R * math.sin(e), DOME_R * math.cos(e) * math.cos(a)))
    for i in range(LAT):
        for j in range(SEG):
            k = (j + 1) % SEG
            faces.append([i * SEG + j, i * SEG + k, (i + 1) * SEG + k, (i + 1) * SEG + j])
    for f in b.poly(P["dome"], pts, faces):
        f.smooth = True
    for e in (0.42, 0.85, 1.2):
        r, y = DOME_R * math.cos(e) + 0.04, DRUM_H + DOME_R * math.sin(e)
        b.cyl(P["dome_seam"], r, (0, y - 0.07, 0), (0, y + 0.07, 0), seg=SEG, caps=False)
    b.cyl(P["dome_seam"], 1.6, (0, DRUM_H + DOME_R - 0.15, 0), (0, DRUM_H + DOME_R + 0.5, 0), seg=16)
    b.cyl(P["beacon"], 0.35, (0, DRUM_H + DOME_R + 0.5, 0), (0, DRUM_H + DOME_R + 1.1, 0), seg=10)
    # a lit band of windows round the drum's north half (the face is south)
    for j in range(14):
        a = math.pi + (j - 6.5) * 0.19
        x, z = (DOME_R + 0.04) * math.sin(a), (DOME_R + 0.04) * math.cos(a)
        quad(b, P["window"], (x, 3.0, z), (math.sin(a), math.cos(a)), (math.cos(a), -math.sin(a)), 0.9, 1.6)
    C.end()
    for (r, h, y) in ((DOME_R, DRUM_H, 0.0), (8.0, 5.5, DRUM_H)):
        n = max(1, math.ceil(2 * r / 3))
        step = 2 * r / n
        for i in range(n):
            zm = -r + (i + 0.5) * step
            hw = math.sqrt(max(0.0, r * r - zm * zm))
            if hw > 0.4:
                C.col(0, zm, hw * 2, step, h, y, 1.2)
    C.face("dome-face", "dome", (0, DRUM_H + 5.5, DOME_R + 0.3), (0, 1), 14.0, 11.0)


# ------------------------------------------------------------- the fountain and the square

def fountain(C, x, z):
    b, P = C.b, C.P
    C.begin("fountain")
    r = 3.2
    b.cyl(P["stone"], r + 0.3, (x, 0, z), (x, 0.8, z), seg=24)
    b.cyl(P["water"], r - 0.05, (x, 0.8, z), (x, 0.62, z), seg=24)            # the water, a lid
    b.cyl(P["stone"], 0.5, (x, 0.6, z), (x, 2.0, z), seg=12)
    b.cyl(P["stone"], 1.5, (x, 2.0, z), (x, 2.25, z), seg=20, r2=1.1)
    b.cyl(P["water"], 1.4, (x, 2.25, z), (x, 2.3, z), seg=20)
    b.cyl(P["stone"], 0.25, (x, 2.3, z), (x, 3.2, z), seg=10)
    b.cyl(P["stone"], 0.8, (x, 3.2, z), (x, 3.4, z), seg=16, r2=0.5)
    b.cyl(P["water"], 0.75, (x, 3.4, z), (x, 3.45, z), seg=16)
    b.cyl(P["water"], 0.18, (x, 3.45, z), (x, 4.4, z), seg=8, r2=0.06)         # the jet
    C.end()
    C.col(x, z, 2 * r + 0.6, 2 * r + 0.6, 0.8, 0, 1.0)


def bench(C, pid, x, z, ry):
    b, P = C.b, C.P
    c, s = math.cos(ry), math.sin(ry)
    C.begin(pid)
    b.box(P["wood"], 1.8, 0.08, 0.45, x, 0.44, z, ry=ry)
    b.box(P["wood"], 1.8, 0.4, 0.07, x - s * 0.2, 0.52, z - c * 0.2, ry=ry, rx=-0.15)
    for sx in (-0.75, 0.75):
        b.box(P["ink"], 0.08, 0.44, 0.4, x + c * sx, 0.0, z - s * sx, ry=ry)
    C.end()


def lamp_post(C, pid, x, z, ry=0.0):
    b, P = C.b, C.P
    C.begin(pid)
    b.cyl(P["pole"], 0.14, (x, 0, z), (x, 0.3, z), seg=8)
    b.cyl(P["pole"], 0.07, (x, 0.3, z), (x, 4.2, z), seg=8)
    b.box(P["pole"], 0.9, 0.1, 0.16, x + math.cos(ry) * 0.4, 4.1, z - math.sin(ry) * 0.4, ry=ry)
    b.box(P["lamp"], 0.5, 0.14, 0.3, x + math.cos(ry) * 0.65, 3.98, z - math.sin(ry) * 0.65, ry=ry)
    C.end()
    C.col(x, z, 0.3, 0.3, 4.2, 0, 4)


def car(C, pid, x, z, ry, colour):
    """4.4 x 1.8 x 1.5 m (the style sheet), its nose along +x before ry."""
    b, P = C.b, C.P
    c, s = math.cos(ry), math.sin(ry)
    L = lambda lx, lz: (x + lx * c + lz * s, z - lx * s + lz * c)      # noqa: E731
    C.begin(pid)
    b.box(P[colour], 4.4, 0.62, 1.8, x, 0.34, z, ry=ry, bevel=0.06)
    b.box(P[colour], 2.4, 0.56, 1.64, *L(-0.2, 0)[:1], 0.96, L(-0.2, 0)[1], ry=ry, bevel=0.08)
    b.box(P["glass"], 2.32, 0.5, 1.5, *L(-0.2, 0)[:1], 0.99, L(-0.2, 0)[1], ry=ry)
    b.box(P["ink"], 0.9, 0.2, 1.7, *L(-1.6, 0)[:1], 0.98, L(-1.6, 0)[1], ry=ry)           # the boot's lip
    for (lx, lz) in ((1.5, 0.95), (1.5, -0.95), (-1.5, 0.95), (-1.5, -0.95)):
        wx, wz = L(lx, lz)
        b.cyl(P["tyre"], 0.34, (wx + s * 0.12, 0.34, wz + c * 0.12), (wx - s * 0.12, 0.34, wz - c * 0.12), seg=12)
    for lz in (-0.6, 0.6):
        hx, hz = L(2.2, lz)
        b.box(P["lamp"], 0.06, 0.18, 0.3, hx, 0.5, hz, ry=ry)
        tx, tz = L(-2.2, lz)
        b.box(P["beacon"], 0.06, 0.14, 0.3, tx, 0.5, tz, ry=ry)
    C.end()
    C.col(x, z, abs(4.4 * c) + abs(1.8 * s), abs(4.4 * s) + abs(1.8 * c), 1.5, 0, 1.5)


def bus_stop(C, x, z):
    """A shelter at the road in, open to the street (east)."""
    b, P = C.b, C.P
    C.begin("bus-stop")
    for sz in (-1.5, 1.5):
        b.box(P["steel"], 0.12, 2.6, 0.12, x - 0.6, 0, z + sz)
        b.box(P["steel"], 0.12, 2.6, 0.12, x + 0.6, 0, z + sz)
    b.box(P["steel"], 1.5, 0.12, 3.3, x, 2.6, z)
    b.box(P["shopglass"], 0.06, 2.3, 3.1, x - 0.6, 0.2, z)
    b.box(P["shopglass"], 1.2, 2.3, 0.06, x, 0.2, z - 1.5)
    b.box(P["wood"], 1.0, 0.08, 0.4, x - 0.2, 0.46, z + 0.2)
    b.box(P["board"], 0.5, 0.7, 0.06, x, 1.4, z - 1.46)
    C.end()
    C.col(x - 0.6, z, 0.14, 3.3, 2.6, 0, 1.0)
    C.col(x, z - 1.5, 1.4, 0.14, 2.6, 0, 1.0)
    C.col(x - 0.2, z + 0.2, 1.0, 0.4, 0.5, 0, 1.0)


def crate(C, pid, x, z, s=0.9, ry=0.0, y=0.0, on=None):
    b, P = C.b, C.P
    C.begin(pid, on)
    b.box(P["crate"], s, s, s, x, y, z, ry=ry, bevel=0.03)
    for k in (-0.35, 0.35):
        b.box(P["wood_dk"], s + 0.04, 0.08, s + 0.04, x, y + s / 2 + k * s, z, ry=ry)
    C.end()
    if s + y > 0.6:
        C.col(x, z, s, s, s, y, 1.2)


def pallet(C, pid, x, z, ry=0.0):
    b, P = C.b, C.P
    C.begin(pid)
    for k in (-0.5, 0, 0.5):
        b.box(P["wood_dk"], 1.2, 0.1, 0.14, x + math.cos(ry) * 0, 0, z + k, ry=ry)
    b.box(P["wood"], 1.2, 0.04, 1.2, x, 0.1, z, ry=ry)
    C.end()


def bin_(C, pid, x, z):
    b, P = C.b, C.P
    C.begin(pid)
    b.cyl(P["bin"], 0.3, (x, 0, z), (x, 1.0, z), seg=10)
    b.cyl(P["ink"], 0.33, (x, 1.0, z), (x, 1.1, z), seg=10)
    C.end()
    C.col(x, z, 0.66, 0.66, 1.1, 0, 1.0)


# ------------------------------------------------------------- the shops

class Shop:
    """One shop's frame: the front faces `side` (n s e w); `t` runs along the
    front (left to right as you face it), `o` is out of the front."""

    def __init__(self, row):
        (self.name, self.x, self.z, self.w, self.d, self.floors, self.colour, self.side,
         self.sign_colour, self.awning) = row
        self.key = self.name.lower()
        # outward normal and the along-the-front unit
        self.n = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}[self.side]
        self.u = (-self.n[1], self.n[0])
        self.front_w = self.w if self.side in ("n", "s") else self.d
        self.depth = self.d if self.side in ("n", "s") else self.w
        self.roof = self.floors * FL

    def p(self, t, o):
        """(t along the front from its middle, o out of the front's plane) -> x, z."""
        fx, fz = self.x + self.n[0] * self.depth / 2, self.z + self.n[1] * self.depth / 2
        return fx + self.u[0] * t + self.n[0] * o, fz + self.u[1] * t + self.n[1] * o

    def box(self, b, m, t, o, y, w, h, d, bevel=0.0):
        """A box w along the front, d out of it, its bottom on y, centred at (t, o)."""
        x, z = self.p(t, o)
        W, D = (w, d) if self.side in ("n", "s") else (d, w)
        return b.box(m, W, h, D, x, y, z, bevel=bevel)

    def ry(self):
        return {"s": 0.0, "n": math.pi, "e": math.pi / 2, "w": -math.pi / 2}[self.side]


def shop_walls(C, S):
    """The ground floor as a room (its colliders wall for wall), the floors
    above as a solid body on the simple shops; the stair shops get walls a
    floor, floor slabs with the stairwell cut and a roof slab (shop_stairs)."""
    b, P = C.b, C.P
    m = P[S.colour]
    pid = f"shop:{S.key}"
    door_w, door_t = 1.6, -S.front_w / 2 + 2.4          # the door left of the middle
    half = S.front_w / 2
    C.begin(pid)
    # front wall: a lintel band over the door and the shopfront, posts between
    o = -WALL / 2
    S.box(b, m, 0, o, 2.6, S.front_w, FL - 2.6, WALL)                                     # over the door and glass
    S.box(b, P["ink"], 0, o + 0.02, 2.62, S.front_w + 0.1, 0.16, WALL + 0.04)             # the lintel line
    posts = [-half + WALL / 2, door_t - door_w / 2 - 0.15, door_t + door_w / 2 + 0.15, door_t + door_w / 2 + 1.0, half - WALL / 2]
    for t in posts:
        S.box(b, P["ink"], t, o, 0, 0.3, 2.6, WALL)
    # the shopfront glass right of the door, a sill under it, the display shelf behind
    g0, g1 = posts[3] + 0.15, posts[4] - 0.15
    S.box(b, m, (g0 + g1) / 2, o, 0, g1 - g0, 0.6, WALL)
    S.box(b, P["shopglass"], (g0 + g1) / 2, o, 0.6, g1 - g0, 2.0, 0.06)
    S.box(b, P["wood"], (g0 + g1) / 2, o - 0.4, 0.6, g1 - g0 - 0.1, 0.1, 0.55)
    # a small pane left of the door, lit
    if door_t - door_w / 2 - 0.3 > -half + 0.6:
        t = (-half + WALL + door_t - door_w / 2 - 0.3) / 2
        S.box(b, m, t, o, 0, door_t - door_w / 2 - 0.3 + half - WALL, 0.6, WALL)
        S.box(b, P["shopglass"], t, o, 0.6, door_t - door_w / 2 - 0.3 + half - WALL, 2.0, 0.06)
    # colliders for the front: the two solid stretches beside the door (the
    # glass is a wall too), the band over the door is clear at 2.6 m
    for (t0, t1) in ((-half, door_t - door_w / 2), (door_t + door_w / 2, half)):
        x, z = S.p((t0 + t1) / 2, o)
        w = t1 - t0
        C.col(x, z, *((w, WALL) if S.side in ("n", "s") else (WALL, w)), 2.6, 0, 0.9)
    # the door itself: open, a dark reveal, the face registered
    S.box(b, P["ink"], door_t, o - 0.3, 0, 0.12, 2.3, 0.08)
    S.box(b, P["ink"], door_t - door_w / 2 - 0.02, o, 0, 0.08, 2.3, WALL + 0.1)
    S.box(b, P["ink"], door_t + door_w / 2 + 0.02, o, 0, 0.08, 2.3, WALL + 0.1)
    dx, dz = S.p(door_t, 0)
    C.face(f"door:{S.key}", pid, (dx, 1.15, dz), S.n, door_w, 2.3)
    gx, gz = S.p((g0 + g1) / 2, 0.04)
    C.face(f"glass:{S.key}", pid, (gx, 1.6, gz), S.n, g1 - g0, 2.0)
    # the back and the two sides, full height on the ground floor
    walls = [(0, -S.depth + WALL / 2, S.front_w, WALL)]                        # back
    walls += [(-half + WALL / 2, -S.depth / 2, WALL, S.depth - 2 * WALL), (half - WALL / 2, -S.depth / 2, WALL, S.depth - 2 * WALL)]
    for (t, oo, w, d) in walls:
        S.box(b, m, t, oo, 0, w, FL, d)
        x, z = S.p(t, oo)
        C.col(x, z, *((w, d) if S.side in ("n", "s") else (d, w)), FL, 0, 0.9)
    # the floor
    S.box(b, P["tile"], 0, -S.depth / 2, 0.0, S.front_w - 2 * WALL, 0.03, S.depth - 2 * WALL)
    # the body above: solid on the simple shops; the stair shops get floors
    if S.name not in STAIR_SHOPS:
        S.box(b, m, 0, -S.depth / 2, FL, S.front_w, S.roof - FL, S.depth)
        x, z = S.p(0, -S.depth / 2)
        C.col(x, z, S.w, S.d, S.roof - FL, FL, 0.9)
        S.box(b, P["ink"], 0, -S.depth / 2, FL - 0.1, S.front_w + 0.12, 0.2, S.depth + 0.12)   # the floor line
    # the art's black outlines: corner posts and the parapet (0.25 high: the
    # planks lie on it and a player steps up it), a roof slab
    for (t, oo) in ((-half, 0), (half, 0), (-half, -S.depth), (half, -S.depth)):
        S.box(b, P["ink"], t, oo, 0, 0.26, S.roof + 0.25, 0.26)
    for (t, oo, w, d) in ((0, 0, S.front_w + 0.1, 0.24), (0, -S.depth, S.front_w + 0.1, 0.24),
                          (-half, -S.depth / 2, 0.24, S.depth), (half, -S.depth / 2, 0.24, S.depth)):
        S.box(b, P["ink"], t, oo, S.roof, w, 0.25, d)
    S.box(b, P["roof"], 0, -S.depth / 2, S.roof - 0.02, S.front_w - 0.3, 0.14, S.depth - 0.3)
    # windows on the upper floors, lit panes a few centimetres proud (one
    # quad each): the front gets big ones with sills, the sides small
    for fl in range(1, S.floors):
        y = fl * FL + 0.9
        n = int(S.front_w // 2.2)
        for k in range(n):
            t = (k - (n - 1) / 2) * 2.2
            x, z = S.p(t, 0.03)
            quad(b, P["window"] if C.rng.random() < 0.8 else P["window_off"], (x, y + 0.75, z), S.n, S.u, 1.3, 1.5)
            S.box(b, P["ink"], t, 0.0, y - 0.1, 1.5, 0.08, 0.2)                       # the sill
        for oo in (-1.8, -S.depth / 2, -S.depth + 1.8):
            for sgn in (-1, 1):
                x, z = S.p(sgn * (half + 0.03), oo)
                nn = (S.u[0] * sgn, S.u[1] * sgn)
                quad(b, P["window"] if C.rng.random() < 0.7 else P["window_off"], (x, y + 0.65, z), nn, (-nn[1], nn[0]), 1.0, 1.3)
    # the sign band over the lintel (2.95 .. 3.85, under the first floor's
    # windows at 4.3), its face registered; the awning hinged under it at 2.8
    sy = 2.95
    bw = 0.62 * len(S.name) + 1.0                     # a compact lit box over the glass, as the ref's
    bt = (g0 + g1) / 2
    S.box(b, P["board"], bt, 0.1, sy, bw, 0.9, 0.22)
    S.box(b, P["ink"], bt, 0.1, sy - 0.06, bw + 0.12, 0.06, 0.26)
    S.box(b, P["ink"], bt, 0.1, sy + 0.9, bw + 0.12, 0.06, 0.26)
    sx, sz = S.p(bt, 0.22)
    C.face(f"sign:{S.key}", pid, (sx, sy + 0.45, sz), S.n, bw - 0.2, 0.8)
    C.sign(S.name.upper(), sx, sy + 0.45, sz, S.n[0], S.n[1], bw - 0.2, 0.8, S.sign_colour)
    awning(C, S, g0, g1)
    # a drainpipe down the right side wall, AC units and a vent on the roof
    S.box(b, P["pole"], half + 0.08, -0.6, 0, 0.12, S.roof - 0.2, 0.12)
    S.box(b, P["unit"], -half + 2.0, -S.depth / 2 - 1.0, S.roof + 0.1, 1.4, 0.9, 1.1, bevel=0.04)
    S.box(b, P["unit"], half - 2.0, -S.depth / 2 + 1.5, S.roof + 0.1, 1.0, 0.7, 1.0, bevel=0.04)
    x, z = S.p(0, -S.depth / 2 + 1.0)
    b.cyl(P["unit"], 0.3, (x, S.roof, z), (x, S.roof + 1.3, z), seg=10)
    b.cyl(P["roof"], 0.4, (x, S.roof + 1.3, z), (x, S.roof + 1.5, z), seg=10, r2=0.2)
    C.end()


def awning(C, S, g0, g1):
    """Striped, hinged at 2.85 m, sloping out 1.2 m to 2.3: under the sign
    and above the door's head and the glass, so it stands in front of nothing."""
    b, P = C.b, C.P
    a, bb = S.awning
    n = max(3, int((g1 - g0) / 0.6))
    w = (g1 - g0) / n
    for k in range(n):
        t = g0 + (k + 0.5) * w
        x, z = S.p(t, 0.6)
        W, D = (w, 1.26) if S.side in ("n", "s") else (1.26, w)
        # tilt the far end down: the box's +z end for a south front, -z for
        # north, +x for east, -x for west (Blender's right-hand rotations)
        rx = 0.45 if S.side == "s" else -0.45 if S.side == "n" else 0.0
        rz = 0.45 if S.side == "e" else -0.45 if S.side == "w" else 0.0
        b.box(P[a if k % 2 == 0 else bb], W, 0.05, D, x, 2.58, z, rx=rx, rz=rz)
    for t in (g0 + 0.1, g1 - 0.1):
        S.box(b, P["ink"], t, 0.6, 2.32, 0.06, 0.06, 1.2)


def interior(C, S):
    """The trade's stuff on the ground floor, seen through the door and the
    glass: a counter inside the door on the right with cash on it, the back
    wall shelved, the floor's furniture by the trade."""
    b, P, rng = C.b, C.P, C.rng
    pid = f"shop:{S.key}"
    half = S.front_w / 2
    # the counter: 2.4 long, 0.95 high, 0.6 deep, a till and cash on it
    ct, co = half - 2.2, -2.2
    C.begin(f"{pid}/counter", on=pid)
    S.box(b, P["wood"], ct, co, 0, 2.4, 0.95, 0.6)
    S.box(b, P["wood_dk"], ct, co, 0.95, 2.5, 0.06, 0.7)
    S.box(b, P["ink"], ct + 0.7, co, 1.01, 0.4, 0.32, 0.36, bevel=0.02)
    S.box(b, P["screen"], ct + 0.7, co + 0.19, 1.08, 0.3, 0.2, 0.02)
    for k in range(3):
        S.box(b, P["cash"], ct - 0.6 + k * 0.22, co + rng.uniform(-0.1, 0.1), 1.01 + k * 0.004, 0.16, 0.004, 0.07)
    C.end()
    x, z = S.p(ct, co)
    C.col(x, z, *((2.5, 0.7) if S.side in ("n", "s") else (0.7, 2.5)), 1.0, 0, 1.0)
    # the back wall shelves, goods on them (the stair shops keep the right
    # end clear: flight A comes down there)
    C.begin(f"{pid}/shelves", on=pid)
    s0, s1 = -half + WALL + 0.2, (half - WALL - 0.2) if S.name not in STAIR_SHOPS else (half - WALL - STAIR_W - 0.5)
    sw, st = s1 - s0, (s0 + s1) / 2
    S.box(b, P["unit"], st, -S.depth + WALL + 0.22, 0, sw, 2.3, 0.44)
    for lvl in (0.8, 1.7):
        S.box(b, P["wood_dk"], st, -S.depth + WALL + 0.24, lvl, sw, 0.04, 0.5)
        n = int(sw / 0.5)
        for k in range(n):
            if rng.random() < 0.45:
                mm = {"Books": ("book_a", "book_b", "book_c"), "Pizza": ("box_b", "box_a", "cheese"), "Hotel": ("white", "wood"),
                      "Deli": ("cheese", "meat", "box_a"), "Arcade": ("box_d", "box_b"), "Games": ("box_d", "box_a", "box_b"),
                      "Repair": ("steel", "tyre", "box_d"), "Bar": ("chrome", "cheese", "box_b")}[S.name]
                S.box(b, P[rng.choice(mm)], s0 + (k + 0.5) * 0.5, -S.depth + WALL + 0.26, lvl + 0.04, 0.34, rng.uniform(0.2, 0.45), 0.3)
    C.end()
    x, z = S.p(st, -S.depth + WALL + 0.22)
    C.col(x, z, *((sw, 0.46) if S.side in ("n", "s") else (0.46, sw)), 2.3, 0, 1.0)
    # the trade's floor pieces: two tables in the middle of the pizzeria and the bar
    if S.name in ("Pizza", "Bar"):
        for k, (t, o) in enumerate(((0.0, -5.6), (0.0, -3.0))):
            C.begin(f"{pid}/table{k}", on=pid)
            x, z = S.p(t, o)
            b.cyl(P["ink"], 0.05, (x, 0, z), (x, 0.72, z), seg=6)
            b.cyl(P["ink"], 0.3, (x, 0, z), (x, 0.03, z), seg=8)
            b.cyl(P["wood"], 0.45, (x, 0.72, z), (x, 0.78, z), seg=10)
            for a in (0.8, 3.9):
                cx, cz = x + math.cos(a) * 0.7, z + math.sin(a) * 0.7
                b.box(P["ink"], 0.4, 0.04, 0.4, cx, 0.45, cz, ry=-a)
                b.box(P["ink"], 0.4, 0.45, 0.05, cx + math.cos(a) * 0.19, 0.45, cz + math.sin(a) * 0.19, ry=-a)
                b.box(P["ink"], 0.05, 0.45, 0.05, cx, 0, cz)
            C.end()
            C.col(x, z, 0.9, 0.9, 0.78, 0, 1.0)
    if S.name == "Pizza":
        C.begin(f"{pid}/oven", on=pid)
        S.box(b, P["stone"], -half + 1.4, -S.depth + 1.8, 0, 1.8, 1.0, 1.4)
        S.box(b, P["stone"], -half + 1.4, -S.depth + 1.8, 1.0, 1.6, 0.9, 1.2, bevel=0.2)
        S.box(b, P["beacon"], -half + 1.4, -S.depth + 1.14, 1.15, 0.7, 0.4, 0.05)
        S.box(b, P["pole"], -half + 1.4, -S.depth + 1.8, 1.9, 0.4, 1.4, 0.4)
        C.end()
        x, z = S.p(-half + 1.4, -S.depth + 1.8)
        C.col(x, z, 1.8, 1.8, 1.9, 0, 1.0)
    if S.name == "Books":
        for k, t in enumerate((-half + 1.6, -half + 3.6)):
            C.begin(f"{pid}/stack{k}", on=pid)
            S.box(b, P["wood_dk"], t, -S.depth / 2, 0, 1.0, 1.9, 3.0)
            for lvl in (0.4, 0.95, 1.5):
                for oo in range(5):
                    S.box(b, P[rng.choice(("book_a", "book_b", "book_c"))], t + rng.uniform(-0.3, 0.3), -S.depth / 2 - 1.2 + oo * 0.6, lvl, 0.9, rng.uniform(0.25, 0.4), 0.3)
            C.end()
            x, z = S.p(t, -S.depth / 2)
            C.col(x, z, *((1.1, 3.0) if S.side in ("n", "s") else (3.0, 1.1)), 1.9, 0, 1.0)
    if S.name in ("Arcade", "Games"):
        n = 4 if S.name == "Arcade" else 2
        for k in range(n):
            t = -half + 2.4 + k * 1.1
            C.begin(f"{pid}/cab{k}", on=pid)
            S.box(b, P["cabinet"], t, -S.depth / 2 - 0.5, 0, 0.8, 1.8, 0.8)
            S.box(b, P["screen"], t, -S.depth / 2 - 0.08, 1.05, 0.6, 0.5, 0.04)
            S.box(b, P["ink"], t, -S.depth / 2 - 0.1, 0.85, 0.7, 0.12, 0.3)
            S.box(b, P["cabinet"], t, -S.depth / 2 - 0.5, 1.8, 0.8, 0.3, 0.6)
            C.end()
            x, z = S.p(t, -S.depth / 2 - 0.5)
            C.col(x, z, 0.8, 0.8, 2.1, 0, 1.0)
    if S.name == "Repair":
        C.begin(f"{pid}/lift", on=pid)
        S.box(b, P["steel"], -half + 3.0, -S.depth / 2, 0, 2.6, 0.5, 4.6)
        S.box(b, P["beacon"], -half + 3.0, -S.depth / 2, 0.5, 2.0, 0.08, 4.2)
        for oo in (-2.0, 2.0):
            S.box(b, P["steel"], -half + 1.5, -S.depth / 2 + oo, 0, 0.3, 2.4, 0.3)
            S.box(b, P["steel"], -half + 4.5, -S.depth / 2 + oo, 0, 0.3, 2.4, 0.3)
        for k in range(3):
            x, z = S.p(-half + 1.3 + k * 1.6, -S.depth + 1.3)
            b.cyl(P["tyre"], 0.34, (x, 0.0, z), (x, 0.24, z), seg=12)
            b.cyl(P["tyre"], 0.34, (x, 0.24, z), (x, 0.48, z), seg=12)
        C.end()
        x, z = S.p(-half + 3.0, -S.depth / 2)
        C.col(x, z, *((2.6, 4.6) if S.side in ("n", "s") else (4.6, 2.6)), 0.6, 0, 1.0)
    if S.name == "Hotel":
        C.begin(f"{pid}/sofa", on=pid)
        S.box(b, P["leather"], -half + 2.2, -S.depth / 2, 0.0, 2.2, 0.5, 0.9, bevel=0.06)
        S.box(b, P["leather"], -half + 2.2, -S.depth / 2 - 0.35, 0.5, 2.2, 0.5, 0.25, bevel=0.06)
        C.end()
        x, z = S.p(-half + 2.2, -S.depth / 2)
        C.col(x, z, *((2.2, 1.0) if S.side in ("n", "s") else (1.0, 2.2)), 1.0, 0, 1.0)
    if S.name == "Deli":
        C.begin(f"{pid}/fridge", on=pid)
        S.box(b, P["fridge"], -half + 1.6, -S.depth / 2, 0, 2.2, 1.2, 1.0, bevel=0.03)
        S.box(b, P["shopglass"], -half + 1.6, -S.depth / 2 + 0.3, 1.2, 2.2, 0.8, 0.8, bevel=0.03)
        for k in range(4):
            S.box(b, P[("meat", "cheese")[k % 2]], -half + 0.9 + k * 0.5, -S.depth / 2 - 0.1, 1.22, 0.4, 0.18, 0.5)
        C.end()
        x, z = S.p(-half + 1.6, -S.depth / 2)
        C.col(x, z, *((2.2, 1.0) if S.side in ("n", "s") else (1.0, 2.2)), 2.0, 0, 1.0)
    if S.name == "Bar":
        C.begin(f"{pid}/bar", on=pid)
        S.box(b, P["wood_dk"], -half + 1.2, -S.depth / 2, 0, 0.7, 1.1, 5.0)
        S.box(b, P["chrome"], -half + 1.2, -S.depth / 2, 1.1, 0.8, 0.04, 5.1)
        for k in range(4):
            x, z = S.p(-half + 2.1, -S.depth / 2 - 1.8 + k * 1.2)
            b.cyl(P["chrome"], 0.04, (x, 0, z), (x, 0.7, z), seg=6)
            b.cyl(P["leather"], 0.2, (x, 0.7, z), (x, 0.78, z), seg=10)
        C.end()
        x, z = S.p(-half + 1.2, -S.depth / 2)
        C.col(x, z, *((0.8, 5.1) if S.side in ("n", "s") else (5.1, 0.8)), 1.1, 0, 1.0)
    # one poster on the left side wall, outside (never two a face)
    C.begin(f"{pid}/poster", on=pid)
    x, z = S.p(-half - 0.14, -S.depth / 2 + 1.5)
    nn = (-S.u[0], -S.u[1])
    quad(b, P[rng.choice(("box_b", "box_a", "box_d"))], (x, 2.0, z), nn, (-nn[1], nn[0]), 0.9, 1.2)
    C.end()


def shop_stairs(C, S):
    """The three-floor shops: a floor slab at each level with the stairwell
    cut, walls a floor, a switchback stair A (one side wall, up), B (the back
    wall, across), C (the other side wall, up again) out through the stair
    head on the roof. In the shop's frame: t along the front, o out
    (negative is in). The Hotel's runs mirrored (A on the left), so its
    stair head is on the east side, away from the plank from the Pizza."""
    b, P = C.b, C.P
    m = P[S.colour]
    pid = f"shop:{S.key}"
    half = S.front_w / 2
    sg = 1.0                                             # (a mirrored run would flip every t)
    inner_t0, inner_t1 = -half + WALL, half - WALL
    inner_o0, inner_o1 = -S.depth + WALL, -WALL           # back .. front (inside)
    run_len = 11 * RUN                                   # a flight: 11 risers of 0.31 over 5.5 m
    # flights, each as (top t, top o, direction (dt, do) the steps descend along, y0)
    #   A: along the right wall (left, mirrored), top at the back, descends toward the front
    #   B: along the back wall, top at the far end, descends back toward A
    #   C: along the other wall, top toward the front, descends toward the back
    tA = sg * (inner_t1 - STAIR_W / 2)
    A = (tA, inner_o0 + 0.1, 0.0, 1.0, 0.0)
    B = (sg * (inner_t1 - STAIR_W - run_len), inner_o0 + STAIR_W / 2, sg * 1.0, 0.0, FL)
    tC = sg * (inner_t0 + STAIR_W / 2)
    o_top = inner_o0 + STAIR_W + run_len
    C_ = (tC, o_top, 0.0, -1.0, 2 * FL)

    def flight(name, top_t, top_o, dt, do, y0):
        C.begin(pid)
        n = 11
        for i in range(n):
            h = FL - i * (FL / n)
            along = (i + 0.5) * RUN
            t, o = top_t + dt * along, top_o + do * along
            w, d = (STAIR_W, RUN) if dt == 0 else (RUN, STAIR_W)
            S.box(b, P["tile"], t, o, y0, w, h, d)
            x, z = S.p(t, o)
            C.col(x, z, *((w, d) if S.side in ("n", "s") else (d, w)), h, y0, 0.9)
        # a handrail on the open side (toward the room)
        for k in range(0, n + 1, 2):
            along = k * RUN
            t, o = top_t + dt * along, top_o + do * along
            if dt == 0:
                side_t, side_o = t - math.copysign(STAIR_W / 2 + 0.05, top_t), o
            else:
                side_t, side_o = t, o + STAIR_W / 2 + 0.05
            y = y0 + FL - k * (FL / n)
            S.box(b, P["steel"], side_t, side_o, y, 0.05, 0.9, 0.05)
        C.end()

    flight("a", *A)
    flight("b", *B)
    flight("c", *C_)

    # the slabs: floor 1 misses A's well, floor 2 misses B's, the roof misses
    # C's; every slab is the room's inside, 0.25 thick, in up to three boxes
    def slab(name, y, well):
        wt0, wt1, wo0, wo1 = well
        C.begin(pid)
        boxes = []
        if wo1 < inner_o1 - 0.05:
            boxes.append(((inner_t0 + inner_t1) / 2, (wo1 + inner_o1) / 2, inner_t1 - inner_t0, inner_o1 - wo1))
        if wo0 > inner_o0 + 0.05:
            boxes.append(((inner_t0 + inner_t1) / 2, (inner_o0 + wo0) / 2, inner_t1 - inner_t0, wo0 - inner_o0))
        if wt0 > inner_t0 + 0.05:
            boxes.append(((inner_t0 + wt0) / 2, (wo0 + wo1) / 2, wt0 - inner_t0, wo1 - wo0))
        if wt1 < inner_t1 - 0.05:
            boxes.append(((wt1 + inner_t1) / 2, (wo0 + wo1) / 2, inner_t1 - wt1, wo1 - wo0))
        for (t, o, w, d) in boxes:
            S.box(b, P["tile"] if y < S.roof else P["roof"], t, o, y - 0.25, w, 0.25, d)
            x, z = S.p(t, o)
            C.col(x, z, *((w, d) if S.side in ("n", "s") else (d, w)), 0.25, y - 0.25, 0.9)
        C.end()

    def trange(a, c):
        return (min(sg * a, sg * c), max(sg * a, sg * c))

    wellA = (*trange(inner_t1 - STAIR_W, inner_t1), inner_o0, inner_o0 + run_len + 0.4)
    wellB = (*trange(inner_t1 - STAIR_W - run_len - 0.3, inner_t1 - STAIR_W), inner_o0, inner_o0 + STAIR_W)
    wellC = (*trange(inner_t0, inner_t0 + STAIR_W), inner_o0 + STAIR_W, o_top + 0.3)
    slab("floor1", FL, wellA)
    slab("floor2", 2 * FL, wellB)
    slab("roof-slab", S.roof, wellC)
    # upper walls: the body's walls a floor, 0.3 thick (shop_walls draws the windows)
    C.begin(pid)
    for fl in range(1, S.floors):
        y = fl * FL
        for (t, oo, w, d) in ((0, -WALL / 2, S.front_w, WALL), (0, -S.depth + WALL / 2, S.front_w, WALL),
                              (-half + WALL / 2, -S.depth / 2, WALL, S.depth - 2 * WALL), (half - WALL / 2, -S.depth / 2, WALL, S.depth - 2 * WALL)):
            S.box(b, m, t, oo, y, w, FL, d)
            x, z = S.p(t, oo)
            C.col(x, z, *((w, d) if S.side in ("n", "s") else (d, w)), FL, y, 0.9)
        S.box(b, P["ink"], 0, -S.depth / 2, y - 0.1, S.front_w + 0.12, 0.2, S.depth + 0.12)
    C.end()
    # the stair head on the roof over C's top: the outer wall's side, a wall
    # toward the front and a lid; open to the room side, where you step out,
    # and to the back, where the flight comes up under the lid
    C.begin(pid)
    ht, ho = tC, o_top - 0.9
    side_t = ht - sg * (STAIR_W / 2 + 0.1)
    S.box(b, m, side_t, ho, S.roof, 0.2, 2.4, 2.6)                                           # the outer side
    S.box(b, m, ht, ho + 1.2, S.roof, STAIR_W + 0.4, 2.4, 0.2)                                 # the front
    S.box(b, P["roof"], ht + sg * 0.1, ho, S.roof + 2.4, STAIR_W + 0.6, 0.2, 2.8)
    for (t, o, w, d) in ((side_t, ho, 0.2, 2.6), (ht, ho + 1.2, STAIR_W + 0.4, 0.2)):
        x, z = S.p(t, o)
        C.col(x, z, *((w, d) if S.side in ("n", "s") else (d, w)), 2.4, S.roof, 0.9)
    C.end()
    # the upper floors' furniture (player-only): beds in the hotel, more
    # cabinets in the arcade, clear of flight C's wall; deck loot on each
    # floor and the roof
    for fl in range(1, S.floors):
        y = fl * FL
        for k in range(3):
            t = sg * (-half + 2.8 + k * 2.6)
            if S.name == "Hotel":
                C.begin(f"{pid}/bed{fl}{k}", on=pid)
                S.box(b, P["bed"], t, -S.depth / 2 - 1.0, y, 1.2, 0.5, 2.0)
                S.box(b, P["blanket"], t, -S.depth / 2 - 1.3, y + 0.5, 1.2, 0.08, 1.4)
                S.box(b, P["wood_dk"], t, -S.depth / 2 - 2.0, y, 1.3, 0.9, 0.1)
                C.end()
                x, z = S.p(t, -S.depth / 2 - 1.0)
                C.col(x, z, *((1.2, 2.0) if S.side in ("n", "s") else (2.0, 1.2)), 0.62, y, 1.0)
            else:
                C.begin(f"{pid}/cab{fl}{k}", on=pid)
                S.box(b, P["cabinet"], t, -S.depth / 2 - 1.5, y, 0.8, 1.8, 0.8)
                S.box(b, P["screen"], t, -S.depth / 2 - 1.08, y + 1.05, 0.6, 0.5, 0.04)
                C.end()
                x, z = S.p(t, -S.depth / 2 - 1.5)
                C.col(x, z, 0.8, 0.8, 1.8, y, 1.0)
        x, z = S.p(sg * (half - 2.5), -S.depth / 2 + 1.5)
        C.loot(x, y, z)
    x, z = S.p(0, -S.depth / 2 - 1.5)
    C.loot(x, S.roof, z)


def plank(C, pid, a, bb, y, on=None):
    """A walkway of boards from a to b at height y (a collider you walk on)."""
    b, P = C.b, C.P
    (x0, z0), (x1, z1) = a, bb
    L = math.hypot(x1 - x0, z1 - z0)
    ry = math.atan2(-(z1 - z0), x1 - x0)
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    C.begin(pid, on)
    for k in (-0.4, 0.0, 0.4):
        b.box(P["plank"], L + 0.4, 0.07, 0.36, cx + math.sin(ry) * k, y, cz + math.cos(ry) * k, ry=ry)
    b.box(P["wood_dk"], L + 0.2, 0.08, 0.08, cx, y + 0.07, cz, ry=ry)
    C.end()
    C.col(cx, cz, abs((L + 0.4) * math.cos(ry)) + abs(1.2 * math.sin(ry)), abs((L + 0.4) * math.sin(ry)) + abs(1.2 * math.cos(ry)), 0.1, y, 0.5)


def fire_escape(C, pid, x, z, dx, dz, y_top, y_bot, w=1.2, on=None):
    """Steel steps down from (x, z) at y_top along (dx, dz) to y_bot, rails both sides."""
    b, P = C.b, C.P
    n = max(1, math.ceil((y_top - y_bot) / RISE))
    C.begin(pid, on)
    for i in range(n):
        h = (y_top - y_bot) - i * ((y_top - y_bot) / n)
        along = (i + 0.5) * RUN
        sx, sz = x + dx * along, z + dz * along
        W, D = (RUN, w) if dx else (w, RUN)
        b.box(P["steel"], W, 0.1, D, sx, y_bot + h - 0.1, sz)
        if i % 2 == 0:
            for s in (-1, 1):
                px, pz = (sx, sz + s * (w / 2 + 0.04)) if dx else (sx + s * (w / 2 + 0.04), sz)
                b.box(P["steel"], 0.05, 1.0, 0.05, px, y_bot + h - 0.1, pz)
        C.col(sx, sz, W, D, h, y_bot, 0.9)
    for s in (-1, 1):
        a = (x, y_top + 0.9, z + s * (w / 2 + 0.04)) if dx else (x + s * (w / 2 + 0.04), y_top + 0.9, z)
        bb = (x + dx * n * RUN, y_bot + 0.9, z + s * (w / 2 + 0.04)) if dx else (x + s * (w / 2 + 0.04), y_bot + 0.9, z + dz * n * RUN)
        b.bar(P["steel"], a, bb, 0.05)
    for i in range(0, n, 3):
        along = (i + 0.5) * RUN
        sx, sz = x + dx * along, z + dz * along
        b.box(P["steel"], 0.12, y_bot + ((y_top - y_bot) - i * ((y_top - y_bot) / n)) - 0.1, 0.12, sx, 0, sz)   # a leg
    C.end()


def tower(C, pid, x, z, w, d, h, colour, aerial=False, mural=None):
    """The two tall towers behind the shops, solid (the sky lobby's
    silhouette). `mural` names a face (n s e w) kept bare below 9 m: the
    map paints the trollface mosaic there."""
    b, P, rng = C.b, C.P, C.rng
    m = P[colour]
    C.begin(pid)
    b.box(m, w, h, d, x, 0, z)
    b.box(P["roof"], w + 0.06, 0.6, d + 0.06, x, 0, z)
    hw, hd = w / 2, d / 2
    for (x0, z0, x1, z1, nx, nz, side) in ((x - hw, z + hd, x + hw, z + hd, 0, 1, "s"), (x + hw, z - hd, x - hw, z - hd, 0, -1, "n"),
                                           (x + hw, z + hd, x + hw, z - hd, 1, 0, "e"), (x - hw, z - hd, x - hw, z + hd, -1, 0, "w")):
        L = math.hypot(x1 - x0, z1 - z0)
        ux, uz = (x1 - x0) / L, (z1 - z0) / L
        n = max(1, int(L // 2.3))
        rows = int((h - 2.6) // 2.4)
        for k in range(n):
            t = (k + 0.5) * (L / n)
            cx, cz = x0 + ux * t + nx * 0.03, z0 + uz * t + nz * 0.03
            for r in range(rows):
                y = 1.4 + r * 2.4 + 0.5
                if side == mural and y < 9:
                    continue
                mm = P["window"] if rng.random() < 0.78 else P["window_off"]
                quad(b, mm, (cx, y + 0.65, cz), (nx, nz), (ux, uz), 1.0, 1.3)
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box(P["ink"], 0.24, h + 0.35, 0.24, x + sx * (hw - 0.05), 0, z + sz * (hd - 0.05))
    for (px, pz, pw, pd) in ((x, z - hd, w + 0.1, 0.24), (x, z + hd, w + 0.1, 0.24), (x - hw, z, 0.24, d), (x + hw, z, 0.24, d)):
        b.box(P["ink"], pw, 0.4, pd, px, h, pz)
    b.box(P["roof"], w - 0.3, 0.12, d - 0.3, x, h, z)
    b.box(P["unit"], 1.6, 1.0, 1.2, x + w * 0.2, h + 0.12, z - d * 0.2, bevel=0.05)
    if aerial:
        b.cyl(P["antenna"], 0.25, (x, h, z), (x, h + 8, z), seg=8, r2=0.12)
        for y in (h + 2.5, h + 5):
            b.cyl(P["antenna"], 0.42, (x, y, z), (x, y + 0.2, z), seg=8)
        b.cyl(P["beacon"], 0.32, (x, h + 8, z), (x, h + 8.5, z), seg=8, r2=0.1)
    else:
        b.cyl(P["unit"], 0.9, (x - w * 0.2, h + 0.12, z + d * 0.2), (x - w * 0.2, h + 2.0, z + d * 0.2), seg=12)
    C.end()
    C.col(x, z, w, d, h, 0, 0.9)


# ------------------------------------------------------------- the build

def build(b, P, R, origin):
    """Draws Troll City into builder b (its frame: the dome at 0, 0),
    registering with R in map coordinates (origin = the place's centre)."""
    C = City(b, P, R, origin)
    ground(C)
    dome(C)
    fountain(C, 0.0, 16.5)
    for k, a in enumerate((0.4, 1.2, 1.95, 2.75)):                 # east round to west, clear of the dome's plinth
        bench(C, f"bench{k}", 6.2 * math.cos(a), 16.5 + 6.2 * math.sin(a), -a + math.pi / 2)
    i, o = STREET
    for k, (x, z) in enumerate(((-i + 1.5, -i + 1.5), (i - 1.5, -i + 1.5), (i - 1.5, i - 1.5), (-i + 1.5, i - 1.5),
                                (0, -i + 1.5), (0, i - 1.5), (-i + 1.5, 0), (i - 1.5, 0))):
        lamp_post(C, f"lamp{k}", x, z, math.atan2(-z, -x) if (x or z) else 0.0)
    shops = [Shop(row) for row in SHOPS]
    for S in shops:
        shop_walls(C, S)
        interior(C, S)
        if S.name in STAIR_SHOPS:
            shop_stairs(C, S)
    by = {S.name: S for S in shops}
    tower(C, "tower-yellow", *TOWER_YELLOW, "yellow", aerial=True)
    tower(C, "tower-blue", *TOWER_BLUE, "blue_a", mural="n")
    # planks over the alleys, lying on the parapets: Books-Pizza-Hotel at
    # 10.2 + 0.25, Repair-Bar at 6.8 + 0.25
    for (a, bb, k) in (("Books", "Pizza", 0), ("Pizza", "Hotel", 1), ("Repair", "Bar", 2)):
        A, B = by[a], by[bb]
        ax = A.x + (A.w / 2 - 0.6) * (1 if B.x > A.x else -1)
        bx = B.x - (B.w / 2 - 0.6) * (1 if B.x > A.x else -1)
        z = A.z + (1.5 if A.side == "s" else -1.5)
        plank(C, f"plank{k}", (ax, z), (bx, z), A.roof + 0.25, on=(f"shop:{A.key}", f"shop:{B.key}"))
    # the Arcade's roof down to the Games' across the alley; the Bar's roof
    # from the street up its back wall in two flights, east then west
    Ar, Ga, Ba = by["Arcade"], by["Games"], by["Bar"]
    fire_escape(C, "escape-arcade", Ar.x + 1.5, Ar.z + Ar.d / 2 + 0.1, 0, 1, Ar.roof, Ga.roof, on=(f"shop:{Ar.key}", f"shop:{Ga.key}"))
    # (up the Bar's east wall: its back is 2 m off the Cave's mound) flight a
    # on the outside from the street end up to a landing at the south end,
    # flight b inside it back north, its top beside the roof's edge
    ex_a, ex_b = Ba.x + Ba.w / 2 + 2.0, Ba.x + Ba.w / 2 + 0.8
    lz = Ba.z + Ba.d / 2 - 2.55
    fire_escape(C, "escape-bar-a", ex_a, lz - 0.05, 0, -1, 3.4, 0.0, on=f"shop:{Ba.key}")
    C.begin("escape-bar-landing", on=(f"shop:{Ba.key}", "escape-bar-a", "escape-bar-b"))
    b.box(P["steel"], 2.6, 0.1, 1.3, (ex_a + ex_b) / 2, 3.3, lz + 0.65)
    for sx in (-1.1, 1.1):
        b.box(P["steel"], 0.12, 3.3, 0.12, (ex_a + ex_b) / 2 + sx, 0, lz + 1.2)
    C.end()
    C.col((ex_a + ex_b) / 2, lz + 0.65, 2.6, 1.3, 3.4, 0, 0.9)
    fire_escape(C, "escape-bar-b", ex_b, lz - 5.55, 0, 1, Ba.roof, 3.4, on=(f"shop:{Ba.key}", "escape-bar-a"))
    C.loot(Ba.x, Ba.roof, Ba.z)
    C.loot(by["Books"].x, by["Books"].roof, by["Books"].z)
    # the bus stop at the road in, three cars along the inner kerb (3 m and
    # more from every shopfront), a bin at each shop's alley corner, crates
    # and pallets in the alleys
    bus_stop(C, -o - 1.6, -6.0)
    car(C, "car0", -8.0, -(i + o) / 2 + 1.6, 0.0, "car_a")
    car(C, "car1", 10.0, (i + o) / 2 - 1.6, math.pi, "car_b")
    car(C, "car2", (i + o) / 2 - 1.6, 14.0, math.pi / 2, "car_c")
    for S in shops:
        x, z = S.p(S.front_w / 2 + 0.55, 0.3)
        bin_(C, f"bin:{S.key}", x, z)
    k = 0
    for (x, z, ry) in ((-21.2, -36.5, 0.2), (-21.0, -31.0, -0.3), (-9.0, -37.0, 0.1), (17.0, -36.0, 0.4), (14.5, 36.0, 0.0), (14.5, 32.0, -0.5), (31.0, -3.0, 0.3)):
        crate(C, f"crate{k}", x, z, 0.9, ry)
        k += 1
    crate(C, "crate-top", -21.2, -36.5, 0.7, 0.5, y=0.9, on="crate0")
    pallet(C, "pallet0", 28.5, -22.0, 0.2)
    pallet(C, "pallet1", -6.5, 37.5, -0.3)
    b.finish("tf-city-p1.glb")       # a new name a phase: the asset service worker re-checks art daily
