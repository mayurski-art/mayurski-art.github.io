"""
Bakes seamless procedural surface sets into textures/<name>_{color,normal,
rough}.jpg for surface-textures.js:
  dirt  packed construction-site ground with gravel
  cast  poured concrete: mottled grey, pores, fine grain

Run once per set:
  blender --background --python bake_surfaces.blender.py -- dirt
  blender --background --python bake_surfaces.blender.py -- cast

The noise is sampled on a 4D torus (cos/sin of u and v), so the baked
square tiles with no seam in either direction.
"""
import bpy
import math
import os
import sys

SURFACE = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "dirt"

RES = 1024
TEX_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "textures")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 4
scene.cycles.device = "CPU"

bpy.ops.mesh.primitive_plane_add(size=1)
plane = bpy.context.object
mat = bpy.data.materials.new(SURFACE)
mat.use_nodes = True
plane.data.materials.append(mat)
nt = mat.node_tree
N, Lk = nt.nodes, nt.links
for n in list(N):
    N.remove(n)


def node(t, **kw):
    n = N.new(t)
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def math_node(op, a=None, b=None, va=None, vb=None):
    m = node("ShaderNodeMath", operation=op)
    if a is not None:
        Lk.new(a, m.inputs[0])
    elif va is not None:
        m.inputs[0].default_value = va
    if b is not None:
        Lk.new(b, m.inputs[1])
    elif vb is not None:
        m.inputs[1].default_value = vb
    return m.outputs[0]


# torus coordinates from the plane's UV
tc = node("ShaderNodeTexCoord")
sep = node("ShaderNodeSeparateXYZ")
Lk.new(tc.outputs["UV"], sep.inputs[0])


def torus(radius):
    u = math_node("MULTIPLY", sep.outputs[0], vb=2 * math.pi)
    v = math_node("MULTIPLY", sep.outputs[1], vb=2 * math.pi)
    cu, su = math_node("COSINE", u), math_node("SINE", u)
    cv, sv = math_node("COSINE", v), math_node("SINE", v)
    comb = node("ShaderNodeCombineXYZ")
    for i, s in enumerate((cu, su, cv)):
        Lk.new(math_node("MULTIPLY", s, vb=radius), comb.inputs[i])
    w = math_node("MULTIPLY", sv, vb=radius)
    return comb.outputs[0], w


def noise(radius, scale, detail=6.0, rough=0.55):
    vec, w = torus(radius)
    n = node("ShaderNodeTexNoise", noise_dimensions="4D")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    Lk.new(vec, n.inputs["Vector"])
    Lk.new(w, n.inputs["W"])
    return n


def voronoi(radius, scale):
    vec, w = torus(radius)
    v = node("ShaderNodeTexVoronoi", voronoi_dimensions="4D")
    v.inputs["Scale"].default_value = scale
    Lk.new(vec, v.inputs["Vector"])
    Lk.new(w, v.inputs["W"])
    return v


def ramp(src, stops):
    r = node("ShaderNodeValToRGB")
    Lk.new(src, r.inputs[0])
    els = r.color_ramp.elements
    while len(els) < len(stops):
        els.new(0.5)
    for e, (pos, col) in zip(els, stops):
        e.position = pos
        e.color = col
    return r.outputs[0]


def lin(h):
    out = []
    for s in (16, 8, 0):
        v = ((h >> s) & 255) / 255
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


def dirt_graph():
    # soil: broad colour variation + damp patches
    soil_n = noise(1.0, 2.4, 10, 0.68)
    soil = ramp(soil_n.outputs["Fac"], [(0.3, lin(0x5e4d3b)), (0.5, lin(0x7a6650)), (0.72, lin(0x8e7a60))])
    damp_n = noise(0.6, 1.2, 3, 0.5)
    damp = ramp(damp_n.outputs["Fac"], [(0.55, (1, 1, 1, 1)), (0.7, (0.62, 0.6, 0.58, 1))])
    soil_d = node("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    soil_d.inputs["Factor"].default_value = 1.0
    Lk.new(soil, soil_d.inputs[6])
    Lk.new(damp, soil_d.inputs[7])

    # gravel: voronoi cells; stones where F1 distance is small
    gv = voronoi(1.0, 9.0)
    stone_mask = ramp(gv.outputs["Distance"], [(0.3, (1, 1, 1, 1)), (0.38, (0, 0, 0, 1))])
    sparse = noise(0.8, 2.2, 2, 0.5)
    sparse_m = ramp(sparse.outputs["Fac"], [(0.38, (0.25, 0.25, 0.25, 1)), (0.55, (1, 1, 1, 1))])
    mask = node("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    mask.inputs["Factor"].default_value = 1.0
    Lk.new(stone_mask, mask.inputs[6])
    Lk.new(sparse_m, mask.inputs[7])
    # fine gravel everywhere, under the coarse stones
    fv = voronoi(1.0, 26.0)
    fine_m = ramp(fv.outputs["Distance"], [(0.22, (0.75, 0.75, 0.75, 1)), (0.3, (0, 0, 0, 1))])
    both = node("ShaderNodeMix", data_type="RGBA", blend_type="LIGHTEN")
    both.inputs["Factor"].default_value = 1.0
    Lk.new(mask.outputs[2], both.inputs[6])
    Lk.new(fine_m, both.inputs[7])
    stone_col = ramp(gv.outputs["Color"], [(0.0, lin(0x6f6b64)), (0.5, lin(0x9a948a)), (1.0, lin(0xb3aa98))])
    col = node("ShaderNodeMix", data_type="RGBA")
    Lk.new(both.outputs[2], col.inputs["Factor"])
    Lk.new(soil_d.outputs[2], col.inputs[6])
    Lk.new(stone_col, col.inputs[7])
    # fine grit speckle on top
    grit = noise(1.0, 60.0, 2, 0.5)
    grit_c = ramp(grit.outputs["Fac"], [(0.35, (0.82, 0.82, 0.82, 1)), (0.65, (1.12, 1.1, 1.08, 1))])
    colf = node("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    colf.inputs["Factor"].default_value = 1.0
    Lk.new(col.outputs[2], colf.inputs[6])
    Lk.new(grit_c, colf.inputs[7])

    # height: stones up, soil lumps, grit
    stone_h = math_node("MULTIPLY", both.outputs[2], vb=0.8)
    soil_h = math_node("MULTIPLY", soil_n.outputs["Fac"], vb=0.5)
    grit_h = math_node("MULTIPLY", grit.outputs["Fac"], vb=0.15)
    height = math_node("ADD", math_node("ADD", stone_h, soil_h), grit_h)

    rough_d = math_node("SUBTRACT", va=0.97, b=math_node("MULTIPLY", both.outputs[2], vb=0.22))
    return colf.outputs[2], rough_d, height, 0.9


def mix(blend, a, b, fac=1.0):
    m = node("ShaderNodeMix", data_type="RGBA", blend_type=blend)
    m.inputs["Factor"].default_value = fac
    Lk.new(a, m.inputs[6])
    Lk.new(b, m.inputs[7])
    return m.outputs[2]


def cast_graph():
    # broad tone drift + blotchy curing marks
    tone_n = noise(1.0, 1.4, 6, 0.55)
    tone = ramp(tone_n.outputs["Fac"], [(0.3, lin(0x8a8984)), (0.5, lin(0x9c9b95)), (0.7, lin(0xa9a8a1))])
    blot_n = noise(1.0, 5.0, 8, 0.62)
    blot = ramp(blot_n.outputs["Fac"], [(0.35, (0.88, 0.88, 0.87, 1)), (0.5, (1, 1, 1, 1)), (0.68, (1.06, 1.06, 1.05, 1))])
    c = mix("MULTIPLY", tone, blot)
    # pinholes: small dark pores where voronoi F1 is tiny
    pv = voronoi(1.0, 70.0)
    pores = ramp(pv.outputs["Distance"], [(0.05, (0.55, 0.55, 0.55, 1)), (0.1, (1, 1, 1, 1))])
    c = mix("MULTIPLY", c, pores)
    grain_n = noise(1.0, 110.0, 2, 0.5)
    grain = ramp(grain_n.outputs["Fac"], [(0.35, (0.9, 0.9, 0.9, 1)), (0.65, (1.07, 1.07, 1.07, 1))])
    c = mix("MULTIPLY", c, grain)
    height = math_node("ADD", math_node("MULTIPLY", grain_n.outputs["Fac"], vb=0.3),
                       math_node("MULTIPLY", blot_n.outputs["Fac"], vb=0.4))
    sep_p = node("ShaderNodeSeparateColor")
    Lk.new(pores, sep_p.inputs[0])
    height = math_node("ADD", height, math_node("MULTIPLY", sep_p.outputs[0], vb=0.5))
    rough = math_node("ADD", va=0.82, b=math_node("MULTIPLY", blot_n.outputs["Fac"], vb=0.15))
    return c, rough, height, 0.5


color_out, rough_d, height, bump_strength = {"dirt": dirt_graph, "cast": cast_graph}[SURFACE]()

emit = node("ShaderNodeEmission")
out = node("ShaderNodeOutputMaterial")
bsdf = node("ShaderNodeBsdfPrincipled")
bump = node("ShaderNodeBump")
bump.inputs["Strength"].default_value = bump_strength
bump.inputs["Distance"].default_value = 0.02
Lk.new(height, bump.inputs["Height"])
Lk.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

img_node = node("ShaderNodeTexImage")
N.active = img_node


def bake(kind, filename, source=None):
    img = bpy.data.images.new(filename, RES, RES)
    if kind == "NORMAL":
        img.colorspace_settings.name = "Non-Color"
    img_node.image = img
    N.active = img_node
    if kind == "EMIT":
        Lk.new(source, emit.inputs["Color"])
        Lk.new(emit.outputs[0], out.inputs["Surface"])
    else:
        Lk.new(bsdf.outputs[0], out.inputs["Surface"])
    bpy.context.view_layer.objects.active = plane
    plane.select_set(True)
    bpy.ops.object.bake(type=kind, use_clear=True, margin=0)
    img.filepath_raw = os.path.join(TEX_DIR, filename)
    img.file_format = "JPEG"
    scene.render.image_settings.quality = 88
    img.save()
    print("baked", filename)


bake("EMIT", f"{SURFACE}_color.jpg", color_out)
rough_c = node("ShaderNodeCombineXYZ")
for i in range(3):
    Lk.new(rough_d, rough_c.inputs[i])
bake("EMIT", f"{SURFACE}_rough.jpg", rough_c.outputs[0])
bake("NORMAL", f"{SURFACE}_normal.jpg")
