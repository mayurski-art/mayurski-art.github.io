"""
Troll Forces zombies (zombies.js): realistic zombies on MakeHuman bodies.

    blender --background --python build_zombies.blender.py -- render [look ...]

Needs the MPFB 2 extension (extensions.blender.org, id "mpfb") and the CC0
MakeHuman asset packs "makehuman system assets", "shirts01", "pants01",
"dress01" installed into its user data (see HANDOFF.md, session "zombies").
Everything those produce is CC0. Do NOT call read_factory_settings here: it
unloads the extension.

Env: ZB_RENDER_DIR, ZB_SAMPLES, ZB_VIEWS ("0,35,90,180"), ZB_FACE (1 = also
a face close-up).

Pipeline per look: a MakeHuman body (macros for sex/age/build) with the
"game_engine" rig (UE-style bone names), facial expression units for the
snarl (lips pulled back off the teeth, jaw open, eyes wide), the cheeks
hollowed, low-poly eyes and teeth, clothes from the packs. Then every
material is swapped for a zombie one: the skin's own texture desaturated
and pushed grey-green with mottling, veins, bruising and dried blood round
the mouth and down the chest; milky eyes; yellowed teeth; clothes grimed,
bloodied and torn (alpha holes).
"""
import bpy
import math
import os
import sys
from mathutils import Vector

from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService
from bl_ext.blender_org.mpfb.services.locationservice import LocationService

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT_DIR = os.path.dirname(os.path.abspath(__file__))
RENDER_DIR = os.environ.get("ZB_RENDER_DIR", os.path.join(OUT_DIR, "_renders"))
MPFB_SYS = LocationService.get_mpfb_data()        # bundled: base mesh, targets, rigs
MPFB_USER = LocationService.get_user_data()       # the asset packs


def hexlin(h):
    """sRGB hex -> linear RGBA (glTF and Blender colours are linear)."""
    out = []
    for i in (16, 8, 0):
        c = ((h >> i) & 255) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


def clear_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)


def user_asset(kind, name, ext=".mhclo"):
    d = os.path.join(MPFB_USER, kind, name)
    for f in os.listdir(d):
        if f.endswith(ext):
            return os.path.join(d, f)
    raise FileNotFoundError(f"{kind}/{name}/*{ext}")


# ---------------------------------------------------------------- looks
# macros: MakeHuman's 0..1 sliders. face: expression units + shape targets.
SNARL = {
    "expression/units/caucasian/mouth-open": 0.4,
    "expression/units/caucasian/mouth-retraction": 1.0,
    "expression/units/caucasian/mouth-upward-retraction": 1.0,
    "expression/units/caucasian/mouth-depression-retraction": 1.0,
    "expression/units/caucasian/eyebrows-left-down": 0.4,
    "expression/units/caucasian/eyebrows-right-down": 0.4,
    "expression/units/caucasian/neck-platysma": 0.6,
    "expression/units/caucasian/eye-left-opened-up": 0.45,
    "expression/units/caucasian/eye-right-opened-up": 0.45,
    "expression/units/caucasian/nose-left-dilatation": 0.5,
    "expression/units/caucasian/nose-right-dilatation": 0.5,
    "cheek/l-cheek-volume-decr": 0.8,
    "cheek/r-cheek-volume-decr": 0.8,
    "cheek/l-cheek-bones-incr": 0.5,
    "cheek/r-cheek-bones-incr": 0.5,
}

GAUNT = {
    **SNARL,
    "cheek/l-cheek-volume-decr": 1.0,
    "cheek/r-cheek-volume-decr": 1.0,
    "cheek/l-cheek-bones-incr": 1.0,
    "cheek/r-cheek-bones-incr": 1.0,
    "expression/units/caucasian/mouth-open": 0.75,
}

# under a rubber mask: no snarl (the mask closes over the mouth), just hollow
HOLLOW = {k: v for k, v in SNARL.items() if k.startswith("cheek/")}

# Render poses, applied in order: (bone, (x, y, z)) aims the bone along that
# WORLD direction; (bone, (axis, degrees)) turns it about a world axis.
# World: +X the body's left, -Y forward, +Z up. Parents before children.
SHAMBLE = [
    ("spine_02", ("X", 8)), ("spine_03", ("X", 6)), ("neck_01", ("Y", -12)), ("head", ("X", 14)),
    ("upperarm_l", (0.25, -0.92, -0.3)), ("lowerarm_l", (0.1, -0.97, -0.2)),
    ("upperarm_r", (-0.3, -0.8, -0.5)), ("lowerarm_r", (-0.05, -0.9, -0.42)),
    ("thigh_l", (0.05, -0.25, -0.97)), ("calf_l", (0.03, 0.1, -1)),
    ("thigh_r", (-0.06, 0.12, -1)), ("calf_r", (0.0, 0.2, -1)),
]
SPRINT = [
    ("spine_01", ("X", 18)), ("spine_03", ("X", 6)), ("head", ("X", -12)),
    ("upperarm_l", (0.15, -0.6, -0.78)), ("lowerarm_l", (0.05, -0.97, -0.2)),
    ("upperarm_r", (-0.2, 0.55, -0.8)), ("lowerarm_r", (-0.05, -0.4, -0.9)),
    ("thigh_l", (0.04, -0.82, -0.57)), ("calf_l", (0.0, 0.15, -1)),
    ("thigh_r", (-0.03, 0.45, -0.9)), ("calf_r", (0.0, 0.95, -0.3)),
]
LEAP = [
    ("spine_01", ("X", 38)), ("spine_02", ("X", 10)), ("head", ("X", -42)),
    ("upperarm_l", (0.4, -0.9, 0.15)), ("lowerarm_l", (0.15, -0.98, 0.05)),
    ("upperarm_r", (-0.4, -0.9, 0.15)), ("lowerarm_r", (-0.15, -0.98, 0.05)),
    ("thigh_l", (0.15, -0.85, -0.5)), ("calf_l", (0.05, 0.3, -0.95)),
    ("thigh_r", (-0.1, 0.1, -1)), ("calf_r", (0.0, 0.95, -0.3)),
    ("fingers", ("curl", 40)),
]

LOOKS = {
    # the RE walker: middle-aged man, striped shirt, jeans
    "walker": {
        "macros": {"gender": 1.0, "age": 0.62, "muscle": 0.45, "weight": 0.45, "height": 0.55},
        "skin": "old_caucasian_male",
        "clothes": ["male_casualsuit03", "shoes02"],
        "face": SNARL,
        "pose": SHAMBLE,
    },
    # the horde's sprinters: younger, T-shirt and cargo trousers, some hair
    "runner": {
        "macros": {"gender": 1.0, "age": 0.35, "muscle": 0.55, "weight": 0.35, "height": 0.6},
        "skin": "young_caucasian_male",
        "clothes": ["elvs_crude_t-shirt_male", "cortu_cargo_pants", "shoes01"],
        "hair": "short02",
        "face": SNARL,
        "pose": SPRINT,
    },
    # a woman in casual clothes, long lank hair (fewer tears: no bare chest)
    "woman": {
        "macros": {"gender": 0.0, "age": 0.5, "muscle": 0.4, "weight": 0.5, "height": 0.45},
        "skin": "middleage_caucasian_female",
        "clothes": ["female_casualsuit01", "shoes04"],
        "hair": "long01",
        "face": SNARL,
        "tear": 0.7,
        "pose": SHAMBLE,
    },
    # a heavy-set man in work overalls
    "worker": {
        "macros": {"gender": 1.0, "age": 0.55, "muscle": 0.6, "weight": 0.65, "height": 0.5},
        "skin": "middleage_african_male",
        "clothes": ["male_worksuit01", "shoes03"],
        "cloth_value": 0.38,
        "face": SNARL,
        "pose": SHAMBLE,
    },
    # the rare one (about 1 in 40): a rubber trollface Halloween mask, the
    # face from the real mascot art (assets/pfp/base/og.webp)
    "trollmask": {
        "macros": {"gender": 1.0, "age": 0.45, "muscle": 0.5, "weight": 0.5, "height": 0.55},
        "skin": "middleage_caucasian_male",
        "clothes": ["male_casualsuit01", "shoes02"],
        "face": HOLLOW,
        "mask": True,
        "pose": SHAMBLE,
    },
    # the leaper: starved, shirtless, barefoot, trousers in rags, long arms
    # and long hooked fingers. The length comes from MakeHuman's own
    # measure/finger targets, so the rig is fitted to it (bone scale doesn't
    # survive glTF: three inherits scale where Blender was told not to).
    # Its clips are LEAPER_CLIPS: a crouched lope, a crouch wind-up, a leap.
    "leaper": {
        "macros": {"gender": 1.0, "age": 0.5, "muscle": 0.3, "weight": 0.0, "height": 0.8},
        "skin": "old_caucasian_male",
        "clothes": ["toigo_wool_pants"],
        "face": GAUNT,
        "body": {
            "arms/measure-upperarm-length-incr": 1.0,
            "arms/measure-lowerarm-length-incr": 1.0,
            "hands/l-hand-fingers-length-incr": 1.0,
            "hands/r-hand-fingers-length-incr": 1.0,
            "hands/l-hand-scale-incr": 0.5,
            "hands/r-hand-scale-incr": 0.5,
        },
        "tear": 0.5,
        "pose": LEAP,
        "chest_blood": True,
        "clips": "leaper",
    },
}


def make_human(look):
    macro = TargetService.get_default_macro_info_dict()
    macro.update(look["macros"])
    bm = HumanService.create_human(macro_detail_dict=macro)
    for rel, w in {**look["face"], **look.get("body", {})}.items():
        path = os.path.join(MPFB_SYS, "targets", rel + ".target.gz")
        TargetService.load_target(bm, path, weight=w)
    rig = HumanService.add_builtin_rig(bm, "game_engine")
    HumanService.add_mhclo_asset(user_asset("eyes", "low-poly"), bm, asset_type="Eyes", subdiv_levels=0)
    HumanService.add_mhclo_asset(user_asset("teeth", "teeth_base"), bm, asset_type="Teeth", subdiv_levels=0)
    for c in look["clothes"]:
        cl = HumanService.add_mhclo_asset(user_asset("clothes", c), bm, asset_type="Clothes", subdiv_levels=0)
        if cl is not None and not any(k in c for k in ("shoe", "boot")):
            # the body under it stays (see below), so stand the cloth off it
            # a little or tight tops show skin through
            md = cl.modifiers.new("standoff", "DISPLACE")
            md.direction = "NORMAL"
            md.mid_level = 0.0
            md.strength = 0.005
    if look.get("hair"):
        HumanService.add_mhclo_asset(user_asset("hair", look["hair"]), bm, asset_type="Hair", subdiv_levels=0)
    # MPFB deletes the body under each garment; keep it under torn clothes so
    # the tears show skin, not a hole (shoes still hide the feet)
    for md in list(bm.modifiers):
        if md.type == "MASK" and md.name.startswith("Delete.") and not any(k in md.name for k in ("shoe", "boot")):
            bm.modifiers.remove(md)
    return bm, rig


def _pb_world(rig, pb):
    return rig.matrix_world @ pb.matrix


def _set_world_rot(rig, pb, rot_fn):
    from mathutils import Matrix
    loc, rot, scl = _pb_world(rig, pb).decompose()
    r = rot_fn(rot)
    pb.matrix = rig.matrix_world.inverted() @ (Matrix.Translation(loc) @ r.to_matrix().to_4x4() @ Matrix.Diagonal((*scl, 1)))
    bpy.context.view_layer.update()


def turn(rig, bone, axis, deg):
    """Rotate a pose bone about a WORLD axis through its head."""
    from mathutils import Quaternion
    q = Quaternion(Vector({"X": (1, 0, 0), "Y": (0, 1, 0), "Z": (0, 0, 1)}[axis]), math.radians(deg))
    _set_world_rot(rig, rig.pose.bones[bone], lambda rot: q @ rot)


def aim(rig, bone, direction):
    """Swing a pose bone so it points along a WORLD direction (+X the body's
    left, -Y forward, +Z up). The shortest swing, so its twist is kept."""
    pb = rig.pose.bones[bone]
    h = rig.matrix_world @ pb.head
    cur = (rig.matrix_world @ pb.tail - h).normalized()
    q = cur.rotation_difference(Vector(direction).normalized())
    _set_world_rot(rig, pb, lambda rot: q @ rot)


def stretch_arms(rig, k, claws):
    """Lengthen the arms (upper and fore) by k along the bone, then fingers
    for claws, curled into hooks. Pose scale only: Y is along the bone and
    children don't inherit it (their inherit_scale is set to NONE_LEGACY so
    the forearm doesn't get fat)."""
    for side in ("l", "r"):
        for b in ("upperarm", "lowerarm"):
            pb = rig.pose.bones[f"{b}_{side}"]
            pb.scale = (1.0, k, 1.0)
        for f in ("index", "middle", "ring", "pinky"):
            for n in (1, 2, 3):
                pb = rig.pose.bones[f"{f}_0{n}_{side}"]
                if claws:
                    pb.scale = (0.85, 1.5 if n > 1 else 1.25, 0.85)
                    pb.rotation_mode = "XYZ"
                    pb.rotation_euler = (math.radians(28 if n > 1 else 10), 0, 0)
    for bone in rig.data.bones:
        if bone.parent and bone.parent.name.startswith(("upperarm", "lowerarm", "hand", "index", "middle", "ring", "pinky")):
            bone.inherit_scale = "NONE_LEGACY"
    bpy.context.view_layer.update()


def pose(rig, look):
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
    if look.get("arms"):
        stretch_arms(rig, look["arms"], look.get("claws"))
    apply_spec(rig, look.get("pose", []))


# ---------------------------------------------------------------- materials
def _nodes(m):
    m.use_nodes = True
    return m.node_tree.nodes, m.node_tree.links


def _noise(N, L, vec, scale, detail=6.0):
    n = N.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    L.new(vec, n.inputs["Vector"])
    return n


def _range(N, L, src, a, b, lo=0.0, hi=1.0):
    r = N.new("ShaderNodeMapRange")
    r.inputs["From Min"].default_value = a
    r.inputs["From Max"].default_value = b
    r.inputs["To Min"].default_value = lo
    r.inputs["To Max"].default_value = hi
    L.new(src, r.inputs["Value"])
    return r.outputs["Result"]


def _mix(N, L, fac, a, b, blend="MIX"):
    m = N.new("ShaderNodeMix")
    m.data_type = "RGBA"
    m.blend_type = blend
    if isinstance(fac, float):
        m.inputs["Factor"].default_value = fac
    else:
        L.new(fac, m.inputs["Factor"])
    for i, v in ((6, a), (7, b)):
        if isinstance(v, tuple):
            m.inputs[i].default_value = v
        else:
            L.new(v, m.inputs[i])
    return m.outputs[2]


def _near(N, L, pos, center, radius, soft):
    """1 within `radius` of `center` (object space), fading over `soft`."""
    d = N.new("ShaderNodeVectorMath")
    d.operation = "DISTANCE"
    d.inputs[1].default_value = center
    L.new(pos, d.inputs[0])
    return _range(N, L, d.outputs["Value"], radius, radius + soft, 1.0, 0.0)


def zombie_skin(skin_name):
    """The MakeHuman skin texture, rotted: desaturated, pushed grey-green,
    mottled with bruises, laced with veins, blood round the mouth and down
    the chin and chest."""
    m = bpy.data.materials.new("ZB_Skin")
    N, L = _nodes(m)
    bsdf = N["Principled BSDF"]
    tc = N.new("ShaderNodeTexCoord")
    img = N.new("ShaderNodeTexImage")
    d = os.path.join(MPFB_USER, "skins", skin_name)
    img.image = bpy.data.images.load(os.path.join(d, [f for f in os.listdir(d) if f.endswith(".png")][0]))
    L.new(tc.outputs["UV"], img.inputs["Vector"])
    hsv = N.new("ShaderNodeHueSaturation")
    hsv.inputs["Saturation"].default_value = 0.15
    hsv.inputs["Value"].default_value = 0.8
    L.new(img.outputs["Color"], hsv.inputs["Color"])
    obj = tc.outputs["Object"]
    zm = N.new("ShaderNodeVertexColor")
    zm.layer_name = "zmask"
    sep = N.new("ShaderNodeSeparateColor")
    L.new(zm.outputs["Color"], sep.inputs["Color"])
    lips, sock, mblood = sep.outputs[0], sep.outputs[1], sep.outputs[2]
    # rot tint: grey-green, patchy, a jaundiced yellow in places
    patch = _noise(N, L, obj, 7.0)
    tint = _mix(N, L, _range(N, L, patch.outputs["Fac"], 0.3, 0.7), hexlin(0x9ea492), hexlin(0x606b4f))
    yel = _noise(N, L, obj, 2.5)
    tint = _mix(N, L, _range(N, L, yel.outputs["Fac"], 0.55, 0.7, 0.0, 0.5), tint, hexlin(0xa39a6a))
    col = _mix(N, L, 1.0, hsv.outputs["Color"], tint, "MULTIPLY")
    # sunken sockets: bruised dark rings
    col = _mix(N, L, sock, col, hexlin(0x3a2c30), "MULTIPLY")
    # lips eaten back to raw, dark meat
    raw = _mix(N, L, _range(N, L, _noise(N, L, obj, 80.0).outputs["Fac"], 0.3, 0.7), hexlin(0x4a1610), hexlin(0x1e0705))
    col = _mix(N, L, lips, col, raw)
    # bruising: purple-grey blotches
    bru = _noise(N, L, obj, 3.5)
    col = _mix(N, L, _range(N, L, bru.outputs["Fac"], 0.58, 0.7, 0.0, 0.55), col, hexlin(0x4c3f4a), "MULTIPLY")
    # veins: thin warped voronoi edges
    warp = _noise(N, L, obj, 4.0)
    wv = N.new("ShaderNodeMix")
    wv.data_type = "VECTOR"
    wv.inputs["Factor"].default_value = 0.2
    L.new(obj, wv.inputs[4])
    L.new(warp.outputs["Color"], wv.inputs[5])
    vor = N.new("ShaderNodeTexVoronoi")
    vor.feature = "DISTANCE_TO_EDGE"
    vor.inputs["Scale"].default_value = 22.0
    L.new(wv.outputs[1], vor.inputs["Vector"])
    col = _mix(N, L, _range(N, L, vor.outputs["Distance"], 0.0, 0.008, 0.45, 0.0), col, hexlin(0x2c3440))
    # blood: round the mouth and down the chin (zmask B), plus spatter
    sp = _noise(N, L, obj, 9.0, 8.0)
    spat = _range(N, L, sp.outputs["Fac"], 0.62, 0.7)
    breakup = _noise(N, L, obj, 14.0)
    m2 = N.new("ShaderNodeMath")
    m2.operation = "MULTIPLY"
    L.new(mblood, m2.inputs[0])
    L.new(_range(N, L, breakup.outputs["Fac"], 0.3, 0.5), m2.inputs[1])
    m3 = N.new("ShaderNodeMath")
    m3.operation = "MAXIMUM"
    L.new(m2.outputs[0], m3.inputs[0])
    L.new(spat, m3.inputs[1])
    # dried blood: near-black brown, fresher red only in the thick of it
    dried = _mix(N, L, _range(N, L, breakup.outputs["Fac"], 0.45, 0.65), hexlin(0x1e0604), hexlin(0x3f0a06))
    col = _mix(N, L, m3.outputs[0], col, dried)
    L.new(col, bsdf.inputs["Base Color"])
    rough = N.new("ShaderNodeMath")
    rough.operation = "MULTIPLY_ADD"
    rough.inputs[1].default_value = -0.2        # a little tacky where it's bloody
    rough.inputs[2].default_value = 0.62
    L.new(m3.outputs[0], rough.inputs[0])
    L.new(rough.outputs[0], bsdf.inputs["Roughness"])
    bump = N.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    bump.inputs["Distance"].default_value = 0.002
    L.new(_noise(N, L, obj, 60.0).outputs["Fac"], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def flat(name, col, rough=0.5, emit=None, k=0.0):
    m = bpy.data.materials.new(name)
    N, _ = _nodes(m)
    b = N["Principled BSDF"]
    b.inputs["Base Color"].default_value = hexlin(col)
    b.inputs["Roughness"].default_value = rough
    if emit is not None:
        b.inputs["Emission Color"].default_value = hexlin(emit)
        b.inputs["Emission Strength"].default_value = k
    return m


def rotten_teeth():
    """MakeHuman's teeth texture (it has the gums and gaps), stained
    yellow-brown and darkened at the gum line."""
    m = bpy.data.materials.new("ZB_Teeth")
    N, L = _nodes(m)
    b = N["Principled BSDF"]
    img = N.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(os.path.join(MPFB_USER, "teeth", "teeth_base", "teeth.png"))
    stain = _noise(N, L, N.new("ShaderNodeTexCoord").outputs["Object"], 40.0)
    tint = _mix(N, L, _range(N, L, stain.outputs["Fac"], 0.3, 0.7), hexlin(0xc4ad78), hexlin(0x7a6440))
    L.new(_mix(N, L, 1.0, img.outputs["Color"], tint, "MULTIPLY"), b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.4
    return m


def lank_hair(m):
    """Dull, dirty, darker hair."""
    N, L = _nodes(m)
    bsdf = next(n for n in N if n.type == "BSDF_PRINCIPLED")
    link = next((l for l in bsdf.inputs["Base Color"].links), None)
    if not link:
        return
    hsv = N.new("ShaderNodeHueSaturation")
    hsv.inputs["Saturation"].default_value = 0.45
    hsv.inputs["Value"].default_value = 0.4
    L.new(link.from_socket, hsv.inputs["Color"])
    L.new(hsv.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.8


def zombify_cloth(m, tear_at=0.6, value=0.8):
    """Grime, blood and tears on top of the garment's own texture. Lower
    tear_at = more holes; lower value = filthier (pale cloth needs it)."""
    N, L = _nodes(m)
    bsdf = next(n for n in N if n.type == "BSDF_PRINCIPLED")
    link = next((l for l in bsdf.inputs["Base Color"].links), None)
    src = link.from_socket if link else None
    tc = N.new("ShaderNodeTexCoord")
    obj = tc.outputs["Object"]
    if src is None:
        rgb = N.new("ShaderNodeRGB")
        rgb.outputs[0].default_value = bsdf.inputs["Base Color"].default_value
        src = rgb.outputs[0]
    dirt = _noise(N, L, obj, 5.0)
    col = _mix(N, L, _range(N, L, dirt.outputs["Fac"], 0.4, 0.7, 0.15, 0.6), src, hexlin(0x4a3f2e), "MULTIPLY")
    pos = N.new("ShaderNodeNewGeometry").outputs["Position"]
    chest = _near(N, L, pos, (0.0, -0.12, 1.38), 0.08, 0.16)
    bl = _noise(N, L, obj, 6.0, 8.0)
    m1 = N.new("ShaderNodeMath")
    m1.operation = "MULTIPLY"
    L.new(chest, m1.inputs[0])
    L.new(_range(N, L, bl.outputs["Fac"], 0.42, 0.55), m1.inputs[1])
    sp = _range(N, L, _noise(N, L, obj, 4.0, 8.0).outputs["Fac"], 0.64, 0.7, 0.0, 0.9)
    m2 = N.new("ShaderNodeMath")
    m2.operation = "MAXIMUM"
    L.new(m1.outputs[0], m2.inputs[0])
    L.new(sp, m2.inputs[1])
    col = _mix(N, L, m2.outputs[0], col, hexlin(0x3d0907))
    L.new(col, bsdf.inputs["Base Color"])
    # tears: holes where a coarse noise peaks (alpha clipped in the game)
    tear = _noise(N, L, obj, 4.5, 12.0)
    L.new(_range(N, L, tear.outputs["Fac"], tear_at, tear_at + 0.005, 1.0, 0.0), bsdf.inputs["Alpha"])
    # wash the colour out: years of dirt
    hsv = N.new("ShaderNodeHueSaturation")
    hsv.inputs["Saturation"].default_value = 0.6
    hsv.inputs["Value"].default_value = value
    L.new(col, hsv.inputs["Color"])
    L.new(hsv.outputs["Color"], bsdf.inputs["Base Color"])
    m.use_backface_culling = False


def face_masks(bm, rig, chest=False):
    """Paint the face masks the skin shader reads, as a colour attribute
    "zmask" on the body: R = the lips (eaten raw), G = the eye sockets
    (sunken, dark), B = blood from the mouth down the chin and throat.
    Positions are the snarl-posed ones (shape keys on, modifiers off, so
    vertex indices match the base mesh)."""
    for md in bm.modifiers:
        md.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    ev = bm.evaluated_get(dg)
    P = [bm.matrix_world @ v.co for v in ev.data.vertices]
    for md in bm.modifiers:
        md.show_viewport = True
    gi = bm.vertex_groups["lips"].index
    lipw = [0.0] * len(P)
    for v in bm.data.vertices:
        for g in v.groups:
            if g.group == gi:
                lipw[v.index] = g.weight
    lip_pts = [P[i] for i, w in enumerate(lipw) if w > 0.5]
    mouth = sum(lip_pts, Vector()) / len(lip_pts)
    eyes = []
    eye_ob = next(c for c in rig.children_recursive if "low-poly" in c.name)
    for side in (1, -1):
        pts = [eye_ob.matrix_world @ v.co for v in eye_ob.data.vertices if v.co.x * side > 0]
        eyes.append(sum(pts, Vector()) / len(pts))
    attr = bm.data.color_attributes.new("zmask", "FLOAT_COLOR", "POINT")

    def fall(d, r, soft):
        return max(0.0, min(1.0, 1 - (d - r) / soft))

    for i, p in enumerate(P):
        # lips: the group itself plus a ragged rim, worse on the left
        rim = fall((p - mouth).length, 0.022 + 0.008 * (p.x > 0), 0.012)
        lip = max(lipw[i], rim * 0.8)
        sock = max(fall((p - e).length, 0.014, 0.018) for e in eyes)
        below = mouth.z - p.z
        drip = 0.0
        if -0.01 < below < 0.2 and p.y < mouth.y + 0.06:
            # a run down the chin, narrowing as it goes
            drip = fall(abs(p.x - 0.006 * math.sin(below * 60)), 0.012 + 0.03 * (1 - below / 0.2), 0.01)
        blood = max(fall((p - mouth).length, 0.03, 0.025), drip)
        if chest and p.y < 0.0:
            # a rotted, bloody chest: a big wound under the left pec
            blood = max(blood, fall((p - Vector((0.05, -0.12, 1.3))).length, 0.06, 0.1))
        attr.data[i].color = (lip, sock, blood, 1.0)
    return mouth, eyes


# The rubber mask's face is the real mascot art, never redrawn: og.webp is the
# PFP base (1024 px square). ART_EYES is the pixel midway between its eyes,
# ART_CHIN the bottom of its jaw line; ART_M_PER_PX sizes it on a head (its
# eyes land ~5.6 cm apart, the jaw ~11 cm under them).
MASK_ART = os.path.normpath(os.path.join(OUT_DIR, "..", "..", "..", "pfp", "base", "og.webp"))
ART_SIZE = 1024
ART_EYES = (560, 332)
ART_CHIN = 668
ART_M_PER_PX = 0.00033


def rubber_mask_material():
    """Aged latex, off-white going yellow, the trollface drawing printed on
    the front (vertex colour "front" says where), grime and blood spatter."""
    m = bpy.data.materials.new("ZB_Mask")
    N, L = _nodes(m)
    b = N["Principled BSDF"]
    obj = N.new("ShaderNodeTexCoord").outputs["Object"]
    uv = N.new("ShaderNodeUVMap")
    uv.uv_map = "proj"
    img = N.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(MASK_ART)
    img.extension = "EXTEND"
    L.new(uv.outputs["UV"], img.inputs["Vector"])
    fr = N.new("ShaderNodeVertexColor")
    fr.layer_name = "front"
    sep = N.new("ShaderNodeSeparateColor")
    L.new(fr.outputs["Color"], sep.inputs["Color"])
    lat = _mix(N, L, _range(N, L, _noise(N, L, obj, 6.0).outputs["Fac"], 0.35, 0.7), hexlin(0xe0d9c4), hexlin(0xbfb293))
    # the art is transparent round the face (black underneath): ink only
    # where it's opaque
    k = N.new("ShaderNodeMath")
    k.operation = "MULTIPLY"
    L.new(sep.outputs[0], k.inputs[0])
    L.new(img.outputs["Alpha"], k.inputs[1])
    ink = _mix(N, L, k.outputs[0], (1.0, 1.0, 1.0, 1.0), img.outputs["Color"])
    col = _mix(N, L, 1.0, lat, ink, "MULTIPLY")
    col = _mix(N, L, _range(N, L, _noise(N, L, obj, 9.0).outputs["Fac"], 0.45, 0.7, 0.0, 0.55), col, hexlin(0x4a3d2c), "MULTIPLY")
    spat = _range(N, L, _noise(N, L, obj, 7.0, 8.0).outputs["Fac"], 0.63, 0.69)
    col = _mix(N, L, spat, col, hexlin(0x3a0806))
    L.new(col, b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.35
    return m


def rubber_mask(bm, rig, eyes):
    """A full-head rubber mask: the head of the body (shape keys applied),
    pushed out 6 mm, the jaw swollen into the troll's big grin, rigid on the
    head bone. The body's own eye openings become the mask's eye holes. UVs:
    "UVMap" (smart projected) for the bake, "proj" maps the art from the
    front with its eyes on the body's eyes."""
    import bmesh
    ob = _snapshot(bm, "ZB_mask")
    me = ob.data
    inv = ob.matrix_world.inverted()
    E = inv @ ((eyes[0] + eyes[1]) / 2)
    gi = ob.vertex_groups["head"].index
    keep = {v.index for v in me.vertices if any(g.group == gi and g.weight >= 0.5 for g in v.groups)}
    ob.vertex_groups.clear()
    hg = ob.vertex_groups.new(name="head")
    b = bmesh.new()
    b.from_mesh(me)
    b.verts.ensure_lookup_table()
    dl = b.verts.layers.deform.verify()
    bmesh.ops.delete(b, geom=[v for v in b.verts if v.index not in keep], context="VERTS")
    b.normal_update()
    for v in b.verts:
        v.co += v.normal * 0.006
        v[dl].clear()
        v[dl][hg.index] = 1.0
    for v in b.verts:
        p = v.co
        t = max(0.0, min(1.0, (E.y + 0.03 - p.y) / 0.06)) * max(0.0, min(1.0, (E.z - 0.03 - p.z) / 0.07))
        p.x = E.x + (p.x - E.x) * (1 + 0.14 * t)
        p.y -= 0.012 * t
    b.to_mesh(me)
    b.free()
    me.update()
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    me.materials.clear()
    me.materials.append(rubber_mask_material())

    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")

    proj = me.uv_layers.new(name="proj")
    me.uv_layers.active = me.uv_layers[0]
    me.uv_layers[0].active_render = True
    for li, loop in enumerate(me.loops):
        p = me.vertices[loop.vertex_index].co
        px = ART_EYES[0] + (p.x - E.x) / ART_M_PER_PX      # +X (the body's left) is the art's right
        py = ART_EYES[1] + (E.z - p.z) / ART_M_PER_PX
        proj.data[li].uv = (px / ART_SIZE, 1 - py / ART_SIZE)
    fa = me.color_attributes.new("front", "FLOAT_COLOR", "POINT")
    for v in me.vertices:
        f = max(0.0, min(1.0, (-v.normal.y - 0.15) / 0.35))
        py = ART_EYES[1] + (E.z - v.co.z) / ART_M_PER_PX
        w = f * max(0.0, min(1.0, (ART_CHIN + 12 - py) / 14))
        fa.data[v.index].color = (w, w, w, 1.0)

    mw = ob.matrix_world.copy()
    ob.parent = rig
    ob.parent_type = "BONE"
    ob.parent_bone = "head"
    ob.matrix_world = mw
    return ob


def zombify_materials(bm, rig, look):
    _, eyes = face_masks(bm, rig, look.get("chest_blood", False))
    skin = zombie_skin(look["skin"])
    eye = flat("ZB_Eye", 0xd6dbd2, 0.15, 0xc8d2cc, 0.08)
    for ob in [bm] + [c for c in rig.children_recursive if c.type == "MESH"]:
        name = ob.name.lower()
        if ob is bm:
            ob.data.materials.clear()
            ob.data.materials.append(skin)
        elif "low-poly" in name or "eye" in name:
            ob.data.materials.clear()
            ob.data.materials.append(eye)
        elif "teeth" in name:
            ob.data.materials.clear()
            ob.data.materials.append(rotten_teeth())
        else:
            for m in ob.data.materials:
                if not m:
                    continue
                if ob.name.endswith("." + look.get("hair", "-")):
                    lank_hair(m)
                else:
                    zombify_cloth(m, look.get("tear", 0.6), look.get("cloth_value", 0.8))
    if look.get("mask"):
        rubber_mask(bm, rig, eyes)


# ---------------------------------------------------------------- clips
# Keyframed in-place, 30 fps. Each key is a pose spec (as SHAMBLE): bones
# are aimed along WORLD directions from the rest pose, so the same spec
# works on every body. ("pelvis", ("drop", metres)) lowers the hips.
FPS = 30
ARMS_OUT = [
    ("upperarm_l", (0.22, -0.93, -0.28)), ("lowerarm_l", (0.08, -0.97, -0.2)),
    ("upperarm_r", (-0.25, -0.88, -0.4)), ("lowerarm_r", (-0.05, -0.92, -0.38)),
]


def _legs(fwd_side, phase):
    """Leg aims for a walk: phase 'reach' (fwd_side leg out front, the other
    trailing) or 'pass' (fwd_side leg swinging through, the other planted)."""
    a, b = ("l", "r") if fwd_side == "l" else ("r", "l")
    sx = {"l": 0.04, "r": -0.04}
    if phase == "reach":
        return [(f"thigh_{a}", (sx[a], -0.4, -0.92)), (f"calf_{a}", (sx[a], -0.12, -0.99)),
                (f"thigh_{b}", (sx[b], 0.32, -0.95)), (f"calf_{b}", (sx[b], 0.5, -0.87))]
    return [(f"thigh_{a}", (sx[a], -0.2, -0.98)), (f"calf_{a}", (sx[a], 0.42, -0.91)),
            (f"thigh_{b}", (sx[b], 0.02, -1)), (f"calf_{b}", (sx[b], 0.06, -1))]


def _run_legs(fwd_side, phase):
    a, b = ("l", "r") if fwd_side == "l" else ("r", "l")
    sx = {"l": 0.04, "r": -0.04}
    if phase == "reach":
        return [(f"thigh_{a}", (sx[a], -0.75, -0.66)), (f"calf_{a}", (sx[a], -0.2, -0.98)),
                (f"thigh_{b}", (sx[b], 0.5, -0.87)), (f"calf_{b}", (sx[b], 0.9, -0.44))]
    return [(f"thigh_{a}", (sx[a], -0.45, -0.89)), (f"calf_{a}", (sx[a], 0.75, -0.66)),
            (f"thigh_{b}", (sx[b], 0.05, -1)), (f"calf_{b}", (sx[b], 0.15, -0.99))]


def _sway(k):
    """Upper-body loll, k in -1..1."""
    return [("spine_02", ("X", 9)), ("spine_03", ("X", 5)), ("spine_02", ("Y", 4 * k)),
            ("neck_01", ("Y", -10 * k)), ("head", ("X", 12))]


def _rise_arms(up):
    """One hand reaching up for a hold, the other pulling down on the ground."""
    a, b = (up, "r" if up == "l" else "l")
    sx = {"l": 1, "r": -1}
    return [(f"upperarm_{a}", (0.25 * sx[a], -0.35, 0.9)), (f"lowerarm_{a}", (0.15 * sx[a], -0.3, 0.94)),
            (f"upperarm_{b}", (0.3 * sx[b], -0.8, 0.5)), (f"lowerarm_{b}", (0.1 * sx[b], -0.5, -0.85))]


CLIPS = {
    # the shamble: arms out, a lopsided drag, the head lolling
    "walk": {"loop": True, "keys": [
        (0, _sway(1) + ARMS_OUT + _legs("l", "reach")),
        (9, _sway(0) + ARMS_OUT + _legs("r", "pass")),
        (18, _sway(-1) + ARMS_OUT + _legs("r", "reach")),
        (27, _sway(0) + ARMS_OUT + _legs("l", "pass")),
        (36, _sway(1) + ARMS_OUT + _legs("l", "reach")),
    ]},
    # the sprint: leaning in, arms flailing forward
    "run": {"loop": True, "keys": [
        (0, [("spine_01", ("X", 22)), ("head", ("X", -14)),
             ("upperarm_l", (0.3, -0.85, -0.2)), ("lowerarm_l", (0.1, -0.9, 0.3)),
             ("upperarm_r", (-0.25, 0.4, -0.88)), ("lowerarm_r", (-0.1, -0.5, -0.86))] + _run_legs("l", "reach")),
        (5, [("spine_01", ("X", 22)), ("head", ("X", -14))] + ARMS_OUT + _run_legs("r", "pass")),
        (10, [("spine_01", ("X", 22)), ("head", ("X", -14)),
              ("upperarm_r", (-0.3, -0.85, -0.2)), ("lowerarm_r", (-0.1, -0.9, 0.3)),
              ("upperarm_l", (0.25, 0.4, -0.88)), ("lowerarm_l", (0.1, -0.5, -0.86))] + _run_legs("r", "reach")),
        (15, [("spine_01", ("X", 22)), ("head", ("X", -14))] + ARMS_OUT + _run_legs("l", "pass")),
        (20, [("spine_01", ("X", 22)), ("head", ("X", -14)),
              ("upperarm_l", (0.3, -0.85, -0.2)), ("lowerarm_l", (0.1, -0.9, 0.3)),
              ("upperarm_r", (-0.25, 0.4, -0.88)), ("lowerarm_r", (-0.1, -0.5, -0.86))] + _run_legs("l", "reach")),
    ]},
    "idle": {"loop": True, "keys": [
        (0, _sway(0.6) + ARMS_OUT),
        (30, _sway(-0.6) + ARMS_OUT + [("upperarm_l", ("X", -6))]),
        (60, _sway(0.6) + ARMS_OUT),
    ]},
    # a two-handed swipe: rear back, then rake down and forward
    "attack": {"loop": False, "keys": [
        (0, _sway(0) + ARMS_OUT),
        (8, [("spine_02", ("X", -6)), ("head", ("X", 4)),
             ("upperarm_l", (0.35, -0.3, 0.88)), ("lowerarm_l", (0.2, 0.2, 0.96)),
             ("upperarm_r", (-0.35, -0.3, 0.88)), ("lowerarm_r", (-0.2, 0.2, 0.96))]),
        (13, [("spine_01", ("X", 18)), ("spine_02", ("X", 12)), ("head", ("X", 10)),
              ("upperarm_l", (0.1, -0.85, -0.52)), ("lowerarm_l", (-0.05, -0.6, -0.8)),
              ("upperarm_r", (-0.1, -0.85, -0.52)), ("lowerarm_r", (0.05, -0.6, -0.8))]),
        (22, _sway(0) + ARMS_OUT),
    ]},
    # collapse: knees go, then over onto its back
    "die": {"loop": False, "keys": [
        (0, _sway(0) + ARMS_OUT),
        (9, [("pelvis", ("drop", 0.35)), ("pelvis", ("X", -18)), ("spine_02", ("X", 25)), ("head", ("X", 20)),
             ("thigh_l", (0.1, -0.7, -0.7)), ("calf_l", (0.05, 0.6, -0.8)),
             ("thigh_r", (-0.1, -0.6, -0.8)), ("calf_r", (-0.05, 0.7, -0.7)),
             ("upperarm_l", (0.6, -0.2, -0.77)), ("upperarm_r", (-0.6, -0.2, -0.77))]),
        (22, [("pelvis", ("drop", 0.8)), ("pelvis", ("X", -82)), ("head", ("X", -25)),
              ("thigh_l", (0.12, -0.55, 0.83)), ("calf_l", (0.1, -0.98, -0.1)),
              ("thigh_r", (-0.1, -0.7, 0.7)), ("calf_r", (-0.05, -0.99, 0.1)),
              ("upperarm_l", (0.9, 0.3, 0.3)), ("lowerarm_l", (0.8, 0.0, 0.6)),
              ("upperarm_r", (-0.9, 0.2, 0.4)), ("lowerarm_r", (-0.95, -0.2, 0.2))]),
        (30, [("pelvis", ("drop", 0.82)), ("pelvis", ("X", -88)), ("head", ("X", -30)),
              ("thigh_l", (0.15, -0.45, 0.88)), ("calf_l", (0.12, -1, 0.0)),
              ("thigh_r", (-0.12, -0.6, 0.79)), ("calf_r", (-0.06, -1, 0.05)),
              ("upperarm_l", (0.95, 0.3, 0.1)), ("lowerarm_l", (0.9, 0.0, 0.4)),
              ("upperarm_r", (-0.95, 0.25, 0.15)), ("lowerarm_r", (-0.98, -0.15, 0.05))]),
    ]},
    # out of a grave (the game lifts the body through the ground meanwhile):
    # head up, hands clawing over each other, then into the shamble.
    # 48 frames = zombies.js RISE_TIME
    "rise": {"loop": False, "keys": [
        (0, _rise_arms("l") + [("spine_02", ("X", 12)), ("head", ("X", -22))]),
        (12, _rise_arms("r") + [("spine_02", ("X", 16)), ("head", ("X", -16))]),
        (24, _rise_arms("l") + [("spine_02", ("X", 20)), ("head", ("X", -10))]),
        (36, _rise_arms("r") + [("spine_02", ("X", 18)), ("head", ("X", 0))]),
        (48, _sway(0) + ARMS_OUT),
    ]},
}


# The leaper moves low: hunched, knees bent, long arms hanging, claws hooked.
CLAWS = [("fingers", ("curl", 34))]
HUNCH = [("spine_01", ("X", 28)), ("spine_02", ("X", 14)), ("head", ("X", -38))]


def _hang(k=0.0):
    """Long arms hanging forward; k swings them (-1..1, left forward at +1)."""
    return [("upperarm_l", (0.22, -0.45 - 0.3 * k, -0.86 + 0.15 * abs(k))), ("lowerarm_l", (0.12, -0.55 - 0.25 * k, -0.83)),
            ("upperarm_r", (-0.22, -0.45 + 0.3 * k, -0.86 + 0.15 * abs(k))), ("lowerarm_r", (-0.12, -0.55 + 0.25 * k, -0.83))]


def _bent(drop=0.16):
    return [("pelvis", ("drop", drop))] + [
        (f"{b}_{s}", (x, y, z)) for s, sx in (("l", 0.06), ("r", -0.06))
        for b, x, y, z in (("thigh", sx, -0.6, -0.8), ("calf", sx * 0.5, 0.55, -0.83))]


def _lope_legs(fwd_side, phase):
    return [("pelvis", ("drop", 0.13 if phase == "reach" else 0.05))] + _run_legs(fwd_side, phase)


LOPE_BODY = [("spine_01", ("X", 34)), ("spine_02", ("X", 10)), ("head", ("X", -40))]

LEAPER_CLIPS = {
    # hunched, swaying, the head twitching round
    "idle": {"loop": True, "keys": [
        (0, _bent() + HUNCH + _hang(0) + CLAWS),
        (18, _bent(0.18) + HUNCH + [("neck_01", ("Z", 22))] + _hang(0.15) + CLAWS),
        (24, _bent(0.18) + HUNCH + [("neck_01", ("Z", -14))] + _hang(0.1) + CLAWS),
        (44, _bent() + HUNCH + _hang(-0.1) + CLAWS),
        (60, _bent() + HUNCH + _hang(0) + CLAWS),
    ]},
    # a low, fast lope, arms swinging with the stride
    "lope": {"loop": True, "keys": [
        (0, LOPE_BODY + _lope_legs("l", "reach") + _hang(-0.8) + CLAWS),
        (4, LOPE_BODY + _lope_legs("r", "pass") + _hang(0) + CLAWS),
        (8, LOPE_BODY + _lope_legs("r", "reach") + _hang(0.8) + CLAWS),
        (12, LOPE_BODY + _lope_legs("l", "pass") + _hang(0) + CLAWS),
        (16, LOPE_BODY + _lope_legs("l", "reach") + _hang(-0.8) + CLAWS),
    ]},
    # the wind-up: down into a deep crouch, arms back, head up at you
    "crouch": {"loop": False, "keys": [
        (0, _bent() + HUNCH + _hang(0) + CLAWS),
        (12, [("pelvis", ("drop", 0.3)), ("spine_01", ("X", 40)), ("spine_02", ("X", 10)), ("head", ("X", -52)),
              ("thigh_l", (0.08, -0.78, -0.62)), ("calf_l", (0.04, 0.72, -0.69)),
              ("thigh_r", (-0.08, -0.78, -0.62)), ("calf_r", (-0.04, 0.72, -0.69)),
              ("upperarm_l", (0.3, 0.55, -0.78)), ("lowerarm_l", (0.1, 0.3, -0.95)),
              ("upperarm_r", (-0.3, 0.55, -0.78)), ("lowerarm_r", (-0.1, 0.3, -0.95)),
              ("fingers", ("curl", 42))]),
    ]},
    # airborne: stretched out flat, claws first, legs trailing
    "leap": {"loop": False, "keys": [
        (0, [("pelvis", ("drop", 0.1)), ("spine_01", ("X", 30)), ("head", ("X", -40))] + _hang(0) + CLAWS),
        (6, [("spine_01", ("X", 48)), ("spine_02", ("X", 6)), ("head", ("X", -55)),
             ("upperarm_l", (0.35, -0.9, 0.25)), ("lowerarm_l", (0.15, -0.98, 0.12)),
             ("upperarm_r", (-0.35, -0.9, 0.25)), ("lowerarm_r", (-0.15, -0.98, 0.12)),
             ("thigh_l", (0.08, 0.35, -0.94)), ("calf_l", (0.04, 0.9, -0.43)),
             ("thigh_r", (-0.08, 0.2, -0.98)), ("calf_r", (-0.04, 0.8, -0.6)),
             ("fingers", ("curl", 46))]),
    ]},
    # a raking swipe from the crouch
    "attack": {"loop": False, "keys": [(f, _bent() + s + CLAWS) for f, s in CLIPS["attack"]["keys"]]},
    "die": {"loop": False, "keys": [(f, s + CLAWS) for f, s in CLIPS["die"]["keys"]]},
    "rise": {"loop": False, "keys": [(f, s + CLAWS) for f, s in CLIPS["rise"]["keys"]]},
}
CLIP_SETS = {"human": CLIPS, "leaper": LEAPER_CLIPS}


def _rest(rig):
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    bpy.context.view_layer.update()


def apply_spec(rig, spec):
    for bone, how in spec:
        if isinstance(how, tuple) and len(how) == 3:
            aim(rig, bone, how)
        elif how[0] == "curl":
            # ("fingers", ("curl", deg)): every finger joint bent about its
            # own X axis (the knuckle less), hooking the hands into claws
            from mathutils import Quaternion
            for side in ("l", "r"):
                for f in ("index", "middle", "ring", "pinky"):
                    for n in (1, 2, 3):
                        pb = rig.pose.bones[f"{f}_0{n}_{side}"]
                        pb.rotation_quaternion = Quaternion((1, 0, 0), math.radians(how[1] * (0.4 if n == 1 else 1.0)))
            bpy.context.view_layer.update()
        elif how[0] == "drop":
            from mathutils import Matrix
            pb = rig.pose.bones[bone]
            w = _pb_world(rig, pb)
            pb.matrix = rig.matrix_world.inverted() @ Matrix.Translation((0, 0, -how[1])) @ w
            bpy.context.view_layer.update()
        else:
            turn(rig, bone, *how)


def make_clips(rig, clips=CLIPS):
    """One NLA track per clip, named after it: the glTF exporter's
    NLA_TRACKS mode turns each track into one animation."""
    rig.animation_data_create()
    for name, clip in clips.items():
        act = bpy.data.actions.new("ZB_" + name)
        rig.animation_data.action = act
        for frame, spec in clip["keys"]:
            _rest(rig)
            apply_spec(rig, spec)
            for pb in rig.pose.bones:
                pb.keyframe_insert("rotation_quaternion", frame=frame)
                if pb.name == "pelvis":
                    pb.keyframe_insert("location", frame=frame)
        track = rig.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 0, act)
        rig.animation_data.action = None
    _rest(rig)


# ---------------------------------------------------------------- bake
BAKE_DIR = os.environ.get("ZB_BAKE_DIR", os.path.join(os.environ.get("TEMP", "/tmp"), "zb_bake"))


def _bsdf(m):
    return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def _bake(ob, img, kind, sources=()):
    """Bake into `img` on ob (the active object), from `sources` if given."""
    for m in ob.data.materials:
        N = m.node_tree.nodes
        t = N.new("ShaderNodeTexImage")
        t.image = img
        N.active = t
    bpy.ops.object.select_all(action="DESELECT")
    for s in sources:
        s.select_set(True)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    sc = bpy.context.scene
    kw = {"type": kind, "margin": 6, "use_clear": True}
    if kind == "DIFFUSE":
        kw["pass_filter"] = {"COLOR"}
    if sources:
        kw.update(use_selected_to_active=True, cage_extrusion=0.012, max_ray_distance=0.03)
    bpy.ops.object.bake(**kw)
    for m in ob.data.materials:
        N = m.node_tree.nodes
        for n in [n for n in N if n.type == "TEX_IMAGE" and n.image == img]:
            N.remove(n)


def _new_img(name, size, data=False, alpha=False):
    img = bpy.data.images.new(name, size, size, alpha=alpha, float_buffer=False)
    if data:
        img.colorspace_settings.name = "Non-Color"
    return img


def _save(img):
    os.makedirs(BAKE_DIR, exist_ok=True)
    img.filepath_raw = os.path.join(BAKE_DIR, img.name + ".png")
    img.file_format = "PNG"
    img.save()
    return img


def _alpha_source(m):
    b = _bsdf(m)
    link = next(iter(b.inputs["Alpha"].links), None)
    return link.from_socket if link else None


def bake_object(ob, size, name, normal_from=None, rough=0.7):
    """Bake ob's (procedural) materials to one texture set and swap in a plain
    glTF-friendly material: colour (+ alpha when the material has one), and
    a normal map when baked from a detailed source mesh."""
    sc = bpy.context.scene
    col = _new_img(name + "_col", size)
    _bake(ob, col, "DIFFUSE")
    alpha_src = _alpha_source(ob.data.materials[0]) if ob.data.materials else None
    a_img = None
    if alpha_src is not None:
        # route the alpha through an emission shader and bake that
        for m in ob.data.materials:
            N, L = m.node_tree.nodes, m.node_tree.links
            src = _alpha_source(m)
            out = next(n for n in N if n.type == "OUTPUT_MATERIAL")
            em = N.new("ShaderNodeEmission")
            if src is not None:
                L.new(src, em.inputs["Color"])
            L.new(em.outputs[0], out.inputs["Surface"])
        a_img = _new_img(name + "_a", size)
        _bake(ob, a_img, "EMIT")
        px = list(col.pixels)
        ap = list(a_img.pixels)
        px[3::4] = ap[0::4]
        rgba = _new_img(name + "_col", size, alpha=True)
        rgba.pixels = px
        col = rgba
    nrm = None
    if normal_from is not None:
        nrm = _new_img(name + "_nrm", size, data=True)
        _bake(ob, nrm, "NORMAL", sources=[normal_from])
    _save(col)
    if nrm:
        _save(nrm)
    m = bpy.data.materials.new("ZB_" + name)
    N, L = _nodes(m)
    b = N["Principled BSDF"]
    t = N.new("ShaderNodeTexImage")
    t.image = col
    L.new(t.outputs["Color"], b.inputs["Base Color"])
    if a_img is not None:
        L.new(t.outputs["Alpha"], b.inputs["Alpha"])
    b.inputs["Roughness"].default_value = rough
    if nrm:
        tn = N.new("ShaderNodeTexImage")
        tn.image = nrm
        nm = N.new("ShaderNodeNormalMap")
        L.new(tn.outputs["Color"], nm.inputs["Color"])
        L.new(nm.outputs["Normal"], b.inputs["Normal"])
    ob.data.materials.clear()
    ob.data.materials.append(m)
    return m


def _snapshot(ob, name, keep_armature=False):
    """A new object holding ob's evaluated mesh (shape keys and masks applied,
    the armature NOT), with its vertex groups."""
    arm = [md for md in ob.modifiers if md.type == "ARMATURE"]
    for md in arm:
        md.show_viewport = keep_armature
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    for md in arm:
        md.show_viewport = True
    me.name = name
    new = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(new)
    new.matrix_world = ob.matrix_world.copy()
    for g in ob.vertex_groups:
        new.vertex_groups.new(name=g.name)
    for m in ob.data.materials:
        me.materials.append(m)
    return new


def _decimate(ob, ratio):
    md = ob.modifiers.new("dec", "DECIMATE")
    md.ratio = ratio
    md.use_symmetry = True
    md.symmetry_axis = "X"
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    ob.modifiers.remove(md)
    old = ob.data
    ob.data = me
    bpy.data.meshes.remove(old)


def _bind(ob, rig):
    ob.parent = rig
    ob.matrix_parent_inverse = rig.matrix_world.inverted()
    md = ob.modifiers.new("Armature", "ARMATURE")
    md.object = rig
    # only the rig's bones as groups (drops MPFB's helper/landmark groups)
    bones = {b.name for b in rig.data.bones}
    for g in list(ob.vertex_groups):
        if g.name not in bones:
            ob.vertex_groups.remove(g)
    # the bake masks (zmask) must not ride along: GLTFLoader would multiply
    # the base colour by them
    for a in list(ob.data.color_attributes):
        ob.data.color_attributes.remove(a)


def _tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)


CLOTH_TRIS = 7000      # a garment over this is decimated down to it


def export_look(name, look):
    """zombie-<name>.glb: the rig with its clips, a decimated body with a
    baked skin set (colour + normal from the full-detail body), teeth, eyes
    and each garment with its own baked colour+alpha."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 4
    sc.cycles.use_denoising = False
    sc.render.fps = FPS                       # clip lengths are in these frames
    bm, rig = make_human(look)
    zombify_materials(bm, rig, look)
    _rest(rig)

    extras = [c for c in rig.children_recursive if c.type == "MESH" and c is not bm]
    high = _snapshot(bm, "ZB_high")
    body = _snapshot(bm, "ZB_body")
    _decimate(body, float(os.environ.get("ZB_BODY_RATIO", "0.26")))
    bake_object(body, int(os.environ.get("ZB_SKIN_SIZE", "1024")), f"{name}_skin", normal_from=high, rough=0.62)
    _bind(body, rig)

    parts = [body]
    for ob in extras:
        key = ob.name.split(".")[-1]
        if look.get("mask") and "teeth" in key:
            continue                              # behind a closed rubber mouth
        snap = _snapshot(ob, key if key.startswith("ZB_") else f"ZB_{key}")
        if key == "ZB_mask":
            me = snap.data
            _decimate(snap, 0.4)
            me = snap.data
            me.uv_layers.active = me.uv_layers[0]  # the smart-projected one
            bake_object(snap, 512, f"{name}_mask", rough=0.38)
            me.uv_layers.remove(me.uv_layers["proj"])
        elif "teeth" in key:
            _decimate(snap, 0.15)
            bake_object(snap, 256, f"{name}_teeth", rough=0.45)
        elif "low-poly" in key:
            pass                                  # the flat milky eye material exports as is
        else:
            if any(k in key for k in ("shoe", "boot")):
                _decimate(snap, 0.4)
            elif _tris(snap) > CLOTH_TRIS:
                _decimate(snap, CLOTH_TRIS / _tris(snap))
            bake_object(snap, 512, f"{name}_{key}", rough=0.85)
        _bind(snap, rig)
        parts.append(snap)

    make_clips(rig, CLIP_SETS[look.get("clips", "human")])
    for ob in {high, bm, *[c for c in rig.children_recursive if c.type == "MESH" and c not in parts]}:
        bpy.data.objects.remove(ob)
    rig.name = "ZB_rig"

    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = rig
    path = os.path.join(OUT_DIR, f"zombie-{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True,
        export_apply=False, export_skins=True, export_animations=True,
        export_animation_mode="NLA_TRACKS", export_image_format="WEBP", export_image_quality=82,
        export_def_bones=False, export_extras=False, export_cameras=False, export_lights=False,
    )
    tris = sum(_tris(p) for p in parts)
    print(f"EXPORT {path} tris={tris} parts={[(p.name, _tris(p)) for p in parts]} size={os.path.getsize(path) // 1024} KB")


# ---------------------------------------------------------------- render
def render_setup():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = int(os.environ.get("ZB_SAMPLES", "32"))
    sc.cycles.use_denoising = True
    sc.render.resolution_x = 720
    sc.render.resolution_y = 1080
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.exposure = float(os.environ.get("ZB_EXPOSURE", "-0.9"))
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = hexlin(0x1b1d1e)
    bg.inputs["Strength"].default_value = 0.5
    for nm, loc, e, col in (("key", (1.6, -2.2, 2.6), 420, 0xfff0dc),
                            ("rim", (-1.8, 2.0, 2.2), 260, 0xd9e2f0),
                            ("fill", (-2.2, -1.6, 1.0), 70, 0xeeeeee)):
        ld = bpy.data.lights.new(nm, "AREA")
        ld.energy = e
        ld.size = 1.2
        ld.color = hexlin(col)[:3]
        lo = bpy.data.objects.new(nm, ld)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 1.0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(lo)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    return cam


def shoot(cam, path, yaw_deg, target=(0, 0, 0.9), dist=4.6, height=1.0, lens=70, w=720, h=1080):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = w, h
    yaw = math.radians(yaw_deg)
    t = Vector(target)
    cam.data.lens = lens
    cam.location = Vector((t.x + math.sin(yaw) * dist, t.y - math.cos(yaw) * dist, height))
    cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    names = [a for a in ARGS if a in LOOKS] or list(LOOKS)
    os.makedirs(RENDER_DIR, exist_ok=True)
    for name in names:
        clear_scene()
        look = LOOKS[name]
        if "export" in ARGS:
            export_look(name, look)
            continue
        bm, rig = make_human(look)
        zombify_materials(bm, rig, look)
        if "render" in ARGS and os.environ.get("ZB_CLIPS"):
            # ZB_CLIPS="idle:0,crouch:12": one shot per clip key, side-on
            cam = render_setup()
            clips = CLIP_SETS[look.get("clips", "human")]
            for item in os.environ["ZB_CLIPS"].split(","):
                cn, fr = item.split(":")
                spec = dict(clips[cn]["keys"])[int(fr)]
                _rest(rig)
                apply_spec(rig, spec)
                for yaw in [int(v) for v in os.environ.get("ZB_VIEWS", "60").split(",") if v]:
                    shoot(cam, os.path.join(RENDER_DIR, f"{name}-{cn}{fr}-y{yaw}.png"), yaw)
            continue
        if "render" in ARGS:
            pose(rig, look)
            cam = render_setup()
            for yaw in [int(v) for v in os.environ.get("ZB_VIEWS", "0,35").split(",") if v]:
                shoot(cam, os.path.join(RENDER_DIR, f"{name}-y{yaw}.png"), yaw)
            if os.environ.get("ZB_FACE", "1") == "1":
                hb = rig.pose.bones["head"]
                hp = rig.matrix_world @ hb.head.lerp(hb.tail, 0.35)
                shoot(cam, os.path.join(RENDER_DIR, f"{name}-face.png"), 25, target=tuple(hp + Vector((0, -0.04, 0))),
                      dist=0.8, height=hp.z + 0.05, lens=60, w=800, h=800)


main()
