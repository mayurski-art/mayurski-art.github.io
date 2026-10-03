"""
Shared kit for the U Mad Bro? hero bodies (build_hero_*.blender.py).

The game's players are a stick rig (character.js buildHumanoid): ink limbs
through a handful of joints and a flat trollface board for a head. A hero
body is a set of rigid pieces, each named "<joint>__<piece>"; hero-bodies.js
parents every piece to that joint of the rig (keeping the rest-pose world
transform), so every existing pose, dance, emote and death drives it.

Authored in GAME coords, in the rig's REST pose (REST below, dumped from a
fresh buildHumanoid): metres, feet on y=0, forward -Z, the hero's right at
+X. B() converts to Blender (game -Z forward = Blender +Y).

Timelapse frames / videos: the user asked for them, then dropped them
(2026-10-03: "i dont want any timelapse videos"). The Timelapse class stays
only as the camera + render setup for check() review renders; builders
leave it disabled unless asked.
"""
import bpy
import bmesh
import math
import os
import shutil
import subprocess
from mathutils import Matrix, Vector

TAU = math.tau
RX = Matrix.Rotation(math.radians(90), 4, "X")
HERE = os.path.dirname(os.path.abspath(__file__))
TROLLFACE_PNG = os.path.normpath(os.path.join(HERE, "..", "..", "..", "images", "wallpaper", "trollface transparent.png"))

# Rest-pose joint world positions (game coords), character.js buildHumanoid
# with height 1.8. Legs splay 0.09 rad about Z at the hip (thighL/R).
REST = {
    "hips": (0, 0.9, 0), "spine": (0, 1.14, 0), "chest": (0, 1.38, 0),
    "headPivot": (0, 1.47, 0), "head": (0, 1.725, 0),
    "armL": (0, 1.38, 0), "armR": (0, 1.38, 0),
    "elbowL": (-0.144, 1.0824, 0), "elbowR": (0.144, 1.0824, 0),
    "wristL": (-0.3, 0.76, 0), "wristR": (0.3, 0.76, 0),
    "thighL": (0, 0.9, 0), "thighR": (0, 0.9, 0),
    "kneeL": (-0.0404, 0.4518, 0), "kneeR": (0.0404, 0.4518, 0),
    "ankleL": (-0.078, 0.0355, 0), "ankleR": (0.078, 0.0355, 0),
}


def B(p):
    """game coords -> Blender coords"""
    return (RX @ Vector(p).to_4d()).to_3d()


def V(*a):
    return Vector(a[0] if len(a) == 1 else a)


def hexlin(h):
    out = []
    for s in (16, 8, 0):
        v = ((h >> s) & 255) / 255
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# ------------------------------------------------------------------ scene
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def material(name, color, rough=0.5, metal=0.0, coat=0.0, sheen=0.0, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*hexlin(color), 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if coat:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.25
    if sheen:
        b.inputs["Sheen Weight"].default_value = sheen
    if image and os.path.exists(image):
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(image, check_existing=True)
        nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
        nt.links.new(tex.outputs["Alpha"], b.inputs["Alpha"])
        m.blend_method = "CLIP" if hasattr(m, "blend_method") else None
    return m


def clay():
    """Grey sculpting clay: what every piece wears until the paint stage."""
    m = bpy.data.materials.get("Clay") or material("Clay", 0xb9b4ac, 0.7)
    return m


# ------------------------------------------------------------------ geometry
def mesh_obj(name, verts, faces, mat=None, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(B(v)) for v in verts], [], faces)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob.data.materials.append(mat or clay())
    ob["paint"] = ""
    return ob


def _frame(d):
    """Two unit vectors across axis d: e1 ~ world X (lateral), e2 ~ front/back."""
    ref = Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 0, 1))
    e1 = (ref - d * ref.dot(d)).normalized()
    e2 = d.cross(e1).normalized()
    return e1, e2


SEG_SCALE = 1.0   # hero builders raise this for rounder pieces (v6 "sharp" pass)


def loft(name, a, b, rings, segs=12, shape=None, cap_a=True, cap_b=True, mat=None, twist=0.0):
    """A tube from a to b (game coords). rings: [(t, rx, rz)] or
    [(t, rx, rz, ox, oz)] with t 0..1 along a->b, rx across (lateral), rz
    front/back, ox/oz an offset of the ring centre. shape(theta, t) -> radius
    multiplier (theta 0 = +lateral, pi/2 = e2 side). Returns the object."""
    a, b = V(a), V(b)
    segs = max(4, int(round(segs * SEG_SCALE)))
    d = (b - a).normalized()
    e1, e2 = _frame(d)
    verts, faces = [], []
    for ring in rings:
        t, rx, rz = ring[:3]
        ox, oz = (ring[3], ring[4]) if len(ring) > 3 else (0, 0)
        c = a.lerp(b, t) + e1 * ox + e2 * oz
        for i in range(segs):
            th = TAU * i / segs + twist
            k = shape(th, t) if shape else 1.0
            verts.append(c + e1 * (math.cos(th) * rx * k) + e2 * (math.sin(th) * rz * k))
    n = len(rings)
    for r in range(n - 1):
        for i in range(segs):
            j = (i + 1) % segs
            faces.append((r * segs + i, r * segs + j, (r + 1) * segs + j, (r + 1) * segs + i))
    if cap_a:
        verts.append(a.lerp(b, rings[0][0]))
        ci = len(verts) - 1
        for i in range(segs):
            faces.append((ci, (i + 1) % segs, i))
    if cap_b:
        verts.append(a.lerp(b, rings[-1][0]))
        ci = len(verts) - 1
        base = (n - 1) * segs
        for i in range(segs):
            faces.append((ci, base + i, base + (i + 1) % segs))
    return mesh_obj(name, verts, faces, mat)


def sheet(name, rows, mat=None, thick=0.012):
    """A cloth-like sheet from a grid of game-coord points rows[r][c],
    given a little thickness. Used for the cape."""
    R, Cn = len(rows), len(rows[0])
    verts = [V(p) for row in rows for p in row]
    faces = [(r * Cn + c, r * Cn + c + 1, (r + 1) * Cn + c + 1, (r + 1) * Cn + c)
             for r in range(R - 1) for c in range(Cn - 1)]
    ob = mesh_obj(name, verts, faces, mat)
    mod = ob.modifiers.new("thick", "SOLIDIFY")
    mod.thickness = thick
    mod.offset = 0
    apply_mods(ob)
    return ob


def ico(name, center, r, mat=None, sub=1, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    verts = [V(center) + V(v.co.x * r * scale[0], v.co.y * r * scale[1], v.co.z * r * scale[2]) for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    return mesh_obj(name, verts, faces, mat)


def box(name, center, size, mat=None, bevel=0.0):
    """Axis box in game coords (size = full extents)."""
    cx, cy, cz = center
    sx, sy, sz = (s / 2 for s in size)
    vs = [(cx + x * sx, cy + y * sy, cz + z * sz) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    fs = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    ob = mesh_obj(name, vs, fs, mat, smooth=False)
    if bevel:
        m = ob.modifiers.new("bev", "BEVEL")
        m.width = bevel
        m.segments = 2
        apply_mods(ob)
        for p in ob.data.polygons:
            p.use_smooth = True
    return ob


def disc(name, center, normal, r, depth, segs=20, mat=None, face_mat=None):
    """A coin: radius r, `depth` thick, facing `normal` (game coords). The
    front face gets face_mat with a planar UV (for the trollface decal)."""
    n = V(normal).normalized()
    e1, e2 = _frame(n)
    c = V(center)
    front, back = c + n * (depth / 2), c - n * (depth / 2)
    verts = []
    for base in (front, back):
        for i in range(segs):
            th = TAU * i / segs
            verts.append(base + e1 * math.cos(th) * r + e2 * math.sin(th) * r)
    verts += [front, back]
    F, Bk = 2 * segs, 2 * segs + 1
    faces = [(F, i, (i + 1) % segs) for i in range(segs)]
    faces += [(Bk, segs + (i + 1) % segs, segs + i) for i in range(segs)]
    faces += [(i, segs + i, segs + (i + 1) % segs, (i + 1) % segs) for i in range(segs)]
    ob = mesh_obj(name, verts, faces, mat)
    if face_mat:
        ob.data.materials.append(face_mat)
        uv = ob.data.uv_layers.new(name="UVMap")
        for poly in ob.data.polygons[:segs]:
            poly.material_index = 1
        for poly in ob.data.polygons:
            for li in poly.loop_indices:
                vi = ob.data.loops[li].vertex_index
                if vi < segs:
                    th = TAU * vi / segs
                    uv.data[li].uv = (0.5 + 0.5 * math.cos(th), 0.5 + 0.5 * math.sin(th))
                else:
                    uv.data[li].uv = (0.5, 0.5)
    return ob


def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def subdivide(ob, levels=1):
    m = ob.modifiers.new("sub", "SUBSURF")
    m.levels = levels
    m.render_levels = levels
    apply_mods(ob)


def mirror_x(ob, name):
    """A copy mirrored across the body's centre plane (game X)."""
    me = ob.data.copy()
    # game X == Blender X, so flip X and fix the winding.
    for v in me.vertices:
        v.co.x = -v.co.x
    me.flip_normals()
    cp = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(cp)
    cp["paint"] = ob.get("paint", "")
    return cp


def paint(ob, key):
    """Remember which material this piece gets at the paint stage."""
    ob["paint"] = key
    return ob


def apply_paint(mats):
    for ob in bpy.context.scene.objects:
        key = ob.get("paint")
        if ob.type != "MESH" or not key or key not in mats:
            continue
        if len(ob.data.materials) and ob.data.materials[0].name == "Clay":
            ob.data.materials[0] = mats[key]


# ------------------------------------------------------------------ the reference rig (renders only)
def stick_rig(face=True):
    """The game's stick figure and trollface board, for the renders. Named
    REF_* and never exported."""
    ink = bpy.data.materials.get("REF_Ink") or material("REF_Ink", 0x050505, 0.9)
    J = REST
    chains = [
        [(0, 1.5, 0), J["chest"], J["spine"], J["hips"], J["kneeL"], J["ankleL"]],
        [J["hips"], J["kneeR"], J["ankleR"]],
        [J["chest"], J["elbowL"], J["wristL"]],
        [J["chest"], J["elbowR"], J["wristR"]],
    ]
    for ci, ch in enumerate(chains):
        for i in range(len(ch) - 1):
            ob = loft(f"REF_bone{ci}_{i}", ch[i], ch[i + 1], [(0, 0.032, 0.032), (1, 0.032, 0.032)], segs=8, mat=ink)
            ob["paint"] = ""
    if face:
        tf = bpy.data.materials.get("REF_Face") or material("REF_Face", 0xffffff, 0.6, image=TROLLFACE_PNG)
        w, h = 0.48, 0.45
        c = V(J["head"])
        vs = [c + V(-w / 2, -h / 2, -0.001), c + V(w / 2, -h / 2, -0.001), c + V(w / 2, h / 2, -0.001), c + V(-w / 2, h / 2, -0.001)]
        ob = mesh_obj("REF_face", vs, [(0, 1, 2, 3)], tf, smooth=False)
        uv = ob.data.uv_layers.new(name="UVMap")
        # Board faces -Z (the game's forward); the image reads from the front.
        for li, (u, v) in zip(range(4), [(1, 0), (0, 0), (0, 1), (1, 1)]):
            uv.data[li].uv = (u, v)


# ------------------------------------------------------------------ renders
def render_setup(w=720, h=900, samples=24):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.exposure = -0.4
    world = bpy.data.worlds.new("W")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (*hexlin(0x22262b), 1)
    bg.inputs["Strength"].default_value = 0.6
    for name, pos, power, size in (("Key", (2.6, -3.0, 3.2), 520, 2.4), ("Rim", (-2.8, 2.6, 2.6), 380, 2.0), ("Fill", (-2.4, -3.2, 1.2), 110, 3.0)):
        L = bpy.data.lights.new(name, "AREA")
        L.energy, L.size = power, size
        ob = bpy.data.objects.new(name, L)
        sc.collection.objects.link(ob)
        ob.location = pos
        ob.rotation_euler = (Vector((0, 0, 1.0)) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
    # Floor disc.
    fl = bpy.data.materials.get("REF_Floor") or material("REF_Floor", 0x2c3036, 0.9)
    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=1.6, fill_type="NGON", location=(0, 0, 0))
    bpy.context.active_object.name = "REF_floor"
    bpy.context.active_object.data.materials.append(fl)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    sc.collection.objects.link(cam)
    cam.data.lens = 58
    sc.camera = cam
    # Stamp: the caption is the only text burned in.
    r = sc.render
    r.use_stamp = True
    for attr in dir(r):
        if attr.startswith("use_stamp_") and attr not in ("use_stamp_note",):
            try:
                setattr(r, attr, False)
            except (AttributeError, TypeError):
                pass
    r.use_stamp_note = True
    r.stamp_font_size = 26
    r.stamp_foreground = (1, 1, 1, 1)
    r.stamp_background = (0, 0, 0, 0.55)
    # Comic ink lines, like the art (and the outline the game draws).
    r.use_freestyle = True
    r.line_thickness_mode = "ABSOLUTE"
    r.line_thickness = 1.6
    fs = bpy.context.view_layer.freestyle_settings
    lset = fs.linesets[0] if len(fs.linesets) else fs.linesets.new("Ink")
    if lset.linestyle is None:
        lset.linestyle = bpy.data.linestyles.new("Ink")
    lset.linestyle.color = (0.02, 0.02, 0.02)
    lset.linestyle.thickness = 1.6
    # Outlines only: silhouettes and borders, never the mesh's own creases
    # (on the head grid those drew every quad: scratchy, not ink).
    lset.select_by_edge_types = True
    for t in ("select_crease", "select_ridge_valley", "select_suggestive_contour", "select_material_boundary", "select_edge_mark", "select_contour"):
        if hasattr(lset, t):
            setattr(lset, t, False)
    for t in ("select_silhouette", "select_border", "select_external_contour"):
        if hasattr(lset, t):
            setattr(lset, t, True)
    return cam


def aim(cam, yaw_deg, dist=4.2, height=1.25, target=(0, 0, 0.98)):
    """Orbit: yaw 0 = straight at the hero's front (game -Z = Blender +Y)."""
    a = math.radians(yaw_deg)
    t = Vector(target)
    cam.location = t + Vector((math.sin(a) * dist, math.cos(a) * dist, height - t.z))
    cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()


class Timelapse:
    def __init__(self, hero, enabled=True, samples=24, yaw=-32):
        self.hero = hero
        self.enabled = enabled
        self.dir = os.path.join(HERE, "_timelapse", hero)
        os.makedirs(self.dir, exist_ok=True)
        self.cam = render_setup(samples=samples) if enabled else None
        self.yaw = yaw
        self.run = 1 + len([f for f in os.listdir(self.dir) if f.startswith("run-")])
        if enabled:
            open(os.path.join(self.dir, f"run-{self.run:03d}.txt"), "w").close()

    def _next(self):
        nums = [int(f[:4]) for f in os.listdir(self.dir) if f[:4].isdigit() and f.endswith(".png")]
        return (max(nums) + 1) if nums else 0

    def snap(self, caption):
        # "finish" runs rebuild silently, then only render the turntable.
        if not self.enabled or getattr(self, "quiet", False):
            return
        sc = bpy.context.scene
        aim(self.cam, self.yaw)
        sc.render.stamp_note_text = f"  {self.hero.upper()} build · run {self.run} · {caption}  "
        path = os.path.join(self.dir, f"{self._next():04d}.png")
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print("SNAP", path, caption)

    def check(self, views=(0, 90, 180, -45)):
        """Review renders (not part of the timelapse): front, side, back."""
        sc = bpy.context.scene
        out = os.path.join(HERE, "_renders", self.hero)
        os.makedirs(out, exist_ok=True)
        sc.render.stamp_note_text = f"  {self.hero} check  "
        for yaw in views:
            aim(self.cam, yaw)
            sc.render.filepath = os.path.join(out, f"view{yaw:+04d}.png")
            bpy.ops.render.render(write_still=True)
        print("CHECK", out)

    def turntable(self, frames=36):
        sc = bpy.context.scene
        out = os.path.join(self.dir, "turn")
        shutil.rmtree(out, ignore_errors=True)
        os.makedirs(out)
        sc.render.stamp_note_text = f"  {self.hero.upper()} · finished  "
        for i in range(frames):
            aim(self.cam, -180 + 360 * i / frames)
            sc.render.filepath = os.path.join(out, f"{i:04d}.png")
            bpy.ops.render.render(write_still=True)
        print("TURNTABLE", out)


def stitch(hero, fps=5, turn_fps=24, hold=2.0):
    """Frames + turntable -> <hero>-build-timelapse.mp4 (ffmpeg on PATH)."""
    d = os.path.join(HERE, "_timelapse", hero)
    ff = shutil.which("ffmpeg")
    if not ff:
        print("no ffmpeg")
        return None
    frames = sorted(f for f in os.listdir(d) if f[:4].isdigit() and f.endswith(".png"))
    lst = os.path.join(d, "frames.txt")
    with open(lst, "w") as fh:
        for f in frames:
            fh.write(f"file '{f}'\nduration {1 / fps:.3f}\n")
        fh.write(f"file '{frames[-1]}'\nduration {hold:.3f}\nfile '{frames[-1]}'\n")
    a = os.path.join(d, "_a.mp4")
    b = os.path.join(d, "_b.mp4")
    out = os.path.join(d, f"{hero}-build-timelapse.mp4")
    vf = "scale=720:900,format=yuv420p"
    subprocess.run([ff, "-y", "-f", "concat", "-safe", "0", "-i", lst, "-vf", vf, "-r", "30", "-c:v", "libx264", "-crf", "20", a], check=True)
    parts = [a]
    if os.path.isdir(os.path.join(d, "turn")):
        subprocess.run([ff, "-y", "-framerate", str(turn_fps), "-i", os.path.join(d, "turn", "%04d.png"), "-vf", vf, "-r", "30", "-c:v", "libx264", "-crf", "20", b], check=True)
        parts.append(b)
    cl = os.path.join(d, "parts.txt")
    with open(cl, "w") as fh:
        for p in parts:
            fh.write(f"file '{os.path.basename(p)}'\n")
    subprocess.run([ff, "-y", "-f", "concat", "-safe", "0", "-i", cl, "-c", "copy", out], check=True)
    print("VIDEO", out)
    return out


# ------------------------------------------------------------------ export
def export(path):
    """Every non-REF mesh, no images (the game supplies the trollface)."""
    for ob in bpy.context.scene.objects:
        ob.select_set(ob.type == "MESH" and not ob.name.startswith("REF_"))
    tris = 0
    for ob in bpy.context.selected_objects:
        tris += sum(len(p.vertices) - 2 for p in ob.data.polygons)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True,
        export_yup=True, export_skins=False, export_animations=False,
        export_image_format="NONE", export_materials="EXPORT",
    )
    print("EXPORT", path, "tris", tris, "bytes", os.path.getsize(path))
    return tris


# ------------------------------------------------------------------ the 3D trollface head
def trollface_head(name="headPivot__head", center=None, w=0.48, h=0.45, depth_front=0.09,
                   depth_back=0.22, jaw=0.0, crown=0.0, lift=0.0, segs=96, lat=12, smooth=1,
                   p_front=2.4, p_back=2.4, jut=0.25, skull=0.25, rim_band=0.42):
    """The real trollface art made into a round head (user, 2026-10-03:
    "redesign the head", one per hero). The art's outline, seen from the
    front, is measured as a radius per angle from its centre (smoothed, so
    no stair steps), on the game's head-board size (0.48 x 0.45 at the head
    joint). The head is that outline swept front-to-back like a sphere:
    a shallow dome in front (the drawing projected straight on, so it reads
    as the meme), a deeper one behind (the skull).
    Front faces use material "trollface" (the game swaps in the rig's own
    face material, so expressions and tints keep working); the back is
    "HeadBack", plain white.

    Each hero gets its own head on this base (user: "the heads shouldnt all
    look the same"): w/h size it, `jaw` widens the lower half (the Knight's
    heavy chin), `crown` the top, `lift` raises it; headgear and the rest
    are the hero builder's own pieces."""
    c = V(center or REST["head"]) + V(0, lift, 0)
    img = bpy.data.images.load(TROLLFACE_PNG, check_existing=True)
    W, H = img.size
    px = img.pixels[:]

    def alpha(u, v):
        if u < 0 or u > 1 or v < 0 or v > 1:
            return 0.0
        return px[(int(v * (H - 1)) * W + int(u * (W - 1))) * 4 + 3]

    # Centre of the art (alpha-weighted), in uv.
    su = sv = n = 0
    for j in range(0, H, 8):
        for i in range(0, W, 8):
            if px[(j * W + i) * 4 + 3] > 0.5:
                su += i / (W - 1); sv += j / (H - 1); n += 1
    cu, cv = su / n, sv / n
    # Radius (uv units) to the outline at each angle, marched outward. v7
    # (user: "the shape of the head needs to blend well with the shape of
    # the trollface"): the art's own silhouette, finely sampled and barely
    # smoothed, so the drawing's black outline lands on the head's edge.
    radii = []
    for k in range(segs):
        th = TAU * k / segs
        du, dv = math.cos(th), math.sin(th)
        r, last = 0.0, 0.0
        while r < 0.9:
            if alpha(cu + du * r, cv + dv * r) > 0.5:
                last = r
            r += 0.002
        radii.append(last)
    for _ in range(smooth):
        radii = [(radii[k - 1] + 2 * radii[k] + radii[(k + 1) % segs]) / 4 for k in range(segs)]
    # A heavily smoothed copy for the skull: the exact outline (spiky tufts
    # and all) only at the rim, easing into a clean round shape inward, so
    # the back never pinches into a star.
    soft = list(radii)
    for _ in range(40):
        soft = [(soft[k - 1] + 2 * soft[k] + soft[(k + 1) % segs]) / 4 for k in range(segs)]

    def outline(k, scale=1.0):
        th = TAU * k / segs
        blend = min(1.0, (1.0 - scale) * 4.0)          # 0 at the rim
        rad = radii[k] * (1 - blend) + soft[k] * blend
        u = cu + math.cos(th) * rad * scale
        v = cv + math.sin(th) * rad * scale
        x = (0.5 - u) * w          # viewer's left (+u) is the hero's right (+X)
        y = (v - 0.5) * h
        y0 = (v - cv) * 2           # -1 bottom .. 1 top, roughly
        x *= 1 + jaw * max(0.0, -y0) + crown * max(0.0, y0)
        return x, y, u, v

    def depth_at(k, side):
        # The meme's shape in depth: the grinning jaw juts forward under the
        # face, the cranium bulges up and back behind it.
        s = math.sin(TAU * k / segs)
        if side < 0:
            return depth_front * (1 + jut * max(0.0, -s))
        return depth_back * (1 + skull * max(0.0, s))

    verts, uvs, faces, mats = [], [], [], []
    # Latitude rings from the front pole (-Z) through the rim to the back
    # pole, on superellipse profiles: a flatter front (the drawing reads
    # flat on) that rolls tightly into the rim, a rounder skull behind.
    rings = []
    for side, p in ((-1, p_front), (1, p_back)):
        for li in range(lat, 0, -1) if side < 0 else range(1, lat + 1):
            phi = (math.pi / 2) * li / lat           # 0 at the rim, pi/2 at the pole
            rings.append((side, math.cos(phi) ** (2 / p), math.sin(phi) ** (2 / p)))
        if side < 0:
            rings.append((0, 1.0, 0.0))              # the rim itself
    for (side, k_scale, zf) in rings:
        ring = []
        for k in range(segs):
            x, y, u, v = outline(k, k_scale)
            z = side * depth_at(k, side) * zf
            ring.append(len(verts))
            verts.append(c + V(x, y, z))
            uvs.append((u, v) if side <= 0 else (0.5, 0.5))
        if len(verts) > segs:
            prev = list(range(len(verts) - 2 * segs, len(verts) - segs))
            for k in range(segs):
                a, b2 = prev[k], prev[(k + 1) % segs]
                c2, d = ring[(k + 1) % segs], ring[k]
                faces.append((a, b2, c2, d))
                # The drawing stays on the forward-facing part; the steep band
                # round the rim is plain skin, so from the side the face does
                # not wrap round as a black band (the game ink-outlines the
                # silhouette anyway).
                mats.append(0 if side < 0 and zf >= rim_band else 1)
    # Poles.
    front_pole = len(verts); verts.append(c + V((0.5 - cu) * w, (cv - 0.5) * h, -depth_front)); uvs.append((cu, cv))
    back_pole = len(verts); verts.append(c + V((0.5 - cu) * w, (cv - 0.5) * h, depth_back * (1 + skull * 0.5))); uvs.append((0.5, 0.5))
    for k in range(segs):
        faces.append((front_pole, (k + 1) % segs, k)); mats.append(0)
        base = len(verts) - 2 - segs
        faces.append((back_pole, base + k, base + (k + 1) % segs)); mats.append(1)
    ob = mesh_obj(name, verts, faces, None)
    me = ob.data
    me.materials.clear()
    front = bpy.data.materials.get("trollface") or material("trollface", 0xffffff, 0.5, image=TROLLFACE_PNG)
    back = bpy.data.materials.get("HeadBack") or material("HeadBack", 0xf4f2ec, 0.55)
    me.materials.append(front)
    me.materials.append(back)
    uv = me.uv_layers.new(name="UVMap")
    for poly, m in zip(me.polygons, mats):
        poly.material_index = m
        for li in poly.loop_indices:
            uv.data[li].uv = uvs[me.loops[li].vertex_index]
    # Make every face point outward.
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()
    ob["paint"] = ""
    print("HEAD", name, "verts", len(verts), "tris", sum(len(p.vertices) - 2 for p in me.polygons))
    return ob


# ------------------------------------------------------------------ crisp pass (v6)
def crisp(ob, bevel=0.0035, angle=32, segments=2):
    """The Green Candles finish (user, 2026-10-03: "sharp just like the green
    candles gun"): edges sharper than `angle` get a small bevel with
    hardened normals, a weighted-normal pass keeps flat faces flat, and
    those edges are marked sharp so the glTF normals split there. Smooth
    curves (pecs, domes) stay smooth; plate rims catch a clean highlight."""
    bpy.context.view_layer.objects.active = ob
    me = ob.data
    for p in me.polygons:
        p.use_smooth = True
    if bevel > 0:
        bv = ob.modifiers.new("crisp_bevel", "BEVEL")
        bv.width = bevel
        bv.segments = segments
        bv.limit_method = "ANGLE"
        bv.angle_limit = math.radians(angle)
        bv.harden_normals = True
    wn = ob.modifiers.new("crisp_wn", "WEIGHTED_NORMAL")
    wn.keep_sharp = True
    apply_mods(ob)
    try:
        me.set_sharpness_by_angle(angle=math.radians(angle + 8))
    except AttributeError:
        pass
    return ob


def crisp_all(keys=("iron", "ironDark", "gold", "leather"), **kw):
    """crisp() every exported piece painted with one of `keys`."""
    n = 0
    for ob in list(bpy.context.scene.objects):
        if ob.type == "MESH" and not ob.name.startswith("REF_") and ob.get("paint") in keys:
            crisp(ob, **kw)
            n += 1
    print("CRISP", n)


def trim(name, a, b, rx, rz, width=0.012, lip=0.008, segs=24, shape=None):
    """A rolled rim round the end of a plate (a thin ring), the detail that
    makes armour read as forged plates rather than tubes."""
    a, b = V(a), V(b)
    d = (b - a).normalized()
    return loft(name, a - d * width / 2, a + d * width / 2,
                [(0, rx + lip, rz + lip), (0.5, rx + lip * 1.4, rz + lip * 1.4), (1, rx + lip, rz + lip)],
                segs=segs, shape=shape, cap_a=False, cap_b=False)
