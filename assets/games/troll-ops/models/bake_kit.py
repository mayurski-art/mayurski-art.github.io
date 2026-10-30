"""
Light-map baking for the map models (stylised realism, REALISM.md).

Builder.finish(..., bake={...}) calls bake_lightmap() on the finished object
before export: a second UV layer "Lightmap" (TEXCOORD_1 in the GLB), then a
Cycles DIFFUSE bake with the colour pass off, so the image holds LIGHT only
(sky, ground bounce, lamps; no albedo, no sun). The game keeps each model's
vertex colours and photo textures and adds this as the light map
(surface-textures.js applyBakedLightMap). The sun stays a real-time light: the
same model is placed turned 0 or 180 degrees, and sky light looks right either
way, a baked sun would not.

bake = {
  "res": 1024,                      # square image size
  "samples": 128,
  "sky": (0x8aa2cc, 0x6f8a55, 1.0), # up colour, horizon/down colour, strength
  "ground": 0x8faa70,               # the bounce plane's colour (None: no plane)
  "lights": [((x, y, z), 0xffcf9a, watts, radius), ...],   # GAME coordinates
  "blur": 1,                        # masked blur radius in pixels (bake noise)
  "scale": 1.0,                     # stored as light * scale (0.5: lamp-lit surfaces
                                    # up to 2 before the 8-bit image clips; the game
                                    # then lights it at PI / scale)
  "occluders": [(w, h, d, x, y, z), ...],   # boxes that block light, not baked
                                    # (floors the game builds in JS, say)
}
Writes <model>-bake.webp next to the GLB. Anything else in the Blender
scene (import_context: the map's finished models) shades and bounces too.

bake_ground() bakes a flat plane instead: the light on the map's ground,
seen from above, which the game projects onto its flat ground pieces by
world x/z (surface-textures.js applyGroundLightMap).
"""
import bpy
import math
import os
import numpy as np
from mathutils import Matrix
from map_kit import hexlin

_TEMP = []   # objects/data made for one bake, removed after it


def _world(up, down, strength):
    w = bpy.data.worlds.get("GS_BakeSky") or bpy.data.worlds.new("GS_BakeSky")
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    bg = nt.nodes.new("ShaderNodeBackground")
    out = nt.nodes.new("ShaderNodeOutputWorld")
    # Generated in a world shader is the view direction: z is up (Blender)
    nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
    maprange = nt.nodes.new("ShaderNodeMapRange")
    maprange.inputs["From Min"].default_value = -1.0
    maprange.inputs["From Max"].default_value = 1.0
    nt.links.new(sep.outputs["Z"], maprange.inputs["Value"])
    nt.links.new(maprange.outputs["Result"], ramp.inputs["Fac"])
    ramp.color_ramp.elements[0].position = 0.5
    ramp.color_ramp.elements[0].color = (*hexlin(down), 1.0)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (*hexlin(up), 1.0)
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    bpy.context.scene.world = w


def _ground(color, size=400.0):
    me = bpy.data.meshes.new("GS_BakeGround")
    h = size / 2
    me.from_pydata([(-h, -h, -0.005), (h, -h, -0.005), (h, h, -0.005), (-h, h, -0.005)], [], [(0, 1, 2, 3)])
    m = bpy.data.materials.new("GS_BakeGroundMat")
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*hexlin(color), 1.0)
    b.inputs["Roughness"].default_value = 1.0
    me.materials.append(m)
    ob = bpy.data.objects.new("GS_BakeGround", me)
    bpy.context.scene.collection.objects.link(ob)
    _TEMP.extend([ob, me, m])


def _light(pos, color, watts, radius):
    x, y, z = pos
    ld = bpy.data.lights.new("GS_BakeLamp", "POINT")
    ld.color = hexlin(color)
    ld.energy = watts
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new("GS_BakeLamp", ld)
    ob.location = (x, -z, y)          # game (x, y-up, z) -> Blender (x, -z, y)
    bpy.context.scene.collection.objects.link(ob)
    _TEMP.extend([ob, ld])


def _occluder(w, h, d, x, y, z):
    """A box (GAME coordinates, y = its base) that shades but isn't baked."""
    import bmesh
    from mathutils import Matrix
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(x, -z, y + h / 2), verts=bm.verts)
    me = bpy.data.meshes.new("GS_BakeOccluder")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("GS_BakeOccluder", me)
    bpy.context.scene.collection.objects.link(ob)
    _TEMP.extend([ob, me])


def _lightmap_uv(obj, margin):
    """A new "Lightmap" UV layer on obj, unwrapped and packed. obj may be a
    list: the objects are unwrapped together into one square (one atlas for a
    GLB of several meshes), each object's second layer reused if it has one."""
    objs = obj if isinstance(obj, (list, tuple)) else [obj]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        me = o.data
        if len(objs) > 1 and len(me.uv_layers) >= 2:
            uv = me.uv_layers[1]
            uv.name = "Lightmap"
        else:
            uv = me.uv_layers.new(name="Lightmap")
        me.uv_layers.active = uv
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    # one texel density everywhere, then a tight pack: a house is hundreds of
    # small parts (siding boards, trim) and smart_project's own packing left
    # most of the image empty
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.average_islands_scale()
    bpy.ops.uv.pack_islands(rotate=True, margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")


def _masked_blur(img, r):
    """Box-blurs only the baked texels (alpha > 0), so islands don't bleed
    into the empty space between them: blur(colour * mask) / blur(mask)."""
    if r <= 0:
        return
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    mask = (px[..., 3] > 0.0).astype(np.float32)
    col = px[..., :3] * mask[..., None]

    def box(a):
        k = 2 * r + 1
        p = np.pad(a, [(r, r), (r, r)] + [(0, 0)] * (a.ndim - 2), mode="constant")
        c = np.cumsum(np.cumsum(p, axis=0), axis=1)
        c = np.pad(c, [(1, 0), (1, 0)] + [(0, 0)] * (a.ndim - 2), mode="constant")
        return c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]

    num, den = box(col), box(mask)
    out = np.where(den[..., None] > 0, num / np.maximum(den[..., None], 1e-6), 0.0)
    px[..., :3] = np.where(mask[..., None] > 0, out, px[..., :3])
    img.pixels.foreach_set(px.ravel())


def import_context(placements):
    """Imports finished GLBs as stand-ins for the rest of the map: [(path,
    x, z, rot[, y, (sx, sy, sz)]), ...] in GAME coordinates (rot about +y,
    as maps.js places them). Returns the objects; remove_context() takes
    them out again."""
    objs = []
    for (path, x, z, rot, *rest) in placements:
        y = rest[0] if rest else 0.0
        sx, sy, sz = rest[1] if len(rest) > 1 else (1.0, 1.0, 1.0)
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        new = [o for o in bpy.data.objects if o not in before]
        # the placement on top of the model's own node transform (a GLB with
        # 16-bit positions keeps its centre and size there: quantize_glb.py)
        place = (Matrix.Translation((x, -z, y)) @ Matrix.Rotation(rot, 4, "Z")   # game yaw about +y = Blender +z
                 @ Matrix.Diagonal((sx, sz, sy, 1.0)))                           # game (x, y, z) -> Blender (x, z, y)
        for o in new:
            if o.parent is None:
                o.matrix_world = place @ o.matrix_world
            o.select_set(False)
        objs += new
    return objs


def remove_context(objs):
    meshes = {o.data for o in objs if o.type == "MESH"}
    for o in objs:
        bpy.data.objects.remove(o)
    for m in meshes:
        if m.users == 0:
            bpy.data.meshes.remove(m)


def bake_ground(path, rect, res=2048, samples=128, sky=(0x8aa2cc, 0x6f8a55, 1.0), color=0x8faa70,
                lights=(), blur=1, occluders=(), scale=1.0):
    """The light on the ground at y 0 over rect = (x0, z0, size) in GAME
    coordinates. Image u runs with x, v with z (glTF's top-down v: the
    game reads it as u = (x - x0) / size, v = (z - z0) / size)."""
    x0, z0, s = rect
    me = bpy.data.meshes.new("GS_GroundBake")
    # Blender (x, -z, 0); a plane at y 0 with "UVMap" and "Lightmap" alike
    me.from_pydata([(x0, -z0, 0), (x0 + s, -z0, 0), (x0 + s, -(z0 + s), 0), (x0, -(z0 + s), 0)], [], [(0, 3, 2, 1)])
    for name in ("UVMap", "Lightmap"):
        uv = me.uv_layers.new(name=name)
        # glTF flips v on export (v_gltf = 1 - v_blender): v_blender = 1 - (z - z0) / s
        for loop in me.loops:
            bx, by, _ = me.vertices[loop.vertex_index].co
            uv.data[loop.index].uv = ((bx - x0) / s, 1.0 - (-by - z0) / s)
    m = bpy.data.materials.new("GS_GroundBakeMat")
    m.use_nodes = True
    m.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (*hexlin(color), 1.0)
    me.materials.append(m)
    ob = bpy.data.objects.new("GS_GroundBake", me)
    bpy.context.scene.collection.objects.link(ob)
    bake_lightmap(ob, path, res=res, samples=samples, sky=sky, ground=None, lights=lights, blur=blur, occluders=occluders, scale=scale, uv=False)
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    bpy.data.materials.remove(m)


def bake_lightmap(obj, path, res=1024, samples=128, sky=(0x8aa2cc, 0x6f8a55, 1.0),
                  ground=0x8faa70, lights=(), blur=1, occluders=(), uv=True, scale=1.0):
    """obj may be a list of objects: baked together into one image, on one
    shared unwrap (their materials may be shared)."""
    objs = list(obj) if isinstance(obj, (list, tuple)) else [obj]
    obj = objs[0]
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.view_settings.view_transform = "Standard"
    _world(*sky)
    if ground is not None:
        _ground(ground)
    for L in lights:
        _light(*L)
    for o in occluders:
        _occluder(*o)
    if res == "auto":
        # by the model's size: ~25 texels a metre on a crate, coarser on big ones
        size = max(max(o.dimensions) for o in objs)
        res = 256 if size < 3 else 512 if size < 8 else 1024 if size < 24 else 2048
    if uv:
        _lightmap_uv(objs if len(objs) > 1 else obj, 4.0 / res)   # ~4 texels between islands
    else:
        for o in objs:
            o.data.uv_layers.active = o.data.uv_layers["Lightmap"]

    name = obj.name + "-bake"
    img = bpy.data.images.new(name, res, res, alpha=True, float_buffer=True)
    img.generated_color = (0, 0, 0, 0)
    nodes = []
    for m in {m for o in objs for m in o.data.materials if m}:
        n = m.node_tree.nodes.new("ShaderNodeTexImage")
        n.image = img
        m.node_tree.nodes.active = n
        nodes.append((m, n))
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, margin=4, use_clear=False,
                        target="IMAGE_TEXTURES")
    _masked_blur(img, blur)
    _save_webp(img, path, res, scale)

    # leave the model as it was, plus its Lightmap UV (UVMap stays the
    # active/first layer: TEXCOORD_0 for the photo textures)
    for m, n in nodes:
        m.node_tree.nodes.remove(n)
    for o in objs:
        o.data.uv_layers.active = o.data.uv_layers[0]
    bpy.data.images.remove(img)
    _clear_temp()


def _save_webp(img, path, res, scale=1.0, srgb=True):
    """An 8-bit WebP of a float bake: sRGB-encoded light (three reads it
    back as colour), or linear values as they are (an occlusion map)."""
    scene = bpy.context.scene
    out = bpy.data.images.new(img.name + "-8", res, res, alpha=False, float_buffer=False)
    px = np.empty(res * res * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    lit = px[:, :3] * scale
    c = np.clip(lit, 0.0, 1.0)
    # a byte image's pixels are stored as given: encode sRGB here
    px[:, :3] = np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055) if srgb else c
    px[:, 3] = 1.0
    out.pixels.foreach_set(px.ravel())
    out.filepath_raw = path
    out.file_format = "WEBP"
    scene.render.image_settings.quality = 85
    out.save()
    baked = lit[lit.max(axis=1) > 0]
    print("Baked", path, "max %.2f mean %.3f clipped %.1f%%" % (
        float(lit.max()), float(baked.mean()) if len(baked) else 0.0,
        100.0 * float((baked.max(axis=1) > 1.0).mean()) if len(baked) else 0.0))
    bpy.data.images.remove(out)


def _clear_temp():
    for d in _TEMP:
        if isinstance(d, bpy.types.Object):
            bpy.data.objects.remove(d)
    for d in _TEMP:
        if isinstance(d, bpy.types.Mesh):
            bpy.data.meshes.remove(d)
        elif isinstance(d, bpy.types.Material):
            bpy.data.materials.remove(d)
        elif isinstance(d, bpy.types.Light):
            bpy.data.lights.remove(d)
    _TEMP.clear()


def bake_ao(obj, path, res=1024, samples=64, distance=2.0, blur=1, uv_index=1):
    """An ambient-occlusion bake (Cycles AO, no light at all) of obj (or a
    list of objects, into one image) on its uv_index UV layer (the
    "Lightmap" / TEXCOORD_1 set), saved LINEAR as <path>: 1 on an open face,
    darker in corners and under props within `distance` metres. Everything
    else in the scene occludes. The game multiplies it into the indirect
    light at the map's strength (surface-textures.js applyBakedAOMap)."""
    objs = list(obj) if isinstance(obj, (list, tuple)) else [obj]
    obj = objs[0]
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.view_settings.view_transform = "Standard"
    _world(0xffffff, 0xffffff, 1.0)
    scene.world.light_settings.distance = distance
    for o in objs:
        o.data.uv_layers.active = o.data.uv_layers[uv_index]
    name = obj.name + "-ao"
    img = bpy.data.images.new(name, res, res, alpha=True, float_buffer=True)
    img.generated_color = (0, 0, 0, 0)
    nodes = []
    for m in {m for o in objs for m in o.data.materials if m}:
        if not m.use_nodes:
            m.use_nodes = True
        n = m.node_tree.nodes.new("ShaderNodeTexImage")
        n.image = img
        m.node_tree.nodes.active = n
        nodes.append((m, n))
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="AO", margin=4, use_clear=False, target="IMAGE_TEXTURES")
    _masked_blur(img, blur)
    _save_webp(img, path, res, 1.0, srgb=False)
    for m, n in nodes:
        m.node_tree.nodes.remove(n)
    for o in objs:
        o.data.uv_layers.active = o.data.uv_layers[0]
    bpy.data.images.remove(img)
    _clear_temp()
    _TEMP.clear()


# ------------------------------------------------------------------ guns (DESIGN-ARSENAL.md #2, #3, #7)
# bake_gun(recipe, ...) runs a gunkit v2 recipe twice (gunkit.HI on, then
# off), unwraps the low meshes into one atlas, bakes the high onto it in
# Cycles (tangent normals; then the material kit's base colour and ORM, which
# read edge curvature from a bevel-vs-true normal difference and AO on the
# high surface), writes <id>-base.webp (sRGB), <id>-orm.webp and
# <id>-nrm.webp (linear), exports <id>.glb (the moving parts as their own
# nodes, one "<prefix>_Kit" material for every baked surface) and the LOD1
# <id>-lod1.glb (everything joined into one node, decimated, with 256 px
# copies of the maps: <id>-lod1-base.webp ...).

# The arms material kit: six surfaces, one node group each (TF_<surface>).
# Colours are the defaults; kit_material() takes a gun's own. wear_* is what
# the edges wear down to; grain varies the colour across the surface.
SURFACES = {
    "anodized":   dict(color=0x1c1d1f, wear=0x8d9094, rough=0.42, metal=0.35, wear_rough=0.28, wear_metal=1.0, amount=0.55, grain=0.05),
    "cerakote":   dict(color=0x4b5236, wear=0x1f2022, rough=0.64, metal=0.0, wear_rough=0.38, wear_metal=0.45, amount=1.0, grain=0.07),
    "polymer":    dict(color=0x242424, wear=0x3c3b38, rough=0.8, metal=0.0, wear_rough=0.62, wear_metal=0.0, amount=0.35, grain=0.05),
    "parkerized": dict(color=0x2c2d2d, wear=0x80837f, rough=0.6, metal=0.55, wear_rough=0.3, wear_metal=1.0, amount=0.5, grain=0.09),
    "rubber":     dict(color=0x151515, wear=0x151515, rough=0.93, metal=0.0, wear_rough=0.93, wear_metal=0.0, amount=0.0, grain=0.03),
    "brass":      dict(color=0xb38f42, wear=0xe2c072, rough=0.3, metal=1.0, wear_rough=0.2, wear_metal=1.0, amount=0.4, grain=0.06),
}


def _sock(ng, name, kind, io="INPUT", default=None):
    s = ng.interface.new_socket(name, in_out=io, socket_type=kind)
    if default is not None and io == "INPUT":
        s.default_value = default
    return s


def surface_group(surface):
    """The node group for one kit surface (built once per file)."""
    name = "TF_" + surface
    ng = bpy.data.node_groups.get(name)
    if ng:
        return ng
    d = SURFACES[surface]
    ng = bpy.data.node_groups.new(name, "ShaderNodeTree")
    _sock(ng, "Color", "NodeSocketColor", default=(*hexlin(d["color"]), 1))
    _sock(ng, "Wear Color", "NodeSocketColor", default=(*hexlin(d["wear"]), 1))
    for n in ("Roughness", "Metallic", "Wear Roughness", "Wear Metallic", "Wear", "Grain", "Patches"):
        _sock(ng, n, "NodeSocketFloat", default={"Roughness": d["rough"], "Metallic": d["metal"], "Wear Roughness": d["wear_rough"],
                                                 "Wear Metallic": d["wear_metal"], "Wear": d["amount"], "Grain": d["grain"],
                                                 "Patches": 0.0}[n])
    for n, k in (("Base Color", "NodeSocketColor"), ("ORM", "NodeSocketColor"), ("Roughness", "NodeSocketFloat"), ("Metallic", "NodeSocketFloat")):
        _sock(ng, n, k, io="OUTPUT")
    N, L = ng.nodes, ng.links
    gi, go = N.new("NodeGroupInput"), N.new("NodeGroupOutput")

    def math(op, a, b=None, clamp=False):
        n = N.new("ShaderNodeMath")
        n.operation = op
        n.use_clamp = clamp
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L.new(v, n.inputs[i])
        return n.outputs[0]

    def remap(v, a, b, c=0.0, d_=1.0):
        n = N.new("ShaderNodeMapRange")
        n.clamp = True
        L.new(v, n.inputs["Value"])
        n.inputs["From Min"].default_value, n.inputs["From Max"].default_value = a, b
        n.inputs["To Min"].default_value, n.inputs["To Max"].default_value = c, d_
        return n.outputs["Result"]

    def lerp(a, b, t):
        return math("ADD", a, math("MULTIPLY", math("SUBTRACT", b, a), t))

    # edges: where a rounded (bevel) normal leaves the true one
    geo = N.new("ShaderNodeNewGeometry")
    bev = N.new("ShaderNodeBevel")
    bev.samples = 8
    bev.inputs["Radius"].default_value = 0.0016
    dot = N.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    L.new(bev.outputs["Normal"], dot.inputs[0])
    L.new(geo.outputs["Normal"], dot.inputs[1])
    edge = remap(math("SUBTRACT", 1.0, dot.outputs["Value"]), 0.0, 0.05)
    tc = N.new("ShaderNodeTexCoord")
    fine = N.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 260.0
    fine.inputs["Detail"].default_value = 8.0
    L.new(tc.outputs["Object"], fine.inputs["Vector"])
    broad = N.new("ShaderNodeTexNoise")
    broad.inputs["Scale"].default_value = 28.0
    broad.inputs["Detail"].default_value = 4.0
    L.new(tc.outputs["Object"], broad.inputs["Vector"])
    # paint chips: the edge mask broken up by the fine noise, scaled by Wear
    chips = remap(math("MULTIPLY", edge, math("ADD", 0.35, math("MULTIPLY", fine.outputs["Fac"], 1.3))), 0.42, 0.62)
    wear = math("MULTIPLY", chips, gi.outputs["Wear"], clamp=True)
    # Patches (0 = none): chips anywhere on a face, not only its edges (a
    # hard-used paint job), from a mid-size noise thresholded into flecks
    pn = N.new("ShaderNodeTexNoise")
    pn.inputs["Scale"].default_value = 140.0
    pn.inputs["Detail"].default_value = 12.0
    pn.inputs["Roughness"].default_value = 0.65
    L.new(tc.outputs["Object"], pn.inputs["Vector"])
    # (more Patches: more and bigger flecks; none at 0)
    on = math("MINIMUM", math("MULTIPLY", gi.outputs["Patches"], 10.0), 1.0)
    lvl = math("ADD", math("SUBTRACT", pn.outputs["Fac"], 0.72), math("MULTIPLY", gi.outputs["Patches"], 0.16))
    patch = math("MULTIPLY", math("MULTIPLY", lvl, 40.0, clamp=True), on)
    wear = math("MAXIMUM", wear, patch)
    # cavities: AO of the part itself (its neighbours are other bakes)
    ao = N.new("ShaderNodeAmbientOcclusion")
    ao.only_local = True
    ao.samples = 16
    ao.inputs["Distance"].default_value = 0.01
    aof = remap(ao.outputs["AO"], 0.0, 1.0, 0.25, 1.0)
    mix = N.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    L.new(wear, mix.inputs[0])
    L.new(gi.outputs["Color"], mix.inputs[6])
    L.new(gi.outputs["Wear Color"], mix.inputs[7])
    tone = math("MULTIPLY", remap(broad.outputs["Fac"], 0.3, 0.7, -1.0, 1.0), gi.outputs["Grain"])
    shade = math("MULTIPLY", math("ADD", 1.0, tone), remap(ao.outputs["AO"], 0.0, 1.0, 0.72, 1.0))
    scl = N.new("ShaderNodeVectorMath")
    scl.operation = "SCALE"
    L.new(mix.outputs[2], scl.inputs[0])
    L.new(shade, scl.inputs["Scale"])
    rough = math("ADD", lerp(gi.outputs["Roughness"], gi.outputs["Wear Roughness"], wear),
                 math("MULTIPLY", math("SUBTRACT", fine.outputs["Fac"], 0.5), 0.14), clamp=True)
    metal = lerp(gi.outputs["Metallic"], gi.outputs["Wear Metallic"], wear)
    orm = N.new("ShaderNodeCombineColor")
    L.new(aof, orm.inputs[0])
    L.new(rough, orm.inputs[1])
    L.new(metal, orm.inputs[2])
    L.new(scl.outputs["Vector"], go.inputs["Base Color"])
    L.new(orm.outputs["Color"], go.inputs["ORM"])
    L.new(rough, go.inputs["Roughness"])
    L.new(metal, go.inputs["Metallic"])
    return ng


def kit_material(name, surface, color=None, wear=None, **over):
    """A material on one kit surface: the node group drives a Principled
    BSDF (for renders) and is what the bake reads. over: Roughness=...,
    Metallic=..., Wear=..., Grain=... (the group's input names, _ for space)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    g = nt.nodes.new("ShaderNodeGroup")
    g.node_tree = surface_group(surface)
    g.name = "KIT"
    if color is not None:
        g.inputs["Color"].default_value = (*hexlin(color), 1)
        b.inputs["Base Color"].default_value = (*hexlin(color), 1)
    if wear is not None:
        g.inputs["Wear Color"].default_value = (*hexlin(wear), 1)
    for k, v in over.items():
        g.inputs[k.replace("_", " ")].default_value = v
    nt.links.new(g.outputs["Base Color"], b.inputs["Base Color"])
    nt.links.new(g.outputs["Roughness"], b.inputs["Roughness"])
    nt.links.new(g.outputs["Metallic"], b.inputs["Metallic"])
    m["tf_surface"] = surface
    return m


def _bake_output(m, what):
    """Point a high material's output at an Emission of `what` ("base" |
    "orm"), or back at its BSDF (None)."""
    nt = m.node_tree
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    em = nt.nodes.get("BAKE_EM") or nt.nodes.new("ShaderNodeEmission")
    em.name = "BAKE_EM"
    for l in list(out.inputs["Surface"].links):
        nt.links.remove(l)
    if what is None:
        bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
        return
    for l in list(em.inputs["Color"].links):
        nt.links.remove(l)
    g = nt.nodes.get("KIT")
    if g:
        nt.links.new(g.outputs["Base Color" if what == "base" else "ORM"], em.inputs["Color"])
    else:   # not a kit surface (glass, a glow): its flat values
        b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        em.inputs["Color"].default_value = (b.inputs["Base Color"].default_value if what == "base" else
                                            (1.0, b.inputs["Roughness"].default_value, b.inputs["Metallic"].default_value, 1.0))
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs["Surface"])


def _meshes():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def _apply_all(o):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    for md in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)


def _one_kit_slot(o, kit):
    """Every kit surface on o becomes the shared Kit material, one slot."""
    me = o.data
    mats = list(me.materials)
    new, remap = [], []
    for m in mats:
        t = kit if (m is not None and "tf_surface" in m) else m
        if t not in new:
            new.append(t)
        remap.append(new.index(t))
    idx = [0] * len(me.polygons)
    me.polygons.foreach_get("material_index", idx)
    idx = [remap[i] if i < len(remap) else 0 for i in idx]
    me.materials.clear()
    for m in new:
        me.materials.append(m)
    me.polygons.foreach_set("material_index", idx)


def _atlas(objs, margin, method="SCALED"):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        uv = o.data.uv_layers.get("UVMap") or o.data.uv_layers.new(name="UVMap")
        o.data.uv_layers.active = uv
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.average_islands_scale()
    bpy.ops.uv.pack_islands(rotate=True, margin=margin, margin_method=method)
    bpy.ops.object.mode_set(mode="OBJECT")


def _save_gun_webp(px, res, path, srgb=False, quality=90):
    """px: (res*res, 4) floats -> an 8-bit WebP (encoded sRGB when srgb)."""
    out = bpy.data.images.new(os.path.basename(path), res, res, alpha=False, float_buffer=False)
    p = px.copy()
    c = np.clip(p[:, :3], 0.0, 1.0)
    if srgb:
        c = np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)
    p[:, :3] = c
    p[:, 3] = 1.0
    out.pixels.foreach_set(p.ravel())
    out.filepath_raw = path
    out.file_format = "WEBP"
    bpy.context.scene.render.image_settings.quality = quality
    out.save()
    bpy.data.images.remove(out)
    return os.path.getsize(path)


def _shrink(px, res, k):
    a = px.reshape(res, res, 4)
    r = res // k
    return a.reshape(r, k, r, k, 4).mean(axis=(1, 3)).reshape(-1, 4)


def _export_glb(path, extras=True):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=False, export_apply=True,
                              export_yup=True, export_extras=extras, export_image_format="NONE",
                              export_tangents=True)   # the normal map was baked in these (MikkTSpace)


def _tris(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    out = {}
    for o in objs:
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        out[o.name] = len(me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
    return out


def bake_gun(recipe, gun_id, prefix, out_dir, res=1024, lod_res=256, lod_ratio=0.25, samples=16, render=None, margin_px=None):
    """recipe(): builds the gun's Parts and empties with gunkit (reading
    gunkit.HI). render: gunkit.render_views' views, rendered after export
    with the baked maps on (a check, not shipped). margin_px: the gap
    between UV islands in texels (default: 2 % scaled per island, which
    starves a gun of many small islands, a rail's teeth, of texels)."""
    import gunkit as gk
    import json
    scene = bpy.context.scene
    # the high pass, kept aside under HI_ names
    gk.HI = True
    before = set(scene.objects)
    recipe()
    hi = {}
    for o in [o for o in scene.objects if o not in before]:
        if o.type == "MESH":
            hi[o.name] = o
            o.name = "HI_" + o.name
        else:
            bpy.data.objects.remove(o)
    # the low pass: the game mesh
    gk.HI = False
    before = set(scene.objects)
    recipe()
    low = [o for o in scene.objects if o not in before and o.type == "MESH"]
    for o in low:
        _apply_all(o)
    kit = bpy.data.materials.new(prefix + "_Kit")
    kit.use_nodes = True
    kit.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.5, 0.5, 0.5, 1)
    for o in low:
        _one_kit_slot(o, kit)
    if margin_px is None:
        _atlas(low, 0.02)
    else:
        _atlas(low, margin_px / res, "FRACTION")

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.view_settings.view_transform = "Standard"
    bk = scene.render.bake
    bk.use_selected_to_active = True
    bk.cage_extrusion = 0.0015
    bk.max_ray_distance = 0.004
    bk.margin = max(4, res // 128)
    bk.normal_space = "TANGENT"
    pairs = [(hi[o.name], o) for o in low if o.name in hi]
    missing = [o.name for o in low if o.name not in hi]
    if missing:
        print("bake_gun: no high version of", missing)
    low_mats = {m for o in low for m in o.data.materials if m}
    hi_mats = {m for h, _ in pairs for m in h.data.materials if m}
    maps = {}
    for what, bake_type, fill in (("nrm", "NORMAL", (0.5, 0.5, 1.0, 1.0)), ("base", "EMIT", (0.2, 0.2, 0.2, 1.0)), ("orm", "EMIT", (1.0, 0.6, 0.0, 1.0))):
        img = bpy.data.images.new(prefix + "-" + what, res, res, alpha=True, float_buffer=True)
        img.colorspace_settings.name = "Non-Color"
        img.generated_color = fill
        nodes = []
        for m in low_mats:
            n = m.node_tree.nodes.new("ShaderNodeTexImage")
            n.image = img
            m.node_tree.nodes.active = n
            nodes.append((m, n))
        for m in hi_mats:
            _bake_output(m, what if bake_type == "EMIT" else None)
        for h, o in pairs:
            bpy.ops.object.select_all(action="DESELECT")
            h.select_set(True)
            o.select_set(True)
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.bake(type=bake_type, use_clear=False, target="IMAGE_TEXTURES")
        px = np.empty(res * res * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        maps[what] = px.reshape(-1, 4)
        for m, n in nodes:
            m.node_tree.nodes.remove(n)
        bpy.data.images.remove(img)
        print("baked", what)
    for m in hi_mats:
        _bake_output(m, None)

    stats = {"id": gun_id, "tex": {}}
    for what in ("base", "orm", "nrm"):
        stats["tex"][what] = _save_gun_webp(maps[what], res, os.path.join(out_dir, f"{gun_id}-{what}.webp"), srgb=what == "base",
                                        quality=95 if what == "nrm" else 90)
    # the game mesh: no high pass in the file
    for h in hi.values():
        me = h.data
        bpy.data.objects.remove(h)
        if me.users == 0:
            bpy.data.meshes.remove(me)
    glb = os.path.join(out_dir, gun_id + ".glb")
    _export_glb(glb)
    t0 = _tris(low)
    stats["lod0"] = {"tris": sum(t0.values()), "parts": t0, "draws": sum(len([m for m in o.data.materials if m]) or 1 for o in low),
                     "kb": os.path.getsize(glb) // 1024}

    # LOD1: one node, decimated, 256 px maps
    for what in ("base", "orm", "nrm"):
        stats["tex"]["lod1-" + what] = _save_gun_webp(_shrink(maps[what], res, res // lod_res), lod_res,
                                                  os.path.join(out_dir, f"{gun_id}-lod1-{what}.webp"), srgb=what == "base")
    body = next((o for o in low if o.name == prefix + "_Body"), low[0])
    bpy.ops.object.select_all(action="DESELECT")
    for o in low:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    for k in [k for k in body.keys() if k.startswith("tf_")]:
        del body[k]
    body.name = prefix + "_Body"
    dec = body.modifiers.new("lod", "DECIMATE")
    dec.ratio = lod_ratio
    dec.use_collapse_triangulate = True
    _apply_all(body)
    _one_kit_slot(body, kit)
    lod = os.path.join(out_dir, gun_id + "-lod1.glb")
    _export_glb(lod)
    stats["lod1"] = {"tris": _tris([body])[body.name], "draws": len([m for m in body.data.materials if m]), "kb": os.path.getsize(lod) // 1024}
    print("BAKE_STATS " + json.dumps(stats))

    if render:
        # the LOD1 on screen is enough to see the bake land; the LOD0
        # renders come from re-importing the export
        for o in list(scene.objects):
            bpy.data.objects.remove(o)
        bpy.ops.import_scene.gltf(filepath=glb)
        _wire_maps(prefix, out_dir, gun_id)
        gk.render_views(render["dir"], render["views"], prefix)
    return stats


def _wire_maps(prefix, out_dir, gun_id):
    """Puts the baked maps on the imported Kit material (for check renders;
    the import's copy, not the bake's, which may still hold the name)."""
    m = next((m for o in bpy.context.scene.objects if o.type == "MESH" for m in o.data.materials
              if m and m.name.startswith(prefix + "_Kit")), None)
    if not m:
        return
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")

    def tex(what, cs):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(os.path.join(out_dir, f"{gun_id}-{what}.webp"))
        n.image.colorspace_settings.name = cs
        return n
    base, orm, nrm = tex("base", "sRGB"), tex("orm", "Non-Color"), tex("nrm", "Non-Color")
    nt.links.new(base.outputs["Color"], b.inputs["Base Color"])
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(orm.outputs["Color"], sep.inputs[0])
    nt.links.new(sep.outputs[1], b.inputs["Roughness"])
    nt.links.new(sep.outputs[2], b.inputs["Metallic"])
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(nrm.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
