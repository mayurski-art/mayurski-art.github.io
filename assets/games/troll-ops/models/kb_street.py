"""
Kabukigrin's street props (build_kabukigrin.blender.py): the ramen shops'
fronts, built properly (user, 2026-10-24: "ramen fronts ... should be built
better"). Grinjuku's shopfront gives a ramen shop the same bay as any other
(lit glass, two shelves, a noren over the middle); the build cuts that bay
out after the unwrap (RAMEN cut boxes) and this draws the shop into it, in
the face's own frame (t along the wall, o out of it, y up; G.Face):

  timber posts and a skirting, a lintel across at 2.3 .. 2.45
  the sliding door in the middle: lattice (koshi) over a warm lit inside
  a navy noren on the transom over it (1.95 .. 2.3, above the door's
  1.9 head: rule 9, nothing in front of a doorway), lettered at runtime
  the display case to its left: bowls of ramen on a lit shelf behind glass
  the meal-ticket machine at the far left (room allowing)
  the window to its right onto the counter and its stools, the menu board
  hung beside the door

It is drawn 0.11 m out from the facade (build_kabukigrin: some bays are
closed at the facade's plane), so it stands at most 17 cm proud: nothing
needs a collider, nothing stands in front of the sign band (2.78 up) or a
neighbour. The lettering (sign band, noren, ticket machine, menu) is
kabukigrin-signs.js's, from the rows added to SIGNS here.
"""
import math
import random

from kb_club import At, kmat


class Out:
    """A face pushed `d` out: the front is drawn as if the facade's plane
    were its recess's back (some bays are closed at that plane)."""

    def __init__(self, face, d):
        self.f, self.d = face, d
        self.ax, self.n, self.at, self.t0 = face.ax, face.n, face.at, face.t0

    def world(self, t, o):
        return self.f.world(t, o + self.d)

    def box(self, b, m, t0, t1, y, h, o0, o1):
        self.f.box(b, m, t0, t1, y, h, o0 + self.d, o1 + self.d)

    def quad(self, b, m, t0, t1, y, h, o):
        self.f.quad(b, m, t0, t1, y, h, o + self.d)


def ramen_palette(P):
    from map_kit import mat
    return {
        **P,
        "noren": mat("KBF_Noren", 0x1b2747, 0.95),
        "broth": mat("KBF_Broth", 0xc89a52, 0.35),
        "noodle": mat("KBF_Noodle", 0xe6cf7a, 0.6),
        "egg": mat("KBF_Egg", 0xf0a028, 0.4),
        "pork": mat("KBF_Pork", 0x9a5a3e, 0.6),
        "nori": mat("KBF_Nori", 0x14201a, 0.7),
        "scallion": mat("KBF_Scallion", 0x4a8a2a, 0.6),
        "bowl": mat("KBF_Bowl", 0x1a0d0c, 0.3),
        "bowl_rim": mat("KBF_BowlRim", 0xa8201a, 0.35),
        "machine": mat("KBF_Machine", 0xd8d6cc, 0.4),
        # the street's timber: KB_Wood's photo (map-models.js RETEXTURE) without
        # the hall's red wash, which kabukigrin.js puts on KB_Wood
        "wood": kmat("KB_StreetWood", 0x4a2c1a, 0.65),
        "inside": kmat("KB_RamenGlow", 0xffd9a0, 0.6, emit=0xffc480, strength=0.8),
        "buttons": kmat("KB_TicketButtons", 0xfff1c4, 0.3, emit=0xffe6a0, strength=0.6),
        # the menu board's and the window's paper strips, lit from inside as
        # a menu box is (unlit, they read navy under the street's night)
        "menu_paper": kmat("KB_MenuPaper", 0xf4ecd8, 0.7, emit=0xffefd0, strength=0.55),
    }


def bowl(face, b, P, t, y, o, r=0.09):
    """A bowl of ramen sitting at (t, y, o): the bowl flaring open (no lid
    on it: the broth shows from above), a red rim, the broth, noodles, a
    halved egg, two slices of pork, nori standing at the back."""
    x, z = face.world(t, o)
    h = r * 0.7
    b.cyl(P["bowl"], r * 0.55, (x, y, z), (x, y + h - 0.01, z), seg=10, r2=r, caps=False)
    b.cyl(P["bowl_rim"], r, (x, y + h - 0.01, z), (x, y + h, z), seg=10, caps=False)
    top = y + h - 0.016
    b.cyl(P["broth"], r * 0.93, (x, top - 0.002, z), (x, top, z), seg=10)
    face.box(b, P["noodle"], t - r * 0.5, t + r * 0.1, top, 0.008, o - r * 0.4, o + r * 0.4)
    ex, ez = face.world(t + r * 0.45, o + r * 0.2)
    b.cyl(P["egg"], r * 0.22, (ex, top, ez), (ex, top + 0.01, ez), seg=6)
    for k in (-1, 1):
        face.box(b, P["pork"], t + r * 0.2, t + r * 0.55, top, 0.01, o - r * 0.15 * k - 0.02, o - r * 0.15 * k + 0.02)
    face.box(b, P["nori"], t - r * 0.2, t + r * 0.25, top, r * 0.55, o - r * 0.85, o - r * 0.8)
    face.box(b, P["scallion"], t - r * 0.05, t + r * 0.15, top, 0.006, o + r * 0.35, o + r * 0.55)


def ramen_front(face, b, P, R, pid, t0, t1, rng, signs):
    """One shop between t0 and t1 (Grinjuku's shopfront run: pilasters
    0.35 at each end, the bay a .. c between)."""
    a, c = t0 + 0.35, t1 - 0.35
    W = c - a
    R.begin(b, pid)
    wood, dark = P["wood"], P["black"]
    # the frame: skirting, posts, lintel
    face.box(b, wood, a, c, 0.0, 0.42, -0.1, 0.0)
    D = min(1.7, max(1.1, W * 0.42))
    dm = (a + c) / 2 + (0.0 if W < 3.2 else -0.2)
    dl, dr = dm - D / 2, dm + D / 2
    for tt in (a, dl, dr, c):
        face.box(b, wood, tt - 0.05, tt + 0.05, 0.0, 2.45, -0.1, 0.02)
    face.box(b, wood, a, c, 2.3, 0.15, -0.1, 0.03)
    # the transom over the door, the noren hung on it
    face.box(b, wood, dl + 0.05, dr - 0.05, 1.9, 0.4, -0.1, -0.02)
    face.box(b, dark, dl, dr, 2.27, 0.02, -0.02, 0.03)                     # its rod
    panels = 3 if D < 1.4 else 4
    for k in range(panels):
        pa = dl + 0.06 + k * (D - 0.12) / panels
        face.box(b, P["noren"], pa + 0.01, pa + (D - 0.12) / panels - 0.01, 1.96, 0.31, -0.015, 0.0)
    nx, nz = face.world(dm, 0.002)
    n = (0, face.n) if face.ax == "x" else (face.n, 0)
    signs.append(["row", round(nx, 3), 2.115, round(nz, 3), n[0], n[1], 0.22, max(3, int((D - 0.12) / 0.26)), 0xf2efe6, 0, "noren"])
    # the door: two sliding leaves of lattice over the lit inside
    face.quad(b, P["inside"], dl + 0.05, dr - 0.05, 0.42, 1.48, -0.098)
    for side in (0, 1):
        la, lb = (dl + 0.05, dm) if side == 0 else (dm, dr - 0.05)
        oo = -0.06 if side == 0 else -0.075          # the leaves overlap, one in front
        face.box(b, wood, la, lb, 0.0, 0.42, oo - 0.012, oo + 0.012)       # kick panel
        face.box(b, wood, la, lb, 1.86, 0.04, oo - 0.012, oo + 0.012)      # head rail
        face.box(b, wood, la, la + 0.04, 0.0, 1.9, oo - 0.012, oo + 0.012)
        face.box(b, wood, lb - 0.04, lb, 0.0, 1.9, oo - 0.012, oo + 0.012)
        face.box(b, wood, la, lb, 1.12, 0.03, oo - 0.012, oo + 0.012)      # mid rail
        k = la + 0.075
        while k < lb - 0.05:
            face.quad(b, wood, k - 0.009, k + 0.009, 0.42, 1.44, oo + 0.008)     # a lattice bar: its face is all that shows
            k += 0.062
        # a pull in the edge that meets the other leaf
        pt = lb - 0.07 if side == 0 else la + 0.07
        face.box(b, dark, pt - 0.012, pt + 0.012, 0.95, 0.14, oo + 0.012, oo + 0.018)
    # left of the door: the ticket machine (room allowing), the display case
    lw = dl - 0.05 - (a + 0.05)
    t_case0 = a + 0.05
    if lw > 1.75:
        m0, m1 = a + 0.08, a + 0.66
        face.box(b, P["machine"], m0, m1, 0.0, 1.62, -0.1, -0.01)
        face.box(b, P["red"], m0, m1, 1.62, 0.16, -0.1, -0.01)
        face.quad(b, P["screen"], m0 + 0.08, m1 - 0.08, 1.18, 0.28, -0.008)
        for row in range(4):
            for col in range(5):
                bt = m0 + 0.07 + col * (m1 - m0 - 0.14) / 4.0
                face.box(b, P["buttons"], bt - 0.04, bt + 0.04, 0.72 + row * 0.1, 0.07, -0.012, -0.004)
        face.box(b, dark, m0 + 0.2, m1 - 0.2, 0.55, 0.04, -0.012, -0.004)           # coin slot
        face.box(b, dark, m0 + 0.12, m1 - 0.12, 0.2, 0.12, -0.012, -0.006)          # tray
        mx, mz = face.world((m0 + m1) / 2, -0.004)
        signs.append(["row", round(mx, 3), 1.7, round(mz, 3), n[0], n[1], 0.11, 3, 0xf2efe6, 0, "ticket"])
        t_case0 = m1 + 0.12
    case_w = min(1.6, dl - 0.05 - t_case0 - 0.06)
    if case_w > 0.5:
        ca, cb = dl - 0.11 - case_w, dl - 0.11
        face.box(b, wood, ca - 0.03, cb + 0.03, 0.42, 0.36, -0.1, 0.06)          # the case's base
        face.box(b, wood, ca - 0.03, cb + 0.03, 1.38, 0.05, -0.1, 0.06)          # its top
        face.quad(b, P["inside"], ca, cb, 0.78, 0.6, -0.098)                      # lit back
        face.box(b, P["steel"], ca, cb, 0.97, 0.012, -0.095, 0.05)                # the shelf
        face.quad(b, P["glass"], ca, cb, 0.78, 0.6, 0.058)
        nb = max(2, int(case_w / 0.3))
        for i in range(nb):
            bowl(face, b, P, ca + (i + 0.5) * case_w / nb, 0.982, -0.02)
    # right of the door: the window onto the counter, the menu board by the door
    wa, wb = dr + 0.08, c - 0.08
    if wb - wa > 0.7:
        mb0, mb1 = wa, wa + 0.42
        face.box(b, wood, mb0, mb1, 0.62, 1.5, -0.02, 0.03)
        face.quad(b, P["menu_paper"], mb0 + 0.04, mb1 - 0.04, 0.68, 1.38, 0.032)
        bx, bz = face.world((mb0 + mb1) / 2, 0.034)
        signs.append(["col", round(bx, 3), 1.37, round(bz, 3), n[0], n[1], 0.2, 6, 0x1a1414, 0, "menu"])
        ga = mb1 + 0.1
        if wb - ga > 0.5:
            face.quad(b, P["inside"], ga, wb, 0.42, 1.8, -0.098)
            face.box(b, wood, ga, wb, 0.95, 0.06, -0.098, -0.075)                 # the counter's edge
            ns = max(1, int((wb - ga) / 0.55))
            for i in range(ns):
                st = ga + (i + 0.5) * (wb - ga) / ns
                face.box(b, dark, st - 0.12, st + 0.12, 0.42, 0.28, -0.098, -0.09)   # a stool's silhouette
                face.box(b, dark, st - 0.03, st + 0.03, 0.42, 0.3, -0.098, -0.09)
            # the menu strips (tanzaku) hung along the top inside
            k = ga + 0.1
            while k < wb - 0.08:
                face.quad(b, P["menu_paper"], k - 0.045, k + 0.045, 1.74, 0.4, -0.06)
                k += 0.15
            face.box(b, wood, ga - 0.05, ga + 0.05, 0.42, 1.88, -0.1, 0.02)
            face.quad(b, P["glass"], ga, wb, 0.42, 1.8, -0.01)
    R.end()


# ------------------------------------------------------------- phase 3: the street furniture
#
# A Main and B Main as Grinjuku's builders left them: shop after shop,
# windows above, signs everywhere. The furniture that makes them a place
# (doc phase 3: drainpipes, wall AC units, power poles and wires, manholes,
# bollards, bikes), placed round what is already on each wall. Every prop
# is checked before it is drawn (Space): it may not cross anything Grinjuku
# or Studio put there (a ledge, a kanban, a lantern, a collider), and it may
# not stand in the frontal box of a face that must stay seen (rule 9: a
# shop's glass, a sign band, a kanban's face, the screen, the pachinko
# parlour; registered here so the obstruction test covers them too). A spot
# that fails is skipped, never squeezed.

MAINS = {"a": (-31.7, -23.0), "b": (23.0, 31.7)}      # x0, x1
MAIN_Z = (-32.0, 4.0)
DEPTH = 3.0          # the obstruction test's frontal box
# the street's eye points: a player on A Main, on B Main, at the B ramen stall
EYES = [
    {"rect": [-31.7, -23.0, -32.0, 4.0], "y": 0.0},
    {"rect": [23.0, 31.7, -32.0, 4.0], "y": 0.0},
    {"rect": [17.0, 25.0, 25.0, 30.9], "y": 0.0},
]


# Grinjuku's sign bands at A Main's mouth cut back clear of Studio's club
# front (rule 9; user: "fix them"): the pachinko building's band stops short
# of the club's katakana blade sign (z 2.85), the east band short of the
# marquee (z 3.195). Cut from kb-shell and kb-neon after the unwrap (game x0,
# x1, y0, y1, z0, z1; clear of the wall and the pilasters behind), the open
# ends capped in kb-props (band_ends)
BAND_CUTS = [
    (-31.64, -31.3, 2.745, 3.39, 2.8, 3.95),
    (-23.4, -23.06, 2.745, 3.39, 3.15, 4.2),
]
KNOWN = []


def band_ends(b, P, R):
    """The caps on the cut bands' ends, facing the club (+z)."""
    for i, (x0, x1, y0, y1, z0, z1) in enumerate(BAND_CUTS):
        wx = -31.7 if x0 < -27 else -23.0                     # the wall the band stands on
        fx = wx + (0.3 if wx < -27 else -0.3)                 # its front
        a, c = min(wx, fx), max(wx, fx)
        R.begin(b, f"band-end{i}")
        _facing(b, P["black"], [(a, 2.75, z0), (c, 2.75, z0), (c, 3.37, z0), (a, 3.37, z0)], (0, 0, 1))
        R.end()


def street_palette(P):
    from map_kit import mat
    f = lambda name, c, r=0.6: mat("KBF_" + name, c, r)   # noqa: E731
    return {
        **P,
        "pole": f("PoleConcrete", 0x8f8d86, 0.85),
        "pole_dk": f("PoleGrime", 0x55534e, 0.9),
        "downpipe": f("Downpipe", 0x6d706c, 0.55),
        "ac_body": f("ACUnit", 0xcfcbbf, 0.55),
        "ac_fan": f("ACGrille", 0x2b2b2d, 0.7),
        "iron": f("CastIron", 0x1d1d20, 0.55),
        "iron_lt": f("CastIronWorn", 0x45433e, 0.45),
        "yellow": f("Yellow", 0xe0ac00, 0.5),
        "insulator": f("Insulator", 0xdcd8cc, 0.3),
        "drum": f("Transformer", 0x7f8782, 0.5),
        "cone_or": f("ConeOrange", 0xe4561c, 0.6),
        "bin_bl": f("BinBlue", 0x1f4f9a, 0.5),
        "bin_ye": f("BinYellow", 0xd8b21a, 0.5),
        "bike_r": f("BikeRed", 0x9a1c22, 0.4),
        "bike_s": f("BikeSilver", 0x9da2a8, 0.35),
        "bike_b": f("BikeBlue", 0x2a4f8a, 0.4),
        "bike_w": f("BikeWhite", 0xd8d6d0, 0.4),
        "lamp": kmat("KB_StreetLamp", 0xfff4dc, 0.3, emit=0xffeccc, strength=2.0),
        "truck_w": f("TruckWhite", 0xe6e4dc, 0.35),
        "glass_dk": f("GlassDark", 0x161c26, 0.1),
        "lamp_off": f("LampLens", 0xc8ccd0, 0.15),
        "amber_off": f("Indicator", 0xd88a20, 0.3),
        "red_lamp": f("TailLight", 0x8a1418, 0.3),
        "crate_y": f("CrateYellow", 0xe0b020, 0.6),
        "crate_r": f("CrateRed", 0xb0201c, 0.6),
        "pallet": f("Pallet", 0x9a7a52, 0.85),
        "bottle": f("BottleBrown", 0x3a1e0c, 0.15),
        "cap": f("BottleCap", 0xc8a040, 0.35),
        "card": f("Cardboard", 0xa88456, 0.9),
        "tape": f("Tape", 0xd8c49a, 0.4),
    }


def fbox(face, t0, t1, y0, y1, o0, o1):
    """A box in a face's frame as a world AABB (lo, hi)."""
    (xa, za), (xb, zb) = face.world(t0, o0), face.world(t1, o1)
    return [min(xa, xb), y0, min(za, zb)], [max(xa, xb), y1, max(za, zb)]


def face_pt(face, t, y, o):
    x, z = face.world(t, o)
    return (x, y, z)


def face_n(face):
    return (face.n, 0, 0) if face.ax == "z" else (0, 0, face.n)


def _facing(b, m, pts, n):
    """One flat polygon, wound to face n (one-sided: its back is never seen)."""
    a, c, d = pts[0], pts[1], pts[2]
    u = [c[i] - a[i] for i in range(3)]
    v = [d[i] - a[i] for i in range(3)]
    cr = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
    if sum(cr[i] * n[i] for i in range(3)) < 0:
        pts = pts[::-1]
    return b.poly(m, pts, [list(range(len(pts)))])


def disc(b, m, c, n, r, seg):
    """A flat round face (a grille, a cover) at c facing n."""
    u = (0.0, 0.0, 1.0) if abs(n[1]) > 0.9 else (0.0, 1.0, 0.0)
    v = (n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0])
    pts = [tuple(c[i] + r * (math.cos(2 * math.pi * k / seg) * u[i] + math.sin(2 * math.pi * k / seg) * v[i]) for i in range(3))
           for k in range(seg)]
    return _facing(b, m, pts, n)


def strip(b, m, a, c, w):
    """A flat upward strip from a to c, w wide (a grate's bar, a spoke)."""
    dx, dz = c[0] - a[0], c[2] - a[2]
    L = math.hypot(dx, dz) or 1.0
    px, pz = -dz / L * w / 2, dx / L * w / 2
    pts = [(a[0] + px, a[1], a[2] + pz), (c[0] + px, c[1], c[2] + pz), (c[0] - px, c[1], c[2] - pz), (a[0] - px, a[1], a[2] - pz)]
    return _facing(b, m, pts, (0, 1, 0))


def on_main(face):
    return face.ax == "z" and any(abs(face.at - a) < 0.15 for x0, x1 in MAINS.values() for a in (x0, x1))


def behind_studio(x, z):
    """Is (x, z) on the A Main facade Studio's pachinko front stands over?"""
    return x < -31.0 and -24.7 < z < -5.8


class Space:
    """What the street's props keep out of (`boxes`: world AABBs) and out
    of the front of (`fronts`: the frontal boxes of the faces that must
    stay seen)."""

    def __init__(self):
        self.boxes, self.fronts = [], []

    def add(self, lo, hi, tag):
        self.boxes.append((lo, hi, tag))

    def front(self, fid, c, n, w, h):
        u = (-n[2], 0.0, n[0])
        pts = [(c[0] + u[0] * a + n[0] * d, c[2] + u[2] * a + n[2] * d) for a in (-w / 2, w / 2) for d in (0.005, DEPTH)]
        lo = [min(p[0] for p in pts), c[1] - h / 2, min(p[1] for p in pts)]
        hi = [max(p[0] for p in pts), c[1] + h / 2, max(p[1] for p in pts)]
        self.fronts.append((lo, hi, fid))

    @staticmethod
    def _cross(lo, hi, a, b, pad):
        return all(lo[k] < b[k] + pad and a[k] < hi[k] + pad for k in range(3))

    def clash(self, lo, hi, pad=0.01):
        """What (lo, hi) runs into, or the face it stands in front of; None when free."""
        for a, b, tag in self.boxes:
            if self._cross(lo, hi, a, b, pad):
                return tag
        for a, b, fid in self.fronts:
            if self._cross(lo, hi, a, b, -0.005):
                return "front of " + fid
        return None

    def take(self, lo, hi, tag):
        """Claims a spot (so the next prop keeps off it): True when it was free."""
        why = self.clash(lo, hi)
        if why:
            return False
        self.add(lo, hi, tag)
        return True


def street_space(ST, SIGNS, CLUB, KB, cleared, extra_faces, R):
    """The Space for the Mains: everything on their walls and floors; their
    faces registered with R (owner "gj": Grinjuku's, "code": the live
    layer's), so the obstruction test checks them too."""
    S = Space()
    for face, what, t0, t1, y, h, o0, o1 in ST["upper"]:
        if on_main(face):
            lo, hi = fbox(face, t0, t1, y, y + h, min(o0, 0.0), max(o1, 0.02))
            S.add(lo, hi, what)
    for (x, z, r, y0, y1) in ST["lanterns"]:
        S.add([x - r * 0.7, y0, z - r * 0.7], [x + r * 0.7, y1, z + r * 0.7], "lantern")      # (its inscribed box: it is round)
    for face, t, y0, height, out in ST["kanban"]:
        if on_main(face):
            lo, hi = fbox(face, t - 0.15, t + 0.15, y0, y0 + height, 0.0, 0.12 + out + 0.02)
            S.add(lo, hi, "kanban")
    nf = 0
    for i, (face, t0, t1, kind) in enumerate(ST["shops"]):
        if not on_main(face) or t1 - t0 < 1.4:
            continue
        n = (face.n, 0, 0)
        mid = (t0 + t1) / 2
        x, z = face.world(mid, 0.0)
        if not (MAIN_Z[0] - 0.5 < z < MAIN_Z[1] + 0.5) or cleared(x, 1.5, z) or behind_studio(x, z):
            continue
        top = 3.37 if kind in ("pachinko", "karaoke") else 3.33
        lo, hi = fbox(face, t0 + 0.1, t1 - 0.1, 2.74, top + 0.02, 0.0, 0.31)
        S.add(lo, hi, "sign band")
        if kind in ("glass", "ramen"):
            lo, hi = fbox(face, t0 + 0.15, t1 - 0.15, 2.3, 2.95, 0.0, 0.9)
            S.add(lo, hi, "awning")
        if kind in ("izakaya", "ramen"):
            lo, hi = fbox(face, t0 + 0.35, t1 - 0.35, 1.7, 2.45, 0.0, 0.06)
            S.add(lo, hi, "noren")
        g0, g1 = t0, t1                                          # (the glass keeps the whole run)
        for x0, x1, y0, y1, z0, z1 in BAND_CUTS:                # (cut back clear of the club's front)
            fx, _ = face.world(mid, 0.2)
            if x0 <= fx <= x1:
                za, zb = face.world(t0, 0.0)[1], face.world(t1, 0.0)[1]
                if min(za, zb) < z0 < max(za, zb):
                    tc = t0 + (z0 - za) / (zb - za) * (t1 - t0)
                    t0, t1 = (t0, tc) if za < zb else (tc, t1)
                    mid = (t0 + t1) / 2
        bx, bz = face.world(mid, 0.31 if kind in ("pachinko", "karaoke") else 0.26)
        c = (bx, (2.78 + top) / 2, bz)
        R.face(f"band:{i}", "gj", c, n, t1 - t0 - 0.2, top - 2.78)
        S.front(f"band:{i}", c, n, t1 - t0 - 0.2, top - 2.78)
        nf += 1
        if kind not in ("shutter", "ramen"):          # (a ramen bay's glass is cut: its front is ramen_front's)
            gx, gz = face.world((g0 + g1) / 2, 0.0)
            R.face(f"glass:{i}", "gj", (gx, 1.5, gz), n, g1 - g0 - 0.7, 2.2)
            S.front(f"glass:{i}", (gx, 1.5, gz), n, g1 - g0 - 0.7, 2.2)
            nf += 1
    for s in SIGNS:
        kind, x, y, z, nx, nz, g, slots = s[:8]
        if kind != "col" or not (MAIN_Z[0] < z < MAIN_Z[1]):
            continue
        if not (MAINS["a"][0] - 0.2 < x < MAINS["a"][1] + 1.5 or MAINS["b"][0] - 1.5 < x < MAINS["b"][1] + 0.2):
            continue
        h = slots * g * 1.1
        if not (MAIN_Z[0] < z + nz * 0.5 < MAIN_Z[1]):
            continue        # a blade's face looking off the Main (into the club's front): no one sees it
        R.face(f"kanban:{nf}", "gj", (x, y, z), (nx, 0, nz), g, h)
        S.front(f"kanban:{nf}", (x, y, z), (nx, 0, nz), g, h)
        nf += 1
    for fid, c, n, w, h in extra_faces:
        R.face(fid, "code", c, n, w, h)
        S.front(fid, c, n, w, h)
        nf += 1
    for p in CLUB["boxes"]:
        x, z, w, d, h, y = p["b"]
        S.add([x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], "studio")
    for hh in CLUB["heroes"]:
        S.add(hh["lo"], hh["hi"], "studio hero")
    for c in KB["colliders"]:
        x, z, w, d, h, y = c[:6]
        if h < 30:
            S.add([x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], "collider")
    print(f"  street: {len(S.boxes)} things on the Mains, {nf} faces registered")
    return S


# ---- the props

def drainpipe(b, P, R, pid, face, t, top, r=0.03, o=0.145):
    """A downpipe off the roof: a hopper under the parapet, brackets back to
    the wall every 1.6 m, a shoe at the foot over a gully grate."""
    R.begin(b, pid)
    x, z = face.world(t, o)
    b.cyl(P["downpipe"], r, (x, 0.3, z), (x, top - 0.6, z), seg=6, caps=False)
    face.box(b, P["downpipe"], t - 0.09, t + 0.09, top - 0.62, 0.2, o - 0.08, o + 0.07)           # the hopper
    face.box(b, P["downpipe"], t - 0.03, t + 0.03, top - 0.42, 0.26, 0.0, o - 0.07)               # its outlet from the roof
    y = 1.2
    while y < top - 1.0:
        face.box(b, P["iron"], t - 0.045, t + 0.045, y, 0.04, 0.0, o + r + 0.008)
        y = 4.4 if y < 4.4 else y + 3.1                 # mid-storey, clear of the floors' ledges
    sx, sz = face.world(t, o + 0.11)
    b.cyl(P["downpipe"], r, (x, 0.32, z), (sx, 0.06, sz), seg=6, caps=False)                        # the shoe
    face.box(b, P["iron"], t - 0.13, t + 0.13, 0.0, 0.016, o - 0.05, o + 0.25)                       # the gully's grate
    R.end()
    lo, hi = fbox(face, t - 0.06, t + 0.06, 0.0, 2.4, 0.0, o + 0.17)
    R.collider((lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2, hi[0] - lo[0], hi[2] - lo[2], 2.4, 0, pen=4)


def ac_unit(b, P, R, pid, face, t, y, w=0.6, h=0.46, d=0.24, o=0.12):
    """A split AC's outdoor unit on wall brackets: the fan behind its round
    grille, louvres on the right, the pipes' cover off its end."""
    R.begin(b, pid)
    face.box(b, P["ac_body"], t - w / 2, t + w / 2, y, h, o, o + d)
    fx = t - w * 0.17
    disc(b, P["ac_fan"], face_pt(face, fx, y + h / 2, o + d + 0.004), face_n(face), h * 0.36, 10)
    for k in range(3):
        face.quad(b, P["ac_fan"], t + w * 0.1, t + w * 0.45, y + 0.1 + k * 0.1, 0.03, o + d + 0.002)
    face.box(b, P["iron"], t - w * 0.4, t + w * 0.4, y - 0.04, 0.04, 0.0, o + d)          # the bracket's rail
    face.box(b, P["pole_dk"], t + w / 2, t + w / 2 + 0.05, y + 0.08, 0.05, 0.02, o + 0.06)
    R.end()


def sag(b, m, a, c, drop, segs=6, r=0.012):
    """A wire hanging from a to c, `drop` lower at its middle."""
    pts = []
    for i in range(segs + 1):
        k = i / segs
        pts.append((a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k - drop * 4 * k * (1 - k), a[2] + (c[2] - a[2]) * k))
    for p, q in zip(pts, pts[1:]):
        b.cyl(m, r, p, q, seg=3, caps=False)


def power_pole(b, P, R, pid, x, z, arm, H=10.5):
    """A concrete utility pole (denchu): tapered, grimy at the foot, its
    yellow number plate, step bolts, two crossarms with insulators, a
    transformer drum, a street lamp on an arm over the road (`arm`, (dx,
    dz)). Returns the insulator tips the wires hang from."""
    R.begin(b, pid)
    b.cyl(P["pole"], 0.17, (x, 0, z), (x, H, z), r2=0.12, seg=8, caps=False)
    b.cyl(P["pole_dk"], 0.176, (x, 0, z), (x, 0.55, z), r2=0.173, seg=8, caps=False)
    b.cyl(P["pole"], 0.12, (x, H, z), (x, H + 0.04, z), seg=8)
    ax, az = arm
    px, pz = -az, ax
    b.box(P["yellow"], 0.2 if az else 0.03, 0.42, 0.03 if az else 0.2, x + ax * 0.17, 1.9, z + az * 0.17)
    for k in range(8):
        sy, s = 2.6 + k * 0.45, (1 if k % 2 else -1)
        b.cyl(P["iron"], 0.012, (x + px * 0.12 * s, sy, z + pz * 0.12 * s), (x + px * 0.32 * s, sy, z + pz * 0.32 * s), seg=4, caps=False)
    tips = []
    for y, half in ((H - 0.35, 0.85), (H - 1.05, 0.7)):
        b.bar(P["iron_lt"], (x - px * half, y, z - pz * half), (x + px * half, y, z + pz * half), 0.07, 0.07)
        for k in (-1, -0.35, 0.35, 1):
            ix, iz = x + px * half * k * 0.92, z + pz * half * k * 0.92
            b.cyl(P["insulator"], 0.035, (ix, y + 0.035, iz), (ix, y + 0.16, iz), seg=6, r2=0.025)
            tips.append((ix, y + 0.16, iz))
    tx, tz = x - ax * 0.45, z - az * 0.45
    b.cyl(P["drum"], 0.26, (tx, H - 3.1, tz), (tx, H - 2.2, tz), seg=10)
    b.cyl(P["drum"], 0.2, (tx, H - 2.2, tz), (tx, H - 2.12, tz), seg=10)
    for y in (H - 2.95, H - 2.35):
        b.bar(P["iron"], (x, y, z), (tx, y, tz), 0.05, 0.05)
    b.cyl(P["insulator"], 0.03, (tx, H - 2.12, tz), (tx, H - 1.95, tz), seg=6)
    b.cyl(P["iron"], 0.008, (tx, H - 1.95, tz), tips[0], seg=3, caps=False)
    ly = 5.4
    lx, lz = x + ax * 1.35, z + az * 1.35
    b.cyl(P["iron_lt"], 0.03, (x + ax * 0.12, ly - 0.35, z + az * 0.12), (lx, ly, lz), seg=5, caps=False)
    b.box(P["iron_lt"], 0.5 if ax else 0.22, 0.08, 0.22 if ax else 0.5, lx + ax * 0.1, ly - 0.04, lz + az * 0.1)
    b.box(P["lamp"], 0.42 if ax else 0.16, 0.012, 0.16 if ax else 0.42, lx + ax * 0.1, ly - 0.05, lz + az * 0.1)
    R.end()
    R.collider(x, z, 0.38, 0.38, H, 0, pen=4)
    return tips


def manhole(b, P, R, pid, x, z, r=0.32, spin=0.0):
    """A cast-iron cover flush with the road: its rim, the raised spokes, the
    ward's mark in the middle."""
    R.begin(b, pid)
    disc(b, P["iron_lt"], (x, 0.008, z), (0, 1, 0), r + 0.04, 14)
    disc(b, P["iron"], (x, 0.012, z), (0, 1, 0), r, 14)
    for k in range(6):
        c, s = math.cos(k * math.pi / 3 + spin), math.sin(k * math.pi / 3 + spin)
        strip(b, P["iron_lt"], (x + c * r * 0.25, 0.015, z + s * r * 0.25), (x + c * r * 0.9, 0.015, z + s * r * 0.9), 0.03)
    disc(b, P["iron_lt"], (x, 0.016, z), (0, 1, 0), r * 0.24, 8)
    R.end()


def gutter_grate(b, P, R, pid, face, t, o, L=0.9):
    """A U-ditch grating along the kerb: a frame and its bars."""
    R.begin(b, pid)
    strip(b, P["iron"], face_pt(face, t - L / 2, 0.012, o), face_pt(face, t + L / 2, 0.012, o), 0.34)
    k = t - L / 2 + 0.05
    while k < t + L / 2 - 0.03:
        strip(b, P["iron_lt"], face_pt(face, k, 0.016, o - 0.15), face_pt(face, k, 0.016, o + 0.15), 0.024)
        k += 0.075
    R.end()


def bollard(b, P, R, pid, x, z):
    """A steel car stop (kurumadome): a post with a yellow band."""
    R.begin(b, pid)
    b.cyl(P["bike_s"], 0.055, (x, 0, z), (x, 0.82, z), seg=8, caps=False)
    b.cyl(P["bike_s"], 0.055, (x, 0.82, z), (x, 0.86, z), seg=8, r2=0.03)
    b.cyl(P["yellow"], 0.057, (x, 0.62, z), (x, 0.72, z), seg=8, caps=False)
    R.end()
    R.collider(x, z, 0.16, 0.16, 0.86, 0, pen=4)


def bicycle(b, P, R, pid, f, col, on=None):
    """A mamachari on its stand, in frame f (along local x, the front at
    +x): tyres, spokes, the step-through frame, basket, seat, bars."""
    R.begin(b, pid, on=on)
    for lx in (-0.52, 0.52):
        f.cyl(b, P["rubber"], 0.33, (lx, 0.33, -0.022), (lx, 0.33, 0.022), seg=12, caps=False)    # the tyre: a ring
        f.bar(b, P["bike_s"], (lx, 0.04, 0), (lx, 0.62, 0), 0.012)                                 # spokes, crossed
        f.bar(b, P["bike_s"], (lx - 0.29, 0.33, 0), (lx + 0.29, 0.33, 0), 0.012)
    f.bar(b, col, (-0.08, 0.36, 0), (0.42, 0.62, 0), 0.04)
    f.bar(b, col, (-0.08, 0.36, 0), (-0.2, 0.82, 0), 0.04)
    f.bar(b, col, (-0.08, 0.36, 0), (-0.52, 0.33, 0), 0.03)
    f.bar(b, col, (-0.2, 0.8, 0), (-0.52, 0.33, 0), 0.025)
    f.bar(b, col, (0.42, 0.62, 0), (0.52, 0.33, 0), 0.03)
    f.bar(b, P["bike_s"], (0.42, 0.62, 0), (0.36, 0.98, 0), 0.03)
    f.bar(b, P["bike_s"], (0.32, 0.98, -0.28), (0.32, 0.98, 0.28), 0.025)
    f.box(b, P["black"], 0.24, 0.06, 0.13, -0.22, 0.84, 0)
    f.box(b, P["bike_s"], 0.26, 0.2, 0.34, 0.66, 0.66, 0)
    f.box(b, col, 0.16, 0.06, 0.12, -0.08, 0.27, 0.03)
    f.box(b, P["bike_s"], 0.4, 0.02, 0.12, -0.42, 0.6, 0)
    R.end()


def cone(b, P, R, pid, x, z):
    R.begin(b, pid)
    b.box(P["rubber"], 0.36, 0.035, 0.36, x, 0, z)
    b.cyl(P["cone_or"], 0.13, (x, 0.035, z), (x, 0.55, z), r2=0.025, seg=8, caps=False)     # (under 0.6 m: no collider)
    b.cyl(P["white"], 0.098, (x, 0.3, z), (x, 0.42, z), r2=0.074, seg=8, caps=False)
    R.end()


def recycle_bins(b, P, R, pid, face, t, o=0.3):
    """The ward's two bins by the wall: cans (blue), bottles (yellow)."""
    R.begin(b, pid)
    for k, m in ((-0.24, P["bin_bl"]), (0.24, P["bin_ye"])):
        x, z = face.world(t + k, o)
        b.cyl(m, 0.2, (x, 0, z), (x, 0.72, z), seg=10, r2=0.22)
        b.cyl(P["black"], 0.13, (x, 0.72, z), (x, 0.76, z), seg=10)
    R.end()
    lo, hi = fbox(face, t - 0.48, t + 0.48, 0, 0.76, o - 0.24, o + 0.24)
    R.collider((lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2, hi[0] - lo[0], hi[2] - lo[2], 0.76, 0, pen=3)


# the live layer's faces on the street (kabukigrin.js, kabukigrin-street.js):
# [id, centre, outward normal, width, height]
STREET_CODE_FACES = [
    ["screen-amain", (-23.47, 5.65, -2.6), (-1, 0, 0), 11.2, 5.6],
    ["pachinko-glass", (-31.59, 1.51, -15.25), (1, 0, 0), 17.8, 2.46],
    ["pachinko-sign", (-31.0, 4.44, -15.25), (1, 0, 0), 18.5, 1.62],
    ["vending-a", (-23.92, 1.0, -13.0), (-1, 0, 0), 1.9, 1.8],
    ["vending-b", (23.92, 1.0, -13.0), (1, 0, 0), 1.9, 1.8],
    ["ramen-menu", (21.0, 1.58, 30.929), (0, 0, -1), 2.34, 0.5],
    ["ramen-noren", (21.0, 2.14, 30.31), (0, 0, -1), 3.9, 0.48],
]
# where the screen's bezel stands (an obstacle as well as a face)
SCREEN_BOX = ([-23.62, 2.5, -8.36], [-23.0, 8.8, 3.16])


def furnish(b, P, R, ST, S, rng):
    """The Mains' furniture, every spot checked against S first."""
    P = street_palette(P)
    S.add(*SCREEN_BOX, "screen")
    n = {"pipe": 0, "ac": 0, "skip": {}}

    def skip(why):
        n["skip"][why] = n["skip"].get(why, 0) + 1

    # ---- drainpipes where two street buildings meet (the sign bands leave a
    # 0.2 m gap there, the windows keep 0.38 m off it)
    by_face = {}
    for face, t0, t1, base, top, street in ST["buildings"]:
        if on_main(face):
            by_face.setdefault(id(face), (face, []))[1].append((t0, t1, base, top, street))
    for face, runs in by_face.values():
        runs.sort()
        for (a0, a1, ab, atop, ast), (b0, b1, bb, btop, bst) in zip(runs, runs[1:]):
            if abs(a1 - b0) > 0.01 or ab > 0.1 or bb > 0.1 or not (ast and bst):
                continue
            t = a1
            x, z = face.world(t, 0.0)
            if not (MAIN_Z[0] + 0.5 < z < MAIN_Z[1] - 0.5) or rng.random() > 0.7:
                continue
            top = min(atop, btop)
            # the shoe and its grate, the pipe up the pilasters' gap (the
            # lanterns hang 0.18 m either side of it), the hopper's height
            parts = [fbox(face, t - 0.14, t + 0.14, 0.0, 0.32, 0.125, 0.42),
                     fbox(face, t - 0.05, t + 0.05, 0.32, 3.4, 0.125, 0.18),
                     fbox(face, t - 0.1, t + 0.1, 3.4, top - 0.35, 0.125, 0.25)]
            why = next((w for w in (S.clash(lo, hi) for lo, hi in parts) if w), None)
            if why:
                skip("pipe: " + why.split(":")[0])
                continue
            for lo, hi in parts:
                S.add(lo, hi, "pipe")
            drainpipe(b, P, R, f"pipe-{n['pipe']}", face, t, top)
            n["pipe"] += 1

    # ---- AC units in the gaps between windows (never in front of one), on
    # their brackets just over the floor's ledge
    rows = {}
    for face, what, t0, t1, y, h, o0, o1 in ST["upper"]:
        if what == "window" and on_main(face) and abs(h - 1.55) < 0.01:
            rows.setdefault((id(face), round(y, 2)), (face, y, []))[2].append((t0, t1))
    budget = {"a": 10, "b": 10}
    for face, y, wins in rows.values():
        wins.sort()
        side = "a" if face.at < 0 else "b"
        for (p0, p1), (q0, q1) in zip(wins, wins[1:]):
            gap = q0 - p1
            if gap < 0.8 or budget[side] <= 0 or rng.random() > 0.45:
                continue
            t = (p1 + q0) / 2
            yf = y - 0.8
            x, z = face.world(t, 0.0)
            if not (MAIN_Z[0] < z < MAIN_Z[1]):
                continue
            lo, hi = fbox(face, t - 0.36, t + 0.36, yf + 0.17, yf + 0.68, 0.0, 0.4)
            why = S.clash(lo, hi)
            if why:
                skip("ac: " + why.split(":")[0])
                continue
            S.add(lo, hi, "ac")
            ac_unit(b, P, R, f"ac-{n['ac']}", face, t, yf + 0.2)
            budget[side] -= 1
            n["ac"] += 1

    # ---- the power poles at the Mains' mouths (the only street-side spots
    # in front of no shop: the block's corner), the lamp over the road, and
    # their wires: across the Main and up it to the walls, along the cross
    # street to the next block
    poles = {"a": (-24.3, -32.5, (-1, 0)), "b": (24.3, -32.5, (1, 0))}
    for side, (x, z, arm) in poles.items():
        lo, hi = [x - 0.2, 0, z - 0.2], [x + 0.2, 10.6, z + 0.2]
        why = S.clash(lo, hi)
        if why:
            skip("pole: " + why)
            continue
        S.add(lo, hi, "pole")
        tips = power_pole(b, P, R, f"pole-{side}", x, z, arm)
        sx = -1 if side == "a" else 1
        wall_far, wall_near = MAINS[side][0 if side == "a" else 1], MAINS[side][1 if side == "a" else 0]
        targets = [((wall_far - sx * 0.08, 8.6, -30.2), tips[0]), ((wall_far - sx * 0.08, 7.9, -29.4), tips[4]),
                   ((wall_near + sx * 0.08, 8.3, -25.6), tips[3]), ((sx * 15.0, 9.4, -32.08), tips[2]),
                   ((sx * 15.0, 8.7, -32.08), tips[6])]
        for to, tip in targets:
            ok = True
            for k in range(1, 20):
                f = k / 20
                p = [tip[i] + (to[i] - tip[i]) * f for i in range(3)]
                p[1] -= 0.5 * 4 * f * (1 - f)
                if any(S._cross([p[0] - 0.03, p[1] - 0.03, p[2] - 0.03], [p[0] + 0.03, p[1] + 0.03, p[2] + 0.03], a, c, 0.0)
                       for a, c, tag in S.boxes if tag in ("kanban", "window", "ac", "balcony", "box", "studio", "studio hero")):
                    ok = False
                    break
            if not ok:
                skip("wire")
                continue
            sag(b, P["cable"], tip, to, 0.5)
            b.box(P["iron"], 0.08, 0.08, 0.08, to[0], to[1] - 0.04, to[2])        # its hook on the wall
        # two car stops at the corner, by the pole
        for k, dz in enumerate((-1.05, -1.75)):
            bx, bz = x + (0.7 if side == "a" else -0.7), z + dz
            lo, hi = [bx - 0.09, 0, bz - 0.09], [bx + 0.09, 0.86, bz + 0.09]
            if S.take(lo, hi, "bollard"):
                bollard(b, P, R, f"bollard-{side}{k}", bx, bz)
            else:
                skip("bollard")

    # ---- manholes in the lanes, gratings along the kerbs
    for i, (x, z) in enumerate(((-27.1, -27.2), (-26.5, -9.4), (26.9, -25.8), (26.4, -10.6), (-27.4, 0.6), (27.2, 1.2))):
        if S.take([x - 0.36, 0, z - 0.36], [x + 0.36, 0.03, z + 0.36], "manhole"):
            manhole(b, P, R, f"manhole-{i}", x, z, spin=rng.uniform(0, 1))
        else:
            skip("manhole")
    k = 0
    for face, runs in by_face.values():
        for zz in (-29.0, -22.5, -15.5, -8.5, -1.5):
            t = zz - face.t0
            if not any(r[0] + 0.5 < t < r[1] - 0.5 for r in runs):
                continue
            lo, hi = fbox(face, t - 0.46, t + 0.46, 0, 0.03, 1.08, 1.42)
            why = S.clash(lo, hi)
            if why:
                skip("grate: " + why.split(":")[0])
                continue
            S.add(lo, hi, "grate")
            gutter_grate(b, P, R, f"grate-{k}", face, t, 1.25)
            k += 1

    # ---- bikes along the shuttered shops (no glass, the sign band over
    # their heads), the ward's bins at the end of the row
    bikes = 0
    for face, t0, t1, kind in ST["shops"]:
        if kind != "shutter" or not on_main(face):
            continue
        x, z = face.world((t0 + t1) / 2, 0.0)
        if not (MAIN_Z[0] < z < MAIN_Z[1]):
            continue
        a, c = t0 + 0.5, t1 - 1.4
        cols = [P["bike_r"], P["bike_s"], P["bike_b"], P["bike_w"]]
        lo, hi = fbox(face, a - 0.1, c + 0.1, 0, 1.1, 0.12, 1.0)
        if not S.take(lo, hi, "bikes"):
            skip("bikes")
            continue
        tt = a + 0.55
        while tt < c - 0.5:
            ang = 0.32
            d = (face.n * math.sin(ang), math.cos(ang))          # (x, z): along the wall, nosed out
            ox, oz = face.world(tt, 0.56)
            bicycle(b, P, R, f"bike-{bikes}", At(ox, 0, oz, math.atan2(-d[1], d[0])), cols[bikes % len(cols)], on=f"bikes-{int(t0)}")
            bikes += 1
            tt += 0.62
        R.collider((lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2, hi[0] - lo[0], hi[2] - lo[2], 1.1, 0, pen=2)
        lo, hi = fbox(face, c + 0.35, c + 1.3, 0, 0.8, 0.05, 0.55)
        if S.take(lo, hi, "bins"):
            recycle_bins(b, P, R, f"bins-{bikes}", face, c + 0.82)
        else:
            skip("bins")

    # ---- cones behind the parked kei trucks
    for i, (x, z) in enumerate(((-27.0, -21.7), (-28.15, -22.1), (27.0, -21.7), (28.15, -22.1))):
        if S.take([x - 0.18, 0, z - 0.18], [x + 0.18, 0.56, z + 0.18], "cone"):
            cone(b, P, R, f"cone-{i}", x, z)
        else:
            skip("cone")
    print(f"  street: {n['pipe']} drainpipes, {n['ac']} AC units, {bikes} bikes; skipped {n['skip']}")


# ------------------------------------------------------------- phase 3: the hero props

def kei_truck(b, P, R, pid, x, z, ry, rng):
    """A white kei truck (a Carry / Hijet) parked in the lane, filling the
    collider Grinjuku gave its box truck (2 x 4.4 x 1.7, cab to +z): the
    cab-over front with its raked windscreen, the black bumper and grille,
    round lamps, the yellow kei plate, mirrors on stalks; the flatbed with
    its three drop-sides, the headboard guard, beer crates for the club."""
    f = At(x, 0, z, ry)
    R.begin(b, pid)
    W, L = 1.72, 4.2
    zf, zc = L / 2, L / 2 - 1.45           # the front, the cab's back
    wh = P["truck_w"]
    # the chassis, the wheels in their arches
    f.box(b, P["black"], W - 0.3, 0.22, L - 0.4, 0, 0.18, 0)
    for lz in (zf - 0.62, -L / 2 + 0.75):
        for s in (-1, 1):
            f.cyl(b, P["rubber"], 0.29, (s * (W / 2 - 0.2), 0.29, lz), (s * (W / 2 - 0.02), 0.29, lz), seg=10)
            disc(b, P["bike_s"], f.p(s * (W / 2 - 0.015), 0.29, lz), (s * f.c, 0, -s * f.s), 0.15, 8)
    # the cab: one bevelled box, the windscreen raked back from the bonnet line
    f.box(b, wh, W, 0.62, 1.45, 0, 0.42, zf - 0.725, bevel=0.05)
    pts = [(-W / 2 + 0.02, 1.04, zf - 0.02), (W / 2 - 0.02, 1.04, zf - 0.02), (W / 2 - 0.02, 1.04, zc + 0.02), (-W / 2 + 0.02, 1.04, zc + 0.02),
           (-W / 2 + 0.06, 1.7, zf - 0.32), (W / 2 - 0.06, 1.7, zf - 0.32), (W / 2 - 0.06, 1.7, zc + 0.04), (-W / 2 + 0.06, 1.7, zc + 0.04)]
    W_ = [f.p(*p) for p in pts]
    mid = [sum(p[i] for p in W_) / 8 for i in range(3)]
    for q in ([4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [2, 3, 7, 6], [0, 1, 5, 4]):
        c = [sum(W_[k][i] for k in q) / 4 for i in range(3)]
        _facing(b, wh, [W_[k] for k in q], [c[i] - mid[i] for i in range(3)])
    glass = P["glass_dk"]
    # windscreen, the side windows, the back window (just in from the cab's skin)
    ws = [(-W / 2 + 0.12, 1.1, zf - 0.039), (W / 2 - 0.12, 1.1, zf - 0.039), (W / 2 - 0.13, 1.64, zf - 0.285), (-W / 2 + 0.13, 1.64, zf - 0.285)]
    _facing(b, glass, [f.p(*p) for p in ws], (f.s, 0, f.c))
    for s in (-1, 1):
        xs = s * (W / 2 - 0.02 + 0.005)
        sw = [(xs, 1.1, zf - 0.1), (xs, 1.1, zc + 0.15), (s * (W / 2 - 0.048), 1.62, zc + 0.15), (s * (W / 2 - 0.048), 1.62, zf - 0.36)]
        _facing(b, glass, [f.p(*p) for p in sw], (s * f.c, 0, -s * f.s))
        f.box(b, P["black"], 0.012, 0.66, 0.012, s * (W / 2 + 0.003), 0.42, zc + 0.75)          # the door's shut line
        f.box(b, P["black"], 0.03, 0.03, 0.14, s * (W / 2 + 0.01), 0.92, zc + 0.6)              # its handle
        # the mirror on its stalk
        f.bar(b, P["black"], (s * (W / 2 - 0.05), 1.1, zf - 0.15), (s * (W / 2 + 0.16), 1.22, zf - 0.08), 0.02)
        f.box(b, P["black"], 0.05, 0.18, 0.11, s * (W / 2 + 0.17), 1.15, zf - 0.08)
        # round lamps, the amber indicator outboard
        disc(b, P["lamp_off"], f.p(s * (W / 2 - 0.3), 0.66, zf + 0.005), (f.s, 0, f.c), 0.085, 10)
        f.box(b, P["amber_off"], 0.12, 0.07, 0.01, s * (W / 2 - 0.12), 0.63, zf + 0.002)
        # tail lights on the bed's rear
        f.box(b, P["red_lamp"], 0.16, 0.08, 0.01, s * (W / 2 - 0.16), 0.5, -L / 2 - 0.005)
    f.box(b, glass, W - 0.4, 0.42, 0.01, 0, 1.16, zc - 0.005)                                     # back window
    f.box(b, P["black"], W - 0.5, 0.16, 0.012, 0, 0.6, zf)                                        # grille
    f.box(b, P["black"], W + 0.04, 0.16, 0.14, 0, 0.3, zf + 0.02)                                 # bumper
    f.box(b, P["yellow"], 0.34, 0.17, 0.012, 0, 0.32, zf + 0.093)                                 # the kei plate
    f.box(b, P["black"], 0.3, 0.025, 0.013, 0, 0.36, zf + 0.094)
    f.box(b, P["black"], 0.04, 0.4, 0.04, 0, 1.7, zf - 0.6)                                       # the roof's aerial
    # the bed: its floor, three drop-sides, the headboard guard
    zb0, zb1 = -L / 2, zc - 0.06
    f.box(b, wh, W, 0.06, zb1 - zb0, 0, 0.62, (zb0 + zb1) / 2)
    for s in (-1, 1):
        f.box(b, wh, 0.04, 0.3, zb1 - zb0, s * (W / 2 - 0.02), 0.68, (zb0 + zb1) / 2)
        for k in range(3):
            f.box(b, P["black"], 0.05, 0.02, 0.04, s * (W / 2 + 0.005), 0.86, zb0 + 0.3 + k * (zb1 - zb0 - 0.6) / 2)   # the latches
    f.box(b, wh, W, 0.3, 0.04, 0, 0.68, zb0 + 0.02)
    for s in (-1, 1):
        f.box(b, P["black"], 0.05, 1.12, 0.05, s * (W / 2 - 0.06), 0.68, zb1 - 0.03)
    for yy in (1.2, 1.5, 1.77):
        f.box(b, P["black"], W - 0.1, 0.04, 0.04, 0, yy, zb1 - 0.03)
    # what's on the bed: beer crates for the club, two stacks and a loose one
    cols = [P["crate_y"], P["crate_r"]]
    for i, (lx, lz, n) in enumerate(((-0.42, zb0 + 0.45, 3), (-0.42, zb0 + 0.85, 2), (0.15, zb0 + 0.45, 2), (0.42, zb1 - 0.5, 1))):
        for k in range(n):
            f.box(b, cols[(i + k) % 2], 0.46, 0.27, 0.36, lx, 0.68 + k * 0.28, lz, ry=rng.uniform(-0.06, 0.06))
            f.box(b, P["black"], 0.4, 0.012, 0.3, lx, 0.68 + k * 0.28 + 0.262, lz)
    R.end()


def crate_stack(b, P, R, pid, x, z, w, d, h, ry, rng):
    """Grinjuku's crate pile redrawn, in its own collider (w x d x h): a
    pallet, beer crates in columns on it (one in three tops full of brown
    bottles, the rest empty), a taped carton on one, a hand truck at the end."""
    f = At(x, 0, z, ry)
    R.begin(b, pid)
    cw, ch, cd = 0.46, 0.27, 0.36
    truck = d >= 2.2                       # (the long piles leave room for it)
    nx, nz = max(1, int((w - 0.04) / (cw + 0.02))), max(1, int((d - (0.75 if truck else 0.04)) / (cd + 0.02)))
    pw, pd = nx * (cw + 0.02) + 0.02, nz * (cd + 0.02) + 0.02
    oz = -(d - pd) / 2 + 0.03 if truck else 0.0
    # the pallet: three runners, the deck
    for k in (-1, 0, 1):
        f.box(b, P["pallet"], pw, 0.09, 0.09, 0, 0, oz + k * (pd / 2 - 0.045))
    f.box(b, P["pallet"], pw, 0.03, pd, 0, 0.09, oz)
    top = int((h - 0.12) / (ch + 0.01))
    cols = [P["crate_y"], P["crate_r"], P["crate_y"]]
    carton = rng.randrange(nx * nz)
    for i in range(nx):
        for j in range(nz):
            lx, lz = -pw / 2 + 0.02 + (i + 0.5) * (cw + 0.02), oz - pd / 2 + 0.02 + (j + 0.5) * (cd + 0.02)
            n = rng.randint(max(1, top - 1), top) if i * nz + j != carton else top - 1
            col = rng.choice(cols)
            for k in range(n):
                y = 0.12 + k * (ch + 0.01)
                f.box(b, col, cw, ch, cd, lx, y, lz)
                # the hand holes on the pile's outside faces
                for (dx, dz, hw) in ((0, -1, 0.07), (0, 1, 0.07), (-1, 0, 0.05), (1, 0, 0.05)):
                    if (dz == -1 and j == 0) or (dz == 1 and j == nz - 1) or (dx == -1 and i == 0) or (dx == 1 and i == nx - 1):
                        cx, cz = lx + dx * (cw / 2 + 0.002), lz + dz * (cd / 2 + 0.002)
                        ax, az = (hw, 0) if dz else (0, hw)
                        _facing(b, P["black"], [f.p(cx - ax, y + 0.19, cz - az), f.p(cx + ax, y + 0.19, cz + az), f.p(cx + ax, y + 0.23, cz + az), f.p(cx - ax, y + 0.23, cz - az)], (dx * f.c + dz * f.s, 0, -dx * f.s + dz * f.c))
            y = 0.12 + n * (ch + 0.01) - 0.01
            _facing(b, P["black"], [f.p(lx - cw / 2 + 0.025, y + 0.003, lz - cd / 2 + 0.025), f.p(lx + cw / 2 - 0.025, y + 0.003, lz - cd / 2 + 0.025), f.p(lx + cw / 2 - 0.025, y + 0.003, lz + cd / 2 - 0.025), f.p(lx - cw / 2 + 0.025, y + 0.003, lz + cd / 2 - 0.025)], (0, 1, 0))   # into the top crate, inside its rim
            if i * nz + j == carton:
                f.box(b, P["card"], cw + 0.02, ch, cd + 0.04, lx, y, lz, ry=rng.uniform(-0.1, 0.1))
                f.box(b, P["tape"], 0.07, 0.004, cd + 0.042, lx, y + ch, lz)
            elif rng.random() < 0.34:
                q = lambda m, cx, cz, r, yy: _facing(b, m, [f.p(cx - r, yy, cz - r), f.p(cx + r, yy, cz - r), f.p(cx + r, yy, cz + r), f.p(cx - r, yy, cz + r)], (0, 1, 0))  # noqa: E731
                f.box(b, P["bottle"], cw - 0.06, 0.05, cd - 0.06, lx, y - 0.04, lz)      # the bottles, shoulder to shoulder
                for bi in range(4):
                    for bj in range(3):
                        q(P["cap"], lx - cw / 2 + (bi + 0.5) * cw / 4, lz - cd / 2 + (bj + 0.5) * cd / 3, 0.016, y + 0.0105)
    # a hand truck stood at one end (inside the collider)
    if truck:
        e = oz + pd / 2 + 0.2
        for s in (-1, 1):
            f.bar(b, P["iron"], (s * 0.17, 0.08, e), (s * 0.17, 1.12, e + 0.12), 0.026)
            f.cyl(b, P["rubber"], 0.09, (s * 0.21, 0.09, e - 0.02), (s * 0.15, 0.09, e - 0.02), seg=8)
        for yy in (0.4, 0.75, 1.1):
            f.bar(b, P["iron"], (-0.17, yy, e + yy * 0.11), (0.17, yy, e + yy * 0.11), 0.02)
        f.box(b, P["iron"], 0.38, 0.015, 0.2, 0, 0.0, e - 0.1)
    R.end()


# The pachinko parlour's inside (A Main's west wall, Studio's front at
# kabukigrin-street.js PACHINKO): Studio's glass looked onto a painted
# canvas; now a real room 3.3 m deep behind it (the shell is cut open there
# after the unwrap, build_kabukigrin PARLOUR_CUT). Six islands of machines
# run back from the glass, one behind each of the front's mullions, so every
# pane looks down an aisle: the machines on both sides, their ball fields
# and screens, the data lamps on top, a stool at each. Its own object and
# paint (KB_Parlour), lit from inside by kabukigrin-street.js, and its
# screens' material (KB_PachiScreen) run by it too.
PARLOUR = {"x": -31.6, "back": -35.6, "z0": -24.15, "z1": -6.35, "floor": 0.28, "ceil": 3.0,
           "door": (-16.87, -13.63), "islands": [-21.85, -19.55, -17.25, -12.65, -10.35, -8.05]}


def parlour_palette(P):
    from map_kit import mat
    f = lambda name, c, r=0.6: mat("KBP_" + name, c, r)   # noqa: E731
    return {
        "carpet": f("Carpet", 0x5a0c1c, 0.95),
        "carpet_gold": f("CarpetGold", 0x9a7030, 0.9),
        "ceiling": f("Ceiling", 0xd8d4d6, 0.8),
        "wall": f("Mirror", 0x3a2a38, 0.25),
        "wall_band": f("WallBand", 0xc8a040, 0.4),
        "spine": f("Spine", 0x18141a, 0.4),
        "counter": f("Counter", 0x2a1a20, 0.5),
        "lip": f("Lip", 0xb8bcc4, 0.3),
        "field": f("BallField", 0x1a3a7a, 0.15),
        "tray": f("Tray", 0x9aa0aa, 0.3),
        "seat": f("Seat", 0x8a1020, 0.5),
        "post": f("Post", 0x404448, 0.4),
        "frames": [f("FrameGold", 0xc8a040, 0.3), f("FrameRed", 0xb8182a, 0.35), f("FrameBlue", 0x2050b0, 0.35),
                   f("FrameChrome", 0xc8ccd4, 0.25), f("FramePink", 0xd03a8a, 0.35), f("FrameGreen", 0x2a9a50, 0.35)],
        "screen": kmat("KB_PachiScreen", 0x80c0ff, 0.2, emit=0xffffff, strength=1.4),
        "lamp": P["amber"],
        "light": kmat("KB_StreetLamp", 0xfff4dc, 0.3, emit=0xffeccc, strength=2.0),
        "glass": P["glass"],
    }


def pachinko_parlour(b, P, R):
    Q = parlour_palette(P)
    X, BK, Z0, Z1, FL, CL = PARLOUR["x"], PARLOUR["back"], PARLOUR["z0"], PARLOUR["z1"], PARLOUR["floor"], PARLOUR["ceil"]
    up, down = (0, 1, 0), (0, -1, 0)
    R.begin(b, "parlour-room")
    _facing(b, Q["carpet"], [(BK, FL, Z0), (X, FL, Z0), (X, FL, Z1), (BK, FL, Z1)], up)
    for zz in [Z0 + 0.6 + 1.15 * k for k in range(16)]:                                   # the carpet's gold diamonds, in the aisles
        if not any(abs(zz - zi) < 0.62 for zi in PARLOUR["islands"]):
            strip(b, Q["carpet_gold"], (BK + 0.3, FL + 0.003, zz), (X - 0.05, FL + 0.003, zz), 0.05)
    _facing(b, Q["ceiling"], [(BK, CL, Z0), (X, CL, Z0), (X, CL, Z1), (BK, CL, Z1)], down)
    _facing(b, Q["wall"], [(BK, FL, Z0), (BK, CL, Z0), (BK, CL, Z1), (BK, FL, Z1)], (1, 0, 0))
    _facing(b, Q["wall_band"], [(BK + 0.005, 2.2, Z0), (BK + 0.005, 2.4, Z0), (BK + 0.005, 2.4, Z1), (BK + 0.005, 2.2, Z1)], (1, 0, 0))
    for z, n in ((Z0, 1), (Z1, -1)):
        _facing(b, Q["wall"], [(BK, FL, z), (X, FL, z), (X, CL, z), (BK, CL, z)], (0, 0, n))
    # the light strips over each aisle, along the room
    edges = [Z0] + [z for zi in PARLOUR["islands"] for z in (zi - 0.55, zi + 0.55)] + [Z1]
    for a, c in zip(edges[::2], edges[1::2]):
        if c - a > 0.8:
            m = (a + c) / 2
            _facing(b, Q["light"], [(BK + 0.2, CL - 0.01, m - 0.12), (X - 0.1, CL - 0.01, m - 0.12), (X - 0.1, CL - 0.01, m + 0.12), (BK + 0.2, CL - 0.01, m + 0.12)], down)
    # the glass itself (Studio's frame holds it): see-through, a sheen
    for a, c in ((Z0, PARLOUR["door"][0]), (PARLOUR["door"][1], Z1)):                     # either side of the doors (code: they slide)
        _facing(b, Q["glass"], [(X + 0.004, 0.28, a), (X + 0.004, 0.28, c), (X + 0.004, 2.74, c), (X + 0.004, 2.74, a)], (1, 0, 0))
    R.end()
    xa, xb, N = -32.6, -34.8, 4          # (0.88 m to the glass, 0.8 to the back wall: room to walk round)
    mw = (xa - xb) / N
    k = 0
    for i, zi in enumerate(PARLOUR["islands"]):
        R.begin(b, f"parlour-island{i}")
        b.box(Q["spine"], xa - xb, 2.0 - FL, 0.3, (xa + xb) / 2, FL, zi)
        for s in (-1, 1):
            zc = zi + s * 0.325
            b.box(Q["counter"], xa - xb, 1.05 - FL, 0.35, (xa + xb) / 2, FL, zc)                    # the lower cabinets
            b.box(Q["lip"], xa - xb, 0.05, 0.42, (xa + xb) / 2, 1.0, zi + s * 0.36)                  # the counter's lip
            b.box(Q["spine"], xa - xb, 0.9, 0.27, (xa + xb) / 2, 1.05, zi + s * 0.285)               # the machines' bodies
            b.box(Q["spine"], xa - xb, 0.22, 0.2, (xa + xb) / 2, 1.98, zi + s * 0.25)               # the data lamps' bar
            zf = zi + s * 0.42 + s * 0.003
            n = (0, 0, s)
            for j in range(N):
                x = xa - (j + 0.5) * mw
                fr = Q["frames"][(k * 5 + j) % len(Q["frames"])]
                _facing(b, fr, [(x - mw / 2 + 0.02, 1.06, zf), (x + mw / 2 - 0.02, 1.06, zf), (x + mw / 2 - 0.02, 1.94, zf), (x - mw / 2 + 0.02, 1.94, zf)], n)
                disc(b, Q["tray"], (x, 1.58, zf + s * 0.0015), n, 0.225, 10)                              # the chrome ring
                disc(b, Q["field"], (x, 1.58, zf + s * 0.003), n, 0.2, 10)                                 # the ball field
                _facing(b, Q["screen"], [(x - 0.1, 1.52, zf + s * 0.006), (x + 0.1, 1.52, zf + s * 0.006), (x + 0.1, 1.66, zf + s * 0.006), (x - 0.1, 1.66, zf + s * 0.006)], n)
                _facing(b, Q["tray"], [(x - 0.2, 1.1, zf + s * 0.004), (x + 0.2, 1.1, zf + s * 0.004), (x + 0.2, 1.24, zf + s * 0.004), (x - 0.2, 1.24, zf + s * 0.004)], n)
                zl = zi + s * 0.351
                _facing(b, Q["lamp"], [(x - 0.12, 2.02, zl), (x + 0.12, 2.02, zl), (x + 0.12, 2.16, zl), (x - 0.12, 2.16, zl)], n)
                zs = zi + s * 0.8               # (kabukigrin-social.js PACHI_SEATS sits a player here)
                b.cyl(Q["post"], 0.03, (x, FL, zs), (x, FL + 0.5, zs), seg=4, caps=False)               # the stool: a post,
                b.cyl(Q["seat"], 0.17, (x, FL + 0.5, zs), (x, FL + 0.58, zs), seg=8, caps=False)        # its round seat
                disc(b, Q["seat"], (x, FL + 0.58, zs), (0, 1, 0), 0.17, 8)
            k += 1
        R.end()


# The B side's ramen stall (kabukigrin-street.js RAMEN: the konbini's blank
# north wall at z 31, the live noren on its rod at y 2.2, z 30.31, the menu
# tags on the wall 1.31 .. 1.93): a yatai built against the wall round them.
# The counter with its plank front and a cart wheel at each end, two low
# stools, the stock pots at the counter's ends (clear of the menu's width),
# bowls and a ladle between, the posts behind the noren's plane holding the
# eave over it and the two red lanterns. Nothing stands in front of the menu
# or the noren (rule 9: they are registered faces).
STALL = {"x0": 19.1, "x1": 22.9, "wall": 31.0, "front": 30.32}


def ramen_stall(b, P, R):
    x0, x1, W, F = STALL["x0"], STALL["x1"], STALL["wall"], STALL["front"]
    wood, dark = P["wood"], P["black"]
    red = kmat("KB_LanternRed", 0xe8402a, 0.5, emit=0xff4a28, strength=1.6)
    R.begin(b, "ramen-stall")
    b.box(wood, x1 - x0, 0.95, W - F - 0.02, (x0 + x1) / 2, 0, (W + F) / 2 - 0.01)               # the counter's body
    b.box(wood, x1 - x0 + 0.1, 0.06, W - F + 0.12, (x0 + x1) / 2, 0.95, (W + F) / 2 - 0.06)      # its top, over the edge
    k = x0 + 0.12
    while k < x1 - 0.1:
        _facing(b, dark, [(k - 0.006, 0.05, F - 0.006), (k + 0.006, 0.05, F - 0.006), (k + 0.006, 0.92, F - 0.006), (k - 0.006, 0.92, F - 0.006)], (0, 0, -1))
        k += 0.24
    for x in (x0 + 0.06, x1 - 0.06):                                                             # a cart wheel each end
        s = -1 if x < 21 else 1
        b.cyl(wood, 0.36, (x + s * 0.02, 0.37, (W + F) / 2), (x + s * 0.08, 0.37, (W + F) / 2), seg=12, caps=False)
        b.bar(wood, (x + s * 0.05, 0.05, (W + F) / 2), (x + s * 0.05, 0.69, (W + F) / 2), 0.03)
        b.bar(wood, (x + s * 0.05, 0.37, (W + F) / 2 - 0.32), (x + s * 0.05, 0.37, (W + F) / 2 + 0.32), 0.03)
    # the posts (behind the noren's plane), the eave sloping off the wall over it
    for x in (x0 + 0.05, x1 - 0.05):
        b.box(wood, 0.08, 2.75 - 1.01, 0.08, x, 1.01, 30.42)
    pts = [(x0 - 0.1, 2.78, W), (x1 + 0.1, 2.78, W), (x1 + 0.1, 2.44, 30.1), (x0 - 0.1, 2.44, 30.1)]
    _facing(b, P["noren"], pts, (0, 1, -0.4))
    _facing(b, wood, pts, (0, -1, 0.4))
    b.box(wood, x1 - x0 + 0.2, 0.06, 0.06, (x0 + x1) / 2, 2.4, 30.12)                              # its fascia board
    # the lanterns on hooks off the posts, where their halos are (y 1.95)
    for x, hx in ((18.95, x0 + 0.05), (23.05, x1 - 0.05)):
        b.bar(dark, (hx, 2.28, 30.42), (x, 2.28, 30.42), 0.02)
        b.cyl(red, 0.15, (x, 1.74, 30.42), (x, 2.16, 30.42), seg=8)
        b.cyl(dark, 0.1, (x, 2.16, 30.42), (x, 2.24, 30.42), seg=8, caps=False)
        b.cyl(dark, 0.1, (x, 1.67, 30.42), (x, 1.74, 30.42), seg=8, caps=False)
    R.end()
    R.collider((x0 + x1) / 2, (W + F) / 2 - 0.04, x1 - x0 + 0.2, W - F + 0.1, 1.01, 0, pen=3)
    # on the counter: the stock pots at its ends (out of the menu's width,
    # 19.83 .. 22.17), a stack of bowls, two at the counter, the ladle, a jar
    R.begin(b, "ramen-stall-top", on="ramen-stall")
    for x in (19.38, 22.62):
        b.cyl(P["steel"], 0.15, (x, 1.01, 30.66), (x, 1.31, 30.66), seg=10, caps=False)
        disc(b, P["broth"], (x, 1.29, 30.66), (0, 1, 0), 0.14, 10)
        b.cyl(dark, 0.012, (x + 0.05, 1.25, 30.62), (x + 0.12, 1.5, 30.5), seg=4, caps=False)      # the ladle
    for i in range(4):
        b.cyl(P["bowl"], 0.06, (20.0, 1.01 + i * 0.05, 30.75), (20.0, 1.06 + i * 0.05, 30.75), r2=0.09, seg=8, caps=False)
    for x in (20.7, 21.6):
        bowl(Face1(), b, P, x, 1.01, 30.5)
    b.cyl(P["red"], 0.04, (22.1, 1.01, 30.8), (22.1, 1.13, 30.8), seg=6)                          # the pepper jar
    R.end()
    for i, x in enumerate((20.3, 21.7)):                                                          # two low stools
        R.begin(b, f"ramen-stool{i}", on="ramen-stall")     # (in front of its counter, under the eave)
        b.cyl(P["black"], 0.03, (x, 0, 29.95), (x, 0.5, 29.95), seg=4, caps=False)
        b.cyl(P["red"], 0.16, (x, 0.5, 29.95), (x, 0.56, 29.95), seg=8, caps=False)
        disc(b, P["red"], (x, 0.56, 29.95), (0, 1, 0), 0.16, 8)
        R.end()


class Face1:
    """bowl()'s frame in world terms: t is x, o is z (a face along x, out +z)."""
    ax, at, t0, n = "x", 0.0, 0.0, 1

    def world(self, t, o):
        return t, o

    def box(self, b, m, t0, t1, y, h, o0, o1):
        b.box(m, abs(t1 - t0), h, abs(o1 - o0), (t0 + t1) / 2, y, (o0 + o1) / 2)
