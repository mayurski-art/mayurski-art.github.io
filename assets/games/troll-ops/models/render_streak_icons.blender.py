"""
Scorestreak HUD icons, rendered from the game's own streak models.

    blender --background --python render_streak_icons.blender.py

Each streak's glb is framed three-quarter from the front, lit like a studio
product shot, and rendered on a transparent background to
../streak-icons/<streak id>.png (ICON_PX square). The HUD shows these in
place of the streak names (game.js updateStreakHud).
"""
import bpy
import math
import os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "streak-icons")
ICON_PX = int(os.environ.get("ICON_PX", "256"))
SAMPLES = int(os.environ.get("ICON_SAMPLES", "64"))

# streak id -> (model, view direction from the model's centre, lens)
STREAKS = {
    "uav":         ("recon-drone.glb", (1.0, -1.25, 0.95), 70),
    # the same plane in dark jammer red (FINISH below), seen from the other side
    "counteruav":  ("recon-drone.glb", (-1.0, -1.25, 0.95), 70),
    "carepackage": ("care-package.glb", (1.0, -1.35, 0.85), 70),
    "drone":       ("hunter-drone.glb", (1.0, -1.25, 0.95), 70),
    "airstrike":   ("strike-jet.glb", (1.2, -1.0, 0.75), 70),
    "helicopter":  ("helicopter.glb", (1.3, -1.0, 0.55), 70),
    "k9":          ("k9-dog.glb", (1.25, 1.0, 0.45), 70),
    "warship":     ("vtol-warship.glb", (1.2, 1.1, 0.7), 70),
    "vsat":        ("orbital-vsat.glb", (-0.75, 1.4, 0.4), 70),
    # three drones in a loose V: the swarm
    "swarm":       (["hunter-drone.glb", "hunter-drone.glb", "hunter-drone.glb"], (1.0, -1.25, 0.95), 70),
}
# Nose is +Y in these two (the older models face -Y), hence the flipped views.
# ICON_ONLY=k9,warship renders just those.
ONLY = [s for s in os.environ.get("ICON_ONLY", "").split(",") if s]
# Hull colour the neutral greys become: olive drab by default.
FINISH = {"counteruav": (0.34, 0.07, 0.06)}
# These keep their own colours (the VSAT is gold foil and blue-grey cells).
NO_FINISH = {"vsat"}
SWARM_OFFSETS = [(0, 0, 0.3), (0.55, 0.45, -0.2), (-0.35, -0.55, -0.35)]


def render(streak, model, view, lens):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    models = model if isinstance(model, list) else [model]
    for i, m in enumerate(models):
        before = set(scene.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, m))
        if len(models) > 1:
            for o in set(scene.objects) - before:
                if o.parent is None:
                    o.location = Vector(o.location) + Vector(SWARM_OFFSETS[i])
                    o.rotation_euler.z += (i - 1) * 0.25
    bpy.context.view_layer.update()
    meshes = [o for o in scene.objects if o.type == "MESH"]
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector((min(lo[i], w[i]) for i in range(3)))
            hi = Vector((max(hi[i], w[i]) for i in range(3)))
    centre = (lo + hi) / 2
    radius = (hi - lo).length / 2

    # Military finish: neutral greys become olive-drab / gunmetal; coloured
    # details (lights, straps, glass) keep their colour.
    import colorsys
    for m in ([] if streak in NO_FINISH else bpy.data.materials):
        if not m.use_nodes:
            continue
        b = m.node_tree.nodes.get("Principled BSDF")
        if not b:
            continue
        r, g, bl, a = b.inputs["Base Color"].default_value
        h, l, sat = colorsys.rgb_to_hls(r, g, bl)
        if sat < 0.18:
            k = 0.35 + 0.65 * min(1.0, l * 1.6)
            fr, fg, fb = FINISH.get(streak, (0.20, 0.225, 0.17))
            b.inputs["Base Color"].default_value = (fr * k, fg * k, fb * k, a)
            b.inputs["Metallic"].default_value = 0.45
            b.inputs["Roughness"].default_value = 0.42

    scene.render.engine = "CYCLES"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = ICON_PX
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Punchy"
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.58, 0.62, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7

    def area(name, direction, size, power, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.size = size * radius
        ld.energy = power * radius * radius
        ld.color = color
        ob = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(ob)
        ob.location = centre + Vector(direction).normalized() * radius * 4
        ob.rotation_euler = (centre - ob.location).to_track_quat("-Z", "Y").to_euler()

    area("key", (1.2, -1.0, 1.4), 1.5, 900)
    area("fill", (-1.4, -0.6, 0.4), 2.0, 280, (0.85, 0.92, 1.0))
    area("rim", (-0.2, 1.4, 0.9), 1.2, 700, (0.8, 1.0, 0.8))

    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = lens
    cam = bpy.data.objects.new("cam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam
    d = Vector(view).normalized()
    cam.location = centre + d * radius * 4
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    # fit the camera to the model's real outline (every vertex), then back
    # off a touch so nothing kisses the edge
    pts = []
    for o in meshes:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            pts.extend((w.x, w.y, w.z))
    bpy.context.view_layer.update()
    loc, _ = cam.camera_fit_coords(bpy.context.evaluated_depsgraph_get(), pts)
    cam.location = centre + (loc - centre) * 1.1

    os.makedirs(OUT, exist_ok=True)
    scene.render.filepath = os.path.join(OUT, streak + ".png")
    bpy.ops.render.render(write_still=True)
    print("icon", streak, "radius", round(radius, 3))


for sid, (model, view, lens) in STREAKS.items():
    if ONLY and sid not in ONLY:
        continue
    render(sid, model, view, lens)
