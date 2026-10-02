"""
Troll Forces zombies (zombies.js): one base body, clothes, variants.

    blender --background --python build_zombies.blender.py -- render

Env: ZB_RENDER_DIR, ZB_SAMPLES, ZB_VIEWS ("0,35,90,180"), ZB_GAUNT 0..1,
ZB_ARM (arm length factor), ZB_TAG (file prefix).

Blender is Z-up and the body faces -Y (Blender's front view). Lengths are
metres. The legs match character.js buildHumanoid exactly (hip joint 0.89,
thigh 0.445, shin 0.445 at 1.78 m) so the rig's foot IK still plants the
feet; everything above the hips is real human proportion.

The body is metaballs: capsules along the bones plus ellipsoids for the
big muscle masses, blended into one surface, with negative elements
carving the eye sockets, the nose cavity and the torn mouth. It's then
turned into a mesh and roughened (noise displacement) so it reads as
skin, not plastic.
"""
import bpy
import math
import os
import random
import sys
from mathutils import Vector, Euler

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT_DIR = os.path.dirname(os.path.abspath(__file__))
RENDER_DIR = os.environ.get("ZB_RENDER_DIR", os.path.join(OUT_DIR, "_renders"))


def hexlin(h):
    """sRGB hex -> linear RGBA (glTF and Blender colours are linear)."""
    out = []
    for i in (16, 8, 0):
        c = ((h >> i) & 255) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------- skeleton
# One table of joints both the metaballs and (later) the armature read.
# Left side only (+X); the right mirrors it.
J = {
    "pelvis":   Vector((0.0, 0.01, 0.95)),
    "hip":      Vector((0.09, 0.0, 0.89)),
    "knee":     Vector((0.095, -0.015, 0.445)),
    "ankle":    Vector((0.10, 0.015, 0.075)),
    "heel":     Vector((0.10, 0.05, 0.035)),
    "ball":     Vector((0.105, -0.10, 0.025)),
    "toe":      Vector((0.105, -0.155, 0.022)),
    "waist":    Vector((0.0, 0.015, 1.06)),
    "belly":    Vector((0.0, 0.01, 1.18)),
    "chest":    Vector((0.0, 0.0, 1.32)),
    "uchest":   Vector((0.0, 0.01, 1.42)),
    "neckbase": Vector((0.0, 0.03, 1.49)),
    "neck":     Vector((0.0, 0.02, 1.565)),
    "head":     Vector((0.0, 0.0, 1.66)),
    "clav":     Vector((0.03, -0.01, 1.455)),
    "shoulder": Vector((0.185, 0.02, 1.445)),
}
# Arms rest 26 degrees off vertical, the rig's own rest angle
# (character.js ARM = (0.30, -0.62)), so its arm rotations carry over.
_ARM = Vector((math.sin(math.radians(26)), 0.0, -math.cos(math.radians(26))))
J["elbow"] = J["shoulder"] + _ARM * 0.29 + Vector((0, 0.01, 0))
J["wrist"] = J["elbow"] + _ARM * 0.26 + Vector((0, -0.01, 0))
J["hand"] = J["wrist"] + _ARM * 0.10 + Vector((0, -0.01, 0))


def mirror(v):
    return Vector((-v.x, v.y, v.z))


# ---------------------------------------------------------------- metaballs
THRESHOLD = 0.6


def vis(stiff):
    """Where a lone element's surface sits, as a share of its radius.
    Blender's field is s * (1 - d^2/r^2)^3; the rest of r is blend reach,
    so stiffer elements blend over a shorter distance."""
    return math.sqrt(1 - (THRESHOLD / stiff) ** (1 / 3))


class Meta:
    """One metaball family. Every size passed in is the size the surface
    should SHOW; the element radius is scaled up to match."""

    def __init__(self, name, res=0.008):
        self.mb = bpy.data.metaballs.new(name)
        self.mb.resolution = res
        self.mb.render_resolution = res
        self.mb.threshold = THRESHOLD
        self.ob = bpy.data.objects.new(name, self.mb)
        bpy.context.scene.collection.objects.link(self.ob)

    def _el(self, kind, co, r, stiff, neg):
        e = self.mb.elements.new(type=kind)
        e.co = co
        e.radius = r / vis(stiff)
        e.stiffness = stiff
        e.use_negative = neg
        return e

    def cap(self, a, b, r, stiff=2.0, neg=False):
        """Capsule from a to b, radius r."""
        a, b = Vector(a), Vector(b)
        d = b - a
        e = self._el("CAPSULE", (a + b) / 2, r, stiff, neg)
        e.size_x = d.length / 2          # the straight part's half length
        e.rotation = Vector((1, 0, 0)).rotation_difference(d.normalized())
        return e

    def ell(self, c, sx, sy, sz, stiff=2.0, neg=False, rot=None):
        """Ellipsoid with half extents sx, sy, sz."""
        e = self._el("ELLIPSOID", Vector(c), 1.0, stiff, neg)
        e.size_x, e.size_y, e.size_z = sx, sy, sz
        if rot is not None:
            e.rotation = Euler(rot).to_quaternion()
        return e

    def ball(self, c, r, stiff=2.0, neg=False):
        return self._el("BALL", Vector(c), r, stiff, neg)


def along(a, b):
    """An Euler turning +Z onto a->b (orients an ellipsoid's long axis)."""
    return Vector((0, 0, 1)).rotation_difference((b - a).normalized()).to_euler()


def build_body(gaunt=0.0, arm_len=1.0, claws=False):
    """The body as one metaball surface. gaunt 0..1 strips fat and muscle
    (hollow belly, stick limbs). Torso masses blend softly (stiffness 3);
    limbs are stiffer so the thighs don't fuse into one column."""
    M = Meta("ZB_BodyMeta")
    g = 1.0 - gaunt * 0.35            # soft-tissue scale
    j = {k: v.copy() for k, v in J.items()}
    if arm_len != 1.0:
        j["elbow"] = j["shoulder"] + (J["elbow"] - J["shoulder"]) * arm_len
        j["wrist"] = j["elbow"] + (J["wrist"] - J["elbow"]) * arm_len
        j["hand"] = j["wrist"] + (J["hand"] - J["wrist"])
    LIMB = 4.5

    # --- torso: rib cage, belly, pelvis
    M.ell(j["chest"] + Vector((0, 0.005, 0.01)), 0.118 * g + 0.02, 0.08 * g + 0.012, 0.12, stiff=3)
    M.ell(j["uchest"] + Vector((0, 0.012, 0.0)), 0.13 * g + 0.02, 0.065 * g + 0.012, 0.055, stiff=3)
    M.ell(j["belly"] + Vector((0, -0.005 * g, 0)), 0.1 * g + 0.012, 0.07 * g + 0.005, 0.09, stiff=3)
    M.ell(j["waist"], 0.105 * g + 0.012, 0.07 * g + 0.005, 0.07, stiff=3)
    M.ell(j["pelvis"] + Vector((0, 0.0, -0.01)), 0.12 * g + 0.012, 0.08 * g + 0.005, 0.07, stiff=3)
    for s in (1, -1):
        M.ell(Vector((s * 0.068, -0.045 * g - 0.01, 1.365)), 0.07 * g, 0.012 * g + 0.004, 0.04 * g, stiff=4)   # pec
        M.cap(Vector((s * 0.035, 0.03, 1.475)), Vector((s * 0.14, 0.025, 1.455)), 0.032 * g + 0.008, stiff=4)  # trapezius
        M.ell(Vector((s * 0.066, 0.065 * g + 0.005, 0.875)), 0.062 * g, 0.042 * g, 0.068 * g, stiff=4)        # glute
        M.ell(Vector((s * 0.06, 0.05, 1.25)), 0.048 * g, 0.028 * g, 0.12, stiff=4)                          # lats
    # neck, a little forward-thrust
    M.cap(j["neckbase"] + Vector((0, 0.0, -0.02)), j["neck"] + Vector((0, -0.005, 0.04)), 0.045 * (0.85 + 0.15 * g), stiff=4)

    # --- legs
    for s in (1, -1):
        m = (lambda v: v) if s == 1 else mirror
        hip, knee, ankle = m(j["hip"]), m(j["knee"]), m(j["ankle"])
        M.cap(hip + Vector((s * 0.005, 0, 0.0)), knee, 0.058 * g + 0.01, stiff=LIMB)
        M.ell(hip.lerp(knee, 0.4) + Vector((s * 0.012, -0.018, 0)), 0.05 * g + 0.01, 0.055 * g + 0.008, 0.14, stiff=LIMB)  # quads
        M.cap(knee, ankle + Vector((0, 0, 0.02)), 0.038 * g + 0.006, stiff=LIMB)
        M.ell(knee.lerp(ankle, 0.27) + Vector((0, 0.022, 0)), 0.04 * g + 0.006, 0.04 * g + 0.006, 0.1, stiff=LIMB)  # calf
        M.ball(knee + Vector((0, -0.012, 0)), 0.046, stiff=LIMB)
        M.ball(ankle, 0.034, stiff=LIMB)
        M.cap(m(j["heel"]), m(j["ball"]), 0.03, stiff=LIMB)
        M.cap(m(j["ball"]), m(j["toe"]), 0.022, stiff=LIMB)
        M.ell(m(j["heel"].lerp(j["ball"], 0.55)) + Vector((0, 0, 0.012)), 0.036, 0.065, 0.024, stiff=LIMB)

    # --- arms
    for s in (1, -1):
        m = (lambda v: v) if s == 1 else mirror
        sh, el, wr = m(j["shoulder"]), m(j["elbow"]), m(j["wrist"])
        M.ell(sh + Vector((s * 0.012, 0, -0.02)), 0.044 * g + 0.01, 0.048 * g + 0.01, 0.055 * g + 0.01, stiff=5,
              rot=along(sh, el))                                                   # deltoid
        M.cap(sh, el, 0.032 * g + 0.008, stiff=LIMB)
        M.ell(sh.lerp(el, 0.5) + Vector((0, -0.01, 0)), 0.033 * g + 0.006, 0.034 * g + 0.006, 0.08, stiff=LIMB,
              rot=along(sh, el))                                                   # biceps
        M.cap(el, wr, 0.024 * g + 0.006, stiff=LIMB)
        M.ell(el.lerp(wr, 0.28), 0.032 * g + 0.004, 0.03 * g + 0.004, 0.065, stiff=LIMB,
              rot=along(el, wr))                                                   # forearm
        build_hand(M, wr, m(j["hand"]), s, claws)
    return M


def build_hand(M, wrist, tip, side, claws):
    """Palm plus four fingers and a thumb, each a two-segment capsule chain.
    Claws: long bony fingers hooked at the ends."""
    d = (tip - wrist).normalized()
    across = Vector((0, -1, 0))          # palm faces the thigh; fingers fan along -Y
    out = Vector((side, 0, 0))
    M.ell(wrist + d * 0.05, 0.02, 0.042, 0.052, stiff=7, rot=along(wrist, tip))
    flen = 0.095 * (1.7 if claws else 1.0)
    for i, off in enumerate((-0.025, -0.008, 0.008, 0.023)):
        k = (0.92, 1.0, 0.97, 0.8)[i]
        base = wrist + d * 0.088 + across * off
        mid = base + d * flen * 0.55 * k
        hook = 1.1 if claws else 0.35          # curl toward the palm
        end = mid + (d - out * hook).normalized() * flen * 0.45 * k
        M.cap(base, mid, 0.0085 if claws else 0.0105, stiff=9)
        M.cap(mid, end, 0.006 if claws else 0.0092, stiff=9)
    tb = wrist + d * 0.035 + across * 0.03
    M.cap(tb, tb + (d * 0.55 + across * 0.55 - out * 0.3).normalized() * 0.055, 0.0105, stiff=9)


def build_head(M, gaunt=0.0):
    """Skull, jaw, cheekbones and brow as positive elements; eye sockets, a
    rotted-out nose and the torn mouth carved by negative ones. The face
    points -Y. After the RE reference: hollow cheeks, a heavy brow over deep
    sockets, the lips eaten away so both rows of teeth show."""
    c = J["head"]
    g = 1.0 - gaunt * 0.4
    F = 5.0
    M.ell(c + Vector((0, 0.015, 0.035)), 0.074, 0.09, 0.085, stiff=3)              # cranium
    M.ell(c + Vector((0, -0.04, -0.02)), 0.045 * g + 0.012, 0.045, 0.056, stiff=F)  # mid-face
    M.ell(c + Vector((0, -0.05, -0.09)), 0.032, 0.03, 0.022, stiff=F)              # chin
    for s in (1, -1):
        M.cap(c + Vector((s * 0.024, -0.056, -0.096)), c + Vector((s * 0.052, -0.012, -0.072)), 0.011, stiff=F)  # mandible
        M.ell(c + Vector((s * 0.05, -0.055, 0.0)), 0.019, 0.015, 0.012, stiff=F)   # cheekbone
        M.cap(c + Vector((s * 0.01, -0.083, 0.038)), c + Vector((s * 0.05, -0.07, 0.04)), 0.0095, stiff=F)  # brow
        M.ell(c + Vector((s * 0.075, 0.012, -0.005)), 0.008, 0.019, 0.026, stiff=F)  # ear
        M.ball(c + Vector((s * 0.031, -0.086, 0.013)), 0.027, stiff=2, neg=True)    # socket
        M.ball(c + Vector((s * 0.046, -0.082, -0.04)), 0.018 * (1.6 - g), stiff=3, neg=True)  # sunken cheek
    # nose: a narrow bridge, then a ragged hole where the tip rotted off
    M.cap(c + Vector((0, -0.086, 0.022)), c + Vector((0, -0.097, -0.016)), 0.008, stiff=F)
    M.ball(c + Vector((0, -0.1, -0.028)), 0.013, stiff=3, neg=True)
    # mouth: torn open, wider on the left where the cheek has gone
    M.ell(c + Vector((0, -0.096, -0.062)), 0.028, 0.028, 0.018, stiff=3, neg=True)
    M.ell(c + Vector((0.024, -0.084, -0.066)), 0.016, 0.018, 0.013, stiff=3, neg=True)


def to_mesh(meta, name):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = meta.ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    me.name = name
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    bpy.data.objects.remove(meta.ob)
    for p in me.polygons:
        p.use_smooth = True
    return ob


def roughen(ob, amount=0.003, scale=0.04):
    """Lumpy skin: a low noise displacement over the whole surface."""
    tex = bpy.data.textures.new(ob.name + "_lumps", "CLOUDS")
    tex.noise_scale = scale
    tex.noise_depth = 3
    mod = ob.modifiers.new("lumps", "DISPLACE")
    mod.texture = tex
    mod.strength = amount
    mod.mid_level = 0.5
    mod.texture_coords = "OBJECT"
    sm = ob.modifiers.new("smooth", "CORRECTIVE_SMOOTH")
    sm.iterations = 3


# ---------------------------------------------------------------- materials
def mat_skin(name="ZB_Skin", base=0x7d8468, pale=0x9d9a80, bruise=0x5b5450, blood=0x3e0b08):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    bsdf = N["Principled BSDF"]
    tc = N.new("ShaderNodeTexCoord")
    noise = N.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 8.0
    L.new(tc.outputs["Object"], noise.inputs["Vector"])
    ramp = N.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hexlin(pale)
    ramp.color_ramp.elements[1].color = hexlin(base)
    ramp.color_ramp.elements.new(0.72).color = hexlin(bruise)
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[1].position = 0.5
    L.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    # veins: thin voronoi edges, warped by noise so they don't read as tiles
    warp = N.new("ShaderNodeTexNoise")
    warp.inputs["Scale"].default_value = 3.0
    L.new(tc.outputs["Object"], warp.inputs["Vector"])
    wmix = N.new("ShaderNodeMix")
    wmix.data_type = "VECTOR"
    wmix.inputs["Factor"].default_value = 0.25
    L.new(tc.outputs["Object"], wmix.inputs[4])
    L.new(warp.outputs["Color"], wmix.inputs[5])
    vor = N.new("ShaderNodeTexVoronoi")
    vor.feature = "DISTANCE_TO_EDGE"
    vor.inputs["Scale"].default_value = 18.0
    L.new(wmix.outputs[1], vor.inputs["Vector"])
    vr = N.new("ShaderNodeMapRange")
    vr.inputs["From Min"].default_value = 0.0
    vr.inputs["From Max"].default_value = 0.01
    vr.inputs["To Min"].default_value = 0.35
    vr.inputs["To Max"].default_value = 0.0
    L.new(vor.outputs["Distance"], vr.inputs["Value"])
    veins = N.new("ShaderNodeMix")
    veins.data_type = "RGBA"
    L.new(vr.outputs["Result"], veins.inputs["Factor"])
    L.new(ramp.outputs["Color"], veins.inputs[6])
    veins.inputs[7].default_value = hexlin(0x3a4048)
    # blood: big blotches
    bn = N.new("ShaderNodeTexNoise")
    bn.inputs["Scale"].default_value = 4.0
    bn.inputs["Detail"].default_value = 6.0
    L.new(tc.outputs["Object"], bn.inputs["Vector"])
    br = N.new("ShaderNodeMapRange")
    br.inputs["From Min"].default_value = 0.6
    br.inputs["From Max"].default_value = 0.66
    L.new(bn.outputs["Fac"], br.inputs["Value"])
    mix = N.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    L.new(br.outputs["Result"], mix.inputs["Factor"])
    L.new(veins.outputs[2], mix.inputs[6])
    mix.inputs[7].default_value = hexlin(blood)
    L.new(mix.outputs[2], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.58
    bump = N.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.3
    L.new(noise.outputs["Fac"], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def mat_flat(name, col, rough=0.6, emit=None, emit_k=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = hexlin(col)
    b.inputs["Roughness"].default_value = rough
    if emit is not None:
        b.inputs["Emission Color"].default_value = hexlin(emit)
        b.inputs["Emission Strength"].default_value = emit_k
    return m


# ---------------------------------------------------------------- face bits
def add_eyes_teeth():
    """Milky eyes sunk in the sockets; two rows of small, uneven, yellowed
    teeth; a dark mouth behind them."""
    c = J["head"]
    eye_m = mat_flat("ZB_Eye", 0xcfd4cb, 0.2, 0xb8c4bd, 0.1)
    gum_m = mat_flat("ZB_Gum", 0x2a0a08, 0.6)
    tooth_m = mat_flat("ZB_Tooth", 0xc9b98a, 0.4)
    obs = []
    for s in (1, -1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0112, segments=16, ring_count=10,
                                             location=c + Vector((s * 0.031, -0.063, 0.012)))
        e = bpy.context.active_object
        e.data.materials.append(eye_m)
        obs.append(e)
    rnd = random.Random(7)
    for z, h in ((-0.056, 0.011), (-0.071, 0.0095)):
        n = 12
        for i in range(n):
            if rnd.random() < 0.1:
                continue                           # a gap where one fell out
            t = (i + 0.5) / n - 0.5
            ang = t * 2.4
            x = math.sin(ang) * 0.026
            y = -0.086 + (1 - math.cos(ang)) * 0.022
            bpy.ops.mesh.primitive_cube_add(size=1, location=c + Vector((x, y, z)))
            tt = bpy.context.active_object
            w = 0.0052 if abs(t) < 0.2 else 0.0058
            tt.scale = (w, 0.0045, h * (0.8 + rnd.random() * 0.4))
            tt.rotation_euler = (rnd.uniform(-0.25, 0.25), rnd.uniform(-0.2, 0.2), -ang)
            bev = tt.modifiers.new("bev", "BEVEL")
            bev.width = 0.0012
            bev.segments = 2
            tt.data.materials.append(tooth_m)
            obs.append(tt)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=16, ring_count=10,
                                         location=c + Vector((0, -0.066, -0.064)))
    gm = bpy.context.active_object
    gm.scale = (0.027, 0.022, 0.022)
    gm.data.materials.append(gum_m)
    obs.append(gm)
    return obs


# ---------------------------------------------------------------- render
def look_body(name, gaunt=0.0, arm_len=1.0, claws=False, skin=None):
    M = build_body(gaunt, arm_len, claws)
    build_head(M, gaunt)
    ob = to_mesh(M, name)
    roughen(ob)
    ob.data.materials.append(skin or mat_skin())
    extras = add_eyes_teeth()
    return ob, extras


def render_setup():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = int(os.environ.get("ZB_SAMPLES", "32"))
    sc.cycles.use_denoising = True
    sc.render.resolution_x = int(os.environ.get("ZB_W", "720"))
    sc.render.resolution_y = int(os.environ.get("ZB_H", "1080"))
    sc.view_settings.view_transform = "AgX"
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = hexlin(0x1b1d1e)
    bg.inputs["Strength"].default_value = 0.5
    # key, rim, fill
    for nm, loc, e, col in (("key", (1.6, -2.2, 2.6), 420, 0xfff0dc),
                            ("rim", (-1.8, 2.0, 2.2), 240, 0xd9e2f0),
                            ("fill", (-2.2, -1.6, 1.0), 70, 0xeeeeee)):
        ld = bpy.data.lights.new(nm, "AREA")
        ld.energy = e
        ld.size = 1.2
        ld.color = hexlin(col)[:3]
        lo = bpy.data.objects.new(nm, ld)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 0.95)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(lo)
    cd = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    return cam


def shoot(cam, path, yaw_deg, target=(0, 0, 0.92), dist=4.6, height=1.0, lens=70):
    yaw = math.radians(yaw_deg)
    t = Vector(target)
    cam.data.lens = lens
    cam.location = Vector((t.x + math.sin(yaw) * dist, t.y - math.cos(yaw) * dist, height))
    cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    reset()
    os.makedirs(RENDER_DIR, exist_ok=True)
    gaunt = float(os.environ.get("ZB_GAUNT", "0"))
    arm = float(os.environ.get("ZB_ARM", "1"))
    ob, _ = look_body("ZB_Body", gaunt, arm, claws=gaunt > 0.5)
    cam = render_setup()
    tag = os.environ.get("ZB_TAG", "base")
    if "render" in ARGS:
        for yaw in [int(v) for v in os.environ.get("ZB_VIEWS", "0,35,90,180").split(",") if v]:
            shoot(cam, os.path.join(RENDER_DIR, f"{tag}-y{yaw}.png"), yaw)
        bpy.context.scene.render.resolution_x = 800
        bpy.context.scene.render.resolution_y = 800
        shoot(cam, os.path.join(RENDER_DIR, f"{tag}-face.png"), 20, target=(0, -0.05, 1.63), dist=0.9, height=1.68, lens=60)
    print("tris", sum(len(p.vertices) - 2 for p in ob.data.polygons))


main()
