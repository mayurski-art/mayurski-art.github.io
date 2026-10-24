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
from kb_club import kmat


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
