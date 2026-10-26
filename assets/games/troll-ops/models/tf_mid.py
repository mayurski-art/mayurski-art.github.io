"""
The five mid places (build_trollface_island.blender.py, phase 4), each in
its own frame as the map lays it (x east, z south), five GLBs:

  SHOP     U Mad Bro Shop: the big store (aisles of gondolas, a freezer row,
           two tills, the stock room behind a partition), its roof sign (the
           neon lettering stays a canvas: TF_BUILT.shop.neon), the car park
           in front with 4 bays (maps/trollface-island.js PARKING), the
           trolley bay, bollards, the cash machine, the loading bay on the
           east side, the steel stair up the west wall to the roof
  MARKET   The Marketplace: the covered hall with two rows of stalls, the
           canopy stalls in the square, the fountain, parasols, the noodle
           cart, bikes, chalk boards, and the fish market up on the stone
           quay behind its sea wall
  GALLERY  The Gallery: the glass pyramid (the lobby: ticket desk, gift shop,
           the bust), two halls either side with framed memes, busts on
           plinths, rope barriers, benches and spotlight tracks, the
           sculpture court north. The glass is the map's (TF_BUILT.gallery
           .glass, the pyramid cone), the busts hg-trollbust (.busts)
  OBS      The Observatory: the house (chart desk, kettle and mugs, charts,
           the ladder), the steel stair up the west wall to the catwalk
           round the dome, the dome you walk into with the big yellow
           telescope out of its slit, the radio mast
  LAB      Meme Lab: the portal ring on its deck (the swirl stays a canvas:
           TF_BUILT.memelab.swirl), the two-floor lab with glass walls
           (.glass), desks, server racks, the centrifuge, specimen jars,
           whiteboards, the coffee machine, cable spaghetti

Every solid thing registers a collider; doors, windows, signs and the two
canvases register faces (rule 9).
"""
import math
from types import SimpleNamespace

from mathutils import Vector

from map_kit import mat
import tf_city
import tf_lake
from tf_city import flat, quad, car, bench, lamp_post, bin_, fire_escape
from tf_lake import Site, torus, sphere, barrel, box_shed, LOOT, SIGNS
from tf_skate import stairs

GLASS = []        # panes the map draws in glass: [cx, cy, cz, w, h, nx, nz] in map metres
EXTRA = {}        # what else the map needs from a place (neon, swirl, busts)


def palette():
    P = dict(tf_city.palette())
    P.update(tf_lake.palette())
    P.update({
        "carpark": mat("TF_CarPark", 0x3c3f45, 0.9),
        "bollard": mat("TF_Bollard", 0xf2c21a, 0.5),
        "plaster": mat("TF_ShopPlaster", 0xf3efe6, 0.85),
        "shop_trim": mat("TF_ShopTrim", 0x2a62c8, 0.6),
        "gondola": mat("TF_Gondola", 0xe8ecef, 0.5, 0.2),
        "freezer": mat("TF_Freezer", 0xdfe7ee, 0.3, 0.2),
        "ice": mat("TF_FreezerGlass", 0xbfe8ff, 0.1, 0.1),
        "till": mat("TF_Till", 0x30343a, 0.5, 0.3),
        "belt": mat("TF_Belt", 0x16181b, 0.7),
        "trolley": mat("TF_Trolley", 0xb8c0c8, 0.3, 0.8),
        "atm": mat("TF_Atm", 0x1f6f4a, 0.5, 0.3),
        "rack": mat("TF_Rack", 0x2f5aa8, 0.5, 0.4),
        "can_r": mat("TF_CanRed", 0xd8322a, 0.4, 0.4),
        "can_g": mat("TF_CanGreen", 0x3dbb4a, 0.4, 0.4),
        "can_b": mat("TF_CanBlue", 0x2f8fe0, 0.4, 0.4),
        "shrink": mat("TF_ShrinkWrap", 0xdde6ec, 0.2),
        "poster_y": mat("TF_PosterYellow", 0xffd23a, 0.7),
        "poster_r": mat("TF_PosterRed", 0xff4a3a, 0.7),
        "poster_b": mat("TF_PosterBlue", 0x3aa0ff, 0.7),
        "hall": mat("TF_HallTimber", 0x8a5a36, 0.8),
        "hall_roof": mat("TF_HallRoof", 0x3f6e5a, 0.6, 0.2),
        "quay": mat("TF_QuayStone", 0xa49c8c, 0.9),
        "quay_dk": mat("TF_QuayStoneDark", 0x7a7466, 0.9),
        "ice_bed": mat("TF_IceBed", 0xeaf6ff, 0.2),
        "chalk": mat("TF_Chalkboard", 0x1e2a24, 0.9),
        "chalk_w": mat("TF_Chalk", 0xf2f2ea, 0.9),
        "parasol_r": mat("TF_ParasolRed", 0xe2463a, 0.7),
        "parasol_w": mat("TF_ParasolWhite", 0xf4f0e6, 0.7),
        "parasol_y": mat("TF_ParasolYellow", 0xf2c21a, 0.7),
        "noodle": mat("TF_NoodleCart", 0xc8322a, 0.5),
        "basket": mat("TF_Basket", 0xb88a4a, 0.9),
        "hedge": mat("TF_Hedge", 0x2f8a44, 0.95),
        "gravel": mat("TF_Gravel", 0xd6d0c2, 0.95),
        "lab_wall": mat("TF_LabWall", 0xdfe8ee, 0.6),
        "hall_wall": mat("TF_GalleryHall", 0xeee8dc, 0.85),
        "lab_post": mat("TF_LabPost", 0x34444f, 0.4, 0.5),
        "desk": mat("TF_LabDesk", 0xf2f4f6, 0.5),
        "monitor": mat("TF_Monitor", 0x101418, 0.4),
        "mon_glow": mat("TF_MonitorGlow", 0x7fe0ff, 0.3, 0.0, 0x5fd0ff, 1.2),
        "server": mat("TF_ServerRack", 0x22262c, 0.5, 0.4),
        "server_led": mat("TF_ServerLed", 0x57ff70, 0.3, 0.0, 0x57ff70, 2.0),
        "jar": mat("TF_SpecimenJar", 0xb8f0c8, 0.1),
        "chair": mat("TF_SwivelChair", 0x2a2e36, 0.6),
        "whiteboard": mat("TF_Whiteboard", 0xfafafa, 0.3),
        "marker": mat("TF_Marker", 0x2a5ad8, 0.5),
        "obs_floor": mat("TF_ObsFloor", 0x8a6a4a, 0.8),
        "chart": mat("TF_StarChart", 0x1a2a5a, 0.8),
        "star": mat("TF_StarInk", 0xf6f0c8, 0.6),
        "mast": mat("TF_RadioMast", 0xd83a2a, 0.5, 0.3),
        "mug": mat("TF_Mug", 0xf2f2ee, 0.4),
    })
    return P


class MSite(Site):
    """tf_lake's Site with several containers: a prop begun while they are
    set stands in or on each of them (the car park, the store round it)."""

    def __init__(self, *a):
        super().__init__(*a)
        self.containers = ()

    def begin(self, pid, on=None):
        on = tuple(on) if isinstance(on, (tuple, list)) else ((on,) if on else ())
        on = on + tuple(c for c in self.containers if c != pid and c not in on)
        self.R.begin(self.b, pid, on or None)


def glass(C, x0, z0, x1, z1, y0, y1, out):
    """A glass pane from (x0, z0) to (x1, z1), y0 to y1, facing `out` (nx, nz)."""
    w = math.hypot(x1 - x0, z1 - z0)
    if w < 0.05 or y1 - y0 < 0.05:
        return
    GLASS.append([round(C.ox + (x0 + x1) / 2, 3), round((y0 + y1) / 2, 3), round(C.oz + (z0 + z1) / 2, 3),
                  round(w, 3), round(y1 - y0, 3), out[0], out[1]])


def poster(C, m, c, n, u, w, h, frame="ink"):
    b, P = C.b, C.P
    quad(b, P[frame], (c[0] + n[0] * 0.01, c[1], c[2] + n[1] * 0.01), n, u, w + 0.08, h + 0.08)
    quad(b, P[m], (c[0] + n[0] * 0.02, c[1], c[2] + n[1] * 0.02), n, u, w, h)


def rail_run(C, pid, pts, y, h=1.0, on=None):
    """A steel guard rail along the points at height y (posts, a top rail, a
    mid rail), a collider per run."""
    b, P = C.b, C.P
    for (ax, az), (cx, cz) in zip(pts, pts[1:]):
        C.begin(pid, on)
        L = math.hypot(cx - ax, cz - az)
        n = max(1, round(L / 1.6))
        for i in range(n + 1):
            t = i / n
            b.cyl(P["steel"], 0.035, (ax + (cx - ax) * t, y, az + (cz - az) * t), (ax + (cx - ax) * t, y + h, az + (cz - az) * t), seg=6)
        for yy in (h, h * 0.5):
            b.cyl(P["steel"], 0.03, (ax, y + yy, az), (cx, y + yy, cz), seg=6)
        C.end()
    for (ax, az), (cx, cz) in zip(pts, pts[1:]):
        C.col((ax + cx) / 2, (az + cz) / 2, max(0.1, abs(cx - ax)), max(0.1, abs(cz - az)), h, y, 1)


# ============================================================== U MAD BRO SHOP

S_X0, S_X1, S_Z0, S_Z1, S_H = -14.0, 14.0, -10.0, 4.0, 6.5
S_ROOF = S_H + 0.1                       # the roof's top (box_shed's flat roof)
SHOP_BAYS = [(5.0, 11.0), (7.8, 11.0), (10.6, 11.0), (13.4, 11.0)]      # local; the map's PARKING has them


def gondola(C, pid, x, z, L, rng):
    """A double-sided shelf run along z: 1.2 deep, 1.8 tall, goods both faces."""
    b, P = C.b, C.P
    boxes = [P["box_a"], P["box_b"], P["box_d"], P["can_r"], P["can_g"], P["can_b"], P["cheese"]]
    C.begin(pid)
    b.box(P["gondola"], 1.2, 0.12, L, x, 0, z)
    b.box(P["gondola"], 0.08, 1.8, L, x, 0, z)
    for ez in (-1, 1):
        b.box(P["gondola"], 1.2, 1.8, 0.06, x, 0, z + ez * L / 2)
    for sy in (0.12, 0.7, 1.28):
        b.box(P["gondola"], 1.18, 0.03, L - 0.1, x, sy, z)
        for side in (-1, 1):
            zz = z - L / 2 + 0.1
            while zz < z + L / 2 - 0.35:
                s = rng.uniform(0.25, 0.5)
                if rng.random() < 0.85:
                    b.box(rng.choice(boxes), 0.36, rng.uniform(0.2, 0.42), s, x + side * 0.32, sy + 0.03, zz + s / 2)
                zz += s + 0.05
    b.box(P["shop_trim"], 1.22, 0.25, 0.08, x, 2.0, z - L / 2 - 0.04)          # the aisle header
    C.end()
    C.col(x, z, 1.2, L, 1.8, 0, 1)


def shop_build(b, P, R, origin):
    C = MSite(b, P, R, origin, 41)
    GLASS.clear()
    EXTRA.clear()
    rng = C.rng
    cx, cz, w, d = (S_X0 + S_X1) / 2, (S_Z0 + S_Z1) / 2, S_X1 - S_X0, S_Z1 - S_Z0
    # the car park in front: asphalt, a kerb, the walkway to the doors
    C.begin("shop-carpark")
    b.box(P["carpark"], 18.0, 0.02, 9.6, 6.0, 0.0, 10.4)
    b.box(P["pavement"], w + 1.6, 0.06, 1.8, cx, 0.0, S_Z1 + 0.9)
    for (x, ww) in ((-3.0, 0.2), (15.0, 0.2)):
        b.box(P["kerb"], ww, 0.12, 9.6, x, 0.0, 10.4)
    for k in range(5):
        flat(b, P["paint"], -1.0, 0.025, 6.6 + k * 1.1, 3.4, 0.5)            # the zebra to the doors
    C.end()
    C.containers = ("shop-carpark",)
    # the store: plaster box, the front doors and windows, the east roller door,
    # flat roof (box_shed's walls and roof colliders)
    box_shed(C, "shop", cx, cz, w, d, S_H,
             [("s", -1.0, 4.0, 3.2), ("e", -7.6, 3.4, 3.6)],
             [("s", -8.6, 7.0, 0.8, 3.2), ("s", 7.8, 7.0, 0.8, 3.2)], "plaster", "roof", t=0.3, roof_pitch=False)
    C.containers = ("shop-carpark", "shop")
    C.begin("shop-trim", on="shop")
    for (x, ww) in ((-8.6, 7.0), (7.8, 7.0)):                                 # the windows' glass and frames
        b.box(P["shop_trim"], ww + 0.3, 0.15, 0.4, x, 0.65, S_Z1 - 0.05)
        b.box(P["shop_trim"], ww + 0.3, 0.15, 0.4, x, 3.2, S_Z1 - 0.05)
        b.box(P["shopglass"], ww, 2.4, 0.06, x, 0.8, S_Z1 - 0.15)
        for k in range(1, 4):
            b.box(P["shop_trim"], 0.1, 2.4, 0.12, x - ww / 2 + ww * k / 4, 0.8, S_Z1 - 0.12)
    b.box(P["shop_trim"], w + 0.4, 0.5, 0.36, cx, S_H - 0.6, S_Z1 + 0.02)    # the blue band under the roof
    b.box(P["shop_trim"], 4.4, 0.2, 0.4, -1.0, 3.2, S_Z1 - 0.05)              # the door head
    for s in (-1, 1):                                                         # the sliding leaves, open
        b.box(P["shopglass"], 1.2, 3.0, 0.08, -1.0 + s * 2.75, 0.05, S_Z1 - 0.45)
        b.box(P["shop_trim"], 1.3, 0.1, 0.1, -1.0 + s * 2.75, 3.05, S_Z1 - 0.45)
    C.end()
    # the stock room partition (z -5.5) with its doorway at x 4
    PZ = -5.5
    C.begin("stock-wall", on=("shop", "shop-floor"))
    for (x0, x1) in ((S_X0 + 0.3, 3.0), (5.0, S_X1 - 0.3)):
        b.box(P["plaster"], x1 - x0, S_H, 0.2, (x0 + x1) / 2, 0, PZ)
        C.col((x0 + x1) / 2, PZ, x1 - x0, 0.2, S_H, 0, 3)
    b.box(P["plaster"], 2.0, S_H - 2.6, 0.2, 4.0, 2.6, PZ)
    C.col(4.0, PZ, 2.0, 0.2, S_H - 2.6, 2.6, 3)
    for s in (-1, 1):
        b.box(P["shop_trim"], 0.1, 2.6, 0.26, 4.0 + s * 1.05, 0, PZ)
    C.end()
    C.face("door:stock", "stock-wall", (4.0, 1.3, PZ + 0.11), (0, 1), 2.0, 2.6)
    # inside: tile, light strips, three gondola runs, the freezer row, two tills
    C.begin("shop-floor")
    b.box(P["tile"], w - 0.7, 0.02, d - 0.7, cx, 0, cz)
    C.end()
    C.containers = ("shop-carpark", "shop", "shop-floor")
    C.begin("shop-lights")
    for lz in (-3.5, -0.5, 2.5):
        b.box(P["lamp"], w - 4, 0.06, 0.35, cx, S_H - 0.1, lz)
    C.end()
    for k, gx in enumerate((-9.5, -6.0, -2.5, 1.0)):
        gondola(C, f"gondola{k}", gx, -1.6, 5.4, rng)
    C.begin("freezers", on="shop")
    for k in range(4):
        z = -4.3 + k * 1.85
        b.box(P["freezer"], 1.1, 0.9, 1.8, S_X0 + 1.0, 0, z, bevel=0.03)
        b.box(P["ice"], 0.9, 0.04, 1.6, S_X0 + 1.0, 0.9, z)
        for j in range(3):
            b.box(rng.choice([P["can_b"], P["box_d"], P["white"]]), 0.3, 0.12, 0.4, S_X0 + 0.85 + (j % 2) * 0.3, 0.78, z - 0.5 + j * 0.45)
    C.end()
    C.col(S_X0 + 1.0, -1.525, 1.1, 7.35, 0.95, 0, 1)
    for k, tx in enumerate((6.0, 10.0)):
        C.begin(f"till{k}", on="shop")
        b.box(P["wood"], 0.9, 0.95, 3.2, tx, 0, 0.4, bevel=0.03)
        b.box(P["belt"], 0.7, 0.04, 2.0, tx, 0.95, -0.1)
        b.box(P["till"], 0.5, 0.3, 0.4, tx - 0.1, 0.95, 1.5, bevel=0.03)
        b.box(P["screen"], 0.4, 0.28, 0.04, tx - 0.1, 1.3, 1.35, rx=-0.3)
        b.cyl(P["pole"], 0.03, (tx + 0.35, 0.95, 1.8), (tx + 0.35, 2.0, 1.8), seg=6)
        b.box(P["lamp"], 0.3, 0.3, 0.06, tx + 0.35, 2.0, 1.8)
        C.end()
        C.col(tx, 0.4, 0.9, 3.2, 1.0, 0, 1)
    C.loot(-4.25, 0.0, -1.6)
    # the stock room: tall racks of boxes, pallets of drinks, a cage trolley
    for k, rx in enumerate((-11.5, -6.5, 8.5)):
        C.begin(f"stock-rack{k}", on="shop")
        for sx in (-1.9, 1.9):
            for sz in (-0.5, 0.5):
                b.box(P["rack"], 0.08, 3.6, 0.08, rx + sx, 0, -8.2 + sz)
        for y in (0.1, 1.3, 2.5, 3.5):
            b.box(P["rack"], 3.9, 0.06, 1.1, rx, y, -8.2)
            if y < 3.4:
                x = rx - 1.7
                while x < rx + 1.5:
                    s = rng.uniform(0.4, 0.8)
                    b.box(P["crate" if rng.random() < 0.6 else "shrink"], s, rng.uniform(0.4, 0.9), 0.9, x + s / 2, y + 0.06, -8.2)
                    x += s + 0.08
        C.end()
        C.col(rx, -8.2, 3.9, 1.1, 3.6, 0, 1)
    for k, (px, pz) in enumerate(((1.5, -8.0), (3.5, -8.0))):
        C.begin(f"drinks{k}", on="shop")
        b.box(P["wood_dk"], 1.2, 0.14, 1.0, px, 0, pz)
        for j in range(4):
            b.box(P[("can_r", "can_g", "can_b", "can_r")[(j + k) % 4]], 1.1, 0.26, 0.9, px, 0.14 + j * 0.27, pz)
        b.box(P["shrink"], 1.14, 1.1, 0.94, px, 0.14, pz)
        C.end()
        C.col(px, pz, 1.2, 1.0, 1.25, 0, 1)
    C.loot(-1.5, 0.0, -8.0)
    # the roof sign: a black board on legs over the front, past the roofline,
    # marquee bulbs round it (the neon lettering is the map's canvas)
    SW, SY0, SY1, SZ = 15.0, S_ROOF + 0.9, S_ROOF + 6.5, S_Z1 - 0.6
    C.begin("shop-sign", on="shop-roof")
    b.box(P["board"], SW, SY1 - SY0, 0.3, -1.0, SY0, SZ, bevel=0.06)
    for sx in (-5.0, 3.0):
        b.bar(P["pole"], (sx, S_ROOF, SZ - 0.2), (sx, SY0 + 0.4, SZ - 0.2), 0.18)
        b.bar(P["pole"], (sx, S_ROOF, SZ - 2.4), (sx, SY1 - 0.6, SZ - 0.25), 0.14)
    per = 2 * (SW + (SY1 - SY0))
    n = int(per / 0.9)
    for i in range(n):
        t = per * i / n
        if t < SW:
            p = (-1.0 - SW / 2 + t, SY1 - 0.02)
        elif t < SW + (SY1 - SY0):
            p = (-1.0 + SW / 2 - 0.02, SY1 - (t - SW))
        elif t < 2 * SW + (SY1 - SY0):
            p = (-1.0 + SW / 2 - (t - SW - (SY1 - SY0)), SY0 + 0.02)
        else:
            p = (-1.0 - SW / 2 + 0.02, SY0 + (t - 2 * SW - (SY1 - SY0)))
        sphere(b, P["bulb"], (p[0], p[1], SZ + 0.32), 0.2, seg=8, ring=5)
    C.end()
    C.col(-1.0, SZ + 0.15, SW, 0.3, SY1 - SY0, SY0, 3)
    NW, NH = 13.6, 5.4
    EXTRA["neon"] = [round(C.ox - 1.0, 3), round((SY0 + SY1) / 2, 3), round(C.oz + SZ + 0.34, 3), NW, NH]
    C.face("shop-neon", "shop-sign", (-1.0, (SY0 + SY1) / 2, SZ + 0.34), (0, 1), NW, NH)
    # roof: the parapet (open at the stair), AC units, the vent
    C.begin("shop-roof", on="shop")
    for (x, z, ww, dd) in ((cx, S_Z0 - 0.15, w + 0.5, 0.25), (cx, S_Z1 + 0.15, w + 0.5, 0.25), (S_X1 + 0.15, cz, 0.25, d + 0.5)):
        b.box(P["shop_trim"], ww, 0.6, dd, x, S_ROOF, z)
        C.col(x, z, ww, dd, 0.6, S_ROOF, 1)
    b.box(P["shop_trim"], 0.25, 0.6, d - 1.6, S_X0 - 0.15, S_ROOF, cz + 0.8)
    C.col(S_X0 - 0.15, cz + 0.8, 0.25, d - 1.6, 0.6, S_ROOF, 1)
    for (ux, uz, uw, ud) in ((8.0, -7.0, 2.2, 1.6), (-9.0, -7.5, 1.4, 1.4)):
        b.box(P["unit"], uw, 1.1, ud, ux, S_ROOF, uz, bevel=0.05)
        C.col(ux, uz, uw, ud, 1.1, S_ROOF, 1)
    b.cyl(P["unit"], 0.3, (3.0, S_ROOF, -8.0), (3.0, S_ROOF + 1.1, -8.0), seg=10)
    C.end()
    C.loot(-6.0, S_ROOF, -2.0)
    C.loot(9.0, S_ROOF, 0.5)
    # the steel stair up the west wall, from the front corner to the roof
    fire_escape(C, "shop-stair", S_X0 - 0.95, S_Z0 + 0.6, 0, 1, S_ROOF, 0.0, w=1.2)
    C.begin("shop-landing", on="shop-stair")
    b.box(P["steel"], 1.3, 0.1, 1.2, S_X0 - 0.95, S_ROOF - 0.1, S_Z0 + 0.0)
    C.end()
    C.col(S_X0 - 0.95, S_Z0 + 0.0, 1.3, 1.2, 0.1, S_ROOF - 0.1, 1)
    # the loading bay, east: the roller door into the stock room (rolled up),
    # the dock platform south of it with steps at its far end, the canopy
    # over both, pallets of drinks on the dock
    C.begin("loading-bay")
    b.box(P["conc"], 3.4, 1.2, 5.4, S_X1 + 1.9, 0, -2.7, bevel=0.03)
    b.box(P["bollard"], 0.12, 0.12, 5.4, S_X1 + 3.55, 1.08, -2.7)
    for k, h in enumerate((0.9, 0.6, 0.3)):
        b.box(P["conc"], 3.4, h, 0.5, S_X1 + 1.9, 0, 0.25 + k * 0.5)
    b.box(P["roof"], 4.4, 0.12, 11.6, S_X1 + 2.2, 4.4, -4.2)
    for pz in (-9.6, 1.2):
        b.cyl(P["steel"], 0.07, (S_X1 + 4.1, 0.0, pz), (S_X1 + 4.1, 4.4, pz), seg=6)
    b.box(P["steel"], 0.3, 0.5, 3.4, S_X1 + 0.2, 3.6, -7.6)                  # the roller door, rolled up
    C.end()
    C.col(S_X1 + 1.9, -2.7, 3.4, 5.4, 1.2, 0, 3)
    for k, h in enumerate((0.9, 0.6, 0.3)):
        C.col(S_X1 + 1.9, 0.25 + k * 0.5, 3.4, 0.5, h, 0, 3)
    C.col(S_X1 + 2.2, -4.2, 4.4, 11.6, 0.12, 4.4, 3)
    for pz in (-9.6, 1.2):
        C.col(S_X1 + 4.1, pz, 0.16, 0.16, 4.4, 0, 1)
    for k, pz in enumerate((-4.4, -2.6)):
        C.begin(f"dock-pallet{k}", on="loading-bay")
        b.box(P["wood_dk"], 1.2, 0.14, 1.0, S_X1 + 2.6, 1.2, pz)
        for j in range(3):
            b.box(P[("can_g", "can_r", "can_b")[j]], 1.0, 0.25, 0.85, S_X1 + 2.6, 1.36 + j * 0.28, pz)
        b.box(P["shrink"], 1.1, 0.9, 0.9, S_X1 + 2.6, 1.34, pz)
        C.end()
        C.col(S_X1 + 2.6, pz, 1.2, 1.0, 1.05, 1.2, 1)
    C.loot(S_X1 + 1.3, 1.2, -1.0)
    # out front: bollards, the trolley bay, the cash machine, posters, bins,
    # a parked car, lamp posts
    for k, bx in enumerate((-4.6, 2.6, 12.0)):
        C.begin(f"bollard{k}")
        b.cyl(P["bollard"], 0.16, (bx, 0, S_Z1 + 2.0), (bx, 1.0, S_Z1 + 2.0), seg=10)
        b.cyl(P["ink"], 0.17, (bx, 0.75, S_Z1 + 2.0), (bx, 0.85, S_Z1 + 2.0), seg=10)
        C.end()
        C.col(bx, S_Z1 + 2.0, 0.32, 0.32, 1.0, 0, 1)
    TX, TZ0, TZ1 = 16.8, 6.4, 12.4                                           # the trolley bay, by the car park
    C.begin("trolley-bay")
    for s_ in (-1, 1):
        x = TX + s_ * 0.6
        b.bar(P["steel"], (x, 0.0, TZ0), (x, 0.0, TZ1), 0.06)
        b.bar(P["steel"], (x, 1.0, TZ0), (x, 1.0, TZ1), 0.06)
        for z in (TZ0, TZ1):
            b.cyl(P["steel"], 0.04, (x, 0, z), (x, 1.0, z), seg=6)
    b.box(P["roof"], 1.6, 0.08, TZ1 - TZ0 + 0.4, TX, 2.2, (TZ0 + TZ1) / 2)
    for z in (TZ0, TZ1):
        b.cyl(P["steel"], 0.05, (TX, 1.0, z), (TX, 2.2, z), seg=6)
    for k in range(6):                                                        # the trolleys, nested
        z = TZ0 + 0.6 + k * 0.62
        b.box(P["trolley"], 0.9, 0.5, 0.56, TX, 0.35, z)
        b.bar(P["trolley"], (TX - 0.4, 1.0, z - 0.28), (TX + 0.4, 1.0, z - 0.28), 0.04)
    C.end()
    for s_ in (-1, 1):
        C.col(TX + s_ * 0.6, (TZ0 + TZ1) / 2, 0.12, TZ1 - TZ0, 1.0, 0, 1)
    C.begin("cash-machine", on="shop-trim")
    b.box(P["atm"], 1.0, 2.0, 0.3, -13.3, 0.2, S_Z1 + 0.15)
    b.box(P["screen"], 0.5, 0.35, 0.03, -13.3, 1.35, S_Z1 + 0.31)
    b.box(P["ink"], 0.6, 0.1, 0.08, -13.3, 1.0, S_Z1 + 0.33)
    C.end()
    C.col(-13.3, S_Z1 + 0.15, 1.0, 0.3, 2.2, 0, 1)
    C.face("cash-machine", "cash-machine", (-13.3, 1.4, S_Z1 + 0.32), (0, 1), 0.8, 1.2)
    C.begin("shop-posters", on="shop-trim")
    poster(C, "poster_y", (-12.0, 4.6, S_Z1 + 0.03), (0, 1), (1, 0), 1.2, 1.6)
    poster(C, "poster_r", (12.6, 4.6, S_Z1 + 0.03), (0, 1), (1, 0), 1.2, 1.6)
    C.end()
    bin_(C, "shop-bin0", -3.6, S_Z1 + 1.0)
    bin_(C, "shop-bin1", 3.8, S_Z1 + 1.0)
    lamp_post(C, "shop-lamp0", 0.6, 15.5, math.pi / 2)
    lamp_post(C, "shop-lamp1", 14.0, 15.5, math.pi / 2)
    b.finish("tf-shop-p4.glb")


# ============================================================== MEME LAB

LAB_N = (0.6, 0.8)                                  # the swirl faces south-east (the road)
LAB_RY = math.atan2(LAB_N[0], LAB_N[1])              # three.js rotateY of the swirl's circle
LAB_C = Vector((1.5, 1.32 + 6.7, -2.0))              # the ring's centre
LAB_U = Vector((math.cos(LAB_RY), 0.0, -math.sin(LAB_RY)))
LAB_V = Vector((0.0, 1.0, 0.0))
DECK = (-6.0, 9.5, -8.0, 2.6, 1.32)                  # x0, x1, z0, z1, top
LB = (-15.0, -3.0, 3.4, 13.4)                        # the lab: x0, x1, z0, z1
LB_F, LB_H = 3.6, 7.2                                # the upper floor, the roof


def arc(b, m, a, c, rng, n=5, amp=0.35, w=0.05):
    a, c = Vector(a), Vector(c)
    pts = [a]
    for i in range(1, n):
        t = i / n
        p = a.lerp(c, t) + Vector((rng.uniform(-amp, amp), rng.uniform(-amp, amp), rng.uniform(-amp, amp)))
        pts.append(p)
    pts.append(c)
    for p, q in zip(pts, pts[1:]):
        b.bar(m, p, q, w)


def desk(C, pid, x, z, y, ry, rng, on=None):
    """A lab desk with two monitors, a keyboard, a swivel chair."""
    b, P = C.b, C.P
    c, s = math.cos(ry), math.sin(ry)
    L = lambda lx, lz: (x + lx * c + lz * s, z - lx * s + lz * c)      # noqa: E731
    C.begin(pid, on)
    b.box(P["desk"], 1.8, 0.05, 0.8, x, y + 0.72, z, ry=ry)
    for lx in (-0.82, 0.82):
        px, pz = L(lx, 0)
        b.box(P["lab_post"], 0.06, 0.72, 0.7, px, y, pz, ry=ry)
    for lx in (-0.42, 0.42):
        px, pz = L(lx, -0.22)
        b.box(P["monitor"], 0.62, 0.4, 0.04, px, y + 0.95, pz, ry=ry)
        qx, qz = L(lx, -0.2)
        b.box(P["mon_glow"], 0.56, 0.34, 0.01, qx, y + 0.98, qz, ry=ry)
        b.box(P["lab_post"], 0.05, 0.2, 0.05, px, y + 0.77, pz, ry=ry)
    kx, kz = L(0, 0.12)
    b.box(P["monitor"], 0.5, 0.02, 0.16, kx, y + 0.77, kz, ry=ry)
    ch = L(0.1, 0.75)
    b.cyl(P["chair"], 0.25, (ch[0], y, ch[1]), (ch[0], y + 0.06, ch[1]), seg=8)
    b.cyl(P["lab_post"], 0.03, (ch[0], y, ch[1]), (ch[0], y + 0.45, ch[1]), seg=6)
    b.box(P["chair"], 0.5, 0.08, 0.5, ch[0], y + 0.45, ch[1], ry=ry + rng.uniform(-0.4, 0.4))
    bk = L(0.1, 0.98)
    b.box(P["chair"], 0.48, 0.5, 0.06, bk[0], y + 0.53, bk[1], ry=ry)
    C.end()
    C.col(x, z, abs(1.8 * c) + abs(0.8 * s), abs(1.8 * s) + abs(0.8 * c), 0.77, y, 1)


def whiteboard(C, pid, c, n, u, w=2.4, h=1.2, on=None):
    b, P = C.b, C.P
    C.begin(pid, on)
    quad(b, P["lab_post"], (c[0] + n[0] * 0.01, c[1], c[2] + n[1] * 0.01), n, u, w + 0.1, h + 0.1)
    quad(b, P["whiteboard"], (c[0] + n[0] * 0.02, c[1], c[2] + n[1] * 0.02), n, u, w, h)
    for k in range(4):                                                         # scribbles: boxes and arrows
        o = -w / 2 + 0.3 + k * (w - 0.6) / 3
        quad(b, P["marker"], (c[0] + n[0] * 0.03 + u[0] * o, c[1] + 0.2 - (k % 2) * 0.35, c[2] + n[1] * 0.03 + u[1] * o), n, u, 0.4, 0.04)
        quad(b, P["marker"], (c[0] + n[0] * 0.03 + u[0] * o, c[1] + 0.2 - (k % 2) * 0.35 - 0.12, c[2] + n[1] * 0.03 + u[1] * o), n, u, 0.25, 0.04)
    C.end()


def lab_walls(C):
    """The lab's two-storey shell: steel posts every ~2 m, a sill, the floor
    band, the roof band, glass between (the map's). Doors: east to the deck,
    south to the road; colliders full height, open at the doors."""
    b, P = C.b, C.P
    x0, x1, z0, z1 = LB
    doors = {"e": [(8.0, 1.8)], "s": [(-11.0, 1.8)]}
    sides = (("n", (x0, z0), (x1, z0), (0, -1)), ("s", (x0, z1), (x1, z1), (0, 1)), ("w", (x0, z0), (x0, z1), (-1, 0)), ("e", (x1, z0), (x1, z1), (1, 0)))
    C.begin("lab")
    b.box(P["lab_wall"], x1 - x0, 0.3, z1 - z0, (x0 + x1) / 2, -0.25, (z0 + z1) / 2)
    b.box(P["tile"], x1 - x0 - 0.2, 0.06, z1 - z0 - 0.2, (x0 + x1) / 2, 0.0, (z0 + z1) / 2)
    for (side, a, c, out) in sides:
        horiz = side in ("n", "s")
        L = abs((c[0] - a[0]) if horiz else (c[1] - a[1]))
        lo = a[0] if horiz else a[1]
        gaps = [(at - wd / 2, at + wd / 2) for (at, wd) in doors.get(side, [])]
        n = max(2, round(L / 2.0))
        for i in range(n + 1):
            t = lo + L * i / n
            if any(g0 - 0.1 < t < g1 + 0.1 for g0, g1 in gaps):
                continue
            px, pz = (t, a[1]) if horiz else (a[0], t)
            b.box(P["lab_post"], 0.16, LB_H, 0.16, px, 0, pz)
        cur = lo                                                            # the sill, stopping at doors
        for (g0, g1) in sorted(gaps) + [(lo + L, lo + L)]:
            if g0 - cur > 0.05:
                m = (cur + g0) / 2
                if horiz:
                    b.box(P["lab_wall"], g0 - cur, 0.4, 0.24, m, 0.0, a[1])
                else:
                    b.box(P["lab_wall"], 0.24, 0.4, g0 - cur, a[0], 0.0, m)
            cur = g1
        for (y, hh) in ((LB_F - 0.3, 0.6), (LB_H - 0.3, 0.4)):              # the floor band, the roof band
            if horiz:
                b.box(P["lab_wall"], L, hh, 0.24, lo + L / 2, y, a[1])
            else:
                b.box(P["lab_wall"], 0.24, hh, L, a[0], y, lo + L / 2)
        # glass: below the floor band and above it, between the gaps
        cur = lo
        for (g0, g1) in sorted(gaps) + [(lo + L, lo + L)]:
            if g0 - cur > 0.1:
                for (gy0, gy1) in ((0.4, LB_F - 0.3), (LB_F + 0.3, LB_H - 0.3)):
                    if horiz:
                        glass(C, cur, a[1] + out[1] * 0.02, g0, a[1] + out[1] * 0.02, gy0, gy1, out)
                    else:
                        glass(C, a[0] + out[0] * 0.02, cur, a[0] + out[0] * 0.02, g0, gy0, gy1, out)
            if g1 > g0:                                                     # over a door: glass up to the band
                if horiz:
                    glass(C, g0, a[1] + out[1] * 0.02, g1, a[1] + out[1] * 0.02, LB_F + 0.3, LB_H - 0.3, out)
                    glass(C, g0, a[1] + out[1] * 0.02, g1, a[1] + out[1] * 0.02, 2.4, LB_F - 0.3, out)
                else:
                    glass(C, a[0] + out[0] * 0.02, g0, a[0] + out[0] * 0.02, g1, LB_F + 0.3, LB_H - 0.3, out)
                    glass(C, a[0] + out[0] * 0.02, g0, a[0] + out[0] * 0.02, g1, 2.4, LB_F - 0.3, out)
            cur = g1
        # colliders: the wall to the roof, open at the doors up to 2.4
        cur = lo
        for (g0, g1) in sorted(gaps) + [(lo + L, lo + L)]:
            if g0 - cur > 0.05:
                if horiz:
                    C.col((cur + g0) / 2, a[1], g0 - cur, 0.24, LB_H, 0, 3)
                else:
                    C.col(a[0], (cur + g0) / 2, 0.24, g0 - cur, LB_H, 0, 3)
            if g1 > g0:
                if horiz:
                    C.col((g0 + g1) / 2, a[1], g1 - g0, 0.24, LB_H - 2.4, 2.4, 3)
                else:
                    C.col(a[0], (g0 + g1) / 2, 0.24, g1 - g0, LB_H - 2.4, 2.4, 3)
            cur = g1
    # the roof slab, its rim, the solar panel on it
    b.box(P["lab_ring_dk"], x1 - x0 + 0.4, 0.3, z1 - z0 + 0.4, (x0 + x1) / 2, LB_H, (z0 + z1) / 2)
    C.col((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.4, z1 - z0 + 0.4, 0.3, LB_H, 3)
    b.box(P["panel_frame"], 7.0, 0.16, 4.4, (x0 + x1) / 2, LB_H + 1.0, (z0 + z1) / 2, rx=-0.35)
    for i in range(6):
        for j in range(3):
            lz = -2.1 + (j + 0.5) * 4.2 / 3
            b.box(P["panel_cell"], 6.8 / 6 - 0.07, 0.04, 4.2 / 3 - 0.07, (x0 + x1) / 2 - 3.4 + (i + 0.5) * 6.8 / 6,
                  LB_H + 1.08 + lz * math.sin(0.35), (z0 + z1) / 2 + lz * math.cos(0.35), rx=-0.35)
    for sx in (-2.8, 2.8):
        b.box(P["lab_ring_dk"], 0.2, 1.0, 0.2, (x0 + x1) / 2 + sx, LB_H + 0.3, (z0 + z1) / 2)
    C.end()
    for side, at, wd, n in (("e", 8.0, 1.8, (1, 0)), ("s", -11.0, 1.8, (0, 1))):
        c = (x1 + 0.13, 1.2, at) if side == "e" else (at, 1.2, z1 + 0.13)
        C.face(f"door:lab-{side}", "lab", c, n, wd, 2.4)


def lab_upper(C, rng):
    """The upper floor: the slab with the stair well, the stair, the rail
    round the well, desks, a whiteboard, cable spaghetti, the coffee bar."""
    b, P = C.b, C.P
    x0, x1, z0, z1 = LB
    WX0, WX1, WZ1 = -12.0, -5.5, 4.9                    # the stair well: x, and z from the north wall
    C.begin("lab-floor2", on="lab")
    for (ax, bx, az, bz) in ((x0 + 0.12, x1 - 0.12, WZ1, z1 - 0.12), (x0 + 0.12, WX0, z0 + 0.12, WZ1), (WX1, x1 - 0.12, z0 + 0.12, WZ1)):
        b.box(P["lab_deck"], bx - ax, 0.25, bz - az, (ax + bx) / 2, LB_F - 0.25, (az + bz) / 2)
        C.col((ax + bx) / 2, (az + bz) / 2, bx - ax, bz - az, 0.25, LB_F - 0.25, 3)
    C.end()
    C.begin("lab-stair", on=("lab", "lab-floor2"))
    stairs(C, P["lab_step"], WX0, (z0 + WZ1) / 2, 1, 0, 0.0, LB_F, 1.4)
    C.end()
    rail_run(C, "lab-well-rail", [(WX0 + 0.6, WZ1), (WX1, WZ1), (WX1, z0 + 0.2)], LB_F, on="lab")
    for k, (dx, dz, ry) in enumerate(((-12.0, 7.4, 0.0), (-8.0, 7.4, 0.0), (-12.0, 10.6, math.pi), (-8.0, 10.6, math.pi))):
        desk(C, f"lab-desk-up{k}", dx, dz, LB_F, ry, rng, on="lab")
    whiteboard(C, "lab-board-up", (-9.0, LB_F + 1.6, z1 - 0.14), (0, -1), (-1, 0), on="lab")
    C.begin("lab-coffee", on="lab")
    b.box(P["wood"], 0.7, 1.0, 2.4, x1 - 0.5, LB_F, 9.6)
    b.box(P["monitor"], 0.45, 0.6, 0.4, x1 - 0.5, LB_F + 1.0, 9.0, bevel=0.03)          # the coffee machine
    b.box(P["chrome"], 0.2, 0.08, 0.1, x1 - 0.72, LB_F + 1.25, 9.0)
    for k in range(3):
        b.cyl(P["mug"], 0.05, (x1 - 0.55, LB_F + 1.0, 9.8 + k * 0.25), (x1 - 0.55, LB_F + 1.11, 9.8 + k * 0.25), seg=8)
    C.end()
    C.col(x1 - 0.5, 9.6, 0.7, 2.4, 1.0, LB_F, 1)
    C.begin("lab-spaghetti", on="lab")
    for k in range(9):                                                          # cables across the ceiling and down
        a = (rng.uniform(x0 + 1, x1 - 1), LB_H - 0.35, rng.uniform(WZ1 + 0.5, z1 - 1))
        c = (a[0] + rng.uniform(-3, 3), LB_H - 0.35, a[2] + rng.uniform(-2, 2))
        mid = ((a[0] + c[0]) / 2, LB_H - 0.35 - rng.uniform(0.3, 0.8), (a[2] + c[2]) / 2)
        m = P[("cable", "paint_r", "paint_y", "paint_b")[k % 4]]
        b.bar(m, a, mid, 0.04)
        b.bar(m, mid, c, 0.04)
    C.end()
    C.loot(-6.0, LB_F, 11.5)
    C.loot(-13.5, LB_F, 5.8)


def lab_ground(C, rng):
    """The ground floor: server racks along the west wall, the bench with
    the centrifuge and the specimen jars, two desks, filing cabinets, a
    whiteboard."""
    b, P = C.b, C.P
    x0, x1, z0, z1 = LB
    C.begin("servers", on="lab")
    for k in range(3):
        z = 6.2 + k * 1.0
        b.box(P["server"], 0.9, 2.1, 0.9, x0 + 0.65, 0, z)
        for j in range(8):
            b.box(P["server_led"], 0.02, 0.03, 0.5, x0 + 1.11, 0.3 + j * 0.22, z - 0.1 + (j % 3) * 0.1)
    C.end()
    C.col(x0 + 0.65, 7.2, 0.9, 3.0, 2.1, 0, 1)
    C.begin("lab-bench", on="lab")
    b.box(P["desk"], 4.2, 0.95, 0.8, -9.0, 0, z1 - 0.6)
    b.cyl(P["chrome"], 0.28, (-10.4, 0.95, z1 - 0.6), (-10.4, 1.35, z1 - 0.6), seg=14)          # the centrifuge
    b.cyl(P["lab_glow"], 0.2, (-10.4, 1.35, z1 - 0.6), (-10.4, 1.4, z1 - 0.6), seg=14)
    for k in range(5):                                                                    # specimen jars
        jx = -9.2 + k * 0.5
        b.cyl(P["jar"], 0.14, (jx, 0.95, z1 - 0.6), (jx, 1.35, z1 - 0.6), seg=10)
        sphere(b, P["white"], (jx, 1.12, z1 - 0.6), 0.08, seg=8, ring=5)
        b.cyl(P["lab_post"], 0.15, (jx, 1.35, z1 - 0.6), (jx, 1.4, z1 - 0.6), seg=10)
    C.end()
    C.col(-9.0, z1 - 0.6, 4.2, 0.8, 1.0, 0, 1)
    desk(C, "lab-desk0", -8.0, 7.2, 0.0, 0.0, rng, on="lab")
    desk(C, "lab-desk1", -5.6, 10.2, 0.0, math.pi / 2, rng, on="lab")
    C.begin("cabinets", on="lab")
    for k in range(2):
        b.box(P["lab_post"], 0.6, 1.3, 0.6, x1 - 0.5, 0, 11.2 + k * 0.65, bevel=0.02)
        for j in range(3):
            b.box(P["chrome"], 0.2, 0.04, 0.02, x1 - 0.81, 0.3 + j * 0.4, 11.2 + k * 0.65)
    C.end()
    C.col(x1 - 0.5, 11.52, 0.6, 1.3, 1.3, 0, 1)
    whiteboard(C, "lab-board", (x0 + 0.14, 1.6, 10.5), (1, 0), (0, -1), on="lab")
    C.loot(-6.5, 0.0, 5.0)


def lab_ring(C, rng):
    """The portal ring on its deck (the old build's, turned to the road):
    the slate tube, its lip, four cuffs, the clamp, the orbs and sparks;
    the deck with hazard edging, stairs west and south."""
    b, P = C.b, C.P
    dx0, dx1, dz0, dz1, top = DECK
    cx, cz = (dx0 + dx1) / 2, (dz0 + dz1) / 2
    C.begin("lab-deck")
    b.box(P["lab_side"], dx1 - dx0, top - 0.12, dz1 - dz0, cx, 0, cz, bevel=0.06)
    b.box(P["lab_deck"], dx1 - dx0 + 0.1, 0.13, dz1 - dz0 + 0.1, cx, top - 0.12, cz, bevel=0.04)
    x = dx0 + 0.25
    i = 0
    while x < dx1 - 0.2:
        for zz in (dz0 + 0.17, dz1 - 0.17):
            if zz > cz and abs(x - 3.0) < 1.3:
                continue
            b.box(P["hazard"] if i % 2 else P["ink"], 0.5, 0.02, 0.3, x, top + 0.01, zz)
        x += 0.5
        i += 1
    for (x, z, w, d) in ((cx, dz0 - 0.07, dx1 - dx0 - 0.4, 0.04), (cx, dz1 + 0.07, dx1 - dx0 - 0.4, 0.04), (dx0 - 0.07, cz, 0.04, dz1 - dz0 - 0.4), (dx1 + 0.07, cz, 0.04, dz1 - dz0 - 0.4)):
        b.box(P["lab_glow"], w, 0.1, d, x, 0.25, z)
    C.end()
    C.col(cx, cz, dx1 - dx0, dz1 - dz0, top, 0, 3)
    stairs(C, P["lab_step"], 3.0, dz1, 0, 1, 0.0, top, 2.4)
    stairs(C, P["lab_step"], dx0, -2.0, -1, 0, 0.0, top, 2.4)
    c, u, v = LAB_C, LAB_U, LAB_V
    n = u.cross(v)
    C.begin("lab-ring", on="lab-deck")
    torus(b, P["lab_ring"], c, 6.0, 0.7, u, v, seg=60, tseg=12)
    torus(b, P["lab_ring_dk"], c, 5.32, 0.16, u, v, seg=60, tseg=6)
    for deg in (68, 160, 232, 352):
        th = math.radians(deg)
        p = c + (u * math.cos(th) + v * math.sin(th)) * 6.0
        t = -u * math.sin(th) + v * math.cos(th)
        b.cyl(P["cuff"], 0.98, p - t * 0.62, p + t * 0.62, seg=18)
        for s in (-1, 1):
            b.cyl(P["ink"], 1.01, p + t * (s * 0.62 - 0.07), p + t * (s * 0.62 + 0.07), seg=18)
    foot = c + Vector((0, -6.7, 0))
    b.box(P["lab_ring_dk"], 2.4, 1.4, 1.1, foot.x, top, foot.z, ry=LAB_RY, bevel=0.1)
    for i in range(6):
        a = i / 6 * 2 * math.pi
        dd = u * math.cos(a) + v * math.sin(a)
        p = c + dd * 7.6
        if p.y < top + 0.6:
            continue
        sphere(b, P["orb"], p, 0.45, seg=16, ring=10)
        for s in (-1, 1):
            sphere(b, P["orb_core"], p + n * s * 0.36, 0.17, seg=10, ring=6)
        arc(b, P["arc"], p - dd * 0.45, c + dd * 6.75, rng, n=4, amp=0.3, w=0.05)
    C.end()
    C.col(foot.x, foot.z, 2.4, 1.6, 1.4, top, 3)
    EXTRA["swirl"] = [round(C.ox + c.x, 3), round(c.y, 3), round(C.oz + c.z, 3), 5.3, round(LAB_RY, 4)]
    C.face("memelab-swirl", "lab-ring", (c.x + n.x * 0.02, c.y, c.z + n.z * 0.02), (n.x, n.z), 10.6, 10.6)
    for (x, z) in ((dx0 + 0.6, dz0 + 0.6), (dx1 - 0.6, dz0 + 0.6), (dx0 + 0.6, dz1 - 0.6), (dx1 - 0.6, dz1 - 0.6)):
        C.begin(f"lab-light{int(x > 0)}{int(z > 0)}", on="lab-deck")
        b.cyl(P["lab_glow"], 0.18, (x, top, z), (x, top + 0.12, z), seg=10)
        C.end()
    C.loot(-3.5, top, 2.5)


def lab_build(b, P, R, origin):
    C = MSite(b, P, R, origin, 11)
    GLASS.clear()
    EXTRA.clear()
    rng = C.rng
    lab_ring(C, rng)
    lab_walls(C)
    lab_ground(C, rng)
    lab_upper(C, rng)
    b.finish("tf-memelab-p4.glb")


# ============================================================== THE GALLERY

G_HALF, G_WALL, G_APEX = 13.0, 3.4, 18.0          # the pyramid (the map's glass cone sits on the band)
G_DOORS = {"s": [(0.0, 3.4)], "n": [(0.0, 3.4)], "e": [(0.0, 3.6)], "w": [(0.0, 3.6)]}     # e/w: the halls' 3 m doors with the frames clear of them
WING = (13.4, 20.0, -9.0, 9.0, 4.4)                 # the east hall: x0, x1, z0, z1, wall (the west mirrors it)


def band(C):
    """The pyramid's glass band: posts, sill and head beam (the glass the
    map's), its colliders, the four door frames."""
    b, P = C.b, C.P
    sides = (("s", 0, G_HALF, (0, 1)), ("n", 0, -G_HALF, (0, -1)), ("e", G_HALF, 0, (1, 0)), ("w", -G_HALF, 0, (-1, 0)))
    C.begin("gallery")
    for (side, sx, sz, out) in sides:
        horiz = side in ("n", "s")
        gaps = [(at - wd / 2, at + wd / 2) for (at, wd) in G_DOORS[side]]
        cur = -G_HALF
        for (g0, g1) in gaps + [(G_HALF, G_HALF)]:
            if g0 - cur > 0.05:
                L = g0 - cur
                m = (cur + g0) / 2
                n = max(1, round(L / 2.6))
                for i in range(n + 1):
                    o = cur + L * i / n
                    px, pz = (o, sz) if horiz else (sx, o)
                    b.box(P["frame"], 0.16 if horiz else 0.5, G_WALL, 0.5 if horiz else 0.16, px, 0, pz)
                b.box(P["frame"], L if horiz else 0.5, 0.18, 0.5 if horiz else L, m if horiz else sx, 0, sz if horiz else m)
                b.box(P["frame_dk"], L if horiz else 0.6, 0.3, 0.6 if horiz else L, m if horiz else sx, G_WALL - 0.3, sz if horiz else m)
                if horiz:
                    glass(C, cur, sz + out[1] * 0.02, g0, sz + out[1] * 0.02, 0.18, G_WALL - 0.3, out)
                    C.col(m, sz, L, 0.4, G_WALL, 0, 3)
                else:
                    glass(C, sx + out[0] * 0.02, cur, sx + out[0] * 0.02, g0, 0.18, G_WALL - 0.3, out)
                    C.col(sx, m, 0.4, L, G_WALL, 0, 3)
            if g1 > g0:                                                   # the door: frame, head over it
                for s in (-1, 1):
                    px, pz = (g0 if s < 0 else g1, sz) if horiz else (sx, g0 if s < 0 else g1)
                    b.box(P["frame_dk"], 0.3 if horiz else 0.7, G_WALL, 0.7 if horiz else 0.3, px, 0, pz)
                b.box(P["frame_dk"], (g1 - g0) if horiz else 0.6, 0.3, 0.6 if horiz else (g1 - g0), (g0 + g1) / 2 if horiz else sx, G_WALL - 0.3, sz if horiz else (g0 + g1) / 2)
            cur = g1
    # the pyramid's frame: four ridges, two heavy bands, a fine diamond lattice
    base = [(-G_HALF, G_HALF), (G_HALF, G_HALF), (G_HALF, -G_HALF), (-G_HALF, -G_HALF)]
    apex = Vector((0, G_APEX, 0))
    for (x, z) in base:
        b.bar(P["frame_dk"], (x, G_WALL, z), apex, 0.34)
    for k in range(4):
        A = Vector((base[k][0], G_WALL, base[k][1]))
        B = Vector((base[(k + 1) % 4][0], G_WALL, base[(k + 1) % 4][1]))
        nrm = (B - A).cross(apex - A).normalized()
        if nrm.dot(Vector(((A.x + B.x) / 2, 0, (A.z + B.z) / 2))) < 0:
            nrm = -nrm
        off = nrm * 0.06
        b.bar(P["frame_dk"], A + off, B + off, 0.3)
        for f in (1 / 3, 2 / 3):
            b.bar(P["frame_dk"], A.lerp(apex, f) + off, B.lerp(apex, f) + off, 0.22)
        N = 8
        for i in range(1, N):
            t = i / N
            P0 = A.lerp(B, t)
            b.bar(P["frame"], P0 + off, (B * t + apex * (1 - t)) + off, 0.06)
            b.bar(P["frame"], P0 + off, (A * (1 - t) + apex * t) + off, 0.06)
    sphere(b, P["gold"], (0, G_APEX + 0.25, 0), 0.4)
    b.box(P["marble"], 2 * G_HALF - 1.0, 0.03, 2 * G_HALF - 1.0, 0, 0, 0)
    C.end()
    for (side, at, wd, n) in (("s", 0.0, 3.4, (0, 1)), ("n", 0.0, 3.4, (0, -1))):
        zz = G_HALF + 0.36 if side == "s" else -G_HALF - 0.36
        C.face(f"door:gallery-{side}", "gallery", (at, 1.5, zz), n, wd, 3.0)


def frame_art(C, c, n, u, w, h, rng):
    """A framed 'meme' on a wall: a gilt frame, a canvas, two or three
    blocks of colour (a rage-comic grid now and then)."""
    b, P = C.b, C.P
    def at(du, dv, dn):
        return (c[0] + u[0] * du + n[0] * dn, c[1] + dv, c[2] + u[1] * du + n[1] * dn)
    quad(b, P["gold"], at(0, 0, 0.02), n, u, w + 0.16, h + 0.16)
    quad(b, P["canvas"], at(0, 0, 0.03), n, u, w, h)
    if rng.random() < 0.35:                                                # four panels
        for i in range(2):
            for j in range(2):
                quad(b, P["ink"], at((i - 0.5) * w / 2, (j - 0.5) * h / 2, 0.035), n, u, w / 2 - 0.08, h / 2 - 0.08)
                quad(b, P["white"], at((i - 0.5) * w / 2, (j - 0.5) * h / 2, 0.04), n, u, w / 2 - 0.14, h / 2 - 0.14)
    else:
        for k in range(rng.randint(2, 3)):
            m = P[rng.choice(("art_red", "art_blue", "gold", "paint_g", "paint_p"))]
            quad(b, m, at(rng.uniform(-w / 4, w / 4), rng.uniform(-h / 4, h / 4), 0.035 + k * 0.004), n, u, rng.uniform(w * 0.2, w * 0.5), rng.uniform(h * 0.2, h * 0.5))


def rope_line(C, pid, pts, on=None):
    """Brass posts with a red rope sagging between."""
    b, P = C.b, C.P
    C.begin(pid, on)
    for (x, z) in pts:
        b.cyl(P["brass"], 0.05, (x, 0, z), (x, 0.95, z), seg=8)
        b.cyl(P["brass"], 0.18, (x, 0, z), (x, 0.05, z), seg=10)
        sphere(b, P["brass"], (x, 1.0, z), 0.08, seg=8, ring=5)
    for (ax, az), (cx, cz) in zip(pts, pts[1:]):
        mid = ((ax + cx) / 2, 0.68, (az + cz) / 2)
        b.bar(P["rope"], (ax, 0.92, az), mid, 0.05)
        b.bar(P["rope"], mid, (cx, 0.92, cz), 0.05)
    C.end()


def wing(C, pid, s, rng):
    """One hall: s = 1 east, -1 west. Walls, flat roof, the door from the
    lobby and one out (offset, no straight lane through the building),
    framed memes, two bust plinths, a bench, ropes, the spot track."""
    b, P = C.b, C.P
    x0, x1, z0, z1, H = WING
    cx, cz, w, d = s * (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0
    inner, outer = ("w", "e") if s > 0 else ("e", "w")
    out_z = 6.0 * s
    C.containers = ("gallery",)
    box_shed(C, pid, cx, cz, w, d, H, [(inner, 0.0, 3.0, 3.0), (outer, out_z, 2.0, 2.6)], [], "hall_wall", "roof", t=0.3, roof_pitch=False)
    C.begin(f"{pid}-floor", on=pid)
    b.box(P["marble"], w - 0.7, 0.03, d - 0.7, cx, 0.03, cz)
    C.end()
    C.containers = ("gallery", pid, f"{pid}-floor")
    xo, xi = s * (x1 - 0.17), s * (x0 + 0.17)                               # the outer and inner walls' faces
    C.begin(f"{pid}-art", on=pid)
    for k, zz in enumerate((-6.5, -2.2, 2.2, 6.5)):
        if abs(zz - out_z) > 2.0:
            frame_art(C, (xo, 2.1, zz), (-s, 0), (0, s), rng.uniform(1.6, 2.4), rng.uniform(1.2, 1.7), rng)
        if abs(zz) > 2.4:
            frame_art(C, (xi, 2.1, zz), (s, 0), (0, -s), rng.uniform(1.4, 2.0), rng.uniform(1.0, 1.5), rng)
    for zz in (z0 + 0.17, z1 - 0.17):                                       # the end walls: one big piece each
        n = (0, 1) if zz < 0 else (0, -1)
        frame_art(C, (cx, 2.2, zz), n, (-n[1], 0), 3.2, 2.0, rng)
    C.end()
    busts = []
    for k, zz in enumerate((-4.5, 4.5)):
        C.begin(f"{pid}-plinth{k}", on=(pid, f"{pid}-floor"))
        b.box(P["white"], 1.2, 1.1, 1.2, cx, 0, zz, bevel=0.04)
        b.box(P["frame_dk"], 1.3, 0.08, 1.3, cx, 0, zz)
        C.end()
        C.col(cx, zz, 1.2, 1.2, 1.1, 0, 1)
        busts.append([round(C.ox + cx, 3), 1.1, round(C.oz + zz, 3), round(-math.pi / 2 * s, 4), 0.55])
    bench(C, f"{pid}-bench", cx, 0.0, math.pi / 2)
    C.col(cx, 0.0, 0.5, 1.8, 0.9, 0, 1)
    rope_line(C, f"{pid}-rope0", [(xo - s * 1.0, -8.2), (xo - s * 1.0, -3.6)], on=(pid, f"{pid}-floor"))
    rope_line(C, f"{pid}-rope1", [(xo - s * 1.0, 3.6), (xo - s * 1.0, 4.4)] if abs(out_z) < 9 else [(xo - s * 1.0, 3.6), (xo - s * 1.0, 8.2)], on=(pid, f"{pid}-floor"))
    C.begin(f"{pid}-spots", on=pid)
    b.bar(P["frame_dk"], (cx, H - 0.25, z0 + 1.0), (cx, H - 0.25, z1 - 1.0), 0.1)
    for k in range(5):
        zz = z0 + 2.0 + k * (d - 4.0) / 4
        for side in (-1, 1):
            head = Vector((cx, H - 0.5, zz))
            aim = Vector((side * 1.0, -0.8, 0.0)).normalized()
            b.cyl(P["frame_dk"], 0.12, head, head + aim * 0.35, seg=10)
            b.cyl(P["spot"], 0.1, head + aim * 0.35, head + aim * 0.37, seg=10)
    C.end()
    C.containers = ()
    return busts


def gallery_build(b, P, R, origin):
    C = MSite(b, P, R, origin, 23)
    GLASS.clear()
    EXTRA.clear()
    rng = C.rng
    band(C)
    C.containers = ("gallery",)
    busts = [[round(C.ox, 3), 1.3, round(C.oz + 4.0, 3), 0.0, 0.9]]           # the lobby's: the white trollface bust
    C.begin("bust-plinth")
    b.box(P["white"], 1.6, 1.3, 1.6, 0, 0, 4.0, bevel=0.04)
    b.box(P["frame_dk"], 1.7, 0.1, 1.7, 0, 0, 4.0)
    C.end()
    C.col(0, 4.0, 1.6, 1.6, 1.3, 0, 1)
    rope_line(C, "bust-rope", [(-2.0, 2.0), (2.0, 2.0), (2.0, 6.0), (-2.0, 6.0), (-2.0, 2.0)], on="bust-plinth")
    # the ticket desk by the south door, the gift shop west of it
    C.begin("ticket-desk")
    b.box(P["wood"], 3.2, 1.1, 0.8, 7.0, 0, 8.6, bevel=0.03)
    b.box(P["marble"], 3.3, 0.06, 0.9, 7.0, 1.1, 8.6)
    b.box(P["till"], 0.5, 0.3, 0.4, 6.2, 1.16, 8.5, bevel=0.03)
    b.box(P["screen"], 0.45, 0.3, 0.04, 6.2, 1.5, 8.35, rx=-0.3)
    for k in range(6):                                                     # a fan of tickets
        b.box(P["poster_y"], 0.12, 0.01, 0.25, 7.6 + k * 0.05, 1.17, 8.6, ry=k * 0.15)
    C.end()
    C.col(7.0, 8.6, 3.2, 0.8, 1.15, 0, 1)
    rope_line(C, "queue-rope", [(5.4, 10.6), (8.6, 10.6)])
    C.begin("gift-shop")
    b.box(P["wood"], 3.4, 1.0, 0.8, -7.0, 0, 8.6, bevel=0.03)
    b.box(P["marble"], 3.5, 0.06, 0.9, -7.0, 1.0, 8.6)
    for k in range(6):                                                     # mugs with a black grin band
        mx = -8.4 + k * 0.5
        b.cyl(P["mug"], 0.07, (mx, 1.06, 8.6), (mx, 1.2, 8.6), seg=10)
        b.cyl(P["ink"], 0.072, (mx, 1.11, 8.6), (mx, 1.14, 8.6), seg=10)
    b.box(P["wood_dk"], 0.6, 1.8, 0.6, -9.6, 0, 6.6)                       # the print rack
    for k in range(3):
        quad(b, P[("art_red", "art_blue", "gold")[k]], (-9.6, 0.6 + k * 0.5, 6.29), (0, -1), (-1, 0), 0.45, 0.4)
    C.end()
    C.col(-7.0, 8.6, 3.4, 0.8, 1.1, 0, 1)
    C.col(-9.6, 6.6, 0.6, 0.6, 1.8, 0, 1)
    for k, (bx, bz) in enumerate(((-4.5, -5.0), (4.5, -5.0))):
        bench(C, f"lobby-bench{k}", bx, bz, 0.0)
        C.col(bx, bz, 1.8, 0.5, 0.9, 0, 1)
    C.loot(-3.0, 0.0, -9.0)
    C.containers = ()
    busts += wing(C, "gallery-east", 1, rng)
    busts += wing(C, "gallery-west", -1, rng)
    EXTRA["busts"] = busts
    # the sculpture court north: gravel, low hedges round it, the old
    # lobby's three pieces on plinths, benches
    CZ0, CZ1 = -19.4, -13.8
    C.begin("court")
    b.box(P["gravel"], 24.0, 0.03, CZ1 - CZ0, 0, 0, (CZ0 + CZ1) / 2)
    C.end()
    C.containers = ("court",)
    for (hx, hz, hw, hd) in ((0, CZ0 - 0.4, 24.8, 0.8), (-12.4, (CZ0 + CZ1) / 2, 0.8, CZ1 - CZ0), (12.4, (CZ0 + CZ1) / 2, 0.8, CZ1 - CZ0)):
        C.begin(f"hedge{int(hx)}")
        b.lump(P["hedge"], hw, 1.0, hd, hx, 0, hz, seed=int(abs(hx) * 7 + 3), rnd=0.3, jitter=0.06)
        C.end()
        C.col(hx, hz, hw, hd, 1.0, 0, 1)
    for k, (px, pz) in enumerate(((-7.0, -16.6), (0.0, -17.6), (7.0, -16.6))):
        C.begin(f"sculpture{k}")
        b.box(P["white"], 1.6, 1.1, 1.6, px, 0, pz, bevel=0.04)
        if k == 0:
            sphere(b, P["gold"], (px, 1.95, pz), 0.75, seg=20, ring=12)
            b.cyl(P["brass"], 0.12, (px, 1.1, pz), (px, 1.25, pz), seg=12, r2=0.3)
        elif k == 1:
            for i in range(10):
                b.box(P["white"], 0.9, 0.22, 0.25, px, 1.1 + i * 0.24, pz, ry=i * 0.42)
        else:
            y = 1.1
            for i in range(5):
                s_ = 0.9 - i * 0.12
                b.box([P["art_red"], P["art_blue"], P["gold"]][i % 3], s_, s_, s_, px, y, pz, ry=i * 0.35, bevel=0.03)
                y += s_
        C.end()
        C.col(px, pz, 1.6, 1.6, 1.1, 0, 1)
    for k, bx in enumerate((-3.5, 3.5)):
        bench(C, f"court-bench{k}", bx, -15.0, math.pi)
        C.col(bx, -15.0, 1.8, 0.5, 0.9, 0, 1)
    C.loot(-10.0, 0.0, -15.5)
    C.containers = ()
    # the easel in the east hall
    C.begin("easel", on=("gallery-east", "gallery-east-floor", "gallery-east-art"))
    ex, ez = 15.2, -7.6
    for s_ in (-1, 1):
        b.bar(P["easel"], (ex + s_ * 0.45, 0, ez + 0.3), (ex + s_ * 0.12, 2.1, ez + 0.05), 0.07)
    b.bar(P["easel"], (ex, 0, ez - 0.5), (ex, 1.8, ez - 0.05), 0.06)
    b.box(P["frame_dk"], 1.25, 1.0, 0.08, ex, 0.8, ez + 0.12, rx=-0.12)
    b.box(P["canvas"], 1.1, 0.85, 0.09, ex, 0.87, ez + 0.12, rx=-0.12)
    C.end()
    # spotlights at the corners, aimed at the pyramid
    for (x, z) in ((-17, -17), (17, -17), (17, 17), (-17, 17)):
        C.begin(f"spot{int(x > 0)}{int(z > 0)}")
        aim = Vector((-x, 9.0, -z)).normalized()
        head = Vector((x, 0.8, z))
        b.box(P["frame_dk"], 0.5, 0.3, 0.5, x, 0, z)
        b.cyl(P["frame_dk"], 0.32, head - aim * 0.4, head + aim * 0.4, seg=12)
        b.cyl(P["spot"], 0.26, head + aim * 0.4, head + aim * 0.42, seg=12)
        b.bar(P["frame_dk"], (x, 0.3, z), head, 0.12)
        C.end()
    b.finish("tf-gallery-p4.glb")


# ============================================================== THE OBSERVATORY

O_X0, O_X1, O_Z0, O_Z1, O_H = -9.0, 5.0, -7.0, 7.0, 4.2
O_ROOF = O_H + 0.1
O_C = (-2.0, 0.0)                                   # the dome's centre
O_R, O_DRUM = 5.0, 2.3                              # its radius, the drum's height


def dome(b, P, cx, cz, y0, r):
    """The white hemisphere with the dark slit facing +x."""
    LAT, SEG = 10, 40
    pts = []
    for i in range(LAT + 1):
        e = (math.pi / 2) * i / LAT
        for j in range(SEG):
            a = 2 * math.pi * j / SEG
            pts.append((cx + r * math.cos(e) * math.cos(a), y0 + r * math.sin(e), cz + r * math.cos(e) * math.sin(a)))
    shell, slit = [], []
    for i in range(LAT):
        for j in range(SEG):
            k = (j + 1) % SEG
            f = [i * SEG + j, i * SEG + k, (i + 1) * SEG + k, (i + 1) * SEG + j]
            amid = 2 * math.pi * (j + 0.5) / SEG
            amid = math.atan2(math.sin(amid), math.cos(amid))
            (slit if abs(amid) < 0.24 and i >= 1 else shell).append(f)
    for f in b.poly(P["obs_dome"], pts, shell):
        f.smooth = True
    b.poly(P["slit"], pts, slit)
    for s in (-1, 1):
        a = s * 0.24
        prev = None
        for i in range(1, LAT + 1):
            e = (math.pi / 2) * i / LAT
            p = Vector((cx + r * 1.012 * math.cos(e) * math.cos(a), y0 + r * 1.012 * math.sin(e), cz + r * 1.012 * math.cos(e) * math.sin(a)))
            if prev:
                b.bar(P["obs_band"], prev, p, 0.16)
            prev = p
    sphere(b, P["obs_band"], (cx, y0 + r, cz), 0.35)


def obs_build(b, P, R, origin):
    C = MSite(b, P, R, origin, 31)
    GLASS.clear()
    EXTRA.clear()
    rng = C.rng
    cx, cz, w, d = (O_X0 + O_X1) / 2, (O_Z0 + O_Z1) / 2, O_X1 - O_X0, O_Z1 - O_Z0
    box_shed(C, "observatory", cx, cz, w, d, O_H,
             [("e", 0.0, 2.4, 2.8), ("s", -3.0, 2.0, 2.6)],
             [("n", -5.0, 1.6, 1.2, 2.6), ("n", 1.5, 1.6, 1.2, 2.6), ("s", 2.0, 1.6, 1.2, 2.6), ("e", -4.2, 1.4, 1.2, 2.6)],
             "obs_wall", "obs_band", t=0.3, roof_pitch=False)
    C.containers = ("observatory",)
    C.begin("obs-trim")
    for (x, z, ww, dd) in ((cx, O_Z0 - 0.02, w + 0.1, 0.36), (cx, O_Z1 + 0.02, w + 0.1, 0.36), (O_X0 - 0.02, cz, 0.36, d + 0.1), (O_X1 + 0.02, cz, 0.36, d + 0.1)):
        b.box(P["obs_band"], ww, 0.5, dd, x, 0, z)
    for (side, at) in (("n", -5.0), ("n", 1.5), ("s", 2.0)):                 # the windows' glass
        zz = O_Z0 + 0.15 if side == "n" else O_Z1 - 0.15
        b.box(P["obs_win"], 1.6, 1.4, 0.06, at, 1.2, zz)
    b.box(P["obs_win"], 0.06, 1.4, 1.4, O_X1 - 0.15, 1.2, -4.2)
    b.box(P["obs_floor"], w - 0.7, 0.03, d - 0.7, cx, 0.0, cz)
    C.end()
    C.containers = ("observatory", "obs-trim")
    # inside: the chart desk, chairs, the kettle bench, charts, a ladder, books
    C.begin("chart-desk")
    b.box(P["wood"], 2.6, 0.06, 1.5, -4.0, 0.78, 2.6)
    for (lx, lz) in ((-1.2, -0.65), (1.2, -0.65), (-1.2, 0.65), (1.2, 0.65)):
        b.box(P["wood_dk"], 0.08, 0.78, 0.08, -4.0 + lx, 0, 2.6 + lz)
    b.box(P["chart"], 1.9, 0.01, 1.1, -4.0, 0.84, 2.6, ry=0.08)
    for k in range(14):
        b.box(P["star"], 0.05, 0.012, 0.05, -4.0 + rng.uniform(-0.85, 0.85), 0.846, 2.6 + rng.uniform(-0.45, 0.45))
    b.box(P["brass"], 0.4, 0.05, 0.05, -3.2, 0.86, 2.2, ry=0.6)                # dividers
    C.end()
    C.col(-4.0, 2.6, 2.6, 1.5, 0.84, 0, 1)
    for k, (chx, chz) in enumerate(((-4.6, 3.8), (-2.9, 1.4))):
        C.begin(f"obs-chair{k}")
        b.box(P["wood_dk"], 0.5, 0.06, 0.5, chx, 0.46, chz)
        b.box(P["wood_dk"], 0.5, 0.5, 0.06, chx, 0.5, chz + (0.22 if k == 0 else -0.22))
        for (lx, lz) in ((-0.2, -0.2), (0.2, -0.2), (-0.2, 0.2), (0.2, 0.2)):
            b.box(P["wood_dk"], 0.05, 0.46, 0.05, chx + lx, 0, chz + lz)
        C.end()
    C.begin("kettle-bench")
    b.box(P["wood"], 2.4, 0.95, 0.65, -6.4, 0, O_Z0 + 0.65)
    b.cyl(P["chrome"], 0.13, (-7.0, 0.95, O_Z0 + 0.6), (-7.0, 1.22, O_Z0 + 0.6), seg=12, r2=0.1)   # the kettle
    b.bar(P["ink"], (-6.86, 1.2, O_Z0 + 0.6), (-6.8, 1.08, O_Z0 + 0.6), 0.03)
    for k in range(3):
        b.cyl(P["mug"], 0.05, (-6.4 + k * 0.25, 0.95, O_Z0 + 0.7), (-6.4 + k * 0.25, 1.05, O_Z0 + 0.7), seg=8)
    C.end()
    C.col(-6.4, O_Z0 + 0.65, 2.4, 0.65, 1.0, 0, 1)
    C.begin("obs-books")
    b.box(P["wood_dk"], 0.4, 2.0, 2.4, O_X0 + 0.5, 0, 4.4)
    for y in (0.3, 0.9, 1.5):
        zz = 3.3
        while zz < 5.4:
            t = rng.uniform(0.06, 0.12)
            b.box(P[rng.choice(("book_a", "book_b", "book_c"))], 0.28, rng.uniform(0.3, 0.42), t, O_X0 + 0.55, y, zz + t / 2)
            zz += t + 0.01
    C.end()
    C.col(O_X0 + 0.5, 4.4, 0.4, 2.4, 2.0, 0, 1)
    C.begin("obs-charts")
    poster(C, "chart", (-0.5, 2.2, O_Z0 + 0.17), (0, 1), (1, 0), 1.6, 1.1, frame="obs_band")
    poster(C, "chart", (O_X0 + 0.17, 2.4, 0.0), (1, 0), (0, -1), 1.4, 1.0, frame="obs_band")
    C.end()
    C.begin("obs-ladder")
    for s in (-0.25, 0.25):
        b.bar(P["wood_dk"], (3.6 + s, 0, O_Z0 + 0.5), (3.6 + s, 3.9, O_Z0 + 0.2), 0.06)
    for k in range(9):
        y = 0.35 + k * 0.4
        zz = O_Z0 + 0.5 - 0.3 * y / 3.9
        b.box(P["wood_dk"], 0.5, 0.04, 0.05, 3.6, y, zz)
    b.box(P["wood"], 2.4, 0.06, 0.7, 2.6, 3.0, O_Z0 + 0.5)                  # the loft shelf it leans on
    for k in range(4):
        b.box(P["crate"], 0.4, 0.35, 0.4, 1.8 + k * 0.5, 3.06, O_Z0 + 0.5)
    C.end()
    C.col(3.6, O_Z0 + 0.4, 0.6, 0.4, 3.9, 0, 1)
    C.loot(-0.8, 0.0, -2.0)
    C.containers = ()
    # the roof: the catwalk rail (open at the stair), the drum and the dome,
    # the telescope out of the slit, the radio mast
    ox, oz = O_C
    # the rail round three sides; the west side is open (the stair arrives
    # there, and a rail would stand in front of the dome's door)
    rail_run(C, "catwalk-rail", [(O_X0 - 0.15, O_Z0 - 0.15), (O_X1 + 0.15, O_Z0 - 0.15), (O_X1 + 0.15, O_Z1 + 0.15),
                                 (O_X0 - 0.15, O_Z1 + 0.15)], O_ROOF, on="observatory")
    C.begin("obs-dome", on="observatory")
    seg = 28
    gap = math.pi                                                           # the dome's door faces west (the stair)
    for i in range(seg):
        a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
        am = (a0 + a1) / 2
        if abs(math.atan2(math.sin(am - gap), math.cos(am - gap))) < 0.17:
            continue
        p0 = (ox + O_R * math.cos(a0), oz + O_R * math.sin(a0))
        p1 = (ox + O_R * math.cos(a1), oz + O_R * math.sin(a1))
        L = math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.04
        b.box(P["obs_wall"], L, O_DRUM, 0.25, (p0[0] + p1[0]) / 2, O_ROOF, (p0[1] + p1[1]) / 2, ry=-am + math.pi / 2)
        C.col((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, max(0.3, abs(p1[0] - p0[0])), max(0.3, abs(p1[1] - p0[1])), O_DRUM, O_ROOF, 3)
    b.cyl(P["obs_band"], O_R + 0.2, (ox, O_ROOF + O_DRUM - 0.2, oz), (ox, O_ROOF + O_DRUM + 0.1, oz), seg=40)
    dome(b, P, ox, oz, O_ROOF + O_DRUM + 0.1, O_R)
    b.box(P["obs_floor"], 2 * O_R - 0.6, 0.03, 2 * O_R - 0.6, ox, O_ROOF, oz)
    C.end()
    C.face("door:obs-dome", "obs-dome", (ox - O_R - 0.14, O_ROOF + 1.05, oz), (-1, 0), 1.4, 2.1)
    C.begin("telescope", on="obs-dome")
    piv = Vector((ox + 0.6, O_ROOF + 3.3, oz))
    dd = Vector((math.sin(0.9), math.cos(0.9), 0.0))
    inner, outer = piv - dd * 2.4, piv + dd * 4.8
    b.box(P["scope_dk"], 1.4, 2.2, 1.4, ox + 0.2, O_ROOF, oz, bevel=0.06)        # the pier
    for s in (-1, 1):
        b.box(P["scope_dk"], 0.25, 1.4, 0.3, ox + 0.5, O_ROOF + 2.1, oz + s * 1.25)
    b.cyl(P["scope"], 1.0, inner, piv + dd * 2.2, seg=24, r2=1.1)
    b.cyl(P["scope_dk"], 1.2, piv + dd * 2.0, piv + dd * 2.35, seg=24)
    b.cyl(P["scope"], 1.25, piv + dd * 2.35, outer, seg=24, r2=1.35)
    b.cyl(P["ink"], 1.38, outer - dd * 0.12, outer, seg=24)
    b.cyl(P["lens"], 1.0, outer, outer + dd * 0.06, seg=24)
    b.cyl(P["ink"], 0.4, inner, inner - dd * 0.5, seg=12)                   # the eyepiece end
    C.end()
    C.col(ox + 0.2, oz, 3.2, 2.6, 2.6, O_ROOF, 3)
    C.begin("dome-desk", on="obs-dome")
    b.box(P["wood"], 1.6, 0.06, 0.7, ox - 2.2, O_ROOF + 0.75, oz + 2.8, ry=0.5)
    b.box(P["wood_dk"], 1.5, 0.75, 0.6, ox - 2.2, O_ROOF, oz + 2.8, ry=0.5)
    b.box(P["monitor"], 0.6, 0.4, 0.05, ox - 2.3, O_ROOF + 0.82, oz + 3.0, ry=0.5)
    b.box(P["obs_screen"], 0.54, 0.34, 0.01, ox - 2.27, O_ROOF + 0.85, oz + 2.95, ry=0.5)
    C.end()
    C.col(ox - 2.2, oz + 2.8, 1.6, 1.4, 0.8, O_ROOF, 1)
    C.loot(ox - 2.8, O_ROOF, oz - 2.0)
    C.loot(O_X1 - 0.6, O_ROOF, O_Z1 - 0.8)
    C.begin("radio-mast", on="observatory")
    mx, mz = O_X1 - 0.7, O_Z0 + 0.7
    pts = [(mx - 0.3, mz - 0.25), (mx + 0.3, mz - 0.25), (mx, mz + 0.3)]
    for (px, pz) in pts:
        b.bar(P["mast"], (px, O_ROOF, pz), (mx + (px - mx) * 0.3, O_ROOF + 8.0, mz + (pz - mz) * 0.3), 0.06)
    for k in range(8):
        y = O_ROOF + 0.5 + k * 0.95
        f = 1 - 0.7 * (y - O_ROOF) / 8.0
        for i in range(3):
            a, c = pts[i], pts[(i + 1) % 3]
            b.bar(P["white" if k % 2 else "mast"], (mx + (a[0] - mx) * f, y, mz + (a[1] - mz) * f), (mx + (c[0] - mx) * f, y, mz + (c[1] - mz) * f), 0.04)
    b.cyl(P["beacon"], 0.12, (mx, O_ROOF + 8.0, mz), (mx, O_ROOF + 8.3, mz), seg=8)
    C.end()
    C.col(mx, mz, 0.7, 0.7, 8.0, O_ROOF, 1)
    # the steel stair up the west wall
    fire_escape(C, "obs-stair", O_X0 - 0.95, -5.4, 0, 1, O_ROOF, 0.0, w=1.2)
    C.begin("obs-landing", on="obs-stair")
    b.box(P["steel"], 1.3, 0.1, 1.2, O_X0 - 0.95, O_ROOF - 0.1, -6.0)
    C.end()
    C.col(O_X0 - 0.95, -6.0, 1.3, 1.2, 0.1, O_ROOF - 0.1, 1)
    bench(C, "obs-bench", 7.4, 4.0, -math.pi / 2)
    C.col(7.4, 4.0, 0.5, 1.8, 0.9, 0, 1)
    b.finish("tf-observatory-p4.glb")


# ============================================================== THE MARKETPLACE

H_X0, H_X1, H_Z0, H_Z1, H_EAVE, H_RIDGE = -16.0, 8.0, -12.0, 0.0, 4.5, 6.8
QUAY = (2.0, 18.0, 8.0, 17.0, 0.9)                  # x0, x1, z0, z1, top


def stall(C, pid, x, z, rng, on=None):
    """A market counter (3.2 x 1.2 x 1.0) with its goods and a price board."""
    b, P = C.b, C.P
    C.begin(pid, on)
    b.box(P["stall"], 3.2, 1.0, 1.2, x, 0, z, bevel=0.03)
    b.box(P["stall_lt"], 3.4, 0.08, 1.4, x, 1.0, z, bevel=0.02)
    for y in (0.33, 0.66):
        b.box(P["stall_dk"], 3.22, 0.04, 1.22, x, y, z)
    xx = x - 1.45
    kind = rng.random()
    while xx < x + 1.2:
        if kind < 0.4:                                                     # fruit in crates
            b.box(P["stall_dk"], 0.7, 0.2, 0.5, xx + 0.35, 1.08, z)
            fruit = P[rng.choice(("fruit_r", "fruit_o", "fruit_g"))]
            for fx in (-0.2, 0.0, 0.2):
                b.box(fruit, 0.17, 0.16, 0.17, xx + 0.35 + fx, 1.28, z, ry=fx * 3)
            xx += 0.85
        elif kind < 0.7:                                                   # folded tees
            col = P[rng.choice(("box_a", "box_b", "box_d", "paint_y", "white"))]
            for j in range(rng.randint(2, 4)):
                b.box(col, 0.6, 0.09, 0.45, xx + 0.3, 1.08 + j * 0.1, z + 0.1, ry=rng.uniform(-0.1, 0.1))
            xx += 0.75
        else:                                                              # jars of pickled who-knows
            for j in range(3):
                b.cyl(P[rng.choice(("jar", "fruit_o", "paint_g"))], 0.1, (xx + 0.12 + j * 0.24, 1.08, z - 0.3), (xx + 0.12 + j * 0.24, 1.34, z - 0.3), seg=8)
            xx += 0.8
    if rng.random() < 0.5:                                                 # a scale
        b.box(P["chrome"], 0.35, 0.1, 0.3, x + 1.3, 1.08, z + 0.35)
        b.cyl(P["chrome"], 0.16, (x + 1.3, 1.25, z + 0.35), (x + 1.3, 1.28, z + 0.35), seg=10)
    C.end()
    C.col(x, z, 3.2, 1.2, 1.1, 0, 1)


def hall(C, rng):
    b, P = C.b, C.P
    cx, cz = (H_X0 + H_X1) / 2, (H_Z0 + H_Z1) / 2
    C.begin("market-hall")
    b.box(P["quay"], H_X1 - H_X0 + 1.0, 0.06, H_Z1 - H_Z0 + 1.0, cx, 0, cz)
    xs = [H_X0 + i * (H_X1 - H_X0) / 6 for i in range(7)]
    for x in xs:
        for z in (H_Z0, H_Z1):
            b.box(P["hall"], 0.36, H_EAVE, 0.36, x, 0, z)
            C.col(x, z, 0.36, 0.36, H_EAVE, 0, 3)
            b.bar(P["hall"], (x, H_EAVE - 1.2, z), (x + (0.8 if x < H_X1 - 0.1 else -0.8), H_EAVE - 0.05, z), 0.14)   # braces
    for z in (H_Z0, H_Z1):
        b.box(P["hall"], H_X1 - H_X0 + 0.4, 0.4, 0.4, cx, H_EAVE - 0.4, z)
    for x in xs:                                                              # the trusses
        b.bar(P["hall"], (x, H_EAVE, H_Z0), (x, H_RIDGE, cz), 0.2)
        b.bar(P["hall"], (x, H_EAVE, H_Z1), (x, H_RIDGE, cz), 0.2)
        b.bar(P["hall"], (x, H_EAVE, H_Z0), (x, H_EAVE, H_Z1), 0.16)
    L = math.hypot((H_Z1 - H_Z0) / 2 + 0.8, H_RIDGE - H_EAVE)
    for s in (-1, 1):                                                        # the roof, two pitches
        b.box(P["hall_roof"], H_X1 - H_X0 + 1.6, 0.12, L, cx, (H_EAVE + H_RIDGE) / 2 - 0.05, cz + s * ((H_Z1 - H_Z0) / 4 + 0.2),
              rx=s * math.atan2(H_RIDGE - H_EAVE, (H_Z1 - H_Z0) / 2 + 0.8))
    b.box(P["hall"], H_X1 - H_X0 + 1.8, 0.2, 0.3, cx, H_RIDGE, cz)
    C.end()
    C.col(cx, cz, H_X1 - H_X0 + 1.6, H_Z1 - H_Z0 + 1.6, H_RIDGE - H_EAVE + 0.2, H_EAVE, 3)
    C.containers = ("market-hall",)
    for row, z in enumerate((-8.6, -3.4)):
        for k, x in enumerate((-12.5, -8.0, -3.5, 1.0)):
            stall(C, f"stall{row}{k}", x, z, rng)
    C.begin("hall-lights")
    for z in (-8.6, -3.4):
        for x in (-12.5, -8.0, -3.5, 1.0):
            b.cyl(P["pole"], 0.02, (x, H_EAVE, z), (x, 3.0, z), seg=4)
            b.cyl(P["lamp"], 0.25, (x, 2.75, z), (x, 3.0, z), seg=10, r2=0.06)
    C.end()
    C.containers = ()
    C.sign("MARKET", cx, H_EAVE - 0.95, H_Z0 - 0.3, 0, -1, 5.6, 0.9, 0xffd23a)
    C.begin("market-sign", on="market-hall")
    b.box(P["board"], 5.8, 1.1, 0.12, cx, H_EAVE - 1.5, H_Z0 - 0.24)
    C.end()
    C.face("market-sign", "market-sign", (cx, H_EAVE - 0.95, H_Z0 - 0.31), (0, -1), 5.6, 0.9)
    C.loot(-5.8, 0.0, -6.0)


def quay(C, rng):
    b, P = C.b, C.P
    x0, x1, z0, z1, top = QUAY
    C.begin("quay")
    b.box(P["quay"], x1 - x0, top, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, bevel=0.04)
    for k in range(int((x1 - x0) / 1.2)):                                     # the coping stones
        b.box(P["quay_dk"], 1.15, 0.08, 0.5, x0 + 0.6 + k * 1.2, top, z0 + 0.25)
    for (wx, wz, ww, wd) in (((x0 + x1) / 2, z1 - 0.25, x1 - x0, 0.5), (x1 - 0.25, (z0 + z1) / 2, 0.5, z1 - z0)):   # the sea wall
        b.box(P["quay_dk"], ww, 1.0, wd, wx, top, wz, bevel=0.03)
    for (bx_, bz) in ((x0 + 1.0, z0 + 0.6), (x0 + 8.0, z0 + 0.6)):              # bollards
        b.cyl(P["ink"], 0.2, (bx_, top, bz), (bx_, top + 0.5, bz), seg=10, r2=0.24)
    C.end()
    C.col((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, top, 0, 3)
    C.col((x0 + x1) / 2, z1 - 0.25, x1 - x0, 0.5, 1.0, top, 3)
    C.col(x1 - 0.25, (z0 + z1) / 2, 0.5, z1 - z0, 1.0, top, 3)
    C.containers = ("quay",)
    C.begin("quay-steps")
    for sx in (6.0, 14.0):
        stairs(C, P["quay_dk"], sx, z0, 0, -1, 0.0, top, 2.4)
    stairs(C, P["quay_dk"], x0, 12.5, -1, 0, 0.0, top, 2.4)
    C.end()
    # the fish shed against the sea wall: posts, a lean-to roof, the tables
    C.begin("fish-shed")
    for x in (4.0, 10.0, 16.0):
        for z in (13.2, 16.4):
            b.box(P["hall"], 0.2, 3.4 if z > 16 else 2.8, 0.2, x, top, z)
    b.box(P["hall_roof"], 13.0, 0.1, 4.0, 10.0, top + 3.1, 14.8, rx=0.15)
    C.end()
    for x in (4.0, 10.0, 16.0):
        for z in (13.2, 16.4):
            C.col(x, z, 0.2, 0.2, 2.8, top, 1)
    C.col(10.0, 14.8, 13.0, 4.0, 0.3, top + 2.8, 1)
    C.containers = ("quay", "fish-shed")
    for k, tx in enumerate((6.0, 12.0)):
        C.begin(f"fish-table{k}")
        b.box(P["stall_dk"], 3.4, 0.9, 1.0, tx, top, 14.8, bevel=0.02)
        b.box(P["ice_bed"], 3.3, 0.08, 0.9, tx, top + 0.9, 14.8)
        for j in range(6):
            fx = tx - 1.35 + j * 0.54
            b.box(P["fish"], 0.45, 0.1, 0.16, fx, top + 0.98, 14.8 + (0.18 if j % 2 else -0.18), ry=rng.uniform(-0.3, 0.3), bevel=0.03)
        C.end()
        C.col(tx, 14.8, 3.4, 1.0, 1.0, top, 1)
    C.begin("fish-rail")
    b.cyl(P["steel"], 0.03, (4.0, top + 2.6, 16.2), (16.0, top + 2.6, 16.2), seg=6)
    for k in range(10):
        fx = 4.8 + k * 1.15
        b.bar(P["rope"], (fx, top + 2.6, 16.2), (fx, top + 2.2, 16.2), 0.02)
        b.box(P["fish"], 0.14, 0.55, 0.1, fx, top + 1.65, 16.2, bevel=0.03)
    C.end()
    C.begin("fish-boxes", on="fish-table1")
    for k in range(4):
        b.box(P["fishbox"], 0.8, 0.3, 0.5, 15.6, top + k * 0.31, 10.2, ry=k * 0.05)
    b.box(P["chrome"], 0.4, 0.12, 0.35, 12.4, top + 0.98, 15.3)               # the scale on the table end
    C.end()
    C.col(15.6, 10.2, 0.9, 0.6, 1.25, top, 1)
    C.containers = ()
    C.loot(8.5, top, 10.5)
    C.loot(16.0, top, 12.5)


def canopy_stall(C, pid, x, z, cloth, rng):
    """A counter under a bright cloth roof on four poles (the old market's)."""
    b, P = C.b, C.P
    stall(C, pid, x, z, rng)
    C.begin(f"{pid}-canopy", on=pid)
    for (dx, dz) in ((-1.8, -1.2), (1.8, -1.2), (-1.8, 1.2), (1.8, 1.2)):
        b.cyl(P["pole_w"], 0.06, (x + dx, 0, z + dz), (x + dx, 2.7, z + dz), seg=8)
    for s in (-1, 1):
        b.box(P[cloth[0]], 4.2, 0.05, 1.5, x, 2.95, z + s * 0.72, rx=s * 0.32)
    b.box(P[cloth[1]], 4.2, 0.35, 0.03, x, 2.42, z - 1.42)
    b.box(P[cloth[1]], 4.2, 0.35, 0.03, x, 2.42, z + 1.42)
    C.end()


def parasol(C, pid, x, z, m, rng):
    b, P = C.b, C.P
    C.begin(pid)
    b.cyl(P["white"], 0.4, (x, 0, z), (x, 0.74, z), seg=12)                   # the table
    b.cyl(P["ink"], 0.42, (x, 0.74, z), (x, 0.78, z), seg=12)
    b.cyl(P["pole_w"], 0.04, (x, 0.78, z), (x, 2.5, z), seg=6)
    b.cyl(P[m], 1.5, (x, 2.2, z), (x, 2.6, z), seg=8, r2=0.08)
    for k in range(2):
        a = rng.uniform(0, 6.28)
        chx, chz = x + math.cos(a) * 0.8, z + math.sin(a) * 0.8
        b.box(P["white"], 0.42, 0.05, 0.42, chx, 0.44, chz, ry=a)
        b.box(P["white"], 0.42, 0.45, 0.05, chx + math.cos(a) * 0.22, 0.47, chz + math.sin(a) * 0.22, ry=-a + math.pi / 2)
    C.end()
    C.col(x, z, 0.8, 0.8, 0.8, 0, 1)


def bike(C, pid, x, z, ry):
    b, P = C.b, C.P
    c, s = math.cos(ry), math.sin(ry)
    C.begin(pid)
    for d_ in (-0.52, 0.52):
        torus(b, P["tyre"], (x + c * d_, 0.34, z - s * d_), 0.32, 0.03, (c, 0, -s), (0, 1, 0), seg=16, tseg=4)
    b.bar(P["bike"], (x - c * 0.52, 0.34, z + s * 0.52), (x, 0.7, z), 0.04)
    b.bar(P["bike"], (x, 0.7, z), (x + c * 0.52, 0.34, z - s * 0.52), 0.04)
    b.bar(P["bike"], (x - c * 0.1, 0.34, z + s * 0.1), (x - c * 0.15, 0.85, z + s * 0.15), 0.04)
    b.bar(P["ink"], (x + c * 0.4, 0.95, z - s * 0.4 - 0.2), (x + c * 0.4, 0.95, z - s * 0.4 + 0.2), 0.03)
    C.end()


def market_build(b, P, R, origin):
    C = MSite(b, P, R, origin, 29)
    GLASS.clear()
    EXTRA.clear()
    rng = C.rng
    hall(C, rng)
    quay(C, rng)
    for k, (z, cloth) in enumerate(((-10.0, ("cloth_y", "cloth_r")), (-4.6, ("cloth_b", "cloth_y")), (0.8, ("cloth_r", "cloth_g")))):
        canopy_stall(C, f"canopy{k}", -21.0, z, cloth, rng)
    tf_city.fountain(C, -8.0, 9.0)
    for k, (x, z, m) in enumerate(((-20.0, 7.0, "parasol_r"), (-20.0, 12.5, "parasol_w"), (-14.5, 15.5, "parasol_y"))):
        parasol(C, f"parasol{k}", x, z, m, rng)
    # the noodle cart: on wheels, a striped roof, the pot, bowls, a stool
    C.begin("noodle-cart")
    nx, nz = -1.0, 5.0
    b.box(P["noodle"], 2.2, 1.0, 1.0, nx, 0.35, nz, bevel=0.04)
    b.box(P["wood"], 2.3, 0.06, 1.1, nx, 1.35, nz)
    for dx in (-0.8, 0.8):
        b.cyl(P["tyre"], 0.32, (dx + nx, 0.32, nz - 0.56), (dx + nx, 0.32, nz - 0.44), seg=12)
    for (dx, dz) in ((-1.0, -0.45), (1.0, -0.45), (-1.0, 0.45), (1.0, 0.45)):
        b.cyl(P["pole_w"], 0.04, (nx + dx, 1.41, nz + dz), (nx + dx, 2.5, nz + dz), seg=6)
    b.box(P["noodle"], 2.5, 0.08, 1.3, nx, 2.5, nz)
    b.box(P["white"], 2.5, 0.3, 0.03, nx, 2.22, nz - 0.66)
    b.cyl(P["chrome"], 0.28, (nx - 0.5, 1.41, nz), (nx - 0.5, 1.76, nz), seg=12)
    for k in range(3):
        b.cyl(P["white"], 0.1, (nx + 0.2 + k * 0.25, 1.41, nz + 0.2), (nx + 0.2 + k * 0.25, 1.5, nz + 0.2), seg=8, r2=0.13)
    C.end()
    C.col(nx, nz, 2.3, 1.2, 1.4, 0, 1)
    C.sign("NOODLES", nx, 2.05, nz - 0.68, 0, -1, 1.6, 0.36, 0xff5a3d)
    C.face("noodle-sign", "noodle-cart", (nx, 2.05, nz - 0.69), (0, -1), 1.6, 0.36)
    C.begin("bike-rack")
    b.bar(P["steel"], (12.9, 0.5, 4.5), (15.5, 0.5, 4.5), 0.05)
    for x in (12.9, 15.5):
        b.cyl(P["steel"], 0.03, (x, 0, 4.5), (x, 0.5, 4.5), seg=6)
    C.end()
    C.containers = ("bike-rack",)
    for k, bx_ in enumerate((13.4, 14.2, 15.0)):
        bike(C, f"bike{k}", bx_, 3.8, math.pi / 2)
    C.containers = ()
    for k, (cx_, cz_, ry) in enumerate(((-12.8, 1.6, 0.0), (2.2, 1.6, 0.0), (-17.6, -7.4, math.pi / 2))):
        C.begin(f"chalkboard{k}")
        c, s = math.cos(ry), math.sin(ry)
        for t in (-1, 1):
            b.box(P["chalk"], 0.7, 0.9, 0.04, cx_ + s * t * 0.18, 0.05, cz_ + c * t * 0.18, ry=ry, rx=t * 0.2)
        for j in range(3):
            b.box(P["chalk_w"], 0.4 - j * 0.08, 0.04, 0.01, cx_ + s * 0.24, 0.65 - j * 0.16, cz_ + c * 0.24, ry=ry, rx=0.2)
        C.end()
    for k, (bx_, bz) in enumerate(((10.0, -10.5), (10.0, -9.6), (10.9, -10.1))):
        barrel(C, f"m-barrel{k}", bx_, bz, m="barrel" if k % 2 else "barrel_y")
    C.begin("baskets")
    for k in range(4):
        x = 9.8 + (k % 2) * 0.7
        z = -6.5 + (k // 2) * 0.8
        b.cyl(P["basket"], 0.32, (x, 0, z), (x, 0.45, z), seg=10, r2=0.36)
        for j in range(3):
            b.box(P[("fruit_r", "fruit_o", "fruit_g")[(k + j) % 3]], 0.16, 0.15, 0.16, x + (j - 1) * 0.14, 0.42, z, ry=j)
    C.end()
    C.col(10.15, -6.1, 1.5, 1.6, 0.55, 0, 1)
    # banner poles at the hall's ends, bunting to the eaves
    for k, (px, pz) in enumerate(((H_X0 - 2.0, H_Z0 - 2.0), (H_X1 + 2.0, H_Z1 + 2.0))):
        C.begin(f"banner{k}", on="market-hall")
        b.cyl(P["pole_w"], 0.1, (px, 0, pz), (px, 6.4, pz), seg=8)
        sphere(b, P["gold"], (px, 6.5, pz), 0.16)
        b.box(P["cloth_r" if k else "cloth_b"], 0.05, 3.0, 1.1, px, 3.0, pz + 0.6)
        ex, ez = (H_X0, H_Z0) if k == 0 else (H_X1, H_Z1)
        for j in range(9):
            t0, t1 = j / 9, (j + 1) / 9
            sag = lambda t: 0.6 * 4 * t * (1 - t)       # noqa: E731
            p0 = (px + (ex - px) * t0, 6.0 + (H_EAVE - 6.0) * t0 - sag(t0), pz + (ez - pz) * t0)
            p1 = (px + (ex - px) * t1, 6.0 + (H_EAVE - 6.0) * t1 - sag(t1), pz + (ez - pz) * t1)
            b.bar(P["rope"], p0, p1, 0.02)
            b.box(P[("cloth_y", "cloth_r", "cloth_b", "cloth_g")[j % 4]], 0.02, 0.32, 0.26, p0[0], p0[1] - 0.34, p0[2], ry=math.atan2(ex - px, ez - pz))
        C.end()
        C.col(px, pz, 0.24, 0.24, 6.4, 0, 1)
    lamp_post(C, "m-lamp0", -14.0, 4.0, 0.0)
    lamp_post(C, "m-lamp1", 6.0, 4.0, math.pi)
    b.finish("tf-market-p4.glb")


def _mod(fn):
    return SimpleNamespace(build=fn, palette=palette, LOOT=LOOT, SIGNS=SIGNS, GLASS=GLASS, EXTRA=EXTRA)


SHOP = _mod(shop_build)
LAB = _mod(lab_build)
GALLERY = _mod(gallery_build)
OBS = _mod(obs_build)
MARKET = _mod(market_build)
