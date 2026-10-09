"""
Shared pieces for the detailed assault rifles (build_ar_<id>.blender.py).

Each rifle is modelled on the outline traced for weapon-ars.js: spec() reads
its committed spec (bore, grip, hand, irons, rail, barrel, muzzle) so the
anchors land exactly where the tested traced gun has them, and gunkit's
auto_body lofts the outline into rounded solids. A builder adds the parts
that make the gun itself: rails, barrel, muzzle device, mag, irons.

Materials follow the Green Candles recipe (weapon-model.js GC_TUNE): the
view-model lights are blue, so greys are warmed and kept low-metal (a metal
finish just mirrors the blue sky); small steel parts are bright metal.
"""
import math
import os
import re

import gunkit as gk
from gunkit import (Part, Vector, TAU, material, lathe, box, local_lathe, sweep, catmull, empty,
                    Ref, ars_outline, span, picatinny, vert_loft)

HERE = os.path.dirname(os.path.abspath(__file__))
ARS_JS = os.path.join(os.path.dirname(HERE), "weapon-ars.js")


def spec(gun_id):
    """The numbers out of one AR_SPECS entry in weapon-ars.js."""
    src = open(ARS_JS, encoding="utf8").read()
    i = src.index("  " + gun_id + ": {")
    blk = src[i:src.find("\n  },", i)]
    num = lambda pat: [float(v) for v in re.search(pat, blk).groups()]
    s = {}
    s["lengthM"], = num(r"lengthM: ([\d.]+)")
    s["pxLen"] = num(r"pxLen: \[([\d.]+), ?([\d.]+)\]")
    s["dir"], = num(r"dir: (-?1)")
    s["boreY"], = num(r"boreY: ([\d.]+)")
    s["gripAt"] = num(r"gripAt: \[([\d.]+), ?([\d.]+)\]")
    s["barrel"] = num(r"barrel: \{ x: \[([\d.]+), ?([\d.]+)\], r: ([\d.]+)")
    s["muzzle"] = num(r"muzzle: \{ x: \[([\d.]+), ?([\d.]+)\], r: ([\d.]+)")
    s["railTop"], = num(r"railTop: ([\d.]+)")
    s["opticX"], = num(r"opticX: ([\d.]+)")
    s["hand"] = num(r"hand: \{ x: ([\d.]+), top: ([\d.]+), bottom: ([\d.]+)")
    s["iron"] = num(r"iron: \{ y: ([\d.]+), rearX: ([\d.]+)")
    s["ironParts"] = [[float(v) for v in m] for m in re.findall(r"\[([\d.]+), ?([\d.]+), ?([\d.]+), ?([\d.]+)\]", blk[blk.index("ironParts"):])]
    s["dir"] = int(s["dir"])
    return s


def setup(prefix, gun_id, recv=0x5d5747, rail=0x4a4539, poly=0x373227, magm=0x454035, furn=None, steel=0x9aa0a4):
    """Materials (prefix_Receiver ...) and the rifle's Ref, spec and outline."""
    gk.M.update({
        "recv":  material(prefix + "_Receiver", recv, 0.5, 0.0),
        "rail":  material(prefix + "_Rail", rail, 0.52, 0.0),
        "poly":  material(prefix + "_Polymer", poly, 0.8, 0.0),
        "steel": material(prefix + "_Steel", steel, 0.3, 1.0),
        "dark":  material(prefix + "_Dark", 0x15120f, 0.6, 0.0),
        "magm":  material(prefix + "_Mag", magm, 0.58, 0.0),
        "dot":   material(prefix + "_Dot", 0xffffff, 0.4, 0.0, 0xd8f0ff, 1.0),
        "furn":  material(prefix + "_Furniture", furn if furn is not None else poly, 0.74, 0.0),
    })
    s = spec(gun_id)
    R = Ref(s["lengthM"], s["pxLen"], s["dir"], s["boreY"], s["gripAt"])
    return R, s, ars_outline(gun_id)


def rail_base(R, s):
    """The pixel row a Picatinny rail sits on so its crown is the traced top."""
    return s["railTop"] + 0.0105 / R.s


def rail(P, R, s, px0, px1, key="rail"):
    picatinny(P, R.Z(px0), R.Z(px1), R.Y(s["railTop"]) - 0.0105, 0.0105, key)


def barrel(P, R, s, px0=None, px1=None, r=0.0072, collar=None):
    """The barrel from the receiver/handguard (px0) to the muzzle device
    (px1), on the bore; collar = (px, r) a gas block or shoulder ring."""
    b0, b1 = s["barrel"][0], s["barrel"][1]
    m0, m1 = s["muzzle"][0], s["muzzle"][1]
    rear = px0 if px0 is not None else (b1 if s["dir"] < 0 else b0)
    if s["dir"] > 0:
        rear = px0 if px0 is not None else b1
        front = px1 if px1 is not None else max(m0, m1) - 2
    else:
        rear = px0 if px0 is not None else b0
        front = px1 if px1 is not None else min(m0, m1) + 2
    prof = [(R.Z(rear), 0.0), (R.Z(rear), r * 1.25), (R.Z(rear) + (R.Z(front) - R.Z(rear)) * 0.06, r * 1.25),
            (R.Z(rear) + (R.Z(front) - R.Z(rear)) * 0.08, r), (R.Z(front), r * 0.95), (R.Z(front), 0.0)]
    lathe(P, prof, "steel", segs=24)
    if collar:
        cz = R.Z(collar[0])
        lathe(P, [(cz + 0.008, 0.0), (cz + 0.008, collar[1]), (cz - 0.008, collar[1]), (cz - 0.008, 0.0)], "steel", segs=20)


def device(prefix, R, s, kind="birdcage", r=0.0105, name="Hider"):
    """The muzzle device as its own node (hidden under a barrel attachment):
    birdcage (slotted), brake (ported block) or can (a plain stub)."""
    m0, m1 = sorted(s["muzzle"][:2])
    back, front = (m1, m0) if s["dir"] > 0 else (m0, m1)
    zb, zf = R.Z(back), R.Z(front)
    P = Part(prefix + "_" + name)
    if kind == "brake":
        lathe(P, [(zb, 0.0), (zb, r * 0.8), (zb + (zf - zb) * 0.1, r), (zf - (zf - zb) * 0.06, r), (zf, r * 0.85), (zf, 0.0)], "steel", segs=24)
        for k in range(3):
            z = zb + (zf - zb) * (0.3 + 0.2 * k)
            for sx in (-1, 1):
                box(P, (sx * r * 0.82, 0, z), (r * 0.5, r * 1.2, abs(zf - zb) * 0.1), "dark")
    else:
        lathe(P, [(zb, 0.0), (zb, r), (zf - (zf - zb) * 0.05, r), (zf, r * 0.88), (zf, 0.0)], "steel", segs=24)
        if kind == "birdcage":
            for k in range(5):
                a = TAU * k / 6 + TAU / 4
                rad = Vector((math.cos(a), math.sin(a), 0))
                box(P, Vector((0, 0, zb + (zf - zb) * 0.6)) + rad * r, (0.0030, 0.0012, abs(zf - zb) * 0.5), "dark",
                    (Vector((-math.sin(a), math.cos(a), 0)), rad, Vector((0, 0, 1))))
    local_lathe(P, (0, 0, zf + (0.0002 if s["dir"] < 0 else -0.0002) * 0), (0, 0, -1 if zf < zb else 1),
                [(0, r * 0.45), (0.0004, r * 0.45), (0.0005, 0.0)], "dark", segs=14)
    P.finish(bevel=0.0002)


def mag(prefix, R, O, hw=0.0118, ribs=True, base=True):
    """The magazine as its own node, pivot at its top centre (the mag point)."""
    poly = O["mag"]
    top = min(p[1] for p in poly)
    bot = max(p[1] for p in poly)
    xs = [p[0] for p in poly if p[1] <= top + 4]
    pivot = R.P((min(xs) + max(xs)) / 2, top + 6)
    P = Part(prefix + "_Mag", pivot=tuple(pivot))
    vert_loft(P, R, poly, top + 1, bot - (10 if base else 1), hw, 0.004, "magm", step=8, smooth=2)
    if base:
        vert_loft(P, R, poly, bot - 12, bot - 1, hw + 0.0012, 0.004, "poly", step=4, smooth=1)
    if ribs:
        for sx in (-1, 1):
            for frac in (0.32, 0.68):
                pts = []
                for k in range(12):
                    py = top + 12 + (bot - 26 - top) * k / 11
                    sp = span(poly, 1, py)
                    if sp:
                        pts.append(Vector((sx * (hw + 0.0002), R.Y(py), R.Z(sp[0] + (sp[1] - sp[0]) * frac))))
                if len(pts) > 3:
                    sweep(P, catmull(pts, 16), lambda s_: 0.0011, "magm", sides=6, uv=False)
    P.finish(bevel=0.0003)


def irons(prefix, R, s, rear="aperture", front="post"):
    """The iron sights as their own nodes (hidden under glass), on the traced
    ironParts boxes: rear an aperture (or a notch), front a post in ears."""
    sy = R.Y(s["iron"][0])
    parts = s["ironParts"]
    rx = s["iron"][1]
    rp = min(parts, key=lambda p: abs((p[0] + p[2]) / 2 - rx))
    fp = max(parts, key=lambda p: abs((p[0] + p[2]) / 2 - rx))
    rz, fz = R.Z((rp[0] + rp[2]) / 2), R.Z((fp[0] + fp[2]) / 2)
    rb, fb = R.Y(rp[3]), R.Y(fp[3])
    ir = Part(prefix + "_IronRear")
    box(ir, (0, rb + 0.003, rz), (0.022, 0.006, 0.020), "recv")
    if rear == "aperture":
        box(ir, (0, (rb + 0.006 + sy) / 2, rz), (0.016, max(0.002, sy - rb - 0.006), 0.004), "recv")
        ring = [Vector((0.0040 * math.cos(TAU * i / 24), sy + 0.0040 * math.sin(TAU * i / 24), rz)) for i in range(25)]
        sweep(ir, ring, lambda s_: 0.0015, "recv", sides=8, uv=False)
        for sx in (-1, 1):
            box(ir, (sx * 0.0085, sy - 0.002, rz), (0.004, 0.020, 0.006), "recv")
    else:
        for sx in (-1, 1):
            box(ir, (sx * 0.0055, (rb + sy) / 2, rz), (0.0045, sy - rb, 0.006), "recv")
        box(ir, (0, (rb + sy) / 2 - 0.002, rz), (0.016, sy - rb - 0.004, 0.006), "recv")
    ir.finish(bevel=0.0002)
    fs = Part(prefix + "_IronFront")
    box(fs, (0, fb + 0.003, fz), (0.020, 0.006, 0.014), "recv")
    for sx in (-1, 1):
        box(fs, (sx * 0.0062, (fb + sy) / 2 + 0.002, fz), (0.0022, max(0.002, sy - fb - 0.002), 0.010), "recv")
    box(fs, (0, (fb + sy) / 2, fz), (0.0026, max(0.002, sy - fb), 0.0030), "steel")
    local_lathe(fs, (0, sy - 0.0016, fz + 0.0016 * (1 if s["dir"] < 0 else -1)), (0, 0, 1 if s["dir"] < 0 else -1),
                [(0, 0.0010), (0.0004, 0.0010), (0.0005, 0.0)], "dot", segs=10)
    fs.finish(bevel=0.0002)


def anchors(prefix, R, s):
    """The empties buildDetailed reads, from the traced spec (the same hand,
    grip, muzzle, aim and rail points the traced gun was tested with)."""
    m0, m1 = s["muzzle"][:2]
    front = min(m0, m1) if s["dir"] > 0 else max(m0, m1)
    empty(prefix + "_Grip", tuple(R.P(*s["gripAt"])))
    empty(prefix + "_Support", tuple(R.P(s["hand"][0], s["hand"][1])))
    empty(prefix + "_Muzzle", tuple(R.P(front, s["boreY"])))
    empty(prefix + "_Aim", tuple(R.P(s["iron"][1], s["iron"][0])))
    empty(prefix + "_Under", tuple(R.P(s["hand"][0], s["hand"][2])))
    empty(prefix + "_Rail", tuple(R.P(s["opticX"], s["railTop"])))
    return R.Y(s["railTop"])


def pins(P, R, pts, hw):
    for px, py in pts:
        for sx in (-1, 1):
            local_lathe(P, (sx * (hw - 0.0005), R.Y(py), R.Z(px)), (sx, 0, 0), [(0, 0.0030), (0.0010, 0.0027), (0.0014, 0.0)], "steel", segs=10)


def finish_and_export(prefix, body, out_glb, render_views=None):
    body.finish(bevel=0.0004, bevel_segs=1)
    gk.export(out_glb, prefix)
    if render_views:
        gk.render_views(os.environ.get(prefix + "_RENDER_DIR", os.path.join(HERE, "_renders")), render_views, prefix)
