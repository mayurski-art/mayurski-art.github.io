"""
Kabukigrin's club props (build_kabukigrin.blender.py, phase 1 of "Kabukigrin
in Blender": claude.ai/artifact/ESCtEQZrXQ3MFZZg9MjWsw).

Game coordinates (x right, y up, z toward the viewer). Every prop goes
through the Registry, which records its bounds (the overlap check), the
collider it needs (anything over 0.6 m: maps/kabukigrin-props.js) and the
faces that must stay in view (CLAUDE.md Troll Forces rule 9; the obstruction
test reads models/kabukigrin-faces.json).

Materials are rationed (doc, "Two more defaults"): flat colours fold into
one vertex-painted KB_Paint; two photo surfaces (KB_Wood, KB_Tread, in
map-models.js RETEXTURE); one glass; emissive only on what gives light.
"""
import math
import random

import bpy
from mathutils import Vector

from map_kit import hexlin, mat


# ------------------------------------------------------------- materials

def kmat(name, color, rough=0.6, metal=0.0, emit=None, strength=1.0, alpha=None):
    """A club material that keeps its own name (never folded into KB_Paint):
    the photo surfaces, the glass, the glows."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m["gs_hex"] = color
    m["gs_keep"] = True
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*hexlin(color), 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit is not None:
        b.inputs["Emission Color"].default_value = (*hexlin(emit), 1.0)
        b.inputs["Emission Strength"].default_value = strength
    if alpha is not None:
        b.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    return m


def palette():
    """The club's colours. Flat ones are map_kit mats (folded into KB_Paint
    by colour); the rest keep their material."""
    f = lambda name, c, r=0.6: mat("KBF_" + name, c, r)   # noqa: E731
    return {
        "black": f("Black", 0x0c0c0f, 0.7),
        "gloss": f("Gloss", 0x141418, 0.25),
        "steel": f("Steel", 0x6f767e, 0.45),
        "alu": f("Alu", 0xa9afb7, 0.4),
        "chrome": f("Chrome", 0xc6cad0, 0.3),
        "brass": f("Brass", 0xb8913a, 0.35),
        "leather": f("Leather", 0xb3182e, 0.45),
        "leather_dk": f("LeatherDark", 0x6e0c19, 0.5),
        "button": f("Button", 0x2e0409, 0.4),
        "grille": f("Grille", 0x18191c, 0.9),
        "rubber": f("Rubber", 0x0e0e0e, 0.9),
        "cone": f("Cone", 0x232326, 0.8),
        "white": f("White", 0xdedcd4, 0.6),
        "red": f("Red", 0xb3171c, 0.5),
        "cable": f("Cable", 0x0a0a0c, 0.6),
        "tape": f("Tape", 0x232327, 0.85),
        "tape_lt": f("TapeLight", 0x8e9095, 0.7),
        "case": f("Case", 0x17171b, 0.75),
        "cork": f("Cork", 0x9a7448, 0.9),
        "stone": f("Stone", 0x16141a, 0.3),
        "glass_ware": f("Glassware", 0x9cb4c2, 0.15),
        "bottle_g": f("BottleGreen", 0x24481f, 0.2),
        "bottle_a": f("BottleAmber", 0x5c3110, 0.2),
        "bottle_c": f("BottleClear", 0xb8c8cc, 0.15),
        "label": f("Label", 0xe4dcc4, 0.7),
        "label_k": f("LabelBlack", 0x18181a, 0.6),
        "note": f("Note", 0xb3a476, 0.85),
        "note_b": f("NoteBlue", 0x7f8fa6, 0.85),
        "paper": f("Paper", 0xe8e6de, 0.9),
        "fabric": f("Fabric", 0x2a2230, 0.95),
        "sofa": f("Sofa", 0x1d1d24, 0.85),
        "wood": kmat("KB_Wood", 0x3a2216, 0.6),
        "glass": kmat("KB_Glass", 0xbfd6e0, 0.05, 0.0, alpha=0.18),
        "lens": kmat("KB_LensWarm", 0xfff0d6, 0.2, emit=0xffe2b0, strength=2.2),
        "lens_pk": kmat("KB_LensPink", 0xff5ac8, 0.2, emit=0xff3fb4, strength=2.4),
        "exit": kmat("KB_Exit", 0x30ff7a, 0.3, emit=0x22ff6a, strength=1.6),
        "fridge": kmat("KB_Fridge", 0xdff2ff, 0.2, emit=0xcfe8ff, strength=1.2),
        "screen": kmat("KB_Screen", 0x4aa0ff, 0.2, emit=0x3a8cff, strength=1.0),
        "ring_pk": kmat("KB_RingPink", 0xff3fb4, 0.3, emit=0xff3fb4, strength=2.6),
        "ring_cy": kmat("KB_RingCyan", 0x3ff0ff, 0.3, emit=0x3ff0ff, strength=2.6),
        "amber": kmat("KB_Amber", 0xffb84a, 0.3, emit=0xffa830, strength=2.0),
        "hatch": kmat("KB_Hatch", 0xffe2b8, 0.5, emit=0xffd49a, strength=0.45),
    }


# ------------------------------------------------------------- the registry

class Registry:
    """What the props leave behind besides geometry: their bounds (the
    overlap check), colliders, and faces that must stay seen."""

    def __init__(self):
        self.props = []        # {id, lo, hi, on}  (on: the prop it stands on)
        self.colliders = []    # [x, z, w, d, h, y, pen]
        self.faces = []        # {id, owner, c, n, u, w, h}
        self._open = None

    def begin(self, b, pid, on=None):
        # every vertex so far is marked; the prop's are the ones left unmarked
        # at end() (bevels free and reuse slots, so no index range would do)
        tag = b.bm.verts.layers.int.get("kb_reg") or b.bm.verts.layers.int.new("kb_reg")
        for v in b.bm.verts:
            if v[tag] == 0:
                v[tag] = -1
        self._open = (b, pid, tag, on)

    def end(self):
        b, pid, tag, on = self._open
        vs = [v for v in b.bm.verts if v[tag] == 0]
        for v in vs:
            v[tag] = len(self.props) + 1
        k = len(self.props) + 1
        tris = sum(len(f.verts) - 2 for f in {f for v in vs for f in v.link_faces} if all(w[tag] == k for w in f.verts))
        if vs:
            lo = [min(v.co[a] for v in vs) for a in range(3)]
            hi = [max(v.co[a] for v in vs) for a in range(3)]
            self.props.append({"id": pid, "lo": [round(x, 4) for x in lo], "hi": [round(x, 4) for x in hi], "on": on, "tris": tris})
        self._open = None

    def collider(self, x, z, w, d, h, y=0.0, pen=3):
        self.colliders.append([round(v, 3) for v in (x, z, w, d, h, y)] + [pen])

    def face(self, fid, owner, c, n, w, h, u=None):
        """A face that must stay in view: centre c, outward normal n (in the
        floor plane), width w along u (default: n turned left), height h."""
        if u is None:
            u = (-n[2], 0.0, n[0])
        self.faces.append({"id": fid, "owner": owner, "c": [round(v, 3) for v in c], "n": list(n), "u": list(u),
                           "w": w, "h": h})


def flat(b, m, x, y, z, w, d, ry=0.0):
    """One upward quad (2 triangles), w x d turned ry: paper, notes, confetti."""
    c, s = math.cos(ry), math.sin(ry)
    pts = []
    for (u, v) in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)):
        pts.append((x + u * c + v * s, y, z - u * s + v * c))
    return b.poly(m, pts, [[0, 3, 2, 1]])


def slat(b, m, axis, s, at, out, y0, y1, w, d):
    """A slat seen from the room only: its front and two sides (no back
    against the wall, no ends)."""
    if axis == "x":
        z0, z1 = at + out * 0.012, at + out * (0.012 + d)
        P = [(s - w / 2, y0, z0), (s - w / 2, y0, z1), (s + w / 2, y0, z1), (s + w / 2, y0, z0),
             (s - w / 2, y1, z0), (s - w / 2, y1, z1), (s + w / 2, y1, z1), (s + w / 2, y1, z0)]
    else:
        x0, x1 = at + out * 0.012, at + out * (0.012 + d)
        P = [(x0, y0, s + w / 2), (x1, y0, s + w / 2), (x1, y0, s - w / 2), (x0, y0, s - w / 2),
             (x0, y1, s + w / 2), (x1, y1, s + w / 2), (x1, y1, s - w / 2), (x0, y1, s - w / 2)]
    return b.poly(m, P, [[1, 2, 6, 5], [0, 1, 5, 4], [2, 3, 7, 6]])


# ------------------------------------------------------------- a prop's frame

class At:
    """A prop's own frame: origin (x, y, z), turned ry about y (0: its front
    faces +z, like build_grinjuku's Frame). Local x across, z out of the front."""

    def __init__(self, x, y, z, ry=0.0):
        self.x, self.y, self.z, self.ry = x, y, z, ry
        self.c, self.s = math.cos(ry), math.sin(ry)

    def p(self, lx, ly, lz):
        return (self.x + lx * self.c + lz * self.s, self.y + ly, self.z - lx * self.s + lz * self.c)

    def box(self, b, m, w, h, d, lx, ly, lz, rx=0.0, rz=0.0, ry=0.0, bevel=0.0):
        X, Y, Z = self.p(lx, ly, lz)
        return b.box(m, w, h, d, X, Y, Z, ry=self.ry + ry, rx=rx, rz=rz, bevel=bevel)

    def cyl(self, b, m, r, a, c, seg=10, r2=None, caps=True):
        return b.cyl(m, r, self.p(*a), self.p(*c), seg=seg, r2=r2, caps=caps)

    def bar(self, b, m, a, c, w, h=None):
        return b.bar(m, self.p(*a), self.p(*c), w, h)


# ------------------------------------------------------------- truss, lights, cables

def truss(b, P, R, pid, x0, z0, x1, z1, y, size=0.29, hang=(), roof=7.4, cans=(), can_aim=(0.0, -1.0, 0.6)):
    """A box truss (four chords, zig-zag lacing on every face) along
    (x0, z0)-(x1, z1), its bottom chords at y; chain hoists up to `roof` at
    the fractions in `hang`; par cans clamped under it at the fractions in
    `cans` (a lens material each), aimed along `can_aim`."""
    R.begin(b, pid)
    a, c = Vector((x0, 0, z0)), Vector((x1, 0, z1))
    L = (c - a).length
    d = (c - a).normalized()
    side = Vector((-d.z, 0, d.x))
    h = size - 0.05
    chords = []
    for s in (-1, 1):
        for yy in (y + 0.025, y + 0.025 + h):
            o = side * (s * (size / 2 - 0.025))
            p0 = a + o + Vector((0, yy, 0))
            p1 = c + o + Vector((0, yy, 0))
            chords.append((s, yy))
            b.cyl(P["alu"], 0.024, tuple(p0), tuple(p1), seg=8)
    n = max(2, int(L / 0.5))
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        pa, pb = a + d * (L * t0), a + d * (L * t1)
        for s in (-1, 1):
            o = side * (s * (size / 2 - 0.025))
            lo, hi = Vector((0, y + 0.025, 0)), Vector((0, y + 0.025 + h, 0))
            # the side faces' zig-zag
            p, q = (pa + o + lo, pb + o + hi) if i % 2 == 0 else (pa + o + hi, pb + o + lo)
            b.cyl(P["alu"], 0.011, tuple(p), tuple(q), seg=4, caps=False)
        for yy in (y + 0.025, y + 0.025 + h):
            # the top and bottom faces' zig-zag
            l, r = side * (size / 2 - 0.025), side * -(size / 2 - 0.025)
            p, q = (pa + l, pb + r) if i % 2 == 0 else (pa + r, pb + l)
            b.cyl(P["alu"], 0.011, tuple(p + Vector((0, yy, 0))), tuple(q + Vector((0, yy, 0))), seg=4, caps=False)
    # end plates: a square frame closing each end
    ry = math.atan2(d.x, d.z)
    for e, k in ((a, 1), (c, -1)):
        q = e + d * (k * 0.012)
        for yy in (y + 0.0, y + size - 0.024):
            b.box(P["alu"], size, 0.024, 0.024, q.x, yy, q.z, ry=ry + math.pi / 2)
        for s2 in (-1, 1):
            o = side * (s2 * (size / 2 - 0.012))
            b.box(P["alu"], 0.024, size, 0.024, q.x + o.x, y, q.z + o.z, ry=ry)
    # hung from the ceiling (10 cm above it: no room for a hoist motor): a
    # plate on the slab, a chain down to a sling round the top chords
    for f in hang:
        p = a + d * (L * f)
        b.box(P["steel"], 0.2, 0.02, 0.2, p.x, roof - 0.02, p.z, ry=ry)
        b.cyl(P["steel"], 0.009, (p.x, y + size, p.z), (p.x, roof - 0.02, p.z), seg=5, caps=False)
        b.box(P["black"], 0.05, 0.03, size + 0.02, p.x, y + size - 0.03, p.z, ry=ry + math.pi / 2)
    R.end()
    # the par cans: clamp, yoke, can, lens
    aim = Vector(can_aim).normalized()
    for f, lens in cans:
        p = a + d * (L * f)
        R.begin(b, f"{pid}-can{f:.2f}", on=pid)
        top = y - 0.005
        b.box(P["black"], 0.06, 0.06, 0.07, p.x, top - 0.06, p.z)                 # the clamp on the bottom chords
        b.box(P["black"], 0.03, 0.1, 0.03, p.x, top - 0.16, p.z)                  # the yoke's stem
        c0 = Vector((p.x, top - 0.16, p.z))
        tail, head = c0 - aim * 0.12, c0 + aim * 0.14
        b.cyl(P["black"], 0.095, tuple(tail), tuple(head), seg=12)
        b.cyl(lens, 0.08, tuple(head), tuple(head + aim * 0.006), seg=12)
        R.end()


def cable_run(b, P, pts, y=0.0, tape_every=0.8):
    """A cable lying along the floor through `pts` [(x, z)], gaffer tape
    across it every `tape_every` m."""
    for (xa, za), (xb, zb) in zip(pts, pts[1:]):
        b.cyl(P["cable"], 0.011, (xa, y + 0.011, za), (xb, y + 0.011, zb), seg=6)
        L = math.hypot(xb - xa, zb - za)
        n = max(1, int(L / tape_every))
        ry = math.atan2(xb - xa, zb - za)
        for i in range(n):
            t = (i + 0.5) / n
            b.box(P["tape"], 0.12, 0.004, 0.05, xa + (xb - xa) * t, y + 0.0045, za + (zb - za) * t, ry=ry + math.pi / 2)


# ------------------------------------------------------------- speakers, cases

def speaker_stack(b, P, R, pid, x, z, ry):
    """Two subs and a top on casters: 1.2 x 0.85 footprint, 1.8 m."""
    f = At(x, 0, z, ry)
    R.begin(b, pid)
    for sx in (-0.5, 0.5):
        for sz in (-0.3, 0.3):
            f.cyl(b, P["rubber"], 0.04, (sx, 0.04, sz - 0.03), (sx, 0.04, sz + 0.03), seg=8)
            f.box(b, P["steel"], 0.08, 0.02, 0.08, sx, 0.08, sz)
    y = 0.1
    for k in range(2):
        H = 0.6
        f.box(b, P["case"], 1.2, H, 0.82, 0, y, 0, bevel=0.012)
        f.box(b, P["grille"], 1.1, H - 0.1, 0.02, 0, y + 0.05, 0.411)           # the grille, proud of the front
        for gx in (-0.28, 0.28):                                               # the drivers behind it (dark rings)
            f.cyl(b, P["cone"], 0.2, (gx, y + H / 2, 0.42), (gx, y + H / 2, 0.425), seg=16)
        for sx in (-0.6, 0.6):                                                 # handles in the sides
            f.box(b, P["steel"], 0.02, 0.05, 0.22, sx + (0.012 if sx > 0 else -0.012), y + H * 0.6, 0)
        for cx in (-0.58, 0.58):                                               # corner protectors
            for cy in (y + 0.02, y + H - 0.06):
                f.box(b, P["alu"], 0.06, 0.05, 0.06, cx, cy, 0.39)
        y += H + 0.005
    # the top: a horn and a 12" cone
    f.box(b, P["case"], 0.72, 0.52, 0.5, 0, y, -0.12, bevel=0.01)
    f.box(b, P["grille"], 0.66, 0.46, 0.02, 0, y + 0.03, 0.135)
    f.cyl(b, P["cone"], 0.15, (0.0, y + 0.18, 0.14), (0.0, y + 0.18, 0.145), seg=16)
    f.box(b, P["cone"], 0.4, 0.12, 0.01, 0, y + 0.36, 0.14)
    f.box(b, P["white"], 0.12, 0.03, 0.005, 0.24, y + 0.06, 0.148)             # the maker's plate
    R.end()
    # the collider: the turned footprint's bounds
    c, s = abs(math.cos(ry)), abs(math.sin(ry))
    R.collider(x, z, 1.2 * c + 0.85 * s, 1.2 * s + 0.85 * c, 1.8, 0, pen=3)


def road_case(b, P, R, pid, x, z, w, h, d, ry=0.0, y=0.0, wheels=True, on=None):
    """A flight case: black ply, aluminium edging, ball corners, latches,
    handles; on casters when `wheels`."""
    f = At(x, y, z, ry)
    R.begin(b, pid, on=on)
    y0 = 0.0
    if wheels:
        for sx in (-w / 2 + 0.07, w / 2 - 0.07):
            for sz in (-d / 2 + 0.07, d / 2 - 0.07):
                f.cyl(b, P["rubber"], 0.035, (sx, 0.035, sz - 0.025), (sx, 0.035, sz + 0.025), seg=8)
                f.box(b, P["steel"], 0.07, 0.015, 0.07, sx, 0.07, sz)
        y0 = 0.085
    H = h - y0
    f.box(b, P["case"], w - 0.02, H, d - 0.02, 0, y0, 0)
    for yy in (y0, y0 + H * 0.62, y0 + H - 0.03):                              # the edging round the lid line
        f.box(b, P["alu"], w, 0.03, d, 0, yy, 0)
    for sx in (-w / 2 + 0.015, w / 2 - 0.015):
        for sz in (-d / 2 + 0.015, d / 2 - 0.015):
            f.box(b, P["alu"], 0.03, H, 0.03, sx, y0, sz)
            f.box(b, P["chrome"], 0.045, 0.045, 0.045, sx, y0 + H - 0.04, sz)  # ball corners
    for sx in (-w * 0.3, w * 0.3):                                             # latches
        f.box(b, P["chrome"], 0.07, 0.05, 0.012, sx, y0 + H * 0.62 - 0.025, d / 2 + 0.002)
    f.box(b, P["steel"], 0.16, 0.025, 0.03, 0, y0 + H * 0.4, d / 2 + 0.005)   # the handle
    R.end()


# ------------------------------------------------------------- the bar

def bar_counter(b, P, R, x0, x1, z0, z1, top=1.1):
    """The counter on its collider (x0..x1, z0..z1): a fluted dark-wood front
    on the hall side (-x), a black kick, a stone top with a 6 cm lip, the
    violet glow under the lip, a brass foot rail 5 cm out, and on the
    bartender's side a beer font with three taps under the lip."""
    R.begin(b, "bar-counter")
    front = x0
    b.box(P["black"], x1 - x0 - 0.06, 0.12, z1 - z0, (x0 + x1) / 2 + 0.03, 0, (z0 + z1) / 2)        # the kick, set back
    b.box(P["wood"], x1 - x0 - 0.04, top - 0.12 - 0.05, z1 - z0, (x0 + x1) / 2 + 0.02, 0.12, (z0 + z1) / 2)
    # flutes: half-round staves down the front
    z = z0 + 0.06
    while z < z1 - 0.05:
        b.cyl(P["wood"], 0.028, (front + 0.035, 0.13, z), (front + 0.035, top - 0.07, z), seg=6, caps=False)
        z += 0.075
    # the top: black stone, a 6 cm lip on the hall side only
    b.box(P["stone"], x1 - x0 + 0.06, 0.05, z1 - z0 + 0.02, (x0 + x1) / 2 - 0.03, top - 0.05, (z0 + z1) / 2, bevel=0.008)
    b.box(P["brass"], 0.012, 0.012, z1 - z0, front - 0.054, top - 0.06, (z0 + z1) / 2)               # the brass nosing
    # the glow under the lip (the light the Studio strip gave)
    b.box(P["ring_pk"], 0.01, 0.015, z1 - z0 - 0.1, front + 0.01, top - 0.07, (z0 + z1) / 2)
    # the foot rail: brass, its brackets every 1.2 m
    rx = front - 0.028
    b.cyl(P["brass"], 0.022, (rx, 0.2, z0 + 0.05), (rx, 0.2, z1 - 0.05), seg=12)
    n = int((z1 - z0) / 1.2) + 1
    for i in range(n):
        zz = z0 + 0.15 + i * (z1 - z0 - 0.3) / max(1, n - 1)
        b.box(P["brass"], 0.03, 0.03, 0.02, front - 0.012, 0.19, zz)
    # the bartender's side: a font under the lip, three taps, a drip tray
    for zc in (z0 + 1.6, (z0 + z1) / 2, z1 - 1.6):
        b.box(P["chrome"], 0.05, 0.12, 0.34, x1 - 0.025, top - 0.25, zc)
        for dz in (-0.11, 0.0, 0.11):
            b.cyl(P["chrome"], 0.012, (x1, top - 0.19, zc + dz), (x1 + 0.05, top - 0.19, zc + dz), seg=6)
            b.box(P["black"], 0.025, 0.11, 0.025, x1 + 0.045, top - 0.19, zc + dz)                   # the handles
        b.box(P["steel"], 0.05, 0.02, 0.36, x1 + 0.03, top - 0.45, zc)
    R.end()
    R.face("bar-glow", "bar-counter", (front, top - 0.07, (z0 + z1) / 2), (-1, 0, 0), z1 - z0 - 0.1, 0.02)


def bar_top(b, P, R, rng, x0, x1, z0, z1, top):
    """On the counter, all of it under 9 cm (the bottle wall behind stays in
    view, rule 9): trays, a POS facing the bartender, a glass rack of
    tumblers, coasters, the rings bottles left, a few notes."""
    y = top
    R.begin(b, "bar-top", on="bar-counter")
    # a glass rack with tumblers at the north end
    b.box(P["black"], 0.5, 0.025, 0.5, (x0 + x1) / 2 + 0.1, y, z0 + 0.4)
    for i in range(4):
        for j in range(4):
            b.cyl(P["glass_ware"], 0.035, ((x0 + x1) / 2 - 0.05 + i * 0.1, y + 0.025, z0 + 0.25 + j * 0.1),
                  ((x0 + x1) / 2 - 0.05 + i * 0.1, y + 0.085, z0 + 0.25 + j * 0.1), seg=8)
    # the POS at the south end: a low tilted terminal facing the bartender (+x)
    b.box(P["black"], 0.3, 0.03, 0.24, x1 - 0.25, y, z1 - 0.5)
    b.box(P["black"], 0.04, 0.05, 0.2, x1 - 0.32, y + 0.03, z1 - 0.5)
    b.box(bpy.data.materials["KB_Screen"], 0.005, 0.045, 0.19, x1 - 0.295, y + 0.032, z1 - 0.5, rz=-0.6)
    # cork trays
    for zc in (z0 + 2.3, z1 - 2.4):
        b.cyl(P["cork"], 0.18, ((x0 + x1) / 2, y, zc), ((x0 + x1) / 2, y + 0.015, zc), seg=16)
    # coasters, rings and notes along the hall-side lip
    zz = z0 + 0.9
    while zz < z1 - 0.9:
        k = rng.random()
        xx = x0 + 0.18 + rng.uniform(-0.04, 0.06)
        if k < 0.45:
            b.cyl(P["paper"], 0.05, (xx, y, zz), (xx, y + 0.003, zz), seg=10)
        elif k < 0.75:
            b.cyl(P["label_k"], 0.04, (xx, y, zz), (xx, y + 0.0015, zz), seg=10)          # a bottle's ring
        else:
            flat(b, P["note"], xx + 0.05, y + 0.002, zz, 0.16, 0.075, rng.uniform(-0.6, 0.6))
        zz += rng.uniform(0.45, 0.8)
    R.end()


def back_bar_cabinet(b, P, R, x0, x1, z0, z1, top=1.0):
    """The back bar's lower cabinet, under the bottle shelves: black doors
    (the bartender's side of the counter; the counter hides it from the
    floor, so nothing on it needs to be seen)."""
    R.begin(b, "back-bar")
    b.box(P["gloss"], x1 - x0, top, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2)
    b.box(P["stone"], x1 - x0 + 0.02, 0.03, z1 - z0, (x0 + x1) / 2 - 0.01, top, (z0 + z1) / 2)
    z = z0 + 0.25
    while z < z1 - 0.1:
        b.box(P["black"], 0.004, top - 0.12, 0.006, x0 - 0.002, 0.06, z)
        b.box(P["chrome"], 0.012, 0.012, 0.12, x0 - 0.008, top - 0.2, z + 0.25)
        z += 0.5
    R.end()


def beer_fridge(b, P, R, rng, pid, x0, x1, z0, z1, h=1.9):
    """An upright glass-door fridge, its front at x0 facing -x: a white
    cabinet, a lit inside with shelves of bottles behind the glass, a chrome
    handle, a lit header."""
    R.begin(b, pid)
    zc, w = (z0 + z1) / 2, z1 - z0
    b.box(P["white"], x1 - x0 - 0.04, h, w, (x0 + x1) / 2 + 0.02, 0, zc)
    b.box(P["black"], 0.04, 0.1, w, x0 + 0.02, 0, zc)
    b.box(bpy.data.materials["KB_Fridge"], 0.004, h - 0.42, w - 0.08, x1 - 0.06, 0.12, zc)
    for k in range(4):
        yy = 0.16 + k * (h - 0.5) / 3.6
        b.box(P["steel"], x1 - x0 - 0.16, 0.012, w - 0.08, (x0 + x1) / 2 + 0.02, yy, zc)
        n = int((w - 0.12) / 0.075)
        for i in range(n):
            bottle(b, P, x0 + 0.17, yy + 0.012, z0 + 0.08 + i * 0.075, rng.choice(["bottle_g", "bottle_a", "bottle_c"]), h=0.24)
    b.box(P["steel"], 0.04, h - 0.32, 0.04, x0 + 0.02, 0.12, z0 + 0.02)
    b.box(P["steel"], 0.04, h - 0.32, 0.04, x0 + 0.02, 0.12, z1 - 0.02)
    b.box(P["steel"], 0.04, 0.04, w, x0 + 0.02, h - 0.24, zc)
    b.box(P["glass"], 0.008, h - 0.36, w - 0.08, x0 + 0.03, 0.14, zc)
    b.box(P["chrome"], 0.025, 0.7, 0.025, x0 - 0.0125, 0.6, z1 - 0.07)
    b.box(P["black"], 0.04, 0.16, w, x0 + 0.02, h - 0.2, zc)
    b.box(bpy.data.materials["KB_LensWarm"], 0.004, 0.08, w - 0.12, x0, h - 0.16, zc)
    R.end()
    R.face(pid, pid, (x0 + 0.03, 0.14 + (h - 0.36) / 2, zc), (-1, 0, 0), w - 0.08, h - 0.36)
    R.collider((x0 + x1) / 2, zc, x1 - x0, w, h, 0, pen=3)


def ice_well(b, P, R, x0, x1, z, y, w=0.6):
    """A steel ice well on the back bar's cabinet top, the ice heaped in it
    (under the bottle wall's bottom row)."""
    R.begin(b, "ice-well", on="back-bar")
    b.box(P["chrome"], x1 - x0, 0.17, w, (x0 + x1) / 2, y, z)
    b.box(P["glass_ware"], x1 - x0 - 0.04, 0.012, w - 0.04, (x0 + x1) / 2, y + 0.15, z)
    for i in range(5):
        b.box(P["white"], 0.04, 0.03, 0.04, (x0 + x1) / 2 - 0.08 + i * 0.04, y + 0.155, z - 0.2 + i * 0.09, ry=i)
    b.box(P["steel"], 0.03, 0.012, 0.16, (x0 + x1) / 2, y + 0.162, z + w / 2 - 0.12, ry=0.3)     # the scoop, lying in the ice (all of it under the bottle wall's bottom row)
    R.end()


def cable_drum(b, P, R, pid, x, z, r=0.2, w=0.3):
    """A cable drum on its side: two discs, the core, black cable wound on."""
    R.begin(b, pid)
    b.cyl(P["case"], r, (x - w / 2, r, z), (x - w / 2 + 0.025, r, z), seg=16)
    b.cyl(P["case"], r, (x + w / 2 - 0.025, r, z), (x + w / 2, r, z), seg=16)
    b.cyl(P["cable"], r * 0.8, (x - w / 2 + 0.025, r, z), (x + w / 2 - 0.025, r, z), seg=16)
    b.box(P["case"], w + 0.04, 0.03, 0.16, x, 0, z)
    R.end()


def bar_stool(b, P, R, pid, x, z):
    """A pedestal stool: weighted base, chrome column and foot ring, a red
    leather seat; 0.76 m, so it carries a collider."""
    R.begin(b, pid)
    b.cyl(P["chrome"], 0.22, (x, 0, z), (x, 0.03, z), seg=20)
    b.cyl(P["chrome"], 0.035, (x, 0.03, z), (x, 0.62, z), seg=10)
    n = 12
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        b.cyl(P["chrome"], 0.012, (x + math.cos(a0) * 0.17, 0.3, z + math.sin(a0) * 0.17),
              (x + math.cos(a1) * 0.17, 0.3, z + math.sin(a1) * 0.17), seg=5, caps=False)
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        b.cyl(P["chrome"], 0.01, (x, 0.3, z), (x + math.cos(a) * 0.17, 0.3, z + math.sin(a) * 0.17), seg=5)
    b.cyl(P["black"], 0.17, (x, 0.62, z), (x, 0.66, z), seg=20)
    b.cyl(P["leather"], 0.2, (x, 0.66, z), (x, 0.72, z), seg=24)
    b.cyl(P["leather"], 0.2, (x, 0.72, z), (x, 0.76, z), r2=0.17, seg=24)
    b.cyl(P["leather_dk"], 0.205, (x, 0.672, z), (x, 0.685, z), seg=24, caps=False)   # the piping
    R.end()
    R.collider(x, z, 0.44, 0.44, 0.76, 0, pen=1)


# ------------------------------------------------------------- booths, tables

def booth(b, P, R, pid, x, z, w, d, h, face):
    """A red quilted booth on its collider (w along the wall, d deep, h tall),
    facing `face` (+z or -z): black plinth, a seat of two cushions, a
    diamond-tufted back with buttons, gloss end panels."""
    s = 1 if face > 0 else -1
    ry = 0.0 if s > 0 else math.pi
    f = At(x, 0, z, ry)
    R.begin(b, pid)
    hd = d / 2
    f.box(b, P["black"], w - 0.12, 0.12, d - 0.1, 0, 0, 0.03)                           # the plinth, set back
    seat_d = d - 0.3
    for k in (-1, 1):                                                                   # two seat cushions
        f.box(b, P["leather"], (w - 0.14) / 2 - 0.01, 0.14, seat_d, k * (w - 0.14) / 4, 0.32, hd - seat_d / 2 - 0.01, bevel=0.035)
    f.box(b, P["leather_dk"], w - 0.14, 0.2, seat_d - 0.04, 0, 0.12, hd - seat_d / 2 - 0.02)   # the seat box
    # the back: a frame, then diamond-tufted pillows and buttons
    bz = -hd + 0.14
    f.box(b, P["leather_dk"], w - 0.14, h - 0.46, 0.18, 0, 0.46, bz - 0.04)
    rows, step = 5, (h - 0.52) / 5
    cols = int((w - 0.2) / step)
    x0 = -(cols - 1) * step / 2
    for r in range(rows):
        for c in range(cols - (r % 2)):
            lx = x0 + c * step + (step / 2 if r % 2 else 0)
            ly = 0.5 + r * step
            f.box(b, P["leather"], step * 0.7, step * 0.7, 0.06, lx, ly, bz + 0.07, rz=math.pi / 4)
    for r in range(rows + 1):
        for c in range(cols + 1 - ((r + 1) % 2)):
            lx = x0 - step / 2 + c * step + (step / 2 if (r + 1) % 2 else 0)
            if abs(lx) > w / 2 - 0.12:
                continue
            ly = 0.5 + r * step - step / 2 + step / 2
            f.box(b, P["button"], 0.03, 0.03, 0.02, lx, ly - 0.015, bz + 0.115, rz=math.pi / 4)
    # the top roll and the gloss ends
    f.box(b, P["leather"], w - 0.14, 0.07, 0.24, 0, h - 0.07, bz - 0.02, bevel=0.03)
    for k in (-1, 1):
        f.box(b, P["gloss"], 0.06, h, d, k * (w / 2 - 0.03), 0, 0)
        f.box(b, P["brass"], 0.065, 0.012, d, k * (w / 2 - 0.03), h - 0.012, 0)
    R.end()


def cocktail_table(b, P, R, pid, x, z, h=0.75, r=0.3):
    """A round table on its collider: black base and column, a stone top
    with a brass rim."""
    R.begin(b, pid)
    b.cyl(P["black"], 0.24, (x, 0, z), (x, 0.03, z), r2=0.2, seg=20)
    b.cyl(P["gloss"], 0.04, (x, 0.03, z), (x, h - 0.04, z), seg=10)
    b.cyl(P["stone"], r - 0.01, (x, h - 0.04, z), (x, h, z), seg=28)
    b.cyl(P["brass"], r, (x, h - 0.035, z), (x, h - 0.005, z), seg=28, caps=False)
    R.end()


def table_top(b, P, R, rng, pid, x, z, y, r=0.25):
    """On a booth table: an ice bucket with a bottle, two or three glasses,
    a napkin, sometimes notes (the liquor and the money)."""
    R.begin(b, pid + "-top", on=pid)
    bx, bz = x + rng.uniform(-0.06, 0.06), z + rng.uniform(-0.06, 0.06)
    b.cyl(P["chrome"], 0.09, (bx, y, bz), (bx, y + 0.2, bz), r2=0.1, seg=16)
    b.cyl(P["glass_ware"], 0.085, (bx, y + 0.17, bz), (bx, y + 0.19, bz), seg=16)            # the ice
    bottle(b, P, bx + 0.02, y + 0.06, bz - 0.01, rng.choice(["bottle_g", "bottle_c", "bottle_a"]), tilt=(0.25, 0.1))
    for k in range(rng.randint(2, 3)):
        a = rng.uniform(0, 2 * math.pi)
        gx, gz = x + math.cos(a) * r * 0.75, z + math.sin(a) * r * 0.75
        b.cyl(P["glass_ware"], 0.035, (gx, y, gz), (gx, y + 0.11, gz), r2=0.04, seg=10)
        if rng.random() < 0.6:
            b.cyl(P["red"], 0.003, (gx + 0.01, y + 0.05, gz), (gx + 0.03, y + 0.16, gz + 0.01), seg=4)   # a straw
    if rng.random() < 0.7:
        flat(b, P["note"], x - r * 0.4, y + 0.002, z + r * 0.3, 0.16, 0.075, rng.uniform(-1, 1))
    R.end()


def bottle(b, P, x, y, z, glass, tilt=(0.0, 0.0), h=0.3, label=True):
    """A liquor bottle: body, shoulder, neck, a pour spout; a label band."""
    up = Vector((tilt[0], 1.0, tilt[1])).normalized()
    p0 = Vector((x, y, z))
    body, sh, nk = p0 + up * (h * 0.62), p0 + up * (h * 0.74), p0 + up * h
    b.cyl(P[glass], 0.038, tuple(p0), tuple(body), seg=10)
    b.cyl(P[glass], 0.038, tuple(body), tuple(sh), r2=0.014, seg=10, caps=False)
    b.cyl(P[glass], 0.014, tuple(sh), tuple(nk), seg=8)
    b.cyl(P["chrome"], 0.007, tuple(nk), tuple(nk + up * 0.05), r2=0.004, seg=6)      # the pour spout
    if label:
        b.cyl(P["label"], 0.039, tuple(p0 + up * (h * 0.22)), tuple(p0 + up * (h * 0.46)), seg=10, caps=False)


# ------------------------------------------------------------- the stage

def stage(b, P, R, x0, x1, z0, z1, top, step):
    """The DJ stage on its colliders: black gloss fascia flush with the
    collider face (the code's neon edge sits 5 mm proud of it), a black deck
    with board joints, the front step in steel with an amber edge light."""
    R.begin(b, "stage")
    b.box(P["gloss"], x1 - x0, top - 0.004, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2)
    b.box(P["black"], x1 - x0 - 0.01, 0.004, z1 - z0 - 0.01, (x0 + x1) / 2 - 0.005, top - 0.004, (z0 + z1) / 2)
    for zz in [z0 + 0.6 + 1.2 * i for i in range(int((z1 - z0 - 0.6) / 1.2) + 1)]:       # the deck's board joints
        b.box(P["gloss"], x1 - x0 - 0.02, 0.0015, 0.01, (x0 + x1) / 2 - 0.005, top, zz)
    sx0, sx1, sz0, sz1, sh = step
    b.box(P["gloss"], sx1 - sx0, sh - 0.004, sz1 - sz0, (sx0 + sx1) / 2, 0, (sz0 + sz1) / 2)
    b.box(P["steel"], sx1 - sx0 - 0.01, 0.004, sz1 - sz0, (sx0 + sx1) / 2 - 0.005, sh - 0.004, (sz0 + sz1) / 2)
    b.box(bpy.data.materials["KB_Amber"], 0.03, 0.006, sz1 - sz0 - 0.1, sx1 - 0.03, sh, (sz0 + sz1) / 2)  # the step's edge light
    R.end()


def monitor_wedge(b, P, R, pid, x, z, y, ry):
    """A floor monitor: a wedge cabinet, its grille tilted up at the DJ."""
    f = At(x, y, z, ry)
    R.begin(b, pid, on="stage")
    prof = [(-0.25, 0.0), (0.25, 0.0), (0.25, 0.12), (-0.18, 0.32), (-0.25, 0.32)]
    pts = []
    for lx in (-0.28, 0.28):
        for (lz, ly) in prof:
            pts.append(f.p(lx, ly, lz))
    n = len(prof)
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    b.poly(P["case"], pts, faces)
    # the grille on the sloped face
    a = math.atan2(0.2, 0.43)
    X, Y, Z = f.p(0, 0.215, 0.035)
    b.box(P["grille"], 0.5, 0.012, 0.42, X, Y, Z, ry=ry, rx=-a)
    R.end()


def dj_laptop(b, P, R, x, z, y, ry):
    """A laptop on a stand on the booth top, its screen toward the DJ."""
    f = At(x, y, z, ry)
    R.begin(b, "dj-laptop", on="dj-booth")
    f.box(b, P["alu"], 0.02, 0.16, 0.02, -0.1, 0, 0.08)
    f.box(b, P["alu"], 0.02, 0.16, 0.02, 0.1, 0, 0.08)
    f.box(b, P["alu"], 0.26, 0.012, 0.24, 0, 0.16, 0.0, rx=0.25)
    f.box(b, P["alu"], 0.33, 0.012, 0.23, 0, 0.17, 0.0, rx=0.25)                              # the base
    f.box(b, P["alu"], 0.33, 0.22, 0.008, 0, 0.2, -0.12, rx=-0.25)                            # the lid
    f.box(b, bpy.data.materials["KB_Screen"], 0.3, 0.19, 0.002, 0, 0.215, -0.114, rx=-0.25)
    R.end()


def cable_loom(b, P, pts, y, r=0.03):
    for a, c in zip(pts, pts[1:]):
        b.cyl(P["cable"], r, (a[0], y + r, a[1]), (c[0], y + r, c[1]), seg=8)
        b.cyl(P["tape"], r + 0.004, (a[0], y + r, a[1]), (a[0] + (c[0] - a[0]) * 0.04, y + r, a[1] + (c[1] - a[1]) * 0.04), seg=8)


# ------------------------------------------------------------- the mezzanine

def glass_rail(b, P, R, pid, x, z0, z1, y, h=1.0, post_every=1.3):
    """A glass balustrade along x = x, z0..z1, standing on the deck at y:
    a steel shoe, square posts, frameless glass panes, a steel handrail."""
    R.begin(b, pid)
    b.box(P["steel"], 0.1, 0.1, z1 - z0, x, y, (z0 + z1) / 2)
    n = max(1, int(round((z1 - z0) / post_every)))
    for i in range(n + 1):
        zz = z0 + 0.03 + i * (z1 - z0 - 0.06) / n
        b.box(P["steel"], 0.05, h - 0.05, 0.05, x, y + 0.1, zz)
    for i in range(n):
        za = z0 + 0.03 + i * (z1 - z0 - 0.06) / n + 0.04
        zb = z0 + 0.03 + (i + 1) * (z1 - z0 - 0.06) / n - 0.04
        b.box(P["glass"], 0.016, h - 0.2, zb - za, x, y + 0.1, (za + zb) / 2)
    b.cyl(P["steel"], 0.025, (x, y + h - 0.025, z0), (x, y + h - 0.025, z1), seg=10)
    R.end()


def lounge_booth(b, P, R, pid, x0, x1, z0, z1, y, h=1.1):
    """A smaller black-leather booth on the mezzanine, its back to the wall
    at x1, facing -x."""
    R.begin(b, pid)
    w, d = z1 - z0, x1 - x0
    zc, xc = (z0 + z1) / 2, (x0 + x1) / 2
    b.box(P["black"], d - 0.08, 0.1, w - 0.1, xc + 0.04, y, zc)
    b.box(P["sofa"], d - 0.28, 0.36, w - 0.12, xc - 0.1, y + 0.1, zc, bevel=0.03)
    b.box(P["sofa"], 0.2, h - 0.1, w - 0.12, x1 - 0.12, y + 0.1, zc, bevel=0.03)
    nb = int((w - 0.3) / 0.22)
    for i in range(nb):                                                                   # channel stitching
        zz = z0 + 0.2 + i * (w - 0.4) / max(1, nb - 1)
        b.box(P["black"], 0.005, h - 0.35, 0.012, x1 - 0.222, y + 0.5, zz)
    for zz in (z0 + 0.03, z1 - 0.03):
        b.box(P["gloss"], d, h - 0.1, 0.06, xc, y + 0.1, zz)
    R.end()


def sofa(b, P, R, pid, x0, x1, z0, z1, y):
    """A low three-seat sofa against the wall at x1, facing -x."""
    R.begin(b, pid)
    w, d = z1 - z0, x1 - x0
    zc, xc = (z0 + z1) / 2, (x0 + x1) / 2
    for zz in (z0 + 0.08, z1 - 0.08):
        b.box(P["black"], 0.04, 0.08, 0.04, x0 + 0.08, y, zz)
        b.box(P["black"], 0.04, 0.08, 0.04, x1 - 0.08, y, zz)
    b.box(P["fabric"], d, 0.2, w, xc, y + 0.08, zc)
    for k in range(3):
        zz = z0 + 0.17 + (k + 0.5) * (w - 0.34) / 3
        b.box(P["fabric"], d - 0.28, 0.14, (w - 0.34) / 3 - 0.02, xc - 0.12, y + 0.28, zz, bevel=0.04)
        b.box(P["fabric"], 0.2, 0.4, (w - 0.34) / 3 - 0.02, x1 - 0.12, y + 0.36, zz, bevel=0.05)
    for zz in (z0 + 0.085, z1 - 0.085):
        b.box(P["fabric"], d, 0.32, 0.17, xc, y + 0.28, zz, bevel=0.05)
    R.end()


def low_table(b, P, R, pid, x, z, y, w, d, h=0.42):
    R.begin(b, pid)
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box(P["black"], 0.04, h - 0.03, 0.04, x + sx * (w / 2 - 0.05), y, z + sz * (d / 2 - 0.05))
    b.box(P["gloss"], w, 0.03, d, x, y + h - 0.03, z)
    R.end()


def ashtray(b, P, x, y, z):
    b.cyl(P["glass_ware"], 0.06, (x, y, z), (x, y + 0.03, z), seg=10)
    for a in (0.3, 2.4):
        b.cyl(P["paper"], 0.004, (x + math.cos(a) * 0.03, y + 0.03, z + math.sin(a) * 0.03),
              (x + math.cos(a) * 0.065, y + 0.032, z + math.sin(a) * 0.065), seg=4)


def sound_desk(b, P, R, x0, x1, z0, z1, y, h=0.8):
    """The front-of-house desk on its collider (y is the deck), the
    engineer on the -x side: a black table, a mixing console sloped toward
    -x with fader rows and knob rows, a meter bridge lit green and amber."""
    R.begin(b, "sound-desk")
    xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    for zz in (z0 + 0.05, z1 - 0.05):
        for xx in (x0 + 0.05, x1 - 0.05):
            b.box(P["black"], 0.05, h - 0.04, 0.05, xx, y, zz)
    b.box(P["gloss"], x1 - x0, 0.04, z1 - z0, xc, y + h - 0.04, zc)
    # the console: a wedge, low at the front (-x)
    cx0, cx1 = x0 + 0.05, x1 - 0.08
    prof = [(cx0, 0.0), (cx1, 0.0), (cx1, 0.13), (cx0, 0.04)]
    pts = []
    for zz in (z0 + 0.1, z1 - 0.1):
        for (xx, yy) in prof:
            pts.append((xx, y + h + yy, zz))
    n = len(prof)
    b.poly(P["case"], pts, [list(range(n)), list(range(2 * n - 1, n - 1, -1))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)])
    slope = math.atan2(0.09, cx1 - cx0)
    rng = random.Random(77)
    nch = int((z1 - z0 - 0.3) / 0.075)
    for i in range(nch):
        zz = z0 + 0.18 + i * 0.075
        # the fader slot and cap at the front, the knobs further up
        fx = cx0 + 0.1
        fy = y + h + 0.04 + (fx - cx0) * math.tan(slope)
        b.box(P["black"], 0.12, 0.004, 0.008, fx, fy, zz, rz=slope)
        cap = fx + rng.uniform(-0.04, 0.04)
        b.box(P["white"] if i % 8 else P["red"], 0.022, 0.018, 0.016, cap, y + h + 0.04 + (cap - cx0) * math.tan(slope), zz, rz=slope)
        for k in range(4):
            kx = cx0 + 0.25 + k * 0.08
            ky = y + h + 0.04 + (kx - cx0) * math.tan(slope)
            b.cyl(P["grille"], 0.011, (kx, ky, zz), (kx, ky + 0.018, zz), seg=6)
    # the meter bridge along the back
    b.box(P["case"], 0.06, 0.1, z1 - z0 - 0.2, cx1 + 0.03, y + h + 0.13, zc)
    b.box(bpy.data.materials["KB_Exit"], 0.004, 0.035, z1 - z0 - 0.4, cx1 - 0.002, y + h + 0.17, zc)
    b.box(bpy.data.materials["KB_Amber"], 0.004, 0.015, z1 - z0 - 0.4, cx1 - 0.002, y + h + 0.207, zc)
    R.end()


# ------------------------------------------------------------- the riser

def riser(b, P, R, x0, x1, z0, z1, door_x):
    """The cable riser (the mid rope room): a steel door folded back flat
    against the north wall, patch panels between Grinjuku's pipes (0.9 and
    2.2 m) on the north and west walls, a cable tray and conduit above
    2.4 m. Everything 6 cm or less off the walls below 2.4 m."""
    R.begin(b, "riser")
    # the doorway's steel frame, on the blocks' faces either side
    for zz in (z0 + 0.03, z1 - 0.03):
        b.box(P["steel"], 0.08, 2.92, 0.06, door_x + 0.16, 0, zz)
    b.box(P["steel"], 0.08, 0.08, z1 - z0, door_x + 0.16, 2.92, (z0 + z1) / 2)
    # the door, open flat on the north wall by the doorway
    b.box(P["steel"], 0.92, 2.1, 0.04, door_x - 0.52, 0, z0 + 0.02)
    b.box(P["chrome"], 0.12, 0.03, 0.03, door_x - 0.86, 1.0, z0 + 0.055)
    for yy in (0.25, 1.6):
        b.box(P["black"], 0.08, 0.12, 0.02, door_x - 0.08, yy, z0 + 0.05)                     # the hinges
    # patch panels: north wall and west wall, 1.05 .. 2.0 m
    rng = random.Random(311)
    for (px, pz, along) in ((x0 + 0.9, z0, "x"), (x0 + 1.9, z0, "x"), (x0, z0 + 1.2, "z"), (x0, z0 + 2.5, "z")):
        w, h = 0.6, 0.9
        if along == "x":
            b.box(P["case"], w, h, 0.05, px, 1.05, pz + 0.025)
            for r in range(6):
                yy = 1.12 + r * 0.13
                b.box(P["grille"], w - 0.08, 0.06, 0.01, px, yy, pz + 0.055)
                for k in range(0, 12, 3):
                    if rng.random() < 0.7:
                        b.box(bpy.data.materials["KB_Exit"] if rng.random() < 0.8 else bpy.data.materials["KB_Amber"],
                              0.008, 0.008, 0.004, px - (w - 0.1) / 2 + k * 0.045, yy + 0.04, pz + 0.061)
        else:
            b.box(P["case"], 0.05, h, w, px + 0.025, 1.05, pz)
            for r in range(6):
                yy = 1.12 + r * 0.13
                b.box(P["grille"], 0.01, 0.06, w - 0.08, px + 0.055, yy, pz)
                for k in range(0, 12, 3):
                    if rng.random() < 0.7:
                        b.box(bpy.data.materials["KB_Exit"], 0.004, 0.008, 0.008, px + 0.061, yy + 0.04, pz - (w - 0.1) / 2 + k * 0.045)
    # the cable tray round the west and north walls at 2.6 m, cables in it
    for (a, c) in (((x0 + 0.08, z0 + 0.2), (x0 + 0.08, z1 - 0.1)), ((x0 + 0.2, z0 + 0.08), (x1 - 0.3, z0 + 0.08))):
        L = math.hypot(c[0] - a[0], c[1] - a[1])
        ry = math.atan2(c[0] - a[0], c[1] - a[1])
        mx, mz = (a[0] + c[0]) / 2, (a[1] + c[1]) / 2
        b.box(P["steel"], 0.14, 0.01, L, mx, 2.6, mz, ry=ry)
        for side in (-1, 1):
            ox, oz = math.cos(ry) * side * 0.07, -math.sin(ry) * side * 0.07
            b.box(P["steel"], 0.006, 0.06, L, mx + ox, 2.6, mz + oz, ry=ry)
        for k in range(4):
            ox, oz = math.cos(ry) * (-0.045 + k * 0.03), -math.sin(ry) * (-0.045 + k * 0.03)
            b.cyl(P["cable"] if k % 2 else P["red"], 0.01, (a[0] + ox, 2.625, a[1] + oz), (c[0] + ox, 2.625, c[1] + oz), seg=6)
    # conduit up the corner to the mezzanine
    b.cyl(P["steel"], 0.02, (x0 + 0.05, 2.4, z0 + 0.05), (x0 + 0.05, 2.99, z0 + 0.05), seg=8)
    R.end()


# ------------------------------------------------------------- the hall's shell

def battens(b, P, R, pid, axis, at, s0, s1, y0, y1, out, gaps=(), pitch=0.14, w=0.045, d=0.035):
    """Vertical slats with depth on a wall: along `axis` ("x": the wall at
    z = at; "z": at x = at), s0..s1, y0..y1, standing `out` (+1/-1) off the
    wall's face, skipping the `gaps` [(s0, s1, y0, y1)] (doors, screens,
    windows: they stay clear)."""
    R.begin(b, pid)
    s = s0 + pitch / 2
    while s < s1 - pitch / 4:
        spans = [(y0, y1)]
        for (g0, g1, gy0, gy1) in gaps:
            if g0 - w <= s <= g1 + w:
                nxt = []
                for (a, c) in spans:
                    if gy0 > a:
                        nxt.append((a, min(c, gy0)))
                    if gy1 < c:
                        nxt.append((max(a, gy1), c))
                spans = [(a, c) for (a, c) in nxt if c - a > 0.08]
        for (a, c) in spans:
            slat(b, P["wood"], axis, s, at, out, a, c, w, d)
        s += pitch
    R.end()


def pilaster(b, P, R, pid, x, z, w, d, top, rings, ring_mat):
    """An engaged column against a wall, ringed in light at `rings` heights."""
    R.begin(b, pid)
    b.box(P["gloss"], w, top, d, x, 0, z)
    for yy in rings:
        b.box(ring_mat, w + 0.03, 0.04, d + 0.03, x, yy, z)
        b.box(P["brass"], w + 0.02, 0.01, d + 0.02, x, yy - 0.012, z)
    R.end()
    R.collider(x, z, w + 0.03, d + 0.03, top, 0, pen=20)


def exit_sign(b, P, R, pid, x, y, z, face):
    """A lit EXIT box over a door: the running man is a light panel, no text
    (the game's copy stays in the code)."""
    R.begin(b, pid)
    nx, nz = face
    w, h, t = 0.36, 0.16, 0.05
    if nx:
        b.box(P["white"], t, h, w, x + nx * t / 2, y, z)
        b.box(bpy.data.materials["KB_Exit"], 0.004, h - 0.03, w - 0.03, x + nx * (t + 0.002), y + 0.015, z)
    else:
        b.box(P["white"], w, h, t, x, y, z + nz * t / 2)
        b.box(bpy.data.materials["KB_Exit"], w - 0.03, h - 0.03, 0.004, x, y + 0.015, z + nz * (t + 0.002))
    R.end()
    R.face(pid, pid, (x + nx * (t + 0.002), y + h / 2, z + nz * (t + 0.002)), (nx, 0, nz), w, h)


def extinguisher_cabinet(b, P, R, pid, x, y, z, face):
    """A red cabinet with a glass door, 5 cm off the wall: the extinguisher
    inside, behind the glass."""
    R.begin(b, pid)
    nx, nz = face
    w, h, t = 0.3, 0.66, 0.05
    if nz:
        b.box(P["red"], w, h, t, x, y, z + nz * t / 2)
        b.box(P["glass"], w - 0.06, h - 0.1, 0.004, x, y + 0.05, z + nz * (t + 0.002))
        b.cyl(P["red"], 0.075, (x, y + 0.08, z + nz * 0.025), (x, y + 0.5, z + nz * 0.025), seg=12)
    else:
        b.box(P["red"], t, h, w, x + nx * t / 2, y, z)
        b.box(P["glass"], 0.004, h - 0.1, w - 0.06, x + nx * (t + 0.002), y + 0.05, z)
        b.cyl(P["red"], 0.075, (x + nx * 0.025, y + 0.08, z), (x + nx * 0.025, y + 0.5, z), seg=12)
    R.end()


def bin_(b, P, R, pid, x, z, h=0.55, r=0.19):
    R.begin(b, pid)
    b.cyl(P["steel"], r, (x, 0, z), (x, h, z), r2=r * 1.06, seg=16)
    b.cyl(P["black"], r * 1.08, (x, h, z), (x, h + 0.03, z), seg=16)
    b.cyl(P["black"], r * 0.5, (x, h + 0.03, z), (x, h + 0.035, z), seg=12)
    R.end()


def drink_rail(b, P, R, pid, x0, x1, z, y, depth, face):
    """A wall shelf for drinks (it sticks out, so it has a collider)."""
    R.begin(b, pid)
    zc = z + face * depth / 2
    b.box(P["wood"], x1 - x0, 0.04, depth, (x0 + x1) / 2, y, zc)
    b.box(P["brass"], x1 - x0, 0.012, 0.012, (x0 + x1) / 2, y + 0.034, z + face * (depth - 0.006))
    n = int((x1 - x0) / 0.6) + 1
    for i in range(n):
        xx = x0 + 0.05 + i * (x1 - x0 - 0.1) / max(1, n - 1)
        b.box(P["black"], 0.02, 0.18, depth * 0.8, xx, y - 0.18, z + face * depth * 0.4, rx=0.0)
    R.end()
    R.collider((x0 + x1) / 2, zc, x1 - x0, depth, 0.06, y - 0.02, pen=1)


def coat_check(b, P, R, pid, x0, x1, z, y0, y1, face):
    """A coat-check hatch in a wall, flush: a lit window and a 5 cm ledge."""
    R.begin(b, pid)
    zc = z + face * 0.01
    b.box(P["gloss"], x1 - x0 + 0.1, y1 - y0 + 0.1, 0.02, (x0 + x1) / 2, y0 - 0.05, zc)
    b.box(bpy.data.materials["KB_Hatch"], x1 - x0, y1 - y0, 0.004, (x0 + x1) / 2, y0, z + face * 0.022)
    b.box(P["brass"], x1 - x0 + 0.06, 0.03, 0.05, (x0 + x1) / 2, y0 - 0.03, z + face * 0.025)
    R.end()
    R.face(pid, pid, ((x0 + x1) / 2, (y0 + y1) / 2, z + face * 0.024), (0, 0, face), x1 - x0, y1 - y0)


def ceiling_grid(b, P, R, x0, x1, z0, z1, xs, zs, y):
    """Unistrut beams under the hall's ceiling: along z at each of `xs`,
    along x at each of `zs`, 12 cm deep up to y."""
    R.begin(b, "ceiling-grid")
    for x in xs:
        b.box(P["black"], 0.08, 0.12, z1 - z0, x, y - 0.12, (z0 + z1) / 2)
    for z in zs:
        b.box(P["black"], x1 - x0, 0.1, 0.08, (x0 + x1) / 2, y - 0.1, z)
    R.end()


# ------------------------------------------------------------- scatter

def scatter_floor(b, P, R, rng, pid, rect, n_cash, n_confetti, n_litter, y=0.0, avoid=()):
    """The lived-in floor: notes, confetti and litter (straws, napkins,
    receipts) over rect (x0, x1, z0, z1), never inside `avoid` rects."""
    x0, x1, z0, z1 = rect
    R.begin(b, pid)

    def spot():
        for _ in range(40):
            x, z = rng.uniform(x0, x1), rng.uniform(z0, z1)
            if not any(a0 <= x <= a1 and c0 <= z <= c1 for (a0, a1, c0, c1) in avoid):
                return x, z
        return None
    for _ in range(n_cash):
        p = spot()
        if p:
            flat(b, P["note"] if rng.random() < 0.75 else P["note_b"], p[0], y + 0.006, p[1], 0.16, 0.076, rng.uniform(0, math.pi))
    conf = [P["white"], P["red"], P["brass"], P["note_b"], P["leather"]]
    for _ in range(n_confetti):
        p = spot()
        if p:
            flat(b, rng.choice(conf), p[0], y + 0.0065, p[1], 0.018, 0.012, rng.uniform(0, math.pi))
    for _ in range(n_litter):
        p = spot()
        if not p:
            continue
        k = rng.random()
        if k < 0.35:
            b.cyl(P["red"] if rng.random() < 0.5 else P["white"], 0.0035, (p[0], y + 0.0095, p[1]),
                  (p[0] + rng.uniform(-0.18, 0.18), y + 0.0095, p[1] + rng.uniform(-0.18, 0.18)), seg=4)
        elif k < 0.7:
            flat(b, P["paper"], p[0], y + 0.007, p[1], 0.12, 0.12, rng.uniform(0, math.pi))
        else:
            flat(b, P["paper"], p[0], y + 0.0075, p[1], 0.06, 0.14, rng.uniform(0, math.pi))
    R.end()
