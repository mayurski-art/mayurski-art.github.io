"""
Troll Forces — the police and the bouncers for Cops and Robbers
(COPS-AND-ROBBERS.md): real-looking MakeHuman people in uniform.

    blender --background --python build_cops.blender.py -- render [names]
    blender --background --python build_cops.blender.py -- export [names]

Bodies, skin, hair and the recoloured clothes come from the mannequin
builder (it runs build_mannequins.blender.py minus its main(), which in turn
borrows the zombie builder's plumbing). On top of them the uniform's kit is
modelled here, fitted to the figure by casting onto its surfaces: a peaked
cap, a badge, a duty belt with a holster and pouches, a shoulder radio, a
name plate, POLICE pressed onto the back of the shirt.

Unlike the mannequins these stay rigged, and unlike the zombies they carry
no clips: in the game the bot's own skeleton (character.js) drives the
bones every frame (cop-bodies.js). Export: every part, the kit included,
frozen at the rest pose, decimated to a budget, joined into ONE skinned
mesh baked onto ONE texture atlas (the head's islands given extra room),
plus the game_engine rig: cop-<name>.glb, feet on y = 0, facing +z.
"""
import bmesh
import bpy
import math
import os
import sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
_MQ = os.path.join(HERE, "build_mannequins.blender.py")
_src = open(_MQ, encoding="utf8").read()
Q = {"__file__": _MQ, "__name__": "build_mannequins"}
exec(compile(_src[: _src.rindex("\nmain()")], _MQ, "exec"), Q)
Z = Q["Z"]
bone, mesh_obj, cube, cyl, sphere = Q["bone"], Q["mesh_obj"], Q["cube"], Q["cyl"], Q["sphere"]
surf, surface_trees, extent, pin_uvs = Q["surf"], Q["surface_trees"], Q["extent"], Q["pin_uvs"]
flat, hexlin = Z["flat"], Z["hexlin"]

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER_DIR = os.environ.get("CB_RENDER_DIR", os.path.join(HERE, "_renders"))
BAKE_DIR = os.environ.get("CB_BAKE_DIR", os.path.join(os.environ.get("TEMP", "/tmp"), "cb_bake"))

# ---------------------------------------------------------------- poses
# As the other builders: (bone, (x, y, z)) aims a bone along a WORLD
# direction (+X the body's left, -Y forward, +Z up). Renders only: the game
# drives the bones itself.
ARMS_DOWN = Q["ARMS_DOWN"]
READY = [   # a pistol held low in both hands, the way a cop clears a room
    ("upperarm_l", (0.05, -0.45, -0.9)), ("lowerarm_l", (-0.55, -0.8, -0.2)),
    ("upperarm_r", (-0.12, -0.5, -0.86)), ("lowerarm_r", (0.4, -0.88, -0.25)),
    ("fingers", ("curl", 55)),
]
POSES = {"stand": ARMS_DOWN, "ready": READY}

# ---------------------------------------------------------------- the cast
# clothes: (asset, colour, keep) as the mannequins (keep = how much of the
# garment's own texture survives the recolour). kit: which pieces to model.
NAVY, NAVY_D, BLACK = 0x1f3157, 0x18243f, 0x101012
CAST = {
    "patrol": dict(
        macros=dict(gender=1.0, age=0.42, muscle=0.62, weight=0.5, height=0.6), skin="young_caucasian_male",
        clothes=[("namuhekam_male_polo_shirt", NAVY, 0.06), ("cortu_cargo_pants", NAVY_D, 0.05), ("shoes03", BLACK, 0.2)],
        hair=("short02", 0x2a1e14), brows="eyebrow003",
        kit=("cap", "badge", "nameplate", "radio", "belt", "back_text"),
        pose="ready",
    ),
    # Officer Grin, the rare one (about 1 in 25 patrols): a rubber trollface
    # mask from the real mascot art (assets/pfp/base/og.webp, as the rare
    # zombie's) under the uniform cap. Clean latex, not the zombie's grime.
    # Started from the user's reference, refs/cop-trollface-ref.png.
    "grin": dict(
        macros=dict(gender=1.0, age=0.4, muscle=0.6, weight=0.52, height=0.58), skin="young_caucasian_male",
        clothes=[("namuhekam_male_polo_shirt", NAVY, 0.06), ("cortu_cargo_pants", NAVY_D, 0.05), ("shoes03", BLACK, 0.2)],
        mask=True,
        kit=("cap", "badge", "nameplate", "radio", "belt", "back_text"),
        pose="ready",
    ),
}


def palette():
    P = {
        "black": flat("CB_Black", 0x121214, 0.55), "leather": flat("CB_Leather", 0x0c0c0d, 0.4),
        "gold": flat("CB_Gold", 0xc9a23a, 0.3), "silver": flat("CB_Silver", 0xb9bec4, 0.3),
        "white": flat("CB_White", 0xeeeeea, 0.6), "navy": flat("CB_Navy", 0x1a2234, 0.6),
        "grip": flat("CB_Grip", 0x1c1c1e, 0.7),
    }
    for m in P.values():
        m.use_fake_user = True
    return P


# ---------------------------------------------------------------- fitting
def ring(z, center, n=24, skip_arms=True):
    """The figure's outline at height z: n surface points round `center`,
    each cast in from outside along a horizontal ray."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        d = Vector((math.sin(a), -math.cos(a), 0.0))      # i = 0 points forward (-Y)
        p = Vector((center.x, center.y, z))
        pts.append(surf(p, d, lift=0.0, skip_arms=skip_arms))
    return pts


def band(b, lo, hi, out=0.01, top=None, close_top=False):
    """A closed strip between two rings (lists of points, same length),
    pushed `out` off the surface; `top` (a ring) adds a flared third level."""
    def push(ring_pts, z, k):
        c = sum(ring_pts, Vector()) / len(ring_pts)
        res = []
        for p in ring_pts:
            r = Vector((p.x - c.x, p.y - c.y, 0.0))
            res.append(Vector((c.x, c.y, z)) + r * k + r.normalized() * out)
        return res
    rows = [lo, hi] + ([top] if top else [])
    vs = [[b.verts.new(p) for p in r] for r in rows]
    n = len(lo)
    for r in range(len(vs) - 1):
        for i in range(n):
            j = (i + 1) % n
            b.faces.new((vs[r][i], vs[r][j], vs[r + 1][j], vs[r + 1][i]))
    if close_top:
        b.faces.new(list(reversed(vs[-1])))
    return vs


def offset_ring(pts, z, out, scale=1.0):
    c = sum(pts, Vector()) / len(pts)
    res = []
    for p in pts:
        r = Vector((p.x - c.x, p.y - c.y, 0.0))
        res.append(Vector((c.x, c.y, z)) + r * scale + r.normalized() * out)
    return res


def body_top(rig, bm):
    lo, hi = extent(rig, bm.name, exact=True)
    return hi.z


# ---------------------------------------------------------------- the kit
def k_cap(rig, bm, P):
    """A police peaked cap: a black band round the head just above the ears,
    a navy crown flaring out to a flat top, a gloss visor, a gold badge."""
    top = body_top(rig, bm)
    hc = bone(rig, "head")
    zb = top - 0.085                                    # the band's bottom edge
    lift = 0.0
    eyes = P.get("_eyes")
    if eyes:                                            # a mask: the cap sits back off its eyes
        lift = max(0.0, (eyes[0].z + eyes[1].z) / 2 + 0.042 - zb)
        zb += lift
    center = Vector((0.0, hc.y + 0.01, zb))
    head = ring(zb, center, 28, skip_arms=False)
    lo = offset_ring(head, zb, 0.012)
    hi = offset_ring(head, zb + 0.045, 0.012)
    crown = offset_ring(head, top + 0.012 + lift, 0.022, 1.07)
    out = []

    def build_band(b):
        band(b, lo, hi)
    out.append(mesh_obj("CBk_capband", build_band, P["black"]))

    def build_crown(b):
        vs = band(b, hi, crown)
        c = b.verts.new(sum(crown, Vector()) / len(crown) + Vector((0, 0, 0.004)))
        n = len(crown)
        for i in range(n):
            b.faces.new((vs[1][i], vs[1][(i + 1) % n], c))
        # a stiff piping edge at the top
    out.append(mesh_obj("CBk_capcrown", build_crown, P["navy"]))

    def build_visor(b):
        n = len(lo)
        idx = [i % n for i in range(-6, 7)]             # the front arc
        up, dn = [], []
        for k, i in enumerate(idx):
            p = lo[i]
            c = Vector((center.x, center.y, p.z))
            r = Vector((p.x - c.x, p.y - c.y, 0)).normalized()
            t = 1 - abs(k - 6) / 6                       # deepest at the front
            reach = 0.012 + (0.044 if eyes else 0.058) * math.sin(t * math.pi / 2)
            q = p + r * reach + Vector((0, 0, (-0.010 if eyes else -0.022) * t))
            up.append((b.verts.new(p + Vector((0, 0, 0.003))), b.verts.new(q + Vector((0, 0, 0.003)))))
            dn.append((b.verts.new(p - Vector((0, 0, 0.003))), b.verts.new(q - Vector((0, 0, 0.003)))))
        for k in range(len(idx) - 1):
            b.faces.new((up[k][0], up[k][1], up[k + 1][1], up[k + 1][0]))
            b.faces.new((dn[k + 1][0], dn[k + 1][1], dn[k][1], dn[k][0]))
            b.faces.new((up[k][1], dn[k][1], dn[k + 1][1], up[k + 1][1]))
    out.append(mesh_obj("CBk_capvisor", build_visor, P["leather"]))

    f = hi[0]                                           # the front of the band
    def build_badge(b):
        cyl(b, f + Vector((0, -0.004, 0.006)), f + Vector((0, -0.010, 0.006)), 0.017, 0.017, 6)
    out.append(mesh_obj("CBk_capbadge", build_badge, P["gold"]))
    return [(o, "head") for o in out]


def chest_z(rig):
    return bone(rig, "spine_03").z + 0.13


def k_badge(rig, bm, P):
    p = surf(Vector((0.095, 0.0, chest_z(rig))), (0, -1, 0), lift=0.002, skip_arms=True)
    def build(b):
        rot = Matrix.Rotation(math.pi / 2, 3, "X")
        cyl(b, p, p + Vector((0, -0.005, 0)), 0.03, 0.026, 6)
        sphere(b, p + Vector((0, -0.006, 0.002)), 0.012, 1, 0.3, 1, 10)
    return [(mesh_obj("CBk_badge", build, P["gold"]), "spine_03")]


def k_nameplate(rig, bm, P):
    p = surf(Vector((-0.095, 0.0, chest_z(rig) - 0.02)), (0, -1, 0), lift=0.002, skip_arms=True)
    return [(mesh_obj("CBk_name", lambda b: cube(b, p + Vector((0, -0.002, 0)), (0.07, 0.004, 0.016)), P["silver"]), "spine_03")]


def k_radio(rig, bm, P):
    """The shoulder mic clipped on the left, its coiled cord down the chest."""
    sh = bone(rig, "upperarm_l")
    p = surf(Vector((sh.x * 0.62, 0.0, sh.z - 0.02)), (0, -1, 0), lift=0.004, skip_arms=True)
    def build(b):
        cube(b, p + Vector((0, -0.012, 0)), (0.034, 0.024, 0.06))
        cyl(b, p + Vector((0.0, -0.012, 0.03)), p + Vector((0.0, -0.012, 0.05)), 0.004, 0.004, 6)
        q = surf(Vector((p.x - 0.03, 0, p.z - 0.2)), (0, -1, 0), lift=0.006, skip_arms=True)
        cyl(b, p + Vector((0, -0.01, -0.03)), q, 0.004, 0.004, 5)
    return [(mesh_obj("CBk_radio", build, P["black"]), "spine_03")]


def k_belt(rig, bm, P):
    """The duty belt round the waist, a silver buckle, the holster with its
    pistol grip on the right hip, magazine and cuff pouches, the radio."""
    # over the shirt's hem, so nothing of it hangs below the belt
    lo_shirt, _ = extent(rig, "polo")
    z = lo_shirt.z + 0.012
    center = Vector((0.0, bone(rig, "pelvis").y, z))
    waist = ring(z, center, 28)
    lo = offset_ring(waist, z - 0.026, 0.012)
    hi = offset_ring(waist, z + 0.026, 0.012)
    out = [mesh_obj("CBk_belt", lambda b: band(b, lo, hi), P["leather"])]
    n = len(waist)

    def at(deg):
        """The belt's outer surface at an angle (0 = front, 90 = the body's left)."""
        i = round(deg / 360 * n) % n
        c = Vector((center.x, center.y, z))
        p = (lo[i] + hi[i]) / 2
        r = Vector((p.x - c.x, p.y - c.y, 0)).normalized()
        return p, r

    def boxed(name, deg, size, dz=0.0, mat="leather", push=0.0):
        p, r = at(deg)
        yaw = math.atan2(r.x, -r.y)
        rot = Matrix.Rotation(-yaw, 3, "Z")
        c = p + r * (size[1] / 2 + push) + Vector((0, 0, dz))
        return mesh_obj(name, lambda b: cube(b, c, size, rot), P[mat])

    p, r = at(0)
    out.append(mesh_obj("CBk_buckle", lambda b: cube(b, p + r * 0.004, (0.055, 0.008, 0.042)), P["silver"]))
    # the holster on the right hip (-X is the body's right), the grip out of it
    out.append(boxed("CBk_holster", -96, (0.06, 0.05, 0.2), dz=-0.07))
    hp, hr = at(-96)
    g0 = hp + hr * 0.03 + Vector((0, 0, 0.015))
    out.append(mesh_obj("CBk_grip", lambda b: cyl(b, g0, g0 + Vector((0, 0.02, 0.085)), 0.017, 0.015, 8), P["grip"]))
    out.append(boxed("CBk_mags", 38, (0.075, 0.032, 0.07), dz=-0.012))
    out.append(boxed("CBk_cuffs", 150, (0.06, 0.035, 0.06), dz=-0.01))
    out.append(boxed("CBk_radiopack", 112, (0.06, 0.04, 0.11), dz=-0.035, mat="black"))
    out.append(boxed("CBk_light", -40, (0.035, 0.035, 0.11), dz=-0.04, mat="black"))
    return [(o, "pelvis") for o in out]


def k_back_text(rig, bm, P):
    """POLICE across the shoulder blades, pressed onto the shirt's surface."""
    cu = bpy.data.curves.new("CB_police", "FONT")
    cu.body = "POLICE"
    cu.size = 0.075
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.resolution_u = 2
    ob = bpy.data.objects.new("CBk_backtext", cu)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.view_layer.objects.active
    z = bone(rig, "spine_03").z + 0.1
    # text x -> world -X (reads left to right from behind), text y -> up
    rot = Matrix(((-1, 0, 0), (0, 0, 1), (0, 1, 0)))
    for v in ob.data.vertices:
        w = rot @ v.co
        q = surf(Vector((w.x, 0.0, z + w.z)), (0, 1, 0), lift=0.003, skip_arms=True)
        v.co = q
    ob.data.materials.append(P["white"])
    return [(ob, "spine_03")]


KIT = {"cap": k_cap, "badge": k_badge, "nameplate": k_nameplate, "radio": k_radio, "belt": k_belt, "back_text": k_back_text}


def bind_piece(ob, rig, bone_name):
    """Ride one bone, rigidly: every vertex fully weighted to it."""
    g = ob.vertex_groups.new(name=bone_name)
    g.add(list(range(len(ob.data.vertices))), 1.0, "REPLACE")
    ob.parent = rig
    ob.matrix_parent_inverse = rig.matrix_world.inverted()
    md = ob.modifiers.new("Armature", "ARMATURE")
    md.object = rig


# ---------------------------------------------------------------- the mask
def clean_mask_material():
    """New latex, a little glossy, the trollface printed on the front (the
    zombie builder's rubber_mask projects it; this replaces its aged, bloody
    material)."""
    m = bpy.data.materials.new("CB_Mask")
    N, L = Z["_nodes"](m)
    b = N["Principled BSDF"]
    uv = N.new("ShaderNodeUVMap")
    uv.uv_map = "proj"
    img = N.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(Z["MASK_ART"])
    img.extension = "EXTEND"
    L.new(uv.outputs["UV"], img.inputs["Vector"])
    fr = N.new("ShaderNodeVertexColor")
    fr.layer_name = "front"
    sep = N.new("ShaderNodeSeparateColor")
    L.new(fr.outputs["Color"], sep.inputs["Color"])
    k = N.new("ShaderNodeMath")
    k.operation = "MULTIPLY"
    L.new(sep.outputs[0], k.inputs[0])
    L.new(img.outputs["Alpha"], k.inputs[1])
    ink = Z["_mix"](N, L, k.outputs[0], (1.0, 1.0, 1.0, 1.0), img.outputs["Color"])
    col = Z["_mix"](N, L, 1.0, hexlin(0xf2efe6), ink, "MULTIPLY")
    L.new(col, b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.3
    return m


# ---------------------------------------------------------------- build
def build(name, look, P):
    bm, rig = Q["make_person"](look)
    Z["_rest"](rig)
    bpy.context.view_layer.update()
    if look.get("mask"):
        _, eyes = Z["face_masks"](bm, rig)
        Z["rubber_mask_material"] = clean_mask_material     # rubber_mask looks it up at call time
        Z["rubber_mask"](bm, rig, eyes)
        P = dict(P, _eyes=eyes)
        bpy.context.view_layer.update()
    surface_trees(rig)
    kit = []
    for k in look.get("kit", ()):
        for ob, bn in KIT[k](rig, bm, P):
            bind_piece(ob, rig, bn)
            kit.append(ob)
    return bm, rig, kit


# ---------------------------------------------------------------- export
BUDGET = {"body": 6000, "hair": 1500, "cloth": 2600, "shoe": 600, "kit": 2500}


def strip_covered(body, covers, top):
    """Delete the body's faces that lie under clothes or shoes (every vertex
    within 5 cm below a cover, along its normal), below `top` (the collar
    stays lined). MakeHuman's own delete groups leave skin under the cloth,
    and it pokes through at a deep bend: a knee, a crouch, an arched back."""
    import bmesh
    from mathutils.bvhtree import BVHTree
    trees = []
    for c in covers:
        cb = bmesh.new()
        cb.from_mesh(c.data)
        cb.transform(c.matrix_world)
        trees.append(BVHTree.FromBMesh(cb))
        cb.free()
    b = bmesh.new()
    b.from_mesh(body.data)
    mw = body.matrix_world
    rot = mw.to_3x3()
    covered = set()
    for v in b.verts:
        p = mw @ v.co
        if p.z > top:
            continue
        n = (rot @ v.normal).normalized()
        if any(t.ray_cast(p - n * 0.002, n, 0.05)[0] is not None for t in trees):
            covered.add(v.index)
    faces = [f for f in b.faces if all(v.index in covered for v in f.verts)]
    n_all = len(b.faces)
    bmesh.ops.delete(b, geom=faces, context="FACES")
    b.to_mesh(body.data)
    b.free()
    body.data.update()
    print(f"STRIP {len(faces)}/{n_all} body faces under clothes")


def export_cop(name, look, P):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 4
    sc.cycles.use_denoising = False
    bm, rig, kit = build(name, look, P)
    Z["_rest"](rig)
    parts = []
    hair = look.get("hair", (None,))[0]
    for ob in [bm] + [c for c in rig.children_recursive if c.type == "MESH" and c is not bm and c not in kit]:
        low = ob.name.lower()
        f = Z["_snapshot"](ob, "CB_" + ob.name)
        kind = "body" if ob is bm else "shoe" if "shoe" in low else "hair" if hair and low.endswith(hair) else None if any(k in low for k in ("eye", "brow", "lash", "teeth")) else "cloth"
        parts.append((f, kind))
    covers = [f for f, kind in parts if kind in ("cloth", "shoe") and "proj" not in f.data.uv_layers]
    body = next(f for f, kind in parts if kind == "body")
    strip_covered(body, covers, (rig.matrix_world @ rig.pose.bones["neck_01"].head).z - 0.04)
    # the kit: one mesh, rest pose, weights kept
    bpy.ops.object.select_all(action="DESELECT")
    ks = [Z["_snapshot"](k, "CB_" + k.name) for k in kit]
    for k in ks:
        k.select_set(True)
    if ks:
        bpy.context.view_layer.objects.active = ks[0]
        bpy.ops.object.join()
        parts.append((bpy.context.view_layer.objects.active, "kit"))
    for f, kind in parts:
        proj = "proj" in f.data.uv_layers
        for m in f.data.materials:
            if m:
                if proj:
                    for n in m.node_tree.nodes:
                        if n.type == "UVMAP" and n.uv_map == "proj":
                            n.uv_map = "UVMap"
                pin_uvs(m)
        if proj:
            # the mask: its art rides the "proj" map, so that one stays
            f.data.uv_layers.remove(f.data.uv_layers[0])
            f.data.uv_layers["proj"].active_render = True
        if kind and Z["_tris"](f) > BUDGET[kind]:
            Z["_decimate"](f, BUDGET[kind] / Z["_tris"](f))
        uvs = f.data.uv_layers
        if not uvs:
            uvs.new(name="UVMap")
        keep = uvs.active_render if uvs.active_render is not None else uvs[0]
        for u in [u for u in uvs if u.name != keep.name]:
            uvs.remove(u)
        uvs[0].name = "UVMap"
    # one mesh
    bpy.ops.object.select_all(action="DESELECT")
    for f, _ in parts:
        f.select_set(True)
    bpy.context.view_layer.objects.active = parts[0][0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = f"CB_{name}"
    me = ob.data
    if me.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for a in [a for a in me.attributes if a.name in ("sharp_face", "sharp_edge")]:
        me.attributes.remove(a)
    me.shade_smooth()
    # the atlas UV: smart projected, the head's islands doubled, packed
    atlas = me.uv_layers.new(name="atlas")
    me.uv_layers.active = atlas
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.003, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    head_z = (rig.matrix_world @ rig.pose.bones["neck_01"].head).z
    head_c = rig.matrix_world @ rig.pose.bones["head"].head
    uvd = me.uv_layers["atlas"].data
    for poly in me.polygons:
        c = ob.matrix_world @ poly.center
        if c.z > head_z and (c - head_c).length < 0.3:
            for li in poly.loop_indices:
                uvd[li].uv = uvd[li].uv * 2.4
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=True, margin=0.003)
    bpy.ops.object.mode_set(mode="OBJECT")
    size = int(os.environ.get("CB_SIZE", "1024"))
    col = Z["_new_img"](f"cb_{name}_col", size)
    Z["_bake"](ob, col, "DIFFUSE")
    # alpha (an emission bake), only from the hair and brow/lash cards
    cards = ("eyebrow", "eyelash") + ((hair,) if hair else ())
    for m in me.materials:
        N, L = Z["_nodes"](m)
        b = next(n for n in N if n.type == "BSDF_PRINCIPLED")
        src = next(iter(b.inputs["Alpha"].links), None) if any(k in m.name for k in cards) else None
        out = next(n for n in N if n.type == "OUTPUT_MATERIAL")
        em = N.new("ShaderNodeEmission")
        if src is not None:
            L.new(src.from_socket, em.inputs["Color"])
        else:
            em.inputs["Color"].default_value = (1, 1, 1, 1)
        L.new(em.outputs[0], out.inputs["Surface"])
    a_img = Z["_new_img"](f"cb_{name}_a", size)
    Z["_bake"](ob, a_img, "EMIT")
    px = list(col.pixels)
    px[3::4] = list(a_img.pixels)[0::4]
    rgba = Z["_new_img"](f"cb_{name}", size, alpha=True)
    rgba.pixels = px
    os.makedirs(BAKE_DIR, exist_ok=True)
    rgba.filepath_raw = os.path.join(BAKE_DIR, rgba.name + ".png")
    rgba.file_format = "PNG"
    rgba.save()
    m = bpy.data.materials.new(f"CB_{name}")
    N, L = Z["_nodes"](m)
    b = N["Principled BSDF"]
    t = N.new("ShaderNodeTexImage")
    t.image = rgba
    L.new(t.outputs["Color"], b.inputs["Base Color"])
    L.new(t.outputs["Alpha"], b.inputs["Alpha"])
    b.inputs["Roughness"].default_value = 0.72
    me.materials.clear()
    me.materials.append(m)
    for uv in [u for u in me.uv_layers if u.name != "atlas"]:
        me.uv_layers.remove(uv)
    me.uv_layers["atlas"].name = "UVMap"
    for a in list(me.color_attributes):         # the bake masks (front, zmask) stay home
        me.color_attributes.remove(a)
    Z["_bind"](ob, rig)
    # nothing else of the build rides along
    for o in [o for o in bpy.data.objects if o.type == "MESH" and o is not ob]:
        bpy.data.objects.remove(o)
    rig.name = "CB_rig"
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = rig
    path = os.path.join(HERE, f"cop-{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True,
        export_apply=False, export_skins=True, export_animations=False,
        export_image_format="WEBP", export_image_quality=82,
        export_def_bones=False, export_extras=False, export_cameras=False, export_lights=False,
    )
    print(f"EXPORT {path} tris={Z['_tris'](ob)} size={os.path.getsize(path) // 1024} KB")


# ---------------------------------------------------------------- main
def main():
    names = [a for a in ARGS if a in CAST] or list(CAST)
    os.makedirs(RENDER_DIR, exist_ok=True)
    for name in names:
        Z["clear_scene"]()
        P = palette()
        look = CAST[name]
        if "export" in ARGS:
            export_cop(name, look, P)
            continue
        bm, rig, kit = build(name, look, P)
        Z["apply_spec"](rig, POSES[os.environ.get("CB_POSE", look.get("pose", "stand"))])
        cam = Z["render_setup"]()
        bpy.context.scene.view_settings.exposure = float(os.environ.get("CB_EXPOSURE", "-0.7"))
        for yaw in [int(v) for v in os.environ.get("CB_VIEWS", "25,160").split(",") if v]:
            Z["shoot"](cam, os.path.join(RENDER_DIR, f"cop-{name}-y{yaw}.png"), yaw, target=(0, 0, 0.92), dist=4.4, height=1.15, w=640, h=960)
        if os.environ.get("CB_FACE", "1") == "1":
            hb = rig.pose.bones["head"]
            hp = rig.matrix_world @ hb.head.lerp(hb.tail, 0.4)
            Z["shoot"](cam, os.path.join(RENDER_DIR, f"cop-{name}-face.png"), 25, target=tuple(hp + Vector((0, -0.03, 0.03))),
                       dist=0.95, height=hp.z + 0.08, lens=60, w=800, h=800)


main()
