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
import math
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
    """Where a player stands: the ground over the whole map and the
    manor's upstairs (the test skips the eyes inside colliders), on a 1 m
    grid, 1.6 m up."""
    B = L["bounds"]
    return [{"rect": [B["minX"], B["maxX"], B["minZ"], B["maxZ"]], "y": 0.0},
            # Grinmoor Manor upstairs and its balcony (phase 1)
            {"rect": [-12.6, 12.6, -27.6, -12.4], "y": 3.6},
            {"rect": [-5.4, 5.4, -12.0, -8.4], "y": 3.6}]


# ------------------------------------------------------------ wall helpers

def spans_free(a, b_, holes, y):
    """Intervals along a wall [a, b_] at relative height y not inside a hole."""
    cuts = sorted((h["c"] - h["w"] / 2, h["c"] + h["w"] / 2) for h in holes
                  if any(lo - 1e-4 <= y <= hi + 1e-4 for lo, hi in h["spans"]))
    out, cur = [], a
    for s, e in cuts:
        if s > cur:
            out.append((cur, s))
        cur = max(cur, e)
    if cur < b_:
        out.append((cur, b_))
    return out


def heights_free(p, h, holes):
    """Vertical intervals [0, h] at position p along the wall not in a hole."""
    cuts = []
    for hole in holes:
        if hole["c"] - hole["w"] / 2 - 1e-4 <= p <= hole["c"] + hole["w"] / 2 + 1e-4:
            cuts += hole["spans"]
    out, cur = [], 0.0
    for lo, hi in sorted(cuts):
        if lo > cur:
            out.append((cur, lo))
        cur = max(cur, hi)
    if cur < h:
        out.append((cur, h))
    return out


class Wall:
    """Same wall as hollowgrin.js wall(): axis 'x' runs along x at z = at,
    'z' along z at x = at, from a to b_, thickness t, openings `holes`
    ({c, w, spans}) with heights relative to y. `out` = +1/-1: the side that
    is outdoors (on the across axis)."""

    def __init__(self, axis, at, a, b_, h, t, holes=(), y=0.0, out=1):
        self.axis, self.at, self.a, self.b, self.h, self.t = axis, at, a, b_, h, t
        self.holes, self.y, self.out = list(holes), y, out

    def pt(self, along, across):
        return (along, across) if self.axis == "x" else (across, along)

    def slab(self, b, m, along0, along1, lo, hi, across, depth):
        if along1 - along0 < 0.005 or hi - lo < 0.005:
            return
        x, z = self.pt((along0 + along1) / 2, across)
        w, d = (along1 - along0, depth) if self.axis == "x" else (depth, along1 - along0)
        b.box(m, w, hi - lo, d, x, self.y + lo, z)

    def solid(self, b, m, inner=None, split=0.5):
        """The wall itself, around its openings. With `inner`, the outer
        `split` of the thickness gets m and the rest gets inner."""
        layers = [(m, self.at, self.t)] if inner is None else [
            (m, self.at + self.out * self.t * (1 - split) / 2, self.t * split),
            (inner, self.at - self.out * self.t * split / 2, self.t * (1 - split))]
        for mm, across, depth in layers:
            cur = self.a
            for hole in sorted(self.holes, key=lambda q: q["c"]):
                s, e = hole["c"] - hole["w"] / 2, hole["c"] + hole["w"] / 2
                self.slab(b, mm, cur, s, 0, self.h, across, depth)
                lo = 0.0
                for sl, sh in sorted(hole["spans"]):
                    self.slab(b, mm, s, e, lo, sl, across, depth)
                    lo = sh
                self.slab(b, mm, s, e, lo, self.h, across, depth)
                cur = e
            self.slab(b, mm, cur, self.b, 0, self.h, across, depth)

    def face(self, off):
        """`across` coordinate just proud of the outer (off>0) or inner face."""
        return self.at + self.out * (self.t / 2 + off) if off > 0 else self.at - self.out * (self.t / 2 - off)

    def battens(self, b, m, every, w=0.07, proud=0.03, y0=0.0, y1=None, a=None, b_=None):
        a = self.a if a is None else a
        b_ = self.b if b_ is None else b_
        y1 = self.h if y1 is None else y1
        p = a + every / 2
        while p < b_:
            for lo, hi in heights_free(p, self.h, self.holes):
                lo, hi = max(lo, y0), min(hi, y1)
                if hi - lo > 0.05:
                    self.slab(b, m, p - w / 2, p + w / 2, lo, hi, self.face(proud / 2), proud)
            p += every

    def laps(self, b, m, every=0.2, proud=0.025, y0=0.0, y1=None, tilt=0.12):
        """Lap siding: overlapping horizontal boards, skipping openings."""
        y1 = self.h if y1 is None else y1
        y = y0
        while y < y1 - 0.01:
            top = min(y1, y + every + 0.02)
            for s, e in spans_free(self.a, self.b, self.holes, (y + top) / 2):
                x, z = self.pt((s + e) / 2, self.face(proud / 2))
                w, d = (e - s, proud) if self.axis == "x" else (proud, e - s)
                rx = -self.out * tilt if self.axis == "x" else 0.0
                rz = self.out * tilt if self.axis == "z" else 0.0
                b.box(m, w, top - y, d, x, self.y + y, z, rx=rx, rz=rz)
            y += every

    def courses(self, b, m, every=0.45, block=1.1, proud=0.006, y0=0.0, y1=None, line=0.025, side=1):
        """Ashlar joints: thin horizontal bed joints and staggered head joints."""
        y1 = self.h if y1 is None else y1
        across = self.face(proud / 2) if side > 0 else self.face(-proud / 2)
        k = 0
        y = y0 + every
        while y < y1 - 0.05:
            for s, e in spans_free(self.a, self.b, self.holes, y):
                self.slab(b, m, s, e, y - line / 2, y + line / 2, across, proud)
            # head joints in the course below this bed joint
            p = self.a + (block / 2 if k % 2 else block)
            while p < self.b - 0.1:
                mid = y - every / 2
                if any(lo <= mid <= hi for lo, hi in heights_free(p, self.h, self.holes)):
                    self.slab(b, m, p - line / 2, p + line / 2, y - every + line / 2, y - line / 2, across, proud)
                p += block
            y += every
            k += 1

    def casings(self, b, m, fw=0.12, proud=0.04, sill=True, side=1):
        """Frames round every opening (jambs, head, sill on windows)."""
        across = self.face(proud / 2) if side > 0 else self.face(-proud / 2)
        for hole in self.holes:
            s, e = hole["c"] - hole["w"] / 2, hole["c"] + hole["w"] / 2
            for lo, hi in hole["spans"]:
                self.slab(b, m, s - fw, s, lo, hi + fw, across, proud)
                self.slab(b, m, e, e + fw, lo, hi + fw, across, proud)
                self.slab(b, m, s - fw, e + fw, hi, hi + fw, across, proud * 1.3)
                if sill and lo > 0.05:
                    self.slab(b, m, s - fw - 0.05, e + fw + 0.05, lo - 0.06, lo, across, proud * 2.2)


def fluted_shaft(b, m, x, z, y0, y1, r0, r1, flutes=16, depth=0.018):
    """A fluted column shaft: a ring profile with scalloped flutes, tapered."""
    n = flutes * 4
    ring = []
    for i in range(n):
        a = 2 * math.pi * i / n
        dent = depth * (0.5 - 0.5 * math.cos(2 * math.pi * (i % 4) / 4))
        ring.append((a, dent))
    pts = []
    for y, r in ((y0, r0), (y1, r1)):
        for a, dent in ring:
            pts.append((x + (r - dent) * math.cos(a), y, z + (r - dent) * math.sin(a)))
    faces = [list(range(n - 1, -1, -1)), list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    fs = b.poly(m, pts, faces)
    for f in fs[2:]:
        f.smooth = True


def gable_prism(b, m, base, rise, y, a0, a1, axis="x", c=0.0):
    """Triangular gable: base width `base` centred on c (across), rising
    `rise` from y, extruded along `axis` from a0 to a1."""
    prof = [(c - base / 2, y), (c + base / 2, y), (c, y + rise)]
    b.prism(m, prof, a0, a1, axis=axis)


# ------------------------------------------------------------ phase 1 shapes
#
# Most of what these draw shows one face (wallpaper, a lap board, a slate
# course, a book's spine): they add those faces alone, as quads wound to face
# out, so a whole manor fits the budget. A box is 12 triangles; a quad is 2.

QUADS = {
    "+x": lambda x0, x1, y0, y1, z0, z1: [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)],
    "-x": lambda x0, x1, y0, y1, z0, z1: [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)],
    "+y": lambda x0, x1, y0, y1, z0, z1: [(x0, y1, z0), (x0, y1, z1), (x1, y1, z1), (x1, y1, z0)],
    "-y": lambda x0, x1, y0, y1, z0, z1: [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)],
    "+z": lambda x0, x1, y0, y1, z0, z1: [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],
    "-z": lambda x0, x1, y0, y1, z0, z1: [(x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (x1, y0, z0)],
}


def quad(b, m, pts):
    """One face through pts, as wound (counter-clockwise seen from outside)."""
    vs = [b.bm.verts.new(p) for p in pts]
    f = b.bm.faces.new(vs)
    f.material_index = b._mi(m)
    return f


def facing(b, m, pts, want):
    """One face through pts, wound so its normal points along `want`."""
    p0, p1, p2 = pts[0], pts[1], pts[2]
    e1 = [p1[i] - p0[i] for i in range(3)]
    e2 = [p2[i] - p1[i] for i in range(3)]
    cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
    return quad(b, m, pts if sum(cr[i] * want[i] for i in range(3)) > 0 else pts[::-1])


def fbox(b, m, x0, x1, y0, y1, z0, z1, sides):
    """An axis-aligned box with only the named faces ("+x -y +z ...")."""
    for k in sides.split():
        quad(b, m, QUADS[k](x0, x1, y0, y1, z0, z1))


def skin(b, m, w, a, b_, lo, hi, proud, side=1, top=False):
    """A thin layer over [a, b_] x [lo, hi] of Wall w's face (heights from
    the wall's y), cut round its openings: side 1 the outdoor face, -1 the
    indoor one (wallpaper, wainscot, a plinth). Its face alone, and its top
    edge when `top` (a rail, a plinth)."""
    sgn = w.out * side
    base = w.at + sgn * w.t / 2
    pc = base + sgn * proud
    lo_c, hi_c = min(base, pc), max(base, pc)
    cuts = sorted({a, b_} | {e for h in w.holes for e in (h["c"] - h["w"] / 2, h["c"] + h["w"] / 2) if a < e < b_})
    for s, e in zip(cuts, cuts[1:]):
        for lo_, hi_ in heights_free((s + e) / 2, w.h, w.holes):
            lo_, hi_ = max(lo_, lo), min(hi_, hi)
            if hi_ - lo_ <= 0.01:
                continue
            y0, y1 = w.y + lo_, w.y + hi_
            if w.axis == "x":
                fbox(b, m, s, e, y0, y1, pc, pc, "+z" if sgn > 0 else "-z")
                if top:
                    fbox(b, m, s, e, y1, y1, lo_c, hi_c, "+y")
            else:
                fbox(b, m, pc, pc, y0, y1, s, e, "+x" if sgn > 0 else "-x")
                if top:
                    fbox(b, m, lo_c, hi_c, y1, y1, s, e, "+y")


def clapboard(b, m, w, a, b_, y0, y1, every=0.22, proud=0.03):
    """Lap siding on Wall w's outdoor face: per course one tilted board
    face (proud at its butt, flush at its top) and the butt's underside,
    skipping the openings."""
    sgn = w.out
    base = w.at + sgn * w.t / 2
    out = (0.0, 0.0, float(sgn)) if w.axis == "x" else (float(sgn), 0.0, 0.0)
    y = y0
    while y < y1 - 0.01:
        top = min(y1, y + every)
        for s, e in spans_free(a, b_, w.holes, (y + top) / 2):
            bt, tp = base + sgn * proud, base + sgn * 0.004
            if w.axis == "x":
                facing(b, m, [(s, w.y + y, bt), (e, w.y + y, bt), (e, w.y + top, tp), (s, w.y + top, tp)], out)
                fbox(b, m, s, e, w.y + y, w.y + y, min(base, bt), max(base, bt), "-y")
            else:
                facing(b, m, [(bt, w.y + y, s), (bt, w.y + y, e), (tp, w.y + top, e), (tp, w.y + top, s)], out)
                fbox(b, m, min(base, bt), max(base, bt), w.y + y, w.y + y, s, e, "-y")
        y += every


def casings(b, m, w, fw=0.12, proud=0.04, sill=True, side=1):
    """Wall.casings as faces: frames round every opening (jambs, head, a
    sill under windows) on one face of w, each its front and its edges."""
    sgn = w.out * side
    base = w.at + sgn * w.t / 2

    def piece(a0, a1, lo, hi, d, top=False):
        pc = base + sgn * d
        c0, c1 = min(base, pc), max(base, pc)
        y0, y1 = w.y + lo, w.y + hi
        if w.axis == "x":
            fbox(b, m, a0, a1, y0, y1, c0, c1, ("+z" if sgn > 0 else "-z") + " -x +x" + (" +y -y" if top else ""))
        else:
            fbox(b, m, c0, c1, y0, y1, a0, a1, ("+x" if sgn > 0 else "-x") + " -z +z" + (" +y -y" if top else ""))
    for hole in w.holes:
        s, e = hole["c"] - hole["w"] / 2, hole["c"] + hole["w"] / 2
        for lo, hi in hole["spans"]:
            piece(s - fw, s, lo, hi + fw, proud)
            piece(e, e + fw, lo, hi + fw, proud)
            piece(s - fw, e + fw, hi, hi + fw, proud * 1.3, top=True)
            if sill and lo > 0.05:
                piece(s - fw - 0.05, e + fw + 0.05, lo - 0.06, lo, proud * 2.2, top=True)


def lathe(b, m, x, z, prof, seg=12, y0=0.0, caps=True):
    """A turned piece (a column, a baluster, a pot) round the vertical
    through x, z: prof is [(radius, height)] from the bottom up. `caps`
    closes its ends."""
    n = len(prof)
    rings = []
    for r, y in prof:
        r = max(r, 0.002)
        rings.append([b.bm.verts.new((x + r * math.cos(2 * math.pi * i / seg), y0 + y, z + r * math.sin(2 * math.pi * i / seg)))
                      for i in range(seg)])
    idx = b._mi(m)
    out = []
    for k in range(n - 1):
        lo, hi = rings[k], rings[k + 1]
        for i in range(seg):
            j = (i + 1) % seg
            try:
                f = b.bm.faces.new([lo[i], hi[i], hi[j], lo[j]])
            except ValueError:
                continue
            f.material_index = idx
            f.smooth = True
            out.append(f)
    if caps:
        for vs in (rings[0], rings[-1][::-1]):
            try:
                f = b.bm.faces.new(vs)
                f.material_index = idx
                out.append(f)
            except ValueError:
                pass
    # the sides are wound out when the profile climbs; a profile that comes
    # back down (a cornice's lip, a cap) needs the normals worked out
    if any(prof[k + 1][1] < prof[k][1] - 1e-6 for k in range(n - 1)):
        bmesh_recalc(b, out)
    return out


def bmesh_recalc(b, faces):
    import bmesh
    bmesh.ops.recalc_face_normals(b.bm, faces=faces)


def ring(b, m, c, R, r, seg=20, tseg=6, axis="y", arc=2 * math.pi, a0=0.0):
    """A torus (a chandelier hoop, a wheel's tyre, a barrel band) round the
    axis through c; `arc` < 2 pi leaves it open (an iron arch)."""
    closed = arc >= 2 * math.pi - 1e-6
    n = seg if closed else seg + 1
    pts = []
    for i in range(n):
        u = a0 + arc * i / seg
        for j in range(tseg):
            v = 2 * math.pi * j / tseg
            rr = R + r * math.cos(v)
            p = [rr * math.cos(u), r * math.sin(v), rr * math.sin(u)]       # axis y
            if axis == "x":
                p = [p[1], p[0], p[2]]
            elif axis == "z":
                p = [p[0], p[2], p[1]]
            pts.append((c[0] + p[0], c[1] + p[1], c[2] + p[2]))
    faces = []
    for i in range(seg):
        i2 = (i + 1) % n
        for j in range(tseg):
            j2 = (j + 1) % tseg
            faces.append([i * tseg + j, i2 * tseg + j, i2 * tseg + j2, i * tseg + j2])
    fs = b.poly(m, pts, faces)
    for f in fs:
        f.smooth = True
    return fs


def slates(b, mats, axis, a0, a1, eave, ridge, seed, course=0.27, deck=0.2, over=0.0, pieces=(1.2, 3.2)):
    """A slate roof plane: the deck, then courses from the eave up, each a
    few runs of slate in different greys; a run is its upper face (lifted
    at the butt, so the courses step) and the butt's edge. axis 'x': the
    ridge runs along x and eave/ridge are (z, y); axis 'z': along z, eave
    and ridge are (x, y)."""
    rnd = __import__("random").Random(seed)
    (ea, ey), (ra, ry) = eave, ridge
    L = math.hypot(ra - ea, ry - ey)
    ux, uy = (ra - ea) / L, (ry - ey) / L           # up the slope: (across, y)
    nx, ny = (-uy if ux > 0 else uy), abs(ux)       # out of the roof

    def P(along, t, off):
        acr = ea + ux * t + nx * off
        y = ey + uy * t + ny * off
        return (along, y, acr) if axis == "x" else (acr, y, along)

    def vec(acr, y):
        return (0.0, y, acr) if axis == "x" else (acr, y, 0.0)

    up, down = vec(nx, ny), vec(-ux, -uy)
    lo, hi = a0 - over, a1 + over
    # the deck: its top and underside
    facing(b, mats[0], [P(lo, -0.05, deck / 2), P(hi, -0.05, deck / 2), P(hi, L, deck / 2), P(lo, L, deck / 2)], up)
    facing(b, mats[0], [P(lo, -0.05, -deck / 2), P(hi, -0.05, -deck / 2), P(hi, L, -deck / 2), P(lo, L, -deck / 2)], vec(-nx, -ny))
    facing(b, mats[0], [P(lo, -0.05, -deck / 2), P(hi, -0.05, -deck / 2), P(hi, -0.05, deck / 2), P(lo, -0.05, deck / 2)], down)
    th = 0.035
    t, k = 0.0, 0
    while t < L - 0.05:
        t1 = min(L, t + course + 0.08)
        along = lo
        first = True
        while along < hi - 0.02:
            ln = rnd.uniform(*pieces)
            if first and k % 2:
                ln *= 0.5
            first = False
            e = min(hi, along + ln)
            m = rnd.choice(mats)
            lift = rnd.uniform(0.0, 0.006)
            facing(b, m, [P(along, t, deck / 2 + th + lift), P(e, t, deck / 2 + th + lift), P(e, t1, deck / 2 + 0.004), P(along, t1, deck / 2 + 0.004)], up)
            facing(b, m, [P(along, t, deck / 2), P(e, t, deck / 2), P(e, t, deck / 2 + th + lift), P(along, t, deck / 2 + th + lift)], down)
            along = e
        t += course
        k += 1


def pumpkin(b, m, stem, x, y, z, r, ribs=10, squash=0.78, ry=0.0, seg=None, tall=1.0, wart=0.0, seed=0):
    """A pumpkin (or a gourd, `tall` > 1): a sphere pulled into ribs and
    squashed, dimpled at the stem; its bottom sits on y."""
    rnd = __import__("random").Random(seed)
    seg = seg or (4 if r < 0.2 else 6)
    lon = ribs * 2
    pts = [(x, y + r * 0.08, z)]
    for i in range(1, seg):
        th = math.pi * i / seg
        for j in range(lon):
            ph = ry + 2 * math.pi * j / lon
            rib = 1.0 - 0.09 * (0.5 + 0.5 * math.cos(ribs * (ph - ry) * 1.0))
            rr = r * math.sin(th) * rib * (1 + wart * rnd.uniform(-1, 1))
            yy = -math.cos(th) * r * squash * tall
            pts.append((x + rr * math.cos(ph), y + r * squash * tall + yy, z + rr * math.sin(ph)))
    pts.append((x, y + 2 * r * squash * tall - r * 0.1, z))
    top = len(pts) - 1
    faces = []
    for j in range(lon):
        j2 = (j + 1) % lon
        faces.append([0, 1 + j2, 1 + j])
        for i in range(seg - 2):
            a = 1 + i * lon
            faces.append([a + j, a + j2, a + lon + j2, a + lon + j])
        a = 1 + (seg - 2) * lon
        faces.append([a + j, a + j2, top])
    for f in b.poly(m, pts, faces):
        f.smooth = True
    ty = y + 2 * r * squash * tall - r * 0.12
    b.cyl(stem, r * 0.1, (x, ty, z), (x + rnd.uniform(-0.3, 0.3) * r, ty + r * 0.4, z + rnd.uniform(-0.3, 0.3) * r), seg=5, r2=r * 0.06)


# ------------------------------------------------------------ phase 2 shapes

_M32 = 0xFFFFFFFF


def js_rng(seed):
    """hollowgrin.js rng(seed), call for call (mulberry32): a place the JS
    lays out by its own random stream (the graveyard's stones) is drawn
    here from the same numbers, so the art lands on the colliders."""
    a = seed & _M32

    def R():
        nonlocal a
        a = (a + 0x6d2b79f5) & _M32
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & _M32
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & _M32)) & _M32
        return ((t ^ (t >> 14)) & _M32) / 4294967296
    return R


def slab(b, m, prof, t, x, y, z, ry=0.0, rz=0.0, smooth=False):
    """A profile (u, v) in the vertical plane, t thick, stood at x, y, z
    (v = 0 on y) and turned ry about the vertical (ry = 0: the profile runs
    along x and faces z), then leaned rz about its own along-axis."""
    n = len(prof)
    c, s = math.cos(ry), math.sin(ry)
    cl, sl = math.cos(rz), math.sin(rz)
    pts = []
    for side in (-t / 2, t / 2):
        for u, v in prof:
            # lean: the profile's v tilts into the thickness direction
            lu, lv, lw = u, v * cl - side * sl, v * sl + side * cl
            pts.append((x + lu * c + lw * s, y + lv, z - lu * s + lw * c))
    faces = [list(range(n))[::-1], [n + i for i in range(n)]]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    fs = b.poly(m, pts, faces)
    if smooth:
        for f in fs[2:]:
            f.smooth = True
    return fs


def headstone_profile(w, h, kind):
    """Eight stones: 0 round top, 1 gothic point, 2 square with shoulders,
    3 round with a chipped corner, 4 a plain tablet, 5 a wide low stone,
    6 a cross-topped stone, 7 a round top with a notch."""
    hw = w / 2
    if kind == 0 or kind == 3 or kind == 7:
        pts = [(-hw, 0), (hw, 0)]
        n = 9
        for i in range(n + 1):
            a = math.pi * i / n
            pts.append((hw * math.cos(a), h - hw + hw * math.sin(a)))
        if kind == 3:
            pts = pts[:2] + [(hw, h - hw - 0.1), (hw - 0.14, h - hw + 0.05), (hw - 0.22, h - 0.02)] + pts[6:]
        if kind == 7:
            k = len(pts) // 2
            pts = pts[:k - 1] + [(0.05, h - 0.12), (-0.05, h - 0.12)] + pts[k + 1:]
        return pts
    if kind == 1:
        return [(-hw, 0), (hw, 0), (hw, h - hw * 0.9), (hw * 0.55, h - 0.25), (0, h), (-hw * 0.55, h - 0.25), (-hw, h - hw * 0.9)]
    if kind == 2:
        return [(-hw, 0), (hw, 0), (hw, h - 0.3), (hw - 0.12, h - 0.3), (hw - 0.12, h - 0.1), (hw - 0.2, h), (-hw + 0.2, h), (-hw + 0.12, h - 0.1), (-hw + 0.12, h - 0.3), (-hw, h - 0.3)]
    if kind == 4:
        return [(-hw, 0), (hw, 0), (hw, h - 0.06), (hw - 0.06, h), (-hw + 0.06, h), (-hw, h - 0.06)]
    if kind == 5:
        return [(-hw - 0.1, 0), (hw + 0.1, 0), (hw + 0.1, h * 0.75), (0, h * 0.92), (-hw - 0.1, h * 0.75)]
    # 6: a cross on a shouldered stone
    return [(-hw, 0), (hw, 0), (hw, h - 0.42), (0.07, h - 0.42), (0.07, h - 0.24), (0.2, h - 0.24), (0.2, h - 0.14), (0.07, h - 0.14),
            (0.07, h), (-0.07, h), (-0.07, h - 0.14), (-0.2, h - 0.14), (-0.2, h - 0.24), (-0.07, h - 0.24), (-0.07, h - 0.42), (-hw, h - 0.42)]


def branch(b, bark, bark_lt, p0, d, length, r0, depth, rnd, out):
    """A crooked limb from p0 along d: three bends, tapering, splitting into
    two or three at its end until depth runs out."""
    p, r = list(p0), r0
    for k in range(3):
        L = length / 3
        dx, dy, dz = d
        q = [p[0] + dx * L, p[1] + dy * L, p[2] + dz * L]
        r1 = r * 0.82
        b.cyl(bark if depth % 2 else bark_lt, r, tuple(p), tuple(q), seg=6 if r > 0.08 else 4, r2=r1, caps=False)
        nd = [dx + rnd.uniform(-0.35, 0.35), dy + rnd.uniform(-0.25, 0.3), dz + rnd.uniform(-0.35, 0.35)]
        n = math.sqrt(sum(c * c for c in nd))
        d = [c / n for c in nd]
        p, r = q, r1
    out.append((tuple(p), r))
    if depth == 0 or r < 0.025:
        return
    for i in range(2 if rnd.random() < 0.6 else 3):
        a = rnd.uniform(0, 2 * math.pi)
        spread = rnd.uniform(0.45, 0.8)
        nd = [d[0] + math.cos(a) * spread, d[1] + rnd.uniform(-0.1, 0.25), d[2] + math.sin(a) * spread]
        n = math.sqrt(sum(c * c for c in nd))
        branch(b, bark, bark_lt, p, [c / n for c in nd], length * rnd.uniform(0.55, 0.75), r * rnd.uniform(0.6, 0.8), depth - 1, rnd, out)


def dead_tree(b, bark, bark_lt, x, z, h=7.0, r=0.3, seed=1, limbs=3, lean=0.1, R=None, pid=None, on=None):
    """A bare tree: a leaning trunk that forks into crooked limbs. With a
    Registry, the trunk and the crown register as two props (the crown
    overhead is never in anything's way on the ground). `on` waives the
    bounds check against a prop the caller has checked it clears. With b
    None it only returns the tips (a dry run)."""
    if b is None:
        b = _NoDraw()
    rnd = __import__("random").Random(seed)
    fork = h * 0.55
    la = rnd.uniform(0, 2 * math.pi)
    top = (x + math.cos(la) * lean * fork, fork, z + math.sin(la) * lean * fork)
    if R:
        R.begin(b, pid, on=on)
    b.cyl(bark, r, (x, -0.05, z), top, seg=8, r2=r * 0.7, caps=False)
    b.cyl(bark, r * 1.45, (x, -0.05, z), (x, 0.3, z), seg=8, r2=r * 1.05, caps=False)     # the root flare
    if R:
        R.end()
        R.begin(b, pid + "-crown", on=[pid] + (list(on) if isinstance(on, (list, tuple)) else [on] if on else []))
    tips = []
    for i in range(limbs):
        a = la + 2 * math.pi * i / limbs + rnd.uniform(-0.4, 0.4)
        d = [math.cos(a) * 0.7, 0.85, math.sin(a) * 0.7]
        n = math.sqrt(sum(c * c for c in d))
        branch(b, bark, bark_lt, top, [c / n for c in d], (h - fork) * 0.9, r * 0.6, 3, rnd, tips)
    if R:
        R.end()
    return tips


class _NoDraw:
    """A builder that draws nothing (dead_tree's dry run)."""
    def cyl(self, *a, **k):
        pass
