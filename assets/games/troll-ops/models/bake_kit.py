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

    # save as an 8-bit sRGB WebP (three reads it back as sRGB colour)
    out = bpy.data.images.new(name + "-8", res, res, alpha=False, float_buffer=False)
    px = np.empty(res * res * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    lit = px[:, :3] * scale
    # a byte image's pixels are stored as given: encode sRGB here
    c = np.clip(lit, 0.0, 1.0)
    px[:, :3] = np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)
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

    # leave the model as it was, plus its Lightmap UV (UVMap stays the
    # active/first layer: TEXCOORD_0 for the photo textures)
    for m, n in nodes:
        m.node_tree.nodes.remove(n)
    for o in objs:
        o.data.uv_layers.active = o.data.uv_layers[0]
    bpy.data.images.remove(img)
    bpy.data.images.remove(out)
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
