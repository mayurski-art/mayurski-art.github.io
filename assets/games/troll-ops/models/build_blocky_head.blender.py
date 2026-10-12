"""
The trollface with depth, for the blocky body (blocky-body.js, preview
mockup). User, 2026-10-11: "There should be a little bit of 3d dept to the
trollface", then "improve the 3d rendering of the trollface head".

    blender --background --python build_blocky_head.blender.py            # -> models/blocky/head-relief.glb
    blender --background --python build_blocky_head.blender.py -- check   # + review renders, models/_renders/blocky-head

v1 was the hero kit's trollface_head as an even shallow dome: the art's
outline swept front to back. v2 sculpts the meme's own features out of
that dome, placed on the drawing (fractions of the art, from its top left):
the grin's mass jutting forward, the cheeks puffed up beside it, the nose,
a brow ridge over squinting, slightly sunk eyes, the chin; and the drawing's
dark parts carved in a little (its lines, and deeper where the mouth is
black between the teeth), so the light finds the drawing too. Finer mesh
so the forms read.

Centred on the face board (head joint), 0.48 x 0.45 like the board, the
face toward -Z. Materials: "trollface" (the game puts the board's live face
art on it, so expressions keep working) and "HeadBack" (the plain skull).
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_kit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.join(K.HERE, "blocky", "head-relief.glb")
W, H = 0.48, 0.45             # the face board
FRONT, BACK = 0.03, 0.075     # the dome in front of the board, the skull behind (m, scale 1)

# (centre x, y as fractions of the art from its top left, radii rx, ry,
# height in metres; negative sinks)
FEATURES = [
    (0.512, 0.62, 0.36, 0.17, 0.02),     # the grin's mass, jutting
    (0.19, 0.40, 0.11, 0.12, 0.014),     # cheek (viewer's left)
    (0.82, 0.42, 0.11, 0.12, 0.014),     # cheek (viewer's right)
    (0.49, 0.46, 0.06, 0.055, 0.012),    # nose
    (0.46, 0.27, 0.33, 0.07, 0.008),     # brow ridge
    (0.29, 0.33, 0.075, 0.06, -0.008),   # eye (viewer's left), sunk
    (0.60, 0.32, 0.08, 0.06, -0.008),    # eye (viewer's right), sunk
    (0.50, 0.82, 0.27, 0.07, 0.006),     # chin
]
CARVE = 0.0035                # how deep the drawing's dark parts are cut


def smooth(f):
    f = max(0.0, min(1.0, f))
    return f * f * (3 - 2 * f)


def darkness_map(img, n=220):
    """How dark the art is around each point (0..1), blurred: an n x m grid
    over the image, bottom-up like Blender's pixels."""
    w, h = img.size
    px = img.pixels[:]
    m = int(n * h / w)
    grid = [[0.0] * n for _ in range(m)]
    for j in range(m):
        for i in range(n):
            x, y = int((i + 0.5) / n * (w - 1)), int((j + 0.5) / m * (h - 1))
            k = (y * w + x) * 4
            a = px[k + 3]
            grid[j][i] = (1 - (px[k] + px[k + 1] + px[k + 2]) / 3) * (1 if a > 0.5 else 0)
    for _ in range(2):   # a little blur, so the cuts have soft walls
        g2 = [[0.0] * n for _ in range(m)]
        for j in range(m):
            for i in range(n):
                acc, c = 0.0, 0
                for dj in (-1, 0, 1):
                    for di in (-1, 0, 1):
                        jj, ii = j + dj, i + di
                        if 0 <= jj < m and 0 <= ii < n:
                            acc += grid[jj][ii]
                            c += 1
                g2[j][i] = acc / c
        grid = g2

    def at(u, v):    # u, v: the art's uv (v up)
        i = min(n - 1, max(0, int(u * n)))
        j = min(m - 1, max(0, int(v * m)))
        return grid[j][i]
    return at


def relief(u, v, dark):
    """How far the face stands out of the dome at the art's (u, v)."""
    fx, fy = u, 1 - v        # fractions from the top left
    out = 0.0
    for cx, cy, rx, ry, amp in FEATURES:
        d = math.hypot((fx - cx) / rx, (fy - cy) / ry)
        if d < 1:
            out += amp * (1 - smooth(d))
    return out - CARVE * dark(u, v)


def build():
    ob = K.trollface_head(name="head__relief", center=(0, 0, 0), w=W, h=H, depth_front=FRONT,
                          depth_back=BACK, jut=0.0, skull=0.0, segs=160, lat=34,
                          # the outline's tufts came out as spikes at this many
                          # segments, so it's smoothed; that takes the jaw out
                          # past the drawing in places, where the art is
                          # transparent (gaps along the chin; user: "on its
                          # bottom left side of the chin theres some redering
                          # errors"). There the texture is clamped onto the
                          # drawing's own black edge (uv_clamp, in the art's uv).
                          # (Hugging the raw outline brought back its rough dips
                          # as a sawtooth; pulling the whole drawing in left a
                          # pale strip inside the edge elsewhere.)
                          smooth=6, uv_clamp=0.006,
                          # trace the face's own outline only: stray strokes
                          # drawn just outside the jaw (past a gap) were cut
                          # by the edge into little black hooks
                          main_only=0.008,
                          # the drawing round onto the rim, so its own thick
                          # black outline makes the edge (not plain skull)
                          rim_band=0.18)
    img = bpy.data.images.load(K.TROLLFACE_PNG, check_existing=True)
    dark = darkness_map(img)
    me = ob.data
    # Blender coords: game x = x, game y = z, game z = -y; the front is game z < 0
    for vtx in me.vertices:
        gx, gy, gz = vtx.co.x, vtx.co.z, -vtx.co.y
        if gz >= -1e-6:
            continue
        u, v = 0.5 - gx / W, 0.5 + gy / H
        fade = smooth(-gz / FRONT)                  # 0 at the rim, easing in across the face (faster left a ridge)
        gz -= relief(u, v, dark) * fade
        vtx.co.y = -gz
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    return ob


def check(ob):
    ob.location = K.B((0, 1.3, 0))
    sc = bpy.context.scene
    cam = K.render_setup(samples=int(os.environ.get("TR_SAMPLES", 32)))
    out = os.path.join(K.HERE, "_renders", "blocky-head")
    os.makedirs(out, exist_ok=True)
    for yaw in (0, 35, 70, 180):
        K.aim(cam, yaw, dist=1.2, height=1.35, target=(0, 0, 1.3))
        sc.render.stamp_note_text = f"  trollface relief · {yaw}  "
        sc.render.filepath = os.path.join(out, f"head{yaw:+04d}.png")
        bpy.ops.render.render(write_still=True)
    print("CHECK", out)


if __name__ == "__main__":
    K.reset_scene()
    HD = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    K.export(OUT)
    if ARGS and ARGS[0] == "check":
        check(HD)
